// revoke-life-workbench-pilot-grants-v1.ts — CANDIDATE（候选仓库冻结件，未执行）。
// CENTRAL_CHANGE_PLAN_V1 回滚 artifact：与 supply-life-workbench-pilot-grants-v1.ts
// 严格对称的 revoke。执行位置同 forward supply（auth-service scripts/，Owner approvalRef 后）。
//
// MECHANISM NOTE (load-bearing; verified 2026-09-06 via information_schema,
// migration history, prisma schema and direct.ts): the live
// machine_access_grants TABLE carries a revoked_at column in the production
// database, but that column exists in NO committed migration
// (20260718000100_minimal_auth_v1_additive created the table without it; no
// later ALTER exists) and the Prisma MachineAccessGrant model does NOT map
// it. The V1 direct issuance path (src/lib/oauth/v1/direct.ts, include
// accessGrants) reads through Prisma and therefore can neither see nor filter
// such a value. A soft delete is thus NOT expressible through governed code
// and MUST NOT be relied on even if the drifted column were set by hand:
// ROW DELETE with the full removed row preserved in
// grant_change_audits.before_value (changeType='revoke') is the only
// effective revoke without a code change. Re-running forward supply
// afterwards remains possible (composite PK machine_client_id+audience_id).
//
// 硬边界：恰好 2 个 pilot Client 的恰好 life-workbench 行；LEGACY_FIELD_TOUCH=FORBIDDEN；
// 不触碰其他 audience/其他 client；不修改 Principal/Client/凭据。

import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

type Metadata = {
  migrationId: string;
  sourceGitCommit: string;
  operatorId: string;
  approvalRef: string;
  reason: string;
};
type Target = { agentId: string; clientExternalRef: string; principalExternalRef: string };

const TASK = 'life-workbench-pilot-grant-revoke-v1';
const AUDIENCE_ID = 'life-workbench';
const TARGET_SCOPES = Object.freeze(['workbench.propose', 'workbench.read']);
const PLAN_VERSION = 'LIFE_WORKBENCH_PILOT_GRANT_SUPPLY_V1_PLAN_1';
// Same frozen forward-plan digest: revoke only ever targets rows that the
// forward plan could have created; anything else is drift and fails closed.
const PLAN_SHA256 = 'ac845e49d8db18d041732682a387536fac9b58cd1bdc30ec5d231998d534049c';
// LW_CONFORMANCE_MODE=1 (isolated container harness only) swaps in synthetic
// identities; production runs MUST NOT set it.
const TARGETS: readonly Target[] = Object.freeze(process.env.LW_CONFORMANCE_MODE === '1' ? [
  Object.freeze({ agentId: 'agt_lw_conformance_a', clientExternalRef: 'agentcore:v1:client:agt_lw_conformance_a', principalExternalRef: 'agentcore:v1:principal:agt_lw_conformance_a' }),
  Object.freeze({ agentId: 'agt_lw_conformance_b', clientExternalRef: 'agentcore:v1:client:agt_lw_conformance_b', principalExternalRef: 'agentcore:v1:principal:agt_lw_conformance_b' }),
] : [
  Object.freeze({ agentId: 'agt_build-in-public-agent', clientExternalRef: 'agentcore:v1:client:agt_build-in-public-agent', principalExternalRef: 'agentcore:v1:principal:agt_build-in-public-agent' }),
  Object.freeze({ agentId: 'agt_daily-thought-agent', clientExternalRef: 'agentcore:v1:client:agt_daily-thought-agent', principalExternalRef: 'agentcore:v1:principal:agt_daily-thought-agent' }),
]);
// Same advisory key as forward supply: forward and revoke are mutually
// serialized on the same pilot grant set.
const ADVISORY_LOCK_KEY = 813_947_304;

function fail(message: string): never {
  console.error(`FATAL[${TASK}]: ${message}`);
  process.exit(1);
}

function canonicalPlanDigest(): string {
  const plan = {
    audience: AUDIENCE_ID,
    plan_version: PLAN_VERSION,
    rows: [...TARGETS]
      .sort((a, b) => a.agentId.localeCompare(b.agentId))
      .map((t) => ({
        agent_id: t.agentId,
        client_external_ref: t.clientExternalRef,
        current_state: 'ABSENT',
        operation: 'CREATE',
        principal_external_ref: t.principalExternalRef,
      })),
    target_scopes: [...TARGET_SCOPES].sort(),
  };
  return createHash('sha256').update(JSON.stringify(plan), 'utf8').digest('hex');
}

