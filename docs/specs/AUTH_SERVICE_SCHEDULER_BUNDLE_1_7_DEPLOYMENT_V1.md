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
PRODUCTION_DB_ENDPOINT = 127.0.0.1:5432 / database agent_dev_center
LIVE_SNAPSHOT = /Users/yanfenma/workspace/project/production-auth-service-4d383ee02d298eebeb15470a5328b7345ed140e9
CANDIDATE_SNAPSHOT = /Users/yanfenma/workspace/project/production-auth-service-57258ec33700af8057ab2ed63fd8e52b3225e749
LIVE_PLIST = /Library/LaunchDaemons/com.auth-service.plist
LAUNCHD_TARGET = system/com.auth-service
SERVICE_ORIGIN = http://127.0.0.1:4001
GLOBAL_MUTATION_LOCK = /var/run/auth-service-production-mutation.lock
SOURCE_AGENT_ID = agt_efficiency-agent
SOURCE_PRINCIPAL_UUID = b21ddb23-42f6-47c4-a27f-bc44950e554c
SOURCE_CLIENT_ID = mc_cF81DF-XND9Zmzao4F08rOK_
SOURCE_CLIENT_UUID = 695d1eeb-3547-4cbd-a72b-915f4ebf25a4
CREDENTIAL_STORE = /usr/local/libexec/agent-core/config/agent-credentials.json
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

## 5. Claims

- `CLM-SD17-001` — Support state: SUPPORTED. Exact `57258ec...` is the narrowest
  sufficient source for scheduler 1.7.0 and excludes later unrelated main
  deltas. Supported by `EVD-SD17-001`; uncertainty is limited to reproducible
  snapshot generation, which remains an artifact Gate.
- `CLM-SD17-002` — Support state: SUPPORTED. One new Audience row plus the exact
  snapshot switch can preserve the 1.6.0 face and fail closed without any Grant.
  Supported by `EVD-SD17-002`; production preimages must be refreshed under lock.
- `CLM-SD17-003` — Support state: SUPPORTED. A new child deployment authority is
  required before any production action. Supported by `EVD-SD17-003`.

## 6. Evidence

- `EVD-SD17-001` — Source `OBS-SD17-001`; target `CLM-SD17-001`; relation
  SUPPORTS; coordinates `57258ec.../3ec89aec...`; strength strong for exact
  source closure; limitation: not runtime proof.
- `EVD-SD17-002` — Source `OBS-SD17-002`; target `CLM-SD17-002`; relation
  SUPPORTS; coordinates production 1.6.0/PID 60318/2026-09-04; strength strong
  for observed prestate; limitation: must be rechecked under apply lock.
- `EVD-SD17-003` — Source `OBS-SD17-003`; target `CLM-SD17-003`; relation
  SUPPORTS; coordinates accepted CCR; strength conclusive for the authority gap;
  limitation: this proposal stays inert until accepted and merged.

## 7. Decisions

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

## 8. Contracts

### CTR-SD17-001 — Exact immutable artifact

The builder MUST use a clean checkout of `57258ec...`, generate the runtime
Contract twice reproducibly, run the accepted bundle validators/tests, and seal
the complete snapshot, candidate plist payload, exact file manifest, source
commit, runtime digest, DB-row manifest, rollback snapshot/plist, and operator
wrapper under hashes. The production snapshot closure is exactly the clean
`git ls-files` tree at `57258ec...` plus reproducibly generated `dist/`,
`generated/`, and the `package-lock.json`-resolved `node_modules/`; it excludes
`.git`, `.env`, all other untracked paths, caches, logs, and build workspaces.
The artifact MUST contain no DB URL, operational credential, token, production
key, or environment dump. The sole private-key-shaped exception is the public,
tracked test fixture
`tests/fixtures/keys/svc-okr-canary-test-private.pem` at SHA-256
`5209392287ad718e04882edccc1a0e8a0aeae56f30f1aef4701be8830c5b0b2c`;
it MUST be labeled `PUBLIC_TEST_FIXTURE`, never loaded by the production entrypoint,
and any other secret-scan exception or hash fails before production.
`contractVersion=1.7.0` alone MUST NOT satisfy identity: source commit, complete
manifest, and generated runtime digest must all equal the sealed artifact.

