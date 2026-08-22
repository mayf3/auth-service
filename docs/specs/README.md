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
| `AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` | invariant | accepted | none | 精确 vendoring 并采用共享开发治理；不改变产品行为 |
| `AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1` | program | proposed | none | Legacy 鉴权面硬切 shutdown Program：Human Principal administration（User create / claim / status / enable / disable）已委托给 `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`（PR #15），password reset 委托给独立 credential-only child；Program Spec，不直接授权实现，每个 implementation Child 需独立 accepted Child Spec |
| `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` | implementation | accepted | contracts（仅 §5 冻结五文件范围） | ownerless agent direct-token profile 与数据库 CHECK 联合修复；封闭五文件实现范围 |
| `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1` | implementation | accepted | contracts（仅 CTR-FR-009 冻结的 13 个 Auth 文件 + 8 个 Forum 文件范围） | 注册 `svc-forum` Audience；仅允许 `forum.read` / `forum.write`，冻结 consumer review、activation gates 与 AC1–AC10 |
| `AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` | implementation | accepted | contracts（仅 CTR-RR-001 冻结的三文件闭包） | svc-forum Audience Registry 离线 reconciliation 子 Spec：生产 `registered_scopes` 单列收敛回 CCR 冻结目标 `[forum.read, forum.write]`；绑定 PR #16 三文件实现闭包与 exact rerun NOOP / conflict fail-closed 语义 |
| `AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1` | implementation | accepted | contracts（仅 CTR-VL-002 冻结的 18 文件闭包） | Minimal Auth Contract `1.3.0` runtime/version linkage 子 Spec；5 个 proven linkage 文件并入 18 文件实现闭包，2 个非必要文件排除 |

Human administration child mapping（PR #2 human authority split amendment，2026-08-22）：

- `AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1`（PR #2）的 active parent 是 `MINIMAL_AUTH_FOUNDATION_V2`；其不再拥有 Human Principal administration 规范语义；
- `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1`（PR #15，exact Head `98ec29a1152bfa9530c572ec5a541ea02df163c4`）是唯一 Human Principal administration child（proposed 未合并候选，本 index 不将其视为 accepted 或 active authority）；
- planned credential-only child `AUTH_SERVICE_HUMAN_CREDENTIAL_LIFECYCLE_V1`（password reset）尚未创建，`planned / not yet an authority`，不得列为 proposed 或 accepted authority；
- 旧占位名 `AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1` 是 non-authority historical placeholder（`AUTHORITY_STATUS = NONE`），不是 authority；
- 除合法 whole-authority supersession 外，不得创建第二份 Human Principal administration child。

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

截至 adoption candidate authoring 时，auth-service PR #2 保持独立 Draft；本 index 不将其视为 accepted 或 active authority。该候选已完成治理迁移（rebase 到 accepted governance base、移入本目录、补齐 frontmatter 与 stable IDs），其迁移前全部历史 review coordinates 仅为 `HISTORICAL_REVIEW_EVIDENCE_ONLY`，迁移后的 exact Head 仍需新的独立 semantic review 与 Owner acceptance。

## Records

- Spec semantic review：持久 PR review/comment 或 repository report；
- Implementation conformance：implementation PR 的 Contract matrix；
- 跨环境、生产、迁移或时间窗口证据：`docs/audits/` 或明确链接的稳定报告；
- rejected / no-change / reuse 调查：Investigation Record、Issue 或 investigation PR。
