/**
 * supply-baseline-directory-grants-v1.ts — one-time governed supply vehicle for
 * the ONE centrally governed baseline internal directory-read entitlement
 * (plan / apply / verify).
 *
 * Authority: accepted AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
 * (docs/specs/AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1.md), contracts
 * CTR-AID-001 and CTR-AID-002; implementation_authority: contracts.
 *
 *   PRODUCTION_APPLY_AUTHORITY = conditional_controlled_operation
 *   IMPLEMENTATION = source-only vehicle authoring
 *   PRODUCTION_MUTATION = NONE (this source change performs no database write)
 *
 * CTR-AID-001 registers exactly two generic audiences: `identity-directory`
 * (sole scope `auth.directory.read`) and `agent-directory` (sole scope
 * `agent.directory.read`), both machine-only for accepted principal types
 * agent + service. The retired Workflow-specific registrations and the retired
 * dedicated Workflow admission identity (its pinned Principal/Client pair) MUST
 * NOT be provisioned or re-introduced; this vehicle therefore never pins a
 * per-consumer caller and never creates identity rows (CTR-AID-001).
 *
 * CTR-AID-002 freezes the baseline-entitlement policy:
 *   DIRECTORY_READ_ELIGIBLE_CALLERS = all ACTIVE authenticated canonical
 *   internal AGENT Principals and SERVICE Principals, applied through the
 *   normal canonical identity provisioning/activation machinery, with
 *   PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED = NO. Issuance law is
 *   unchanged: minting a token still requires an existing governed
 *   MachineAccessGrant row for the (client, audience) pair — which is exactly
 *   the row family this vehicle ensures. This vehicle makes NO per-consumer
 *   grant decision: it applies one uniform baseline to the whole eligible set.
 *
 * Eligibility enumeration (documented selector, DB truth only):
 *   AGENT   — MachinePrincipal with principal_type='agent', status='active'
 *             (disabled_at null), agent_id set, and external_ref exactly
 *             'agentcore:v1:principal:<agent_id>' matching the canonical
 *             Agent-ID grammar of src/lib/oauth/v1/resolution.ts. Its canonical
 *             machine client binding is the exactly-one MachineClient with
 *             external_ref 'agentcore:v1:client:<agent_id>', which must be
 *             active and exactly bound to that principal. Any other client of
 *             the principal (legacy OpenClaw-era rows) is out of scope. A
 *             non-canonical active agent principal is out of scope. An active
 *             canonical agent principal whose canonical client is missing,
 *             ambiguous, inactive or misbound FAILS CLOSED (a supply proof
 *             that skips a canonical identity would be a lie).
 *   SERVICE — the designated svc-workflow backend SERVICE principal. No fixed
 *             service-principal selector exists in DB truth (the dedicated
 *             admission identity was retired, never provisioned), so the
 *             operator MUST supply its UUID as the REQUIRED
 *             --service-principal-id argument, documented as the existing
 *             canonical backend identity. The vehicle fails closed unless the
 *             row exists, is principal_type='service', is active
 *             (disabled_at null), has agent_id null (service profile law),
 *             and carries EXACTLY ONE active MachineClient binding. No
 *             principal or client is ever created here.
 *
 * For every eligible principal's designated client the vehicle ensures
 * EXACTLY two MachineAccessGrant rows: (client, identity-directory,
 * scopes=['auth.directory.read'], version=1) and (client, agent-directory,
 * scopes=['agent.directory.read'], version=1). Existing grants on OTHER
 * audiences (workflow.read, forum.*, …) are unrelated state and must remain
 * byte-equivalent (unrelated grant digest). Idempotent classification per
 * (client, audience) pair:
 *   ABSENT    → CREATE the exact row (scopes array, version 1)
 *   LIVE_NOOP → exact row already present (scopes exactly [scope], version 1)
 *   CONFLICT  → any other row (different scopes or version): the whole run
 *               aborts fail-closed; never unioned, updated, upserted or deleted
 *               (no convenient repair).
 * A client whose grants were supplied-and-then-deleted under this migration id
 * (audit history exists while a row is ABSENT) also fails closed instead of
 * silently re-supplying.
 *
 * Apply (single mutation round) holds ONE Serializable transaction that takes
 * the family table locks plus advisory lock 813_947_207 (distinct from
 * 813_947_201..206), re-runs the full fail-closed census, creates the exact
 * grant rows, and commits one grant_change_audits row per mutated client
 * (change_type=create, expected null, resulting 1, after_value = the exact
 * complete client snapshot; safe metadata only — public client id, principal
 * id/type/agent id, audience/scopes; never secrets) with an end-state
 * re-select proof before commit.
 *
 * Modes (mutually exclusive):
 *   plan       (default) read-only census + classification + digests
 *   --apply    guarded mutation; requires BASELINE_DIRECTORY_APPLY=YES,
 *              BASELINE_DIRECTORY_OPERATOR and BASELINE_DIRECTORY_APPROVAL_REF
 *              (checked BEFORE any database connection), the accepted governing
 *              spec at a clean HEAD, and DATABASE_URL
 *   --verify   read-only post-state proof: live enumeration matches the plan,
 *              every eligible client holds exactly the two baseline rows, the
 *              global directory-grant row set has no extra/missing delta, and
 *              the unrelated grant digest matches (optionally
 *              --expected-unrelated-digest)
 *
 * All modes require --service-principal-id; plan/verify/apply require
 * DATABASE_URL. No credential, secret, token or hash value is ever selected,
 * printed or required.
 */

