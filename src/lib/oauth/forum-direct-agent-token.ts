/**
 * FORUM_DIRECT_AGENT_V1 — the machine-token profile for Forum direct agents.
 *
 * Owner decision (T52, CROSS_REPO_SECURITY_IMPLEMENTATION_AUTHORIZED): legacy
 * /token-login is NOT the Forum direct-agent authentication contract. This
 * module mints the dedicated profile: RS256 signing with the active workflow
 * keyring (kid-carrying header, JWKS-verifiable), aud `svc-forum`, agent
 * claims, short-lived access token, and never a refresh token.
 *
 * The frozen profile contract lives at
 * docs/contracts/forum-direct-agent-token-profile.json and is mirrored
 * byte-for-byte in the agent-forum repository (both sides must change
 * together).
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { auditLog } from './audit.js';
import { getWorkflowKeyring } from './workflow-keyring.js';
import { getActiveKid } from './workflow-signer.js';

export const FORUM_DIRECT_AGENT_AUDIENCE = 'svc-forum';
export const FORUM_DIRECT_AGENT_TTL_SECONDS = 300;

export interface ForumDirectAgentProfile {
  profile: 'FORUM_DIRECT_AGENT_V1';
  status: 'frozen-by-owner-decision';
  owner_decision: string;
  consumer: string;
  signing_algorithm: 'RS256';
  verification: 'JWKS+kid (header kid must match a published JWKS entry)';
  issuer: string;
  audience: 'svc-forum';
  required_claims: Record<string, string>;
  access_token: string;
  refresh_token: 'none — the machine-agent profile never issues a refresh token';
  forbidden: string[];
  legacy_note: string;
}

/** The frozen profile, populated with this deployment's issuer authority. */
export function forumDirectAgentProfile(): ForumDirectAgentProfile {
  return {
    profile: 'FORUM_DIRECT_AGENT_V1',
    status: 'frozen-by-owner-decision',
    owner_decision:
      'OWNER_SEMANTIC_DECISIONS_AND_REPAIR_RELEASE_20260913_V1 (T52 CROSS_REPO_SECURITY_IMPLEMENTATION_AUTHORIZED)',
    consumer: 'mayf3/agent-forum svc-forum direct-agent authentication',
    signing_algorithm: 'RS256',
    verification: 'JWKS+kid (header kid must match a published JWKS entry)',
    issuer: env.JWT_ISSUER,
    audience: FORUM_DIRECT_AGENT_AUDIENCE,
    required_claims: {
      type: 'access',
      version: 'v1',
      principal_type: 'agent',
      sub: 'MachinePrincipal.id (UUID, global auth-service identity)',
      agent_id: 'canonical agent id (non-empty string)',
      client_id: 'canonical machine client id (non-empty string)',
      scope: 'explicit Forum scopes (space-separated)',
    },
    access_token: 'short-lived (RS256 signed, kid-carrying header)',
    refresh_token: 'none — the machine-agent profile never issues a refresh token',
    forbidden: [
      'HS256 direct-agent fallback',
      'unified-platform audience fallback',
      'human-token coercion into agent identity',
      'ADC fallback for this direct-agent path',
    ],
    legacy_note:
      'legacy /token-login remains for other compatible callers and MUST NOT serve this profile',
  };
}

export interface MintForumDirectAgentTokenParams {
  /** MachinePrincipal.id (UUID) — becomes the token `sub`. */
  machinePrincipalId: string;
  /** Canonical agent id. */
  agentId: string;
  /** Canonical machine client id. */
  machineClientId: string;
  /** Explicit Forum scopes (space-separated, e.g. "forum.read forum.write"). */
  scope: string;
  /** Short-lived by contract. Defaults to 300 seconds. */
  ttlSeconds?: number;
  now?: number;
}

export interface MintedForumDirectAgentToken {
  token: string;
  kid: string;
  expiresAt: number;
  issuedAt: number;
  /** Always false for this profile — no refresh token is ever issued. */
  refreshTokenIssued: false;
}

/**
 * Mint one FORUM_DIRECT_AGENT_V1 access token. RS256 + kid header, aud
 * `svc-forum`, agent claims, short-lived; no refresh token is produced.
 */
export function mintForumDirectAgentToken(
  params: MintForumDirectAgentTokenParams,
): MintedForumDirectAgentToken {
  if (!params.machinePrincipalId) throw new Error('machinePrincipalId is required');
  if (!params.agentId) throw new Error('agentId is required');
  if (!params.machineClientId) throw new Error('machineClientId is required');
  if (!params.scope) throw new Error('scope is required (explicit Forum scopes)');

  const now = params.now ?? Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds ?? FORUM_DIRECT_AGENT_TTL_SECONDS;
  const jti = `${params.machinePrincipalId}-${now}-${crypto.randomBytes(8).toString('hex')}`;

  const payload: Record<string, unknown> = {
    iss: env.JWT_ISSUER,
    sub: params.machinePrincipalId,
    aud: FORUM_DIRECT_AGENT_AUDIENCE,
    principal_type: 'agent',
    agent_id: params.agentId,
    client_id: params.machineClientId,
    scope: params.scope,
    token_use: 'forum_direct_agent',
    type: 'access',
    version: env.JWT_VERSION,
    jti,
    iat: now,
    nbf: now,
    exp: now + ttl,
  };

  const { active } = getWorkflowKeyring();
  const privateKeyPem = active.privateKey.export({ format: 'pem', type: 'pkcs8' });
  const token = jwt.sign(payload, privateKeyPem, {
    algorithm: 'RS256',
    keyid: active.kid,
  });
  const kid = getActiveKid();

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'forum.direct_agent_token.minted',
    principalId: params.machinePrincipalId,
    clientId: params.machineClientId,
    agentId: params.agentId,
    scope: params.scope,
    kid,
    success: true,
  });

  return { token, kid, expiresAt: now + ttl, issuedAt: now, refreshTokenIssued: false };
}
