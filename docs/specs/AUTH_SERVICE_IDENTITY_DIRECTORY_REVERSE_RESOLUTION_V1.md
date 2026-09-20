---
spec_id: AUTH_SERVICE_IDENTITY_DIRECTORY_REVERSE_RESOLUTION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/auth-service
  - exact agentId → exact Auth Agent Principal reverse directory read under the existing identity-directory audience
governed_by: [MINIMAL_AUTH_FOUNDATION_V2]
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
accepted_by: mayf3
accepted_date: 2026-09-21
accepted_reviewed_spec_commit: cf9b474
acceptance_review_verdict: PASS
acceptance_review: independent two-round semantic review (round-1 head e48305c = REVISE / 1 blocker REQUIRED_GATE_FAILURE on closure determinism; fix applied exactly as MINIMAL_CLOSURE; round-2 head cf9b474 = ACCEPT / 0 blockers, reviewer = independent Agent not authoring the change, SPEC_GOVERNANCE_MODE=REVIEW)
acceptance_record: Owner exact-head acceptance via GOAL AGENT_PRINCIPAL_REVERSE_LOOKUP_DELIVERY_V1 (OWNER_DECISION APPROVE_NARROW_REVERSE_READ_PATH, 2026-09-21) — persistent Owner authorization; residuals carried as follow-ups (parent-family malformed-status harmonization; parent Spec index row)
---

# AUTH_SERVICE_IDENTITY_DIRECTORY_REVERSE_RESOLUTION_V1

## Goal, route and authority

Expose the exact Agent→Principal relation as one minimal reverse directory read,
`GET /api/v1/directory/agents/:agent_id/principal`, under the EXISTING
`identity-directory` audience and `auth.directory.read` scope, so an authenticated
canonical internal caller can resolve one exact Agent ID to its exact stored Auth
Agent Principal UUID without any second identity registry, cache, or manual mapping.
Auth remains the sole Principal-mapping owner. This Spec adds ONE bounded read
surface; it changes no existing route, registration, Grant, or schema.

Owner direction 2026-09-21 (GOAL `AGENT_PRINCIPAL_REVERSE_LOOKUP_DELIVERY_V1`,
decision `APPROVE_NARROW_REVERSE_READ_PATH`):

```text
NEW_IDENTITY_REGISTRY = FORBIDDEN
NEW_SCOPE = FORBIDDEN
NEW_AUDIENCE = FORBIDDEN
PROVISIONING_SCOPE_FOR_MODEL_READ = FORBIDDEN
TARGET_AUTH_BOUNDARY = identity-directory × auth.directory.read
STRICT_CANONICAL_CLAIM = FORBIDDEN_UNTIL_CANONICAL_LIFECYCLE_IS_PRODUCTION_EFFECTIVE
```

The fresh recovery investigation accepted by the Owner established: the stored
Agent↔Principal relation is unique for the canary fleet, the Auth Principal UUID is
the Workflow Principal UUID (frozen OBO/JWKS contracts), and no model-facing
agentId→UUID read exists under any non-provisioning boundary. This Spec is the
narrow Auth-side half of that approved delivery.

DEVELOPMENT_PREFLIGHT: AUTHORITY_ACTION=NEW; PLAN_LEVEL=BRIEF;
ASSURANCE_LEVEL=CONTROLLED; DOCS_FIRST_REQUIRED=YES.
Base: `f00dab7` (github/main; governance v1.1.0 adopted).
Implementation is forbidden until this exact accepted revision is present in the
integration base.

## Evidence and decisions

OBS-IDR-001 (fresh, production read-only): `GET /api/v1/principals/by-external-ref`
is production-effective but gated by `v1ManagementAuth`
(`svc-auth` × `auth.identity.provision`); production Grant census shows only two
provisioning SERVICE clients hold that scope and no Agent does. Reusing it for a
model-triggered read would require a forbidden provisioning-scope expansion.

OBS-IDR-002 (fresh, production read-only): for the two canary Agent IDs
(`agt_travel-planner-agent`, `agt_search-expert-agent`) the `machine_principals`
table holds exactly one row each (`principal_type='agent'`, `status='active'`,
`external_ref` exactly `agentcore:v1:principal:<agentId>`).

OBS-IDR-003 (accepted authority, CTR-AID-003): the identity-directory route family
already returns `principalStatus` ∈ {active, disabled} as observable directory data
(a disabled target is 200 data, not an error) and freezes the forward route to
"one exact UUID and no body/query/list … no external-ref lookup". This Spec adds a
sibling read in the same family; it does not amend the forward contract.

