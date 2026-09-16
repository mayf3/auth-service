---
spec_id: AUTH_SERVICE_MACHINE_CREDENTIAL_ROTATION_AUTHORITY_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - exact secret-mutation enforcement and replay-consistency semantics implemented by two named existing migrations
  - controlled production installation requirements for those exact migrations
governed_by: [MINIMAL_AUTH_FOUNDATION_V2]
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
    revision: 763985a46cb063536834a5c452ab3e3e34adf93b
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [mayf3]
accepted_date: 2026-09-16
accepted_by: mayf3
accepted_reviewed_head: 7e4058812fa12e9a47af58e92771f42f92766dbc
accepted_reviewed_body_sha256: c5dfc55f1bb80de682a271b0ffcb0f9627818200296b7d881a85e950eb388c51
review_status: INDEPENDENT_SEMANTIC_REVIEW_ACCEPT_BLOCKERS_0_SPEC_GAPS_0
---

# Machine credential rotation authority

## 1. Goal

Establish the narrow active Auth Product Authority needed to govern the exact
credential-rotation enforcement and replay-consistency migrations already merged
in `mayf3/auth-service`:

```text
20260909010000_machine_credential_rotation_seam
sha256=00788aaf1a1d0091b83e4a6e2a94e6bf5f19d2ec17c5c968f5a9a092b751843d

20260913_machine_rotation_replay_consistency
sha256=ea909fcf5b9a0c442265c4ac0817943955a47ca134f797a9fdd956c42c6b58e6
```

This Spec owns only the durable product semantics and controlled-install
requirements stated below. It does not accept, amend, supersede or reactivate the
historical draft `docs/contracts/MACHINE_CLIENT_CREDENTIALS_V0.md`.

```text
BASE_HEAD = 785d7430fd0b6b9dd3aa7c110ed857fed9fea865
AUTHORITY_ACTION = NEW
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_CHANGE_ALLOWED = NO
PRODUCTION_APPLY_REQUIRES_SEPARATE_VALID_CONTROLLED_MANDATE = YES
THIS_AUTHORITY_DOES_NOT_PROMOTE_MACHINE_CLIENT_CREDENTIALS_V0_AS_A_WHOLE = YES
```

The Owner mandate
`AUTH_SERVICE_CREDENTIAL_ROTATION_AUTHORITY_AND_PREDECESSOR_CLOSURE_V1`,
2026-09-16, authorizes this docs-only authority candidate, its independent review,
conditional acceptance and merge, then a separately controlled production operation
only after the accepted authority is active on `main`. The mandate does not itself
create Product Authority and does not authorize mutation before that gate.

## 2. Scope and non-goals

### In scope

- ownership separation for `machine_clients` secret-bearing columns;
- the exact privileged rotation function, receipt ledger and row-DML guard;
- target-bound, live-generation-aware, metadata-only replay;
- separate controlled installation and administrator seal for both named bytes;
- zero credential or other business-data mutation during installation.

### Out of scope

The historical V0, all unrelated MachineClient semantics, credential rotation
operations, secret generation, Principal/Grant mutation, enrollment, source
migration, retirement, downstream mutation and deployment are out of scope.

## 3. Authority and dependencies

```text
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
EXTERNAL_CONSTRAINT = mayf3/dsh-agent-core/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1@763985a46cb063536834a5c452ab3e3e34adf93b
AUTHORITY_CONFLICT = NONE
```

The external Spec requires the enforcement property but explicitly does not
authorize auth-service mutation. This local Spec owns only the bounded Auth
semantics. The Owner mandate is execution authority, not Product Authority.

## 4. Current State

### STATE-MCRA-001 — Exact implementation exists without local authority

- Subject: the two named auth-service migration files
- As of commit/artifact: auth-service `785d7430fd0b6b9dd3aa7c110ed857fed9fea865`
- Environment: repository `main`
- Observed at: 2026-09-16T23:45:00+08:00
- Projection: exact migration bytes are merged; complete local Product Authority
  for those bytes is absent.
