---
spec_id: AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/auth-service canonical identity persistence and internal resolution foundation
  - isolated conformance only; no production activation or business write integration
governed_by: [MINIMAL_AUTH_FOUNDATION_V2, AUTH_SERVICE_AGENT_IDENTITY_CANONICALIZATION_PROGRAM_V1]
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# Canonical identity foundation

## Goal, mandate and route

Give Auth one explicit lifecycle and direct successor truth alongside its existing
immutable Principal identity, with a shared fail-closed resolver for later write
adapters. This is the foundation slice of the accepted Program, not a declaration
that production writes are canonical or that the census is complete.

Base: `60c59792e9497f62e001388cfe8272cf99dfa832`.
Owner mandate: `UNBLOCK_IDENTITY_CANONICALIZATION_PROGRAM`, 2026-09-14,
sections 2, 3A, 8, 10 and 11; child review/acceptance/source merge is preauthorized
only within the accepted Program. No secret read, permission expansion, guessed
successor, HUMAN/AGENT cast, physical deletion or immutable history rewrite.

```text
AUTHORITY_ACTION = NEW
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

## Observations and preserved authority

OBS-CIF-001: at Base, `prisma/schema.prisma` MachinePrincipal owns unique nullable
`agentId` and unique `externalRef`; Principal status alone has no explicit canonical
classification. MachineClient is many-to-one and must remain so.
OBS-CIF-002: `src/lib/oauth/v1/agent-principal-resolution.ts` exact read intentionally
returns stored legacy Agent IDs. Its accepted V2 and the internal directory V1
retain their routes, authorization, response/error and disabled/history semantics.
OBS-CIF-003: Program investigation records 87 independently verified successor
pairs, but neither the investigation nor this Spec authorizes their activation.
EVD-CIF-001 supports CLM-CIF-001 (SUPPORTED): a separate explicit lifecycle and
strict boundary are needed. Coordinates are the Base and the named files; source
review proves the storage/interface gap, not a production data or readiness claim.

`AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1` ownerless/profile semantics,
`AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1` opaque provisioning keys and bounded
external-ref reads, and Minimal Auth subject/client/Grant/claim semantics remain
unchanged. No existing resolver is superseded by this independent internal seam.

## Decisions

DEC-CIF-001: reuse MachinePrincipal identity; add one Auth-owned lifecycle table
and one Auth-owned direct successor table. No consumer-owned canonical database.
DEC-CIF-002: missing lifecycle means unresolved. Regex and Auth active alone never
promote an existing row. Schema installation classifies nobody automatically.
DEC-CIF-003: strict admission and explicit migration lookup are different functions.
DEC-CIF-004: this first slice exports read-only library interfaces and DB invariant
DDL; a later owning child must integrate lifecycle management and every business
write effect. No production enrollment/import/retirement command is supplied here.

## Contracts

### CTR-CIF-001 — Persistence and classification

Add `agent_identity_lifecycle` with `principal_id` UUID primary key and restrictive
FK to `machine_principals.id`, `state` in `unresolved|canonical|legacy|retired`,
`revision` positive bigint, `evidence_ref` nonempty text, `created_at`, `updated_at`.
Every recorded row must refer to an AGENT Principal. Absence is unresolved, not
legacy or canonical. A canonical row requires active AGENT Principal, non-null
Agent ID matching exact `^agt_[a-z0-9-]+$`, total length 5..128. Existing unique
MachinePrincipal.agentId supplies the reverse relation. No duplicate identity
column, replacement Principal UUID, client uniqueness, or human owner requirement.

Add `agent_identity_successors` with `source_principal_id` UUID primary key,
`target_principal_id` UUID non-null, restrictive FKs to MachinePrincipal,
`evidence_ref` nonempty text and `created_at`. Target is not unique: multiple
proven historical generations may converge on one logical canonical Agent.
Source and target differ. Source must have explicit legacy or retired lifecycle;
target must have explicit canonical lifecycle. Both are AGENT. No successor source
may also be a target. No canonical target may itself have a successor. Thus all
accepted mappings are direct leaves; chains and cycles are rejected, not followed.
Evidence references are provenance, never proof by themselves or credentials.

### CTR-CIF-002 — Database invariant concurrency

DDL enforces enums, keys, restrictive FKs and shape checks. Cross-table invariant
triggers serialize affected lifecycle/successor/Principal identity-status changes
using one transaction-scoped advisory lock and validate the affected graph before
transaction commit. Concurrent attempts cannot create a chain/cycle, make an
existing target noncanonical, or invalidate an enrolled canonical Principal's
active/type/ID conditions. Existing unresolved Principal rows retain prior behavior.
Constraint failure rolls back the entire transaction. No application-only precheck
may substitute for DB integrity. Out-of-band privileged DDL bypass is outside this
application guarantee and is not authorized by this Spec.

The new tables are append-preserving evidence surfaces: application operations must
not DELETE lifecycle/successor rows, mutate existing source/target/evidence identity,
or change retired back to another state. Revision must increase exactly by one
when lifecycle state or evidence changes; same state no-write readback is permitted.
Canonical to legacy/retired with incoming successors is rejected until a separately
authorized controlled whole-graph migration resolves the dependency. This Spec
contains no such graph folding operation. Principal deletion with a lifecycle or
successor reference is prohibited by restrictive FKs.

### CTR-CIF-003 — Strict read boundary

Export `resolveCanonicalByPrincipal(principalId)`, `resolveCanonicalByAgent(agentId)`
and `validateCanonicalPair({principalId,agentId})` from one internal module. Accept
only exact typed identifiers; no displayName, external_ref, punctuation rewrite,
client ID or fallback. UUID input may normalize hex case only. Result is exactly
`{principalId, agentId, lifecycleRevision, resolvedViaLegacy:false}`. Revision is a
decimal string to preserve bigint precision. Agent ID is the stored exact value.

Read Principal/lifecycle/reverse uniqueness in one read-only RepeatableRead snapshot;
query cardinality is bounded to detect duplicate relations. Validate syntax first,
then existence, AGENT type, active status, explicit canonical lifecycle and reverse
pair agreement. Missing lifecycle, disabled, legacy, retired and unresolved always
fail. Pair validation never resolves one input and ignores a mismatch in the other.

Closed errors: `INVALID_IDENTITY_INPUT` (400), `IDENTITY_NOT_FOUND` (404),
`IDENTITY_NOT_AGENT` (409), `IDENTITY_INACTIVE` (409),
`IDENTITY_NOT_CANONICAL` (409), `IDENTITY_PAIR_MISMATCH` (409),
`IDENTITY_INCONSISTENT` (409), `IDENTITY_READ_TIMEOUT` (503),
`IDENTITY_READ_UNAVAILABLE` (503). Error objects contain code and status only;
no SQL, credentials, raw records or exception cause reaches a consumer response.
Whole operation deadline is 5000ms, no automatic retry; late query completion
cannot overwrite the terminal result or write anything.

### CTR-CIF-004 — Explicit migration-only read

Export `resolveSuccessorForMigration({sourcePrincipalId})` separately. It requires
an exact UUID and an explicit direct successor row; canonical input without one
returns `SUCCESSOR_NOT_FOUND` (404), never an implicit identity NOOP. Verify source
AGENT/lifecycle, unique direct edge and canonical active target/reverse binding in
one read-only snapshot. Return exactly `{sourcePrincipalId, principalId, agentId,
lifecycleRevision, resolvedViaLegacy:true, evidenceRef}`. Missing mapping returns
`SUCCESSOR_NOT_FOUND`; inconsistent graph returns `IDENTITY_INCONSISTENT`;
other failures reuse CTR-CIF-003. It neither edits a mapping nor authorizes apply.

No HTTP route, public export package, audience/scope/Grant or caller impersonation
is created. Only later explicitly governed management/history adapters may expose
this seam using their existing legitimate authorization. Ordinary write adapters
must call CTR-CIF-003 and cannot accept `resolvedViaLegacy:true` as admission.

### CTR-CIF-005 — Auth/Core ownership and freshness

This library proves Auth's persisted binding only. Core independently owns exact
Agent Definition existence/enabled state. A canonical record is not a perpetual
runtime attestation. Every later business-write integration must combine a fresh
Auth check with the owning Core check, fail closed on drift/unavailable and bind
its local write concurrency. No cross-service atomicity is claimed here.

Activation/enrollment of canonical state is intentionally unavailable in this slice.
Its later owning management Contract must require exact reviewed evidence, fresh
unique enabled authoritative Agent Definition, an attributable actor and controlled
transaction preconditions. Test fixtures may create enrolled states inside isolated
DBs to exercise constraints; such fixtures prove no production Agent's readiness.

### CTR-CIF-006 — Bootstrap and existing effects

Migration creates empty lifecycle/successor tables and invariant machinery only;
zero automatic backfill, zero guessed mapping, zero Principal/client/Grant update.
Existing reads, token issuance, OAuth claims, rotation/revoke and HTTP/CLI management
paths remain governed by their existing authorities. This foundation supplies no
claim that those write effects are integrated or strict. Future activation order:
reviewed management/write-integration children → implementation/conformance →
reviewed enrollment and strict-write deployment → migrated references → retirement.
Do not enable a gate against an unclassified fleet as an accidental production outage.

Protected production metadata remains read-only under the Owner mandate. Even DDL
apply is not authorized here (`production_apply_authority: none`). A rollback after
isolated tests removes only the isolated database. Production rollback, enrollment,
seed import and retirement require their own accepted controlled contracts, five
retirement predicates and the Owner's root-slot/canary/readback gates.

### CTR-CIF-007 — Exact implementation closure

Allowed source/test vehicle, no other runtime files:

- `prisma/schema.prisma`: models/relations for the two tables only.
- `prisma/migrations/202609140001_canonical_identity_foundation/migration.sql`:
  empty tables, constraints and triggers described above.
- `src/lib/oauth/v1/canonical-identity.ts`: read-only boundary and errors.
- `tests/oauth/canonical-identity.test.ts`: isolated library contract tests.
- `tests/oauth/canonical-identity-postgres.test.ts`: real isolated PostgreSQL
  constraints, rollback and concurrent transaction tests.
- `scripts/check-canonical-identity-conformance.ts`: metadata-only read-only report
  of lifecycle counts, broken edges, canonical consistency and explicit coverage;
  no secrets or production writes; does not claim Core/global conformance.
- `package.json`: focused test/conformance commands only.

No fallback deletion, existing public route change, fixture-to-production importer,
new credential, generated client checked into Git, or hardcoded 87/stock mapping.
Docs/plan/review records accompany this source closure. Path-only mechanical
adjustment requires independent scope review under Owner preauthorization.

### CTR-CIF-008 — Compatibility and truthful conformance

Record existing resolver compatibility as live, removal condition = all actual
consumers migrated and `LIVE_CONSUMER_COUNT=0` proven independently. No removal in
this slice. Conformance emits explicit `scope=AUTH_FOUNDATION`, exact code/schema
revision and observation time, positive/negative test results, and
`STRICT_WRITE_DEPLOYED=false`, `GLOBAL_CENSUS_COMPLETE=false` unless a separate
qualified report proves those wider facts. Unscanned Core/consumer state is unknown,
not zero. No new hardcoded legacy aliases or runtime ID allowlists are permitted;
synthetic isolated negative fixtures are labelled as fixtures.

## Acceptance

All evidence binds exact code/schema head, test command, environment and timestamp.
Independent review checks the affected accepted authorities and source closure.

| ID | Contracts | Method and environment | Required result | Failure |
|---|---|---|---|---|
| ACC-CIF-001 | 001,006 | empty and populated isolated Pg migration; before/after row snapshots | zero old row changes; missing lifecycle unresolved; multiple clients preserved | automatic enrollment or identity/profile rewrite |
| ACC-CIF-002 | 001,002 | real Pg invalid inserts/updates/deletes; concurrent transactions | reject self/chain/cycle, invalid canonical, target demotion, evidence retarget, retired resurrection; transaction rollback | race permits invalid committed graph |
| ACC-CIF-003 | 003 | unit plus Pg reads | both exact directions and pair success; each error case, deadline and unavailable; no writes | alias fallback or partial-pair success |
| ACC-CIF-004 | 004 | source/target fixture matrix | explicit edge returns true + provenance; absent/inconsistent fail; same target many sources valid | silent canonical NOOP or migration success used as admission |
| ACC-CIF-005 | 005,006 | dependency/source review and existing exact/directory tests | no public auth/claim/read behavior change; Core/activation limitations explicit | new permission or production activation path |
| ACC-CIF-006 | 007,008 | exact diff, report execution and compatibility inventory | declared closure only; scoped truthful report; no seeds, secrets, removed live branch | foundation represented as global closure |

## Status

CONTRACT_COUNT=8; CONTRACTS_WITH_ACCEPTANCE=8. Proposed child, no implementation
until independent exact-head review, preauthorized acceptance and merge into main.
Program and all remaining census/consumer/migration/retirement work stay open.
