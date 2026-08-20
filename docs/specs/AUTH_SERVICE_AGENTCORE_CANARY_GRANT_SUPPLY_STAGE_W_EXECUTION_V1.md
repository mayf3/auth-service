---
spec_id: AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_STAGE_W_EXECUTION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
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
- One digest-pinned disposable PostgreSQL container with no host data volume and
  no path to an existing database.
- Current Prisma-schema creation plus exact test-only installation and runtime
  verification of the existing Grant-audit checks and immutability trigger.
- A strict manifest read through GitHub REST from an Agent Core commit proven
  reachable from remote `main`; the manifest carries all operational and audit
  metadata.

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
`OBS-SWX-001`, `CLM-SWX-001`, `EVD-SWX-001A`, `EVD-SWX-001B`.

### STATE-SWX-002 — Checked-in migrations are not an empty-database baseline

At the same source coordinate and date, static inspection shows that checked-in
migrations alter pre-existing `OkrRole` and reference a pre-existing `users`
table; the last historical migration additionally requires fixed data rows.
Therefore neither plain fresh `prisma migrate deploy` nor lexical SQL replay is
a viable isolated-test baseline. Basis: `OBS-SWX-002`, `CLM-SWX-002`,
`EVD-SWX-002A`, `EVD-SWX-002B`.

### STATE-SWX-003 — Current schema plus explicit safety DDL is testable locally

At the same source coordinate and date, the Prisma datamodel describes all Stage
W tables while the additive production SQL records the exact Grant-audit check
constraints and immutable trigger omitted by `prisma db push`. A self-owned local
cluster can create current schema, install those exact existing controls as
test-only DDL, and verify their runtime behavior. Basis: `OBS-SWX-003`,
`CLM-SWX-003`, `EVD-SWX-003A`, `EVD-SWX-003C`.

### OBS-SWX-001 — Execution surface inventory

- Subject: Stage W repository execution and test surfaces.
- Repository/source: `mayf3/auth-service`.
- Revision: `cb0b3d37dfb105c763c9c83ebd65483270b21b81`.
- Environment: local read-only source inspection; observed at `2026-08-20`.
- Method: inspect parent Spec, `scripts/backfill-minimal-auth-v1.ts`,
  `scripts/run-obo-conformance.sh`, and `package.json`.
- Result: `tsx`, Prisma, Ajv, Git, and PostgreSQL tools suffice without manifest
  changes; the broad backfill is forbidden because it reads Legacy flat fields.
- Provenance: named files at the bound revision.

### OBS-SWX-002 — Migration-chain baseline gaps

- Subject: empty-database replayability of checked-in auth-service migrations.
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

- Subject: current Stage W persistence schema and Grant-audit safety controls.
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
- Supported by: `EVD-SWX-001B`, `EVD-SWX-003B`; contradicted by: none known.

### CLM-SWX-002 — Production migration replay is the wrong isolated baseline

- Support state: SUPPORTED.
- Claim: fresh replay would require inventing a pre-chain schema and historical
  product fixtures outside Stage W authority.
- Supported by: `EVD-SWX-002B`; contradicted by: none known.

### CLM-SWX-003 — Current schema plus exact safety DDL preserves test relevance

- Support state: SUPPORTED.
- Claim: `prisma db push` may establish only the current disposable schema if the
  harness then installs and behaviorally verifies the exact existing Grant-audit
  safety controls before Stage W tests.
- Supported by: `EVD-SWX-003C`; contradicted by: none known.

### EVD-SWX-001A

- Source observations: `OBS-SWX-001`.
- Target type: State.
- Target ID: `STATE-SWX-001`.
- Relation: SUPPORTS.
- Bound coordinates: repository `mayf3/auth-service`, revision
  `cb0b3d37dfb105c763c9c83ebd65483270b21b81`, local source environment,
  observed `2026-08-20`.
- Strength/sufficiency: direct complete inventory of relevant execution files.
- Limitations: source feasibility is not executed conformance.
- Provenance: `OBS-SWX-001` named files.

### EVD-SWX-001B

- Source observations: `OBS-SWX-001`.
- Target type: Claim.
- Target ID: `CLM-SWX-001`.
- Relation: SUPPORTS.
- Bound coordinates, strength, limitations, and provenance: identical to
  `EVD-SWX-001A`.

