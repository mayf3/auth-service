---
spec_id: AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-04
revision: r1
scope:
  - exact auth-service Minimal Auth V1 bundle 1.7.0 scheduler deployment
  - one scheduler AuthAudience production backfill with equal-face rollback
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1

> **PROPOSED / NON-AUTHORITATIVE.** This docs-only proposal authorizes no
> artifact build, database write, service restart, Grant, token issuance, or
> production change until independent exact-head review, explicit Owner
> acceptance, lifecycle finalization, and merge to `main`.

## 1. Goal

Authorize one bounded production transition from the already deployed Minimal
Auth V1 Contract `1.6.0` to the exact scheduler registration snapshot at
`57258ec33700af8057ab2ed63fd8e52b3225e749`:

```text
FROM_RUNTIME = 1.6.0 / ab2d81a7f276f0a0fa5d3c5b470c999b1f7d580876c46b49f8d32da927d03dae
SOURCE_COMMIT = 57258ec33700af8057ab2ed63fd8e52b3225e749
SOURCE_PARENT = 4d383ee02d298eebeb15470a5328b7345ed140e9
SOURCE_SCHEDULER_IMPLEMENTATION = 3ec89aecf5171201380d0b14224c79c98c7cb13b
TO_CONTRACT_VERSION = 1.7.0
NEW_AUDIENCE = scheduler
NEW_SCOPES = [scheduler.admin, scheduler.audit]
```

The transition deploys only the accepted Scheduler CCR's exact 16-file source
closure, a generated runtime Contract derived from it, one exact production
`auth_audiences` row, and the already established auth-service snapshot/plist
switch. It does not deploy later main-only forum-moderator changes.

## 2. Scope and non-goals

In scope:

- reproducible non-secret snapshot/artifact build from exact source `57258ec...`;
- exact `scheduler` AuthAudience backfill matching the accepted registry;
- one serialized root-owned production apply, service restart, health/readback,
  negative pre-Grant proof, durable receipt, and equal-face compensation;
- preservation of the seven deployed 1.6.0 audiences and all unrelated DB rows,
  grants, clients, principals, credentials, services, and files.

Out of scope:

- any `machine_access_grants` write or positive scheduler token issuance;
- any Principal, Client, credential, secret, scope, or Audience other than the
  one frozen `scheduler` row;
- deploying `8029c5f...` or any later `github/main` forum-moderator delta;
- changing Scheduler product semantics, dsh-agent-core runtime, workflow,
  session messaging, svc-workflow, or launch definitions other than the single
  existing `com.auth-service.plist` snapshot reference;
- deleting audit evidence or claiming downstream production readiness.

## 3. Authority and current state

```text
AUTHORING_BASE = ff9e1bec7d364568a92be91f6ffbd49d1d2101de
PRIMARY_PARENT = AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
PARENT_REVIEWED_CONTENT = 6ca830e7d3a8414c1341d62647fd952eb472e0e7
PARENT_LIFECYCLE_COMMIT = 687c3b1eb3c671b1b4edf343fe96c07e9f00f92a
PARENT_PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_MERGE = 57258ec33700af8057ab2ed63fd8e52b3225e749
PRODUCTION_AUTH_PID = 60318
PRODUCTION_SCHEDULER_AUDIENCE = ABSENT
PRODUCTION_SCHEDULER_GRANTS = ZERO
```

- `STATE-SD17-001` — Auth source: scheduler 1.7.0 implementation is merged at
  `57258ec...`, while current `github/main@ff9e1bec...` contains later changes
  outside this deployment under the same textual Contract version; version
  alone is therefore not an identity. Basis: `OBS-SD17-001`, `EVD-SD17-001`.
- `STATE-SD17-002` — Auth production: PID 60318 serves exact 1.6.0 digest
  `ab2d81a7...`; seven DB audiences match that registry, `scheduler` is absent,
  and no scheduler Grant exists. Basis: `OBS-SD17-002`, `EVD-SD17-002`.
