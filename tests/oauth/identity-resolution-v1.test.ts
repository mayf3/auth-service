import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  IdentityResolutionError,
  type IdentityResolutionDatabase,
  parseExternalRefQuery,
  resolveClientByExternalRef,
  resolvePrincipalByExternalRef,
} from '../../src/lib/oauth/v1/resolution.js';

const principalRef = 'agentcore:v1:principal:agt_test-agent';
const clientRef = 'agentcore:v1:client:agt_test-agent';

function database(options: {
  principalRows?: unknown;
  clientRows?: unknown;
  principalError?: unknown;
  clientError?: unknown;
  calls?: { principal: number; client: number };
} = {}): IdentityResolutionDatabase {
  const calls = options.calls ?? { principal: 0, client: 0 };
  return {
    machinePrincipal: {
      async findMany() {
        calls.principal += 1;
        if (options.principalError !== undefined) throw options.principalError;
        return (Object.hasOwn(options, 'principalRows') ? options.principalRows : []) as never;
      },
    },
    machineClient: {
      async findMany() {
        calls.client += 1;
        if (options.clientError !== undefined) throw options.clientError;
        return (Object.hasOwn(options, 'clientRows') ? options.clientRows : []) as never;
      },
    },
  };
}

function expectResolutionError(
  code: string,
  status: number,
): (error: unknown) => boolean {
  return (error) => error instanceof IdentityResolutionError
    && error.code === code
    && error.status === status;
}

test('principal exact lookup returns PRESENT with the closed projection', async () => {
  let query: unknown;
  const db: IdentityResolutionDatabase = {
    ...database(),
    machinePrincipal: {
      async findMany(args) {
        query = args;
        return [{
          id: '10000000-0000-4000-8000-000000000001',
          principalType: 'agent',
          agentId: 'agt_test-agent',
          externalRef: principalRef,
        }];
      },
    },
  };

  const result = await resolvePrincipalByExternalRef(principalRef, db);
  assert.deepEqual(result, {
    state: 'PRESENT',
    principal: {
      id: '10000000-0000-4000-8000-000000000001',
      principal_type: 'agent',
      agent_id: 'agt_test-agent',
      external_ref: principalRef,
    },
  });
  assert.deepEqual(query, {
    where: { externalRef: principalRef },
    select: { id: true, principalType: true, agentId: true, externalRef: true },
    take: 2,
  });
});

test('principal successful zero match returns exact ABSENT', async () => {
  assert.deepEqual(
    await resolvePrincipalByExternalRef(principalRef, database()),
    { state: 'ABSENT' },
  );
});

