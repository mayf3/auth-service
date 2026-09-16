---
spec_id: AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - Auth-owned typed canonical-subject enrollment and attestation persistence
  - controlled prospective source-binding migration authority and terminal exit evidence
  - controlled management of the existing Agent identity lifecycle and direct-successor foundation
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENT_IDENTITY_CANONICALIZATION_PROGRAM_V1
  - AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# Canonical subject enrollment and source binding

## 1. Goal, route and legal effect

Establish the missing Auth-owned management surface that turns reviewed, exact,
typed subject authority into canonical enrollment and temporary prospective source
bindings. Reuse the accepted Agent lifecycle and direct-successor foundation. Add
no second identity database, duplicate successor truth, name resolver, historical
equivalence inference or permanent legacy compatibility path.

This child extends only the management surface explicitly deferred by
`AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1` DEC-CIF-004 and CTR-CIF-005/006.
It does not amend, reopen or supersede that foundation or the parent Program.

```text
BASE_HEAD = 587c7199c0d626c595c4da8603a6135a7677305f
AUTHORITY_ACTION = NEW
PRIMARY_PARENT_AUTHORITY = AUTH_SERVICE_AGENT_IDENTITY_CANONICALIZATION_PROGRAM_V1
FOUNDATION_AUTHORITY = AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

The Owner handoff `AUTHOR_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_CHILD_CONTRACT`,
2026-09-16, authorizes this docs-only candidate. It authorizes no code, DDL apply,
enrollment, Principal creation, reference migration, retirement or deployment.

## 2. Observations, claims and preserved authority

OBS-CSESB-001: PR #73 accepted the Agent-only lifecycle/successor foundation at
`1f22310b0ce838da0b20295d7e999b851925d2b3`. PR #74 merged its empty-install DDL,
strict canonical pair reads and migration-only successor read at
`af617ae25257f0cac5e39d31a32b2de2b7ed7cd7`. The accepted foundation intentionally
supplies no production enrollment/import/retirement command, public management route
or automatic classification.

OBS-CSESB-002: the reviewed program ledger preserves 178 Owner row decisions. Its
157 A rows include 10 row-level frozen-successor resolutions and 147 rows without
typed canonical authority. Those 147 rows reduce to 89 exact source-local bindings
and 73 Owner-defined prospective business subjects: 72 AGENT, 1 HUMAN and 0 SERVICE.
Six of the 73 subjects have one exact canonical AGENT pair supported by frozen,
reviewed successor evidence; the other 66 AGENT subjects and one HUMAN subject need
exact typed target attestation. These are enrollment denominators, not Principal-
creation counts and not historical-equivalence evidence.

CLM-CSESB-001 = SUPPORTED: the existing Agent foundation is the canonical target
truth but lacks the management and typed source-attribution surfaces required to
materialize the reviewed prospective decisions. Evidence is OBS-CSESB-001/002 and
the accepted foundation's explicit deferral. The implementation packet must bind the
exact ledger/decision artifacts and their digests; this Spec does not embed their
mutable local paths or promote business descriptions into identity keys.

The following accepted meanings remain unchanged:

- `machine_principals.id` plus exact stored `agent_id` is the Agent pair root;
- `agent_identity_lifecycle` is the only Agent canonical/legacy/retired lifecycle;
- `agent_identity_successors` is the only Agent historical successor relation;
- `users.id` is the Human subject root;
- `MachinePrincipal(principal_type=service)` is the Service subject root;
- strict ordinary admission and explicit migration resolution remain separate;
- missing evidence, lifecycle or exact target fails closed;
- business descriptions, display names, roles, UUID shape, Agent-ID grammar, Client
  IDs and consumer-owned mappings are never identity authority.

## 3. Decisions

DEC-CSESB-001: add Auth-owned subject-attestation and prospective source-binding
metadata that references the existing typed identity roots. It does not replace or
copy those roots.

DEC-CSESB-002: an attestation binds one Owner-defined prospective business subject
to one exact typed canonical target. Its descriptive label is context only and is
never a lookup or uniqueness key.

DEC-CSESB-003: a source binding is temporary migration authority. Ordinary token
issuance, authentication, authorization, routing, ownership and canonical write
admission never read it.

DEC-CSESB-004: target identity is immutable inside an attestation. A correction or
replacement creates a new attestation and atomically supersedes the old one; it does
not rewrite provenance.

DEC-CSESB-005: PLAN, IMPORT, APPLY and VERIFY form one digest-bound controlled flow.
APPLY is a single SERIALIZABLE transaction and a single attempt. Exact rerun is a
readback NOOP; unknown outcome is reconciled by the same operation identity, never
blindly replayed.

DEC-CSESB-006: source binding exit is subtraction, not compatibility. EXITED is
terminal, preserved for evidence, excluded from runtime resolution and incapable of
admitting the old value.

DEC-CSESB-007: actor attribution and identity-attestation authority are separate.
`attested_by_*` records who submitted or executed an operation; it grants no right to
decide a business-subject binding. Creating, superseding or revoking a typed subject
attestation requires one exact authority proof admitted by CTR-CSESB-013. Ordinary
Auth administration, Principal existence, Client ownership or Grant possession never
substitutes for that proof.

## 4. Data contracts and invariants

### CTR-CSESB-001 — Typed subject attestation persistence

Add enum `CanonicalSubjectType = agent|human|service`, enum
`SubjectAttestationStatus = active|superseded|revoked`, and table
`canonical_subject_attestations` with:

```text
subject_attestation_id          uuid primary key
business_subject_id             uuid not null
subject_type                    CanonicalSubjectType not null
business_subject_description    nonempty text, context only
machine_principal_id            nullable uuid FK machine_principals(id) RESTRICT
user_id                         nullable uuid FK users(id) RESTRICT
canonical_agent_id              nullable text
authority_source                nonempty text
attested_by_kind                user|machine_principal|external_authority
attested_by_user_id             nullable uuid FK users(id) RESTRICT
attested_by_machine_principal_id nullable uuid FK machine_principals(id) RESTRICT
attested_by_external_ref        nullable nonempty text
attestation_authority_kind      owner_exact|delegated|accepted_governing_authority
attestation_authority_ref       nonempty exact authority coordinate
attestation_authority_digest    sha256 text
delegation_id                   nullable uuid FK identity_attestation_delegations RESTRICT
effective_at                    timestamptz not null
evidence_ref                    nonempty text
supersedes_attestation_id       nullable uuid FK same table RESTRICT
revision                        positive bigint
status                          SubjectAttestationStatus not null
created_at                      timestamptz not null
updated_at                      timestamptz not null
```

Exactly one subject-target shape is valid:

| subject_type | machine_principal_id | user_id | canonical_agent_id |
|---|---:|---:|---:|
| `agent` | required | null | required |
| `human` | null | required | null |
| `service` | required | null | null |

Exactly one `attested_by_*` target matching `attested_by_kind` is required. Those
columns record actor attribution only. They do not themselves grant attestation
authority, even when the actor is an active User, MachinePrincipal or Auth
administrator. An external actor reference is a stable actor coordinate, not a
display name. `authority_source`, `attested_by`, `effective_at` and `evidence_ref`
are provenance; a nonempty value in any of them independently proves neither target
identity nor authority.

`attestation_authority_kind/ref/digest` bind the exact authority admitted by
CTR-CSESB-013. `delegation_id` is required only for `delegated` and null otherwise.
The authority fields are immutable. A target-valid attestation with missing,
invalid, stale, revoked, expired or out-of-scope authority is invalid and cannot be
inserted, activated, superseded or used by APPLY.

Target columns, subject type, effective time, authority source, attester identity,
evidence identity, creation time and supersession predecessor are immutable after
insert. Only a controlled lifecycle operation may change `status`, `revision` and
`updated_at`; revision increases exactly by one. DELETE is prohibited. `revoked` is
terminal. A supersession atomically inserts the replacement and transitions the
predecessor `active -> superseded`; the new row names that predecessor and retains
the same `business_subject_id`. A partial unique constraint permits at most one
active attestation per `business_subject_id`. Initial enrollment creates a new
random business-subject ID; it is an enrollment-lineage key, not an authentication
subject or canonical identity. Chains are directly readable and cycles, forks from
one predecessor and self-links are rejected.

No database invariant may use `business_subject_description` to join, deduplicate,
infer a target or prove two subjects identical.

### CTR-CSESB-002 — Exact typed canonical target validation

Every active attestation is validated under the same transaction as its creation or
supersession:

- AGENT: exact `machine_principal_id` exists, has `principal_type=agent`, is active,
  stores the exact `canonical_agent_id`, and passes the accepted foundation's
  `validateCanonicalPair`. It has explicit canonical `agent_identity_lifecycle` and
  no outgoing successor edge. Agent-ID grammar alone proves nothing.
- HUMAN: exact `users.id` exists and is active. No MachinePrincipal, Agent ID,
  Agent lifecycle row or Agent successor row is created or inferred.
- SERVICE: exact MachinePrincipal exists, is active and has
  `principal_type=service`. `agent_id` and Agent lifecycle/successor rows are absent.

No name, display label, email, role, UUID shape, `agt_*` grammar, Client ID,
`external_ref`, source-local alias or consumer map may resolve or validate a target.
Closed failures include `TARGET_NOT_FOUND`, `TARGET_TYPE_MISMATCH`,
`TARGET_PAIR_MISMATCH`, `NON_CANONICAL_AGENT_TARGET`, `TARGET_INACTIVE` and
`TARGET_AUTHORITY_INCONSISTENT`. No failing operation writes partial state.

Attestation `active` means the attribution is current; it does not freeze or override
the target's operational status. User/MachinePrincipal disablement and Agent lifecycle
changes remain independently authoritative. Every PLAN/APPLY/VERIFY and any future
legitimate consumer must revalidate the exact target freshly and fail closed. This
child claims no cross-service atomicity or perpetual Core runtime attestation.

### CTR-CSESB-003 — Prospective source-binding registry

Add enum `SourceBindingSemantics = prospective_binding`, enum
`SourceBindingStatus = planned|active|superseded|exited`, and table
`canonical_subject_source_bindings` with:

```text
source_binding_id          uuid primary key
source_namespace           nonempty text
source_local_value         nonempty text
subject_attestation_id     uuid FK canonical_subject_attestations RESTRICT
semantics                  prospective_binding only
effective_at               timestamptz not null
evidence_ref               nonempty text
status                     SourceBindingStatus not null
revision                   positive bigint
created_at                 timestamptz not null
updated_at                 timestamptz not null
superseded_at              nullable timestamptz
supersession_evidence_ref  nullable nonempty text
exited_at                  nullable timestamptz
exit_evidence_ref          nullable nonempty text
supersedes_source_binding_id nullable uuid FK same table RESTRICT
```

At most one planned/active binding may exist for `(source_namespace,
source_local_value)`; historical superseded/EXITED rows may coexist. The pair identifies one
governed source-local binding, not a global subject, and the value remains opaque.
Binding insert requires an active attestation. Its subject, namespace, value,
semantics, effective time and initial evidence are immutable. DELETE and in-place
retarget are prohibited. A separately authorized prospective correction atomically
transitions the predecessor to `superseded` and inserts a replacement row that names
it in `supersedes_source_binding_id`. The replacement contains the new immutable
subject target; cycles, forks and silent reactivation are rejected.

Binding-authority supersession and source-value exit are different facts:

```text
MAPPING_SUPERSESSION != SOURCE_VALUE_EXIT

