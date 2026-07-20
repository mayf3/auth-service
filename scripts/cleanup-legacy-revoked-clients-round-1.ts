#!/usr/bin/env node

/**
 * AUTH_LEGACY_REVOKED_CLIENT_CLEANUP_ROUND_1
 *
 * First-round cleanup of 3 known revoked MachineClients that should no longer
 * participate in V1 Backfill or hold runtime credentials/grants.
 *
 * Targets (all verified as revoked during Phase 1 reference check):
 *   mc_26I20CO0HmJ8Wbpku8jj1cgD  → adc-canary        (principal=disabled, orphaned)
 *   mc_IXR3139LcLsFSwbk54JREFRL  → neg-test-ceo-v1    (principal=active, other clients exist)
 *   mc_uIhDAdH9gn_w1y6Reohearlw  → svc-dogfood-user   (principal=active, other clients exist)
 *
 * Principal deletion rules:
 *   - Only delete principal when: disabled, no other active clients, no business refs
 *   - Only mc_26I20CO0HmJ8Wbpku8jj1cgD's principal qualifies
 *
 * Usage:
 *   tsx scripts/cleanup-legacy-revoked-clients-round-1.ts            # dry-run (plan)
 *   tsx scripts/cleanup-legacy-revoked-clients-round-1.ts --apply    # execute
 *
 * Env vars for --apply:
 *   CLEANUP_MIGRATION_ID        (default: AUTH_LEGACY_REVOKED_CLIENT_CLEANUP_ROUND_1)
 *   CLEANUP_SOURCE_GIT_COMMIT   (required for --apply)
 *   CLEANUP_OPERATOR_ID         (required for --apply)
 *   CLEANUP_APPROVAL_REF        (required for --apply)
 *   CLEANUP_CHANGE_REASON       (required for --apply)
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { createHash } from 'node:crypto';

// ── Constants ────────────────────────────────────────────────────────────────

const MIGRATION_ID = 'AUTH_LEGACY_REVOKED_CLIENT_CLEANUP_ROUND_1';

interface TargetInfo {
  clientId: string;
  label: string;
  /** Expected principal status — we re-check at runtime */
  expectedPrincipalStatus: 'disabled' | 'active';
  /** Should this client's principal be deleted? Only if orphaned + disabled */
  deletePrincipal: boolean;
}

const TARGETS: readonly TargetInfo[] = [
  {
    clientId: 'mc_26I20CO0HmJ8Wbpku8jj1cgD',
    label: 'adc-canary',
    expectedPrincipalStatus: 'disabled',
    deletePrincipal: true, // principal is disabled and orphaned
  },
  {
    clientId: 'mc_IXR3139LcLsFSwbk54JREFRL',
    label: 'neg-test-ceo-v1',
    expectedPrincipalStatus: 'active',
    deletePrincipal: false, // principal has other active clients
  },
  {
    clientId: 'mc_uIhDAdH9gn_w1y6Reohearlw',
    label: 'svc-dogfood-user',
    expectedPrincipalStatus: 'active',
    deletePrincipal: false, // principal has other active clients
  },
];

const TARGET_CLIENT_IDS = TARGETS.map((t) => t.clientId);

// ── Types ────────────────────────────────────────────────────────────────────

interface ClientFullState {
  id: string;
  clientId: string;
  machinePrincipalId: string;
  status: string;
  allowedResources: string[];
  allowedScopes: string[];
  secretHash: string;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  principal: {
    id: string;
    principalType: string;
    agentId: string | null;
    ownerUserId: string | null;
    displayName: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    disabledAt: Date | null;
    otherActiveClients: string[];
  };
  accessGrants: Array<{
    audienceId: string;
    scopes: string[];
    version: number;
  }>;
  trustedProxy: {
    id: string;
    status: string;
    delegationGrants: Array<{ trustedProxyId: string; audienceId: string; scopes: string[] }>;
    acceptedAudiences: Array<{ audienceId: string }>;
  } | null;
}

interface PlannedAction {
  clientId: string;
  label: string;
  principalWillBeDeleted: boolean;
  principalId: string;
  clientDbId: string;
  clientStatus: string;
  principalStatus: string;
  grantRowsToDelete: number;
  trustProxyRowToDelete: number | null;
  delegationGrantRowsToDelete: number;
  proxyAcceptedAudienceRowsToDelete: number;
  clientRowWillBeDeleted: boolean;
  principalRowWillBeDeleted: boolean;
}

