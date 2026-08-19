---
spec_id: AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
status: accepted
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by: []
external_authorities:
  - repository: mayf3/agent-development-governance
    authority_id: AGENT_DEVELOPMENT_GOVERNANCE_BOOTSTRAP_V0
    revision: 46f78c3f00d768d99a4c8c2da975b124bce042f9
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1

## 1. Goal

为 `mayf3/auth-service` 建立一套可复用、可审计且不会越权到产品语义的开发治理基础：

```text
Goal
→ Observation
→ Claim
→ Evidence relation
→ State
→ Decision
→ Contract
→ Acceptance
→ Implementation
→ Conformance
```

本 Spec 只授权在本仓库中**采用治理规则本身**。它不授权任何认证、Token、Principal、Client、Grant、Session、数据库、部署或 Consumer 行为实现。

## 2. Scope and non-goals

### In scope

- 从 `mayf3/agent-development-governance` 的 exact commit vendoring 共享 Grammar、Protocol、Skill、Schema、Verifier 与 Templates；
- 建立 `proposed → independent review → authorized acceptance → merge` 的采用流程；
- 声明 auth-service 的本地 authority precedence、接受角色、记录位置与真实 enforcement 状态；
- 将 `docs/specs/` 冻结为未来 governing Spec 的唯一目录；
- 对现有历史合同采用 forward-only、no-bulk-rewrite 迁移；
- 冻结未来治理更新和 rollback 边界。

### Out of scope

- 修改产品代码、测试语义、Prisma、migration、数据、配置或部署；
- 接受、修改、合并或实现 auth-service PR #2；
- 批量改写 `docs/contracts/`、`docs/plans/` 或 `docs/audits/`；
- 宣称当前已有 branch protection、required checks、Spec syntax CI 或不可绕过 merge gate；
- 让中央治理仓库拥有 auth-service 的 Product Direction、Architecture、Spec acceptance 或产品行为；
- 将本 Spec 的 acceptance 误解为任意 child implementation authority。

## 3. Authority and dependencies

```text
SOURCE_REPOSITORY = mayf3/agent-development-governance
SOURCE_COMMIT = 46f78c3f00d768d99a4c8c2da975b124bce042f9
DISTRIBUTION = development-governance-v0
DISTRIBUTION_VERSION = 0.1.0-draft.1
DISTRIBUTION_MANIFEST_SHA256 = 58b5b28bb801538fe62be0ac98a7bc539ff34ec24fa368c48996dd40d8653ba0
CONSUMER_REPOSITORY = mayf3/auth-service
CONSUMER_BASE_COMMIT = 84890120bd385b39287cb81890236b0e73e96c8d
LOCAL_ACCEPTANCE_ACTOR = mayf3 | explicitly delegated auth-service maintainer
```

外部 distribution 只提供治理 Grammar 与流程字节。它不得：

- 接受、修改或 supersede auth-service 的本地 authority；
- 决定 auth-service 产品方向；
- 把上游 `main`、tag 或 release 的移动自动传播到本仓库；
- 代替本地独立 review 或 acceptance actor。

本 Spec 是治理 adoption 的 top-level local authority，因此 `governed_by: []`。这不把它提升为产品 Product Direction，也不授予产品实现。

## 4. Current State

### STATE-ADOPT-001 — auth-service 尚未激活共享治理

