# Minimal Auth V1 Conformance

## 1. 状态

```text
STATUS=DRAFT_V1_MODULE
CONTRACT_VERSION=1.0.0-draft.2
REAL_PROCESS_REQUIRED=true
FIXTURE_ONLY_ACCEPTANCE=false
DOMAIN_AUTHORIZATION_PROOF_REQUIRED=true
```

本模块定义 V1 Contract Bundle 的最小机器可执行验证。单元测试、解码样例或单服务 smoke 不能替代真实进程 Conformance。

## 2. Contract Bundle 必需物

正式 Bundle 至少包含：

```text
contract-manifest.json
audience-registry.json
token-profile schemas
grant schemas
trusted-proxy schema
exchange-audit schema
OAuth request/response schemas
JWKS fixture and cache rules
positive token fixtures
negative token fixtures
consumer verification matrix
conformance runner
change log
```

所有 Artifact 必须版本化、内容寻址或可由固定远程 SHA 重建。

## 3. Contract Manifest

Manifest 至少冻结：

```text
design_id
contract_version
exact_issuer
audience_registry_version
signing_algorithm=RS256
jwks_path
jwks_cache_ttl_seconds
jwks_max_stale_seconds
clock_skew_tolerance_seconds
human_access_ttl_seconds
machine_access_ttl_seconds
obo_access_ttl_seconds
human_session_absolute_ttl_seconds
refresh_credential_ttl_seconds
refresh_verifier_algorithm
refresh_verifier_parameters_version
scope_wire_format_version
human_session_refresh_contract_version
v0_compatibility_status
```

精确生产 `jwks_url` 属于 `PRODUCTION_DEPLOYMENT` attestation，不是源码
Bundle Freeze 的占位字段。生产生效前必须补充可信 HTTPS 精确 URL 和外部运行证据；`null` 或示例域名不得解释为就绪。

Conformance Runner 必须读取 Manifest，不得在测试代码中维护第二套默认值。

## 4. Human Access Token

正向测试至少证明：

- RS256、`kid` 和 JWKS 验签；
- 精确 Issuer 和单一 Audience；
- `principal_type=user`；
- `client_id` 来自 Session 服务端绑定；
- `token_use=access`、`type=access`；
- `jti`、`iat`、`nbf`、`exp` 合法；
- 无 `scope`、`act`、`azp` 和产品 Role；
- Audience 存在于该 Client 的 `human_audience_grants`。

负向测试至少包括：

- Human Client 无任何 Audience Grant；
- Audience 已注册但未授予该 Client；
- 用户试图替换 `client_id`；
- Token 出现 `scope`、Role 或错误 Principal 类型；
- TTL 超过 15 分钟。

## 5. Direct Machine Token

第一批注册表没有接受 Service Principal 的 Machine Audience，因此 Direct
正向测试至少覆盖 Agent；Service Profile 的 Wire 和签发能力仍由合同冻结，但
第一批必须以 `AUDIENCE_PROFILE_NOT_ACCEPTED` 证明 Service 不能访问 Agent-only
Audience。未来只有通过 CCR 注册接受 Service 的 Audience 后，才增加 Service
正向 Conformance：

- Wire Claim 保留 `client_id`、`jti`、`nbf`；
- `token_use=access`，Direct Token 无 `azp` 和 `act`；
- `principal_type` 与数据库 Principal 一致；
- Agent Token 可有 `agent_id`；Service Token 不得有；
- Scope 非空、规范化、属于目标 Audience Namespace；
- requested scopes 是 `machine_access_grants[audience]` 的子集；
- 最终 Scope 精确等于请求集合；
- TTL 不超过 10 分钟；
- 无 Refresh Credential 和产品 Role。

负向测试至少包括：

- 目标 Audience 无 Machine Grant；
- 空、重复、前后空格、错误分隔符或错误大小写 Scope；
- 一个请求包含已授权和未授权 Scope 时整次拒绝；
- 同名 Scope 来自其他 Audience 时拒绝；
- Service Token 访问 Agent-only 入口时拒绝；
- Direct Token 带 `act` 或 `azp` 时拒绝。

## 6. Trusted Proxy Exchange

正向测试至少证明：

- Source Token 为 RS256 Agent Direct Token；
- Source `aud` 存在于 `accepted_subject_audiences`；
- Source `sub` 和 `client_id` 由已验证 Token 取得；
- 原始 Client 对 Target Audience 有 Machine Grant；
- Proxy Principal、Client、Credential 和注册 active；
- Proxy 对 Target Audience 有 Delegation Grant；
- requested scopes 同时是两方授权的子集；
- 最终 Scope 精确等于请求 Scope；
- OBO `sub` 保持原始 Agent；
- `act.sub` 为 Proxy Service Principal；
- `azp=client_id=Proxy Client`；
- `token_use=workflow_obo`；
- OBO TTL 不超过 5 分钟和 Source 剩余 TTL；
- 持久审计记录完整连接 Source 与 OBO `jti`。

负向测试至少包括：

