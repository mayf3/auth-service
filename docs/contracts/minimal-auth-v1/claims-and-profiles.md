# Claims and Token Profiles

## 1. 状态与兼容原则

```text
STATUS=DRAFT_V1_MODULE
MACHINE_WIRE_COMPATIBILITY_WITH_V0=required
```

本模块冻结 JWT Header、公共 Claims、三个 Access Token Profile、时间和离线验证义务。

V1 沿用 V0 已冻结的机器 Token 字段和值：

```text
保留 client_id
保留 jti
保留 nbf
Direct token_use=access
OBO token_use=workflow_obo
保留现有 OBO act / azp / client_id 结构
```

V1 不执行以下无必要重命名：

```text
client_id → azp
access → machine_access
workflow_obo → delegated_access
删除 jti / nbf
```

“Machine Access Token”和“Delegated/OBO Access Token”是文档名称，不改变既有 Wire 值。

## 2. JWT Header

所有 V1 Access Token 必须使用：

```json
{
  "alg": "RS256",
  "kid": "<signing-key-id>"
}
```

固定规则：

- `alg` 必须是 `RS256`；
- `kid` 必须存在并精确匹配 JWKS 中的公钥；
- 不接受 HS256、`none` 或其他算法；
- 未知 `kid` 刷新 JWKS 一次后仍未知则拒绝；
- V1 不新增强制 `typ=at+jwt`，避免无收益改变既有 Header 合同；
- 若 Issuer 保留既有 `typ`，消费者不得用它替代签名和 Profile 验证。

## 3. 公共 Claims 语义

| Claim | 类型 | 语义 |
|---|---|---|
| `iss` | string | Contract Manifest 中冻结的精确 Issuer |
| `sub` | UUID string | 原始 Principal 的稳定 UUID |
| `aud` | string | 单一、精确目标 Audience；不得为数组 |
| `principal_type` | string enum | `user`、`agent` 或 `service`，描述 `sub` |
| `client_id` | string | 实际取得或交换该 Token 的服务端绑定 Client |
| `token_use` | string enum | Direct/Human 为 `access`；OBO 为 `workflow_obo` |
| `type` | string | 固定为 `access`，保留 V0 Wire Contract |
| `version` | string | 保留 V0 字段；精确值由 Contract Manifest 冻结 |
| `jti` | string | 签发域内唯一 Token ID，用于审计关联 |
| `iat` | integer NumericDate | 签发时间 |
| `nbf` | integer NumericDate | 不早于时间 |
| `exp` | integer NumericDate | 失效时间 |

`sub`、`principal_type` 和 `client_id` 必须由 auth-service 根据服务端数据写入，调用方不得覆盖。

## 4. Human Access Token

Human Access Token 是 V1 新 Profile：

```json
{
  "iss": "<issuer>",
  "sub": "<User Principal UUID>",
  "aud": "svc-okr",
  "principal_type": "user",
  "client_id": "<server-bound Human Client ID>",
  "token_use": "access",
  "type": "access",
  "version": "v1",
  "jti": "<unique>",
  "iat": 1784300000,
  "nbf": 1784300000,
  "exp": 1784300900
}
```

Human Access Token 不得包含：

```text
scope
act
azp
agent_id
role
internalRole
okrRole
产品角色或资源权限
```

Human Token 的 Audience 必须来自该 Human Client 的 `human_audience_grants`。已注册 Audience 不等于任意 Human Client 获得访问资格。

Human CLI、Web 或桌面应用是 Client，不是 Principal 类型。Client ID 必须由登录流程和 Session 在服务端绑定，用户不得在 Token 请求中替换。

Human Access Token 最大 TTL 为 15 分钟。Refresh Credential 由 `human-session-refresh.md` 单独定义，不属于 JWT Claims Contract。

## 5. Direct Machine Access Token

Direct Machine Token 延续 V0 Wire Format：

```json
{
  "iss": "<issuer>",
  "sub": "<Machine Principal UUID>",
  "aud": "svc-workflow",
  "principal_type": "agent",
  "scope": "workflow.execute workflow.read",
  "token_use": "access",
  "type": "access",
  "version": "v1",
  "agent_id": "<canonical agent id>",
  "client_id": "<MachineClient.clientId>",
  "jti": "<unique>",
  "iat": 1784300000,
  "nbf": 1784300000,
  "exp": 1784300600
}
```

固定规则：

- `principal_type` 为 `agent` 或 `service`；
- `agent_id` 只允许出现在 `agent` Profile，Service Token 不包含该字段；
- `scope` 必须是非空规范字符串；
- `client_id` 必须是取得 Token 的 Machine Client；
- Direct Token 不包含 `azp` 或 `act`；
- 不包含产品 Role 或资源级授权事实；
- 不签发 Refresh Credential；
- 最大 TTL 为 10 分钟。

`principal_type=service` 是 V1 的受控枚举扩展。任何只接受 Agent 的入口必须继续明确拒绝 Service Token。

## 6. Delegated/OBO Access Token

OBO Token 延续 V0 Claim 结构：

