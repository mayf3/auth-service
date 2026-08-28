# auth-service governing Specs

`docs/specs/` 是 `mayf3/auth-service` 采用 Development Governance 后唯一的 governing Spec 目录。

## Lifecycle

```text
proposed
accepted
superseded
```

Lifecycle 写在 Spec frontmatter 中，不通过移动文件表达。只有 exact content 已被授权 actor 接受并合入 `main` 后，`status: accepted` 才是活动 authority。

## Implementation rule

非机械性 implementation 只有在以下条件全部满足时才允许开始：

```text
Spec is present in implementation base
status = accepted
implementation_authority = contracts
requested change is within Contract scope
no higher-authority conflict
```

Program 或 governance adoption Spec 使用 `implementation_authority: none` 时，不授权产品实现。

## Current index

| Spec ID | Kind | Status | Implementation authority | Purpose |
|---|---|---|---|---|
| `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` | implementation | accepted | contracts | 两阶段 canary Grant supply：Stage W（svc-workflow 2 行）与 Stage F（svc-forum `forum.read` + `forum.write`）source implementation 已在 main；source merge 不证明 production Grant apply |
| `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_STAGE_W_EXECUTION_V1` | implementation | superseded | contracts | 已由 Stage W Execution V2 whole-Spec supersede；保留为历史 accepted authority。 |
| `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_STAGE_W_EXECUTION_V2` | implementation | accepted | contracts | Stage W Execution V1 的 whole-Spec successor；仅将 Client ID 扩为精确 24 位无 padding base64url。 |
| `AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1` | implementation | accepted | contracts（仅 CTR-RES-009 冻结的三文件闭包） | Agent Core deterministic `external_ref` 的 authenticated read-only Principal/Client discovery；exact key、PRESENT/ABSENT、fail-loud、closed projection；不授权 mutation、Grant、deploy 或 production apply |
| `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1` | implementation | accepted | contracts（仅 CTR-NIC-001 冻结的 15 文件闭包） | `agent-core-notification-ingress-v1` Audience 注册（Bundle `1.3.0` -> `1.4.0`）的 exact 15 文件实现闭包子 Spec；4 个 runtime/candidate linkage 文件并入闭包；`LIMITED_RUNTIME_COMPATIBILITY_CHANGE` 仅限 allowlist 追加 `1.4.0`；不创建 Principal/Client/Credential/Grant，不 production apply |
| `AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` | invariant | accepted | none | 精确 vendoring 并采用共享开发治理；不改变产品行为 |
| `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` | implementation | accepted | contracts（仅 CTR-FMG-014 冻结的 18 文件闭包；实现 base 必须含已合并 conformant 的 Bundle `1.4.0` —— 当前被前置 PR #29 阻塞，READY_FOR_IMPLEMENTATION = NO；production apply 另行授权） | 唯一版主 Client `agt_course-community-agent-2`（`mc_hvEfjkJ5BTKA8HZXRmbzNVw0`，2026-08-28 生产只读已确认 exact Principal UUID `9f7cf4c5-…`、唯一 client 绑定、现 grant `[forum.read,forum.write]@v1`）的 `svc-forum` 唯一增量 `forum.moderate`：reserved Bundle `1.4.0` 之后注册 `1.5.0`（audience `registered_scopes` += `forum.moderate`）+ 单行 grant replace v1→v2 + 同事务 13-field closed-envelope audit；plan/apply/verify 分阶段 fail-closed、conflict fail-closed、exact rerun NOOP、forward-only rollback、secret 零披露；`forum.admin`/wildcard/Workflow grant/其余 fleet Client/Principal·Client·Credential 修改/`mc_oc_*` 全禁；production apply 另行授权。已 whole-supersede 三个 svc-forum 先行 Spec（CCR / VERSION_LINKAGE / REGISTRY_RECONCILIATION）并原子回填 backlink |
| `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` | implementation | accepted | contracts（仅 §5 冻结五文件范围） | ownerless agent direct-token profile 与数据库 CHECK 联合修复；封闭五文件实现范围 |
| `AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1` | implementation | accepted | contracts | exact-86 trusted fleet Grant supply（Phase A 恢复的 86 Client）：每 Client `svc-workflow[workflow.read]` + `svc-forum[forum.read, forum.write]` 一次性完整 grant-set create（v1）；Build-in-Public fleet canary 先行、same-transaction closed-envelope audit、exact rerun NOOP、conflict fail-closed；绑定 CLIENT_MAPPING_SHA256 与 GRANT_PLAN_SHA256 |
| `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1` | implementation | superseded | contracts（仅 CTR-FR-009 冻结的 13 个 Auth 文件 + 8 个 Forum 文件范围） | 已由 `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` whole-Spec supersede；保留为历史 accepted authority。 |
| `AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` | implementation | superseded | contracts（仅 CTR-RR-001 冻结的三文件闭包） | 已由 `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` whole-Spec supersede；保留为历史 accepted authority。 |
| `AUTH_SERVICE_SVC_FORUM_LEGACY_GRANT_NARROWING_V1` | implementation | accepted | contracts（仅 CTR-NG-001 冻结的三文件闭包：`scripts/narrow-svc-forum-legacy-grant-v1.ts`；`scripts/run-svc-forum-legacy-grant-narrowing-v1-conformance.sh`；`tests/oauth/narrow-svc-forum-legacy-grant-v1.test.ts`） | svc-forum 遗留 Grant 最小降权子 Spec；preserved implementation 当前不 conformant、未获 merge authority，production apply 不因 acceptance 自动授权 |
| `AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1` | implementation | superseded | contracts（仅 CTR-VL-002 冻结的 18 文件闭包） | 已由 `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` whole-Spec supersede；保留为历史 accepted authority。 |
| `AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1` | implementation | accepted | contracts（仅 CTR-AW-007 冻结的 16 文件闭包） | 注册 `agent-wake` Audience（machine-only、agent-profile、仅 `agent.wake` scope）的 bounded child CCR：冻结 exact entry、versioned registry delta + 版本联动、positive/negative conformance 与 16 文件 exact implementation closure（含 validate.mjs first-wave 集合 gate 单行 delta，PROVEN_NECESSARY）；不创建 Client、不写 Grant、零生产效果。五 Spec 单向依赖链（WAKE → PR #31 identity → svc-workflow PR #14 → dsh-agent-core PR #83 → PR #87）的根节点 |
| `AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1` | implementation | accepted | contracts（仅 §3.1 PLAN/APPLY/VERIFY 执行契约；APPLY 轮仍需独立 owner 授权） | 专用 system Agent `agt_workflow-dispatcher-hr-agent` 的独立 Principal/Client/exact 最小 grant 面（svc-workflow[workflow.read] + agent-wake；workflow.execute/admin 与一切 scheduler scope FORBIDDEN）、secret handoff、exact-rerun NOOP、rollback/revoke；不治理 svc-workflow 角色授予与 dsh-agent-core Agent/scheduler 面。proposed 阶段零实现/生产权限；唯一规范上游 = agent-wake Audience CCR（WAKE -> 31 -> 14 -> 83 -> 87 的节点 2） |
| `AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1` | implementation | accepted | contracts | Agent Core Android Native Public Client OAuth：system-browser + verified App Link、PKCE S256、Browser Cookie/CSRF/clickjacking 安全、Native Public Client、Audience/Grant 幂等注册、Refresh rotation/reuse detection 与 offline-only revocation；Spec acceptance 不自动授权 production registration/apply |

