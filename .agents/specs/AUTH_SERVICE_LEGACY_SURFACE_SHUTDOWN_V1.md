# AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1

```text
SPEC_ID = AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1
SPEC_STATUS = CANDIDATE_REQUEST_CHANGES_ADDRESSED
SPEC_MERGE_READY = NO
IMPLEMENTATION_AUTHORIZED = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
INDEPENDENT_REVIEW_REQUIRED = YES
OWNER_DECISIONS_FROZEN = YES
AUDIT_BASE_SHA = 84890120bd385b39287cb81890236b0e73e96c8d
DATE = 2026-08-18
```

本次修订接受并冻结 Spec Review 提出的五项边界，但不自行宣布 Review 通过。只有独立 Review 明确返回 `PASS`，并将本 Spec 的状态转为 accepted 后，才允许合并和启动 Implementation Child。

## 1. North Star

`auth-service` 必须成为单一、严格、可验证的 Minimal Auth V1 身份、Credential 与 Token Authority。

完成本计划后，运行时不得再存在第二套 Legacy 身份面、Legacy Token Profile、共享 HS256 兼容验签、Legacy Refresh Session、中心化通用验签 Oracle、Legacy flat-field authority，或通过开关重新启用这些能力的路径。

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
→ no auth-service introspection or live status lookup
```

## 2. Authority and Review State

本 Spec 的 authority 顺序为：

1. 本 Spec 中已冻结的 Owner 决策。
2. 本 Spec 中新增的 State-check、Lifecycle、Backfill Cutoff、Authority Reconciliation 与 Human Credential Lifecycle 决策。
3. `contract-bundles/minimal-auth-v1/` 中 frozen、implementation-authorized 的 1.2.0 机器合同。
4. Prisma 中 V1 authority tables 的约束。
5. accepted Child Spec。
6. 现有 V1 实现与测试只能作为现状证据，不能覆盖前述 authority。
7. Legacy 文档、Legacy 路由、Legacy 字段、Legacy 脚本和历史审计报告只能作为迁移证据。

当前状态固定为：

```text
SPEC_MERGE_READY = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
```

本次修订不得被解释为自审通过。

## 3. Current Runtime Truth

当前 `main` 同时存在两套鉴权面。

### 3.1 V1 面

- Frozen Minimal Auth V1 Contract Bundle 1.2.0。
- RS256 + `kid`。
- JWKS。
- V1 Human Authorization Code + PKCE。
- V1 opaque Refresh Credential、Session、Family 与 reuse detection。
- V1 Direct Machine Token。
- V1 Trusted Proxy / OBO。
- Per-audience `MachineAccessGrant`。
- `/api/v1/principals` 与 `/api/v1/clients` 的 V1 management authentication。

### 3.2 Legacy 面

- `/api/auth/*` 直接登录、注册、Agent Token Login、JWT Refresh。
- HS256 Access/Refresh Token。
- `authRequired` 中无 exact issuer/audience/profile 的 shared-secret-only fallback。
- 进程内 Refresh Token revocation `Map`。
- `/api/users/*` 和 `/api/roles/*` 人员目录及角色修改接口。
- `/api/services/*` Legacy SSO Gateway、Service Registration 与通用 `verify-token`。
- V0 `allowedResources[] + allowedScopes[]` 平面授权。
- V0 Token Exchange，不要求正式 TrustedProxy profile。
- `AUTH_CONTRACT_MODE=v0|v1_shadow|v1` 双栈开关。
- Legacy flat-field backfill、repair 与 cleanup mutator。

只要 Legacy 面仍可达或仍可写入 V1 authority，V1 就不是整个服务的真实边界。

## 4. Frozen Owner Decisions

以下三项 Owner 决策已经接受，不得重新打开。

### D1. Legacy 直接硬切

```text
LEGACY_MIGRATION_WINDOW = NONE
LEGACY_RUNTIME_ALLOWLIST = NONE
LEGACY_COMPATIBILITY_FLAG = NONE
LEGACY_NEW_CONSUMER = FORBIDDEN
```

不保留按 Consumer、IP、Header、环境变量、路径或 Token Claim 开启 Legacy 的例外。

Consumer readiness 是生产部署 Gate，但不得成为在 Cut Artifact 中继续携带 Legacy 运行时代码的理由。

### D2. 删除 `token-login`

```text
POST /api/auth/token-login = REMOVE
REPLACEMENT_BOOTSTRAP_ENDPOINT = NONE
AGENT_AS_USER_SESSION = FORBIDDEN
AGENT_REFRESH_TOKEN = FORBIDDEN
```

Agent 的正式身份只有：

```text
MachinePrincipal + MachineClient + MachineAccessGrant
```

### D3. 删除通用 `verify-token`

```text
POST /api/services/verify-token = REMOVE
CENTRAL_GENERIC_TOKEN_ORACLE = NONE
TOKEN_INTROSPECTION_ENDPOINT = NONE
LIVE_STATUS_LOOKUP_ENDPOINT = NONE
```

每个外部 Resource Consumer 必须使用 JWKS 本地验证 Token，并严格绑定自己的 audience、profile 和 scope。

### D4. Minimal Auth V1 是唯一目标架构

不重新设计 V1，不引入新的 Policy Engine、Sidecar、mTLS、TPM、Kernel Keyring 或新的 Token Broker。

### D5. Hard cut 指运行时 authority

首个实现 Child 必须删除 Legacy 路由、签发、验签、Refresh、flat-field backfill apply 和权限 authority。

以下数据库结构可暂时作为 dead data 保留，以维持 whole-release rollback：

- `service_registrations`
- `MachineClient.allowedResources`
- `MachineClient.allowedScopes`
- Legacy role/profile 字段
- Legacy 审计记录

保留字段不得参与任何认证、签发、Refresh、Exchange、Management 或 readiness-derived authority。物理删除由 `AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1` 管理。

## 5. Frozen State-check Boundary

### 5.1 auth-service 必须执行 live status check 的位置

`auth-service` 在以下边界读取当前数据库状态并 fail closed：

| Boundary | Required live state |
|---|---|
| Human authentication | `User.status=active`、`HumanClient.status=active`、Redirect URI 与 HumanAudienceGrant 当前有效 |
| Authorization Code exchange | User、HumanClient、AuthorizationTransaction、AuthorizationCode、Audience Grant 当前有效且未消费 |
| Human refresh | User、HumanClient、HumanSession、RefreshFamily、RefreshCredential 与 target HumanAudienceGrant 当前有效 |
| Direct machine issuance | MachinePrincipal、MachineClient、AuthAudience、MachineAccessGrant 当前有效且彼此绑定 |
| Token exchange | Proxy Principal/Client、TrustedProxy、original Principal/Client、source Audience、target Audience、original Grant、Delegation Grant 当前有效 |
| auth-service online management | actor MachinePrincipal/Client 当前有效；target Principal/Client 的当前状态与 optimistic version 满足操作前置条件 |
| operator-only lifecycle seam | target Principal/Client 当前有效或已进入允许的幂等终态；操作写入持久审计事实 |

状态检查失败不得回退 Legacy，不得通过请求体 caller identity 绕过，不得仅依赖 Token 中的历史状态。

### 5.2 外部 Resource Consumer 固定为 offline-JWKS-only

外部 Resource Consumer 只执行：

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

外部 Consumer 不得：

- 调用 auth-service introspection。
- 调用 auth-service 查询 User、Principal、Client、Session、Family 或 Proxy live status。
- 在每次资源请求中访问 auth-service 数据库。
- 把 auth-service lifecycle CLI 暴露为网络 API。
- 因无法查询 live status 而尝试 Legacy `verify-token`。

### 5.3 Access Token 的撤销语义

```text
ACCESS_TOKEN_REVOCATION_MODEL = NON_REVOCABLE_UNTIL_EXP
```

V1 Access Token 一经成功签发，在签名、Claims 与时间窗口有效的前提下，外部 Consumer 接受至 `exp`。

Principal、Client、User、Session 或 Proxy 在 Token 签发后被 disable/revoke，不追溯撤销已签发的 Access Token；这些状态变化立即阻止后续 authentication、issuance、refresh、exchange 与 auth-service management operation。

该模型的风险上界由 frozen Access Token TTL 控制。不得新增：

- Token blacklist。
- JTI introspection。
- per-request live status lookup。
- backchannel revocation endpoint。

签名私钥泄露属于 Incident Response，通过 Key Rotation、Consumer key trust update 和 whole-release response 处理，不转化为日常 introspection 体系。

## 6. Explicit Non-Goals

本 Spec 不做：

- 不拆分 ADC 与 auth-service 的数据库。
- 不修改 Forum、Workflow、OKR 的业务权限语义。
- 不新增在线 Grant Management API。
- 不恢复公开注册。
- 不设计新的 Agent credential bootstrap protocol。
- 不提供 Token introspection 或 live status API。
- 不为 Legacy Refresh 新建 Redis 或数据库补丁体系。
- 不立即删除生产数据库中的旧表、旧列或历史记录。
- 不把 User role 写入 V1 Access Token。
- 不使 Access Token 在 `exp` 前具备逐 Token 撤销能力。

## 7. Target Runtime Surface

### 7.1 保留的公开运行时接口

| Method | Path | Frozen semantics |
|---|---|---|
| GET | `/api/health` | 报告服务与当前 V1 runtime identity；不得宣称 production-effective |
| GET | `/.well-known/jwks.json` | 发布 active + retained previous public verification keys |
| GET | `/oauth/authorize` | V1 Human Authorization Code initiation；PKCE S256 required |
| POST | `/oauth/authorize/authenticate` | V1 Human authentication and authorization-code issuance |
| POST | `/oauth/token` | 仅支持 V1 `authorization_code`、`refresh_token`、`client_credentials`、RFC 8693 token exchange |
| POST | `/oauth/logout` | 撤销 V1 Human Session / Refresh Family；不撤销已签发 Access Token |
| POST | `/api/v1/principals` | V1 idempotent MachinePrincipal provisioning；`svc-auth` service token required |
| POST | `/api/v1/clients` | V1 idempotent MachineClient provisioning；`svc-auth` service token required |

### 7.2 必须删除的公开接口

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

删除后由缺失路由产生 `404`。不得返回兼容提示、迁移 Token、Redirect 或 Legacy proxy response。

## 8. Operator-only V1 Machine Lifecycle Seam

### 8.1 Seam 形态

Legacy `machine-admin` CLI 与 `src/lib/oauth/service.ts` 全部删除，替换为：

```text
src/cli/v1-machine-lifecycle.ts
src/lib/oauth/v1/lifecycle.ts
```

该 seam 是可信 Operator 在 auth-service host 上执行的离线 CLI，不注册 HTTP Route，不提供 SDK 网络入口，不由 Agent 或 Resource Consumer 调用。

### 8.2 唯一允许的操作

CLI 命令集合固定为：

```text
principal inspect --principal-id <uuid>
principal disable --principal-id <uuid> --reason <text> --expected-version <int>
client inspect --client-id <public-client-id>
client rotate-secret --client-id <public-client-id> --reason <text> --expected-version <int>
client revoke --client-id <public-client-id> --reason <text> --expected-version <int>
```

语义冻结如下：

- `inspect` 只返回非秘密 V1 identity、status、version、timestamps 与 Audience-scoped Grant 摘要。
- `rotate-secret` 只对 active Client 执行，使用密码学安全随机数与 V1 secret verifier；新 Secret 仅输出一次。
- `client revoke` 立即阻止后续 issuance、exchange 和 management；已签发 Access Token 仍有效至 `exp`。
- `principal disable` 立即阻止其所有 Client 的后续 issuance、exchange 和 management；已签发 Access Token 仍有效至 `exp`。
- `revoke` 与 `disable` 对相同终态幂等。
- Mutating operation 必须校验 `expected-version`，避免 lost update。
- Mutating operation 必须写入持久、可关联 Operator、target、reason、before/after status、timestamp 与 operation id 的审计事实。

### 8.3 明确禁止

`src/lib/oauth/v1/lifecycle.ts` 与 CLI：

- 不读取 `allowedResources`。
- 不读取 `allowedScopes`。
- 不写入 `allowedResources`。
- 不写入 `allowedScopes`。
- 不创建、替换或删除 MachineAccessGrant。
- 不创建 Principal 或 Client；创建仍由受保护的 idempotent V1 management seam 完成。
- 不导出 `issueToken`、Signer、Verifier、Exchange 或任何 Token issuance function。
- 不接受 Access Token 作为 Operator authentication 方案。
- 不暴露 Secret Hash、历史 Secret 或 Access Token。

Grant 变更继续遵守 frozen Contract：versioned database migration only。

## 9. Legacy Backfill Cutoff

### 9.1 Authority cutoff

```text
FLAT_FIELD_TO_V1_GRANT_MIGRATION = PRE_CUT_ONLY
POST_CUT_BACKFILL_APPLY = FORBIDDEN
POST_CUT_LEGACY_FLAT_FIELD_REPAIR = FORBIDDEN
READINESS_WRITE_AUTHORITY = NONE
```

所有从 `MachineClient.allowedResources` / `allowedScopes` 推导 `AuthAudience` 或 `MachineAccessGrant` 的写操作，必须在 Cut Artifact 部署前完成并形成独立证据。

### 9.2 Cut Artifact 中的固定处置

- 删除 `scripts/backfill-minimal-auth-v1.ts`。
- 删除 root `package.json` 的 `contract:v1:backfill` script。
- 删除 `scripts/repair-legacy-client-drift.ts`。
- 删除 `scripts/cleanup-evidence-repair.ts`。
- 删除 `scripts/cleanup-legacy-revoked-clients-round-1.ts`。
- 删除 `src/lib/oauth/v1/grant-migration.ts` 中的 flat-field migration planner。
- 将仍被 V1 runtime 使用的 Audience comparison types/functions移动到 `src/lib/oauth/v1/audience-state.ts`；该模块不得包含 Legacy flat fields、migration plan 或 write path。

### 9.3 Readiness 的只读边界

`scripts/check-minimal-auth-v1-readiness.ts` 保留为 read-only evidence tool，并固定为：

- 可读取 Legacy flat fields，用于证明它们已不再承载未迁移 authority。
- 可读取 V1 tables 与 frozen registry，比较当前 V1 数据状态。
- 不调用 migration planner。
- 不从 Legacy fields 推导应创建的 V1 Grant。
- 不创建、更新或删除 Audience、Grant、Principal、Client、Proxy 或 Human authority。
- 不提供 `--apply`、`--repair`、`--fix` 或等价写模式。
- 发现 V1 Grant 缺失或不一致时只返回失败证据和稳定错误分类。

Cut Artifact 的 build/test gate 必须证明 readiness tool 的 Prisma capability 不包含 write method。

## 10. Authority Reconciliation

### 10.1 `v0-to-v1-migration.md` 中被本 Spec supersede 的条款

以下 source-sequencing 条款被本 Spec 明确 supersede：

| Source clause | Superseded meaning | Replacement in this Spec |
|---|---|---|
| `docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` §7 Phase 3：`不静默删除 Legacy` | Cut Artifact 继续携带 Legacy runtime | Cut Artifact 直接删除 Legacy runtime；删除动作由 accepted Spec、Consumer Gate 与 Release Gate 显式授权 |
| 同文 §8：迁移窗口可存在受控双协议 | 在单个 Runtime Artifact 中保留 V0/V1 mode | 不存在双协议 Artifact、mode switch 或 per-request fallback |
| 同文 §8：每种模式独立遥测并设置截止日期 | 以运行时 mode 维持兼容窗口 | Consumer 与 Legacy traffic 证据全部在 PRE_CUT 完成；Cut Artifact 无 Legacy mode |
| 同文 §7 Phase 5：Legacy 流量为零后再删除 | 必须在携带 Legacy 代码的新 Artifact 中观察零流量 | 在部署 Cut Artifact 前，以旧 Artifact telemetry、Consumer inventory 与 fixed SHA evidence 证明零 Legacy 依赖 |
| 同文 §6 中与当前 1.2.0 Consumer Matrix 不一致的首批范围和 Legacy 分类 | 历史 inventory 继续作为当前 authority | 当前 `contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json` 与 Production Activation Child 的 fixed-SHA evidence 为 authority |

以下条款不被 supersede：

- V1 在 Production Activation gates 全部通过前不生产生效。
- 不得仅因文档合并、单测通过或局部代码完成就宣布 V1 effective。
- 不新增 V0 Consumer。
- 已冻结的 Wire claims compatibility 决定继续有效。
- 不允许 per-request algorithm、audience 或 profile fallback。
- 全部门禁通过前，V0 仍是当前生产部署的 governing contract。

### 10.2 Production lifecycle seam

Shutdown Spec、V1-only Runtime Child、Consumer Migration PR 均不得设置：

```text
auth_token_contract_v1_production_effective = true
v0_compatibility.supersedes_v0 = true
production_deployment.status = effective
consumer_migration.status = complete
```

只有 `AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1` 在所有 Gate 通过、独立 Review PASS 后，才可在单独提交中更新这些字段并部署 Cut Artifact。

### 10.3 Authoritative 1.2.0 source and snapshot pin

本计划冻结以下 exact Git content object：

```text
AUTHORITATIVE_CONTRACT_VERSION = 1.2.0
AUTHORITATIVE_BASE_COMMIT = 84890120bd385b39287cb81890236b0e73e96c8d
AUTHORITATIVE_FREEZE_TRANSITION_COMMIT = 5f401d619e2a236d7ff2ee3cd9a7e7eac84e4656
AUTHORITATIVE_REVIEWED_SOURCE_COMMIT = 02bccd428554868125a65800f1334928c80543a2
AUTHORITATIVE_CONTRACT_BUNDLE_TREE_SHA1 = 796a8b670f8617ab5f45c7b8734e124e07934f09
AUTHORITATIVE_CONTRACT_MANIFEST_BLOB_SHA1 = 8557b36de241e39570f478e21a95ff375d11759a
AUTHORITATIVE_AUDIENCE_REGISTRY_BLOB_SHA1 = 8ddf67afc2494dddc3c087d19f2f93c71db13d70
AUTHORITATIVE_SNAPSHOT_GENERATOR_BLOB_SHA1 = eeaee471141a0667e119779d04f87663aec8a6dd
FREEZE_RECEIPT_DIGEST_PREFIX = 3aecaa03
```

Runtime snapshot 唯一允许的构造规则为：

```text
payload = {
  formatVersion: 1,
  contractVersion: "1.2.0",
  reviewedSourceGitCommit: AUTHORITATIVE_REVIEWED_SOURCE_COMMIT,
  sourceBundleDigest: SHA256(path + NUL + bytes + NUL for the exact pinned bundle tree),
  manifest: exact AUTHORITATIVE_CONTRACT_MANIFEST_BLOB_SHA1 bytes,
  audienceRegistry: exact AUTHORITATIVE_AUDIENCE_REGISTRY_BLOB_SHA1 bytes
}

runtimeDigest = SHA256(JSON.stringify(payload))
```

当前仓库不跟踪 `generated/minimal-auth-v1/runtime-contract.json`，且 `packages/machine-token-provider/tests/bundle-digest.test.ts` 仍固定旧的 1.1.0 full digest。不得捏造一个 1.2.0 full SHA-256。

因此独立 Acceptance Review 必须在 exact pinned object 上运行两次 `scripts/prepare-minimal-auth-v1.mjs`，证明两次生成的完整 64-hex `sourceBundleDigest` 与 `runtimeDigest` 完全一致，并在 Review Receipt 中记录它们。Production Activation Child 必须把同一对完整 digest 固定到可审计的 release manifest；任何不一致均阻止 activation。

```text
RUNTIME_SNAPSHOT_SOURCE_OBJECT_PINNED = YES
FULL_RUNTIME_SHA256_IN_REPOSITORY = NO
FULL_RUNTIME_SHA256_IN_INDEPENDENT_REVIEW_RECEIPT = REQUIRED
```

## 11. Human Credential Lifecycle

### 11.1 Public registration remains removed

`POST /api/auth/register` 永久删除。本计划不提供公开注册、邀请码注册、自助 User creation 或匿名 password reset。

### 11.2 Required Child

生产激活前必须存在 accepted、implemented、independently-reviewed：

```text
AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1
```

该 Child 必须冻结并实现：

1. **Audited User Creation**
   - 仅可信 Operator 或明确授权的内部管理身份可执行。
   - Email canonicalization 与唯一性规则明确。
   - 初始密码/credential 不记录到日志或审计详情。
   - 创建事实持久审计。

2. **Audited Password Reset**
   - 不依赖旧密码。
   - 新密码 verifier 按 accepted policy 生成。
   - 同一事务或可证明的原子流程中撤销该 User 的全部 active HumanSession、RefreshFamily 与 RefreshCredential。
   - 已签发 Access Token 仍按本 Spec 的 `exp` 语义存续。
   - Reset 事实持久审计。

3. **Audited User Disable**
   - 设置 `User.status=disabled` 与 `disabledAt`。
   - 撤销全部 active HumanSession、RefreshFamily 与 RefreshCredential。
   - 阻止后续 authentication、authorization code exchange 与 refresh。
   - 已签发 Access Token 仍按本 Spec的 `exp` 语义存续。
   - Disable 事实持久审计。

### 11.3 Activation gate

```text
GATE_V1_HUMAN_CREDENTIAL_LIFECYCLE_ACCEPTED = REQUIRED
GATE_V1_HUMAN_CREDENTIAL_LIFECYCLE_IMPLEMENTED = REQUIRED
GATE_V1_HUMAN_CREDENTIAL_LIFECYCLE_AUDIT_PASS = REQUIRED
```

在该 Child 通过前，不得把 V1 生产状态改为 effective，也不得部署 Cut Artifact。

Legacy `/api/auth/change-password` 继续删除；任何 User self-service password change 必须由后续 accepted Spec 单独授权。

## 12. Token Acceptance and Consumer Contract

### 12.1 Accepted profiles

| Profile | Algorithm | Required binding at issuance/auth-service operation |
|---|---|---|
| V1 Human Access | RS256 | exact issuer/audience、active User/HumanClient、valid Human grant/session flow |
| V1 Direct Agent | RS256 | active Agent Principal/Client、per-audience MachineAccessGrant、exact scope |
| V1 Direct Service | RS256 | active Service Principal/Client、no `agent_id`、per-audience MachineAccessGrant |
| V1 Delegated | RS256 | active original Agent、active TrustedProxy Service、accepted source、original grant ∩ delegation grant |
| V1 opaque Refresh Credential | opaque | active credential/session/family/user/client、serializable rotation/reuse detection |

### 12.2 Rejected unconditionally

- Any HS256 Access Token。
- Any HS256 Refresh Token。
- Any Token accepted only because it shares `JWT_SECRET`。
- Any Legacy ADC issuer Token。
- Any Token without exact audience。
- Any Token whose expected audience comes from arbitrary request-body input。
- Any Token missing a known `kid`。
- Any Token using `alg=none` or algorithm other than RS256。
- Any Legacy Agent Token Login credential。
- Any Token carrying forbidden claims for its profile。
- Any scope authorized through `allowedResources` / `allowedScopes`。

### 12.3 External Consumer obligations

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

Consumer-local业务授权可以进一步拒绝请求，但不得把 auth-service live status lookup 作为 Token 验证步骤。

## 13. Runtime and Configuration Authority

### 13.1 V1 unconditional runtime

`AUTH_CONTRACT_MODE` 从运行时设计中删除。Cut Artifact 不存在：

```text
v0
v1_shadow
legacy fallback
legacy route mounting
```

启动流程固定为：

1. 从 exact pinned 1.2.0 Contract Bundle 生成 runtime snapshot。
2. 校验 source object、runtime digest、contract version、freeze status 与 implementation authorization。
3. 校验 exact issuer。
4. 加载且验证 active RS256 private key、`kid` 与 retained previous public keys。
5. 任一条件不满足则启动失败。

### 13.2 Legacy environment variables lose authority

以下变量删除或在启动时被固定拒绝，不得改变运行时行为：

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `JWT_AUDIENCE`
- `AGENT_TOKEN_SECRET`
- `JWT_SECRET_SSO`
- `SSO_JWT_SECRET`
- `REGISTER_INVITE_CODE`
- `AUTH_CONTRACT_MODE`

保留：

- `DATABASE_URL`
- `PORT`
- RS256 active private key configuration
- `JWT_KID`
- retained previous public verification keys
- CORS 与 rate-limit 运行配置

Contract Bundle 是 issuer、profile、TTL、scope grammar 与 Audience registry 的唯一 authority。

## 14. Data Authority

### 14.1 Human V1 authority

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

### 14.2 Machine V1 authority

- `MachinePrincipal`
- `MachineClient` identity/status/secret verifier fields
- `AuthAudience`
- `MachineAccessGrant`
- `TrustedProxy`
- `ProxyAcceptedSubjectAudience`
- `DelegationGrant`
- `TokenExchangeAudit`
- accepted persistent machine lifecycle audit facts

### 14.3 Non-authoritative Legacy data

- `MachineClient.allowedResources`
- `MachineClient.allowedScopes`
- `ServiceRegistration.allowedRoles`
- `ServiceRegistration.jwtAudience`
- User `role/internalRole/okrRole` 对 V1 Token 的签发与验证
- Legacy Refresh revocation `Map`
- Legacy backfill/repair inference

## 15. Exact Source Disposition Manifest

本节是首个 Runtime Child 的完整 source disposition。不得使用目录通配推断额外删除，不得把未列文件留给实现阶段自由选择。

Disposition 值：

```text
KEEP
KEEP_MODIFY
DELETE
CREATE
KEEP_TEST_ONLY
KEEP_OUT_OF_RUNTIME_SCOPE
```

### 15.1 Entry, config, database and utilities

| Path | Disposition | Required result |
|---|---|---|
| `src/server.ts` | KEEP_MODIFY | 只 mount V1 routes；无条件初始化 pinned V1；不启动 Legacy cleanup |
| `src/config/env.ts` | KEEP_MODIFY | 删除 Legacy secret/mode/register authority；V1 key config fail fast |
| `src/lib/prisma.ts` | KEEP | 单一 Prisma client seam |
| `src/utils/async-handler.ts` | KEEP | async error forwarding |
| `src/utils/http-error.ts` | KEEP_MODIFY | 稳定映射 V1 validation/lifecycle errors，不泄露内部详情 |

### 15.2 Routes

| Path | Disposition | Required result |
|---|---|---|
| `src/routes/auth.ts` | DELETE | 删除全部 Legacy Human/Agent auth routes |
| `src/routes/users.ts` | DELETE | 删除人员目录 surface |
| `src/routes/roles.ts` | DELETE | 删除在线 role surface |
| `src/routes/service-registrations.ts` | DELETE | 删除 Legacy SSO Gateway 与 verify-token |
| `src/routes/oauth.ts` | KEEP_MODIFY | 只 dispatch V1 direct/exchange；删除 V0/shadow branches |
| `src/routes/oauth-human.ts` | KEEP_MODIFY | 保留 V1 authorization_code/refresh/logout；live status rules 对齐 |
| `src/routes/idempotent.ts` | KEEP_MODIFY | V1 provisioning shape/remediation；无 lifecycle mutation |
| `src/routes/well-known.ts` | KEEP_MODIFY | 只发布 pinned V1 public JWKS；cache policy 对齐 Contract |

### 15.3 Middleware and schemas

| Path | Disposition | Required result |
|---|---|---|
| `src/middleware/auth.ts` | DELETE | 删除 HS256/shared-secret verifier |
| `src/middleware/token-rotation.ts` | DELETE | 删除 Legacy in-memory refresh state |
| `src/middleware/v1-management-auth.ts` | KEEP_MODIFY | 验签后 live-check actor Principal/Client；只用于 auth-service management operations |
| `src/schemas/auth.ts` | DELETE | 删除 Legacy auth request schemas |
| `src/schemas/oauth.ts` | KEEP_MODIFY | 只保留 V1 OAuth schemas 与 strict duplicate/canonical validation |

### 15.4 Shared and Legacy OAuth libraries

| Path | Disposition | Required result |
|---|---|---|
| `src/lib/oauth/audit.ts` | KEEP_MODIFY | 只保留 V1 operational logging；移除 Legacy event authority；不替代持久 lifecycle audit |
| `src/lib/oauth/secret.ts` | KEEP_MODIFY | V1 secret generation/verification；不得使用 `Math.random()` |
| `src/lib/oauth/service.ts` | DELETE | 由 V1 lifecycle seam 替代；不再 re-export issuance |
| `src/lib/oauth/token.ts` | DELETE | 删除 HS256 Agent signer |
| `src/lib/oauth/token-issuance.ts` | DELETE | 删除 V0 flat-field issuance |
| `src/lib/oauth/token-exchange.ts` | DELETE | 删除 V0 OBO implementation |
| `src/lib/oauth/token-exchange-signing.ts` | DELETE | 删除 V0 OBO signer |
| `src/lib/oauth/workflow-signer.ts` | DELETE | 删除 V0 workflow-only signer/verifier |
| `src/lib/oauth/workflow-keyring.ts` | KEEP_MODIFY | 作为 V1 RS256 keyring；只暴露 active signer 与 verification keys/JWKS |

### 15.5 V1 OAuth libraries

| Path | Disposition | Required result |
|---|---|---|
| `src/lib/oauth/v1/contract.ts` | KEEP_MODIFY | 只接受 exact pinned 1.2.0 runtime object；不得接受旧版本运行时 |
| `src/lib/oauth/v1/credentials.ts` | KEEP_MODIFY | V1 opaque credential only |
| `src/lib/oauth/v1/direct.ts` | KEEP_MODIFY | live status + per-audience Grant；导入 `audience-state.ts` |
| `src/lib/oauth/v1/errors.ts` | KEEP_MODIFY | 稳定 V1 error categories |
| `src/lib/oauth/v1/exchange.ts` | KEEP_MODIFY | live state boundary + persistent audit；导入 `audience-state.ts` |
| `src/lib/oauth/v1/grant-migration.ts` | DELETE | 删除 flat-field migration planner |
| `src/lib/oauth/v1/human-login.ts` | KEEP_MODIFY | active User/Client/Grant checks；无 public registration |
| `src/lib/oauth/v1/human-refresh.ts` | KEEP_MODIFY | active lifecycle checks、rotation、reuse detection |
| `src/lib/oauth/v1/human-support.ts` | KEEP_MODIFY | 导入 `audience-state.ts`；persistent Human audit |
| `src/lib/oauth/v1/idempotent.ts` | KEEP_MODIFY | 修复 identity shape、digest、concurrency；不管理 Grants |
| `src/lib/oauth/v1/scope.ts` | KEEP | canonical frozen scope grammar |
| `src/lib/oauth/v1/signer.ts` | KEEP_MODIFY | exact pinned 1.2.0 profiles；不接受 runtime version fallback |
| `src/lib/oauth/v1/audience-state.ts` | CREATE | 只包含 Stored Audience shape 与 frozen-vs-DB comparison；无 Legacy fields/write path |
| `src/lib/oauth/v1/lifecycle.ts` | CREATE | operator-only inspect/rotate/revoke/disable；无 issuance exports |

### 15.6 CLI and identity modules

| Path | Disposition | Required result |
|---|---|---|
| `src/cli/machine-admin.ts` | DELETE | 删除 Legacy lifecycle/flat grant CLI |
| `src/cli/v1-machine-lifecycle.ts` | CREATE | exact operator-only command set from §8 |
| `src/cli/agent-identity.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | 不具备 Token/Grant authority；不属于首个 Runtime Child 的修改面 |
| `src/lib/identity/config.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility only |
| `src/lib/identity/env-file.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility only |
| `src/lib/identity/resolver.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility only |
| `src/lib/identity/types.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility only |

### 15.7 Scripts

| Path | Disposition | Required result |
|---|---|---|
| `scripts/backfill-minimal-auth-v1.ts` | DELETE | post-cut apply path removed |
| `scripts/repair-legacy-client-drift.ts` | DELETE | Legacy flat-field repair removed |
| `scripts/cleanup-evidence-repair.ts` | DELETE | historical Legacy mutator removed from Cut Artifact |
| `scripts/cleanup-legacy-revoked-clients-round-1.ts` | DELETE | historical Legacy mutator removed from Cut Artifact |
| `scripts/check-minimal-auth-v1-readiness.ts` | KEEP_MODIFY | strictly read-only evidence; no derivation/write authority |
| `scripts/prepare-minimal-auth-v1.mjs` | KEEP_MODIFY | exact pinned snapshot generation and digest receipt |
| `scripts/prepare-candidate-snapshot.mjs` | KEEP_TEST_ONLY | contract authoring only；不得进入 runtime startup |
| `scripts/preflight-request-digest.mjs` | KEEP_MODIFY | read-only idempotent migration preflight |
| `scripts/bootstrap-obo-conformance-fixture.ts` | KEEP_TEST_ONLY | isolated test fixture only |
| `scripts/fixture-specs/svc-okr-direct-agent.json` | KEEP_TEST_ONLY | test fixture specification |
| `scripts/generate-fixture-jwt.mjs` | KEEP_TEST_ONLY | test fixture generation only |
| `scripts/obo-conformance-check.ts` | KEEP_TEST_ONLY | V1 conformance only |
| `scripts/obo-conformance-http.ts` | KEEP_TEST_ONLY | V1 conformance only |
| `scripts/obo-conformance-ids.ts` | KEEP_TEST_ONLY | V1 conformance only |
| `scripts/obo-conformance-negative.ts` | KEEP_TEST_ONLY | V1 negative conformance only |
| `scripts/run-obo-conformance.sh` | KEEP_TEST_ONLY | V1 conformance runner |

### 15.8 `packages/machine-token-provider`

| Path | Disposition | Required result |
|---|---|---|
| `packages/machine-token-provider/package.json` | KEEP_MODIFY | 纳入 root workspace/verify；contract version 1.2.0 |
| `packages/machine-token-provider/package-lock.json` | KEEP_MODIFY | 与 package manifest 可复现一致 |
| `packages/machine-token-provider/tsconfig.json` | KEEP | package build config |
| `packages/machine-token-provider/README.md` | KEEP_MODIFY | 只描述 pinned V1；删除旧 digest/version |
| `packages/machine-token-provider/LICENSE` | KEEP | package license |
| `packages/machine-token-provider/.gitignore` | KEEP | package build outputs only |
| `packages/machine-token-provider/src/index.ts` | KEEP_MODIFY | 只导出 V1 provider/error/types |
| `packages/machine-token-provider/src/provider.ts` | KEEP_MODIFY | 验证 `token_type=Bearer` 与返回 scope exact match |
| `packages/machine-token-provider/src/errors.ts` | KEEP | sanitized provider errors |
| `packages/machine-token-provider/src/types.ts` | KEEP_MODIFY | pin 1.2.0 exact source/runtime identity |
| `packages/machine-token-provider/tests/bundle-digest.test.ts` | KEEP_MODIFY | 删除旧 1.1 digest；验证 pinned 1.2 snapshot twice |
| `packages/machine-token-provider/tests/errors.test.ts` | KEEP | provider error tests |
| `packages/machine-token-provider/tests/helpers.ts` | KEEP_MODIFY | V1 exact response helpers |
| `packages/machine-token-provider/tests/provider.test.ts` | KEEP_MODIFY | token_type/scope/cache/singleflight tests |
| `packages/machine-token-provider/tests/redaction.test.ts` | KEEP | secret/token redaction tests |

### 15.9 Root package and deployment files

| Path | Disposition | Required result |
|---|---|---|
| `package.json` | KEEP_MODIFY | 删除 `machine-admin`、`contract:v1:backfill`；新增 `v1-machine-lifecycle` 与统一 `verify`；纳管 provider package |
| `package-lock.json` | KEEP_MODIFY | 与 root workspace/package scripts 一致 |
| `tsconfig.json` | KEEP_MODIFY | build exact production source；不编译 deleted Legacy modules |
| `Dockerfile` | KEEP_MODIFY | reproducible install；build/verify pinned snapshot；V1-only runtime image |
| `docker-compose.yml` | KEEP_MODIFY | 删除 Legacy secret/mode/register env；只传 V1 runtime config |
| `.dockerignore` | KEEP | 排除 secret/build outputs |
| `.gitignore` | KEEP_MODIFY | generated runtime artifact策略与 release fingerprint evidence 一致 |

### 15.10 Required new tests

| Path | Disposition | Required result |
|---|---|---|
| `tests/oauth/v1-lifecycle.test.ts` | CREATE | inspect/rotate/revoke/disable、version conflict、one-time secret、no flat fields、no issuance export |
| `tests/oauth/v1-state-boundary.test.ts` | CREATE | auth-service live checks and Access Token until-exp semantics |
| `tests/oauth/v1-readiness-readonly.test.ts` | CREATE | readiness 无 Prisma write capability、无 Grant derivation |
| `tests/oauth/v1-source-disposition.test.ts` | CREATE | deleted Legacy modules/scripts/exports 不存在 |
| `tests/oauth/v1-runtime-fingerprint.test.ts` | CREATE | exact pinned 1.2 source objects and reproducible snapshot digest |

## 16. Deployment Gates

Production Activation 必须同时满足：

```text
GATE_ACCEPTED_SHUTDOWN_SPEC = PASS
GATE_V1_CONTRACT_FROZEN = PASS
GATE_PINNED_1_2_RUNTIME_FINGERPRINT = PASS
GATE_EXACT_JWKS_URL = PASS
GATE_JWKS_HTTPS_REACHABLE = PASS
GATE_ACTIVE_KEY_AND_KID = PASS
GATE_PREVIOUS_KEY_RETENTION = PASS
GATE_DATABASE_MIGRATIONS = PASS
GATE_PRE_CUT_BACKFILL_COMPLETE = PASS
GATE_POST_CUT_BACKFILL_DISABLED = PASS
GATE_V1_DATA_READINESS = PASS
GATE_V1_MACHINE_LIFECYCLE_SEAM = PASS
GATE_V1_HUMAN_CREDENTIAL_LIFECYCLE_ACCEPTED = PASS
GATE_V1_HUMAN_CREDENTIAL_LIFECYCLE_IMPLEMENTED = PASS
GATE_V1_HUMAN_CREDENTIAL_LIFECYCLE_AUDIT_PASS = PASS
GATE_ALL_REAL_CONSUMERS_CLASSIFIED = PASS
GATE_NO_REAL_CONSUMER_REQUIRES_LEGACY = PASS
GATE_EXTERNAL_CONSUMERS_OFFLINE_JWKS_ONLY = PASS
GATE_NEGATIVE_CONFORMANCE = PASS
GATE_FULL_TEST_MATRIX = PASS
GATE_INDEPENDENT_PRODUCTION_ACTIVATION_REVIEW = PASS
```

在这些 Gate 全部通过前：

```text
production_deployment.status = not_ready
auth_token_contract_v1_production_effective = false
v0_compatibility.supersedes_v0 = false
```

## 17. Failure-Closed Rules

- Pinned Contract source object缺失或不匹配：build/startup 失败。
- Runtime snapshot digest 不可复现或不匹配：build/startup 失败。
- Contract 未 frozen 或未 implementation-authorized：startup 失败。
- Active RS256 key、`kid` 或 issuer 不符合 Contract：startup 失败。
- Unknown `kid`：拒绝，不选择其他 Key。
- Wrong audience/profile/token_use/version/scope：拒绝。
- auth-service operation 的 live state check 失败：拒绝。
- DB Audience 与 frozen registry 不一致：`temporarily_unavailable` 或 startup failure，不回退 Legacy。
- 要求持久审计的 Human、OBO 或 Lifecycle mutation 无法写入审计事实：mutation fail closed。
- Legacy Endpoint：404。
- Legacy Token：401 或标准 OAuth error，不尝试 shared-secret fallback。
- Readiness 发现缺失 V1 authority：返回失败，不生成修复计划，不写数据库。

## 18. Rollback Boundary

Cut Artifact 不包含：

- `LEGACY_ENABLED`
- `AUTH_CONTRACT_MODE=v0`
- Consumer allowlist
- hidden Legacy router
- emergency HS256 fallback
- post-cut backfill apply
- Legacy flat-field repair

唯一代码回滚方式：

```text
whole-release rollback to the immediately previous immutable artifact
```

该 rollback 属于 break-glass 事故响应，会重新暴露已知 Legacy 风险，必须记录原因、时间、Artifact digest、Operator 与恢复计划。

首个 Runtime Child 不执行 Legacy 表/列破坏性删除，以保持数据库可回滚。Schema Cleanup Child 在稳定保留期后单独审计。

## 19. Acceptance Tests

### 19.1 Static source gates

- Production source 不存在 shared-secret JWT signing/verification。
- Production source 不存在 `AUTH_CONTRACT_MODE`。
- Production source 不存在 `token-login`、`verify-token` route。
- Production source 不存在对 `allowedResources` / `allowedScopes` 的运行时授权读取或写入。
- Production source 不存在 Legacy Refresh revocation `Map`。
- Production source 不存在 Legacy backfill apply/repair script。
- `src/lib/oauth/v1/lifecycle.ts` exports 中不存在 Token issuance/sign/verify/exchange function。
- Production credential/ID/JTI generation 不使用 `Math.random()`。

### 19.2 Route gates

以下路径返回 `404`：

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/token-login`
- `/api/auth/refresh`
- `/api/auth/me`
- `/api/auth/change-password`
- `/api/users`
- `/api/roles`
- `/api/services`
- `/api/services/verify-token`
- `/api/services/lookup/svc-workflow`

### 19.3 State boundary gates

- Disabled User 不能开始/完成新 authentication、code exchange 或 refresh。
- Revoked HumanClient 不能进行 code exchange 或 refresh。
- Disabled MachinePrincipal/Revoked MachineClient 不能获取新 Token。
- Revoked TrustedProxy 或失效原始 Client 不能 Exchange。
- Revoked management actor Client 不能执行 provisioning。
- Resource Consumer 在 Principal disable 后仍离线接受此前签发且未过 `exp` 的 valid Access Token。
- 同一 Token 到达 `exp` 后被拒绝。
- Resource Consumer 不发出 auth-service live status/introspection 请求。

### 19.4 Lifecycle seam gates

- Inspect 不返回 Secret Hash、Secret 或 Token。
- Rotate 只返回一次新 Secret，旧 Secret 立即不能用于新 issuance。
- Revoke Client 阻止后续 issuance/exchange/management。
- Disable Principal 阻止其 Clients 的后续 issuance/exchange/management。
- Already-revoked/disabled 重试幂等。
- Wrong `expected-version` 返回 conflict，不写状态。
- Operation audit failure 导致 mutation failure。
- Lifecycle source 不访问 flat fields、不修改 Grants、不导出 issuance。

### 19.5 Backfill cutoff gates

- `contract:v1:backfill` script 不存在。
- Legacy repair/cleanup mutator 文件不存在。
- Readiness tool 在静态 capability test 中只有 read methods。
- 缺失 V1 Grant 时 readiness 返回 nonzero，不产生 write SQL 或 migration plan。
- Cut Artifact 启动/运行不读取 flat fields。

### 19.6 Runtime fingerprint gates

- Exact Git source pins与 1.2.0 内容一致。
- Prepare script 连续运行两次，完整 `sourceBundleDigest` 一致。
- 两次完整 `runtimeDigest` 一致。
- 修改 Manifest、Registry、Bundle file 或 generator 任一 byte 后 gate 失败。
- Provider package 的 digest test 不再接受旧 1.1.0 digest。

### 19.7 Human session gates

- Authorization Code single use。
- Redirect URI exact match。
- PKCE S256 required。
- Concurrent refresh 只产生一个 successor。
- Refresh reuse 撤销 Family 与 Session。
- Logout 撤销 Family 与 Session。
- Password-reset/disabled User 不能继续 refresh。
- 已签发 Access Token 仍只按 `exp` 失效。

### 19.8 Idempotent management gates

- Same `external_ref` + same payload resolves same Principal/Client。
- Same `external_ref` + different payload 返回 `409`。
- Concurrent different payload 不得静默接受 winner。
- Agent shape incomplete 返回 `400`。
- Service shape containing Agent fields 返回 `400`。
- Secret 只在 Client creation 时返回一次。

### 19.9 Repository verification command

根项目必须提供唯一：

```text
npm run verify
```

它依次运行：

1. Contract validation。
2. Exact source pin validation。
3. Runtime snapshot reproducibility twice。
4. TypeScript build。
5. OAuth V1 unit/integration tests。
6. Human lifecycle tests。
7. State boundary tests。
8. Machine lifecycle tests。
9. Idempotent tests。
10. Readiness read-only tests。
11. Negative conformance。
12. Machine Token Provider build/tests。
13. Migration static validation。
14. Source disposition test。
15. `git diff --check` equivalent。

当前窄范围 `npm test` 不得代表仓库通过。

## 20. Implementation Sequence

### Child 0 — Human credential lifecycle

```text
AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1
```

冻结 audited User creation、password reset、User disable 与 Session/Family revocation。该 Child 可以与 Runtime Child 设计并行，但必须先 accepted，且在 Production Activation 前完成实现和独立审计。

### Child 1 — V1-only runtime

```text
AUTH_SERVICE_V1_ONLY_RUNTIME_V1
```

在本 Spec accepted 并存在于 base branch 后才可启动。范围严格等于 §15 Exact Source Disposition Manifest。

### Child 2 — Consumer migrations

每个真实 Consumer 独立 PR：

- 获取 V1 Token。
- 使用 JWKS 本地离线验签。
- 固定 audience/profile/scope。
- 删除 HS256 Secret、`verify-token` 与 live status lookup。

### Child 3 — Production activation evidence

```text
AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
```

- 固定完整 1.2.0 source/runtime digest receipt。
- 固定 exact HTTPS JWKS URL。
- 提供 Key Rotation、Consumer Matrix、真实 DB readiness、Pre-cut evidence、Human Lifecycle 与 deployment receipts。
- 独立 Review PASS 后，才更新 production-effective 与 `supersedes_v0=true`。

### Child 4 — Legacy schema cleanup

```text
AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1
```

在 V1-only 生产运行稳定并经过保留期后，物理删除旧表、旧列、旧 Enum 与历史迁移辅助结构。

## 21. Rejected Alternatives

### A. Legacy allowlist

拒绝。它继续保留最弱鉴权面。

### B. 长期 `v1_shadow` 或双协议 Artifact

拒绝。Consumer readiness 在 PRE_CUT 完成，Cut Artifact 只有 V1。

### C. 保留 `token-login` bootstrap

拒绝。Owner 已决定删除且无 replacement endpoint。

### D. 修补 Legacy Refresh

拒绝。使用 V1 Human Session/Refresh Family。

### E. 保留通用 `verify-token`、introspection 或 live status API

拒绝。External Consumer 固定 offline-JWKS-only。

### F. Access Token blacklist

拒绝。V1 Access Token 按短 TTL 有效至 `exp`；live status 只控制 auth-service 后续操作。

### G. Lifecycle seam 继续复用 Legacy `service.ts`

拒绝。Legacy module混合 lifecycle、flat fields 与 issuance export；替换为无 Token authority 的 operator-only V1 seam。

### H. Post-cut readiness 自动补 Grant

拒绝。Readiness 只提供证据；V1 authority 不得从 Legacy fields 自动再生。

### I. Runtime Child 直接设置 production effective

拒绝。只有 Production Activation Child 可在全 Gate 与独立 Review 后更新 lifecycle。

### J. Public registration 作为 Human lifecycle 补洞

拒绝。Human creation/reset/disable 必须是受控、持久审计的 V1 lifecycle。

### K. 首轮同时 drop 所有 Legacy 表和列

拒绝。运行时硬切不要求立即破坏 whole-release rollback 能力。

## 22. Remaining Owner Decisions

```text
OWNER_DECISION_REQUIRED = NONE
```

已冻结：

- Legacy 直接硬切。
- `token-login` 删除且无替代入口。
- `/api/services/verify-token` 删除且无 introspection replacement。
- External Consumer offline-JWKS-only。
- Access Token 有效至 `exp`。
- Operator-only V1 lifecycle seam。
- Flat-field migration PRE_CUT_ONLY。
- Production-effective 与 `supersedes_v0` 只由 Production Activation Child 更新。
- Public registration不恢复；Human Credential Lifecycle Child 是 activation blocker。

实现 Agent 不得重新打开这些问题。

## 23. Completion and Authorization Definition

本计划完成的唯一判定：

```text
LEGACY_RUNTIME_ROUTES = 0
LEGACY_HS256_TOKEN_PROFILES = 0
LEGACY_REFRESH_SESSION_PATHS = 0
GENERIC_VERIFY_TOKEN_ORACLE = 0
TOKEN_INTROSPECTION_ENDPOINTS = 0
AUTH_CONTRACT_MODE_SWITCH = 0
POST_CUT_BACKFILL_APPLY_PATHS = 0
LEGACY_FLAT_FIELD_REPAIR_PATHS = 0
V1_MACHINE_LIFECYCLE_SEAM = OPERATOR_ONLY
EXTERNAL_CONSUMER_STATUS_LOOKUP = 0
ACCESS_TOKEN_VALIDITY = UNTIL_EXP
V1_RUNTIME_AUTHORITY = SINGLE
ALL_REAL_CONSUMERS = MIGRATED_TO_V1 | INTENTIONALLY_OFFLINE | NOT_A_REAL_CONSUMER
HUMAN_CREDENTIAL_LIFECYCLE = ACCEPTED_AND_AUDITED
PRODUCTION_GATES = PASS
```

本修订提交后的状态仍为：

```text
SPEC_MERGE_READY = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
```

只有独立 Review 明确确认五项修订和 Exact Source Disposition Manifest 全部充分后，才可更新状态。