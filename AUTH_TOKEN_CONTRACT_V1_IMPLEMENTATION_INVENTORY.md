# Minimal Auth Foundation V1 Implementation Inventory

## 1. 状态

```text
INVENTORY_DATE=2026-07-18
STATUS=COMPLETE_WITH_PRE_FREEZE_GATES
SCOPE=read_only_file_table_entrypoint_consumer_inventory

AUTH_SERVICE_FIXED_REMOTE_SHA=true
ALL_CONSUMER_TOPOLOGY_IDENTIFIED=true
ALL_CONSUMERS_FIXED_REMOTE_SHA=false
AUDIENCE_TOPOLOGY_CORRECTION_REQUIRED=true

READY_FOR_CONTRACT_BUNDLE_DRAFT=true
READY_FOR_CONTRACT_BUNDLE_FREEZE=false
IMPLEMENTATION_AUTHORIZED=false
```

本报告只盘点当前实现，不把“代码看起来支持”解释为部署、数据、配置或迁移已经完成。盘点期间未修改任何消费者仓库。

## 2. 调查对象与证据锚点

| 对象 | 调查 SHA | Tree | 远程锚点 | 工作区说明 |
|---|---|---|---|---|
| `auth-service` | `dfcaf9899cb9756a48de04911bf61ce591c777e0` | `84646f6685128f35b5c7af10e4304b0fc6781e53` | `origin/codex/minimal-auth-v1-contract` | 仅合同文档相对 `13bde75` 变化；代码基线未变 |
| `svc-workflow` | `2dff1320d1488ff4d2137795df1622d61d01c00c` | `3fb6d70785daff0d44821a0845389df3c027e8d9` | `origin/main` | 有无关未跟踪设计文档和 env 备份 |
| `svc-okr` | `19781e46f35d10f1cd3148375752b03dd32ec1fc` | `eb39002085059db5ae4a3451fa7a68517a6462cb` | `server/fix/blank-config-bypass` | detached；有无关未跟踪报告 |
| `agent-forum/svc-forum` | `3053bc18ae53a546fed64b75180efc344f2cc5ab` | `466ddd513a55c8404c7177851f435cd4c9b1877c` | **无 remote 配置** | 本地功能分支；有无关未跟踪报告/目录 |
| `llm-todo` | `7cc746240ba15161a5350bbe4c6d8fb88f41f5c6` | `b45dc35aa7b3148a314c9d856efdb17b94387650` | **当前 SHA 不在 `server` refs** | 本地 `main` 比 `server/main=a44bcfa...` 新 |
| `adc-v2` | `ddeeab2ff394af64b78d9820c9e64d5bf0952ebd` | `6b7e69217cac99b381876e85750dea588ae501fd` | `server/main`、`canary/main` | 有一个无关未跟踪审计报告 |
| Legacy `agent-dev-center` | `a76a968dcd01fe2bbb6ea7fb39a44daf02bd1349` | `86ceddb97ef2c200fe0317b9e3eea477348c39e9` | **当前 SHA 不在远程 refs** | 仅用于 Legacy carrier 对照；目标 ADC 是独立 `adc-v2` |
| `workflow-todo` | `d405755ed259e54f9b6d9d667033758058ad6234` | `6ac1fd0d31914755ae93bc42d4cea38113e43193` | **GitHub remote 当前不可访问** | 迁移生成结果有既存修改，未触碰 |
| OpenClaw/Auth CLI 候选 | `430d5a0feecbfd2376464eeca73e28cb8b92c60b` | `163e3a0df34c4dbd4b253447de1f7bb12d31b80a` | **未推送** | `feat/adc-subject-token-transport-v0`，且 worktree 有无关 keyring 修复 |

远程 SHA 缺口不阻止完成只读盘点，但按 V1 合同，它们阻止 `CONTRACT_BUNDLE_FROZEN=true` 和消费者迁移验收。

## 3. 资源与 Client 拓扑结论

当前候选 Audience 清单不能原样冻结：

