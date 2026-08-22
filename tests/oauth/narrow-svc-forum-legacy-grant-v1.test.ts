import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test, { after } from 'node:test';
import { PrismaClient } from '@prisma/client';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRIPT = path.join(ROOT, 'scripts/narrow-svc-forum-legacy-grant-v1.ts');
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
  schema_version: 1; container_id: string; nonce: string; host_port: number;
  database: string; audit_metadata: Record<string, string>;
};
const superuserUrl = `postgresql://postgres@127.0.0.1:${descriptor.host_port}/${descriptor.database}?schema=public`;
const prisma = new PrismaClient({ datasources: { db: { url: superuserUrl } } });

// Frozen production coordinates under test (not secrets).
const TARGET_CLIENT_ID = 'mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd';
const TARGET_CLIENT_INTERNAL_ID = 'b4f209b3-968c-4bf2-8aac-4b9528752e75';
const TARGET_PRINCIPAL_ID = '132ab857-35ab-408b-b909-bc0b1deab55b';
const SENTINEL_PRINCIPAL = '10000000-0000-4000-8000-0000000000aa';
const SENTINEL_CLIENT_INTERNAL = '20000000-0000-4000-8000-0000000000aa';
const SENTINEL_PUBLIC = 'mc_' + 's'.repeat(24);
const PROXY_PRINCIPAL = '10000000-0000-4000-8000-0000000000cc';
const CREATED = new Date('2026-07-20T13:52:14.936Z');

const DRIFT = ['forum.moderate', 'forum.read', 'forum.write'];
const TARGET = ['forum.read', 'forum.write'];

type SeedOptions = {
  forumScopes?: string[];
  forumVersion?: number;
  omitClient?: boolean;
  wrongInternalId?: boolean;
  wrongPrincipalId?: boolean;
  principalStatus?: 'active' | 'disabled';
  principalDisabled?: boolean;
  clientStatus?: 'active' | 'revoked';
  clientRevoked?: boolean;
  omitForumGrant?: boolean;
  delegationGrant?: boolean;
  replaceAudits?: Array<{ migrationId?: string; reason?: string }>;
};

async function invoke(extraDescriptor: unknown = descriptor) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'svc-forum-narrow-test', JSON.stringify(extraDescriptor), NODE, SCRIPT,
    ], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function invokeArgs(args: string[], environment: Record<string, string | undefined> = {}) {
  const provided: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined) provided[key] = value;
  }
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(NODE, ['--import', 'tsx', SCRIPT, ...args], {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
        HOME: process.env.HOME ?? '/tmp',
        ...provided,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function expectedSnapshot(forumScopes: string[], revision: number) {
  return {
    client_id: TARGET_CLIENT_ID,
    client_kind: 'machine',
    principal_id: TARGET_PRINCIPAL_ID,
    principal_type: 'agent',
    human_audience_grants: [],
    machine_access_grants: { 'svc-forum': [...forumScopes].sort(), 'svc-workflow': ['workflow.read'] },
    delegation_grants: {},
    status: 'active',
    version: revision,
  };
}

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE machine_access_grants, grant_change_audits, delegation_grants, proxy_accepted_subject_audiences, '
      + 'trusted_proxies, machine_clients, machine_principals, auth_audiences RESTART IDENTITY CASCADE',
  );
}

