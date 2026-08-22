import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CLIENT_RESOLUTION_SELECT,
  IdentityResolutionError,
  type IdentityResolutionReader,
  PRINCIPAL_RESOLUTION_SELECT,
  identityResolutionHttpError,
  requireSingleExternalRefQuery,
  resolveClientByExternalRef,
  resolvePrincipalByExternalRef,
  validateAgentCoreExternalRef,
} from '../../src/lib/oauth/v1/resolution.js';

const PRINCIPAL_REF = 'agentcore:v1:principal:agt_resolution_test';
const CLIENT_REF = 'agentcore:v1:client:agt_resolution_test';
const PRINCIPAL_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = 'mc_0123456789abcdefghijklmn';

function reader(overrides: Partial<IdentityResolutionReader> = {}): IdentityResolutionReader {
  return {
    findPrincipalMatches: async () => [],
    findClientMatches: async () => [],
    ...overrides,
  };
}

async function expectResolutionError(
  operation: () => Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof IdentityResolutionError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test('PRINCIPAL_PRESENT_ABSENT_TEST', async () => {
  const presentReader = reader({
    findPrincipalMatches: async (externalRef) => [{
      id: PRINCIPAL_ID,
      principalType: 'agent',
      agentId: 'agt_resolution_test',
      externalRef,
    }],
  });
  assert.deepEqual(
    await resolvePrincipalByExternalRef(PRINCIPAL_REF, { reader: presentReader }),
    {
      state: 'PRESENT',
      principal: {
        id: PRINCIPAL_ID,
        principal_type: 'agent',
        agent_id: 'agt_resolution_test',
        external_ref: PRINCIPAL_REF,
      },
    },
  );
  assert.deepEqual(
    await resolvePrincipalByExternalRef(PRINCIPAL_REF, { reader: reader() }),
    { state: 'ABSENT' },
  );
});

test('CLIENT_PRESENT_ABSENT_TEST', async () => {
  const presentReader = reader({
    findClientMatches: async (externalRef) => [{
      clientId: CLIENT_ID,
      machinePrincipalId: PRINCIPAL_ID,
      externalRef,
    }],
  });
  assert.deepEqual(
    await resolveClientByExternalRef(CLIENT_REF, { reader: presentReader }),
    {
      state: 'PRESENT',
      client: {
        client_id: CLIENT_ID,
        principal_id: PRINCIPAL_ID,
        external_ref: CLIENT_REF,
      },
    },
  );
  assert.deepEqual(
    await resolveClientByExternalRef(CLIENT_REF, { reader: reader() }),
    { state: 'ABSENT' },
  );
});

test('AMBIGUOUS_RESULT_FAILS_LOUD', async () => {
  const duplicatePrincipalReader = reader({
    findPrincipalMatches: async (externalRef) => [
      { id: PRINCIPAL_ID, principalType: 'agent', agentId: 'agt_resolution_test', externalRef },
      { id: '22222222-2222-4222-8222-222222222222', principalType: 'agent', agentId: 'agt_other', externalRef },
    ],
  });
  await expectResolutionError(
    () => resolvePrincipalByExternalRef(PRINCIPAL_REF, { reader: duplicatePrincipalReader }),
    409,
    'IDENTITY_RESOLUTION_AMBIGUOUS',
  );

  const duplicateClientReader = reader({
    findClientMatches: async (externalRef) => [
      { clientId: CLIENT_ID, machinePrincipalId: PRINCIPAL_ID, externalRef },
      { clientId: 'mc_abcdefghijklmnopqrstuvwx', machinePrincipalId: PRINCIPAL_ID, externalRef },
    ],
  });
  await expectResolutionError(
    () => resolveClientByExternalRef(CLIENT_REF, { reader: duplicateClientReader }),
    409,
    'IDENTITY_RESOLUTION_AMBIGUOUS',
  );
});

test('QUERY_ERROR_FAIL_LOUD_TEST', async () => {
  const queryFailureReader = reader({
    findPrincipalMatches: async () => { throw new Error('synthetic database failure'); },
    findClientMatches: async () => { throw new Error('synthetic database failure'); },
  });
  await expectResolutionError(
    () => resolvePrincipalByExternalRef(PRINCIPAL_REF, { reader: queryFailureReader }),
    500,
    'IDENTITY_RESOLUTION_QUERY_FAILED',
  );
  await expectResolutionError(
    () => resolveClientByExternalRef(CLIENT_REF, { reader: queryFailureReader }),
    500,
    'IDENTITY_RESOLUTION_QUERY_FAILED',
  );

  const neverReader = reader({
    findPrincipalMatches: () => new Promise<never>(() => {}),
    findClientMatches: () => new Promise<never>(() => {}),
  });
  await expectResolutionError(
    () => resolvePrincipalByExternalRef(PRINCIPAL_REF, { reader: neverReader, timeoutMs: 5 }),
    504,
    'IDENTITY_RESOLUTION_TIMEOUT',
  );
  await expectResolutionError(
    () => resolveClientByExternalRef(CLIENT_REF, { reader: neverReader, timeoutMs: 5 }),
    504,
    'IDENTITY_RESOLUTION_TIMEOUT',
  );

  const inconsistentReader = reader({
    findPrincipalMatches: async () => [{
      id: PRINCIPAL_ID,
      principalType: 'agent',
      agentId: 'agt_resolution_test',
      externalRef: 'agentcore:v1:principal:wrong',
    }],
  });
  await expectResolutionError(
    () => resolvePrincipalByExternalRef(PRINCIPAL_REF, { reader: inconsistentReader }),
    500,
    'IDENTITY_RESOLUTION_QUERY_FAILED',
  );
  assert.deepEqual(
    identityResolutionHttpError(new Error('internal resolver failure')),
    { status: 500, body: { error: 'IDENTITY_RESOLUTION_QUERY_FAILED' } },
  );
});

test('INVALID_AGENT_ID_PRE_QUERY_TEST', async () => {
  let principalQueries = 0;
  let clientQueries = 0;
  const countingReader = reader({
    findPrincipalMatches: async () => { principalQueries += 1; return []; },
    findClientMatches: async () => { clientQueries += 1; return []; },
  });
  const invalidAgentIds = [
    '', ' ', '*', 'agt@bad', 'agt:bad', 'agt+bad', '中文', 'agt.bad', 'agt/bad', 'a'.repeat(201),
  ];
  for (const agentId of invalidAgentIds) {
    await expectResolutionError(
      () => resolvePrincipalByExternalRef(`agentcore:v1:principal:${agentId}`, { reader: countingReader }),
      400,
      'INVALID_EXTERNAL_REF',
    );
    await expectResolutionError(
      () => resolveClientByExternalRef(`agentcore:v1:client:${agentId}`, { reader: countingReader }),
      400,
      'INVALID_EXTERNAL_REF',
    );
  }
  await expectResolutionError(
    () => resolvePrincipalByExternalRef(CLIENT_REF, { reader: countingReader }),
    400,
    'INVALID_EXTERNAL_REF',
  );
  await expectResolutionError(
    () => resolveClientByExternalRef(PRINCIPAL_REF, { reader: countingReader }),
    400,
    'INVALID_EXTERNAL_REF',
  );
  assert.equal(principalQueries, 0);
  assert.equal(clientQueries, 0);
  assert.equal(validateAgentCoreExternalRef('agentcore:v1:principal:a', 'principal'), 'a');
  assert.equal(
    validateAgentCoreExternalRef(`agentcore:v1:client:${'a'.repeat(200)}`, 'client').length,
    200,
  );
});

test('EXACTLY_ONE_QUERY_PARAMETER_TEST', () => {
  assert.equal(requireSingleExternalRefQuery({ external_ref: PRINCIPAL_REF }), PRINCIPAL_REF);
  const invalidQueries: Array<Record<string, unknown>> = [
    {},
    { other: PRINCIPAL_REF },
    { external_ref: [PRINCIPAL_REF, PRINCIPAL_REF] },
    { external_ref: PRINCIPAL_REF, extra: '1' },
    { external_ref: 123 },
    { external_ref: { nested: PRINCIPAL_REF } },
  ];
  for (const query of invalidQueries) {
    assert.throws(
      () => requireSingleExternalRefQuery(query),
      (error: unknown) => error instanceof IdentityResolutionError
        && error.status === 400
        && error.code === 'INVALID_QUERY_PARAMETERS',
    );
  }
});

test('SECRET_PROJECTION_TEST', async () => {
  assert.deepEqual(Object.keys(PRINCIPAL_RESOLUTION_SELECT).sort(), [
    'agentId', 'externalRef', 'id', 'principalType',
  ]);
  assert.deepEqual(Object.keys(CLIENT_RESOLUTION_SELECT).sort(), [
    'clientId', 'externalRef', 'machinePrincipalId',
  ]);
  const forbidden = [
    'secretHash', 'secret', 'token', 'password', 'allowedResources', 'allowedScopes',
    'accessGrants', 'rotatedAt', 'revokedAt',
  ];
  for (const key of forbidden) {
    assert.equal(key in PRINCIPAL_RESOLUTION_SELECT, false);
    assert.equal(key in CLIENT_RESOLUTION_SELECT, false);
  }
  const result = await resolveClientByExternalRef(CLIENT_REF, {
    reader: reader({
      findClientMatches: async (externalRef) => [{
        clientId: CLIENT_ID,
        machinePrincipalId: PRINCIPAL_ID,
        externalRef,
      }],
    }),
  });
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('grant'), false);
});

