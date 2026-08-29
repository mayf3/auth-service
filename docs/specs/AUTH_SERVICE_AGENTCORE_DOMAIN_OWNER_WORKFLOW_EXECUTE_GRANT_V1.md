---
spec_id: AUTH_SERVICE_AGENTCORE_DOMAIN_OWNER_WORKFLOW_EXECUTE_GRANT_V1
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
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
EVALUATED_BASE = 325e781982c01a09d438e9d65df8079396e1520e
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

The accepted `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` is an active sibling
later-delta authority. It remains accepted and is neither superseded nor changed
by this Child. In its own independently authorized apply path it may change the
exact moderator Client's Forum scopes to:

```text
[forum.moderate, forum.read, forum.write]
```

This Child makes no statement that all 86 Forum rows must forever remain
read/write-only and does not block, amend, reparent, or authorize that sibling.

```text
FORUM_AUTHORITY = OUT_OF_SCOPE
FORUM_GRANT_WRITES = 0
ACTIVE_SIBLING_AUTHORITY = AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1
FORUM_MODERATOR_AUTHORITY_SUPERSEDED = NO
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

## 4. Current State

### STATE-DOWE-001 — Repository authority base is exact

- Subject: `mayf3/auth-service` authority graph and governed paths.
- As-of commit: `github/main@325e781982c01a09d438e9d65df8079396e1520e`.
- Environment: fresh dedicated authoring worktree.
- Observed at: 2026-08-28 authoring round.
- Basis: `OBS-DOWE-001`, `CLM-DOWE-001`, `EVD-DOWE-001`.

### STATE-DOWE-002 — Exact two current rows already conform

- Subject: exact Domain Owner `svc-workflow` rows and deterministic identity
  relationships.
- Environment: current auth-service database; owner-held read-only evidence
  supplied to this authoring round.
- Result: two rows, scopes `[workflow.execute, workflow.read]`, version `2`;
  Principal active; Client active; relationship `MATCH`; duplicate count `0`.
- Basis: `OBS-DOWE-002`, `CLM-DOWE-002`, `EVD-DOWE-002`.

### STATE-DOWE-003 — Execute dependency and use are present

- Subject: current Domain Owner workflow responsibility.
- Environment: Workflow Assistance and workflow-instance operations;
  owner-held use evidence.
- Result: dependency `PRESENT`; used since grant `YES`, covering Workflow
  Assistance resolve, Workflow instance cancel, and Domain Owner handling of
  in-domain assistance cases.
- Basis: `OBS-DOWE-003`, `CLM-DOWE-003`, `EVD-DOWE-003`.

### STATE-DOWE-004 — Historical apply lacked governing Spec authority

- Subject: migration `agentcore-owner-wf-execute-grant-v1`, applied on
  2026-08-26 under owner authority.
- Source coordinate:
  `mayf3/dsh-agent-core@b5ab589d0aeaa7a28e04bd4e665d27317db0b2d7`.
- Result: `OWNER_APPLY_ONLY`; governing Spec `NONE`; source commit content was
  unrelated to the Grant and was not authority.
- Basis: `OBS-DOWE-004`, `CLM-DOWE-004`, `EVD-DOWE-004`.

## 5. Observations

### OBS-DOWE-001 — Coordinate gate

- Subject: actual GitHub authority branch and task worktree.
- Method: `git fetch github`, exact `github/main` resolution, and worktree/branch
  uniqueness check.
- Result: actual main equals expected
  `325e781982c01a09d438e9d65df8079396e1520e`; therefore no post-expected-main
  drift review was required. A fresh worktree and fresh branch were created.
- Provenance: authoring command record.

### OBS-DOWE-002 — Owner-supplied current DB projection

- Subject: exact two Domain Owner rows.
- Environment: current auth-service production database, read-only projection.
- Observed at: owner evidence current as of 2026-08-28; the independent review
  receipt MUST bind its exact UTC query timestamp.
- Stable private evidence reference:
  `OWNER_HELD_AUTH_DB_DOMAIN_OWNER_WF_EXECUTE_20260828`.
- Method: exact-agent + deterministic Client external-ref lookup, safe leaf-field
  projection, active Principal/Client relationship join, duplicate count, and
  canonical JSON digest; this PR performed no database access or mutation.
- Result:

```text
ROW_COUNT = 2
SCOPES = [workflow.execute, workflow.read]
VERSION = 2
PRINCIPAL = active
CLIENT = active
RELATIONSHIP = MATCH
DUPLICATE = 0
OBSERVED_DOMAIN_OWNER_WORKFLOW_TWO_ROW_SHA256 = 70e54c7b4af4f5c567853f96678910d84934efb901d409ae5ea65ac21cb6cdc5
```

- Privacy/provenance: complete query receipt, mapping, and client IDs remain
  owner-held and are not repeated in PR prose. Independent review MUST inspect
  the private reference, record its artifact digest and exact timestamp in the
  persistent review receipt, and independently reproduce the observed digest.

### OBS-DOWE-003 — Owner-supplied execute dependency/use record

- Subject: uses after the historical grant.
- Environment: current Workflow Assistance and workflow-instance records.
- Observed at: owner evidence current as of 2026-08-28; the independent review
  receipt MUST bind exact event coordinates and timestamps.
- Stable private evidence reference:
  `OWNER_HELD_WORKFLOW_DOMAIN_OWNER_EXECUTE_USE_SINCE_GRANT_20260828`.
- Method: inspect owner-held case/instance records for each required use class;
  this PR publishes no sensitive case content.
- Result:

```text
CURRENT_WORKFLOW_EXECUTE_DEPENDENCY = PRESENT
WORKFLOW_EXECUTE_USED_SINCE_GRANT = YES
USE_CLASS_1 = Workflow Assistance resolve
USE_CLASS_2 = Workflow instance cancel
USE_CLASS_3 = Domain Owner handling of in-domain assistance cases
```

- Privacy/provenance: evidence contents remain owner-held. Independent review
  MUST inspect the private reference and bind its artifact digest, exact event
  coordinates, and timestamps without publishing sensitive case data.

### OBS-DOWE-004 — Historical provenance classification

- Subject: historical Grant migration and authority chain.
- Environment: production auth-service immutable Grant audit and owner execution
  record for 2026-08-26.
- Observed at: owner evidence current as of 2026-08-28; independent review MUST
  bind exact audit-row and execution-receipt timestamps.
- Stable private evidence reference:
  `OWNER_HELD_AUTH_AUDIT_AGENTCORE_OWNER_WF_EXECUTE_GRANT_V1_20260826`.
- Method: owner-provided execution/audit provenance review, including migration
  ID, closed audit envelope, source-repository coordinate, and authority chain;
  independently query the exact GitHub commit object for source-content scope.
- GitHub source-object result: exact commit exists in `mayf3/dsh-agent-core` and
  changes only `docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2.md`, a Feishu UX
  docs-only Spec unrelated to this Grant.
- Result:

```text
HISTORICAL_APPLY_MIGRATION_ID = agentcore-owner-wf-execute-grant-v1
HISTORICAL_APPLY_AUTHORITY_CLASS = OWNER_APPLY_ONLY
HISTORICAL_GOVERNING_SPEC = NONE
SOURCE_GIT_COMMIT = b5ab589d0aeaa7a28e04bd4e665d27317db0b2d7
SOURCE_COMMIT_REPOSITORY = mayf3/dsh-agent-core
SOURCE_COMMIT_CONTENT_RELATED_TO_GRANT = NO
SOURCE_COMMIT_IS_AUTHORITY = NO
RETROACTIVE_AUTHORIZATION = NO
```

### OBS-DOWE-005 — Exact two-row digest

- Subject: the two exact current/required Workflow rows.
- Method: canonical UTF-8 JSON array ordered by `agent_id`, with object keys
  sorted, separators exactly `(',', ':')`, `ensure_ascii=false`; each object
  contains exactly `agent_id`, `client_external_ref`, `audience`, `scopes`, and
  `version`; scopes are unsigned-ASCII sorted.
- Canonical document:

```json
[{"agent_id":"agt_build-in-public-agent","audience":"svc-workflow","client_external_ref":"agentcore:v1:client:agt_build-in-public-agent","scopes":["workflow.execute","workflow.read"],"version":2},{"agent_id":"agt_hr-agent","audience":"svc-workflow","client_external_ref":"agentcore:v1:client:agt_hr-agent","scopes":["workflow.execute","workflow.read"],"version":2}]
```

- Result:

```text
TARGET_DOMAIN_OWNER_WORKFLOW_TWO_ROW_SHA256 = 70e54c7b4af4f5c567853f96678910d84934efb901d409ae5ea65ac21cb6cdc5
OBSERVED_DOMAIN_OWNER_WORKFLOW_TWO_ROW_SHA256 = 70e54c7b4af4f5c567853f96678910d84934efb901d409ae5ea65ac21cb6cdc5
OBSERVED_EQUALS_TARGET = YES
```

The target digest is computed from the canonical document above. The observed
digest is the independently reproducible projection reported by `OBS-DOWE-002`;
its equality MUST be re-established from the private DB evidence during review
and post-merge conformance rather than inferred from this literal.

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
OTHER_WORKFLOW_BASELINE_SHA256 = cdf8265689f139e07c5415fbd206cea5e548c3b086906fc6444f627ca17ac7cf
```

