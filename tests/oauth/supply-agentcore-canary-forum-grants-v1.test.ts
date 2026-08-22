import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
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
const SCRIPT = path.join(ROOT, 'scripts/supply-agentcore-canary-forum-grants-v1.ts');
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
const STOCK_PUBLIC = `mc_${'a'.repeat(24)}`;
const CTO_PUBLIC = `mc_${'b'.repeat(24)}`;
const SENTINEL_PUBLIC = `mc_${'z'.repeat(24)}`;

async function invoke(extraDescriptor: unknown = descriptor) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'stage-f-test', JSON.stringify(extraDescriptor), NODE, SCRIPT,
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

async function invokeHttp(fixture: unknown) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'stage-f-http-fifo-'));
    const fifo = path.join(temporary, 'fixture.fifo'); execFileSync('/usr/bin/mkfifo', [fifo]);
    const child = spawn('/bin/bash', [
      '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-http --fixture-fd 3',
      'stage-f-http-test', fifo, NODE, SCRIPT,
    ], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { rmSync(temporary, { recursive: true, force: true }); reject(error); });
    child.on('close', (code) => { rmSync(temporary, { recursive: true, force: true }); resolve({ code, stdout, stderr }); });
    writeFileSync(fifo, JSON.stringify(fixture));
  });
}

function paddedJson(fields: Record<string, unknown>, exactBytes: number): string {
  const value = JSON.stringify(fields);
  const padding = exactBytes - Buffer.byteLength(value);
  assert.ok(padding >= 0);
  return `${' '.repeat(padding)}${value}`;
}
void paddedJson;

