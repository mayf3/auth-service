import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, fstatSync, readSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import { verifyRuntimeSnapshot } from '../src/lib/oauth/v1/contract.js';

// Forum Moderator Grant Supply V1 — AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1.
// Exact one-Client `svc-forum` moderation Grant supply for the frozen identity
// tuple of agt_course-community-agent-2. Read-only plan emits the canonical
// APPLY / EXACT_RERUN_NOOP document (CTR-FMG-003); the write path is one
// Serializable transaction that updates only the svc-forum audience
// registered_scopes and the exact Client's Grant 1 -> 2 plus the closed
// 13-field grant_change_audits envelope (CTR-FMG-004/007/010); exact rerun is
// NOOP and every drifted pre-state conflicts with zero writes
// (CTR-FMG-008/009). PRODUCTION_APPLY_AUTHORITY = none: `--apply` refuses
// before any database connection (CTR-FMG-016). The legacy OpenClaw mc_oc_*
// Client family is never queried, resolved, or mutated (CTR-FMG-013).

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
type Classification = {
  kind: 'APPLY' | 'EXACT_RERUN_NOOP';
  internalClientId: string;
  principalId: string;
  invariantDigest: string;
  beforeValue: Prisma.InputJsonObject;
  afterValue: Prisma.InputJsonObject;
};

const MIGRATION_ID = 'forum-moderator-grant-supply-v1';
const AGENT_ID = 'agt_course-community-agent-2';
const PRINCIPAL_ID = '9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56';
const PRINCIPAL_EXTERNAL_REF = 'agentcore:v1:principal:agt_course-community-agent-2';
const CLIENT_EXTERNAL_REF = 'agentcore:v1:client:agt_course-community-agent-2';
const PUBLIC_CLIENT_ID = 'mc_hvEfjkJ5BTKA8HZXRmbzNVw0';
const AUDIENCE = 'svc-forum';
const WORKFLOW_AUDIENCE = 'svc-workflow';
const WORKFLOW_SCOPES = Object.freeze(['workflow.read']);
const SOURCE_SCOPES = Object.freeze(['forum.read', 'forum.write']);
const TARGET_SCOPES = Object.freeze(['forum.moderate', 'forum.read', 'forum.write']);
const BUNDLE_CONTRACT_VERSION = '1.7.0';
const PLAN_VERSION = 'AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1_PLAN_1';
const AUDIT_REASON_PREFIX = 'forum_moderator_grant_supply_v1';
const AUDIT_REASON_PATTERN = /^forum_moderator_grant_supply_v1 plan_sha256=[0-9a-f]{64}$/;
// Distinct from Stage W (813_947_201), Stage F (813_947_202), the svc-forum
// audience reconciliation (813_947_203), and legacy Grant narrowing (813_947_204).
const ADVISORY_LOCK_KEY = 813_947_205;
const IMAGE = 'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777';
const DATABASE = 'auth_fmg_conformance';
const CONTAINER_LABEL = 'com.mayf3.auth.fmg-conformance';
const PRODUCTION_APPLY_AUTHORITY = 'none' as const;
const FUNCTIONAL_MINT_VERIFICATION_AUTHORITY = 'none' as const;
const AUDIT_KEYS = Object.freeze([
  'change_id', 'migration_id', 'source_git_commit', 'operator_id', 'approval_ref',
  'reason', 'client_id', 'change_type', 'expected_grant_version',
  'resulting_grant_version', 'before_value', 'after_value', 'timestamp',
]);
const AUTHORIZATION_KEYS = Object.freeze([
  'schema_version', 'authorization_kind', 'implementation_commit', 'bundle_version',
  'bundle_digest', 'plan_sha256', 'prestate_digest', 'operator_id', 'approval_ref',
  'outage_approval_ref', 'stop_command', 'start_command', 'rollback_ref',
  'verify_command',
]);

