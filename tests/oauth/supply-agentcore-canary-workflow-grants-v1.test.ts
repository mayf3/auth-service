import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
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
const SCRIPT = path.join(ROOT, 'scripts/supply-agentcore-canary-workflow-grants-v1.ts');
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
      'stage-w-test', JSON.stringify(extraDescriptor), NODE, SCRIPT,
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

async function invokeHttp(fixture: unknown) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'stage-w-http-fifo-'));
    const fifo = path.join(temporary, 'fixture.fifo'); execFileSync('/usr/bin/mkfifo', [fifo]);
    const child = spawn('/bin/bash', [
      '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-http --fixture-fd 3',
      'stage-w-http-test', fifo, NODE, SCRIPT,
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
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS stage_w_fail_grant ON machine_access_grants');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS stage_w_fail_audit ON grant_change_audits');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS stage_w_fail_second()');
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
  audience?: 'valid' | 'missing' | 'inactive' | 'machine-disabled' | 'agent-rejected' | 'scope-missing';
  sentinel?: boolean;
} = {}): Promise<void> {
  const audience = options.audience ?? 'valid';
  if (audience !== 'missing') {
    await prisma.authAudience.create({ data: {
      audienceId: 'svc-workflow', resourceService: 'svc-workflow', scopeNamespace: 'workflow',
      acceptedPrincipalTypes: audience === 'agent-rejected' ? ['service'] : ['agent', 'service'],
      registeredScopes: audience === 'scope-missing' ? ['workflow.execute'] : ['workflow.admin', 'workflow.execute', 'workflow.read'],
      humanAccessEnabled: true, machineAccessEnabled: audience !== 'machine-disabled', delegatedAccessEnabled: true,
      status: audience === 'inactive' ? 'disabled' : 'active', freezeReady: true, version: 1,
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
      machineClientId: SENTINEL_CLIENT, audienceId: 'svc-workflow', scopes: ['workflow.execute'], version: 7,
    } });
  }
}

async function counts() {
  return {
    grants: await prisma.machineAccessGrant.count({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } } }),
    audits: await prisma.grantChangeAudit.count({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } } }),
  };
}

async function snapshotNonTarget() {
  return {
    principal: await prisma.machinePrincipal.findUniqueOrThrow({ where: { id: SENTINEL_PRINCIPAL } }),
    client: await prisma.machineClient.findUniqueOrThrow({ where: { id: SENTINEL_CLIENT } }),
    grant: await prisma.machineAccessGrant.findUniqueOrThrow({ where: { machineClientId_audienceId: { machineClientId: SENTINEL_CLIENT, audienceId: 'svc-workflow' } } }),
  };
}

await test('static boundary excludes Stage F, rollback, exports, and legacy field access', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(source, /allowedResources|allowedScopes/);
  assert.doesNotMatch(source, /svc-forum|forum\.|workflow\.execute|workflow\.admin/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /backfill-minimal-auth|grant-migration/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.match(source, /expectedGrantVersion:\s*null/);
  assert.match(source, /resultingGrantVersion:\s*1/);
});