OBS-IDR-004 (accepted authority): `resolveCanonicalByAgent`
(AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1) has
`production_apply_authority: none` and no HTTP seam. This route therefore exposes
the production-effective STORED identity relation only. It MUST NOT be described or
documented as strict-canonical-lifecycle verified anywhere, including downstream
consumer tooling.

DEC-IDR-001 (Owner): the reverse read lives under
`identity-directory` × `auth.directory.read`; no new scope, audience, registry,
cache, mapping table, or Grant supply is created. Callers already hold the baseline
directory-read Grant (CTR-AID-002); no per-consumer grant decision is required.

DEC-IDR-002: the read targets the stored `machine_principals.agentId` exact
relation directly. It MUST NOT route through, reuse, or extend the external_ref
resolver (`resolution.ts`) and MUST NOT fall back to display names, substrings,
prefixes, or any inferred target.

DEC-IDR-003 (semantic correction, Owner): the downstream Agent Core capability is
named `agent_resolve_principal_by_agent` (not `agent_resolve_canonical_principal`)
because the strict canonical lifecycle foundation is not production-effective.
This Spec's route likewise claims only "exact Agent ID → exact stored Auth Agent
Principal".

## Contracts

### CTR-IDR-001 — Closed additive surface, zero registrations

No new audience, scope, Grant, schema, migration, registry, cache, or mapping is
created. The existing `identity-directory` audience row (CTR-AID-001) and caller
authorization law (CTR-AID-002) apply unchanged. No existing route, middleware, or
error contract is modified. The implementation is additive: one new resolver
function, one new error-code pair, one new route in the existing identity-directory
router, one new test file, and documentation.

### CTR-IDR-002 — Caller authorization (inherited verbatim)

The route accepts any currently-active canonical internal principal exactly as
CTR-AID-002 defines: V1 RS256 direct-machine profile, exact single audience
`identity-directory`, exact required scope `auth.directory.read`, principal types
agent and service, fresh caller Principal and Client state requiring both active
and the client exactly bound to the signed sub. Invalid authentication = 401
UNAUTHORIZED; otherwise-valid caller missing the scope = 403 ACCESS_DENIED before
any target read. The caller check runs inside the whole-operation deadline and
before any target identity query.

### CTR-IDR-003 — Exact reverse route

`GET /api/v1/directory/agents/:agent_id/principal` accepts one exact canonical
Agent ID path parameter and no body, no query parameters, and no body-framing
headers (content-length other than absent/empty/0, or any transfer-encoding, are
rejected before any target read, mirroring the family rule).

The exact Agent ID grammar is the accepted stored-id grammar
`^agt_[a-z0-9-]+$` with length 5..128 (the canonical-identity `validAgent`
grammar). Malformed input = 400 INVALID_AGENT_ID before any target read.

In one consistent read-only Serializable transaction, query
`machine_principals` by exact `agentId` equality with a two-row bound:

| Result | Response |
|---|---|
| 0 rows | 404 `AGENT_NOT_FOUND` |
| >1 rows | 409 `IDENTITY_RESOLUTION_AMBIGUOUS` |
| row `agentId` not exactly equal to the requested id | 409 `IDENTITY_RESOLUTION_AMBIGUOUS` |
| row `principalType` not `agent` | 422 `PRINCIPAL_NOT_AGENT` |
| row `id` not a well-formed UUID | 500 `IDENTITY_RESOLUTION_QUERY_FAILED` |
| row `status` not `active`/`disabled` (malformed row) | 500 `IDENTITY_RESOLUTION_QUERY_FAILED` |
| exactly one well-formed agent row | 200 (below) |

Success returns exactly `{principalId, agentId, principalStatus}` where
`principalId` is the stored lowercase Principal UUID, `agentId` is the stored
exact Agent ID, and `principalStatus` ∈ {`active`, `disabled`}. A disabled target
returns 200 with `principalStatus='disabled'` (directory semantics; consumers
reject non-active themselves). Database uniqueness is never trusted in place of
the two-row bound. No display name, email, external_ref, client, grant, scope
inventory, credential, hash, token, or owner metadata is ever selected or
returned. Database failure = 500 `IDENTITY_RESOLUTION_QUERY_FAILED`; the response
carries only the error code.

