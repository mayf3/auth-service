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
  - agent_session_send and cross-agent scheduler operational continuity
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1
  - AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V1
    revision: d6c781696b1c30d482ac5d32023afe5edc7226a9
    relation: constrained_by
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
    revision: 4c0a62382cabb9641dbf512a8d5f8ce8a9fed1f2
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1

> **PROPOSED / NON-AUTHORITATIVE.** This docs-only proposal creates no Grant
> and authorizes no production action until independent exact-head review,
> explicit Owner acceptance, lifecycle finalization, and merge to `main`.

## 1. Goal and exact subject

After the temporary A2A canary is terminally compensated and Scheduler Auth
1.7.0 is production-live, authorize exactly two permanent least-privilege
operational permissions for the already active source Agent:

```text
SOURCE_AGENT_ID = agt_efficiency-agent
SOURCE_PRINCIPAL_UUID = b21ddb23-42f6-47c4-a27f-bc44950e554c
SOURCE_CLIENT_ID = mc_cF81DF-XND9Zmzao4F08rOK_
SOURCE_CLIENT_UUID = 695d1eeb-3547-4cbd-a72b-915f4ebf25a4

GRANT_1 = agent-session-messaging / {agent.session.send} / permanent / version 2
GRANT_2 = scheduler / {scheduler.admin} / permanent / version 1
```

`scheduler.audit` is deliberately absent: daily autonomy requires cross-Agent
job definition/control, while global/foreign history read is not needed for the
bounded production proof.

## 2. Boundaries

