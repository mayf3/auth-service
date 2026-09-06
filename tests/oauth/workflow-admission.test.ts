import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { generateTestKeyPair, configureKeyringEnv, clearKeyringEnv } from './_workflow-test-keys.js';
process.env.JWT_SECRET ??= 'isolated-workflow-admission-test-only';
const target = '10000000-0000-4000-8000-000000000001';
const path = `/api/v1/directory/principals/${target}/agent`;
const relation = { principalId: target, agentId: 'agt_test-agent', principalStatus: 'active' };
type Route = typeof import('../../src/routes/workflow-admission.js');
async function server(deps: Parameters<Route['createWorkflowAdmissionRouter']>[0], run: (url: string) => Promise<void>) {
  const { createWorkflowAdmissionRouter } = await import('../../src/routes/workflow-admission.js');
  const app = express();
  app.use('/api', createWorkflowAdmissionRouter(deps));
  const srv = createServer(app);
  await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`); }
  finally { srv.closeAllConnections(); await new Promise<void>(resolve => srv.close(() => resolve())); }
}
async function get(url: string, suffix = path, token?: string) {
  const r = await fetch(url + suffix, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(r.headers.get('cache-control'), 'no-store');
  return { status: r.status, body: await r.json() };
}

test('shape rejection and exact response, no cross-command cache', async () => {
  let reads = 0;
  await server({ authenticate: async () => {}, resolve: async () => { reads++; return relation; } }, async url => {
    for (const suffix of [path.replace(target, 'a-name'), path + '?name=agent']) {
      assert.deepEqual(await get(url, suffix), { status: 400, body: { error: 'INVALID_REQUEST' } });
    }
    assert.equal(reads, 0);
    for (let i = 0; i < 2; i++) assert.deepEqual(await get(url), { status: 200, body: relation });
    assert.equal(reads, 2);
  });
});

test('whole operation deadline includes caller lookup and discards late authentication', async () => {
  let reads = 0;
  await server({ timeoutMs: 20, authenticate: async () => { await delay(60); }, resolve: async () => { reads++; return relation; } }, async url => {
    assert.deepEqual(await get(url), { status: 504, body: { error: 'IDENTITY_RESOLUTION_TIMEOUT' } });
    await delay(80);
    assert.equal(reads, 0);
  });
});

test('late target resolution and unknown errors remain fail-closed without retry', async () => {
  for (const fail of [false, true]) {
    let reads = 0;
    await server({ timeoutMs: 20, authenticate: async () => {}, resolve: async () => {
      reads++;
      if (fail) throw new Error('SENSITIVE_SENTINEL');
      await delay(60); return relation;
    } }, async url => {
      assert.deepEqual(await get(url), { status: fail ? 500 : 504, body: { error: fail ? 'IDENTITY_RESOLUTION_QUERY_FAILED' : 'IDENTITY_RESOLUTION_TIMEOUT' } });
      await delay(80); assert.equal(reads, 1);
    });
  }
});

test('real signed AGENT and SERVICE callers: generic directory access, disabled target data, fail-closed profiles', async () => {
  const key = generateTestKeyPair('workflow-admission-test');
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
  let caller: { id: string; principalType: string; agentId: string | null; status: string } = {
    id: '', principalType: '', agentId: null, status: 'active',
  };
  let client: { clientId: string; machinePrincipalId: string; status: string } = {
    clientId: '', machinePrincipalId: '', status: 'active',
  };
  const targetRows: Array<Record<string, unknown>> = [{
    id: target, principalType: 'agent', status: 'active', agentId: relation.agentId,
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
  p.$transaction = async (fn: any) => fn({ machinePrincipal: { findMany: async (args: any) => {
    reads++;
    assert.equal(args.take, 2);
    return 'id' in args.where ? targetRows : [{ id: target }];
  } } });
  try {
    for (const principalType of ['agent', 'service'] as const) {
      caller = {
        id: principalType === 'agent'
          ? '30000000-0000-4000-8000-0000000000a1'
          : '40000000-0000-4000-8000-0000000000a2',
        principalType,
        agentId: principalType === 'agent' ? 'agt_caller-agent' : null,
        status: 'active',
      };
      client = { clientId: `directory-caller-${principalType}`, machinePrincipalId: caller.id, status: 'active' };
      targetRows[0].status = 'active';
      reads = 0;
      const valid = signer.signV1DirectMachineToken({ principalId: caller.id, principalType, agentId: caller.agentId,
        clientId: client.clientId, audience: auth.WORKFLOW_ADMISSION_AUDIENCE, scope: auth.WORKFLOW_ADMISSION_SCOPE });
      const token = (delta: Record<string, unknown>) => jwt.sign({ ...valid.claims, ...delta }, key.privateKeyPem, { algorithm: 'RS256', keyid: key.kid });
      await server({}, async url => {
        // Generic internal caller positive: agent AND service mint + read the
        // exact three-field directory body (no caller-agentId requirement).
        assert.deepEqual(await get(url, path, valid.token), { status: 200, body: relation });
        assert.equal(reads, 2);
        const denied: Array<[string | undefined, number]> = [
          [undefined, 401], ['invalid', 401],
          [token({ aud: 'agent-directory' }), 401],
          [token({ aud: 'svc-auth' }), 401],
          [token({ token_use: 'workflow_obo' }), 401],
          [token({ principal_type: 'user' }), 401],
          [token({ scope: 'auth.other.read' }), 403],
          [token({ scope: 'auth.directory.read auth.other.read' }), 403],
          [token({ sub: target }), 401],
          [token({ client_id: 'other-service' }), 401],
          [token({ exp: valid.claims.iat - 3600 }), 401],
        ];
        if (principalType === 'service') denied.push([token({ agent_id: 'agt_sneaky' }), 401]);
        for (const [t, status] of denied) {
          const response = await get(url, path, t);
          assert.equal(response.status, status);
          assert.equal(reads, 2, 'every denial happens before any target read');
        }
        // Disabled TARGET is 200 directory data, never a 409.
        targetRows[0].status = 'disabled';
        assert.deepEqual(await get(url, path, valid.token), {
          status: 200, body: { principalId: target, agentId: relation.agentId, principalStatus: 'disabled' },
        });
        assert.equal(reads, 4);
        targetRows[0].status = 'active';
        // Fresh caller state: disabled caller is 403 before the target read.
        caller.status = 'disabled';
        assert.equal((await get(url, path, valid.token)).status, 403);
        assert.equal(reads, 4);
        caller.status = 'active'; client.status = 'revoked';
        assert.equal((await get(url, path, valid.token)).status, 403);
        assert.equal(reads, 4);
        client.status = 'active'; client.machinePrincipalId = target;
        assert.equal((await get(url, path, valid.token)).status, 401);
        assert.equal(reads, 4);
        client.machinePrincipalId = caller.id;
        // A human Principal row can never serve a machine directory read.
        caller.principalType = 'user';
        assert.equal((await get(url, path, valid.token)).status, 403);
        assert.equal(reads, 4);
      });
    }
  } finally {
    [pd.findUnique, cd.findUnique, p.$transaction] = original;
    clearKeyringEnv(); resetWorkflowKeyringForTests();
  }
});