test('client exact lookup returns PRESENT without secret, hash, token, password, or Grant fields', async () => {
  let query: unknown;
  const db: IdentityResolutionDatabase = {
    ...database(),
    machineClient: {
      async findMany(args) {
        query = args;
        return [{
          clientId: 'mc_public_client',
          machinePrincipalId: '10000000-0000-4000-8000-000000000001',
          externalRef: clientRef,
        }];
      },
    },
  };

  const result = await resolveClientByExternalRef(clientRef, db);
  assert.deepEqual(result, {
    state: 'PRESENT',
    client: {
      client_id: 'mc_public_client',
      principal_id: '10000000-0000-4000-8000-000000000001',
      external_ref: clientRef,
    },
  });
  assert.deepEqual(query, {
    where: { externalRef: clientRef },
    select: { clientId: true, machinePrincipalId: true, externalRef: true },
    take: 2,
  });
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ['secret', 'hash', 'token', 'password', 'grant', 'scope']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('client successful zero match returns exact ABSENT', async () => {
  assert.deepEqual(
    await resolveClientByExternalRef(clientRef, database()),
    { state: 'ABSENT' },
  );
});

test('duplicate exact matches fail loud instead of choosing the first row', async () => {
  const row = {
    id: '10000000-0000-4000-8000-000000000001',
    principalType: 'agent',
    agentId: 'agt_test-agent',
    externalRef: principalRef,
  };
  await assert.rejects(
    resolvePrincipalByExternalRef(principalRef, database({ principalRows: [row, row] })),
    expectResolutionError('IDENTITY_RESOLUTION_AMBIGUOUS', 409),
  );
});

test('database and generic query failures fail loud and never become ABSENT', async () => {
  for (const error of [new Error('database unavailable'), Object.assign(new Error('query rejected'), { code: 'P2000' })]) {
    await assert.rejects(
      resolvePrincipalByExternalRef(principalRef, database({ principalError: error })),
      expectResolutionError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
    );
    await assert.rejects(
      resolveClientByExternalRef(clientRef, database({ clientError: error })),
      expectResolutionError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
    );
  }
});

test('database timeout failures return the explicit timeout error', async () => {
  for (const error of [
    Object.assign(new Error('socket timed out'), { code: 'ETIMEDOUT' }),
    Object.assign(new Error('pool timeout'), { code: 'P2024' }),
  ]) {
    await assert.rejects(
      resolvePrincipalByExternalRef(principalRef, database({ principalError: error })),
      expectResolutionError('IDENTITY_RESOLUTION_TIMEOUT', 504),
    );
  }
});

test('malformed query results fail as internal query errors, not ABSENT', async () => {
  await assert.rejects(
    resolvePrincipalByExternalRef(principalRef, database({ principalRows: null })),
    expectResolutionError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
  );
  await assert.rejects(
    resolveClientByExternalRef(clientRef, database({
      clientRows: [{ clientId: 'mc_x', machinePrincipalId: 'p_x', externalRef: 'wrong' }],
    })),
    expectResolutionError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
  );
});

test('accepted Agent ID grammar is enforced before every DB query', async () => {
  const calls = { principal: 0, client: 0 };
  const db = database({ calls });
  const invalidIds = [
    '', ' ', '*', 'agt@bad', 'agt:bad', 'agt+bad', '中文',
    'agt.bad', 'agt/bad', 'agt\\bad', 'a'.repeat(201),
  ];

  for (const agentId of invalidIds) {
    await assert.rejects(
      resolvePrincipalByExternalRef(`agentcore:v1:principal:${agentId}`, db),
      expectResolutionError('INVALID_EXTERNAL_REF', 400),
    );
    await assert.rejects(
      resolveClientByExternalRef(`agentcore:v1:client:${agentId}`, db),
      expectResolutionError('INVALID_EXTERNAL_REF', 400),
    );
  }
  for (const malformed of [
    'agentcore:v1:principalx:agt_test',
    'agentcore:v1:client:agt_test',
    'agentcore:v1:principal:agt_test:extra',
  ]) {
    await assert.rejects(
      resolvePrincipalByExternalRef(malformed, db),
      expectResolutionError('INVALID_EXTERNAL_REF', 400),
    );
  }

  assert.deepEqual(calls, { principal: 0, client: 0 });
});

test('Agent ID grammar accepts exact 1 and 200 character boundaries', async () => {
  const calls = { principal: 0, client: 0 };
  const db = database({ calls });
  for (const agentId of ['A', 'a'.repeat(200)]) {
    assert.deepEqual(
      await resolvePrincipalByExternalRef(`agentcore:v1:principal:${agentId}`, db),
      { state: 'ABSENT' },
    );
  }
  assert.deepEqual(calls, { principal: 2, client: 0 });
});

test('query parser requires exactly one scalar external_ref parameter', () => {
  assert.equal(parseExternalRefQuery({ external_ref: principalRef }, 'principal'), principalRef);

  const invalidQueries: Array<Record<string, unknown>> = [
    {},
    { external_ref: [principalRef, principalRef] },
    { external_ref: principalRef, extra: 'x' },
    { external_ref: { nested: principalRef } },
    { other: principalRef },
  ];
  for (const query of invalidQueries) {
    assert.throws(
      () => parseExternalRefQuery(query, 'principal'),
      expectResolutionError('INVALID_QUERY_PARAMETERS', 400),
    );
  }
});

test('resolution source is query-only and routes reuse v1ManagementAuth', async () => {
  const resolutionSource = await readFile('src/lib/oauth/v1/resolution.ts', 'utf8');
  for (const forbiddenCall of ['.create(', '.update(', '.updateMany(', '.upsert(', '.delete(', '.$executeRaw']) {
    assert.equal(resolutionSource.includes(forbiddenCall), false, forbiddenCall);
  }
  assert.equal((resolutionSource.match(/\.findMany\(/g) ?? []).length, 4);

  const routeSource = await readFile('src/routes/idempotent.ts', 'utf8');
  for (const path of [
    "'/v1/principals/by-external-ref'",
    "'/v1/clients/by-external-ref'",
  ]) {
    const index = routeSource.indexOf(path);
    assert.ok(index >= 0, path);
    assert.ok(routeSource.slice(index, index + 180).includes('v1ManagementAuth'), path);
  }
  assert.equal(routeSource.includes("idempotentRouter.get(\n  '/v1/clients/:client_id'"), false);
});
