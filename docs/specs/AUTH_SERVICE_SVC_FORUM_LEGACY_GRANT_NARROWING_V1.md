---
spec_id: AUTH_SERVICE_SVC_FORUM_LEGACY_GRANT_NARROWING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_SVC_FORUM_LEGACY_GRANT_NARROWING_V1

## 1. Goal

Parent Spec `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`（accepted）以 CTR-FR-004
冻结禁止 scope 封闭集合：`forum.moderate`、`forum.admin`、`forum.*` 与任何
wildcard 一律不得出现在注册面或任何 Machine Grant。姊妹 Child Spec
`AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1`（accepted）的
离线 reconciliation 工具在 CTR-RR-003 前置 4（全库无任何 Machine Grant 含
`forum.moderate`）处 fail-loud：2026-08-22 执行 dispatch 的生产只读 plan 被
拒绝，零写入。

本 Spec 是 **authority-only child implementation Spec**：承接"把生产中唯一
一条含 `forum.moderate` 的 Machine Grant 单行收窄回 Parent 冻结的
`forum.read` + `forum.write`"这一实现权限，不重开任何 Parent / 姊妹 Spec
已冻结的产品决定，不 supersede、不 amend。

冻结的唯一生产状态变化（owner 已于 2026-08-22 dispatch 明确授权"最小降权"）：

```text
machine_access_grants
where machine_client_id = b4f209b3-968c-4bf2-8aac-4b9528752e75
  and audience_id = 'svc-forum'
scopes: [forum.moderate, forum.read, forum.write] → [forum.read, forum.write]
version: 1 → 2
+ 同事务一条 grant_change_audits 'replace' 审计（expected 1 → resulting 2）
```

除此之外的一切（client 行、principal、其他 380 条 Grant、legacy 列、
Audience 行、identity）保持字节不变。

## 2. Scope and non-goals

### In scope

- 冻结精确问题陈述（唯一违规 Grant 的完整坐标，§4）；
- 冻结精确实现文件闭包（恰好三个文件，§9 CTR-NG-001）；
- 冻结唯一允许的生产状态变化与其禁止清单（§9 CTR-NG-002）；
- 冻结事务内前置校验（§9 CTR-NG-003，含 principal active 前置）；
- 冻结事务、锁与审计模型（§9 CTR-NG-004 / CTR-NG-005）；
- 冻结重跑与冲突语义（§9 CTR-NG-006，15 项 conflict matrix）;
- 冻结固定 SHA 离线执行形态与 production apply 边界
  （§9 CTR-NG-007 / CTR-NG-008）；
- 冻结 implementation review 不可变绑定与 merge eligibility 链
  （§9 CTR-NG-009）；
- 冻结 ACC-NG-001–ACC-NG-012（§10）。

### Non-goals

- 不重开 CCR 已冻结的 scope 集合 / 禁止集合 / activation gates；
- 不修改 RECONCILIATION_V1 的任何字节；本 Spec 完成后 reconciliation 按
  其原文继续执行；
- 不清理该 client 的 legacy 列（`allowed_scopes` 含 `forum.moderate`）：
  legacy 列不被 reconciliation 前置扫描（CTR-RR-002/RR-003 均不读 legacy
  列），其清理是独立的未来 owner 决策；
- 不吊销、不删除、不重建该 Grant 行或 client；只做单行 scopes 收窄 +
  version 递增；
- 不触碰两个 agentcore canary（agt_stock_agent / agt_cto-agent）的任何
  Grant；
- 不新增 Prisma migration / schema 变更 / package.json 变更 / Contract
  Bundle 变更。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
PARENT_AUTHORITY = AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1 (accepted)
  forbidden scopes: CTR-FR-004
SISTER_SPEC = AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1 (accepted)
  本 Spec 完成即解除其 CTR-RR-003 前置 4 的唯一阻断项
OWNER_EXECUTION_AUTHORIZATION = 2026-08-22 owner dispatch（"授权最小降权：
  仅将 mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd 的 svc-forum Grant 从
  forum.read,forum.write,forum.moderate 收窄为 forum.read,forum.write；
  保留 client、principal 和其他 Grant；禁止手工 SQL，必须使用固定 SHA、
  同事务审计的离线变更"；存档 mayf3/dsh-agent-core
  docs/evidence/svc-forum-audience-registry-reconciliation-20260822/）