await test('deterministic HTTP conformance accepts only the fixed valid state envelope', async () => {
  const validBody = JSON.stringify({ sha: 'a'.repeat(40) });
  const base = 'a'.repeat(40); const head = 'b'.repeat(40);
  const validFixtures = [
    httpFixture(validBody),
    httpFixture(validBody, { elapsed_ms: 29_999 }),
    httpFixture(JSON.stringify({ url: `https://api.github.com/repos/mayf3/dsh-agent-core/compare/${base}...${head}`, base_commit: { sha: base }, merge_base_commit: { sha: base }, behind_by: 0, status: 'ahead' }),
      { kind: 'compare', request_path: `/repos/mayf3/dsh-agent-core/compare/${base}...${head}` }),
    httpFixture(JSON.stringify({ type: 'file', path: 'evidence/manifest.json', url: `https://api.github.com/repos/mayf3/dsh-agent-core/contents/evidence/manifest.json?ref=${base}`, encoding: 'base64', size: 2, content: 'e30=' }),
      { kind: 'contents-manifest', request_path: `/repos/mayf3/dsh-agent-core/contents/evidence/manifest.json?ref=${base}` }),
    httpFixture(JSON.stringify({ id: 7, html_url: 'https://github.com/mayf3/auth-service/pull/3#pullrequestreview-7', pull_request_url: 'https://api.github.com/repos/mayf3/auth-service/pulls/3' }),
      { kind: 'review', request_path: '/repos/mayf3/auth-service/pulls/3/reviews/7' }),
    httpFixture(JSON.stringify({ id: 9, html_url: 'https://github.com/mayf3/auth-service/issues/4#issuecomment-9', issue_url: 'https://api.github.com/repos/mayf3/auth-service/issues/4' }),
      { kind: 'comment', request_path: '/repos/mayf3/auth-service/issues/comments/9' }),
  ];
  for (const fixture of validFixtures) {
    const valid = await invokeHttp(fixture);
    assert.equal(valid.code, 0, valid.stderr);
    assert.match(valid.stdout, /"host":"api.github.com","port":443/);
  }
  const compareFields = { url: `https://api.github.com/repos/mayf3/dsh-agent-core/compare/${base}...${head}`,
    base_commit: { sha: base }, merge_base_commit: { sha: base }, behind_by: 0, status: 'ahead' };
  for (const [kind, requestPath, body] of [
    ['commit', '/repos/mayf3/dsh-agent-core/commits/main', paddedJson({ sha: base }, 2 * 1024 * 1024)],
    ['compare', `/repos/mayf3/dsh-agent-core/compare/${base}...${head}`, paddedJson(compareFields, 16 * 1024 * 1024)],
  ] as const) {
    const bytes = Buffer.from(body); const midpoint = Math.floor(bytes.length / 2);
    const fixture = httpFixture(body, { kind, request_path: requestPath,
      chunks_base64: [bytes.subarray(0, midpoint).toString('base64'), bytes.subarray(midpoint).toString('base64')] });
    const valid = await invokeHttp(fixture); assert.equal(valid.code, 0, valid.stderr);
  }
  for (const [kind, requestPath, body] of [
    ['commit', '/repos/mayf3/dsh-agent-core/commits/main', paddedJson({ sha: base }, 2 * 1024 * 1024 + 1)],
    ['compare', `/repos/mayf3/dsh-agent-core/compare/${base}...${head}`, paddedJson(compareFields, 16 * 1024 * 1024 + 1)],
  ] as const) {
    const refused = await invokeHttp(httpFixture(body, { kind, request_path: requestPath }));
    assert.notEqual(refused.code, 0);
  }
  for (const fixture of [
    httpFixture(validBody, { status_code: 302 }),
    httpFixture(validBody, { elapsed_ms: 10_000, terminal: 'timeout', error_code: 'IDLE_TIMEOUT' }),
    httpFixture(validBody, { elapsed_ms: 30_000 }),
    httpFixture(validBody, { tls_authorized: false, terminal: 'tls_error', error_code: 'CERT' }),
    httpFixture(validBody, { terminal: 'premature_close', error_code: 'CLOSE' }),
    httpFixture(validBody, { request_path: '/repos/other/repository/commits/main' }),
    httpFixture('{"sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}'),
    httpFixture(JSON.stringify({ sha: 'BAD' })),
    httpFixture(validBody, { headers: { 'content-type': 'text/plain', 'content-length': String(Buffer.byteLength(validBody)) } }),
  ]) {
    const result = await invokeHttp(fixture);
    assert.notEqual(result.code, 0, `unexpected HTTP fixture success: ${result.stdout}`);
  }
});

await test('two valid identities create exactly two grants and two schema-valid audits', async () => {
  await reset(); await seed({ sentinel: true });
  const before = await snapshotNonTarget();
  const result = await invoke();
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(await counts(), { grants: 2, audits: 2 });
  const grants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: { machineClientId: 'asc' } });
  assert.deepEqual(grants.map(({ audienceId, scopes, version }) => ({ audienceId, scopes, version })), [
    { audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 },
    { audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 },
  ]);
  const audits = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } });
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
    assert.equal(audit.changeType, 'create'); assert.equal(audit.expectedGrantVersion, null);
    assert.equal(audit.resultingGrantVersion, 1); assert.equal(audit.beforeValue, null);
    assert.deepEqual(Object.keys(audit.afterValue as object).sort(), [
      'client_id', 'client_kind', 'delegation_grants', 'human_audience_grants',
      'machine_access_grants', 'principal_id', 'principal_type', 'status', 'version',
    ]);
    assert.deepEqual((audit.afterValue as any).machine_access_grants, { 'svc-workflow': ['workflow.read'] });
  }
  assert.deepEqual(await snapshotNonTarget(), before);
  const targetLegacy = await prisma.machineClient.findMany({ where: { id: { in: [STOCK_CLIENT, CTO_CLIENT] } }, select: { id: true, allowedResources: true, allowedScopes: true }, orderBy: { id: 'asc' } });
  assert.deepEqual(targetLegacy.map(({ allowedResources, allowedScopes }) => ({ allowedResources, allowedScopes })), [
    { allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'] },
    { allowedResources: ['legacy.must.not.be.read'], allowedScopes: ['legacy.must.not.be.read'] },
  ]);
});

