# Minimal Auth Foundation V1 文档入口

> 本文件是兼容旧路径的非规范入口，不再承载完整合同正文。

## 当前状态

```text
DESIGN_ID=MINIMAL_AUTH_FOUNDATION_V1
STATUS=FROZEN_TARGET_CONTRACT
CONTRACT_VERSION=1.0.0
ARCHITECTURE_DIRECTION_ACCEPTED=true
REDESIGN_REQUIRED=false
READY_FOR_IMPLEMENTATION_INVENTORY=true
READY_FOR_CONTRACT_BUNDLE_FREEZE=true
CONTRACT_BUNDLE_FROZEN=true
IMPLEMENTATION_AUTHORIZED=true
PRODUCTION_JWKS_DEPLOYMENT_READY=false
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE=false
CONSUMER_MIGRATION_IN_SCOPE_READY=false
```

原单文件设计已经拆分到 [`minimal-auth-v1/README.md`](./minimal-auth-v1/README.md) 及其六份模块合同。

拆分原因：

- 保持每份合同不超过 500 行；
- 避免 Machine Token、Trusted Proxy、V0 迁移与 Human Session 相互污染；
- 明确机器 Token 优先保持 V0 Wire Compatible；
- 将 Human Audience Grants 和 Human Refresh 生命周期独立冻结；
- 支持按模块进行窄范围合同审阅和 Conformance。

## 权威规则

1. 当前 V1 源码 Contract Bundle 已冻结并授权实现，但不代表生产或消费者迁移已生效。
2. V1 生效前，两份现有 V0 冻结合同继续有效。
3. 本入口文件不覆盖 `minimal-auth-v1/` 中任何规范内容。
4. 若本入口与模块合同冲突，以模块合同和其中定义的权威关系为准。
5. 只有窄范围合同审阅、Contract Bundle、真实进程 Conformance、固定远程 SHA 独立审计和主线重新验证全部通过后，才能宣布 V1 supersede V0。
6. `CONTRACT_BUNDLE_FREEZE`、`PRODUCTION_DEPLOYMENT`、`CONSUMER_MIGRATION` 是三个独立状态；源码冻结不证明生产 JWKS 或 Legacy 消费者迁移完成。

## 模块

- [`README.md`](./minimal-auth-v1/README.md)：状态、所有权、总体边界和生效门
- [`claims-and-profiles.md`](./minimal-auth-v1/claims-and-profiles.md)：Wire Claims、Token Profile、时间与离线验证
- [`grants-and-audiences.md`](./minimal-auth-v1/grants-and-audiences.md)：三类 Grants、Audience 和 Scope 严格语义
- [`delegation.md`](./minimal-auth-v1/delegation.md)：Proxy 输入 Audience、Exchange 与持久审计链
- [`v0-to-v1-migration.md`](./minimal-auth-v1/v0-to-v1-migration.md)：V0 兼容、CCR、消费者迁移和删除门
- [`conformance.md`](./minimal-auth-v1/conformance.md)：Contract Bundle 与真实进程验收
- [`human-session-refresh.md`](./minimal-auth-v1/human-session-refresh.md)：Human Session、Refresh Rotation 与 Token Family

不得再向本入口追加合同正文。后续修改必须进入对应模块，并保持跨文件 Conformance 一致。
