# AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1

```text
SPEC_ID = AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1
SPEC_STATUS = CANDIDATE
OWNER_DECISIONS_FROZEN = YES
IMPLEMENTATION_AUTHORIZED = AFTER_ACCEPTED_SPEC_EXISTS_ON_BASE_BRANCH
AUDIT_BASE_SHA = 84890120bd385b39287cb81890236b0e73e96c8d
DATE = 2026-08-18
```

## 1. North Star

`auth-service` 必须成为单一、严格、可验证的 Minimal Auth V1 身份与 Token Authority。

完成本 Spec 后，运行时不得再存在第二套 Legacy 身份面、Legacy Token Profile、共享 HS256 兼容验签、Legacy Refresh Session、中心化通用验签 Oracle，或通过开关重新启用这些能力的路径。

目标状态：

```text
Human identity
→ Authorization Code + PKCE S256
→ V1 Human Access Token (RS256)
→ opaque Refresh Credential + persisted Session/Family

Machine identity
→ MachinePrincipal
→ MachineClient
→ MachineAccessGrant(audience, scopes)
→ client_credentials
→ V1 Direct Machine Access Token (RS256)

Delegated work
→ verified V1 Direct Agent Token
→ fixed TrustedProxy Service
→ original grant ∩ delegation grant
→ V1 Delegated Token (RS256)

Consumer verification
→ auth-service JWKS
→ local signature verification
→ exact issuer
→ exact audience
→ exact token profile
→ exact scope
```

## 2. Authority

本 Spec 的优先级如下：

1. 本 Spec 中已冻结的 Owner 决策。
2. `contract-bundles/minimal-auth-v1/` 中 accepted、frozen、implementation-authorized 的机器合同。
3. Prisma 中 V1 authority tables 的约束。
4. 现有 V1 实现与测试。
5. Legacy 文档、Legacy 路由、Legacy 字段和历史审计报告只能作为迁移证据，不能覆盖以上 authority。

若历史文档与本 Spec 冲突，以本 Spec 为准。

## 3. Current Runtime Truth

当前 `main` 同时存在两套鉴权面：

### 3.1 V1 面

- Frozen Contract Bundle。
- RS256 + `kid`。
- JWKS。
- V1 Human Authorization Code + PKCE。
- V1 opaque Refresh Credential、Session、Family、reuse detection。
- V1 Direct Machine Token。
- V1 Trusted Proxy / OBO。
- Per-audience MachineAccessGrant。
- V1 management authentication for `/api/v1/principals` and `/api/v1/clients`。

### 3.2 Legacy 面

- `/api/auth/*` 直接登录、注册、Agent Token Login、JWT Refresh。
- HS256 Access/Refresh Token。
- `authRequired` 中无 issuer/audience 的 shared-secret-only fallback。
- 进程内 Refresh Token revocation `Map`。
- `/api/users/*` 和 `/api/roles/*` 人员目录及角色修改接口。
- `/api/services/*` Legacy SSO Gateway、Service Registration 与通用 `verify-token`。
- V0 `allowedResources[] + allowedScopes[]` 平面授权。
- V0 Token Exchange，不要求正式 TrustedProxy profile。
- `AUTH_CONTRACT_MODE=v0|v1_shadow|v1` 双栈开关。

只要 Legacy 面仍可达，V1 的严格边界就不是整个服务的真实边界。

## 4. Frozen Owner Decisions

以下决定已冻结，不得留给实现阶段重新选择。

### D1. Legacy 直接硬切

```text
LEGACY_MIGRATION_WINDOW = NONE
LEGACY_RUNTIME_ALLOWLIST = NONE
LEGACY_COMPATIBILITY_FLAG = NONE
LEGACY_NEW_CONSUMER = FORBIDDEN
```

不保留按 Consumer、IP、Header、环境变量、路径或 Token Claim 开启 Legacy 的例外。

Consumer readiness 可以成为生产部署 Gate，但不得成为在新版本中继续携带 Legacy 代码的理由。

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

需要新建 Agent credential 的系统必须通过受 `svc-auth` + `auth.identity.provision` 保护的 V1 management seam 完成，不得通过 User、role 或 Agent Token Login 绕行。

### D3. 删除通用 `verify-token`

```text
POST /api/services/verify-token = REMOVE
CENTRAL_GENERIC_TOKEN_ORACLE = NONE
INTROSPECTION_REPLACEMENT_IN_THIS_SPEC = NONE
```

