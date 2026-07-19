import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../lib/prisma.js';
import { verifyClientSecret } from '../secret.js';
import { auditLog } from '../audit.js';
import { getV1AudienceDefinitions } from './contract.js';
import { V1OAuthError } from './errors.js';
import {
  findV1AudienceMismatch,
  type StoredAudienceDefinition,
} from './grant-migration.js';
import { canonicalV1Scope } from './scope.js';
import {
  signV1DelegatedToken,
  verifyV1DirectMachineToken,
  type V1DirectMachineTokenClaims,
} from './signer.js';

const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';

interface ExchangePrincipal {
  id: string;
  principalType: 'agent' | 'service';
  agentId: string | null;
  ownerUserId: string | null;
  status: 'active' | 'disabled';
}

interface ExchangeGrant {
  audienceId: string;
  scopes: string[];
  version: number;
  audience: StoredAudienceDefinition;
}

interface ExchangeTrustedProxy {
  id: string;
  proxyPrincipalId: string;
  proxyClientId: string;
  status: 'active' | 'revoked';
  version: number;
  acceptedAudiences: Array<{ audienceId: string; audience: StoredAudienceDefinition }>;
  delegationGrants: ExchangeGrant[];
}

interface ExchangeClient {
  id: string;
  clientId: string;
  machinePrincipalId: string;
  secretHash: string;
  status: 'active' | 'revoked';
  principal: ExchangePrincipal;
  accessGrants: ExchangeGrant[];
  trustedProxy: ExchangeTrustedProxy | null;
}

interface ExchangeAuditData {
  exchangeId?: string;
  result: 'success' | 'rejected';
  originalPrincipalId?: string | null;
  originalClientId?: string | null;
  proxyPrincipalId?: string | null;
  proxyClientId?: string | null;
  sourceTokenJti?: string | null;
  delegatedTokenJti?: string | null;
  sourceAudience?: string | null;
  targetAudience?: string | null;
  requestedScopes?: string[] | null;
  grantedScopes?: string[] | null;
  rejectionCategory?: string | null;
  requestCorrelationId: string;
}

export interface V1ExchangeDatabase {
  machineClient: {
    findUnique(args: object): Promise<ExchangeClient | null>;
  };
  tokenExchangeAudit: {
    create(args: { data: ExchangeAuditData }): Promise<unknown>;
  };
}

export interface V1TokenExchangeParams {
  clientId: string;
  clientSecret: string;
  subjectToken: string;
  subjectTokenType: string;
  requestedTokenType: string;
  audience: string;
  scope: string;
  requestId?: string;
}

export interface V1AuthorizedExchange {
  originalPrincipalId: string;
  originalAgentId: string;
  originalClientId: string;
  proxyPrincipalId: string;
  proxyClientId: string;
  sourceTokenJti: string;
  sourceAudience: string;
  sourceExp: number;
  targetAudience: string;
  scope: string;
  scopes: readonly string[];
}

export interface V1TokenExchangeResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export interface V1EarlyExchangeRejection {
  requestId: string;
  audience: string;
  scope: string;
  category: string;
}

interface MutableAuditContext {
  exchangeId: string;
  requestId: string;
  originalPrincipalId: string | null;
  originalClientId: string | null;
  proxyPrincipalId: string | null;
  proxyClientId: string | null;
  sourceTokenJti: string | null;
  sourceAudience: string | null;
  targetAudience: string | null;
  requestedScopes: string[] | null;
}

function lookupArgs(clientId: string, audienceId: string): object {
  return {
    where: { clientId },
    include: {
      principal: true,
      accessGrants: {
        where: { audienceId },
        include: { audience: true },
      },
      trustedProxy: {
        include: {
          acceptedAudiences: { include: { audience: true } },
          delegationGrants: {
            where: { audienceId },
            include: { audience: true },
          },
        },
      },
    },
  };
}

function invalidGrant(category: string): never {
  throw new V1OAuthError('invalid_grant', category);
}

