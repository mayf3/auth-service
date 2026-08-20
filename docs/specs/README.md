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
| `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` | implementation | accepted | contracts | 两阶段 canary Grant supply：Stage W（svc-workflow 2 行）合入 main 后可实现；Stage F（svc-forum）被 forum Audience CCR 阻塞 |
| `AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` | invariant | proposed | none | 精确 vendoring 并采用共享开发治理；不改变产品行为 |

## Existing authorities outside this directory

治理采用为 forward-only，不批量迁移历史合同。以下现有 authority 保持原路径和原状态：

- `docs/contracts/minimal-auth-v1/` 与 `contract-bundles/minimal-auth-v1/`；
- `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md`；
- `docs/contracts/WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0.md`。

它们的 precedence 与 transition 见 `.agents/local/README.md`。未来修改既有 normative meaning 时，应通过明确的 `AMEND`、`NEW` 或 whole-authority `SUPERSEDE` 处理，不得静默重写。

## Unmerged legacy candidates

`.agents/specs/` 不是 governing location。治理采用生效前已经创建但尚未合并的候选，应 rebase 到包含 accepted governance 的 base、迁移到本目录、补齐 frontmatter 与 stable IDs，并在新 exact head 上重新独立评审。

截至 adoption candidate authoring 时，auth-service PR #2 保持独立 Draft；本 index 不将其视为 accepted 或 active authority。

## Records

- Spec semantic review：持久 PR review/comment 或 repository report；
- Implementation conformance：implementation PR 的 Contract matrix；
- 跨环境、生产、迁移或时间窗口证据：`docs/audits/` 或明确链接的稳定报告；
- rejected / no-change / reuse 调查：Investigation Record、Issue 或 investigation PR。