| 名称 | 实际类型 | 当前 Wire/调用方向 | Freeze 结论 |
|---|---|---|---|
| `svc-workflow` | Resource Service | 已验证 `aud=svc-workflow` | 保留 |
| `svc-okr` | Resource Service | 当前消费通用 Human Token | 注册为 `svc-okr`，迁移到 V1 Human Profile |
| `svc-forum` | Resource Service | Agent 路径已经使用 `aud=svc-forum` | 保留现有 Wire 值；不得改成仓库名 `agent-forum` |
| `llm-todo` | Resource Service | 当前消费 `aud=agent-platform` 等多协议 | 需要独立 Audience；候选名应为 `llm-todo` |
| `adc-v2` | Resource Service + Trusted Proxy ingress | 当前只接收 Bearer 后透传 | 作为 source Audience 和 Proxy 注册对象 |
| `workflow-todo` | CLI/Product Client | 直接调用 `svc-workflow` | **不是 Audience**；应绑定 Machine Client/Broker |
| `agent-forum` | Repository/Product 名 | 真正验证者是 `svc-forum` | **不是新的 Wire Audience** |

因此，`grants-and-audiences.md` 中的候选清单与示例必须在 Bundle Freeze 前修订。此修订是对真实拓扑的校正，不是新一轮 Wire 重命名。

## 4. auth-service：逐表盘点

### 4.1 当前表与 V1 差距

| 当前对象 | 当前事实 | V1 差距 |
|---|---|---|
| `User` | 包含密码、`role`、`internalRole`、`okrRole`、`permissions`；无 active/disabled 状态 | 缺 User 禁用门；产品 Role 仍由 auth-service 持有并写入 Token |
| `ServiceRegistration` | `jwtAudience` 与 `allowedRoles` 同表 | 可作为迁移输入，但不能作为 V1 Audience 注册表原样沿用；`allowedRoles` 属于产品授权 |
| `MachinePrincipal` | `PrincipalType` 只有 `agent`；有 active/disabled | 缺 `service` Principal；Proxy Principal 无法准确表达 |
| `MachineClient` | `allowedResources[]` 与全局 `allowedScopes[]` 分离 | 无 audience-scoped grant，存在跨 Audience Scope 错配空间 |

### 4.2 V1 必需但当前不存在的持久对象

```text
Audience Registry
Human Client
Human Audience Grant
Audience-scoped Machine Access Grant
Trusted Proxy Registration
Accepted Subject Audience
Delegation Grant
Persistent Exchange Audit
Human Session
Refresh Token Family
Refresh Credential verifier record
Persistent security/audit event
```

Grant 的最小持久模型必须能直接表达：

```text
HumanClient × Audience
MachineClient × Audience × Scope
ProxyClient × TargetAudience × Scope
ProxyRegistration × AcceptedSourceAudience
```

不得继续从两个彼此独立的数组推导授权。

## 5. auth-service：逐入口盘点

### 5.1 Human 登录与 Session

| 入口 | 当前行为 | V1 缺口 |
|---|---|---|
| `POST /api/auth/login` | email/password 后直接签 HS256 access + JWT refresh | 无 Human Client 证明、Session、Audience Grant；Access 默认 7 天 |
| `POST /api/auth/register` | 创建 User 后直接签 access + refresh | 同上；注册与 Session 创建未分离 |
| `POST /api/auth/token-login` | 验旧 Agent Token、可自动创建 User、签 Human 风格 Token | 将 Agent 登录混入 User/Profile；调用方可带 name/role；不满足 Machine Client 绑定 |
| `POST /api/auth/refresh` | 验 JWT refresh，以进程内 `Map<jti,expiry>` 标记用过 | 非 opaque credential；无 verifier、Session、Family、持久轮换和 family replay revoke |
| `GET /api/auth/me` | HS256/Legacy 多路径后实时查 User | 仍依赖通用 Audience 和 fallback；不是 V1 资源服务离线验证模型 |

当前 `signAccessToken()` 输出 `name/role/internalRole/okrRole`，缺 `principal_type/client_id/token_use/nbf`，并允许调用方路径选择 Audience。它不是 V1 Human Profile。

### 5.2 Machine Direct Token

`POST /oauth/token` 的 `client_credentials` 路径已有可复用基础：Basic Client Credential、scrypt verifier、Principal/Client 状态检查、精确 resource、requested scope 子集检查、10 分钟 TTL、`client_id/jti/nbf/token_use=access`。

