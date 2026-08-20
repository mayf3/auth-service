---
authority_id: MINIMAL_AUTH_FOUNDATION_V2
status: proposed
authority_kind: architecture
owning_repository: mayf3/auth-service
implementation_authority: contracts
scope:
  - mayf3/auth-service identity architecture
  - V0-to-V1 migration / hard-cut sequencing authority
governed_by: []
external_authorities: []
supersedes:
  - MINIMAL_AUTH_FOUNDATION_V1
superseded_by: null
owners:
  - mayf3
---

# MINIMAL_AUTH_FOUNDATION_V2

```text
AUTHORITY_ID = MINIMAL_AUTH_FOUNDATION_V2
AUTHORITY_KIND = architecture
AUTHORITY_STATUS = proposed
SUPERSEDES = MINIMAL_AUTH_FOUNDATION_V1 (whole authority)
SUPERSEDED_BY = null
PROPOSED_AT_BASE = cb0b3d37dfb105c763c9c83ebd65483270b21b81
PREVIOUS_EVALUATED_BASE = e9b6dbccf9779ff8ba7681dba6bbc61bfa5c7e09
PREVIOUS_REVIEWED_BASE = 1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9
DATE = 2026-08-20
AUTHORITY_DELTA_SCOPE = migration / hard-cut / sequencing only
WHOLE_AUTHORITY_SUCCESSOR = MINIMAL_AUTH_FOUNDATION_V2
UNCHANGED_V1_CLAIMS_PROFILES_GRANTS_DELEGATION_HUMAN_SESSION_CONFORMANCE = EXACT_IDENTITY_PRESERVED
V0_FROZEN_CONTRACTS_GOVERN_PRODUCTION_UNTIL_GATES = YES
THIS_PROPOSED_PR_AUTHORIZES_IMPLEMENTATION = NO
PRODUCT_IMPLEMENTATION_STARTED = NO
READY_TO_MARK_ACCEPTED = NO
```

## 1. Goal

建立 `MINIMAL_AUTH_FOUNDATION_V1` 的 whole-authority successor。V2 精确保留
V1 的 claims、profiles、grants、delegation、human session、conformance 与
1.2.0 executable bundle，只替换 migration / hard-cut / sequencing meaning。
本 proposed PR 只形成可独立评审的 authority 候选；不接受、不实现、不部署、不合并。

## 2. Scope and non-goals

### 2.1 Scope

- whole-authority supersession；
- 可执行且原子的 V2 accepted / V1 superseded lifecycle transition；
- PRE_CUT source artifact 与 V1-only Cut Artifact 的无歧义顺序；
- successor effectiveness field、九门、bounded implementation authority；
- downstream authority inventory 与 compatibility review。

### 2.2 Non-goals

- 不改变 V1 claims/profile/grant/delegation/human-session/conformance/bundle 语义；
- 不把 PR #2 的 proposed Decision 当作活动 authority；硬切方向只由本 V2 的
  `DEC-MAFV2-*` 在本 V2 被接受后拥有；
- 不修改 accepted `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` 或
  `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1`；
- 不宣布 production effective；不授权 sequencing 实现；
- 不修改产品代码、schema、migration、runtime config、deployment 或 bundle；
- 不接受、不修改、不合并 PR #2。

## 3. Authority and dependencies

### 3.1 Precedence

V2 是本仓库 precedence 第 2 层 architecture 候选。激活前 V1 仍是唯一活动的
Minimal Auth architecture authority。激活后 V2 whole 地取代 V1；governing Specs
只能在自己的独立 amendment 中对齐，不能反向覆盖 architecture authority。

### 3.2 Explicit V1 lifecycle root

```text
V1_LIFECYCLE_ROOT = docs/contracts/minimal-auth-v1/README.md
V1_COMPATIBILITY_ENTRY = docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md
```

V1 lifecycle root 是可变 lifecycle wrapper，不属于 CTR-MAFV2-001 的 immutable
exact-incorporation 集合。其 base blob
`fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f` 仅作为 source provenance。
CTR-MAFV2-005 冻结 acceptance-only lifecycle delta；除明确列出的 lifecycle/backlink
字段外，V1 normative meaning 不得变化。

### 3.3 Accepted transition result

```text
V2:
  status = accepted
  supersedes = [MINIMAL_AUTH_FOUNDATION_V1]
V1 lifecycle root:
  status = superseded
  superseded_by = MINIMAL_AUTH_FOUNDATION_V2
V1 compatibility entry:
  status = superseded
  superseded_by = MINIMAL_AUTH_FOUNDATION_V2
  current_architecture_authority = MINIMAL_AUTH_FOUNDATION_V2
```

这些值是 future acceptance change 的原子结果，不描述本 proposed Head 的当前状态。
兼容入口在激活后 MUST NOT 再把 V1 表达为当前活动、可直接实施的 architecture authority。

### 3.4 Accepted downstream Specs on the new base

`AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` 是 accepted implementation Spec，
`implementation_authority=contracts`，并通过 `external_authorities` 的
`constrained_by` 关系绑定 `MINIMAL_AUTH_FOUNDATION_V1@1da40d4...`。它的封闭
五文件产品范围不拥有 architecture supersession。本 PR 不修改它；其 compatibility
结论仍为 `COMPATIBLE_NO_SEMANTIC_DELTA`，未来 alignment 由独立 amendment 决定。

`AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` 也是 accepted implementation Spec，
accepted finalize revision `1f7fa6378fa44042f3001b4a5813210c0a8313e8`（新 Base
中 blob `d89bf08c8714f55571ee7d75da017b7cf7237096`），
`implementation_authority=contracts`，并通过 `governed_by` 直接依赖
`MINIMAL_AUTH_FOUNDATION_V1`。其 bounded scope 是两个 Agent Core canary Client 的
Stage W 两条 `svc-workflow[workflow.read]` MachineAccessGrant；Stage F 的两条
`svc-forum` Grant 继续被独立 CCR、consumer migration review 与 bundle update 阻塞。

V2 exact-incorporates Canary Grant 所依赖的 `grants-and-audiences.md` 与 bundle：
MachineAccessGrant、Audience/Scope 严格拒绝、same-transaction audit、
`expected_grant_version` optimistic concurrency 和 forward-only migration/rollback
语义均不改变。因此 V2 现在作出明确 disposition，而非留给未来 review prose：

```text
CANARY_GRANT_COMPATIBILITY = COMPATIBLE_NO_SEMANTIC_DELTA
CANARY_GRANT_REFERENCE_DISPOSITION = GRANDFATHERED_EXACT_V1_CONSTRAINT
CANARY_GRANT_ALIGNMENT_AMENDMENT_REQUIRED = NO
CANARY_GRANT_PRODUCT_SEMANTIC_DELTA = NONE
FUTURE_CANARY_GRANT_SEMANTIC_AMENDMENT_PARENT = MINIMAL_AUTH_FOUNDATION_V2
```

## 4. Current State

### STATE-MAFV2-001 — V1 remains the active architecture at the evaluated base

- Subject: `MINIMAL_AUTH_FOUNDATION_V1` lifecycle and frozen contract set
- As-of commit / artifact revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: `mayf3/auth-service` source repository, `github/main`
- Observed at: `2026-08-20T22:56:05Z`
- Basis: `OBS-MAFV2-001`, `CLM-MAFV2-001`, `EVD-MAFV2-001`

### STATE-MAFV2-002 — Governance is accepted but manually enforced

- Subject: local Development Governance adoption and enforcement state
- As-of commit / artifact revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: repository source and local governance verifier
- Observed at: `2026-08-20T22:56:05Z`
- Basis: `OBS-MAFV2-002`, `EVD-MAFV2-002`

### STATE-MAFV2-003 — Prior review is historical evidence only

- Subject: PR #7 independent semantic review of the previous exact Head
- As-of commit / artifact revision: base `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`, Head `758f21e79de1bb602da05936832b713746d27c0b`
- Environment: persistent GitHub PR #7 review record
- Observed at: `2026-08-20T13:07:13Z`
- Basis: `OBS-MAFV2-003`, `CLM-MAFV2-002`, `EVD-MAFV2-003`

### STATE-MAFV2-004 — New base preserves the accepted ownerless downstream Spec

- Subject: `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1`
- As-of commit / artifact revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: `mayf3/auth-service` source repository, `github/main`
- Observed at: `2026-08-20T22:56:05Z`
- Basis: `OBS-MAFV2-004`, `OBS-MAFV2-005`, `CLM-MAFV2-003`, `EVD-MAFV2-004`

### STATE-MAFV2-005 — Pinned V1 assets have no main-drift delta

- Subject: V1 normative modules and `contract-bundles/minimal-auth-v1`
- As-of commit / artifact revision: comparison `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9..cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: clean task worktree, Git object database
- Observed at: `2026-08-20T22:56:05Z`
- Basis: `OBS-MAFV2-005`, `CLM-MAFV2-004`, `EVD-MAFV2-005`

### STATE-MAFV2-006 — New base contains accepted Canary Grant authority

- Subject: `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` lifecycle, parent relation, and bounded scope
- As-of commit / artifact revision: accepted finalize `1f7fa6378fa44042f3001b4a5813210c0a8313e8`, present in `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: `mayf3/auth-service` source repository, `github/main`
- Observed at: `2026-08-20T22:56:05Z`
- Basis: `OBS-MAFV2-007`, `CLM-MAFV2-007`, `EVD-MAFV2-007`

## 5. Observations

### OBS-MAFV2-001 — V1 lifecycle and object identities

- Subject: V1 lifecycle root, normative modules, migration module, and bundle
- Source revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: clean task worktree, Git object database
- Observed at: `2026-08-20T22:56:05Z`
- Method: executed `git rev-parse <base>:<path>` for every item listed in CTR-MAFV2-001 and the lifecycle/migration provenance objects
- Result: all object identities equal their identities at `1da40d4...`; V1 lifecycle root still advertises frozen/current implementation-authorized state
- Provenance: this PR authoring execution record and CTR-MAFV2-001 table

### OBS-MAFV2-002 — Governance verifier result

- Subject: vendored governance bytes and accepted adoption metadata
- Source revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: clean task worktree, local Python 3 verifier
- Observed at: `2026-08-20T22:56:05Z`
- Method: executed `python3 .agents/tools/verify_governance.py --target . --require-accepted`
- Result: `vendored governance bytes match governance.lock.json and adoption is accepted`
- Provenance: this PR authoring execution record; `.agents/governance.lock.json`