function duplicateFirstMember(fields: Record<string, unknown>): string {
  const [first] = Object.entries(fields);
  const member = `${JSON.stringify(first[0])}:${JSON.stringify(first[1])}`;
  const rest = Object.entries(fields).slice(1).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`).join(',');
  return `{${member},${member}${rest.length > 0 ? `,${rest}` : ''}}`;
}

function httpFixture(bodyText: string, overrides: Record<string, unknown> = {}) {
  const body = Buffer.from(bodyText);
  return {
    schema_version: 1, kind: 'commit', request_path: '/repos/mayf3/dsh-agent-core/commits/main',
    tls_authorized: true, elapsed_ms: 9_999, status_code: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': String(body.length) },
    chunks_base64: [body.toString('base64')], terminal: 'end', error_code: null,
    ...overrides,
  };
}

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS stage_f_fail_grant ON machine_access_grants');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS stage_f_fail_audit ON grant_change_audits');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS stage_f_fail_second()');
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

async function seed(options: {
  omit?: 'stock' | 'cto';
  inactiveClient?: 'stock' | 'cto';
  inactivePrincipal?: 'stock' | 'cto';
  wrongBinding?: 'stock' | 'cto';
  forumAudience?: 'valid' | 'missing' | 'inactive' | 'machine-disabled' | 'agent-rejected' | 'scope-missing';
  sentinel?: boolean;
} = {}): Promise<void> {
  await prisma.authAudience.create({ data: {
    audienceId: 'svc-workflow', resourceService: 'svc-workflow', scopeNamespace: 'workflow',
    acceptedPrincipalTypes: ['agent', 'service'],
    registeredScopes: ['workflow.admin', 'workflow.execute', 'workflow.read'],
    humanAccessEnabled: true, machineAccessEnabled: true, delegatedAccessEnabled: true,
    status: 'active', freezeReady: true, version: 1,
  } });
  const forum = options.forumAudience ?? 'valid';
  if (forum !== 'missing') {
    await prisma.authAudience.create({ data: {
      audienceId: 'svc-forum', resourceService: 'svc-forum', scopeNamespace: 'forum',
      acceptedPrincipalTypes: forum === 'agent-rejected' ? ['service'] : ['agent'],
      registeredScopes: forum === 'scope-missing' ? ['forum.read'] : ['forum.admin', 'forum.moderate', 'forum.read', 'forum.write'],
      humanAccessEnabled: false, machineAccessEnabled: forum !== 'machine-disabled', delegatedAccessEnabled: false,
      status: forum === 'inactive' ? 'disabled' : 'active', freezeReady: true, version: 1,
    } });
  }
  for (const item of [
    { key: 'stock' as const, principalId: STOCK_PRINCIPAL, clientId: STOCK_CLIENT, publicId: STOCK_PUBLIC,
      agentId: 'agt_stock_agent', principalRef: 'agentcore:v1:principal:agt_stock_agent', clientRef: 'agentcore:v1:client:agt_stock_agent' },
    { key: 'cto' as const, principalId: CTO_PRINCIPAL, clientId: CTO_CLIENT, publicId: CTO_PUBLIC,
      agentId: 'agt_cto-agent', principalRef: 'agentcore:v1:principal:agt_cto-agent', clientRef: 'agentcore:v1:client:agt_cto-agent' },
  ]) {
    if (options.omit === item.key) continue;
    await prisma.machinePrincipal.create({ data: {
      id: item.principalId, principalType: 'agent', agentId: item.agentId,
      ownerUserId: null, displayName: `misleading-${item.key}`, externalRef: item.principalRef,
      status: options.inactivePrincipal === item.key ? 'disabled' : 'active',
    } });
    await prisma.machineClient.create({ data: {
      id: item.clientId, clientId: item.publicId,
      machinePrincipalId: options.wrongBinding === item.key
        ? (item.key === 'stock' ? CTO_PRINCIPAL : STOCK_PRINCIPAL) : item.principalId,
      secretHash: 'not-a-secret-test-hash', externalRef: item.clientRef,
      status: options.inactiveClient === item.key ? 'revoked' : 'active',
      allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'],
    } });
  }
  if (options.sentinel) {
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
      afterValue: { client_id: SENTINEL_PUBLIC, client_kind: 'machine', principal_id: SENTINEL_PRINCIPAL,
        principal_type: 'agent', human_audience_grants: [], machine_access_grants: { 'svc-workflow': ['workflow.read'] },
        delegation_grants: {}, status: 'active', version: 1 },
    } });
  }
}

function workflowOnlySnapshot(publicId: string, principalId: string) {
  return { client_id: publicId, client_kind: 'machine', principal_id: principalId,
    principal_type: 'agent', human_audience_grants: [], machine_access_grants: { 'svc-workflow': ['workflow.read'] },
    delegation_grants: {}, status: 'active', version: 1 };
}
function workflowForumSnapshot(publicId: string, principalId: string) {
  return { client_id: publicId, client_kind: 'machine', principal_id: principalId,
    principal_type: 'agent', human_audience_grants: [],
    machine_access_grants: { 'svc-forum': ['forum.read', 'forum.write'], 'svc-workflow': ['workflow.read'] },
    delegation_grants: {}, status: 'active', version: 2 };
}

async function installStageWEndState(which: 'stock' | 'cto'): Promise<void> {
  const clientId = which === 'stock' ? STOCK_CLIENT : CTO_CLIENT;
  const publicId = which === 'stock' ? STOCK_PUBLIC : CTO_PUBLIC;
  const principalId = which === 'stock' ? STOCK_PRINCIPAL : CTO_PRINCIPAL;
  await prisma.machineAccessGrant.create({ data: { machineClientId: clientId, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 } });
  await prisma.grantChangeAudit.create({ data: {
    migrationId: 'stage-w-exact-completed', sourceGitCommit: 'a'.repeat(40), operatorId: 'stage-w-conformance',
    approvalRef: 'https://github.com/mayf3/auth-service/issues/1#issuecomment-1', reason: 'exact Stage W end-state fixture',
    clientId: publicId, changeType: 'create', expectedGrantVersion: null, resultingGrantVersion: 1, beforeValue: undefined,
    afterValue: workflowOnlySnapshot(publicId, principalId),
  } });
}

async function installStageFEndState(which: 'stock' | 'cto'): Promise<void> {
  const clientId = which === 'stock' ? STOCK_CLIENT : CTO_CLIENT;
  const publicId = which === 'stock' ? STOCK_PUBLIC : CTO_PUBLIC;
  const principalId = which === 'stock' ? STOCK_PRINCIPAL : CTO_PRINCIPAL;
  await installStageWEndState(which);
  await prisma.machineAccessGrant.create({ data: { machineClientId: clientId, audienceId: 'svc-forum', scopes: ['forum.read', 'forum.write'], version: 2 } });
  await prisma.grantChangeAudit.create({ data: {
    migrationId: 'stage-f-exact-completed', sourceGitCommit: 'b'.repeat(40), operatorId: 'stage-f-conformance',
    approvalRef: 'https://github.com/mayf3/auth-service/issues/1#issuecomment-2', reason: 'exact Stage F end-state fixture',
    clientId: publicId, changeType: 'replace', expectedGrantVersion: 1, resultingGrantVersion: 2,
    beforeValue: workflowOnlySnapshot(publicId, principalId), afterValue: workflowForumSnapshot(publicId, principalId),
  } });
}

async function counts() {
  return {
    forumGrants: await prisma.machineAccessGrant.count({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] }, audienceId: 'svc-forum' } }),
    workflowGrants: await prisma.machineAccessGrant.count({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] }, audienceId: 'svc-workflow' } }),
    replaceAudits: await prisma.grantChangeAudit.count({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] }, changeType: 'replace' } }),
    totalAudits: await prisma.grantChangeAudit.count({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } } }),
  };
}

async function snapshotNonTarget() {
  return {
    principal: await prisma.machinePrincipal.findUniqueOrThrow({ where: { id: SENTINEL_PRINCIPAL } }),
    client: await prisma.machineClient.findUniqueOrThrow({ where: { id: SENTINEL_CLIENT } }),
    grant: await prisma.machineAccessGrant.findUniqueOrThrow({ where: { machineClientId_audienceId: { machineClientId: SENTINEL_CLIENT, audienceId: 'svc-workflow' } } }),
    audit: await prisma.grantChangeAudit.findFirstOrThrow({ where: { clientId: SENTINEL_PUBLIC } }),
  };
}

await test('static boundary excludes rollback, exports, legacy field access, and forbidden scopes', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(source, /allowedResources|allowedScopes/);
  assert.doesNotMatch(source, /workflow\.execute|workflow\.admin|forum\.admin|forum\.moderate/);
  assert.doesNotMatch(source, /changeType: 'revoke'/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /backfill-minimal-auth|grant-migration/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.match(source, /expectedGrantVersion: 1/);
  assert.match(source, /resultingGrantVersion: 2/);
  assert.match(source, /changeType: 'replace'/);
});

await test('static source binding pins the Stage F target and transport constants', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.match(source, /const AUDIENCE = 'svc-forum';/);
  assert.match(source, /const SCOPES = Object\.freeze\(\['forum\.read', 'forum\.write'\]\);/);
  assert.match(source, /const API_HOST = 'api\.github\.com';/);
  assert.match(source, /const API_PORT = 443;/);
  assert.match(source, /const DATABASE = 'auth_stage_f_conformance';/);
  assert.match(source, /pg_advisory_xact_lock\(813_947_202\)/);
  assert.match(source, /LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(source, /LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(source, /'User-Agent': 'mayf3-auth-service-stage-f-v1'/);
  assert.match(source, /FORUM_CONSUMER_COMMIT = '1cccdd54554c0bde13572273401f19f294334e46'/);
  assert.match(source, /BUNDLE_CONTRACT_VERSION = '1\.3\.0'/);
  assert.match(source, /authorized_stage !== 'STAGE_F'/);
  assert.doesNotMatch(source, /method: '(?:POST|PUT|DELETE|PATCH|HEAD|OPTIONS)'/);
});

await test('public client ID contract accepts exactly 24 unpadded base64url characters', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  const found = [...source.matchAll(/\/\^mc_\[A-Za-z0-9_-\]\{24\}\$\//g)].length;
  assert.equal(found, 2, 'production client ID guards');
  const clientId = /^mc_[A-Za-z0-9_-]{24}$/;
  for (const valid of [`mc_${'a'.repeat(24)}`, `mc_${'a'.repeat(23)}_`, `mc_${'a'.repeat(23)}-`]) {
    assert.match(valid, clientId);
  }
  for (const invalid of [`mc_${'a'.repeat(23)}`, `mc_${'a'.repeat(25)}`, `mc_${'a'.repeat(23)}+`, `xx_${'a'.repeat(24)}`]) {
    assert.doesNotMatch(invalid, clientId);
  }
});

await test('deterministic HTTP conformance accepts only the fixed valid state envelope for each Stage F kind', async () => {
  const validShas = { 'dsh-agent-core': 'f'.repeat(40), 'auth-service': '9'.repeat(40) };
  for (const [kind, requestPath, body] of [
    ['commit', `/repos/mayf3/dsh-agent-core/commits/main`, { sha: validShas['dsh-agent-core'] }],
    ['auth-commit', `/repos/mayf3/auth-service/commits/main`, { sha: validShas['auth-service'] }],
    ['compare', `/repos/mayf3/dsh-agent-core/compare/${'0'.repeat(40)}...${'1'.repeat(40)}`, { url: `https://api.github.com/repos/mayf3/dsh-agent-core/compare/${'0'.repeat(40)}...${'1'.repeat(40)}`, base_commit: { sha: '0'.repeat(40) }, merge_base_commit: { sha: '0'.repeat(40) }, behind_by: 0, status: 'ahead' }],
    ['auth-compare', `/repos/mayf3/auth-service/compare/${'0'.repeat(40)}...${'1'.repeat(40)}`, { url: `https://api.github.com/repos/mayf3/auth-service/compare/${'0'.repeat(40)}...${'1'.repeat(40)}`, base_commit: { sha: '0'.repeat(40) }, merge_base_commit: { sha: '0'.repeat(40) }, behind_by: 0, status: 'ahead' }],
    ['review', '/repos/mayf3/auth-service/pulls/11/reviews/12345', { id: 12345, html_url: 'https://github.com/mayf3/auth-service/pull/11#pullrequestreview-12345', pull_request_url: 'https://api.github.com/repos/mayf3/auth-service/pulls/11' }],
    ['comment', '/repos/mayf3/auth-service/issues/comments/99', { id: 99, html_url: 'https://github.com/mayf3/auth-service/pull/11#issuecomment-99', issue_url: 'https://api.github.com/repos/mayf3/auth-service/issues/11' }],
  ] as const) {
    const result = await invokeHttp(httpFixture(JSON.stringify(body), { kind, request_path: requestPath }));
    assert.equal(result.code, 0, `${kind}: ${result.stderr}`);
    assert.match(result.stdout, /"conformance_http":true/);
  }
});