STRICT_CANONICAL boundary: this route resolves the production-effective stored
identity relation. It performs no lifecycle, successor, or canonical-state
verification and its documentation and consumers MUST NOT claim strict canonical
lifecycle semantics.

### CTR-IDR-004 — Failure, freshness and secret boundaries

Whole-operation deadline 5 seconds covers caller authentication/reads and the
target relation query; a late result after the deadline is discarded and answered
504 `IDENTITY_RESOLUTION_TIMEOUT`. No retries, no writes, no token issuance, no
positive-relation cache across commands, no credential logging. Responses use
`Cache-Control: no-store`. Only explicit nonsecret fields are selected.
Consumers bound their own admission/commit windows; Auth claims no cross-service
atomicity.

### CTR-IDR-005 — Implementation closure

Exact changed-file set (bounded; no other file may change):

| File | Change |
|---|---|
| `docs/specs/AUTH_SERVICE_IDENTITY_DIRECTORY_REVERSE_RESOLUTION_V1.md` | this Spec |
| `docs/specs/README.md` | one index row (carried by the acceptance docs-only change, not the implementation change) |
| `src/lib/oauth/v1/agent-principal-resolution.ts` | additive: the exported `AgentPrincipalResolutionErrorCode` union gains exactly the two named members `INVALID_AGENT_ID` and `AGENT_NOT_FOUND` (no existing member removed, renamed, or re-semantics; existing function signatures and behavior unchanged), plus new exports `parseAgentIdParam` and `resolveAgentIdPrincipalDirectory` mirroring the shared exact-read core |
| `src/routes/workflow-admission.ts` | additive: second GET route on the existing router reusing the existing middleware/deps/deadline machinery |
| `tests/oauth/identity-directory-reverse-resolution.test.ts` | new executable contract tests |

The only delta to any existing export is the two-member union extension named
above; every other delta in the two code files is purely additive.

No schema change, no middleware change, no registry change, no provision
permission expansion, no whole-main deployment. Production requires accepted
authority in base, focused tests, and a controlled deployment through the
existing Production Deployment Control Plane with durable readback.

### CTR-IDR-006 — Acceptance boundary

| Acceptance | Contracts | Method/environment/evidence | Expected / failure |
|---|---|---|---|
| ACC-IDR-001 | 002 | real signed V1 fixtures: agent caller, service caller, disabled caller, revoked client, binding drift, wrong audience, wrong scope, missing token | valid agent+service callers reach the target read; every invalid profile denied before any target read (401/403) |
| ACC-IDR-002 | 003 | signed real-route relational fixtures (synthetic identities; NO production canary UUID constants) | exact agentId success (active and disabled); malformed id 400; unknown 404; duplicate 409; non-agent 422; malformed row 500; extra query/body/framing 400; response keys exactly {principalId, agentId, principalStatus} |
| ACC-IDR-003 | 004 | timeout/late-result/write-spy/log-sentinel fixtures over injected databases | WRITE_COUNT=0; TOKEN_ISSUANCE_SIDE_EFFECT=0; no cache; accurate 500/504; no field beyond the contract |
| ACC-IDR-004 | 005 | exact diff vs frozen closure | bounded file set; the sole existing-export delta is the `AgentPrincipalResolutionErrorCode` union gaining exactly `INVALID_AGENT_ID` + `AGENT_NOT_FOUND`; all existing union members' values and all existing function signatures/behavior unchanged; every other code delta additive-only |
| ACC-IDR-005 | all | production deployment readback through the control plane | live route fail-closed unauthenticated (401); authorized positive readback consistent with the authoritative store |

## Alternatives and status

Rejected: reusing `by-external-ref` for model reads (provisioning scope — Owner
forbidden); a new reverse audience or scope (Owner forbidden); reading the
svc-workflow `principals` table (downstream projection, not the identity
authority); display-name/prefix/fuzzy lookup (forbidden); exposing
`resolveCanonicalByAgent` now (strict canonical lifecycle not
production-effective; semantic correction DEC-IDR-003); a second identity
registry or cache-as-authority (forbidden).

Acceptance obligation: the acceptance transaction must record the independent
semantic review verdict and the exact reviewed head in this frontmatter, and add
this Spec to `docs/specs/README.md` in the same docs-only change.

STATUS=accepted (2026-09-21; reviewed head cf9b474; independent review ACCEPT/0
blockers after one closed round-1 blocker). Implementation proceeds under
`implementation_authority: contracts` within CTR-IDR-001..005 only; production
apply remains a separately authorized controlled operation.
