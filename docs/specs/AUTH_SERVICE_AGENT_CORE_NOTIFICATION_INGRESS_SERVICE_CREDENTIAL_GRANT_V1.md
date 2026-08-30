---
spec_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1

> **ACCEPTED — CONTRACT IMPLEMENTATION AUTHORITY; PRODUCTION APPLY NONE.** This
> focused amendment restates and corrects the never-accepted proposal from
> auth-service PR #28 at `87edae60bfa5d30b60526668814052725d843692`. A
> proposed authority was amended, not superseded: PR #28 never became active
> authority, so no supersession metadata or backlink is created. Acceptance
> authorizes only the exact implementation Contracts and three-file closure in
> this Spec; `production_apply_authority` remains `none`.
>
> This acceptance PR creates documentation only. It does not implement, deploy,
> connect to a production database, register an Audience, create a Principal or
> Client, generate or hand off a secret, or write a Grant.

## 1. Goal

Freeze a reviewable production-authority boundary for the auth-service portion
of Agent Core Notification Ingress registration:

1. Audience registration and Client/Grant supply are separate governed phases;
2. the Client/Grant implementation closure is exactly three repository files;
3. future `plan`, `apply`, and `verify` behavior is deterministic, idempotent,
   fail-closed, secret-safe, and fully rollback-accountable; and
4. the current integrated WIP runner remains unchanged and blocked.

This Spec preserves the original proposal's two dedicated service callers and
freezes their public Client IDs:

```text
AUDIENCE_ID        = agent-core-notification-ingress-v1
SCOPE              = notification.deliver
FORUM_CALLER       = svc-forum
FORUM_CLIENT_ID    = mc_Ez8kTAKKvcf2pF40aoUM4q9M
WORKFLOW_CALLER    = svc-workflow
WORKFLOW_CLIENT_ID = mc_uYu1fDfNHjzUlRQGJdTajz9n
```

## 2. Scope and non-goals

### 2.1 In scope

- Correct `CTR-NSC-005` so Audience registration is an independently governed,
  independently authorized prerequisite, never a side effect of Client/Grant
  supply.
- Correct and freeze `CTR-NSC-006` as the exact three-file Client/Grant
  implementation closure.
- Freeze the two exact Client IDs, caller identities, Audience, Scope, and
  closed target state.
- Freeze `plan` / `apply` / `verify`, exact-rerun `NOOP`, fail-closed drift
  handling, non-target Client/Grant digest invariance, secret non-disclosure,
  complete rollback, and fail-loud incomplete rollback.
- Bind the authority correction to target source commit
  `7110463636693b3c2eced9d97ccb186adf46907d`.

### 2.2 Explicitly out of scope and unauthorized

- Any product-code, test, script, schema, migration, bundle, runtime, deployment,
  database, Principal, Client, secret, Grant, or production change in this PR.
- Acceptance, merge, production execution, production database connectivity,
  credential generation, or credential handoff.
- Combining Audience registration with Client/Grant supply in one production
  write transaction or one authority inference.
- Any Human grant, delegation/OBO grant, wildcard, prefix match, silent
  downscope, cross-Audience grant reuse, legacy `allowedResources` /
  `allowedScopes` mutation, online management API, or `machine-admin` reuse.