PROCESS_AUTHORITY = 仓库治理（.agents/README.md、docs/specs/README.md）
AMENDMENT_AUTHORITY = 2026-08-22 降权审计（REVISE）两个 REQUIRED_FIXES：
  Fix 1 = principal active / disabled_at 前置（§8 DEC-NG-004、
    §9 CTR-NG-003 / CTR-NG-006）
  Fix 2 = implementation review 不可变绑定（§8 DEC-NG-005、
    §9 CTR-NG-009）
```

- 本 Spec 与 Parent 的关系是 bounded child：全部 Contract 在 Parent 冻结
  语义之内运作，冲突时以 Parent 为准。
- 本 Spec 在 accepted 并合入 `main` 之前不授权任何实现
  （`implementation_authority = none`；accepted 后按 CTR-NG-001 三文件闭包
  转为 `contracts`）。

## 4. Current State

- `STATE-NG-001` — 生产存在恰好一条含 `forum.moderate` 的 Machine Grant。
  Basis: `OBS-NG-001`、`OBS-NG-002`、`OBS-NG-003`（2026-08-22 官方只读
  工具链完整识别，全部零写入）。
  ```text
  OFFENDING_GRANT:
    machine_client_id = b4f209b3-968c-4bf2-8aac-4b9528752e75
    audience_id       = svc-forum
    scopes            = [forum.read, forum.write, forum.moderate]（集合序）
  OFFENDING_CLIENT:
    public client_id  = mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd
    internal id       = b4f209b3-968c-4bf2-8aac-4b9528752e75
    machine_principal_id = 132ab857-35ab-408b-b909-bc0b1deab55b
    status = active / revoked_at = null / rotated_at = null
    created_at = 2026-07-20T13:52:14.936Z
    legacy allowed_resources = [svc-forum]
    legacy allowed_scopes    = [forum.read, forum.write, forum.moderate]
  ```

- `STATE-NG-002` — reconciliation 因此被 fail-loud 阻断，且其拒绝信息与
  本 Spec 目标一致。Basis: `OBS-NG-001`。

- `STATE-NG-003` — 姊妹任务的其余前置全部 PASS（干净 checkout、HEAD 含
  f5c2305、health/contract/JWKS、两 canary Grant 精确、Stage F plan
  noop）。Basis: 2026-08-22 执行 dispatch 的 evidence 目录。

- `STATE-NG-004` — 已保存实现（hold 分支
  `agent/svc-forum-legacy-grant-narrowing-v1-implementation-hold`）尚未
  实现 Fix 1 的 principal 前置。Basis: 降权审计 REQUIRED_FIXES + 对
  preserved head 的静态复核
  （`scripts/narrow-svc-forum-legacy-grant-v1.ts` 的 principal select 仅含
  id / principal_type，全文无 status / disabled_at 校验）。
  ```text
  PRESERVED_IMPLEMENTATION_EVIDENCE_HEAD =
    d7924b11f9a14917cd68d38196ba2b96f2a5df55
  PRESERVED_IMPLEMENTATION_CURRENTLY_CONFORMANT = NO
  KNOWN_IMPLEMENTATION_FIX = ADD_PRINCIPAL_ACTIVE_AND_DISABLED_AT_GUARD
  ```

## 5. Observations

### OBS-NG-001 — reconciliation plan 只读拒绝（第一失败层）

- Subject: 生产 auth-service 数据库。
- Source: `scripts/reconcile-svc-forum-audience-registry-v1.ts` @
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`（与 PR #16 reviewed head
  `c67148c` 字节一致）只读 plan。
- Environment: authsvc 受控进程；DATABASE_URL 由 authsvc 私有 .env 进程内
  读取。
- Observed at: 2026-08-22T05:02:11Z。
- Method: owner dispatch 执行（任务书"落库执行"）。
- Result: `Reconciliation refused: machine grant for audience svc-forum
  contains forbidden scope forum.moderate`；plan 只读、零写入；同一 run 内
  先行通过的校验证明 svc-forum Audience 行全部非 scope 字段精确匹配冻结
  前置。
- Provenance: mayf3/dsh-agent-core
  docs/evidence/svc-forum-audience-registry-reconciliation-20260822/
  phase2-safety-scan-refusal.txt。

### OBS-NG-002 — readiness 全量清点：全库唯一

- Subject: 生产 machine_access_grants 全量（381 条）。
- Source: `scripts/check-minimal-auth-v1-readiness.ts` @ f5c2305。
- Environment: authsvc 受控进程，只读。
- Observed at: 2026-08-22T05:08Z 前后。
- Method: 官方 readiness 清点。
- Result: invalid-scopes grant 恰好 1 条（
  `machine grant b4f209b3-968c-4bf2-8aac-4b9528752e75:svc-forum`）；legacy
  含 forum.moderate 的 client 恰好 1 条且同源；同时确认
  `audience svc-forum differs from frozen registry at registered_scopes`。
