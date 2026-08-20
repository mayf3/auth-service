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

Freeze an extremely narrow, fail-closed authority for supplying exactly four
V1 `MachineAccessGrant` rows to the deterministic auth-service clients of two
Agent Core canary Agents:

```text
CANARY_AGENTS = agt_stock_agent | agt_cto-agent
AUTHORIZED_CLIENTS = 2
AUTHORIZED_AUDIENCES_PER_CLIENT = 2
AUTHORIZED_GRANT_ROWS = 4
FIXED_GIT_SHA_VERSIONED_MIGRATION = REQUIRED
V1_MACHINE_ACCESS_GRANT_ONLY = YES
```

This proposed Spec does not authorize implementation or any database write.

## 2. Scope and non-goals

### In scope

- Resolve only the two exact `MachineClient.external_ref` values in `DEC-CGS-001`.
- Validate exact Client-to-Principal identity before writes.
- Create or no-op only the four `(machine_client_id, audience_id)` rows in
  `DEC-CGS-002`.
- Validate frozen Audience and Scope registry facts.
- Record every real change in immutable `grant_change_audits` in the same
  serializable transaction.
- Define idempotency, optimistic concurrency, rollback, and isolation.

### Out of scope

- Creating, claiming, repairing, rotating, or revoking a Principal or Client.
- Adding an online Grant API or `machine-admin` Grant command.
- Reading or writing `MachineClient.allowedResources` or `allowedScopes`.
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

`AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` governs lifecycle and evidence
grammar but grants no product behavior authority. Agent Core receipts are
operational prerequisites, not external authority adopted by this Spec.

```text
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_AUTHORIZED = NO
DATABASE_WRITES_AUTHORIZED = NO
```

Changing `implementation_authority` or accepting this Spec is a semantic delta
that requires independent review of the exact resulting head.

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

### STATE-CGS-002 — The schema can express the bounded target

- Subject: V1 persistence and frozen registry.
- As of commit: `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`.
- Environment: source schema and Contract Bundle.
- Observed at: `2026-08-20`.
- Projection: Client external refs are unique; Machine Grants use the composite
  Client/Audience key and have version; both audiences are active,
  machine-enabled and Agent-accepting; immutable Grant audits store the required
  provenance and before/after facts.
- Basis: `OBS-CGS-001`, `OBS-CGS-006`, `OBS-CGS-007`, `EVD-CGS-002`.

## 5. Observations

### OBS-CGS-001 — V1 schema has audience-scoped Grants and immutable audits

- Subject: Prisma schema and additive V1 migration.
- Repository/source: `mayf3/auth-service`.
- Commit/artifact: pinned main; `prisma/schema.prisma` and
  `prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql`.
- Environment: source tree; observed at: `2026-08-20`.
- Method: inspect models, keys, checks, indexes, and audit trigger.
- Result: required V1 structures exist. Audit uniqueness is
  `(migration_id, client_id, change_type)`, preventing two separate `create`
  audit rows for one Client in one migration.
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

### OBS-CGS-006 — Required audiences and scopes are frozen

- Subject: executable Audience registry.
- Source: `contract-bundles/minimal-auth-v1/audience-registry.json` at pinned
  main; observed at: `2026-08-20`.
- Method: inspect exact entries.
- Result: `svc-forum` and `svc-workflow` are active, machine-enabled, accept
  Agent, and register all requested Scopes. Broader registered Workflow Scopes
  are not authorized here.
- Provenance: named file.

### OBS-CGS-007 — A serializable offline migration pattern exists

- Subject/source: `scripts/backfill-minimal-auth-v1.ts` at pinned main.
- Environment: source tree; observed at: `2026-08-20`.
- Method: inspect metadata validation and transaction isolation.
- Result: an offline script already requires migration metadata and commits
  data/audit in one Prisma `Serializable` transaction. Its broad planner is not
  reusable, but the closed offline execution shape is feasible after Clients
  exist.
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

### CLM-CGS-003 — One audit per changed Client can cover both audiences

- Support state: SUPPORTED.
- Supported by: `EVD-CGS-003`; contradicted by: none known.
- Uncertainty: none if JSON snapshots enumerate both targets and changed subset.

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
- Strength: sufficient to choose a bounded offline migration.
- Limitations: does not approve execution or prove runtime identities.
- Provenance: observations above.

### EVD-CGS-003 — Audit uniqueness supports Client-batch audit

- Source observations: `OBS-CGS-001`.
- Target: `CLM-CGS-003`; relation: SUPPORTS.
- Bound coordinates: pinned schema/migration.
- Strength: direct structural evidence.
- Limitations: audience identity must be explicit in audit JSON because the
  table has no `audience_id` column.
- Provenance: named schema and migration.

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

- Rejected: display/OpenClaw names, internal Client ID, fuzzy/prefix/wildcard.
- Reason: deterministic external refs close the set independently of UUIDs.

### DEC-CGS-002 — Authorize only four V1 Machine Grants

