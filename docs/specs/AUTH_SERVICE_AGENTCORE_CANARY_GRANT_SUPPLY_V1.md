---
spec_id: AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1

## 1. Goal

Freeze an extremely narrow, fail-closed, two-stage authority for supplying V1
`MachineAccessGrant` rows to the deterministic auth-service clients of two
Agent Core canary Agents:

```text
CANARY_AGENTS = agt_stock_agent | agt_cto-agent
AUTHORIZED_CLIENTS = 2
FIXED_GIT_SHA_VERSIONED_MIGRATION = REQUIRED
V1_MACHINE_ACCESS_GRANT_ONLY = YES
```

The final target across both stages is four rows, but the two Audiences do not
share one authority. `svc-workflow` is inside the current frozen Minimal Auth
V1 Contract; `svc-forum` is not. This Spec is therefore split into:

```text
STAGE_W = WORKFLOW_CANARY_GRANT_SUPPLY
STAGE_F = FORUM_CANARY_GRANT_SUPPLY

STAGE_W_AUTHORITY = CURRENT_V1_CONTRACT
STAGE_F_AUTHORITY = BLOCKED_BY_SVC_FORUM_AUDIENCE_CCR
```

Authorization is frozen as:

```text
TARGET_FINAL_GRANTS = 4 rows
STAGE_W_WRITES = 2 rows
STAGE_F_WRITES = 2 rows after forum CCR

CURRENTLY_AUTHORIZED_AFTER_THIS_SPEC =
  2 workflow rows, subject to remaining accepted gates

CONDITIONAL_FUTURE_ROWS =
  2 forum rows, blocked by forum CCR

FULL_FOUR_ROWS_READY = NO_UNTIL_FORUM_CCR
```

This accepted Spec authorizes only Stage W implementation through its
Contracts after this exact revision merges to `main`; Stage F remains blocked
per §3, and acceptance alone authorizes no production migration apply or
database write.

## 2. Scope and non-goals

### In scope

- Resolve only the two exact `MachineClient.external_ref` values in
  `DEC-CGS-001`, before any write, for audit client resolution only.
- Validate exact Client-to-Principal identity before writes.
- Stage W: create or no-op only the two `svc-workflow` rows in `DEC-CGS-002`.
- Stage F: define, but leave blocked, the two `svc-forum` rows in
  `DEC-CGS-002` until every frozen prerequisite in §3 holds.
- Validate frozen Audience and Scope registry facts.
- Record every real change in immutable `grant_change_audits` in the same
  serializable transaction, using only the current closed audit envelope.
- Define the per-client grant-set revision model, idempotency, optimistic
  concurrency, rollback, and isolation.

### Out of scope

- Creating, claiming, repairing, rotating, or revoking a Principal or Client.
- Adding an online Grant API or `machine-admin` Grant command.
- Reading or writing `MachineClient.allowedResources` or `allowedScopes`.
- Modifying the Minimal Auth V1 Contract, the Contract Bundle, or
  `grants.schema.json` in any way.
- Registering `svc-forum` into the frozen V1 Audience registry, or executing
  the `svc-forum` Audience CCR itself; that CCR is an external dependency.
- `workflow.execute`, `forum.admin`, `forum.moderate`, wildcards, or any other
  Scope, Audience, Client, or Principal.
- Selecting by display name, OpenClaw name, fuzzy query, prefix, or wildcard.
- Copying or unioning OpenClaw or existing Grants.
- Ownerless direct-token repair, deployment, canary execution, acceptance,
  merge, or rollback execution.

## 3. Authority and dependencies

`MINIMAL_AUTH_FOUNDATION_V1`, specifically
`docs/contracts/minimal-auth-v1/grants-and-audiences.md`, is the higher local
authority. It freezes audience-scoped Machine Grants, strict Scope rejection,
fixed-Git-SHA versioned migration supply, optimistic concurrency,
same-transaction audit, and forward-only rollback.

That Contract freezes the first V1 Audience batch as exactly:

```text
svc-workflow
svc-okr
adc-v2
```

and states explicitly that `svc-forum` is not part of this round's V1 Audience
registry and must enter through an independent CCR plus consumer migration
review.

The executable registry
(`contract-bundles/minimal-auth-v1/audience-registry.json`) currently also
contains a `svc-forum` entry. That executable presence does not confer
authority: this Spec MUST NOT infer forum grant authority from the executable
registry, and no implementation may do so either. The frozen Contract document
governs.

Stage F is therefore frozen as blocked:

```text
STAGE_F_PREREQUISITES =
  SVC_FORUM_AUDIENCE_CCR_ACCEPTED_AND_MERGED
  +
  SVC_FORUM_CONSUMER_MIGRATION_REVIEW_PASS
  +
  CONTRACT_BUNDLE_UPDATED_AND_VALIDATED

SVC_FORUM_GRANT_WRITES = FORBIDDEN
```

`SVC_FORUM_GRANT_WRITES` stays `FORBIDDEN` until every prerequisite above
holds simultaneously. Absence of any one keeps Stage F blocked with forum
writes `0`.

`AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` governs lifecycle and
evidence grammar but grants no product behavior authority. Agent Core receipts
are operational prerequisites, not external authority adopted by this Spec.

```text
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none

AMENDMENT_SCOPE = EXACT_STAGE_W_ARTIFACT_BOUNDARY_ONLY
AMENDMENT_SEMANTIC_DELTA_TO_ACCEPTED_STAGE_W_BEHAVIOR = NONE

STAGE_W_IMPLEMENTATION_AUTHORIZED =
  NO_UNTIL_THIS_EXACT_AMENDMENT_IS_ACCEPTED_AND_MERGED_TO_MAIN
STAGE_F_IMPLEMENTATION_AUTHORIZED = NO

STAGE_F_BLOCKED_BY =
  SVC_FORUM_AUDIENCE_CCR_ACCEPTED_AND_MERGED
  +
  SVC_FORUM_CONSUMER_MIGRATION_REVIEW_PASS
  +
  CONTRACT_BUNDLE_UPDATED_AND_VALIDATED

PRODUCTION_MIGRATION_APPLY_AUTHORIZED = NO
PRODUCTION_DB_WRITE_AUTHORIZED = NO
```

Only the two workflow Grants below may be implemented in the future; every
other object remains unauthorized:

```text
agt_stock_agent × svc-workflow[workflow.read]
agt_cto-agent  × svc-workflow[workflow.read]
```

`svc-forum` Grants, `workflow.execute`, `forum.admin`, `forum.moderate`, any
other Client/Audience/Scope, production migration apply, and production DB
writes are not authorized by this acceptance.

