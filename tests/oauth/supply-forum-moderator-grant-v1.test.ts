import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test, { after } from 'node:test';
import { PrismaClient } from '@prisma/client';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRIPT = path.join(ROOT, 'scripts/supply-forum-moderator-grant-v1.ts');
const NODE = process.execPath;

function readDescriptorFd(): string {
  const chunks: Buffer[] = [];
  while (true) {
    const chunk = Buffer.allocUnsafe(64 * 1024);
    const count = readSync(3, chunk, 0, chunk.length, null);
    if (count === 0) break;
    chunks.push(chunk.subarray(0, count));
  }
  return Buffer.concat(chunks).toString('utf8');
}

const descriptor = JSON.parse(readDescriptorFd()) as {
  schema_version: 1;
  container_id: string;
  nonce: string;
  host_port: number;
  database: string;
  plan_sha256: string;
  invariant_sha256: string;
  audit_metadata: {
    migration_id: string;
    source_git_commit: string;
    operator_id: string;
    approval_ref: string;
    reason: string;
  };
};
const superuserUrl = `postgresql://postgres@127.0.0.1:${descriptor.host_port}/${descriptor.database}?schema=public`;
const prisma = new PrismaClient({ datasources: { db: { url: superuserUrl } } });

const AGENT_ID = 'agt_course-community-agent-2';
const PRINCIPAL_EXTERNAL_REF = `agentcore:v1:principal:${AGENT_ID}`;
const CLIENT_EXTERNAL_REF = `agentcore:v1:client:${AGENT_ID}`;
const TARGET_PRINCIPAL = '9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56';
const TARGET_CLIENT_INTERNAL = '8f7cf4c5-2222-4222-8222-222222222222';
const TARGET_PUBLIC = 'mc_hvEfjkJ5BTKA8HZXRmbzNVw0';
const SENTINEL_PRINCIPAL = '7f7cf4c5-3333-4333-8333-333333333333';
const SENTINEL_CLIENT_INTERNAL = '6f7cf4c5-4444-4444-8444-444444444444';
const SENTINEL_PUBLIC = `mc_${'s'.repeat(24)}`;
const LEGACY_PRINCIPAL = '5f7cf4c5-5555-4555-8555-555555555555';
const LEGACY_CLIENT_INTERNAL = '4f7cf4c5-6666-4666-8666-666666666666';
const LEGACY_PUBLIC = 'mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd';
const SECRET_CANARY = 'FMG_SECRET_CANARY_do_not_disclose_7f128d';
const LEGACY_RESOURCE_CANARY = 'legacy.resource.must.remain.byte.stable';
const LEGACY_SCOPE_CANARY = 'legacy.scope.must.remain.byte.stable';
const CREATED = new Date('2026-08-28T10:00:00.000Z');
const SOURCE = ['forum.read', 'forum.write'];
const TARGET = ['forum.moderate', 'forum.read', 'forum.write'];
const WORKFLOW = ['workflow.read'];
const FLEET_FIXTURE_COUNT = 83;
const EXTRA_FLEET = Array.from({ length: FLEET_FIXTURE_COUNT }, (_, index) => {
  const suffix = String(index + 1).padStart(12, '0');
  const publicSuffix = String(index + 1).padStart(24, '0');
  return {
    index: index + 1,
    principalId: `30000000-0000-4000-8000-${suffix}`,
    clientInternalId: `40000000-0000-4000-8000-${suffix}`,
    clientId: `mc_${publicSuffix}`,
  };
});

const canonicalJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>)
      .sort((a, b) => Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii')))
      .map((key) => [key, canonicalJson((value as Record<string, unknown>)[key])]));
  }
  return value;
};

function expectedSnapshot(scopes: string[], version: number) {
  return {
    client_id: TARGET_PUBLIC,
    client_kind: 'machine',
    principal_id: TARGET_PRINCIPAL,
    principal_type: 'agent',
    human_audience_grants: [],
    machine_access_grants: {
      'svc-forum': [...scopes],
      'svc-workflow': [...WORKFLOW],
    },
    delegation_grants: {},
    status: 'active',
    version,
  };
}

type SeedOptions = {
  audienceScopes?: string[];
  grantScopes?: string[];
  grantVersion?: number;
  fmgAudit?: 'exact' | 'wrong-reason' | 'wrong-snapshot';
  foreignModerate?: boolean;
  workflowScopes?: string[];
  workflowVersion?: number;
  targetStatus?: 'active' | 'revoked';
  targetRevoked?: boolean;
  targetExternalRef?: string;
  principalStatus?: 'active' | 'disabled';
  principalDisabled?: boolean;
};

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS fmg_test_reject_audit_insert ON grant_change_audits');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS fmg_test_reject_audit_insert()');
  await prisma.$executeRawUnsafe(
    'TRUNCATE grant_change_audits, machine_access_grants, delegation_grants, '
      + 'proxy_accepted_subject_audiences, trusted_proxies, machine_clients, machine_principals, '
      + 'auth_audiences RESTART IDENTITY CASCADE',
  );
}