- Provenance: 同目录 readiness-checker-output.txt。

### OBS-NG-003 — machine-admin client inspect 闭环

- Subject: 违规 client。
- Source: `src/cli/machine-admin.ts`（官方 CLI）client inspect。
- Environment: authsvc 受控进程，只读。
- Observed at: 2026-08-22T05:10Z 前后。
- Method: `client inspect --client-id mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd`。
- Result: 返回的 `id` 与违规 grant 的 machine_client_id 精确相等（
  b4f209b3-968c-4bf2-8aac-4b9528752e75）；status active；legacy 列
  [svc-forum] × [forum.read, forum.write, forum.moderate]。
- Provenance: 同目录 offender-identification.md。

### OBS-NG-004 — 既有 DB 审计载体与版本惯例

- Subject: grant 变更的 durable audit 载体。
- Source: prisma schema +
  `prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql`
  + `scripts/supply-agentcore-canary-forum-grants-v1.ts`（Stage F，已
  merge）。
- Environment: 只读源码审计 @ f5c2305。
- Method: 静态阅读。
- Result: `grant_change_audits` 表是 grant 变更的专用 durable audit（
  `(migration_id, client_id, change_type)` 唯一、immutable trigger、
  value-shape CHECK）；Stage F 惯例：grant 写入携带递增 version，审计
  `change_type='replace'`、`expected_grant_version=1`、
  `resulting_grant_version=2`、before/after 为完整 client snapshot（键集
  client_id / client_kind / principal_id / principal_type /
  human_audience_grants / machine_access_grants / delegation_grants /
  status / version）。`machine_access_grants` 行本身无 immutability
  trigger（UPDATE 允许；scopes 非空 CHECK + FK RESTRICT）。
- Provenance: 本 Spec authoring 审计。

## 6. Claims and assumptions

### CLM-NG-001 — 该 Grant 行 version = 1

- Support state: INFERRED
- Supported by evidence: grant 由 minimal-auth-v1 backfill 迁移生成
  （`OBS-NG-004` 惯例：backfill 写入 version=1）；无任何已知后续写入。
- Contradicted by evidence: none known。
- Uncertainty: 生产实际值以工具事务内前置校验为准；若 version ≠ 1，
  工具 fail-loud（writes=0），owner 以新观察重新冻结后重发。plan 模式的
  拒绝信息包含实际 version 以便重冻结。

### CLM-NG-002 — 该 client 无其他伴随状态需要本工具处理

- Support state: INFERRED
- Supported by evidence: readiness 清点中该 client 仅出现 forum.moderate
  一项 issue（`OBS-NG-002`）。
- Contradicted by evidence: none known。
- Uncertainty: client 可能持有其他 audience 的合法 Grant（readiness 不
  标记合法 Grant）；本工具把全部其他 Grant 作为不可变 tripwire 快照处理，
  任何伴随漂移都会 fail-loud 而不是被静默接受。

## 7. Evidence relations

### EVD-NG-001 — 只读识别链支撑目标陈述

- Source observations: `OBS-NG-001`、`OBS-NG-002`、`OBS-NG-003`。
- Target: `STATE-NG-001`、`STATE-NG-002`、CLM 目标行坐标。
- Relation: SUPPORTS。
- Bound coordinates: 2026-08-22；生产只读。
- Strength/sufficiency: 充分（三条独立官方只读工具交叉闭环）。
- Limitations: 生产在 apply 时点的实际状态以事务内复核为准。
- Provenance: 本 Spec。

## 8. Decisions

### DEC-NG-001 — bounded child Spec（单行收窄）

- Decision owner: mayf3。
- Decision: 以独立 child Spec 承接单行 Grant 收窄；不改 CCR、不改
  RECONCILIATION_V1、不做 client 吊销（ALT-NG-002）、不做 legacy 列清理
  （ALT-NG-003）。
- Reason: owner dispatch 冻结"最小降权"授权面；更大处置面无授权。
- Owner decision remaining: NONE。

### DEC-NG-002 — 审计走 grant_change_audits 既有载体

- Decision owner: mayf3。
- Decision: 复用 `grant_change_audits` 'replace' 惯例（expected 1 →
  resulting 2 + 完整 snapshot），不新造事件类型。
- Reason: 与 Stage W/F 及 DB 级 CHECK/unique/immutability 惯例一致
  （`OBS-NG-004`）；`(migration_id, client_id, change_type)` 唯一索引天然
  提供幂等锚点。