function fail(message: string): never {
  throw new Error(`FMG refused: ${message}`);
}
function conflict(message: string): never {
  return fail(`CONFLICT: ${message}`);
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
function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    fail(`${label} must be a lowercase UUIDv4`);
  }
  return value;
}
function asciiCompare(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));
}
function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort(asciiCompare).map((key) => [key, canonicalJson(value[key])]));
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
}, grants: Array<{ audienceId: string; scopes: string[] }>, revision: number): Prisma.InputJsonObject {
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

async function classify(db: Db): Promise<Classification> {
  const principals = await db.machinePrincipal.findMany({
    where: { OR: [{ externalRef: PRINCIPAL_EXTERNAL_REF }, { agentId: AGENT_ID }] },
    select: { id: true, externalRef: true, agentId: true, principalType: true, status: true, disabledAt: true },
  });
  if (principals.length !== 1 || principals[0].id !== PRINCIPAL_ID
      || principals[0].externalRef !== PRINCIPAL_EXTERNAL_REF
      || principals[0].agentId !== AGENT_ID || principals[0].principalType !== 'agent'
      || principals[0].status !== 'active' || principals[0].disabledAt !== null) {
    conflict('the moderator Principal must resolve uniquely and exactly (active agent, exact external ref and agent_id)');
  }
  const principal = principals[0];

  const clients = await db.machineClient.findMany({
    where: { OR: [{ externalRef: CLIENT_EXTERNAL_REF }, { clientId: PUBLIC_CLIENT_ID }] },
    select: {
      id: true, clientId: true, externalRef: true, machinePrincipalId: true, status: true, revokedAt: true,
      principal: {
        select: { id: true, externalRef: true, agentId: true, principalType: true, status: true, disabledAt: true },
      },
      accessGrants: { select: { audienceId: true, scopes: true, version: true }, orderBy: { audienceId: 'asc' } },
      trustedProxy: { select: { delegationGrants: { select: { audienceId: true } } } },
    },
  });
  if (clients.length !== 1) conflict('the moderator Client external ref must resolve exactly once');
  const client = clients[0];
  if (client.status !== 'active' || client.revokedAt !== null || client.clientId !== PUBLIC_CLIENT_ID
      || client.externalRef !== CLIENT_EXTERNAL_REF) {
    conflict('the resolved Client is not the exact active, unrevoked frozen public client ID/external ref');
  }
  if (client.principal.id !== client.machinePrincipalId || client.principal.id !== principal.id
      || client.principal.id !== PRINCIPAL_ID || client.principal.externalRef !== PRINCIPAL_EXTERNAL_REF
      || client.principal.agentId !== AGENT_ID
      || client.principal.principalType !== 'agent' || client.principal.status !== 'active'
      || client.principal.disabledAt !== null) {
    conflict('the moderator identity binding is invalid (exact principal bind required)');
  }
  if (client.trustedProxy !== null && client.trustedProxy.delegationGrants.length !== 0) {
    conflict('the moderator Client carries delegation grants outside the frozen snapshot');
  }
  const principalClientCount = await db.machineClient.count({ where: { machinePrincipalId: principal.id } });
  if (principalClientCount !== 1) conflict('the moderator Client must be the sole client of its Principal');

  const audiences = await db.authAudience.findMany({
    where: { audienceId: AUDIENCE },
    select: {
      audienceId: true, resourceService: true, scopeNamespace: true, acceptedPrincipalTypes: true,
      registeredScopes: true, humanAccessEnabled: true, machineAccessEnabled: true,
      delegatedAccessEnabled: true, status: true, freezeReady: true, version: true,
    },
  });
  if (audiences.length !== 1) conflict('the svc-forum Audience row must resolve exactly once');
  const audience = audiences[0];
  if (audience.resourceService !== AUDIENCE || audience.scopeNamespace !== 'forum'
      || JSON.stringify(audience.acceptedPrincipalTypes) !== JSON.stringify(['agent'])
      || audience.humanAccessEnabled !== false || audience.machineAccessEnabled !== true
      || audience.delegatedAccessEnabled !== false || audience.status !== 'active'
      || audience.freezeReady !== true || audience.version !== 1) {
    conflict('the svc-forum Audience row no longer equals the CTR-FMG-002 frozen entry (non-scope fields)');
  }
  const audienceIsSource = sameJson(audience.registeredScopes, SOURCE_SCOPES);
  const audienceIsTarget = sameJson(audience.registeredScopes, TARGET_SCOPES);
  if (!audienceIsSource && !audienceIsTarget) {
    conflict('the svc-forum Audience registered_scopes are neither the exact source nor the exact target set');
  }

  const forumGrant = client.accessGrants.find((grant) => grant.audienceId === AUDIENCE);
  const workflowGrant = client.accessGrants.find((grant) => grant.audienceId === WORKFLOW_AUDIENCE);
  if (client.accessGrants.length !== 2 || forumGrant === undefined || workflowGrant === undefined) {
    conflict('the moderator Client must carry exactly the svc-forum and svc-workflow Grant rows');
  }
  if (!sameJson([...workflowGrant.scopes].sort(asciiCompare), WORKFLOW_SCOPES) || workflowGrant.version !== 1) {
    conflict('the moderator svc-workflow Grant must remain exactly [workflow.read]@v1 (CTR-FMG-005)');
  }
  const grantIsSource = forumGrant.version === 1 && sameJson([...forumGrant.scopes].sort(asciiCompare), SOURCE_SCOPES);
  const grantIsTarget = forumGrant.version === 2 && sameJson([...forumGrant.scopes].sort(asciiCompare), TARGET_SCOPES);
  if (!grantIsSource && !grantIsTarget) {
    conflict('the moderator svc-forum Grant is neither the exact source [forum.read,forum.write]@v1 nor the exact target [forum.moderate,forum.read,forum.write]@v2');
  }
  if (audienceIsTarget !== grantIsTarget) {
    conflict('the Audience and Grant states are mixed (both must be source or both target, CTR-FMG-008)');
  }

  const audits = await db.grantChangeAudit.findMany({
    where: { clientId: PUBLIC_CLIENT_ID, migrationId: MIGRATION_ID },
    select: {
      id: true, migrationId: true, sourceGitCommit: true, operatorId: true, approvalRef: true,
      reason: true, clientId: true, changeType: true, expectedGrantVersion: true,
      resultingGrantVersion: true, beforeValue: true, afterValue: true, timestamp: true,
    },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  });
  const beforeValue = completeSnapshot(client, [
    { audienceId: AUDIENCE, scopes: [...SOURCE_SCOPES] },
    { audienceId: WORKFLOW_AUDIENCE, scopes: [...WORKFLOW_SCOPES] },
  ], 1);
  const afterValue = completeSnapshot(client, [
    { audienceId: AUDIENCE, scopes: [...TARGET_SCOPES] },
    { audienceId: WORKFLOW_AUDIENCE, scopes: [...WORKFLOW_SCOPES] },
  ], 2);

  if (grantIsTarget) {
    const applyDigest = canonicalPlanDocument('APPLY').digest;
    const audit = audits[0];
    if (audits.length !== 1 || audit === undefined || audit.changeType !== 'replace'
        || audit.expectedGrantVersion !== 1 || audit.resultingGrantVersion !== 2
        || audit.clientId !== PUBLIC_CLIENT_ID || audit.migrationId !== MIGRATION_ID
        || typeof audit.sourceGitCommit !== 'string' || !/^[0-9a-f]{40}$/.test(audit.sourceGitCommit)
        || typeof audit.operatorId !== 'string' || audit.operatorId.length === 0
        || typeof audit.approvalRef !== 'string' || audit.approvalRef.length === 0
        || typeof audit.reason !== 'string' || !AUDIT_REASON_PATTERN.test(audit.reason)
        || audit.reason !== `${AUDIT_REASON_PREFIX} plan_sha256=${applyDigest}`
        || typeof audit.id !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(audit.id)
        || !(audit.timestamp instanceof Date) || Number.isNaN(audit.timestamp.getTime())
        || !sameJson(audit.beforeValue, beforeValue) || !sameJson(audit.afterValue, afterValue)) {
      conflict('the target state lacks the exact governed FMG audit (unique (migration_id, client_id), CTR-FMG-010)');
    }
  } else if (audits.length !== 0) {
    conflict('an FMG audit already exists for the source state (duplicate-audit drift, CTR-FMG-008)');
  }

  const foreignModerate = await db.machineAccessGrant.findMany({
    where: { scopes: { has: 'forum.moderate' }, machineClientId: { not: client.id } },
    select: { machineClientId: true },
  });
  if (foreignModerate.length !== 0) {
    conflict('a non-target Client already holds a forum.moderate Grant (CTR-FMG-005)');
  }
  const invariantClients = (await db.machineClient.findMany({
    select: {
      id: true, clientId: true, externalRef: true, machinePrincipalId: true, status: true,
      createdAt: true, updatedAt: true, rotatedAt: true, revokedAt: true,
    },
    orderBy: { clientId: 'asc' },
  })).map((row) => ({
    id: row.id,
    client_id: row.clientId,
    external_ref: row.externalRef,
    machine_principal_id: row.machinePrincipalId,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    rotated_at: row.rotatedAt?.toISOString() ?? null,
    revoked_at: row.revokedAt?.toISOString() ?? null,
  }));
  const invariantRows = (await db.machineAccessGrant.findMany({
    select: { machineClientId: true, audienceId: true, scopes: true, version: true, createdAt: true, updatedAt: true },
    orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }],
  })).filter((row) => !(row.machineClientId === client.id && row.audienceId === AUDIENCE))
    .map((row) => ({
      machine_client_id: row.machineClientId,
      audience_id: row.audienceId,
      scopes: [...row.scopes],
      version: row.version,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }));
  const invariantDigest = createHash('sha256')
    .update(Buffer.from(JSON.stringify(canonicalJson({
      clients: invariantClients,
      non_target_and_workflow_grants: invariantRows,
    })), 'utf8')).digest('hex');

  return {
    kind: grantIsTarget ? 'EXACT_RERUN_NOOP' : 'APPLY',
    internalClientId: client.id,
    principalId: principal.id,
    invariantDigest,
    beforeValue,
    afterValue,
  };
}

