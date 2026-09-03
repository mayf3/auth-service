---
spec_id: AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-04
revision: r1
scope:
  - two permanent least-privilege machine grants for agt_efficiency-agent
  - two ordered, separately compensated production transactions
  - agent_session_send and cross-agent scheduler operational continuity
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_TEMP_GRANT_V1
  - AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
  - AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V1
    revision: d6c781696b1c30d482ac5d32023afe5edc7226a9
    relation: constrained_by
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
    revision: 4c0a62382cabb9641dbf512a8d5f8ce8a9fed1f2
    relation: constrained_by
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V2
    revision: e225d7b22e90d09f5658e267edb7c871c808434a
    relation: depends_on
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1

> **PROPOSED / NON-AUTHORITATIVE.** This docs-only proposal creates no Grant
> and authorizes no production action until independent exact-head review,
> explicit Owner acceptance, lifecycle finalization, and merge to `main`.

## 1. Goal and exact subject

Authorize exactly two permanent least-privilege operational permissions for the
already active source Agent in two ordered, independently gated transactions:

```text
SOURCE_AGENT_ID = agt_efficiency-agent
SOURCE_PRINCIPAL_UUID = b21ddb23-42f6-47c4-a27f-bc44950e554c
SOURCE_CLIENT_ID = mc_cF81DF-XND9Zmzao4F08rOK_
SOURCE_CLIENT_UUID = 695d1eeb-3547-4cbd-a72b-915f4ebf25a4

GRANT_1 = agent-session-messaging / {agent.session.send} / permanent / version 2
GRANT_2 = scheduler / {scheduler.admin} / permanent / version 1

PHASE_B = reactivate GRANT_1 after the temporary A2A canary is terminally compensated
PHASE_C = create GRANT_2 only after Lane B is terminal, Scheduler Auth is production-live, and Scheduler Runtime deployment is terminal FORWARD_ACTIVE
```

`scheduler.audit` is deliberately absent: daily autonomy requires cross-Agent
job definition/control, while global/foreign history read is not needed for the
bounded production proof.

## 2. Boundaries

The authority permits exactly two serializable one-row transactions and exact
readback. They MUST NOT be combined, reordered, or partially co-committed:
Phase B makes permanent send active and closes Lane B before Phase C may begin;
Phase C adds only scheduler permission and cannot revoke or rewrite Phase B.
It does not create or rotate credentials, Principals, Clients, Audiences, or
Sessions; grant any target Agent; touch existing workflow/forum/other Grants;
grant `scheduler.audit`; use aliases/wildcards/manage-any labels; change
dsh-agent-core behavior; or authorize any fleet migration.

The permissions are permanent by purpose. A downstream canary failure does not
silently revoke them; future narrowing/revocation requires its own authority or
the repository's emergency containment seam.

## 3. Authority and prerequisite state

```text
AUTHORING_BASE = 2bafb58463490896623a313a01e8fe17eace2b4b
AUTH_MAIN_BASE = ff9e1bec7d364568a92be91f6ffbd49d1d2101de
ASM_AUDIENCE_AUTHORITY = accepted @ 34ca9c6f2d677096a7c2b17a6ed023fa62c0da2e
ASM_TEMP_GRANT_AUTHORITY = accepted/current @ 95f8ea9275b0184416d2ac7a1043746c58fe5f57
SCHEDULER_AUDIENCE_AUTHORITY = accepted @ 687c3b1eb3c671b1b4edf343fe96c07e9f00f92a
SCHEDULER_AUTH_DEPLOYMENT = AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1 semantic head c708b37cbfa1e577f80da40439bf18cfc259c84d (must be accepted at this exact reviewed content, merged, final-head PASS, production PASS)
ASM_DEPLOYMENT = dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V2 semantic head e225d7b22e90d09f5658e267edb7c871c808434a (must be accepted at this exact reviewed content, merged, final-head PASS, Stage B/D/E PASS)
SCHEDULER_RUNTIME_COORDINATION = dsh-agent-core AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1 (resolve current accepted merged authority and terminal FORWARD_ACTIVE receipt at Phase-C Gate; deployment before Phase C; sole cross-Agent canary only after C_ACTIVE)
PRODUCTION_DB_ENDPOINT = 127.0.0.1:5432 / database agent_dev_center
AUTH_ORIGIN = http://127.0.0.1:4001
GLOBAL_MUTATION_LOCK = /var/run/auth-service-production-mutation.lock
CREDENTIAL_STORE = /usr/local/libexec/agent-core/config/agent-credentials.json
```

- `STATE-DAG-001` — Source identity is the active Agent/client tuple already
  used by the production workflow lane; no new credential is needed. Basis:
  `OBS-DAG-001`, `EVD-DAG-001`.
