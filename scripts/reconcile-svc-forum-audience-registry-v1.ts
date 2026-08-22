import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, fstatSync, readSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

// svc-forum Audience Registry Reconciliation V1.
// The production auth_audiences row for svc-forum carries the unique registry
// drift registered_scopes = [forum.read, forum.write, forum.moderate]; every
// other field still matches the entry frozen by AUTH_SERVICE_SVC_FORUM_
// AUDIENCE_CCR_V1 CTR-FR-002 (bundle registry_version 1.3.0). The drift makes
// v1 direct mint fail closed at audience_registry_mismatch:registered_scopes.
// This script reconciles the single column to the frozen target
// [forum.read, forum.write] inside one Serializable transaction that also
// writes the durable auth_security_audits record, or reports NOOP when the
// exact target state plus the exact matching reconciliation audit already
// exist. Offline: no network access of any kind. Mirrors the Stage W / Stage F
// three-file offline execution form (scripts/supply-agentcore-canary-*-v1.ts).

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
type Plan = {
  outcome: 'reconcile' | 'noop';
  beforeValue: Prisma.InputJsonObject;
  afterValue: Prisma.InputJsonObject;
};

const TASK = 'svc-forum-audience-registry-reconciliation-v1';
const AUDIENCE_ID = 'svc-forum';
const TARGET_SCOPES = Object.freeze(['forum.read', 'forum.write']);
const DRIFT_SCOPES = Object.freeze(['forum.moderate', 'forum.read', 'forum.write']);
const FORBIDDEN_LITERAL_SCOPES = Object.freeze(['forum.moderate', 'forum.admin']);
const AUDIT_EVENT_TYPE = 'audience.registry_reconciled';
const AUDIT_RESULT = 'success';
const AUDIT_DETAIL_KEYS = Object.freeze([
  'migration_id', 'source_git_commit', 'operator_id', 'approval_ref',
  'reason', 'before_value', 'after_value',
]);
const SNAPSHOT_KEYS = Object.freeze([
  'audience_id', 'resource_service', 'scope_namespace', 'accepted_principal_types',
  'registered_scopes', 'human_access_enabled', 'machine_access_enabled',
  'delegated_access_enabled', 'status', 'freeze_ready', 'version',
  'created_at', 'updated_at',
]);
const CANARY_CLIENT_EXTERNAL_REFS = Object.freeze([
  'agentcore:v1:client:agt_stock_agent',
  'agentcore:v1:client:agt_cto-agent',
]);
// Distinct from Stage W (813_947_201) and Stage F (813_947_202).
const ADVISORY_LOCK_KEY = 813_947_203;

const IMAGE = 'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777';
const DATABASE = 'auth_svc_forum_reconcile_conformance';
const RUNNER_ROLE = 'svc_forum_reconcile_runner';
const CONTAINER_LABEL = 'com.mayf3.auth.svc-forum-reconcile-conformance';
const CONTAINER_NAME_PREFIX = 'auth-svc-forum-reconcile-conformance-';
const NONCE_SETTING = 'svc_forum_reconcile.conformance_nonce';