每个 Consumer 必须使用 JWKS 在本地验证 Token，并严格绑定自己的 audience、profile 和 scope。

### D4. Minimal Auth V1 是唯一目标架构

不重新设计 V1，不引入新的 Policy Engine、Sidecar、mTLS、TPM、Kernel Keyring 或新的 Token Broker。

### D5. Hard cut 指运行时 authority，不要求首个实现 PR 立即物理删除所有旧表和旧列

第一轮实现必须删除 Legacy 路由、签发、验签和权限 authority。

为保持数据库回滚安全，以下旧数据结构可以暂时保留，但必须成为 dead data：

- `service_registrations`
- `MachineClient.allowedResources`
- `MachineClient.allowedScopes`
- Legacy role/profile 字段
- Legacy 审计数据

任何保留字段都不得再被运行时代码读取来作授权决定。物理删除由独立 Schema Cleanup Spec 处理。

## 5. Explicit Non-Goals

本 Spec 不做：

- 不拆分 ADC 与 auth-service 的数据库。
- 不修改 Forum、Workflow、OKR 的业务权限语义。
- 不新增在线 Grant Management API。
- 不恢复公开注册。
- 不设计新的 Agent credential bootstrap protocol。
- 不提供通用 Token introspection。
- 不为 Legacy Refresh 新建 Redis 或数据库补丁体系。
- 不立即删除生产数据库中的旧表、旧列或历史记录。
- 不改变 `one Agent = one MachinePrincipal security identity` 的方向。
- 不把 User role 写回 V1 Access Token。

## 6. Target Runtime Surface

### 6.1 保留的公开运行时接口

| Method | Path | Target semantics |
|---|---|---|
| GET | `/api/health` | 仅报告服务与 V1 runtime identity；不得宣称未满足的 production-effective 状态 |
| GET | `/.well-known/jwks.json` | 发布 active + retained previous public verification keys |
| GET | `/oauth/authorize` | V1 Human Authorization Code initiation；PKCE S256 required |
| POST | `/oauth/authorize/authenticate` | V1 Human credential authentication and authorization-code issuance |
| POST | `/oauth/token` | 仅支持 V1 `authorization_code`、`refresh_token`、`client_credentials`、RFC 8693 token exchange |
| POST | `/oauth/logout` | 撤销 V1 Human Session / Refresh Family |
| POST | `/api/v1/principals` | V1 idempotent MachinePrincipal provisioning；`svc-auth` service token required |
| POST | `/api/v1/clients` | V1 idempotent MachineClient provisioning；`svc-auth` service token required |

所有其他当前路由都不是保留接口，除非后续 accepted Spec 明确重新授权。

### 6.2 必须删除的接口

| Surface | Required disposition |
|---|---|
| `/api/auth/login` | REMOVE；Human 登录只走 Authorization Code + PKCE |
| `/api/auth/register` | REMOVE；不保留公开或邀请码注册 |
| `/api/auth/token-login` | REMOVE；无替代入口 |
| `/api/auth/refresh` | REMOVE；只允许 V1 opaque Refresh Credential |
| `/api/auth/me` | REMOVE；本 Spec 不新增 V1 replacement |
| `/api/auth/change-password` | REMOVE；密码生命周期管理另立 Spec |
| `/api/users` and `/api/users/*` | REMOVE；auth-service 不再作为人员目录 |
| `/api/roles` and `/api/roles/*` | REMOVE；auth-service 不再在线管理业务角色 |
| `/api/services` and `/api/services/*` | REMOVE；Legacy SSO Gateway 全面退役 |
| `/api/services/verify-token` | REMOVE；不得保留 alias 或 hidden route |
| `/api/services/lookup/*` | REMOVE；Audience authority 来自 frozen V1 registry，不来自在线 Service Registration |

删除后的响应必须由路由缺失自然产生 `404`。不得返回兼容提示、迁移 Token 或转发到旧服务。

### 6.3 CLI 与内部 seam

| Component | Disposition |
|---|---|
| `agent-identity` CLI | KEEP；它不具备 Token issuance authority，仍须独立审计输入安全 |
| `machine-admin` Legacy CLI | REMOVE 或 hard-disable；不得继续创建 flat `allowedResources/allowedScopes` authority |
| V1 readiness/backfill tools | KEEP，只能作为 operator tool，不得成为在线授权面 |
| Legacy create/rotate/revoke MachineClient service functions | REMOVE from production exports unless V1 lifecycle semantics explicitly require them |

## 7. Token Acceptance Matrix

