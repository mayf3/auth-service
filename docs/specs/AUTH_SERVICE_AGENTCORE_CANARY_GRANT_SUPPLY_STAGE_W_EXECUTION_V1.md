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

Freeze only the execution coordinates absent from accepted
`AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1`: the exact Stage W executable,
exclusive implementation files, self-owned temporary PostgreSQL test lifecycle,
and closed durable-evidence input.

This is a new subordinate authority. It does not amend, supersede, narrow, or
reinterpret the accepted parent. The parent owns all Stage W identity, Grant,
Scope, revision, transaction, audit, idempotency, conflict, operational,
rollback, Stage F, and production-apply meaning. Any conflict stops work and the
parent wins.

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

- One exact repository-versioned offline Stage W executable.
- One exclusive three-file implementation and conformance surface.
- A local `initdb`-owned PostgreSQL cluster that cannot address an existing DB.
- Current Prisma-schema creation plus exact test-only installation and runtime
  verification of the existing Grant-audit checks and immutability trigger.
- A strict manifest read from immutable Git objects in an exact Agent Core
  evidence commit; the manifest carries all operational and audit metadata.

### Out of scope

- Any edit to the accepted parent or reuse of its stable IDs.
- Stage F, `svc-forum`, rollback implementation, `workflow.execute`,
  `forum.admin`, `forum.moderate`, wildcard, or any other identity, Audience,
  Scope, or Grant.
- Existing Prisma schema or migration files, Contract Bundle, audit schema,
  package manifest, dependency, reusable library, route, online command,
  production configuration, receipt, deployment, production DB apply, or real
  Grant creation.
- Reading or writing `allowedResources` or `allowedScopes`.
- Treating Agent Core receipts as external normative authority; they are only
  immutable operational evidence required by the accepted parent.

## 3. State and observations

### STATE-SWX-001 — Parent behavior is complete; execution coordinates are absent

At source `mayf3/auth-service@cb0b3d37dfb105c763c9c83ebd65483270b21b81`
in the authoring checkout on `2026-08-20`, the accepted parent fully freezes
Stage W behavior but names no exact executable path, file set, disposable-DB
lifecycle, or machine-readable durable-evidence transport. Basis:
`OBS-SWX-001`, `CLM-SWX-001`, `EVD-SWX-001`.

### STATE-SWX-002 — Checked-in migrations are not an empty-database baseline

At the same source coordinate and date, static inspection shows that checked-in
migrations alter pre-existing `OkrRole` and reference a pre-existing `users`
table; the last historical migration additionally requires fixed data rows.
Therefore neither plain fresh `prisma migrate deploy` nor lexical SQL replay is
a viable isolated-test baseline. Basis: `OBS-SWX-002`, `CLM-SWX-002`,
`EVD-SWX-002`.

### STATE-SWX-003 — Current schema plus explicit safety DDL is testable locally

At the same source coordinate and date, the Prisma datamodel describes all Stage
W tables while the additive production SQL records the exact Grant-audit check
constraints and immutable trigger omitted by `prisma db push`. A self-owned local
cluster can create current schema, install those exact existing controls as
test-only DDL, and verify their runtime behavior. Basis: `OBS-SWX-003`,
`CLM-SWX-003`, `EVD-SWX-003`.

### OBS-SWX-001 — Execution surface inventory

- Repository/source: `mayf3/auth-service`.
- Revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`.
- Environment: local read-only source inspection; observed at `2026-08-20`.
- Method: inspect parent Spec, `scripts/backfill-minimal-auth-v1.ts`,
  `scripts/run-obo-conformance.sh`, and `package.json`.
- Result: `tsx`, Prisma, Ajv, Git, and PostgreSQL tools suffice without manifest
  changes; the broad backfill is forbidden because it reads Legacy flat fields.
- Provenance: named files at the bound revision.

### OBS-SWX-002 — Migration-chain baseline gaps

- Repository/source: `mayf3/auth-service/prisma/migrations/`.
- Revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`.
- Environment: local read-only SQL inspection; observed at `2026-08-20`.
- Method: inspect every checked-in `migration.sql` in lexical order.
- Result: `20260701000001` and `20260704000001` alter an enum not created by an
  earlier checked-in migration; `20260714000001` references a `users` table not
  created by the chain; `20260722000100` requires fixed Principal, Client,
  Audience, and Grant data. Fresh replay is therefore not an available baseline.
