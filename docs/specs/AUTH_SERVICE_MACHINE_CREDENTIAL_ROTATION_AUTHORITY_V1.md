---
spec_id: AUTH_SERVICE_MACHINE_CREDENTIAL_ROTATION_AUTHORITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - exact secret-mutation enforcement and replay-consistency semantics implemented by two named existing migrations
  - controlled production installation requirements for those exact migrations
governed_by: [MINIMAL_AUTH_FOUNDATION_V2]
external_authorities:
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 Amendment 7
supersedes: []
superseded_by: null
owners: [mayf3]
---

# Machine credential rotation authority

## 1. Goal, route and authority boundary

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

## 2. Evidence, preserved authority and non-promotion

OBS-MCRA-001: at Base, the two named migration files are already merged and their
bytes have the digests above, but production `_prisma_migrations` and object
readback recorded neither migration as installed. Code merge is not production
authority or proof of production effect.

OBS-MCRA-002: repository-local governance explicitly records
`MACHINE_CLIENT_CREDENTIALS_V0.md` as `Draft — Ready for Review` and excludes it
from governing authority. The accepted external Agent Core provisioning Spec
requires a secret-mutation enforcement seam but explicitly states that it does not
authorize changes in auth-service. A narrow local governing Spec is therefore
load-bearing.

CLM-MCRA-001 = SUPPORTED: the exact migrations require local Product Authority for
ownership separation, column privilege restriction, the privileged rotation seam,
receipt persistence, replay consistency and production sealing. Evidence is the
named Base, exact migration bytes and the two repository governance observations.
Migration comments and prior repair mandates are provenance, not authority.

All independently accepted Principal, Client, Grant, token, provisioning and
identity contracts remain unchanged. In particular, this Spec does not declare or
restore:

- mandatory `ownerUserId` or any human-owner model;
- an Agent-ID grammar, identity equivalence or successor relation;
- OAuth/token claim, issuance, refresh, revocation or provisioning behavior;
- Principal, Client, Credential or Grant creation authority;
- a generic credential-rotation operation mandate;
- historical sections 1–10 of `MACHINE_CLIENT_CREDENTIALS_V0.md`.

## 3. Decisions

DEC-MCRA-001: `machine_clients` secret material is protected by database ownership
separation and column-level privilege restrictions. Ordinary supported application
and operator roles cannot directly update `secret_hash` or `rotated_at`.

DEC-MCRA-002: `rotate_machine_client_secret(...)` is the only supported database
path for changing existing MachineClient secret material. It is a narrowly granted
`SECURITY DEFINER` function owned by the NOLOGIN boundary role.

DEC-MCRA-003: every successful new rotation appends one immutable receipt. The
receipt operation identity is bound to the rotation operation and exact target.

DEC-MCRA-004: replay is metadata-only and must remain consistent with both the
original target and the current live credential generation. Conflict or stale
receipt is zero mutation and never re-emits secret material.

DEC-MCRA-005: installing either named migration in production is a controlled
three-step administrator handshake. Temporary boundary-role membership is an
installation capability and must be revoked before conformance can pass.

DEC-MCRA-006: installing these migrations changes schema, ownership, grants,
functions, triggers and migration ledger only. It performs no credential rotation
and changes no MachineClient, MachinePrincipal or Grant business row.

## 4. Contracts

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

## 5. Acceptance

All evidence binds the exact accepted Spec head, the two migration digests,
production database coordinate, application/migration role, observation time and
sanitized receipts. Independent review covers every Contract and the excluded
historical V0 surface.

| ID | Contracts | Method | Required result | Failure |
|---|---|---|---|---|
| ACC-MCRA-001 | 001,008 | exact docs/source diff and authority graph review | narrow new authority; old V0 stays Draft and non-governing; exact two-file closure | whole V0 or unrelated MachineClient semantics activated |
| ACC-MCRA-002 | 001,002,004 | isolated PostgreSQL migration plus privilege/owner/trigger inspection | NOLOGIN owner; allowed non-secret DML; secret columns not directly updatable; raw secret DML rejected | application role can bypass seam |
| ACC-MCRA-003 | 002,003 | isolated successful rotation and failure matrix | exact active target and preimage; atomic three-column update plus one immutable receipt; no receipt DML grant | partial update, missing receipt or mutable receipt |
| ACC-MCRA-004 | 005 | same-target replay, foreign-target collision and advanced-live-generation probes | metadata-only replay; conflict/stale errors with zero mutation and no secret emission | second mutation, wrong-target replay, stale success or secret replay |
| ACC-MCRA-005 | 006 | controlled production handshake receipt after each migration | exact GRANT/migration/REVOKE order; membership false; SET ROLE fails | temporary membership remains or seal is unproven |
| ACC-MCRA-006 | 007 | production before/after counts and safe digests | all seven business-mutation counters are zero | credential, Client, Principal, Grant or receipt business mutation |
| ACC-MCRA-007 | 006,007 | migration ledger and exact object-definition readback | migration 1 then migration 2 installed separately and definitions match reviewed bytes | partial/drifted install or combined indistinguishable attempt |
| ACC-MCRA-008 | 001-008 | independent semantic review and poststate review | review ACCEPT with zero blockers/spec gaps; poststate PASS before dependent foundation work | authority gap, scope expansion or unverifiable evidence |

## 6. Lifecycle and activation boundary

At `status: proposed`, this document authorizes no implementation, merge or
production mutation. Owner acceptance is preauthorized only if an independent
semantic review of the exact candidate returns ACCEPT with zero blockers and zero
Spec gaps, the normative body is unchanged through final-head recheck, and the
candidate satisfies the narrow scope above. Active Product Authority begins only
after the accepted snapshot is merged into `main` and freshly read back there.

After activation, the current Owner mandate may authorize the exact controlled
production attempts. Acceptance alone is not an operation and does not imply that
either migration or the canonical identity foundation is installed.

```text
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
```
