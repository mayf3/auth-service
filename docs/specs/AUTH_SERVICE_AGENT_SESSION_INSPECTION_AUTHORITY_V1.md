---
spec_id: AUTH_SERVICE_AGENT_SESSION_INSPECTION_AUTHORITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-14
revision: r2
revision_date: 2026-09-14
scope:
  - agent-session-messaging exact inspection scope registration
  - canonical HR machine client own-dispatch inspection Grant
  - controlled Auth activation and rollback
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
related_specs:
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1
  - AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    spec: AGENT_CORE_AGENT_SESSION_MESSAGING_V2
    accepted_reviewed_head: b9893400a98f627aa2ce6411e078d6ef03749288
    implementation_head: 435cc464877b5761e84108a052a5685ab547b6de
    merge_commit: 49a5d42c053401036550aac84d2427a61832a457
supersedes:
  - AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1
  - AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2
superseded_by: null
owners:
  - mayf3
authoring_authority_basis: >-
  OWNER_DECISION=APPROVE_NARROW_AUTHORITY_DESIGN on 2026-09-14 authorizes
  authority authoring and independent security review only. It does not
  authorize scope registration, Auth deployment/restart, Grant mutation,
  credential access, token minting, production inspection, or any other
  production mutation.
accepted_date: null
accepted_by: null
accepted_reviewed_head: null
independent_security_review: null
independent_review_blockers: null
---

# AUTH_SERVICE_AGENT_SESSION_INSPECTION_AUTHORITY_V1

> **PROPOSED / NO IMPLEMENTATION OR PRODUCTION AUTHORITY.** This combined
> whole-authority successor defines one new inspection scope and one exact HR
> Grant delta while carrying forward all unaffected parent contracts. Until
> independent exact-head security review passes and Owner `mayf3` explicitly
> accepts that exact head, no bundle, registry, database, Grant, credential,
> token, service, or production state may change.

## 1. Goal and one-line model

Register exactly:

```text
resource = agent-session-messaging
new scope = agent.session.inspect_own_dispatch
principal profile = machine-only agent
```

and authorize the canonical HR machine client to add only that scope to its
existing send Grant, so Agent Core may enforce:

```text
trusted caller identity
+ targetAgentId
+ sessionId
+ messageId
→ caller's own legally dispatched exact native turn, read-only
```

Auth issues a scope claim; it does not resolve coordinates or read Sessions.
Agent Core remains responsible for independently verifying trusted caller
identity, caller-owned dispatch evidence, exact target/session/message match,
and opaque fail-closed foreign/unrelated denials.

## 2. Whole-authority scope and non-goals

This document is the complete combined successor for the two intersecting
subjects previously owned separately by accepted
`AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1` and
`AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V2`: the complete
`agent-session-messaging` Audience contract and the complete canonical HR Grant
contract. While this candidate is proposed, both predecessors remain active and
unchanged. Only the atomic lifecycle transaction in §11 may accept this document
and supersede both predecessors with reciprocal backlinks.

The accepted meaning changes only where unavoidable: the Audience exact scope
set changes from send-only to send plus own-dispatch inspection, and the exact
HR Grant advances from send-only v1 to the two-scope v2 row. This document
replaces, rather than partially amends, those conflicting clauses. It carries
forward the complete unaffected parent contract: canonical resource/audience and
agent namespace; machine-only active agent profile; no human/service/delegated
access; exact direct-token registry/DB/Grant consistency; canonical HR identity
and unique Broker-bound active machine client; no new Principal/Client/secret;
serializable compare-and-set; same-transaction closed audit; exact rerun NOOP;
fail-closed drift and unknown-outcome reconciliation; secret-safe verification;
zero unrelated Grant mutation; and separately gated production execution.

Out of scope: arbitrary Session browsing; historical enumeration; another
caller's dispatch; global Session administration; content write/delete/edit;
credential access/export/rotation; new Principal or Client; human/service/OBO
access; wildcard or admin scopes; target-Agent Grants; fleet Grants; dispatch
ledger, retry, Scheduler, Workflow, or Agent identity redesign.