import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

// ─── Frozen constants (CTR-AID-001/002) ─────────────────────────────────────

export const SOURCE_SPEC_ID = 'AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1';
const SPEC_FILE = 'docs/specs/AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1.md';
export const MIGRATION_ID = 'baseline-directory-entitlement-supply-v1';
export const PLAN_VERSION = 'AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1_BASELINE_SUPPLY_PLAN_1';
export const APPLY_REASON = 'BASELINE_INTERNAL_DIRECTORY_READ_ENTITLEMENT';
export const GRANT_VERSION = 1;
export const APPLY_ENV_GATE = 'BASELINE_DIRECTORY_APPLY';
export const OPERATOR_ENV = 'BASELINE_DIRECTORY_OPERATOR';
export const APPROVAL_REF_ENV = 'BASELINE_DIRECTORY_APPROVAL_REF';
// Distinct from Stage W (813_947_201), Stage F (813_947_202), the svc-forum
// audience reconciliation (813_947_203), legacy Grant narrowing (813_947_204),
// the forum moderator supply (813_947_205), and the HR session send supply
// (813_947_206).
export const ADVISORY_LOCK_KEY = 813_947_207;

/** The exact CTR-AID-001 target: audience_id → sole registered scope. */
export const TARGET_AUDIENCES = Object.freeze({
  'identity-directory': Object.freeze(['auth.directory.read']),
  'agent-directory': Object.freeze(['agent.directory.read']),
} as const);
export const AUDIENCE_IDS = Object.freeze(
  Object.keys(TARGET_AUDIENCES).sort((a, b) => asciiCompare(a, b)),
) as readonly string[];

/** The exact CCR-registered audience entries (contract bundle audience registry 1.10.0). */
export const FROZEN_AUDIENCE_ROWS = Object.freeze([
  Object.freeze({
    audienceId: 'agent-directory',
    resourceService: 'agent-core',
    scopeNamespace: 'agent',
    acceptedPrincipalTypes: Object.freeze(['agent', 'service']),
    registeredScopes: Object.freeze(['agent.directory.read']),
    humanAccessEnabled: false,
    machineAccessEnabled: true,
    delegatedAccessEnabled: false,
    status: 'active',
    freezeReady: true,
    version: 1,
  }),
  Object.freeze({
    audienceId: 'identity-directory',
    resourceService: 'svc-auth',
    scopeNamespace: 'auth',
    acceptedPrincipalTypes: Object.freeze(['agent', 'service']),
    registeredScopes: Object.freeze(['auth.directory.read']),
    humanAccessEnabled: false,
    machineAccessEnabled: true,
    delegatedAccessEnabled: false,
    status: 'active',
    freezeReady: true,
    version: 1,
  }),
]);

const CANONICAL_PRINCIPAL_PREFIX = 'agentcore:v1:principal:';
const CANONICAL_CLIENT_PREFIX = 'agentcore:v1:client:';
/** Exact Agent-ID grammar of the canonical resolver (src/lib/oauth/v1/resolution.ts). */
const AGENT_ID_GRAMMAR = /^[A-Za-z0-9_-]{1,200}$/;

/** Closed audit envelope (grant_change_audits family form): exactly these keys. */
export const AUDIT_ENVELOPE_KEYS = Object.freeze([
  'change_id', 'migration_id', 'source_git_commit', 'operator_id', 'approval_ref',
  'reason', 'client_id', 'change_type', 'expected_grant_version',
  'resulting_grant_version', 'before_value', 'after_value', 'timestamp',
]);

