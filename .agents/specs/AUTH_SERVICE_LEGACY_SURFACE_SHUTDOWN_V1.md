# AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1

```text
SPEC_ID = AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1
SPEC_STATUS = CANDIDATE_PROVISIONING_RESOLUTION_REVIEW_AMENDED
SPEC_MERGE_READY = NO
IMPLEMENTATION_AUTHORIZED = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
INDEPENDENT_REVIEW_REQUIRED = YES
READY_FOR_INDEPENDENT_REVIEW = YES
OWNER_DECISIONS_FROZEN = YES

AUDIT_BASE_SHA = 84890120bd385b39287cb81890236b0e73e96c8d
PREVIOUS_SPEC_HEAD = 56636da99f5f8332677a3c405293a76d4578f221
DATE = 2026-08-19

AUTH_SERVICE_READ_ONLY_RESOLUTION_CONTRACT =
  DEFINED_AT_SPEC_LEVEL

AUTH_SERVICE_SIDE_STATE_F_PREREQUISITE =
  RESOLVED_AT_SPEC_LEVEL

STATE_F_END_TO_END_IMPLEMENTABILITY =
  BLOCKED_BY_AGENT_CORE_CALLER_SPEC_ALIGNMENT

STATE_F_IMPLEMENTABILITY_BLOCKER =
  NOT_FULLY_RESOLVED

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
RESOLUTION_304_RESPONSE = FORBIDDEN
CALLER_RESOLUTION_CACHE = FORBIDDEN
FRESH_RESOLUTION_PER_PROVISIONING_OPERATION = REQUIRED

CLIENT_EXTERNAL_REF_NULL_SEMANTICS =
  RETURN_200_AS_READ_ONLY_FACT
```

本次 amendment 只修订同一 governing Spec。它保留已经接受的 read-only
provisioning resolution 方向，并关闭独立复审指出的四个 Spec 缺口：

1. auth-service 只宣布 Auth 侧 prerequisite 已冻结，不越权宣布 Agent Core
   State F 端到端已经关闭；
2. resolution response 与 caller 结果缓存全部禁止，每次 provisioning operation
   必须进行新的 Auth 读取；
3. management resolution 的成功与错误 Wire Contract 完整冻结；
4. `client_external_ref=null` 作为数据库当前事实以 HTTP 200 返回，由 caller
   判定为 unbound/mismatch，不在只读路径中 claim、repair 或升级为通用 5xx。

本 amendment 不自行宣布 Spec accepted，不授权实现，不修改 auth-service
产品代码、Prisma、数据库、Route、Principal、Client、Grant、部署或
`dsh-agent-core`。

## 1. North Star

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

## 2. Authority and Review State

本 Spec 的 authority 顺序为：

1. 本 Spec 中已冻结的 Owner 决策。
2. 本 Spec 中冻结的 State-check、Provisioning Resolution、Lifecycle、
   Backfill Cutoff、Authority Reconciliation 与 Human Credential Lifecycle
   决策。
3. `contract-bundles/minimal-auth-v1/` 中 frozen、
   implementation-authorized 的 1.2.0 机器合同。
4. Prisma 中 V1 authority tables 的约束。
5. accepted Child Spec。
6. 现有实现与测试只能作为 State / Observation，不能覆盖前述 authority。
7. Legacy 文档、Legacy 路由、Legacy 字段、Legacy 脚本和历史审计报告
   只能作为迁移证据。
8. 其他仓库的 accepted governing Spec 只由该仓库自己的 amendment /
   supersession 流程改变；本 Spec 不能单方面改写它们。

当前状态固定为：

```text
SPEC_MERGE_READY = NO
IMPLEMENTATION_AUTHORIZED = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
```

本次 amendment 不得被解释为 Author 自审通过。

## 3. Current Runtime Truth

当前 `main@84890120bd385b39287cb81890236b0e73e96c8d`
同时存在 V1 与 Legacy 鉴权面。

### 3.1 V1 面

- Frozen Minimal Auth V1 Contract Bundle 1.2.0。
- RS256 + `kid`。
- JWKS。
- V1 Human Authorization Code + PKCE。
- V1 opaque Refresh Credential、Session、Family 与 reuse detection。
- V1 Direct Machine Token。
- V1 Trusted Proxy / OBO。
- Per-audience `MachineAccessGrant`。
- `/api/v1/principals` 与 `/api/v1/clients` 的 creation-capable V1
  management operations。

### 3.2 Legacy 面

- `/api/auth/*` 直接登录、注册、Agent Token Login、JWT Refresh。
- HS256 Access/Refresh Token。
- `authRequired` 中无 exact issuer/audience/profile 的
  shared-secret-only fallback。
- 进程内 Refresh Token revocation `Map`。
- `/api/users/*` 和 `/api/roles/*` 人员目录及角色修改接口。
- `/api/services/*` Legacy SSO Gateway、Service Registration 与通用
  `verify-token`。
- V0 `allowedResources[] + allowedScopes[]` 平面授权。
- V0 Token Exchange，不要求正式 TrustedProxy profile。
- `AUTH_CONTRACT_MODE=v0|v1_shadow|v1` 双栈开关。
- Legacy flat-field backfill、repair 与 cleanup mutator。

### 3.3 当前 V1 provisioning seam 的副作用事实

当前只存在：

```text
POST /api/v1/principals
POST /api/v1/clients
```

这两个 Route 调用 `createOrGetPrincipal` / `createOrGetClient`。
`expected_client_id` 进入 `createOrGetClient` 的 claim path；该 path
可以执行 `updateMany(... data: { externalRef })`。`createOrGetPrincipal`
还存在 request-digest backfill 路径。

当前不存在按 public `client_id` 查询 MachineClient + MachinePrincipal
当前绑定的 read-only deterministic Route。

因此 creation-capable S1/S2 不能被当作 State F resolution API。

### 3.4 当前 HTTP cache truth

当前通用 `/api/v1/...` management response 没有由本 Spec 证明的统一
`no-store` contract；普通 authentication / authorization / not-found /
internal-error response 也不能被假定自动携带 no-store headers。

因此新鲜度必须成为本 endpoint 的显式 Contract，而不能依赖默认中间件。

## 4. New Implementation Evidence and Amendment Disposition

### 4.1 Exact evidence object

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

