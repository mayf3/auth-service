/**
 * Focused fixture-adapter tests for the one-time governed baseline internal
 * directory-read entitlement supply vehicle
 * (AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1, contracts CTR-AID-001/002).
 *
 * No network, no real database, no production anything: every scenario runs
 * against an in-memory fixture adapter of the Prisma transaction client
 * (the supply-hr-session-send-grant-v1 test family pattern). No secret, token,
 * hash or credential value exists anywhere in these fixtures.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import {
  ADVISORY_LOCK_KEY,
  APPLY_ENV_GATE,
  APPLY_REASON,
  AUDIENCE_IDS,
  AUDIT_ENVELOPE_KEYS,
  checkApplyAuthorization,
  executeApply,
  FROZEN_AUDIENCE_ROWS,
  GRANT_VERSION,
  loadBaselinePlan,
  MIGRATION_ID,
  unrelatedGrantDigest,
  verifyBaseline,
  type BaselineDirectoryDatabase,
  type ToolAudienceRow,
  type ToolAuditCreateData,
  type ToolClientRow,
  type ToolGrantRow,
  type ToolPrincipalRow,
} from '../../scripts/supply-baseline-directory-grants-v1.js';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRIPT = path.join(ROOT, 'scripts/supply-baseline-directory-grants-v1.ts');

const SOURCE_COMMIT = 'a'.repeat(40);
const SERVICE_PRINCIPAL_ID = '55000000-0000-4000-8000-000000000001';
const SERVICE_CLIENT_INTERNAL = '75000000-0000-4000-8000-000000000001';
const SERVICE_PUBLIC = `mc_${'s'.repeat(24)}`;
const OPERATOR = 'baseline-directory-conformance-operator';
const APPROVAL_REF = 'https://github.com/mayf3/auth-service/issues/1#issuecomment-1';
const FIXED_NONCE = '11111111-1111-4111-8111-111111111111';

// ─── Fixture builders ───────────────────────────────────────────────────────

function audienceRow(audienceId: 'identity-directory' | 'agent-directory'): ToolAudienceRow {
  const frozen = FROZEN_AUDIENCE_ROWS.find((row) => row.audienceId === audienceId);
  assert.ok(frozen);
  return {
    audienceId: frozen.audienceId,
    resourceService: frozen.resourceService,
    scopeNamespace: frozen.scopeNamespace,
    acceptedPrincipalTypes: [...frozen.acceptedPrincipalTypes],
    registeredScopes: [...frozen.registeredScopes],
    humanAccessEnabled: frozen.humanAccessEnabled,
    machineAccessEnabled: frozen.machineAccessEnabled,
    delegatedAccessEnabled: frozen.delegatedAccessEnabled,
    status: frozen.status,
    freezeReady: frozen.freezeReady,
    version: frozen.version,
  };
}

function agentPrincipal(agentId: string, ordinal: number, overrides: Partial<ToolPrincipalRow> = {}): ToolPrincipalRow {
  const suffix = String(ordinal).padStart(12, '0');
  return {
    id: `10000000-0000-4000-8000-${suffix}`,
    principalType: 'agent',
    status: 'active',
    disabledAt: null,
    agentId,
    externalRef: `agentcore:v1:principal:${agentId}`,
    ...overrides,
  };
}

function canonicalClient(principal: ToolPrincipalRow, ordinal: number, overrides: Partial<ToolClientRow> = {}): ToolClientRow {
  const suffix = String(ordinal).padStart(12, '0');
  return {
    id: `20000000-0000-4000-8000-${suffix}`,
    clientId: `mc_${String(ordinal).padStart(24, 'a')}`,
    externalRef: `agentcore:v1:client:${principal.agentId}`,
    machinePrincipalId: principal.id,
    status: 'active',
    revokedAt: null,
    ...overrides,
  };
}

function grant(machineClientId: string, audienceId: string, scopes: string[], version = GRANT_VERSION): ToolGrantRow {
  return { machineClientId, audienceId, scopes, version };
}

interface FixtureState {
  audiences: ToolAudienceRow[];
  principals: ToolPrincipalRow[];
  clients: ToolClientRow[];
  grants: ToolGrantRow[];
  audits: ToolAuditCreateData[];
}

interface FixtureBehavior {
  failOnGrantCreateFor?: string;
  rejectAfterCommit?: boolean;
}

interface FixtureLog {
  writes: string[];
  raw: string[];
  transactionIsolationLevels: Array<string | undefined>;
}

interface FixtureHandle {
  db: BaselineDirectoryDatabase;
  state: FixtureState;
  log: FixtureLog;
}

function makeFixture(options: {
  agents?: Array<{ principal: ToolPrincipalRow; client: ToolClientRow }>;
  extraPrincipals?: ToolPrincipalRow[];
  extraClients?: ToolClientRow[];
  extraGrants?: ToolGrantRow[];
  extraAudits?: ToolAuditCreateData[];
  withService?: boolean;
  audiences?: ToolAudienceRow[];
  behavior?: FixtureBehavior;
} = {}): FixtureHandle {
  const state: FixtureState = {
    audiences: options.audiences ?? [audienceRow('identity-directory'), audienceRow('agent-directory')],
    principals: [
      ...(options.withService === false ? [] : [{
        id: SERVICE_PRINCIPAL_ID,
        principalType: 'service',
        status: 'active',
        disabledAt: null,
        agentId: null,
        externalRef: 'svc-workflow:v1:principal:backend',
      }]),
      ...(options.extraPrincipals ?? []),
      ...(options.agents ?? []).map((item) => item.principal),
    ],
    clients: [
      ...(options.withService === false ? [] : [{
        id: SERVICE_CLIENT_INTERNAL,
        clientId: SERVICE_PUBLIC,
        externalRef: 'svc-workflow:v1:client:backend',
        machinePrincipalId: SERVICE_PRINCIPAL_ID,
        status: 'active',
        revokedAt: null,
      }]),
      ...(options.extraClients ?? []),
      ...(options.agents ?? []).map((item) => item.client),
    ],
    grants: [...(options.extraGrants ?? [])],
    audits: [...(options.extraAudits ?? [])],
  };
  const log: FixtureLog = { writes: [], raw: [], transactionIsolationLevels: [] };
  const behavior = options.behavior ?? {};
  const db: BaselineDirectoryDatabase = {
    authAudience: {
      async findMany(args) {
        return state.audiences.filter((row) => args.where.audienceId.in.includes(row.audienceId));
      },
    },
    machinePrincipal: {
      async findMany(args) {
        return state.principals.filter((row) => row.principalType === args.where.principalType
          && row.status === args.where.status
          && (args.where.agentId.not === null ? row.agentId !== null : row.agentId === null));
      },
      async findUnique(args) {
        return state.principals.find((row) => row.id === args.where.id) ?? null;
      },
    },
    machineClient: {
      async findMany(args) {
        const where = args.where as { externalRef?: string; machinePrincipalId?: string };
        if (where.externalRef !== undefined) {
          return state.clients.filter((row) => row.externalRef === where.externalRef);
        }
        return state.clients.filter((row) => row.machinePrincipalId === where.machinePrincipalId);
      },
    },
    machineAccessGrant: {
      async findMany(args) {
        let rows = state.grants;
        const where = args.where;
        if (where?.machineClientId?.in !== undefined) {
          rows = rows.filter((row) => where.machineClientId?.in.includes(row.machineClientId) ?? false);
        }
        if (where?.audienceId?.in !== undefined) {
          rows = rows.filter((row) => where.audienceId?.in.includes(row.audienceId) ?? false);
        }
        return rows.map((row) => ({ ...row, scopes: [...row.scopes] }));
      },
      async create(args) {
        if (behavior.failOnGrantCreateFor !== undefined
          && behavior.failOnGrantCreateFor === args.data.machineClientId) {
          throw new Error(`injected grant create failure for ${args.data.machineClientId}`);
        }
        state.grants.push({ ...args.data, scopes: [...args.data.scopes] });
        log.writes.push(`grant:create:${args.data.machineClientId}:${args.data.audienceId}`);
        return args.data;
      },
    },
    grantChangeAudit: {
      async findMany(args) {
        return state.audits
          .filter((row) => row.migrationId === args.where.migrationId)
          .map((row) => ({ id: row.id, clientId: row.clientId, changeType: row.changeType }));
      },
      async create(args) {
        state.audits.push({ ...args.data });
        log.writes.push(`audit:create:${args.data.clientId}`);
        return args.data;
      },
    },
    async $executeRaw(query) {
      log.raw.push(query);
      return 0;
    },
      async $transaction(fn, options) {
        log.transactionIsolationLevels.push(options?.isolationLevel);
        if (behavior.rejectAfterCommit) {
          await fn(db);
          throw new Error('commit acknowledgement lost after the callback resolved');
        }
        return fn(db);
      },
  };
  return { db, state, log };
}

function standardFixture(options?: Parameters<typeof makeFixture>[0]): FixtureHandle {
  return makeFixture({
    agents: [
      { principal: agentPrincipal('agt_alpha-agent', 1), client: canonicalClient(agentPrincipal('agt_alpha-agent', 1), 1) },
      { principal: agentPrincipal('agt_beta-agent', 2), client: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2) },
    ],
    ...options,
  });
}

function applyInput(handle: FixtureHandle): Parameters<typeof executeApply>[1] {
  return {
    servicePrincipalId: SERVICE_PRINCIPAL_ID,
    operatorId: OPERATOR,
    approvalRef: APPROVAL_REF,
    sourceGitCommit: SOURCE_COMMIT,
    nonce: FIXED_NONCE,
  };
}

function grantRows(state: FixtureState): ToolGrantRow[] {
  return state.grants.map((row) => ({ ...row, scopes: [...row.scopes] }))
    .sort((a, b) => `${a.machineClientId}\0${a.audienceId}`.localeCompare(`${b.machineClientId}\0${b.audienceId}`));
}

function auditRows(state: FixtureState): ToolAuditCreateData[] {
  return state.audits.map((row) => ({ ...row }))
    .sort((a, b) => a.clientId.localeCompare(b.clientId));
}

function fleetAuditFor(publicClientId: string, migrationId: string, ordinal: number): ToolAuditCreateData {
  return {
    id: `30000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
    migrationId,
    sourceGitCommit: 'b'.repeat(40),
    operatorId: 'prior-governed-flow',
    approvalRef: 'https://github.com/mayf3/auth-service/issues/2#issuecomment-2',
    reason: 'prior governed supply',
    clientId: publicClientId,
    changeType: 'create',
    expectedGrantVersion: null,
    resultingGrantVersion: 1,
    beforeValue: null,
    afterValue: { client_id: publicClientId },
    timestamp: new Date('2026-08-01T00:00:00.000Z'),
  };
}

// ─── Static authority boundary ──────────────────────────────────────────────

test('static source binding pins the governing authority and family mechanics', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.match(source, /AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1/);
  assert.match(source, /CTR-AID-001/);
  assert.match(source, /CTR-AID-002/);
  assert.match(source, /PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED = NO/);
  assert.match(source, /TransactionIsolationLevel\.Serializable|isolationLevel: 'Serializable'/);
  assert.match(source, /pg_advisory_xact_lock\(\$\{ADVISORY_LOCK_KEY\}\)/);
  assert.match(source, /export const ADVISORY_LOCK_KEY = 813_947_207;/);
  assert.match(source, /LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(source, /expectedGrantVersion: null/);
  assert.match(source, /resultingGrantVersion: GRANT_VERSION/);
});

test('static boundary excludes the retired workflow-admission surfaces', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  for (const retired of [
    'workflow-principal-admission',
    'workflow-agent-admission',
    'auth.agent.admission.read',
    'agent.definition.admission.read',
    'svc-workflow-canonical-admission-v1',
    'cedb954a',
  ]) {
    assert.ok(!source.includes(retired), `retired surface must not be re-introduced: ${retired}`);
  }
  // The two baseline audiences are the ONLY audiences this vehicle may touch.
  assert.match(source, /'identity-directory': Object\.freeze\(\['auth\.directory\.read'\]\)/);
  assert.match(source, /'agent-directory': Object\.freeze\(\['agent\.directory\.read'\]\)/);
});

test('static boundary forbids grant mutation other than exact-row creation', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(source, /machineAccessGrant\.(?:update|updateMany|upsert|delete|deleteMany|createMany)/);
  assert.doesNotMatch(source, /machinePrincipal\.create|machineClient\.create/, 'the vehicle never creates principals or clients');
  assert.doesNotMatch(source, /grantChangeAudit\.(?:update|updateMany|upsert|delete|deleteMany)/);
});

// ─── Plan census ────────────────────────────────────────────────────────────

test('plan classifies ABSENT for the whole eligible set and excludes out-of-scope principals', async () => {
  const disabledAgent = agentPrincipal('agt_disabled-agent', 3, { status: 'disabled', disabledAt: new Date('2026-01-01T00:00:00.000Z') });
  const legacyAgent = agentPrincipal('agt_legacy-agent', 4, { externalRef: 'openclaw:v1:principal:agt_legacy-agent' });
  const handle = makeFixture({
    agents: [
      { principal: agentPrincipal('agt_alpha-agent', 1), client: canonicalClient(agentPrincipal('agt_alpha-agent', 1), 1) },
      { principal: agentPrincipal('agt_beta-agent', 2), client: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2) },
    ],
    extraPrincipals: [disabledAgent, legacyAgent],
    extraClients: [canonicalClient(disabledAgent, 3), canonicalClient(legacyAgent, 4)],
    extraGrants: [
      grant(canonicalClient(disabledAgent, 3).id, 'svc-workflow', ['workflow.read']),
      grant(SERVICE_CLIENT_INTERNAL, 'svc-forum', ['forum.read', 'forum.write']),
    ],
  });
  const plan = await loadBaselinePlan(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(plan.outcome, 'CREATE');
  assert.equal(plan.abortReason, null);
  assert.deepEqual(plan.audiences, { 'agent-directory': 'EXACT', 'identity-directory': 'EXACT' });
  assert.equal(plan.eligibleAgentCount, 2, 'disabled and non-canonical agents are out of scope');
  assert.equal(plan.rows.length, 3, 'two eligible agents plus the designated service client');
  assert.deepEqual(plan.rows.map((row) => row.principalType).sort(), ['agent', 'agent', 'service']);
  const disabledClientId = canonicalClient(disabledAgent, 3).id;
  assert.equal(plan.rows.some((row) => row.clientInternalId === disabledClientId), false, 'disabled principal excluded');
  assert.equal(plan.grantsToCreate, 6);
  assert.equal(plan.auditsToCreate, 3);
  assert.match(plan.unrelatedGrantDigest ?? '', /^[0-9a-f]{64}$/);
  assert.equal(plan.planDocument.outcome, 'CREATE');
  const expectedDigest = unrelatedGrantDigest([
    grant(canonicalClient(disabledAgent, 3).id, 'svc-workflow', ['workflow.read']),
    grant(SERVICE_CLIENT_INTERNAL, 'svc-forum', ['forum.read', 'forum.write']),
  ]);
  assert.equal(plan.unrelatedGrantDigest, expectedDigest);
});

test('plan is deterministic for the same census state (fixed nonce)', async () => {
  const first = standardFixture();
  const second = standardFixture();
  const planA = await loadBaselinePlan(first.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID, nonce: FIXED_NONCE });
  const planB = await loadBaselinePlan(second.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID, nonce: FIXED_NONCE });
  assert.equal(planA.planSha256, planB.planSha256);
});

// ─── Apply ──────────────────────────────────────────────────────────────────

test('apply creates exactly two exact rows per eligible client with schema-valid audits', async () => {
  const alphaClient = canonicalClient(agentPrincipal('agt_alpha-agent', 1), 1);
  const handle = makeFixture({
    agents: [
      { principal: agentPrincipal('agt_alpha-agent', 1), client: alphaClient },
      { principal: agentPrincipal('agt_beta-agent', 2), client: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2) },
    ],
    extraGrants: [grant(alphaClient.id, 'svc-workflow', ['workflow.read'])],
    extraAudits: [fleetAuditFor(alphaClient.clientId, 'agentcore-trusted-fleet-grant-supply-v1', 1)],
  });
  const before = grantRows(handle.state);
  const result = await executeApply(handle.db, applyInput(handle));
  assert.equal(result.outcome, 'CREATED', result.abortReason);
  assert.equal(result.grantsCreated, 6);
  assert.equal(result.auditsCreated, 3);
  assert.equal(result.auditIds.length, 3);
  assert.deepEqual(handle.log.transactionIsolationLevels, ['Serializable']);
  assert.equal(handle.log.raw.filter((line) => line.includes('pg_advisory_xact_lock')).length, 1);

  // Exact rows: exactly (client, identity-directory, [auth.directory.read], 1)
  // and (client, agent-directory, [agent.directory.read], 1) per client.
  const observed = grantRows(handle.state);
  const baselineRows = observed
    .filter((row) => AUDIENCE_IDS.includes(row.audienceId))
    .sort((a, b) => `${a.machineClientId}\0${a.audienceId}`.localeCompare(`${b.machineClientId}\0${b.audienceId}`));
  assert.deepEqual(baselineRows, [
    { machineClientId: alphaClient.id, audienceId: 'agent-directory', scopes: ['agent.directory.read'], version: 1 },
    { machineClientId: alphaClient.id, audienceId: 'identity-directory', scopes: ['auth.directory.read'], version: 1 },
    { machineClientId: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2).id, audienceId: 'agent-directory', scopes: ['agent.directory.read'], version: 1 },
    { machineClientId: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2).id, audienceId: 'identity-directory', scopes: ['auth.directory.read'], version: 1 },
    { machineClientId: SERVICE_CLIENT_INTERNAL, audienceId: 'agent-directory', scopes: ['agent.directory.read'], version: 1 },
    { machineClientId: SERVICE_CLIENT_INTERNAL, audienceId: 'identity-directory', scopes: ['auth.directory.read'], version: 1 },
  ]);

  // Unrelated grant preserved byte-equivalent (workflow.read row).
  assert.equal(observed.filter((row) => row.audienceId === 'svc-workflow').length, 1);
  assert.deepEqual(observed.find((row) => row.audienceId === 'svc-workflow'), grant(alphaClient.id, 'svc-workflow', ['workflow.read']));
  assert.equal(result.preUnrelatedGrantDigest, result.postUnrelatedGrantDigest);

  // Audit rows: one per mutated client, exact envelope, schema-valid.
  assert.equal(handle.state.audits.filter((row) => row.migrationId === MIGRATION_ID).length, 3);
  const schema = JSON.parse(readFileSync(path.join(ROOT, 'contract-bundles/minimal-auth-v1/schemas/grants.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/grantChangeAudit` });
  for (const audit of auditRows(handle.state).filter((row) => row.migrationId === MIGRATION_ID)) {
    const envelope = {
      change_id: audit.id,
      migration_id: audit.migrationId,
      source_git_commit: audit.sourceGitCommit,
      operator_id: audit.operatorId,
      approval_ref: audit.approvalRef,
      reason: audit.reason,
      client_id: audit.clientId,
      change_type: audit.changeType,
      expected_grant_version: audit.expectedGrantVersion,
      resulting_grant_version: audit.resultingGrantVersion,
      before_value: audit.beforeValue,
      after_value: audit.afterValue,
      timestamp: audit.timestamp.toISOString(),
    };
    assert.deepEqual(Object.keys(envelope).sort(), [...AUDIT_ENVELOPE_KEYS].sort());
    assert.equal(validate(envelope), true, JSON.stringify(validate.errors));
    assert.equal(audit.migrationId, MIGRATION_ID);
    assert.equal(audit.changeType, 'create');
    assert.equal(audit.expectedGrantVersion, null);
    assert.equal(audit.resultingGrantVersion, 1);
    assert.equal(audit.beforeValue, null);
    assert.equal(audit.operatorId, OPERATOR);
    assert.equal(audit.approvalRef, APPROVAL_REF);
    assert.equal(audit.reason, APPLY_REASON);
    const afterValue = audit.afterValue as Record<string, unknown>;
    assert.deepEqual(Object.keys(afterValue).sort(), [
      'client_id', 'client_kind', 'delegation_grants', 'human_audience_grants',
      'machine_access_grants', 'principal_id', 'principal_type', 'status', 'version',
    ]);
    const machineGrants = afterValue.machine_access_grants as Record<string, string[]>;
    assert.deepEqual(machineGrants['identity-directory'], ['auth.directory.read']);
    assert.deepEqual(machineGrants['agent-directory'], ['agent.directory.read']);
  }
  const alphaAudit = auditRows(handle.state)
    .find((row) => row.migrationId === MIGRATION_ID && row.clientId === alphaClient.clientId);
  assert.deepEqual((alphaAudit?.afterValue as Record<string, unknown>).machine_access_grants, {
    'agent-directory': ['agent.directory.read'],
    'identity-directory': ['auth.directory.read'],
    'svc-workflow': ['workflow.read'],
  }, 'the snapshot preserves unrelated grants');
  // The prior fleet audit under a different migration id is untouched.
  assert.ok(handle.state.audits.some((row) => row.migrationId === 'agentcore-trusted-fleet-grant-supply-v1'));
  assert.equal(before.filter((row) => AUDIENCE_IDS.includes(row.audienceId)).length, 0);
});

test('exact rerun is a byte-stable NOOP with zero writes', async () => {
  const handle = standardFixture();
  const first = await executeApply(handle.db, applyInput(handle));
  assert.equal(first.outcome, 'CREATED');
  const grantsAfterApply = grantRows(handle.state);
  const auditsAfterApply = auditRows(handle.state);
  const plan = await loadBaselinePlan(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(plan.outcome, 'NOOP');
  assert.equal(plan.grantsToCreate, 0);
  assert.equal(plan.createClientCount, 0);
  assert.equal(plan.noopClientCount, plan.rows.length);
  const second = await executeApply(handle.db, applyInput(handle));
  assert.equal(second.outcome, 'NOOP');
  assert.equal(second.grantsCreated, 0);
  assert.equal(second.auditsCreated, 0);
  assert.deepEqual(handle.log.writes.filter((write) => write.startsWith('grant:create:')).length, 6, 'only the first apply writes');
  assert.deepEqual(grantRows(handle.state), grantsAfterApply);
  assert.deepEqual(auditRows(handle.state), auditsAfterApply);
  const verification = await verifyBaseline(handle.db, {
    servicePrincipalId: SERVICE_PRINCIPAL_ID,
    expectedUnrelatedDigest: first.postUnrelatedGrantDigest ?? undefined,
  });
  assert.equal(verification.outcome, 'PASS', verification.failureReason);
});

test('partial fleet mix (one client already exact) applies only the missing rows', async () => {
  const alphaClient = canonicalClient(agentPrincipal('agt_alpha-agent', 1), 1);
  const betaClient = canonicalClient(agentPrincipal('agt_beta-agent', 2), 2);
  const handle = makeFixture({
    agents: [
      { principal: agentPrincipal('agt_alpha-agent', 1), client: alphaClient },
      { principal: agentPrincipal('agt_beta-agent', 2), client: betaClient },
    ],
    extraGrants: [
      grant(alphaClient.id, 'identity-directory', ['auth.directory.read']),
      grant(alphaClient.id, 'agent-directory', ['agent.directory.read']),
    ],
  });
  const result = await executeApply(handle.db, applyInput(handle));
  assert.equal(result.outcome, 'CREATED');
  assert.equal(result.grantsCreated, 4, 'only the service and beta rows are missing');
  assert.equal(result.auditsCreated, 2, 'only the mutated clients earn audit rows');
  assert.deepEqual(
    handle.log.writes.filter((write) => write.startsWith('grant:create:')).sort(),
    [
      `grant:create:${SERVICE_CLIENT_INTERNAL}:agent-directory`,
      `grant:create:${SERVICE_CLIENT_INTERNAL}:identity-directory`,
      `grant:create:${betaClient.id}:agent-directory`,
      `grant:create:${betaClient.id}:identity-directory`,
    ].sort(),
  );
  assert.equal(handle.state.grants.filter((row) => row.machineClientId === alphaClient.id).length, 2, 'the exact client is untouched');
});

// ─── Conflict refusal ───────────────────────────────────────────────────────

for (const [label, driftedRow] of [
  ['extra scope union row', grant(SERVICE_CLIENT_INTERNAL, 'identity-directory', ['auth.directory.read', 'auth.identity.provision'])],
  ['wrong scope row', grant(SERVICE_CLIENT_INTERNAL, 'identity-directory', ['auth.identity.provision'])],
  ['wrong version row', grant(SERVICE_CLIENT_INTERNAL, 'identity-directory', ['auth.directory.read'], 2)],
] as const) {
  await test(`conflict refuses on ${label} with zero writes`, async () => {
    const handle = standardFixture({ extraGrants: [driftedRow] });
    const before = grantRows(handle.state);
    const plan = await loadBaselinePlan(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
    assert.equal(plan.outcome, 'ABORT');
    assert.match(plan.abortReason ?? '', /^GRANT_CONFLICT:/);
    const result = await executeApply(handle.db, applyInput(handle));
    assert.equal(result.outcome, 'ABORTED');
    assert.match(result.abortReason ?? '', /^GRANT_CONFLICT:/);
    assert.deepEqual(handle.log.writes, []);
    assert.deepEqual(grantRows(handle.state), before);
    const verification = await verifyBaseline(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
    assert.equal(verification.outcome, 'FAIL');
  });
}

await test('conflict refuses on a drifted agent-client row with zero writes', async () => {
  const alphaClient = canonicalClient(agentPrincipal('agt_alpha-agent', 1), 1);
  const handle = makeFixture({
    agents: [
      { principal: agentPrincipal('agt_alpha-agent', 1), client: alphaClient },
      { principal: agentPrincipal('agt_beta-agent', 2), client: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2) },
    ],
    extraGrants: [grant(alphaClient.id, 'agent-directory', ['agent.directory.read'], 7)],
  });
  const before = grantRows(handle.state);
  const result = await executeApply(handle.db, applyInput(handle));
  assert.equal(result.outcome, 'ABORTED');
  assert.match(result.abortReason ?? '', /^GRANT_CONFLICT:/);
  assert.deepEqual(handle.log.writes, []);
  assert.deepEqual(grantRows(handle.state), before);
});

await test('audit-history conflict refuses re-supply after an out-of-band deletion', async () => {
  const alphaClient = canonicalClient(agentPrincipal('agt_alpha-agent', 1), 1);
  const handle = makeFixture({
    agents: [
      { principal: agentPrincipal('agt_alpha-agent', 1), client: alphaClient },
      { principal: agentPrincipal('agt_beta-agent', 2), client: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2) },
    ],
    extraAudits: [fleetAuditFor(alphaClient.clientId, MIGRATION_ID, 9)],
  });
  const result = await executeApply(handle.db, applyInput(handle));
  assert.equal(result.outcome, 'ABORTED');
  assert.match(result.abortReason ?? '', /^AUDIT_HISTORY_CONFLICT:/);
  assert.deepEqual(handle.log.writes, []);
});

// ─── SERVICE selector validation ────────────────────────────────────────────

test('service selector validation fails closed on every invalid designation', async () => {
  const missing = makeFixture({ withService: false });
  const missingPlan = await loadBaselinePlan(missing.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(missingPlan.abortReason, 'SERVICE_NOT_FOUND');

  const agentTyped = makeFixture({
    extraPrincipals: [{ ...agentPrincipal('agt_imposter-agent', 8), id: SERVICE_PRINCIPAL_ID }],
    extraClients: [canonicalClient({ ...agentPrincipal('agt_imposter-agent', 8), id: SERVICE_PRINCIPAL_ID }, 8)],
    withService: false,
  });
  const agentTypedPlan = await loadBaselinePlan(agentTyped.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(agentTypedPlan.abortReason, 'SERVICE_NOT_SERVICE');

  const disabled = standardFixture({
    extraPrincipals: [],
  });
  const serviceRow = disabled.state.principals.find((row) => row.id === SERVICE_PRINCIPAL_ID);
  assert.ok(serviceRow);
  serviceRow.status = 'disabled';
  serviceRow.disabledAt = new Date('2026-01-01T00:00:00.000Z');
  const disabledPlan = await loadBaselinePlan(disabled.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(disabledPlan.abortReason, 'SERVICE_DISABLED');

  const profile = standardFixture();
  const profileRow = profile.state.principals.find((row) => row.id === SERVICE_PRINCIPAL_ID);
  assert.ok(profileRow);
  profileRow.agentId = 'agt_not-allowed-on-service';
  const profilePlan = await loadBaselinePlan(profile.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(profilePlan.abortReason, 'SERVICE_PROFILE_INVALID');

  const noClient = standardFixture();
  noClient.state.clients = noClient.state.clients.filter((row) => row.id !== SERVICE_CLIENT_INTERNAL);
  const noClientPlan = await loadBaselinePlan(noClient.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(noClientPlan.abortReason, 'SERVICE_NO_ACTIVE_CLIENT');

  const ambiguous = standardFixture({
    extraClients: [{
      id: '75000000-0000-4000-8000-000000000002',
      clientId: `mc_${'t'.repeat(24)}`,
      externalRef: 'svc-workflow:v1:client:backend-2',
      machinePrincipalId: SERVICE_PRINCIPAL_ID,
      status: 'active',
      revokedAt: null,
    }],
  });
  const ambiguousPlan = await loadBaselinePlan(ambiguous.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(ambiguousPlan.abortReason, 'SERVICE_AMBIGUOUS_BINDING');

  for (const handle of [missing, agentTyped, disabled, profile, noClient, ambiguous]) {
    assert.equal(handle.log.writes.length, 0);
  }

  const malformed = standardFixture();
  const malformedPlan = await loadBaselinePlan(malformed.db, { servicePrincipalId: 'not-a-uuid' });
  assert.equal(malformedPlan.abortReason, 'SERVICE_PRINCIPAL_ID_MALFORMED');
});

// ─── Canonical agent binding integrity ──────────────────────────────────────

test('canonical agent binding failures fail closed', async () => {
  const alphaPrincipal = agentPrincipal('agt_alpha-agent', 1);
  const alphaClient = canonicalClient(alphaPrincipal, 1);

  const missingClient = makeFixture({ agents: [{ principal: alphaPrincipal, client: alphaClient }] });
  missingClient.state.clients = missingClient.state.clients.filter((row) => row.id !== alphaClient.id);
  const missingPlan = await loadBaselinePlan(missingClient.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.match(missingPlan.abortReason ?? '', /^CANONICAL_CLIENT_ABSENT:agt_alpha-agent$/);

  const revokedClient = makeFixture({
    agents: [{ principal: alphaPrincipal, client: { ...alphaClient, status: 'revoked', revokedAt: new Date('2026-02-02T00:00:00.000Z') } }],
  });
  const revokedPlan = await loadBaselinePlan(revokedClient.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.match(revokedPlan.abortReason ?? '', /^CANONICAL_CLIENT_INACTIVE:agt_alpha-agent$/);

  const wrongOtherPrincipal = agentPrincipal('agt_other-agent', 5);
  const misbound = makeFixture({
    agents: [{ principal: alphaPrincipal, client: { ...alphaClient, machinePrincipalId: wrongOtherPrincipal.id } }],
    extraPrincipals: [wrongOtherPrincipal],
  });
  const misboundPlan = await loadBaselinePlan(misbound.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.match(misboundPlan.abortReason ?? '', /^CANONICAL_CLIENT_BINDING_MISMATCH:agt_alpha-agent$/);

  // A non-canonical active agent principal is out of scope, not an abort.
  const legacy = makeFixture({
    agents: [{ principal: alphaPrincipal, client: alphaClient }],
    extraPrincipals: [agentPrincipal('agt_untracked-agent', 6, { externalRef: 'openclaw:v1:principal:agt_untracked-agent' })],
    extraClients: [canonicalClient(agentPrincipal('agt_untracked-agent', 6, { externalRef: 'openclaw:v1:principal:agt_untracked-agent' }), 6)],
  });
  const legacyPlan = await loadBaselinePlan(legacy.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(legacyPlan.outcome, 'CREATE');
  assert.equal(legacyPlan.eligibleAgentCount, 1, 'non-canonical principals are not enumerated');
});

// ─── Audience registry EXACTness ────────────────────────────────────────────

test('audience registry drift and absence fail closed', async () => {
  const drifted = standardFixture();
  const driftedRow = drifted.state.audiences.find((row) => row.audienceId === 'identity-directory');
  assert.ok(driftedRow);
  driftedRow.acceptedPrincipalTypes = ['agent'];
  const driftedPlan = await loadBaselinePlan(drifted.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(driftedPlan.abortReason, 'AUDIENCE_DRIFTED:identity-directory');
  assert.deepEqual(drifted.log.writes, []);

  const scopeDrift = standardFixture();
  const scopeRow = scopeDrift.state.audiences.find((row) => row.audienceId === 'agent-directory');
  assert.ok(scopeRow);
  scopeRow.registeredScopes = ['agent.directory.read', 'agent.directory.write'];
  const scopePlan = await loadBaselinePlan(scopeDrift.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(scopePlan.abortReason, 'AUDIENCE_DRIFTED:agent-directory');

  const absent = standardFixture();
  absent.state.audiences = absent.state.audiences.filter((row) => row.audienceId !== 'identity-directory');
  const absentPlan = await loadBaselinePlan(absent.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(absentPlan.abortReason, 'AUDIENCE_ABSENT:identity-directory');
});

// ─── Unrelated grants untouched ─────────────────────────────────────────────

test('unrelated grants (including legacy principals) stay byte-equivalent across apply', async () => {
  const legacyPrincipal = agentPrincipal('agt_legacy-agent', 4, { externalRef: 'openclaw:v1:principal:agt_legacy-agent' });
  const legacyClient = canonicalClient(legacyPrincipal, 4);
  const alphaClient = canonicalClient(agentPrincipal('agt_alpha-agent', 1), 1);
  const handle = makeFixture({
    agents: [
      { principal: agentPrincipal('agt_alpha-agent', 1), client: alphaClient },
      { principal: agentPrincipal('agt_beta-agent', 2), client: canonicalClient(agentPrincipal('agt_beta-agent', 2), 2) },
    ],
    extraPrincipals: [legacyPrincipal],
    extraClients: [legacyClient],
    extraGrants: [
      grant(legacyClient.id, 'svc-workflow', ['workflow.read']),
      grant(alphaClient.id, 'svc-forum', ['forum.read', 'forum.write']),
    ],
  });
  const unrelatedBefore = unrelatedGrantDigest(handle.state.grants);
  const result = await executeApply(handle.db, applyInput(handle));
  assert.equal(result.outcome, 'CREATED');
  assert.equal(result.preUnrelatedGrantDigest, unrelatedBefore);
  assert.equal(result.postUnrelatedGrantDigest, unrelatedBefore);
  const legacyRows = grantRows(handle.state).filter((row) => row.machineClientId === legacyClient.id);
  assert.deepEqual(legacyRows, [grant(legacyClient.id, 'svc-workflow', ['workflow.read'])], 'legacy principal untouched');
  const verification = await verifyBaseline(handle.db, {
    servicePrincipalId: SERVICE_PRINCIPAL_ID,
    expectedUnrelatedDigest: unrelatedBefore,
  });
  assert.equal(verification.outcome, 'PASS');
});

// ─── Verify post-state proof ────────────────────────────────────────────────

test('verify detects a global directory-row delta after out-of-band tampering', async () => {
  const handle = standardFixture();
  const apply = await executeApply(handle.db, applyInput(handle));
  assert.equal(apply.outcome, 'CREATED');
  const pass = await verifyBaseline(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(pass.outcome, 'PASS');
  assert.equal(pass.directoryGrantRowCount, 6);
  // Out-of-band extra row on a baseline audience (e.g. a per-consumer grant)
  // must be visible as a delta: no extra audience/scope deltas are allowed.
  handle.state.grants.push(grant('75000000-0000-4000-8000-000000000009', 'identity-directory', ['auth.directory.read']));
  const fail = await verifyBaseline(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(fail.outcome, 'FAIL');
  assert.equal(fail.failureReason, 'DIRECTORY_GRANT_SET_DELTA');
});

test('verify fails when post-apply state drifts from the audited baseline', async () => {
  const handle = standardFixture();
  await executeApply(handle.db, applyInput(handle));
  // (a) Out-of-band DELETION of a baseline row under this migration id: the
  // census refuses re-supply (audit history exists) and verify fails.
  handle.state.grants = handle.state.grants
    .filter((row) => !(row.machineClientId === SERVICE_CLIENT_INTERNAL && row.audienceId === 'agent-directory'));
  const deleted = await verifyBaseline(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(deleted.outcome, 'FAIL');
  assert.equal(deleted.failureReason, `ABORT:AUDIT_HISTORY_CONFLICT:${SERVICE_PUBLIC}`);
  // (b) Out-of-band VERSION tamper on a baseline row: PAIR_NOT_LIVE_EXACT.
  handle.state.grants = handle.state.grants
    .filter((row) => !(row.machineClientId === SERVICE_CLIENT_INTERNAL && row.audienceId === 'agent-directory'));
  handle.state.grants.push(grant(SERVICE_CLIENT_INTERNAL, 'agent-directory', ['agent.directory.read'], 2));
  const tampered = await verifyBaseline(handle.db, { servicePrincipalId: SERVICE_PRINCIPAL_ID });
  assert.equal(tampered.outcome, 'FAIL');
  assert.equal(tampered.failureReason, `PAIR_NOT_LIVE_EXACT:${SERVICE_PUBLIC}:agent-directory:CONFLICT`);
});

// ─── Transaction mechanics ──────────────────────────────────────────────────

test('an injected mid-transaction failure reports PRECOMMIT_FAILED with zero writes', async () => {
  const handle = standardFixture({
    behavior: { failOnGrantCreateFor: SERVICE_CLIENT_INTERNAL },
  });
  const before = grantRows(handle.state);
  const result = await executeApply(handle.db, applyInput(handle));
  assert.equal(result.outcome, 'PRECOMMIT_FAILED');
  assert.match(result.abortReason ?? '', /injected grant create failure/);
  assert.deepEqual(grantRows(handle.state), before, 'rollback leaves zero baseline rows');
  assert.deepEqual(handle.state.audits, []);
});

test('a lost commit acknowledgement after the callback reports OUTCOME_UNKNOWN', async () => {
  const handle = standardFixture({ behavior: { rejectAfterCommit: true } });
  const result = await executeApply(handle.db, applyInput(handle));
  assert.equal(result.outcome, 'OUTCOME_UNKNOWN');
  assert.match(result.abortReason ?? '', /commit acknowledgement lost/);
});

// ─── Apply gate (before any database connection) ────────────────────────────

test('checkApplyAuthorization enforces the explicit gate, operator, and approval ref', () => {
  const refused = checkApplyAuthorization({});
  assert.equal(refused.authorized, false);
  assert.match(refused.reason, /BASELINE_DIRECTORY_APPLY=YES/);

  const noOperator = checkApplyAuthorization({ [APPLY_ENV_GATE]: 'YES' });
  assert.equal(noOperator.authorized, false);
  assert.match(noOperator.reason, /BASELINE_DIRECTORY_OPERATOR/);

  const noApproval = checkApplyAuthorization({ [APPLY_ENV_GATE]: 'YES', BASELINE_DIRECTORY_OPERATOR: OPERATOR });
  assert.equal(noApproval.authorized, false);
  assert.match(noApproval.reason, /BASELINE_DIRECTORY_APPROVAL_REF/);

  const wrongGate = checkApplyAuthorization({ [APPLY_ENV_GATE]: 'yes', BASELINE_DIRECTORY_OPERATOR: OPERATOR, BASELINE_DIRECTORY_APPROVAL_REF: APPROVAL_REF });
  assert.equal(wrongGate.authorized, false);

  const authorized = checkApplyAuthorization({
    [APPLY_ENV_GATE]: 'YES',
    BASELINE_DIRECTORY_OPERATOR: OPERATOR,
    BASELINE_DIRECTORY_APPROVAL_REF: APPROVAL_REF,
  });
  assert.deepEqual(authorized, { authorized: true, operatorId: OPERATOR, approvalRef: APPROVAL_REF });

  const longOperator = checkApplyAuthorization({
    [APPLY_ENV_GATE]: 'YES',
    BASELINE_DIRECTORY_OPERATOR: 'x'.repeat(257),
    BASELINE_DIRECTORY_APPROVAL_REF: APPROVAL_REF,
  });
  assert.equal(longOperator.authorized, false);
});

test('apply refuses a malformed source commit before touching the census', async () => {
  const handle = standardFixture();
  const result = await executeApply(handle.db, { ...applyInput(handle), sourceGitCommit: 'NOT-HEX' });
  assert.equal(result.outcome, 'ABORTED');
  assert.equal(result.abortReason, 'SOURCE_COMMIT_MALFORMED');
  assert.deepEqual(handle.log.writes, []);
});