- `STATE-DAG-002` — Phase B preimage is one preserved ASM temporary tombstone
  (`revoked_at` non-null, version 0, exact scope); its result is one permanent
  live ASM row. Phase C preimage requires that exact live ASM row and no
  scheduler row. These are future gated states, not claimed current.
  Basis: `OBS-DAG-002`, `CLM-DAG-001`, `EVD-DAG-002`.
- `STATE-DAG-003` — The two audience authorities register broader available
  scope sets, but least privilege requires one scope per permanent Grant.
  Basis: `OBS-DAG-003`, `EVD-DAG-003`.

## 4. Observations

### OBS-DAG-001 — Exact source client ownership

- Subject/revision/environment/time: auth production identity census bound to
  `github/main@ff9e1bec7d364568a92be91f6ffbd49d1d2101de`, production DB
  `127.0.0.1:5432/agent_dev_center`, observed `2026-09-03T16:41:01Z`
- Method/query/result: read-only exact-key projection of `machine_principals` and
  `machine_clients` by frozen UUID/public client ID, including status, principal
  type, agent ID, ownership, and active-client count; the active client UUID/ID
  above is the sole active client bound to principal `b21ddb23...` and agent ID
  `agt_efficiency-agent`
- Provenance: `docs/evidence/daily-autonomy-operational-grants-v1/IDENTITY_READBACK.md`
  in this proposal revision, canonical result SHA-256
  `adc898813dfc1db804aedf6985db624756a351dd7a0622b7c5e177da2c960886`; accepted temp-Grant authority
  `95f8ea9275b0184416d2ac7a1043746c58fe5f57` and artifact manifest
  `/Users/yanfenma/workspace/deployment-artifacts/agent-session-messaging-temp-grant-v1/ARTIFACT_MANIFEST.json`
  SHA-256 `42f464b8f9ae26cffa4a365bf41985beeaf0691d9b7725d6332314ebf8a612be`.

### OBS-DAG-002 — Current and required preimages differ by lawful prior stages

- Subject/revision/environment/time: production `machine_access_grants`,
  `mayf3/dsh-agent-core@04c5dad53762b5dc44cc1e451a23fa31eb23ac08`,
  observed epoch ms `1788419569545`
- Method/query/result: local read-only `psql`, host `localhost`, user `auth_ro`,
  database `agent_dev_center`, ordered per-audience count plus exact absence
  predicate for `agent-session-messaging|scheduler`; zero rows observed; the
  accepted temporary Grant flow must later create then preserve an ASM
  `version=0` tombstone before this permanent transaction may run
- Provenance: `mayf3/dsh-agent-core` path
  `docs/evidence/workflow-execute-receipt-recovery-v2-20260903/GRANT_READBACK.md`
  at `04c5dad53762b5dc44cc1e451a23fa31eb23ac08`, SHA-256
  `c5f1c188182d6010b4c70e93deafeeeef7c23fdd517bcb4778ae468adef65389`,
  plus temp authority `95f8ea9275b0184416d2ac7a1043746c58fe5f57`.
- Schema note: the repository Prisma model does not map
  `machine_access_grants.revoked_at`; the accepted temporary-Grant vehicle uses
  raw SQL because production added that column out of band. This proposal does
  not infer the live column from the model: the apply preflight must prove the
  exact production column and key shape from `information_schema` under lock.

### OBS-DAG-003 — Exact registered scope sets

- Subject/revision/environment/time: deployed ASM registry source
  `4d383ee02d298eebeb15470a5328b7345ed140e9` and Scheduler registry source
  `57258ec33700af8057ab2ed63fd8e52b3225e749`; clean Git objects inspected
  `2026-09-03T16:34:41Z`
- Method/result: exact registry JSON blob projection; ASM registers only `agent.session.send`;
  Scheduler registers `scheduler.admin` and `scheduler.audit` as non-implying
  scopes
- Provenance: accepted CCRs and exact path
  `contract-bundles/minimal-auth-v1/audience-registry.json`; ASM source Git blob
  `fca5a92721b9038286545fef9c774ccd4b15fe5e`, SHA-256
  `695b059247c532805e0f78856dd40761386a5ff428e0b8b168e6066aea4eab3c`;
  Scheduler source Git blob `253708fba079ed580f9d7cd8676bf616b6d3e568`,
  SHA-256 `f7d4dcc76f58cfae57787c612819c987398fa06fdcfb598b69bbf6f41e3290ec`.

## 5. Claims

### CLM-DAG-001 — Phase B can reuse the temp tombstone safely

- Support state: SUPPORTED
- Support: composite primary key forbids a second ASM row; exact reactivation of
  the preserved tombstone is narrower and more auditable than delete/reinsert
