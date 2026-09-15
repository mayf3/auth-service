---
spec_id: AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-15
revision: r1
scope:
  - fleet-default agent.session.send Grant birth provisioning on the idempotent
    client channel (transactional create + grant, secret-loss-free)
  - fleet reconciliation CLI for the agent-session-messaging audience
  - concurrent-create convergence and inspection-preservation semantics
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
related_specs:
  - AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2
  - AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    spec: AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1
    base_head: 6bce155
    pending_amendment: r4 AMENDMENT_1 (INSPECTION_PRESERVATION)
    relation: product_semantics_authority (本 Spec 只授权 materialization 机器，
      不创设 send/inspection 任何一方的产品语义)
owner_ruling_basis: >-
  OWNER REVISE ruling on PR #75 (2026-09-15): PR judged REVISE with a
  four-item blocker union (first-secret loss on stamp failure; inspection
  grant overwrite by exact-scope NORMALIZE; missing Auth-local implementation
  authority; non-idempotent concurrent grant create). Owner prescribed the
  minimal path: (1) narrowest dsh spec amendment + THIS Auth-local
  implementation authority, docs-only, accepted into the implementation base
  BEFORE implementation continues; (2) transactional/atomic client-create +
  grant-write with safe convergence to the winner — I4 freezes token
  issuance/deny paths and does NOT require the provisioning helper
  (idempotent.ts) to stay zero-diff, so the necessary transaction wiring is
  in scope here; (3) three targeted regressions (HR dual-scope re-entry
  unchanged; stamp failure never loses the first secret; concurrent requests
  converge with no duplicate rows and no gratuitous version growth) before a
  consolidated re-review. Existing implementation branch is preserved;
  NO merge / NO deploy / NO reconcile execution.
supersedes: []
superseded_by: null
owners: [mayf3]
accepted_date: 2026-09-16
accepted_by: mayf3
accepted_reviewed_head: a7ca28ecb6097b585690e7c57e9d858f0eea422f
accepted_spec_sha256: 128d16996839ef25b44785e828d37ee7eb8e643c5e61e7d6f7f390501c3241db
r1_acceptance: >-
  OWNER joint exact-head acceptance 2026-09-16（本 commit = docs-only lifecycle
  finalization：仅本 frontmatter acceptance 元数据与 docs/specs/README.md 索引行；
  reviewed semantic bytes @a7ca28e 未改动，sha256 逐字节一致，机械校验 body diff 为空）。
  Fresh independent semantic review（非 author 上下文）= PASS / BLOCKERS=NONE /
  SAFE_FOR_OWNER_ACCEPTANCE=YES（12 项逐条核：machinery-only、产品语义纯外部、
  T1 足以关闭 first-secret loss、T2 P2002 收敛定义充分、T3 不扩 credential、
  T4 只解冻 provisioning wiring、make-lawful 与 dsh r4 逐字一致、HR inspection
  不可能被删、RG1-3 完整映射、reconcile upsert-only、production_apply 不可误读、
  authority 链无环；5 条 non-gating gaps 记 FOLLOW_UP_DEBT 不在本事务吸收）。
  JOINT_ACCEPTANCE：与 mayf3/dsh-agent-core 的
  AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 r4（accepted reviewed head
  5dd41e2b7016f1a7b5cd38a664e108a284b11de7，spec sha256
  b28ec5019b52ca6c69462d26ebb1150e95a1d5195d24ca3dd153b286a64fb518）为一次
  Owner authority decision；两仓 implementation base 均物化 accepted 态前
  IMPLEMENTATION_ALLOWED=NO。PRODUCTION_AUTHORIZED=NO（生产门另行控制）。
review_status: INDEPENDENT_REVIEW_COMPLETE_PASS
---

# AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1

> **候选本地实现 authority（proposed）。** 本 Spec 是 mayf3/auth-service 仓内、
> 进入 implementation base 后授权 fleet send Grant materialization 实现的
> governing Spec（per docs/specs/README.md 实现规则：Spec 在 base + status=accepted
> + implementation_authority=contracts）。产品语义唯一权威是外部 dsh fleet Spec
> （见 external_authorities）；本 Spec 授权的是**实现机器**（§2 事务与并发、§3
> birth surface、§4 reconcile surface、§5 回归义务），并对 PR #75 blocker union
> 给出逐条修复义务（§6）。

## 1. 产品语义承接（零创设）

- `agent.session.send` = production canonical Agent 的 fleet 基线能力；集合
  机械解析 = agents.json(enabled) ∩ MachinePrincipal(principal_type='agent',
  status='active') ∩ active MachineClient（client-keyed）——全部承袭外部
  fleet Spec §2。
- Lawful row family（外部 fleet Spec §3 as amended by r4 AMENDMENT_1）：
  `['agent.session.send'] ∪ P, P ⊆ ENUMERATED_INDEPENDENT_SCOPES =
  {agent.session.inspect_own_dispatch}`。本 Spec 下 materialization 永不授予
  非 send scope，永不移除 ENUMERATED 成员（「保留独立有效授权」——已接受
  authority：AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1）。