### EVD-SWX-002A

- Source observations: `OBS-SWX-002`.
- Target type: State.
- Target ID: `STATE-SWX-002`.
- Relation: SUPPORTS.
- Bound coordinates: repository `mayf3/auth-service`, revision
  `cb0b3d37dfb105c763c9c83ebd65483270b21b81`, local SQL inspection,
  observed `2026-08-20`.
- Strength/sufficiency: direct unresolved DDL and data dependencies.
- Limitations: says nothing about deployed migration history.
- Provenance: every checked-in migration SQL file named by `OBS-SWX-002`.

### EVD-SWX-002B

- Source observations: `OBS-SWX-002`.
- Target type: Claim.
- Target ID: `CLM-SWX-002`.
- Relation: SUPPORTS.
- Bound coordinates, strength, limitations, and provenance: identical to
  `EVD-SWX-002A`.

### EVD-SWX-003A

- Source observations: `OBS-SWX-003`.
- Target type: State.
- Target ID: `STATE-SWX-003`.
- Relation: SUPPORTS.
- Bound coordinates: repository `mayf3/auth-service`, revision
  `cb0b3d37dfb105c763c9c83ebd65483270b21b81`, local schema inspection,
  observed `2026-08-20`.
- Strength/sufficiency: exact model, DDL, and JSON-schema definitions.
- Limitations: runtime behavior remains to be executed in Acceptance.
- Provenance: `OBS-SWX-003` named files.

### EVD-SWX-003B

- Source observations: `OBS-SWX-003`.
- Target type: Claim.
- Target ID: `CLM-SWX-001`.
- Relation: SUPPORTS.
- Bound coordinates, strength, limitations, and provenance: identical to
  `EVD-SWX-003A`.

### EVD-SWX-003C

- Source observations: `OBS-SWX-003`.
- Target type: Claim.
- Target ID: `CLM-SWX-003`.
- Relation: SUPPORTS.
- Bound coordinates, strength, limitations, and provenance: identical to
  `EVD-SWX-003A`.

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

### DEC-SWX-002 — Digest-pinned disposable PostgreSQL baseline

- Decision owner: same as `DEC-SWX-001`.
- Decision: the shell MUST start exactly
  `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`
  with Docker `--rm`, a generated container name prefixed
  `auth-stage-w-conformance-`, a tmpfs at `/var/lib/postgresql/data`, no host
  volume, trust authentication, generated database
  `auth_stage_w_conformance`, and a Docker-assigned port published only on
  `127.0.0.1`. It constructs `DATABASE_URL` internally and accepts no external
  URL, host, port, container, volume, or database name. Cleanup trap MUST remove
  the exact container on success, failure, or interruption and prove it absent.

  The shell then runs `prisma db push --skip-generate` only against that owned
  container, installs in one SQL transaction the exact five named Grant-audit
  check constraints plus exact immutable function/trigger recorded in
  `20260718000100_minimal_auth_v1_additive/migration.sql`, and proves before tests:

  - each named constraint exists and rejects one invalid row shape;
  - the trigger exists and rejects UPDATE and DELETE of a valid audit row;
  - the canonical source migration still contains every exact named control.

- Rejected: host `initdb`, external/existing DB, mutable image tag, production
  migration replay, historical fixture invention, host data volume, retained
  container, `db push` without safety DDL, or skipped runtime verification.
- Reason: the checked-in chain is not a baseline; a digest-pinned tmpfs container
  normatively minimizes host coupling, is disposable and loopback-only, and
  exercises current schema plus existing security controls.

### DEC-SWX-003 — Remote-main-anchored evidence and exact apply interface