This is the authority baseline digest. Post-merge read-only conformance MUST
independently derive the observed 84-row digest and require equality; it MUST
also verify active unique Principal/Client bindings and duplicate count zero.

### OBS-DOWE-007 — Active Forum sibling disposition

- Subject: `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` at evaluated base.
- Method: inspect accepted frontmatter and exact scope/non-goals/parent relation.
- Result: accepted bounded later delta for one Forum moderator Client; Workflow
  Grant mutation is forbidden; production apply remains separate; fleet V1 is
  preserved as completed baseline.
- Provenance: accepted Spec at `github/main@325e781...`.

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
- Supported by: `EVD-DOWE-006`.
- Contradicted by: none known.
- Uncertainty: current observed equality is deferred to independent read-only
  conformance; the authority baseline itself is exact at the evaluated V1 blob.

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

- Source observations: `OBS-DOWE-002`, `OBS-DOWE-005`.
- Target: `STATE-DOWE-002`, `CLM-DOWE-002`.
- Relation: SUPPORTS.
- Bound coordinates: current auth-service production database; private reference `OWNER_HELD_AUTH_DB_DOMAIN_OWNER_WF_EXECUTE_20260828`; target projection at this exact Spec revision; evidence current as of 2026-08-28.
- Strength/sufficiency: exact two-row shape plus independently reproducible observed/target digest equality; sufficient for authoring.
- Limitations: independent review must bind the private artifact digest and exact UTC query timestamp.
- Provenance: owner-held read-only query receipt and `OBS-DOWE-005` canonicalization procedure.

