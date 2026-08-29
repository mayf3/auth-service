---
spec_id: AUTH_SERVICE_AGENTCORE_DOMAIN_OWNER_WORKFLOW_EXECUTE_GRANT_V1
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V4
    revision: f4bfbb7cbc1dbcdb29c1caa472408adc41378fbf
    relation: constrained_by

  - repository: mayf3/svc-workflow
    authority_id: WORKFLOW_HTTP_CONTRACT_V1
    revision: 68c78bb01bd088883048edb481df02214e596be7
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_DOMAIN_OWNER_WORKFLOW_EXECUTE_GRANT_V1

> **PROPOSED — DOCS ONLY.** This bounded later-delta Child is inactive until
> independently reviewed, accepted by an authorized actor, and merged to
> `main`. This authoring PR changes only this file and `docs/specs/README.md`.
> It performs and authorizes no implementation, database write, Grant write,
> Principal/Client/credential mutation, production apply, acceptance, or merge.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = NEW
CHANGE_CLASS = NON_MECHANICAL
AUTHORITY_REPAIR_MECHANISM = BOUNDED_LATER_DELTA_CHILD
WHOLE_AUTHORITY_SUCCESSOR_REQUIRED = NO
PARTIAL_SUPERSESSION = NONE
EVALUATED_BASE = 7110463636693b3c2eced9d97ccb186adf46907d
ORIGINAL_AUTHORING_BASE = 325e781982c01a09d438e9d65df8079396e1520e
PREVIOUS_EVALUATED_BASE = b88512881135dd8a0d382e8ca76650059df33725
PREVIOUS_SPEC_HEAD = 7ae1d771bf1ecb3ed7b183c0279eeb85c617600a
REVIEW_ID = 5058012449
REVIEW_RESULT = REVISE
REVIEW_BLOCKERS_ADDRESSED = 5 / 5
MAIN_SYNC_REASON = NOTIFICATION_INGRESS_CONTRACT_BUNDLE_1_4_0_COMPATIBLE_NO_SEMANTIC_DELTA
CURRENT_MINIMAL_AUTH_CONTRACT_VERSION = 1.4.0
SVC_WORKFLOW_AUDIENCE_SEMANTICS_UNCHANGED = YES
WORKFLOW_SCOPE_VOCABULARY_UNCHANGED = YES
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
```

## 1. Goal

Establish prospective governing authority for the current and required
`svc-workflow` end state of exactly two trusted-fleet DOMAIN_OWNER identities:

```text
DOMAIN_OWNER_COUNT = 2
agt_hr-agent = [workflow.execute, workflow.read] @ version 2
agt_build-in-public-agent = [workflow.execute, workflow.read] @ version 2
CURRENT_WORKFLOW_EXECUTE_DEPENDENCY = PRESENT
WORKFLOW_EXECUTE_USED_SINCE_GRANT = YES
```

This Spec is a bounded later-delta Child of the completed one-time fleet supply
baseline. It governs only the two exact Workflow rows. It does not supersede or
rewrite the baseline operation, does not govern Forum authority, and does not
retroactively authorize the historical 2026-08-26 owner apply.

## 2. Scope and non-goals

### 2.1 In scope

- Exact identity binding for `agt_hr-agent` and
  `agt_build-in-public-agent` through deterministic Client external refs.
- Exact current/required `svc-workflow` scopes
  `[workflow.execute, workflow.read]`, version `2`, for those two identities.
- Preservation of the other 84 fleet Workflow rows at `[workflow.read]` with
  `AUTHORITY_DELTA = NONE` under the fleet V1 baseline.
- Current execute dependency and proven post-grant use.
- Honest classification of the historical owner-only apply and authority gap.
- Zero-write acceptance/merge and post-merge independent read-only conformance.
- Future narrowing/removal and expansion authority boundaries.

### 2.2 Out of scope and forbidden

- Every `svc-forum` Audience, Scope, Grant, version, audit, implementation, or
  authority decision. Forum is not a negative invariant of this Child.
- Any change to the other 84 fleet Workflow rows.
- Any third Client, Principal, Agent, Audience, or Scope.
- `workflow.admin`, wildcard/blanket Grant, role/display-name matching, generic
  online Grant administration, or union/copy from another identity.
- Principal, Client, credential, secret, legacy `allowedResources` /
  `allowedScopes`, HumanAudienceGrant, delegation, OpenClaw, or audit mutation.
- Re-execution or repurposing of the old fleet supply migration.
- In this authoring PR/round: product code, Prisma, script, test, deployment,
  runtime, production apply, acceptance, merge, rollback, or historical
  evidence rewrite. Future review/acceptance/merge remain separate phases.

## 3. Authority and dependencies

### 3.1 Bounded later-delta relationship to Fleet V1

`AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1` is the completed one-time
baseline operation authority that created the exact 86-client state. It remains
accepted and is not superseded, amended, reparented, or re-executed by this
Child. Its exact identity/relationship, fail-closed, optimistic concurrency,
closed-audit-envelope, privacy, and zero identity/credential/legacy mutation
constraints continue to constrain this Child.

```text
FLEET_V1_ROLE = COMPLETED_ONE_TIME_BASELINE_OPERATION_AUTHORITY
FLEET_V1_SUPERSEDED = NO
FLEET_V1_RERUN = FORBIDDEN
OTHER_WORKFLOW_ROW_COUNT = 84
OTHER_WORKFLOW_ROWS = [workflow.read]
OTHER_WORKFLOW_AUTHORITY_DELTA = NONE
```

V1's historical one-time target and conflict classification remain true for that
completed operation. This Child does not edit V1 stable IDs. It adds a new,
independent, prospective obligation for a later exact two-row state and therefore
uses `PREFLIGHT_MODE = NEW`, with no partial supersession.

### 3.2 Forum sibling isolation

At reviewed base `7110463636693b3c2eced9d97ccb186adf46907d`,
`AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` is an accepted sibling authority
whose own independent apply path may produce the exact moderator Forum state
`[forum.moderate, forum.read, forum.write]`. That is a time-indexed repository
fact, not a lifecycle invariant owned by this Workflow Child.

This PR and its eventual acceptance transaction make zero change to that sibling
file/parentage and zero Forum Grant write. This Child does not include Forum
state in its target, does not supersede/reparent the sibling, and makes no claim
about the sibling's future lifecycle or any future Forum permission model.

```text
AT_REVIEWED_BASE = 7110463636693b3c2eced9d97ccb186adf46907d
ACTIVE_SIBLING_AUTHORITY_AT_REVIEWED_BASE = AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1
ACTIVE_SIBLING_STATUS_AT_REVIEWED_BASE = accepted
THIS_PR_CHANGE_TO_FORUM_SIBLING = NONE
THIS_PR_CHANGE_TO_FORUM_GRANTS = NONE
FORUM_AUTHORITY = OUT_OF_SCOPE
FORUM_GRANT_WRITES = 0
FUTURE_FORUM_AUTHORITY_LIFECYCLE = NOT_GOVERNED_BY_THIS_SPEC
```

### 3.3 HR dispatcher separation

`AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1` governs the separate dedicated
identity `agt_workflow-dispatcher-hr-agent`, which is outside the exact-86
business fleet and has exactly:

```text
DISPATCHER_GRANTS = svc-workflow[workflow.read] + agent-wake[agent.wake]
HR_DISPATCHER_REPLACES_DOMAIN_OWNER_EXECUTE = NO
HR_MAIN_IDENTITY_UNTOUCHED = YES
```

The dispatcher has no `workflow.execute` and cannot replace the two Domain Owner
identities' execution responsibility.

### 3.4 External authority chain and ownership boundary

This Child is constrained by two exact external authorities in
`mayf3/svc-workflow`. Their revisions are fixed pins, not floating branches.

```text
EXTERNAL_AUTHORITY_COUNT = 2
PRODUCT_DIRECTION_AUTHORITY = SVC_WORKFLOW_PRODUCT_BOUNDARY_V4
PRODUCT_DIRECTION_REVISION = f4bfbb7cbc1dbcdb29c1caa472408adc41378fbf
PRODUCT_DIRECTION_PATH = docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V4.md
PRODUCT_DIRECTION_BLOB = c688593ac8986686c48553fb292b468b3225f06b
PRODUCT_DIRECTION_REVISION_ROLE = V4 merge commit
RUNTIME_CONTRACT_AUTHORITY = WORKFLOW_HTTP_CONTRACT_V1
CONTRACT_DELIVERY_REVISION = 68c78bb01bd088883048edb481df02214e596be7
CONTRACT_PATH = contracts/workflow-http/v1/contract.md
CONTRACT_BLOB = 9d81acb167567d9309846da504af2a5b73b86390
MANIFEST_PATH = contracts/workflow-http/v1/manifest.json
MANIFEST_BLOB = 067d09b326d8a09ac6c90d9d7b900b2278124bb8
CONTRACT_VERSION = 1.5.0
BUNDLE_DIGEST = f7ce39b6f053f8665139c4594c4d24322bfbafc35c0284bb18218a21ed834e89
OWNER_IMPLEMENTATION_SNAPSHOT = efcf0f515ec29600c459e660ce8aa84546c5aee3
OWNER_IMPLEMENTATION_SNAPSHOT_IS_AUTHORITY_REVISION = NO
CURRENT_SVC_WORKFLOW_MAIN = bf875c265843b3e07570a96b734051e9cfe27a43
CURRENT_MAIN_ROLE = PINNED_BLOB_NON_DRIFT_PROOF_ONLY
EXTERNAL_AUTHORITY_DRIFT = NO
```

Ownership is exact and non-overlapping:

```text
SVC_WORKFLOW_PRODUCT_BOUNDARY_V4_OWNS = Domain and Domain Owner product responsibility and authorization boundary
WORKFLOW_HTTP_CONTRACT_V1_OWNS = exact Assistance routes and the workflow.read / workflow.execute wire-level scope requirement
AUTH_SERVICE_CHILD_OWNS = the Grant end state of the two exact Clients (CTR-DOWE-001/002)
```

`SVC_WORKFLOW_PRODUCT_BOUNDARY_V4` (frontmatter `status: accepted`,
`authority_kind: product_direction`) owns what Domains and Domain Owners are
product-wise, including which product responsibility justifies their
authorization boundary. `WORKFLOW_HTTP_CONTRACT_V1` owns the exact Assistance
routes and the wire-level requirement that Assistance write routes require
`workflow.execute` and Assistance read routes require `workflow.read`. This
Child owns only the Grant end state of the two exact Clients. Runtime logs,
database usage records, and Grant audit rows support current-state claims
(`SUPPORT_CURRENT_STATE_CLAIMS = YES`) but never create or modify
`svc-workflow` product authority
(`CREATE_SVC_WORKFLOW_PRODUCT_AUTHORITY = NO`).

Pin semantics:

- The Product Direction authority revision is fixed to the V4 merge commit
  `f4bfbb7cbc1dbcdb29c1caa472408adc41378fbf`.
- The Runtime Contract authority revision is fixed to the Contract Bundle
  delivery commit `68c78bb01bd088883048edb481df02214e596be7`.
- `OWNER_IMPLEMENTATION_SNAPSHOT` `efcf0f515ec29600c459e660ce8aa84546c5aee3`
  (the Workflow Assistance V1 implementation, recorded as `owner_head_sha` in
  the pinned manifest) is an implementation snapshot only and is NOT the
  Contract authority revision; the manifest itself declares it is not the
  Contract Bundle delivery commit.
- `CURRENT_SVC_WORKFLOW_MAIN` is resolved only to prove the pinned blobs have
  not drifted upstream. The pins MUST NOT be advanced to the current main
  commit merely because upstream main moved.

## 4. Current State

### STATE-DOWE-001 — Repository authority base is exact

- Subject: `mayf3/auth-service` authority graph and governed paths.
- As-of commit: `github/main@325e781982c01a09d438e9d65df8079396e1520e`
  (`ORIGINAL_AUTHORING_BASE`, 2026-08-28 authoring round).
- Environment: fresh dedicated authoring worktree.
- Observed at: 2026-08-28 authoring round.
- Basis: `OBS-DOWE-001`, `CLM-DOWE-001`, `EVD-DOWE-001`.
- Provenance note: this block records the original authoring base and is
  preserved as historical provenance; the current evaluated base is bound by
  `STATE-DOWE-005`.

### STATE-DOWE-002 — Exact two current rows already conform

- Subject: exact Domain Owner `svc-workflow` rows and deterministic identity
  relationships.
- Environment: current auth-service database through database role `auth_ro`,
  with `transaction_read_only=on` and final action `ROLLBACK`.
- Observed at: `2026-08-29T08:26:20.706381Z`.
- Evidence artifact: `AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_OWNER_HELD_EVIDENCE_V1@2026-08-29T07:59:33.968375Z#sha256:e9a134bfcf0c9e2960eeb04769e491b9aef55273c2222bab1450677452cf28bd`.
- Result: fleet count `86`; two target rows, scopes
  `[workflow.execute, workflow.read]`, version `2`; Principal active; Client
  active; relationship `MATCH`; target anomaly count `0`; target duplicate
  count `0`; the other 84 rows equal the Fleet V1 baseline with anomaly and
  duplicate counts `0`; database and Grant writes `0`.