- Decision owner: same as `DEC-SWX-001`.
- Decision: plan is default and read-only. Operational interfaces are exactly:

  ```text
  --validate-evidence --evidence-commit <lowercase 40-hex>
                      --evidence-path <safe relative POSIX path>
  --apply             --evidence-commit <lowercase 40-hex>
                      --evidence-path <safe relative POSIX path>
  ```

  `--validate-evidence` performs full provenance/receipt validation and exits
  before Prisma construction. `--apply` performs that identical validation
  first, then and only then constructs Prisma and enters the Stage W engine.

  Evidence provenance MUST use Node's built-in `node:https` directly, not Git,
  `fetch`, curl, proxy library, or caller repository. Before any request it
  rejects any defined/non-empty `NODE_OPTIONS`, `NODE_PATH`,
  `NODE_EXTRA_CA_CERTS`, `NODE_TLS_REJECT_UNAUTHORIZED`, `SSL_CERT_FILE`, or
  `SSL_CERT_DIR`. Every request uses fixed hostname `api.github.com`, port `443`,
  method `GET`, platform trust store, no custom agent/proxy, redirects disabled,
  idle/connect/TLS timeout `10_000 ms`, and total request-to-end deadline
  `30_000 ms`. Required headers are exactly:

  ```text
  User-Agent: mayf3-auth-service-stage-w-v1
  Accept: application/vnd.github+json
  X-GitHub-Api-Version: 2022-11-28
  ```

  Response media type, case-insensitive and ignoring parameter order, MUST be
  `application/json` with no parameter other than optional `charset=utf-8`.
  Maximum received JSON bytes are: Commit `2 MiB`, Compare `16 MiB`,
  review/comment `2 MiB`, manifest Contents response `2 MiB`, each receipt
  Contents response `512 KiB`. Any extra byte aborts the stream. Any non-200,
  3xx, timeout, TLS authorization/hostname failure, wrong media type, premature
  close, invalid content-length, or limit violation fails closed.

  The executor queries `mayf3/dsh-agent-core` through immutable GitHub REST
  coordinates. It resolves `commits/main`, `evidence_commit`, and
  `phase_a.merge_commit`. For each ancestor check it requests exact
  `/compare/<base40>...<head40>` and requires response `url` equal that canonical
  API URL, `base_commit.sha=<base40>`, `merge_base_commit.sha=<base40>`,
  `behind_by=0`, and status `ahead` or `identical`; the head SHA is independently
  fixed by the resolved Commit response and request URL because Compare exposes
  no standalone head field. Evidence must be ancestor/equal remote main; Phase A
  must be ancestor/equal evidence.

  Manifest and receipts use exact
  `/contents/<encoded-safe-path>?ref=<evidence_commit>` requests. Each response
  MUST have `type=file`, exact `path`, exact canonical `url` including the
  requested `ref` query (Contents exposes no standalone ref field), bounded
  integer `size`, `encoding=base64`, complete nonempty `content`, and no
  truncation. Manifest decoded bytes are at most `1 MiB`; each decoded receipt is
  at most `256 KiB`. No local Git object/config/executable/PATH/remote participates
  in provenance.

  Paths are non-empty relative POSIX paths without `..`, leading slash,
  backslash, empty segment, or NUL. Every receipt blob MUST exist at the same
  remote-main-reachable evidence commit, be non-empty UTF-8 JSON, match its
  lowercase 64-hex SHA-256, satisfy its closed receipt schema below, and
  cross-bind exactly to the corresponding manifest fields. Before ordinary JSON
  parsing or schema validation, a duplicate-aware parser MUST reject any repeated
  object member name at any nesting depth in the manifest or any receipt;
  Unicode escape-equivalent member names count as duplicates.

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
    review_ref: immutable GitHub review/comment URL
    receipt: { path: safe path, sha256: lowercase 64-hex }
  approval: object, additionalProperties=false:
    status: string exactly APPROVED
    operator_id: non-empty string, maximum 256 UTF-8 bytes
    approval_ref: immutable GitHub review/comment URL under mayf3/auth-service
    receipt: { path: safe path, sha256: lowercase 64-hex }
  audit_metadata: object, additionalProperties=false:
    migration_id: non-empty string, maximum 128 UTF-8 bytes
    source_git_commit: lowercase 40-hex equal clean HEAD and reviewed commit
    operator_id: exact manifest approval.operator_id
    approval_ref: exact manifest approval.approval_ref
    reason: non-empty string, maximum 512 UTF-8 bytes
  ```

  Every receipt object is also `additionalProperties: false` and has
  `schema_version=1`, `repository="mayf3/dsh-agent-core"`, and an RFC3339 UTC
  `recorded_at`. Receipt-specific fields are exactly:

  ```text
  Phase A receipt:
    receipt_type = agentcore_clean_bootstrap_phase_a
    status = MERGED
    merge_commit = manifest phase_a.merge_commit

  Identity receipt (one per manifest identity):
    receipt_type = auth_service_machine_identity
    agent_id, client_external_ref, principal_external_ref,
    client_id, principal_id, client_active, principal_active, principal_type
      = exact corresponding manifest values
    created = true

  Readiness receipt:
    receipt_type = agentcore_auth_canary_readiness
    status = READY
    client_ids = exactly the two manifest client_id values in unsigned-ASCII order

  Migration review receipt:
    receipt_type = auth_service_stage_w_migration_review
    auth_repository = mayf3/auth-service
    verdict, reviewed_source_git_commit, review_ref
      = exact manifest migration_review values
    reviewer_id = non-empty string

  Operator approval receipt:
    receipt_type = auth_service_stage_w_operator_approval
    auth_repository = mayf3/auth-service
    status, operator_id, approval_ref = exact manifest approval values
    reviewed_source_git_commit = manifest migration_review.reviewed_source_git_commit
    authorized_stage = STAGE_W
    authorized_client_ids = exact two manifest client_id values in ASCII order
    audience = svc-workflow
    scopes = exactly [workflow.read]
  ```

  Immutable URL grammar is exactly either
  `https://github.com/mayf3/auth-service/pull/<positive>#pullrequestreview-<positive>`
  or
  `https://github.com/mayf3/auth-service/(pull|issues)/<positive>#issuecomment-<positive>`;
  cross-pairs such as `issues/...#pullrequestreview-...` are invalid. For both
  `review_ref` and `approval_ref`, the executor MUST derive the corresponding
  `api.github.com/repos/mayf3/auth-service/...` immutable-ID endpoint, perform an
  HTTPS request with redirects disabled, and require HTTP 200. A pull-review
  response MUST have exact numeric `id`, exact canonical `html_url`, and exact
  `pull_request_url=https://api.github.com/repos/mayf3/auth-service/pulls/<PR>`.
  An issue/PR-comment response MUST have exact numeric `id`, exact canonical
  `html_url`, and exact
  `issue_url=https://api.github.com/repos/mayf3/auth-service/issues/<number>`.
  Missing, deleted, redirected, rate-limited, or mismatched objects fail closed
  before DB access. Receipt content supplies the reviewed/approved
  semantics; live API dereference proves the cited durable object exists.
  The auth-service worktree MUST be clean under
  `git status --porcelain --untracked-files=all`. Evidence is validation input;
  only the five `audit_metadata` values map to existing audit columns, and no
  evidence-only property enters audit JSON.
