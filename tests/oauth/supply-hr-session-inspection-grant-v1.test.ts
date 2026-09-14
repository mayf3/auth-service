import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADVISORY_LOCK_KEY,
  AGENT_ID,
  APPLY_AUDIT_REASON,
  AUDIENCE_ID,
  BUNDLE_VERSION,
  INSPECT_SCOPE,
  PRINCIPAL_ID,
  ROLLBACK_AUDIT_REASON,
  SEND_SCOPE,
  SOURCE_SCOPES,
  TARGET_SCOPES,
  applyGrant,
  planGrant,
  projectTokenClaims,
  reconcileGrant,
  rollbackGrant,
  verifyGrant,
  type GrantDatabase,
  type GrantRow,
  type GrantToolInput,
  type SecurityAuditRow,
} from '../../scripts/supply-hr-session-inspection-grant-v1.js';

const CLIENT_UUID = '77000000-0000-4000-8000-000000000001';
const CLIENT_ID = 'hr-broker-bound-client';
const OTHER_CLIENT_UUID = '66000000-0000-4000-8000-00000000000e';
const NONCE = '11111111-1111-4111-8111-111111111111';
const SOURCE_COMMIT = 'a'.repeat(40);

type Principal = {
  id: string;
  principalType: string;
  status: string;
  disabledAt: Date | null;
  agentId: string | null;
};
type Client = { id: string; clientId: string; status: string; revokedAt: Date | null };
type Audience = {
  audienceId: string;
  resourceService: string;
  scopeNamespace: string;
  acceptedPrincipalTypes: string[];
  registeredScopes: string[];
  humanAccessEnabled: boolean;
  machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean;
  status: string;
  freezeReady: boolean;
  version: number;
};
type State = {
  principal: Principal | null;
  clients: Client[];
  audience: Audience | null;
  grants: GrantRow[];
  audits: SecurityAuditRow[];
};
type Behavior = { failAuditCreate?: boolean; rejectAfterCommit?: boolean };

function audience(overrides: Partial<Audience> = {}): Audience {
  return {
    audienceId: AUDIENCE_ID,
    resourceService: AUDIENCE_ID,
    scopeNamespace: 'agent',
    acceptedPrincipalTypes: ['agent'],
    registeredScopes: [...TARGET_SCOPES],
    humanAccessEnabled: false,
    machineAccessEnabled: true,
    delegatedAccessEnabled: false,
    status: 'active',
    freezeReady: true,
    version: 1,
    ...overrides,
  };
}

function sourceGrant(): GrantRow {
  return { machineClientId: CLIENT_UUID, audienceId: AUDIENCE_ID, scopes: [...SOURCE_SCOPES], version: 1 };
}

function baseState(): State {
  return {
    principal: {
      id: PRINCIPAL_ID,
      principalType: 'agent',
      status: 'active',
      disabledAt: null,
      agentId: AGENT_ID,
    },
    clients: [{ id: CLIENT_UUID, clientId: CLIENT_ID, status: 'active', revokedAt: null }],
    audience: audience(),
    grants: [
      sourceGrant(),
      { machineClientId: CLIENT_UUID, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 },
      { machineClientId: OTHER_CLIENT_UUID, audienceId: AUDIENCE_ID, scopes: [SEND_SCOPE], version: 7 },
    ],
    audits: [],
  };
}

function cloneState(state: State): State {
  return structuredClone(state);
}

