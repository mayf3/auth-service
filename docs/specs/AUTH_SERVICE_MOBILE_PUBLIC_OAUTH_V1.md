---
spec_id: AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service mobile native public OAuth registration and browser login contract
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1

## 1. Goal

为 Agent Core Android Mobile 冻结一个由 `mayf3/auth-service` 直接提供的 Native
Public Client OAuth 登录合同。登录只在第一方外部系统浏览器中完成；认证结果通过
verified HTTPS App Link 回到 Mobile；Mobile 使用 Authorization Code + PKCE S256
换取现有 Human Access Token 与旋转式 Refresh Credential。

本 Spec 已在本 PR 分支由 Owner 接受，但尚未合入 `main`；本轮未执行注册、实现、
数据库变更、部署或合并：

```text
REPOSITORY = mayf3/auth-service
EXPECTED_BASE = d529bd3c28ece3967149ad793794f8dac2020276
EXECUTION_BASE_LOCK_MODE = EXACT_COMMIT
AUTHORING_STATUS_AT_START = proposed
CURRENT_SPEC_STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts
PRODUCT_CODE_CHANGE = NONE
PRISMA_CHANGE = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
MERGE_PERFORMED = NO
```

This Spec has been owner-accepted on this PR branch and becomes active repository
authority only after merge to main. No product implementation, Browser Login,
Audience/Client/Redirect/Grant registration, database mutation, production apply,
deployment, or Acceptance item has been executed. Production registration/apply
remains separately gated and is not authorized by Spec acceptance.

### 1.1 Frozen owner values

```text
LOGIN_UX = EXTERNAL_SYSTEM_BROWSER_PLUS_VERIFIED_HTTPS_APP_LINK
EMBEDDED_WEBVIEW = FORBIDDEN
NATIVE_PASSWORD_FORM = FORBIDDEN_IN_PRODUCTION

AUTH_PUBLIC_ORIGIN = https://auth.mayf3.com
AUTH_BROWSER_ENTRY = https://auth.mayf3.com/oauth/authorize/ui
OAUTH_REDIRECT_URI = https://auth.mayf3.com/mobile/callback
OAUTH_TOKEN_ENDPOINT = https://auth.mayf3.com/oauth/token
OAUTH_LOGOUT_ENDPOINT = https://auth.mayf3.com/oauth/logout

MOBILE_CLIENT_ID = agent-core-mobile-android-v1
MOBILE_CLIENT_TYPE = native
CLIENT_AUTHENTICATION_METHOD = none
CLIENT_SECRET = NONE

MOBILE_AUDIENCE = agent-core-mobile-gateway-v1
REGISTERED_SCOPES = []
HUMAN_TOKEN_SCOPE_CHANGE = NONE
HUMAN_SESSION_ID_CLAIM_CHANGE = NONE

REVOCATION_MODE = OFFLINE_ONLY
ACCESS_TOKEN_AFTER_LOGOUT = VALID_UNTIL_EXP

AUTH_UI_COOKIE_PREFIX = __Host-
AUTH_UI_COOKIE_SECURE = YES
AUTH_UI_COOKIE_HTTP_ONLY = YES
AUTH_UI_COOKIE_SAME_SITE = Lax
AUTH_UI_COOKIE_PATH = /
AUTH_UI_COOKIE_DOMAIN_ATTRIBUTE = ABSENT
AUTH_UI_COOKIE_PERSISTENT_CROSS_SESSION = NO
AUTH_UI_COOKIE_JS_READABLE = NO

AUTH_UI_CSRF_MODE = SERVER_SIDE_SYNCHRONIZER_TOKEN
CSRF_TOKEN_ENTROPY_MINIMUM = 128_BITS
CSRF_TOKEN_BOUND_TO = AUTHORIZATION_TRANSACTION_AND_BROWSER_SESSION
CSRF_TOKEN_DELIVERY = HIDDEN_FORM_FIELD
CSRF_TOKEN_COMPARISON = CONSTANT_TIME
CSRF_TOKEN_USE = SINGLE_USE
CSRF_ORIGIN_POLICY = EXACT_AUTH_PUBLIC_ORIGIN
CSRF_FAILURE_STATUS = 403
OAUTH_STATE_SUBSTITUTES_FOR_FORM_CSRF = NO

AUTH_UI_CSP_FRAME_ANCESTORS = 'none'
AUTH_UI_X_FRAME_OPTIONS = DENY
AUTH_UI_EMBEDDING = FORBIDDEN
```

## 2. Scope and non-goals

### 2.1 In scope

- 第一方浏览器登录 UI 与 verified HTTPS App Link 返回链路；
- 第一方浏览器登录 UI 的 Cookie 安全边界、credential POST CSRF 防护与
  clickjacking 防护；
- Authorization Code + PKCE S256、`state` 与 exact redirect 校验；
- Native Public Client、Human Audience、HumanAudienceGrant 的目标注册事实；
- absent/create、exact-existing/NOOP、mismatch/fail-loud 的幂等注册语义；
- 现有 Human Session、Refresh Token rotation、reuse detection 与 logout 语义；
- 旧 Access Token 在 offline-only revocation 下继续有效至 `exp` 的诚实边界；
- Mobile、Gateway、auth-service 三方信任边界与端点拓扑；
- 保持现有 Human Access Token schema、Scope 语义及 Session ID claim 不变。

### 2.2 Non-goals

本 Spec 及本轮 PR 不：

- 修改 OAuth 产品代码、测试、Prisma schema、migration、Contract Bundle、配置或部署；
- 创建真实 Audience、Human Client、Redirect URI、HumanAudienceGrant、Session 或 Token；
- 接触生产数据库或执行 production apply；
- 引入 Client Secret、client authentication、Dynamic Client Registration、Implicit Grant、
  Password Grant、Device Grant 或 embedded WebView；