### 4.2 Confirmed Auth-side blocker

```text
AUTH_SERVICE_SIDE_STATE_F_PREREQUISITE =
  READ_ONLY_AUTH_CLIENT_RESOLUTION_SEAM_MISSING
```

当 credential store 已存在时，caller 需要在任何 identity mutation 之前区分：

- stored client missing；
- Client revoked / inactive；
- Client external-ref mismatch or null；
- Principal disabled / inactive；
- Principal profile mismatch。

若把当前 S1/S2 当探针，会存在先 create / claim / digest-backfill，
再报告 State F 的路径，违反：

```text
NO_DUPLICATE_IDENTITIES
FAIL_LOUD_BEFORE_MUTATION
```

### 4.3 Cross-repository authority limit

auth-service 可以冻结：

- endpoint；
- authentication；
- response projection；
- cache / freshness；
- error Wire；
- zero-write boundary；
- source disposition；
- auth-service acceptance evidence。

auth-service 不得直接改写 `dsh-agent-core` 的 accepted caller sequencing。

当前 Agent Core governing authority 仍要求先调用 S1/S2，再基于 ensure
结果和 credential store 进入 D/E/F/G。因此本 Spec 不能宣布 State F
端到端 implementability 已经关闭。

本 amendment 的准确结论：

```text
AUTH_SERVICE_READ_ONLY_RESOLUTION_CONTRACT =
  DEFINED_AT_SPEC_LEVEL

AUTH_SERVICE_SIDE_STATE_F_PREREQUISITE =
  RESOLVED_AT_SPEC_LEVEL

STATE_F_END_TO_END_IMPLEMENTABILITY =
  BLOCKED_BY_AGENT_CORE_CALLER_SPEC_ALIGNMENT

STATE_F_IMPLEMENTABILITY_BLOCKER =
  NOT_FULLY_RESOLVED
```

### 4.4 Required Agent Core in-place amendment

不得创建与既有 Agent Core credential-provisioning authority 平行的新 Spec。

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

本 PR 不修改该 Agent Core Spec 或实现。

## 5. Frozen Owner Decisions

以下 Owner 决策不得重新打开。

### D1. Legacy 直接硬切

```text
LEGACY_MIGRATION_WINDOW = NONE
LEGACY_RUNTIME_ALLOWLIST = NONE
LEGACY_COMPATIBILITY_FLAG = NONE
LEGACY_NEW_CONSUMER = FORBIDDEN
```

不保留按 Consumer、IP、Header、环境变量、路径或 Token Claim 开启 Legacy
的例外。

