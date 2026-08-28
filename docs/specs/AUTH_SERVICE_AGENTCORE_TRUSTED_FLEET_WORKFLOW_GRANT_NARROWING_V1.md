---
spec_id: AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_WORKFLOW_GRANT_NARROWING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_WORKFLOW_GRANT_NARROWING_V1

> **PROPOSED — DOCS ONLY.** This Spec has `implementation_authority: none`.
> Authoring, acceptance, implementation merge, and production apply are distinct
> states. This PR authorizes no implementation, database write, Grant write,
> deployment, production apply, acceptance, or merge.

## 1. Goal

Authorize, only after independent review and Owner acceptance, a future bounded
implementation that narrows exactly two existing `svc-workflow`
`MachineAccessGrant` rows from `[workflow.execute, workflow.read]` to
`[workflow.read]`. The other 84 ready fleet rows and every non-target object
remain unchanged.

```text
TARGET_ROW_COUNT = 2
NON_TARGET_READY_ROW_COUNT = 84
NON_TARGET_WRITES = 0
FORUM_WRITES = 0
OTHER_AUDIENCE_WRITES = 0
EXPECTED_GRANT_VERSION = 2
RESULTING_GRANT_VERSION = 3
```

## 2. Scope and non-goals

### In scope

Only these exact rows are targets; no third Agent is in scope:

| Row | agent_id | client_id | audience | current scopes | target scopes | operation |
|---:|---|---|---|---|---|---|
| 1 | `agt_hr-agent` | `mc_IuBMfCYe9-b522IhSWKBGjyz` | `svc-workflow` | `[workflow.execute, workflow.read]` | `[workflow.read]` | `NARROW` |
| 2 | `agt_build-in-public-agent` | `mc_ohDTyGYRpBLI4qN_sVU88aob` | `svc-workflow` | `[workflow.execute, workflow.read]` | `[workflow.read]` | `NARROW` |

### Non-goals and forbidden effects

The future implementation MUST NOT delete or recreate a Grant, create a missing
Grant, add a scope, change an Audience, Principal, Client, credential, legacy
`allowedResources`/`allowedScopes`, Human Grant, Delegation Grant, Forum Grant,
other Audience Grant, any of the other 84 fleet Clients, or either original
parent canary. Automatic privilege re-expansion is forbidden.

This Spec does not modify its Parent or reinterpret the Parent's historical
current-state table. It records only the current state observed after Parent
execution.

## 3. Authority and dependencies

```text
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = AUTHOR
CHANGE_CLASS = NON_MECHANICAL
CLASSIFICATION = NEW
EXISTING_SUPPLY_AUTHORITY_SUFFICIENT_FOR_NARROWING = NO
NEW_BOUNDED_CHILD_REQUIRED = YES
IMPLEMENTATION_ALLOWED = NO
EVALUATED_BASE = d529bd3c28ece3967149ad793794f8dac2020276
```

The accepted Parent authorizes absent-to-create and exact-end-state NOOP, but
classifies any extra scope (including `workflow.execute`) as conflict and
expressly forbids narrowing. `MINIMAL_AUTH_FOUNDATION_V2` preserves exact
Grant, audit, optimistic-concurrency, and forward-only semantics. Therefore a
new bounded child is required; this child does not supersede or amend either
parent.

The independent mapping audit reports `MAPPING_REVIEW = PASS`,
`READY_FOR_AUTHORITY_AUTHORING = YES`, and no accepted authority granting
`workflow.execute` to either target. Audience registration describes available
vocabulary; it is not per-Client Grant authority.

## 4. Current State

### STATE-WGN-001 — Exact two-row overbroad state remains current

- Subject: the two target `svc-workflow` Machine Grants and identity links.
- As-of source base: `mayf3/auth-service@d529bd3c28ece3967149ad793794f8dac2020276`.
- Environment: production `agent_dev_center`, DB role `auth_ro`.
- Observed at: `2026-08-27T15:05:00.188764Z`.
- Basis: `OBS-WGN-001`, `OBS-WGN-002`, `EVD-WGN-001`.

