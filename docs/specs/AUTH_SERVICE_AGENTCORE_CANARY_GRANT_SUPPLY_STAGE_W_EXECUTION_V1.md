---
spec_id: AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_STAGE_W_EXECUTION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V1
  - AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_STAGE_W_EXECUTION_V1

## 1. Goal and authority relationship

Freeze the implementation-only coordinates that the accepted
`AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` intentionally did not select:
the exact Stage W executable path, exclusive implementation file set, isolated
PostgreSQL conformance procedure, and closed apply-evidence input.

This Spec is a new, subordinate authority. It does not amend, supersede, narrow,
or reinterpret the accepted parent. The parent owns every Stage W identity,
Grant, Scope, revision, transaction, audit, idempotency, conflict, operational,
rollback, Stage F, and production-apply obligation. If this Spec conflicts with
the parent, the parent wins and implementation stops.

```text
PARENT_SPEC = AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1
PARENT_SPEC_BLOB = d89bf08c8714f55571ee7d75da017b7cf7237096
AUTHORING_BASE = cb0b3d37dfb105c763c9c83ebd65483270b21b81
AUTHORITY_ACTION = NEW
STAGE_W_ONLY = YES
STAGE_F_IMPLEMENTATION_AUTHORIZED = NO
PRODUCTION_MIGRATION_APPLY_AUTHORIZED = NO
PRODUCTION_DB_WRITE_AUTHORIZED = NO
```

## 2. Scope and non-goals

### In scope

- Select one exact repository-versioned offline Stage W executable path.
- Freeze the exclusive implementation and conformance file set.
- Define an isolated temporary PostgreSQL replay that exercises every existing
  production migration SQL file, including raw-SQL constraints and immutable
  audit triggers.
- Close the structured evidence input used by the parent's existing Stage W
  apply prerequisite without adding any audit field.

### Out of scope

- Any change to the accepted parent Spec or its stable IDs.
- Stage F, `svc-forum`, rollback implementation, `workflow.execute`,
  `forum.admin`, `forum.moderate`, wildcard, or any other identity, Audience,
  Scope, or Grant.
- Prisma schema, Prisma production migration, Contract Bundle, audit schema,
  package manifest, dependency, reusable library, route, CLI command,
  production configuration, receipt, deployment, production DB apply, or real
  Grant creation.
- Reading or writing `allowedResources` or `allowedScopes`.

## 3. State and observations

### STATE-SWX-001 — Parent behavior is complete but execution coordinates are absent

At `main@cb0b3d37dfb105c763c9c83ebd65483270b21b81`, the accepted parent
fully freezes Stage W behavior but names no exact new executable path, exclusive
implementation file set, temporary PostgreSQL lifecycle, or machine-readable
shape for its durable apply evidence. Basis: `OBS-SWX-001` and `EVD-SWX-001`.

### STATE-SWX-002 — Fresh migration replay has a historical data prerequisite

At the same source coordinate, the final production migration in lexical order
expects a fixed CEO Principal, Client, `svc-workflow` Audience, and workflow
Grant that no earlier production migration creates. Plain fresh
`prisma migrate deploy` therefore cannot reach the final schema. Basis:
`OBS-SWX-002` and `EVD-SWX-002`.

### OBS-SWX-001 — Repository execution surfaces

- Source: accepted parent; `scripts/backfill-minimal-auth-v1.ts`;
  `scripts/run-obo-conformance.sh`; `package.json`.
