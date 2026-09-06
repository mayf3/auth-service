---
spec_id: AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/auth-service
  - generic authenticated internal canonical-identity directory read (Principal → exact Agent relation + status)
governed_by: [MINIMAL_AUTH_FOUNDATION_V2]
external_authorities: []
supersedes:
  - AUTH_SERVICE_WORKFLOW_CANONICAL_ADMISSION_V1
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1

## Goal, route and authority

Expose the exact Principal→canonical-Agent relation as a minimal internal directory read
available to ANY authenticated canonical internal Agent or SERVICE caller, so no consumer
(Workflow, HR, Scheduler, Forum, other canonical services) needs a dedicated per-purpose
lookup SERVICE identity. Auth remains the sole Principal-mapping owner; this changes WHO
may perform the safe read, not HOW identity is resolved.

Owner direction 2026-09-06 (WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1,
CONTINUE_SAME_GOAL): canonical identity lookup is foundational internal directory
information; the previously accepted dedicated-Service model
(AUTH_SERVICE_WORKFLOW_CANONICAL_ADMISSION_V1 @ 2af21f8, caller pinned to SERVICE
cedb954a-3d99-4e5a-b568-d312441bcc56 / client svc-workflow-canonical-admission-v1) is
SUPERSEDED_DIRECTION_PENDING. Its dedicated objects were never provisioned in production;
nothing is deleted, and the implemented exact-lookup logic is reused.

DEVELOPMENT_PREFLIGHT: AUTHORITY_ACTION=SUPERSEDE (read-authorization model changed by
Owner direction; query semantics unchanged); PLAN_LEVEL=EXEC_PLAN;
ASSURANCE_LEVEL=CONTROLLED; DOCS_FIRST_REQUIRED=YES. Base: current main f6382b8 plus the
branch-local implementation head fa209b4 (unmerged). Mechanical reconciliation evidence:
docs/investigations/INTERNAL_IDENTITY_DIRECTORY_RECONCILIATION_V1.md in mayf3/svc-workflow
(disposition CASE C: no suitable generic read existed at base — nearest surface is
agent-only callers, sole-recipient HR grant per CTR-EAPR-005, and status-less by
DEC-EAPR-003).

## Contracts

### CTR-AID-001 — Closed additive registrations

Replace the two unmerged workflow-admission CCR entries with exactly two generic entries
through the existing accepted version/digest linkage mechanism:

| audience_id | resource_service | scope_namespace | sole registered scope | accepted principal types |
|---|---|---|---|---|
| identity-directory | svc-auth | auth | auth.directory.read | agent, service |
| agent-directory | agent-core | agent | agent.directory.read | agent, service |

Both accept machine access true, human/delegated access false, status active and
freeze_ready true. No scope implies another. Existing audience entries, issuer, signer,
claims and profiles retain their contracts. Reserve one additive bundle minor version
against the fresh implementation base; update only required linked digest/version
validators and fixtures. The `agent-directory` entry registers tokens consumed by the
agent-core successor Spec; Auth registration does not implement that endpoint.

### CTR-AID-002 — Generic internal caller authorization

The route accepts any currently-active canonical internal principal: an AGENT principal
or a SERVICE principal, authenticated by the existing V1 RS256 direct-machine profile
(issuer/JWKS/time/token_use), exact single audience `identity-directory`, exact required
scope `auth.directory.read`, and a fresh read of caller Principal and Client state
requiring both active and the client exactly bound to the signed sub. No single-caller
pin, no per-consumer identity special-casing, no delegated/proxy profile, no human
token. Obtaining a token still requires an existing governed MachineAccessGrant for the
audience (unchanged issuance law); grants are shared generic tuples, not per-purpose
pairs. Invalid authentication = 401 UNAUTHORIZED; otherwise-valid caller missing the
required scope = 403 ACCESS_DENIED before any target read.

### CTR-AID-003 — Exact directory route