async function seed(options: SeedOptions = {}): Promise<void> {
  await reset();
  for (const [audienceId, scopes] of [['svc-forum', DRIFT], ['svc-workflow', ['workflow.read']]] as const) {
    await prisma.authAudience.create({ data: {
      audienceId, resourceService: audienceId, scopeNamespace: audienceId.split('-')[1],
      acceptedPrincipalTypes: ['agent'], registeredScopes: [...scopes],
      humanAccessEnabled: false, machineAccessEnabled: true, delegatedAccessEnabled: false,
      status: 'active', freezeReady: true, version: 1, createdAt: CREATED, updatedAt: CREATED,
    } });
  }
  await prisma.machinePrincipal.create({ data: {
    id: TARGET_PRINCIPAL_ID, principalType: 'agent', status: options.principalStatus ?? 'active',
    disabledAt: options.principalDisabled ? CREATED : null, createdAt: CREATED, updatedAt: CREATED,
  } });
  await prisma.machinePrincipal.create({ data: {
    id: SENTINEL_PRINCIPAL, principalType: 'agent', status: 'active', createdAt: CREATED, updatedAt: CREATED,
  } });
  await prisma.machineClient.create({ data: {
    id: SENTINEL_CLIENT_INTERNAL, clientId: SENTINEL_PUBLIC, machinePrincipalId: SENTINEL_PRINCIPAL,
    secretHash: 'sentinel', status: 'active', allowedResources: [], allowedScopes: [],
    createdAt: CREATED, updatedAt: CREATED,
  } });
  await prisma.machineAccessGrant.create({ data: {
    machineClientId: SENTINEL_CLIENT_INTERNAL, audienceId: 'svc-forum', scopes: TARGET, version: 1,
    createdAt: CREATED, updatedAt: CREATED,
  } });
  if (options.delegationGrant) {
    await prisma.machinePrincipal.create({ data: {
      id: PROXY_PRINCIPAL, principalType: 'service', status: 'active', createdAt: CREATED, updatedAt: CREATED,
    } });
  }
  if (!options.omitClient) {
    const targetInternalId = options.wrongInternalId
      ? 'b4f209b3-968c-4bf2-8aac-4b9528752e76'
      : TARGET_CLIENT_INTERNAL_ID;
    await prisma.machineClient.create({ data: {
      id: targetInternalId,
      clientId: TARGET_CLIENT_ID,
      machinePrincipalId: options.wrongPrincipalId ? SENTINEL_PRINCIPAL : TARGET_PRINCIPAL_ID,
      secretHash: 'legacy', status: options.clientStatus ?? 'active',
      allowedResources: ['svc-forum'], allowedScopes: DRIFT,
      revokedAt: options.clientRevoked ? CREATED : null,
      createdAt: CREATED, updatedAt: CREATED,
    } });
    if (options.delegationGrant) {
      const proxy = await prisma.trustedProxy.create({ data: {
        proxyPrincipalId: PROXY_PRINCIPAL,
        proxyClientId: targetInternalId,
        status: 'active', version: 1, createdAt: CREATED, updatedAt: CREATED,
      } });
      await prisma.delegationGrant.create({ data: {
        trustedProxyId: proxy.id, audienceId: 'svc-forum', scopes: TARGET, version: 1,
        createdAt: CREATED, updatedAt: CREATED,
      } });
    }
    if (!options.omitForumGrant && !options.wrongInternalId) {
      await prisma.machineAccessGrant.create({ data: {
        machineClientId: targetInternalId, audienceId: 'svc-forum',
        scopes: options.forumScopes ?? DRIFT, version: options.forumVersion ?? 1,
        createdAt: CREATED, updatedAt: CREATED,
      } });
    }
    if (!options.wrongInternalId) {
      await prisma.machineAccessGrant.create({ data: {
        machineClientId: targetInternalId, audienceId: 'svc-workflow',
        scopes: ['workflow.read'], version: 1, createdAt: CREATED, updatedAt: CREATED,
      } });
    }
  }
  for (const auditOverride of options.replaceAudits ?? []) {
    await prisma.grantChangeAudit.create({ data: {
      migrationId: auditOverride.migrationId ?? descriptor.audit_metadata.migration_id,
      sourceGitCommit: descriptor.audit_metadata.source_git_commit,
      operatorId: descriptor.audit_metadata.operator_id,
      approvalRef: descriptor.audit_metadata.approval_ref,
      reason: auditOverride.reason ?? descriptor.audit_metadata.reason,
      clientId: TARGET_CLIENT_ID, changeType: 'replace',
      expectedGrantVersion: 1, resultingGrantVersion: 2,
      beforeValue: expectedSnapshot(DRIFT, 1), afterValue: expectedSnapshot(TARGET, 2),
      timestamp: CREATED,
    } });
  }
}

async function targetGrant() {
  const rows = await prisma.machineAccessGrant.findMany({
    where: { machineClientId: TARGET_CLIENT_INTERNAL_ID },
    orderBy: { audienceId: 'asc' },
  });
  return rows;
}
async function auditRows() {
  return prisma.grantChangeAudit.findMany({
    where: { clientId: TARGET_CLIENT_ID, changeType: 'replace' },
    orderBy: { timestamp: 'asc' },
  });
}
async function counts() {
  const [grants, audits, clients, principals] = await Promise.all([
    prisma.machineAccessGrant.count(),
    prisma.grantChangeAudit.count(),
    prisma.machineClient.count(),
    prisma.machinePrincipal.count(),
  ]);
  return { grants, audits, clients, principals };
}

async function assertNoWrites(): Promise<void> {
  const rows = await targetGrant();
  assert.equal(rows.length, 2, 'target client keeps both grant rows');
  const forum = rows.find((row) => row.audienceId === 'svc-forum');
  assert.ok(forum, 'svc-forum grant row exists');
  assert.deepEqual([...forum.scopes].sort(), DRIFT);
  assert.equal(forum.version, 1);
  assert.equal(forum.createdAt.getTime(), CREATED.getTime());
  assert.equal(forum.updatedAt.getTime(), CREATED.getTime());
  assert.equal((await counts()).audits, 0, 'no audit rows were created');
}