- Provenance: the checked-in migration SQL files at the bound revision.

### OBS-SWX-003 — Current schema and audit controls

- Repository/source: `prisma/schema.prisma`,
  `prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql`, and
  `contract-bundles/minimal-auth-v1/schemas/grants.schema.json`.
- Revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`.
- Environment: local read-only schema inspection; observed at `2026-08-20`.
- Method: inspect model keys, Grant audit checks, trigger, and JSON schemas.
- Result: current schema supplies identity/Grant/audit tables and keys; production
  SQL lines defining `grant_change_audits_source_commit_check`,
  `grant_change_audits_required_text_check`,
  `grant_change_audits_reason_check`, `grant_change_audits_version_check`,
  `grant_change_audits_value_shape_check`, function
  `reject_auth_audit_mutation`, and trigger
  `grant_change_audits_immutable` are exact frozen read-only dependencies.
- Provenance: named files at the bound revision.

## 4. Claims and evidence

### CLM-SWX-001 — Three new files are sufficient

- Support state: SUPPORTED.
- Claim: one executable, one real-DB test, and one self-owned cluster harness can
  implement and verify Stage W without changing an existing artifact.
- Supported by: `EVD-SWX-001`, `EVD-SWX-003`; contradicted by: none known.

### CLM-SWX-002 — Production migration replay is the wrong isolated baseline

- Support state: SUPPORTED.
- Claim: fresh replay would require inventing a pre-chain schema and historical
  product fixtures outside Stage W authority.
- Supported by: `EVD-SWX-002`; contradicted by: none known.

### CLM-SWX-003 — Current schema plus exact safety DDL preserves test relevance

- Support state: SUPPORTED.
- Claim: `prisma db push` may establish only the current disposable schema if the
  harness then installs and behaviorally verifies the exact existing Grant-audit
  safety controls before Stage W tests.
- Supported by: `EVD-SWX-003`; contradicted by: none known.

### EVD-SWX-001

- Source observations: `OBS-SWX-001`.
- Target: `STATE-SWX-001`, `CLM-SWX-001`; relation: SUPPORTS.
- Bound coordinates: repository `mayf3/auth-service`, revision
  `cb0b3d37dfb105c763c9c83ebd65483270b21b81`, local source environment,
  observed `2026-08-20`.
- Strength/sufficiency: direct complete inventory of relevant execution files.
- Limitations: source feasibility is not executed conformance.
- Provenance: `OBS-SWX-001` named files.

### EVD-SWX-002

- Source observations: `OBS-SWX-002`.
- Target: `STATE-SWX-002`, `CLM-SWX-002`; relation: SUPPORTS.
- Bound coordinates: repository `mayf3/auth-service`, revision
  `cb0b3d37dfb105c763c9c83ebd65483270b21b81`, local SQL inspection,
  observed `2026-08-20`.
- Strength/sufficiency: direct unresolved DDL and data dependencies.
- Limitations: says nothing about deployed migration history.
- Provenance: every checked-in migration SQL file.

### EVD-SWX-003

- Source observations: `OBS-SWX-003`.
- Target: `STATE-SWX-003`, `CLM-SWX-001`, `CLM-SWX-003`; relation: SUPPORTS.
- Bound coordinates: repository `mayf3/auth-service`, revision
  `cb0b3d37dfb105c763c9c83ebd65483270b21b81`, local schema inspection,
  observed `2026-08-20`.
- Strength/sufficiency: exact model, DDL, and JSON-schema definitions.
- Limitations: runtime behavior remains to be executed in Acceptance.
- Provenance: `OBS-SWX-003` named files.

## 5. Decisions

### DEC-SWX-001 — Exact executable and exclusive file set

- Decision owner: `mayf3` or delegated auth-service maintainer.
- Decision: sole executable path:

  ```text
  scripts/supply-agentcore-canary-workflow-grants-v1.ts
  ```

  Complete implementation diff, exactly three new files:

  ```text
  scripts/supply-agentcore-canary-workflow-grants-v1.ts
  tests/oauth/supply-agentcore-canary-workflow-grants-v1.test.ts
  scripts/run-agentcore-canary-workflow-grants-v1-conformance.sh
  ```

- Rejected: Prisma migration SQL, broad backfill reuse, generic library, package
  script/dependency, online route/command, or any fourth file.
- Reason: smallest reviewable surface consistent with parent obligations.

### DEC-SWX-002 — Self-owned local PostgreSQL baseline

- Decision owner: same as `DEC-SWX-001`.
- Decision: the shell MUST create a new `mktemp` data directory, run `initdb`,
  start that exact cluster with `pg_ctl` on loopback using a generated unused
  high port, create a generated database named with prefix
  `auth_stage_w_conformance_`, and construct `DATABASE_URL` internally. It MUST
  accept no external `DATABASE_URL`, host, port, cluster, or database name.
  Cleanup trap MUST stop the exact server and remove the complete temp directory
  on success, failure, or interruption.

  The shell then runs `prisma db push --skip-generate` only against that owned
  database, installs in one SQL transaction the exact five named Grant-audit
  check constraints plus exact immutable function/trigger recorded in
  `20260718000100_minimal_auth_v1_additive/migration.sql`, and proves before tests:

  - each named constraint exists and rejects one invalid row shape;
  - the trigger exists and rejects UPDATE and DELETE of a valid audit row;
  - the canonical source migration still contains every exact named control.

- Rejected: external or existing DB, production migration replay, historical
  fixture invention, retained cluster, `db push` without safety DDL, or skipping
  runtime control verification.
- Reason: the checked-in chain is not a baseline; this procedure is exact,
  disposable, and exercises the current schema plus existing security controls.

### DEC-SWX-003 — Immutable Git-object evidence and exact apply interface

- Decision owner: same as `DEC-SWX-001`.
- Decision: plan is default and read-only. Apply interface is exactly:

  ```text
  --apply
  --evidence-repository <absolute local path>
  --evidence-commit <lowercase 40-hex>
  --evidence-path <safe relative POSIX path>
  ```

  The evidence repository MUST be a Git checkout whose `origin` URL is exactly
  `https://github.com/mayf3/dsh-agent-core.git`. The executor reads only Git
  objects: it verifies the commit exists, then reads the manifest and every
  receipt with `git show <commit>:<path>`. Paths are non-empty relative POSIX
  paths without `..`, leading slash, backslash, empty segment, or NUL. Every
  referenced receipt blob must exist, be non-empty, and match its lowercase
  64-hex SHA-256.

  Manifest is UTF-8 JSON, `additionalProperties: false`, exactly:

  ```text
  schema_version: integer exactly 1
  phase_a: object, additionalProperties=false:
    merged: boolean exactly true
    merge_commit: lowercase 40-hex
    receipt: { path: safe path, sha256: lowercase 64-hex }
  identities: array exactly 2, unique by both refs, each additionalProperties=false:
    client_external_ref: one exact parent Client ref
    principal_external_ref: corresponding exact parent Principal ref
    client_id: string matching ^mc_[A-Za-z0-9]{24}$
    principal_id: lowercase UUID
    client_active: boolean exactly true
    principal_active: boolean exactly true
    principal_type: string exactly agent
    agent_id: corresponding exact parent Agent ID
    receipt: { path: safe path, sha256: lowercase 64-hex }
  readiness: object, additionalProperties=false:
    status: string exactly READY
    receipt: { path: safe path, sha256: lowercase 64-hex }
  migration_review: object, additionalProperties=false:
    repository: string exactly mayf3/auth-service
    verdict: string exactly PASS
    reviewed_source_git_commit: lowercase 40-hex equal clean auth-service HEAD
    review_ref: string matching exact immutable GitHub PR review/comment URL grammar
  audit_metadata: object, additionalProperties=false:
    migration_id: non-empty string, maximum 128 bytes
    source_git_commit: lowercase 40-hex equal clean HEAD and reviewed commit
    operator_id: non-empty string, maximum 256 bytes
    approval_ref: immutable GitHub PR/issue review/comment URL under mayf3/auth-service
    reason: non-empty string, maximum 512 bytes
  ```

  Immutable URL grammar is
  `https://github.com/mayf3/auth-service/(pull|issues)/<positive integer>#(pullrequestreview|issuecomment)-<positive integer>`.
  The auth-service worktree MUST be clean under
  `git status --porcelain --untracked-files=all`. Evidence data is validation
  input only; only the five `audit_metadata` values map to existing audit
  columns, and no evidence-only property enters audit JSON.