async function seed(options: SeedOptions = {}): Promise<void> {
  await reset();
  for (const data of [
    {
      audienceId: 'svc-forum', resourceService: 'svc-forum', scopeNamespace: 'forum',
      registeredScopes: options.audienceScopes ?? SOURCE,
    },
    {
      audienceId: 'svc-workflow', resourceService: 'svc-workflow', scopeNamespace: 'workflow',
      registeredScopes: ['workflow.read'],
    },
  ]) {
    await prisma.authAudience.create({ data: {
      ...data,
      acceptedPrincipalTypes: ['agent'], humanAccessEnabled: false,
      machineAccessEnabled: true, delegatedAccessEnabled: false,
      status: 'active', freezeReady: true, version: 1, createdAt: CREATED, updatedAt: CREATED,
    } });
  }
  await prisma.machinePrincipal.createMany({ data: [
    {
      id: TARGET_PRINCIPAL, principalType: 'agent', agentId: AGENT_ID,
      externalRef: PRINCIPAL_EXTERNAL_REF, status: options.principalStatus ?? 'active',
      disabledAt: options.principalDisabled ? CREATED : null,
      displayName: 'Moderator fixture', requestDigest: 'target-request-digest',
      createdAt: CREATED, updatedAt: CREATED,
    },
    {
      id: SENTINEL_PRINCIPAL, principalType: 'agent', agentId: 'agt_non-target-sentinel',
      externalRef: 'agentcore:v1:principal:agt_non-target-sentinel', status: 'active',
      displayName: 'Sentinel fixture', requestDigest: 'sentinel-request-digest',
      createdAt: CREATED, updatedAt: CREATED,
    },
    {
      id: LEGACY_PRINCIPAL, principalType: 'agent', agentId: 'course-community-agent-2',
      externalRef: 'openclaw:v1:principal:course-community-agent-2', status: 'active',
      displayName: 'Moderator fixture', requestDigest: 'legacy-request-digest',
      createdAt: CREATED, updatedAt: CREATED,
    },
    ...EXTRA_FLEET.map((item) => ({
      id: item.principalId, principalType: 'agent' as const, agentId: `agt_fmg-fleet-${item.index}`,
      externalRef: `agentcore:v1:principal:agt_fmg-fleet-${item.index}`, status: 'active' as const,
      displayName: `FMG fleet fixture ${item.index}`, requestDigest: `fleet-request-${item.index}`,
      createdAt: CREATED, updatedAt: CREATED,
    })),
  ] });
  await prisma.machineClient.createMany({ data: [
    {
      id: TARGET_CLIENT_INTERNAL, clientId: TARGET_PUBLIC, machinePrincipalId: TARGET_PRINCIPAL,
      externalRef: options.targetExternalRef ?? CLIENT_EXTERNAL_REF, secretHash: SECRET_CANARY,
      status: options.targetStatus ?? 'active', revokedAt: options.targetRevoked ? CREATED : null,
      allowedResources: [LEGACY_RESOURCE_CANARY], allowedScopes: [LEGACY_SCOPE_CANARY],
      createdAt: CREATED, updatedAt: CREATED,
    },
    {
      id: SENTINEL_CLIENT_INTERNAL, clientId: SENTINEL_PUBLIC, machinePrincipalId: SENTINEL_PRINCIPAL,
      externalRef: 'agentcore:v1:client:agt_non-target-sentinel', secretHash: 'sentinel-secret-hash',
      status: 'active', allowedResources: ['sentinel.resource'], allowedScopes: ['sentinel.scope'],
      createdAt: CREATED, updatedAt: CREATED,
    },
    {
      id: LEGACY_CLIENT_INTERNAL, clientId: LEGACY_PUBLIC, machinePrincipalId: LEGACY_PRINCIPAL,
      externalRef: 'openclaw:v1:client:course-community-agent-2', secretHash: 'legacy-secret-hash',
      status: 'active', allowedResources: ['legacy.resource'], allowedScopes: ['legacy.scope'],
      createdAt: CREATED, updatedAt: CREATED,
    },
    ...EXTRA_FLEET.map((item) => ({
      id: item.clientInternalId, clientId: item.clientId, machinePrincipalId: item.principalId,
      externalRef: `agentcore:v1:client:agt_fmg-fleet-${item.index}`, secretHash: `fleet-secret-hash-${item.index}`,
      status: 'active' as const, allowedResources: ['svc-forum', 'svc-workflow'],
      allowedScopes: [...SOURCE, ...WORKFLOW], createdAt: CREATED, updatedAt: CREATED,
    })),
  ] });
  await prisma.machineAccessGrant.createMany({ data: [
    {
      machineClientId: TARGET_CLIENT_INTERNAL, audienceId: 'svc-forum',
      scopes: options.grantScopes ?? SOURCE, version: options.grantVersion ?? 1,
      createdAt: CREATED, updatedAt: CREATED,
    },
    {
      machineClientId: TARGET_CLIENT_INTERNAL, audienceId: 'svc-workflow',
      scopes: options.workflowScopes ?? WORKFLOW, version: options.workflowVersion ?? 1,
      createdAt: CREATED, updatedAt: CREATED,
    },
    {
      machineClientId: SENTINEL_CLIENT_INTERNAL, audienceId: 'svc-forum',
      scopes: options.foreignModerate ? TARGET : SOURCE, version: 1,
      createdAt: CREATED, updatedAt: CREATED,
    },
    {
      machineClientId: SENTINEL_CLIENT_INTERNAL, audienceId: 'svc-workflow',
      scopes: WORKFLOW, version: 1, createdAt: CREATED, updatedAt: CREATED,
    },
    {
      machineClientId: LEGACY_CLIENT_INTERNAL, audienceId: 'svc-forum',
      scopes: SOURCE, version: 7, createdAt: CREATED, updatedAt: CREATED,
    },
    ...EXTRA_FLEET.flatMap((item) => ([
      {
        machineClientId: item.clientInternalId, audienceId: 'svc-forum', scopes: SOURCE,
        version: 1, createdAt: CREATED, updatedAt: CREATED,
      },
      {
        machineClientId: item.clientInternalId, audienceId: 'svc-workflow', scopes: WORKFLOW,
        version: 1, createdAt: CREATED, updatedAt: CREATED,
      },
    ])),
  ] });
  // An older fleet audit for the same Client is not the governed FMG audit and
  // must remain byte-stable across FMG.
  await prisma.grantChangeAudit.create({ data: {
    id: '3f7cf4c5-7777-4777-8777-777777777777',
    migrationId: 'agentcore-trusted-fleet-grant-supply-v1',
    sourceGitCommit: 'b'.repeat(40), operatorId: 'fleet-operator', approvalRef: 'fleet-approval',
    reason: 'older fleet supply', clientId: TARGET_PUBLIC, changeType: 'create',
    expectedGrantVersion: null, resultingGrantVersion: 1,
    beforeValue: undefined, afterValue: expectedSnapshot(SOURCE, 1), timestamp: CREATED,
  } });
  if (options.fmgAudit) {
    const applyPlan = canonicalPlan('APPLY');
    await prisma.grantChangeAudit.create({ data: {
      id: '2f7cf4c5-8888-4888-8888-888888888888',
      migrationId: 'forum-moderator-grant-supply-v1',
      sourceGitCommit: descriptor.audit_metadata.source_git_commit,
      operatorId: descriptor.audit_metadata.operator_id,
      approvalRef: descriptor.audit_metadata.approval_ref,
      reason: options.fmgAudit === 'wrong-reason'
        ? `forum_moderator_grant_supply_v1 plan_sha256=${'f'.repeat(64)}`
        : `forum_moderator_grant_supply_v1 plan_sha256=${applyPlan.digest}`,
      clientId: TARGET_PUBLIC, changeType: 'replace', expectedGrantVersion: 1,
      resultingGrantVersion: 2,
      beforeValue: expectedSnapshot(SOURCE, 1),
      afterValue: options.fmgAudit === 'wrong-snapshot'
        ? { ...expectedSnapshot(TARGET, 2), status: 'revoked' }
        : expectedSnapshot(TARGET, 2),
      timestamp: CREATED,
    } });
  }
}

