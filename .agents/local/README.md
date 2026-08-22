# Repository-local governance — auth-service

本文件由 `mayf3/auth-service` 自己拥有，不属于 vendored distribution，不会被治理更新工具覆盖。

## 1. Repository identity

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
GOVERNANCE_LOCK = .agents/governance.lock.json
GOVERNANCE_DISTRIBUTION = development-governance-v0
```

治理采用只有在以下条件同时成立时才生效：

```text
adoption.status = accepted
accepted_by = authorized local acceptance actor
accepted snapshot merged into main
```

`proposed` lock、未合并 PR 或仅存在于分支上的 `status: accepted` 都不是活动 authority。

## 2. Authority precedence

本仓库当前没有单独、已接受的 Product Direction 文件。不得从代码、README、历史聊天或部署现状推导一个隐含 Product Direction。

默认 precedence 为：

```text
1. 未来由仓库 Owner 明确接受的 Product Direction authority（当前 NONE_DECLARED）
2. 已接受或已冻结且明确拥有架构 authority 的本地 Architecture / Invariant contracts
3. `docs/specs/` 中 accepted governing Specs
4. code, tests, runtime, deployment records, audits and investigations
```

第二层当前包括：

```text
CURRENT_MINIMAL_AUTH_ARCHITECTURE = MINIMAL_AUTH_FOUNDATION_V2
MINIMAL_AUTH_FOUNDATION_V2_STATUS = accepted
MINIMAL_AUTH_FOUNDATION_V1_STATUS = superseded
MINIMAL_AUTH_FOUNDATION_V1_SUPERSEDED_BY = MINIMAL_AUTH_FOUNDATION_V2

MINIMAL_AUTH_FOUNDATION_V2
  location: docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md
  supersedes: MINIMAL_AUTH_FOUNDATION_V1 (whole authority)
  authority delta scope: migration / hard-cut / sequencing only

MINIMAL_AUTH_FOUNDATION_V1
  historical normative modules: docs/contracts/minimal-auth-v1/
  exact-incorporated executable bundle provenance: contract-bundles/minimal-auth-v1/ (1.3.0)

AUTH_SERVICE_WORKFLOW_RS256_V0_FROZEN
  docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md

AUTH_SERVICE_WORKFLOW_AGENT_OBO_V0_FROZEN
  docs/contracts/WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0.md
