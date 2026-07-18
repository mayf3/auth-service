# Trusted Proxy Delegation

## 1. 状态与范围

```text
STATUS=DRAFT_V1_MODULE
DELEGATION_DEPTH=1
HUMAN_OBO=false
OBO_CHAINING=false
SILENT_SCOPE_DOWNSCOPING=false
```

V1 只支持一个真实且受控的路径：

```text
Agent
→ Trusted Proxy
→ Target Resource Service
```

V1 不支持 Service 代表 Human、多级代理、任意平台代理或 OBO Token 再次交换。

## 2. Trusted Proxy 注册

可信代理注册至少包含：

```text
proxy_principal_id
proxy_client_id
accepted_subject_audiences
delegation_grants
status
created_at
updated_at
```

示例：

```json
{
  "proxy_principal_id": "<ADC Service Principal UUID>",
  "proxy_client_id": "<ADC Proxy Client ID>",
  "accepted_subject_audiences": ["adc-v2"],
  "delegation_grants": {
    "svc-workflow": ["workflow.read"]
  },
  "status": "active"
}
```

固定绑定：

- Proxy Principal 必须是 `principal_type=service`；
- Proxy Client 必须属于该 Proxy Principal；
- `accepted_subject_audiences` 表示该 Proxy 可以接收哪些原始 Token；
- `delegation_grants` 表示该 Proxy 可以向哪些目标 Audience 申请哪些 Scope；
- 输入 Audience 和目标 Audience 是两个独立维度，不得混为一个 `allowedResources` 列表；
- Proxy 默认没有输入 Audience 或代理 Scope 授权。

## 3. Exchange 请求

V1 延续 V0 Token Exchange 入口和参数名：

```text
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(proxy_client_id:proxy_client_secret)

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
subject_token=<Agent Direct Token>
subject_token_type=urn:ietf:params:oauth:token-type:access_token
requested_token_type=urn:ietf:params:oauth:token-type:access_token
audience=svc-workflow
scope=workflow.read
```

以下主体替换参数必须拒绝：

```text
requested_subject
subject
subject_id
requested_sub
actor_token
```

调用方不得传入任意 `sub`、`principal_type`、`act` 或原始 Client ID。

## 4. Source Token 要求

Source Token 必须：

- 由 auth-service 使用 RS256 签发；
- `kid`、签名和精确 Issuer 合法；
- `token_use=access`；
- `type=access`；
- `principal_type=agent`；
- `sub` 是合法 Agent Principal UUID；
- `client_id` 是取得 Source Token 的原始 Agent Client；
- `aud` 是单一字符串并存在于 Proxy 的 `accepted_subject_audiences`；
- 时间 Claims 和 TTL 合法；
- 不含 `act` 或 OBO 标记；
- 当前不是已经 Exchange 的 Token。

Source Token 的 Scope 只属于 source audience 的语义空间，不能作为 target audience Scope 授权集合参与交集。

auth-service 必须根据 Source Token 中已签名的 `sub` 与 `client_id`，实时定位原始 Principal 和 Client，并确认：

- Principal 和 Client 存在且 active；
- Client 属于该 Principal；
- `principal_type` 与 Principal 一致；
- 原始 Client 对 target audience 有 `machine_access_grants`。

## 5. Proxy 验证

Exchange 必须确认：

1. Proxy Client Credential 合法；
2. Proxy Client 与 Proxy Principal active；
3. Proxy Client 属于注册的 Proxy Principal；
4. Trusted Proxy 注册 active；
5. Source `aud` 精确存在于 `accepted_subject_audiences`；
6. Target Audience 存在于 Audience 注册表；
7. Proxy 对 Target Audience 有 `delegation_grants`。

不得仅因为一个 Service Client 可以直接访问目标服务，就推导它具备 Proxy 资格。

## 6. 严格 Scope 授权

requested scopes 必须非空，并同时满足：

```text
requested_scopes ⊆ original_client.machine_access_grants[target_audience]
requested_scopes ⊆ proxy_client.delegation_grants[target_audience]
```

最终值固定为：

```text
final_scopes = requested_scopes
```

任何一个 Scope 未同时获两方授权，整次 Exchange 必须以 `invalid_scope` 拒绝。

