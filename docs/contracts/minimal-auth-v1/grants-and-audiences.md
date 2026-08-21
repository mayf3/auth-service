# Grants and Audiences

## 1. 状态

```text
STATUS=FROZEN_V1_CONTRACT
CONTRACT_VERSION=1.0.0
GRANT_MODEL=three_explicit_structures
SILENT_SCOPE_DOWNSCOPING=false
```

本模块冻结 Audience 注册表、Human/Machine/Delegation 三类授权结构，以及 Scope 的严格拒绝语义。

## 2. Audience 注册表

Contract Bundle 必须包含版本化 Audience 注册表。每个条目至少包含：

```text
audience_id
resource_service
scope_namespace
accepted_principal_types
status
```

Bundle Audience 清单：

```text
svc-workflow
svc-okr
adc-v2
svc-forum
```

`svc-forum` 经独立 CCR `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`（accepted）及
exact-commit 消费者迁移审阅（`mayf3/agent-forum@1cccdd54554c0bde13572273401f19f294334e46`）
加入本注册表，注册面冻结为 `forum.read` / `forum.write`，仅接受 machine agent 访问。

`llm-todo` 和 `workflow-todo` 不属于本轮 Audience 注册表；它们保持 Legacy/未迁移，未来必须通过独立 CCR 和消费者迁移审阅进入。

Audience 使用实际资源服务已经消费或将消费的 Wire ID，不使用仓库或产品展示名替代。`agent-forum` 是仓库/产品名，当前资源服务 Wire ID 是 `svc-forum`；`workflow-todo` 当前是调用 `svc-workflow` 的 Client，不是独立资源 Audience。若未来它拥有自己的资源服务入口，必须通过独立 CCR 注册新 Audience。

Audience ID 规则：

- JSON 类型为 string；
- 必须使用小写；
- 大小写敏感；
- 使用连字符，不使用下划线别名；
- 不得带尾部斜杠、查询参数或 fragment；
- `aud` Claim 必须是单个 string，不得是数组；
- 不得同时注册 `svc-okr` 与 `svc_okr` 等别名。

禁止将以下通用值作为多个资源服务共同接受的 Audience：

```text
unified-platform
all-services
*
```

Audience 只回答 Token 可以交给哪个资源服务，不表示该主体在服务内拥有何种业务权限。

## 3. 三类 Grants

V1 不建立通用策略语言，也不把 Human 与 Machine 强行塞进一个结构。

Client 的三类授权必须分别记录：

```json
{
  "human_audience_grants": [
    "svc-okr"
  ],
  "machine_access_grants": {
    "svc-workflow": ["workflow.read"]
  },
  "delegation_grants": {
    "svc-workflow": ["workflow.read"]
  }
}
```

固定边界：

| Grant | 适用 Client | 值语义 |
|---|---|---|
| `human_audience_grants` | Human Client | 允许签发的 Audience 集合，无 Scope |
| `machine_access_grants` | Agent/Service Client | 每个 Audience 可直接申请的 Scope 集合 |
| `delegation_grants` | Trusted Proxy Client | 每个目标 Audience 可代理申请的 Scope 集合 |

三类 Grants 不得相互推导或复用：

- Human Grant 不产生 Machine Scope；
- Machine Grant 不自动授予 Human Token；
- Direct Machine Grant 不自动成为 Proxy Delegation Grant；
- Delegation Grant 不授予 Proxy 对目标资源的业务权限。

## 4. Human Audience Grants

Human Client 默认没有任何 Audience 授权：

```text
human_audience_grants=[]
```

Human Access Token 签发必须满足：

1. User Principal active；
2. Human Client active；
3. Session 服务端绑定到该 User 和 Client；
4. 请求 Audience 存在于注册表；
5. 请求 Audience 精确存在于该 Client 的 `human_audience_grants`。

任意条件失败都不得签发。

以下推理均被禁止：

```text
Audience 已注册 → 所有 Human Client 可申请
User 已登录 → 可申请任意 Audience
某个 Machine Client 有授权 → 同 Principal 的 Human Client 也有授权
请求中带 client_id → Session 改绑到该 Client
```

`client_id` 必须由登录流程和 Session 的服务端绑定确定，不能由用户请求覆盖。

## 5. Machine Access Grants

Machine Client 对不同 Audience 的 Scope 必须成对保存：

```json
{
  "machine_access_grants": {
    "adc-v2": ["adc.read"],
    "svc-workflow": ["workflow.execute", "workflow.read"]
  }
}
```

禁止重新使用彼此独立、可能跨 Audience 错配的：

```text
allowed_audiences
allowed_scopes
```

Direct Machine Token 签发规则：