The non-secret owner artifact MUST be a root-owned directory under
`/private/var/root/auth-scheduler-1-7-*`, mode `0700`; manifest, candidate plist
payload, and other non-executable data files MUST be `root:wheel 0600`, and
executable helpers `root:wheel 0700`. The installed plist staging file and its
atomically installed live copy MUST instead be regular `root:wheel 0644` files;
the artifact payload itself remains `0600`. The target
snapshot path MUST be exactly
`/Users/yanfenma/workspace/project/production-auth-service-57258ec33700af8057ab2ed63fd8e52b3225e749`.
Its root and ordinary directories MUST be `root:staff 0755`; ordinary non-secret
files MUST be `root:staff 0444`; executable files MUST be `root:staff 0555`;
symlinks are allowed only when enumerated by the manifest with an exact relative
target that remains inside the snapshot. Every catalog row MUST bind relative
path, type, link target or null, SHA-256 or null, bytes, owner, group, and mode.
Any extra path, special file, external/absolute symlink, or metadata mismatch
MUST stop.

The artifact MUST NOT contain `.env`. Under the production lock, the root helper
MAY copy only the existing snapshot's `.env` directly to the new snapshot as
`authsvc:authsvc 0600`; it MUST compare a redacted SHA-256 before/after without
emitting bytes or values. That secret-bearing file is never a staged artifact.

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

The lock is exactly `/var/run/auth-service-production-mutation.lock`. Its owned
participant set is closed to the three operator transactions serialized by
`CORE_RUNTIME_DAILY_AUTONOMY_OVERNIGHT_V1`: this scheduler bundle deployment,
the accepted temporary ASM Grant apply/revoke vehicle at
`/Users/yanfenma/workspace/deployment-artifacts/agent-session-messaging-temp-grant-v1`,
and the later permanent daily-autonomy Grant vehicle governed by
`AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1`. The Goal coordinator MUST
wrap each participant from first preimage read through terminal receipt with
this lock and MUST schedule no overlap. This Spec does not claim to govern or
retrofit every historical/runtime Auth writer.

Before mutation, the Owner transaction MUST prove from the Goal transaction
ledger, process census, participant receipt/marker census, and native Owner
attestation that none of the other two participants or any other Auth
production mutation is authorized, scheduled, active, or outcome-ambiguous in
the window. Any competing/unknown writer or unfinished receipt stops. An
isolated contention test MUST hold the lock in each participant wrapper and
prove the other two reject before DB/file access. This operation holds the lock
continuously through DB commit, restart, post-restart proof, compensation if
needed, and terminal receipt publication.

The Audience write MUST run at PostgreSQL `SERIALIZABLE` isolation and lock
`auth_audiences`, `machine_access_grants`, and `auth_security_audits` against
concurrent writes before the guarded census/write. Lock timeout or any changed
pre/post unrelated digest stops or compensates; there is no automatic retry.
Database target identity is exactly
TCP `127.0.0.1:5432`, database `agent_dev_center`; the secret-bearing connection
string is read only inside the sealed root helper from the active snapshot's
root-readable `.env`, is never accepted as an argument/environment override,
and is never logged or persisted.

### CTR-SD17-004 — Bounded apply and exactly one restart

The transaction MUST install a new immutable snapshot rooted at exact source
`57258ec...`, write the exact scheduler Audience row, atomically switch only
`/Library/LaunchDaemons/com.auth-service.plist` to that snapshot, and restart
`com.auth-service` exactly once. It MUST prove old PID termination, a fresh PID,
health `ok=true`, Contract version `1.7.0`, the artifact-pinned runtime digest,
and DB-to-registry exact equality for all eight audiences.
The live snapshot, candidate snapshot, plist, launchd target, and service origin
are exactly the coordinates frozen in §3. Candidate snapshot pre-absence is a
hard Gate. Snapshot installation MUST finish with every temporary staging node
removed and the exact candidate catalog proved before the DB transaction may
begin; therefore no post-DB state may contain a staging node. Lock acquisition
is bounded to 30 seconds, the native authorization
dialog to 120 seconds, DB lock/statement/whole-transaction time to 5/10/30
seconds, launchd stop and start to 30 seconds each, and health/readback to 60
seconds with at most one request per second. Any timeout is a failure: before
mutation it exits unchanged; after mutation it enters compensation and may not
be treated as success or blindly retried.

