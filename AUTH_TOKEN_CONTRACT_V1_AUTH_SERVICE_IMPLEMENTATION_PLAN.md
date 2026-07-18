# Minimal Auth Foundation V1 — auth-service 实施计划

> 日期：2026-07-18
> 对象：`auth-service` 现有主线 `18b7e0bf92a1983334b49c8b5bf0081b8ddbbc0d`
> 合同：`contract-bundles/minimal-auth-v1/contract-manifest.json` `1.0.0-draft.2`

## 0. 状态和边界

```text
PLAN_COMPLETE=true
CONTRACT_BUNDLE_FROZEN=false
IMPLEMENTATION_AUTHORIZED=false
PRODUCTION_MIGRATION_AUTHORIZED=false
```

本计划把已完成的合同、Bundle 和代码盘点映射为可实施切片。实施授权只取决于
源码 Contract Bundle Freeze：

1. `metadata/freeze-gates.json` 中 `state_domain=contract_bundle_freeze` 的门全部关闭；
2. `contract-manifest.json` 改为 `frozen=true` 且 `implementation_authorized=true`；
3. 冻结对象 push 后，按远程完整 SHA 再审计；
4. 之后才允许开始下述代码切片。

生产部署和消费者迁移有独立状态，不是源码 Bundle Freeze 的前置条件。本计划不
授权生产部署、不可逆数据库清理、V0 路由删除或消费者切换。

## 1. 现状到目标的最小差距

| 对象 | 现状 | V1 最小目标 |
|---|---|---|
| Human 主体 | `users` 有产品角色，无状态 | 保留 User UUID 作为 `sub`；增加主体状态，不把产品角色签入 V1 Token |
| Machine 主体 | 仅 `agent`，`agent_id`/owner 必填 | 保留 UUID；加入 `service`；服务主体不伪装成 User/Agent |
| Client | 机器 Client 的 Audience 与 Scope 是两组全局数组 | Client 到目标 Audience 的一行授权，Scope 只属于该目标 |
| Audience | `service_registrations` 混合 SSO 与产品 Role | 独立 V1 Audience Registry；不从产品 Role 推导 Token 权限 |
| Direct | workflow 用 RS256，其余 HS256 | V1 Audience 全部 RS256；保留 `client_id/jti/nbf/token_use=access` |
| Delegated | 只支持固定 workflow；自动交集；无 Proxy 注册/持久审计 | 输入 Audience、两类 Grant 严格子集；保持 `workflow_obo` Wire；同事务审计 |
| Human | 自有 JWT access/refresh | Authorization Code + PKCE；opaque verifier；Audience Grant；最小 Human Token |
| Refresh | JWT Refresh，服务端派生 secret | verifier-only、轮换、重放撤销 family、绑定 user/session/client |
| Bundle | 仓库文件，镜像不复制 | 构建前校验冻结 Bundle，生成/复制不可变运行时快照并验证 digest |

## 2. 物理数据模型

合同不要求建立一张统一 Principal 表。为保持现有 `sub` 稳定，V1 使用两个物理主体根：`users` 和 `machine_principals`；签发器按 `principal_type` 判别查询，禁止模糊回退。

### 2.1 保留并增量修改

#### `users`

新增：

```text
status              PrincipalStatus NOT NULL DEFAULT active
updated_at          timestamptz NOT NULL
disabled_at         timestamptz NULL
```

现有 `role/internal_role/okr_role/permissions` 暂保留给 Legacy；V1 签发和 Resource 验证不读取这些字段。

#### `machine_principals`

修改：

```text
principal_type      agent | service
agent_id            agent 必填且唯一；service 必须为空
owner_user_id       agent 当前保留；service 可空
```

必须通过数据库 `CHECK` 和应用校验同时保证类型与字段一致。现有 UUID 不变。

#### `machine_clients`

保留 `client_id`、secret verifier、状态和主体外键。`allowed_resources`、`allowed_scopes` 在兼容期只供 V0 使用；V1 不读取它们。

### 2.2 新增注册与授权表

#### `auth_audiences`