- Coordinate: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`.
- Method: inspect exact paths, transaction patterns, test scripts, and existing
  dependencies.
- Result: `tsx`, Prisma, Ajv, and shell PostgreSQL tools are sufficient without
  changing `package.json`; the broad backfill is forbidden because it reads
  Legacy flat fields; a dedicated executable and disposable-DB harness are
  required.

### OBS-SWX-002 — Production migration-chain replay prerequisite

- Source: all `prisma/migrations/*/migration.sql`, especially
  `20260722000100_ceo_client_okr_write_grant/migration.sql`.
- Coordinate: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`.
- Method: inspect migration order and fail-loud predicates.
- Result: after migrations through `20260721000300_add_request_digest`, the
  final migration requires Principal
  `b6b033c4-90ba-40aa-a338-304da442cab7`, Client
  `mc_HLxfspbjzHEdXmiiX3Gk7D27`, and its exact `svc-workflow` Grant; absent
  fixture rows cause an exception. The final migration also verifies that Grant.

### OBS-SWX-003 — Audit and identity structures already exist

- Source: `prisma/schema.prisma`,
  `prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql`, and
  `contract-bundles/minimal-auth-v1/schemas/grants.schema.json`.
- Coordinate: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`.
- Method: inspect unique external refs, composite Grant key, audit unique key,
  immutable triggers, and JSON schemas.
- Result: no schema or Contract Bundle change is required; the current bundle
  supplies the closed 13-field audit envelope and nine-field `clientGrants`.

## 4. Claims and evidence

### CLM-SWX-001 — Three files are sufficient

- Support state: SUPPORTED.
- Supported by: `EVD-SWX-001`, `EVD-SWX-003`.
- Claim: one executable, one real-DB test, and one disposable-DB harness can
  implement and verify the parent without modifying any existing artifact.

### CLM-SWX-002 — Ordered SQL replay with a disposable compatibility fixture is viable

- Support state: SUPPORTED.
- Supported by: `EVD-SWX-002`.
- Claim: applying all production SQL files in order, pausing immediately before
  the historical CEO migration to seed only its exact prerequisite fixture, then
  applying that final SQL exercises the complete production DDL and raw-SQL
  controls without changing production migration history.

### EVD-SWX-001

- Source observations: `OBS-SWX-001`.
- Target: `STATE-SWX-001`, `CLM-SWX-001`; relation: SUPPORTS.
- Strength: direct source inventory at the pinned base.
- Limitation: does not itself prove runtime conformance.

### EVD-SWX-002

- Source observations: `OBS-SWX-002`.
- Target: `STATE-SWX-002`, `CLM-SWX-002`; relation: SUPPORTS.
- Strength: direct predicates in the production migration SQL.
- Limitation: the compatibility fixture is test-only and has no production
  authority.

### EVD-SWX-003

- Source observations: `OBS-SWX-003`.
- Target: `CLM-SWX-001`; relation: SUPPORTS.
- Strength: direct schema and bundle structure.
- Limitation: conformance still requires executed temporary-DB evidence.

## 5. Decisions

### DEC-SWX-001 — Exact executable and exclusive file set

- Decision owner: `mayf3` or delegated auth-service maintainer.
- Decision: the sole Stage W executable path is:

  ```text
  scripts/supply-agentcore-canary-workflow-grants-v1.ts
  ```

  The complete implementation diff is limited to exactly these three new files:

  ```text
  scripts/supply-agentcore-canary-workflow-grants-v1.ts
  tests/oauth/supply-agentcore-canary-workflow-grants-v1.test.ts
  scripts/run-agentcore-canary-workflow-grants-v1-conformance.sh
  ```

- Rejected: Prisma data migration SQL, broad backfill reuse, generic Grant
  library, package script, dependency, online route or command, and any fourth
  file.
- Reason: close the review surface while preserving all parent boundaries.

### DEC-SWX-002 — Exact temporary PostgreSQL replay

- Decision owner: same as `DEC-SWX-001`.
- Decision: the conformance shell creates a uniquely prefixed disposable
  PostgreSQL database and always drops it by trap. It executes every checked-in
  production `migration.sql` in lexical order with `psql -v ON_ERROR_STOP=1`.
  Immediately before
  `20260722000100_ceo_client_okr_write_grant/migration.sql`, it inserts a
  test-only compatibility fixture containing exactly the fixed CEO Principal,
  fixed CEO Client, exact active `svc-workflow` Audience, and exact
  `svc-workflow=[workflow.read,workflow.execute]` Grant required and verified by
  that historical migration. It then executes the final migration and verifies
  that `grant_change_audits` constraints and immutable audit triggers exist.
  Only after this full replay may it execute the authorized Stage W test.
- Rejected: `prisma db push`, skipping the historical migration, modifying old
  migration SQL, retaining the fixture database, or using any non-temporary DB.
- Reason: exercise actual production DDL while accommodating a historical data
  prerequisite that is descriptive, not reusable product authority.

### DEC-SWX-003 — Closed SHA-bound apply-evidence input

- Decision owner: same as `DEC-SWX-001`.
- Decision: read-only plan requires no operational evidence file. Explicit
  `--apply` additionally requires `--evidence-file <path>` naming UTF-8 JSON
  with `additionalProperties: false` and exactly:

  ```text
  schema_version: integer exactly 1
  phase_a_merge_ref: non-empty string
  identity_receipts: array of exactly 2 objects, each additionalProperties=false:
    client_external_ref: non-empty string
    principal_external_ref: non-empty string
    receipt_ref: non-empty string
  readiness: string exactly READY
  readiness_ref: non-empty string
  migration_review: object, additionalProperties=false:
    verdict: string exactly PASS
    reviewed_source_git_commit: lowercase 40-hex string
    review_ref: non-empty string
  ```

  The two receipt identity pairs must equal the parent's two deterministic pairs
  exactly, with no duplicate or extra pair. The executor also requires an empty
  `git status --porcelain --untracked-files=all`, resolves `HEAD`, and proves it
  equals both mandatory audit `source_git_commit` and the reviewed commit before
  any DB write. Evidence coordinates never enter audit JSON.
- Rejected: environment booleans as evidence, unknown properties, empty or
  non-string references, alternate identities, dirty tree, SHA mismatch, or
  extending the audit envelope.
- Reason: make the parent's existing operational prerequisite deterministic
  without changing its meaning or audit schema.

## 6. Contracts

### CTR-SWX-001 — Artifact boundary is exact

Implementation changes exactly the three new files in `DEC-SWX-001`; any other
changed path is unauthorized. The executable remains read-only unless explicit
`--apply` and all parent and local gates pass.

### CTR-SWX-002 — Temporary DB conformance is complete and disposable

The harness implements `DEC-SWX-002`, rejects a non-generated database name,
applies every production SQL migration exactly once in lexical order, verifies
raw-SQL audit protections, runs the real executable through the real test, and
drops the database on success, failure, or interruption. Fixture writes are
strictly limited to the disposable database.

### CTR-SWX-003 — Apply evidence is closed and fail-before-write

Every type, cardinality, exact value, identity pair, cleanliness, and SHA rule in
`DEC-SWX-003` is mandatory. Missing, extra, empty, null, numeric, malformed,
duplicate, mismatched, dirty, or drifted evidence fails loudly before Grant or
audit writes. Read-only plan does not require this evidence.

### CTR-SWX-004 — Parent conformance is mandatory and unchanged

The implementation must satisfy every applicable parent Contract and Acceptance
item for Stage W, including exact identities, only two
`svc-workflow=[workflow.read]` rows, no Legacy data flow, serializable
all-clients transaction, per-client audit-derived revision, closed 13-field
create audits with complete snapshots, exact rerun no-op, conflict rollback, and
non-target row equivalence. This Spec grants no exception or replacement.

## 7. Acceptance

### ACC-SWX-001 — Exact diff

- Contracts: `CTR-SWX-001`.
- Method: diff implementation base to implementation head.
- Expected: exactly the three paths in `DEC-SWX-001`, all new.
- Failure: any missing, renamed, modified-existing, or fourth file.

### ACC-SWX-002 — Full temporary PostgreSQL replay

- Contracts: `CTR-SWX-002`.
- Method: run the conformance shell from a clean implementation commit against a
  local PostgreSQL administrative connection.
- Expected: generated prefixed DB; every production SQL migration executed in
  order; compatibility fixture inserted only at the frozen seam; final migration
  succeeds; audit constraints/triggers verified; Stage W real-DB tests pass; DB
  absent after exit.
- Failure: `db push`, skipped SQL, retained DB, non-temporary target, absent
  trigger/constraint, or any production/external DB write.

### ACC-SWX-003 — Evidence rejects every malformed variant

- Contracts: `CTR-SWX-003`.
- Method: exercise missing/additional fields; empty, null, numeric, and wrong-type
  refs including every `receipt_ref`; wrong array size; duplicate/alternate
  identity; readiness other than `READY`; verdict other than `PASS`; malformed,
  uppercase, or mismatched SHA; dirty/untracked tree; and one exact valid fixture.
- Expected: every invalid apply fails before writes; valid evidence proceeds to
  the parent state machine; plan remains read-only without evidence.
- Failure: any invalid variant reaches DB mutation or any evidence property enters
  `grant_change_audits`.

### ACC-SWX-004 — Parent Stage W acceptance remains complete

- Contracts: `CTR-SWX-004` and all applicable parent Contracts.
- Method: temporary PostgreSQL test covers two present Clients, either missing
  Client, exact Scope, explicit `workflow.execute` rejection, exact rerun,
  existing conflict, audit failure, concurrent conflict, Legacy-field access
  counters/snapshots, and non-target row-equivalence.
- Expected: success creates exactly two Grants and two valid audits; every failure
  path writes zero; rerun writes zero; no forbidden or non-target delta.
- Failure: any divergence from the accepted parent.

## 8. Compatibility, operations, and review boundary

```text
LEGACY_FIELDS_TOUCHED = NO
PRISMA_SCHEMA_CHANGED = NO
PRODUCTION_MIGRATION_CHANGED = NO
CONTRACT_BUNDLE_CHANGED = NO
PACKAGE_MANIFEST_CHANGED = NO
STAGE_F_IMPLEMENTED = NO
PRODUCTION_DB_WRITE = NO
PRODUCTION_GRANT_CREATED = NO
PRODUCTION_MIGRATION_APPLIED = NO
```

This proposed Spec authorizes no implementation. After independent review, an
authorized actor may mechanically finalize only:

```text
status: proposed -> accepted
implementation_authority: none -> contracts
```

The exact accepted revision must merge to `main` before implementation starts.

## 9. Authoring record

```text
AUTHORING_BASE = cb0b3d37dfb105c763c9c83ebd65483270b21b81
PARENT_SPEC_BLOB = d89bf08c8714f55571ee7d75da017b7cf7237096
ROUND = NEW_SPEC_AFTER_AMENDMENT_REVIEW_REVISE
PRIOR_REVIEWED_COMMIT = 3c1182eaca503efb7118142d1f04b553f4a62bde
PRIOR_REVIEW = REVISE
PRIOR_BLOCKERS_RESOLVED = 3
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```
