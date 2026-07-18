import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.js';
import {
  getWorkflowKeyring,
  isWorkflowKeyringConfigured,
} from '../workflow-keyring.js';
import {
  getV1AudienceDefinitions,
  getV1ContractSettings,
} from './contract.js';
import { assertCanonicalV1Scope } from './scope.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface SignV1DirectMachineTokenParams {
  principalId: string;
  principalType: 'agent' | 'service';
  agentId: string | null;
  clientId: string;
  audience: string;
  scope: string;
}

export interface V1DirectMachineTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  principal_type: 'agent' | 'service';
  client_id: string;
  token_use: 'access';
  type: 'access';
  version: string;
  scope: string;
  agent_id?: string;
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
}

function activePrivateKeyPem(): string | Buffer {
  return getWorkflowKeyring().active.privateKey.export({ format: 'pem', type: 'pkcs8' });
}

export function initializeV1TokenIssuer(): void {
  const settings = getV1ContractSettings();
  if (env.JWT_ISSUER !== settings.exactIssuer) {
    throw new Error(
      `Minimal Auth V1 requires JWT_ISSUER=${settings.exactIssuer}; got ${env.JWT_ISSUER}.`,
    );
  }
  if (!isWorkflowKeyringConfigured()) {
    throw new Error('Minimal Auth V1 requires an active RS256 signing key and kid.');
  }
  getWorkflowKeyring();
}

export function signV1DirectMachineToken(
  params: SignV1DirectMachineTokenParams,
): { token: string; claims: V1DirectMachineTokenClaims; kid: string } {
  const settings = getV1ContractSettings();
  const audience = getV1AudienceDefinitions().find(
    (candidate) => candidate.audienceId === params.audience,
  );
  if (!audience) throw new Error('V1 signer received an unregistered audience.');
  if (!audience.machineAccessEnabled
    || !audience.acceptedPrincipalTypes.includes(params.principalType)) {
    throw new Error('V1 signer received a principal profile not accepted by the audience.');
  }
  assertCanonicalV1Scope(params.scope, audience.scopeNamespace);
  if (params.principalType === 'agent' && !params.agentId) {
    throw new Error('V1 Agent token requires agent_id.');
  }
  if (params.principalType === 'service' && params.agentId !== null) {
    throw new Error('V1 Service token cannot contain agent_id.');
  }
  const now = Math.floor(Date.now() / 1000);
  const claims: V1DirectMachineTokenClaims = {
    iss: settings.exactIssuer,
    sub: params.principalId,
    aud: params.audience,
    principal_type: params.principalType,
    client_id: params.clientId,
    token_use: 'access',
    type: 'access',
    version: settings.tokenVersion,
    scope: params.scope,
    ...(params.agentId ? { agent_id: params.agentId } : {}),
    jti: randomUUID(),
    iat: now,
    nbf: now,
    exp: now + settings.machineAccessTtlSeconds,
  };
  const { active } = getWorkflowKeyring();
  const token = jwt.sign(claims, activePrivateKeyPem(), {
    algorithm: 'RS256',
    keyid: active.kid,
  });
  return { token, claims, kid: active.kid };
}

function peekHeader(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('V1 token is malformed.');
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw new Error('V1 token header is malformed.');
  }
}

export function verifyV1DirectMachineToken(
  token: string,
  expectedAudience: string,
  now = Math.floor(Date.now() / 1000),
): V1DirectMachineTokenClaims {
  const settings = getV1ContractSettings();
  const audience = getV1AudienceDefinitions().find(
    (candidate) => candidate.audienceId === expectedAudience,
  );
  if (!audience) throw new Error('V1 verifier received an unregistered audience.');
  const header = peekHeader(token);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('V1 token requires alg=RS256 and kid.');
  }
  const key = getWorkflowKeyring().verificationKeys.get(header.kid);
  if (!key) throw new Error('V1 token kid is not recognized.');
  const publicKey = key.publicKey.export({ format: 'pem', type: 'spki' });
  const claims = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: settings.exactIssuer,
    audience: expectedAudience,
    clockTimestamp: now,
    clockTolerance: settings.clockSkewToleranceSeconds,
  }) as unknown as V1DirectMachineTokenClaims;
  const allowed = new Set([
    'iss', 'sub', 'aud', 'principal_type', 'client_id', 'token_use', 'type',
    'version', 'scope', 'agent_id', 'jti', 'iat', 'nbf', 'exp',
  ]);
  if (Object.keys(claims).some((claim) => !allowed.has(claim))) {
    throw new Error('V1 Direct token contains a forbidden claim.');
  }
  if (!UUID_PATTERN.test(claims.sub) || typeof claims.aud !== 'string'
    || claims.aud !== expectedAudience || !['agent', 'service'].includes(claims.principal_type)
    || claims.token_use !== 'access' || claims.type !== 'access'
    || claims.version !== settings.tokenVersion || typeof claims.client_id !== 'string'
    || claims.client_id.length === 0 || typeof claims.jti !== 'string' || claims.jti.length < 16) {
    throw new Error('V1 Direct token has invalid common claims.');
  }
  if (claims.principal_type === 'agent' && !claims.agent_id) {
    throw new Error('V1 Agent token is missing agent_id.');
  }
  if (claims.principal_type === 'service' && 'agent_id' in claims) {
    throw new Error('V1 Service token cannot contain agent_id.');
  }
  if (![claims.iat, claims.nbf, claims.exp].every(Number.isInteger)
    || claims.nbf > claims.iat || claims.exp <= claims.iat
    || claims.exp - claims.iat > settings.machineAccessTtlSeconds
    || claims.iat > now + settings.clockSkewToleranceSeconds
    || claims.nbf > now + settings.clockSkewToleranceSeconds
    || claims.exp <= now - settings.clockSkewToleranceSeconds) {
    throw new Error('V1 Direct token has invalid time claims.');
  }
  assertCanonicalV1Scope(claims.scope, audience.scopeNamespace);
  return claims;
}
