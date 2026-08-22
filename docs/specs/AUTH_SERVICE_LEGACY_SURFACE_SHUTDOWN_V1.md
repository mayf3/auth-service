---
spec_id: AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1
status: accepted
spec_kind: program
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
    revision: d83a2ff0e9644611707d7481ef88b4d7d49fb68e
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1

```text
SPEC_ID = AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1
SPEC_KIND = program
SPEC_STATUS = accepted
SPEC_MERGE_READY = NO
READY_TO_MARK_ACCEPTED = YES
IMPLEMENTATION_AUTHORIZED = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
INDEPENDENT_REVIEW_REQUIRED = YES
READY_FOR_INDEPENDENT_REVIEW = YES
OWNER_DECISIONS_FROZEN = YES
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE

GOVERNANCE_MIGRATION = YES
GOVERNANCE_MIGRATION_BASE =
  1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9
GOVERNANCE_MIGRATION_PREVIOUS_HEAD =
  9f6da01bba353070723279aec3e021750e3f0ed8
GOVERNANCE_MIGRATION_OLD_PATH =
  .agents/specs/AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1.md
GOVERNANCE_MIGRATION_NEW_PATH =
  docs/specs/AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1.md

V2_PARENT_REALIGNMENT = YES
V2_PARENT_REALIGNMENT_BASE =
  f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e
V2_PARENT_REALIGNMENT_PREVIOUS_HEAD =
  fb8d55e785d6f99c9e57a602543609953e8f5410

PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
PARENT_ACCEPTED_HEAD =
  842fccb384448d7f1bb43919048ce579fac9df96
PARENT_MERGE_COMMIT =
  37edaa6f8c56749eaa16c0bbbb0c0c75d8c6a1eb
PARENT_AUTHORITY_STATUS = accepted
PARENT_PRODUCTION_EFFECTIVE = NO
PARTIAL_SUPERSESSION = NONE
MINIMAL_AUTH_FOUNDATION_V1 =
  SUPERSEDED_HISTORICAL_AUTHORITY
V1_ROOT_MODULES_CONTRACT_BUNDLE_1_3_0 =
  V2_EXACT_INCORPORATED_HISTORICAL_PROVENANCE
AUTHORITATIVE_CONTRACT_VERSION = 1.3.0

EXTERNAL_AUTHORITY_PIN_KIND =
  AMENDMENT_6_ACCEPTANCE_FINALIZE
EXTERNAL_AUTHORITY_PIN =
  d83a2ff0e9644611707d7481ef88b4d7d49fb68e
EXTERNAL_AUTHORITY_REVIEWED_SEMANTIC_HEAD =
  5d1285195f8c2e3eb88ea606be09671b074f68d4
EXTERNAL_AUTHORITY_BLOB_AT_PIN =
  df74e92759ad3083328dfd337667fc8a4ec618a0
EXTERNAL_AUTHORITY_BLOB_AT_CURRENT_MAIN =
  df74e92759ad3083328dfd337667fc8a4ec618a0
EXTERNAL_AUTHORITY_DRIFT_AFTER_NEW_PIN = NO

PHASE_A = CLEAN_BOOTSTRAP_ONLY
PHASE_B = EXISTING_CREDENTIAL_RECONCILIATION_TARGET
PHASE_B_IMPLEMENTATION_AUTHORITY = none
CURRENT_AGENT_CORE_READ_ONLY_RESOLUTION_CALLER =
  ABSENT

CLOSED_MANIFEST_OWNER = RUNTIME_CHILD
HISTORICAL_INVESTIGATION_EVIDENCE =
  AUTH_SERVICE_PR2_REMAINING_BLOCKERS_INVESTIGATION_V1
CLOSED_MANIFEST_RECOMMENDATION =
  RUNTIME_CHILD_OWNS

HISTORICAL_REVIEW_COORDINATES =
  HISTORICAL_REVIEW_EVIDENCE_ONLY
HISTORICAL_REVIEWS_BIND_TO_NEW_HEAD = NO

AUTH_SERVICE_READ_ONLY_RESOLUTION_CONTRACT =
  DEFINED_AT_SPEC_LEVEL

AUTH_SERVICE_SIDE_STATE_F_PREREQUISITE =
  RESOLVED_AT_SPEC_LEVEL

STATE_F_END_TO_END_IMPLEMENTABILITY =
  BLOCKED_BY_EXTERNAL_CALLER_ALIGNMENT

STATE_F_GATE_CLOSED = NO

HUMAN_PRINCIPAL_ADMINISTRATION_AUTHORITY =
  AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1
HUMAN_PRINCIPAL_ADMINISTRATION_PR =
  mayf3/auth-service#15
HUMAN_PRINCIPAL_ADMINISTRATION_HEAD =
  98ec29a1152bfa9530c572ec5a541ea02df163c4
HUMAN_PRINCIPAL_ADMINISTRATION_STATUS =
  proposed / independently semantically reviewed / not accepted
PR_2_OWNS_HUMAN_PRINCIPAL_ADMINISTRATION = NO

PASSWORD_RESET =
  OUTSIDE_AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1
PASSWORD_RESET_AUTHORITY =
  SEPARATE_CREDENTIAL_ONLY_CHILD_REQUIRED
PLANNED_CREDENTIAL_CHILD_ID =
  AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1
PLANNED_CREDENTIAL_CHILD_STATUS =
  planned / not yet an authority

ONLINE_PROVISIONING_CLIENT_RESOLUTION = REQUIRED
ENDPOINT = GET /api/v1/clients/:client_id
AUTHENTICATION = v1ManagementAuth
AUDIENCE = svc-auth
SCOPE = auth.identity.provision
READ_ONLY_RESOLUTION_DATABASE_WRITES = 0
SECRET_FIELDS_RETURNED = NONE

RESOLUTION_RESPONSE_CACHE_CONTROL = no-store
RESOLUTION_RESPONSE_PRAGMA = no-cache
RESOLUTION_ETAG = NONE
RESOLUTION_LAST_MODIFIED = NONE
RESOLUTION_304_RESPONSE = FORBIDDEN
CALLER_RESOLUTION_CACHE = FORBIDDEN
FRESH_RESOLUTION_PER_PROVISIONING_OPERATION = REQUIRED

RESOLUTION_EXACT_PATH = GET /api/v1/clients/:client_id
ROUTE_LOCAL_POLICY = EXACT_PATH_ONLY
OTHER_ENDPOINT_BEHAVIOR_CHANGED = NO
GLOBAL_LIMITER_REMAINS_ENABLED = YES
RESOLUTION_RATE_LIMIT_BYPASS = NO
OTHER_ENDPOINT_RATE_LIMIT_POLICY_CHANGED = NO
OTHER_ENDPOINT_429_WIRE_CHANGED = NO
OTHER_ENDPOINT_ERROR_WIRE_CHANGED = NO

CLIENT_EXTERNAL_REF_NULL_SEMANTICS =
  RETURN_200_AS_READ_ONLY_FACT
```

## 0. Governance migration provenance

本文件由治理迁移 amendment 产生：

- 原 candidate 位于 `.agents/specs/AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1.md`，
  基于 `main@84890120bd385b39287cb81890236b0e73e96c8d`，
  previous Head = `9f6da01bba353070723279aec3e021750e3f0ed8`
  （`AUDIT_BASE_SHA = 84890120bd385b39287cb81890236b0e73e96c8d`，
  `PREVIOUS_SPEC_HEAD = 0539432e530987227c48fdf51a22b53464151797` 之后的
  route-local wire amendment head，原 `DATE = 2026-08-19`）。
- 治理采用已在 `main@1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9` 激活
  （`adoption.status = accepted`，见 `.agents/governance.lock.json`）。
  本 Spec 已 rebase 到该 base 并迁移到 `docs/specs/`，符合
  `.agents/local/README.md` §5 对未合并候选的迁移要求。
- `.agents/specs/` 不是 governing Spec 目录；本文件是唯一副本，不存在转发
  副本或双副本。
- 本次迁移只做语法/治理形态转换：补齐 frontmatter、stable IDs、
  primitive 类型与 Contract → Acceptance 覆盖。Author 断言
  product semantic delta = NONE。
- 所有迁移前的历史 review coordinates（包括针对
  `84890120` base 上 previous Heads 的全部 review 记录）一律标记为
  `HISTORICAL_REVIEW_EVIDENCE_ONLY`，不自动绑定到迁移后的新 Head。
  迁移后的 exact Head 必须重新接受完整 independent semantic review。
- 本迁移不宣布 production effective、`supersedes_v0=true`、Consumer
  migration complete 或 Agent Core State F end-to-end closed。

V2 parent realignment（本 amendment）：

- `MINIMAL_AUTH_FOUNDATION_V2` 已 accepted 并合入 main
  （accepted Head `842fccb384448d7f1bb43919048ce579fac9df96`，
  merge commit `37edaa6f8c56749eaa16c0bbbb0c0c75d8c6a1eb`）；
  `MINIMAL_AUTH_FOUNDATION_V1` 是
  `SUPERSEDED_HISTORICAL_AUTHORITY`，其 root、modules 与
  Contract Bundle `1.3.0` 是
  `V2_EXACT_INCORPORATED_HISTORICAL_PROVENANCE`。
- 本 Spec 的 evaluated base 为
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`；parent authority 由
  V1 切换为 accepted V2（先行 human administration authority split
  amendment `7a2a4991d476f9272b5b9a348b3aa2cdd63a5495` 已完成
  frontmatter 切换与 §3.5 拆分，本 amendment 保留其全部语义并继续
  对齐 V2 / 外部 authority / 调查 blocker）；不存在 prose-only
  partial supersession（`PARTIAL_SUPERSESSION = NONE`）。
- 硬切产品方向现由 accepted V2 拥有（`DEC-MAFV2-004` 至
  `DEC-MAFV2-006`、`CTR-MAFV2-002`、`CTR-MAFV2-011`）；本 Program
  不再自行覆盖 Parent，只在与 Parent 一致的前提下冻结自身边界。
- 外部 authority 重绑定为 Amendment 6 acceptance finalize
  `d83a2ff0e9644611707d7481ef88b4d7d49fb68e`（见 §3.2）。
- 调查 `AUTH_SERVICE_PR2_REMAINING_BLOCKERS_INVESTIGATION_V1`
  （investigation base `1da40d43...`，investigated Head
  `fb8d55e7...`）的全部数字按
  `HISTORICAL_INVESTIGATION_EVIDENCE` 记录（见
  `CTR-AUTH-SHUTDOWN-025`）；closed manifest 由未来 Runtime Child
  在其 exact Base 拥有（`CLOSED_MANIFEST_OWNER = RUNTIME_CHILD`）。

本 amendment 保留已经接受的 read-only provisioning resolution 方向与全部
既有冻结边界，不重新设计 endpoint。前一 amendment（route-local wire
policy、AC-R12 完整化、AC-R15/AC-R16）的全部语义已经原样进入本文的
Contracts 与 Acceptance。

## 1. Goal

`auth-service` 必须成为单一、严格、可验证的 Minimal Auth V1 身份、
Credential 与 Token Authority。

完成本计划后，运行时不得再存在第二套 Legacy 身份面、Legacy Token
Profile、共享 HS256 兼容验签、Legacy Refresh Session、中心化通用验签
Oracle、Legacy flat-field authority，或通过开关重新启用这些能力的路径。

同时，受信任 provisioning management caller 必须能够在任何
Principal / Client mutation 之前，按一个已知 public `client_id` 新鲜、
只读地解析当前 MachineClient 与 MachinePrincipal 绑定事实。该读取不得：

```text
create
claim
rotate
revoke
disable
backfill
repair
read Grants
mutate any database row
```

目标状态：

```text
Human authentication
→ existing active User
→ registered active HumanClient
→ Authorization Code + PKCE S256
→ V1 Human Access Token (RS256)
→ opaque Refresh Credential + persisted Session/Family

Machine authentication
→ active MachinePrincipal
→ active MachineClient
→ active AuthAudience
→ MachineAccessGrant(audience, scopes)
→ client_credentials
→ V1 Direct Machine Access Token (RS256)

Provisioning pre-mutation resolution
→ authenticated svc-auth management Service principal
→ fresh GET /api/v1/clients/:client_id
→ exact non-secret MachineClient + MachinePrincipal projection
→ caller compares expected opaque bindings
→ zero database writes
→ no response or caller-side cache

Delegated work
→ verified V1 Direct Agent Token
→ active original Principal/Client
→ fixed active TrustedProxy Service
→ accepted source audience
→ original grant ∩ delegation grant
→ V1 Delegated Token (RS256)

External resource verification
→ auth-service JWKS
→ local offline signature verification
→ exact issuer
→ exact audience
→ exact token profile
→ exact scope
→ no auth-service introspection or per-request live status lookup
```

## 2. Scope and non-goals

Scope：`mayf3/auth-service` 的 Legacy 鉴权面 shutdown、Minimal Auth V1
唯一运行时化、provisioning read-only resolution seam、Legacy flat-field
authority cutoff、生产激活 gate 体系与 implementation Child 序列。

本 Spec 是 Program Spec（`spec_kind: program`，
`implementation_authority: none`）。本 Spec 被接受后不直接授权任何产品
实现；每个 implementation Child 都必须有独立 accepted、
`implementation_authority: contracts` 的 Child Spec。

本 Spec 不做：

- 不拆分 ADC 与 auth-service 的数据库。
- 不修改 Forum、Workflow、OKR 的业务权限语义。
- 不新增在线 Grant Management API。
- 不恢复公开注册。
- 不设计新的 Agent credential bootstrap protocol。
- 不提供 Token introspection、generic verification Oracle 或 Resource
  Consumer live status API。
- 不允许普通业务 Token、Resource Consumer Token 或未受信任 caller 使用
  provisioning resolution。
- 不把 provisioning resolution 扩展为 arbitrary database browser。
- 不自动 repair、claim、rotate、revoke、disable 或 reconcile identity。
- 不允许 response cache、negative cache、ETag/304 或 caller-side resolution
  cache。
- 不为 Legacy Refresh 新建 Redis 或数据库补丁体系。
- 不立即删除生产数据库中的旧表、旧列或历史记录。
- 不把 User role 写入 V1 Access Token。
- 不使 Access Token 在 `exp` 前具备逐 Token 撤销能力。
- 不拥有 Human/User Principal administration（create、existing User claim、
  canonical status query、minimal Human directory、enable、disable）或
  password reset 的具体规范语义；前者由
  `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`（PR #15）拥有，后者由
  独立 credential-only Child 拥有（见 §3.5 与 `CTR-AUTH-SHUTDOWN-029`）。
- 不在本 PR 中修改 Agent Core governing Spec 或实现。

允许且仅允许的 live read exception：

```text
AUTHENTICATED_ONLINE_MANAGEMENT_PROVISIONING_RESOLUTION
```

其精确 Contract 见 §9（`CTR-AUTH-SHUTDOWN-009` 至
`CTR-AUTH-SHUTDOWN-018`）。

## 3. Authority and dependencies

### 3.1 Authority precedence

本 Spec 的 authority 顺序为：

1. accepted `MINIMAL_AUTH_FOUNDATION_V2`（active whole Architecture
   authority，`docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md`，
   经 PR #7 合并接受；authority delta scope = migration / hard-cut /
   sequencing）。本 Spec 的任何 Owner Decision 不得排在 accepted
   Parent Architecture 之前，也不得覆盖 Parent 已冻结的 lifecycle、
   迁移与 sequencing 规则。
2. 本 Program Spec（在 Parent 约束内冻结 Program 级边界与 Child
   义务；其中 Human administration children 只保留 Program-level
   prerequisite 与坐标校验决策，不含 child 的具体规范语义，见
   §3.5）。
3. accepted implementation Child Specs。
4. code / tests / runtime / plans / audits：仅作为 State /
   Observation / Evidence，不能覆盖前述 authority；Legacy 文档、
   Legacy 路由、Legacy 字段、Legacy 脚本和历史审计报告只能作为
   迁移证据。
5. 其他仓库的 accepted governing Spec 只由该仓库自己的 amendment /
   supersession 流程改变；本 Spec 不能单方面改写它们。

`MINIMAL_AUTH_FOUNDATION_V1`（normative modules
`docs/contracts/minimal-auth-v1/` + executable bundle
`contract-bundles/minimal-auth-v1/`）是 V2 exact-incorporated 的
`SUPERSEDED_HISTORICAL_AUTHORITY`，不是本 Spec 的 active parent；本
amendment 起二者不得同时写成 active parent。本 Spec 遵守
`.agents/local/README.md` 的 precedence：不得覆盖
`MINIMAL_AUTH_FOUNDATION_V2` 已冻结的 lifecycle 与迁移规则（authority
delta 仅限 migration / hard-cut / sequencing）；在 V2
production-effectiveness 完成前，相关 V0 frozen contract 仍可能治理
当前生产路径，不得通过本地 prose 推断 partial supersession
（`PARTIAL_SUPERSESSION = NONE`；`PARENT_PRODUCTION_EFFECTIVE = NO`）。

### 3.2 External authority reference（exact accepted revision）

```text
repository: mayf3/dsh-agent-core
authority_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
revision: d83a2ff0e9644611707d7481ef88b4d7d49fb68e
relation: interoperates_with
```

核实与重绑定记录（2026-08-22）：

- `EXTERNAL_AUTHORITY_PIN_KIND = AMENDMENT_6_ACCEPTANCE_FINALIZE`：
  pin `d83a2ff0e9644611707d7481ef88b4d7d49fb68e` 是 Amendment 6
  acceptance finalize commit（Amendment 6 authoring `5ce0cf4` +
  acceptance finalize `d83a2ff`，independent review PASS，accepted
  2026-08-20，reviewed semantic head
  `5d1285195f8c2e3eb88ea606be09671b074f68d4`）；
- authority 文件 blob @ pin =
  `df74e92759ad3083328dfd337667fc8a4ec618a0`；
- dsh-agent-core 当前 main（观察值
  `d506f81105e8aa05177a01b817ebe11dcc076ba5`）上该文件 blob 与 pin
  相同：`EXTERNAL_AUTHORITY_DRIFT_AFTER_NEW_PIN = NO`；
- 旧 pin `5cfb61025641f8ec2430d0b9d39ad0cb8348124e`（2026-08-20
  核实时 byte-identical）已被 Amendment 6 supersede，保留为历史
  provenance，不再是本 Spec 的 external authority pin。

Amendment 6 冻结的分阶段语义（本 Spec 如实记录，不重定义）：

```text
PHASE_A = CLEAN_BOOTSTRAP_ONLY
PHASE_A_CURRENT_SCOPE =
  store entry absent
  → prerequisite (c)
  → S1
  → S2
  → secret store
  → verification mint
STORE_ENTRY_EXISTS_PHASE_A =
  existing_credential_resolution_required
STORE_ENTRY_EXISTS_PHASE_A_AUTH_CALLS = 0
PHASE_B = EXISTING_CREDENTIAL_RECONCILIATION_TARGET
PHASE_B_IMPLEMENTATION_AUTHORITY = none
PHASE_B_STATE_SCOPE = D / E / F / G
```

Amendment 6 的出现不得被解释为 State F 已关闭
（`STATE_F_GATE_CLOSED = NO`；见 §4/§5 current State 与
`CTR-AUTH-SHUTDOWN-030`）。

当前实现证据（dsh-agent-core main，2026-08-22 观察）：

```text
CURRENT_AGENT_CORE_AUTH_CLIENT =
  POST /api/v1/principals
  POST /api/v1/clients
  POST /oauth/token
CURRENT_AGENT_CORE_READ_ONLY_RESOLUTION_CALLER =
  ABSENT
```

本引用是 reference-only：auth-service 可以声明对该外部 authority 的
期望（见 `CTR-AUTH-SHUTDOWN-030`），但不得接受、修改、supersede 或
重定义 `dsh-agent-core` 拥有的 authority。

### 3.3 Cross-repository evidence object（historical evidence）

```text
SOURCE_REPO = mayf3/dsh-agent-core
SOURCE_PR = 17
SOURCE_REVIEWED_HEAD = c42438bc74a6b1e7de4a933d7a590e1f96a18373
SOURCE_FILE =
  packages/agent-credential-provisioning/src/auth-client.js
```

该 reviewed Head 的 Auth client 只有：

```text
ensurePrincipal → POST /api/v1/principals
ensureClient    → POST /api/v1/clients
```

没有 read-only client resolution call。

### 3.4 Authoritative 1.3.0 source/snapshot pin

```text
AUTHORITATIVE_CONTRACT_VERSION = 1.3.0
AUTHORITATIVE_BASE_COMMIT =
  f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e
AUTHORITATIVE_PARENT_AUTHORITY =
  MINIMAL_AUTH_FOUNDATION_V2
AUTHORITATIVE_CONTRACT_BUNDLE_TREE_SHA1 =
  c477f1b1bd7e4b48c2dc99c047c28aa5358f738e
AUTHORITATIVE_CONTRACT_MANIFEST_BLOB_SHA1 =
  60ed66c696fa465c6a850f3a1749df55a19eb65b
AUTHORITATIVE_CONTRACT_MANIFEST_SHA256 =
  59edda9ece846c45a5767aa37d76517609762b7815c2a9da6b3068106d6765ab
AUTHORITATIVE_AUDIENCE_REGISTRY_BLOB_SHA1 =
  ef7e139ec545471cbb4e84ce84a5fbcc3c48b1d7
AUTHORITATIVE_AUDIENCE_REGISTRY_SHA256 =
  87ee3e1b239c2d8cc4d200cffb330d72f3f645b037443554f2ed91cc91cd4bf6
FROZEN_V1_MANIFEST_MUTATION_REQUIRED = NO
```

旧 1.2.0 pin（`AUTHORITATIVE_BASE_COMMIT = 84890120...`、tree
`796a8b67...`、freeze transition `5f401d61...` 等）是 pre-V2
authoring-time 历史 provenance，不再是本 Spec 的 authority pin。

Frozen 1.3.0 manifest 内的全部 lifecycle 字段（version、
production/consumer-migration readiness 等）只是
`FREEZE_TIME_HISTORICAL_FACTS`：本 Program、Runtime Child 与
Consumer Migration PR 均不得通过修改该 manifest 来表示 production
effective（见 `CTR-AUTH-SHUTDOWN-026` 的 V2 Activation Record
模型）。

Runtime snapshot：

```text
payload = {
  formatVersion: 1,
  contractVersion: "1.3.0",
  reviewedSourceGitCommit: AUTHORITATIVE_REVIEWED_SOURCE_COMMIT,
  sourceBundleDigest:
    SHA256(path + NUL + bytes + NUL for exact pinned bundle tree),
  manifest: exact manifest blob bytes,
  audienceRegistry: exact registry blob bytes
}