## 3. Current state and evidence

At fresh Auth base `0cec4e9a64f5628ece42449693a7fc708f05098e`:

```text
registry_version = 1.11.0
audience_id = agent-session-messaging
resource_service = agent-session-messaging
scope_namespace = agent
accepted_principal_types = [agent]
human_access_enabled = false
machine_access_enabled = true
delegated_access_enabled = false
registered_scopes = [agent.session.send]
status = active
freeze_ready = true
```

The accepted HR send authority binds:

```text
principal UUID = dc702687-6515-4a2a-91ae-e572a9bbd766
canonical agent_id = agt_hr-agent
client = the unique active MachineClient whose nonsecret ids match the
         production Broker credential binding for agt_hr-agent
existing resource = agent-session-messaging
existing exact scopes = [agent.session.send]
```

The exact client UUID/client_id and live Grant row are runtime-bound values and
must be freshly resolved without exposing the credential. This proposal does
not claim current production Grant state and performs no live read.

## 4. Frozen scope semantics

`agent.session.inspect_own_dispatch` means only:

> The authenticated machine Agent may ask Agent Core to inspect a single exact
> native turn produced by a legal dispatch attributed to that same caller, using
> the complete `(targetAgentId, sessionId, messageId)` coordinate.

The scope alone is insufficient. Agent Core must independently derive caller
identity from trusted process/token context and prove all coordinate ownership
and exact-match predicates against durable evidence. Model-supplied caller ID,
coordinate possession, target identity, Session data, message text, or a send
Grant is not authorization. `agent.session.send` and
`agent.session.inspect_own_dispatch` do not imply each other.

The scope cannot authorize list/search, full Session reads, adjacent turns,
foreign dispatches, workflow-origin turns without caller ownership, writes,
deletes, edits, credential access, or any other `agent.session.*` operation.

## 5. Exact Audience delta

The only Audience semantic delta is the exact ASCII-sorted scope set:

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
  "notes": "Registered by AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1; amended by AUTH_SERVICE_AGENT_SESSION_INSPECTION_AUTHORITY_V1 for independent caller-owned exact-turn inspection consumed by dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_V2."
}
```

No audience is added or renamed. The implementation must advance the complete
Minimal Auth bundle from exact `1.11.0` to exact `1.12.0`; any base drift or
accepted version collision stops and requires a fresh authority amendment. It
must update only the mechanically linked version/scope/fixture evidence and add
positive exact-scope plus negative missing/alias/wildcard/extra-scope fixtures.

## 6. Exact HR Grant design

The only permission delta is on the existing canonical HR client's one
`agent-session-messaging` row:

```text
before scopes = [agent.session.send]
before version = 1