- 在 Mobile 或 Gateway 建设用户名/密码表单、代理密码或保存密码；
- 让 OAuth authorize/token/logout/callback 端点经过 Gateway；
- 增加 Human Token `scope`、Session ID claim、产品 Role、在线 introspection 或秒级 Access
  Token 撤销；
- 改变任何既有 Machine/OBO Token、Audience、Grant 或消费者合同；
- merge 本 Draft PR。

## 3. Authority and dependencies

当前 architecture authority 是 `MINIMAL_AUTH_FOUNDATION_V2`。其 exact-incorporated
Human Session/Refresh、Human Audience Grant 与 Human Access Token 语义继续适用：

- Human 登录使用 Authorization Code + PKCE S256；
- Public Client 的 client authentication 为 `none`；
- Human Token 是单 Audience、无 Scope 的既有 profile；
- Refresh Credential 不是 JWT，必须轮换并检测 reuse；
- 资源服务离线验证 Access Token，撤销不追溯取消已签 Token。

本 Spec 是上述 architecture 的 bounded mobile registration/login child，不 supersede 或
amend Human Token schema。若本 Spec 与上级 authority 冲突，以 accepted 上级 authority
为准并 fail closed；不得通过实现猜测消解冲突。

## 4. Current State

- `STATE-MPO-001` — `mayf3/auth-service` authority branch `github/main` 在
  `2026-08-27T12:09:25Z` 精确位于
  `d529bd3c28ece3967149ad793794f8dac2020276`，与任务 `EXPECTED_BASE` 相同。
  Basis: `OBS-MPO-001`、`EVD-MPO-001`。
- `STATE-MPO-002` — 该 exact source base 的当前 Minimal Auth architecture 是 accepted
  `MINIMAL_AUTH_FOUNDATION_V2`；V2 exact-incorporates V1 Human Authorization Code + PKCE、
  HumanAudienceGrant、Human Token 与 Session/Refresh semantics。
  Basis: `OBS-MPO-002`、`OBS-MPO-003`、`EVD-MPO-002`。
- `STATE-MPO-003` — 本 authoring worktree 在写作前没有
  `AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1` governing Spec；Owner 提供的 mobile-specific
  browser UX、exact Client/Audience/Redirect 与 Gateway boundary 尚无 accepted child Spec。
  Basis: `OBS-MPO-004`、`OBS-MPO-005`、`CLM-MPO-001`、`EVD-MPO-003`。
- `STATE-MPO-004` — authoring-time 任务只授权 docs-only proposed Spec；未授权产品、
  Prisma、数据库、production 或 merge 操作。
  Basis: `OBS-MPO-005`、`EVD-MPO-004`。

本 Spec 不声明任何 production runtime、deployed revision 或数据库当前值；这些环境本轮
未观察、未接触。

## 5. Observations

### OBS-MPO-001 — exact authority branch base

- Subject: `mayf3/auth-service` local remote-tracking authority branch `github/main`。
- Source revision: `d529bd3c28ece3967149ad793794f8dac2020276`。
- Environment: clean task worktree and local Git object database after `git fetch github main --prune`。
- Observed at: `2026-08-27T12:09:25Z`。
- Method: `git rev-parse HEAD` and `git rev-parse github/main`。
- Result: both resolve exactly to the task `EXPECTED_BASE`。
- Provenance: this Spec authoring execution record。

### OBS-MPO-002 — current architecture identity

- Subject: repository-local authority declaration and Minimal Auth V2 frontmatter。
- Source revision: `d529bd3c28ece3967149ad793794f8dac2020276`。
- Environment: source tree。
- Observed at: `2026-08-27T12:09:25Z`。
- Method: direct inspection of `.agents/local/README.md`, `docs/specs/README.md`, and
  `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md`。
- Result: current architecture is accepted `MINIMAL_AUTH_FOUNDATION_V2`; V1 is superseded and
  retained as exact-incorporated provenance。
- Provenance: the three exact source paths above。

### OBS-MPO-003 — inherited Human OAuth semantics

- Subject: exact-incorporated Human claims/grants/session contracts at the expected base。
- Source revision: `d529bd3c28ece3967149ad793794f8dac2020276`。
- Environment: source tree。
- Observed at: `2026-08-27T12:09:25Z`。
- Method: direct inspection of `docs/contracts/minimal-auth-v1/claims-and-profiles.md`,
  `grants-and-audiences.md`, and `human-session-refresh.md`。
- Result: Human Authorization Code + PKCE S256, exact redirect, HumanAudienceGrant, no-scope
  Human Token, refresh rotation/reuse detection, logout, and Access Token validity through `exp`
  are already frozen architecture semantics。
- Provenance: the three exact source paths above。

### OBS-MPO-004 — no existing mobile governing Spec

- Subject: `docs/specs/` tree at the expected base。
- Source revision: `d529bd3c28ece3967149ad793794f8dac2020276`。
- Environment: Git source tree。
- Observed at: `2026-08-27T12:09:25Z`。
- Method: enumerate tracked `docs/specs/` paths and inspect the current index。
- Result: `AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1` does not exist; no indexed accepted Spec owns the
  exact frozen mobile Client/Audience/Redirect/browser UX package。
- Provenance: Git tree and `docs/specs/README.md` at the expected base。

### OBS-MPO-005 — Owner dispatch freezes target and execution boundary

- Subject: direct task dispatch for `认证 执行`。
- Source revision: task coordinates `mayf3/auth-service@d529bd3c28ece3967149ad793794f8dac2020276`。
- Environment: authoring session; production not contacted。
- Observed at: `2026-08-27T12:09:25Z`。
- Method: record the Owner-provided frozen values and MUST/non-goal list verbatim。
- Result: Owner requires a proposed docs-only Spec, exact UX/origin/Client/Audience/Grant/token
  semantics, Draft PR, no real registration, no product/Prisma/database/deploy change, and no merge。