未满足项：

- 只有 `svc-workflow` 使用 RS256；其他 Audience 回退 HS256；
- `allowedResources[]` 和 `allowedScopes[]` 未按 Audience 绑定；
- 空 Scope 会被解析为 `[]` 并可能签发空 Scope；
- Scope 输入会静默 trim、去重、压缩 whitespace，违反 V1 非规范输入拒绝；
- Scope 排序使用 JS 默认字符串排序，未由 Bundle 明确验证 unsigned ASCII byte 规则；
- Audience 未绑定 Scope Namespace 与 accepted principal types；
- 只支持 Agent Principal，不支持受控 Service Principal；
- 成功/失败审计仅写 stderr。

### 5.3 Token Exchange

当前 V0 Exchange 保留正确的 OBO Wire Claim，但行为仍是 V0：

- source 和 target 都硬编码为 `svc-workflow`；
- Proxy 只是普通 `MachineClient`，没有 Trusted Proxy 注册；
- 无 `accepted_subject_audiences`；
- Proxy direct grant 被当作 delegation grant；
- 只按 source `sub` 查 Principal，不按 source `client_id` 重验原始 Client、归属、状态和 target grant；
- requested scope 缺省为 source scopes；
- 使用 `source scope ∩ proxy allowedScopes ∩ requested` 自动交集，可能静默缩减；
- Exchange 成功后先返回 Token，审计只是 best-effort stderr，无事务一致性；
- 无持久 `source_token_jti -> delegated_token_jti` 链路。

### 5.4 JWKS、验证和管理入口

| 入口 | 当前行为 | V1 缺口 |
|---|---|---|
| `/.well-known/jwks.json` | 只发布 workflow active/previous RSA 公钥 | V1 所有 Access Token 应共享冻结的 RS256/JWKS 合同 |
| `/api/services/verify-token` | `kid` 路由 RS256，否则 secret-only HS256；实时查 User/Principal | 不是资源服务离线验证；存在算法/Legacy 双路径；继续返回产品 Role |
| `/api/services` | 管理 Audience 与 `allowedRoles` | 必须拆开 Audience 注册与产品授权；管理写入需版本、审计和并发门 |
| `machine-admin` CLI | 直接连 DB 创建/禁用 Principal、创建/轮换/撤销 Client | 无操作者身份、持久管理审计、grant 版本/并发控制；Client ID/request ID 部分使用 `Math.random` |
| server startup | 输出 JWT 与 refresh secret 前 8 字符 | 必须删除；任何 Secret 片段都不应进入日志 |

## 6. 消费者逐入口验证矩阵

### 6.1 svc-workflow

```text
accepted_issuer=auth-service
accepted_audience=svc-workflow
accepted_algorithms=jwks:RS256 | isolated_loopback_test:HS256
accepted_principal_type=agent_only
accepted_token_use=access,workflow_obo,missing_as_access
domain_authorization=PostgreSQL principal/domain/role/instance relations
legacy_fallback_in_jwks_mode=false
```

入口授权：create/transition 要 `workflow.execute`；detail/timeline/domain list/worklists 要 `workflow.read`；provisioning 要 `workflow.admin`，再叠加 direct Agent、allowlist、DB Principal/Role 条件。

正向基础较好：JWKS 模式固定 RS256/kid/issuer/audience，无 HS256 fallback；资源服务不实时查询 auth-service；领域授权与 Scope 分离。

V1 差距：

- 缺失 `token_use` 会默认 Direct；
- Direct Profile 不强制 `client_id/jti/nbf`；
- Scope 用 `split_whitespace + HashSet`，会接受重复项、前后空格和非规范 whitespace；
- 没有完整执行 `nbf <= iat`、未来 `iat`、Profile TTL 上限；
- 只允许 Agent。该限制可以保留，但 Audience Registry 必须明确，不得因 V1 新增 Service 而自动放行。

### 6.2 svc-okr

```text
accepted_issuer=AUTH_JWT_ISSUER
accepted_audience=AUTH_JWT_AUDIENCE
accepted_algorithms=HS256
accepted_principal_type=not_checked
required_identity=sub UUID
domain_authorization=authUserId + JWT okrRole
legacy_fallback=false
```

