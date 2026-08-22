import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRIPT = path.join(ROOT, 'scripts/reconcile-svc-forum-audience-registry-v1.ts');
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
const databaseUrl = `postgresql://postgres@127.0.0.1:${descriptor.host_port}/${descriptor.database}?schema=public`;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const STOCK_PRINCIPAL = '10000000-0000-4000-8000-000000000001';
const CTO_PRINCIPAL = '10000000-0000-4000-8000-000000000002';
const SENTINEL_PRINCIPAL = '10000000-0000-4000-8000-000000000003';
const STOCK_CLIENT = '20000000-0000-4000-8000-000000000001';
const CTO_CLIENT = '20000000-0000-4000-8000-000000000002';
const SENTINEL_CLIENT = '20000000-0000-4000-8000-000000000003';
const HUMAN_CLIENT_ROW = '30000000-0000-4000-8000-000000000001';
const PROXY_ROW = '40000000-0000-4000-8000-000000000001';
const STOCK_PUBLIC = `mc_${'a'.repeat(24)}`;
const CTO_PUBLIC = `mc_${'b'.repeat(24)}`;
const SENTINEL_PUBLIC = `mc_${'z'.repeat(24)}`;

const FORUM_SCOPES = {
  drift: ['forum.read', 'forum.write', 'forum.moderate'],
  target: ['forum.write', 'forum.read'],
  one: ['forum.read'],
  four: ['forum.read', 'forum.write', 'forum.moderate', 'forum.admin'],
  empty: [],
  wildcard: ['forum.read', 'forum.write', '*'],
  moderateOnly: ['forum.moderate'],
} as const;

type SeedOptions = {
  forumScopes?: keyof typeof FORUM_SCOPES;
  driftField?: 'resource-service' | 'scope-namespace' | 'principal-types' | 'human'
    | 'machine' | 'delegated' | 'status' | 'freeze' | 'version';
  omitCanary?: 'stock' | 'cto';
  omitCanaryForumGrant?: 'stock' | 'cto';
  canaryForumScopes?: string[];
  anyGrantForbidden?: { audienceId: string; scopes: string[] };
  humanGrant?: boolean;
  delegationGrant?: boolean;
  reconciliationAudits?: Array<{ result?: string; details?: Record<string, unknown> }>;
};

async function invoke(extraDescriptor: unknown = descriptor) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'svc-forum-reconcile-test', JSON.stringify(extraDescriptor), NODE, SCRIPT,
    ], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function invokeArgs(args: string[], environment: Record<string, string> = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(NODE, ['--import', 'tsx', SCRIPT, ...args], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp', ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reconcile_fail_audit ON auth_security_audits');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reconcile_fail_audit()');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE auth_security_audits, grant_change_audits,
    machine_access_grants, human_audience_grants, delegation_grants,
    proxy_accepted_subject_audiences, trusted_proxies, human_clients,
    machine_clients, machine_principals, auth_audiences CASCADE`);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS machine_clients_external_ref_key ON machine_clients(external_ref)');
  await prisma.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auth_audiences_pkey') THEN
      ALTER TABLE auth_audiences ADD CONSTRAINT auth_audiences_pkey PRIMARY KEY (audience_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='machine_access_grants_audience_id_fkey') THEN
      ALTER TABLE machine_access_grants ADD CONSTRAINT machine_access_grants_audience_id_fkey
        FOREIGN KEY (audience_id) REFERENCES auth_audiences(audience_id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='human_audience_grants_audience_id_fkey') THEN
      ALTER TABLE human_audience_grants ADD CONSTRAINT human_audience_grants_audience_id_fkey
        FOREIGN KEY (audience_id) REFERENCES auth_audiences(audience_id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='delegation_grants_audience_id_fkey') THEN
      ALTER TABLE delegation_grants ADD CONSTRAINT delegation_grants_audience_id_fkey
        FOREIGN KEY (audience_id) REFERENCES auth_audiences(audience_id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proxy_accepted_subject_audiences_audience_id_fkey') THEN
      ALTER TABLE proxy_accepted_subject_audiences ADD CONSTRAINT proxy_accepted_subject_audiences_audience_id_fkey
        FOREIGN KEY (audience_id) REFERENCES auth_audiences(audience_id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`);
}