```text
audience_id                 text primary key
resource_service            text not null
scope_namespace             text not null
accepted_principal_types    text[] not null
registered_scopes           text[] not null
human_access_enabled        boolean not null
machine_access_enabled      boolean not null
delegated_access_enabled    boolean not null
status                      candidate | active | disabled | retired
freeze_ready                boolean not null
version                     integer not null
created_at / updated_at
```

约束：数组非空规则、无重复、规范排序和 Scope 前缀在迁移校验器及应用层双重执行；状态/版本变更必须伴随同事务审计。

#### `human_clients`

```text
id                          uuid primary key
client_id                   text unique
client_type                 confidential_web | public_browser | native
client_authentication_method none | client_secret_basic
credential_verifier         text null
status                      active | revoked
version                     integer not null
created_at / updated_at / revoked_at
```

约束：`public_browser/native` 必须 `none` 且 verifier 为空；`confidential_web` 必须 Basic 且 verifier 非空。

#### `human_client_redirect_uris`

```text
human_client_id + redirect_uri     unique
```

只允许 exact string match；不做前缀、域名或标准化匹配。

#### `human_audience_grants`

```text
human_client_id + audience_id      primary key
version
created_at / updated_at
```

它只证明 Client 可申请该 Audience，不证明任意 User 可访问产品数据。

#### `machine_access_grants`

```text
machine_client_id + audience_id    primary key
scopes                             text[] not null
version
created_at / updated_at
```

禁止从旧的 `allowed_resources × allowed_scopes` 自动做笛卡尔积；只有单 Audience 且 Scope 归属无歧义时才允许自动 backfill，否则迁移失败并要求显式清单。

#### `trusted_proxies`

```text
id                          uuid primary key
proxy_principal_id          uuid unique
proxy_client_id             uuid unique
status                      active | revoked
version
created_at / updated_at / revoked_at
```

Proxy Principal 必须是 `service`，Client 必须属于同一 Principal。

#### `proxy_accepted_subject_audiences`

```text
trusted_proxy_id + audience_id     primary key
```

#### `delegation_grants`

```text
trusted_proxy_id + audience_id     primary key
scopes                             text[] not null
version
created_at / updated_at
```

### 2.3 Human Session 与一次性凭证

#### `authorization_transactions`

保存 client、redirect URI、Audience、state、PKCE challenge/method、服务端绑定的登录 Session 引用、`pending|authenticated|consumed|expired` 状态、created/expires/consumed 时间和 version；TTL 300 秒。

#### `authorization_codes`

```text
authorization_code_id       uuid primary key
credential_verifier         bytea/text
credential_version          text
authorization_transaction_id uuid unique
user_id / human_client_id / audience_id / redirect_uri
expires_at                  timestamptz
consumed_at                 timestamptz null
status                      active | consumed | expired
issued_at / version
```

Wire 为 `ac1.<uuid>.<43-char secret>`；数据库不保存完整 Wire；TTL 60 秒。

#### `human_sessions`

```text
id, user_id, human_client_id, token_family_id
status active | revoked | expired
absolute_expires_at
authenticated_at / last_refreshed_at
created_at / updated_at / revoked_at / revocation_reason / version
```

#### `refresh_families`

```text
id, human_session_id
status active | revoked | expired
created_at / absolute_expires_at / revoked_at / revoke_reason / version
```

#### `refresh_credentials`

```text
credential_id               uuid primary key
family_id / session_id / user_id / human_client_id
secret_verifier
verifier_parameters_version
expires_at
issued_at / rotated_at / replaced_by_id / revoked_at / reuse_detected_at
status active | rotated | revoked | expired
version
```

Wire 为 `rc1.<uuid>.<43-char secret>`；数据库不保存完整 Wire。每个 family 最多一个 active credential。

### 2.4 不可篡改审计

#### `token_exchange_audits`

持久化合同要求的 original/proxy Client 与 Principal、source/delegated JTI、source/target Audience、requested/granted Scope、时间、request ID。成功签发和审计写入必须同事务提交；审计失败则不签发。

#### `auth_security_audits`

记录 authorization code 消费、refresh rotation、refresh replay、Session/Family 撤销和失败类别。禁止保存 raw token、client secret、authorization code 或 refresh credential。

#### `grant_change_audits`