### CTR-SD17-005 — Negative-only post-deploy proof

Before any scheduler Grant exists, the exact §3 Agent/principal/client MUST
receive no token for exact resource `scheduler` and scope `scheduler.admin`, with
exact error `invalid_scope/machine_grant_missing`; this proves the request passed
audience selection, identity/profile, and credential verification and reached
Grant lookup. Exact resource `cross-agent-scheduler` MUST fail as
`invalid_target/audience_not_machine_enabled`. These two production cases are the
only target-runtime negative Gate and access-token occurrences MUST be zero.

Scope/alias/wildcard and human/service/delegated cases are non-discriminating in
production without a Grant because `direct.ts` checks `machine_grant_missing`
before `canonicalV1Scope`. They MUST therefore be executed only by the exact
`57258ec...` bundle validator and OAuth conformance suite, where fixtures reach
and assert their specific validation branches. The receipt MUST label them
`OFFLINE_DISCRIMINATING`, MUST NOT claim they were target-runtime proofs, and MUST
bind the exact test counts/error matrix. No positive scheduler issuance or test
Grant may occur in this round. Sanitized evidence may record error classes and
digests but no credential or token bytes.
The source identity is exactly Agent `agt_efficiency-agent`, Principal
`b21ddb23-42f6-47c4-a27f-bc44950e554c`, public client ID
`mc_cF81DF-XND9Zmzao4F08rOK_`, and client UUID
`695d1eeb-3547-4cbd-a72b-915f4ebf25a4`; there is no operator selection.
The sealed root helper requires the credential store to be one regular,
non-symlink file owned exactly `authsvc:authsvc` with mode `0600`, reads only
that Agent's entry, and requires its public client ID to match. It uses the
secret only in process for exactly the two bounded production requests above to
`http://127.0.0.1:4001/oauth/token`, redacts request authorization and response
bodies, persists no token/secret, and zeroizes the in-memory binding after the
second request. Missing, mismatched, differently owned/grouped/moded/typed,
symlinked, or unreadable credential storage fails closed.

### CTR-SD17-006 — Equal-face compensation

After interruption or any non-success, a `RECONCILE` entrypoint MUST first perform
only read-only classification under the deployment lock. It MUST bind live plist
bytes, loaded launchd arguments, PID/start time or proven process absence, health
version/digest or bounded unavailability, exact scheduler Audience/audit
correlation, Grant count, old/new snapshot and staging catalogs, copied `.env`
metadata/redacted hash, and receipt state to exactly one class. The classifier is
exhaustive across the ordered mutations `install snapshot -> commit DB -> switch
plist -> stop old -> start new -> verify`:

```text
PRESTATE_CLEAN
  old plist/loaded arguments + old PID/digest + scheduler row absent + candidate/staging absent
STAGED_ONLY
  old plist/loaded arguments + old PID/digest + scheduler row absent + exact candidate/staging present
FORWARD_DB_ONLY
  exact correlated row + old plist/loaded arguments + old PID/digest + exact candidate present
FORWARD_SWITCHED_NOT_STARTED
  exact row + new plist bytes + loaded old arguments + old PID/digest
FORWARD_OLD_STOPPED
  exact row + new plist bytes + no loaded service/PID + exact candidate present
FORWARD_NEW_EXITED
  exact row + new loaded arguments + no live PID + exact candidate present
FORWARD_NEW_UNVERIFIED
  exact row + new loaded arguments + fresh PID + health absent, unavailable, or wrong
FORWARD_ACTIVE
  exact row + new loaded arguments + fresh PID + exact new health/digest
COMPENSATED
  old plist/loaded arguments + fresh rollback PID/old digest + scheduler row absent + candidate/staging absent
AMBIGUOUS
  anything else, including missing read authority, unbounded health state,
  correlation mismatch, unexpected catalog, or unknown process identity
```