async function seed(options: SeedOptions = {}): Promise<void> {
  await prisma.authAudience.create({ data: {
    audienceId: 'svc-workflow', resourceService: 'svc-workflow', scopeNamespace: 'workflow',
    acceptedPrincipalTypes: ['agent', 'service'],
    registeredScopes: ['workflow.admin', 'workflow.execute', 'workflow.read'],
    humanAccessEnabled: true, machineAccessEnabled: true, delegatedAccessEnabled: true,
    status: 'active', freezeReady: true, version: 1,
  } });
  await prisma.authAudience.create({ data: {
    audienceId: 'svc-forum',
    resourceService: options.driftField === 'resource-service' ? 'svc-forum-legacy' : 'svc-forum',
    scopeNamespace: options.driftField === 'scope-namespace' ? 'forums' : 'forum',
    acceptedPrincipalTypes: options.driftField === 'principal-types' ? ['agent', 'user'] : ['agent'],
    registeredScopes: [...(FORUM_SCOPES[options.forumScopes ?? 'drift'])],
    humanAccessEnabled: options.driftField === 'human',
    machineAccessEnabled: options.driftField !== 'machine',
    delegatedAccessEnabled: options.driftField === 'delegated',
    status: options.driftField === 'status' ? 'disabled' : 'active',
    freezeReady: options.driftField !== 'freeze',
    version: options.driftField === 'version' ? 2 : 1,
  } });

  for (const [key, principalId, clientId, publicId, agentId] of [
    ['stock', STOCK_PRINCIPAL, STOCK_CLIENT, STOCK_PUBLIC, 'agt_stock_agent'],
    ['cto', CTO_PRINCIPAL, CTO_CLIENT, CTO_PUBLIC, 'agt_cto-agent'],
  ] as const) {
    if (options.omitCanary === key) continue;
    await prisma.machinePrincipal.create({ data: {
      id: principalId, principalType: 'agent', agentId, ownerUserId: null,
      displayName: `misleading-${key}`, externalRef: `agentcore:v1:principal:${agentId}`, status: 'active',
    } });
    await prisma.machineClient.create({ data: {
      id: clientId, clientId: publicId, machinePrincipalId: principalId,
      secretHash: 'not-a-secret-test-hash', externalRef: `agentcore:v1:client:${agentId}`,
      status: 'active', allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'],
    } });
    await prisma.machineAccessGrant.create({ data: {
      machineClientId: clientId, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1,
    } });
    if (options.omitCanaryForumGrant !== key) {
      await prisma.machineAccessGrant.create({ data: {
        machineClientId: clientId, audienceId: 'svc-forum',
        scopes: key === 'stock' && options.canaryForumScopes ? [...options.canaryForumScopes]
          : key === 'cto' ? ['forum.write', 'forum.read'] : ['forum.read', 'forum.write'],
        version: 2,
      } });
    }
  }

  await prisma.machinePrincipal.create({ data: {
    id: SENTINEL_PRINCIPAL, principalType: 'agent', agentId: 'agt_sentinel', ownerUserId: null,
    externalRef: 'openclaw:v1:principal:misleading-stock-agent', status: 'active',
  } });
  await prisma.machineClient.create({ data: {
    id: SENTINEL_CLIENT, clientId: SENTINEL_PUBLIC, machinePrincipalId: SENTINEL_PRINCIPAL,
    secretHash: 'sentinel', externalRef: 'openclaw:v1:client:agt_stock_agent', status: 'active',
    allowedResources: ['sentinel-resource'], allowedScopes: ['sentinel.scope'],
  } });
  await prisma.machineAccessGrant.create({ data: {
    machineClientId: SENTINEL_CLIENT, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 7,
  } });
  await prisma.grantChangeAudit.create({ data: {
    migrationId: 'sentinel-audit', sourceGitCommit: 'e'.repeat(40), operatorId: 'sentinel',
    approvalRef: 'sentinel', reason: 'sentinel non-target audit', clientId: SENTINEL_PUBLIC,
    changeType: 'create', expectedGrantVersion: null, resultingGrantVersion: 1, beforeValue: undefined,
    afterValue: { client_id: SENTINEL_PUBLIC, machine_access_grants: { 'svc-workflow': ['workflow.read'] }, version: 1 },
  } });
  await prisma.authSecurityAudit.create({ data: {
    eventType: 'unrelated.event', result: 'success',
    details: { keep: true, note: 'non-target audit row' }, timestamp: new Date(),
  } });

  if (options.anyGrantForbidden) {
    await prisma.machineAccessGrant.create({ data: {
      machineClientId: SENTINEL_CLIENT, audienceId: options.anyGrantForbidden.audienceId,
      scopes: options.anyGrantForbidden.scopes, version: 1,
    } });
  }
  if (options.humanGrant) {
    await prisma.humanClient.create({ data: {
      id: HUMAN_CLIENT_ROW, clientId: 'hc_sentinel_test', clientType: 'confidential_web',
      clientAuthenticationMethod: 'client_secret_basic', status: 'active',
    } });
    await prisma.humanAudienceGrant.create({ data: {
      humanClientId: HUMAN_CLIENT_ROW, audienceId: 'svc-forum', version: 1,
    } });
  }
  if (options.delegationGrant) {
    await prisma.trustedProxy.create({ data: {
      id: PROXY_ROW, proxyPrincipalId: SENTINEL_PRINCIPAL, proxyClientId: SENTINEL_CLIENT,
      status: 'active', version: 1,
    } });
    await prisma.delegationGrant.create({ data: {
      trustedProxyId: PROXY_ROW, audienceId: 'svc-forum', scopes: ['forum.read'], version: 1,
    } });
  }
  if (options.reconciliationAudits?.length) {
    const row = await prisma.authAudience.findUniqueOrThrow({ where: { audienceId: 'svc-forum' } });
    const snapshot = (registeredScopes: string[]) => ({
      audience_id: 'svc-forum', resource_service: 'svc-forum', scope_namespace: 'forum',
      accepted_principal_types: ['agent'], registered_scopes: [...registeredScopes].sort(),
      human_access_enabled: false, machine_access_enabled: true, delegated_access_enabled: false,
      status: 'active', freeze_ready: true, version: 1,
      created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
    });
    for (const audit of options.reconciliationAudits) {
      await prisma.authSecurityAudit.create({ data: {
        eventType: 'audience.registry_reconciled',
        result: audit.result ?? 'success',
        details: audit.details ?? {
          migration_id: descriptor.audit_metadata.migration_id,
          source_git_commit: descriptor.audit_metadata.source_git_commit,
          operator_id: descriptor.audit_metadata.operator_id,
          approval_ref: descriptor.audit_metadata.approval_ref,
          reason: descriptor.audit_metadata.reason,
          before_value: snapshot(FORUM_SCOPES.drift),
          after_value: snapshot(['forum.read', 'forum.write']),
        },
        timestamp: new Date(),
      } });
    }
  }
}

