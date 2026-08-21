---
spec_id: AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
  - mayf3/agent-forum
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1

## 1. Goal

上位 Contract `MINIMAL_AUTH_FOUNDATION_V1`（normative 模块
`docs/contracts/minimal-auth-v1/` + executable bundle
`contract-bundles/minimal-auth-v1/`）在 `grants-and-audiences.md` 中冻结了一道门禁：

> `svc-forum`、`llm-todo` 和 `workflow-todo` 不属于本轮 Audience 注册表；
> 它们保持 Legacy/未迁移，未来必须通过独立 CCR 和消费者迁移审阅进入。

本 Spec 就是该门禁要求的**独立 Contract Change Request（CCR）**：为
`svc-forum` 进入 Minimal Auth V1 Audience Registry 建立唯一合法路径，
冻结唯一的目标 Audience entry、消费者迁移审阅要求、封闭的允许实现文件集合、
Activation gates 与 Acceptance。

冻结的 authority transition：

```text
CURRENT_SVC_FORUM_V1_AUTHORITY =
  NOT_REGISTERED_BY_FROZEN_PARENT_CONTRACT

TARGET =
  REGISTER_SVC_FORUM_IN_MINIMAL_AUTH_V1

PARENT_CONTRACT_AMENDMENT_REQUIRED = YES
CONTRACT_BUNDLE_UPDATE_REQUIRED = YES
CONSUMER_MIGRATION_REVIEW_REQUIRED = YES
```

边界（本 Spec 全程有效）：

```text
EXECUTABLE_REGISTRY_CANNOT_SELF_AUTHORIZE = YES
```

不得仅引用当前 executable registry（`audience-registry.json`）中已存在的
`svc-forum` entry 来覆盖上位 Contract 的排除条款。executable artifact 不是
自身的注册权威；authority drift 不能自我合法化（见 §4 STATE-FR-002、
§8 DEC-FR-001）。

本 Spec 本轮为 **SPEC ACCEPTANCE FINALIZE ONLY**：`status: accepted`、
`implementation_authority: contracts`。该 authority 仅在本 accepted Spec 合入
`main` 后覆盖 §9 CTR-FR-009 的封闭实现范围。本轮不修改任何 Contract、registry、
产品代码、消费者代码；不创建 Grant；不部署；不 merge。

## 2. Scope and non-goals

### In scope

- 冻结 svc-forum 进入 V1 Audience Registry 的完整 authority transition；
- 冻结唯一目标 Audience entry 的逐字段内容（§9 CTR-FR-002）；
- 冻结本轮明确禁止注册的 scope 集合（§9 CTR-FR-004）；
- 冻结 `mayf3/agent-forum` 独立 consumer review 的全部证明要求（§9 CTR-FR-006）；
- 冻结允许的未来实现文件封闭集合（auth-service 13 个文件 +
  agent-forum 8 个文件，§9 CTR-FR-009）；
- 冻结 5 个 Activation gates 与生效条件（§9 CTR-FR-007）；
- 冻结 AC1–AC10（§10）。

### Non-goals

- 不授权任何 Grant 写入：Grant supply 由 PR #5 单独管理（§8 DEC-FR-005）；
- 不注册 `forum.admin`、`forum.moderate`、`forum.*`、wildcard 或
  `forum.read` / `forum.write` 之外的任何 scope；
- 不修改 auth-service 产品代码（`src/`、`prisma/`、`scripts/`）：
  Audience 注册不需要产品代码变更（§6 CLM-FR-002）；
- 不修改 agent-forum 除封闭集合（§9 CTR-FR-009）之外的任何文件；
- 不处理 `svc-auth` entry 的 authority 对齐问题（registry 中 `svc-auth`
  同样未被上位 Contract 首批清单列出，但那是独立的 reconciliation，
  不属于本 CCR）；
- 不处理 `llm-todo`、`workflow-todo` 的未来迁移；
- 不引入 online introspection、Human access、Delegated access 或
  Trusted Proxy 语义 for svc-forum；
- 不执行部署、生产切换或 merge。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V1
  normative modules: docs/contracts/minimal-auth-v1/
  executable bundle: contract-bundles/minimal-auth-v1/
