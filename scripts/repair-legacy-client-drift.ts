#!/usr/bin/env node

/**
 * AUTH_V1_LEGACY_CLIENT_DRIFT_REPAIR_V1
 *
 * Forward-only, audited, idempotent repair for 3 known legacy client drifts.
 *
 * Affects exactly 3 MachineClient rows (no more, no less):
 *   A. mc_VEkoUF8KEdGk5rzD08urEGe9 — Efficiency Manager
 *      Fix allowedResources ["svc-okr"] → ["svc-workflow"]
 *      Fix allowedScopes    ["okr.read"] → ["workflow.read"]
 *      V1 Grant (svc-workflow:workflow.read) is already correct.
 *
 *   B. mc_dPqkMw6q9yVtHXOFTi5sqmsQ — SVC Workflow DOGFOOD USER
 *      Fix allowedScopes ["workflow.admin workflow.read"] → ["workflow.admin","workflow.read"]
 *      (Single string containing a space-separated pair → proper array.)
 *      No V1 Grant exists; backfill will create one after this repair.
 *
 *   C. mc_pyWPMzkM7uxAeY8eKIyF0A7P — SVC Workflow Auth V1 Canary
 *      Fix allowedScopes ["workflow.read"] → ["workflow.execute","workflow.read"]
 *      V1 Grant (svc-workflow:[workflow.execute,workflow.read]) is already correct.
 *
 * Evidence for C workflow.execute approval:
 *   - Frozen contract V1.1.0 registers workflow.execute in svc-workflow audience
 *   - Positive contract fixture direct-agent-svc-workflow uses both scopes
 *   - ADC V2 scope review explicitly maps POST routes to workflow.execute
 *   - Controlled canary report §4 documents HTTP 200 with workflow.execute workflow.read
 *   - V1 Direct test (v1-direct.test.ts) uses both scopes as default grant
 *
 * Usage:
 *   tsx scripts/repair-legacy-client-drift.ts           # dry-run (plan)
 *   tsx scripts/repair-legacy-client-drift.ts --apply   # execute
 *
 * Env vars for --apply:
 *   REPAIR_MIGRATION_ID         (default: AUTH_V1_LEGACY_CLIENT_DRIFT_REPAIR_V1)
 *   REPAIR_SOURCE_GIT_COMMIT    (required for --apply)
 *   REPAIR_OPERATOR_ID          (required for --apply)
 *   REPAIR_APPROVAL_REF         (required for --apply)
 *   REPAIR_CHANGE_REASON        (required for --apply)
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MIGRATION_ID = 'AUTH_V1_LEGACY_CLIENT_DRIFT_REPAIR_V1';

interface ClientRepair {
  clientId: string;
  repairId: string; // human-readable label
  /** Exact old allowedResources we expect to find */
  oldResources: string[];
  /** Exact new allowedResources to write */
  newResources: string[];
  /** Exact old allowedScopes we expect to find */
  oldScopes: string[];
  /** Exact new allowedScopes to write */
  newScopes: string[];
  /** Principal display name (for reporting) */
  principalName: string;
}