- Uncertainty: production raw column/type/preimage must be rechecked under lock.

## 6. Evidence

- `EVD-DAG-001` — Source `OBS-DAG-001`; target `STATE-DAG-001`; relation
  SUPPORTS; exact client/principal coordinates; strong for identity, no secret
  material observed.
- `EVD-DAG-002` — Source `OBS-DAG-002`; target `CLM-DAG-001`; relation SUPPORTS;
  exact temp authority and DB primary-key shape; strong for transaction design,
  conditional on completed canary compensation.
- `EVD-DAG-003` — Source `OBS-DAG-003`; target `STATE-DAG-003`; relation
  SUPPORTS; exact accepted registry entries; strong for least-privilege scope
  selection, not downstream product conformance.

## 7. Decisions

### DEC-DAG-001 — One named operator Agent, two exact permissions

Select the existing `agt_efficiency-agent` client and no other subject. Reject
fleet, target-Agent, service/human/delegated, and new-credential alternatives.

### DEC-DAG-002 — Use two ordered one-row transactions

Phase B updates only the preserved ASM primary-key row to `revoked_at=NULL`,
exact scope, version 2. It then closes Lane B. Phase C, and only Phase C, inserts
the absent Scheduler row once with version 1 while requiring the Phase-B row to
remain byte-equivalent. Reject a combined transaction, delete/reinsert of ASM,
and any upsert that hides drift.

### DEC-DAG-003 — Exclude scheduler.audit

Grant only `scheduler.admin`; reject the tempting two-scope superset. A future
global/foreign history requirement must establish separate evidence/authority.

## 8. Contracts

### CTR-DAG-001 — Hard prerequisites and fail-closed preimage

Phase B MUST begin only after: (1) this Spec is accepted and merged; (2) Session
Messaging Deployment V2 is byte-equivalent to semantic head `e225d7b22e90d09f5658e267edb7c871c808434a`
apart from its declared lifecycle-only acceptance, is merged, and its deployment
plus D/E real A2A canary are PASS; (3) the temporary ASM Grant is terminally
compensated with one preserved exact-scope row having non-null `revoked_at`,
version 0, zero live rows, and post-revoke issuance non-200; and (4) the source
Principal/Client and ASM Audience are active/exact. Scheduler Auth/runtime is
not a Phase-B prerequisite. Any missing, duplicate, live, differently scoped,
or differently versioned ASM row stops without mutation.
The locked Phase-B preflight also proves the source has zero Scheduler Grant
rows. Both phase preflights prove the source has zero `svc-okr` Grant rows while
the `svc-okr` Audience is active, machine-enabled, and registers `okr.read`;
drift stops rather than selecting another foreign audience.

Phase C MUST begin only after the Phase-B receipt is terminal `B_ACTIVE`, its
ASM row and a fresh token remain exact, and `LANE_B=PRODUCTION_READY`. It also
requires: (1) Scheduler Auth deployment byte-equivalent to semantic head
`c708b37cbfa1e577f80da40439bf18cfc259c84d` apart from lifecycle-only acceptance,
merged and production PASS at the pinned 1.7.0 digest; and (2) the Scheduler
Audience is active/exact and the source
client has no Scheduler row; and (3) downstream Scheduler Runtime deployment
authority, after its exact-head acceptance/merge/final-head PASS, has a terminal
`FORWARD_ACTIVE` deployment receipt at the resolved accepted authority,
with its business canary still unrun. Phase C MUST NOT begin earlier. Any normative drift,
unmerged/unaccepted authority, or preimage mismatch stops without mutation.
Only after Phase C reaches terminal `C_ACTIVE` may the already deployed
`AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1` run its one cross-Agent canary.
The Phase-C Gate resolves the current merged Spec by stable ID, requires accepted
lifecycle metadata with exact reviewed base/head and PASS/zero blockers, proves
that accepted head is an ancestor of current dsh `main`, and requires the
terminal deployment receipt's `authority_spec` and `authority_accepted_head` to
match it. This downstream receipt Gate, not an Auth-side exact SHA pin, fails
closed on any replacement or unreviewed successor and breaks revision chasing.

Each phase's locked preflight MUST prove that production
`machine_access_grants.revoked_at` exists as nullable
`timestamp(3) without time zone`, that the table primary key remains exactly
`(machine_client_id, audience_id)`, and that the raw-SQL projection returns the
phase-specific expected row face. Missing/drifted column type, nullability,
precision, key, or row projection stops before mutation; Prisma model shape is
not evidence of the production column.

### CTR-DAG-002 — Two isolated one-row serializable transactions

