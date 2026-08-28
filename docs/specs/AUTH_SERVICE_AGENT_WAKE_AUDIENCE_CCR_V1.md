---
spec_id: AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/auth-service
  - Agent Wake OAuth audience and scope registration authority
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []  # DAG ROOT (WAKE -> 31 -> 14 -> 83 -> 87): this Spec
                          # pins NO external head and takes no authority from
                          # any proposed downstream artifact; downstream Specs
                          # (auth-service PR #31, svc-workflow PR #14,
                          # dsh-agent-core PR #83 / PR #87) may pin THIS
                          # Spec's final head, never the reverse.
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1

## 1. Goal

建立 Agent Wake（agent→agent 唤醒投递）所需的最小 OAuth authority：冻结一个
machine-only agent-profile Audience、一个精确 Scope，以及未来唯一已规划调用方的
Grant requirement 形态（本 CCR 不创建任何 Client / Grant）：

```text
AUDIENCE_ID              = agent-wake
RESOURCE_SERVICE         = agent-wake
SCOPE_NAMESPACE          = agent
REGISTERED_SCOPES        = [agent.wake]
ACCEPTED_PRINCIPAL_TYPES = [agent]
HUMAN_ACCESS_ENABLED     = false
MACHINE_ACCESS_ENABLED   = true
DELEGATED_ACCESS_ENABLED = false
```

`agent.wake` 允许持有该 Grant 的 **agent principal**（machine client，
principal_type = agent）为 agent-wake 资源换取 access token。产品接口语义
（唤醒投递、fresh-session admission 等）由下游资源消费方拥有；auth-service
只校验 Audience、Scope 与 Grant，不理解任何 wake 产品语义。

本轮是 **DOCS / AUTHORITY ONLY**：只创建 proposed CCR，不修改 Contract Bundle、
registry、产品代码、数据库或生产环境，不创建 principal/client/secret，不写
任何 Grant，不部署、不接受、不合并。

依赖方向（冻结）：本 Spec 是五 Spec 单向链的 **根节点**：

```text
WAKE（本 Spec）
  -> mayf3/auth-service PR #31（AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1）
    -> mayf3/svc-workflow PR #14（SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1）
      -> mayf3/dsh-agent-core PR #83（AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1）
        -> mayf3/dsh-agent-core PR #87（AGENT_CORE_HR_DISPATCHER_V1）
```

本 Spec 不规范性依赖上述任何下游 proposed Spec；下游职责只在 Non-goals /
context 中被描述（§2、OBS-AW-006、CTR-AW-004），不形成任何下游 authority
dependency 或 exact-head pin。

## 2. Scope and non-goals

### In scope

- 冻结唯一 Audience entry 的全部安全字段（CTR-AW-001）；
- 冻结唯一注册 Scope `agent.wake` 及其 auth-service 边界（CTR-AW-002/003）；
- 冻结 versioned registry delta、版本联动与 runtime 兼容边界（CTR-AW-005）；
- 冻结 positive / negative conformance（CTR-AW-006）；
- 冻结 exact implementation closure（16 文件封闭集合，CTR-AW-007）；
- 冻结未来唯一已规划 Grant requirement 的形态（descriptive，CTR-AW-004）；
- 冻结 lifecycle 动作零生产效果（CTR-AW-008）与上位文档不修订裁定（CTR-AW-009）。

### Non-goals

本 authority 不授予，也不允许从 `agent.wake` 推导：

- auth management、identity provisioning 或 token management；
- Agent Router generic authority（派发/admission/session 语义归下游消费方）；
- Scheduler authority（本 Audience 与 scheduler 面 zero 交集——下游
  dispatcher Spec 冻结 dispatcher 零 scheduler scope，此处同样不注册任何
  `scheduler.*` scope）；
- Workflow / Forum / 其他业务 authority；
- delegation / OBO authority；Human access；
- wildcard、prefix match 或通用 `agent.*` Grant；
- 未在本 CCR 注册的任何 `agent.*` scope（含 `agent.definition.write`——该
  scope 属于另一资源 `agent-definition` 的未来独立注册，见 OBS-AW-006；同一
  namespace 下不同 scope 字面量不构成复用，但均未获本 CCR 授权）。

本轮不修改 immutable accepted authority normative body，不修改 executable
registry，不执行 migration / backfill，不写 production database，不创建
principal / client / secret，不写任何 Grant，不部署。AuthAudience 数据行的
生产创建走既有 backfill 路径（OBS-AW-007），属于实现合入后的独立 operator
轮次，不属于本 CCR（CTR-AW-008）。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = d529bd3c28ece3967149ad793794f8dac2020276
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2 (accepted)
HISTORICAL_EXACTLY_INCORPORATED_GRAMMAR =
  docs/contracts/minimal-auth-v1/grants-and-audiences.md
  docs/contracts/minimal-auth-v1/claims-and-profiles.md
  docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