const REPAIRS: readonly ClientRepair[] = [
  // ── A. Efficiency Manager ─────────────────────────────────────────────────
  {
    clientId: 'mc_VEkoUF8KEdGk5rzD08urEGe9',
    repairId: 'A-EFFICIENCY-MANAGER',
    oldResources: ['svc-okr'],
    newResources: ['svc-workflow'],
    oldScopes: ['okr.read'],
    newScopes: ['workflow.read'],
    principalName: 'Efficiency Manager',
  },
  // ── B. SVC Workflow DOGFOOD USER ──────────────────────────────────────────
  {
    clientId: 'mc_dPqkMw6q9yVtHXOFTi5sqmsQ',
    repairId: 'B-DOGFOOD-USER',
    oldResources: ['svc-workflow'],
    newResources: ['svc-workflow'],
    oldScopes: ['workflow.admin workflow.read'], // single string with space
    newScopes: ['workflow.admin', 'workflow.read'],
    principalName: 'SVC Workflow DOGFOOD USER',
  },
  // ── C. SVC Workflow Auth V1 Canary ────────────────────────────────────────
  {
    clientId: 'mc_pyWPMzkM7uxAeY8eKIyF0A7P',
    repairId: 'C-CANARY',
    oldResources: ['svc-workflow'],
    newResources: ['svc-workflow'],
    oldScopes: ['workflow.read'],
    newScopes: ['workflow.execute', 'workflow.read'],
    principalName: 'SVC Workflow Auth V1 Canary Agent',
  },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface CurrentClientState {
  id: string;
  clientId: string;
  allowedResources: string[];
  allowedScopes: string[];
  principal: { displayName: string | null; agentId: string | null };
  accessGrants: Array<{ audienceId: string; scopes: string[]; version: number }>;
}

interface PlannedChange {
  clientId: string;
  repairId: string;
  principalName: string;
  resourcesChanged: boolean;
  oldResources: string[];
  newResources: string[];
  scopesChanged: boolean;
  oldScopes: string[];
  newScopes: string[];
  grantOk: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sameSet(a: string[], b: string[]): boolean {
  return JSON.stringify(sortedUnique(a)) === JSON.stringify(sortedUnique(b));
}

// ── Load Current State ───────────────────────────────────────────────────────

async function loadCurrentStates(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<CurrentClientState[]> {
  const clientIds = REPAIRS.map((r) => r.clientId);
  const rows = await db.machineClient.findMany({
    where: { clientId: { in: clientIds } },
    orderBy: { clientId: 'asc' },
    include: {
      principal: { select: { displayName: true, agentId: true } },
      accessGrants: {
        orderBy: { audienceId: 'asc' },
        select: { audienceId: true, scopes: true, version: true },
      },
    },
  });
  // Enforce exactly 3
  if (rows.length !== 3) {
    const found = rows.map((r) => r.clientId).sort();
    const expected = clientIds.sort();
    throw new Error(
      `Expected exactly 3 affected clients but found ${rows.length}. ` +
      `Expected: ${expected.join(', ')}. Found: ${found.join(', ')}. ` +
      `UNEXPECTED_AFFECTED_ROWS=YES — aborting.`,
    );
  }
  // Verify no unexpected client IDs
  const expectedSet = new Set(clientIds);
  for (const row of rows) {
    if (!expectedSet.has(row.clientId)) {
      throw new Error(
        `Found unexpected client ${row.clientId} in results. UNEXPECTED_AFFECTED_ROWS=YES — aborting.`,
      );
    }
  }
  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    allowedResources: row.allowedResources,
    allowedScopes: row.allowedScopes,
    principal: row.principal,
    accessGrants: row.accessGrants,
  }));
}

// ── Plan Changes ─────────────────────────────────────────────────────────────

function planChanges(states: CurrentClientState[]): PlannedChange[] {
  const repairByClient = new Map(REPAIRS.map((r) => [r.clientId, r]));
  return states.map((state) => {
    const repair = repairByClient.get(state.clientId)!;
    const resourcesChanged = !sameSet(state.allowedResources, repair.newResources);
    const scopesChanged = !sameSet(state.allowedScopes, repair.newScopes);

    // Check that existing V1 Grant (if any) is already correct
    const grantOk = state.accessGrants.every((grant) => {
      // For efficiency: grant should be svc-workflow:workflow.read
      // For canary: grant should be svc-workflow:[workflow.execute,workflow.read]
      // For dogfood: no grants yet
      const expectedScopes = (repair.clientId === 'mc_VEkoUF8KEdGk5rzD08urEGe9')
        ? ['workflow.read']
        : (repair.clientId === 'mc_pyWPMzkM7uxAeY8eKIyF0A7P')
          ? ['workflow.execute', 'workflow.read']
          : null;
      if (expectedScopes === null) return true; // dogfood: no grant expected
      return grant.audienceId === 'svc-workflow'
        && sameSet(grant.scopes, expectedScopes)
        && grant.version === 1;
    });

    return {
      clientId: state.clientId,
      repairId: repair.repairId,
      principalName: state.principal.displayName ?? state.principal.agentId ?? 'unknown',
      resourcesChanged,
      oldResources: state.allowedResources,
      newResources: repair.newResources,
      scopesChanged,
      oldScopes: state.allowedScopes,
      newScopes: repair.newScopes,
      grantOk,
    };
  });
}

// ── Verify old state matches expected (optimistic check) ────────────────────