### 7.1 Accepted

| Profile | Algorithm | Required binding |
|---|---|---|
| V1 Human Access | RS256 | exact issuer, exact consumer audience, `principal_type=user`, `token_use=access`, exact version, known `kid`, valid time claims |
| V1 Direct Agent | RS256 | exact issuer/audience, `principal_type=agent`, `agent_id`, active Principal/Client, per-audience MachineAccessGrant, exact scope |
| V1 Direct Service | RS256 | exact issuer/audience, `principal_type=service`, no `agent_id`, active Principal/Client, per-audience MachineAccessGrant, exact scope |
| V1 Delegated | RS256 | exact issuer/audience, `token_use=workflow_obo`, original active Agent, fixed active TrustedProxy Service, accepted source audience, original grant ∩ delegation grant |
| V1 opaque Refresh Credential | opaque credential | persisted active credential, Session, Family, User and HumanClient; rotation and reuse detection in one serializable flow |

### 7.2 Rejected unconditionally

- Any HS256 Access Token。
- Any HS256 Refresh Token。
- Any Token accepted only because it shares `JWT_SECRET`。
- Any Legacy ADC issuer Token。
- Any Token without exact audience。
- Any Token whose expected audience comes from arbitrary request-body input。
- Any Token missing a known `kid`。
- Any Token using `alg=none` or any algorithm other than RS256。
- Any Legacy Agent Token Login credential。
- Any Token carrying forbidden claims for its profile。
- Any disabled User、MachinePrincipal、MachineClient、HumanClient、Session、Family or TrustedProxy。
- Any scope authorized through `allowedResources[]` / `allowedScopes[]` instead of V1 Grant tables。

## 8. Runtime and Configuration Authority

### 8.1 V1 must be unconditional

`AUTH_CONTRACT_MODE` 必须从运行时设计中删除。

新版本不得存在：

```text
v0
v1_shadow
legacy fallback
legacy route mounting
```

启动流程必须无条件：

1. 生成或读取由 frozen Contract Bundle 产生的 runtime snapshot。
2. 校验 digest、contract version、freeze status 与 implementation authorization。
3. 校验 exact issuer。
4. 加载且验证 active RS256 private key、`kid` 与 previous public keys。
5. 若任何条件不满足，启动失败。

### 8.2 Legacy environment variables

以下变量不得再具有运行时 authority：

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

实现可以在一个发布周期内检测到这些变量并给出固定的 startup warning，但不得读取其值、不得输出其值、不得据此改变 Token 行为。最终应删除 warning。

保留：

- `DATABASE_URL`
- `PORT`
- RS256 active/private key configuration
- `JWT_KID`
- previous public verification keys
- CORS 与 rate-limit 运行配置

Contract Bundle 是 issuer、profile、TTL、scope grammar、audience registry 的唯一 authority；重复环境变量不得覆盖合同。

## 9. Data Authority

### 9.1 Human authority

Human V1 只依赖：

- active `User`
- active `HumanClient`
- registered redirect URI
- `HumanAudienceGrant`
- `AuthorizationTransaction`
- `AuthorizationCode`
- `HumanSession`
- `RefreshFamily`
- `RefreshCredential`
- `AuthSecurityAudit`

`User.status !== active` 时，认证、Code Exchange、Refresh 和后续状态检查必须 fail closed。

### 9.2 Machine authority

Machine V1 只依赖：

- `MachinePrincipal`
- `MachineClient`
- `AuthAudience`
- `MachineAccessGrant`
- `TrustedProxy`
- `ProxyAcceptedSubjectAudience`
- `DelegationGrant`
- `TokenExchangeAudit`

### 9.3 Explicitly non-authoritative legacy data

以下数据即使暂存于数据库，也不得参与运行时授权：

- `MachineClient.allowedResources`
- `MachineClient.allowedScopes`
- `ServiceRegistration.allowedRoles`
- `ServiceRegistration.jwtAudience`
- User `role/internalRole/okrRole` 对 V1 Token 的签发与验证
- 任何历史 Token Revocation `Map`

## 10. Required Code Disposition

实现 PR 必须至少覆盖以下范围。

### 10.1 `src/server.ts`

- 删除 `authRouter`、`usersRouter`、`rolesRouter`、`serviceRegistrationRouter` 的 import 与 mount。
- 删除 Legacy refresh cleanup startup。
- 无条件初始化 V1 Contract 与 V1 Token Issuer。
- 不读取 `AUTH_CONTRACT_MODE`。
- `/api/health` 只报告真实 V1 runtime contract identity。