The sealed helper MUST acquire exactly
`/var/run/auth-service-production-mutation.lock` before its first preimage read
and hold it continuously through each phase's commit, token verification,
compensation if needed, and terminal receipt publication. Phase B and Phase C
use distinct correlation IDs, artifacts, processes, and receipts. Its owned
participant set is closed to the four Auth transactions serialized by
`CORE_RUNTIME_DAILY_AUTONOMY_OVERNIGHT_V1`: the scheduler bundle deployment,
the accepted temporary ASM Grant apply/revoke vehicle at
`/Users/yanfenma/workspace/deployment-artifacts/agent-session-messaging-temp-grant-v1`,
this permanent-Grant Phase B, and this permanent-Grant Phase C. The Goal coordinator wraps every
participant from first preimage read through terminal receipt and schedules no
overlap; this Spec does not claim to retrofit unrelated Auth writers.

Before mutation, Goal ledger, process census, participant receipt/marker census,
and native Owner attestation MUST prove that no other participant or Auth
production mutation is authorized, scheduled, active, or outcome-ambiguous in
the window. Any competing/unknown writer or unfinished receipt stops. An
isolated contention matrix MUST hold the lock in each of all four wrappers and
prove every other three wrappers reject before DB/file access (12 ordered
holder/contender cases). Database target identity is
exactly TCP
`127.0.0.1:5432`, database `agent_dev_center`; the secret-bearing connection
string is read only inside the root helper from the active auth snapshot's
root-readable `.env`, never accepted as an argument/environment override, and
never logged or persisted.

Under an explicit PostgreSQL `SERIALIZABLE` transaction, write-conflicting locks
on `auth_audiences`, `machine_access_grants`, and `auth_security_audits`, exact
row locks, and guarded row counts:

1. Phase B MUST update exactly the existing ASM tombstone identified by the
   composite key, setting only `scopes={agent.session.send}`, `version=2`,
   `revoked_at=NULL`, and `updated_at=now()`, and append exactly one Phase-B
   forward audit row.
2. Phase C MUST first freeze and hash the live Phase-B row, then insert exactly
   one Scheduler row for the same client with `scopes={scheduler.admin}`,
   `version=1`, and append exactly one Phase-C forward audit row. Its transaction
   MUST assert the Phase-B row is unchanged before commit.

Neither transaction may write the other phase's business row. No combined
transaction, upsert, wildcard predicate, Phase-B DELETE, partial commit, or
automatic retry after an ambiguous outcome is allowed.

### CTR-DAG-003 — Least privilege and non-propagation

After Phase B the source client MUST have exactly the permanent ASM row and no
Scheduler row; after Phase C it MUST contain only the two exact permissions above.
All target agents MUST have zero rows for both audiences. `scheduler.audit`,
aliases, wildcards, local manage-any labels, human/service/delegated grants, and
credentials MUST remain absent. A granted source token or authority MUST never
be copied into a target Agent execution context.

### CTR-DAG-004 — Positive/negative verification

Every request is exactly `POST http://127.0.0.1:4001/oauth/token`, HTTP Basic
with the frozen source client ID and in-process secret, content type
`application/x-www-form-urlencoded`, and body
`grant_type=client_credentials&resource=<resource>&scope=<scope>`. Phase B runs
exactly five requests: `(agent-session-messaging,agent.session.send)` MUST be
HTTP 200 and decode to the exact source principal/agent/client/audience/scope;
`(agent-session-messaging,agent.session.read)`,
`(agent-session-messaging,agent_session_send)`,
`(agent-session-messaging,*)`, and `(svc-okr,okr.read)` MUST each be
HTTP 400 `{error:"invalid_scope"}`. The last request is a source-authenticated
foreign-audience denial because the locked preflight proves the active
registered Audience and no source Grant row.