记录迁移 ID、对象类型/ID、before/after、expected/new version、执行者和时间。Grant 只通过 forward-only Prisma migration/受控脚本变更，并在同事务写审计。

## 3. 签发事务不变量

### 3.1 Direct Machine

单次数据库一致性快照读取：

1. Client 存在、secret verifier 匹配且 active；
2. Principal active，`principal_type` 与字段结构一致；
3. Audience active 且允许该主体类型和 machine profile；
4. 精确 `(client,audience)` Grant 存在；
5. 输入 Scope Wire 已规范且完整集合是 Grant 的子集；任一项不符整次拒绝；
6. 输出 Scope 等于规范排序后的请求集合，不求交集、不静默缩减；
7. 使用统一 RS256 keyring，生成 `iat/nbf/exp/jti/client_id`；
8. V1 不允许 HS256 fallback。

### 3.2 Delegated

按固定顺序完成：

1. Basic 验证 Proxy Client 和其 Service Principal 状态；
2. Trusted Proxy active 且 Client/Principal 绑定一致；
3. 离线验证 subject token 的签名、`kid/iss/aud`、Claim 形状、时间和非 OBO；
4. subject `aud` 必须存在于 Proxy accepted subject audiences；
5. 原始 Client 对 target 的 Machine Access Grant 覆盖全部 requested Scope；
6. Proxy 对 target 的 Delegation Grant 覆盖全部 requested Scope；
7. 任一项不符整次拒绝，输出 Scope 精确等于请求集合；
8. 生成保留 V0 Wire 的 `workflow_obo` Token；
9. 在数据库事务中插入 immutable exchange audit；事务成功后才返回 Token。

签名本身不能在数据库事务中造成可见副作用；若最终提交失败，生成的 JWT 必须丢弃且不得返回。

### 3.3 Authorization Code

1. `/oauth/authorize` 从服务端登录 Session 确定 User，不接受请求指定 User/另一个 Client；
2. Client、exact redirect URI、Human Audience Grant、User 状态和 PKCE S256 全部通过后创建 transaction；
3. 用户确认后生成一次性 code，数据库只存 verifier；
4. `/oauth/token` 在一个事务内锁定 code，验证 verifier、Client、redirect URI 和 PKCE 后标记 consumed；
5. 创建绑定 user/session/client 的 Human Session、Token Family 和首个 Refresh Credential；
6. 签发最小 Human Access Token，不包含产品 Role/Scope，并只在响应中展示一次 Refresh Credential。

### 3.4 Refresh Rotation 与重放

1. 解析 `credential_id` 后锁定 credential、family、session、user、client；
2. verifier、全部状态和到期条件必须通过；
3. active credential 使用后在同事务标为 rotated，创建唯一后继 credential；
4. 后继到期为 `min(now+7d, session.absolute_expires_at)`；
5. 已 rotated/revoked credential 再出现视为 replay：同事务撤销整个 family 和对应 Session，并写安全审计；不签发 Token；
6. User/Client/Session disabled/revoked/expired 时不可 refresh。

## 4. 文件与入口实施映射

### Slice A — 构建与不可变合同输入

- `package.json`：增加 `contract:v1:prepare`、V1 单测和 conformance 命令；build 先验证 frozen Bundle。
- `scripts/prepare-minimal-auth-v1.mjs`：验证 Bundle，拒绝 draft/未授权，计算 digest，生成只读运行时快照。
- `Dockerfile`：复制生成快照及 digest，不复制可变草稿目录；启动时复核 digest。
- `src/config/env.ts`：只接收部署密钥/URL等环境事实；TTL、Claim 枚举和 Scope 规则来自冻结快照。
- `src/lib/oauth/v1/contract.ts`：启动时加载一次并 fail-fast；禁止环境变量覆盖冻结语义。

### Slice B — Additive Schema

- `prisma/schema.prisma`：增加本计划第 2 节对象及关系；保留 V0 列。
- `prisma/migrations/<timestamp>_minimal_auth_v1_additive/migration.sql`：只增表/列/约束/索引。
- `scripts/backfill-minimal-auth-v1.ts`：显式映射、重复可重入、歧义 fail closed、输出数量/digest；不启用 V1。
- `scripts/check-minimal-auth-v1-readiness.ts`：检查注册、Grant、Proxy、密钥、审计和孤儿记录。