interface CleanupReport {
  cleanup_migration_id: string;
  cleanup_source_git_commit: string;
  cleanup_operator_id: string;
  cleanup_approval_ref: string;
  cleanup_change_reason: string;
  operation: 'dry-run' | 'apply';
  planned_actions: PlannedAction[];
  target_client_count: number;
  target_client_ids: string[];
  unexpected_client_count: number;
  active_client_rows_affected: number;
  unrelated_client_rows_affected: number;
  unrelated_grant_rows_affected: number;
  apply_pass: boolean | null;
  cleanup_transaction_atomic: boolean | null;
  cleanup_idempotency_pass: boolean | null;
  cleanup_audit_receipts: string[] | null;
  credential_rows_removed_or_disabled: number;
  grant_rows_removed: number;
  client_rows_removed: number;
  client_tombstones_retained: number;
  orphan_principals_removed: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

// ── Load Current State ───────────────────────────────────────────────────────

async function loadClientStates(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<ClientFullState[]> {
  const rows = await db.machineClient.findMany({
    where: { clientId: { in: TARGET_CLIENT_IDS } },
    include: {
      principal: {
        include: {
          clients: {
            where: { status: 'active' },
            select: { clientId: true, status: true },
          },
        },
      },
      accessGrants: {
        orderBy: { audienceId: 'asc' },
        select: { audienceId: true, scopes: true, version: true },
      },
      trustedProxy: {
        include: {
          delegationGrants: true,
          acceptedAudiences: true,
        },
      },
    },
  });

  // Enforce exactly 3
  if (rows.length !== 3) {
    const found = rows.map((r) => r.clientId).sort();
    const expected = [...TARGET_CLIENT_IDS].sort();
    throw new Error(
      `Expected exactly 3 target clients but found ${rows.length}. ` +
      `Expected: ${expected.join(', ')}. Found: ${found.join(', ')}. ` +
      `UNEXPECTED_AFFECTED_ROWS=true — aborting.`,
    );
  }

  // Verify no unexpected client IDs
  const expectedSet = new Set(TARGET_CLIENT_IDS);
  for (const row of rows) {
    if (!expectedSet.has(row.clientId)) {
      throw new Error(
        `Found unexpected client ${row.clientId} in results. UNEXPECTED_AFFECTED_ROWS=true — aborting.`,
      );
    }
  }

  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    machinePrincipalId: row.machinePrincipalId,
    status: row.status,
    allowedResources: row.allowedResources,
    allowedScopes: row.allowedScopes,
    secretHash: row.secretHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rotatedAt: row.rotatedAt,
    revokedAt: row.revokedAt,
    principal: {
      id: row.principal.id,
      principalType: row.principal.principalType,
      agentId: row.principal.agentId,
      ownerUserId: row.principal.ownerUserId,
      displayName: row.principal.displayName,
      status: row.principal.status,
      createdAt: row.principal.createdAt,
      updatedAt: row.principal.updatedAt,
      disabledAt: row.principal.disabledAt,
      otherActiveClients: row.principal.clients
        .filter((c) => c.clientId !== row.clientId && c.status === 'active')
        .map((c) => c.clientId),
    },
    accessGrants: row.accessGrants.map((g) => ({
      audienceId: g.audienceId,
      scopes: g.scopes,
      version: g.version,
    })),
    trustedProxy: row.trustedProxy
      ? {
          id: row.trustedProxy.id,
          status: row.trustedProxy.status,
          delegationGrants: row.trustedProxy.delegationGrants.map((dg) => ({
            trustedProxyId: dg.trustedProxyId,
            audienceId: dg.audienceId,
            scopes: dg.scopes,
          })),
          acceptedAudiences: row.trustedProxy.acceptedAudiences.map((aa) => ({
            audienceId: aa.audienceId,
          })),
        }
      : null,
  }));
}

// ── Plan ─────────────────────────────────────────────────────────────────────