after scopes = [agent.session.inspect_own_dispatch, agent.session.send]
after version = 2
revoked_at = NULL
```

The newly authorized scope is exactly
`agent.session.inspect_own_dispatch`; `agent.session.send` is preserved from the
accepted preimage, not newly broadened. No wildcard, admin, read-all, write,
credential, Workflow, Scheduler, target-Agent, other audience, Principal, or
Client permission may change.

Before planning, the operator must resolve the exact active HR Principal and its
unique active machine client, match its nonsecret IDs to the real Broker caller
binding, and fresh-read the Audience and complete Grant preimage. Missing,
ambiguous, disabled, mismatched, tombstoned, extra-scope, wrong-version, or
credential-binding drift fails closed with zero writes. Legacy Principal
`bc970ced-710f-4479-9ff0-e295a1c59424` (`hr-agent`) is never selected.

The current HR business subject is exclusively Principal
`dc702687-6515-4a2a-91ae-e572a9bbd766`, `principal_type=agent`, active,
`disabled_at=NULL`, canonical `agent_id=agt_hr-agent`, and its unique active
Broker-bound MachineClient. Name similarity, a second client, a substituted
Principal, credential rebinding, client creation, or secret rotation is
forbidden. All other existing HR permissions and every other principal/client
row are bystanders included in the stable before/after digest and receive zero
writes.

The row remains revocable and auditable. A known activation-verification failure
may use the same accepted authority's reviewed rollback vehicle to forward
replace only exact target version 2 with version 3 and scopes
`[agent.session.send]`; it never rewrites version 1, deletes the row, revokes the
existing send permission, or touches unrelated Grants. Drift or unknown outcome
stops for read-only reconciliation; no automatic rollback or retry.

## 7. Independent enforcement and failure privacy

Auth token issuance must enforce the existing machine-client gates: exact
resource, active machine-only agent profile, registered requested scope, exact
Grant containment, DB/registry equality, and verified client credential. Tokens
may contain only existing safe identity/audience/scope claims; no trace
coordinate, Session content, message, credential, or ownership record is added.

Agent Core must deny missing, wrong, foreign, unrelated, or unauthorized
coordinates with its accepted bounded and timing-characterized opaque behavior.
Auth does not provide a coordinate oracle. Grant denial occurs before any
Session read. The consumer must never trust a model-supplied caller identity.

## 8. Exact implementation closure

After acceptance, source implementation may modify exactly these files:

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
scripts/supply-hr-session-inspection-grant-v1.ts
tests/oauth/agent-session-inspection-authority-v1.test.ts
```

The first 13 files are limited to the exact `1.11.0 -> 1.12.0` linkage,
registered-scope, fixtures, validator assertions, consumer evidence, and runtime
version allowlist. The final two files own the one exact HR plan/apply/verify/
forward-rollback vehicle and its isolated tests. No generic OAuth endpoint,
schema, token, credential, Principal/Client, or Session code may change.

## 9. Controlled activation sequence

Acceptance and implementation merge cause no production effect. A later
execution under an accepted exact head must use this strict order:

```text
A build and independently review exact Bundle 1.12.0 + Grant vehicle
→ B stage Auth artifact; acquire shared mutation lock; stop serving tokens
→ C serializable transaction updates only Audience registered scopes,
    exact HR Grant v1→v2, and one closed audit envelope atomically
→ D activate exact Bundle 1.12.0; restart once; health + state readback
→ E bounded positive/negative token conformance with token only in memory
→ F release lock and stop
```

The service must never serve while executable and database Audience scopes
differ. Apply consumes an exact reviewed implementation commit, artifact digest,
plan/prestate digest, operator, approval reference, and nonce. It revalidates all
preconditions under lock inside the transaction. Unknown commit outcome stops
with service stopped until read-only reconciliation classifies the Audience,
Grant, and unique audit receipt.

The audit envelope must bind migration ID, exact source commit, operator,
approval reference, bounded reason, Principal UUID, client UUID/client_id,
audience, exact before/after scopes and versions, preimage/plan digests,
timestamp, change ID, and action `replace`. It must contain no secret or token.
Audit append failure rolls back Audience and Grant atomically.

The only compatible transaction prestates are the exact source state (Bundle
and DB Audience `1.11.0` with send-only registration, exact canonical HR Grant
send-only @v1, and no governed migration audit) or the exact target state
(Bundle/DB Audience `1.12.0` with the two frozen scopes, exact HR Grant @v2, and
exactly one governed audit). The source state applies; the target state is an
all-write-zero NOOP. Every mixed face, missing/extra scope, wrong version,
duplicate/missing audit, identity drift, or bystander digest drift is conflict
with Audience/Grant/audit writes all zero. No union, broad upsert, overwrite,
DELETE, alternate client, or best-effort repair is allowed.