async function forumAudience() {
  return prisma.authAudience.findUniqueOrThrow({ where: { audienceId: 'svc-forum' } });
}
async function reconciliationAudits() {
  return prisma.authSecurityAudit.findMany({
    where: { eventType: 'audience.registry_reconciled' },
    orderBy: { timestamp: 'asc' },
  });
}
async function counts() {
  return {
    reconciliationAudits: await prisma.authSecurityAudit.count({ where: { eventType: 'audience.registry_reconciled' } }),
    totalAudits: await prisma.authSecurityAudit.count(),
    grants: await prisma.machineAccessGrant.count(),
  };
}
function forumSnapshot(row: { createdAt: Date; updatedAt: Date }, registeredScopes: string[]) {
  return {
    audience_id: 'svc-forum', resource_service: 'svc-forum', scope_namespace: 'forum',
    accepted_principal_types: ['agent'], registered_scopes: [...registeredScopes].sort(),
    human_access_enabled: false, machine_access_enabled: true, delegated_access_enabled: false,
    status: 'active', freeze_ready: true, version: 1,
    created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
  };
}

await test('static boundary pins the frozen reconciliation constants and forbids out-of-scope writes', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.match(source, /const AUDIENCE_ID = 'svc-forum';/);
  assert.match(source, /const TARGET_SCOPES = Object\.freeze\(\['forum\.read', 'forum\.write'\]\);/);
  assert.match(source, /const DRIFT_SCOPES = Object\.freeze\(\['forum\.moderate', 'forum\.read', 'forum\.write'\]\);/);
  assert.match(source, /const AUDIT_EVENT_TYPE = 'audience\.registry_reconciled';/);
  assert.match(source, /const AUDIT_RESULT = 'success';/);
  assert.match(source, /const ADVISORY_LOCK_KEY = 813_947_203;/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.match(source, /LOCK TABLE auth_audiences IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(source, /LOCK TABLE auth_security_audits IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(source, /LOCK TABLE delegation_grants IN SHARE MODE/);
  assert.match(source, /LOCK TABLE human_audience_grants IN SHARE MODE/);
  assert.match(source, /LOCK TABLE machine_access_grants IN SHARE MODE/);
  assert.match(source, /UPDATE auth_audiences SET registered_scopes = ARRAY\[\$1, \$2\]::text\[\] WHERE audience_id = \$3 AND version = 1/);
  assert.doesNotMatch(source, /UPDATE auth_audiences SET (?!registered_scopes)/);
  assert.doesNotMatch(source, /allowedResources|allowedScopes|allowed_resources|allowed_scopes/);
  assert.doesNotMatch(source, /secretHash|secret_hash/);
  assert.doesNotMatch(source, /machineAccessGrant\.(create|update|delete|upsert)/);
  assert.doesNotMatch(source, /humanAudienceGrant\.(create|update|delete|upsert)/);
  assert.doesNotMatch(source, /delegationGrant\.(create|update|delete|upsert)/);
  assert.doesNotMatch(source, /machineClient\.(create|update|delete|upsert)/);
  assert.doesNotMatch(source, /machinePrincipal\.(create|update|delete|upsert)/);
  assert.doesNotMatch(source, /authAudience\.(create|update|delete|upsert)/);
  assert.doesNotMatch(source, /authSecurityAudit\.(update|delete|upsert)/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /node:https|https\.request|\bfetch\(/);
  assert.doesNotMatch(source, /DELETE FROM|INSERT INTO/);
});

await test('exact three-scope drift reconciles to the frozen target with one durable audit', async () => {
  await reset(); await seed();
  const before = await forumAudience();
  const beforeAudienceRows = await prisma.authAudience.findMany({ orderBy: { audienceId: 'asc' } });
  const beforeGrants = await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
  const beforeSentinel = {
    principal: await prisma.machinePrincipal.findUniqueOrThrow({ where: { id: SENTINEL_PRINCIPAL } }),
    client: await prisma.machineClient.findUniqueOrThrow({ where: { id: SENTINEL_CLIENT } }),
    grantAudit: await prisma.grantChangeAudit.findFirstOrThrow({ where: { clientId: SENTINEL_PUBLIC } }),
    securityAudit: await prisma.authSecurityAudit.findFirstOrThrow({ where: { eventType: 'unrelated.event' } }),
  };

  const result = await invoke();
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /"outcome":"reconcile"/);
  assert.match(result.stdout, /"audience_rows_updated":1/);
  assert.match(result.stdout, /"audits_created":1/);
  assert.match(result.stdout, /"registered_scopes_before":\["forum\.moderate","forum\.read","forum\.write"\]/);
  assert.match(result.stdout, /"registered_scopes_after":\["forum\.read","forum\.write"\]/);

  const after = await forumAudience();
  assert.deepEqual(after.registeredScopes, ['forum.read', 'forum.write']);
  assert.equal(after.version, 1);
  assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime(), 'single-column write must not touch updated_at');
  assert.equal(after.createdAt.getTime(), before.createdAt.getTime());
  assert.deepEqual(
    { ...after, registeredScopes: undefined, createdAt: undefined, updatedAt: undefined },
    { ...before, registeredScopes: undefined, createdAt: undefined, updatedAt: undefined },
    'every non-scope field must be row-equivalent',
  );

  assert.deepEqual(await counts(), { reconciliationAudits: 1, totalAudits: 2, grants: beforeGrants.length });
  const audits = await reconciliationAudits();
  assert.equal(audits[0].result, 'success');
  const details = audits[0].details as Record<string, unknown>;
  assert.deepEqual(Object.keys(details).sort(), [
    'after_value', 'approval_ref', 'before_value', 'migration_id',
    'operator_id', 'reason', 'source_git_commit',
  ]);
  assert.equal(details.migration_id, descriptor.audit_metadata.migration_id);
  assert.equal(details.source_git_commit, descriptor.audit_metadata.source_git_commit);
  assert.equal(details.operator_id, descriptor.audit_metadata.operator_id);
  assert.equal(details.approval_ref, descriptor.audit_metadata.approval_ref);
  assert.equal(details.reason, descriptor.audit_metadata.reason);
  assert.deepEqual(details.before_value, forumSnapshot(before, FORUM_SCOPES.drift));
  assert.deepEqual(details.after_value, { ...forumSnapshot(before, FORUM_SCOPES.drift), registered_scopes: ['forum.read', 'forum.write'] });
  const serialized = JSON.stringify(audits[0]);
  assert.doesNotMatch(serialized, /postgres|password|DATABASE_URL|Authorization|Bearer|postgresql:\/\//i, 'audit must not disclose secrets');

  const afterAudienceRows = await prisma.authAudience.findMany({ orderBy: { audienceId: 'asc' } });
  assert.equal(afterAudienceRows.length, beforeAudienceRows.length);
  assert.deepEqual(afterAudienceRows.find((row) => row.audienceId === 'svc-workflow'), beforeAudienceRows.find((row) => row.audienceId === 'svc-workflow'), 'non-target Audience must be row-equivalent');
  assert.deepEqual(
    await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }),
    beforeGrants, 'every Grant row must be untouched',
  );
  assert.deepEqual(await prisma.machinePrincipal.findUniqueOrThrow({ where: { id: SENTINEL_PRINCIPAL } }), beforeSentinel.principal);
  assert.deepEqual(await prisma.machineClient.findUniqueOrThrow({ where: { id: SENTINEL_CLIENT } }), beforeSentinel.client);
  assert.deepEqual(await prisma.grantChangeAudit.findFirstOrThrow({ where: { clientId: SENTINEL_PUBLIC } }), beforeSentinel.grantAudit);
  assert.deepEqual(await prisma.authSecurityAudit.findFirstOrThrow({ where: { eventType: 'unrelated.event' } }), beforeSentinel.securityAudit);

  const legacy = await prisma.machineClient.findMany({
    where: { id: { in: [STOCK_CLIENT, CTO_CLIENT] } },
    select: { allowedResources: true, allowedScopes: true },
    orderBy: { id: 'asc' },
  });
  assert.deepEqual(legacy, [
    { allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'] },
    { allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'] },
  ], 'legacy fields must be neither read nor written');
});

await test('exact rerun on the reconciled state is a byte-stable no-op', async () => {
  const beforeAudiences = await prisma.authAudience.findMany({ orderBy: { audienceId: 'asc' } });
  const beforeAudits = await prisma.authSecurityAudit.findMany({ orderBy: { timestamp: 'asc' } });
  const beforeGrants = await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
  const result = await invoke();
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /"outcome":"noop"/);
  assert.equal(result.stdout.includes('"audience_rows_updated":1'), false, 'noop must report zero row writes');
  assert.equal(result.stdout.includes('"audits_created":1'), false, 'noop must report zero audit writes');
  assert.deepEqual(await prisma.authAudience.findMany({ orderBy: { audienceId: 'asc' } }), beforeAudiences);
  assert.deepEqual(await prisma.authSecurityAudit.findMany({ orderBy: { timestamp: 'asc' } }), beforeAudits);
  assert.deepEqual(await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }), beforeGrants);
});