- Any Client or Grant other than the two exact targets in §9.
- Modifying or adopting `/private/tmp/run-authsvc-ni-supply-7110463-v1.sh`.

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = 7110463636693b3c2eced9d97ccb186adf46907d
AMENDED_PROPOSAL = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1
AMENDED_PROPOSAL_REVISION = 87edae60bfa5d30b60526668814052725d843692
PRIMARY_PARENT_AUTHORITY = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
ARCHITECTURE_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
GOVERNANCE_AUTHORITY = AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
IMPLEMENTATION_AUTHORITY_WHILE_PROPOSED = none
PRODUCTION_APPLY_AUTHORITY = none
```

The accepted Audience CCR and its accepted implementation closure authorize a
versioned source registration. They do not authorize a production Audience row,
Client, credential, or Grant write. Conversely, this Client/Grant Spec does not
authorize or absorb Audience registration.

A future implementation round may start only after an authorized acceptance
transaction changes the exact final reviewed Spec head to `status: accepted`
and `implementation_authority: contracts`, with that accepted head merged into
the implementation base. `production_apply_authority` remains `none`; a later
production APPLY requires a separate, explicit owner authorization bound to an
exact accepted Spec head, implementation commit, plan digest, environment, and
execution window.

## 4. Current State

### STATE-NSC-001 — Source registration exists at the target commit

- Subject: auth-service source tree.
- As-of commit: `7110463636693b3c2eced9d97ccb186adf46907d`.
- Environment: repository source only; no production-state inference.
- State: the Notification Ingress Bundle `1.4.0` source implementation is merged.
- Basis: `OBS-NSC-001`, `EVD-NSC-001`.

### STATE-NSC-002 — Client/Grant authority is absent from the target commit

- Subject: governing Spec tree.
- As-of commit: `7110463636693b3c2eced9d97ccb186adf46907d`.
- State: the PR #28 proposal and `CTR-NSC-005/006` are absent from `main`; PR #28
  remains open, Draft, proposed, and unmerged.
- Basis: `OBS-NSC-002`, `EVD-NSC-002`.

### STATE-NSC-003 — The current integrated runner is blocked WIP

- Subject: `/private/tmp/run-authsvc-ni-supply-7110463-v1.sh`.
- Observed identity: SHA-256
  `5e6525b6a5d50c3f24221414743b8da6bcd9b75f6e3591b57380b02b2236c3aa`.
- State: the runner combines Audience/deploy work and Client/Grant supply, while
  its own comments and authority gate identify the Client/Grant Spec as absent.
  It is not in the exact three-file closure and remains blocked and unchanged.
- Basis: `OBS-NSC-003`, `EVD-NSC-003`.

### STATE-NSC-004 — Production state is not asserted by this proposal

- Subject: production auth-service and production database.
- As-of: not observed or connected by this authoring round.
- State: `UNKNOWN` for purposes of apply classification. A future authorized
  `plan` must establish fresh read-only coordinates; historical PR #28
  observations cannot be promoted into current production facts.
- Basis: `CLM-NSC-001`.

## 5. Observations

### OBS-NSC-001 — Target commit contains the accepted source closure

- Source: `mayf3/auth-service@7110463636693b3c2eced9d97ccb186adf46907d`.
- Method: repository inspection.
- Result: accepted
  `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2`
  and the merged Bundle `1.4.0` implementation are present.
- Limit: source presence does not prove production registration or authorize a
  production write.

### OBS-NSC-002 — The governing candidate is proposed outside main

- Source: auth-service PR #28 at
  `87edae60bfa5d30b60526668814052725d843692`.
- Method: exact PR-head and file inspection.
- Result: `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1`
  has `status: proposed`, `implementation_authority: none`, and
  `production_apply_authority: none`; it defines `CTR-NSC-005/006` but is absent
  from the target commit.
- Limit: a proposed unmerged file is not active authority.

### OBS-NSC-003 — The WIP runner crosses both phases

- Source: `/private/tmp/run-authsvc-ni-supply-7110463-v1.sh`, SHA-256 recorded in
  `STATE-NSC-003`.
- Method: read-only source inspection; no execution.
- Result: the file contains a Phase A Audience/deploy write path and a Phase B
  Principal/Client/secret/Grant path; it explicitly gates Phase B because the
  Spec is absent from the pinned source tree.
- Limit: source inspection is not implementation conformance and grants no
  execution authority.

## 6. Claims and assumptions

### CLM-NSC-001 — Fresh production classification is mandatory

- Support state: SUPPORTED.
- Supported by: governance distinction between source, runtime, and persisted
  state; `OBS-NSC-001` and `OBS-NSC-002` do not observe current production data.
- Uncertainty: the exact production shape remains unknown until a separately
  authorized read-only plan.

### CLM-NSC-002 — The correction is AMEND, not SUPERSEDE

- Support state: SUPPORTED.
- Supported by: PR #28 is proposed and unmerged (`OBS-NSC-002`); it never became
  accepted authority whose normative meaning requires replacement.

### CLM-NSC-003 — Integrated production apply is not authorized

- Support state: SUPPORTED.
- Supported by: the Audience authority does not grant Client/Grant authority;
  this proposal has both authority fields set to `none`; and the WIP runner
  crosses both phases (`OBS-NSC-003`).

## 7. Evidence relations

### EVD-NSC-001 — Source inspection supports source-only State

- Source observations: `OBS-NSC-001`.
- Target: `STATE-NSC-001`.
- Relation: SUPPORTS.
- Coordinates: auth-service target commit.
- Sufficiency: exact for source presence; no production claim.

### EVD-NSC-002 — PR coordinates support inactive-authority State

- Source observations: `OBS-NSC-002`.
- Target: `STATE-NSC-002`, `CLM-NSC-002`.
- Relation: SUPPORTS.
- Coordinates: PR #28 exact head and target commit.
- Sufficiency: exact for lifecycle and repository presence.

### EVD-NSC-003 — WIP source supports the phase-boundary blocker

- Source observations: `OBS-NSC-003`.
- Target: `STATE-NSC-003`, `CLM-NSC-003`.
- Relation: SUPPORTS.
- Coordinates: exact path and SHA-256.
- Sufficiency: exact for file contents and closure exclusion; no execution claim.

## 8. Decisions

### DEC-NSC-001 — Focused amendment of the proposed candidate

- Decision owner: repository owner.
- Selected direction: restate the same proposed Spec ID on the target base and
  correct `CTR-NSC-005/006` plus their dependent execution Contracts.
- Rejected alternative: whole-Spec supersession.
- Reason: V0 supersession replaces accepted authority; PR #28 was never accepted.

### DEC-NSC-002 — Two authority phases, never an inferred combined write

- Decision owner: repository owner.
- Selected direction:

```text
PHASE A = Audience registration
  authority owner = accepted Audience CCR + accepted source closure
  production apply = separate vehicle and separate explicit authorization
  output required by Phase B = exact active Audience row, verified read-only