- Rejected: Git-based evidence transport, caller repositories/configuration,
  local-only commits, branch URLs as evidence, arbitrary receipt bytes,
  self-asserted uncross-bound facts, environment booleans, worktree-file evidence,
  alternate identities, dirty source tree, SHA mismatch, or audit-envelope
  extension.
- Reason: fixed GitHub REST coordinates, remote-main reachability, closed receipt
  schemas, live review/approval object checks, duplicate-key rejection, and
  cross-field binding make operational evidence durable and non-local-forgeable
  without treating it as normative authority.

### DEC-SWX-004 — Production-ineligible container conformance mode

- Decision owner: same as `DEC-SWX-001`.
- Decision: the executable contains one private planner/Serializable transaction
  engine. No engine function or test closure is exported. Operational `--apply`
  validates `DEC-SWX-003` before Prisma construction. DB integration uses an
  explicit `--conformance-apply --descriptor-fd <integer>` CLI mode that refuses
  `DATABASE_URL` and reads one duplicate-key-free JSON descriptor to EOF from an
  inherited descriptor whose `fstat` type is FIFO, then closes it. Anonymous and
  named FIFOs are both permitted because Node cannot distinguish them reliably;
  regular files, argv/env JSON, stdin fallback, and sockets are rejected. The
  same descriptor content MAY be supplied through a new FIFO while the exact
  container lives; this is required to test parent exact-rerun/no-op behavior and
  carries no operational authority.

  Descriptor is `additionalProperties:false` with exactly:

  ```text
  schema_version = 1
  container_id = lowercase 64-hex
  nonce = lowercase 64-hex
  host_port = integer 1..65535
  database = auth_stage_w_conformance
  audit_metadata = strict five-field parent metadata using synthetic test values
  ```

  The harness generates the 256-bit nonce, starts the exact `DEC-SWX-002` image
  with label
  `com.mayf3.auth.stage-w-conformance=sha256:<SHA256(nonce)>` and PostgreSQL custom
  setting `stage_w.conformance_nonce=<nonce>`, and transfers the descriptor only
  by pipe to the test process. Conformance mode invokes fixed
  `/usr/local/bin/docker inspect <container_id>` with a minimal allowlisted child
  environment and verifies: exact image digest, running state, exact label,
  tmpfs data directory, zero host mounts, exact loopback host-port binding, and
  no unexpected network/privileged settings. It constructs the URL internally,
  connects, and requires exact `current_database()`, server port/address, and
  `current_setting('stage_w.conformance_nonce')` before calling the private engine.

  An external caller may reproduce a conformance container, but the mode is
  structurally incapable of addressing an existing/production DB: it accepts no
  connection input and only constructs a URL after Docker inspection plus the
  server nonce checks. Results qualify DB behavior Contracts only, never positive
  provenance/readiness. Positive provenance remains runtime/manual through
  DB-free `--validate-evidence`. No production apply is authorized.
