---
spec_id: AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-05
scope:
  - mayf3/auth-service
  - one operational agent.session.send grant for exact HR Principal
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V1
    revision: 1912d582888455a049838f376759b62f295b341b
    relation: constrained_by
supersedes: [AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1]
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2

## 1. Goal

Enable the formal HR business orchestration Principal
`dc702687-6515-4a2a-91ae-e572a9bbd766` to send task messages through the
existing Agent Core `agent_session_send` capability. This authority owns only
HR's minimal Auth Grant supply, not the whole Workflow autonomous loop.

## 2. Scope and non-goals

One existing active MachineClient of that exact Principal receives one
`agent-session-messaging` audience Grant with exactly `[agent.session.send]`.
No Principal, Client, credential, Audience, registry, Broker, Router, Scheduler,
workflow role or lifecycle change is authorized. No fleet migration, dispatcher,
`agent_wake`, scheduler scope, target ACL language, identity impersonation,
source credential propagation or generic administration is introduced.

## 3. Authority and dependencies

Parent Auth authorities are read at integration base
`ae6da9a8b754be16c35553f0dff1d8e36194d88f`.
`AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1` at that base freezes
only efficiency Principal `b21ddb23-42f6-47c4-a27f-bc44950e554c` and its client;
its prohibition on granting other clients applies to that operation. This new
independent HR operation does not change or supersede that authority. Its
transaction and secret-handling patterns are informative; no efficiency or
scheduler Grant is copied.