await test('every non-200 HTTP status code and malformed envelope fails closed', async () => {
  for (const statusCode of [301, 400, 401, 403, 404, 429, 500, 503]) {
    const result = await invokeHttp(httpFixture('{"sha":"0000000000000000000000000000000000000000"}', { status_code: statusCode }));
    assert.notEqual(result.code, 0, `status ${statusCode} must fail`);
  }
  const wrongSha = await invokeHttp(httpFixture(JSON.stringify({ sha: 'not-hex' })));
  assert.notEqual(wrongSha.code, 0);
  const wrongKindPath = await invokeHttp(httpFixture(JSON.stringify({ sha: '0'.repeat(40) }), { kind: 'commit', request_path: '/repos/mayf3/auth-service/commits/main' }));
  assert.notEqual(wrongKindPath.code, 0, 'commit kind must be dsh-agent-core only');
  const duplicateMember = await invokeHttp((() => {
    const body = duplicateFirstMember({ sha: '0'.repeat(40) });
    const buffer = Buffer.from(body);
    return {
      schema_version: 1, kind: 'commit', request_path: '/repos/mayf3/dsh-agent-core/commits/main',
      tls_authorized: true, elapsed_ms: 1, status_code: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': String(buffer.length) },
      chunks_base64: [buffer.toString('base64')], terminal: 'end', error_code: null,
    };
  })());
  assert.notEqual(duplicateMember.code, 0, 'duplicate JSON member must fail');
  const tlsFailure = await invokeHttp(httpFixture('{"sha":"0000000000000000000000000000000000000000"}', { tls_authorized: false }));
  assert.notEqual(tlsFailure.code, 0);
});

