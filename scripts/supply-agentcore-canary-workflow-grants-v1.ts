import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, fstatSync, readSync } from 'node:fs';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Db = PrismaClient | Prisma.TransactionClient;
type Metadata = {
  migrationId: string;
  sourceGitCommit: string;
  operatorId: string;
  approvalRef: string;
  reason: string;
};
type Target = {
  agentId: string;
  clientExternalRef: string;
  principalExternalRef: string;
};
type PlannedClient = {
  target: Target;
  internalClientId: string;
  publicClientId: string;
  principalId: string;
  outcome: 'create' | 'noop';
  afterValue: Prisma.InputJsonObject;
};
type StagePlan = { outcome: 'create' | 'noop'; clients: PlannedClient[] };

const TARGETS: readonly Target[] = Object.freeze([
  Object.freeze({
    agentId: 'agt_stock_agent',
    clientExternalRef: 'agentcore:v1:client:agt_stock_agent',
    principalExternalRef: 'agentcore:v1:principal:agt_stock_agent',
  }),
  Object.freeze({
    agentId: 'agt_cto-agent',
    clientExternalRef: 'agentcore:v1:client:agt_cto-agent',
    principalExternalRef: 'agentcore:v1:principal:agt_cto-agent',
  }),
]);
const AUDIENCE = 'svc-workflow';
const SCOPES = Object.freeze(['workflow.read']);
const IMAGE = 'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777';
const DATABASE = 'auth_stage_w_conformance';
const API_HOST = 'api.github.com';
const API_PORT = 443;
const HEADERS = Object.freeze({
  'User-Agent': 'mayf3-auth-service-stage-w-v1',
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});
const OVERRIDE_ENV = Object.freeze([
  'NODE_OPTIONS', 'NODE_PATH', 'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED',
  'SSL_CERT_FILE', 'SSL_CERT_DIR',
]);
const AUDIT_KEYS = Object.freeze([
  'change_id', 'migration_id', 'source_git_commit', 'operator_id', 'approval_ref',
  'reason', 'client_id', 'change_type', 'expected_grant_version',
  'resulting_grant_version', 'before_value', 'after_value', 'timestamp',
]);

