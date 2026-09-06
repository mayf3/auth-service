---
spec_id: AUTH_SERVICE_WORKFLOW_CANONICAL_ADMISSION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/auth-service
  - dedicated Workflow backend exact identity admission read
governed_by: [MINIMAL_AUTH_FOUNDATION_V2]
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_WORKFLOW_CANONICAL_ADMISSION_V1

## Goal, route and authority

Prevent corrected Workflow sources from accepting an already-invalid Agent assignment while preserving per-create personnel selection. Auth owns the exact Principal relation; Agent Core separately owns enabled Agent Definition status. This independent service-only read does not alter the accepted agent/HR-only resolver V2 or its Grants.

DEVELOPMENT_PREFLIGHT: AUTHORITY_ACTION=NEW; PLAN_LEVEL=EXEC_PLAN; ASSURANCE_LEVEL=CONTROLLED; DOCS_FIRST_REQUIRED=YES. Base a8055565bac2474426cd71705d4aa56c8d675adc. Parent MINIMAL_AUTH_FOUNDATION_V2 at that base, including its exact-incorporated direct-service profile, CCR extension and Grant machinery. Existing AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2 at the same base remains accepted and unchanged. No implementation, registry edit, credential generation or production mutation is authorized by this proposal.

The Goal prohibits permission broadening. It does not already authorize the new service identity/two read Grants proposed here. Exact-head Owner acceptance must explicitly include this narrow additional backend-read authority; silence, audit PASS, general autonomous-work instructions and existing HR authorization do not supply it. If declined, retain fail-closed admission and report the prerequisite unavailable; do not borrow another identity.

## Evidence and decisions

OBS-WCA-001: canonical-validation-seam.md, source inspection at base, finds the exact Auth UUID route requires an AGENT caller and HR-only initial Grant; it cannot lawfully serve a Workflow backend SERVICE caller. OBS-WCA-002: prisma/schema.prisma and src/lib/oauth/v1/direct.ts at base support service Principals with agentId=NULL and direct-machine issuance. EVD-WCA-001 SUPPORTS CLM-WCA-001: a separate narrow service read can reuse existing data/issuance without widening HR or provisioning authority. This is source feasibility, not production readiness.

DEC-WCA-001 (proposed, owner mayf3): svc-workflow uses its own dedicated backend SERVICE identity and two separately scoped read tokens. Auth returns the exact relation; dsh checks the resulting exact Agent ID. No proxy token exchange, HR credentials, public directory, fallback, second identity store or new Agent is involved.

## Contracts

### CTR-WCA-001 — Closed additive registrations

Add exactly two CCR entries through the existing accepted version/digest linkage mechanism:

| audience_id | resource_service | scope_namespace | sole registered scope |
|---|---|---|---|
| workflow-principal-admission | svc-auth | auth | auth.agent.admission.read |
| workflow-agent-admission | agent-core | agent | agent.definition.admission.read |

Both accept principal type service only, machine access true, human/delegated access false, status active and freeze_ready true. No scope implies another. Existing audience entries, issuer, signer, claims and profiles retain their contracts. Reserve one additive bundle minor version against the fresh implementation base and accepted reservations; update only required linked digest/version validators and fixtures. Auth registration does not implement or authorize an Agent Core endpoint.

### CTR-WCA-002 — Exact proposed caller and permission supply

The following identifiers are newly preassigned proposal values, NOT observed production identities:

- Principal UUID cedb954a-3d99-4e5a-b568-d312441bcc56, type service, agentId=NULL, ownerUserId=NULL, external_ref=workflow:v1:canonical-admission:service.
- MachineClient row UUID c37e5e03-62ad-4e8f-8575-2e64bcee649e, clientId=svc-workflow-canonical-admission-v1, bound only to that Principal, external_ref=workflow:v1:canonical-admission:client.
- Exactly two Grants: this Client x each audience/scope in CTR-001. No Workflow read/execute/admin, provisioning, scheduler, delivery or Agent lifecycle Grant.

Plan checks exact UUID/clientId/externalRef collisions, existing row/grant values and all unrelated row digests. An absent tuple may be created only after explicit acceptance of this new backend-read authority and the controlled operation gate. A preexisting exact complete tuple is NOOP; any different binding/status/profile/scope or unexplained partial state is conflict, never an update/rotation by convenience. Creation and two Grants are one Auth transaction. Use existing approved secret generation/hash/storage machinery. Deliver the new secret once to a reviewed owner-only svc-workflow service credential file outside all Agent workspaces; do not print, commit, send through chat, place in an Agent session, or modify HR/provisioning credentials. The actual service process/file ownership must be proven by the deployment preflight; no guessed existing service identity is acceptable.

### CTR-WCA-003 — Protected exact relation route