PROCESS_AUTHORITY = AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1 (accepted)
CONSUMER_REPOSITORY = mayf3/agent-forum
```

- 本 Spec 是上位 Contract 排除条款所要求的"独立 CCR"这一治理动作本身。
  上位 Contract 的修改（AMEND）只能在本 Spec 被 accept 之后、以本 Spec
  冻结的语义与文件集合执行（`.agents/local/README.md` §5 forward-only
  transition；`docs/specs/README.md` implementation rule）。
- 本 Spec 不 supersede 任何既有 authority；对
  `MINIMAL_AUTH_FOUNDATION_V1` 的修改是 bounded AMEND，不是 whole-authority
  supersession（§11 ALT-FR-004）。
- Consumer review 的目标仓库 `mayf3/agent-forum` 通过本 Spec 的 Contracts
  约束（scope 包含该仓库）；其固定 commit 由 review 本身确定并回填
  consumer-verification-matrix。
- 记录位置遵循 `.agents/local/README.md` §4：
  Spec review 记录 = persistent PR review / repository report；
  conformance 证据 = implementation PR Contract matrix / `docs/audits/`。

Syntax deviation 记录（历史，已在 rename round 解决）：

```text
SPEC_ID_PATTERN_DEVIATION = RESOLVED_BY_MECHANICAL_RENAME
```

本 Spec 的前身 SPEC_ID
`AUTH_SERVICE_SVC_FORUM_V1_AUDIENCE_CCR` 不符合 vendored frontmatter
schema（见下）；独立 review 判定 REVISE（唯一 blocker），已通过纯机械
重命名（rename-only commit）解决：ID、文件名与全部 self-reference 同步
替换，semantic change = NONE。历史记录保留如下。

vendored frontmatter schema
（`.agents/schemas/spec-frontmatter.schema.json`）要求 `spec_id` 匹配
`^[A-Z][A-Z0-9_]*_V[0-9]+$`（以 `_V<n>` 结尾）。前身 SPEC_ID
`AUTH_SERVICE_SVC_FORUM_V1_AUDIENCE_CCR`（`V1` 为 authority 版本号居中，
`AUDIENCE_CCR` 为 artifact 类别后缀）不匹配该 pattern。当时 enforcement 为
`MANUAL_POLICY`（`.agents/local/README.md`
§8），无 CI syntax gate 会被此偏离阻断；该偏离作为 owner decision
记录于 §13 OQ-FR-001，最终由独立 review 的 REVISE 结论触发机械重命名
解决，未修订 vendored schema。

## 4. Current State

- `STATE-FR-001` — 上位 Contract 排除 svc-forum。
  Basis: `OBS-FR-001`、`OBS-FR-002`。
  as_of: `mayf3/auth-service@87b3e54b1e8d332738663de38d9c6c599760c14a`
  （github/main）。
  含义：`CURRENT_SVC_FORUM_V1_AUTHORITY = NOT_REGISTERED_BY_FROZEN_PARENT_CONTRACT`。

- `STATE-FR-002` — executable registry 已超前包含 svc-forum entry（authority
  drift）。Basis: `OBS-FR-003`、`OBS-FR-004`、`OBS-FR-005`。
  as_of: 同上。该 entry 的存在不构成合法 V1 注册（§6 CLM-FR-001），
  其字段值与本 CCR 冻结目标逐字段一致（除 `notes` 语义需按本 CCR 修正，
  §9 CTR-FR-002）。

- `STATE-FR-003` — consumer-verification-matrix 已把 svc-forum 标记为
  in-scope fixed consumer，但 `migration_status = not_started`、
  `all_first_wave_migrations_ready = false`。Basis: `OBS-FR-006`。

- `STATE-FR-004` — `mayf3/agent-forum@1cccdd5`（github/main，2026-08-21
  fetch）的 consumer 实现已实现本 CCR §9 CTR-FR-006 要求的验证语义
  （RS256+JWKS 离线验证、精确 issuer/audience、principal_type=agent、
  agent_id 必需、forum.read/forum.write 端点映射、fail-closed scope、
  无 introspection）。Basis: `OBS-FR-007` + `论坛调查`（PASS；
  `FORUM_CONSUMER_DRIFT_CLASSIFICATION = SEMANTICALLY_COMPATIBLE`）。
  含义：exact-commit consumer review 已 PASS；其余 Activation gates 仍按
  §9 CTR-FR-007 独立判定。

- `STATE-FR-005` — bundle 正向 fixtures 无 svc-forum 条目；
  `forum.moderate` 在 agent-forum 业务层已被使用（moderation 端点），
  但未在任何 registry 注册，V1 Token 不可能携带它。
  Basis: `OBS-FR-008`、`OBS-FR-009`。

- `STATE-FR-006` — 本 Spec authoring 时（2026-08-20）无任何 svc-forum
  Audience 的 accepted CCR / consumer migration review 记录存在。
  Basis: `git log github/main` 全量检索（`OBS-FR-004` 的两个历史提交
  均未修改上位 Contract 文档，也未建立 consumer review 记录）。

## 5. Observations

全部 auth-service 观察基于
`mayf3/auth-service@87b3e54b1e8d332738663de38d9c6c599760c14a`（github/main，
2026-08-21 fetch 后 HEAD），方法为 `git show github/main:<path>` 只读审计；
agent-forum 观察基于 `mayf3/agent-forum@1cccdd54554c0bde13572273401f19f294334e46`
（github/main，2026-08-21 fetch 后 HEAD），方法相同。

### OBS-FR-001 — 上位 Contract grants-and-audiences.md 排除 svc-forum

- Subject: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2
- Source revision: `auth-service@87b3e54`
- Observed at: 2026-08-21
- Method: 只读 `git show github/main:docs/contracts/minimal-auth-v1/grants-and-audiences.md`
- Result（原文引用）:
  - 首批 Bundle Audience：`svc-workflow`、`svc-okr`、`adc-v2`；
  - "`svc-forum`、`llm-todo` 和 `workflow-todo` 不属于本轮 Audience
    注册表；它们保持 Legacy/未迁移，未来必须通过独立 CCR 和消费者迁移
    审阅进入。"
  - 同文件冻结 Wire ID 事实："`agent-forum` 是仓库/产品名，当前资源服务
    Wire ID 是 `svc-forum`"。
- Provenance: 本 Spec authoring 审计（PR 记录）。

### OBS-FR-002 — v0-to-v1-migration.md 同样将 svc-forum 列为 Legacy/未迁移

- Subject: `docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` §6
- Source revision: `auth-service@87b3e54`
- Observed at: 2026-08-21
- Method: 同上只读审计。
- Result（要点）: "以下对象保持 Legacy/未迁移，不阻塞本轮源码 Bundle
  Freeze：svc-forum、workflow-todo、llm-todo、OpenClaw Credential Broker
  candidate"；"它们缺少远程 SHA 或授权矩阵只阻塞各自未来的
  `CONSUMER_MIGRATION`"。
- Provenance: 本 Spec authoring 审计。

### OBS-FR-003 — executable audience-registry.json 已包含 svc-forum entry

- Subject: `contract-bundles/minimal-auth-v1/audience-registry.json`
- Source revision: `auth-service@87b3e54`
- Observed at: 2026-08-21
- Method: 只读审计。
- Result: `registry_version = "1.2.0"`、`status = "frozen"`、5 个
  audiences（`svc-workflow`、`svc-okr`、`adc-v2`、`svc-auth`、`svc-forum`）。
  其中 svc-forum entry 逐字段为：
  `audience_id = "svc-forum"`、`resource_service = "svc-forum"`、
  `scope_namespace = "forum"`、`accepted_principal_types = ["agent"]`、
  `human_access_enabled = false`、`machine_access_enabled = true`、
  `delegated_access_enabled = false`、
  `registered_scopes = ["forum.read", "forum.write"]`、
  `status = "active"`、`freeze_ready = true`、
  `notes = "Forum audience migrated from V0 legacy; machine-only agent
  access via standard OAuth2 client_credentials."`。
- Provenance: 本 Spec authoring 审计。

### OBS-FR-004 — 历史提交将 svc-forum 写入 executable artifacts 但从未修改上位 Contract