Phase C runs exactly seven requests: `(scheduler,scheduler.admin)` and the ASM
continuity tuple `(agent-session-messaging,agent.session.send)` MUST each be HTTP
200 with exact decoded identities/scopes; `(scheduler,scheduler.audit)`,
`(scheduler,"scheduler.admin scheduler.audit")`,
`(scheduler,scheduler.manage:any)`, `(scheduler,*)`, and
`(svc-okr,okr.read)` MUST each be HTTP 400 `{error:"invalid_scope"}`. Locked
preflight MUST prove `svc-okr` is active/machine-enabled and the source has zero
`svc-okr` Grant rows, making the last request an authenticated registered-
audience denial rather than an unavailable-audience surrogate. Any other
request, count, status, error class, decoded field, or ordering fails the phase.
Tokens and credentials MUST NOT be persisted.
There is no operator-selected identity. The helper reads only
`agt_efficiency-agent` from
`/usr/local/libexec/agent-core/config/agent-credentials.json`, which MUST be a
regular non-symlink `authsvc:authsvc 0600` file with the exact JSON shape
`{version:1,credentials:{<agentId>:{clientId,clientSecret}}}` and exactly one
lookup by key `agt_efficiency-agent`. It rejects extra keys in that selected
entry, requires public client ID `mc_cF81DF-XND9Zmzao4F08rOK_`, and uses its secret only in process against
`http://127.0.0.1:4001/oauth/token`, redacts authorization and response bodies,
and zeroizes the binding after the phase's bounded matrix. Missing, mismatched,
differently typed/owned/grouped/moded, symlinked, or unreadable storage fails closed.
All token negatives use the exact source credential, so they discriminate scope
or audience denial after successful client authentication. Target exclusion is
proved without target credentials by an exhaustive locked join over every
active `machine_clients` row whose Principal `agent_id != agt_efficiency-agent`:
the count of live Grants for either target audience MUST be zero, and its sorted
`principal_id,agent_id,client_id,audience_id,scopes,version` projection hash is
bound in the receipt. Human/service/delegated denial is proved by the active Audience
profiles (`accepted_principal_types=[agent]`, human/delegated disabled) plus
complete Grant censuses; an unavailable or deliberately wrong credential MUST
NOT stand in for authorization denial.

### CTR-DAG-005 — Post-commit compensation

Each phase owns only its own compensation. If Phase B verification fails after
commit, its one pre-authorized compensation transaction MUST return only the ASM
row to the exact frozen tombstone (`revoked_at`, `updated_at`, version 0, exact
scope), append its Phase-B compensation audit, and prove zero live ASM rows.
If Phase C verification fails after commit, its compensation MUST delete only
the newly created Scheduler row whose exact key and creation correlation match,
append its Phase-C compensation audit, and prove the previously terminal Phase-B
ASM row is byte-equivalent and its fresh token still succeeds. Phase C has no
authority to update, revoke, delete, or compensate the ASM row.

An ambiguous transaction outcome MUST be read back by phase before action and
MUST NOT be blindly replayed. Successful Phase B leaves only ASM permanent;
successful Phase C leaves both permanent rows live.
HUP/INT/TERM received after the first mutation MUST be recorded and deferred
until compensation and the terminal receipt finish; repeated signals cannot
abort or retarget compensation. The helper exits nonzero only after the exact
restored face is durably recorded.

The Phase-B state machine is closed:

| Readback face | Permitted action/outcome |
|---|---|
| exact ASM tombstone + no B correlation audit | internal `B_NOT_COMMITTED`; publish `B_FAILED_UNCHANGED`, stop, no retry |
| exact ASM live v2 + exact B forward audit | internal `B_COMMITTED`; publish no intermediate receipt, continue verification, never replay |
| any other ASM/audit face | no forward retry; compensate only when exact key/preimage/correlation makes the transition unique, otherwise publish `B_MANUAL_RECOVERY_REQUIRED` |
| exact restored ASM tombstone + exact B forward/compensation audits | deny fresh ASM issuance; publish `B_RESIDUAL_AUTHORIZATION` if an issued B token remains unexpired, otherwise `B_RESTORED` |
| unknown face after B compensation attempt | no compensation retry; publish `B_MANUAL_RECOVERY_REQUIRED` |

The Phase-C state machine is closed and always hashes/asserts the terminal
Phase-B row before and after every action:

| Readback face | Permitted action/outcome |
|---|---|
| exact ASM live v2 + Scheduler absent + no C correlation audit | internal `C_NOT_COMMITTED`; publish `C_FAILED_UNCHANGED`, stop, no retry |
| exact ASM unchanged + Scheduler live v1 + exact C forward audit | internal `C_COMMITTED`; publish no intermediate receipt, continue verification, never replay |
| any Scheduler/audit mismatch with ASM unchanged | no forward retry; compensate only when exact key/preimage/correlation makes the C transition unique, otherwise publish `C_MANUAL_RECOVERY_REQUIRED` |
| exact ASM unchanged + Scheduler absent + exact C forward/compensation audits | deny fresh Scheduler issuance; publish `C_RESIDUAL_AUTHORIZATION` if an issued C token remains unexpired, otherwise `C_RESTORED` |
| any ASM drift or unknown face after C compensation attempt | no write and no compensation retry; publish `C_MANUAL_RECOVERY_REQUIRED` |