await test('metadata-drifted rerun on the reconciled state fails closed', async () => {
  const result = await invoke({
    ...descriptor,
    audit_metadata: { ...descriptor.audit_metadata, reason: 'a different reason for a rerun' },
  });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /does not match this execution/);
  assert.deepEqual(await counts(), { reconciliationAudits: 1, totalAudits: 2, grants: 5 });
});

await test('target state without a reconciliation audit conflicts with zero writes', async () => {
  await reset(); await seed({ forumScopes: 'target' });
  const before = await forumAudience();
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /reconciliation audits exist \(expected exactly 1\)/);
  assert.deepEqual(await forumAudience(), before);
  assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: 5 });
});

for (const [name, overrides] of [
  ['drifted before_value', { details: undefined, result: undefined }],
  ['wrong audit result', { result: 'failure' }],
  ['missing detail member', { details: { migration_id: 'x' } }],
] as const) {
  await test(`target state with a drifted reconciliation audit (${name}) conflicts with zero writes`, async () => {
    await reset(); await seed({ forumScopes: 'target' });
    const row = await forumAudience();
    const snapshot = (scopes: string[]) => forumSnapshot(row, scopes);
    const details = overrides.details ?? {
      migration_id: descriptor.audit_metadata.migration_id,
      source_git_commit: descriptor.audit_metadata.source_git_commit,
      operator_id: descriptor.audit_metadata.operator_id,
      approval_ref: descriptor.audit_metadata.approval_ref,
      reason: descriptor.audit_metadata.reason,
      before_value: snapshot(['forum.read']),
      after_value: snapshot(['forum.read', 'forum.write']),
    };
    await prisma.authSecurityAudit.create({ data: {
      eventType: 'audience.registry_reconciled', result: overrides.result ?? 'success',
      details, timestamp: new Date(),
    } });
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /reconciliation audit/);
    assert.deepEqual(await counts(), { reconciliationAudits: 1, totalAudits: 2, grants: 5 });
  });
}