### 10.2 `src/config/env.ts`

- 删除 Legacy HS256、Legacy Refresh、Agent Token Login、公开注册与 mode switch 配置。
- V1 signer configuration fail fast。
- Contract-defined issuer 不得被运行环境悄悄覆盖。

### 10.3 `src/routes/oauth.ts`

- 删除 `issueToken()` V0 dispatch。
- 删除 `exchangeToken()` V0 dispatch。
- 删除 shadow evaluation。
- `/oauth/token` 只调用 V1 Direct / V1 Exchange implementation。
- 保持 OAuth error、no-store 与 duplicate-parameter failure-closed semantics。

### 10.4 删除 Legacy route/middleware modules

目标包括但不限于：

- `src/routes/auth.ts`
- `src/routes/users.ts`
- `src/routes/roles.ts`
- `src/routes/service-registrations.ts`
- `src/middleware/auth.ts`
- `src/middleware/token-rotation.ts`
- `src/schemas/auth.ts`

不得留下未挂载但仍被导出的 Legacy authority library。

### 10.5 删除 Legacy Token implementation

目标包括但不限于：

- HS256 User Access/Refresh signing and verification。
- HS256 Agent Access Token signer。
- V0 Machine Token issuance。
- V0 Token Exchange。
- V0 Workflow-only signer/verifier when no longer referenced by V1。
- Legacy flat grant create/rotate/revoke API and CLI。

`workflow-keyring.ts` 当前被 V1 signer 复用，可先保留；重命名不是本 Spec 的 merge gate。

### 10.6 V1 Idempotent Provisioning remediation

Hard cut 不得把已有 V1 provisioning bug 带入唯一生产路径。实现必须同时保证：

- `principal_type=agent` 时，`agent_id` 与 `owner_user_id` 必填。
- `principal_type=service` 时，禁止 `agent_id` 与 Agent owner shape。
- Claim existing Principal 时，digest 依据数据库真实 identity profile 计算并与请求一致。
- 并发 unique-key loser 必须比较 incoming digest 与 winner digest；不同 payload 返回稳定 `409`。
- 参数错误返回稳定 `400`，不得泄露 digest、secret 或内部数据库信息。
- Client/Principal ID generation 使用 `crypto.randomBytes` 或 `randomUUID`，不得使用 `Math.random()`。

### 10.7 Official Machine Token Provider

`packages/machine-token-provider` 继续保留为 V1 Consumer helper，但必须：

- 与当前 frozen contract version 对齐。
- 进入根项目统一 build/test gate。
- 验证 `token_type=Bearer`。
- 验证返回 scope 与请求 canonical scope 完全一致。
- 不记录 access token、Basic header、client secret 或 credential-provider 原始异常。

## 11. Consumer Contract

### 11.1 Consumer obligations

每个 Consumer 必须本地验证：

```text
alg = RS256
kid ∈ trusted JWKS
iss = auth-service frozen exact issuer
aud = this consumer's exact audience
principal_type = accepted profile
token_use = accepted token use
version = supported frozen version
exp/nbf/iat = valid under frozen skew
scope ⊆ endpoint required scopes
forbidden claims = absent
```

Consumer 不得：

- 调用 auth-service 询问一个任意 Token 是否“valid”。
- 接受 request body 中声明的 caller identity。
- 从 unverified payload 得出授权结论。
- 为兼容旧 Consumer 保存 auth-service HS256 Secret。

### 11.2 Production deployment readiness states

每个真实 Consumer 在生产 Cutover 前必须被分类为：

```text
MIGRATED_TO_V1
INTENTIONALLY_OFFLINE
NOT_A_REAL_CONSUMER
```

不允许：

```text
TEMPORARY_LEGACY
ALLOWLISTED_LEGACY
UNKNOWN_BUT_DEPLOY_ANYWAY
```

已知应调查的首批仓库：

- `mayf3/dsh-agent-core`
- `mayf3/agent-forum`
- `mayf3/svc-workflow`
- `mayf3/svc-workflow-kernel`
- `mayf3/svc-okr`
- `mayf3/agent-dev-center`

Consumer 调查不会改变本 Spec 的运行时硬切决定，只决定生产部署日期。

## 12. Deployment Gates

生产部署必须同时满足：

