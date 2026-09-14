/**
 * Controlled one-row HR own-dispatch inspection Grant replacement.
 * Authority: AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1.
 *
 * This vehicle owns only the canonical HR Client's agent-session-messaging
 * Grant transition from send-only @v1 to send+own-dispatch-inspection @v2.
 * Its rollback is forward-only: exact @v2 becomes send-only @v3. It never
 * reads a credential/secret, never creates a Client, and never mutates a
 * bystander row.
 */

import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

export const PRINCIPAL_ID = 'dc702687-6515-4a2a-91ae-e572a9bbd766';
export const AGENT_ID = 'agt_hr-agent';
export const AUDIENCE_ID = 'agent-session-messaging';
export const SEND_SCOPE = 'agent.session.send';
export const INSPECT_SCOPE = 'agent.session.inspect_own_dispatch';
export const SOURCE_SCOPES = Object.freeze([SEND_SCOPE]);
export const TARGET_SCOPES = Object.freeze([INSPECT_SCOPE, SEND_SCOPE]);
export const BUNDLE_VERSION = '1.12.0';
export const SOURCE_VERSION = 1;
export const TARGET_VERSION = 2;
export const ROLLBACK_VERSION = 3;
export const MIGRATION_ID = 'hr-session-inspection-grant-v1';
export const ROLLBACK_MIGRATION_ID = 'hr-session-inspection-grant-v1-rollback';
export const APPLY_AUDIT_REASON = 'HR_AGENT_SESSION_OWN_DISPATCH_INSPECTION_ACTIVATION';
export const ROLLBACK_AUDIT_REASON = 'HR_AGENT_SESSION_INSPECTION_FAILED_ACTIVATION_FORWARD_ROLLBACK';
export const SOURCE_SPEC_ID = 'AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1';
export const PLAN_VERSION = 'AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1_PLAN_1';
export const APPLY_GATE = 'HR_SESSION_INSPECTION_GRANT_APPLY';
export const ROLLBACK_GATE = 'HR_SESSION_INSPECTION_GRANT_ROLLBACK';
export const OPERATOR_ENV = 'HR_SESSION_INSPECTION_GRANT_OPERATOR';
export const APPROVAL_ENV = 'HR_SESSION_INSPECTION_GRANT_APPROVAL_REF';
export const ADVISORY_LOCK_KEY = 813_947_207;

const FROZEN_AUDIENCE = Object.freeze({
  audienceId: AUDIENCE_ID,
  resourceService: AUDIENCE_ID,
  scopeNamespace: 'agent',
  acceptedPrincipalTypes: Object.freeze(['agent']),
  registeredScopes: TARGET_SCOPES,
  humanAccessEnabled: false,
  machineAccessEnabled: true,
  delegatedAccessEnabled: false,
  status: 'active',
  freezeReady: true,
  version: 1,
});

export interface PrincipalRow {
  id: string;
  principalType: string;
  status: string;
  disabledAt: Date | null;
  agentId: string | null;
}

export interface ClientRow {
  id: string;
  clientId: string;
  status: string;
  revokedAt: Date | null;
}

export interface AudienceRow {
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
}

export interface GrantRow {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}

export interface SecurityAuditRow {
  id: string;
  migrationId: string;
  sourceGitCommit: string;
  operatorId: string;
  approvalRef: string;
  reason: string;
  clientId: string;
  changeType: string;
  expectedGrantVersion: number | null;
  resultingGrantVersion: number;
  beforeValue: unknown;
  afterValue: unknown;
  timestamp: Date;
}

export interface GrantDatabase {
  machinePrincipal: {
    findUnique(args: { where: { id: string } }): Promise<PrincipalRow | null>;
  };
  machineClient: {
    findMany(args: {
      where: { machinePrincipalId: string };
      select: { id: true; clientId: true; status: true; revokedAt: true };
    }): Promise<ClientRow[]>;
  };
  authAudience: {
    findUnique(args: { where: { audienceId: string } }): Promise<AudienceRow | null>;
  };
  machineAccessGrant: {
    findUnique(args: {
      where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } };
    }): Promise<GrantRow | null>;
    findMany(args: {
      select: { machineClientId: true; audienceId: true; scopes: true; version: true };
    }): Promise<GrantRow[]>;
    updateMany(args: {
      where: {
        machineClientId: string;
        audienceId: string;
        version: number;
        scopes: { equals: string[] };
      };
      data: { scopes: string[]; version: number };
    }): Promise<{ count: number }>;
  };
  grantChangeAudit: {
    findMany(args: {
      where: { migrationId: string; clientId: string };
      orderBy?: Array<Record<string, string>>;
    }): Promise<SecurityAuditRow[]>;
    create(args: {
      data: Omit<SecurityAuditRow, 'timestamp'>;
    }): Promise<SecurityAuditRow>;
  };
  $executeRaw(query: string): Promise<unknown>;
  $transaction<T>(fn: (tx: GrantDatabase) => Promise<T>, options?: { isolationLevel?: 'Serializable' }): Promise<T>;
}