await test('target state with more than one reconciliation audit conflicts with zero writes', async () => {
  await reset(); await seed({ forumScopes: 'target', reconciliationAudits: [{}, {}] });
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /2 reconciliation audits exist/);
  assert.deepEqual(await counts(), { reconciliationAudits: 2, totalAudits: 3, grants: 5 });
});

await test('drift state with a pre-existing reconciliation audit conflicts with zero writes', async () => {
  await reset(); await seed({ reconciliationAudits: [{}] });
  const before = await forumAudience();
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /drift state but reconciliation audits already exist/);
  assert.deepEqual(await forumAudience(), before);
});

for (const [name, driftField] of [
  ['resource_service', 'resource-service'], ['scope_namespace', 'scope-namespace'],
  ['accepted_principal_types adds user', 'principal-types'], ['human_access_enabled', 'human'],
  ['machine_access_enabled', 'machine'], ['delegated_access_enabled', 'delegated'],
  ['status disabled', 'status'], ['freeze_ready false', 'freeze'], ['version 2', 'version'],
] as const) {
  await test(`other Audience field drift (${name}) fails closed with zero writes`, async () => {
    await reset(); await seed({ driftField });
    const before = await forumAudience();
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /frozen precondition|must be|does not match/);
    assert.deepEqual(await forumAudience(), before);
    assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: 5 });
  });
}