Changing `implementation_authority` or accepting this Spec is a semantic delta
that requires independent review of the exact resulting head; that review is
recorded in §15.

## 4. Current State

### STATE-CGS-001 — No reusable Grant supply authority exists

- Subject: auth-service Grant management and provisioning surfaces.
- As of commit: `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`.
- Environment: GitHub `main` source tree.
- Observed at: `2026-08-20`.
- Projection:
  - no formal Grant product API exists;
  - `machine-admin` has no Grant subcommand;
  - existing identity/Grant provisioners include paths that read or write
    legacy `allowedResources`/`allowedScopes`;
  - some historical paths lack complete Audience/Scope validation;
  - some create paths are not idempotent;
  - some Grant write paths have no `grant_change_audits` record;
  - historical direct DB writes and receipts are exceptions, not reusable
    authority;
  - generic S1/S2 Principal/Client creation explicitly creates no Grant.
- Basis: `OBS-CGS-001` through `OBS-CGS-005`, `EVD-CGS-001`.

```text
EXISTING_GRANT_SUPPLY_MECHANISM = NO
```

### STATE-CGS-002 — The closed schema can express the staged target

- Subject: V1 persistence, audit envelope, and frozen registry.
- As of commit: `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`.
- Environment: source schema and Contract Bundle.
- Observed at: `2026-08-20`.
- Projection: Client external refs are unique; Machine Grants use the composite
  Client/Audience key; immutable Grant audits enforce a closed 13-field JSON
  envelope (`additionalProperties: false`) whose before/after values must be
  complete `clientGrants` snapshots; both audiences are active, machine-enabled
  and Agent-accepting in the executable registry.
- Basis: `OBS-CGS-001`, `OBS-CGS-006`, `OBS-CGS-007`, `EVD-CGS-002`.

### STATE-CGS-003 — Forum authority is split between Contract and registry

