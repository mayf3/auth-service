# Minimal Auth Foundation V1 Draft Bundle Narrow Review

## 1. Verdict

```text
REVIEW_DATE=2026-07-18
REVIEW_RESULT=PASS_AS_DRAFT_WITH_OPEN_FREEZE_GATES

BUNDLE_NARROW_REVIEW_PASS=true
DRAFT_ARTIFACT_BLOCKER=0
DRAFT_ARTIFACT_HIGH=0
OPEN_FREEZE_GATE=6

CONTRACT_BUNDLE_DRAFT_READY=true
CONTRACT_BUNDLE_FROZEN=false
CONTRACT_BUNDLE_FREEZE_ALLOWED=false
IMPLEMENTATION_AUTHORIZED=false
MAINLINE_EFFECTIVE=false

REMOTE_DETACHED_AUDIT_PASS=true
INDEPENDENT_REVIEWER_PASS=false
```

结论只适用于 Draft Bundle 的内部完整性和与七份候选合同的一致性。它不关闭
独立审阅、部署参数、消费者远程 SHA 或消费者领域授权门，也不授权实现或迁移。

## 2. 固定审阅对象

```text
repository=auth-service
remote=ssh://root@<SERVER_IP>/opt/git/auth-service.git
remote_ref=origin/codex/minimal-auth-v1-contract
audited_sha=89d1d3afa1dfad8bf6328d225e1e90a5ede16022
audited_tree=000e91c3f77bb36e3e6ef44200a26ce4c3363ffa
```

审阅从远程重新 fetch 后 detached 到上述完整 SHA。工作区未引用本地未提交文件。

## 3. 审阅范围

本次只审阅：

- `contract-bundles/minimal-auth-v1/` 的 Manifest、Audience Registry、Schemas、
  Fixtures、Consumer Matrix、Freeze Gates、Change Log 和 Runner；
- Bundle 与 `docs/contracts/minimal-auth-v1/` 七份模块的 Claim、Grant、Scope、
  Proxy、Session、Refresh 和生效状态是否一致；
- Bundle 是否会在冻结门未关闭时错误允许 `frozen=true`；
- 所有合同文件是否不超过 500 行，Bundle 根目录是否保持七个直接子项。

不在范围内：

- auth-service 当前代码是否符合 V1；
- 任一消费者是否已迁移；
- 数据库迁移、部署配置或真实进程 Conformance；
- 生产 JWKS Origin、密钥或 Secret Store；
- 合并和生产切换授权。

## 4. 验证结果

远程 detached 对象运行：

```text
npm run contract:v1:validate
npm run build
JSON Schema 2020-12 meta-schema validation
Audience Registry schema validation
positive token fixture schema validation
all contract files <= 500 lines
bundle root direct children = 7
git diff --exit-code
git status --porcelain
```

关键结果：

```text
MINIMAL_AUTH_V1_BUNDLE_VALID=true
CONTRACT_BUNDLE_FROZEN=false
FREEZE_BLOCKER_COUNT=6
SCHEMA_COUNT=7
POSITIVE_FIXTURE_COUNT=4
NEGATIVE_FIXTURE_COUNT=12
JSON_SCHEMA_META_AND_FIXTURE_VALID=true
ALL_CONTRACT_FILES_LE_500=true
```

## 5. 合同一致性裁决

### 5.1 V0 Machine Wire 保留

Bundle 保留并由 Runner 检查：

```text
client_id
jti
nbf
Direct token_use=access
OBO token_use=workflow_obo
OBO act / azp / client_id
```

没有引入 `machine_access`、`delegated_access` 或 `client_id -> azp` 的无收益
双协议迁移。

### 5.2 三类 Grant 与严格 Scope

`grants.schema.json` 分开表达 Human Audience、Machine Access 和 Delegation
Grants。正负 Fixture 证明：

