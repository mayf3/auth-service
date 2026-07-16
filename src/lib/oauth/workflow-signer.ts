/**
 * Workflow RS256 signer + verifier.
 *
 * Signs direct MachinePrincipal workflow tokens (aud=svc-workflow) with RS256
 * and a fixed `kid` header, and verifies them with hard algorithm-confusion
 * defenses.
 *
 * Frozen claims: plan §7.5 (DIRECT_AGENT_TOKEN_CONTRACT).
 *   iss, sub(=MachinePrincipal.id), aud=svc-workflow, principal_type=agent,
 *   scope, token_use=access, type=access, version=v1, agent_id, client_id,
 *   jti, iat, nbf, exp.
 *
 * Security (plan §12.2, task spec §九): RS256 ONLY. No alg from header/params,
 * no `alg=none`, no HS/RS confusion, no RSA-public-as-HMAC-secret, no fallback
 * on unknown kid, no random key selection, previous keys never sign.
 */

import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { getWorkflowKeyring } from './workflow-keyring.js';

/** Workflow token TTL (seconds). Default 600, hard cap 900 (plan §7.8). */
export const DEFAULT_WORKFLOW_TTL = 600;
export const MAX_WORKFLOW_TTL = 900;

/** Algorithms permitted on verification — RS256 only. */
const ALLOWED_ALGORITHMS: jwt.Algorithm[] = ['RS256'];

export interface SignWorkflowTokenParams {
  /** MachinePrincipal.id — becomes `sub`. */
  principalId: string;
  /** Canonical OpenClaw agent id. */
  agentId: string;
  /** OAuth client identifier (MachineClient.clientId). */
  clientId: string;
  /** Normalized, sorted, space-delimited scope string. */
  scope: string;
  /** Optional TTL override (seconds, capped at MAX_WORKFLOW_TTL). */
  ttl?: number;
  /** Optional jti override (auto-generated if omitted). */
  jti?: string;
}

export interface WorkflowTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  principal_type: 'agent';
  scope: string;
  token_use: 'access';
  type: 'access';
  version: string;
  agent_id: string;
  client_id: string;
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
}

/**
 * Sign a workflow Access Token with RS256 and the active key's kid.
 */
export function signWorkflowAccessToken(params: SignWorkflowTokenParams): string {
  const { active } = getWorkflowKeyring();
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.min(params.ttl ?? DEFAULT_WORKFLOW_TTL, MAX_WORKFLOW_TTL);
  const jti = params.jti || `${params.principalId}-${now}-${randomHex(8)}`;

  const payload: WorkflowTokenPayload = {
    iss: env.JWT_ISSUER,
    sub: params.principalId,
    aud: 'svc-workflow',
    principal_type: 'agent',
    scope: params.scope,
    token_use: 'access',
    type: 'access',
    version: env.JWT_VERSION,
    agent_id: params.agentId,
    client_id: params.clientId,
    jti,
    iat: now,
    nbf: now,
    exp: now + ttl,
  };

  // PEM form for jsonwebtoken (which accepts a KeyObject only on newer types).
  const privateKeyPem = active.privateKey.export({ format: 'pem', type: 'pkcs8' });

  return jwt.sign(payload, privateKeyPem, {
    algorithm: 'RS256',
    keyid: active.kid,
  });
}

/**
 * Verify a workflow token with algorithm-confusion defenses:
 *   - algorithms: ['RS256'] only (rejects alg=none, HS256, etc.)
 *   - kid from header MUST map to a known verification key; unknown kid ⇒ throw
 *   - issuer + audience enforced
 *
 * @returns the verified payload on success.
 * @throws jwt.VerifyError / Error on any failure.
 */
export function verifyWorkflowToken(token: string): WorkflowTokenPayload {
  // First peek at the header to resolve the kid BEFORE trusting any algorithm.
  const header = peekHeader(token);
  if (!header || typeof header.kid !== 'string') {
    throw new Error('Workflow token missing kid header');
  }
  const { verificationKeys } = getWorkflowKeyring();
  const key = verificationKeys.get(header.kid);
  if (!key) {
    // Unknown kid — never fall back to another key.
    throw new Error(`Workflow token kid "${header.kid}" is not recognized`);
  }
  const publicKeyPem = key.publicKey.export({ format: 'pem', type: 'spki' });

  const payload = jwt.verify(token, publicKeyPem, {
    algorithms: ALLOWED_ALGORITHMS,
    issuer: env.JWT_ISSUER,
    audience: 'svc-workflow',
  }) as WorkflowTokenPayload;

  return payload;
}

/** kid of the currently active key (for audit logging / header checks). */
export function getActiveKid(): string {
  return getWorkflowKeyring().active.kid;
}

// ─── internals ────────────────────────────────────────────────────────────

function peekHeader(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

function randomHex(bytes: number): string {
  return cryptoRandomBytes(bytes).toString('hex');
}

// Use node:crypto randomBytes (cryptographic) instead of Math.random.
import { randomBytes as cryptoRandomBytes } from 'node:crypto';
