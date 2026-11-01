---
spec_id: MACHINE_GRANT_SUPPLY_NOTIFICATION_DELIVER_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/auth-service bounded existing backend machine Grant repair
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
acceptance: PENDING_OWNER_EXACT_HEAD_ACCEPTANCE
ACCEPTANCE: PENDING_OWNER_EXACT_HEAD_ACCEPTANCE
---

# MACHINE_GRANT_SUPPLY_NOTIFICATION_DELIVER_V1

This is a **docs-only proposed acceptance carrier** for D8 / [agent-control#1343](https://github.com/mayf3/agent-control/issues/1343).
It is not an Execution Mandate. Proposal, review, commit, push, PR, acceptance,
and merge perform no Grant apply or other production operation.

## 1. Goal, authorization and route

Supply one missing durable, audience-paired Grant for the existing backend
service identified in the transmitted Owner demand as `svc-workflow-backend-v1`.
Preserve the issuer's existing fail-closed checks and all unrelated identities,
credentials, Grants, source implementations and delivered evidence.

The present user explicitly authorized task B: author this separate Spec,
independent affected-scope review, a separate commit/push, an open PR to `main`,
and a comment on #1343. Acceptance, merge, implementation and production
execution are excluded. The requested checkout `/tmp/auth-94-impl` contained
seven untracked `docs/audits/auth94/final-*` evidence files; they remain there
untouched on `ac-d8-supply-script`. The coordinator explicitly approved the
equivalent isolated write surface `/tmp/auth-d8-grant-repair-spec`, branch
`ac-d8-grant-repair-spec`, from the exact clean `main` below.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
GOAL_OR_TARGET = bounded backend notification.deliver Grant repair authority
CURRENT_GAP = no accepted-in-base authority for this exact backend repair
AUTHORITY_ACTION = NEW
AUTHORITY_OWNERSHIP = mayf3/auth-service
PRIMARY_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2 + notification Audience CCR V1
BASE_HEAD = 0227f9d6b16dbc306c5fd0a7c1edc95cf5a77c15
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this new Spec)
DOCS_FIRST_REQUIRED = YES
SPEC_GAP_DEPENDENCY = LOAD_BEARING
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
ACCEPTANCE = PENDING_OWNER_EXACT_HEAD_ACCEPTANCE
EVIDENCE_NEEDED = source attribution + independent exact-candidate review
DONE_WHEN = reviewed proposed Spec + open PR + #1343 readback; STOP
EXPANSION_TRIGGER = authority conflict requiring accepted-meaning change,
  identity substitution, implementation, production access or operation