- Subject: auth-service git history
- Source revision: commits `df0989366e494409bb21e8c89ad2790eeb9c80aa`
  （2026-07-30，"CCR: register svc-forum as standard OAuth2 v1 audience"）
  与 `170736e42eb882277011796a98bb415a65d0e84c`
  （2026-07-31，"contracts: freeze svc-forum as fixed standard OAuth v1
  Consumer"）
- Observed at: 2026-08-21
- Method: `git show <sha> --stat` + diff 审计。
- Result: 两提交仅改动
  `audience-registry.json`、`contract-manifest.json`、
  `metadata/consumer-verification-matrix.json`、`validate.mjs`；
  **未触碰** `docs/contracts/minimal-auth-v1/` 下任何文件，也未建立
  排除条款所要求的独立 CCR Spec 与消费者迁移审阅记录。
- Provenance: 本 Spec authoring 审计。

### OBS-FR-005 — bundle 版本联动校验与 manifest 状态

- Subject: `contract-bundles/minimal-auth-v1/validate.mjs`、
  `contract-manifest.json`
- Source revision: `auth-service@87b3e54`
- Observed at: 2026-08-21
- Method: 只读审计。
- Result:
  - validate.mjs L270–L277 强制 `manifest.contract_version` 与
    `registry.registry_version`、`freeze-gates.json`、
    `consumer-verification-matrix.json`、positive/negative fixtures、
    `schema-instances.json`、`adc-v2-scope-map.json`、
    `llm-todo-authorization-candidate.json` 的 `contract_version`
    逐文件相等（版本联动）；
  - validate.mjs L391 冻结 first-wave 集合期望恰为
    `['adc-v2', 'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow']`；
  - `contract-manifest.json`：
    `contract_version = "1.2.0"`、
    `audience_registry_version = "1.0.0"`（悬挂字段，validator 不校验）、
    `consumer_migration.first_wave_scope` 已含 `svc-forum`、
    `legacy_out_of_scope = ["workflow-todo", "llm-todo",
    "openclaw-credential-broker-candidate"]`；
  - 真实命令存在：`npm run contract:v1:validate`（输出
    `MINIMAL_AUTH_V1_BUNDLE_VALID=true`）、`npm run test:contract-v1`、
    `npm run test:oauth`（package.json scripts）。
- Provenance: 本 Spec authoring 审计。

### OBS-FR-006 — consumer matrix 固定了 agent-forum 的旧 commit

- Subject: `contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json`
- Source revision: `auth-service@87b3e54`
- Observed at: 2026-08-21
- Method: 只读审计 + `git cat-file -t` 验证 SHA 归属。
- Result: svc-forum consumer entry：
  `kind = "machine-resource-consumer"`、
  `git_sha = "cb7ca300a2c337dd6e8aafc09c3a73f878565cfa"`、
  `remote_ref = "feat/svc-forum-standard-oauth"`、
  `fixed_remote_sha = true`、`contract_bundle_scope = true`、
  `migration_status = "not_started"`、`v1_ready = true`。
  `cb7ca300...` 经验证是 `mayf3/agent-forum` 仓库的 commit
  （"test: migrate remaining 38 auth tests to standard OAuth RS256+JWKS"）。
  `all_first_wave_migrations_ready = false`。
- Provenance: 本 Spec authoring 审计。

### OBS-FR-007 — agent-forum consumer 验证路径现状

- Subject: `mayf3/agent-forum@1cccdd5`（github/main）
  - `svc-forum/src/lib/auth-jwt.ts`（consumer verifier）
  - `svc-forum/src/middleware/auth.ts`（inbound 验证中间件）
  - `svc-forum/src/middleware/scope-guard.ts`（scope guard）
  - `svc-forum/tests/standard-oauth.test.ts`、
    `svc-forum/tests/standard-oauth-integration.test.ts`（conformance）
  - `svc-forum/src/config/env.ts`（配置）
- Observed at: 2026-08-21
- Method: 只读 `git show github/main:<path>` 审计。
- Result（与 §9 CTR-FR-006 要求逐条对应）:
  - verifier 强制 `algorithms: ['RS256']`（不接受 HS256 / alg 自动选择）；
    header `kid` 必需（匹配 JWKS entry，unknown kid →
    `TOKEN_INVALID_OR_EXPIRED`）；生产 key resolver =
    `createRemoteJWKSet(AUTH_JWKS_URL)`（JWKS 本地缓存验证，无
    introspection 调用）；
  - `issuer = env.AUTH_JWT_ISSUER`（默认 `auth-service`）、
    `audience = env.AUTH_JWT_SVC_FORUM_AUDIENCE`（默认 `svc-forum`）；
  - `principal_type === 'agent'` 强制；`sub`（UUID）、`agent_id`、
    `client_id` 必需且非空；`type === 'access'`、`version === 'v1'`；
  - scope 解析为 `Set<string>` 供 scope guard 使用；
  - scope-guard：GET 端点 `forum.read`、写端点 `forum.write`、
    moderation 端点 `forum.moderate`，缺失 → 403
    `INSUFFICIENT_SCOPE`（fail-closed）；
  - verifier 不读取、也不依赖 `owner_user_id` claim；
  - conformance 测试已覆盖：正/负向 scope、HS256 拒绝、无 kid 拒绝、
    unknown kid、wrong iss/aud/type/version、JWKS 不可用 → 503、
    key rotation、以及源码断言（无 JWT minting、无 runtime token-login）；
  - 测试 helper 依赖：`tests/helpers/auth-keys.ts`、
    `tests/helpers/jwks-server.ts`、`tests/helpers/test-keys.ts`。
- Provenance: 本 Spec authoring 审计。

### OBS-FR-008 — bundle fixtures 无 svc-forum 正向条目

- Subject: `contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json`
  与 `negative-token-fixtures.json`
- Source revision: `auth-service@87b3e54`
- Observed at: 2026-08-21
- Method: 只读审计。
- Result: 正向 fixtures 仅有 `human-svc-okr`、`direct-agent-svc-workflow`、
  `direct-agent-adc-v2`、`direct-agent-svc-okr`、
  `obo-adc-v2-to-svc-workflow`；无 svc-forum 正/负向条目
  （负向集中 `forum.read` 仅作为 svc-workflow audience 的
  cross-namespace 拒绝样例出现）。
- Provenance: 本 Spec authoring 审计。