/** The exact storage-row projection of the envelope (Prisma field names). */
const AUDIT_DATA_KEYS = Object.freeze([
  'id', 'migrationId', 'sourceGitCommit', 'operatorId', 'approvalRef',
  'reason', 'clientId', 'changeType', 'expectedGrantVersion',
  'resultingGrantVersion', 'beforeValue', 'afterValue', 'timestamp',
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
  externalRef: string | null;
}

export interface ToolClientRow {
  id: string;
  clientId: string;
  externalRef: string | null;
  machinePrincipalId: string;
  status: string;
  revokedAt: Date | null;
}

export interface ToolGrantRow {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}

export interface ToolAuditHistoryRow {
  id: string;
  clientId: string;
  changeType: string;
}

export interface ToolAuditCreateData {
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

export interface BaselineDirectoryDatabase {
  authAudience: {
    findMany(args: { where: { audienceId: { in: readonly string[] } } }): Promise<ToolAudienceRow[]>;
  };
  machinePrincipal: {
    findMany(args: {
      where: { principalType: string; status: string; agentId: { not: null } };
    }): Promise<ToolPrincipalRow[]>;
    findUnique(args: { where: { id: string } }): Promise<ToolPrincipalRow | null>;
  };
  machineClient: {
    findMany(args: { where: { externalRef: string } | { machinePrincipalId: string } }): Promise<ToolClientRow[]>;
  };
  machineAccessGrant: {
    findMany(args: { where?: { machineClientId?: { in: readonly string[] }; audienceId?: { in: readonly string[] } } }): Promise<ToolGrantRow[]>;
    create(args: { data: { machineClientId: string; audienceId: string; scopes: string[]; version: number } }): Promise<unknown>;
  };
  grantChangeAudit: {
    findMany(args: { where: { migrationId: string } }): Promise<ToolAuditHistoryRow[]>;
    create(args: { data: ToolAuditCreateData }): Promise<unknown>;
  };
  $executeRaw(query: string): Promise<unknown>;
  $transaction<T>(
    fn: (tx: BaselineDirectoryDatabase) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' },
  ): Promise<T>;
}

// ─── Shared types ───────────────────────────────────────────────────────────

export type AudienceState = 'ABSENT' | 'EXACT' | 'DRIFTED';
export type PairClassification = 'ABSENT' | 'LIVE_NOOP' | 'CONFLICT';
export type PairOperation = 'CREATE_EXACT_ROW' | 'NONE' | 'REFUSED';
export type PlanOutcome = 'CREATE' | 'NOOP' | 'ABORT';
export type ApplyOutcome = 'CREATED' | 'NOOP' | 'ABORTED' | 'PRECOMMIT_FAILED' | 'OUTCOME_UNKNOWN';

export interface EligibleClientRow {
  principalId: string;
  principalType: 'agent' | 'service';
  agentId: string | null;
  clientInternalId: string;
  clientId: string;
  clientStatus: string;
  pairs: Array<{
    audienceId: string;
    scopes: string[];
    classification: PairClassification;
    operation: PairOperation;
  }>;
}

export interface BaselinePlan {
  outcome: PlanOutcome;
  abortReason: string | null;
  audiences: Record<string, AudienceState>;
  eligibleAgentCount: number;
  servicePrincipalId: string;
  rows: EligibleClientRow[];
  createClientCount: number;
  noopClientCount: number;
  grantsToCreate: number;
  auditsToCreate: number;
  unrelatedGrantDigest: string | null;
  nonce: string;
  planSha256: string;
  planDocument: Record<string, unknown>;
}

export interface ApplyInput {
  servicePrincipalId: string;
  operatorId: string;
  approvalRef: string;
  sourceGitCommit: string;
  nonce?: string;
}

export interface ApplyResult {
  outcome: ApplyOutcome;
  abortReason: string | null;
  grantsCreated: number;
  auditsCreated: number;
  createClientCount: number;
  noopClientCount: number;
  preUnrelatedGrantDigest: string | null;
  postUnrelatedGrantDigest: string | null;
  nonce: string | null;
  auditIds: string[];
}

export interface VerifyInput {
  servicePrincipalId: string;
  expectedUnrelatedDigest?: string;
}

export interface VerifyResult {
  outcome: 'PASS' | 'FAIL';
  failureReason: string | null;
  audiences: Record<string, AudienceState>;
  eligibleAgentCount: number;
  clientCount: number;
  directoryGrantRowCount: number;
  unrelatedGrantDigest: string | null;
}

// ─── Canonical JSON / digest helpers ────────────────────────────────────────

function fail(message: string): never {
  throw new Error(`baseline directory grant supply refused: ${message}`);
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

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function isLowercaseHex40(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

/**
 * Stable semantic projection of every grant row OUTSIDE the two baseline
 * directory audiences (CTR-AID-002: the baseline entitlement must not disturb
 * any per-purpose grant, e.g. workflow.read or forum.* rows).
 */
export function unrelatedGrantDigest(grants: readonly ToolGrantRow[]): string {
  const projection = grants
    .filter((grant) => !AUDIENCE_IDS.includes(grant.audienceId))
    .map((grant) => ({
      machineClientId: grant.machineClientId,
      audienceId: grant.audienceId,
      scopes: sortedScopes(grant.scopes),
      version: grant.version,
    }))
    .sort((a, b) => asciiCompare(`${a.machineClientId}\0${a.audienceId}`, `${b.machineClientId}\0${b.audienceId}`));
  return sha256Hex(projection);
}

/** Exact complete client snapshot (prior grant-supply family projection). */
function completeSnapshot(client: {
  clientId: string;
  principalId: string;
  principalType: string;
  clientStatus: string;
}, clientGrants: readonly ToolGrantRow[]): Record<string, unknown> {
  const machineAccessGrants: Record<string, string[]> = {};
  for (const grant of [...clientGrants].sort((a, b) => asciiCompare(a.audienceId, b.audienceId))) {
    machineAccessGrants[grant.audienceId] = sortedScopes(grant.scopes);
  }
  return {
    client_id: client.clientId,
    client_kind: 'machine',
    principal_id: client.principalId,
    principal_type: client.principalType,
    human_audience_grants: [],
    machine_access_grants: machineAccessGrants,
    delegation_grants: {},
    status: client.clientStatus,
    version: GRANT_VERSION,
  };
}

function classifyAudience(row: ToolAudienceRow | undefined, frozen: (typeof FROZEN_AUDIENCE_ROWS)[number]): AudienceState {
  if (row === undefined) return 'ABSENT';
  const exact = row.audienceId === frozen.audienceId
    && row.resourceService === frozen.resourceService
    && row.scopeNamespace === frozen.scopeNamespace
    && sameJson(sortedScopes(row.acceptedPrincipalTypes), [...frozen.acceptedPrincipalTypes])
    && sameJson(sortedScopes(row.registeredScopes), [...frozen.registeredScopes])
    && row.humanAccessEnabled === frozen.humanAccessEnabled
    && row.machineAccessEnabled === frozen.machineAccessEnabled
    && row.delegatedAccessEnabled === frozen.delegatedAccessEnabled
    && row.status === frozen.status
    && row.freezeReady === frozen.freezeReady
    && row.version === frozen.version;
  return exact ? 'EXACT' : 'DRIFTED';
}

function classifyPair(row: ToolGrantRow | undefined, audienceId: string): PairClassification {
  if (row === undefined) return 'ABSENT';
  const expectedScope = (TARGET_AUDIENCES as Record<string, readonly string[]>)[audienceId][0];
  if (!sameJson(sortedScopes(row.scopes), [expectedScope])) return 'CONFLICT';
  if (row.version === GRANT_VERSION) return 'LIVE_NOOP';
  return 'CONFLICT';
}

function pairOperationFor(classification: PairClassification): PairOperation {
  if (classification === 'ABSENT') return 'CREATE_EXACT_ROW';
  if (classification === 'LIVE_NOOP') return 'NONE';
  return 'REFUSED';
}

// ─── Fail-closed census (plan core; re-used under the apply transaction) ────

async function takeTransactionLocks(db: BaselineDirectoryDatabase): Promise<void> {
  // Table locks first, advisory last (grant-supply family form): every table
  // the census reads is locked before the Serializable snapshot is taken, and
  // the written tables take write-conflict locks. The advisory lock serializes
  // cooperating operators of this vehicle. ADVISORY_LOCK_KEY is a frozen
  // numeric constant interpolated before the raw call.
  await db.$executeRaw('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
  await db.$executeRaw('LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE');
  await db.$executeRaw('LOCK TABLE machine_principals IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE machine_clients IN SHARE MODE');
  await db.$executeRaw('LOCK TABLE auth_audiences IN SHARE MODE');
  await db.$executeRaw(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);
}

export async function loadBaselinePlan(
  db: BaselineDirectoryDatabase,
  input: { servicePrincipalId: string; nonce?: string },
): Promise<BaselinePlan> {
  const nonce = input.nonce ?? randomUUID();
  const servicePrincipalId = input.servicePrincipalId;
  if (!isUuid(servicePrincipalId)) {
    return abort('SERVICE_PRINCIPAL_ID_MALFORMED', servicePrincipalId, {}, [], nonce, null, 0);
  }

  // ── CTR-AID-001 audience registry EXACTness ──────────────────────────────
  const audienceRows = await db.authAudience.findMany({ where: { audienceId: { in: AUDIENCE_IDS } } });
  const audiences: Record<string, AudienceState> = {};
  for (const frozen of FROZEN_AUDIENCE_ROWS) {
    const matches = audienceRows.filter((row) => row.audienceId === frozen.audienceId);
    const state = classifyAudience(matches[0], frozen);
    audiences[frozen.audienceId] = state;
    if (state !== 'EXACT') {
      return abort(`AUDIENCE_${state}:${frozen.audienceId}`, servicePrincipalId, audiences, [], nonce, null, 0);
    }
  }

  // ── Designated SERVICE principal (operator-supplied canonical backend id) ─
  const service = await db.machinePrincipal.findUnique({ where: { id: servicePrincipalId } });
  if (service === null) {
    return abort('SERVICE_NOT_FOUND', servicePrincipalId, audiences, [], nonce, null, 0);
  }
  if (service.principalType !== 'service') {
    return abort('SERVICE_NOT_SERVICE', servicePrincipalId, audiences, [], nonce, null, 0);
  }
  if (service.status !== 'active' || service.disabledAt !== null) {
    return abort('SERVICE_DISABLED', servicePrincipalId, audiences, [], nonce, null, 0);
  }
  if (service.agentId !== null) {
    return abort('SERVICE_PROFILE_INVALID', servicePrincipalId, audiences, [], nonce, null, 0);
  }
  const serviceClients = await db.machineClient.findMany({ where: { machinePrincipalId: service.id } });
  const activeServiceClients = serviceClients
    .filter((client) => client.status === 'active' && client.revokedAt === null);
  if (activeServiceClients.length === 0) {
    return abort('SERVICE_NO_ACTIVE_CLIENT', servicePrincipalId, audiences, [], nonce, null, 0);
  }
  if (activeServiceClients.length > 1) {
    return abort('SERVICE_AMBIGUOUS_BINDING', servicePrincipalId, audiences, [], nonce, null, 0);
  }

  // ── Eligible AGENT enumeration: active canonical principals ──────────────
  const activeAgentPrincipals = await db.machinePrincipal.findMany({
    where: { principalType: 'agent', status: 'active', agentId: { not: null } },
  });
  const canonicalAgents = activeAgentPrincipals
    .filter((principal) => principal.disabledAt === null
      && principal.agentId !== null
      && AGENT_ID_GRAMMAR.test(principal.agentId)
      && principal.externalRef === `${CANONICAL_PRINCIPAL_PREFIX}${principal.agentId}`)
    .sort((a, b) => asciiCompare(a.agentId as string, b.agentId as string));

  // ── Per-client canonical binding + pair classification ───────────────────
  const rows: EligibleClientRow[] = [];
  const auditHistory = await db.grantChangeAudit.findMany({ where: { migrationId: MIGRATION_ID } });
  const buildRow = async (
    principal: { id: string; principalType: 'agent' | 'service'; agentId: string | null },
    client: ToolClientRow,
  ): Promise<EligibleClientRow> => {
    const grants = await db.machineAccessGrant.findMany({
      where: { machineClientId: { in: [client.id] } },
    });
    const pairs = AUDIENCE_IDS.map((audienceId) => {
      const row = grants.find((grant) => grant.audienceId === audienceId);
      const classification = classifyPair(row, audienceId);
      return {
        audienceId,
        scopes: [...(TARGET_AUDIENCES as Record<string, readonly string[]>)[audienceId]],
        classification,
        operation: pairOperationFor(classification),
      };
    });
    return {
      principalId: principal.id,
      principalType: principal.principalType,
      agentId: principal.agentId,
      clientInternalId: client.id,
      clientId: client.clientId,
      clientStatus: client.status,
      pairs,
    };
  };

  const pushServiceRow = async (): Promise<void> => {
    const client = activeServiceClients[0] as ToolClientRow;
    rows.push(await buildRow(
      { id: service.id, principalType: 'service', agentId: null },
      client,
    ));
  };
  await pushServiceRow();

  for (const principal of canonicalAgents) {
    const agentId = principal.agentId as string;
    const binding = await db.machineClient.findMany({
      where: { externalRef: `${CANONICAL_CLIENT_PREFIX}${agentId}` },
    });
    if (binding.length === 0) {
      return abort(`CANONICAL_CLIENT_ABSENT:${agentId}`, servicePrincipalId, audiences, rows, nonce, null, rows.length);
    }
    if (binding.length > 1) {
      return abort(`CANONICAL_CLIENT_AMBIGUOUS:${agentId}`, servicePrincipalId, audiences, rows, nonce, null, rows.length);
    }
    const client = binding[0] as ToolClientRow;
    if (client.status !== 'active' || client.revokedAt !== null) {
      return abort(`CANONICAL_CLIENT_INACTIVE:${agentId}`, servicePrincipalId, audiences, rows, nonce, null, rows.length);
    }
    if (client.machinePrincipalId !== principal.id) {
      return abort(`CANONICAL_CLIENT_BINDING_MISMATCH:${agentId}`, servicePrincipalId, audiences, rows, nonce, null, rows.length);
    }
    rows.push(await buildRow({ id: principal.id, principalType: 'agent', agentId }, client));
  }

  // ── Fail-closed history guard + counts ───────────────────────────────────
  let grantsToCreate = 0;
  let createClientCount = 0;
  for (const row of rows) {
    const absentPairs = row.pairs.filter((pair) => pair.classification === 'ABSENT');
    if (absentPairs.length === 0) continue;
    const conflicts = row.pairs.filter((pair) => pair.classification === 'CONFLICT');
    if (conflicts.length > 0) {
      return abort(`GRANT_CONFLICT:${row.clientId}:${conflicts[0]?.audienceId}`, servicePrincipalId, audiences, rows, nonce, null, rows.length);
    }
    const priorAudits = auditHistory.filter((audit) => audit.clientId === row.clientId);
    if (priorAudits.length > 0) {
      return abort(`AUDIT_HISTORY_CONFLICT:${row.clientId}`, servicePrincipalId, audiences, rows, nonce, null, rows.length);
    }
    createClientCount += 1;
    grantsToCreate += absentPairs.length;
  }
  const noopClientCount = rows.length - createClientCount;

  const allGrants = await db.machineAccessGrant.findMany({});
  const unrelatedDigest = unrelatedGrantDigest(allGrants);

  const planDocument: Record<string, unknown> = {
    abort_reason: null,
    audiences: { ...audiences },
    create_client_count: createClientCount,
    eligible_agent_count: canonicalAgents.length,
    grants_to_create: grantsToCreate,
    migration_id: MIGRATION_ID,
    noop_client_count: noopClientCount,
    nonce,
    outcome: createClientCount === 0 ? 'NOOP' : 'CREATE',
    plan_version: PLAN_VERSION,
    rows: rows.map((row) => ({
      agent_id: row.agentId,
      client_id: row.clientId,
      pairs: row.pairs.map((pair) => ({
        audience_id: pair.audienceId,
        classification: pair.classification,
        operation: pair.operation,
        scopes: [...pair.scopes],
      })),
      principal_id: row.principalId,
      principal_type: row.principalType,
    })),
    service_principal_id: servicePrincipalId,
    source_spec_id: SOURCE_SPEC_ID,
    target_audiences: { ...(TARGET_AUDIENCES as Record<string, readonly string[]>) },
    unrelated_grant_digest: unrelatedDigest,
  };

  return {
    outcome: createClientCount === 0 ? 'NOOP' : 'CREATE',
    abortReason: null,
    audiences,
    eligibleAgentCount: canonicalAgents.length,
    servicePrincipalId,
    rows,
    createClientCount,
    noopClientCount,
    grantsToCreate,
    auditsToCreate: createClientCount,
    unrelatedGrantDigest: unrelatedDigest,
    nonce,
    planSha256: sha256Hex(planDocument),
    planDocument,
  };
}

function abort(
  abortReason: string,
  servicePrincipalId: string,
  audiences: Record<string, AudienceState>,
  rows: EligibleClientRow[],
  nonce: string,
  unrelatedGrantDigestValue: string | null,
  eligibleAgentCount: number,
): BaselinePlan {
  const planDocument: Record<string, unknown> = {
    abort_reason: abortReason,
    audiences: { ...audiences },
    create_client_count: 0,
    eligible_agent_count: eligibleAgentCount,
    grants_to_create: 0,
    migration_id: MIGRATION_ID,
    noop_client_count: 0,
    nonce,
    outcome: 'ABORT',
    plan_version: PLAN_VERSION,
    rows: rows.map((row) => ({
      agent_id: row.agentId,
      client_id: row.clientId,
      pairs: row.pairs.map((pair) => ({
        audience_id: pair.audienceId,
        classification: pair.classification,
        operation: pair.operation,
        scopes: [...pair.scopes],
      })),
      principal_id: row.principalId,
      principal_type: row.principalType,
    })),
    service_principal_id: servicePrincipalId,
    source_spec_id: SOURCE_SPEC_ID,
    target_audiences: { ...(TARGET_AUDIENCES as Record<string, readonly string[]>) },
    unrelated_grant_digest: unrelatedGrantDigestValue,
  };
  return {
    outcome: 'ABORT',
    abortReason,
    audiences,
    eligibleAgentCount,
    servicePrincipalId,
    rows,
    createClientCount: 0,
    noopClientCount: 0,
    grantsToCreate: 0,
    auditsToCreate: 0,
    unrelatedGrantDigest: unrelatedGrantDigestValue,
    nonce,
    planSha256: sha256Hex(planDocument),
    planDocument,
  };
}

// ─── Apply (ONE Serializable transaction for the whole baseline) ────────────

async function applyWithinTransaction(
  tx: BaselineDirectoryDatabase,
  input: ApplyInput,
): Promise<ApplyResult> {
  await takeTransactionLocks(tx);
  const plan = await loadBaselinePlan(tx, {
    servicePrincipalId: input.servicePrincipalId,
    nonce: input.nonce,
  });
  if (plan.outcome === 'ABORT') {
    return {
      outcome: 'ABORTED',
      abortReason: plan.abortReason,
      grantsCreated: 0,
      auditsCreated: 0,
      createClientCount: 0,
      noopClientCount: 0,
      preUnrelatedGrantDigest: null,
      postUnrelatedGrantDigest: null,
      nonce: plan.nonce,
      auditIds: [],
    };
  }
  const mutateRows = plan.rows.filter((row) => row.pairs.some((pair) => pair.classification === 'ABSENT'));
  const auditIds: string[] = [];
  if (mutateRows.length === 0) {
    return {
      outcome: 'NOOP',
      abortReason: null,
      grantsCreated: 0,
      auditsCreated: 0,
      createClientCount: 0,
      noopClientCount: plan.noopClientCount,
      preUnrelatedGrantDigest: plan.unrelatedGrantDigest,
      postUnrelatedGrantDigest: plan.unrelatedGrantDigest,
      nonce: plan.nonce,
      auditIds,
    };
  }
  if (mutateRows.length > 0) {
    const timestamp = new Date();
    for (const row of mutateRows) {
      for (const pair of row.pairs.filter((item) => item.classification === 'ABSENT')) {
        await tx.machineAccessGrant.create({ data: {
          machineClientId: row.clientInternalId,
          audienceId: pair.audienceId,
          scopes: [...pair.scopes],
          version: GRANT_VERSION,
        } });
      }
      const afterGrants = await tx.machineAccessGrant.findMany({
        where: { machineClientId: { in: [row.clientInternalId] } },
      });
      const afterValue = completeSnapshot({
        clientId: row.clientId,
        principalId: row.principalId,
        principalType: row.principalType,
        clientStatus: row.clientStatus,
      }, afterGrants);
      const audit: ToolAuditCreateData = {
        id: randomUUID(),
        migrationId: MIGRATION_ID,
        sourceGitCommit: input.sourceGitCommit,
        operatorId: input.operatorId,
        approvalRef: input.approvalRef,
        reason: APPLY_REASON,
        clientId: row.clientId,
        changeType: 'create',
        expectedGrantVersion: null,
        resultingGrantVersion: GRANT_VERSION,
        beforeValue: null,
        afterValue,
        timestamp,
      };
      exactKeys(audit as unknown as Record<string, unknown>, AUDIT_DATA_KEYS, 'grant audit row');
      await tx.grantChangeAudit.create({ data: audit });
      auditIds.push(audit.id);
    }
  }
  // End-state re-select proof BEFORE commit: a fresh fail-closed census of
  // the same transaction snapshot must now classify every pair LIVE_NOOP,
  // and the unrelated projection must be byte-stable.
  const proof = await loadBaselinePlan(tx, {
    servicePrincipalId: input.servicePrincipalId,
    nonce: plan.nonce,
  });
  if (proof.outcome !== 'NOOP') {
    fail(`end-state re-select proof failed before commit (outcome=${proof.outcome} reason=${proof.abortReason})`);
  }
  const postDigest = unrelatedGrantDigest(await tx.machineAccessGrant.findMany({}));
  if (postDigest !== plan.unrelatedGrantDigest) {
    fail('unrelated grants drifted during the apply transaction');
  }
  return {
    outcome: 'CREATED',
    abortReason: null,
    grantsCreated: plan.grantsToCreate,
    auditsCreated: auditIds.length,
    createClientCount: plan.createClientCount,
    noopClientCount: plan.noopClientCount,
    preUnrelatedGrantDigest: plan.unrelatedGrantDigest,
    postUnrelatedGrantDigest: postDigest,
    nonce: plan.nonce,
    auditIds,
  };
}

export async function executeApply(
  db: BaselineDirectoryDatabase,
  input: ApplyInput,
): Promise<ApplyResult> {
  if (!isLowercaseHex40(input.sourceGitCommit)) {
    return {
      outcome: 'ABORTED', abortReason: 'SOURCE_COMMIT_MALFORMED', grantsCreated: 0, auditsCreated: 0,
      createClientCount: 0, noopClientCount: 0, preUnrelatedGrantDigest: null,
      postUnrelatedGrantDigest: null, nonce: null, auditIds: [],
    };
  }
  let callbackCompleted = false;
  try {
    const result = await db.$transaction(async (tx) => {
      const outcome = await applyWithinTransaction(tx, input);
      // Commit-boundary semantics: from here the transaction body finished; a
      // lost acknowledgement after this point is OUTCOME_UNKNOWN, never a
      // silent retry (grant-supply family law).
      callbackCompleted = true;
      return outcome;
    }, { isolationLevel: 'Serializable' });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      outcome: callbackCompleted ? 'OUTCOME_UNKNOWN' : 'PRECOMMIT_FAILED',
      abortReason: message,
      grantsCreated: 0,
      auditsCreated: 0,
      createClientCount: 0,
      noopClientCount: 0,
      preUnrelatedGrantDigest: null,
      postUnrelatedGrantDigest: null,
      nonce: null,
      auditIds: [],
    };
  }
}

// ─── Verify (read-only post-state proof) ────────────────────────────────────

export async function verifyBaseline(
  db: BaselineDirectoryDatabase,
  input: VerifyInput,
): Promise<VerifyResult> {
  const plan = await loadBaselinePlan(db, { servicePrincipalId: input.servicePrincipalId });
  if (plan.outcome === 'ABORT') {
    return {
      outcome: 'FAIL',
      failureReason: `ABORT:${plan.abortReason}`,
      audiences: plan.audiences,
      eligibleAgentCount: plan.eligibleAgentCount,
      clientCount: plan.rows.length,
      directoryGrantRowCount: 0,
      unrelatedGrantDigest: plan.unrelatedGrantDigest,
    };
  }
  const notNoop = plan.rows
    .flatMap((row) => row.pairs.map((pair) => ({ row, pair })))
    .find((item) => item.pair.classification !== 'LIVE_NOOP');
  if (notNoop !== undefined) {
    return {
      outcome: 'FAIL',
      failureReason: `PAIR_NOT_LIVE_EXACT:${notNoop.row.clientId}:${notNoop.pair.audienceId}:${notNoop.pair.classification}`,
      audiences: plan.audiences,
      eligibleAgentCount: plan.eligibleAgentCount,
      clientCount: plan.rows.length,
      directoryGrantRowCount: 0,
      unrelatedGrantDigest: plan.unrelatedGrantDigest,
    };
  }
  // Global delta proof: the set of grant rows on the two baseline audiences
  // must equal EXACTLY the expected set derived from the live enumeration —
  // no extra audience/scope delta anywhere, no missing row.
  const directoryRows = await db.machineAccessGrant.findMany({
    where: { audienceId: { in: AUDIENCE_IDS } },
  });
  const expected = plan.rows
    .flatMap((row) => row.pairs.map((pair) => ({
      machineClientId: row.clientInternalId,
      audienceId: pair.audienceId,
      scopes: sortedScopes(pair.scopes),
      version: GRANT_VERSION,
    })))
    .sort((a, b) => asciiCompare(`${a.machineClientId}\0${a.audienceId}`, `${b.machineClientId}\0${b.audienceId}`));
  const observed = directoryRows
    .map((row) => ({
      machineClientId: row.machineClientId,
      audienceId: row.audienceId,
      scopes: sortedScopes(row.scopes),
      version: row.version,
    }))
    .sort((a, b) => asciiCompare(`${a.machineClientId}\0${a.audienceId}`, `${b.machineClientId}\0${b.audienceId}`));
  const directoryDelta = sameJson(observed, expected) ? null : 'DIRECTORY_GRANT_SET_DELTA';
  const digestDelta = input.expectedUnrelatedDigest !== undefined
    && plan.unrelatedGrantDigest !== input.expectedUnrelatedDigest
    ? 'UNRELATED_DIGEST_CHANGED'
    : null;
  const failureReason = directoryDelta ?? digestDelta;
  return {
    outcome: failureReason === null ? 'PASS' : 'FAIL',
    failureReason,
    audiences: plan.audiences,
    eligibleAgentCount: plan.eligibleAgentCount,
    clientCount: plan.rows.length,
    directoryGrantRowCount: observed.length,
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
        + ' (one-time governed baseline entitlement round; the explicit --apply'
        + ' flag plus this gate are both mandatory; plan/verify are read-only)',
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
  const valueFlags = new Set(['--service-principal-id', '--expected-unrelated-digest']);
  const modeFlags = new Set(['--apply', '--verify']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (valueFlags.has(arg)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) fail(`${arg} requires a value`);
      if (Object.hasOwn(args, arg)) fail(`duplicate argument ${arg}`);
      args[arg] = value;
    } else if (modeFlags.has(arg)) {
      if (Object.hasOwn(args, arg)) fail(`duplicate argument ${arg}`);
      args[arg] = true;
    } else {
      fail(`unknown argument ${arg}`);
    }
  }
  return args;
}

function cleanHead(): string {
  const status = execFileSync('git', ['-C', REPO_ROOT, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  if (status.length !== 0) fail('executable worktree is dirty; the apply audit must bind a clean reviewed HEAD');
  const head = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!isLowercaseHex40(head)) fail('unable to resolve a lowercase-hex HEAD commit');
  return head;
}

function requireAcceptedSpec(): void {
  const spec = readFileSync(`${REPO_ROOT}${SPEC_FILE}`, 'utf8');
  if (!spec.includes(`spec_id: ${SOURCE_SPEC_ID}`)
      || !spec.includes('status: accepted')
      || !spec.includes('implementation_authority: contracts')) {
    fail('governing spec is not the accepted internal identity directory V1 at this HEAD');
  }
}

function servicePrincipalIdArg(args: Record<string, string | true>): string {
  const value = args['--service-principal-id'];
  if (typeof value !== 'string' || value.length === 0) {
    return fail('--service-principal-id <uuid of the designated svc-workflow backend SERVICE principal> is required (the existing canonical backend identity in DB truth; the vehicle never creates principals)');
  }
  if (!isUuid(value)) fail('--service-principal-id must be a canonical UUID');
  return value;
}

function adapt(client: PrismaClient | Prisma.TransactionClient): BaselineDirectoryDatabase {
  return {
    authAudience: {
      findMany: (query) => client.authAudience.findMany(query as never),
    },
    machinePrincipal: {
      findMany: (query) => client.machinePrincipal.findMany(query as never),
      findUnique: (query) => client.machinePrincipal.findUnique(query as never),
    },
    machineClient: {
      findMany: (query) => client.machineClient.findMany(query as never),
    },
    machineAccessGrant: {
      findMany: (query) => client.machineAccessGrant.findMany(query as never),
      create: (query) => client.machineAccessGrant.create(query as never),
    },
    grantChangeAudit: {
      findMany: (query) => client.grantChangeAudit.findMany(query as never),
      // A NULL JSON column is written through the Prisma DbNull sentinel.
      create: (query) => client.grantChangeAudit.create({
        data: query.data.beforeValue === null
          ? ({ ...query.data, beforeValue: Prisma.DbNull } as never)
          : query as never,
      }),
    },
    $executeRaw: (query) => client.$executeRawUnsafe(query),
    // Only the root PrismaClient ever starts a transaction; transaction
    // clients are only handed DOWN into the guarded apply closure.
    $transaction: (fn, options) => (client as PrismaClient).$transaction(
      (tx) => fn(adapt(tx)),
      options as never,
    ),
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--apply', '--verify'].filter((key) => args[key] === true);
  if (modes.length > 1) fail('execution modes are mutually exclusive');
  const mode = (modes[0] ?? 'plan').replace(/^--/, '');
  const servicePrincipalId = servicePrincipalIdArg(args);

  if (mode === 'apply') {
    // Gate check happens BEFORE any database connection: no PrismaClient is
    // constructed on the refusal path.
    const gate = checkApplyAuthorization(process.env);
    if (!gate.authorized) {
      process.stderr.write(`REFUSED: ${gate.reason}\n`);
      process.stderr.write('No database connection was attempted; no state was changed.\n');
      return 1;
    }
    requireAcceptedSpec();
    const sourceGitCommit = cleanHead();
    if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for apply');
    const prisma = new PrismaClient();
    try {
      const result = await executeApply(adapt(prisma), {
        servicePrincipalId,
        operatorId: gate.operatorId,
        approvalRef: gate.approvalRef,
        sourceGitCommit,
      });
      process.stdout.write(`${JSON.stringify({
        task: 'baseline-directory-grants-v1',
        operation: 'apply',
        outcome: result.outcome,
        abort_reason: result.abortReason,
        grants_created: result.grantsCreated,
        audits_created: result.auditsCreated,
        create_clients: result.createClientCount,
        noop_clients: result.noopClientCount,
        pre_unrelated_grant_digest: result.preUnrelatedGrantDigest,
        post_unrelated_grant_digest: result.postUnrelatedGrantDigest,
        nonce: result.nonce,
        source_git_commit: sourceGitCommit,
        migration_id: MIGRATION_ID,
      }, null, 2)}\n`);
      return result.outcome === 'CREATED' || result.outcome === 'NOOP' ? 0 : 1;
    } finally {
      await prisma.$disconnect();
    }
  }

  if (!process.env.DATABASE_URL) fail(`DATABASE_URL is required for read-only ${mode}`);
  const prisma = new PrismaClient();
  try {
    const db = adapt(prisma);
    if (mode === 'plan') {
      const plan = await loadBaselinePlan(db, { servicePrincipalId });
      process.stdout.write(`${JSON.stringify(plan.planDocument, null, 2)}\n`);
      process.stdout.write(`PLAN_SHA256=${plan.planSha256}\n`);
      process.stdout.write(`PLAN_OUTCOME=${plan.outcome}\n`);
      process.stdout.write(`GRANTS_TO_CREATE=${plan.grantsToCreate}\n`);
      process.stdout.write(`UNRELATED_GRANTS_SHA256=${plan.unrelatedGrantDigest ?? 'none'}\n`);
      process.stdout.write('WRITES=0\n');
      return plan.outcome === 'ABORT' ? 1 : 0;
    }
    const expectedUnrelatedDigest = typeof args['--expected-unrelated-digest'] === 'string'
      ? args['--expected-unrelated-digest']
      : undefined;
    const result = await verifyBaseline(db, { servicePrincipalId, expectedUnrelatedDigest });
    process.stdout.write(`${JSON.stringify({
      task: 'baseline-directory-grants-v1',
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
