# Human Session and Refresh Contract V1

## 1. 状态与边界

```text
CONTRACT_ID=HUMAN_SESSION_AND_REFRESH_CONTRACT_V1
STATUS=DRAFT_V1_MODULE
CONTRACT_VERSION=1.0.0-draft.2
REFRESH_CREDENTIAL_IS_JWT=false
ROTATION_REQUIRED=true
TOKEN_FAMILY_REUSE_DETECTION=true
```

本模块独立冻结 Human Session 和 Refresh Credential，避免把 Human 长期会话复杂度塞入 Machine Access Token 合同。

本模块只适用于 `principal_type=user`。Agent、Service 和 OBO Token 不得获得 Refresh Credential。

## 2. 所有权

auth-service 是以下事实的唯一权威：

- Human 登录认证结果；
- Session 与 User Principal、Human Client 的绑定；
- Session 状态和有效期；
- Refresh Token Family；
- Refresh Credential verifier、轮换、重放检测和撤销；
- Human Access Token 签发。

资源服务不保存或验证 Refresh Credential，只接收短期 Human Access Token。

## 3. Human Client 与 Session 绑定

Human Client 可以是 Web、桌面应用或 CLI，但必须是已注册 Client。

登录完成时，auth-service 必须根据受信任登录流程确定：

```text
user_principal_id
client_id
session_id
```

固定规则：

- Session 绑定一个 User Principal 和一个 Human Client；
- User 不得在 Token 或 Refresh 请求中替换 `client_id`；
- 请求体中的显示名称、邮箱或 Principal ID 不得覆盖服务端绑定；
- Public Client 与 Confidential Client 的证明流程必须由各自登录合同定义；
- 未定义完整证明流程的 `credential_type` 不得启用；
- Client inactive/revoked 时不得创建 Session 或刷新。

V1 首个 Bundle 只支持 Authorization Code + PKCE S256 登录绑定。Public 与
Confidential Client 都必须使用 PKCE；Confidential Client 还必须在 Token
Endpoint 使用 `client_secret_basic`。Implicit、Password Grant、把密码交给
第三方 Client 后端以及从 `Origin`/`Referer` 推断 Client 都不受支持。

登录流程固定为：

1. auth-service 创建短期 Authorization Transaction，服务端验证已注册
   `client_id`、精确 `redirect_uri`、目标 Audience Grant 和 S256
   `code_challenge`；
2. 用户认证提交只引用不可猜测的 Transaction ID，不重新接收
   `client_id`、Audience 或 Redirect URI；
3. 登录成功后签发单次 Authorization Code；数据库只保存 Code verifier
   hash，并绑定 User、Client、Audience、Redirect URI 和 PKCE Challenge；
4. Token Endpoint 原子消费 Code，验证原 Client、精确 Redirect URI、
   `code_verifier` 和 Client Authentication；
5. 成功后才创建 Session、Token Family、首个 Refresh Credential 和 Human
   Access Token。

Authorization Transaction 最长 5 分钟，Authorization Code 最长 60 秒，
两者均只允许成功使用一次。失败、过期或并发重放不得创建 Session。用户
可以主动开始另一个已注册 Client 的独立登录流程，但不能在既有 Transaction、
Code、Session 或 Refresh 请求中替换 Client。

## 4. 最小 Session 对象

Session 至少记录：

```text
session_id                 stable random identifier
user_principal_id          UUID
client_id
token_family_id
status                     active | revoked | expired
authenticated_at
last_refreshed_at
absolute_expires_at
revoked_at                 nullable
revocation_reason          nullable
created_at
updated_at
```

Session ID 不进入 V1 Access Token 的必填 Claims。资源服务不通过 Session ID 做在线查询。

Session 的绝对有效期必须写入 Contract Manifest。刷新不得把 Session 延长到 `absolute_expires_at` 之后。

## 5. Human Access Token 签发

Human Access Token 由 active Session 申请，且必须满足：

1. User Principal active；
2. Human Client active；
3. Session active 且绑定该 User/Client；
4. Session 未超过 absolute expiry；
5. Target Audience 存在于 Client 的 `human_audience_grants`。

Issuer 根据 `claims-and-profiles.md` 签发单 Audience、最长 15 分钟的 RS256 Human Access Token。

Human Access Token 不包含 Scope、Refresh Credential 或产品 Role。

## 6. Refresh Credential 形态

Refresh Credential 必须是不可解析的高熵随机值，不是 JWT，不承载身份或授权 Claim。

最低要求：

```text
entropy >= 256 bits
transport = TLS only
storage = verifier/hash only
plaintext display = issuance response only
logging = forbidden
```

auth-service 数据库不得保存可直接重放的明文 Refresh Credential。查找可使用不敏感的 Credential ID 与 verifier 分离结构，但完整 bearer secret 只能由客户端持有。

首个 Bundle 的 Wire Format 为：

```text
rc1.<refresh_credential_id UUIDv4>.<32-byte base64url secret>
```

数据库使用可公开的 UUID 定位记录，只对最后一段 Secret 保存带独立 Salt 的
版本化 scrypt verifier。完整 Wire Value 和最后一段 Secret 均不得落库。
Authorization Code 使用对应的 `ac1.<UUIDv4>.<secret>` 格式并同样只保存
verifier。错误响应不得说明 UUID 是否存在。