`/api/goals/**` 与 `/api/reports/**` 均进入 required auth；目标卡领域关系主要使用 `authUserId`，这是可保留的资源授权基础。

阻断项：

- 依赖 Token 中的 `okrRole`，而 V1 Human Token 明确不含产品 Role；
- 没有 RS256/JWKS、`principal_type=user`、`client_id/token_use/jti/nbf` Profile 检查；
- frontend 登录请求只有 email/password，无服务端 Human Client 绑定或 Audience 选择合同；
- `/api/advisories` 只有全局 optional auth，`POST`/`PATCH` 注释声称角色限制但代码未执行 required auth 或角色检查。

切换前必须把 OKR Role/成员关系迁到 svc-okr 本地权威，并修复 advisories 路由覆盖。

### 6.3 agent-forum / svc-forum

```text
agent_audience=svc-forum
human_audience=agent-platform
accepted_algorithms=shared-secret JWT
auth_paths=auth-service agent -> auth-service human -> ADC strict -> ADC bare verify
domain_authorization=ForumPrincipal mapping + route guards
fixed_remote_sha=false
```

全部业务 Router 使用 `authRequired`；Agent 写入口使用 `requireWriteScope()`，读入口在 Agent verifier 中要求 `forum.read`。但：

- Agent Token 仍用共享 `AUTH_JWT_SECRET`，未固定 RS256；
- `forum.read` 使用字符串 `includes()`，不是 Scope token 精确匹配；
- Scope parser 会 trim、去重和压缩 whitespace；
- Human 验证仍含 ADC 与 bare-verify fallback；
- Human Token 的 `role/permissions` 被直接带入请求上下文，Human 写入口默认绕过 Machine scope guard；
- `principal_type` 使用 `user` 兼容逻辑，但 Human 路径不强制该 Claim；
- 本地身份表可保留为领域映射，但 JIT 写入与禁用语义需纳入切换测试。

### 6.4 llm-todo

```text
current_human_audience=agent-platform
accepted_auth=local api_key + auth-service HS256 + legacy SSO JWT + ADC JWT
middleware_mode=global_optional
domain_authorization=local users/roles/assignments plus partial route guards
fixed_remote_sha=false
```

它不是单一中间件替换问题：

- `ssoAuth` 和 `tokenBinding` 默认非阻塞；
- `/api/todos` 的 `X-Todo-Client` 只判断客户端形态，浏览器直接放行，不是认证；
- Todo 的部分 PUT/DELETE/关系操作使用 `requireOwnership`，但 create/draft/template/comment 等多类写入口不统一要求认证；
- `/api/chat`、`/api/webhook`、`/api/compile` 存在未认证写入口；
- `/api/capabilities` 另有只认本地 `x-api-key` 的认证器；
- `/api/agent/sso-login` 用共享 Secret 且不校验 issuer/audience，可按 Token Role 自动创建本地 User；`/sync` 没有入口认证；
- auth-service、Legacy SSO、ADC 的失败按请求自动 fall through，违反显式模式选择。

切换门必须先冻结 `aud=llm-todo`、Human/Machine 接受范围、Todo scope namespace 和逐路由授权矩阵，再迁移本地身份键；不得先删除 API key/Legacy 路径。

### 6.5 ADC V2 Trusted Proxy

```text
current_ingress=Bearer token required syntactically
current_local_verification=none
current_downstream=passes same Bearer directly to svc-workflow
target_source_audience=adc-v2
target_audience=svc-workflow
fixed_remote_sha=true
```

当前 `/api/v2/**` 只提取 Bearer 并原样交给 `WorkflowClient`。它没有：

- 本地验证 source Token 的 issuer/audience/Profile；
- Proxy Principal/Client Credential；
- 对 auth-service Token Exchange 的调用；
- `accepted_subject_audiences` 或 delegation grant；
- delegated token 缓存/失效策略；
- subject/delegated jti 关联遥测。

V1 目标是 source Token `aud=adc-v2`，ADC 用服务端 Proxy Client 交换 `aud=svc-workflow` OBO Token。不得继续要求调用方先取得 `svc-workflow` Direct Token 再交给 ADC。

### 6.6 OpenClaw Credential Broker 与 workflow-todo