function canonicalPlan(kind: 'APPLY' | 'EXACT_RERUN_NOOP') {
  const noop = kind === 'EXACT_RERUN_NOOP';
  const document = {
    plan_version: 'AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1_PLAN_1',
    classification: kind,
    agent_id: AGENT_ID,
    principal_external_ref: PRINCIPAL_EXTERNAL_REF,
    client_external_ref: CLIENT_EXTERNAL_REF,
    client_id: TARGET_PUBLIC,
    audience: 'svc-forum',
    expected_audience_scopes: noop ? TARGET : SOURCE,
    target_audience_scopes: TARGET,
    expected_grant_version: noop ? 2 : 1,
    expected_grant_scopes: noop ? TARGET : SOURCE,
    target_grant_version: 2,
    target_grant_scopes: TARGET,
    operation: noop ? 'NONE' : 'UPDATE_AUDIENCE_AND_GRANT',
  };
  const canonical = JSON.stringify(canonicalJson(document));
  return { canonical, digest: createHash('sha256').update(Buffer.from(canonical)).digest('hex'), document };
}

function invokeProcess(command: string, args: string[], environment: Record<string, string> = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp', ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function currentInvariantDigest(): Promise<string> {
  const clients = (await prisma.machineClient.findMany({ orderBy: { clientId: 'asc' } })).map((row) => ({
    id: row.id, client_id: row.clientId, external_ref: row.externalRef,
    machine_principal_id: row.machinePrincipalId, status: row.status,
    created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
    rotated_at: row.rotatedAt?.toISOString() ?? null, revoked_at: row.revokedAt?.toISOString() ?? null,
  }));
  const rows = (await prisma.machineAccessGrant.findMany({
    orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }],
  })).filter((row) => !(row.machineClientId === TARGET_CLIENT_INTERNAL && row.audienceId === 'svc-forum'))
    .map((row) => ({
      machine_client_id: row.machineClientId, audience_id: row.audienceId, scopes: [...row.scopes],
      version: row.version, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
    }));
  return createHash('sha256').update(JSON.stringify(canonicalJson({
    clients,
    non_target_and_workflow_grants: rows,
  }))).digest('hex');
}

async function invokeConformance(value: unknown = descriptor, mode = '--conformance-apply') {
  let resolved = value;
  if (resolved !== null && typeof resolved === 'object' && !Array.isArray(resolved)
      && (resolved as Record<string, unknown>).invariant_sha256 === descriptor.invariant_sha256) {
    resolved = { ...(resolved as Record<string, unknown>), invariant_sha256: await currentInvariantDigest() };
  }
  return invokeProcess('/bin/bash', [
    '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" "$4" --descriptor-fd 3',
    'fmg-test', typeof resolved === 'string' ? resolved : JSON.stringify(resolved), NODE, SCRIPT, mode,
  ]);
}

