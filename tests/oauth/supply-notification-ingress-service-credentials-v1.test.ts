import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'scripts/supply-notification-ingress-service-credentials-v1.ts');
const RUNNER = join(ROOT, 'scripts/run-notification-ingress-service-credentials-v1-conformance.sh');
const DEST_FORUM_ID = 'mc_Ez8kTAKKvcf2pF40aoUM4q9M';
const DEST_WORKFLOW_ID = 'mc_uYu1fDfNHjzUlRQGJdTajz9n';
const TARGET_IDS = [DEST_FORUM_ID, DEST_WORKFLOW_ID];
const TARGET_REFS = ['service:v1:client:svc-forum:agent-core-notification-ingress-v1', 'service:v1:client:svc-workflow:agent-core-notification-ingress-v1'];
const PRINCIPAL_REFS = ['service:v1:principal:svc-forum', 'service:v1:principal:svc-workflow'];

function readFd3(): string { const chunks: Buffer[] = []; while (true) { const b = Buffer.allocUnsafe(65536); const n = readSync(3, b, 0, b.length, null); if (n === 0) break; chunks.push(b.subarray(0, n)); } return Buffer.concat(chunks).toString('utf8'); }
const descriptor = JSON.parse(readFd3()) as { schema_version: 1; container_id: string; nonce: string; database_url: string; environment: string; destination_root: string; expected_uid: number; marker_path: string; fault_injection: 'none' | 'after-install-and-restore-fail' };
const prisma = new PrismaClient({ datasources: { db: { url: descriptor.database_url } } });
const planPath = join(descriptor.destination_root, 'approved-plan.json');

