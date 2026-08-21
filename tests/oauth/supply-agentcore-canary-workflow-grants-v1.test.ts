import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
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

function expectMatches(source: string, pattern: RegExp, times: number, label: string): void {
  const found = [...source.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))].length;
  assert.equal(found, times, `${label} must appear exactly ${times} time(s), found ${found}`);
}

await test('static source binding pins transport constants, headers, and byte/time limits', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  expectMatches(source, /const API_HOST = 'api\.github\.com';/, 1, 'fixed host');
  expectMatches(source, /const API_PORT = 443;/, 1, 'fixed port');
  expectMatches(source, /hostname: API_HOST, port: API_PORT, method: 'GET', path, headers: HEADERS,/, 1, 'fixed host/port/method wiring');
  expectMatches(source, /method: 'GET'/, 1, 'single GET transport');
  assert.doesNotMatch(source, /method: '(?:POST|PUT|DELETE|PATCH|HEAD|OPTIONS)'/);
  expectMatches(source, /const HEADERS = Object\.freeze\(\{\n {2}'User-Agent': 'mayf3-auth-service-stage-w-v1',\n {2}Accept: 'application\/vnd\.github\+json',\n {2}'X-GitHub-Api-Version': '2022-11-28',\n\}\);/, 1, 'exact fixed header set');
  expectMatches(source, /requestJson\('commit', path, 2 \* 1024 \* 1024\)/, 1, 'commit 2 MiB limit');
  expectMatches(source, /requestJson\('compare', path, 16 \* 1024 \* 1024\)/, 1, 'compare 16 MiB limit');
  expectMatches(source, /requestJson\(kind, path, 2 \* 1024 \* 1024\)/, 1, 'review/comment 2 MiB limit');
  expectMatches(source, /requestJson\(kind, path, decodedLimit === 1024 \* 1024 \? 2 \* 1024 \* 1024 : 512 \* 1024\)/, 1, 'manifest/receipt Contents wire limits');
  expectMatches(source, /contents\(pathValue, commit, 1024 \* 1024\)/, 1, 'manifest decoded 1 MiB limit');
  expectMatches(source, /contents\(link\.path, commit, 256 \* 1024\)/, 1, 'receipt decoded 256 KiB limit');
  expectMatches(source, /const decodedLimit = kind === 'contents-manifest' \? 1024 \* 1024 : 256 \* 1024;/, 1, 'conformance decoded limits');
  expectMatches(source, /const limit = value\.kind === 'compare' \? 16 \* 1024 \* 1024\n {4}: value\.kind === 'contents-receipt' \? 512 \* 1024 : 2 \* 1024 \* 1024;/, 1, 'conformance wire limits');
  expectMatches(source, /agent: false, timeout: 10_000,/, 1, 'connect/TLS/idle timeout');
  expectMatches(source, /socket\.setTimeout\(10_000\);/, 1, 'socket idle timeout');
  expectMatches(source, /setTimeout\(\(\) => reject\(new Error\('total deadline'\)\), 30_000\);/, 1, 'total deadline');
  expectMatches(source, /input\.elapsedMs >= 30_000/, 1, 'elapsed deadline guard');
});

await test('static source binding pins the environment override rejection list', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  expectMatches(source, /const OVERRIDE_ENV = Object\.freeze\(\[\n {2}'NODE_OPTIONS', 'NODE_PATH', 'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED',\n {2}'SSL_CERT_FILE', 'SSL_CERT_DIR',\n\]\);/, 1, 'exact environment rejection list');
  expectMatches(source, /for \(const name of OVERRIDE_ENV\) if \(\(process\.env\[name\] \?\? ''\) !== ''\) fail\(`\$\{name\} override is forbidden`\);/, 1, 'rejection enforcement');
  for (const name of ['NODE_OPTIONS', 'NODE_PATH', 'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'SSL_CERT_FILE', 'SSL_CERT_DIR']) {
    expectMatches(source, new RegExp(`'${name}'`), 1, `${name} binding`);
  }
});