### OBS-MAFV2-003 — Previous independent review

- Subject: PR #7 review bound to previous proposed authority Head
- Source revision: `758f21e79de1bb602da05936832b713746d27c0b`
- Environment: GitHub PR #7 persistent review record
- Observed at: `2026-08-20T13:07:13Z`
- Method: read the submitted exact-Head review through GitHub PR metadata
- Result: `REVISE`, five blockers; whole-authority direction and 9/9 prior identities accepted, amended Head requires new review
- Provenance: `https://github.com/mayf3/auth-service/pull/7` review by `OpenAI GPT-5.6 Pro`; historical review evidence only

### OBS-MAFV2-004 — Ownerless Spec lifecycle and authority reference

- Subject: `docs/specs/AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1.md`
- Source revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: repository source, `github/main`
- Observed at: `2026-08-20T22:56:05Z`
- Method: direct source inspection of frontmatter and bounded authorization section
- Result: `status=accepted`; `implementation_authority=contracts`; external `authority_id=MINIMAL_AUTH_FOUNDATION_V1`, revision `1da40d4...`, relation `constrained_by`; implementation scope is a closed five-file product delta
- Provenance: accepted Spec at the source path above, lines 1–18 and §5

### OBS-MAFV2-005 — Exact main drift and pinned-scope non-drift

- Subject: source changes from previous evaluated base to current evaluated base
- Source revision: `e9b6dbccf9779ff8ba7681dba6bbc61bfa5c7e09..cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: clean task worktree, Git object database
- Observed at: `2026-08-20T22:56:05Z`
- Method: executed `git diff --name-only` plus scoped `git diff --exit-code` for V1 modules, bundle, ownerless Spec, and vendored governance
- Result: only `docs/specs/AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1.md` and `docs/specs/README.md` changed; pinned V1 assets, ownerless Spec, and vendored governance bytes did not change
- Provenance: this PR authoring execution record

### OBS-MAFV2-006 — Downstream reference inventory surface

- Subject: in-repository textual authority references to `MINIMAL_AUTH_FOUNDATION_V1`
- Source revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: repository documentation tree
- Observed at: `2026-08-20T22:56:05Z`
- Method: repository content search for exact authority ID, followed by frontmatter classification
- Result: references include the accepted ownerless Spec's external-authority constraint and accepted Canary Grant Spec's `governed_by` parent; inventory must cover both reference classes
- Provenance: this PR authoring execution record and matching repository paths

### OBS-MAFV2-007 — Accepted Canary Grant dependency semantics

- Subject: `docs/specs/AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1.md` and its V1 Grant dependencies
- Source revision: accepted finalize `1f7fa6378fa44042f3001b4a5813210c0a8313e8`; source blob `d89bf08c8714f55571ee7d75da017b7cf7237096`; evaluated base `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: repository source and Git object database
- Observed at: `2026-08-20T22:56:05Z`
- Method: inspect frontmatter, §1–§3, Decisions/Contracts, Acceptance record; compare `grants-and-audiences.md`, bundle tree, audience registry, and grants schema objects across `e9b6dbc...cb0b3d3`
- Result: accepted `implementation_authority=contracts`, `governed_by` includes V1; Stage W is two exact workflow Grants, Stage F remains blocked; all depended-on Grant/Audience/Scope/audit/concurrency/forward-only objects and semantics are unchanged by V2
- Provenance: accepted Canary Grant Spec; Git history/object output in this PR authoring record

## 6. Claims and assumptions

### CLM-MAFV2-001 — Whole-authority transition is required

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-001`, `EVD-MAFV2-003`
- Contradicted by evidence: none known
- Uncertainty: sufficiency is bounded to Governance V0 and the reviewed V1/V2 authority graph; future governance versions may define other mechanisms

### CLM-MAFV2-002 — Prior review does not approve this amendment

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-003`
- Contradicted by evidence: none known
- Uncertainty: none for the exact reviewed/amended revision distinction; a future persistent review may change readiness

### CLM-MAFV2-003 — Ownerless Spec is compatible with the preserved semantics

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-004`, `EVD-MAFV2-005`
- Contradicted by evidence: none known
- Uncertainty: compatibility is bounded to architecture semantics preserved by CTR-MAFV2-001 and the accepted Spec's closed scope; successor-reference alignment remains for independent review

### CLM-MAFV2-004 — New base preserves pinned V1 identities

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-005`
- Contradicted by evidence: none known
- Uncertainty: result applies only through evaluated base `cb0b3d3...`; later main movement requires re-evaluation

### CLM-MAFV2-005 — PRE_CUT migration is compatible with a hard Cut Artifact

- Support state: INFERRED
- Supported by evidence: `EVD-MAFV2-006`
- Contradicted by evidence: none known
- Uncertainty: this establishes authority-sequence consistency, not executed consumer migration or runtime readiness