type Result = { code: number | null; stdout: string; stderr: string };
function run(mode: 'plan' | 'apply' | 'verify', options: { plan?: string; digest?: string; approval?: unknown; descriptor?: unknown } = {}): Promise<Result> {
  const args = ['--conformance', '--conformance-mode', mode, '--descriptor-fd', '3'];
  if (options.plan) args.push('--plan-file', options.plan);
  if (options.digest) args.push('--plan-sha256', options.digest);
  if (mode === 'apply') args.push('--approval-fd', '4');
  return new Promise((resolvePromise, reject) => {
    const command = 'exec 3< <(printf %s "$1"); exec 4< <(printf %s "$2"); exec "$3" --import tsx "$4" "${@:5}"';
    const child = spawn('/bin/bash', ['-c', command, 'nsc-test', JSON.stringify(options.descriptor ?? descriptor), JSON.stringify(options.approval ?? {}), process.execPath, SCRIPT, ...args], {
      cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: descriptor.destination_root }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = ''; child.stdout.setEncoding('utf8').on('data', (v) => { stdout += v; }); child.stderr.setEncoding('utf8').on('data', (v) => { stderr += v; }); child.on('error', reject); child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}
function approval(envelope: any): Record<string, string> { const now = Date.now(); return { spec_id: envelope.plan.spec_id, spec_revision: envelope.plan.spec_revision, implementation_commit: envelope.plan.implementation_commit, plan_sha256: envelope.plan_sha256, environment: envelope.plan.environment, window_not_before: new Date(now - 60_000).toISOString(), window_not_after: new Date(now + 60 * 60_000).toISOString(), operator_id: 'nsc-conformance-operator', approval_ref: 'conformance://owner-approval/notification-ingress-v1' }; }
async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS nsc_fail_second_grant ON machine_access_grants');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS nsc_fail_second_grant_fn()');
  await prisma.$executeRawUnsafe('TRUNCATE grant_change_audits, machine_access_grants, delegation_grants, proxy_accepted_subject_audiences, trusted_proxies, machine_clients, machine_principals, auth_audiences CASCADE');
  for (const child of readdirSync(descriptor.destination_root)) rmSync(join(descriptor.destination_root, child), { recursive: true, force: true });
  mkdirSync(join(descriptor.destination_root, 'svc-forum'), { recursive: true, mode: 0o700 });
  mkdirSync(join(descriptor.destination_root, 'svc-workflow'), { recursive: true, mode: 0o700 });
}
async function seedAudience(kind: 'exact' | 'missing' | 'mismatch' = 'exact'): Promise<void> { if (kind === 'missing') return; await prisma.authAudience.create({ data: { audienceId: 'agent-core-notification-ingress-v1', resourceService: 'agent-core-notification-ingress-v1', scopeNamespace: 'notification', acceptedPrincipalTypes: ['service'], registeredScopes: kind === 'mismatch' ? ['notification.read'] : ['notification.deliver'], humanAccessEnabled: false, machineAccessEnabled: true, delegatedAccessEnabled: false, status: 'active', freezeReady: true, version: 1 } }); }
async function seedNonTarget(): Promise<void> { await prisma.machinePrincipal.create({ data: { id: '10000000-0000-4000-8000-000000000001', principalType: 'agent', agentId: 'agt_sentinel', displayName: 'sentinel', externalRef: 'agentcore:v1:principal:agt_sentinel', status: 'active' } }); await prisma.machineClient.create({ data: { id: '20000000-0000-4000-8000-000000000001', clientId: 'mc_ssssssssssssssssssssssss', machinePrincipalId: '10000000-0000-4000-8000-000000000001', secretHash: 'sentinel-secret-hash-never-report', externalRef: null, status: 'active', allowedResources: ['legacy-resource'], allowedScopes: ['legacy-scope'] } }); await prisma.machineAccessGrant.create({ data: { machineClientId: '20000000-0000-4000-8000-000000000001', audienceId: 'agent-core-notification-ingress-v1', scopes: ['notification.deliver'], version: 7 } }); }
async function targetCounts() { return { principals: await prisma.machinePrincipal.count({ where: { externalRef: { in: PRINCIPAL_REFS } } }), clients: await prisma.machineClient.count({ where: { OR: [{ clientId: { in: TARGET_IDS } }, { externalRef: { in: TARGET_REFS } }] } }), grants: await prisma.machineAccessGrant.count({ where: { machineClient: { clientId: { in: TARGET_IDS } } } }), audits: await prisma.grantChangeAudit.count({ where: { clientId: { in: TARGET_IDS } } }) }; }
async function makePlan(): Promise<any> { const result = await run('plan'); assert.equal(result.code, 0, result.stderr); assert.equal(result.stderr, ''); const envelope = JSON.parse(result.stdout); writeFileSync(planPath, `${JSON.stringify(envelope)}\n`, { mode: 0o600 }); return envelope; }

await test('closed static surface has exact identities, scrypt, strong production gates, rollback markers, and no Audience writes', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.match(source, /AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1/);
  assert.match(source, /mc_Ez8kTAKKvcf2pF40aoUM4q9M/); assert.match(source, /mc_uYu1fDfNHjzUlRQGJdTajz9n/);
  assert.match(source, /N:\s*16384, r:\s*8, p:\s*1/); assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /AUTHORIZED_NOTIFICATION_INGRESS_PHASE_B_APPLY_V1/); assert.match(source, /production apply requires a clean worktree/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/); assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /ROLLBACK_INCOMPLETE/); assert.match(source, /OUTCOME_UNKNOWN/); assert.match(source, /durableMarker/);
  assert.doesNotMatch(source, /authAudience\.(?:create|update|upsert|delete)/);
  assert.doesNotMatch(source, /allowedResources:\s*\[[^\]]+\]|allowedScopes:\s*\[[^\]]+\]/);
  assert.ok(existsSync(RUNNER));
  assert.deepEqual(readdirSync(join(ROOT, 'scripts')).filter((v) => v.includes('notification-ingress-service-credentials-v1')).sort(), ['run-notification-ingress-service-credentials-v1-conformance.sh', 'supply-notification-ingress-service-credentials-v1.ts']);
  assert.deepEqual(readdirSync(dirname(fileURLToPath(import.meta.url))).filter((v) => v.includes('notification-ingress-service-credentials-v1')), ['supply-notification-ingress-service-credentials-v1.test.ts']);
});