await test('public client ID contract accepts exactly 24 unpadded base64url characters', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  expectMatches(source, /\/\^mc_\[A-Za-z0-9_-\]\{24\}\$\//, 2, 'production client ID guards');
  const clientId = /^mc_[A-Za-z0-9_-]{24}$/;
  for (const valid of [
    `mc_${'a'.repeat(24)}`,
    `mc_${'a'.repeat(23)}_`,
    `mc_${'a'.repeat(23)}-`,
  ]) assert.match(valid, clientId);
  for (const invalid of [
    `mc_${'a'.repeat(23)}`,
    `mc_${'a'.repeat(25)}`,
    `mc_${'a'.repeat(23)}+`,
    `mc_${'a'.repeat(23)}/`,
    `mc_${'a'.repeat(23)}=`,
    `mc_${'a'.repeat(23)} `,
    `mc_${'a'.repeat(23)}\n`,
    `mc_${'a'.repeat(23)}中`,
    `xx_${'a'.repeat(24)}`,
  ]) assert.doesNotMatch(invalid, clientId);
});

await test('static source binding proves no alternate transport exists', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  expectMatches(source, /https\.request\(/, 1, 'single HTTPS transport construction');
  expectMatches(source, /execFileSync\(git, \['-C', REPO_ROOT, '(?:status|rev-parse)'/, 3, 'git confined to cleanHead probes');
  expectMatches(source, /execFileSync\(/, 4, 'only docker-inspect and git probes spawn subprocesses');
  for (const [pattern, label] of [
    [/\bfetch\(/, 'fetch'],
    [/\bcurl\b/, 'curl'],
    [/from 'node:http'|require\('node:http'\)/, 'plain HTTP module'],
    [/from 'node:net'|from 'node:tls'|require\('node:net'\)|require\('node:tls'\)/, 'raw socket or TLS module'],
    [/net\.connect|tls\.connect|createConnection|socket\.connect/, 'alternate socket'],
    [/\bproxy\b|\bProxy\b|ProxyAgent/, 'proxy'],
    [/new https\.Agent|new http\.Agent/, 'custom agent'],
    [/undici|axios|node-fetch|\bgot\(/, 'third-party HTTP client'],
    [/hostname: process\.|port: process\.|process\.env\.[A-Z_]*(?:HOST|PORT)/, 'caller-controlled endpoint'],
    [/'clone'|'ls-remote'|'cat-file'|'archive'|'rev-list'|'diff-tree'/, 'git evidence transport'],
  ] as const) {
    assert.doesNotMatch(source, pattern, `${label} must not exist`);
  }
});

await test('static boundary scan covers the executable, the conformance shell, and this test file', () => {
  const forbiddenSurface = new RegExp([
    'svc-', 'forum|forum\\.', '|workflow\\.', 'execute|workflow\\.', 'admin|roll', 'back|Stage F',
    '|allowed', 'Resources|allowed', 'Scopes',
  ].join(''), 'g');
  const executableSource = readFileSync(SCRIPT, 'utf8');
  assert.equal([...executableSource.matchAll(forbiddenSurface)].length, 0, 'executable contains a disabled-surface token');
  const shellSource = readFileSync(path.join(ROOT, 'scripts/run-agentcore-canary-workflow-grants-v1-conformance.sh'), 'utf8');
  assert.equal([...shellSource.matchAll(forbiddenSurface)].length, 0, 'conformance shell contains a disabled-surface token');
  for (const line of shellSource.split('\n')) {
    if (/allowed_(?:resources|scopes)/.test(line)) {
      assert.match(line, /has_column_privilege/, 'legacy column names appear in the shell only inside the negative privilege probe');
    }
  }
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const sanctioned = /static boundary|two valid identities|forbidden or conflicting|concurrent non-cooperating|duplicate-corruption/;
  const seedStart = self.indexOf('async function seed(');
  const seedEnd = self.indexOf('async function counts(');
  assert.ok(seedStart >= 0 && seedEnd > seedStart, 'seed fixture region must be locatable');
  for (const [index, block] of self.split(/\n(?=await test\()/).entries()) {
    if (!forbiddenSurface.test(block)) continue;
    if (index === 0) {
      for (const line of block.split('\n')) {
        if (!forbiddenSurface.test(line)) continue;
        const at = self.indexOf(line);
        assert.ok(at >= seedStart && at < seedEnd, `helper-region literal outside seed(): ${line.trim()}`);
      }
    } else {
      assert.match(block.slice(0, block.indexOf('\n')), sanctioned, 'negative literals are allowed only in rejection or invariance test blocks');
    }
  }
  for (const imported of self.matchAll(/from '([^']+)';/g)) {
    assert.match(imported[1], /^node:|^@prisma\/client$/, 'test file must not link production code');
  }
  for (const required of self.matchAll(/require\('([^']+)'\)/g)) {
    assert.match(required[1], /^ajv/, 'test file must not require production code');
  }
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

await test('content-length mismatch matrix fails closed', async () => {
  const validBody = JSON.stringify({ sha: 'a'.repeat(40) });
  const mediaHeaders = { 'content-type': 'application/json; charset=utf-8' };
  const declared = (value: string) => ({ ...mediaHeaders, 'content-length': value });
  const bytes = Buffer.from(validBody); const midpoint = Math.floor(bytes.length / 2);
  const splitChunks = [bytes.subarray(0, midpoint).toString('base64'), bytes.subarray(midpoint).toString('base64')];
  const matrix = [
    ['declared length below actual bytes', httpFixture(validBody, { headers: declared('1') })],
    ['declared length above actual bytes', httpFixture(validBody, { headers: declared(String(bytes.length + 1)) })],
    ['negative content-length', httpFixture(validBody, { headers: declared('-1') })],
    ['non-integer content-length', httpFixture(validBody, { headers: declared('12.5') })],
    ['non-numeric content-length', httpFixture(validBody, { headers: declared('abc') })],
    ['signed content-length', httpFixture(validBody, { headers: declared('+30') })],
    ['exponent content-length', httpFixture(validBody, { headers: declared('1e2') })],
    ['empty content-length', httpFixture(validBody, { headers: declared('') })],
    ['non-string content-length header', httpFixture(validBody, { headers: { ...mediaHeaders, 'content-length': 30 } })],
    ['chunked body with inconsistent content-length', httpFixture(validBody, {
      headers: declared(String(bytes.length + 5)),
      chunks_base64: splitChunks,
    })],
  ] as const;
  for (const [label, fixture] of matrix) {
    const result = await invokeHttp(fixture);
    assert.notEqual(result.code, 0, `${label} must fail closed`);
  }
  const chunked = await invokeHttp(httpFixture(validBody, { headers: mediaHeaders, chunks_base64: splitChunks }));
  assert.equal(chunked.code, 0, chunked.stderr);
});

await test('every non-200 HTTP status code fails closed', async () => {
  const validBody = JSON.stringify({ sha: 'a'.repeat(40) });
  for (const status of [302, 400, 401, 403, 404, 429, 500, 503]) {
    const result = await invokeHttp(httpFixture(validBody, { status_code: status }));
    assert.notEqual(result.code, 0, `HTTP ${status} must fail closed`);
  }
});

await test('malformed evidence envelope matrix fails closed for every response kind', async () => {
  const base = 'a'.repeat(40); const head = 'b'.repeat(40);
  const compareUrl = `https://api.github.com/repos/mayf3/dsh-agent-core/compare/${base}...${head}`;
  const contentsUrl = (file: string, ref: string) => `https://api.github.com/repos/mayf3/dsh-agent-core/contents/evidence/${file}?ref=${ref}`;
  const manifest = { type: 'file', path: 'evidence/manifest.json', url: contentsUrl('manifest.json', base), encoding: 'base64', size: 2, content: 'e30=' };
  const receipt = { type: 'file', path: 'evidence/receipt.json', url: contentsUrl('receipt.json', base), encoding: 'base64', size: 2, content: 'e30=' };
  const matrix = [
    {
      kind: 'compare',
      requestPath: `/repos/mayf3/dsh-agent-core/compare/${base}...${head}`,
      valid: { url: compareUrl, base_commit: { sha: base }, merge_base_commit: { sha: base }, behind_by: 0, status: 'ahead' },
      missingField: { base_commit: { sha: base }, merge_base_commit: { sha: base }, behind_by: 0, status: 'ahead' },
      wrongType: { url: compareUrl, base_commit: { sha: base }, merge_base_commit: { sha: base }, behind_by: '0', status: 'ahead' },
      wrongCanonicalUrl: { url: `https://api.github.evil.com/repos/mayf3/dsh-agent-core/compare/${base}...${head}`, base_commit: { sha: base }, merge_base_commit: { sha: base }, behind_by: 0, status: 'ahead' },
      wrongShaOrId: { url: compareUrl, base_commit: { sha: 'c'.repeat(40) }, merge_base_commit: { sha: base }, behind_by: 0, status: 'ahead' },
    },
    {
      kind: 'contents-manifest',
      requestPath: `/repos/mayf3/dsh-agent-core/contents/evidence/manifest.json?ref=${base}`,
      valid: manifest,
      missingField: { type: 'file', path: 'evidence/manifest.json', url: manifest.url, encoding: 'base64', size: 2 },
      wrongType: { ...manifest, size: '2' },
      wrongCanonicalUrl: { ...manifest, url: contentsUrl('manifest.json', 'c'.repeat(40)) },
      wrongShaOrId: { ...manifest, size: 5 },
    },
    {
      kind: 'contents-receipt',
      requestPath: `/repos/mayf3/dsh-agent-core/contents/evidence/receipt.json?ref=${base}`,
      valid: receipt,
      missingField: { type: 'file', path: 'evidence/receipt.json', url: receipt.url, encoding: 'base64', size: 2 },
      wrongType: { ...receipt, type: 'dir' },
      wrongCanonicalUrl: { ...receipt, url: contentsUrl('receipt.json', 'c'.repeat(40)) },
      wrongShaOrId: { ...receipt, size: 5 },
    },
    {
      kind: 'review',
      requestPath: '/repos/mayf3/auth-service/pulls/3/reviews/7',
      valid: { id: 7, html_url: 'https://github.com/mayf3/auth-service/pull/3#pullrequestreview-7', pull_request_url: 'https://api.github.com/repos/mayf3/auth-service/pulls/3' },
      missingField: { id: 7, pull_request_url: 'https://api.github.com/repos/mayf3/auth-service/pulls/3' },
      wrongType: { id: '7', html_url: 'https://github.com/mayf3/auth-service/pull/3#pullrequestreview-7', pull_request_url: 'https://api.github.com/repos/mayf3/auth-service/pulls/3' },
      wrongCanonicalUrl: { id: 7, html_url: 'https://github.com/mayf3/auth-service/pull/3#pullrequestreview-7', pull_request_url: 'https://api.github.com/repos/mayf3/auth-service/pulls/4' },
      wrongShaOrId: { id: 8, html_url: 'https://github.com/mayf3/auth-service/pull/3#pullrequestreview-7', pull_request_url: 'https://api.github.com/repos/mayf3/auth-service/pulls/3' },
    },
    {
      kind: 'comment',
      requestPath: '/repos/mayf3/auth-service/issues/comments/9',
      valid: { id: 9, html_url: 'https://github.com/mayf3/auth-service/issues/4#issuecomment-9', issue_url: 'https://api.github.com/repos/mayf3/auth-service/issues/4' },
      missingField: { id: 9, html_url: 'https://github.com/mayf3/auth-service/issues/4#issuecomment-9' },
      wrongType: { id: 9, html_url: 7, issue_url: 'https://api.github.com/repos/mayf3/auth-service/issues/4' },
      wrongCanonicalUrl: { id: 9, html_url: 'https://github.com/mayf3/auth-service/issues/4#issuecomment-9', issue_url: 'https://api.github.com/repos/mayf3/auth-service/issues/5' },
      wrongShaOrId: { id: 10, html_url: 'https://github.com/mayf3/auth-service/issues/4#issuecomment-9', issue_url: 'https://api.github.com/repos/mayf3/auth-service/issues/4' },
    },
  ];
  for (const spec of matrix) {
    const control = await invokeHttp(httpFixture(JSON.stringify(spec.valid), { kind: spec.kind, request_path: spec.requestPath }));
    assert.equal(control.code, 0, `${spec.kind} valid control must pass: ${control.stderr}`);
    for (const [label, body] of [
      ['missing required field', spec.missingField],
      ['wrong type', spec.wrongType],
      ['wrong canonical URL', spec.wrongCanonicalUrl],
      ['wrong SHA or ID', spec.wrongShaOrId],
    ] as const) {
      const result = await invokeHttp(httpFixture(JSON.stringify(body), { kind: spec.kind, request_path: spec.requestPath }));
      assert.notEqual(result.code, 0, `${spec.kind} ${label} must fail closed`);
    }
    const extraProperty = await invokeHttp({ ...httpFixture(JSON.stringify(spec.valid), { kind: spec.kind, request_path: spec.requestPath }), extra_property: 1 });
    assert.notEqual(extraProperty.code, 0, `${spec.kind} fixture extra property must fail closed`);
    const duplicateMember = await invokeHttp(httpFixture(duplicateFirstMember(spec.valid), { kind: spec.kind, request_path: spec.requestPath }));
    assert.notEqual(duplicateMember.code, 0, `${spec.kind} duplicate body member must fail closed`);
  }
  const nestedDuplicate = await invokeHttp(httpFixture(`{"url":"${compareUrl}","base_commit":{"sha":"${base}","sha":"${base}"},"merge_base_commit":{"sha":"${base}"},"behind_by":0,"status":"ahead"}`, { kind: 'compare', request_path: `/repos/mayf3/dsh-agent-core/compare/${base}...${head}` }));
  assert.notEqual(nestedDuplicate.code, 0, 'nested duplicate member must fail closed');
  const escapedDuplicate = await invokeHttp(httpFixture(`{"url":"${compareUrl}","\\u0075rl":"${compareUrl}","base_commit":{"sha":"${base}"},"merge_base_commit":{"sha":"${base}"},"behind_by":0,"status":"ahead"}`, { kind: 'compare', request_path: `/repos/mayf3/dsh-agent-core/compare/${base}...${head}` }));
  assert.notEqual(escapedDuplicate.code, 0, 'Unicode escape-equivalent duplicate member must fail closed');
});

await test('Contents wire and decoded size boundaries are exact for manifest and receipt', async () => {
  const ref = 'a'.repeat(40);
  const envelope = (file: string, kind: 'contents-manifest' | 'contents-receipt', decodedBytes: number, wireBytes?: number) => {
    const decoded = Buffer.alloc(decodedBytes, 0x61);
    const fields = { type: 'file', path: `evidence/${file}`, url: `https://api.github.com/repos/mayf3/dsh-agent-core/contents/evidence/${file}?ref=${ref}`,
      encoding: 'base64', size: decodedBytes, content: decoded.toString('base64') };
    const body = wireBytes === undefined ? JSON.stringify(fields) : paddedJson(fields, wireBytes);
    return httpFixture(body, { kind, request_path: `/repos/mayf3/dsh-agent-core/contents/evidence/${file}?ref=${ref}` });
  };
  const accept = async (fixture: unknown, label: string) => {
    const result = await invokeHttp(fixture);
    assert.equal(result.code, 0, `${label} boundary must be accepted: ${result.stderr}`);
    assert.match(result.stdout, /"host":"api.github.com","port":443/);
  };
  const reject = async (fixture: unknown, label: string) => {
    const result = await invokeHttp(fixture);
    assert.notEqual(result.code, 0, `${label} must be rejected`);
  };
  await accept(envelope('manifest.json', 'contents-manifest', 2, 2 * 1024 * 1024), 'manifest wire 2 MiB');
  await reject(envelope('manifest.json', 'contents-manifest', 2, 2 * 1024 * 1024 + 1), 'manifest wire 2 MiB + 1');
  await accept(envelope('manifest.json', 'contents-manifest', 1024 * 1024), 'manifest decoded 1 MiB');
  await reject(envelope('manifest.json', 'contents-manifest', 1024 * 1024 + 1), 'manifest decoded 1 MiB + 1');
  await accept(envelope('receipt.json', 'contents-receipt', 2, 512 * 1024), 'receipt wire 512 KiB');
  await reject(envelope('receipt.json', 'contents-receipt', 2, 512 * 1024 + 1), 'receipt wire 512 KiB + 1');
  await accept(envelope('receipt.json', 'contents-receipt', 256 * 1024), 'receipt decoded 256 KiB');
  await reject(envelope('receipt.json', 'contents-receipt', 256 * 1024 + 1), 'receipt decoded 256 KiB + 1');
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

await test('named FIFO descriptor drives exact first apply, exact rerun no-op, cleanup, and still rejects regular files', async () => {
  await reset(); await seed({ sentinel: true });
  const before = await snapshotNonTarget();
  const temporary = mkdtempSync(path.join(tmpdir(), 'stage-w-named-fifo-'));
  const fifo = path.join(temporary, 'descriptor.fifo');
  execFileSync('/usr/bin/mkfifo', [fifo]);
  const runThroughNamedFifo = () => new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('/bin/bash', [
      '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
      'stage-w-named-fifo', fifo, NODE, SCRIPT,
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
    writeFileSync(fifo, JSON.stringify(descriptor));
  });
  try {
    const first = await runThroughNamedFifo();
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /"outcome":"create"/);
    assert.deepEqual(await counts(), { grants: 2, audits: 2 });
    const grantsAfterFirst = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: { machineClientId: 'asc' } });
    const auditsAfterFirst = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } });
    const rerun = await runThroughNamedFifo();
    assert.equal(rerun.code, 0, rerun.stderr);
    assert.match(rerun.stdout, /"outcome":"noop"/);
    assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: { machineClientId: 'asc' } }), grantsAfterFirst);
    assert.deepEqual(await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } }), auditsAfterFirst);
    const regularPath = path.join(temporary, 'descriptor.json');
    writeFileSync(regularPath, JSON.stringify(descriptor));
    const regular = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('/bin/bash', [
        '-c', 'exec 3<"$1"; exec "$2" --import tsx "$3" --conformance-apply --descriptor-fd 3',
        'stage-w-named-fifo-regular', regularPath, NODE, SCRIPT,
      ], {
        cwd: ROOT,
        env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
        stdio: 'ignore',
      });
      child.on('error', reject); child.on('close', resolve);
    });
    assert.notEqual(regular, 0, 'regular-file descriptor must still be rejected');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  assert.equal(existsSync(fifo), false, 'named FIFO cleanup must complete');
  assert.deepEqual(await snapshotNonTarget(), before);
});

