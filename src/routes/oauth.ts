/**
 * POST /oauth/token — Client Credentials Grant
 *
 * Implements OAuth 2.0 RFC 6749 Section 4.4 Client Credentials Grant.
 * Only supports grant_type=client_credentials with Basic authentication.
 *
 * Request:
 *   POST /oauth/token
 *   Content-Type: application/x-www-form-urlencoded
 *   Authorization: Basic base64(client_id:client_secret)
 *   Body: grant_type=client_credentials&scope=<scopes>&resource=<service>
 *
 * Success Response (200):
 *   { access_token, token_type: "Bearer", expires_in: 600, scope }
 *   Headers: Cache-Control: no-store, Pragma: no-cache
 *
 * Error Responses:
 *   400 invalid_grant, invalid_scope, unsupported_grant_type
 *   401 invalid_client
 */

import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { tokenRequestSchema, tokenExchangeRequestSchema } from '../schemas/oauth.js';
import { issueToken } from '../lib/oauth/service.js';
import { exchangeToken } from '../lib/oauth/token-exchange.js';
import {
  authorizeV1DirectToken,
  issueV1DirectToken,
  type V1DirectTokenParams,
} from '../lib/oauth/v1/direct.js';
import { V1OAuthError } from '../lib/oauth/v1/errors.js';
import { auditLog } from '../lib/oauth/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { OAuthHttpError } from '../utils/http-error.js';

export const oauthRouter = Router();

// Rate limiter for token endpoint
const tokenLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX_FAILS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'invalid_client', error_description: 'Too many requests' },
});

