import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRIPT = path.join(ROOT, 'scripts/supply-agentcore-trusted-fleet-grants-v1.ts');
const SHELL = path.join(ROOT, 'scripts/run-agentcore-trusted-fleet-grants-v1-conformance.sh');
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
const baseDescriptor = JSON.parse(readDescriptorFd()) as {
  schema_version: 1; container_id: string; nonce: string; host_port: number;
  database: string; audit_metadata: Record<string, string>;
  fixture_mapping: Record<string, string>; mapping_sha256: string; plan_sha256: string;
};
const databaseUrl = `postgresql://postgres@127.0.0.1:${baseDescriptor.host_port}/${baseDescriptor.database}?schema=public`;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const ROSTER: readonly string[] = Object.freeze([
  'agt_ceo-agent',
  'agt_stock-agent',
  'agt_research-agent',
  'agt_knowledge-curator-agent',
  'agt_daily-thought-agent',
  'agt_efficiency-agent',
  'agt_lobster-agent',
  'agt_itops-agent',
  'agt_healthcheck-agent',
  'agt_hr-agent',
  'agt_security-agent',
  'agt_skill-engineer-agent',
  'agt_discipline-coach-agent',
  'agt_blog-agent',
  'agt_education-agent',
  'agt_psychology-agent',
  'agt_game-dev-agent',
  'agt_finance-agent',
  'agt_devtools-agent',
  'agt_voice-tech-agent',
  'agt_image-gen-agent',
  'agt_email-manager-agent',
  'agt_account-manager-agent',
  'agt_shopping-list-agent',
  'agt_feishu-expert-agent',
  'agt_podcast-producer-agent',
  'agt_soul-questioner-agent',
  'agt_lobster-guide-agent',
  'agt_article-publisher-agent',
  'agt_travel-planner-agent',
  'agt_agent-dev-engineer',
  'agt_paper-reviewer-agent',
  'agt_3d-print-agent',
  'agt_writing-style-analyst-agent',
  'agt_family-doctor-2-agent',
  'agt_feishu-expert-2-agent',
  'agt_reimbursement-expert',
  'agt_mobile-app-engineer',
  'agt_miniapp-game-engineer',
  'agt_trend-tracker',
  'agt_biz-explorer',
  'agt_video-producer',
  'agt_creative-writer',
  'agt_test-engineer',
  'agt_learning-expert',
  'agt_content-ops-agent',
  'agt_finance-housekeeper-agent',
  'agt_quant-trading-agent',
  'agt_novel-writer',
  'agt_frontend-react-engineer',
  'agt_open-source-agent',
  'agt_smart-home-agent',
  'agt_product-manager',
  'agt_product-designer',
  'agt_qa-reviewer',
  'agt_investment-debater',
  'agt_backend-engineer-2',
  'agt_qa-reviewer-2',
  'agt_social-butterfly-agent',
  'agt_arch-reviewer',
  'agt_explorer',
  'agt_ppt-designer',
  'agt_training-expert-agent',
  'agt_needs-radar-agent',
  'agt_delivery-review-agent',
  'agt_course-community-agent',
  'agt_biz-product-designer',
  'agt_private-chef-agent',
  'agt_course-community-agent-2',
  'agt_book-deconstructor-agent',
  'agt_build-in-public-agent',
  'agt_job-watch-agent',
  'agt_search-expert-agent',
  'agt_transcript-editor-agent',
  'agt_home-repair-agent',
  'agt_sales-copy-agent',
  'agt_hao-yang-mao-agent',
  'agt_family-steward-agent',
  'agt_video-model-expert',
  'agt_game-designer-agent',
  'agt_game-producer-agent',
  'agt_reader-simulator-agent',
  'agt_thesis-advisor-agent',
  'agt_biz-reviewer',
  'agt_translator-agent',
  'agt_translation-qa-agent',
]);