- Decision owner: same as `DEC-CGS-001`.
- Decision:

  | Client external ref | Audience | Exact scopes |
  |---|---|---|
  | `agentcore:v1:client:agt_stock_agent` | `svc-forum` | `forum.read`, `forum.write` |
  | `agentcore:v1:client:agt_stock_agent` | `svc-workflow` | `workflow.read` |
  | `agentcore:v1:client:agt_cto-agent` | `svc-forum` | `forum.read`, `forum.write` |
  | `agentcore:v1:client:agt_cto-agent` | `svc-workflow` | `workflow.read` |

- Rejected: union/copy or any additional privilege.
- Reason: least privilege for two declared canaries.

### DEC-CGS-003 — Use a closed offline fixed-SHA migration

- Decision owner: same as `DEC-CGS-001`.
- Decision: use a repository-versioned offline migration executable from an
  independently reviewed exact SHA, after both Clients exist. It plans
  read-only by default and requires explicit apply plus complete metadata. It is
  not an HTTP route, generic Grant API, or CLI Grant command.
- Rejected: online management, ad-hoc SQL, broad backfill, legacy derivation.
- Reason: satisfy frozen migration/audit authority and post-Client ordering.

### DEC-CGS-004 — Preserve V1-only and forward-only boundaries

- Decision owner: same as `DEC-CGS-001`.
- Decision: read/write only V1 identity, Audience, Grant, and audit structures;
  rollback is a separately reviewed forward migration.
- Rejected: legacy mirror/fallback and old-migration reversal.
- Reason: prevent cross-Audience derivation and unaudited State.

## 9. Contracts

### CTR-CGS-001 — Closed target identities

The migration MUST contain exactly the two Client refs in `DEC-CGS-001`. Each
MUST resolve exactly one active Client bound to exactly one active Principal
with `principal_type=agent`, exact `agent_id`, and exact Principal external ref.
`owner_user_id` MAY be null. OpenClaw identities MUST NOT be used. Missing,
duplicate, inactive, wrongly bound, or mismatched State MUST fail loudly with
complete migration writes `0`.

### CTR-CGS-002 — Exactly four Grant rows

The migration MUST create/preserve only the four keys and canonical Scope arrays
in `DEC-CGS-002`. It MUST NOT authorize `workflow.execute`, `forum.admin`,
`forum.moderate`, wildcard, or any unlisted object. Scope comparison uses
unsigned-ASCII byte order.

### CTR-CGS-003 — Audience and Scope validation fails closed

Before writes, each Audience MUST exist exactly once, be active,
machine-enabled, accept Agent, and register every requested Scope. The migration
MUST NOT create/repair an Audience. Any mismatch fails loudly with writes `0`.

### CTR-CGS-004 — Existing Grant State has three outcomes

For each target key: absent with no prior revoke marker is insertable at
`version=1`; present with exact canonical Scopes, `version=1`, active identities,
and no prior revoke marker is no-op; any other Scope/version/revoke/audit State
is conflict and full rollback. No overwrite, replace, union, silent repair, or
last-write-wins is permitted.

### CTR-CGS-005 — Plan before mutation

A complete plan MUST validate both Clients, both Audiences, all four Grants,
prior revoke/audit markers, and operator metadata before first mutation. Any
plan/apply failure MUST leave the database unchanged.

### CTR-CGS-006 — Serializable optimistic apply

Apply MUST use one serializable transaction and lock or conditionally check
expected identity, Audience, and Grant values. Absent Grant expectation is
`ABSENT`, encoded `expected_grant_version=null` under the current schema; its
composite primary key and serializable transaction turn concurrent insert into
conflict/rollback. Present exact Grant requires expected version `1`.

### CTR-CGS-007 — Same-transaction immutable audit

For each Client with new target Grants, apply MUST write one same-transaction
`grant_change_audits` row containing migration ID, exact reviewed 40-hex source
SHA, operator ID, approval ref, reason, timestamp, Client ID/ref, `create`,
expected `null` (ABSENT), resulting version `1`, explicit before/after snapshots,
both target audiences/scopes, and `changed_audiences`. One Client-batch row is
REQUIRED by current audit uniqueness. Audit failure rolls back all changes.
Exact no-op reruns MUST NOT add audit rows.

### CTR-CGS-008 — Metadata and SHA are mandatory

Apply MUST refuse before writes without all audit metadata. The executor MUST
verify source SHA equals the checked-out independently reviewed migration
revision and refuse a dirty artifact or mismatch.

### CTR-CGS-009 — Legacy fields are outside the data flow

The migration MUST NOT read, write, derive from, mirror to, validate against, or
fall back to `allowedResources`/`allowedScopes`. Acceptance read/write counts
for both fields MUST be `0`.

### CTR-CGS-010 — Operational prerequisites gate apply