```text
GATE_V1_CONTRACT_FROZEN = PASS
GATE_EXACT_JWKS_URL = PASS
GATE_JWKS_HTTPS_REACHABLE = PASS
GATE_ACTIVE_KEY_AND_KID = PASS
GATE_PREVIOUS_KEY_RETENTION = PASS
GATE_DATABASE_MIGRATIONS = PASS
GATE_V1_DATA_READINESS = PASS
GATE_ALL_REAL_CONSUMERS_CLASSIFIED = PASS
GATE_NO_REAL_CONSUMER_REQUIRES_LEGACY = PASS
GATE_NEGATIVE_CONFORMANCE = PASS
GATE_FULL_TEST_MATRIX = PASS
```

当前 Contract Bundle 中 `production_deployment=not_ready` 与 `consumer_migration=not_started` 不得在缺乏证据时直接改为 effective。

代码可先合入 V1-only 主线，但生产镜像不得部署，直到上述 Gate 通过。

## 13. Failure-Closed Rules

- Contract snapshot 不存在、digest 不匹配、未 frozen、未 implementation-authorized：启动失败。
- Active RS256 key、`kid` 或 issuer 不符合合同：启动失败。
- Unknown `kid`：拒绝；不得随机选择其他 Key。
- Wrong audience：拒绝；不得由调用方覆盖 expected audience。
- Wrong scope/profile/token_use/version：拒绝。
- DB audience 与 frozen registry 不一致：`temporarily_unavailable` 或启动失败，不得回退 Legacy。
- Audit persistence 是 V1 OBO 安全语义的一部分；要求审计的流程无法落库时 fail closed。
- Disabled identity/session/client/proxy：拒绝。
- Legacy Endpoint：404。
- Legacy Token：401/标准 OAuth error；不得尝试 shared-secret fallback。

## 14. Rollback Boundary

新版本不得包含：

- `LEGACY_ENABLED`
- `AUTH_CONTRACT_MODE=v0`
- Consumer allowlist
- hidden Legacy router
- emergency HS256 fallback

允许的唯一代码回滚方式是：

```text
whole-release rollback to the immediately previous immutable artifact
```

该回滚属于 break-glass 事故响应，会重新暴露已知 Legacy 风险，必须：

- 由可信 Operator 显式执行。
- 记录事件原因、时间、Artifact digest 与负责人。
- 不修改数据库为不可前滚状态。
- 尽快恢复 V1-only artifact。

因此首个实现 PR 不执行 Legacy 表/列的破坏性删除；数据库物理清理由后续 Spec 完成。

## 15. Acceptance Tests

### 15.1 Static gates

- Production source 中不存在 `jwt.sign(...JWT_SECRET...)` 或 shared-secret JWT verification。
- Production source 中不存在 `AUTH_CONTRACT_MODE` 分支。
- Production source 中不存在 `token-login`、`verify-token` route registration。
- Production source 中不存在对 `allowedResources` / `allowedScopes` 的授权读取。
- Production source 中不存在 Legacy Refresh revocation `Map`。
- Production source 中不存在 `Math.random()` 生成 Token、JTI、Client ID 或 credential identity。

### 15.2 Route gates

以下请求返回 `404`：

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

### 15.3 Startup gates

- 缺少 frozen runtime snapshot：进程启动失败。
- Snapshot digest 被篡改：进程启动失败。
- 缺少 active private key 或 `kid`：进程启动失败。
- Key 非 RSA、少于 2048 bit、duplicate `kid`：进程启动失败。
- Contract exact issuer 与 runtime 不一致：进程启动失败。

### 15.4 Token negative matrix

必须覆盖：

- HS256 Human Token rejected。
- HS256 Agent Token rejected。
- Legacy ADC issuer rejected。
- Wrong audience rejected。
- Wrong issuer rejected。
- Unknown `kid` rejected。
- Missing `kid` rejected。
- `alg=none` rejected。
- HS/RS confusion rejected。
- Expired / not-yet-valid / excessive TTL rejected。
- Forbidden claim rejected。
- Agent Token missing `agent_id` rejected。
- Service Token carrying `agent_id` rejected。
- Scope outside namespace rejected。
- Unregistered scope rejected。
- Scope not in MachineAccessGrant rejected。
- Disabled Principal/Client/User/HumanClient/Session/Family/Proxy rejected。
- OBO chaining rejected。
- OBO without accepted source audience rejected。
- OBO without original grant or delegation grant rejected。

### 15.5 Human session gates

- Authorization Code single use。
- Redirect URI exact match。
- PKCE S256 required。
- Refresh Credential single active member per Family。
- Concurrent refresh produces only one successor。
- Reuse revokes Family and Session。
- Logout revokes Family and Session。
- Password-disabled or inactive User cannot authenticate or refresh。

