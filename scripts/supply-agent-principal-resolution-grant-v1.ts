/**
 * supply-agent-principal-resolution-grant-v1.ts — controlled one-tuple HR read
 * Grant provisioning/readback vehicle.
 *
 * Authority: accepted AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1
 * (CTR-EAPR-005 authoring + CTR-EAPR-007 gating).
 *
 *   PRODUCTION_APPLY_AUTHORITY = conditional_controlled_operation
 *   IMPLEMENTATION = source-only
 *   PRODUCTION_MUTATION = NONE (this source change performs no database write)
 *
 * The sole initial intended recipient is the existing active AGENT Principal
 * dc702687-6515-4a2a-91ae-e572a9bbd766 (AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2
 * CTR-EAPR-005). The tool never selects
 * a client by display name and never creates/rotates credentials or enumerates
 * secrets: the operator supplies the HR public Client ID obtained from the
 * fresh runtime census (CTR-HRG-001 precedent), and the tool verifies — from
 * Auth's server-side client->Principal relation — that EXACTLY ONE active
 * Client is bound to the fixed Principal and that its public Client ID equals
 * the supplied one. Any ambiguity, mismatch, disabled or drifted state aborts
 * fail-closed.
 *
 * The only allowed new tuple is
 *   (that clientId, agent-principal-resolution, auth.agent.resolve)
 * with version=1. The apply transaction also materializes the auth_audiences
 * registry row if absent and writes the grant_change_audits record in the SAME
 * transaction (manifest management.audit_in_same_transaction=true,
 * SPEC_GAP-2 closure). Existing unrelated grants must remain byte-equivalent;
 * their stable semantic digest is part of plan/verify output.
 *
 * Modes:
 *   --plan    (default) read-only preimage: audience row, grant classification
 *             (absent / tombstone / live-exact / conflict), unrelated digest
 *   --apply   guarded single-tuple insert; requires BOTH the explicit env gate
 *             AGENT_PRINCIPAL_RESOLUTION_GRANT_V1_APPLY=YES (refusal happens
 *             before any database connection) and --client-id
 *   --verify  readback of the exact tuple + unrelated digest; optional
 *             --expected-unrelated-digest <sha256>
 *
 * No secret, token, hash or credential value is ever read or printed.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

// ─── Frozen constants (CTR-EAPR-005) ────────────────────────────────────────

export const FIXED_PRINCIPAL_ID = 'dc702687-6515-4a2a-91ae-e572a9bbd766';
/** Legacy OpenClaw-era HR identity — MUST NOT be the read-grant recipient (AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2 CTR-EAPR-005). */
export const LEGACY_PRINCIPAL_ID = 'bc970ced-710f-4479-9ff0-e295a1c59424';
export const AUDIENCE_ID = 'agent-principal-resolution';
export const TARGET_SCOPE = 'auth.agent.resolve';
export const MIGRATION_ID = 'agent-principal-resolution-grant-v1';
export const APPLY_REASON = 'AGENT_PRINCIPAL_RESOLUTION_HR_READ_GRANT_ACTIVATION';
export const APPLY_ENV_GATE = 'AGENT_PRINCIPAL_RESOLUTION_GRANT_V1_APPLY';

const FROZEN_AUDIENCE_ROW = Object.freeze({
  audienceId: AUDIENCE_ID,
  resourceService: 'svc-auth',
  scopeNamespace: 'auth',
  acceptedPrincipalTypes: Object.freeze(['agent']),
  registeredScopes: Object.freeze([TARGET_SCOPE]),
  humanAccessEnabled: false,
  machineAccessEnabled: true,
  delegatedAccessEnabled: false,
  status: 'active',
  freezeReady: true,
  version: 1,
});

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
  agentId: string | null;
}

export interface ToolClientRow {
  id: string;
  clientId: string;
  status: string;
}

export interface ToolGrantRow {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}