Both rows have exact scopes `[workflow.execute, workflow.read]`, version `2`,
active Principal, active Client, exact Client→Principal→agent relationship
`MATCH`, and duplicate count `0`.

### STATE-WGN-002 — Plan classification is 84 ready and 2 narrow

- Subject: local owner-held canonical 86-row mapping plan.
- Artifact revision: SHA-256
  `68e3cb92ccd97f0b0a01eae648f467ea135f3820551197716c74315df0a8bfe0`.
- Environment: local authoring evidence; complete roster is not persisted in Git.
- Basis: `OBS-WGN-003`, `EVD-WGN-002`.

```text
TOTAL = 86
READY = 84
NARROW = 2
MISSING = 0
CONFLICT = 0
UNKNOWN = 0
```

## 5. Observations

### OBS-WGN-001 — Fresh SELECT-only two-row verification

- Subject: exact target Grants, Principals, Clients, relationships, and audit provenance.
- Source revision: production persisted state observed during authoring.
- Environment: `agent_dev_center`; `database_role=auth_ro`;
  `transaction_read_only=on`.
- Observed at: `2026-08-27T15:05:00.188764Z`.
- Method: SELECT-only transaction over the two exact public Client IDs, ended by `ROLLBACK`; no credential fields selected.
- Result: two exact rows, scopes `[workflow.execute, workflow.read]`, version `2`; both Principals and Clients active; exact relationships match; duplicate count `0`.
- Provenance: authoring-round fresh read-only receipt; database writes `0`.

### OBS-WGN-002 — Grant provenance is complete for both targets

- Subject: immutable accepted provenance audit rows for both target Clients.
- Method: read only the non-secret audit projection.
- Result: `2/2` create audits from
  `agentcore-trusted-fleet-grant-supply-v1` at source
  `5739cce4ad821e5766a29268ef904aa69b57384f`, ending at
  `[workflow.read]`, version `1`; and `2/2` replace audits from
  `agentcore-owner-wf-execute-grant-v1` at source
  `b5ab589d0aeaa7a28e04bd4e665d27317db0b2d7`, changing
  `[workflow.read]` to `[workflow.execute, workflow.read]`, version `1 → 2`.
  The non-secret reason was a minimal grant to two DOMAIN_OWNER Clients to
  unblock Workflow Assistance resolution.
- Provenance: same fresh read-only receipt; credential fields read `0`.

### OBS-WGN-003 — Canonical plan and independent audit are stable

- Subject: local canonical mapping plan and independent audit report.
- Source revisions: mapping plan SHA-256
  `68e3cb92ccd97f0b0a01eae648f467ea135f3820551197716c74315df0a8bfe0`;
  dependency plan SHA-256
  `931e53f26a57409ba8936838c65130462787dc10cbe1b0b0b8259f6c705fd906`.
- Method: SHA-256 verification, structural count validation, and full independent audit review.
- Result: `TOTAL=86`, `READY=84`, `NARROW=2`, all other classes `0`;
  current accepted capability requires `workflow.read`, current
  `workflow.execute` dependency `NONE`, accepted authority conflict `NONE`.
- Provenance: local owner-held canonical plan and independent
  `MAPPING_AUDIT_REPORT.md`; the complete 86-row roster remains outside Git.

## 6. Claims and assumptions

### CLM-WGN-001 — The two rows are overbroad relative to accepted need

- Support state: SUPPORTED.
- Supported by evidence: `EVD-WGN-001`, `EVD-WGN-002`.
- Contradicted by evidence: none known.
- Uncertainty: future dependency or authority changes require a new plan and Owner decision; they do not change this frozen target silently.

### CLM-WGN-002 — Parent supply authority cannot perform the narrowing

- Support state: SUPPORTED.
- Supported by evidence: accepted Parent conflict/narrowing prohibition and `EVD-WGN-002`.
- Contradicted by evidence: none known.
- Uncertainty: none at the evaluated base.

## 7. Evidence relations