- Owner decision remaining: NONE。

### DEC-NG-003 — 版本递增 1 → 2

- Decision owner: mayf3。
- Decision: Grant 行 `version` 随收窄 1 → 2，与 'replace' 审计的
  expected/resulting 对齐。
- Reason: Stage F 惯例（grant 写入代数 = 行 version）；保持行内 version
  不变会与既有审计语义冲突。
- Owner decision remaining: NONE。

### DEC-NG-004 — principal disabled / inactive 为 terminal conflict

- Decision owner: mayf3。
- Decision: 目标 MachinePrincipal 不满足 `status = 'active'` 且
  `disabled_at IS NULL` 时，收窄 MUST fail-loud 终止且零写入；不自动修复、
  不更换身份（PRINCIPAL_DISABLED / PRINCIPAL_INACTIVE =
  TERMINAL_CONFLICT；AUTO_REPAIR = NO；REPLACEMENT_IDENTITY = NO，冻结于
  CTR-NG-006）。
- Reason: principal 生命周期状态属 owner 管辖面，超出本 Spec"最小降权"
  授权面；降权审计 REQUIRED_FIXES（Fix 1）。
- Owner decision remaining: NONE（terminal conflict 后的后续处置属未来
  独立 owner 决策，以新观察重新冻结）。

### DEC-NG-005 — implementation review 不可变绑定链

- Decision owner: mayf3。
- Decision: 未来实现 PR 的 merge eligibility 只能来自独立 implementation
  review 对 immutable `IMPLEMENTATION_REVIEW_HEAD` /
  `IMPLEMENTATION_MERGE_BASE` / `IMPLEMENTATION_DIFF_DIGEST` 的冻结验证
  （CTR-NG-009）；branch name 不构成 authority；本 Spec acceptance 本身
  不产生 implementation merge authority。
- Reason: 降权审计 REQUIRED_FIXES（Fix 2）；镜像姊妹 Spec
  `AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` 已 accepted
  的 CTR-RR-007 implementation-binding 模型；Fix 1（KNOWN_IMPLEMENTATION_
  FIX）必然产生新的实现 commit，preserved head 只能作为 evidence 起点。
- Owner decision remaining: NONE。

## 9. Contracts

### CTR-NG-001 — 精确实现文件闭包

本 Spec 授权的实现改动**精确只有**以下三个文件：

```text
1. scripts/narrow-svc-forum-legacy-grant-v1.ts
2. scripts/run-svc-forum-legacy-grant-narrowing-v1-conformance.sh
3. tests/oauth/narrow-svc-forum-legacy-grant-v1.test.ts
```

实现 MUST NOT 触碰任何第四个文件（含 `package.json`、Prisma、Contract
Bundle、docs）。Contract 中 MUST NOT 出现开放措辞。任何第四文件 MUST 先取得
`OWNER_DECISION_REQUIRED`。

### CTR-NG-002 — 唯一允许的生产状态变化

唯一允许的生产状态变化是：

```text
machine_access_grants 行
  (machine_client_id = b4f209b3-968c-4bf2-8aac-4b9528752e75,
   audience_id = 'svc-forum')
  registered scopes: {forum.moderate, forum.read, forum.write}
                  → {forum.read, forum.write}
  version: 1 → 2
+ 同事务一条 grant_change_audits 行（CTR-NG-005）
```

实现 MUST NOT 修改：该行 `machine_client_id` / `audience_id` /
`created_at` / `updated_at`；MUST NOT DELETE 或 INSERT
`machine_access_grants`；MUST NOT 修改任何其他 Grant 行（其余 380 条字节
不变）；MUST NOT 修改 machine_clients 行（含 legacy 列
`allowed_resources` / `allowed_scopes` / `secret_hash` / status /
rotatedAt / revokedAt）；MUST NOT 修改 machine_principals / identities /
Audience 行 / Human Grant / Delegation Grant；MUST NOT 修改或删除
`grant_change_audits` 既有行（表级 immutable trigger 已保证）。

### CTR-NG-003 — 事务内前置校验

事务内 MUST 先确认（任一不满足 fail-loud，writes = 0）：

1. public `client_id = mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd` 解析恰好一行，且
   其 internal `id` 精确等于 `b4f209b3-968c-4bf2-8aac-4b9528752e75`；
2. `machine_principal_id` 精确等于 `132ab857-35ab-408b-b909-bc0b1deab55b`
   （principal 行存在且 id 绑定一致）；