function assertGrantState(
  grant: ExchangeGrant,
  registeredScopes: readonly string[],
  category: string,
): void {
  if (grant.version < 1 || grant.scopes.length === 0
    || new Set(grant.scopes).size !== grant.scopes.length
    || grant.scopes.some((scope) => !registeredScopes.includes(scope))) {
    throw new V1OAuthError('temporarily_unavailable', category);
  }
}

function unverifiedAudience(token: string): string {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string' || typeof decoded.aud !== 'string') {
    invalidGrant('source_audience_invalid');
  }
  return decoded.aud;
}

export async function authorizeV1TokenExchange(
  params: V1TokenExchangeParams,
  database: V1ExchangeDatabase = prisma as unknown as V1ExchangeDatabase,
  auditContext?: MutableAuditContext,
): Promise<V1AuthorizedExchange> {
  if (params.subjectTokenType !== ACCESS_TOKEN_TYPE
    || params.requestedTokenType !== ACCESS_TOKEN_TYPE) {
    throw new V1OAuthError('unsupported_token_type');
  }
  const registry = getV1AudienceDefinitions();
  const target = registry.find((audience) => audience.audienceId === params.audience);
  if (!target?.delegatedAccessEnabled || !target.acceptedPrincipalTypes.includes('agent')) {
    throw new V1OAuthError('invalid_target', 'delegated_target_invalid');
  }
  if (auditContext) auditContext.targetAudience = target.audienceId;
  const canonicalScope = canonicalV1Scope(params.scope, target.scopeNamespace);
  const requestedScopes = canonicalScope.split(' ');
  if (auditContext) auditContext.requestedScopes = requestedScopes;

  const proxyClient = await database.machineClient.findUnique(
    lookupArgs(params.clientId, target.audienceId),
  );
  if (!proxyClient || proxyClient.status !== 'active'
    || proxyClient.principal.status !== 'active'
    || !verifyClientSecret(params.clientSecret, proxyClient.secretHash)) {
    throw new V1OAuthError('invalid_client', 'proxy_credential_or_status_invalid');
  }
  const trustedProxy = proxyClient.trustedProxy;
  if (proxyClient.principal.principalType !== 'service'
    || proxyClient.principal.agentId !== null || !trustedProxy
    || trustedProxy.status !== 'active' || trustedProxy.version < 1
    || trustedProxy.proxyClientId !== proxyClient.id
    || trustedProxy.proxyPrincipalId !== proxyClient.principal.id
    || proxyClient.machinePrincipalId !== proxyClient.principal.id) {
    throw new V1OAuthError('invalid_client', 'trusted_proxy_profile_invalid');
  }
  if (auditContext) {
    auditContext.proxyPrincipalId = proxyClient.principal.id;
    auditContext.proxyClientId = proxyClient.clientId;
  }

  const sourceAudience = unverifiedAudience(params.subjectToken);
  let sourceClaims: V1DirectMachineTokenClaims;
  try {
    sourceClaims = verifyV1DirectMachineToken(params.subjectToken, sourceAudience);
  } catch {
    invalidGrant('source_token_invalid');
  }
  if (sourceClaims.principal_type !== 'agent' || !sourceClaims.agent_id) {
    invalidGrant('source_profile_invalid');
  }
  if (auditContext) {
    auditContext.sourceTokenJti = sourceClaims.jti;
    auditContext.sourceAudience = sourceClaims.aud;
  }
  const accepted = trustedProxy.acceptedAudiences.find(
    (item) => item.audienceId === sourceClaims.aud,
  );
  const runtimeSource = registry.find((item) => item.audienceId === sourceClaims.aud);
  if (!accepted || !runtimeSource) invalidGrant('source_audience_not_accepted');
  const sourceMismatch = findV1AudienceMismatch(runtimeSource, accepted.audience);
  if (sourceMismatch) {
    throw new V1OAuthError(
      'temporarily_unavailable',
      `source_audience_registry_mismatch:${sourceMismatch}`,
    );
  }

  const originalClient = await database.machineClient.findUnique(
    lookupArgs(sourceClaims.client_id, target.audienceId),
  );
  if (!originalClient || originalClient.status !== 'active'
    || originalClient.principal.status !== 'active'
    || originalClient.machinePrincipalId !== sourceClaims.sub
    || originalClient.principal.id !== sourceClaims.sub
    || originalClient.principal.principalType !== 'agent'
    || !originalClient.principal.ownerUserId
    || originalClient.principal.agentId !== sourceClaims.agent_id) {
    invalidGrant('original_client_or_principal_invalid');
  }
  if (auditContext) {
    auditContext.originalPrincipalId = originalClient.principal.id;
    auditContext.originalClientId = originalClient.clientId;
  }
  const originalGrant = originalClient.accessGrants[0];
  const delegationGrant = trustedProxy.delegationGrants[0];
  if (!originalGrant || !delegationGrant) {
    throw new V1OAuthError('invalid_scope', 'exchange_grant_missing');
  }
  const originalAudienceMismatch = findV1AudienceMismatch(target, originalGrant.audience);
  const delegationAudienceMismatch = findV1AudienceMismatch(target, delegationGrant.audience);
  if (originalAudienceMismatch || delegationAudienceMismatch) {
    throw new V1OAuthError('temporarily_unavailable', 'target_audience_registry_mismatch');
  }
  assertGrantState(originalGrant, target.registeredScopes, 'original_grant_state_invalid');
  assertGrantState(delegationGrant, target.registeredScopes, 'delegation_grant_state_invalid');
  const originalScopes = new Set(originalGrant.scopes);
  const proxyScopes = new Set(delegationGrant.scopes);
  if (requestedScopes.some((scope) => !originalScopes.has(scope) || !proxyScopes.has(scope))) {
    throw new V1OAuthError('invalid_scope', 'exchange_requested_scope_not_granted');
  }
  return {
    originalPrincipalId: originalClient.principal.id,
    originalAgentId: sourceClaims.agent_id,
    originalClientId: originalClient.clientId,
    proxyPrincipalId: proxyClient.principal.id,
    proxyClientId: proxyClient.clientId,
    sourceTokenJti: sourceClaims.jti,
    sourceAudience: sourceClaims.aud,
    sourceExp: sourceClaims.exp,
    targetAudience: target.audienceId,
    scope: canonicalScope,
    scopes: requestedScopes,
  };
}

