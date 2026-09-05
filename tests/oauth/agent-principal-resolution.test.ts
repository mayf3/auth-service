/**
 * Focused tests for the exact Agent Principal resolution route
 * (AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1, ACC-EAPR-002/003/004).
 *
 * No network beyond the loopback test server, no real database: the resolver
 * runs against injected fixture adapters and the production-middleware test
 * monkey-patches the prisma delegates exactly like
 * tests/oauth/identity-resolution-v1.test.ts.
 *
 * The production-middleware test requires the generated runtime snapshot
 * (`npm run contract:v1:prepare`) because the real V1 verifier loads it.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  AGENT_PRINCIPAL_RESOLUTION_DEFAULT_TIMEOUT_MS,
  AgentPrincipalResolutionError,
  type AgentPrincipalFindManyArgs,
  type AgentPrincipalResolutionDatabase,
  assertNoQueryOrBody,
  parsePrincipalIdParam,
  resolveAgentPrincipalById,
  toAgentPrincipalResolutionError,
} from '../../src/lib/oauth/v1/agent-principal-resolution.js';
import { clearKeyringEnv, configureKeyringEnv, generateTestKeyPair } from './_workflow-test-keys.js';

const VALID_UUID = 'BC970CED-710F-4479-9FF0-E295A1C59424'; // mixed case on purpose
const LOWER_UUID = VALID_UUID.toLowerCase();
const AGENT_ID = 'hr-agent';

function forwardRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LOWER_UUID,
    principalType: 'agent',
    agentId: AGENT_ID,
    status: 'active',
    ...overrides,
  };
}

interface FixtureOptions {
  forwardRows?: Array<Record<string, unknown>>;
  reverseRows?: Array<Record<string, unknown>>;
  forwardError?: unknown;
  reverseError?: unknown;
}

interface FixtureHandle {
  db: AgentPrincipalResolutionDatabase;
  calls: { forward: number; reverse: number };
  transactions: number;
  mutations: string[];
  queryLog: Array<AgentPrincipalFindManyArgs>;
}

function fixtureDatabase(options: FixtureOptions = {}): FixtureHandle {
  const calls = { forward: 0, reverse: 0 };
  const transactions = { count: 0 };
  const mutations: string[] = [];
  const queryLog: AgentPrincipalFindManyArgs[] = [];
  // Object.hasOwn (not ??) so explicitly-passed null rows survive — a null
  // array models a malformed driver result that must become a 500.
  const hasForwardRows = Object.hasOwn(options, 'forwardRows');
  const hasReverseRows = Object.hasOwn(options, 'reverseRows');
  const db: AgentPrincipalResolutionDatabase = {
    machinePrincipal: {
      async findMany(args) {
        queryLog.push(args);
        if ('id' in args.where) {
          calls.forward += 1;
          if (options.forwardError !== undefined) throw options.forwardError;
          return (hasForwardRows ? options.forwardRows : []) as Array<Record<string, unknown>>;
        }
        calls.reverse += 1;
        if (options.reverseError !== undefined) throw options.reverseError;
        return (hasReverseRows ? options.reverseRows : []) as Array<Record<string, unknown>>;
      },
    },
    async $transaction(fn) {
      transactions.count += 1;
      const result = await fn({
        machinePrincipal: {
          findMany: (args) => db.machinePrincipal.findMany(args),
        },
        $transaction: () => {
          throw new Error('nested transaction');
        },
      });
      return result;
    },
  };
  return {
    db,
    calls,
    get transactions() {
      return transactions.count;
    },
    mutations,
    queryLog,
  };
}

function expectError(code: string, status: number): (error: unknown) => boolean {
  return (error) => error instanceof AgentPrincipalResolutionError
    && error.code === code
    && error.status === status;
}

// ─── Input grammar (CTR-EAPR-002) ───────────────────────────────────────────

test('malformed UUID grammar is rejected with 400 INVALID_PRINCIPAL_ID before any query', async () => {
  const handle = fixtureDatabase();
  const malformed = [
    '', ' ', 'hr-agent', 'not-a-uuid',
    'BC970CED710F44799FF0E295A1C5942',
    'BC970CED-710F-4479-9FF0-E295A1C5942',
    'ZC970CED-710F-4479-9FF0-E295A1C59424',
    'BC970CED-710F-4479-9FF0-E295A1C5942extra',
    `${LOWER_UUID}?extra`,
  ];
  for (const candidate of malformed) {
    await assert.rejects(
      resolveAgentPrincipalById(candidate, handle.db),
      expectError('INVALID_PRINCIPAL_ID', 400),
    );
  }
  assert.deepEqual(handle.calls, { forward: 0, reverse: 0 }, 'no target query may run');
});

test('case-equivalent UUIDs are accepted and canonicalized to lowercase', async () => {
  const handle = fixtureDatabase({ forwardRows: [forwardRow()], reverseRows: [{ id: LOWER_UUID }] });
  const result = await resolveAgentPrincipalById(VALID_UUID, handle.db);
  assert.deepEqual(result, { principalId: LOWER_UUID, agentId: AGENT_ID });
  assert.deepEqual(handle.queryLog[0]?.where, { id: LOWER_UUID });
});

test('assertNoQueryOrBody rejects any query key or non-empty body', () => {
  assert.doesNotThrow(() => assertNoQueryOrBody({}, undefined));
  assert.doesNotThrow(() => assertNoQueryOrBody({}, {}));
  assert.doesNotThrow(() => assertNoQueryOrBody({}, {}, { 'content-length': '0' }));
  assert.throws(
    () => assertNoQueryOrBody({ external_ref: 'x' }, undefined),
    expectError('INVALID_REQUEST', 400),
  );
  assert.throws(
    () => assertNoQueryOrBody({ tracing: '1' }, {}),
    expectError('INVALID_REQUEST', 400),
  );
  assert.throws(
    () => assertNoQueryOrBody({}, { patch: true }),
    expectError('INVALID_REQUEST', 400),
  );
  // Raw framing headers expose bodies the JSON parser never sees (chunked GET).
  assert.throws(
    () => assertNoQueryOrBody({}, {}, { 'content-length': '17' }),
    expectError('INVALID_REQUEST', 400),
  );
  assert.throws(
    () => assertNoQueryOrBody({}, {}, { 'transfer-encoding': 'chunked' }),
    expectError('INVALID_REQUEST', 400),
  );
});

test('parsePrincipalIdParam returns the lowercase canonical value', () => {
  assert.equal(parsePrincipalIdParam('ABCDEF01-2345-4678-9ABC-DEF012345678'), 'abcdef01-2345-4678-9abc-def012345678');
  assert.throws(() => parsePrincipalIdParam(undefined), expectError('INVALID_PRINCIPAL_ID', 400));
  assert.throws(() => parsePrincipalIdParam(['x']), expectError('INVALID_PRINCIPAL_ID', 400));
});

// ─── Exact canonical target (CTR-EAPR-003) ─────────────────────────────────

test('eligible row returns exactly the two-field body and both reads share one transaction', async () => {
  const handle = fixtureDatabase({ forwardRows: [forwardRow()], reverseRows: [{ id: LOWER_UUID }] });
  const result = await resolveAgentPrincipalById(LOWER_UUID, handle.db);
  assert.deepEqual(result, { principalId: LOWER_UUID, agentId: AGENT_ID });
  assert.equal(Object.keys(result).length, 2, 'the success body is exactly the two contract fields');
  assert.equal(handle.transactions, 1, 'forward and reverse reads share one snapshot');
  assert.deepEqual(handle.calls, { forward: 1, reverse: 1 });
  assert.deepEqual(handle.queryLog[0], {
    where: { id: LOWER_UUID },
    select: { id: true, principalType: true, agentId: true, status: true },
    take: 2,
  });
  assert.deepEqual(handle.queryLog[1], {
    where: { agentId: AGENT_ID },
    select: { id: true },
    take: 2,
  });
});

test('zero forward rows is 404 PRINCIPAL_NOT_FOUND', async () => {
  const handle = fixtureDatabase();
  await assert.rejects(resolveAgentPrincipalById(LOWER_UUID, handle.db), expectError('PRINCIPAL_NOT_FOUND', 404));
});

test('duplicate forward rows fail closed as 409 IDENTITY_RESOLUTION_AMBIGUOUS', async () => {
  const handle = fixtureDatabase({
    forwardRows: [forwardRow(), forwardRow({ agentId: 'other' })],
  });
  await assert.rejects(
    resolveAgentPrincipalById(LOWER_UUID, handle.db),
    expectError('IDENTITY_RESOLUTION_AMBIGUOUS', 409),
  );
});

test('non-agent principal type is 422 PRINCIPAL_NOT_AGENT', async () => {
  for (const principalType of ['service', 'human']) {
    const handle = fixtureDatabase({ forwardRows: [forwardRow({ principalType })] });
    await assert.rejects(
      resolveAgentPrincipalById(LOWER_UUID, handle.db),
      expectError('PRINCIPAL_NOT_AGENT', 422),
    );
  }
});

test('disabled principal is 409 PRINCIPAL_DISABLED', async () => {
  const handle = fixtureDatabase({ forwardRows: [forwardRow({ status: 'disabled' })] });
  await assert.rejects(resolveAgentPrincipalById(LOWER_UUID, handle.db), expectError('PRINCIPAL_DISABLED', 409));
});

test('empty or missing agentId is 409 AGENT_MAPPING_MISSING', async () => {
  for (const agentId of [null, '']) {
    const handle = fixtureDatabase({ forwardRows: [forwardRow({ agentId })] });
    await assert.rejects(
      resolveAgentPrincipalById(LOWER_UUID, handle.db),
      expectError('AGENT_MAPPING_MISSING', 409),
    );
  }
});

test('reverse agentId mapping must be exactly the one same principal or 409', async () => {
  const zero = fixtureDatabase({ forwardRows: [forwardRow()], reverseRows: [] });
  await assert.rejects(
    resolveAgentPrincipalById(LOWER_UUID, zero.db),
    expectError('IDENTITY_RESOLUTION_AMBIGUOUS', 409),
  );
  const duplicate = fixtureDatabase({
    forwardRows: [forwardRow()],
    reverseRows: [{ id: LOWER_UUID }, { id: 'aaaaaaaa-0000-4000-8000-000000000001' }],
  });
  await assert.rejects(
    resolveAgentPrincipalById(LOWER_UUID, duplicate.db),
    expectError('IDENTITY_RESOLUTION_AMBIGUOUS', 409),
  );
  const mismatched = fixtureDatabase({
    forwardRows: [forwardRow()],
    reverseRows: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001' }],
  });
  await assert.rejects(
    resolveAgentPrincipalById(LOWER_UUID, mismatched.db),
    expectError('IDENTITY_RESOLUTION_AMBIGUOUS', 409),
  );
});

test('name-shaped legacy identifiers can never resolve (no fallback path exists)', async () => {
  const handle = fixtureDatabase({
    forwardRows: [forwardRow({ agentId: 'agt_legacy' })],
    reverseRows: [{ id: LOWER_UUID }],
  });
  // The stored agentId is echoed verbatim — no trimming, no conversion.
  const result = await resolveAgentPrincipalById(LOWER_UUID, handle.db);
  assert.equal(result.agentId, 'agt_legacy');
  assert.deepEqual(handle.queryLog[1]?.where, { agentId: 'agt_legacy' });
});

// ─── Unknown failures and no mutation (CTR-EAPR-004) ───────────────────────

test('database and malformed-row failures are 500 and never fabricated absence', async () => {
  for (const error of [new Error('database unavailable'), Object.assign(new Error('P2000'), { code: 'P2000' })]) {
    const handle = fixtureDatabase({ forwardError: error });
    await assert.rejects(
      resolveAgentPrincipalById(LOWER_UUID, handle.db),
      expectError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
    );
  }
  for (const error of [new Error('reverse read broke')]) {
    const handle = fixtureDatabase({
      forwardRows: [forwardRow()],
      reverseError: error,
    });
    await assert.rejects(
      resolveAgentPrincipalById(LOWER_UUID, handle.db),
      expectError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
    );
  }
  const malformed = fixtureDatabase({ forwardRows: [forwardRow({ principalType: 42 })] });
  await assert.rejects(
    resolveAgentPrincipalById(LOWER_UUID, malformed.db),
    expectError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
  );
  const nonArray = fixtureDatabase({ forwardRows: null as unknown as Array<Record<string, unknown>> });
  await assert.rejects(
    resolveAgentPrincipalById(LOWER_UUID, nonArray.db),
    expectError('IDENTITY_RESOLUTION_QUERY_FAILED', 500),
  );
});

test('driver timeout errors map to 504 IDENTITY_RESOLUTION_TIMEOUT', async () => {
  for (const error of [
    Object.assign(new Error('socket timed out'), { code: 'ETIMEDOUT' }),
    Object.assign(new Error('pool timeout'), { code: 'P2024' }),
    Object.assign(new Error('TimeoutError'), { name: 'TimeoutError' }),
  ]) {
    const handle = fixtureDatabase({ forwardError: error });
    await assert.rejects(
      resolveAgentPrincipalById(LOWER_UUID, handle.db),
      expectError('IDENTITY_RESOLUTION_TIMEOUT', 504),
    );
  }
});

test('deadline constant is exactly the accepted 5000ms default', () => {
  assert.equal(AGENT_PRINCIPAL_RESOLUTION_DEFAULT_TIMEOUT_MS, 5000);
});

const SHORT_DEADLINE_MS = 25;
const DEADLINE_TOLERANCE_MS = 2000;

test('never-settling transaction ends bounded as 504 and late settlement cannot rewrite it', async () => {
  const unhandled: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandledRejection);
  let settleLate!: (value: unknown) => void;
  const late = new Promise((resolve) => {
    settleLate = resolve;
  });
  const handle = fixtureDatabase();
  const original = handle.db.machinePrincipal.findMany;
  handle.db.machinePrincipal.findMany = () => late as never;

  try {
    const startedAt = Date.now();
    await assert.rejects(
      resolveAgentPrincipalById(LOWER_UUID, handle.db, { timeoutMs: SHORT_DEADLINE_MS }),
      expectError('IDENTITY_RESOLUTION_TIMEOUT', 504),
    );
    assert.ok(Date.now() - startedAt < DEADLINE_TOLERANCE_MS, 'the injected short deadline must bound the wait');

    settleLate([forwardRow()]);
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
    assert.deepEqual(unhandled, [], 'late completion must not reject unhandled');
  } finally {
    process.off('unhandledRejection', onUnhandledRejection);
    handle.db.machinePrincipal.findMany = original;
  }
});

test('the resolution performs zero writes of any kind', async () => {
  const handle = fixtureDatabase({ forwardRows: [forwardRow()], reverseRows: [{ id: LOWER_UUID }] });
  const recordMutation = (method: string) => (): never => {
    handle.mutations.push(method);
    throw new Error(`unexpected mutation ${method}`);
  };
  // Wrap the fixture so every write method (inside and outside the
  // transaction frame) is armed and would explode the resolution.
  const db: AgentPrincipalResolutionDatabase = {
    machinePrincipal: {
      ...handle.db.machinePrincipal,
      create: recordMutation('principal.create'),
      update: recordMutation('principal.update'),
      updateMany: recordMutation('principal.updateMany'),
      upsert: recordMutation('principal.upsert'),
      delete: recordMutation('principal.delete'),
      deleteMany: recordMutation('principal.deleteMany'),
    } as AgentPrincipalResolutionDatabase['machinePrincipal'],
    $transaction: (fn, options) => handle.db.$transaction((tx) => fn({
      ...tx,
      machinePrincipal: {
        ...tx.machinePrincipal,
        create: recordMutation('tx.principal.create'),
        update: recordMutation('tx.principal.update'),
        upsert: recordMutation('tx.principal.upsert'),
        delete: recordMutation('tx.principal.delete'),
      },
    }), options),
  };
  await resolveAgentPrincipalById(LOWER_UUID, db);
  assert.deepEqual(handle.mutations, [], 'no write method may be invoked by the resolution');
});

test('toAgentPrincipalResolutionError maps unknown values to 500', () => {
  const mapped = toAgentPrincipalResolutionError('boom');
  assert.ok(mapped instanceof AgentPrincipalResolutionError);
  assert.equal(mapped.status, 500);
  assert.equal(mapped.code, 'IDENTITY_RESOLUTION_QUERY_FAILED');
});

test('resolver source stays query-only with the exact two-read shape', async () => {
  const source = await readFile('src/lib/oauth/v1/agent-principal-resolution.ts', 'utf8');
  for (const forbiddenCall of ['.create(', '.update(', '.updateMany(', '.upsert(', '.delete(', '.$executeRaw']) {
    assert.equal(source.includes(forbiddenCall), false, forbiddenCall);
  }
  assert.equal((source.match(/\.findMany\(/g) ?? []).length, 4, 'forward + reverse + two adapter wrappers');
  assert.match(source, /isolationLevel: 'Serializable'/);
});

// ─── Express route (injected dependencies) ─────────────────────────────────

type RouteModule = typeof import('../../src/routes/agent-principals.js');

async function withRouteServer(
  dependencies: Parameters<RouteModule['createAgentPrincipalRouter']>[0] | undefined,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const { createAgentPrincipalRouter } = await import('../../src/routes/agent-principals.js');
  const app = express();
  app.use(express.json());
  app.use('/api', dependencies
    ? createAgentPrincipalRouter(dependencies)
    : createAgentPrincipalRouter());
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const testAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.header('authorization') !== 'Bearer ok') {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  next();
};

interface RouteFixture {
  dependencies: Parameters<RouteModule['createAgentPrincipalRouter']>[0];
}

function routeFixture(): RouteFixture {
  return {
    dependencies: {
      auth: testAuth,
      resolve: async () => ({ principalId: LOWER_UUID, agentId: AGENT_ID }),
    },
  };
}

async function getJson(baseUrl: string, path: string, authenticated = true): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authenticated ? { authorization: 'Bearer ok' } : {},
  });
  return { status: response.status, body: await response.json() };
}

test('a valid caller reaches the target lookup and receives exactly the two-field body', async () => {
  const fixture = routeFixture();
  await withRouteServer(fixture.dependencies, async (baseUrl) => {
    const response = await getJson(baseUrl, `/api/v1/agent-principals/${LOWER_UUID}/agent`);
    assert.deepEqual(response, { status: 200, body: { principalId: LOWER_UUID, agentId: AGENT_ID } });
  });
});

test('unauthenticated requests are rejected by the middleware before the resolver', async () => {
  const fixture = routeFixture();
  await withRouteServer(fixture.dependencies, async (baseUrl) => {
    const response = await getJson(baseUrl, `/api/v1/agent-principals/${LOWER_UUID}/agent`, false);
    assert.deepEqual(response, { status: 401, body: { error: 'UNAUTHORIZED' } });
  });
});

test('malformed UUID, extra query, and request bodies are rejected 400 before any target query', async () => {
  let resolveCalls = 0;
  const dependencies = {
    auth: testAuth,
    resolve: async () => {
      resolveCalls += 1;
      return { principalId: LOWER_UUID, agentId: AGENT_ID };
    },
  };
  await withRouteServer(dependencies, async (baseUrl) => {
    for (const path of [
      '/api/v1/agent-principals/not-a-uuid/agent',
      '/api/v1/agent-principals/BC970CED710F44799FF0E295A1C59424/agent',
    ]) {
      assert.deepEqual(
        await getJson(baseUrl, path),
        { status: 400, body: { error: 'INVALID_PRINCIPAL_ID' } },
      );
    }
    assert.deepEqual(
      await getJson(baseUrl, `/api/v1/agent-principals/${LOWER_UUID}/agent?external_ref=hr-agent`),
      { status: 400, body: { error: 'INVALID_REQUEST' } },
    );
    // A GET carrying a real JSON body (Content-Length framed, as real
    // clients send it) must be rejected like any other body.
    const { port, hostname } = new URL(baseUrl);
    const bodyPayload = JSON.stringify({ injected: true });
    const bodyStatus = await new Promise<number>((resolve, reject) => {
      const outgoing = httpRequest(
        {
          host: hostname,
          port: Number(port),
          path: `/api/v1/agent-principals/${LOWER_UUID}/agent`,
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(bodyPayload)),
            authorization: 'Bearer ok',
          },
        },
        (res) => {
          resolve(res.statusCode as number);
          res.resume();
        },
      );
      outgoing.on('error', reject);
      outgoing.end(bodyPayload);
    });
    assert.equal(bodyStatus, 400);
    assert.equal(resolveCalls, 0, 'no rejected request may reach the target query');
  });
});

test('every target error family maps to its exact status and machine code', async () => {
  const failures: Array<[unknown, number, string]> = [
    [new AgentPrincipalResolutionError(404, 'PRINCIPAL_NOT_FOUND'), 404, 'PRINCIPAL_NOT_FOUND'],
    [new AgentPrincipalResolutionError(409, 'IDENTITY_RESOLUTION_AMBIGUOUS'), 409, 'IDENTITY_RESOLUTION_AMBIGUOUS'],
    [new AgentPrincipalResolutionError(422, 'PRINCIPAL_NOT_AGENT'), 422, 'PRINCIPAL_NOT_AGENT'],
    [new AgentPrincipalResolutionError(409, 'PRINCIPAL_DISABLED'), 409, 'PRINCIPAL_DISABLED'],
    [new AgentPrincipalResolutionError(409, 'AGENT_MAPPING_MISSING'), 409, 'AGENT_MAPPING_MISSING'],
    [new AgentPrincipalResolutionError(500, 'IDENTITY_RESOLUTION_QUERY_FAILED'), 500, 'IDENTITY_RESOLUTION_QUERY_FAILED'],
    [new AgentPrincipalResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT'), 504, 'IDENTITY_RESOLUTION_TIMEOUT'],
    [new Error('generic internal failure'), 500, 'IDENTITY_RESOLUTION_QUERY_FAILED'],
  ];
  for (const [error, status, code] of failures) {
    const dependencies = {
      auth: testAuth,
      resolve: async () => {
        throw error;
      },
    };
    await withRouteServer(dependencies, async (baseUrl) => {
      assert.deepEqual(
        await getJson(baseUrl, `/api/v1/agent-principals/${LOWER_UUID}/agent`),
        { status, body: { error: code } },
      );
    });
  }
});

test('a bounded deadline inside the resolver surfaces as route 504', async () => {
  const never = new Promise<never>(() => {});
  const handle = fixtureDatabase();
  handle.db.machinePrincipal.findMany = () => never;
  const dependencies = {
    auth: testAuth,
    resolve: (principalId: string) => resolveAgentPrincipalById(
      principalId,
      handle.db,
      { timeoutMs: SHORT_DEADLINE_MS },
    ),
  };
  await withRouteServer(dependencies as never, async (baseUrl) => {
    assert.deepEqual(
      await getJson(baseUrl, `/api/v1/agent-principals/${LOWER_UUID}/agent`),
      { status: 504, body: { error: 'IDENTITY_RESOLUTION_TIMEOUT' } },
    );
  });
});

// ─── Production middleware wiring (real V1 verifier + patched delegates) ───

test('production router enforces the real V1 verification chain before any target read', async () => {
  process.env.JWT_SECRET ??= 'agent-principal-resolution-route-test-secret';
  const key = generateTestKeyPair('agent-principal-resolution-route-key');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  const [{ resetWorkflowKeyringForTests }, { signV1DirectMachineToken }, { prisma }, jwtModule] = await Promise.all([
    import('../../src/lib/oauth/workflow-keyring.js'),
    import('../../src/lib/oauth/v1/signer.js'),
    import('../../src/lib/prisma.js'),
    import('jsonwebtoken'),
  ]);
  const jwt = jwtModule.default;
  resetWorkflowKeyringForTests();

  const CALLER_PRINCIPAL_ID = '10000000-0000-4000-8000-000000000001';
  const OTHER_PRINCIPAL_ID = '20000000-0000-4000-8000-000000000002';
  const settings = {
    principal: {
      id: CALLER_PRINCIPAL_ID,
      principalType: 'agent',
      agentId: 'hr-agent',
      status: 'active',
    } as Record<string, unknown> | null,
    client: {
      clientId: 'hr-public-client',
      machinePrincipalId: CALLER_PRINCIPAL_ID,
      status: 'active',
    } as Record<string, unknown> | null,
  };
  const stateBefore = structuredClone(settings);
  const reads = { principal: 0, client: 0, target: 0 };
  const queriedSubs: string[] = [];

  const principalDelegate = prisma.machinePrincipal as unknown as Record<string, unknown>;
  const clientDelegate = prisma.machineClient as unknown as Record<string, unknown>;
  const prismaInstance = prisma as unknown as Record<string, unknown>;
  const originals = {
    principalFindUnique: principalDelegate.findUnique,
    clientFindUnique: clientDelegate.findUnique,
    principalFindMany: principalDelegate.findMany,
    prismaTransaction: prismaInstance.$transaction,
  };
  const targetRows = (): Array<Record<string, unknown>> => [{
    id: LOWER_UUID,
    principalType: 'agent',
    agentId: 'hr-agent',
    status: 'active',
  }];
  principalDelegate.findUnique = async (args: { where: { id: string } }) => {
    reads.principal += 1;
    queriedSubs.push(args.where.id);
    return settings.principal;
  };
  clientDelegate.findUnique = async () => {
    reads.client += 1;
    return settings.client;
  };
  principalDelegate.findMany = async () => {
    reads.target += 1;
    return targetRows();
  };
  // No real database may be contacted: the read-only Serializable transaction
  // is replayed over the same patched delegates.
  prismaInstance.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn({
    machinePrincipal: { findMany: () => principalDelegate.findMany() },
  });

  const now = Math.floor(Date.now() / 1000);
  const baseClaims = {
    iss: 'auth-service',
    sub: CALLER_PRINCIPAL_ID,
    aud: 'agent-principal-resolution',
    principal_type: 'agent',
    client_id: 'hr-public-client',
    token_use: 'access',
    type: 'access',
    version: 'v1',
    scope: 'auth.agent.resolve',
    agent_id: 'hr-agent',
    jti: 'resolution-route-jti-000001',
    iat: now,
    nbf: now,
    exp: now + 600,
  };
  const signWith = (claims: Record<string, unknown>, kid: string, privateKeyPem: string): string =>
    jwt.sign(claims, privateKeyPem, { algorithm: 'RS256', keyid: kid });

  const foreignKey = generateTestKeyPair('agent-principal-resolution-foreign-key');

  const valid = signV1DirectMachineToken({
    principalId: CALLER_PRINCIPAL_ID,
    principalType: 'agent',
    agentId: 'hr-agent',
    clientId: 'hr-public-client',
    audience: 'agent-principal-resolution',
    scope: 'auth.agent.resolve',
  }).token;

  const wrongAudience = signWith({ ...baseClaims, aud: 'svc-auth', scope: 'auth.identity.provision' }, key.kid, key.privateKeyPem);
  const expired = signWith({ ...baseClaims, iat: now - 3600, nbf: now - 3600, exp: now - 1800 }, key.kid, key.privateKeyPem);
  const wrongSignature = signWith(baseClaims, foreignKey.kid, foreignKey.privateKeyPem);
  const missingScope = signWith({ ...baseClaims, scope: 'auth.identity.provision' }, key.kid, key.privateKeyPem);
  const tamperedProfile = signWith({ ...baseClaims, principal_type: 'service' }, key.kid, key.privateKeyPem);

  type Mutator = () => void;
  const restoreState = (): Mutator => {
    const snapshot = structuredClone(settings);
    return () => {
      settings.principal = snapshot.principal;
      settings.client = snapshot.client;
    };
  };

  try {
    await withRouteServer(undefined, async (baseUrl) => {
      const path = `/api/v1/agent-principals/${LOWER_UUID}/agent`;

      const missing = await fetch(`${baseUrl}${path}`);
      assert.equal(missing.status, 401);
      assert.deepEqual(await missing.json(), { error: 'UNAUTHORIZED' });
      assert.deepEqual(reads, { principal: 0, client: 0, target: 0 }, 'no token: zero reads');

      const wrongAud = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${wrongAudience}` } });
      assert.equal(wrongAud.status, 401);
      assert.deepEqual(await wrongAud.json(), { error: 'UNAUTHORIZED' });
      assert.equal(reads.target, 0, 'wrong audience rejected before target read');

      const expiredResponse = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${expired}` } });
      assert.equal(expiredResponse.status, 401);
      assert.deepEqual(await expiredResponse.json(), { error: 'UNAUTHORIZED' });
      assert.equal(reads.target, 0, 'expired token rejected before target read');

      const badSignature = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${wrongSignature}` } });
      assert.equal(badSignature.status, 401);
      assert.equal(reads.target, 0, 'wrong signature rejected before target read');

      const unknownKid = await fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${signWith(baseClaims, 'unknown-kid', key.privateKeyPem)}` },
      });
      assert.equal(unknownKid.status, 401);
      assert.equal(reads.target, 0, 'unknown kid rejected before target read');

      const noScope = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${missingScope}` } });
      assert.equal(noScope.status, 403);
      assert.deepEqual(await noScope.json(), { error: 'ACCESS_DENIED' });
      assert.equal(reads.target, 0, 'missing scope rejected before target read');

      const serviceProfile = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${tamperedProfile}` } });
      assert.equal(serviceProfile.status, 401, 'service profile is not accepted by the agent-only audience');
      assert.equal(reads.target, 0, 'profile rejection happens before target read');

      const restoreDisabled = restoreState();
      settings.principal = { ...settings.principal!, status: 'disabled' };
      const disabled = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${valid}` } });
      assert.equal(disabled.status, 403);
      assert.deepEqual(await disabled.json(), { error: 'ACCESS_DENIED' });
      assert.equal(reads.target, 0, 'disabled caller rejected before target read');
      restoreDisabled();

      const restoreRevokedClient = restoreState();
      settings.client = { ...settings.client!, status: 'revoked' };
      const revokedClient = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${valid}` } });
      assert.equal(revokedClient.status, 403);
      assert.deepEqual(await revokedClient.json(), { error: 'ACCESS_DENIED' });
      assert.equal(reads.target, 0, 'inactive client rejected before target read');
      restoreRevokedClient();

      const restoreBinding = restoreState();
      settings.client = { ...settings.client!, machinePrincipalId: OTHER_PRINCIPAL_ID };
      const mismatchedBinding = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${valid}` } });
      assert.equal(mismatchedBinding.status, 401);
      assert.deepEqual(await mismatchedBinding.json(), { error: 'UNAUTHORIZED' });
      assert.equal(reads.target, 0, 'mismatched binding rejected before target read');
      restoreBinding();

      const restoreProfile = restoreState();
      settings.principal = { ...settings.principal!, agentId: 'other-agent' };
      const profileDrift = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${valid}` } });
      assert.equal(profileDrift.status, 403);
      assert.deepEqual(await profileDrift.json(), { error: 'ACCESS_DENIED' });
      assert.equal(reads.target, 0, 'signed/stored profile drift rejected before target read');
      restoreProfile();

      const success = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${valid}` } });
      assert.equal(success.status, 200);
      assert.deepEqual(await success.json(), { principalId: LOWER_UUID, agentId: 'hr-agent' });
      assert.ok(reads.target >= 1, 'the valid caller reaches the target lookup');
      assert.deepEqual(queriedSubs.every((sub) => sub === CALLER_PRINCIPAL_ID), true);
      assert.deepEqual(settings, stateBefore, 'the whole operation performs zero mutation');
    });
  } finally {
    principalDelegate.findUnique = originals.principalFindUnique;
    clientDelegate.findUnique = originals.clientFindUnique;
    principalDelegate.findMany = originals.principalFindMany;
    prismaInstance.$transaction = originals.prismaTransaction;
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
  }
});