```text
EXECUTION_MANDATE_SOURCE = HR_DISPATCH_DELIVERY_READINESS_V1 user attachment (2026-09-05)
MANDATE_THIS_STAGE = isolated docs-only candidate and independent review
AUTHORITY_ACTION = NEW
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

After independent exact-head PASS, authorized Owner acceptance and merge, the
acceptance transaction may set `implementation_authority: contracts` without
changing this normative body. Production remains separately gated by a valid
controlled mandate and runbook. The Goal's automatic release of the shared
production slot requires fresh `VISIT_ACTIVATION_PRODUCTION_READY=YES`,
`DISPATCH_INTENT_BROKER_PRODUCTION_READY=YES` and runtime lock `IDLE`; none is
asserted by this candidate. Native privileged authorization remains required
where the execution actor cannot access the protected runtime.

## 4. Current State

STATE-HR-001: On 2026-09-05 at Auth base above, existing accepted send-supply
Authority does not name the HR Principal. Basis: OBS-HR-001 / CLM-HR-001.
HR's reported `access_denied` is imported from the Goal attachment, not a newly
executed token or delivery test. Fresh HR DB Grant state and exact active
MachineClient UUID are unverified. Production readiness is NOT established.

## 5. Observations

OBS-HR-001: Repository read at Auth base above on 2026-09-05 found accepted
operational-send Spec sections 1 and 5 freezing efficiency's sole client and
prohibiting additional clients within its operation. The accepted audience
CCR registers only `agent.session.send` for `agent-session-messaging`.

OBS-HR-002: On the same date, a local read of production snapshot
`production-auth-service-57258ec33700af8057ab2ed63fd8e52b3225e749` source
`src/lib/oauth/v1/direct.ts:112` found absent audience Grant rejected as
`invalid_scope / machine_grant_missing`; line 125 rejects ungranted requested
scope. Broker gateway translates token-acquisition failures to `access_denied`
before dispatch. This is code-path evidence, not proof which branch HR hit.

OBS-HR-003: Production `.env` and Broker credential store are owned by authsvc
with mode 0600. The current nonprivileged actor could not execute
`sudo -n -u authsvc /usr/bin/true` (password required). No password was requested,
no credential value was read, and no production mutation or send was performed.

## 6. Claims and assumptions

CLM-HR-001 (SUPPORTED): HR's additional Grant requires this independent
bounded authority; the efficiency-only grant does not authorize the HR tuple.
CLM-HR-002 (OPEN_ASSUMPTION, non-authorizing): HR likely lacks its audience
Grant. A credential, audience or registry failure can produce the same Broker
error. CTR-HRG-001 requires distinguishing these before any apply; the operation
MUST NOT repair credentials or registry to make this assumption true.

## 7. Evidence relations

EVD-HR-001: OBS-HR-001 SUPPORTS CLM-HR-001 at Auth base above, read 2026-09-05;
provenance = exact committed Spec sections 1 and 5. Sufficient for authority
scope, not live Grant state.
EVD-HR-002: OBS-HR-002 and OBS-HR-003 SUPPORT the uncertainty of CLM-HR-002;
provenance = named snapshot source and local permission probe. Insufficient to
assert a live missing Grant or exact active client. Controlled fresh census is
required; no evidence exception is granted.

## 8. Decisions

DEC-HR-001 (Owner acceptance required): The exact existing HR Principal receives
capability-level operational send authority. The selected client MUST be the
unique active client mechanically bound to that Principal and to production
Broker caller `agt_hr-agent`. No name similarity, legacy `bc970ced-710f-4479-9ff0-e295a1c59424` (`hr-agent`)
substitution, new client, rebind, or Owner selection among multiple clients is
permitted.

DEC-HR-002: Reuse the current send audience and semantics. This is a permanent
operational Grant with an explicit failed-activation rollback, not a second
temporary canary Grant. No per-target authorization extension is introduced.

## 9. Contracts

### CTR-HRG-001 — Exact identity and preimage

Before preparing an apply transaction, the operator MUST perform read-only live
census in the actual production Auth database and Broker credential binding.
The Principal UUID MUST be exactly `dc702687-6515-4a2a-91ae-e572a9bbd766`,
principal_type `agent`, status active, disabled_at null, canonical agent_id
`agt_hr-agent`. The legacy Principal `bc970ced-710f-4479-9ff0-e295a1c59424`
(`hr-agent`) MUST NOT be the subject of this operation and MUST NOT receive
this Grant; its pre-existing provisioning/admin authorization is out of
scope and unchanged. Exactly one active client MUST exist for this Principal; its ID and
UUID MUST match the credential entry used by actual Broker caller `agt_hr-agent`.
The census MUST bind those exact nonsecret IDs, audience row/version/registered
scope, complete target Grant preimage and unrelated Grant digest to the reviewed
runbook and a nonce. No credential value enters the runbook or evidence.
Missing, ambiguous, disabled, mismatched identity or inactive/drifted audience
MUST abort without mutation. A different caller/client, credential failure,
unregistered audience or missing runtime implementation MUST be diagnosed and
reported separately; this operation cannot repair them.

### CTR-HRG-002 — Minimal Grant and conflicts

The only allowed permission delta is the selected client's single row
`(machine_client_id, agent-session-messaging)` with exactly
`scopes=[agent.session.send]`, `version=1`, `revoked_at=NULL`.
An absent row MAY be created. An exact tombstone with version 0, nonnull
revoked_at and that exact scope MAY be reactivated. An already-live exact row
MUST return verified NOOP without write or a second creation audit. Any other
row, scopes, version or concurrent drift MUST fail closed; no overwrite, union,
DELETE or broad upsert is permitted. Existing permissions on every other row,
including HR Workflow grants and efficiency's send/scheduler grants, MUST remain
byte-equivalent in stable semantic projection.

### CTR-HRG-003 — Atomic guarded mutation and receipt

Apply MUST hold the single production mutation slot and use a serializable
transaction. Inside that transaction it MUST fresh-read/lock the bound identity,
audience and exact Grant, validate CTR-HRG-001 and the expected preimage, then
create/reactivate only via compare-and-set. A nonce-unique auth_security_audits
entry MUST commit in the same transaction with closed details: migration_id,
operator, approval_ref, reason, Principal UUID, client UUID/client_id, canonical agent_id,
audience, exact scopes, old/new version, preimage digest, created/reactivated.
The apply audit and fixed-SHA migration envelope MUST include the bounded
nonsecret reason `HR_WORKFLOW_ORCHESTRATION_AGENT_SESSION_SEND_ACTIVATION`.
No secret or token is permitted. Failure before commit MUST leave both Grant
and audit unchanged. Unknown commit outcome MUST stop automatic apply/retry;
a new read-only census may classify nonce receipt and row state before any
separately authorized recovery. Receipt MUST bind source/authority/runbook hashes,
UTC time, environment, pre/post digests, audit ID, outcome and rollback status.

### CTR-HRG-004 — Post-state proof and forbidden expansion

Post-commit readback MUST prove exact row plus unchanged unrelated Grant digest
and healthy Auth/runtime. Using the existing HR credential only in memory, token
proof MUST verify success for resource `agent-session-messaging`, exact scope,
sub=HR UUID, principal_type=agent, agent_id=agt_hr-agent and exact bound client_id.
Wrong scope/alias/wildcard and one verified ungranted client MUST fail without
token. This grant MUST cause no scheduler.admin, scheduler mutation, agent-wake,
Agent administration, source credential propagation or target Grant. Tests MUST
compare permission delta, rather than assume a forbidden pre-existing grant is
absent. Any existing unrelated unsafe permission is recorded and not silently
changed. Negative token probes may produce ordinary security audit records;
all such records are nonsecret and correlated, never counted as message delivery.

### CTR-HRG-005 — Failure rollback

On known post-apply verification failure, a bound rollback operation MUST act
only if the current row exactly matches this transaction's postimage and nonce
receipt. It MUST tombstone that row (`version=0`, revoked_at set), preserving its
scope and identity; it MUST NOT delete a row or affect unrelated grants. Rollback
and a correlated closed-envelope audit MUST be atomic. That audit and the
rollback migration envelope MUST include the bounded nonsecret reason
`HR_AGENT_SESSION_SEND_FAILED_ACTIVATION_ROLLBACK`. Readback and a negative HR
send-token proof MUST follow. This restores pre-existing absence of effective
send permission while retaining audit/tombstone history, not byte-for-byte row
absence. Drift or unknown outcome MUST stop and report recovery required; no
blind rollback, retry or further canary. Accepted existing live exact NOOP rows
MUST NOT be revoked by this operation. Normal future revocation/rotation beyond
failed activation needs a separate mandate under applicable authority.

### CTR-HRG-006 — Delivery proof dependency and stop

Only after CTR-HRG-001–005 conformance, Lane B canonical Principal-to-enabled-
Agent resolution production readiness and shared slot release may Lane C run
ONE harmless disposable HR canary through the real `agent_session_send` seam.
The mechanically resolved target MUST be enabled and explicitly suitable for
the canary. Payload MUST contain no private data/credential, request no reply
loop, create no Scheduler job, and trigger no Workflow transition. Receipt MUST
bind exact HR/target Principal and agent IDs, request/correlation identity,
accepted/replied result, canonical target main, delivery_count=1 and target
run_count=1. Unknown delivery outcome MUST NOT be resent. Stop this authority's
work when Grant conformance and that Goal's composed delivery proof pass; the
full autonomous Workflow loop remains a separate Goal.

## 10. Acceptance

Each mapping requires exact candidate/authority/source hashes and UTC timestamp.
A proposed candidate may be semantically reviewed; runtime conformance remains
NOT_EXECUTED until lawful production execution.

| ID | Contracts | Method / environment | Required evidence / expected result | Failure condition |
|---|---|---|---|---|
| ACC-HRG-001 | CTR-HRG-001 | Fixture census cases, then production read-only | Exact UUID/client binding receipt; wrong type, disabled, duplicate/missing client, caller mismatch and audience drift abort | Any ambiguous or changed identity accepted; unavailable live evidence asserted PASS |
| ACC-HRG-002 | CTR-HRG-002 | Isolated disposable DB for absent/tombstone/exact-live/conflict cases | Create/reactivate exact one row; live NOOP; all conflict families denied; unchanged unrelated semantic digest | Scope union, overwrite, second-client write or replay audit |
| ACC-HRG-003 | CTR-HRG-003 | Isolated DB injected precommit/audit failure/concurrent drift/commit-unknown, then controlled production | Atomic audit+row; fresh locked preimage; unknown stops; durable exact receipt | Partial commit, blind retry, missing attribution/reason in audit or migration envelope, or slot violation |
| ACC-HRG-004 | CTR-HRG-004 | Local positive/negative issuer conformance, then protected production token proof | Exact HR claims digest only, forbidden aliases denied, ungranted client denied, health and unrelated grant digest PASS | Leaked secret/token, privilege expansion, wrong Principal or missing negative |
| ACC-HRG-005 | CTR-HRG-005 | Isolated created/reactivated rollback, drift and NOOP cases; production only on failure | Safe tombstone + atomic audit and denial; drift stops; NOOP untouched | Deletion, unrelated mutation, live-token-after-rollback, blind recovery, or missing reason in audit or migration envelope |
| ACC-HRG-006 | CTR-HRG-006 | Production after A+B readiness, one controlled canary | Target suitability and canonical resolution; one delivery/run and no unrelated workflow/scheduler effect | Premature send, duplicate/unknown replay, wrong session or credential propagation |

## 11. Alternatives and disposition

ALT-HR-001: Reuse efficiency's accepted tuple for HR — rejected; a different
Principal is not mechanically entailed by its frozen authority.
ALT-HR-002: Copy efficiency scheduler Grant or restore agent_wake — rejected;
not needed by HR send delivery and explicitly outside this Goal.
ALT-HR-003: New target ACL/policy framework — FOLLOW_UP_DEBT only; existing send
contract is capability-level and target enabledness remains fail-closed.

## 12. Migration, compatibility, and rollback

No schema, audience, versioned bundle, source runtime or credential migration.
The only future implementation surface is a Goal-specific operational
plan/apply/verify/rollback vehicle and its focused disposable tests, constrained
by these Contracts; exact files and hashes require an independently reviewed
controlled runbook before use. Do not deploy latest main. Tombstone semantics
must be freshly proven against the actual deployed issuer, including version<1
denial; otherwise operation is blocked. Existing send behavior is unchanged.
Rollback is CTR-HRG-005 only. Production slot and native privilege remain
independent execution gates; accepted Spec alone does not execute anything.

## 13. Open questions

OPEN_OWNER_DECISIONS = NONE beyond exact-head acceptance of DEC-HR-001/002.
NORMATIVE_TBD = NONE. Exact client UUID is a fail-closed runtime-bound parameter,
not a selectable identity or permission decision. Fresh live census/credential
binding and HR denial classification remain required operational evidence.
No runtime proof is claimed. FOLLOW_UP_DEBT: target ACL enhancements and generic
identity frameworks are excluded. NEXT: independent exact-head authority review;
then one blocker union repair and one re-audit, before Owner acceptance.

## 14. Supersession from V1

Whole-Spec successor of accepted AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1
(reviewed head 9b3b4bdb0016ec40bab2419bbf15dc886f40476f). Sole semantic
correction: the HR business security subject changes from the legacy
OpenClaw-era Principal `bc970ced-710f-4479-9ff0-e295a1c59424` (canonical
agent_id `hr-agent`) to the current formal HR business identity Principal
`dc702687-6515-4a2a-91ae-e572a9bbd766` (canonical agent_id `agt_hr-agent`),
per the Owner's fresh identity fact of 2026-09-05. V1's DEC-HR-001 alias
clause inverted the two identities and is corrected accordingly. Every other
accepted Decision, Contract, Acceptance mapping, and capability boundary is
preserved byte-semantically: minimal agent_session_send authorization only;
no scheduler.admin, no agent_wake, no cross-Agent Scheduler mutation, no
credential impersonation, no source credential propagation, no broad Agent
admin. V1 remains an existing bounded provisioning/admin actor authority
where already authorized and is superseded only as the HR business send
supply. Acceptance is atomic: this V2 becomes accepted and V1 becomes
superseded with the reciprocal backlink in the same acceptance transaction.
