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

### 3.2 V1 root full-body incorporation and closed lifecycle mask

```text
V1_LIFECYCLE_ROOT = docs/contracts/minimal-auth-v1/README.md
V1_COMPATIBILITY_ENTRY = docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md
V1_ROOT_BASE_BLOB = fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f
V1_ROOT_NORMATIVE_BODY = EXACTLY_INCORPORATED_BY_V2
V1_ROOT_MASKED_DIGEST_ALGORITHM = SHA-256
V1_ROOT_MASKED_DIGEST = 953085bf7265b0d53870e90771c87be3cea29477eb459ca04cb7c0e744b71468
V1_ROOT_DELTA_OUTSIDE_MASK = 0
```

V1 root 不是整体可变的 wrapper。V2 完整继承 base blob 的 normative body，唯一允许
acceptance transition 改变的是第一段 `## 1. 文档状态` fenced `text` status block 内
以下封闭字段：

| Field | Exact position in V1 root status block | Base value | Only accepted-transition value |
|---|---|---|---|
| `STATUS` | immediately after `CONTRACT_VERSION=1.0.0` | `FROZEN_TARGET_CONTRACT` | `SUPERSEDED` |
| `SUPERSEDED_BY` | new line immediately after `STATUS` | absent | `MINIMAL_AUTH_FOUNDATION_V2` |
| `CURRENT_ARCHITECTURE_AUTHORITY` | new line immediately after `SUPERSEDED_BY` | absent | `MINIMAL_AUTH_FOUNDATION_V2` |
| `IMPLEMENTATION_AUTHORIZED` | immediately after `CONTRACT_BUNDLE_FROZEN=true` | `true` | `false` |

Masked digest canonicalization MUST operate on UTF-8/LF bytes from the Git blob: within only that
first status block, remove lines whose key is one of the four mask fields; immediately after
`CONTRACT_VERSION=1.0.0` insert, in order, `STATUS=<MASKED>`,
`SUPERSEDED_BY=<MASKED>`, `CURRENT_ARCHITECTURE_AUTHORITY=<MASKED>`; immediately after
`CONTRACT_BUNDLE_FROZEN=true` insert `IMPLEMENTATION_AUTHORIZED=<MASKED>`; preserve every other
byte and SHA-256 the resulting bytes. The base blob and final accepted V1 root MUST produce the
same digest above. Any other changed byte makes `V1_ROOT_DELTA_OUTSIDE_MASK > 0` and blocks
acceptance.

V2 therefore inherits without reinterpretation: `VALID_TOKEN != AUTHORIZED_OPERATION`,
`SCOPE != DOMAIN_AUTHORIZATION`, direct and delegated models, Principal/MachineClient/HumanClient
shapes, auth-service/resource-service ownership, credential storage and rotation, Credential Broker
trust boundary, RS256/JWKS/key rotation, disable/revoke/offline verification, Legacy product-role
exclusion, and implementation/conformance/effectiveness sequencing.

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
五文件产品范围不拥有 architecture supersession。本 PR 不修改它；完整 V1 root 与
claims/profile/bundle semantics 已由 V2 继承，因此本 V2 冻结其 reference disposition，
不留待未来 review 决定。

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

### 3.5 V2 Activation Record model

```text
ACTIVATION_RECORD_ID = MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1
ACTIVATION_RECORD_PATH = docs/contracts/minimal-auth-v2/activation/MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1.json
ACTIVATION_RECORD_SCHEMA_OWNER = AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
RECORD_CREATION_OWNER = AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
EFFECTIVE_RECORD_CREATED_BY_THIS_PR = NO
FROZEN_V1_MANIFEST_MUTATION_REQUIRED = NO
```

Canonical projection rule:

- no accepted, independently reviewed effective Activation Record at the exact path →
  `MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE=false`;
- one accepted effective record that binds all nine passing gates, Owner acceptance, V2 authority
  revision, implementation/deployment revisions, environment, evidence revisions, actors and
  timestamps → `MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE=true`;
- any missing, duplicate, proposed, unreviewed, stale or internally inconsistent record projects
  false and MUST NOT be repaired by editing an accepted Contract literal or frozen manifest.

All lifecycle fields in the frozen V1 1.2.0 manifest are
`FREEZE_TIME_HISTORICAL_FACTS`. Production Activation MUST NOT update that manifest in place.
The Activation Record projects current values for:

```text
MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE
production_deployment.status
consumer_migration.status
legacy_consumers_migrated
v0_compatibility.supersedes_v0
```

`MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE` remains historical V1 authority meaning only and
is not mutable V2 state. A future PR #2 amendment MUST delete any duty to update the old manifest
directly and instead require creation, independent review and Owner acceptance of this V2 Activation
Record. This rule does not modify PR #2 in the present PR.

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

### STATE-MAFV2-003 — Round 2 review is historical evidence only

- Subject: PR #7 independent semantic Round 2 review of the prior amended Head
- As-of commit / artifact revision: base `e9b6dbccf9779ff8ba7681dba6bbc61bfa5c7e09`, Head `263b0c685a35e9e9299f0470acc38b14b5a9ed10`
- Environment: persistent GitHub PR #7 review record
- Observed at: `2026-08-20T14:37:00Z`
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

### STATE-MAFV2-007 — V1 root contains load-bearing normative architecture

- Subject: V1 root bytes outside the closed four-field lifecycle mask
- As-of commit / artifact revision: blob `fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f`
- Environment: Git object database and deterministic UTF-8/LF digest procedure
- Observed at: `2026-08-20T23:45:10Z`
- Basis: `OBS-MAFV2-008`, `CLM-MAFV2-008`, `EVD-MAFV2-008`

### STATE-MAFV2-008 — No effective V2 Activation Record exists

- Subject: `MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1` current source-tree presence and V1 manifest lifecycle facts
- As-of commit / artifact revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`
- Environment: `mayf3/auth-service` source repository, `github/main`
- Observed at: `2026-08-20T23:45:10Z`
- Basis: `OBS-MAFV2-009`, `CLM-MAFV2-009`, `EVD-MAFV2-009`

### STATE-MAFV2-009 — Cut-introduced caller sequencing requires isolated candidate conformance

- Subject: V1 surface availability classes and fixed-SHA caller activation order
- As-of commit / artifact revision: evaluated base `cb0b3d37dfb105c763c9c83ebd65483270b21b81`; historical PR #2 remains proposed
- Environment: source authority graph; no production execution asserted
- Observed at: `2026-08-20T23:45:10Z`
- Basis: `OBS-MAFV2-010`, `CLM-MAFV2-010`, `EVD-MAFV2-010`

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

### OBS-MAFV2-003 — Round 2 independent review

- Subject: PR #7 Round 2 review bound to the prior amended authority Head
- Source revision: base `e9b6dbccf9779ff8ba7681dba6bbc61bfa5c7e09`, Head `263b0c685a35e9e9299f0470acc38b14b5a9ed10`
- Environment: GitHub PR #7 persistent review record
- Observed at: `2026-08-20T14:37:00Z`
- Method: read the submitted exact-Head review through GitHub PR metadata
- Result: `REVISE`, four core blockers: complete root incorporation, lawful Activation Record transition, Cut-only surface order, and ownerless reference disposition
- Provenance: `https://github.com/mayf3/auth-service/pull/7` Round 2 review; historical review evidence only

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

### OBS-MAFV2-008 — V1 root masked-body digest

- Subject: exact V1 root base blob and all bytes outside the closed lifecycle mask
- Source revision: blob `fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f`
- Environment: clean task worktree, Git object database, Python 3 SHA-256
- Observed at: `2026-08-20T23:45:10Z`
- Method: execute the canonicalization algorithm frozen in §3.2 on `git show cb0b3d3...:docs/contracts/minimal-auth-v1/README.md`
- Result: canonicalized length `10866` bytes; SHA-256 `953085bf7265b0d53870e90771c87be3cea29477eb459ca04cb7c0e744b71468`; root contains the enumerated load-bearing architecture semantics
- Provenance: executed digest output in this PR authoring record and exact base blob

### OBS-MAFV2-009 — Frozen manifest facts and Activation Record absence