export interface ProvisionGrantDatabase {
  authAudience: {
    findUnique(args: { where: { audienceId: string } }): Promise<ToolAudienceRow | null>;
    create(args: { data: ToolAudienceRow }): Promise<unknown>;
  };
  machinePrincipal: {
    findUnique(args: { where: { id: string } }): Promise<ToolPrincipalRow | null>;
  };
  machineClient: {
    findMany(args: {
      where: { machinePrincipalId: string };
      select: { id: true; clientId: true; status: true };
    }): Promise<ToolClientRow[]>;
  };
  machineAccessGrant: {
    findUnique(args: {
      where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } };
    }): Promise<ToolGrantRow | null>;
    findMany(args: { select: { machineClientId: true; audienceId: true; scopes: true; version: true } }):
      Promise<ToolGrantRow[]>;
    create(args: { data: { machineClientId: string; audienceId: string; scopes: string[]; version: number } }):
      Promise<unknown>;
  };
  grantChangeAudit: {
    findFirst(args: { where: { migrationId: string; clientId: string; changeType: string } }):
      Promise<{ id: string } | null>;
    create(args: { data: {
      migrationId: string;
      sourceGitCommit: string;
      operatorId: string;
      approvalRef: string;
      reason: string;
      clientId: string;
      changeType: 'create';
      expectedGrantVersion: null;
      resultingGrantVersion: number;
      beforeValue: null;
      afterValue: Record<string, unknown>;
    } }): Promise<unknown>;
  };
  $transaction<T>(
    fn: (tx: ProvisionGrantDatabase) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' },
  ): Promise<T>;
}

// ─── Shared types ───────────────────────────────────────────────────────────

export type AudienceState = 'ABSENT' | 'EXACT' | 'DRIFTED';
export type GrantClassification = 'ABSENT' | 'TOMBSTONED' | 'LIVE_EXACT' | 'CONFLICT';

export interface ToolInput {
  suppliedClientId: string;
  operatorId: string;
  approvalRef: string;
  sourceGitCommit: string;
}

export interface GrantPlan {
  outcome: 'CREATE' | 'NOOP' | 'ABORT';
  abortReason: string | null;
  audience: AudienceState;
  principal: { found: boolean; principalType: string | null; status: string | null };
  binding: {
    activeClientCount: number;
    uniqueActiveClientId: string | null;
    matchesSuppliedClientId: boolean;
  };
  grant: GrantClassification;
  unrelatedGrantDigest: string | null;
}

export type ApplyOutcome = 'CREATED' | 'NOOP' | 'ABORT';
export interface GrantApplyResult {
  outcome: ApplyOutcome;
  abortReason: string | null;
  resultingGrantVersion: number | null;
  auditChangeId: string | null;
  unrelatedGrantDigest: string | null;
}

export interface GrantVerifyResult {
  outcome: 'PASS' | 'FAIL';
  failureReason: string | null;
  audience: AudienceState;
  grant: GrantClassification;
  unrelatedGrantDigest: string | null;
}

function fail(message: string): never {
  throw new Error(`agent-principal-resolution grant supply refused: ${message}`);
}

