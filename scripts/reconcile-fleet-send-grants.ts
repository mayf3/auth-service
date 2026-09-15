/**
 * AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 (accepted,
 * dsh-agent-core @ 6bce155) — fleet reconciliation for the baseline
 * `agent.session.send` entitlement (Spec §5, requirements R1–R6).
 *
 * Recomputes PRODUCTION_CANONICAL_FLEET membership FRESH at execution time
 * (R1: authoritative join, no cached roster, no CLI-supplied agent list):
 *
 *   G1  runtime Agent Definition config (agents.json): entry present,
 *       disabled=false
 *   G2  MachinePrincipal bound to that exact agent_id with
 *       principal_type='agent' (Prisma lowercase literal) and status='active'
 *   G3  at least one active MachineClient of that principal (entitlement is
 *       client-keyed: every active client of a fleet member is a pair)
 *
 * and materializes the exact target row per fleet principal×client pair:
 *
 *   { audience 'agent-session-messaging', scopes ['agent.session.send'] }
 *
 * Semantics: DRY_RUN is the default (R2); --apply performs idempotent
 * upserts only — zero DELETE (R3: rows are made inert by issuance-time
 * active checks, never removed here); every mutation emits one [AUDIT] JSON
 * line on stdout (R5); rerunning converges (R5). Execution is an Owner act
 * on the authsvc host (R6). Token issuance/deny paths are untouched (I4).
 *
 * Usage:
 *   npx tsx scripts/reconcile-fleet-send-grants.ts --selftest
 *   npx tsx scripts/reconcile-fleet-send-grants.ts                       # DRY_RUN
 *   npx tsx scripts/reconcile-fleet-send-grants.ts --apply
 *   npx tsx scripts/reconcile-fleet-send-grants.ts --agents-json <path>  # override G1 source
 *
 * Exit codes: 0 = green (or selftest pass); 2 = audience absent/inactive;
 * 3 = post-apply verification did not converge (SEND_ENTITLEMENT_MISSING_COUNT != 0).
 */
import 'dotenv/config';

import fs from 'node:fs';

import { PrismaClient } from '@prisma/client';

import {
  FLEET_SEND_AUDIENCE_ID,
  FLEET_SEND_SCOPES,
  planFleetSendGrants,
  type FleetGrantPlan,
  type FleetMemberPair,
} from '../src/lib/oauth/v1/fleet-send-grant.js';

const prisma = new PrismaClient();

interface AgentDefinitionEntry {
  id: string;
  name?: string;
  disabled?: boolean;
}

function parseArgs(argv: readonly string[]): {
  apply: boolean;
  selftest: boolean;
  agentsJson: string;
} {
  let apply = false;
  let selftest = false;
  let agentsJson = '/usr/local/libexec/agent-core/config/agents.json';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') apply = true;
    else if (arg === '--selftest') selftest = true;
    else if (arg === '--agents-json') {
      i += 1;
      if (i >= argv.length) throw new Error('--agents-json requires a path argument');
      agentsJson = argv[i];
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply, selftest, agentsJson };
}