export type GrantClassification = 'SOURCE' | 'TARGET' | 'ROLLED_BACK' | 'CONFLICT';
export type PlanOutcome = 'APPLY' | 'NOOP' | 'CONFLICT';

export interface PlanInput {
  suppliedClientId: string;
  bundleVersion: string;
  nonce?: string;
}

export interface GrantPlan {
  outcome: PlanOutcome;
  classification: GrantClassification;
  reason: string | null;
  principalId: string;
  agentId: string;
  clientId: string | null;
  clientUuid: string | null;
  source: { scopes: string[]; version: number };
  target: { scopes: string[]; version: number };
  nonce: string;
  planSha256: string;
  preimageDigest: string | null;
  bystanderDigest: string | null;
  planDocument: Record<string, unknown>;
}

export interface GrantToolInput {
  suppliedClientId: string;
  bundleVersion: string;
  nonce: string;
  planSha256: string;
  preimageDigest: string;
  bystanderDigest: string;
  operatorId: string;
  approvalRef: string;
  sourceGitCommit: string;
  environment?: string;
}

export interface ApplyReceipt {
  schema_version: 1;
  operation: 'apply';
  outcome: 'APPLIED';
  principal_id: string;
  agent_id: string;
  client_id: string;
  client_uuid: string;
  audience: string;
  source_scopes: string[];
  source_version: number;
  target_scopes: string[];
  target_version: number;
  preimage_digest: string;
  postimage_digest: string;
  bystander_digest: string;
  plan_sha256: string;
  nonce: string;
  audit_id: string;
  source_git_commit: string;
  operator_id: string;
  approval_ref: string;
  environment: string;
  attempts: 1;
  retry_attempted: false;
  utc_time: string;
}

export interface ApplyResult {
  outcome: 'APPLIED' | 'NOOP' | 'CONFLICT' | 'PRECOMMIT_FAILED' | 'OUTCOME_UNKNOWN';
  reason: string | null;
  classification: GrantClassification;
  bystanderDigest: string | null;
  retryAttempted: false;
  receipt: ApplyReceipt | { outcome: 'NOOP'; attempts: 1; retry_attempted: false } | null;
}

export interface RollbackResult {
  outcome: 'ROLLED_BACK' | 'REFUSED' | 'PRECOMMIT_FAILED' | 'OUTCOME_UNKNOWN';
  reason: string | null;
  retryAttempted: false;
  bystanderDigest: string | null;
}

function fail(message: string): never {
  throw new Error(`hr session inspection grant refused: ${message}`);
}

function asciiCompare(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort(asciiCompare).map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function sorted(scopes: readonly string[]): string[] {
  return [...scopes].sort(asciiCompare);
}

function isHex(value: unknown, length: number): value is string {
  return typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value) > maximum) {
    fail(`${label} must contain 1..${maximum} bytes`);
  }
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (!same(Object.keys(value).sort(), [...expected].sort())) fail(`${label} fields are not exact`);
}

function exactAudience(row: AudienceRow | null): boolean {
  return row !== null
    && row.audienceId === FROZEN_AUDIENCE.audienceId
    && row.resourceService === FROZEN_AUDIENCE.resourceService
    && row.scopeNamespace === FROZEN_AUDIENCE.scopeNamespace
    && same(sorted(row.acceptedPrincipalTypes), [...FROZEN_AUDIENCE.acceptedPrincipalTypes])
    && same(sorted(row.registeredScopes), [...FROZEN_AUDIENCE.registeredScopes])
    && row.humanAccessEnabled === false
    && row.machineAccessEnabled === true
    && row.delegatedAccessEnabled === false
    && row.status === 'active'
    && row.freezeReady === true
    && row.version === 1;
}

function grantState(row: GrantRow | null): GrantClassification {
  if (row === null) return 'CONFLICT';
  if (row.version === SOURCE_VERSION && same(sorted(row.scopes), [...SOURCE_SCOPES])) return 'SOURCE';
  if (row.version === TARGET_VERSION && same(sorted(row.scopes), [...TARGET_SCOPES])) return 'TARGET';
  if (row.version === ROLLBACK_VERSION && same(sorted(row.scopes), [...SOURCE_SCOPES])) return 'ROLLED_BACK';
  return 'CONFLICT';
}

export function stableBystanderDigest(rows: GrantRow[], clientUuid: string): string {
  const projection = rows
    .filter((row) => !(row.machineClientId === clientUuid && row.audienceId === AUDIENCE_ID))
    .map((row) => ({
      audience_id: row.audienceId,
      machine_client_id: row.machineClientId,
      scopes: sorted(row.scopes),
      version: row.version,
    }))
    .sort((a, b) => asciiCompare(`${a.machine_client_id}\0${a.audience_id}`, `${b.machine_client_id}\0${b.audience_id}`));
  return digest(projection);
}