runtimeDigest = SHA256(JSON.stringify(payload))
```

Independent Acceptance Review 必须对 exact object 连续运行两次
`scripts/prepare-minimal-auth-v1.mjs`，记录完整且相同的 64-hex
`sourceBundleDigest` 与 `runtimeDigest`。不得捏造缺失 digest，不得
沿用 1.2.0 旧 digest。本轮 authoring 在 evaluated base
`f5c2305b...` 上的真实双运行结果（两次一致，见
`OBS-AUTH-SHUTDOWN-013`）：

```text
PREPARE_DOUBLE_RUN_SOURCE_BUNDLE_DIGEST =
  977ebacdf87d80650b42c7b8699a109fffd9d884228c8b6bfe23319e896a17fc
PREPARE_DOUBLE_RUN_RUNTIME_DIGEST =
  15f9a591e25fb1dca99c2a02d8362c83e41f4a932ca0710d97a602e18a8234ad
```

### 3.5 Human Principal administration authority split（本 amendment）

本 Program 不拥有 Human/User Principal administration 的任何具体规范
语义。该 authority 已由本 amendment 正式委托给独立 Child Spec：

```text
HUMAN_PRINCIPAL_ADMINISTRATION_AUTHORITY =
  AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1

HUMAN_PRINCIPAL_ADMINISTRATION_PR =
  mayf3/auth-service#15

HUMAN_PRINCIPAL_ADMINISTRATION_HEAD =
  98ec29a1152bfa9530c572ec5a541ea02df163c4

HUMAN_PRINCIPAL_ADMINISTRATION_STATUS =
  proposed / independently semantically reviewed / not accepted

PR_2_OWNS_HUMAN_PRINCIPAL_ADMINISTRATION = NO
```

以下规范语义全部由
`AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`（PR #15）承接，本 Spec
及其 Acceptance 不再拥有、不重复定义：

- Human/User create；
- existing User claim；
- canonical User status query；
- minimal Human directory；
- enable；
- disable；
- Human administration operator scopes；
- approval；
- durable administration audit；
- administration idempotency；
- administration outcome_unknown；
- repository mapping boundary。

password reset / credential replacement 不属于 Human Principal
administration authority，必须保留为独立 credential-only Child：

```text
PASSWORD_RESET =
  OUTSIDE_AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1

PASSWORD_RESET_AUTHORITY =
  SEPARATE_CREDENTIAL_ONLY_CHILD_REQUIRED

PLANNED_CREDENTIAL_CHILD_ID =
  AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1

PLANNED_CREDENTIAL_CHILD_STATUS =
  planned / not yet an authority
```

本 Spec 不定义 password reset 的任何管理面 Contract；该 Child 必须经
独立 Spec 流程创建、评审与接受，不得由
`AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1` 吞并，也不得由本
Program 吞并。

旧占位名称的处置：

```text
LEGACY_PLACEHOLDER_ID =
  AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1

AUTHORITY_STATUS =
  NONE

DISPOSITION =
  historical placeholder only

MUST_NOT_BE_USED_AS_AUTHORITY =
  YES
```

`AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1` 是本 Spec 早期修订中
预留的占位名称，从未成为 authority；它与 planned credential-only
Child（`AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1`）与 PR #15 Spec 均不
构成第二份 authority，任何新工作不得引用它作为 authority。

第二份 Human administration child 禁止：

```text
SECOND_HUMAN_PRINCIPAL_ADMINISTRATION_CHILD =
  FORBIDDEN

SOLE_HUMAN_ADMINISTRATION_CHILD =
  AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1
```

除非未来通过合法 whole-authority supersession 替代 PR #15 Spec，否则
不得创建第二份 Human Principal administration Spec；本 Program 的
Acceptance 只验证正确的 child authority 已存在且 exact Head 坐标匹配
（见 `CTR-AUTH-SHUTDOWN-029`、`ACC-AUTH-SHUTDOWN-011`），不重复 child
的字段、权限、审批、审计与失败语义。

## 4. Current State

### STATE-AUTH-SHUTDOWN-001 — V1 与 Legacy 鉴权面并存

- Subject: auth-service source runtime surface
- Repository/commit: mayf3/auth-service `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree（非部署声明）
- Observed at: 2026-08-19
- Basis: `OBS-AUTH-SHUTDOWN-001`、`OBS-AUTH-SHUTDOWN-002`
- Projection: 同时存在 Minimal Auth V1 面（frozen bundle 1.2.0、RS256、
  JWKS、Human Code+PKCE、opaque Refresh/Session/Family、Direct Machine
  Token、Trusted Proxy/OBO、per-audience Grant、V1 management creation
  ops）与 Legacy 面（`/api/auth/*`、HS256、shared-secret fallback、
  in-memory Refresh revocation `Map`、`/api/users/*`、`/api/roles/*`、
  `/api/services/*` SSO Gateway 与通用 `verify-token`、V0 flat fields、
  V0 exchange、`AUTH_CONTRACT_MODE` 双栈开关、Legacy
  backfill/repair/cleanup mutator）。

### STATE-AUTH-SHUTDOWN-002 — V1 provisioning seam 存在 mutation 副作用

- Subject: auth-service V1 management provisioning routes
- Repository/commit: mayf3/auth-service `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree
- Observed at: 2026-08-19
- Basis: `OBS-AUTH-SHUTDOWN-003`、`OBS-AUTH-SHUTDOWN-004`
- Projection: 仅存在 `POST /api/v1/principals`、`POST /api/v1/clients`
  两个 creation-capable route；`expected_client_id` 进入
  `createOrGetClient` claim path 可执行 `updateMany(... data:
  { externalRef })`；`createOrGetPrincipal` 存在 request-digest backfill
  路径；不存在按 public `client_id` 的 read-only deterministic route。

### STATE-AUTH-SHUTDOWN-003 — management response freshness 未被证明

- Subject: auth-service HTTP response cache behavior
- Repository/commit: mayf3/auth-service `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree（无运行时观测）
- Observed at: 2026-08-19
- Basis: `OBS-AUTH-SHUTDOWN-005`
- Projection: 通用 `/api/v1/...` management response 没有由本 Spec 证明
  的统一 `no-store` contract；authentication / authorization / not-found /
  internal-error response 也不能被假定自动携带 no-store headers。

### STATE-AUTH-SHUTDOWN-004 — 外部 caller 无 read-only resolution 能力

- Subject: dsh-agent-core credential provisioning auth client
- Repository/commit: mayf3/dsh-agent-core PR #17 reviewed head
  `c42438bc74a6b1e7de4a933d7a590e1f96a18373`（implementation evidence）；
  governing authority 见 §3.2 pinned revision
- Environment: source tree
- Observed at: 2026-08-19
- Basis: `OBS-AUTH-SHUTDOWN-006`、`OBS-AUTH-SHUTDOWN-008`
- Projection: caller 只能通过 creation-capable S1/S2 与 auth-service
  交互，没有 read-only client resolution call。

### STATE-AUTH-SHUTDOWN-005 — 治理已激活，本 Spec 为未合并 proposed 候选

- Subject: 本 Spec 的 lifecycle
- Repository/commit: mayf3/auth-service governance base
  `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`；本文件当前 Head（见
  PR #2）
- Environment: repository authority branch 状态：未合并
- Observed at: 2026-08-20
- Basis: `OBS-AUTH-SHUTDOWN-007`、迁移 provenance（§0）
- Projection: `status: proposed`；不是活动 authority；历史 review 不绑定
  本 Head；需要新的 independent semantic review 后由 Owner 决定是否
  accept。

### STATE-AUTH-SHUTDOWN-006 — State F auth-side prerequisite 已在 Spec 层解决，端到端仍未关闭

- Subject: Agent Core State F end-to-end implementability
- Repository/commit: 本 Spec（auth-side）；外部 authority pinned
  revision（caller-side）
- Environment: spec-level 状态，非实现状态
- Observed at: 2026-08-20
- Basis: `CLM-AUTH-SHUTDOWN-002`、`CLM-AUTH-SHUTDOWN-003`、
  `EVD-AUTH-SHUTDOWN-002`、`EVD-AUTH-SHUTDOWN-003`
- Projection:
  `AUTH_SERVICE_READ_ONLY_RESOLUTION_CONTRACT = DEFINED_AT_SPEC_LEVEL`；
  `AUTH_SERVICE_SIDE_STATE_F_PREREQUISITE = RESOLVED_AT_SPEC_LEVEL`；
  `STATE_F_END_TO_END_IMPLEMENTABILITY =
  BLOCKED_BY_AGENT_CORE_CALLER_SPEC_ALIGNMENT`；
  `STATE_F_IMPLEMENTABILITY_BLOCKER = NOT_FULLY_RESOLVED`。

### STATE-AUTH-SHUTDOWN-007 — Parent authority 已切换为 accepted V2；本 Spec 仍为未合并 proposed 候选

- Subject: 本 Spec 的 parent authority 与 lifecycle
- Repository/commit: mayf3/auth-service evaluated base
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`；本文件 current Head
  （见 PR #2）
- Environment: repository authority branch 状态：未合并
- Observed at: 2026-08-22
- Basis: `OBS-AUTH-SHUTDOWN-009`、V2 realignment provenance（§0）
- Projection: `PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2`
  （`PARENT_AUTHORITY_STATUS = accepted`；
  `PARENT_ACCEPTED_HEAD = 842fccb...`；
  `PARENT_MERGE_COMMIT = 37edaa6...`）；
  `PARENT_PRODUCTION_EFFECTIVE = NO`；
  `MINIMAL_AUTH_FOUNDATION_V1 = SUPERSEDED_HISTORICAL_AUTHORITY`；
  `status: proposed`；历史 review 不绑定本 Head；需要新的
  independent semantic review 后由 Owner 决定是否 accept。

### STATE-AUTH-SHUTDOWN-008 — 当前 base 的 accepted siblings、Human administration 拆分与新增 tracked paths

- Subject: evaluated base 上与 Minimal Auth 相关的 accepted Specs、
  authority 拆分与 source 实现事实
- Repository/commit: mayf3/auth-service
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`（human administration
  split amendment Head
  `7a2a4991d476f9272b5b9a348b3aa2cdd63a5495` 为本 PR 分支先行提交）
- Environment: source tree（非部署声明）
- Observed at: 2026-08-22
- Basis: `OBS-AUTH-SHUTDOWN-010`、§3.5
- Projection:
  `AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1 =
  accepted`（implementation Head
  `c67148cf35ecca2eeb4c4ff85a4478697d4ab2ab`，merge
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`）；
  `SOURCE_IMPLEMENTATION_PRESENT_ON_MAIN = YES`；
  `PRODUCTION_RECONCILIATION_EFFECTIVE =
  NOT_INFERRED_FROM_SPEC_MERGE`；
  `PROGRAM_PRODUCT_SEMANTIC_DELTA_FROM_THIS_MERGE = NONE`；
  `STAGE_W_EXECUTION_V2 = accepted`；
  `STAGE_F_SOURCE_IMPLEMENTATION_PRESENT = YES`；
  `STAGE_F_PRODUCTION_EFFECTIVE = NOT_INFERRED_FROM_SOURCE_MERGE`；
  `SVC_FORUM_AUDIENCE = registered`；
  `CURRENT_CONTRACT_VERSION = 1.3.0`；
  `PR_2_OWNS_HUMAN_PRINCIPAL_ADMINISTRATION = NO`（委托给
  `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`，PR #15 exact
  Head `98ec29a1152bfa9530c572ec5a541ea02df163c4`，见 §3.5）；
  相对 investigation base 新增 3 个 tracked path（见
  `CTR-AUTH-SHUTDOWN-025` 的
  `CURRENT_BASE_NEW_TRACKED_PATH_EVIDENCE`）。

### STATE-AUTH-SHUTDOWN-009 — 外部 authority 已重绑定；State F 端到端仍被 caller 实现阻塞

- Subject: Agent Core State F end-to-end implementability
- Repository/commit: 本 Spec（auth-side）；外部 authority pinned
  revision `d83a2ff0...`（caller-side authority）；dsh-agent-core
  main `d506f811...`（caller-side 实现，观察值）
- Environment: spec/source-level 状态，非部署状态
- Observed at: 2026-08-22
- Basis: `CLM-AUTH-SHUTDOWN-005`、`EVD-AUTH-SHUTDOWN-005`、
  `OBS-AUTH-SHUTDOWN-011`、`OBS-AUTH-SHUTDOWN-012`
- Projection:
  `EXTERNAL_AUTHORITY_PIN = d83a2ff0...`
  （`AMENDMENT_6_ACCEPTANCE_FINALIZE`；
  `EXTERNAL_AUTHORITY_DRIFT_AFTER_NEW_PIN = NO`）；
  `PHASE_A = CLEAN_BOOTSTRAP_ONLY`；
  `PHASE_B = EXISTING_CREDENTIAL_RECONCILIATION_TARGET`
  （`PHASE_B_IMPLEMENTATION_AUTHORITY = none`）；
  `CURRENT_AGENT_CORE_READ_ONLY_RESOLUTION_CALLER = ABSENT`；
  `STATE_F_END_TO_END_IMPLEMENTABILITY =
  BLOCKED_BY_EXTERNAL_CALLER_ALIGNMENT`；
  `STATE_F_GATE_CLOSED = NO`。

## 5. Observations

### OBS-AUTH-SHUTDOWN-001 — V1 面 inventory

- Subject: auth-service V1 authentication surface
- Source revision: `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree
- Observed at: 2026-08-19
- Method: source inspection
- Result: Frozen Minimal Auth V1 Contract Bundle 1.2.0；RS256 + `kid`；
  JWKS；V1 Human Authorization Code + PKCE；V1 opaque Refresh
  Credential、Session、Family 与 reuse detection；V1 Direct Machine
  Token；V1 Trusted Proxy / OBO；per-audience `MachineAccessGrant`；
  `/api/v1/principals` 与 `/api/v1/clients` 的 creation-capable V1
  management operations。
- Provenance: 仓库 source；审计报告见 `docs/audits/` 历史记录。

### OBS-AUTH-SHUTDOWN-002 — Legacy 面 inventory