Consumer readiness 是生产部署 Gate，但不得成为 Cut Artifact 继续携带
Legacy runtime 的理由。

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
RESOURCE_CONSUMER_LIVE_STATUS_LOOKUP = FORBIDDEN
```

每个外部 Resource Consumer 必须使用 JWKS 本地验证 Token，并严格绑定
自己的 audience、profile 和 scope。

### D4. Minimal Auth V1 是唯一目标架构

不重新设计 V1，不引入新的 Policy Engine、Sidecar、mTLS、TPM、
Kernel Keyring 或新的 Token Broker。

### D5. Hard cut 指运行时 authority

首个实现 Child 必须删除 Legacy 路由、签发、验签、Refresh、
flat-field backfill apply 和权限 authority。

以下数据库结构可暂时作为 dead data 保留，以维持 whole-release rollback：

- `service_registrations`
- `MachineClient.allowedResources`
- `MachineClient.allowedScopes`
- Legacy role/profile 字段
- Legacy 审计记录

保留字段不得参与认证、签发、Refresh、Exchange、Resource Consumer
authorization、Grant authority 或 readiness-derived authority。物理删除由
`AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1` 管理。

## 6. Frozen State-check Boundary

### 6.1 auth-service 必须执行 live state check 的位置

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

状态检查失败不得回退 Legacy，不得通过请求体 caller identity 绕过。

### 6.2 外部 Resource Consumer 固定为 offline-JWKS-only

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

- 调用 auth-service introspection；
- 调用 `/api/v1/clients/:client_id` 或其他 management endpoint；
- 在每次资源请求中访问 auth-service 数据库；
- 把 auth-service lifecycle CLI 暴露为网络 API；
- 因无法查询 live status 而尝试 Legacy `verify-token`。

### 6.3 Access Token 撤销语义

```text
ACCESS_TOKEN_REVOCATION_MODEL = NON_REVOCABLE_UNTIL_EXP
```

V1 Access Token 一经成功签发，在签名、Claims 与时间窗口有效的前提下，
外部 Consumer 接受至 `exp`。

Principal、Client、User、Session 或 Proxy 随后 disable/revoke，不追溯
撤销已签发 Access Token；状态变化立即阻止后续 authentication、issuance、
refresh、exchange 与 auth-service management mutation。

不得新增：

- Token blacklist；
- JTI introspection；
- Resource Consumer per-request live lookup；
- backchannel revocation endpoint。

### 6.4 Provisioning resolution 不改变前述边界

`GET /api/v1/clients/:client_id` 是受 `v1ManagementAuth` 保护的
provisioning control-plane management seam。

它不：

- 接收待验证 Token；
- 返回 Token validity；
- 决定业务服务 authorization；
- 返回 Grant；
- 改变 Access Token until-`exp` 语义。

## 7. Explicit Non-goals

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
- 不在本 PR 中修改 Agent Core governing Spec 或实现。

允许且仅允许的 live read exception：

```text
AUTHENTICATED_ONLINE_MANAGEMENT_PROVISIONING_RESOLUTION
```

其精确 Contract 见 §10。

## 8. Target Runtime Surface

### 8.1 保留的公开 OAuth/JWKS/health 接口

| Method | Path | Frozen semantics |
|---|---|---|
| GET | `/api/health` | 报告服务与当前 V1 runtime identity；不得宣称 production-effective |
| GET | `/.well-known/jwks.json` | 发布 active + retained previous public verification keys |
| GET | `/oauth/authorize` | V1 Human Authorization Code initiation；PKCE S256 required |
| POST | `/oauth/authorize/authenticate` | V1 Human authentication and authorization-code issuance |
| POST | `/oauth/token` | 仅支持 V1 `authorization_code`、`refresh_token`、`client_credentials`、RFC 8693 token exchange |
| POST | `/oauth/logout` | 撤销 V1 Human Session / Refresh Family；不撤销已签发 Access Token |

### 8.2 保留的 V1 online management 接口

| Method | Path | Frozen semantics |
|---|---|---|
| POST | `/api/v1/principals` | V1 idempotent MachinePrincipal provisioning；creation/claim capable；`svc-auth` management Token required |
| POST | `/api/v1/clients` | V1 idempotent MachineClient provisioning；creation/claim capable；`svc-auth` management Token required |
| GET | `/api/v1/clients/:client_id` | Fresh, generic, read-only MachineClient + MachinePrincipal resolution by public `mc_*` client ID；zero DB writes；no-store |

### 8.3 必须删除的公开接口

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

删除后由缺失路由产生 `404`。不得返回兼容提示、迁移 Token、Redirect 或
Legacy proxy response。

## 9. Two Distinct Inspect / Resolution Seams

### 9.1 A. Operator lifecycle inspect

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
- 不注册 HTTP Route；
- 不提供给 Agent、Resource Consumer 或普通服务；
- 用于人工 inspect、secret rotation、Client revoke、Principal disable；
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
Audience-scoped Grant 摘要，因为它是 host-local trusted operator surface。

### 9.2 B. Provisioning control-plane read-only resolution

```text
ONLINE_PROVISIONING_CLIENT_RESOLUTION = REQUIRED
```

该 seam：

- 是 Auth online management API；
- 只服务 provisioning state machine 的 mutation-before-check；
- 由 authenticated `svc-auth` management Service principal 调用；
- 使用现有 `v1ManagementAuth`；
- 不解释 Agent Core 产品语义；
- 不返回 Grant；
- 不执行任何 mutation；
- 不缓存，不允许 caller 缓存。

### 9.3 两个 seam 不得合并

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

不得通过暴露 CLI、复用 lifecycle mutation、加入 query mode 或创建 generic
admin API 来模糊二者边界。

## 10. Online Provisioning Client Resolution Contract

### 10.1 Endpoint and caller authentication

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

不得新增第二套 caller identity、API key、request-body identity、
IP allowlist identity 或 shared-secret bypass。

`client_id` 不是 MachineClient row UUID。Malformed non-`mc_*` input 返回
§10.6 的 exact `400 invalid_request`，且不触发数据库 mutation。

### 10.2 Exact implementation landing

实现落点固定为：

```text
Route:   src/routes/idempotent.ts
Service: src/lib/oauth/v1/resolution.ts
Test:    tests/v1-management-resolution.test.ts
```

不得创建并行 Route、第二个 resolution service 或 alternative endpoint。

`src/lib/oauth/v1/resolution.ts` 只执行 Client-with-Principal read。它不导入、
调用或包装 `createOrGetPrincipal`、`createOrGetClient`、lifecycle mutation
或 Grant query。

### 10.3 Exact success projection

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
- `client_external_ref=null` 仍是 HTTP 200 的当前事实，不是 404 或 5xx。
- `principal_external_ref=null` 仍是 HTTP 200 的当前事实。
- Auth 不解析 external-ref prefix、Agent ID、产品名称或 ownership policy。
- Projection 字段名与 nullability 是封闭 Contract，不得自由扩展。
- HTTP 200 不表示 caller binding 匹配，也不表示可执行 mutation。

`client_external_ref=null` 的 caller 语义：

```text
AUTH_RESPONSE = 200 with null
AUTH_WRITES = 0
CALLER_CLASSIFICATION = unbound_or_mismatch
AGENT_CORE_EXPECTED_RESULT = STATE_F_FAIL_LOUD
```

该 caller classification 必须由 §4.4 的 Agent Core amendment 冻结；
auth-service 只返回事实。

### 10.4 Not found and integrity-invalid state

- Client 不存在：HTTP `404`，exact body 见 §10.6。
- Client 存在但关联 Principal row 不存在，或关系违反数据库完整性：
  HTTP `500 machine_identity_state_invalid`。
- Client / Principal status 非 active 不是 integrity failure；HTTP 200 如实返回。
- External ref null 不是 auth-service integrity failure；HTTP 200 如实返回。
- Integrity invalid 不得 create、claim、repair、rotate、revoke、disable 或
  backfill。
- Error response 不得泄露数据库详情、Secret、Token、Verifier 或 stack。

### 10.5 Freshness and cache prohibition

```text
RESOLUTION_RESPONSE_CACHE_CONTROL = no-store
RESOLUTION_RESPONSE_PRAGMA = no-cache
RESOLUTION_ETAG = NONE
RESOLUTION_LAST_MODIFIED_VALIDATOR = NONE
RESOLUTION_304_RESPONSE = FORBIDDEN
CALLER_RESOLUTION_CACHE = FORBIDDEN
FRESH_RESOLUTION_PER_PROVISIONING_OPERATION = REQUIRED
```

服务器必须在 authentication、authorization、validation、rate limiting 和
handler 执行之前，为 exact resolution path 安装 response no-store headers，
使所有结果均满足：

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
- Caller 每次 provisioning operation 都必须发出新的 Auth request。
- Caller 不得把前一 operation 的 active、revoked、disabled、missing、
  null external-ref 或 error result 用于下一 operation。
- Conditional request headers 不得使服务器绕过数据库 fresh read。

### 10.6 Exact success/error Wire Contract

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

成功 `200` 使用 §10.3 的 projection，不额外包裹 `data`、`success` 或
`message`。

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

不得用普通 `HttpError` 的 `{ "message": ... }` envelope 代替本表。

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

### 10.7 Forbidden response/read/log surfaces

Response、error、header、log 与 test snapshot 不得包含：

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

### 10.8 Zero-write invariant

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

该 GET 的 Prisma capability 只能包含 read operations。即使 Client 缺失、
revoked、Principal disabled、external-ref null/mismatch、integrity invalid、
dependency failure 或请求并发，也不得发生任何数据库写入。

允许不含 identity、Secret、Token、external-ref 的固定 operational metric；
不得用 metric 代替 zero-write assertion。

### 10.9 Mutating function isolation

Resolve path 禁止导入、调用或包装：

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

不能以“只走 fast path”为理由复用 mutating function。

## 11. Caller Comparison and Cross-repository Closure

Auth 只返回当前事实，不理解 Agent Core 产品语义。

Caller 负责比较：

```text
expected client_id
expected client_external_ref
expected principal_external_ref
expected principal_type
expected agent_id
expected owner_user_id policy
```

Auth 不得解释或生成：

```text
agentcore:v1:client:<agentId>
agentcore:v1:principal:<agentId>
```

这些 external refs 对 Auth 始终 opaque。Auth 不得自动 reconcile、创建
replacement identity 或根据 prefix 选择 policy。

### 11.1 End-to-end closure gates

Production Activation 增加：

```text
GATE_AGENT_CORE_STATE_F_SPEC_AMENDED = PASS
GATE_AGENT_CORE_RESOLUTION_CALLER_FIXED_SHA = PASS
GATE_STATE_F_NO_MUTATION_BEFORE_RESOLUTION_E2E = PASS
```

Gate 语义：

1. `GATE_AGENT_CORE_STATE_F_SPEC_AMENDED`
   - 原 accepted Agent Core credential-provisioning Spec 已原地 amendment；
   - amendment 包含 §4.4 的完整顺序与失败分类；
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

`GATE_V1_ONLINE_PROVISIONING_RESOLUTION` 只证明 Auth endpoint 本身完成，
不能替代以上三个 Gate。

## 12. Legacy Backfill Cutoff

### 12.1 Authority cutoff

```text
FLAT_FIELD_TO_V1_GRANT_MIGRATION = PRE_CUT_ONLY
POST_CUT_BACKFILL_APPLY = FORBIDDEN
POST_CUT_LEGACY_FLAT_FIELD_REPAIR = FORBIDDEN
READINESS_WRITE_AUTHORITY = NONE
```

所有从 `MachineClient.allowedResources` / `allowedScopes` 推导
`AuthAudience` 或 `MachineAccessGrant` 的写操作，必须在 Cut Artifact 部署前
完成并形成独立证据。

### 12.2 Cut Artifact 固定处置

- 删除 `scripts/backfill-minimal-auth-v1.ts`。
- 删除 root `package.json` 的 `contract:v1:backfill`。
- 删除 `scripts/repair-legacy-client-drift.ts`。
- 删除 `scripts/cleanup-evidence-repair.ts`。
- 删除 `scripts/cleanup-legacy-revoked-clients-round-1.ts`。
- 删除 `src/lib/oauth/v1/grant-migration.ts` 的 flat-field migration planner。
- 将 V1 runtime 仍需的 Audience comparison 移到
  `src/lib/oauth/v1/audience-state.ts`；不得含 Legacy fields、migration plan
  或 write path。

### 12.3 Readiness 只读边界

`scripts/check-minimal-auth-v1-readiness.ts`：

- 可读取 Legacy flat fields，只用于证明未迁移 authority 已清零；
- 可读取 V1 tables 与 frozen registry；
- 不调用 migration planner；
- 不从 Legacy fields 推导应创建的 V1 Grant；
- 不创建、更新或删除 authority；
- 不提供 `--apply`、`--repair`、`--fix`；
- 缺失/不一致时只返回失败证据和稳定分类。

Provisioning resolution 不属于 readiness，也不得读取 flat fields 或 Grants。

## 13. Authority Reconciliation

### 13.1 `v0-to-v1-migration.md` 被 supersede 的 sequencing clauses

| Source clause | Superseded meaning | Replacement |
|---|---|---|
| §7 Phase 3：`不静默删除 Legacy` | Cut Artifact 继续携带 Legacy runtime | Cut Artifact 直接删除 Legacy runtime；由 accepted Spec、Consumer Gate 与 Release Gate 授权 |
| §8：迁移窗口可存在受控双协议 | 单一 Artifact 保留 V0/V1 mode | 不存在双协议 Artifact、mode switch 或 per-request fallback |
| §8：每种模式独立遥测并设置截止日期 | runtime mode 维持兼容窗口 | Consumer 与 Legacy traffic evidence 在 PRE_CUT 完成 |
| §7 Phase 5：Legacy 流量为零后再删除 | 在携带 Legacy 代码的新 Artifact 中观察零流量 | 部署 Cut Artifact 前以旧 Artifact telemetry、inventory 与 fixed-SHA evidence 证明 |
| §6 与 1.2.0 Consumer Matrix 不一致的范围/分类 | 历史 inventory 继续作为当前 authority | 当前 Consumer Matrix 与 Production Activation fixed-SHA evidence 为 authority |

以下不被 supersede：

- V1 在 Production Activation gates 全通过前不生产生效；
- 不得仅因文档、单测或局部代码完成宣布 effective；
- 不新增 V0 Consumer；
- Wire claims compatibility 决定继续有效；
- 不允许 per-request algorithm/audience/profile fallback；
- 全部门禁通过前，V0 仍是当前生产 governing contract。

### 13.2 Production lifecycle seam

Shutdown Spec、Runtime Child、Consumer Migration PR 均不得设置：

```text
auth_token_contract_v1_production_effective = true
v0_compatibility.supersedes_v0 = true
production_deployment.status = effective
consumer_migration.status = complete
```

只有 `AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1` 在所有 Gate 通过并独立
Review PASS 后，才可更新这些字段并部署 Cut Artifact。

### 13.3 Authoritative 1.2.0 source/snapshot pin

```text
AUTHORITATIVE_CONTRACT_VERSION = 1.2.0
AUTHORITATIVE_BASE_COMMIT =
  84890120bd385b39287cb81890236b0e73e96c8d
