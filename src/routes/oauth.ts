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

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { tokenRequestSchema } from '../schemas/oauth.js';
import { issueToken } from '../lib/oauth/service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';

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
  // ── 1. Validate Content-Type ───────────────────────────────────────────
  const contentType = req.headers['content-type'] || '';

  // Allow form-urlencoded with optional charset suffix
  const isFormUrlencoded =
    contentType.startsWith('application/x-www-form-urlencoded');

  if (!isFormUrlencoded) {
    throw new HttpError(400, 'unsupported_grant_type');
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
      throw new HttpError(400, 'invalid_grant');
    }
    return '';
  }

  const grantType = safeString(rawBody.grant_type, 'grant_type');
  const resource = safeString(rawBody.resource, 'resource');
  const scope = safeString(rawBody.scope, 'scope');

  // ── 3. Validate with Zod ───────────────────────────────────────────────
  const parsed = tokenRequestSchema.safeParse({ grant_type: grantType, resource, scope });
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    if (firstError?.path[0] === 'grant_type') {
      throw new HttpError(400, 'unsupported_grant_type');
    }
    if (firstError?.path[0] === 'resource') {
      throw new HttpError(400, 'invalid_grant');
    }
    throw new HttpError(400, 'invalid_request');
  }

  const { scope: validatedScope, resource: validatedResource } = parsed.data;

  // ── 4. Extract Basic Auth ──────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  let clientId: string;
  let clientSecret: string;

  const basicMatch = authHeader.match(/^Basic\s+(.+)$/i);
  if (!basicMatch) {
    throw new HttpError(401, 'invalid_client');
  }

  try {
    const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      throw new HttpError(401, 'invalid_client');
    }
    clientId = decoded.slice(0, colonIndex);
    clientSecret = decoded.slice(colonIndex + 1);
  } catch {
    throw new HttpError(401, 'invalid_client');
  }

  if (!clientId || !clientSecret) {
    throw new HttpError(401, 'invalid_client');
  }

  // ── 5. Issue Token ─────────────────────────────────────────────────────
  try {
    const result = await issueToken({
      clientId,
      clientSecret,
      resource: validatedResource,
      scope: validatedScope,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
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
    throw new HttpError(oauthError.status, oauthError.error);
  }
}));

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
    case 'invalid_grant':
    case 'invalid_resource':
      return { status: 400, error: 'invalid_grant' };
    default:
      return { status, error: 'invalid_client' };
  }
}
