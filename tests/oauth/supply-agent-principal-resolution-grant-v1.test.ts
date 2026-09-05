/**
 * Focused fixture-adapter tests for the controlled one-tuple HR read Grant
 * vehicle (AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1, CTR-EAPR-005,
 * ACC-EAPR-005 authoring scope).
 *
 * No network, no real database: every scenario runs against an in-memory
 * fixture adapter, including the ambiguous-binding abort path. No secret,
 * hash or credential value exists anywhere in these fixtures.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLY_REASON,
  AUDIENCE_ID,
  FIXED_PRINCIPAL_ID,
  LEGACY_PRINCIPAL_ID,
  MIGRATION_ID,
  TARGET_SCOPE,
  applyGrant,
  checkApplyAuthorization,
  planGrant,
  verifyGrant,
  type GrantPlan,
  type ProvisionGrantDatabase,
  type ToolAudienceRow,
  type ToolClientRow,
  type ToolGrantRow,
  type ToolInput,
  type ToolPrincipalRow,
} from '../../scripts/supply-agent-principal-resolution-grant-v1.js';

const HR_PUBLIC_CLIENT_ID = 'hr-public-client';
const HR_CLIENT_INTERNAL_ID = '77000000-0000-4000-8000-000000000001';

function principalRow(overrides: Partial<ToolPrincipalRow> = {}): ToolPrincipalRow {
  return {
    id: FIXED_PRINCIPAL_ID,
    principalType: 'agent',
    status: 'active',
    agentId: 'agt_hr-agent',
    ...overrides,
  };
}

function audienceRow(overrides: Partial<ToolAudienceRow> = {}): ToolAudienceRow {
  return {
    audienceId: AUDIENCE_ID,
    resourceService: 'svc-auth',
    scopeNamespace: 'auth',
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
  audiences: Map<string, ToolAudienceRow>;
  principal: ToolPrincipalRow | null;
  clients: ToolClientRow[];
  grants: ToolGrantRow[];
  audits: Array<{ id: string; migrationId: string; clientId: string; changeType: string }>;
}

interface FixtureHandle {
  db: ProvisionGrantDatabase;
  state: FixtureState;
  writes: string[];
}

function fixtureDatabase(
  configure: (state: FixtureState) => void = () => {},
): FixtureHandle {
  const state: FixtureState = {
    audiences: new Map(),
    principal: principalRow(),
    clients: [
      { id: HR_CLIENT_INTERNAL_ID, clientId: HR_PUBLIC_CLIENT_ID, status: 'active' },
    ],
    grants: [
      // One unrelated pre-existing grant — its preservation is part of the deal.
      {
        machineClientId: 'another-client-internal',
        audienceId: 'agent-session-messaging',
        scopes: ['agent.session.send'],
        version: 1,
      },
    ],
    audits: [],
  };
  configure(state);

  const writes: string[] = [];
  const db: ProvisionGrantDatabase = {
    authAudience: {
      async findUnique({ where }) {
        return state.audiences.get(where.audienceId) ?? null;
      },
      async create({ data }) {
        writes.push(`authAudience.create:${data.audienceId}`);
        state.audiences.set(data.audienceId, { ...data });
        return data;
      },
    },
    machinePrincipal: {
      async findUnique({ where }) {
        return state.principal && state.principal.id === where.id ? state.principal : null;
      },
    },
    machineClient: {
      async findMany() {
        // Fixture model: state.clients is exactly the set bound to the fixed principal.
        return state.clients.map((client) => ({ ...client }));
      },
    },
    machineAccessGrant: {
      async findUnique({ where }) {
        const key = `${where.machineClientId_audienceId.machineClientId}\0${where.machineClientId_audienceId.audienceId}`;
        return state.grants.find((grant) => `${grant.machineClientId}\0${grant.audienceId}` === key) ?? null;
      },
      async findMany() {
        return state.grants.map((grant) => ({ ...grant }));
      },
      async create({ data }) {
        writes.push(`machineAccessGrant.create:${data.audienceId}:${data.scopes.join(',')}@v${data.version}`);
        const row: ToolGrantRow = {
          machineClientId: data.machineClientId,
          audienceId: data.audienceId,
          scopes: [...data.scopes],
          version: data.version,
        };
        state.grants.push(row);
        return row;
      },
    },
    grantChangeAudit: {
      async findFirst({ where }) {
        return state.audits.find((audit) => audit.migrationId === where.migrationId
          && audit.clientId === where.clientId
          && audit.changeType === where.changeType) ?? null;
      },
      async create({ data }) {
        writes.push(`grantChangeAudit.create:${data.clientId}:${data.changeType}`);
        const id = `audit-${state.audits.length + 1}`;
        state.audits.push({ id, migrationId: data.migrationId, clientId: data.clientId, changeType: data.changeType });
        return { id };
      },
    },
    async $transaction(fn) {
      return fn(db);
    },
  };
  return { db, state, writes };
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

function isHex64(value: string | null): boolean {
  return value !== null && /^[0-9a-f]{64}$/.test(value);
}

// ─── Plan (read-only preimage) ──────────────────────────────────────────────

test('plan classifies a clean CREATE preimage with a stable unrelated digest', async () => {
  const handle = fixtureDatabase();
  const plan: GrantPlan = await planGrant(handle.db, toolInput());
  assert.equal(plan.outcome, 'CREATE');
  assert.equal(plan.abortReason, null);
  assert.equal(plan.audience, 'ABSENT');
  assert.deepEqual(plan.principal, { found: true, principalType: 'agent', status: 'active' });
  assert.deepEqual(plan.binding, {
    activeClientCount: 1,
    uniqueActiveClientId: HR_PUBLIC_CLIENT_ID,
    matchesSuppliedClientId: true,
  });
  assert.equal(plan.grant, 'ABSENT');
  assert.ok(isHex64(plan.unrelatedGrantDigest));
  // Deterministic across runs on identical state.
  const again = await planGrant(handle.db, toolInput());
  assert.equal(again.unrelatedGrantDigest, plan.unrelatedGrantDigest);
  assert.deepEqual(handle.writes, [], 'plan performs zero writes');
});

test('plan classifies an already-live exact tuple as NOOP', async () => {
  const handle = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_INTERNAL_ID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 1,
    });
  });
  const plan = await planGrant(handle.db, toolInput());
  assert.equal(plan.outcome, 'NOOP');
  assert.equal(plan.grant, 'LIVE_EXACT');
});

test('plan aborts when the fixed principal is missing, non-agent, or disabled', async () => {
  const missing = fixtureDatabase((state) => {
    state.principal = null;
  });
  assert.deepEqual(await planGrant(missing.db, toolInput()), {
    outcome: 'ABORT',
    abortReason: 'PRINCIPAL_NOT_FOUND',
    audience: 'ABSENT',
    principal: { found: false, principalType: null, status: null },
    binding: { activeClientCount: 0, uniqueActiveClientId: null, matchesSuppliedClientId: false },
    grant: 'ABSENT',
    unrelatedGrantDigest: null,
  } satisfies GrantPlan);

  const service = fixtureDatabase((state) => {
    state.principal = principalRow({ principalType: 'service', agentId: null });
  });
  const servicePlan = await planGrant(service.db, toolInput());
  assert.equal(servicePlan.outcome, 'ABORT');
  assert.equal(servicePlan.abortReason, 'PRINCIPAL_NOT_AGENT');

  const disabled = fixtureDatabase((state) => {
    state.principal = principalRow({ status: 'disabled' });
  });
  const disabledPlan = await planGrant(disabled.db, toolInput());
  assert.equal(disabledPlan.outcome, 'ABORT');
  assert.equal(disabledPlan.abortReason, 'PRINCIPAL_DISABLED');
});

test('plan aborts on the ambiguous active-client binding path', async () => {
  const handle = fixtureDatabase((state) => {
    state.clients = [
      { id: HR_CLIENT_INTERNAL_ID, clientId: HR_PUBLIC_CLIENT_ID, status: 'active' },
      { id: '88000000-0000-4000-8000-000000000002', clientId: 'hr-public-client-2', status: 'active' },
    ];
  });
  const plan = await planGrant(handle.db, toolInput());
  assert.equal(plan.outcome, 'ABORT');
  assert.equal(plan.abortReason, 'AMBIGUOUS_BINDING');
  assert.deepEqual(handle.writes, []);
});

test('plan aborts when the supplied public client id does not match the unique binding', async () => {
  const handle = fixtureDatabase();
  const plan = await planGrant(handle.db, toolInput({ suppliedClientId: 'mc_some_other_client' }));
  assert.equal(plan.outcome, 'ABORT');
  assert.equal(plan.abortReason, 'CLIENT_MISMATCH');
  assert.deepEqual(handle.writes, []);
});

test('plan aborts on drifted audience, conflicting grant, tombstone, and audit replay', async () => {
  const drifted = fixtureDatabase((state) => {
    state.audiences.set(AUDIENCE_ID, audienceRow({ registeredScopes: [TARGET_SCOPE, 'auth.agent.read'] }));
  });
  assert.equal((await planGrant(drifted.db, toolInput())).abortReason, 'AUDIENCE_DRIFTED');

  const conflict = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_INTERNAL_ID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE, 'workflow.read'],
      version: 3,
    });
  });
  const conflictPlan = await planGrant(conflict.db, toolInput());
  assert.equal(conflictPlan.outcome, 'ABORT');
  assert.equal(conflictPlan.abortReason, 'GRANT_CONFLICT');

  const tombstone = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_INTERNAL_ID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 0,
    });
  });
  const tombstonePlan = await planGrant(tombstone.db, toolInput());
  assert.equal(tombstonePlan.outcome, 'ABORT');
  assert.equal(tombstonePlan.abortReason, 'GRANT_TOMBSTONED_REACTIVATION_NOT_AUTHORIZED');

  const replay = fixtureDatabase((state) => {
    state.audits.push({
      id: 'audit-1',
      migrationId: MIGRATION_ID,
      clientId: HR_PUBLIC_CLIENT_ID,
      changeType: 'create',
    });
  });
  const replayPlan = await planGrant(replay.db, toolInput());
  assert.equal(replayPlan.outcome, 'ABORT');
  assert.equal(replayPlan.abortReason, 'AUDIT_REPLAY');
});

// ─── Apply (single guarded transaction) ─────────────────────────────────────

test('apply materializes the audience row, inserts the exact tuple, and audits in one transaction', async () => {
  const handle = fixtureDatabase();
  const before = await planGrant(handle.db, toolInput());
  const result = await applyGrant(handle.db, toolInput());
  assert.equal(result.outcome, 'CREATED');
  assert.equal(result.abortReason, null);
  assert.equal(result.resultingGrantVersion, 1);
  assert.ok(result.auditChangeId);
  assert.equal(result.unrelatedGrantDigest, before.unrelatedGrantDigest, 'unrelated grants are untouched');

  assert.deepEqual(handle.writes, [
    `authAudience.create:${AUDIENCE_ID}`,
    `machineAccessGrant.create:${AUDIENCE_ID}:${TARGET_SCOPE}@v1`,
    `grantChangeAudit.create:${HR_PUBLIC_CLIENT_ID}:create`,
  ], 'audience materialization, grant tuple, and audit share one transaction');

  const created = await planGrant(handle.db, toolInput());
  assert.equal(created.audience, 'EXACT');
  assert.equal(created.grant, 'LIVE_EXACT');
  assert.equal(created.outcome, 'NOOP');
});

test('apply rerun over the exact live tuple is a write-free NOOP', async () => {
  const handle = fixtureDatabase((state) => {
    state.audiences.set(AUDIENCE_ID, audienceRow());
    state.grants.push({
      machineClientId: HR_CLIENT_INTERNAL_ID,
      audienceId: AUDIENCE_ID,
      scopes: [TARGET_SCOPE],
      version: 1,
    });
  });
  const result = await applyGrant(handle.db, toolInput());
  assert.equal(result.outcome, 'NOOP');
  assert.deepEqual(handle.writes, [], 'NOOP must not write a second audit or row');
});

test('apply aborts fail-closed with zero partial writes on any drift', async () => {
  const ambiguous = fixtureDatabase((state) => {
    state.clients.push({ id: '99000000-0000-4000-8000-000000000003', clientId: 'hr-public-client-2', status: 'active' });
  });
  const ambiguousResult = await applyGrant(ambiguous.db, toolInput());
  assert.equal(ambiguousResult.outcome, 'ABORT');
  assert.equal(ambiguousResult.abortReason, 'AMBIGUOUS_BINDING');
  assert.deepEqual(ambiguous.writes, [], 'no partial write may survive the abort');

  const conflict = fixtureDatabase((state) => {
    state.grants.push({
      machineClientId: HR_CLIENT_INTERNAL_ID,
      audienceId: AUDIENCE_ID,
      scopes: ['auth.agent.read'],
      version: 1,
    });
  });
  const conflictResult = await applyGrant(conflict.db, toolInput());
  assert.equal(conflictResult.outcome, 'ABORT');
  assert.equal(conflictResult.abortReason, 'GRANT_CONFLICT');
  assert.deepEqual(conflict.writes, []);

  const drifted = fixtureDatabase((state) => {
    state.audiences.set(AUDIENCE_ID, audienceRow({ machineAccessEnabled: false }));
  });
  const driftedResult = await applyGrant(drifted.db, toolInput());
  assert.equal(driftedResult.outcome, 'ABORT');
  assert.equal(driftedResult.abortReason, 'AUDIENCE_DRIFTED');
  assert.deepEqual(drifted.writes, []);
});

// ─── Verify (readback) ──────────────────────────────────────────────────────

test('verify passes after apply and fails closed on any deviation', async () => {
  const handle = fixtureDatabase();
  const before = await planGrant(handle.db, toolInput());
  await applyGrant(handle.db, toolInput());

  const pass = await verifyGrant(handle.db, toolInput());
  assert.equal(pass.outcome, 'PASS');
  assert.equal(pass.audience, 'EXACT');
  assert.equal(pass.grant, 'LIVE_EXACT');
  assert.equal(pass.unrelatedGrantDigest, before.unrelatedGrantDigest);

  const digestDrift = await verifyGrant(handle.db, {
    ...toolInput(),
    expectedUnrelatedDigest: 'f'.repeat(64),
  });
  assert.equal(digestDrift.outcome, 'FAIL');
  assert.equal(digestDrift.failureReason, 'UNRELATED_DIGEST_CHANGED');

  const rollbackState = fixtureDatabase();
  const fail = await verifyGrant(rollbackState.db, toolInput());
  assert.equal(fail.outcome, 'FAIL');
  assert.equal(fail.failureReason, 'AUDIENCE_ABSENT');
});

// ─── Apply gate and audit envelope shape ────────────────────────────────────

test('the apply gate refuses every spelling except the explicit YES', () => {
  assert.equal(checkApplyAuthorization({}).authorized, false);
  assert.equal(checkApplyAuthorization({ AGENT_PRINCIPAL_RESOLUTION_GRANT_V1_APPLY: 'yes' }).authorized, false);
  assert.equal(checkApplyAuthorization({ AGENT_PRINCIPAL_RESOLUTION_GRANT_V1_APPLY: '1' }).authorized, false);
  assert.equal(checkApplyAuthorization({ AGENT_PRINCIPAL_RESOLUTION_GRANT_V1_APPLY: 'YES' }).authorized, true);
});

test('no secret, token, hash, or credential value ever appears in plan or apply output', async () => {
  const handle = fixtureDatabase();
  const plan = await planGrant(handle.db, toolInput());
  const apply = await applyGrant(handle.db, toolInput());
  const serialized = JSON.stringify({ plan, apply }).toLowerCase();
  for (const forbidden of ['secret', 'token', 'password', 'credential', 'private_key', 'clientsecret', 'secret_hash']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});


test('wrong-target: the legacy HR Principal is never selected as the read-grant recipient (V2 subject correction)', async () => {
  // A database where ONLY the legacy Principal exists: the plan looks up the
  // exact current business Principal UUID and must find nothing — the legacy
  // row is never consulted and never receives the read Grant.
  const legacyOnly = fixtureDatabase((state) => {
    state.principal = { ...principalRow(), id: LEGACY_PRINCIPAL_ID, agentId: 'hr-agent' };
  });
  const legacyOnlyPlan = await planGrant(legacyOnly.db, toolInput());
  assert.equal(legacyOnlyPlan.outcome, 'ABORT');
  assert.equal(legacyOnlyPlan.abortReason, 'PRINCIPAL_NOT_FOUND');
  assert.deepEqual(legacyOnly.writes, [], 'wrong-target abort performs zero writes');
});
