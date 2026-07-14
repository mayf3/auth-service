/**
 * Agent Access Token signing and verification.
 *
 * Produces JWT claims that are explicitly different from human user tokens:
 *   - sub → MachinePrincipal UUID (not User UUID)
 *   - principal_type → "agent" (not omitted)
 *   - agent_id → canonical OpenClaw alias (not in human tokens)
 *   - client_id → OAuth client identifier
 *   - No role / internalRole / okrRole / name claims
 *
 * Uses the same HS256 signing key (JWT_SECRET) as human tokens.
 * Services differentiate by checking the `principal_type` claim.
 */

import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

/** Maximum allowed TTL for agent tokens (15 min in seconds). */
const MAX_AGENT_TOKEN_TTL = 900;

/** Default TTL for agent tokens (10 min in seconds). */
const DEFAULT_AGENT_TOKEN_TTL = 600;

export interface AgentTokenPayload {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  type: 'access';
  version: string;
  principal_type: 'agent';
  agent_id: string;
  client_id: string;
  scope: string;
}

export interface SignAgentTokenParams {
  /** MachinePrincipal UUID — becomes `sub` */
  principalId: string;
  /** Canonical OpenClaw agent ID */
  agentId: string;
  /** OAuth client identifier string */
  clientId: string;
  /** Requested resource/service audience */
  audience: string;
  /** Normalized, sorted, space-delimited scope string */
  scope: string;
  /** Optional TTL override (seconds, capped at MAX_AGENT_TOKEN_TTL) */
  ttl?: number;
  /** Optional jti override (auto-generated if omitted) */
  jti?: string;
}

/**
 * Sign a new Agent Access Token.
 */
export function signAgentAccessToken(params: SignAgentTokenParams): string {
  const now = Math.floor(Date.now() / 1000);
  const jti = params.jti || `${params.principalId}-${now}-${randomHex(6)}`;
  const ttl = Math.min(params.ttl ?? DEFAULT_AGENT_TOKEN_TTL, MAX_AGENT_TOKEN_TTL);

  return jwt.sign(
    {
      sub: params.principalId,
      iss: env.JWT_ISSUER,
      aud: params.audience,
      iat: now,
      exp: now + ttl,
      jti,
      type: 'access',
      version: env.JWT_VERSION,
      principal_type: 'agent',
      agent_id: params.agentId,
      client_id: params.clientId,
      scope: params.scope,
    } satisfies AgentTokenPayload,
    env.JWT_SECRET,
    { algorithm: 'HS256' },
  );
}

/**
 * Generate a random hex string for jti uniqueness.
 */
function randomHex(bytes: number): string {
  const buf = Buffer.allocUnsafe(bytes);
  for (let i = 0; i < bytes; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf.toString('hex');
}