- Subject: frozen Contract text versus executable Audience registry.
- As of commit: `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`.
- Environment: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` and
  `contract-bundles/minimal-auth-v1/audience-registry.json`.
- Observed at: `2026-08-20`.
- Projection: the Contract's first V1 Audience batch excludes `svc-forum` and
  requires an independent CCR plus consumer migration review for entry, while
  the executable registry already contains an active `svc-forum` entry. The
  Contract is the authority; the registry entry alone authorizes nothing.
- Basis: `OBS-CGS-006`, `EVD-CGS-004`.

```text
SVC_FORUM_CURRENT_AUTHORITY = NOT_IN_CURRENT_FROZEN_V1_CONTRACT
FORUM_CCR_REQUIRED = YES
```

## 5. Observations

### OBS-CGS-001 — V1 schema has audience-scoped Grants and a closed immutable audit envelope

- Subject: Prisma schema, additive V1 migration, and grants JSON schema.
- Repository/source: `mayf3/auth-service`.
- Commit/artifact: pinned main; `prisma/schema.prisma`,
  `prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql`,
  and `contract-bundles/minimal-auth-v1/schemas/grants.schema.json`.
- Environment: source tree; observed at: `2026-08-20`.
- Method: inspect models, keys, checks, indexes, audit trigger, and JSON
  schema definitions.
- Result: required V1 structures exist. `grant_change_audits` stores exactly
  the closed envelope `change_id`, `migration_id`, `source_git_commit`,
  `operator_id`, `approval_ref`, `reason`, `client_id`, `change_type`,
  `expected_grant_version`, `resulting_grant_version`, `before_value`,
  `after_value`, `timestamp`, with JSON schema
  `additionalProperties: false`; `before_value`/`after_value` must each be a
  complete `clientGrants` snapshot (`client_id`, `client_kind`,
  `principal_id`, `principal_type`, `human_audience_grants`,
  `machine_access_grants`, `delegation_grants`, `status`, `version`) or null.
  Audit uniqueness is `(migration_id, client_id, change_type)`.
  `MachineAccessGrant` carries a per-row `version` on the composite
  Client/Audience key; no per-client grant-set revision column exists, so the
  revision must be derived from the audit trail.
- Provenance: named files at the pinned commit.

### OBS-CGS-002 — machine-admin has no Grant command

- Subject: CLI dispatch; source: `src/cli/machine-admin.ts` at pinned main.
- Environment: source tree; observed at: `2026-08-20`.
- Method: inspect help, handlers, and dispatch.
- Result: only Principal create/inspect/disable and Client
  create/rotate/revoke/inspect exist.
- Provenance: named file.

### OBS-CGS-003 — Generic S1/S2 creation creates identity, not Grants

- Subject: generic idempotent routes, called S1/S2 by this Spec.
- Source: `src/routes/idempotent.ts` and `src/lib/oauth/v1/idempotent.ts` at
  pinned main; observed at: `2026-08-20`.
- Method: inspect schemas, calls, and Client create data.
- Result: S1 `POST /api/v1/principals` and S2 `POST /api/v1/clients` create or
  resolve identity only. New Clients receive empty legacy arrays; source states
  permissions are separate `MachineAccessGrant` facts. Neither route accepts or
  writes a Grant.
- Provenance: named files.

### OBS-CGS-004 — Existing broad backfill reads legacy flat fields

- Subject: V1 backfill planner; source: `scripts/backfill-minimal-auth-v1.ts`
  and `src/lib/oauth/v1/grant-migration.ts` at pinned main.
- Environment: source tree; observed at: `2026-08-20`.
- Method: inspect plan inputs and apply transaction.
- Result: the broad planner reads `allowedResources` and `allowedScopes` and
  derives Machine Grants. It is prohibited for this canary-only supply.
- Provenance: named files.

### OBS-CGS-005 — Historical Grant paths are not reusable authority

- Subject: historical migration and reconciliation receipts.
- Source: `prisma/migrations/20260722000100_ceo_client_okr_write_grant/migration.sql`,
  `docs/audits/runtime-reconciliation/RECEIPT_20260723000100_AGENT_GRANTS.md`,
  and `docs/audits/runtime-reconciliation/RECEIPT_20260724000100_PROVISIONING_BOOTSTRAP.md`
  at pinned main; observed at: `2026-08-20`.
- Method: inspect selection, audit, idempotency, and classification.
- Result: the CEO migration selects a fixed internal Client ID and omits
  `grant_change_audits`; receipts classify broad/manual SQL as non-Prisma or
  controlled bootstrap exceptions. None authorizes these canaries.
- Provenance: named files.

### OBS-CGS-006 — Registry presence and Contract authority diverge for svc-forum

- Subject: executable Audience registry versus frozen Contract text.
- Source: `contract-bundles/minimal-auth-v1/audience-registry.json`
  (registry_version `1.2.0`) and
  `docs/contracts/minimal-auth-v1/grants-and-audiences.md` at pinned main;
  observed at: `2026-08-20`.
- Method: inspect exact registry entries and the Contract's frozen first-batch
  Audience list.
- Result: the executable registry contains both `svc-workflow` and `svc-forum`
  as active, machine-enabled, Agent-accepting audiences registering all
  requested Scopes (`workflow.read`; `forum.read`, `forum.write`). However, the
  Contract's frozen first V1 Audience batch is exactly `svc-workflow`,
  `svc-okr`, `adc-v2`, and it states that `svc-forum` is not part of this
  round's registry and must enter through an independent CCR plus consumer
  migration review. Broader registered Workflow Scopes are not authorized
  here.
- Provenance: named files.

### OBS-CGS-007 — A serializable offline migration pattern exists

- Subject/source: `scripts/backfill-minimal-auth-v1.ts` at pinned main.
- Environment: source tree; observed at: `2026-08-20`.
- Method: inspect metadata validation and transaction isolation.
- Result: an offline script already requires migration metadata and commits
  data/audit in one Prisma `Serializable` transaction. Its broad planner is not
  reusable, but the closed offline execution shape is feasible after Clients
  exist.
- Provenance: named file.

### OBS-CGS-008 — Public machine client IDs use the mc_ prefix

- Subject: machine Client identifier surfaces.
- Source: `src/lib/oauth/v1/idempotent.ts` at pinned main; observed at
  `2026-08-20`.
- Method: inspect Client creation.
- Result: S2 machine Client creation assigns the public identifier as
  `mc_` + 24 random characters; `MachineClient.external_ref` is a separate
  nullable unique column. The audit envelope's `client_id` therefore denotes
  the Auth public `mc_*` client ID, not the external ref.
- Provenance: named file.

## 6. Claims and assumptions

### CLM-CGS-001 — No current path satisfies the complete authority

- Support state: SUPPORTED.
- Supported by: `EVD-CGS-001`; contradicted by: none known.
- Uncertainty: uncommitted or unrecorded operations cannot be authority.

### CLM-CGS-002 — Closed post-identity offline migration is feasible

- Support state: SUPPORTED.
- Supported by: `EVD-CGS-002`; contradicted by: none known.
- Uncertainty: later receipts must prove identities and readiness; this Spec
  does not claim those prerequisites currently hold.

### CLM-CGS-003 — One full-snapshot audit per changed Client per stage expresses the delta

- Support state: SUPPORTED.
- Supported by: `EVD-CGS-003`; contradicted by: none known.
- Uncertainty: none if before/after values are complete `clientGrants`
  snapshots; the closed envelope has no field for audience subsets, and none
  is needed.

### CLM-CGS-004 — The stage split resolves the forum authority conflict

- Support state: SUPPORTED.
- Supported by: `EVD-CGS-004`; contradicted by: none known.
- Uncertainty: Stage F remains definitional until the external forum CCR
  prerequisites hold.

## 7. Evidence relations

### EVD-CGS-001 — Surface inventory supports the absence Claim

- Source observations: `OBS-CGS-002` through `OBS-CGS-005`.
- Target: `CLM-CGS-001`, `STATE-CGS-001`; relation: SUPPORTS.
- Bound coordinates: pinned main, observed `2026-08-20`.
- Strength: sufficient for committed management/provisioning/history surfaces.
- Limitations: operation history remains descriptive, not authority.
- Provenance: observations above.

### EVD-CGS-002 — Schema, registry, and pattern support feasibility

- Source observations: `OBS-CGS-001`, `OBS-CGS-006`, `OBS-CGS-007`.
- Target: `CLM-CGS-002`, `STATE-CGS-002`; relation: SUPPORTS.
- Bound coordinates: pinned main, observed `2026-08-20`.
- Strength: sufficient to choose a bounded offline migration with the closed
  audit envelope.
- Limitations: does not approve execution or prove runtime identities.
- Provenance: observations above.

### EVD-CGS-003 — Closed envelope and audit uniqueness support per-Client-per-stage audits

- Source observations: `OBS-CGS-001`, `OBS-CGS-008`.
- Target: `CLM-CGS-003`; relation: SUPPORTS.
- Bound coordinates: pinned schema/migration/JSON schema.
- Strength: direct structural evidence.
- Limitations: audience identity is expressed only through the complete
  before/after snapshots because the envelope has no `audience_id` field and
  admits no additional properties.
- Provenance: named schema, migration, and JSON schema.

### EVD-CGS-004 — Contract text supports the blocked forum stage

- Source observations: `OBS-CGS-006`.
- Target: `CLM-CGS-004`, `STATE-CGS-003`; relation: SUPPORTS.
- Bound coordinates: pinned main contract document.
- Strength: direct frozen-contract statement.
- Limitations: does not predict when the forum CCR will complete.
- Provenance: named contract file.

## 8. Decisions

### DEC-CGS-001 — Select only deterministic Agent Core identities

- Decision owner: `mayf3` or delegated auth-service maintainer.
- Decision: only these Client refs may resolve:

  ```text
  agentcore:v1:client:agt_stock_agent
  agentcore:v1:client:agt_cto-agent
  ```

  They must bind, respectively, to exact Principal profiles:

  ```text
  external_ref=agentcore:v1:principal:agt_stock_agent agent_id=agt_stock_agent
  external_ref=agentcore:v1:principal:agt_cto-agent    agent_id=agt_cto-agent
  ```

  The deterministic external ref is a pre-write resolution input only. Each
  stage resolves it to exactly one Client and uses the resolved public `mc_*`
  client ID everywhere in audit records. The external ref itself MUST NOT be
  written into `grant_change_audits` JSON.

- Rejected: display/OpenClaw names, internal Client ID as selector,
  fuzzy/prefix/wildcard.
- Reason: deterministic external refs close the set independently of UUIDs.

### DEC-CGS-002 — Stage the four V1 Machine Grants by Audience authority

- Decision owner: same as `DEC-CGS-001`.
- Decision: the final four-row target is split by Audience authority:

  Stage W — authorized by the current frozen V1 Contract:

  | Client external ref | Audience | Exact scopes |
  |---|---|---|
  | `agentcore:v1:client:agt_stock_agent` | `svc-workflow` | `workflow.read` |
  | `agentcore:v1:client:agt_cto-agent` | `svc-workflow` | `workflow.read` |

  Stage F — defined now, blocked until every §3 prerequisite holds:

  | Client external ref | Audience | Exact scopes |
  |---|---|---|
  | `agentcore:v1:client:agt_stock_agent` | `svc-forum` | `forum.read`, `forum.write` |
  | `agentcore:v1:client:agt_cto-agent` | `svc-forum` | `forum.read`, `forum.write` |

- Rejected: authorizing forum rows from executable registry presence; treating
  "four grants now" as currently executable; union/copy or any additional
  privilege.
- Reason: the parent Contract excludes `svc-forum` from this round; least
  privilege for two declared canaries.

### DEC-CGS-003 — Use two closed offline fixed-SHA migrations, one per stage

- Decision owner: same as `DEC-CGS-001`.
- Decision: each stage is a repository-versioned offline migration executable
  from an independently reviewed exact SHA, after both Clients exist. Each
  plans read-only by default and requires explicit apply plus complete
  metadata. Stage W and Stage F are two different forward migrations; a single
  migration with conditional stage branches is prohibited. Neither is an HTTP
  route, generic Grant API, or CLI Grant command.
- Rejected: online management, ad-hoc SQL, broad backfill, legacy derivation,
  one combined conditional migration.
- Reason: satisfy frozen migration/audit authority, post-Client ordering, and
  the forum CCR gate between stages.

### DEC-CGS-004 — Preserve V1-only and forward-only boundaries

- Decision owner: same as `DEC-CGS-001`.
- Decision: read/write only V1 identity, Audience, Grant, and audit structures;
  rollback is a separately reviewed forward migration.
- Rejected: legacy mirror/fallback and old-migration reversal.
- Reason: prevent cross-Audience derivation and unaudited State.

### DEC-CGS-005 — Freeze per-client grant-set revision semantics

- Decision owner: same as `DEC-CGS-001`.
- Decision:

  ```text
  GRANT_SET_REVISION_SCOPE = PER_MACHINE_CLIENT
  REVISION_SOURCE_OF_TRUTH =
    latest successful grant_change_audits.resulting_grant_version
    for the exact client_id
  ```

  The revision is a property of the Client's complete grant set, not of any
  single `MachineAccessGrant` row. The per-row `version` column MUST NOT be
  read as the grant-set revision. Optimistic concurrency compares
  `expected_grant_version` against the audit-derived revision.

- Rejected: `MachineAccessGrant` single-row version as the revision; per-row
  increments driving the audit.
- Reason: one Client's grants across Audiences form one governed set with one
  audit-derived revision under the closed envelope.

### DEC-CGS-006 — Freeze the audit payload to the closed schema envelope

- Decision owner: same as `DEC-CGS-001`.
- Decision: every audit row this Spec's migrations write uses exactly the
  current `grantChangeAudit` envelope and nothing else:
  `change_id`, `migration_id`, `source_git_commit`, `operator_id`,
  `approval_ref`, `reason`, `client_id`, `change_type`,
  `expected_grant_version`, `resulting_grant_version`, `before_value`,
  `after_value`, `timestamp`. `client_id` is the Auth public `mc_*` client ID.
  `before_value` and `after_value` are complete `clientGrants` snapshots or
  null; partial Audience fragments are prohibited. `client_external_ref`,
  `changed_audiences`, and any other additional property are removed from this
  Spec and MUST NOT appear in any audit JSON.
- Rejected: extending the schema; adding convenience fields; recording only the
  changed Audience fragment.
- Reason: the current schema is `additionalProperties: false`; this Spec must
  express its audits within it without modification.

### DEC-CGS-007 — Partial Audience rollback uses replace with full snapshots

- Decision owner: same as `DEC-CGS-001`.
- Decision:

  ```text
  PARTIAL_AUDIENCE_ROLLBACK_CHANGE_TYPE = replace
  ```

  Removing some Audiences while preserving the Client's other Grants is a
  `replace` between two complete `clientGrants` snapshots. `revoke` with
  `after_value = null` is the wrong model for partial removal and MUST NOT be
  used by this Spec's rollbacks.
- Rejected: `revoke + after=null` for partial removal; audience-fragment
  snapshots.
- Reason: `revoke`/null after denotes removal of the entire governed grant set,
  which partial rollback does not do.

### DEC-CGS-008 — Freeze the Stage W implementation artifact boundary

- Decision owner: same as `DEC-CGS-001`.
- Decision: the Stage W repository-versioned offline migration executable MUST
  exist at exactly:

  ```text
  scripts/supply-agentcore-canary-workflow-grants-v1.ts
  ```

  The complete and exclusive Stage W implementation file set is:

  ```text
  scripts/supply-agentcore-canary-workflow-grants-v1.ts
  tests/oauth/supply-agentcore-canary-workflow-grants-v1.test.ts
  scripts/run-agentcore-canary-workflow-grants-v1-conformance.sh
  ```

  The test file MUST exercise the real migration executable, and the conformance
  harness MUST create, migrate, use, and drop an isolated temporary PostgreSQL
  database. It MUST apply the repository's production Prisma migrations rather
  than use `prisma db push`, because the raw-SQL audit constraints and immutable
  audit triggers are part of conformance. The migration and test are invoked
  directly with `tsx`; no `package.json`, Prisma schema, Prisma DDL migration,
  Contract Bundle, production configuration, application route, reusable
  library, receipt, or documentation file is part of the implementation change.
- Rejected: hidden chat-only path selection; a generic Grant library or online
  surface; extending an existing broad/Legacy migration; a Prisma DDL migration
  for this data-only supply; `prisma db push` as conformance setup; simulated
  in-memory persistence tests; and any implementation file outside the three
  exact paths above.
- Reason: close the implementation review surface without changing any accepted
  Stage W identity, Grant, transaction, audit, failure, or operational meaning.

### DEC-CGS-009 — Freeze the closed Stage W apply-evidence input

- Decision owner: same as `DEC-CGS-001`.
- Decision: read-only plan requires no operational evidence file. Explicit
  `--apply` MUST additionally require `--evidence-file <path>` naming a UTF-8
  JSON object with `additionalProperties: false` and exactly:

  ```text
  schema_version = 1
  phase_a_merge_ref = non-empty string
  identity_receipts = exactly two objects, each with only:
    client_external_ref
    principal_external_ref
    receipt_ref
  readiness = READY
  readiness_ref = non-empty string
  migration_review = object with only:
    verdict = PASS
    reviewed_source_git_commit = exact 40-hex migration HEAD
    review_ref = non-empty string
  ```

  The two identity receipt objects MUST match `DEC-CGS-001` exactly and no other
  identity may appear. The executor MUST also require a clean Git worktree,
  resolve `HEAD`, and prove it equals both audit `source_git_commit` and
  `migration_review.reviewed_source_git_commit` before any database write.
  `approval_ref`, `operator_id`, `migration_id`, and `reason` remain mandatory
  audit metadata under `CTR-CGS-008`; the evidence file does not add audit
  fields and is never persisted into the 13-field audit JSON.
- Rejected: truthy environment flags as evidence; unstructured prose evidence;
  optional readiness or review coordinates; accepting a different reviewed SHA;
  or adding evidence convenience properties to the audit envelope.
- Reason: make `CTR-CGS-010` executable without inventing hidden operator state
  or changing the closed audit schema.

## 9. Contracts

### CTR-CGS-001 — Closed target identities

Each stage's migration MUST contain exactly the two Client refs in
`DEC-CGS-001`. Each MUST resolve exactly one active Client bound to exactly one
active Principal with `principal_type=agent`, exact `agent_id`, and exact
Principal external ref. `owner_user_id` MAY be null. OpenClaw identities MUST
NOT be used. Missing, duplicate, inactive, wrongly bound, or mismatched State
MUST fail loudly with complete migration writes `0`. Resolution uses the
deterministic external ref; audit records use the resolved public `mc_*`
client ID, and the external ref MUST NOT appear in audit JSON.

### CTR-CGS-002 — Staged exact Grant rows

Stage W MUST create/preserve only the two `svc-workflow` keys and canonical
Scope arrays in `DEC-CGS-002`. Stage F, only when unblocked under `CTR-CGS-010`,
MUST create/preserve only the two `svc-forum` keys. While Stage F is blocked,
forum Grant writes MUST be `0`. Each stage MUST NOT authorize
`workflow.execute`, `forum.admin`, `forum.moderate`, wildcard, or any unlisted
object. Scope comparison uses unsigned-ASCII byte order.

### CTR-CGS-003 — Audience and Scope validation fails closed

Before writes, each Audience MUST exist exactly once, be active,
machine-enabled, accept Agent, and register every requested Scope. For
`svc-forum`, executable registry presence alone is insufficient: the frozen
Contract-level prerequisites of §3 MUST also hold. The migration MUST NOT
create/repair an Audience. Any mismatch fails loudly with writes `0`.

### CTR-CGS-004 — Per-stage existing-state outcomes

Each stage evaluates, per Client, the current complete grant set and the
audit-derived revision, then takes exactly one outcome:

- exact rerun: the current complete snapshot equals the stage's target
  end-state (including `version`) → no-op with Grant writes `0` and audit
  writes `0`;
- stage precondition match: the state equals the stage's required
  precondition → perform the stage's audited write path;
- anything else: conflict, fail loudly, writes `0`.

Stage W's precondition is: the Client has no existing governed Grant audit and
no `MachineAccessGrant` rows — any existing row or audit that is not exactly
the Stage W end-state is conflict. Stage F's precondition is: exactly the
Stage W end-state (workflow-only snapshot at revision `1`). No overwrite,
union, silent repair, or last-write-wins is permitted.

### CTR-CGS-005 — Plan before mutation

A complete plan MUST validate both Clients, the stage's Audiences, the stage's
Grants, current revisions and snapshots, and operator metadata before first
mutation. Any plan/apply failure MUST leave the database unchanged.

### CTR-CGS-006 — Serializable optimistic apply against the grant-set revision

Apply MUST use one serializable transaction and conditionally check the
audit-derived per-client grant-set revision (`DEC-CGS-005`), not per-row
versions. Stage W encodes `expected_grant_version = null` (no governed grant
set exists); Stage F encodes `expected_grant_version = 1`. A concurrent writer
that changes the grant set or revision first MUST turn the apply into
conflict/rollback.

### CTR-CGS-007 — Same-transaction immutable audit in the closed envelope

For each Client whose grant set changes, apply MUST write one
same-transaction `grant_change_audits` row using exactly the 13 envelope
fields of `DEC-CGS-006` — no `client_external_ref`, no `changed_audiences`, no
other additional property — with `client_id` as the resolved public `mc_*`
ID, and with `before_value`/`after_value` as complete `clientGrants` snapshots
(or null where the model below states). Audit failure rolls back all changes.
Exact no-op reruns MUST NOT add audit rows.

Stage W audit, per canary Client (two audits total):

```text
change_type            = create
expected_grant_version = null
resulting_grant_version = 1
before_value           = null
after_value            = complete clientGrants snapshot:
  client_kind            = machine
  principal_type         = agent
  human_audience_grants  = []
  machine_access_grants  = { "svc-workflow": ["workflow.read"] }
  delegation_grants      = {}
  status                 = active
  version                = 1