async function invokeArgs(args: string[], databaseUrl?: string) {
  const environment = databaseUrl === undefined ? {} : { DATABASE_URL: databaseUrl };
  return invokeProcess(NODE, ['--import', 'tsx', SCRIPT, ...args], environment);
}

async function invokeAuthorization(authorization: unknown) {
  return invokeProcess('/bin/bash', [
    '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --apply --authorization-fd 3',
    'fmg-auth-test', JSON.stringify(authorization), NODE, SCRIPT,
  ], { DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/must_not_connect' });
}

async function invokeVerifyMintAuthorization(authorization: unknown) {
  return invokeProcess('/bin/bash', [
    '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --verify-mint --authorization-fd 3',
    'fmg-verify-mint-test', JSON.stringify(authorization), NODE, SCRIPT,
  ], { DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/must_not_connect' });
}

function parsePlanOutput(stdout: string) {
  const lines = stdout.trim().split('\n');
  assert.ok(lines.length >= 5, `expected canonical plan output, received ${stdout}`);
  const canonical = lines[0];
  const digestLine = lines.find((line) => line.startsWith('PLAN_SHA256='));
  const classLine = lines.find((line) => line.startsWith('PLAN_CLASSIFICATION='));
  const invariantLine = lines.find((line) => line.startsWith('INVARIANT_GRANTS_SHA256='));
  assert.ok(digestLine); assert.ok(classLine); assert.ok(invariantLine);
  return {
    canonical,
    document: JSON.parse(canonical) as Record<string, unknown>,
    digest: digestLine.slice('PLAN_SHA256='.length),
    classification: classLine.slice('PLAN_CLASSIFICATION='.length),
    invariantDigest: invariantLine.slice('INVARIANT_GRANTS_SHA256='.length),
  };
}

async function stateSnapshot() {
  const [audiences, principals, clients, grants, audits] = await Promise.all([
    prisma.authAudience.findMany({ orderBy: { audienceId: 'asc' } }),
    prisma.machinePrincipal.findMany({ orderBy: { id: 'asc' } }),
    prisma.machineClient.findMany({ orderBy: { id: 'asc' } }),
    prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }),
    prisma.grantChangeAudit.findMany({ orderBy: [{ timestamp: 'asc' }, { id: 'asc' }] }),
  ]);
  return { audiences, principals, clients, grants, audits };
}

await test('static boundary pins Serializable lock/order, guarded updates, and secret-free selects', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  const audienceLock = source.indexOf('LOCK TABLE auth_audiences IN SHARE ROW EXCLUSIVE MODE');
  const grantLock = source.indexOf('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
  const auditLock = source.indexOf('LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE');
  const advisory = source.indexOf('pg_advisory_xact_lock');
  const classify = source.indexOf('const classification = await classify(tx);');
  const audienceUpdate = source.indexOf('UPDATE auth_audiences SET registered_scopes');
  const grantUpdate = source.indexOf('UPDATE machine_access_grants SET scopes');
  const auditInsert = source.indexOf('tx.grantChangeAudit.create');
  assert.ok(audienceLock >= 0 && grantLock > audienceLock && auditLock > grantLock
    && advisory > auditLock && classify > advisory && audienceUpdate > classify
    && grantUpdate > audienceUpdate && auditInsert > grantUpdate);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.match(source, /WHERE machine_client_id = \$4::uuid AND audience_id = \$5/);
  assert.match(source, /AND scopes = ARRAY\[\$6,\$7\]::text\[\] AND version = 1/);
  assert.doesNotMatch(source, /select:\s*\{[^}]*secretHash/s);
  assert.doesNotMatch(source, /select:\s*\{[^}]*allowedResources/s);
  assert.doesNotMatch(source, /select:\s*\{[^}]*allowedScopes/s);
});

await test('Bundle 1.5.0 freezes exact moderator fixture polarity and forbidden negatives', () => {
  const registry = JSON.parse(readFileSync(path.join(ROOT, 'contract-bundles/minimal-auth-v1/audience-registry.json'), 'utf8'));
  const positives = JSON.parse(readFileSync(path.join(ROOT, 'contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json'), 'utf8'));
  const negatives = JSON.parse(readFileSync(path.join(ROOT, 'contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json'), 'utf8'));
  const forum = registry.audiences.find((entry: Record<string, unknown>) => entry.audience_id === 'svc-forum');
  assert.deepEqual(forum.registered_scopes, TARGET);
  assert.equal(registry.audiences.some((entry: { registered_scopes: string[] }) =>
    entry.registered_scopes.some((scope) => scope === 'forum.admin' || scope === '*' || scope.includes('*'))), false);
  const moderator = positives.fixtures.find((entry: Record<string, unknown>) => entry.name === 'direct-agent-svc-forum-moderator');
  assert.ok(moderator);
  assert.equal(moderator.claims.scope, TARGET.join(' '));
  assert.equal(moderator.authorization_context.requested_scope, TARGET.join(' '));
  assert.deepEqual(moderator.authorization_context.machine_access_grants['svc-forum'], TARGET);
  const names = new Set(negatives.cases.map((entry: Record<string, unknown>) => entry.name));
  assert.equal(names.has('direct-svc-forum-unregistered-scope-moderate'), false);
  for (const name of ['direct-svc-forum-unregistered-scope-admin', 'direct-svc-forum-wildcard-scope-rejected',
    'direct-svc-forum-namespace-wildcard-scope-rejected']) assert.equal(names.has(name), true, name);
});

await test('planning refuses a tampered or non-1.5 runtime Bundle before DB writes', async () => {
  await seed();
  const before = await stateSnapshot();
  const runtimePath = path.join(ROOT, 'generated/minimal-auth-v1/runtime-contract.json');
  const original = readFileSync(runtimePath, 'utf8');
  const originalMode = statSync(runtimePath).mode & 0o777;
  const tampered = JSON.parse(original);
  tampered.payload.contractVersion = '1.4.0';
  chmodSync(runtimePath, 0o600);
  writeFileSync(runtimePath, JSON.stringify(tampered));
  try {
    const result = await invokeArgs([], superuserUrl);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /integrity-invalid|digest mismatch|must be exactly 1\.5\.0/);
    assert.deepEqual(await stateSnapshot(), before);
  } finally {
    writeFileSync(runtimePath, original);
    chmodSync(runtimePath, originalMode);
  }
});

await test('source plan is canonical APPLY with deterministic digest and zero writes', async () => {
  await seed();
  const before = await stateSnapshot();
  assert.equal(before.clients.filter((client) => client.clientId !== TARGET_PUBLIC).length, 85,
    'snapshot-bound target + 85 non-target fleet projection');
  const result = await invokeArgs([], superuserUrl);
  assert.equal(result.code, 0, result.stderr);
  const parsed = parsePlanOutput(result.stdout);
  const expected = canonicalPlan('APPLY');
  assert.equal(parsed.canonical, expected.canonical);
  assert.equal(parsed.digest, expected.digest);
  assert.equal(parsed.classification, 'APPLY');
  assert.equal(parsed.invariantDigest, await currentInvariantDigest());
  assert.equal(createHash('sha256').update(Buffer.from(parsed.canonical)).digest('hex'), parsed.digest);
  assert.match(result.stdout, /PLAN_WRITES=0/);
  assert.deepEqual(await stateSnapshot(), before, 'plan is read-only');
});

await test('conformance apply rejects a stale plan digest with zero writes', async () => {
  await seed();
  const before = await stateSnapshot();
  const result = await invokeConformance({ ...descriptor, plan_sha256: 'f'.repeat(64) });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /supplied plan_sha256 does not match/);
  assert.deepEqual(await stateSnapshot(), before);
});