- Subject: auth-service legacy authentication surface
- Source revision: `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree
- Observed at: 2026-08-19
- Method: source inspection
- Result: `/api/auth/*` 直接登录、注册、Agent Token Login、JWT Refresh；
  HS256 Access/Refresh Token；`authRequired` 中无 exact
  issuer/audience/profile 的 shared-secret-only fallback；进程内 Refresh
  Token revocation `Map`；`/api/users/*` 和 `/api/roles/*` 人员目录及
  角色修改接口；`/api/services/*` Legacy SSO Gateway、Service
  Registration 与通用 `verify-token`；V0
  `allowedResources[] + allowedScopes[]` 平面授权；V0 Token Exchange
  （不要求正式 TrustedProxy profile）；`AUTH_CONTRACT_MODE=v0|v1_shadow|v1`
  双栈开关；Legacy flat-field backfill、repair 与 cleanup mutator。
- Provenance: 仓库 source；`docs/DESIGN.md` 与历史审计为佐证材料。

### OBS-AUTH-SHUTDOWN-003 — S1/S2 mutation 副作用

- Subject: `createOrGetPrincipal` / `createOrGetClient`
- Source revision: `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree
- Observed at: 2026-08-19
- Method: source reading of claim/backfill paths
- Result: 这两个 Route 调用 `createOrGetPrincipal` / `createOrGetClient`；
  `expected_client_id` 进入 `createOrGetClient` 的 claim path；该 path
  可以执行 `updateMany(... data: { externalRef })`；
  `createOrGetPrincipal` 还存在 request-digest backfill 路径。
- Provenance: `src/routes/idempotent.ts` 与 `src/lib/oauth/v1/idempotent.ts`
  相关实现（该坐标下的 source 事实）。

### OBS-AUTH-SHUTDOWN-004 — 不存在 read-only resolution route

- Subject: auth-service route inventory
- Source revision: `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree
- Observed at: 2026-08-19
- Method: route/search inspection
- Result: 当前不存在按 public `client_id` 查询 MachineClient +
  MachinePrincipal 当前绑定的 read-only deterministic Route。
- Provenance: 仓库 route 目录搜索。

### OBS-AUTH-SHUTDOWN-005 — cache 行为未证明

- Subject: auth-service HTTP response cache headers
- Source revision: `main@84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source tree（无 runtime 观测）
- Observed at: 2026-08-19
- Method: middleware/response path inspection
- Result: 未见由本 Spec 证明的统一 `no-store` contract；不能假定
  默认中间件提供 freshness。
- Provenance: middleware 与 response helper 源码检查。

### OBS-AUTH-SHUTDOWN-006 — 外部 caller 只有 ensure 调用

- Subject: dsh-agent-core auth client
- Source revision: mayf3/dsh-agent-core PR #17 reviewed head
  `c42438bc74a6b1e7de4a933d7a590e1f96a18373`
- Environment: source tree
- Observed at: 2026-08-19
- Method: source inspection of
  `packages/agent-credential-provisioning/src/auth-client.js`
- Result: 该 reviewed Head 的 Auth client 只有
  `ensurePrincipal → POST /api/v1/principals` 与
  `ensureClient → POST /api/v1/clients`，没有 read-only client
  resolution call。
- Provenance: §3.3 evidence object。

### OBS-AUTH-SHUTDOWN-007 — 治理采用已激活

- Subject: auth-service development governance adoption
- Source revision: `main@1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`
- Environment: repository authority branch（github origin/main）
- Observed at: 2026-08-20
- Method: `git fetch` + lock inspection +
  `python3 .agents/tools/verify_governance.py --target . --require-accepted`
- Result: vendored governance bytes match `governance.lock.json`；
  `adoption.status = accepted`（accepted_by = mayf3，2026-08-19）；
  `docs/specs/` 为 governing Spec 目录，`.agents/specs/` 不是。
- Provenance: PR #3 merge `1da40d4`；`.agents/governance.lock.json`。

### OBS-AUTH-SHUTDOWN-008 — 外部 governing authority 已 accepted

- Subject: `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`
- Source revision: mayf3/dsh-agent-core
  `5cfb61025641f8ec2430d0b9d39ad0cb8348124e`（origin/main）
- Environment: 外部仓库 authority branch
- Observed at: 2026-08-20
- Method: fetch + frontmatter + history inspection
- Result: frontmatter `status: accepted`；acceptance finalize commit
  `5cfb610`（text-only lifecycle finalization of reviewed head
  `610c6b8`）；该文件到当前 origin/main 零 drift。该 authority 内容包含
  credential-provisioning 的 S1/S2 ensure sequencing。
- Provenance: §3.2 核实记录。

### OBS-AUTH-SHUTDOWN-009 — V2 已 accepted 并合入 main

- Subject: `MINIMAL_AUTH_FOUNDATION_V2` lifecycle 与 index truth
- Source revision: accepted Head
  `842fccb384448d7f1bb43919048ce579fac9df96`；merge
  `37edaa6f8c56749eaa16c0bbbb0c0c75d8c6a1eb`；观察 base
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`
- Environment: repository authority branch（github origin/main）
- Observed at: 2026-08-22
- Method: fetch + frontmatter/authority-graph/index inspection
- Result: V2 `status: accepted`；`docs/specs/README.md` 与
  `.agents/local/README.md` 记录 V2 = accepted / current、V1 =
  superseded / historical；本 PR #2 Spec 行仍为 proposed / none。
- Provenance: PR #7 merge `37edaa6`；`docs/specs/README.md`；
  `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md`。

### OBS-AUTH-SHUTDOWN-010 — svc-forum registry reconciliation Spec accepted 且实现已合入；human administration 已拆分

- Subject: `AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1`
  三文件实现闭包与 PR #2 human administration split amendment
- Source revision: Spec 经 merge
  `7e3be3d0be92c49f1c62f762145c8675ef8b3227` 合入；implementation
  Head `c67148cf35ecca2eeb4c4ff85a4478697d4ab2ab`；merge
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`；human split Head
  `7a2a4991d476f9272b5b9a348b3aa2cdd63a5495`（本 PR 分支）
- Environment: repository authority branch（github origin/main）
- Observed at: 2026-08-22
- Method: fetch + merge history + tracked path inspection
- Result: Spec accepted / contracts（三文件闭包）；新增 3 个 tracked
  path：`scripts/reconcile-svc-forum-audience-registry-v1.ts`、
  `scripts/run-svc-forum-audience-registry-v1-conformance.sh`、
  `tests/oauth/reconcile-svc-forum-audience-registry-v1.test.ts`；
  上述 merge 不改变本 Program 语义，也不证明生产 reconciliation 已
  执行；human administration authority 已由本 PR 先行 amendment
  委托给 PR #15 Child（§3.5）。
- Provenance: PR #17 / PR #16 merge records；`git diff --name-status
  7e3be3d..f5c2305`；PR #2 分支 commit `7a2a499`。

### OBS-AUTH-SHUTDOWN-011 — 外部 authority 在新 pin 上零 drift

- Subject: `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` 文件字节
- Source revision: pin
  `d83a2ff0e9644611707d7481ef88b4d7d49fb68e`；dsh-agent-core
  origin/main `d506f81105e8aa05177a01b817ebe11dcc076ba5`
- Environment: 外部仓库 authority branch
- Observed at: 2026-08-22
- Method: `git rev-parse <rev>:<path>` blob 比较
- Result: blob @ pin = blob @ main =
  `df74e92759ad3083328dfd337667fc8a4ec618a0`；
  `EXTERNAL_AUTHORITY_DRIFT_AFTER_NEW_PIN = NO`。Amendment 6
  （PHASE_A / PHASE_B）语义见 §3.2。
- Provenance: §3.2 核实与重绑定记录。

### OBS-AUTH-SHUTDOWN-012 — Agent Core 当前实现没有 read-only resolution caller

- Subject: dsh-agent-core credential provisioning auth client
- Source revision: mayf3/dsh-agent-core origin/main
  `d506f81105e8aa05177a01b817ebe11dcc076ba5`
- Environment: source tree
- Observed at: 2026-08-22
- Method: source inspection of
  `packages/agent-credential-provisioning/src/auth-client.js`
- Result: 该文件只调用 `POST /api/v1/principals`、
  `POST /api/v1/clients`、`POST /oauth/token`；不存在 read-only
  client resolution call（`CURRENT_AGENT_CORE_READ_ONLY_RESOLUTION_CALLER
  = ABSENT`）。
- Provenance: §3.2 当前实现证据块。

### OBS-AUTH-SHUTDOWN-013 — 本轮 prepare 双运行 digest 一致

- Subject: Minimal Auth V1 Contract `1.3.0` snapshot 可复现性
- Source revision: 本 amendment worktree（evaluated base
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e` + 本 PR 文件）
- Environment: 本地 clean task worktree（node 同环境连续执行）
- Observed at: 2026-08-22
- Method: 连续两次执行 `scripts/prepare-minimal-auth-v1.mjs`
- Result: 两次输出完全一致：
  `sourceBundleDigest =
  977ebacdf87d80650b42c7b8699a109fffd9d884228c8b6bfe23319e896a17fc`；
  `runtimeDigest =
  15f9a591e25fb1dca99c2a02d8362c83e41f4a932ca0710d97a602e18a8234ad`。
- Provenance: §3.4 双运行记录；执行输出保存在本 PR authoring
  execution record。

## 6. Claims and assumptions

### CLM-AUTH-SHUTDOWN-001 — 当前 S1/S2 不能作为 State F resolution 探针

- Support state: SUPPORTED
- Supported by evidence: `EVD-AUTH-SHUTDOWN-001`
- Contradicted by evidence: none known
- Uncertainty: 仅覆盖被观测 source revision；未来实现变化不改变本 Spec
  的 normative 边界。
- 解释：把 creation-capable S1/S2 当探针会引入先 create / claim /
  digest-backfill 再报告 State F 的路径，违反
  `NO_DUPLICATE_IDENTITIES` 与 `FAIL_LOUD_BEFORE_MUTATION`。

### CLM-AUTH-SHUTDOWN-002 — Auth 侧缺少 read-only resolution seam 是 State F 的 auth-side prerequisite blocker

- Support state: SUPPORTED
- Supported by evidence: `EVD-AUTH-SHUTDOWN-002`
- Contradicted by evidence: none known
- Uncertainty: spec-level 结论；实现完成后由 `AC-R*`（见 §10）验证。
- 解释：credential store 已存在时，caller 需要在任何 identity mutation
  之前区分 stored client missing、Client revoked/inactive、external-ref
  mismatch or null、Principal disabled/inactive、Principal profile
  mismatch；缺少只读 seam 使该分类不可能不产生副作用地完成。

### CLM-AUTH-SHUTDOWN-003 — State F 端到端 implementability 仍被 Agent Core caller spec alignment 阻塞

- Support state: SUPPORTED
- Supported by evidence: `EVD-AUTH-SHUTDOWN-003`
- Contradicted by evidence: none known
- Uncertainty: 外部 authority 可能经其自身流程 amendment；本 Claim 绑定
  §3.2 pinned revision。
- 解释：pinned external authority 仍要求先调用 S1/S2 再进入 D/E/F/G
  分类；auth-service 定义 endpoint Contract 不能单方面关闭 caller 侧
  sequencing。

### CLM-AUTH-SHUTDOWN-004 — freshness 必须是本 endpoint 的显式 Contract

- Support state: SUPPORTED
- Supported by evidence: `EVD-AUTH-SHUTDOWN-004`
- Contradicted by evidence: none known
- Uncertainty: 无 runtime 观测；结论为"不能依赖默认中间件"，不是
  "当前一定存在缓存"。
- 解释：新鲜度是 mutation-before-check 语义的前提，必须显式冻结为
  no-store/no-cache Contract（`CTR-AUTH-SHUTDOWN-013`）。

### CLM-AUTH-SHUTDOWN-005 — Amendment 6 的出现不关闭 State F；端到端仍被 external caller alignment 阻塞

- Support state: SUPPORTED
- Supported by evidence: `EVD-AUTH-SHUTDOWN-005`
- Contradicted by evidence: none known
- Uncertainty: 外部 authority 可能继续经其自身流程 amendment；本
  Claim 绑定 §3.2 pinned revision `d83a2ff0...`。
- 解释：Amendment 6 在 spec 层冻结了 PHASE_A（store entry 存在 →
  `existing_credential_resolution_required`，Auth 调用为零）与
  PHASE_B 目标语义（implementation authority = none），方向与本
  Program 的 resolution Contract 一致；但 caller 侧 read-only
  resolution 实现（fixed-SHA）与 State F E2E 仍不存在，
  `GATE_AGENT_CORE_RESOLUTION_CALLER_FIXED_SHA` 与
  `GATE_STATE_F_NO_MUTATION_BEFORE_RESOLUTION_E2E` 仍无证据。
  `STATE_F_GATE_CLOSED = NO`。

## 7. Evidence relations

### EVD-AUTH-SHUTDOWN-001 — S1/S2 副作用观测支持探针不可用 Claim

- Source observations: `OBS-AUTH-SHUTDOWN-003`、`OBS-AUTH-SHUTDOWN-004`
- Target: `CLM-AUTH-SHUTDOWN-001`
- Relation: SUPPORTS
- Bound coordinates: mayf3/auth-service
  `84890120bd385b39287cb81890236b0e73e96c8d`，source tree，observed
  2026-08-19
- Strength/sufficiency: direct source reading，sufficient for the
  observed revision
- Limitations: 不覆盖未来 revision；不构成对实现行为的 runtime 证明
- Provenance: OBS 条目引用的 source 路径

### EVD-AUTH-SHUTDOWN-002 — 缺少只读 seam 的观测支持 auth-side blocker Claim

- Source observations: `OBS-AUTH-SHUTDOWN-003`、`OBS-AUTH-SHUTDOWN-004`、
  `OBS-AUTH-SHUTDOWN-006`
- Target: `CLM-AUTH-SHUTDOWN-002`
- Relation: SUPPORTS
- Bound coordinates: auth-service `84890120...` 与 dsh-agent-core
  reviewed head `c42438b...`，source tree，observed 2026-08-19
- Strength/sufficiency: 双仓库 source-level trace
- Limitations: 外部 caller 行为以 reviewed head 为坐标
- Provenance: §3.3 evidence object

### EVD-AUTH-SHUTDOWN-003 — 外部 authority 内容支持 State F 阻塞 Claim

- Source observations: `OBS-AUTH-SHUTDOWN-006`、`OBS-AUTH-SHUTDOWN-008`
- Target: `CLM-AUTH-SHUTDOWN-003`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core pinned revision
  `5cfb61025641f8ec2430d0b9d39ad0cb8348124e`（authority）与 reviewed
  implementation head `c42438b...`，observed 2026-08-19/2026-08-20
- Strength/sufficiency: authority frontmatter + 内容 inspection
- Limitations: 外部 amendment 后需重新 pin；本 Evidence 不评价外部
  authority 的正确性
- Provenance: §3.2、§3.3

### EVD-AUTH-SHUTDOWN-004 — cache 未证明观测支持显式 freshness Claim

- Source observations: `OBS-AUTH-SHUTDOWN-005`
- Target: `CLM-AUTH-SHUTDOWN-004`
- Relation: SUPPORTS
- Bound coordinates: auth-service `84890120...`，source tree，observed
  2026-08-19
- Strength/sufficiency: absence-of-proof 观测足以支撑"必须显式冻结"
  的 normative 结论
- Limitations: 非运行时测量
- Provenance: OBS-AUTH-SHUTDOWN-005

### EVD-AUTH-SHUTDOWN-005 — 外部 authority 与 caller 实现观测支持 State F 仍阻塞 Claim

- Source observations: `OBS-AUTH-SHUTDOWN-011`、
  `OBS-AUTH-SHUTDOWN-012`
- Target: `CLM-AUTH-SHUTDOWN-005`、`STATE-AUTH-SHUTDOWN-009`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core pin `d83a2ff0...`（authority）
  与 main `d506f811...`（实现观察），observed 2026-08-22
- Strength/sufficiency: authority blob 比较 + caller source
  inspection，sufficient for the pinned revisions
- Limitations: 不覆盖外部仓库未来 revision；不评价外部 authority
  的正确性
- Provenance: §3.2、OBS 条目引用的 source 路径

### EVD-AUTH-SHUTDOWN-006 — V2 与 sibling 实现观测支持 current-base State

- Source observations: `OBS-AUTH-SHUTDOWN-009`、
  `OBS-AUTH-SHUTDOWN-010`、`OBS-AUTH-SHUTDOWN-013`
- Target: `STATE-AUTH-SHUTDOWN-007`、`STATE-AUTH-SHUTDOWN-008`
- Relation: SUPPORTS
- Bound coordinates: auth-service `f5c2305b...`（含 V2 merge
  `37edaa6...`、reconciliation merge `f5c2305...`、本 PR human
  split Head `7a2a499...`），observed 2026-08-22
- Strength/sufficiency: authority-graph 与 merge-history inspection
  + 本轮真实双运行 digest
- Limitations: source-level；不证明任何生产 reconciliation 执行、
  部署或 production effectiveness
- Provenance: OBS 条目引用的 merge records 与执行输出

## 8. Decisions

以下 Owner 决策不得重新打开（`OWNER_DECISIONS_FROZEN = YES`，
`OWNER_DECISION_REQUIRED = NONE`）。旧标签 D1–D5 保留为 human-readable
alias；规范引用必须使用稳定 DEC ID。

### DEC-AUTH-SHUTDOWN-001 — Legacy 直接硬切（Legacy alias: D1）

- Decision owner: mayf3
- Decision:
  `LEGACY_MIGRATION_WINDOW = NONE`；`LEGACY_RUNTIME_ALLOWLIST = NONE`；
  `LEGACY_COMPATIBILITY_FLAG = NONE`；`LEGACY_NEW_CONSUMER = FORBIDDEN`。
  不保留按 Consumer、IP、Header、环境变量、路径或 Token Claim 开启
  Legacy 的例外。Consumer readiness 是生产部署 Gate，但不得成为 Cut
  Artifact 继续携带 Legacy runtime 的理由。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-001`
- Reason: 不继续保留最弱鉴权面。

### DEC-AUTH-SHUTDOWN-002 — 删除 `token-login`（Legacy alias: D2）

- Decision owner: mayf3
- Decision: `POST /api/auth/token-login = REMOVE`；
  `REPLACEMENT_BOOTSTRAP_ENDPOINT = NONE`；
  `AGENT_AS_USER_SESSION = FORBIDDEN`；`AGENT_REFRESH_TOKEN = FORBIDDEN`。
  Agent 的正式身份只有 MachinePrincipal + MachineClient +
  MachineAccessGrant。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-003`
- Reason: Owner 已决定删除且无 replacement。

### DEC-AUTH-SHUTDOWN-003 — 删除通用 `verify-token`（Legacy alias: D3）

- Decision owner: mayf3
- Decision: `POST /api/services/verify-token = REMOVE`；
  `CENTRAL_GENERIC_TOKEN_ORACLE = NONE`；
  `TOKEN_INTROSPECTION_ENDPOINT = NONE`；
  `RESOURCE_CONSUMER_LIVE_STATUS_LOOKUP = FORBIDDEN`。每个外部
  Resource Consumer 必须使用 JWKS 本地验证 Token，并严格绑定自己的
  audience、profile 和 scope。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-005`
- Reason: Resource Consumer 固定 offline-JWKS-only。

### DEC-AUTH-SHUTDOWN-004 — Minimal Auth V1 是唯一目标架构（Legacy alias: D4）

- Decision owner: mayf3
- Decision: 不重新设计 V1，不引入新的 Policy Engine、Sidecar、mTLS、
  TPM、Kernel Keyring 或新的 Token Broker。
- Rejected alternative: 见 `ALT-AUTH-SHUTDOWN-004`（架构重设计）
- Reason: 保持 frozen V1 architecture。

### DEC-AUTH-SHUTDOWN-005 — Hard cut 指运行时 authority（Legacy alias: D5）

- Decision owner: mayf3
- Decision: 首个实现 Child 必须删除 Legacy 路由、签发、验签、Refresh、
  flat-field backfill apply 和权限 authority。以下数据库结构可暂时作为
  dead data 保留以维持 whole-release rollback：`service_registrations`、
  `MachineClient.allowedResources`、`MachineClient.allowedScopes`、
  Legacy role/profile 字段、Legacy 审计记录。保留字段不得参与认证、
  签发、Refresh、Exchange、Resource Consumer authorization、Grant
  authority 或 readiness-derived authority。物理删除由
  `AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1` 管理。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-011`
- Reason: 运行时硬切不要求立即破坏 rollback。

### DEC-AUTH-SHUTDOWN-006 — auth-service operation 边界执行 live state check

- Decision owner: mayf3
- Decision: 见 `CTR-AUTH-SHUTDOWN-006` 的边界表。状态检查失败不得
  回退 Legacy，不得通过请求体 caller identity 绕过。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-005`（consumer live lookup）
- Reason: 状态必须在信任边界内检查，但不能成为 Consumer 的在线依赖。

### DEC-AUTH-SHUTDOWN-007 — 外部 Resource Consumer 固定为 offline-JWKS-only

- Decision owner: mayf3
- Decision: 见 `CTR-AUTH-SHUTDOWN-007`。外部 Consumer 本地、离线验证
  签名与 claims；不调用 auth-service introspection / management /
  resolution。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-005`
- Reason: 保持 frozen trust boundary，避免新的 live dependency。

### DEC-AUTH-SHUTDOWN-008 — Access Token 撤销语义为有效至 `exp`

- Decision owner: mayf3
- Decision: `ACCESS_TOKEN_REVOCATION_MODEL = NON_REVOCABLE_UNTIL_EXP`。
  见 `CTR-AUTH-SHUTDOWN-008`。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-006`
- Reason: 短 TTL + 状态变化阻止后续 issuance 已足够；不新增 blacklist
  体系。

### DEC-AUTH-SHUTDOWN-009 — 两个独立 inspect/resolution seam，operator lifecycle = host-local CLI

- Decision owner: mayf3
- Decision: operator lifecycle inspect/rotate/revoke/disable 是
  host-local trusted CLI（`src/cli/v1-machine-lifecycle.ts` +
  `src/lib/oauth/v1/lifecycle.ts`），不注册 HTTP Route；online
  provisioning resolution 是 authenticated management GET。二者不得
  合并（见 `CTR-AUTH-SHUTDOWN-019` 的维度表）。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-007`、`ALT-AUTH-SHUTDOWN-013`
- Reason: caller、输出与 authority 不同；不得模糊 trust boundary。

### DEC-AUTH-SHUTDOWN-010 — Online provisioning read-only resolution = REQUIRED

- Decision owner: mayf3
- Decision: `ONLINE_PROVISIONING_CLIENT_RESOLUTION = REQUIRED`；endpoint
  为 `GET /api/v1/clients/:client_id`，由 authenticated `svc-auth`
  management Service principal 调用，fresh、read-only、zero-write、
  no-cache。Auth 侧 Contract 在本 Spec 定义（§9 CTR-009..018）；
  auth-service 侧 State F prerequisite 就此在 Spec 层解决。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-012`、`ALT-AUTH-SHUTDOWN-015`
- Reason: 需要 mutation-before-check 的确定性只读事实源。

### DEC-AUTH-SHUTDOWN-011 — Flat-field migration = PRE_CUT_ONLY；readiness 只读

- Decision owner: mayf3
- Decision: `FLAT_FIELD_TO_V1_GRANT_MIGRATION = PRE_CUT_ONLY`；
  `POST_CUT_BACKFILL_APPLY = FORBIDDEN`；readiness 是严格只读证据工具。
  见 `CTR-AUTH-SHUTDOWN-020`、`CTR-AUTH-SHUTDOWN-021`。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-008`
- Reason: post-cut 写路径会重建 Legacy authority。

### DEC-AUTH-SHUTDOWN-012 — Production lifecycle 字段只由 Activation Child 更新

- Decision owner: mayf3
- Decision: Shutdown Spec、Runtime Child、Consumer Migration PR 均不得
  设置 production-effective / `supersedes_v0` / consumer complete 字段。
  见 `CTR-AUTH-SHUTDOWN-026`。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-009`
- Reason: 防止局部完成被宣布为全局生效。

### DEC-AUTH-SHUTDOWN-013 — Human administration children 是 activation blocker

- Decision owner: mayf3
- Decision: 生产激活前必须存在 accepted、implemented、
  independently-reviewed 的两个独立 Child：Human Principal
  administration Child `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`
  （PR #15，exact Head
  `98ec29a1152bfa9530c572ec5a541ea02df163c4`）与独立 credential-only
  Child（planned `AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1`）。见
  §3.5 与 `CTR-AUTH-SHUTDOWN-029`。公开注册保持删除。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-010`
- Reason: User create/claim/status/enable/disable 与 password reset
  必须受控并持久审计；二者分别由各自 Child Spec 拥有具体规范语义，
  本 Program 仅持有 prerequisite 与坐标校验。

### DEC-AUTH-SHUTDOWN-014 — Runtime/config fail-closed authority

- Decision owner: mayf3
- Decision: `AUTH_CONTRACT_MODE` 从 runtime design 删除；Cut Artifact
  不存在 v0/v1_shadow/Legacy fallback；启动流程按 pinned snapshot、
  digest、issuer、key 校验 fail-closed。见
  `CTR-AUTH-SHUTDOWN-022`。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-002`
- Reason: 不存在双协议 Artifact、mode switch 或 per-request fallback。

### DEC-AUTH-SHUTDOWN-015 — Implementation Child 序列固定

- Decision owner: mayf3
- Decision: Child 0 = Human administration（拆分为 Human Principal
  administration Child `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`
  （PR #15）与独立 credential-only Child（planned
  `AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1`），见 §3.5）；Child 1 =
  V1-only runtime（仅在本 Spec accepted 并进入 implementation base 后
  启动，范围严格等于 source disposition manifest）；Cross-repository
  prerequisite = Agent Core in-place amendment；Child 2 = Consumer
  migrations；Child 3 = Production activation；Child 4 = Legacy schema
  cleanup。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-009`（Runtime Child 直接设置
  production effective）
- Reason: 分阶段授权与 gate 分离。

### DEC-AUTH-SHUTDOWN-016 — Rollback = whole-release only

- Decision owner: mayf3
- Decision: 唯一代码回滚是回滚到上一个 immutable artifact 的
  whole-release rollback；Cut Artifact 不包含任何 Legacy 重启用 seam。
  见 `CTR-AUTH-SHUTDOWN-028`。
- Rejected alternative: Legacy allowlist / compat flag（`ALT-AUTH-SHUTDOWN-001`）
- Reason: 避免 Legacy 复活路径。

### DEC-AUTH-SHUTDOWN-017 — External refs 对 Auth opaque；比较责任在 caller

- Decision owner: mayf3
- Decision: Auth 只返回当前事实；caller 负责比较 expected
  client_id / client_external_ref / principal_external_ref /
  principal_type / agent_id / owner_user_id policy。Auth 不得解释或生成
  `agentcore:v1:client:<agentId>` / `agentcore:v1:principal:<agentId>`
  prefix 语义，不得自动 reconcile、创建 replacement identity 或根据
  prefix 选择 policy。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-014`、`ALT-AUTH-SHUTDOWN-015`
- Reason: external-ref 语义由外部 authority 拥有；本地不重定义。

### DEC-AUTH-SHUTDOWN-018 — Resolution exact error Wire 是 route-local exact-path policy

- Decision owner: mayf3
- Decision: `GET /api/v1/clients/:client_id` 的错误响应使用封闭
  exact Wire `{"error":"<exact_code>"}`（由
  `CTR-AUTH-SHUTDOWN-014` 冻结完整映射表）；MUST NOT 复用普通
  `{"message":"..."}` envelope；该 Wire 是 route-local exact-path
  policy，MUST NOT 扩展到其他 endpoint（非影响边界由
  `CTR-AUTH-SHUTDOWN-018` 冻结）。
- Rejected alternative: `ALT-AUTH-SHUTDOWN-019`
- Reason: caller 需要可执行、稳定、无歧义的 management error
  Wire；其他 endpoint 的既有 Wire 语义不受本 Decision 影响
  （`PRODUCT_SEMANTIC_DELTA = NONE`）。

保持冻结的 Owner 决策清单（不得重新打开）：

```text
LEGACY_MIGRATION_WINDOW = NONE
LEGACY_RUNTIME_ALLOWLIST = NONE
LEGACY_COMPATIBILITY_FLAG = NONE

POST /api/auth/token-login = REMOVE
TOKEN_LOGIN_REPLACEMENT = NONE

POST /api/services/verify-token = REMOVE
GENERIC_INTROSPECTION_REPLACEMENT = NONE

Resource Consumers offline-JWKS-only
Access Tokens valid until exp
operator lifecycle = host-local CLI
provisioning resolution = authenticated read-only GET
flat-field migration = PRE_CUT_ONLY
post-cut backfill/repair = forbidden
production activation separate
Human Principal administration Child + credential-only Child required
Agent Core State F end-to-end closure remains external dependency
```

## 9. Contracts

本节把全部 MUST / MUST NOT / REQUIRED / FORBIDDEN 语义收敛为显式
Contract。旧 prose、表格与状态摘要中的 normative 内容在此都有 CTR ID；
引用一律使用 `<SPEC_ID>#<CTR-ID>`。

### CTR-AUTH-SHUTDOWN-001 — Legacy runtime 硬切与路由删除

Cut Artifact MUST 直接删除 Legacy runtime：不存在 migration window、
runtime allowlist、compatibility flag 或任何按 Consumer、IP、Header、
环境变量、路径、Token Claim 重新启用 Legacy 的例外
（`LEGACY_NEW_CONSUMER = FORBIDDEN`）。

必须删除的公开接口（删除后由缺失路由产生 `404`；MUST NOT 返回兼容
提示、迁移 Token、Redirect 或 Legacy proxy response）：

| Surface | Disposition |
|---|---|
| `/api/auth/login` | DELETE_ROUTE |
| `/api/auth/register` | DELETE_ROUTE |
| `/api/auth/token-login` | DELETE_ROUTE |
| `/api/auth/refresh` | DELETE_ROUTE |
| `/api/auth/me` | DELETE_ROUTE |
| `/api/auth/change-password` | DELETE_ROUTE |
| `/api/users` and `/api/users/*` | DELETE_ROUTE |
| `/api/roles` and `/api/roles/*` | DELETE_ROUTE |
| `/api/services` and `/api/services/*` | DELETE_ROUTE |
| `/api/services/verify-token` | DELETE_ROUTE |
| `/api/services/lookup/*` | DELETE_ROUTE |

保留的公开 OAuth/JWKS/health 接口（frozen semantics）：

| Method | Path | Frozen semantics |
|---|---|---|
| GET | `/api/health` | 报告服务与当前 V1 runtime identity；不得宣称 production-effective |
| GET | `/.well-known/jwks.json` | 发布 active + retained previous public verification keys |
| GET | `/oauth/authorize` | V1 Human Authorization Code initiation；PKCE S256 required |
| POST | `/oauth/authorize/authenticate` | V1 Human authentication and authorization-code issuance |
| POST | `/oauth/token` | 仅支持 V1 `authorization_code`、`refresh_token`、`client_credentials`、RFC 8693 token exchange |
| POST | `/oauth/logout` | 撤销 V1 Human Session / Refresh Family；不撤销已签发 Access Token |

保留的 V1 online management 接口：

| Method | Path | Frozen semantics |
|---|---|---|
| POST | `/api/v1/principals` | V1 idempotent MachinePrincipal provisioning；creation/claim capable；`svc-auth` management Token required |
| POST | `/api/v1/clients` | V1 idempotent MachineClient provisioning；creation/claim capable；`svc-auth` management Token required |
| GET | `/api/v1/clients/:client_id` | Fresh, generic, read-only MachineClient + MachinePrincipal resolution by public `mc_*` client ID；zero DB writes；no-store |

### CTR-AUTH-SHUTDOWN-002 — `token-login` 删除且无替代

`POST /api/auth/token-login` MUST 被删除；
`REPLACEMENT_BOOTSTRAP_ENDPOINT = NONE`；`AGENT_AS_USER_SESSION` 与
`AGENT_REFRESH_TOKEN` FORBIDDEN。Agent 的正式身份只有 MachinePrincipal
+ MachineClient + MachineAccessGrant。

### CTR-AUTH-SHUTDOWN-003 — 通用 `verify-token` 删除且无 introspection

`POST /api/services/verify-token` MUST 被删除；
`CENTRAL_GENERIC_TOKEN_ORACLE = NONE`；
`TOKEN_INTROSPECTION_ENDPOINT = NONE`；
`RESOURCE_CONSUMER_LIVE_STATUS_LOOKUP = FORBIDDEN`。每个外部 Resource
Consumer MUST 使用 JWKS 本地验证并严格绑定自己的 audience、profile、
scope。

### CTR-AUTH-SHUTDOWN-004 — V1 单一架构

MUST NOT 引入新的 Policy Engine、Sidecar、mTLS、TPM、Kernel Keyring
或新的 Token Broker；不重新设计 V1。

### CTR-AUTH-SHUTDOWN-005 — 运行时 authority 切割与 dead data 边界

首个 Runtime Child MUST 删除 Legacy 路由、签发、验签、Refresh、
flat-field backfill apply 和权限 authority。§DEC-005 列出的数据库结构
MAY 暂时作为 dead data 保留；保留字段 MUST NOT 参与认证、签发、
Refresh、Exchange、Resource Consumer authorization、Grant authority
或 readiness-derived authority。物理删除由
`AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1` 管理。

### CTR-AUTH-SHUTDOWN-006 — auth-service operation 的 live state check 边界

auth-service MUST 在下列边界执行 live state check：

| Boundary | Required live state |
|---|---|
| Human authentication | `User.status=active`、`HumanClient.status=active`、Redirect URI 与 HumanAudienceGrant 当前有效 |
| Authorization Code exchange | User、HumanClient、AuthorizationTransaction、AuthorizationCode、Audience Grant 当前有效且未消费 |
| Human refresh | User、HumanClient、HumanSession、RefreshFamily、RefreshCredential 与 target HumanAudienceGrant 当前有效 |
| Direct machine issuance | MachinePrincipal、MachineClient、AuthAudience、MachineAccessGrant 当前有效且彼此绑定 |
| Token exchange | Proxy Principal/Client、TrustedProxy、original Principal/Client、source Audience、target Audience、original Grant、Delegation Grant 当前有效 |
| auth-service mutating online management | actor Principal/Client 当前有效；target 状态与 optimistic version 满足操作前置条件 |
| provisioning read-only resolution | actor 是 authenticated `svc-auth` management Service principal；新鲜、只读返回 target Client/Principal 当前绑定事实 |
| operator-only lifecycle seam | target 当前有效或已进入允许的幂等终态；mutation 写入持久审计事实 |

状态检查失败 MUST NOT 回退 Legacy，MUST NOT 通过请求体 caller
identity 绕过。

### CTR-AUTH-SHUTDOWN-007 — 外部 Resource Consumer = offline-JWKS-only

外部 Resource Consumer MUST 只执行：

```text
JWT signature + known kid
exact issuer
exact local audience
exact token profile
exact token_use/version
exp/nbf/iat
required scope
consumer-local business authorization
```

外部 Consumer MUST NOT：

- 调用 auth-service introspection；
- 调用 `/api/v1/clients/:client_id` 或其他 management endpoint；
- 在每次资源请求中访问 auth-service 数据库；
- 把 auth-service lifecycle CLI 暴露为网络 API；
- 因无法查询 live status 而尝试 Legacy `verify-token`。

`GET /api/v1/clients/:client_id` 不属于 Consumer 验证链。Provisioning
control plane MAY 调用该 endpoint，但 MUST NOT 把它带入 Resource
Consumer request path。

### CTR-AUTH-SHUTDOWN-008 — Access Token 有效至 `exp`

`ACCESS_TOKEN_REVOCATION_MODEL = NON_REVOCABLE_UNTIL_EXP`。V1 Access
Token 一经成功签发，在签名、Claims 与时间窗口有效的前提下，外部
Consumer 接受到 `exp`。Principal、Client、User、Session 或 Proxy 随后
disable/revoke MUST NOT 追溯撤销已签发 Access Token；状态变化 MUST
立即阻止后续 authentication、issuance、refresh、exchange 与
auth-service management mutation。MUST NOT 新增 Token blacklist、JTI
introspection、Resource Consumer per-request live lookup 或
backchannel revocation endpoint。

### CTR-AUTH-SHUTDOWN-009 — Resolution endpoint 与 caller authentication

```text
METHOD = GET
PATH = /api/v1/clients/:client_id
PATH_IDENTIFIER = public MachineClient.clientId
PATH_IDENTIFIER_EXAMPLE = mc_<base64url>

AUTHENTICATION = v1ManagementAuth
REQUIRED_AUDIENCE = svc-auth
REQUIRED_SCOPE = auth.identity.provision
REQUIRED_CALLER_PRINCIPAL_TYPE = service
CALLER_IDENTITY_SOURCE = verified Access Token
REQUEST_BODY_CALLER_IDENTITY = FORBIDDEN
```

MUST NOT 新增第二套 caller identity、API key、request-body identity、
IP allowlist identity 或 shared-secret bypass。`client_id` 不是
MachineClient row UUID；malformed non-`mc_*` input MUST 返回
`CTR-AUTH-SHUTDOWN-014` 定义的 exact `400 invalid_request`，且不触发
数据库 mutation。

该 seam 是 provisioning control-plane management seam：只服务
provisioning state machine 的 mutation-before-check；由 authenticated
`svc-auth` management Service principal 调用；使用现有
`v1ManagementAuth`；不解释 Agent Core 产品语义；不返回 Grant；不执行
mutation；不缓存、不允许 caller 缓存。

该 seam MUST NOT：接收待验证 Token；返回 Token validity；决定业务服务
authorization；返回 Grant；改变 Access Token until-`exp` 语义。
Resource Consumer Token、ordinary business Token 或 arbitrary bearer
Token MUST NOT 把该 endpoint 用作 per-request authorization /
Token-validity Oracle（无 introspection expansion）。

### CTR-AUTH-SHUTDOWN-010 — Resolution 的 exact implementation landing

实现落点固定为：

```text
Route:   src/routes/idempotent.ts
Service: src/lib/oauth/v1/resolution.ts
Test:    tests/v1-management-resolution.test.ts
```

MUST NOT 创建并行 Route、第二个 resolution service 或 alternative
endpoint。`src/lib/oauth/v1/resolution.ts` 只执行
Client-with-Principal read；MUST NOT 导入、调用或包装
`createOrGetPrincipal`、`createOrGetClient`、lifecycle mutation 或
Grant query。

### CTR-AUTH-SHUTDOWN-011 — Exact success projection

Client 与关联 Principal 存在时，HTTP `200` 只允许返回：

```json
{
  "client_id": "<mc_*>",
  "client_status": "<exact persisted client status>",
  "client_external_ref": "<opaque external_ref|null>",

  "principal_id": "<uuid>",
  "principal_status": "<exact persisted principal status>",
  "principal_type": "agent|service",
  "principal_external_ref": "<opaque external_ref|null>",
  "agent_id": "<string|null>",
  "owner_user_id": "<uuid|null>"
}
```

规则：

- 通过 public `MachineClient.clientId` 精确查询。
- Active、revoked 或未来持久化 Client status 均如实返回。
- Active、disabled 或未来持久化 Principal status 均如实返回。
- `client_external_ref=null` 仍是 HTTP 200 的当前事实，不是 404 或
  5xx；caller classification = `unbound_or_mismatch`，Agent Core 期望
  结果 = `STATE_F_FAIL_LOUD`（该 caller classification 必须由外部
  authority amendment 冻结；auth-service 只返回事实）。
- `principal_external_ref=null` 仍是 HTTP 200 的当前事实。
- Auth MUST NOT 解析 external-ref prefix、Agent ID、产品名称或
  ownership policy。
- Projection 字段名与 nullability 是封闭 Contract，MUST NOT 自由扩展。
- HTTP 200 不表示 caller binding 匹配，也不表示可执行 mutation。

Caller 负责比较 expected client_id / client_external_ref /
principal_external_ref / principal_type / agent_id / owner_user_id
policy。Auth MUST NOT 解释或生成
`agentcore:v1:client:<agentId>` / `agentcore:v1:principal:<agentId>`，
MUST NOT 自动 reconcile、创建 replacement identity 或根据 prefix 选择
policy。

### CTR-AUTH-SHUTDOWN-012 — Not found 与 integrity-invalid state

- Client 不存在：HTTP `404`，exact body 见
  `CTR-AUTH-SHUTDOWN-014`。
- Client 存在但关联 Principal row 不存在，或关系违反数据库完整性：
  HTTP `500 machine_identity_state_invalid`。
- Client / Principal status 非 active 不是 integrity failure；HTTP 200
  如实返回。
- External ref null 不是 auth-service integrity failure；HTTP 200 如实
  返回。
- Integrity invalid MUST NOT create、claim、repair、rotate、revoke、
  disable 或 backfill。
- Error response MUST NOT 泄露数据库详情、Secret、Token、Verifier 或
  stack。

### CTR-AUTH-SHUTDOWN-013 — Freshness 与 cache 禁止

```text
RESOLUTION_RESPONSE_CACHE_CONTROL = no-store
RESOLUTION_RESPONSE_PRAGMA = no-cache
RESOLUTION_ETAG = NONE
RESOLUTION_LAST_MODIFIED_VALIDATOR = NONE
RESOLUTION_304_RESPONSE = FORBIDDEN
CALLER_RESOLUTION_CACHE = FORBIDDEN
FRESH_RESOLUTION_PER_PROVISIONING_OPERATION = REQUIRED
```

服务器 MUST 在 authentication、authorization、validation、rate
limiting 和 handler 执行之前，为 exact resolution path 安装 response
no-store headers（执行位置冻结于 `CTR-AUTH-SHUTDOWN-018`），使所有
结果均满足：

```text
Cache-Control: no-store
Pragma: no-cache
```

`NO_STORE_APPLIES_TO`：

```text
200
400
401
403
404
429
500
503
all other 5xx resolution responses
```

规则：

- 不生成 ETag。
- 不生成可用于该 endpoint 的 Last-Modified validator。
- 不返回 304。
- 不允许 CDN、reverse proxy、HTTP client、SDK、Broker 或 provisioning
  caller 缓存成功或错误结果。
- Caller 每次 provisioning operation 都 MUST 发出新的 Auth request。
- Caller MUST NOT 把前一 operation 的 active、revoked、disabled、
  missing、null external-ref 或 error result 用于下一 operation。
- Conditional request headers MUST NOT 使服务器绕过数据库 fresh read。

### CTR-AUTH-SHUTDOWN-014 — Exact success/error Wire Contract

所有响应：

```text
MEDIA_TYPE = application/json
CHARSET = utf-8 permitted
ERROR_ENVELOPE = {"error":"<exact_code>"}
ERROR_DESCRIPTION = ABSENT
MESSAGE_FIELD = ABSENT
RAW_EXCEPTION = ABSENT
STACK = ABSENT
TARGET_INTERNAL_ROW_ID = ABSENT
```

成功 `200` 使用 `CTR-AUTH-SHUTDOWN-011` 的 projection，MUST NOT 额外
包裹 `data`、`success` 或 `message`。

错误映射：

| Condition | HTTP | Exact JSON |
|---|---:|---|
| malformed `client_id` | 400 | `{"error":"invalid_request"}` |
| missing/invalid/expired Token, wrong issuer/audience/kid/signature, inactive actor Principal/Client | 401 | `{"error":"invalid_client"}` |
| authenticated Token missing `auth.identity.provision`, or caller principal type is not `service` | 403 | `{"error":"insufficient_scope"}` |
| target public Client does not exist | 404 | `{"error":"machine_client_not_found"}` |
| management rate limit rejects the operation | 429 | `{"error":"temporarily_unavailable"}` |
| target identity relation violates DB integrity | 500 | `{"error":"machine_identity_state_invalid"}` |
| database/service dependency is transiently unavailable | 503 | `{"error":"temporarily_unavailable"}` |

MUST NOT 用普通 `HttpError` 的 `{ "message": ... }` envelope 代替本表。

Caller classification requirement：

```text
404 machine_client_not_found
200 revoked
200 disabled
200 binding mismatch
200 client_external_ref=null
500 machine_identity_state_invalid
  → terminal State F
  → no Auth or store mutation
  → 500 is not retryable transport failure

429 temporarily_unavailable
503 temporarily_unavailable
transport failure
  → transient external service failure
  → not State F
  → no Auth or store mutation
  → retry policy remains bounded by caller Spec
```

### CTR-AUTH-SHUTDOWN-015 — 禁止的 response/read/log surfaces

Response、error、header、log 与 test snapshot MUST NOT 包含：

- client secret；
- `secretHash` / verifier；
- secret prefix or suffix；
- `allowedResources`；
- `allowedScopes`；
- `MachineAccessGrant`、`DelegationGrant` 或 Human Grant；
- Access Token、Authorization header 或 Refresh Credential；
- User password / verifier material；
- audit-internal sensitive payload；
- arbitrary User、Session、Proxy 或 Token state；
- caller-supplied Token fragments；
- raw query result or Prisma error。

### CTR-AUTH-SHUTDOWN-016 — Zero-write invariant

```text
READ_ONLY_RESOLUTION_DATABASE_WRITES = 0
PRINCIPAL_CREATED = NO
CLIENT_CREATED = NO
CLIENT_CLAIMED = NO
CLIENT_ROTATED = NO
CLIENT_REVOKED = NO
PRINCIPAL_DISABLED = NO
REQUEST_DIGEST_BACKFILL = NO
GRANT_READ_OR_MUTATION = NO
PERSISTENT_AUDIT_WRITE = NO
```

该 GET 的 Prisma capability 只能包含 read operations。即使 Client
缺失、revoked、Principal disabled、external-ref null/mismatch、
integrity invalid、dependency failure 或请求并发，MUST NOT 发生任何
数据库写入。允许不含 identity、Secret、Token、external-ref 的固定
operational metric；MUST NOT 用 metric 代替 zero-write assertion。

### CTR-AUTH-SHUTDOWN-017 — Mutating function isolation

Resolve path MUST NOT 导入、调用或包装：

```text
createOrGetPrincipal
createOrGetClient
claim/bind helper
rotate helper
revoke helper
disable helper
requestDigest backfill
flat-field migration planner
MachineAccessGrant query
DelegationGrant query
```

MUST NOT 以"只走 fast path"为理由复用 mutating function。

### CTR-AUTH-SHUTDOWN-018 — Route-local exact-path enforcement 与非影响边界

```text
RESOLUTION_EXACT_PATH = GET /api/v1/clients/:client_id
ROUTE_LOCAL_POLICY = EXACT_PATH_ONLY
OTHER_ENDPOINT_BEHAVIOR_CHANGED = NO
```

#### 18a. Pre-limiter exact-path policy 安装

`src/server.ts` MUST 在以下组件之前识别 exact resolution path（method
与 path 的 exact 匹配）并安装 endpoint-specific policy：

```text
global rate limiter
v1ManagementAuth
request validation
idempotentRouter
global error handler response emission
```

对 exact resolution path 的所有响应，预先设置：

```text
Cache-Control: no-store
Pragma: no-cache
```

并保证：

```text
ETag = absent
Last-Modified = absent
304 = forbidden
```

本小节是 `CTR-AUTH-SHUTDOWN-013` freshness contract 的执行位置；
no-store/no-cache、ETag/Last-Modified/304 规则本身见该 Contract，此处
只冻结落点与顺序。

#### 18b. Global limiter 的 exact-path 429 Wire

global rate limiter 继续保护该 endpoint，MUST NOT 绕过：

```text
GLOBAL_LIMITER_REMAINS_ENABLED = YES
RESOLUTION_RATE_LIMIT_BYPASS = NO
OTHER_ENDPOINT_RATE_LIMIT_POLICY_CHANGED = NO
OTHER_ENDPOINT_429_WIRE_CHANGED = NO
```

global limiter 对 exact resolution path 产生 429 时 MUST 返回：

```text
HTTP 429
Content-Type: application/json
{"error":"temporarily_unavailable"}
Cache-Control: no-store
Pragma: no-cache
ETag absent
Last-Modified absent
status != 304
```

MUST NOT 通过跳过全局限流来解决 Wire 问题。

#### 18c. Exact-path error normalization 范围

对 exact resolution path 的以下失败：

```text
authentication failure（invalid/expired Token、wrong issuer/audience/
kid/signature、inactive actor Principal/Client）
scope 缺失
caller principal_type 非 service
validation failure（malformed client_id）
target missing
integrity invalid
transient DB/dependency failure
handler failure
global limiter 429
```

MUST 统一使用 `CTR-AUTH-SHUTDOWN-014` exact JSON Wire，MUST NOT 进入
普通 `{"message":"..."}` 响应形态。

#### 18d. 其他 endpoint 的非影响边界

- `/oauth/*` 的现有 OAuth error Wire 不因本 amendment 改变；
- POST `/api/v1/principals` 与 POST `/api/v1/clients` 的既有 Wire 不因
  本 amendment 被全局重写；
- 其他 `/api/*` endpoint 的 limiter/error envelope 不在本 amendment
  改变；
- 本 amendment 不是全服务错误格式迁移。

任何把 resolution Wire 推广为全服务 envelope 的实现都越权。

### CTR-AUTH-SHUTDOWN-019 — Operator-only host-local lifecycle seam

```text
OPERATOR_LIFECYCLE_INSPECT = HOST_LOCAL_TRUSTED_CLI
```

Legacy `machine-admin` CLI 与 `src/lib/oauth/service.ts` 删除，替换为：

```text
src/cli/v1-machine-lifecycle.ts
src/lib/oauth/v1/lifecycle.ts
```

该 seam：

- 由可信 Operator 在 auth-service host 上离线执行；
- MUST NOT 注册 HTTP Route；
- MUST NOT 提供给 Agent、Resource Consumer 或普通服务；
- 用于人工 inspect、secret rotation、Client revoke、Principal
  disable；
- mutation 要求 optimistic version 与持久 lifecycle audit。

CLI 命令集合固定为：

```text
principal inspect --principal-id <uuid>
principal disable --principal-id <uuid> --reason <text> --expected-version <int>
client inspect --client-id <public-client-id>
client rotate-secret --client-id <public-client-id> --reason <text> --expected-version <int>
client revoke --client-id <public-client-id> --reason <text> --expected-version <int>
```

`inspect` 可以返回非秘密 V1 identity、status、version、timestamps 与
Audience-scoped Grant 摘要，因为它是 host-local trusted operator
surface。`lifecycle.ts` MUST NOT export Token
issuance/sign/verify/exchange。

两个 seam 不得合并：

| Dimension | Operator lifecycle inspect | Online provisioning resolution |
|---|---|---|
| Transport | host-local CLI | authenticated HTTPS GET |
| Caller | trusted human/operator | `svc-auth` management Service principal |
| Purpose | lifecycle operations and manual diagnosis | fresh pre-mutation deterministic binding check |
| Grant summary | permitted non-secret summary | forbidden |
| Mutation | rotate/revoke/disable commands permitted | forbidden |
| Resource Consumer access | forbidden | forbidden |
| Token introspection | none | none |
| Cache | local invocation result is not network authority | server/caller cache forbidden |

MUST NOT 通过暴露 CLI、复用 lifecycle mutation、加入 query mode 或创建
generic admin API 来模糊二者边界。

### CTR-AUTH-SHUTDOWN-020 — Legacy backfill cutoff

```text
FLAT_FIELD_TO_V1_GRANT_MIGRATION = PRE_CUT_ONLY
POST_CUT_BACKFILL_APPLY = FORBIDDEN
POST_CUT_LEGACY_FLAT_FIELD_REPAIR = FORBIDDEN
READINESS_WRITE_AUTHORITY = NONE
```

所有从 `MachineClient.allowedResources` / `allowedScopes` 推导
`AuthAudience` 或 `MachineAccessGrant` 的写操作，MUST 在 Cut Artifact
部署前完成并形成独立证据。

Cut Artifact 固定处置：

- 删除 `scripts/backfill-minimal-auth-v1.ts`。
- 删除 root `package.json` 的 `contract:v1:backfill`。
- 删除 `scripts/repair-legacy-client-drift.ts`。
- 删除 `scripts/cleanup-evidence-repair.ts`。
- 删除 `scripts/cleanup-legacy-revoked-clients-round-1.ts`。
- 删除 `src/lib/oauth/v1/grant-migration.ts` 的 flat-field migration
  planner。
- 将 V1 runtime 仍需的 Audience comparison 移到
  `src/lib/oauth/v1/audience-state.ts`；MUST NOT 含 Legacy fields、
  migration plan 或 write path。

### CTR-AUTH-SHUTDOWN-021 — Readiness 只读边界

`scripts/check-minimal-auth-v1-readiness.ts`：

- 可读取 Legacy flat fields，只用于证明未迁移 authority 已清零；
- 可读取 V1 tables 与 frozen registry；
- MUST NOT 调用 migration planner；
- MUST NOT 从 Legacy fields 推导应创建的 V1 Grant；
- MUST NOT 创建、更新或删除 authority；
- MUST NOT 提供 `--apply`、`--repair`、`--fix`；
- 缺失/不一致时只返回失败证据和稳定分类。

Provisioning resolution 不属于 readiness，MUST NOT 读取 flat fields
或 Grants。

### CTR-AUTH-SHUTDOWN-022 — Runtime 与 configuration authority

`AUTH_CONTRACT_MODE` 从 runtime design 删除。Cut Artifact 不存在：

```text
v0
v1_shadow
Legacy fallback
Legacy Route mounting
```

启动流程：

1. 从 exact pinned 1.3.0 Contract Bundle 生成 runtime snapshot。
2. 校验 source object、runtime digest、version、freeze status 与
   implementation authorization。
3. 校验 exact issuer。
4. 加载并验证 active RS256 private key、`kid` 与 retained previous
   keys。
5. 任一条件不满足则启动失败。

以下 Legacy variables MUST 删除或固定拒绝：

```text
JWT_SECRET
JWT_REFRESH_SECRET
JWT_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN
JWT_AUDIENCE
AGENT_TOKEN_SECRET
JWT_SECRET_SSO
SSO_JWT_SECRET
REGISTER_INVITE_CODE
AUTH_CONTRACT_MODE
```

### CTR-AUTH-SHUTDOWN-023 — Token acceptance profiles

Accepted profiles：

| Profile | Algorithm | Required binding at auth-service operation |
|---|---|---|
| V1 Human Access | RS256 | exact issuer/audience、active User/HumanClient、valid Human grant/session flow |
| V1 Direct Agent | RS256 | active Agent Principal/Client、per-audience MachineAccessGrant、exact scope |
| V1 Direct Service | RS256 | active Service Principal/Client、no `agent_id`、per-audience MachineAccessGrant |
| V1 Delegated | RS256 | active original Agent、active TrustedProxy Service、accepted source、original grant ∩ delegation grant |
| V1 opaque Refresh Credential | opaque | active credential/session/family/user/client、serializable rotation/reuse detection |

Unconditionally rejected：

- Any HS256 Access Token。
- Any HS256 Refresh Token。
- Any Token accepted only because it shares `JWT_SECRET`。
- Any Legacy ADC issuer Token。
- Any Token without exact audience。
- Any Token whose expected audience comes from arbitrary request-body input。
- Any Token missing a known `kid`。
- Any `alg=none` or non-RS256 Token。
- Any Legacy Agent Token Login credential。
- Any Token carrying forbidden profile claims。
- Any scope authorized through `allowedResources` / `allowedScopes`。

每个 Resource Consumer 必须本地、离线验证：

```text
alg = RS256
kid ∈ locally trusted JWKS cache
iss = frozen exact issuer
aud = this consumer's exact audience
principal_type = accepted profile
token_use = accepted token use
version = supported frozen version
exp/nbf/iat = valid under frozen skew
scope contains endpoint-required scope
forbidden claims = absent
```

`GET /api/v1/clients/:client_id` 不属于该验证链，Resource Consumer
MUST NOT 调用。

### CTR-AUTH-SHUTDOWN-024 — Data authority

Human V1 authority：

- `User`
- `HumanClient`
- `HumanClientRedirectUri`
- `HumanAudienceGrant`
- `AuthorizationTransaction`
- `AuthorizationCode`
- `HumanSession`
- `RefreshFamily`
- `RefreshCredential`
- `AuthSecurityAudit`

Machine V1 authority：

- `MachinePrincipal`
- `MachineClient` identity/status/secret-verifier fields
- `AuthAudience`
- `MachineAccessGrant`
- `TrustedProxy`
- `ProxyAcceptedSubjectAudience`
- `DelegationGrant`
- `TokenExchangeAudit`
- persistent machine lifecycle audit facts

Non-authoritative Legacy data：

- `MachineClient.allowedResources`
- `MachineClient.allowedScopes`
- `ServiceRegistration.allowedRoles`
- `ServiceRegistration.jwtAudience`
- User `role/internalRole/okrRole` 对 V1 Token 的签发与验证
- Legacy Refresh revocation `Map`
- Legacy backfill/repair inference

Provisioning resolution 只读取：

```text
MachineClient.clientId
MachineClient.status
MachineClient.externalRef
MachineClient.machinePrincipalId
MachinePrincipal.id
MachinePrincipal.status
MachinePrincipal.principalType
MachinePrincipal.externalRef
MachinePrincipal.agentId
MachinePrincipal.ownerUserId
```

MUST NOT 读取任何 Grant、Legacy flat field、Secret verifier 或
request digest。

### CTR-AUTH-SHUTDOWN-025 — Runtime Child exact closed manifest obligation

```text
CLOSED_MANIFEST_OWNER = RUNTIME_CHILD
CTR_SEMANTICS = RUNTIME_CHILD_EXACT_CLOSED_MANIFEST_OBLIGATION
```

本 Contract 不再声称 Program 已包含 Runtime Child 在当前 repo 上的
完整封闭文件集合（exact closed manifest）。Program 只拥有并冻结以下
边界；exact closed manifest 由首个 Runtime Child 在它自己的 exact
implementation Base 上产生、评审并被验收。

Program 拥有：

- Disposition 枚举：

```text
KEEP
KEEP_MODIFY
DELETE
CREATE
KEEP_TEST_ONLY
KEEP_OUT_OF_RUNTIME_SCOPE
```

- 必须删除与必须保留的语义边界（由本 Spec 各 Contract 冻结，含
  `CTR-AUTH-SHUTDOWN-001`、`CTR-AUTH-SHUTDOWN-002`、
  `CTR-AUTH-SHUTDOWN-003`、`CTR-AUTH-SHUTDOWN-005`、
  `CTR-AUTH-SHUTDOWN-019`、`CTR-AUTH-SHUTDOWN-020`、
  `CTR-AUTH-SHUTDOWN-021`、`CTR-AUTH-SHUTDOWN-022`，以及本
  Contract 保留下方的 resolution seam 封闭文件授权）；
- schema 不得在 Runtime Child 阶段执行破坏性 drop 的阶段边界
  （破坏性删除属于 `AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1`；见
  `CTR-AUTH-SHUTDOWN-005`、`CTR-AUTH-SHUTDOWN-028`）；
- 禁止 implementation Agent 自由增加平行 route / service /
  middleware（见下方 MUST NOT 创建清单）；
- Runtime Child 必须产生 closed manifest 的义务（见下）。

Runtime Child MUST 在自己的 exact implementation Base 上：

1. 执行完整 `git ls-files` inventory；
2. 列出全部 existing path；
3. 列出全部 CREATE path；
4. 为每项固定 disposition（仅使用上述枚举）；
5. 为每项固定 owning child；
6. 为每项固定 schema / migration / test impact；
7. 确保闭集之外的文件不因 shutdown / resolution 被修改；
8. 将该 exact manifest 交给独立 exact-revision review；
9. 由 `ACC-AUTH-SHUTDOWN-019` 比较 manifest 与实现 diff。

任何使用目录通配推断额外删除、把未分类文件留给实现阶段自由选择、
或把本 Contract 下列历史表格当作 exact manifest 的实现都违反本
Contract。

#### 25.0 Historical investigation evidence（非 exact manifest）

调查 `AUTH_SERVICE_PR2_REMAINING_BLOCKERS_INVESTIGATION_V1` 的
source disposition 结论按以下坐标记录，且仅为
`HISTORICAL_INVESTIGATION_EVIDENCE`：

```text
INVESTIGATION_BASE =
  1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9
INVESTIGATED_HEAD =
  fb8d55e785d6f99c9e57a602543609953e8f5410
TRACKED_PATHS_INSPECTED = 138
TRACKED_PATHS_OMITTED_BY_OLD_SPEC = 55
OMITTED_AND_CONTRACT_AFFECTED = 49
HISTORICAL_RECOMMENDED_CHILD_MANIFEST_SIZE = 149
REMAINING_UNCLASSIFIED_AT_INVESTIGATION_HEAD = 0
CLOSED_MANIFEST_RECOMMENDATION = RUNTIME_CHILD_OWNS
```

这些数字是 historical investigation evidence，不是任何新 Base 的
frozen exact manifest：`HISTORICAL_RECOMMENDED_CHILD_MANIFEST_SIZE =
149` 不得被误写成当前或未来 Base 的永久封闭文件集，也不得因后续
main 前进而被改写或扩充为"149+N"。

当前 evaluated base 相对 investigation base 新增的 tracked path 只能
作为 `CURRENT_BASE_NEW_TRACKED_PATH_EVIDENCE`：

```text
CURRENT_BASE_NEW_TRACKED_PATH_EVIDENCE =
  scripts/reconcile-svc-forum-audience-registry-v1.ts
  scripts/run-svc-forum-audience-registry-v1-conformance.sh
  tests/oauth/reconcile-svc-forum-audience-registry-v1.test.ts
```

对这 3 个 path：不得并入历史 149 项；不得把 149 改写为 152；本
Program 不永久决定其最终 disposition（它们属于 accepted
`AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` 的
三文件实现闭包）。因此冻结：

```text
RUNTIME_CHILD_MUST_CLASSIFY_ALL_CURRENT_BASE_PATHS = YES
```

Resolution seam 的文件授权是封闭集合：

```text
CANONICAL_NEW_FILES =
  src/lib/oauth/v1/resolution.ts
  tests/v1-management-resolution.test.ts

CANONICAL_EXISTING_ROUTE_FILE =
  src/routes/idempotent.ts

EXISTING_FILES_ALLOWED_TO_CHANGE =
  src/server.ts
  src/utils/http-error.ts
  src/middleware/v1-management-auth.ts
  src/lib/oauth/v1/errors.ts
  src/routes/idempotent.ts
```

除 `CANONICAL_NEW_FILES` 与 `EXISTING_FILES_ALLOWED_TO_CHANGE` 之外，
任何文件 MUST NOT 因 resolution seam 被修改。本 Contract 其余条目的
disposition 服务于 Legacy shutdown 的其他职责，不构成 resolution
seam 的额外授权。不存在"必要时修改其他文件"、"including but not
limited to"、"可选择 server.ts 或 middleware"或"implementation Agent
自行决定"的开放授权。

MUST NOT 创建：

```text
第二个 resolution Route
第二个 resolution service
新 generic error middleware
新 generic IAM package
新 introspection module
```

以下 §25.1 至 §25.11 的 disposition 表是
`INVESTIGATED_HEAD fb8d55e7...` 坐标上的 historical investigation
evidence（authoring-time 分类），不是当前或未来 Base 的 exact
closed manifest。它们保留两个作用：(1) 传递其中已被其他 Contract
独立冻结的语义边界；(2) 作为 Runtime Child 在其 exact Base 生成
closed manifest 时的历史参考输入。表中任何与旧 1.2.0 pin 相关的
表述（如 provider/bundle-digest 行）已被 §3.4 的 1.3.0 authority
pin 取代。Runtime Child 的 exact manifest 是唯一 authority。

#### 25.1 Entry, config, database and utilities

| Path | Disposition | Required result |
|---|---|---|
| `src/server.ts` | KEEP_MODIFY | 只 mount V1 Routes；无条件初始化 pinned V1；resolution 职责见 §25.11：exact path detection、pre-limiter no-store/no-cache、exact-path 429 与 final error normalization、suppress ETag/Last-Modified/304；保持其他 endpoint 的 limiter/error 行为不变 |
| `src/config/env.ts` | KEEP_MODIFY | 删除 Legacy secret/mode/register authority；V1 key config fail fast |
| `src/lib/prisma.ts` | KEEP | 单一 Prisma client seam |
| `src/utils/async-handler.ts` | KEEP | async error forwarding |
| `src/utils/http-error.ts` | KEEP_MODIFY | 保留普通 HttpError 在其他 endpoint 的语义；增加封闭的 resolution error classification/representation；不允许 resolution error 泄露 message、stack 或 raw exception（§25.11） |

#### 25.2 Routes

| Path | Disposition | Required result |
|---|---|---|
| `src/routes/auth.ts` | DELETE | 删除全部 Legacy Human/Agent auth Routes |
| `src/routes/users.ts` | DELETE | 删除人员目录 surface |
| `src/routes/roles.ts` | DELETE | 删除在线 role surface |
| `src/routes/service-registrations.ts` | DELETE | 删除 Legacy SSO Gateway 与 verify-token |
| `src/routes/oauth.ts` | KEEP_MODIFY | 只 dispatch V1 direct/exchange；删除 V0/shadow branches |
| `src/routes/oauth-human.ts` | KEEP_MODIFY | 保留 V1 authorization_code/refresh/logout；live status 对齐 |
| `src/routes/idempotent.ts` | KEEP_MODIFY | 保留 POST provisioning；新增且仅新增 `GET /v1/clients/:client_id`；route 限制 Service principal；success/error exact Wire；不得输出 cache validator；不承担 global-limiter 429（§25.11） |
| `src/routes/well-known.ts` | KEEP_MODIFY | 只发布 pinned V1 public JWKS；JWKS cache policy 对齐独立 Contract |

不创建第二个 provisioning resolution Route 文件。

#### 25.3 Middleware and schemas

| Path | Disposition | Required result |
|---|---|---|
| `src/middleware/auth.ts` | DELETE | 删除 HS256/shared-secret verifier |
| `src/middleware/token-rotation.ts` | DELETE | 删除 Legacy in-memory refresh state |
| `src/middleware/v1-management-auth.ts` | KEEP_MODIFY | exact `svc-auth` audience/scope；live-check actor Principal/Client；resolution path 上 401 invalid_client / 403 insufficient_scope exact Wire；不把内部 Principal ID、Client ID、Token claims 或异常文本写入 response；不改变其他 management endpoint 既有 Wire（§25.11） |
| `src/schemas/auth.ts` | DELETE | 删除 Legacy auth request schemas |
| `src/schemas/oauth.ts` | KEEP_MODIFY | 只保留 V1 OAuth schemas 与 strict validation |

#### 25.4 Shared and Legacy OAuth libraries

| Path | Disposition | Required result |
|---|---|---|
| `src/lib/oauth/audit.ts` | KEEP_MODIFY | 只保留 V1 operational logging；resolution 不写 durable audit，不记录 identity/external-ref/token |
| `src/lib/oauth/secret.ts` | KEEP_MODIFY | V1 secret generation/verification；不使用 `Math.random()` |
| `src/lib/oauth/service.ts` | DELETE | 由 V1 lifecycle seam 替代；不 re-export issuance |
| `src/lib/oauth/token.ts` | DELETE | 删除 HS256 Agent signer |
| `src/lib/oauth/token-issuance.ts` | DELETE | 删除 V0 flat-field issuance |
| `src/lib/oauth/token-exchange.ts` | DELETE | 删除 V0 OBO |
| `src/lib/oauth/token-exchange-signing.ts` | DELETE | 删除 V0 OBO signer |
| `src/lib/oauth/workflow-signer.ts` | DELETE | 删除 V0 workflow-only signer/verifier |
| `src/lib/oauth/workflow-keyring.ts` | KEEP_MODIFY | V1 RS256 keyring；只暴露 active signer 与 verification keys/JWKS |

#### 25.5 V1 OAuth libraries

| Path | Disposition | Required result |
|---|---|---|
| `src/lib/oauth/v1/contract.ts` | KEEP_MODIFY | 只接受 exact pinned 1.2.0 runtime object |
| `src/lib/oauth/v1/credentials.ts` | KEEP_MODIFY | V1 opaque credential only |
| `src/lib/oauth/v1/direct.ts` | KEEP_MODIFY | live status + per-audience Grant；导入 `audience-state.ts` |
| `src/lib/oauth/v1/errors.ts` | KEEP_MODIFY | exact resolution codes/status classification；terminal 与 transient category 必须可区分（500 machine_identity_state_invalid ≠ 503 temporarily_unavailable）；不把 resolution error 变成 generic OAuth redesign（§25.11） |
| `src/lib/oauth/v1/exchange.ts` | KEEP_MODIFY | live boundary + persistent audit；导入 `audience-state.ts` |
| `src/lib/oauth/v1/grant-migration.ts` | DELETE | 删除 flat-field migration planner |
| `src/lib/oauth/v1/human-login.ts` | KEEP_MODIFY | active User/Client/Grant；无 public registration |
| `src/lib/oauth/v1/human-refresh.ts` | KEEP_MODIFY | active lifecycle、rotation、reuse detection |
| `src/lib/oauth/v1/human-support.ts` | KEEP_MODIFY | 导入 `audience-state.ts`；persistent Human audit |
| `src/lib/oauth/v1/idempotent.ts` | KEEP_MODIFY | mutating provisioning only；修复 shape/digest/concurrency；resolution 不得调用 |
| `src/lib/oauth/v1/resolution.ts` | CREATE | public client ID → exact non-secret Client/Principal projection；read-only；nullable external refs；no Grant/flat fields/mutating imports |
| `src/lib/oauth/v1/scope.ts` | KEEP | canonical frozen scope grammar |
| `src/lib/oauth/v1/signer.ts` | KEEP_MODIFY | exact pinned 1.2.0 profiles；无 version fallback |
| `src/lib/oauth/v1/audience-state.ts` | CREATE | Stored Audience 与 frozen-vs-DB comparison；无 Legacy/write path |
| `src/lib/oauth/v1/lifecycle.ts` | CREATE | operator-only inspect/rotate/revoke/disable；无 issuance exports |

#### 25.6 CLI and identity modules

| Path | Disposition | Required result |
|---|---|---|
| `src/cli/machine-admin.ts` | DELETE | 删除 Legacy lifecycle/flat grant CLI |
| `src/cli/v1-machine-lifecycle.ts` | CREATE | `CTR-AUTH-SHUTDOWN-019` exact operator-only command set |
| `src/cli/agent-identity.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | 不具 Token/Grant authority |
| `src/lib/identity/config.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |
| `src/lib/identity/env-file.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |
| `src/lib/identity/resolver.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |
| `src/lib/identity/types.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |

#### 25.7 Scripts

| Path | Disposition | Required result |
|---|---|---|
| `scripts/backfill-minimal-auth-v1.ts` | DELETE | post-cut apply removed |
| `scripts/repair-legacy-client-drift.ts` | DELETE | Legacy repair removed |
| `scripts/cleanup-evidence-repair.ts` | DELETE | historical Legacy mutator removed |
| `scripts/cleanup-legacy-revoked-clients-round-1.ts` | DELETE | historical Legacy mutator removed |
| `scripts/check-minimal-auth-v1-readiness.ts` | KEEP_MODIFY | strictly read-only evidence；no derivation/write |
| `scripts/prepare-minimal-auth-v1.mjs` | KEEP_MODIFY | exact pinned snapshot/digest receipt |
| `scripts/prepare-candidate-snapshot.mjs` | KEEP_TEST_ONLY | authoring only；not runtime |
| `scripts/preflight-request-digest.mjs` | KEEP_MODIFY | read-only idempotent migration preflight |
| `scripts/bootstrap-obo-conformance-fixture.ts` | KEEP_TEST_ONLY | isolated test fixture |
| `scripts/fixture-specs/svc-okr-direct-agent.json` | KEEP_TEST_ONLY | test fixture specification |
| `scripts/generate-fixture-jwt.mjs` | KEEP_TEST_ONLY | test fixture generation |
| `scripts/obo-conformance-check.ts` | KEEP_TEST_ONLY | V1 conformance |
| `scripts/obo-conformance-http.ts` | KEEP_TEST_ONLY | V1 conformance |
| `scripts/obo-conformance-ids.ts` | KEEP_TEST_ONLY | V1 conformance |
| `scripts/obo-conformance-negative.ts` | KEEP_TEST_ONLY | V1 negative conformance |
| `scripts/run-obo-conformance.sh` | KEEP_TEST_ONLY | V1 conformance runner |

#### 25.8 `packages/machine-token-provider`

| Path | Disposition | Required result |
|---|---|---|
| `packages/machine-token-provider/package.json` | KEEP_MODIFY | root workspace/verify；contract 1.2.0 |
| `packages/machine-token-provider/package-lock.json` | KEEP_MODIFY | reproducible一致 |
| `packages/machine-token-provider/tsconfig.json` | KEEP | package build |
| `packages/machine-token-provider/README.md` | KEEP_MODIFY | pinned V1 only |
| `packages/machine-token-provider/LICENSE` | KEEP | package license |
| `packages/machine-token-provider/.gitignore` | KEEP | build outputs |
| `packages/machine-token-provider/src/index.ts` | KEEP_MODIFY | 只导出 V1 provider/error/types |
| `packages/machine-token-provider/src/provider.ts` | KEEP_MODIFY | 验证 Bearer 与 scope exact match |
| `packages/machine-token-provider/src/errors.ts` | KEEP | sanitized errors |
| `packages/machine-token-provider/src/types.ts` | KEEP_MODIFY | pin 1.2.0 identity |
| `packages/machine-token-provider/tests/bundle-digest.test.ts` | KEEP_MODIFY | 删除旧 digest；验证 1.2 snapshot twice |
| `packages/machine-token-provider/tests/errors.test.ts` | KEEP | error tests |
| `packages/machine-token-provider/tests/helpers.ts` | KEEP_MODIFY | exact response helpers |
| `packages/machine-token-provider/tests/provider.test.ts` | KEEP_MODIFY | token_type/scope/cache/singleflight |
| `packages/machine-token-provider/tests/redaction.test.ts` | KEEP | secret/token redaction |

Machine Token Provider MUST NOT 自动调用 provisioning resolution；它是
Token 获取 helper，不是 identity reconciliation client。

#### 25.9 Root package and deployment files

| Path | Disposition | Required result |
|---|---|---|
| `package.json` | KEEP_MODIFY | 删除 Legacy scripts；新增 lifecycle 与统一 verify；纳管 provider/resolution tests |
| `package-lock.json` | KEEP_MODIFY | 与 root workspace/scripts 一致 |
| `tsconfig.json` | KEEP_MODIFY | build exact production source；不编译 deleted Legacy |
| `Dockerfile` | KEEP_MODIFY | reproducible install；build/verify pinned snapshot；V1-only image |
| `docker-compose.yml` | KEEP_MODIFY | 删除 Legacy env；只传 V1 config |
| `.dockerignore` | KEEP | 排除 secret/build outputs |
| `.gitignore` | KEEP_MODIFY | generated runtime artifact policy 与 fingerprint evidence 一致 |

#### 25.10 Required new tests

| Path | Disposition | Required result |
|---|---|---|
| `tests/oauth/v1-lifecycle.test.ts` | CREATE | operator lifecycle、version conflict、one-time secret、no flat fields/issuance |
| `tests/oauth/v1-state-boundary.test.ts` | CREATE | live checks and Access Token until-exp |
| `tests/oauth/v1-readiness-readonly.test.ts` | CREATE | readiness 无 write/Grant derivation |
| `tests/oauth/v1-source-disposition.test.ts` | CREATE | deleted Legacy modules/scripts/exports absent |
| `tests/oauth/v1-runtime-fingerprint.test.ts` | CREATE | exact pinned 1.2 objects/digest |
| `tests/v1-management-resolution.test.ts` | CREATE | AC-R1..AC-R13、AC-R15、AC-R16（见 §10 legacy aliases）；auth、projection、nullable refs、exact Wire、freshness、route-local limiter Wire、error non-impact、zero writes、secret absence、mutating isolation |

Cross-repository `AC-R14` evidence MUST NOT 放进 auth-service unit test
假装闭环；它由 Production Activation 的 exact Agent Core fixed-SHA E2E
receipt 提供。

#### 25.11 Resolution file responsibility assignment

本小节是 resolution seam 在每个授权文件中的精确职责分配。一个没有
聊天历史的 Implementation Agent 必须能从本节唯一恢复：哪些文件新建、
哪些现有文件允许修改、每个文件负责什么、哪些其他 endpoint 不能被
改变。

`src/server.ts`

- exact resolution path detection（method + path exact 匹配）；
- pre-limiter no-store/no-cache 安装（`CTR-AUTH-SHUTDOWN-013`、
  §18a）；
- exact-path global-limiter 429 normalization（§18b）；
- exact-path final error response normalization（§18c）；
- suppress ETag / Last-Modified / 304（`CTR-AUTH-SHUTDOWN-013`）；
- 保持其他所有 endpoint 的 limiter 与 error 行为不变（§18d）。

`src/utils/http-error.ts`

- 增加封闭的 resolution error classification / representation；
- 不改变普通 HttpError 在其他 endpoint 的语义；
- 不允许 resolution error 泄露 message、stack 或 raw exception。

`src/middleware/v1-management-auth.ts`

- 继续复用现有 V1 RS256 verification；
- exact resolution path 上：
  - invalid Token / wrong issuer/audience/kid/signature / expired Token /
    inactive actor → `401 invalid_client`；
  - missing `auth.identity.provision` → `403 insufficient_scope`；
- 不把内部 Principal ID、Client ID、Token claims 或异常文本写入
  response；
- 不改变其他 management endpoint 的既有 Wire，除非本 Spec 在本
  amendment 之前已另有授权。

`src/routes/idempotent.ts`

- canonical GET Route（唯一 resolution Route）；
- malformed `client_id` → `400 invalid_request`；
- caller principal_type != service → `403 insufficient_scope`；
- success 使用 `CTR-AUTH-SHUTDOWN-011` exact projection；
- 不承担 global-limiter 429（由 `src/server.ts` exact-path policy
  处理）；
- 不调用 mutating function（`CTR-AUTH-SHUTDOWN-017`）。

`src/lib/oauth/v1/errors.ts`

- 定义 resolution exact codes 与 terminal/transient category；
- `500 machine_identity_state_invalid` 与 `503
  temporarily_unavailable` 必须可区分；
- 不把 resolution error 变成 generic OAuth redesign。

`src/lib/oauth/v1/resolution.ts`（CREATE）

- `CTR-AUTH-SHUTDOWN-010` 的纯 read service；职责不变，本 amendment
  不扩展。

`tests/v1-management-resolution.test.ts`（CREATE）

- §25.10 所列 AC-R1..AC-R13、AC-R15、AC-R16 的全部断言。

### CTR-AUTH-SHUTDOWN-026 — Production Activation gates 与 lifecycle 字段冻结

Production Activation MUST 同时满足：

```text
GATE_ACCEPTED_SHUTDOWN_SPEC = PASS
GATE_V1_CONTRACT_FROZEN = PASS
GATE_PINNED_1_3_RUNTIME_FINGERPRINT = PASS
GATE_EXACT_JWKS_URL = PASS
GATE_JWKS_HTTPS_REACHABLE = PASS
GATE_ACTIVE_KEY_AND_KID = PASS
GATE_PREVIOUS_KEY_RETENTION = PASS
GATE_DATABASE_MIGRATIONS = PASS
GATE_PRE_CUT_BACKFILL_COMPLETE = PASS
GATE_POST_CUT_BACKFILL_DISABLED = PASS
GATE_V1_DATA_READINESS = PASS
GATE_V1_ONLINE_PROVISIONING_RESOLUTION = PASS

GATE_AGENT_CORE_STATE_F_SPEC_AMENDED = PASS
GATE_AGENT_CORE_RESOLUTION_CALLER_FIXED_SHA = PASS
GATE_STATE_F_NO_MUTATION_BEFORE_RESOLUTION_E2E = PASS

GATE_V1_MACHINE_LIFECYCLE_SEAM = PASS
GATE_HUMAN_PRINCIPAL_ADMINISTRATION_CHILD_ACCEPTED = PASS
GATE_HUMAN_PRINCIPAL_ADMINISTRATION_CHILD_IMPLEMENTED = PASS
GATE_HUMAN_PRINCIPAL_ADMINISTRATION_CHILD_AUDIT_PASS = PASS
GATE_HUMAN_CREDENTIAL_LIFECYCLE_CHILD_ACCEPTED = PASS
GATE_HUMAN_CREDENTIAL_LIFECYCLE_CHILD_IMPLEMENTED = PASS
GATE_HUMAN_CREDENTIAL_LIFECYCLE_CHILD_AUDIT_PASS = PASS
GATE_ALL_REAL_CONSUMERS_CLASSIFIED = PASS
GATE_NO_REAL_CONSUMER_REQUIRES_LEGACY = PASS
GATE_EXTERNAL_CONSUMERS_OFFLINE_JWKS_ONLY = PASS
GATE_NEGATIVE_CONFORMANCE = PASS
GATE_FULL_TEST_MATRIX = PASS
GATE_INDEPENDENT_PRODUCTION_ACTIVATION_REVIEW = PASS
```

V2 Activation Record 模型（与 accepted
`MINIMAL_AUTH_FOUNDATION_V2` 的 `CTR-MAFV2-003` / `CTR-MAFV2-010`
对齐）：

```text
ACTIVATION_RECORD_ID = MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1
ACTIVATION_RECORD_PATH = docs/contracts/minimal-auth-v2/activation/MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1.json
ACTIVATION_RECORD_OWNER = AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
FROZEN_V1_MANIFEST_MUTATION_REQUIRED = NO
```

Shutdown Spec、Runtime Child、Consumer Migration PR 均不得：

- 直接修改 frozen V1 `1.3.0` manifest；
- 翻转 accepted Contract literal；
- 直接写入下列字段来表示 effective：

```text
auth_token_contract_v1_production_effective = true
v0_compatibility.supersedes_v0 = true
production_deployment.status = effective
consumer_migration.status = complete
```

没有唯一、accepted、经独立审计通过、绑定全部九门
（`CTR-MAFV2-003`）与本 Contract 全部 Gate 的有效 Activation
Record 时：

```text
MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE = false
```

只有有效 Activation Record 才可投影：

```text
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE
production_deployment.status
consumer_migration.status
legacy_consumers_migrated
v0_compatibility.supersedes_v0
```

`AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1`（Production Activation
Child）负责，且仅它负责：

1. 收集九门与全部 Gate 的 Evidence；
2. 创建 `MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1` Activation
   Record；
3. 对 Record 执行独立审计；
4. Owner acceptance；
5. Record 合入后才投影 effective，并部署 Auth Cut Artifact。

本 Program 本身不得创建 effective record；本 PR 不宣布 production
effective。在有效 Record 存在前，当前投影保持：

```text
production_deployment.status = not_ready
auth_token_contract_v1_production_effective = false
v0_compatibility.supersedes_v0 = false
MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE = false
```

### CTR-AUTH-SHUTDOWN-027 — Failure-closed rules

- Pinned Contract object缺失/不匹配：build/startup 失败。
- Runtime digest 不可复现/不匹配：build/startup 失败。
- Contract 未 frozen / implementation-authorized：startup 失败。
- RS256 key、`kid` 或 issuer 不符：startup 失败。
- Unknown `kid`、wrong audience/profile/token_use/version/scope：拒绝。
- auth-service operation live state check 失败：拒绝。
- Resolution actor 不是 valid active `svc-auth` Service principal：按
  `CTR-AUTH-SHUTDOWN-014` 拒绝。
- Resolution target missing：exact 404，零写入。
- Resolution target revoked/disabled：200 如实返回，零写入。
- Resolution external-ref null：200 如实返回，零写入。
- Resolution integrity invalid：exact 500，零写入，不修复。
- Resolution dependency unavailable：exact 503，零写入。
- 任何 resolution response：no-store/no-cache，无 ETag/Last-Modified/304。
- Human/OBO/Lifecycle mutation required audit 无法落库：mutation fail
  closed。
- Legacy Endpoint：404。
- Legacy Token：401 / OAuth error，不尝试 shared-secret fallback。
- Readiness 缺失 V1 authority：失败，不生成修复计划，不写数据库。
- Agent Core caller authority未 amendment：Production Activation
  blocked。

### CTR-AUTH-SHUTDOWN-028 — Rollback boundary

Cut Artifact MUST NOT 包含：

- `LEGACY_ENABLED`
- `AUTH_CONTRACT_MODE=v0`
- Consumer allowlist
- hidden Legacy router
- emergency HS256 fallback
- post-cut backfill apply
- Legacy flat-field repair
- resolution auto-repair
- resolution-to-create fallback
- response/caller resolution cache
- generic introspection fallback

唯一代码回滚：

```text
whole-release rollback to the immediately previous immutable artifact
```

该 rollback 属于 break-glass 响应，MUST 记录原因、时间、Artifact
digest、Operator 与恢复计划。首个 Runtime Child 不执行 Legacy 表/列
破坏性删除，以保持数据库可回滚。

### CTR-AUTH-SHUTDOWN-029 — Human administration children prerequisite

本 Program 不拥有 Human/User Principal 管理或 credential 管理的具体
规范语义（见 §3.5）。生产激活前必须存在 accepted、implemented、
independently-reviewed 的两个独立 Child：

1. Human Principal administration Child：

```text
SPEC_ID = AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1
PR = mayf3/auth-service#15
EXACT_HEAD = 98ec29a1152bfa9530c572ec5a541ea02df163c4
STATUS = proposed / independently semantically reviewed / not accepted
```

Human/User create、existing User claim、canonical User status query、
minimal Human directory、enable、disable、operator scopes、approval、
durable administration audit、administration idempotency、administration
outcome_unknown 与 repository mapping boundary 的全部具体 Contract 由该
Child Spec 拥有；本 Spec 不重复其字段、权限、审批、审计与失败语义。

2. 独立 credential-only Child（password reset / credential
   replacement）：

```text
PASSWORD_RESET =
  OUTSIDE_AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1
PASSWORD_RESET_AUTHORITY =
  SEPARATE_CREDENTIAL_ONLY_CHILD_REQUIRED
PLANNED_CHILD_ID = AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1
PLANNED_CHILD_STATUS = planned / not yet an authority
```

password reset 的具体管理面 Contract（含 reset 后撤销该 User 的
active HumanSession、RefreshFamily 与 RefreshCredential 的语义）由该
独立 Child 拥有；本 Spec 不定义。

本 Contract 作为 Program prerequisite 只要求：两个 Child 均 accepted、
implemented、independently-reviewed，且
`AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1` 的 exact Head 与
`CTR-AUTH-SHUTDOWN-029` 所绑定坐标一致；User create/disable 的具体
Contract 由 PR #15 Spec 拥有，password reset 的具体 Contract 由未来
credential-only Child 拥有。已签发 Access Token 仍按本 Spec `exp`
语义存续；Audited User disable 后撤销全部 active Human session/refresh
authority 的具体语义由 PR #15 Spec 拥有。

旧占位名称 `AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1`
（`AUTHORITY_STATUS = NONE`、`historical placeholder only`、
`MUST_NOT_BE_USED_AS_AUTHORITY = YES`）不满足本 prerequisite，也不得
被用作满足本 prerequisite 的坐标（见 §3.5）。

### CTR-AUTH-SHUTDOWN-030 — Cross-repository closure 与外部 authority 边界

auth-service 可以冻结：endpoint、authentication、response projection、
cache / freshness、error Wire、zero-write boundary、source disposition、
auth-service acceptance evidence。

auth-service MUST NOT 直接改写 `dsh-agent-core` 的 accepted caller
sequencing。不得创建与既有 Agent Core credential-provisioning
authority 平行的新 Spec。

`dsh-agent-core` 必须对原 accepted governing Spec 做原地 amendment，
独立 Review 并先进入 caller implementation base，至少冻结：

```text
STORE_READ_AND_FULL_VALIDATION =
  BEFORE_ANY_AUTH_IDENTITY_MUTATION

WHEN_STORE_ENTRY_EXISTS =
  RESOLVE_STORED_CLIENT_BEFORE_S1_S2

S1_S2_WHEN_STORE_ENTRY_EXISTS =
  FORBIDDEN

RESOLUTION_404_OR_REVOKED_OR_DISABLED_OR_BINDING_MISMATCH =
  STATE_F_FAIL_LOUD

RESOLUTION_EXTERNAL_REF_NULL =
  STATE_F_FAIL_LOUD

RESOLUTION_500_MACHINE_IDENTITY_STATE_INVALID =
  STATE_F_TERMINAL_NOT_RETRYABLE

RESOLUTION_429_OR_503_OR_TRANSPORT_FAILURE =
  TRANSIENT_EXTERNAL_SERVICE_FAILURE_NOT_STATE_F

AUTH_WRITES_BEFORE_STATE_F_CLASSIFICATION = 0
STORE_WRITES_BEFORE_STATE_F_CLASSIFICATION = 0
```

最小安全顺序：

```text
STEP 0  read Agent Definition
STEP 1  read and fully validate credential store

IF store entry exists:
  STEP 2  fresh resolve stored.clientId
  STEP 3  compare exact returned facts
  STEP 4  classify State F or continue existing-credential path
  S1/S2 before STEP 4 = forbidden

IF store entry is absent:
  creation-capable S1/S2 may proceed under the Agent Core governing Spec
```

End-to-end closure gates（Production Activation 增加）：

```text
GATE_AGENT_CORE_STATE_F_SPEC_AMENDED = PASS
GATE_AGENT_CORE_RESOLUTION_CALLER_FIXED_SHA = PASS
GATE_STATE_F_NO_MUTATION_BEFORE_RESOLUTION_E2E = PASS
```

Gate 语义：

1. `GATE_AGENT_CORE_STATE_F_SPEC_AMENDED`
   - 原 accepted Agent Core credential-provisioning Spec 已原地
     amendment；
   - amendment 包含上述完整顺序与失败分类；
   - amendment 已独立 Review 并存在于 caller implementation base。

2. `GATE_AGENT_CORE_RESOLUTION_CALLER_FIXED_SHA`
   - 固定 exact caller repository commit；
   - caller 在 store entry 存在时先 resolve，再决定任何 S1/S2；
   - Auth / store write ordering 可从 exact code 与测试恢复。

3. `GATE_STATE_F_NO_MUTATION_BEFORE_RESOLUTION_E2E`
   - 使用真实 Auth process 或与生产持久层等价的 E2E；
   - 覆盖 missing、revoked、disabled、external-ref null/mismatch、
     profile mismatch 和 integrity failure；
   - 每种 State F path 在 classification 前：
     `Auth writes=0`、`store writes=0`、`duplicate identities=0`；
   - 429/503/transport failure 被分类为 transient，而不是 State F。

`GATE_V1_ONLINE_PROVISIONING_RESOLUTION` 只证明 Auth endpoint 本身
完成，不能替代以上三个 Gate。本 Spec 不能宣布 State F 端到端
implementability 已经关闭。

### CTR-AUTH-SHUTDOWN-031 — Public registration remains removed

`POST /api/auth/register` 永久删除。本计划不提供公开注册、邀请码注册、
自助 User creation 或匿名 password reset。

### CTR-AUTH-SHUTDOWN-032 — V1 management surface 语义保持

POST `/api/v1/principals` 与 POST `/api/v1/clients` 保持 creation-capable
idempotent provisioning 语义（见 `CTR-AUTH-SHUTDOWN-001` 管理接口表与
`CTR-AUTH-SHUTDOWN-024` data authority）；其 shape/conflict 语义由
frozen 1.3.0 bundle 与本 Spec Acceptance 的 idempotent gates 验证：
same external-ref + same payload resolves same identity；same
external-ref + different payload → 409；并发不同 payload 不静默接受
winner；agent shape incomplete → 400；service shape with agent fields →
400；secret 只在 creation 返回一次。

### CTR-AUTH-SHUTDOWN-033 — Repository verification command

根项目唯一总门禁：

```text
npm run verify
```

必须运行：

1. Contract validation。
2. Source pin validation。
3. Snapshot reproducibility twice。
4. TypeScript build。
5. OAuth V1 tests。
6. Human lifecycle tests。
7. State-boundary tests。
8. Operator lifecycle tests。
9. Idempotent tests。
10. Resolution AC-R1..R13、R15、R16（legacy aliases 见 §10）。
11. Readiness read-only tests。
12. Negative conformance。
13. Machine Token Provider tests。
14. Migration static validation。
15. Source disposition test。
16. `git diff --check` equivalent。

`AC-R14`（legacy alias）由 activation receipt Gate 执行。

### CTR-AUTH-SHUTDOWN-034 — Completion definition

本计划完成的判定：

```text
LEGACY_RUNTIME_ROUTES = 0
LEGACY_HS256_TOKEN_PROFILES = 0
LEGACY_REFRESH_SESSION_PATHS = 0
GENERIC_VERIFY_TOKEN_ORACLE = 0
TOKEN_INTROSPECTION_ENDPOINTS = 0
AUTH_CONTRACT_MODE_SWITCH = 0
POST_CUT_BACKFILL_APPLY_PATHS = 0
LEGACY_FLAT_FIELD_REPAIR_PATHS = 0

V1_MACHINE_LIFECYCLE_SEAM =
  OPERATOR_ONLY_HOST_LOCAL_CLI

ONLINE_PROVISIONING_CLIENT_RESOLUTION =
  FRESH_READ_ONLY_AUTHENTICATED_MANAGEMENT_GET

ONLINE_PROVISIONING_RESOLUTION_DB_WRITES = 0
ONLINE_PROVISIONING_RESOLUTION_CACHE = 0
ONLINE_PROVISIONING_RESOLUTION_ERROR_WIRE = EXACT
CLIENT_EXTERNAL_REF_NULL = RETURNED_AS_FACT

RESOURCE_CONSUMER_STATUS_LOOKUP = 0
ACCESS_TOKEN_VALIDITY = UNTIL_EXP
V1_RUNTIME_AUTHORITY = SINGLE

AGENT_CORE_STATE_F_SPEC_ALIGNMENT = PASS
STATE_F_NO_MUTATION_BEFORE_RESOLUTION_E2E = PASS

ALL_REAL_CONSUMERS =
  MIGRATED_TO_V1 |
  INTENTIONALLY_OFFLINE |
  NOT_A_REAL_CONSUMER

HUMAN_PRINCIPAL_ADMINISTRATION_CHILD = ACCEPTED_AND_IMPLEMENTED_AND_AUDITED
HUMAN_CREDENTIAL_LIFECYCLE_CHILD = ACCEPTED_AND_IMPLEMENTED_AND_AUDITED
PRODUCTION_GATES = PASS
```

## 10. Acceptance

每个 active Contract 至少映射一个 Acceptance item；每个 Acceptance
引用真实存在的 Contract。既有 `AC-R1`..`AC-R16` 名称保留为 legacy
aliases，语义不变（历史 review 中的 AC-R 名称仍指向原语义）。

### 10.0 Acceptance coordinate model（35-item coordinate matrix）

本 Spec 的 16 个 `ACC-AUTH-RESOLUTION-*` 与 19 个
`ACC-AUTH-SHUTDOWN-*`，共 35 项 Acceptance，每项除既有
Contracts / Method / Expected result / Failure condition 外，还必须
绑定以下 coordinate 字段（迁入自调查
`AUTH_SERVICE_PR2_REMAINING_BLOCKERS_INVESTIGATION_V1` §3 的完整
矩阵，语义不得删减或改写）：

```text
Contracts
Evidence class
Profile
exact accepted Spec revision
exact implementation commit
environment identity
configuration identity
database identity
observed_at
command / probe
persistent record location
expected result
failure condition
```

共享 coordinate profiles：

```text
SRC  = source-tree / static analysis / build-reproducibility evidence
DB   = database-state evidence（schema、migration、authority rows）
PROC = real-process integration evidence（local/integration runtime）
STG  = isolated/staging environment evidence
XR   = cross-repository evidence（fixed-SHA external caller / receipt）
PROD = production environment evidence
RB   = rollback evidence（whole-release drill / artifact scan）
```

允许的 persistent record location（不接受其他位置）：

```text
PR   = implementation PR Contract matrix
CONF = docs/conformance/auth-service-legacy-shutdown-v1.md
ACT  = docs/audits/auth-service-legacy-shutdown-v1-activation.md
RB   = docs/audits/auth-service-legacy-shutdown-v1-rollback.md
XR   = cross-repository activation receipt
```

规则：

- 本 Program `implementation_authority = none`，实现尚未开始；因此
  每项的 "Coordinate binding" 块先冻结 Profile、Evidence class、
  command / probe 与 persistent record，而 exact accepted Spec
  revision、exact implementation commit、environment identity、
  configuration identity、database identity 与 `observed_at` 是
  执行时坐标：evidence 产生时 MUST 记录进该项指定的 persistent
  record，缺失任一坐标的记录不构成 Evidence。
- 测试文件存在、测试名称或未执行命令不得充当 Evidence。
- 机械完整性等式：

```text
ACCEPTANCE_ITEMS = 35
ACCEPTANCE_ITEMS_WITH_COORDINATE_PROFILE = 35
ACCEPTANCE_ITEMS_WITH_IMPLEMENTATION_COMMIT = 35
ACCEPTANCE_ITEMS_WITH_OBSERVED_AT = 35
ACCEPTANCE_ITEMS_WITH_PERSISTENT_RECORD = 35
ACCEPTANCE_COORDINATE_MATRIX = COMPLETE
```

### 10.1 Resolution seam acceptance（legacy aliases AC-R1..AC-R16）

#### ACC-AUTH-RESOLUTION-001 — Missing client（Legacy alias: AC-R1）

- Contracts: `CTR-AUTH-SHUTDOWN-012`、`CTR-AUTH-SHUTDOWN-013`、
  `CTR-AUTH-SHUTDOWN-015`、`CTR-AUTH-SHUTDOWN-016`
- Method: integration test
- Required evidence: executed command, implementation commit,
  request/response record
- Expected result:

```text
GET unknown mc_*
→ 404 {"error":"machine_client_not_found"}
→ no-store/no-cache
→ Principal/Client row counts unchanged
→ no external-ref claim
→ no sensitive output
```

- Failure condition: 任意断言失败

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R1 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-002 — Active client（Legacy alias: AC-R2）

- Contracts: `CTR-AUTH-SHUTDOWN-011`、`CTR-AUTH-SHUTDOWN-013`、
  `CTR-AUTH-SHUTDOWN-016`
- Method: integration test
- Expected result:

```text
→ 200 exact projection
→ exact status/external refs/Principal profile
→ no secret fields
→ identity and Grant state row-equivalent before/after
→ no-store/no-cache
```

- Failure condition: projection 字段缺失/多余、row drift 或 cache header
  缺失

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R2 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-003 — Revoked client（Legacy alias: AC-R3）

- Contracts: `CTR-AUTH-SHUTDOWN-011`、`CTR-AUTH-SHUTDOWN-012`
- Method: integration test
- Expected result:

```text
→ 200 exact revoked status
→ not 404
→ no restore/rotate/claim/replacement
```

- Failure condition: 404、恢复或 claim 行为

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R3 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-004 — Disabled principal（Legacy alias: AC-R4）

- Contracts: `CTR-AUTH-SHUTDOWN-011`、`CTR-AUTH-SHUTDOWN-012`
- Method: integration test
- Expected result:

```text
→ 200 exact disabled status
→ no replacement/repair
```

- Failure condition: 非 200 或任何 repair

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R4 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-005 — Authorization（Legacy alias: AC-R5）

- Contracts: `CTR-AUTH-SHUTDOWN-009`、`CTR-AUTH-SHUTDOWN-014`
- Method: integration test
- Expected result:

```text
no Token                                      → 401 invalid_client
wrong signature/issuer/audience/kid/expiry    → 401 invalid_client
wrong scope                                   → 403 insufficient_scope
non-Service management principal              → 403 insufficient_scope
svc-auth + auth.identity.provision + Service  → allowed
```

Caller identity comes only from verified Token。

- Failure condition: 任意错误身份被接受，或正确身份被错误 wire 拒绝

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R5 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-006 — No introspection expansion（Legacy alias: AC-R6）

- Contracts: `CTR-AUTH-SHUTDOWN-009`、`CTR-AUTH-SHUTDOWN-007`
- Method: integration test（Resource Consumer Token / ordinary business
  Token / arbitrary bearer Token）
- Expected result: 不得把 endpoint 用作 per-request authorization /
  Token-validity Oracle
- Failure condition: 任何非授权 caller 通过该 endpoint 获得
  authorization 决策输入

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R6 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-007 — Concurrency（Legacy alias: AC-R7）

- Contracts: `CTR-AUTH-SHUTDOWN-016`
- Method: concurrency integration test
- Expected result: 并发 repeated fresh resolve 时 results reflect each
  request's DB read；DB writes = 0；duplicate identities = 0；
  external-ref claims = 0
- Failure condition: 任何写入或身份漂移

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R7 并发用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-008 — Secret absence（Legacy alias: AC-R8）

- Contracts: `CTR-AUTH-SHUTDOWN-015`
- Method: response/error/header/log/snapshot 断言
- Expected result:

```text
raw secret absent
secretHash/verifier absent
Authorization Token absent
Refresh Credential absent
raw exception absent
```

- Failure condition: 任何敏感字段出现

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R8 断言；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-009 — Mutating-function isolation（Legacy alias: AC-R9）

- Contracts: `CTR-AUTH-SHUTDOWN-017`、`CTR-AUTH-SHUTDOWN-010`
- Method: independent probe（import/call graph）
- Expected result: 没有 import/call：createOrGetPrincipal、
  createOrGetClient、claim/bind、rotate、revoke、disable、requestDigest
  backfill、Grant read/write；无第二 resolution Route/service
- Failure condition: 任何 mutating import/call 或并行 surface

- Coordinate binding: Profile = `SRC`；Evidence class =
  `STATIC_IMPORT_CALL_GRAPH_PROBE`；command / probe = independent import/call-graph probe + `tests/v1-management-resolution.test.ts` AC-R9 断言；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-010 — Freshness after revoke（Legacy alias: AC-R10）

- Contracts: `CTR-AUTH-SHUTDOWN-013`
- Method: sequenced integration test
- Expected result:

```text
1. resolve active → 200 active
2. independently revoke Client
3. next provisioning operation sends a new GET
4. next GET reaches auth-service and returns 200 revoked
5. no cached active result, no 304
6. Auth writes = 0
```

- Failure condition: 任何缓存结果或 304

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R10 顺序用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-011 — Negative-cache prevention（Legacy alias: AC-R11）

- Contracts: `CTR-AUTH-SHUTDOWN-013`
- Method: sequenced integration test
- Expected result:

```text
1. resolve missing → 404
2. independently create exact Client through authorized mutation path
3. next provisioning operation sends a new GET
4. next GET reaches auth-service and returns 200
5. no cached 404, no 304
```

- Failure condition: 任何缓存结果或 304

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R11 顺序用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-012 — Exact error Wire（Legacy alias: AC-R12）

- Contracts: `CTR-AUTH-SHUTDOWN-014`、`CTR-AUTH-SHUTDOWN-013`、
  `CTR-AUTH-SHUTDOWN-015`、`CTR-AUTH-SHUTDOWN-018`
- Method: 逐一验证错误状态
- Expected result: 逐一验证：

```text
400 invalid_request
401 invalid_client
403 insufficient_scope
404 machine_client_not_found
429 temporarily_unavailable
500 machine_identity_state_invalid
503 temporarily_unavailable
```

每项必须验证：

```text
HTTP status = exact
Content-Type media type = application/json
body = exact {"error":"<exact_code>"}

Cache-Control = no-store
Pragma = no-cache
ETag absent
Last-Modified absent
status != 304
```

并验证以下字段在每项错误状态中全部缺失：

```text
message
error_description
detail
stack
raw exception
raw Prisma error
target internal row ID
Principal internal diagnostic ID
Client internal diagnostic ID
Authorization header
Access Token
Token fragment
client secret
secretHash
verifier
Refresh Credential
allowedResources
allowedScopes
MachineAccessGrant
DelegationGrant
User password material
audit-internal sensitive payload
```

AC-R12 COMPOSES AC-R8：AC-R12 对每个错误状态执行全部 AC-R8
sensitive-field assertions 与上表全部 absence assertions，而不是仅在
另一个独立测试中抽样一次。

- Failure condition: 任何 wire/cache/sensitive-field 断言失败

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R12 逐状态断言；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-013 — Nullable Client external ref（Legacy alias: AC-R13）

- Contracts: `CTR-AUTH-SHUTDOWN-011`、`CTR-AUTH-SHUTDOWN-016`
- Method: integration test
- Expected result:

```text
existing Client with externalRef=null
→ 200
→ "client_external_ref": null
→ no create/claim/backfill/repair
→ Auth writes = 0
→ caller contract classifies terminal State F
```

- Failure condition: 非 200、任何 mutation 或 caller 分类未被外部
  authority 冻结时被本地替代

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R13 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-014 — No mutation before State F classification（Legacy alias: AC-R14）

- Contracts: `CTR-AUTH-SHUTDOWN-030`
- Method: 在 exact fixed Agent Core caller commit 上的 E2E；由
  Production Activation fixed-SHA receipt 提供，auth-service unit test
  不能冒充 cross-repository closure
- Expected result: store entry exists 时：

```text
full store validation occurs before Auth mutation
fresh resolve occurs before S1/S2
S1/S2 calls before classification = 0
Auth writes before classification = 0
store writes before classification = 0
duplicate identities = 0
```

覆盖：

```text
404 missing
200 revoked
200 disabled
200 external-ref null
200 external-ref mismatch
200 principal-profile mismatch
500 machine_identity_state_invalid
```

并证明：

```text
429/503/transport failure
→ transient external service failure
→ not State F
→ writes = 0
```

- Failure condition: 任何 classification 前 mutation

- Coordinate binding: Profile = `XR`；Evidence class =
  `CROSS_REPOSITORY_E2E_RECEIPT`；command / probe = Production Activation 的 exact fixed Agent Core SHA State F E2E receipt；
  Persistent record = `XR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-015 — Route-local limiter Wire（Legacy alias: AC-R15）

- Contracts: `CTR-AUTH-SHUTDOWN-018`
- Method: integration test（触发 global limiter）
- Expected result: exact resolution endpoint 被 global limiter 限流时：

```text
→ 429 exact error Wire（{"error":"temporarily_unavailable"}）
→ no-store/no-cache
→ ETag absent
→ Last-Modified absent
→ no 304
```

同一测试必须证明：

```text
global limiter 没有被绕过（请求确实被 global limiter 拒绝）
其他 endpoint 的既有 limiter response 不因本 amendment 改变
```

- Failure condition: limiter 绕过、wire 不精确或其他 endpoint 受影响

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R15 limiter 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-RESOLUTION-016 — Route-local error non-impact（Legacy alias: AC-R16）

- Contracts: `CTR-AUTH-SHUTDOWN-018`
- Method: integration test
- Expected result:

```text
resolution path 的普通 HttpError 不输出 {"message":...}
非 resolution endpoint 仍保持其 governing Wire
本 amendment 没有把整个 auth-service 改成统一 resolution error envelope
```

- Failure condition: 任何非 resolution endpoint 的 error envelope 改变

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/v1-management-resolution.test.ts` AC-R16 用例；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
### 10.2 Program-level acceptance

#### ACC-AUTH-SHUTDOWN-001 — Static source gates

- Contracts: `CTR-AUTH-SHUTDOWN-001`、`CTR-AUTH-SHUTDOWN-002`、
  `CTR-AUTH-SHUTDOWN-003`、`CTR-AUTH-SHUTDOWN-004`、
  `CTR-AUTH-SHUTDOWN-005`、`CTR-AUTH-SHUTDOWN-010`、
  `CTR-AUTH-SHUTDOWN-013`、`CTR-AUTH-SHUTDOWN-017`、
  `CTR-AUTH-SHUTDOWN-022`
- Method: static source analysis（`tests/oauth/v1-source-disposition.test.ts`
  等）
- Expected result:
  - Production source 不存在 shared-secret JWT sign/verify。
  - Production source 不存在 `AUTH_CONTRACT_MODE`。
  - Production source 不存在 `token-login`、`verify-token` Route。
  - Production source 不存在 flat-field runtime auth read/write。
  - Production source 不存在 Legacy Refresh `Map`。
  - Production source 不存在 post-cut backfill apply/repair。
  - `lifecycle.ts` 不 export Token issuance/sign/verify/exchange。
  - `resolution.ts` 不 import mutating identity function、Grant access
    或 Prisma write method。
  - Resolution path 不存在 response cache、ETag、Last-Modified
    validator 或 304 implementation。
  - Production credential/ID/JTI generation 不使用 `Math.random()`。
  - 无第二 resolution Route/service。
  - 保留 dead data 字段不被 runtime 认证/签发/授权读取。
- Failure condition: 任意静态断言失败

- Coordinate binding: Profile = `SRC`；Evidence class =
  `STATIC_SOURCE_ANALYSIS`；command / probe = `npm run verify` — `tests/oauth/v1-source-disposition.test.ts` 等静态断言；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-002 — Legacy Route gates

- Contracts: `CTR-AUTH-SHUTDOWN-001`、`CTR-AUTH-SHUTDOWN-002`、
  `CTR-AUTH-SHUTDOWN-003`
- Method: HTTP integration test
- Expected result: 以下返回 `404`：

```text
/api/auth/login
/api/auth/register
/api/auth/token-login
/api/auth/refresh
/api/auth/me
/api/auth/change-password
/api/users
/api/roles
/api/services
/api/services/verify-token
/api/services/lookup/svc-workflow
```

- Failure condition: 任何非 404 或兼容响应

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — Legacy route 404 HTTP probes；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-003 — State boundary gates

- Contracts: `CTR-AUTH-SHUTDOWN-006`、`CTR-AUTH-SHUTDOWN-007`、
  `CTR-AUTH-SHUTDOWN-008`
- Method: integration tests（`tests/oauth/v1-state-boundary.test.ts`）
- Expected result:
  - Disabled User 不能新 authentication/code exchange/refresh。
  - Revoked HumanClient 不能 code exchange/refresh。
  - Disabled Principal/Revoked Client 不能获取新 Token。
  - Revoked TrustedProxy 或失效 original Client 不能 Exchange。
  - Revoked management actor 不能 provisioning/resolution。
  - Principal disable 后，Resource Consumer 仍离线接受先前签发且未到
    `exp` 的 valid Access Token。
  - 到 `exp` 后拒绝。
  - Resource Consumer 不发出 live status/introspection/resolution
    request。
- Failure condition: 任意边界失效

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/oauth/v1-state-boundary.test.ts`；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-004 — Operator lifecycle seam gates

- Contracts: `CTR-AUTH-SHUTDOWN-019`
- Method: CLI integration tests（`tests/oauth/v1-lifecycle.test.ts`）
- Expected result:
  - CLI Inspect 不返回 Secret Hash、Secret 或 Token。
  - Rotate 只返回一次 Secret，旧 Secret 不能新 issuance。
  - Revoke/Disable 阻止后续 issuance/exchange/management。
  - 终态重试幂等。
  - Wrong expected-version conflict 且不写。
  - Audit failure 使 mutation fail。
  - Lifecycle 不访问 flat fields、Grants 或 issuance。
- Failure condition: 任意 lifecycle 断言失败

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — `tests/oauth/v1-lifecycle.test.ts`（host-local CLI）；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-005 — Backfill cutoff gates

- Contracts: `CTR-AUTH-SHUTDOWN-020`、`CTR-AUTH-SHUTDOWN-021`
- Method: static + script tests
  （`tests/oauth/v1-readiness-readonly.test.ts`）
- Expected result:
  - `contract:v1:backfill` 不存在。
  - Legacy repair/cleanup mutator 不存在。
  - Readiness 只有 read methods。
  - 缺失 V1 Grant 返回 nonzero，不产生 write SQL/migration plan。
  - Cut Artifact 不读取 flat fields。
- Failure condition: 任何写路径存在

- Coordinate binding: Profile = `DB`；Evidence class =
  `STATIC_AND_SCRIPT_DATABASE_EVIDENCE`；command / probe = `npm run verify` — `tests/oauth/v1-readiness-readonly.test.ts` + readiness 输出；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-006 — Runtime fingerprint gates

- Contracts: `CTR-AUTH-SHUTDOWN-022`、`CTR-AUTH-SHUTDOWN-026`
- Method: `tests/oauth/v1-runtime-fingerprint.test.ts` 与
  Independent Acceptance Review 的 double-run
- Expected result:
  - Exact Git pins 与 1.3.0 内容一致。
  - Prepare 连续两次，完整 source/runtime digest 分别一致。
  - 修改 pinned byte 后 gate 失败。
  - Provider digest test 不接受旧 1.2.0/1.1.0 digest。
- Failure condition: digest 不一致或可被旧 digest 通过

- Coordinate binding: Profile = `SRC`；Evidence class =
  `BUILD_DIGEST_DOUBLE_RUN`；command / probe = 连续两次 `node scripts/prepare-minimal-auth-v1.mjs` + `tests/oauth/v1-runtime-fingerprint.test.ts`；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-007 — Human session gates

- Contracts: `CTR-AUTH-SHUTDOWN-006`、`CTR-AUTH-SHUTDOWN-008`
- Method: integration tests
- Expected result:
  - Authorization Code single use。
  - Redirect URI exact match。
  - PKCE S256 required。
  - Concurrent refresh 只产生一个 successor。
  - Refresh reuse 撤销 Family/Session。
  - Logout 撤销 Family/Session。
  - Password-reset/disabled User 不能 refresh。
  - 已签发 Access Token 仍只按 `exp` 失效。
- Failure condition: 任意 session 断言失败

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — human session integration tests；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-008 — Idempotent mutating management gates

- Contracts: `CTR-AUTH-SHUTDOWN-032`、`CTR-AUTH-SHUTDOWN-024`
- Method: integration tests
- Expected result:
  - Same external-ref + same payload resolves same identity。
  - Same external-ref + different payload → 409。
  - Concurrent different payload 不静默接受 winner。
  - Agent shape incomplete → 400。
  - Service shape with Agent fields → 400。
  - Secret 只在 Client creation 返回一次。
- Failure condition: 任意 idempotency/shape 断言失败

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — idempotent management integration tests；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-009 — Repository verification command gates

- Contracts: `CTR-AUTH-SHUTDOWN-033`
- Method: `npm run verify` 执行
- Expected result: §CTR-033 所列 16 项全部纳入且通过
- Failure condition: 任一项缺失或失败

- Coordinate binding: Profile = `PROC`；Evidence class =
  `VERIFICATION_COMMAND_RUN`；command / probe = `npm run verify`（§CTR-033 16 项）完整执行记录；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-010 — Production activation gate evidence

- Contracts: `CTR-AUTH-SHUTDOWN-026`
- Method: activation child receipt（跨环境证据）
- Expected result: `AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1` 收集
  九门与全部 Gate 的 Evidence，创建
  `MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1` Activation Record，
  对 Record 完成独立审计，经 Owner acceptance 合入后，才由该有效
  Record 投影 effective 字段并部署 Auth Cut Artifact；frozen
  `1.3.0` manifest 与 accepted Contract literal 保持未被修改
- Failure condition: 任何 Gate 缺失证据时 Record 被创建或 effective
  字段被投影；manifest 或 accepted literal 被直接修改来表示
  effective

- Coordinate binding: Profile = `PROD`；Evidence class =
  `ACTIVATION_RECEIPT`；command / probe = Production Activation Child 的 Gate evidence + Activation Record 审计；
  Persistent record = `ACT`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-011 — Human administration children prerequisite

- Contracts: `CTR-AUTH-SHUTDOWN-029`
- Method: activation 前置检查（Program-level 坐标校验：
  `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1` 在
  `mayf3/auth-service#15` 存在、accepted、implemented、audited，exact
  Head 与 `CTR-AUTH-SHUTDOWN-029` 绑定坐标一致；独立 credential-only
  Child（planned
  `AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1`）同样 accepted、
  implemented、audited）
- Expected result: 缺失任一 Child、HPA exact Head 不匹配、或以旧占位名
  `AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1` 充当 Child 时
  activation blocked
- Failure condition: 无 Child / 坐标不匹配 / 占位名充当 authority 而
  activation 进行

- Coordinate binding: Profile = `PROD`；Evidence class =
  `ACTIVATION_PREREQUISITE_CHECK`；command / probe = activation 前置检查（两个 Human administration children 均存在、accepted、implemented、audited 且 exact Head 匹配）；
  Persistent record = `ACT`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-012 — Cross-repository closure gates

- Contracts: `CTR-AUTH-SHUTDOWN-030`
- Method: activation receipt（fixed-SHA E2E）
- Expected result: 三个 `GATE_AGENT_CORE_*` / State F gate 全 PASS
- Failure condition: 任何跨仓库 gate 缺失

- Coordinate binding: Profile = `XR`；Evidence class =
  `CROSS_REPOSITORY_E2E_RECEIPT`；command / probe = 三个 `GATE_AGENT_CORE_*` / State F gate 的 fixed-SHA E2E receipt；
  Persistent record = `XR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-013 — Public registration remains removed

- Contracts: `CTR-AUTH-SHUTDOWN-031`
- Method: static + HTTP test
- Expected result: 无注册 route、无邀请码注册、无自助 creation、无匿名
  reset
- Failure condition: 任何注册面出现

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — static + HTTP 注册面探针；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-014 — Rollback boundary verification

- Contracts: `CTR-AUTH-SHUTDOWN-028`
- Method: static scan of Cut Artifact
- Expected result: 无任何 Legacy 重启用 seam；rollback 演练记录
  whole-release 步骤
- Failure condition: 任何 seam 存在

- Coordinate binding: Profile = `RB`；Evidence class =
  `ROLLBACK_SCAN_AND_DRILL`；command / probe = Cut Artifact static scan + whole-release rollback 演练记录；
  Persistent record = `RB`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-015 — Completion definition gates

- Contracts: `CTR-AUTH-SHUTDOWN-034`、`CTR-AUTH-SHUTDOWN-005`
- Method: 完成判定清单核对（runtime routes/profiles/paths 计数为 0 等）
- Expected result: §CTR-034 全部等式成立
- Failure condition: 任何计数非零或 seam 状态不符

- Coordinate binding: Profile = `PROD`；Evidence class =
  `COMPLETION_CHECKLIST`；command / probe = §CTR-034 完成判定清单核对（含生产侧等式）；
  Persistent record = `ACT`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-016 — Failure-closed behavior gates

- Contracts: `CTR-AUTH-SHUTDOWN-027`
- Method: fault-injection integration tests
- Expected result: §CTR-027 每条规则按指定失败方式闭合
- Failure condition: 任何 fail-open

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — fault-injection integration tests；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-017 — Token rejection gates

- Contracts: `CTR-AUTH-SHUTDOWN-023`
- Method: negative conformance（`scripts/obo-conformance-negative.ts`
  纳入 verify）
- Expected result: §CTR-023 rejected 列表全部被拒绝；accepted profiles
  按 exact binding 通过
- Failure condition: 任何 rejected token 被接受

- Coordinate binding: Profile = `PROC`；Evidence class =
  `NEGATIVE_CONFORMANCE`；command / probe = `npm run verify` — `scripts/obo-conformance-negative.ts`；
  Persistent record = `CONF`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-018 — Preserved public surface semantics

- Contracts: `CTR-AUTH-SHUTDOWN-032`、`CTR-AUTH-SHUTDOWN-001`
- Method: integration tests
- Expected result: `/oauth/token` 仅支持四种 V1 grant types；health 不
  宣称 production-effective；JWKS 发布 active + retained keys；logout
  不撤销已签发 Access Token
- Failure condition: 任何保留 surface 语义漂移

- Coordinate binding: Profile = `PROC`；Evidence class =
  `INTEGRATION_TEST`；command / probe = `npm run verify` — preserved surface integration tests；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
#### ACC-AUTH-SHUTDOWN-019 — Source disposition gates

- Contracts: `CTR-AUTH-SHUTDOWN-025`
- Method: Runtime Child 在其 exact implementation Base 上产生的
  closed manifest（完整 `git ls-files` inventory + 全部
  disposition/owning child/impact）+ 独立 exact-revision review +
  `tests/oauth/v1-source-disposition.test.ts`
- Expected result: Runtime Child 的 exact closed manifest 覆盖其
  Base 上全部 tracked path（含 §25.0 所列
  `CURRENT_BASE_NEW_TRACKED_PATH_EVIDENCE` 与其后任何新增 path）；
  deleted Legacy modules/scripts/exports absent；CREATE 文件存在；
  实现 diff 与 manifest 零偏离；闭集之外的文件未被
  shutdown/resolution 修改；§25.1–§25.11 历史表未被当作 exact
  manifest 使用，历史 149 项未被当作当前 Base 的封闭集
- Failure condition: Runtime Child 未产生 manifest、manifest 未覆盖
  全部 path、manifest 与实现 diff 偏离、闭集外文件被修改、或历史
  调查数字被误用为 exact manifest

- Coordinate binding: Profile = `SRC`；Evidence class =
  `EXACT_REVISION_MANIFEST_REVIEW`；command / probe = Runtime Child exact closed manifest + 独立 exact-revision review + `tests/oauth/v1-source-disposition.test.ts`；
  Persistent record = `PR`。执行时必须记录：exact accepted
  Spec revision、exact implementation commit、environment identity、
  configuration identity、database identity、`observed_at`
  （写入该 persistent record；缺失任一坐标不构成 Evidence）。
### 10.3 Contract → Acceptance coverage table

| Contract | Acceptance coverage |
|---|---|
| `CTR-AUTH-SHUTDOWN-001` | `ACC-AUTH-SHUTDOWN-001`、`ACC-AUTH-SHUTDOWN-002`、`ACC-AUTH-SHUTDOWN-018` |
| `CTR-AUTH-SHUTDOWN-002` | `ACC-AUTH-SHUTDOWN-001`、`ACC-AUTH-SHUTDOWN-002` |
| `CTR-AUTH-SHUTDOWN-003` | `ACC-AUTH-SHUTDOWN-001`、`ACC-AUTH-SHUTDOWN-002` |
| `CTR-AUTH-SHUTDOWN-004` | `ACC-AUTH-SHUTDOWN-001` |
| `CTR-AUTH-SHUTDOWN-005` | `ACC-AUTH-SHUTDOWN-001`、`ACC-AUTH-SHUTDOWN-015` |
| `CTR-AUTH-SHUTDOWN-006` | `ACC-AUTH-SHUTDOWN-003`、`ACC-AUTH-SHUTDOWN-007` |
| `CTR-AUTH-SHUTDOWN-007` | `ACC-AUTH-SHUTDOWN-003`、`ACC-AUTH-RESOLUTION-006` |
| `CTR-AUTH-SHUTDOWN-008` | `ACC-AUTH-SHUTDOWN-003`、`ACC-AUTH-SHUTDOWN-007` |
| `CTR-AUTH-SHUTDOWN-009` | `ACC-AUTH-RESOLUTION-005`、`ACC-AUTH-RESOLUTION-006` |
| `CTR-AUTH-SHUTDOWN-010` | `ACC-AUTH-RESOLUTION-009`、`ACC-AUTH-SHUTDOWN-001` |
| `CTR-AUTH-SHUTDOWN-011` | `ACC-AUTH-RESOLUTION-002`、`ACC-AUTH-RESOLUTION-003`、`ACC-AUTH-RESOLUTION-004`、`ACC-AUTH-RESOLUTION-013` |
| `CTR-AUTH-SHUTDOWN-012` | `ACC-AUTH-RESOLUTION-001`、`ACC-AUTH-RESOLUTION-003`、`ACC-AUTH-RESOLUTION-004` |
| `CTR-AUTH-SHUTDOWN-013` | `ACC-AUTH-RESOLUTION-001`、`ACC-AUTH-RESOLUTION-002`、`ACC-AUTH-RESOLUTION-010`、`ACC-AUTH-RESOLUTION-011`、`ACC-AUTH-RESOLUTION-012`、`ACC-AUTH-SHUTDOWN-001` |
| `CTR-AUTH-SHUTDOWN-014` | `ACC-AUTH-RESOLUTION-005`、`ACC-AUTH-RESOLUTION-012` |
| `CTR-AUTH-SHUTDOWN-015` | `ACC-AUTH-RESOLUTION-001`、`ACC-AUTH-RESOLUTION-008`、`ACC-AUTH-RESOLUTION-012` |
| `CTR-AUTH-SHUTDOWN-016` | `ACC-AUTH-RESOLUTION-001`、`ACC-AUTH-RESOLUTION-002`、`ACC-AUTH-RESOLUTION-007`、`ACC-AUTH-RESOLUTION-013` |
| `CTR-AUTH-SHUTDOWN-017` | `ACC-AUTH-RESOLUTION-009`、`ACC-AUTH-SHUTDOWN-001` |
| `CTR-AUTH-SHUTDOWN-018` | `ACC-AUTH-RESOLUTION-012`、`ACC-AUTH-RESOLUTION-015`、`ACC-AUTH-RESOLUTION-016` |
| `CTR-AUTH-SHUTDOWN-019` | `ACC-AUTH-SHUTDOWN-004` |
| `CTR-AUTH-SHUTDOWN-020` | `ACC-AUTH-SHUTDOWN-005` |
| `CTR-AUTH-SHUTDOWN-021` | `ACC-AUTH-SHUTDOWN-005` |
| `CTR-AUTH-SHUTDOWN-022` | `ACC-AUTH-SHUTDOWN-001`、`ACC-AUTH-SHUTDOWN-006` |
| `CTR-AUTH-SHUTDOWN-023` | `ACC-AUTH-SHUTDOWN-017` |
| `CTR-AUTH-SHUTDOWN-024` | `ACC-AUTH-SHUTDOWN-008` |
| `CTR-AUTH-SHUTDOWN-025` | `ACC-AUTH-SHUTDOWN-019` |
| `CTR-AUTH-SHUTDOWN-026` | `ACC-AUTH-SHUTDOWN-006`、`ACC-AUTH-SHUTDOWN-010` |
| `CTR-AUTH-SHUTDOWN-027` | `ACC-AUTH-SHUTDOWN-016` |
| `CTR-AUTH-SHUTDOWN-028` | `ACC-AUTH-SHUTDOWN-014` |
| `CTR-AUTH-SHUTDOWN-029` | `ACC-AUTH-SHUTDOWN-011` |
| `CTR-AUTH-SHUTDOWN-030` | `ACC-AUTH-SHUTDOWN-012`、`ACC-AUTH-RESOLUTION-014` |
| `CTR-AUTH-SHUTDOWN-031` | `ACC-AUTH-SHUTDOWN-013` |
| `CTR-AUTH-SHUTDOWN-032` | `ACC-AUTH-SHUTDOWN-008`、`ACC-AUTH-SHUTDOWN-018` |
| `CTR-AUTH-SHUTDOWN-033` | `ACC-AUTH-SHUTDOWN-009` |
| `CTR-AUTH-SHUTDOWN-034` | `ACC-AUTH-SHUTDOWN-015` |

覆盖校验：`CONTRACT_COUNT = 34`；
`CONTRACTS_WITH_ACCEPTANCE = 34`；每个 Acceptance 引用的 Contract 均
存在；双向映射完整。

## 11. Alternatives and disposition

旧标签 A–S 保留为 human-readable alias；处置不变。

### ALT-AUTH-SHUTDOWN-001 —（Legacy alias: A）Legacy allowlist

- Related decision: `DEC-AUTH-SHUTDOWN-001`
- Disposition: rejected。继续保留最弱鉴权面。

### ALT-AUTH-SHUTDOWN-002 —（Legacy alias: B）长期 `v1_shadow` 或双协议 Artifact

- Related decision: `DEC-AUTH-SHUTDOWN-014`
- Disposition: rejected。PRE_CUT 完成 readiness，Cut Artifact 只有 V1。

### ALT-AUTH-SHUTDOWN-003 —（Legacy alias: C）保留 `token-login` bootstrap

- Related decision: `DEC-AUTH-SHUTDOWN-002`
- Disposition: rejected。Owner 已决定删除且无 replacement。

### ALT-AUTH-SHUTDOWN-004 —（Legacy alias: D）修补 Legacy Refresh

- Related decision: `DEC-AUTH-SHUTDOWN-004`（V1 architecture 保持）
- Disposition: rejected。使用 V1 Human Session/Refresh Family。

### ALT-AUTH-SHUTDOWN-005 —（Legacy alias: E）保留 `verify-token`、introspection 或 Resource Consumer live lookup

- Related decision: `DEC-AUTH-SHUTDOWN-003`、`DEC-AUTH-SHUTDOWN-007`
- Disposition: rejected。Resource Consumer 固定 offline-JWKS-only。
  Resolution endpoint 不是 Token Oracle。

### ALT-AUTH-SHUTDOWN-006 —（Legacy alias: F）Access Token blacklist

- Related decision: `DEC-AUTH-SHUTDOWN-008`
- Disposition: rejected。Access Token 按短 TTL 有效至 `exp`。

### ALT-AUTH-SHUTDOWN-007 —（Legacy alias: G）Lifecycle seam 复用 Legacy `service.ts`

- Related decision: `DEC-AUTH-SHUTDOWN-009`
- Disposition: rejected。Legacy module 混合 lifecycle、flat fields 与
  issuance export。

### ALT-AUTH-SHUTDOWN-008 —（Legacy alias: H）Post-cut readiness 自动补 Grant

- Related decision: `DEC-AUTH-SHUTDOWN-011`
- Disposition: rejected。Readiness 只提供证据。

### ALT-AUTH-SHUTDOWN-009 —（Legacy alias: I）Runtime Child 直接设置 production effective

- Related decision: `DEC-AUTH-SHUTDOWN-012`、`DEC-AUTH-SHUTDOWN-015`
- Disposition: rejected。只有 Production Activation Child 可更新
  lifecycle。

### ALT-AUTH-SHUTDOWN-010 —（Legacy alias: J）Public registration 补 Human lifecycle

- Related decision: `DEC-AUTH-SHUTDOWN-013`
- Disposition: rejected。User creation/reset/disable 必须受控并持久
  审计；受控路径为 §3.5 委托的
  `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`（PR #15）与独立
  credential-only Child，而非公开注册。

### ALT-AUTH-SHUTDOWN-011 —（Legacy alias: K）首轮同时 drop 所有 Legacy tables/columns

- Related decision: `DEC-AUTH-SHUTDOWN-005`
- Disposition: rejected。运行时硬切不要求立即破坏 rollback。

### ALT-AUTH-SHUTDOWN-012 —（Legacy alias: L）使用 POST S1/S2 作 Client 状态探针

- Related decision: `DEC-AUTH-SHUTDOWN-010`
- Disposition: rejected。create/claim/digest-backfill 副作用违反
  fail-before-mutation。

### ALT-AUTH-SHUTDOWN-013 —（Legacy alias: M）暴露 operator lifecycle CLI 为 HTTP inspect

- Related decision: `DEC-AUTH-SHUTDOWN-009`
- Disposition: rejected。两个 seam 的 caller、输出和 authority 不同。

### ALT-AUTH-SHUTDOWN-014 —（Legacy alias: N）Auth 解释 Agent Core external-ref prefix

- Related decision: `DEC-AUTH-SHUTDOWN-017`
- Disposition: rejected。external-ref 对 Auth opaque。

### ALT-AUTH-SHUTDOWN-015 —（Legacy alias: O）Resolution auto-repair / identity reconciliation

- Related decision: `DEC-AUTH-SHUTDOWN-010`、`DEC-AUTH-SHUTDOWN-017`
- Disposition: rejected。read-only seam 只返回事实。

### ALT-AUTH-SHUTDOWN-016 —（Legacy alias: P）Auth Spec 单方面宣布 Agent Core State F 已关闭

- Related decision: `DEC-AUTH-SHUTDOWN-015`
- Disposition: rejected。caller sequencing 由 Agent Core accepted
  authority 治理；必须原地 amendment 并获得 fixed-SHA E2E evidence。

### ALT-AUTH-SHUTDOWN-017 —（Legacy alias: Q）Cache successful or missing resolution

- Related decision: `DEC-AUTH-SHUTDOWN-010`
- Disposition: rejected。active/revoked/missing 是时变状态；任何正缓存
  或负缓存都会破坏 mutation-before-current-state-check。

### ALT-AUTH-SHUTDOWN-018 —（Legacy alias: R）`client_external_ref=null` 返回 5xx

- Related decision: `DEC-AUTH-SHUTDOWN-017`
- Disposition: rejected。当前正式数据模型允许 null/unbound 状态；纯只读
  seam 应返回事实。Caller 将其判为 mismatch/State F，Auth 不在 read
  path claim 或 repair。

### ALT-AUTH-SHUTDOWN-019 —（Legacy alias: S）复用普通 `{message:...}` HttpError envelope

- Related decision: `DEC-AUTH-SHUTDOWN-018`
- Disposition: rejected。caller 需要可执行、稳定、无歧义的 management
  error Wire；该 Wire 是 route-local exact-path policy，不得推广为
  全服务 envelope。

## 12. Migration, compatibility, and rollback

### 12.1 Governance migration（本 amendment）

- 本 Spec 从 `.agents/specs/` 迁移到 `docs/specs/`，rebase 到
  `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`；不保留旧副本、不创建转发
  副本。
- 历史全部 review coordinates 标记
  `HISTORICAL_REVIEW_EVIDENCE_ONLY`；迁移后 exact Head 需要新的完整
  independent semantic review，之后才可能由 Owner accept。
- 本迁移不改产品语义；如实现期发现真实语义矛盾，不得静默修复，必须
  报告 `GOVERNANCE_MIGRATION_SEMANTIC_CONFLICT = YES` 并由 Owner 另行
  amendment。
- V2 parent realignment amendment：本 Spec 的 evaluated base 为
  `f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e`（parent V2 merge
  `37edaa6f...` 已包含），parent authority 切换为 accepted
  `MINIMAL_AUTH_FOUNDATION_V2`（先行 human administration authority
  split amendment `7a2a499...` 完成拆分，本 amendment 保留其全部
  语义），外部 authority 重绑定为 `d83a2ff0...`，并完成五个 review
  blocker 的修订（见 §0 与 PR body 的 blocker closure map）。本
  realignment 亦不改产品语义。

### 12.2 Parent V2 拥有的 migration sequencing（无 partial supersession）

```text
PARTIAL_SUPERSESSION = NONE
MIGRATION_SEQUENCING_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
```

本 Program 不再通过 prose 对
`docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` 或任何 V1
文档做 prose-only partial supersession。`MINIMAL_AUTH_FOUNDATION_V1`
是 `SUPERSEDED_HISTORICAL_AUTHORITY`；V1 root、modules 与
Contract Bundle `1.3.0` 是
`V2_EXACT_INCORPORATED_HISTORICAL_PROVENANCE`。migration /
hard-cut / sequencing 方向由 accepted V2 拥有（`DEC-MAFV2-004` 至
`DEC-MAFV2-006`、`CTR-MAFV2-002`、`CTR-MAFV2-011`）；本 Program
的硬切产品方向与 Parent 一致并受其约束：

```text
LEGACY_MIGRATION_WINDOW = NONE
NEW_DUAL_PROTOCOL_ARTIFACT = FORBIDDEN
POST_CUT_COMPATIBILITY_WINDOW = NONE
PER_REQUEST_FALLBACK = NONE
CUT_ARTIFACT = V1_ONLY
ROLLBACK = WHOLE_RELEASE_ONLY
```

其中 `LEGACY_MIGRATION_WINDOW = NONE` 仅作为
`NEW_OR_POST_CUT_COMPATIBILITY_WINDOW = NONE` 的 shorthand（与
`CTR-MAFV2-002` 一致）；它 MUST NOT 否定 PRE_CUT consumer
migration period 与 legacy-traffic evidence window。

Consumer dependency 必须分类（与 `CTR-MAFV2-011` 一致）：

```text
PRE_CUT_EXISTING_SURFACE =
  available on EXISTING_DEPLOYED_LEGACY_CARRYING_ARTIFACT
CUT_INTRODUCED_SURFACE =
  first available only in V1_ONLY Cut Artifact
GET /api/v1/clients/:client_id = CUT_INTRODUCED_SURFACE
```

不可变顺序：

1. build V1-only Cut Artifact；
2. 在 isolated/staging 启动真实 Cut candidate（绝不是 pre-gate
   production deployment）；
3. fixed-SHA Agent Core caller 对该 candidate 完成 State F E2E；
4. 生产 PRE_CUT existing-surface Consumers 完成迁移；
5. 证明 Legacy traffic zero（冻结窗口）；
6. 部署 Auth Cut Artifact；
7. 验证 Cut-only endpoint ready；
8. 激活依赖该 endpoint 的 fixed-SHA caller artifact；
9. mainline reconformance；
10. 创建并接受 Activation Record（仅当全部 gate 通过）。

必须区分：

```text
IMPLEMENTATION_AND_CONFORMANCE_READY
  ≠ PRODUCTION_CALLER_ACTIVATED
```

`ALL_REQUIRED_MIGRATIONS_COMPLETE` 只断言前者加上 PRE_CUT consumer
迁移完成；Cut-only caller 的生产激活只在第 8 步发生。本顺序 MUST
NOT 引入新的 dual-protocol artifact、mode switch、per-request
fallback、pre-cut Cut-candidate 生产部署或 post-cut compatibility
window。

V0 frozen contracts（`WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0` 与
`WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0`）继续治理生产，直到有效
V2 Activation Record 证明全部九门完成；不得仅因文档、单测或局部
代码完成宣布 effective；不允许 per-request
algorithm/audience/profile fallback；不新增 V0 Consumer。

### 12.3 Compatibility 与 rollback

- Compatibility 边界：Consumer readiness 是生产部署 Gate，不构成携带
  Legacy runtime 的理由；外部 Resource Consumer 迁移由 Child 2 独立
  完成。
- Rollback：见 `CTR-AUTH-SHUTDOWN-028`（whole-release only；无 Legacy
  重启用 seam；首个 Runtime Child 不做破坏性 schema 删除）。

### 12.4 Human authority split amendment（本 amendment）

- 本 amendment 为 docs-only Program scope split 与 acceptance-precondition
  reconciliation：将 Human Principal administration 权威正式委托给
  `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`（PR #15，exact Head
  `98ec29a1152bfa9530c572ec5a541ea02df163c4`，见 §3.5），将 password
  reset / credential replacement 委托给 planned credential-only Child
  `AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1`。
- 旧占位名称 `AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1` 降级为
  non-authority historical placeholder（`AUTHORITY_STATUS = NONE`）。
- 本 amendment 同时将 active parent authority 从已 superseded 的
  `MINIMAL_AUTH_FOUNDATION_V1` 对齐为 `MINIMAL_AUTH_FOUNDATION_V2`
  （frontmatter 与 §3.1）。
- 本 amendment 不改变 Shutdown Program 其他语义，不修改产品代码、
  SQL/Migration、schema、Contract Bundle 或测试。

## 13. Open questions

非 normative follow-up（均不能改变 Decision 或 Contract meaning）：

1. Agent Core in-place amendment 的完成时间与形式由
   `mayf3/dsh-agent-core` 自己的流程决定（外部依赖，
   `CTR-AUTH-SHUTDOWN-030`）；本 Spec 不设定其期限。
2. `AC-R14`（legacy alias）的 fixed-SHA E2E evidence 只能在 activation
   阶段产生；其可得性是 activation gate，不是本 Spec 的 open decision。
3. 各 implementation Child Spec 的 authoring 顺序细节由各自 PREFLIGHT
   决定，但 Child 序列本身已由 `DEC-AUTH-SHUTDOWN-015` 冻结。
4. planned credential-only Child
   `AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1` 的 authoring 时间表与
   形式由其自身 PREFLIGHT / AUTHOR 流程决定；本 Program 仅冻结其独立
   authority 要求与不可由 PR #15 或本 Program 吞并的边界（§3.5）。

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

## 14. Authorization state（non-normative summary）

本 Spec 提交后的状态：

```text
AUTH_SERVICE_READ_ONLY_RESOLUTION_CONTRACT =
  DEFINED_AT_SPEC_LEVEL

AUTH_SERVICE_SIDE_STATE_F_PREREQUISITE =
  RESOLVED_AT_SPEC_LEVEL

STATE_F_END_TO_END_IMPLEMENTABILITY =
  BLOCKED_BY_EXTERNAL_CALLER_ALIGNMENT

STATE_F_GATE_CLOSED = NO

PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
PARENT_AUTHORITY_STATUS = accepted
PARENT_PRODUCTION_EFFECTIVE = NO
CURRENT_MINIMAL_AUTH_CONTRACT_VERSION = 1.3.0

SPEC_STATUS = accepted
SPEC_MERGE_READY = NO
READY_TO_MARK_ACCEPTED = YES
IMPLEMENTATION_AUTHORIZED = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
INDEPENDENT_REVIEW_REQUIRED = YES
READY_FOR_INDEPENDENT_REVIEW = YES
MERGE_PERFORMED = NO
```

Spec 已完成 Owner acceptance；本 acceptance 不授权 implementation、
Agent Core change、deployment、production database write 或 merge。
每个 implementation Child 仍必须有独立 accepted、
`implementation_authority: contracts` 的 Child Spec。

## 15. Acceptance receipt（non-normative）

```text
ACCEPTED_BY = mayf3
ACCEPTED_AT = 2026-08-22T06:53:30Z
REVIEWED_BASE = f5c2305b46020ad907cf5c4a93c0cb8ffca5b95e
REVIEWED_HEAD = 407f1873ac4fcc2e3dc85f3cf5a5595e73af8d1d
REVIEW_COMMENT_ID = 5378424541
SEMANTIC_DELTA_AFTER_REVIEW = lifecycle-only
```
