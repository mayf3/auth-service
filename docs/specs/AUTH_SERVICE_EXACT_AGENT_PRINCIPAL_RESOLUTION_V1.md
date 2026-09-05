---
spec_id: AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1
status: superseded
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/auth-service
  - exact Agent Principal resolution and minimal HR read grant
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
external_authorities: []
supersedes: []
superseded_by: AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2
accepted_date: 2026-09-05
accepted_by: mayf3
accepted_reviewed_spec_commit: 0359575dd1481aa5e6c294a495fbaabce97e40bf
acceptance_review_verdict: PASS
superseded_note: >-
  Superseded 2026-09-05 by AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2
  (whole-Spec subject successor: HR read-grant recipient bc970ced… -> dc702687…
  per Owner fresh identity fact). Its subject-generic resolution contracts remain
  in force verbatim through V2; the legacy Principal is no longer the HR
  read-grant recipient.
acceptance_authority_basis: >-
  Owner BATCHED EXACT-HEAD ACCEPTANCE = YES on 2026-09-05 for the three
  HR_DISPATCH_DELIVERY_READINESS_V1 authority candidates, binding this Spec at
  reviewed semantic head 0359575dd1481aa5e6c294a495fbaabce97e40bf after one
  independent first review (ACCEPT, BLOCKERS = 0, MERGE_READY = YES,
  DOWNSTREAM_PIN_CONSISTENCY = PASS; review record 77750cd). Owner acceptance
  ratifies production_apply_authority: conditional_controlled_operation per
  review SPEC_GAP-3; the reviewed normative body is preserved byte-for-byte;
  the three review SPEC_GAPs stay implementation-preflight obligations and are
  not promoted to shipping blockers.
owners:
  - mayf3
---

# AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1

## 1. Goal and route

Enable an authorized Agent to turn one exact assignee Principal UUID into Auth's
canonical Agent identity without target credentials, names, provisioning permission,
or a second identity database. Auth returns an active AGENT relation; Agent Core
separately proves that its exact Agent Definition exists and is enabled.