- Subject: `mayf3/auth-service` repository governance surface
- As of commit: `84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: GitHub default branch `main` 与 live repository settings
- Observed at: `2026-08-19`
- Projection:
  - `main` 中没有根级 `AGENTS.md`、`.agents/governance.lock.json` 或 vendored governance distribution；
  - 本地 normative authority 主要分布在 `docs/contracts/` 与 `contract-bundles/`；
  - branch protection 关闭，required checks 为空；
  - enforcement 依赖人工/Agent review，而不是不可绕过 CI gate。
- Basis: `OBS-ADOPT-003`, `OBS-ADOPT-004`, `OBS-ADOPT-005`

### STATE-ADOPT-002 — proposed snapshot 尚不是活动 authority

- Subject: 本 adoption PR 中的 governance candidate
- As of artifact: `.agents/governance.lock.json`
- Environment: unmerged docs-only candidate branch
- Observed at: `2026-08-19T14:32:02Z`
- Projection:
  - `adoption.status = proposed`；
  - `accepted_by = null`；
  - `accepted_at = null`；
  - `READY_TO_MARK_ACCEPTED = NO`；
  - 不授权产品 implementation。
- Basis: `OBS-ADOPT-002`, `OBS-ADOPT-006`

## 5. Observations

### OBS-ADOPT-001 — 上游 distribution 绑定 exact source revision

- Subject: shared development-governance distribution
- Repository/source: `mayf3/agent-development-governance`
- Commit/artifact: `46f78c3f00d768d99a4c8c2da975b124bce042f9`
- Environment: GitHub immutable commit objects
- Observed at: `2026-08-19`
- Method: inspect source branch, `distribution/manifest.json`, named Git blobs and consumer-adoption documentation through the connected GitHub API
- Result: manifest declares `development-governance-v0@0.1.0-draft.1`, exactly 17 distributed files, each with fixed size and SHA-256
- Provenance: source repository commit, manifest and Git object identities

### OBS-ADOPT-002 — proposed lock binds exact files and leaves acceptance null

- Subject: auth-service proposed governance lock
- Repository/source: this adoption candidate
- Commit/artifact: `.agents/governance.lock.json`
- Environment: unmerged adoption branch
- Observed at: `2026-08-19T14:32:02Z`
- Method: generate lock from exact manifest entries and manifest raw-byte SHA-256
- Result:
  - source commit is exact 40-hex `46f78c3...`;
  - manifest SHA-256 is `58b5b28b...d8653ba0`;
  - all 17 distributed paths retain upstream size and SHA-256;
  - adoption remains `proposed` with null acceptance metadata
- Provenance: `.agents/governance.lock.json`

### OBS-ADOPT-003 — auth-service base has no active adoption surface

- Subject: repository root and governance paths
- Repository/source: `mayf3/auth-service`
- Commit/artifact: `84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: default branch `main`
- Observed at: `2026-08-19`
- Method: inspect root tree and `.agents` availability
- Result: no active `AGENTS.md`, no `.agents/governance.lock.json`, and no vendored governance distribution in `main`
- Provenance: exact base tree `d4145ef3eed9ba43ce61ee70c7d210b8437e51eb`

### OBS-ADOPT-004 — existing auth authority predates this governance layout

- Subject: local architecture and contract inventory
- Repository/source: `mayf3/auth-service`
- Commit/artifact: `84890120bd385b39287cb81890236b0e73e96c8d`
- Environment: source authority tree
- Observed at: `2026-08-19`
- Method: inspect `docs/contracts/`, `docs/contracts/minimal-auth-v1/`, `contract-bundles/minimal-auth-v1/`, `docs/plans/`, and `docs/audits/`
- Result:
  - Minimal Auth V1 is a frozen, implementation-authorized target Contract Bundle but not production-effective;
  - two named Workflow V0 contracts remain frozen authorities subject to the V1 transition rules;
  - historical plans and audits contain valuable evidence but are not automatically higher authority;
  - `MACHINE_CLIENT_CREDENTIALS_V0` still reports Draft / Ready for Review
- Provenance: exact files named in `.agents/local/README.md`

### OBS-ADOPT-005 — repository enforcement is currently manual

- Subject: GitHub merge enforcement
- Repository/source: `mayf3/auth-service`
- Commit/artifact: live `main` branch settings
- Environment: GitHub
- Observed at: `2026-08-19`
- Method: inspect default branch protection and required status-check settings
- Result: `main` is unprotected; required checks are absent
- Provenance: live branch metadata

### OBS-ADOPT-006 — open auth shutdown candidate remains independent

- Subject: auth-service PR #2
- Repository/source: `mayf3/auth-service`
- Commit/artifact: Draft PR #2 head `9f6da01bba353070723279aec3e021750e3f0ed8`
- Environment: GitHub PR state
- Observed at: `2026-08-19`
- Method: inspect PR metadata and changed path
- Result: PR #2 is Open, Draft, unmerged, and still places its single Spec candidate at `.agents/specs/AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1.md`; this adoption candidate does not modify that branch
- Provenance: PR #2 metadata at observation time

## 6. Claims and assumptions

### CLM-ADOPT-001 — exact vendoring preserves revision identity

- Support state: SUPPORTED
- Supported by evidence: `EVD-ADOPT-001`
- Contradicted by evidence: none known
- Uncertainty: final acceptance still requires an independent verifier run against the exact candidate head

### CLM-ADOPT-002 — forward-only adoption is compatible with existing auth authorities

- Support state: SUPPORTED
- Supported by evidence: `EVD-ADOPT-002`
- Contradicted by evidence: none known
- Uncertainty: each historical authority still requires case-specific reconciliation when later changed or cited

### CLM-ADOPT-003 — proposed preparation does not create active governance

- Support state: SUPPORTED
- Supported by evidence: `EVD-ADOPT-003`
- Contradicted by evidence: none known
- Uncertainty: none within the declared lifecycle; activation depends on future review, acceptance and merge