function fail(message: string): never {
  throw new Error(`Stage W refused: ${message}`);
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} has a missing or additional field`);
  }
}
function text(value: unknown, label: string, maxBytes: number): string {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maxBytes) {
    fail(`${label} must be non-empty and at most ${maxBytes} UTF-8 bytes`);
  }
  return value;
}
function exactText(value: unknown, expected: string, label: string): string {
  if (value !== expected) fail(`${label} must equal ${expected}`);
  return expected;
}
function lowercaseHex(value: unknown, length: number, label: string): string {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    fail(`${label} must be lowercase ${length}-hex`);
  }
  return value;
}
function canonicalBase64(value: string): Buffer {
  if (value.length === 0 || value.length % 4 !== 0) fail('base64 value has invalid length');
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const data = (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)
      || (code >= 0x30 && code <= 0x39) || code === 0x2b || code === 0x2f;
    const padding = code === 0x3d && index >= value.length - 2;
    if (!data && !padding) fail('base64 value contains an invalid byte');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) fail('base64 value is not canonical');
  return decoded;
}

function safePath(value: unknown, label: string): string {
  const path = text(value, label, 1024);
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')
      || path.split('/').some((part) => part.length === 0 || part === '..' || part === '.')) {
    fail(`${label} is not a safe relative POSIX path`);
  }
  return path;
}
function asciiCompare(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));
}
function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b));
}

// JSON.parse accepts duplicate members. This scanner rejects decoded duplicate keys at every depth.
function parseUniqueJson(bytes: Buffer | string, label: string, maxBytes: number): Json {
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  if (source.length === 0 || source.length > maxBytes) fail(`${label} byte length is invalid`);
  const input = source.toString('utf8');
  if (!Buffer.from(input, 'utf8').equals(source)) fail(`${label} is not UTF-8`);
  let index = 0;
  const whitespace = () => {
    while (index < input.length && [0x20, 0x09, 0x0a, 0x0d].includes(input.charCodeAt(index))) index += 1;
  };
  const stringToken = (): string => {
    if (input[index] !== '"') fail(`${label} contains invalid JSON`);
    const start = index;
    let containsEscape = false;
    index += 1;
    while (index < input.length) {
      const char = input[index++];
      if (char === '"') {
        if (!containsEscape) return input.slice(start + 1, index - 1);
        try { return JSON.parse(input.slice(start, index)) as string; } catch { fail(`${label} contains invalid string`); }
      }
      if (char === '\\') { containsEscape = true; index += 1; }
      else if (char !== undefined && char.charCodeAt(0) < 0x20) fail(`${label} contains invalid string`);
    }
    fail(`${label} contains unterminated string`);
  };
  const value = (): void => {
    whitespace();
    const char = input[index];
    if (char === '{') {
      index += 1; whitespace();
      const keys = new Set<string>();
      if (input[index] === '}') { index += 1; return; }
      while (true) {
        whitespace(); const key = stringToken();
        if (keys.has(key)) fail(`${label} contains duplicate member ${key}`);
        keys.add(key); whitespace();
        if (input[index++] !== ':') fail(`${label} contains invalid object`);
        value(); whitespace();
        const separator = input[index++];
        if (separator === '}') return;
        if (separator !== ',') fail(`${label} contains invalid object`);
      }
    }
    if (char === '[') {
      index += 1; whitespace();
      if (input[index] === ']') { index += 1; return; }
      while (true) {
        value(); whitespace();
        const separator = input[index++];
        if (separator === ']') return;
        if (separator !== ',') fail(`${label} contains invalid array`);
      }
    }
    if (char === '"') { stringToken(); return; }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(input.slice(index));
    if (!match) fail(`${label} contains invalid JSON value`);
    index += match[0].length;
  };
  value(); whitespace();
  if (index !== input.length) fail(`${label} contains trailing bytes`);
  try { return JSON.parse(input) as Json; } catch { fail(`${label} is invalid JSON`); }
}

function completeSnapshot(client: {
  clientId: string;
  machinePrincipalId: string;
  status: string;
  principal: { principalType: string };
}, grants: Array<{ audienceId: string; scopes: string[]; version: number }>, revision: number): Prisma.InputJsonObject {
  const machineAccessGrants: Record<string, Prisma.InputJsonValue> = {};
  for (const grant of [...grants].sort((a, b) => asciiCompare(a.audienceId, b.audienceId))) {
    machineAccessGrants[grant.audienceId] = [...grant.scopes].sort(asciiCompare);
  }
  return {
    client_id: client.clientId,
    client_kind: 'machine',
    principal_id: client.machinePrincipalId,
    principal_type: client.principal.principalType,
    human_audience_grants: [],
    machine_access_grants: machineAccessGrants,
    delegation_grants: {},
    status: client.status,
    version: revision,
  };
}

function validateMetadata(metadata: Metadata): void {
  text(metadata.migrationId, 'migration_id', 128);
  lowercaseHex(metadata.sourceGitCommit, 40, 'source_git_commit');
  text(metadata.operatorId, 'operator_id', 256);
  text(metadata.approvalRef, 'approval_ref', 2048);
  text(metadata.reason, 'reason', 512);
}

async function loadStagePlan(db: Db): Promise<StagePlan> {
  const audienceRows = await db.authAudience.findMany({
    where: { audienceId: AUDIENCE },
    select: {
      audienceId: true, status: true, machineAccessEnabled: true,
      acceptedPrincipalTypes: true, registeredScopes: true,
    },
  });
  if (audienceRows.length !== 1) fail('svc-workflow must resolve exactly once');
  const audience = audienceRows[0];
  if (audience.status !== 'active' || !audience.machineAccessEnabled
      || !audience.acceptedPrincipalTypes.includes('agent')
      || !audience.registeredScopes.includes(SCOPES[0])) {
    fail('svc-workflow is inactive, not machine/agent enabled, or does not register workflow.read');
  }

  const planned: PlannedClient[] = [];
  for (const target of TARGETS) {
    const principals = await db.machinePrincipal.findMany({
      where: { OR: [{ externalRef: target.principalExternalRef }, { agentId: target.agentId }] },
      select: { id: true, externalRef: true, agentId: true, principalType: true, status: true },
    });
    if (principals.length !== 1 || principals[0].externalRef !== target.principalExternalRef
        || principals[0].agentId !== target.agentId || principals[0].principalType !== 'agent'
        || principals[0].status !== 'active') fail(`${target.agentId} principal must resolve uniquely and exactly`);
    const rows = await db.machineClient.findMany({
      where: { externalRef: target.clientExternalRef },
      select: {
        id: true, clientId: true, externalRef: true, machinePrincipalId: true, status: true,
        principal: {
          select: { id: true, externalRef: true, agentId: true, principalType: true, status: true },
        },
        accessGrants: {
          select: { audienceId: true, scopes: true, version: true },
          orderBy: { audienceId: 'asc' },
        },
        trustedProxy: { select: { delegationGrants: { select: { audienceId: true } } } },
      },
    });
    if (rows.length !== 1) fail(`${target.clientExternalRef} must resolve exactly once`);
    const client = rows[0];
    if (client.externalRef !== target.clientExternalRef || client.status !== 'active'
        || client.principal.id !== client.machinePrincipalId || client.principal.id !== principals[0].id
        || client.principal.externalRef !== target.principalExternalRef
        || client.principal.agentId !== target.agentId
        || client.principal.principalType !== 'agent' || client.principal.status !== 'active') {
      fail(`${target.agentId} identity binding is invalid`);
    }
    if (!/^mc_[A-Za-z0-9]{24}$/.test(client.clientId)) fail(`${target.agentId} public client ID is invalid`);
    if (client.trustedProxy !== null && client.trustedProxy.delegationGrants.length !== 0) {
      fail(`${target.agentId} has delegation grants outside the Stage W target snapshot`);
    }

    const audits = await db.grantChangeAudit.findMany({
      where: { clientId: client.clientId },
      select: {
        id: true, migrationId: true, sourceGitCommit: true, operatorId: true, approvalRef: true,
        reason: true, clientId: true, changeType: true, expectedGrantVersion: true,
        resultingGrantVersion: true, beforeValue: true, afterValue: true, timestamp: true,
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });
    if (client.accessGrants.length === 0 && audits.length === 0) {
      const afterValue = completeSnapshot(client, [{ audienceId: AUDIENCE, scopes: [...SCOPES], version: 1 }], 1);
      planned.push({ target, internalClientId: client.id, publicClientId: client.clientId,
        principalId: client.machinePrincipalId, outcome: 'create', afterValue });
      continue;
    }
    const exactGrant = client.accessGrants.length === 1
      && client.accessGrants[0].audienceId === AUDIENCE
      && client.accessGrants[0].version === 1
      && sameJson([...client.accessGrants[0].scopes].sort(asciiCompare), SCOPES);
    const afterValue = completeSnapshot(client, client.accessGrants, 1);
    const exactAudit = audits.length === 1
      && audits[0].changeType === 'create'
      && audits[0].expectedGrantVersion === null
      && audits[0].resultingGrantVersion === 1
      && audits[0].clientId === client.clientId
      && audits[0].beforeValue === null
      && sameJson(audits[0].afterValue, afterValue);
    if (!exactGrant || !exactAudit) fail(`${target.agentId} existing grant set conflicts with Stage W`);
    planned.push({ target, internalClientId: client.id, publicClientId: client.clientId,
      principalId: client.machinePrincipalId, outcome: 'noop', afterValue });
  }
  if (planned.some((item) => item.outcome !== planned[0].outcome)) {
    fail('canary clients are in mixed Stage W states');
  }
  return { outcome: planned[0].outcome, clients: planned };
}

function auditEnvelope(metadata: Metadata, client: PlannedClient, id: string, timestamp: Date): Record<string, unknown> {
  const envelope = {
    change_id: id,
    migration_id: metadata.migrationId,
    source_git_commit: metadata.sourceGitCommit,
    operator_id: metadata.operatorId,
    approval_ref: metadata.approvalRef,
    reason: metadata.reason,
    client_id: client.publicClientId,
    change_type: 'create',
    expected_grant_version: null,
    resulting_grant_version: 1,
    before_value: null,
    after_value: client.afterValue,
    timestamp: timestamp.toISOString(),
  };
  exactKeys(envelope, AUDIT_KEYS, 'grant audit');
  return envelope;
}

async function applyStage(prisma: PrismaClient, metadata: Metadata): Promise<StagePlan> {
  validateMetadata(metadata);
  return prisma.$transaction(async (tx) => {
    // Table locks make non-cooperating Grant/audit writers serialize before or after this plan.
    // A writer that commits first is visible to the complete plan and becomes a conflict.
    await tx.$executeRawUnsafe('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(813_947_201)`;
    const plan = await loadStagePlan(tx);
    if (plan.outcome === 'noop') return plan;
    for (const client of plan.clients) {
      await tx.machineAccessGrant.create({ data: {
        machineClientId: client.internalClientId,
        audienceId: AUDIENCE,
        scopes: [...SCOPES],
        version: 1,
      } });
      const id = randomUUID();
      const timestamp = new Date();
      const envelope = auditEnvelope(metadata, client, id, timestamp);
      await tx.grantChangeAudit.create({ data: {
        id,
        migrationId: envelope.migration_id as string,
        sourceGitCommit: envelope.source_git_commit as string,
        operatorId: envelope.operator_id as string,
        approvalRef: envelope.approval_ref as string,
        reason: envelope.reason as string,
        clientId: envelope.client_id as string,
        changeType: 'create',
        expectedGrantVersion: null,
        resultingGrantVersion: 1,
        beforeValue: Prisma.DbNull,
        afterValue: client.afterValue,
        timestamp,
      } });
    }
    return plan;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function report(plan: StagePlan, operation: string): void {
  process.stdout.write(`${JSON.stringify({
    stage: 'W', operation, outcome: plan.outcome,
    grants_created: plan.outcome === 'create' ? 2 : 0,
    audits_created: plan.outcome === 'create' ? 2 : 0,
    targets: plan.clients.map((client) => ({
      client_id: client.publicClientId, audience: AUDIENCE, scopes: SCOPES, outcome: client.outcome,
    })),
  })}\n`);
}