### EVD-DOWE-003 — Operational records support dependency/use

- Source observations: `OBS-DOWE-003`.
- Target: `STATE-DOWE-003`, `CLM-DOWE-003`.
- Relation: SUPPORTS.
- Bound coordinates: Workflow Assistance and workflow-instance records after migration `agentcore-owner-wf-execute-grant-v1`; private reference `OWNER_HELD_WORKFLOW_DOMAIN_OWNER_EXECUTE_USE_SINCE_GRANT_20260828`; evidence current as of 2026-08-28.
- Strength/sufficiency: covers dependency and all three required use classes.
- Limitations: sensitive case details remain private; review must bind event coordinates/timestamps and artifact digest.
- Provenance: owner-held Workflow Assistance resolve, Workflow instance cancel, and in-domain assistance case records.

### EVD-DOWE-004 — Provenance supports historical-gap classification

- Source observations: `OBS-DOWE-004`.
- Target: `STATE-DOWE-004`, `CLM-DOWE-004`.
- Relation: SUPPORTS.
- Bound coordinates: production migration `agentcore-owner-wf-execute-grant-v1` on 2026-08-26; private reference `OWNER_HELD_AUTH_AUDIT_AGENTCORE_OWNER_WF_EXECUTE_GRANT_V1_20260826`; `mayf3/dsh-agent-core@b5ab589d0aeaa7a28e04bd4e665d27317db0b2d7`.
- Strength/sufficiency: explicit migration, repository, exact source commit, changed-file result, and authority classification.
- Limitations: source code is provenance, not governing authority; review must bind private audit/receipt digests and exact timestamps.
- Provenance: owner-held immutable Grant audit/execution receipt and GitHub commit API result showing only `docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2.md` changed.