### CLM-MAFV2-006 — Inventory must include both downstream reference classes

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-004`, `EVD-MAFV2-006`, `EVD-MAFV2-007`
- Contradicted by evidence: none known
- Uncertainty: repository content search establishes the current source inventory only; later Specs require a refreshed inventory

### CLM-MAFV2-007 — Canary Grant authority is compatible and may retain its exact V1 constraint

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-005`, `EVD-MAFV2-007`
- Contradicted by evidence: none known
- Uncertainty: compatibility is bounded to accepted revision `1f7fa637...`, the exact incorporated V1 Grant/bundle identities, and its frozen Stage W/blocked Stage F scope; any future semantic amendment must use V2 as parent

## 7. Evidence relations

### EVD-MAFV2-001 — Lifecycle source supports the transition requirement

- Source observations: `OBS-MAFV2-001`
- Target: `CLM-MAFV2-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@cb0b3d37dfb105c763c9c83ebd65483270b21b81`, source repository, observed `2026-08-20T22:56:05Z`
- Strength / sufficiency: strong for the current V1 lifecycle representation and exact source identities
- Limitations: does not itself accept the successor
- Provenance: Git object results and V1 lifecycle source

### EVD-MAFV2-002 — Executed verifier supports governance state

- Source observations: `OBS-MAFV2-002`
- Target: `STATE-MAFV2-002`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@cb0b3d3...`, clean local worktree, observed `2026-08-20T22:56:05Z`
- Strength / sufficiency: sufficient for vendored-byte identity and accepted lock status
- Limitations: verifier does not prove semantic correctness, acceptance, implementation, deployment, or branch protection
- Provenance: executed verifier output in this PR authoring record

### EVD-MAFV2-003 — Exact prior review supports revision distinction and lifecycle defect

- Source observations: `OBS-MAFV2-003`
- Target: `CLM-MAFV2-001`, `CLM-MAFV2-002`
- Relation: SUPPORTS
- Bound coordinates: PR #7 base `1da40d4...`, reviewed Head `758f21e...`, GitHub review submitted `2026-08-20T13:07:13Z`
- Strength / sufficiency: strong historical evidence for the five diagnosed blockers and need for a new review
- Limitations: not authority, not Evidence of this amended Head passing, and not acceptance
- Provenance: persistent PR #7 review receipt

### EVD-MAFV2-004 — Accepted ownerless source supports bounded compatibility

- Source observations: `OBS-MAFV2-004`
- Target: `CLM-MAFV2-003`, `CLM-MAFV2-006`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@cb0b3d3...`, repository source, observed `2026-08-20T22:56:05Z`
- Strength / sufficiency: sufficient to establish accepted lifecycle, exact V1 constraint, and closed product scope
- Limitations: does not decide whether a future reference-alignment amendment is required
- Provenance: accepted ownerless Spec frontmatter and §5

### EVD-MAFV2-005 — Object comparison supports identity and compatibility

- Source observations: `OBS-MAFV2-005`
- Target: `CLM-MAFV2-003`, `CLM-MAFV2-004`
- Relation: SUPPORTS
- Bound coordinates: previous evaluated base `e9b6dbc...`, new base `cb0b3d3...`, Git object database, observed `2026-08-20T22:56:05Z`
- Strength / sufficiency: exact for the compared tracked bytes and objects
- Limitations: no claim about runtime deployment or future revisions
- Provenance: executed scoped Git diff and object-identity output

### EVD-MAFV2-006 — Source inventory supports phase and inventory Claims