function grantProjection(row: GrantRow, clientId: string): Record<string, unknown> {
  return {
    audience: row.audienceId,
    client_id: clientId,
    client_uuid: row.machineClientId,
    scopes: sorted(row.scopes),
    version: row.version,
  };
}

function auditedBefore(clientId: string, clientUuid: string, bystander: string): Record<string, unknown> {
  const base = {
    agent_id: AGENT_ID,
    audience: AUDIENCE_ID,
    bystander_digest: bystander,
    client_id: clientId,
    client_uuid: clientUuid,
    principal_id: PRINCIPAL_ID,
    scopes: [...SOURCE_SCOPES],
    version: SOURCE_VERSION,
  };
  return { ...base, preimage_digest: digest(grantProjection({ machineClientId: clientUuid, audienceId: AUDIENCE_ID, scopes: [...SOURCE_SCOPES], version: SOURCE_VERSION }, clientId)) };
}

function auditedAfter(clientId: string, clientUuid: string, bystander: string): Record<string, unknown> {
  const base = {
    agent_id: AGENT_ID,
    audience: AUDIENCE_ID,
    bystander_digest: bystander,
    client_id: clientId,
    client_uuid: clientUuid,
    principal_id: PRINCIPAL_ID,
    scopes: [...TARGET_SCOPES],
    version: TARGET_VERSION,
  };
  return { ...base, postimage_digest: digest(grantProjection({ machineClientId: clientUuid, audienceId: AUDIENCE_ID, scopes: [...TARGET_SCOPES], version: TARGET_VERSION }, clientId)) };
}

function exactApplyAudit(row: SecurityAuditRow, clientId: string, clientUuid: string, bystander: string): boolean {
  return isUuid(row.id)
    && row.migrationId === MIGRATION_ID
    && isHex(row.sourceGitCommit, 40)
    && typeof row.operatorId === 'string' && row.operatorId.length > 0
    && typeof row.approvalRef === 'string' && row.approvalRef.length > 0
    && row.reason === APPLY_AUDIT_REASON
    && row.clientId === clientId
    && row.changeType === 'replace'
    && row.expectedGrantVersion === SOURCE_VERSION
    && row.resultingGrantVersion === TARGET_VERSION
    && same(row.beforeValue, auditedBefore(clientId, clientUuid, bystander))
    && same(row.afterValue, auditedAfter(clientId, clientUuid, bystander))
    && row.timestamp instanceof Date && !Number.isNaN(row.timestamp.getTime());
}

function conflictPlan(reason: string, nonce: string): GrantPlan {
  const planDocument = {
    agent_id: AGENT_ID,
    audience: AUDIENCE_ID,
    bundle_version: BUNDLE_VERSION,
    classification: 'CONFLICT',
    nonce,
    outcome: 'CONFLICT',
    plan_version: PLAN_VERSION,
    principal_id: PRINCIPAL_ID,
    reason,
    source: { scopes: [...SOURCE_SCOPES], version: SOURCE_VERSION },
    target: { scopes: [...TARGET_SCOPES], version: TARGET_VERSION },
  };
  return {
    outcome: 'CONFLICT', classification: 'CONFLICT', reason,
    principalId: PRINCIPAL_ID, agentId: AGENT_ID, clientId: null, clientUuid: null,
    source: { scopes: [...SOURCE_SCOPES], version: SOURCE_VERSION },
    target: { scopes: [...TARGET_SCOPES], version: TARGET_VERSION },
    nonce, planSha256: digest(planDocument), preimageDigest: null, bystanderDigest: null, planDocument,
  };
}

