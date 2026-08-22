import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  IdentityResolutionError,
  type IdentityResolutionDatabase,
  parseExternalRefQuery,
  resolveClientByExternalRef,
  resolvePrincipalByExternalRef,
} from '../../src/lib/oauth/v1/resolution.js';
import type { createIdentityResolutionRouter as createIdentityResolutionRouterType } from '../../src/routes/idempotent.js';
import { clearKeyringEnv, configureKeyringEnv, generateTestKeyPair } from './_workflow-test-keys.js';

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

type RouteDependencies = NonNullable<Parameters<typeof createIdentityResolutionRouterType>[0]>;

async function withRouteServer(
  dependencies: RouteDependencies | undefined,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  process.env.JWT_SECRET ??= 'identity-resolution-route-test-secret';
  const { createIdentityResolutionRouter } = await import('../../src/routes/idempotent.js');
  const app = express();
  app.use('/api', dependencies
    ? createIdentityResolutionRouter(dependencies)
    : createIdentityResolutionRouter());
  app.use((error: { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.status ?? 500).json({ error: 'UNAUTHORIZED' });
  });
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const testManagementAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.header('authorization') !== 'Bearer test-management-token') {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  next();
};

async function jsonRequest(
  baseUrl: string,
  path: string,
  query: string,
  authenticated = true,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}?${query}`, {
    headers: authenticated ? { authorization: 'Bearer test-management-token' } : {},
  });
  return { status: response.status, body: await response.json() };
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
  for (const error of [
    new Error('database unavailable'),
    new Error('internal timeout metadata parse failed'),
    Object.assign(new Error('query rejected'), { code: 'P2000' }),
  ]) {
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

test('Express routes enforce auth, exact query shape, grammar, and PRESENT/ABSENT envelopes', async () => {
  const calls = { principal: 0, client: 0 };
  const dependencies: RouteDependencies = {
    managementAuth: testManagementAuth,
    async resolvePrincipal(externalRef) {
      calls.principal += 1;
      if (externalRef.endsWith(':missing')) return { state: 'ABSENT' };
      return {
        state: 'PRESENT',
        principal: { id: 'p1', principal_type: 'agent', agent_id: 'agt_ok', external_ref: externalRef },
      };
    },
    async resolveClient(externalRef) {
      calls.client += 1;
      if (externalRef.endsWith(':missing')) return { state: 'ABSENT' };
      return {
        state: 'PRESENT',
        client: { client_id: 'mc_public', principal_id: 'p1', external_ref: externalRef },
      };
    },
  };

  await withRouteServer(dependencies, async (baseUrl) => {
    const unauthenticated = await jsonRequest(
      baseUrl,
      '/api/v1/principals/by-external-ref',
      `external_ref=${encodeURIComponent(principalRef)}`,
      false,
    );
    assert.deepEqual(unauthenticated, { status: 401, body: { error: 'UNAUTHORIZED' } });
    assert.deepEqual(calls, { principal: 0, client: 0 });

    for (const [path, ref, expected] of [
      ['/api/v1/principals/by-external-ref', principalRef, {
        state: 'PRESENT',
        principal: { id: 'p1', principal_type: 'agent', agent_id: 'agt_ok', external_ref: principalRef },
      }],
      ['/api/v1/principals/by-external-ref', 'agentcore:v1:principal:missing', { state: 'ABSENT' }],
      ['/api/v1/clients/by-external-ref', clientRef, {
        state: 'PRESENT',
        client: { client_id: 'mc_public', principal_id: 'p1', external_ref: clientRef },
      }],
      ['/api/v1/clients/by-external-ref', 'agentcore:v1:client:missing', { state: 'ABSENT' }],
    ] as const) {
      const response = await jsonRequest(baseUrl, path, `external_ref=${encodeURIComponent(ref)}`);
      assert.deepEqual(response, { status: 200, body: expected });
    }

    const beforeRejected = { ...calls };
    for (const query of [
      `external_ref=${encodeURIComponent('agentcore:v1:principal:agt@bad')}`,
      `external_ref=${encodeURIComponent('agentcore:v1:principal:agt:bad')}`,
      `external_ref=${encodeURIComponent('agentcore:v1:principal:agt+bad')}`,
      `external_ref=${encodeURIComponent('agentcore:v1:principal:中文')}`,
    ]) {
      assert.deepEqual(
        await jsonRequest(baseUrl, '/api/v1/principals/by-external-ref', query),
        { status: 400, body: { error: 'INVALID_EXTERNAL_REF' } },
      );
    }
    for (const query of [
      '',
      `external_ref=${encodeURIComponent(principalRef)}&external_ref=${encodeURIComponent(principalRef)}`,
      `external_ref=${encodeURIComponent(principalRef)}&extra=x`,
    ]) {
      assert.deepEqual(
        await jsonRequest(baseUrl, '/api/v1/principals/by-external-ref', query),
        { status: 400, body: { error: 'INVALID_QUERY_PARAMETERS' } },
      );
    }
    assert.deepEqual(calls, beforeRejected, 'all rejected requests fail before resolver/DB');
  });
});

test('production router executes actual v1ManagementAuth before the read-only resolver', async () => {
  process.env.JWT_SECRET ??= 'identity-resolution-route-test-secret';
  const key = generateTestKeyPair('identity-resolution-management-key');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  const [{ resetWorkflowKeyringForTests }, { signV1DirectMachineToken }, { prisma }] = await Promise.all([
    import('../../src/lib/oauth/workflow-keyring.js'),
    import('../../src/lib/oauth/v1/signer.js'),
    import('../../src/lib/prisma.js'),
  ]);
  resetWorkflowKeyringForTests();

  const principalDelegate = prisma.machinePrincipal as any;
  const clientDelegate = prisma.machineClient as any;
  const originals = {
    principalFindUnique: principalDelegate.findUnique,
    principalFindMany: principalDelegate.findMany,
    clientFindUnique: clientDelegate.findUnique,
  };
  const reads = { authPrincipal: 0, authClient: 0, resolution: 0 };
  const identityState = {
    principal: { id: '10000000-0000-4000-8000-000000000001', status: 'active' },
    client: {
      clientId: 'management-test-client',
      machinePrincipalId: '10000000-0000-4000-8000-000000000001',
      status: 'active',
    },
  };
  const stateBefore = structuredClone(identityState);
  principalDelegate.findUnique = async () => {
    reads.authPrincipal += 1;
    return identityState.principal;
  };
  clientDelegate.findUnique = async () => {
    reads.authClient += 1;
    return identityState.client;
  };
  principalDelegate.findMany = async () => {
    reads.resolution += 1;
    return [];
  };

  try {
    const { token } = signV1DirectMachineToken({
      principalId: '10000000-0000-4000-8000-000000000001',
      principalType: 'service',
      agentId: null,
      clientId: 'management-test-client',
      audience: 'svc-auth',
      scope: 'auth.identity.provision',
    });
    await withRouteServer(undefined, async (baseUrl) => {
      const url = `${baseUrl}/api/v1/principals/by-external-ref?external_ref=${encodeURIComponent(principalRef)}`;
      const unauthenticated = await fetch(url);
      assert.equal(unauthenticated.status, 401);
      assert.deepEqual(await unauthenticated.json(), { error: 'UNAUTHORIZED' });
      assert.deepEqual(reads, { authPrincipal: 0, authClient: 0, resolution: 0 });
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { state: 'ABSENT' });
      assert.deepEqual(reads, { authPrincipal: 1, authClient: 1, resolution: 1 });
      assert.deepEqual(identityState, stateBefore, 'authenticated resolution performs zero mutation');
    });
  } finally {
    principalDelegate.findUnique = originals.principalFindUnique;
    principalDelegate.findMany = originals.principalFindMany;
    clientDelegate.findUnique = originals.clientFindUnique;
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
  }
});

test('Express routes map ambiguity, timeout, query, and internal failures explicitly for both kinds', async () => {
  const failure = (externalRef: string): never => {
    if (externalRef.endsWith('_ambiguous')) {
      throw new IdentityResolutionError(409, 'IDENTITY_RESOLUTION_AMBIGUOUS');
    }
    if (externalRef.endsWith('_timeout')) {
      throw Object.assign(new Error('database wait expired'), { code: 'P2024' });
    }
    if (externalRef.endsWith('_internal')) throw new Error('internal timeout metadata parse failed');
    throw new Error('database query failed');
  };
  const dependencies: RouteDependencies = {
    managementAuth: testManagementAuth,
    resolvePrincipal: async (externalRef) => failure(externalRef),
    resolveClient: async (externalRef) => failure(externalRef),
  };

  await withRouteServer(dependencies, async (baseUrl) => {
    for (const [suffix, status, error] of [
      ['ambiguous', 409, 'IDENTITY_RESOLUTION_AMBIGUOUS'],
      ['timeout', 504, 'IDENTITY_RESOLUTION_TIMEOUT'],
      ['query', 500, 'IDENTITY_RESOLUTION_QUERY_FAILED'],
      ['internal', 500, 'IDENTITY_RESOLUTION_QUERY_FAILED'],
    ] as const) {
      for (const kind of ['principal', 'client'] as const) {
        const pathKind = kind === 'principal' ? 'principals' : 'clients';
        const ref = `agentcore:v1:${kind}:agt_${suffix}`;
        assert.deepEqual(
          await jsonRequest(baseUrl, `/api/v1/${pathKind}/by-external-ref`, `external_ref=${encodeURIComponent(ref)}`),
          { status, body: { error } },
        );
      }
    }
  });
});

test('resolution source is query-only and production routes reuse v1ManagementAuth', async () => {
  const resolutionSource = await readFile('src/lib/oauth/v1/resolution.ts', 'utf8');
  for (const forbiddenCall of ['.create(', '.update(', '.updateMany(', '.upsert(', '.delete(', '.$executeRaw']) {
    assert.equal(resolutionSource.includes(forbiddenCall), false, forbiddenCall);
  }
  assert.equal((resolutionSource.match(/\.findMany\(/g) ?? []).length, 4);

  const routeSource = await readFile('src/routes/idempotent.ts', 'utf8');
  assert.ok(routeSource.includes('managementAuth: v1ManagementAuth'));
  for (const path of ["'/v1/principals/by-external-ref'", "'/v1/clients/by-external-ref'"]) {
    const index = routeSource.indexOf(path);
    assert.ok(index >= 0, path);
    assert.ok(routeSource.slice(index, index + 180).includes('dependencies.managementAuth'), path);
  }
  assert.equal(routeSource.includes("router.get(\n    '/v1/clients/:client_id'"), false);
});