PHASE B = Client/Grant supply
  authority owner = this Spec after accepted/contracts + conformant implementation
  production apply = separate explicit owner authorization
  input = Phase A exact row already present; Phase B performs no Audience write
```

- Rejected alternative: one production write path whose Audience authority is
  treated as permission to start Client/Grant supply.
- Reason: authority is object- and phase-bounded. Missing authority fails before
  the first write.

### DEC-NSC-003 — Exact three-file Client/Grant closure

- Decision owner: repository owner.
- Selected direction: the only future implementation closure is the exact path
  set in `CTR-NSC-006`; no fourth file and no temporary runner are included.
- Rejected alternative: adopt or copy the integrated `/private/tmp` runner.
- Reason: it crosses the corrected phase boundary and is not repository-governed
  implementation.

### DEC-NSC-004 — One all-or-nothing Phase B apply unit

- Decision owner: repository owner.
- Selected direction: both callers, both destination updates, both Principals,
  both Clients, both Grants, and both audit rows form one Phase B apply unit.
  Any failure invokes complete rollback of every Phase B effect from that run.
- Rejected alternative: per-caller commits that can leave one caller supplied and
  the other absent.
- Reason: the requested production closure requires complete rollback and no
  partial success.

### DEC-NSC-005 — Secrets are absent until authorized apply

- Decision owner: repository owner.
- Selected direction: this proposal, independent review, implementation,
  conformance, `plan`, and `verify` generate no secret. Only a separately
  owner-authorized production `apply` may generate exactly two independent raw
  secrets in memory, once, after all gates pass. Raw secrets are never printed,
  logged, reported, persisted in Git, placed in command arguments, or stored in
  the database; the database stores only the approved one-way hash form and each
  raw value is atomically handed to its one 0600 destination.
- Rejected alternative: pre-generate, print, capture, or record a secret during
  planning or review.

## 9. Exact target state

```text
CALLER 1
  principal_type = service
  principal_external_ref = service:v1:principal:svc-forum
  principal_display_name = svc-forum service
  client_external_ref = service:v1:client:svc-forum:agent-core-notification-ingress-v1
  client_id = mc_Ez8kTAKKvcf2pF40aoUM4q9M
  client_status = active
  allowed_resources = []
  allowed_scopes = []
  grant.audience_id = agent-core-notification-ingress-v1
  grant.scopes = [notification.deliver]
  grant.version = 1
  secret_destination = /Users/yanfenma/.local/services/svc-forum/notification-ingress.env

CALLER 2
  principal_type = service
  principal_external_ref = service:v1:principal:svc-workflow
  principal_display_name = svc-workflow service
  client_external_ref = service:v1:client:svc-workflow:agent-core-notification-ingress-v1
  client_id = mc_uYu1fDfNHjzUlRQGJdTajz9n
  client_status = active
  allowed_resources = []
  allowed_scopes = []
  grant.audience_id = agent-core-notification-ingress-v1
  grant.scopes = [notification.deliver]
  grant.version = 1
  secret_destination = /Users/yanfenma/.local/services/svc-workflow/.env

