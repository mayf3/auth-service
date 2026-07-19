# Minimal Auth V1 ADC V2 Ingress Scope Review

## 1. Verdict

```text
REVIEW_DATE=2026-07-18
REVIEW_RESULT=PASS
ADC_V2_INGRESS_SCOPE_GATE_CLOSED=true

SOURCE_AUDIENCE=adc-v2
SOURCE_SCOPES=adc.read,adc.execute
TARGET_AUDIENCE=svc-workflow
TARGET_SCOPES=workflow.read,workflow.execute

CONTRACT_BUNDLE_FROZEN=false
IMPLEMENTATION_AUTHORIZED=false
```

原 Draft 的 `adc.invoke` 把全部受保护入口压成一个过宽 Scope，不能证明读调用与
写/状态转换调用的最小权限边界。本次基于固定远端 ADC V2 路由面，将其替换为
`adc.read` 和 `adc.execute`。

## 2. 固定证据对象

```text
repository=/Users/yanfenma/workspace/project/adc-v2
remote_refs=server/main,canary/main
git_sha=ddeeab2ff394af64b78d9820c9e64d5bf0952ebd
git_tree=6b7e69217cac99b381876e85750dea588ae501fd
route_file=backend/src/v2/app.ts
gateway_file=backend/src/v2/svc-workflow/gateway.ts
```

该 SHA 的 V2 运行时没有本地业务数据库或本地 Workflow Authority；受保护入口
只把调用映射到 `svc-workflow`。`health` 和只公开非敏感场景选择的
`definition-bindings` 不消费 Bearer。

## 3. 冻结映射

| ADC V2 入口 | Source Scope | Exchange Target Scope |
|---|---|---|
| `GET /api/v2/worklist` | `adc.read` | `workflow.read` |
| `GET /api/v2/workflow-instances/:id` | `adc.read` | `workflow.read` |
| `GET /api/v2/workflow-instances/:id/timeline` | `adc.read` | `workflow.read` |
| `POST /api/v2/workflow-instances` | `adc.execute` | `workflow.execute` |
| `POST /api/v2/workflow-instances/:id/transitions` | `adc.execute` | `workflow.execute` |

机器可执行版本位于
`contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json`。

固定规则：

1. ADC 先离线验证 source Token 的 `aud=adc-v2` 和 V1 Direct Agent Profile；
2. ADC 先检查入口对应的 `adc.read` 或 `adc.execute`；
3. ADC 只能按映射申请一个目标 Scope，不得把 source Scope 字符串直接复制为
   target Scope；
4. auth-service 仍严格验证原始 Client 的 target Machine Grant 与 Proxy 的
   Delegation Grant，任一不足整次拒绝；
5. OBO `sub` 保持原始 Agent，svc-workflow 继续执行领域授权；
6. Public 路由不得创建 Exchange 或取得 OBO Token。

## 4. 为什么不是单一 `adc.invoke`

单一 Scope 会让只有读取需求的 Client 同时拥有创建 WorkflowInstance 和执行
Transition 的入口能力。虽然 svc-workflow 领域授权仍可拒绝具体操作，这仍违反
入口最小权限原则，也使 Proxy Delegation 遥测无法区分 read 与 execute。

`adc.read` / `adc.execute` 与下游既有 Scope 类别一一对应，但保持不同
Namespace，避免把 source Audience 的授权误当成 target Audience 的授权。

## 5. 非目标与变更门

本次没有赋予 ADC 业务权限，没有把 Scope 当作 owner/assignee/transition
authorization，也没有改变公开绑定列表的业务内容。

若新增受保护路由，必须在实现前明确归入 read、execute，或通过 CCR 注册新
Scope；不得默认继承任一现有 Scope。若路由调用多个下游 Audience，也必须通过
CCR 扩展映射，不能在 Proxy 中动态猜测。

## 6. 状态

```text
ADC_V2_ROUTE_SURFACE_INVENTORIED=true
ADC_V2_SCOPE_MAP_MACHINE_EXECUTABLE=true
ADC_V2_INGRESS_SCOPE_REVIEW_PASS=true
ADC_V2_INGRESS_SCOPE_GATE_CLOSED=true

ADC_V2_IMPLEMENTATION_READY=false
CONTRACT_BUNDLE_FREEZE_ALLOWED=false
```