- Subject: V1 1.2.0 manifest lifecycle fields and V2 Activation Record path
- Source revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`; manifest blob `8557b36de241e39570f478e21a95ff375d11759a`
- Environment: clean task worktree and Git object database
- Observed at: `2026-08-20T23:45:10Z`
- Method: inspect `contract-manifest.json` lifecycle object and execute exact-path Git object existence check
- Result: manifest records V1/not-ready/not-started/false freeze-time facts; `MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1.json` is absent
- Provenance: manifest lines 1–28/`v0_compatibility.supersedes_v0`; executed path check in this PR authoring record

### OBS-MAFV2-010 — Resolution endpoint is Cut-introduced

- Subject: `GET /api/v1/clients/:client_id` implementation availability and proposed Runtime Child sequencing
- Source revision: evaluated base `cb0b3d37dfb105c763c9c83ebd65483270b21b81`; historical PR #2 is proposed only
- Environment: source repository and persistent PR #7 Round 2 review record
- Observed at: `2026-08-20T23:45:10Z`
- Method: execute Git object existence check for `src/lib/oauth/v1/resolution.ts` and inspect the exact-Head Round 2 review coordinates
- Result: resolution implementation is absent from the evaluated base and classified as CREATE work in the V1-only Runtime Child; it cannot be a PRE_CUT existing production surface
- Provenance: executed Git check and PR #7 review bound to `263b0c685a35e9e9299f0470acc38b14b5a9ed10`

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
- Uncertainty: compatibility is bounded to the exact full-root/modules/bundle incorporation and accepted Spec's closed scope; future product semantic change requires V2 as parent, but current alignment is conclusively not required

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

### CLM-MAFV2-008 — Closed-mask incorporation preserves the complete V1 root meaning

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-008`
- Contradicted by evidence: none known
- Uncertainty: proof is byte-exact for the base blob and specified canonicalization; final acceptance must rerun it against the final V1 root

### CLM-MAFV2-009 — A separate Activation Record avoids accepted-literal and manifest mutation

- Support state: SUPPORTED
- Supported by evidence: `EVD-MAFV2-009`
- Contradicted by evidence: none known
- Uncertainty: this freezes the authority model and ownership; no effective record or production evidence exists in this PR

### CLM-MAFV2-010 — Isolated candidate conformance closes the Cut-only activation cycle

- Support state: INFERRED
- Supported by evidence: `EVD-MAFV2-010`
- Contradicted by evidence: none known
- Uncertainty: sequence is normatively complete but not executed; fixed-SHA caller and real-process/staging evidence remain future implementation evidence

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
- Bound coordinates: PR #7 base `e9b6dbc...`, reviewed Head `263b0c6...`, GitHub review submitted `2026-08-20T14:37:00Z`
- Strength / sufficiency: strong historical evidence for the four Round 2 blockers and need for a new review
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

### EVD-MAFV2-008 — Masked digest supports full-root incorporation

- Source observations: `OBS-MAFV2-008`
- Target: `CLM-MAFV2-008`, `STATE-MAFV2-007`
- Relation: SUPPORTS
- Bound coordinates: V1 root blob `fbaf7c89...`, canonicalized bytes `10866`, observed `2026-08-20T23:45:10Z`
- Strength / sufficiency: byte-exact and reproducible for the base root outside the four-field mask
- Limitations: final accepted root comparison must be executed after lifecycle-field changes
- Provenance: executed SHA-256 receipt and §3.2 canonical algorithm

### EVD-MAFV2-009 — Manifest and path observations support separate Activation Record

- Source observations: `OBS-MAFV2-009`
- Target: `CLM-MAFV2-009`, `STATE-MAFV2-008`
- Relation: SUPPORTS
- Bound coordinates: manifest blob `8557b36d...`, evaluated base `cb0b3d3...`, observed `2026-08-20T23:45:10Z`
- Strength / sufficiency: exact for immutable manifest contents and current record absence
- Limitations: does not create or accept an Activation Record
- Provenance: manifest source and executed exact-path existence check

### EVD-MAFV2-010 — Surface absence supports isolated Cut-candidate sequence

- Source observations: `OBS-MAFV2-010`
- Target: `CLM-MAFV2-010`, `STATE-MAFV2-009`
- Relation: SUPPORTS
- Bound coordinates: evaluated base `cb0b3d3...`, historical review Head `263b0c6...`, observed `2026-08-20T23:45:10Z`
- Strength / sufficiency: sufficient to classify the resolution endpoint as not PRE_CUT-existing and require a non-production candidate path
- Limitations: proposed PR #2 is provenance, not active authority; V2 owns the selected sequence only upon acceptance
- Provenance: executed source-path check and persistent PR #7 Round 2 review

## 8. Decisions