function audit(event: Record<string, unknown>): void {
  // R5: one structured line per mutation, same [AUDIT] convention as the
  // server's stderr audit stream, emitted on stdout for the Owner receipt.
  console.log('[AUDIT]', JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
}

// ─── R4: offline selftest — pure planner fixtures, no DB, no agents.json ───

interface SelftestCase {
  name: string;
  audiencePresent: boolean;
  members: FleetMemberPair[];
  grants: Array<{ clientId: string; scopes: string[]; version: number }>;
  nonFleetGrantCount: number;
  expect: { add: number; keep: number; normalize: number; missing: number; agents: number };
}

function selftestCases(): SelftestCase[] {
  return [
    {
      name: 'mixed_add_keep_normalize_multi_client',
      audiencePresent: true,
      members: [
        { agentId: 'agt_a', principalId: 'p-a1', clientId: 'c-a1' },
        { agentId: 'agt_a', principalId: 'p-a1', clientId: 'c-a2' },
        { agentId: 'agt_b', principalId: 'p-b1', clientId: 'c-b1' },
        { agentId: 'agt_c', principalId: 'p-c1', clientId: 'c-c1' },
      ],
      grants: [
        { clientId: 'c-a1', scopes: ['agent.session.send'], version: 1 },
        { clientId: 'c-b1', scopes: ['agent.session.send', 'agent.session.inspect_own_dispatch'], version: 3 },
      ],
      nonFleetGrantCount: 2,
      expect: { add: 2, keep: 1, normalize: 1, missing: 3, agents: 3 },
    },
    {
      name: 'empty_fleet_zero_everything',
      audiencePresent: true,
      members: [],
      grants: [{ clientId: 'c-x', scopes: ['agent.session.send'], version: 1 }],
      nonFleetGrantCount: 1,
      expect: { add: 0, keep: 0, normalize: 0, missing: 0, agents: 0 },
    },
    {
      name: 'audience_absent_still_plans_but_flags',
      audiencePresent: false,
      members: [{ agentId: 'agt_a', principalId: 'p-a1', clientId: 'c-a1' }],
      grants: [],
      nonFleetGrantCount: 0,
      expect: { add: 1, keep: 0, normalize: 0, missing: 1, agents: 1 },
    },
  ];
}

function runSelftest(): boolean {
  let ok = true;
  for (const testCase of selftestCases()) {
    const grantsByClientId = new Map(
      testCase.grants.map((g) => [g.clientId, { scopes: g.scopes, version: g.version }]),
    );
    const plan = planFleetSendGrants({
      audiencePresent: testCase.audiencePresent,
      members: testCase.members,
      grantsByClientId,
      nonFleetGrantCount: testCase.nonFleetGrantCount,
    });
    const c = plan.census;
    const pass =
      c.addCount === testCase.expect.add &&
      c.keepCount === testCase.expect.keep &&
      c.normalizeCount === testCase.expect.normalize &&
      c.sendEntitlementMissingCount === testCase.expect.missing &&
      c.productionCanonicalAgentCount === testCase.expect.agents;
    console.log(
      `${pass ? 'PASS' : 'FAIL'} selftest:${testCase.name} ` +
        `add=${c.addCount} keep=${c.keepCount} normalize=${c.normalizeCount} ` +
        `missing=${c.sendEntitlementMissingCount} agents=${c.productionCanonicalAgentCount}`,
    );
    if (!pass) ok = false;
  }
  return ok;
}

// ─── Live reconcile (R1: fresh join from authoritative sources) ────────────

interface FreshMembership {
  members: FleetMemberPair[];
  stats: {
    definitionAgents: number;
    definitionEnabledAgents: number;
    notProvisionedAgentIds: string[];
    principalsOutsideDefinition: string[];
    fleetAgents: number;
    fleetPairs: number;
  };
}

async function resolveFreshMembership(agentsJsonPath: string): Promise<FreshMembership> {
  // G1 — runtime Agent Definition config (existence + enabled leg).
  const raw = JSON.parse(fs.readFileSync(agentsJsonPath, 'utf8')) as {
    agents: AgentDefinitionEntry[];
  };
  const definition = (raw.agents ?? []).filter((a) => a && typeof a.id === 'string');
  const enabledIds = new Set(
    definition.filter((a) => a.disabled !== true).map((a) => a.id),
  );

  // G2 — machine principals bound to those exact agent ids (lowercase
  // Prisma literal; humans are User rows and cannot appear here).
  const principals = await prisma.machinePrincipal.findMany({
    where: { principalType: 'agent', status: 'active' },
    select: { id: true, agentId: true },
  });
  const principalByAgentId = new Map<string, string>();
  const principalsOutsideDefinition: string[] = [];
  for (const p of principals) {
    if (p.agentId && enabledIds.has(p.agentId)) principalByAgentId.set(p.agentId, p.id);
    else if (p.agentId) principalsOutsideDefinition.push(p.agentId);
  }

  // G3 — every active client of each fleet principal (client-keyed pairs).
  const principalIds = [...new Set(principalByAgentId.values())];
  const clients = await prisma.machineClient.findMany({
    where: { machinePrincipalId: { in: principalIds }, status: 'active' },
    select: { id: true, machinePrincipalId: true },
  });
  const agentIdByPrincipalId = new Map(
    [...principalByAgentId.entries()].map(([agentId, principalId]) => [principalId, agentId]),
  );
  const members: FleetMemberPair[] = clients.map((c) => ({
    agentId: agentIdByPrincipalId.get(c.machinePrincipalId)!,
    principalId: c.machinePrincipalId,
    clientId: c.id,
  }));

  const notProvisioned = [...enabledIds].filter((id) => !principalByAgentId.has(id));
  return {
    members,
    stats: {
      definitionAgents: definition.length,
      definitionEnabledAgents: enabledIds.size,
      notProvisionedAgentIds: notProvisioned,
      principalsOutsideDefinition,
      fleetAgents: principalByAgentId.size,
      fleetPairs: members.length,
    },
  };
}

async function main(): Promise<number> {
  const { apply, selftest, agentsJson } = parseArgs(process.argv.slice(2));

  if (selftest) {
    const ok = runSelftest();
    console.log(ok ? 'SELFTEST_ALL_OK' : 'SELFTEST_FAILED');
    return ok ? 0 : 1;
  }

  // R1 — fresh membership, recomputed now.
  const membership = await resolveFreshMembership(agentsJson);
  const fleetClientIds = new Set(membership.members.map((m) => m.clientId));

  const audience = await prisma.authAudience.findUnique({
    where: { audienceId: FLEET_SEND_AUDIENCE_ID },
    select: { audienceId: true, status: true },
  });
  const audiencePresent = Boolean(audience && audience.status === 'active');
  if (!audiencePresent) {
    console.error(
      `FATAL: audience "${FLEET_SEND_AUDIENCE_ID}" is absent or inactive in the auth DB; ` +
        `no lawful entitlement can be materialized. REFUSING to proceed (fail-closed).`,
    );
    return 2;
  }

  const grants = await prisma.machineAccessGrant.findMany({
    where: { audienceId: FLEET_SEND_AUDIENCE_ID },
    select: { machineClientId: true, scopes: true, version: true },
  });
  const grantsByClientId = new Map(
    grants.map((g) => [g.machineClientId, { scopes: g.scopes, version: g.version }]),
  );
  const nonFleetGrantCount = grants.filter((g) => !fleetClientIds.has(g.machineClientId)).length;

  let plan: FleetGrantPlan = planFleetSendGrants({
    audiencePresent,
    members: membership.members,
    grantsByClientId,
    nonFleetGrantCount,
  });

  console.log(JSON.stringify({ census: plan.census, membership: membership.stats }, null, 2));
  for (const entry of plan.entries) {
    if (entry.action === 'KEEP') continue;
    console.log(
      JSON.stringify({
        plan: entry.action,
        agentId: entry.agentId,
        clientId: entry.clientId,
        currentScopes: entry.currentScopes,
        planScopes: entry.planScopes,
      }),
    );
  }
  console.log(`MODE=${apply ? 'APPLY' : 'DRY_RUN'}`);

  if (!apply) {
    console.log(
      'DRY_RUN complete. Re-run with --apply to materialize. Nothing was written.',
    );
    return 0;
  }

  // R3 — idempotent upserts only; zero DELETE. Non-fleet rows are never
  // touched (their inertness is enforced by issuance-time active checks).
  for (const entry of plan.entries) {
    if (entry.action === 'ADD') {
      await prisma.machineAccessGrant.create({
        data: {
          machineClientId: entry.clientId,
          audienceId: FLEET_SEND_AUDIENCE_ID,
          scopes: [...FLEET_SEND_SCOPES],
        },
      });
      audit({
        type: 'fleet_send_grant.materialized',
        action: 'ADD',
        agentId: entry.agentId,
        clientId: entry.clientId,
        resource: FLEET_SEND_AUDIENCE_ID,
        scopes: FLEET_SEND_SCOPES.join(' '),
        success: true,
      });
    } else if (entry.action === 'NORMALIZE') {
      await prisma.machineAccessGrant.update({
        where: {
          machineClientId_audienceId: {
            machineClientId: entry.clientId,
            audienceId: FLEET_SEND_AUDIENCE_ID,
          },
        },
        data: { scopes: [...FLEET_SEND_SCOPES], version: { increment: 1 } },
      });
      audit({
        type: 'fleet_send_grant.materialized',
        action: 'NORMALIZE',
        agentId: entry.agentId,
        clientId: entry.clientId,
        resource: FLEET_SEND_AUDIENCE_ID,
        scopes: FLEET_SEND_SCOPES.join(' '),
        previousScopes: (entry.currentScopes ?? []).join(' '),
        success: true,
      });
    }
  }

  // R5 — convergence verification: recompute fresh and require zero missing.
  const recheck = await resolveFreshMembership(agentsJson);
  const recheckClientIds = new Set(recheck.members.map((m) => m.clientId));
  const recheckGrants = await prisma.machineAccessGrant.findMany({
    where: { audienceId: FLEET_SEND_AUDIENCE_ID },
    select: { machineClientId: true, scopes: true, version: true },
  });
  const recheckGrantsByClientId = new Map(
    recheckGrants.map((g) => [g.machineClientId, { scopes: g.scopes, version: g.version }]),
  );
  plan = planFleetSendGrants({
    audiencePresent: true,
    members: recheck.members,
    grantsByClientId: recheckGrantsByClientId,
    nonFleetGrantCount: recheckGrants.filter((g) => !recheckClientIds.has(g.machineClientId)).length,
  });
  console.log(JSON.stringify({ postApplyCensus: plan.census }, null, 2));
  if (plan.census.sendEntitlementMissingCount !== 0) {
    console.error('POST_APPLY_VERIFICATION_FAILED: SEND_ENTITLEMENT_MISSING_COUNT != 0');
    return 3;
  }
  console.log('POST_APPLY_VERIFICATION_OK: SEND_ENTITLEMENT_MISSING_COUNT=0');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