await test('conformance apply rejects non-target Grant digest drift with zero FMG writes', async () => {
  await seed();
  const reviewedDigest = await currentInvariantDigest();
  await prisma.$executeRawUnsafe(
    "UPDATE machine_access_grants SET version = 9 WHERE machine_client_id = $1::uuid AND audience_id = 'svc-workflow'",
    SENTINEL_CLIENT_INTERNAL,
  );
  const before = await stateSnapshot();
  const result = await invokeConformance({ ...descriptor, invariant_sha256: reviewedDigest });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /invariant digest differs from the reviewed prestate/);
  assert.deepEqual(await stateSnapshot(), before);
});

await test('a newly added zero-Grant non-target Client changes the reviewed invariant digest', async () => {
  await seed();
  const reviewedDigest = await currentInvariantDigest();
  const principalId = '50000000-0000-4000-8000-000000000099';
  await prisma.machinePrincipal.create({ data: {
    id: principalId, principalType: 'agent', agentId: 'agt_zero-grant-drift',
    externalRef: 'agentcore:v1:principal:agt_zero-grant-drift', status: 'active',
    createdAt: CREATED, updatedAt: CREATED,
  } });
  await prisma.machineClient.create({ data: {
    id: '60000000-0000-4000-8000-000000000099', clientId: `mc_${'9'.repeat(24)}`,
    machinePrincipalId: principalId, externalRef: 'agentcore:v1:client:agt_zero-grant-drift',
    secretHash: 'zero-grant-secret-hash', status: 'active', allowedResources: [], allowedScopes: [],
    createdAt: CREATED, updatedAt: CREATED,
  } });
  const before = await stateSnapshot();
  const result = await invokeConformance({ ...descriptor, invariant_sha256: reviewedDigest });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /invariant digest differs from the reviewed prestate/);
  assert.deepEqual(await stateSnapshot(), before);
});