- Basis: `OBS-DOWE-002`, `OBS-DOWE-005`, `OBS-DOWE-006`, `CLM-DOWE-002`,
  `EVD-DOWE-002`.

### STATE-DOWE-003 — Execute dependency and use are present

- Subject: current Domain Owner workflow responsibility.
- Environment: current svc-workflow production database/audit records through a
  transaction-read-only query with final action `ROLLBACK`.
- Observed at: `2026-08-29T12:17:01.066779Z`.
- Evidence artifact:
  `AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_USE_EVIDENCE_V1@2026-08-29T12:17:01.066779Z#sha256:de3b707ce06f16be3be45bdb302218a3a92879cb175afec3cadc879139e7fff7`.
- Result: dependency `PRESENT`; used since grant `YES`, covering Workflow
  Assistance resolve, Workflow instance cancel, and both current enabled Domain
  Owner relationships.
- Basis: `OBS-DOWE-003`, `CLM-DOWE-003`, `EVD-DOWE-003`.

### STATE-DOWE-004 — Historical apply lacked governing Spec authority

- Subject: migration `agentcore-owner-wf-execute-grant-v1`, applied under owner
  authority and represented by two immutable Grant audit rows.
- Environment: current auth-service production audit database through role
  `auth_ro`, `transaction_read_only=on`, final action `ROLLBACK`.
- Observed at: `2026-08-29T12:17:29.913903Z`.
- Evidence artifact:
  `AUTH_SERVICE_PR36_HISTORICAL_OWNER_APPLY_AUTHORITY_GAP_V1@2026-08-29T12:17:29.913903Z#sha256:9f1f7e77e1666b23dd0cacdb3c9cdd42107f1f064f3944025771ef0e199e02c2`.
- Source coordinate:
  `mayf3/dsh-agent-core@b5ab589d0aeaa7a28e04bd4e665d27317db0b2d7`.
- Result: `OWNER_APPLY_ONLY`; governing Spec `NONE`; source commit content was
  unrelated to the Grant and was not authority; retroactive authorization `NO`.
- Basis: `OBS-DOWE-004`, `CLM-DOWE-004`, `EVD-DOWE-004`.

### STATE-DOWE-005 — Current re-evaluated authority base is exact

- Subject: `mayf3/auth-service` authority graph and governed paths at the
  current evaluated base.
- As-of commit:
  `github/main@7110463636693b3c2eced9d97ccb186adf46907d`.
- Environment: fresh dedicated PR #36 review-amendment worktree.
- Observed at: 2026-08-29 review-blocker amendment round.
- Result: two historical sync rounds are fully classified. Round 1 advanced
  `325e781982c01a09d438e9d65df8079396e1520e` to historical intermediate
  `b88512881135dd8a0d382e8ca76650059df33725` through Notification Ingress
  docs-only drift. Round 2 advanced that intermediate to current
  `7110463636693b3c2eced9d97ccb186adf46907d` through Notification Ingress
  Contract Bundle `1.4.0` implementation. Neither round changes the
  `svc-workflow` Audience/Scope vocabulary, this Child, Fleet V1, Forum
  Moderator, HR Dispatcher, Minimal Auth architecture, Grant schema/audit
  envelope, or either external authority pin.
- Basis: `OBS-DOWE-008`, `CLM-DOWE-001`, `EVD-DOWE-007`.

## 5. Observations

### OBS-DOWE-001 — Coordinate gate

- Subject: actual GitHub authority branch and task worktree.
- Method: `git fetch github`, exact `github/main` resolution, and worktree/branch
  uniqueness check.
- Result: actual main equals expected
  `325e781982c01a09d438e9d65df8079396e1520e`; therefore no post-expected-main
  drift review was required. A fresh worktree and fresh branch were created.
- Provenance: authoring command record.

### OBS-DOWE-002 — Owner-held full-state DB evidence artifact

- Subject: exact two Domain Owner rows plus the read-only fleet reconciliation
  coordinate.
- Environment: current auth-service production database; database role
  `auth_ro`; `transaction_read_only=on`; final action `ROLLBACK`.
- Observed at: `2026-08-29T08:26:20.706381Z`.
- Current normative evidence reference:
  `AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_OWNER_HELD_EVIDENCE_V1@2026-08-29T07:59:33.968375Z#sha256:e9a134bfcf0c9e2960eeb04769e491b9aef55273c2222bab1450677452cf28bd`.
- Historical alias: `OWNER_HELD_AUTH_DB_DOMAIN_OWNER_WF_EXECUTE_20260828` is
  retained only as non-normative provenance and MUST NOT be used as the current
  evidence binding.
- Method: exact-agent + deterministic Client external-ref lookup, safe leaf-field
  projection, active Principal/Client relationship join, duplicate/anomaly
  counts, and canonical digest calculation. The evidence query and this docs-only
  amendment performed no database or Grant mutation.
- Full-state artifact definition and result:

```text
OWNER_HELD_EVIDENCE_ARTIFACT_SHA256 = e9a134bfcf0c9e2960eeb04769e491b9aef55273c2222bab1450677452cf28bd
EVIDENCE_ARTIFACT_PREIMAGE_CLASS = FULL_STATE_PROJECTION
EVIDENCE_ARTIFACT_LENGTH_BYTES = 495
EVIDENCE_ARTIFACT_TRAILING_NEWLINE = NO
FULL_STATE_FIELDS = agent_id, client_active, client_external_ref, duplicate_count, principal_active, relationship_match, scopes, version
FULL_STATE_PROJECTION_CONTAINS_AUDIENCE = NO
FULL_STATE_DIGEST_IS_GRANT_SHAPE_DIGEST = NO
FLEET_COUNT = 86
TARGET_COUNT = 2
TARGET_ANOMALY_COUNT = 0
TARGET_DUPLICATE_COUNT = 0
OTHER_WORKFLOW_ROW_COUNT = 84
OTHER_84_ANOMALY_COUNT = 0
OTHER_84_DUPLICATE_COUNT = 0
PRINCIPAL_ACTIVE = CONFIRMED
CLIENT_ACTIVE = CONFIRMED
RELATIONSHIP_MATCH = CONFIRMED
DATABASE_WRITES = 0
GRANT_WRITES = 0
```

- Digest-role boundary: the `e9a134...28bd` value is the digest of the
  495-byte eight-field full-state artifact. It is not the five-field Grant-shape
  digest in `OBS-DOWE-005` and not the other-84 baseline digest in
  `OBS-DOWE-006`.
- Privacy/provenance: the complete query receipt, complete tool result, public
  Client IDs, full 86-Agent roster, database connection information, and any
  secret/token/password remain owner-held and MUST NOT appear in public GitHub
  content. The exact private locator is distributed only through the owner-held
  local evidence index, independent Reviewer's private task input, and final
  private audit worksheet. If repository governance requires public disclosure
  of that locator, the operation MUST stop with
  `SENSITIVE_OPERATIONAL_METADATA_DISCLOSURE = OWNER_DECISION_REQUIRED` rather
  than publishing a session UUID. Independent review MUST inspect that private
  locator and mechanically reproduce all three separately named digests.

### OBS-DOWE-003 — Canonical owner-held execute dependency/use evidence

- Subject: post-grant use plus current Domain Owner responsibility for both exact
  identities.
- Environment: current svc-workflow production database and audit records;
  `transaction_read_only=on`; final action `ROLLBACK`.
- Observed at: `2026-08-29T12:17:01.066779Z`.
- Public safe evidence reference:
  `AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_USE_EVIDENCE_V1@2026-08-29T12:17:01.066779Z#sha256:de3b707ce06f16be3be45bdb302218a3a92879cb175afec3cadc879139e7fff7`.
- Method: resolve each target Principal without publishing its UUID; select one
  completed Assistance resolve by `agt_hr-agent` and one completed instance
  cancel by `agt_build-in-public-agent`; join only safe Domain Owner enabled
  state, domain relationship state, result status, and pinned route/scope
  authority coordinates; serialize as sorted-key compact UTF-8 JSON with no
  trailing newline. The true artifact/query locators are bound only in the
  owner-held local evidence index and Reviewer private input.
- Result:

```text
USE_EVIDENCE_BINDING = PASS
USE_EVIDENCE_ARTIFACT_SHA256 = de3b707ce06f16be3be45bdb302218a3a92879cb175afec3cadc879139e7fff7
USE_EVIDENCE_ARTIFACT_PREIMAGE_CLASS = SAFE_TWO_EVENT_DOMAIN_OWNER_USE_PROJECTION
USE_EVIDENCE_ARTIFACT_LENGTH_BYTES = 1196
USE_EVIDENCE_ARTIFACT_TRAILING_NEWLINE = NO
USE_EVIDENCE_EVENT_COUNT = 2
USE_EVIDENCE_OPERATION_CLASSES = WORKFLOW_ASSISTANCE_RESOLVE + WORKFLOW_INSTANCE_CANCEL
USE_EVIDENCE_OBSERVED_AT = 2026-08-29T12:17:01.066779Z
CURRENT_DOMAIN_OWNER_ENABLED_COUNT = 2
CURRENT_DOMAIN_OWNER_RELATIONSHIP_MATCH_COUNT = 2
CURRENT_WORKFLOW_EXECUTE_DEPENDENCY = PRESENT
WORKFLOW_EXECUTE_USED_SINCE_GRANT = YES
DATABASE_WRITES = 0
GRANT_WRITES = 0
```

- Privacy/provenance: the public Spec excludes event/audit IDs, Domain refs,
  session UUIDs, tool sequence, complete local paths, payloads, public Client
  IDs, tokens, secrets, and connection data. The local canonical artifact
  contains only the permitted safe event fields; the owner-held index binds the
  real locator and read-only query digest for reproducible private review.

### OBS-DOWE-004 — Canonical historical owner-apply authority-gap evidence

- Subject: historical Grant migration, exact two immutable audit coordinates,
  source provenance, and authority chain.
- Environment: current auth-service production audit database through role
  `auth_ro`; `transaction_read_only=on`; final action `ROLLBACK`.
- Observed at: `2026-08-29T12:17:29.913903Z`.
- Public safe evidence reference:
  `AUTH_SERVICE_PR36_HISTORICAL_OWNER_APPLY_AUTHORITY_GAP_V1@2026-08-29T12:17:29.913903Z#sha256:9f1f7e77e1666b23dd0cacdb3c9cdd42107f1f064f3944025771ef0e199e02c2`.
- Method: select the two audit rows only by exact migration ID; join target
  `agent_id` without publishing Client ID; project only the permitted safe
  migration/version/scope/operator/approval/audit-coordinate/timestamp/source
  and authority-class fields; serialize as sorted-key compact UTF-8 JSON with no
  trailing newline. Independently query the exact GitHub source commit, which
  changes only `docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2.md`, a Feishu UX
  docs-only Spec unrelated to the Grant. True artifact/query locators remain in
  the owner-held local evidence index and Reviewer private input.
- Result:

```text
HISTORICAL_APPLY_EVIDENCE_BINDING = PASS
HISTORICAL_APPLY_EVIDENCE_ARTIFACT_SHA256 = 9f1f7e77e1666b23dd0cacdb3c9cdd42107f1f064f3944025771ef0e199e02c2
HISTORICAL_APPLY_EVIDENCE_PREIMAGE_CLASS = SAFE_TWO_AUDIT_AUTHORITY_GAP_PROJECTION
HISTORICAL_APPLY_EVIDENCE_ARTIFACT_LENGTH_BYTES = 1636
HISTORICAL_APPLY_EVIDENCE_ARTIFACT_TRAILING_NEWLINE = NO
HISTORICAL_APPLY_SAFE_AUDIT_COORDINATE_COUNT = 2
HISTORICAL_APPLY_OBSERVED_AT = 2026-08-29T12:17:29.913903Z
HISTORICAL_APPLY_ROW_1_APPLIED_AT = 2026-08-27T04:20:03.878000Z
HISTORICAL_APPLY_ROW_2_APPLIED_AT = 2026-08-27T04:20:04.050000Z
HISTORICAL_APPLY_MIGRATION_ID = agentcore-owner-wf-execute-grant-v1
HISTORICAL_APPLY_TARGET_ROW_COUNT = 2
HISTORICAL_APPLY_OPERATION = replace
HISTORICAL_APPLY_EXPECTED_VERSION = 1
HISTORICAL_APPLY_RESULTING_VERSION = 2
HISTORICAL_APPLY_BEFORE_SCOPES = [workflow.read]
HISTORICAL_APPLY_AFTER_SCOPES = [workflow.execute, workflow.read]
HISTORICAL_APPLY_OPERATOR_ID = mayf3
HISTORICAL_APPLY_AUTHORITY_CLASS = OWNER_APPLY_ONLY
HISTORICAL_GOVERNING_SPEC = NONE
SOURCE_GIT_COMMIT = b5ab589d0aeaa7a28e04bd4e665d27317db0b2d7
SOURCE_COMMIT_REPOSITORY = mayf3/dsh-agent-core
SOURCE_COMMIT_CONTENT_RELATED_TO_GRANT = NO
SOURCE_COMMIT_IS_AUTHORITY = NO
RETROACTIVE_AUTHORIZATION = NO
DATABASE_WRITES = 0
GRANT_WRITES = 0
```

- Privacy/provenance: the public Spec excludes audit row IDs, raw approval
  reference, Client IDs, complete local paths, tokens, secrets, credentials, and
  full database rows. Those reproducibility coordinates exist only in the
  canonical local artifact/index and independent Reviewer private input.

### OBS-DOWE-005 — Spec five-field Grant-shape digest

- Subject: the two exact current/required Workflow rows, projected only to the
  five-field Grant shape.
- Method: canonical UTF-8 JSON array ordered by `agent_id`, with object keys
  sorted, separators exactly `(',', ':')`, `ensure_ascii=false`; each object
  contains exactly `agent_id`, `client_external_ref`, `audience`, `scopes`, and
  `version`; scopes are unsigned-ASCII sorted.
- Field set: `agent_id`, `client_external_ref`, `audience`, `scopes`, `version`.
- Canonical document:

```json
[{"agent_id":"agt_build-in-public-agent","audience":"svc-workflow","client_external_ref":"agentcore:v1:client:agt_build-in-public-agent","scopes":["workflow.execute","workflow.read"],"version":2},{"agent_id":"agt_hr-agent","audience":"svc-workflow","client_external_ref":"agentcore:v1:client:agt_hr-agent","scopes":["workflow.execute","workflow.read"],"version":2}]
```

- Result:

```text
SPEC_TARGET_GRANT_SHAPE_SHA256 = 70e54c7b4af4f5c567853f96678910d84934efb901d409ae5ea65ac21cb6cdc5
OBSERVED_GRANT_SHAPE_TWO_ROW_SHA256 = 70e54c7b4af4f5c567853f96678910d84934efb901d409ae5ea65ac21cb6cdc5
OBSERVED_EQUALS_SPEC_TARGET = YES
```

The target digest is computed from the canonical document above. The observed
digest is independently reproduced by projecting the private DB evidence to
this exact five-field shape. It deliberately differs in preimage class and
field set from the full-state artifact digest in `OBS-DOWE-002`; equality MUST
be re-established during review and post-merge conformance rather than inferred
from this literal.

### OBS-DOWE-006 — Other-84 Fleet V1 Workflow baseline digest

- Subject: the other 84 exact Fleet V1 identities after subtracting the two
  `CTR-DOWE-001` identities from V1 Appendix A.
- Source revision: Fleet V1 blob
  `649a468f6145cce8653a6e473f07c9d28eca0360` at the evaluated base.
- Method: construct a canonical UTF-8 JSON array ordered by `agent_id`, with the
  same key/separator/encoding rules as `OBS-DOWE-005`; each object contains
  exactly `agent_id`, `client_external_ref`, `audience="svc-workflow"`,
  `scopes=["workflow.read"]`, and `version=1`.
- Result:

```text
OTHER_WORKFLOW_ROW_COUNT = 84
EXPECTED_OTHER_84_BASELINE_SHA256 = cdf8265689f139e07c5415fbd206cea5e548c3b086906fc6444f627ca17ac7cf
OBSERVED_OTHER_84_WORKFLOW_SHA256 = cdf8265689f139e07c5415fbd206cea5e548c3b086906fc6444f627ca17ac7cf
OTHER_84_EQUALS_BASELINE = YES
OTHER_84_ANOMALY_COUNT = 0
OTHER_84_DUPLICATE_COUNT = 0
```

The expected value is the Fleet V1 authority baseline digest. The observed value
is independently derived from the fresh read-only query bound in
`OBS-DOWE-002`. It is neither the two-row full-state artifact digest nor the
five-field two-row Grant-shape digest. Post-merge read-only conformance MUST
again derive the observed 84-row digest and require equality, active unique
Principal/Client bindings, anomaly count zero, and duplicate count zero.

### OBS-DOWE-007 — Forum sibling fact at reviewed base

- Subject: `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` at current evaluated
  base `7110463636693b3c2eced9d97ccb186adf46907d`.
- Method: inspect exact sibling blob/frontmatter/scope and compare this PR diff.
- Result: sibling status is accepted at the reviewed base; blob
  `7e661da3096043b16015473a9bc308121fc3ea72`; this PR changes neither the
  sibling file/authority relationship nor any Forum Grant; Forum target remains
  absent from this Child.
- Limitation: this is a reviewed-base non-interference fact only. Future Forum
  lifecycle and permission models are not governed here.
- Provenance: current-base blob plus PR base-to-head changed-file inventory.

### OBS-DOWE-008 — Complete two-round main-sync coordinate gate

- Subject: current evaluated repository coordinates plus both historical sync
  rounds from original authoring base to current main.
- Method: fresh `git fetch github`; exact `github/main` and PR #36 base/head
  resolution; commit/file inventories for both drift ranges; blob comparison of
  this Child's parent/sibling/dispatcher/architecture, Grant schema/audit
  authority, `svc-workflow` Audience/Scope vocabulary, and both fixed external
  authority pins.
- Result:

```text
CURRENT_EVALUATED_BASE = 7110463636693b3c2eced9d97ccb186adf46907d
PREVIOUS_EVALUATED_BASE = b88512881135dd8a0d382e8ca76650059df33725
ORIGINAL_AUTHORING_BASE = 325e781982c01a09d438e9d65df8079396e1520e
ROUND_1 = 325e781982c01a09d438e9d65df8079396e1520e -> b88512881135dd8a0d382e8ca76650059df33725
ROUND_1_CLASSIFICATION = UNRELATED_NOTIFICATION_INGRESS_DOCS_ONLY
ROUND_1_FILES = M AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1 + A AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2 + M docs/specs/README.md
ROUND_2 = b88512881135dd8a0d382e8ca76650059df33725 -> 7110463636693b3c2eced9d97ccb186adf46907d
ROUND_2_CLASSIFICATION = NOTIFICATION_INGRESS_CONTRACT_BUNDLE_1_4_0_IMPLEMENTATION
ROUND_2_CHANGED_FILE_COUNT = 15
ROUND_2_SVC_WORKFLOW_AUDIENCE_SCOPE_SEMANTIC_DELTA = NONE
ROUND_2_GRANT_SCHEMA_DELTA = NONE
ROUND_2_GRANT_AUDIT_ENVELOPE_DELTA = NONE
MAIN_DRIFT_AUTHORITY_OVERLAP = NONE
FLEET_V1_BLOB_ACROSS_BOTH_ROUNDS = 649a468f6145cce8653a6e473f07c9d28eca0360 unchanged
FORUM_MODERATOR_BLOB_ACROSS_BOTH_ROUNDS = 7e661da3096043b16015473a9bc308121fc3ea72 unchanged
HR_DISPATCHER_BLOB_ACROSS_BOTH_ROUNDS = fbf3a1283f04d8264d026ae96bc14c354562c611 unchanged
MINIMAL_AUTH_V2_BLOB_ROUND_2 = 576b7a75e4be278f20fee71ee4ba5e263bd958c7 unchanged
GRANTS_SCHEMA_BLOB_ROUND_2 = f60cd9faf18acfc643bf0330401e9af7364ce2d8 unchanged
EXTERNAL_AUTHORITY_PINS_CHANGED = NO
HISTORICAL_B885_REFERENCE_CLASSIFICATION = INTERMEDIATE_ONLY
```

- Observed at: 2026-08-29 review-blocker amendment round; a fresh fetch before
  commit and another immediately before push MUST re-confirm current main and
  remote PR head.
- Provenance: command record in the fresh dedicated PR #36 review-amendment
  worktree. The historical Round-1 sync record remains provenance only; this
  observation is the sole typed current-base projection.

### OBS-DOWE-009 — External authority exact-pin verification

- Subject: the two pinned `mayf3/svc-workflow` authorities.
- Method: in a current `mayf3/svc-workflow` clone after `git fetch github`,
  resolve each pinned revision's authority document blob with
  `git rev-parse <revision>:<path>`; read the V4 frontmatter and the Contract
  manifest at the pinned revisions; resolve the same paths at current
  `github/main` to prove pinned-blob non-drift.
- Result:

```text
PRODUCT_DIRECTION_BLOB_AT_f4bfbb7 = c688593ac8986686c48553fb292b468b3225f06b (match)
PRODUCT_DIRECTION_STATUS = accepted
PRODUCT_DIRECTION_AUTHORITY_KIND = product_direction
CONTRACT_BLOB_AT_68c78bb = 9d81acb167567d9309846da504af2a5b73b86390 (match)
MANIFEST_BLOB_AT_68c78bb = 067d09b326d8a09ac6c90d9d7b900b2278124bb8 (match)
MANIFEST_CONTRACT_ID = WORKFLOW_HTTP_CONTRACT_V1
MANIFEST_CONTRACT_VERSION = 1.5.0
MANIFEST_BUNDLE_DIGEST = f7ce39b6f053f8665139c4594c4d24322bfbafc35c0284bb18218a21ed834e89
MANIFEST_OWNER_HEAD_SHA = efcf0f515ec29600c459e660ce8aa84546c5aee3 (implementation snapshot; manifest self-declares NOT the Contract Bundle delivery commit)
CURRENT_SVC_WORKFLOW_MAIN = bf875c265843b3e07570a96b734051e9cfe27a43
CURRENT_MAIN_PRODUCT_DIRECTION_BLOB = c688593ac8986686c48553fb292b468b3225f06b (match)
CURRENT_MAIN_CONTRACT_BLOB = 9d81acb167567d9309846da504af2a5b73b86390 (match)
CURRENT_MAIN_MANIFEST_BLOB = 067d09b326d8a09ac6c90d9d7b900b2278124bb8 (match)
EXTERNAL_AUTHORITY_DRIFT = NO
```

- Observed at: 2026-08-29 authority-pin sync round; independent review and
  every later conformance round MUST re-execute this resolution at the exact
  pinned revisions and fail closed on any mismatch.
- Provenance: `git fetch github` plus `git rev-parse`/`git show` command
  record in the current `mayf3/svc-workflow` clone.

## 6. Claims and assumptions

### CLM-DOWE-001 — The requested NEW child is authority-compatible

- Support state: SUPPORTED.
- Supported by: `EVD-DOWE-001`, `EVD-DOWE-005`.
- Contradicted by: none known.
- Uncertainty: later main drift in Fleet/Workflow/Forum/Dispatcher/audit authority
  requires re-evaluation.

### CLM-DOWE-002 — Acceptance and merge require no data write

- Support state: SUPPORTED.
- Supported by: `EVD-DOWE-002`.
- Contradicted by: none known.
- Uncertainty: an independent read-only audit may reveal drift; drift fails closed
  and does not authorize repair under this Spec.

### CLM-DOWE-003 — Execute is currently necessary for the exact two Owners

- Support state: SUPPORTED.
- Supported by: `EVD-DOWE-003`.
- Contradicted by: HR dispatcher authority does not contradict this claim because
  it is a separate read+wake identity.
