import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { auditLog } from './audit.js';
import { getWorkflowKeyring } from './workflow-keyring.js';
import { getActiveKid } from './workflow-signer.js';
import type { TokenExchangeResult } from './token-exchange.js';

interface LegacyProxyClient {
  machinePrincipalId: string;
  clientId: string;
  principal: {
    id: string;
    agentId: string | null;
  };
}

interface SignLegacyOboParams {
  client: LegacyProxyClient;
  audience: string;
  requestedScope: string;
  finalScope: string;
  requestId: string;
  subjectSub: string;
  subjectPrincipalType: string;
  subjectAgentId?: string;
  subjectJti: string;
  now: number;
  ttl: number;
}

export function signLegacyOboToken(params: SignLegacyOboParams): TokenExchangeResult {
  const oboJti = `${params.client.machinePrincipalId}-${params.now}-${crypto.randomBytes(8).toString('hex')}`;
  const oboExp = params.now + params.ttl;
  const oboPayload: Record<string, unknown> = {
    iss: env.JWT_ISSUER,
    sub: params.subjectSub,
    aud: 'svc-workflow',
    principal_type: params.subjectPrincipalType,
    scope: params.finalScope,
    token_use: 'workflow_obo',
    type: 'access',
    version: env.JWT_VERSION,
    act: { sub: params.client.principal.id },
    azp: params.client.clientId,
    client_id: params.client.clientId,
    jti: oboJti,
    iat: params.now,
    nbf: params.now,
    exp: oboExp,
    ...(params.subjectAgentId ? { agent_id: params.subjectAgentId } : {}),
  };
  const { active } = getWorkflowKeyring();
  const privateKeyPem = active.privateKey.export({ format: 'pem', type: 'pkcs8' });
  const token = jwt.sign(oboPayload, privateKeyPem, {
    algorithm: 'RS256',
    keyid: active.kid,
  });
  const kid = getActiveKid();

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'obo.token.issued',
    principalId: params.client.machinePrincipalId,
    agentId: params.client.principal.agentId,
    clientId: params.client.clientId,
    resource: params.audience,
    scopes: params.requestedScope,
    jti: oboJti,
    success: true,
    algorithm: 'RS256',
    kid,
    requestId: params.requestId,
    subjectSub: params.subjectSub,
    subjectPrincipalType: params.subjectPrincipalType,
    subjectJti: params.subjectJti,
    azp: params.client.clientId,
    actSub: params.client.principal.id,
    issuedScopes: params.finalScope,
    issuedAt: new Date(params.now * 1000).toISOString(),
    expiresAt: new Date(oboExp * 1000).toISOString(),
  });
  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: params.ttl,
    scope: params.finalScope,
  };
}