- Source observations: `OBS-MAFV2-001`, `OBS-MAFV2-006`
- Target: `CLM-MAFV2-005`, `CLM-MAFV2-006`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@cb0b3d3...`, source repository, observed `2026-08-20T22:56:05Z`
- Strength / sufficiency: sufficient for an internally complete normative sequence and both current downstream reference classes
- Limitations: not executed migration evidence and not proof of out-of-repository consumers
- Provenance: V1 source modules and repository authority-reference inventory

### EVD-MAFV2-007 — Exact Grant objects support Canary compatibility and disposition

- Source observations: `OBS-MAFV2-005`, `OBS-MAFV2-007`
- Target: `CLM-MAFV2-006`, `CLM-MAFV2-007`, `STATE-MAFV2-006`
- Relation: SUPPORTS
- Bound coordinates: Canary accepted finalize `1f7fa637...`, evaluated base `cb0b3d3...`, V1 Grant blob `277ea7f9...`, bundle tree `796a8b67...`, observed `2026-08-20T22:56:05Z`
- Strength / sufficiency: exact for accepted lifecycle, parent relation, bounded scope, and object identity; strong semantic match for MachineAccessGrant, Audience/Scope, audit, optimistic concurrency, and forward-only migration/rollback
- Limitations: does not prove Stage W implementation/conformance or unblock Stage F
- Provenance: accepted Canary Grant Spec, V1 Grant source, bundle objects, and executed Git object comparison

## 8. Decisions

- `DEC-MAFV2-001` — V2 whole 地取代 V1；拒绝 module/prose partial supersession。
- `DEC-MAFV2-002` — lifecycle root 是可变 wrapper；其余 unchanged modules/bundle
  exact pin，lifecycle root base blob 仅记录 source provenance。
- `DEC-MAFV2-003` — authority delta 仅为 migration / hard-cut / sequencing。
- `DEC-MAFV2-004` — Phase 3 build/verify Cut Artifact but do not deploy；Phase 4 在
  existing PRE_CUT legacy-carrying artifact 的 V1 surfaces 上迁移；Phase 5 证明九门后部署。
- `DEC-MAFV2-005` — 禁止创建新的 dual-protocol artifact；Cut Artifact 只含 V1，
  无 `AUTH_CONTRACT_MODE`、per-request fallback 或 Legacy runtime。
- `DEC-MAFV2-006` — V2 拥有硬切方向；不从 proposed PR #2 导入 authority。
- `DEC-MAFV2-007` — successor lifecycle field 是
  `MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE`；V1 field 只保留历史含义。
- `DEC-MAFV2-008` — accepted V2 的 contract implementation authority 只覆盖
  incorporated frozen contracts；migration sequencing 无直接实现 authority，必须另有 child Spec。
- `DEC-MAFV2-009` — downstream inventory 同时覆盖 `governed_by` 与同仓库
  `external_authorities.authority_id` references；本 PR 不静默改写 accepted downstream Spec。
- `DEC-MAFV2-010` — rollback 仅为 whole-release rollback，不存在 mode-switch rollback。
- `DEC-MAFV2-011` — accepted Canary Grant Spec 的 exact V1 parent reference 按
  `GRANDFATHERED_EXACT_V1_CONSTRAINT` 保留，无 alignment amendment；其产品语义无
  delta，任何未来 semantic amendment 必须以 V2 为 parent。

## 9. Contracts

### CTR-MAFV2-001 — Immutable incorporation and lifecycle provenance

以下对象按新 Base 重验且 MUST 保持 exact identity；它们构成 V2 unchanged normative
内容。V1 lifecycle root 不在 immutable 集合中。

| Content | Object SHA-1 @ `cb0b3d3...` |
|---|---|
| `docs/contracts/minimal-auth-v1/claims-and-profiles.md` | `a51186adacc6b61131dcf7ad0227e372b67e8092` |
| `docs/contracts/minimal-auth-v1/conformance.md` | `d56c45c514d308e65e698f6b2e78799d079a65ea` |
| `docs/contracts/minimal-auth-v1/delegation.md` | `f64448ed860143f6e5d566e5dbd729aa4d68b20e` |
| `docs/contracts/minimal-auth-v1/grants-and-audiences.md` | `277ea7f9cdb26558e196ec9e382430b324ddee32` |
| `docs/contracts/minimal-auth-v1/human-session-refresh.md` | `f9949637b40e1023d917393148d692df26b624af` |
| `contract-bundles/minimal-auth-v1/` tree | `796a8b670f8617ab5f45c7b8734e124e07934f09` |
| `contract-bundles/minimal-auth-v1/contract-manifest.json` | `8557b36de241e39570f478e21a95ff375d11759a` |
| `contract-bundles/minimal-auth-v1/audience-registry.json` | `8ddf67afc2494dddc3c087d19f2f93c71db13d70` |
| `contract-bundles/minimal-auth-v1/schemas/grants.schema.json` | `f60cd9faf18acfc643bf0330401e9af7364ce2d8` |

```text
V1_LIFECYCLE_ROOT_BASE_BLOB_PROVENANCE = fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f
V1_MIGRATION_MODULE_REPLACED_BLOB_PROVENANCE = 954b661e84697a7b78566fadd09383dd5298b5d4
```

Lifecycle-only mutation is allowed exclusively by CTR-MAFV2-005 at acceptance. Claims,
profiles, grants, delegation, human-session, conformance and bundle meaning MUST NOT change.

### CTR-MAFV2-002 — PRE_CUT and Cut Artifact sequencing

```text
PHASE_3 = BUILD_AND_VERIFY_CUT_ARTIFACT_DO_NOT_DEPLOY
PRE_CUT_SOURCE_ARTIFACT = EXISTING_DEPLOYED_LEGACY_CARRYING_ARTIFACT
PRE_CUT_CONSUMER_MIGRATION_PERIOD = REQUIRED
PRE_CUT_LEGACY_TRAFFIC_EVIDENCE_WINDOW = REQUIRED
NEW_DUAL_PROTOCOL_ARTIFACT = FORBIDDEN
CUT_ARTIFACT = V1_ONLY
POST_CUT_COMPATIBILITY_WINDOW = NONE
PHASE_4 = MIGRATE_CONSUMERS_AGAINST_PRE_CUT_SOURCE_ARTIFACT_V1_SURFACES
PHASE_5 = PROVE_ALL_GATES_THEN_DEPLOY_CUT_ARTIFACT
NEW_OR_POST_CUT_COMPATIBILITY_WINDOW = NONE
AUTH_CONTRACT_MODE = NONE
PER_REQUEST_FALLBACK = NONE
LEGACY_RUNTIME = NONE
ROLLBACK = WHOLE_RELEASE_ONLY
```

`MIGRATION_WINDOW = NONE` MAY only be used as shorthand for
`NEW_OR_POST_CUT_COMPATIBILITY_WINDOW = NONE`; it MUST NOT deny the required pre-cut
consumer migration period or legacy-traffic evidence window. A new dual-protocol artifact
MUST NOT be built. The existing deployed source artifact may carry Legacy while exposing V1
surfaces; the Cut Artifact MUST contain V1 only.

### CTR-MAFV2-003 — Successor lifecycle field and nine gates

```text
SUCCESSOR_MAINLINE_EFFECTIVE_FIELD = MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE
HISTORICAL_V1_FIELD = MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE
MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE = false
```

The V2 field MUST remain false until every gate below passes at qualified coordinates:

1. `NARROW_CONTRACT_REVIEW_PASS`
2. `CONTRACT_BUNDLE_FROZEN`
3. `ALL_CONSUMERS_INVENTORIED`
4. `ALL_REQUIRED_MIGRATIONS_COMPLETE`
5. `REAL_PROCESS_CONFORMANCE_PASS`
6. `DOMAIN_AUTHORIZATION_NEGATIVE_PASS`
7. `LEGACY_TRAFFIC_ZERO_GATE_PASS`
8. `REMOTE_EXACT_SHA_AUDIT_PASS`
9. `MAINLINE_RECONFORMANCE_PASS`

The historical V1 field MUST NOT be updated to represent V2 effectiveness. V0 frozen contracts
continue governing production until all gates pass. This proposed PR declares no production readiness.

### CTR-MAFV2-004 — Bounded implementation authority

```text
THIS_PROPOSED_PR_AUTHORIZES_IMPLEMENTATION = NO
ON_ACCEPTED_V2:
  INCORPORATED_FROZEN_CONTRACT_IMPLEMENTATION_AUTHORITY = contracts
  MIGRATION_SEQUENCING_IMPLEMENTATION_AUTHORITY = none
  CHILD_IMPLEMENTATION_SPEC_REQUIRED = YES
