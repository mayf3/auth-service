---
spec_id: AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-14
revision: r1
scope:
  - canonical HR own-dispatch inspection Grant
  - exact one-row forward replacement and rollback
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
related_specs:
  - AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    spec: AGENT_CORE_AGENT_SESSION_MESSAGING_V2
    accepted_reviewed_head: b9893400a98f627aa2ce6411e078d6ef03749288
supersedes: []
superseded_by: null
owners: [mayf3]
authoring_authority_basis: >-
  OWNER_DECISION=APPROVE_NARROW_AUTHORITY_DESIGN on 2026-09-14 authorizes
  authority authoring and independent security review only. HR Grant mutation,
  credentials, tokens, production inspection, and production mutation remain
  forbidden until exact-head acceptance and the controlled gates below.
accepted_date: 2026-09-14
accepted_by: mayf3
accepted_reviewed_head: 9eeb896abb5adb6298df73a4c9b489ae65bafce6
independent_security_review: PASS
independent_review_blockers: NONE
---

# AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1

> **ACCEPTED / CONTRACT IMPLEMENTATION AUTHORITY; PRODUCTION APPLY SEPARATELY
> CONTROLLED.** Owner `mayf3` accepted exact reviewed head
> `9eeb896abb5adb6298df73a4c9b489ae65bafce6` on 2026-09-14 after independent
> security review `PASS` with blockers `NONE`. This is a new, subsequent one-row
> operation; acceptance causes no implementation or production mutation. It does
> not amend or supersede accepted HR Send Grant V2, whose exact completed
> send-only poststate remains this operation's required source prestate.

## 1. Goal and exact subject

Authorize only the canonical HR business Agent to add the independently
registered scope `agent.session.inspect_own_dispatch` to its existing
`agent-session-messaging` Grant.

```text
Principal UUID = dc702687-6515-4a2a-91ae-e572a9bbd766
principal_type = agent
canonical agent_id = agt_hr-agent
Client = its unique active MachineClient whose nonsecret ids match the actual
         Broker credential binding for agt_hr-agent
resource = agent-session-messaging
new scope = agent.session.inspect_own_dispatch
```

Legacy Principal `bc970ced-710f-4479-9ff0-e295a1c59424` (`hr-agent`), any second
client, similar name, new/rebound credential, target Agent, fleet member, human,
service, or delegated principal is forbidden.

## 2. Exact permission delta

The only compatible source and target are:

```text
SOURCE: scopes=[agent.session.send], version=1, revoked_at=NULL
TARGET: scopes=[agent.session.inspect_own_dispatch,agent.session.send],
        version=2, revoked_at=NULL
```

The delta is only `agent.session.inspect_own_dispatch`; existing send permission
is preserved. No wildcard, admin, read-all, write, credential, Workflow,
Scheduler, other audience, Principal, Client, or unrelated Grant permission may
change. All bystander rows enter a stable semantic digest and receive zero
writes.

This is `AUTHORITY_ACTION=NEW`: accepted HR Send Grant V2 remains the immutable
authority for its earlier one-time send-supply operation. This new operation
starts only after that operation's exact live @v1 result is proven. It does not
rewrite the meaning, history, audit, rollback, or authority metadata of V2.

## 3. Auth and Agent Core security dependency

Before planning, accepted Audience CCR V2 must be implemented and deployed as
exact Bundle/DB `1.12.0` with both scopes. Token issuance still requires exact
resource, machine-only active Agent profile, registered requested scope, active
exact Grant containment, and executable/DB equality.

The Grant is not coordinate ownership. Agent Core independently derives caller
identity from trusted process/token context and proves the exact
`(targetAgentId,sessionId,messageId)` belongs to a legal dispatch by that caller.
Model-supplied caller identity, coordinate possession, message text, or Session
content never authorizes access. Foreign/unrelated/missing coordinates fail
closed under Agent Core's bounded opaque behavior. No full Session browsing,
list/search, adjacent history, content mutation, or credential access is granted.