function cleanHead(): string {
  const git = '/usr/bin/git';
  const status = execFileSync(git, ['-C', REPO_ROOT, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  if (status.length !== 0) fail('auth-service executable worktree is dirty');
  const top = execFileSync(git, ['-C', REPO_ROOT, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  if (`${top}/` !== REPO_ROOT) fail('executable repository root mismatch');
  return execFileSync(git, ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function githubPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
function mediaType(value: string | string[] | undefined): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(';').map((part) => part.trim().toLowerCase());
  if (parts.shift() !== 'application/json' || parts.length > 1) return false;
  return parts.length === 0 || parts[0] === 'charset=utf-8';
}
function appendHttpChunk(chunks: Buffer[], currentSize: number, chunk: Buffer, limit: number): number {
  const nextSize = currentSize + chunk.length;
  if (nextSize > limit) fail('HTTPS response exceeds byte limit during streaming');
  chunks.push(chunk);
  return nextSize;
}

function validateHttpState(input: {
  kind: string; path: string; limit: number; tlsAuthorized: boolean; elapsedMs: number;
  statusCode: number; headers: Record<string, string | string[] | undefined>;
  chunks: Buffer[]; terminal: string;
}): Record<string, unknown> {
  if (!input.tlsAuthorized || input.terminal !== 'end' || input.statusCode !== 200 || input.elapsedMs >= 30_000) {
    fail('HTTPS terminal/status/deadline state refused');
  }
  if (!mediaType(input.headers['content-type'])) fail('HTTPS media type refused');
  const body = Buffer.concat(input.chunks);
  if (body.length > input.limit) fail('HTTPS response exceeds byte limit');
  const declared = input.headers['content-length'];
  if (declared !== undefined && (typeof declared !== 'string' || !/^\d+$/.test(declared)
      || Number(declared) !== body.length || Number(declared) > input.limit)) fail('HTTPS content-length refused');
  const parsed = parseUniqueJson(body, 'GitHub response', input.limit);
  if (!isObject(parsed)) fail('GitHub response must be an object');
  validateFixtureEnvelope(input.kind, input.path, parsed);
  return parsed;
}

async function requestJson(kind: string, path: string, limit: number): Promise<Record<string, unknown>> {
  for (const name of OVERRIDE_ENV) if ((process.env[name] ?? '') !== '') fail(`${name} override is forbidden`);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const total = setTimeout(() => reject(new Error('total deadline')), 30_000);
    const request = https.request({
      hostname: API_HOST, port: API_PORT, method: 'GET', path, headers: HEADERS,
      agent: false, timeout: 10_000,
    }, (response) => {
      const chunks: Buffer[] = []; let size = 0; let ended = false;
      const declared = response.headers['content-length'];
      if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
        response.destroy(); clearTimeout(total); reject(new Error('invalid content-length')); return;
      }
      response.on('data', (chunk: Buffer) => {
        try { size = appendHttpChunk(chunks, size, chunk, limit); }
        catch (error) { response.destroy(error as Error); }
      });
      response.on('end', () => {
        ended = true; clearTimeout(total);
        try {
          resolve(validateHttpState({ kind, path, limit, tlsAuthorized: true,
            elapsedMs: Date.now() - started, statusCode: response.statusCode ?? 0,
            headers: response.headers, chunks, terminal: 'end' }));
        } catch (error) { reject(error); }
      });
      response.on('close', () => { if (!ended) { clearTimeout(total); reject(new Error('premature close')); } });
    });
    request.on('socket', (socket) => {
      socket.setTimeout(10_000);
      socket.once('timeout', () => request.destroy(new Error('idle/connect/TLS timeout')));
    });
    request.on('timeout', () => request.destroy(new Error('request timeout')));
    request.on('error', (error) => { clearTimeout(total); reject(error); });
    request.end();
  });
}

function canonicalApi(path: string): string { return `https://${API_HOST}${path}`; }
async function commitSha(ref: string): Promise<string> {
  const path = `/repos/mayf3/dsh-agent-core/commits/${ref}`;
  const body = await requestJson('commit', path, 2 * 1024 * 1024);
  return lowercaseHex(body.sha, 40, `commit ${ref}`);
}
async function requireAncestor(base: string, head: string): Promise<void> {
  const path = `/repos/mayf3/dsh-agent-core/compare/${base}...${head}`;
  const body = await requestJson('compare', path, 16 * 1024 * 1024);
  if (body.url !== canonicalApi(path) || !isObject(body.base_commit) || !isObject(body.merge_base_commit)
      || body.base_commit.sha !== base || body.merge_base_commit.sha !== base || body.behind_by !== 0
      || (body.status !== 'ahead' && body.status !== 'identical')) fail('commit ancestry proof is invalid');
}
async function contents(pathValue: string, commit: string, decodedLimit: number): Promise<Buffer> {
  const path = `/repos/mayf3/dsh-agent-core/contents/${githubPath(pathValue)}?ref=${commit}`;
  const kind = decodedLimit === 1024 * 1024 ? 'contents-manifest' : 'contents-receipt';
  const body = await requestJson(kind, path, decodedLimit === 1024 * 1024 ? 2 * 1024 * 1024 : 512 * 1024);
  if (body.type !== 'file' || body.path !== pathValue || body.url !== canonicalApi(path)
      || body.encoding !== 'base64' || typeof body.content !== 'string'
      || !Number.isInteger(body.size) || (body.size as number) < 1 || (body.size as number) > decodedLimit) {
    fail('Contents response is invalid');
  }
  const compact = body.content.replace(/\n/g, '');
  const decoded = canonicalBase64(compact);
  if (decoded.length !== body.size || decoded.length > decodedLimit) fail('Contents decoded size mismatch');
  return decoded;
}

const RECEIPT_LINK_KEYS = ['path', 'sha256'] as const;
function receiptLink(value: unknown, label: string): { path: string; sha256: string } {
  if (!isObject(value)) fail(`${label} must be an object`);
  exactKeys(value, RECEIPT_LINK_KEYS, label);
  return { path: safePath(value.path, `${label}.path`), sha256: lowercaseHex(value.sha256, 64, `${label}.sha256`) };
}
function recordedAt(value: unknown, label: string): void {
  if (typeof value !== 'string') fail(`${label}.recorded_at is not RFC3339 UTC`);
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) fail(`${label}.recorded_at is not RFC3339 UTC`);
  const millisecond = Number((match[7] ?? '').padEnd(3, '0'));
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6]), millisecond));
  const expected = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${String(millisecond).padStart(3, '0')}Z`;
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== expected) fail(`${label}.recorded_at is not a real RFC3339 UTC instant`);
}
async function liveAuthRef(value: unknown, label: string): Promise<string> {
  const url = text(value, label, 2048);
  let path: string; let id: number; let expected: Record<string, string>; let kind: 'review' | 'comment';
  let match = /^https:\/\/github\.com\/mayf3\/auth-service\/pull\/(\d+)#pullrequestreview-(\d+)$/.exec(url);
  if (match) {
    const number = Number(match[1]); id = Number(match[2]); kind = 'review';
    path = `/repos/mayf3/auth-service/pulls/${number}/reviews/${id}`;
    expected = { html_url: url, pull_request_url: `https://api.github.com/repos/mayf3/auth-service/pulls/${number}` };
  } else {
    match = /^https:\/\/github\.com\/mayf3\/auth-service\/(?:pull|issues)\/(\d+)#issuecomment-(\d+)$/.exec(url);
    if (!match) fail(`${label} is not an immutable auth-service review/comment URL`);
    const number = Number(match[1]); id = Number(match[2]); kind = 'comment';
    path = `/repos/mayf3/auth-service/issues/comments/${id}`;
    expected = { html_url: url, issue_url: `https://api.github.com/repos/mayf3/auth-service/issues/${number}` };
  }
  if (id <= 0) fail(`${label} immutable ID is invalid`);
  const body = await requestJson(kind, path, 2 * 1024 * 1024);
  if (body.id !== id || Object.entries(expected).some(([key, expectedValue]) => body[key] !== expectedValue)) {
    fail(`${label} live object does not match`);
  }
  return url;
}