```text
requested_scopes != empty
machine_access_grants[target_audience] exists
machine_access_grants[target_audience] != empty
requested_scopes ⊆ machine_access_grants[target_audience]
final_scopes = requested_scopes
```

只要请求包含一个未获授权的 Scope，整次请求必须以 `invalid_scope` 拒绝。不得删除未授权项后签发较小 Scope。

## 6. Delegation Grants

Trusted Proxy Client 对目标 Audience 的代理上限必须独立保存：

```json
{
  "delegation_grants": {
    "svc-workflow": ["workflow.read"]
  }
}
```

Delegated/OBO 严格规则：

```text
requested_scopes != empty
requested_scopes ⊆ original_client.machine_access_grants[target_audience]
requested_scopes ⊆ proxy_client.delegation_grants[target_audience]
final_scopes = requested_scopes
```

任一子集检查失败都必须以 `invalid_scope` 拒绝整次 Exchange。不得自动求交集后静默缩减。

该行为相对 V0 的三方自动交集是显式 Contract Change Request，只有完成 `v0-to-v1-migration.md` 的消费者和主线生效门后才能启用。

## 7. Scope 注册与 Namespace

资源服务拥有 Scope 名称、语义和接口映射。auth-service 将 Scope 当作不透明字符串，只执行注册表和集合约束。

Audience 注册必须绑定一个规范 `scope_namespace`。例如：

```json
{
  "audience_id": "svc-workflow",
  "scope_namespace": "workflow"
}
```

该 Audience 的 Scope 必须以 `workflow.` 开头，例如：

```text
workflow.read
workflow.execute
workflow.admin
```

auth-service 不解释这些 Scope 对应哪些接口、Transition 或资源。

Scope 字符串必须匹配：

```text
^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$
```

第一个 `.` 之前的部分必须精确等于 Audience 注册的 `scope_namespace`。Scope 只允许 ASCII，排序使用无符号 ASCII byte 升序，不使用 locale-aware collation。

新增或变更 Scope 必须：

1. 由资源服务所有者定义语义；
2. 更新 Audience/Scope 注册表；
3. 更新 Contract Bundle；
4. 更新资源服务入口映射；
5. 更新正向和负向 Conformance。

## 8. Scope 请求格式

Token Endpoint 中的 Scope 请求使用单个字符串：

```text
scope=workflow.execute workflow.read
```

请求约束：

- 只使用单个 ASCII 空格 U+0020 分隔；
- 不允许前后空格；
- 不允许空项或重复项；
- Scope 大小写敏感；
- 不允许 `*`、前缀或 substring 匹配；
- 每项必须属于目标 Audience 的规范 Namespace；
- 请求顺序可以任意，但 Issuer 输出前必须去重检查并按无符号 ASCII byte 升序排序；
- 重复项不是可被静默修正的输入，必须拒绝。

Token 中的 `scope` 必须符合 `claims-and-profiles.md` 的规范 Wire Format。

## 9. 签发与管理边界

Grant 写入是安全敏感管理操作。正式 Contract Bundle 必须定义：

- 哪个管理入口可以创建、扩大、缩小或删除 Grant；
- 管理调用的领域授权和审批要求；
- 变更前后值、操作者、原因和时间的审计事实；
- Grant 缩小后已签 Token 最迟在 `exp` 失效；
- 批量授权和通配符被禁止。

auth-service 只拥有 Grant 事实，不因此拥有资源服务的产品授权。

V1 首个 Bundle 不提供在线 Grant 管理 API。Audience、Scope 和三类 Grant
只能由版本化数据库迁移写入，迁移必须来自固定 Git SHA，并携带：

```text
migration_id
operator_id
approval_ref
reason
expected_grant_version
before_value
after_value
timestamp
```

写入使用 `expected_grant_version` 做乐观并发检查，并在同一事务中写安全审计。
版本不匹配或审计写入失败时整次回滚。缩小或撤销授权使用新的前向迁移，不
允许通过无审计的数据库手改或回滚旧迁移恢复更大的授权。未来在线管理入口
必须通过独立 CCR 定义操作者认证、领域授权、审批和审计后才能启用。

## 10. 失败关闭

以下情况不得签发：

- Audience 不存在、inactive、大小写或别名不匹配；
- Human Audience 不在 `human_audience_grants`；
- Machine 目标 Audience 没有对应 Grant；
- requested scopes 为空、重复、格式不规范或 Namespace 错误；
- requested scopes 不是 Machine Grant 的子集；
- OBO requested scopes 不是原始 Client Machine Grant 的子集；
- OBO requested scopes 不是 Proxy Delegation Grant 的子集；
- 任意 Scope 检查失败后尝试自动缩减；
- 试图使用其他 Audience 的 Scope 语义或授权集合。

不得回退通用 Audience、旧 Role Claim、独立 allowed scopes 或消费者猜测。