oauthRouter.post('/token', tokenLimiter, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  // ── 1. Validate Content-Type ───────────────────────────────────────────
  const contentType = req.headers['content-type'] || '';

  // Allow form-urlencoded with optional charset suffix
  const isFormUrlencoded =
    contentType.startsWith('application/x-www-form-urlencoded');

  if (!isFormUrlencoded) {
    throw new OAuthHttpError(400, 'unsupported_grant_type');
  }

  // ── 2. Extract and validate body parameters ───────────────────────────
  // req.body is parsed by express.urlencoded({ extended: false }) middleware.
  // Values are strings (or string arrays if duplicate keys are sent).
  const rawBody = req.body || {};

  // Fail closed on non-string, array, or object values
  function safeString(val: unknown, field: string): string {
    if (typeof val === 'string') return val;
    // Reject arrays (duplicate params), objects, booleans, numbers
    if (Array.isArray(val) || (val !== null && typeof val === 'object') || typeof val === 'number' || typeof val === 'boolean') {
      throw new OAuthHttpError(400, 'invalid_grant');
    }
    return '';
  }

  const grantType = safeString(rawBody.grant_type, 'grant_type');

  // ── 3. Dispatch by grant type ──────────────────────────────────────────

  // ── 3a. Client Credentials (RFC 6749 §4.4) ────────────────────────────
  if (grantType === 'client_credentials') {
    const resource = safeString(rawBody.resource, 'resource');
    const scope = safeString(rawBody.scope, 'scope');

    const parsed = tokenRequestSchema.safeParse({ grant_type: grantType, resource, scope });
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      if (firstError?.path[0] === 'grant_type') {
        throw new OAuthHttpError(400, 'unsupported_grant_type');
      }
      if (firstError?.path[0] === 'resource') {
        throw new OAuthHttpError(400, 'invalid_grant');
      }
      throw new OAuthHttpError(400, 'invalid_request');
    }

    const { scope: validatedScope, resource: validatedResource } = parsed.data;

    // Extract Basic Auth
    const { clientId, clientSecret } = extractBasicAuth(req);
    if (!clientId || !clientSecret) {
      throw new OAuthHttpError(401, 'invalid_client');
    }

    try {
      const tokenParams = {
        clientId,
        clientSecret,
        resource: validatedResource,
        scope: validatedScope,
      };
      const result = env.AUTH_CONTRACT_MODE === 'v1'
        ? await issueV1DirectToken(tokenParams)
        : await issueToken(tokenParams);
      if (env.AUTH_CONTRACT_MODE === 'v1_shadow') {
        await evaluateV1DirectShadow(tokenParams);
      }

      res.json({
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        scope: result.scope,
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      const message = err.message || 'internal_error';
      const oauthError = mapToOAuthError(message, status);
      throw new OAuthHttpError(oauthError.status, oauthError.error);
    }
    return;
  }

  // ── 3b. Token Exchange (RFC 8693) ──────────────────────────────────────
  if (grantType === 'urn:ietf:params:oauth:grant-type:token-exchange') {
    const subjectToken = safeString(rawBody.subject_token, 'subject_token');
    const subjectTokenType = safeString(rawBody.subject_token_type, 'subject_token_type');
    const requestedTokenType = safeString(rawBody.requested_token_type, 'requested_token_type');
    const audience = safeString(rawBody.audience, 'audience');
    const scopeTE = safeString(rawBody.scope, 'scope');

    // Reject arbitrary-subject fields (design §1.4)
    if (
      rawBody.requested_subject !== undefined ||
      rawBody.subject !== undefined ||
      rawBody.subject_id !== undefined ||
      rawBody.requested_sub !== undefined ||
      rawBody.actor_token !== undefined
    ) {
      throw new OAuthHttpError(400, 'invalid_request');
    }

    const parsed = tokenExchangeRequestSchema.safeParse({
      grant_type: grantType,
      subject_token: subjectToken,
      subject_token_type: subjectTokenType || 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: requestedTokenType || 'urn:ietf:params:oauth:token-type:access_token',
      audience,
      scope: scopeTE,
    });

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      if (firstError?.path[0] === 'grant_type') {
        throw new OAuthHttpError(400, 'unsupported_grant_type');
      }
      if (firstError?.path[0] === 'subject_token') {
        throw new OAuthHttpError(400, 'invalid_request');
      }
      if (firstError?.path[0] === 'audience') {
        throw new OAuthHttpError(400, 'invalid_grant');
      }
      throw new OAuthHttpError(400, 'invalid_request');
    }

    const teData = parsed.data;

    // Extract Basic Auth
    const { clientId, clientSecret } = extractBasicAuth(req);
    if (!clientId || !clientSecret) {
      throw new OAuthHttpError(401, 'invalid_client');
    }

    try {
      const result = await exchangeToken({
        clientId,
        clientSecret,
        subjectToken: teData.subject_token,
        subjectTokenType: teData.subject_token_type,
        requestedTokenType: teData.requested_token_type,
        audience: teData.audience,
        scope: teData.scope,
        requestId: `req-${Date.now()}-${cryptoRandomHex(4)}`,
      });

      res.json({
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        scope: result.scope,
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      const message = err.message || 'internal_error';
      const oauthError = mapToOAuthError(message, status);
      throw new OAuthHttpError(oauthError.status, oauthError.error);
    }
    return;
  }

  // ── 3c. Unknown grant type ─────────────────────────────────────────────
  throw new OAuthHttpError(400, 'unsupported_grant_type');
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract clientId and clientSecret from the Basic Authorization header.
 * Returns empty strings (not throwing) so the caller can decide the response.
 */
function extractBasicAuth(req: any): { clientId: string; clientSecret: string } {
  const authHeader = req.headers['authorization'] || '';
  const basicMatch = authHeader.match(/^Basic\s+(.+)$/i);
  if (!basicMatch) return { clientId: '', clientSecret: '' };

  try {
    const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return { clientId: '', clientSecret: '' };
    return {
      clientId: decoded.slice(0, colonIndex),
      clientSecret: decoded.slice(colonIndex + 1),
    };
  } catch {
    return { clientId: '', clientSecret: '' };
  }
}

/**
 * Generate a random hex string for request IDs.
 */
function cryptoRandomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

async function evaluateV1DirectShadow(params: V1DirectTokenParams): Promise<void> {
  try {
    const authorized = await authorizeV1DirectToken(params);
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'v1.shadow.direct',
      principalId: authorized.principalId,
      agentId: authorized.agentId,
      clientId: authorized.clientId,
      resource: authorized.audience,
      success: true,
    });
  } catch (error) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'v1.shadow.direct',
      clientId: params.clientId,
      resource: params.resource,
      success: false,
      error: error instanceof V1OAuthError ? error.category : 'shadow_evaluation_failed',
    });
  }
}

/**
 * Map internal error messages to OAuth 2.0 standard error responses.
 */
function mapToOAuthError(
  message: string,
  status: number,
): { status: number; error: string } {
  switch (message) {
    case 'invalid_client':
      return { status: 401, error: 'invalid_client' };
    case 'invalid_scope':
      return { status: 400, error: 'invalid_scope' };
    case 'invalid_target':
      return { status: 400, error: 'invalid_target' };
    case 'invalid_grant':
    case 'invalid_resource':
      return { status: 400, error: 'invalid_grant' };
    case 'unsupported_token_type':
      return { status: 400, error: 'unsupported_token_type' };
    case 'unsupported_grant_type':
      return { status: 400, error: 'unsupported_grant_type' };
    case 'temporarily_unavailable':
      return { status: 503, error: 'temporarily_unavailable' };
    case 'server_error':
      return { status: 500, error: 'server_error' };
    case 'obo_chaining_rejected':
      return { status: 400, error: 'invalid_grant' };
    default:
      return { status: status >= 400 && status < 500 ? status : 401, error: 'invalid_client' };
  }
}