const ROSTER_SORTED: readonly string[] = [...ROSTER].sort((a, b) => Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii')));
const CANARY = 'agt_build-in-public-agent';
const CANARY_INDEX = ROSTER_SORTED.indexOf(CANARY);
const FIRST_NON_CANARY_INDEX = CANARY_INDEX === 0 ? 1 : 0;
const SECRET_HASH = 'not-a-secret-test-hash';
const fixtureClient = (index: number): string => `mc_${index.toString(36).padStart(24, '0')}`;
const fixturePrincipal = (index: number): string => `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
const fixtureInternal = (index: number): string => `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
const FIXTURE_MAPPING: Record<string, string> = Object.fromEntries(ROSTER_SORTED.map((agentId, index) => [agentId, fixtureClient(index)]));
const FIXTURE_MAPPING_BYTES = Buffer.from(JSON.stringify(FIXTURE_MAPPING), 'utf8');
const FIXTURE_MAPPING_SHA256 = createHash('sha256').update(FIXTURE_MAPPING_BYTES).digest('hex');

const canonicalJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonicalJson((value as Record<string, unknown>)[key])]));
  }
  return value;
};
const planDocument = {
  plan_version: 'AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1_PLAN_1',
  client_mapping_sha256: '60f3f9090fdb941b36fa10bdfea38e5a185562e5d459ee27f7a98f347e7e67b6',
  targets: { 'svc-workflow': ['workflow.read'], 'svc-forum': ['forum.read', 'forum.write'] },
  rows: ROSTER_SORTED.map((agentId) => ({
    agent_id: agentId,
    client_id: FIXTURE_MAPPING[agentId],
    audiences: {
      'svc-workflow': { current_state: 'ABSENT', operation: 'CREATE', target_scopes: ['workflow.read'] },
      'svc-forum': { current_state: 'ABSENT', operation: 'CREATE', target_scopes: ['forum.read', 'forum.write'] },
    },
  })),
};
const FIXTURE_PLAN_SHA256 = createHash('sha256').update(JSON.stringify(canonicalJson(planDocument)), 'utf8').digest('hex');

function fullDescriptor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...baseDescriptor,
    fixture_mapping: FIXTURE_MAPPING,
    mapping_sha256: FIXTURE_MAPPING_SHA256,
    plan_sha256: FIXTURE_PLAN_SHA256,
    ...overrides,
  };
}