After Phase-B compensation, fresh ASM issuance MUST be non-200. After Phase-C
compensation, fresh Scheduler issuance MUST be non-200 while fresh ASM issuance
MUST remain 200 with exact claims. Every successfully issued token's `exp` is
retained only as a sanitized timestamp; downstream use is quarantined until the
latest token whose authority was compensated expires (TTL at most 600 seconds),
and only then may the phase become `B_RESTORED` or `C_RESTORED`. Before expiry
the honest outcome is `RESIDUAL_AUTHORIZATION`; unknown expiry is
`MANUAL_RECOVERY_REQUIRED`, never restored.
Each residual receipt is immutable. After the latest compensated token expiry,
a later read-only reconciliation invocation MUST re-prove the restored DB/audit/
denial face and publish a new no-clobber `B_RESTORED` or `C_RESTORED` receipt
whose `parent_receipt_sha256` binds the residual receipt; it never replaces or
edits the residual receipt. Before expiry it emits no new receipt. Unknown or
drifted state publishes the phase-prefixed manual-recovery outcome.

### CTR-DAG-006 — Exact immutable audit envelopes

These raw-SQL tombstone transitions MUST use the existing immutable
`auth_security_audits`, not `grant_change_audits`: the latter's version check
cannot truthfully represent restoration to version 0. No schema change is
authorized. Each phase uses one UUID correlation value in
`request_correlation_id`; preflight requires zero rows for it, and readback
requires exactly the expected one or two immutable rows. Reuse or duplicate is
drift, never idempotent success.

Every row has exactly: UUID `id`; event type from
`daily_autonomy.asm.forward|daily_autonomy.asm.compensated|daily_autonomy.scheduler.forward|daily_autonomy.scheduler.compensated`;
`result=success`; all five identity UUID columns (`user_id`, `human_client_id`,
`human_session_id`, `refresh_family_id`, `credential_id`) null; exact correlation;
DB-generated UTC `timestamp(3)`; and `details` with exactly
`schema_version=1`, `phase=B|C`, `source_agent_id`, `source_principal_uuid`,
`source_client_id`, `source_client_uuid`, `audience_id`, `operation`,
`before_value`, `after_value`, `expected_version`, `resulting_version`,
`authority_spec`, `authority_semantic_head`, `operator_id`, `approval_ref`,
`source_git_commit`, and `reason`. Before/after values are complete sanitized
row projections or null; compensation details additionally bind the forward
audit UUID. Secret/token bytes are forbidden. The transaction must prove the
table's exact column types/nullability, primary key, immutability trigger, and
the absence of any extra details key before writing.

### CTR-DAG-007 — Native path, artifact, and durable receipt

The non-secret operator artifact is exactly
`/Users/yanfenma/workspace/deployment-artifacts/daily-autonomy-operational-grants-v1`
with canonical entrypoints `RUN_DAILY_AUTONOMY_GRANT_B_OWNER.sh` and
`RUN_DAILY_AUTONOMY_GRANT_C_OWNER.sh`. Its exhaustive closure is those two
regular executable files plus `ARTIFACT_MANIFEST.json`, one phase-specific
sealed-input JSON and SHA-256 list per phase, one read-only checker, and no other
path. The manifest binds every relative path/type/bytes/mode/SHA-256, both
semantic authorities, exact tuple/audiences/scopes/versions, DB/origin/lock,
audit envelope, timeouts, and receipt schema. Artifact creation occurs only
after accepted exact-head merge; any extra path, writable input, symlink, special
file, seal mismatch, or secret stops.

Each entrypoint is copied with its sealed inputs to a nonce-scoped
`/private/var/root/daily-autonomy-grants-v1-*` directory owned `root:wheel 0700`;
data are regular `root:wheel 0600` and runners regular `root:wheel 0700`. It is
invoked only through an Owner-approved macOS native authorization dialog. No
password fallback is allowed.