```

Stage F audit, per canary Client (two audits total), only after the §3 forum
prerequisites hold:

```text
change_type            = replace
expected_grant_version = 1
resulting_grant_version = 2
before_value           = complete snapshot: svc-workflow=[workflow.read],
                         version=1
after_value            = complete snapshot:
                         svc-workflow=[workflow.read],
                         svc-forum=[forum.read,forum.write], version=2
```

### CTR-CGS-008 — Metadata and SHA are mandatory

Apply MUST refuse before writes without all audit metadata. The executor MUST
verify source SHA equals the checked-out independently reviewed migration
revision and refuse a dirty artifact or mismatch.

### CTR-CGS-009 — Legacy fields are outside the data flow

The migrations MUST NOT read, write, derive from, mirror to, validate against,
or fall back to `allowedResources`/`allowedScopes`. Acceptance read/write
counts for both fields MUST be `0`.

### CTR-CGS-010 — Operational and authority prerequisites gate apply

Stage W apply MUST refuse unless durable evidence shows: Agent Core
clean-bootstrap Phase A merged; both canary identity pairs created; exact
identity receipts recorded; `(c)` readiness `READY`; migration SHA
independently reviewed; and operator `approval_ref` exists. Stage F apply MUST
refuse unless, in addition to the Stage W-style evidence for its own
migration, all three frozen prerequisites hold:
`SVC_FORUM_AUDIENCE_CCR_ACCEPTED_AND_MERGED`,
`SVC_FORUM_CONSUMER_MIGRATION_REVIEW_PASS`, and
`CONTRACT_BUNDLE_UPDATED_AND_VALIDATED`. Until then `SVC_FORUM_GRANT_WRITES =
FORBIDDEN`. This does not authorize identity creation or ownerless
direct-token repair.

### CTR-CGS-011 — Non-target data is invariant

No non-target Grant, Principal, Client, Audience, legacy field, or OpenClaw row
may change. Apart from target inserts and audit rows, observed columns MUST be
row/byte equivalent.

### CTR-CGS-012 — Rollback is staged forward migration with full-snapshot replaces

Rollback MUST be separately reviewed fixed-SHA forward migrations. Each
re-resolves the exact identities, requires the exact expected revision and
complete snapshot, removes only its target Audience, and writes one
same-transaction `replace` audit per Client in the closed envelope with
complete before/after snapshots. Missing/drift/concurrency fails with writes
`0`. Rollbacks MUST NOT edit old migration history, use unaudited SQL, touch
legacy fields, or affect others. `revoke` with null after MUST NOT express
partial removal.

Forum rollback (precondition revision `2`, workflow+forum snapshot):

```text
change_type             = replace
expected_grant_version  = 2
resulting_grant_version = 3
before_value            = complete snapshot: workflow+forum, version=2
after_value             = complete snapshot: workflow only, version=3
```

The workflow Grant MUST be preserved.

Workflow rollback (only after forum is gone; precondition revision `3`,
workflow-only snapshot):

```text
change_type             = replace
expected_grant_version  = 3
resulting_grant_version = 4
before_value            = complete snapshot: workflow only, version=3
after_value             = complete snapshot with machine_access_grants = {}
                         (empty grants snapshot, NOT null), version=4
