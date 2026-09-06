// supply-life-workbench-pilot-grants-v1.ts — CANDIDATE（候选仓库冻结件，未执行）。
// 执行位置：mayf3/auth-service 仓库 scripts/（随 CENTRAL_CHANGE_PLAN_V1 D2，经 Owner approvalRef 后由 authsvc 运维执行）。
// 形态对齐 accepted scripts/supply-agentcore-trusted-fleet-grants-v1.ts：
//   exact-plan-bound + fail-closed + Serializable 单事务 + grant_change_audits 审计 + rerun=NOOP。
// 硬边界：恰好 2 个 pilot Client；LEGACY_FIELD_TOUCH=FORBIDDEN（不读/不写/不校验
//   allowedResources/allowedScopes——V1 direct 签发只消费 machine_access_grants）；
//   不创建/修改/撤销任何 Principal、Client、凭据；不触碰其他 Audience。
// 审计：生产 GrantChangeAudit 13 列（changeType=create）；仅真实变更写审计行，
//   NOOP rerun 不写（幂等，对齐 accepted reconcile NOOP 语义）；plan_sha256 绑定于 reason。
// Conformance：执行时配套 fleet 同款隔离容器 harness（pinned postgres digest、
//   nonce label、清理断言），先隔离库后生产，禁止外部 DATABASE_URL。

import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

type Metadata = {
  migrationId: string;
  sourceGitCommit: string;
  operatorId: string;
  approvalRef: string;
  reason: string;
};
type Target = {
  agentId: string;
  clientExternalRef: string;
  principalExternalRef: string;
};
type RowState = { audienceId: string; scopes: string[]; version: number };
type RowOutcome = 'create' | 'noop';
type RowResult = { target: Target; outcome: RowOutcome; afterValue: Prisma.InputJsonObject };

const TASK = 'life-workbench-pilot-grant-supply-v1';
const AUDIENCE_ID = 'life-workbench';
const TARGET_SCOPES = Object.freeze(['workbench.propose', 'workbench.read']);

// Frozen exact plan — PLAN_SHA256 of the canonical form (UTF-8 JSON, keys
// sorted, separators (",",":"), ensure_ascii=false) of:
// {audience, plan_version, rows:[{agent_id, client_external_ref,
//   current_state, operation, principal_external_ref}], target_scopes}
// canonical digest = ac845e49d8db18d041732682a387536fac9b58cd1bdc30ec5d231998d534049c
const PLAN_VERSION = 'LIFE_WORKBENCH_PILOT_GRANT_SUPPLY_V1_PLAN_1';
const PLAN_SHA256 = 'ac845e49d8db18d041732682a387536fac9b58cd1bdc30ec5d231998d534049c';

// Exactly two pilot Clients. PILOT_ROSTER != FINAL_ELIGIBILITY_RULE:
// this roster authorizes nothing beyond these rows and is not the policy rule.
// LW_CONFORMANCE_MODE=1 (isolated container harness only) swaps in synthetic
// identities; production runs MUST NOT set it.
const TARGETS: readonly Target[] = Object.freeze(process.env.LW_CONFORMANCE_MODE === '1' ? [
  Object.freeze({ agentId: 'agt_lw_conformance_a', clientExternalRef: 'agentcore:v1:client:agt_lw_conformance_a', principalExternalRef: 'agentcore:v1:principal:agt_lw_conformance_a' }),
  Object.freeze({ agentId: 'agt_lw_conformance_b', clientExternalRef: 'agentcore:v1:client:agt_lw_conformance_b', principalExternalRef: 'agentcore:v1:principal:agt_lw_conformance_b' }),
] : [
  Object.freeze({ agentId: 'agt_build-in-public-agent', clientExternalRef: 'agentcore:v1:client:agt_build-in-public-agent', principalExternalRef: 'agentcore:v1:principal:agt_build-in-public-agent' }),
  Object.freeze({ agentId: 'agt_daily-thought-agent', clientExternalRef: 'agentcore:v1:client:agt_daily-thought-agent', principalExternalRef: 'agentcore:v1:principal:agt_daily-thought-agent' }),
]);

// Distinct advisory lock key for this task (fleet supply uses its own keys).
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
  return createHash('sha256')
    .update(JSON.stringify(plan), 'utf8')
    .digest('hex');
}

// Production grant_change_audits row (model GrantChangeAudit, 13 columns;
// id/timestamp are @default). changeType uses the GrantChangeType enum.
// plan_sha256 is bound via the reason text; rerun=NOOP writes NO audit row
// (idempotent, mirrors the accepted reconcile NOOP semantics).
function auditEnvelope(meta: Metadata, clientPublicId: string, afterValue: Prisma.InputJsonObject) {
  return {
    migrationId: meta.migrationId,
    sourceGitCommit: meta.sourceGitCommit,
    operatorId: meta.operatorId,
    approvalRef: meta.approvalRef,
    reason: `${meta.reason}; plan_version=${PLAN_VERSION}; plan_sha256=${PLAN_SHA256}`,
    clientId: clientPublicId,
    changeType: 'create',
    expectedGrantVersion: null,
    resultingGrantVersion: afterValue.version as number,
    beforeValue: Prisma.JsonNull,
    afterValue,
  };
}