await test('source to target succeeds atomically with exact audit and byte-stable invariants', async () => {
  await seed();
  const before = await stateSnapshot();
  const nonTargetBefore = before.grants.filter(
    (row) => !(row.machineClientId === TARGET_CLIENT_INTERNAL && row.audienceId === 'svc-forum'),
  );
  const nonTargetDigestBefore = createHash('sha256').update(JSON.stringify(nonTargetBefore)).digest('hex');
  const invariantDigestBefore = await currentInvariantDigest();
  const sourcePlan = canonicalPlan('APPLY');
  const result = await invokeConformance();
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /"outcome":"replace"/);
  assert.match(result.stdout, /"audience_rows_updated":1/);
  assert.match(result.stdout, /"grant_rows_updated":1/);
  assert.match(result.stdout, /"audits_created":1/);

  const forumAudience = await prisma.authAudience.findUniqueOrThrow({ where: { audienceId: 'svc-forum' } });
  assert.deepEqual(forumAudience.registeredScopes, TARGET);
  const beforeAudience = before.audiences.find((row) => row.audienceId === 'svc-forum')!;
  assert.deepEqual({ ...forumAudience, registeredScopes: SOURCE }, beforeAudience,
    'only registered_scopes changed on the Audience row');

  const targetForum = await prisma.machineAccessGrant.findUniqueOrThrow({
    where: { machineClientId_audienceId: { machineClientId: TARGET_CLIENT_INTERNAL, audienceId: 'svc-forum' } },
  });
  assert.deepEqual(targetForum.scopes, TARGET);
  assert.equal(targetForum.version, 2);
  const beforeTargetForum = before.grants.find((row) => row.machineClientId === TARGET_CLIENT_INTERNAL && row.audienceId === 'svc-forum')!;
  assert.deepEqual({ ...targetForum, scopes: SOURCE, version: 1 }, beforeTargetForum,
    'only scopes and version changed on the target Grant');

  assert.deepEqual(await prisma.machinePrincipal.findMany({ orderBy: { id: 'asc' } }), before.principals,
    'Principal rows byte-stable');
  assert.deepEqual(await prisma.machineClient.findMany({ orderBy: { id: 'asc' } }), before.clients,
    'Client and credential/legacy fields byte-stable');
  const workflowAndNonTargetAfter = (await prisma.machineAccessGrant.findMany({
    where: { NOT: { machineClientId: TARGET_CLIENT_INTERNAL, audienceId: 'svc-forum' } },
    orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }],
  }));
  const workflowAndNonTargetBefore = before.grants.filter(
    (row) => !(row.machineClientId === TARGET_CLIENT_INTERNAL && row.audienceId === 'svc-forum'),
  );
  assert.deepEqual(workflowAndNonTargetAfter, workflowAndNonTargetBefore,
    'Workflow, non-target, and legacy Grant rows byte-stable');
  const nonTargetDigestAfter = createHash('sha256').update(JSON.stringify(workflowAndNonTargetAfter)).digest('hex');
  assert.equal(nonTargetDigestAfter, nonTargetDigestBefore, 'non-target grants digest unchanged');

  const audits = await prisma.grantChangeAudit.findMany({
    where: { migrationId: 'forum-moderator-grant-supply-v1', clientId: TARGET_PUBLIC },
  });
  assert.equal(audits.length, 1);
  const audit = audits[0];
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
  assert.deepEqual(Object.keys(envelope).sort(), [
    'after_value', 'approval_ref', 'before_value', 'change_id', 'change_type', 'client_id',
    'expected_grant_version', 'migration_id', 'operator_id', 'reason',
    'resulting_grant_version', 'source_git_commit', 'timestamp',
  ]);
  assert.equal(audit.sourceGitCommit, descriptor.audit_metadata.source_git_commit);
  assert.equal(audit.operatorId, descriptor.audit_metadata.operator_id);
  assert.equal(audit.approvalRef, descriptor.audit_metadata.approval_ref);
  assert.equal(audit.reason, `forum_moderator_grant_supply_v1 plan_sha256=${sourcePlan.digest}`);
  assert.equal(audit.changeType, 'replace');
  assert.equal(audit.expectedGrantVersion, 1); assert.equal(audit.resultingGrantVersion, 2);
  assert.deepEqual(audit.beforeValue, expectedSnapshot(SOURCE, 1));
  assert.deepEqual(audit.afterValue, expectedSnapshot(TARGET, 2));
  assert.equal(await prisma.grantChangeAudit.count(), before.audits.length + 1,
    'older fleet audit retained and exactly one FMG audit appended');

  const verify = await invokeArgs([
    '--verify-state', '--expected-invariant-sha256', invariantDigestBefore,
  ], superuserUrl);
  assert.equal(verify.code, 0, verify.stderr);
  assert.match(verify.stdout, /FMG_VERIFY_STATE=PASS/);
});

await test('exact target plan and apply are deterministic NOOP with a digest distinct from APPLY', async () => {
  await seed();
  assert.equal((await invokeConformance()).code, 0);
  const before = await stateSnapshot();
  const plan = await invokeArgs([], superuserUrl);
  assert.equal(plan.code, 0, plan.stderr);
  const parsed = parsePlanOutput(plan.stdout);
  const expectedNoop = canonicalPlan('EXACT_RERUN_NOOP');
  assert.equal(parsed.canonical, expectedNoop.canonical);
  assert.equal(parsed.digest, expectedNoop.digest);
  assert.equal(parsed.classification, 'EXACT_RERUN_NOOP');
  assert.notEqual(parsed.digest, canonicalPlan('APPLY').digest);
  const rerun = await invokeConformance({
    ...descriptor,
    plan_sha256: expectedNoop.digest,
  });
  assert.equal(rerun.code, 0, rerun.stderr);
  assert.match(rerun.stdout, /"outcome":"noop"/);
  assert.match(rerun.stdout, /"audience_rows_updated":0/);
  assert.match(rerun.stdout, /"grant_rows_updated":0/);
  assert.match(rerun.stdout, /"audits_created":0/);
  const rerunProjection = JSON.parse(rerun.stdout.trim()).safe_target_projection;
  assert.deepEqual(rerunProjection, expectedSnapshot(TARGET, 2), 'NOOP returns the exact safe target projection');
  assert.deepEqual(await stateSnapshot(), before, 'NOOP is byte-stable');
});