```

Even when no `MachineAccessGrant` row remains, `after_value` MUST be the
complete `clientGrants` object, never null. If any Grant added outside this
Spec exists at rollback time, it MUST be preserved verbatim in both before and
after complete snapshots and only this Spec's target Audience removed; if
exact preservation cannot be proven, fail loudly with writes `0`.

### CTR-CGS-013 — One transaction per stage across both Clients

Each stage MUST complete all identity checks, revision checks, Grant writes,
and audit writes for both canary Clients in a single database transaction. Any
Client, Audience, Scope, revision, or audit validation failure MUST roll back
the entire stage with Grant writes `0` and audit writes `0`. Stage W and Stage
F MUST remain two different forward migrations and MUST NOT be merged into one
migration that waits on a conditional branch.

### CTR-CGS-014 — Every audit validates against the current schema

Every audit row this Spec defines — Stage W `create`, Stage F `replace`, forum
rollback `replace`, workflow rollback `replace` — MUST validate field-by-field
against the current `contract-bundles/minimal-auth-v1/schemas/grants.schema.json`
(`grantChangeAudit`, with before/after as `clientGrants`), with the schema
itself remaining unmodified.

### CTR-CGS-015 — Exact Stage W path and exclusive implementation file set

Stage W implementation MUST use exactly the migration path and three-file set in
`DEC-CGS-008`. An implementation diff that adds, removes, or modifies any other
file is outside this authority. The authorized test MUST execute the real
migration, and the authorized conformance harness MUST execute that test against
a fresh temporary PostgreSQL database after applying the repository's production
Prisma migrations. An in-memory model, mocked transaction, `prisma db push`, or
static-only test does not satisfy the database acceptance requirements. Direct
invocation with `tsx` MUST remain possible without adding a package script or
dependency.

### CTR-CGS-016 — Apply evidence is closed, exact, and SHA-bound

Stage W plan MUST remain read-only by default. Explicit apply MUST refuse before
database writes unless the exact evidence object in `DEC-CGS-009` and all audit
metadata in `CTR-CGS-008` validate. The two receipt identities, readiness value,
review verdict, reviewed SHA, current clean `HEAD`, and audit
`source_git_commit` MUST match exactly. Missing, additional, malformed,
misbound, dirty-worktree, or SHA-drifted evidence fails loudly with Grant writes
`0` and audit writes `0`. Evidence parsing MUST NOT read production data, mutate
receipts, or add any property to the closed audit envelope.

## 10. Acceptance

### ACC-CGS-001 — Exact identity selection

- Contracts: `CTR-CGS-001`.
- Method: isolated DB with exact pairs plus misleading names/OpenClaw/prefixes.
- Expected: only two exact refs resolve; failure: any alternate selector.

### ACC-CGS-002 — Identity failure is all-or-nothing

- Contracts: `CTR-CGS-001`, `CTR-CGS-005`.
- Method: unknown, duplicate-corruption, inactive, wrong binding/type/Agent/ref.
- Expected: fail-loud and writes `0`; failure: mutation or partial success.

### ACC-CGS-003 — Audience failure is closed

- Contracts: `CTR-CGS-003`, `CTR-CGS-005`.
- Method: remove/disable/alter each Audience and flags; for `svc-forum`, also
  simulate each missing §3 prerequisite.
- Expected: fail-loud, writes `0`; failure: repair or mutation.

### ACC-CGS-004 — Unknown Scope is rejected

- Contracts: `CTR-CGS-002`, `CTR-CGS-003`.
- Method: unregistered, wrong namespace/case, wildcard.
- Expected: reject before writes; failure: normalization/downscope/write.

### ACC-CGS-005 — Stage W supplies exactly two Grants with two create audits

- Contracts: `CTR-CGS-002`, `CTR-CGS-006`, `CTR-CGS-007`, `CTR-CGS-010`,
  `CTR-CGS-013`.
- Method: reviewed Stage W migration against valid pristine targets after
  supplying durable evidence for every execution prerequisite.
- Expected: two version-1 `svc-workflow` rows and two per-Client `create`
  audits; failure: any missing/extra/broader row or non-atomic audit.

### ACC-CGS-006 — Exact rerun is no-op

- Contracts: `CTR-CGS-004`, `CTR-CGS-007`.
- Method: rerun exact successful State of each stage.
- Expected: no duplicate or changed row/timestamp, no new audit; failure: any
  mutation.

### ACC-CGS-007 — Differences conflict

- Contracts: `CTR-CGS-004` through `CTR-CGS-006`.
- Method: Scope/version/revision/audit drift and concurrent insert/update.
- Expected: conflict, writes `0`; failure: overwrite/union/repair/partial
  audit.

### ACC-CGS-008 — Forbidden privilege is explicit

- Contracts: `CTR-CGS-002`.
- Method: request execute/admin/moderate/wildcard/other audience/client/OpenClaw.
- Expected: reject before writes; failure: forbidden privilege in plan or DB.

### ACC-CGS-009 — Legacy fields untouched

- Contracts: `CTR-CGS-009`.
- Method: static dependency test, instrumented access, before/after snapshot.
- Expected: reads `0`, writes `0`, byte-equivalent; failure: any data flow.

### ACC-CGS-010 — Audit complete and atomic

- Contracts: `CTR-CGS-006` through `CTR-CGS-008`, `CTR-CGS-013`,
  `CTR-CGS-014`.
- Method: validate fields/targets; inject audit failure and conflict.
- Expected: every change represented in one transaction per stage; failures
  leave no delta.
- Failure: unaudited/ambiguous/incomplete/partial result.

### ACC-CGS-011 — Only two canaries change

- Contracts: `CTR-CGS-011`.
- Method: relevant-table snapshot with non-target/OpenClaw sentinels.
- Expected: only the stage's Grants plus its two audits added; all else
  equivalent.
- Failure: any non-target delta.

### ACC-CGS-012 — Forward staged rollback is audited as replace

- Contracts: `CTR-CGS-012`.
- Method: separately reviewed rollbacks on exact State plus drift/concurrency.
- Expected: staged `replace` audits with complete snapshots per `CTR-CGS-012`;
  others unchanged; conflict variants write `0`.
- Failure: reversal/manual SQL/legacy/OpenClaw/non-target change/null-after
  partial removal.

### ACC-CGS-013 — Stage W implementation stays inside the exact artifact boundary

- Contracts: `CTR-CGS-015`.
- Method: compare the implementation diff against `DEC-CGS-008`; run
  `scripts/run-agentcore-canary-workflow-grants-v1-conformance.sh` and prove it
  applies production migrations to a fresh temporary PostgreSQL database, runs
  `tests/oauth/supply-agentcore-canary-workflow-grants-v1.test.ts`, and invokes
  the real executable at
  `scripts/supply-agentcore-canary-workflow-grants-v1.ts`.
- Expected: exactly those three files change; temporary PostgreSQL covers the
  positive, missing-identity, forbidden-Scope, exact-rerun, conflict, legacy
  non-access, non-target-invariance, transaction, and closed-audit cases.
- Failure: any fourth changed file, a different migration path, `prisma db push`,
  simulated or mocked persistence, or no execution of the real migration.

### ACC-CGS-014 — Apply evidence gates every write

- Contracts: `CTR-CGS-008`, `CTR-CGS-010`, `CTR-CGS-016`.
- Method: invoke plan without evidence; invoke apply with each required field
  missing, additional, malformed, identity-mismatched, readiness-not-READY,
  review-not-PASS, reviewed-SHA-mismatched, source-SHA-mismatched, and dirty-tree
  variant; then invoke with one exact valid temporary evidence file.
- Expected: plan remains read-only; every invalid apply variant fails before
  writes; the exact valid fixture passes the evidence gate and proceeds to the
  database plan/apply state machine.
- Failure: any invalid evidence reaches a write, plan requires apply evidence,
  or evidence properties enter `grant_change_audits`.

### Stage and audit-model acceptance (owner-frozen IDs)

### AC-AUTHORITY-1 — Contract exclusion blocks Stage F

While the parent Contract still excludes `svc-forum` from the frozen V1
Audience registry, Stage F MUST remain blocked and any attempted forum write
MUST produce writes `0`. Failure: any forum Grant or audit write under a
missing prerequisite.

### AC-AUTHORITY-2 — Only full prerequisites unblock Stage F

Stage F becomes executable only when the forum Audience CCR is accepted and
merged, the consumer migration review passes, and the updated Contract Bundle
validates. Failure: unblocking from registry presence or any single
prerequisite alone.

### AC-AUDIT-1 — Stage W audit passes the current schema

The Stage W `create` audit JSON MUST validate field-by-field against the
current `grants.schema.json` `grantChangeAudit`. Failure: any field rejected.

### AC-AUDIT-2 — Stage F replace audit passes the current schema

The Stage F `replace` audit JSON MUST validate field-by-field against the same
schema. Failure: any field rejected.

### AC-AUDIT-3 — No extra fields anywhere

No audit produced under this Spec may contain `client_external_ref`,
`changed_audiences`, or any property outside the 13-field envelope. Failure:
any additional property.

### AC-AUDIT-4 — Snapshots are complete

Every non-null `before_value`/`after_value` MUST be a complete `clientGrants`
snapshot with all nine required fields. Failure: partial Audience fragment.

### AC-ROLLBACK-1 — Forum rollback preserves workflow

After forum rollback, the `svc-workflow` Grant and its Scopes MUST remain,
with `resulting_grant_version = 3`. Failure: workflow loss or wrong revision.

### AC-ROLLBACK-2 — Workflow rollback ends at an empty snapshot, not null

After workflow rollback, `after_value` MUST be the complete `clientGrants`
object with `machine_access_grants = {}` and `version = 4`, never null.
Failure: null after or missing fields.

### AC-ROLLBACK-3 — Rollback revisions are exact

Forum and workflow rollbacks MUST produce `resulting_grant_version` `3` and
`4` respectively. Failure: any other revision.

### AC-NOOP — Exact rerun writes nothing

An exact rerun of a successful stage MUST write no Grant rows and no audit
rows. Failure: any write.

Contract validator coverage MUST exercise all four audit shapes — Stage W
`create`, Stage F `replace`, forum rollback `replace`, workflow rollback
`replace` — against the current unmodified schema.

## 11. Alternatives and disposition

### ALT-CGS-001 — Online Grant API

REJECTED. It requires a separate CCR for online operator authority and audit.

### ALT-CGS-002 — machine-admin Grant commands

REJECTED. This would create a broader reusable management surface.

### ALT-CGS-003 — Broad or legacy-derived provisioner

REJECTED. It violates closed V1-only identity and permission selection.

### ALT-CGS-004 — Historical manual SQL or receipts

REJECTED. Descriptive exceptions are not authority and do not provide the
required reusable audit contract.

### ALT-CGS-005 — One audit row per Client/Audience

REJECTED under the current schema. Two same-type rows violate the audit unique
key, so the per-Client-per-stage audit with complete snapshots is used.

### ALT-CGS-006 — Authorize forum now from the executable registry

REJECTED. The registry's active `svc-forum` entry does not amend the frozen
Contract; forum authority requires the independent CCR path.

### ALT-CGS-007 — One migration with conditional stage branches

REJECTED. Stage W and Stage F MUST be separate forward migrations so the forum
CCR gate stays a review boundary, not a runtime branch.

### ALT-CGS-008 — revoke with null after for partial rollback

REJECTED. Partial Audience removal is `replace` between complete snapshots;
`revoke + after=null` misrepresents the resulting governed State.

## 12. Migration, compatibility, and rollback

### Sequence

```text
1. Merge Agent Core clean-bootstrap Phase A.
2. Create both identity pairs outside this Spec.
3. Persist receipts and establish (c) readiness = READY.
4. Implement only under an accepted implementation-authorizing Spec revision.
5. Independently review the exact Stage W migration SHA.
6. Obtain approval_ref.
7. Run read-only Stage W plan and require exact result.
8. Explicitly apply Stage W once and persist receipt.
9. Verify ACC-CGS-001 through ACC-CGS-011 before canary use.
10. Complete the forum Audience CCR: accepted and merged.
11. Pass the svc-forum consumer migration review.
12. Update and validate the Contract Bundle for svc-forum.
13. Independently review the exact Stage F migration SHA.
14. Run read-only Stage F plan and require exact result.
15. Explicitly apply Stage F once and persist receipt.
```

The migrations MUST NOT be coupled to S1/S2 or deployed before identities and
receipts exist. Stage F MUST NOT be planned against a database whose Contract
prerequisites are unmet.

```text
V1_MACHINE_ACCESS_GRANT_ONLY = YES
LEGACY_FIELDS_TOUCHED = NO
ONLINE_API_ADDED = NO
OPENCLAW_ESTATE_TOUCHED = NO
TOKEN_CONTRACT_CHANGED = NO
AUDIT_SCHEMA_CHANGED = NO
CONTRACT_BUNDLE_MODIFIED = NO
STAGE_COUNT = 2
```

Rollback follows `CTR-CGS-012`/`ACC-CGS-012`/`AC-ROLLBACK-1` through
`AC-ROLLBACK-3` as staged forward migrations; this proposed revision does not
authorize their execution.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
OWNER_DECISION_REQUIRED = NONE

FORUM_CCR_REQUIRED = YES
FORUM_CCR_OWNER = external (Minimal Auth V1 Contract change process)
FULL_FOUR_ROWS_READY = NO_UNTIL_FORUM_CCR
```