async function installExactCompletedState(which: 'stock' | 'cto'): Promise<void> {
  const clientId = which === 'stock' ? STOCK_CLIENT : CTO_CLIENT;
  const publicId = which === 'stock' ? STOCK_PUBLIC : CTO_PUBLIC;
  const principalId = which === 'stock' ? STOCK_PRINCIPAL : CTO_PRINCIPAL;
  await prisma.machineAccessGrant.create({ data: { machineClientId: clientId, audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 } });
  await prisma.grantChangeAudit.create({ data: {
    migrationId: 'stage-w-exact-completed', sourceGitCommit: 'a'.repeat(40), operatorId: 'stage-w-conformance',
    approvalRef: 'https://github.com/mayf3/auth-service/issues/1#issuecomment-1', reason: 'exact completed state fixture',
    clientId: publicId, changeType: 'create', expectedGrantVersion: null, resultingGrantVersion: 1, beforeValue: undefined,
    afterValue: { client_id: publicId, client_kind: 'machine', principal_id: principalId, principal_type: 'agent',
      human_audience_grants: [], machine_access_grants: { 'svc-workflow': ['workflow.read'] },
      delegation_grants: {}, status: 'active', version: 1 },
  } });
}

for (const completed of ['stock', 'cto'] as const) {
  await test(`mixed partial state: ${completed} exact completed and ${completed === 'stock' ? 'cto' : 'stock'} pristine conflicts with zero writes`, async () => {
    await reset(); await seed();
    await installExactCompletedState(completed);
    const pristineClient = completed === 'stock' ? CTO_CLIENT : STOCK_CLIENT;
    const pristinePublic = completed === 'stock' ? CTO_PUBLIC : STOCK_PUBLIC;
    const beforeGrants = await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: { machineClientId: 'asc' } });
    const beforeAudits = await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } });
    const result = await invoke();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /mixed Stage W states/);
    assert.deepEqual(await counts(), { grants: 1, audits: 1 });
    assert.deepEqual(await prisma.machineAccessGrant.findMany({ where: { machineClientId: { in: [STOCK_CLIENT, CTO_CLIENT] } }, orderBy: { machineClientId: 'asc' } }), beforeGrants);
    assert.deepEqual(await prisma.grantChangeAudit.findMany({ where: { clientId: { in: [STOCK_PUBLIC, CTO_PUBLIC] } }, orderBy: { clientId: 'asc' } }), beforeAudits);
    assert.equal(await prisma.machineAccessGrant.count({ where: { machineClientId: pristineClient } }), 0, 'pristine client must stay pristine');
    assert.equal(await prisma.grantChangeAudit.count({ where: { clientId: pristinePublic } }), 0, 'pristine client must stay pristine');
  });
}

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
