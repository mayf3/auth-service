import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { generateTestKeyPair, configureKeyringEnv, clearKeyringEnv } from './_workflow-test-keys.js';

process.env.JWT_SECRET ??= 'isolated-identity-reverse-resolution-test-only';

// CTR-IDR-003 fixtures use SYNTHETIC identities only — production canary
// UUID constants are forbidden in fixtures (ACC-IDR-002).
const agentId = 'agt_reverse-fixture-agent';
const principalUuid = '50000000-0000-4000-8000-0000000000b1';
const path = `/api/v1/directory/agents/${agentId}/principal`;
const relation = { principalId: principalUuid, agentId, principalStatus: 'active' };

type Route = typeof import('../../src/routes/workflow-admission.js');
type Resolver = typeof import('../../src/lib/oauth/v1/agent-principal-resolution.js');

async function server(deps: Parameters<Route['createWorkflowAdmissionRouter']>[0], run: (url: string) => Promise<void>) {
  const { createWorkflowAdmissionRouter } = await import('../../src/routes/workflow-admission.js');
  const app = express();
  app.use('/api', createWorkflowAdmissionRouter(deps));
  const srv = createServer(app);
  await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`); }
  finally { srv.closeAllConnections(); await new Promise<void>(resolve => srv.close(() => resolve())); }
}

async function get(url: string, suffix = path, token?: string, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(url + suffix, { headers });
  assert.equal(r.headers.get('cache-control'), 'no-store');
  return { status: r.status, body: await r.json() };
}

/** Fake DB with fail-loud write spies: any mutation attempt fails the test. */
function fakeDb(rows: Array<Record<string, unknown>> | Error, options: { isolation?: string } = {}) {
  const writes: string[] = [];
  const db = {
    writes,
    machinePrincipal: {
      findMany: async (args: { where: Record<string, unknown>; select: Record<string, unknown>; take: number }) => {
        if (rows instanceof Error) throw rows;
        assert.deepEqual(args.where, { agentId });
        assert.deepEqual(Object.keys(args.select).sort(), ['agentId', 'id', 'principalType', 'status']);
        assert.equal(args.take, 2);
        return rows;
      },
      create: async () => { writes.push('create'); throw new Error('WRITE_ATTEMPTED'); },
      update: async () => { writes.push('update'); throw new Error('WRITE_ATTEMPTED'); },
      delete: async () => { writes.push('delete'); throw new Error('WRITE_ATTEMPTED'); },
      upsert: async () => { writes.push('upsert'); throw new Error('WRITE_ATTEMPTED'); },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>, opts?: { isolationLevel?: string }) => {
      if (options.isolation !== undefined) assert.equal(opts?.isolationLevel, options.isolation);
      return fn({ machinePrincipal: db.machinePrincipal });
    },
  };
  return db;
}

test('parseAgentIdParam enforces the exact agt_ stored-id grammar (CTR-IDR-003)', async () => {
  const { parseAgentIdParam, AgentPrincipalResolutionError } = await import('../../src/lib/oauth/v1/agent-principal-resolution.js') as Resolver;
  assert.equal(parseAgentIdParam(agentId), agentId);
  assert.equal(parseAgentIdParam('agt_a'), 'agt_a'); // shortest legal form (length 5)
  const invalid = [
    undefined, null, 42, '',
    'travel-planner', // no agt_ prefix
    'AGT_lowercase-only', // uppercase rejected
    'agt_', // prefix only (length 4)
    `agt_${'a'.repeat(129)}`, // too long
    'agt_space one', 'agt_slash/x', 'agt_dot.x', 'agt_unicode-é',
    'xagt_prefix', 'agt_UPPER',
  ];
  for (const value of invalid) {
    assert.throws(() => parseAgentIdParam(value), (error: unknown) =>
      error instanceof AgentPrincipalResolutionError
      && error.status === 400 && error.code === 'INVALID_AGENT_ID');
  }
});

test('resolver: exact relation success, disabled directory data, fail-closed table, zero writes (CTR-IDR-003/004)', async () => {
  const { resolveAgentIdPrincipalDirectory } = await import('../../src/lib/oauth/v1/agent-principal-resolution.js') as Resolver;
  const activeRow = { id: principalUuid, principalType: 'agent', status: 'active', agentId };
  const db = fakeDb([activeRow], { isolation: 'Serializable' });
  assert.deepEqual(await resolveAgentIdPrincipalDirectory(agentId, db as never), relation);
  assert.deepEqual(db.writes, []);

  db.machinePrincipal.findMany = (async () => [activeRow]) as never;
  assert.deepEqual(await resolveAgentIdPrincipalDirectory(agentId, db as never), relation);

  // Disabled target = 200 directory data, never a 409.
  const disabledRow = { ...activeRow, status: 'disabled' };
  db.machinePrincipal.findMany = (async () => [disabledRow]) as never;
  assert.deepEqual(await resolveAgentIdPrincipalDirectory(agentId, db as never), {
    principalId: principalUuid, agentId, principalStatus: 'disabled',
  });

  // Unknown agentId = 404 AGENT_NOT_FOUND.
  db.machinePrincipal.findMany = (async () => []) as never;
  await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never), (error: unknown) => {
    const e = error as { status?: number; code?: string };
    return e.status === 404 && e.code === 'AGENT_NOT_FOUND';
  });

  // Duplicate relation = 409 IDENTITY_RESOLUTION_AMBIGUOUS (never first-match).
  db.machinePrincipal.findMany = (async () => [activeRow, { ...activeRow, id: '50000000-0000-4000-8000-0000000000b2' }]) as never;
  await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never), (error: unknown) => {
    const e = error as { status?: number; code?: string };
    return e.status === 409 && e.code === 'IDENTITY_RESOLUTION_AMBIGUOUS';
  });

  // Stored agentId drift = 409 (exact equality is proven, not assumed).
  db.machinePrincipal.findMany = (async () => [{ ...activeRow, agentId: 'agt_other-agent' }]) as never;
  await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never), (error: unknown) => {
    const e = error as { status?: number; code?: string };
    return e.status === 409 && e.code === 'IDENTITY_RESOLUTION_AMBIGUOUS';
  });

  // Non-AGENT row = 422 PRINCIPAL_NOT_AGENT.
  db.machinePrincipal.findMany = (async () => [{ ...activeRow, principalType: 'service' }]) as never;
  await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never), (error: unknown) => {
    const e = error as { status?: number; code?: string };
    return e.status === 422 && e.code === 'PRINCIPAL_NOT_AGENT';
  });

  // Malformed row: bad UUID / malformed status / non-array result = 500.
  for (const rows of [
    [{ ...activeRow, id: 'not-a-uuid' }],
    [{ ...activeRow, status: 'unknown-state' }],
    [{ ...activeRow, principalType: 42 }],
  ]) {
    db.machinePrincipal.findMany = (async () => rows) as never;
    await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never), (error: unknown) => {
      const e = error as { status?: number; code?: string };
      return e.status === 500 && e.code === 'IDENTITY_RESOLUTION_QUERY_FAILED';
    });
  }
  db.machinePrincipal.findMany = (async () => 'not-an-array') as never;
  await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never), (error: unknown) => {
    const e = error as { status?: number; code?: string };
    return e.status === 500 && e.code === 'IDENTITY_RESOLUTION_QUERY_FAILED';
  });

  // DB failure = 500; timeout = 504 (one attempt, bounded deadline).
  db.machinePrincipal.findMany = (async () => { throw new Error('SENSITIVE_SENTINEL'); }) as never;
  await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never), (error: unknown) => {
    const e = error as { status?: number; code?: string; message?: string };
    return e.status === 500 && e.code === 'IDENTITY_RESOLUTION_QUERY_FAILED'
      && !String(e.message).includes('SENSITIVE_SENTINEL');
  });
  db.machinePrincipal.findMany = (async () => { await delay(60); return [activeRow]; }) as never;
  await assert.rejects(resolveAgentIdPrincipalDirectory(agentId, db as never, { timeoutMs: 20 }), (error: unknown) => {
    const e = error as { status?: number; code?: string };
    return e.status === 504 && e.code === 'IDENTITY_RESOLUTION_TIMEOUT';
  });
  assert.deepEqual(db.writes, []);
});

test('route: shape rejection, closed projection, no cross-command cache', async () => {
  let reads = 0;
  await server({ authenticate: async () => {}, resolveAgentId: async () => { reads++; return relation; } }, async url => {
    // Extra input is rejected before any target read (400 INVALID_REQUEST).
    for (const suffix of [path + '?name=agent', path + '?agent_id=x']) {
      assert.deepEqual(await get(url, suffix), { status: 400, body: { error: 'INVALID_REQUEST' } });
    }
    assert.equal(reads, 0);
    // Malformed grammar = 400 INVALID_AGENT_ID, no target read.
    for (const bad of ['agt_Unknown', 'travel-planner', 'agt_']) {
      const r = await get(url, `/api/v1/directory/agents/${bad}/principal`);
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'INVALID_AGENT_ID');
    }
    assert.equal(reads, 0);
    // GET body-framing rejection lives in the shared family helper; fetch()
    // strips content-length, so it is pinned directly (CTR-IDR-003).
    const { assertNoQueryOrBody, AgentPrincipalResolutionError } = await import('../../src/lib/oauth/v1/agent-principal-resolution.js') as Resolver;
    for (const headers of [{ 'content-length': '5' }, { 'transfer-encoding': 'chunked' }]) {
      assert.throws(() => assertNoQueryOrBody({}, undefined, headers), (error: unknown) =>
        error instanceof AgentPrincipalResolutionError && error.status === 400 && error.code === 'INVALID_REQUEST');
    }
    // Exact three-field body, once per call, no cache across commands.
    for (let i = 0; i < 2; i++) assert.deepEqual(await get(url), { status: 200, body: relation });
    assert.equal(reads, 2);
  });
});

test('route: whole-operation deadline covers authentication and discards late results', async () => {
  await server({ timeoutMs: 20, authenticate: async () => { await delay(60); }, resolveAgentId: async () => relation }, async url => {
    assert.deepEqual(await get(url), { status: 504, body: { error: 'IDENTITY_RESOLUTION_TIMEOUT' } });
  });
  let reads = 0;
  await server({ timeoutMs: 20, authenticate: async () => {}, resolveAgentId: async () => { reads++; await delay(60); return relation; } }, async url => {
    assert.deepEqual(await get(url), { status: 504, body: { error: 'IDENTITY_RESOLUTION_TIMEOUT' } });
    await delay(80);
    assert.equal(reads, 1); // late settlement absorbed, no retry
  });
});

test('route: resolver failure stays fail-closed and leaks only the error code', async () => {
  await server({ authenticate: async () => {}, resolveAgentId: async () => { throw new Error('SENSITIVE_SENTINEL'); } }, async url => {
    const r = await get(url);
    assert.equal(r.status, 500);
    assert.equal(r.body.error, 'IDENTITY_RESOLUTION_QUERY_FAILED');
    assert.equal(Object.keys(r.body).length, 1);
    assert.ok(!JSON.stringify(r.body).includes('SENSITIVE_SENTINEL'));
  });
});

test('real signed AGENT and SERVICE callers reach the reverse read; invalid profiles deny before it (ACC-IDR-001)', async () => {
  const key = generateTestKeyPair('identity-reverse-resolution-test');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  const [{ resetWorkflowKeyringForTests }, signer, { prisma }, auth, { default: jwt }] = await Promise.all([
    import('../../src/lib/oauth/workflow-keyring.js'), import('../../src/lib/oauth/v1/signer.js'),
    import('../../src/lib/prisma.js'), import('../../src/middleware/v1-workflow-admission-auth.js'), import('jsonwebtoken'),
  ]);
  resetWorkflowKeyringForTests();
  const pd = prisma.machinePrincipal as unknown as Record<string, any>;
  const cd = prisma.machineClient as unknown as Record<string, any>;
  const p = prisma as unknown as Record<string, any>;
  const original = [pd.findUnique, cd.findUnique, p.$transaction];
  let caller = { id: '30000000-0000-4000-8000-0000000000c1', principalType: 'agent', agentId: 'agt_caller-agent' as string | null, status: 'active' };
  let client = { clientId: 'reverse-caller-agent', machinePrincipalId: caller.id, status: 'active' };
  const targetRows: Array<Record<string, unknown>> = [{
    id: principalUuid, principalType: 'agent', status: 'active', agentId,
  }];
  let reads = 0;
  pd.findUnique = async (args: any) => {
    assert.deepEqual(Object.keys(args.select).sort(), ['agentId', 'id', 'principalType', 'status']);
    return caller;
  };
  cd.findUnique = async (args: any) => {
    assert.deepEqual(Object.keys(args.select).sort(), ['clientId', 'machinePrincipalId', 'status']);
    return client;
  };
  p.$transaction = async (fn: any, opts: any) => {
    assert.equal(opts?.isolationLevel, 'Serializable');
    return fn({ machinePrincipal: { findMany: async (args: any) => {
      reads++;
      assert.deepEqual(args.where, { agentId });
      assert.equal(args.take, 2);
      return targetRows;
    } } });
  };
  try {
    for (const principalType of ['agent', 'service'] as const) {
      caller = {
        id: principalType === 'agent'
          ? '30000000-0000-4000-8000-0000000000c1'
          : '40000000-0000-4000-8000-0000000000c2',
        principalType,
        agentId: principalType === 'agent' ? 'agt_caller-agent' : null,
        status: 'active',
      };
      client = { clientId: `reverse-caller-${principalType}`, machinePrincipalId: caller.id, status: 'active' };
      targetRows[0].status = 'active';
      reads = 0;
      const valid = signer.signV1DirectMachineToken({ principalId: caller.id, principalType, agentId: caller.agentId,
        clientId: client.clientId, audience: auth.WORKFLOW_ADMISSION_AUDIENCE, scope: auth.WORKFLOW_ADMISSION_SCOPE });
      const token = (delta: Record<string, unknown>) => jwt.sign({ ...valid.claims, ...delta }, key.privateKeyPem, { algorithm: 'RS256', keyid: key.kid });
      await server({}, async url => {
        // Generic internal caller positive for BOTH caller types.
        assert.deepEqual(await get(url, path, valid.token), { status: 200, body: relation });
        assert.equal(reads, 1);
        // Every denial happens before any target read.
        const denied: Array<[string | undefined, number]> = [
          [undefined, 401], ['invalid', 401],
          [token({ aud: 'agent-directory' }), 401],
          [token({ aud: 'svc-auth' }), 401],
          [token({ scope: 'auth.identity.provision' }), 403],
          [token({ scope: 'auth.other.read' }), 403],
          [token({ principal_type: 'user' }), 401],
          [token({ sub: principalUuid }), 401],
          [token({ client_id: 'other-service' }), 401],
          [token({ exp: valid.claims.iat - 3600 }), 401],
        ];
        for (const [t, status] of denied) {
          const response = await get(url, path, t);
          assert.equal(response.status, status);
          assert.equal(reads, 1, 'denials precede the target read');
        }
        // Disabled TARGET = 200 directory data.
        targetRows[0].status = 'disabled';
        assert.deepEqual(await get(url, path, valid.token), {
          status: 200, body: { principalId: principalUuid, agentId, principalStatus: 'disabled' },
        });
        targetRows[0].status = 'active';
      });
    }
  } finally {
    [pd.findUnique, cd.findUnique, p.$transaction] = original;
    clearKeyringEnv(); resetWorkflowKeyringForTests();
  }
});
