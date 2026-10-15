---
spec_id: AUTH_SERVICE_WEBSITE_INQUIRY_AUDIENCE_CCR_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/auth-service
  - two exact website inquiry Audience entries and version linkage only
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities: []
consumer_proposals:
  - repository: mayf3/dsh-agent-core
    authority_id: WEBSITE_HUMAN_WORKFLOW_INQUIRY_V1
    proposal_revision: cec853e9163dc99de09abaf3bf806755e50c2d23
    proposal_sha256: 9e13ffe2da20af1df48df1c49f7270bad86baba8081ce8ecb3c17796636bf819
    pull_request: https://github.com/mayf3/dsh-agent-core/pull/511
    status: proposed
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_WEBSITE_INQUIRY_AUDIENCE_CCR_V1

**PROPOSED — DOCS ONLY.** Authoring base
`862eab36677d214b2ce340f49bb141173b51efea`, isolated branch
`codex/website-human-inquiry-auth-ccr`, 2026-10-15. This candidate creates
no registration, Client, Principal, credential, Grant, database or runtime
change. Acceptance/merge is not deployment or consumer conformance.

## 1. Goal, scope and route

Register exactly one Human-only website inquiry audience and one
SERVICE-only private transport audience through Auth's existing generic
Audience/Client/Grant machinery. Preserve all existing token/profile,
issuer, signing, PKCE, refresh, scope and domain-authorization meanings.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
DOCS_FIRST_REQUIRED = YES
AUTHORITY_ACCEPTED_IN_BASE = NO (this new CCR)
```

Out of scope: new OAuth/API endpoint or claim; changes to existing
Audience/Scope/Grant meanings; delegation/OBO; Human scope claims; online
Grant management; Client/Principal/credential/Grant supply; production
activation; DSH/Gateway/Site behavior or accepting their proposals. This
is a DAG-root Auth registration authority; consumer proposals are context,
not accepted external authorities or reciprocal authorization.

## 2. Minimum authority and source evidence

`MINIMAL_AUTH_FOUNDATION_V2#CTR-MAFV2-001` exact-incorporates the historical
V1 modules; V2 is current, V1 is not a second current architecture.
The incorporated `grants-and-audiences.md` §§2,3,9 require versioned
Audience registration, distinct Human/Machine Grants, and governed
versioned migrations; `conformance.md` §5 explicitly permits future
SERVICE-positive conformance after an Audience CCR. Bundle README states
that changing a frozen protocol artifact requires CCR. These are the
source basis for this bounded child rather than whole-architecture
supersession. Existing accepted IDs/meanings are untouched.

- OBS-WIAC-001 — Local source inspection at the exact base on 2026-10-15:
  registry and manifest both `1.12.0`, registry status `frozen`,
  existing Audience count 12; neither new Audience is present.
  Registry SHA-256 `4cbb725bb56f1fd817e8bb2a3fd7b91d1211b5be7e7fd38654947de6a98e86e4`;
  manifest SHA-256 `b2097f32becd48e740054018719abc18c1229aeae4d58813de8fc990c7f10c27`.
  Provenance: `contract-bundles/minimal-auth-v1/{audience-registry,contract-manifest}.json`.
  Runtime registration/version remains UNOBSERVED.
- OBS-WIAC-002 — Same-base source: registry schema permits empty scopes
  for Human-only; `validate.mjs:398-407` requires nonempty scopes only for
  machine/delegated entries; `contract.ts:156-162` accepts empty string
  arrays. `human-support.ts` supports `public_browser/none` and exact
  HumanAudienceGrant; `direct.ts` validates exact resource, SERVICE
  profile, active Client/Principal, credential and the same-audience
  MachineAccessGrant before scope issuance. No new verifier is required
  by the two entries. This is source evidence, not an executed issuance.
- CLM-WIAC-001 (SUPPORTED): the requested entries fit the accepted generic
  mechanism without changing existing profile semantics.
- EVD-WIAC-001: OBS-WIAC-001/002 SUPPORT CLM-WIAC-001 at this exact Auth
  source base, sufficient for bounded CCR routing only; limitations:
  no runtime/DB/credential access and no deployed conformance claim.

## 3. Decisions

- DEC-WIAC-001 — Human and SERVICE transport use distinct exact audiences.
  Reject shared/all-services audiences, alias matching, cross-audience
  Grants and deriving one Grant kind from another.