### EVD-WGN-001 — Fresh DB observations support exact current state

- Source observations: `OBS-WGN-001`, `OBS-WGN-002`.
- Target: `STATE-WGN-001`, `CLM-WGN-001`.
- Relation: SUPPORTS.
- Bound coordinates: production `agent_dev_center`, `auth_ro`, observed `2026-08-27T15:05:00.188764Z`.
- Strength/sufficiency: exact for the two rows, versions, status, relationship, duplicate count, and provenance projection.
- Limitations: apply-time state must be revalidated transactionally.
- Provenance: authoring-round read-only receipt.

### EVD-WGN-002 — Plan and authority audit support bounded direction

- Source observations: `OBS-WGN-003`.
- Target: `STATE-WGN-002`, `CLM-WGN-001`, `CLM-WGN-002`.
- Relation: SUPPORTS.
- Bound coordinates: plan digests above; repository base `d529bd3c28ece3967149ad793794f8dac2020276`.
- Strength/sufficiency: exact for counts, two targets, dependency direction, and accepted-authority inventory.
- Limitations: does not itself authorize implementation or production apply.
- Provenance: local canonical plan and complete independent audit report.

## 8. Decisions

### DEC-WGN-001 — Narrow exactly two rows atomically

- Decision owner: `mayf3` upon future acceptance.
- Decision: the only permitted Grant transition is exact scopes
  `[workflow.execute, workflow.read] → [workflow.read]` and version `2 → 3`
  for both §2 rows in one serializable transaction.
- Rejected alternative: one-row-at-a-time success or fleet-wide reconciliation.
- Reason: least privilege and no partial fleet authority state.

### DEC-WGN-002 — Same-transaction immutable replace audits

- Decision owner: `mayf3` upon future acceptance.
- Decision: each changed row receives one immutable `grant_change_audits`
  `replace` record in the same transaction, expected version `2`, resulting
  version `3`, with complete before/after client Grant snapshots.
- Rejected alternative: fragment audit, post-commit audit, delete/recreate, or audit repair.
- Reason: preserve existing Grant concurrency and audit semantics.

### DEC-WGN-003 — Forward-only rollback

- Decision owner: `mayf3` upon future acceptance.
- Decision: no automatic privilege re-expansion. A real future need for
  `workflow.execute` requires new dependency evidence, a new Owner decision,
  and new accepted authority.
- Rejected alternative: treating the old overbroad state as a rollback target.
- Reason: rollback must not silently restore excess privilege.

### DEC-WGN-004 — Exact future implementation closure

- Decision owner: `mayf3` upon future acceptance.
- Decision: future implementation may change exactly the three files in
  `CTR-WGN-008`; any fourth file requires a new Owner decision.
- Rejected alternative: schema, runtime, package, Contract Bundle, Audience
  registry, or Parent-Spec edits.
- Reason: keep the implementation independently reviewable and bounded.

## 9. Contracts

### CTR-WGN-001 — Exact closed plan and privacy binding

The implementation MUST bind both input digests from `OBS-WGN-003`; require the
static owner-held plan to contain `TOTAL=86`, `READY=84`, `NARROW=2`, and all
other classifications `0`; and target exactly the two §2 tuples. Live apply
classification is a separate state machine: first apply requires the 84
non-target rows ready plus both targets in the exact pre-state; exact rerun
requires the same 84 non-target rows ready plus both targets in the exact
post-state of `CTR-WGN-006`. A mixed pre/post target state is conflict, never a
new plan. The implementation MUST NOT persist or publish the full 86-Agent
roster, credential-store paths, database connection information, or other 84
public Client IDs. A static-plan digest/count mismatch or an invalid live-state
classification MUST fail before writes with Grant and audit writes `0`.

### CTR-WGN-002 — Exact preconditions and plan-before-mutation

The implementation MUST validate both rows before the first write. In both the
mutation and NOOP paths, each row must exist exactly once; resolve to the exact
active Client and active/non-disabled Principal; preserve the exact
Client→Principal→agent relationship; and have Audience `svc-workflow`.
It MUST then classify the two targets together as exactly one of:

1. `PRE_STATE`: both have scopes `[workflow.execute, workflow.read]`, version
   `2`, and exact `agentcore-owner-wf-execute-grant-v1` provenance; only this
   state may enter the mutation path; or
2. `POST_STATE`: both satisfy every exact Grant and narrowing-audit condition in
   `CTR-WGN-005` and `CTR-WGN-006`; this state MUST return NOOP before mutation.

Missing, duplicate, inactive, disabled, revoked, relationship, Audience, mixed
pre/post state, non-exact scope/version/provenance, or plan drift MUST fail
closed with all writes `0`.

### CTR-WGN-003 — Only permitted Grant changes

The only permitted database changes are UPDATE of the two existing target
`MachineAccessGrant` rows: scopes to `[workflow.read]` and version `2 → 3`.
The implementation MUST NOT delete, insert, recreate, create-missing, add scope,
or modify any other Grant field or object. The 84 non-target rows MUST remain
row/byte equivalent; Forum and every other Audience writes MUST be `0`.

### CTR-WGN-004 — Both rows in one serializable transaction

```text
PLAN_ALL_ROWS_BEFORE_FIRST_WRITE = YES
APPLY_ATOMICITY = BOTH_ROWS_IN_ONE_SERIALIZABLE_TRANSACTION
PARTIAL_SUCCESS = FORBIDDEN
```

Both conditional updates and both audits MUST commit together or all roll back.
A concurrent update, conditional-update count mismatch, audit failure, or final
verification mismatch MUST produce Grant writes `0` and audit writes `0` as the
committed result. One-row success is forbidden.

### CTR-WGN-005 — Same-transaction immutable audit envelope

For each changed Client, the transaction MUST add exactly one immutable
`grant_change_audits` row with:

```text
migration_id = agentcore-trusted-fleet-workflow-grant-narrowing-v1
client_id = the exact §2 public Client ID
change_type = replace
expected_grant_version = 2
resulting_grant_version = 3
reason = remove unneeded workflow.execute from two trusted-fleet workflow grants
source_git_commit = the clean reviewed implementation HEAD
operator_id = the authenticated production operator identity
approval_ref = the explicit Owner production-apply authorization receipt
before_value / after_value = complete client Grant snapshots
```

The snapshots MUST differ only in target `svc-workflow` scopes and aggregate
version. The remaining closed-envelope fields (`id`, `timestamp`) MUST be valid
new immutable audit identities generated at apply. Audit data MUST NOT contain
credentials, hashes, tokens, passwords, or database connection data.

### CTR-WGN-006 — Exact rerun is NOOP; conflicts remain fail-closed

After successful apply, if all 84 non-target rows remain ready and both targets
have exact `[workflow.read]`, version `3`, and exactly one audit each whose full
frozen fields and complete snapshots match `CTR-WGN-005`, rerun MUST return
`NOOP` with Grant writes `0` and audit writes `0`. The static owner-held plan
remains the same `84 READY / 2 NARROW` intent artifact; live post-state is
`84 non-target READY + 2 exact target POST_STATE`, not a re-authored plan or a
conflict. Any mixed pre/post state, missing or duplicate audit, audit envelope
drift, version drift, or non-exact scopes is conflict with committed writes
`0`; it MUST NOT repair partial state automatically.

### CTR-WGN-007 — Non-target identity, credential, legacy, and Grant invariants

The implementation MUST NOT modify any Principal, Client, credential,
credential store, `allowedResources`, `allowedScopes`, Human/Delegation Grant,
Forum Grant, other Audience, other 84 fleet Client, or either Parent canary.
It MUST use only the minimum non-secret read projection needed for validation.

### CTR-WGN-008 — Exact three-file implementation closure

Future implementation changes MUST be exactly:

```text
scripts/narrow-agentcore-trusted-fleet-workflow-grants-v1.ts
scripts/run-agentcore-trusted-fleet-workflow-grant-narrowing-v1-conformance.sh
tests/oauth/narrow-agentcore-trusted-fleet-workflow-grants-v1.test.ts
```