- `STATE-SD17-003` — Authority: the accepted Scheduler CCR authorizes only its
  implementation closure and explicitly reserves deployment, DB backfill, and
  Grant supply for separate rounds. Basis: `OBS-SD17-003`, `EVD-SD17-003`.

## 4. Observations

### OBS-SD17-001 — Exact scheduler implementation lineage

- Subject: Minimal Auth V1 scheduler registration implementation
- Repository/source: mayf3/auth-service Git object database
- Revision: merge `57258ec...`, implementation parent `3ec89aec...`, base `4d383ee...`
- Environment/observed_at: isolated worktree, 2026-09-04
- Method: Git parent/diff/blob census
- Result: the implementation delta is the accepted CCR's exact 16-file closure;
  later main changes modify registry/fixtures/runtime allowlist outside this
  transition while retaining textual version `1.7.0`. They therefore form a
  different bundle face and cannot replace the pinned source or digest.
- Provenance: Git history and `AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1`.

### OBS-SD17-002 — Production is exact 1.6.0 without scheduler state

- Subject: deployed auth-service and Auth DB scheduler rows
- Revision: runtime 1.6.0 digest `ab2d81a7...`, snapshot source `4d383ee...`
- Environment/observed_at: localhost production, 2026-09-04
- Method: read-only health, prior exact deployment audit, and read-only DB census
- Result: health is PASS; `scheduler` Audience rows and live scheduler Grants are
  zero; the existing session-messaging Audience remains active.
- Provenance: `/api/health`, `docs/audits/AUTH_BUNDLE_1_6_0_DEPLOY/AUDIT.md`,
  and sanitized read-only DB results.

### OBS-SD17-003 — Parent does not authorize production apply

- Subject: Scheduler Audience CCR authority boundary
- Revision: accepted lifecycle `687c3b1...`, reviewed content `6ca830e...`
- Environment/observed_at: authority branch, 2026-09-04
- Method: inspect frontmatter and `CTR-SCH-007/009`
- Result: implementation is authorized and merged; DB backfill, deployment, and
  Grant supply remain separately authorized.
- Provenance: `docs/specs/AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1.md`.

## 5. Claims and evidence

- `CLM-SD17-001` — Support state: SUPPORTED. Exact `57258ec...` is the narrowest
  sufficient source for scheduler 1.7.0 and excludes later unrelated main
  deltas. Supported by `EVD-SD17-001`; uncertainty is limited to reproducible
  snapshot generation, which remains an artifact Gate.
- `CLM-SD17-002` — Support state: SUPPORTED. One new Audience row plus the exact
  snapshot switch can preserve the 1.6.0 face and fail closed without any Grant.
  Supported by `EVD-SD17-002`; production preimages must be refreshed under lock.
- `CLM-SD17-003` — Support state: SUPPORTED. A new child deployment authority is
  required before any production action. Supported by `EVD-SD17-003`.

- `EVD-SD17-001` — Source `OBS-SD17-001`; target `CLM-SD17-001`; relation
  SUPPORTS; coordinates `57258ec.../3ec89aec...`; strength strong for exact
  source closure; limitation: not runtime proof.
- `EVD-SD17-002` — Source `OBS-SD17-002`; target `CLM-SD17-002`; relation
  SUPPORTS; coordinates production 1.6.0/PID 60318/2026-09-04; strength strong
  for observed prestate; limitation: must be rechecked under apply lock.
- `EVD-SD17-003` — Source `OBS-SD17-003`; target `CLM-SD17-003`; relation
  SUPPORTS; coordinates accepted CCR; strength conclusive for the authority gap;
  limitation: this proposal stays inert until accepted and merged.

## 6. Decisions

### DEC-SD17-001 — Pin the pre-forum scheduler merge

Select `57258ec...` as the only source. Reject current-main deployment because it
would couple later forum-moderator registry and fixture changes to this lane.