Post-activation `verify-state` must prove exact executable/DB Audience equality,
exact HR Grant @v2, exactly one governed audit, healthy Auth, and unchanged
unrelated digest. A bounded `verify-mint` may request only the exact resource and
the exact two-scope set through the already-existing HR credential held only in
memory, and may retain only safe claim projection
`iss,aud,sub,client_id,principal_type,agent_id,scope,exp`. Wrong scope, alias,
wildcard, ungranted client, human/service/delegated profile, and DB/registry
mismatch must issue no token. No raw token or Authorization material may be
printed or persisted.

## 10. Acceptance and security tests

Independent security review must verify:

```text
SCOPE_LITERAL = agent.session.inspect_own_dispatch
PRINCIPAL_PROFILE = machine-only agent
CALLER_IDENTITY = trusted server context, never model supplied
COORDINATE_BINDING = targetAgentId + sessionId + messageId
OWNERSHIP_ENFORCEMENT = Agent Core durable caller-owned dispatch proof
SEND_PERMISSION_IMPLICATION = NONE
INSPECTION_PERMISSION_IMPLICATION = NONE
FOREIGN_OR_UNRELATED_ACCESS = FAIL_CLOSED
ARBITRARY_HISTORY_OR_WRITE = FORBIDDEN
HR_IDENTITY = exact canonical Principal + unique bound machine client
HR_PERMISSION_DELTA = inspection scope only
SECRET_EXPOSURE = NONE
REVOCABLE_AND_AUDITABLE = YES
PRODUCTION_MUTATION_THIS_ROUND = NONE
```

Focused implementation tests must cover exact registry shape/version, direct
machine positive issuance for each independently granted scope, combined HR
scope request, missing Grant, send-only Grant requesting inspect, inspect-only
fixture requesting send, wrong namespace, alias, wildcard, extra scope,
human/service/delegated profiles, DB/registry mismatch, foreign client, legacy
HR identity, ambiguous clients, every Grant prestate, atomic fault injection,
unknown outcome, exact rerun NOOP, forward rollback, unchanged unrelated digest,
and zero secret/token output.

## 11. Lifecycle gate

Independent PASS makes this proposal Owner-accept-ready only. On explicit Owner
acceptance of the exact reviewed head, one lifecycle-only commit may change:

1. `status: proposed -> accepted`;
2. `implementation_authority: none -> contracts`;
3. `production_apply_authority: none -> contracts`;
4. null acceptance/review fields to exact accepted values;
5. each predecessor `status: accepted -> superseded` while preserving its
   historical `implementation_authority: contracts` and normative body;
6. each predecessor `superseded_by: null ->
   AUTH_SERVICE_AGENT_SESSION_INSPECTION_AUTHORITY_V1`;
7. the proposal banner to an accepted banner with no semantic delta;
8. this Spec's README lifecycle/authority cells plus only the two predecessor
   README lifecycle/backlink descriptions.

Every other byte, including both historical predecessor authority fields and
normative bodies, is frozen. A fresh independent final-head recheck must prove
the exhaustive allowlist, reciprocal relationships, exactly one accepted
authority for the combined subject, and `SEMANTIC_DELTA=NONE` beyond the already
reviewed successor semantics before merge. Even after
acceptance, execution must satisfy §9; no credential export or arbitrary token
mint is authorized.

## 12. Alternatives and open questions

- Reuse `agent.session.send` for inspection: rejected; grants are independent.
- Register `agent.session.read` or wildcard: rejected as overbroad.
- Create another HR client or Grant row: rejected; use the exact bound client.
- Put trace coordinates in Auth: rejected; ownership is an Agent Core concern.
- Keep both conflicting predecessors accepted as partial amendments: rejected by
  the repository whole-authority invariant.
- Split registry and Grant into unrelated production windows: rejected because
  the service must not serve a DB/executable scope mismatch.

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
WHOLE_AUTHORITY_SUCCESSOR = YES
PREDECESSOR_COUNT = 2
HR_GRANT_MUTATION_THIS_ROUND = NONE
AUTH_SCOPE_REGISTRATION_THIS_ROUND = NONE
READY_FOR_INDEPENDENT_SECURITY_REVIEW = YES
```