for (const kind of ['missing', 'mismatch'] as const) await test(`Audience ${kind} refuses plan read-only with target writes zero`, async () => { await reset(); await seedAudience(kind); const before = await targetCounts(); const result = await run('plan'); assert.notEqual(result.code, 0); assert.match(result.stderr, /Audience/); assert.deepEqual(await targetCounts(), before); assert.equal(existsSync(descriptor.marker_path), false); });

await test('default plan is canonical deterministic, secret-free, read-only, and covers complete non-target corpus', async () => {
  await reset(); await seedAudience(); await seedNonTarget(); const before = await targetCounts(); const first = await run('plan'); const second = await run('plan'); assert.equal(first.code, 0, first.stderr); assert.equal(second.code, 0, second.stderr); assert.equal(first.stdout, second.stdout); assert.deepEqual(await targetCounts(), before); assert.doesNotMatch(first.stdout + first.stderr, /sentinel-secret-hash-never-report/); const envelope = JSON.parse(first.stdout); assert.equal(envelope.plan.classification, 'CREATE'); assert.equal(envelope.plan.non_target.client_count, 1); assert.equal(envelope.plan.non_target.grant_count, 1); assert.match(envelope.plan_sha256, /^[0-9a-f]{64}$/); assert.equal(envelope.plan.destinations.every((v: any) => !Object.hasOwn(v, 'secret')), true);
});

await test('apply rejects missing/stale/wrong-environment digest and approval with zero writes and zero destinations', async () => {
  await reset(); await seedAudience(); const envelope = await makePlan(); const wrongDigest = await run('apply', { plan: planPath, digest: '0'.repeat(64), approval: approval(envelope) }); assert.notEqual(wrongDigest.code, 0); assert.match(wrongDigest.stderr, /digest mismatch/); const wrongApproval = approval(envelope); wrongApproval.environment = 'production'; const rejected = await run('apply', { plan: planPath, digest: envelope.plan_sha256, approval: wrongApproval }); assert.notEqual(rejected.code, 0); assert.match(rejected.stderr, /approval binding mismatch/); assert.deepEqual(await targetCounts(), { principals: 0, clients: 0, grants: 0, audits: 0 }); assert.equal(existsSync(join(descriptor.destination_root, 'svc-forum/notification-ingress.env')), false); assert.equal(existsSync(join(descriptor.destination_root, 'svc-workflow/.env')), false);
});

await test('complete non-target digest detects stale-plan drift before target or filesystem writes', async () => {
  await reset(); await seedAudience(); await seedNonTarget(); const envelope = await makePlan();
  await prisma.machineClient.update({ where: { clientId: 'mc_ssssssssssssssssssssssss' }, data: { allowedScopes: ['legacy-scope', 'concurrent-drift'] } });
  const result = await run('apply', { plan: planPath, digest: envelope.plan_sha256, approval: approval(envelope) });
  assert.notEqual(result.code, 0); assert.match(result.stderr, /plan-to-live drift/);
  assert.deepEqual(await targetCounts(), { principals: 0, clients: 0, grants: 0, audits: 0 });
  assert.equal(existsSync(join(descriptor.destination_root, 'svc-forum/notification-ingress.env')), false);
  assert.equal(existsSync(join(descriptor.destination_root, 'svc-workflow/.env')), false);
});