- Provenance: task dispatch that initiated this authoring change。

## 6. Claims and assumptions

### CLM-MPO-001 — this request requires a new child governing Spec

- Support state: SUPPORTED
- Supported by evidence: `EVD-MPO-002`, `EVD-MPO-003`
- Contradicted by evidence: none known
- Uncertainty: none at the exact expected base; future authority movement requires re-evaluation。

### CLM-MPO-002 — frozen mobile semantics are compatible with current architecture

- Support state: SUPPORTED
- Supported by evidence: `EVD-MPO-002`, `EVD-MPO-004`
- Contradicted by evidence: none known
- Uncertainty: compatibility is bounded to the Owner values and exact base; implementation and
  production conformance remain unobserved。

### CLM-MPO-003 — docs-only authoring does not establish implementation or runtime state

- Support state: SUPPORTED
- Supported by evidence: `EVD-MPO-004`
- Contradicted by evidence: none known
- Uncertainty: none for this PR boundary。

## 7. Evidence relations

### EVD-MPO-001 — Git coordinates support exact-base State

- Source observations: `OBS-MPO-001`
- Target: `STATE-MPO-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@d529bd3c28ece3967149ad793794f8dac2020276`,
  observed `2026-08-27T12:09:25Z`
- Strength/sufficiency: strong for source authority branch identity at authoring time
- Limitations: does not describe deployment or future branch movement
- Provenance: authoring Git command record。

### EVD-MPO-002 — accepted authority supports compatibility and NEW classification

- Source observations: `OBS-MPO-002`, `OBS-MPO-003`
- Target: `STATE-MPO-002`, `CLM-MPO-001`, `CLM-MPO-002`
- Relation: SUPPORTS
- Bound coordinates: exact expected base and cited authority paths
- Strength/sufficiency: strong for inherited architecture meaning
- Limitations: does not prove future implementation or production conformance
- Provenance: cited accepted architecture and exact-incorporated modules。

### EVD-MPO-003 — absence of a mobile Spec supports NEW classification

- Source observations: `OBS-MPO-004`
- Target: `STATE-MPO-003`, `CLM-MPO-001`
- Relation: SUPPORTS
- Bound coordinates: tracked `docs/specs/` tree at the exact expected base
- Strength/sufficiency: strong for local governing-Spec inventory
- Limitations: does not classify external mobile-repository authority; this Spec only governs
  auth-service-owned obligations
- Provenance: Git tree and governing Spec index。

### EVD-MPO-004 — Owner dispatch supports the bounded proposal

- Source observations: `OBS-MPO-005`
- Target: `STATE-MPO-004`, `CLM-MPO-002`, `CLM-MPO-003`
- Relation: SUPPORTS
- Bound coordinates: this authoring task and expected base
- Strength/sufficiency: decisive for Owner-frozen choices and this execution boundary
- Limitations: Owner decision is normative input, not implementation/runtime evidence
- Provenance: direct task dispatch。

## 8. Decisions

### DEC-MPO-001 — 第一方外部系统浏览器是唯一生产登录 UX

- Decision owner: mayf3
- Decision: Mobile MUST 调用系统浏览器打开 `AUTH_BROWSER_ENTRY`；登录页面、凭证收集、
  错误展示、登录 Session 与认证提交全部由 `AUTH_PUBLIC_ORIGIN` 下的 auth-service
  第一方 UI 拥有。Embedded WebView 永久禁止；Mobile 原生密码表单在生产禁止。
- Rejected alternatives: embedded WebView；生产原生密码表单；Gateway-hosted login UI。
- Reason: 密码留在第一方认证边界，并使用可验证 HTTPS origin 与 App Link。
- Owner decision remaining: NONE。

### DEC-MPO-002 — Native Public Client 不拥有 secret

- Decision owner: mayf3
- Decision: `agent-core-mobile-android-v1` 是 `native` Public Client，认证方法为 `none`；
  安装包、Mobile 本地存储、Gateway、CI 或配置中均不得生成、分发、伪装或要求 Client
  Secret。Public Client 证明使用单次 Code、PKCE、exact redirect 与服务端绑定事实。
- Rejected alternatives: confidential Client；embedded Client Secret；Basic authentication。
- Reason: 原生应用包无法安全保管共享 secret，PKCE S256 是冻结的 Public Client 证明。
- Owner decision remaining: NONE。

### DEC-MPO-003 — Gateway 是 Human Audience，不是 OAuth front channel

- Decision owner: mayf3
- Decision: `agent-core-mobile-gateway-v1` 是 Mobile Human Access Token 的资源 Audience；
  Gateway 只接收 Bearer Access Token 并按既有 Human profile 离线验证，不代理 login、
  token exchange、refresh 或 logout，也不接触密码、Code、verifier 或 Refresh Credential。
- Rejected alternatives: Gateway OAuth BFF；Gateway token broker；Gateway password proxy。
- Reason: 保持 auth-service 认证 authority 和 Gateway 资源服务边界清晰。
- Owner decision remaining: NONE。

### DEC-MPO-004 — 保持现有 Human token schema 与 offline revocation

- Decision owner: mayf3
- Decision: 本 Spec 只新增目标 Audience/Client/Redirect/Grant 注册事实，不修改 Human
  Access Token claims；`scope` 与 Session ID 均不得新增。Logout、Session revoke 或
  Refresh reuse 只阻止未来 refresh；已签 Access Token 继续有效至自身 `exp`。
- Rejected alternatives: Human scope change；Session ID claim；online introspection；即时
  Access Token revocation 声明。
- Reason: Owner 明确冻结 `HUMAN_TOKEN_SCOPE_CHANGE=NONE`、
  `HUMAN_SESSION_ID_CLAIM_CHANGE=NONE` 与 `REVOCATION_MODE=OFFLINE_ONLY`。
- Owner decision remaining: NONE。

### DEC-MPO-005 — registration 必须 exact-idempotent、mismatch fail-loud