- DEC-WIAC-002 — Reuse current generic Human public-browser PKCE and
  SERVICE client_credentials profiles. Reject a Human scope claim,
  Gateway-issued identity, an Agent/MCP identity substitute or new Auth
  architecture solely to register compatible entries.
- DEC-WIAC-003 — Append-only source version candidate `1.12.0 -> 1.13.0`;
  registration acceptance supplies no Client/Grant or production mandate.

## 4. Contracts

### CTR-WIAC-001 — Exact Human-only registration

The added entry MUST equal:

```json
{
  "audience_id": "agent-core-website-human-v1",
  "resource_service": "agent-core-website-human-v1",
  "scope_namespace": "agent-core-website-human",
  "accepted_principal_types": ["user"],
  "human_access_enabled": true,
  "machine_access_enabled": false,
  "delegated_access_enabled": false,
  "registered_scopes": [],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_WEBSITE_INQUIRY_AUDIENCE_CCR_V1 for website Human inquiry access; no Machine or Delegation access and no Human scope claim."
}
```

Empty scopes are exact, not unknown. The namespace is a structural field,
not an entitlement. Human issuance still requires an active original User,
valid registered HumanClient, exact redirect, S256 and that exact Client's
HumanAudienceGrant. No Machine credential or Grant can obtain this Human
audience. No scope is added to the Human token/profile.

### CTR-WIAC-002 — Exact SERVICE-only transport registration

The added entry MUST equal (scopes are unsigned-ASCII sorted):

```json
{
  "audience_id": "agent-core-website-transport-v1",
  "resource_service": "agent-core-website-transport-v1",
  "scope_namespace": "conversation",
  "accepted_principal_types": ["service"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": [
    "conversation.intent.redeem",
    "conversation.own_events.read",
    "conversation.own_result.read"
  ],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_WEBSITE_INQUIRY_AUDIENCE_CCR_V1 for original-controller redeem and caller-bound inquiry result/event reads; Service direct-machine access only."
}
```

Scope registration is independent: redeem permits requesting transport of
an existing Human-authorized inquiry; own_result.read and own_events.read
permit only that transport caller's bound request projections. DSH owns
and independently enforces those business/object relations. No scope means
read-all, arbitrary send, Human authorization, Workflow lookup, session
history, admin or one of the other two operations. Auth issues registered
scope claims; it neither reads DSH data nor accepts a consumer proposal.

### CTR-WIAC-003 — Exact resource, profile and Grant enforcement

Existing issuance law MUST remain unchanged. Machine `resource` is the
exact `agent-core-website-transport-v1`; requested scopes MUST be a
nonempty, namespace-valid subset of that exact Client's same-audience
MachineAccessGrant and of CTR-WIAC-002. Unknown/alias/case-variant audience,
Agent principal, Human/delegated profile, missing/revoked Client/Principal,
invalid credential, absent Grant, registry/DB drift, empty/duplicate/
wildcard/unknown/wrong-namespace scope or mixed granted+ungranted request
MUST deny the whole issuance, never trim or fall back. The three scopes
are independent; any permitted subset uses existing canonical ASCII wire
format. DSH's one-operation request cannot create a new Auth scope rule.

Human `audience` is exact CTR-WIAC-001 and requires its HumanAudienceGrant;
being logged in or holding a Machine Grant grants neither another
Human audience nor a scope claim. Service tokens have no agent_id,
Human identity, product role or refresh credential. Existing issuer,
RS256/JWKS, TTL, jti/time, refresh and error taxonomy remain unchanged.
Audience possession never establishes SiteOwner/binding/Workflow ACL.

### CTR-WIAC-004 — Version linkage and bounded future source closure

At this base, propose Bundle/registry `1.12.0 -> 1.13.0`, keeping status
`frozen`; append only the two exact entries, preserving every prior entry
byte-equivalently and all old fixture assertions. Update linked version,
digest and fixture declarations coherently; runtime adds only the new
version to its existing compatibility allow-list. A future implementation
MUST fresh-read the base and accepted sibling reservations: occupied
1.13.0 requires the next free minor and a newly pinned/reviewed exact
source delta with unchanged entry semantics, never an in-place version
disguise or overwrite. Source version is never a production version claim.