- Rejected: importable engine/seam, hidden flag, descriptor transported by
  regular file/argv/env/socket, external URL, non-pinned container, host volume,
  alternate DB, local evidence override, or conformance result claimed as
  operational evidence.
- Reason: real transaction behavior is testable before receipts exist while the
  only evidence-free DB mode is cryptographically bound to the disposable
  container.

### DEC-SWX-005 — DB-free deterministic HTTPS state conformance mode

- Decision owner: same as `DEC-SWX-001`.
- Decision: executable may expose
  `--conformance-http --fixture-fd <integer>` only. It refuses every DB/evidence/
  apply argument and `DATABASE_URL`, never constructs Prisma, never calls the
  Stage W engine, and never reports operational evidence success. It reads one
  duplicate-key-free fixture from a FIFO and feeds it to the same private request
  construction, byte-limit, stream-terminal, header, envelope, and JSON validators
  used by `DEC-SWX-003`, but replaces only the actual socket with deterministic
  events.

  Fixture is `additionalProperties:false` with exactly:

  ```text
  schema_version = 1
  kind = commit | compare | contents-manifest | contents-receipt | review | comment
  request_path = expected fixed API path
  tls_authorized = boolean
  elapsed_ms = nonnegative integer
  status_code = integer 100..599
  headers = object of lowercase header name -> exact string value
  chunks_base64 = ordered array of base64 strings
  terminal = end | timeout | tls_error | premature_close | socket_error
  error_code = null or non-empty string
  ```

  The test suite covers wrong host/port/path through private request-construction
  assertions; response 3xx/4xx/5xx, media-type variants, content-length mismatch,
  every byte limit boundary plus one, chunked overflow, timeout boundaries
  `9_999/10_000/29_999/30_000 ms`, TLS unauthorized, premature close, malformed
  Commit/Compare/Contents/review/comment envelopes, duplicate JSON keys, and valid
  envelopes. Static source assertions bind the fixed headers, host, port, limits,
  environment rejection list, and absence of any alternate socket/agent/proxy.
- Rejected: exported transport function, caller network endpoint, test CA/proxy,
  fixture mode reaching evidence-valid/apply/DB code, or conformance output used
  as positive provenance.
- Reason: network failure behavior becomes deterministic without adding an
  operational transport override or apply bypass.

## 6. Contracts

### CTR-SWX-001 — Artifact boundary is exact

Only the three new files in `DEC-SWX-001` may differ from implementation base.
The executable is plan-only unless exact apply gates pass.

### CTR-SWX-002 — Temporary DB is owned, safe, and complete

The harness implements every lifecycle and control check in `DEC-SWX-002`.
Failure at any step prevents Stage W test execution and still stops/removes the
owned cluster. No externally supplied connection is read or used.

### CTR-SWX-003 — Evidence and metadata fail before DB access

Every sanitized-fetch, reachability, duplicate-key, type, cardinality, exact
value, URL, path, receipt schema, cross-binding, blob, digest, identity, approval,
cleanliness, and SHA rule in `DEC-SWX-003` is mandatory. Invalid evidence fails
before the executable constructs Prisma or performs any database query/write.
Plan opens the target DB read-only in behavior but does not require evidence;
`--validate-evidence` performs no DB access.