test('static: lock order, isolation, and single-row update form', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  const locks = source.indexOf("'LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE'");
  const advisory = source.indexOf('pg_advisory_xact_lock');
  const plan = source.indexOf('const plan = await loadPlan(tx, metadata);');
  const update = source.indexOf("'UPDATE machine_access_grants SET scopes = ARRAY[$1, $2]::text[], version = $3 '");
  const isolation = source.indexOf('Prisma.TransactionIsolationLevel.Serializable');
  assert.ok(locks >= 0 && advisory > locks && plan > advisory && update > plan,
    'locks precede advisory lock precede snapshot precede the single-row update');
  assert.ok(isolation > 0, 'Serializable isolation is pinned');
  assert.ok(source.includes('WHERE machine_client_id = $4::uuid AND audience_id = $5 AND version = $6'),
    'update is guarded to the frozen target row at the expected version');
  assert.ok(source.includes('principal: { select: { id: true, principalType: true, status: true, disabledAt: true } }'),
    'principal status and disabled_at are selected inside the locked transaction');
  assert.ok(source.includes("client.principal.status !== 'active'")
    && source.includes('client.principal.disabledAt !== null'),
    'principal active and disabled_at guards are both present');
});

test('plan mode reports replace from the drift state', async () => {
  await seed();
  const result = await invokeArgs([], { DATABASE_URL: superuserUrl });
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(payload.task, 'svc-forum-legacy-grant-narrowing-v1');
  assert.equal(payload.operation, 'plan');
  assert.equal(payload.outcome, 'replace');
  assert.deepEqual(payload.scopes_before, DRIFT);
  assert.deepEqual(payload.scopes_after, TARGET);
  await assertNoWrites();
});

test('conformance apply narrows the single grant row and writes the exact audit envelope', async () => {
  await seed();
  const before = await counts();
  const sentinelGrantBefore = await prisma.machineAccessGrant.findFirst({
    where: { machineClientId: SENTINEL_CLIENT_INTERNAL },
  });
  const clientBefore = await prisma.machineClient.findUnique({ where: { id: TARGET_CLIENT_INTERNAL_ID } });
  const principalBefore = await prisma.machinePrincipal.findUnique({ where: { id: TARGET_PRINCIPAL_ID } });

  const result = await invoke();
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(payload.operation, 'conformance-apply');
  assert.equal(payload.outcome, 'replace');
  assert.equal(payload.grant_rows_updated, 1);
  assert.equal(payload.audits_created, 1);

  const rows = await targetGrant();
  assert.equal(rows.length, 2);
  const forum = rows.find((row) => row.audienceId === 'svc-forum');
  const workflow = rows.find((row) => row.audienceId === 'svc-workflow');
  assert.ok(forum, 'svc-forum row present after apply');
  assert.ok(workflow, 'svc-workflow row present after apply');
  assert.deepEqual([...forum.scopes].sort(), TARGET);
  assert.equal(forum.version, 2);
  assert.equal(forum.createdAt.getTime(), CREATED.getTime(), 'created_at byte-stable');
  assert.equal(forum.updatedAt.getTime(), CREATED.getTime(), 'updated_at byte-stable');
  assert.deepEqual([...workflow.scopes].sort(), ['workflow.read']);
  assert.equal(workflow.version, 1, 'non-target grant version byte-stable');

  const audits = await auditRows();
  assert.equal(audits.length, 1);
  const audit = audits[0];
  assert.equal(audit.migrationId, descriptor.audit_metadata.migration_id);
  assert.equal(audit.sourceGitCommit, descriptor.audit_metadata.source_git_commit);
  assert.equal(audit.operatorId, descriptor.audit_metadata.operator_id);
  assert.equal(audit.approvalRef, descriptor.audit_metadata.approval_ref);
  assert.equal(audit.reason, descriptor.audit_metadata.reason);
  assert.equal(audit.expectedGrantVersion, 1);
  assert.equal(audit.resultingGrantVersion, 2);
  assert.deepEqual(audit.beforeValue, expectedSnapshot(DRIFT, 1));
  assert.deepEqual(audit.afterValue, expectedSnapshot(TARGET, 2));

  const sentinelGrantAfter = await prisma.machineAccessGrant.findFirst({
    where: { machineClientId: SENTINEL_CLIENT_INTERNAL },
  });
  assert.deepEqual(sentinelGrantAfter, sentinelGrantBefore, 'non-target client grant byte-stable');
  const clientAfter = await prisma.machineClient.findUnique({ where: { id: TARGET_CLIENT_INTERNAL_ID } });
  assert.deepEqual(clientAfter, clientBefore, 'client row byte-stable');
  const principalAfter = await prisma.machinePrincipal.findUnique({ where: { id: TARGET_PRINCIPAL_ID } });
  assert.deepEqual(principalAfter, principalBefore, 'principal row byte-stable');

  const after = await counts();
  assert.equal(after.grants, before.grants, 'no grant row added or removed');
  assert.equal(after.audits, before.audits + 1, 'exactly one audit created');
  assert.equal(after.clients, before.clients);
  assert.equal(after.principals, before.principals);
});