- Decision owner: mayf3
- Decision: Audience、Human Client、Redirect 与 HumanAudienceGrant 注册统一采用
  absent/create、exact-existing/NOOP、mismatch/fail-loud，且不得部分提交。
- Rejected alternatives: update-to-fit；overwrite upsert；silent narrowing/widening。
- Reason: 身份与授权注册不能在重跑中静默改写未知状态。
- Owner decision remaining: NONE。

### DEC-MPO-006 — Browser Login 的 Cookie、CSRF 与 framing 安全边界

- Decision owner: mayf3
- Decision: 独立审计（PR #30 review comment 5439464906）认定 Browser Login 缺少
  Cookie、CSRF 与 clickjacking 合同后，Owner 冻结三项补齐：登录/事务 Cookie 统一
  `__Host-` 前缀 + Secure + HttpOnly + SameSite=Lax + Path=/ 且无 Domain 属性；
  credential POST 使用服务端单次 synchronizer CSRF Token（绑定 authorization
  transaction 与浏览器会话、constant-time 比较、Origin 精确为
  `https://auth.mayf3.com`、失败即 403）；所有 Browser Login / Authorize HTML 响应
  输出 `Content-Security-Policy: frame-ancestors 'none'` 与
  `X-Frame-Options: DENY`。SameSite=Lax 只是 defense-in-depth；OAuth `state` 不替代
  表单 CSRF Token。Authorization Code 的显式短 TTL 上限本轮不冻结，只继承上级
  authority 的 fail-closed 过期语义（`AUTHORIZATION_CODE_TTL_EXPLICITNESS =
  FOLLOW_UP_DEBT`）。
- Rejected alternatives: 以 SameSite 作为唯一 CSRF 防护；以 OAuth `state` 兼任表单
  CSRF；double-submit cookie；按 client_id、query 或 User-Agent 放宽 framing；本轮
  顺手冻结 Code TTL 数值。
- Reason: 三项构成第一方浏览器登录的最小完整安全边界，且不改变既有 token、注册与
  撤销语义。
- Owner decision remaining: NONE。

## 9. Contracts

### CTR-MPO-001 — 第一方浏览器登录 UI

生产登录必须满足：

1. Mobile 通过外部系统浏览器打开
   `https://auth.mayf3.com/oauth/authorize/ui`；
2. UI 与全部 credential POST 仅使用 origin `https://auth.mayf3.com`；
3. UI 是 auth-service 拥有的第一方页面，不嵌入 Mobile WebView，不由 Gateway 托管或
   反向代理；
4. 用户密码只提交给 auth-service；Mobile 与 Gateway 不得读取、记录、转发或保存；
5. Mobile 不提供生产原生用户名/密码表单；
6. 登录完成仅产生绑定 transaction 的单次 Authorization Code，不把 Access Token 或
   Refresh Credential 放入 URL；
7. 所有含认证结果或错误的响应使用 `Cache-Control: no-store`，不得记录密码、Code、
   verifier、Refresh Credential、Access Token、CSRF Token 或 Cookie 值；
8. Browser Login 安全边界冻结为：

```text
COOKIE_SECURITY = Secure + HttpOnly + SameSite=Lax + __Host- + Path=/ + no Domain
FORM_CSRF = server-side synchronizer token + exact Origin
CLICKJACKING = CSP frame-ancestors 'none' + X-Frame-Options DENY
```

第 8 项的 Cookie 边界：

- 所有承载浏览器登录会话或授权事务身份的 Cookie 必须使用 `__Host-` 前缀、必须
  Secure、必须 HttpOnly、必须 SameSite=Lax、Path=/，且不得包含 Domain 属性；
- 不得使用可被 JavaScript 读取的登录/事务 Cookie；Cookie 生命周期不得超过其
  Human Session 或授权事务的所有者生命周期；授权事务终止、过期或成功完成后必须
  失效；
- 不得把 authorization code、PKCE verifier、Access Token、Refresh Credential 或密码
  放进 Cookie；Cookie 内容不得写日志；
- Cookie 不得由 Mobile 或 Gateway 创建、读取或代理；SameSite=Lax 只是
  defense-in-depth，不得被当作 credential POST 唯一的 CSRF 防护。

第 8 项的 credential POST CSRF 防护：

- `/oauth/authorize/ui` 渲染的 credential form 必须获得服务端生成的高熵 CSRF Token
  （熵不低于 `CSRF_TOKEN_ENTROPY_MINIMUM`），服务端状态绑定当前 authorization
  transaction 与当前浏览器会话；
- Token 只能通过表单隐藏字段提交，不得放进 URL、Referer、日志或持久浏览器历史；
- credential POST 必须同时验证：Token 存在且原始请求中恰好出现一次；未过期；未
  使用；与 transaction 和浏览器会话匹配；Origin 精确为
  `https://auth.mayf3.com`；比较必须 constant-time；
- 缺失、重复、错误、过期、重放或 Origin 不匹配时立即返回 403：不执行密码验证、
  不创建 Human Session、不生成 authorization code、不改变 Redirect、Client、
  Audience 或 Grant；
- 每次被接受处理的表单 POST 后该 CSRF Token 必须失效；登录凭据错误后重新展示
  表单必须签发全新 CSRF Token；
- OAuth `state` 继续保护 App callback 绑定，但不得替代 Browser credential POST 的
  CSRF Token。

第 8 项的 clickjacking 防护：

- 所有 Browser Login / Authorize HTML 响应必须至少包含
  `Content-Security-Policy: frame-ancestors 'none'` 与 `X-Frame-Options: DENY`；
- 登录页不得在 iframe、frame、object 或 embed 中运行；任何允许 Mobile 内嵌
  WebView 的配置均被禁止；
- 不得按 User-Agent、query 参数或 client_id 放宽 framing；错误页面与登录成功
  中间页也必须保持相同 framing 防护；既有 `Cache-Control: no-store`、Referrer 与
  日志秘密边界保持。