The forum CCR is an external dependency tracked outside this Spec, not an open
owner decision of this Spec.

Ready for independent semantic review is not acceptance, implementation
authority, deployment readiness, or proof that prerequisites hold.

## 14. Review and revision record

### Round 1 — initial proposed Spec

- Head: `80855cd0f068a0e0be1bc2406f1fae510b29e23f` (PR #5, draft).
- Independent review verdict: `REVISE`, with three blockers.

### Round 2 — this revision (blocker fixes only)

- Review base: `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`.
- Blocker 1 (svc-forum authority conflict): fixed by the Stage W / Stage F
  split with `STAGE_F_AUTHORITY = BLOCKED_BY_SVC_FORUM_AUDIENCE_CCR`, frozen
  prerequisites, `SVC_FORUM_GRANT_WRITES = FORBIDDEN`, and removal of any
  claim that the current frozen Contract registers `svc-forum` (§1, §3, §4
  STATE-CGS-003, §5 OBS-CGS-006, §8 DEC-CGS-002, §10 AC-AUTHORITY-1/2,
  §11 ALT-CGS-006).
- Blocker 2 (audit payload incompatible with current schema): fixed by
  freezing the 13-field closed envelope, removing `client_external_ref`,
  `changed_audiences`, and all other additional properties; `client_id` is the
  public `mc_*` ID; before/after are complete `clientGrants` snapshots
  (§5 OBS-CGS-001/OBS-CGS-008, §8 DEC-CGS-006, §9 CTR-CGS-007/CTR-CGS-014,
  §10 AC-AUDIT-1 through AC-AUDIT-4).
- Blocker 3 (partial rollback not expressible): fixed by
  `PARTIAL_AUDIENCE_ROLLBACK_CHANGE_TYPE = replace` with complete before/after
  snapshots, staged revisions `2→3` (forum, preserving workflow) and `3→4`
  (workflow, empty snapshot, never null), and external-grant preservation
  (§8 DEC-CGS-007, §9 CTR-CGS-012, §10 AC-ROLLBACK-1 through AC-ROLLBACK-3,
  §11 ALT-CGS-008).
- Additionally frozen per review instruction: per-client grant-set revision
  semantics (§8 DEC-CGS-005), two separate forward migrations with one
  transaction per stage across both Clients (§8 DEC-CGS-003, §9
  CTR-CGS-013), and staged authorization counts (`STAGE_W_WRITES = 2 rows`,
  `STAGE_F_WRITES = 2 rows after forum CCR`).
- This round changes only this Spec file: no product code, no Contract Bundle,
  no audit schema, no migration, no Grant creation, no database write, no
  merge, and PR #5 remains a draft awaiting focused re-review.

## 15. Acceptance record

```text
ACCEPTANCE_REVIEW =
  授权审计（二轮）

REVIEWED_BASE =
  1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9

REVIEWED_SPEC_HEAD =
  67a1e80fae2700bf0efe3a587b4c7a00807c274d

REVIEW_VERDICT = PASS
REQUIRED_FIXES = NONE
READY_FOR_ACCEPTANCE_FINALIZE = YES

ACCEPTED_AT = 2026-08-20
ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = NONE
```

Acceptance finalize is text-only: frontmatter
`status: proposed -> accepted` and
`implementation_authority: none -> contracts`, the stage-split implementation
authority of §3, this record, and the lifecycle mirror in `docs/specs/README.md`.
All reviewed semantics of head `67a1e80` — the two-stage model, forum authority
blocker, 13-field closed audit envelope, full `clientGrants` snapshots,
per-client revision model, Stage W create audit, Stage F replace audit, forum
rollback `2→3`, workflow rollback `3→4`, replace/full-snapshot partial
rollback, no legacy flat fields, exact rerun no-op, and single transaction per
Stage — are preserved unchanged. Implementation authority vests only when this
exact accepted revision merges to `main`, Stage W only; Stage F stays blocked
per §3.

## 16. Additive amendment record — exact Stage W artifact boundary

```text
AMENDMENT_KIND = STRICTLY_ADDITIVE
AMENDMENT_BASE = cb0b3d37dfb105c763c9c83ebd65483270b21b81
AMENDED_ACCEPTED_SPEC_BLOB = d89bf08c8714f55571ee7d75da017b7cf7237096
ADDED_DECISIONS = DEC-CGS-008 | DEC-CGS-009
ADDED_CONTRACTS = CTR-CGS-015 | CTR-CGS-016
ADDED_ACCEPTANCE = ACC-CGS-013 | ACC-CGS-014
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

This amendment closes three implementation coordinates that the accepted
revision left implicit: the exact Stage W executable path, its exclusive
implementation file set, and the closed evidence input required to make the
existing operational apply gate executable. It does not change any existing
stable ID or any accepted Stage W
identity, Grant, Scope, revision, transaction, audit, idempotency, conflict,
operational prerequisite, production-apply, Stage F, rollback, or non-target
meaning. Until this exact amendment is independently reviewed, accepted, and
merged to `main`, it authorizes no implementation.
