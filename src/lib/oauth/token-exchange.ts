/**
 * Workflow Agent OBO Token Exchange (PR-B).
 *
 * Implements RFC 8693 Token Exchange for aud=svc-workflow.
 *
 * V0 scope:
 *   - Subject token: Agent direct workflow token (RS256, aud=svc-workflow,
 *     principal_type=agent, token_use=access, no act, not an OBO token).
 *   - ADC authentication: HTTP Basic (MachineClient + secret).
 *   - OBO output: RS256, aud=svc-workflow, token_use=workflow_obo.
 *   - OBO chaining: BLOCKED.
 *   - User OBO: NOT IMPLEMENTED.
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { verifyClientSecret } from './secret.js';
import { verifyWorkflowToken, getActiveKid } from './workflow-signer.js';
import { auditLog } from './audit.js';
import { parseScopeString } from '../../schemas/oauth.js';
import { env } from '../../config/env.js';
import { getWorkflowKeyring } from './workflow-keyring.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** OBO access token TTL: hard-capped at 300 seconds (design §8). */
export const OBO_MAX_TTL = 300;

/** The subject token must be a direct (non-OBO) access token. */
const SUBJECT_REQUIRED_TOKEN_USE = 'access';

/** The subject token must have this principal_type (Agent only in V0). */
const SUBJECT_REQUIRED_PRINCIPAL_TYPE = 'agent';

/** Audience parameter must be svc-workflow. */
const REQUIRED_AUDIENCE = 'svc-workflow';

/** V0 only accepts this subject_token_type. */
const ACCEPTED_SUBJECT_TOKEN_TYPE =
  'urn:ietf:params:oauth:token-type:access_token';

/** V0 only produces this requested_token_type. */
const ACCEPTED_REQUESTED_TOKEN_TYPE =
  'urn:ietf:params:oauth:token-type:access_token';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TokenExchangeParams {
  /** ADC MachineClient.clientId (from Basic Auth). */
  clientId: string;
  /** ADC MachineClient secret (from Basic Auth). */
  clientSecret: string;
  /** Subject token JWT string. */
  subjectToken: string;
  /** Subject token type URN. */
  subjectTokenType: string;
  /** Requested token type URN. */
  requestedTokenType: string;
  /** Target audience (must be svc-workflow). */
  audience: string;
  /** Requested scopes (space-delimited). */
  scope: string;
  /** Optional correlation/request ID. */
  requestId?: string;
}

export interface TokenExchangeResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// ─── Exported Functions ──────────────────────────────────────────────────────

/**
 * Execute a token exchange (RFC 8693).
 *
 * @throws Error with `statusCode` property for HTTP error mapping.
 */