GET /api/v1/workflow-admission/principals/:principal_id/agent accepts one UUID and no body/query/list. Validate UUID syntax with existing exact resolver rules; no names, normalization, external-ref lookup or inferred target. Before target read, validate existing V1 RS256 issuer/audience/time/token_use/direct-machine profile, principal_type=service, signed sub and client_id exactly CTR-002, sole required scope CTR-001, and fresh active Principal/Client binding. Service profile requires agentId=NULL. Invalid authentication=401 UNAUTHORIZED; missing scope or non-designated valid caller=403 ACCESS_DENIED; malformed request=400 INVALID_REQUEST.

In one consistent read-only Auth transaction, query exact target UUID and reverse exact agentId, both bounded to two rows; require target type agent, status active, nonempty exact agentId and bidirectional cardinality one. Missing=404 PRINCIPAL_NOT_FOUND; wrong type=422 PRINCIPAL_NOT_AGENT; disabled=409 PRINCIPAL_DISABLED; missing agentId=409 AGENT_MAPPING_MISSING; duplicate/mismatched reverse relation=409 IDENTITY_RESOLUTION_AMBIGUOUS. Success is exactly {principalId,agentId}, preserving the stored exact Agent ID. Agent Core owns canonical syntax/existence/enabled checks; Auth never manufactures a successor.

### CTR-WCA-004 — Failure, freshness and secret boundaries

Unknown database/row/internal errors=500 IDENTITY_RESOLUTION_QUERY_FAILED; operation deadline5seconds=504 IDENTITY_RESOLUTION_TIMEOUT. No retries, repair, writes, target token issuance or logging of credentials/response secrets. Responses use Cache-Control:no-store. Only explicit nonsecret fields are selected. Service caller obtains fresh tokens for each assignment-producing command; no positive relation cache across commands. Workflow independently bounds its entire admission/commit window; Auth makes no cross-service atomicity or enduring identity promise. A late result is discarded.

### CTR-WCA-005 — Implementation and operation closure

Implementation includes one dedicated route/auth adapter reusing the existing exact query logic and V1 service issuance/verifier, the closed CCR linkage change, focused fixtures and a bounded plan/apply/verify supply runbook. No schema change, public directory, existing HR-route rewrite or provisioning permission expansion. Freeze exact changed files before implementation and independent review. Production requires accepted authority in base, exact implementation audit, focused tests, target/process/credential ownership proof, clean isolated release, preimage and shared mutation slot IDLE. No whole-main deployment.

Provisioning receipt includes public identities, two exact Grant tuples, row/hash preimages and completion status, never the secret. Unknown commit/secret-delivery outcome must be read back using the same operation ID; do not mint a replacement secret/client or replay blindly. Revoke exposure before rollback. Remove/revoke only newly introduced unused tuples; preserve preexisting rows and disable dependent admission rather than falling back to HR or unvalidated writes. Credentials that escaped a controlled handoff require explicit containment; never report success solely from an administrator prompt.

### CTR-WCA-006 — Acceptance and readiness

Each of CTR-001..005 has a discriminating Acceptance below. Consumer end-to-end proof requires the owning dsh endpoint, svc before-persist enforcement, unavailable/invalid denial with zero business writes and valid varied-personnel success. This Auth Spec does not accept another repository or complete the overall HR reconciliation Goal.

| Acceptance | Contracts | Method/environment/evidence | Expected / failure |
|---|---|---|---|
| ACC-WCA-001 |001| isolated bundle validator and issuance fixtures, exact head/results | only2entries; wrong audience/type/scope deny; unchanged unrelated bundle entries |
| ACC-WCA-002 |002| collision and transaction fault fixtures plus controlled target readback | exact1Principal/1Client/2Grants; no other delta; wrong binding or partial state deny; secret absent from output |
| ACC-WCA-003 |003| signed real-route relational fixtures | exact designated service success; HR/other service/delegated/disabled caller deny before lookup; all forward/reverse identity errors discriminate |
| ACC-WCA-004 |004| timeout/late result/write-spy/log sentinel fixtures | no writes/retry/cache; accurate500/504; no credential disclosure |
| ACC-WCA-005 |005| exact diff and bounded supply/release rehearsal plus receipt/readback | correct file closure, atomic failure, known outcome, preimage restoration or contained dependency |
| ACC-WCA-006 |006| consumer integration at pinned accepted owning heads | valid varied selection works; invalid/unavailable admission persists nothing; no premature overall completion |

## Alternatives and status

Rejected: widen existing HR grant or agent-only audience; share HR/provisioning credentials; make Workflow query Auth DB in normal commands; use unauthenticated mobile Agent list; generic identity directory; copy target permissions. These change trust beyond the required read.

STATUS=proposed. IMPLEMENTATION_ALLOWED_NOW=NO. PRODUCTION_READY=NO. The concrete new service authority is subject to explicit Owner acceptance after independent review. Exact release/preimage/caller file ownership remains an operational proof obligation, not an assumed production fact. No accepted lifecycle metadata is modified here.