### CTR-MPO-002 — Authorization request 与 PKCE S256

Mobile 每次登录必须生成新的：

```text
state = cryptographically random, unguessable, single-attempt value
code_verifier = RFC 7636 high-entropy value held only by Mobile
code_challenge = BASE64URL(SHA256(ASCII(code_verifier))) without padding
code_challenge_method = S256
response_type = code
client_id = agent-core-mobile-android-v1
redirect_uri = https://auth.mayf3.com/mobile/callback
audience = agent-core-mobile-gateway-v1
```

`plain`、缺失 PKCE、复用 verifier、降级方法或服务端生成后回传 verifier 均必须拒绝。
Authorization Transaction 必须服务端绑定 Client、Audience、exact Redirect URI、state
和 S256 challenge；用户认证提交不得重新指定或覆盖这些值。

### CTR-MPO-003 — state 与 exact redirect 校验

- `state` 必填，auth-service 必须原样绑定和返回，不得规范化、截断或重写；
- Mobile 必须在接受 callback 前常量时间比较返回 `state` 与本次登录保存值；缺失、失配、
  重放或属于其他 attempt 时终止流程，不交换 Code；
- 注册 Redirect 集合精确且只有
  `https://auth.mayf3.com/mobile/callback`；
- authorize 与 token exchange 均按 exact string 校验 Redirect URI；不得接受 scheme、host、
  port、path、case、trailing slash、query 或 fragment 的任何变体；
- Redirect URI 不得使用 wildcard、custom scheme、localhost、HTTP 或调用方提供的 fallback；
- Authorization Code 必须绑定原 Client、Audience、Redirect URI 与 PKCE challenge，单次
  原子消费；任一不匹配、过期或重放均 fail closed，且不得创建 Session 或签发 Token。

### CTR-MPO-004 — verified HTTPS App Link callback

`https://auth.mayf3.com/mobile/callback` 是唯一 OAuth Redirect URI，并必须配置为 Android
verified HTTPS App Link。Mobile 只有在操作系统完成 domain verification 后才可把该链接
作为登录回跳处理；不得以 embedded WebView、未验证 deep link 或 custom URI scheme
替代。

Callback 只携带 Authorization Code、`state` 或 OAuth error。它不得携带用户密码、
Access Token 或 Refresh Credential。若 App Link 未验证、没有匹配的本地 login attempt、
`state` 失败或 Mobile 不可用，流程必须明确失败，不得把 Code 展示给用户或交给 Gateway。

### CTR-MPO-005 — Native Public Client exact target

目标 Human Client 注册事实冻结为：

```yaml
client_id: agent-core-mobile-android-v1
client_type: native
client_authentication_method: none
credential_verifier: null
status: active
redirect_uris:
  - https://auth.mayf3.com/mobile/callback
```

`CLIENT_SECRET = NONE` 是不变量，而不是待部署 secret。不得存在第二个 Redirect URI、
credential verifier、Basic auth、Mobile attestation 冒充 Client Secret，或由请求动态添加
Redirect 的行为。

### CTR-MPO-006 — Human Audience exact target

目标 Audience 注册事实冻结为：

```yaml
audience_id: agent-core-mobile-gateway-v1
resource_service: agent-core-mobile-gateway-v1
scope_namespace: agent-core-mobile-gateway
accepted_principal_types:
  - user
human_access_enabled: true
machine_access_enabled: false
delegated_access_enabled: false
registered_scopes: []
status: active
freeze_ready: true
```

该 Audience 只接受 `principal_type=user` 的既有 Human Access Token。空
`registered_scopes` 是精确值；不得增加 Scope、wildcard、Machine access 或 Delegated
access。`scope_namespace` 仅满足 registry 的结构字段，不授权任何 Scope。

### CTR-MPO-007 — HumanAudienceGrant exact target

必须存在且只存在下列授权关系：

```yaml
human_client_id: <server row id whose client_id is agent-core-mobile-android-v1>
audience_id: agent-core-mobile-gateway-v1
```

该 HumanAudienceGrant 只允许上述 Human Client 为已认证 User Session 申请该单一
Audience 的无 Scope Human Access Token。它不产生 MachineAccessGrant、DelegationGrant、
产品角色、Gateway 业务权限或其他 Audience 授权。

### CTR-MPO-008 — 幂等注册与 fail-loud

未来注册实现必须在单一事务/等价原子边界内处理 CTR-MPO-005 至 CTR-MPO-007 的完整
目标，并对每个 Audience、Human Client、Redirect 与 HumanAudienceGrant 执行：

```text
absent         -> create exact target
exact existing -> NOOP
mismatch       -> fail loud, write nothing
```

“exact existing”要求所有冻结字段和集合逐字段精确相等；集合比较不得通过忽略额外项把
superset 当作相等。“mismatch”包括但不限于同 ID 不同类型、认证方法、credential、状态、
redirect 集合、Audience flags、principal types、namespace、registered scopes 或 Grant
关系。

禁止 update-to-fit、upsert overwrite、silent narrowing/widening、删除未知行、创建第二行或
部分提交。Mismatch 必须返回稳定的非零失败，指出对象类别与失配字段但不得泄露 secret
或 token。exact rerun 必须是数据库 NOOP；不得更新时间戳、版本或重复审计事实。

### CTR-MPO-009 — Token exchange 与端点拓扑

Mobile 直接向 `https://auth.mayf3.com/oauth/token` 提交 Authorization Code exchange：

```text
grant_type = authorization_code
code = <single-use code>
redirect_uri = https://auth.mayf3.com/mobile/callback
client_id = agent-core-mobile-android-v1
code_verifier = <original verifier>
client authentication = none
```