- Basis: `OBS-MCRA-001`, `OBS-MCRA-002`, `CLM-MCRA-001`

### STATE-MCRA-002 — Production state remains an operation-time fact

- Subject: production `agent_dev_center/public`
- As of commit/artifact: not fixed by this Product Authority
- Environment: production PostgreSQL
- Observed at: fresh observation required for every controlled attempt
- Projection: `UNKNOWN_UNTIL_FRESH_CONTROLLED_PREFLIGHT`
- Basis: `CLM-MCRA-002`

This Spec does not promote an older database snapshot into durable Product
Authority. The operation must freshly classify clean, partial, drifted or already
installed state immediately before any mutation.

## 5. Observations

### OBS-MCRA-001 — Exact migration bytes are merged

- Subject: the two migration SQL files named in §1
- Repository/source: `mayf3/auth-service`
- Commit/artifact: `785d7430fd0b6b9dd3aa7c110ed857fed9fea865`
- Environment: repository `main`
- Observed at: 2026-09-16T23:45:00+08:00
- Method: fresh remote-main readback and SHA-256 of tracked bytes
- Result: both files exist with the §1 digests; this candidate changes neither.
- Provenance: Git object database and tracked migration files

### OBS-MCRA-002 — The old V0 is non-governing

- Subject: `docs/contracts/MACHINE_CLIENT_CREDENTIALS_V0.md`
- Repository/source: `mayf3/auth-service`
- Commit/artifact: `785d7430fd0b6b9dd3aa7c110ed857fed9fea865`
- Environment: repository `main`
- Observed at: 2026-09-16T23:45:00+08:00
- Method: read its header and `.agents/local/README.md` authority inventory
- Result: it says `Draft — Ready for Review`; local governance explicitly excludes
  it from governing authority.
- Provenance: the two tracked documents at the named commit

### OBS-MCRA-003 — External authority does not authorize Auth mutation