await test('two Stage W end-state clients produce exactly two forum grants and two schema-valid replace audits', async () => {
  await reset(); await seed({ sentinel: true });
  await installStageWEndState('stock'); await installStageWEndState('cto');
  const before = await snapshotNonTarget();
  const beforeWorkflowGrants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] }, audienceId: 'svc-workflow' }, orderBy: { machineClientId: 'asc' } });
  const result = await invoke();
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /"outcome":"replace"/);
  assert.deepEqual(await counts(), { forumGrants: 2, workflowGrants: 2, replaceAudits: 2, totalAudits: 4 });
  const grants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
  assert.deepEqual(grants.map(({ audienceId, scopes, version }) => ({ audienceId, scopes, version })), [
    { audienceId: 'svc-forum', scopes: ['forum.read', 'forum.write'], version: 2 },
    { audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 },
    { audienceId: 'svc-forum', scopes: ['forum.read', 'forum.write'], version: 2 },
    { audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 },
  ]);
  assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] }, audienceId: 'svc-workflow' }, orderBy: { machineClientId: 'asc' } }), beforeWorkflowGrants, 'workflow grants must be byte-preserved');
  const audits = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] }, changeType: 'replace' }, orderBy: { clientId: 'asc' } });
  const schema = JSON.parse(readFileSync(path.join(ROOT, 'contract-bundles/minimal-auth-v1/schemas/grants.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/grantChangeAudit` });
  for (const audit of audits) {
    const envelope = {
      change_id: audit.id, migration_id: audit.migrationId, source_git_commit: audit.sourceGitCommit,
      operator_id: audit.operatorId, approval_ref: audit.approvalRef, reason: audit.reason,
      client_id: audit.clientId, change_type: audit.changeType,
      expected_grant_version: audit.expectedGrantVersion, resulting_grant_version: audit.resultingGrantVersion,
      before_value: audit.beforeValue, after_value: audit.afterValue, timestamp: audit.timestamp.toISOString(),
    };
    assert.deepEqual(Object.keys(envelope).sort(), [
      'after_value', 'approval_ref', 'before_value', 'change_id', 'change_type', 'client_id',
      'expected_grant_version', 'migration_id', 'operator_id', 'reason',
      'resulting_grant_version', 'source_git_commit', 'timestamp',
    ]);
    assert.equal(validate(envelope), true, JSON.stringify(validate.errors));
    assert.equal(audit.changeType, 'replace'); assert.equal(audit.expectedGrantVersion, 1);
    assert.equal(audit.resultingGrantVersion, 2);
    const principalId = audit.clientId === STOCK_PUBLIC ? STOCK_PRINCIPAL : CTO_PRINCIPAL;
    assert.deepEqual(audit.beforeValue, workflowOnlySnapshot(audit.clientId, principalId));
    assert.deepEqual(audit.afterValue, workflowForumSnapshot(audit.clientId, principalId));
    assert.deepEqual(Object.keys(audit.afterValue as object).sort(), [
      'client_id', 'client_kind', 'delegation_grants', 'human_audience_grants',
      'machine_access_grants', 'principal_id', 'principal_type', 'status', 'version',
    ]);
  }
  assert.deepEqual(await snapshotNonTarget(), before);
  const targetLegacy = await prisma.machineClient.findMany({ where: { id: { in: [STOCK_CLIENT, CTO_CLIENT] } }, select: { id: true, allowedResources: true, allowedScopes: true }, orderBy: { id: 'asc' } });
  assert.deepEqual(targetLegacy.map(({ allowedResources, allowedScopes }) => ({ allowedResources, allowedScopes })), [
    { allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'] },
    { allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'] },
  ]);
});

await test('exact rerun of the Stage F end-state is a byte-stable no-op', async () => {
  const beforeGrants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
  const beforeAudits = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: [{ clientId: 'asc' }, { timestamp: 'asc' }] });
  const result = await invoke();
  assert.equal(result.code, 0, result.stderr); assert.match(result.stdout, /"outcome":"noop"/);
  assert.equal(result.stdout.includes('"grants_created":2'), false, 'noop must report zero writes');
  assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }), beforeGrants);
  assert.deepEqual(await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: [{ clientId: 'asc' }, { timestamp: 'asc' }] }), beforeAudits);
});

