import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { applyExecutionHistoryAuditInstruction, ensureExecutionHistoryReadGrant } from '../../src/lib/oauth/v1/execution-history-grant.js';
import { AUDIENCE, READ, AUDIT, PRINCIPAL, CLIENT, fixture, instruction } from '../helpers/execution-history-fixture.js';

test('R3-1 revoked client audit revoke preserves read and writes audit; active checks still deny provision', async () => {
  for (const principalStatus of ['active', 'disabled']) {
    const f = fixture(); f.register();
    await ensureExecutionHistoryReadGrant(f.store, { id: CLIENT, machinePrincipalId: PRINCIPAL });
    await applyExecutionHistoryAuditInstruction(f.store, instruction('provision', 1));
    f.state.clients[0].status = 'revoked';
    f.principal.status = principalStatus;
    await assert.rejects(applyExecutionHistoryAuditInstruction(f.store, instruction('provision', 2)), /registered_agent_client_required/);
    assert.equal(f.state.audits.length, 1);

    const revoke = instruction('revoke', 2);
    const result = await applyExecutionHistoryAuditInstruction(f.store, revoke);
    assert.equal(result.replayed, false);
    assert.equal(result.resultingGrantVersion, 3);
    assert.deepEqual(f.state.grants, [{ machineClientId: CLIENT, audienceId: AUDIENCE, scopes: [READ], version: 3 }]);
    assert.equal(f.state.audits.length, 2);
    const audit = f.state.audits[1];
    assert.equal(audit.id, result.auditId);
    assert.equal(audit.migrationId, revoke.migrationId);
    assert.equal(audit.clientId, revoke.clientId);
    assert.equal(audit.reason, 'EXECUTION_HISTORY_AUDIT_REVOKE');
    assert.equal(audit.changeType, 'replace');
    assert.equal(audit.expectedGrantVersion, 2);
    assert.equal(audit.resultingGrantVersion, 3);
    assert.deepEqual(audit.beforeValue, { machineClientId: CLIENT, audienceId: AUDIENCE, scopes: [AUDIT, READ], version: 2 });
    assert.deepEqual(audit.afterValue, { machineClientId: CLIENT, audienceId: AUDIENCE, scopes: [READ], version: 3 });
    await assert.rejects(applyExecutionHistoryAuditInstruction(f.store, instruction('provision', 3)), /registered_agent_client_required/);
    // A disabled principal also cannot regain audit through an active client.
    if (principalStatus === 'disabled') {
      f.state.clients[0].status = 'active';
      await assert.rejects(applyExecutionHistoryAuditInstruction(f.store, instruction('provision', 3)), /registered_agent_client_required/);
    }
    assert.equal(f.state.audits.length, 2);
  }
});

test('R3-2 repeated revoked-client last-scope revoke is an audited NOOP; exact instruction replay reuses evidence', async () => {
  const f = fixture(); f.register();
  await applyExecutionHistoryAuditInstruction(f.store, instruction('provision', null));
  f.state.clients[0].status = 'revoked';
  const first = await applyExecutionHistoryAuditInstruction(f.store, instruction('revoke', 1));
  assert.equal(f.state.grants.length, 0);
  assert.equal(f.state.audits.length, 2);
  assert.deepEqual(f.state.audits[1].beforeValue, { machineClientId: CLIENT, audienceId: AUDIENCE, scopes: [AUDIT], version: 1 });
  assert.equal(f.state.audits[1].afterValue, Prisma.DbNull);
  for (let count = 3; count <= 4; count++) {
    const revoke = instruction('revoke', null);
    const repeated = await applyExecutionHistoryAuditInstruction(f.store, revoke);
    assert.equal(repeated.replayed, false);
    assert.equal(repeated.resultingGrantVersion, first.resultingGrantVersion);
    assert.equal(f.state.grants.length, 0);
    assert.equal(f.state.audits.length, count);
    const audit = f.state.audits[count - 1];
    assert.equal(audit.id, repeated.auditId);
    assert.equal(audit.migrationId, revoke.migrationId);
    assert.equal(audit.reason, 'EXECUTION_HISTORY_AUDIT_REVOKE');
    assert.equal(audit.changeType, 'revoke');
    assert.equal(audit.expectedGrantVersion, null);
    assert.equal(audit.beforeValue, Prisma.DbNull);
    assert.equal(audit.afterValue, Prisma.DbNull);
    const replay = await applyExecutionHistoryAuditInstruction(f.store, revoke);
    assert.deepEqual(replay, { ...repeated, replayed: true });
    assert.equal(f.state.audits.length, count);
  }
});

test('R3-3 never-existing grant revoke remains an audited NOOP for registered active or revoked clients', async () => {
  for (const clientStatus of ['active', 'revoked']) {
    const f = fixture(); f.register(); f.state.clients[0].status = clientStatus;
    for (let count = 1; count <= 2; count++) {
      const revoke = instruction('revoke', null);
      const result = await applyExecutionHistoryAuditInstruction(f.store, revoke);
      assert.equal(result.replayed, false);
      assert.equal(result.resultingGrantVersion, 1);
      assert.equal(f.state.grants.length, 0);
      assert.equal(f.state.audits.length, count);
      const audit = f.state.audits[count - 1];
      assert.equal(audit.id, result.auditId);
      assert.equal(audit.migrationId, revoke.migrationId);
      assert.equal(audit.reason, 'EXECUTION_HISTORY_AUDIT_REVOKE');
      assert.equal(audit.changeType, 'revoke');
      assert.equal(audit.expectedGrantVersion, null);
      assert.equal(audit.beforeValue, Prisma.DbNull);
      assert.equal(audit.afterValue, Prisma.DbNull);
    }
  }
  const missingClient = fixture();
  await assert.rejects(applyExecutionHistoryAuditInstruction(missingClient.store, instruction('revoke', null)), /registered_agent_client_required/);
  assert.equal(missingClient.state.audits.length, 0);
});