The authority permits one serializable two-row transaction and exact readback.
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
SCHEDULER_AUTH_DEPLOYMENT = AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1 semantic head f1dcd4b672c89e42c802d5a1460a0f8ce1c6cde8 (must be accepted at this exact reviewed content, merged, final-head PASS, production PASS)
ASM_DEPLOYMENT = dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V2 semantic head e225d7b22e90d09f5658e267edb7c871c808434a (must be accepted at this exact reviewed content, merged, final-head PASS, Stage B/D/E PASS)
PRODUCTION_DB_ENDPOINT = 127.0.0.1:5432 / database agent_dev_center
AUTH_ORIGIN = http://127.0.0.1:4001
GLOBAL_MUTATION_LOCK = /var/run/auth-service-production-mutation.lock
CREDENTIAL_STORE = /usr/local/libexec/agent-core/config/agent-credentials.json
```

- `STATE-DAG-001` — Source identity is the active Agent/client tuple already
  used by the production workflow lane; no new credential is needed. Basis:
  `OBS-DAG-001`, `EVD-DAG-001`.
- `STATE-DAG-002` — Expected apply preimage is one preserved ASM temporary
  tombstone (`revoked_at` non-null, version 0, exact scope) plus no scheduler
  row for the source client. This is a future gated state, not claimed current.
  Basis: `OBS-DAG-002`, `CLM-DAG-001`, `EVD-DAG-002`.
- `STATE-DAG-003` — The two audience authorities register broader available
  scope sets, but least privilege requires one scope per permanent Grant.
  Basis: `OBS-DAG-003`, `EVD-DAG-003`.

## 4. Observations, claims, and evidence

### OBS-DAG-001 — Exact source client ownership

- Subject/revision/environment/time: auth production identity census bound to
  `github/main@ff9e1bec7d364568a92be91f6ffbd49d1d2101de`, production DB
  `127.0.0.1:5432/agent_dev_center`, observed `2026-09-03T16:34:41Z`
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

### CLM-DAG-001 — One permanent transaction can reuse the temp tombstone safely

- Support state: SUPPORTED
- Support: composite primary key forbids a second ASM row; exact reactivation of
  the preserved tombstone is narrower and more auditable than delete/reinsert
- Uncertainty: production raw column/type/preimage must be rechecked under lock.

- `EVD-DAG-001` — Source `OBS-DAG-001`; target `STATE-DAG-001`; relation
  SUPPORTS; exact client/principal coordinates; strong for identity, no secret
  material observed.
- `EVD-DAG-002` — Source `OBS-DAG-002`; target `CLM-DAG-001`; relation SUPPORTS;
  exact temp authority and DB primary-key shape; strong for transaction design,
  conditional on completed canary compensation.
- `EVD-DAG-003` — Source `OBS-DAG-003`; target `STATE-DAG-003`; relation
  SUPPORTS; exact accepted registry entries; strong for least-privilege scope
  selection, not downstream product conformance.

## 5. Decisions

### DEC-DAG-001 — One named operator Agent, two exact permissions

Select the existing `agt_efficiency-agent` client and no other subject. Reject
fleet, target-Agent, service/human/delegated, and new-credential alternatives.

### DEC-DAG-002 — Reactivate the ASM tombstone; insert Scheduler once

The ASM primary-key row is preserved by the temporary flow, so permanent
activation updates only that row to `revoked_at=NULL`, exact scope, version 2.
Scheduler has no preimage row and is inserted once with version 1. Reject
delete/reinsert of ASM and any upsert that hides drift.

### DEC-DAG-003 — Exclude scheduler.audit

Grant only `scheduler.admin`; reject the tempting two-scope superset. A future
global/foreign history requirement must establish separate evidence/authority.

## 6. Contracts

### CTR-DAG-001 — Hard prerequisites and fail-closed preimage

Apply MUST begin only after: (1) this Spec is accepted and merged; (2) Session
Messaging V2 deployment Stage B and its D/E canary are PASS; (3) the temporary
ASM Grant is terminally compensated with one preserved exact-scope row having
non-null `revoked_at`, version 0, zero live rows, and post-revoke issuance
non-200; (4) Scheduler auth deployment is PASS at its exact 1.7.0 source/digest;
and (5) the source Principal/Client and both Audiences are active/exact. Any
missing, duplicate, live, differently scoped, or differently versioned row
stops without mutation.
The two prerequisite authority bodies MUST be byte-equivalent to semantic heads
`e225d7b22e90d09f5658e267edb7c871c808434a` and
`f1dcd4b672c89e42c802d5a1460a0f8ce1c6cde8`; lifecycle commits may add only
their declared acceptance metadata. Any normative drift or unmerged/unaccepted
coordinate stops.
The same locked preflight MUST prove that production
`machine_access_grants.revoked_at` exists as nullable
`timestamp(3) without time zone`, that the table primary key remains exactly
`(machine_client_id, audience_id)`, and that the raw-SQL projection returns the
expected tombstone. Missing/drifted column type, nullability, precision, key, or
row projection stops before mutation; Prisma model shape is not evidence of
the production column.

### CTR-DAG-002 — Exact two-row serializable transaction

The sealed helper MUST acquire exactly
`/var/run/auth-service-production-mutation.lock` before its first preimage read
and hold it continuously through commit, token verification, compensation if
needed, and terminal receipt publication. Its owned participant set is closed
to the three transactions serialized by
`CORE_RUNTIME_DAILY_AUTONOMY_OVERNIGHT_V1`: the scheduler bundle deployment,
the accepted temporary ASM Grant apply/revoke vehicle at
`/Users/yanfenma/workspace/deployment-artifacts/agent-session-messaging-temp-grant-v1`,
and this permanent Grant transaction. The Goal coordinator wraps every
participant from first preimage read through terminal receipt and schedules no
overlap; this Spec does not claim to retrofit unrelated Auth writers.

Before mutation, Goal ledger, process census, participant receipt/marker census,
and native Owner attestation MUST prove that no other participant or Auth
production mutation is authorized, scheduled, active, or outcome-ambiguous in
the window. Any competing/unknown writer or unfinished receipt stops. An
isolated contention test MUST hold the lock in each of the three wrappers and
prove the other two reject before DB/file access. Database target identity is
exactly TCP
`127.0.0.1:5432`, database `agent_dev_center`; the secret-bearing connection
string is read only inside the root helper from the active auth snapshot's
root-readable `.env`, never accepted as an argument/environment override, and
never logged or persisted.

Under an explicit PostgreSQL `SERIALIZABLE` transaction, write-conflicting locks
on `auth_audiences`, `machine_access_grants`, and `auth_security_audits`, exact
row locks, and guarded row counts, the operator MUST:

1. update exactly the existing ASM tombstone identified by the composite key,
   setting only `scopes={agent.session.send}`, `version=2`,
   `revoked_at=NULL`, and `updated_at=now()`;
2. insert exactly one Scheduler row for the same client with
   `scopes={scheduler.admin}`, `version=1`;
3. append exactly two sanitized, correlation-bound audit rows identifying
   `grant.permanent_activated` and `grant.permanent_created`.

No upsert, wildcard predicate, DELETE, partial commit, or automatic retry after
an ambiguous outcome is allowed.

### CTR-DAG-003 — Least privilege and non-propagation

The final source-client rows MUST contain only the two exact permissions above.
All target agents MUST have zero rows for both audiences. `scheduler.audit`,
aliases, wildcards, local manage-any labels, human/service/delegated grants, and
credentials MUST remain absent. A granted source token or authority MUST never
be copied into a target Agent execution context.

### CTR-DAG-004 — Positive/negative verification

After commit, issue exactly one fresh token request for each exact Grant and
verify sanitized claims: subject/source principal, source agent ID, client ID,
audience, and exact single scope. Then use the same authenticated source client
to prove wrong scope, two-scope Scheduler request, alias, wildcard, and foreign-
audience requests fail. Prove target-client and service/human/delegated exclusion
by the exact census/profile methods below. Tokens and credentials MUST NOT be
persisted.
There is no operator-selected identity. The helper reads only
`agt_efficiency-agent` from
`/usr/local/libexec/agent-core/config/agent-credentials.json`, requires public
client ID `mc_cF81DF-XND9Zmzao4F08rOK_`, uses its secret only in process against
`http://127.0.0.1:4001/oauth/token`, redacts authorization and response bodies,
and zeroizes the binding after the bounded matrix. Missing, mismatched,
unsafe-mode, symlinked, or unreadable storage fails closed.
Only wrong-scope, two-scope Scheduler, alias, wildcard, and foreign-audience
token negatives use the exact source credential, so they discriminate scope or
audience denial after successful client authentication. Target-client denial is
proved by exact target Principal/Client plus zero-row censuses for both
audiences. Human/service/delegated denial is proved by the active Audience
profiles (`accepted_principal_types=[agent]`, human/delegated disabled) plus
complete Grant censuses; an unavailable or deliberately wrong credential MUST
NOT stand in for authorization denial.

