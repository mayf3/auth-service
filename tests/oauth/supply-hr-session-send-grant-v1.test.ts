/**
 * Focused fixture-adapter tests for the controlled one-tuple HR
 * agent.session.send Grant vehicle (AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1,
 * contracts CTR-HRG-001..005; ACC-HRG-001/002/003/005 authoring scope).
 *
 * No network, no real database, no production anything: every scenario runs
 * against an in-memory fixture adapter of the Prisma transaction client. No
 * secret, token, hash or credential value exists anywhere in these fixtures.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADVISORY_LOCK_KEY,
  AGENT_ID,
  APPLY_AUDIT_EVENT_TYPE,
  APPLY_ENV_GATE,
  APPLY_REASON,
  AUDIENCE_ID,
  AUDIT_DETAIL_KEYS,
  MIGRATION_ID,
  OPERATOR_ENV,
  PRINCIPAL_ID,
  ROLLBACK_AUDIT_EVENT_TYPE,
  ROLLBACK_REASON,
  SOURCE_SPEC_COMMIT,
  TARGET_SCOPE,
  TARGET_SCOPES,
  applyInTransaction,
  checkApplyAuthorization,
  executeApply,
  executeRollback,
  parseApplyReceipt,
  planGrant,
  unrelatedGrantDigest,
  verifyGrant,
  type GrantPlan,
  type HrSendGrantDatabase,
  type ToolAudienceRow,
  type ToolAuditRow,
  type ToolClientRow,
  type ToolGrantRow,
  type ToolInput,
  type ToolPrincipalRow,
} from '../../scripts/supply-hr-session-send-grant-v1.js';

const HR_PUBLIC_CLIENT_ID = 'hr-public-client';
const HR_CLIENT_UUID = '77000000-0000-4000-8000-000000000001';
const EFFICIENCY_CLIENT_UUID = '66000000-0000-4000-8000-00000000000e';
const HR_WORKFLOW_CLIENT_UUID = '77000000-0000-4000-8000-000000000002';
const FIXED_NONCE = '11111111-1111-4111-8111-111111111111';

// ─── Fixture adapter (no real DB) ───────────────────────────────────────────

function principalRow(overrides: Partial<ToolPrincipalRow> = {}): ToolPrincipalRow {
  return {
    id: PRINCIPAL_ID,
    principalType: 'agent',
    status: 'active',
    disabledAt: null,
    agentId: AGENT_ID,
    ...overrides,
  };
}

function audienceRow(overrides: Partial<ToolAudienceRow> = {}): ToolAudienceRow {
  return {
    audienceId: AUDIENCE_ID,
    resourceService: 'agent-session-messaging',
    scopeNamespace: 'agent',
    acceptedPrincipalTypes: ['agent'],
    registeredScopes: [TARGET_SCOPE],
    humanAccessEnabled: false,
    machineAccessEnabled: true,
    delegatedAccessEnabled: false,
    status: 'active',
    freezeReady: true,
    version: 1,
    ...overrides,
  };
}

interface FixtureState {
  audience: ToolAudienceRow | null;
  principal: ToolPrincipalRow | null;
  clients: ToolClientRow[];
  grants: ToolGrantRow[];
  audits: ToolAuditRow[];
}

interface FixtureBehavior {
  failOnGrantCreate?: string;
  rejectAfterCommit?: boolean;
}

interface FixtureHandle {
  db: HrSendGrantDatabase;
  state: FixtureState;
  writes: string[];
  rawQueries: string[];
  transactionCount: () => number;
}

const BASE_GRANTS: ToolGrantRow[] = [
  // HR Workflow grant — must remain byte-equivalent (CTR-HRG-002).
  {
    machineClientId: HR_WORKFLOW_CLIENT_UUID,
    audienceId: 'svc-workflow',
    scopes: ['workflow.read'],
    version: 1,
  },
  // Efficiency's send + scheduler grants — must remain byte-equivalent.
  {
    machineClientId: EFFICIENCY_CLIENT_UUID,
    audienceId: AUDIENCE_ID,
    scopes: [TARGET_SCOPE],
    version: 1,
  },
  {
    machineClientId: EFFICIENCY_CLIENT_UUID,
    audienceId: 'scheduler',
    scopes: ['scheduler.jobs.read'],
    version: 2,
  },
];

function fixtureDatabase(
  configure: (state: FixtureState) => void = () => {},
  behavior: FixtureBehavior = {},
): FixtureHandle {
  const state: FixtureState = {
    audience: audienceRow(),
    principal: principalRow(),
    clients: [
      { id: HR_CLIENT_UUID, clientId: HR_PUBLIC_CLIENT_ID, status: 'active', revokedAt: null },
    ],
    grants: BASE_GRANTS.map((grant) => ({ ...grant, scopes: [...grant.scopes] })),
    audits: [],
  };
  configure(state);

  const writes: string[] = [];
  const rawQueries: string[] = [];
  let txInvocations = 0;
  const db: HrSendGrantDatabase = {
    machinePrincipal: {
      async findUnique({ where }) {
        return state.principal !== null && state.principal.id === where.id
          ? { ...state.principal }
          : null;
      },
    },
    machineClient: {
      async findMany() {
        // Fixture model: state.clients is exactly the set bound to the principal.
        return state.clients.map((client) => ({ ...client }));
      },
    },
    machineAccessGrant: {
      async findUnique({ where }) {
        const key = `${where.machineClientId_audienceId.machineClientId}\0${where.machineClientId_audienceId.audienceId}`;
        return state.grants.find((grant) => `${grant.machineClientId}\0${grant.audienceId}` === key)
          ? { ...state.grants.find((grant) => `${grant.machineClientId}\0${grant.audienceId}` === key) as ToolGrantRow }
          : null;
      },
      async findMany() {
        return state.grants.map((grant) => ({ ...grant, scopes: [...grant.scopes] }));
      },
      async create({ data }) {
        if (behavior.failOnGrantCreate) throw new Error(behavior.failOnGrantCreate);
        writes.push(`machineAccessGrant.create:${data.audienceId}:${data.scopes.join(',')}@v${data.version}`);
        state.grants.push({ ...data, scopes: [...data.scopes] });
        return data;
      },
      async updateMany({ where, data }) {
        const row = state.grants.find((grant) => grant.machineClientId === where.machineClientId
          && grant.audienceId === where.audienceId);
        const matches = row !== undefined
          && row.version === where.version
          && JSON.stringify([...row.scopes].sort()) === JSON.stringify([...where.scopes.equals].sort());
        if (!matches) return { count: 0 };
        writes.push(`machineAccessGrant.updateMany:${row.audienceId}:v${row.version}->v${data.version}`);
        row.version = data.version;
        return { count: 1 };
      },
    },
    authAudience: {
      async findUnique({ where }) {
        return state.audience !== null && state.audience.audienceId === where.audienceId
          ? { ...state.audience }
          : null;
      },
    },
    authSecurityAudit: {
      async findFirst({ where }) {
        const found = state.audits.find((audit) => audit.requestCorrelationId === where.requestCorrelationId);
        return found ? { ...found } : null;
      },
      async create({ data }) {
        writes.push(`authSecurityAudit.create:${data.eventType}`);
        const row: ToolAuditRow = {
          id: data.id,
          eventType: data.eventType,
          result: data.result,
          requestCorrelationId: data.requestCorrelationId,
          details: JSON.parse(JSON.stringify(data.details)) as unknown,
        };
        state.audits.push(row);
        return row;
      },
    },
    async $executeRaw(query) {
      rawQueries.push(query);
      return 0;
    },
    async $transaction(fn) {
      txInvocations += 1;
      if (behavior.rejectAfterCommit) {
        await fn(db);
        throw new Error('commit acknowledgement lost (simulated)');
      }
      return fn(db);
    },
  };
  return { db, state, writes, rawQueries, transactionCount: () => txInvocations };
}

function toolInput(overrides: Partial<ToolInput> = {}): ToolInput {
  return {
    suppliedClientId: HR_PUBLIC_CLIENT_ID,
    operatorId: 'test-operator',
    approvalRef: 'test-approval',
    sourceGitCommit: 'a'.repeat(40),
    ...overrides,
  };
}

function forgedCreatedReceipt(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    approval_ref: 'test-approval',
    audit_correlation_id: FIXED_NONCE,
    audience: AUDIENCE_ID,
    client_id: HR_PUBLIC_CLIENT_ID,
    client_uuid: HR_CLIENT_UUID,
    environment: 'test',
    migration_id: MIGRATION_ID,
    new_version: 1,
    nonce: FIXED_NONCE,
    old_version: null,
    operator: 'test-operator',
    outcome: 'CREATED',
    plan_sha256: 'b'.repeat(64),
    postimage: {
      audience_id: AUDIENCE_ID,
      machine_client_uuid: HR_CLIENT_UUID,
      scopes: [TARGET_SCOPE],
      version: 1,
    },
    postimage_digest: 'c'.repeat(64),
    preimage_digest: 'd'.repeat(64),
    principal_uuid: PRINCIPAL_ID,
    reason: APPLY_REASON,
    rollback: { eligible: true },
    runbook_sha256: 'unspecified',
    scopes: [TARGET_SCOPE],
    source_git_commit: 'a'.repeat(40),
    source_spec_commit: SOURCE_SPEC_COMMIT,
    source_spec_id: 'AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1',
    unrelated_grant_digest: 'f'.repeat(64),
    utc_time: '2026-09-05T00:00:00.000Z',
    ...overrides,
  };
}

function isHex64(value: string | null): boolean {
  return value !== null && /^[0-9a-f]{64}$/.test(value);
}

function targetGrant(state: FixtureState): ToolGrantRow | undefined {
  return state.grants.find((grant) => grant.machineClientId === HR_CLIENT_UUID
    && grant.audienceId === AUDIENCE_ID);
}

function unrelatedSnapshot(state: FixtureState): ToolGrantRow[] {
  return state.grants.filter((grant) => !(grant.machineClientId === HR_CLIENT_UUID
    && grant.audienceId === AUDIENCE_ID))
    .map((grant) => ({ ...grant, scopes: [...grant.scopes] }));
}

// ─── ACC-HRG-001: census bindings ───────────────────────────────────────────

test('plan classifies a clean ABSENT preimage, binds the exact census IDs, and writes nothing', async () => {
  const handle = fixtureDatabase();
  const plan: GrantPlan = await planGrant(handle.db, {
    suppliedClientId: HR_PUBLIC_CLIENT_ID,
    nonce: FIXED_NONCE,
  });
  assert.equal(plan.outcome, 'CREATE');
  assert.equal(plan.abortReason, null);
  assert.equal(plan.classification, 'ABSENT');
  assert.equal(plan.audience, 'EXACT');
  assert.deepEqual(plan.principal, {
    found: true,
    principalType: 'agent',
    status: 'active',
    disabledAtNull: true,
    agentIdMatches: true,
  });
  assert.deepEqual(plan.binding, {
    activeClientCount: 1,
    uniqueActiveClientId: HR_PUBLIC_CLIENT_ID,
    uniqueActiveClientUuid: HR_CLIENT_UUID,
    matchesSuppliedClientId: true,
  });
  assert.equal(plan.audienceVersion, 1);
  assert.ok(isHex64(plan.preimageDigest));
  assert.ok(isHex64(plan.unrelatedGrantDigest));
  assert.ok(isHex64(plan.planSha256));
  assert.equal(plan.nonce, FIXED_NONCE);
  // Census binds the frozen nonsecret IDs into the plan document.
  assert.equal(plan.planDocument.principal_id, PRINCIPAL_ID);
  assert.equal(plan.planDocument.agent_id, AGENT_ID);
  assert.equal(plan.planDocument.audience_id, AUDIENCE_ID);
  assert.deepEqual(plan.planDocument.target_scopes, [TARGET_SCOPE]);
  assert.deepEqual(handle.writes, [], 'plan performs zero writes');

  // Deterministic on identical state with the same nonce.
  const again = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID, nonce: FIXED_NONCE });
  assert.equal(again.planSha256, plan.planSha256);
  assert.equal(again.unrelatedGrantDigest, plan.unrelatedGrantDigest);
});

test('census aborts on missing, non-agent, disabled, or agent_id-mismatched Principal', async () => {
  const missing = fixtureDatabase((state) => { state.principal = null; });
  assert.equal((await planGrant(missing.db, toolInput())).abortReason, 'PRINCIPAL_NOT_FOUND');

  const wrongType = fixtureDatabase((state) => {
    state.principal = principalRow({ principalType: 'service', agentId: null });
  });
  const wrongTypePlan = await planGrant(wrongType.db, toolInput());
  assert.equal(wrongTypePlan.outcome, 'ABORT');
  assert.equal(wrongTypePlan.abortReason, 'PRINCIPAL_NOT_AGENT');

  const disabled = fixtureDatabase((state) => {
    state.principal = principalRow({ status: 'disabled', disabledAt: new Date('2026-01-01T00:00:00Z') });
  });
  assert.equal((await planGrant(disabled.db, toolInput())).abortReason, 'PRINCIPAL_DISABLED');

  const agentDrift = fixtureDatabase((state) => {
    state.principal = principalRow({ agentId: 'some-other-agent' });
  });
  assert.equal((await planGrant(agentDrift.db, toolInput())).abortReason, 'PRINCIPAL_AGENT_ID_MISMATCH');

  for (const handle of [missing, wrongType, disabled, agentDrift]) {
    assert.deepEqual(handle.writes, [], 'aborting census performs zero writes');
  }
});

test('census aborts on duplicate active clients and on zero active clients', async () => {
  const duplicate = fixtureDatabase((state) => {
    state.clients.push({
      id: '88000000-0000-4000-8000-000000000002',
      clientId: 'hr-public-client-2',
      status: 'active',
      revokedAt: null,
    });
  });
  const duplicatePlan = await planGrant(duplicate.db, toolInput());
  assert.equal(duplicatePlan.outcome, 'ABORT');
  assert.equal(duplicatePlan.abortReason, 'AMBIGUOUS_BINDING');
  assert.deepEqual(duplicatePlan.binding, {
    activeClientCount: 0,
    matchesSuppliedClientId: false,
    uniqueActiveClientId: null,
    uniqueActiveClientUuid: null,
  });

  const revokedOnly = fixtureDatabase((state) => {
    state.clients = [{
      id: HR_CLIENT_UUID,
      clientId: HR_PUBLIC_CLIENT_ID,
      status: 'active',
      revokedAt: new Date('2026-01-01T00:00:00Z'),
    }];
  });
  assert.equal((await planGrant(revokedOnly.db, toolInput())).abortReason, 'NO_ACTIVE_CLIENT');

  const inactiveOnly = fixtureDatabase((state) => {
    state.clients = [{
      id: HR_CLIENT_UUID,
      clientId: HR_PUBLIC_CLIENT_ID,
      status: 'inactive',
      revokedAt: null,
    }];
  });
  assert.equal((await planGrant(inactiveOnly.db, toolInput())).abortReason, 'NO_ACTIVE_CLIENT');
});

test('census aborts when the supplied public client id mismatches the unique binding', async () => {
  const handle = fixtureDatabase();
  const plan = await planGrant(handle.db, { suppliedClientId: 'mc_some_other_client' });
  assert.equal(plan.outcome, 'ABORT');
  assert.equal(plan.abortReason, 'CLIENT_MISMATCH');
  assert.equal(plan.binding.uniqueActiveClientId, HR_PUBLIC_CLIENT_ID);
  assert.equal(plan.binding.matchesSuppliedClientId, false);
  assert.deepEqual(handle.writes, []);
});

test('census aborts on drifted or absent audience', async () => {
  const scopeDrift = fixtureDatabase((state) => {
    state.audience = audienceRow({ registeredScopes: [TARGET_SCOPE, 'agent.session.read'] });
  });
  assert.equal((await planGrant(scopeDrift.db, toolInput())).abortReason, 'AUDIENCE_DRIFTED');

  const disabledAudience = fixtureDatabase((state) => {
    state.audience = audienceRow({ machineAccessEnabled: false });
  });
  assert.equal((await planGrant(disabledAudience.db, toolInput())).abortReason, 'AUDIENCE_DRIFTED');

  const versionDrift = fixtureDatabase((state) => {
    state.audience = audienceRow({ version: 2 });
  });
  assert.equal((await planGrant(versionDrift.db, toolInput())).abortReason, 'AUDIENCE_DRIFTED');

  const absentAudience = fixtureDatabase((state) => { state.audience = null; });
  assert.equal((await planGrant(absentAudience.db, toolInput())).abortReason, 'AUDIENCE_ABSENT');

  for (const handle of [scopeDrift, disabledAudience, versionDrift, absentAudience]) {
    assert.deepEqual(handle.writes, []);
  }
});

// ─── ACC-HRG-002: row families ──────────────────────────────────────────────

test('absent row: apply creates the exact tuple and the audit in one transaction', async () => {
  const handle = fixtureDatabase();
  const before = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  const result = await executeApply(handle.db, toolInput());
  assert.equal(result.outcome, 'CREATED');
  assert.equal(result.abortReason, null);
  assert.equal(result.classification, 'LIVE_NOOP');
  assert.ok(result.auditCorrelationId);
  assert.ok(isHex64(result.postimageDigest));
  assert.equal(result.unrelatedGrantDigest, before.unrelatedGrantDigest,
    'unrelated grants are untouched by the create');

  assert.deepEqual(handle.writes, [
    `machineAccessGrant.create:${AUDIENCE_ID}:${TARGET_SCOPE}@v1`,
    `authSecurityAudit.create:${APPLY_AUDIT_EVENT_TYPE}`,
  ], 'grant row and audit commit in the same transaction, nothing else');

  const row = targetGrant(handle.state);
  assert.deepEqual(row && { scopes: row.scopes, version: row.version }, {
    scopes: [TARGET_SCOPE],
    version: 1,
  });

  const after = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  assert.equal(after.classification, 'LIVE_NOOP');
  assert.equal(after.outcome, 'NOOP');
});

test('exact tombstone: apply reactivates to live v1 with scopes unchanged', async () => {
  const handle = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 0,
    });
  });
  const before = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  assert.equal(before.classification, 'REACTIVATIBLE');
  assert.equal(before.outcome, 'REACTIVATE');

  const result = await executeApply(handle.db, toolInput());
  assert.equal(result.outcome, 'REACTIVATED');
  assert.deepEqual(handle.writes, [
    `machineAccessGrant.updateMany:${AUDIENCE_ID}:v0->v1`,
    `authSecurityAudit.create:${APPLY_AUDIT_EVENT_TYPE}`,
  ], 'reactivation is a single guarded CAS update plus the same-tx audit');
  const row = targetGrant(handle.state);
  assert.deepEqual(row && { scopes: row.scopes, version: row.version }, {
    scopes: [TARGET_SCOPE],
    version: 1,
  });
  assert.equal(result.unrelatedGrantDigest, before.unrelatedGrantDigest);
});

test('already-live exact row: apply is a verified NOOP with zero writes and no second audit', async () => {
  const handle = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 1,
    });
  });
  const auditsBefore = handle.state.audits.length;
  const result = await executeApply(handle.db, toolInput());
  assert.equal(result.outcome, 'NOOP');
  assert.equal(result.auditCorrelationId, null);
  assert.deepEqual(handle.writes, [], 'NOOP must not write the row or a second creation audit');
  assert.equal(handle.state.audits.length, auditsBefore);
  const row = targetGrant(handle.state);
  assert.equal(row?.version, 1, 'NOOP leaves the live row untouched');
});

test('conflict families (wrong scopes, unioned scopes, drifted version) fail closed with zero writes', async () => {
  const cases: Array<ToolGrantRow> = [
    { machineClientId: HR_CLIENT_UUID, audienceId: AUDIENCE_ID, scopes: ['agent.session.read'], version: 1 },
    { machineClientId: HR_CLIENT_UUID, audienceId: AUDIENCE_ID, scopes: [TARGET_SCOPE, 'agent.session.read'], version: 1 },
    { machineClientId: HR_CLIENT_UUID, audienceId: AUDIENCE_ID, scopes: [TARGET_SCOPE], version: 2 },
    { machineClientId: HR_CLIENT_UUID, audienceId: AUDIENCE_ID, scopes: [TARGET_SCOPE], version: 3 },
  ];
  for (const conflictRow of cases) {
    const handle = fixtureDatabase((state) => { state.grants.push(conflictRow); });
    const plan = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
    assert.equal(plan.classification, 'CONFLICT');
    assert.equal(plan.outcome, 'ABORT');
    assert.equal(plan.abortReason, 'GRANT_CONFLICT');
    const result = await executeApply(handle.db, toolInput());
    assert.equal(result.outcome, 'ABORT');
    assert.equal(result.abortReason, 'GRANT_CONFLICT');
    assert.deepEqual(handle.writes, [], 'conflicts must not write anything');
    assert.deepEqual(targetGrant(handle.state), conflictRow, 'conflicting row is never modified');
  }
});

test('unrelated grants (HR workflow, efficiency send/scheduler) stay byte-equivalent', async () => {
  const before = unrelatedSnapshot(fixtureDatabase().state);
  const created = fixtureDatabase();
  const createdResult = await executeApply(created.db, toolInput());
  assert.equal(createdResult.outcome, 'CREATED');
  assert.deepEqual(unrelatedSnapshot(created.state), before);

  const reactivated = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 0,
    });
  });
  const reactivatedResult = await executeApply(reactivated.db, toolInput());
  assert.equal(reactivatedResult.outcome, 'REACTIVATED');
  assert.deepEqual(unrelatedSnapshot(reactivated.state), before);

  // The digest projection is stable for the same unrelated set regardless of
  // the target row's state.
  assert.equal(
    unrelatedGrantDigest(unrelatedSnapshot(created.state), HR_CLIENT_UUID),
    unrelatedGrantDigest(before, HR_CLIENT_UUID),
  );
});

// ─── ACC-HRG-003: atomicity, audit, unknown outcome ─────────────────────────

test('activation audit carries the exact bounded reason, nonce carrier, and closed detail keys', async () => {
  const handle = fixtureDatabase();
  const plan = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  const result = await executeApply(handle.db, toolInput());
  assert.equal(result.outcome, 'CREATED');
  assert.ok(result.auditCorrelationId);
  assert.equal(result.auditCorrelationId, result.nonce, 'the nonce is the audit correlation carrier');

  const audit = handle.state.audits.find((entry) => entry.requestCorrelationId === result.auditCorrelationId);
  assert.ok(audit, 'nonce-unique audit row exists');
  assert.equal(audit.eventType, APPLY_AUDIT_EVENT_TYPE);
  assert.equal(audit.result, 'success');
  assert.deepEqual(Object.keys(audit.details as Record<string, unknown>).sort(), [...AUDIT_DETAIL_KEYS].sort());
  const details = audit.details as Record<string, unknown>;
  assert.equal(details.reason, APPLY_REASON, 'bounded apply reason constant');
  assert.equal(details.migration_id, MIGRATION_ID);
  assert.equal(details.principal_uuid, PRINCIPAL_ID);
  assert.equal(details.client_uuid, HR_CLIENT_UUID);
  assert.equal(details.client_id, HR_PUBLIC_CLIENT_ID);
  assert.equal(details.agent_id, AGENT_ID);
  assert.equal(details.audience, AUDIENCE_ID);
  assert.deepEqual(details.scopes, [TARGET_SCOPE]);
  assert.equal(details.old_version, null);
  assert.equal(details.new_version, 1);
  assert.equal(details.activation, 'created');
  assert.equal(details.preimage_digest, plan.preimageDigest);
  assert.equal(details.operator, 'test-operator');
  assert.equal(details.approval_ref, 'test-approval');

  // Tombstone reactivation audit shape: old_version 0, activation reactivated.
  const tombstone = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 0,
    });
  });
  await executeApply(tombstone.db, toolInput());
  const reactivateAudit = tombstone.state.audits[0];
  const reactivateDetails = reactivateAudit.details as Record<string, unknown>;
  assert.equal(reactivateDetails.activation, 'reactivated');
  assert.equal(reactivateDetails.old_version, 0);
  assert.equal(reactivateDetails.new_version, 1);
  assert.equal(reactivateDetails.reason, APPLY_REASON);
});

test('precommit failure leaves grant row and audit unchanged', async () => {
  const handle = fixtureDatabase(() => {}, { failOnGrantCreate: 'simulated storage failure' });
  const result = await executeApply(handle.db, toolInput());
  assert.equal(result.outcome, 'PRECOMMIT_FAILED');
  assert.match(result.abortReason ?? '', /^PRECOMMIT_FAILURE:simulated storage failure$/);
  assert.equal(targetGrant(handle.state), undefined, 'no grant row survived');
  assert.deepEqual(handle.state.audits, [], 'no audit survived');
  assert.deepEqual(handle.writes, []);
});

test('unknown commit outcome stops everything: no retry, single transaction attempt', async () => {
  const handle = fixtureDatabase(() => {}, { rejectAfterCommit: true });
  const result = await executeApply(handle.db, toolInput());
  assert.equal(result.outcome, 'OUTCOME_UNKNOWN');
  assert.match(result.abortReason ?? '', /^COMMIT_OUTCOME_UNKNOWN:commit acknowledgement lost/);
  assert.equal(handle.transactionCount(), 1, 'exactly one transaction attempt; automatic retry is forbidden');
});

test('the apply gate refuses every spelling except explicit YES with operator metadata', () => {
  const refusalReason = (result: ReturnType<typeof checkApplyAuthorization>): string => {
    assert.equal(result.authorized, false);
    return result.authorized ? '' : result.reason;
  };
  assert.match(refusalReason(checkApplyAuthorization({})), /HR_SEND_GRANT_APPLY=YES/);
  assert.equal(checkApplyAuthorization({ [APPLY_ENV_GATE]: 'yes' }).authorized, false);
  assert.equal(checkApplyAuthorization({ [APPLY_ENV_GATE]: '1' }).authorized, false);
  assert.equal(checkApplyAuthorization({ [APPLY_ENV_GATE]: 'YES' }).authorized, false,
    'YES without operator metadata is refused');
  assert.equal(
    checkApplyAuthorization({ [APPLY_ENV_GATE]: 'YES', [OPERATOR_ENV]: 'op' }).authorized,
    false,
    'YES without approval_ref metadata is refused',
  );
  const authorized = checkApplyAuthorization({
    [APPLY_ENV_GATE]: 'YES',
    [OPERATOR_ENV]: 'op',
    HR_SEND_GRANT_APPROVAL_REF: 'ref-1',
  });
  assert.deepEqual(authorized, { authorized: true, operatorId: 'op', approvalRef: 'ref-1' });
});

test('nonce replay aborts; the audit entry stays nonce-unique', async () => {
  const handle = fixtureDatabase((state) => {
    state.audits.push({
      id: '99999999-9999-4999-8999-999999999999',
      eventType: APPLY_AUDIT_EVENT_TYPE,
      result: 'success',
      requestCorrelationId: FIXED_NONCE,
      details: {},
    });
  });
  const result = await applyInTransaction(handle.db, toolInput(), FIXED_NONCE);
  assert.equal(result.outcome, 'ABORT');
  assert.equal(result.abortReason, 'AUDIT_NONCE_REPLAY');
  assert.deepEqual(handle.writes, [], 'replay must not write');
  assert.equal(targetGrant(handle.state), undefined);
});

test('the guarded transaction takes its table locks and a distinct advisory lock key', async () => {
  const handle = fixtureDatabase();
  await executeApply(handle.db, toolInput());
  assert.ok(handle.rawQueries.includes('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE'));
  assert.ok(handle.rawQueries.includes('LOCK TABLE machine_clients IN SHARE MODE'));
  assert.ok(handle.rawQueries.includes('LOCK TABLE machine_principals IN SHARE MODE'));
  assert.ok(handle.rawQueries.includes('LOCK TABLE auth_audiences IN SHARE MODE'));
  assert.ok(handle.rawQueries.includes('LOCK TABLE auth_security_audits IN SHARE ROW EXCLUSIVE MODE'));
  assert.ok(handle.rawQueries.includes(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`));
  assert.equal(ADVISORY_LOCK_KEY, 813_947_206);
  for (const taken of [813_947_201, 813_947_202, 813_947_203, 813_947_204, 813_947_205]) {
    assert.notEqual(ADVISORY_LOCK_KEY, taken, 'advisory lock key must be distinct in the family');
  }
});

// ─── ACC-HRG-005: guarded rollback ──────────────────────────────────────────

test('rollback with exact postimage and nonce receipt tombstones the row atomically', async () => {
  const handle = fixtureDatabase();
  const apply = await executeApply(handle.db, toolInput());
  assert.ok(apply.receipt);
  const receipt = apply.receipt;
  // Receipt is durable/reparsable.
  const reparsed = JSON.parse(JSON.stringify(receipt)) as unknown;
  assert.doesNotThrow(() => parseApplyReceipt(reparsed));

  const writesBeforeRollback = handle.writes.length;
  const rollback = await executeRollback(handle.db, reparsed, {
    operatorId: 'rollback-operator',
    approvalRef: 'rollback-approval',
  });
  assert.equal(rollback.outcome, 'TOMBSTONED');
  assert.equal(rollback.refusalReason, null);
  assert.equal(rollback.classificationAfter, 'REACTIVATIBLE');

  const row = targetGrant(handle.state);
  assert.deepEqual(row && { scopes: row.scopes, version: row.version }, {
    scopes: [TARGET_SCOPE],
    version: 0,
  }, 'tombstone preserves scopes and identity, never deletes');

  assert.deepEqual(handle.writes.slice(writesBeforeRollback), [
    `machineAccessGrant.updateMany:${AUDIENCE_ID}:v1->v0`,
    `authSecurityAudit.create:${ROLLBACK_AUDIT_EVENT_TYPE}`,
  ], 'tombstone and its correlated audit are atomic');

  const rollbackAudit = handle.state.audits.find((entry) => entry.eventType === ROLLBACK_AUDIT_EVENT_TYPE);
  assert.ok(rollbackAudit);
  assert.equal(rollbackAudit.requestCorrelationId, rollback.nonce);
  const details = rollbackAudit.details as Record<string, unknown>;
  assert.deepEqual(Object.keys(details).sort(), [...AUDIT_DETAIL_KEYS].sort());
  assert.equal(details.reason, ROLLBACK_REASON, 'bounded rollback reason constant');
  assert.equal(details.migration_id, MIGRATION_ID);
  assert.equal(details.old_version, 1);
  assert.equal(details.new_version, 0);
  assert.equal(details.activation, 'tombstoned');
  assert.deepEqual(details.scopes, [TARGET_SCOPE]);
  assert.equal(details.client_uuid, HR_CLIENT_UUID);

  const after = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  assert.equal(after.classification, 'REACTIVATIBLE');
  assert.equal(after.unrelatedGrantDigest, apply.unrelatedGrantDigest);
});

test('rollback refuses NOOP receipts and never revokes accepted live NOOP rows', async () => {
  const noopHandle = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 1,
    });
  });
  const noopApply = await executeApply(noopHandle.db, toolInput());
  assert.equal(noopApply.outcome, 'NOOP');
  assert.throws(() => parseApplyReceipt(noopApply.receipt), /never revoked/);
  assert.deepEqual(noopHandle.writes, [], 'the NOOP round itself wrote nothing');

  // A forged CREATED receipt pointed at a live row without its activation
  // audit (the NOOP family) is refused before any write.
  const liveHandle = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 1,
    });
  });
  const rollback = await executeRollback(liveHandle.db, forgedCreatedReceipt(), toolInput());
  assert.equal(rollback.outcome, 'REFUSED');
  assert.equal(rollback.refusalReason, 'ACTIVATION_AUDIT_RECEIPT_MISSING');
  assert.deepEqual(liveHandle.writes, [], 'accepted live rows are never revoked');
  assert.equal(targetGrant(liveHandle.state)?.version, 1);
});

test('rollback refuses postimage drift with zero writes', async () => {
  const handle = fixtureDatabase();
  const apply = await executeApply(handle.db, toolInput());
  assert.ok(apply.receipt);

  // Concurrent version drift after apply.
  const versionDrift = targetGrant(handle.state);
  assert.ok(versionDrift);
  versionDrift.version = 2;
  const drifted = await executeRollback(handle.db, apply.receipt, toolInput());
  assert.equal(drifted.outcome, 'REFUSED');
  assert.equal(drifted.refusalReason, 'POSTIMAGE_DRIFT');
  assert.deepEqual(handle.writes.slice(2), [], 'drifted rows are never touched');
  assert.equal(targetGrant(handle.state)?.version, 2);

  // Scope drift after apply.
  const scopeHandle = fixtureDatabase();
  const scopeApply = await executeApply(scopeHandle.db, toolInput());
  const scopeRow = targetGrant(scopeHandle.state);
  assert.ok(scopeRow);
  scopeRow.scopes = [TARGET_SCOPE, 'agent.session.read'];
  const scopeDriftResult = await executeRollback(scopeHandle.db, scopeApply.receipt, toolInput());
  assert.equal(scopeDriftResult.outcome, 'REFUSED');
  assert.equal(scopeDriftResult.refusalReason, 'POSTIMAGE_DRIFT');
  assert.deepEqual(scopeRow.scopes, [TARGET_SCOPE, 'agent.session.read'], 'drift is preserved, not "fixed"');
});

test('rollback refuses missing or tampered activation audit receipts', async () => {
  const missing = fixtureDatabase();
  const missingApply = await executeApply(missing.db, toolInput());
  assert.ok(missingApply.receipt);
  const writesBeforeRollback = missing.writes.length;
  missing.state.audits.length = 0;
  const missingResult = await executeRollback(missing.db, missingApply.receipt, toolInput());
  assert.equal(missingResult.outcome, 'REFUSED');
  assert.equal(missingResult.refusalReason, 'ACTIVATION_AUDIT_RECEIPT_MISSING');
  assert.deepEqual(missing.writes.slice(writesBeforeRollback), [], 'refusal performs zero writes');
  assert.equal(targetGrant(missing.state)?.version, 1, 'the live row survives the refusal');

  const tampered = fixtureDatabase();
  const tamperedApply = await executeApply(tampered.db, toolInput());
  const tamperedAudit = tampered.state.audits.find((entry) => entry.eventType === APPLY_AUDIT_EVENT_TYPE);
  assert.ok(tamperedAudit);
  (tamperedAudit.details as Record<string, unknown>).client_uuid = '00000000-0000-4000-8000-000000000000';
  const tamperedResult = await executeRollback(tampered.db, tamperedApply.receipt, toolInput());
  assert.equal(tamperedResult.outcome, 'REFUSED');
  assert.equal(tamperedResult.refusalReason, 'ACTIVATION_AUDIT_RECEIPT_MISMATCH');
  assert.equal(targetGrant(tampered.state)?.version, 1, 'tampered receipts never revoke');

  const driftedIdentity = fixtureDatabase((state) => {
    state.principal = principalRow({ status: 'disabled' });
  });
  const driftedApply = await executeRollback(
    driftedIdentity.db,
    forgedCreatedReceipt(),
    toolInput(),
  );
  assert.equal(driftedIdentity.state.audits.length, 0, 'nothing was written by this refusal path');
  assert.equal(driftedApply.outcome, 'REFUSED');
  assert.equal(driftedApply.refusalReason, 'IDENTITY_DRIFT');
});

// ─── Verify (readback) ──────────────────────────────────────────────────────

test('verify passes after apply and fails closed on any deviation', async () => {
  const handle = fixtureDatabase();
  const before = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  const apply = await executeApply(handle.db, toolInput());
  assert.equal(apply.outcome, 'CREATED');

  const pass = await verifyGrant(handle.db, {
    suppliedClientId: HR_PUBLIC_CLIENT_ID,
    expectedUnrelatedDigest: before.unrelatedGrantDigest ?? undefined,
  });
  assert.equal(pass.outcome, 'PASS');
  assert.equal(pass.failureReason, null);
  assert.equal(pass.classification, 'LIVE_NOOP');
  assert.equal(pass.audience, 'EXACT');

  const digestDrift = await verifyGrant(handle.db, {
    suppliedClientId: HR_PUBLIC_CLIENT_ID,
    expectedUnrelatedDigest: 'f'.repeat(64),
  });
  assert.equal(digestDrift.outcome, 'FAIL');
  assert.equal(digestDrift.failureReason, 'UNRELATED_DIGEST_CHANGED');

  // A refused rollback attempt against the live exact row leaves it untouched.
  const liveHandle = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 1,
    });
  });
  const noopApply = await executeApply(liveHandle.db, toolInput());
  assert.equal(noopApply.outcome, 'NOOP');
  const refused = await executeRollback(liveHandle.db, noopApply.receipt, toolInput());
  assert.equal(refused.outcome, 'REFUSED');
  assert.match(refused.refusalReason ?? '', /NOOP/);
  const stillPass = await verifyGrant(liveHandle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  assert.equal(stillPass.outcome, 'PASS', 'the live exact row survives a refused NOOP rollback untouched');
});

test('verify fails on tombstone and on absent rows', async () => {
  const tombstone = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_UUID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 0,
    });
  });
  const tombstoneVerify = await verifyGrant(tombstone.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  assert.equal(tombstoneVerify.outcome, 'FAIL');
  assert.equal(tombstoneVerify.failureReason, 'GRANT_NOT_LIVE_EXACT:REACTIVATIBLE');
  assert.equal(tombstoneVerify.classification, 'REACTIVATIBLE');

  const absent = fixtureDatabase();
  const absentVerify = await verifyGrant(absent.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  assert.equal(absentVerify.outcome, 'FAIL');
  assert.equal(absentVerify.failureReason, 'GRANT_NOT_LIVE_EXACT:ABSENT');
});

// ─── Secret hygiene ─────────────────────────────────────────────────────────

test('no secret, token, credential, or connection-string value appears in any output', async () => {
  const handle = fixtureDatabase();
  const plan = await planGrant(handle.db, { suppliedClientId: HR_PUBLIC_CLIENT_ID });
  const apply = await executeApply(handle.db, toolInput());
  const receipt = apply.receipt;
  assert.ok(receipt);
  const serialized = JSON.stringify({ plan: plan.planDocument, apply, receipt }).toLowerCase();
  for (const forbidden of [
    'secret', 'token', 'password', 'credential', 'private_key', 'clientsecret',
    'secret_hash', 'database_url', 'postgresql://',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `forbidden string: ${forbidden}`);
  }
});