## 4. Plan, transaction, and audit

Read-only planning must fresh-resolve the exact active Principal and unique
Broker-bound client, then read the complete Audience, Grant, governed audit, and
unrelated digest. Missing/ambiguous/disabled identity, binding drift, absent or
tombstoned Grant, wrong version/scope, Audience drift, or bystander drift aborts
before writes.

An apply consumes an exact reviewed implementation commit, canonical plan and
prestate digests, operator, approval reference, shared mutation lock, and nonce.
One serializable transaction locks and revalidates the subject/Audience/Grant,
compare-and-set replaces only @v1 with exact @v2, and appends exactly one closed
audit containing migration ID, source commit, operator, approval, bounded reason,
Principal/client IDs, audience, exact before/after scopes and versions, digests,
timestamp, change ID, and `change_type=replace`. Audit failure rolls back the
Grant. No secret/token/credential or raw Authorization enters any channel.

Exact target @v2 plus the unique exact audit is all-write-zero NOOP. Every mixed,
partial, extra/missing-scope, wrong-version, duplicate/missing-audit, identity, or
bystander drift state is conflict with all writes zero. Unknown outcome stops for
read-only reconciliation; no retry or assumed rollback.

## 5. Verification, revocation, and rollback

Post-apply readback proves exact @v2, unique audit, unchanged bystander digest,
Audience/Bundle 1.12 equality, and Auth health. A bounded token proof may use the
existing HR credential only in memory to request the exact two-scope set and
retain only `iss,aud,sub,client_id,principal_type,agent_id,scope,exp`. Wrong
scope/alias/wildcard and an ungranted client issue no token.

On a known activation-verification failure, the reviewed rollback path may
forward replace only exact @v2 with @v3 scopes `[agent.session.send]` and append a
separate closed rollback audit atomically. It never rewrites @v1, deletes the row,
revokes send, or touches bystanders. Drift or unknown outcome stops. Normal later
revocation remains a separate mandate. Thus inspection is revocable without
destroying the pre-existing send grant.

## 6. Exact implementation closure

After acceptance, implementation may add exactly:

```text
scripts/supply-hr-session-inspection-grant-v1.ts
tests/oauth/supply-hr-session-inspection-grant-v1.test.ts
```

The script is a one-off plan/apply/reconcile/verify/forward-rollback vehicle for
the exact tuple above. The test covers every identity/prestate/conflict/NOOP,
atomic fault, unknown outcome, rollback, bystander digest, token safe projection,
and secret canary. It may reuse existing libraries without modifying them. Any
third file or generic Auth behavior requires new authority.

## 7. Controlled execution order

Acceptance and merge have zero production effect. Later execution is:

```text
accepted/deployed Audience CCR V2 + exact 1.12 readback
→ exact implementation/conformance review
→ fresh identity/Grant/bystander prestate and canonical plan
→ shared mutation lock + serializable exact one-row transaction
→ readback/health + bounded token conformance
→ release lock and stop
```

No credential mutation/export, target send, Agent Core inspection, or Session
read occurs under this Auth authority.

## 8. Acceptance and lifecycle

Independent security review must verify canonical identity/client binding,
inspection-only permission delta, no wildcard/write/admin/credential, exact
prestate/target, Audience V2 prerequisite, atomic audit, fail-closed conflicts,
unknown outcome, revocability, zero bystander writes, zero secrets, and zero
current production mutation.

Independent PASS is Owner-accept-ready only. Explicit Owner acceptance may make
one lifecycle-only commit changing this Spec `proposed/none/none ->
accepted/contracts/contracts`, filling exact provenance, replacing only the
proposal banner, and updating only its README lifecycle cells. No predecessor
status/backlink or normative body changes because this is a new later operation.
Fresh independent final-head recheck must PASS before merge.

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
AUTHORITY_ACTION = NEW
HR_GRANT_MUTATION_THIS_ROUND = NONE
READY_FOR_INDEPENDENT_SECURITY_REVIEW = YES
```