await test('authorized first apply atomically creates two exact principals, clients, grants, closed audits and 0600 destinations', async () => {
  await reset(); await seedAudience(); await seedNonTarget(); const sentinelBefore = await prisma.machineClient.findUniqueOrThrow({ where: { clientId: 'mc_ssssssssssssssssssssssss' } }); const grantBefore = await prisma.machineAccessGrant.findFirstOrThrow({ where: { machineClientId: sentinelBefore.id } }); const envelope = await makePlan(); const result = await run('apply', { plan: planPath, digest: envelope.plan_sha256, approval: approval(envelope) }); assert.equal(result.code, 0, result.stderr); const report = JSON.parse(result.stdout); assert.equal(report.result, 'COMMITTED'); assert.deepEqual(report.writes, { principals: 2, clients: 2, grants: 2, audits: 2, destinations: 2, secrets_generated: 2 }); assert.deepEqual(await targetCounts(), { principals: 2, clients: 2, grants: 2, audits: 2 });
  const principals = await prisma.machinePrincipal.findMany({ where: { externalRef: { in: PRINCIPAL_REFS } }, orderBy: { externalRef: 'asc' } }); assert.equal(principals.every((p) => p.principalType === 'service' && p.agentId === null && p.ownerUserId === null && p.status === 'active'), true);
  const clients = await prisma.machineClient.findMany({ where: { clientId: { in: TARGET_IDS } }, orderBy: { clientId: 'asc' }, include: { accessGrants: true } }); assert.equal(clients.every((c) => c.status === 'active' && c.allowedResources.length === 0 && c.allowedScopes.length === 0 && c.accessGrants.length === 1 && c.accessGrants[0].audienceId === 'agent-core-notification-ingress-v1' && c.accessGrants[0].scopes.length === 1 && c.accessGrants[0].scopes[0] === 'notification.deliver' && c.accessGrants[0].version === 1), true); assert.notEqual(clients[0].secretHash, clients[1].secretHash);
  const audits = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: TARGET_IDS } } }); assert.equal(audits.length, 2); assert.equal(audits.every((a) => a.migrationId === 'notification-ingress-service-credential-grant-v1' && a.beforeValue === null && a.changeType === 'create' && a.expectedGrantVersion === null && a.resultingGrantVersion === 1 && a.reason.includes(envelope.plan_sha256)), true);
  for (const [relative, clientId] of [['svc-forum/notification-ingress.env', DEST_FORUM_ID], ['svc-workflow/.env', DEST_WORKFLOW_ID]] as const) { const path = join(descriptor.destination_root, relative); const stat = await import('node:fs').then((m) => m.statSync(path)); assert.equal(stat.mode & 0o777, 0o600); const bytes = readFileSync(path, 'utf8'); assert.match(bytes, new RegExp(`AUTH_NOTIFICATION_INGRESS_CLIENT_ID=${clientId}`)); assert.match(bytes, /AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET=[A-Za-z0-9_-]{43}/); assert.equal(bytes.includes(clientId === DEST_FORUM_ID ? DEST_WORKFLOW_ID : DEST_FORUM_ID), false); assert.equal((result.stdout + result.stderr).includes(bytes.split('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET=')[1].trim()), false); }
  assert.deepEqual(await prisma.machineClient.findUniqueOrThrow({ where: { id: sentinelBefore.id } }), sentinelBefore); assert.deepEqual(await prisma.machineAccessGrant.findFirstOrThrow({ where: { machineClientId: sentinelBefore.id } }), grantBefore);
});

await test('post-apply plan is deterministic exact-rerun NOOP; apply NOOP and verify write nothing', async () => {
  const post1 = await run('plan'); const post2 = await run('plan'); assert.equal(post1.code, 0, post1.stderr); assert.equal(post1.stdout, post2.stdout); const noopEnvelope = JSON.parse(post1.stdout); assert.equal(noopEnvelope.plan.classification, 'EXACT_RERUN_NOOP'); writeFileSync(planPath, post1.stdout, { mode: 0o600 }); const before = await targetCounts(); const noop = await run('apply', { plan: planPath, digest: noopEnvelope.plan_sha256, approval: approval(noopEnvelope) }); assert.equal(noop.code, 0, noop.stderr); assert.equal(JSON.parse(noop.stdout).result, 'NOOP'); assert.equal(JSON.parse(noop.stdout).writes.secrets_generated, 0); assert.deepEqual(await targetCounts(), before); const verify = await run('verify', { plan: planPath, digest: noopEnvelope.plan_sha256 }); assert.equal(verify.code, 0, verify.stderr); assert.equal(JSON.parse(verify.stdout).result, 'VERIFIED'); assert.deepEqual(await targetCounts(), before);
});