BOTH DESTINATIONS
  mode = 0600
  owner = yanfenma
  keys = AUTH_NOTIFICATION_INGRESS_CLIENT_ID,
         AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET
  cross-caller entries = forbidden
```

The target Client IDs are public identifiers, not secrets. No secret value or
secret-derived diagnostic is frozen in this Spec.

## 10. Contracts

### CTR-NSC-001 — Two exact service Principals

Phase B MUST create or recognize exactly the two service Principals in §9. An
unrelated, ambiguous, disabled, duplicate, wrong-type, wrong-owner, wrong-name,
or partial row is existing-state drift and MUST fail closed with writes zero.

### CTR-NSC-002 — Two exact dedicated Clients

Phase B MUST create or recognize exactly the two Clients and public Client IDs
in §9. Client ID substitution, collision, shared Client, legacy field content,
wrong binding, wrong status, duplicate row, or partial row MUST fail closed with
writes zero.

### CTR-NSC-003 — Secret non-disclosure and lifecycle

No secret is generated before a separately authorized Phase B APPLY. `plan` and
`verify` MUST generate zero secrets. Authorized APPLY MAY generate exactly two
independent 256-bit raw secrets in process memory after all preconditions pass.
It MUST NOT print, log, report, serialize, record, or pass either raw secret via
argv or environment. The database stores only the approved scrypt hash form.
Each raw secret is atomically installed only at its §9 destination; temporary
files are 0600, same-filesystem, unlinked on failure, and never retained as
evidence. Exact rerun MUST generate zero secrets.

### CTR-NSC-004 — Exact single Grant per Client

Each target Client MUST have exactly one MachineAccessGrant:
`agent-core-notification-ingress-v1[notification.deliver]@v1`. No wildcard,
extra Scope, extra Audience, Human grant, delegation grant, Agent-principal
grant, downscope, or legacy permission mutation is permitted.

### CTR-NSC-005 — Audience registration and Client/Grant supply are separate

Audience registration is a Phase B precondition, never a Phase B side effect.
The Client/Grant operator MUST perform zero `auth_audiences`, Contract Bundle,
runtime deploy, or Audience-audit writes. It MUST require an already-present,
active production Audience row exactly matching the accepted Audience authority.
Absent or mismatched Audience state MUST fail closed before secret generation and
before the first write.

Phase A and Phase B MUST NOT be combined into one production write transaction,
runner, or approval inference unless a future accepted authority explicitly
owns that combined transaction. As of this accepted Spec:

```text
PHASE_A_PRODUCTION_APPLY_AUTHORITY = none granted by this Spec
PHASE_B_IMPLEMENTATION_AUTHORITY = contracts (only CTR-NSC-006 exact closure)
PHASE_B_PRODUCTION_APPLY_AUTHORITY = none
COMBINED_PRODUCTION_WRITE_AUTHORITY = none
```

### CTR-NSC-006 — Closed three-file implementation closure

A future implementation PR, after authority exists, MUST change exactly these
three paths and no others:

```text
scripts/supply-notification-ingress-service-credentials-v1.ts
scripts/run-notification-ingress-service-credentials-v1-conformance.sh
tests/oauth/supply-notification-ingress-service-credentials-v1.test.ts
```

No wildcard, generated file, related file, fourth file, schema change, online
API, `machine-admin` change, deployment file, or `/private/tmp` runner is in the
closure. `EXTRA_FILE_COUNT = 0`.

### CTR-NSC-007 — Exact plan / apply / verify protocol

The implementation MUST expose only:

```text
plan   = default; read-only; zero DB/filesystem writes; zero secret generation
apply  = consumes an exact approved plan digest; separately owner-authorized
verify = read-only; zero writes; zero secret generation
```

`plan` MUST emit a canonical secret-free plan containing exact source/Spec/
implementation coordinates, target classification, exact target rows, the
Audience projection, destination metadata without values, and the non-target
digest from `CTR-NSC-010`. `apply` MUST reject a missing, stale, malformed, or
wrong-environment plan and MUST re-read every precondition in its serializable
transaction. `verify` MUST compare the complete safe target projection,
destination ownership/mode/key presence, secret-to-hash match as a boolean only,
audit envelopes, and non-target digest. No mode may silently repair drift.

### CTR-NSC-008 — Exact rerun is NOOP

Only the complete exact §9 state, two exact closed audit envelopes, exact
destination metadata, successful secret-to-hash boolean checks, exact Audience
precondition, and unchanged non-target digest classify as `EXACT_RERUN_NOOP`.
The canonical NOOP plan and its digest MUST be deterministic. Applying that NOOP
plan performs all writes zero and generates zero secrets. Any partial or
shape-mismatched state is not NOOP.

### CTR-NSC-009 — Shape mismatch and existing-state drift fail closed

Any target `PARTIAL`, `AMBIGUOUS`, `DUPLICATE`, `SHAPE_MISMATCH`, `AUDIT_MISMATCH`,
`DESTINATION_MISMATCH`, `AUDIENCE_MISMATCH`, plan-to-live drift, or unknown query
outcome MUST return a secret-free `REFUSED` result before the first write. It
MUST NOT adopt, repair, delete, rotate, revoke, regenerate, or reinterpret
existing state. If drift is detected after mutation begins, `CTR-NSC-011`
applies.

### CTR-NSC-010 — Non-target Client/Grant digest is invariant

`plan` MUST compute a deterministic SHA-256 over canonical, length-delimited,
ordinally sorted, closed projections of every non-target `machine_clients` row
and every non-target `machine_access_grants` row. Non-target means every row not
owned by the two exact target Client external refs/IDs in §9. The projection MUST
include every persisted Client/Grant field needed to detect mutation, including
foreign keys, status, legacy arrays, Scope arrays, versions, and timestamps;
secret hashes may be hashed into the canonical digest but MUST NOT be emitted.

The same digest MUST be recomputed immediately before mutation, before commit,
and by `verify`:

```text
NON_TARGET_CLIENT_GRANT_DIGEST_BEFORE
  == NON_TARGET_CLIENT_GRANT_DIGEST_PRECOMMIT
  == NON_TARGET_CLIENT_GRANT_DIGEST_AFTER