await test('exact rerun is a byte-stable no-op', async () => {
  const beforeGrants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: { machineClientId: 'asc' } });
  const beforeAudits = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } });
  const result = await invoke();
  assert.equal(result.code, 0, result.stderr); assert.match(result.stdout, /"outcome":"noop"/);
  assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: { machineClientId: 'asc' } }), beforeGrants);
  assert.deepEqual(await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } }), beforeAudits);
});

for (const [name, options] of [
  ['stock missing', { omit: 'stock' }], ['cto missing', { omit: 'cto' }],
  ['stock inactive client', { inactiveClient: 'stock' }], ['cto inactive principal', { inactivePrincipal: 'cto' }],
  ['audience missing', { audience: 'missing' }], ['audience inactive', { audience: 'inactive' }],
  ['audience machine disabled', { audience: 'machine-disabled' }], ['audience rejects agent', { audience: 'agent-rejected' }],
  ['workflow.read unregistered', { audience: 'scope-missing' }],
] as const) {
  await test(`${name} fails closed with zero target writes`, async () => {
    await reset(); await seed(options as any);
    const result = await invoke();
    assert.notEqual(result.code, 0); assert.deepEqual(await counts(), { grants: 0, audits: 0 });
  });
}

await test('duplicate-corruption Client external_ref fails closed', async () => {
  await reset(); await seed();
  await prisma.$executeRawUnsafe('DROP INDEX machine_clients_external_ref_key');
  await prisma.$executeRawUnsafe(`INSERT INTO machine_clients
    (id, client_id, machine_principal_id, secret_hash, external_ref, status, allowed_resources, allowed_scopes, created_at, updated_at)
    VALUES ('20000000-0000-4000-8000-000000000099', 'mc_xxxxxxxxxxxxxxxxxxxxxxxx',
      '${STOCK_PRINCIPAL}', 'duplicate', 'agentcore:v1:client:agt_stock_agent', 'active', '{}', '{}', now(), now())`);
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 0, audits: 0 });
});

await test('duplicate-corruption Audience fails closed', async () => {
  await reset(); await seed();
  await prisma.$executeRawUnsafe('ALTER TABLE auth_audiences DROP CONSTRAINT auth_audiences_pkey CASCADE');
  await prisma.$executeRawUnsafe(`INSERT INTO auth_audiences SELECT * FROM auth_audiences WHERE audience_id='svc-workflow'`);
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 0, audits: 0 });
});

await test('wrong client-principal binding fails closed', async () => {
  await reset(); await seed();
  await prisma.machineClient.update({ where: { id: CTO_CLIENT }, data: { machinePrincipalId: STOCK_PRINCIPAL } });
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 0, audits: 0 });
});

for (const [name, mutate] of [
  ['service principal type', async () => prisma.machinePrincipal.update({ where: { id: STOCK_PRINCIPAL }, data: { principalType: 'service', agentId: null } })],
  ['wrong agent ID', async () => prisma.machinePrincipal.update({ where: { id: STOCK_PRINCIPAL }, data: { agentId: 'agt_wrong' } })],
  ['wrong principal external ref', async () => prisma.machinePrincipal.update({ where: { id: STOCK_PRINCIPAL }, data: { externalRef: 'agentcore:v1:principal:wrong' } })],
  ['wrong client external ref', async () => prisma.machineClient.update({ where: { id: STOCK_CLIENT }, data: { externalRef: 'agentcore:v1:client:wrong' } })],
] as const) {
  await test(`${name} fails closed`, async () => {
    await reset(); await seed(); await mutate();
    const result = await invoke(); assert.notEqual(result.code, 0);
    assert.deepEqual(await counts(), { grants: 0, audits: 0 });
  });
}

await test('forbidden or conflicting existing scope is never unioned or repaired', async () => {
  await reset(); await seed();
  await prisma.machineAccessGrant.create({ data: { machineClientId: STOCK_CLIENT, audienceId: 'svc-workflow', scopes: ['workflow.execute'], version: 1 } });
  const before = await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] });
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await prisma.machineAccessGrant.findMany({ orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }] }), before);
  assert.equal(await prisma.grantChangeAudit.count(), 0);
});

await test('wrong existing Grant version conflicts without repair', async () => {
  await reset(); await seed();
  await prisma.machineAccessGrant.create({ data: { machineClientId: STOCK_CLIENT, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 2 } });
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 1, audits: 0 });
});