After exact acceptance in base, the bounded implementation closure is:

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
tests/oauth/website-inquiry-audience-v1.test.ts
```

Validator delta is only the closed Audience set's two-entry addition and
focused exact-entry/fixture assertions, not deleting/replacing any prior
validation. The old session-inspection test permits only version-label/
assertion updates to the resolved new Bundle version; its exact existing
Audience, scope, fixture and negative behavior assertions stay intact.
No generic token, OAuth, DB schema/migration, credential, API or accepted
Spec file change is authorized by this closure. Additional files or a
semantic departure require re-PREFLIGHT before implementation.

### CTR-WIAC-005 — No supply or production authority

Candidate Client names are `project-progress-desk-web-v1`
(`public_browser`, client_authentication_method `none`, no secret) and
`agent-control-website-inquiry-v1` (SERVICE machine transport). They are
context only, not existing-registration facts, recipient binding or supply
authority. The Website exact redirect and actual existing Human/transport
identities/roles remain UNOBSERVED; no guessed values may fill them.

Before any Client/Grant/security configuration operation, the original
authorized operator MUST obtain separately attributable concrete Owner
confirmation of exact target identities, audience/scopes, redirect, actor,
environment, operation, preimage, Secret handling and receipt/rollback.
Existing accepted migration/audit/CAS law governs: exact-source versioned
migration, same-transaction audit and forward-only Grant revocation; no
online Grant API, raw SQL repair, copied credential or implicit grant from
this CCR. Existing exact state is verified NOOP; drift/unknown fails
closed for original read-only reconciliation, never blind replay.

This CCR grants zero production apply, DB, Client, Principal, credential,
Grant or deployment authority. Later registry activation and any supply
need their original controlled operation mandate and independently checked
executable/DB equality; no service may operate on mixed Audience state.
Rollback must preserve prior Audience/Grant semantics and use separately
authorized exact artifacts; no unreviewed deletion, larger-Grant restore
or changed consumer role. Evidence contains only nonsecret coordinates,
versions/digests/status/scope sets and bounded result classifications.

## 5. Future Acceptance (NOT RUN)

| Acceptance | Contracts | Method / environment / required evidence | Expected / failure |
|---|---|---|---|
| ACC-WIAC-001 | CTR-WIAC-001, CTR-WIAC-003 | isolated signed Human fixtures and real generic issuer path, disposable DB; exact version/profile/grant coordinates with no raw tokens | valid public_browser/S256/exact redirect/Human grant issues unchanged scopeless Human profile; no grant, Machine/Agent/delegated/wrong audience/client/redirect denies; any invented scope or cross-audience grant is failure |
| ACC-WIAC-002 | CTR-WIAC-002, CTR-WIAC-003 | isolated SERVICE signed fixtures/direct issuer; each single scope and legal subsets; missing/revoked client/principal/grant, invalid credential, registry drift, aliases/wildcards/duplicate/unknown/mixed scopes; capture finite classifications | only exact resource/profile and fully granted set issues, Service has no agent_id/refresh; any partial trim, Agent acceptance, cross-audience or implied scope fails |
| ACC-WIAC-003 | CTR-WIAC-004 | exact source diff, Bundle validator, runtime loader and focused regression fixtures; record resolved source version/digests and untouched prior entries | exactly two entries, coherent append-only minor/linkage and bounded 15-file closure; stale 1.12 assumptions, weakened old guards, collision or extra file fails |
| ACC-WIAC-004 | CTR-WIAC-005 | docs/implementation review plus write spies in isolated fixture; exact mandate/receipt review only in a separately authorized operation | authoring/registration creates no Client/Grant/credential/production effect; proposed names not claimed provisioned; unauthorized write or secret evidence fails |

All five Contracts have Acceptance coverage; every Acceptance references
existing Contracts. Definitions are not executed conformance. Acceptance
is independent exact-head Owner lifecycle action, never author assertion.

## 6. Authoring status and stop boundary

```text
STATUS = proposed
CONTRACT_COUNT = 5
CONTRACTS_WITH_ACCEPTANCE = 5
OPEN_OWNER_DECISIONS = NONE for these two proposed registration entries
NORMATIVE_TBD = NONE for the bounded registry/source delta
PARTIAL_SUPERSESSION = NONE
AUTHORING_READY_FOR_REVIEW = YES
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_ALLOWED_NOW = NO
NEXT_ACTION = REVIEW
```

No whole-authority successor is required by these entries: the incorporated
mechanism explicitly admits a new SERVICE Audience via CCR and already
supports a scopeless Human-only profile. If review or implementation needs
to alter an existing accepted profile/claim/Grant/lifecycle meaning, this
CCR's route stops at re-PREFLIGHT; it cannot authorize that change itself.