async function loadReceipt(link: { path: string; sha256: string }, commit: string, label: string): Promise<Record<string, unknown>> {
  const bytes = await contents(link.path, commit, 256 * 1024);
  if (createHash('sha256').update(bytes).digest('hex') !== link.sha256) fail(`${label} digest mismatch`);
  const parsed = parseUniqueJson(bytes, label, 256 * 1024);
  if (!isObject(parsed)) fail(`${label} must be an object`);
  return parsed;
}
function baseReceipt(receipt: Record<string, unknown>, keys: readonly string[], label: string): void {
  exactKeys(receipt, keys, label);
  if (receipt.schema_version !== 1 || receipt.repository !== 'mayf3/dsh-agent-core') fail(`${label} base fields invalid`);
  recordedAt(receipt.recorded_at, label);
}

async function validateEvidence(commit: string, pathValue: string): Promise<Metadata> {
  const head = cleanHead();
  lowercaseHex(commit, 40, 'evidence_commit'); safePath(pathValue, 'evidence_path');
  const remoteMain = await commitSha('main');
  if (await commitSha(commit) !== commit) fail('evidence commit response mismatch');
  await requireAncestor(commit, remoteMain);
  const manifestBytes = await contents(pathValue, commit, 1024 * 1024);
  const manifest = parseUniqueJson(manifestBytes, 'manifest', 1024 * 1024);
  if (!isObject(manifest)) fail('manifest must be an object');
  exactKeys(manifest, ['schema_version', 'phase_a', 'identities', 'readiness', 'migration_review', 'approval', 'audit_metadata'], 'manifest');
  if (manifest.schema_version !== 1 || !isObject(manifest.phase_a) || !isObject(manifest.readiness)
      || !isObject(manifest.migration_review) || !isObject(manifest.approval) || !isObject(manifest.audit_metadata)
      || !Array.isArray(manifest.identities) || manifest.identities.length !== 2) fail('manifest shape invalid');

  const phase = manifest.phase_a;
  exactKeys(phase, ['merged', 'merge_commit', 'receipt'], 'phase_a');
  if (phase.merged !== true) fail('Phase A is not merged');
  const phaseCommit = lowercaseHex(phase.merge_commit, 40, 'phase_a.merge_commit');
  if (await commitSha(phaseCommit) !== phaseCommit) fail('Phase A commit mismatch');
  await requireAncestor(phaseCommit, commit);

  const identities = manifest.identities.map((entry, index) => {
    if (!isObject(entry)) fail(`identity ${index} is not an object`);
    exactKeys(entry, ['client_external_ref', 'principal_external_ref', 'client_id', 'principal_id', 'client_active', 'principal_active', 'principal_type', 'agent_id', 'receipt'], `identity ${index}`);
    const target = TARGETS.find((item) => item.clientExternalRef === entry.client_external_ref);
    if (!target || entry.principal_external_ref !== target.principalExternalRef || entry.agent_id !== target.agentId
        || entry.client_active !== true || entry.principal_active !== true || entry.principal_type !== 'agent'
        || typeof entry.client_id !== 'string' || !/^mc_[A-Za-z0-9]{24}$/.test(entry.client_id)
        || typeof entry.principal_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(entry.principal_id)) {
      fail(`identity ${index} values invalid`);
    }
    return { entry, target, link: receiptLink(entry.receipt, `identity ${index}.receipt`) };
  });
  if (new Set(identities.map((item) => item.target.clientExternalRef)).size !== 2
      || new Set(identities.map((item) => item.target.principalExternalRef)).size !== 2) fail('identity cardinality invalid');

  const readiness = manifest.readiness;
  exactKeys(readiness, ['status', 'receipt'], 'readiness'); exactText(readiness.status, 'READY', 'readiness.status');
  const review = manifest.migration_review;
  exactKeys(review, ['repository', 'verdict', 'reviewed_source_git_commit', 'review_ref', 'receipt'], 'migration_review');
  exactText(review.repository, 'mayf3/auth-service', 'migration_review.repository'); exactText(review.verdict, 'PASS', 'migration_review.verdict');
  const reviewed = lowercaseHex(review.reviewed_source_git_commit, 40, 'migration_review.reviewed_source_git_commit');
  if (reviewed !== head) fail('reviewed source commit does not equal clean HEAD');
  const reviewRef = await liveAuthRef(review.review_ref, 'migration_review.review_ref');
  const approval = manifest.approval;
  exactKeys(approval, ['status', 'operator_id', 'approval_ref', 'receipt'], 'approval'); exactText(approval.status, 'APPROVED', 'approval.status');
  const operatorId = text(approval.operator_id, 'approval.operator_id', 256);
  const approvalRef = await liveAuthRef(approval.approval_ref, 'approval.approval_ref');
  const audit = manifest.audit_metadata;
  exactKeys(audit, ['migration_id', 'source_git_commit', 'operator_id', 'approval_ref', 'reason'], 'audit_metadata');
  const metadata: Metadata = {
    migrationId: text(audit.migration_id, 'audit_metadata.migration_id', 128),
    sourceGitCommit: lowercaseHex(audit.source_git_commit, 40, 'audit_metadata.source_git_commit'),
    operatorId: text(audit.operator_id, 'audit_metadata.operator_id', 256),
    approvalRef: text(audit.approval_ref, 'audit_metadata.approval_ref', 2048),
    reason: text(audit.reason, 'audit_metadata.reason', 512),
  };
  if (metadata.sourceGitCommit !== head || metadata.sourceGitCommit !== reviewed
      || metadata.operatorId !== operatorId || metadata.approvalRef !== approvalRef) fail('audit metadata cross-binding invalid');

  const phaseReceipt = await loadReceipt(receiptLink(phase.receipt, 'phase_a.receipt'), commit, 'Phase A receipt');
  baseReceipt(phaseReceipt, ['schema_version', 'repository', 'recorded_at', 'receipt_type', 'status', 'merge_commit'], 'Phase A receipt');
  if (phaseReceipt.receipt_type !== 'agentcore_clean_bootstrap_phase_a' || phaseReceipt.status !== 'MERGED' || phaseReceipt.merge_commit !== phaseCommit) fail('Phase A receipt invalid');

  for (const { entry, link } of identities) {
    const receipt = await loadReceipt(link, commit, 'identity receipt');
    baseReceipt(receipt, ['schema_version', 'repository', 'recorded_at', 'receipt_type', 'agent_id', 'client_external_ref', 'principal_external_ref', 'client_id', 'principal_id', 'client_active', 'principal_active', 'principal_type', 'created'], 'identity receipt');
    if (receipt.receipt_type !== 'auth_service_machine_identity' || receipt.created !== true
        || ['agent_id', 'client_external_ref', 'principal_external_ref', 'client_id', 'principal_id', 'client_active', 'principal_active', 'principal_type']
          .some((key) => receipt[key] !== entry[key])) fail('identity receipt cross-binding invalid');
  }
  const readinessReceipt = await loadReceipt(receiptLink(readiness.receipt, 'readiness.receipt'), commit, 'readiness receipt');
  baseReceipt(readinessReceipt, ['schema_version', 'repository', 'recorded_at', 'receipt_type', 'status', 'client_ids'], 'readiness receipt');
  const clientIds = identities.map(({ entry }) => entry.client_id as string).sort(asciiCompare);
  if (readinessReceipt.receipt_type !== 'agentcore_auth_canary_readiness' || readinessReceipt.status !== 'READY'
      || !sameJson(readinessReceipt.client_ids, clientIds)) fail('readiness receipt invalid');
  const reviewReceipt = await loadReceipt(receiptLink(review.receipt, 'migration_review.receipt'), commit, 'migration review receipt');
  baseReceipt(reviewReceipt, ['schema_version', 'repository', 'recorded_at', 'receipt_type', 'auth_repository', 'verdict', 'reviewed_source_git_commit', 'review_ref', 'reviewer_id'], 'migration review receipt');
  if (reviewReceipt.receipt_type !== 'auth_service_stage_w_migration_review' || reviewReceipt.auth_repository !== 'mayf3/auth-service'
      || reviewReceipt.verdict !== 'PASS' || reviewReceipt.reviewed_source_git_commit !== reviewed
      || reviewReceipt.review_ref !== reviewRef || typeof reviewReceipt.reviewer_id !== 'string' || reviewReceipt.reviewer_id.length === 0) fail('migration review receipt invalid');
  const approvalReceipt = await loadReceipt(receiptLink(approval.receipt, 'approval.receipt'), commit, 'approval receipt');
  baseReceipt(approvalReceipt, ['schema_version', 'repository', 'recorded_at', 'receipt_type', 'auth_repository', 'status', 'operator_id', 'approval_ref', 'reviewed_source_git_commit', 'authorized_stage', 'authorized_client_ids', 'audience', 'scopes'], 'approval receipt');
  if (approvalReceipt.receipt_type !== 'auth_service_stage_w_operator_approval' || approvalReceipt.auth_repository !== 'mayf3/auth-service'
      || approvalReceipt.status !== 'APPROVED' || approvalReceipt.operator_id !== operatorId || approvalReceipt.approval_ref !== approvalRef
      || approvalReceipt.reviewed_source_git_commit !== reviewed || approvalReceipt.authorized_stage !== 'STAGE_W'
      || !sameJson(approvalReceipt.authorized_client_ids, clientIds) || approvalReceipt.audience !== AUDIENCE
      || !sameJson(approvalReceipt.scopes, SCOPES)) fail('approval receipt invalid');
  return metadata;
}

