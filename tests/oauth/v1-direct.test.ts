import assert from 'node:assert/strict';
import test from 'node:test';
import { hashClientSecret } from '../../src/lib/oauth/secret.js';
import {
  authorizeV1DirectToken,
  type V1DirectDatabase,
} from '../../src/lib/oauth/v1/direct.js';
import { getV1AudienceDefinitions } from '../../src/lib/oauth/v1/contract.js';

const secret = 'unit-test-client-secret';

function database(overrides: Record<string, unknown> = {}): V1DirectDatabase {
  const audience = getV1AudienceDefinitions().find((item) => item.audienceId === 'svc-workflow')!;
  const client = {
    id: '30000000-0000-4000-8000-000000000001',
    clientId: 'v1-direct-test-client',
    machinePrincipalId: '20000000-0000-4000-8000-000000000001',
    secretHash: hashClientSecret(secret),
    status: 'active' as const,
    principal: {
      id: '20000000-0000-4000-8000-000000000001',
      principalType: 'agent' as const,
      agentId: 'v1-direct-agent',
      ownerUserId: '10000000-0000-4000-8000-000000000001',
      status: 'active' as const,
    },
    accessGrants: [{
      audienceId: audience.audienceId,
      scopes: ['workflow.execute', 'workflow.read'],
      version: 1,
      audience: {
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
      },
    }],
    ...overrides,
  };
  return { machineClient: { findUnique: async () => client as never } };
}

const request = {
  clientId: 'v1-direct-test-client',
  clientSecret: secret,
  resource: 'svc-workflow',
  scope: 'workflow.read workflow.execute',
};

test('V1 Direct authorization binds Principal, Client, Audience, and exact requested scopes', async () => {
  const result = await authorizeV1DirectToken(request, database());
  assert.deepEqual(result, {
    principalId: '20000000-0000-4000-8000-000000000001',
    principalType: 'agent',
    agentId: 'v1-direct-agent',
    clientId: 'v1-direct-test-client',
    audience: 'svc-workflow',
    scope: 'workflow.execute workflow.read',
  });
});

test('V1 Direct rejects missing grants and partial authorization without downscope', async () => {
  await assert.rejects(
    authorizeV1DirectToken(request, database({ accessGrants: [] })),
    (error: any) => error.message === 'invalid_scope' && error.statusCode === 400,
  );
  const db = database();
  const original = await db.machineClient.findUnique({});
  original!.accessGrants[0].scopes = ['workflow.read'];
  await assert.rejects(
    authorizeV1DirectToken(request, { machineClient: { findUnique: async () => original } }),
    (error: any) => error.message === 'invalid_scope' && error.category === 'requested_scope_not_granted',
  );
});

test('V1 Direct returns the same external error for missing Client and bad secret', async () => {
  const missing: V1DirectDatabase = { machineClient: { findUnique: async () => null } };
  for (const promise of [
    authorizeV1DirectToken(request, missing),
    authorizeV1DirectToken({ ...request, clientSecret: 'wrong' }, database()),
  ]) {
    await assert.rejects(
      promise,
      (error: any) => error.message === 'invalid_client' && error.statusCode === 401,
    );
  }
});

test('V1 Direct rejects Service profile on the first-wave Agent-only audience', async () => {
  const base = database();
  const client = await base.machineClient.findUnique({});
  client!.principal = {
    ...client!.principal,
    principalType: 'service',
    agentId: null,
    ownerUserId: null,
  };
  await assert.rejects(
    authorizeV1DirectToken(request, { machineClient: { findUnique: async () => client } }),
    (error: any) => error.message === 'invalid_target'
      && error.category === 'audience_profile_not_accepted',
  );
});

test('V1 Direct fails unavailable when database Audience differs from frozen registry', async () => {
  const base = database();
  const client = await base.machineClient.findUnique({});
  client!.accessGrants[0].audience.scopeNamespace = 'wrong';
  await assert.rejects(
    authorizeV1DirectToken(request, { machineClient: { findUnique: async () => client } }),
    (error: any) => error.message === 'temporarily_unavailable' && error.statusCode === 503,
  );
});