```json
{
  "iss": "<issuer>",
  "sub": "<original Agent Principal UUID>",
  "aud": "svc-workflow",
  "principal_type": "agent",
  "scope": "workflow.read",
  "token_use": "workflow_obo",
  "type": "access",
  "version": "v1",
  "act": {
    "sub": "<Proxy Service Principal UUID>"
  },
  "azp": "<Proxy Client ID>",
  "client_id": "<Proxy Client ID>",
  "agent_id": "<original agent id>",
  "jti": "<unique>",
  "iat": 1784300000,
  "nbf": 1784300000,
  "exp": 1784300300
}
```

固定语义：

- `sub` 是原始 Agent Principal；
- `principal_type=agent` 描述原始 `sub`；
- `act.sub` 是 Proxy Service Principal；
- `azp` 与 `client_id` 都是实际执行 Exchange 的 Proxy Client，保留 V0 兼容；
- `agent_id` 如存在，描述原始 Agent；
- 资源服务必须基于 `sub` 执行业务授权；
- `act.sub`、`azp` 和 `client_id` 只用于 Profile 限制与审计，不继承或扩大业务权限；
- 最大 TTL 为 5 分钟，且 `exp` 不得晚于 source token 的 `exp`；
- 不签发 Refresh Credential；
- 不允许 OBO Token 再次参与 Exchange。

完整原始 Client 链保存在 auth-service Exchange 审计记录中，不额外扩张 OBO Token Claim。

## 7. Scope Wire Format

Machine 和 OBO Token 的 `scope`：

```text
JSON 类型：string
分隔符：单个 ASCII 空格 U+0020
大小写：敏感
前后空格：禁止
重复项：禁止
字符集：仅规范 ASCII Scope 字符
Issuer 输出：按无符号 ASCII byte 升序排序
空字符串：禁止
```

每个 Scope 必须匹配：

```text
^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$
```

并使用目标 Audience 注册的规范 Scope Namespace，例如 `svc-workflow` 使用 `workflow.*`。限制为 ASCII 后，不同语言实现不得使用 locale-aware 排序。

Scope 授权与严格拒绝规则由 `grants-and-audiences.md` 定义。

## 8. 时间 Claims

所有 V1 Access Token 必须满足：

```text
iat、nbf、exp 必须是整数 NumericDate
nbf <= iat
exp > iat
exp - iat <= 对应 Token Profile 最大 TTL
iat <= now + CLOCK_SKEW_TOLERANCE
nbf <= now + CLOCK_SKEW_TOLERANCE
exp > now - CLOCK_SKEW_TOLERANCE
jti 在 Issuer 签发域内唯一
```

最大 `CLOCK_SKEW_TOLERANCE` 为 60 秒；正式精确值写入 Contract Manifest。

Issuer 不得接受调用方提供 `iat`、`nbf`、`exp`、TTL 或 `jti` 来覆盖服务端计算。

## 9. 签发断言

auth-service 在签发时必须实时确认：

- Principal 和 Client 存在且 active；
- Client 属于该 Principal；
- Credential 有效；
- `principal_type` 与 Principal 一致；
- Audience 存在且对应 Grant 获准；
- Machine/OBO requested scopes 满足严格子集规则；
- Proxy 注册、输入 Audience 和 delegation grants 有效。

这些事实由 auth-service 签名断言，不由资源服务逐请求重新查询。

## 10. 资源服务离线验证

资源服务必须离线验证：

1. `alg=RS256`、`kid` 和签名；
2. 精确 `iss` 和精确单字符串 `aud`；
3. Claim 类型、必填字段和枚举；
4. `iat`、`nbf`、`exp` 和 TTL 上限；
5. Machine/OBO 的规范非空 `scope`；
6. OBO 的 `act.sub`、`azp`、`client_id` 结构和相等约束；
7. 自身入口允许的 `principal_type` 和 `token_use`；
8. Scope 对入口类别的要求；
9. 基于 `sub` 的完整领域授权。

资源服务不负责实时查询：

```text
client_id 当前是否仍注册
sub 与 principal_type 当前是否仍一致
Client 或 Principal 是否刚刚被禁用
Proxy 注册是否在 Token 签发后刚刚变化
```

资源服务信任 auth-service 已签名的签发时断言，直到 Token 到期。若某服务还要求本地 Proxy allowlist，该 allowlist 必须进入 Contract Bundle，不能由消费者自行猜测。

## 11. 失败关闭

以下情况必须拒绝且不得回退 Legacy 验证：

- 非 RS256、未知 `kid`、错误签名；
- 错误 Issuer、Audience 数组、错误 Audience；
- 缺少必填 Claim、Claim 类型或枚举错误；
- 时间关系或 TTL 超限；
- Human Token 出现 `scope`、`act` 或产品 Role；
- Direct Token 出现 `azp` 或 `act`；
- OBO Token 缺少 `act.sub`、`azp`、`client_id`，或后两者不相等；
- `scope` 非规范、为空或入口 Scope 不足；
- 尝试以 HS256 Token 冒充 V1 Token。