- Subject: `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Amendment 7
- Repository/source: `mayf3/dsh-agent-core`
- Commit/artifact: `763985a46cb063536834a5c452ab3e3e34adf93b`
- Environment: external accepted authority
- Observed at: 2026-09-16T23:45:00+08:00
- Method: exact-revision source review
- Result: it requires an enforcement seam but explicitly does not authorize
  changing auth-service.
- Provenance: exact external revision in frontmatter

## 6. Claims and assumptions

### CLM-MCRA-001 — A narrow local Product Authority is load-bearing

- Support state: SUPPORTED
- Supported by evidence: `EVD-MCRA-001`
- Contradicted by evidence: none known
- Uncertainty: none for the exact two-file authority gap at the Base

### CLM-MCRA-002 — Production prestate must remain fresh operational evidence

- Support state: SUPPORTED
- Supported by evidence: `EVD-MCRA-002`
- Contradicted by evidence: none known
- Uncertainty: production may change after any observation; no snapshot in this
  Spec authorizes a later attempt.

## 7. Evidence relations

### EVD-MCRA-001 — Repository observations support the authority-gap Claim

- Source observations: `OBS-MCRA-001`, `OBS-MCRA-002`, `OBS-MCRA-003`
- Target: `CLM-MCRA-001`, `STATE-MCRA-001`
- Relation: SUPPORTS
- Bound coordinates: auth-service `785d7430fd0b6b9dd3aa7c110ed857fed9fea865`;
  dsh-agent-core `763985a46cb063536834a5c452ab3e3e34adf93b`;
  observed 2026-09-16T23:45:00+08:00
- Strength/sufficiency: strong for the authority gap and exact implementation bytes
- Limitations: establishes no production installation state or conformance
- Provenance: tracked documents and SHA-256 results

### EVD-MCRA-002 — Volatile-state boundary supports mandatory fresh preflight

- Source observations: `OBS-MCRA-001`
- Target: `CLM-MCRA-002`, `STATE-MCRA-002`
- Relation: SUPPORTS
- Bound coordinates: exact migration digests at the Base and production coordinate
  `agent_dev_center/public`
- Strength/sufficiency: sufficient to require fresh state classification
- Limitations: deliberately does not assert the current database state
- Provenance: Owner controlled-operation mandate and repository migration identity

All independently accepted Principal, Client, Grant, token, provisioning and
identity contracts remain unchanged. In particular, this Spec does not declare or
restore:

- mandatory `ownerUserId` or any human-owner model;
- an Agent-ID grammar, identity equivalence or successor relation;
- OAuth/token claim, issuance, refresh, revocation or provisioning behavior;
- Principal, Client, Credential or Grant creation authority;
- a generic credential-rotation operation mandate;
- historical sections 1–10 of `MACHINE_CLIENT_CREDENTIALS_V0.md`.

## 8. Decisions

### DEC-MCRA-001 — Separate ownership from ordinary application privileges

- Decision owner: mayf3
- Decision: protect secret-bearing columns through NOLOGIN ownership separation
  and column-level UPDATE restrictions.
- Rejected alternatives: `ALT-MCRA-002`
- Reason: application convention cannot prevent direct secret mutation.
- Owner decision remaining: NONE

### DEC-MCRA-002 — Use one privileged, receipted rotation seam

- Decision owner: mayf3
- Decision: the exact `SECURITY DEFINER` function is the sole supported database
  path for changing an existing MachineClient secret generation.
- Rejected alternatives: `ALT-MCRA-002`
- Reason: target, preimage, atomic mutation and receipt share one transaction.
- Owner decision remaining: NONE

### DEC-MCRA-003 — Persist one immutable receipt per new rotation

- Decision owner: mayf3
- Decision: every successful new rotation appends one immutable target-bound receipt.
- Rejected alternatives: `ALT-MCRA-002`
- Reason: mutation without durable lineage is not an accepted rotation.
- Owner decision remaining: NONE

### DEC-MCRA-004 — Bind replay to target and live generation

- Decision owner: mayf3
- Decision: replay is metadata-only and succeeds only for the same target while
  its receipt postimage remains the live generation.
- Rejected alternatives: `ALT-MCRA-003`
- Reason: operation ID alone permits foreign or stale false success.
- Owner decision remaining: NONE

### DEC-MCRA-005 — Seal every production migration attempt

- Decision owner: mayf3
- Decision: each migration uses a separate administrator GRANT, exact apply and
  mandatory REVOKE followed by membership and SET ROLE negative proof.
- Rejected alternatives: `ALT-MCRA-004`
- Reason: temporary membership can bypass the intended boundary.
- Owner decision remaining: NONE

### DEC-MCRA-006 — Install schema only and recover forward

- Decision owner: mayf3
- Decision: installation changes only permitted schema/ledger surfaces and performs
  zero rotation/business mutation; a sealed migration 1 remains when migration 2
  fails, all rotation calls remain disabled, and recovery is a new controlled
  forward attempt. Rotation calls resume only after migration 2 object, seal and
  poststate verification pass.
- Rejected alternatives: `ALT-MCRA-005`
- Reason: automatic reversal can reopen the security hole after partial uncertainty.
- Owner decision remaining: NONE

## 9. Contracts

### CTR-MCRA-001 — Ownership and ordinary role boundary

The exact `machine_clients` table owner after migration 1 is
`machine_credential_owner`. That role is `NOLOGIN`. The exact application/migration
role receives explicit `SELECT`, `INSERT` and `DELETE` privileges on
`machine_clients`, plus column-level `UPDATE` only for:

```text
client_id
machine_principal_id
external_ref
status
allowed_resources
allowed_scopes
updated_at
revoked_at
```

It receives no direct `UPDATE` privilege for `secret_hash` or `rotated_at` and no
table-level UPDATE grant that would bypass this restriction. PostgreSQL superuser
or host-root behavior is outside the ordinary supported role guarantee and is not
an application rotation path.

### CTR-MCRA-002 — Canonical rotation seam

The only supported existing-secret mutation database seam is:

```text
rotate_machine_client_secret(
  p_client_uuid uuid,
  p_new_secret_hash text,
  p_preimage_fingerprint text,
  p_operation_id text,
  p_rotated_by text
)
```

It is `SECURITY DEFINER`, owned by `machine_credential_owner`, has a fixed safe
search path, is not executable by PUBLIC and is executable by the exact application
role. It selects the exact internal Client UUID under lock, requires the target to
be active, and requires the supplied SHA-256 preimage fingerprint to match the live
stored secret generation. On a new authorized operation it atomically updates
`secret_hash`, `rotated_at` and `updated_at` and inserts the receipt. Missing,
inactive or preimage-mismatched targets fail with zero mutation.

This Contract governs the database seam. Supplying a new hash, obtaining raw secret
material or deciding to rotate a production credential requires a separate exact
operation authority. Installation of this Spec executes no rotation call.

### CTR-MCRA-003 — Append-only receipt authority

`machine_client_rotations` is owned by `machine_credential_owner`. Its
`operation_id` is unique. It stores the exact target Client UUID, Client ID,
preimage and postimage fingerprints, attributable rotation actor and timestamps.
It deliberately has no foreign key to `machine_clients`, so evidence survives
Client deletion. The application role receives `SELECT` only; no application-role
`INSERT`, `UPDATE` or `DELETE` grant exists. Receipt creation occurs only inside
CTR-MCRA-002. Receipt rows are immutable operational evidence and contain no raw
credential secret.

### CTR-MCRA-004 — Defense-in-depth row-DML guard

The `machine_clients_secret_guard` trigger fires before every row update to
`machine_clients`. If either `secret_hash` or `rotated_at` changes, it permits only
the genuine `SECURITY DEFINER` execution context of CTR-MCRA-002. Ordinary row DML,
including a role member attempting to reproduce the definer identity with
`SET ROLE`, fails. This trigger supplements rather than replaces CTR-MCRA-001.

### CTR-MCRA-005 — Exact replay consistency

Idempotency identity is the rotation operation, exact target Client UUID and
`operation_id` together.

- Same `operation_id` and same target replays the immutable receipt metadata and
  performs no second mutation.
- Same `operation_id` with a different target fails as `IDEMPOTENCY_CONFLICT` with
  zero mutation.
- If the receipt postimage fingerprint differs from the current live credential
  generation, replay fails as `STALE_IDEMPOTENCY_RECEIPT` with zero mutation.
- A replay response exposes only receipt metadata and never raw or regenerated
  credential secret material.

The exact migration 2 function result remains
`client_id, rotated_at, receipt_id, replayed`; it does not return `secret_hash` or
any secret value. No caller may treat a stale or foreign-target receipt as success.

### CTR-MCRA-006 — Normative production handshake and seal

Each migration is a separate controlled attempt. Before each attempt, production
must prove clean expected prestate, exact migration digest, a free shared mutation
slot, captured business-data preimage and an independent pre-apply review.

For migration 1, an administrator must:

1. create or verify `machine_credential_owner NOLOGIN`, grant its required CREATE
   privilege on schema `public`, and grant role membership temporarily to the exact
   DATABASE_URL migration/application role;
2. execute only the exact reviewed migration 1 bytes as that role;
3. revoke `machine_credential_owner` from that exact role.

Migration 2 may begin only after migration 1 poststate and seal pass. Its separate
attempt repeats the exact temporary GRANT, executes only migration 2 bytes, and
performs the administrator REVOKE.

After each attempt:

```text
pg_has_role(app_role, 'machine_credential_owner', 'member') = false
SET ROLE machine_credential_owner = FAIL
```

Any failed or uncertain REVOKE/seal makes production conformance fail and blocks
the next migration. A migration process, SQL comment or application-role action
cannot substitute for the administrator seal.

### CTR-MCRA-007 — Installation write envelope

The two controlled installs may change only schema objects, ownership, privileges,
functions, triggers and their exact `_prisma_migrations` ledger entries. Before and
after evidence must prove:

```text
MACHINE_CLIENT_ROW_COUNT_CHANGED = 0
MACHINE_PRINCIPAL_ROW_COUNT_CHANGED = 0
GRANT_ROW_COUNT_CHANGED = 0
SECRET_HASH_VALUE_CHANGES = 0
ROTATED_AT_VALUE_CHANGES = 0
NEW_ROTATION_RECEIPTS_FROM_INSTALL = 0
ROTATION_OPERATIONS_EXECUTED = 0
```

Safe digests may compare secret-bearing columns, but receipts and reports never
contain a raw secret, secret hash, password, token, private key or Authorization
header. Any unexpected business-data change stops the Goal and requires explicit
reconciliation; it is never normalized as successful installation.

### CTR-MCRA-008 — Exact closure and non-goals

This authority recognizes only the already-merged exact files:

- `prisma/migrations/20260909010000_machine_credential_rotation_seam/migration.sql`
- `prisma/migrations/20260913_machine_rotation_replay_consistency/migration.sql`

No migration SQL, Prisma schema, application source or test change is authorized
by this docs-only closure. Production apply is authorized only by a separate valid
controlled mandate that binds these digests, the exact database, roles, attempt
limits, abort conditions, secret handling, receipts and independent review.

This Spec authorizes no actual credential rotation, secret generation, Principal or
Grant mutation, canonical-subject enrollment, source-local binding apply, identity
migration, retirement, downstream service mutation or unrelated deployment.

```text
THIS_AUTHORITY_DOES_NOT_PROMOTE_MACHINE_CLIENT_CREDENTIALS_V0_AS_A_WHOLE = YES
PERMANENT_LEGACY_COMPATIBILITY_CREATED = NO
```

### CTR-MCRA-009 — Partial-state, unknown-outcome and forward recovery

If migration 1 is installed, independently verified and sealed but migration 2
fails or is not attempted, production MUST enter
`PARTIAL_PREDECESSOR_STATE_M1_SEALED`. The installed security boundary MUST remain
active and `ROTATION_CALLS_ENABLED` MUST be `NO` for the entire partial interval.
No application, CLI, operator or function caller may invoke a credential rotation
until migration 2 object-definition, administrator seal and poststate verification
all pass. Operators MUST NOT automatically delete ledger state, reverse ownership,
widen privileges or apply manual repair SQL. A later migration 2 attempt MUST first
freshly reconcile ledger and exact object definitions, revalidate zero business
drift, prove unchanged migration 2 bytes and acquire the controlled mutation slot.

If an attempt has unknown outcome, operators MUST stop and use read-only ledger,
object and business-digest reconciliation. Exact complete poststate MAY be accepted
only with a qualified receipt and independent review. Partial or drifted poststate
requires new repair authority. Rollback of a correctly sealed migration 1 is not
supported here. Emergency containment preserves the seal, stops rotation calls and
stops all further migration attempts.

## 10. Acceptance

All evidence binds the exact accepted Spec head, the two migration digests,
production database coordinate, application/migration role, observation time and
sanitized receipts. Independent review covers every Contract and the excluded
historical V0 surface.

### ACC-MCRA-001 — Narrow authority and old-V0 exclusion

- Contracts: `CTR-MCRA-008`
- Method: exact docs/source diff and authority-graph review
- Environment: isolated worktree against the exact Base
- Required evidence: candidate Head, changed-file list, old-V0 status and migration digests
- Expected result: old V0 remains Draft/non-governing and only the exact two-file semantics are owned
- Failure condition: whole V0 or unrelated MachineClient semantics activate

### ACC-MCRA-002 — Ownership, privileges and guard

- Contracts: `CTR-MCRA-001`, `CTR-MCRA-002`, `CTR-MCRA-004`
- Method: isolated PostgreSQL migration plus catalog and rejected-DML inspection
- Environment: disposable PostgreSQL matching production major version
- Required evidence: role flags, owners, grants, definitions and negative-DML receipts
- Expected result: NOLOGIN owner, allowed non-secret DML and denied direct secret mutation
- Failure condition: application or SET ROLE bypasses the seam

### ACC-MCRA-003 — Atomic rotation and immutable receipt

- Contracts: `CTR-MCRA-002`, `CTR-MCRA-003`
- Method: isolated success and target/preimage failure matrix
- Environment: disposable PostgreSQL with fixture credentials only
- Required evidence: before/after fixture digests, function result, receipt cardinality and grants
- Expected result: one atomic generation change and one immutable receipt; failure paths zero mutation
- Failure condition: partial update, absent/mutable receipt or production credential contact

### ACC-MCRA-004 — Replay consistency

- Contracts: `CTR-MCRA-005`
- Method: same-target replay, foreign-target collision and advanced-generation probes
- Environment: isolated fixture database and existing service replay tests
- Required evidence: exact implementation Head, results, mutation counts and response fields
- Expected result: metadata replay, conflict/stale errors, no second mutation and no secret emission
- Failure condition: wrong-target/stale success, second mutation or secret replay

### ACC-MCRA-005 — Per-migration production seal

- Contracts: `CTR-MCRA-006`
- Method: controlled handshake and fresh poststate after each migration
- Environment: production `agent_dev_center/public`
- Required evidence: sanitized GRANT/apply/REVOKE receipt, ledger row, membership false and SET ROLE denial
- Expected result: each exact migration is separately installed and sealed
- Failure condition: membership remains, seal is unknown or attempts are indistinguishable

### ACC-MCRA-006 — Zero business mutation during install

- Contracts: `CTR-MCRA-007`
- Method: before/after counts and safe aggregate digests
- Environment: production `agent_dev_center/public`
- Required evidence: Client/Principal/Grant counts, secret/rotated-at digests and receipt delta without raw values
- Expected result: all forbidden business-mutation counters are zero
- Failure condition: any credential, Client, Principal, Grant or rotation-receipt business mutation

### ACC-MCRA-007 — Exact object and ledger conformance

- Contracts: `CTR-MCRA-006`, `CTR-MCRA-007`
- Method: catalog and ledger readback against reviewed SQL definitions
- Environment: production `agent_dev_center/public`
- Required evidence: ledger rows, definition digests, owners and grants after each attempt
- Expected result: migration 1 then migration 2 match the exact reviewed bytes
- Failure condition: partial/drifted object, wrong owner/grant or combined unreviewable apply

### ACC-MCRA-008 — Partial-state and unknown-outcome behavior

- Contracts: `CTR-MCRA-009`
- Method: runbook review plus simulated migration-2 failure and uncertain-exit reconciliation
- Environment: disposable PostgreSQL; production uses read-only reconciliation on actual failure
- Required evidence: state classification, preserved seal, zero rollback writes and retry prerequisites
- Expected result: sealed migration 1 remains with rotation calls disabled throughout
  the partial interval; retry is a new exact attempt; calls resume only after
  migration 2 object, seal and poststate PASS; unknown is never success before reconciliation
- Failure condition: any rotation call in the partial interval, early re-enable,
  automatic rollback, ledger fabrication, privilege widening or blind replay

### ACC-MCRA-009 — Independent lifecycle and poststate review

- Contracts: `CTR-MCRA-001` through `CTR-MCRA-009`
- Method: independent semantic review before acceptance and independent production poststate review
- Environment: exact candidate/Base, then exact accepted-main/production tuple
- Required evidence: reviewed Head/body digest, zero-gap verdict, final-head recheck, merge readback and sanitized poststate receipt
- Expected result: active narrow authority and verified controlled installation
- Failure condition: authority gap, scope expansion, normative drift or unverifiable poststate

### Contract coverage

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-MCRA-001` | `ACC-MCRA-002`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-002` | `ACC-MCRA-002`, `ACC-MCRA-003`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-003` | `ACC-MCRA-003`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-004` | `ACC-MCRA-002`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-005` | `ACC-MCRA-004`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-006` | `ACC-MCRA-005`, `ACC-MCRA-007`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-007` | `ACC-MCRA-006`, `ACC-MCRA-007`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-008` | `ACC-MCRA-001`, `ACC-MCRA-009` | YES |
| `CTR-MCRA-009` | `ACC-MCRA-008`, `ACC-MCRA-009` | YES |

## 11. Alternatives and disposition

### ALT-MCRA-001 — Accept the old V0 wholesale

- Disposition: rejected
- Reason: it contains broader historical semantics not required here.
- Evidence/Claims considered: `OBS-MCRA-002`, `CLM-MCRA-001`
- What would reopen: separate whole-authority review and explicit Owner decision

### ALT-MCRA-002 — Preserve application-owned secret columns by convention

- Disposition: rejected
- Reason: direct SQL/ORM secret mutation would remain possible and unreceipted.
- Evidence/Claims considered: exact migration 1 and the external constraint
- What would reopen: accepted proof of an equivalent database enforcement mechanism

### ALT-MCRA-003 — Treat operation ID alone as replay identity

- Disposition: rejected
- Reason: permits foreign-target or stale-generation false success.
- Evidence/Claims considered: exact migration 2
- What would reopen: NONE under this authority

### ALT-MCRA-004 — Leave temporary membership for later cleanup

- Disposition: rejected
- Reason: the application role could SET ROLE and defeat the boundary.
- Evidence/Claims considered: `CTR-MCRA-006`
- What would reopen: NONE under this authority

### ALT-MCRA-005 — Automatically reverse migration 1 if migration 2 fails

- Disposition: rejected
- Reason: reversal can reopen direct secret mutation and cannot safely infer repair after uncertainty.
- Evidence/Claims considered: `CTR-MCRA-009`
- What would reopen: a new accepted rollback/repair authority with exact prestate

## 12. Migration, compatibility, and rollback

```text
MIGRATION = TWO_SEPARATE_FORWARD_CONTROLLED_ATTEMPTS_IN_LEDGER_ORDER
COMPATIBILITY = EXISTING_NON_SECRET_DML_PRESERVED_BY_EXPLICIT_COLUMN_GRANTS
ROLLBACK = NO_AUTOMATIC_SCHEMA_OR_OWNERSHIP_ROLLBACK
PARTIAL_STATE = MIGRATION_1_SEALED_ROTATION_DISABLED_MIGRATION_2_PENDING
ROTATION_CALLS_ENABLED_DURING_PARTIAL_STATE = NO
ROTATION_CALL_REENABLE_GATE = MIGRATION_2_OBJECT_AND_SEAL_AND_POSTSTATE_PASS
REENTRY = FRESH_READ_ONLY_RECONCILIATION_THEN_NEW_CONTROLLED_MIGRATION_2_ATTEMPT
UNKNOWN_OUTCOME = READ_ONLY_RECONCILE_NEVER_BLIND_REPLAY
EMERGENCY_CONTAINMENT = PRESERVE_SEAL_STOP_CALLS_AND_STOP_FURTHER_MIGRATIONS
```

Migration 1 changes the supported route for existing secret material while
preserving listed non-secret DML. A correctly installed and sealed migration 1
remains authoritative when migration 2 is pending, but credential rotation stays
disabled throughout that interval because replay lacks the migration 2 target and
live-generation checks. Migration 2 refines replay in place. Removal or reversal
requires new Product Authority and a new controlled operation; this Spec supplies
no down migration.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = YES
```

At `status: proposed`, this document authorized no implementation, merge or
production mutation. Owner conditional acceptance was exercised only after the
independent review of exact Head `7e4058812fa12e9a47af58e92771f42f92766dbc`
returned ACCEPT with zero blockers and zero Spec gaps. This lifecycle finalization
changes no Decision, Contract or Acceptance meaning. Active Product Authority
begins only after this accepted snapshot is merged into `main` and freshly read
back there.

After activation, the current Owner mandate may authorize the exact controlled
production attempts. Acceptance alone is not an operation and does not imply that
either migration or the canonical identity foundation is installed.

```text
CONTRACT_COUNT = 9
CONTRACTS_WITH_ACCEPTANCE = 9
```