It MUST NOT modify a fourth file, including `prisma/**`, `src/**`,
`package.json`, `package-lock.json`, Contract Bundle, Audience registry, or any
governing Parent Spec. A fourth file requires a new Owner decision.

### CTR-WGN-009 — Token end-state and no privilege re-expansion

Qualified post-apply evidence MUST show that each exact Client can receive
`workflow.read` and is not granted `workflow.execute`. The implementation MUST
NOT automatically add `workflow.execute` back. Re-expansion requires new
current dependency evidence, a new Owner decision, and new accepted authority.

### CTR-WGN-010 — Lifecycle and production-apply separation

```text
SPEC_ACCEPTED = not implementation completed
IMPLEMENTATION_MERGED = not production applied
PRODUCTION_APPLY_AUTHORITY = none in this authoring PR
```

The required order is: independent Child-Spec review → Owner acceptance → merge
→ implementation Draft PR → independent implementation review → merge →
read-only production plan → explicit Owner production-apply authorization →
apply → post-apply audit. No earlier step implies a later one.

## 10. Acceptance

Unless an item narrows it further, every `ACC-WGN-*` uses these coordinates:

```text
ENVIRONMENT = isolated PostgreSQL conformance fixture at the reviewed implementation HEAD;
              production only for the separately authorized read-only plan and
              post-apply token/audit evidence
REQUIRED_EVIDENCE = executed command and timestamp; implementation HEAD;
                    fixture/config digest; redacted result; Grant/audit write counts;
                    Contract result; and reviewer identity
PRIVACY = evidence output contains only counts, digests, and the two §2 targets;
          full-table/full-roster values and the other 84 Client IDs are neither
          emitted nor persisted
```

A test definition alone is not evidence; acceptance requires an executed result
at the named coordinates.

### ACC-WGN-001 — Exact target and plan binding
- Contracts: `CTR-WGN-001`, `CTR-WGN-002`.
- Method: fixture plan/digest tests plus exact two-row assertion.
- Expected: counts `86/84/2/0/0/0`, two exact tuples only; digest mismatch writes `0`.
- Failure: any third target, roster publication, or mismatch accepted.

### ACC-WGN-002 — Preconditions and relationship matrix
- Contracts: `CTR-WGN-002`.
- Method: tests for row missing/duplicate, inactive Client, revoked Client, inactive/disabled Principal, relationship mismatch, Audience mismatch, scopes mismatch, version mismatch, provenance drift.
- Expected: every case fails before mutation with Grant/audit writes `0`.
- Failure: any case writes or is repaired.

### ACC-WGN-003 — Exact two-row mutation and non-target equivalence
- Contracts: `CTR-WGN-003`, `CTR-WGN-007`.
- Method: in-memory before/after digests and write tripwires over complete fixture tables; non-target raw projections MUST NOT be emitted or persisted.
- Expected: exactly two scopes/version changes; 84 non-target rows and all forbidden objects row/byte equivalent; Forum/other Audience writes `0`; evidence exposes only counts/digests and the two target IDs.
- Failure: any extra write, create, delete, identity, credential, or legacy access/mutation, or disclosure/persistence of non-target raw identities.

### ACC-WGN-004 — Plan-before-write and atomicity
- Contracts: `CTR-WGN-004`.
- Method: static sequencing assertion and PostgreSQL serializable integration test with failure injected after the first conditional update.
- Expected: both rows and audits commit together or committed writes are `0`.
- Failure: partial success or planning after mutation begins.

### ACC-WGN-005 — Immutable same-transaction audits
- Contracts: `CTR-WGN-005`.
- Method: audit insert failure injection and exact envelope comparison.
- Expected: two exact complete-snapshot replace audits; failure rolls back both Grants and audits.
- Failure: fragment, post-transaction, secret-bearing, missing, or extra audit.

