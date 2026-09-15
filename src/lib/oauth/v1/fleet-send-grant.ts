import type { Prisma, PrismaClient } from '@prisma/client';
import { auditLog } from '../audit.js';

/**
 * AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 (accepted r4
 * AMENDMENT_1_INSPECTION_PRESERVATION, dsh-agent-core @ 5dd41e2) —
 * fleet-default `agent.session.send` entitlement materialization, under the
 * Auth-local implementation authority
 * AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1 (accepted
 * @ a7ca28e).
 *
 * Product semantics (frozen by the accepted dsh Spec r4):
 *
 *   lawful scopes(member) = ['agent.session.send'] ∪ P,
 *   P ⊆ ENUMERATED_INDEPENDENT_SCOPES = { agent.session.inspect_own_dispatch }
 *
 *   ADD      = always exactly ['agent.session.send'] (FLEET never grants
 *              any non-send scope)
 *   NORMALIZE= make-lawful: add send when absent; preserve enumerated
 *              independent scopes already present (each is governed by its
 *              own accepted Auth authority — never created by FLEET);
 *              remove only NON-enumerated extras; increment version only
 *              when the actual scope set changes.
 *
 * Materialization rows are DERIVED_FROM_FLEET_POLICY / AUTO_PROVISIONED
 * (birth-stamp via the idempotent provisioning channel, transactionally with
 * client creation) / AUTO_RECONCILED (scripts/reconcile-fleet-send-grants.ts).
 * MANUAL_ALLOWLIST_SEMANTICS=NO.
 *
 * Concurrency (T2): a grant-create unique violation (P2002 on the composite
 * PK) converges to the winner — re-read the row and continue the make-lawful
 * decision against it; P2002 is never rethrown from the create path.
 *
 * I4 boundary: token issuance/deny code paths are NOT modified. Issuance
 * keeps enforcing this row (machine_grant_missing) and client/principal
 * active state (direct.ts 'client_or_principal_inactive'); grant rows carry
 * no revoked_at column and are made inert by those issuance-time checks.
 */

export const FLEET_SEND_AUDIENCE_ID = 'agent-session-messaging';
export const FLEET_SEND_SCOPE = 'agent.session.send';
/** The fleet baseline — the only scope FLEET materialization ever writes. */
export const FLEET_SEND_SCOPES: readonly string[] = [FLEET_SEND_SCOPE];
/**
 * AMENDMENT_1 (INSPECTION_PRESERVATION): scopes on this audience that are
 * independently authorized by their own accepted Auth authorities
 * (agent.session.inspect_own_dispatch ←
 * AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1). FLEET never grants,
 * never removes, and never creates authorization for any of them; make-lawful
 * preserves those already present. Expanding this closed set requires an
 * amendment of the governing dsh Spec first.
 */
export const ENUMERATED_INDEPENDENT_SCOPES: readonly string[] = [
  'agent.session.inspect_own_dispatch',
];

function sameScopeSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const l = [...left].sort();
  const r = [...right].sort();
  return l.every((value, index) => value === r[index]);
}

/**
 * Compute the lawful target scope set for a current row (dsh r4 §3):
 * send baseline always present; enumerated independent scopes preserved
 * as-is; everything else dropped.
 */
export function makeLawfulScopes(current: readonly string[]): string[] {
  const target = new Set<string>(FLEET_SEND_SCOPES);
  for (const scope of ENUMERATED_INDEPENDENT_SCOPES) {
    if (current.includes(scope)) target.add(scope);
  }
  return [...target].sort();
}

/** Duck-typed P2002 (unique constraint violation) — works for real prisma errors and test doubles alike. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

// ─── Pure planner (shared by birth-stamp reasoning, the reconcile script,
//     and the offline --selftest) ───────────────────────────────────────────

export type FleetGrantAction = 'ADD' | 'KEEP' | 'NORMALIZE';

export interface FleetMemberPair {
  /** Canonical logical Agent id, e.g. `agt_hr-agent` (census/audit label). */
  agentId: string;
  /** MachinePrincipal id (G2: principal_type='agent', status='active'). */
  principalId: string;
  /** Active MachineClient id (G3). Entitlement is client-keyed. */
  clientId: string;
}