function fixture(configure: (state: State) => void = () => {}, behavior: Behavior = {}) {
  const state = baseState();
  configure(state);
  const writes: string[] = [];
  const rawQueries: string[] = [];
  let transactions = 0;

  const makeDb = (): GrantDatabase => ({
    machinePrincipal: {
      async findUnique({ where }) {
        return state.principal?.id === where.id ? structuredClone(state.principal) : null;
      },
    },
    machineClient: {
      async findMany() { return structuredClone(state.clients); },
    },
    authAudience: {
      async findUnique({ where }) {
        return state.audience?.audienceId === where.audienceId ? structuredClone(state.audience) : null;
      },
    },
    machineAccessGrant: {
      async findUnique({ where }) {
        const key = where.machineClientId_audienceId;
        const row = state.grants.find((grant) => grant.machineClientId === key.machineClientId
          && grant.audienceId === key.audienceId);
        return row ? structuredClone(row) : null;
      },
      async findMany() { return structuredClone(state.grants); },
      async updateMany({ where, data }) {
        const row = state.grants.find((grant) => grant.machineClientId === where.machineClientId
          && grant.audienceId === where.audienceId);
        if (!row || row.version !== where.version
            || JSON.stringify([...row.scopes].sort()) !== JSON.stringify([...where.scopes.equals].sort())) {
          return { count: 0 };
        }
        writes.push(`grant:${row.version}->${data.version}:${data.scopes.join(',')}`);
        row.version = data.version;
        row.scopes = [...data.scopes];
        return { count: 1 };
      },
    },
    grantChangeAudit: {
      async findMany({ where }) {
        return structuredClone(state.audits.filter((row) => row.migrationId === where.migrationId
          && row.clientId === where.clientId));
      },
      async create({ data }) {
        if (behavior.failAuditCreate) throw new Error('simulated audit fault');
        writes.push(`audit:${data.migrationId}:${data.changeType}`);
        const row = { ...structuredClone(data), timestamp: new Date('2026-09-14T12:00:00.000Z') };
        state.audits.push(row);
        return structuredClone(row);
      },
    },
    async $executeRaw(query) { rawQueries.push(query); return 0; },
    async $transaction(fn) {
      transactions += 1;
      const before = cloneState(state);
      const writesBefore = [...writes];
      try {
        const result = await fn(makeDb());
        if (behavior.rejectAfterCommit) throw new Error('commit acknowledgement lost');
        return result;
      } catch (error) {
        if (!behavior.rejectAfterCommit) {
          Object.assign(state, before);
          writes.splice(0, writes.length, ...writesBefore);
        }
        throw error;
      }
    },
  });

  return { db: makeDb(), state, writes, rawQueries, transactions: () => transactions };
}

function planInput(overrides: Record<string, unknown> = {}) {
  return { suppliedClientId: CLIENT_ID, bundleVersion: BUNDLE_VERSION, nonce: NONCE, ...overrides };
}

async function applyInput(db: GrantDatabase): Promise<GrantToolInput> {
  const plan = await planGrant(db, planInput());
  assert.equal(plan.outcome, 'APPLY');
  return {
    suppliedClientId: CLIENT_ID,
    bundleVersion: BUNDLE_VERSION,
    nonce: NONCE,
    planSha256: plan.planSha256,
    preimageDigest: plan.preimageDigest!,
    bystanderDigest: plan.bystanderDigest!,
    operatorId: 'test-operator',
    approvalRef: 'OWNER_ACCEPTED_TEST',
    sourceGitCommit: SOURCE_COMMIT,
    environment: 'fixture',
  };
}

function bystanderProjection(state: State): unknown {
  return state.grants
    .filter((row) => !(row.machineClientId === CLIENT_UUID && row.audienceId === AUDIENCE_ID))
    .map((row) => structuredClone(row));
}

test('source @v1 plans the only legal v1 send-only to v2 combined replacement', async () => {
  const { db, writes } = fixture();
  const plan = await planGrant(db, planInput());
  assert.equal(plan.outcome, 'APPLY');
  assert.equal(plan.classification, 'SOURCE');
  assert.equal(plan.principalId, PRINCIPAL_ID);
  assert.equal(plan.agentId, AGENT_ID);
  assert.equal(plan.clientId, CLIENT_ID);
  assert.deepEqual(plan.source, { scopes: [SEND_SCOPE], version: 1 });
  assert.deepEqual(plan.target, { scopes: [INSPECT_SCOPE, SEND_SCOPE], version: 2 });
  assert.match(plan.planSha256, /^[0-9a-f]{64}$/);
  assert.match(plan.preimageDigest!, /^[0-9a-f]{64}$/);
  assert.match(plan.bystanderDigest!, /^[0-9a-f]{64}$/);
  assert.deepEqual(writes, []);
});