export async function planGrant(db: GrantDatabase, input: PlanInput): Promise<GrantPlan> {
  const nonce = input.nonce ?? randomUUID();
  if (!isUuid(nonce)) return conflictPlan('NONCE_INVALID', nonce);
  if (input.bundleVersion !== BUNDLE_VERSION) return conflictPlan('BUNDLE_VERSION_MISMATCH', nonce);
  const audience = await db.authAudience.findUnique({ where: { audienceId: AUDIENCE_ID } });
  if (audience === null) return conflictPlan('AUDIENCE_ABSENT', nonce);
  if (!exactAudience(audience)) return conflictPlan('AUDIENCE_DRIFTED', nonce);

  const principal = await db.machinePrincipal.findUnique({ where: { id: PRINCIPAL_ID } });
  if (principal === null) return conflictPlan('PRINCIPAL_NOT_FOUND', nonce);
  if (principal.principalType !== 'agent') return conflictPlan('PRINCIPAL_NOT_AGENT', nonce);
  if (principal.status !== 'active' || principal.disabledAt !== null) return conflictPlan('PRINCIPAL_DISABLED', nonce);
  if (principal.agentId !== AGENT_ID) return conflictPlan('PRINCIPAL_AGENT_ID_MISMATCH', nonce);

  const clients = await db.machineClient.findMany({
    where: { machinePrincipalId: PRINCIPAL_ID },
    select: { id: true, clientId: true, status: true, revokedAt: true },
  });
  const active = clients.filter((client) => client.status === 'active' && client.revokedAt === null);
  if (active.length === 0) return conflictPlan('NO_ACTIVE_CLIENT', nonce);
  if (active.length !== 1) return conflictPlan('AMBIGUOUS_BINDING', nonce);
  const client = active[0];
  if (client.clientId !== input.suppliedClientId) return conflictPlan('CLIENT_MISMATCH', nonce);

  const row = await db.machineAccessGrant.findUnique({
    where: { machineClientId_audienceId: { machineClientId: client.id, audienceId: AUDIENCE_ID } },
  });
  const classification = grantState(row);
  if (classification === 'CONFLICT') return conflictPlan('GRANT_CONFLICT', nonce);
  const allGrants = await db.machineAccessGrant.findMany({
    select: { machineClientId: true, audienceId: true, scopes: true, version: true },
  });
  const bystander = stableBystanderDigest(allGrants, client.id);
  const preimage = digest(grantProjection(row as GrantRow, client.clientId));

  const audits = await db.grantChangeAudit.findMany({
    where: { migrationId: MIGRATION_ID, clientId: client.clientId },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  });
  let auditConflict: string | null = null;
  if (classification === 'SOURCE' && audits.length !== 0) auditConflict = 'SOURCE_AUDIT_CONFLICT';
  if (classification === 'TARGET'
      && (audits.length !== 1 || !exactApplyAudit(audits[0], client.clientId, client.id, bystander))) {
    auditConflict = 'TARGET_AUDIT_CONFLICT';
  }
  if (classification === 'ROLLED_BACK') {
    const rollbackAudits = await db.grantChangeAudit.findMany({
      where: { migrationId: ROLLBACK_MIGRATION_ID, clientId: client.clientId },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });
    if (audits.length !== 1 || !exactApplyAudit(audits[0], client.clientId, client.id, bystander)
        || rollbackAudits.length !== 1) auditConflict = 'ROLLBACK_AUDIT_CONFLICT';
  }

  const outcome: PlanOutcome = auditConflict !== null ? 'CONFLICT'
    : classification === 'SOURCE' ? 'APPLY' : classification === 'TARGET' ? 'NOOP' : 'CONFLICT';
  const reason = auditConflict ?? (classification === 'ROLLED_BACK' ? 'ROLLED_BACK' : null);
  const planDocument = {
    agent_id: AGENT_ID,
    audience: AUDIENCE_ID,
    bundle_version: BUNDLE_VERSION,
    bystander_digest: bystander,
    classification,
    client_id: client.clientId,
    client_uuid: client.id,
    nonce,
    outcome,
    plan_version: PLAN_VERSION,
    preimage_digest: preimage,
    principal_id: PRINCIPAL_ID,
    reason,
    source: { scopes: [...SOURCE_SCOPES], version: SOURCE_VERSION },
    target: { scopes: [...TARGET_SCOPES], version: TARGET_VERSION },
  };
  return {
    outcome, classification, reason, principalId: PRINCIPAL_ID, agentId: AGENT_ID,
    clientId: client.clientId, clientUuid: client.id,
    source: { scopes: [...SOURCE_SCOPES], version: SOURCE_VERSION },
    target: { scopes: [...TARGET_SCOPES], version: TARGET_VERSION },
    nonce, planSha256: digest(planDocument), preimageDigest: preimage,
    bystanderDigest: bystander, planDocument,
  };
}