await test('pristine Stage W-less state conflicts with zero writes', async () => {
  await reset(); await seed();
  const result = await invoke();
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /conflicts with Stage F precondition/);
  assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 0, replaceAudits: 0, totalAudits: 0 });
});

for (const completed of ['stock', 'cto'] as const) {
  await test(`mixed partial state: ${completed} at Stage W end-state and ${completed === 'stock' ? 'cto' : 'stock'} pristine conflicts with zero writes`, async () => {
    await reset(); await seed();
    await installStageWEndState(completed);
    const pristineClient = completed === 'stock' ? CTO_CLIENT : STOCK_CLIENT;
    const pristinePublic = completed === 'stock' ? CTO_PUBLIC : STOCK_PUBLIC;
    const beforeGrants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
    const beforeAudits = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } });
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /conflicts with Stage F precondition|mixed Stage F states/);
    assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }), beforeGrants);
    assert.deepEqual(await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } }), beforeAudits);
    assert.equal(await prisma.machineAccessGrant.count({ where: { machineClientId: pristineClient } }), 0, 'pristine client must stay grant-free');
    assert.equal(await prisma.grantChangeAudit.count({ where: { clientId: pristinePublic } }), 0, 'pristine client must stay audit-free');
  });
  await test(`mixed partial state: ${completed} already at Stage F end-state and ${completed === 'stock' ? 'cto' : 'stock'} at Stage W end-state conflicts with zero writes`, async () => {
    await reset(); await seed();
    await installStageFEndState(completed);
    await installStageWEndState(completed === 'stock' ? 'cto' : 'stock');
    const beforeGrants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /mixed Stage F states/);
    assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }), beforeGrants);
  });
}