### CTR-DAG-005 — Post-commit compensation

If verification fails after the DB commit, one pre-authorized compensation
transaction MUST restore the exact preimage: return the ASM row to its original
`revoked_at` timestamp, original `updated_at`, version 0, and exact scope;
delete only the newly created Scheduler row whose creation correlation matches
this transaction; append two
sanitized compensation audit rows; and prove zero live rows for both audiences.
An ambiguous transaction outcome MUST be read back before action and MUST NOT be
blindly replayed. Successful verification leaves both permanent rows live.
HUP/INT/TERM received after the first mutation MUST be recorded and deferred
until compensation and the terminal receipt finish; repeated signals cannot
abort or retarget compensation. The helper exits nonzero only after the exact
restored face is durably recorded.

The forward/compensation state machine is closed:

| Readback face | Permitted action/outcome |
|---|---|
| exact preimage, zero correlation audits | forward definitely not committed; stop unchanged, no retry |
| exact two-row target, exactly two forward correlation audits | forward committed; continue verification, never replay |
| any mixed/extra/missing forward face | no forward retry; run the single compensation only where exact correlation guards identify both target rows, otherwise `MANUAL_RECOVERY_REQUIRED` |
| exact restored preimage including original `updated_at`, scheduler absent, exact compensation audits | business rows restored; continue denial and residual-token quarantine |
| target/mixed/unknown face after compensation attempt | no compensation retry; `MANUAL_RECOVERY_REQUIRED` with durable nonterminal receipt |

After compensation, fresh issuance for both exact audiences MUST return non-200.
Every successfully issued proof token's `exp` is retained only as a sanitized
timestamp; downstream use is quarantined until the latest such `exp` (token TTL
is at most 600 seconds), and only then may the receipt become terminal
`RESTORED`. Before expiry the honest outcome is `RESIDUAL_AUTHORIZATION` and is
nonterminal; unknown expiry is `MANUAL_RECOVERY_REQUIRED`, never restored.