function readFifo(fdText: string | undefined, label: string, maxBytes = 1024 * 1024): Json {
  if (fdText === undefined || !/^(?:[3-9]|[1-9]\d+)$/.test(fdText)) fail(`${label} descriptor is invalid`);
  const fd = Number(fdText);
  if (!fstatSync(fd).isFIFO()) fail(`${label} descriptor must be a FIFO`);
  const chunks: Buffer[] = []; let size = 0;
  while (true) {
    const chunk = Buffer.allocUnsafe(64 * 1024);
    const count = readSync(fd, chunk, 0, chunk.length, null);
    if (count === 0) break;
    size += count;
    if (size > maxBytes) { closeSync(fd); fail(`${label} exceeds its byte limit`); }
    chunks.push(chunk.subarray(0, count));
  }
  closeSync(fd);
  return parseUniqueJson(Buffer.concat(chunks), label, maxBytes);
}
function minimalDockerEnv(): NodeJS.ProcessEnv { return { PATH: '/usr/local/bin:/usr/bin:/bin' }; }
function conformanceUrl(descriptor: Record<string, unknown>): string {
  exactKeys(descriptor, ['schema_version', 'container_id', 'nonce', 'host_port', 'database', 'audit_metadata'], 'conformance descriptor');
  if (descriptor.schema_version !== 1) fail('descriptor schema version invalid');
  const containerId = lowercaseHex(descriptor.container_id, 64, 'container_id');
  const nonce = lowercaseHex(descriptor.nonce, 64, 'nonce');
  if (!Number.isInteger(descriptor.host_port) || (descriptor.host_port as number) < 1 || (descriptor.host_port as number) > 65535) fail('host_port invalid');
  exactText(descriptor.database, DATABASE, 'database');
  if (!isObject(descriptor.audit_metadata)) fail('audit_metadata invalid');
  const inspectRaw = execFileSync('/usr/local/bin/docker', ['inspect', containerId], { encoding: 'utf8', env: minimalDockerEnv() });
  const inspected = parseUniqueJson(inspectRaw, 'docker inspect', 2 * 1024 * 1024);
  if (!Array.isArray(inspected) || inspected.length !== 1 || !isObject(inspected[0])) fail('docker inspect shape invalid');
  const info = inspected[0];
  const config = info.Config; const state = info.State; const hostConfig = info.HostConfig; const network = info.NetworkSettings;
  if (!isObject(config) || !isObject(state) || !isObject(hostConfig) || !isObject(network)) fail('docker inspect sections invalid');
  const ports = network.Ports;
  const networks = network.Networks;
  const labels = config.Labels;
  const mounts = info.Mounts;
  const emptyOrNull = (value: unknown) => value === null || (Array.isArray(value) && value.length === 0);
  if (config.Image !== IMAGE || state.Running !== true || hostConfig.AutoRemove !== true
      || typeof info.Name !== 'string' || !info.Name.startsWith('/auth-stage-w-conformance-')
      || !isObject(labels) || labels['com.mayf3.auth.stage-w-conformance'] !== `sha256:${createHash('sha256').update(nonce).digest('hex')}`
      || !isObject(hostConfig.Tmpfs) || !Object.hasOwn(hostConfig.Tmpfs, '/var/lib/postgresql/data')
      || !Array.isArray(mounts) || mounts.length !== 0 || hostConfig.Privileged !== false
      || !emptyOrNull(hostConfig.CapAdd) || !emptyOrNull(hostConfig.CapDrop)
      || !emptyOrNull(hostConfig.Devices) || !emptyOrNull(hostConfig.DeviceCgroupRules)
      || !emptyOrNull(hostConfig.DeviceRequests) || !emptyOrNull(hostConfig.SecurityOpt)
      || !emptyOrNull(hostConfig.Binds) || hostConfig.ReadonlyRootfs !== false
      || hostConfig.PidMode !== '' || hostConfig.IpcMode !== 'private'
      || hostConfig.UTSMode !== '' || hostConfig.UsernsMode !== ''
      || hostConfig.NetworkMode !== 'bridge' || !isObject(networks) || Object.keys(networks).length !== 1
      || !isObject(networks.bridge) || typeof networks.bridge.IPAddress !== 'string' || networks.bridge.IPAddress.length === 0
      || !isObject(ports) || Object.keys(ports).length !== 1 || !Array.isArray(ports['5432/tcp'])
      || ports['5432/tcp'].length !== 1 || !isObject(ports['5432/tcp'][0])
      || ports['5432/tcp'][0].HostIp !== '127.0.0.1'
      || Number(ports['5432/tcp'][0].HostPort) !== descriptor.host_port) fail('container is not exact disposable conformance PostgreSQL');
  const metadataObject = descriptor.audit_metadata;
  exactKeys(metadataObject, ['migration_id', 'source_git_commit', 'operator_id', 'approval_ref', 'reason'], 'audit_metadata');
  const metadata: Metadata = {
    migrationId: text(metadataObject.migration_id, 'migration_id', 128),
    sourceGitCommit: lowercaseHex(metadataObject.source_git_commit, 40, 'source_git_commit'),
    operatorId: text(metadataObject.operator_id, 'operator_id', 256),
    approvalRef: text(metadataObject.approval_ref, 'approval_ref', 2048),
    reason: text(metadataObject.reason, 'reason', 512),
  };
  validateMetadata(metadata);
  const privateBinding = { metadata, serverAddress: `${networks.bridge.IPAddress}/32` };
  return `postgresql://stage_w_runner@127.0.0.1:${descriptor.host_port}/${DATABASE}?schema=public&application_name=stage_w_${nonce}#${Buffer.from(JSON.stringify(privateBinding)).toString('base64url')}`;
}