await test('partial target, destination mismatch, and non-target drift all refuse without repair', async () => {
  await prisma.machineAccessGrant.delete({ where: { machineClientId_audienceId: { machineClientId: (await prisma.machineClient.findUniqueOrThrow({ where: { clientId: DEST_FORUM_ID } })).id, audienceId: 'agent-core-notification-ingress-v1' } } }); const partial = await run('plan'); assert.notEqual(partial.code, 0); assert.match(partial.stderr, /SHAPE_MISMATCH|partial/); assert.equal((await targetCounts()).grants, 1);
});

await test('injected second Grant failure rolls back both callers, both audits and both destination installs', async () => {
  await reset(); await seedAudience(); const envelope = await makePlan(); await prisma.$executeRawUnsafe(`CREATE FUNCTION nsc_fail_second_grant_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.machine_client_id = (SELECT id FROM machine_clients WHERE client_id='${DEST_WORKFLOW_ID}') THEN RAISE EXCEPTION 'injected second grant failure'; END IF; RETURN NEW; END $$`); await prisma.$executeRawUnsafe('CREATE TRIGGER nsc_fail_second_grant BEFORE INSERT ON machine_access_grants FOR EACH ROW EXECUTE FUNCTION nsc_fail_second_grant_fn()'); const result = await run('apply', { plan: planPath, digest: envelope.plan_sha256, approval: approval(envelope) }); assert.equal(result.code, 30, result.stderr); assert.equal(JSON.parse(result.stdout).result, 'ROLLED_BACK'); assert.deepEqual(await targetCounts(), { principals: 0, clients: 0, grants: 0, audits: 0 }); assert.equal(existsSync(join(descriptor.destination_root, 'svc-forum/notification-ingress.env')), false); assert.equal(existsSync(join(descriptor.destination_root, 'svc-workflow/.env')), false); assert.equal(existsSync(descriptor.marker_path), false);
});

await test('incomplete destination rollback fails loud, persists a secret-free marker, and blocks retry', async () => {
  await reset(); await seedAudience(); const envelope = await makePlan(); const faultDescriptor = { ...descriptor, fault_injection: 'after-install-and-restore-fail' as const }; const failed = await run('apply', { plan: planPath, digest: envelope.plan_sha256, approval: approval(envelope), descriptor: faultDescriptor }); assert.equal(failed.code, 40, failed.stderr); const report = JSON.parse(failed.stdout); assert.equal(report.result, 'ROLLBACK_INCOMPLETE'); assert.ok(report.residual_coordinates.length >= 2); assert.deepEqual(await targetCounts(), { principals: 0, clients: 0, grants: 0, audits: 0 }); assert.equal(existsSync(descriptor.marker_path), true); const marker = JSON.parse(readFileSync(descriptor.marker_path, 'utf8')); assert.equal(marker.result, 'ROLLBACK_INCOMPLETE'); assert.equal(Object.hasOwn(marker, 'secret'), false); const retry = await run('apply', { plan: planPath, digest: envelope.plan_sha256, approval: approval(envelope), descriptor: faultDescriptor }); assert.notEqual(retry.code, 0); assert.match(retry.stderr, /recovery marker blocks APPLY/);
});

await test('destination parent symlink redirection is refused before any write', async () => {
  await reset(); await seedAudience(); const forumParent = join(descriptor.destination_root, 'svc-forum'); rmSync(forumParent, { recursive: true, force: true }); symlinkSync(descriptor.destination_root, forumParent, 'dir'); const result = await run('plan'); assert.notEqual(result.code, 0); assert.match(result.stderr, /parent chain|real directories/); assert.deepEqual(await targetCounts(), { principals: 0, clients: 0, grants: 0, audits: 0 });
});

await test('descriptor seam refuses production-like database and destination coordinates', async () => {
  await reset(); const badDb = await run('plan', { descriptor: { ...descriptor, database_url: 'postgresql://prod.example/auth', destination_root: '/Users/yanfenma/.local/services' } }); assert.notEqual(badDb.code, 0); assert.match(badDb.stderr, /disposable-loopback|temporary/); assert.deepEqual(await targetCounts(), { principals: 0, clients: 0, grants: 0, audits: 0 });
});

await prisma.$disconnect();
