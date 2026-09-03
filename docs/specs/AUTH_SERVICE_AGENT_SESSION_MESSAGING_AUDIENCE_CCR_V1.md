---
spec_id: AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-03
scope:
  - mayf3/auth-service
  - agent_session_send OAuth audience and scope registration authority
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []  # DAG ROOT (ASM -> downstream dsh-agent-core deployment
                          # chain): this Spec pins NO external head and takes no
                          # authority from any proposed downstream artifact;
                          # downstream Specs (mayf3/dsh-agent-core
                          # AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1,
                          # accepted @ a0ce485, CTR-DEP-002) pin THIS Spec's
                          # accepted head as their Phase-A prerequisite, never
                          # the reverse.
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1

> **PROPOSED / NOT ACCEPTED.** 本文件只提出 agent_session_send 所需的最小
> auth-service Audience/Scope 注册 Authority（docs-only）。在独立审计 PASS、
> Owner 接受 exact head 并翻转 lifecycle 字段之前，本 Spec 无任何实现或生产
> 效力；authoring 轮不得修改 bundle/registry/代码/数据库/生产。

## 1. Goal

建立 canonical `agent_session_send`（agent→agent canonical main Session 一次
send）所需的最小 OAuth authority：冻结一个 machine-only agent-profile
Audience、一个精确 Scope，以及未来唯一已规划调用方 Grant requirement 的形态
（本 CCR 不创建任何 Principal / Client / secret / Grant）：

```text
AUDIENCE_ID              = agent-session-messaging
RESOURCE_SERVICE         = agent-session-messaging
SCOPE_NAMESPACE          = agent
REGISTERED_SCOPES        = [agent.session.send]
ACCEPTED_PRINCIPAL_TYPES = [agent]
HUMAN_ACCESS_ENABLED     = false
MACHINE_ACCESS_ENABLED   = true
DELEGATED_ACCESS_ENABLED = false
STATUS                   = active
FREEZE_READY             = true
```

`agent.session.send` 允许持有该 Grant 的 **agent principal**（machine client，
principal_type = agent，携带自身 agentId）为 `agent-session-messaging` 资源换取
access token。产品语义（canonical main Session 复用、exactly-once 投递、目标
own-identity 执行、ping-pong 禁止等）由下游资源消费方拥有；auth-service 只校验
Audience、Scope 与 Grant，不理解任何 A2A messaging 产品语义。

本轮是 **DOCS / AUTHORITY ONLY**：只创建 proposed CCR，不修改 Contract Bundle、
registry、产品代码、数据库或生产环境，不创建 principal/client/secret，不写
任何 Grant，不部署、不接受、不合并。

依赖方向（冻结）：本 Spec 是下游部署链的 **auth-service 根节点**：

```text
ASM（本 Spec，auth-service）
  <- 被 mayf3/dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
     CTR-DEP-002 引用为其 Phase A 的必需 accepted prerequisite
     （dsh-agent-core @ a0ce485，accepted，PR #149）
```

本 Spec 不规范性依赖上述任何下游 Spec；下游职责只在 Non-goals / context 中被
描述（§2、OBS-ASM-007、CTR-ASM-008），不形成任何下游 authority dependency 或
exact-head pin。

## 2. Scope and non-goals

### In scope

- 冻结唯一 Audience entry 的全部安全字段（CTR-ASM-001）；
- 冻结唯一注册 Scope `agent.session.send` 及其 auth-service 边界（CTR-ASM-002/003）；
- 冻结 versioned registry delta、版本判定规则（含 accepted 版本预留规避）与
  runtime 兼容边界（CTR-ASM-005）；
- 冻结 positive / negative conformance（CTR-ASM-006）；
- 冻结 exact implementation closure（16 文件封闭集合，CTR-ASM-004）；
- 冻结未来唯一已规划 Grant requirement 的形态（descriptive，CTR-ASM-007）；
- 冻结 lifecycle 动作零生产效果（CTR-ASM-009）与下游不修订裁定（CTR-ASM-008）。

### Non-goals

本 authority 不授予，也不允许从 `agent.session.send` 推导：

- 任何 A2A API / Broker capability / messaging 产品设计（canonical
  `agent_session_send` 的产品契约归下游 dsh-agent-core authority 拥有；本
  CCR 不设计、不命名、不授权任何新 API）；