function parseConformanceUrl(value: string): { url: string; metadata: Metadata; nonce: string; serverAddress: string } {
  const parsed = new URL(value);
  const binding = JSON.parse(Buffer.from(parsed.hash.slice(1), 'base64url').toString('utf8')) as { metadata: Metadata; serverAddress: string };
  const nonce = parsed.searchParams.get('application_name')?.replace(/^stage_w_/, '') ?? '';
  parsed.hash = ''; parsed.searchParams.delete('application_name');
  return { url: parsed.toString(), metadata: binding.metadata, nonce, serverAddress: binding.serverAddress };
}

function validateFixtureEnvelope(kind: string, requestPath: string, body: Record<string, unknown>): void {
  if (kind === 'commit') {
    if (!/^\/repos\/mayf3\/dsh-agent-core\/commits\/(?:main|[0-9a-f]{40})$/.test(requestPath)) fail('commit request path invalid');
    lowercaseHex(body.sha, 40, 'fixture commit sha');
    return;
  }
  if (kind === 'compare') {
    const match = /^\/repos\/mayf3\/dsh-agent-core\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/.exec(requestPath);
    if (!match || body.url !== canonicalApi(requestPath) || !isObject(body.base_commit)
        || !isObject(body.merge_base_commit) || body.base_commit.sha !== match[1]
        || body.merge_base_commit.sha !== match[1] || body.behind_by !== 0
        || (body.status !== 'ahead' && body.status !== 'identical')) fail('compare fixture envelope invalid');
    return;
  }
  if (kind === 'contents-manifest' || kind === 'contents-receipt') {
    const match = /^\/repos\/mayf3\/dsh-agent-core\/contents\/(.+)\?ref=([0-9a-f]{40})$/.exec(requestPath);
    if (!match) fail('Contents fixture path invalid');
    const expectedPath = match[1].split('/').map(decodeURIComponent).join('/');
    const decodedLimit = kind === 'contents-manifest' ? 1024 * 1024 : 256 * 1024;
    if (body.type !== 'file' || body.path !== expectedPath || body.url !== canonicalApi(requestPath)
        || body.encoding !== 'base64' || typeof body.content !== 'string' || !Number.isInteger(body.size)
        || (body.size as number) < 1 || (body.size as number) > decodedLimit) fail('Contents fixture envelope invalid');
    const compact = body.content.replace(/\n/g, '');
    const decoded = canonicalBase64(compact);
    if (decoded.length !== body.size) fail('Contents fixture base64 invalid');
    return;
  }
  if (kind === 'review') {
    const match = /^\/repos\/mayf3\/auth-service\/pulls\/(\d+)\/reviews\/(\d+)$/.exec(requestPath);
    if (!match || body.id !== Number(match[2])
        || body.html_url !== `https://github.com/mayf3/auth-service/pull/${match[1]}#pullrequestreview-${match[2]}`
        || body.pull_request_url !== `https://api.github.com/repos/mayf3/auth-service/pulls/${match[1]}`) fail('review fixture envelope invalid');
    return;
  }
  if (kind === 'comment') {
    const match = /^\/repos\/mayf3\/auth-service\/issues\/comments\/(\d+)$/.exec(requestPath);
    if (!match || body.id !== Number(match[1]) || typeof body.html_url !== 'string' || typeof body.issue_url !== 'string') fail('comment fixture envelope invalid');
    const html = /^https:\/\/github\.com\/mayf3\/auth-service\/(?:pull|issues)\/(\d+)#issuecomment-(\d+)$/.exec(body.html_url);
    if (!html || html[2] !== match[1] || body.issue_url !== `https://api.github.com/repos/mayf3/auth-service/issues/${html[1]}`) fail('comment fixture binding invalid');
    return;
  }
  fail('unknown fixture envelope kind');
}