for (const [name, forumScopes] of [
  ['only forum.read', 'one'], ['four scopes with forum.admin', 'four'],
  ['empty', 'empty'], ['wildcard', 'wildcard'], ['only forum.moderate', 'moderateOnly'],
] as const) {
  await test(`registered_scopes not the exact three-item drift (${name}) fails closed with zero writes`, async () => {
    await reset(); await seed({ forumScopes });
    const before = await forumAudience();
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /neither the exact drift set/);
    assert.deepEqual(await forumAudience(), before);
    assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: 5 });
  });
}

for (const [name, seedOptions] of [
  ['canary grant carries forum.moderate', { canaryForumScopes: ['forum.read', 'forum.write', 'forum.moderate'] }],
  ['any grant carries forum.admin', { anyGrantForbidden: { audienceId: 'svc-forum', scopes: ['workflow.read', 'forum.admin'] } }],
  ['any grant carries literal forum.*', { anyGrantForbidden: { audienceId: 'svc-forum', scopes: ['forum.*'] } }],
  ['any grant carries wildcard *', { anyGrantForbidden: { audienceId: 'svc-forum', scopes: ['*'] } }],
] as const) {
  await test(`forbidden machine grant scope (${name}) fails closed with zero writes`, async () => {
    await reset(); await seed(seedOptions);
    const before = await forumAudience();
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /forbidden scope/);
    assert.deepEqual(await forumAudience(), before);
    assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: seedOptions.canaryForumScopes ? 5 : 6 });
  });
}

await test('svc-forum Human Audience Grant fails closed with zero writes', async () => {
  await reset(); await seed({ humanGrant: true });
  const before = await forumAudience();
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /no Human Audience Grant/);
  assert.deepEqual(await forumAudience(), before);
});

await test('svc-forum Delegation Grant fails closed with zero writes', async () => {
  await reset(); await seed({ delegationGrant: true });
  const before = await forumAudience();
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /no Delegation Grant/);
  assert.deepEqual(await forumAudience(), before);
});