Each atomic receipt is a regular non-symlink `root:wheel 0600` JSON file in that
phase's root directory with exactly: `schema_version`, `phase`, `outcome`,
`correlation_id`, `started_at`, `finished_at`, `authority_spec`,
`authority_semantic_head`, `artifact_manifest_sha256`, `runner_sha256`,
`sealed_inputs_sha256`, `authorization_method`, `operator_id`, `approval_ref`,
`db_identity`, `lock_identity`, `preimage_sha256`, `postimage_sha256`,
`unrelated_rows_sha256`, `audit_ids`, `request_counts`, `sanitized_result_classes`,
`token_expiries`, `signal_events`, `parent_receipt_sha256`, and
`evidence_sha256`. Closed outcomes are
`B_STOPPED_PREMUTATION|B_FAILED_UNCHANGED|B_ACTIVE|B_RESTORED|B_RESIDUAL_AUTHORIZATION|B_OUTCOME_UNKNOWN|B_MANUAL_RECOVERY_REQUIRED`
for Phase B and the same `C_*` forms for Phase C. Only `B_ACTIVE` and `C_ACTIVE`
are forward success; residual/unknown/manual outcomes are nonterminal for Goal
readiness. A Gate, dialog, row count, token, or receipt alone is not operational
readiness.
For `B_ACTIVE`, `request_counts` is exactly
`{total:5,success:1,denied:4}` and `sanitized_result_classes` in request order is
exactly `[issued,invalid_scope,invalid_scope,invalid_scope,invalid_scope]`. For
`C_ACTIVE`, they are exactly `{total:7,success:2,denied:5}` and
`[issued,issued,invalid_scope,invalid_scope,invalid_scope,invalid_scope,invalid_scope]`.
Compensated/non-success receipts bind the executed prefix counts/classes and the
specific first failing ordinal; they may not claim unexecuted requests.
For a quarantine-clear reconciliation receipt, `parent_receipt_sha256` is the
required parent digest; it MUST be null for every other outcome. The
new terminal receipt is published no-clobber and the parent residual receipt
remains byte- and inode-identical.
Lock acquisition is bounded to 30 seconds, native authorization dialog to 120
seconds, DB lock/statement/whole-transaction time to 5/10/30 seconds, and the
complete token/readback matrix to 60 seconds with each request bounded to 5
seconds. Timeout before mutation exits unchanged; timeout after mutation enters
compensation. Timeout or ambiguous outcome is never success and is never a
reason for blind retry.
Immediately before issuing the first mutating SQL statement or attempt, the
helper MUST arm the post-mutation signal fence. Before that fence, HUP/INT/TERM
exits unchanged with the phase's `*_STOPPED_PREMUTATION` receipt. From the
armed fence through the first attempt (including an in-flight or ambiguous
outcome) and until the state machine reaches a terminal receipt, all signals
are recorded/deferred; they cannot select a different transition, skip denial
or quarantine, or convert a nonterminal face to success.
If a process exits before atomic receipt publication, its next invocation is
read-only reconciliation only; it MUST classify by exact row/audit correlation
and may not enter a forward path. Phase C reconciliation always asserts the
Phase-B row unchanged. An uncertain mutation is never replayed.

### CTR-GDAG-001 — Lifecycle boundary

Review/acceptance may perform only this exhaustive docs lifecycle transaction:
(1) frontmatter `status: proposed -> accepted`; (2) add `accepted_date`,
`accepted_by`, `accepted_at`, `accepted_reviewed_base`, `accepted_reviewed_head`,
`independent_review_result`, `independent_review_blockers`,
`acceptance_verdict`, `acceptance_semantic_delta`, and
`acceptance_authority_basis`; (3) replace the opening banner with exactly:

```text
> **ACCEPTED / PRODUCTION GRANT AUTHORITY.** Accepted by `mayf3` at the exact
> independently reviewed base/head recorded in frontmatter. Contracts become
> active only after this lifecycle commit merges to `main`; every phase Gate,
> native authorization, compensation, and proof remains mandatory.
```

(4) footer `STATUS: proposed -> accepted` and
`OPEN_OWNER_DECISIONS: EXACT_HEAD_ACCEPTANCE -> NONE`, leaving the existing
production-authority line byte-identical; and (5) README row Status only
`proposed -> accepted`, leaving its other cells byte-identical. Added provenance
MUST bind exact base/head, reviewer identity/result/blockers, Owner identity/time/
decision, `acceptance_verdict: accepted`, and
`acceptance_semantic_delta: none_after_review`. No other byte, artifact,
credential, DB row, token, or production state may change. Final-head review and
merge ancestry are mandatory before either artifact is built or applied.

## 9. Acceptance

### ACC-DAG-001 — Preconditions and exact plan

- Contracts: `CTR-DAG-001`, `CTR-DAG-002`
- Method: run each phase's sealed census/plan independently under lock, including
  the case where Scheduler Audience/runtime is not yet available during Phase B
- Pass: Phase B plans exactly one ASM update plus one audit and can PASS without
  Scheduler; only after `B_ACTIVE`/Lane-B terminal may Phase C plan exactly one
  Scheduler insert plus one audit while hashing ASM unchanged
- Fail: live/duplicate/drifted row, missing proof, broader predicate/delta, or
  preflight mutation.
- Execution environment/evidence: production Mac sealed root helper targeting
  exact `127.0.0.1:5432/agent_dev_center`; record UTC `observed_at`, global-lock
  inode/owner, SERIALIZABLE settings, `information_schema` column/key result,
  complete sanitized source/audience/row projections, Goal ledger/process/
  participant-marker census, Owner no-concurrency attestation, four-wrapper
  contention transcript, exact table locks, and planned write counts.

### ACC-DAG-002 — Least privilege and tokens

- Contracts: `CTR-DAG-003`, `CTR-DAG-004`
- Method: exact per-phase row readback, exhaustive non-source target/fleet and
  principal-type profile census, exact Phase-B 5-request matrix, then exact
  Phase-C 7-request Scheduler/ASM matrix, all negatives source-authenticated