- auth management、identity provisioning 或 token management；
- Scheduler authority（本 Audience 与 scheduler 面 zero 交集——不注册任何
  `scheduler.*` scope）；
- Workflow / Forum / wake / 其他业务 authority（不注册 `workflow.*`、
  `forum.*`、`agent.wake`——wake 属于已 accepted 的
  `AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1` 的注册物；`agent.definition.write`
  属于另一资源 `agent-definition` 的独立注册）；
- delegation / OBO authority；Human access；service-principal access；
- wildcard、prefix match 或通用 `agent.*` Grant；
- 未在本 CCR 注册的任何 `agent.*` scope（同一 namespace 下不同 scope 字面量
  不构成复用，但均未获本 CCR 授权）；
- Grant 创建、fleet-wide messaging privilege、跨 principal 授权、credential
  供应——Grant supply 与 terminal compensation 是下游部署链中 separately
  authorized 的独立轮次（CTR-ASM-007 descriptive only）。

本轮不修改 immutable accepted authority normative body，不修改 executable
registry，不执行 migration / backfill，不写 production database，不创建
principal / client / secret，不写任何 Grant，不部署。AuthAudience 数据行的
生产创建走既有 backfill 路径（OBS-ASM-008），属于实现合入后的独立 operator
轮次，不属于本 CCR（CTR-ASM-009）。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de (github/main, 2026-09-03)
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2 (accepted)
HISTORICAL_EXACTLY_INCORPORATED_GRAMMAR =
  docs/contracts/minimal-auth-v1/grants-and-audiences.md
  docs/contracts/minimal-auth-v1/claims-and-profiles.md
  docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
PATTERN_AUTHORITY (parent-CCR shape) =
  AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1 (accepted)
PATTERN_AUTHORITY (closure shape) =
  AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
  (accepted; exact 16-file closure authority)
DEPENDENCY_POSITION = ROOT of the auth-service side of the downstream
  agent_session_send deployment chain