3. 目标 MachinePrincipal 行 `status = 'active'` 且
   `disabled_at IS NULL`（`principal.status ≠ 'active'` 即
   PRINCIPAL_INACTIVE；`disabled_at IS NOT NULL` 即 PRINCIPAL_DISABLED；
   两者均为 TERMINAL_CONFLICT，处置冻结于 CTR-NG-006）；
4. client `status = 'active'` 且 `revoked_at IS NULL`；
5. client 不是带 Delegation Grant 的 trusted proxy（若有，fail-loud）；
6. 该 client 恰好一条 `audience_id = 'svc-forum'` 的 Grant 行；
7. 该行 scopes 集合精确等于三项 drift 集合或两项 target 集合；
8. drift 态该行 `version = 1`，且该 client 无任何
   `change_type = 'replace'` 的既有 grant_change_audits 行；
9. target 态该行 `version = 2`，且该 client 恰好一条 'replace' 审计、
   envelope 全字段精确匹配（含五项 metadata、before/after snapshot、
   expected 1 / resulting 2）——仅此时 NOOP；
10. 全部其他 Grant 行（任何 audience）作为不可变 tripwire 参与前后比对。

### CTR-NG-004 — 事务与锁模型

```text
TRANSACTION_ISOLATION = Serializable
顺序 MUST 为：
LOCK machine_access_grants IN SHARE ROW EXCLUSIVE MODE
LOCK grant_change_audits IN SHARE ROW EXCLUSIVE MODE
LOCK machine_clients IN SHARE MODE
LOCK machine_principals IN SHARE MODE
→ advisory lock 813_947_204（与 Stage W 201 / Stage F 202 / RR 203 互不冲突）
→ establish snapshot
→ validate（CTR-NG-003）
→ UPDATE scopes + version（单行、WHERE version = 1）
→ INSERT grant_change_audits（CTR-NG-005）
→ re-select exact target + 全部其他 Grant 行字节复核
→ commit
```

锁先于快照（姊妹 Spec OBS-RR-005 的 SI 逃逸证据同样适用）。audit 写入
失败 MUST 使整事务回滚（Grant 行保持字节不变）。

### CTR-NG-005 — Audit 模型

成功时 MUST 在同一事务写一条 `grant_change_audits`：

```text
change_type            = 'replace'
client_id              = mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd
expected_grant_version = 1
resulting_grant_version= 2
before_value / after_value = 完整 client snapshot（键集与 Stage F 惯例
  逐字段一致：client_id, client_kind='machine', principal_id,
  principal_type, human_audience_grants=[], machine_access_grants=
  {audience: sorted scopes}, delegation_grants={}, status, version=
  1 / 2），after_value 中 svc-forum 恰为两项 target、其余 audience 与
  before_value 逐字节相等
migration_id / source_git_commit / operator_id / approval_ref / reason
  = 执行时五项 audit metadata（source_git_commit 等于干净 checkout HEAD）
```

审计 MUST NOT 记录数据库密码、client secret、secret_hash 或 Authorization。
`(migration_id, client_id, change_type)` 唯一索引冲突 MUST 表现为 fail-loud
而非部分提交。

### CTR-NG-006 — 重跑与冲突语义

第一次从精确 drift 状态执行：

```text
GRANT_ROWS_UPDATED = 1
AUDITS_CREATED = 1
```

目标态 + exact matching 审计（同五项 metadata 重跑）：

```text
RESULT = NOOP
GRANT_ROWS_UPDATED = 0
AUDITS_CREATED = 0
```

以下 15 项 conflict matrix 全部 fail-closed（每项 RESULT = conflict、
GRANT_WRITES = 0、AUDIT_WRITES = 0）：

```text
CM-01 目标态但 'replace' 审计缺失
CM-02 审计 metadata 不匹配（五项任一）
CM-03 before/after snapshot 漂移
CM-04 duplicate 'replace' 审计
CM-05 drift 态已有 'replace' 审计
CM-06 scopes 非精确三项 drift 集合 / 两项 target 集合
CM-07 drift 态 version ≠ 1
CM-08 client 解析异常（public client_id 缺失 / 不唯一）
CM-09 internal id 漂移
CM-10 principal id 漂移（machine_principal_id 或 principal 行 id 不等）
CM-11 PRINCIPAL_DISABLED（principal.disabled_at IS NOT NULL）
CM-12 PRINCIPAL_INACTIVE（principal.status ≠ 'active'）
CM-13 client 非 active（client.status ≠ 'active'）
CM-14 client 已吊销（client.revoked_at IS NOT NULL）
CM-15 伴随 Grant 行前后不一致
```

