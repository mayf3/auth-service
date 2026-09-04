---
spec_id: AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-03
accepted_date: 2026-09-03
accepted_by: mayf3
accepted_reviewed_base: 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de
accepted_reviewed_spec_commit: 6ca830e7d3a8414c1341d62647fd952eb472e0e7
acceptance_review_verdict: PASS
scope:
  - mayf3/auth-service
  - Cross-Agent Scheduler OAuth audience and scope registration authority
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []  # DAG ROOT (SCH -> downstream dsh-agent-core scheduler
                          # deployment chain): this Spec pins NO external head.
                          # Scope-name semantics are anchored on the ACCEPTED
                          # AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 R8 (blob
                          # 1f719514dc79a515a49aa592a0bd66961fcaed8a), not on
                          # any proposed downstream artifact; the proposed
                          # AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
                          # (dsh-agent-core PR #144 @ efdd754) is cited as
                          # pending consumer context ONLY and is never an
                          # authority pin.
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1

> **ACCEPTED / AUDIENCE-REGISTRATION AUTHORITY.** Owner、exact reviewed head
> 与 PASS verdict 只取本文件 frontmatter 的 accepted_by、
> accepted_reviewed_spec_commit 与 acceptance_review_verdict。本 acceptance
> 仅授权 CTR-SCH-004 冻结的 16 文件实现闭包与 CTR-SCH-005 的版本判定；
> Grant supply、DB backfill、deployment 与一切生产效果均为 separately
> authorized 轮次（CTR-SCH-007/009）。

## 1. Goal

建立 Cross-Agent Scheduler（授权 source agent 为 target agent 创建/控制
job、并读取 global/foreign 执行历史）所需的最小 OAuth authority：冻结一个
machine-only agent-profile Audience、两个精确 Scope，以及未来唯一已规划
Grant requirement 的形态（本 CCR 不创建任何 Principal / Client / secret /
Grant）：

```text
AUDIENCE_ID              = scheduler
RESOURCE_SERVICE         = scheduler
SCOPE_NAMESPACE          = scheduler
REGISTERED_SCOPES        = [scheduler.admin, scheduler.audit]
ACCEPTED_PRINCIPAL_TYPES = [agent]
HUMAN_ACCESS_ENABLED     = false
MACHINE_ACCESS_ENABLED   = true
DELEGATED_ACCESS_ENABLED = false
STATUS                   = active
FREEZE_READY             = true
```

scope 语义锚点 = **accepted** `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1` §R8
（blob `1f719514dc79a515a49aa592a0bd66961fcaed8a`）：

- `scheduler.admin` = job-definition mutation / control-plane scope（唯一
  mutation scope；不存在任何 global job-definition-read scope）；
- `scheduler.audit` = global/foreign execution history read scope；
- 本地标签 `scheduler.read:self` / `scheduler.manage:self` /
  `scheduler.manage:any` 显式**不是** token scope，本 CCR 不注册、也不得被
  推断注册；
- scope 字面量不蕴含该字面量之外的任何能力。

产品语义（job 定义、occurrence、target session 语义、exactly-once 等）由
下游 dsh-agent-core authority 拥有；auth-service 只校验 Audience、Scope 与
Grant，不理解任何 Scheduler 产品语义。

本轮是 **DOCS / AUTHORITY ONLY**：只创建 proposed CCR，不修改 Contract
Bundle、registry、产品代码、数据库或生产环境，不创建 principal/client/
secret，不写任何 Grant，不部署、不接受、不合并。

依赖方向（冻结）：本 Spec 是下游 scheduler 部署链的 **auth-service 根
节点**。dsh-agent-core 侧的 proposed 消费方
（AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2，PR #144 @ `efdd754`）冻结了
`(scheduler, scheduler.admin)` 与 `(scheduler, scheduler.audit)` 两个 exact
external proof 形状，并把本类 CCR 列为其生产可用性前置（该 spec
:756-762）；该引用是 context，本 Spec 不 pin 任何下游 head，下游 acceptance
与本 Spec acceptance 是彼此独立的事件。