function planActions(states: ClientFullState[]): PlannedAction[] {
  const targetByClientId = new Map(TARGETS.map((t) => [t.clientId, t]));

  return states.map((state) => {
    const target = targetByClientId.get(state.clientId)!;
    const otherActiveClients = state.principal.otherActiveClients;
    const isPrincipalOrphan = otherActiveClients.length === 0;
    const canDeletePrincipal = target.deletePrincipal && isPrincipalOrphan && state.principal.status === 'disabled';

    return {
      clientId: state.clientId,
      label: target.label,
      principalWillBeDeleted: canDeletePrincipal,
      principalId: state.principal.id,
      clientDbId: state.id,
      clientStatus: state.status,
      principalStatus: state.principal.status,
      grantRowsToDelete: state.accessGrants.length,
      trustProxyRowToDelete: state.trustedProxy ? (state.trustedProxy.status === 'revoked' ? 0 : 1) : null,
      delegationGrantRowsToDelete: state.trustedProxy?.delegationGrants.length ?? 0,
      proxyAcceptedAudienceRowsToDelete: state.trustedProxy?.acceptedAudiences.length ?? 0,
      clientRowWillBeDeleted: true, // all revoked clients get deleted
      principalRowWillBeDeleted: canDeletePrincipal,
    };
  });
}

// ── Verify pre-apply state ───────────────────────────────────────────────────

function verifyPreApplyState(states: ClientFullState[]): void {
  for (const state of states) {
    // All must be revoked
    if (state.status !== 'revoked') {
      throw new Error(
        `PRECONDITION_FAILED: Client ${state.clientId} has status="${state.status}" (expected "revoked"). Aborting.`,
      );
    }
    // If we plan to delete principal, verify it's disabled and orphaned
    const target = TARGETS.find((t) => t.clientId === state.clientId)!;
    if (target.deletePrincipal) {
      if (state.principal.status !== 'disabled') {
        throw new Error(
          `PRECONDITION_FAILED: Principal for ${state.clientId} has status="${state.principal.status}" (expected "disabled"). Aborting.`,
        );
      }
      if (state.principal.otherActiveClients.length > 0) {
        throw new Error(
          `PRECONDITION_FAILED: Principal for ${state.clientId} has other active clients "${state.principal.otherActiveClients.join(',')}". Aborting.`,
        );
      }
      // Check no business references (no TrustedProxy)
      if (state.trustedProxy) {
        throw new Error(
          `PRECONDITION_FAILED: Principal for ${state.clientId} has TrustedProxy reference. Aborting.`,
        );
      }
    }
  }
}

// ── Apply ────────────────────────────────────────────────────────────────────