### CTR-DAG-006 — Native path, artifact, and durable receipt

The operator vehicle MUST be hash-sealed, secret-free, and invoked only through
an Owner-approved macOS native authorization dialog. It MUST pin script/source,
exact tuple, prerequisites, pre/post row projections, correlation, audit rows,
positive/negative results, unrelated-row digest, and terminal outcome in an
atomic root-owned receipt. No password fallback is allowed. A Gate, dialog,
row count, token, or receipt alone is not operational readiness.
Lock acquisition is bounded to 30 seconds, native authorization dialog to 120
seconds, DB lock/statement/whole-transaction time to 5/10/30 seconds, and the
complete token/readback matrix to 60 seconds with each request bounded to 5
seconds. Timeout before mutation exits unchanged; timeout after mutation enters
compensation. Timeout or ambiguous outcome is never success and is never a
reason for blind retry.
Immediately before issuing the first mutating SQL statement or attempt, the
helper MUST arm the post-mutation signal fence. Before that fence, HUP/INT/TERM
exits unchanged with a terminal `INTERRUPTED_PREMUTATION` receipt. From the
armed fence through the first attempt (including an in-flight or ambiguous
outcome) and until the state machine reaches a terminal receipt, all signals
are recorded/deferred; they cannot select a different transition, skip denial
or quarantine, or convert a nonterminal face to success.

### CTR-GDAG-001 — Lifecycle boundary

Review/acceptance may change only this Spec's lifecycle/provenance and README
row. No implementation, artifact, credential, DB, token, or production change
may occur before accepted exact-head merge and final-head recheck.

## 7. Acceptance

### ACC-DAG-001 — Preconditions and exact plan

- Contracts: `CTR-DAG-001`, `CTR-DAG-002`
- Method: sealed census/plan against fresh DB state under lock
- Pass: one exact ASM tombstone + scheduler absence; planned changes exactly one
  update, one insert, two audit rows; every prerequisite coordinate PASS
- Fail: live/duplicate/drifted row, missing proof, broader predicate/delta, or
  preflight mutation.
- Execution environment/evidence: production Mac sealed root helper targeting
  exact `127.0.0.1:5432/agent_dev_center`; record UTC `observed_at`, global-lock
  inode/owner, SERIALIZABLE settings, `information_schema` column/key result,
  complete sanitized source/audience/row projections, Goal ledger/process/
  participant-marker census, Owner no-concurrency attestation, three-wrapper
  contention transcript, exact table locks, and planned write counts.

### ACC-DAG-002 — Least privilege and tokens

- Contracts: `CTR-DAG-003`, `CTR-DAG-004`
- Method: exact row readback, target/fleet and principal-type profile census,
  two positive requests, and source-authenticated scope/audience negative matrix
- Pass: only two exact live rows for the source, exact single-scope claims,
  every source-authenticated negative denied, target rows absent, human/service/
  delegated profiles and Grant censuses exclude access, no persisted token
- Fail: extra scope/subject/row, token leakage, privilege propagation, or any
  negative issuance.
- Execution environment/evidence: production Mac against exact
  `http://127.0.0.1:4001/oauth/token` using the frozen root-only credential-store
  entry; record UTC `observed_at`, request count/result classes, sanitized claim
  hashes, final row projections, target/fleet zero counts, and unrelated digest.

### ACC-DAG-003 — Compensation and receipt

- Contracts: `CTR-DAG-005`, `CTR-DAG-006`
- Method: isolated failure injection at every transaction/verification boundary;
  production compensation only after real authorized failure
- Pass: pre-commit failure changes nothing; post-commit failure restores exact
  ASM tombstone including original `updated_at` plus Scheduler absence; fresh
  issuance is denied and residual-token quarantine expires before `RESTORED`;
  success emits one durable exact receipt
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

## 8. Authoring status

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = contracts (inactive until accepted and merged)
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
EXTERNAL_AUTHORITIES = dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_V1@d6c781696b1c30d482ac5d32023afe5edc7226a9; AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2@4c0a62382cabb9641dbf512a8d5f8ce8a9fed1f2
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 7
CONTRACTS_WITH_ACCEPTANCE = 7
AUTHORING_READY_FOR_REVIEW = YES
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