## 7. Evidence relations

### EVD-ADOPT-001 — manifest and exact Git objects support exact-byte adoption

- Source observations: `OBS-ADOPT-001`, `OBS-ADOPT-002`
- Target: `CLM-ADOPT-001`
- Relation: SUPPORTS
- Bound coordinates: source `46f78c3...`, consumer base `84890120...`, observed `2026-08-19`
- Strength/sufficiency: strong for distributed file identity because every file is bound by manifest SHA-256 and reproduced as the same Git blob content
- Limitations: does not perform semantic adoption review or prove future files remain unchanged
- Provenance: source manifest, proposed lock, candidate diff

### EVD-ADOPT-002 — local inventory supports forward-only compatibility

- Source observations: `OBS-ADOPT-003`, `OBS-ADOPT-004`, `OBS-ADOPT-006`
- Target: `CLM-ADOPT-002`, `STATE-ADOPT-001`
- Relation: SUPPORTS
- Bound coordinates: auth-service base `84890120...`, PR #2 head `9f6da01b...`, observed `2026-08-19`
- Strength/sufficiency: sufficient to define a non-destructive transition and prevent the open candidate from being silently grandfathered
- Limitations: runtime and future repository changes require new observations
- Provenance: repository tree, local authority files, PR metadata

### EVD-ADOPT-003 — lifecycle metadata supports non-activation of proposed state

- Source observations: `OBS-ADOPT-002`, `OBS-ADOPT-005`
- Target: `CLM-ADOPT-003`, `STATE-ADOPT-002`
- Relation: SUPPORTS
- Bound coordinates: proposed lock prepared `2026-08-19T14:32:02Z`; GitHub enforcement observed `2026-08-19`
- Strength/sufficiency: strong for the declared local process
- Limitations: manual policy is not an unbypassable technical control
- Provenance: lock, local authority map, branch metadata

## 8. Decisions

### DEC-ADOPT-001 — adopt exact vendored governance

- Decision owner: `mayf3`
- Decision: vendor `development-governance-v0@0.1.0-draft.1` from exact source commit `46f78c3...`
- Rejected alternatives: floating `main`, `latest`, implicit remote authority, partial copy, and uninitialized submodule
- Reason: local visible bytes, deterministic integrity, exact review coordinates and explicit updates
- Owner decision remaining: NONE

### DEC-ADOPT-002 — preserve local product authority

- Decision owner: `mayf3`
- Decision: shared governance owns only grammar and process; auth-service keeps Product Direction, Architecture, governing Specs, acceptance and implementation authority
- Rejected alternative: central repository automatically governing consumer behavior
- Reason: cross-repository authority ownership must remain explicit
- Owner decision remaining: NONE

### DEC-ADOPT-003 — apply governance forward-only

- Decision owner: `mayf3`
- Decision: do not bulk-migrate history; require new and touched governing Specs to use `docs/specs/` and the adopted format
- Rejected alternative: mass rewrite of historical contracts, plans and audits
- Reason: avoid semantic churn, false lifecycle claims and loss of provenance
- Owner decision remaining: NONE

### DEC-ADOPT-004 — use two-stage local activation

- Decision owner: `mayf3`
- Decision: preparation remains proposed; an independent reviewer recommends acceptance; only an authorized local actor sets accepted metadata; final head is independently rechecked before merge
- Rejected alternative: author self-acceptance or merge-as-acceptance
- Reason: preserve review independence and exact-head binding
- Owner decision remaining: NONE

### DEC-ADOPT-005 — keep PR #2 separate

- Decision owner: `mayf3`
- Decision: adoption does not edit PR #2; after governance becomes active, an unmerged PR #2 must rebase, move its Spec to `docs/specs/`, conform to adopted metadata/ID rules and receive review on the new exact head before acceptance
- Rejected alternative: combining governance bootstrap with auth shutdown semantics
- Reason: avoid mixed authority changes and invalid review reuse
- Owner decision remaining: NONE

## 9. Contracts

### CTR-ADOPT-001 — exact source revision

The repository MUST bind governance to exact source commit `46f78c3f00d768d99a4c8c2da975b124bce042f9`. Floating references MUST NOT activate or update local governance.

### CTR-ADOPT-002 — exact vendored bytes

Every path listed in `.agents/governance.lock.json` MUST match its recorded size and SHA-256. Missing, altered, extra-authority or partially reverted vendored bytes MUST fail integrity verification.

### CTR-ADOPT-003 — truthful proposed and accepted states

The initial candidate MUST remain:

```text
adoption.status = proposed
accepted_by = null
accepted_at = null
```

Only the authorized local acceptance action after independent review MAY set accepted metadata. Neither preparation nor review recommendation is acceptance.

### CTR-ADOPT-004 — local authority ownership

`.agents/local/README.md` MUST own auth-service precedence, authority inventory, acceptance actors, emergency actors and persistent record locations. The external governance repository MUST NOT own auth-service product decisions.

### CTR-ADOPT-005 — forward-only history

Adoption MUST NOT bulk-rewrite historical contracts, plans or audits. Existing authorities remain at their current paths and states until individually reconciled by later work.

### CTR-ADOPT-006 — governing Spec location

After activation, new or still-unmerged governing Specs MUST use `docs/specs/<SPEC_ID>.md`. `.agents/specs/` MUST NOT become a second governing directory.

### CTR-ADOPT-007 — no implementation authority

This adoption Spec and its merge MUST NOT authorize product implementation. `implementation_authority` remains `none`.

### CTR-ADOPT-008 — honest enforcement

The repository MUST distinguish manual policy, deterministic integrity, schemas, semantic review and actual GitHub enforcement. It MUST NOT claim branch protection, required checks, syntax CI or base-branch merge gates that are not active.

### CTR-ADOPT-009 — explicit updates and rollback

Upstream changes MUST have no effect until a separate docs-only update is reviewed, accepted and merged locally. Rollback MUST revert the complete adoption/update commit rather than hand-editing vendored fragments.

### CTR-ADOPT-010 — independent review and final-head binding

Adoption review MUST bind exact base commit, exact candidate commit, reviewer identity and recommendation. Any semantic delta after review MUST invalidate the recommendation. The final accepted head MUST receive an independent delta recheck before merge.

### CTR-ADOPT-011 — open candidate isolation

This adoption change MUST NOT modify, accept, merge or implement PR #2. If PR #2 remains open after activation, its post-rebase/move exact head MUST be reviewed independently; prior review records remain historical evidence only.

## 10. Acceptance

### ACC-ADOPT-001 — distributed bytes verify

- Contracts: `CTR-ADOPT-001`, `CTR-ADOPT-002`
- Method: run `python3 .agents/tools/verify_governance.py --target .` on the exact candidate checkout; independently compare source commit, manifest digest and all 17 lock entries
- Environment: clean checkout of exact adoption candidate
- Required evidence: command output, candidate commit, lock, source manifest and diff
- Expected result: verifier reports `vendored governance bytes match governance.lock.json`
- Failure condition: any source, path, size, hash or lock identity mismatch

### ACC-ADOPT-002 — proposed lifecycle is truthful

- Contracts: `CTR-ADOPT-003`, `CTR-ADOPT-010`
- Method: inspect lock, frontmatter and PR state before acceptance
- Environment: exact Draft PR head
- Required evidence: proposed lock, null acceptance metadata, independent review record
- Expected result: no accepted metadata or implementation authorization exists before authorized transition
- Failure condition: preparation self-accepts, reviewer is treated as acceptance actor, or unmerged accepted-looking state is called active

### ACC-ADOPT-003 — local authority map is complete

- Contracts: `CTR-ADOPT-004`, `CTR-ADOPT-008`
- Method: review `.agents/local/README.md` against exact repository authorities and live GitHub settings
- Environment: candidate commit plus live settings observed during review
- Required evidence: local map, authority files, branch-protection and required-check metadata
- Expected result: precedence, actors, locations and enforcement are explicit and truthful
- Failure condition: missing authority, ambiguous acceptance actor, central ownership claim, or fictitious enforcement

### ACC-ADOPT-004 — diff is governance-only

- Contracts: `CTR-ADOPT-005`, `CTR-ADOPT-007`, `CTR-ADOPT-011`
- Method: inspect complete base-to-head diff
- Environment: adoption PR
- Required evidence: changed-file list and patch
- Expected result: only `AGENTS.md`, `.agents/` governance files and `docs/specs/` adoption/index files change; no product, schema, test, migration, deployment or PR #2 branch changes
- Failure condition: any semantic auth implementation or mixed PR #2 modification

### ACC-ADOPT-005 — Spec location transition is deterministic

- Contracts: `CTR-ADOPT-006`, `CTR-ADOPT-011`
- Method: inspect `docs/specs/README.md`, local transition rule and PR #2 path
- Environment: candidate plus current PR #2 metadata
- Required evidence: index, local README, PR #2 changed path and exact head
- Expected result: one future governing directory; PR #2 remains separate and requires post-activation reconciliation if still open
- Failure condition: both `docs/specs/` and `.agents/specs/` are treated as governing, or old review is silently reused after semantic/path metadata change

