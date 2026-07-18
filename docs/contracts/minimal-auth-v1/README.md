# Minimal Auth Foundation V1

## 1. 文档状态

```text
DESIGN_ID=MINIMAL_AUTH_FOUNDATION_V1
DESIGN_VERSION=1.1-draft
STATUS=DRAFT_TARGET_DESIGN
ARCHITECTURE_DIRECTION_ACCEPTED=true
REDESIGN_REQUIRED=false
READY_FOR_IMPLEMENTATION_INVENTORY=true
READY_FOR_CONTRACT_BUNDLE_FREEZE=false
CURRENT_MAINLINE_EFFECTIVE=false
NARROW_CONTRACT_REVIEW_REQUIRED=true
```

本目录冻结候选的统一身份架构边界，但尚未宣布 V1 Wire Contract 生效。

本次修订以两个原则为前提：

```text
VALID_TOKEN != AUTHORIZED_OPERATION
NO_UNNECESSARY_WIRE_CONTRACT_CHANGE=true
```

“最简”不表示字段最少或名字最统一，而表示不为了低收益的一致性，破坏已经冻结且运行正常的 Wire Contract。

## 2. 当前权威关系

V1 正式在主线生效前，以下 V0 合同继续有效：

- `../WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md`
- `../WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0.md`

本目录当前是 V1 候选合同，不得被实现方、消费者或部署方解释为已经 supersede V0。

只有满足 `v0-to-v1-migration.md` 中的全部生效门后，才允许宣布：

```text
MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE=true
V1_SUPERSEDES_WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0=true
V1_SUPERSEDES_WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0=true
```

V1 对机器 Token 的原则是 Wire Compatible。真正不兼容的变化必须作为显式 Contract Change Request，列出消费者、迁移窗口、遥测和删除门。

## 3. 模块索引

| 文件 | 规范内容 |
|---|---|
| `claims-and-profiles.md` | JWT Header、Claims、Token Profile、时间、签名、离线验证 |
| `grants-and-audiences.md` | Audience 注册表、三类 Grants、Scope 严格语义 |
| `delegation.md` | 单层 Agent 代理、输入 Audience、Exchange、审计链 |
| `v0-to-v1-migration.md` | V0/V1 权威关系、兼容矩阵、迁移与删除门 |
| `conformance.md` | Contract Manifest、真实进程与负向 Conformance |
| `human-session-refresh.md` | Human Session、Refresh Credential、Token Family |

除本 `README.md` 外，目录中六份模块文件均属于同一个候选合同。单独摘取一个模块不能覆盖其他模块的约束。

## 4. 目标与非目标

统一身份系统只回答：

1. 谁在访问；
2. 哪个 Client 代表该主体取得 Token；
3. Token 签发给哪个精确 Audience；
4. Machine 调用最多获得哪些入口 Scope；
5. 是否经过一个登记且可审计的可信代理。

统一身份系统不回答：

1. 可以读取哪些具体业务数据；
2. 可以执行哪些具体写操作；
3. 是否是 owner、reviewer、assignee、moderator 或产品管理员；
4. 当前业务状态是否允许操作；
5. Approval、Transition 或其他领域规则是否满足。

固定边界：

```text
VALID_TOKEN != AUTHORIZED_OPERATION
SCOPE != DOMAIN_AUTHORIZATION
```

资源服务必须在 Token 验证和入口 Scope 检查之后，继续基于 `sub`、资源关系、产品角色和业务状态执行完整领域授权。

## 5. 总体模型

### 5.1 直接访问

```text
Human / Agent / Service
        │
        │ Human Session 或 Client Credential
        ▼
    auth-service
        │
        │ 短期、单 Audience、RS256 Access Token
        ▼
    Resource Service
        │
        │ 离线验证 + 入口 Scope（Machine）
        ▼
    基于 sub 的领域授权
```

### 5.2 单层代理

```text
Agent Direct Token（source audience）
        │
        ▼
Trusted Proxy + Proxy Client Credential
        │
        ▼
auth-service Token Exchange
        │
        ▼
OBO Token（target audience）
sub = 原始 Agent
act.sub = Proxy Service Principal
client_id / azp = Proxy Client
```

V1 不支持 Human OBO、多级代理、OBO Token 再次交换或任意服务代表任意主体。

## 6. 稳定身份对象

V1 Principal 类型：

```text
user
agent
service
```

Principal 最小字段：

```text
id                  stable UUID
principal_type      user | agent | service
status              active | disabled
created_at
updated_at
```

名称、邮箱、Agent 名称、工作区、机器或部署环境变化不得改变 Principal ID。

Client 表示一个可以代表 Principal 申请 Token 的应用或运行实例。最小字段：

```text
client_id
principal_id
credential_type
credential_verifier
credential_version
human_audience_grants
machine_access_grants
delegation_grants
status              active | revoked
created_at
updated_at
```

调用方不得通过请求参数改变服务端绑定的 `client_id -> principal_id`。

## 7. 所有权边界

auth-service 是以下事实的唯一权威：

