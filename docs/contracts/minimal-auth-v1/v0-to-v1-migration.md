# V0 to V1 Migration

## 1. 状态

```text
STATUS=DRAFT_V1_MODULE
CONTRACT_VERSION=1.0.0-draft.2
V0_CONTRACTS_REMAIN_GOVERNING_UNTIL_V1=true
V0_PRODUCTION_EFFECTIVE=unproven
V1_CURRENTLY_EFFECTIVE=false
MACHINE_WIRE_COMPATIBILITY=required
INDEFINITE_DUAL_PROTOCOL=false
```

本模块定义 V0 与 V1 的权威关系、真正必要的不兼容变化、消费者迁移和删除门。

## 2. 生效前后的权威关系

在 V1 主线生效前：

```text
WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0 governs Direct Workflow Machine Token
WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0 governs Workflow OBO Token
minimal-auth-v1 is draft target contract only
```

在全部门禁通过并宣布 `MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE` 后：

```text
V1 supersedes V0 for covered token profiles
V0 becomes historical migration evidence
no new V0 consumer may be added
```

不得仅通过合并文档、实现局部字段或跑通 auth-service 单测宣布 V1 生效。

## 3. 不做的 Wire 变化

V1 明确不执行以下重命名或删除：

| V0 | V1 决定 | 原因 |
|---|---|---|
| Direct `client_id` | 保留 | 已冻结且有运行价值 |
| Direct `token_use=access` | 保留 | Profile 可由 `principal_type` 区分 |
| OBO `token_use=workflow_obo` | 保留 | 已是稳定 OBO 判别值 |
| `jti` | 保留 | 审计和事故关联仍需要 |
| `nbf` | 保留 | 已实现且支持明确时间边界 |
| OBO `act` / `azp` / `client_id` | 保留 | 避免重写现有消费者和审计 |
| `type=access` / `version` | 保留 | 无删除收益，维持兼容 |

V1 文档名称可以使用 Human、Machine、Delegated Access Token，但不以名称变化改写线上枚举。

## 4. Wire 兼容矩阵

### 4.1 Direct Agent Machine Token

| 维度 | V0 | V1 |
|---|---|---|
| `client_id` | 存在 | 保持 |
| `azp` / `act` | 不存在 | 保持不存在 |
| `token_use` | `access` | 保持 |
| `jti` / `nbf` | 存在 | 保持 |
| RS256 + `kid` | Workflow Audience | 扩展到全部 V1 Audience |
| Scope | 子集；空 Scope 可签 | 严格子集；空 Scope 拒绝 |
| TTL | 默认 10 分钟、硬上限 15 分钟 | 最大 10 分钟 |
| Grant 存储 | 独立 resources/scopes | Audience-scoped machine grants |

Claim 名和值保持兼容。真正变化是签发策略、Scope 失败语义和 Grant 数据模型。

### 4.2 Service Machine Token

Service Token 是 V1 新 Profile：

| 维度 | 值 |
|---|---|
| `principal_type` | `service` |
| Wire 结构 | 与 Direct Machine Token 相同 |
| `agent_id` | 不存在 |
| `client_id`, `jti`, `nbf` | 存在 |
| `token_use` | `access` |

这是 `principal_type` 的受控枚举扩展。消费者必须显式声明允许 `agent`、`service` 或两者，不能默认放行新类型。

### 4.3 OBO Token

| 维度 | V0 | V1 |
|---|---|---|
| Claims | `act` + `azp` + `client_id` | 保持 |
| `token_use` | `workflow_obo` | 保持 |
| Source Audience | 固定 `svc-workflow` | Proxy 注册的 accepted source audience |
| Target Audience | 固定 `svc-workflow` | Proxy delegation grant 中的精确 Audience |
| Scope | 自动三方交集 | 严格子集，不自动缩减 |
| Audit | best-effort stderr | 持久不可篡改 Exchange 事实 |

OBO Claim Wire Format 保持兼容；跨 Audience Exchange、严格拒绝和持久审计是显式行为变更。

### 4.4 Human Token

Human V1 是必要的新 Profile，不假装与 Legacy Human Token Wire Compatible：

| 维度 | Legacy Human | V1 Human |
|---|---|---|
| 算法 | HS256 | RS256 + `kid` |
| Audience | 通用或调用方覆盖 | 精确单 Audience |
| `principal_type` | 缺失 | `user` |
| `client_id` | 不稳定/缺失 | 服务端 Session 绑定 |
| `token_use` | 缺失 | `access` |
| `jti` / `nbf` | `jti` 有、`nbf` 不稳定 | 两者必需 |
| 产品 Role | 存在 | 禁止 |
| TTL | 长期 Legacy 配置 | 最大 15 分钟 |
| Refresh | Legacy JWT/进程状态 | 独立 Session/Refresh 合同 |

Human Token 迁移必须逐消费者盘点，不能通过资源服务静默接受两种算法完成。

## 5. 显式 Contract Change Requests