```
MASTER_GOAL = HR_DISPATCH_DELIVERY_READINESS_V1
BASE = ae6da9a8b754be16c35553f0dff1d8e36194d88f
AUTHORITY_ACTION = NEW
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

The Owner attachment dated 2026-09-05 authorizes preparing a minimum candidate and
independent review. It is execution mandate input, not accepted Product Authority.
This proposed Spec becomes implementation authority only after exact-head Owner
acceptance and merge. Independent review PASS does not itself accept it.

## 2. Scope and ownership

This child owns a new exact-UUID HTTP read operation, its independent machine-only
OAuth audience/scope registration, and one bounded HR read Grant requirement.
It leaves `AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1` external-ref queries,
closed projection, service-only provisioning audience, and three-file closure unchanged.
No new generic directory, search, batch, identity federation, Agent lifecycle,
scheduler, delivery, Workflow mutation, credential exchange, or target impersonation.
Auth remains authoritative for `machine_principals.id -> agent_id/type/status`.
It does not claim ownership of Agent Core existence, disabled state, or Session routing.

Primary parent: accepted `MINIMAL_AUTH_FOUNDATION_V2` at BASE, including its
exact-incorporated V1 claims/profiles/grants and child CCR extension mechanism.
This is an independent narrow operation, not a successor or partial supersession
of the existing external-ref discovery Spec. Auth is the upstream authority root;
downstream Agent Core pins this contract, never vice versa.

## 3. Current state and evidence

### OBS-EAPR-001

Source: BASE `prisma/schema.prisma:104-122`; read 2026-09-05, source-only census.
MachinePrincipal has UUID primary key, nullable unique agentId, principalType,
active/disabled status. This is an existing canonical relation, not proof of live data.

### OBS-EAPR-002

Source: BASE `src/lib/oauth/v1/resolution.ts:203-238` and accepted
`docs/specs/AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1.md`, DEC-RES-002/003/005.
The existing operation accepts deterministic external_ref, deliberately omits status,
and requires service-only `svc-auth/auth.identity.provision`. It cannot answer this Goal.

### CLM-EAPR-001 / EVD-EAPR-001 / STATE-EAPR-001

Claim SUPPORTED by OBS-EAPR-001/002: canonical storage exists; a bounded UUID read
and Agent caller permission are missing. Evidence relation SUPPORTS at BASE,
source inspection sufficient for interface gap only; no runtime readiness or Grant
claim follows. Source query and paths are reproducible using `git show BASE:path`.

## 4. Decisions

DEC-EAPR-001 (owner mayf3, proposed): reuse Auth storage; query UUID exactly and
refuse incomplete/inactive/non-Agent relations. No name or external-ref inference.
DEC-EAPR-002: new audience avoids broadening the service-only provisioning contract.
DEC-EAPR-003: one operation returns only identity, never status/Grant/credential dumps.
DEC-EAPR-004: use existing V1 direct-machine signature and issuance machinery;
new route-specific authorization does not implement a second JWT protocol.
DEC-EAPR-005: new scope supplies read permission only; HR client selection is
mechanical and exact, never first matching client or a fabricated mapping.

## 5. Contracts

### CTR-EAPR-001 — Registration

Register exactly this additive child CCR entry:

```json
{
  "audience_id": "agent-principal-resolution",
  "resource_service": "svc-auth",
  "scope_namespace": "auth",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["auth.agent.resolve"],
  "status": "active",
  "freeze_ready": true,
  "notes": "Exact active Agent Principal relation read under AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1."
}
```

No wildcard/scope implication: `auth.identity.provision`, generic admin, scheduler,
and `agent.session.send` do not satisfy `auth.agent.resolve`, or conversely.
Use existing Grant issuance semantics. Update the linked bundle with one additive
minor advancement from implementation-base registry_version, skipping all accepted
reserved versions; never disguise a registry change under its old digest/version.
Update only linked version/digest/fixture/validator/runtime-supported-version
surfaces required by existing bundle validation; preserve unrelated entries,
claims, signer/verifier, lifecycle, and production blockers. Record chosen version
and exact changed-file closure in implementation preflight and independent review.

### CTR-EAPR-002 — Authenticated bounded request

`GET /api/v1/agent-principals/:principal_id/agent` accepts no query parameters,
body, list, prefix, fuzzy match, alternate method, or client-supplied service URL.
The path value is one UUID matching
`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`;
UUID hex case is equivalent; output UUID is lowercase canonical representation.
Malformed input returns 400 `INVALID_PRINCIPAL_ID`; extra query/body returns 400
`INVALID_REQUEST`, before any target identity query.

Before target lookup, require existing V1 RS256 direct-machine verification with
exact audience above, issuer/time/token_use/client_id/sub/profile validation,
`principal_type=agent`, and exact required scope. Reject invalid tokens with 401
`UNAUTHORIZED`, missing scope with 403 `ACCESS_DENIED`. Fresh-read caller Principal
and Client, requiring active agent Principal, active Client bound to signed sub,
and signed profile consistent with stored profile. No target credential is used.
Caller authentication failures never disclose target identity. Use explicit field
projections; credential/secret hashes are not selected by this read operation.

### CTR-EAPR-003 — Exact canonical target

Query Auth's existing MachinePrincipal table by exact UUID with a two-row bound,
selecting only id, principalType, agentId, status. No match: 404
`PRINCIPAL_NOT_FOUND`; more than one: 409 `IDENTITY_RESOLUTION_AMBIGUOUS`.
Then require principalType agent (otherwise 422 `PRINCIPAL_NOT_AGENT`), status
active (otherwise 409 `PRINCIPAL_DISABLED`), and nonempty exact agentId (otherwise
409 `AGENT_MAPPING_MISSING`). No trimming, prefix insertion, display-name lookup,
externalRef fallback, or conversion from User.agentId is permitted.

For an eligible row, verify its agentId maps back to exactly that one principal
using an exact agentId query bounded to two rows; more than one row, missing
reverse row, or mismatched UUID returns 409 `IDENTITY_RESOLUTION_AMBIGUOUS`.
Both reads must share a consistent read-only transaction snapshot. Database
uniqueness is useful but MUST NOT replace fail-closed duplicate handling.
Return 200 exactly `{"principalId":"<canonical UUID>","agentId":"<stored exact ID>"}`.
Auth does not reject legacy Agent ID syntax merely to invent a replacement;
the downstream ASM-compatible Agent Definition validator owns deliverability.

### CTR-EAPR-004 — Unknown failures and no mutation

Database, malformed row, connection, internal, and query errors return 500
`IDENTITY_RESOLUTION_QUERY_FAILED`, never fabricated absence or a selected row.
A bounded 5-second operation deadline returns 504 `IDENTITY_RESOLUTION_TIMEOUT`.
Late completion cannot change the response. The operation writes no Principal,
Client, Grant, credential, identity audit row, or business state. No automatic
repair, provisioning, target-token issuance, or automatic request retry. Ordinary
sanitized service access logging may record outcome, not tokens or secrets.

### CTR-EAPR-005 — HR read grant selection

The sole initial intended recipient is existing active AGENT Principal
`bc970ced-710f-4479-9ff0-e295a1c59424`. Fresh verify the runtime-owned HR credential
binding by its public Client ID and Auth's server-side client->Principal relation;
select that exact active Client, requiring unique unambiguous agreement. Do not
select by display name, create/rotate credentials, enumerate secrets, or choose
a first client. If binding cannot be proved, preparation fails closed.

The only allowed new tuple is `(that clientId, agent-principal-resolution,
auth.agent.resolve)`. Existing unrelated grants are preserved; this child grants
no provisioning, scheduler, send, wake, lifecycle, impersonation, or generic admin
permission. Lane A separately owns HR's send Grant; no implicit cross-scope grant.
Acceptance of this Spec permits preparation of the exact grant transaction;
actual production activation additionally requires CTR-EAPR-007's gated runbook.

### CTR-EAPR-006 — Scope of implementation

Allowed behavior closure: a dedicated route, dedicated bounded resolver and
route-auth middleware reusing existing V1 verification, minimal server mount,
focused tests, linked CCR bundle/version files, and a controlled one-tuple
provisioning/readback tool or runbook. No schema migration or second identity
store. Existing external-ref and provisioning behavior stays byte/semantically
unchanged except independent additive route mounting. Respect repository file
structure limits; do not add a framework or refactor existing identity services.

### CTR-EAPR-007 — Production lifecycle and rollback

A proposed/accepted/source-merged Spec is not production success. Before apply,
require accepted authority in base, independent exact implementation review,
focused executed tests, fresh exact source/runtime/preimage and HR binding,
and a reviewed controlled runbook with minimal delta, health/readback/receipt,
abort conditions and exact rollback. No whole-latest-main deployment.

Production mutation concurrency is one. Hold while
VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1 owns the slot. Release only with fresh
VISIT_ACTIVATION_PRODUCTION_READY=YES, DISPATCH_INTENT_BROKER_PRODUCTION_READY=YES,
and PRODUCTION_RUNTIME_LOCK=IDLE. Native Owner authorization is required where
privileged access requires it. The coordinator must not manufacture these facts.
On failure restore the exact preimage; remove only a tuple newly inserted by this
transaction, never a preexisting tuple. Disable exposure before withdrawing a
new registry entry; do not remove an entry in use by another accepted consumer.
Retain sanitized durable receipt; raw sensitive evidence stays local.

## 6. Acceptance and coverage

Each row is an independent Acceptance with the stated Contracts, method, environment,
required evidence and expected/failure outcome. Evidence must bind exact implementation
head, authority head, test command, environment, timestamp and actual results.

| Acceptance | Contracts | Method / environment | Expected result / failure condition |
|---|---|---|---|
| ACC-EAPR-001 | CTR-EAPR-001 | bundle validator + issuance fixtures, isolated | exact entry and one version delta; reject wrong audience/profile/scope; unrelated entries/blocker counts preserved; drift fails |
| ACC-EAPR-002 | CTR-EAPR-002 | real route with signed fixtures + fresh DB adapter, isolated | valid caller reaches target lookup; expired/wrong signature/audience/scope/profile/disabled caller/client/mismatched binding rejected before target read; malformed UUID/query/body rejected |
| ACC-EAPR-003 | CTR-EAPR-003 | injected DB + relational integration fixtures, isolated | exact UUID and stored agentId; missing/wrong type/disabled/empty/duplicate forward or reverse relation rejected; name/legacy User cannot resolve; case-equivalent UUID accepted |
| ACC-EAPR-004 | CTR-EAPR-004 | DB failure/deadline/late-result/write-spy tests, isolated | 500/504 never absence, no mutation or retry; sentinel secrets absent from result/logs |
| ACC-EAPR-005 | CTR-EAPR-005 | controlled preflight/readback, target-bound environment | unique HR binding and exact one tuple delta; ambiguous binding fails; no other grant changes |
| ACC-EAPR-006 | CTR-EAPR-006 | diff + existing external-ref/provisioning regression, isolated | only allowed closure, existing behavior unchanged, no schema/store/framework |
| ACC-EAPR-007 | CTR-EAPR-007 | runbook premutation failure rehearsal + independent receipt/readback, exact target | hold gate prevents apply; success read/health and rollback prove exact preimage; missing receipt/authorization is failure |

Required production evidence for ACC-EAPR-005/007 is a sanitized target-bound receipt
and independent readback, not only unit tests. No acceptance result is claimed here.
Every CTR-EAPR-001..007 is covered by its same-number ACC row; 7/7.

## 7. Alternatives and stop boundary

ALT-EAPR-001 rejected: grant HR `auth.identity.provision` or widen svc-auth to agents;
that expands management authority. New evidence of an already accepted bounded read
scope could reopen selection before acceptance.
ALT-EAPR-002 rejected: reverse external-ref strings or use target token verification;
UUID input has no canonical external-ref without already knowing agentId and target
credentials are forbidden. ALT-EAPR-003 rejected: new identity database or name map.

```
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
AUTHORING_DONE_WHEN = exact-head independent review ready
IMPLEMENTATION_READY = NO
PRODUCTION_READY = NO
```