Token、refresh 与 logout 请求不得经过 Gateway。Gateway 不得成为 OAuth BFF、token
broker 或 credential relay。auth-service 必须在签发前验证 active User、active Client、
active Audience、exact HumanAudienceGrant、exact redirect、Code 单次消费及 PKCE S256。

### CTR-MPO-010 — Human Token schema 不变

签发的 Access Token 必须继续使用既有 Human profile：单 string `aud` 为
`agent-core-mobile-gateway-v1`，`principal_type=user`，服务端绑定
`client_id=agent-core-mobile-android-v1`，`token_use=access`，并保持既有 `iss`、`sub`、
`type`、`version`、`jti`、`iat`、`nbf`、`exp` 语义。

明确禁止新增：

```text
scope
session_id / sid
act
azp
agent_id
role / internalRole / okrRole
任何产品角色或资源权限 claim
```

因此：

```text
HUMAN_TOKEN_SCOPE_CHANGE = NONE
HUMAN_SESSION_ID_CLAIM_CHANGE = NONE
```

### CTR-MPO-011 — Refresh Token rotation

Authorization Code 成功交换后，auth-service 按现有 Human Session 合同创建 Session、
Refresh Family 与首个 opaque Refresh Credential。每次成功 refresh 必须原子地：验证
active User/Client/Session/Family 与 exact Audience Grant，标记旧 credential rotated，
在同一 family 创建一个新 credential，签发新 Human Access Token，并只返回一次新
credential。

任一步骤失败都不得留下两个 active Refresh Credentials 或返回新 Access Token。Refresh
Credential 只由 Mobile 持有并直接提交 auth-service；Gateway 不得接收或保存。

### CTR-MPO-012 — Refresh reuse detection

任何 rotated、revoked 或已使用 Refresh Credential 再次出现时，auth-service 必须将其
视为可能泄露，并原子地：

1. 撤销同一 Refresh Family 的全部 credentials；
2. 撤销对应 Human Session；
3. 阻止该 Family 的所有后续 refresh；
4. 写入高优先级安全审计事件；
5. 返回不泄露内部状态的通用认证失败。

并发使用同一 active Refresh Credential 最多一次成功；其他 attempt 按 reuse/fail-closed
语义处理。

### CTR-MPO-013 — logout 与诚实撤销语义

Mobile 直接调用 `https://auth.mayf3.com/oauth/logout`。Logout 必须至少撤销当前 Human
Session 与其 Refresh Family，并使所有后续 refresh 失败。它不得经过 Gateway，也不得
依赖 Gateway session 才成立。

本版本撤销模式固定为 offline-only：

```text
REVOCATION_MODE = OFFLINE_ONLY
ACCESS_TOKEN_AFTER_LOGOUT = VALID_UNTIL_EXP
```

因此 logout、User/Client disable、Session revoke/expiry 或 Refresh reuse detection 均不
保证即时取消已经签发的 Access Token。Gateway 在无独立在线撤销合同的情况下继续离线
验签，旧 Access Token 最迟在其 `exp` 失效。UI、API 与文档不得声称“立即使所有 Access
Token 失效”。

### CTR-MPO-014 — Password 与网络边界

- 用户密码只允许从第一方浏览器 UI 经 TLS 发送到 `AUTH_PUBLIC_ORIGIN`；
- Mobile 不得获取密码 DOM、注入脚本、拦截表单、记录键入或接收 password callback；
- Gateway 不得提供 login/password proxy、接收 password、Code、PKCE verifier、Refresh
  Credential，或调用 OAuth endpoint 代替 Mobile；
- OAuth browser entry、authorize transaction、callback、token、refresh 与 logout 全部是
  auth-service direct endpoints，不经过 Gateway；
- Gateway 唯一 OAuth-related input 是请求业务 API 时的 Human Bearer Access Token。

### CTR-MPO-015 — 统一 failure semantics

以下任一条件 MUST fail closed，且不得签发 Token、创建 Session 或部分注册：

- WebView、原生密码表单、非第一方 login origin 或 Gateway-proxied OAuth；
- 非 S256 PKCE、缺失/失配 verifier、Code replay；
- 缺失/失配/replayed `state`；
- Redirect URI 非 exact registered string，或 App Link 未验证；
- Client type/authentication method/secret 与 frozen target 不符；
- Audience 未注册、非 active、允许非 user principal、包含任何 registered scope；
- HumanAudienceGrant 缺失或指向其他 Client/Audience；
- 幂等注册发现任何 mismatch；
- Refresh Credential 无效、过期、rotated、revoked 或 reused；
- 实现试图改变 Human Token schema、添加 `scope`/Session ID claim 或实现在线撤销暗示。

错误不得回显密码、Code、verifier、Refresh Credential、Access Token、数据库标识关系或
Family 内部状态。

## 10. Acceptance

以下均是未来 implementation/conformance 的要求，不是本 owner-accepted docs-only PR
已执行的 runtime evidence；所有 Acceptance items 仍未执行。

### ACC-MPO-001 — Browser UX and credential boundary

- Contracts: `CTR-MPO-001`, `CTR-MPO-004`, `CTR-MPO-014`
- Method: Android integration test plus auth-service/Gateway request and secret-log audit;
  cookie attribute and JavaScript readability probe; scripted credential POST matrix over
  missing, wrong, duplicated, expired, replayed, cross-transaction and cross-session CSRF
  tokens with exact and non-exact Origin values; framing-header capture for login, error
  and intermediate pages
- Environment: non-production environment with verified `auth.mayf3.com` App Link configuration
- Required evidence: implementation commits, OS domain-verification result, browser trace, direct
  auth-service request trace, Gateway negative trace, Set-Cookie attribute dump, per-case
  CSRF/Origin request-response records with post-request transaction/session state, response
  headers of every Browser Login HTML page, and redacted log/storage scan