- issuance / deny 代码路径（direct.ts、grant-migration.ts、token-issuance.ts
  的判定面）**零改动**（I4 不变量，继续成立）。

## 2. 事务与并发（blocker P1-A / P2 的修复义务）

```text
T1 原子性：client 创建与 fleet grant 写入必须原子——idempotent.ts 的 create
   路径改为 prisma.$transaction 内先建 client 再 ensure grant；事务内任何
   失败 = 整体回滚（client 行与 secret hash 均不落库）⇒ 首次 secret 永不
   丢失（重试重新 create，产出全新 client+secret 并正常返回）。
T2 并发收敛：grant create 的唯一键冲突（P2002）必须安全收敛到胜者——捕获
   P2002 ⇒ 重读该行 ⇒ 幂等返回（等价 kept / make-lawful 后 kept），不向上
   抛错；两个并发请求结束后恰一行、无重复行。
T3 重试语义：同 external_ref 的重试必须产出可用的 credential 结果（新建
   client 返 secret；resolved client + grant 已 make-lawful 时成功返回）。
T4 边界：本节授权改写 provisioning helper（idempotent.ts 的 create/claim/
   resolve 路径与 helper 签名）以接入事务；**不授权**改 direct.ts /
   grant-migration.ts / token-issuance.ts 的任何判定行为。
```

## 3. Birth surface（实现坐标，含 P1-B 修复义务）

- Route：`POST /api/v1/clients`（`src/routes/idempotent.ts`）——
  createOrGetClient 成功后同通道流程内 make-lawful stamp。
- Guard：仅 `principal_type='agent'`；audience 固定 `agent-session-messaging`；
  FLEET 仅写/补 `agent.session.send`。
- **[P1-B]保留语义**：对既有行，stamp 只做 make-lawful（缺 send 补 send）；
  `agent.session.inspect_own_dispatch` 或未来 ENUMERATED 成员在场时一律
  保留；仅 NON-enumerated 多余成员被裁剪；version 仅在集合实际变化时递增。

## 4. Reconcile surface（实现坐标）

- `scripts/reconcile-fleet-send-grants.ts`：R1 fresh join（agents.json enabled ∩
  principal('agent',active) ∩ active client，client-keyed）· R2 DRY_RUN 默认 +
  census（PRODUCTION_CANONICAL_AGENT_COUNT / SEND_ENTITLEMENT_MISSING_COUNT，
  均以 fleet principal×active-client pair 计）· R3 `--apply` 仅 upsert、
  **零 DELETE**、非成员行只读 · R4 `--selftest` 离线 · R5 每变更一条 `[AUDIT]`
  + apply 后收敛复验（exit 3 除非 missing=0）· R6 Owner 执行。
- NORMALIZE 采用 §3 make-lawful 语义；plan 输出展示 currentScopes→planScopes
  以证明保留行为。

## 5. 回归义务（Owner REVISE step 3，集中复审前置）

```text
RG1 HR 双 scope 重入不变：对 ['agent.session.send','agent.session.inspect_own_dispatch']
    既有行重复执行 birth-stamp 与 reconcile normalize ⇒ scopes 逐成员保持、
    version 不增长。
RG2 stamp 失败不丢首次 secret：create 路径任一 grant 失败 ⇒ 事务回滚、无
    client 行残留；重试产出的 client 正常携带 secret 返回。
RG3 并发收敛：两并发请求同 client 首次 stamp ⇒ 恰一行、无未处理 P2002、
    无多余 version 增长（胜者 created，败者 kept）。
原有基线失败继续单列（schema>500 行静态债、上游 forum-direct-agent-token
audit 类型缺失）——不扩修无关 hygiene。
```

## 6. Blocker union 处置表（PR #75 REVISE）

```text
P1-A 首次 secret 丢失   → §2 T1/T3 + RG2
P1-B 覆盖 HR inspection → 外部 fleet Spec r4 AMENDMENT_1（最窄规范修订）+
                          本 Spec §3 保留语义 + RG1
P1-C 缺 Auth 本地 authority → 本 Spec（候选，接受后进入 implementation base）
P2  并发建 grant 不幂等 → §2 T2 + RG3（测试 mock 必须模拟唯一键约束）
```

## 7. 边界

- 不触碰 token issuance / deny 判定行为（§1 I4）。
- 不授予、不裁剪 ENUMERATED_INDEPENDENT_SCOPES 之外的语义；不为 inspection
  scope 创设任何授权（其 authority 已独立存在）。
- 不做其他 audience / scope / principal hygiene。
- PRODUCTION_CHANGE = NONE：merge 后的 redeploy、reconcile 执行、生产
  mutation 全部另行 Owner 控制门。
