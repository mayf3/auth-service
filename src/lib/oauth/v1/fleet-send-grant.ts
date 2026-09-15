import type { Prisma, PrismaClient } from '@prisma/client';
import { auditLog } from '../audit.js';

/**
 * AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 (accepted,
 * dsh-agent-core @ 6bce155) — fleet-default `agent.session.send`
 * entitlement materialization.
 *
 * Product semantics (frozen by the accepted Spec):
 *
 *   agent.session.send = baseline capability of every production canonical
 *   Agent = one fleet policy → mechanically materialized entitlement.
 *   Rows are DERIVED_FROM_FLEET_POLICY / AUTO_PROVISIONED (this module, at
 *   client birth via the idempotent provisioning channel) / AUTO_RECONCILED
 *   (scripts/reconcile-fleet-send-grants.ts). MANUAL_ALLOWLIST_SEMANTICS=NO.
 *
 * Exact-scope closure (Spec §3): on audience `agent-session-messaging` the
 * only lawful grant scope set is ['agent.session.send']. Any superset,
 * subset, or different set is forbidden and normalized to the exact set.
 * A future additional scope on this audience (e.g. the inspect family) must
 * amend the governing Spec first — grant PK is (machineClientId, audienceId),
 * so both authorities would otherwise collide on one row.
 *
 * I4 boundary: token issuance/deny code paths are NOT modified. Issuance
 * keeps enforcing this row (machine_grant_missing) and client/principal
 * active state (direct.ts 'client_or_principal_inactive'); grant rows carry
 * no revoked_at column and are made inert by those issuance-time checks.
 */

export const FLEET_SEND_AUDIENCE_ID = 'agent-session-messaging';
export const FLEET_SEND_SCOPE = 'agent.session.send';
/** The exact, only lawful scope set for the fleet send grant (Spec §3). */
export const FLEET_SEND_SCOPES: readonly string[] = [FLEET_SEND_SCOPE];

function sameScopeSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const l = [...left].sort();
  const r = [...right].sort();
  return l.every((value, index) => value === r[index]);
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
    if (!sameScopeSet(existing.scopes, FLEET_SEND_SCOPES)) {
      entries.push({
        action: 'NORMALIZE',
        agentId: member.agentId,
        clientId: member.clientId,
        audienceId: FLEET_SEND_AUDIENCE_ID,
        currentScopes: existing.scopes,
        planScopes: FLEET_SEND_SCOPES,
      });
      continue;
    }
    entries.push({
      action: 'KEEP',
      agentId: member.agentId,
      clientId: member.clientId,
      audienceId: FLEET_SEND_AUDIENCE_ID,
      currentScopes: existing.scopes,
      planScopes: FLEET_SEND_SCOPES,
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

  if (!existing) {
    await store.machineAccessGrant.create({
      data: {
        machineClientId: client.id,
        audienceId: FLEET_SEND_AUDIENCE_ID,
        scopes: [...FLEET_SEND_SCOPES],
      },
    });
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'client.fleet_grant_ensured',
      principalId: principal.id,
      clientId: client.id,
      resource: FLEET_SEND_AUDIENCE_ID,
      scopes: FLEET_SEND_SCOPES.join(' '),
      success: true,
    });
    return 'created';
  }

  if (!sameScopeSet(existing.scopes, FLEET_SEND_SCOPES)) {
    await store.machineAccessGrant.update({
      where: {
        machineClientId_audienceId: {
          machineClientId: client.id,
          audienceId: FLEET_SEND_AUDIENCE_ID,
        },
      },
      data: { scopes: [...FLEET_SEND_SCOPES], version: { increment: 1 } },
    });
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'client.fleet_grant_ensured',
      principalId: principal.id,
      clientId: client.id,
      resource: FLEET_SEND_AUDIENCE_ID,
      scopes: FLEET_SEND_SCOPES.join(' '),
      success: true,
    });
    return 'normalized';
  }

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'client.fleet_grant_ensured',
    principalId: principal.id,
    clientId: client.id,
    resource: FLEET_SEND_AUDIENCE_ID,
    scopes: FLEET_SEND_SCOPES.join(' '),
    success: true,
  });
  return 'kept';
}