test('every identity, audience, bundle, and source-prestate mismatch fails closed', async (t) => {
  const cases: Array<[string, (state: State) => void, Record<string, unknown>, string]> = [
    ['missing principal', (s) => { s.principal = null; }, {}, 'PRINCIPAL_NOT_FOUND'],
    ['wrong principal type', (s) => { s.principal!.principalType = 'service'; }, {}, 'PRINCIPAL_NOT_AGENT'],
    ['disabled principal', (s) => { s.principal!.status = 'disabled'; }, {}, 'PRINCIPAL_DISABLED'],
    ['wrong canonical agent', (s) => { s.principal!.agentId = 'hr-agent'; }, {}, 'PRINCIPAL_AGENT_ID_MISMATCH'],
    ['no active client', (s) => { s.clients[0].status = 'revoked'; }, {}, 'NO_ACTIVE_CLIENT'],
    ['ambiguous client', (s) => { s.clients.push({ ...s.clients[0], id: OTHER_CLIENT_UUID }); }, {}, 'AMBIGUOUS_BINDING'],
    ['wrong supplied client', () => {}, { suppliedClientId: 'different-client' }, 'CLIENT_MISMATCH'],
    ['missing audience', (s) => { s.audience = null; }, {}, 'AUDIENCE_ABSENT'],
    ['audience scope drift', (s) => { s.audience!.registeredScopes = [SEND_SCOPE]; }, {}, 'AUDIENCE_DRIFTED'],
    ['bundle drift', () => {}, { bundleVersion: '1.11.0' }, 'BUNDLE_VERSION_MISMATCH'],
    ['missing grant', (s) => { s.grants = s.grants.filter((g) => g.audienceId !== AUDIENCE_ID || g.machineClientId !== CLIENT_UUID); }, {}, 'GRANT_CONFLICT'],
    ['extra source scope', (s) => { s.grants[0].scopes.push('agent.session.admin'); }, {}, 'GRANT_CONFLICT'],
    ['wrong source version', (s) => { s.grants[0].version = 0; }, {}, 'GRANT_CONFLICT'],
  ];
  for (const [name, configure, overrides, reason] of cases) {
    await t.test(name, async () => {
      const { db, writes } = fixture(configure);
      const plan = await planGrant(db, planInput(overrides));
      assert.equal(plan.outcome, 'CONFLICT');
      assert.equal(plan.reason, reason);
      assert.deepEqual(writes, []);
    });
  }
});

test('apply uses one Serializable transaction, exact CAS, closed audit, and preserves bystanders', async () => {
  const handle = fixture();
  const bystandersBefore = bystanderProjection(handle.state);
  const input = await applyInput(handle.db);
  const result = await applyGrant(handle.db, input);
  assert.equal(result.outcome, 'APPLIED');
  assert.equal(handle.transactions(), 1);
  assert.ok(handle.rawQueries.some((query) => query.includes(String(ADVISORY_LOCK_KEY))));
  assert.deepEqual(handle.state.grants[0], {
    machineClientId: CLIENT_UUID,
    audienceId: AUDIENCE_ID,
    scopes: [INSPECT_SCOPE, SEND_SCOPE],
    version: 2,
  });
  assert.deepEqual(bystanderProjection(handle.state), bystandersBefore);
  assert.equal(handle.state.audits.length, 1);
  const audit = handle.state.audits[0];
  assert.equal(audit.changeType, 'replace');
  assert.equal(audit.expectedGrantVersion, 1);
  assert.equal(audit.resultingGrantVersion, 2);
  assert.equal(audit.reason, APPLY_AUDIT_REASON);
  assert.deepEqual(Object.keys(audit.beforeValue as object).sort(), [
    'agent_id', 'audience', 'bystander_digest', 'client_id', 'client_uuid',
    'preimage_digest', 'principal_id', 'scopes', 'version',
  ]);
  assert.deepEqual(Object.keys(audit.afterValue as object).sort(), [
    'agent_id', 'audience', 'bystander_digest', 'client_id', 'client_uuid',
    'postimage_digest', 'principal_id', 'scopes', 'version',
  ]);
  assert.equal(result.receipt?.attempts, 1);
  assert.equal(result.receipt?.retry_attempted, false);
});

test('exact target plus its unique exact audit is a zero-write NOOP', async () => {
  const handle = fixture();
  const applied = await applyGrant(handle.db, await applyInput(handle.db));
  assert.equal(applied.outcome, 'APPLIED');
  handle.writes.splice(0);
  const plan = await planGrant(handle.db, planInput({ nonce: '22222222-2222-4222-8222-222222222222' }));
  assert.equal(plan.outcome, 'NOOP');
  assert.equal(plan.classification, 'TARGET');
  const rerun = await applyGrant(handle.db, {
    ...(await applyInputForPlan(plan)),
  });
  assert.equal(rerun.outcome, 'NOOP');
  assert.deepEqual(handle.writes, []);
  assert.equal(handle.state.audits.length, 1);
});