EXTERNAL_HEAD_PINS  = NONE
```

本 Spec 是新的 bounded child CCR，不 amend 或 supersede
`MINIMAL_AUTH_FOUNDATION_V2`，也不改写任何 accepted stable ID。

## 4. Current State

### STATE-ASM-001 — 当前 accepted registry 不包含 agent-session-messaging Audience

- Subject: Minimal Auth Contract `1.4.0` Audience Registry authority
- As-of commit: `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`（github/main）
- Observed at: 2026-09-03
- Basis: `OBS-ASM-001`

### STATE-ASM-002 — Audience/Scope/Grant 生效需要 versioned delta，且 Bundle `1.5.0` 已被 accepted authority 预留

- Subject: accepted Minimal Auth versioned migration grammar 与 accepted
  forum-moderator 版本预留
- As-of commit: 同上
- Observed at: 2026-09-03
- Basis: `OBS-ASM-004`、`OBS-ASM-006`

### STATE-ASM-003 — agent-session-messaging 的直接 token 路径今天结构性 fail-closed

- Subject: v1 direct machine token mint 对 resource `agent-session-messaging` 的行为
- As-of commit: 同上
- Observed at: 2026-09-03
- Basis: `OBS-ASM-002`
- 含义：registry 无该 audience → `invalid_target`，且下游
  AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1 的 OBS-DEP-003 已机械证明
  authorization 在 Grant lookup 之前 reject；这是可接受的现状（与 wake /
  agent-definition 同构：先有 capability 形状与 CCR authority、后有注册）。

## 5. Observations

全部 auth-service 观察基于
`mayf3/auth-service@05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`（github/main，
2026-09-03 fetch 后 HEAD），方法为只读源码/`git show` 审计；生产数据库未被
访问。下游 dsh-agent-core 观察基于 `mayf3/dsh-agent-core@a0ce485`（github/
main，accepted authority 文本），方法相同。

### OBS-ASM-001 — Registry 现状

- Subject: `contract-bundles/minimal-auth-v1/audience-registry.json`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读审计。
- Result: `registry_version = "1.4.0"`、`status = "frozen"`、恰 6 个
  audiences（svc-workflow / svc-okr / adc-v2 / svc-auth / svc-forum /
  agent-core-notification-ingress-v1）；无 `agent-session-messaging`，无任何
  `agent.*` scope 注册；`agent-wake` 亦不在 executable registry（其 accepted
  CCR 的实现闭包尚未落 main——CCR accepted ≠ registry 落地的先例）。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-002 — direct machine token 的 resource→audience 解析与门禁

- Subject: `src/lib/oauth/v1/direct.ts`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result（逐行）:
  - :85-86 以 `audience.audienceId === params.resource` 匹配 runtime registry
    ——**`resource` 字面量必须等于注册的 `audience_id`**；
  - :88-89 无匹配或 `!machineAccessEnabled` → `invalid_target /
    audience_not_machine_enabled`（发生在 Grant lookup 之前）；
  - `assertPrincipalProfile`：agent principal 必须携带 `agentId`（service
    principal 必须不携带）；
  - principal type 不在 `acceptedPrincipalTypes` → `invalid_target /
    audience_profile_not_accepted`；
  - 无该 audience 的 MachineAccessGrant → `invalid_scope /
    machine_grant_missing`；
  - DB `grant.audience` 行与 runtime registry 不一致 →
    `temporarily_unavailable / audience_registry_mismatch:<field>`
    （fail-closed）；
  - grant.scopes ⊄ registeredScopes → `temporarily_unavailable /
    machine_grant_state_invalid`。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-003 — Scope namespace 机械规则

- Subject: `src/lib/oauth/v1/scope.ts`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result: :3 `SCOPE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$/`；
  :23-24 每个请求 scope 的首段（第一个 `.` 之前）必须等于该 audience 的
  `scope_namespace`，否则 `invalid_scope / scope_namespace_invalid`。因此
  注册 scope `agent.session.send` **机械要求** `scope_namespace = "agent"`。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-004 — runtime snapshot 加载链与版本 allowlist

- Subject: `src/lib/oauth/v1/contract.ts`、`scripts/prepare-minimal-auth-v1.mjs`、
  `package.json`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result:
  - contract.ts :102 的 supported Contract-version allowlist 现为
    `['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0']`——bundle 版本晋升必须同步
    该 allowlist（NI closure 的 LIMITED_RUNTIME_COMPATIBILITY_CHANGE 先例）；
  - runtime audience 定义从 `generated/minimal-auth-v1/runtime-contract.json`
    快照加载，快照由 `npm run contract:v1:prepare` 从 bundle 生成——注册不
    需要新的产品读取路径；
  - `npm run contract:v1:validate` = bundle validator 真实命令。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-005 — validate.mjs first-wave Audience 集合 gate

- Subject: `contract-bundles/minimal-auth-v1/validate.mjs` :395
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result: :395 将 registry Audience 精确集合硬编码为
  `['adc-v2', 'agent-core-notification-ingress-v1', 'svc-auth', 'svc-forum',
  'svc-okr', 'svc-workflow'].sort(asciiCompare)`（6 entries）并以
  `registry: first-wave Audience set changed` 为失败信息——新增任何 Audience
  而不改该行必然触发此 gate。NI closure V2 已确立该文件为 closure 第 16 文件
  （PROVEN_NECESSARY），唯一允许 validator delta = 该集合字面量单行追加。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-006 — 版本预留现状

- Subject: `contract-bundles/minimal-auth-v1/metadata/change-log.md`、
  `docs/specs/AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1`（accepted）
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读审计。
- Result:
  - `1.4.0` 已被 NI 注册占用并落 main（registry_version = 1.4.0）；
  - accepted `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` 冻结
    `svc-forum` `forum.moderate` 增量注册为 Bundle `1.5.0`（"reserved
    Bundle `1.4.0` 之后注册 `1.5.0`"）；其实现 PR #37 仍 DRAFT 未落 main，
    但版本号已被 accepted authority 预留；
  - 因此本 CCR 的实现版本判定 MUST 规避 `1.5.0`（CTR-ASM-005）。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-007 — 下游消费方的 resource/scope 机械形状（context，非 authority pin）

- Subject: `mayf3/dsh-agent-core@a0ce485`（github/main）：
  - `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1`
    （accepted，CTR-DEP-002/003/006、OBS-DEP-003）
  - `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1`（canonical capability）
- Observed at: 2026-09-03
- Method: 只读 authority 文本审计（跨仓 evidence 坐标，非 authority pin）。
- Result:
  - CTR-DEP-002 冻结 downstream Gate 要求 auth-service 具备 "deployed active
    machine-only agent audience with exact resource `agent-session-messaging`
    and exact scope `agent.session.send`"，并要求 Phase A 用 disposable 无
    Grant principal 先做 negative-only token proof、禁止 positive issuance；
  - CTR-DEP-006 冻结 Grant supply 为 separately authorized 的最小
    `(resource=agent-session-messaging, scope=agent.session.send)` Grant、
    单一 named disposable source principal、terminal compensation REQUIRED；
  - 目标 Session 语义 = canonical `main`（一次 send 不构成新 Session）；
    SOURCE_CREDENTIAL_PROPAGATED = NO 属下游 Gate，不在本 CCR 范围。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-008 — AuthAudience 数据行的既有创建车辆

- Subject: `scripts/backfill-minimal-auth-v1.ts`（`npm run contract:v1:backfill`）、
  `prisma/schema.prisma`
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读源码审计。
- Result: backfill 以 runtime registry 为源规划 `audienceCreates` 并在事务内
  创建（与 wake CCR OBS-AW-007 同构）——bundle 落地后 DB 行创建有既有车辆，
  无需 schema migration；`AuthAudience` 字段与 registry entry 一一对应。
- Provenance: 本 Spec authoring 审计。

### OBS-ASM-009 — 注册实现闭包的 accepted 先例 = 16 文件

- Subject:
  `docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2`
  （accepted；CTR-NIC2-001）
- Source revision: `auth-service@05fcf40`
- Observed at: 2026-09-03
- Method: 只读审计。
- Result: additive Audience/Scope 注册的 exact closure = 16 文件（11 bundle +
  validate.mjs + 4 runtime/candidate linkage：contract.ts allowlist、
  `tests/helpers/load-candidate-snapshot.ts`、两个 version-expectation 测试）；
  additive 注册走 minor 晋升；NO_IN_PLACE_DISGUISE = YES；
  `EXTRA_FILE_COUNT = 0`。
- Provenance: 本 Spec authoring 审计。

## 6. Claims and assumptions

### CLM-ASM-001 — 一个 bounded child CCR 是必需且足够的注册权威

- Support state: SUPPORTED
- Supported by evidence: `OBS-ASM-001`、`OBS-ASM-009`、下游 CTR-DEP-002
- Contradicted by evidence: none known
- Uncertainty: none；audience 缺席 + accepted grammar 要求显式注册。

### CLM-ASM-002 — 单 scope `agent.session.send` 是最窄充分注册

- Support state: SUPPORTED
- Supported by evidence: `OBS-ASM-007`（下游 accepted authority 的机械形状恰为
  resource `agent-session-messaging` + scope `agent.session.send`；alias/
  wildcard 均被下游 Gate 禁止）
- Contradicted by evidence: none known
- Uncertainty: none within the frozen registration boundary。

### CLM-ASM-003 — 注册不需要 auth-service 产品代码语义变更（仅版本 allowlist 联动）

- Support state: SUPPORTED
- Supported by evidence: `OBS-ASM-002`、`OBS-ASM-004`、`OBS-ASM-008`、
  `OBS-ASM-009`
- Contradicted by evidence: none known
- Uncertainty: 版本 allowlist / candidate loader / 测试期望的联动属
  LIMITED_RUNTIME_COMPATIBILITY_CHANGE（NI closure 先例），其精确边界由
  CTR-ASM-004/005 冻结。

## 7. Decisions

### DEC-ASM-001 — machine-only、agent-profile、单 scope

与 wake / svc-forum 先例同构：`accepted_principal_types = ["agent"]`、
human/delegated 双 false。理由：canonical `agent_session_send` 的唯一调用方是
agent principal；human/service/delegated access 均不在下游 Gate 内。

### DEC-ASM-002 — 版本判定延迟到实现时点、显式规避 accepted 预留

沿用 wake CTR-AW-005(2) 的"基准为实现时点当时 registry_version"规则，并叠加
本 Spec 特有的预留约束：`1.5.0` 已被 accepted forum-moderator authority 预留
（OBS-ASM-006），实现 MUST 跳过一切被 accepted Spec 预留的版本号（CTR-ASM-005）。
理由：版本号是 bundle 一致性的一部分；两个 accepted Spec 不得竞争同一版本。

### DEC-ASM-003 — audience 语义零产品化

auth-service 不理解 messaging/canonical-session 语义；所有产品语义归下游。与
wake CCR 的 CTR-AW-003 同构（CTR-ASM-003）。

## 8. Contracts

### CTR-ASM-001 — Frozen Audience entry

实现 MUST 在 `audience-registry.json` 追加恰一个 entry，逐字段等于：

```json
{
  "audience_id": "agent-session-messaging",
  "resource_service": "agent-session-messaging",
  "scope_namespace": "agent",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["agent.session.send"],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1; machine-only agent access for the canonical agent_session_send resource consumed by dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1."
}
```

既有 6 个 entry 与其余一切 bytes MUST NOT 改变（除 CTR-ASM-005 的版本字段）。

### CTR-ASM-002 — Exact single scope and forbidden set

唯一注册 scope = `agent.session.send`。以下 MUST 保持不注册：
`agent.session.read`、`agent.session.*`/通配、`agent.wake`、
`agent.definition.write`、任何 `workflow.*` / `forum.*` / `scheduler.*` /
`notification.*` / `okr.*` / `adc.*` / `auth.*` 新字面量、human 或 delegated
access 任何形式。`agent.session.send` 不得被推断为携带 send 以外的任何语义。

### CTR-ASM-003 — machine-only agent-profile token 语义边界

token 语义完全由既有 direct.ts 机械门禁承载（OBS-ASM-002）：resource 字面量
相等、machine enabled、agent profile（`agentId` 必携带）、principal type 包含、
MachineAccessGrant 存在、DB/registry 一致 fail-closed、grant scopes 子集。
本 CCR 不新增任何代码路径、profile 字段或错误码。

### CTR-ASM-004 — Exact 16-file implementation closure

实现闭包 = 恰以下 16 文件，`EXTRA_FILE_COUNT = 0`（NI closure V2
CTR-NIC2-001 同构，validate.mjs 为第 16 文件）：

```text
contract-bundles/minimal-auth-v1/audience-registry.json
contract-bundles/minimal-auth-v1/contract-manifest.json
contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json
contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
contract-bundles/minimal-auth-v1/metadata/change-log.md
contract-bundles/minimal-auth-v1/validate.mjs
src/lib/oauth/v1/contract.ts
tests/helpers/load-candidate-snapshot.ts
tests/oauth/candidate-contract.test.ts
tests/oauth/contract-runtime-v1.test.ts
```

`LIMITED_RUNTIME_COMPATIBILITY_CHANGE` 仅限：contract.ts allowlist 追加新版本
字面量；candidate loader helper 追加同一字面量；两个测试的版本期望旧值→新值。
不得改变 format-version、digest、lifecycle、signer、verifier、claim、
algorithm、introspection、fallback 或 error 行为。NO_IN_PLACE_DISGUISE = YES。

### CTR-ASM-005 — Versioned registry delta 与版本判定

实现 MUST 是 separately reviewed versioned delta：

1. 添加恰 CTR-ASM-001 的 entry 与 `agent.session.send` 注册；
2. 版本 = 恰一次 additive minor 晋升，基准为实现时点当时 registry_version，
   且 MUST 严格避开一切已被 accepted Spec 预留而尚未占用的版本号
   （authoring 时点：当前 1.4.0、1.5.0 被
   `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` 预留 → 实现值 = `1.6.0`，
   除非实现时点 1.5.0 已被占用，此时取其后下一个未预留 minor）；
   registry/manifest/fixtures MUST NOT 原地伪装不变；
3. 按 `validate.mjs` 的联动校验同步全部携带 `contract_version` 的 bundle
   文件（含 `registry_version`），并在 `metadata/change-log.md` 增加条目
   （记录本 SPEC_ID、entry 冻结值、fixtures 增补、版本判定与预留规避）；
4. validate.mjs 的唯一允许 delta = :395 first-wave Audience 集合字面量单行
   追加恰 `agent-session-messaging`（6 → 7 entries）；
5. 最终 `npm run contract:v1:validate` MUST 输出
   `MINIMAL_AUTH_V1_BUNDLE_VALID=true`，FREEZE/PRODUCTION/CONSUMER blocker
   计数与 1.4.0 基线 parity（FREEZE 0 / PRODUCTION 1 / CONSUMER 2）。

### CTR-ASM-006 — Positive / negative conformance

Bundle fixtures MUST 至少包含：

- POSITIVE：一个 agent-profile Direct Machine fixture（principal_type =
  agent、携带 agentId、aud = `agent-session-messaging`、scope =
  `agent.session.send`、MachineAccessGrant 存在、exact requested equality、
  grant subset）；
- NEGATIVE（全部 fail-closed，不发出 token）：unknown audience；
  human/service principal type 被拒；scope 缺失/越权/别名
  （`agent.session.read`、通配、`agent.session.send extra`）；grant 缺失；
  grant 超出 registered scopes；DB/registry mismatch；namespace 错误的
  scope（如 `session.send`）。

任何 negative 阶段 MUST NOT 执行 positive issuance（与下游 CTR-DEP-002
Phase A 的 negative-only 约束一致）。

### CTR-ASM-007 — 未来唯一已规划 Grant requirement 的形态（descriptive only）

下游部署链（dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
CTR-DEP-006）将另行 authorized：向 ONE named disposable source agent principal
授予恰 `(resource=agent-session-messaging, scope=agent.session.send)` 的
MachineAccessGrant，并以 terminal compensation REQUIRED 结束（canary 完成或
失败即 revoke 并证明 absent）。本 CCR 仅描述该形态，不创建、不授权、不预授
任何 Grant；本 CCR 的 acceptance 不构成任何 Grant activation。

### CTR-ASM-008 — 下游不修订裁定

本 CCR 不修改、不 supersede、不评论任何 dsh-agent-core authority 的 normative
body；下游对 `agent-session-messaging` / `agent.session.send` 字面量的引用
以本 CCR accepted head 为其 prerequisite 事实（OBS-ASM-007），不构成本 Spec
对下游的依赖。若下游字面量未来变化，必须走下游 own amendment + 本 CCR 的
独立 successor，不得静默漂移。

### CTR-ASM-009 — Lifecycle 动作零生产效果

本 Spec 的 authoring、独立评审、acceptance、（未来）实现闭包含并均不部署、
不写 production DB、不创建 AuthAudience 数据行（该行走 OBS-ASM-008 backfill
车辆的独立 operator 轮次）、不创建 Grant、不产生 token issuance 证据之外的
生产效果。production deployment（服务重启/snapshot 再生成）是 acceptance 与
实现合入后的 separately authorized operator 轮次。

## 9. Acceptance scheme

当前为 docs-only proposal：`status: proposed`、`implementation_authority:
none`、`production_apply_authority: none`。独立审计必须明确判断：bounded
child CCR 形式有效性、entry/scope 字段冻结完整性、16 文件闭包与版本判定规则
（含 1.5.0 预留规避）的可执行性、conformance 覆盖、零生产效果边界。若审计
判定需要更大改形，本 proposal = BLOCKED。

审计 PASS 后，Owner 对 exact reviewed head 作出接受决定。Lifecycle
transaction 的 exhaustive allowlist 仅为：

1. frontmatter `status: proposed -> accepted`、
   `implementation_authority: none -> contracts`（production_apply_authority
   保持 none——本 CCR 永不直接授权生产 apply）；
2. `accepted_date`、`accepted_by`、`accepted_reviewed_base`、
   `accepted_reviewed_spec_commit`、`acceptance_review_verdict` 五字段
   null -> 审计冻结值；
3. 标题下方 proposal banner 的 exact literal `FROM` → `TO` 替换；
4. `docs/specs/README.md` 本 Spec 行的 lifecycle 与 authority 两处同步。

除此之外，本文（含本节）与索引其他 bytes 全部冻结。Lifecycle commit 形成后，
必须由独立 Reviewer 对新 exact head 执行 `FINAL_HEAD_RECHECK = PASS`（delta
恰为 allowlist、normative semantic drift = NONE），通过后的 exact head 才可
merge。

Literal `FROM`：

```text
> **PROPOSED / NOT ACCEPTED.** 本文件只提出 agent_session_send 所需的最小
> auth-service Audience/Scope 注册 Authority（docs-only）。在独立审计 PASS、
> Owner 接受 exact head 并翻转 lifecycle 字段之前，本 Spec 无任何实现或生产
> 效力；authoring 轮不得修改 bundle/registry/代码/数据库/生产。
```

Literal `TO`：

```text
> **ACCEPTED / AUDIENCE-REGISTRATION AUTHORITY.** Owner、exact reviewed head
> 与 PASS verdict 只取本文件 frontmatter 的 accepted_by、
> accepted_reviewed_spec_commit 与 acceptance_review_verdict。本 acceptance
> 仅授权 CTR-ASM-004 冻结的 16 文件实现闭包与 CTR-ASM-005 的版本判定；
> Grant supply、DB backfill、deployment 与一切生产效果均为 separately
> authorized 轮次（CTR-ASM-007/009）。
```
