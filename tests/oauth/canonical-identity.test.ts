import test from 'node:test';
import assert from 'node:assert/strict';
import * as identity from '../../src/lib/oauth/v1/canonical-identity.js';
const p = '10000000-0000-0000-0000-000000000001';
const s = '10000000-0000-0000-0000-000000000002';
const agent = 'agt_isolated-fixture';
function fixture(change: any = {}) {
  const principals = change.principals ?? [{ id: p, agentId: agent, principalType: 'agent', status: 'active' }, { id: s, agentId: 'old-isolated', principalType: 'agent', status: 'disabled' }];
  const lifecycle = change.lifecycle ?? [{ principalId: p, state: 'canonical', revision: 9007199254740993n }, { principalId: s, state: 'legacy', revision: 1n }];
  const edges = change.edges ?? [{ sourcePrincipalId: s, targetPrincipalId: p, evidenceRef: 'isolated-fixture' }];
  const calls: any[] = [];
  const model = (rows: any[]) => ({ findMany: async (args: any) => {
      calls.push(args);
      if (change.delay)
        await new Promise(r => setTimeout(r, change.delay));
      if (change.error)
        throw change.error;
      return rows.filter(row => Object.entries(args.where).every(([k, v]) => row[k] === v)).slice(0, args.take);
    } });
  const tx = { machinePrincipal: model(principals), agentIdentityLifecycle: model(lifecycle), agentIdentitySuccessor: model(edges) };
  const db: any = { $transaction: async (fn: any, options: any) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      return fn(tx);
    } };
  return { db, calls };
}
async function rejects(fn: Promise<unknown>, code: string, status = 409) {
  await assert.rejects(fn, e => {
    assert.deepEqual(e, { code, status });
    return true;
  });
}
test('strict exact directions/pair preserve bigint and legacy=false', async () => {
  const { db, calls } = fixture();
  const expected = { principalId: p, agentId: agent, lifecycleRevision: '9007199254740993', resolvedViaLegacy: false };
  assert.deepEqual(await identity.resolveCanonicalByPrincipal(p.toUpperCase(), db), expected);
  assert.deepEqual(await identity.resolveCanonicalByAgent(agent, db), expected);
  assert.deepEqual(await identity.validateCanonicalPair({ principalId: p, agentId: agent }, db), expected);
  assert.ok(calls.every(c => c.take === 2 && c.select));
});
test('syntax, absence, type, inactive, lifecycle and exact pair fail closed', async () => {
  const { db } = fixture();
  await rejects(identity.resolveCanonicalByPrincipal(' ' + p, db), 'INVALID_IDENTITY_INPUT', 400);
  await rejects(identity.resolveCanonicalByAgent('AGT_invalid', db), 'INVALID_IDENTITY_INPUT', 400);
  await rejects(identity.resolveCanonicalByPrincipal('10000000-0000-0000-0000-000000000099', db), 'IDENTITY_NOT_FOUND', 404);
  await rejects(identity.validateCanonicalPair({ principalId: p, agentId: 'agt_other' }, db), 'IDENTITY_PAIR_MISMATCH');
  for (const state of ['unresolved', 'legacy', 'retired', undefined]) {
    const f = fixture({ lifecycle: state ? [{ principalId: p, state, revision: 1n }] : [] });
    await rejects(identity.resolveCanonicalByPrincipal(p, f.db), 'IDENTITY_NOT_CANONICAL');
  }
  for (const [field, value, code] of [['principalType', 'service', 'IDENTITY_NOT_AGENT'], ['status', 'disabled', 'IDENTITY_INACTIVE']]) {
    const f = fixture({ principals: [{ id: p, agentId: agent, principalType: 'agent', status: 'active', [field]: value }] });
    await rejects(identity.resolveCanonicalByPrincipal(p, f.db), code);
  }
});
test('duplicate reverse relation and corrupt lifecycle fail closed', async () => {
  const f = fixture({ principals: [{ id: p, agentId: agent, principalType: 'agent', status: 'active' }, { id: s, agentId: agent, principalType: 'agent', status: 'active' }] });
  await rejects(identity.resolveCanonicalByPrincipal(p, f.db), 'IDENTITY_INCONSISTENT');
  const g = fixture({ lifecycle: [{ principalId: p, state: 'canonical', revision: 0n }] });
  await rejects(identity.resolveCanonicalByPrincipal(p, g.db), 'IDENTITY_INCONSISTENT');
});
test('explicit migration edge and no implicit canonical NOOP', async () => {
  const { db } = fixture();
  assert.deepEqual(await identity.resolveSuccessorForMigration({ sourcePrincipalId: s }, db), { sourcePrincipalId: s, principalId: p, agentId: agent, lifecycleRevision: '9007199254740993', resolvedViaLegacy: true, evidenceRef: 'isolated-fixture' });
  await rejects(identity.resolveSuccessorForMigration({ sourcePrincipalId: p }, db), 'SUCCESSOR_NOT_FOUND', 404);
  for (const patch of [{ edges: [] }, { edges: [{ sourcePrincipalId: s, targetPrincipalId: s, evidenceRef: 'isolated-fixture' }] }, { lifecycle: [{ principalId: s, state: 'canonical', revision: 1n }] }]) {
    const f = fixture(patch);
    await rejects(identity.resolveSuccessorForMigration({ sourcePrincipalId: s }, f.db), patch.edges?.length === 0 ? 'SUCCESSOR_NOT_FOUND' : 'IDENTITY_INCONSISTENT', patch.edges?.length === 0 ? 404 : 409);
  }
});
test('one terminal timeout and safe unavailable; no retries or write interfaces', async () => {
  const f = fixture({ delay: 30 });
  await rejects(identity.resolveCanonicalByPrincipal(p, f.db, { timeoutMs: 5 }), 'IDENTITY_READ_TIMEOUT', 503);
  await new Promise(r => setTimeout(r, 120));
  assert.ok(f.calls.length <= 4);
  const g = fixture({ error: new Error('secret SQL fixture') });
  await rejects(identity.resolveCanonicalByPrincipal(p, g.db), 'IDENTITY_READ_UNAVAILABLE', 503);
  assert.equal(g.calls.length, 1);
});
test('strict canonical leaf rejects outgoing edges; migration rejects chains, cycles and duplicate edges', async () => {
  const malformed = { sourcePrincipalId: p, targetPrincipalId: s, evidenceRef: 'isolated-fixture' };
  await rejects(identity.resolveCanonicalByPrincipal(p, fixture({ edges: [malformed] }).db), 'IDENTITY_INCONSISTENT');
  for (const edges of [[{ sourcePrincipalId: s, targetPrincipalId: p, evidenceRef: 'isolated-fixture' }, malformed], [{ sourcePrincipalId: s, targetPrincipalId: p, evidenceRef: 'isolated-fixture' }, { sourcePrincipalId: s, targetPrincipalId: p, evidenceRef: 'duplicate-isolated' }]]) {
    await rejects(identity.resolveSuccessorForMigration({ sourcePrincipalId: s }, fixture({ edges }).db), 'IDENTITY_INCONSISTENT');
  }
});
test('provider timeout is closed 503 timeout', async () => {
  await rejects(identity.resolveCanonicalByPrincipal(p, fixture({ error: { code: 'P1008', message: 'isolated SQL' } }).db), 'IDENTITY_READ_TIMEOUT', 503);
});