```

Any inequality fails closed or rolls back. Every non-target Client and Grant has
write count zero. Reports may contain the digest, row counts, and safe coordinates
only, never row secret hashes or raw secrets.

### CTR-NSC-011 — Any Phase B step failure completely rolls back

One Phase B APPLY is an all-or-nothing unit across both callers. It MUST acquire
a dedicated global lock, preserve destination pre-images without exposing their
values, stage both 0600 destination replacements, and use one serializable DB
transaction for both Principals, both Clients, both Grants, and both closed audit
rows. Commit is allowed only after both target projections, both staged
destinations, and the non-target precommit digest verify exactly.

Failure at any step MUST restore every destination byte-for-byte, roll back or
compensate every DB row and audit row created by the run, remove temporary files,
and verify that the complete safe pre-state projection and non-target digest are
restored. Phase A's pre-existing Audience row is not a Phase B effect and MUST
NOT be removed or modified by Phase B rollback.

A successful rollback returns `ROLLED_BACK` and is not success. The operator MUST
NOT report one caller as committed while the other is rolled back or refused.

### CTR-NSC-012 — Incomplete rollback fails loud and blocks retry

If any rollback or compensation action cannot be proven complete, the result is
`ROLLBACK_INCOMPLETE` (or `OUTCOME_UNKNOWN` when commit outcome itself cannot be
established), with a non-zero dedicated exit code and a secret-free residual
coordinate list. It MUST NOT emit `NOOP`, `COMMITTED`, or success; MUST NOT
automatically retry; and MUST leave a durable, secret-free recovery marker that
blocks another APPLY until independent reconciliation and fresh authority.

### CTR-NSC-013 — Closed audit and safe reporting

The two Grant changes MUST have one closed, same-transaction audit envelope each,
bound to exact Spec revision, implementation commit, plan digest, production
approval reference, operator identity, target Client ID, `before = null`, and a
complete non-secret after projection. Reports and errors MUST use an allowlisted
schema with `additionalProperties: false`; secret values, destination values,
secret hashes, database URLs, passwords, and environment dumps are forbidden.

### CTR-NSC-014 — WIP runner remains blocked and unchanged

`/private/tmp/run-authsvc-ni-supply-7110463-v1.sh` is not an implementation
artifact, not in `CTR-NSC-006`, and MUST remain unchanged by this task. It MUST
NOT be accepted, copied into the repository, used for production apply, or used
as conformance evidence. Its integrated phase model remains blocked pending
independent authority; this Spec does not cure it by prose.

### CTR-NSC-015 — Proposed lifecycle has no production effect

Proposal, review, comment, or Draft PR creation MUST produce:

```text
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
PRODUCTION_DB_CONNECTION = NONE
AUDIENCE_WRITE = 0
PRINCIPAL_WRITE = 0
CLIENT_WRITE = 0
SECRET_GENERATED = 0
GRANT_WRITE = 0
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
```

## 11. Acceptance

### ACC-NSC-001 — Authority and phase separation

- Contracts: `CTR-NSC-005`, `CTR-NSC-015`.
- Method: inspect exact Spec head, PR file list, and authority fields.
- Expected: proposed/none/none; Audience and Client/Grant writes are separately
  governed; no combined apply authority.
- Failure: any inferred production permission or non-doc change.

### ACC-NSC-002 — Exact closure

- Contracts: `CTR-NSC-006`, `CTR-NSC-014`.
- Method: machine-compare the future implementation PR file list.
- Expected: exactly the three paths in `CTR-NSC-006`; WIP runner absent and
  unchanged; extra file count zero.
- Failure: missing, substituted, wildcard, generated, or fourth path.

### ACC-NSC-003 — Plan/apply/verify and drift matrix

- Contracts: `CTR-NSC-007`, `CTR-NSC-008`, `CTR-NSC-009`.
- Method: isolated conformance tests covering ABSENT, exact NOOP, every partial
  target shape, stale plan, Audience mismatch, destination mismatch, duplicate,
  audit mismatch, and unknown query outcome.
- Expected: plan/verify read-only; exact rerun deterministic NOOP; every mismatch
  secret-free REFUSED with all writes zero.
- Failure: repair, adoption, secret generation outside apply, or partial write.

### ACC-NSC-004 — Non-target invariance

- Contracts: `CTR-NSC-010`.
- Method: seeded non-target Client/Grant corpus, before/precommit/after digest
  comparison, instrumented write counters, and injected concurrent drift.
- Expected: all three digests equal on success; every non-target write count zero;
  concurrent drift refuses or rolls back.
- Failure: any digest inequality, non-target write, or secret-hash disclosure.

### ACC-NSC-005 — Secret safety

- Contracts: `CTR-NSC-003`, `CTR-NSC-013`.
- Method: static and dynamic scan of stdout, stderr, report, argv, environment,
  temp paths, audit rows, and DB safe projection; count RNG calls per mode.
- Expected: proposal/plan/verify/NOOP generate zero secrets; authorized first
  apply generates exactly two independent in-memory values; raw-secret occurrence
  count outside the two destinations is zero.
- Failure: generation before authority, printing, logging, recording, shared
  secret, retained temp file, or cross-caller destination content.

### ACC-NSC-006 — Complete rollback and fail-loud residuals

- Contracts: `CTR-NSC-011`, `CTR-NSC-012`.
- Method: inject failure at every ordered apply step, including each destination
  operation, each DB write, precommit verification, commit uncertainty,
  compensation, and rollback verification.
- Expected: either exact COMMITTED end state or proven complete pre-state with
  `ROLLED_BACK`; incomplete restoration returns dedicated non-zero
  `ROLLBACK_INCOMPLETE`/`OUTCOME_UNKNOWN`, blocks retry, and never claims success.
- Failure: one-caller partial success, silent residual, automatic retry, Audience
  rollback, or success under uncertainty.

### ACC-NSC-007 — Exact target identity and Grant shape

- Contracts: `CTR-NSC-001`, `CTR-NSC-002`, `CTR-NSC-004`.
- Method: machine-compare complete safe projections against §9 and exercise the
  forbidden matrix.
- Expected: exactly two target Principals, two exact public Client IDs, two exact
  Grants, and no extra authority.
- Failure: substitution, extra Scope/Audience, wrong type/status/binding, legacy
  permission, wildcard, delegation, Human grant, or downscope.

## 12. Alternatives and disposition

### ALT-NSC-001 — Whole-Spec successor to PR #28

- Disposition: rejected.
- Reason: PR #28 is proposed and inactive; amendment is the correct lifecycle
  vehicle. Supersession metadata would falsely imply prior accepted authority.

### ALT-NSC-002 — Integrated Audience + Client/Grant production runner

- Disposition: rejected and blocked.
- Reason: phases have distinct object authority and production authorization;
  neither can be inferred from the other.

### ALT-NSC-003 — Per-caller commit with partial success

- Disposition: rejected.
- Reason: it violates complete rollback and allows half-supplied production state.

### ALT-NSC-004 — Treat exact-looking drift as NOOP or repair it

- Disposition: rejected.
- Reason: only the complete closed state is NOOP; all other existing state needs
  independent reconciliation and fresh authority.

### ALT-NSC-005 — Print or pre-generate secrets for manual handoff

- Disposition: rejected.
- Reason: review and plan are non-secret phases; terminal/log/history capture is
  durable disclosure.

## 13. Migration, compatibility, and rollback

```text
MIGRATION_THIS_PR = NONE
COMPATIBILITY_CHANGE_THIS_PR = NONE
ROLLBACK_THIS_PR = close/revise Draft proposal; no production compensation
FUTURE_PHASE_A_ROLLBACK = owned only by Phase A authority
FUTURE_PHASE_B_ROLLBACK = CTR-NSC-011 and CTR-NSC-012
CROSS_PHASE_ROLLBACK = FORBIDDEN without future accepted authority
```

A Phase B rollback never removes, edits, or compensates the pre-existing Audience
row. A Phase A rollback must refuse while any Client/Grant reference exists and
is outside this Spec's implementation closure.

## 14. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 15. Frozen summary

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1
STATUS = accepted
GOVERNANCE_VEHICLE = AMEND_PROPOSED_SPEC
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = none
TARGET_COMMIT = 7110463636693b3c2eced9d97ccb186adf46907d
AUDIENCE_GRANT_PHASE_SEPARATION = REQUIRED_FAIL_CLOSED
FORUM_CLIENT_ID = mc_Ez8kTAKKvcf2pF40aoUM4q9M
WORKFLOW_CLIENT_ID = mc_uYu1fDfNHjzUlRQGJdTajz9n
EXACT_IMPLEMENTATION_CLOSURE_COUNT = 3
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
WIP_RUNNER = BLOCKED_UNCHANGED
INDEPENDENT_REVIEW = PASS
READY_FOR_IMPLEMENTATION = YES_AFTER_ACCEPTED_SPEC_MERGED_TO_MAIN
READY_FOR_PRODUCTION_APPLY = NO
NEXT_TASK = 注册 执行
```