- `DEC-MAFV2-001` — V2 whole 地取代 V1；拒绝 module/prose partial supersession。
- `DEC-MAFV2-002` — V1 root normative body 按 base blob 完整并入；仅四个 status-block
  lifecycle fields 使用封闭 mask，并以相同 masked SHA-256 证明 mask 外 delta 为零。
- `DEC-MAFV2-003` — authority delta 仅为 migration / hard-cut / sequencing。
- `DEC-MAFV2-004` — Phase 3 build/verify Cut Artifact but do not deploy；Phase 4 在
  existing PRE_CUT legacy-carrying artifact 的 V1 surfaces 上迁移；Phase 5 先证明全部
  pre-deployment gates，再执行 Auth Cut、Cut-only caller activation、mainline reconformance，
  最后由 Activation Record 汇总九门。
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
- `DEC-MAFV2-012` — V1 1.2.0 manifest lifecycle fields 是 freeze-time historical
  facts；V2 current effectiveness 只由单独、accepted 的 V2 Activation Record 投影。
- `DEC-MAFV2-013` — Cut-introduced surfaces 必须在 isolated real-process/staging Cut
  candidate 上完成 fixed-SHA caller E2E，然后按 Auth Cut endpoint ready 后 caller activation
  的顺序生产切换；不得引入兼容 artifact/window。
- `DEC-MAFV2-014` — accepted ownerless Spec 的 exact V1 constraint 按
  `GRANDFATHERED_EXACT_V1_CONSTRAINT` 保留；alignment amendment 不需要，产品语义 delta
  为零，未来 semantic amendment parent 是 V2。

## 9. Contracts

### CTR-MAFV2-001 — Immutable incorporation and lifecycle provenance

以下对象按新 Base 重验并构成 V2 unchanged normative 内容。V1 root 的整个 normative
body 也被并入；只有 §3.2/CTR-MAFV2-009 的封闭 lifecycle mask 可在 acceptance
transition 改值，其余 root bytes 必须保持 masked digest identity。

| Content | Object / masked identity @ `cb0b3d3...` |
|---|---|
| `docs/contracts/minimal-auth-v1/README.md` complete root body | base blob `fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f`; masked SHA-256 `953085bf7265b0d53870e90771c87be3cea29477eb459ca04cb7c0e744b71468` |
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
V1_ROOT_BASE_BLOB = fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f
V1_ROOT_NORMATIVE_BODY = EXACTLY_INCORPORATED_BY_V2
V1_ROOT_DELTA_OUTSIDE_MASK = 0
V1_MIGRATION_MODULE_REPLACED_BLOB_PROVENANCE = 954b661e84697a7b78566fadd09383dd5298b5d4
```

Only CTR-MAFV2-005/009 masked lifecycle-field mutation is allowed at acceptance. Root,
claims, profiles, grants, delegation, human-session, conformance and bundle meaning MUST NOT change.

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
PHASE_5 = PROVE_PRE_DEPLOYMENT_GATES_THEN_COORDINATED_CUT_CALLER_ACTIVATION_AND_RECONFORMANCE
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
surfaces; the Cut Artifact MUST contain V1 only. “Pre-deployment gates” excludes facts that can
exist only after the Cut (production Cut-only endpoint readiness, Cut-only caller activation and
`MAINLINE_RECONFORMANCE_PASS`). All nine gates are complete only after CTR-MAFV2-011 steps 6–9;
only then may the Activation Record project V2 effective.

### CTR-MAFV2-003 — Successor lifecycle field and nine gates

```text
SUCCESSOR_MAINLINE_EFFECTIVE_FIELD = MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE
HISTORICAL_V1_FIELD = MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE
CURRENT_PROJECTION_WITHOUT_VALID_ACTIVATION_RECORD = false
EFFECTIVENESS_SOURCE_OF_TRUTH = MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1
```

The accepted Contract literal MUST NOT later be flipped. The projected V2 field is false unless
CTR-MAFV2-010's accepted effective Activation Record exists. That record cannot project true until
every gate below passes at qualified coordinates:

1. `NARROW_CONTRACT_REVIEW_PASS`
2. `CONTRACT_BUNDLE_FROZEN`
3. `ALL_CONSUMERS_INVENTORIED`
4. `ALL_REQUIRED_MIGRATIONS_COMPLETE`
5. `REAL_PROCESS_CONFORMANCE_PASS`
6. `DOMAIN_AUTHORIZATION_NEGATIVE_PASS`
7. `LEGACY_TRAFFIC_ZERO_GATE_PASS`
8. `REMOTE_EXACT_SHA_AUDIT_PASS`
9. `MAINLINE_RECONFORMANCE_PASS`

The historical V1 field and frozen V1 1.2.0 manifest MUST NOT be updated to represent V2
effectiveness. V0 frozen contracts continue governing production until a valid record proves every
gate. This proposed PR declares no production readiness and creates no effective record.

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
| `docs/contracts/minimal-auth-v1/README.md` | only the §3.2 four-field mask at exact positions: `STATUS=SUPERSEDED`; add `SUPERSEDED_BY=MINIMAL_AUTH_FOUNDATION_V2`; add `CURRENT_ARCHITECTURE_AUTHORITY=MINIMAL_AUTH_FOUNDATION_V2`; `IMPLEMENTATION_AUTHORIZED=false`; masked digest unchanged and all other bytes exact |
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
| `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` | accepted / `d9dacf6e87dc3f23d8649047a9445e28908e7e6e` (blob `e51f5dc1a1e92469ec773c7f50959a6f356f4355`) | same-repository `external_authorities`: `MINIMAL_AUTH_FOUNDATION_V1@1da40d4...`, `constrained_by` | closed five-file ownerless direct-token/database repair | `COMPATIBLE_NO_SEMANTIC_DELTA` | `GRANDFATHERED_EXACT_V1_CONSTRAINT`; alignment amendment `NO`; future semantic amendment parent `MINIMAL_AUTH_FOUNDATION_V2` |
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
OWNERLESS_REFERENCE_DISPOSITION = GRANDFATHERED_EXACT_V1_CONSTRAINT
OWNERLESS_ALIGNMENT_AMENDMENT_REQUIRED = NO
OWNERLESS_PRODUCT_SEMANTIC_DELTA = NONE
FUTURE_OWNERLESS_SEMANTIC_AMENDMENT_PARENT = MINIMAL_AUTH_FOUNDATION_V2
```