await test('exact target NOOP permits a fresh authorized operator without rewriting the original audit', async () => {
  await seed();
  assert.equal((await invokeConformance()).code, 0);
  const before = await stateSnapshot();
  const result = await invokeConformance({
    ...descriptor,
    plan_sha256: canonicalPlan('EXACT_RERUN_NOOP').digest,
    audit_metadata: { ...descriptor.audit_metadata, operator_id: 'fresh-rerun-operator' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /"outcome":"noop"/);
  assert.deepEqual(await stateSnapshot(), before);
});

for (const scenario of [
  { name: 'Audience target with source Grant', options: { audienceScopes: TARGET } },
  { name: 'Grant target with source Audience', options: { grantScopes: TARGET, grantVersion: 2 } },
  { name: 'wrong source Grant version', options: { grantVersion: 9 } },
  { name: 'extra target Grant scope', options: { grantScopes: [...SOURCE, 'forum.admin'] } },
  { name: 'Workflow scope drift', options: { workflowScopes: ['workflow.execute', 'workflow.read'] } },
  { name: 'Workflow version drift', options: { workflowVersion: 2 } },
  { name: 'foreign moderate Grant', options: { foreignModerate: true } },
  { name: 'wrong target Client external ref', options: { targetExternalRef: 'agentcore:v1:client:wrong-target' } },
  { name: 'inactive target Client', options: { targetStatus: 'revoked' as const } },
  { name: 'revoked-at target Client', options: { targetRevoked: true } },
  { name: 'inactive target Principal', options: { principalStatus: 'disabled' as const } },
  { name: 'disabled-at target Principal', options: { principalDisabled: true } },
  { name: 'target without governed audit', options: { audienceScopes: TARGET, grantScopes: TARGET, grantVersion: 2 } },
  {
    name: 'target with wrong governed audit digest',
    options: { audienceScopes: TARGET, grantScopes: TARGET, grantVersion: 2, fmgAudit: 'wrong-reason' as const },
  },
  {
    name: 'target with drifted governed audit snapshot',
    options: { audienceScopes: TARGET, grantScopes: TARGET, grantVersion: 2, fmgAudit: 'wrong-snapshot' as const },
  },
] as const) {
  await test(`drift fails closed with zero writes: ${scenario.name}`, async () => {
    await seed(scenario.options as SeedOptions);
    const before = await stateSnapshot();
    const result = await invokeConformance();
    assert.equal(result.code, 1, `expected refusal; stdout=${result.stdout}`);
    assert.match(result.stderr, /CONFLICT|FMG refused/);
    assert.deepEqual(await stateSnapshot(), before);
  });
}

await test('a concurrent non-cooperating Grant writer commits first and FMG conflicts', async () => {
  await seed();
  const reviewedDigest = await currentInvariantDigest();
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "UPDATE machine_access_grants SET version = 8 WHERE machine_client_id = $1::uuid AND audience_id = 'svc-workflow'",
      SENTINEL_CLIENT_INTERNAL,
    );
    pending = invokeConformance({ ...descriptor, invariant_sha256: reviewedDigest });
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  const result = await pending!;
  assert.equal(result.code, 1);
  assert.match(result.stderr, /invariant digest differs from the reviewed prestate/);
  assert.equal(await prisma.grantChangeAudit.count({
    where: { migrationId: 'forum-moderator-grant-supply-v1' },
  }), 0);
});

await test('injected audit failure rolls Audience and Grant changes back', async () => {
  await seed();
  const before = await stateSnapshot();
  await prisma.$executeRawUnsafe(
    "CREATE FUNCTION fmg_test_reject_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected FMG audit failure'; END; $$;",
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER fmg_test_reject_audit_insert BEFORE INSERT ON grant_change_audits '
      + 'FOR EACH ROW EXECUTE FUNCTION fmg_test_reject_audit_insert()',
  );
  const result = await invokeConformance();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /injected FMG audit failure/);
  assert.deepEqual(await stateSnapshot(), before, 'all transaction writes rolled back');
  await prisma.$executeRawUnsafe('DROP TRIGGER fmg_test_reject_audit_insert ON grant_change_audits');
  await prisma.$executeRawUnsafe('DROP FUNCTION fmg_test_reject_audit_insert()');
});

await test('post-commit unknown outcome performs read-only reconciliation and never blind-retries', async () => {
  await seed();
  const invariantDigest = await currentInvariantDigest();
  const result = await invokeConformance(descriptor, '--conformance-outcome-unknown');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /OUTCOME_UNKNOWN/);
  assert.match(result.stdout, /"operation":"read-only-reconcile-after-outcome-unknown"/);
  assert.match(result.stdout, /"classification":"EXACT_RERUN_NOOP"/);
  assert.match(result.stdout, /"writes_after_unknown":0/);
  assert.match(result.stdout, /"retry_attempted":false/);
  assert.equal(await currentInvariantDigest(), invariantDigest);
  assert.equal(await prisma.grantChangeAudit.count({
    where: { migrationId: 'forum-moderator-grant-supply-v1', clientId: TARGET_PUBLIC },
  }), 1);
});

