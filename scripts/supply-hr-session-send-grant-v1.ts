/**
 * supply-hr-session-send-grant-v1.ts — controlled one-tuple HR agent.session.send
 * Grant provisioning / readback / rollback vehicle.
 *
 * Authority: accepted AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1
 * (contracts CTR-HRG-001..005; implementation_authority: contracts).
 *
 *   PRODUCTION_APPLY_AUTHORITY = none
 *   IMPLEMENTATION = source-only vehicle authoring
 *   PRODUCTION_MUTATION = NONE (this source change performs no database write)
 *
 * The sole intended recipient is the existing formal HR orchestration Principal
 * dc702687-6515-4a2a-91ae-e572a9bbd766 (AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2
 * CTR-HRG-001): principal_type `agent`,
 * status `active`, disabled_at null, canonical agent_id `agt_hr-agent` (legacy `hr-agent` fails this binding fail-closed). Exactly ONE
 * active MachineClient is mechanically bound to that Principal; the operator
 * supplies that client's PUBLIC client_id (obtained from the fresh runtime
 * census / Broker credential binding) and the tool verifies — from Auth's
 * server-side client->Principal relation — that exactly one active client is
 * bound and that its public client_id equals the supplied one. No credential,
 * secret, token or hash value is ever selected, read, printed, or required; the
* client is referenced by its public client_id only.
 *
* Runbook note (implementation audit 2026-09-05): rollback intentionally
* re-checks the frozen HR identity before acting; if the HR Principal itself
* was disabled after activation, rollback refuses with IDENTITY_DRIFT and
* revocation needs a separately authorized operation under applicable
* authority (never this path).
 *
 * The only allowed permission delta (CTR-HRG-002) is the selected client's
 * single row (machine_client_id, `agent-session-messaging`) with exactly
 * scopes=[agent.session.send], version=1, live. An absent row MAY be created.
 * An exact tombstone (version=0 carrying the exact scope; the physical
 * tombstone marker is version<1 per Spec section 12 — machine_access_grants
 * carries no revoked_at column) MAY be reactivated to version=1 with scopes
 * unchanged. An already-live exact row returns verified NOOP without write and
 * without a second creation audit. Every other row/scopes/version/concurrent
 * drift fails closed: no overwrite, union, DELETE or broad upsert. Every other
 * grant row — including HR Workflow grants and efficiency's send/scheduler
 * grants — must remain byte-equivalent in the stable semantic projection
 * (unrelated grant digest).
 *
 * Apply (CTR-HRG-003) holds one Serializable transaction that fresh-reads and
 * re-validates identity, audience and the exact Grant preimage, mutates only
 * via compare-and-set, and commits a nonce-unique auth_security_audits entry in
 * the SAME transaction with the closed detail envelope and the bounded reason
 * `HR_WORKFLOW_ORCHESTRATION_AGENT_SESSION_SEND_ACTIVATION`. Unknown commit
 * outcome stops everything (no auto-retry); a fresh read-only census may
 * classify nonce receipt and row state before any separately authorized
 * recovery. The receipt binds source/authority/runbook hashes, UTC time,
 * environment label, pre/post digests, audit correlation id, outcome and the
 * rollback boundary (exact postimage + nonce).
 *
 * Rollback (CTR-HRG-005) acts only if the live row exactly matches the
 * receipt's postimage AND the nonce receipt (the activation audit row) matches;
 * it tombstones the row (version 1 -> 0, scopes/identity preserved), never
 * deletes, and commits its own nonce-unique audit with the bounded reason
 * `HR_AGENT_SESSION_SEND_FAILED_ACTIVATION_ROLLBACK` atomically. Drift,
 * unknown receipts and accepted live NOOP rows are never touched.
 *
 * Modes (mutually exclusive):
 *   plan       (default) read-only census: classification
 *              absent|reactivatible|live_noop|conflict, preimage digest,
 *              unrelated grant digest, nonce
 *   --apply    guarded mutation; requires HR_SEND_GRANT_APPLY=YES plus
 *              HR_SEND_GRANT_OPERATOR / HR_SEND_GRANT_APPROVAL_REF; refusal on
 *              a missing gate happens BEFORE any database connection
 *   --verify   readback of the exact live row + unrelated digest + classification
 *   --rollback tombstones the row guarded by the apply receipt's exact
 *              postimage and nonce; refuses everything else
 *
 * All modes require --client-id <public HR client id> and DATABASE_URL.
 * Advisory lock key 813_947_206 is distinct from 813_947_201..205.
 */

import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

// ─── Frozen constants (CTR-HRG-001/002/003/005) ─────────────────────────────

export const PRINCIPAL_ID = 'dc702687-6515-4a2a-91ae-e572a9bbd766';
/** Legacy OpenClaw-era HR identity — MUST NOT be the subject nor receive this Grant (AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2 CTR-HRG-001). */
export const LEGACY_PRINCIPAL_ID = 'bc970ced-710f-4479-9ff0-e295a1c59424';
export const PRINCIPAL_TYPE = 'agent';
export const AGENT_ID = 'agt_hr-agent';
export const AUDIENCE_ID = 'agent-session-messaging';
export const TARGET_SCOPE = 'agent.session.send';
export const TARGET_SCOPES = Object.freeze([TARGET_SCOPE]);
export const LIVE_VERSION = 1;
export const TOMBSTONE_VERSION = 0;
export const MIGRATION_ID = 'hr-session-send-grant-v1';
export const APPLY_REASON = 'HR_WORKFLOW_ORCHESTRATION_AGENT_SESSION_SEND_ACTIVATION';
export const ROLLBACK_REASON = 'HR_AGENT_SESSION_SEND_FAILED_ACTIVATION_ROLLBACK';
export const APPLY_ENV_GATE = 'HR_SEND_GRANT_APPLY';
export const OPERATOR_ENV = 'HR_SEND_GRANT_OPERATOR';
export const APPROVAL_REF_ENV = 'HR_SEND_GRANT_APPROVAL_REF';
export const RUNBOOK_ENV = 'HR_SEND_GRANT_RUNBOOK_SHA256';
export const ENVIRONMENT_ENV = 'HR_SEND_GRANT_ENVIRONMENT';
export const SOURCE_SPEC_ID = 'AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1';
export const SOURCE_SPEC_COMMIT = '9b3b4bdb0016ec40bab2419bbf15dc886f40476f';
export const PLAN_VERSION = 'AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1_PLAN_1';
export const APPLY_AUDIT_EVENT_TYPE = 'machine_grant.hr_session_send_activation';
export const ROLLBACK_AUDIT_EVENT_TYPE = 'machine_grant.hr_session_send_rollback';
export const AUDIT_RESULT = 'success';
// Distinct from Stage W (813_947_201), Stage F (813_947_202), the svc-forum
// audience reconciliation (813_947_203), legacy Grant narrowing (813_947_204),
// and the forum moderator supply (813_947_205).
export const ADVISORY_LOCK_KEY = 813_947_206;

/** The exact CCR-registered audience entry (contract bundle audience registry). */
export const FROZEN_AUDIENCE_ROW = Object.freeze({
  audienceId: AUDIENCE_ID,
  resourceService: 'agent-session-messaging',
  scopeNamespace: 'agent',
  acceptedPrincipalTypes: Object.freeze(['agent']),
  registeredScopes: Object.freeze([TARGET_SCOPE]),
  humanAccessEnabled: false,
  machineAccessEnabled: true,
  delegatedAccessEnabled: false,
  status: 'active',
  freezeReady: true,
  version: 1,
});