export interface FleetGrantPlanEntry {
  action: FleetGrantAction;
  agentId: string;
  clientId: string;
  audienceId: string;
  /** Current scopes when a row exists (null when ADD). */
  currentScopes: readonly string[] | null;
  /** Make-lawful target (ADD = send-only; NORMALIZE = lawful family member). */
  planScopes: readonly string[];
}

export interface FleetGrantCensus {
  /** Distinct fleet members (agents) represented in the member pairs. */
  productionCanonicalAgentCount: number;
  /** Fleet principal×client pairs lacking the exact target row (ADD+NORMALIZE). */
  sendEntitlementMissingCount: number;
  addCount: number;
  keepCount: number;
  normalizeCount: number;
  /** Rows on this audience not corresponding to any fleet client. Counted, NEVER mutated (Spec §5 R3: zero DELETE). */
  nonFleetGrantCount: number;
  audiencePresent: boolean;
}

export interface FleetGrantPlan {
  entries: FleetGrantPlanEntry[];
  census: FleetGrantCensus;
}

/**
 * Plan the fleet send entitlement against current grant state. Pure: no I/O,
 * deterministic, safe to run in DRY_RUN and in the offline selftest.
 *
 * `members` must already be the G1∧G2∧G3 join (the callers — the reconcile
 * script and the birth-stamp channel — resolve membership from the
 * authoritative sources; this planner never infers membership itself).
 */
export function planFleetSendGrants(params: {
  audiencePresent: boolean;
  members: ReadonlyArray<FleetMemberPair>;
  /** Current grant rows on the fleet audience, keyed by machineClientId. */
  grantsByClientId: ReadonlyMap<string, { scopes: readonly string[]; version: number }>;
  /** Count of rows on this audience whose client is not a fleet member. */
  nonFleetGrantCount: number;
}): FleetGrantPlan {
  const entries: FleetGrantPlanEntry[] = [];
  for (const member of params.members) {
    const existing = params.grantsByClientId.get(member.clientId);
    if (!existing) {
      entries.push({
        action: 'ADD',
        agentId: member.agentId,
        clientId: member.clientId,
        audienceId: FLEET_SEND_AUDIENCE_ID,
        currentScopes: null,
        planScopes: FLEET_SEND_SCOPES,
      });
      continue;
    }
    const lawful = makeLawfulScopes(existing.scopes);
    if (!sameScopeSet(existing.scopes, lawful)) {
      entries.push({
        action: 'NORMALIZE',
        agentId: member.agentId,
        clientId: member.clientId,
        audienceId: FLEET_SEND_AUDIENCE_ID,
        currentScopes: existing.scopes,
        planScopes: lawful,
      });
      continue;
    }
    entries.push({
      action: 'KEEP',
      agentId: member.agentId,
      clientId: member.clientId,
      audienceId: FLEET_SEND_AUDIENCE_ID,
      currentScopes: existing.scopes,
      planScopes: lawful,
    });
  }
  const addCount = entries.filter((e) => e.action === 'ADD').length;
  const normalizeCount = entries.filter((e) => e.action === 'NORMALIZE').length;
  const keepCount = entries.filter((e) => e.action === 'KEEP').length;
  return {
    entries,
    census: {
      productionCanonicalAgentCount: new Set(params.members.map((m) => m.agentId)).size,
      sendEntitlementMissingCount: addCount + normalizeCount,
      addCount,
      keepCount,
      normalizeCount,
      nonFleetGrantCount: params.nonFleetGrantCount,
      audiencePresent: params.audiencePresent,
    },
  };
}

// ─── Birth provisioning (Spec §4, consumed by the idempotent client route) ──

/** Minimal prisma surface used by the stamp — injectable for DB-free tests. */
export type FleetSendGrantStore = Pick<
  PrismaClient,
  'machinePrincipal' | 'authAudience' | 'machineAccessGrant'
>;

export type FleetSendStampResult =
  | 'created'
  | 'kept'
  | 'normalized'
  | 'skipped_not_agent_principal'
  | 'skipped_audience_absent_or_inactive';

/**
 * Idempotently materialize the fleet send grant for one client (idempotent
 * provisioning channel, Spec §4). Called after `createOrGetClient` succeeds
 * on the POST /api/v1/clients route — i.e. inside the same channel flow, for
 * create, claim, resolve, and concurrent-winner outcomes alike (the stamp is
 * convergent on every path).
 *
 * Guard: only `principal_type='agent'` principals are ever stamped; humans
 * are User rows (not MachinePrincipals) and service principals are excluded,
 * so neither can reach the write.
 *
 * Failure semantics: any storage error propagates (the provisioning call
 * fails closed; the idempotent external_ref retry heals). A missing or
 * inactive `agent-session-messaging` audience is skipped with an audit line
 * — without the audience row there is no lawful entitlement to materialize;
 * the reconcile script is the enforcement surface in that state.
 */