async function applyInputForPlan(plan: Awaited<ReturnType<typeof planGrant>>): Promise<GrantToolInput> {
  return {
    suppliedClientId: CLIENT_ID,
    bundleVersion: BUNDLE_VERSION,
    nonce: plan.nonce,
    planSha256: plan.planSha256,
    preimageDigest: plan.preimageDigest!,
    bystanderDigest: plan.bystanderDigest!,
    operatorId: 'test-operator',
    approvalRef: 'OWNER_ACCEPTED_TEST',
    sourceGitCommit: SOURCE_COMMIT,
    environment: 'fixture',
  };
}

test('target without exactly one valid governed audit conflicts with zero writes', async (t) => {
  const exact = fixture();
  await applyGrant(exact.db, await applyInput(exact.db));
  const validAudit = structuredClone(exact.state.audits[0]);
  const cases: Array<[string, (state: State) => void]> = [
    ['missing audit', (s) => { s.grants[0].scopes = [...TARGET_SCOPES]; s.grants[0].version = 2; }],
    ['duplicate audit', (s) => { s.grants[0].scopes = [...TARGET_SCOPES]; s.grants[0].version = 2; s.audits = [validAudit, { ...validAudit, id: '22222222-2222-4222-8222-222222222222' }]; }],
    ['wrong audit', (s) => { s.grants[0].scopes = [...TARGET_SCOPES]; s.grants[0].version = 2; s.audits = [{ ...validAudit, resultingGrantVersion: 99 }]; }],
  ];
  for (const [name, configure] of cases) {
    await t.test(name, async () => {
      const handle = fixture(configure);
      const plan = await planGrant(handle.db, planInput());
      assert.equal(plan.outcome, 'CONFLICT');
      assert.equal(plan.reason, 'TARGET_AUDIT_CONFLICT');
      assert.deepEqual(handle.writes, []);
    });
  }
});

test('stale plan or bystander drift aborts before row mutation', async (t) => {
  for (const kind of ['plan', 'preimage', 'bystander'] as const) {
    await t.test(kind, async () => {
      const handle = fixture();
      const input = await applyInput(handle.db);
      if (kind === 'plan') input.planSha256 = '0'.repeat(64);
      if (kind === 'preimage') input.preimageDigest = '0'.repeat(64);
      if (kind === 'bystander') {
        handle.state.grants[1].scopes = ['workflow.read', 'workflow.execute'];
      }
      const result = await applyGrant(handle.db, input);
      assert.equal(result.outcome, 'CONFLICT');
      assert.deepEqual(handle.writes, []);
    });
  }
});

test('audit fault rolls the Grant mutation back atomically', async () => {
  const handle = fixture(() => {}, { failAuditCreate: true });
  const result = await applyGrant(handle.db, await applyInput(handle.db));
  assert.equal(result.outcome, 'PRECOMMIT_FAILED');
  assert.deepEqual(handle.state.grants[0], sourceGrant());
  assert.equal(handle.state.audits.length, 0);
  assert.deepEqual(handle.writes, []);
});

test('lost commit acknowledgement reports OUTCOME_UNKNOWN once and reconciles read-only', async () => {
  const handle = fixture(() => {}, { rejectAfterCommit: true });
  const result = await applyGrant(handle.db, await applyInput(handle.db));
  assert.equal(result.outcome, 'OUTCOME_UNKNOWN');
  assert.equal(result.retryAttempted, false);
  assert.equal(handle.transactions(), 1);
  const writesBefore = [...handle.writes];
  const reconciled = await reconcileGrant(handle.db, planInput({ nonce: '33333333-3333-4333-8333-333333333333' }));
  assert.equal(reconciled.state, 'TARGET_EXACT_AUDIT');
  assert.deepEqual(handle.writes, writesBefore);
});