- Source Audience 未被 Proxy 接受；
- Source 是 Human、Service 或 OBO Token；
- Source 缺 `client_id`、有 `act` 或主体类型不匹配；
- Proxy 未注册、inactive 或 Client/Principal 不匹配；
- Target Audience 或任一 Grant 不存在；
- requested scopes 只有部分获授权时整次拒绝；
- 空 Scope、任意 `sub` 参数和二次 Exchange；
- 审计持久写入失败时不得返回 Token。

## 7. Scope 严格语义

必须有专门回归测试证明 V1 不静默 downscope：

```text
requested = workflow.read workflow.write
original machine grant = workflow.read
proxy delegation grant = workflow.read workflow.write
expected = invalid_scope
token issued = false
```

还必须反向覆盖 Proxy Grant 不足、两方都不足、Scope 重复和非规范输入。

## 8. 时间与唯一性

每个 Profile 必须测试：

- `iat`、`nbf`、`exp` 是整数 NumericDate；
- `nbf <= iat < exp`；
- `exp - iat` 不超过 Profile TTL；
- 未来 `iat` 超过 skew 时拒绝；
- 未来 `nbf` 超过 skew 时拒绝；
- 过期超过 skew 时拒绝；
- OBO `exp <= source exp`；
- 大批量签发的 `jti` 无重复；
- 调用方提供时间或 `jti` 不影响 Issuer 输出。

## 9. JWKS 与 Rotation

至少测试：

- JWKS 只包含公开 RSA 参数；
- active key 签名，previous keys 只验证；
- 新 Token 使用新 `kid`；
- 旧 Token 在保留窗口内继续验证；
- 未知 `kid` 只触发一次刷新；
- 刷新后仍未知则拒绝；
- JWKS 不可用且无可信缓存时失败关闭；
- V1 模式存在 HS256 fallback 配置时启动失败；
- 重复 `kid` 或无 active signing key 时 auth-service 启动或签发失败。

## 10. 签发断言与离线验证

测试必须区分两个边界。

auth-service 签发时真实查询并证明：

```text
Client registered and active
Client belongs to Principal
Principal active and type matches
Audience and Grants authorized
Proxy registration valid
```

资源服务离线验证时不得调用 auth-service 查询上述当前状态。测试应在签发后禁用 Client，证明：

```text
new issuance rejected immediately
existing token remains cryptographically valid until exp
resource service performs no live status lookup
```

## 11. 领域授权负向证明

至少一个真实资源服务必须证明：

```text
valid token
+ valid audience
+ valid scope
!= authorized business operation
```

至少覆盖：

- 合法 read Scope 但 `sub` 无具体资源可见性；
- 合法 execute Scope 但 `sub` 不是当前 assignee；
- 合法 Scope 但状态机不允许操作；
- OBO Token 不得继承 Proxy 的产品管理员权限。

只有返回预期领域拒绝，才能证明 Scope 没有替代 Domain Authorization。

## 12. Human Session 与 Refresh

必须运行 `human-session-refresh.md` 定义的独立 Conformance，至少包括：

- Refresh 只存 verifier；
- Session/User/Client 绑定；
- 每次刷新轮换；
- 旧 Refresh 重放撤销整个 Token Family；
- logout、Client 禁用和 User 禁用后无法刷新；
- Machine 和 OBO 流程永不返回 Refresh Credential。

## 13. 错误与信息泄露

必须验证：

- Client 不存在与 Secret 错误返回相同外部错误；
- 不泄露 Principal 是否存在、Grant 内容或 Proxy 内部状态；
- Token、Secret、Authorization Header、私钥不进入日志；
- `invalid_scope` 不返回可被滥用的完整隐藏授权集合；
- OAuth 错误、HTTP 状态和缓存头符合冻结 Schema。

## 14. 真实进程矩阵

正式验收至少启动：

```text
auth-service fixed SHA
real database with versioned migrations
JWKS endpoint
svc-okr Human consumer
svc-workflow Direct/OBO resource service
adc-v2 source audience and trusted proxy
svc-workflow domain authorization path
```

必须记录进程版本、完整 Git SHA、配置摘要、数据库迁移版本、请求 ID 和新鲜 ingress 证据。

Mock、Fixture 和 Core smoke 可以作为前置证据，但不得被称为全部 Conformance。

## 15. 通过门

Conformance 报告必须明确输出：

```text
CONTRACT_MANIFEST_HASH
AUTH_SERVICE_REMOTE_SHA
CONSUMER_REMOTE_SHAS
CONTRACT_BUNDLE_FREEZE
PRODUCTION_DEPLOYMENT
CONSUMER_MIGRATION
DATABASE_MIGRATION_VERSION
POSITIVE_PASS_COUNT
NEGATIVE_PASS_COUNT
DOMAIN_AUTHORIZATION_NEGATIVE_PASS
LEGACY_FALLBACK_DISABLED
REAL_PROCESS_CONFORMANCE_PASS
```

`REAL_PROCESS_CONFORMANCE_PASS` 可以在受控非生产环境取得；它不自动设置
`PRODUCTION_JWKS_DEPLOYMENT_READY` 或
`AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE`。

如果任一固定 SHA 之后发生代码变化，原报告立即失效，必须推送新 SHA 并重新运行、重新独立审计。