async function main(): Promise<void> {
  const derived = canonicalPlanDigest();
  const frozen = process.env.LW_CONFORMANCE_MODE === '1' ? derived : PLAN_SHA256;
  if (derived !== frozen) fail('frozen plan digest mismatch — refusing to run');
  const operatorId = process.env.OPERATOR_ID;
  const approvalRef = process.env.APPROVAL_REF;
  const sourceGitCommit = process.env.SOURCE_GIT_COMMIT;
  if (!operatorId || !approvalRef || !sourceGitCommit) fail('OPERATOR_ID, APPROVAL_REF and SOURCE_GIT_COMMIT env are required');

  const meta: Metadata = {
    migrationId: `${TASK}-${randomUUID()}`,
    sourceGitCommit,
    operatorId,
    approvalRef,
    reason: `symmetric revoke of LIFE_WORKBENCH_PILOT_GRANT_SUPPLY_V1; plan_version=${PLAN_VERSION}; plan_sha256=${PLAN_SHA256}`,
  };
  const prisma = new PrismaClient();
  const outcomes: Array<{ agentId: string; outcome: 'revoke' | 'noop' }> = [];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      for (const target of [...TARGETS].sort((a, b) => a.agentId.localeCompare(b.agentId))) {
        // Explicit select ONLY — legacy fields stay outside every query.
        const principal = await tx.machinePrincipal.findFirst({
          where: { agentId: target.agentId, principalType: 'agent', status: 'active' },
          select: {
            id: true,
            externalRef: true,
            clients: {
              where: { externalRef: target.clientExternalRef },
              select: { id: true, clientId: true, status: true, externalRef: true },
            },
          },
        });
        if (!principal) fail(`identity precondition failed for ${target.agentId} (ELIGIBLE_BUT_IDENTITY_NOT_READY is not a revoke target)`);
        const client = principal.clients.find((c) => c.status === 'active');
        if (!client) fail(`client precondition failed for ${target.agentId}`);
        if (principal.externalRef !== target.principalExternalRef) fail(`provenance mismatch for ${target.agentId}`);

        const existing = await tx.machineAccessGrant.findFirst({
          where: { machineClientId: client.id, audienceId: AUDIENCE_ID },
        });
        if (!existing) {
          outcomes.push({ agentId: target.agentId, outcome: 'noop' });
          continue;
        }
        const sortedExisting = [...existing.scopes].sort();
        const sortedPlan = [...TARGET_SCOPES].sort();
        const exactForwardShape = existing.version === 1
          && sortedExisting.length === sortedPlan.length
          && sortedExisting.every((s, i) => sortedExisting[i] === sortedPlan[i]);
        if (!exactForwardShape) {
          fail(`drift for ${target.agentId}: existing grant does not match the frozen forward plan (fail-closed; manual governance required)`);
        }
        const beforeValue = {
          machineClientId: existing.machineClientId,
          audienceId: existing.audienceId,
          scopes: [...existing.scopes],
          version: existing.version,
        };
        await tx.machineAccessGrant.delete({
          where: { machineClientId_audienceId: { machineClientId: client.id, audienceId: AUDIENCE_ID } },
        });
        await tx.grantChangeAudit.create({
          data: {
            migrationId: meta.migrationId,
            sourceGitCommit: meta.sourceGitCommit,
            operatorId: meta.operatorId,
            approvalRef: meta.approvalRef,
            reason: meta.reason,
            clientId: client.clientId,
            changeType: 'revoke',
            expectedGrantVersion: existing.version,
            // production CHECK grant_change_audits_version_check requires >= 1;
            // the revoked row's own version is the version being revoked.
            resultingGrantVersion: existing.version,
            beforeValue: beforeValue as Prisma.InputJsonObject,
            // SQL NULL (not JSON null): value_shape_check requires
            // after_value IS NULL for change_type=revoke.
            afterValue: Prisma.DbNull,
          },
        });
        outcomes.push({ agentId: target.agentId, outcome: 'revoke' });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } finally {
    await prisma.$disconnect();
  }
  for (const o of outcomes) process.stdout.write(`${JSON.stringify(o)}\n`);
  process.stdout.write(`${JSON.stringify({ task: TASK, rows: outcomes.length })}\n`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