- Human Token 无 Scope；
- Scope 使用单个 ASCII 空格、禁止重复并按 ASCII byte 排序；
- Direct 任一 Scope 未授权时整次拒绝；
- OBO 原始 Client 或 Proxy 任一方授权不足时整次拒绝；
- 不允许自动求交集后静默 downscope。

### 5.3 Human Client 与 Session

审阅前修正了一个建模歧义：Human Client 是登录应用，不预先归属于某个 User；
完成登录后 Session 才固定 User + Client。首个 Bundle 使用 Authorization Code +
PKCE S256，Public 和 Confidential Client 都必须 PKCE，后者额外使用
`client_secret_basic`。

Authorization Code 与 Refresh Credential 使用 ID + 256-bit Secret 的 opaque
格式，数据库只保存 verifier。Refresh 绑定 Session/User/Client/Family，轮换与
重放撤销规则仍与独立 Human 合同一致。

### 5.4 Proxy 与审计链

Trusted Proxy Schema 明确 Proxy Principal 必须是 `service`，包含
`accepted_subject_audiences` 和独立 `delegation_grants`。Exchange Audit Schema
连接原始/Proxy Principal、Client、source/delegated `jti`、Audience 和 Scope。
审计持久写入失败不得返回 Token 的事务要求没有被降级成日志建议。

### 5.5 管理面最小化

首个 Bundle 不开放在线 Grant 管理 API。Grant 只允许由固定 Git SHA 的版本化
数据库迁移变更，要求操作者、审批、原因、before/after、乐观版本和同事务审计；
撤销或缩小授权只用前向迁移。这避免在 V1 同时引入一套未冻结的管理控制面。

## 6. 审阅中已修正的问题

以下问题在固定审阅对象前已修正，因此不作为残留 Finding：

1. Human Client 曾错误沿用 Machine `client_id -> principal_id` 模型；
2. Public/Confidential Client proof 只留了占位描述；
3. Grant 管理入口、并发、审计和回滚规则未机器化；
4. OAuth 缺 Human Refresh 请求/响应、opaque wire format、错误 HTTP 状态和
   no-store/no-cache 头；
5. OBO Fixture 未证明 source Audience 自身的 Machine Grant；
6. Trusted Proxy Schema 未显式约束 Service Principal。

## 7. 仍然开放的 Freeze Gates

| Gate | 状态 | 关闭所需证据 |
|---|---|---|
| Remote consumer SHAs | OPEN | 固定 `svc-forum`、当前 `llm-todo`、`workflow-todo`、Broker 候选的远程完整 SHA |
| Exact JWKS URL | OPEN | 部署 Owner 给出生产 HTTPS Origin 与最终 JWKS URL |
| Runtime parameter review | OPEN | 对 cache/stale/session/refresh/scrypt/retention 候选值完成窄审 |
| llm-todo authorization matrix | OPEN | Owner 冻结 accepted principal types、Scope 语义和逐路由领域授权 |
| adc-v2 ingress scope | OPEN | Owner 冻结 source Audience 的 Scope 与入口映射 |
| Independent Bundle review | OPEN | 独立 Reviewer 对固定远程 SHA 明确 PASS |

这些 Gate 是有意的 fail-closed 状态。当前不得把 `frozen=false` 改成 `true`，也
不得把本报告的 Draft PASS 描述为 Contract Freeze 或实现验收。

## 8. 下一步门

```text
DRAFT_BUNDLE_REMOTE_SHA_FIXED=true
DRAFT_BUNDLE_INTERNAL_REVIEW_PASS=true
READY_TO_CLOSE_EXTERNAL_FREEZE_GATES=true

READY_FOR_CONTRACT_BUNDLE_FREEZE=false
READY_FOR_ISSUER_IMPLEMENTATION=false
READY_FOR_CONSUMER_MIGRATION=false
```

下一步应先关闭上述六个 Gate；任何 Gate 的合同内容发生变化后，必须重新推送
完整 SHA、重新运行 Bundle Validator 和窄范围审阅。