仓库中没有已合入、已推送的权威 Broker 实现。候选 `430d5a0`：

- 能从 Secret 文件/env 读取 Machine Client Credential；
- 能调用 `client_credentials` 并做本地一致性检查；
- 能阻止 redirect 和跨 origin 泄露 Subject Token；
- 但 `adc call` 当前取得 `aud=svc-workflow` Direct Token 再发给 ADC，与 V1 cross-audience Proxy 模型冲突；
- 分支基于旧 `8ca5fcb` 线，与当前 `13bde75` 主代码线分叉且未推送；
- 它是 CLI 工具，不等于具备 OS Secret Store、受信任调用映射和模型隔离的 Broker。

`workflow-todo` 当前从 `SVC_WORKFLOW_ACCESS_TOKEN` 读取长期 Bearer，直接调用 `svc-workflow`；它是 Client，不是 Audience。正式迁移应通过 Broker 按固定 `svc-workflow + workflow.*` 映射取得短期 Direct Token。其 provisioning/smoke 脚本内自签 HS256 只能保留在明确隔离测试模式。

## 7. Contract Bundle Freeze 前必须关闭的门

### Gate A：修正 Audience 拓扑

```text
agent-forum -> svc-forum (沿用现有 Wire Audience)
remove workflow-todo as resource audience
add llm-todo as actual resource audience
retain adc-v2 as source audience / proxy ingress
```

同时为每个 Audience 冻结 `scope_namespace` 和 `accepted_principal_types`。尚无真实 Scope 模型的 Human-only Audience 也必须明确其 namespace 是否仅保留、禁止 Machine grant，不能留给消费者猜测。

### Gate B：固定未锚定消费者

`svc-forum`、当前 `llm-todo`、`workflow-todo` 和 OpenClaw 候选实现没有可复核的远程完整 SHA。必须由各仓库 owner 提供/确认 remote 与审计分支，或明确从 Bundle 首批消费者中移出并保留 Legacy 状态。

### Gate C：冻结数据与 OAuth Schema

必须完成：

- Audience/Grant/Proxy/Exchange Audit 的 JSON Schema 与 DB 约束；
- Human Client 类型与登录 proof；
- Session/Refresh 表、事务与 verifier 参数；
- client_credentials 与 token-exchange 的请求/响应/错误 Schema；
- 管理写入口的操作者、并发、审计、回滚规则。

### Gate D：冻结精确运行参数

至少包括 issuer、JWKS URL、cache TTL、max stale、clock skew、三个 Access TTL、Session absolute TTL、Refresh TTL、key retention 和 error/cache headers。

## 8. 推荐实施切片

1. 先修订候选 Audience 与 Consumer Matrix，不改变任何线上 Wire。
2. 生成 Draft Contract Bundle 和 schema/fixture validator；保持 `FROZEN=false`。
3. 取得 Gate B 的远程锚点并执行 Bundle 窄审，才置 `CONTRACT_BUNDLE_FROZEN=true`。
4. auth-service 先增加新表和 V1 显式入口，不删除 V0/Legacy。
5. 先迁移 `svc-workflow` 的严格 Profile/Scope 解析，再实现 `adc-v2` cross-audience Exchange。
6. 分别迁移 `svc-okr`、`svc-forum`、`llm-todo`；Product Role 必须先落到资源服务本地权威。
7. 所有真实进程、领域授权负向、Legacy 零流量和远程精确 SHA 门通过后，V1 才 supersede V0。

## 9. 当前结论

```text
ARCHITECTURE_DIRECTION_ACCEPTED=true
REDESIGN_REQUIRED=false

PHASE_1_IMPLEMENTATION_INVENTORY_COMPLETE=true
ALL_CONSUMERS_INVENTORIED=true
ALL_CONSUMERS_FIXED_REMOTE_SHA=false

CONTRACT_BUNDLE_DRAFT_ALLOWED=true
CONTRACT_BUNDLE_FREEZE_ALLOWED=false
ISSUER_IMPLEMENTATION_ALLOWED=false
CONSUMER_MIGRATION_ALLOWED=false
```

当前最小正确动作不是写签发代码，而是依据本报告修正 Audience 拓扑、生成 Draft Bundle，并关闭远程 SHA 与精确参数门。