`PRESTATE_CLEAN` stops with zero writes. `STAGED_ONLY` removes only the exact
sealed, unreferenced candidate/staging tree (including copied `.env`) and uses
zero restart. `FORWARD_DB_ONLY` deletes only the exact correlated scheduler row,
appends one rollback audit row, then removes the exact unreferenced candidate,
with zero restart. `FORWARD_SWITCHED_NOT_STARTED` restores the exact old plist,
deletes only that row, appends the audit, removes the exact candidate, and uses
zero restart because no process generation changed. `FORWARD_OLD_STOPPED`,
`FORWARD_NEW_EXITED`, and `FORWARD_NEW_UNVERIFIED` restore the old plist and
loaded job, delete only that row, append the audit, and perform exactly one
rollback start/restart into the old snapshot;
after old health succeeds they remove the exact candidate. `FORWARD_ACTIVE`
is forward success only after every `CTR-SD17-007` proof passes; if any later
proof fails it follows the same exactly-one-restart compensation as
`FORWARD_NEW_UNVERIFIED`. `COMPENSATED` is a read-only terminal success.
`AMBIGUOUS` MUST publish `outcome_unknown`, perform no write/restart, and require
manual recovery; no uncertain mutation may be retried or replayed. A successful
forward path performs exactly one forward restart; forward and rollback counters
are separate and never inferred from a command exit code.

Every safe compensation MUST prove the original 1.6.0 digest, seven-audience DB
equality, scheduler absence, zero scheduler Grants, and unrelated-state
invariants. The append-only audit ledger may differ only by the exact correlated
`audience.registered` row and, when compensation runs, one exact rollback row;
all pre-existing audit bytes/rows remain. After rollback the installed plist
staging file and the entire exact new snapshot, including its copied `.env`,
MUST be removed only after proving they are unreferenced and match their sealed
path/catalog; any mismatch stops removal and becomes `outcome_unknown`. Every
transaction-created staging node must likewise be removed and absence-proved.
It MUST preserve the separately sealed artifact and durable
receipt. HUP/INT/TERM received after the first mutation MUST be recorded and
deferred until compensation and the terminal receipt finish; repeated signals
cannot abort compensation. A second signal changes neither target nor action,
and the helper exits nonzero only after the restored face is durably recorded.

### CTR-SD17-007 — Durable receipt and no overclaim

Success requires an atomic receipt at the artifact-bound path
`/private/var/root/auth-scheduler-1-7-*/receipts/<correlation>.json`, whose
directory is owned `root:wheel` with mode `0700` and whose file is regular,
non-symlink `root:wheel 0600`, binding authorization path,
artifact/seal/source/runtime digests, before/after snapshot and plist identity,
DB transaction/audit correlation, old/new PID, health, eight-audience readback,
negative matrix, zero Grant count, and unrelated-state digest. A dialog, Gate,
row, restart, health response, or receipt alone is not deployment success and
does not make Scheduler or dsh-agent-core production-ready.

Every invocation, including signal/interruption recovery, MUST terminate with
exactly one atomic root-owned receipt classified as `stopped_pre_mutation`,
`forward_success`, `compensated`, or `outcome_unknown`. If the process dies before
receipt publication, the next invocation is RECONCILE-only; it MUST NOT enter the
forward mutation path until classification proves `PRESTATE_CLEAN` and records the
prior missing receipt.

### CTR-GSD17-001 — Lifecycle boundary

Independent review and Owner acceptance may perform only a docs lifecycle
transaction. Its exhaustive byte allowlist is: (1) frontmatter
`status: proposed -> accepted`; (2) add `accepted_date`, `accepted_by`,
`accepted_at`, `accepted_reviewed_base`, `accepted_reviewed_head`, `independent_review_result`,
`independent_review_blockers`, `acceptance_verdict`,
`acceptance_semantic_delta`, and `acceptance_authority_basis`; (3) replace the
entire opening banner with exactly:

```text
> **ACCEPTED / PRODUCTION DEPLOYMENT AUTHORITY.** Accepted by `mayf3` at the
> exact independently reviewed head recorded in frontmatter. Contracts become
> active only after this lifecycle commit merges to `main`; every runtime Gate
> and separate downstream Grant authority remains mandatory.
```

(4) authoring footer `STATUS: proposed -> accepted` and
`OPEN_OWNER_DECISIONS: EXACT_HEAD_ACCEPTANCE -> NONE`; the already exact
`PRODUCTION_APPLY_AUTHORITY = contracts (inactive until accepted and merged)`
line remains byte-identical; (5) README row changes only `Status: proposed ->
accepted`, while its Implementation authority and Purpose cells remain
byte-identical. No other byte may change.

The added provenance values MUST bind exact reviewer identity/result/blockers,
the reviewed base and head, Owner identity/time/decision, `acceptance_verdict: accepted`,
and `acceptance_semantic_delta: none_after_review`. No artifact or production
byte may change in that transaction. An independent final-head check MUST prove
the exhaustive diff and unchanged normative content. The accepted exact head
must merge before artifact construction or production apply begins.

## 9. Acceptance

### ACC-SD17-001 — Source and artifact

- Contracts: `CTR-SD17-001`
- Method: two clean builds, manifest/hash comparison, full accepted validation
  suite, secret scan, complete type/link/hash/bytes/owner/group/mode catalog
  comparison, snapshot/plist/rollback inspection, and isolated `.env` copy test
- Pass: identical sealed outputs from `57258ec...`, exact 1.7.0 scheduler face,
  zero later-main/forum delta, zero secret in artifact, exact root/file/dir/helper
  and plist metadata, only contained manifest-declared symlinks, and `.env`
  copied only live-to-candidate as `authsvc:authsvc 0600` with equal redacted hash
- Fail: any nondeterminism, extra source/file, mutable input, missing rollback,
  validation failure, or secret.
- Execution environment/evidence: two separately created clean local worktrees
  on the production Mac, each detached at `57258ec...`; record `observed_at` in
  UTC, toolchain versions, both build transcripts, manifest/runtime/plist hashes,
  accepted-test results, and secret-scan result in the sealed artifact receipt.

### ACC-SD17-002 — Prestate and data transaction

- Contracts: `CTR-SD17-002`, `CTR-SD17-003`
- Method: locked fresh-read of live runtime/plist/snapshot and serializable DB
  preflight plus dry-run transaction
- Pass: exact 1.6.0/seven-audience face, scheduler row/Grant absence, native
  authorization identity, one-row/audit write plan only
- Fail: drift, existing scheduler row/Grant, non-native path, bad seal, broader
  DB plan, or any preflight mutation.
- Execution environment/evidence: production Mac root helper targeting exact
  `127.0.0.1:5432/agent_dev_center`, live snapshot/plist, and
  `system/com.auth-service`; record UTC `observed_at`, lock inode/owner,
  transaction isolation, full sanitized seven-row projection, zero-row counts,
  frozen target hashes, Goal ledger/process/participant-marker census, Owner
  no-concurrency attestation, three-wrapper contention transcript, exact table
  locks, and dry-run write counters.

### ACC-SD17-003 — Apply and runtime proof

- Contracts: `CTR-SD17-004`, `CTR-SD17-005`, `CTR-SD17-007`
- Method: execute sealed wrapper once; inspect receipt, process generation,
  health, DB/registry equality, two target-runtime negatives, the separately
  labeled offline discriminating matrix, credential custody, and unrelated digests
- Pass: one restart, fresh healthy 1.7.0 PID/digest, eight exact audiences,
  zero scheduler Grants, exact `machine_grant_missing` and foreign-audience
  errors, offline matrix PASS, zero secret/token persistence, durable receipt
