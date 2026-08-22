---
spec_id: AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
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

# AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1

## 1. Goal

Parent Spec `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`（accepted）已经逐字段冻结
svc-forum 在 Minimal Auth V1 Audience Registry 中的目标 entry（CTR-FR-002：唯一
scope 集合 `forum.read` / `forum.write`）与禁止 scope 封闭集合（CTR-FR-004：
`forum.moderate`、`forum.admin`、`forum.*`、wildcard 一律禁止注册）。当前生产
数据库 `auth_audiences` 中 svc-forum 行存在唯一的 registry drift：
`registered_scopes = [forum.read, forum.write, forum.moderate]`。该 drift 使
v1 direct mint 在

```text
audience_registry_mismatch:registered_scopes
```

处 fail-closed。

本 Spec 是 **authority-only child implementation Spec**：不引入任何新的产品
方向，不 supersede、不 amend Parent，只承接"把生产 svc-forum Audience 行的
`registered_scopes` 离线 reconciliation 回 Parent 已冻结目标状态"这一实现
权限，并把既有实现 PR #16 纳入 merge-gate 管辖。

冻结的 authority transition：

```text
CURRENT_AUTHORITY_STATE =
  PR_16_IMPLEMENTATION_WITHOUT_ACCEPTED_GOVERNING_SPEC
  (注册 审计 review result = REQUEST_CHANGES_AUTHORITY_ONLY)

TARGET =
  THIS_SPEC_ACCEPTED_AND_MERGED_TO_MAIN
  → PR_16_ACQUIRES_MERGE_AUTHORITY

PR_16_PRODUCT_FIX_REQUIRED = NO
PR_16_MERGE_AUTHORIZED_NOW = NO
```

本轮为 **SPEC AUTHORING ONLY**：新建本文件一个 Spec，`status: proposed`。
不修改 PR #16；不修改产品代码、脚本、测试、数据库或生产环境；不部署；
不 merge；不执行 production apply。

## 2. Scope and non-goals

### In scope

- 冻结精确问题陈述（生产 drift 与 frozen target，§4）；
- 冻结精确实现文件闭包（恰好三个文件，§9 CTR-RR-001）；
- 冻结唯一允许的生产状态变化与其禁止清单（§9 CTR-RR-002）；
- 冻结事务内前置扫描（§9 CTR-RR-003）；
- 冻结事务、锁与 audit 模型（§9 CTR-RR-004 / CTR-RR-005）；
- 冻结重跑与冲突语义（§9 CTR-RR-006）；
- 冻结 PR #16 的不可变绑定坐标与 merge authority 链（§9 CTR-RR-007）；
- 冻结 production apply 边界（§9 CTR-RR-008）；
- 冻结 ACC-RR-001–ACC-RR-012（§10）。

### Non-goals

- 不重开 Parent 已冻结的任何产品决定（scope 集合、禁止 scope、
  consumer review、activation gates 等）；
- 不 supersede、不 amend Parent；本 Spec 是 bounded child refinement；
- 不修改 PR #16 的任何字节（审计结论 `PRODUCT_CODE_FIX_REQUIRED = NO`）；
- 不授权 production apply：Spec acceptance 不自动授权对生产数据库的执行
  （§9 CTR-RR-008）；
- 不新增 Prisma migration / schema 变更 / package.json 变更 / Contract
  Bundle 变更；
- 不处理 svc-auth、llm-todo、workflow-todo 或任何其他 Audience；
- 不引入 online introspection、Human access、Delegated access 语义。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
PARENT_AUTHORITY = AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1 (accepted)
  governing target entry: CTR-FR-002
  forbidden scopes:      CTR-FR-004
  Parent git blob SHA-1 @ 36a11136745bae7a371d21ba62d9617942c41afa:
    78530b1fbfb13d477e65e002185128cf69843942
  (docs/specs/AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1.md)
EXECUTABLE_TARGET_AUTHORITY =
  contract-bundles/minimal-auth-v1/audience-registry.json
  registry_version 1.3.0（svc-forum entry 与 CTR-FR-002 逐字段一致）
