import { prisma } from '../../../lib/prisma.js';
import { verifyClientSecret } from '../secret.js';
import { auditLog } from '../audit.js';
import { getV1AudienceDefinitions } from './contract.js';
import {
  findV1AudienceMismatch,
  type StoredAudienceDefinition,
} from './grant-migration.js';
import { V1OAuthError } from './errors.js';
import { canonicalV1Scope } from './scope.js';
import { signV1DirectMachineToken } from './signer.js';

interface DirectPrincipal {
  id: string;
  principalType: 'agent' | 'service';
  agentId: string | null;
  ownerUserId: string | null;
  status: 'active' | 'disabled';
}

interface DirectGrant {
  audienceId: string;
  scopes: string[];
  version: number;
  audience: StoredAudienceDefinition;
}

interface DirectClient {
  id: string;
  clientId: string;
  machinePrincipalId: string;
  secretHash: string;
  status: 'active' | 'revoked';
  principal: DirectPrincipal;
  accessGrants: DirectGrant[];
}

export interface V1DirectDatabase {
  machineClient: {
    findUnique(args: object): Promise<DirectClient | null>;
  };
}

export interface V1DirectTokenParams {
  clientId: string;
  clientSecret: string;
  resource: string;
  scope: string;
}

export interface V1DirectAuthorization {
  principalId: string;
  principalType: 'agent' | 'service';
  agentId: string | null;
  clientId: string;
  audience: string;
  scope: string;
}

export interface V1DirectTokenResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  jti: string;
}

function invalidClient(category: string): never {
  throw new V1OAuthError('invalid_client', category);
}

function assertPrincipalProfile(principal: DirectPrincipal): void {
  if (principal.principalType === 'agent' && !principal.agentId) {
    invalidClient('agent_profile_invalid');
  }
  if (principal.principalType === 'service' && principal.agentId !== null) {
    invalidClient('service_profile_invalid');
  }
}

export async function authorizeV1DirectToken(
  params: V1DirectTokenParams,
  database: V1DirectDatabase = prisma as unknown as V1DirectDatabase,
): Promise<V1DirectAuthorization> {
  const runtimeAudience = getV1AudienceDefinitions().find(
    (audience) => audience.audienceId === params.resource,
  );
  if (!runtimeAudience || !runtimeAudience.machineAccessEnabled) {
    throw new V1OAuthError('invalid_target', 'audience_not_machine_enabled');
  }
  const client = await database.machineClient.findUnique({
    where: { clientId: params.clientId },
    include: {
      principal: true,
      accessGrants: {
        where: { audienceId: params.resource },
        include: { audience: true },
      },
    },
  });
  if (!client || client.status !== 'active' || client.principal.status !== 'active') {
    invalidClient('client_or_principal_inactive');
  }
  assertPrincipalProfile(client.principal);
  if (!verifyClientSecret(params.clientSecret, client.secretHash)) {
    invalidClient('credential_invalid');
  }
  if (!runtimeAudience.acceptedPrincipalTypes.includes(client.principal.principalType)) {
    throw new V1OAuthError('invalid_target', 'audience_profile_not_accepted');
  }
  const grant = client.accessGrants[0];
  if (!grant) throw new V1OAuthError('invalid_scope', 'machine_grant_missing');
  const mismatch = findV1AudienceMismatch(runtimeAudience, grant.audience);
  if (mismatch) {
    throw new V1OAuthError('temporarily_unavailable', `audience_registry_mismatch:${mismatch}`);
  }
  if (grant.version < 1 || grant.scopes.length === 0
    || new Set(grant.scopes).size !== grant.scopes.length
    || grant.scopes.some((scope) => !runtimeAudience.registeredScopes.includes(scope))) {
    throw new V1OAuthError('temporarily_unavailable', 'machine_grant_state_invalid');
  }
  const requestedScopes = canonicalV1Scope(params.scope, runtimeAudience.scopeNamespace);
  const granted = new Set(grant.scopes);
  if (requestedScopes.split(' ').some((scope) => !granted.has(scope))) {
    throw new V1OAuthError('invalid_scope', 'requested_scope_not_granted');
  }
  return {
    principalId: client.principal.id,
    principalType: client.principal.principalType,
    agentId: client.principal.agentId,
    clientId: client.clientId,
    audience: runtimeAudience.audienceId,
    scope: requestedScopes,
  };
}

export async function issueV1DirectToken(
  params: V1DirectTokenParams,
  database: V1DirectDatabase = prisma as unknown as V1DirectDatabase,
): Promise<V1DirectTokenResult> {
  try {
    const authorized = await authorizeV1DirectToken(params, database);
    const signed = signV1DirectMachineToken(authorized);
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'v1.direct.issued',
      principalId: authorized.principalId,
      agentId: authorized.agentId,
      clientId: authorized.clientId,
      resource: authorized.audience,
      scopes: authorized.scope,
      jti: signed.claims.jti,
      algorithm: 'RS256',
      kid: signed.kid,
      success: true,
    });
    return {
      access_token: signed.token,
      token_type: 'Bearer',
      expires_in: signed.claims.exp - signed.claims.iat,
      scope: signed.claims.scope,
      jti: signed.claims.jti,
    };
  } catch (error) {
    const failure = error instanceof V1OAuthError
      ? error
      : new V1OAuthError('server_error', 'v1_direct_internal_error');
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'v1.direct.failed',
      clientId: params.clientId,
      resource: params.resource,
      success: false,
      error: failure.category,
    });
    throw failure;
  }
}