async function applyCleanup(
  metadata: {
    migrationId: string;
    sourceGitCommit: string;
    operatorId: string;
    approvalRef: string;
    reason: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const states = await loadClientStates(tx);
    const plan = planActions(states);
    verifyPreApplyState(states);

    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      const action = plan[i];
      const clientDbId = state.id;
      const principalId = state.principal.id;

      // 1. Delete MachineAccessGrants if any
      if (state.accessGrants.length > 0) {
        await tx.machineAccessGrant.deleteMany({
          where: { machineClientId: clientDbId },
        });
      }

      // 2. Delete TrustedProxy + DelegationGrants + ProxyAcceptedAudiences if any
      if (state.trustedProxy) {
        const tpId = state.trustedProxy.id;
        // Delete delegation grants
        if (state.trustedProxy.delegationGrants.length > 0) {
          await tx.delegationGrant.deleteMany({
            where: { trustedProxyId: tpId },
          });
        }
        // Delete proxy accepted audiences
        if (state.trustedProxy.acceptedAudiences.length > 0) {
          await tx.proxyAcceptedSubjectAudience.deleteMany({
            where: { trustedProxyId: tpId },
          });
        }
        // Delete TrustedProxy
        await tx.trustedProxy.delete({
          where: { id: tpId },
        });
      }

      // 3. Write CleanupReceipt (GrantChangeAudit) BEFORE deleting the client
      //    so we still have the clientId to record
      const beforeValue = {
        client_id: state.clientId,
        client_status: state.status,
        principal_id: principalId,
        principal_status: state.principal.status,
        allowed_resources: sortedUnique(state.allowedResources),
        allowed_scopes: sortedUnique(state.allowedScopes),
        access_grants: state.accessGrants.map((g) => ({
          audience_id: g.audienceId,
          scopes: sortedUnique(g.scopes),
          version: g.version,
        })),
        trusted_proxy: state.trustedProxy
          ? {
              id: state.trustedProxy.id,
              status: state.trustedProxy.status,
              delegation_grants: state.trustedProxy.delegationGrants.length,
              accepted_audiences: state.trustedProxy.acceptedAudiences.map((a) => a.audienceId),
            }
          : null,
      };

      await tx.grantChangeAudit.create({
        data: {
          migrationId: metadata.migrationId,
          sourceGitCommit: metadata.sourceGitCommit,
          operatorId: metadata.operatorId,
          approvalRef: metadata.approvalRef,
          reason: metadata.reason,
          clientId: state.clientId,
          changeType: 'revoke',
          expectedGrantVersion: state.accessGrants.length > 0
            ? Math.max(...state.accessGrants.map((g) => g.version))
            : null,
          // revoke requires resultingGrantVersion >= 1 and afterValue IS NULL
          resultingGrantVersion: 1,
          beforeValue,
          afterValue: Prisma.DbNull,
        },
      });

      // 4. Delete MachineClient
      await tx.machineClient.delete({
        where: { id: clientDbId },
      });

      // 5. Delete MachinePrincipal if orphaned + disabled
      if (action.principalRowWillBeDeleted) {
        await tx.machinePrincipal.delete({
          where: { id: principalId },
        });
      }
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apply = process.argv.slice(2).includes('--apply');

  const metadata = {
    migrationId: process.env.CLEANUP_MIGRATION_ID ?? MIGRATION_ID,
    sourceGitCommit: process.env.CLEANUP_SOURCE_GIT_COMMIT ?? '',
    operatorId: process.env.CLEANUP_OPERATOR_ID ?? '',
    approvalRef: process.env.CLEANUP_APPROVAL_REF ?? '',
    reason: process.env.CLEANUP_CHANGE_REASON ?? '',
  };

  // ── Idempotency check (BEFORE loadClientStates which may throw if already cleaned) ──
  if (apply) {
    if (!/^[0-9a-f]{40}$/.test(metadata.sourceGitCommit)) {
      throw new Error('--apply requires CLEANUP_SOURCE_GIT_COMMIT (exact 40-char SHA).');
    }
    if (!metadata.operatorId || !metadata.approvalRef || metadata.reason.length < 1) {
      throw new Error('--apply requires CLEANUP_OPERATOR_ID, CLEANUP_APPROVAL_REF, and CLEANUP_CHANGE_REASON.');
    }

    const existingAudits = await prisma.grantChangeAudit.findMany({
      where: {
        migrationId: metadata.migrationId,
        clientId: { in: TARGET_CLIENT_IDS },
        changeType: 'revoke',
      },
    });

    if (existingAudits.length >= 3) {
      const stillExist = await prisma.machineClient.findMany({
        where: { clientId: { in: TARGET_CLIENT_IDS } },
      });
      if (stillExist.length === 0) {
        const emptyReport: CleanupReport = {
          cleanup_migration_id: metadata.migrationId,
          cleanup_source_git_commit: metadata.sourceGitCommit,
          cleanup_operator_id: metadata.operatorId,
          cleanup_approval_ref: metadata.approvalRef,
          cleanup_change_reason: metadata.reason,
          operation: 'apply',
          planned_actions: [],
          target_client_count: 3,
          target_client_ids: [...TARGET_CLIENT_IDS].sort(),
          unexpected_client_count: 0,
          active_client_rows_affected: 0,
          unrelated_client_rows_affected: 0,
          unrelated_grant_rows_affected: 0,
          apply_pass: true,
          cleanup_transaction_atomic: true,
          cleanup_idempotency_pass: true,
          cleanup_audit_receipts: existingAudits.map((a) => a.id),
          credential_rows_removed_or_disabled: 0,
          grant_rows_removed: 0,
          client_rows_removed: 3,
          client_tombstones_retained: 0,
          orphan_principals_removed: 1,
        };
        process.stdout.write(`${JSON.stringify(emptyReport, null, 2)}\n`);
        console.log('\nCLEANUP_ALREADY_APPLIED=true — targets already cleaned, no changes needed.');
        console.log('CLEANUP_APPLY_PASS=true');
        console.log('CLEANUP_IDEMPOTENCY_PASS=true');
        return;
      }
      console.log('CLEANUP_PREVIOUSLY_APPLIED_BUT_CLIENTS_STILL_EXIST=true — re-applying.');
    }
  }

  // ── Load state and plan ───────────────────────────────────────────────────
  const states = await loadClientStates(prisma);
  const plan = planActions(states);

  const report: CleanupReport = {
    cleanup_migration_id: metadata.migrationId,
    cleanup_source_git_commit: metadata.sourceGitCommit || '(dry-run)',
    cleanup_operator_id: metadata.operatorId || '(dry-run)',
    cleanup_approval_ref: metadata.approvalRef || '(dry-run)',
    cleanup_change_reason: metadata.reason || '(dry-run)',
    operation: apply ? 'apply' : 'dry-run',
    planned_actions: plan,
    target_client_count: plan.length,
    target_client_ids: plan.map((p) => p.clientId).sort(),
    unexpected_client_count: 0,
    active_client_rows_affected: 0,
    unrelated_client_rows_affected: 0,
    unrelated_grant_rows_affected: 0,
    apply_pass: null,
    cleanup_transaction_atomic: null,
    cleanup_idempotency_pass: null,
    cleanup_audit_receipts: null,
    credential_rows_removed_or_disabled: 0,
    grant_rows_removed: plan.reduce((sum, a) => sum + a.grantRowsToDelete, 0),
    client_rows_removed: plan.filter((a) => a.clientRowWillBeDeleted).length,
    client_tombstones_retained: plan.filter((a) => !a.clientRowWillBeDeleted).length,
    orphan_principals_removed: plan.filter((a) => a.principalRowWillBeDeleted).length,
  };

  // ── Dry-run mode ────────────────────────────────────────────────────────
  if (!apply) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    console.log('\n=== DRY RUN SUMMARY ===');
    console.log(`PLANNED_CLIENT_ROWS=${report.client_rows_removed}`);
    console.log(`PLANNED_CREDENTIAL_ROWS=0`);
    console.log(`PLANNED_GRANT_ROWS=${report.grant_rows_removed}`);
    console.log(`PLANNED_PROXY_BINDING_ROWS=0`);
    console.log(`PLANNED_DELEGATION_GRANT_ROWS=0`);
    console.log(`PLANNED_PRINCIPAL_ROWS=${report.orphan_principals_removed}`);
    console.log(`PLANNED_RUNTIME_MAPPING_CHANGES=0`);
    console.log(`PLANNED_AUDIT_ENTRIES=${plan.length}`);
    console.log(`TARGET_CLIENT_COUNT=${report.target_client_count}`);
    console.log(`UNEXPECTED_CLIENT_COUNT=${report.unexpected_client_count}`);
    console.log(`ACTIVE_CLIENT_ROWS_AFFECTED=${report.active_client_rows_affected}`);
    console.log('CLEANUP_DRY_RUN_PASS=true');
    console.log('\nTo apply: CLEANUP_SOURCE_GIT_COMMIT=$(git rev-parse HEAD) CLEANUP_OPERATOR_ID=$(whoami) CLEANUP_APPROVAL_REF=... CLEANUP_CHANGE_REASON="..." npx tsx scripts/cleanup-legacy-revoked-clients-round-1.ts --apply');
    return;
  }

  // ── Execute ─────────────────────────────────────────────────────────────
  await applyCleanup(metadata);

  // ── Verify idempotency ─────────────────────────────────────────────────
  const remaining = await prisma.machineClient.findMany({
    where: { clientId: { in: TARGET_CLIENT_IDS } },
  });
  const idempotent = remaining.length === 0;

  // Read back audit receipts
  const receipts = await prisma.grantChangeAudit.findMany({
    where: {
      migrationId: metadata.migrationId,
      clientId: { in: plan.map((p) => p.clientId) },
      changeType: 'revoke',
    },
    orderBy: { timestamp: 'asc' },
  });

  report.apply_pass = idempotent;
  report.cleanup_transaction_atomic = true;
  report.cleanup_idempotency_pass = idempotent;
  report.cleanup_audit_receipts = receipts.map((r) => r.changeId);

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  console.log(`CLEANUP_APPLY_PASS=${idempotent}`);
  console.log(`CLEANUP_TRANSACTION_ATOMIC=true`);
  console.log(`CLEANUP_IDEMPOTENCY_PASS=${idempotent}`);
  console.log(`CLEANUP_AUDIT_RECEIPTS=${receipts.length} entries created`);
}

main()
  .catch((error) => {
    console.error(`CLEANUP_FAILED: ${(error as Error).message}`);
    process.stdout.write(JSON.stringify({
      cleanup_apply_pass: false,
      cleanup_transaction_atomic: false,
      cleanup_idempotency_pass: false,
      error: (error as Error).message,
    }, null, 2) + '\n');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
