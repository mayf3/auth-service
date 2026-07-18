# Minimal Auth Foundation V1 Narrow Contract Review

## Review Status

```text
REVIEW_ID=AUTH_TOKEN_CONTRACT_V1_NARROW_REVIEW
REVIEW_SCOPE=contract-design-only
REVIEW_RESULT=PASS_WITH_PRE_FREEZE_NOTES
NARROW_CONTRACT_REVIEW_PASS=true
CONTRACT_BUNDLE_FREEZE=false
IMPLEMENTATION_AUTHORIZED=false
MAINLINE_EFFECTIVE=false
```

## Audited Object

```text
repository=/Users/yanfenma/workspace/project/auth-service
branch=codex/minimal-auth-v1-contract
remote_ref=refs/heads/codex/minimal-auth-v1-contract
commit=afef176eb5014b4bcccbbb70ec67df8f9a774b8b
tree=2bf62a064db09edef15fe6df3dbec63a1ac5ab11
audit_mode=remote-ref-verified-detached-worktree
```

远程 ref、当前本地提交和 detached audit checkout 三者均精确匹配上述完整 SHA。

## Scope

审阅对象：

- `docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md` 非规范入口；
- `docs/contracts/minimal-auth-v1/` 下七份模块合同。

明确排除：

- auth-service 实现是否满足 V1；
- 消费者是否已迁移；
- Contract Bundle 是否已经冻结；
- 生产运行状态；
- V1 主线生效声明。

## Review Criteria

1. 不无收益地改变 V0 Machine Token Wire Contract；
2. Human Audience Grant 与 Machine Scope Grant 分离；
3. Direct/OBO Scope 超额请求严格拒绝；
4. 签发时实时断言与资源服务离线验证分离；
5. Proxy 输入 Audience 与目标 Audience 分离；
6. 完整 Exchange Client 链可通过持久审计恢复；
7. 保留 `jti`、`nbf` 和既有 OBO Claims；
8. Human Session/Refresh 生命周期独立冻结；
9. Product Role 不进入 V1 Token；
10. 每份合同不超过 500 行且不存在双重权威。

## Findings Closure

### Previous Blocker 1: unnecessary Machine Wire rename

```text
status=CLOSED_IN_AUDITED_OBJECT
```

V1 保留 Direct `client_id`、`token_use=access`、`jti`、`nbf`，并保留 OBO `token_use=workflow_obo`、`act`、`azp`、`client_id`。

V1 不引入 `machine_access`、`delegated_access` Wire 枚举，也不要求 Direct Token 从 `client_id` 改为 `azp`。

### Previous Blocker 2: Human Audience authorization undefined

```text
status=CLOSED_IN_AUDITED_OBJECT
```

合同定义三个显式结构：

```text
human_audience_grants
machine_access_grants
delegation_grants
```

Human Client 默认无 Audience；Human `client_id` 由登录流程和 Session 服务端绑定。

### Previous High 1: ambiguous Scope downscoping

```text
status=CLOSED_IN_AUDITED_OBJECT
```

Direct 和 OBO 均要求 requested scopes 是授权集合的严格子集，任一越权项使整次请求失败，最终 Scope 精确等于请求集合。

Scope Wire 使用规范 ASCII grammar、单个 ASCII 空格和无符号 ASCII byte 排序。

### Previous High 2: issuance and offline verification mixed

```text
status=CLOSED_IN_AUDITED_OBJECT
```

auth-service 在签发时查询并断言 Client/Principal/Grant/Proxy 状态；资源服务只验证签名后的 Claim、时间、Profile、Scope 和领域授权，不逐请求查询 auth-service。

### Previous High 3: Proxy input audience and audit chain missing

```text
status=CLOSED_IN_AUDITED_OBJECT
```

Proxy 注册包含 `accepted_subject_audiences` 和 target-audience `delegation_grants`。持久 Exchange 审计记录连接原始/代理 Principal、Client 和 Source/OBO `jti`。

### Previous High 4: time and Refresh semantics incomplete

```text
status=CLOSED_IN_AUDITED_OBJECT
```

合同保留并约束 `iat`、`nbf`、`exp`、`jti`。Human Refresh 独立定义 verifier-only storage、固定有效期、每次轮换和 Token Family 重放撤销。

### Previous High 5: monolithic document

```text
status=CLOSED_IN_AUDITED_OBJECT
```

新规范目录正好七个模块文件；最长文件 311 行。旧路径只保留 45 行非规范入口。

## Automated Detached Checks

```text
REMOTE_DETACHED_NARROW_CHECK=PASS
MODULE_FILE_COUNT=7
MAX_MODULE_LINES=311
BROKEN_RELATIVE_LINKS=0
TRAILING_WHITESPACE_FINDINGS=0
V0_FORMAL_CONTRACT_FILES_CHANGED=0
FORBIDDEN_NEW_TOKEN_USE_ENUMS=0
READY_FOR_CONTRACT_BUNDLE_FREEZE_TRUE_OCCURRENCES=0
CURRENT_MAINLINE_EFFECTIVE_TRUE_OCCURRENCES=0
```

## Pre-Freeze Notes

以下不是目标架构 Blocker，但必须在 Contract Bundle Freeze 前完成：

1. 固定精确 Issuer、Audience 注册表、Scope Namespace、TTL、Clock Skew 和 JWKS Cache 参数；
2. 固定 Human Client 登录/证明方式，不能只依赖请求提供 Client ID；
3. 固定 OAuth request/response/error JSON Schema；
4. 固定 Exchange Audit 持久化 Schema、访问控制和失败一致性；
5. 逐消费者盘点 algorithms、claims、principal types、token uses、fallback 和领域授权来源；
6. 为所有真正不兼容行为建立消费者、遥测、截止日期和删除门。

## Conclusion

```text
ARCHITECTURE_DIRECTION_ACCEPTED=true
REDESIGN_REQUIRED=false
NARROW_CONTRACT_REVIEW_PASS=true
READY_FOR_IMPLEMENTATION_INVENTORY=true
READY_FOR_CONTRACT_BUNDLE_FREEZE=false
IMPLEMENTATION_AUTHORIZED=false
```

下一阶段应先完成当前实现与消费者盘点，并据此产生可机器执行的 Contract Bundle。不得跳过盘点直接修改签发器或消费者。