### EVD-DOWE-005 — Forum sibling supports isolated later-delta model

- Source observations: `OBS-DOWE-007`.
- Target: `CLM-DOWE-001`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/auth-service@325e781982c01a09d438e9d65df8079396e1520e`, accepted `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1`, inspected 2026-08-28.
- Strength/sufficiency: accepted same-repository precedent that preserves Fleet V1 baseline while governing a later bounded delta.
- Limitations: Forum behavior itself remains out of this Child's scope.
- Provenance: accepted sibling frontmatter and §§1–3 at the evaluated base.

### EVD-DOWE-006 — Fleet V1 projection supports the other-84 baseline

- Source observations: `OBS-DOWE-006`.
- Target: `CLM-DOWE-005`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/auth-service@325e781982c01a09d438e9d65df8079396e1520e`, Fleet V1 blob `649a468f6145cce8653a6e473f07c9d28eca0360`, canonical projection derived 2026-08-28.
- Strength/sufficiency: exact V1 Appendix A subtraction and canonical 84-row digest at the evaluated source blob.
- Limitations: current observed equality is established only by the future independent read-only conformance audit.
- Provenance: Fleet V1 Appendix A and the `OBS-DOWE-006` canonicalization procedure.

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
- Decision: Forum authority is out of scope; preserve the accepted Forum
  Moderator sibling and its independent future apply path.
- Rejected alternative: freeze 86/86 Forum rows as a permanent invariant here.
- Reason: doing so would conflict with the accepted sibling and exceed the
  Workflow-only authority repair.

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
projections MUST both equal `TARGET_DOMAIN_OWNER_WORKFLOW_TWO_ROW_SHA256` from
`OBS-DOWE-005`; equality MUST NOT be inferred from the target literal alone.

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
84-row projection MUST equal `OTHER_WORKFLOW_BASELINE_SHA256` from
`OBS-DOWE-006`. This Child MUST NOT add, remove, rewrite, re-version, audit, or
otherwise mutate any of those rows.

### CTR-DOWE-005 — Forum authority is completely out of scope

This Child MUST neither establish a permanent 86/86 Forum invariant nor govern
any Forum row, Audience, Scope, version, audit, implementation, or apply.
`FORUM_GRANT_WRITES = 0`. Forum state MUST NOT be included in this Child's
conformance result except to prove that this Child performed no Forum write.

### CTR-DOWE-006 — Forum Moderator sibling is preserved

`AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` MUST remain accepted, unsuperseded,
unamended, and un-reparented. Its independent authority may later produce the
exact moderator Forum state `[forum.moderate, forum.read, forum.write]` under
its own implementation/apply gates. This Child MUST neither authorize nor block
that path.

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
binding the exact accepted Spec head, two agent IDs/external refs, two-row
digest, active relationship, duplicate count, dependency/use evidence, other-84
zero delta, Forum isolation, sibling preservation, and zero unauthorized
surface. The audit MUST write zero rows and MUST fail closed on drift.

### CTR-DOWE-016 — Authoring file and lifecycle boundary

This authoring PR MUST change only this Spec and `docs/specs/README.md`, remain
Open/Draft/Unmerged, and leave Fleet V1, Forum Moderator, HR Dispatcher, every
other accepted authority, `.agents/**`, Prisma, scripts, tests, and source
byte-identical. Review, acceptance, merge, conformance, implementation, and
production apply remain distinct phases.

## 10. Acceptance

Every Acceptance result MUST bind the exact evaluated base, exact Spec head,
reviewer, timestamp, and persistent review/evidence reference. Owner-held DB and
use evidence may remain private but MUST be independently inspectable.

