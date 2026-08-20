---
spec_id: AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - auth-service
governed_by: []
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V1
    revision: 1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1

```text
SPEC_ID=AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1
SPEC_STATUS=proposed
BASE_HEAD=1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9 (main, mayf3/auth-service，含已 accepted 的 Agent Development Governance V0)
PREVIOUS_BASE_HEAD=84890120bd385b39287cb81890236b0e73e96c8d（原 authoring base）
PREVIOUS_SPEC_HEAD=bf723fbbed86e71f0f2996d1ae38e18d71458510（迁移前 PR #4 head，provenance anchor）
AUTHORED=2026-08-20
MIGRATED=2026-08-20（AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1_GOVERNANCE_REBASE：.agents/specs/ → docs/specs/；除路径/frontmatter/治理引用/base SHA 外语义零变化）
ROUND=GOVERNANCE_REBASE_SPEC_ONLY（governance/path/rebase 迁移轮；不实现、不部署、不 merge）
IMPLEMENTATION_AUTHORITY=none（frontmatter：本 Spec 的 acceptance 本身不授权产品代码）
IMPLEMENTATION_AUTHORIZED=NO（governing Spec 尚未 accepted；implementation 未授权）
INDEPENDENT_REVIEW_REQUIRED=YES（independent review 尚未开始；须在本迁移后的 exact head 上重新执行独立 semantic review，旧坐标材料不自动视为新坐标的评审或 acceptance）
POST_ACCEPTANCE_IMPLEMENTATION_SCOPE=src/lib/oauth/v1/direct.ts + tests/oauth/v1-direct.test.ts（见 §5 FILES_AUTHORIZED；仅在本 Spec 被 accept 并由 Owner 明确授权进入实现后才生效）
GOVERNANCE=Agent Development Governance V0（development-governance-v0；lock adoption.status=accepted，于 main@1da40d4 生效；docs/specs/ 为唯一 governing Spec 目录）
GOVERNING_AUTHORITY=docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md + docs/contracts/minimal-auth-v1/*（frozen V1 契约，本 Spec 不修改任何 frozen 契约文本）
```

## 1. 问题陈述

Agent Core 的 ownerless machine Agent（`principal_type=agent`、`agent_id=<agt_*>`、
`owner_user_id=NULL`）在 deployed mode `v1` 下无法通过 client-credentials 直接换取
machine token：`src/lib/oauth/v1/direct.ts:72-79` 的 `assertPrincipalProfile` 对 agent
Profile 要求 `agentId && ownerUserId`，ownerless Agent 在 **secret 验证之前**（断言位于
`direct.ts:104`，secret 验证位于 `direct.ts:105`）即得到
`401 invalid_client / agent_profile_invalid`。

该 owner 要求是 **运行时源码层的附加断言**，不是 frozen 契约的要求：
`docs/contracts/minimal-auth-v1/claims-and-profiles.md` 冻结的 Direct Machine Token
Profile 对 agent 只要求 `agent_id`（`claims-and-profiles.md:101,128,140`），任何 token
profile 均不包含、也不要求 `owner_user_id`。数据层与下游均已兼容 ownerless（见 §2）。
本 Spec 将 V1 direct 授权路径的 agent Profile 校正为与 frozen 契约一致：
owner 不再是必需字段。

## 2. 已核实的源码事实（SOURCE_FACTS）