async function invoke(extraDescriptor: unknown = fullDescriptor(), scope = 'fleet') {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --conformance-apply --scope "$4" --descriptor-fd 3',
      'tfs-test', JSON.stringify(extraDescriptor), NODE, SCRIPT, scope,
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

const STOCK_PRINCIPAL = '50000000-0000-4000-8000-000000000001';
const CTO_PRINCIPAL = '50000000-0000-4000-8000-000000000002';
const STOCK_INTERNAL = '60000000-0000-4000-8000-000000000001';
const CTO_INTERNAL = '60000000-0000-4000-8000-000000000002';
const STOCK_PUBLIC = `mc_${'s'.repeat(24)}`;
const CTO_PUBLIC = `mc_${'t'.repeat(24)}`;

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS tfs_fail_grant ON machine_access_grants');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS tfs_fail_audit ON grant_change_audits');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS tfs_fail_second()');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE grant_change_audits, machine_access_grants,
    delegation_grants, proxy_accepted_subject_audiences, trusted_proxies,
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
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='delegation_grants_audience_id_fkey') THEN
      ALTER TABLE delegation_grants ADD CONSTRAINT delegation_grants_audience_id_fkey
        FOREIGN KEY (audience_id) REFERENCES auth_audiences(audience_id) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`);
}

type SeedOptions = {
  omitFleet?: number;
  inactiveFleet?: number;
  wrongBindingFleet?: number;
  workflowAudience?: 'valid' | 'missing' | 'inactive' | 'machine-disabled' | 'scope-missing';
  forumAudience?: 'valid' | 'missing' | 'inactive' | 'scope-missing';
  nonTargetDrift?: 'extra-grant' | 'wrong-scope';
  canaryWorkflowOnly?: boolean;
  nonCanaryWorkflowOnly?: boolean;
  nonCanaryForumOnly?: boolean;
  nonCanaryForbiddenScope?: boolean;
  nonCanaryGrantNoAudit?: boolean;
  nonCanaryAuditDrift?: boolean;
};

async function seed(options: SeedOptions = {}): Promise<void> {
  const workflow = options.workflowAudience ?? 'valid';
  const forum = options.forumAudience ?? 'valid';
  if (workflow !== 'missing') {
    await prisma.authAudience.create({ data: {
      audienceId: 'svc-workflow', resourceService: 'svc-workflow', scopeNamespace: 'workflow',
      acceptedPrincipalTypes: ['agent'], registeredScopes: workflow === 'scope-missing' ? ['workflow.execute'] : ['workflow.admin', 'workflow.execute', 'workflow.read'],
      humanAccessEnabled: false, machineAccessEnabled: workflow !== 'machine-disabled', delegatedAccessEnabled: true,
      status: workflow === 'inactive' ? 'disabled' : 'active', freezeReady: true, version: 1,
    } });
  }
  if (forum !== 'missing') {
    await prisma.authAudience.create({ data: {
      audienceId: 'svc-forum', resourceService: 'svc-forum', scopeNamespace: 'forum',
      acceptedPrincipalTypes: ['agent'], registeredScopes: forum === 'scope-missing' ? ['forum.read'] : ['forum.read', 'forum.write'],
      humanAccessEnabled: false, machineAccessEnabled: true, delegatedAccessEnabled: false,
      status: forum === 'inactive' ? 'disabled' : 'active', freezeReady: true, version: 1,
    } });
  }
  for (const [index, agentId] of ROSTER_SORTED.entries()) {
    if (options.omitFleet === index) continue;
    await prisma.machinePrincipal.create({ data: {
      id: fixturePrincipal(index), principalType: 'agent', agentId,
      ownerUserId: null, displayName: `fleet-${index}`,
      externalRef: `agentcore:v1:principal:${agentId}`,
      status: options.inactiveFleet === index ? 'disabled' : 'active',
    } });
  }
  for (const [index, agentId] of ROSTER_SORTED.entries()) {
    if (options.omitFleet === index) continue;
    await prisma.machineClient.create({ data: {
      id: fixtureInternal(index), clientId: fixtureClient(index),
      machinePrincipalId: options.wrongBindingFleet === index
        ? fixturePrincipal(index === 0 ? 1 : 0) : fixturePrincipal(index),
      secretHash: SECRET_HASH, externalRef: `agentcore:v1:client:${agentId}`,
      status: options.inactiveFleet === index ? 'revoked' : 'active',
      allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'],
    } });
  }
  if (options.canaryWorkflowOnly) {
    await prisma.machineAccessGrant.create({ data: {
      machineClientId: fixtureInternal(CANARY_INDEX), audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1,
    } });
  }
  const partialIndex = FIRST_NON_CANARY_INDEX;
  if (options.nonCanaryWorkflowOnly) {
    await prisma.machineAccessGrant.create({ data: {
      machineClientId: fixtureInternal(partialIndex), audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1,
    } });
  }
  if (options.nonCanaryForumOnly) {
    await prisma.machineAccessGrant.create({ data: {
      machineClientId: fixtureInternal(partialIndex), audienceId: 'svc-forum', scopes: ['forum.read', 'forum.write'], version: 1,
    } });
  }
  if (options.nonCanaryForbiddenScope) {
    await prisma.machineAccessGrant.create({ data: {
      machineClientId: fixtureInternal(partialIndex), audienceId: 'svc-workflow', scopes: ['workflow.execute'], version: 1,
    } });
  }
  if (options.nonCanaryGrantNoAudit) {
    await prisma.machineAccessGrant.create({ data: { machineClientId: fixtureInternal(partialIndex), audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 } });
    await prisma.machineAccessGrant.create({ data: { machineClientId: fixtureInternal(partialIndex), audienceId: 'svc-forum', scopes: ['forum.read', 'forum.write'], version: 1 } });
  }
  if (options.nonCanaryAuditDrift) {
    await prisma.grantChangeAudit.create({ data: {
      migrationId: 'drift', sourceGitCommit: 'd'.repeat(40), operatorId: 'other', approvalRef: 'other',
      reason: 'drift', clientId: fixtureClient(partialIndex), changeType: 'create', expectedGrantVersion: null,
      resultingGrantVersion: 2, beforeValue: undefined,
      afterValue: { client_id: fixtureClient(partialIndex), client_kind: 'machine', principal_id: fixturePrincipal(partialIndex),
        principal_type: 'agent', human_audience_grants: [], machine_access_grants: {},
        delegation_grants: {}, status: 'active', version: 2 },
    } });
  }
  for (const [canary, principalId, internalId, publicId] of [
    ['agt_stock_agent', STOCK_PRINCIPAL, STOCK_INTERNAL, STOCK_PUBLIC],
    ['agt_cto-agent', CTO_PRINCIPAL, CTO_INTERNAL, CTO_PUBLIC],
  ] as const) {
    await prisma.machinePrincipal.create({ data: {
      id: principalId, principalType: 'agent', agentId: canary, ownerUserId: null,
      externalRef: `agentcore:v1:principal:${canary}`, status: 'active',
    } });
    await prisma.machineClient.create({ data: {
      id: internalId, clientId: publicId, machinePrincipalId: principalId,
      secretHash: SECRET_HASH, externalRef: `agentcore:v1:client:${canary}`, status: 'active',
      allowedResources: [], allowedScopes: [],
    } });
    if (workflow !== 'missing') {
      await prisma.machineAccessGrant.create({ data: { machineClientId: internalId, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 } });
    }
    if (forum !== 'missing') {
      await prisma.machineAccessGrant.create({ data: { machineClientId: internalId, audienceId: 'svc-forum', scopes: ['forum.read', 'forum.write'], version: 2 } });
    }
    await prisma.grantChangeAudit.create({ data: {
      migrationId: `stage-history-${canary}`, sourceGitCommit: 'e'.repeat(40), operatorId: 'stage-w-f',
      approvalRef: 'stage-history', reason: 'parent stage end-state fixture', clientId: publicId,
      changeType: 'replace', expectedGrantVersion: 1, resultingGrantVersion: 2, beforeValue: undefined,
      afterValue: { client_id: publicId, client_kind: 'machine', principal_id: principalId, principal_type: 'agent',
        human_audience_grants: [], machine_access_grants: { 'svc-workflow': ['workflow.read'], 'svc-forum': ['forum.read', 'forum.write'] },
        delegation_grants: {}, status: 'active', version: 2 },
    } });
  }
  if (options.nonTargetDrift === 'extra-grant') {
    await prisma.authAudience.create({ data: {
      audienceId: 'svc-okr', resourceService: 'svc-okr', scopeNamespace: 'okr',
      acceptedPrincipalTypes: ['user', 'agent'], registeredScopes: ['okr.read', 'okr.write'],
      humanAccessEnabled: true, machineAccessEnabled: true, delegatedAccessEnabled: false,
      status: 'active', freezeReady: true, version: 1,
    } });
    await prisma.machineAccessGrant.create({ data: { machineClientId: STOCK_INTERNAL, audienceId: 'svc-okr', scopes: ['okr.read'], version: 1 } });
  }
  if (options.nonTargetDrift === 'wrong-scope') {
    await prisma.machineAccessGrant.update({ where: { machineClientId_audienceId: { machineClientId: STOCK_INTERNAL, audienceId: 'svc-workflow' } },
      data: { scopes: ['workflow.execute'] } });
  }
}

async function fleetCounts() {
  const internalIds = ROSTER_SORTED.map((_, index) => fixtureInternal(index));
  const publicIds = ROSTER_SORTED.map((_, index) => fixtureClient(index));
  return {
    grants: await prisma.machineAccessGrant.count({ where: { machineClientId: { in: internalIds } } }),
    audits: await prisma.grantChangeAudit.count({ where: { clientId: { in: publicIds } } }),
  };
}

async function snapshotNonTarget() {
  return await prisma.machineAccessGrant.findMany({
    where: { machineClientId: { in: [STOCK_INTERNAL, CTO_INTERNAL] } },
    orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }],
  });
}

async function snapshotIdentities() {
  return {
    principals: await prisma.machinePrincipal.findMany({ orderBy: { id: 'asc' } }),
    clients: await prisma.machineClient.findMany({ orderBy: { id: 'asc' } }),
  };
}

await test('static boundary: exact frozen constants, no legacy or secret surface, no exports', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(source, /allowedResources|allowedScopes/);
  assert.doesNotMatch(source, /secretHash|secret_hash|client_secret/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.match(source, /expectedGrantVersion:\s*null/);
  assert.match(source, /resultingGrantVersion:\s*1/);
  assert.match(source, /60f3f9090fdb941b36fa10bdfea38e5a185562e5d459ee27f7a98f347e7e67b6/);
  assert.match(source, /7b36807de526b521262e507f26c7fbedb49e3883e04a60d5bed3f2999c634056/);
  assert.match(source, /CLIENT_MAPPING_PATH = '\/usr\/local\/libexec\/agent-core\/config\/\.fleet-phase-a-bootstrap\/client-mapping\.json'/);
  assert.match(source, /'agt_build-in-public-agent'/);
  assert.match(source, /LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(source, /LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE/);
  assert.doesNotMatch(source, /workflow\.execute|forum\.admin|forum\.moderate|'\*'/);
  const targets = [...source.matchAll(/principalExternalRef: 'agentcore:v1:principal:agt_[^']+'/g)].length;
  assert.equal(targets, 86, 'operator must embed exactly 86 closed targets');
});

await test('three-file closure: no fourth implementation file exists', () => {
  const scripts = readdirSync(path.join(ROOT, 'scripts')).filter((name) => /trusted-fleet-grants-v1/.test(name));
  assert.deepEqual(scripts.sort(), ['run-agentcore-trusted-fleet-grants-v1-conformance.sh', 'supply-agentcore-trusted-fleet-grants-v1.ts']);
  const tests = readdirSync(HERE).filter((name) => /trusted-fleet-grants-v1/.test(name));
  assert.deepEqual(tests, ['supply-agentcore-trusted-fleet-grants-v1.test.ts']);
  assert.equal(existsSync(SHELL), true);
});

await test('mapping digest gate refuses drifted fixture digests and mismatched entries', async () => {
  await reset(); await seed();
  const wrongMappingSha = await invoke(fullDescriptor({ mapping_sha256: '0'.repeat(64) }), 'canary');
  assert.notEqual(wrongMappingSha.code, 0);
  assert.match(wrongMappingSha.stderr, /client mapping digest/);
  const wrongPlanSha = await invoke(fullDescriptor({ plan_sha256: '0'.repeat(64) }), 'canary');
  assert.notEqual(wrongPlanSha.code, 0);
  assert.match(wrongPlanSha.stderr, /frozen fleet grant plan/);
  const shortMapping: Record<string, string> = { ...FIXTURE_MAPPING };
  delete shortMapping[ROSTER_SORTED[0]];
  const shortBytes = Buffer.from(JSON.stringify(shortMapping), 'utf8');
  const short = await invoke(fullDescriptor({
    fixture_mapping: shortMapping,
    mapping_sha256: createHash('sha256').update(shortBytes).digest('hex'),
  }), 'canary');
  assert.notEqual(short.code, 0);
  assert.match(short.stderr, /exactly 86/);
  const swapped: Record<string, string> = { ...FIXTURE_MAPPING, [ROSTER_SORTED[0]]: `mc_${'x'.repeat(24)}` };
  const swappedBytes = Buffer.from(JSON.stringify(swapped), 'utf8');
  const mismatched = await invoke(fullDescriptor({
    fixture_mapping: swapped,
    mapping_sha256: createHash('sha256').update(swappedBytes).digest('hex'),
  }), 'canary');
  assert.notEqual(mismatched.code, 0);
  assert.match(mismatched.stderr, /live client ID does not equal the trusted mapping entry/);
  assert.deepEqual(await fleetCounts(), { grants: 0, audits: 0 });
});

await test('read-only production plan hard-binds the frozen grant plan digest', async () => {
  await reset(); await seed();
  const result = await invokeArgs(['--plan', '--scope', 'fleet'], { DATABASE_URL: databaseUrl });
  assert.notEqual(result.code, 0, 'a plan digest that is not the frozen production value must fail closed');
  assert.match(result.stderr, /frozen fleet grant plan/);
  assert.deepEqual(await fleetCounts(), { grants: 0, audits: 0 });
});

await test('fleet apply is refused while the Build-in-Public canary is pristine', async () => {
  await reset(); await seed();
  const result = await invoke(undefined, 'fleet');
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /fleet gate/);
  assert.deepEqual(await fleetCounts(), { grants: 0, audits: 0 });
});

await test('canary apply is one atomic workflow+forum transition with one schema-valid audit', async () => {
  await reset(); await seed();
  const identitiesBefore = await snapshotIdentities();
  const nonTargetBefore = await snapshotNonTarget();
  const result = await invoke(undefined, 'canary');
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
  assert.deepEqual(report.fleet_counts, { create: 86, noop: 0 });
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(SECRET_HASH));
  assert.deepEqual(await fleetCounts(), { grants: 2, audits: 1 });
  const grants = await prisma.machineAccessGrant.findMany({
    where: { machineClientId: fixtureInternal(CANARY_INDEX) },
    orderBy: { audienceId: 'asc' },
  });
  assert.deepEqual(grants.map(({ audienceId, scopes, version }) => ({ audienceId, scopes, version })), [
    { audienceId: 'svc-forum', scopes: ['forum.read', 'forum.write'], version: 1 },
    { audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 },
  ]);
  const audit = await prisma.grantChangeAudit.findFirstOrThrow({ where: { clientId: fixtureClient(CANARY_INDEX) } });
  const schema = JSON.parse(readFileSync(path.join(ROOT, 'contract-bundles/minimal-auth-v1/schemas/grants.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/grantChangeAudit` });
  const envelope = {
    change_id: audit.id, migration_id: audit.migrationId, source_git_commit: audit.sourceGitCommit,
    operator_id: audit.operatorId, approval_ref: audit.approvalRef, reason: audit.reason,
    client_id: audit.clientId, change_type: audit.changeType,
    expected_grant_version: audit.expectedGrantVersion, resulting_grant_version: audit.resultingGrantVersion,
    before_value: audit.beforeValue, after_value: audit.afterValue, timestamp: audit.timestamp.toISOString(),
  };
  assert.equal(validate(envelope), true, JSON.stringify(validate.errors));
  assert.equal(audit.migrationId, 'agentcore-trusted-fleet-grant-supply-v1');
  assert.equal(audit.changeType, 'create'); assert.equal(audit.expectedGrantVersion, null);
  assert.equal(audit.resultingGrantVersion, 1); assert.equal(audit.beforeValue, null);
  assert.deepEqual((audit.afterValue as any).machine_access_grants, { 'svc-workflow': ['workflow.read'], 'svc-forum': ['forum.read', 'forum.write'] });
  assert.deepEqual(await snapshotIdentities(), identitiesBefore);
  assert.deepEqual(await snapshotNonTarget(), nonTargetBefore);
});