### DEC-SD17-002 — Treat snapshot and Audience row as one compensated transaction

Apply under one production lock with exact refreshed preimages, one restart, and
automatic equal-face rollback. Reject DB-only or snapshot-only intermediate
success claims because runtime DB/registry consistency requires both faces.

### DEC-SD17-003 — Preserve zero-Grant Phase A

End this deployment with scheduler Grant count zero and negative-only token
proofs. Grant supply is a later separately accepted authority and mutation.

## 7. Contracts

### CTR-SD17-001 — Exact immutable artifact

The builder MUST use a clean checkout of `57258ec...`, generate the runtime
Contract twice reproducibly, run the accepted bundle validators/tests, and seal
the complete snapshot, candidate plist, exact file manifest, source commit,
runtime digest, DB-row manifest, rollback snapshot/plist, and operator wrapper
under hashes. The artifact MUST contain no DB URL, credential, token, key, or
environment dump. Any mismatch stops before production.
`contractVersion=1.7.0` alone MUST NOT satisfy identity: source commit, complete
manifest, and generated runtime digest must all equal the sealed artifact.

### CTR-SD17-002 — Exact Scheduler Audience row

The only authorized business-data creation is one `auth_audiences` row exactly
matching the pinned 1.7.0 registry entry:

```text
audience_id = resource_service = scheduler
scope_namespace = scheduler
accepted_principal_types = [agent]
human_access_enabled = false
machine_access_enabled = true
delegated_access_enabled = false
registered_scopes = [scheduler.admin, scheduler.audit]
status = active
freeze_ready = true
version = 1
```

The transaction MUST fail if any scheduler row already exists or if the seven
pre-existing audiences differ from the exact 1.6.0 registry. It MUST append one
sanitized, correlation-bound `audience.registered` audit row and touch no Grant,
Client, Principal, Session, or other Audience.

### CTR-SD17-003 — Native owner path and serialization

Only an Owner-approved macOS native authorization dialog may start the sealed
root transaction. No password may be requested, printed, stored, piped, or
accepted by fallback. The helper MUST acquire one auth-service deployment lock,
fresh-read target snapshot/plist/DB preimages under that lock, and fail before
mutation on drift, concurrent operation, bad ownership/mode/type, symlink, or
unsealed input.

### CTR-SD17-004 — Bounded apply and exactly one restart

The transaction MUST install a new immutable snapshot rooted at exact source
`57258ec...`, write the exact scheduler Audience row, atomically switch only
`/Library/LaunchDaemons/com.auth-service.plist` to that snapshot, and restart
`com.auth-service` exactly once. It MUST prove old PID termination, a fresh PID,
health `ok=true`, Contract version `1.7.0`, the artifact-pinned runtime digest,
and DB-to-registry exact equality for all eight audiences.

### CTR-SD17-005 — Negative-only post-deploy proof

Before any scheduler Grant exists, the exact frozen source Agent client MUST
receive no token for exact `scheduler/scheduler.admin`; wrong scope, alias,
wildcard, human/service/delegated, and foreign-audience forms MUST also fail.
No positive scheduler issuance may occur in this round. Sanitized evidence may
record error classes and claim-shape hashes but no credential or token bytes.

### CTR-SD17-006 — Equal-face compensation

Any post-mutation failure MUST restore the exact old plist/snapshot reference,
remove only the newly created scheduler Audience row when its correlation and
pre-absence match, append a sanitized rollback audit record, restart exactly
once into the old snapshot, and prove the original 1.6.0 digest, seven-audience
DB equality, scheduler absence, zero scheduler Grants, and unrelated-state
invariants. Ambiguous DB or restart outcome fails closed for manual recovery;
the helper MUST NOT retry an ambiguous mutation.

### CTR-SD17-007 — Durable receipt and no overclaim