async function main(): Promise<void> {
  const derived = canonicalPlanDigest();
  const frozen = process.env.LW_CONFORMANCE_MODE === '1' ? derived : PLAN_SHA256;
  if (derived !== frozen) {
    fail('frozen plan digest mismatch — refusing to run against any database');
  }
  const operatorId = process.env.OPERATOR_ID;
  const approvalRef = process.env.APPROVAL_REF;
  const sourceGitCommit = process.env.SOURCE_GIT_COMMIT;
  if (!operatorId || !approvalRef || !sourceGitCommit) {
    fail('OPERATOR_ID, APPROVAL_REF and SOURCE_GIT_COMMIT env are required (audited metadata)');
  }
  const meta: Metadata = {
    migrationId: `${TASK}-${randomUUID()}`,
    sourceGitCommit,
    operatorId,
    approvalRef,
    reason: 'LIFE_WORKBENCH_PILOT_GRANT_SUPPLY_V1 per CENTRAL_CHANGE_PLAN_V1 D2 (PILOT_ROSTER != FINAL_ELIGIBILITY_RULE)',
  };

  const prisma = new PrismaClient();
  const results: RowResult[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      const audience = await tx.authAudience.findUnique({ where: { audienceId: AUDIENCE_ID } });
      if (!audience || audience.status !== 'active' || audience.machineAccessEnabled !== true) {
        fail(`audience ${AUDIENCE_ID} must already be registered, active and machine-enabled (run D1 first)`);
      }
      const registryScopes = new Set<string>(audience.registeredScopes);
      for (const scope of TARGET_SCOPES) {
        if (!registryScopes.has(scope)) fail(`scope ${scope} is not registered on audience ${AUDIENCE_ID}`);
      }

      // Sorted execution; canary-first by construction (b < d).
      for (const target of [...TARGETS].sort((a, b) => a.agentId.localeCompare(b.agentId))) {
        // Explicit select ONLY: reading allowedResources/allowedScopes is
        // FORBIDDEN (legacy read counts MUST remain 0, fleet spec CTR).
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
        if (!principal) fail(`E3/E4 precondition failed for ${target.agentId}: no active agent principal (ELIGIBLE_BUT_IDENTITY_NOT_READY — use standard identity provisioning, do NOT create here)`);
        const client = principal.clients.find((c) => c.status === 'active');
        if (!client) fail(`E4 precondition failed for ${target.agentId}: no active client with external_ref ${target.clientExternalRef}`);
        if (principal.externalRef !== target.principalExternalRef) fail(`provenance mismatch for ${target.agentId}: principal external_ref does not equal the frozen plan value`);

        const existing = await tx.machineAccessGrant.findFirst({
          where: { machineClientId: client.id, audienceId: AUDIENCE_ID },
        });
        let outcome: RowOutcome;
        let afterValue: Prisma.InputJsonObject;
        if (!existing) {
          const created = await tx.machineAccessGrant.create({
            data: { machineClientId: client.id, audienceId: AUDIENCE_ID, scopes: [...TARGET_SCOPES].sort(), version: 1 },
          });
          outcome = 'create';
          afterValue = { audienceId: created.audienceId, scopes: [...created.scopes], version: created.version };
        } else {
          // End-state check only: machine_access_grants has no soft-delete
          // column, so exact scopes match means the frozen plan is satisfied.
          const same = existing.scopes.length === TARGET_SCOPES.length
            && [...TARGET_SCOPES].sort().every((s, i) => [...existing.scopes].sort()[i] === s);
          if (!same) fail(`conflict for ${target.agentId}: existing grant differs from the frozen plan (fail-closed)`);
          outcome = 'noop';
          afterValue = { audienceId: existing.audienceId, scopes: [...existing.scopes], version: existing.version };
        }
        // Only real changes are audited; a NOOP rerun stays audit-clean.
        if (outcome === 'create') {
          await tx.grantChangeAudit.create({ data: auditEnvelope(meta, client.clientId, afterValue) });
        }
        results.push({ target, outcome, afterValue });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } finally {
    await prisma.$disconnect();
  }
  for (const r of results) {
    process.stdout.write(`${JSON.stringify({ agentId: r.target.agentId, outcome: r.outcome })}\n`);
  }
  process.stdout.write(`${JSON.stringify({ task: TASK, plan_sha256: PLAN_SHA256, rows: results.length })}\n`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