IMPLEMENTATION_PR = mayf3/auth-service #16
PROCESS_AUTHORITY = 仓库治理（.agents/local/README.md、docs/specs/README.md
  的 implementation rule 与 merge gate）
```

- 本 Spec 与 Parent 的关系是 bounded child：本 Spec 的全部 Contract 均在
  Parent 冻结语义之内运作，任何一条与 Parent 冲突时以 Parent 为准。
- 本 Spec 不依赖任何 external authority（`external_authorities = []`）。
- 本 Spec 在 accepted 并合入 `main` 之前不授权任何实现
  （`implementation_authority = none`；accepted 后按 §9 CTR-RR-001 的
  三文件闭包转为 `contracts` 实现权限）。

## 4. Current State

- `STATE-RR-001` — 生产 svc-forum Audience 行存在唯一 registry drift。
  Basis: `OBS-RR-001`（注册 执行 / 注册 审计 dispatch 冻结的生产事实）。
  ```text
  audience_id = svc-forum
  CURRENT_REGISTERED_SCOPES = forum.read, forum.write, forum.moderate
  TARGET_REGISTERED_SCOPES  = forum.read, forum.write
  ```
  drift 仅存在于 `registered_scopes`；该行的其余字段与 frozen target
  一致（作为 reconciliation 的运行时前置条件在事务内重新验证，
  §9 CTR-RR-003）。

- `STATE-RR-002` — 既有实现 PR #16 已按本 Spec §9 冻结的三文件闭包完成。
  Basis: `OBS-RR-002`。
  ```text
  IMPLEMENTATION_PR = mayf3/auth-service #16
  IMPLEMENTATION_REVIEW_HEAD = c67148cf35ecca2eeb4c4ff85a4478697d4ab2ab
  IMPLEMENTATION_MERGE_BASE = 36a11136745bae7a371d21ba62d9617942c41afa
  ```

- `STATE-RR-003` — PR #16 的独立审计结论为 authority-only blocker。
  Basis: `OBS-RR-004`。
  ```text
  注册 审计 = REQUEST_CHANGES_AUTHORITY_ONLY
  PRODUCT_CODE_FIX_REQUIRED = NO
  ```

- `STATE-RR-004` — PR #16 的执行证据完整。
  Basis: `OBS-RR-003`（42/42 临时 PostgreSQL conformance 等全部通过）。
  含义：blocker 仅为治理 authority，不含任何产品/实现缺陷。

## 5. Observations

### OBS-RR-001 — 生产 drift 精确值（任务冻结事实）

- Subject: 生产 `auth_audiences` svc-forum 行。
- Source: 注册 执行 / 注册 审计 dispatch 冻结陈述。
- Environment: 生产 auth-service 数据库（本轮零接触）。
- Observed at: 2026-08-22（dispatch 时点）。
- Method: owner dispatch 冻结；本 Spec 不重新读取生产库。
- Result: `CURRENT_REGISTERED_SCOPES = [forum.read, forum.write,
  forum.moderate]`；Target 由 Parent CTR-FR-002 / bundle 1.3.0 冻结为
  `[forum.read, forum.write]`。
- Provenance: 注册 执行 dispatch（PR #16 任务书）；Parent Spec。

### OBS-RR-002 — PR #16 精确 diff 绑定（只读 git 审计）

- Subject: mayf3/auth-service PR #16 three-dot diff。
- Source revision: merge-base `36a1113…` ↔ head `c67148c…`。
- Environment: 本地 git 只读审计（2026-08-22）。
- Method: `git diff 36a1113...c67148c` 与 `git diff --stat`。
- Result:
  ```text
  PR_16_THREE_DOT_DIFF_SHA256 =
    2d0765de699b91f55bf5359f4a331ba8ade0a75058c96fa0eba54dd32f4aec30
  PR_16_DIFF_STAT = 3 files changed, 1588 insertions(+), 0 deletions(-)
    scripts/reconcile-svc-forum-audience-registry-v1.ts        (+562)
    scripts/run-svc-forum-audience-registry-v1-conformance.sh  (+260)
    tests/oauth/reconcile-svc-forum-audience-registry-v1.test.ts (+766)
  PR_16_HEAD_AT_AUDIT = c67148cf35ecca2eeb4c4ff85a4478697d4ab2ab
  PR_16_IS_DRAFT = true
  ```
- Provenance: 本 Spec authoring 审计。

### OBS-RR-003 — PR #16 执行证据（任务最终报告）

- Subject: PR #16 实现提交的验证证据。
- Source: PR #16 commit `c67148c` 执行报告（注册 执行 最终报告）。
- Environment: 本地一次性容器 + 仓库测试套件。
- Observed at: 2026-08-22。
- Method: 执行并记录。
- Result:
  ```text
  SVC_FORUM_RECONCILE_TEMP_DB_CONFORMANCE = PASS (42/42)
  contract:v1:validate = PASS
  test:contract-v1 = PASS (45/45)
  test:oauth = PASS (104/104)
  tsc -p tsconfig.json --noEmit = clean
  git diff --cached --check = clean
  SECRET_DISCLOSURE_FOUND = NO
  PRODUCTION_DB_WRITE = NO
  ```
- Provenance: PR #16 commit message 与任务最终报告。

### OBS-RR-004 — PR #16 审计结论（authority-only）

- Subject: 注册 审计 review result。
- Source: owner dispatch（本 Spec 的任务书）。
- Observed at: 2026-08-22。
- Method: 独立审计。
- Result: `REQUEST_CHANGES_AUTHORITY_ONLY`；
  `PRODUCT_CODE_FIX_REQUIRED = NO`。
- Provenance: 注册 审计 dispatch。

### OBS-RR-005 — 锁序快照语义（执行期实证）

- Subject: Serializable 事务中 advisory SELECT 与表锁的先后顺序。
- Source: PR #16 实现过程中的 scratch 容器复现（2026-08-22）。
- Method: 独立一次性 PostgreSQL 容器中复现并发 audit writer 场景。
- Result: 若先用 advisory SELECT 再等待表锁，Serializable 快照会在阻塞
  解除前冻结，使后见读取看不到已提交写者；且 SI 元组级谓词锁在小表上
  不覆盖并发 INSERT。表锁先于快照建立后，该窗口关闭（并发写者要么
  先提交并被 plan 看见，要么被阻塞至 reconciliation 提交之后）。
- Provenance: PR #16 执行记录（commit message Notes 段）。

## 6. Claims and assumptions

### CLM-RR-001 — drift 是唯一 registry drift

- Support state: SUPPORTED
- Supported by evidence: `OBS-RR-001`（dispatch 冻结）+ PR #16 前置校验
  （任何其他字段漂移 fail-loud 的实现与测试）。
- Contradicted by evidence: none known
- Uncertainty: 生产库在 apply 时点的实际状态以事务内前置验证为准；
  若出现本 Spec 未覆盖的新漂移，reconciliation fail-loud，不做任何写入。

### CLM-RR-002 — PR #16 实现与本 Spec 闭包一致

- Support state: SUPPORTED
- Supported by evidence: `OBS-RR-002`、`OBS-RR-003`。
- Contradicted by evidence: none known
- Uncertainty: 最终一致性由 §10 acceptance 在 review 阶段逐条核对；
  `PR_16_THREE_DOT_DIFF_SHA256` 是核对的锚点。

## 7. Evidence relations

### EVD-RR-001 — dispatch 冻结事实支撑 drift 状态

- Source observations: `OBS-RR-001`
- Target: `STATE-RR-001`、`CLM-RR-001`
- Relation: SUPPORTS
- Bound coordinates: 2026-08-22 dispatch；生产环境。
- Strength/sufficiency: 充分（owner 冻结 + apply 时事务内复核兜底）。
- Limitations: 不替代 apply 时点的运行时验证。
- Provenance: 本 Spec。

### EVD-RR-002 — diff 绑定支撑实现闭包一致性

- Source observations: `OBS-RR-002`
- Target: `STATE-RR-002`、`CLM-RR-002`
- Relation: SUPPORTS
- Bound coordinates: merge-base `36a1113…` ↔ head `c67148c…`。
- Strength/sufficiency: 充分（diff digest 是确定性的字节绑定）。
- Limitations: PR #16 若被 push 新提交，digest 失配 → 必须重新评审。
- Provenance: 本 Spec。

### EVD-RR-003 — 执行证据支撑 "product fix not required"

- Source observations: `OBS-RR-003`、`OBS-RR-004`
- Target: `STATE-RR-003`、`STATE-RR-004`
- Relation: SUPPORTS
- Bound coordinates: PR #16 @ `c67148c`。
- Strength/sufficiency: 充分（审计结论 + 全套验证证据）。
- Limitations: none known。
- Provenance: 本 Spec。

## 8. Decisions

### DEC-RR-001 — authority-only child Spec（不 amend Parent）

- Decision owner: mayf3
- Decision: 以独立 child implementation Spec 承接实现权限，而不是修改
  Parent CCR 或绕过 merge gate 直接合并 PR #16。
- Rejected alternatives: `ALT-RR-001`、`ALT-RR-002`
- Reason: Parent 是已 accepted 的产品注册 authority，其语义封闭；
  reconciliation 是实现权限问题。merge gate 要求 accepted governing
  Spec 覆盖非机械实现。
- Owner decision remaining: NONE

### DEC-RR-002 — 精确三文件闭包

- Decision owner: mayf3
- Decision: 实现权限精确授予三个文件（§9 CTR-RR-001），禁止开放措辞。
- Rejected alternatives: `ALT-RR-003`
- Reason: 注册 执行 dispatch 冻结的落点；开放措辞会扩大 authority。
- Owner decision remaining: NONE（任何第四文件 → OWNER_DECISION_REQUIRED）

### DEC-RR-003 — lock-before-snapshot 冻结

- Decision owner: mayf3
- Decision: 事务内顺序冻结为"表锁 → advisory → 快照"
  （§9 CTR-RR-004）。
- Rejected alternatives: advisory-first（被 OBS-RR-005 证伪）。
- Reason: 快照必须晚于全部阻塞解除，否则存在已实证的并发逃逸窗口。
- Owner decision remaining: NONE

### DEC-RR-004 — merge authority 链

- Decision owner: mayf3
- Decision: PR #16 只有在本 Child Spec review PASS → accepted → 合入
  main 之后才获得 merge authority。
- Rejected alternatives: `ALT-RR-002`
- Reason: 治理 implementation rule；authority 先于实现合入。
- Owner decision remaining: NONE

## 9. Contracts

### CTR-RR-001 — 精确实现文件闭包

本 Spec 授权的实现改动**精确只有**以下三个文件：

```text
1. scripts/reconcile-svc-forum-audience-registry-v1.ts
2. scripts/run-svc-forum-audience-registry-v1-conformance.sh
3. tests/oauth/reconcile-svc-forum-audience-registry-v1.test.ts
```

实现 MUST NOT 触碰任何第四个文件（含 `package.json`、Prisma、Contract
Bundle、docs）。Contract 中 MUST NOT 出现"相关文件"、"必要测试"、"等"
一类开放措辞。未来任何第四文件 MUST 先取得：

```text
OWNER_DECISION_REQUIRED
```

### CTR-RR-002 — 唯一允许的生产状态变化

唯一允许的生产状态变化是：

```text
auth_audiences
where audience_id = svc-forum
registered_scopes: [forum.read, forum.write, forum.moderate]
                → [forum.read, forum.write]