export async function ensureFleetSessionSendGrant(
  store: FleetSendGrantStore,
  client: { id: string; machinePrincipalId: string },
): Promise<FleetSendStampResult> {
  const principal = await store.machinePrincipal.findUnique({
    where: { id: client.machinePrincipalId },
  });
  if (!principal) {
    throw Object.assign(
      new Error(
        `MachinePrincipal "${client.machinePrincipalId}" not found; cannot materialize fleet send grant`,
      ),
      { statusCode: 500 },
    );
  }
  if (principal.principalType !== 'agent') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'client.fleet_grant_skipped',
      principalId: principal.id,
      clientId: client.id,
      success: true,
      error: 'not_agent_principal',
    });
    return 'skipped_not_agent_principal';
  }

  const audience = await store.authAudience.findUnique({
    where: { audienceId: FLEET_SEND_AUDIENCE_ID },
  });
  if (!audience || audience.status !== 'active') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'client.fleet_grant_skipped',
      principalId: principal.id,
      clientId: client.id,
      resource: FLEET_SEND_AUDIENCE_ID,
      success: true,
      error: 'audience_absent_or_inactive',
    });
    return 'skipped_audience_absent_or_inactive';
  }

  const existing = await store.machineAccessGrant.findUnique({
    where: {
      machineClientId_audienceId: {
        machineClientId: client.id,
        audienceId: FLEET_SEND_AUDIENCE_ID,
      },
    },
  });

  // No row yet: create the send-only baseline. A concurrent winner's insert
  // (unique violation on the composite PK) converges to their row — the
  // make-lawful decision below then runs against the winner's state (T2).
  if (!existing) {
    try {
      await store.machineAccessGrant.create({
        data: {
          machineClientId: client.id,
          audienceId: FLEET_SEND_AUDIENCE_ID,
          scopes: [...FLEET_SEND_SCOPES],
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await store.machineAccessGrant.findUnique({
        where: {
          machineClientId_audienceId: {
            machineClientId: client.id,
            audienceId: FLEET_SEND_AUDIENCE_ID,
          },
        },
      });
      if (!winner) throw error;
      const winnerLawful = makeLawfulScopes(winner.scopes);
      if (sameScopeSet(winner.scopes, winnerLawful)) {
        auditFleetGrantEnsured(principal.id, client.id);
        return 'kept';
      }
      await store.machineAccessGrant.update({
        where: {
          machineClientId_audienceId: {
            machineClientId: client.id,
            audienceId: FLEET_SEND_AUDIENCE_ID,
          },
        },
        data: { scopes: winnerLawful, version: { increment: 1 } },
      });
      auditFleetGrantEnsured(principal.id, client.id);
      return 'normalized';
    }
    auditFleetGrantEnsured(principal.id, client.id);
    return 'created';
  }

  // Row exists: make-lawful (dsh r4 §3 NORMALIZE). Enumerated independent
  // scopes present are preserved verbatim; only send may be added; only
  // non-enumerated extras are stripped; version moves only on set change.
  const lawful = makeLawfulScopes(existing.scopes);
  if (sameScopeSet(existing.scopes, lawful)) {
    auditFleetGrantEnsured(principal.id, client.id);
    return 'kept';
  }
  await store.machineAccessGrant.update({
    where: {
      machineClientId_audienceId: {
        machineClientId: client.id,
        audienceId: FLEET_SEND_AUDIENCE_ID,
      },
    },
    data: { scopes: lawful, version: { increment: 1 } },
  });
  auditFleetGrantEnsured(principal.id, client.id);
  return 'normalized';
}

function auditFleetGrantEnsured(principalId: string, clientId: string): void {
  auditLog({
    timestamp: new Date().toISOString(),
    type: 'client.fleet_grant_ensured',
    principalId,
    clientId,
    resource: FLEET_SEND_AUDIENCE_ID,
    scopes: FLEET_SEND_SCOPES.join(' '),
    success: true,
  });
}