## 2. Scope and non-goals

### In scope

- 冻结唯一 Audience entry 的全部安全字段（CTR-SCH-001）；
- 冻结恰两个注册 Scope `scheduler.admin`、`scheduler.audit` 及其
  auth-service 边界（CTR-SCH-002/003）；
- 冻结 versioned registry delta、版本判定规则（含 accepted 预留规避与
  sibling pending CCR 共存）与 runtime 兼容边界（CTR-SCH-005）；
- 冻结 positive / negative conformance（CTR-SCH-006）；
- 冻结 exact implementation closure（16 文件封闭集合，CTR-SCH-004）；
- 冻结未来唯一已规划 Grant requirement 的形态（descriptive，CTR-SCH-007）；
- 冻结 lifecycle 动作零生产效果（CTR-SCH-009）与下游不修订裁定
  （CTR-SCH-008）。

### Non-goals

本 authority 不授予，也不允许从 `scheduler.admin` / `scheduler.audit`
推导：

- 任何 Scheduler 产品语义（job 定义/控制/occurrence/history 的行为契约归
  下游 dsh-agent-core authority 拥有）；
- 任何本地标签的 wire 化：`scheduler.read:self`、`scheduler.manage:self`、
  `scheduler.manage:any`（含 `scheduler.manage-any` 等一切 manage-any 线格式）
  保持**不注册**——R8 冻结本地标签不是 token scope，下游 proposed spec
  ALT-009/WIRE_MANAGE_ANY_FORMS=FORBIDDEN 与之一致；
- 任何 global job-definition-read scope（R8 冻结其不存在；本 CCR 不得以
  `scheduler.read`、`scheduler.read:all` 或任何新字面量引入）；
- fleet-wide、cross-principal、human、service、delegated access；
- Workflow / Forum / wake / messaging / 其他业务 authority（不注册任何其他
  namespace scope）；
- Grant 创建、credential 供应——Grant supply 与 terminal compensation 是
  下游部署链中 separately authorized 的独立轮次（CTR-SCH-007 descriptive
  only）。

本轮不修改 immutable accepted authority normative body，不修改 executable
registry，不执行 migration / backfill，不写 production database，不创建
principal / client / secret，不写任何 Grant，不部署。AuthAudience 数据行的
生产创建走既有 backfill 路径（OBS-SCH-007），属于实现合入后的独立 operator
轮次，不属于本 CCR（CTR-SCH-009）。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de (github/main, 2026-09-03)
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2 (accepted)
SCOPE_SEMANTICS_ANCHOR (accepted) =
  AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 §R8
  (mayf3/dsh-agent-core, blob 1f719514dc79a515a49aa592a0bd66961fcaed8a;
  verified identical at acceptance commit a2919174 and origin/main)
HISTORICAL_EXACTLY_INCORPORATED_GRAMMAR =
  docs/contracts/minimal-auth-v1/grants-and-audiences.md
  docs/contracts/minimal-auth-v1/claims-and-profiles.md
  docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
PATTERN_AUTHORITY (parent-CCR shape) =
  AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1 (accepted)
PATTERN_AUTHORITY (closure shape) =
  AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
  (accepted; exact 16-file closure authority)