function verifyOldState(states: CurrentClientState[], plan: PlannedChange[]): void {
  const repairByClient = new Map(REPAIRS.map((r) => [r.clientId, r]));
  for (const state of states) {
    const repair = repairByClient.get(state.clientId)!;
    if (!sameSet(state.allowedResources, repair.oldResources)) {
      throw new Error(
        `CLIENT ${state.clientId} old allowedResources ${JSON.stringify(state.allowedResources)} ` +
        `does not match expected ${JSON.stringify(repair.oldResources)}. ` +
        `State changed since plan — aborting.`,
      );
    }
    if (!sameSet(state.allowedScopes, repair.oldScopes)) {
      throw new Error(
        `CLIENT ${state.clientId} old allowedScopes ${JSON.stringify(state.allowedScopes)} ` +
        `does not match expected ${JSON.stringify(repair.oldScopes)}. ` +
        `State changed since plan — aborting.`,
      );
    }
  }
}

// ── Apply ────────────────────────────────────────────────────────────────────

async function applyRepairs(
  metadata: {
    migrationId: string;
    sourceGitCommit: string;
    operatorId: string;
    approvalRef: string;
    reason: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const states = await loadCurrentStates(tx);
    const plan = planChanges(states);
    verifyOldState(states, plan);

    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      const change = plan[i];

      // ── Update MachineClient legacy fields if needed ────────────────────
      const data: Record<string, unknown> = {};
      if (change.resourcesChanged) {
        data.allowedResources = change.newResources;
      }
      if (change.scopesChanged) {
        data.allowedScopes = change.newScopes;
      }
      if (Object.keys(data).length > 0) {
        await tx.machineClient.update({
          where: { id: state.id },
          data,
        });
      }

      // ── Record in GrantChangeAudit ──────────────────────────────────────
      const beforeValue = {
        client_id: state.clientId,
        allowed_resources: [...state.allowedResources].sort(),
        allowed_scopes: [...state.allowedScopes].sort(),
        access_grants: state.accessGrants.map((g) => ({
          audience_id: g.audienceId,
          scopes: [...g.scopes].sort(),
          version: g.version,
        })),
      };

      // Reload for after value
      const updated = await tx.machineClient.findUniqueOrThrow({
        where: { id: state.id },
        include: {
          principal: { select: { displayName: true, agentId: true, principalType: true } },
          accessGrants: {
            orderBy: { audienceId: 'asc' },
            select: { audienceId: true, scopes: true, version: true },
          },
        },
      });

      const afterValue = {
        client_id: updated.clientId,
        allowed_resources: [...updated.allowedResources].sort(),
        allowed_scopes: [...updated.allowedScopes].sort(),
        access_grants: updated.accessGrants.map((g) => ({
          audience_id: g.audienceId,
          scopes: [...g.scopes].sort(),
          version: g.version,
        })),
      };

      const changeType = Object.keys(data).length > 0 ? 'replace' as const : 'revoke' as const;

      await tx.grantChangeAudit.create({
        data: {
          migrationId: metadata.migrationId,
          sourceGitCommit: metadata.sourceGitCommit,
          operatorId: metadata.operatorId,
          approvalRef: metadata.approvalRef,
          reason: metadata.reason,
          clientId: state.clientId,
          changeType,
          expectedGrantVersion: null, // No grant versioning on MachineClient legacy fields
          resultingGrantVersion: 1,
          beforeValue,
          afterValue,
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

// ── Report ───────────────────────────────────────────────────────────────────

interface RepairReport {
  repair_migration_id: string;
  repair_source_git_commit: string;
  repair_operator_id: string;
  repair_approval_ref: string;
  repair_change_reason: string;
  operation: 'dry-run' | 'apply';
  planned_client_changes: PlannedChange[];
  affected_client_count: number;
  affected_client_ids: string[];
  unexpected_affected_rows: number;
  apply_pass: boolean | null;
  repair_transaction_atomic: boolean | null;
  repair_idempotency_pass: boolean | null;
  repair_audit_receipts: string[] | null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apply = process.argv.slice(2).includes('--apply');

  const metadata = {
    migrationId: process.env.REPAIR_MIGRATION_ID ?? MIGRATION_ID,
    sourceGitCommit: process.env.REPAIR_SOURCE_GIT_COMMIT ?? '',
    operatorId: process.env.REPAIR_OPERATOR_ID ?? '',
    approvalRef: process.env.REPAIR_APPROVAL_REF ?? '',
    reason: process.env.REPAIR_CHANGE_REASON ?? '',
  };

  const states = await loadCurrentStates(prisma);
  const plan = planChanges(states);

  const report: RepairReport = {
    repair_migration_id: metadata.migrationId,
    repair_source_git_commit: metadata.sourceGitCommit || '(dry-run)',
    repair_operator_id: metadata.operatorId || '(dry-run)',
    repair_approval_ref: metadata.approvalRef || '(dry-run)',
    repair_change_reason: metadata.reason || '(dry-run)',
    operation: apply ? 'apply' : 'dry-run',
    planned_client_changes: plan,
    affected_client_count: plan.length,
    affected_client_ids: plan.map((p) => p.clientId).sort(),
    unexpected_affected_rows: 0,
    apply_pass: null,
    repair_transaction_atomic: null,
    repair_idempotency_pass: null,
    repair_audit_receipts: null,
  };

  // ── Dry-run mode ────────────────────────────────────────────────────────
  if (!apply) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    console.log('REPAIR_DRY_RUN_PASS=true');
    console.log('To apply: REPAIR_SOURCE_GIT_COMMIT=$(git rev-parse HEAD) REPAIR_OPERATOR_ID=$(whoami) REPAIR_APPROVAL_REF=... REPAIR_CHANGE_REASON="..." tsx scripts/repair-legacy-client-drift.ts --apply');
    return;
  }

  // ── Apply mode: validate metadata ───────────────────────────────────────
  if (!/^[0-9a-f]{40}$/.test(metadata.sourceGitCommit)) {
    throw new Error('--apply requires REPAIR_SOURCE_GIT_COMMIT (exact 40-char SHA).');
  }
  if (!metadata.operatorId || !metadata.approvalRef || metadata.reason.length < 1) {
    throw new Error('--apply requires REPAIR_OPERATOR_ID, REPAIR_APPROVAL_REF, and REPAIR_CHANGE_REASON.');
  }

  // ── Idempotency: check if already applied ───────────────────────────────
  const existingAudits = await prisma.grantChangeAudit.findMany({
    where: {
      migrationId: metadata.migrationId,
      clientId: { in: plan.map((p) => p.clientId) },
    },
  });
  if (existingAudits.length > 0) {
    // Already applied — verify state is correct
    const allApplyOK = plan.every((p) => !p.resourcesChanged && !p.scopesChanged);
    if (allApplyOK) {
      console.log('REPAIR_ALREADY_APPLIED=true — state matches expected, no changes needed.');
      report.apply_pass = true;
      report.repair_idempotency_pass = true;
      report.repair_transaction_atomic = true;
      report.repair_audit_receipts = existingAudits.map((a) => a.changeId);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      console.log('REPAIR_APPLY_PASS=true');
      console.log('REPAIR_IDEMPOTENCY_PASS=true');
      return;
    }
    // State doesn't match — rerun
    console.log('REPAIR_PREVIOUSLY_APPLIED_BUT_STATE_MISMATCH=true — re-applying.');
  }

  // ── Execute ─────────────────────────────────────────────────────────────
  await applyRepairs(metadata);

  // ── Verify idempotency: re-run plan should show no changes ──────────────
  const verifyStates = await loadCurrentStates(prisma);
  const verifyPlan = planChanges(verifyStates);
  const idempotent = verifyPlan.every((p) => !p.resourcesChanged && !p.scopesChanged);

  // Read back audit receipts
  const receipts = await prisma.grantChangeAudit.findMany({
    where: {
      migrationId: metadata.migrationId,
      clientId: { in: plan.map((p) => p.clientId) },
    },
    orderBy: { timestamp: 'asc' },
  });

  report.apply_pass = true;
  report.repair_transaction_atomic = true;
  report.repair_idempotency_pass = idempotent;
  report.repair_audit_receipts = receipts.map((r) => r.changeId);

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  console.log(`REPAIR_APPLY_PASS=true`);
  console.log(`REPAIR_TRANSACTION_ATOMIC=true`);
  console.log(`REPAIR_IDEMPOTENCY_PASS=${idempotent}`);
  console.log(`REPAIR_AUDIT_RECEIPTS=${receipts.length} entries created`);
}

main()
  .catch((error) => {
    console.error(`REPAIR_FAILED: ${(error as Error).message}`);
    process.stdout.write(JSON.stringify({
      repair_apply_pass: false,
      repair_transaction_atomic: false, // Transaction rolled back on error
      repair_idempotency_pass: false,
      error: (error as Error).message,
    }, null, 2) + '\n');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