- Expected result: system browser + verified HTTPS App Link succeeds; WebView, native password form,
  unverified/custom link and Gateway-proxied OAuth all fail; password reaches auth-service only.
  Browser security sub-cases (future conformance requirements, not executed in this PR):
  1. every login- or transaction-scoped Cookie is set with `Secure`, `HttpOnly`,
     `SameSite=Lax`, `Path=/`, no `Domain` attribute, and an `__Host-` prefixed name;
  2. page JavaScript cannot read any login/transaction Cookie;
  3. after transaction termination, completion or expiry, the Cookie and its server-side
     state cannot continue the flow;
  4. no password, authorization code, verifier, Access Token or Refresh Credential is
     stored in any Cookie;
  5. a correct CSRF Token with exact Origin `https://auth.mayf3.com` proceeds into
     authentication;
  6. missing Token returns 403 with zero Session and zero authorization code;
  7. wrong Token returns 403 with zero Session and zero code;
  8. a duplicated Token field in the raw request returns 403;
  9. an expired Token returns 403;
  10. replay of an already-used Token returns 403;
  11. a Token bound to another authorization transaction returns 403;
  12. a Token bound to another browser session returns 403;
  13. a missing Origin, or any Origin other than exact `https://auth.mayf3.com`,
      returns 403;
  14. a correct OAuth `state` with a wrong form CSRF Token still returns 403, proving
      `state` does not substitute for form CSRF;
  15. the form re-rendered after wrong credentials uses a fresh CSRF Token and the old
      Token is refused;
  16. login, error and intermediate pages all return
      `Content-Security-Policy: frame-ancestors 'none'` plus `X-Frame-Options: DENY`;
  17. no code path relaxes framing by client_id, query parameter or User-Agent;
  18. Cookie values, CSRF Tokens, passwords, authorization codes, verifiers and Access
      Tokens never appear in logs or error responses.
- Failure condition: any password/Code/verifier/Refresh Credential exposure to Mobile UI or Gateway,
  or any OAuth route through Gateway, fails acceptance; any missing Cookie attribute,
  JavaScript-readable login/transaction Cookie, Cookie still usable after transaction end,
  secret stored in a Cookie, any CSRF case (missing, duplicated, wrong, expired, replayed,
  cross-transaction, cross-session, or non-exact Origin) that reaches password verification,
  creates a Session or mints an authorization code, any missing or relaxed framing header on
  any Browser Login HTML page, or any disclosure of Cookie values or CSRF Tokens in logs or
  errors also fails acceptance

### ACC-MPO-002 — PKCE, state and exact redirect

- Contracts: `CTR-MPO-002`, `CTR-MPO-003`
- Method: real-process positive flow and parameterized negative/replay tests
- Environment: isolated auth-service with exact target registration
- Required evidence: executed command, exact commits/config, request/response records and database
  transaction outcome
- Expected result: only S256 + matching verifier + exact state + exact Redirect consumes one Code
- Failure condition: plain/missing/wrong/reused verifier, missing/mismatched/replayed state, any URI
  variation or Code replay creates a Session or Token

### ACC-MPO-003 — Native Public Client identity

- Contracts: `CTR-MPO-005`
- Method: registry/database projection plus token-endpoint negative authentication tests
- Environment: isolated database and real auth-service process
- Required evidence: exact Client/Redirect projection and executed requests with no auth, Basic auth,
  fake secret and alternate Redirect
- Expected result: exact native/none/no-secret/one-Redirect target works without client secret
- Failure condition: any secret/verifier is stored for the Client, Basic auth is required/accepted, or
  any additional Redirect is accepted

### ACC-MPO-004 — Human Audience and Grant

- Contracts: `CTR-MPO-006`, `CTR-MPO-007`
- Method: exact database projection and positive/negative Human issuance tests
- Environment: isolated database and real issuer/resource verifier
- Required evidence: Audience/Grant rows, Human Token claims, and missing/mismatched Grant and
  non-user principal rejection traces
- Expected result: only the exact Client/User Session receives a no-scope token for the exact Audience
- Failure condition: any scope, machine/delegated path, other Client/Audience, or missing Grant mints
  an Access Token

### ACC-MPO-005 — Idempotent registration

- Contracts: `CTR-MPO-008`
- Method: run registration against absent, exact-existing, every-field-mismatch, extra-set-member,
  concurrent and injected-failure fixtures
- Environment: disposable PostgreSQL with real registration process
- Required evidence: before/after rows and versions/timestamps, exit status, transaction/audit result,
  and exact implementation commit
- Expected result: absent creates exact target; exact rerun is database NOOP; each mismatch fails loud
  with zero writes; concurrent/failure paths never partially commit
- Failure condition: update-to-fit, overwrite, partial write, timestamp/version churn on NOOP, or
  superset accepted as exact

### ACC-MPO-006 — Direct token topology and unchanged claims

- Contracts: `CTR-MPO-009`, `CTR-MPO-010`, `CTR-MPO-014`
- Method: end-to-end Code exchange and Gateway claim-verification/network-call audit
- Environment: isolated auth-service + candidate Gateway + Mobile test client
- Required evidence: direct network trace, decoded claim-name set, issuer/verifier results, and Gateway
  outbound-call audit
- Expected result: Mobile calls auth-service directly; Gateway receives only the existing no-scope
  Human Bearer profile and makes no OAuth credential calls
- Failure condition: Gateway handles any OAuth credential flow, or token adds `scope`, Session ID,
  product Role or another forbidden claim

### ACC-MPO-007 — Refresh rotation and reuse

- Contracts: `CTR-MPO-011`, `CTR-MPO-012`
- Method: real-process sequential and concurrent refresh tests with transaction-state inspection
- Environment: isolated auth-service and disposable PostgreSQL
- Required evidence: credential/family/session state transitions, security audit events, responses and
  exact implementation commit
- Expected result: each success rotates once; concurrent use has at most one success; old credential
  reuse revokes the full family and Session and all later refreshes fail