- Rejected: environment booleans, mutable branch URLs, arbitrary strings,
  worktree-file reads, empty/untyped refs, alternate identities, dirty tree,
  SHA mismatch, or audit-envelope extension.
- Reason: exact local dereference of immutable Git objects satisfies the parent's
  durable evidence gate without claiming external normative authority.

## 6. Contracts

### CTR-SWX-001 — Artifact boundary is exact

Only the three new files in `DEC-SWX-001` may differ from implementation base.
The executable is plan-only unless exact apply gates pass.

### CTR-SWX-002 — Temporary DB is owned, safe, and complete

The harness implements every lifecycle and control check in `DEC-SWX-002`.
Failure at any step prevents Stage W test execution and still stops/removes the
owned cluster. No externally supplied connection is read or used.

### CTR-SWX-003 — Evidence and metadata fail before DB access

Every type, cardinality, exact value, URL, path, blob, digest, identity binding,
cleanliness, and SHA rule in `DEC-SWX-003` is mandatory. Invalid evidence fails
before the executable opens Prisma or performs any database query or write. Plan
opens the target DB read-only in behavior but does not require evidence.

### CTR-SWX-004 — Parent Stage W obligations remain mandatory

The implementation MUST satisfy all applicable parent Contracts
`CTR-CGS-001` through `CTR-CGS-011`, `CTR-CGS-013`, and `CTR-CGS-014` exactly.
Parent `CTR-CGS-012` is NOT_APPLICABLE because rollback implementation is outside
this Spec and remains separately reviewed future work. No parent obligation is
replaced or weakened.