planned -> active       allowed
planned -> superseded   allowed only with atomic replacement insert
active  -> superseded   allowed only with atomic replacement insert
planned -> exited       allowed only with zero-live source evidence
active  -> exited       allowed only with zero-live source evidence
superseded -> exited    allowed only with zero-live source evidence

superseded -> planned|active|superseded  forbidden
exited -> *                              forbidden
```

Every transition increases revision exactly by one. `superseded` requires
`superseded_at`, exact `supersession_evidence_ref` and exactly one replacement that
points to the predecessor. It means only that binding authority moved to that
replacement; the old source value may still have live read, write, lookup, routing,
ownership or authorization dependencies. Supersession requires no false zero-live
claim and must never populate `exited_at` or `exit_evidence_ref`.

`exited` requires `exited_at` and exact `exit_evidence_ref`, is terminal and cannot
return to any other state. Before any transition to EXITED, VERIFY must prove under
separately accepted source-owner evidence that the named old source value has zero
live read, write, lookup, routing, ownership and authorization dependency. A mapping
correction cannot stand in for that proof. This registry cannot itself prove the
source-side zero-live predicate.

```text
ORDINARY_CANONICAL_ADMISSION_READS_SOURCE_BINDING_REGISTRY = NO
ORDINARY_AUTHENTICATION_READS_SOURCE_BINDING_REGISTRY = NO
ORDINARY_AUTHORIZATION_READS_SOURCE_BINDING_REGISTRY = NO
PERMANENT_RUNTIME_OLD_TO_NEW_LOOKUP = FORBIDDEN
```

### CTR-CSESB-004 — No duplicate lifecycle or successor truth

This child creates no Agent lifecycle or successor table. Controlled Agent lifecycle
operations mutate only `agent_identity_lifecycle` under CTR-CIF-001/002. Controlled
successor installation mutates only `agent_identity_successors` and requires an exact
separately reviewed historical-equivalence authority for each edge. A prospective
source binding is never successor evidence and cannot authorize an edge.

AGENT enrollment may establish canonical lifecycle for an exact existing pair only
when its input authority is one of:

1. a reviewed frozen explicit successor target whose exact current Auth pair passes;
2. an Owner attestation naming the exact typed Principal and Agent IDs; or
3. another accepted authority explicitly naming the exact pair.

It never creates a Principal or Agent Definition. Core's enabled Agent Definition
check remains an independent fresh precondition supplied by the controlled plan.

The controlled command freezes the following complete Agent lifecycle matrix.
`ABSENT` is treated as foundation `unresolved` for enrollment. Same-state requests
are readback-only NOOPs and write no revision. Any transition not listed as allowed
is forbidden with zero write.

| Transition | Required authority | Required preconditions | Allowed effect | Forbidden effect |
|---|---|---|---|---|
| `ABSENT|unresolved -> canonical` | exact accepted enrollment authority under CTR-CSESB-002/004 | exact active AGENT Principal/Agent pair; fresh unique enabled Core Definition; no outgoing successor; reviewed evidence and expected prestate | insert/transition lifecycle to canonical, revision 1/+1 | grammar/name promotion, Principal/Definition creation, implicit successor |
| `ABSENT|unresolved -> legacy` | accepted exact legacy-classification authority naming the Principal | exact AGENT Principal; evidence proves legacy disposition without guessing; expected prestate | insert/transition lifecycle to legacy, revision 1/+1 | successor inference, authority/Grant change, retirement claim |
| `legacy -> canonical` | exact accepted canonical enrollment or correction authority naming the pair | CTR-CSESB-002 exact target checks; fresh Core Definition; no existing outgoing successor; no conflicting current canonical subject | transition to canonical, revision +1 | deleting/rewriting a successor edge, inferred rehabilitation, pair replacement |
| `legacy -> retired` | separately authorized retirement plus verified exact successor authority | all five CTR-AICP-007 predicates are exactly true: `LIVE_WRITABLE_REFERENCES=0`, `ACTIVE_WORK_OWNER_REFERENCES=0`, `ACTIVE_GRANTS_REQUIRED=0`, `ACTIVE_CLIENT_REQUIRED=0`, `SUCCESSOR_MAPPING_VERIFIED=YES`; successor target remains exact active canonical | transition lifecycle to retired, revision +1 | transition when any predicate is false/unknown, credential/Grant/client mutation, physical deletion |
| `canonical -> legacy` | separately accepted demotion authority naming source, reason and intended disposition | `LIVE_WRITABLE_REFERENCES=0`, `ACTIVE_WORK_OWNER_REFERENCES=0`, `ACTIVE_GRANTS_REQUIRED=0`, `ACTIVE_CLIENT_REQUIRED=0`; no incoming successor edges; if logical continuity is claimed, exact reviewed successor authority and canonical target are present and the direct edge is installed atomically | transition to legacy, revision +1, plus separately authorized direct edge when applicable | breaking an incoming successor target, implicit successor, preserving canonical admission, unrelated permission mutation |
| `canonical -> retired` | separately authorized retirement naming the exact canonical Principal | all five CTR-AICP-007 predicates exactly true; no incoming successor edges; exact verified successor is installed where the logical Agent continues | transition lifecycle to retired, revision +1 | direct retirement with any false/unknown predicate, orphaning incoming successors, physical deletion |
| `retired -> *` | none can authorize under this Contract | not applicable | none | every resurrection, canonicalization, legacy reactivation or revision write |

`unresolved -> retired`, `canonical -> unresolved`, `legacy -> unresolved` and every
other unlisted cross-state transition are forbidden. Predicate evidence is exact,
fresh, environment-bound and included in the reviewed plan digest. Missing,
permission-filtered, stale or unknown predicate evidence is not zero and blocks the
operation. In particular, `legacy -> retired` missing any one of the five required
CTR-AICP-007 predicates MUST fail the whole transaction with zero write.

### CTR-CSESB-005 — PLAN and IMPORT

The controlled tool accepts one canonical packet format with packet version,
operation ID, environment, authority coordinates, exact subject records, exact source
bindings, expected current revisions, and source artifact digests. Unknown fields,
duplicate IDs/keys, noncanonical encoding, missing authority, inconsistent counts or
unsupported semantics fail closed.

`IMPORT` is offline/read-only normalization and schema validation. It writes no Auth
database or source service. It emits canonical JSON bytes and SHA-256. Re-import of
the same bytes is identical.

`PLAN` is database read-only. In one repeatable snapshot it resolves every exact
target, checks foundation installation and current lifecycle/attestation/binding
state, performs the fresh Core evidence check required for AGENT targets, and
validates the exact identity-attestation authority under CTR-CSESB-013. Validation
includes actor identity, permitted operation, subject type, exact business-subject
scope, exact canonical target, authority acceptance/status/revision/digest,
effective time, expiry and revocation. Any failed or unknown check yields
`CONFLICT/FAIL`, emits no applicable plan and makes APPLY unavailable. PLAN then
calculates the exact mutation set and emits:

```text
operation_id
packet_digest
authority_digest
attestation_authority_kind/ref/digest
delegation_id/revision when applicable
prestate_digest
plan_digest
subject/binding counts by operation
exact mutation identifiers and expected revisions
NOOP/APPLY/CONFLICT disposition
created_at and expires_at
```

Candidate discovery may be shown outside the plan for Owner context, but cannot
enter target resolution. `PLAN` performs no lock-persisting or business writes.

### CTR-CSESB-006 — APPLY transaction and idempotency

`APPLY` requires the exact reviewed, unexpired `plan_digest`, packet digest,
authority digest, operation ID, environment and expected prestate. It opens one
SERIALIZABLE transaction, acquires the accepted Agent identity advisory-lock domain
before affected identity reads, revalidates all Auth targets and preconditions,
performs the entire approved mutation set, writes its audit envelope, and commits
once. The required Core Agent Definition check runs immediately before the database
transaction, has a bounded expiry, and its exact response/evidence digest is included
in the reviewed plan and operation record. No cross-service atomicity is claimed.

Before any attestation mutation commits, APPLY revalidates CTR-CSESB-013 against the
exact authority coordinates and acting subject bound into the plan. For delegated
authority it locks and re-reads the delegation row, requires the planned revision,
active status, exact scope and operation, and checks effective/expiry time at the
transaction timestamp. Revoked, expired, changed or out-of-scope authority causes
whole-transaction zero write. For Owner-exact or accepted-governing authority it
revalidates the exact immutable artifact revision/digest and its explicit typed
subject-to-target statement. Target validity alone never authorizes attribution.

There is no partial success. Any stale revision, changed target status/pair, changed
Core evidence, conflicting attestation/source binding, missing foundation table,
lock timeout, serialization failure or audit failure rolls back the transaction.
Automatic apply retry is forbidden.

Add `canonical_subject_operations` as the closed-envelope commit record:

```text
operation_id          uuid primary key
environment           nonempty text
actor_ref              nonempty exact typed actor reference
packet_digest          sha256 text
authority_digest       sha256 text
prestate_digest        sha256 text
plan_digest            sha256 text unique
core_evidence_digest   nullable sha256 text
attestation_authority_digest nullable sha256 text
poststate_digest       sha256 text
mutation_counts        closed json object
committed_at           timestamptz not null
```

All fields are immutable and DELETE is prohibited. The operation row is inserted in
the same transaction as the mutations and proves only a committed outcome. Exact
same operation/digest after a proven commit returns verified NOOP. Same operation
with another digest is `IDEMPOTENCY_CONFLICT`. If commit outcome is unknown, the
caller records `OUTCOME_UNKNOWN` in its attempt receipt and performs read-only
reconciliation by operation ID and exact poststate; presence of an exact operation
row plus matching poststate proves commit, absence proves no committed transaction
only after authoritative read availability is restored. It neither invents success
nor starts a second attempt.

### CTR-CSESB-007 — VERIFY and attributable receipts

`VERIFY` reads the committed operation, every planned identity/lifecycle/attestation/
binding row and relevant invariant counts in one consistent snapshot. It compares
the exact expected poststate, confirms no unplanned row changed, and emits a sanitized
receipt containing:

```text
operation_id, environment, actor, authority coordinates
packet/prestate/plan/poststate digests
subject/binding/lifecycle/successor counts by action
commit observation and verification timestamps
result=PASS|FAIL|OUTCOME_UNKNOWN
```

The receipt contains no password, token, credential secret, private key,
Authorization header or unrestricted record dump. A receipt or evidence reference
is provenance, not independent identity proof.

### CTR-CSESB-008 — Controlled lifecycle operations

The command surface supports only explicit plan operations:

- `ACTIVATE_ATTESTATION`: insert an exact validated active enrollment;
- `SUPERSEDE_ATTESTATION`: insert replacement plus transition predecessor;
- `REVOKE_ATTESTATION`: terminal revocation, after dependency checks;
- `INSTALL_ATTESTATION_DELEGATION`: exact Owner-issued, scoped, expiring delegation;
- `REVOKE_ATTESTATION_DELEGATION`: terminal Owner-authorized revocation;
- `TRANSITION_AGENT_LIFECYCLE`: accepted foundation state transition;
- `INSTALL_EXPLICIT_SUCCESSOR`: exact separately authorized direct edge;
- `ACTIVATE_SOURCE_BINDING`: planned to active;
- `SUPERSEDE_SOURCE_BINDING`: planned/active predecessor to superseded plus atomic
  replacement insert; source value may remain live;
- `EXIT_SOURCE_BINDING`: terminal exit with source-owner zero-live evidence.

Revoking or superseding an attestation with active source bindings is rejected unless
the same atomic plan supersedes every affected binding and inserts its replacement,
or independently proves zero-live and transitions it to EXITED. Supersession never
claims source exit. Canonical Agent transitions must match the complete matrix in
CTR-CSESB-004; no generic state mutation exists. No operation physically deletes
evidence or rewrites immutable historical audit records.

### CTR-CSESB-009 — Initial packet denominator

The implementation must support, without hardcoding business labels or canonical
pairs, the first reviewed packet:

```text
SUBJECT_ATTESTATION_RECORDS = 73
AGENT_SUBJECTS = 72
HUMAN_SUBJECTS = 1
SERVICE_SUBJECTS = 0
UNIQUE_SOURCE_LOCAL_BINDINGS = 89
COVERED_LEDGER_ROWS = 147
BINDING_SEMANTICS = PROSPECTIVE_BINDING
```

Six AGENT subjects may use their frozen reviewed mapping targets only after packet
construction binds both the exact mapping provenance and the Owner's frozen exact
authority coordinate plus the current exact Auth pair. Their business descriptions
are not evidence. The remaining 66 AGENT subjects and the one HUMAN subject require
an exact typed Owner, delegated or accepted-governing-authority attestation under
CTR-CSESB-013. Existing business attribution without an exact canonical target is
not sufficient. The current HUMAN business
subject description is `小马哥`; enrollment requires exact active `users.id` and
creates no MachinePrincipal or Agent ID. Failure to establish that exact User fails
closed and leaves the subject unenrolled.

The 73/89/147 counts are acceptance preconditions for the named initial packet, not
schema constants, identity-universe closure, Principal creation counts or permission
to apply it. Packet creation and production apply are later separately governed work.

### CTR-CSESB-010 — Failure taxonomy and safe diagnostics

The command surface exposes closed codes only:

```text
INVALID_PACKET
PACKET_DIGEST_MISMATCH
AUTHORITY_NOT_ACCEPTED
FOUNDATION_NOT_INSTALLED
TARGET_NOT_FOUND
TARGET_TYPE_MISMATCH
TARGET_PAIR_MISMATCH
NON_CANONICAL_AGENT_TARGET
TARGET_INACTIVE
TARGET_AUTHORITY_INCONSISTENT
ATTESTATION_AUTHORITY_MISSING
ATTESTATION_AUTHORITY_INVALID
ATTESTATION_AUTHORITY_OUT_OF_SCOPE
ATTESTATION_AUTHORITY_REVOKED
ATTESTATION_AUTHORITY_EXPIRED
ATTESTATION_CONFLICT
SOURCE_BINDING_CONFLICT
REVISION_CONFLICT
PRESTATE_CHANGED
PLAN_EXPIRED
IDEMPOTENCY_CONFLICT
SERIALIZATION_FAILURE
LOCK_TIMEOUT
AUDIT_WRITE_FAILED
VERIFY_MISMATCH
OUTCOME_UNKNOWN
```

Errors identify packet record IDs and closed field names where safe, but never expose
secrets, raw credentials, unrestricted SQL/records or provider exception causes.
`OUTCOME_UNKNOWN` is durable state for same-operation reconciliation, not permission
to retry.

### CTR-CSESB-011 — Exit and deletion obligations

This Contract preserves the Program's subtraction goal:

```text
LIVE_LEGACY_REFERENCES = 0
AMBIGUOUS_IDENTITY_WRITES = 0
LEGACY_COMPATIBILITY_PATHS = 0
```

An EXITED source binding may remain only as read-only audit/provenance. Ordinary
production readers and writers cannot require it; the old source value cannot be
accepted as canonical identity; new ambiguous source-format writes are rejected by
the owning source service; and no runtime fallback may query this table. Removal of
the migration tool's active-binding path requires all bindings EXITED plus independent
zero-consumer evidence. Physical deletion needs a separate accepted retention and
deletion authority; it is not required to achieve runtime subtraction.

This child does not migrate `llm-todo` or `svc-okr`, close U1/U2, retire a Principal,
change credentials/Grants, deploy a canonical write canary, remove compatibility,
or assert historical identity equivalence.

### CTR-CSESB-012 — Implementation slices and production boundary

After this Spec is independently reviewed, accepted and merged, implementation may
proceed in separately reviewable slices:

1. persistence and invariant DDL for only the attestation, delegation,
   source-binding and operation/audit records; reuse the existing foundation
   migration unchanged;
2. exact target and typed-attestation-authority validation plus controlled lifecycle
   management library;
3. offline IMPORT plus read-only PLAN;
4. gated APPLY and VERIFY vehicle with closed output;
5. isolated unit/PostgreSQL concurrency, idempotency, negative and receipt tests;
6. conformance report and exact implementation closure review.

Implementation must freeze exact file paths in its ExecPlan before code begins.
No implementation may add a public unauthenticated route, new Audience/Scope/Grant,
credential, Principal creation path, automatic backfill, display-name resolver,
consumer-owned mapping store or ordinary-admission dependency on source bindings.

Spec acceptance and source merge do not authorize production DDL, enrollment/import
apply, lifecycle mutation, successor installation, source rewrite, deployment or
retirement. Each production operation requires a separately accepted execution
authority/runbook binding environment, exact reviewed plan, actor, attempt bound,
preimage, rollback/containment, receipt and independent readback.

### CTR-CSESB-013 — Typed-attestation authority

```text
ATTRIBUTION != AUTHORITY
```

Creating, superseding or revoking a canonical subject attestation is lawful only
when exactly one of these authority classes proves the exact intended binding:

1. **Owner exact typed attestation.** An immutable Owner decision names
   `subject_type`, exact `business_subject_id` or `subject_attestation_id`, exact
   canonical target and exact authority coordinate. AGENT names exact
   `machine_principal_id + canonical_agent_id`; HUMAN names exact `users.id` with
   null Agent ID; SERVICE names exact SERVICE MachinePrincipal with null Agent ID.
2. **Owner-delegated identity-attestation authority.** An active Auth-owned
   delegation names the exact actor, allowed subject type, enumerated business-
   subject scope, allowed attestation operations, Owner authority source, effective
   time and expiry. The acting subject must match the delegation exactly.
3. **Accepted governing authority exact binding.** An accepted authority at an
   exact repository revision/body digest explicitly states the exact business
   subject to exact typed canonical target relation. A generic policy, label,
   evidence reference or permission statement is insufficient.

Exactly one authority class is selected per mutation. Conflicting authority proofs,
multiple different targets, an unaccepted/mutable coordinate or a proof that does
not name the exact business subject and target fails closed.

For delegated authority, add `identity_attestation_delegations`:

```text
delegation_id                    uuid primary key
delegated_actor_type             user|machine_principal
delegated_user_id                nullable uuid FK users(id) RESTRICT
delegated_machine_principal_id   nullable uuid FK machine_principals(id) RESTRICT
authorized_subject_type          agent|human|service
authorized_business_subject_ids nonempty uuid array, exact enumeration
authorized_operations           nonempty subset activate|supersede|revoke
owner_authority_ref              nonempty exact Owner authority coordinate
owner_authority_digest           sha256 text
effective_at                     timestamptz not null
expires_at                       timestamptz not null and greater than effective_at
status                           active|revoked
revision                         positive bigint
revoked_at                       nullable timestamptz
revocation_authority_ref         nullable nonempty exact Owner coordinate
created_at                       timestamptz not null
updated_at                       timestamptz not null
```

Exactly one delegated actor FK matching `delegated_actor_type` is present. Scope is
an explicit nonempty set of preassigned `business_subject_id` values and one subject
type; wildcard subject, type or operation scope is forbidden. Creation requires an
exact Owner delegation decision covering the complete row. Revocation requires exact
Owner authority, is terminal, increments revision by one and preserves all original
fields. Expiry is evaluated from transaction time even if status remains `active`.
DELETE, extension, scope widening, actor replacement, self-delegation and delegated
creation/revocation of delegation authority are forbidden. A new or broader mandate
requires a new Owner-authorized delegation row.

Delegation install/revoke and delegated attestation APPLY use SERIALIZABLE
transactions and the same identity-management advisory-lock domain. Delegated APPLY
locks and fences its exact delegation row before authority validation; revocation
locks the same row. If revocation commits first, APPLY observes revoked state and
writes nothing. If APPLY commits first, its operation record proves authority was
active at that transaction's validation time and later revocation does not rewrite
history. Serialization/lock conflict aborts the whole transaction and is never
treated as authority success or automatically retried.

`attested_by_*` identifies the submitting/executing actor and is always checked, but
it grants no authority. None of the following is identity-attestation authority:

- an ordinary User or MachinePrincipal identity;
- Auth administrator status or ordinary Auth management permission alone;
- Client ownership, credential possession, Grant possession or service access;
- Agent role/name, display name, business-subject description or email;
- nonempty `authority_source` or `evidence_ref` without an admitted authority proof;
- Agent-ID grammar, UUID shape, source-local value or legacy mapping;
- target validity or canonical status by itself.

The authority proof is immutable provenance on every attestation and is included in
PLAN, APPLY, operation audit and VERIFY digests. Ordinary authentication,
authorization and canonical admission do not consult the delegation or attestation
authority tables. This authority layer grants only the bounded right to attest the
enumerated prospective binding; it grants no product permission, token, credential,
Grant, Principal creation or source-reference mutation.

## 5. Rejected alternatives and explicit non-goals

Rejected:

- using business description, display name, name similarity, role, UUID shape,
  Agent-ID grammar, Client ID or external alias as canonical authority;
- copying lifecycle or successors into the new tables;
- converting the HUMAN subject into an Agent or MachinePrincipal;
- treating actor attribution, administrator status, Client/Grant possession or a
  valid canonical target as identity-attestation authority;
- automatically backfilling existing principals, users, source references or rows;
- using source bindings as login, authorization, routing, ownership or write-admission
  fallback;
- asserting that prospective convergence proves historical continuity;
- keeping an active old-to-new map after source migration;
- creating 147 row-level identity decisions instead of 73 subject enrollments and 89
  exact source-local bindings.

This Contract does not create a second canonical database. The new records are
typed authority/provenance and migration-state metadata referencing existing Auth
identity roots.

## 6. Acceptance matrix

Every result binds exact Spec/candidate/implementation/database coordinates,
environment, actor, timestamp, commands, digests and limitations. Synthetic fixtures
are labeled and prove no production enrollment.

| Acceptance | Contracts | Method / environment | Required evidence and expected result | Failure condition |
|---|---|---|---|---|
| ACC-CSESB-001 | 001,004 | schema review plus isolated PostgreSQL constraints | typed FK/check matrix; immutable targets/provenance; no duplicate Agent lifecycle/successor table; DELETE rejected | second identity root, duplicate successor truth, label used as key |
| ACC-CSESB-002 | 002 | isolated exact target matrix against User/MachinePrincipal/foundation fixtures | valid AGENT/HUMAN/SERVICE targets pass; every not-found/type/pair/inactive/noncanonical case fails with zero writes | name/grammar/client inference or HUMAN Agent projection |
| ACC-CSESB-003 | 003,011 | isolated binding lifecycle plus dependency adapter tests | unique current namespace/value; prospective-only; append-preserving supersession; terminal EXITED; (a) with live refs, active binding may atomically become superseded with an explicit replacement but MUST NOT report EXITED; (b) only after exact source-owner zero-live proof may planned/active/superseded transition to EXITED; ordinary auth/admission dependency inventory equals zero | correction represented as EXITED, in-place retarget, predecessor reactivation, runtime fallback or exit without source evidence |
| ACC-CSESB-004 | 005 | canonical packet fixtures and read-only database snapshot | deterministic IMPORT digest; PLAN exact counts/mutations/digests; malformed/duplicate/stale input rejected; DB byte-identical | normalization changes meaning or PLAN writes |
| ACC-CSESB-005 | 006 | real PostgreSQL concurrent/stale/timeout/audit-failure tests | one SERIALIZABLE atomic commit; exact rerun NOOP; changed digest conflict; all failures roll back | partial commit, automatic retry or weaker isolation succeeds |
| ACC-CSESB-006 | 007,010 | committed, failed and uncertain isolated operations | exact readback/closed receipt; same-operation unknown reconciliation; secret scan PASS | unverified success, second attempt or sensitive output |
| ACC-CSESB-007 | 004,008 | exhaustive Agent and binding lifecycle transition matrix plus graph/predicate invariants | every listed transition enforces its exact authority/preconditions/effect; every unlisted transition and retired resurrection fail with zero write; `legacy -> retired` is tested five times, omitting each CTR-AICP-007 predicate in turn, and every case MUST fail with byte-identical lifecycle/successor/audit state; live-ref binding correction may supersede but cannot EXIT; successor requires separate exact authority | implementation chooses an unspecified transition, any retirement gate is bypassed, prospective binding creates successor, correction fakes exit, or evidence is overwritten |
| ACC-CSESB-008 | 009 | reviewed initial packet conformance, no apply | 73 subjects = 72 AGENT + 1 HUMAN; 89 bindings cover 147 ledger rows exactly; six frozen-target inputs provenance-bound; 67 exact typed attestations | count drift hidden, labels treated as pair proof, Principal creation inferred |
| ACC-CSESB-009 | 011 | source-owner readback and consumer/runtime dependency census | every EXITED binding has zero live legacy reference and zero ordinary-reader/writer dependency; history remains readable | compatibility path or ambiguous write remains live |
| ACC-CSESB-010 | 012 | exact implementation diff, targeted tests, migration inspection and route/dependency scan | only accepted slices; foundation unchanged; no public permission/credential/Principal/source mutation; production apply false | source merge represented as production activation or scope expansion |
| ACC-CSESB-011 | 001,005,006,008,009,010,013 | isolated exact authority matrix plus real PostgreSQL plan/apply rollback and delegation concurrency tests | (1) valid canonical AGENT target + ordinary MachinePrincipal actor without authority fails with zero write; (2) valid User/Admin actor + ordinary Auth management permission without delegation fails with zero write; (3) delegated actor outside exact subject/type/operation scope fails with zero write; (4) revoked and expired delegation each fail with zero write, including revocation racing APPLY; (5) Owner exact typed attestation + exact canonical target passes; (6) accepted governing authority explicitly naming exact subject→typed target passes; PLAN rejects every missing/invalid/stale authority and APPLY revalidates exact actor/scope/revision/status/time before commit | attribution treated as authority, permission-derived authority, scope wildcard, stale/revoked/expired delegation commits, target validity alone authorizes, or failure leaves any attestation/lifecycle/binding/operation row |

## 7. Authoring status and next gate

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
SPEC_ID = AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AUTH_SERVICE_AGENT_IDENTITY_CANONICALIZATION_PROGRAM_V1
EXTERNAL_AUTHORITIES = NONE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 13
CONTRACTS_WITH_ACCEPTANCE = 13
AUTHORING_READY_FOR_REVIEW = YES
IMPLEMENTATION_READY = NO
PRODUCTION_READY = NO
NEXT_ACTION = INDEPENDENT_SEMANTIC_REVIEW_OF_EXACT_CHILD_CONTRACT_HEAD
```