type AudienceRow = {
  audienceId: string;
  resourceService: string;
  scopeNamespace: string;
  acceptedPrincipalTypes: string[];
  registeredScopes: string[];
  humanAccessEnabled: boolean;
  machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean;
  status: string;
  freezeReady: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
const AUDIENCE_SELECT = {
  audienceId: true, resourceService: true, scopeNamespace: true,
  acceptedPrincipalTypes: true, registeredScopes: true, humanAccessEnabled: true,
  machineAccessEnabled: true, delegatedAccessEnabled: true, status: true,
  freezeReady: true, version: true, createdAt: true, updatedAt: true,
} as const;

function fail(message: string): never {
  throw new Error(`Reconciliation refused: ${message}`);
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
function lowercaseHex(value: unknown, length: number, label: string): string {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    fail(`${label} must be lowercase ${length}-hex`);
  }
  return value;
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
function sortedScopes(scopes: readonly string[]): string[] {
  return [...scopes].sort(asciiCompare);
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

// Complete Audience row snapshot; arrays canonicalized to unsigned ASCII order.
function audienceSnapshot(row: AudienceRow): Prisma.InputJsonObject {
  const snapshot = {
    audience_id: row.audienceId,
    resource_service: row.resourceService,
    scope_namespace: row.scopeNamespace,
    accepted_principal_types: sortedScopes(row.acceptedPrincipalTypes),
    registered_scopes: sortedScopes(row.registeredScopes),
    human_access_enabled: row.humanAccessEnabled,
    machine_access_enabled: row.machineAccessEnabled,
    delegated_access_enabled: row.delegatedAccessEnabled,
    status: row.status,
    freeze_ready: row.freezeReady,
    version: row.version,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
  exactKeys(snapshot, SNAPSHOT_KEYS, 'audience snapshot');
  return snapshot;
}

function validateMetadata(metadata: Metadata): void {
  text(metadata.migrationId, 'migration_id', 128);
  lowercaseHex(metadata.sourceGitCommit, 40, 'source_git_commit');
  text(metadata.operatorId, 'operator_id', 256);
  text(metadata.approvalRef, 'approval_ref', 2048);
  text(metadata.reason, 'reason', 512);
}

async function verifyGrantPreconditions(db: Db): Promise<void> {
  const grants = await db.machineAccessGrant.findMany({
    select: { machineClientId: true, audienceId: true, scopes: true },
  });
  for (const grant of grants) {
    for (const scope of grant.scopes) {
      if (FORBIDDEN_LITERAL_SCOPES.includes(scope) || scope.includes('*')) {
        fail(`machine grant for audience ${grant.audienceId} contains forbidden scope ${scope}`);
      }
    }
  }
  const humanGrants = await db.humanAudienceGrant.count({ where: { audienceId: AUDIENCE_ID } });
  if (humanGrants !== 0) fail('svc-forum must carry no Human Audience Grant');
  const delegationGrants = await db.delegationGrant.count({ where: { audienceId: AUDIENCE_ID } });
  if (delegationGrants !== 0) fail('svc-forum must carry no Delegation Grant');

  const clients = await db.machineClient.findMany({
    where: { externalRef: { in: [...CANARY_CLIENT_EXTERNAL_REFS] } },
    select: { id: true, clientId: true, externalRef: true },
  });
  for (const externalRef of CANARY_CLIENT_EXTERNAL_REFS) {
    const resolved = clients.filter((client) => client.externalRef === externalRef);
    if (resolved.length !== 1) fail(`canary client ${externalRef} must resolve exactly once`);
    const forumGrants = grants.filter((grant) => grant.machineClientId === resolved[0].id
      && grant.audienceId === AUDIENCE_ID);
    if (forumGrants.length !== 1) {
      fail(`canary client ${externalRef} must hold exactly one svc-forum machine grant`);
    }
    if (!sameJson(sortedScopes(forumGrants[0].scopes), sortedScopes(TARGET_SCOPES))) {
      fail(`canary client ${externalRef} svc-forum grant must be exactly forum.read and forum.write`);
    }
  }
}

async function loadPlan(db: Db, metadata: Metadata | null): Promise<Plan> {
  const rows = await db.authAudience.findMany({
    where: { audienceId: AUDIENCE_ID },
    select: AUDIENCE_SELECT,
  });
  if (rows.length !== 1) fail('svc-forum must resolve exactly once');
  const row = rows[0];
  if (row.resourceService !== AUDIENCE_ID) fail('svc-forum resource_service does not match the frozen precondition');
  if (row.scopeNamespace !== 'forum') fail('svc-forum scope_namespace does not match the frozen precondition');
  if (!sameJson(sortedScopes(row.acceptedPrincipalTypes), ['agent'])
      || row.acceptedPrincipalTypes.length !== 1) {
    fail('svc-forum accepted_principal_types must be exactly [agent]');
  }
  if (row.humanAccessEnabled !== false) fail('svc-forum human_access_enabled must be false');
  if (row.machineAccessEnabled !== true) fail('svc-forum machine_access_enabled must be true');
  if (row.delegatedAccessEnabled !== false) fail('svc-forum delegated_access_enabled must be false');
  if (row.status !== 'active') fail('svc-forum status must be active');
  if (row.freezeReady !== true) fail('svc-forum freeze_ready must be true');
  if (row.version !== 1) fail('svc-forum version must be 1');

  await verifyGrantPreconditions(db);

  const beforeValue = audienceSnapshot(row);
  const scopes = sortedScopes(row.registeredScopes);
  if (sameJson(scopes, sortedScopes(TARGET_SCOPES))) {
    // Target state: only an exactly matching reconciliation audit permits NOOP.
    const audits = await db.authSecurityAudit.findMany({
      where: { eventType: AUDIT_EVENT_TYPE },
      select: { result: true, details: true, timestamp: true },
    });
    if (audits.length !== 1) {
      fail(`svc-forum is at the target state but ${audits.length} reconciliation audits exist (expected exactly 1)`);
    }
    const audit = audits[0];
    if (audit.result !== AUDIT_RESULT) fail('existing reconciliation audit result is not success');
    const details = audit.details;
    if (!isObject(details)) fail('existing reconciliation audit details must be an object');
    exactKeys(details, AUDIT_DETAIL_KEYS, 'reconciliation audit details');
    if (metadata !== null && (details.migration_id !== metadata.migrationId
      || details.source_git_commit !== metadata.sourceGitCommit
      || details.operator_id !== metadata.operatorId
      || details.approval_ref !== metadata.approvalRef
      || details.reason !== metadata.reason)) {
      fail('existing reconciliation audit metadata does not match this execution');
    }
    const afterValue = audienceSnapshot(row);
    if (!sameJson(details.after_value, afterValue)) {
      fail('existing reconciliation audit after_value does not equal the current target snapshot');
    }
    const expectedBefore = { ...afterValue, registered_scopes: sortedScopes(DRIFT_SCOPES) };
    if (!sameJson(details.before_value, expectedBefore)) {
      fail('existing reconciliation audit before_value is not the exact drift snapshot');
    }
    return { outcome: 'noop', beforeValue: expectedBefore, afterValue };
  }
  if (!sameJson(scopes, sortedScopes(DRIFT_SCOPES))) {
    fail('svc-forum registered_scopes is neither the exact drift set (forum.read, forum.write, forum.moderate) nor the exact target set (forum.read, forum.write)');
  }
  const priorAudits = await db.authSecurityAudit.findMany({
    where: { eventType: AUDIT_EVENT_TYPE },
    select: { id: true },
  });
  if (priorAudits.length !== 0) {
    fail('svc-forum is in drift state but reconciliation audits already exist');
  }
  const afterValue = { ...beforeValue, registered_scopes: sortedScopes(TARGET_SCOPES) };
  exactKeys(afterValue, SNAPSHOT_KEYS, 'target audience snapshot');
  return { outcome: 'reconcile', beforeValue, afterValue };
}

async function applyReconcile(prisma: PrismaClient, metadata: Metadata): Promise<Plan> {
  validateMetadata(metadata);
  return prisma.$transaction(async (tx) => {
    // Table locks first, advisory last (Stage W/F form). Every table the
    // frozen preconditions read is locked against row writers, so a
    // concurrent writer either commits before the Serializable snapshot is
    // taken at the first SELECT below (visible to the plan → conflict) or
    // blocks until after the reconciliation commits. The advisory lock then
    // serializes cooperating reconciliation operators.
    await tx.$executeRawUnsafe('LOCK TABLE auth_audiences IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE auth_security_audits IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE delegation_grants IN SHARE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE human_audience_grants IN SHARE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE machine_access_grants IN SHARE MODE');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;
    const plan = await loadPlan(tx, metadata);
    if (plan.outcome === 'noop') return plan;

    // Single-column write: registered_scopes only — version and every other
    // column (including updated_at) are not set and stay byte-identical.
    const updated = await tx.$executeRawUnsafe(
      'UPDATE auth_audiences SET registered_scopes = ARRAY[$1, $2]::text[] WHERE audience_id = $3 AND version = 1',
      TARGET_SCOPES[0], TARGET_SCOPES[1], AUDIENCE_ID,
    );
    if (updated !== 1) fail('svc-forum update did not affect exactly one row');

    const rows = await tx.authAudience.findMany({
      where: { audienceId: AUDIENCE_ID },
      select: AUDIENCE_SELECT,
    });
    if (rows.length !== 1) fail('svc-forum must still resolve exactly once after the update');
    const afterValue = audienceSnapshot(rows[0]);
    if (!sameJson(afterValue, plan.afterValue)) {
      fail('post-update Audience row does not equal the frozen target snapshot');
    }

    const details = {
      migration_id: metadata.migrationId,
      source_git_commit: metadata.sourceGitCommit,
      operator_id: metadata.operatorId,
      approval_ref: metadata.approvalRef,
      reason: metadata.reason,
      before_value: plan.beforeValue,
      after_value: afterValue,
    };
    exactKeys(details, AUDIT_DETAIL_KEYS, 'reconciliation audit details');
    await tx.authSecurityAudit.create({
      data: {
        id: randomUUID(),
        eventType: AUDIT_EVENT_TYPE,
        result: AUDIT_RESULT,
        details,
        timestamp: new Date(),
      },
    });
    return { outcome: 'reconcile', beforeValue: plan.beforeValue, afterValue };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function report(plan: Plan, operation: string): void {
  process.stdout.write(`${JSON.stringify({
    task: TASK,
    operation,
    outcome: plan.outcome,
    audience: AUDIENCE_ID,
    audience_rows_updated: plan.outcome === 'reconcile' ? 1 : 0,
    audits_created: plan.outcome === 'reconcile' ? 1 : 0,
    registered_scopes_before: plan.beforeValue.registered_scopes,
    registered_scopes_after: plan.afterValue.registered_scopes,
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
  if (descriptor.database !== DATABASE) fail('descriptor database is not the conformance database');
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
      || typeof info.Name !== 'string' || !info.Name.startsWith(`/${CONTAINER_NAME_PREFIX}`)
      || !isObject(labels) || labels[CONTAINER_LABEL] !== `sha256:${createHash('sha256').update(nonce).digest('hex')}`
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
  return `postgresql://${RUNNER_ROLE}@127.0.0.1:${descriptor.host_port}/${DATABASE}?schema=public&application_name=svc_forum_reconcile_${nonce}#${Buffer.from(JSON.stringify(privateBinding)).toString('base64url')}`;
}

function parseConformanceUrl(value: string): { url: string; metadata: Metadata; nonce: string; serverAddress: string } {
  const parsed = new URL(value);
  const binding = JSON.parse(Buffer.from(parsed.hash.slice(1), 'base64url').toString('utf8')) as { metadata: Metadata; serverAddress: string };
  const nonce = parsed.searchParams.get('application_name')?.replace(/^svc_forum_reconcile_/, '') ?? '';
  parsed.hash = ''; parsed.searchParams.delete('application_name');
  return { url: parsed.toString(), metadata: binding.metadata, nonce, serverAddress: binding.serverAddress };
}

const APPLY_METADATA_FLAGS = ['--migration-id', '--source-git-commit', '--operator-id', '--approval-ref', '--reason'] as const;

function parseArgs(argv: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  const values = new Set<string>([...APPLY_METADATA_FLAGS, '--descriptor-fd']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--') || Object.hasOwn(result, arg)) fail(`unknown or duplicate argument ${arg}`);
    if (values.has(arg)) {
      const next = argv[++index];
      if (next === undefined || next.startsWith('--')) fail(`${arg} requires a value`);
      result[arg] = next;
    } else if (arg === '--apply' || arg === '--conformance-apply') result[arg] = true;
    else fail(`unknown argument ${arg}`);
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--apply', '--conformance-apply'].filter((key) => args[key] === true);
  if (modes.length > 1) fail('execution modes are mutually exclusive');

  if (args['--conformance-apply']) {
    if (process.env.DATABASE_URL !== undefined
        || Object.keys(args).some((key) => !['--conformance-apply', '--descriptor-fd'].includes(key))) {
      fail('DB conformance accepts only its FIFO descriptor');
    }
    const descriptor = readFifo(args['--descriptor-fd'] as string | undefined, 'conformance');
    if (!isObject(descriptor)) fail('conformance descriptor must be an object');
    const encoded = conformanceUrl(descriptor);
    const { url, metadata, nonce, serverAddress } = parseConformanceUrl(encoded);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const probe = await prisma.$queryRaw<Array<{ database: string; address: string; port: number; nonce: string }>>`
        SELECT current_database() AS database, inet_server_addr()::text AS address,
               inet_server_port() AS port, current_setting(${NONCE_SETTING}) AS nonce`;
      if (probe.length !== 1 || probe[0].database !== DATABASE || probe[0].nonce !== nonce || probe[0].port !== 5432
          || probe[0].address !== serverAddress) fail('connected server identity is invalid');
      report(await applyReconcile(prisma, metadata), 'conformance-apply');
    } finally { await prisma.$disconnect(); }
    return;
  }

  if (args['--apply']) {
    const keys = Object.keys(args);
    if (keys.some((key) => key !== '--apply' && !(APPLY_METADATA_FLAGS as readonly string[]).includes(key))
        || (APPLY_METADATA_FLAGS as readonly string[]).some((flag) => typeof args[flag] !== 'string')) {
      fail('apply requires exactly the five audit metadata arguments');
    }
    const metadata: Metadata = {
      migrationId: args['--migration-id'] as string,
      sourceGitCommit: args['--source-git-commit'] as string,
      operatorId: args['--operator-id'] as string,
      approvalRef: args['--approval-ref'] as string,
      reason: args['--reason'] as string,
    };
    validateMetadata(metadata);
    if (cleanHead() !== metadata.sourceGitCommit) {
      fail('source_git_commit must equal the clean worktree HEAD');
    }
    if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for apply');
    const prisma = new PrismaClient();
    try { report(await applyReconcile(prisma, metadata), 'apply'); } finally { await prisma.$disconnect(); }
    return;
  }

  if (Object.keys(args).length !== 0) fail('plan accepts no arguments');
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for read-only plan');
  const prisma = new PrismaClient();
  try { report(await loadPlan(prisma, null), 'plan'); } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