test('forward rollback replaces only exact v2 with v3 send-only and appends a separate audit', async () => {
  const handle = fixture();
  const applied = await applyGrant(handle.db, await applyInput(handle.db));
  assert.equal(applied.outcome, 'APPLIED');
  const bystandersBefore = bystanderProjection(handle.state);
  const rolledBack = await rollbackGrant(handle.db, applied.receipt, {
    operatorId: 'rollback-operator',
    approvalRef: 'KNOWN_VERIFICATION_FAILURE',
  });
  assert.equal(rolledBack.outcome, 'ROLLED_BACK');
  assert.deepEqual(handle.state.grants[0], {
    machineClientId: CLIENT_UUID,
    audienceId: AUDIENCE_ID,
    scopes: [SEND_SCOPE],
    version: 3,
  });
  assert.deepEqual(bystanderProjection(handle.state), bystandersBefore);
  assert.equal(handle.state.audits.length, 2);
  assert.equal(handle.state.audits[1].changeType, 'replace');
  assert.equal(handle.state.audits[1].expectedGrantVersion, 2);
  assert.equal(handle.state.audits[1].resultingGrantVersion, 3);
  assert.equal(handle.state.audits[1].reason, ROLLBACK_AUDIT_REASON);
  const reconciled = await reconcileGrant(handle.db, planInput());
  assert.equal(reconciled.state, 'ROLLED_BACK');
});

test('rollback rejects malformed, NOOP, missing-audit, and drifted boundaries without writes', async (t) => {
  const source = fixture();
  const noOpReceipt = { outcome: 'NOOP' };
  for (const [name, receipt] of [['malformed', {}], ['noop', noOpReceipt]] as const) {
    await t.test(name, async () => {
      const result = await rollbackGrant(source.db, receipt, { operatorId: 'op', approvalRef: 'ref' });
      assert.equal(result.outcome, 'REFUSED');
      assert.deepEqual(source.writes, []);
    });
  }

  for (const kind of ['missing-audit', 'row-drift'] as const) {
    await t.test(kind, async () => {
      const handle = fixture();
      const applied = await applyGrant(handle.db, await applyInput(handle.db));
      handle.writes.splice(0);
      if (kind === 'missing-audit') handle.state.audits.splice(0);
      else handle.state.grants[0].scopes.push('agent.session.admin');
      const result = await rollbackGrant(handle.db, applied.receipt, { operatorId: 'op', approvalRef: 'ref' });
      assert.equal(result.outcome, 'REFUSED');
      assert.deepEqual(handle.writes, []);
    });
  }
});

test('verify proves exact target and the expected stable bystander digest', async () => {
  const handle = fixture();
  const applied = await applyGrant(handle.db, await applyInput(handle.db));
  const result = await verifyGrant(handle.db, {
    suppliedClientId: CLIENT_ID,
    bundleVersion: BUNDLE_VERSION,
    expectedBystanderDigest: applied.bystanderDigest!,
  });
  assert.deepEqual(result, {
    outcome: 'PASS',
    reason: null,
    classification: 'TARGET',
    bystanderDigest: applied.bystanderDigest,
  });
  handle.state.grants[1].version += 1;
  const drifted = await verifyGrant(handle.db, {
    suppliedClientId: CLIENT_ID,
    bundleVersion: BUNDLE_VERSION,
    expectedBystanderDigest: applied.bystanderDigest!,
  });
  assert.equal(drifted.outcome, 'FAIL');
  assert.equal(drifted.reason, 'BYSTANDER_DIGEST_CHANGED');
});

test('token evidence retains only the frozen nonsecret projection and drops a secret canary', () => {
  const canary = 'SECRET_CANARY_DO_NOT_EMIT';
  const projection = projectTokenClaims({
    iss: 'https://auth.example.test',
    aud: AUDIENCE_ID,
    sub: PRINCIPAL_ID,
    client_id: CLIENT_ID,
    principal_type: 'agent',
    agent_id: AGENT_ID,
    scope: `${INSPECT_SCOPE} ${SEND_SCOPE}`,
    exp: 2_000_000_000,
    client_secret: canary,
    access_token: canary,
    nested: { authorization: canary },
  });
  assert.deepEqual(Object.keys(projection), [
    'iss', 'aud', 'sub', 'client_id', 'principal_type', 'agent_id', 'scope', 'exp',
  ]);
  assert.equal(JSON.stringify(projection).includes(canary), false);
  assert.throws(() => projectTokenClaims({ ...projection, scope: `${SEND_SCOPE} agent.session.admin` }), /exact two-scope/);
});