for (const [name, options] of [
  ['stock missing', { omit: 'stock' }], ['cto missing', { omit: 'cto' }],
  ['stock inactive client', { inactiveClient: 'stock' }], ['cto inactive principal', { inactivePrincipal: 'cto' }],
  ['forum audience missing', { forumAudience: 'missing' }], ['forum audience inactive', { forumAudience: 'inactive' }],
  ['forum audience machine disabled', { forumAudience: 'machine-disabled' }],
  ['forum audience rejects agent', { forumAudience: 'agent-rejected' }],
  ['forum.write unregistered', { forumAudience: 'scope-missing' }],
] as const) {
  await test(`${name} fails closed with zero target writes`, async () => {
    await reset(); await seed(options as any);
    if (options.omit !== 'stock') await installStageWEndState('stock');
    if (options.omit !== 'cto') await installStageWEndState('cto');
    const result = await invoke();
    assert.notEqual(result.code, 0); assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: options.omit === 'stock' || options.omit === 'cto' ? 1 : 2, replaceAudits: 0, totalAudits: options.omit === 'stock' || options.omit === 'cto' ? 1 : 2 });
  });
}

await test('duplicate-corruption Client external_ref fails closed', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  await prisma.$executeRawUnsafe('DROP INDEX machine_clients_external_ref_key');
  await prisma.$executeRawUnsafe(`INSERT INTO machine_clients
    (id, client_id, machine_principal_id, secret_hash, external_ref, status, allowed_resources, allowed_scopes, created_at, updated_at)
    VALUES ('20000000-0000-4000-8000-000000000099', 'mc_xxxxxxxxxxxxxxxxxxxxxxxx',
      '${STOCK_PRINCIPAL}', 'duplicate', 'agentcore:v1:client:agt_stock_agent', 'active', '{}', '{}', now(), now())`);
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 2, replaceAudits: 0, totalAudits: 2 });
});

await test('duplicate-corruption Audience fails closed', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  await prisma.$executeRawUnsafe('ALTER TABLE auth_audiences DROP CONSTRAINT auth_audiences_pkey CASCADE');
  await prisma.$executeRawUnsafe('INSERT INTO auth_audiences SELECT * FROM auth_audiences WHERE audience_id=\'svc-forum\'');
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 2, replaceAudits: 0, totalAudits: 2 });
});

await test('wrong client-principal binding fails closed', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  await prisma.machineClient.update({ where: { id: CTO_CLIENT }, data: { machinePrincipalId: STOCK_PRINCIPAL } });
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 2, replaceAudits: 0, totalAudits: 2 });
});

for (const [name, mutate] of [
  ['service principal type', async () => prisma.machinePrincipal.update({ where: { id: STOCK_PRINCIPAL }, data: { principalType: 'service', agentId: null } })],
  ['wrong agent ID', async () => prisma.machinePrincipal.update({ where: { id: STOCK_PRINCIPAL }, data: { agentId: 'agt_wrong' } })],
  ['wrong principal external ref', async () => prisma.machinePrincipal.update({ where: { id: STOCK_PRINCIPAL }, data: { externalRef: 'agentcore:v1:principal:wrong' } })],
  ['wrong client external ref', async () => prisma.machineClient.update({ where: { id: STOCK_CLIENT }, data: { externalRef: 'agentcore:v1:client:wrong' } })],
] as const) {
  await test(`${name} fails closed`, async () => {
    await reset(); await seed();
    await installStageWEndState('stock'); await installStageWEndState('cto');
    await mutate();
    const result = await invoke(); assert.notEqual(result.code, 0);
    assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 2, replaceAudits: 0, totalAudits: 2 });
  });
}

for (const [name, mutate] of [
  ['extra forbidden existing scope on workflow grant', async () => prisma.machineAccessGrant.update({ where: { machineClientId_audienceId: { machineClientId: STOCK_CLIENT, audienceId: 'svc-workflow' } }, data: { scopes: ['workflow.execute', 'workflow.read'] } })],
  ['wrong existing workflow grant version', async () => prisma.machineAccessGrant.update({ where: { machineClientId_audienceId: { machineClientId: STOCK_CLIENT, audienceId: 'svc-workflow' } }, data: { version: 3 } })],
  ['pre-existing forum grant row', async () => prisma.machineAccessGrant.create({ data: { machineClientId: STOCK_CLIENT, audienceId: 'svc-forum', scopes: ['forum.read'], version: 1 } })],
] as const) {
  await test(`precondition drift (${name}) conflicts without repair`, async () => {
    await reset(); await seed();
    await installStageWEndState('stock'); await installStageWEndState('cto');
    await mutate();
    const before = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
    const result = await invoke(); assert.notEqual(result.code, 0);
    assert.match(result.stderr, /conflicts with Stage F precondition/);
    assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }), before);
    assert.equal(await prisma.grantChangeAudit.count({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] }, changeType: 'replace' } }), 0);
  });
}