### ACC-WGN-006 — Exact rerun NOOP and conflict handling
- Contracts: `CTR-WGN-006`.
- Method: successful apply then exact rerun; separately test mixed state, missing/duplicate audit, envelope/version/scope drift.
- Expected: exact rerun NOOP with writes `0`; every non-exact case conflict with committed writes `0`.
- Failure: rerun conflict, extra audit, last-write-wins, or automatic repair.

### ACC-WGN-007 — Concurrency conflict
- Contracts: `CTR-WGN-004`, `CTR-WGN-006`.
- Method: concurrent writer changes either target between plan and conditional apply.
- Expected: serialization/optimistic conflict and committed Grant/audit writes `0`.
- Failure: overwrite or one-row commit.

### ACC-WGN-008 — Post-apply token evidence and forward-only rollback
- Contracts: `CTR-WGN-009`.
- Method: real Client token mint/request evidence for each target plus rollback-path review.
- Expected: `workflow.read` allowed; `workflow.execute` not granted; no automatic privilege re-expansion path.
- Failure: execute remains granted or old overbroad state is an automatic rollback target.

### ACC-WGN-009 — Exact implementation closure
- Contracts: `CTR-WGN-008`.
- Method: three-dot diff file-list audit.
- Expected: exactly the three named files and no forbidden path.
- Failure: any fourth file.

### ACC-WGN-010 — Lifecycle and production authorization gate
- Contracts: `CTR-WGN-010`.
- Method: PR/acceptance/implementation/apply record audit.
- Expected: each ordered gate has independent immutable evidence; production apply has explicit Owner authorization after read-only plan.
- Failure: acceptance interpreted as implementation completion, merge interpreted as apply, or apply without separate authorization.

### Contract → Acceptance coverage

| Contract | Acceptance coverage | Covered |
|---|---|---|
| `CTR-WGN-001` | `ACC-WGN-001` | YES |
| `CTR-WGN-002` | `ACC-WGN-001`, `ACC-WGN-002` | YES |
| `CTR-WGN-003` | `ACC-WGN-003` | YES |
| `CTR-WGN-004` | `ACC-WGN-004`, `ACC-WGN-007` | YES |
| `CTR-WGN-005` | `ACC-WGN-005` | YES |
| `CTR-WGN-006` | `ACC-WGN-006`, `ACC-WGN-007` | YES |
| `CTR-WGN-007` | `ACC-WGN-003` | YES |
| `CTR-WGN-008` | `ACC-WGN-009` | YES |
| `CTR-WGN-009` | `ACC-WGN-008` | YES |
| `CTR-WGN-010` | `ACC-WGN-010` | YES |

Every Acceptance item references existing Contracts, and every Contract has
Acceptance coverage in the table above.

## 11. Alternatives and disposition

### ALT-WGN-001 — Reuse Parent supply authority
- Disposition: rejected.
- Reason: Parent explicitly forbids narrowing and treats extra scopes as conflict.

### ALT-WGN-002 — Narrow one row per transaction
- Disposition: rejected.
- Reason: permits partial success and an inconsistent authority state.

### ALT-WGN-003 — Automatically restore workflow.execute on regression
- Disposition: rejected.
- Reason: silently re-expands privilege without current evidence or authority.

## 12. Migration, compatibility, and rollback

```text
SCHEMA_MIGRATION = NONE
COMPATIBILITY = workflow.read remains the accepted required capability
ROLLBACK = FORWARD_ONLY_NEW_AUTHORITY_REQUIRED
AUTOMATIC_PRIVILEGE_REEXPANSION = FORBIDDEN
```

No schema, Contract Bundle, Audience registry, Principal, Client, credential, or
legacy-field migration is authorized. If real business need for
`workflow.execute` appears after narrowing, new dependency evidence → new Owner
decision → new accepted authority is mandatory.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE FOR INDEPENDENT REVIEW OF THIS PROPOSAL
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
```

Independent semantic review of the exact Spec commit is the next step. Only an
authorized Owner may later perform lifecycle acceptance; this authoring PR does
not do so.