NEXT_REAL_ACTION = independent REVIEW; preserve pending Owner acceptance
```

`implementation_authority: contracts` describes the intended future effect
only after exact-head Owner acceptance and merge into the implementation base.
It does not activate implementation on this proposed branch. A later source
task must re-PREFLIGHT against the then-current accepted authorities.

## 2. Scope and authority relationships

The sole proposed data target is:

```text
logical service named by Owner = svc-workflow-backend-v1
machinePrincipalId = exact server-owned principal ID proven for that service
machine client = its one explicitly bound existing active MachineClient
audience = agent-core-notification-ingress-v1
scopes = [notification.deliver]
```

This is not fleet entitlement, a new provisioning lifecycle, new identity
enrollment, new credential supply, or a repair of the token issuer. The parent
Audience's registered Scope, service-only profile, direct-machine model and
strict denial semantics remain authoritative. The V2-incorporated
`grants-and-audiences.md` §§5/9 require paired Grants, a versioned artifact,
fixed Git SHA, optimistic concurrency and same-transaction durable audit.

At `BASE_HEAD`, the directly affected accepted texts have these precise limits:

| Accepted authority | Boundary that must remain unchanged | Disposition here |
|---|---|---|
| `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1`, §2 and CTR-NI-004 | Names `svc-forum` and `svc-workflow` as the two allowed callers; requires independent service Clients/Grants | No source establishes that the new backend label is the same caller or Client. Owner must explicitly resolve this relationship before accepting this child as compatible. |
| `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1`, §9 and CTR-NSC-001/002/004/006 | Dedicated workflow principal external ref `service:v1:principal:svc-workflow`, Client external ref `service:v1:client:svc-workflow:agent-core-notification-ingress-v1`, public Client ID `mc_uYu1fDfNHjzUlRQGJdTajz9n`; two-client, three-file supply operation | RETAIN that distinct operation and its exact identities/closure. This proposal neither substitutes backend into those stable IDs nor reuses their implementation permission. |
| Audience CTR-NI-005 and V2-incorporated Grant grammar §9 | Versioned fixed-SHA writes with approval metadata, CAS and same-transaction audit | RETAIN. A stdout `[AUDIT]` line alone is insufficient. |
| `AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1` | Canonical Agent fleet, `agent.session.send`, its own controlled execution boundary | RETAIN. Reuse technique only; no service notification authorization inferred. |
| `EXECUTION_HISTORY_AUTH_CONTRACT_V1` | Named-client Owner instruction applies to `execution.history.audit` | RETAIN. Its provision/revoke pattern cannot grant `notification.deliver`. |

The first row is a concrete unresolved **authority relationship**, not proof
that backend and dedicated Client are equivalent. This proposal cannot expand
or reinterpret the accepted two-caller meaning. If Owner's resolution requires
changing that accepted meaning, stop this `NEW` child route and re-PREFLIGHT a
docs-first whole-authority successor with atomic backlinks; do not silently
amend the old stable IDs. Existing accepted files are byte-preserved here.

## 3. Current state, observations and evidence

### OBS-NDG-001 — Transmitted Owner demand and reported failure

Directly inspected on 2026-11-01: `/tmp/dispatch-D8-supply.md:11`, SHA-256
`e5a16a45d9cda57bb99cd5202cf185d23149ceb2b83fd797ebf5a0354d0fb04f`,
quotes breakthrough-document repair requirement 3 as:

> 允许 svc-workflow-backend-v1（principal_type=service）获取 notification.deliver scope

This is an attributable coordinator-transmitted Owner-demand quotation. The
original breakthrough document's path, revision and exact bytes were **not
supplied / UNKNOWN**. This Spec does not claim direct inspection of that
original. The present user independently authorized the bounded docs-only
proposal and GitHub handoff; neither source is accepted Product Authority.

The dispatch background and [the D8 PREFLIGHT stop receipt](https://github.com/mayf3/agent-control/issues/1343#issuecomment-6551139888)
report `machine_grant_missing` for this resource/scope. That is a coordinator
report, not this Author's production-log observation. Production log time,
line, hash, loaded revision/mode and current Grant state are UNKNOWN here.

### OBS-NDG-002 — Existing source investigation and stopped implementation

[auth-service#97](https://github.com/mayf3/auth-service/pull/97), evidence-only
head `f0df40b8729367aceb9e46b7ccf603222981c37f`, records 11/11 synthetic
diagnostics against unchanged `BASE_HEAD`. Correct durable service Grant
already permits mint; missing Grant produces `machine_grant_missing`.
[Its investigation](https://github.com/mayf3/auth-service/blob/f0df40b8729367aceb9e46b7ccf603222981c37f/docs/audits/auth-d8/INVESTIGATION.md)
has SHA-256 `33cb0581f19d82a9ad42547e5b0f7214a3716909e12b39cecd5d6c89e4e25944`.
That earlier record correctly kept production root cause UNKNOWN at its own
coordinates; the later transmitted diagnosis does not rewrite its bytes.

The later supply-script stop receipt binds unchanged main/HEAD
`0227f9d6b16dbc306c5fd0a7c1edc95cf5a77c15`, branch `ac-d8-supply-script`,
and `NEW + BRIEF + CONTROLLED`, implementation/operation forbidden until new
authority. There is no new executable supply script, accepted repair or
production canary in that receipt. This is the Auth D8 prior-review/stop
evidence; no D14 r2 material is treated as an Auth observation.

### STATE-NDG-001, CLM-NDG-001 and EVD-NDG-001

- State as of `BASE_HEAD`, 2026-11-01, source-only environment: no accepted
  exact backend repair authority or verified current public binding is shown.
- Claim: a bounded docs-first authority proposal is required. Support state:
  SUPPORTED by OBS-NDG-001/002 and the accepted limits in §2.
- Evidence relation: those named observations SUPPORT this source-authority
  gap at their exact coordinates. Sufficiency: proposal routing only.
  Limitations: no direct production diagnosis, identity proof, apply permission
  or business completion; provenance is the linked issue records and quoted
  local dispatch, not new runtime execution.

## 4. Proposed Decisions

All `DEC-NDG-*` and `CTR-NDG-*` below are proposed and inactive.

- **DEC-NDG-001:** Repair only the one existing Owner-named backend binding;
  resolve public principal/client coordinates explicitly, never by guessing.
- **DEC-NDG-002:** Use one versioned Grant-only supply vehicle with DRY_RUN
  default, a bounded target-row upsert, CAS, durable audit and rerun
  convergence. Reject conflicting state rather than normalize unrelated data.
- **DEC-NDG-003:** Owner on the authsvc host is the future execution actor.
  Source acceptance and each production operation remain separate decisions.

## 5. Proposed Contracts

### CTR-NDG-001 — Exact attributable identity binding

Before a future apply, an attributable Owner binding MUST name this logical
service and exact existing public `machinePrincipalId`, MachineClient database
ID and `clientId`. It MUST prove the server-owned client-to-principal relation.
No UUID, Client ID, external ref, display-name equivalence, prefix/substring
mapping, `findFirst` selection or secret-derived identity may be invented.
The old dedicated workflow Client ID is not a fallback. This Spec intentionally
does not assert an unobserved production identifier.

Exactly one bound target is permitted. Zero matching rows, duplicates,
ambiguous active Clients, a substituted Client, or a binding that cannot be
proved from fresh authorized records MUST yield a stable refusal, writes zero,
and no fallback to another Client. A new or changed binding needs a fresh
Owner instruction; it cannot be learned from a failed apply.

### CTR-NDG-002 — Fresh service, Client and Audience gates

DRY_RUN, apply, rerun and readback MUST freshly establish that the exact bound
principal exists with `principal_type='service'` and `status='active'`, its
exact Client exists and is `active`, and their server-owned binding matches.
The registered/runtime and stored Audience projection MUST match accepted
CTR-NI-001, including only `notification.deliver` and service-only access.
Absent, disabled, revoked, wrong-type, ambiguous or mismatched state MUST fail
closed before mutation. An old audit receipt never bypasses these gates.

### CTR-NDG-003 — DRY_RUN default and exact plan

No arguments and an explicit dry-run mode MUST be read-only DRY_RUN: zero DB
or filesystem writes, no token request, no secret generation. A secret-free
canonical plan MUST bind the accepted Spec revision, clean implementation
40-hex Git SHA, host/database identity, exact public target binding, Audience
projection, current Grant/version or absence, proposed action, non-target
state digest, operation identity and SHA-256 plan digest.
`--apply` MUST require the exact separately approved plan and production
mandate; missing, stale or mismatched inputs refuse before the first write.

### CTR-NDG-004 — Bounded idempotent upsert; zero DELETE

Only the `(bound MachineClient, agent-core-notification-ingress-v1)`
MachineAccessGrant may be created or confirmed. Its sole Scope is exactly
`['notification.deliver']`; no other principal/client/audience is selectable.
The allowed state machine is:

| Fresh state | Result |
|---|---|
| Target Grant absent; all gates/mandate pass | CREATE one row at version 1 plus its transactional audit |
| Exact singleton Scope, positive version, lawful audit lineage and matching public binding | NOOP; preserve row/version/audits byte-for-byte |
| Empty/extra/wrong Scope, unexpected version, conflicting audit or any partial/drifted state | CONFLICT; zero writes |

This bounded idempotent upsert is CREATE when absent and NOOP when exact.
The existing SQL `machine_access_grants_scopes_check` requires
`cardinality(scopes)>0` (`20260718000100_minimal_auth_v1_additive/migration.sql:100`),
and the accepted Audience registers only `notification.deliver`. Therefore
every lawful existing target already has exactly that singleton Scope; there
is no lawful missing-Scope existing state requiring UPDATE. An empty row
would prove schema/state drift, and other Scopes would violate the accepted
registry. Repair of those states requires re-PREFLIGHT, not normalization,
union, downscoping or replacement here. DELETE count MUST be zero everywhere.
No Principal, Client, credential, legacy `allowedResources`/`allowedScopes`,
Audience, Human/Delegation Grant or non-target MachineAccessGrant may change.

### CTR-NDG-005 — CAS, transaction and concurrency

Apply MUST re-read the complete plan preconditions in a serializable DB
transaction and guard absence/expected Grant version using CAS and the
existing uniqueness boundary. A stale plan/version or changed preimage rolls
back all writes. Concurrent identical authorized attempts MUST converge to
one valid Grant and one mutation audit; a losing attempt may confirm the
winner only after fresh gates, matching binding/state and audit verification.
Never use last-write-wins or silently retry an ambiguous commit.

### CTR-NDG-006 — Durable audit in the same DB transaction

Every actual Grant mutation MUST insert exactly one immutable
`grant_change_audits` row **in the same DB transaction**. Audit failure MUST
roll back the Grant. A stdout `[AUDIT]` JSON receipt may additionally describe
the committed mutation, but cannot replace durable database audit or precede
commit as proof of success.

Use the existing closed 13-field envelope, without schema changes:
`migration_id`, `source_git_commit`, `operator_id`, `approval_ref`, `reason`,
`client_id`, `change_type`, `expected_grant_version`,
`resulting_grant_version`, `before_value`, `after_value`, `timestamp`,
`change_id`. The versioned migration identity is
`notification-deliver-grant-supply-v1`; source is the exact reviewed clean
implementation SHA; operator is the separately authorized Owner; approval
references that exact apply mandate; reason binds the approved plan digest.
CREATE uses `change_type=create`, SQL NULL expected version and before value,
resulting version `1`, and a fresh change UUID. This preserves the existing DB CHECK in
`prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql:388–390`
(expected is NULL or positive; resulting is positive), without DDL changes.
The complete safe before/after Grant snapshots and
public Client ID MUST describe only the approved change and preserve all
other Grants. Reused migration/audit identity with a different target,
source, approval or preimage is conflict, never replay permission.

### CTR-NDG-007 — Rerun and unknown-outcome reconciliation

An exact successful rerun MUST create no row/audit and increment no version.
Historical evidence is retained; no audit row may be updated or deleted.
A timeout, connection loss or unknown commit result MUST stop automatic
mutation retry. A separately authorized readback must reconcile the exact
operation identity against current target and durable audit. Missing,
inaccessible or inconsistent evidence remains UNKNOWN/CONFLICT. Even a
matching old receipt cannot declare current convergence after revocation,
binding change, inactive state or new drift. A new write needs fresh plan and
explicit authorization; no automatic compensating DELETE or revocation.

### CTR-NDG-008 — Invariance and secret-safe evidence

All non-target Grants and all Principal/Client/Audience/credential records
MUST remain unchanged, checked by safe before/after snapshots/digests in the
authorized environment. No secret, hash credential material, raw token,
Authorization header, connection string or raw sensitive DB diagnostics may
enter stdout, artifacts or audit JSON. Use public IDs and closed sanitized
failure categories; never read credential values to prove target identity.

### CTR-NDG-009 — Owner execution and split completion gates

The future actor is **Owner acting on the authsvc host**. Spec acceptance or
source merge MUST NOT grant production access or imply apply permission.
A later controlled mandate/runbook MUST bind exact accepted Spec and reviewed
implementation SHA, host/database, public target, operation/plan digest,
operator, approval, execution window/attempt bound, aborts, secret handling,
receipts and independent post-state verification.
Owner executes DRY_RUN, checks the exact target/plan, separately authorizes
apply, then obtains fresh Grant/audit readback. Real mint and deliver canaries
are separately authorized functional actions. Grant convergence, mint success,
`POST /v1/deliver` success and business outcome are distinct claims;
D8 remains OPEN until its separately required mint/deliver evidence exists.

### CTR-NDG-010 — Source closure and accepted-meaning stop boundary

After this Spec is lawfully accepted in base, a separately routed source PR
may implement only `scripts/supply-notification-deliver-v1.ts`,
`tests/oauth/supply-notification-deliver-v1.test.ts`, and
`scripts/run-notification-deliver-v1-conformance.sh`. No issuer/deny change,
schema/migration DDL, new management API, dependency, deployment, existing
vehicle or evidence rewrite is authorized. Necessary scope expansion or
changed accepted meaning requires re-PREFLIGHT before implementation.
The present PR adds this Spec only and provides no executable apply command.

## 6. Acceptance definitions — future execution, not current PASS

All execution below is pending. Each future result MUST bind accepted Spec
revision, implementation SHA, environment, evaluation time, inputs and raw
sanitized evidence. Independent semantic review of this proposal is separate
from implementation conformance and Owner acceptance.

| ID / Contracts | Method and environment | Required evidence / expected result | Failure condition |
|---|---|---|---|
| ACC-NDG-001 / 001,002 | Isolated synthetic DB; valid bound active service/client and registered Audience; vary missing/duplicate IDs, extra active client, wrong type/status/binding and registry | Public binding plus named positive/negative results; exactly one target, all invalid gates refuse with zero writes | Guessed/substituted identity, stale gate or any invalid case writes |
| ACC-NDG-002 / 003,008 | Invoke default/explicit DRY_RUN in isolated DB; compare all tables and filesystem before/after | Exact secret-free plan/digest; zero writes/token requests/secret reads; stale/wrong apply inputs refuse | Any side effect or plan fails to bind complete target/preimage |
| ACC-NDG-003 / 004,006,008 | Missing target, non-target rows present; apply approved synthetic plan and read back DB | One exact version-1 Grant with SQL NULL expected/before audit, committed atomically; non-target hashes unchanged; DELETE=0; existing exact target is NOOP, invalid empty/extra Scope is CONFLICT (empty simulated only in a schema-drift fixture) | Extra Scope/row mutation, expected version 0, stdout-only audit, missing metadata or bypass of normal SQL constraints to claim lawful empty state |
| ACC-NDG-004 / 004,005,006 | Real disposable PostgreSQL; inject audit insert failure and preimage/CAS drift | Transaction rollback leaves Grant/audit/non-target state unchanged; stable refusal | Partial commit, last-write-wins or audit failure leaves Grant |
| ACC-NDG-005 / 004,005,007 | Real disposable PostgreSQL; exact repeated and concurrent authorized calls | One Grant, one mutation audit, no gratuitous version growth; repeat NOOP after fresh gates | Duplicate row/audit, swallowed conflict or version growth |
| ACC-NDG-006 / 002,007 | Simulate unknown commit, then matching/missing/mismatched readback and later revoke/disable/rebind | No automatic retry; exact reconciliation only; stale receipt never bypasses current state | Blind replay/apply or false current PASS from old audit |
| ACC-NDG-007 / 008,010 | Source diff/AST or equivalent focused audit; execute secret-sentinel failure cases | Only three allowed source paths, zero issuer/schema/API changes, no forbidden reads/log values/DELETE | Changed existing evidence, expanded files/authority, secret leak or DELETE |
| ACC-NDG-008 / 009,010 | Independent review of exact candidate/base and future controlled production handoff | Acceptance pending until Owner exact-head decision; current source-only status; future mandate/readbacks and separately authorized mint/deliver receipts distinguished | Spec/review/PR called execution permission or D8 completion |

Coverage: CTR-NDG-001→ACC-001; 002→001/006; 003→002;
004→003/004/005; 005→004/005; 006→003/004; 007→005/006;
008→002/003/007; 009→008; 010→007/008. All 10 Contracts have Acceptance.

## 7. Compatibility, rollback and remaining acceptance boundary

RETAIN the dedicated notification credential flow, other Grant vehicles and
all evidence. Different names are not proof of duplicate responsibility; no
identity migration, alias, bridge, retirement or replacement is declared.
This vehicle owns no legacy-field cleanup. All issuance/profile/scope checks
remain unchanged. Forward repair only; rollback that narrows/revokes a Grant
requires a new separately authorized, audited forward operation, never an
unaudited manual edit or restored older permission snapshot.

```text
STATUS = proposed
ACCEPTANCE = PENDING_OWNER_EXACT_HEAD_ACCEPTANCE
OPEN_OWNER_DECISIONS = exact backend public binding and explicit disposition
  of the Audience CCR two-caller relationship before acceptance
ORIGINAL_BREAKTHROUGH_DOCUMENT_COORDINATE = NOT_SUPPLIED / UNKNOWN
NORMATIVE_TBD = NONE (fresh exact-binding proof is a defined gate)
UNRESOLVED_AUTHORITY_RELATIONSHIP = §2 first row; no implicit equivalence
PARTIAL_SUPERSESSION = NONE (none attempted or authorized)
AUTHORING_READY_FOR_REVIEW = YES (pending proposal and disclosed limits)
READY_TO_MARK_ACCEPTED = NO
IMPLEMENTATION_CONFORMANCE = NOT_EXECUTED
PRODUCTION_READ_APPLY_DEPLOY_RESTART = NOT_EXECUTED
MINT_DELIVER_CANARY = NOT_EXECUTED
NEXT_ACTION = independent exact-candidate REVIEW; Owner resolves relationship
  and accepts exact final head only in a later authorized transaction
```