### CCR-V1-001：Audience-scoped Grants

```text
allowedResources + allowedScopes
→ human_audience_grants
  + machine_access_grants[audience]
  + delegation_grants[audience]
```

原因：消除跨 Audience Scope 错配，并独立表达无 Scope 的 Human 授权。

### CCR-V1-002：Strict Scope Rejection

变化：

- Direct empty scope 从允许改为拒绝；
- 非规范、重复 Scope 从归一化改为拒绝；
- OBO 从自动交集改为任一超额即拒绝；
- OBO 省略 Scope 时不再默认继承 Source Scope，而是拒绝；
- 最终 Scope 等于请求 Scope。

调用方必须能处理 `invalid_scope`，不得依赖返回值静默缩减。

### CCR-V1-003：Cross-Audience Trusted Proxy

新增：

- `accepted_subject_audiences`；
- target-audience delegation grants；
- source `client_id` 到原始 Machine Grant 的服务端解析；
- 持久 Exchange 审计链。

### CCR-V1-004：Minimal Human Profile

新增 RS256、精确 Audience、`principal_type=user`、服务端 `client_id`、短 TTL，并移除产品 Role。Refresh 迁移见独立模块。

### CCR-V1-005：Service Principal

Principal 类型增加 `service`，但不扩大任何资源服务入口。每个消费者必须显式选择是否接受。

## 6. 消费者盘点要求

进入某个消费者的迁移前必须逐服务、逐入口记录：

```text
consumer repository
fixed remote SHA
accepted issuer
accepted audiences
accepted algorithms
required claims
accepted principal_type
accepted token_use
scope parser and endpoint mapping
domain authorization source
legacy fallback path
migration owner
cutover and deletion gate
```

本轮 Contract Bundle/Conformance 首批固定范围：

```text
svc-workflow
svc-okr
ADC V2
auth-service 自身管理入口
```

以下对象保持 Legacy/未迁移，不阻塞本轮源码 Bundle Freeze：

```text
svc-forum
workflow-todo
llm-todo
OpenClaw Credential Broker candidate
```

它们缺少远程 SHA 或授权矩阵只阻塞各自未来的 `CONSUMER_MIGRATION`。

不得从中间件“看起来支持”推断数据迁移、生产配置或完整路由已经可切换。

## 7. 迁移阶段

### Phase 0：合同审阅

- 本目录窄范围审阅通过；
- 所有 CCR 有明确结论；
- 无双重权威和未定义字段；
- 每个文件不超过 500 行。

### Phase 1：实现与消费者盘点

- 固定 auth-service 和首批范围消费者远程 SHA；
- 建立逐入口验证矩阵；
- 识别 Product Role、通用 Audience、HS256 和 fallback 依赖；
- 不修改消费者。

### Phase 2：Contract Bundle Freeze

- 冻结 Manifest、JSON Schema、JWKS 参数、错误合同和测试夹具；
- 所有真正不兼容变化有迁移 owner 和截止门；
- 独立审阅通过后才允许实现。

### Phase 3：发行方实现

- 先实现新数据结构和签发路径；
- 不静默删除 Legacy；
- 所有代码先推送远程完整 SHA，再独立审计；
- 代码变化后重新审计。

### Phase 4：消费者迁移

- 按固定消费者清单逐个迁移；
- 运行真实服务进程正向、负向和领域授权测试；
- 记录 Legacy/V1 调用遥测；
- 未证明的消费者不得标记完成。

### Phase 5：受控切换与删除

- V1 Issuer、Consumer 和 JWKS 同时就绪；
- 新 ingress 端到端证明；
- Legacy 流量为零并持续满足冻结窗口；
- 删除门独立审计通过；
- 主线重新运行 Conformance 后宣布 V1 生效。

## 8. 双协议与回滚

迁移窗口可以存在受控双协议，但必须：

- 按显式验证模式选择，不允许“V1 失败后尝试 Legacy”；
- V1 模式检测到共享 HS256 fallback 必须启动失败；
- 每种模式具有独立遥测；
- 有固定截止日期和删除责任人；
- 不允许永久双协议。

回滚只能通过受控部署配置切回上一个已审计版本，不能在单次请求验证失败后自动降级算法、Audience 或 Claim 要求。

## 9. 主线生效门

只有全部为真才允许 V1 supersede V0：

```text
NARROW_CONTRACT_REVIEW_PASS=true
CONTRACT_BUNDLE_FROZEN=true
ALL_CONSUMERS_INVENTORIED=true
ALL_REQUIRED_MIGRATIONS_COMPLETE=true
REAL_PROCESS_CONFORMANCE_PASS=true
DOMAIN_AUTHORIZATION_NEGATIVE_PASS=true
LEGACY_TRAFFIC_ZERO_GATE_PASS=true
REMOTE_EXACT_SHA_AUDIT_PASS=true
MAINLINE_RECONFORMANCE_PASS=true
```

任何一项未知、部分通过或只由报告声称，都不得宣布 `MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE`。