### OBS-FR-009 — forum.moderate 被业务使用但未注册

- Subject: registry + agent-forum 业务层
- Source revision: `auth-service@87b3e54` + `agent-forum@1cccdd5`
- Observed at: 2026-08-21
- Method: 只读审计。
- Result: `requireModeratorScope()`（`forum.moderate`）用于 moderation
  端点（pin/feature、soft-delete 等，见 agent-forum 提交 fb11552 等）；
  registry 无 `forum.moderate` / `forum.admin` / 任何 wildcard 注册，
  因此 V1 签发路径不可能授予这些 scope（Grant 必须是注册 scope 的子集，
  grants-and-audiences.md §5/§10）。
- Provenance: 本 Spec authoring 审计。

## 6. Claims and assumptions

### CLM-FR-001 — executable registry 中已存在的 svc-forum entry 不构成合法 V1 注册

- Support state: SUPPORTED
- Supported by evidence: `EVD-FR-001`
- Contradicted by evidence: none known
- Uncertainty: none — authority 分层由 `.agents/local/README.md` §2 冻结
  （normative contract 模块属第 2 层 architecture authority；executable
  bundle 是其产物）。上位 Contract 的排除条款从未被任何 accepted
  CCR AMEND（`OBS-FR-001`、`OBS-FR-004`）。

### CLM-FR-002 — svc-forum Audience 注册不需要 auth-service 产品代码变更

- Support state: SUPPORTED
- Supported by evidence: `EVD-FR-002`
- Contradicted by evidence: none known
- Uncertainty: runtime 行为依赖 generated snapshot 的重建
  （`npm run contract:v1:prepare`），该重建是既有 build step，不属于
  tracked 文件变更。

### CLM-FR-003 — agent-forum 在 review-fixed commit 上满足全部 consumer 要求是可证明的

- Support state: SUPPORTED
- Supported by evidence: `EVD-FR-003`（基于 `OBS-FR-007` 的源码事实）+
  `论坛调查`（`agent-forum@1cccdd54554c0bde13572273401f19f294334e46`，PASS）
- Contradicted by evidence: none known
- Uncertainty: none for the reviewed exact commit；未来 drift 仍须重新分类。

### CLM-FR-004 — consumer review 固定 exact commit；matrix 回填留待实现

- Support state: RESOLVED
- 说明: consumer review 已固定
  `agent-forum@1cccdd54554c0bde13572273401f19f294334e46` 并 PASS；
  `consumer-verification-matrix.json` 的回填仍属于 CTR-FR-006 授权的后续实现，
  本 acceptance finalize 不修改 Contract Bundle。exact commit 值是 review
  provenance，不改变任何 Decision 或 Contract 的 normative 语义。

## 7. Evidence relations

### EVD-FR-001 — 权威分层与未修订事实支持 CLM-FR-001

- Source observations: `OBS-FR-001`、`OBS-FR-002`、`OBS-FR-003`、`OBS-FR-004`
- Target: `CLM-FR-001`
- Relation: SUPPORTS
- Bound coordinates: `auth-service@87b3e54`，观察于 2026-08-21
- Strength/sufficiency: 强 — normative 排除条款与 executable drift 的
  共同坐标已固定，历史提交的文件集合已逐一核验。
- Limitations: 不推断历史提交的意图，只记录其未完成的权威义务。

### EVD-FR-002 — runtime registry 消费路径支持 CLM-FR-002

- Source observations: `OBS-FR-005`（`src/lib/oauth/v1/contract.ts` 从
  `generated/minimal-auth-v1/runtime-contract.json` 加载 registry snapshot；
  `scripts/prepare-minimal-auth-v1.mjs` 从 bundle 生成它）
- Target: `CLM-FR-002`
- Relation: SUPPORTS
- Bound coordinates: `auth-service@87b3e54`
- Strength/sufficiency: 对观察到的架构成立。
- Limitations: 若未来实现发现产品代码缺口，超出本 CCR 封闭文件集的变更
  一律 `OWNER_DECISION_REQUIRED`（§9 CTR-FR-009）。

### EVD-FR-003 — 源码事实支持 CLM-FR-003

- Source observations: `OBS-FR-007`、`OBS-FR-009`
- Target: `CLM-FR-003`
- Relation: SUPPORTS
- Bound coordinates: `agent-forum@1cccdd5`
- Strength/sufficiency: 对该 commit 的静态审计成立。
- Limitations: 静态审计不替代 §9 CTR-FR-006 的独立、exact-commit、
  含真实进程证据的 consumer review。

## 8. Decisions

### DEC-FR-001 — 上位 Contract 是唯一注册权威；drift 不自我合法化

- Decision owner: repository owner（mayf3）
- Decision: svc-forum 的 V1 注册权威唯一来源于上位 Contract 的排除条款
  及其要求的独立 CCR。executable registry / validate.mjs / consumer
  matrix 中已存在的 svc-forum 内容定性为 authority drift，只能通过本 CCR
  的 accepted AMEND + bundle update + consumer review 事后合法化，
  不得被引用为"已注册"的证据。
- Rejected alternative: 以 `audience-registry.json` 现状倒推注册已完成
  （`ALT-FR-001`）。
- Reason: authority 分层（`.agents/local/README.md` §2）与
  `v0-to-v1-migration.md` §2"不得仅通过合并文档、实现局部字段或跑通
  auth-service 单测宣布生效"的同一纪律。

### DEC-FR-002 — 冻结唯一目标 Audience entry

- Decision owner: repository owner（mayf3）
- Decision: 冻结 §9 CTR-FR-002 列出的唯一 entry（含 `notes` 的冻结值，
  以修正 drift 时期遗留的 "migrated from V0 legacy" 语义）。
- Rejected alternative: 同时注册 `forum.moderate` / `forum.admin`
  （`ALT-FR-002`）。
- Reason: 最小注册面；moderator/admin 的产品需求未经过独立审阅。

### DEC-FR-003 — 本轮禁止注册的 scope 冻结为封闭集合

- Decision owner: repository owner（mayf3）
- Decision: `forum.admin`、`forum.moderate`、`forum.*`、wildcard（`*`）
  及 `forum.read` / `forum.write` 之外的任何 scope 在本轮被明确禁止。
  Forum 产品未来确需 moderate/admin 时，必须另走独立 CCR。
