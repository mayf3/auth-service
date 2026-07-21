import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { hashClientSecret } from '../../src/lib/oauth/secret.js';
import { getV1AudienceDefinitions } from '../../src/lib/oauth/v1/contract.js';
import {
  authorizeV1TokenExchange,
  exchangeV1Token,
  persistV1EarlyExchangeRejection,
  type V1ExchangeDatabase,
} from '../../src/lib/oauth/v1/exchange.js';
import {
  signV1DelegatedToken,
  signV1DirectMachineToken,
  verifyV1DelegatedToken,
} from '../../src/lib/oauth/v1/signer.js';
import {
  clearKeyringEnv,
  configureKeyringEnv,
  generateTestKeyPair,
} from './_workflow-test-keys.js';
import crypto from 'node:crypto';
import { resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';

const originalEnv = { ...process.env };
const secret = 'test-secret-' + crypto.randomUUID().slice(0,8);
const originalPrincipalId = '20000000-0000-4000-8000-000000000001';
const proxyPrincipalId = '40000000-0000-4000-8000-000000000001';
const originalClientId = 'agent-client-adc';
const proxyClientId = 'adc-v2-proxy-client';

beforeEach(() => {
  const key = generateTestKeyPair('v1-exchange-test-key');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  resetWorkflowKeyringForTests();
});

afterEach(() => {
  clearKeyringEnv();
  resetWorkflowKeyringForTests();
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

function storedAudience(audienceId: string) {
  const audience = getV1AudienceDefinitions().find((item) => item.audienceId === audienceId)!;
  return {
    audienceId: audience.audienceId,
    resourceService: audience.resourceService,
    scopeNamespace: audience.scopeNamespace,
    acceptedPrincipalTypes: [...audience.acceptedPrincipalTypes],
    registeredScopes: [...audience.registeredScopes],
    humanAccessEnabled: audience.humanAccessEnabled,
    machineAccessEnabled: audience.machineAccessEnabled,
    delegatedAccessEnabled: audience.delegatedAccessEnabled,
    status: audience.status,
    freezeReady: audience.freezeReady,
    version: 1,
  };
}

function sourceToken(audience = 'adc-v2'): string {
  return signV1DirectMachineToken({
    principalId: originalPrincipalId,
    principalType: 'agent',
    agentId: 'agent-reviewer',
    clientId: originalClientId,
    audience,
    scope: audience === 'adc-v2' ? 'adc.read' : 'workflow.read',
  }).token;
}

function fixtureDatabase(options: {
  originalScopes?: string[];
  delegationScopes?: string[];
  acceptedAudiences?: string[];
  auditFails?: boolean;
} = {}) {
  const target = storedAudience('svc-workflow');
  const source = storedAudience('adc-v2');
  const original = {
    id: '30000000-0000-4000-8000-000000000001',
    clientId: originalClientId,
    machinePrincipalId: originalPrincipalId,
    secretHash: hashClientSecret('original-secret'),
    status: 'active' as const,
    principal: {
      id: originalPrincipalId,
      principalType: 'agent' as const,
      agentId: 'agent-reviewer',
      ownerUserId: '10000000-0000-4000-8000-000000000001',
      status: 'active' as const,
    },
    accessGrants: [{
      audienceId: target.audienceId,
      scopes: options.originalScopes ?? ['workflow.execute', 'workflow.read'],
      version: 1,
      audience: target,
    }],
    trustedProxy: null,
  };
  const proxy = {
    id: '50000000-0000-4000-8000-000000000001',
    clientId: proxyClientId,
    machinePrincipalId: proxyPrincipalId,
    secretHash: hashClientSecret(secret),
    status: 'active' as const,
    principal: {
      id: proxyPrincipalId,
      principalType: 'service' as const,
      agentId: null,
      ownerUserId: null,
      status: 'active' as const,
    },
    accessGrants: [],
    trustedProxy: {
      id: '60000000-0000-4000-8000-000000000001',
      proxyPrincipalId,
      proxyClientId: '50000000-0000-4000-8000-000000000001',
      status: 'active' as const,
      version: 1,
      acceptedAudiences: (options.acceptedAudiences ?? ['adc-v2']).map((audienceId) => ({
        audienceId,
        audience: audienceId === 'adc-v2' ? source : target,
      })),
      delegationGrants: [{
        audienceId: target.audienceId,
        scopes: options.delegationScopes ?? ['workflow.execute', 'workflow.read'],
        version: 1,
        audience: target,
      }],
    },
  };
  const audits: Array<Record<string, unknown>> = [];
  const database: V1ExchangeDatabase = {
    machineClient: {
      findUnique: async (args: any) => args.where.clientId === proxyClientId
        ? proxy as never
        : args.where.clientId === originalClientId ? original as never : null,
    },
    tokenExchangeAudit: {
      create: async ({ data }) => {
        if (options.auditFails) throw new Error('audit unavailable');
        audits.push(data as unknown as Record<string, unknown>);
        return data;
      },
    },
  };
  return { database, audits, original, proxy };
}

const request = () => ({
  clientId: proxyClientId,
  clientSecret: secret,
  subjectToken: sourceToken(),
  subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
  requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
  audience: 'svc-workflow',
  scope: 'workflow.read workflow.execute',
  requestId: 'v1-exchange-test-request',
});

test('V1 Exchange binds source, Proxy, grants, and exact canonical scope', async () => {
  const { database } = fixtureDatabase();
  const result = await authorizeV1TokenExchange(request(), database);
  assert.equal(result.originalPrincipalId, originalPrincipalId);
  assert.equal(result.originalClientId, originalClientId);
  assert.equal(result.proxyPrincipalId, proxyPrincipalId);
  assert.equal(result.proxyClientId, proxyClientId);
  assert.equal(result.sourceAudience, 'adc-v2');
  assert.equal(result.targetAudience, 'svc-workflow');
  assert.equal(result.scope, 'workflow.execute workflow.read');
});

test('V1 Exchange rejects unaccepted source and either partial grant without downscope', async () => {
  await assert.rejects(
    authorizeV1TokenExchange(request(), fixtureDatabase({ acceptedAudiences: ['svc-workflow'] }).database),
    (error: any) => error.message === 'invalid_grant'
      && error.category === 'source_audience_not_accepted',
  );
  for (const options of [
    { originalScopes: ['workflow.read'] },
    { delegationScopes: ['workflow.read'] },
  ]) {
    await assert.rejects(
      authorizeV1TokenExchange(request(), fixtureDatabase(options).database),
      (error: any) => error.message === 'invalid_scope'
        && error.category === 'exchange_requested_scope_not_granted',
    );
  }
});

test('V1 Exchange rejects an OBO source token and a non-Proxy Client', async () => {
  const db = fixtureDatabase();
  const delegated = signV1DelegatedToken({
    originalPrincipalId,
    originalAgentId: 'agent-reviewer',
    proxyPrincipalId,
    proxyClientId,
    audience: 'svc-workflow',
    scope: 'workflow.read',
    sourceExp: Math.floor(Date.now() / 1000) + 600,
  }).token;
  await assert.rejects(
    authorizeV1TokenExchange({ ...request(), subjectToken: delegated }, db.database),
    (error: any) => error.message === 'invalid_grant' && error.category === 'source_token_invalid',
  );
  db.proxy.trustedProxy = null as never;
  await assert.rejects(
    authorizeV1TokenExchange(request(), db.database),
    (error: any) => error.message === 'invalid_client',
  );
});

test('V1 Exchange persists complete success and safe rejected audit records', async () => {
  const success = fixtureDatabase();
  const issued = await exchangeV1Token(request(), success.database);
  const claims = verifyV1DelegatedToken(issued.access_token, 'svc-workflow');
  assert.equal(claims.sub, originalPrincipalId);
  assert.equal(claims.act.sub, proxyPrincipalId);
  assert.equal(success.audits.length, 1);
  assert.equal(success.audits[0].result, 'success');
  assert.equal(typeof success.audits[0].sourceTokenJti, 'string');
  assert.ok((success.audits[0].sourceTokenJti as string).length >= 16);
  assert.equal(success.audits[0].delegatedTokenJti, claims.jti);
  assert.deepEqual(success.audits[0].grantedScopes, ['workflow.execute', 'workflow.read']);

  const rejected = fixtureDatabase({ delegationScopes: ['workflow.read'] });
  await assert.rejects(exchangeV1Token(request(), rejected.database), /invalid_scope/);
  assert.equal(rejected.audits.length, 1);
  assert.deepEqual(Object.keys(rejected.audits[0]).sort(), [
    'exchangeId', 'proxyClientId', 'proxyPrincipalId', 'rejectionCategory', 'requestedScopes',
    'requestCorrelationId', 'result', 'sourceAudience', 'sourceTokenJti', 'targetAudience',
  ].sort());
  assert.equal(rejected.audits[0].result, 'rejected');
});

test('V1 Exchange returns no token when persistent audit cannot be written', async () => {
  await assert.rejects(
    exchangeV1Token(request(), fixtureDatabase({ auditFails: true }).database),
    (error: any) => error.message === 'server_error'
      && error.category === 'exchange_audit_persistence_failed',
  );
});

test('V1 Exchange persists safe route-level rejection facts and fails closed', async () => {
  const fixture = fixtureDatabase();
  await persistV1EarlyExchangeRejection({
    requestId: 'route-rejection-request',
    audience: 'svc-workflow',
    scope: 'workflow.read',
    category: 'arbitrary_subject_parameter',
  }, fixture.database);
  assert.deepEqual(fixture.audits[0], {
    exchangeId: fixture.audits[0].exchangeId,
    result: 'rejected',
    proxyPrincipalId: null,
    proxyClientId: null,
    sourceTokenJti: null,
    sourceAudience: null,
    targetAudience: 'svc-workflow',
    requestedScopes: ['workflow.read'],
    rejectionCategory: 'arbitrary_subject_parameter',
    requestCorrelationId: 'route-rejection-request',
  });
  await assert.rejects(
    persistV1EarlyExchangeRejection({
      requestId: 'route-audit-failure',
      audience: 'svc-workflow',
      scope: 'workflow.read',
      category: 'invalid_request',
    }, fixtureDatabase({ auditFails: true }).database),
    (error: any) => error.message === 'server_error'
      && error.category === 'exchange_audit_persistence_failed',
  );
});