## 7. Refresh 记录

每个当前或历史 Refresh Credential 至少记录：

```text
refresh_credential_id
token_family_id
session_id
user_principal_id
client_id
credential_verifier
credential_version
status                  active | rotated | revoked | expired
issued_at
expires_at
rotated_at              nullable
replaced_by_id          nullable
revoked_at              nullable
reuse_detected_at       nullable
```

`credential_verifier` 使用的算法和参数必须写入 Contract Manifest，并支持版本化升级。

## 8. 首次签发

登录成功且 Session 建立后，auth-service 可以返回：

```text
human access token
refresh credential
refresh expires_in
```

固定规则：

- Refresh Credential 只展示一次；
- 绑定当前 User、Session、Client 和 Token Family；
- 固定过期时间，不因后续轮换无限延长；
- 响应使用 `Cache-Control: no-store` 和 `Pragma: no-cache`；
- 不得通过 URL、日志、错误或分析事件传递。

## 9. 刷新轮换

每次成功刷新必须原子执行：

```text
verify presented refresh credential
verify active user / client / session / family
mark old credential rotated
create new refresh credential in same family
issue new Human Access Token
commit all state
return new credential once
```

任何步骤失败都不得留下两个 active Refresh Credential，也不得返回新的 Access Token。

旧 Refresh Credential 在成功轮换后立即失效。

刷新时的 Target Audience 仍必须存在于 Session Client 的 `human_audience_grants`；历史 Access Token 的 Audience 不自动授予新 Audience。

## 10. 重放检测与 Token Family

如果已经 `rotated`、`revoked` 或标记为已使用的 Refresh Credential 再次出现，auth-service 必须：

1. 将其视为可能泄露；
2. 撤销同一 `token_family_id` 的全部 Refresh Credentials；
3. 撤销对应 Session；
4. 停止该 Family 的任何后续刷新；
5. 写入高优先级安全审计事件；
6. 返回通用认证失败，不泄露 Family 内部状态。

已签 Access Token 仍按离线语义最迟在 `exp` 失效，除非未来独立合同引入秒级撤销。

## 11. 注销与禁用

以下变化必须阻止新刷新：

| 事件 | Session | Refresh Family | 已签 Access Token |
|---|---|---|---|
| 用户注销 | revoked | revoked | 最迟 `exp` 失效 |
| User Principal disabled | 不可刷新 | revoked | 最迟 `exp` 失效 |
| Human Client revoked | 不可刷新 | revoked | 最迟 `exp` 失效 |
| Session absolute expiry | expired | expired/revoked | 最迟 `exp` 失效 |
| Refresh reuse detected | revoked | 全 Family revoked | 最迟 `exp` 失效 |

注销必须至少撤销当前 Session 和 Token Family。全设备注销属于显式产品能力，必须定义它影响哪些 Session。

## 12. Credential 和 Verifier 轮换

Verifier 算法或参数升级必须支持：

- 新记录使用当前 `credential_version`；
- 旧版本在受控窗口内验证；
- 成功刷新时升级到当前版本；
- 旧版本有遥测、截止日期和删除门；
- 不得在验证失败后回退不安全算法。

Refresh Credential 本身每次刷新都轮换；这与 verifier 算法升级是两个不同概念。

## 13. 安全审计

至少记录：

```text
event_id
event_type
user_principal_id
client_id
session_id
token_family_id
refresh_credential_id
result
rejection_category
timestamp
request_correlation_id
```

事件类型至少包括：

```text
session.created
session.revoked
refresh.issued
refresh.rotated
refresh.failed
refresh.reuse_detected
refresh.family_revoked
```

不得记录原始 Refresh Credential、Access Token、密码、Client Secret 或 Authorization Header。

## 14. 错误合同

对外错误不得区分：

- Refresh Credential ID 不存在；
- verifier 不匹配；
- User、Client、Session 或 Family 已禁用；
- Credential 已轮换或过期。

这些情况统一返回通用认证失败，详细原因只进入受控安全审计。

错误响应必须使用 no-store 缓存头，不得回显 Credential 或内部状态。

## 15. 最小 Conformance

真实进程测试至少覆盖：

- 登录后 Session 正确绑定 User 与 Client；
- 用户尝试替换 Client 时拒绝；
- Human Audience Grant 正向和负向签发；
- 数据库只保存 verifier，无法取得可重放明文；
- 成功刷新原子轮换且只有一个 active Credential；
- 旧 Credential 重放撤销整个 Family；
- 并发使用同一个 Refresh Credential 时最多一个成功；
- logout、User 禁用、Client 禁用和 Session 过期后刷新拒绝；
- 轮换失败不返回 Access Token；
- Machine/OBO Endpoint 永不返回 Refresh Credential；
- 日志和错误无 Credential 泄露。

这些是实现后的真实进程 Conformance 门，不是首次源码 Contract Bundle Freeze 的前置条件。只有全部通过，Human V1 才能进入消费者切换或生产生效；Schema、Wire 和失败语义先由 Bundle Freeze 固定。

## 16. 非目标

V1 不建设：

```text
Access Token 秒级撤销
通用 Token Introspection
设备信任评分
风险自适应 MFA
跨组织 Session Federation
无限期滑动 Session
Machine Refresh Token
```

这些能力出现真实需求时必须通过独立 Contract Change Request 引入。