禁止以下 V0 行为继续进入 V1：

```text
requested read+write
original 只有 read
自动缩减并签发 read
```

从 V0 自动交集迁移到严格拒绝属于显式 CCR，必须按 `v0-to-v1-migration.md` 完成调用方错误处理和 Conformance 更新。

## 7. OBO Token

OBO Token Claim 结构由 `claims-and-profiles.md` 冻结，并保持 V0 Wire Compatible：

```text
sub            = original Agent Principal
principal_type = agent
aud            = target audience
scope          = canonical requested scopes
token_use      = workflow_obo
act.sub        = Proxy Service Principal
azp            = Proxy Client
client_id      = Proxy Client
jti            = new delegated token id
```

OBO Token 最大 TTL 为 5 分钟，并满足：

```text
delegated_exp <= source_token_exp
```

资源服务只使用 `sub` 执行业务授权。`act.sub`、`azp` 和 `client_id` 不得继承 Proxy 的产品权限。

## 8. 持久 Exchange 审计

auth-service 必须为每次成功或失败的 Exchange 写入不可篡改、可持久查询的审计事实。成功记录至少包含：

```text
exchange_id
original_principal_id
original_client_id
proxy_principal_id
proxy_client_id
source_token_jti
delegated_token_jti
source_audience
target_audience
requested_scopes
granted_scopes
timestamp
result
```

失败记录至少包含安全可披露的：

```text
exchange_id
proxy_principal_id（若已解析）
proxy_client_id（掩码或内部受控值）
source_token_jti（若已验证）
source_audience（若已验证）
target_audience
requested_scopes
timestamp
rejection_category
```

不得记录：

- 完整 Source Token 或 OBO Token；
- Client Secret、Authorization Header 或私钥；
- 未验证 Token 中的主体字段作为可信事实；
- 会形成 Credential 重放能力的内容。

Audit Store 必须定义持久化、访问控制、保留期和篡改检测。仅 stderr best-effort 日志不满足 V1 完整审计链。

完整 Client 链通过该审计记录还原，不要求把 `original_client_id` 额外塞入 OBO Token。

## 9. 资源服务义务

资源服务离线验证 OBO Token：

- 签名、`kid`、Issuer、target Audience；
- 时间 Claims 和最大 5 分钟 TTL；
- `principal_type=agent`；
- `token_use=workflow_obo`；
- `act={sub: UUID}`；
- `azp` 和 `client_id` 都存在且相等；
- Scope Wire Format 和入口 Scope；
- 基于原始 `sub` 的全部领域授权。

资源服务不实时查询 Source Token、原始 Client、Proxy 注册或 Exchange 审计记录。事故调查和全链路追踪由 auth-service 审计事实提供。

## 10. 禁用与撤销

| 变化 | 新 Exchange | 已签 OBO Token |
|---|---|---|
| 原始 Principal/Client 禁用 | 立即拒绝 | 最迟在 `exp` 失效 |
| Proxy Principal/Client 禁用 | 立即拒绝 | 最迟在 `exp` 失效 |
| Proxy 注册 inactive | 立即拒绝 | 最迟在 `exp` 失效 |
| Source Audience 被移除 | 立即拒绝 | 最迟在 `exp` 失效 |
| Delegation Grant 缩小 | 立即按新 Grant 拒绝 | 最迟在 `exp` 失效 |

V1 不承诺 OBO Token 秒级撤销。

## 11. 失败关闭

以下情况必须拒绝：

- Source Token 无效、过期、非 Agent Direct Token 或含 `act`；
- Source Audience 不在 `accepted_subject_audiences`；
- Source `client_id` 无法绑定到原始 Agent；
- Proxy Credential、Principal、Client 或注册无效；
- Target Audience 未注册；
- 原始 Machine Grant 或 Proxy Delegation Grant 不存在；
- requested scopes 为空、格式错误或不同时属于两方授权；
- 调用方尝试替换主体；
- OBO Token 再次 Exchange；
- OBO TTL 超过 Source Token 剩余时间；
- 审计事实无法持久写入。

审计写入失败时不得先返回成功 Token；签发与审计必须具有可证明的失败一致性。