### 15.6 Idempotent management gates

- Same `external_ref` + same payload resolves same Principal/Client。
- Same `external_ref` + different payload returns `409`。
- Concurrent different payload calls cannot silently resolve winner。
- Agent shape incomplete returns `400`。
- Service shape containing Agent fields returns `400`。
- Secret returned only on Client creation, never on lookup/claim/retry。

### 15.7 Repository verification command

根项目必须提供唯一总门禁，例如：

```text
npm run verify
```

它至少运行：

- Contract validation / prepare reproducibility。
- TypeScript build。
- Identity tests still in scope。
- OAuth V1 tests。
- Human lifecycle tests。
- Contract tests。
- Negative conformance。
- Idempotent tests。
- Machine Token Provider tests。
- Migration static validation。
- `git diff --check` equivalent。

不得再以当前窄范围 `npm test` 代表仓库整体通过。

## 16. Implementation Sequence

### Child 1 — V1-only runtime

```text
AUTH_SERVICE_V1_ONLY_RUNTIME_V1
```

- 删除 Legacy route mounting、Legacy signer/verifier、mode switch。
- `/oauth/token` 只保留 V1。
- 修复 V1 idempotent provisioning。
- 纳管完整 test gate。

### Child 2 — Consumer migrations

每个真实 Consumer 独立 PR：

- 获取 V1 token。
- 使用 JWKS 本地验签。
- 固定 audience/profile/scope。
- 删除 HS256 Secret 与 `/api/services/verify-token` 调用。

不得在 auth-service 中增加兼容代码来替代 Consumer 修改。

### Child 3 — Production activation evidence

```text
AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
```

- 固定 exact HTTPS JWKS URL。
- 提供 Key Rotation、Consumer Matrix、真实 DB readiness 与 deployment receipts。
- 只在证据充分后更新 Contract lifecycle。

### Child 4 — Legacy schema cleanup

```text
AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1
```

在 V1-only 运行稳定并经过保留期后，再决定删除旧表、旧列、旧 Enum、旧迁移辅助代码。

## 17. Rejected Alternatives

### A. Legacy allowlist

拒绝。它把无边界兼容逻辑变成长期 policy engine，并继续保留最弱鉴权面。

### B. `v1_shadow` 长期双写/双判定

拒绝。Shadow 适用于迁移验证，不是最终运行架构；Owner 已选择直接硬切。

### C. 保留 `token-login` 作为一次性 bootstrap

拒绝。本 Spec 不提供替代 bootstrap。Credential provisioning 已有受 V1 management token 保护的 seam。

### D. 修补 Legacy Refresh 为 Redis/DB

拒绝。仓库已有更严格的 V1 Human Session / Refresh Family；再做一套 Legacy persistence 只会延长双栈。

### E. 修复并保留 `/api/services/verify-token`

拒绝。通用中心化验签接口容易混淆 expected audience 与授权责任；Consumer 必须本地验证自己的 Token contract。

### F. 仅将默认 mode 改成 `v1`，但保留 Legacy 路由

拒绝。Legacy 路由仍可达时，真实边界仍是双栈。

### G. 首轮同时 drop 所有 Legacy 表和列

拒绝。运行时硬切不要求立即破坏数据库回滚能力；物理清理应在稳定保留期后单独审计。

## 18. Remaining Owner Decisions

```text
OWNER_DECISION_REQUIRED = NONE
```

Owner 已冻结：

- Legacy 直接硬切。
- `token-login` 直接删除，无替代入口。
- `/api/services/verify-token` 直接删除，无 introspection replacement。

实现 Agent 不得重新打开这些问题。

## 19. Completion Definition

本计划完成的唯一判定：

```text
LEGACY_RUNTIME_ROUTES = 0
LEGACY_HS256_TOKEN_PROFILES = 0
LEGACY_REFRESH_SESSION_PATHS = 0
GENERIC_VERIFY_TOKEN_ORACLE = 0
AUTH_CONTRACT_MODE_SWITCH = 0
V1_RUNTIME_AUTHORITY = SINGLE
ALL_REAL_CONSUMERS = MIGRATED_TO_V1 | INTENTIONALLY_OFFLINE | NOT_A_REAL_CONSUMER
PRODUCTION_GATES = PASS
```

在 accepted Spec 存在于实现 PR 的 base branch 之前，不允许开始产品代码实施。