await test('audit-only drift conflicts without creating any Grant', async () => {
  await reset(); await seed();
  await prisma.grantChangeAudit.create({ data: {
    migrationId: 'drift', sourceGitCommit: 'd'.repeat(40), operatorId: 'other', approvalRef: 'other',
    reason: 'drift', clientId: STOCK_PUBLIC, changeType: 'create', expectedGrantVersion: null,
    resultingGrantVersion: 2, beforeValue: undefined,
    afterValue: { client_id: STOCK_PUBLIC, client_kind: 'machine', principal_id: STOCK_PRINCIPAL,
      principal_type: 'agent', human_audience_grants: [], machine_access_grants: {},
      delegation_grants: {}, status: 'active', version: 2 },
  } });
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 0, audits: 1 });
});

await test('a concurrent non-cooperating Grant writer commits first and Stage W conflicts', async () => {
  await reset(); await seed();
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.machineAccessGrant.create({ data: { machineClientId: STOCK_CLIENT, audienceId: 'svc-workflow', scopes: ['workflow.execute'], version: 9 } });
    pending = invoke();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  const result = await pending!;
  assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 1, audits: 0 });
});

await test('a concurrent non-cooperating audit writer commits first and Stage W conflicts', async () => {
  await reset(); await seed();
  const after = { client_id: STOCK_PUBLIC, client_kind: 'machine', principal_id: STOCK_PRINCIPAL,
    principal_type: 'agent', human_audience_grants: [], machine_access_grants: {},
    delegation_grants: {}, status: 'active', version: 1 };
  let pending: Promise<{ code: number | null; stdout: string; stderr: string }> | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.grantChangeAudit.create({ data: {
      migrationId: 'concurrent-audit', sourceGitCommit: 'c'.repeat(40), operatorId: 'other',
      approvalRef: 'other', reason: 'concurrent writer', clientId: STOCK_PUBLIC, changeType: 'create',
      expectedGrantVersion: null, resultingGrantVersion: 1, beforeValue: undefined, afterValue: after,
    } });
    pending = invoke();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  const result = await pending!;
  assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 0, audits: 1 });
});

async function installFailureTrigger(table: 'machine_access_grants' | 'grant_change_audits', trigger: string, condition: string): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION stage_w_fail_second() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF ${condition} THEN RAISE EXCEPTION 'injected Stage W failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON ${table}
    FOR EACH ROW EXECUTE FUNCTION stage_w_fail_second()`);
}

await test('second Grant failure rolls back both Grants and both audits', async () => {
  await reset(); await seed();
  await installFailureTrigger('machine_access_grants', 'stage_w_fail_grant', `NEW.machine_client_id = '${CTO_CLIENT}'::uuid`);
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 0, audits: 0 });
});

await test('second audit failure rolls back both Grants and both audits', async () => {
  await reset(); await seed();
  await installFailureTrigger('grant_change_audits', 'stage_w_fail_audit', `NEW.client_id = '${CTO_PUBLIC}'`);
  const result = await invoke(); assert.notEqual(result.code, 0);
  assert.deepEqual(await counts(), { grants: 0, audits: 0 });
});

await test('descriptor rejects malformed, duplicate, and wrong-container coordinates', async () => {
  const malformed = await invoke({ ...descriptor, database: 'production' });
  assert.notEqual(malformed.code, 0);
  const duplicate = await new Promise<{ code: number | null }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3< <(printf %s "$1"); exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'stage-w-test', '{"schema_version":1,"schema_version":1}', NODE, SCRIPT,
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
  const temporary = mkdtempSync(path.join(tmpdir(), 'stage-w-descriptor-'));
  const regularPath = path.join(temporary, 'descriptor.json'); writeFileSync(regularPath, JSON.stringify(descriptor));
  try {
    const regular = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('/bin/bash', [
        '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
        'stage-w-test', regularPath, NODE, SCRIPT,
      ], { cwd: ROOT, env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' }, stdio: 'ignore' });
      child.on('error', reject); child.on('close', resolve);
    });
    assert.notEqual(regular, 0);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

await test('privilege-changing Docker capabilities are rejected before engine access', async () => {
  const docker = '/usr/local/bin/docker';
  const nonce = createHash('sha256').update(randomUUID()).digest('hex');
  const labelHash = createHash('sha256').update(nonce).digest('hex');
  const name = `auth-stage-w-conformance-cap-${nonce.slice(0, 12)}`;
  const id = execFileSync(docker, [
    'run', '-d', '--rm', '--name', name,
    '--label', `com.mayf3.auth.stage-w-conformance=sha256:${labelHash}`,
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=128m',
    '--cap-add', 'SYS_ADMIN', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=auth_stage_w_conformance', '-p', '127.0.0.1::5432',
    'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777',
    '-c', `stage_w.conformance_nonce=${nonce}`,
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