### ACC-DOWE-001 — Exact two Domain Owner identities
- Contracts: `CTR-DOWE-001`, `CTR-DOWE-002`.
- Method: read-only exact external-ref join and canonical digest comparison.
- Environment: current auth-service production DB through an independently controlled read-only seam.
- Required evidence: exact accepted Spec head; private DB receipt/digest/timestamp; safe two-row projection; independent digest reproduction; Principal/Client relationship and duplicate results.
- Expected result: exactly two active matching rows, version 2, execute+read, duplicates 0, digest `70e54c7b...6cdc5`.
- Failure condition: any identity, relationship, count, version, scope, or digest mismatch.

### ACC-DOWE-002 — Current execute dependency
- Contracts: `CTR-DOWE-003`.
- Method: independent review of owner-held dependency evidence.
- Environment: current Workflow Assistance and workflow-instance operational records.
- Required evidence: exact Spec head; private reference digest; exact event coordinates/timestamps; reviewer finding that current duties require execute.
- Expected result: `CURRENT_WORKFLOW_EXECUTE_DEPENDENCY = PRESENT`.
- Failure condition: evidence missing, stale, or inconsistent with responsibility.

### ACC-DOWE-003 — Real use evidence
- Contracts: `CTR-DOWE-003`.
- Method: privately inspect post-grant evidence for all three required use classes.
- Environment: owner-held post-2026-08-26 Workflow Assistance and workflow-instance records.
- Required evidence: exact Spec head; private artifact digest; one bound record for resolve, cancel, and in-domain assistance handling; timestamps after grant.
- Expected result: `WORKFLOW_EXECUTE_USED_SINCE_GRANT = YES`.
- Failure condition: no post-grant use or any required class unsupported.

### ACC-DOWE-004 — Other 84 Workflow rows unchanged
- Contracts: `CTR-DOWE-004`.
- Method: subtract the two targets from exact Fleet V1 Appendix A, perform a read-only active Principal/Client/Workflow join, check uniqueness/duplicates, and independently derive the canonical 84-row digest.
- Environment: Fleet V1 blob at evaluated base plus current auth-service production DB read-only seam.
- Required evidence: exact Fleet V1 blob; subtraction output; safe 84-row projection; observed digest; active-binding and duplicate-count receipt; zero-write receipt.
- Expected result: 84/84 exact identities remain `svc-workflow[workflow.read]@v1`, active matching bindings, duplicates 0, observed digest `cdf82656...ca17ac7cf`, and writes 0.
- Failure condition: identity/count/binding/version/scope/digest mismatch, duplicate, or Child-attributable mutation.

### ACC-DOWE-005 — Forum authority completely out of scope
- Contracts: `CTR-DOWE-005`.
- Method: semantic boundary review and changed-row/file audit.
- Environment: exact proposed Spec/PR head and current auth-service DB write/audit records.
- Required evidence: exact Spec/PR diff; Forum-reference classification; database and Grant write-count receipt showing Forum writes 0.
- Expected result: no permanent Forum invariant and Forum writes 0.
- Failure condition: Forum target/conformance freeze or any Forum mutation.

### ACC-DOWE-006 — Moderator sibling unaffected
- Contracts: `CTR-DOWE-006`.
- Method: exact object/frontmatter comparison and authority-flow review.
- Environment: evaluated base and exact proposed Spec head.
- Required evidence: sibling blob/frontmatter/status comparison; changed-file list; authority graph showing no supersede/amend/reparent/block.
- Expected result: sibling accepted, unsuperseded, unamended, un-reparented.
- Failure condition: sibling file/authority/apply path changed or blocked.

### ACC-DOWE-007 — Historical authority gap
- Contracts: `CTR-DOWE-007`.
- Method: historical migration/provenance/authority-chain audit.
- Environment: owner-held 2026-08-26 execution/audit record and GitHub `mayf3/dsh-agent-core` source object.
- Required evidence: migration ID; private audit/receipt digests and timestamps; exact source commit API result/changed file; historical governing-authority inventory.
- Expected result: owner-only apply, governing Spec none, source commit content-unrelated and non-authoritative.
- Failure condition: invented historical governing authority or omitted gap.