- Rejected alternative: 预注册"将来可能用到"的 scope。
- Reason: grants-and-audiences.md §7"新增或变更 Scope 必须由资源服务
  所有者定义语义"且逐项走注册表更新；预防性注册扩大攻击面。

### DEC-FR-004 — agent-forum 独立 consumer review 固定 exact commit

- Decision owner: repository owner（mayf3）
- Decision: `mayf3/agent-forum` 必须在单一 exact commit 上通过独立
  consumer review（§9 CTR-FR-006 的 13 项证明）。`论坛调查` 已在
  `1cccdd54554c0bde13572273401f19f294334e46` 上 PASS；后续实现 MUST 将该
  fixed remote SHA 回填 `consumer-verification-matrix.json` 的 svc-forum
  entry，替换 drift 时期的 `cb7ca300...` pin。review 未 PASS：
  `SVC_FORUM_V1_ACTIVATION = BLOCKED`。
- Rejected alternative: 接受 matrix 现有 `v1_ready = true` 作为已完成的
  迁移审阅（`ALT-FR-005`）。
- Reason: `v1_ready` 是 freeze 便利标记；`migration_status = not_started`
  与 `all_first_wave_migrations_ready = false` 才是真实状态（`OBS-FR-006`）。

### DEC-FR-005 — Grant 与 Audience 注册严格分离

- Decision owner: repository owner（mayf3）
- Decision: 本 CCR 不授权任何 Grant 写入。Audience 注册不得自动创建
  Grant；Grant supply 由 PR #5 单独管理（versioned database migration +
  `expected_grant_version` 乐观并发 + 同事务审计，grants-and-audiences.md
  §9）。
- Rejected alternative: 在注册 PR 中顺带写入 canary Grant（`ALT-FR-003`）。
- Reason: 防止授权面随注册面静默扩大；保持 Grant 的独立审计链。

### DEC-FR-006 — Activation gates 冻结；生效前 authority = NO

- Decision owner: repository owner（mayf3）
- Decision: §9 CTR-FR-007 的 5 个 gate 全部 PASS，且 accepted artifacts
  合入各自 main 之前，
  `SVC_FORUM_V1_AUTHORITY_EFFECTIVE = NO`。
- Rejected alternative: 以部分 gate 通过或报告声称作为生效依据。
- Reason: 与 `v0-to-v1-migration.md` §9"任何一项未知、部分通过或只由
  报告声称，都不得宣布生效"同构。

### DEC-FR-007 — 允许实现文件为封闭集合；溢出即 owner 决策

- Decision owner: repository owner（mayf3）
- Decision: 冻结 §9 CTR-FR-009 的精确文件集合（经源码审计得出）。
  任何集合外文件的修改需求 = `OWNER_DECISION_REQUIRED`，不得自行扩权。
  文件集合已在 acceptance-finalize drift review 坐标复核：
  `auth-service@87b3e54` + `agent-forum@1cccdd5`；实现前若文件路径发生
  rename/move，按
  OWNER_DECISION 重新映射，不得模糊匹配。
- Rejected alternative: 写"相关文件"式的开放式授权。
- Reason: 封闭集合是防 scope creep 的唯一硬边界。

### DEC-FR-008 — moderator/admin 业务权限与 JWT scope 解耦

- Decision owner: repository owner（mayf3）
- Decision: Forum 的 moderator/admin 业务权限不由 V1 JWT scope 自动
  推导、不因 Audience 注册自动授予。`forum.moderate` 等 scope 未注册，
  V1 Token 无法携带；moderation 端点的授权来源保持 forum 本地/
  独立机制（`OBS-FR-009`）。
- Rejected alternative: 将业务角色映射进 token scope。
- Reason: grants-and-audiences.md §2"Audience 只回答 Token 可以交给哪个
  资源服务，不表示该主体在服务内拥有何种业务权限"。

### DEC-FR-009 — acceptance finalize 激活封闭 implementation authority

- Decision owner: repository owner（mayf3）
- Decision: 独立 exact-commit review 已 PASS；本轮将本 Spec 机械 finalize 为
  `status: accepted`、`implementation_authority: contracts`。该 authority
  仅在本 accepted Spec 合入 `main` 后授权 §9 CTR-FR-009 的 13 个 Auth 文件 +
  8 个 Forum 文件封闭范围；本轮自身不实施任何 Contract、Bundle、产品代码、
  consumer 或 Grant 变更。
- Rejected alternative: proposed 状态下开始实现。
- Reason: `.agents/local/README.md` §6 将 Audience/Scope 合同变更列为
  默认 `NON_MECHANICAL`，必须先有 accepted、implementation-authorizing
  Spec 存在于实现 PR base 中。

## 9. Contracts

### CTR-FR-001 — 上位 Contract AMEND：从排除到明确加入