- Uncertainty: future responsibility changes require new authority.

### CLM-DOWE-004 — Prospective authority does not rewrite history

- Support state: SUPPORTED.
- Supported by: `EVD-DOWE-004`.
- Contradicted by: none known.
- Uncertainty: none that changes the normative classification.

### CLM-DOWE-005 — Fleet V1 defines an exact other-84 Workflow baseline

- Support state: SUPPORTED.
- Supported by: `EVD-DOWE-002`, `EVD-DOWE-006`.
- Contradicted by: none known.
- Uncertainty: fresh read-only observed equality is established as of
  `2026-08-29T08:26:20.706381Z`; independent review and later conformance must
  reproduce it at their own exact coordinates.

### CLM-DOWE-006 — The external authority chain is exactly pinned and undrifted

- Support state: SUPPORTED.
- Supported by: `EVD-DOWE-008`.
- Contradicted by: none known.
- Uncertainty: upstream `mayf3/svc-workflow` may advance; that never moves
  these pins, and drift of the pinned blobs themselves fails closed under
  `CTR-DOWE-021`.

## 7. Evidence relations

### EVD-DOWE-001 — Git coordinates support authority compatibility

- Source observations: `OBS-DOWE-001`.
- Target: `STATE-DOWE-001`, `CLM-DOWE-001`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/auth-service@325e781982c01a09d438e9d65df8079396e1520e`, fresh task worktree, observed 2026-08-28.
- Strength/sufficiency: exact for the evaluated base.
- Limitations: later main commits are not covered.
- Provenance: authoring `git fetch`, `git rev-parse github/main`, and worktree command record.

### EVD-DOWE-002 — Current state supports zero-write acceptance

- Source observations: `OBS-DOWE-002`, `OBS-DOWE-005`, `OBS-DOWE-006`.
- Target: `STATE-DOWE-002`, `CLM-DOWE-002`.
- Relation: SUPPORTS.
- Bound coordinates: current auth-service production database; database role
  `auth_ro`; `transaction_read_only=on`; final action `ROLLBACK`; observed at
  `2026-08-29T08:26:20.706381Z`; normative evidence reference
  `AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_OWNER_HELD_EVIDENCE_V1@2026-08-29T07:59:33.968375Z#sha256:e9a134bfcf0c9e2960eeb04769e491b9aef55273c2222bab1450677452cf28bd`.
- Strength/sufficiency: exact 495-byte eight-field full-state artifact, exact
  independently reproduced five-field two-row Grant-shape equality, and exact
  observed/expected other-84 baseline equality; target and other-84 anomaly and
  duplicate counts are zero; sufficient for authoring.
- Limitations: the exact private locator remains outside public GitHub content;
  independent review must receive it through private task input, inspect the
  artifact, and mechanically reproduce all three role-separated digests.
- Provenance: owner-held read-only query receipt plus the full-state,
  `OBS-DOWE-005`, and `OBS-DOWE-006` canonicalization procedures.

### EVD-DOWE-003 — Canonical operational evidence supports dependency/use

- Source observations: `OBS-DOWE-003`.
- Target: `STATE-DOWE-003`, `CLM-DOWE-003`.
- Relation: SUPPORTS.
- Bound coordinates: current svc-workflow production database/audit records;
  `transaction_read_only=on`; final action `ROLLBACK`; observed
  `2026-08-29T12:17:01.066779Z`; public safe reference
  `AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_USE_EVIDENCE_V1@2026-08-29T12:17:01.066779Z#sha256:de3b707ce06f16be3be45bdb302218a3a92879cb175afec3cadc879139e7fff7`.
- Strength/sufficiency: a reproducible 1196-byte, two-event safe projection
  proves one completed Assistance resolve, one completed instance cancel, both
  exact Agent IDs, both current enabled Domain Owner relationships, HTTP 200 /
  completed results, and exact pinned route/scope coordinates.
- Limitations: event/audit IDs, Domain refs, true local locator, and query locator
  remain owner-held; independent review receives them privately and MUST
  reproduce the artifact hash without exposing payload or session data.
- Provenance: local-only canonical artifact and owner-held evidence index binding
  the real locator plus read-only query digest.

### EVD-DOWE-004 — Canonical audit evidence supports historical-gap classification

- Source observations: `OBS-DOWE-004`.
- Target: `STATE-DOWE-004`, `CLM-DOWE-004`.
- Relation: SUPPORTS.
- Bound coordinates: auth-service production audit database through `auth_ro`;
  `transaction_read_only=on`; final action `ROLLBACK`; observed
  `2026-08-29T12:17:29.913903Z`; exact migration
  `agentcore-owner-wf-execute-grant-v1`; public safe reference
  `AUTH_SERVICE_PR36_HISTORICAL_OWNER_APPLY_AUTHORITY_GAP_V1@2026-08-29T12:17:29.913903Z#sha256:9f1f7e77e1666b23dd0cacdb3c9cdd42107f1f064f3944025771ef0e199e02c2`;
  `mayf3/dsh-agent-core@b5ab589d0aeaa7a28e04bd4e665d27317db0b2d7`.
- Strength/sufficiency: a reproducible 1636-byte two-audit projection binds
  exact replace/version/scope/operator/timestamps/source fields and the honest
  `OWNER_APPLY_ONLY` / governing Spec `NONE` / no-retroactive-authorization
  classification; GitHub proves the source commit is content-unrelated.
- Limitations: audit row IDs, raw approval coordinate, true local locator, and
  query locator remain owner-held; source code is provenance, not authority.
- Provenance: local-only canonical artifact/evidence index, immutable Grant audit
  query receipt, and GitHub commit API changed-file result.

### EVD-DOWE-005 — Forum sibling supports reviewed-base non-interference

- Source observations: `OBS-DOWE-007`.
- Target: `CLM-DOWE-001`.
- Relation: SUPPORTS.
- Bound coordinates:
  `mayf3/auth-service@7110463636693b3c2eced9d97ccb186adf46907d`,
  accepted `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` blob
  `7e661da3096043b16015473a9bc308121fc3ea72`, inspected 2026-08-29.
- Strength/sufficiency: exact current fact plus base-to-head proof that this PR
  changes no sibling authority/file and performs zero Forum Grant write.
- Limitations: Forum behavior and every future Forum lifecycle transition remain
  outside this Child's authority.
- Provenance: reviewed-base sibling blob/frontmatter and PR changed-file record.

### EVD-DOWE-006 — Fleet V1 projection supports the other-84 baseline

- Source observations: `OBS-DOWE-006`.
- Target: `CLM-DOWE-005`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/auth-service@325e781982c01a09d438e9d65df8079396e1520e`, Fleet V1 blob `649a468f6145cce8653a6e473f07c9d28eca0360`, canonical projection derived 2026-08-28.
- Strength/sufficiency: exact V1 Appendix A subtraction and canonical 84-row expected digest at the evaluated source blob; the fresh read-only evidence bound by `EVD-DOWE-002` independently produces the same observed digest.
- Limitations: independent review and future conformance must re-establish current equality at their own exact UTC query coordinates.
- Provenance: Fleet V1 Appendix A, owner-held read-only query receipt, and the `OBS-DOWE-006` canonicalization procedure.

### EVD-DOWE-007 — Two-round main-sync evidence supports current base

- Source observations: `OBS-DOWE-008`.
- Target: `STATE-DOWE-005`, `CLM-DOWE-001`.
- Relation: SUPPORTS.
- Bound coordinates: current evaluated base
  `mayf3/auth-service@7110463636693b3c2eced9d97ccb186adf46907d`;
  historical intermediate
  `b88512881135dd8a0d382e8ca76650059df33725`; original authoring base
  `325e781982c01a09d438e9d65df8079396e1520e`; observed 2026-08-29.
- Strength/sufficiency: exact commit/file inventories for both sync rounds,
  unchanged dependent-authority and Grant-schema blobs, zero `svc-workflow`
  vocabulary delta, and unchanged fixed external pins.
- Limitations: main commits after
  `7110463636693b3c2eced9d97ccb186adf46907d` are not covered and require the
  overlap-sensitive gate in this Spec.
- Provenance: fresh review-amendment `git fetch` / `git rev-parse` /
  `git diff --name-status` / protected-blob comparison command record.

### EVD-DOWE-008 — Pinned external authorities support the authority chain

- Source observations: `OBS-DOWE-009`.
- Target: `STATE-DOWE-005`, `CLM-DOWE-006`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/svc-workflow` pinned revisions `f4bfbb7cbc1dbcdb29c1caa472408adc41378fbf` and `68c78bb01bd088883048edb481df02214e596be7`; current upstream main `bf875c265843b3e07570a96b734051e9cfe27a43`; observed 2026-08-29.
- Strength/sufficiency: exact blob identities at both pinned revisions plus current-main equality for all three pinned blobs.
- Limitations: current-main equality proves non-drift only as of this round; later upstream movement is governed by `CTR-DOWE-021` / `CTR-DOWE-022`.
- Provenance: `git rev-parse` / `git show` command record in the current `mayf3/svc-workflow` clone.

## 8. Decisions

### DEC-DOWE-001 — Govern a bounded later delta without supersession

- Decision owner: `mayf3`.
- Decision: add a NEW invariant Child for exactly two Workflow rows; preserve
  Fleet V1 as completed one-time baseline authority.
- Rejected alternative: whole-authority successor or partial rewrite of Fleet V1.
- Reason: the historical baseline operation remains valid and complete; the
  authority gap concerns only a later exact two-row state.

### DEC-DOWE-002 — Isolate Forum authority completely

- Decision owner: `mayf3`.
- Decision: Forum authority is out of scope; this PR/acceptance transaction makes
  zero change to the Forum Moderator sibling or Forum Grants. The sibling's
  accepted status is recorded only as a reviewed-base fact; its future lifecycle
  is not governed here.
- Rejected alternative: freeze 86/86 Forum rows or the sibling's future status as
  a permanent invariant here.
- Reason: either would exceed this Workflow-only authority repair.

### DEC-DOWE-003 — Accept current necessary state prospectively

- Decision owner: `mayf3`.
- Decision: acceptance means forward governance of an already conformant state,
  with database/Grant/audit writes zero.
- Rejected alternative: rerun Fleet V1 or append a compensating audit.
- Reason: rerun would not repair historical authority and could corrupt evidence.

### DEC-DOWE-004 — Preserve the historical gap

- Decision owner: `mayf3`.
- Decision: record `OWNER_APPLY_ONLY`, governing Spec `NONE`, and no retroactive
  authorization.
- Rejected alternative: treat necessity, source commit, or later acceptance as
  authority that existed at apply time.
- Reason: provenance and governing authority are distinct.

### DEC-DOWE-005 — Future narrowing and expansion require new authority

- Decision owner: `mayf3`.
- Decision: removing `workflow.execute` requires a new narrowing authority;
  adding identities/Audiences/Scopes or otherwise expanding requires a new
  authority. This Spec authorizes neither implementation nor mutation.
- Rejected alternative: silently reinterpret the current invariant.
- Reason: authorization changes are non-mechanical and independently reviewable.

### DEC-DOWE-006 — Retire blocked narrowing PR #33 without reuse

- Decision owner: `mayf3`.
- Decision: `mayf3/auth-service#33` at exact head
  `2df29a7f5e2a6774600eef67f3c369f6b887c6ad` remains hold-only while this Child
  is pre-merge. After this Child is accepted and merged, close PR #33 unmerged
  while preserving its remote branch/history. It may never be reopened or
  reused as a future authority vehicle.
- Rejected alternative: rebase, amend, review, accept, merge, implement, revive,
  or reuse PR #33's exact head.
- Reason: its narrowing direction (`execute+read` → `read`) contradicts the
  current dependency/use evidence. Any later narrowing requires fresh evidence,
  Owner decision, new governing Spec, and new PR.

## 9. Contracts

### CTR-DOWE-001 — Exact two Domain Owner identities

The only governed identities MUST be `agt_hr-agent` and
`agt_build-in-public-agent`, resolved respectively through deterministic Client
external refs `agentcore:v1:client:agt_hr-agent` and
`agentcore:v1:client:agt_build-in-public-agent`. Each MUST have exactly one
active matching Principal and one active Client relationship; duplicate count
MUST be zero. No public Client ID is required in PR prose.

### CTR-DOWE-002 — Exact Workflow end state