- Fail: partial face, extra restart/write, positive issuance, retained mismatch,
  unrelated drift, missing/ambiguous receipt, or overclaim.
- Execution environment/evidence: production Mac sealed root transaction against
  `system/com.auth-service` and `http://127.0.0.1:4001`; record UTC
  `observed_at`, old/new PID plus process start time, source/runtime/manifest
  hashes, plist/snapshot identities, DB correlation/readback, negative result
  classes and offline label, request/access-token counts, credential-store
  metadata and selected public-client hash, and terminal receipt hash.

### ACC-SD17-004 — Rollback rehearsal and real compensation

- Contracts: `CTR-SD17-006`
- Method: isolated failure injection before/after DB write, plist switch,
  restart, health, readback, and receipt; invoke production compensation only
  on a real authorized failure
- Pass: every classified mutated failure returns to exact
  1.6.0/seven-audience/zero-Grant face; DB-only and switched-not-started states
  use zero rollback restarts, active-new-runtime uses exactly one, all terminate
  with the matching receipt, allowed audit delta, and candidate/staging absence
- Fail: mixed face, deletion beyond the correlated scheduler row, retry of an
  ambiguous mutation, wrong restart count, retained candidate/secret, missing
  audit evidence, or unproven baseline.
- Execution environment/evidence: isolated disposable local harness with fake
  DB, launchd/process, filesystem, credential store, signals, and clock; record
  UTC `observed_at`, harness/source hashes and per-boundary transcripts. The
  production environment records the same coordinates only if a real authorized
  failure invokes compensation, including candidate/staging absence proof.

### ACC-GSD17-001 — Authority lifecycle

- Contracts: `CTR-GSD17-001`
- Method: independent exact-head review, explicit Owner acceptance, lifecycle
  allowlist diff, final-head recheck, merge ancestry proof
- Pass: accepted merged exact head, zero semantic drift after review, no
  production action before merge
- Fail: missing identity/provenance, changed head, non-doc delta, or early apply.
- Execution environment/evidence: clean auth-service governance worktree; record
  UTC `observed_at`, reviewed base/spec/final-head commits, reviewer and Owner
  identities, lifecycle-only diff, verifier transcript, and merge ancestry.

## 10. Alternatives

- Deploy current `github/main`: rejected; it includes later forum-moderator
  registry/runtime deltas outside Lane C.
- Backfill DB now and deploy later: rejected; creates a registry mismatch.
- Deploy snapshot now and backfill later: rejected; health must fail closed.
- Reuse `scheduler.audit` in the initial operational Grant: rejected unless the
  downstream canary proves global/foreign history is indispensable.

## 11. Migration, compatibility, and rollback

This is an additive 1.6.0-to-1.7.0 snapshot transition. It does not rewrite the
seven existing Audience rows, Clients, Principals, Grants, credentials, or
Minimal Auth V2 migration state. The new runtime must remain wire-compatible for
all seven existing audiences; their exact registry/DB equality and focused token
smokes are mandatory. No consumer may select behavior by version text alone;
the exact runtime digest is authoritative.

Rollback follows only the `CTR-SD17-006` classified state machine. Its target is
the exact old plist, loaded arguments, snapshot, 1.6.0 digest, seven Audience
rows, zero Scheduler rows/Grants, and unchanged unrelated DB/file state. The only
permitted durable difference is the append-only correlated audit evidence. The
failed new snapshot is not retained: it is removed with its copied secret only
under the exact unreferenced/catalog Gate; otherwise the result is
`outcome_unknown` and manual recovery owns it.

## 12. Open questions

```text
OPEN_OWNER_DECISIONS = EXACT_HEAD_ACCEPTANCE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
ARTIFACT_STATE = NOT_BUILT
PRODUCTION_STATE = 1.6.0_UNCHANGED
SCHEDULER_AUDIENCE = ABSENT
SCHEDULER_GRANTS = ZERO
```

## 13. Authoring status

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
OPEN_OWNER_DECISIONS = EXACT_HEAD_ACCEPTANCE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
AUTHORING_READY_FOR_REVIEW = YES
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