This V2 Decision is final for the exact incorporated V1 root/modules/bundle and ownerless closed
scope; it is not deferred to future review prose. The accepted ownerless Spec remains byte-identical.

### CTR-MAFV2-008 — No silent divergence and acceptance coverage

Any pre-acceptance change to a CTR-MAFV2-001 immutable object, the evaluated authority graph, or
an unlisted lifecycle file invalidates the proposal and requires re-evaluation. CTR-MAFV2-005's
listed four-field root mask is the sole exception to exact root-byte identity. Mechanical
coverage validation MUST establish:

```text
CONTRACT_COUNT = 12
CONTRACTS_WITH_ACCEPTANCE = 12
CONTRACT_COVERAGE = PASS
ACCEPTANCE_REFERENCES_VALID = PASS
```

### CTR-MAFV2-009 — V1 root closed-mask preservation

The final accepted transition MUST use exactly the four fields, positions and values in §3.2.
Both base and final V1 roots MUST produce masked SHA-256
`953085bf7265b0d53870e90771c87be3cea29477eb459ca04cb7c0e744b71468` under the
frozen algorithm. Acceptance requires:

```text
V1_ROOT_NORMATIVE_BODY = EXACTLY_INCORPORATED_BY_V2
V1_ROOT_DELTA_OUTSIDE_MASK = 0
```

A missing/extra mask key, alternate position/value, changed newline/encoding, or any other byte delta
MUST fail closed. The complete root semantics enumerated in §3.2 remain V2 normative meaning.

### CTR-MAFV2-010 — Immutable V2 Activation Record transition model

```text
ACTIVATION_RECORD_ID = MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1
ACTIVATION_RECORD_PATH = docs/contracts/minimal-auth-v2/activation/MINIMAL_AUTH_FOUNDATION_V2_ACTIVATION_V1.json
ACTIVATION_RECORD_SCHEMA_OWNER = AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
RECORD_CREATION_OWNER = AUTH_SERVICE_V1_PRODUCTION_ACTIVATION_V1
FROZEN_V1_MANIFEST_MUTATION_REQUIRED = NO
```

This PR MUST NOT create an effective record. A future record can project effective=true only when it
is independently reviewed, Owner-accepted, at the exact path, unique, and binds: V2 accepted
revision; all nine gate names/results; implementation, Cut Artifact and caller fixed SHAs;
environment; evidence revisions/receipts; reviewer, acceptance actor and execution timestamps.
Absent or invalid record projects all current V2 effectiveness fields false/not-ready/not-started.