function canonicalPlanDocument(kind: 'APPLY' | 'EXACT_RERUN_NOOP'): { canonical: string; digest: string } {
  const noop = kind === 'EXACT_RERUN_NOOP';
  const document = {
    plan_version: PLAN_VERSION,
    classification: kind,
    agent_id: AGENT_ID,
    principal_external_ref: PRINCIPAL_EXTERNAL_REF,
    client_external_ref: CLIENT_EXTERNAL_REF,
    client_id: PUBLIC_CLIENT_ID,
    audience: AUDIENCE,
    expected_audience_scopes: noop ? [...TARGET_SCOPES] : [...SOURCE_SCOPES],
    target_audience_scopes: [...TARGET_SCOPES],
    expected_grant_version: noop ? 2 : 1,
    expected_grant_scopes: noop ? [...TARGET_SCOPES] : [...SOURCE_SCOPES],
    target_grant_version: 2,
    target_grant_scopes: [...TARGET_SCOPES],
    operation: noop ? 'NONE' : 'UPDATE_AUDIENCE_AND_GRANT',
  };
  const canonical = JSON.stringify(canonicalJson(document));
  const digest = createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('hex');
  return { canonical, digest };
}

function auditEnvelope(metadata: Metadata, planDigest: string, classification: Classification, id: string, timestamp: Date): Record<string, unknown> {
  uuid(id, 'change_id');
  const envelope = {
    change_id: id,
    migration_id: metadata.migrationId,
    source_git_commit: metadata.sourceGitCommit,
    operator_id: metadata.operatorId,
    approval_ref: metadata.approvalRef,
    reason: `${AUDIT_REASON_PREFIX} plan_sha256=${planDigest}`,
    client_id: PUBLIC_CLIENT_ID,
    change_type: 'replace',
    expected_grant_version: 1,
    resulting_grant_version: 2,
    before_value: classification.beforeValue,
    after_value: classification.afterValue,
    timestamp: timestamp.toISOString(),
  };
  exactKeys(envelope, AUDIT_KEYS, 'grant audit');
  return envelope;
}