await test('audit-only drift conflicts without creating any Grant', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  await prisma.grantChangeAudit.create({ data: {
    migrationId: 'drift', sourceGitCommit: 'd'.repeat(40), operatorId: 'other', approvalRef: 'other',
    reason: 'drift', clientId: STOCK_PUBLIC, changeType: 'replace', expectedGrantVersion: 1,
    resultingGrantVersion: 2, beforeValue: workflowOnlySnapshot(STOCK_PUBLIC, STOCK_PRINCIPAL),
    afterValue: workflowForumSnapshot(STOCK_PUBLIC, STOCK_PRINCIPAL),
  } });
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.equal(await prisma.machineAccessGrant.count({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] }, audienceId: 'svc-forum' } }), 0);
  assert.equal(await prisma.grantChangeAudit.count({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } } }), 3);
});

await test('wrong Stage W create-audit snapshot conflicts', async () => {
  await reset(); await seed();
  // stock carries a workflow grant whose create audit advertises an inflated
  // snapshot (audit-only drift); the audit immutability trigger forbids UPDATE,
  // so the drifted row is inserted directly instead of installed and edited.
  await prisma.machineAccessGrant.create({ data: { machineClientId: STOCK_CLIENT, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 } });
  await prisma.grantChangeAudit.create({ data: {
    migrationId: 'stage-w-drifted', sourceGitCommit: 'a'.repeat(40), operatorId: 'stage-w-conformance',
    approvalRef: 'https://github.com/mayf3/auth-service/issues/1#issuecomment-1', reason: 'drifted snapshot fixture',
    clientId: STOCK_PUBLIC, changeType: 'create', expectedGrantVersion: null, resultingGrantVersion: 1, beforeValue: undefined,
    afterValue: { ...workflowOnlySnapshot(STOCK_PUBLIC, STOCK_PRINCIPAL), machine_access_grants: { 'svc-workflow': ['workflow.execute', 'workflow.read'] } },
  } });
  await installStageWEndState('cto');
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.equal(await prisma.machineAccessGrant.count({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] }, audienceId: 'svc-forum' } }), 0);
});

await test('a concurrent non-cooperating Grant writer commits first and Stage F conflicts', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.machineAccessGrant.create({ data: { machineClientId: STOCK_CLIENT, audienceId: 'svc-forum', scopes: ['forum.read'], version: 9 } });
    pending = invoke();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  const result = await pending!;
  assert.notEqual(result.code, 0);
  assert.equal(await prisma.machineAccessGrant.count({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } } }), 3);
  assert.equal(await prisma.grantChangeAudit.count({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] }, changeType: 'replace' } }), 0);
});

await test('a concurrent non-cooperating audit writer commits first and Stage F conflicts', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.grantChangeAudit.create({ data: {
      migrationId: 'concurrent-audit', sourceGitCommit: 'c'.repeat(40), operatorId: 'other',
      approvalRef: 'other', reason: 'concurrent writer', clientId: STOCK_PUBLIC, changeType: 'replace',
      expectedGrantVersion: 1, resultingGrantVersion: 2,
      beforeValue: workflowOnlySnapshot(STOCK_PUBLIC, STOCK_PRINCIPAL),
      afterValue: workflowForumSnapshot(STOCK_PUBLIC, STOCK_PRINCIPAL),
    } });
    pending = invoke();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  const result = await pending!;
  assert.notEqual(result.code, 0);
  assert.equal(await prisma.machineAccessGrant.count({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] }, audienceId: 'svc-forum' } }), 0);
  assert.equal(await prisma.grantChangeAudit.count({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } } }), 3);
});