Success requires an atomic root-owned receipt binding authorization path,
artifact/seal/source/runtime digests, before/after snapshot and plist identity,
DB transaction/audit correlation, old/new PID, health, eight-audience readback,
negative matrix, zero Grant count, and unrelated-state digest. A dialog, Gate,
row, restart, health response, or receipt alone is not deployment success and
does not make Scheduler or dsh-agent-core production-ready.

### CTR-GSD17-001 — Lifecycle boundary

Independent review and Owner acceptance may perform only a docs lifecycle
transaction: proposed to accepted, add exact review/acceptance provenance, and
update this Spec's README row. No artifact or production byte may change in that
transaction. The accepted exact head must receive final-head recheck and merge
before artifact construction or production apply begins.

## 8. Acceptance

### ACC-SD17-001 — Source and artifact

- Contracts: `CTR-SD17-001`
- Method: two clean builds, manifest/hash comparison, full accepted validation
  suite, secret scan, snapshot/plist/rollback inspection
- Pass: identical sealed outputs from `57258ec...`, exact 1.7.0 scheduler face,
  zero later-main/forum delta, zero secret
- Fail: any nondeterminism, extra source/file, mutable input, missing rollback,
  validation failure, or secret.

### ACC-SD17-002 — Prestate and data transaction

- Contracts: `CTR-SD17-002`, `CTR-SD17-003`
- Method: locked fresh-read of live runtime/plist/snapshot and serializable DB
  preflight plus dry-run transaction
- Pass: exact 1.6.0/seven-audience face, scheduler row/Grant absence, native
  authorization identity, one-row/audit write plan only
- Fail: drift, existing scheduler row/Grant, non-native path, bad seal, broader
  DB plan, or any preflight mutation.

### ACC-SD17-003 — Apply and runtime proof

- Contracts: `CTR-SD17-004`, `CTR-SD17-005`, `CTR-SD17-007`
- Method: execute sealed wrapper once; inspect receipt, process generation,
  health, DB/registry equality, negative token matrix, and unrelated digests
- Pass: one restart, fresh healthy 1.7.0 PID/digest, eight exact audiences,
  zero scheduler Grants, negative-only matrix PASS, durable receipt
- Fail: partial face, extra restart/write, positive issuance, retained mismatch,
  unrelated drift, missing/ambiguous receipt, or overclaim.

### ACC-SD17-004 — Rollback rehearsal and real compensation

- Contracts: `CTR-SD17-006`
- Method: isolated failure injection before/after DB write, plist switch,
  restart, health, readback, and receipt; invoke production compensation only
  on a real authorized failure
- Pass: every mutated failure returns to exact 1.6.0/seven-audience/zero-Grant
  face with one rollback restart and terminal receipt
- Fail: mixed face, deletion beyond the correlated scheduler row, retry of an
  ambiguous mutation, missing audit evidence, or unproven baseline.

### ACC-GSD17-001 — Authority lifecycle

- Contracts: `CTR-GSD17-001`
- Method: independent exact-head review, explicit Owner acceptance, lifecycle
  allowlist diff, final-head recheck, merge ancestry proof
- Pass: accepted merged exact head, zero semantic drift after review, no
  production action before merge
- Fail: missing identity/provenance, changed head, non-doc delta, or early apply.

## 9. Alternatives

- Deploy current `github/main`: rejected; it includes later forum-moderator
  registry/runtime deltas outside Lane C.
- Backfill DB now and deploy later: rejected; creates a registry mismatch.
- Deploy snapshot now and backfill later: rejected; health must fail closed.
- Reuse `scheduler.audit` in the initial operational Grant: rejected unless the
  downstream canary proves global/foreign history is indispensable.

## 10. Authoring status

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = contracts (inactive until accepted and merged)
PRIMARY_PARENT_AUTHORITY = AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
EXTERNAL_AUTHORITIES = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
AUTHORING_READY_FOR_REVIEW = YES
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