The record, not an accepted Contract edit or manifest edit, MUST project:

```text
MINIMAL_AUTH_FOUNDATION_V2_MAINLINE_EFFECTIVE
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE
production_deployment.status
consumer_migration.status
legacy_consumers_migrated
v0_compatibility.supersedes_v0
```

All corresponding V1 1.2.0 manifest values remain `FREEZE_TIME_HISTORICAL_FACTS` byte-identical.
`MINIMAL_AUTH_FOUNDATION_V1_MAINLINE_EFFECTIVE` remains historical V1 meaning. PR #2's future
amendment MUST replace any old-manifest mutation obligation with Activation Record creation,
review and acceptance; this PR does not modify PR #2.

### CTR-MAFV2-011 — Cut-introduced surface classification and coordinated order

Every consumer dependency MUST be classified:

```text
PRE_CUT_EXISTING_SURFACE = available on EXISTING_DEPLOYED_LEGACY_CARRYING_ARTIFACT
CUT_INTRODUCED_SURFACE = first available only in V1_ONLY Cut Artifact
GET /api/v1/clients/:client_id = CUT_INTRODUCED_SURFACE
ISOLATED_CUT_CANDIDATE_EXECUTION = REQUIRED
ISOLATED_CUT_CANDIDATE_PRODUCTION_DEPLOYMENT = NO
CUT_ONLY_CALLER_FIXED_SHA_READY = REQUIRED_BEFORE_CUT
CUT_ONLY_CALLER_E2E_ENVIRONMENT = ISOLATED_REAL_PROCESS_OR_STAGING
CUT_ONLY_CALLER_PRODUCTION_ACTIVATION = AFTER_AUTH_CUT_ENDPOINT_READY
```

The required order is immutable:

1. build the V1-only Cut Artifact;
2. run the real Cut candidate in isolated/staging, never as pre-gate production deployment;
3. run fixed-SHA Agent Core caller State F E2E against that candidate;
4. complete production migration of every PRE_CUT existing-surface consumer;
5. prove Legacy traffic zero for the frozen window;
6. deploy the Auth Cut Artifact;
7. verify the Cut-only endpoint is ready in production;
8. activate the fixed-SHA caller artifact that depends on that endpoint;
9. perform mainline reconformance and create/accept the Activation Record only if every gate passes.

`ALL_REQUIRED_MIGRATIONS_COMPLETE` means: every PRE_CUT existing-surface production consumer is
migrated, and every Cut-only caller has fixed-SHA implementation plus isolated real-process/staging
conformance ready. It does **not** falsely assert Cut-only production caller activation before the
Auth Cut; that separate fact becomes true only at step 8 and is required before step 9. This order
MUST NOT introduce a new dual-protocol artifact, mode switch, per-request fallback, production
pre-cut Cut-candidate deployment, or post-cut compatibility window.

### CTR-MAFV2-012 — Ownerless exact-reference disposition

For accepted `AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1@d9dacf6e87dc3f23d8649047a9445e28908e7e6e`:

```text
OWNERLESS_REFERENCE_DISPOSITION = GRANDFATHERED_EXACT_V1_CONSTRAINT
OWNERLESS_ALIGNMENT_AMENDMENT_REQUIRED = NO
OWNERLESS_PRODUCT_SEMANTIC_DELTA = NONE
FUTURE_OWNERLESS_SEMANTIC_AMENDMENT_PARENT = MINIMAL_AUTH_FOUNDATION_V2
```

This disposition is supported by CTR-MAFV2-001/009 complete V1 semantic incorporation and applies
without changing the accepted ownerless Spec. Any future ownerless semantic amendment MUST name V2
as parent and receive its own review; no current alignment amendment or implementation gate exists.

## 10. Acceptance

Every Required evidence tuple below MUST bind: authority revision, evaluated base, evaluated final
Head, reviewer/acceptance actor, execution timestamp, and persistent PR review or receipt.

### ACC-MAFV2-001 — Immutable identity and lifecycle-provenance check