async function installFailureTrigger(table: 'machine_access_grants' | 'grant_change_audits', trigger: string, condition: string): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION stage_f_fail_second() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF ${condition} THEN RAISE EXCEPTION 'injected Stage F failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON ${table}
    FOR EACH ROW EXECUTE FUNCTION stage_f_fail_second()`);
}

await test('second Grant failure rolls back both forum Grants and both replace audits', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  await installFailureTrigger('machine_access_grants', 'stage_f_fail_grant', `NEW.machine_client_id = '${CTO_CLIENT}'::uuid AND NEW.audience_id = 'svc-forum'`);
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 2, replaceAudits: 0, totalAudits: 2 });
});

await test('second audit failure rolls back both forum Grants and both replace audits', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  await installFailureTrigger('grant_change_audits', 'stage_f_fail_audit', `NEW.client_id = '${CTO_PUBLIC}' AND NEW.change_type = 'replace'`);
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 2, replaceAudits: 0, totalAudits: 2 });
});

await test('descriptor rejects malformed, duplicate, and wrong-container coordinates', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
  const malformed = await invoke({ ...descriptor, database: 'production' });
  assert.notEqual(malformed.code, 0);
  const duplicate = await new Promise<{ code: number | null }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'stage-f-test', '{"schema_version":1,"schema_version":1}', NODE, SCRIPT,
    ], {
      cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.on('error', reject); child.on('close', (code) => resolve({ code }));
  });
  assert.notEqual(duplicate.code, 0);
  const wrong = await invoke({ ...descriptor, nonce: '0'.repeat(64) }); assert.notEqual(wrong.code, 0);
  const stdin = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(NODE, ['--import', 'tsx', SCRIPT, '--conformance-apply', '--descriptor-fd', '0'], {
      cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    child.on('error', reject); child.on('close', resolve); child.stdin.end(JSON.stringify(descriptor));
  });
  assert.notEqual(stdin, 0);
  const temporary = mkdtempSync(path.join(tmpdir(), 'stage-f-descriptor-'));
  const regularPath = path.join(temporary, 'descriptor.json'); writeFileSync(regularPath, JSON.stringify(descriptor));
  try {
    const regular = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('/bin/bash', [
        '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
        'stage-f-test', regularPath, NODE, SCRIPT,
      ], { cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' }, stdio: 'ignore' });
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
  assert.notEqual(socketRejected.code, 0, 'a socket FD must be rejected');
  assert.match(socketRejected.stderr, /must be a FIFO/);
});

await test('CLI and environment seam rejects unknown flags, DATABASE_URL, and mode cross-contamination', async () => {
  const evidence = 'a'.repeat(40);
  const cases: Array<[string, string[], Record<string, string>]> = [
    ['unknown flag in conformance-apply mode', ['--conformance-apply', '--bogus-flag'], {}],
    ['unknown flag in conformance-http mode', ['--conformance-http', '--unknown'], {}],
    ['conformance-apply with DATABASE_URL', ['--conformance-apply'], { DATABASE_URL: 'postgresql://refused' }],
    ['conformance-http with DATABASE_URL', ['--conformance-http'], { DATABASE_URL: 'postgresql://refused' }],
    ['conformance-http with evidence arguments', ['--conformance-http', '--evidence-commit', evidence, '--evidence-path', 'evidence/manifest.json'], {}],
    ['conformance-apply with evidence arguments', ['--conformance-apply', '--evidence-commit', evidence, '--evidence-path', 'evidence/manifest.json'], {}],
    ['conformance-apply with fixture argument', ['--conformance-apply', '--fixture-fd', '3'], {}],
    ['apply mode with conformance-http', ['--apply', '--conformance-http'], {}],
    ['apply mode with conformance-apply', ['--apply', '--conformance-apply'], {}],
    ['validate-evidence with descriptor-fd', ['--validate-evidence', '--evidence-commit', evidence, '--evidence-path', 'evidence/manifest.json', '--descriptor-fd', '3'], {}],
    ['descriptor-fd without a value', ['--conformance-apply', '--descriptor-fd'], {}],
    ['duplicate descriptor-fd', ['--conformance-apply', '--descriptor-fd', '3', '--descriptor-fd', '4'], {}],
  ];
  for (const [label, args, environment] of cases) {
    const result = await invokeArgs(args, environment);
    assert.notEqual(result.code, 0, `${label} must be rejected: ${result.stdout}`);
  }
});

await test('read-only plan mode reports the exact Stage F precondition without writing', async () => {
  await reset(); await seed();
  await installStageWEndState('stock'); await installStageWEndState('cto');
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
  assert.match(result.stdout, /"outcome":"replace"/);
  assert.deepEqual(await counts(), { forumGrants: 0, workflowGrants: 2, replaceAudits: 0, totalAudits: 2 });
});

await test('privilege-changing Docker capabilities are rejected before engine access', async () => {
  const docker = '/usr/local/bin/docker';
  const nonce = createHash('sha256').update(randomUUID()).digest('hex');
  const labelHash = createHash('sha256').update(nonce).digest('hex');
  const name = `auth-stage-f-conformance-cap-${nonce.slice(0, 12)}`;
  const id = execFileSync(docker, [
    'run', '-d', '--rm', '--name', name,
    '--label', `com.mayf3.auth.stage-f-conformance=sha256:${labelHash}`,
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=128m',
    '--cap-add', 'SYS_ADMIN', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=auth_stage_f_conformance', '-p', '127.0.0.1::5432',
    'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777',
    '-c', `stage_f.conformance_nonce=${nonce}`,
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