AUTHORITATIVE_FREEZE_TRANSITION_COMMIT =
  5f401d619e2a236d7ff2ee3cd9a7e7eac84e4656
AUTHORITATIVE_REVIEWED_SOURCE_COMMIT =
  02bccd428554868125a65800f1334928c80543a2
AUTHORITATIVE_CONTRACT_BUNDLE_TREE_SHA1 =
  796a8b670f8617ab5f45c7b8734e124e07934f09
AUTHORITATIVE_CONTRACT_MANIFEST_BLOB_SHA1 =
  8557b36de241e39570f478e21a95ff375d11759a
AUTHORITATIVE_AUDIENCE_REGISTRY_BLOB_SHA1 =
  8ddf67afc2494dddc3c087d19f2f93c71db13d70
AUTHORITATIVE_SNAPSHOT_GENERATOR_BLOB_SHA1 =
  eeaee471141a0667e119779d04f87663aec8a6dd
FREEZE_RECEIPT_DIGEST_PREFIX = 3aecaa03
```

Runtime snapshot：

```text
payload = {
  formatVersion: 1,
  contractVersion: "1.2.0",
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
`sourceBundleDigest` 与 `runtimeDigest`。不得捏造缺失 digest。

## 14. Human Credential Lifecycle

### 14.1 Public registration remains removed

`POST /api/auth/register` 永久删除。本计划不提供公开注册、邀请码注册、
自助 User creation 或匿名 password reset。

### 14.2 Required Child

生产激活前必须存在 accepted、implemented、independently-reviewed：

```text
AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1
```

该 Child 必须冻结并实现：

1. Audited User creation。
2. Audited password reset，并撤销该 User 的 active HumanSession、
   RefreshFamily 与 RefreshCredential。
3. Audited User disable，并撤销全部 active Human session/refresh authority。
4. 已签发 Access Token 仍按本 Spec `exp` 语义存续。

## 15. Token Acceptance and Consumer Contract

### 15.1 Accepted profiles

| Profile | Algorithm | Required binding at auth-service operation |
|---|---|---|
| V1 Human Access | RS256 | exact issuer/audience、active User/HumanClient、valid Human grant/session flow |
| V1 Direct Agent | RS256 | active Agent Principal/Client、per-audience MachineAccessGrant、exact scope |
| V1 Direct Service | RS256 | active Service Principal/Client、no `agent_id`、per-audience MachineAccessGrant |
| V1 Delegated | RS256 | active original Agent、active TrustedProxy Service、accepted source、original grant ∩ delegation grant |
| V1 opaque Refresh Credential | opaque | active credential/session/family/user/client、serializable rotation/reuse detection |

### 15.2 Rejected unconditionally

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

### 15.3 External Resource Consumer obligations

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

`GET /api/v1/clients/:client_id` 不属于该验证链，Resource Consumer 不得调用。

## 16. Runtime and Configuration Authority

`AUTH_CONTRACT_MODE` 从 runtime design 删除。Cut Artifact 不存在：

```text
v0
v1_shadow
Legacy fallback
Legacy Route mounting
```

启动流程：

1. 从 exact pinned 1.2.0 Contract Bundle 生成 runtime snapshot。
2. 校验 source object、runtime digest、version、freeze status 与
   implementation authorization。
3. 校验 exact issuer。
4. 加载并验证 active RS256 private key、`kid` 与 retained previous keys。
5. 任一条件不满足则启动失败。

以下 Legacy variables 删除或固定拒绝：

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

## 17. Data Authority

### 17.1 Human V1 authority

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

### 17.2 Machine V1 authority

- `MachinePrincipal`
- `MachineClient` identity/status/secret-verifier fields
- `AuthAudience`
- `MachineAccessGrant`
- `TrustedProxy`
- `ProxyAcceptedSubjectAudience`
- `DelegationGrant`
- `TokenExchangeAudit`
- persistent machine lifecycle audit facts

### 17.3 Non-authoritative Legacy data

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

不读取任何 Grant、Legacy flat field、Secret verifier 或 request digest。

## 18. Exact Source Disposition Manifest

本节是首个 Runtime Child 的完整 source disposition。不得使用目录通配推断
额外删除，不得把未列文件留给实现阶段自由选择。

Disposition：

```text
KEEP
KEEP_MODIFY
DELETE
CREATE
KEEP_TEST_ONLY
KEEP_OUT_OF_RUNTIME_SCOPE
```

### 18.1 Entry, config, database and utilities

| Path | Disposition | Required result |
|---|---|---|
| `src/server.ts` | KEEP_MODIFY | 只 mount V1 Routes；无条件初始化 pinned V1；在任何 rate limiter/auth/router 之前为 exact resolution path 安装 no-store/no-cache headers |
| `src/config/env.ts` | KEEP_MODIFY | 删除 Legacy secret/mode/register authority；V1 key config fail fast |
| `src/lib/prisma.ts` | KEEP | 单一 Prisma client seam |
| `src/utils/async-handler.ts` | KEEP | async error forwarding |
| `src/utils/http-error.ts` | KEEP_MODIFY | 保留通用错误；增加 exact resolution JSON error mapping，不允许 `{message:...}` 泄漏进 resolution path |

### 18.2 Routes

| Path | Disposition | Required result |
|---|---|---|
| `src/routes/auth.ts` | DELETE | 删除全部 Legacy Human/Agent auth Routes |
| `src/routes/users.ts` | DELETE | 删除人员目录 surface |
| `src/routes/roles.ts` | DELETE | 删除在线 role surface |
| `src/routes/service-registrations.ts` | DELETE | 删除 Legacy SSO Gateway 与 verify-token |
| `src/routes/oauth.ts` | KEEP_MODIFY | 只 dispatch V1 direct/exchange；删除 V0/shadow branches |
| `src/routes/oauth-human.ts` | KEEP_MODIFY | 保留 V1 authorization_code/refresh/logout；live status 对齐 |
| `src/routes/idempotent.ts` | KEEP_MODIFY | 保留 POST provisioning；新增且仅新增 `GET /v1/clients/:client_id`；route 限制 Service principal；success/error exact Wire；不得输出 cache validator |
| `src/routes/well-known.ts` | KEEP_MODIFY | 只发布 pinned V1 public JWKS；JWKS cache policy 对齐独立 Contract |

不创建第二个 provisioning resolution Route 文件。

### 18.3 Middleware and schemas

| Path | Disposition | Required result |
|---|---|---|
| `src/middleware/auth.ts` | DELETE | 删除 HS256/shared-secret verifier |
| `src/middleware/token-rotation.ts` | DELETE | 删除 Legacy in-memory refresh state |
| `src/middleware/v1-management-auth.ts` | KEEP_MODIFY | exact `svc-auth` audience/scope；live-check actor Principal/Client；resolution auth errors映射 exact Wire |
| `src/schemas/auth.ts` | DELETE | 删除 Legacy auth request schemas |
| `src/schemas/oauth.ts` | KEEP_MODIFY | 只保留 V1 OAuth schemas 与 strict validation |

### 18.4 Shared and Legacy OAuth libraries

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

### 18.5 V1 OAuth libraries

| Path | Disposition | Required result |
|---|---|---|
| `src/lib/oauth/v1/contract.ts` | KEEP_MODIFY | 只接受 exact pinned 1.2.0 runtime object |
| `src/lib/oauth/v1/credentials.ts` | KEEP_MODIFY | V1 opaque credential only |
| `src/lib/oauth/v1/direct.ts` | KEEP_MODIFY | live status + per-audience Grant；导入 `audience-state.ts` |
| `src/lib/oauth/v1/errors.ts` | KEEP_MODIFY | exact resolution codes/status classification；500 integrity 与 503 transient 分离 |
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

### 18.6 CLI and identity modules

| Path | Disposition | Required result |
|---|---|---|
| `src/cli/machine-admin.ts` | DELETE | 删除 Legacy lifecycle/flat grant CLI |
| `src/cli/v1-machine-lifecycle.ts` | CREATE | §9.1 exact operator-only command set |
| `src/cli/agent-identity.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | 不具 Token/Grant authority |
| `src/lib/identity/config.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |
| `src/lib/identity/env-file.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |
| `src/lib/identity/resolver.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |
| `src/lib/identity/types.ts` | KEEP_OUT_OF_RUNTIME_SCOPE | Workspace identity utility |

### 18.7 Scripts

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

### 18.8 `packages/machine-token-provider`

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

Machine Token Provider 不得自动调用 provisioning resolution；它是 Token 获取
helper，不是 identity reconciliation client。

### 18.9 Root package and deployment files

| Path | Disposition | Required result |
|---|---|---|
| `package.json` | KEEP_MODIFY | 删除 Legacy scripts；新增 lifecycle 与统一 verify；纳管 provider/resolution tests |
| `package-lock.json` | KEEP_MODIFY | 与 root workspace/scripts 一致 |
| `tsconfig.json` | KEEP_MODIFY | build exact production source；不编译 deleted Legacy |
| `Dockerfile` | KEEP_MODIFY | reproducible install；build/verify pinned snapshot；V1-only image |
| `docker-compose.yml` | KEEP_MODIFY | 删除 Legacy env；只传 V1 config |
| `.dockerignore` | KEEP | 排除 secret/build outputs |
| `.gitignore` | KEEP_MODIFY | generated runtime artifact policy 与 fingerprint evidence 一致 |

### 18.10 Required new tests

| Path | Disposition | Required result |
|---|---|---|
| `tests/oauth/v1-lifecycle.test.ts` | CREATE | operator lifecycle、version conflict、one-time secret、no flat fields/issuance |
| `tests/oauth/v1-state-boundary.test.ts` | CREATE | live checks and Access Token until-exp |
| `tests/oauth/v1-readiness-readonly.test.ts` | CREATE | readiness 无 write/Grant derivation |
| `tests/oauth/v1-source-disposition.test.ts` | CREATE | deleted Legacy modules/scripts/exports absent |
| `tests/oauth/v1-runtime-fingerprint.test.ts` | CREATE | exact pinned 1.2 objects/digest |
| `tests/v1-management-resolution.test.ts` | CREATE | AC-R1..AC-R13；auth、projection、nullable refs、exact Wire、freshness、zero writes、secret absence、mutating isolation |

Cross-repository `AC-R14` evidence 不放进 auth-service unit test 假装闭环；它由
Production Activation 的 exact Agent Core fixed-SHA E2E receipt 提供。

## 19. Deployment Gates

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
GATE_V1_ONLINE_PROVISIONING_RESOLUTION = PASS

GATE_AGENT_CORE_STATE_F_SPEC_AMENDED = PASS
GATE_AGENT_CORE_RESOLUTION_CALLER_FIXED_SHA = PASS
GATE_STATE_F_NO_MUTATION_BEFORE_RESOLUTION_E2E = PASS

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

在这些 Gate 全通过前：

```text
production_deployment.status = not_ready
auth_token_contract_v1_production_effective = false
v0_compatibility.supersedes_v0 = false
```

## 20. Failure-Closed Rules

- Pinned Contract object缺失/不匹配：build/startup 失败。
- Runtime digest 不可复现/不匹配：build/startup 失败。
- Contract 未 frozen / implementation-authorized：startup 失败。
- RS256 key、`kid` 或 issuer 不符：startup 失败。
- Unknown `kid`、wrong audience/profile/token_use/version/scope：拒绝。
- auth-service operation live state check 失败：拒绝。
- Resolution actor 不是 valid active `svc-auth` Service principal：按 §10.6 拒绝。
- Resolution target missing：exact 404，零写入。
- Resolution target revoked/disabled：200 如实返回，零写入。
- Resolution external-ref null：200 如实返回，零写入。
- Resolution integrity invalid：exact 500，零写入，不修复。
- Resolution dependency unavailable：exact 503，零写入。
- 任何 resolution response：no-store/no-cache，无 ETag/304。
- Human/OBO/Lifecycle mutation required audit 无法落库：mutation fail closed。
- Legacy Endpoint：404。
- Legacy Token：401 / OAuth error，不尝试 shared-secret fallback。
- Readiness 缺失 V1 authority：失败，不生成修复计划，不写数据库。
- Agent Core caller authority未 amendment：Production Activation blocked。

## 21. Rollback Boundary

Cut Artifact 不包含：

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

该 rollback 属于 break-glass 响应，必须记录原因、时间、Artifact digest、
Operator 与恢复计划。

首个 Runtime Child 不执行 Legacy 表/列破坏性删除，以保持数据库可回滚。

## 22. Acceptance Criteria

### 22.1 Static source gates

- Production source 不存在 shared-secret JWT sign/verify。
- Production source 不存在 `AUTH_CONTRACT_MODE`。
- Production source 不存在 `token-login`、`verify-token` Route。
- Production source 不存在 flat-field runtime auth read/write。
- Production source 不存在 Legacy Refresh `Map`。
- Production source 不存在 post-cut backfill apply/repair。
- `lifecycle.ts` 不 export Token issuance/sign/verify/exchange。
- `resolution.ts` 不 import mutating identity function、Grant access 或 Prisma
  write method。
- Resolution path 不存在 response cache、ETag 或 304 implementation。
- Production credential/ID/JTI generation 不使用 `Math.random()`。

### 22.2 Legacy Route gates

以下返回 `404`：

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

### 22.3 State boundary gates

- Disabled User 不能新 authentication/code exchange/refresh。
- Revoked HumanClient 不能 code exchange/refresh。
- Disabled Principal/Revoked Client 不能获取新 Token。
- Revoked TrustedProxy 或失效 original Client 不能 Exchange。
- Revoked management actor 不能 provisioning/resolution。
- Principal disable 后，Resource Consumer 仍离线接受先前签发且未到 `exp`
  的 valid Access Token。
- 到 `exp` 后拒绝。
- Resource Consumer 不发出 live status/introspection/resolution request。

### 22.4 Operator lifecycle seam gates

- CLI Inspect 不返回 Secret Hash、Secret 或 Token。
- Rotate 只返回一次 Secret，旧 Secret 不能新 issuance。
- Revoke/Disable 阻止后续 issuance/exchange/management。
- 终态重试幂等。
- Wrong expected-version conflict 且不写。
- Audit failure 使 mutation fail。
- Lifecycle 不访问 flat fields、Grants 或 issuance。

### 22.5 Backfill cutoff gates

- `contract:v1:backfill` 不存在。
- Legacy repair/cleanup mutator 不存在。
- Readiness 只有 read methods。
- 缺失 V1 Grant 返回 nonzero，不产生 write SQL/migration plan。
- Cut Artifact 不读取 flat fields。

### 22.6 Runtime fingerprint gates

- Exact Git pins 与 1.2.0 内容一致。
- Prepare 连续两次，完整 source/runtime digest 分别一致。
- 修改 pinned byte 后 gate 失败。
- Provider digest test 不接受旧 1.1.0 digest。

### 22.7 Human session gates

- Authorization Code single use。
- Redirect URI exact match。
- PKCE S256 required。
- Concurrent refresh 只产生一个 successor。
- Refresh reuse 撤销 Family/Session。
- Logout 撤销 Family/Session。
- Password-reset/disabled User 不能 refresh。
- 已签发 Access Token 仍只按 `exp` 失效。

### 22.8 Idempotent mutating management gates

- Same external-ref + same payload resolves same identity。
- Same external-ref + different payload → 409。
- Concurrent different payload 不静默接受 winner。
- Agent shape incomplete → 400。
- Service shape with Agent fields → 400。
- Secret 只在 Client creation 返回一次。

### 22.9 Provisioning read-only resolution gates

#### AC-R1 — missing client

```text
GET unknown mc_*
→ 404 {"error":"machine_client_not_found"}
→ no-store/no-cache
→ Principal/Client row counts unchanged
→ no external-ref claim
→ no sensitive output
```

#### AC-R2 — active client

```text
→ 200 exact projection
→ exact status/external refs/Principal profile
→ no secret fields
→ identity and Grant state row-equivalent before/after
→ no-store/no-cache
```

#### AC-R3 — revoked client

```text
→ 200 exact revoked status
→ not 404
→ no restore/rotate/claim/replacement
```

#### AC-R4 — disabled principal

```text
→ 200 exact disabled status
→ no replacement/repair
```

#### AC-R5 — authorization

```text
no Token                                      → 401 invalid_client
wrong signature/issuer/audience/kid/expiry    → 401 invalid_client
wrong scope                                   → 403 insufficient_scope
non-Service management principal              → 403 insufficient_scope
svc-auth + auth.identity.provision + Service  → allowed
```

Caller identity comes only from verified Token。

#### AC-R6 — no introspection expansion

Resource Consumer Token、ordinary business Token 或 arbitrary bearer Token
不得把 endpoint 用作 per-request authorization / Token-validity Oracle。

#### AC-R7 — concurrency

并发 repeated fresh resolve：

```text
results reflect each request's DB read
DB writes = 0
duplicate identities = 0
external-ref claims = 0
```

#### AC-R8 — secret absence

Response、error、header、log 与 snapshot：

```text
raw secret absent
secretHash/verifier absent
Authorization Token absent
Refresh Credential absent
raw exception absent
```

#### AC-R9 — mutating-function isolation

Independent probe 证明没有 import/call：

```text
createOrGetPrincipal
createOrGetClient
claim/bind
rotate
revoke
disable
requestDigest backfill
Grant read/write
```

#### AC-R10 — freshness after revoke

```text
1. resolve active → 200 active
2. independently revoke Client
3. next provisioning operation sends a new GET
4. next GET reaches auth-service and returns 200 revoked
5. no cached active result, no 304
6. Auth writes = 0
```

#### AC-R11 — negative-cache prevention

```text
1. resolve missing → 404
2. independently create exact Client through authorized mutation path
3. next provisioning operation sends a new GET
4. next GET reaches auth-service and returns 200
5. no cached 404, no 304
```

#### AC-R12 — exact error Wire

逐一验证：

```text
400 invalid_request
401 invalid_client
403 insufficient_scope
404 machine_client_not_found
429 temporarily_unavailable
500 machine_identity_state_invalid
503 temporarily_unavailable
```

每项必须：

```text
Content-Type media type = application/json
body = exact {"error":"..."}
message/error_description/raw exception absent
Cache-Control = no-store
Pragma = no-cache
ETag absent
status != 304
```

#### AC-R13 — nullable Client external ref

```text
existing Client with externalRef=null
→ 200
→ "client_external_ref": null
→ no create/claim/backfill/repair
→ Auth writes = 0
→ caller contract classifies terminal State F
```

### 22.10 Cross-repository State F E2E

#### AC-R14 — no mutation before State F classification

在 exact fixed Agent Core caller commit 上，store entry exists 时：

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

该 Acceptance 由 Production Activation fixed-SHA receipt 提供；auth-service
unit test 不能冒充 cross-repository closure。

### 22.11 Repository verification command

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
10. Resolution AC-R1..R13。
11. Readiness read-only tests。
12. Negative conformance。
13. Machine Token Provider tests。
14. Migration static validation。
15. Source disposition test。
16. `git diff --check` equivalent。

AC-R14 由 activation receipt Gate 执行。

## 23. Implementation Sequence

### Child 0 — Human credential lifecycle

```text
AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1
```

冻结 audited User creation、password reset、User disable 与 Session/Family
revocation。

### Child 1 — V1-only runtime

```text
AUTH_SERVICE_V1_ONLY_RUNTIME_V1
```

仅在本 Spec accepted 并存在于 implementation base 后启动。范围严格等于
§18，包括 read-only provisioning resolution。

### Cross-repository prerequisite — Agent Core in-place amendment

在 Production Activation 前：

- 原 Agent Core credential-provisioning governing Spec 必须原地 amendment；
- caller implementation 必须基于该 accepted amendment；
- exact caller SHA 与 AC-R14 evidence 必须进入 activation receipt。

本 auth-service PR 不创建或修改该 amendment。

### Child 2 — Consumer migrations

每个真实 Resource Consumer 独立迁移：获取 V1 Token、本地 JWKS 验签、
固定 audience/profile/scope，删除 HS256 Secret、`verify-token` 与 live
status lookup。

Provisioning control plane 可以调用 §10 endpoint，但不得带入 Resource
Consumer request path。

### Child 3 — Production activation evidence

```text
AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
```

固定：

- 完整 1.2.0 source/runtime digest；
- exact HTTPS JWKS URL；
- Key Rotation；
- Consumer Matrix；
- DB readiness 与 PRE_CUT evidence；
- Human Lifecycle；
- Auth resolution；
- Agent Core amended authority、fixed caller SHA 与 AC-R14；
- deployment receipts。

独立 Review PASS 后才更新 production-effective 与 `supersedes_v0=true`。

### Child 4 — Legacy schema cleanup

```text
AUTH_SERVICE_LEGACY_SCHEMA_CLEANUP_V1
```

V1-only 生产稳定并经过保留期后，物理删除旧表、旧列、旧 Enum 与辅助结构。

## 24. Rejected Alternatives

### A. Legacy allowlist

拒绝：继续保留最弱鉴权面。

### B. 长期 `v1_shadow` 或双协议 Artifact

拒绝：PRE_CUT 完成 readiness，Cut Artifact 只有 V1。

### C. 保留 `token-login` bootstrap

拒绝：Owner 已决定删除且无 replacement。

### D. 修补 Legacy Refresh

拒绝：使用 V1 Human Session/Refresh Family。

### E. 保留 `verify-token`、introspection 或 Resource Consumer live lookup

拒绝：Resource Consumer 固定 offline-JWKS-only。§10 不是 Token Oracle。

### F. Access Token blacklist

拒绝：Access Token 按短 TTL 有效至 `exp`。

### G. Lifecycle seam 复用 Legacy `service.ts`

拒绝：Legacy module 混合 lifecycle、flat fields 与 issuance export。

### H. Post-cut readiness 自动补 Grant

拒绝：Readiness 只提供证据。

### I. Runtime Child 直接设置 production effective

拒绝：只有 Production Activation Child 可更新 lifecycle。

### J. Public registration 补 Human lifecycle

拒绝：User creation/reset/disable 必须受控并持久审计。

### K. 首轮同时 drop 所有 Legacy tables/columns

拒绝：运行时硬切不要求立即破坏 rollback。

### L. 使用 POST S1/S2 作 Client 状态探针

拒绝：create/claim/digest-backfill 副作用违反 fail-before-mutation。

### M. 暴露 operator lifecycle CLI 为 HTTP inspect

拒绝：两个 seam 的 caller、输出和 authority 不同。

### N. Auth 解释 Agent Core external-ref prefix

拒绝：external-ref 对 Auth opaque。

### O. Resolution auto-repair / identity reconciliation

拒绝：read-only seam 只返回事实。

### P. Auth Spec 单方面宣布 Agent Core State F 已关闭

拒绝：caller sequencing 由 Agent Core accepted authority 治理；必须原地
amendment 并获得 fixed-SHA E2E evidence。

### Q. Cache successful or missing resolution

拒绝：active/revoked/missing 是时变状态；任何正缓存或负缓存都会破坏
mutation-before-current-state-check。

### R. `client_external_ref=null` 返回 5xx

拒绝：当前正式数据模型允许 null/unbound 状态；纯只读 seam 应返回事实。
Caller 将其判为 mismatch/State F，Auth 不在 read path claim 或 repair。

### S. 复用普通 `{message:...}` HttpError envelope

拒绝：caller 需要可执行、稳定、无歧义的 management error Wire。

## 25. Remaining Owner Decisions

```text
OWNER_DECISION_REQUIRED = NONE
OWNER_DECISIONS_CHANGED = NO
```

保持冻结：

- Legacy 直接硬切。
- `token-login` 删除且无替代。
- `/api/services/verify-token` 删除且无 introspection。
- Resource Consumer offline-JWKS-only。
- Access Token 有效至 `exp`。
- Operator-only V1 lifecycle seam。
- Flat-field migration PRE_CUT_ONLY。
- Production-effective / `supersedes_v0` 只由 activation child 更新。
- Public registration 不恢复。
- Human Credential Lifecycle Child 是 activation blocker。

本 amendment 只关闭 Auth endpoint Contract 缺口，并明确跨仓库 caller
alignment 仍是 blocker；Owner decisions 未改变。

## 26. Completion and Authorization Definition

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

HUMAN_CREDENTIAL_LIFECYCLE = ACCEPTED_AND_AUDITED
PRODUCTION_GATES = PASS
```

本 amendment 提交后的状态：

```text
AUTH_SERVICE_READ_ONLY_RESOLUTION_CONTRACT =
  DEFINED_AT_SPEC_LEVEL

AUTH_SERVICE_SIDE_STATE_F_PREREQUISITE =
  RESOLVED_AT_SPEC_LEVEL

STATE_F_END_TO_END_IMPLEMENTABILITY =
  BLOCKED_BY_AGENT_CORE_CALLER_SPEC_ALIGNMENT

STATE_F_IMPLEMENTABILITY_BLOCKER =
  NOT_FULLY_RESOLVED

SPEC_MERGE_READY = NO
IMPLEMENTATION_AUTHORIZED = NO
AUTH_SERVICE_V1_ONLY_RUNTIME_V1_START_AUTHORIZED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
MERGE_PERFORMED = NO
```

到此停止。不得 implementation，不得修改 Agent Core，不得 deploy，不得
merge，不得宣布 Spec accepted。