test('exact rerun is NOOP with zero writes', async () => {
  await seed();
  assert.equal((await invoke()).code, 0);
  const before = await counts();
  const rowsBefore = await targetGrant();
  const auditsBefore = await auditRows();

  const result = await invoke();
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(payload.outcome, 'noop');
  assert.equal(payload.grant_rows_updated, 0);
  assert.equal(payload.audits_created, 0);

  assert.deepEqual(await targetGrant(), rowsBefore, 'grant rows byte-stable on NOOP');
  assert.deepEqual(await auditRows(), auditsBefore, 'audit rows byte-stable on NOOP');
  const after = await counts();
  assert.deepEqual(after, before);

  const planAgain = await invokeArgs([], { DATABASE_URL: superuserUrl });
  assert.equal(planAgain.code, 0, planAgain.stderr);
  assert.equal((JSON.parse(planAgain.stdout) as Record<string, unknown>).outcome, 'noop');
});

test('rerun with mismatched audit metadata fails closed', async () => {
  await seed();
  assert.equal((await invoke()).code, 0);
  const before = await counts();
  const altered = JSON.parse(JSON.stringify(descriptor)) as typeof descriptor;
  altered.audit_metadata.reason = 'different reason for the same migration';
  const result = await invoke(altered);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /existing replace audit metadata does not match this execution/);
  assert.deepEqual(await counts(), before, 'zero writes on metadata mismatch');
});

test('audit insert failure rolls the whole transaction back', async () => {
  await seed();
  await prisma.$executeRawUnsafe(
    "CREATE FUNCTION reject_probe_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'probe rejects audit insert'; END; $$;",
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER grant_change_audits_no_insert BEFORE INSERT ON grant_change_audits '
      + 'FOR EACH ROW EXECUTE FUNCTION reject_probe_audit_insert()',
  );
  try {
    const result = await invoke();
    assert.equal(result.code, 1);
    assert.match(result.stderr, /probe rejects audit insert/);
    await assertNoWrites();
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER grant_change_audits_no_insert ON grant_change_audits');
    await prisma.$executeRawUnsafe('DROP FUNCTION reject_probe_audit_insert()');
  }
});