auth-service 实现（在本 Spec accepted 之后）MUST 修订
`docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2：
把 `svc-forum` 从"不属于本轮 Audience 注册表"的排除集合移入
Bundle Audience 清单，使注册表权威与 registry 一致；`llm-todo`、
`workflow-todo` 的排除条款保持不变。同一实现 MUST 修订
`docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` §6 中将
svc-forum 列为 Legacy/未迁移的表述（仅限 svc-forum 相关语句），
消除 normative 矛盾。修订 MUST 引用本 SPEC_ID 作为 CCR 依据。
修订 MUST NOT 改变该两文件中与 svc-forum 无关的任何 normative 语义。

### CTR-FR-002 — Registry entry 逐字段冻结

`contract-bundles/minimal-auth-v1/audience-registry.json` 中的
svc-forum entry MUST 与以下内容逐字段一致（JSON 类型同样冻结）：

```json
{
  "audience_id": "svc-forum",
  "resource_service": "svc-forum",
  "scope_namespace": "forum",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["forum.read", "forum.write"],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1; machine-only agent access via standard OAuth2 client_credentials."
}
```

任何字段偏离（含 `accepted_principal_types` 增加 `user`/`service`、
开启 human/delegated access、增删 scope、`notes` 值不一致）都构成本
Contract 违约。`registered_scopes` 排序遵循无符号 ASCII byte 升序。

### CTR-FR-003 — Bundle 版本纪律与联动

实现 MUST 遵循 bundle 既有版本纪律：`contract_version` /
`registry_version` 按 additive minor 晋升（冻结期望值 `1.3.0`，沿
1.1.0 / 1.2.0 的 CCR 先例），并按 `validate.mjs` L270–L277 的联动
校验同步全部携带 `contract_version` 的 bundle 文件；MUST 在
`metadata/change-log.md` 增加对应条目（记录本 SPEC_ID、parent contract
AMEND、entry 冻结值、fixtures 增补与 matrix 更新）。最终
`npm run contract:v1:validate` MUST 输出
`MINIMAL_AUTH_V1_BUNDLE_VALID=true`。

### CTR-FR-004 — 禁止注册的 scope（封闭集合）

实现 MUST NOT 在 registry（或任何 bundle artifact）中注册：
`forum.admin`、`forum.moderate`、`forum.*`（作为字面 scope）、
`*`（wildcard）、以及 `forum.read` / `forum.write` 之外的任何
`forum.*` scope。实现 MUST NOT 改动其他 audience 的 scope 集合。
未来任何新增 MUST 另走独立 CCR。

### CTR-FR-005 — 正/负向 fixtures

实现 MUST 增补：
- 正向 fixture `direct-agent-svc-forum`（RS256 + kid、
  `iss = auth-service`、`aud = svc-forum`、`principal_type = agent`、
  `agent_id` 存在、`scope = "forum.read forum.write"`）；
- 负向 cases 至少覆盖：`forum.admin`、`forum.moderate`、wildcard
  scope 拒绝；wrong `aud`；wrong `iss`；unknown `kid`；missing
  `agent_id`。

fixtures MUST 通过 bundle 既有验证路径（`verify-compact-jwt.mjs` /
`validate.mjs`），MUST NOT 引入第二套 fixture 语义。

### CTR-FR-006 — agent-forum 独立 consumer review（13 项证明）

`mayf3/agent-forum` MUST 通过一次独立 consumer review，固定单一
exact commit（含 fixed remote SHA），逐项证明：

```text
CR-01  使用 auth-service JWKS 本地验证（offline 验证路径）
CR-02  RS256 + known kid（不接受 HS256 / alg 自动选择；unknown kid 拒绝）
CR-03  exact issuer（auth-service）
CR-04  exact audience = svc-forum
CR-05  principal_type = agent
CR-06  agent_id 必须存在（缺失拒绝）
CR-07  forum.read / forum.write 映射到精确 endpoint（read→GET，
       write→写操作）
CR-08  scope 缺失 fail-closed（403 INSUFFICIENT_SCOPE，不降级放行）
CR-09  不调用 auth-service introspection（授权路径零 introspection 调用）
CR-10  不依赖 owner_user_id claim（缺失不影响验证）
CR-11  legacy/shared-secret fallback 不作为本迁移路径（V1 路径无
       HS256/ADC/bare-verify 回退）