principal 状态冲突（CM-11 / CM-12）的冻结处置：

```text
PRINCIPAL_DISABLED    = TERMINAL_CONFLICT
PRINCIPAL_INACTIVE    = TERMINAL_CONFLICT
AUTO_REPAIR           = NO（不自动重新启用 / 修复 principal）
REPLACEMENT_IDENTITY  = NO（不迁移到替代 principal、不新建身份）
处置 = fail-loud 终止 + GRANT_WRITES = 0 + AUDIT_WRITES = 0；
  后续处置由 owner 以新观察重新冻结（独立决策，不在本 Spec 内）
```

实现 MUST NOT 自动补审计、MUST NOT last-write-wins。

### CTR-NG-007 — 固定 SHA 离线执行形态

实现 MUST 镜像姊妹 Spec 的三形态：默认只读 plan（无参数）、`--apply`（恰
五项 metadata flag + 干净 worktree + `source_git_commit == HEAD` 复核 +
进程内 DATABASE_URL）、conformance FIFO descriptor 形态。运行期 MUST NOT
有任何网络访问。执行 MUST 从执行时点最新 main 的干净 checkout 进行，
工具内容与 reviewed head 字节一致（SHA256 记录入执行 evidence）。

### CTR-NG-008 — production apply 边界

本 Spec acceptance 不自动授权 production apply。production apply 由 owner
2026-08-22"最小降权"dispatch 授权（§3 已引用存档），执行时以
`approval_ref` 指向该 dispatch 存档坐标。任何超出 CTR-NG-002 的生产变化
（包括 rollback）都是独立 owner 决策。

### CTR-NG-009 — implementation review 不可变绑定与 merge eligibility 链

```text
IMPLEMENTATION_REVIEW_BINDING_REQUIRED = YES

PRESERVED_IMPLEMENTATION_EVIDENCE_HEAD =
  d7924b11f9a14917cd68d38196ba2b96f2a5df55
PRESERVED_IMPLEMENTATION_EVIDENCE_ROLE =
  authoring/evidence 起点（authoring 轮 22/22 conformance 的已保存
  实现），不是未来 merge-authorized implementation Head——Fix 1 的
  KNOWN_IMPLEMENTATION_FIX 必然产生新的实现 commit
FUTURE_IMPLEMENTATION_HEAD_PINNED_NOW = NO
BRANCH_NAME_IS_AUTHORITY = NO
```

在未来任何 implementation PR 取得 merge authority 之前，独立
implementation review MUST 冻结并验证三项不可变坐标：

```text
IMPLEMENTATION_REVIEW_HEAD  = review 时点实现 PR head 的完整 commit SHA
IMPLEMENTATION_MERGE_BASE   = three-dot diff merge-base 的完整 commit SHA
IMPLEMENTATION_DIFF_DIGEST  = three-dot diff 的确定性 digest（SHA256）
```

规则（镜像姊妹 Spec
`AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` 已 accepted
的 CTR-RR-007 implementation-binding 模型）：

1. 三者 MUST 为 immutable SHA / digest；可移动 branch 名 MUST NOT 充当
   authority；
2. `IMPLEMENTATION_REVIEW_HEAD` 漂移 → review 失效，MUST 重新评审；
3. `IMPLEMENTATION_MERGE_BASE` 漂移且涉及 authority / 实现语义 → MUST
   re-review；
4. `IMPLEMENTATION_DIFF_DIGEST` 不匹配 → MUST re-review；
5. 本 Spec acceptance 本身不产生 implementation merge authority；
6. merge eligibility 仅在 implementation review PASS（且本 Spec 已
   accepted 并合入 main）后产生；
7. production apply 仍是独立 Owner 决定（CTR-NG-008），不由 implementation
   review PASS 或 merge 自动授权。

本 Spec 处于 proposed，MUST NOT 预先伪造未来实现 Head：未来
`IMPLEMENTATION_REVIEW_HEAD` 由 Fix 1 修复后的实现 commit 在其独立
review 时点冻结。当前 preserved 实现
（`PRESERVED_IMPLEMENTATION_EVIDENCE_HEAD`）在
KNOWN_IMPLEMENTATION_FIX 落地前不得直接视为 merge-authorized Head。

## 10. Acceptance

### ACC-NG-001 — 精确三文件闭包

- Contracts: CTR-NG-001。Method: 实现 diff 文件清单审计。
- Expected: 恰好三个文件，路径逐一相等。Failure: 任何额外文件。