```

实现 MUST 只修改 `registered_scopes` 单列。MUST NOT 修改：
`version`、`updated_at`、`resource_service`、`scope_namespace`、
`accepted_principal_types`、`human_access_enabled`、
`machine_access_enabled`、`delegated_access_enabled`、`status`、
`freeze_ready`；MUST NOT 修改任何其他 Audience；MUST NOT 修改 Agent
identity、MachineAccessGrant、Human Grant、Delegation Grant、
legacy fields（`machine_clients.allowed_resources` /
`allowed_scopes`）。

### CTR-RR-003 — 事务内前置扫描

事务内 MUST 先确认：

1. svc-forum Audience 行解析唯一（恰好一行）；
2. 除 `registered_scopes` 外全部字段精确等于 frozen target
   （`resource_service = svc-forum`、`scope_namespace = forum`、
   `accepted_principal_types = [agent]`、`human_access_enabled = false`、
   `machine_access_enabled = true`、`delegated_access_enabled = false`、
   `status = active`、`freeze_ready = true`、`version = 1`）；
3. `registered_scopes` 集合精确等于三项 drift 集合或两项 target 集合
   （比较可规范化数组顺序，集合必须精确相等）；
4. 全库无任何 Machine Grant 含 `forum.moderate`、`forum.admin`、
   `forum.*` 或任何 wildcard；
5. 无 svc-forum Human Grant；
6. 无 svc-forum Delegation Grant；
7. 两个 canary（`agentcore:v1:client:agt_stock_agent`、
   `agentcore:v1:client:agt_cto-agent`）的 svc-forum Forum Grant 精确为
   `[forum.read, forum.write]`。

任何异常 MUST：

```text
fail-loud
Audience writes = 0
Audit writes = 0
```

### CTR-RR-004 — 事务与锁模型

```text
TRANSACTION_ISOLATION = Serializable
```

事务内顺序 MUST 为：

```text
LOCK RELATED TABLES
→ advisory lock 813_947_203
→ establish snapshot
→ validate（CTR-RR-003）
→ update registered_scopes
→ write audit（CTR-RR-005）
→ re-select exact target
→ commit
```

实现 MUST NOT 先用 advisory SELECT 冻结快照、再等待表锁
（依据 `OBS-RR-005`）。锁集合 MUST 覆盖本 Contract 全部读取与写入的
表（写入表取写冲突锁，前置扫描覆盖的 Grant 表取读冲突锁）。advisory
key `813_947_203` MUST 与 Stage W（813_947_201）/ Stage F（813_947_202）
互不冲突。update、audit 写入与 exact-target re-select 三者 MUST 全部
在同一事务内完成且 commit 之前生效；re-select 与 audit insert 的
相对顺序不是可观测差异（任一失败 MUST 导致整体回滚）。

### CTR-RR-005 — Audit 模型

成功时 MUST 在同一事务写 `auth_security_audits`：

```text
event_type = audience.registry_reconciled
result     = success
```

`details` MUST 包含：`migration_id`、`source_git_commit`、
`operator_id`、`approval_ref`、`reason`、`before_value`、
`after_value`。`before_value` / `after_value` MUST 是完整 Audience
snapshot（drift 态与目标态）。audit MUST NOT 记录数据库密码、Token
或 Authorization。audit 写入失败 MUST 使 Audience update 整体回滚。

### CTR-RR-006 — 重跑与冲突语义

第一次从精确漂移状态执行：

```text
AUDIENCE_ROWS_UPDATED = 1
AUDITS_CREATED = 1
```

目标态 + exact matching audit（metadata、before/after 全部精确匹配）：

```text
RESULT = NOOP
AUDIENCE_ROWS_UPDATED = 0
AUDITS_CREATED = 0
```

以下全部 conflict fail-closed（writes = 0）：

- 目标态但 audit 缺失；
- audit metadata 不匹配；
- before/after 漂移；
- duplicate audit；
- 漂移态已有 reconciliation audit；
- `registered_scopes` 不是精确三项；
- 其他字段漂移。

实现 MUST NOT 自动补审计，MUST NOT last-write-wins。

### CTR-RR-007 — PR #16 不可变绑定与 merge authority 链

```text
IMPLEMENTATION_PR = mayf3/auth-service #16
IMPLEMENTATION_REVIEW_HEAD =
  c67148cf35ecca2eeb4c4ff85a4478697d4ab2ab