for (const scenario of [
  {
    name: 'target scopes without any replace audit',
    seed: { forumScopes: TARGET, forumVersion: 2 },
    message: /replace audits exist \(expected exactly 1\)/,
  },
  {
    name: 'target scopes with mismatched audit reason',
    seed: { forumScopes: TARGET, forumVersion: 2, replaceAudits: [{ reason: 'other reason' }] },
    message: /metadata does not match this execution|replace audits exist/,
  },
  {
    name: 'target scopes with duplicate replace audits',
    seed: {
      forumScopes: TARGET, forumVersion: 2,
      replaceAudits: [{}, { migrationId: 'svc-forum-narrow-second-migration' }],
    },
    message: /replace audits exist \(expected exactly 1\)/,
  },
  {
    name: 'drift state with a pre-existing replace audit',
    seed: { replaceAudits: [{}] },
    message: /replace audits already exist/,
  },
  {
    name: 'drift state at version 2',
    seed: { forumVersion: 2 },
    message: /version must be 1 in the drift state \(found 2\)/,
  },
  {
    name: 'target state at version 1',
    seed: { forumScopes: TARGET, forumVersion: 1 },
    message: /version must be 2 at the target scopes \(found 1\)/,
  },
  {
    name: 'four-scope set is neither drift nor target',
    seed: { forumScopes: ['forum.read', 'forum.write', 'forum.moderate', 'forum.admin'] },
    message: /must be exactly the drift set/,
  },
  {
    name: 'moderate-only scope set',
    seed: { forumScopes: ['forum.moderate'] },
    message: /must be exactly the drift set/,
  },
  {
    name: 'client missing entirely',
    seed: { omitClient: true },
    message: /target client must resolve exactly once/,
  },
  {
    name: 'client internal id drift',
    seed: { wrongInternalId: true },
    message: /internal id does not equal the frozen precondition/,
  },
  {
    name: 'client principal drift',
    seed: { wrongPrincipalId: true },
    message: /principal binding does not equal the frozen precondition/,
  },
  {
    name: 'principal inactive',
    seed: { principalStatus: 'disabled' },
    message: /PRINCIPAL_INACTIVE: target principal status must be active/,
  },
  {
    name: 'principal disabled_at is not null',
    seed: { principalDisabled: true },
    message: /PRINCIPAL_DISABLED: target principal disabled_at must be null/,
  },
  {
    name: 'client revoked',
    seed: { clientRevoked: true },
    message: /must not be revoked/,
  },
  {
    name: 'client inactive',
    seed: { clientStatus: 'revoked' },
    message: /status must be active/,
  },
  {
    name: 'no svc-forum grant at all',
    seed: { omitForumGrant: true },
    message: /exactly one svc-forum machine grant/,
  },
  {
    name: 'delegation grants present',
    seed: { delegationGrant: true },
    message: /delegation grants outside the narrowing precondition/,
  },
] as const) {
  test(`conflict fail-closed: ${scenario.name}`, async () => {
    await seed(scenario.seed as SeedOptions);
    const before = await counts();
    const result = await invoke();
    assert.equal(result.code, 1, `expected refusal, got stdout: ${result.stdout}`);
    assert.match(result.stderr, scenario.message);
    if (!scenario.seed.omitClient && !scenario.seed.wrongInternalId) {
      const rows = await targetGrant();
      const forum = rows.find((row) => row.audienceId === 'svc-forum');
      if (forum && !scenario.seed.omitForumGrant) {
        assert.deepEqual([...forum.scopes].sort(), (scenario.seed.forumScopes ?? DRIFT).slice().sort());
        assert.equal(forum.version, scenario.seed.forumVersion ?? 1);
      }
    }
    const expectedGrants = scenario.seed.omitClient || scenario.seed.wrongInternalId ? 1
      : scenario.seed.omitForumGrant ? 2 : 3;
    const afterCounts = await counts();
    assert.equal(afterCounts.grants, expectedGrants, 'grant rows unchanged');
    assert.deepEqual(afterCounts, before, 'conflict produces zero grant, audit, client, or principal writes');
  });
}

test('CLI form: apply refuses wrong source_git_commit, dirty worktree, and missing inputs', async () => {
  await seed();
  const head = execFileSync('/usr/bin/git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const flags = (commit: string) => [
    '--apply',
    '--migration-id', 'svc-forum-legacy-grant-narrowing-v1',
    '--source-git-commit', commit,
    '--operator-id', 'conformance-operator',
    '--approval-ref', 'https://github.com/mayf3/auth-service/issues/1#issuecomment-1',
    '--reason', 'conformance narrowing CLI form check',
  ];

  const wrongCommit = await invokeArgs(flags('a'.repeat(40)), { DATABASE_URL: superuserUrl });
  assert.equal(wrongCommit.code, 1);
  assert.match(wrongCommit.stderr, /source_git_commit must equal the clean worktree HEAD/);

  const noDatabase = await invokeArgs(flags(head), { DATABASE_URL: undefined });
  assert.equal(noDatabase.code, 1);
  assert.match(noDatabase.stderr, /DATABASE_URL is required for apply/);

  const missingFlags = await invokeArgs(['--apply', '--migration-id', 'x'], { DATABASE_URL: superuserUrl });
  assert.equal(missingFlags.code, 1);
  assert.match(missingFlags.stderr, /apply requires exactly the five audit metadata arguments/);

  const planNoDatabase = await invokeArgs([], { DATABASE_URL: undefined });
  assert.equal(planNoDatabase.code, 1);
  assert.match(planNoDatabase.stderr, /DATABASE_URL is required for read-only plan/);

  const unknownArg = await invokeArgs(['--apply', '--unexpected'], { DATABASE_URL: superuserUrl });
  assert.equal(unknownArg.code, 1);
  assert.match(unknownArg.stderr, /unknown argument --unexpected/);

  const dirtyPath = path.join(ROOT, 'narrowing-dirty-probe.tmp');
  writeFileSync(dirtyPath, 'dirty');
  try {
    const dirty = await invokeArgs(flags(head), { DATABASE_URL: superuserUrl });
    assert.equal(dirty.code, 1);
    assert.match(dirty.stderr, /worktree is dirty/);
  } finally {
    rmSync(dirtyPath);
  }
  await assertNoWrites();
});

after(async () => {
  await prisma.$disconnect();
});