### ACC-ADOPT-006 — update and rollback are consumer-controlled

- Contracts: `CTR-ADOPT-009`
- Method: move or change upstream revision without changing consumer, then prepare a separate update diff; simulate complete revert
- Environment: temporary clean checkout
- Required evidence: before/after consumer tree, update diff and revert diff
- Expected result: upstream movement alone changes nothing; complete revert restores prior local pin
- Failure condition: implicit update, floating resolution, or partial revert leaves mixed governance bytes

### Contract coverage

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-ADOPT-001` | `ACC-ADOPT-001` | YES |
| `CTR-ADOPT-002` | `ACC-ADOPT-001` | YES |
| `CTR-ADOPT-003` | `ACC-ADOPT-002` | YES |
| `CTR-ADOPT-004` | `ACC-ADOPT-003` | YES |
| `CTR-ADOPT-005` | `ACC-ADOPT-004` | YES |
| `CTR-ADOPT-006` | `ACC-ADOPT-005` | YES |
| `CTR-ADOPT-007` | `ACC-ADOPT-004` | YES |
| `CTR-ADOPT-008` | `ACC-ADOPT-003` | YES |
| `CTR-ADOPT-009` | `ACC-ADOPT-006` | YES |
| `CTR-ADOPT-010` | `ACC-ADOPT-002` | YES |
| `CTR-ADOPT-011` | `ACC-ADOPT-004`, `ACC-ADOPT-005` | YES |

## 11. Alternatives and disposition

### ALT-ADOPT-001 — track upstream `main` or `latest`

- Disposition: rejected
- Reason: mutable identity invalidates exact review and rollback
- Evidence/Claims considered: `CLM-ADOPT-001`
- What would reopen: none for active governance; a future update still requires an exact commit

### ALT-ADOPT-002 — Git submodule

- Disposition: rejected for V0
- Reason: uninitialized or floating checkout can hide the effective rules and weaken local diff review
- Evidence/Claims considered: `DEC-ADOPT-001`
- What would reopen: a separately governed, mandatory initialization and pin-verification mechanism

### ALT-ADOPT-003 — hand-copy only selected rules

- Disposition: rejected
- Reason: partial copies create semantic drift and cannot be verified against the distribution manifest
- Evidence/Claims considered: `EVD-ADOPT-001`
- What would reopen: a future upstream distribution explicitly defining a smaller complete manifest

### ALT-ADOPT-004 — bulk migrate all historical documents

- Disposition: rejected
- Reason: high semantic churn, false lifecycle inference and provenance loss
- Evidence/Claims considered: `CLM-ADOPT-002`
- What would reopen: a separately accepted migration program with per-authority reconciliation

### ALT-ADOPT-005 — fold PR #2 into governance bootstrap

- Disposition: rejected
- Reason: mixes governance adoption with auth architecture semantics and invalidates independent review boundaries
- Evidence/Claims considered: `OBS-ADOPT-006`, `DEC-ADOPT-005`
- What would reopen: never for this adoption; PR #2 follows its own Spec lifecycle

## 12. Migration, compatibility, and rollback

```text
MIGRATION = forward-only from governance activation
HISTORICAL_REWRITE = none
HISTORICAL_AUTHORITY_COMPATIBILITY = preserve original path/status until explicit reconciliation
OPEN_PR_COMPATIBILITY = rebase + relocate + re-review before acceptance
ROLLBACK = revert the complete adoption or update commit
EMERGENCY_CONTAINMENT = not applicable; this change has no runtime behavior
```

Adoption acceptance does not retroactively change whether old code conformed to old contracts. It only establishes the process for future non-mechanical work and for historical authorities when they are next modified or relied upon.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
VENDOR_TOOL_EXECUTED_IN_AUTHORING_ENVIRONMENT = NO
EXACT_OBJECT_EQUIVALENT_PREPARATION = YES
INDEPENDENT_VERIFIER_RUN_REQUIRED = YES
READY_FOR_INDEPENDENT_REVIEW = YES
READY_TO_MARK_ACCEPTED = YES
IMPLEMENTATION_AUTHORIZED = NO
MERGE_PERFORMED = NO
```

本 authoring 环境未执行上游 `tools/vendor.py` 的本地 clean-checkout 流程；候选使用 connected GitHub object API 按 exact manifest 与 exact source blobs 构造。独立 review 必须在 clean checkout 上运行 vendored verifier，并可选择使用上游 vendor tool 复现同一 17-file snapshot。复现差异即为 blocker。