Each exact identity in `CTR-DOWE-001` MUST have one `svc-workflow` row with
scopes exactly `[workflow.execute, workflow.read]` in unsigned-ASCII order and
version exactly `2`. Independently derived observed and target canonical
projections MUST both equal the separately named
`OBSERVED_GRANT_SHAPE_TWO_ROW_SHA256` and `SPEC_TARGET_GRANT_SHAPE_SHA256` from
`OBS-DOWE-005`; equality MUST NOT be inferred from the target literal or from
`OWNER_HELD_EVIDENCE_ARTIFACT_SHA256`.

### CTR-DOWE-003 — Execute dependency and real use

The authority record MUST bind
`CURRENT_WORKFLOW_EXECUTE_DEPENDENCY = PRESENT` and
`WORKFLOW_EXECUTE_USED_SINCE_GRANT = YES`, with evidence covering Workflow
Assistance resolve, Workflow instance cancel, and Domain Owner handling of
in-domain assistance cases.

### CTR-DOWE-004 — Other 84 Workflow rows are unchanged

For the other 84 Fleet V1 identities, this Child's authority delta MUST be zero.
The exact set is V1 Appendix A minus the two `CTR-DOWE-001` identities. Each
MUST retain one active unique Principal/Client binding and exactly one
`svc-workflow[workflow.read]@v1` row, duplicate count zero. The canonical
84-row projection MUST make `OBSERVED_OTHER_84_WORKFLOW_SHA256` equal
`EXPECTED_OTHER_84_BASELINE_SHA256` from `OBS-DOWE-006`. This Child MUST NOT
add, remove, rewrite, re-version, audit, or
otherwise mutate any of those rows.

### CTR-DOWE-005 — Forum authority is completely out of scope

This Child MUST neither establish a permanent 86/86 Forum invariant nor govern
any Forum row, Audience, Scope, version, audit, implementation, or apply.
`FORUM_GRANT_WRITES = 0`. Forum state MUST NOT be included in this Child's
conformance result except to prove that this Child performed no Forum write.

### CTR-DOWE-006 — Exact reviewed-base Forum non-interference

At reviewed base `7110463636693b3c2eced9d97ccb186adf46907d`, the accepted
sibling fact is `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` at blob
`7e661da3096043b16015473a9bc308121fc3ea72`. This PR and its acceptance
transaction MUST modify neither that sibling file nor its parentage, MUST NOT
supersede/reparent it, MUST write zero Forum Grant rows, and MUST exclude Forum
state from this Child's target. This Contract does not constrain the sibling's
future status, supersession, lifecycle, apply outcome, or any future Forum
permission model: `FUTURE_FORUM_AUTHORITY_LIFECYCLE = NOT_GOVERNED_BY_THIS_SPEC`.

### CTR-DOWE-007 — Historical authority gap remains honest

The historical migration MUST remain identified as
`agentcore-owner-wf-execute-grant-v1`, authority class `OWNER_APPLY_ONLY`, with
`HISTORICAL_GOVERNING_SPEC = NONE`. The dsh-agent-core source commit is
content-unrelated provenance, not authority. V1 baseline and this later Child
MUST NOT be represented as governing the 2026-08-26 apply.

### CTR-DOWE-008 — No retroactive authorization or history rewrite

Acceptance MUST mean only forward governance of the current necessary state.
It MUST NOT retroactively authorize, normalize, backdate, delete, replace, or
reinterpret any historical apply/audit fact and MUST NOT append an “authority
repair” audit row.

### CTR-DOWE-009 — Current conformance requires zero writes

Because current DB state already equals `CTR-DOWE-001/002`, proposed review,
acceptance, merge, and post-merge conformance MUST require database writes `0`,
Grant writes `0`, and audit writes `0`. `OLD_FLEET_SUPPLY_RERUN = FORBIDDEN`.
Any mismatch fails closed and requires a new authority decision before repair.

### CTR-DOWE-010 — Identity, credential, legacy, and audit zero mutation

No Principal, Client, credential, secret, deterministic external ref,
relationship, status, `allowedResources`, `allowedScopes`, human/delegation,
OpenClaw, or immutable audit value may change under this Child. No secret may
be read, reproduced, logged, or published.

### CTR-DOWE-011 — No other authorization surface

No third Client/Principal/Agent, other Audience, other Scope,
`workflow.admin`, wildcard, blanket Grant, role/display-name target, or generic
administration path is authorized. Any such state is outside authority and makes
conformance fail closed without mutation.

### CTR-DOWE-012 — HR dispatcher does not replace Domain Owner execute

The dispatcher remains a separate non-fleet identity with only
`svc-workflow[workflow.read] + agent-wake[agent.wake]`; it MUST NOT receive
`workflow.execute` or be interpreted as replacing Domain Owner responsibility.
`agt_hr-agent` identity, Client, credential, and relationship remain untouched;
this Child governs only its already-existing Workflow Grant state.

### CTR-DOWE-013 — Future removal requires narrowing authority

Any removal of `workflow.execute`, reduction of the exact two identities, or
change from the frozen current/required state MUST use a new independently
reviewed and accepted narrowing authority. Operational inactivity alone MUST NOT
silently narrow this invariant.

### CTR-DOWE-014 — Future expansion requires new authority

Any additional identity, Audience, Scope, Grant mutation, version transition,
implementation, verifier/rerun tool, or changed Domain Owner model MUST use a
new independently reviewed and accepted authority with an exact boundary. This
Spec's `implementation_authority` remains `none` after acceptance.

### CTR-DOWE-015 — Post-merge conformance is independent and read-only

After acceptance and merge, an independent actor MUST perform a read-only audit
binding the exact accepted Spec head, full-state artifact digest and field set,
two agent IDs/external refs, five-field two-row Grant-shape observed/target
digests, active relationship, duplicate count, dependency/use evidence,
other-84 observed/expected digests and zero delta, Forum isolation,
reviewed-base sibling non-interference, and zero unauthorized surface. The audit MUST write zero rows and
MUST fail closed on drift. The three digest roles MUST remain separately named.

### CTR-DOWE-016 — Phase-scoped file and lifecycle boundary

The PR base-to-head diff MUST contain only this Spec and `docs/specs/README.md`;
this review-blocker amendment relative to previous head
`7ae1d771bf1ecb3ed7b183c0279eeb85c617600a` MUST change only this Spec. Fleet
V1, Forum Moderator, HR Dispatcher, every other accepted authority, `.agents/**`,
Prisma, scripts, tests, and source MUST remain byte-identical.

Lifecycle is phase-scoped, never contradictory:

```text
AUTHORING_AND_SEMANTIC_REVIEW_PHASE = OPEN / DRAFT / UNMERGED
OWNER_ACCEPTANCE_FINALIZE_PHASE = OPEN / DRAFT / UNMERGED
FINAL_ACCEPTED_HEAD_RECHECK_REQUIRED = YES
MERGE_EXECUTION_ALLOWED_ONLY_AFTER = accepted lifecycle transition + final accepted-head recheck PASS + blockers 0
MERGE_PHASE = PR may transition Ready and merge
POST_MERGE_PHASE = independent read-only conformance audit required
DRAFT_OPEN_UNMERGED_IS_PERPETUAL_INVARIANT = NO
```

Review and owner acceptance finalize MUST occur before merge. The future merge
phase may begin only after all three merge prerequisites pass. Only after the PR
is merged may `CTR-DOWE-015` post-merge conformance run. No Acceptance item may
simultaneously require the PR to be both unmerged and merged.

### CTR-DOWE-017 — Exact Product Direction authority pin

The upstream product-direction authority for this Child is exactly
`SVC_WORKFLOW_PRODUCT_BOUNDARY_V4` in repository `mayf3/svc-workflow`, pinned
at revision `f4bfbb7cbc1dbcdb29c1caa472408adc41378fbf` (the V4 merge commit),
authority document `docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V4.md`, blob
`c688593ac8986686c48553fb292b468b3225f06b`, with authority frontmatter
`status: accepted` and `authority_kind: product_direction`. The Spec
frontmatter `external_authorities` MUST carry exactly this pin with relation
`constrained_by`.

### CTR-DOWE-018 — Exact Runtime Contract authority pin

The upstream runtime-contract authority for this Child is exactly
`WORKFLOW_HTTP_CONTRACT_V1` in repository `mayf3/svc-workflow`, pinned at the
Contract Bundle delivery revision
`68c78bb01bd088883048edb481df02214e596be7`, with
`contracts/workflow-http/v1/contract.md` blob
`9d81acb167567d9309846da504af2a5b73b86390`,
`contracts/workflow-http/v1/manifest.json` blob
`067d09b326d8a09ac6c90d9d7b900b2278124bb8`, `contract_version` exactly
`1.5.0`, and `bundle_digest` exactly
`f7ce39b6f053f8665139c4594c4d24322bfbafc35c0284bb18218a21ed834e89`. The Spec
frontmatter `external_authorities` MUST carry exactly this pin with relation
`constrained_by`.

### CTR-DOWE-019 — External ownership boundary is exact

`SVC_WORKFLOW_PRODUCT_BOUNDARY_V4` owns the Domain and Domain Owner product
responsibility and authorization boundary. `WORKFLOW_HTTP_CONTRACT_V1` owns
the exact Assistance routes and the `workflow.read` / `workflow.execute`
wire-level scope requirement. This Child owns only the Grant end state of the
two exact Clients (`CTR-DOWE-001`/`CTR-DOWE-002`). Runtime logs, database
usage records, and Grant audit rows support current-state claims
(`SUPPORT_CURRENT_STATE_CLAIMS = YES`) but MUST NOT be treated as creating or
modifying `svc-workflow` product authority
(`CREATE_SVC_WORKFLOW_PRODUCT_AUTHORITY = NO`). This Child MUST NOT author,
edit, or reclassify any authority document in `mayf3/svc-workflow`.

### CTR-DOWE-020 — Domain Owner Assistance responsibility matches the pinned Contract

Under the pinned `WORKFLOW_HTTP_CONTRACT_V1`, the Domain Owner is the actor
responsible for Assistance resolve and escalate; the Assistance write routes
(`POST /internal/v1/workflow-instances/{workflowInstanceId}/assistance-cases`,
`POST /internal/v1/assistance-cases/{assistanceCaseId}/escalate-to-human`,
`POST /internal/v1/assistance-cases/{assistanceCaseId}/resolve`) require
`workflow.execute`, and the Assistance read routes
(`GET /internal/v1/assistance-cases/owner-inbox`,
`GET /internal/v1/assistance-cases/human-required`,
`GET /internal/v1/assistance-cases/requested-by-me`,
`GET /internal/v1/assistance-cases/{assistanceCaseId}`) require
`workflow.read`. The exact two-row end state of `CTR-DOWE-002` MUST remain
consistent with exactly these wire-level scope requirements; neither more
(`workflow.admin`, wildcard) nor less (read-only) is authorized for the two
Domain Owners.

### CTR-DOWE-021 — Pinned-blob drift fails closed

Review and conformance MUST re-resolve every pinned revision and blob
identifier in `mayf3/svc-workflow`, and may additionally resolve the current
upstream main only to prove the pinned blobs have not drifted. Any authority
ID, revision, blob, status, authority kind, contract version, or bundle digest
mismatch MUST FAIL closed. A failure MUST NOT be repaired by silently
re-pinning, advancing the pin to the moved upstream main, or absorbing the
change into this Child; repair requires a new independently reviewed docs-only
authority amendment.

### CTR-DOWE-022 — Future external authority change is never silently absorbed

A future `SVC_WORKFLOW_PRODUCT_BOUNDARY` successor, a new
`WORKFLOW_HTTP_CONTRACT` version or delivery revision, or any other upstream
`mayf3/svc-workflow` change MUST NOT alter this Child's pinned authority chain
implicitly. Advancing a pin requires a new docs-only amendment that records
the old and new coordinates, the drift classification, and the reason, and
that receives independent review. The external authority revision MUST NOT be
advanced to `CURRENT_SVC_WORKFLOW_MAIN`
(`bf875c265843b3e07570a96b734051e9cfe27a43`) merely because upstream main
moved, and `OWNER_IMPLEMENTATION_SNAPSHOT`
(`efcf0f515ec29600c459e660ce8aa84546c5aee3`) MUST NOT be reclassified as the
Contract authority revision.

### CTR-DOWE-023 — Blocked narrowing PR #33 has one-way close-only disposition

The following disposition is mandatory and executable:

```text
BLOCKED_NARROWING_PR = mayf3/auth-service#33
BLOCKED_NARROWING_HEAD = 2df29a7f5e2a6774600eef67f3c369f6b887c6ad
PROPOSAL_DIRECTION = [workflow.execute, workflow.read] -> [workflow.read]
REJECTION_REASON = CURRENT_WORKFLOW_EXECUTE_DEPENDENCY_PRESENT + WORKFLOW_EXECUTE_USED_SINCE_GRANT
PRE_CHILD_MERGE_ACTION = HOLD_ONLY
FORBIDDEN_PRE_CHILD_ACTIONS = rebase + amend + review + accept + merge + implement
CLOSE_TRIGGER = this bounded Child accepted and merged into main
CLOSE_METHOD = CLOSE_UNMERGED + preserve remote branch/history
PR33_REOPEN_ALLOWED = NO
FUTURE_NARROWING_REQUIRES = fresh dependency-absent evidence + fresh use review + Owner decision + new governing Spec + new PR
PR33_EXACT_HEAD_REUSE_AS_FUTURE_AUTHORITY_VEHICLE = FORBIDDEN
```

Before the close trigger, PR #33 MUST remain exactly Open/Draft/Unmerged at its
frozen head and receive no action beyond hold. After the trigger, an authorized
actor MUST close it unmerged and preserve its remote branch/history. It MUST NOT
be reopened, rebased, amended, reviewed, accepted, merged, implemented, revived,
or reused. Closure is a repository-governance action, not a Grant/database write
and not authority for any product mutation.

## 10. Acceptance

Every Acceptance result MUST bind the exact evaluated base, exact Spec head,
reviewer, timestamp, and persistent review/evidence reference. Owner-held DB and
use evidence may remain private but MUST be independently inspectable.

### ACC-DOWE-001 — Exact two Domain Owner identities
- Contracts: `CTR-DOWE-001`, `CTR-DOWE-002`.
- Method: read-only exact external-ref join, full-state artifact verification, and independent five-field Grant-shape canonical digest comparison.
- Environment: current auth-service production DB through an independently controlled read-only seam.
- Required evidence: exact accepted Spec head; private DB receipt and exact UTC query timestamp; normative `EVIDENCE_REF`; 495-byte/no-trailing-newline eight-field full-state artifact and SHA-256; independently derived five-field observed and Spec-target Grant-shape projections; Principal/Client relationship and anomaly/duplicate results; database role, read-only transaction state, final rollback, and zero-write receipt.
- Expected result: full-state artifact SHA-256 `e9a134bf...52cf28bd`; exactly two active matching rows, version 2, execute+read, anomalies 0, duplicates 0; observed and Spec-target five-field Grant-shape SHA-256 both `70e54c7b...6cdc5`; digest-role collision count 0.
- Failure condition: any identity, relationship, count, field-set, preimage-class, version, scope, digest-role, digest, read-only, rollback, or zero-write mismatch.

### ACC-DOWE-002 — Current execute dependency
- Contracts: `CTR-DOWE-003`.
- Method: reproduce the canonical owner-held use artifact from the privately supplied read-only query/locator, verify its digest, and evaluate current Domain Owner enabled/relationship fields against pinned product/runtime authority.
- Environment: current svc-workflow production database/audit records; transaction read-only; final rollback.
- Required evidence: exact Spec head; public safe ref `AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_USE_EVIDENCE_V1@2026-08-29T12:17:01.066779Z#sha256:de3b707ce06f16be3be45bdb302218a3a92879cb175afec3cadc879139e7fff7`; 1196-byte/no-newline canonical artifact; private true locator/query digest; exact query and event timestamps; two enabled Principals/Domains/DOMAIN_OWNER relationships; zero-write receipt.
- Expected result: artifact hash/length/preimage class match; current owner/relationship counts are 2/2; `CURRENT_WORKFLOW_EXECUTE_DEPENDENCY = PRESENT`.
- Failure condition: unresolved locator, digest/preimage/timestamp mismatch, disabled/missing relationship, stale evidence, write, or responsibility inconsistency.

### ACC-DOWE-003 — Real use evidence
- Contracts: `CTR-DOWE-003`.
- Method: privately inspect and independently reproduce both safe event projections without reading/publishing payload bodies.
- Environment: owner-held post-grant svc-workflow Assistance/event/receipt records through a read-only transaction ending in rollback.
- Required evidence: exact Spec head; same public safe evidence ref/digest; private event/audit coordinates; exactly one completed `WORKFLOW_ASSISTANCE_RESOLVE` for `agt_hr-agent` and one completed `WORKFLOW_INSTANCE_CANCEL` for `agt_build-in-public-agent`; HTTP 200/completed status; pinned route/scope coordinates; exact timestamps; zero-write receipt.
- Expected result: `USE_EVIDENCE_EVENT_COUNT = 2`, both operation classes match, and `WORKFLOW_EXECUTE_USED_SINCE_GRANT = YES`.
- Failure condition: unresolved binding, digest mismatch, payload/secret exposure, no post-grant use, wrong actor/route/scope/result, or either operation class unsupported.

### ACC-DOWE-004 — Other 84 Workflow rows unchanged
- Contracts: `CTR-DOWE-004`.
- Method: subtract the two targets from exact Fleet V1 Appendix A, perform a read-only active Principal/Client/Workflow join, check uniqueness/anomalies/duplicates, and independently derive the canonical observed 84-row digest.
- Environment: Fleet V1 blob at evaluated base plus current auth-service production DB read-only seam.
- Required evidence: exact Fleet V1 blob; subtraction output; safe 84-row projection; separately named expected-baseline and observed digest calculations; active-binding, anomaly-count, and duplicate-count receipt; zero-write receipt.
- Expected result: 84/84 exact identities remain `svc-workflow[workflow.read]@v1`, active matching bindings, anomalies 0, duplicates 0; `OBSERVED_OTHER_84_WORKFLOW_SHA256` and `EXPECTED_OTHER_84_BASELINE_SHA256` both equal `cdf82656...ca17ac7cf`; writes 0.
- Failure condition: identity/count/binding/version/scope/digest-role/digest mismatch, anomaly, duplicate, or Child-attributable mutation.

### ACC-DOWE-005 — Forum authority completely out of scope
- Contracts: `CTR-DOWE-005`.
- Method: semantic boundary review and changed-row/file audit.
- Environment: exact proposed Spec/PR head and current auth-service DB write/audit records.
- Required evidence: exact Spec/PR diff; Forum-reference classification; database and Grant write-count receipt showing Forum writes 0.
- Expected result: no permanent Forum invariant and Forum writes 0.
- Failure condition: Forum target/conformance freeze or any Forum mutation.

### ACC-DOWE-006 — Reviewed-base Forum non-interference
- Contracts: `CTR-DOWE-006`.
- Method: compare the current-base sibling blob/frontmatter with this PR and its future acceptance-only diff; inspect Forum Grant write counts.
- Environment: evaluated base `7110463636693b3c2eced9d97ccb186adf46907d`, exact reviewed Spec/PR head, and this PR/acceptance transaction only.
- Required evidence: reviewed-base sibling status/blob; base-to-head and acceptance diffs; authority graph proving no this-PR supersede/reparent; Forum Grant/audit write counts 0; scope-target inventory excluding Forum.
- Expected result: `THIS_PR_CHANGE_TO_FORUM_SIBLING = NONE`, `THIS_PR_CHANGE_TO_FORUM_GRANTS = NONE`, `FORUM_AUTHORITY = OUT_OF_SCOPE`; no finding about future Forum lifecycle is required or permitted.
- Failure condition: this PR/acceptance changes the sibling/parentage, writes Forum state, adds Forum to target, or asserts a permanent future sibling status.

### ACC-DOWE-007 — Historical authority gap
- Contracts: `CTR-DOWE-007`.
- Method: reproduce the canonical two-audit artifact from the private read-only locator/query and independently verify exact source-commit changed-file scope and historical authority inventory.
- Environment: auth-service production audit DB via `auth_ro`/read-only/rollback plus GitHub `mayf3/dsh-agent-core` exact source object.
- Required evidence: exact Spec head; public safe ref `AUTH_SERVICE_PR36_HISTORICAL_OWNER_APPLY_AUTHORITY_GAP_V1@2026-08-29T12:17:29.913903Z#sha256:9f1f7e77e1666b23dd0cacdb3c9cdd42107f1f064f3944025771ef0e199e02c2`; 1636-byte/no-newline safe artifact; private true locator/query digest; two safe audit coordinates; exact applied/query timestamps; replace 1→2 and scope snapshots; operator/approval coordinate; source API result; zero-write receipt.
- Expected result: evidence binding/hash/preimage/count/timestamps match; `OWNER_APPLY_ONLY`; governing Spec `NONE`; source commit content-unrelated and non-authoritative.
- Failure condition: unresolved locator, digest/preimage/count/timestamp/source mismatch, invented historical authority, secret/full-row exposure, write, or omitted gap.

### ACC-DOWE-008 — No retroactive authorization
- Contracts: `CTR-DOWE-008`.
- Method: contradiction search over exact Spec/PR body, canonical historical artifact, authority timeline, immutable audit rows, and future acceptance record.
- Environment: exact reviewed Spec/PR head and the privately reproduced historical evidence from `ACC-DOWE-007`.
- Required evidence: public safe evidence ref/digest; reviewer authority timeline; immutable audit-coordinate comparison; no compensating audit row; contradiction-search output.
- Expected result: `RETROACTIVE_AUTHORIZATION = NO`; prospective governance only; historical audit facts unchanged.
- Failure condition: backdated authority, compensating audit, history rewrite, or current acceptance represented as 2026-08-26 authority.

### ACC-DOWE-009 — Current DB already conforms
- Contracts: `CTR-DOWE-001`, `CTR-DOWE-002`, `CTR-DOWE-009`.
- Method: independent current read-only conformance with explicit transaction rollback.
- Environment: current auth-service production DB through read-only credentials after exact Spec acceptance/merge coordinates are known.
- Required evidence: accepted Spec head; query receipt and exact timestamp; full-state artifact digest/class/length/field set; separately derived two-row observed/Spec-target Grant-shape digest equality; separately derived other-84 observed/expected digest equality; target and other-84 anomaly/duplicate counts; read-only role/transaction/final-action coordinates; zero-write statement and database audit.
- Expected result: exact two-row target and other-84 baseline already present; all three digest roles bind accurately; no apply required; database and Grant writes 0.
- Failure condition: any mismatch, digest-role collision, stale current-evidence alias, write, or attempted repair under this Spec.

### ACC-DOWE-010 — Acceptance and merge write zero
- Contracts: `CTR-DOWE-009`, `CTR-DOWE-010`, `CTR-DOWE-016`.
- Method: final docs diff plus database/Grant/audit action review.
- Environment: final acceptance candidate, merge record, and auth-service production write/audit telemetry.
- Required evidence: exact base/head diff; two-file inventory; acceptance/merge actor records; database/Grant/audit write counts all zero.
- Expected result: all data/production writes 0; exactly two docs files changed.
- Failure condition: any data, product, accepted-authority, or production change.

### ACC-DOWE-011 — No identity, credential, or legacy mutation
- Contracts: `CTR-DOWE-010`, `CTR-DOWE-012`.
- Method: read-only protected-field projection and zero-secret review.
- Environment: current auth-service production DB and redacted audit/log outputs.
- Required evidence: before/after protected-field digests; HR main relationship projection; zero-write counts; secret-scanner/zero-disclosure result.
- Expected result: protected fields byte-equivalent; HR main identity untouched.
- Failure condition: mutation, relationship drift, or secret exposure.

### ACC-DOWE-012 — No other Client, Audience, or Scope
- Contracts: `CTR-DOWE-011`.
- Method: exact-set comparison and negative search.
- Environment: exact Spec/PR head and current read-only authorization projection.
- Required evidence: positive two-target set; negative Client/Principal/Audience/Scope/admin/wildcard/blanket query results; changed-file inventory.
- Expected result: only two exact Workflow rows and exact two scopes.
- Failure condition: third target, extra Audience/Scope, admin, wildcard, blanket path.

### ACC-DOWE-013 — Future removal uses narrowing authority
- Contracts: `CTR-DOWE-013`.
- Method: authority-flow review of removal/inactivity cases.
- Environment: exact proposed Spec head and repository authority graph.
- Required evidence: reviewer matrix for removal, inactivity, and role-model-change cases; no conflicting accepted authority.
- Expected result: no removal without a new accepted narrowing authority.
- Failure condition: silent narrowing or operational fact treated as authority.

