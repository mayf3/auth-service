// reconcile-life-workbench-audience-rollback-v1.ts — CANDIDATE（候选仓库冻结件，未执行）。
// CENTRAL_CHANGE_PLAN_V1 D1 回滚 artifact：LIFE_WORKBENCH_AUDIENCE_CCR_V1 §5 冻结的
// 唯一 end-state 执行器——"audience row status='disabled'（保留行，绝不 DELETE）"。
// 执行位置：auth-service scripts/，Owner approvalRef 后由 authsvc 运维执行。
//
// 生效机制（2026-09-06 源码核实）：
//  - V1 direct 签发的 audience 检查读 runtime-contract.json 快照（bundle），不是 DB。
//    bundle 回退 1.8.0 + 快照再生成后，life-workbench 请求即在
//    audience_not_machine_enabled 处 fail-closed——本脚本的 DB 处置是纵深防御层，
//    不是唯一闸门；两层任一独立生效。
//  - auth_audiences 受 machine_access_grants.audience_id FK (ON DELETE RESTRICT)：
//    行保留（disabled）而非删除，避免 FK 冲突且保留审计/历史；若未来需要物理移除，
//    必须先 revoke 全部引用行并另立 authority，不在本 artifact 范围。
//
// 前置断言（fail-closed）：两 pilot 的 life-workbench grants 必须已不存在
// （先跑 revoke-life-workbench-pilot-grants-v1.ts），否则中止。
// 审计差异（有意）：与 forward supply / revoke 的 "NOOP 不写审计" 不同，本脚本
// 每次 rerun 均写一条 auth_security_audits——rollback 事件要求完整尝试轨迹。
// 硬边界：仅触碰 life-workbench 一行；不写 registered_scopes 等其他列。

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const TASK = 'life-workbench-audience-rollback-v1';
const AUDIENCE_ID = 'life-workbench';
const PILOT_CLIENT_EXTERNAL_REFS = Object.freeze([
  'agentcore:v1:client:agt_build-in-public-agent',
  'agentcore:v1:client:agt_daily-thought-agent',
]);
const ADVISORY_LOCK_KEY = 813_947_305; // distinct from supply/revoke key

function fail(message: string): never {
  console.error(`FATAL[${TASK}]: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const operatorId = process.env.OPERATOR_ID;
  const approvalRef = process.env.APPROVAL_REF;
  const sourceGitCommit = process.env.SOURCE_GIT_COMMIT;
  if (!operatorId || !approvalRef || !sourceGitCommit) fail('OPERATOR_ID, APPROVAL_REF and SOURCE_GIT_COMMIT env are required');

  const prisma = new PrismaClient();
  let outcome: 'disable' | 'noop';
  let afterValue: Prisma.InputJsonObject | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      // Precondition: no pilot grant rows may reference the audience anymore.
      const clients = await tx.machineClient.findMany({
        where: { externalRef: { in: [...PILOT_CLIENT_EXTERNAL_REFS] } },
        select: { id: true, clientId: true, externalRef: true },
      });
      if (clients.length !== PILOT_CLIENT_EXTERNAL_REFS.length) {
        fail('pilot clients not fully resolvable — identity state drifted; manual governance required');
      }
      const remaining = await tx.machineAccessGrant.count({
        where: { audienceId: AUDIENCE_ID, machineClientId: { in: clients.map((c) => c.id) } },
      });
      if (remaining > 0) {
        fail(`${remaining} pilot life-workbench grant row(s) still present — run revoke-life-workbench-pilot-grants-v1.ts first (fail-closed ordering)`);
      }

      const audience = await tx.authAudience.findUnique({ where: { audienceId: AUDIENCE_ID } });
      if (!audience || audience.status === 'disabled' || audience.status === 'retired') {
        outcome = 'noop';
      } else if (audience.status === 'active') {
        const updated = await tx.authAudience.update({
          where: { audienceId: AUDIENCE_ID },
          data: { status: 'disabled' },
        });
        outcome = 'disable';
        afterValue = { audienceId: updated.audienceId, status: updated.status };
      } else {
        fail(`unexpected audience status '${audience.status}' (fail-closed)`);
      }

      await tx.authSecurityAudit.create({
        data: {
          eventType: 'audience.rollback_disabled',
          result: 'success',
          details: {
            migration_id: `${TASK}-${randomUUID()}`,
            source_git_commit: sourceGitCommit,
            operator_id: operatorId,
            approval_ref: approvalRef,
            reason: 'LIFE_WORKBENCH_AUDIENCE_CCR_V1 §5 frozen rollback end-state',
            audience_id: AUDIENCE_ID,
            outcome: outcome ?? 'unknown',
            after_value: afterValue,
            bundle_revert: 'operator reverts audience-registry.json to deployed 1.8.0 bytes and regenerates the runtime snapshot (independent, independently sufficient gate)',
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } finally {
    await prisma.$disconnect();
  }
  process.stdout.write(`${JSON.stringify({ task: TASK, outcome, after_value: afterValue })}\n`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