### ACC-NG-002 — 单行收窄且仅 scopes+version 变化

- Contracts: CTR-NG-002。Method: 一次性 PostgreSQL conformance +
  conformance-only UPDATE tripwire（该表仅允许目标行 scopes/version 变化，
  禁止 DELETE / 其他列变化）。
- Expected: 目标行 scopes→两项、version→2，created_at/updated_at 及其他
  列字节不变；tripwire 不被触发。Failure: 任何其他列 / 行变化。

### ACC-NG-003 — 其他对象字节稳定

- Contracts: CTR-NG-002。Method: apply 前后全库 Grant 行、client 行、
  principal 行逐行 deep-equal（目标行除外）。
- Expected: 仅目标行两列变化。Failure: 任何其他行变化。

### ACC-NG-004 — 前置校验矩阵

- Contracts: CTR-NG-003。Method: 至少覆盖 client 缺失、internal id 漂移、
  principal 漂移、principal disabled（`disabled_at` 非 NULL）、principal
  inactive（`status ≠ active`）、client status 非 active、已吊销、双
  svc-forum Grant、scopes 非精确三项、drift 态 version≠1、drift 态已有
  replace 审计。
- Expected: 每项 fail-loud、RESULT = conflict、GRANT_WRITES = 0、
  AUDIT_WRITES = 0；principal 两项按 TERMINAL_CONFLICT 处置（无
  auto-repair、无 replacement identity）。Failure: 任一被接受或产生写入。

### ACC-NG-005 — lock-before-snapshot + Serializable

- Contracts: CTR-NG-004。Method: 静态断言（LOCK 语句先于 advisory 与首个
  SELECT；isolationLevel = Serializable）。
- Expected: 顺序与隔离级别逐项成立。Failure: 顺序倒置或隔离级别漂移。

### ACC-NG-006 — 同事务审计与回滚

- Contracts: CTR-NG-004 / CTR-NG-005。Method: 注入 grant_change_audits
  INSERT 失败 trigger 后执行 apply。
- Expected: apply 失败；目标行保持精确 drift 态（字节不变）；审计 0 条。
  Failure: 任何部分提交。

### ACC-NG-007 — 审计 envelope 精确

- Contracts: CTR-NG-005。Method: apply 后逐字段核对 DB 审计行与冻结
  envelope（含 before/after snapshot 键集与逐字节值、expected/resulting、
  五项 metadata）。
- Expected: 全字段精确相等。Failure: 任何字段漂移。

### ACC-NG-008 — exact rerun NOOP

- Contracts: CTR-NG-006。Method: 成功后同五项 metadata 重跑。
- Expected: outcome=noop、rows=0、audits=0、全库字节稳定。Failure: 任何
  写入。

### ACC-NG-009 — 冲突矩阵 fail-closed

- Contracts: CTR-NG-006。Method: 目标态缺审计 / metadata 漂移（含不同
  reason）/ duplicate 审计 / 目标态 version≠2。
- Expected: 全部 fail-loud、writes=0。Failure: 任一被静默接受。

### ACC-NG-010 — runner 最小权限与 legacy 列不可读

- Contracts: CTR-NG-002 / CTR-NG-007。Method: conformance runner 角色仅授
  必要表/列；`has_column_privilege(...machine_clients.allowed_resources/
  allowed_scopes/secret_hash...) = false`。
- Expected: 工具在最小权限下完整通过；legacy/secret 列不可读。Failure:
  权限需求超出或 legacy 列可读。

### ACC-NG-011 — implementation review 不可变绑定

- Contracts: CTR-NG-009。Method: 独立 implementation review 记录冻结
  `IMPLEMENTATION_REVIEW_HEAD` / `IMPLEMENTATION_MERGE_BASE` /
  `IMPLEMENTATION_DIFF_DIGEST` 三项坐标并复算 head / merge-base /
  three-dot diff digest。
- Expected: 三者为 immutable SHA / digest 且复算相等；branch 名未充当
  authority；head / digest 失配触发 re-review。Failure: 坐标缺失、以可
  移动引用充当坐标、或失配未触发 re-review。

### ACC-NG-012 — preserved head 非 merge-authorized；acceptance 不自动授权 apply