async function takeLocks(db: GrantDatabase): Promise<void> {
  await db.$executeRaw('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
  await db.$executeRaw('LOCK TABLE machine_clients IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE machine_principals IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE auth_audiences IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE');
  await db.$executeRaw(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);
}

function validateToolInput(input: GrantToolInput): void {
  boundedText(input.suppliedClientId, 'client_id', 256);
  if (input.bundleVersion !== BUNDLE_VERSION) fail('bundle version mismatch');
  if (!isUuid(input.nonce)) fail('nonce must be UUIDv4');
  if (!isHex(input.planSha256, 64) || !isHex(input.preimageDigest, 64) || !isHex(input.bystanderDigest, 64)) {
    fail('plan and prestate digests must be lowercase hex64');
  }
  boundedText(input.operatorId, 'operator_id', 256);
  boundedText(input.approvalRef, 'approval_ref', 2048);
  if (!isHex(input.sourceGitCommit, 40)) fail('source_git_commit must be lowercase hex40');
}

function auditData(input: GrantToolInput, clientUuid: string, before: Record<string, unknown>, after: Record<string, unknown>): Omit<SecurityAuditRow, 'timestamp'> {
  return {
    id: randomUUID(), migrationId: MIGRATION_ID, sourceGitCommit: input.sourceGitCommit,
    operatorId: input.operatorId, approvalRef: input.approvalRef, reason: APPLY_AUDIT_REASON,
    clientId: input.suppliedClientId, changeType: 'replace',
    expectedGrantVersion: SOURCE_VERSION, resultingGrantVersion: TARGET_VERSION,
    beforeValue: before, afterValue: after,
  };
}

export async function applyGrant(db: GrantDatabase, input: GrantToolInput): Promise<ApplyResult> {
  try { validateToolInput(input); } catch (error) {
    return { outcome: 'CONFLICT', reason: String(error), classification: 'CONFLICT', bystanderDigest: null, retryAttempted: false, receipt: null };
  }
  let callbackCompleted = false;
  try {
    return await db.$transaction(async (tx) => {
      await takeLocks(tx);
      const plan = await planGrant(tx, input);
      if (plan.planSha256 !== input.planSha256 || plan.preimageDigest !== input.preimageDigest
          || plan.bystanderDigest !== input.bystanderDigest) {
        callbackCompleted = true;
        return { outcome: 'CONFLICT', reason: 'PLAN_OR_PRESTATE_DRIFT', classification: plan.classification, bystanderDigest: plan.bystanderDigest, retryAttempted: false, receipt: null };
      }
      if (plan.outcome === 'CONFLICT') {
        callbackCompleted = true;
        return { outcome: 'CONFLICT', reason: plan.reason, classification: plan.classification, bystanderDigest: plan.bystanderDigest, retryAttempted: false, receipt: null };
      }
      if (plan.outcome === 'NOOP') {
        callbackCompleted = true;
        return { outcome: 'NOOP', reason: null, classification: 'TARGET', bystanderDigest: plan.bystanderDigest, retryAttempted: false, receipt: { outcome: 'NOOP', attempts: 1, retry_attempted: false } };
      }
      const updated = await tx.machineAccessGrant.updateMany({
        where: { machineClientId: plan.clientUuid as string, audienceId: AUDIENCE_ID, version: SOURCE_VERSION, scopes: { equals: [...SOURCE_SCOPES] } },
        data: { scopes: [...TARGET_SCOPES], version: TARGET_VERSION },
      });
      if (updated.count !== 1) {
        callbackCompleted = true;
        return { outcome: 'CONFLICT', reason: 'GRANT_CAS_CONFLICT', classification: 'CONFLICT', bystanderDigest: plan.bystanderDigest, retryAttempted: false, receipt: null };
      }
      const post = await tx.machineAccessGrant.findUnique({
        where: { machineClientId_audienceId: { machineClientId: plan.clientUuid as string, audienceId: AUDIENCE_ID } },
      });
      if (grantState(post) !== 'TARGET') fail('postimage is not exact target');
      const afterRows = await tx.machineAccessGrant.findMany({ select: { machineClientId: true, audienceId: true, scopes: true, version: true } });
      const afterBystander = stableBystanderDigest(afterRows, plan.clientUuid as string);
      if (afterBystander !== plan.bystanderDigest) fail('bystander digest changed');
      const before = auditedBefore(plan.clientId as string, plan.clientUuid as string, afterBystander);
      const after = auditedAfter(plan.clientId as string, plan.clientUuid as string, afterBystander);
      if ((before.preimage_digest as string) !== plan.preimageDigest) fail('preimage digest mismatch');
      const createdAudit = await tx.grantChangeAudit.create({ data: auditData(input, plan.clientUuid as string, before, after) });
      const receipt: ApplyReceipt = {
        schema_version: 1, operation: 'apply', outcome: 'APPLIED', principal_id: PRINCIPAL_ID,
        agent_id: AGENT_ID, client_id: plan.clientId as string, client_uuid: plan.clientUuid as string,
        audience: AUDIENCE_ID, source_scopes: [...SOURCE_SCOPES], source_version: SOURCE_VERSION,
        target_scopes: [...TARGET_SCOPES], target_version: TARGET_VERSION,
        preimage_digest: plan.preimageDigest as string, postimage_digest: after.postimage_digest as string,
        bystander_digest: afterBystander, plan_sha256: plan.planSha256, nonce: input.nonce,
        audit_id: createdAudit.id, source_git_commit: input.sourceGitCommit, operator_id: input.operatorId,
        approval_ref: input.approvalRef, environment: input.environment ?? 'unspecified',
        attempts: 1, retry_attempted: false, utc_time: new Date().toISOString(),
      };
      callbackCompleted = true;
      return { outcome: 'APPLIED', reason: null, classification: 'TARGET', bystanderDigest: afterBystander, retryAttempted: false, receipt };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    return {
      outcome: callbackCompleted ? 'OUTCOME_UNKNOWN' : 'PRECOMMIT_FAILED',
      reason: `${callbackCompleted ? 'COMMIT_OUTCOME_UNKNOWN' : 'PRECOMMIT_FAILURE'}:${error instanceof Error ? error.message : String(error)}`,
      classification: callbackCompleted ? 'TARGET' : 'SOURCE', bystanderDigest: null,
      retryAttempted: false, receipt: null,
    };
  }
}

export async function reconcileGrant(db: GrantDatabase, input: PlanInput): Promise<{ state: 'SOURCE_NO_AUDIT' | 'TARGET_EXACT_AUDIT' | 'ROLLED_BACK' | 'CONFLICT'; writes: 0 }> {
  const plan = await planGrant(db, input);
  const state = plan.outcome === 'APPLY' ? 'SOURCE_NO_AUDIT'
    : plan.outcome === 'NOOP' ? 'TARGET_EXACT_AUDIT'
      : plan.classification === 'ROLLED_BACK' || plan.reason === 'ROLLED_BACK' ? 'ROLLED_BACK' : 'CONFLICT';
  return { state, writes: 0 };
}

const RECEIPT_KEYS = Object.freeze([
  'schema_version', 'operation', 'outcome', 'principal_id', 'agent_id', 'client_id', 'client_uuid',
  'audience', 'source_scopes', 'source_version', 'target_scopes', 'target_version', 'preimage_digest',
  'postimage_digest', 'bystander_digest', 'plan_sha256', 'nonce', 'audit_id', 'source_git_commit',
  'operator_id', 'approval_ref', 'environment', 'attempts', 'retry_attempted', 'utc_time',
]);

function parseReceipt(value: unknown): ApplyReceipt {
  if (!isObject(value)) fail('rollback receipt must be an object');
  if (value.outcome === 'NOOP') fail('NOOP is not a rollback boundary');
  exactKeys(value, RECEIPT_KEYS, 'rollback receipt');
  if (value.schema_version !== 1 || value.operation !== 'apply' || value.outcome !== 'APPLIED'
      || value.principal_id !== PRINCIPAL_ID || value.agent_id !== AGENT_ID
      || value.audience !== AUDIENCE_ID || value.source_version !== SOURCE_VERSION
      || value.target_version !== TARGET_VERSION || !same(value.source_scopes, SOURCE_SCOPES)
      || !same(value.target_scopes, TARGET_SCOPES) || !isUuid(value.client_uuid)
      || typeof value.client_id !== 'string' || !isUuid(value.nonce) || !isUuid(value.audit_id)
      || !isHex(value.preimage_digest, 64) || !isHex(value.postimage_digest, 64)
      || !isHex(value.bystander_digest, 64) || !isHex(value.plan_sha256, 64)
      || !isHex(value.source_git_commit, 40) || value.attempts !== 1 || value.retry_attempted !== false
      || typeof value.utc_time !== 'string' || Number.isNaN(Date.parse(value.utc_time))) {
    fail('rollback receipt does not match exact apply boundary');
  }
  return value as unknown as ApplyReceipt;
}

export async function rollbackGrant(
  db: GrantDatabase,
  receiptValue: unknown,
  input: { operatorId: string; approvalRef: string },
): Promise<RollbackResult> {
  let receipt: ApplyReceipt;
  try {
    receipt = parseReceipt(receiptValue);
    boundedText(input.operatorId, 'operator_id', 256);
    boundedText(input.approvalRef, 'approval_ref', 2048);
  } catch (error) {
    return { outcome: 'REFUSED', reason: String(error), retryAttempted: false, bystanderDigest: null };
  }
  let callbackCompleted = false;
  try {
    return await db.$transaction(async (tx) => {
      await takeLocks(tx);
      const plan = await planGrant(tx, { suppliedClientId: receipt.client_id, bundleVersion: BUNDLE_VERSION, nonce: randomUUID() });
      if (plan.outcome !== 'NOOP' || plan.clientUuid !== receipt.client_uuid
          || plan.bystanderDigest !== receipt.bystander_digest) {
        callbackCompleted = true;
        return { outcome: 'REFUSED', reason: 'CURRENT_STATE_NOT_EXACT_APPLY_BOUNDARY', retryAttempted: false, bystanderDigest: plan.bystanderDigest };
      }
      const audits = await tx.grantChangeAudit.findMany({
        where: { migrationId: MIGRATION_ID, clientId: receipt.client_id }, orderBy: [{ timestamp: 'asc' }],
      });
      if (audits.length !== 1 || audits[0].id !== receipt.audit_id) {
        callbackCompleted = true;
        return { outcome: 'REFUSED', reason: 'APPLY_AUDIT_RECEIPT_MISMATCH', retryAttempted: false, bystanderDigest: plan.bystanderDigest };
      }
      const existingRollback = await tx.grantChangeAudit.findMany({
        where: { migrationId: ROLLBACK_MIGRATION_ID, clientId: receipt.client_id }, orderBy: [{ timestamp: 'asc' }],
      });
      if (existingRollback.length !== 0) {
        callbackCompleted = true;
        return { outcome: 'REFUSED', reason: 'ROLLBACK_AUDIT_ALREADY_EXISTS', retryAttempted: false, bystanderDigest: plan.bystanderDigest };
      }
      const updated = await tx.machineAccessGrant.updateMany({
        where: { machineClientId: receipt.client_uuid, audienceId: AUDIENCE_ID, version: TARGET_VERSION, scopes: { equals: [...TARGET_SCOPES] } },
        data: { scopes: [...SOURCE_SCOPES], version: ROLLBACK_VERSION },
      });
      if (updated.count !== 1) {
        callbackCompleted = true;
        return { outcome: 'REFUSED', reason: 'ROLLBACK_CAS_CONFLICT', retryAttempted: false, bystanderDigest: plan.bystanderDigest };
      }
      const afterRows = await tx.machineAccessGrant.findMany({ select: { machineClientId: true, audienceId: true, scopes: true, version: true } });
      const bystander = stableBystanderDigest(afterRows, receipt.client_uuid);
      if (bystander !== receipt.bystander_digest) fail('bystander digest changed during rollback');
      const rollbackBefore = auditedAfter(receipt.client_id, receipt.client_uuid, bystander);
      const rollbackAfter = {
        agent_id: AGENT_ID, audience: AUDIENCE_ID, bystander_digest: bystander,
        client_id: receipt.client_id, client_uuid: receipt.client_uuid, principal_id: PRINCIPAL_ID,
        postimage_digest: digest(grantProjection({ machineClientId: receipt.client_uuid, audienceId: AUDIENCE_ID, scopes: [...SOURCE_SCOPES], version: ROLLBACK_VERSION }, receipt.client_id)),
        scopes: [...SOURCE_SCOPES], version: ROLLBACK_VERSION,
      };
      await tx.grantChangeAudit.create({ data: {
        id: randomUUID(), migrationId: ROLLBACK_MIGRATION_ID, sourceGitCommit: receipt.source_git_commit,
        operatorId: input.operatorId, approvalRef: input.approvalRef, reason: ROLLBACK_AUDIT_REASON,
        clientId: receipt.client_id, changeType: 'replace', expectedGrantVersion: TARGET_VERSION,
        resultingGrantVersion: ROLLBACK_VERSION, beforeValue: rollbackBefore, afterValue: rollbackAfter,
      } });
      callbackCompleted = true;
      return { outcome: 'ROLLED_BACK', reason: null, retryAttempted: false, bystanderDigest: bystander };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    return {
      outcome: callbackCompleted ? 'OUTCOME_UNKNOWN' : 'PRECOMMIT_FAILED',
      reason: `${callbackCompleted ? 'COMMIT_OUTCOME_UNKNOWN' : 'PRECOMMIT_FAILURE'}:${error instanceof Error ? error.message : String(error)}`,
      retryAttempted: false, bystanderDigest: null,
    };
  }
}

export async function verifyGrant(
  db: GrantDatabase,
  input: { suppliedClientId: string; bundleVersion: string; expectedBystanderDigest: string },
): Promise<{ outcome: 'PASS' | 'FAIL'; reason: string | null; classification: GrantClassification; bystanderDigest: string | null }> {
  const plan = await planGrant(db, { suppliedClientId: input.suppliedClientId, bundleVersion: input.bundleVersion });
  const reason = plan.bystanderDigest !== null && plan.bystanderDigest !== input.expectedBystanderDigest
    ? 'BYSTANDER_DIGEST_CHANGED'
    : plan.outcome !== 'NOOP' ? `TARGET_NOT_EXACT:${plan.reason ?? plan.classification}` : null;
  return { outcome: reason === null ? 'PASS' : 'FAIL', reason, classification: plan.classification, bystanderDigest: plan.bystanderDigest };
}

export function projectTokenClaims(claims: unknown): {
  iss: string; aud: string; sub: string; client_id: string; principal_type: string;
  agent_id: string; scope: string; exp: number;
} {
  if (!isObject(claims)) fail('token claims must be an object');
  const expectedScope = `${INSPECT_SCOPE} ${SEND_SCOPE}`;
  if (claims.aud !== AUDIENCE_ID || claims.sub !== PRINCIPAL_ID || claims.principal_type !== 'agent'
      || claims.agent_id !== AGENT_ID || claims.scope !== expectedScope
      || typeof claims.iss !== 'string' || typeof claims.client_id !== 'string'
      || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    fail('token claims do not match exact two-scope HR projection');
  }
  return {
    iss: claims.iss, aud: claims.aud, sub: claims.sub, client_id: claims.client_id,
    principal_type: claims.principal_type, agent_id: claims.agent_id, scope: claims.scope, exp: claims.exp,
  };
}

function runtimeBundleVersion(): string {
  const snapshot = JSON.parse(readFileSync(new URL('../generated/minimal-auth-v1/runtime-contract.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  if (!isObject(snapshot.payload) || typeof snapshot.payload.contractVersion !== 'string') fail('runtime contract has no bundle version');
  return snapshot.payload.contractVersion;
}

function adapt(client: PrismaClient | Prisma.TransactionClient): GrantDatabase {
  return {
    machinePrincipal: { findUnique: (args) => client.machinePrincipal.findUnique(args as never) as never },
    machineClient: { findMany: (args) => client.machineClient.findMany(args as never) as never },
    authAudience: { findUnique: (args) => client.authAudience.findUnique(args as never) as never },
    machineAccessGrant: {
      findUnique: (args) => client.machineAccessGrant.findUnique(args as never) as never,
      findMany: (args) => client.machineAccessGrant.findMany(args as never) as never,
      updateMany: (args) => client.machineAccessGrant.updateMany(args as never),
    },
    grantChangeAudit: {
      findMany: (args) => client.grantChangeAudit.findMany(args as never) as never,
      create: (args) => client.grantChangeAudit.create(args as never) as never,
    },
    $executeRaw: (query) => client.$executeRawUnsafe(query),
    $transaction: (fn, options) => (client as PrismaClient).$transaction((tx) => fn(adapt(tx)), options as never),
  };
}

function gitHead(): string {
  return execFileSync('/usr/bin/git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  const valueFlags = new Set(['--client-id', '--nonce', '--plan-sha256', '--preimage-digest', '--bystander-digest', '--receipt-file']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (Object.hasOwn(result, arg)) fail(`duplicate argument ${arg}`);
    if (valueFlags.has(arg)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) fail(`${arg} requires a value`);
      result[arg] = value;
    } else if (['--apply', '--reconcile', '--verify', '--rollback'].includes(arg)) result[arg] = true;
    else fail(`unknown argument ${arg}`);
  }
  return result;
}

function requiredArg(args: Record<string, string | true>, key: string): string {
  return boundedText(args[key], key, 2048);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--apply', '--reconcile', '--verify', '--rollback'].filter((key) => args[key] === true);
  if (modes.length > 1) fail('execution modes are mutually exclusive');
  const mode = modes[0] ?? 'plan';
  const clientId = requiredArg(args, '--client-id');
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if ((mode === '--apply' && process.env[APPLY_GATE] !== 'YES')
      || (mode === '--rollback' && process.env[ROLLBACK_GATE] !== 'YES')) {
    fail(`${mode} requires its exact controlled-operation gate`);
  }
  const prisma = new PrismaClient();
  try {
    const db = adapt(prisma);
    if (mode === 'plan') {
      const plan = await planGrant(db, { suppliedClientId: clientId, bundleVersion: runtimeBundleVersion(), nonce: typeof args['--nonce'] === 'string' ? args['--nonce'] : undefined });
      process.stdout.write(`${JSON.stringify({ ...plan.planDocument, plan_sha256: plan.planSha256, writes: 0 }, null, 2)}\n`);
      return;
    }
    if (mode === '--reconcile') {
      process.stdout.write(`${JSON.stringify(await reconcileGrant(db, { suppliedClientId: clientId, bundleVersion: runtimeBundleVersion() }), null, 2)}\n`);
      return;
    }
    if (mode === '--verify') {
      const result = await verifyGrant(db, { suppliedClientId: clientId, bundleVersion: runtimeBundleVersion(), expectedBystanderDigest: requiredArg(args, '--bystander-digest') });
      process.stdout.write(`${JSON.stringify({ ...result, writes: 0 }, null, 2)}\n`);
      return;
    }
    const operatorId = boundedText(process.env[OPERATOR_ENV], OPERATOR_ENV, 256);
    const approvalRef = boundedText(process.env[APPROVAL_ENV], APPROVAL_ENV, 2048);
    if (mode === '--rollback') {
      const receipt = JSON.parse(readFileSync(requiredArg(args, '--receipt-file'), 'utf8')) as unknown;
      process.stdout.write(`${JSON.stringify(await rollbackGrant(db, receipt, { operatorId, approvalRef }), null, 2)}\n`);
      return;
    }
    const result = await applyGrant(db, {
      suppliedClientId: clientId, bundleVersion: runtimeBundleVersion(), nonce: requiredArg(args, '--nonce'),
      planSha256: requiredArg(args, '--plan-sha256'), preimageDigest: requiredArg(args, '--preimage-digest'),
      bystanderDigest: requiredArg(args, '--bystander-digest'), operatorId, approvalRef,
      sourceGitCommit: gitHead(), environment: process.env.NODE_ENV ?? 'unspecified',
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally { await prisma.$disconnect(); }
}

const direct = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (direct) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