IMPLEMENTATION_MERGE_BASE =
  36a11136745bae7a371d21ba62d9617942c41afa
PARENT_SPEC_BLOB_SHA1 =
  78530b1fbfb13d477e65e002185128cf69843942
PR_16_THREE_DOT_DIFF_SHA256 =
  2d0765de699b91f55bf5359f4a331ba8ade0a75058c96fa0eba54dd32f4aec30

PR_16_PRODUCT_FIX_REQUIRED = NO
PR_16_MERGE_AUTHORIZED_NOW = NO
```

PR #16 的 head 在 review 时点 MUST 仍等于
`IMPLEMENTATION_REVIEW_HEAD` 且 three-dot diff digest 仍等于
`PR_16_THREE_DOT_DIFF_SHA256`；任何失配 MUST 重新评审。只有本 Child
Spec review PASS → accepted → 合入 main 之后，PR #16 才获得 merge
authority；acceptance 本身不产生该 authority。

### CTR-RR-008 — production apply 边界

本 Spec 的 acceptance MUST NOT 自动授权 production apply。对生产数据库
执行 reconciliation 是 owner 的独立决定，要求：执行时点最新 main 的
干净 checkout、`--apply` 模式五项 audit metadata（含与干净 HEAD 相等的
`source_git_commit`）、以及 owner 批准引用。生产执行结果与 rollback
（如需）均为独立 reviewed 操作，不由本 Spec 授权或自动触发。

## 10. Acceptance

### ACC-RR-001 — 精确三文件闭包

- Contracts: `CTR-RR-001`
- Method: 审计实现 diff 文件清单与 `PR_16_THREE_DOT_DIFF_SHA256`。
- Environment: git 只读审计。
- Inputs/configuration: PR #16 three-dot diff。
- Required evidence: diff 恰好三个文件，路径逐一相等。
- Expected result: 3 files，无第四文件。
- Failure condition: 任何额外文件或路径漂移。

### ACC-RR-002 — 当前 drift 与 target 陈述一致

- Contracts: `CTR-RR-002`
- Method: 核对 Spec 冻结值与 Parent CTR-FR-002 / bundle 1.3.0。
- Required evidence: drift = 三项集合；target = 两项集合。
- Expected result: 逐字段一致。
- Failure condition: 任何值不一致。

### ACC-RR-003 — 只改 registered_scopes

- Contracts: `CTR-RR-002`
- Method: conformance tripwire（auth_audiences scope-only-update +
  no-delete）+ 更新后 re-select 与冻结 target snapshot 全字段相等
  （含 `version = 1` 与 `updated_at` 字节不变）。
- Environment: 一次性 PostgreSQL conformance。
- Required evidence: PR #16 `OBS-RR-003` 执行结果 + 测试断言。
- Expected result: 单列写入，其余列字节等价。
- Failure condition: 任何其他列变化。

### ACC-RR-004 — 其他字段漂移全部拒绝

- Contracts: `CTR-RR-003`
- Method: 9 项字段漂移矩阵（resource_service、scope_namespace、
  accepted_principal_types、human、machine、delegated、status、
  freeze_ready、version）。
- Required evidence: 每项 fail-loud、Audience/audit writes = 0。
- Failure condition: 任一漂移被接受或产生写入。

### ACC-RR-005 — forbidden Grant / Human / Delegation 扫描

- Contracts: `CTR-RR-003`
- Method: 任意 Machine Grant 含 `forum.moderate` / `forum.admin` /
  `forum.*` / wildcard；svc-forum Human Grant；svc-forum Delegation
  Grant；canary Forum Grant 非 `[forum.read, forum.write]`。
- Required evidence: 每项 fail-loud、writes = 0。
- Failure condition: 任一场景被接受或产生写入。

### ACC-RR-006 — lock-before-snapshot

- Contracts: `CTR-RR-004`
- Method: 静态断言（LOCK 语句先于 advisory；无 advisory-first 快照）
  + 并发 advisory-locked grant writer 与并发 audit writer 两个确定性
  场景。
- Required evidence: 两场景均 fail-closed；SI 粒度逃逸窗口关闭。
- Failure condition: 并发写者逃逸或顺序倒置。

### ACC-RR-007 — audit 同事务

- Contracts: `CTR-RR-005`
- Method: 注入 audit-insert 失败 trigger。
- Required evidence: Audience 行保持精确 drift 态（字节不变）、
  reconciliation audit = 0。
- Failure condition: 任何部分提交。

### ACC-RR-008 — exact rerun NOOP

- Contracts: `CTR-RR-006`
- Method: 成功后原样重跑。
- Required evidence: `outcome = noop`、rows = 0、audits = 0、全库
  行级字节稳定。
- Failure condition: 任何写入或状态变化。

### ACC-RR-009 — 冲突矩阵 fail-closed

- Contracts: `CTR-RR-006`
- Method: 目标态缺 audit / audit 漂移（before、after、result、
  metadata、成员缺失）/ duplicate audit / 漂移态已有 audit /
  scope 集合非精确三项。
- Required evidence: 全部 fail-loud、writes = 0、无自动补审计。
- Failure condition: 任一冲突被静默接受。

### ACC-RR-010 — non-target rows 不变

- Contracts: `CTR-RR-002`、`CTR-RR-003`
- Method: 成功 reconciliation 前后对非目标 Audience、全部 Grant、
  identity、sentinel audit 逐行 deep-equal；legacy 列不可读
  （runner 列权限 false,false）且内容不变。
- Required evidence: PR #16 执行证据。
- Failure condition: 任何非目标行变化或 legacy 列被读写。

### ACC-RR-011 — PR #16 exact head 落入闭包

- Contracts: `CTR-RR-007`
- Method: 复算 three-dot diff digest 与 head SHA。
- Required evidence: 与 `IMPLEMENTATION_REVIEW_HEAD` /
  `PR_16_THREE_DOT_DIFF_SHA256` 相等。
- Failure condition: head 或 digest 失配（→ 重新评审，非自动拒绝）。

### ACC-RR-012 — production apply 不由 acceptance 自动授权

- Contracts: `CTR-RR-008`
- Method: 审计 Spec 文本与 acceptance 记录中无任何 production apply
  授权语句。
- Required evidence: `PR_16_MERGE_AUTHORIZED_NOW = NO` 在 merge 前保持。
- Failure condition: acceptance 被解释为 apply 授权。

### Contract coverage

| Contract | Acceptance | Evidence class | Covered |
|---|---|---|---|
| `CTR-RR-001` | `ACC-RR-001`、`ACC-RR-011` | executed test / 只读审计 | YES |
| `CTR-RR-002` | `ACC-RR-002`、`ACC-RR-003`、`ACC-RR-010` | executed test | YES |
| `CTR-RR-003` | `ACC-RR-004`、`ACC-RR-005`、`ACC-RR-010` | executed test | YES |
| `CTR-RR-004` | `ACC-RR-006` | executed test / 静态断言 | YES |
| `CTR-RR-005` | `ACC-RR-007` | executed test | YES |
| `CTR-RR-006` | `ACC-RR-008`、`ACC-RR-009` | executed test | YES |
| `CTR-RR-007` | `ACC-RR-011` | 只读审计 | YES |
| `CTR-RR-008` | `ACC-RR-012` | 文本审计 | YES |

> 执行类证据由 PR #16 提供（`OBS-RR-003`，42/42 conformance 等）；
> 本 Spec 处于 proposed 阶段，最终 review/acceptance tuple 以独立
> review 记录为准，proposed 阶段 MUST NOT 伪造该 tuple。

## 11. Alternatives and disposition

### ALT-RR-001 — 直接 amend Parent CCR

- Disposition: rejected
- Reason: Parent 是已 accepted 的产品注册 authority，语义封闭；
  reconciliation 是实现权限问题，不是产品决定变更
  （`PRODUCT_SEMANTIC_DECISION_CHANGED = NO`）。
- Evidence/Claims considered: `STATE-RR-003`、`DEC-RR-001`。
- What would reopen: Parent 目标 entry 本身需要变更的新证据。

### ALT-RR-002 — 无 accepted Spec 直接合并 PR #16

- Disposition: rejected
- Reason: 违反仓库治理 implementation rule / merge gate
  （`docs/specs/README.md`：accepted + `implementation_authority =
  contracts` 才允许实现合入）。
- Evidence/Claims considered: `STATE-RR-001`（审计结论即为此 blocker）。
- What would reopen: 治理规则本身的 owner 级变更。

### ALT-RR-003 — 在本 Spec PR 内一并修改实现

- Disposition: rejected
- Reason: 审计结论 `PRODUCT_CODE_FIX_REQUIRED = NO`；本 PR 必须精确
  只有本 Spec 文件（authority-only）。
- Evidence/Claims considered: `OBS-RR-003`、`OBS-RR-004`。
- What would reopen: 独立 review 发现 PR #16 实现缺陷（当前无此证据）。

## 12. Migration, compatibility, and rollback

```text
MIGRATION = NONE（本 Spec 仅授权离线 reconciliation，无 schema/bundle/产品迁移）
COMPATIBILITY = Stage W/F 三文件离线执行形态；advisory key 813_947_203 独占；
  不与 Stage W（201）/ Stage F（202）冲突
