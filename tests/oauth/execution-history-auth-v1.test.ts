import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { createOrGetClient } from '../../src/lib/oauth/v1/idempotent.js';
import { issueV1DirectToken } from '../../src/lib/oauth/v1/direct.js';
import { verifyV1DirectMachineToken } from '../../src/lib/oauth/v1/signer.js';
import { resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';
import { clearKeyringEnv, configureKeyringEnv, generateTestKeyPair } from './_workflow-test-keys.js';
import { AUDIENCE, READ, AUDIT, PRINCIPAL, CLIENT, SECRET, RAW, fixture, instruction, request, storedAudience } from '../helpers/execution-history-fixture.js';

const signing = generateTestKeyPair('auth94-synthetic-key');
beforeEach(() => { configureKeyringEnv({ activeKid: signing.kid, activePrivateKeyPem: signing.privateKeyPem }); resetWorkflowKeyringForTests(); });
afterEach(() => { clearKeyringEnv(); resetWorkflowKeyringForTests(); });
async function supply() { return import('../../src/lib/oauth/v1/execution-history-grant.js'); }
const denied = (category: string) => (error: any) => error.category === category;

// This is a synthetic resource projection boundary, not DSH runtime code.
// Auth's signed identity is consumed with the resource's self-only relation.
function selfProjection(token: string, targetAgent: string) {
  const claims = verifyV1DirectMachineToken(token, AUDIENCE);
  if (!claims.scope.split(' ').includes(READ) || claims.agent_id !== targetAgent) throw new Error('SELF_ONLY');
  return { agentId: claims.agent_id, status: 'completed' };
}

test('ACC94-1 registered fleet self-read mints exact scope; synthetic resource rejects another agent', async () => {
  assert.deepEqual(storedAudience().registeredScopes, [AUDIT, READ]);
  const f = fixture();
  const created = await createOrGetClient({ externalRef: 'agentcore:v1:client:agt_auth94_fixture', principalId: PRINCIPAL }, f.store);
  assert.equal(created.created, true); assert.ok(created.secret);
  const token = await issueV1DirectToken({ ...request, clientId: created.clientId, clientSecret: created.secret! }, f.store);
  const claims = verifyV1DirectMachineToken(token.access_token, AUDIENCE);
  assert.equal(claims.sub, PRINCIPAL); assert.equal(claims.agent_id, 'agt_auth94_fixture');
  assert.equal(claims.scope, READ); assert.equal(claims.aud, AUDIENCE);
  assert.deepEqual(selfProjection(token.access_token, 'agt_auth94_fixture'), { agentId: 'agt_auth94_fixture', status: 'completed' });
  assert.throws(() => selfProjection(token.access_token, 'agt_someone_else'), /SELF_ONLY/);
  assert.equal('raw' in claims, false); assert.equal('secret' in claims, false);
  assert.deepEqual(f.state.grants[0].scopes, [READ]);
});

test('ACC94-2 explicit named audit supply mints; ungranted client gets machine_grant_missing', async () => {
  storedAudience();
  const f = fixture(); f.register();
  await assert.rejects(issueV1DirectToken({ ...request, scope: AUDIT }, f.store), denied('machine_grant_missing'));
  const { applyExecutionHistoryAuditInstruction } = await supply();
  await applyExecutionHistoryAuditInstruction(f.store, instruction('provision', null));
  const result = await issueV1DirectToken({ ...request, scope: AUDIT }, f.store);
  const claims = verifyV1DirectMachineToken(result.access_token, AUDIENCE);
  assert.equal(claims.scope, AUDIT); assert.equal(claims.sub, PRINCIPAL);
  for (const field of ['raw', 'secret', 'decryption', 'role', 'act']) assert.equal(field in claims, false);
  const other = fixture(); other.register(); other.state.clients[0].clientId = 'mc_other_synthetic';
  await assert.rejects(issueV1DirectToken({ ...request, clientId: 'mc_other_synthetic', scope: AUDIT }, other.store), denied('machine_grant_missing'));
});

test('ACC94-3 resource mismatch, unknown audience/scope and mixed scope escalation fail closed', async () => {
  storedAudience();
  const f = fixture(); f.register();
  const { ensureExecutionHistoryReadGrant } = await supply();
  await ensureExecutionHistoryReadGrant(f.store, { id: CLIENT, machinePrincipalId: PRINCIPAL });
  const token = await issueV1DirectToken(request, f.store);
  assert.throws(() => verifyV1DirectMachineToken(token.access_token, 'agent-session-messaging'));
  for (const resource of ['Execution-History', 'execution-history/', 'unknown', 'svc-workflow']) {
    await assert.rejects(issueV1DirectToken({ ...request, resource }, f.store));
  }
  for (const scope of [AUDIT, `${READ} ${AUDIT}`, 'execution.history.unknown', 'execution.*', '', `${READ} ${READ}`, 'workflow.read']) {
    await assert.rejects(issueV1DirectToken({ ...request, scope }, f.store));
  }
  assert.deepEqual(f.state.grants[0].scopes, [READ], 'deny never silently trims or changes grants');
});

test('ACC94-4 provision/revoke are idempotent and every call retains transactional grant_change_audits evidence', async () => {
  const { applyExecutionHistoryAuditInstruction, ensureExecutionHistoryReadGrant } = await supply();
  const f = fixture(); f.register();
  await ensureExecutionHistoryReadGrant(f.store, { id: CLIENT, machinePrincipalId: PRINCIPAL });
  const first = instruction('provision', 1);
  const receipt = await applyExecutionHistoryAuditInstruction(f.store, first);
  assert.deepEqual(f.state.grants[0].scopes, [AUDIT, READ]);
  assert.equal(f.state.grants[0].version, 2);
  await ensureExecutionHistoryReadGrant(f.store, { id: CLIENT, machinePrincipalId: PRINCIPAL });
  assert.deepEqual(f.state.grants[0].scopes, [AUDIT, READ], 'default stamp preserves independently authorized audit');
  assert.equal(f.state.grants[0].version, 2);
  const replay = await applyExecutionHistoryAuditInstruction(f.store, first);
  assert.equal(replay.auditId, receipt.auditId); assert.equal(f.state.audits.length, 1);
  await applyExecutionHistoryAuditInstruction(f.store, instruction('provision', 2));
  assert.equal(f.state.grants[0].version, 2); assert.equal(f.state.audits.length, 2);
  await applyExecutionHistoryAuditInstruction(f.store, instruction('revoke', 2));
  assert.deepEqual(f.state.grants[0].scopes, [READ]); assert.equal(f.state.grants[0].version, 3);
  await applyExecutionHistoryAuditInstruction(f.store, instruction('revoke', 3));
  assert.equal(f.state.grants[0].version, 3); assert.equal(f.state.audits.length, 4);
  await assert.rejects(issueV1DirectToken({ ...request, scope: AUDIT }, f.store), denied('requested_scope_not_granted'));
  await assert.rejects(applyExecutionHistoryAuditInstruction(f.store, { ...first, operation: 'revoke' }), /instruction_replay_mismatch/);
  await assert.rejects(applyExecutionHistoryAuditInstruction(f.store, instruction('provision', 1)), /grant_version_conflict/);
  for (const field of ['approvalRef', 'operatorId', 'sourceGitCommit', 'clientId']) {
    await assert.rejects(applyExecutionHistoryAuditInstruction(f.store, { ...instruction('provision', 3), [field]: '' }));
  }
  f.failAudit();
  await assert.rejects(applyExecutionHistoryAuditInstruction(f.store, instruction('provision', 3)), /synthetic_audit_store_failure/);
  assert.deepEqual(f.state.grants[0].scopes, [READ]); assert.equal(f.state.audits.length, 4);
  const last = fixture(); last.register();
  await applyExecutionHistoryAuditInstruction(last.store, instruction('provision', null));
  await applyExecutionHistoryAuditInstruction(last.store, instruction('revoke', 1));
  await applyExecutionHistoryAuditInstruction(last.store, instruction('revoke', null));
  assert.equal(last.state.grants.length, 0); assert.equal(last.state.audits.length, 3);
  await assert.rejects(issueV1DirectToken({ ...request, scope: AUDIT }, last.store), denied('machine_grant_missing'));
  const cas = fixture(); cas.register();
  await ensureExecutionHistoryReadGrant(cas.store, { id: CLIENT, machinePrincipalId: PRINCIPAL }); cas.failCas();
  await assert.rejects(applyExecutionHistoryAuditInstruction(cas.store, instruction('provision', 1)), /grant_version_conflict/);
  assert.deepEqual(cas.state.grants[0].scopes, [READ]); assert.equal(cas.state.audits.length, 0);
  const birth = fixture(); birth.failRead();
  await assert.rejects(createOrGetClient({ externalRef: 'agentcore:v1:client:agt_auth94_fixture', principalId: PRINCIPAL }, birth.store), /synthetic_read_store_failure/);
  assert.equal(birth.state.clients.length, 0, 'failed read provisioning does not orphan first secret');
});

test('ACC94-5 real success/denial and supply/revoke logs contain no token, secret or raw session content', async () => {
  const logs: string[] = [];
  const warn = console.warn; const log = console.log; const error = console.error;
  console.warn = console.log = console.error = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
  let token = '';
  try {
    storedAudience();
    const { applyExecutionHistoryAuditInstruction } = await supply();
    const f = fixture(); f.register();
    // A raw-content fixture must never enter Auth's logs or durable audits.
    f.state.rawSession = RAW;
    await assert.rejects(issueV1DirectToken({ ...request, scope: AUDIT }, f.store), denied('machine_grant_missing'));
    await applyExecutionHistoryAuditInstruction(f.store, instruction('provision', null));
    token = (await issueV1DirectToken({ ...request, scope: AUDIT }, f.store)).access_token;
    await applyExecutionHistoryAuditInstruction(f.store, instruction('revoke', 1));
    const captured = logs.join('\n') + JSON.stringify(f.state.audits);
    assert.ok(logs.some((line) => line.includes('v1.direct.issued')));
    assert.ok(logs.some((line) => line.includes('machine_grant_missing')));
    for (const value of [token, SECRET, RAW, f.state.clients[0].secretHash]) {
      assert.ok(!captured.includes(value), 'sensitive value absent');
    }
    assert.ok(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(captured), 'no compact JWT');
  } finally { console.warn = warn; console.log = log; console.error = error; }
});
