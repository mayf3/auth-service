import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, fstatSync, readSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

// svc-forum Legacy Grant Narrowing V1.
// AUTH_SERVICE_SVC_FORUM_LEGACY_GRANT_NARROWING_V1 (frozen by this Spec).
// Production carries exactly one machine_access_grants row whose scopes include
// the CCR-forbidden literal forum.moderate: the legacy openclaw client
// mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd (internal id b4f209b3-968c-4bf2-8aac-4b9528752e75)
// holds svc-forum [forum.read, forum.write, forum.moderate] at version 1. That
// row is the unique blocker of the sister reconciliation tool's CTR-RR-003
// precondition 4. This script narrows that single row to the frozen target
// [forum.read, forum.write] with version 1 -> 2 inside one Serializable
// transaction that also writes the durable grant_change_audits 'replace'
// record (expected 1 -> resulting 2, complete Stage-F-form client snapshots),
// or reports NOOP when the exact target state plus the exact matching audit
// already exist. Offline: no network access of any kind. Mirrors the
// three-file offline execution form (reconcile-svc-forum-audience-registry-v1 /
// supply-agentcore-canary-*-v1).

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
type GrantRow = {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
type Plan = {
  outcome: 'replace' | 'noop';
  internalClientId: string;
  otherGrants: GrantRow[];
  beforeValue: Prisma.InputJsonObject;
  afterValue: Prisma.InputJsonObject;
};

const TASK = 'svc-forum-legacy-grant-narrowing-v1';
const TARGET_CLIENT_ID = 'mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd';
const TARGET_CLIENT_INTERNAL_ID = 'b4f209b3-968c-4bf2-8aac-4b9528752e75';
const TARGET_PRINCIPAL_ID = '132ab857-35ab-408b-b909-bc0b1deab55b';
const AUDIENCE_ID = 'svc-forum';
const TARGET_SCOPES = Object.freeze(['forum.read', 'forum.write']);
const DRIFT_SCOPES = Object.freeze(['forum.moderate', 'forum.read', 'forum.write']);
const EXPECTED_GRANT_VERSION = 1;
const RESULTING_GRANT_VERSION = 2;
// Distinct from Stage W (813_947_201), Stage F (813_947_202), reconciliation (813_947_203).
const ADVISORY_LOCK_KEY = 813_947_204;

const IMAGE = 'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777';
const DATABASE = 'auth_svc_forum_narrow_conformance';
const RUNNER_ROLE = 'svc_forum_narrow_runner';
const CONTAINER_LABEL = 'com.mayf3.auth.svc-forum-narrow-conformance';
const CONTAINER_NAME_PREFIX = 'auth-svc-forum-narrow-conformance-';
const NONCE_SETTING = 'svc_forum_narrow.conformance_nonce';

function fail(message: string): never {
  throw new Error(`Narrowing refused: ${message}`);
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
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf-8') > maxBytes) {
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

// Complete client snapshot in the frozen Stage W/F grant_change_audits form.
// `forumScopes` projects the svc-forum entry so the same observed grant set can
// express both the drift (before) and target (after) snapshots.
function completeSnapshot(client: {
  clientId: string;
  machinePrincipalId: string;
  status: string;
  principalType: string;
}, grants: readonly GrantRow[], forumScopes: readonly string[], revision: number): Prisma.InputJsonObject {
  const machineAccessGrants: Record<string, Prisma.InputJsonValue> = {};
  for (const grant of [...grants].sort((a, b) => asciiCompare(a.audienceId, b.audienceId))) {
    machineAccessGrants[grant.audienceId] = sortedScopes(
      grant.audienceId === AUDIENCE_ID ? forumScopes : grant.scopes,
    );
  }
  return {
    client_id: client.clientId,
    client_kind: 'machine',
    principal_id: client.machinePrincipalId,
    principal_type: client.principalType,
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

type ResolvedClient = {
  internalClientId: string;
  snapshotClient: { clientId: string; machinePrincipalId: string; status: string; principalType: string };
  grants: GrantRow[];
  forumGrant: GrantRow;
};

async function resolveTarget(db: Db): Promise<ResolvedClient> {
  const clients = await db.machineClient.findMany({
    where: { clientId: TARGET_CLIENT_ID },
    select: {
      id: true,
      clientId: true,
      machinePrincipalId: true,
      status: true,
      revokedAt: true,
      principal: { select: { id: true, principalType: true, status: true, disabledAt: true } },
      accessGrants: {
        select: {
          machineClientId: true, audienceId: true, scopes: true, version: true,
          createdAt: true, updatedAt: true,
        },
      },
      trustedProxy: { select: { delegationGrants: { select: { audienceId: true } } } },
    },
  });
  if (clients.length !== 1) fail('target client must resolve exactly once');
  const client = clients[0];
  if (client.id !== TARGET_CLIENT_INTERNAL_ID) {
    fail('target client internal id does not equal the frozen precondition');
  }
  if (client.machinePrincipalId !== TARGET_PRINCIPAL_ID
      || client.principal === null || client.principal.id !== TARGET_PRINCIPAL_ID) {
    fail('target client principal binding does not equal the frozen precondition');
  }
  if (client.principal.disabledAt !== null) {
    fail('PRINCIPAL_DISABLED: target principal disabled_at must be null');
  }
  if (client.principal.status !== 'active') {
    fail('PRINCIPAL_INACTIVE: target principal status must be active');
  }
  if (client.status !== 'active') fail('target client status must be active');
  if (client.revokedAt !== null) fail('target client must not be revoked');
  if (client.trustedProxy !== null && client.trustedProxy.delegationGrants.length !== 0) {
    fail('target client carries delegation grants outside the narrowing precondition');
  }
  const forumGrants = client.accessGrants.filter((grant) => grant.audienceId === AUDIENCE_ID);
  if (forumGrants.length !== 1) fail('target client must hold exactly one svc-forum machine grant');
  return {
    internalClientId: client.id,
    snapshotClient: {
      clientId: client.clientId,
      machinePrincipalId: client.machinePrincipalId,
      status: client.status,
      principalType: client.principal.principalType,
    },
    grants: client.accessGrants,
    forumGrant: forumGrants[0],
  };
}

function sameGrantRow(a: GrantRow, b: GrantRow): boolean {
  return a.machineClientId === b.machineClientId
    && a.audienceId === b.audienceId
    && sameJson(sortedScopes(a.scopes), sortedScopes(b.scopes))
    && a.version === b.version
    && a.createdAt.getTime() === b.createdAt.getTime()
    && a.updatedAt.getTime() === b.updatedAt.getTime();
}

async function loadPlan(db: Db, metadata: Metadata | null): Promise<Plan> {
  const target = await resolveTarget(db);
  const scopes = sortedScopes(target.forumGrant.scopes);
  const otherGrants = target.grants.filter((grant) => grant.audienceId !== AUDIENCE_ID);
  const beforeValue = completeSnapshot(target.snapshotClient, target.grants, DRIFT_SCOPES, EXPECTED_GRANT_VERSION);
  const afterValue = completeSnapshot(target.snapshotClient, target.grants, TARGET_SCOPES, RESULTING_GRANT_VERSION);

  if (sameJson(scopes, sortedScopes(TARGET_SCOPES))) {
    // Target state: only an exactly matching replace audit permits NOOP.
    if (target.forumGrant.version !== RESULTING_GRANT_VERSION) {
      fail(`target client svc-forum grant version must be ${RESULTING_GRANT_VERSION} at the target scopes (found ${target.forumGrant.version})`);
    }
    const audits = await db.grantChangeAudit.findMany({
      where: { clientId: TARGET_CLIENT_ID, changeType: 'replace' },
      select: {
        migrationId: true, sourceGitCommit: true, operatorId: true, approvalRef: true,
        reason: true, expectedGrantVersion: true, resultingGrantVersion: true,
        beforeValue: true, afterValue: true,
      },
    });
    if (audits.length !== 1) {
      fail(`target client is at the target scopes but ${audits.length} replace audits exist (expected exactly 1)`);
    }
    const audit = audits[0];
    if (audit.expectedGrantVersion !== EXPECTED_GRANT_VERSION
        || audit.resultingGrantVersion !== RESULTING_GRANT_VERSION) {
      fail('existing replace audit version envelope is invalid');
    }
    if (metadata !== null && (audit.migrationId !== metadata.migrationId
        || audit.sourceGitCommit !== metadata.sourceGitCommit
        || audit.operatorId !== metadata.operatorId
        || audit.approvalRef !== metadata.approvalRef
        || audit.reason !== metadata.reason)) {
      fail('existing replace audit metadata does not match this execution');
    }
    if (!sameJson(audit.beforeValue, beforeValue)) {
      fail('existing replace audit before_value is not the exact drift snapshot');
    }
    if (!sameJson(audit.afterValue, afterValue)) {
      fail('existing replace audit after_value does not equal the current target snapshot');
    }
    return { outcome: 'noop', internalClientId: target.internalClientId, otherGrants, beforeValue, afterValue };
  }

  if (!sameJson(scopes, sortedScopes(DRIFT_SCOPES))) {
    fail(`target client svc-forum grant scopes must be exactly the drift set (forum.read, forum.write, forum.moderate) or the target set (forum.read, forum.write); found [${scopes.join(', ')}]`);
  }
  if (target.forumGrant.version !== EXPECTED_GRANT_VERSION) {
    fail(`target client svc-forum grant version must be ${EXPECTED_GRANT_VERSION} in the drift state (found ${target.forumGrant.version})`);
  }
  const priorReplaceAudits = await db.grantChangeAudit.findMany({
    where: { clientId: TARGET_CLIENT_ID, changeType: 'replace' },
    select: { id: true },
  });
  if (priorReplaceAudits.length !== 0) {
    fail('target client is in the drift state but replace audits already exist');
  }
  return { outcome: 'replace', internalClientId: target.internalClientId, otherGrants, beforeValue, afterValue };
}

async function applyNarrow(prisma: PrismaClient, metadata: Metadata): Promise<Plan> {
  validateMetadata(metadata);
  return prisma.$transaction(async (tx) => {
    // Table locks first, advisory last (Stage W/F/reconcile form): every table
    // the frozen preconditions read is locked before the Serializable snapshot
    // is taken at the first SELECT below, and the two written tables take write
    // conflict locks. The advisory lock serializes cooperating operators.
    await tx.$executeRawUnsafe('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE machine_clients IN SHARE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE machine_principals IN SHARE MODE');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;
    const plan = await loadPlan(tx, metadata);
    if (plan.outcome === 'noop') return plan;

    // Single-row write: scopes and version only. Every other column (including
    // created_at and updated_at) is not set and stays byte-identical; every
    // other grant row is not written at all.
    const updated = await tx.$executeRawUnsafe(
      'UPDATE machine_access_grants SET scopes = ARRAY[$1, $2]::text[], version = $3 '
        + 'WHERE machine_client_id = $4::uuid AND audience_id = $5 AND version = $6',
      TARGET_SCOPES[0], TARGET_SCOPES[1], RESULTING_GRANT_VERSION,
      plan.internalClientId, AUDIENCE_ID, EXPECTED_GRANT_VERSION,
    );
    if (updated !== 1) fail('target grant update did not affect exactly one row');

    const after = await resolveTarget(tx);
    if (after.forumGrant.version !== RESULTING_GRANT_VERSION
        || !sameJson(sortedScopes(after.forumGrant.scopes), sortedScopes(TARGET_SCOPES))) {
      fail('post-update target grant does not equal the frozen target state');
    }
    const othersAfter = after.grants.filter((grant) => grant.audienceId !== AUDIENCE_ID);
    if (othersAfter.length !== plan.otherGrants.length
        || othersAfter.some((grant) => {
          const before = plan.otherGrants.find((row) => row.audienceId === grant.audienceId);
          return before === undefined || !sameGrantRow(grant, before);
        })) {
      fail('post-update grant set changed beyond the single target row');
    }
    const verifiedAfterValue = completeSnapshot(after.snapshotClient, after.grants, TARGET_SCOPES, RESULTING_GRANT_VERSION);
    if (!sameJson(verifiedAfterValue, plan.afterValue)) {
      fail('post-update client snapshot does not equal the frozen target snapshot');
    }

    const auditId = randomUUID();
    const timestamp = new Date();
    await tx.grantChangeAudit.create({
      data: {
        id: auditId,
        migrationId: metadata.migrationId,
        sourceGitCommit: metadata.sourceGitCommit,
        operatorId: metadata.operatorId,
        approvalRef: metadata.approvalRef,
        reason: metadata.reason,
        clientId: TARGET_CLIENT_ID,
        changeType: 'replace',
        expectedGrantVersion: EXPECTED_GRANT_VERSION,
        resultingGrantVersion: RESULTING_GRANT_VERSION,
        beforeValue: plan.beforeValue,
        afterValue: verifiedAfterValue,
        timestamp,
      },
    });

    const persisted = await tx.grantChangeAudit.findUnique({ where: { id: auditId } });
    if (persisted === null
        || persisted.clientId !== TARGET_CLIENT_ID
        || persisted.changeType !== 'replace'
        || persisted.expectedGrantVersion !== EXPECTED_GRANT_VERSION
        || persisted.resultingGrantVersion !== RESULTING_GRANT_VERSION
        || persisted.migrationId !== metadata.migrationId
        || persisted.sourceGitCommit !== metadata.sourceGitCommit
        || persisted.operatorId !== metadata.operatorId
        || persisted.approvalRef !== metadata.approvalRef
        || persisted.reason !== metadata.reason
        || !sameJson(persisted.beforeValue, plan.beforeValue)
        || !sameJson(persisted.afterValue, verifiedAfterValue)) {
      fail('persisted replace audit does not equal the frozen audit envelope');
    }
    return plan;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function report(plan: Plan, operation: string): void {
  process.stdout.write(`${JSON.stringify({
    task: TASK,
    operation,
    outcome: plan.outcome,
    client: TARGET_CLIENT_ID,
    audience: AUDIENCE_ID,
    grant_rows_updated: plan.outcome === 'replace' ? 1 : 0,
    audits_created: plan.outcome === 'replace' ? 1 : 0,
    scopes_before: sortedScopes(DRIFT_SCOPES),
    scopes_after: sortedScopes(TARGET_SCOPES),
    grant_version_before: EXPECTED_GRANT_VERSION,
    grant_version_after: RESULTING_GRANT_VERSION,
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
  const privateBinding = { metadata, serverAddress: `${networks.bridge.IPAddress}/32` };
  return `postgresql://${RUNNER_ROLE}@127.0.0.1:${descriptor.host_port}/${DATABASE}?schema=public&application_name=svc_forum_narrow_${nonce}#${Buffer.from(JSON.stringify(privateBinding)).toString('base64url')}`;
}

function parseConformanceUrl(value: string): { url: string; metadata: Metadata; nonce: string; serverAddress: string } {
  const parsed = new URL(value);
  const binding = JSON.parse(Buffer.from(parsed.hash.slice(1), 'base64url').toString('utf8')) as { metadata: Metadata; serverAddress: string };
  const nonce = parsed.searchParams.get('application_name')?.replace(/^svc_forum_narrow_/, '') ?? '';
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
      report(await applyNarrow(prisma, metadata), 'conformance-apply');
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
    try { report(await applyNarrow(prisma, metadata), 'apply'); } finally { await prisma.$disconnect(); }
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