- Contracts: `CTR-MAFV2-001`
- Method: execute `git rev-parse <evaluated-base>:<path>` for every table object and compare with the frozen SHA; separately verify lifecycle/migration provenance blobs
- Environment: clean `mayf3/auth-service` worktree at evaluated base `cb0b3d3...`
- Required evidence: full common tuple plus command output for every object
- Expected result: all immutable objects match; complete V1 root is incorporated under the closed mask and exact masked digest
- Failure condition: any mismatch, missing coordinate, dropped root semantic body, or unlisted semantic exclusion

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
- Expected result: V2 field projects false without a valid Activation Record and true only from an accepted record proving all nine gates; V1 field remains historical
- Failure condition: missing/renamed gate, mutable accepted literal, early effectiveness, old-manifest mutation, or reuse of V1 field for V2 state

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
- Required evidence: full common tuple plus final diff, actor receipt, exact four-field root mask matrix, masked-digest receipt, and persistent review
- Expected result: V2 accepted and V1 superseded atomically; only listed lifecycle/backlink deltas occur; root mask delta outside allowlist is zero
- Failure condition: partial transition, premature backlink, extra/mispositioned root field, masked-digest mismatch, extra V1 semantic delta, stale active compatibility entry, or missing persistent receipt

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
- Expected result: `COMPATIBLE_NO_SEMANTIC_DELTA`, ownerless Spec preserved byte-for-byte, and disposition is grandfathered/no-alignment/no-product-delta
- Failure condition: architecture conflict, changed relied-on semantics, ownerless file delta, unresolved disposition, or any current alignment requirement

### ACC-MAFV2-008 — Mechanical coverage and no-divergence gate

- Contracts: `CTR-MAFV2-008`
- Method: parse all `CTR-MAFV2-*` and `ACC-MAFV2-*` IDs, validate every reference both directions, verify allowed file scope and remote coordinates
- Environment: clean task worktree at evaluated final Head; GitHub remote immediately before push/acceptance
- Required evidence: full common tuple plus counts, reference validation, docs-only diff, object checks, and remote SHA receipt
- Expected result: 12 Contracts, 12 covered Contracts, valid references, no silent identity drift
- Failure condition: count/coverage/reference failure, disallowed file, object drift, or remote coordinate drift

### ACC-MAFV2-009 — V1 root mask and digest proof

- Contracts: `CTR-MAFV2-009`
- Method: run the frozen canonicalization independently on base blob and final accepted V1 root; byte-diff all non-mask content and validate exact field positions/values
- Environment: clean Git worktree containing the exact final acceptance candidate and base object database
- Required evidence: full common tuple plus script/source hash, base/final canonical byte counts and SHA-256 values, raw four-field diff, and non-mask delta count
- Expected result: both digests equal `953085bf7265b0d53870e90771c87be3cea29477eb459ca04cb7c0e744b71468`; `V1_ROOT_DELTA_OUTSIDE_MASK=0`
- Failure condition: digest mismatch, nonzero outside-mask delta, unexpected key/value/position, newline/encoding change, or incomplete root-body ownership

### ACC-MAFV2-010 — Activation Record model and immutable manifest

- Contracts: `CTR-MAFV2-010`
- Method: validate no effective record is created by this PR; review record schema/ownership/projection rules and diff the V1 manifest against its frozen blob
- Environment: exact proposed V2 Head, V1 manifest blob `8557b36d...`, and future Production Activation acceptance environment
- Required evidence: full common tuple plus path absence/presence receipt, nine-gate record matrix, unique-record check, accepted actor receipt, and manifest byte comparison
- Expected result: absent/invalid record projects false; only a unique accepted record with all evidence projects true; frozen manifest remains byte-identical
- Failure condition: mutable Contract literal, old-manifest mutation, missing field mapping/owner, proposed/unreviewed record treated effective, duplicate record, or incomplete evidence tuple

### ACC-MAFV2-011 — Cut-introduced surface coordinated activation

- Contracts: `CTR-MAFV2-011`
- Method: classify every consumer surface and execute the nine-step sequence in qualified environments, including fixed-SHA State F E2E against an isolated real Cut candidate
- Environment: isolated real-process or staging candidate for pre-cut E2E; production only for steps 4–9 after their prerequisites
- Required evidence: full common tuple plus surface inventory, Cut/caller SHAs, candidate process receipts, State F E2E, PRE_CUT migration receipts, zero-traffic window, endpoint readiness, caller activation, and mainline reconformance
- Expected result: Cut-only caller is implementation/conformance-ready before Cut, activated only after production endpoint readiness, and reconformance passes without compatibility mechanisms
- Failure condition: production candidate deployment before gates, caller activation before endpoint readiness, missing fixed-SHA E2E, conflated readiness/activation, dual artifact, mode switch, fallback, or post-cut window

