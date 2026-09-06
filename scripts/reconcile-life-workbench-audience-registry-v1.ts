// reconcile-life-workbench-audience-registry-v1.ts — D1 execution artifact.
// LIFE_WORKBENCH_AUDIENCE_CCR_V1 (accepted) §4.2: single-row INSERT OR NOOP of
// the exact frozen audience entry, one Serializable transaction, durable
// auth_security_audits record, fail-closed on drift/conflict. Offline: no
// network access. Mirrors reconcile-svc-forum-audience-registry-v1.ts shape.
//
// Expected end-state (the ONLY row this task may create):
//   audience_id            = life-workbench
//   resource_service       = life-workbench
//   scope_namespace        = workbench
//   accepted_principal_types = {agent}
//   human_access_enabled   = false
//   machine_access_enabled = true
//   delegated_access_enabled = false
//   registered_scopes      = {workbench.propose, workbench.read}
//   status = active, freeze_ready = true
// Rerun with the exact end-state present = NOOP (still audited as noop attempt
// via the same event type). Any different existing row = fail-closed.

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

const TASK = 'life-workbench-audience-registry-v1';
const AUDIENCE_ID = 'life-workbench';
const TARGET = Object.freeze({
  audienceId: 'life-workbench',
  resourceService: 'life-workbench',
  scopeNamespace: 'workbench',
  acceptedPrincipalTypes: ['agent'],
  humanAccessEnabled: false,
  machineAccessEnabled: true,
  delegatedAccessEnabled: false,
  registeredScopes: ['workbench.propose', 'workbench.read'],
  status: 'active',
  freezeReady: true,
});
const ADVISORY_LOCK_KEY = 813_947_306; // distinct from supply/revoke/rollback keys
const AUDIT_EVENT_TYPE = 'audience.life_workbench_registered';

type Metadata = {
  migrationId: string;
  sourceGitCommit: string;
  operatorId: string;
  approvalRef: string;
  reason: string;
};

function fail(message: string): never {
  console.error(`FATAL[${TASK}]: ${message}`);
  process.exit(1);
}

function snapshot(row: {
  audienceId: string; resourceService: string; scopeNamespace: string;
  acceptedPrincipalTypes: string[]; registeredScopes: string[];
  humanAccessEnabled: boolean; machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean; status: string; freezeReady: boolean;
  version: number;
}): Prisma.InputJsonObject {
  return {
    audience_id: row.audienceId,
    resource_service: row.resourceService,
    scope_namespace: row.scopeNamespace,
    accepted_principal_types: [...row.acceptedPrincipalTypes],
    registered_scopes: [...row.registeredScopes],
    human_access_enabled: row.humanAccessEnabled,
    machine_access_enabled: row.machineAccessEnabled,
    delegated_access_enabled: row.delegatedAccessEnabled,
    status: row.status,
    freeze_ready: row.freezeReady,
    version: row.version,
  };
}

async function main(): Promise<void> {
  const operatorId = process.env.OPERATOR_ID;
  const approvalRef = process.env.APPROVAL_REF;
  const sourceGitCommit = process.env.SOURCE_GIT_COMMIT;
  if (!operatorId || !approvalRef || !sourceGitCommit) {
    fail('OPERATOR_ID, APPROVAL_REF and SOURCE_GIT_COMMIT env are required');
  }
  const meta: Metadata = {
    migrationId: `${TASK}-${randomUUID()}`,
    sourceGitCommit,
    operatorId,
    approvalRef,
    reason: 'LIFE_WORKBENCH_AUDIENCE_CCR_V1 (accepted) §4.2 single-row registration',
  };

  const prisma = new PrismaClient();
  let outcome: 'insert' | 'noop';
  let beforeValue: Prisma.InputJsonObject | null = null;
  let afterValue: Prisma.InputJsonObject;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);
      const existing = await tx.authAudience.findUnique({ where: { audienceId: AUDIENCE_ID } });
      if (!existing) {
        const created = await tx.authAudience.create({ data: { ...TARGET, version: 1 } });
        outcome = 'insert';
        beforeValue = null;
        afterValue = snapshot(created);
      } else {
        const match = existing.resourceService === TARGET.resourceService
          && existing.scopeNamespace === TARGET.scopeNamespace
          && JSON.stringify([...existing.acceptedPrincipalTypes].sort()) === JSON.stringify([...TARGET.acceptedPrincipalTypes].sort())
          && existing.humanAccessEnabled === TARGET.humanAccessEnabled
          && existing.machineAccessEnabled === TARGET.machineAccessEnabled
          && existing.delegatedAccessEnabled === TARGET.delegatedAccessEnabled
          && JSON.stringify([...existing.registeredScopes].sort()) === JSON.stringify([...TARGET.registeredScopes].sort())
          && existing.status === TARGET.status
          && existing.freezeReady === TARGET.freezeReady;
        if (!match) fail(`existing audience row drifts from the frozen target (fail-closed): ${JSON.stringify(snapshot(existing))}`);
        outcome = 'noop';
        beforeValue = snapshot(existing);
        afterValue = snapshot(existing);
      }
      await tx.authSecurityAudit.create({
        data: {
          eventType: AUDIT_EVENT_TYPE,
          result: 'success',
          details: {
            migration_id: meta.migrationId,
            source_git_commit: meta.sourceGitCommit,
            operator_id: meta.operatorId,
            approval_ref: meta.approvalRef,
            reason: meta.reason,
            outcome,
            before_value: beforeValue,
            after_value: afterValue,
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } finally {
    await prisma.$disconnect();
  }
  process.stdout.write(`${JSON.stringify({ task: TASK, outcome, audience_id: AUDIENCE_ID })}\n`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
