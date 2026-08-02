# Minimal Auth V1 llm-todo Authorization Candidate

## 1. Status

```text
INVESTIGATION_DATE=2026-07-18
ROUTE_INVENTORY_COMPLETE=true
CANDIDATE_MATRIX_MACHINE_EXECUTABLE=true
OWNER_DECISIONS_REMAIN=true

LLM_TODO_AUTHORIZATION_GATE_CLOSED=false
LLM_TODO_FREEZE_READY=false
CONTRACT_BUNDLE_FROZEN=false
```

本报告把固定代码中的所有入口归入候选授权类别，但不把当前宽松行为解释为产品
意图。当前代码存在全局 optional auth、协议自动 fallthrough、静态 API Key 和
无认证写入口，因此只能用于发现入口，不能直接成为冻结授权规则。

## 2. 固定调查对象

```text
repository=llm-todo
git_sha=7cc746240ba15161a5350bbe4c6d8fb88f41f5c6
git_tree=b45dc35aa7b3148a314c9d856efdb17b94387650
remote_ref_for_current_sha=none
```

当前本地 SHA 不在 `server` refs，因此它仍同时受 Remote Consumer SHA Gate
约束。机器可执行候选位于
`contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json`。

## 3. 候选 Principal 与 Scope

```text
audience=llm-todo
candidate_principal_types=user,agent,service
candidate_scopes=todo.read,todo.write,todo.invoke,todo.admin
```

- `todo.read`：任务、评论、附件、关系、工作列表、能力请求的受控读取；
- `todo.write`：基于 creator/assignee/assignment/owner/matched-agent 的业务写入；
- `todo.invoke`：Chat、Analyze、Compile 及其历史，包含外部模型成本或批量导出；
- `todo.admin`：Webhook、Trace、Audit、Archive、模板/偏好、用户列表和分配管理。

Human Token 没有 Scope。Human 访问同一入口时仍必须有 `aud=llm-todo`，然后由
本地 Principal、Role、资源关系和状态做领域授权。Machine Token 除相同领域授权
外，必须先满足上面的入口 Scope。

## 4. 当前 Stop-the-line 缺口

1. `ssoAuth` 依次尝试本地 API Key、auth-service HS256、Legacy SSO、ADC JWT，
   失败时按请求自动 fallthrough；
2. `tokenBinding` 无 Token 时放行，`X-Todo-Client` 只识别浏览器形态，不是认证；
3. Todo comment、attachment、draft、template、chat、webhook、compile 等多类写入
   没有统一 required auth；
4. Capability 子系统另有只认 `x-api-key` 的认证器；
5. `/api/agent/sso-login` 不校验 issuer/audience 并可依据 Token Role 自动建本地
   User，`/sync` 没有入口认证；
6. `users` 初始化包含可预测静态 API Key，任何上线数据库必须轮换并移除种子值；
7. Local Role、creator、assignee、reviewer 混用整数 ID、名称、legacy agent_id
   和 UUID，尚未稳定绑定 V1 `sub`；
8. 安全审计写入失败被 best-effort 吞掉，不适用于管理或高风险写入。

这些问题必须先以显式 V1 Auth Mode 修复；不得先删除 Legacy Credential，再让未
覆盖路由变成不可用或匿名。

## 5. 本地领域授权必须保留

V1 不把以下事实放进 Token：

```text
task creator / assignee / assignment
capability owner / requester / matched agent
task review assigned reviewer and self-review rule
local administrator / manager role
compile and chat quota
webhook ownership
archive and audit visibility
```

llm-todo 应新增稳定本地 Principal 映射，以 auth-service `sub` 为外部唯一键；
产品 Role 与资源关系继续由 llm-todo 持有。`todo.admin` 只是管理入口上限，不能
自动产生本地管理员身份。

## 6. 需要 Owner 裁决的五项

1. `user`、`agent`、`service` 是否都应被该 Audience 接受；
2. Capability/Provider discovery 哪些字段可匿名公开；
3. Chat、Analyze、Compile 的额度、可见数据和导出边界；
4. 本地管理员的授予、审批和 break-glass 流程；
5. Preferences/Templates/Archive/Webhook/Trace 是否全部归 `todo.admin`，还是
   存在对象 Owner 级写入。

这些是产品授权事实，无法从当前“默认放行”代码可靠推断。在 Owner 明确裁决前，
`freeze_ready` 必须保持 false，Gate 不得关闭。

## 7. 推荐迁移序列

```text
固定当前远程 SHA
→ Owner 裁决五项
→ 冻结逐路由 Matrix
→ 增加 local principal(sub) 映射与本地 Role
→ 增加显式 V1 RS256/JWKS Auth Mode
→ 所有非 public 路由 required auth
→ Machine Scope guard + Human no-Scope path
→ 修复领域授权与安全审计
→ Shadow/Canary 对比
→ Legacy/API Key 零流量证明
→ 删除 fallthrough 和静态 Credential
```

## 8. Current gate

```text
LLM_TODO_ROUTE_CANDIDATE_COMPLETE=true
LLM_TODO_OWNER_REVIEW_REQUIRED=true
LLM_TODO_REMOTE_SHA_REQUIRED=true

LLM_TODO_AUTHORIZATION_GATE_CLOSED=false
CONTRACT_BUNDLE_FREEZE_ALLOWED=false
```