### Slice C — 共享内核

- `src/lib/oauth/v1/scope.ts`：单 ASCII 空格、无 trim/duplicate、大小写敏感、unsigned ASCII 排序、namespace 校验。
- `src/lib/oauth/v1/audience.ts`：Audience/Profile/Principal Type 和 Grant 查询。
- `src/lib/oauth/v1/keyring.ts`、`signer.ts`、`verifier.ts`：统一 RS256、`kid`、精确 issuer/audience、时间规则。
- `src/lib/oauth/v1/errors.ts`：固定 OAuth error 与 HTTP 状态；所有成功/失败响应设置 no-store/no-cache。
- `src/lib/oauth/v1/audit.ts`：结构化审计，字段 allowlist，永不记录凭证。

现有 workflow keyring 可迁移复用实现，但 V1 命名和行为不得再暗示只服务 workflow。

### Slice D — Machine Direct 与 Delegated

- `src/lib/oauth/token-issuance.ts`：保留 V0 实现；V1 分支调用 audience-bound Grant 和统一 signer。
- `src/lib/oauth/token-exchange.ts`：移除 V1 硬编码 Audience/自动交集，加入 Proxy 输入 Audience、两类 Grant 和持久审计。
- `src/routes/oauth.ts`：严格参数集合/重复参数；使用 `crypto.randomBytes` 或 UUID；错误 schema 与 Bundle 一致。
- `src/routes/well-known.ts`：发布统一 V1 public keys；不泄露私钥或 retired-before-retention keys。

### Slice E — Human 与 Refresh

- `src/routes/oauth-authorize.ts`：Authorization Code + PKCE S256；与现有服务端登录 Session 适配。
- `src/lib/oauth/v1/authorization-code.ts`：opaque code verifier、一次消费事务。
- `src/lib/oauth/v1/human-session.ts`：Session absolute TTL 和 Client/User 绑定。
- `src/lib/oauth/v1/refresh.ts`：scrypt-v1 verifier、轮换/replay/family 撤销。
- `src/routes/oauth.ts`：增加 `authorization_code` 和 `refresh_token` 分支，不启用 password/implicit。

### Slice F — 启动与 Legacy 隔离

- `src/server.ts`：删除 JWT/Refresh secret 前缀日志；启动日志输出 contract version/digest/mode，不输出机密。
- 新增 `AUTH_CONTRACT_MODE=v0|v1_shadow|v1`：
  - `v0` 保持现行 Wire；
  - `v1_shadow` 只运行 readiness/决策对比且不记录 raw 凭证、不改变签发结果；
  - `v1` 只走冻结 V1 路径，任一依赖缺失 fail closed。
- 禁止 V1 请求在失败后回退 V0/HS256。

## 5. 测试和 Conformance 门

### 5.1 每个 Slice 必过

```text
npm run contract:v1:validate
npm run build
npm run test:oauth
npm run test:lifecycle
```

保留既有 V0 compatibility、workflow RS256/JWKS/rotation/token-exchange 测试，代码变化后全部重跑。

### 5.2 新增测试组

| 测试 | 必证事实 |
|---|---|
| `contract-runtime.test.ts` | manifest/digest/镜像快照一致；draft/覆盖/缺失 fail-fast |
| `scope-wire.test.ts` | 空格、重复、大小写、排序、namespace、严格拒绝 |
| `machine-grants.test.ts` | Audience 绑定；不做旧数组笛卡尔积；无 silent downscope |
| `token-profiles-v1.test.ts` | 三种 profile 与全部正负 fixture；保留 V0 Wire |
| `delegation-v1.test.ts` | accepted source aud、两 Grant、no chain、immutable audit |
| `authorization-code.test.ts` | PKCE S256、exact redirect、一次消费、Client/Session 绑定 |
| `refresh-family.test.ts` | verifier-only、rotation、并发双用、replay 撤销 family |
| `oauth-errors-v1.test.ts` | 固定状态码、重复参数、所有响应 cache headers |
| `secret-redaction.test.ts` | 日志/审计无 secret/token/code/refresh wire |
| `migration-readiness.test.ts` | backfill 可重入、歧义失败、version/audit 同事务 |