- Failure condition: two active credentials, two concurrent successes, reuse without family/session
  revocation, or a Token returned after transaction failure

### ACC-MPO-008 — Logout and honest Access Token lifetime

- Contracts: `CTR-MPO-013`
- Method: issue Token, logout, retry refresh, then verify the old Token offline before and after `exp`
- Environment: isolated auth-service and Gateway verifier with no introspection
- Required evidence: logout response, Session/Family state, refresh rejection, offline verification
  results and UI/API wording capture
- Expected result: refresh is revoked immediately; old Access Token remains valid before `exp` and is
  rejected after `exp`; no surface claims immediate Access Token revocation
- Failure condition: refresh remains possible, pre-`exp` Token is claimed to be centrally revoked, or
  post-`exp` Token is accepted

### ACC-MPO-009 — Unified fail-closed behavior

- Contracts: `CTR-MPO-015`
- Method: aggregate all negative fixtures from ACC-MPO-001 through ACC-MPO-008 and secret/error scan
- Environment: same pinned candidate environment as the future conformance review
- Required evidence: per-case response/state result, no-write proof where applicable, and redacted
  logs/errors
- Expected result: every listed invalid condition fails closed with no sensitive value disclosure
- Failure condition: any invalid condition creates registration/session/token state or leaks a secret,
  credential, token, internal family state or database relationship

## 11. Alternatives and disposition

- `ALT-MPO-001` — Embedded WebView login. Rejected by `DEC-MPO-001`: violates the frozen external
  system browser and password boundary.
- `ALT-MPO-002` — Native production password form. Rejected by `DEC-MPO-001`: Mobile must not
  receive user passwords.
- `ALT-MPO-003` — Confidential native Client with embedded secret. Rejected by `DEC-MPO-002`:
  installed applications cannot keep a shared secret confidential.
- `ALT-MPO-004` — Gateway OAuth BFF/token broker. Rejected by `DEC-MPO-003`: OAuth endpoints and
  credentials remain direct auth-service concerns.
- `ALT-MPO-005` — Human Scope or Session ID claim. Rejected by `DEC-MPO-004`: existing Human token
  schema is unchanged.
- `ALT-MPO-006` — Online introspection/immediate Access Token revocation. Rejected by
  `DEC-MPO-004`: revocation remains offline-only and valid-until-`exp`.
- `ALT-MPO-007` — Registration upsert/update-to-fit. Rejected by `DEC-MPO-005`: mismatch must fail
  loud without mutation.

Investigation disposition: `NEW`. No existing accepted governing Spec owns this exact mobile-specific
registration and browser UX package; no existing authority is superseded or amended.

## 12. Migration, compatibility, and rollback

- Migration state in this PR: `NOT_STARTED`; no database, registry, Client, Redirect or Grant mutation。
- Compatibility: existing Human Token schema and Session/Refresh contracts are preserved; Machine,
  OBO and existing Audience/Grant behavior has semantic delta `NONE`。
- Activation order for future separately authorized work MUST be: accepted Spec present in base →
  exact implementation/conformance → independently authorized registration/apply → consumer
  activation. Spec acceptance or source merge alone MUST NOT imply production effectiveness。
- Because Mobile/Gateway are separately owned implementation surfaces, their candidate revisions MUST
  independently encode the consumer-side constraints and be pinned in activation evidence. This local
  Spec governs auth-service behavior and may set interoperability/activation prerequisites; it does not
  amend authority owned by another repository。
- Registration rollback MUST NOT delete or rewrite data merely because deployment fails. Any removal,
  disablement or replacement of the Audience/Client/Redirect/Grant requires a separately authorized,
  auditable forward operation with explicit effect on active Sessions/Refresh Families. Unknown
  outcome MUST halt retry until exact database state is re-read; only absent/exact/mismatch rules may
  decide the next action。
- Access Tokens issued before any future disable/rollback remain valid until `exp` under
  `REVOCATION_MODE=OFFLINE_ONLY`。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Non-normative future work remains: choose implementation file closure, implementation mechanism,
an explicit short upper bound for Authorization Code lifetime (this amendment keeps
`AUTHORIZATION_CODE_TTL_CHANGE = NONE` and inherits only the governing authority chain's
fail-closed expiry semantics, so `AUTHORIZATION_CODE_TTL_EXPLICITNESS = FOLLOW_UP_DEBT`),
production migration identifiers, operator/approval references, deployment coordinates and exact
consumer candidate revisions. None may change the Decisions or Contracts above without a new
reviewed authority change。

## 14. Final execution record

```text
TASK_NAME = 认证 执行
TASK_TYPE = 执行
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1
SPEC_KIND = implementation
AUTHORING_STATUS_AT_START = proposed
CURRENT_SPEC_STATUS = accepted
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
EXTERNAL_AUTHORITIES = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 15
CONTRACTS_WITH_ACCEPTANCE = 15
AUTHORING_READY_FOR_REVIEW = YES

DELIVERABLE = docs-only owner-accepted Spec candidate
PRODUCT_CODE_CHANGE = NONE
PRISMA_CHANGE = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
REAL_AUDIENCE_CREATED = NO
REAL_CLIENT_CREATED = NO
REAL_REDIRECT_CREATED = NO
REAL_GRANT_CREATED = NO
MERGE_PERFORMED = NO

AMENDMENT_ID = AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1_BROWSER_SECURITY_CLOSURE_V2
AMENDMENT_PREVIOUS_HEAD = 91f550acdc757093215d666b352b782811bd58c3
AMENDMENT_REVIEW_COMMENT_ID = 5439464906
AMENDMENT_SCOPE = CTR-MPO-001 + ACC-MPO-001 browser security closure only
AUTHORIZATION_CODE_TTL_CHANGE = NONE
AUTHORIZATION_CODE_TTL_EXPLICITNESS = FOLLOW_UP_DEBT

NEXT_TASK = 采纳 审计
```