### ACC-MAFV2-012 — Ownerless reference disposition

- Contracts: `CTR-MAFV2-012`
- Method: compare complete incorporated V1 root/modules/bundle semantics with ownerless accepted scope and verify its file remains byte-identical
- Environment: accepted ownerless revision `d9dacf6e...`, evaluated base, and exact proposed V2 Head
- Required evidence: full common tuple plus root masked-digest proof, dependency matrix, ownerless blob comparison, and disposition field check
- Expected result: `GRANDFATHERED_EXACT_V1_CONSTRAINT`, alignment amendment `NO`, product semantic delta `NONE`, future semantic parent V2
- Failure condition: missing root semantic, ownerless byte change, semantic conflict, unresolved disposition, alignment required, or wrong future parent

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
| `CTR-MAFV2-009` | `ACC-MAFV2-009` |
| `CTR-MAFV2-010` | `ACC-MAFV2-010` |
| `CTR-MAFV2-011` | `ACC-MAFV2-011` |
| `CTR-MAFV2-012` | `ACC-MAFV2-012` |

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
| `ACC-MAFV2-009` | `CTR-MAFV2-009` |
| `ACC-MAFV2-010` | `CTR-MAFV2-010` |
| `ACC-MAFV2-011` | `CTR-MAFV2-011` |
| `ACC-MAFV2-012` | `CTR-MAFV2-012` |

## 11. Alternatives and disposition

- `ALT-MAFV2-001` — prose-only partial supersession。Rejected by `DEC-MAFV2-001`。
- `ALT-MAFV2-002` — exclude the whole V1 root as a mutable wrapper。Rejected by
  `DEC-MAFV2-002`; full root meaning is incorporated and only a four-field mask may differ。
- `ALT-MAFV2-003` — build a new dual-protocol artifact。Rejected by `DEC-MAFV2-005`。
- `ALT-MAFV2-004` — import proposed PR #2 Decisions as authority。Rejected by
  `DEC-MAFV2-006`。
- `ALT-MAFV2-005` — silently rewrite accepted ownerless or Canary Grant Spec。Rejected by
  `DEC-MAFV2-009`。
- `ALT-MAFV2-006` — force an alignment amendment despite exact preservation of all Canary
  dependencies。Rejected by `DEC-MAFV2-011`; preserve the exact V1 constraint and require V2 only
  for a future Canary semantic amendment。
- `ALT-MAFV2-007` — flip accepted Contract literals or mutate frozen V1 manifest lifecycle facts。
  Rejected by `DEC-MAFV2-012`; use the separate versioned Activation Record。
- `ALT-MAFV2-008` — deploy a new Legacy-carrying compatibility artifact for Cut-only callers。
  Rejected by `DEC-MAFV2-013`; use isolated candidate conformance and coordinated activation。
- `ALT-MAFV2-009` — defer ownerless disposition to future review prose。Rejected by
  `DEC-MAFV2-014`; exact-reference grandfathering is frozen now。

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
OWNERLESS_REFERENCE_DISPOSITION = GRANDFATHERED_EXACT_V1_CONSTRAINT
OWNERLESS_ALIGNMENT_AMENDMENT_REQUIRED = NO
OWNERLESS_PRODUCT_SEMANTIC_DELTA = NONE
FUTURE_OWNERLESS_SEMANTIC_AMENDMENT_PARENT = MINIMAL_AUTH_FOUNDATION_V2
V2_ACTIVATION_RECORD_MODEL = FROZEN
FROZEN_V1_MANIFEST_MUTATION_REQUIRED = NO
CANARY_GRANT_COMPATIBILITY = COMPATIBLE_NO_SEMANTIC_DELTA
CANARY_GRANT_REFERENCE_DISPOSITION = GRANDFATHERED_EXACT_V1_CONSTRAINT
CANARY_GRANT_ALIGNMENT_AMENDMENT_REQUIRED = NO
CANARY_GRANT_PRODUCT_SEMANTIC_DELTA = NONE
FUTURE_CANARY_GRANT_SEMANTIC_AMENDMENT_PARENT = MINIMAL_AUTH_FOUNDATION_V2
```

The amended exact Head still requires a new independent semantic review. The previous PR #7 review
is historical evidence only and does not authorize acceptance, implementation, deployment, or merge.