/** Closed audit detail envelope (CTR-HRG-003): exactly these keys, no more. */
export const AUDIT_DETAIL_KEYS = Object.freeze([
  'activation',
  'agent_id',
  'approval_ref',
  'audience',
  'client_id',
  'client_uuid',
  'migration_id',
  'new_version',
  'old_version',
  'operator',
  'preimage_digest',
  'principal_uuid',
  'reason',
  'scopes',
]);

// ─── Adapter model (injectable for fixture conformance) ─────────────────────

export interface ToolAudienceRow {
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

export interface ToolPrincipalRow {
  id: string;
  principalType: string;
  status: string;
  disabledAt: Date | null;
  agentId: string | null;
}

export interface ToolClientRow {
  id: string;
  clientId: string;
  status: string;
  revokedAt: Date | null;
}

export interface ToolGrantRow {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}

export interface ToolAuditRow {
  id: string;
  eventType: string;
  result: string;
  requestCorrelationId: string | null;
  details: unknown;
}

export interface HrSendGrantDatabase {
  machinePrincipal: {
    findUnique(args: { where: { id: string } }): Promise<ToolPrincipalRow | null>;
  };
  machineClient: {
    findMany(args: {
      where: { machinePrincipalId: string };
      select: { id: true; clientId: true; status: true; revokedAt: true };
    }): Promise<ToolClientRow[]>;
  };
  machineAccessGrant: {
    findUnique(args: {
      where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } };
    }): Promise<ToolGrantRow | null>;
    findMany(args: {
      select: { machineClientId: true; audienceId: true; scopes: true; version: true };
    }): Promise<ToolGrantRow[]>;
    create(args: {
      data: { machineClientId: string; audienceId: string; scopes: string[]; version: number };
    }): Promise<unknown>;
    updateMany(args: {
      where: {
        machineClientId: string;
        audienceId: string;
        version: number;
        scopes: { equals: string[] };
      };
      data: { version: number };
    }): Promise<{ count: number }>;
  };
  authAudience: {
    findUnique(args: { where: { audienceId: string } }): Promise<ToolAudienceRow | null>;
  };
  authSecurityAudit: {
    findFirst(args: { where: { requestCorrelationId: string } }): Promise<ToolAuditRow | null>;
    create(args: {
      data: {
        id: string;
        eventType: string;
        result: string;
        requestCorrelationId: string;
        details: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
  $executeRaw(query: string): Promise<unknown>;
  $transaction<T>(
    fn: (tx: HrSendGrantDatabase) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' },
  ): Promise<T>;
}

// ─── Shared types ───────────────────────────────────────────────────────────

export type AudienceState = 'ABSENT' | 'EXACT' | 'DRIFTED';
export type GrantClassification = 'ABSENT' | 'REACTIVATIBLE' | 'LIVE_NOOP' | 'CONFLICT';
export type PlanOutcome = 'CREATE' | 'REACTIVATE' | 'NOOP' | 'ABORT';
export type ApplyOutcome = 'CREATED' | 'REACTIVATED' | 'NOOP' | 'ABORT'
  | 'PRECOMMIT_FAILED' | 'OUTCOME_UNKNOWN';
export type RollbackOutcome = 'TOMBSTONED' | 'REFUSED' | 'PRECOMMIT_FAILED' | 'OUTCOME_UNKNOWN';

export interface ToolInput {
  suppliedClientId: string;
  operatorId: string;
  approvalRef: string;
  sourceGitCommit: string;
  runbookSha256?: string;
  environment?: string;
}

export interface GrantPlan {
  outcome: PlanOutcome;
  abortReason: string | null;
  classification: GrantClassification;
  audience: AudienceState;
  principal: {
    found: boolean;
    principalType: string | null;
    status: string | null;
    disabledAtNull: boolean | null;
    agentIdMatches: boolean | null;
  };
  binding: {
    activeClientCount: number;
    uniqueActiveClientId: string | null;
    uniqueActiveClientUuid: string | null;
    matchesSuppliedClientId: boolean;
  };
  audienceVersion: number | null;
  preimageDigest: string | null;
  unrelatedGrantDigest: string | null;
  nonce: string;
  planSha256: string;
  planDocument: Record<string, unknown>;
}

export interface GrantApplyResult {
  outcome: ApplyOutcome;
  abortReason: string | null;
  classification: GrantClassification;
  unrelatedGrantDigest: string | null;
  preimageDigest: string | null;
  postimageDigest: string | null;
  nonce: string | null;
  auditCorrelationId: string | null;
  receipt: Record<string, unknown> | null;
}

export interface GrantRollbackResult {
  outcome: RollbackOutcome;
  refusalReason: string | null;
  classificationAfter: GrantClassification;
  unrelatedGrantDigest: string | null;
  nonce: string | null;
  auditCorrelationId: string | null;
  rollbackAuditId: string | null;
}

export interface GrantVerifyResult {
  outcome: 'PASS' | 'FAIL';
  failureReason: string | null;
  classification: GrantClassification;
  audience: AudienceState;
  unrelatedGrantDigest: string | null;
}

// ─── Canonical JSON / digest helpers ────────────────────────────────────────

function fail(message: string): never {
  throw new Error(`hr-session-send grant supply refused: ${message}`);
}

function asciiCompare(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));
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

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort(asciiCompare).map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b));
}

function sortedScopes(scopes: readonly string[]): string[] {
  return [...scopes].sort(asciiCompare);
}

function sha256Hex(value: unknown): string {
  return createHash('sha256')
    .update(Buffer.from(JSON.stringify(canonicalJson(value)), 'utf8'))
    .digest('hex');
}