ROLLBACK = reconciliation 的回滚是独立 reviewed 操作（fail-loud 语义下
  无部分提交；如需逆向恢复 forum.moderate 注册必须另走 owner 决策，
  且与 Parent CTR-FR-004 冲突，默认禁止）
EMERGENCY_CONTAINMENT = N/A（本 Spec 无生产动作；reconciliation 本身
  fail-closed、幂等可重跑）
```

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = YES（2026-08-22 owner acceptance；见 §14）
```

本 Spec 已于 2026-08-22 经 review PASS 与 owner acceptance 进入
`accepted`（lifecycle 记录见 §14 Acceptance Record）；实现与 PR #16 的
merge authority 按 §9 CTR-RR-007 的链条生效。§1–§12 的 reviewed
semantics 在该 lifecycle 轮中逐字保留。

## 14. Acceptance Record

```text
ACCEPTANCE_REVIEW =
  注册审计（注册 执行 / 注册 审计 任务链，dispatch review）

REVIEWED_BASE =
  36a11136745bae7a371d21ba62d9617942c41afa

REVIEWED_SPEC_HEAD =
  fb8059bafbc3e24af17293be7adbf528443e869d

REVIEW_VERDICT = PASS
REQUIRED_FIXES = NONE
ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = NONE

AUTH_BASE_DRIFT_BETWEEN_REVIEW_AND_ACCEPTANCE =
  main 前移 36a1113 → 37edaa6f8c56749eaa16c0bbbb0c0c75d8c6a1eb
  （PR #7：MINIMAL_AUTH_FOUNDATION_V2 accepted / V1 superseded）
  CLASSIFICATION = COMPATIBLE_AUTHORITY_ADDITION_NO_CHILD_SEMANTIC_DELTA
  依据：Parent AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1 保持 accepted，
  git blob 78530b1fbfb13d477e65e002185128cf69843942 未变；
  MINIMAL_AUTH_FOUNDATION_V2 冻结
  SVC_FORUM_CCR_COMPATIBILITY = COMPATIBLE_NO_SEMANTIC_DELTA 与
  SVC_FORUM_CCR_REFERENCE_DISPOSITION = GRANDFATHERED_EXACT_V1_CONSTRAINT，
  并 exact-incorporate Contract Bundle 1.3.0（audience registry 字节未变）。
  本 Child Spec §1–§12 reviewed semantics 零改动（先例：sync merge commit）。

PR_16_HEAD_AT_ACCEPTANCE = c67148cf35ecca2eeb4c4ff85a4478697d4ab2ab（未变）
PR_16_THREE_DOT_DIFF_SHA256 =
  2d0765de699b91f55bf5359f4a331ba8ade0a75058c96fa0eba54dd32f4aec30（未变）

FINAL_ACCEPTED_HEAD =
  以 PR #17 merge commit 为准（Git commit 无法内嵌自身 SHA）

ACCEPTED_BY = mayf3
ACCEPTED_AT = 2026-08-22

IMPLEMENTATION_PERFORMED = NO
PRODUCTION_CHANGE = NONE
PRODUCTION_APPLY_AUTHORIZED = NO（apply 仍需 §9 CTR-RR-008 的独立 owner 流程）
```

本 acceptance finalize 为纯 lifecycle 轮：仅执行
`status: proposed → accepted`、`implementation_authority: none →
contracts`、§13 lifecycle 镜像行同步、写入本 Acceptance Record、并在
`docs/specs/README.md` 增加 accepted index 行（外加同步 main 前移的
merge commit）。PR #16 未被修改；本轮无 implementation、无 production
apply、无 Grant 变更。本 Spec 合入 main 后，PR #16 按 §9 CTR-RR-007
获得 merge authority；production apply 仍不因此自动授权。
