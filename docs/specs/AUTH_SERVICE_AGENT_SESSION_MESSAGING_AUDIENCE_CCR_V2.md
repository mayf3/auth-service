---
spec_id: AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-14
revision: r1
scope:
  - agent-session-messaging machine-only Audience
  - send and caller-owned exact-turn inspection scope registration
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    spec: AGENT_CORE_AGENT_SESSION_MESSAGING_V2
    accepted_reviewed_head: b9893400a98f627aa2ce6411e078d6ef03749288
    implementation_head: 435cc464877b5761e84108a052a5685ab547b6de
    merge_commit: 49a5d42c053401036550aac84d2427a61832a457
supersedes:
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1
superseded_by: null
owners: [mayf3]
authoring_authority_basis: >-
  OWNER_DECISION=APPROVE_NARROW_AUTHORITY_DESIGN on 2026-09-14 authorizes
  authority authoring and independent security review only. It does not
  authorize registry/database mutation, Auth deployment/restart, Grant or
  credential mutation, token minting, production inspection, or production use.
accepted_date: 2026-09-14
accepted_by: mayf3
accepted_reviewed_head: 9eeb896abb5adb6298df73a4c9b489ae65bafce6
independent_security_review: PASS
independent_review_blockers: NONE
---

# AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2

> **ACCEPTED / CONTRACT IMPLEMENTATION AUTHORITY; PRODUCTION APPLY SEPARATELY
> CONTROLLED.** Owner `mayf3` accepted exact reviewed head
> `9eeb896abb5adb6298df73a4c9b489ae65bafce6` on 2026-09-14 after independent
> security review `PASS` with blockers `NONE`. This acceptance authorizes only
> the exact §5 implementation closure and §6 controlled-activation contracts;
> it causes no implementation, Grant/credential change, deployment, token
> minting, inspection, or production mutation. Audience CCR V1 is superseded
> through the reciprocal lifecycle backlink and remains historical authority.

## 1. Goal and complete Audience contract

V2 carries the complete accepted V1 Audience identity and adds exactly one
independent scope:

```json
{
  "audience_id": "agent-session-messaging",
  "resource_service": "agent-session-messaging",
  "scope_namespace": "agent",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": [
    "agent.session.inspect_own_dispatch",
    "agent.session.send"
  ],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2 for canonical send and independently granted caller-owned exact-turn inspection consumed by dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_V2."
}
```

`agent.session.send` retains its accepted meaning. The only new meaning is:

> `agent.session.inspect_own_dispatch` permits an authenticated machine Agent to
> ask Agent Core for the bounded read-only projection of one exact native turn
> produced by that same caller's legal dispatch, identified by the complete
> `(targetAgentId, sessionId, messageId)` coordinate.

The two scopes are independent; neither implies the other. Auth only issues a
scope claim. Agent Core must derive caller identity from trusted process/token
context and independently prove caller-owned durable dispatch evidence plus
exact target/session/message match. Model-supplied identity, coordinate
possession, target identity, or Session content never authorizes access.

## 2. Frozen exclusions

No human, service, delegated/OBO, wildcard, admin, read-all, write, list/search,
full-history, credential, target-Agent, Workflow, Scheduler, or other audience
scope is registered. This authority creates no Principal, Client, credential,
Grant, dispatch ledger, retry engine, Session browser, or content mutation.
Missing/foreign/unrelated coordinate privacy and bounded turn projection are
Agent Core V2 obligations; Auth provides no coordinate oracle.

## 3. Current state and versioned delta

Fresh repository base `0cec4e9a64f5628ece42449693a7fc708f05098e`
contains Bundle/registry `1.11.0` and the exact active machine-only Audience above
with `registered_scopes=[agent.session.send]`. The complete V2 delta is:

```text
bundle/registry 1.11.0 -> 1.12.0
registered_scopes [agent.session.send]
 -> [agent.session.inspect_own_dispatch, agent.session.send]
notes -> exact V2 notes in §1
all other Audience and Auth semantics unchanged
```

Any implementation-base drift or accepted `1.12.0` collision stops and requires
a new reviewed authority amendment. No in-place version disguise is allowed.

## 4. Token and registry enforcement