function isHex64(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function randomUuid(): string {
  return randomUUID();
}

/**
 * Stable semantic projection of every grant row EXCEPT the target tuple's row
 * (CTR-HRG-002: every other row, including HR Workflow grants and efficiency's
 * send/scheduler grants, must remain byte-equivalent in this projection).
 */
export function unrelatedGrantDigest(grants: ToolGrantRow[], targetInternalClientId: string): string {
  const projection = grants
    .filter((grant) => !(grant.machineClientId === targetInternalClientId && grant.audienceId === AUDIENCE_ID))
    .map((grant) => ({
      machineClientId: grant.machineClientId,
      audienceId: grant.audienceId,
      scopes: sortedScopes(grant.scopes),
      version: grant.version,
    }))
    .sort((a, b) => asciiCompare(`${a.machineClientId}\0${a.audienceId}`, `${b.machineClientId}\0${b.audienceId}`));
  return sha256Hex(projection);
}

/** Complete target Grant preimage projection (absence is a digestable preimage). */
function grantPreimage(row: ToolGrantRow | null, clientUuid: string): Record<string, unknown> {
  if (row === null) {
    return { audience_id: AUDIENCE_ID, machine_client_uuid: clientUuid, state: 'absent' };
  }
  return {
    audience_id: AUDIENCE_ID,
    machine_client_uuid: clientUuid,
    scopes: sortedScopes(row.scopes),
    state: 'row',
    version: row.version,
  };
}

// ─── Classification (CTR-HRG-001/002) ───────────────────────────────────────

function classifyAudience(row: ToolAudienceRow | null): AudienceState {
  if (row === null) return 'ABSENT';
  const exact = row.audienceId === FROZEN_AUDIENCE_ROW.audienceId
    && row.resourceService === FROZEN_AUDIENCE_ROW.resourceService
    && row.scopeNamespace === FROZEN_AUDIENCE_ROW.scopeNamespace
    && sameJson(sortedScopes(row.acceptedPrincipalTypes), [...FROZEN_AUDIENCE_ROW.acceptedPrincipalTypes])
    && sameJson(sortedScopes(row.registeredScopes), [...FROZEN_AUDIENCE_ROW.registeredScopes])
    && row.humanAccessEnabled === FROZEN_AUDIENCE_ROW.humanAccessEnabled
    && row.machineAccessEnabled === FROZEN_AUDIENCE_ROW.machineAccessEnabled
    && row.delegatedAccessEnabled === FROZEN_AUDIENCE_ROW.delegatedAccessEnabled
    && row.status === FROZEN_AUDIENCE_ROW.status
    && row.freezeReady === FROZEN_AUDIENCE_ROW.freezeReady
    && row.version === FROZEN_AUDIENCE_ROW.version;
  return exact ? 'EXACT' : 'DRIFTED';
}

/**
 * CTR-HRG-002 row families. The physical tombstone marker is version<1
 * (Spec section 12: "version<1 denial"); machine_access_grants carries no
 * revoked_at column, so an exact tombstone is version=0 with the exact scope.
 */
function classifyGrant(row: ToolGrantRow | null): GrantClassification {
  if (row === null) return 'ABSENT';
  if (!sameJson(sortedScopes(row.scopes), [...TARGET_SCOPES])) return 'CONFLICT';
  if (row.version === TOMBSTONE_VERSION) return 'REACTIVATIBLE';
  if (row.version === LIVE_VERSION) return 'LIVE_NOOP';
  return 'CONFLICT';
}

function planOutcomeFor(classification: GrantClassification): PlanOutcome {
  if (classification === 'ABSENT') return 'CREATE';
  if (classification === 'REACTIVATIBLE') return 'REACTIVATE';
  if (classification === 'LIVE_NOOP') return 'NOOP';
  return 'ABORT';
}

function planOperationFor(classification: GrantClassification): string {
  if (classification === 'ABSENT') return 'CREATE_EXACT_ROW';
  if (classification === 'REACTIVATIBLE') return 'REACTIVATE_TOMBSTONE';
  if (classification === 'LIVE_NOOP') return 'NONE';
  return 'REFUSED';
}

async function takeTransactionLocks(db: HrSendGrantDatabase): Promise<void> {
  // Table locks first, advisory last (template family form): every table the
  // census reads is locked before the Serializable snapshot is taken, and the
  // written tables take write-conflict locks. The advisory lock serializes
  // cooperating operators of this vehicle.
  await db.$executeRaw('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
  await db.$executeRaw('LOCK TABLE machine_clients IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE machine_principals IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE auth_audiences IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE auth_security_audits IN SHARE ROW EXCLUSIVE MODE');
  await db.$executeRaw(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);
}

// ─── Plan (read-only census, CTR-HRG-001) ───────────────────────────────────

/**
 * Read-only live census. Binds the exact nonsecret IDs (Principal UUID/type/
 * status/agent_id, the single active client's public id + internal uuid,
 * audience row/version/registered scope, the complete target Grant preimage and
 * the unrelated Grant digest) to a fresh run nonce and the plan document digest.
 * Any ambiguity, disabled state, mismatch or drifted audience aborts without
 * mutation.
 */
export async function planGrant(
  db: HrSendGrantDatabase,
  input: Pick<ToolInput, 'suppliedClientId'> & { runbookSha256?: string; nonce?: string },
): Promise<GrantPlan> {
  const nonce = input.nonce ?? randomUuid();
  const runbookSha256 = input.runbookSha256 ?? 'unspecified';

  const abort = (
    abortReason: string,
    audience: AudienceState,
    principalView: GrantPlan['principal'],
    binding: GrantPlan['binding'] | null,
    audienceVersion: number | null,
    preimageDigest: string | null,
  ): GrantPlan => {
    const bindingView = binding ?? {
      activeClientCount: 0,
      matchesSuppliedClientId: false,
      uniqueActiveClientId: null,
      uniqueActiveClientUuid: null,
    };
    const planDocument = {
      audience_id: AUDIENCE_ID,
      audience_registered_scopes: [...FROZEN_AUDIENCE_ROW.registeredScopes],
      audience_version: audienceVersion,
      abort_reason: abortReason,
      agent_id: AGENT_ID,
      binding: bindingView,
      classification: 'CONFLICT' as GrantClassification,
      nonce,
      operation: 'REFUSED',
      outcome: 'ABORT',
      plan_version: PLAN_VERSION,
      preimage_digest: preimageDigest,
      principal_id: PRINCIPAL_ID,
      principal_type: PRINCIPAL_TYPE,
      runbook_sha256: runbookSha256,
      source_spec_commit: SOURCE_SPEC_COMMIT,
      source_spec_id: SOURCE_SPEC_ID,
      target_scopes: [...TARGET_SCOPES],
      target_version: LIVE_VERSION,
      unrelated_grant_digest: null,
    };
    return {
      outcome: 'ABORT',
      abortReason,
      classification: 'CONFLICT',
      audience,
      principal: principalView,
      binding: bindingView,
      audienceVersion,
      preimageDigest,
      unrelatedGrantDigest: null,
      nonce,
      planSha256: sha256Hex(planDocument),
      planDocument,
    };
  };

  const principalViewFound = (principal: ToolPrincipalRow): GrantPlan['principal'] => ({
    found: true,
    principalType: principal.principalType,
    status: principal.status,
    disabledAtNull: principal.disabledAt === null,
    agentIdMatches: principal.agentId === AGENT_ID,
  });
  const noPrincipal: GrantPlan['principal'] = {
    found: false,
    principalType: null,
    status: null,
    disabledAtNull: null,
    agentIdMatches: null,
  };

  const audienceRow = await db.authAudience.findUnique({ where: { audienceId: AUDIENCE_ID } });
  if (audienceRow === null) {
    return abort('AUDIENCE_ABSENT', 'ABSENT', noPrincipal, null, null, null);
  }
  const audience = classifyAudience(audienceRow);
  if (audience !== 'EXACT') {
    return abort('AUDIENCE_DRIFTED', audience, noPrincipal, null, audienceRow.version, null);
  }

  const principal = await db.machinePrincipal.findUnique({ where: { id: PRINCIPAL_ID } });
  if (principal === null) {
    return abort('PRINCIPAL_NOT_FOUND', audience, noPrincipal, null, FROZEN_AUDIENCE_ROW.version, null);
  }
  if (principal.principalType !== PRINCIPAL_TYPE) {
    return abort('PRINCIPAL_NOT_AGENT', audience, principalViewFound(principal), null, FROZEN_AUDIENCE_ROW.version, null);
  }
  if (principal.status !== 'active' || principal.disabledAt !== null) {
    return abort('PRINCIPAL_DISABLED', audience, principalViewFound(principal), null, FROZEN_AUDIENCE_ROW.version, null);
  }
  if (principal.agentId !== AGENT_ID) {
    return abort('PRINCIPAL_AGENT_ID_MISMATCH', audience, principalViewFound(principal), null, FROZEN_AUDIENCE_ROW.version, null);
  }

  const clients = await db.machineClient.findMany({
    where: { machinePrincipalId: principal.id },
    select: { id: true, clientId: true, status: true, revokedAt: true },
  });
  const activeClients = clients.filter((client) => client.status === 'active' && client.revokedAt === null);
  if (activeClients.length === 0) {
    return abort('NO_ACTIVE_CLIENT', audience, principalViewFound(principal), null, FROZEN_AUDIENCE_ROW.version, null);
  }
  if (activeClients.length > 1) {
    return abort('AMBIGUOUS_BINDING', audience, principalViewFound(principal), null, FROZEN_AUDIENCE_ROW.version, null);
  }

  const target = activeClients[0] as ToolClientRow;
  const binding: GrantPlan['binding'] = {
    activeClientCount: 1,
    uniqueActiveClientId: target.clientId,
    uniqueActiveClientUuid: target.id,
    matchesSuppliedClientId: target.clientId === input.suppliedClientId,
  };
  if (!binding.matchesSuppliedClientId) {
    return abort('CLIENT_MISMATCH', audience, principalViewFound(principal), binding, FROZEN_AUDIENCE_ROW.version, null);
  }

  const grantRow = await db.machineAccessGrant.findUnique({
    where: { machineClientId_audienceId: { machineClientId: target.id, audienceId: AUDIENCE_ID } },
  });
  const classification = classifyGrant(grantRow);
  const preimageDigest = sha256Hex(grantPreimage(grantRow, target.id));

  if (classification === 'CONFLICT') {
    return abort('GRANT_CONFLICT', audience, principalViewFound(principal), binding, FROZEN_AUDIENCE_ROW.version, preimageDigest);
  }

  const allGrants = await db.machineAccessGrant.findMany({
    select: { machineClientId: true, audienceId: true, scopes: true, version: true },
  });
  const unrelatedDigest = unrelatedGrantDigest(allGrants, target.id);

  const planDocument = {
    audience_id: AUDIENCE_ID,
    audience_registered_scopes: sortedScopes(audienceRow.registeredScopes),
    audience_version: audienceRow.version,
    abort_reason: null,
    agent_id: AGENT_ID,
    binding: {
      activeClientCount: 1,
      matchesSuppliedClientId: true,
      uniqueActiveClientId: target.clientId,
      uniqueActiveClientUuid: target.id,
    },
    classification,
    nonce,
    operation: planOperationFor(classification),
    outcome: planOutcomeFor(classification),
    plan_version: PLAN_VERSION,
    preimage_digest: preimageDigest,
    principal_id: PRINCIPAL_ID,
    principal_type: PRINCIPAL_TYPE,
    runbook_sha256: runbookSha256,
    source_spec_commit: SOURCE_SPEC_COMMIT,
    source_spec_id: SOURCE_SPEC_ID,
    target_scopes: [...TARGET_SCOPES],
    target_version: LIVE_VERSION,
    unrelated_grant_digest: unrelatedDigest,
  };

  return {
    outcome: planOutcomeFor(classification),
    abortReason: null,
    classification,
    audience,
    principal: principalViewFound(principal),
    binding,
    audienceVersion: audienceRow.version,
    preimageDigest,
    unrelatedGrantDigest: unrelatedDigest,
    nonce,
    planSha256: sha256Hex(planDocument),
    planDocument,
  };
}

// ─── Audit envelope (closed details, CTR-HRG-003/005) ───────────────────────

function auditDetails(input: {
  operatorId: string;
  approvalRef: string;
  reason: string;
  clientUuid: string;
  clientId: string;
  oldVersion: number | null;
  newVersion: number;
  preimageDigest: string;
  activation: 'created' | 'reactivated' | 'tombstoned';
}): Record<string, unknown> {
  const details = {
    activation: input.activation,
    agent_id: AGENT_ID,
    approval_ref: input.approvalRef,
    audience: AUDIENCE_ID,
    client_id: input.clientId,
    client_uuid: input.clientUuid,
    migration_id: MIGRATION_ID,
    new_version: input.newVersion,
    old_version: input.oldVersion,
    operator: input.operatorId,
    preimage_digest: input.preimageDigest,
    principal_uuid: PRINCIPAL_ID,
    reason: input.reason,
    scopes: [...TARGET_SCOPES],
  };
  exactKeys(details, AUDIT_DETAIL_KEYS, 'audit details');
  return details;
}

// ─── Apply (single guarded Serializable transaction, CTR-HRG-003) ───────────

/** Exported for fixture conformance tests; the CLI path is executeApply only. */
export async function applyInTransaction(
  tx: HrSendGrantDatabase,
  input: ToolInput,
  nonce: string,
): Promise<GrantApplyResult> {  await takeTransactionLocks(tx);

  // Fresh re-read of identity, audience and the exact Grant inside the
  // transaction (CTR-HRG-003): the plan preimage is revalidated here, never
  // trusted across processes.
  const census = await planGrant(tx, { suppliedClientId: input.suppliedClientId, nonce });
  if (census.outcome === 'ABORT') {
    return {
      outcome: 'ABORT',
      abortReason: census.abortReason,
      classification: census.classification,
      unrelatedGrantDigest: census.unrelatedGrantDigest,
      preimageDigest: census.preimageDigest,
      postimageDigest: null,
      nonce,
      auditCorrelationId: null,
      receipt: null,
    };
  }

  const targetUuid = census.binding.uniqueActiveClientUuid as string;
  const targetClientId = census.binding.uniqueActiveClientId as string;

  if (census.classification === 'LIVE_NOOP') {
    // CTR-HRG-002: verified NOOP — no write, no second creation audit.
    // CTR-HRG-005: accepted live NOOP rows are never revoked by rollback.
    return {
      outcome: 'NOOP',
      abortReason: null,
      classification: census.classification,
      unrelatedGrantDigest: census.unrelatedGrantDigest,
      preimageDigest: census.preimageDigest,
      postimageDigest: census.preimageDigest,
      nonce,
      auditCorrelationId: null,
      receipt: {
        audit_correlation_id: null,
        audience: AUDIENCE_ID,
        client_id: targetClientId,
        client_uuid: targetUuid,
        environment: input.environment ?? 'unspecified',
        nonce,
        note: 'LIVE_NOOP: exact row already live; no write, no creation audit; never rolled back',
        outcome: 'NOOP',
        plan_sha256: census.planSha256,
        postimage_digest: census.preimageDigest,
        preimage_digest: census.preimageDigest,
        principal_uuid: PRINCIPAL_ID,
        rollback: {
          eligible: false,
          reason: 'ACCEPTED_LIVE_NOOP_ROWS_ARE_NEVER_REVOKED_BY_THIS_OPERATION',
        },
        runbook_sha256: input.runbookSha256 ?? 'unspecified',
        source_git_commit: input.sourceGitCommit,
        source_spec_commit: SOURCE_SPEC_COMMIT,
        source_spec_id: SOURCE_SPEC_ID,
        utc_time: new Date().toISOString(),
      },
    };
  }

  // Nonce uniqueness: the activation audit entry must be nonce-unique.
  const priorAudit = await tx.authSecurityAudit.findFirst({ where: { requestCorrelationId: nonce } });
  if (priorAudit !== null) {
    return {
      outcome: 'ABORT',
      abortReason: 'AUDIT_NONCE_REPLAY',
      classification: census.classification,
      unrelatedGrantDigest: census.unrelatedGrantDigest,
      preimageDigest: census.preimageDigest,
      postimageDigest: null,
      nonce,
      auditCorrelationId: null,
      receipt: null,
    };
  }

  let oldVersion: number | null;
  let activation: 'created' | 'reactivated';
  if (census.classification === 'ABSENT') {
    oldVersion = null;
    activation = 'created';
    // Compare-and-set style guarded create: the Serializable snapshot plus the
    // census proved the row absent; a primary-key collision here is a failure,
    // never an upsert.
    await tx.machineAccessGrant.create({
      data: {
        machineClientId: targetUuid,
        audienceId: AUDIENCE_ID,
        scopes: [...TARGET_SCOPES],
        version: LIVE_VERSION,
      },
    });
  } else {
    // Exact tombstone reactivation via conditional CAS 0 -> 1; any concurrent
    // drift makes the guarded update affect zero rows and fail closed.
    oldVersion = TOMBSTONE_VERSION;
    activation = 'reactivated';
    const updated = await tx.machineAccessGrant.updateMany({
      where: {
        machineClientId: targetUuid,
        audienceId: AUDIENCE_ID,
        version: TOMBSTONE_VERSION,
        scopes: { equals: [...TARGET_SCOPES] },
      },
      data: { version: LIVE_VERSION },
    });
    if (updated.count !== 1) {
      return {
        outcome: 'ABORT',
        abortReason: 'CONCURRENT_TOMBSTONE_DRIFT',
        classification: census.classification,
        unrelatedGrantDigest: census.unrelatedGrantDigest,
        preimageDigest: census.preimageDigest,
        postimageDigest: null,
        nonce,
        auditCorrelationId: null,
        receipt: null,
      };
    }
  }

  // Post-write readback: the row must now be exactly live target state.
  const afterRow = await tx.machineAccessGrant.findUnique({
    where: { machineClientId_audienceId: { machineClientId: targetUuid, audienceId: AUDIENCE_ID } },
  });
  if (afterRow === null || classifyGrant(afterRow) !== 'LIVE_NOOP') {
    fail('post-write grant row does not equal the exact live target state');
  }
  const postimageDigest = sha256Hex(grantPreimage(afterRow, targetUuid));

  const allGrantsAfter = await tx.machineAccessGrant.findMany({
    select: { machineClientId: true, audienceId: true, scopes: true, version: true },
  });
  const unrelatedDigestAfter = unrelatedGrantDigest(allGrantsAfter, targetUuid);
  if (census.unrelatedGrantDigest !== unrelatedDigestAfter) {
    fail('unrelated grant projection changed inside the apply transaction');
  }

  const auditId = randomUuid();
  const details = auditDetails({
    operatorId: input.operatorId,
    approvalRef: input.approvalRef,
    reason: APPLY_REASON,
    clientUuid: targetUuid,
    clientId: targetClientId,
    oldVersion,
    newVersion: LIVE_VERSION,
    preimageDigest: census.preimageDigest as string,
    activation,
  });
  await tx.authSecurityAudit.create({
    data: {
      id: auditId,
      eventType: APPLY_AUDIT_EVENT_TYPE,
      result: AUDIT_RESULT,
      requestCorrelationId: nonce,
      details,
    },
  });
  const persisted = await tx.authSecurityAudit.findFirst({ where: { requestCorrelationId: nonce } });
  if (persisted === null || persisted.id !== auditId
      || persisted.eventType !== APPLY_AUDIT_EVENT_TYPE
      || persisted.result !== AUDIT_RESULT
      || !sameJson(persisted.details, details)) {
    fail('persisted activation audit does not equal the frozen audit envelope');
  }

  const receipt: Record<string, unknown> = {
    approval_ref: input.approvalRef,
    audit_correlation_id: nonce,
    audience: AUDIENCE_ID,
    client_id: targetClientId,
    client_uuid: targetUuid,
    environment: input.environment ?? 'unspecified',
    migration_id: MIGRATION_ID,
    new_version: LIVE_VERSION,
    nonce,
    old_version: oldVersion,
    operator: input.operatorId,
    outcome: activation === 'created' ? 'CREATED' : 'REACTIVATED',
    plan_sha256: census.planSha256,
    postimage: {
      audience_id: AUDIENCE_ID,
      machine_client_uuid: targetUuid,
      scopes: [...TARGET_SCOPES],
      version: LIVE_VERSION,
    },
    postimage_digest: postimageDigest,
    preimage_digest: census.preimageDigest,
    principal_uuid: PRINCIPAL_ID,
    reason: APPLY_REASON,
    rollback: {
      eligible: true,
      postimage_digest: postimageDigest,
      requires: 'exact live row equal to postimage AND activation audit nonce receipt match',
      tombstone_reason: ROLLBACK_REASON,
      tombstone_version: TOMBSTONE_VERSION,
    },
    runbook_sha256: input.runbookSha256 ?? 'unspecified',
    scopes: [...TARGET_SCOPES],
    source_git_commit: input.sourceGitCommit,
    source_spec_commit: SOURCE_SPEC_COMMIT,
    source_spec_id: SOURCE_SPEC_ID,
    unrelated_grant_digest: unrelatedDigestAfter,
    utc_time: new Date().toISOString(),
  };

  return {
    outcome: activation === 'created' ? 'CREATED' : 'REACTIVATED',
    abortReason: null,
    classification: 'LIVE_NOOP',
    unrelatedGrantDigest: unrelatedDigestAfter,
    preimageDigest: census.preimageDigest,
    postimageDigest,
    nonce,
    auditCorrelationId: nonce,
    receipt,
  };
}

/**
 * Wraps the guarded transaction with CTR-HRG-003 outcome classification: a
 * failure before commit leaves Grant and audit unchanged (PRECOMMIT_FAILED);
 * an unknown commit outcome stops everything (OUTCOME_UNKNOWN) — never retried
 * by this tool. Drift aborts return ABORT with zero writes.
 */
export async function executeApply(db: HrSendGrantDatabase, input: ToolInput): Promise<GrantApplyResult> {
  const nonce = randomUuid();
  let callbackCompleted = false;
  try {
    const result = await db.$transaction(async (tx) => {
      const inner = await applyInTransaction(tx, input, nonce);
      callbackCompleted = true;
      return inner;
    }, { isolationLevel: 'Serializable' });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (callbackCompleted) {
      return {
        outcome: 'OUTCOME_UNKNOWN',
        abortReason: `COMMIT_OUTCOME_UNKNOWN:${message}`,
        classification: 'LIVE_NOOP',
        unrelatedGrantDigest: null,
        preimageDigest: null,
        postimageDigest: null,
        nonce,
        auditCorrelationId: null,
        receipt: null,
      };
    }
    return {
      outcome: 'PRECOMMIT_FAILED',
      abortReason: `PRECOMMIT_FAILURE:${message}`,
      classification: 'ABSENT',
      unrelatedGrantDigest: null,
      preimageDigest: null,
      postimageDigest: null,
      nonce,
      auditCorrelationId: null,
      receipt: null,
    };
  }
}

// ─── Rollback (guarded tombstone, CTR-HRG-005) ──────────────────────────────

interface ReceiptShape {
  nonce: string;
  outcome: 'CREATED' | 'REACTIVATED';
  clientUuid: string;
  clientId: string;
  oldVersion: number | null;
  postimage: { machine_client_uuid: string; audience_id: string; scopes: string[]; version: number };
  postimageDigest: string;
}

/**
 * Validates the apply receipt and refuses every non-rollback boundary up front
 * (NOOP receipts never revoke; unknown outcomes require a fresh read-only
 * census and separately authorized recovery).
 */
export function parseApplyReceipt(receipt: unknown): ReceiptShape {
  if (!isObject(receipt)) fail('rollback receipt must be a JSON object');
  if (receipt.outcome === 'NOOP') {
    fail('receipt outcome NOOP: accepted live exact rows are never revoked by this operation (CTR-HRG-005)');
  }
  if (receipt.outcome !== 'CREATED' && receipt.outcome !== 'REACTIVATED') {
    fail(`receipt outcome ${String(receipt.outcome)} is not a rollback boundary; diagnose with a fresh read-only census`);
  }
  exactKeys(receipt, [
    'approval_ref', 'audit_correlation_id', 'audience', 'client_id', 'client_uuid',
    'environment', 'migration_id', 'new_version', 'nonce', 'old_version', 'operator',
    'outcome', 'plan_sha256', 'postimage', 'postimage_digest', 'preimage_digest',
    'principal_uuid', 'reason', 'rollback', 'runbook_sha256', 'scopes',
    'source_git_commit', 'source_spec_commit', 'source_spec_id', 'unrelated_grant_digest',
    'utc_time',
  ], 'apply receipt');
  if (receipt.source_spec_id !== SOURCE_SPEC_ID) fail('receipt source_spec_id mismatch');
  if (receipt.source_spec_commit !== SOURCE_SPEC_COMMIT) fail('receipt source_spec_commit mismatch');
  if (receipt.migration_id !== MIGRATION_ID) fail('receipt migration_id mismatch');
  if (receipt.reason !== APPLY_REASON) fail('receipt reason mismatch');
  if (receipt.principal_uuid !== PRINCIPAL_ID) fail('receipt principal_uuid mismatch');
  if (receipt.audience !== AUDIENCE_ID) fail('receipt audience mismatch');
  if (!isUuid(receipt.nonce)) fail('receipt nonce must be a UUID');
  if (!isHex64(receipt.plan_sha256)) fail('receipt plan_sha256 must be lowercase hex64');
  if (!isHex64(receipt.postimage_digest)) fail('receipt postimage_digest must be lowercase hex64');
  if (!isUuid(receipt.audit_correlation_id) || receipt.audit_correlation_id !== receipt.nonce) {
    fail('receipt audit_correlation_id must equal the nonce');
  }
  if (!isObject(receipt.postimage)) fail('receipt postimage must be an object');
  const postimage = receipt.postimage;
  exactKeys(postimage, ['audience_id', 'machine_client_uuid', 'scopes', 'version'], 'receipt postimage');
  if (postimage.audience_id !== AUDIENCE_ID) fail('receipt postimage audience mismatch');
  if (!isUuid(postimage.machine_client_uuid)) fail('receipt postimage client uuid invalid');
  if (!sameJson(sortedScopes(postimage.scopes as string[]), [...TARGET_SCOPES])) {
    fail('receipt postimage scopes are not the exact target scope');
  }
  if (postimage.version !== LIVE_VERSION) fail('receipt postimage version must be the live version');
  if (receipt.client_uuid !== postimage.machine_client_uuid) fail('receipt client_uuid/postimage mismatch');
  if (typeof receipt.client_id !== 'string' || receipt.client_id.length === 0) fail('receipt client_id invalid');
  if (!sameJson(receipt.scopes, [...TARGET_SCOPES])) fail('receipt scopes mismatch');
  if (receipt.new_version !== LIVE_VERSION) fail('receipt new_version mismatch');
  if (receipt.old_version !== null && receipt.old_version !== TOMBSTONE_VERSION) {
    fail('receipt old_version must be null (created) or the tombstone version (reactivated)');
  }
  if (receipt.outcome === 'CREATED' && receipt.old_version !== null) fail('CREATED receipt old_version must be null');
  if (receipt.outcome === 'REACTIVATED' && receipt.old_version !== TOMBSTONE_VERSION) {
    fail('REACTIVATED receipt old_version must be the tombstone version');
  }
  return {
    nonce: receipt.nonce,
    outcome: receipt.outcome,
    clientUuid: receipt.client_uuid,
    clientId: receipt.client_id,
    oldVersion: receipt.old_version as number | null,
    postimage: {
      machine_client_uuid: postimage.machine_client_uuid,
      audience_id: postimage.audience_id,
      scopes: [...TARGET_SCOPES],
      version: LIVE_VERSION,
    },
    postimageDigest: receipt.postimage_digest,
  };
}

async function rollbackInTransaction(
  tx: HrSendGrantDatabase,
  receipt: ReceiptShape,
  input: Pick<ToolInput, 'operatorId' | 'approvalRef'>,
  nonce: string,
): Promise<GrantRollbackResult> {
  await takeTransactionLocks(tx);

  const refusal = (refusalReason: string): GrantRollbackResult => ({
    outcome: 'REFUSED',
    refusalReason,
    classificationAfter: 'CONFLICT',
    unrelatedGrantDigest: null,
    nonce,
    auditCorrelationId: null,
    rollbackAuditId: null,
  });

  // Bound identity re-check (CTR-HRG-001 identity stays frozen for rollback).
  const principal = await tx.machinePrincipal.findUnique({ where: { id: PRINCIPAL_ID } });
  if (principal === null || principal.principalType !== PRINCIPAL_TYPE
      || principal.status !== 'active' || principal.disabledAt !== null
      || principal.agentId !== AGENT_ID) {
    return refusal('IDENTITY_DRIFT');
  }
  const clients = await tx.machineClient.findMany({
    where: { machinePrincipalId: PRINCIPAL_ID },
    select: { id: true, clientId: true, status: true, revokedAt: true },
  });
  const activeClients = clients.filter((client) => client.status === 'active' && client.revokedAt === null);
  if (activeClients.length !== 1
      || activeClients[0].id !== receipt.clientUuid
      || activeClients[0].clientId !== receipt.clientId) {
    return refusal('BINDING_DRIFT');
  }
  const audienceRow = await tx.authAudience.findUnique({ where: { audienceId: AUDIENCE_ID } });
  if (classifyAudience(audienceRow) !== 'EXACT') return refusal('AUDIENCE_DRIFT');

  // Nonce receipt match: the activation audit row must exist with the receipt
  // nonce and carry the exact bounded activation envelope. Attribution
  // (operator/approval_ref) is intentionally not compared: the rollback may be
  // performed by a different operator under its own approval.
  const activationAudit = await tx.authSecurityAudit.findFirst({
    where: { requestCorrelationId: receipt.nonce },
  });
  if (activationAudit === null || activationAudit.eventType !== APPLY_AUDIT_EVENT_TYPE
      || activationAudit.result !== AUDIT_RESULT || !isObject(activationAudit.details)) {
    return refusal('ACTIVATION_AUDIT_RECEIPT_MISSING');
  }
  const details = activationAudit.details;
  exactKeys(details, AUDIT_DETAIL_KEYS, 'activation audit details');
  const expectedActivation = receipt.outcome === 'CREATED' ? 'created' : 'reactivated';
  if (details.reason !== APPLY_REASON
      || details.principal_uuid !== PRINCIPAL_ID
      || details.client_uuid !== receipt.clientUuid
      || details.client_id !== receipt.clientId
      || details.agent_id !== AGENT_ID
      || details.audience !== AUDIENCE_ID
      || !sameJson(details.scopes, [...TARGET_SCOPES])
      || details.new_version !== LIVE_VERSION
      || details.old_version !== receipt.oldVersion
      || details.migration_id !== MIGRATION_ID
      || details.activation !== expectedActivation
      || !isHex64(details.preimage_digest)) {
    return refusal('ACTIVATION_AUDIT_RECEIPT_MISMATCH');
  }

  // Exact postimage match: the live row must equal the receipt postimage.
  const currentRow = await tx.machineAccessGrant.findUnique({
    where: { machineClientId_audienceId: { machineClientId: receipt.clientUuid, audienceId: AUDIENCE_ID } },
  });
  if (currentRow === null || classifyGrant(currentRow) !== 'LIVE_NOOP'
      || currentRow.version !== receipt.postimage.version
      || !sameJson(sortedScopes(currentRow.scopes), sortedScopes(receipt.postimage.scopes))) {
    return refusal('POSTIMAGE_DRIFT');
  }
  const currentDigest = sha256Hex(grantPreimage(currentRow, receipt.clientUuid));
  if (currentDigest !== receipt.postimageDigest) return refusal('POSTIMAGE_DIGEST_MISMATCH');

  // Rollback nonce uniqueness for its own audit entry.
  const priorRollbackAudit = await tx.authSecurityAudit.findFirst({ where: { requestCorrelationId: nonce } });
  if (priorRollbackAudit !== null) return refusal('ROLLBACK_NONCE_REPLAY');

  // Tombstone via CAS 1 -> 0, scopes/identity preserved, never a DELETE.
  const updated = await tx.machineAccessGrant.updateMany({
    where: {
      machineClientId: receipt.clientUuid,
      audienceId: AUDIENCE_ID,
      version: LIVE_VERSION,
      scopes: { equals: [...TARGET_SCOPES] },
    },
    data: { version: TOMBSTONE_VERSION },
  });
  if (updated.count !== 1) return refusal('CONCURRENT_TOMBSTONE_DRIFT');

  const afterRow = await tx.machineAccessGrant.findUnique({
    where: { machineClientId_audienceId: { machineClientId: receipt.clientUuid, audienceId: AUDIENCE_ID } },
  });
  if (afterRow === null || classifyGrant(afterRow) !== 'REACTIVATIBLE') {
    fail('post-tombstone readback is not the exact tombstone state');
  }

  const allGrantsAfter = await tx.machineAccessGrant.findMany({
    select: { machineClientId: true, audienceId: true, scopes: true, version: true },
  });
  const unrelatedDigestAfter = unrelatedGrantDigest(allGrantsAfter, receipt.clientUuid);

  const rollbackAuditId = randomUuid();
  const rollbackDetails = auditDetails({
    operatorId: input.operatorId,
    approvalRef: input.approvalRef,
    reason: ROLLBACK_REASON,
    clientUuid: receipt.clientUuid,
    clientId: receipt.clientId,
    oldVersion: LIVE_VERSION,
    newVersion: TOMBSTONE_VERSION,
    preimageDigest: currentDigest,
    activation: 'tombstoned',
  });
  await tx.authSecurityAudit.create({
    data: {
      id: rollbackAuditId,
      eventType: ROLLBACK_AUDIT_EVENT_TYPE,
      result: AUDIT_RESULT,
      requestCorrelationId: nonce,
      details: rollbackDetails,
    },
  });

  return {
    outcome: 'TOMBSTONED',
    refusalReason: null,
    classificationAfter: 'REACTIVATIBLE',
    unrelatedGrantDigest: unrelatedDigestAfter,
    nonce,
    auditCorrelationId: nonce,
    rollbackAuditId,
  };
}

export async function executeRollback(
  db: HrSendGrantDatabase,
  receipt: unknown,
  input: Pick<ToolInput, 'operatorId' | 'approvalRef'>,
): Promise<GrantRollbackResult> {
  // Receipt validation happens BEFORE any transaction; a malformed or
  // non-boundary receipt never reaches the database and is reported as a
  // uniform refusal.
  let parsed: ReceiptShape;
  try {
    parsed = parseApplyReceipt(receipt);
  } catch (error) {
    return {
      outcome: 'REFUSED',
      refusalReason: `RECEIPT_INVALID:${error instanceof Error ? error.message : String(error)}`,
      classificationAfter: 'CONFLICT',
      unrelatedGrantDigest: null,
      nonce: null,
      auditCorrelationId: null,
      rollbackAuditId: null,
    };
  }
  const nonce = randomUuid();
  let callbackCompleted = false;
  try {
    return await db.$transaction(async (tx) => {
      const result = await rollbackInTransaction(tx, parsed, input, nonce);
      callbackCompleted = true;
      return result;
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (callbackCompleted) {
      return {
        outcome: 'OUTCOME_UNKNOWN',
        refusalReason: `COMMIT_OUTCOME_UNKNOWN:${message}`,
        classificationAfter: 'LIVE_NOOP',
        unrelatedGrantDigest: null,
        nonce,
        auditCorrelationId: null,
        rollbackAuditId: null,
      };
    }
    return {
      outcome: 'PRECOMMIT_FAILED',
      refusalReason: `PRECOMMIT_FAILURE:${message}`,
      classificationAfter: 'LIVE_NOOP',
      unrelatedGrantDigest: null,
      nonce,
      auditCorrelationId: null,
      rollbackAuditId: null,
    };
  }
}

// ─── Verify (readback, CTR-HRG-004 post-state proof row component) ──────────

export async function verifyGrant(
  db: HrSendGrantDatabase,
  input: Pick<ToolInput, 'suppliedClientId'> & { expectedUnrelatedDigest?: string },
): Promise<GrantVerifyResult> {
  const plan = await planGrant(db, { suppliedClientId: input.suppliedClientId });
  const failure: string | null = plan.outcome === 'ABORT'
    ? `ABORT:${plan.abortReason}`
    : plan.audience !== 'EXACT'
      ? `AUDIENCE_${plan.audience}`
      : plan.classification !== 'LIVE_NOOP'
        ? `GRANT_NOT_LIVE_EXACT:${plan.classification}`
        : !plan.binding.matchesSuppliedClientId
          ? 'CLIENT_MISMATCH'
          : input.expectedUnrelatedDigest !== undefined
            && plan.unrelatedGrantDigest !== input.expectedUnrelatedDigest
            ? 'UNRELATED_DIGEST_CHANGED'
            : null;
  return {
    outcome: failure === null ? 'PASS' : 'FAIL',
    failureReason: failure,
    classification: plan.classification,
    audience: plan.audience,
    unrelatedGrantDigest: plan.unrelatedGrantDigest,
  };
}

// ─── Apply gate (checked BEFORE any database connection) ────────────────────

export function checkApplyAuthorization(
  env: Record<string, string | undefined>,
): { authorized: true; operatorId: string; approvalRef: string } | { authorized: false; reason: string } {
  if (env[APPLY_ENV_GATE] !== 'YES') {
    return {
      authorized: false,
      reason: `production apply requires ${APPLY_ENV_GATE}=YES exactly`
        + ' (PRODUCTION_APPLY_AUTHORITY=none; a separately authorized controlled runbook round is required)',
    };
  }
  const operatorId = env[OPERATOR_ENV];
  const approvalRef = env[APPROVAL_REF_ENV];
  if (typeof operatorId !== 'string' || operatorId.length === 0 || operatorId.length > 256) {
    return { authorized: false, reason: `apply requires ${OPERATOR_ENV} (1..256 bytes)` };
  }
  if (typeof approvalRef !== 'string' || approvalRef.length === 0 || approvalRef.length > 2048) {
    return { authorized: false, reason: `apply requires ${APPROVAL_REF_ENV} (1..2048 bytes)` };
  }
  return { authorized: true, operatorId, approvalRef };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string | true> {
  const args: Record<string, string | true> = {};
  const valueFlags = new Set([
    '--client-id', '--receipt-file', '--expected-unrelated-digest', '--runbook-sha256',
  ]);
  const modeFlags = new Set(['--apply', '--verify', '--rollback']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (valueFlags.has(arg)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) fail(`${arg} requires a value`);
      args[arg] = value;
    } else if (modeFlags.has(arg)) {
      args[arg] = true;
    } else {
      fail(`unknown argument ${arg}`);
    }
  }
  return args;
}

function gitHeadCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return fail('unable to resolve the implementation git commit for the receipt envelope');
  }
}

function suppliedClientIdArg(args: Record<string, string | true>): string {
  const value = args['--client-id'];
  if (typeof value !== 'string' || value.length === 0) {
    return fail('--client-id <public HR client id> is required (value comes from the fresh runtime census)');
  }
  return value;
}

function runbookSha256Arg(args: Record<string, string | true>, env: NodeJS.ProcessEnv): string | undefined {
  const fromArgs = args['--runbook-sha256'];
  const fromEnv = env[RUNBOOK_ENV];
  const value = typeof fromArgs === 'string' ? fromArgs : fromEnv;
  if (value === undefined) return undefined;
  if (!isHex64(value)) fail('runbook sha256 must be lowercase hex64');
  return value;
}

function adapt(client: PrismaClient | Prisma.TransactionClient): HrSendGrantDatabase {
  return {
    machinePrincipal: {
      findUnique: (query) => client.machinePrincipal.findUnique(query),
    },
    machineClient: {
      findMany: (query) => client.machineClient.findMany(query),
    },
    machineAccessGrant: {
      findUnique: (query) => client.machineAccessGrant.findUnique(query),
      findMany: (query) => client.machineAccessGrant.findMany(query),
      create: (query) => client.machineAccessGrant.create(query),
      updateMany: (query) => client.machineAccessGrant.updateMany(query as never),
    },
    authAudience: {
      findUnique: (query) => client.authAudience.findUnique(query),
    },
    authSecurityAudit: {
      findFirst: (query) => client.authSecurityAudit.findFirst(query),
      create: (query) => client.authSecurityAudit.create(query as never),
    },
    $executeRaw: (query) => client.$executeRawUnsafe(query),
    // Only the root PrismaClient ever starts a transaction; transaction
    // clients are only handed DOWN into the guarded apply/rollback closures.
    $transaction: (fn, options) => (client as PrismaClient).$transaction(
      (tx) => fn(adapt(tx)),
      options as never,
    ),
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--apply', '--verify', '--rollback'].filter((key) => args[key] === true);
  if (modes.length > 1) fail('execution modes are mutually exclusive');
  const mode = (modes[0] ?? 'plan').replace(/^--/, '');
  const suppliedClientId = suppliedClientIdArg(args);

  let operatorId = 'unspecified-operator';
  let approvalRef = SOURCE_SPEC_ID;
  if (mode === 'apply') {
    // Gate check happens BEFORE any database connection: no PrismaClient is
    // constructed on the refusal path.
    const gate = checkApplyAuthorization(process.env);
    if (!gate.authorized) {
      process.stderr.write(`REFUSED: ${gate.reason}\n`);
      process.stderr.write('No database connection was attempted; no state was changed.\n');
      return 1;
    }
    operatorId = gate.operatorId;
    approvalRef = gate.approvalRef;
  }
  if (mode === 'rollback') {
    const rollbackOperator = process.env[OPERATOR_ENV];
    const rollbackApprovalRef = process.env[APPROVAL_REF_ENV];
    if (typeof rollbackOperator === 'string' && rollbackOperator.length > 0) operatorId = rollbackOperator;
    if (typeof rollbackApprovalRef === 'string' && rollbackApprovalRef.length > 0) approvalRef = rollbackApprovalRef;
  }

  const runbookSha256 = runbookSha256Arg(args, process.env);
  const environment = process.env[ENVIRONMENT_ENV] ?? 'unspecified';

  if (mode === 'rollback') {
    const receiptFile = args['--receipt-file'];
    if (typeof receiptFile !== 'string') {
      return fail('--rollback requires --receipt-file <apply receipt JSON>');
    }
    let receipt: unknown;
    try {
      receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
    } catch (error) {
      return fail(`receipt file is unreadable or invalid JSON: ${(error as Error).message}`);
    }
    // Receipt boundary validation happens BEFORE the database requirement and
    // before any connection: a NOOP/unknown/malformed receipt never connects.
    parseApplyReceipt(receipt);
    if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for rollback');
    const prisma = new PrismaClient();
    try {
      const result = await executeRollback(adapt(prisma), receipt, { operatorId, approvalRef });
      process.stdout.write(`${JSON.stringify({
        task: 'hr-session-send-grant-v1',
        operation: 'rollback',
        ...result,
        rollback_boundary_receipt: result.outcome === 'TOMBSTONED' ? undefined : 'refused',
      }, null, 2)}\n`);
      return result.outcome === 'TOMBSTONED' ? 0 : 1;
    } finally {
      await prisma.$disconnect();
    }
  }

  if (!process.env.DATABASE_URL) fail(`DATABASE_URL is required for read-only ${mode}`);
  const prisma = new PrismaClient();
  try {
    const db = adapt(prisma);
    if (mode === 'plan') {
      const plan = await planGrant(db, { suppliedClientId, runbookSha256 });
      process.stdout.write(`${JSON.stringify(plan.planDocument, null, 2)}\n`);
      process.stdout.write(`PLAN_SHA256=${plan.planSha256}\n`);
      process.stdout.write(`PLAN_NONCE=${plan.nonce}\n`);
      process.stdout.write(`PLAN_CLASSIFICATION=${plan.classification}\n`);
      process.stdout.write(`PLAN_OUTCOME=${plan.outcome}\n`);
      process.stdout.write(`PREIMAGE_SHA256=${plan.preimageDigest ?? 'none'}\n`);
      process.stdout.write(`UNRELATED_GRANTS_SHA256=${plan.unrelatedGrantDigest ?? 'none'}\n`);
      process.stdout.write(`WRITES=0\n`);
      return plan.outcome === 'ABORT' ? 1 : 0;
    }
    if (mode === 'apply') {
      const input: ToolInput = {
        suppliedClientId,
        operatorId,
        approvalRef,
        sourceGitCommit: gitHeadCommit(),
        runbookSha256,
        environment,
      };
      const result = await executeApply(db, input);
      process.stdout.write(`${JSON.stringify({
        task: 'hr-session-send-grant-v1',
        operation: 'apply',
        outcome: result.outcome,
        abort_reason: result.abortReason,
        classification: result.classification,
        preimage_digest: result.preimageDigest,
        postimage_digest: result.postimageDigest,
        unrelated_grant_digest: result.unrelatedGrantDigest,
        audit_correlation_id: result.auditCorrelationId,
        utc_time: new Date().toISOString(),
        retry_attempted: false,
        receipt: result.receipt,
      }, null, 2)}\n`);
      if (result.outcome === 'OUTCOME_UNKNOWN') {
        process.stderr.write('OUTCOME_UNKNOWN: commit acknowledgement was lost; read-only reconciliation with a fresh plan is required; blind retry is forbidden (CTR-HRG-003)\n');
      }
      return result.outcome === 'CREATED' || result.outcome === 'REACTIVATED' || result.outcome === 'NOOP' ? 0 : 1;
    }
    const expectedUnrelatedDigest = typeof args['--expected-unrelated-digest'] === 'string'
      ? args['--expected-unrelated-digest']
      : undefined;
    const result = await verifyGrant(db, { suppliedClientId, expectedUnrelatedDigest });
    process.stdout.write(`${JSON.stringify({
      task: 'hr-session-send-grant-v1',
      operation: 'verify',
      ...result,
      writes: 0,
    }, null, 2)}\n`);
    return result.outcome === 'PASS' ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectExecution = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectExecution) {
  main().then(
    (code) => process.exitCode = code,
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
      process.exitCode = 1;
    },
  );
}
