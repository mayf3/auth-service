# Canonical Subject Enrollment Implementation ExecPlan

Goal: implement the accepted canonical-subject enrollment and prospective source-
binding management surface without applying it to production.

Authority: `AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1`,
accepted on `main@af285a78582c050100ed0d234a98c8bd77910f2c`; reviewed semantic body
`4714fa0d814c870f0ac14a393d80fc885d8192b1`.

## Development preflight

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/auth-service
REVIEW_TARGET_HEAD = NOT_APPLICABLE
BASE_HEAD = af285a78582c050100ed0d234a98c8bd77910f2c
CURRENT_BASE_HEAD = af285a78582c050100ed0d234a98c8bd77910f2c
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = implement and merge the accepted child Contract source closure
CURRENT_GAP = accepted persistence, validation and controlled command contracts have no implementation
OBSERVATIONS = accepted child has implementation_authority=contracts; foundation DDL and read library are present; production_apply_authority=none; baseline identity tests 15/15 and repository tests 48/48 pass; baseline build has the pre-existing unrelated forum-direct-agent-token.ts:142 TS2322
WORKING_GUESS = NOT_APPLICABLE
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1@af285a78582c050100ed0d234a98c8bd77910f2c
RELATED_AUTHORITIES = AUTH_SERVICE_AGENT_IDENTITY_CANONICALIZATION_PROGRAM_V1; AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1; MINIMAL_AUTH_FOUNDATION_V2
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
BASE_IMPACT = NONE
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO
OPERATION_ALLOWED = NO
PRODUCTION_APPLY_ALLOWED = NO
EVIDENCE_NEEDED = red/green unit tests; isolated PostgreSQL DDL, rollback, concurrency and receipt evidence; differential typecheck; independent affected-Contract review
DONE_WHEN = accepted Contracts are implemented, conformance passes, independent review has zero ship blockers, exact reviewed Head is merged, and fresh main readback proves no production mutation
EXPANSION_TRIGGER = new product choice, accepted-Contract conflict, production mutation, or relevant main drift
NEXT_REAL_ACTION = implement the source-only controlled vehicle and conformance suite
NEXT_ACTION = CONTINUE
```

## Hard boundaries

- Source implementation only. No production DDL, database write, enrollment,
  source migration, Principal/credential/Grant mutation, retirement or deployment.
- Reuse `agent_identity_lifecycle`, `agent_identity_successors` and the existing
  identity advisory-lock domain. Never alter the foundation migration bytes.
- No public HTTP route, runtime legacy lookup, name/role/grammar/UUID inference,
  automatic backfill or permanent compatibility table.
- Disposable PostgreSQL tests own a fresh private cluster and destroy it after use.
- The existing unrelated `forum-direct-agent-token.ts:142` TS2322 is recorded as
  baseline and is outside this exact file closure. Typecheck conformance requires
  the candidate diagnostic set to add no error relative to this base.

## Exact file closure

Allowed implementation files:

```text
docs/plans/2026-09-16-canonical-subject-enrollment-implementation.md
prisma/schema.prisma
prisma/migrations/202609160001_canonical_subject_enrollment/migration.sql
src/lib/oauth/v1/canonical-subject-enrollment.ts
scripts/canonical-subject-enrollment.ts
tests/oauth/canonical-subject-enrollment.test.ts
tests/oauth/canonical-subject-enrollment-postgres.test.ts
package.json
docs/audits/AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_IMPLEMENTATION_V1_REPORT.md
```

No other file may change without re-running PREFLIGHT and amending this plan before
the change.

## Task 1 — Persistence and database invariants

1. Write a disposable-PostgreSQL RED test that applies the foundation followed by
   the child migration and asserts the accepted enum/table/FK/check/unique/trigger
   surface, empty install, append preservation and shared SERIALIZABLE lock domain.
2. Cover typed target shapes, immutable fields, at-most-one active attestation,
   delegation exact actor/scope/expiry/revocation, source supersession versus exit,
   terminal states, manifest cardinality and audit immutability.
3. Add Prisma models/relations and one forward-only migration. Do not modify any
   historical migration.
4. Run the Pg test to GREEN.

## Task 2 — Deterministic packet and validation library

1. Write unit RED tests for strict unknown-field rejection, stable canonical bytes
   and digest, duplicate mutation keys/target IDs/logical source keys, typed AGENT/HUMAN/SERVICE target checks, actor versus
   authority, operation/disposition matching and the 73/89/147 capacity fixture.
2. Implement closed packet/result/error types. Canonicalization sorts only fields
   declared unordered by the packet contract and never normalizes identity values.
3. Use injected exact authority and Core evidence verifiers; no label discovery is
   part of target resolution.
4. Run focused unit tests to GREEN.

## Task 3 — PLAN, APPLY, lifecycle matrix and source binding transitions

1. Add RED tests for read-only deterministic PLAN, expiry, expected revisions and
   canonical per-mutation authority manifest.
2. Add Pg RED tests for one SERIALIZABLE transaction, stale prestate, lock timeout,
   serialization failure, atomic audit rollback, heterogeneous authority manifests,
   exact replay NOOP and changed-digest idempotency conflict.
3. Implement APPLY as one attempt with no retry. Revalidate targets, exact authority,
   delegation revision/status/scope/time, Core evidence and prestate after acquiring
   the shared identity lock.
4. Implement the closed Agent lifecycle transition matrix. Exercise five separate
   `legacy -> retired` negative cases, each omitting one CTR-AICP-007 predicate.
5. Implement source-binding transitions so live bindings may be superseded without
   claiming EXITED; EXIT requires exact zero-live evidence; superseded/exited cannot
   resurrect.

## Task 4 — IMPORT / PLAN / APPLY / VERIFY command vehicle

1. Add a non-network CLI with explicit `import|plan|apply|verify` commands and JSON
   file/stdout boundaries. Diagnostics expose closed codes and safe record keys only.
2. `import` is offline. `plan` is read-only. `apply` requires an exact unexpired
   reviewed plan. `verify` performs fresh consistent readback and emits a sanitized
   receipt. None is a server route or automatic startup path. Direct process
   invocation cannot accept caller-authored files as authority: controlled
   `plan|apply|verify` requires an independently trusted evidence provider injected
   by an authorized host integration and otherwise fails closed.
3. Reconcile `OUTCOME_UNKNOWN` only by the same operation ID plus exact operation
   row and poststate; never replay an unknown attempt.

## Task 5 — Conformance, review and merge

1. Run unit tests, disposable PostgreSQL conformance, existing canonical identity
   regressions, Prisma validate/generate, governance integrity and secret scan.
2. Run build/typecheck and compare diagnostics with the exact base. Any new error is
   a blocker; the one inherited TS2322 remains explicitly outside this Goal.
3. Record exact commands, revisions, results and limitations in the implementation
   report. Self-review the exact file closure and Contract/Acceptance mapping.
4. Commit an exact candidate and dispatch a non-author independent implementation
   review. Repair candidate-local blockers with fresh tests and re-review.
5. If review PASS, ship blockers zero and main has no relevant drift, merge the exact
   reviewed Head. Fresh-read remote main and rerun source-level smoke/conformance.