await test('fleet apply after canary PASS completes the remaining 85 and reruns as a byte-stable NOOP', async () => {
  await reset(); await seed();
  const canary = await invoke(undefined, 'canary');
  assert.equal(canary.code, 0, canary.stderr);
  const fleet = await invoke(undefined, 'fleet');
  assert.equal(fleet.code, 0, fleet.stderr);
  assert.deepEqual(await fleetCounts(), { grants: 172, audits: 86 });
  const grantsBefore = await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
  const auditsBefore = await prisma.grantChangeAudit.findMany({ where: { migrationId: 'agentcore-trusted-fleet-grant-supply-v1' }, orderBy: { clientId: 'asc' } });
  const rerun = await invoke(undefined, 'fleet');
  assert.equal(rerun.code, 0, rerun.stderr);
  assert.match(rerun.stdout, /"created":0,"noop":85/);
  assert.deepEqual(await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }), grantsBefore);
  assert.deepEqual(await prisma.grantChangeAudit.findMany({ where: { migrationId: 'agentcore-trusted-fleet-grant-supply-v1' }, orderBy: { clientId: 'asc' } }), auditsBefore);
  assert.equal((await fleetCounts()).grants, 172);
});

await test('exact canary rerun is a NOOP with zero new writes', async () => {
  await reset(); await seed();
  await invoke(undefined, 'canary');
  const before = await fleetCounts();
  const rerun = await invoke(undefined, 'canary');
  assert.equal(rerun.code, 0, rerun.stderr);
  assert.match(rerun.stdout, /"created":0,"noop":1/);
  assert.deepEqual(await fleetCounts(), before);
});