Apply MUST refuse unless durable evidence shows: Agent Core clean-bootstrap
Phase A merged; both canary identity pairs created; exact identity receipts
recorded; `(c)` readiness `READY`; migration SHA independently reviewed; and
operator `approval_ref` exists. This does not authorize identity creation or
ownerless direct-token repair.

### CTR-CGS-011 — Non-target data is invariant

No non-target Grant, Principal, Client, Audience, legacy field, or OpenClaw row
may change. Apart from target inserts and audit rows, observed columns MUST be
row/byte equivalent.

### CTR-CGS-012 — Rollback is a new forward migration

Rollback MUST be separately reviewed fixed-SHA forward migration. It re-resolves
the exact identities, requires all four exact Scope sets at version `1`, removes
only them, and writes one same-transaction `revoke` audit per Client encoding
both audiences, expected version `1`, before snapshot, null after, metadata, and
rollback SHA. Missing/drift/concurrency fails with writes `0`. It MUST NOT edit
old migration history, use unaudited SQL, touch legacy fields, or affect others.

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
- Method: remove/disable/alter each Audience and flags.
- Expected: fail-loud, writes `0`; failure: repair or mutation.

### ACC-CGS-004 — Unknown Scope is rejected

- Contracts: `CTR-CGS-002`, `CTR-CGS-003`.
- Method: unregistered, wrong namespace/case, wildcard.
- Expected: reject before writes; failure: normalization/downscope/write.

### ACC-CGS-005 — Exactly four Grants are supplied

- Contracts: `CTR-CGS-002`, `CTR-CGS-006`, `CTR-CGS-007`, `CTR-CGS-010`.
- Method: reviewed migration against valid absent targets after supplying
  durable evidence for every execution prerequisite.
- Expected: four version-1 rows and two Client-batch audits; failure: any
  missing/extra/broader row or non-atomic audit.

### ACC-CGS-006 — Exact rerun is no-op

- Contracts: `CTR-CGS-004`, `CTR-CGS-007`.
- Method: rerun exact successful State.
- Expected: no duplicate or changed row/timestamp; failure: any mutation.

### ACC-CGS-007 — Differences conflict

- Contracts: `CTR-CGS-004` through `CTR-CGS-006`.
- Method: Scope/version/revoke/audit drift and concurrent insert/update.
- Expected: conflict, writes `0`; failure: overwrite/union/repair/partial audit.

### ACC-CGS-008 — Forbidden privilege is explicit

- Contracts: `CTR-CGS-002`.
- Method: request execute/admin/moderate/wildcard/other audience/client/OpenClaw.
- Expected: reject before writes; failure: forbidden privilege in plan or DB.

### ACC-CGS-009 — Legacy fields untouched

- Contracts: `CTR-CGS-009`.
- Method: static dependency test, instrumented access, before/after snapshot.
- Expected: reads `0`, writes `0`, byte-equivalent; failure: any data flow.

### ACC-CGS-010 — Audit complete and atomic

- Contracts: `CTR-CGS-006` through `CTR-CGS-008`.
- Method: validate fields/targets; inject audit failure and conflict.
- Expected: every change represented in transaction; failures leave no delta.
- Failure: unaudited/ambiguous/incomplete/partial result.

### ACC-CGS-011 — Only two canaries change

- Contracts: `CTR-CGS-011`.
- Method: relevant-table snapshot with non-target/OpenClaw sentinels.
- Expected: only four Grants plus two audits added; all else equivalent.
- Failure: any non-target delta.

### ACC-CGS-012 — Forward rollback is audited

- Contracts: `CTR-CGS-012`.
- Method: separately reviewed rollback on exact State plus drift/concurrency.
- Expected: four Grants removed and two revoke audits; others unchanged;
  conflict variants write `0`.
- Failure: reversal/manual SQL/legacy/OpenClaw/non-target change.

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
key, so the explicit and independently testable Client-batch audit is used.

## 12. Migration, compatibility, and rollback

### Sequence

```text
1. Merge Agent Core clean-bootstrap Phase A.
2. Create both identity pairs outside this Spec.
3. Persist receipts and establish (c) readiness = READY.
4. Implement only under an accepted implementation-authorizing Spec revision.
5. Independently review exact migration SHA.
6. Obtain approval_ref.
7. Run read-only plan and require exact result.
8. Explicitly apply once and persist receipt.
9. Verify ACC-CGS-001 through ACC-CGS-011 before canary use.
```

The migration MUST NOT be coupled to S1/S2 or deployed before identities and
receipts exist.

```text
V1_MACHINE_ACCESS_GRANT_ONLY = YES
LEGACY_FIELDS_TOUCHED = NO
ONLINE_API_ADDED = NO
OPENCLAW_ESTATE_TOUCHED = NO
TOKEN_CONTRACT_CHANGED = NO
```

Rollback follows `CTR-CGS-012`/`ACC-CGS-012`; this proposed revision does not
authorize its execution.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
OWNER_DECISION_REQUIRED = NONE
```

Ready for independent semantic review is not acceptance, implementation
authority, deployment readiness, or proof that prerequisites hold.