### ACC-DOWE-008 — No retroactive authorization
- Contracts: `CTR-DOWE-008`.
- Method: contradiction search over Spec, PR body, historical evidence, and future acceptance record.
- Environment: exact reviewed Spec/PR head and immutable historical audit record.
- Required evidence: search output; reviewer authority timeline; audit byte/digest comparison; statement that no compensating row was appended.
- Expected result: prospective governance only; history/audits unchanged.
- Failure condition: backdated authority, compensating audit, or history rewrite.

### ACC-DOWE-009 — Current DB already conforms
- Contracts: `CTR-DOWE-001`, `CTR-DOWE-002`, `CTR-DOWE-009`.
- Method: independent current read-only conformance.
- Environment: current auth-service production DB through read-only credentials after exact Spec acceptance/merge coordinates are known.
- Required evidence: accepted Spec head; query receipt/digest/timestamp; two-row observed/target digest equality; zero-write statement and database audit.
- Expected result: exact target already present; no apply required.
- Failure condition: any mismatch or attempted repair under this Spec.

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
- Contracts: `CTR-DOWE-015`.
- Method: independent audit after accepted Spec reaches `main`.
- Environment: `github/main` at exact accepted merge plus current auth-service production DB read-only seam.
- Required evidence: independent actor identity; accepted head/merge; all ACC-DOWE-001–014 relevant read-only receipts; zero-write audit; persistent conformance record.
- Expected result: all frozen positive/negative checks pass with writes 0.
- Failure condition: self-review, stale coordinates, write, or fail-open repair.

### ACC-DOWE-016 — Dispatcher separation and lifecycle/file boundary
- Contracts: `CTR-DOWE-012`, `CTR-DOWE-016`.
- Method: HR dispatcher authority comparison, final Git diff, and PR-state check.
- Environment: evaluated base, exact proposed head, GitHub Draft PR, and accepted HR Dispatcher Spec.
- Required evidence: dispatcher grant-shape comparison; exact two-file diff; protected-authority blob checks; GitHub Open/Draft/Unmerged state.
- Expected result: dispatcher remains read+wake only; Draft/Open/Unmerged; only two allowed docs files changed.
- Failure condition: dispatcher substitution, extra file, acceptance, merge, or apply.

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
| `CTR-DOWE-016` | `ACC-DOWE-010`, `ACC-DOWE-016` |

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
| `ACC-DOWE-015` | `CTR-DOWE-015` |
| `ACC-DOWE-016` | `CTR-DOWE-012`, `CTR-DOWE-016` |

## 11. Alternatives and disposition

- `ALT-DOWE-001` — whole-supersede Fleet V1: **rejected**; baseline one-time
  operation remains accepted and completed.
- `ALT-DOWE-002` — partially amend Fleet V1: **rejected**; accepted stable IDs
  remain unchanged and the later obligation has a new Spec identity.
- `ALT-DOWE-003` — freeze all Forum rows here: **rejected**; Forum is out of
  scope and the accepted Moderator sibling must remain operable.
- `ALT-DOWE-004` — infer Domain Owner replacement from HR dispatcher:
  **rejected**; dispatcher is a separate read+wake identity.
- `ALT-DOWE-005` — rerun Fleet V1 or append an authority-repair audit:
  **rejected**; current DB conforms and history must not be rewritten.
- `ALT-DOWE-006` — treat dsh-agent-core source commit as authority: **rejected**;
  it is content-unrelated provenance only.
- `ALT-DOWE-007` — allow silent future narrowing/expansion: **rejected**; each
  authorization change requires new accepted authority.

## 12. Migration, compatibility, and rollback

No migration occurs. Current DB already conforms. Review/acceptance/merge write
zero database, Grant, audit, identity, credential, legacy, or Forum rows. The old
fleet supply MUST NOT be rerun. After acceptance and merge, the only next action
under this authority is an independent read-only conformance audit.

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
CONTRACT_COUNT = 16
CONTRACTS_WITH_ACCEPTANCE = 16
ACCEPTANCE_REFERENCES_VALID = PASS
AUTHORING_READY_FOR_REVIEW = YES
AUTHORITY_ACCEPTANCE_REQUIRES_DB_WRITE = NO
AUTHORITY_MERGE_REQUIRES_GRANT_WRITE = NO
OLD_FLEET_SUPPLY_RERUN = FORBIDDEN
NEXT_TASK = 补权 审计
```