await test('audit insert failure rolls the whole transaction back', async () => {
  await reset(); await seed();
  const before = await forumAudience();
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION reconcile_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected audit failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reconcile_fail_audit BEFORE INSERT ON auth_security_audits
    FOR EACH ROW WHEN (NEW.event_type = 'audience.registry_reconciled') EXECUTE FUNCTION reconcile_fail_audit()`);
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /injected audit failure/);
  assert.deepEqual(await forumAudience(), before, 'the Audience row must still be the exact drift state');
  assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: 5 });
});

await test('a concurrent advisory-locked grant writer commits first and the run fails closed', async () => {
  await reset(); await seed();
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    // Same acquisition order as the script (table lock before advisory) so
    // the two cooperating transactions cannot deadlock.
    await tx.$executeRawUnsafe('LOCK TABLE machine_access_grants IN ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(813_947_203)');
    await tx.machineAccessGrant.create({ data: {
      machineClientId: SENTINEL_CLIENT, audienceId: 'svc-forum', scopes: ['*'], version: 1,
    } });
    pending = invoke();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  const result = await pending!;
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /forbidden scope/);
  assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: 6 });
});

await test('a concurrent audit writer commits first and the run fails closed', async () => {
  await reset(); await seed();
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.authSecurityAudit.create({ data: {
      eventType: 'audience.registry_reconciled', result: 'success',
      details: { premature: true }, timestamp: new Date(),
    } });
    pending = invoke();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  const result = await pending!;
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /drift state but reconciliation audits already exist/);
  assert.deepEqual(await counts(), { reconciliationAudits: 1, totalAudits: 2, grants: 5 });
});

await test('duplicate-corruption svc-forum Audience rows fail closed', async () => {
  await reset(); await seed();
  await prisma.$executeRawUnsafe('ALTER TABLE auth_audiences DROP CONSTRAINT auth_audiences_pkey CASCADE');
  await prisma.$executeRawUnsafe(`INSERT INTO auth_audiences SELECT * FROM auth_audiences WHERE audience_id='svc-forum'`);
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /must resolve exactly once/);
  assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: 5 });
});

await test('missing canary client fails closed', async () => {
  await reset(); await seed({ omitCanary: 'cto' });
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /agentcore:v1:client:agt_cto-agent must resolve exactly once/);
});

for (const [name, seedOptions, message] of [
  ['missing canary forum grant', { omitCanaryForumGrant: 'stock' }, /exactly one svc-forum machine grant/],
  ['canary forum grant not exactly forum.read+forum.write', { canaryForumScopes: ['forum.read'] }, /must be exactly forum\.read and forum\.write/],
] as const) {
  await test(`${name} fails closed with zero writes`, async () => {
    await reset(); await seed(seedOptions);
    const before = await forumAudience();
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, message);
    assert.deepEqual(await forumAudience(), before);
    assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: seedOptions.canaryForumScopes ? 5 : 4 });
  });
}

await test('descriptor rejects malformed, duplicate, and wrong-container coordinates', async () => {
  await reset(); await seed();
  const malformed = await invoke({ ...descriptor, database: 'production' });
  assert.notEqual(malformed.code, 0);
  const duplicate = await new Promise<{ code: number | null }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'svc-forum-reconcile-test', '{"schema_version":1,"schema_version":1}', NODE, SCRIPT,
    ], {
      cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.on('error', reject); child.on('close', (code) => resolve({ code }));
  });
  assert.notEqual(duplicate.code, 0);
  const wrong = await invoke({ ...descriptor, nonce: '0'.repeat(64) });
  assert.notEqual(wrong.code, 0);
  const stdin = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(NODE, ['--import', 'tsx', SCRIPT, '--conformance-apply', '--descriptor-fd', '0'], {
      cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    child.on('error', reject); child.on('close', resolve); child.stdin.end(JSON.stringify(descriptor));
  });
  assert.notEqual(stdin, 0);
  const temporary = mkdtempSync(path.join(tmpdir(), 'svc-forum-reconcile-descriptor-'));
  const regularPath = path.join(temporary, 'descriptor.json');
  writeFileSync(regularPath, JSON.stringify(descriptor));
  try {
    const regular = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('/bin/bash', [
        '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
        'svc-forum-reconcile-test', regularPath, NODE, SCRIPT,
      ], { cwd: ROOT, stdio: 'ignore' });
      child.on('error', reject); child.on('close', resolve);
    });
    assert.notEqual(regular, 0);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

await test('descriptor FD seam rejects a missing flag, a closed FD, and a socket FD', async () => {
  const missing = await invokeArgs(['--conformance-apply']);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /descriptor is invalid/);
  const closed = await invokeArgs(['--conformance-apply', '--descriptor-fd', '3']);
  assert.notEqual(closed.code, 0, 'a closed FD must be rejected');
  const socketRejected = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') { server.close(); reject(new Error('no listen address')); return; }
      const client = connect(address.port, '127.0.0.1');
      client.on('error', reject);
      server.once('connection', (serverSide) => {
        const child = spawn(NODE, ['--import', 'tsx', SCRIPT, '--conformance-apply', '--descriptor-fd', '3'], {
          cwd: ROOT,
          env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
          stdio: ['ignore', 'pipe', 'pipe', serverSide],
        });
        let stderr = '';
        child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code) => {
          client.destroy();
          serverSide.destroy();
          server.close(() => resolve({ code, stderr }));
        });
      });
    });
  });
  assert.notEqual(socketRejected.code, 0);
  assert.match(socketRejected.stderr, /must be a FIFO/);
});

await test('CLI and environment seam rejects unknown flags, DATABASE_URL, and mode cross-contamination', async () => {
  const metadataArgs = [
    '--migration-id', 'svc-forum-audience-registry-reconciliation-v1',
    '--source-git-commit', 'a'.repeat(40),
    '--operator-id', 'conformance-operator',
    '--approval-ref', 'https://github.com/mayf3/auth-service/issues/1#issuecomment-1',
    '--reason', 'conformance seam',
  ];
  const cases: Array<[string, string[], Record<string, string>]> = [
    ['unknown flag in conformance-apply mode', ['--conformance-apply', '--bogus-flag'], {}],
    ['conformance-apply with DATABASE_URL', ['--conformance-apply'], { DATABASE_URL: 'postgresql://refused' }],
    ['conformance-apply with metadata arguments', ['--conformance-apply', ...metadataArgs.slice(0, 2)], {}],
    ['apply with conformance-apply', ['--apply', '--conformance-apply'], {}],
    ['apply missing migration-id', ['--apply', ...metadataArgs.filter((_, index) => index > 1)], {}],
    ['apply missing source-git-commit', ['--apply', ...metadataArgs.filter((_, index) => index < 2 || index > 3)], {}],
    ['apply missing operator-id', ['--apply', ...metadataArgs.filter((_, index) => index < 4 || index > 5)], {}],
    ['apply missing approval-ref', ['--apply', ...metadataArgs.filter((_, index) => index < 6 || index > 7)], {}],
    ['apply missing reason', ['--apply', ...metadataArgs.slice(0, 8)], {}],
    ['apply with descriptor-fd', ['--apply', ...metadataArgs, '--descriptor-fd', '3'], {}],
    ['plan mode with an argument', ['--anything'], {}],
    ['descriptor-fd without a value', ['--conformance-apply', '--descriptor-fd'], {}],
    ['duplicate descriptor-fd', ['--conformance-apply', '--descriptor-fd', '3', '--descriptor-fd', '4'], {}],
    ['apply with a malformed source commit', ['--apply', ...metadataArgs.slice(0, 2), '--source-git-commit', 'not-hex', ...metadataArgs.slice(4)], {}],
  ];
  for (const [label, args, environment] of cases) {
    const result = await invokeArgs(args, environment);
    assert.notEqual(result.code, 0, `${label} must be rejected: ${result.stdout}`);
  }
});

await test('read-only plan mode reports the drift without writing', async () => {
  await reset(); await seed();
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(NODE, ['--import', 'tsx', SCRIPT], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp', DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /"outcome":"reconcile"/);
  assert.deepEqual(await counts(), { reconciliationAudits: 0, totalAudits: 1, grants: 5 });
  const audience = await forumAudience();
  assert.deepEqual(audience.registeredScopes, FORUM_SCOPES.drift, 'plan must not write');
});

await test('privilege-changing Docker capabilities are rejected before engine access', async () => {
  const docker = '/usr/local/bin/docker';
  const nonce = createHash('sha256').update(randomUUID()).digest('hex');
  const labelHash = createHash('sha256').update(nonce).digest('hex');
  const name = `auth-svc-forum-reconcile-conformance-cap-${nonce.slice(0, 12)}`;
  const id = execFileSync(docker, [
    'run', '-d', '--rm', '--name', name,
    '--label', `com.mayf3.auth.svc-forum-reconcile-conformance=sha256:${labelHash}`,
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=128m',
    '--cap-add', 'SYS_ADMIN', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=auth_svc_forum_reconcile_conformance', '-p', '127.0.0.1::5432',
    'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777',
    '-c', `svc_forum_reconcile.conformance_nonce=${nonce}`,
  ], { encoding: 'utf8' }).trim();
  try {
    const hostPort = Number(execFileSync(docker, [
      'inspect', '--format', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', id,
    ], { encoding: 'utf8' }).trim());
    assert.ok(Number.isInteger(hostPort) && hostPort > 0 && hostPort <= 65535);
    const result = await invoke({ ...descriptor, container_id: id, nonce, host_port: hostPort });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /not exact disposable conformance PostgreSQL/);
  } finally { execFileSync(docker, ['rm', '-f', id], { stdio: 'ignore' }); }
});

test.after(async () => { await reset(); await prisma.$disconnect(); });