export async function exchangeToken(
  params: TokenExchangeParams,
): Promise<TokenExchangeResult> {
  const requestId =
    params.requestId ||
    `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // ── 0. Basic token type validation ──────────────────────────────────────
  if (params.subjectTokenType !== ACCEPTED_SUBJECT_TOKEN_TYPE) {
    throw Object.assign(
      new Error('unsupported_token_type'),
      { statusCode: 400, auditError: 'unsupported_token_type' },
    );
  }
  if (params.requestedTokenType !== ACCEPTED_REQUESTED_TOKEN_TYPE) {
    throw Object.assign(
      new Error('unsupported_token_type'),
      { statusCode: 400, auditError: 'unsupported_token_type' },
    );
  }

  // ── 1. ADC Client Authentication ────────────────────────────────────────
  const client = await prisma.machineClient.findUnique({
    where: { clientId: params.clientId },
    include: { principal: true },
  });

  if (!client) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      clientId: params.clientId,
      resource: params.audience,
      success: false,
      error: 'client_not_found',
      requestId,
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  if (client.status === 'revoked') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      clientId: client.clientId,
      resource: params.audience,
      success: false,
      error: 'client_revoked',
      requestId,
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  if (client.principal.status === 'disabled') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      success: false,
      error: 'principal_disabled',
      requestId,
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  const secretValid = verifyClientSecret(params.clientSecret, client.secretHash);
  if (!secretValid) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      clientId: client.clientId,
      resource: params.audience,
      success: false,
      error: 'invalid_secret',
      requestId,
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  // ── 2. Audience check (must be in ADC client's allowedResources) ─────────
  if (params.audience !== REQUIRED_AUDIENCE) {
    // V0 only supports svc-workflow
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      success: false,
      error: 'invalid_resource',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  const audienceMatch = client.allowedResources.some(
    (r) => r === params.audience,
  );
  if (!audienceMatch) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      success: false,
      error: 'invalid_resource',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  // ── 3. Scope pre-check (requested scope must be subset of ADC allowed) ───
  const requestedParsed = parseScopeString(params.scope);
  const adcAllowedSet = new Set(client.allowedScopes);
  for (const s of requestedParsed) {
    if (!adcAllowedSet.has(s)) {
      auditLog({
        timestamp: new Date().toISOString(),
        type: 'obo.token.failed',
        principalId: client.machinePrincipalId,
        agentId: client.principal.agentId,
        clientId: client.clientId,
        resource: params.audience,
        scopes: params.scope,
        success: false,
        error: 'invalid_scope',
        requestId,
      });
      throw Object.assign(new Error('invalid_scope'), { statusCode: 400 });
    }
  }

  // ── 4. Subject Token Verification ────────────────────────────────────────
  let subjectPayload: Record<string, unknown>;
  try {
    subjectPayload = verifyWorkflowToken(params.subjectToken) as unknown as Record<string, unknown>;
  } catch (err: any) {
    const msg = err.message || '';
    let errorCategory = 'invalid_subject_token';
    if (msg.includes('not recognized') || msg.includes('missing kid')) {
      errorCategory = 'unknown_kid';
    } else if (msg.includes('algorithm') || msg.includes('Algorithm')) {
      errorCategory = 'algorithm_not_allowed';
    } else if (msg.includes('expired') || msg.includes('Expired')) {
      errorCategory = 'token_expired';
    }
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      scopes: params.scope,
      success: false,
      error: errorCategory,
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400, auditError: errorCategory });
  }

  // ── 5. Subject Token Profile Checks ──────────────────────────────────────
  const subjectSub = String(subjectPayload.sub ?? '');
  const subjectPrincipalType = String(subjectPayload.principal_type ?? '');
  const subjectTokenUse = String(subjectPayload.token_use ?? '');
  const subjectAud = String(subjectPayload.aud ?? '');
  const subjectScope = String(subjectPayload.scope ?? '');
  const subjectType = String(subjectPayload.type ?? '');
  const subjectAgentId = subjectPayload.agent_id ? String(subjectPayload.agent_id) : undefined;
  const subjectJti = String(subjectPayload.jti ?? '');
  const subjectIat = typeof subjectPayload.iat === 'number' ? subjectPayload.iat : 0;
  const subjectExp = typeof subjectPayload.exp === 'number' ? subjectPayload.exp : 0;

  // 5a. Must be a direct (non-OBO) access token
  if (subjectTokenUse !== SUBJECT_REQUIRED_TOKEN_USE) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'obo_chaining_rejected',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400, auditError: 'obo_chaining_rejected' });
  }

  // 5b. Must have principal_type=agent (V0: Agent OBO only)
  if (subjectPrincipalType !== SUBJECT_REQUIRED_PRINCIPAL_TYPE) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'unsupported_token_type',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400, auditError: 'unsupported_token_type' });
  }

  // 5c. Must have a valid sub
  if (!subjectSub) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectJti,
      success: false,
      error: 'invalid_subject_token',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  // 5d. Must be type=access
  if (subjectType !== 'access') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'unsupported_token_type',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  // 5e. Must NOT have an `act` claim (chaining block — double defense)
  if (subjectPayload.act) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'obo_chaining_rejected',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400, auditError: 'obo_chaining_rejected' });
  }

  // 5f. Subject token must have aud=svc-workflow (V0 restriction)
  if (subjectAud !== REQUIRED_AUDIENCE) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'invalid_subject_token',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  // ── 6. Subject Principal Existence + Status Check ────────────────────────
  const subjectPrincipal = await prisma.machinePrincipal.findUnique({
    where: { id: subjectSub },
  });

  if (!subjectPrincipal) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'subject_not_found',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  if (subjectPrincipal.status === 'disabled') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'subject_disabled',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  if (subjectPrincipal.principalType !== SUBJECT_REQUIRED_PRINCIPAL_TYPE) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      success: false,
      error: 'unsupported_token_type',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  // ── 7. Scope Intersection (3-way: subject ∩ ADC allowed ∩ requested) ────
  const subjectScopes = parseScopeString(subjectScope);
  const requestedScopes = requestedParsed.length > 0
    ? requestedParsed
    : subjectScopes; // If no scope requested, default to subject's scopes

  const subjectScopeSet = new Set(subjectScopes);
  const allowedSet = adcAllowedSet;

  const intersected = requestedScopes
    .filter((s) => subjectScopeSet.has(s) && allowedSet.has(s))
    .sort();

  if (intersected.length === 0) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      scopes: params.scope,
      success: false,
      error: 'invalid_scope',
      requestId,
    });
    throw Object.assign(new Error('invalid_scope'), { statusCode: 400 });
  }

  const finalScope = intersected.join(' ');

  // ── 8. Compute TTL ──────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.min(OBO_MAX_TTL, Math.max(0, subjectExp - now));

  if (ttl <= 0) {
    // Subject token is already expired or expires immediately
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'obo.token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.audience,
      subjectSub,
      subjectPrincipalType,
      subjectJti,
      scopes: params.scope,
      success: false,
      error: 'token_expired',
      requestId,
    });
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  // ── 9. Sign OBO Token ──────────────────────────────────────────────────
  // Build the OBO-specific claims. We reuse signWorkflowAccessToken for the
  // base RS256 signing, but assemble the OBO payload separately since the
  // claim set is different from the direct token.
  const oboJti = `${client.machinePrincipalId}-${now}-${crypto.randomBytes(8).toString('hex')}`;
  const oboIat = now;
  const oboNbf = now;
  const oboExp = now + ttl;

  const oboPayload: Record<string, unknown> = {
    iss: env.JWT_ISSUER,
    sub: subjectSub,
    aud: REQUIRED_AUDIENCE,
    principal_type: subjectPrincipalType,
    scope: finalScope,
    token_use: 'workflow_obo',
    type: 'access',
    version: env.JWT_VERSION,
    act: { sub: client.principal.id },
    azp: client.clientId,
    client_id: client.clientId,
    jti: oboJti,
    iat: oboIat,
    nbf: oboNbf,
    exp: oboExp,
  };

  // Add agent_id only if the subject has one
  if (subjectAgentId) {
    oboPayload.agent_id = subjectAgentId;
  }

  // Sign with RS256 using the active key
  const { active } = getWorkflowKeyring();
  const privateKeyPem = active.privateKey.export({ format: 'pem', type: 'pkcs8' });
  const token = jwt.sign(oboPayload, privateKeyPem, {
    algorithm: 'RS256',
    keyid: active.kid,
  });

  const kid = getActiveKid();

  // ── 10. Audit ────────────────────────────────────────────────────────────
  auditLog({
    timestamp: new Date().toISOString(),
    type: 'obo.token.issued',
    principalId: client.machinePrincipalId,
    agentId: client.principal.agentId,
    clientId: client.clientId,
    resource: params.audience,
    scopes: params.scope,
    jti: oboJti,
    success: true,
    algorithm: 'RS256',
    kid,
    requestId,
    subjectSub,
    subjectPrincipalType,
    subjectJti,
    azp: client.clientId,
    actSub: client.principal.id,
    issuedScopes: finalScope,
    issuedAt: new Date(oboIat * 1000).toISOString(),
    expiresAt: new Date(oboExp * 1000).toISOString(),
  });

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: ttl,
    scope: finalScope,
  };
}