await test('production --apply refuses a valid authorization before any database connection', async () => {
  const authorization = {
    schema_version: 1,
    authorization_kind: 'forum_moderator_grant_supply_v1_production_apply',
    implementation_commit: 'a'.repeat(40),
    bundle_version: '1.5.0',
    bundle_digest: 'b'.repeat(64),
    plan_sha256: canonicalPlan('APPLY').digest,
    prestate_digest: 'c'.repeat(64),
    operator_id: 'authorized-operator',
    approval_ref: 'https://github.com/mayf3/auth-service/issues/1#issuecomment-2',
    outage_approval_ref: 'https://github.com/mayf3/auth-service/issues/1#issuecomment-3',
    stop_command: 'systemctl stop auth-service',
    start_command: 'systemctl start auth-service',
    rollback_ref: 'https://github.com/mayf3/auth-service/issues/1#rollback',
    verify_command: `node --import tsx scripts/supply-forum-moderator-grant-v1.ts --verify-state --expected-invariant-sha256 ${'c'.repeat(64)}`,
  };
  const started = Date.now();
  const result = await invokeAuthorization(authorization);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /PRODUCTION_APPLY_AUTHORITY=none/);
  assert.doesNotMatch(result.stderr, /connect|ECONNREFUSED|PrismaClientInitializationError/i);
  assert.ok(Date.now() - started < 10_000, 'refusal did not wait on a database connection');
});

await test('verify-mint requires its own authorization and refuses before credential or network access', async () => {
  const result = await invokeVerifyMintAuthorization({
    schema_version: 1,
    authorization_kind: 'forum_moderator_grant_supply_v1_verify_mint',
    implementation_commit: 'a'.repeat(40),
    bundle_version: '1.5.0',
    operator_id: 'verification-operator',
    approval_ref: 'https://github.com/mayf3/auth-service/issues/1#apply',
    verification_authorization_ref: 'https://github.com/mayf3/auth-service/issues/1#verify-mint',
    token_endpoint: 'https://auth.example.invalid/oauth/token',
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /FUNCTIONAL_MINT_VERIFICATION_AUTHORITY=none/);
  assert.match(result.stderr, /no credential was read and no token request was sent/);
  assert.doesNotMatch(result.stderr, /connect|ECONNREFUSED|PrismaClientInitializationError/i);
});

await test('descriptor seam rejects wrong ownership, duplicate JSON members, and regular files', async () => {
  await seed();
  const wrongNonce = await invokeConformance({ ...descriptor, nonce: '0'.repeat(64) });
  assert.equal(wrongNonce.code, 1);
  const duplicate = `{"schema_version":1,"schema_version":1,"container_id":"${descriptor.container_id}",`
    + `"nonce":"${descriptor.nonce}","host_port":${descriptor.host_port},"database":"${descriptor.database}",`
    + `"plan_sha256":"${descriptor.plan_sha256}","invariant_sha256":"${descriptor.invariant_sha256}",`
    + `"audit_metadata":${JSON.stringify(descriptor.audit_metadata)}}`;
  const duplicateResult = await invokeConformance(duplicate);
  assert.equal(duplicateResult.code, 1);
  assert.match(duplicateResult.stderr, /duplicate member schema_version/);

  const temporary = mkdtempSync(path.join(tmpdir(), 'fmg-descriptor-'));
  const descriptorPath = path.join(temporary, 'descriptor.json');
  writeFileSync(descriptorPath, JSON.stringify(descriptor));
  try {
    const regular = await invokeProcess('/bin/bash', [
      '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'fmg-regular-fd', descriptorPath, NODE, SCRIPT,
    ]);
    assert.equal(regular.code, 1);
    assert.match(regular.stderr, /descriptor must be a FIFO/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

await test('secret canary never appears in plan/apply/verify/error/audit channels', async () => {
  await seed();
  const plan = await invokeArgs([], superuserUrl);
  const invariantDigest = parsePlanOutput(plan.stdout).invariantDigest;
  const apply = await invokeConformance();
  const verify = await invokeArgs([
    '--verify-state', '--expected-invariant-sha256', invariantDigest,
  ], superuserUrl);
  await prisma.$executeRawUnsafe(
    "UPDATE machine_access_grants SET scopes = ARRAY['workflow.execute']::text[] "
      + "WHERE machine_client_id = $1::uuid AND audience_id = 'svc-workflow'",
    TARGET_CLIENT_INTERNAL,
  );
  const error = await invokeArgs([], superuserUrl);
  const audits = await prisma.grantChangeAudit.findMany({ orderBy: { id: 'asc' } });
  const captured = [plan.stdout, plan.stderr, apply.stdout, apply.stderr, verify.stdout, verify.stderr,
    error.stdout, error.stderr, JSON.stringify(audits)].join('\n');
  assert.doesNotMatch(captured, new RegExp(SECRET_CANARY));
  assert.doesNotMatch(captured, /Bearer\s|Basic\s|client_secret/i);
});

after(async () => {
  await prisma.$disconnect();
});