PATTERN_AUTHORITY (parent-CCR shape) =
  AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1 (accepted)
PATTERN_AUTHORITY (closure shape) =
  AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
  (accepted via PR #27 merge d529bd3)
DEPENDENCY_POSITION = ROOT of WAKE -> 31 -> 14 -> 83 -> 87
EXTERNAL_HEAD_PINS  = NONE
```

本 Spec 是新的 bounded child CCR，不 amend 或 supersede
`MINIMAL_AUTH_FOUNDATION_V2`，也不改写任何 accepted stable ID。V2 已
exact-incorporate V1 的 Audience Registry、MachineAccessGrant、agent/service
principal profile、严格 Scope rejection、versioned migration 与
same-transaction audit grammar；本 Child 只为新的资源服务命名最小 entry、
其注册实现闭包与未来 delta。

## 4. Current State

### STATE-AW-001 — 当前 accepted registry 不包含 agent-wake Audience

- Subject: Minimal Auth Contract `1.3.0` Audience Registry authority
- As-of commit: `d529bd3c28ece3967149ad793794f8dac2020276`（github/main）
- Observed at: 2026-08-27
- Basis: `OBS-AW-001`、`OBS-AW-002`

### STATE-AW-002 — Audience/Scope/Grant 生效需要 versioned delta

- Subject: accepted Minimal Auth Grant management and migration grammar
- As-of commit: 同上
- Observed at: 2026-08-27
- Basis: `OBS-AW-005`、`OBS-AW-008`

### STATE-AW-003 — agent-wake 的直接 token 路径今天结构性 fail-closed

- Subject: v1 direct machine token mint 对 resource `agent-wake` 的行为
- As-of commit: 同上（auth-service）；消费方坐标见 `OBS-AW-006`
- Observed at: 2026-08-27
- Basis: `OBS-AW-003`
- 含义：registry 无该 audience → `invalid_target`；即使人工造出 grant 行，
  DB/registry mismatch 亦 fail-closed。这是可接受的现状（与
  `agent-definition` 资源同构：先有 capability 形状、后有注册）。

## 5. Observations

全部 auth-service 观察基于
`mayf3/auth-service@d529bd3c28ece3967149ad793794f8dac2020276`（github/main，
2026-08-27 fetch 后 HEAD），方法为只读源码/`git show` 审计；dsh-agent-core
观察基于 `mayf3/dsh-agent-core@e40c140`（github/main，含 PR #82），方法相同。
生产数据库未被访问。

### OBS-AW-001 — Registry 现状

- Subject: `contract-bundles/minimal-auth-v1/audience-registry.json`
- Source revision: `auth-service@d529bd3`
- Observed at: 2026-08-27
- Method: 只读审计。
- Result: `registry_version = "1.3.0"`、`status = "frozen"`、恰 5 个
  audiences（svc-workflow / svc-okr / adc-v2 / svc-auth / svc-forum）；无
  `agent-wake`，无任何 `agent.*` scope 注册。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-002 — 上位 Contract Audience 清单现状

- Subject: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2
- Source revision: `auth-service@d529bd3`
- Observed at: 2026-08-27
- Method: 只读审计。
- Result: Bundle Audience 清单 = svc-workflow / svc-okr / adc-v2 / svc-forum
  （历史快照；NI closure 的 OQ-NIC-001 裁定该清单保持 V2 exact-incorporated
  历史快照不逐项追加，authority 由 accepted CCR + executable registry +
  change-log 携带）。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-003 — direct machine token 的 resource→audience 解析与门禁

- Subject: `src/lib/oauth/v1/direct.ts`
- Source revision: `auth-service@d529bd3`
- Observed at: 2026-08-27
- Method: 只读源码审计。
- Result（逐行）:
  - :86 以 `audience.audienceId === params.resource` 匹配 runtime registry
    ——**`resource` 字面量必须等于注册的 `audience_id`**；
  - :88 无匹配或 `!machineAccessEnabled` → `invalid_target /
    audience_not_machine_enabled`；
  - :70-77 `assertPrincipalProfile`：agent principal 必须携带 `agentId`
    （service principal 必须不携带）；
  - :108 `!acceptedPrincipalTypes.includes(principalType)` →
    `invalid_target / audience_profile_not_accepted`；
  - :112 无该 audience 的 MachineAccessGrant → `invalid_scope /
    machine_grant_missing`；
  - :113-115 DB `grant.audience` 行与 runtime registry 不一致 →
    `temporarily_unavailable / audience_registry_mismatch:<field>`
    （fail-closed）；
  - :113 grant.scopes ⊄ registeredScopes →
    `temporarily_unavailable / machine_grant_state_invalid`。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-004 — Scope namespace 机械规则

- Subject: `src/lib/oauth/v1/scope.ts`
- Source revision: `auth-service@d529bd3`
- Observed at: 2026-08-27
- Method: 只读源码审计。
- Result: :3 `SCOPE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$/`；
  :21-24 每个请求 scope 的首段（第一个 `.` 之前）必须等于该 audience 的
  `scope_namespace`，否则 `invalid_scope / scope_namespace_invalid`。因此
  注册 scope `agent.wake` **机械要求** `scope_namespace = "agent"`。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-005 — runtime snapshot 加载链与版本 allowlist

- Subject: `src/lib/oauth/v1/contract.ts`、`scripts/prepare-minimal-auth-v1.mjs`、
  `package.json`
- Source revision: `auth-service@d529bd3`
- Observed at: 2026-08-27
- Method: 只读源码审计。
- Result:
  - contract.ts :102 的 supported Contract-version allowlist 现为
    `['1.0.0', '1.1.0', '1.2.0', '1.3.0']`——**bundle 版本晋升必须同步
    该 allowlist**（NI closure 的 LIMITED_RUNTIME_COMPATIBILITY_CHANGE
    先例：另含 candidate loader helper 与两个 version-expectation 测试）；
  - runtime audience 定义从 `generated/minimal-auth-v1/runtime-contract.json`
    快照加载，快照由 `npm run contract:v1:prepare`（prepare-minimal-auth-v1.mjs，
    :46 读 `audience-registry.json`）从 bundle 生成——注册不需要新的产品
    读取路径；
  - `npm run contract:v1:validate` = bundle validator 真实命令。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-006 — 下游消费方（dsh-agent-core broker）的 resource/scope 机械形状

- Subject: `mayf3/dsh-agent-core@e40c140`（github/main）
  - `packages/broker/src/transport.js`
  - `packages/broker/src/gateway.js`
  - `packages/broker/src/capabilities/agent-definition.js`
- Observed at: 2026-08-27
- Method: 只读源码审计（跨仓 evidence 坐标，非 authority pin）。
- Result:
  - transport.js :13 语义冻结 "`client_credentials` grant（resource =
    target audience）"；`requestAccessToken` 以 form 参数发送
    `grant_type=client_credentials&resource=<...>&scope=<...>`；
  - gateway.js :161-191 local capability 的 Auth-grant 检查：
    `resource = manifest.local?.resource`、`scope = requiredScopes.join(' ')`
    ——**manifest 的 `local.resource` 字面量就是 token 请求的 audience**；
  - agent-definition.js :81 既有先例：`local: { resource: 'agent-definition' }`
    + `requiredScopes: ['agent.definition.write']`（该 audience 今天同样
    未注册 → 结构性 fail-closed 现状先例）；
  - 下游 proposed dispatcher Spec（dsh-agent-core PR #87 §4.1，**context
    引用，非本 Spec 的依赖**）冻结 `agent_wake` capability 为
    `local: { resource: 'agent-wake' }`、`requiredScopes: ['agent.wake']`
    ——与本 CCR 冻结的 AUDIENCE_ID / REGISTERED_SCOPES 字面量一致。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-007 — AuthAudience 数据行的既有创建车辆

- Subject: `scripts/backfill-minimal-auth-v1.ts`（`npm run contract:v1:backfill`）、
  `prisma/schema.prisma`
- Source revision: `auth-service@d529bd3`
- Observed at: 2026-08-27
- Method: 只读源码审计。
- Result:
  - backfill 以 runtime registry 为源规划 `audienceCreates` 并在事务内
    `tx.authAudience.create`（:67/:81）——**bundle 落地后 DB 行创建有既有
    车辆，无需 schema migration**；
  - schema.prisma :202-223 `model AuthAudience` 字段与 registry entry 字段
    一一对应（数据行插入，非 schema 变更）；`MachineAccessGrant.audience`
    FK 到该表。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-008 — 注册实现闭包与版本判定的 accepted 先例

- Subject: `docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1.md`
  （accepted via PR #27 merge d529bd3）
- Source revision: `auth-service@d529bd3`
- Observed at: 2026-08-27
- Method: 只读审计。
- Result:
  - 新 audience 注册的 exact closure = 15 文件（11 bundle + 4 runtime
    兼容联动：contract.ts allowlist、candidate loader helper、两个
    version-expectation 测试）；
  - 版本判定规则 = additive Audience/Scope registration 走 minor 晋升
    （1.1.0 / 1.2.0 / 1.3.0 先例）；NO_IN_PLACE_DISGUISE = YES；
  - 该 closure 已为 `agent-core-notification-ingress-v1` 判定 1.3.0 → 1.4.0，
    但截至 d529bd3 该实现尚未落 main（registry 仍 1.3.0）——**1.4.0 已被
    预留未占用**；
  - OQ-NIC-001：`grants-and-audiences.md` 历史 Audience 清单默认不逐项追加。
- Provenance: 本 Spec authoring 审计。

### OBS-AW-009 — NI 实现证据：first-wave Audience 集合 gate 使 validate.mjs 成为必要第 16 文件

- Subject: `contract-bundles/minimal-auth-v1/validate.mjs` :391-395
  first-wave Audience 集合字面量；NI 注册实现 draft
  `3c5b293a79a96a652f30add9017e4210c488e251`（branch
  `implement/notification-ingress-bundle-1.4.0`，2026-08-24；截至本修订
  轮未合入 main，main registry 仍 `1.3.0`——与 OBS-AW-008 一致）
- Source revision: `auth-service@3c5b293`（实现 draft；evidence 坐标，
  非 authority pin）
- Observed at: 2026-08-28（唤醒 修订轮）
- Method: 只读 `git show` 审计。
- Result:
  - validate.mjs :391-395 将 registry Audience 精确集合硬编码为
    `['adc-v2', 'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow']`
    并以 `registry: first-wave Audience set changed` 为失败信息——新增
    任何 Audience 而不改该行必然触发此 gate；
  - NI 实现 diff = 恰 16 文件 = accepted NI closure 冻结的 15 文件
    （OBS-AW-008）+ validate.mjs；validate.mjs 的唯一变更 = 该集合字面量
    单行追加 `agent-core-notification-ingress-v1`；
  - 该实现冻结的机械证据：不修改 validate.mjs 时，candidate bundle 的
    validator 失败 = `registry: first-wave Audience set changed`（唯一）；
    加入集合变化后 `MINIMAL_AUTH_V1_BUNDLE_VALID=true`，且其余 blocker
    计数与 1.3.0 基线一致（FREEZE 0 / PRODUCTION 1 / CONSUMER 2 parity）；
  - 含义：NI closure §4.3 对 validate.mjs 的 NOT_NECESSARY 分类（论据 =
    service profile 已强制、validator 未触碰即通过）遗漏了 first-wave
    集合 gate，被该实现证伪；OBS-AW-008 记录的 15 文件闭包作为「NI
    closure Spec 冻结了什么」的历史事实保持准确，但新 Audience 注册的
    executable truth = 16 文件。本 CTR 若不改闭包，机械上无法满足
    CTR-AW-005(5) 的 `MINIMAL_AUTH_V1_BUNDLE_VALID=true`。
- Provenance: 唤醒 审计 blocker 闭合的只读实现证据审计（2026-08-28）。

## 6. Claims and assumptions

### CLM-AW-001 — 一个 bounded child CCR 是必需且足够的注册权威

- Support state: SUPPORTED
- Supported by evidence: `OBS-AW-001`、`OBS-AW-002`、`OBS-AW-008`
- Contradicted by evidence: none known
- Uncertainty: none；audience 缺席 + accepted grammar 要求显式注册。

### CLM-AW-002 — 单 scope `agent.wake` 是最窄充分注册

- Support state: SUPPORTED
- Supported by evidence: `OBS-AW-006`（下游消费方机械形状恰为
  resource 'agent-wake' + scope 'agent.wake'）
- Contradicted by evidence: none known
- Uncertainty: none within the frozen wake-delivery boundary。

### CLM-AW-003 — 注册不需要 auth-service 产品代码语义变更（仅版本 allowlist 联动）

- Support state: SUPPORTED
- Supported by evidence: `OBS-AW-003`、`OBS-AW-005`、`OBS-AW-007`
- Contradicted by evidence: none known
- Uncertainty: 版本 allowlist / candidate loader / 测试期望的联动属
  LIMITED_RUNTIME_COMPATIBILITY_CHANGE（OBS-AW-008 先例），其精确边界由
  CTR-AW-005/007 冻结。

## 7. Evidence relations

### EVD-AW-001 — 缺席事实与 grammar 支持 CLM-AW-001

- Source observations: `OBS-AW-001`、`OBS-AW-002`
- Target: `STATE-AW-001`、`CLM-AW-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@d529bd3`，observed 2026-08-27
- Strength/sufficiency: exact for source authority at the authoring base
- Limitations: does not register or activate the Audience
- Provenance: accepted authority source

### EVD-AW-002 — 消费方机械形状支持 CLM-AW-002 与字段冻结

- Source observations: `OBS-AW-003`、`OBS-AW-004`、`OBS-AW-006`
- Target: `CLM-AW-002`、CTR-AW-001 字段值（audience/resource 字面量、
  namespace、agent profile）
- Relation: SUPPORTS
- Bound coordinates: `auth-service@d529bd3` + `dsh-agent-core@e40c140`
- Strength/sufficiency: 每个冻结字段都有源码行证（resource=audience 匹配、
  namespace=scope 前缀、agent profile 门禁）
- Limitations: 下游 PR #87 为 proposed；其 manifest 若变更字面量，需下游
  自行 AMEND 对齐本 CCR（方向：下游对齐上游）
- Provenance: 源码审计

### EVD-AW-003 — 版本与闭包先例支持 CLM-AW-003

- Source observations: `OBS-AW-005`、`OBS-AW-007`、`OBS-AW-008`
- Target: `CLM-AW-003`、CTR-AW-005、CTR-AW-007
- Relation: SUPPORTS
- Bound coordinates: `auth-service@d529bd3`
- Strength/sufficiency: exact for the accepted NI closure precedent
- Limitations: 未来实现若发现缺口，溢出闭包 = OWNER_DECISION_REQUIRED
- Provenance: accepted authority source

### EVD-AW-004 — NI 实现证据支持闭包修正（15 → 16 文件）

- Source observations: `OBS-AW-009`
- Target: `CTR-AW-007`（validate.mjs = PROVEN_NECESSARY 第 16 文件与
  单行冻结边界）、`ACC-AW-004`（validate.mjs gate 双侧判定）
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@3c5b293`（实现 draft evidence
  坐标；非 authority pin，未合入 main）
- Strength/sufficiency: 实现级机械证明（omission = 唯一 validator 失败；
  addition = VALID=true 且 blocker 计数与基线一致）
- Limitations: 仅证明第 16 文件的必要性；不授权任何第 17 文件
- Provenance: 只读 git 审计（2026-08-28 修订轮）

## 8. Decisions

### DEC-AW-001 — 注册唯一专用 agent Audience，字面量 `agent-wake`

- Decision owner: mayf3
- Decision: audience_id 与 resource_service 均为精确字面量 `agent-wake`
  （任务冻结值；与下游 broker manifest `local.resource` 字面量一致，
  OBS-AW-006）。
- Rejected alternative: 复用其他 audience；带版本后缀的字面量（如
  `agent-wake-v1`）——下游 manifest 已冻结 `agent-wake`，改字面量将要求
  下游 AMEND，无收益。
- Reason: cross-Audience Scope 复用被禁止；resource 边界必须确定。

### DEC-AW-002 — 只注册 `agent.wake`；namespace 机械取 `agent`

- Decision owner: mayf3
- Decision: namespace = `agent`（由 OBS-AW-004 的 prefix===namespace 规则
  机械决定，非猜测）；仅注册 `agent.wake`。
- Rejected alternative: wildcard、`agent.*`、或预注册
  `agent.definition.write` 等未来 scope。
- Reason: 最小注册面；未注册 scope 的 capability 保持结构性 fail-closed
  （`agent-definition` 现状同构，OBS-AW-006）。

### DEC-AW-003 — agent-only direct machine access

- Decision owner: mayf3
- Decision: accepted principal types 恰为 `[agent]`；machine access 开启；
  Human 与 Delegated 关闭。
- Rejected alternative: service/user profile 或 OBO。
- Reason: 唯一已规划调用方是专用 dispatcher 的 machine principal
（agent profile、携带 agentId，OBS-AW-003 :70-77/:108；其身份治理在下游
  auth-service PR #31——descriptive，非依赖）。

### DEC-AW-004 — 注册与 Grant 严格分离

- Decision owner: mayf3
- Decision: 本 CCR 冻结未来 Grant requirement 形态（CTR-AW-004）但零执行。
- Rejected alternative: 在注册 PR 中顺带创建 client / 写 Grant。
- Reason: credential 与 Grant lifecycle 需要独立审计的 operational
  authority（NI 先例 DEC-NI-004）。

### DEC-AW-005 — 闭包内联于本 CCR（语义 + closure 一体）

- Decision owner: mayf3
- Decision: 本 CCR 同时冻结注册语义（CTR-AW-001..004）与 exact
  implementation closure（CTR-AW-005..007），避免 NI 路径中 parent/closure
  两轮拆分带来的中间状态。
- Rejected alternative: 语义与闭包分两个 Spec。
- Reason: NI closure 先例已把闭包形状与版本边界机械定型，本 CCR 可直接
  镜像（闭包计数经 OBS-AW-009 实现证据修正为 16 文件）；拆分无新信息
  增益。
- 边界: 若独立评审发现闭包需要超出本 CCR 的 runtime 兼容面，溢出部分
  = OWNER_DECISION_REQUIRED，不得自行扩权。

### DEC-AW-006 — 版本判定为机械规则而非固定猜测值

- Decision owner: mayf3
- Decision: 恰一次 additive minor 晋升，基准 = 实现时点的当时
  registry_version；1.4.0 已被 NI 注册预留（authorized 未执行），
  故本 CCR 预期值 = NI 未落地时 1.4.0 / 已落地时 1.5.0，由实现时点机械
  决定。
- Rejected alternative: 硬编码单一期望版本。
- Reason: 两个已接受注册权威共享同一 bundle 版本轴；固定值会制造虚假
  冲突或静默抢先。

## 9. Contracts

### CTR-AW-001 — Exact Audience entry

任何未来 Contract Bundle / registry 实现在本权威下 MUST 产生恰如下 entry
（机器可比对；JSON 类型同样冻结）：

```json
{
  "audience_id": "agent-wake",
  "resource_service": "agent-wake",
  "scope_namespace": "agent",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["agent.wake"],
  "status": "active"
}
```

Bundle-specific lifecycle metadata（`freeze_ready`、`notes`）MAY 仅在
accepted schema 要求时添加，MUST NOT 改变上述冻结字段。`registered_scopes`
排序遵循无符号 ASCII byte 升序。

### CTR-AW-002 — Scope 语义与 auth-service 边界

`agent.wake` 对应的唯一资源语义 = 为 agent-wake 资源换取 direct machine
access token（供下游消费方做唤醒投递前的 Auth-grant 检查）。auth-service
MUST 将该 Scope 视为 opaque 注册字符串，MUST 只执行 exact
Audience/Scope/Grant 校验；MUST NOT 从其推导 Router、Scheduler、派发、
admission、session、Workflow、Forum、management、provisioning、
token-management、Human 或 delegation 语义。

### CTR-AW-003 — 严格非复用

其他 Audience 的任何 Scope（含 `auth.identity.provision`、
`workflow.read`、`forum.read`）MUST NOT 满足 `agent.wake`；`agent.wake`
MUST NOT 满足其他 Audience。wildcard（`*`）、prefix match、`agent.*`、
及任何未注册 `agent.*` scope（含 `agent.definition.write`）禁止。携带任何
未注册或未授权 Scope 的请求 MUST 整体失败；silent downscoping 禁止。

### CTR-AW-004 — 未来唯一已规划 Grant requirement（descriptive，零执行）

未来经独立审计的 credential/Grant 操作（唯一已规划调用方 = 下游
auth-service PR #31 治理的专用 dispatcher machine client）MUST 满足：

```text
audience      = agent-wake
scopes        = [agent.wake]
principal_type = agent（principal 携带 agentId = agt_workflow-dispatcher-hr-agent）
```

该 client MUST NOT 获得任何其他 wake scope、Human/delegated access 或任何
其他 Audience 的推导权限。Client 创建、secret 创建/交付与 Grant apply 均需
独立 reviewed operational authority（下游 identity Spec 的 PLAN/APPLY/VERIFY
轮次），本 CCR 不授权。此条为 downstream 计划的描述性冻结（context），
不构成对下游 proposed Spec 的依赖。

### CTR-AW-005 — Versioned registry delta 与版本联动

实现 MUST 是 separately reviewed versioned delta：

1. 添加恰 CTR-AW-001 的 entry 与 `agent.wake` 注册；
2. 版本 = 恰一次 additive minor 晋升，基准为实现时点当时 registry_version
   （DEC-AW-006：NI 注册未落地时 1.3.0→1.4.0；已落地时 1.4.0→1.5.0）；
   registry/manifest/fixtures MUST NOT 原地伪装不变
   （NO_IN_PLACE_DISGUISE = YES）；
3. 按 `validate.mjs` 的联动校验同步全部携带 `contract_version` 的 bundle
   文件，并在 `metadata/change-log.md` 增加条目（记录本 SPEC_ID、entry
   冻结值、fixtures 增补、版本判定）；
4. runtime 兼容联动精确限定为（NI closure CTR-NIC-003 同构）：
   `src/lib/oauth/v1/contract.ts` 仅新增晋升后版本字面量到 supported
   Contract-version allowlist；`tests/helpers/load-candidate-snapshot.ts`
   仅新增同一字面量（+匹配注释）；`tests/oauth/candidate-contract.test.ts`
   与 `tests/oauth/contract-runtime-v1.test.ts` 仅把版本期望从旧值改为新值；
   不得改变 format-version、digest、lifecycle、signer、verifier、claim、
   algorithm、introspection、fallback 或 error 行为；
5. 最终 `npm run contract:v1:validate` MUST 输出
   `MINIMAL_AUTH_V1_BUNDLE_VALID=true`。

### CTR-AW-006 — Positive / negative conformance

实现 MUST 增补（走 bundle 既有 fixtures 验证路径，MUST NOT 引入第二套
fixture 语义）：

- 正向 fixture `direct-agent-agent-wake`：Direct Machine profile、
  RS256 + tracked fixture `kid`、`iss = auth-service`、`aud = agent-wake`、
  `principal_type = agent`、`agent_id` 存在、`token_use = access`、
  `scope = "agent.wake"` 且 `requested_scope` 恰等、
  `machine_access_grants` 含 `agent-wake -> ["agent.wake"]`；
- 负向 cases 至少覆盖：service principal 与 user/human principal 对本
  Audience 的拒绝；delegated/OBO 尝试；wrong `aud`（含以
  `agent.definition.write` 借道）；wrong `iss`；unknown `kid`；missing
  `agent_id`；未注册 `agent.*` scope（含 `agent.definition.write` 与
  `agent.wake.admin` 类造词）；wildcard（`*`、`agent.*`）；跨 Audience
  复用（`workflow.read` / `forum.read` 对本 Audience）；超出 Grant 的
  extra scope（整请求拒绝）；namespace 违例（无前缀/错误前缀 scope）。

### CTR-AW-007 — Exact implementation closure（16 文件封闭集合）

accept 后的实现 PR MAY 修改且仅 MAY 修改以下文件（NI closure §4.3 同构
+ OBS-AW-009 实现证据修正；首个集合外文件 = `OWNER_DECISION_REQUIRED`）：

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

（构成 = 12 bundle + 4 runtime 兼容联动。）

`validate.mjs` 的分类 = **PROVEN_NECESSARY**（OBS-AW-009；修正 NI closure
§4.3 镜像继承的 NOT_NECESSARY 分类）。该文件唯一允许的语义变化 =
:395 first-wave Audience 集合字面量追加恰 `agent-wake`（单行；两侧排序仍
由 `.sort(asciiCompare)` 机械决定）。除此之外，实现 MUST NOT 修改该文件的：
validator 其他规则、blocker 计数逻辑、principal profile 校验、scope 校验、
digest / version 校验、其他 Audience 字面量、其他错误语义。

无 wildcard、目录、generated 输出或"相关文件"授权；实现若发现路径
rename/move，按 OWNER_DECISION 重新映射，不得模糊匹配。NI 实现证据
（OBS-AW-009）证明同一 Audience 集合 gate 必须修改 validate.mjs，但
MUST NOT 据此扩大闭包到任何第 17 个文件（EXTRA_FILE_COUNT = 0）。

### CTR-AW-008 — Lifecycle 零生产效果

本 CCR 的 proposal、review、acceptance 或 merge MUST NOT 被解释为 registry
激活、DB 写入、backfill 执行、credential 创建、Grant apply、部署或生产
生效。AuthAudience 生产数据行的创建走既有 backfill 车辆
（`npm run contract:v1:backfill` 的 audienceCreates 路径，OBS-AW-007），
属于实现合入 main 之后的独立 operator 轮次。

```text
PRODUCTION_GRANT_CHANGE = NONE
CREDENTIAL_CREATED      = NO
GRANT_APPLIED           = NO
DATABASE_CHANGE         = NONE (this round)
BACKfill_EXECUTED       = NO
```

### CTR-AW-009 — 上位文档不修订（沿 OQ-NIC-001 先例）

`docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2 的历史
Audience 清单默认不因本 CCR 逐项追加（V2 exact-incorporated 历史快照；
authority 由 accepted CCR + executable registry + change-log 携带）。
未来将该清单升级为 living list = separate V2-level owner decision。

## 10. Acceptance

### ACC-AW-001 — Exact entry comparison

- Contracts: `CTR-AW-001`
- Method: 机器比对未来 registry delta 的 agent-wake entry 与冻结 JSON
  （含类型、数组元素与排序）。
- Expected result: 全字段相等。
- Failure condition: 任一字段、类型、数组元素或排序偏离。

### ACC-AW-002 — Scope 隔离 negatives

- Contracts: `CTR-AW-002`、`CTR-AW-003`、`CTR-AW-006`
- Method: CTR-AW-006 全部负向 cases 的 conformance 执行。
- Expected result: 每一 case 无降级拒绝。
- Failure condition: 任何跨用、wildcard、推导授权或部分签发成功。

### ACC-AW-003 — Principal profile

- Contracts: `CTR-AW-001`、`CTR-AW-004`
- Method: 机器比对 registry profile（`["agent"]`、machine-only）与
  正向/负向 fixture 的 principal 形状。
- Expected result: agent + agentId 通过；service/user/human/delegated 拒绝。
- Failure condition: 任何非 agent profile 被接受。

### ACC-AW-004 — 版本与联动

- Contracts: `CTR-AW-005`、`CTR-AW-007`
- Method: `npm run contract:v1:validate` 在实现分支与合并后 main 执行；
  检查恰一次 minor 晋升与全部联动文件一致性。validate.mjs gate 双侧
  判定（OBS-AW-009 同构）：不修改 validate.mjs 的 candidate bundle
  （其余 delta 齐备）必须确定性失败
  `registry: first-wave Audience set changed`；随后加入恰
  `agent-wake` 集合变化（CTR-AW-007 冻结的单行 delta）重新执行。
- Expected result: `MINIMAL_AUTH_V1_BUNDLE_VALID=true`；无原地伪装；
  其余 validator blocker 计数与未注册前基线一致（NI 先例 parity：
  FREEZE 0 / PRODUCTION 1 / CONSUMER 2）。
- Failure condition: validator 报错、版本算术偏离、联动文件不一致、
  blocker 计数漂移，或 validate.mjs 出现 CTR-AW-007 冻结边界之外的
  任何变更。

### ACC-AW-005 — Runtime 兼容边界

- Contracts: `CTR-AW-005`(4)、`CTR-AW-007`
- Method: diff 审计 contract.ts / loader / 两测试的变更恰为版本字面量
  联动；`npm run test:contract-v1` 与 typecheck 通过。
- Expected result: 无任何语义/行为面变更。
- Failure condition: 闭包外文件被改或 allowlist 之外的行为变化。

### ACC-AW-006 — 无生产效果

- Contracts: `CTR-AW-008`
- Method: 实现 PR diff + operational record 审计。
- Expected result: 仅 16 文件闭包内变更；零 DB 写、零 credential、零
  Grant、零 deploy。
- Failure condition: 任何被禁止动作发生，或 lifecycle 被声称生产生效。

### ACC-AW-007 — 本 PR 自身 docs-only

- Contracts: 全部
- Method: 本 PR diff 审计。
- Expected result: 恰两个文件（本 Spec + docs/specs/README.md 索引行）。
- Failure condition: 任何其他文件被改。

## 11. Alternatives and disposition

### ALT-AW-001 — 复用既有 Audience（svc-auth / svc-workflow）

- Disposition: REJECTED
- Reason: cross-Audience Scope 复用被禁止；资源边界必须确定。

### ALT-AW-002 — 通用 `agent.*` 或多 scope 预注册

- Disposition: REJECTED
- Reason: 违反严格 Scope grammar 与最小权限；未注册 scope 保持
  fail-closed 是特性而非缺陷（`agent-definition` 同构现状）。

### ALT-AW-003 — service profile（同 notification-ingress）

- Disposition: REJECTED
- Reason: 调用方是 agent principal（专用 dispatcher machine client，
  携带 agentId）；profile 门禁按机械事实冻结（OBS-AW-003）。

### ALT-AW-004 — 在本 CCR 中创建 client / 写 Grant

- Disposition: REJECTED
- Reason: authority authoring 不是审计过的生产操作（DEC-AW-004）。

### ALT-AW-005 — 硬编码期望版本 1.4.0

- Disposition: REJECTED
- Reason: NI 注册已预留 1.4.0（authorized 未执行）；固定值制造虚假冲突
  或静默抢先（DEC-AW-006）。

## 12. Migration, compatibility, and rollback

```text
MIGRATION_THIS_ROUND = NONE
DATABASE_CHANGE      = NONE
PRODUCTION_CHANGE    = NONE
CREDENTIAL_CREATED   = NO
GRANT_APPLIED        = NO
ROLLBACK_THIS_ROUND  = delete/revise proposed branch before acceptance;
                       no runtime state exists
```

未来实现按 CTR-AW-005/007；生产 AuthAudience 行创建（backfill operator
轮次）在任何 Grant apply（下游 identity Spec 轮次）之前完成即可——顺序
由下游 precheck 强制（其 §3.2 fail-closed 语义）。回滚 = revert 实现
commit（bundle 单一 revert 即恢复先前一致状态；DB 行若已 backfill，
由同一车辆的反向操作处理，属 operator 轮次）。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS   = NONE
NORMATIVE_TBD          = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION   = NONE
READY_FOR_SEQUENTIAL_REVIEW  = YES (root of WAKE -> 31 -> 14 -> 83 -> 87)
```

## 14. Frozen summary

```text
SPEC_ID = AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1
SPEC_FILE = docs/specs/AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1.md
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none

AUDIENCE_ID              = agent-wake
RESOURCE_SERVICE         = agent-wake
SCOPE_NAMESPACE          = agent
REGISTERED_SCOPES        = [agent.wake]
ACCEPTED_PRINCIPAL_TYPES = [agent]
HUMAN_ACCESS_ENABLED     = false
MACHINE_ACCESS_ENABLED   = true
DELEGATED_ACCESS_ENABLED = false
FORBIDDEN_SCOPES         = agent.*, *, 及 agent.wake 之外任何 scope

DEPENDENCY_POSITION = ROOT of WAKE -> 31 -> 14 -> 83 -> 87
EXTERNAL_HEAD_PINS  = NONE
CIRCULAR_AUTHORITY_PIN_COUNT (this Spec) = 0

IMPLEMENTATION_CLOSURE_FILES = 16 (CTR-AW-007; 12 bundle + 4 runtime)
IMPLEMENTATION_CLOSURE_COUNT = 16
VALIDATE_MJS_INCLUDED = YES
VALIDATE_MJS_CLASSIFICATION = PROVEN_NECESSARY (OBS-AW-009)
EXTRA_FILE_COUNT = 0
VERSION_RULE = exactly one additive minor above then-current registry_version
PRODUCTION_GRANT_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
PRODUCT_CODE_CHANGE = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
MERGE_PERFORMED = NO
```