以下事实全部针对 `PREVIOUS_BASE_HEAD=8489012` 逐条源码核实（在干净 linked worktree 上复核，
行号与原始起草 base `170736e4` 一致——两 base 之间仅有一个 docs 脱敏 commit，
未触及 src/tests/prisma/registry）。governance rebase 复核（8489012→1da40d4）：
两 base 之间仅新增治理采用文件（.agents/**、AGENTS.md、docs/specs/**），
src/tests/prisma/registry/docs/contracts/contract-bundles 零变化——
全部行号与事实在新 BASE_HEAD 下逐条保持成立：

- **F1（唯一阻塞点）** `src/lib/oauth/v1/direct.ts:72-79`：
  `assertPrincipalProfile` 对 `principalType==='agent'` 要求
  `!principal.agentId || !principal.ownerUserId → invalidClient('agent_profile_invalid')`
  （`V1OAuthError('invalid_client', …)`，401，`errors.ts:12-22`）。断言在
  `direct.ts:104` 执行，先于 `direct.ts:105` 的 `verifyClientSecret`。
  `agent_profile_invalid` 在 src 与 tests 中**仅此一处**出现。
- **F2（DB 已可空）** `prisma/schema.prisma:109`：`ownerUserId String? @map("owner_user_id") @db.Uuid`
  （`schema.prisma:118`：`owner User?`，`onDelete: Restrict`）。SCHEMA_CHANGE=NONE 有源码依据。
- **F3（malformed type 结构性不可能）** `prisma/schema.prisma:90-93`：
  `enum PrincipalType { agent, service }`；`direct.ts:15` 的 TS 类型
  `'agent' | 'service'` 与之镜像。DB 枚举 + TS 联合类型共同排除 malformed
  principal type，无需新增运行时检查，且实现不得放宽该类型。
- **F4（S1/S2 创建与 requestDigest 已兼容 ownerless）**
  `src/lib/oauth/v1/idempotent.ts:279`：
  `effectiveOwnerUserId = effectiveType === 'agent' ? (ownerUserId ?? null) : null`
  —— 幂等创建允许 `owner_user_id=NULL`；
  `idempotent.ts:92-97`：`computePrincipalDigest` 仅在 `ownerUserId != null` 时
  拼入 `ownerUserId=` 分量 —— requestDigest 对缺失 owner 稳定。
- **F5（audience registry 已接受 agent Profile）**
  已提交的 frozen registry `contract-bundles/minimal-auth-v1/audience-registry.json`
  （`status=frozen`）：`svc-forum` accepted `['agent']`、machine=true、delegated=false；
  `svc-workflow` accepted `['agent']`、machine=true、delegated=true。digest 验证的
  运行时快照（`generated/minimal-auth-v1/runtime-contract.json`，contractVersion
  `1.2.0`，经 `contract.ts:94-112` 验证；构建产物，gitignored）载有相同值。
  `direct.ts:108-110` 的 audience Profile 检查只看 `principalType`，与 ownerUserId 无关。
- **F6（deployed mode 接线）** `src/config/env.ts:13-22`（`AUTH_CONTRACT_MODE ∈
  {v0, v1_shadow, v1}`）→ `src/server.ts:22-23` → `src/routes/oauth.ts:134-146`：
  mode `v1` 下 client-credentials 路径调用 `issueV1DirectToken`。
- **F7（token claims 无 owner 接线需求）**
  `src/lib/oauth/v1/signer.ts:47-62`：`V1DirectMachineTokenClaims` 不含任何 owner
  claim（字段全集：iss/sub/aud/principal_type/client_id/token_use/type/version/scope/
  agent_id?/jti/iat/nbf/exp）。signer 仅要求 agent 的 `agentId` 非空
  （`signer.ts:123-125`），不读 ownerUserId；verifier 的 closed allowlist
  （`signer.ts:278-284`）会拒绝任何未列 claim —— **若给 token 添加
  `owner_user_id` 反而会破坏验证**。故 token 侧零改动。
- **F8（相邻面：OBO exchange 仍要求 owner，本 Spec 不动）**
  `src/lib/oauth/v1/exchange.ts:252-259`：workflow OBO delegated exchange 要求
  `originalClient.principal.ownerUserId` 非空（`:257`）—— ownerless Agent 仍不能做
  OBO exchange，维持现状（见 §7 出界说明）。
- **F9（legacy v0 不动）** `src/lib/oauth/service.ts:37`：v0 legacy 路径对 agent 要求
  owner —— deployed mode `v1` 下不可达，本 Spec 不修改（Legacy hard-cut 保持原样）。
- **F10（下游零依赖）** svc-workflow（Rust）`src/auth/jwks_verifier.rs:268,364` 只校验
  `principal_type == "agent"`，claims 结构体（`src/auth/claims.rs:31,74`）无 owner
  字段；svc-forum 源码 grep `owner_user_id|ownerUserId` 零命中。ownerful 与
  ownerless agent 的 direct token 在 wire 上形状完全相同，下游验证路径无需任何修改。
- **F11（测试文件）** `tests/oauth/v1-direct.test.ts`：in-memory DB 工厂
  （`v1-direct.test.ts:13-49`），现有 fixture 为 ownerful agent（line 25）。
  现存测试**没有**任何 `agent_profile_invalid` 断言（缺陷因此未被测试网捕获）。
- **F12（primary worktree 先存本地改动，与本 Spec 交付隔离）** primary worktree
  （非本 Spec 的干净 linked worktree）在 main 之上有两处**先于本 Spec** 的未提交
  本地改动：`contract-bundles/minimal-auth-v1/audience-registry.json`（纯 JSON 数组
  格式化，语义零变化）与 `src/cli/machine-admin.ts`（+4 行）。二者均属本 Spec 禁改
  清单，**不在本 Spec 的 commit 内**；实现轮必须基于 `BASE_HEAD` 干净检出作业，
  不得把这两处本地改动卷入实现 commit（若无法保证，回报 OWNER）。

## 3. 冻结的 Profile 规则（FROZEN_PROFILE）

```text
AGENT_PRINCIPAL_HUMAN_OWNER_REQUIRED = NO

V1_AGENT_PROFILE_REQUIRED_FIELDS:
  principal_type = 'agent'
  agent_id       = non-empty（非 null、非空串）

V1_AGENT_PROFILE_OWNER_USER_ID = OPTIONAL_NULL
```

- `owner_user_id=NULL` 的 agent Profile **不得**再产生 `agent_profile_invalid`。
- `ownerUserId` 的值（null 或任意 UUID）对 v1 direct 授权决策**完全无关**。
- 以下拒绝路径全部维持现状、不得放宽：
  - agent 缺 `agent_id`（null 或空）→ `401 invalid_client / agent_profile_invalid`；
  - service 携带 `agent_id ≠ null` → `401 invalid_client / service_profile_invalid`；
  - malformed principal type → 由 DB 枚举 + TS 联合类型结构性排除（F3），
    实现不得把 `DirectPrincipal.principalType` 放宽为开放字符串类型；
  - inactive client/principal → `401 invalid_client / client_or_principal_inactive`
    （`direct.ts:101-103`，先于 Profile 断言，次序不变）；
  - invalid secret → `401 invalid_client / credential_invalid`（`direct.ts:105-107`）；
  - unauthorized audience/scope → `invalid_target / audience_not_machine_enabled`、
    `invalid_target / audience_profile_not_accepted`、`invalid_scope /
    machine_grant_missing`、`invalid_scope / requested_scope_not_granted`
    （`direct.ts:85-125`，全部不变）。
- 断言位置（`direct.ts:104`，先于 secret 验证）**不变**；本 Spec 只移除 owner
  条件，使 ownerless 不再提前触雷 —— 对仍非法的 Profile（agent 缺 agent_id、
  service 带 agent_id）行为与错误次序保持原样。

## 4. Token claims 规则（TOKEN_CLAIM_RULE）

`owner_user_id=NULL` 时铸造的 direct token：

```text
TOKEN_OWNER_CLAIM_CANONICAL_FORM = ABSENT
```

- `owner_user_id` 在 V1 Direct Machine Token 中**规范形式为缺席**（claim 键不存在），
  不是 `null`、不是空串、更不是伪造值。依据 F7：现有 claims schema 无 owner 字段、
  verifier closed allowlist 禁止新增 claim —— 这就是"按现有 schema 选择唯一规范"的答案。
- `agent_id` 必须保留（agent Profile 必填、非空，`signer.ts:123-125,140`）。
- `principal_type='agent'` 必须保留。
- 不伪造 owner、不绑定 designated admin、不为 Agent 创建任何 User：
  ```text
  FAKE_ADMIN_OWNER_FORBIDDEN = YES
  DESIGNATED_ADMIN_OWNER_FALLBACK = NO
  NEW_USER_CREATED_FOR_AGENT = NO
  ```
- 下游 audience/profile/scope 规则不变；ownerful 与 ownerless agent token 的
  claims 形状逐键相同（owner 从不在 token 中）。

## 5. 精确文件授权（FILES_AUTHORIZED）

```text
FILES_AUTHORIZED:
  1. src/lib/oauth/v1/direct.ts
  2. tests/oauth/v1-direct.test.ts
FILES_AUTHORIZED_COUNT = 2
ADDITIONAL_CLAIM_SCHEMA_WIRING_FILES = NONE（F7 已证明无接线需求）
SCHEMA_CHANGE = NONE（F2/F4 已证明 schema 与创建链路兼容 ownerless）
```

- `src/lib/oauth/v1/direct.ts`：唯一产品改动 =
  `assertPrincipalProfile` 的 agent 分支移除 `|| !principal.ownerUserId` 条件。
  `DirectPrincipal.ownerUserId` 字段本身保留（镜像 DB include 形状）；
  `V1DirectAuthorization` 不新增 ownerUserId 字段；audit log（`direct.ts:144-156`）
  不新增 owner 字段 —— AUDIT_LOG_CHANGE=NONE。
- `tests/oauth/v1-direct.test.ts`：按 §6 增补 ownerless 用例；既有用例不删不改
  （ownerful fixture line 25 继续作为 AC2 的回归基线）。

**禁改清单**（实现轮同样适用）：S1/S2 幂等创建语义（`idempotent.ts`）、service
profile 语义、audience registry（`contract-bundles/` 与 `generated/`）、
MachineAccessGrant、JWKS、token issuer 算法（RS256）、Human OAuth
（`human-*.ts`）、Legacy hard-cut（`service.ts` v0 路径）、State F resolution
endpoint、lifecycle CLI（`src/cli/machine-admin.ts`）、token-exchange / OBO
（`exchange.ts`、`token-exchange*.ts`）、路由层（`routes/oauth.ts`）、
Prisma schema 与 migrations。任何越界 = 停止并回报 OWNER，不得自行扩大。

## 6. Acceptance Criteria（ACCEPTANCE_CRITERIA）

全部落在 `tests/oauth/v1-direct.test.ts`（in-memory DB 工厂模式，沿用现有
`database()` 构造），审计口径与 `direct.ts` 的 `V1OAuthError`（code/category/status）
对齐：

- **AC1 ownerless 放行**：ownerless active agent（`ownerUserId: null`）+ 有效
  client secret + 该 audience 有效 MachineAccessGrant → `authorizeV1DirectToken`
  成功；`issueV1DirectToken` 返回 RS256 token（路由层语义 = 200）。至少覆盖
  `svc-workflow`，鼓励同型用例覆盖 `svc-forum`。
- **AC2 ownerful 回归**：ownerful agent（现有 fixture）仍可成功授权/铸造 ——
  现存用例 `v1-direct.test.ts:58-68` 原样通过。
- **AC3 agent 缺 agent_id**：`principalType='agent'` 且 `agentId` 为 null/空
  （owner 有无均测）→ `401 invalid_client / agent_profile_invalid`。
- **AC4 service 带 agent_id**：`principalType='service'` 且 `agentId ≠ null` →
  `401 invalid_client / service_profile_invalid`。
- **AC5 secret 校验不再被遮蔽**：ownerless + **无效** secret →
  `401 invalid_client / credential_invalid`（而非 `agent_profile_invalid`），
  证明 Profile 门不再提前遮蔽 secret validation。
- **AC6 已过 Profile 与 secret 的证据**：ownerless + 有效 secret + **缺 grant**
  （`accessGrants: []`）→ `400 invalid_scope / machine_grant_missing` ——
  该错误只在 Profile 与 secret 均通过后可达（`direct.ts:111-112`）。
- **AC7 token claims**：解出 AC1 的 token（或直接断言 `signV1DirectMachineToken`
  产物 / 经 `verifyV1DirectMachineToken` 验证）：`principal_type='agent'`、
  `agent_id` 精确等于 principal 的 agentId、`sub`=principal UUID、scope/aud 正确、
  且 **`owner_user_id` 键缺席**（严格断言 `'owner_user_id' in claims === false`，
  同时断言无任何伪造 owner 形态）；token 可被 `verifyV1DirectMachineToken`
  在对应 audience 下验证通过。
- **AC8 下游不变**：svc-forum / svc-workflow 契约零修改（F10 静态事实为证：
  下游不读 owner；ownerful/ownerless token wire 形状逐键相同）；仓库现存
  conformance / provider / signer / exchange 测试全部原样通过。

## 7. 出界与 OWNER_DECISION 项

1. **OBO exchange**（`exchange.ts:257` 要求 owner）不在本轮范围。ownerless Agent
   若未来需要 workflow OBO，须另立 Spec（预判其 delegated 语义需要独立设计，
   不得搭车）。
2. **legacy v0**（`service.ts:37`）与 **v1_shadow 对比评估**（`routes/oauth.ts:322`）
   均不动；v1_shadow 下的 shadow 结论会自然继承本修正（其调用同一
   `authorizeV1DirectToken`），无额外动作。
3. **F12 的 primary worktree 先存未提交本地改动**：实现轮必须从 `BASE_HEAD`
   干净检出作业，不得将其卷入实现 commit；若无法保证，回报 OWNER。
4. 若实现中发现本 Spec 未覆盖的 owner 依赖（预期不存在 —— `agent_profile_invalid`
   全库唯一出现于 `direct.ts:74`），停止并回报，不自行扩大。

## 8. 交付边界

```text
PRODUCT_CODE_CHANGE = NONE（本文件为唯一交付物）
DEPENDENCY_CHANGE = NONE
SCHEMA_CHANGE = NONE
PRODUCTION_DEPLOYMENT = NONE
MERGE_PERFORMED = NO
IMPLEMENTATION_AUTHORIZED = NO（governing Spec 尚未 accepted、implementation 未授权；implementation_authority=none——accepted 后实现范围才可能是 §5 FILES_AUTHORIZED 的 direct.ts + v1-direct.test.ts，进入实现前须由 Owner 明确授权）
READY_FOR_INDEPENDENT_REVIEW = YES
```