- Pass: Phase B reaches permanent ASM-only `B_ACTIVE`; Phase C starts later and
  reaches two exact rows with ASM byte-equivalent, exact single-scope claims,
  every negative denied, target rows absent, human/service/delegated profiles
  and Grant censuses excluding access, and no persisted token
- Fail: extra scope/subject/row, token leakage, privilege propagation, or any
  negative issuance.
- Execution environment/evidence: production Mac against exact
  `http://127.0.0.1:4001/oauth/token` using the frozen root-only credential-store
  entry; record UTC `observed_at`, request count/result classes, sanitized claim
  hashes, final row projections, exhaustive non-source projection/hash and zero
  count, and unrelated digest.

### ACC-DAG-003 — Compensation isolation, audit, artifact, and receipt

- Contracts: `CTR-DAG-005`, `CTR-DAG-006`, `CTR-DAG-007`
- Method: isolated failure injection at every transaction/verification boundary;
  production compensation only after real authorized failure
- Pass: Phase-B failure restores only its exact tombstone; every Phase-C failure,
  ambiguous outcome, signal, and receipt-publication boundary leaves the terminal
  ASM row and token behavior unchanged while restoring only Scheduler; audit
  envelopes/counts, sealed manifest, no-replay, quarantine, closed outcome, and
  atomic receipt schemas are exact
- Fail: blind retry, mixed face, wrong timestamp/version/scope, missing audit,
  early restored claim, residual-token use, unrelated-row drift, unsafe
  authorization path, or ambiguous overclaim.
- Execution environment/evidence: isolated disposable local harness with fake
  DB/auth endpoint/credential store/signals/clock for every failure boundary,
  recording UTC `observed_at`, harness/source hashes, per-boundary transcript,
  restored-face digest, and receipt hash. Production records the same exact
  coordinates only if a real authorized failure invokes compensation.

### ACC-GDAG-001 — Authority lifecycle

- Contracts: `CTR-GDAG-001`
- Method: independent exact-head review, Owner acceptance, lifecycle allowlist,
  final-head recheck, merge ancestry
- Pass: accepted merged exact head with zero post-review semantic drift and zero
  early production effect
- Fail: missing authority/provenance, changed head, non-doc delta, or early apply.
- Execution environment/evidence: clean auth-service governance worktree; record
  UTC `observed_at`, reviewed base/spec/final-head commits, reviewer and Owner
  identities, lifecycle-only diff, verifier transcript, and merge ancestry.

## 10. Migration, compatibility, and rollback

Phase B migrates the preserved temporary ASM tombstone to permanent live version
2 without changing its composite key or credential. Phase C is additive and
inserts only the Scheduler version-1 row. Existing workflow/forum/other Grants,
Audiences, identities, and credentials are byte-equivalent throughout. Consumers
see no alias or wildcard compatibility surface.

Rollback is phase-local as frozen in `CTR-DAG-005`: B returns only to its exact
tombstone; C returns only to Scheduler absence and preserves B active. Audit rows
remain immutable evidence. Unknown state is manual recovery, not replay. A later
business revocation of either permanent permission is outside this Spec.

## 11. Alternatives

- One combined two-row transaction: rejected because it prevents Lane B from
  becoming production-ready before Lane C and couples their compensation.
- Delete/reinsert the ASM tombstone: rejected because it destroys history.
- Use `grant_change_audits`: rejected for these raw-SQL transitions because its
  version constraint cannot truthfully represent the version-0 restore face.
- Grant `scheduler.audit` or fleet/target access: rejected as unnecessary.

## 12. Open questions

```text
OPEN_OWNER_DECISIONS = EXACT_HEAD_ACCEPTANCE
NORMATIVE_TBD = NONE
ARTIFACT_STATE = NOT_BUILT
PRODUCTION_STATE = UNCHANGED
PHASE_B = NOT_STARTED
PHASE_C = NOT_STARTED
```

## 13. Authoring status

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = contracts (inactive until accepted and merged)
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
EXTERNAL_AUTHORITIES = dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_V1@d6c781696b1c30d482ac5d32023afe5edc7226a9; AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V2@e225d7b22e90d09f5658e267edb7c871c808434a; AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2@4c0a62382cabb9641dbf512a8d5f8ce8a9fed1f2
DOWNSTREAM_COORDINATION_GATE = resolve accepted merged dsh-agent-core AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1 by stable ID and match its exact accepted head to the FORWARD_ACTIVE receipt; no Auth-side SHA pin
OPEN_OWNER_DECISIONS = EXACT_HEAD_ACCEPTANCE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
AUTHORING_READY_FOR_REVIEW = YES
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