## 7. Acceptance and parent mapping

### ACC-SWX-001 — Exact diff

- Contracts: `CTR-SWX-001`.
- Method: diff implementation base to head.
- Expected: exactly three new paths from `DEC-SWX-001`.
- Failure: missing, renamed, modified-existing, or fourth file.

### ACC-SWX-002 — Owned PostgreSQL lifecycle and audit controls

- Contracts: `CTR-SWX-002`; parent `CTR-CGS-007`, `CTR-CGS-013`,
  `CTR-CGS-014`.
- Method: run shell from clean commit; inject setup, test, and cleanup failures.
- Expected: owned cluster only; schema and exact controls installed; constraint
  invalid-row checks pass; immutable UPDATE/DELETE checks pass; real test runs;
  process and temp directory absent after every exit.
- Failure: external connection read, retained process/files, missing/bypassed
  control, or Stage W execution before setup passes.

### ACC-SWX-003 — Closed evidence and metadata

- Contracts: `CTR-SWX-003`; parent `CTR-CGS-008`, `CTR-CGS-010`.
- Method: test every field missing/extra; wrong type; empty and over-byte-limit
  metadata; unsafe path; absent/empty/digest-mismatched blob; wrong remote;
  missing commit; alternate/duplicate identity; inactive flags; wrong type or
  Agent ID; non-READY; non-PASS; mutable/malformed URL; lowercase/length/SHA
  variants; dirty tracked/untracked tree; and one exact valid Git-object fixture.
- Expected: each invalid apply fails before any Prisma connection; valid evidence
  reaches DB planning; plan needs no evidence and writes nothing.
- Failure: invalid input reaches DB access or evidence-only field enters audit.

### ACC-SWX-004 — Identity and selection matrix

- Contracts: parent `CTR-CGS-001`, `CTR-CGS-005`, `CTR-CGS-011`.
- Method: temporary DB cases for both exact pairs plus misleading names,
  OpenClaw/prefix rows; each Client missing; duplicate after controlled unique
  constraint removal; inactive Client; inactive Principal; wrong binding;
  service Principal; wrong/missing Agent ID; wrong Principal/Client external ref;
  nullable owner; and non-target sentinels.
- Expected: only exact active pairs plan; every invalid case fails loudly with
  Grant writes `0`, audit writes `0`, and all sentinel rows byte-equivalent.
- Failure: alternate selection, partial mutation, or non-target delta.

### ACC-SWX-005 — Audience, Scope, and forbidden privilege matrix

- Contracts: parent `CTR-CGS-002`, `CTR-CGS-003`, `CTR-CGS-005`.
- Method: exact active `svc-workflow`; missing, duplicate after controlled key
  removal, inactive, machine-disabled, Agent-not-accepted, missing requested
  Scope; unregistered Scope, wrong namespace/case, wildcard; explicit
  `workflow.execute`, forum/admin/moderate, other Audience/Client attempts.