async function persistRejected(
  database: V1ExchangeDatabase,
  context: MutableAuditContext,
  category: string,
): Promise<void> {
  await database.tokenExchangeAudit.create({
    data: {
      exchangeId: context.exchangeId,
      result: 'rejected',
      proxyPrincipalId: context.proxyPrincipalId,
      proxyClientId: context.proxyClientId,
      sourceTokenJti: context.sourceTokenJti,
      sourceAudience: context.sourceAudience,
      targetAudience: context.targetAudience,
      requestedScopes: context.requestedScopes,
      rejectionCategory: category,
      requestCorrelationId: context.requestId,
    },
  });
}

export async function persistV1EarlyExchangeRejection(
  rejection: V1EarlyExchangeRejection,
  database: V1ExchangeDatabase = prisma as unknown as V1ExchangeDatabase,
): Promise<void> {
  const target = getV1AudienceDefinitions().find(
    (audience) => audience.audienceId === rejection.audience,
  );
  let requestedScopes: string[] | null = null;
  if (target) {
    try {
      requestedScopes = canonicalV1Scope(rejection.scope, target.scopeNamespace).split(' ');
    } catch {
      requestedScopes = null;
    }
  }
  if (!rejection.category || rejection.category.length > 128) {
    throw new V1OAuthError('server_error', 'early_rejection_category_invalid');
  }
  try {
    await database.tokenExchangeAudit.create({
      data: {
        exchangeId: randomUUID(),
        result: 'rejected',
        proxyPrincipalId: null,
        proxyClientId: null,
        sourceTokenJti: null,
        sourceAudience: null,
        targetAudience: target?.audienceId ?? null,
        requestedScopes,
        rejectionCategory: rejection.category,
        requestCorrelationId: rejection.requestId,
      },
    });
  } catch {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'v1.obo.failed',
      resource: target?.audienceId,
      success: false,
      error: 'exchange_audit_persistence_failed',
      requestId: rejection.requestId,
    });
    throw new V1OAuthError('server_error', 'exchange_audit_persistence_failed');
  }
}