for (const [label, options] of [
  ['partial existing workflow-only state', { nonCanaryWorkflowOnly: true }],
  ['partial existing forum-only state', { nonCanaryForumOnly: true }],
  ['forbidden existing scope (workflow.execute)', { nonCanaryForbiddenScope: true }],
  ['existing exact grants without audit', { nonCanaryGrantNoAudit: true }],
  ['audit-only drift', { nonCanaryAuditDrift: true }],
  ['canary partial workflow-only state', { canaryWorkflowOnly: true }],
] as const) {
  await test(`${label} fails closed with zero target writes`, async () => {
    await reset(); await seed(options as SeedOptions);
    const before = await fleetCounts();
    const canaryAttempt = await invoke(undefined, 'canary');
    assert.notEqual(canaryAttempt.code, 0, `${label} must fail the canary apply`);
    const fleetAttempt = await invoke(undefined, 'fleet');
    assert.notEqual(fleetAttempt.code, 0, `${label} must fail the fleet apply`);
    assert.deepEqual(await fleetCounts(), before);
  });
}

for (const [name, options] of [
  ['fleet client missing', { omitFleet: FIRST_NON_CANARY_INDEX }],
  ['fleet client inactive', { inactiveFleet: FIRST_NON_CANARY_INDEX }],
  ['wrong fleet client-principal binding', { wrongBindingFleet: FIRST_NON_CANARY_INDEX }],
  ['svc-workflow audience missing', { workflowAudience: 'missing' }],
  ['svc-workflow audience inactive', { workflowAudience: 'inactive' }],
  ['svc-workflow machine access disabled', { workflowAudience: 'machine-disabled' }],
  ['workflow.read unregistered', { workflowAudience: 'scope-missing' }],
  ['svc-forum audience missing', { forumAudience: 'missing' }],
  ['svc-forum audience inactive', { forumAudience: 'inactive' }],
  ['forum.write unregistered', { forumAudience: 'scope-missing' }],
  ['non-target canary extra grant', { nonTargetDrift: 'extra-grant' }],
  ['non-target canary scope drift', { nonTargetDrift: 'wrong-scope' }],
] as const) {
  await test(`${name} fails closed with zero target writes`, async () => {
    await reset(); await seed(options as SeedOptions);
    const result = await invoke(undefined, 'canary');
    assert.notEqual(result.code, 0);
    assert.deepEqual(await fleetCounts(), { grants: 0, audits: 0 });
  });
}