function asciiCompare(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort()
        .map((key) => [key, canonicalJson((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function sha256Hex(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalJson(value))).digest('hex');
}

/** Stable semantic projection of every grant EXCEPT the target tuple's row. */
function unrelatedGrantDigest(grants: ToolGrantRow[], targetInternalClientId: string): string {
  const projection = grants
    .filter((grant) => !(grant.machineClientId === targetInternalClientId && grant.audienceId === AUDIENCE_ID))
    .map((grant) => ({
      machineClientId: grant.machineClientId,
      audienceId: grant.audienceId,
      scopes: [...grant.scopes].sort(asciiCompare),
      version: grant.version,
    }))
    .sort((a, b) => asciiCompare(`${a.machineClientId}\0${a.audienceId}`, `${b.machineClientId}\0${b.audienceId}`));
  return sha256Hex(projection);
}

function classifyAudience(row: ToolAudienceRow | null): AudienceState {
  if (!row) return 'ABSENT';
  const exact = row.audienceId === FROZEN_AUDIENCE_ROW.audienceId
    && row.resourceService === FROZEN_AUDIENCE_ROW.resourceService
    && row.scopeNamespace === FROZEN_AUDIENCE_ROW.scopeNamespace
    && JSON.stringify([...row.acceptedPrincipalTypes].sort(asciiCompare))
      === JSON.stringify([...FROZEN_AUDIENCE_ROW.acceptedPrincipalTypes].sort(asciiCompare))
    && JSON.stringify([...row.registeredScopes].sort(asciiCompare))
      === JSON.stringify([...FROZEN_AUDIENCE_ROW.registeredScopes].sort(asciiCompare))
    && row.humanAccessEnabled === FROZEN_AUDIENCE_ROW.humanAccessEnabled
    && row.machineAccessEnabled === FROZEN_AUDIENCE_ROW.machineAccessEnabled
    && row.delegatedAccessEnabled === FROZEN_AUDIENCE_ROW.delegatedAccessEnabled
    && row.status === FROZEN_AUDIENCE_ROW.status
    && row.freezeReady === FROZEN_AUDIENCE_ROW.freezeReady
    && row.version >= 1;
  return exact ? 'EXACT' : 'DRIFTED';
}

function classifyGrant(row: ToolGrantRow | null): GrantClassification {
  if (!row) return 'ABSENT';
  if (row.version <= 0) return 'TOMBSTONED';
  if (JSON.stringify([...row.scopes].sort(asciiCompare))
    === JSON.stringify([TARGET_SCOPE])) return 'LIVE_EXACT';
  return 'CONFLICT';
}

// ─── Plan (read-only preimage) ──────────────────────────────────────────────

/**
 * Read-only census: exact audience row, fixed-principal state, the unique
 * active client binding (proved against the supplied public Client ID), the
 * exact grant preimage classification, and the unrelated-grant digest.
 */
export async function planGrant(
  db: ProvisionGrantDatabase,
  input: Pick<ToolInput, 'suppliedClientId'>,
): Promise<GrantPlan> {
  const audienceRow = await db.authAudience.findUnique({ where: { audienceId: AUDIENCE_ID } });
  const audience = classifyAudience(audienceRow);
  if (audience === 'DRIFTED') {
    return abortPlan(audience, 'AUDIENCE_DRIFTED', null,
      { found: false, principalType: null, status: null }, null, 'ABSENT');
  }

  const principal = await db.machinePrincipal.findUnique({ where: { id: FIXED_PRINCIPAL_ID } });
  if (!principal) {
    return abortPlan(audience, 'PRINCIPAL_NOT_FOUND', null, { found: false, principalType: null, status: null }, null, null);
  }
  if (principal.principalType !== 'agent') {
    return abortPlan(audience, 'PRINCIPAL_NOT_AGENT', principal,
      { found: true, principalType: principal.principalType, status: principal.status }, null, null);
  }
  if (principal.status !== 'active') {
    return abortPlan(audience, 'PRINCIPAL_DISABLED', principal,
      { found: true, principalType: principal.principalType, status: principal.status }, null, null);
  }

  const clients = await db.machineClient.findMany({
    where: { machinePrincipalId: principal.id },
    select: { id: true, clientId: true, status: true },
  });
  const activeClients = clients.filter((client) => client.status === 'active');
  if (activeClients.length === 0) {
    return abortPlan(audience, 'NO_ACTIVE_CLIENT', principal,
      { found: true, principalType: principal.principalType, status: principal.status }, null, null);
  }
  if (activeClients.length > 1) {
    return abortPlan(audience, 'AMBIGUOUS_BINDING', principal,
      { found: true, principalType: principal.principalType, status: principal.status }, null, null);
  }

  const target = activeClients[0] as ToolClientRow;
  const matchesSuppliedClientId = target.clientId === input.suppliedClientId;
  if (!matchesSuppliedClientId) {
    return abortPlan(audience, 'CLIENT_MISMATCH', principal,
      { found: true, principalType: principal.principalType, status: principal.status },
      { activeClientCount: 1, uniqueActiveClientId: target.clientId, matchesSuppliedClientId }, null);
  }

  const grantRow = await db.machineAccessGrant.findUnique({
    where: { machineClientId_audienceId: { machineClientId: target.id, audienceId: AUDIENCE_ID } },
  });
  const grant = classifyGrant(grantRow);
  if (grant === 'CONFLICT') {
    return abortPlan(audience, 'GRANT_CONFLICT', principal,
      { found: true, principalType: principal.principalType, status: principal.status },
      { activeClientCount: 1, uniqueActiveClientId: target.clientId, matchesSuppliedClientId }, grant);
  }
  if (grant === 'TOMBSTONED') {
    return abortPlan(audience, 'GRANT_TOMBSTONED_REACTIVATION_NOT_AUTHORIZED', principal,
      { found: true, principalType: principal.principalType, status: principal.status },
      { activeClientCount: 1, uniqueActiveClientId: target.clientId, matchesSuppliedClientId }, grant);
  }
  if (grant === 'ABSENT') {
    // Replay guard: an existing create-audit without the grant means a prior
    // apply claimed creation — diagnose, never blind-retry (CTR-HRG-003 form).
    const priorAudit = await db.grantChangeAudit.findFirst({
      where: { migrationId: MIGRATION_ID, clientId: target.clientId, changeType: 'create' },
    });
    if (priorAudit) {
      return abortPlan(audience, 'AUDIT_REPLAY', principal,
        { found: true, principalType: principal.principalType, status: principal.status },
        { activeClientCount: 1, uniqueActiveClientId: target.clientId, matchesSuppliedClientId }, grant);
    }
  }

  const allGrants = await db.machineAccessGrant.findMany({
    select: { machineClientId: true, audienceId: true, scopes: true, version: true },
  });

  return {
    outcome: grant === 'LIVE_EXACT' ? 'NOOP' : 'CREATE',
    abortReason: null,
    audience,
    principal: { found: true, principalType: principal.principalType, status: principal.status },
    binding: { activeClientCount: 1, uniqueActiveClientId: target.clientId, matchesSuppliedClientId: true },
    grant,
    unrelatedGrantDigest: unrelatedGrantDigest(allGrants, target.id),
  };
}

function abortPlan(
  audience: AudienceState,
  reason: string,
  principal: ToolPrincipalRow | null,
  principalView: GrantPlan['principal'],
  binding: GrantPlan['binding'] | null,
  grant: GrantClassification,
): GrantPlan {
  return {
    outcome: 'ABORT',
    abortReason: reason,
    audience,
    principal: principalView,
    binding: binding ?? { activeClientCount: 0, uniqueActiveClientId: null, matchesSuppliedClientId: false },
    grant: grant ?? 'ABSENT',
    unrelatedGrantDigest: null,
  };
}

// ─── Apply (single guarded transaction) ─────────────────────────────────────

/**
 * One Serializable transaction that re-reads and re-validates the whole
 * preimage, materializes the auth_audiences registry row if absent, inserts
 * only the exact missing tuple, and writes the grant_change_audits record in
 * the SAME transaction. NOOP when the exact live tuple already exists. Any
 * drift aborts with zero partial writes.
 */
export async function applyGrant(db: ProvisionGrantDatabase, input: ToolInput): Promise<GrantApplyResult> {
  return db.$transaction(async (tx) => {
    const preimage = await planGrant(tx, input);
    const base = {
      audience: preimage.audience,
      grant: preimage.grant,
      unrelatedGrantDigest: preimage.unrelatedGrantDigest,
    };
    if (preimage.outcome === 'ABORT') {
      return { outcome: 'ABORT' as const, abortReason: preimage.abortReason, resultingGrantVersion: null, auditChangeId: null, ...base };
    }

    if (preimage.audience === 'DRIFTED') {
      return { outcome: 'ABORT' as const, abortReason: 'AUDIENCE_DRIFTED', resultingGrantVersion: null, auditChangeId: null, ...base };
    }

    if (preimage.outcome === 'NOOP') {
      if (preimage.audience === 'ABSENT') {
        // A live grant without its registry row is a drifted state this tool
        // must not silently "fix" during a NOOP — diagnose, fail closed.
        return { outcome: 'ABORT' as const, abortReason: 'AUDIENCE_ABSENT_WITH_LIVE_GRANT', resultingGrantVersion: null, auditChangeId: null, ...base };
      }
      return { outcome: 'NOOP' as const, abortReason: null, resultingGrantVersion: 1, auditChangeId: null, ...base };
    }

    const clients = await tx.machineClient.findMany({
    where: { machinePrincipalId: FIXED_PRINCIPAL_ID },
    select: { id: true, clientId: true, status: true },
  });
    const activeClients = clients.filter((entry) => entry.status === 'active');
    const target = activeClients[0] as ToolClientRow | undefined;
    if (activeClients.length !== 1 || !target || target.clientId !== input.suppliedClientId) {
      return { outcome: 'ABORT' as const, abortReason: 'BINDING_DRIFT', resultingGrantVersion: null, auditChangeId: null, ...base };
    }

    if (preimage.audience === 'ABSENT') {
      await tx.authAudience.create({ data: { ...FROZEN_AUDIENCE_ROW } });
    }

    await tx.machineAccessGrant.create({
      data: {
        machineClientId: target.id,
        audienceId: AUDIENCE_ID,
        scopes: [TARGET_SCOPE],
        version: 1,
      },
    });

    const auditChangeId = randomUuid();
    await tx.grantChangeAudit.create({
      data: {
        migrationId: MIGRATION_ID,
        sourceGitCommit: input.sourceGitCommit,
        operatorId: input.operatorId,
        approvalRef: input.approvalRef,
        reason: APPLY_REASON,
        clientId: target.clientId,
        changeType: 'create',
        expectedGrantVersion: null,
        resultingGrantVersion: 1,
        beforeValue: null,
        afterValue: {
          audience: AUDIENCE_ID,
          scopes: [TARGET_SCOPE],
          version: 1,
          principal_id: FIXED_PRINCIPAL_ID,
          audience_row_materialized: preimage.audience === 'ABSENT',
        },
      },
    });

    return {
      outcome: 'CREATED' as const,
      abortReason: null,
      resultingGrantVersion: 1,
      auditChangeId,
      ...base,
    };
  }, { isolationLevel: 'Serializable' });
}

function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}

// ─── Verify (readback) ──────────────────────────────────────────────────────

export async function verifyGrant(
  db: ProvisionGrantDatabase,
  input: Pick<ToolInput, 'suppliedClientId'> & { expectedUnrelatedDigest?: string },
): Promise<GrantVerifyResult> {
  const plan = await planGrant(db, input);
  const failure: string | null = plan.outcome === 'ABORT'
    ? `ABORT:${plan.abortReason}`
    : plan.audience === 'ABSENT'
      ? 'AUDIENCE_ABSENT'
      : plan.audience === 'DRIFTED'
        ? 'AUDIENCE_DRIFTED'
        : plan.grant !== 'LIVE_EXACT'
          ? `GRANT_NOT_LIVE_EXACT:${plan.grant}`
          : !plan.binding.matchesSuppliedClientId
            ? 'CLIENT_MISMATCH'
            : input.expectedUnrelatedDigest && plan.unrelatedGrantDigest !== input.expectedUnrelatedDigest
              ? 'UNRELATED_DIGEST_CHANGED'
              : null;

  return {
    outcome: failure ? 'FAIL' : 'PASS',
    failureReason: failure,
    audience: plan.audience,
    grant: plan.grant,
    unrelatedGrantDigest: plan.unrelatedGrantDigest,
  };
}

// ─── Apply gate (checked BEFORE any database connection) ────────────────────

export function checkApplyAuthorization(env: Pick<NodeJS.ProcessEnv, typeof APPLY_ENV_GATE>):
  { authorized: true } | { authorized: false; reason: string } {
  if (env[APPLY_ENV_GATE] !== 'YES') {
    return {
      authorized: false,
      reason: `production apply requires ${APPLY_ENV_GATE}=YES (PRODUCTION_APPLY_AUTHORITY=conditional_controlled_operation)`,
    };
  }
  return { authorized: true };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string | true> {
  const args: Record<string, string | true> = {};
  const valueFlags = new Set(['--client-id', '--operator-id', '--approval-ref', '--expected-unrelated-digest']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (valueFlags.has(arg)) {
      const value = argv[++index];
      if (value === undefined) fail(`${arg} requires a value`);
      args[arg] = value;
    } else if (arg === '--plan' || arg === '--apply' || arg === '--verify') {
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
    fail('unable to resolve the implementation git commit for the audit envelope');
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const mode = args['--apply'] ? 'apply' : args['--verify'] ? 'verify' : 'plan';
  const suppliedClientId = typeof args['--client-id'] === 'string' ? args['--client-id'] : '';
  if (!suppliedClientId) fail('--client-id <public HR client id> is required (value comes from the fresh runtime census)');

  if (mode === 'apply') {
    const gate = checkApplyAuthorization(process.env);
    if (!gate.authorized) {
      console.error(`REFUSED: ${gate.reason}`);
      console.error('No database connection was attempted; no state was changed.');
      return 1;
    }
  }

  const operatorId = typeof args['--operator-id'] === 'string' ? args['--operator-id'] : 'unspecified-operator';
  const approvalRef = typeof args['--approval-ref'] === 'string'
    ? args['--approval-ref']
    : 'AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1';
  const expectedUnrelatedDigest = typeof args['--expected-unrelated-digest'] === 'string'
    ? args['--expected-unrelated-digest']
    : undefined;

  const prisma = new PrismaClient();
  const adapt = (client: PrismaClient | Prisma.TransactionClient): ProvisionGrantDatabase => ({
    authAudience: {
      findUnique: (args2) => client.authAudience.findUnique(args2),
      create: (args2) => client.authAudience.create(args2 as never),
    },
    machinePrincipal: {
      findUnique: (args2) => client.machinePrincipal.findUnique(args2),
    },
    machineClient: {
      findMany: (args2) => client.machineClient.findMany(args2),
    },
    machineAccessGrant: {
      findUnique: (args2) => client.machineAccessGrant.findUnique(args2),
      findMany: (args2) => client.machineAccessGrant.findMany(args2),
      create: (args2) => client.machineAccessGrant.create(args2),
    },
    grantChangeAudit: {
      findFirst: (args2) => client.grantChangeAudit.findFirst(args2 as never),
      create: (args2) => client.grantChangeAudit.create(args2 as never),
    },
    // Only the root PrismaClient ever starts a transaction; transaction
    // clients are only handed DOWN into the guarded apply closure.
    $transaction: (fn, options) => (client as PrismaClient).$transaction(
      (tx) => fn(adapt(tx)),
      options as never,
    ),
  });

  try {
    const db = adapt(prisma);
    if (mode === 'plan') {
      const plan = await planGrant(db, { suppliedClientId });
      console.log(JSON.stringify(plan, null, 2));
      return plan.outcome === 'ABORT' ? 1 : 0;
    }
    if (mode === 'apply') {
      const input: ToolInput = {
        suppliedClientId,
        operatorId,
        approvalRef,
        sourceGitCommit: gitHeadCommit(),
      };
      const result = await applyGrant(db, input);
      console.log(JSON.stringify(result, null, 2));
      return result.outcome === 'ABORT' ? 1 : 0;
    }
    const input = { suppliedClientId, operatorId, approvalRef, sourceGitCommit: gitHeadCommit(), expectedUnrelatedDigest };
    const result = await verifyGrant(db, input);
    console.log(JSON.stringify(result, null, 2));
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
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    },
  );
}