```

Accepted V2 preserves the same bounded implementation authority for CTR-MAFV2-001 frozen
contracts and bundle. CTR-MAFV2-002 sequencing does not itself authorize product changes.
No proposed PR #2 Decision ID is active authority; the V2 hard-cut direction is owned by
`DEC-MAFV2-004` through `DEC-MAFV2-006` only if this V2 is accepted and merged.

### CTR-MAFV2-005 — Atomic supersession lifecycle

Activation requires independent review PASS of the exact final revision, authorized Owner
acceptance, and merge into `main`. One acceptance-only docs change MUST atomically apply only:

| File | Exact allowed lifecycle/backlink delta |
|---|---|
| `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md` | frontmatter/text `status: proposed → accepted`; keep `supersedes: [MINIMAL_AUTH_FOUNDATION_V1]`; bind final accepted Head and acceptance receipt |
| `docs/contracts/minimal-auth-v1/README.md` | lifecycle wrapper `STATUS=SUPERSEDED`; add `SUPERSEDED_BY=MINIMAL_AUTH_FOUNDATION_V2`; set current V1 architecture implementation advertisement to `IMPLEMENTATION_AUTHORIZED=false`; preserve historical `MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE` meaning/value |
| `docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md` | `STATUS=SUPERSEDED`; add `SUPERSEDED_BY=MINIMAL_AUTH_FOUNDATION_V2` and `CURRENT_ARCHITECTURE_AUTHORITY=MINIMAL_AUTH_FOUNDATION_V2`; set `IMPLEMENTATION_AUTHORIZED=false`; replace current-authority prose only with a backlink to V2 |
| `.agents/local/README.md` | mark V2 accepted/current and V1 superseded with backlink |
| `docs/specs/README.md` | mark V2 accepted/current and V1 superseded with backlink; preserve all unrelated accepted rows |

No other V1 field, module, Contract, bundle byte, or semantic statement may change. Before this
atomic transition, V2 remains proposed and V1 remains active. After it, neither V1 lifecycle root
nor the compatibility entry may present V1 as current or directly implementable authority.

### CTR-MAFV2-006 — Complete downstream inventory without silent rewrite

Before effectiveness, inventory MUST include both:

1. all governing Specs with `governed_by` containing `MINIMAL_AUTH_FOUNDATION_V1`; and
2. all same-repository `external_authorities` entries whose `authority_id` is
   `MINIMAL_AUTH_FOUNDATION_V1`.

The evaluated inventory is frozen as:

| Downstream Spec | Status / exact accepted revision | Relationship | Bounded scope | Compatibility | Disposition |
|---|---|---|---|---|---|
| `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` | accepted / `d9dacf6e87dc3f23d8649047a9445e28908e7e6e` (blob `e51f5dc1a1e92469ec773c7f50959a6f356f4355`) | same-repository `external_authorities`: `MINIMAL_AUTH_FOUNDATION_V1@1da40d4...`, `constrained_by` | closed five-file ownerless direct-token/database repair | `COMPATIBLE_NO_SEMANTIC_DELTA` | preserve exact accepted Spec; any alignment is separate and independently reviewed |
| `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` | accepted / `1f7fa6378fa44042f3001b4a5813210c0a8313e8` (blob `d89bf08c8714f55571ee7d75da017b7cf7237096`) | `governed_by: [MINIMAL_AUTH_FOUNDATION_V1, AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1]` | Stage W: two exact `svc-workflow[workflow.read]` MachineAccessGrant rows; Stage F remains blocked | `COMPATIBLE_NO_SEMANTIC_DELTA` for MachineAccessGrant, Audience/Scope, audit, optimistic concurrency, and forward-only migration/rollback | `GRANDFATHERED_EXACT_V1_CONSTRAINT`; alignment amendment `NO`; future semantic amendment parent `MINIMAL_AUTH_FOUNDATION_V2` |

Both accepted Specs MUST remain byte-identical in this PR. The Canary disposition is a V2
Decision (`DEC-MAFV2-011`), not deferred review prose. Historical PR #2 remains
proposed/unmodified and cannot serve as authority.

### CTR-MAFV2-007 — Precedence and ownerless compatibility boundary

Accepted downstream Specs cannot own architecture supersession. V2 MUST preserve the
claims/profile/bundle semantics on which the ownerless Spec is constrained. At the evaluated base:

```text
OWNERLESS_SPEC_COMPATIBILITY = COMPATIBLE_NO_SEMANTIC_DELTA
OWNERLESS_SPEC_PRESERVED = YES
```

This result is bounded to the exact identities in CTR-MAFV2-001 and the ownerless Spec's existing
closed scope. It does not silently rewrite the Spec's external reference or decide its future
alignment; independent review must determine whether a separate amendment is required.

### CTR-MAFV2-008 — No silent divergence and acceptance coverage

Any pre-acceptance change to a CTR-MAFV2-001 immutable object, the evaluated authority graph, or
an unlisted lifecycle file invalidates the proposal and requires re-evaluation. CTR-MAFV2-005's
listed lifecycle-only delta is the sole exception to exact lifecycle-root identity. Mechanical
coverage validation MUST establish:

```text
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
CONTRACT_COVERAGE = PASS
ACCEPTANCE_REFERENCES_VALID = PASS
```

## 10. Acceptance

Every Required evidence tuple below MUST bind: authority revision, evaluated base, evaluated final
Head, reviewer/acceptance actor, execution timestamp, and persistent PR review or receipt.

### ACC-MAFV2-001 — Immutable identity and lifecycle-provenance check

- Contracts: `CTR-MAFV2-001`
- Method: execute `git rev-parse <evaluated-base>:<path>` for every table object and compare with the frozen SHA; separately verify lifecycle/migration provenance blobs
- Environment: clean `mayf3/auth-service` worktree at evaluated base `cb0b3d3...`
- Required evidence: full common tuple plus command output for every object
- Expected result: all immutable objects match; lifecycle root is excluded only as explicitly stated
- Failure condition: any mismatch, missing coordinate, or extra semantic exclusion

### ACC-MAFV2-002 — Phase-order and artifact-separation review

- Contracts: `CTR-MAFV2-002`
- Method: independent semantic review of each frozen phase/artifact/window invariant and contradiction search
- Environment: exact proposed authority Head and V1 migration provenance blob
- Required evidence: full common tuple plus reviewer matrix for every invariant
- Expected result: required PRE_CUT migration/evidence precedes deployment; new dual protocol is forbidden; Cut Artifact is V1-only
- Failure condition: any text denies pre-cut periods, permits a new dual artifact, or leaves Cut Artifact Legacy/mode/fallback behavior

### ACC-MAFV2-003 — Lifecycle-field and nine-gate review

- Contracts: `CTR-MAFV2-003`
- Method: exact-name comparison against all nine frozen V1 gates and static search for conflicting effectiveness declarations
- Environment: exact proposed authority Head plus V1 migration provenance source
- Required evidence: full common tuple plus nine-row gate comparison
- Expected result: V2 field remains false until all nine gates pass; V1 field remains historical
- Failure condition: missing/renamed gate, early effectiveness, or reuse of V1 field for V2 state

### ACC-MAFV2-004 — Implementation-authority boundary review

- Contracts: `CTR-MAFV2-004`
- Method: independent authority-flow review from frontmatter through Contracts and Decisions
- Environment: exact proposed authority Head and current repository authority graph
- Required evidence: full common tuple plus bounded authority matrix
- Expected result: proposed PR authorizes none; accepted frozen contracts retain `contracts`; sequencing remains `none` and requires child Spec
- Failure condition: sequencing directly authorizes product work or proposed PR #2 is treated as active authority

### ACC-MAFV2-005 — Atomic lifecycle transition review

- Contracts: `CTR-MAFV2-005`
- Method: compare final acceptance change to the five-file exact delta allowlist and verify both V1 representations no longer advertise current/direct implementation authority
- Environment: final accepted candidate Head and its evaluated base before merge
- Required evidence: full common tuple plus final diff, actor receipt, lifecycle field matrix, and persistent review
- Expected result: V2 accepted and V1 superseded atomically; only listed lifecycle/backlink deltas occur
- Failure condition: partial transition, premature backlink, extra V1 semantic delta, stale active compatibility entry, or missing persistent receipt

### ACC-MAFV2-006 — Downstream inventory coverage

- Contracts: `CTR-MAFV2-006`
- Method: machine search and human classification of both `governed_by` and same-repository `external_authorities.authority_id` references
- Environment: evaluated base and exact proposed authority Head
- Required evidence: full common tuple plus complete path/Spec/status/exact accepted revision/relation/owner/scope/compatibility/disposition table and object comparison for every relied-on V1 Grant/bundle object
- Expected result: both reference classes are inventoried; ownerless and Canary Specs remain byte-identical; Canary records `GRANDFATHERED_EXACT_V1_CONSTRAINT`, alignment amendment `NO`, product semantic delta `NONE`, and future semantic parent V2
- Failure condition: missing class/revision/scope, silent downstream rewrite, changed Grant dependency, unresolved Canary disposition, or any authority conflict

### ACC-MAFV2-007 — Ownerless compatibility review

- Contracts: `CTR-MAFV2-007`
- Method: compare ownerless bounded scope and V1 dependency semantics with CTR-MAFV2-001 identities and V2 delta scope
- Environment: accepted ownerless Spec at `cb0b3d3...` and exact proposed V2 Head
- Required evidence: full common tuple plus source-object comparison and independent compatibility finding
- Expected result: `COMPATIBLE_NO_SEMANTIC_DELTA`, ownerless Spec preserved byte-for-byte in this PR
- Failure condition: architecture conflict, changed relied-on semantics, ownerless file delta, or unreviewed alignment conclusion

### ACC-MAFV2-008 — Mechanical coverage and no-divergence gate

- Contracts: `CTR-MAFV2-008`
- Method: parse all `CTR-MAFV2-*` and `ACC-MAFV2-*` IDs, validate every reference both directions, verify allowed file scope and remote coordinates
- Environment: clean task worktree at evaluated final Head; GitHub remote immediately before push/acceptance
- Required evidence: full common tuple plus counts, reference validation, docs-only diff, object checks, and remote SHA receipt
- Expected result: 8 Contracts, 8 covered Contracts, valid references, no silent identity drift
- Failure condition: count/coverage/reference failure, disallowed file, object drift, or remote coordinate drift

### 10.1 Bidirectional coverage table

| Contract | Acceptance |
|---|---|
| `CTR-MAFV2-001` | `ACC-MAFV2-001` |
| `CTR-MAFV2-002` | `ACC-MAFV2-002` |
| `CTR-MAFV2-003` | `ACC-MAFV2-003` |
| `CTR-MAFV2-004` | `ACC-MAFV2-004` |
| `CTR-MAFV2-005` | `ACC-MAFV2-005` |
| `CTR-MAFV2-006` | `ACC-MAFV2-006` |
| `CTR-MAFV2-007` | `ACC-MAFV2-007` |
| `CTR-MAFV2-008` | `ACC-MAFV2-008` |

| Acceptance | Contracts |
|---|---|
| `ACC-MAFV2-001` | `CTR-MAFV2-001` |
| `ACC-MAFV2-002` | `CTR-MAFV2-002` |
| `ACC-MAFV2-003` | `CTR-MAFV2-003` |
| `ACC-MAFV2-004` | `CTR-MAFV2-004` |
| `ACC-MAFV2-005` | `CTR-MAFV2-005` |
| `ACC-MAFV2-006` | `CTR-MAFV2-006` |
| `ACC-MAFV2-007` | `CTR-MAFV2-007` |
| `ACC-MAFV2-008` | `CTR-MAFV2-008` |

## 11. Alternatives and disposition

- `ALT-MAFV2-001` — prose-only partial supersession。Rejected by `DEC-MAFV2-001`。
- `ALT-MAFV2-002` — exact-pin lifecycle root while also mutating it。Rejected by
  `DEC-MAFV2-002`; mutable wrapper is excluded and provenance-pinned。
- `ALT-MAFV2-003` — build a new dual-protocol artifact。Rejected by `DEC-MAFV2-005`。
- `ALT-MAFV2-004` — import proposed PR #2 Decisions as authority。Rejected by
  `DEC-MAFV2-006`。
- `ALT-MAFV2-005` — silently rewrite accepted ownerless or Canary Grant Spec。Rejected by
  `DEC-MAFV2-009`。
- `ALT-MAFV2-006` — force an alignment amendment despite exact preservation of all Canary
  dependencies。Rejected by `DEC-MAFV2-011`; preserve the exact V1 constraint and require V2 only
  for a future Canary semantic amendment。

## 12. Migration, compatibility, and rollback

This amendment is docs-only. It does not alter product source, Prisma, migrations, runtime,
deployment, contract bundle, vendored governance, ownerless/Canary accepted Specs, or PR #2. V1 remains active before atomic
activation. The existing PRE_CUT artifact supplies the required migration/evidence period; the new
Cut Artifact is V1-only. Runtime rollback, if later authorized by an implementation Spec, is
whole-release only. Authority rollback after acceptance requires a new whole-authority transition
or an explicitly recorded docs-only revert; it cannot be inferred from runtime state.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
OWNERLESS_SPEC_COMPATIBILITY = COMPATIBLE_NO_SEMANTIC_DELTA
CANARY_GRANT_COMPATIBILITY = COMPATIBLE_NO_SEMANTIC_DELTA
CANARY_GRANT_REFERENCE_DISPOSITION = GRANDFATHERED_EXACT_V1_CONSTRAINT
CANARY_GRANT_ALIGNMENT_AMENDMENT_REQUIRED = NO
CANARY_GRANT_PRODUCT_SEMANTIC_DELTA = NONE
FUTURE_CANARY_GRANT_SEMANTIC_AMENDMENT_PARENT = MINIMAL_AUTH_FOUNDATION_V2
```

The amended exact Head still requires a new independent semantic review. The previous PR #7 review
is historical evidence only and does not authorize acceptance, implementation, deployment, or merge.