function validateHttpFixture(value: Json): void {
  if (!isObject(value)) fail('HTTP fixture must be an object');
  exactKeys(value, ['schema_version', 'kind', 'request_path', 'tls_authorized', 'elapsed_ms', 'status_code', 'headers', 'chunks_base64', 'terminal', 'error_code'], 'HTTP fixture');
  const kinds = ['commit', 'compare', 'contents-manifest', 'contents-receipt', 'review', 'comment'];
  if (value.schema_version !== 1 || !kinds.includes(value.kind as string)
      || typeof value.request_path !== 'string' || !value.request_path.startsWith('/repos/')
      || typeof value.tls_authorized !== 'boolean' || !Number.isInteger(value.elapsed_ms) || (value.elapsed_ms as number) < 0
      || !Number.isInteger(value.status_code) || (value.status_code as number) < 100 || (value.status_code as number) > 599
      || !isObject(value.headers) || !Array.isArray(value.chunks_base64)
      || !['end', 'timeout', 'tls_error', 'premature_close', 'socket_error'].includes(value.terminal as string)
      || !(value.error_code === null || (typeof value.error_code === 'string' && value.error_code.length > 0))) fail('HTTP fixture fields invalid');
  const headerEntries = Object.entries(value.headers);
  if (headerEntries.some(([key, item]) => key !== key.toLowerCase() || typeof item !== 'string')) fail('HTTP fixture headers invalid');
  const limit = value.kind === 'compare' ? 16 * 1024 * 1024
    : value.kind === 'contents-receipt' ? 512 * 1024 : 2 * 1024 * 1024;
  const chunks: Buffer[] = []; let size = 0;
  for (const item of value.chunks_base64 as unknown[]) {
    if (typeof item !== 'string') fail('HTTP fixture chunk invalid');
    size = appendHttpChunk(chunks, size, canonicalBase64(item), limit);
  }
  validateHttpState({
    kind: value.kind as string, path: value.request_path as string, limit,
    tlsAuthorized: value.tls_authorized as boolean, elapsedMs: value.elapsed_ms as number,
    statusCode: value.status_code as number, headers: value.headers as Record<string, string>,
    chunks, terminal: value.terminal as string,
  });
  process.stdout.write(`${JSON.stringify({ conformance_http: true, host: API_HOST, port: API_PORT, path: value.request_path })}\n`);
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  const values = new Set(['--evidence-commit', '--evidence-path', '--descriptor-fd', '--fixture-fd']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--') || Object.hasOwn(result, arg)) fail(`unknown or duplicate argument ${arg}`);
    if (values.has(arg)) {
      const next = argv[++index];
      if (next === undefined || next.startsWith('--')) fail(`${arg} requires a value`);
      result[arg] = next;
    } else if (['--apply', '--validate-evidence', '--conformance-apply', '--conformance-http'].includes(arg)) result[arg] = true;
    else fail(`unknown argument ${arg}`);
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--apply', '--validate-evidence', '--conformance-apply', '--conformance-http'].filter((key) => args[key] === true);
  if (modes.length > 1) fail('execution modes are mutually exclusive');
  if (args['--conformance-http']) {
    if (process.env.DATABASE_URL !== undefined || Object.keys(args).some((key) => !['--conformance-http', '--fixture-fd'].includes(key))) fail('HTTP conformance accepts no DB/evidence/apply input');
    validateHttpFixture(readFifo(args['--fixture-fd'] as string | undefined, 'HTTP fixture', 24 * 1024 * 1024));
    return;
  }
  if (args['--conformance-apply']) {
    if (process.env.DATABASE_URL !== undefined || Object.keys(args).some((key) => !['--conformance-apply', '--descriptor-fd'].includes(key))) fail('DB conformance accepts only its FIFO descriptor');
    const descriptor = readFifo(args['--descriptor-fd'] as string | undefined, 'conformance');
    if (!isObject(descriptor)) fail('conformance descriptor must be object');
    const encoded = conformanceUrl(descriptor);
    const { url, metadata, nonce, serverAddress } = parseConformanceUrl(encoded);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const probe = await prisma.$queryRaw<Array<{ database: string; address: string; port: number; nonce: string }>>`
        SELECT current_database() AS database, inet_server_addr()::text AS address,
               inet_server_port() AS port, current_setting('stage_w.conformance_nonce') AS nonce`;
      if (probe.length !== 1 || probe[0].database !== DATABASE || probe[0].nonce !== nonce || probe[0].port !== 5432
          || probe[0].address !== serverAddress) fail('connected server identity is invalid');
      report(await applyStage(prisma, metadata), 'conformance-apply');
    } finally { await prisma.$disconnect(); }
    return;
  }
  const evidenceCommit = args['--evidence-commit'] as string | undefined;
  const evidencePath = args['--evidence-path'] as string | undefined;
  if (args['--validate-evidence'] || args['--apply']) {
    if (!evidenceCommit || !evidencePath || Object.keys(args).some((key) => !['--validate-evidence', '--apply', '--evidence-commit', '--evidence-path'].includes(key))) fail('exact evidence arguments are required');
    const metadata = await validateEvidence(evidenceCommit, evidencePath);
    if (args['--validate-evidence']) { process.stdout.write('STAGE_W_EVIDENCE_VALID=true\n'); return; }
    if (!process.env.DATABASE_URL) fail('DATABASE_URL is required only after evidence validation');
    const prisma = new PrismaClient();
    try { report(await applyStage(prisma, metadata), 'apply'); } finally { await prisma.$disconnect(); }
    return;
  }
  if (Object.keys(args).length !== 0) fail('plan accepts no arguments');
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for read-only plan');
  const prisma = new PrismaClient();
  try { report(await loadStagePlan(prisma), 'plan'); } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