- Principal 身份、类型和状态；
- Client 与 Principal 的绑定、Credential 和状态；
- Human Session 与 Refresh Credential；
- Audience 注册表和三类 Grants；
- Token Profile、签发、签名、JWKS 和 Key Rotation；
- Trusted Proxy 注册与 Exchange 审计链。

auth-service 不得拥有或裁决：

- 产品 Role 和领域角色绑定；
- 最终 read/write 权限；
- 资源可见性、owner、reviewer、assignee；
- Workflow Definition、Transition、Approval；
- Forum、Todo、OKR 或其他产品业务状态。

资源服务拥有：

- Scope 名称、命名空间和业务语义；
- Scope 与接口类别的映射；
- 所有资源级和操作级领域授权；
- 产品角色、状态机、Transition 和 Approval；
- 业务审计事实。

## 8. Credential 基线

V1 首个可实施 Contract Bundle 只允许冻结已经定义完整证明流程的 Credential 类型。

最低安全规则：

```text
Client Secret 只保存不可逆 verifier
私钥不得存入普通业务表
明文 Secret 只在创建或轮换时展示一次
日志、错误和审计不得记录原始 Secret
```

`public_key` 或其他受控平台凭证只有在独立合同定义证明协议、重放防御和轮换行为后才能启用。仅在枚举中出现不代表已经受支持。

Client Credential 轮换不得改变 Principal ID 或 Client ID。旧 Credential 在轮换提交后必须立即停止新签发；每个 Client 可以独立轮换和禁用。

## 9. OpenClaw Credential Broker

auth-service 不嵌入 OpenClaw。OpenClaw 只提供薄的受信任 Credential Broker，负责：

```text
从受信任 Secret Store 读取 Client Credential
向 auth-service 申请短期 Machine Token
将 Token 附加到固定目标请求
```

Credential Broker 不负责：

```text
决定产品权限
保存长期 Access Token
签发 Token
解释产品 Role
允许模型指定任意 sub、audience 或 scope
```

以下内容只能由受信任组件持有：

```text
client_secret
private_key
access_token
refresh_credential
```

不得暴露给 LLM Prompt、Agent 上下文、模型生成的 Shell、普通工具进程、任务 Payload、错误响应或业务日志。

工具到 Audience/Scope 的映射必须由固定插件配置和受信任调用路径确定。配置中的 `agent_id` 或 `principal_id` 只用于定位和诊断，真实身份仍由服务端 `client_id -> principal_id` 绑定确定。

## 10. Signing Key 与 JWKS

所有 V1 Access Token 使用 RS256、`kid` 和 JWKS。不得在 RS256/JWKS 验证失败后回退 HS256 或共享 JWT Secret。

资源服务必须：

1. 使用仍在可信缓存期内的 Key；
2. 遇到未知 `kid` 时刷新 JWKS 一次；
3. 刷新后仍未知则拒绝；
4. JWKS 不可用时只允许使用仍可信的缓存；
5. 无可信缓存时失败关闭。

Contract Manifest 必须冻结 JWKS Cache TTL、最大 stale 窗口和时钟容差。

Signing Key 轮换至少支持一个 active signing key 和 previous verification keys。旧公钥保留时间不得短于最大 Token TTL、时钟容差和 JWKS 缓存传播所需窗口之和。

## 11. 禁用与撤销

auth-service 在签发或 Exchange 时检查 Principal、Client、Credential、Audience、Grants 和 Proxy 状态。任意失败都不得签发。

资源服务使用离线 JWT 验证，不实时查询 Principal 或 Client 状态：

```text
Principal 或 Client 被禁用
→ 立即停止新签发和新刷新
→ 已签 Access Token 最迟在 exp 时失效
```

V1 不承诺 Access Token 秒级撤销，不要求通用 Introspection 或 `jti` denylist。`jti` 仍保留用于唯一标识、审计关联和事故追踪。

## 12. Legacy 与产品 Role

以下字段不属于 V1 Access Token 的长期身份合同：

```text
role
internalRole
okrRole
owner
reviewer
assignee
moderator
产品领域权限
```

现有 Human Token 中的这些字段统一视为 `LEGACY_COMPATIBILITY_CLAIMS`：禁止新增消费者，现有消费者必须迁移到资源服务本地授权，不得为了兼容而重新加入 V1 Profile。

## 13. 实施与生效门

本目录修订完成后，下一步只能是窄范围合同审阅和实现盘点，不得直接宣布实施授权。

正式生效顺序：

```text
固定远程实现基线
→ V1 窄范围合同审阅通过
→ 当前实现与消费者盘点
→ Contract Bundle Freeze
→ 真实服务进程 Conformance
→ 固定远程 SHA
→ READY_FOR_INDEPENDENT_AUDIT
→ INDEPENDENT_AUDIT_PASS
→ 受控合并
→ 主线重新运行 Conformance
→ MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE
```

任何代码变化都必须重新固定、推送并审计完整远程 SHA。未经审计的对象不得合并；不得仅凭设计文档或局部测试宣称 V1 已生效。