### CTR-SWX-004 — Parent Stage W obligations remain mandatory

The implementation MUST satisfy all applicable parent Contracts
`CTR-CGS-001` through `CTR-CGS-011`, `CTR-CGS-013`, and `CTR-CGS-014` exactly.
Parent `CTR-CGS-012` is NOT_APPLICABLE because rollback implementation is outside
this Spec and remains separately reviewed future work. No parent obligation is
replaced or weakened.

### CTR-SWX-005 — Test seam cannot become an operational bypass

The only evidence-free integration mode is exactly `DEC-SWX-004`; its pipe,
descriptor, Docker inspection, image/label/tmpfs/network, nonce, database, and
no-external-URL guards are mandatory. No engine function is exported.
Operational `--apply` always performs full provenance validation first. No
conformance result qualifies `CTR-CGS-010`; positive provenance remains a
separate runtime/manual result from `--validate-evidence` with real receipts.

### CTR-SWX-006 — HTTP conformance cannot become transport or apply override

`--conformance-http` is exactly `DEC-SWX-005`: FIFO fixture events enter only the
private deterministic HTTP validation state machine. The mode has no Prisma,
Stage W engine, operational evidence success, caller endpoint, CA, proxy, agent,
or socket path. Operational modes cannot read its fixture interface.

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
- Expected: exact image digest, tmpfs/no-volume, loopback Docker-assigned port,
  internally built URL, schema and controls installed, invalid-row checks pass,
  immutable UPDATE/DELETE checks pass, real test runs, and container is absent
  after every exit.
- Failure: mutable tag, external connection/input, host volume, retained
  container, missing/bypassed control, or Stage W execution before setup passes.

### ACC-SWX-003 — Closed evidence and metadata

- Contracts: `CTR-SWX-003`; parent `CTR-CGS-008`, `CTR-CGS-010`.
- Method: test every field missing/extra/duplicated (including Unicode-escaped
  duplicate member names); wrong type; empty/over-byte-limit metadata; unsafe
  path; absent/empty/digest-mismatched/schema-invalid receipt; manifest/receipt
  mismatch; missing or mismatched approval receipt/operator; impossible URL
  cross-pair; GitHub API missing/deleted/redirected/rate-limited/mismatched object;
  non-empty Node/TLS override variables; attempted proxy/agent injection; wrong
  host/port/content-type, oversized/truncated/non-base64 Contents response;
  malformed Commit/Compare base/head/merge-base/status; evidence or Phase-A commit
  absent/not reachable from remote main; alternate/duplicate identity; inactive
  flags; wrong type/Agent ID; non-READY/non-PASS;
  lowercase/length/SHA variants; and dirty tracked/untracked auth-service tree.
  Parser tests use synthetic JSON only and MUST NOT claim positive provenance.
- Expected: each invalid `--apply` and `--validate-evidence` fails before Prisma;
  plan needs no evidence and writes nothing. Positive provenance is a required
  runtime/manual Acceptance item after real Phase-A, identity, readiness, review,
  and approval receipts exist: run `--validate-evidence` against a remote-main-
  reachable evidence commit, prove all bindings, and exit with DB access `0`.
- Failure: invalid input reaches DB access; synthetic/local-only evidence is
  reported valid; evidence-only fields enter audit; or production apply occurs.