async function applyChange(
  prisma: PrismaClient,
  metadata: Metadata,
  expectedPlanDigest: string,
  expectedInvariantDigest: string,
): Promise<{
  outcome: 'replace' | 'noop';
  planDigest: string;
  canonical: string;
  safeProjection: Prisma.InputJsonObject;
  writes: { audience_rows_updated: number; grant_rows_updated: number; audits_created: number };
}> {
  validateMetadata(metadata);
  lowercaseHex(expectedPlanDigest, 64, 'plan_sha256');
  lowercaseHex(expectedInvariantDigest, 64, 'invariant_sha256');
  if (metadata.migrationId !== MIGRATION_ID) fail(`migration_id must equal ${MIGRATION_ID}`);
  return prisma.$transaction(async (tx) => {
    // Table locks make non-cooperating Grant/audit writers serialize before or
    // after this transaction; a writer that commits first becomes a conflict.
    await tx.$executeRawUnsafe('LOCK TABLE auth_audiences IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE machine_clients IN SHARE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE machine_principals IN SHARE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE trusted_proxies IN SHARE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE delegation_grants IN SHARE MODE');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;
    const classification = await classify(tx);
    const { canonical, digest } = canonicalPlanDocument(classification.kind);
    if (classification.invariantDigest !== expectedInvariantDigest) {
      conflict('Client/non-target/Workflow invariant digest differs from the reviewed prestate');
    }
    if (digest !== expectedPlanDigest) {
      conflict(`supplied plan_sha256 does not match the fresh ${classification.kind} plan`);
    }
    if (classification.kind === 'EXACT_RERUN_NOOP') {
      return { outcome: 'noop' as const, planDigest: digest, canonical,
        safeProjection: classification.afterValue,
        writes: { audience_rows_updated: 0, grant_rows_updated: 0, audits_created: 0 } };
    }
    // Conditional exact Audience update: only registered_scopes changes; every
    // other column (including updated_at) is not set and stays byte-identical.
    const audienceUpdated = await tx.$executeRawUnsafe(
      'UPDATE auth_audiences SET registered_scopes = ARRAY[$1,$2,$3]::text[] '
      + 'WHERE audience_id = $4 AND registered_scopes = ARRAY[$5,$6]::text[] AND version = 1',
      TARGET_SCOPES[0], TARGET_SCOPES[1], TARGET_SCOPES[2], AUDIENCE, SOURCE_SCOPES[0], SOURCE_SCOPES[1],
    );
    if (audienceUpdated !== 1) conflict('the conditional svc-forum Audience update did not affect exactly one row');
    // Optimistic exact Grant update 1 -> 2. Raw SQL is deliberate: Prisma's
    // @updatedAt behavior would mutate updated_at, but CTR-FMG-004 permits only
    // scopes + version to change on this row.
    const grantUpdated = await tx.$executeRawUnsafe(
      'UPDATE machine_access_grants SET scopes = ARRAY[$1,$2,$3]::text[], version = 2 '
      + 'WHERE machine_client_id = $4::uuid AND audience_id = $5 '
      + 'AND scopes = ARRAY[$6,$7]::text[] AND version = 1',
      TARGET_SCOPES[0], TARGET_SCOPES[1], TARGET_SCOPES[2], classification.internalClientId,
      AUDIENCE, SOURCE_SCOPES[0], SOURCE_SCOPES[1],
    );
    if (grantUpdated !== 1) conflict('the conditional moderator Grant update did not affect exactly one row');
    const id = randomUUID();
    const timestamp = new Date();
    const envelope = auditEnvelope(metadata, digest, classification, id, timestamp);
    await tx.grantChangeAudit.create({ data: {
      id,
      migrationId: envelope.migration_id as string,
      sourceGitCommit: envelope.source_git_commit as string,
      operatorId: envelope.operator_id as string,
      approvalRef: envelope.approval_ref as string,
      reason: envelope.reason as string,
      clientId: envelope.client_id as string,
      changeType: 'replace',
      expectedGrantVersion: 1,
      resultingGrantVersion: 2,
      beforeValue: classification.beforeValue,
      afterValue: classification.afterValue,
      timestamp,
    } });
    // Post-write self-check: the transaction must now classify as exact NOOP.
    const reopened = await classify(tx);
    if (reopened.kind !== 'EXACT_RERUN_NOOP') conflict('the post-write state does not reclassify as the exact target');
    return { outcome: 'replace' as const, planDigest: digest, canonical,
      safeProjection: classification.afterValue,
      writes: { audience_rows_updated: audienceUpdated, grant_rows_updated: grantUpdated, audits_created: 1 } };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function reportPlan(kind: 'APPLY' | 'EXACT_RERUN_NOOP', operation: string, invariantDigest: string): void {
  const { canonical, digest } = canonicalPlanDocument(kind);
  process.stdout.write(`${canonical}\n`);
  process.stdout.write(`PLAN_SHA256=${digest}\n`);
  process.stdout.write(`PLAN_CLASSIFICATION=${kind}\n`);
  process.stdout.write(`PLAN_OPERATION=${kind === 'EXACT_RERUN_NOOP' ? 'NONE' : 'UPDATE_AUDIENCE_AND_GRANT'}\n`);
  process.stdout.write(`PLAN_WRITES=0\n`);
  process.stdout.write(`INVARIANT_GRANTS_SHA256=${invariantDigest}\n`);
  process.stdout.write(`${JSON.stringify({
    stage: 'FMG', operation, classification: kind, plan_sha256: digest,
    invariant_grants_sha256: invariantDigest, writes: 0,
  })}\n`);
}

async function runPlan(prisma: PrismaClient): Promise<void> {
  assertRuntimeBundleTarget(readRuntimeSnapshot());
  const classification = await classify(prisma);
  reportPlan(classification.kind, 'plan', classification.invariantDigest);
}

function readRuntimeSnapshot(): { payload: Record<string, unknown> } {
  const snapshotPath = path.resolve(
    process.cwd(), 'generated', 'minimal-auth-v1', 'runtime-contract.json',
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    const payload = verifyRuntimeSnapshot(parsed);
    if (!isObject(payload)) fail('runtime snapshot payload shape is invalid');
    return { payload };
  } catch (error) {
    fail(`runtime snapshot unavailable or integrity-invalid: ${(error as Error).message}`);
  }
}

function assertRuntimeBundleTarget(snapshot: { payload: Record<string, unknown> }): Record<string, unknown> {
  const contractVersion = snapshot.payload.contractVersion;
  if (contractVersion !== BUNDLE_CONTRACT_VERSION) {
    fail(`running/staged Bundle identity must be exactly ${BUNDLE_CONTRACT_VERSION} (observed ${String(contractVersion)})`);
  }
  const registry = snapshot.payload.audienceRegistry;
  if (!isObject(registry) || !Array.isArray(registry.audiences)) fail('runtime snapshot has no audience registry');
  const bundleAudience = (registry.audiences as unknown[]).find(
    (entry) => isObject(entry) && entry.audience_id === AUDIENCE,
  );
  if (!isObject(bundleAudience)) fail('runtime snapshot does not contain the svc-forum Audience');
  if (!sameJson(bundleAudience.registered_scopes, TARGET_SCOPES)) {
    fail('executable svc-forum registered_scopes do not equal the exact three-scope target');
  }
  return bundleAudience;
}

async function runVerifyState(prisma: PrismaClient, expectedInvariantDigest: string): Promise<void> {
  const bundleAudience = assertRuntimeBundleTarget(readRuntimeSnapshot());
  const classification = await classify(prisma);
  lowercaseHex(expectedInvariantDigest, 64, 'expected_invariant_sha256');
  if (classification.kind !== 'EXACT_RERUN_NOOP') {
    conflict('verify-state requires the exact target state (Audience + Grant @v2 + governed audit)');
  }
  if (classification.invariantDigest !== expectedInvariantDigest) {
    conflict('verify-state Client/non-target/Workflow invariant digest differs from the reviewed prestate');
  }
  const audiences = await prisma.authAudience.findMany({
    where: { audienceId: AUDIENCE },
    select: {
      audienceId: true, resourceService: true, scopeNamespace: true, acceptedPrincipalTypes: true,
      registeredScopes: true, humanAccessEnabled: true, machineAccessEnabled: true,
      delegatedAccessEnabled: true, status: true, freezeReady: true,
    },
  });
  if (audiences.length !== 1) conflict('verify-state: svc-forum Audience must resolve exactly once');
  const row = audiences[0];
  const pairs: Array<[unknown, unknown]> = [
    [row.audienceId, bundleAudience.audience_id],
    [row.resourceService, bundleAudience.resource_service],
    [row.scopeNamespace, bundleAudience.scope_namespace],
    [JSON.stringify(row.acceptedPrincipalTypes), JSON.stringify(bundleAudience.accepted_principal_types)],
    [JSON.stringify([...row.registeredScopes].sort(asciiCompare)), JSON.stringify(bundleAudience.registered_scopes)],
    [row.humanAccessEnabled, bundleAudience.human_access_enabled],
    [row.machineAccessEnabled, bundleAudience.machine_access_enabled],
    [row.delegatedAccessEnabled, bundleAudience.delegated_access_enabled],
    [row.status, bundleAudience.status],
    [row.freezeReady, bundleAudience.freeze_ready],
  ];
  if (pairs.some(([left, right]) => JSON.stringify(left) !== JSON.stringify(right))) {
    conflict('verify-state: executable and database svc-forum Audience entries are not equal');
  }
  process.stdout.write(`FMG_VERIFY_STATE=PASS\n`);
  process.stdout.write(`BUNDLE_CONTRACT_VERSION=${BUNDLE_CONTRACT_VERSION}\n`);
  process.stdout.write(`AUDIENCE_SCOPES=${[...row.registeredScopes].sort(asciiCompare).join(',')}\n`);
  process.stdout.write(`GRANT_VERSION=2\n`);
  process.stdout.write(`FMG_AUDIT_COUNT=1\n`);
  process.stdout.write(`WORKFLOW_GRANT=workflow.read@v1\n`);
  process.stdout.write(`NON_TARGET_MODERATE_GRANTS=0\n`);
  process.stdout.write(`INVARIANT_GRANTS_SHA256=${classification.invariantDigest}\n`);
  process.stdout.write(`WRITES=0\n`);
}

function refuseProductionApply(authorization: unknown): never {
  if (!isObject(authorization)) fail('production apply authorization must be an object');
  exactKeys(authorization, AUTHORIZATION_KEYS, 'production apply authorization');
  if (authorization.schema_version !== 1
      || authorization.authorization_kind !== 'forum_moderator_grant_supply_v1_production_apply') {
    fail('production apply authorization kind is invalid');
  }
  lowercaseHex(authorization.implementation_commit, 40, 'authorization.implementation_commit');
  if (authorization.bundle_version !== BUNDLE_CONTRACT_VERSION) {
    fail(`authorization.bundle_version must equal ${BUNDLE_CONTRACT_VERSION}`);
  }
  lowercaseHex(authorization.bundle_digest, 64, 'authorization.bundle_digest');
  lowercaseHex(authorization.plan_sha256, 64, 'authorization.plan_sha256');
  lowercaseHex(authorization.prestate_digest, 64, 'authorization.prestate_digest');
  text(authorization.operator_id, 'authorization.operator_id', 256);
  text(authorization.approval_ref, 'authorization.approval_ref', 2048);
  text(authorization.outage_approval_ref, 'authorization.outage_approval_ref', 2048);
  text(authorization.stop_command, 'authorization.stop_command', 1024);
  text(authorization.start_command, 'authorization.start_command', 1024);
  text(authorization.rollback_ref, 'authorization.rollback_ref', 2048);
  text(authorization.verify_command, 'authorization.verify_command', 1024);
  // CTR-FMG-016: this implementation carries PRODUCTION_APPLY_AUTHORITY = none.
  // Spec acceptance, source implementation, test pass, merge, or deployment are
  // never apply authority; refuse BEFORE any database connection or write.
  fail(`PRODUCTION_APPLY_AUTHORITY=${PRODUCTION_APPLY_AUTHORITY}: no exact production-apply authorization has been issued for this implementation; a separately authorized apply round is required (CTR-FMG-016)`);
}

function refuseVerifyMint(authorization: unknown): never {
  if (!isObject(authorization)) fail('functional mint verification authorization must be an object');
  exactKeys(authorization, [
    'schema_version', 'authorization_kind', 'implementation_commit', 'bundle_version',
    'operator_id', 'approval_ref', 'verification_authorization_ref', 'token_endpoint',
  ], 'functional mint verification authorization');
  if (authorization.schema_version !== 1
      || authorization.authorization_kind !== 'forum_moderator_grant_supply_v1_verify_mint') {
    fail('functional mint verification authorization kind is invalid');
  }
  lowercaseHex(authorization.implementation_commit, 40, 'verification.implementation_commit');
  if (authorization.bundle_version !== BUNDLE_CONTRACT_VERSION) fail('verification.bundle_version must equal 1.7.0');
  text(authorization.operator_id, 'verification.operator_id', 256);
  text(authorization.approval_ref, 'verification.approval_ref', 2048);
  text(authorization.verification_authorization_ref, 'verification.authorization_ref', 2048);
  text(authorization.token_endpoint, 'verification.token_endpoint', 2048);
  fail(`FUNCTIONAL_MINT_VERIFICATION_AUTHORITY=${FUNCTIONAL_MINT_VERIFICATION_AUTHORITY}: a separate exact verification authorization is required; no credential was read and no token request was sent`);
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

function conformanceUrl(descriptor: Record<string, unknown>): {
  url: string; metadata: Metadata; nonce: string; planDigest: string; invariantDigest: string;
} {
  exactKeys(descriptor, ['schema_version', 'container_id', 'nonce', 'host_port', 'database', 'plan_sha256', 'invariant_sha256', 'audit_metadata'], 'conformance descriptor');
  if (descriptor.schema_version !== 1) fail('descriptor schema version invalid');
  const containerId = lowercaseHex(descriptor.container_id, 64, 'container_id');
  const nonce = lowercaseHex(descriptor.nonce, 64, 'nonce');
  if (!Number.isInteger(descriptor.host_port) || (descriptor.host_port as number) < 1 || (descriptor.host_port as number) > 65535) fail('host_port invalid');
  const database = text(descriptor.database, 'database', 64);
  if (database !== DATABASE) fail(`descriptor database must equal ${DATABASE}`);
  const planDigest = lowercaseHex(descriptor.plan_sha256, 64, 'plan_sha256');
  const invariantDigest = lowercaseHex(descriptor.invariant_sha256, 64, 'invariant_sha256');
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
      || typeof info.Name !== 'string' || !info.Name.startsWith('/auth-fmg-conformance-')
      || !isObject(labels) || labels[CONTAINER_LABEL] !== `sha256:${createHash('sha256').update(nonce).digest('hex')}`
      || !isObject(hostConfig.Tmpfs) || !Object.hasOwn(hostConfig.Tmpfs, '/var/lib/postgresql/data')
      || !Array.isArray(mounts) || mounts.length !== 0 || hostConfig.Privileged !== false
      || !emptyOrNull(hostConfig.CapAdd) || !emptyOrNull(hostConfig.CapDrop)
      || !emptyOrNull(hostConfig.Devices) || !emptyOrNull(hostConfig.DeviceRequests)
      || !emptyOrNull(hostConfig.SecurityOpt) || !emptyOrNull(hostConfig.Binds)
      || hostConfig.NetworkMode !== 'bridge' || !isObject(networks) || Object.keys(networks).length !== 1
      || !isObject(ports) || Object.keys(ports).length !== 1 || !Array.isArray(ports['5432/tcp'])
      || ports['5432/tcp'].length !== 1 || !isObject(ports['5432/tcp'][0])
      || ports['5432/tcp'][0].HostIp !== '127.0.0.1'
      || Number(ports['5432/tcp'][0].HostPort) !== descriptor.host_port) fail('container is not exact disposable conformance PostgreSQL');
  const serverAddress = isObject(networks.bridge) && typeof networks.bridge.IPAddress === 'string'
    ? networks.bridge.IPAddress : '';
  if (serverAddress.length === 0) fail('container bridge address is invalid');
  return {
    url: `postgresql://fmg_runner@127.0.0.1:${descriptor.host_port}/${DATABASE}?schema=public`,
    metadata,
    nonce,
    planDigest,
    invariantDigest,
  };
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  const values = new Set(['--authorization-fd', '--descriptor-fd', '--expected-invariant-sha256']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--') || Object.hasOwn(result, arg)) fail(`unknown or duplicate argument ${arg}`);
    if (values.has(arg)) {
      const next = argv[++index];
      if (next === undefined || next.startsWith('--')) fail(`${arg} requires a value`);
      result[arg] = next;
    } else if (['--apply', '--conformance-apply', '--conformance-outcome-unknown', '--verify-state', '--verify-mint'].includes(arg)) result[arg] = true;
    else fail(`unknown argument ${arg}`);
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--apply', '--conformance-apply', '--conformance-outcome-unknown', '--verify-state', '--verify-mint']
    .filter((key) => args[key] === true);
  if (modes.length > 1) fail('execution modes are mutually exclusive');

  if (args['--conformance-apply'] || args['--conformance-outcome-unknown']) {
    const conformanceMode = args['--conformance-outcome-unknown']
      ? '--conformance-outcome-unknown' : '--conformance-apply';
    if (process.env.DATABASE_URL !== undefined
        || Object.keys(args).some((key) => key !== conformanceMode && key !== '--descriptor-fd')) {
      fail('DB conformance accepts only its FIFO descriptor');
    }
    const descriptor = readFifo(args['--descriptor-fd'] as string | undefined, 'conformance');
    if (!isObject(descriptor)) fail('conformance descriptor must be an object');
    const { url, metadata, nonce, planDigest, invariantDigest } = conformanceUrl(descriptor);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const probe = await prisma.$queryRaw<Array<{ database: string; address: string; port: number; nonce: string }>>`
        SELECT current_database() AS database, inet_server_addr()::text AS address,
               inet_server_port() AS port, current_setting('fmg.conformance_nonce') AS nonce`;
      if (probe.length !== 1 || probe[0].database !== DATABASE || probe[0].port !== 5432
          || probe[0].nonce !== nonce
          || probe[0].address === '') fail('connected server identity is invalid');
      const result = await applyChange(prisma, metadata, planDigest, invariantDigest);
      if (conformanceMode === '--conformance-outcome-unknown') {
        const reconciled = await classify(prisma);
        process.stdout.write(`${JSON.stringify({
          stage: 'FMG', operation: 'read-only-reconcile-after-outcome-unknown',
          classification: reconciled.kind, invariant_grants_sha256: reconciled.invariantDigest,
          writes_after_unknown: 0, retry_attempted: false,
        })}\n`);
        fail('OUTCOME_UNKNOWN: commit acknowledgement was lost; read-only reconciliation completed and blind retry is forbidden');
      }
      process.stdout.write(`${JSON.stringify({
        stage: 'FMG', operation: 'conformance-apply', outcome: result.outcome,
        plan_sha256: result.planDigest,
        plan_document: JSON.parse(result.canonical) as Json,
        safe_target_projection: result.safeProjection,
        audience_rows_updated: result.writes.audience_rows_updated,
        grant_rows_updated: result.writes.grant_rows_updated,
        audits_created: result.writes.audits_created,
      })}\n`);
    } finally { await prisma.$disconnect(); }
    return;
  }

  if (args['--apply']) {
    if (Object.keys(args).some((key) => key !== '--apply' && key !== '--authorization-fd')) {
      fail('apply accepts only its authorization descriptor');
    }
    // CTR-FMG-016: refuse before any database connection. No PrismaClient is
    // constructed on this path in this build.
    const authorization = readFifo(args['--authorization-fd'] as string | undefined, 'authorization');
    if (!isObject(authorization)) fail('authorization must be an object');
    refuseProductionApply(authorization);
  }

  if (args['--verify-mint']) {
    if (Object.keys(args).some((key) => key !== '--verify-mint' && key !== '--authorization-fd')) {
      fail('verify-mint accepts only its separate authorization descriptor');
    }
    const authorization = readFifo(args['--authorization-fd'] as string | undefined, 'verification authorization');
    refuseVerifyMint(authorization);
  }

  if (args['--verify-state']) {
    if (Object.keys(args).length !== 2 || typeof args['--expected-invariant-sha256'] !== 'string') {
      fail('verify-state requires exactly --expected-invariant-sha256');
    }
    if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for read-only verify-state');
    const prisma = new PrismaClient();
    try { await runVerifyState(prisma, args['--expected-invariant-sha256']); } finally { await prisma.$disconnect(); }
    return;
  }

  if (Object.keys(args).length !== 0) fail('plan accepts no arguments');
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for read-only plan');
  const prisma = new PrismaClient();
  try { await runPlan(prisma); } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