export async function exchangeV1Token(
  params: V1TokenExchangeParams,
  database: V1ExchangeDatabase = prisma as unknown as V1ExchangeDatabase,
): Promise<V1TokenExchangeResult> {
  const context: MutableAuditContext = {
    exchangeId: randomUUID(),
    requestId: params.requestId ?? randomUUID(),
    originalPrincipalId: null,
    originalClientId: null,
    proxyPrincipalId: null,
    proxyClientId: null,
    sourceTokenJti: null,
    sourceAudience: null,
    targetAudience: null,
    requestedScopes: null,
  };
  try {
    const authorized = await authorizeV1TokenExchange(params, database, context);
    const signed = signV1DelegatedToken({
      originalPrincipalId: authorized.originalPrincipalId,
      originalAgentId: authorized.originalAgentId,
      proxyPrincipalId: authorized.proxyPrincipalId,
      proxyClientId: authorized.proxyClientId,
      audience: authorized.targetAudience,
      scope: authorized.scope,
      sourceExp: authorized.sourceExp,
    });
    await database.tokenExchangeAudit.create({
      data: {
        exchangeId: context.exchangeId,
        result: 'success',
        originalPrincipalId: authorized.originalPrincipalId,
        originalClientId: authorized.originalClientId,
        proxyPrincipalId: authorized.proxyPrincipalId,
        proxyClientId: authorized.proxyClientId,
        sourceTokenJti: authorized.sourceTokenJti,
        delegatedTokenJti: signed.claims.jti,
        sourceAudience: authorized.sourceAudience,
        targetAudience: authorized.targetAudience,
        requestedScopes: [...authorized.scopes],
        grantedScopes: [...authorized.scopes],
        requestCorrelationId: context.requestId,
      },
    });
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'v1.obo.issued',
      principalId: authorized.originalPrincipalId,
      clientId: authorized.proxyClientId,
      resource: authorized.targetAudience,
      scopes: authorized.scope,
      jti: signed.claims.jti,
      success: true,
      algorithm: 'RS256',
      kid: signed.kid,
      requestId: context.requestId,
      subjectSub: authorized.originalPrincipalId,
      subjectJti: authorized.sourceTokenJti,
      azp: authorized.proxyClientId,
      actSub: authorized.proxyPrincipalId,
    });
    return {
      access_token: signed.token,
      token_type: 'Bearer',
      expires_in: signed.claims.exp - signed.claims.iat,
      scope: signed.claims.scope,
    };
  } catch (error) {
    const failure = error instanceof V1OAuthError
      ? error
      : new V1OAuthError('server_error', 'v1_exchange_internal_error');
    try {
      await persistRejected(database, context, failure.category);
    } catch {
      auditLog({
        timestamp: new Date().toISOString(),
        type: 'v1.obo.failed',
        clientId: params.clientId,
        resource: params.audience,
        success: false,
        error: 'exchange_audit_persistence_failed',
        requestId: context.requestId,
      });
      throw new V1OAuthError('server_error', 'exchange_audit_persistence_failed');
    }
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'v1.obo.failed',
      clientId: params.clientId,
      resource: params.audience,
      success: false,
      error: failure.category,
      requestId: context.requestId,
      subjectJti: context.sourceTokenJti ?? undefined,
    });
    throw failure;
  }
}