## 16. Acceptance Record

```text
ACCEPTED_BY = mayf3
ACCEPTED_AT = 2026-08-30T16:50:31Z
INDEPENDENT_REVIEW = 注册 审计 = PASS
REVIEWED_BASE_COMMIT = 7110463636693b3c2eced9d97ccb186adf46907d
REVIEWED_SPEC_COMMIT = 8bfb767db16546449084a1ecfc8a9884ac343309
REVIEW_VERDICT = PASS
REQUIRED_FIXES = NONE
BLOCKERS = NONE
SPEC_PR = mayf3/auth-service#38
LIFECYCLE_DELTA = status: proposed -> accepted;
  implementation_authority: none -> contracts;
  production_apply_authority: none -> none
SEMANTIC_DELTA_AFTER_REVIEW = NONE
FINAL_ACCEPTED_HEAD = this lifecycle acceptance commit
  (a Git commit cannot embed its own SHA; the exact commit is the final PR head
  immediately before the merge commit recorded by GitHub)
PRODUCTION_APPLY_AUTHORITY = none
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

This acceptance transaction changes only lifecycle metadata, the matching
summary/index mirrors, and this Acceptance Record. Sections 1–14, including all
Decisions, Contracts, Acceptance criteria, phase separation, exact three-file
closure, rollback semantics, and the blocked WIP-runner boundary, retain the
reviewed meaning at `8bfb767db16546449084a1ecfc8a9884ac343309`.

`implementation_authority: contracts` becomes active only after this accepted
snapshot is merged into `main`, and authorizes only the exact closure frozen by
`CTR-NSC-006`. It does not authorize production APPLY, database connectivity,
Audience registration, Principal/Client/secret creation, or Grant writes.