### ACC-DOWE-014 — Future expansion uses new authority
- Contracts: `CTR-DOWE-014`.
- Method: implementation/authorization boundary review.
- Environment: exact proposed Spec head, frontmatter, and repository authority graph.
- Required evidence: expansion/tool/model case matrix; `implementation_authority: none` check; no implementation closure or production-apply permission.
- Expected result: no expansion/tool/model change under this invariant.
- Failure condition: implementation or expansion inferred from acceptance.

### ACC-DOWE-015 — Post-merge read-only conformance
- Contracts: `CTR-DOWE-015`, `CTR-DOWE-016`.
- Method: run only after the accepted exact head has merged; verify the merge on `main`, then execute the independent read-only conformance audit.
- Environment: post-merge `github/main` at the exact accepted merge plus current auth-service production DB read-only seam.
- Required evidence: independent actor identity; accepted final head/recheck PASS/blockers 0; merged PR/main coordinates; all relevant read-only receipts; zero-write audit; persistent conformance record.
- Expected result: PR is merged only in this phase; exact accepted head is on `main`; all frozen positive/negative checks pass with writes 0.
- Failure condition: audit before merge, self-review, wrong/stale head, missing merge prerequisite, write, or fail-open repair.

### ACC-DOWE-016 — Dispatcher, files, and phase-scoped lifecycle
- Contracts: `CTR-DOWE-012`, `CTR-DOWE-016`.
- Method: verify dispatcher authority and exact diffs once, then record separate lifecycle results at authoring/review, owner acceptance finalize, and final pre-merge recheck; do not apply post-merge expectations in those phases.
- Environment: evaluated base, exact reviewed head, GitHub PR #36, accepted HR Dispatcher Spec, and later exact accepted final head.
- Required evidence: dispatcher grant-shape comparison; amendment one-file diff; PR base-to-head two-file diff; protected-authority blob checks; (A) authoring/review Open/Draft/Unmerged receipt; (B) owner acceptance-finalize Open/Draft/Unmerged receipt; (C) final accepted-head recheck PASS and blockers 0 immediately before any Ready/merge transition. Post-merge evidence belongs only to `ACC-DOWE-015`.
- Expected result: dispatcher remains read+wake only; A and B each pass while unmerged; C gates the future merge phase; `DRAFT_OPEN_UNMERGED_IS_PERPETUAL_INVARIANT = NO`; file scopes pass.
- Failure condition: dispatcher substitution, extra file, a phase checked against another phase's state, Ready/merge before all prerequisites, acceptance/merge in this amendment round, or production apply.

### ACC-DOWE-017 — Product Direction authority pin is exact
- Contracts: `CTR-DOWE-017`.
- Method: resolve the pinned revision and blob in `mayf3/svc-workflow` and inspect the authority frontmatter.
- Environment: current `mayf3/svc-workflow` clone; exact Spec frontmatter at the reviewed head.
- Required evidence: `git rev-parse f4bfbb7cbc1dbcdb29c1caa472408adc41378fbf:docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V4.md` equals `c688593ac8986686c48553fb292b468b3225f06b`; frontmatter `authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V4`, `status: accepted`, `authority_kind: product_direction`; Spec `external_authorities` pin with relation `constrained_by`.
- Expected result: authority ID, revision, blob, accepted status, and `product_direction` kind all match the pin exactly.
- Failure condition: any authority-ID / revision / blob / status / kind mismatch or missing frontmatter pin.

### ACC-DOWE-018 — Runtime Contract authority pin is exact
- Contracts: `CTR-DOWE-018`.
- Method: resolve the pinned delivery revision's contract and manifest blobs and read the manifest fields.
- Environment: current `mayf3/svc-workflow` clone; exact Spec frontmatter at the reviewed head.
- Required evidence: `git rev-parse 68c78bb01bd088883048edb481df02214e596be7:contracts/workflow-http/v1/contract.md` equals `9d81acb167567d9309846da504af2a5b73b86390`; the same revision's `contracts/workflow-http/v1/manifest.json` equals `067d09b326d8a09ac6c90d9d7b900b2278124bb8`; manifest `contract_id: WORKFLOW_HTTP_CONTRACT_V1`, `contract_version: 1.5.0`, `bundle_digest: f7ce39b6f053f8665139c4594c4d24322bfbafc35c0284bb18218a21ed834e89`; Spec `external_authorities` pin with relation `constrained_by`.
- Expected result: contract ID, delivery revision, both blobs, version `1.5.0`, and bundle digest all match exactly.
- Failure condition: any contract-ID / revision / blob / version / digest mismatch or missing frontmatter pin.

### ACC-DOWE-019 — Ownership boundary is respected
- Contracts: `CTR-DOWE-019`.
- Method: authority-flow review of §3.4 against the two pinned upstream authorities and the Child's own scope.
- Environment: exact proposed Spec/PR head and the two pinned upstream revisions.
- Required evidence: §3.4 ownership table; Child scope limited to the two-row Grant end state; changed-file inventory showing no write into `mayf3/svc-workflow` and no upstream authority edit; run logs / DB usage records / Grant audit classified as current-state support only.
- Expected result: `SVC_WORKFLOW_PRODUCT_BOUNDARY_V4` owns Domain and Domain Owner product responsibility; `WORKFLOW_HTTP_CONTRACT_V1` owns the exact Assistance routes and wire-level scopes; this Child owns only the two-Client Grant end state; `CREATE_SVC_WORKFLOW_PRODUCT_AUTHORITY = NO`.
- Failure condition: ownership overlap, upstream authority created or edited, or run logs / DB records / Grant audit treated as product authority.

### ACC-DOWE-020 — Assistance route and scope alignment
- Contracts: `CTR-DOWE-020`.
- Method: read the Assistance route and scope requirements from the pinned contract at `68c78bb01bd088883048edb481df02214e596be7` and compare with the Child's exact end state.
- Environment: pinned contract text plus the exact two-row state evidence of `ACC-DOWE-001`.
- Required evidence: pinned contract route table showing the Domain Owner responsible for Assistance resolve/escalate; write routes gated by `workflow.execute`; read routes gated by `workflow.read`; two-row state `[workflow.execute, workflow.read]@v2` equal to exactly the required scope union.
- Expected result: Domain Owner responsible for Assistance resolve/escalate; write routes require `workflow.execute`; read routes require `workflow.read`; end state consistent with exactly these requirements.
- Failure condition: route/scope mismatch, missing execute or read for the two Owners, or any extra scope justified by the contract.

### ACC-DOWE-021 — Implementation snapshot is not the authority revision
- Contracts: `CTR-DOWE-018`, `CTR-DOWE-022`.
- Method: compare the manifest `owner_head_sha`/`owner_tree_sha` provenance with the Contract delivery revision, and scan the Spec for any snapshot-as-authority or current-main-as-authority classification.
- Environment: pinned manifest at `68c78bb01bd088883048edb481df02214e596be7` and the exact proposed Spec head.
- Required evidence: manifest self-declaration that `owner_head_sha` `efcf0f515ec29600c459e660ce8aa84546c5aee3` is an implementation snapshot and NOT the Contract Bundle delivery commit; `CONTRACT_DELIVERY_REVISION = 68c78bb01bd088883048edb481df02214e596be7`; negative scan result over Spec and PR body.
- Expected result: `OWNER_IMPLEMENTATION_SNAPSHOT_IS_AUTHORITY_REVISION = NO` everywhere; the delivery revision is `68c78bb01bd088883048edb481df02214e596be7`.
- Failure condition: the snapshot or the current upstream main reclassified as an authority revision.

### ACC-DOWE-022 — External authority drift check fails closed
- Contracts: `CTR-DOWE-021`, `CTR-DOWE-022`.
- Method: re-resolve both pinned revisions and all three pinned blobs, additionally resolve the current upstream main and compare the same paths, and scan the Spec/PR for silent re-pin.
- Environment: current `mayf3/svc-workflow` clone at review/conformance time; exact reviewed Spec head.
- Required evidence: blob results at `f4bfbb7cbc1dbcdb29c1caa472408adc41378fbf` and `68c78bb01bd088883048edb481df02214e596be7`; current-main (at this round `bf875c265843b3e07570a96b734051e9cfe27a43`) equality for the product-direction / contract / manifest blobs; frontmatter pins unchanged; `EXTERNAL_AUTHORITY_DRIFT = NO`.
- Expected result: all pins exact; pinned blobs unchanged upstream; no revision advanced to current main.
- Failure condition: any pin / blob / status / kind / version / digest mismatch, upstream pinned-blob drift, or a silently absorbed external authority change.

### ACC-DOWE-023 — PR #33 one-way close-only disposition
- Contracts: `CTR-DOWE-023`.
- Method: record two non-simultaneous phase results: before this Child merges, query PR #33 exact object/head and verify hold-only; after this Child merges, close PR #33 unmerged, then query PR/branch/history and verify no merge/reopen/reuse.
- Environment: GitHub `mayf3/auth-service#33`, this Child's exact accepted/merged coordinates when available, and repository branch/history records.
- Required evidence: pre-trigger PR #33 number/head `2df29a7f5e2a6774600eef67f3c369f6b887c6ad`/Open/Draft/Unmerged receipt; current canonical dependency/use evidence refs; accepted-and-merged Child trigger; post-trigger Closed/Unmerged receipt; preserved remote branch/history; merge commit absence; negative action/reopen/reuse audit.
- Expected result: before trigger `PRE_CHILD_MERGE_ACTION = HOLD_ONLY`; after trigger `CLOSE_METHOD = CLOSE_UNMERGED + preserve remote branch/history`; `PR33_REOPEN_ALLOWED = NO`; exact head is never reused as a future authority vehicle.
- Failure condition: pre-trigger rebase/amend/review/accept/merge/implement, wrong head/state, missing post-trigger closure, deleted history, PR merge, reopen, revival, or reuse without a fresh governing Spec and new PR.

### 10.1 Bidirectional Contract ↔ Acceptance mapping

| Contract | Acceptance coverage |
|---|---|
| `CTR-DOWE-001` | `ACC-DOWE-001`, `ACC-DOWE-009` |
| `CTR-DOWE-002` | `ACC-DOWE-001`, `ACC-DOWE-009` |
| `CTR-DOWE-003` | `ACC-DOWE-002`, `ACC-DOWE-003` |
| `CTR-DOWE-004` | `ACC-DOWE-004` |
| `CTR-DOWE-005` | `ACC-DOWE-005` |
| `CTR-DOWE-006` | `ACC-DOWE-006` |
| `CTR-DOWE-007` | `ACC-DOWE-007` |
| `CTR-DOWE-008` | `ACC-DOWE-008` |
| `CTR-DOWE-009` | `ACC-DOWE-009`, `ACC-DOWE-010` |
| `CTR-DOWE-010` | `ACC-DOWE-010`, `ACC-DOWE-011` |
| `CTR-DOWE-011` | `ACC-DOWE-012` |
| `CTR-DOWE-012` | `ACC-DOWE-011`, `ACC-DOWE-016` |
| `CTR-DOWE-013` | `ACC-DOWE-013` |
| `CTR-DOWE-014` | `ACC-DOWE-014` |
| `CTR-DOWE-015` | `ACC-DOWE-015` |
| `CTR-DOWE-016` | `ACC-DOWE-010`, `ACC-DOWE-015`, `ACC-DOWE-016` |
| `CTR-DOWE-017` | `ACC-DOWE-017` |
| `CTR-DOWE-018` | `ACC-DOWE-018`, `ACC-DOWE-021` |
| `CTR-DOWE-019` | `ACC-DOWE-019` |
| `CTR-DOWE-020` | `ACC-DOWE-020` |
| `CTR-DOWE-021` | `ACC-DOWE-022` |
| `CTR-DOWE-022` | `ACC-DOWE-021`, `ACC-DOWE-022` |
| `CTR-DOWE-023` | `ACC-DOWE-023` |