并发测试必须用真实 PostgreSQL 事务证明 authorization code 与 refresh credential 在竞态下最多一次成功，不能只 mock Prisma。

### 5.3 真实进程 Conformance

使用 production build 和临时 PostgreSQL 启动真实进程，执行：

1. JWKS 和健康检查；
2. Direct Agent 正例、Service 对首批 Agent-only Audience 的拒绝，以及 Bundle 全部负例；
3. ADC source token 到 workflow delegated token；
4. Human authorize → code → access/refresh；
5. refresh rotation 与旧凭证 replay；
6. Client/User/Principal disable 后新签发/refresh 拒绝，已签 access 仅按离线验证直到过期；
7. retired key 在 retention 窗口仍可验证；unknown `kid` 只刷新一次；
8. 日志、数据库审计和 HTTP headers 检查；
9. 容器镜像内 contract digest 与审计 SHA 一致。

Conformance 输出机器可读 JSON，包含 commit SHA、tree SHA、bundle digest、migration version、镜像 digest、用例数量和每个失败原因；任何负例意外成功即 FAIL。

## 6. 分阶段迁移与回滚

1. **Freeze**：关闭 Contract Bundle Freeze 域的 Gate，固定首批远程 SHA，独立审阅 PASS，冻结 Bundle；生产与 Legacy 迁移门保持独立。
2. **A/B**：构建输入和 additive schema；仅迁移，不切流；数据库回滚为停止使用新表，不 drop。
3. **C/D**：V1 machine 代码与测试；`v0` 默认，随后 `v1_shadow`；观察差异但不记录 raw token。
4. **Machine Canary**：只对已批准的首批 Audience/Client 启用 `v1`；消费者先验证再切签发。
5. **E**：Human Code/Session/Refresh；先测试 Client，再逐 Client 启用。
6. **Conformance**：真实进程、容器和消费者 smoke 全部通过。
7. **Mainline Effective**：远程完整 SHA 独立审计 PASS 后，才标记 V1 supersede V0。
8. **Cleanup**：只有零使用证据、回滚窗口结束和独立批准后，才删除 V0 列、HS256、JWT refresh 和 Legacy 路由。

可逆门：代码 mode、Client/Audience enablement、签发切换。不可逆门：drop 列/表、删除旧密钥、撤销长期凭证、V0 路由删除；必须单独获批。

## 7. 已识别的实施禁止项

- 不把 `client_id` 改名为 `azp`，不改 `access/workflow_obo` 枚举，不删除 `jti/nbf`。
- 不让 Human 使用 Machine Scope 模型；不从 Product Role 生成 Token Claim。
- 不从 `allowed_resources` 与 `allowed_scopes` 自动组合授权。
- 不将严格拒绝退化成自动交集或 silent downscope。
- 不让资源服务实时查 Client/Principal 状态；签发断言与离线验证分离。
- 不在 V1 路径保留 HS256 或失败后回退 Legacy。
- 不存 raw secret、authorization code、refresh credential 或完整 JWT。
- 不在未冻结 Bundle 上开始实现，不在未审计远程完整 SHA 上合并。

## 8. 当前执行门

当前三个状态域必须独立报告：

```text
CONTRACT_BUNDLE_FREEZE=DRAFT
PRODUCTION_DEPLOYMENT=NOT_READY
CONSUMER_MIGRATION=NOT_STARTED

GATE-BUNDLE-NARROW-REVIEW=open
GATE-EXACT-JWKS-URL=open (production_deployment only)
GATE-REMOTE-CONSUMER-SHAS=deferred (legacy consumer_migration only)
GATE-LLM-TODO-AUTHORIZATION-MATRIX=deferred (legacy consumer_migration only)
```

只有独立 Bundle 审阅门仍阻止源码 Freeze。其余门不会阻止 Bundle Freeze，
但在真实生产 TLS/JWKS 外部验证或对应 Legacy 消费者迁移完成前，分别不得宣称
生产生效或消费者迁移完成。