```

`MINIMAL_AUTH_FOUNDATION_V2` 是当前第二层 Minimal Auth Architecture Authority。V1 lifecycle root、modules 与 Contract Bundle `1.3.0` 作为 V2 exact-incorporated 的历史 authority / provenance 保留；V1 旧路径 `docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md` 只是 compatibility entry，不再是当前或可直接实施的 architecture authority。

相关 V0 frozen Contracts 仍继续治理生产，直到 V2 Activation Record 证明九门全部完成。V2 accepted 不等于 production effective，也不等于 PR #2 implementation authorized；不得通过本地 prose 推断 partial supersession、生产 Grant apply、数据库写入、部署或 production effectiveness。

V2 接受版本以 `main@36a11136745bae7a371d21ba62d9617942c41afa` 的 Minimal Auth Contract `1.3.0` executable bundle 为 exact incorporation 对象，并将已合入的 svc-forum CCR/Version Linkage、accepted Stage W Execution V2 与 Stage F source implementation 作为 grandfathered exact V1 constraints。Stage W V1 仅是 superseded historical authority；Stage F source merge 不证明生产 Grant apply、数据库写入、部署或 production effectiveness。上述 reconciliation 不授权新产品行为，也不改变 V2 的 migration / hard-cut / sequencing-only authority delta。

以下文档不是自动 governing authority：

- `docs/DESIGN.md`：历史设计与现状来源；与后续 frozen contract 冲突时不得覆盖后者；
- `docs/plans/`：计划与调查材料；
- `docs/audits/`：观察、证据与历史结论；
- `docs/contracts/MACHINE_CLIENT_CREDENTIALS_V0.md`：当前头部状态仍为 Draft / Ready for Review；
- 未合并 PR、聊天报告或仅存在于 `.agents/specs/` 的候选。

## 3. Acceptance and review actors

```text
SPEC_ACCEPTANCE_ACTORS = mayf3 | explicitly delegated auth-service maintainer
GOVERNANCE_ACCEPTANCE_ACTORS = mayf3 | explicitly delegated auth-service maintainer
MECHANICAL_EXEMPTION_REVIEWERS = independent maintainer or Agent not authoring the change
EMERGENCY_AUTHORIZATION_ACTORS = mayf3 | explicitly delegated incident operator
```

固定角色边界：

```text
Author != independent semantic Reviewer
Review recommendation != acceptance
Acceptance != merge
Merged accepted Spec != implemented state
Implemented state != verified conformance
```

所有 semantic review 必须绑定 exact base commit、exact Spec commit、reviewer identity 和 final accepted head。评审后出现 semantic delta 时必须重新评审。

## 4. Governing and evidence locations

```text
PRODUCT_DIRECTION = NONE_DECLARED
ARCHITECTURE = docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md + exact-incorporated historical V1 provenance + named frozen V0 contracts
SPECS = docs/specs/
INVESTIGATIONS = docs/plans/ | future docs/investigations/ | persistent GitHub Issues/PR records
CONFORMANCE_REPORTS = docs/audits/ | implementation PR Contract matrix | linked runtime reports
ADOPTION_AND_REVIEW_RECORDS = governance/adoption PR records or repository reports
```

`docs/specs/` 是治理采用后唯一的 governing Spec 目录。Spec lifecycle 通过 frontmatter 表达，不使用 proposed/accepted/rejected 子目录移动文件。

## 5. Forward-only transition

```text
NO_BULK_HISTORY_REWRITE = YES
HISTORICAL_CONTRACTS_GRANDFATHERED = YES
NEW_GOVERNING_SPEC_LOCATION = docs/specs/
```

采用治理不会批量重写现有 `docs/contracts/`、`docs/plans/` 或 `docs/audits/`。历史 authority 保持其原有身份和状态，只有在以下情况才需要 reconciliation：

- 被新工作引用为 governing authority；
- 与新的 accepted Spec 冲突；
- 需要修改其 normative meaning；
- 需要完成 whole-authority supersession。

采用生效前创建且尚未合并的 Spec 候选，必须在接受前：

1. rebase 到包含 accepted governance 的 base；
2. 移到 `docs/specs/<SPEC_ID>.md`；
3. 补齐所需 frontmatter、stable IDs、authority relationship 和 Acceptance mapping；
4. 对迁移后的 exact head 重新执行独立 semantic review；
5. 不得把旧评审自动视为新坐标上的 acceptance。

截至本治理候选 authoring 时，auth-service PR #2 属于这种未合并候选；本治理 PR 不修改、接受、合并或实现 PR #2。

## 6. Local security and change classification

auth-service 涉及身份、凭据、Token、Grant、Session、密钥、Consumer trust 和生产迁移。以下变更默认均为 `NON_MECHANICAL`：

- API、JWT claim、OAuth、Audience、Scope 或错误合同；
- Principal、Client、Grant、Session、Refresh、Proxy、Key rotation 生命周期；
- schema、migration、backfill、repair、cleanup 与数据 authority；
- timeout、retry、idempotency、unknown outcome 或 rollback；
- trust boundary、credential exposure、logging、audit 或 deployment semantics；
- 删除“看起来未使用”的 auth/security 行为；
- 改变测试预期以适配代码。

不确定是否机械性时，按 `NON_MECHANICAL` 处理。

## 7. Emergency seam

允许先于完整 Spec 流程执行的动作仅限：

```text
rollback
shutdown / disable
containment
credential revocation or isolation
```

必须记录 incident reference、Owner approval、action kind，并保证 `DURABLE_NEW_BEHAVIOR = NO`。永久修复仍需正常 Spec reconciliation。

## 8. Enforcement reality

截至 `main@84890120bd385b39287cb81890236b0e73e96c8d`、2026-08-19 的真实状态：

```text
ENFORCEMENT_LEVEL = MANUAL_POLICY
DISTRIBUTION_INTEGRITY_CHECK = AVAILABLE
SPEC_FRONTMATTER_SCHEMA = AVAILABLE
SPEC_SYNTAX_GATE = NOT_IMPLEMENTED
BASE_BRANCH_SPEC_GATE = NOT_IMPLEMENTED
SEMANTIC_REVIEW_CI = NOT_IMPLEMENTED
BRANCH_PROTECTION = OFF
REQUIRED_STATUS_CHECKS = NONE
```

因此当前不能声称存在不可绕过的 merge gate。`.agents/tools/verify_governance.py` 只验证 vendored bytes 与 lock metadata；它不证明 Spec 语义正确、产品代码 conforming 或 branch protection 已启用。

任何未来自动化 gate 必须通过独立 Spec / implementation PR 建立，并按 GitHub 实际设置诚实更新本节。

## 9. Governance updates and rollback

上游 `main`、tag 或 release 的移动不会自动改变本仓库。治理更新必须：

1. 选择 exact 40-hex source commit；
2. 生成新的 docs-only vendored update；
3. 审阅完整治理 diff；
4. 更新 proposed lock；
5. 独立 review；
6. 由本地授权 actor 接受；
7. final-head recheck 后 merge。

Rollback 是完整 revert 采用或更新 commit。不得只手工修改部分 vendored 文件来模拟旧版本。