- Current implementation-PR evidence qualification: `INCONCLUSIVE` for positive
  provenance by design because the parent prerequisites do not yet exist;
  sufficient negative enforcement and parser coverage are still mandatory.

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
CTR-CGS-010 -> ACC-SWX-003 | ACC-SWX-010 | ACC-SWX-011
CTR-CGS-011 -> ACC-SWX-004 | ACC-SWX-008
CTR-CGS-012 -> NOT_APPLICABLE (rollback not implemented)
CTR-CGS-013 -> ACC-SWX-002 | ACC-SWX-007
CTR-CGS-014 -> ACC-SWX-002 | ACC-SWX-007
ACC-CGS-001 -> ACC-SWX-004 (exact deterministic identity selection)
ACC-CGS-002 -> ACC-SWX-004 (missing/mismatched identity all-or-nothing)
ACC-CGS-003 -> ACC-SWX-005 (Audience failures write zero)
ACC-CGS-004 -> ACC-SWX-005 (unknown/forbidden Scope rejection)
ACC-CGS-005 -> ACC-SWX-006 | ACC-SWX-007 (two Grants + two audits atomically)
ACC-CGS-006 -> ACC-SWX-006 (exact rerun writes zero)
ACC-CGS-007 -> ACC-SWX-006 | ACC-SWX-007 (state/concurrency conflict rollback)
ACC-CGS-008 -> ACC-SWX-005 (forbidden privilege rejection)
ACC-CGS-009 -> ACC-SWX-008 (Legacy reads/writes zero)
ACC-CGS-010 -> ACC-SWX-002 | ACC-SWX-003 | ACC-SWX-007 (metadata, audit, atomicity)
ACC-CGS-011 -> ACC-SWX-004 | ACC-SWX-008 (only two canaries change)
ACC-CGS-012 -> NOT_APPLICABLE (rollback not implemented)
AC-AUTHORITY-1 -> ACC-SWX-005 (Stage F absent and forum writes zero)
AC-AUTHORITY-2 -> ACC-SWX-005 (registry presence cannot unblock Stage F)
AC-AUDIT-1 -> ACC-SWX-007 (Stage W create audit schema-valid)
AC-AUDIT-2 -> NOT_APPLICABLE (Stage F not implemented)
AC-AUDIT-3 -> ACC-SWX-007 (exact 13 fields, no additions)
AC-AUDIT-4 -> ACC-SWX-007 (complete nine-field snapshots)
AC-ROLLBACK-1 -> NOT_APPLICABLE (rollback not implemented)
AC-ROLLBACK-2 -> NOT_APPLICABLE (rollback not implemented)
AC-ROLLBACK-3 -> NOT_APPLICABLE (rollback not implemented)
AC-NOOP -> ACC-SWX-006
```

A static test MUST also prove the three implementation files contain no
`svc-forum`, `forum.`, rollback apply path, or forbidden Scope constant except
negative-test literals.

### ACC-SWX-010 — Integration seam is DB-only and non-operational

- Contracts: `CTR-SWX-005`; parent DB Contracts exercised by `ACC-SWX-004`
  through `ACC-SWX-008`.
- Method: invoke conformance mode with descriptor FD missing, regular-file,
  socket, stdin, closed, duplicate-key, and malformed variants; wrong
  nonce/label/image/mount/network/port/database/GUC; caller `DATABASE_URL`;
  stopped/removed container; Docker-inspect failure; every unknown CLI flag/env;
  then supply identical content through a new anonymous FIFO and a named FIFO
  while the exact container lives. Scan exports/imports and CLI branches.
- Expected: no engine function is exported; either FIFO form plus the exact live
  disposable container reaches the private engine; repeated exact descriptor
  permits the engine's exact-rerun no-op; URL is internally constructed;
  operational `--apply` reaches no Prisma before provenance validation;
  `--validate-evidence` has DB access `0`.
- Failure: import/dynamic-import raw apply, external connection input,
  non-FIFO descriptor, nonconforming/production DB access, flag/env provenance
  bypass, exact-rerun mutation, or DB test reported as positive provenance.

### ACC-SWX-011 — Deterministic HTTPS validator without operational override

- Contracts: `CTR-SWX-006`; supports `CTR-SWX-003` and parent `CTR-CGS-010`.
- Method: run every boundary/event/envelope case in `DEC-SWX-005`; test fixture FD
  wrong type and malformed/duplicate JSON; invoke fixture mode with every DB,
  evidence, apply, endpoint, CA, proxy, and agent argument/env; scan imports,
  exports, dispatch, and private call graph.
- Expected: deterministic valid/invalid results match fixed constants; fixture
  mode has network `0`, Prisma construction/query `0`, engine calls `0`, and can
  never report positive provenance. Operational request path has no fixture hook.
- Failure: nondeterministic ambient GitHub dependency, hidden transport override,
  operational mode reading fixture data, DB/engine access, or conformance result
  accepted as evidence.

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
ROUND = 7
PRIOR_REVIEWED_COMMIT = 0e43cb953ad3b958a069f0d4dc28c10e2a0f8dd0
PRIOR_REVIEW = REVISE
PRIOR_BLOCKERS_RESOLVED = 4
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```