test('MUTATION_ZERO_TEST', async () => {
  let reads = 0;
  const readOnlyReader = reader({
    findPrincipalMatches: async () => { reads += 1; return []; },
    findClientMatches: async () => { reads += 1; return []; },
  });
  await resolvePrincipalByExternalRef(PRINCIPAL_REF, { reader: readOnlyReader });
  await resolveClientByExternalRef(CLIENT_REF, { reader: readOnlyReader });
  assert.equal(reads, 2);
  assert.deepEqual(Object.keys(readOnlyReader).sort(), ['findClientMatches', 'findPrincipalMatches']);

  const source = await readFile(new URL('../../src/lib/oauth/v1/resolution.ts', import.meta.url), 'utf8');
  for (const forbidden of [
    '.create(', '.update(', '.upsert(', '.delete(', '$executeRaw', '$queryRawUnsafe',
    'createOrGetPrincipal', 'createOrGetClient', 'rotate', 'grantChangeAudit',
  ]) {
    assert.equal(source.includes(forbidden), false, `resolution source must not contain ${forbidden}`);
  }
});

test('ROUTE_SURFACE_AND_AUTH_BOUNDARY_TEST', async () => {
  const source = await readFile(new URL('../../src/routes/idempotent.ts', import.meta.url), 'utf8');
  for (const path of ['/v1/principals/by-external-ref', '/v1/clients/by-external-ref']) {
    const escaped = path.replaceAll('/', '\\/');
    const routePattern = new RegExp(`idempotentRouter\\.get\\(\\s*['\"]${escaped}['\"],\\s*v1ManagementAuth,`, 'm');
    assert.match(source, routePattern);
  }
  assert.equal((source.match(/idempotentRouter\.get\(/g) ?? []).length, 2);
  assert.equal((source.match(/idempotentRouter\.post\(/g) ?? []).length, 2);
  assert.match(source, /idempotentRouter\.post\(\s*['"]\/v1\/principals['"]/m);
  assert.match(source, /idempotentRouter\.post\(\s*['"]\/v1\/clients['"]/m);
  assert.equal(source.includes("'/v1/clients/:client_id'"), false);
});