GET /api/v1/directory/principals/:principal_id/agent accepts one exact UUID and no
body/query/list; UUID syntax validated by the existing exact resolver rules; no names,
normalization, external-ref lookup or inferred target. In one consistent read-only
transaction, query the exact target UUID and the reverse exact agentId, both bounded to
two rows; require target type agent and bidirectional cardinality one. Success returns
exactly {principalId, agentId, principalStatus} preserving the stored exact Agent ID,
with principalStatus ∈ {active, disabled} as observable directory data — a disabled
target returns 200 with principalStatus=disabled (directory semantics; consumers such as
Workflow admission reject non-active themselves). Missing=404 PRINCIPAL_NOT_FOUND;
wrong type=422 PRINCIPAL_NOT_AGENT; duplicate/mismatched reverse relation=409
IDENTITY_RESOLUTION_AMBIGUOUS; missing agentId on an agent principal=409
AGENT_MAPPING_MISSING; malformed request=400 INVALID_REQUEST. No display name, email,
external_ref, client, grant or credential data is ever returned.

### CTR-AID-004 — Failure, freshness and secret boundaries

Unknown database/internal errors=500 IDENTITY_RESOLUTION_QUERY_FAILED; whole-operation
deadline 5 seconds=504 IDENTITY_RESOLUTION_TIMEOUT covering caller reads and both
relation queries; a late result after deadline is discarded; no retries, no writes, no
target token issuance, no credential logging. Responses use Cache-Control: no-store.
Only explicit nonsecret fields are selected. No positive relation cache across commands.
Consumers bound their own admission/commit windows; Auth claims no cross-service
atomicity.

### CTR-AID-005 — Implementation and operation closure

Reuse the branch-local implementation (fa209b4) query/timeout/error machinery; the
bounded adaptation is: route path rename to /api/v1/directory/principals/:principal_id/agent,
caller-predicate generalization in the admission middleware (drop the pinned
principal/client constants; keep V1 verifier + fresh state/binding checks; accept
principal types agent and service), response gains principalStatus with the disabled
branch converted from 409 error to 200 data, CCR entry replacement per CTR-AID-001, and
matching fixture/test updates. No schema change, no public directory listing, no
provisioning permission expansion, no HR-route rewrite. Freeze the exact changed-file
closure before implementation review. Production requires accepted authority in base,
exact implementation audit, focused tests, preimage, shared mutation slot IDLE and
durable readback; no whole-main deployment. The previously planned dedicated Principal/
Client/two-Grant supply is retired; consumers obtain the generic grant through the
existing governed grant machinery.

### CTR-AID-006 — Acceptance boundary

| Acceptance | Contracts | Method/environment/evidence | Expected / failure |
|---|---|---|---|
| ACC-AID-001 |001| isolated bundle validator + issuance fixtures at exact head | exactly the two generic entries; agent AND service callers can mint; human/delegated/wrong-scope deny; unrelated bundle entries unchanged |
| ACC-AID-002 |002| real signed V1 fixtures incl. agent caller, service caller, disabled caller, revoked client, binding drift | valid agent+service callers succeed; every invalid profile denies before target read |
| ACC-AID-003 |003| signed real-route relational fixtures | exact UUID success incl. principalStatus active and disabled; name/query/body/list/non-UUID deny; 404/422/409 discrimination; no extra fields |
| ACC-AID-004 |004| timeout/late-result/write-spy/log-sentinel fixtures | no writes/retry/cache; accurate 500/504; no credential/status leakage beyond the contract |
| ACC-AID-005 |005| exact diff vs frozen closure + controlled release rehearsal | bounded file set; query logic byte-preserved; rollback boundary proven |
| ACC-AID-006 |006| consumer integration at pinned accepted owning heads | varied internal callers resolve; Workflow admission fail-closed path intact; no premature Goal completion |

## Alternatives and status

Rejected: keeping the dedicated single-caller admission route (Owner-superseded); widening
the HR-only agent-principal-resolution audience (changes a frozen accepted contract and
its sole-recipient grant law); the legacy /api/users directory (wrong store, exposes
profile data); unauthenticated mobile projection; generic IAM platform or second identity
store; anonymous lookup; arbitrary-attribute search.

STATUS=proposed; IMPLEMENTATION_ALLOWED_NOW=NO; PRODUCTION_READY=NO. This successor
requires independent semantic review and exact-head Owner acceptance before any
implementation continues under it. The superseded parent's never-provisioned objects
(principal cedb954a-…, client svc-workflow-canonical-admission-v1, audiences
workflow-principal-admission / workflow-agent-admission) are retired by this document.