await test('duplicate-corruption fleet client external_ref fails closed', async () => {
  await reset(); await seed();
  await prisma.$executeRawUnsafe('DROP INDEX machine_clients_external_ref_key');
  await prisma.$executeRawUnsafe(`INSERT INTO machine_clients
    (id, client_id, machine_principal_id, secret_hash, external_ref, status, allowed_resources, allowed_scopes, created_at, updated_at)
    VALUES ('40000000-0000-4000-8000-000000000099', 'mc_yyyyyyyyyyyyyyyyyyyyyyyy',
    '${fixturePrincipal(FIRST_NON_CANARY_INDEX)}', 'duplicate', 'agentcore:v1:client:${ROSTER_SORTED[FIRST_NON_CANARY_INDEX]}', 'active', '{}', '{}', now(), now())`);
  const result = await invoke(undefined, 'canary');
  assert.notEqual(result.code, 0);
});

async function installFailureTrigger(table: 'machine_access_grants' | 'grant_change_audits', trigger: string, condition: string): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION tfs_fail_second() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF ${condition} THEN RAISE EXCEPTION 'injected TFS failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON ${table}
    FOR EACH ROW EXECUTE FUNCTION tfs_fail_second()`);
}

await test('forum Grant insert failure rolls back the whole canary transition', async () => {
  await reset(); await seed();
  await installFailureTrigger('machine_access_grants', 'tfs_fail_grant', `NEW.audience_id = 'svc-forum'`);
  const result = await invoke(undefined, 'canary');
  assert.notEqual(result.code, 0);
  assert.deepEqual(await fleetCounts(), { grants: 0, audits: 0 });
});

await test('audit insert failure rolls back both Grants and the audit', async () => {
  await reset(); await seed();
  await installFailureTrigger('grant_change_audits', 'tfs_fail_audit', `NEW.client_id = '${fixtureClient(CANARY_INDEX)}'`);
  const result = await invoke(undefined, 'canary');
  assert.notEqual(result.code, 0);
  assert.deepEqual(await fleetCounts(), { grants: 0, audits: 0 });
});

await test('a concurrent non-cooperating Grant writer conflicts with zero fleet writes', async () => {
  await reset(); await seed();
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.machineAccessGrant.create({ data: { machineClientId: fixtureInternal(CANARY_INDEX), audienceId: 'svc-workflow', scopes: ['workflow.execute'], version: 9 } });
    pending = invoke(undefined, 'canary');
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  const result = await pending!;
  assert.notEqual(result.code, 0);
  assert.equal(await prisma.machineAccessGrant.count({ where: { machineClientId: fixtureInternal(CANARY_INDEX), audienceId: 'svc-forum' } }), 0);
  assert.equal(await prisma.grantChangeAudit.count({ where: { clientId: fixtureClient(CANARY_INDEX) } }), 0);
});

await test('legacy fields stay byte-identical and were never read or written by the operator', async () => {
  await reset(); await seed();
  const before = await prisma.machineClient.findMany({
    where: { id: { in: ROSTER_SORTED.map((_, index) => fixtureInternal(index)) } },
    select: { id: true, allowedResources: true, allowedScopes: true },
    orderBy: { id: 'asc' },
  });
  await invoke(undefined, 'canary');
  const after = await prisma.machineClient.findMany({
    where: { id: { in: ROSTER_SORTED.map((_, index) => fixtureInternal(index)) } },
    select: { id: true, allowedResources: true, allowedScopes: true },
    orderBy: { id: 'asc' },
  });
  assert.deepEqual(after, before);
  assert.ok(before.every((row) => row.allowedResources.length === 1 && row.allowedScopes.length === 1));
});

await test('descriptor rejects malformed, duplicate, and wrong-container coordinates', async () => {
  await reset(); await seed();
  const malformed = await invoke(fullDescriptor({ database: 'production' }), 'canary');
  assert.notEqual(malformed.code, 0);
  const extraField = await invoke(fullDescriptor({ unexpected: 1 }), 'canary');
  assert.notEqual(extraField.code, 0);
  const wrongNonce = await invoke(fullDescriptor({ nonce: '0'.repeat(64) }), 'canary');
  assert.notEqual(wrongNonce.code, 0);
  const badScope = await invoke(undefined, 'bogus');
  assert.notEqual(badScope.code, 0);
  assert.deepEqual(await fleetCounts(), { grants: 0, audits: 0 });
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
        if (child.stderr !== null) child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code) => {
          client.destroy();
          serverSide.destroy();
          server.close(() => resolve({ code, stderr }));
        });
      });
    });
  });
  assert.notEqual(socketRejected.code, 0, 'a socket FD must be rejected');
  assert.match(socketRejected.stderr, /must be a FIFO/);
  const temporary = mkdtempSync(path.join(tmpdir(), 'tfs-descriptor-'));
  const regularPath = path.join(temporary, 'descriptor.json');
  writeFileSync(regularPath, JSON.stringify(fullDescriptor()));
  try {
    const regular = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('/bin/bash', [
        '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
        'tfs-test', regularPath, NODE, SCRIPT,
      ], { cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' }, stdio: 'ignore' });
      child.on('error', reject); child.on('close', resolve);
    });
    assert.notEqual(regular, 0, 'a regular-file descriptor must be rejected');
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

await test('CLI and environment seam rejects unknown flags, DATABASE_URL, and mode cross-contamination', async () => {
  const cases: Array<[string, string[], Record<string, string>]> = [
    ['unknown flag in conformance-apply mode', ['--conformance-apply', '--bogus-flag'], {}],
    ['conformance-apply with DATABASE_URL', ['--conformance-apply'], { DATABASE_URL: 'postgresql://refused' }],
    ['conformance-apply with metadata-fd', ['--conformance-apply', '--metadata-fd', '3'], {}],
    ['apply with descriptor-fd', ['--apply', '--descriptor-fd', '3'], {}],
    ['plan and apply together', ['--plan', '--apply'], {}],
    ['apply and conformance-apply together', ['--apply', '--conformance-apply'], {}],
    ['invalid scope', ['--plan', '--scope', 'everything'], {}],
    ['descriptor-fd without a value', ['--conformance-apply', '--descriptor-fd'], {}],
    ['duplicate scope', ['--plan', '--scope', 'fleet', '--scope', 'canary'], {}],
  ];
  for (const [label, args, environment] of cases) {
    const result = await invokeArgs(args, environment);
    assert.notEqual(result.code, 0, `${label} must be rejected: ${result.stdout}`);
  }
});

await test('privilege-changing Docker capabilities are rejected before engine access', async () => {
  const docker = '/usr/local/bin/docker';
  const nonce = createHash('sha256').update(String(Math.random())).digest('hex');
  const labelHash = createHash('sha256').update(nonce).digest('hex');
  const name = `auth-tfs-conformance-cap-${nonce.slice(0, 12)}`;
  const id = execFileSync(docker, [
    'run', '-d', '--rm', '--name', name,
    '--label', `com.mayf3.auth.tfs-conformance=sha256:${labelHash}`,
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=128m',
    '--cap-add', 'SYS_ADMIN', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=auth_tfs_conformance', '-p', '127.0.0.1::5432',
    'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777',
    '-c', `tfs.conformance_nonce=${nonce}`,
  ], { encoding: 'utf8' }).trim();
  try {
    const hostPort = Number(execFileSync(docker, [
      'inspect', '--format', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', id,
    ], { encoding: 'utf8' }).trim());
    assert.ok(Number.isInteger(hostPort) && hostPort > 0 && hostPort <= 65535);
    const result = await invoke(fullDescriptor({ container_id: id, nonce, host_port: hostPort }), 'canary');
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /not exact disposable conformance PostgreSQL/);
  } finally { execFileSync(docker, ['rm', '-f', id], { stdio: 'ignore' }); }
});

test.after(async () => { await reset(); await prisma.$disconnect(); });