SIBLING_PENDING_REGISTRATION (context, non-dependency) =
  AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1 (proposed @ e5a1b8b,
  PR #41)：版本判定互不依赖，二者实现顺序由各自实现轮决定（CTR-SCH-005）
EXTERNAL_HEAD_PINS  = NONE
```

本 Spec 是新的 bounded child CCR，不 amend 或 supersede
`MINIMAL_AUTH_FOUNDATION_V2`，也不改写任何 accepted stable ID。

## 4. Current State

### STATE-SCH-001 — 当前 accepted registry 不包含 scheduler Audience

- Subject: Minimal Auth Contract `1.4.0` Audience Registry authority
- As-of commit: `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`（github/main）
- Observed at: 2026-09-03
- Basis: `OBS-SCH-001`

### STATE-SCH-002 — Scheduler 的外部 token 路径今天结构性 fail-closed

- Subject: v1 direct machine token mint 对 resource `scheduler` 的行为
- As-of commit: 同上
- Observed at: 2026-09-03
- Basis: `OBS-SCH-002`
- 含义：registry 无该 audience → `invalid_target`（发生在 Grant lookup 之前）；
  任何 Agent 今天都无法为 `scheduler` 资源换取 token。这是可接受的现状
  （与 wake / agent-definition / agent-session-messaging 同构）。

### STATE-SCH-003 — scope 语义已被 accepted authority 冻结，注册形状无歧义

- Subject: R8 对 `scheduler.admin` / `scheduler.audit` 的语义冻结与本地标签
  非 scope 裁定
- As-of commit: `mayf3/dsh-agent-core` @ a2919174（accepted）与 origin/main，
  blob 均为 `1f719514dc79a515a49aa592a0bd66961fcaed8a`
- Observed at: 2026-09-03
- Basis: `OBS-SCH-003`

## 5. Observations

全部 auth-service 观察基于
`mayf3/auth-service@05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`（github/main，
2026-09-03 fetch 后 HEAD），方法为只读源码/`git show` 审计；生产数据库未被
访问。dsh-agent-core 观察基于 `mayf3/dsh-agent-core@a0ce485`（github/main）
内的 accepted R8 与 proposed PR #144 head `efdd754` 文本，方法相同。

### OBS-SCH-001 — Registry 现状

- Subject: `contract-bundles/minimal-auth-v1/audience-registry.json`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读审计。
- Result: `registry_version = "1.4.0"`、`status = "frozen"`、恰 6 个
  audiences（svc-workflow / svc-okr / adc-v2 / svc-auth / svc-forum /
  agent-core-notification-ingress-v1）；无 `scheduler`，无任何 `scheduler.*`
  scope 注册。
- Provenance: 本 Spec authoring 审计。

### OBS-SCH-002 — direct machine token 的 resource→audience 解析与门禁

- Subject: `src/lib/oauth/v1/direct.ts`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result: 与 session-messaging CCR OBS-ASM-002 同构：:85-86 resource 字面量
  必须等于注册 `audience_id`；:88-89 无匹配或非 machine → `invalid_target /
  audience_not_machine_enabled`（先于 Grant lookup）；agent principal 必携带
  `agentId`；principal type 不含 → `audience_profile_not_accepted`；无
  MachineAccessGrant → `machine_grant_missing`；DB/registry 不一致 →
  `audience_registry_mismatch` fail-closed；grant.scopes ⊄ registeredScopes →
  `machine_grant_state_invalid`。
- Provenance: 本 Spec authoring 审计。

### OBS-SCH-003 — R8 冻结的 scope 语义（accepted 锚点）

- Subject: `mayf3/dsh-agent-core` `docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md`
  §R8
- Source revision: accepted（acceptance commit `a2919174`）；origin/main 同
  blob `1f719514dc79a515a49aa592a0bd66961fcaed8a`
- Observed at: 2026-09-03
- Method: 只读 authority 文本审计。
- Result: `scheduler.admin` = job-definition mutation/control 唯一 scope；
  `scheduler.audit` = global/foreign execution history read；不存在 global
  job-definition-read scope；本地 `*:self` / `manage:any` 标签显式不是 token
  scope。下游 proposed AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
  （PR #144 @ `efdd754`）CTR-AUTH-002 的 operation matrix 与该语义一一对应，
  并冻结 `(scheduler, scheduler.admin)` / `(scheduler, scheduler.audit)` 两个
  exact external proof 形状与 `list(all_agents=true)` 无条件 fail-closed。
- Provenance: 本 Spec authoring 审计。

### OBS-SCH-004 — Scope namespace 机械规则

- Subject: `src/lib/oauth/v1/scope.ts`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result: :3 `SCOPE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$/`；
  :23-24 每个 scope 首段必须等于 `scope_namespace`。因此 `scheduler.admin` /
  `scheduler.audit` **机械要求** `scope_namespace = "scheduler"`。
- Provenance: 本 Spec authoring 审计。

### OBS-SCH-005 — runtime snapshot 加载链与版本 allowlist

- Subject: `src/lib/oauth/v1/contract.ts` 等
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result: contract.ts :102 allowlist = `['1.0.0','1.1.0','1.2.0','1.3.0',
  '1.4.0']`；validate.mjs :395 first-wave set = 6 entries（与 session-messaging
  CCR OBS-ASM-004/005 同构）。bundle 版本晋升必须同步两者。
- Provenance: 本 Spec authoring 审计。

### OBS-SCH-006 — 版本占用/预留与 sibling pending 注册

- Subject: `metadata/change-log.md`、accepted forum-moderator spec、proposed
  session-messaging CCR
- Source revision: `auth-service@05fcf40`；PR #41 @ `e5a1b8b`
- Observed at: 2026-09-03
- Method: 只读审计。
- Result: `1.4.0` 已占用；`1.5.0` 被 accepted
  `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` 预留；sibling proposed
  `AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1` 若先行实现将占用
  `1.6.0`。本 CCR 不与其竞争版本号：CTR-SCH-005 的实现时点判定规则天然按
  实现顺序取下一个未预留 minor（session-messaging 先实现 → 本 CCR 实现值 =
  `1.7.0`；本 CCR 先实现 → `1.6.0`）。两个 acceptance 互不依赖、互不阻塞。
- Provenance: 本 Spec authoring 审计。

### OBS-SCH-007 — AuthAudience 数据行的既有创建车辆

- Subject: `scripts/backfill-minimal-auth-v1.ts`、`prisma/schema.prisma`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result: 与 OBS-ASM-008 同构——bundle 落地后 DB 行创建有既有 backfill 车辆，
  无需 schema migration；属于实现合入后的独立 operator 轮次。
- Provenance: 本 Spec authoring 审计。

## 6. Claims and assumptions

### CLM-SCH-001 — 一个 bounded child CCR 是必需且足够的注册权威

- Support state: SUPPORTED
- Supported by evidence: `OBS-SCH-001`、`OBS-SCH-003`、NI closure V2 先例
- Contradicted by evidence: none known
- Uncertainty: none；audience 缺席 + accepted grammar 要求显式注册。

### CLM-SCH-002 — 双 scope `scheduler.admin` + `scheduler.audit` 是最窄充分注册

- Support state: SUPPORTED
- Supported by evidence: `OBS-SCH-003`（accepted R8 语义 + proposed 下游
  matrix 的 exact proof 形状恰为这两个 tuple；无第三 scope 需求——global
  definition read 被冻结不存在，`list(all_agents=true)` 被冻结 fail-closed）
- Contradicted by evidence: none known
- Uncertainty: none within the frozen registration boundary。

### CLM-SCH-003 — 注册不需要 auth-service 产品代码语义变更（仅版本 allowlist 联动）

- Support state: SUPPORTED
- Supported by evidence: `OBS-SCH-002`、`OBS-SCH-005`、`OBS-SCH-007`
- Contradicted by evidence: none known
- Uncertainty: 版本联动属 LIMITED_RUNTIME_COMPATIBILITY_CHANGE（NI closure
  先例），精确边界由 CTR-SCH-004/005 冻结。

## 7. Evidence relations

### EVD-SCH-001 — Audience 缺席与 token 拒绝支持注册必要性

- Source observations: `OBS-SCH-001`、`OBS-SCH-002`
- Target: `STATE-SCH-001`、`STATE-SCH-002`、`CLM-SCH-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@05fcf40`，observed 2026-09-03
- Strength/sufficiency: exact for source authority at the authoring base
- Limitations: 不注册、不激活 Audience
- Provenance: 本 Spec authoring 审计

### EVD-SCH-002 — accepted R8 语义与 namespace 规则支持字段冻结

- Source observations: `OBS-SCH-003`、`OBS-SCH-004`
- Target: `STATE-SCH-003`、`CLM-SCH-002`、CTR-SCH-001/002 字段值
- Relation: SUPPORTS
- Bound coordinates: `dsh-agent-core` R8 blob `1f719514…`（accepted @
  a2919174 = origin/main）+ `auth-service@05fcf40`
- Strength/sufficiency: scope 语义锚点为 accepted authority（blob 双点一致），
  namespace 字段有源码行证
- Limitations: proposed 下游 PR #144 引用仅为 context（CTR-SCH-008）
- Provenance: 本 Spec authoring 审计

### EVD-SCH-003 — 既有加载链与 backfill 车辆支持零产品代码变更

- Source observations: `OBS-SCH-005`、`OBS-SCH-007`
- Target: `CLM-SCH-003`、CTR-SCH-004 闭包边界
- Relation: SUPPORTS
- Bound coordinates: `auth-service@05fcf40`
- Strength/sufficiency: NI closure V2 accepted 先例覆盖同构联动
- Limitations: 实现轮字节级证明在 CTR-SCH-004/005 内
- Provenance: 本 Spec authoring 审计

### EVD-SCH-004 — 版本占用/预留/sibling 现状支持版本判定规则

- Source observations: `OBS-SCH-006`
- Target: `DEC-SCH-002`、CTR-SCH-005(2)
- Relation: SUPPORTS
- Bound coordinates: `auth-service@05fcf40` + PR #41 @ `e5a1b8b`
- Strength/sufficiency: 全部版本状态可机械回读；规则各分支结果唯一
- Limitations: 实现顺序由各自实现轮决定，本 Spec 不固定顺序
- Provenance: 本 Spec authoring 审计

## 8. Decisions

### DEC-SCH-001 — machine-only、agent-profile、双 scope 单 audience

与 wake / svc-forum / session-messaging 先例同构。单一 `scheduler` audience
携带恰两个 scope：Cross-Agent Scheduler 的两类外部证明（mutation/control 与
global/foreign history）共享同一 resource，分 scope 而不分 audience，与 R8
的 scope 语义切分一致，且 Grant 可按 principal 只授其中一个（least
privilege）。

### DEC-SCH-002 — 版本判定延迟到实现时点、显式规避占用/预留/sibling

沿用 session-messaging CCR CTR-ASM-005(2) 同一规则形状；二者是独立 DAG 根、
互不依赖，版本号由实现顺序机械决定，不存在竞争（实现轮取"当时
registry_version 之后、一切已占用与被 accepted 预留之外的最小 minor"）。

### DEC-SCH-003 — audience 语义零产品化

auth-service 不理解 Scheduler 产品语义；scope 字面量不蕴含行外能力
（R8/CTR-AUTH-002 同旨）。所有产品语义归下游。

## 9. Contracts

### CTR-SCH-001 — Frozen Audience entry

实现 MUST 在 `audience-registry.json` 追加恰一个 entry，逐字段等于：

```json
{
  "audience_id": "scheduler",
  "resource_service": "scheduler",
  "scope_namespace": "scheduler",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["scheduler.admin", "scheduler.audit"],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1; machine-only agent access for cross-agent scheduler job mutation/control (scheduler.admin) and global/foreign execution history read (scheduler.audit), semantics frozen by accepted AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 R8."
}
```

既有 6 个 entry 与其余一切 bytes MUST NOT 改变（除 CTR-SCH-005 的版本字段）。

### CTR-SCH-002 — Exact two-scope registration and forbidden set

唯一注册 scopes = `scheduler.admin`、`scheduler.audit`。以下 MUST 保持不
注册：一切 manage-any 线格式（`scheduler.manage-any`、`scheduler.manage:any`）、
`scheduler.read:self`、`scheduler.manage:self`、`scheduler.read`、任何
global job-definition-read 字面量、任何通配/别名、任何其他 namespace
（`workflow.*` / `forum.*` / `notification.*` / `okr.*` / `adc.*` / `auth.*` /
`agent.*`）、human / service / delegated access 任何形式。scope 字面量不蕴含
行外能力；两 scope 互不蕴含。

### CTR-SCH-003 — machine-only agent-profile token 语义边界

token 语义完全由既有 direct.ts 机械门禁承载（OBS-SCH-002）。本 CCR 不新增
任何代码路径、profile 字段或错误码。

### CTR-SCH-004 — Exact 16-file implementation closure

与 session-messaging CCR CTR-ASM-004 / NI closure V2 CTR-NIC2-001 同一 16
文件集合（audience-registry.json、contract-manifest.json、
schemas/contract-manifest.schema.json、fixtures/positive-token-fixtures.json、
fixtures/negative-token-fixtures.json、fixtures/schema-instances.json、
metadata/freeze-gates.json、metadata/consumer-verification-matrix.json、
metadata/adc-v2-scope-map.json、metadata/llm-todo-authorization-candidate.json、
metadata/change-log.md、validate.mjs、src/lib/oauth/v1/contract.ts、
tests/helpers/load-candidate-snapshot.ts、
tests/oauth/candidate-contract.test.ts、tests/oauth/contract-runtime-v1.test.ts），
`EXTRA_FILE_COUNT = 0`。`LIMITED_RUNTIME_COMPATIBILITY_CHANGE` 仅限：
contract.ts allowlist 追加新版本字面量；candidate loader helper 追加同一
字面量（+匹配注释）；两个测试版本期望旧值→新值。不得改变 format-version、
digest、lifecycle、signer、verifier、claim、algorithm、introspection、
fallback 或 error 行为。NO_IN_PLACE_DISGUISE = YES。

### CTR-SCH-005 — Versioned registry delta 与版本判定

1. 添加恰 CTR-SCH-001 的 entry 与两 scope 注册；
2. 版本 = 恰一次 additive minor 晋升，基准为实现时点当时 registry_version，
   且 MUST 严格避开：一切已被 accepted Spec 预留而尚未占用的版本号（现
   `1.5.0`）、以及 sibling pending CCR
   `AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1` 在其先行实现轮
   中已占用的版本号。registry/manifest/fixtures MUST NOT 原地伪装不变；
3. 按 validate.mjs 联动校验同步全部携带 `contract_version` 的 bundle 文件
   （含 `registry_version`），并在 `metadata/change-log.md` 增加条目（记录
   本 SPEC_ID、entry 冻结值、fixtures 增补、版本判定与规避）；
4. validate.mjs 的唯一允许 delta = :395 first-wave Audience 集合字面量单行
   追加恰 `scheduler`（6 → 7 entries）；
5. 最终 `npm run contract:v1:validate` MUST 输出
   `MINIMAL_AUTH_V1_BUNDLE_VALID=true`，blocker 计数与基线 parity
   （FREEZE 0 / PRODUCTION 1 / CONSUMER 2）。

### CTR-SCH-006 — Positive / negative conformance

Bundle fixtures MUST 至少包含：

- POSITIVE：agent-profile Direct Machine fixture（principal_type = agent、
  携带 agentId、aud = `scheduler`、scope = `scheduler.admin` 或
  `scheduler.audit`（两例均需）、MachineAccessGrant 存在、exact requested
  equality、grant subset）；
- NEGATIVE（全部 fail-closed）：unknown audience；human/service principal 被
  拒；manage-any 线格式 / 本地标签字面量 / 通配 / 越权 / namespace 错误
  scope 全部 `invalid_scope`；grant 缺失；grant 超集；DB/registry mismatch。

任何 negative 阶段 MUST NOT 执行 positive issuance。

### CTR-SCH-007 — 未来唯一已规划 Grant requirement 的形态（descriptive only）

下游部署链将另行 authorized：向 ONE named disposable source agent principal
授予恰 `scheduler` audience、least-privilege scope 子集（仅其 canary 所需
者）的 MachineAccessGrant，并以 terminal compensation REQUIRED 结束。普通
self-scheduler 操作（本 agent 自己的 job）零 Auth、零 Grant，不受本 CCR 影
响。本 CCR 仅描述该形态，不创建、不授权、不预授任何 Grant。

### CTR-SCH-008 — 下游不修订裁定

本 CCR 不修改、不 supersede、不评论任何 dsh-agent-core authority（含
accepted R8 与 proposed PR #144）的 normative body；下游对 `scheduler` /
`scheduler.admin` / `scheduler.audit` 字面量的引用以本 CCR accepted head 为
prerequisite 事实（OBS-SCH-003），不构成本 Spec 对下游的依赖。若下游字面量
未来变化，必须走下游 own amendment + 本 CCR 的独立 successor。

### CTR-SCH-009 — Lifecycle 动作零生产效果

本 Spec 的 authoring、独立评审、acceptance、（未来）实现闭包含并均不部署、
不写 production DB、不创建 AuthAudience 数据行、不创建 Grant、不产生生产效
果。production deployment（服务重启/snapshot 再生成）是 acceptance 与实现
合入后的 separately authorized operator 轮次。

## 10. Acceptance scheme

当前为 docs-only proposal：`status: proposed`、`implementation_authority:
none`、`production_apply_authority: none`。独立审计必须明确判断：bounded
child CCR 形式有效性、entry/scope 字段冻结完整性（含 manage-any/本地标签/
global-read 三重禁止）、16 文件闭包与版本判定规则可执行性、conformance 覆
盖、零生产效果边界。若审计判定需要更大改形，本 proposal = BLOCKED。

审计 PASS 后，Owner 对 exact reviewed head 作出接受决定。Lifecycle
transaction 的 exhaustive allowlist 仅为：

1. frontmatter `status: proposed -> accepted`、
   `implementation_authority: none -> contracts`（production_apply_authority
   保持 none）；
2. `accepted_date`、`accepted_by`、`accepted_reviewed_base`、
   `accepted_reviewed_spec_commit`、`acceptance_review_verdict` 五字段
   null -> 审计冻结值；
3. 标题下方 proposal banner 的 exact literal `FROM` → `TO` 替换；
4. `docs/specs/README.md` 本 Spec 行的 lifecycle 与 authority 两处同步。

除此之外，本文（含本节）与索引其他 bytes 全部冻结。Lifecycle commit 形成后，
必须由独立 Reviewer 对新 exact head 执行 `FINAL_HEAD_RECHECK = PASS`，通过
后的 exact head 才可 merge。

Literal `FROM`：

```text
> **PROPOSED / NOT ACCEPTED.** 本文件只提出 Cross-Agent Scheduler 所需的最小
> auth-service Audience/Scope 注册 Authority（docs-only）。在独立审计 PASS、
> Owner 接受 exact head 并翻转 lifecycle 字段之前，本 Spec 无任何实现或生产
> 效力；authoring 轮不得修改 bundle/registry/代码/数据库/生产。
```

Literal `TO`：

```text
> **ACCEPTED / AUDIENCE-REGISTRATION AUTHORITY.** Owner、exact reviewed head
> 与 PASS verdict 只取本文件 frontmatter 的 accepted_by、
> accepted_reviewed_spec_commit 与 acceptance_review_verdict。本 acceptance
> 仅授权 CTR-SCH-004 冻结的 16 文件实现闭包与 CTR-SCH-005 的版本判定；
> Grant supply、DB backfill、deployment 与一切生产效果均为 separately
> authorized 轮次（CTR-SCH-007/009）。
```