- Contracts: CTR-NG-008 / CTR-NG-009。Method: 文本审计 + review 链核对。
- Expected: `PRESERVED_IMPLEMENTATION_EVIDENCE_HEAD` 仅作 evidence 起点
  （KNOWN_IMPLEMENTATION_FIX 落地前不得直接 merge）；实现修复后必须重新
  独立 review；merge eligibility 仅来自 implementation review PASS；
  acceptance 记录无任何 production apply 授权语句。Failure:
  d7924b11f9a14917cd68d38196ba2b96f2a5df55 被视为最终 merge-authorized
  Head、修复后未重新独立 review、或 acceptance 被解释为 apply 授权。

### Contract coverage

| Contract | Acceptance | Evidence class | Covered |
|---|---|---|---|
| CTR-NG-001 | ACC-NG-001 | 只读审计 | YES |
| CTR-NG-002 | ACC-NG-002、ACC-NG-003、ACC-NG-010 | executed test | YES |
| CTR-NG-003 | ACC-NG-004 | executed test | YES |
| CTR-NG-004 | ACC-NG-005、ACC-NG-006 | executed test / 静态断言 | YES |
| CTR-NG-005 | ACC-NG-006、ACC-NG-007 | executed test | YES |
| CTR-NG-006 | ACC-NG-008、ACC-NG-009 | executed test | YES |
| CTR-NG-007 | ACC-NG-010 | executed test | YES |
| CTR-NG-008 | ACC-NG-012、文本审计 | 只读审计 | YES |
| CTR-NG-009 | ACC-NG-011、ACC-NG-012 | review 记录 / 只读审计 | YES |

> 执行类证据由实现 PR 提供一次性 PostgreSQL conformance；本 Spec 处于
> proposed 阶段，最终 review/acceptance tuple 以独立 review 记录为准。

## 11. Alternatives and disposition

### ALT-NG-001 — 扩大 RECONCILIATION_V1 闭包把 Grant 收窄并入

- Disposition: rejected。
- Reason: 姊妹 Spec 三文件闭包已 frozen 且 merge；任何第四文件/行为扩容
  都违反其 CTR-RR-001 与本仓库 merge gate。

### ALT-NG-002 — 吊销整个遗留 client

- Disposition: rejected（本轮）。
- Reason: owner dispatch 授权面为"最小降权"；吊销影响面（该 client 仍在
  active 使用中的可能）未评估。可作为未来独立 owner 决策。

### ALT-NG-003 — 顺带清理 legacy allowed_scopes 的 forum.moderate

- Disposition: rejected（本轮）。
- Reason: 无授权；legacy 列不被 reconciliation 前置读取（本收窄后
  reconciliation 即可执行）；legacy 清理是独立决策。

## 12. Migration, compatibility, and rollback

```text
MIGRATION = NONE（无 schema/bundle/产品迁移）
COMPATIBILITY = Stage W/F + RR 的三文件离线执行形态；advisory 813_947_204
  独占，与 201/202/203 互不冲突；grant_change_audits 既有 unique/CHECK/
  immutable trigger 全部沿用
ROLLBACK = 恢复 forum.moderate 与 Parent CTR-FR-004 冲突，默认禁止；
  如需逆向恢复必须另走 owner 决策与独立 reviewed 工具
EMERGENCY_CONTAINMENT = N/A（fail-closed、幂等可重跑；reconciliation
  被阻断的状态本身就是安全侧 fail-closed）
```

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
SPEC_AMENDMENT_2026_08_22 = 降权审计（REVISE）REQUIRED_FIXES 修复轮
  FIX_1_PRINCIPAL_ACTIVE_PREREQUISITE = APPLIED（DEC-NG-004、
    CTR-NG-003 第 3 项、CTR-NG-006 15 项 conflict matrix CM-11/CM-12
    与 TERMINAL_CONFLICT 处置、ACC-NG-004）
  FIX_2_IMPLEMENTATION_REVIEW_BINDING = APPLIED（DEC-NG-005、CTR-NG-009、
    ACC-NG-011、ACC-NG-012）
  AMENDMENT_SEMANTIC_BASE = 0bbe12e2581e916101011ab3bda8580c1cbae6f4
  PRESERVED_IMPLEMENTATION_CURRENTLY_CONFORMANT = NO
    （KNOWN_IMPLEMENTATION_FIX = ADD_PRINCIPAL_ACTIVE_AND_DISABLED_AT_GUARD
    由未来实现轮落地并重新独立 review；本轮不改 hold 分支）
```

## 14. Acceptance Record

```text
（proposed 阶段占位；acceptance 时由独立 review 记录填写：
REVIEWED_BASE / REVIEWED_SPEC_HEAD / REVIEW_VERDICT / REQUIRED_FIXES /
ACCEPTED_BY / ACCEPTED_AT / FINAL_ACCEPTED_HEAD）
```