- Expected: only exactly `workflow.read` for two canaries is plan/apply capable;
  every variant fails before writes without repair/downscope/union.
- Failure: any forbidden privilege or mutation.

### ACC-SWX-006 — State, revision, no-op, and conflict matrix

- Contracts: parent `CTR-CGS-004`, `CTR-CGS-005`, `CTR-CGS-006`.
- Method: pristine no-audit/no-Grant; exact completed revision-1 state; existing
  wrong Scope/version; extra Grant; unrelated or drifted audit; latest audit
  revision mismatch; concurrent Grant insert and concurrent audit revision.
- Expected: pristine creates; exact rerun writes nothing and preserves
  timestamps; every other or racing state conflicts and rolls back both Clients.
- Failure: overwrite, repair, union, last-write-wins, or partial result.

### ACC-SWX-007 — Audit schema and one-stage transaction

- Contracts: parent `CTR-CGS-006`, `CTR-CGS-007`, `CTR-CGS-013`,
  `CTR-CGS-014`.
- Method: successful two-client apply; validate each audit field-by-field against
  unmodified `grantChangeAudit`; assert exact 13 keys, public `mc_*` client ID,
  null before/expected, revision 1, and complete nine-field after snapshot;
  inject second Grant failure and second audit failure.
- Expected: exactly two Grants plus two create audits in one Serializable
  transaction; injected failure leaves all four writes at zero.
- Failure: extra/missing field, external ref in audit, partial snapshot,
  non-atomic result, or wrong isolation/revision.

### ACC-SWX-008 — Legacy and non-target invariance

- Contracts: parent `CTR-CGS-009`, `CTR-CGS-011`.
- Method: static source dependency check plus instrumented DB privileges/counters
  and before/after snapshots of Legacy columns, all other Grants, Principals,
  Clients, Audiences, OpenClaw rows, and sentinels.
- Expected: Legacy reads `0`, writes `0`; only target two Grants and audits differ.
- Failure: Legacy data flow or any other row/column delta.

### ACC-SWX-009 — Parent acceptance coverage ledger

```text
CTR-CGS-001 -> ACC-SWX-004
CTR-CGS-002 -> ACC-SWX-005
CTR-CGS-003 -> ACC-SWX-005
CTR-CGS-004 -> ACC-SWX-006
CTR-CGS-005 -> ACC-SWX-004 | ACC-SWX-005 | ACC-SWX-006
CTR-CGS-006 -> ACC-SWX-006 | ACC-SWX-007
CTR-CGS-007 -> ACC-SWX-002 | ACC-SWX-007
CTR-CGS-008 -> ACC-SWX-003
CTR-CGS-009 -> ACC-SWX-008
CTR-CGS-010 -> ACC-SWX-003
CTR-CGS-011 -> ACC-SWX-004 | ACC-SWX-008
CTR-CGS-012 -> NOT_APPLICABLE (rollback not implemented)
CTR-CGS-013 -> ACC-SWX-002 | ACC-SWX-007
CTR-CGS-014 -> ACC-SWX-002 | ACC-SWX-007
ACC-CGS-001..011 -> ACC-SWX-003..008 collectively
ACC-CGS-012 -> NOT_APPLICABLE (rollback not implemented)
AC-AUTHORITY-1..2 -> ACC-SWX-005 static Stage-F absence assertions
AC-AUDIT-1, AC-AUDIT-3..4 -> ACC-SWX-007
AC-AUDIT-2 -> NOT_APPLICABLE (Stage F not implemented)
AC-ROLLBACK-1..3 -> NOT_APPLICABLE (rollback not implemented)
AC-NOOP -> ACC-SWX-006
```

A static test MUST also prove the three implementation files contain no
`svc-forum`, `forum.`, rollback apply path, or forbidden Scope constant except
negative-test literals.

## 8. Compatibility and lifecycle

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

The exact accepted revision must merge to `main` before implementation.

## 9. Authoring record

```text
AUTHORING_BASE = cb0b3d37dfb105c763c9c83ebd65483270b21b81
PARENT_SPEC_BLOB = d89bf08c8714f55571ee7d75da017b7cf7237096
ROUND = 3
PRIOR_REVIEWED_COMMIT = 00e8d560a0b5586df4ae0c8cdd1ee0e9fe3e512f
PRIOR_REVIEW = REVISE
PRIOR_BLOCKERS_RESOLVED = 4
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```