CR-12  未知 scope 拒绝（token 携带未注册 scope 不获授权）
CR-13  现有 moderator/admin 业务权限不因 V1 registry 自动授予
```

review MUST 绑定 exact base commit、reviewed commit、reviewer identity
（Author != Reviewer），并把固定 commit 回填
`consumer-verification-matrix.json` svc-forum entry。review 未 PASS：

```text
SVC_FORUM_V1_ACTIVATION = BLOCKED
```

### CTR-FR-007 — Activation gates（冻结）

```text
GATE_PARENT_CONTRACT_AMENDED = PASS
GATE_CONTRACT_BUNDLE_VALID = PASS
GATE_AUTH_REGISTRY_MATCH = PASS
GATE_FORUM_CONSUMER_REVIEW = PASS
GATE_FORUM_POSITIVE_NEGATIVE_CONFORMANCE = PASS
```

所有 Gate 通过且 accepted artifacts 合入各自 main 之前：

```text
SVC_FORUM_V1_AUTHORITY_EFFECTIVE = NO
```

各 Gate 的判据：
- `GATE_PARENT_CONTRACT_AMENDED`：CTR-FR-001 的两处 normative 修订已
  merge 到 `mayf3/auth-service` main；
- `GATE_CONTRACT_BUNDLE_VALID`：`npm run contract:v1:validate` =
  `MINIMAL_AUTH_V1_BUNDLE_VALID=true`（在 merge 后的 main 上执行）；
- `GATE_AUTH_REGISTRY_MATCH`：registry entry 与 CTR-FR-002 冻结值逐字段
  相等（机器比对，非人工声称）；
- `GATE_FORUM_CONSUMER_REVIEW`：CTR-FR-006 的 review 记录存在且 PASS；
- `GATE_FORUM_POSITIVE_NEGATIVE_CONFORMANCE`：CTR-FR-005 fixtures +
  AC3/AC4/AC5 的执行证据存在且通过。

### CTR-FR-008 — Grant 不随 Audience 注册自动创建

Audience 注册的实现 MUST NOT 创建、扩大或修改任何 Grant
（human_audience_grants / machine_access_grants / delegation_grants）。
Grant 写入只能由 PR #5 管理的 versioned database migration 完成，并携带
grants-and-audiences.md §9 要求的全部审计字段。

### CTR-FR-009 — 允许的未来实现文件（封闭集合）

本 CCR 的实现（accept 后）MAY 修改且仅 MAY 修改以下文件。集合外的任何
变更需求 = `OWNER_DECISION_REQUIRED`：

auth-service（`mayf3/auth-service`，13 个）：

```text
# normative / 语义变更
docs/contracts/minimal-auth-v1/grants-and-audiences.md
docs/contracts/minimal-auth-v1/v0-to-v1-migration.md   # 仅 §6 svc-forum 相关语句
contract-bundles/minimal-auth-v1/audience-registry.json
contract-bundles/minimal-auth-v1/contract-manifest.json
contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
contract-bundles/minimal-auth-v1/metadata/change-log.md
contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
contract-bundles/minimal-auth-v1/validate.mjs
# 仅 contract_version 联动字段（validate.mjs L270–L277 要求）
contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
```

agent-forum（`mayf3/agent-forum`，8 个）：

```text
# consumer verifier / 验证接线 / scope guard
svc-forum/src/lib/auth-jwt.ts
svc-forum/src/middleware/auth.ts
svc-forum/src/middleware/scope-guard.ts
# conformance tests 及其直接 helper 依赖（OBS-FR-007 审计）
svc-forum/tests/standard-oauth.test.ts
svc-forum/tests/standard-oauth-integration.test.ts
svc-forum/tests/helpers/auth-keys.ts
svc-forum/tests/helpers/jwks-server.ts
svc-forum/tests/helpers/test-keys.ts
```

本 CCR 明确不授权 Grant 写入；Grant supply 由 PR #5 单独管理。

### CTR-FR-010 — Resource Consumer 保持 offline-JWKS-only

svc-forum 资源消费者 MUST 继续以 offline 签名与 claim 验证授权
（JWKS 缓存 + fail-closed），MUST NOT 在请求授权路径调用 auth-service
introspection / live status 端点。本 CCR 不引入任何在线校验义务。

## 10. Acceptance

每条 Acceptance 绑定 Contract、方法与失败条件；AC 编号（AC1–AC10）为
owner 任务冻结编号，与 ACC-FR 稳定 ID 一一对应。

### ACC-FR-001（AC1）— 上位 Contract 从排除到加入

- Contracts: `CTR-FR-001`
- Method: 实现 PR 的 docs diff 审阅（grants-and-audiences.md §2 +
  v0-to-v1-migration.md §6），merge 后在 main 上复核。
- Required evidence: merge commit + diff 摘录。
- Expected result: svc-forum 出现在 Bundle Audience 清单；排除集合仅剩
  llm-todo / workflow-todo。
- Failure condition: 任一文件的排除表述残留 svc-forum，或无关语义被改动。

### ACC-FR-002（AC2）— Registry entry 逐字段一致

- Contracts: `CTR-FR-002`
- Method: 机器比对 `audience-registry.json` svc-forum entry 与
  CTR-FR-002 冻结 JSON（含 `notes` 与数组元素及排序）。
- Required evidence: 比对脚本/命令输出。
- Expected result: 全字段相等。
- Failure condition: 任一字段、数组元素或排序偏离。

### ACC-FR-003（AC3）— forum.read / forum.write 正向通过

- Contracts: `CTR-FR-005`、`CTR-FR-003`
- Method: `direct-agent-svc-forum` 正向 fixture 通过 bundle 验证；
  `npm run contract:v1:validate` = `MINIMAL_AUTH_V1_BUNDLE_VALID=true`；
  `npm run test:contract-v1` 通过。
- Expected result: 携带 `forum.read forum.write` 的 svc-forum token
  验证通过。
- Failure condition: 正向 fixture 缺失或验证失败。

### ACC-FR-004（AC4）— forum.admin / forum.moderate / wildcard 负向拒绝

- Contracts: `CTR-FR-004`、`CTR-FR-005`
- Method: 负向 fixtures/用例对
  `forum.admin`、`forum.moderate`、wildcard 逐项断言拒绝。
- Expected result: 三类 scope 全部被拒绝（registry 未注册 →
  invalid_scope / 授权失败）。
- Failure condition: 任一被静默接受或降级接受。

### ACC-FR-005（AC5）— wrong aud / wrong issuer / unknown kid / missing agent_id 拒绝

- Contracts: `CTR-FR-005`、`CTR-FR-006`
- Method: bundle 负向 fixtures + agent-forum conformance
  （standard-oauth*.test.ts）对四类变异逐项断言拒绝。
- Expected result: 四类全部拒绝（对应 TOKEN_CONTRACT_INVALID /
  TOKEN_INVALID_OR_EXPIRED 或等价失败）。
- Failure condition: 任一变异被接受。

### ACC-FR-006（AC6）— owner_user_id 缺失不影响 Forum consumer 验证

- Contracts: `CTR-FR-006`（CR-10）
- Method: consumer review 在 exact commit 上验证：不含 owner_user_id
  claim 的合法 svc-forum token 通过验证且正常授权；verifier 源码无
  owner_user_id 依赖。
- Expected result: 验证结果与 claim 缺失无关。
- Failure condition: 因缺失该 claim 拒绝合法 token，或授权逻辑读取该
  claim。

### ACC-FR-007（AC7）— Resource Consumer 保持 offline-JWKS-only

- Contracts: `CTR-FR-010`、`CTR-FR-006`（CR-01/CR-09）
- Method: consumer review 证明授权路径零 introspection 调用（源码断言 +
  auth-service 不可用场景下的集成测试：JWKS 预热后授权成功）。
- Expected result: 无任何授权期 auth-service live 调用。
- Failure condition: 任何授权路径的 introspection/live status 调用。

### ACC-FR-008（AC8）— Grant 不因 Audience 注册自动创建

- Contracts: `CTR-FR-008`
- Method: 实现 PR diff 无 grant migration / grant 数据写入；对比注册
  前后 grant 相关表与 migration 目录（仅 PR #5 允许新增）。
- Expected evidence: migration 目录 diff + DB 状态记录。
- Expected result: 零 Grant 变更。
- Failure condition: 任何 Grant 结构被创建或修改。

### ACC-FR-009（AC9）— moderator/admin 业务权限不由 JWT scope 自动推导

- Contracts: `DEC-FR-008`、`CTR-FR-006`（CR-13）、`CTR-FR-004`
- Method: consumer review 证明：仅含 forum.read/forum.write 的 token
  无法访问 moderation/admin 端点（403）；registry 无 forum.moderate/
  forum.admin 注册（联动 ACC-FR-002/004）。
- Expected result: 业务权限来源与 V1 scope 无推导关系。
- Failure condition: 任一 moderation/admin 端点因 V1 token 被放行。

### ACC-FR-010（AC10）— 完整 Contract Bundle validator PASS

- Contracts: `CTR-FR-003`、`CTR-FR-007`
- Method: 在 merge 后的 `mayf3/auth-service` main 上执行
  `npm run contract:v1:validate` 与 `npm run test:contract-v1`。
- Expected result: `MINIMAL_AUTH_V1_BUNDLE_VALID=true`；测试通过。
- Failure condition: validator 输出任何 error / 退出非零。

## 11. Alternatives and disposition

### ALT-FR-001 — 以 executable registry 现状认定"已注册"

- Disposition: REJECTED
- Reason: 违反 authority 分层（`DEC-FR-001`）；drift 无 accepted CCR 支撑
  （`OBS-FR-004`）。

### ALT-FR-002 — 本轮同时注册 forum.moderate / forum.admin

- Disposition: REJECTED
- Reason: 产品语义未审阅；`DEC-FR-003` 冻结禁止集合；未来独立 CCR。

### ALT-FR-003 — 注册 PR 顺带写入 canary Grant

- Disposition: REJECTED
- Reason: Grant supply 归 PR #5（`DEC-FR-005`）；审计链分离。

### ALT-FR-004 — whole-authority SUPERSEDE MINIMAL_AUTH_FOUNDATION_V1

- Disposition: REJECTED
- Reason: 单一 audience 的加入用 bounded AMEND 即可（SPEC_FORMAT_V0 §14
  边界；`.agents/local/README.md` §5 forward-only）；整体替换引入不必要
  的重审面。

### ALT-FR-005 — 把 matrix 的 v1_ready=true 当作已完成迁移审阅

- Disposition: REJECTED
- Reason: `migration_status = not_started` 且无 review 记录（`OBS-FR-006`）；
  `DEC-FR-004` 要求 exact-commit 独立 review。

### ALT-FR-006 — consumer 改用 online introspection

- Disposition: REJECTED
- Reason: 冻结信任边界（`CTR-FR-010`；v0-to-v1-migration.md 的
  offline-only 纪律）。

## 12. Migration, compatibility, and rollback

- 无新增持久化产品状态：Audience 注册只改 contract docs + bundle
  artifacts；数据库无 schema/data 变更（`CTR-FR-008`）。
- 无双注册表 feature flag：上位 Contract AMEND 与 bundle update 在同一
  实现 PR 内一致合入，不引入"文档说 A、registry 说 B"的中间态。
- 已存在的 drift（registry/matrix/validate 先行写入）由本 CCR 的 AMEND
  显式吸收，不是被静默豁免；吸收动作本身记录于 change-log 条目
  （`CTR-FR-003`）。
- 回滚 = revert 实现 commit（docs + bundle 单一 revert 即恢复先前一致
  状态）；无数据迁移、无消费者配置强制变更（agent-forum 在 review 前
  后行为不变，因为验证语义已满足要求——`OBS-FR-007`）。
- Consumer 侧：consumer review PASS 与 matrix 回填之前，svc-forum 的
  V1 授权路径维持现状（`SVC_FORUM_V1_AUTHORITY_EFFECTIVE = NO`）；
  不存在双协议窗口。

## 13. Open questions

- `OQ-FR-001`（RESOLVED — rename round 2026-08-20）：SPEC_ID pattern 与
  vendored frontmatter schema 的偏离（§3 历史记录）。独立 review 判定
  REVISE（唯一 blocker），已通过机械重命名解决：SPEC_ID →
  `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`（选项 b），vendored schema
  未修改。semantic change = NONE。
- `OQ-FR-002`（RESOLVED — acceptance finalize 2026-08-21）：
  `docs/specs/README.md` 的 Current index 已补齐本 Spec accepted 行
  （docs-only，无语义变更）。
- `OQ-FR-003`（非 normative，bounded，可在实现内顺带处理或保留现状）：
  `contract-manifest.json` 的悬挂字段 `audience_registry_version =
  "1.0.0"` 与 registry `1.2.0`（→ 实现后 `1.3.0`）不一致且 validator
  不校验（`OBS-FR-005`）。处理方式（对齐为 1.3.0 或保留）不改变任何
  Contract 语义；若处理，属于 `contract-manifest.json` 已授权文件内。
- `CONSUMER_REVIEW_FIXTURE_KEYS`（非 normative）：consumer review 的
  真实进程证据使用何种 test key 固定方式，由 review 记录决定。

## 14. Frozen summary（owner 任务冻结值回显）

```text
SPEC_ID = AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1
SPEC_FILE = docs/specs/AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1.md
SPEC_STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts

CURRENT_SVC_FORUM_V1_AUTHORITY = NOT_REGISTERED_BY_FROZEN_PARENT_CONTRACT
TARGET = REGISTER_SVC_FORUM_IN_MINIMAL_AUTH_V1
PARENT_CONTRACT_AMENDMENT_REQUIRED = YES
CONTRACT_BUNDLE_UPDATE_REQUIRED = YES
CONSUMER_MIGRATION_REVIEW_REQUIRED = YES

TARGET_AUDIENCE = svc-forum
REGISTERED_SCOPES = forum.read, forum.write
FORBIDDEN_SCOPES = forum.admin, forum.moderate, forum.*, *, 其他任何 scope

GRANT_CREATION_AUTHORIZED = NO (Grant supply 由 PR #5 单独管理)
DEPLOYMENT = NO
MERGE_PERFORMED = NO (本 acceptance finalize 轮)
```

## 15. Acceptance Record

```text
ACCEPTANCE_REVIEW =
  论坛审计（二轮）

REVIEWED_SPEC_HEAD =
  c437a586422051d83924c27dde6dc7a6e94a20d6

AUTH_DRIFT_REVIEW =
  论坛调查

CURRENT_AUTH_MAIN =
  87b3e54b1e8d332738663de38d9c6c599760c14a

CURRENT_FORUM_REVIEW_HEAD =
  1cccdd54554c0bde13572273401f19f294334e46

AUTH_DRIFT_CLASSIFICATION = COMPATIBLE_AUTHORITY_ADDITION
FORUM_CONSUMER_DRIFT_CLASSIFICATION = SEMANTICALLY_COMPATIBLE
SEMANTIC_RE_REVIEW_REQUIRED = NO

REVIEW_VERDICT = PASS
REQUIRED_FIXES = NONE
ACCEPTED_AT = 2026-08-21
ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = NONE
```

本 acceptance finalize 为纯机械轮：仅同步 Auth main 与 Forum consumer exact
commit 坐标、记录 drift classification、更新 lifecycle / implementation authority、
补充本 Acceptance Record，并在 `docs/specs/README.md` 增加 accepted index 行。
Audience、scope、consumer contract、5 个 activation gates、13 + 8 文件封闭范围与
AC1–AC10 的 reviewed semantics 均保持不变；本轮无 implementation、无 Grant、无 merge。