The existing direct machine path remains authoritative: exact resource match;
active machine-enabled Audience; agent profile with trusted `agentId`; accepted
principal type; requested scopes registered and namespace-valid; exact active
MachineAccessGrant containing every requested scope; and executable/DB Audience
equality. Any failure denies issuance before downstream inspection. Tokens add
no trace coordinate, Session/message content, ownership evidence, credential, or
new claim type.

Fixtures must prove independent and combined exact-scope issuance plus denial of
missing Grant, send-only Grant requesting inspect, inspect-only fixture requesting
send, unknown/alias/wildcard/extra/wrong-namespace scope, human/service/delegated
profile, unregistered audience, and DB/registry mismatch. No raw token or secret
may enter evidence.

## 5. Exact implementation closure

After acceptance, implementation may modify exactly:

```text
contract-bundles/minimal-auth-v1/audience-registry.json
contract-bundles/minimal-auth-v1/contract-manifest.json
contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json
contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
contract-bundles/minimal-auth-v1/metadata/change-log.md
contract-bundles/minimal-auth-v1/validate.mjs
src/lib/oauth/v1/contract.ts
tests/oauth/agent-session-inspection-audience-v2.test.ts
```

The first 13 files are limited to exact `1.11.0 -> 1.12.0` linkage, the §1
entry, fixtures, validator assertions, consumer evidence, and runtime version
allowlist. The last file adds focused conformance only. A generic OAuth/API,
schema, token, credential, Principal/Client, Grant, or Session change is outside
authority.

## 6. Controlled production activation

Source acceptance/merge has zero production effect. After separate execution
activation under the accepted exact head, the only production sequence is:

```text
build and independently review exact Bundle 1.12.0
→ stage immutable release and exact 1.11.0 rollback artifacts
→ acquire shared Auth mutation lock; stop token service; prove no serving process
→ serializable transaction compare-and-set only the DB Audience registered scopes
  and append one closed nonsecret registry-change audit
→ activate exact Bundle 1.12.0; restart once
→ health + executable/DB exact equality + negative no-inspection-Grant proof
→ release lock and stop
```

Source state applies; exact target plus exact audit is all-write-zero NOOP. Every
mixed scope/version/audit state, metadata drift, symlink, artifact mismatch, or
unknown outcome fails closed. Unknown commit outcome keeps service stopped for
read-only reconciliation; no blind retry or rollback. Known verification failure
restores DB Audience and executable Bundle to exact 1.11.0 under the same lock,
restarts once, and proves health. Grants are never changed by this CCR.

The service must never serve while executable and database Audience definitions
differ. Evidence contains only exact commits/digests, nonsecret IDs, versions,
scope sets, audit ID, process generations, timestamps, health, and sanitized
results—never credentials, tokens, environment dumps, or authorization headers.

## 7. Acceptance

Independent security review must verify exact scope/resource/profile, trusted
caller boundary, scope independence, closed exclusions, 1.12 linkage/closure,
fail-closed activation/rollback, Grant writes zero, secrets zero, and current
production mutation zero.

## 8. Non-goals and alternatives

Reusing send for inspection, registering `agent.session.read`/wildcard, adding a
new audience, or embedding ownership in Auth are rejected. Leaving V1 active
while changing its exact single-scope meaning is rejected; this V2 is its whole
successor.

## 9. Lifecycle gate

Independent PASS is Owner-accept-ready only. Explicit Owner acceptance may make
one atomic lifecycle-only commit that:

1. changes V2 `proposed/none/none -> accepted/contracts/contracts` and fills
   exact review/acceptance provenance;
2. changes V1 `status: accepted -> superseded` and
   `superseded_by: null -> AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2`;
3. preserves V1 historical `implementation_authority: contracts`, every other
   V1 frontmatter field, and its normative body byte-for-byte;
4. replaces only V2's proposal banner and corresponding README lifecycle cells.

A fresh independent final-head transition check must PASS before merge. No
implementation or operation begins in the acceptance transaction.

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
AUTHORITY_ACTION = SUPERSEDE
PRODUCTION_MUTATION_THIS_ROUND = NONE
READY_FOR_INDEPENDENT_SECURITY_REVIEW = YES
```