| Acceptance | Contract coverage |
|---|---|
| `ACC-DOWE-001` | `CTR-DOWE-001`, `CTR-DOWE-002` |
| `ACC-DOWE-002` | `CTR-DOWE-003` |
| `ACC-DOWE-003` | `CTR-DOWE-003` |
| `ACC-DOWE-004` | `CTR-DOWE-004` |
| `ACC-DOWE-005` | `CTR-DOWE-005` |
| `ACC-DOWE-006` | `CTR-DOWE-006` |
| `ACC-DOWE-007` | `CTR-DOWE-007` |
| `ACC-DOWE-008` | `CTR-DOWE-008` |
| `ACC-DOWE-009` | `CTR-DOWE-001`, `CTR-DOWE-002`, `CTR-DOWE-009` |
| `ACC-DOWE-010` | `CTR-DOWE-009`, `CTR-DOWE-010`, `CTR-DOWE-016` |
| `ACC-DOWE-011` | `CTR-DOWE-010`, `CTR-DOWE-012` |
| `ACC-DOWE-012` | `CTR-DOWE-011` |
| `ACC-DOWE-013` | `CTR-DOWE-013` |
| `ACC-DOWE-014` | `CTR-DOWE-014` |
| `ACC-DOWE-015` | `CTR-DOWE-015`, `CTR-DOWE-016` |
| `ACC-DOWE-016` | `CTR-DOWE-012`, `CTR-DOWE-016` |
| `ACC-DOWE-017` | `CTR-DOWE-017` |
| `ACC-DOWE-018` | `CTR-DOWE-018` |
| `ACC-DOWE-019` | `CTR-DOWE-019` |
| `ACC-DOWE-020` | `CTR-DOWE-020` |
| `ACC-DOWE-021` | `CTR-DOWE-018`, `CTR-DOWE-022` |
| `ACC-DOWE-022` | `CTR-DOWE-021`, `CTR-DOWE-022` |
| `ACC-DOWE-023` | `CTR-DOWE-023` |

## 11. Alternatives and disposition

- `ALT-DOWE-001` — whole-supersede Fleet V1: **rejected**; baseline one-time
  operation remains accepted and completed.
- `ALT-DOWE-002` — partially amend Fleet V1: **rejected**; accepted stable IDs
  remain unchanged and the later obligation has a new Spec identity.
- `ALT-DOWE-003` — freeze all Forum rows or the sibling's future lifecycle here:
  **rejected**; Forum is out of scope and this PR guarantees only reviewed-base
  non-interference.
- `ALT-DOWE-004` — infer Domain Owner replacement from HR dispatcher:
  **rejected**; dispatcher is a separate read+wake identity.
- `ALT-DOWE-005` — rerun Fleet V1 or append an authority-repair audit:
  **rejected**; current DB conforms and history must not be rewritten.
- `ALT-DOWE-006` — treat dsh-agent-core source commit as authority: **rejected**;
  it is content-unrelated provenance only.
- `ALT-DOWE-007` — allow silent future narrowing/expansion: **rejected**; each
  authorization change requires new accepted authority.
- `ALT-DOWE-008` — revive/rebase/reuse PR #33 for later narrowing: **rejected**;
  close it unmerged after this Child merges and require fresh evidence, Owner
  decision, new governing Spec, and a new PR.

## 12. Migration, compatibility, and rollback

### 12.1 Main-sync compatibility provenance (non-normative)

The evaluated base advanced from `b88512881135dd8a0d382e8ca76650059df33725`
to `7110463636693b3c2eced9d97ccb186adf46907d` solely through merged PR #29,
the Notification Ingress Minimal Auth Contract Bundle `1.4.0` implementation.
That drift added the separate `agent-core-notification-ingress-v1` Audience with
`[notification.deliver]`; it did not change the `svc-workflow` Audience, its
principal/access flags, or its registered scope vocabulary. Notification Ingress
is outside this Child's governance scope. The two external authority pins and
their exact blobs/digest remain unchanged and are not advanced.

```text
MAIN_DRIFT_CLASSIFICATION = NOTIFICATION_INGRESS_CONTRACT_BUNDLE_1_4_0_IMPLEMENTATION
GOVERNING_AUTHORITY_OVERLAP = NONE
OLD_REGISTRY_VERSION = 1.3.0
NEW_REGISTRY_VERSION = 1.4.0
NEW_AUDIENCE = agent-core-notification-ingress-v1
NEW_AUDIENCE_SCOPES = [notification.deliver]
SVC_WORKFLOW_AUDIENCE_SEMANTICS_UNCHANGED = YES
WORKFLOW_SCOPE_VOCABULARY_UNCHANGED = YES
DOMAIN_OWNER_EXECUTE_AUTHORITY_COMPATIBILITY = COMPATIBLE_NO_SEMANTIC_DELTA
DOMAIN_OWNER_COUNT = 2
DOMAIN_OWNER_SCOPES = [workflow.execute, workflow.read]
CURRENT_GRANT_VERSION = 2
OTHER_WORKFLOW_ROWS_UNCHANGED = 84
FORUM_AUTHORITY = OUT_OF_SCOPE
HISTORICAL_APPLY_AUTHORITY = OWNER_APPLY_ONLY
RETROACTIVE_AUTHORIZATION = NO
CURRENT_DB_ALREADY_CONFORMS = YES
PR33_FINAL_DISPOSITION = CLOSE_AFTER_BOUNDED_CHILD_MERGE
PRODUCT_SEMANTIC_DELTA_FROM_PREVIOUS_HEAD = NONE
PRODUCT_FILES_CHANGED = 0
```

This synchronization adds no stable normative primitive; it updates only
coordinates and non-normative compatibility provenance.

### 12.2 Independent-review blocker amendment provenance (non-normative)

This docs-only amendment closes Review `5058012449`'s five blockers: current-base
typed provenance, two new canonical private evidence bindings, phase-scoped
lifecycle, exact Forum non-interference, and typed PR #33 close-only disposition.
It preserves the product target, database/Grant state, and external pins. It adds
`DEC-DOWE-006` / `CTR-DOWE-023` / `ACC-DOWE-023` and clarifies existing typed
primitives without product semantic delta:

```text
EVIDENCE_RECONCILIATION = PASS
OWNER_HELD_EVIDENCE_ARTIFACT_SHA256 = e9a134bfcf0c9e2960eeb04769e491b9aef55273c2222bab1450677452cf28bd
EVIDENCE_ARTIFACT_CLASS = FULL_STATE_PROJECTION
OBSERVED_GRANT_SHAPE_TWO_ROW_SHA256 = 70e54c7b4af4f5c567853f96678910d84934efb901d409ae5ea65ac21cb6cdc5
SPEC_TARGET_GRANT_SHAPE_SHA256 = 70e54c7b4af4f5c567853f96678910d84934efb901d409ae5ea65ac21cb6cdc5
OBSERVED_OTHER_84_WORKFLOW_SHA256 = cdf8265689f139e07c5415fbd206cea5e548c3b086906fc6444f627ca17ac7cf
EXPECTED_OTHER_84_BASELINE_SHA256 = cdf8265689f139e07c5415fbd206cea5e548c3b086906fc6444f627ca17ac7cf
DB_OBSERVED_AT = 2026-08-29T08:26:20.706381Z
USE_EVIDENCE_REF = AUTH_SERVICE_PR36_DOMAIN_OWNER_WORKFLOW_EXECUTE_USE_EVIDENCE_V1@2026-08-29T12:17:01.066779Z#sha256:de3b707ce06f16be3be45bdb302218a3a92879cb175afec3cadc879139e7fff7
USE_EVIDENCE_ARTIFACT_SHA256 = de3b707ce06f16be3be45bdb302218a3a92879cb175afec3cadc879139e7fff7
USE_EVIDENCE_BINDING = PASS
HISTORICAL_APPLY_EVIDENCE_REF = AUTH_SERVICE_PR36_HISTORICAL_OWNER_APPLY_AUTHORITY_GAP_V1@2026-08-29T12:17:29.913903Z#sha256:9f1f7e77e1666b23dd0cacdb3c9cdd42107f1f064f3944025771ef0e199e02c2
HISTORICAL_APPLY_EVIDENCE_ARTIFACT_SHA256 = 9f1f7e77e1666b23dd0cacdb3c9cdd42107f1f064f3944025771ef0e199e02c2
HISTORICAL_APPLY_EVIDENCE_BINDING = PASS
DIGEST_ROLE_COLLISION_COUNT = 0
STALE_CURRENT_EVIDENCE_ALIAS_COUNT = 0
STALE_CURRENT_BASE_REFERENCE_COUNT = 0
DOMAIN_OWNER_COUNT = 2
CURRENT_GRANT_VERSION = 2
OTHER_WORKFLOW_ROW_COUNT = 84
OTHER_WORKFLOW_ROWS = [workflow.read] @ version 1
CURRENT_WORKFLOW_EXECUTE_DEPENDENCY = PRESENT
WORKFLOW_EXECUTE_USED_SINCE_GRANT = YES
FORUM_AUTHORITY = OUT_OF_SCOPE
FUTURE_FORUM_AUTHORITY_LIFECYCLE = NOT_GOVERNED_BY_THIS_SPEC
HISTORICAL_APPLY_AUTHORITY = OWNER_APPLY_ONLY
HISTORICAL_GOVERNING_SPEC = NONE
RETROACTIVE_AUTHORIZATION = NO
PR33_TYPED_DISPOSITION = PASS (DEC-DOWE-006 / CTR-DOWE-023 / ACC-DOWE-023)
PR33_FINAL_DISPOSITION = CLOSE_AFTER_BOUNDED_CHILD_MERGE
PR33_REOPEN_ALLOWED = NO
NORMATIVE_PRIMITIVE_DELTA = DEC-DOWE-006 + CTR-DOWE-023 + ACC-DOWE-023; phase/evidence/Forum clarifications to existing primitives
CONTRACT_COUNT = 23
CONTRACTS_WITH_ACCEPTANCE = 23
CONTRACT_COVERAGE = PASS
PRODUCT_SEMANTIC_DELTA = NONE
DATABASE_WRITES = 0
GRANT_WRITES = 0
```

`STALE_CURRENT_EVIDENCE_ALIAS_COUNT = 0` means no normative current-evidence
binding uses the historical 2026-08-28 alias; its single explicitly marked
historical mention in `OBS-DOWE-002` is retained only for provenance. The
full-state artifact does not contain `audience`; the two-row Grant-shape does.
Consequently their digest values MUST NOT be exchanged or collapsed.

### 12.3 No migration or rollback authority

No migration occurs. Current DB already conforms. Review/acceptance/merge write
zero database, Grant, audit, identity, credential, legacy, or Forum rows. The old
fleet supply MUST NOT be rerun. After acceptance and merge, exactly two
non-product governance actions remain: close PR #33 unmerged under
`CTR-DOWE-023`, and execute the independent read-only conformance audit under
`CTR-DOWE-015`. Neither action authorizes a production mutation.

Forum Moderator authority remains compatible because it owns a different
Audience and explicitly forbids Workflow mutation. HR dispatcher authority
remains compatible because it owns a separate identity and read+wake grant set.

There is no runtime/data rollback authority here. Future removal of execute is a
new narrowing authority; any expansion is a new authority. Authority rollback
requires a separately reviewed docs-only lifecycle action and cannot be inferred
from runtime inactivity.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
NORMATIVE_PRIMITIVE_DELTA = DEC-DOWE-006 + CTR-DOWE-023 + ACC-DOWE-023; phase/evidence/Forum clarifications to existing primitives
CONTRACT_COUNT = 23
CONTRACTS_WITH_ACCEPTANCE = 23
CONTRACT_COVERAGE = PASS
ACCEPTANCE_REFERENCES_VALID = PASS
STALE_CURRENT_BASE_REFERENCE_COUNT = 0
HISTORICAL_B885_REFERENCE_CLASSIFICATION = PASS
USE_EVIDENCE_BINDING = PASS
HISTORICAL_APPLY_EVIDENCE_BINDING = PASS
LIFECYCLE_CONTRADICTION_COUNT = 0
FORUM_FUTURE_LIFECYCLE_CONSTRAINT_COUNT = 0
PR33_TYPED_DISPOSITION = PASS
PR33_REOPEN_AUTHORITY_PATH = FORBIDDEN
EXTERNAL_AUTHORITY_COUNT = 2
EXTERNAL_AUTHORITY_DRIFT = NO
AUTHORING_READY_FOR_REVIEW = YES
AUTHORITY_ACCEPTANCE_REQUIRES_DB_WRITE = NO
AUTHORITY_MERGE_REQUIRES_GRANT_WRITE = NO
OLD_FLEET_SUPPLY_RERUN = FORBIDDEN
NEXT_TASK = 补权 审计
```