## Architecture authorities outside this directory

治理采用为 forward-only，不批量迁移历史合同。当前 Architecture authority 状态为：

```text
MINIMAL_AUTH_FOUNDATION_V2 = accepted / current
MINIMAL_AUTH_FOUNDATION_V1 = superseded / historical
backlink = MINIMAL_AUTH_FOUNDATION_V2
```

- `MINIMAL_AUTH_FOUNDATION_V2`（`docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md`）是当前 whole Architecture authority，authority delta 仅限 migration / hard-cut / sequencing；
- `MINIMAL_AUTH_FOUNDATION_V1` lifecycle root（`docs/contracts/minimal-auth-v1/README.md`）、modules 与 `contract-bundles/minimal-auth-v1/` Contract Bundle `1.3.0` 作为 V2 exact-incorporated 的历史 authority / provenance 保留，旧路径 `docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md` 只是 compatibility entry；
- `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` 与 `docs/contracts/WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0.md` 继续治理生产，直到 V2 Activation Record 证明全部生效门完成。

V2 accepted 不等于 production effective，也不等于 PR #2 implementation authorized。它们的 precedence 与 transition 见 `.agents/local/README.md`。未来修改既有 normative meaning 时，应通过明确的 `AMEND`、`NEW` 或 whole-authority `SUPERSEDE` 处理，不得静默重写。

## Unmerged legacy candidates

`.agents/specs/` 不是 governing location。治理采用生效前已经创建但尚未合并的候选，应 rebase 到包含 accepted governance 的 base、迁移到本目录、补齐 frontmatter 与 stable IDs，并在新 exact head 上重新独立评审。

截至 adoption candidate authoring 时，auth-service PR #2 保持独立 Draft；本 index 不将其视为 accepted 或 active authority。

## Records

- Spec semantic review：持久 PR review/comment 或 repository report；
- Implementation conformance：implementation PR 的 Contract matrix；
- 跨环境、生产、迁移或时间窗口证据：`docs/audits/` 或明确链接的稳定报告；
- rejected / no-change / reuse 调查：Investigation Record、Issue 或 investigation PR。
