---
spec_id: AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
    revision: d83a2ff0e9644611707d7481ef88b4d7d49fb68e
    relation: interoperates_with
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_BINDING_WORKSPACE_V1
    revision: d83a2ff0e9644611707d7481ef88b4d7d49fb68e
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1

## 1. Goal

Establish one bounded, authenticated, deterministic, **read-only** Auth identity
discovery seam for Agent Core deterministic `external_ref` values so trusted operators
can observe whether the exact Principal and Client already exist before any credential
provisioning or reconciliation decision. This discovery seam does not replace fresh
resolution of a known stored Client ID through the parent-authority route
`GET /api/v1/clients/:client_id`.

This Spec authorizes **no implementation while proposed**. After independent review,
Owner acceptance, and merge to `main`, its Contracts may authorize only the exact
three-file implementation closure in `CTR-RES-009`.

Frozen target:

```text
principal external_ref = agentcore:v1:principal:<agent_id>
client external_ref    = agentcore:v1:client:<agent_id>

QUERY_ONLY = YES
EXTERNAL_REF_IDENTITY_DISCOVERY = PROVIDED_BY_THIS_SPEC
KNOWN_CLIENT_ID_FRESH_RESOLUTION = REMAINS_GOVERNED_BY_PARENT_AUTHORITY
PHASE_B_COMPLETE = NO_UNLESS_ALL_OTHER_ACCEPTED_PREREQUISITES_ARE_SATISFIED
IDENTITY_MUTATION = FORBIDDEN
CLIENT_SECRET_RETURN = FORBIDDEN
GRANT_QUERY_OR_MUTATION = OUT_OF_SCOPE
```

The seam exists only to replace mutation-capable observation through `POST` ensure
routes or direct production-DB inspection. Presence never implies activation,
credential readiness, Grant readiness, or implementation authorization.

## 2. Scope and non-goals

### In scope

- exact authenticated Principal lookup by deterministic Agent Core principal
  `external_ref`;
- exact authenticated Client lookup by deterministic Agent Core client
  `external_ref`;
- explicit `PRESENT` / `ABSENT` result;
- fail-loud ambiguous-result handling even though current schema declares
  `external_ref` unique;
- explicit projection allowlists that cannot return client secret material;
- proof that lookup performs no Principal, Client, Grant, credential, audit, or other
  persistent mutation;
- exact implementation file closure and Acceptance evidence.

### Non-goals

- Principal or Client create / claim / update / disable / revoke;
- client secret rotation or recovery;
- returning `secret_hash`, raw secret, token, password, key, credential reference, or
  any other credential material;
- Grant listing, Grant mutation, Audience mutation, Scope mutation, or authorization
  decision;
- generic identity search, prefix search, fuzzy search, pagination, list-all, or batch
  lookup;
- production deployment, production database migration, production data apply, or
  Trusted Fleet Cutover execution;
- replacing or redefining parent-authority fresh resolution of a known `stored.clientId`
  through `GET /api/v1/clients/:client_id`;
- declaring Phase B complete merely because external-ref identity discovery exists;
- changing `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Phase A / Phase B semantics;
- expanding Agent existence authority beyond Agent Definition.

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2 (accepted)
PROCESS_AUTHORITY = AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1 (accepted)
EXTERNAL_INTEROP_AUTHORITY = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
EXTERNAL_GRAMMAR_AUTHORITY = AGENT_CORE_BINDING_WORKSPACE_V1
EXTERNAL_REVISION = d83a2ff0e9644611707d7481ef88b4d7d49fb68e
```

`MINIMAL_AUTH_FOUNDATION_V2` preserves the incorporated V1 identity model while
changing migration / hard-cut / sequencing meaning only. It does not itself grant an
implementation round for a new read-only API surface. Repository-local governance
requires a merged accepted governing Spec with `implementation_authority: contracts`
for non-mechanical identity/API work. Therefore this new bounded Child is required.

The external Agent Core authority requires read-only Auth resolution before Phase B
existing-credential reconciliation. This Spec provides only the discovery direction
`agent_id -> deterministic external_ref -> Principal/Client identity observation`.
The parent Minimal Auth authority continues to govern the separate fresh-resolution
direction `stored.clientId -> GET /api/v1/clients/:client_id`. This Spec neither replaces
that route nor, by itself, closes every Phase B credential-resolution prerequisite. It
does not grant Agent Core implementation or fleet mutation authority.

Authentication reuses the existing management boundary:

```text
middleware = v1ManagementAuth
audience   = svc-auth
scope      = auth.identity.provision
```

No new Audience or Scope is introduced. Reusing this boundary does not authorize any
new mutation; the two routes below remain query-only.

## 4. Current State

- `STATE-RES-001` — At `mayf3/auth-service@7cd4b60c31407648f5288ff5d5a5570e4449fadb`,
  the generic V1 identity management router exposes mutation-capable idempotent
  `POST /api/v1/principals` and `POST /api/v1/clients`, but no exact read-only
  `external_ref` resolution route. Basis: `OBS-RES-001`, `CLM-RES-001`.

- `STATE-RES-002` — At the same revision, both `MachinePrincipal.externalRef` and
  `MachineClient.externalRef` are nullable unique columns. Basis: `OBS-RES-002`.

- `STATE-RES-003` — `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` at accepted
  revision `d83a2ff0e9644611707d7481ef88b4d7d49fb68e` freezes Phase B existing-credential
  reconciliation as requiring read-only Auth resolution before S1/S2 or store writes;
  its known-credential path requires fresh resolution of `stored.clientId`. Basis:
  `OBS-RES-003`, `CLM-RES-002`, `CLM-RES-003`.

- `STATE-RES-004` — At the same accepted Agent Core revision,
  `AGENT_CORE_BINDING_WORKSPACE_V1` normatively freezes Agent ID as one ASCII safe
  component over `[A-Za-z0-9_-]` with length `1..200`, rejecting rather than reshaping
  invalid input. Basis: `OBS-RES-004`, `CLM-RES-004`.

- `STATE-RES-005` — Parent authority `MINIMAL_AUTH_FOUNDATION_V2` continues to govern
  `GET /api/v1/clients/:client_id` as the fresh resolution surface for a known public
  Client ID. Basis: `OBS-RES-005`, `CLM-RES-003`.

- `STATE-RES-006` — At pinned source revision
  `mayf3/dsh-agent-core@d83a2ff0e9644611707d7481ef88b4d7d49fb68e`, the
  `sanitizeAgentId` / `INVALID_AGENT_ID_RE` implementation accepts a wider character set
  than the accepted grammar. The source divergence is known and does not amend the
  governing grammar. Basis: `OBS-RES-006`, `CLM-RES-004`.

## 5. Observations

### OBS-RES-001 — Current V1 identity router is POST-only

- Subject: `src/routes/idempotent.ts`.
- Source revision: `mayf3/auth-service@7cd4b60c31407648f5288ff5d5a5570e4449fadb`.
- Environment: repository `main` source tree.
- Observed at: `2026-08-22`.
- Method: inspect mounted V1 idempotent router.
- Result: route definitions are `POST /v1/principals` and `POST /v1/clients`; both
  call `createOrGet*` mutation-capable services and may create objects.
- Provenance: named source file at exact revision.

### OBS-RES-002 — Exact `external_ref` keys are schema-unique

- Subject: `MachinePrincipal` and `MachineClient` Prisma models.
- Source revision: `mayf3/auth-service@7cd4b60c31407648f5288ff5d5a5570e4449fadb`.
- Environment: repository `main` source tree.
- Observed at: `2026-08-22`.
- Method: inspect `prisma/schema.prisma`.
- Result: both `externalRef` fields have `@unique`; Client also stores
  `machinePrincipalId` and public `clientId`, while secret material is a separate
  `secretHash` field.
- Provenance: named schema at exact revision.

### OBS-RES-003 — Agent Core Phase B names read-only resolution as prerequisite

- Subject: `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Amendment 6.
- Source revision: `mayf3/dsh-agent-core@d83a2ff0e9644611707d7481ef88b4d7d49fb68e`.
- Environment: accepted external governing Spec.
- Observed at: `2026-08-22`.
- Method: inspect accepted Phase A / Phase B boundary and D.7.3.
- Result: Phase B existing credential reconciliation requires Auth read-only resolution
  before S1/S2 and before store mutation; the known-credential path specifically requires
  fresh resolution of `stored.clientId`; current absence is explicitly a blocker.
- Provenance: external accepted Spec at exact revision.

### OBS-RES-004 — Agent Core has an existing authoritative Agent ID grammar

- Subject: accepted `AGENT_CORE_BINDING_WORKSPACE_V1` `SANITIZE_REUSABLE` contract and
  `WorkspaceIdValidation`, which explicitly freeze the Agent ID safe-component grammar.
- Source revision: `mayf3/dsh-agent-core@d83a2ff0e9644611707d7481ef88b4d7d49fb68e`.
- Environment: accepted external governing Spec.
- Observed at: `2026-08-22`.
- Method: inspect the accepted normative grammar.
- Result: a legal Agent ID is an ASCII string of length `1..200` containing only
  `[A-Za-z0-9_-]`; invalid, whitespace, separator, dot, NUL, absolute, and overlong inputs
  are rejected without truncation, reshaping, or normalization.
- Provenance: accepted `AGENT_CORE_BINDING_WORKSPACE_V1` at the exact pinned revision.

### OBS-RES-005 — Parent authority owns known-Client-ID resolution

- Subject: `MINIMAL_AUTH_FOUNDATION_V2` `CTR-MAFV2-011`.
- Source revision: parent authority incorporated by this Spec's reviewed base.
- Environment: accepted local Architecture authority.
- Observed at: `2026-08-22`.
- Method: inspect the frozen Cut-introduced surface classification.
- Result: `GET /api/v1/clients/:client_id` remains the named resolution surface for a
  known public Client ID; this Child does not supersede that parent Contract.
- Provenance: `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md`.

### OBS-RES-006 — Pinned `sanitizeAgentId` source is wider than the accepted grammar

- Subject: `packages/workspace-bootstrap/src/paths.js` `sanitizeAgentId` and
  `INVALID_AGENT_ID_RE`.
- Source revision: `mayf3/dsh-agent-core@d83a2ff0e9644611707d7481ef88b4d7d49fb68e`.
- Environment: pinned external source tree.
- Observed at: `2026-08-22`.
- Method: compare the implementation's actual rejection predicate with the accepted
  `[A-Za-z0-9_-]`, length `1..200` grammar in `OBS-RES-004`.
- Result: `INVALID_AGENT_ID_RE` rejects NUL, `/`, `\\`, space, and dot, but does not
  enforce the complete ASCII allowlist; therefore values such as `@`, `:`, `+`, and
  Chinese characters can pass this implementation despite being invalid under the
  accepted grammar.
- Provenance: named source file at the exact pinned revision.
- Limitation: this implementation observation describes divergence only. It is not
  evidence that the wider input language is valid and does not amend accepted authority.

## 6. Claims and assumptions

### CLM-RES-001 — Existing POST ensure cannot serve as a safe observation seam

- Support state: SUPPORTED.
- Supported by evidence: `EVD-RES-001`.
- Contradicted by evidence: none known.
- Uncertainty: none for the exact observed source revision.

### CLM-RES-002 — A bounded exact-key GET seam provides external-ref identity discovery without expanding mutation authority

- Support state: SUPPORTED.
- Supported by evidence: `EVD-RES-002`, `EVD-RES-003`.
- Contradicted by evidence: none known.
- Uncertainty: this seam does not replace known-Client-ID fresh resolution and does not,
  by itself, complete Phase B; future implementation still requires exact-revision
  independent review and conformance, and this Claim does not declare production deployment.

### CLM-RES-003 — Parent known-Client-ID fresh resolution remains independently required

- Support state: SUPPORTED.
- Supported by evidence: `EVD-RES-003`, `EVD-RES-005`.
- Contradicted by evidence: none known.
- Uncertainty: Phase B completion additionally depends on every other prerequisite of the
  accepted external authority; this Child evaluates none of those prerequisites.

### CLM-RES-004 — Accepted grammar governs despite the pinned implementation divergence

- Support state: SUPPORTED.
- Supported by evidence: `EVD-RES-004`.
- Contradicted by evidence: none known; `OBS-RES-006` is implementation drift, not
  normative counter-authority.
- Uncertainty: a future Agent Core authority may version the grammar; such a change would
  require a separately reviewed Spec update rather than permissive interpretation here.
  Repair of the upstream validator is outside this Child.

## 7. Evidence relations

### EVD-RES-001 — Router observation supports the mutation-risk Claim

- Source observations: `OBS-RES-001`.
- Target: `CLM-RES-001`.
- Relation: SUPPORTS.
- Bound coordinates: `auth-service@7cd4b60c31407648f5288ff5d5a5570e4449fadb`.
- Strength/sufficiency: direct source evidence.
- Limitations: does not evaluate unmerged branches.
- Provenance: named route file.

### EVD-RES-002 — Unique-key schema supports deterministic exact resolution

- Source observations: `OBS-RES-002`.
- Target: `CLM-RES-002`.
- Relation: SUPPORTS.
- Bound coordinates: `auth-service@7cd4b60c31407648f5288ff5d5a5570e4449fadb`.
- Strength/sufficiency: direct persistence-model evidence.
- Limitations: implementation must still fail loud if a corrupted or mocked source
  produces more than one row.
- Provenance: Prisma schema.

### EVD-RES-003 — External Phase B need supports bounded discovery but preserves the separate known-ID prerequisite

- Source observations: `OBS-RES-003`.
- Target: `CLM-RES-002`, `CLM-RES-003`, `STATE-RES-003`.
- Relation: SUPPORTS.
- Bound coordinates: `dsh-agent-core@d83a2ff0e9644611707d7481ef88b4d7d49fb68e`.
- Strength/sufficiency: direct accepted external authority.
- Limitations: supports external-ref discovery as one seam only; does not prove known-ID
  fresh resolution, complete Phase B, or grant local auth-service implementation authority.
- Provenance: external accepted Spec.

### EVD-RES-004 — Accepted authority governs while source comparison records divergence

- Source observations: `OBS-RES-004`, `OBS-RES-006`.
- Target: `CLM-RES-004`, `STATE-RES-004`, `STATE-RES-006`.
- Relation: SUPPORTS.
- Bound coordinates: `dsh-agent-core@d83a2ff0e9644611707d7481ef88b4d7d49fb68e`.
- Strength/sufficiency: direct accepted governing grammar plus exact-revision source
  comparison proving the implementation's wider acceptance set.
- Limitations: the `sanitizeAgentId` implementation is not evidence for grammar
  correctness and cannot be the future Auth GET routes' sole validator. It does not
  authorize Auth to broaden, normalize, or version Agent IDs.
- Provenance: accepted `AGENT_CORE_BINDING_WORKSPACE_V1` and named external source at the
  pinned revision.

### EVD-RES-005 — Parent Contract preserves known-Client-ID resolution authority

- Source observations: `OBS-RES-005`.
- Target: `CLM-RES-003`, `STATE-RES-005`.
- Relation: SUPPORTS.
- Bound coordinates: accepted local parent authority on the reviewed base.
- Strength/sufficiency: direct parent Contract.
- Limitations: does not assert implementation, deployment, readiness, or satisfaction of
  any external Phase B prerequisite.
- Provenance: `MINIMAL_AUTH_FOUNDATION_V2` `CTR-MAFV2-011`.

## 8. Decisions

### DEC-RES-001 — Add two exact authenticated GET resolution routes

- Decision owner: `mayf3`.
- Decision:

  ```text
  GET /api/v1/principals/by-external-ref?external_ref=<exact>
  GET /api/v1/clients/by-external-ref?external_ref=<exact>
  ```

  Both routes use `v1ManagementAuth`. They are query-only. The complete query string
  MUST contain exactly one key named `external_ref` with exactly one scalar value; a
  missing, duplicated, multi-value, or additional query parameter is rejected before
  identity lookup.
- Rejected alternative: use POST `createOrGet*` as a query.
- Reason: observation must never create, claim, update, rotate, or otherwise mutate.

### DEC-RES-002 — Restrict lookup to deterministic Agent Core external refs

- Decision owner: `mayf3`.
- Decision:
  - Reuse the accepted `AGENT_CORE_BINDING_WORKSPACE_V1` normative grammar at pinned
    external revision `d83a2ff0e9644611707d7481ef88b4d7d49fb68e`: `agent_id` is
    ASCII `[A-Za-z0-9_-]`, length `1..200`, with rejection rather than normalization.
    The divergent `sanitizeAgentId` implementation is not the grammar authority.
  - Principal route accepts only
    `agentcore:v1:principal:<valid-agent-id>`.
  - Client route accepts only
    `agentcore:v1:client:<valid-agent-id>`.
  - Empty/whitespace values, `*`, wildcard syntax, extra colon, malformed or cross-kind
    prefixes, and every suffix outside the frozen Agent ID grammar are invalid.
  - Matching is exact string equality only.
- Rejected alternative: generic arbitrary external-ref search, prefix scan, fuzzy
  search, list, or batch lookup.
- Reason: close only the Trusted Fleet / Agent Core observation blocker.

### DEC-RES-003 — Return explicit state and a closed projection

- Decision owner: `mayf3`.
- Decision: return `PRESENT` or `ABSENT`; `PRESENT` returns only the fields frozen in
  `CTR-RES-003`. No status, Grant, scope, secret, hash, token, password, or credential
  material is returned.
- Rejected alternative: return full ORM rows.
- Reason: strict data minimization and secret non-disclosure.

### DEC-RES-004 — Ambiguity is fail-loud, never first-row-wins

- Decision owner: `mayf3`.
- Decision: implementation reads up to two exact matches. Zero = `ABSENT`; one =
  `PRESENT`; more than one = `409 IDENTITY_RESOLUTION_AMBIGUOUS`.
- Rejected alternative: assume schema uniqueness and silently choose one row.
- Reason: corrupted/imported state must not create false identity evidence.

### DEC-RES-005 — Reuse existing management authentication without new authority vocabulary

- Decision owner: `mayf3`.
- Decision: reuse `v1ManagementAuth` (`svc-auth` + `auth.identity.provision`); add no
  Audience, Scope, Principal type, Grant, or token semantics.
- Rejected alternative: introduce `auth.identity.read` in this Child.
- Reason: a new Scope would widen Contract surface beyond the minimum observation seam.

### DEC-RES-006 — Query failures are fail-loud and never ABSENT

- Decision owner: `mayf3`.
- Decision: only a successful query returning zero exact rows is `ABSENT`. Database,
  timeout, query, and internal failures return explicit errors and MUST NOT be caught,
  translated, or presented as HTTP 404 or `ABSENT`.
- Rejected alternative: fail-safe-to-empty lookup.
- Reason: absence is identity evidence; fabricating it from an unknown query outcome can
  drive incorrect credential reconciliation.

### DEC-RES-007 — Preserve parent authority for known-Client-ID fresh resolution

- Decision owner: `mayf3`.
- Decision: this Child provides only
  `agent_id -> deterministic external_ref -> read-only identity discovery`.
  `stored.clientId -> GET /api/v1/clients/:client_id` remains governed by
  `MINIMAL_AUTH_FOUNDATION_V2`; Phase B is not complete unless that and every other
  accepted prerequisite are simultaneously satisfied.
- Rejected alternative: claim that external-ref discovery replaces known-ID resolution
  or independently completes Phase B.
- Reason: a discovery key and a stored public Client ID are distinct resolution inputs
  under distinct authority paths.

## 9. Contracts

### CTR-RES-001 — Exact read-only route surface

After this Spec is accepted, merged, and its implementation round is separately
reviewed, auth-service MAY expose exactly:

```text
GET /api/v1/principals/by-external-ref?external_ref=<exact>
GET /api/v1/clients/by-external-ref?external_ref=<exact>
```

Both MUST use `v1ManagementAuth`. The query object MUST have exactly one own key,
`external_ref`, whose value MUST be exactly one scalar string. Missing `external_ref`,
duplicate `external_ref`, parser-produced array/multi-value input, or any unexpected extra
query parameter MUST return `400 {"error":"INVALID_QUERY_PARAMETERS"}` before identity
lookup. No anonymous, list, bulk, prefix, wildcard, fuzzy, or POST-as-query path is
authorized.

### CTR-RES-002 — Deterministic external-ref validation

The Agent ID grammar MUST implement the accepted `AGENT_CORE_BINDING_WORKSPACE_V1`
normative grammar at pinned revision
`d83a2ff0e9644611707d7481ef88b4d7d49fb68e`:

```text
agent_id = 1*200( ALPHA / DIGIT / "_" / "-" )
ALPHA    = ASCII "A".."Z" / "a".."z"
DIGIT    = ASCII "0".."9"
NORMALIZATION = FORBIDDEN
ACCEPTED_SPEC_GRAMMAR_IS_NORMATIVE = YES
```

The pinned `sanitizeAgentId` / `INVALID_AGENT_ID_RE` implementation is known to accept a
wider language. It MUST NOT serve as the future Auth GET routes' sole validator. Before
any DB query, each route MUST independently enforce the normative allowlist and length.
If the old helper is reused, its wider behavior MUST NOT expand the accepted input
language.

The Principal route MUST accept only
`agentcore:v1:principal:<valid-agent-id>`. The Client route MUST accept only
`agentcore:v1:client:<valid-agent-id>`. Empty or whitespace input, `*`, wildcard syntax,
`@`, `:`, `+`, Chinese or any other non-ASCII character, extra colon, malformed prefix,
cross-kind prefix, overlong input, and any suffix outside the grammar MUST return
`400 {"error":"INVALID_EXTERNAL_REF"}` before identity lookup and MUST perform zero
identity mutation.

### CTR-RES-003 — Closed response projections

Principal `PRESENT` MUST return exactly:

```json
{
  "state": "PRESENT",
  "principal": {
    "id": "<principal UUID>",
    "principal_type": "agent|service",
    "agent_id": "<string|null>",
    "external_ref": "<exact input>"
  }
}
```

Client `PRESENT` MUST return exactly:

```json
{
  "state": "PRESENT",
  "client": {
    "client_id": "<public client ID>",
    "principal_id": "<principal UUID>",
    "external_ref": "<exact input>"
  }
}
```

No additional properties are authorized.

### CTR-RES-004 — ABSENT is only a successful zero-match result

Only when a successfully completed exact-equality query returns zero rows MUST the
corresponding route return HTTP 200 with exactly:

```json
{"state":"ABSENT"}
```

The outcome mapping is frozen:

```text
ZERO_MATCH     = ABSENT
DB_ERROR       = FAIL_LOUD
TIMEOUT        = FAIL_LOUD
QUERY_FAILURE  = FAIL_LOUD
INTERNAL_ERROR = FAIL_LOUD
```

A query timeout MUST return `504 {"error":"IDENTITY_RESOLUTION_TIMEOUT"}`. Any other
database, query, or internal resolution failure MUST return
`500 {"error":"IDENTITY_RESOLUTION_QUERY_FAILED"}`. No exception or rejected query
operation may be caught and translated to HTTP 404, HTTP 200 `ABSENT`, an empty row set,
or an identity-not-found result. ABSENT MUST NOT trigger create, claim, repair, rotation,
fallback, legacy lookup, or secondary heuristic search.

### CTR-RES-005 — Ambiguity fail-loud

The lookup layer MUST detect more than one exact match and return
`409 {"error":"IDENTITY_RESOLUTION_AMBIGUOUS"}`. It MUST NOT choose a first row or
mutate state. Tests MAY inject a duplicate result because production schema uniqueness
normally prevents this state.

### CTR-RES-006 — Zero persistent mutation

A resolution request MUST perform zero persistent writes. It MUST NOT call or import a
mutation path for Principal/Client create, claim, update, disable, revoke, secret
rotation, Grant mutation, Audience mutation, audit insertion, or credential-store write.
Conformance MUST prove the request path issues only read operations against identity
state.

### CTR-RES-007 — Secret and authorization data minimization

Client resolution MUST explicitly select only `clientId`, `machinePrincipalId`, and
`externalRef`; it MUST NOT select or return `secretHash`, legacy allowed resource/scope
arrays, access Grants, rotation metadata, token material, or credential material.
Principal resolution MUST explicitly select only `id`, `principalType`, `agentId`, and
`externalRef`.

### CTR-RES-008 — Discovery is observation, not complete resolution authority

`PRESENT` or `ABSENT` MUST NOT be interpreted by this API as Agent existence authority,
credential readiness, Grant readiness, activation, production cutover readiness, or
permission to mutate. This Child's authority is exactly:

```text
EXTERNAL_REF_IDENTITY_DISCOVERY = PROVIDED_BY_THIS_SPEC
KNOWN_CLIENT_ID_FRESH_RESOLUTION = REMAINS_GOVERNED_BY_PARENT_AUTHORITY
PHASE_B_COMPLETE = NO, unless all other accepted prerequisites are simultaneously satisfied
```

The routes in this Child MUST NOT replace, alias, or claim authority over
`stored.clientId -> GET /api/v1/clients/:client_id`. The caller owns later classification
under its own accepted authority.

### CTR-RES-009 — Closed future implementation scope

If this exact Spec is independently reviewed, accepted, and merged with
`implementation_authority: contracts`, implementation is limited to exactly:

```text
src/lib/oauth/v1/resolution.ts
src/routes/idempotent.ts
tests/oauth/identity-resolution-v1.test.ts
```

No schema, migration, Contract Bundle, Grant, deployment, or other product file is
included.

### CTR-RES-010 — No new Auth vocabulary

Implementation MUST add no Audience, Scope, token claim, Principal type, Grant type,
schema field, migration, or legacy compatibility behavior. Existing POST ensure routes
and their semantics MUST remain unchanged.

## 10. Acceptance

### ACC-RES-001 — Principal PRESENT exact lookup

- Contracts: `CTR-RES-001`, `CTR-RES-002`, `CTR-RES-003`.
- Method: authenticated integration test with one exact deterministic Principal ref.
- Environment: disposable test database.
- Required evidence: exact implementation commit, request, response, and query spy.
- Expected result: HTTP 200 exact closed `PRESENT` envelope and exact ref equality.
- Failure condition: missing/extra response field, non-exact match, or any write.

### ACC-RES-002 — Principal ABSENT has zero mutation

- Contracts: `CTR-RES-004`, `CTR-RES-006`.
- Method: complete a successful exact query for an unused valid deterministic Principal
  ref and compare DB before/after.
- Environment: disposable test database.
- Required evidence: request/response, successful zero-row query result, and
  row-count/snapshot equivalence.
- Expected result: successful zero match returns HTTP 200 `{"state":"ABSENT"}` and
  byte/row-equivalent identity state.
- Failure condition: any created/claimed/updated object, non-ABSENT response, or ABSENT
  produced without a successful zero-row query.

### ACC-RES-003 — Client PRESENT relationship projection

- Contracts: `CTR-RES-001`, `CTR-RES-003`, `CTR-RES-007`.
- Method: authenticated integration test with one exact deterministic Client ref.
- Environment: disposable test database.
- Required evidence: exact response and ORM select projection.
- Expected result: only public client ID, principal UUID relationship, and exact ref.
- Failure condition: secret/hash/Grant/scope/extra field selected or returned.

### ACC-RES-004 — Client ABSENT has zero mutation

- Contracts: `CTR-RES-004`, `CTR-RES-006`.
- Method: complete a successful exact query for an unused valid deterministic Client ref
  and compare DB before/after.
- Environment: disposable test database.
- Required evidence: request/response, successful zero-row query result, and identity
  snapshot equivalence.
- Expected result: successful zero match returns HTTP 200 `{"state":"ABSENT"}` and zero
  writes.
- Failure condition: any mutation, heuristic fallback, or ABSENT produced without a
  successful zero-row query.

### ACC-RES-005 — Ambiguous result fails loud

- Contracts: `CTR-RES-005`.
- Method: unit-test resolver with an injected two-row exact-match result.
- Environment: test process.
- Required evidence: exact error envelope and mutation spy.
- Expected result: 409 `IDENTITY_RESOLUTION_AMBIGUOUS`, writes = 0.
- Failure condition: a row is selected or state is mutated.

### ACC-RES-006 — Input grammar and single query parameter are enforced before query

- Contracts: `CTR-RES-001`, `CTR-RES-002`.
- Method: positive boundary tests for Agent ID lengths 1 and 200 plus negative tests for
  empty, whitespace, `*`, wildcard, `@`, `:`, `+`, Chinese characters, extra colon,
  malformed/path prefix, prefix-only, cross-kind, other non-ASCII, and length 201 refs;
  separately test missing `external_ref`, duplicate `external_ref`, parser-produced
  multi-value input, and every unexpected extra query parameter.
- Environment: test process.
- Required evidence: exact request matrix, parser-visible query shape, validation-before-DB
  call order, query call count, and response matrix.
- Expected result: exactly one valid scalar `external_ref` reaches identity lookup;
  invalid refs return exact `INVALID_EXTERNAL_REF`; query cardinality/shape violations
  return exact `INVALID_QUERY_PARAMETERS`; for `@`, `:`, `+`, Chinese, and every other
  rejected request, `FAIL_BEFORE_DB_QUERY = YES`, `DB_QUERY_COUNT = 0`, and writes = 0.
- Failure condition: invalid syntax, duplicate/multi-value/additional input reaches DB
  lookup, the wider pinned `sanitizeAgentId` behavior expands accepted input, any invalid
  request is accepted or normalized, or any mutation occurs.

### ACC-RES-007 — Authentication boundary is reused exactly

- Contracts: `CTR-RES-001`, `CTR-RES-010`.
- Method: authenticated/unauthenticated route tests using existing V1 management auth.
- Environment: integration test.
- Required evidence: status/envelope matrix and unchanged registry/Contract bytes.
- Expected result: existing `v1ManagementAuth` governs both GET routes; no new scope or
  Audience is required.
- Failure condition: anonymous access, new auth vocabulary, or management-auth bypass.

### ACC-RES-008 — Secret non-disclosure

- Contracts: `CTR-RES-003`, `CTR-RES-007`.
- Method: seed a sentinel secret hash and Grant data, perform Client lookup, scan response,
  captured logs/errors, and selected ORM fields.
- Environment: disposable test database.
- Required evidence: sentinel scan and explicit select assertion.
- Expected result: sentinel absent everywhere exposed by the resolution request.
- Failure condition: secret/hash/token/password/credential/Grant material is selected or
  emitted.

### ACC-RES-009 — Resolution path is read-only

- Contracts: `CTR-RES-006`.
- Method: instrument Prisma calls for both PRESENT and ABSENT paths.
- Environment: test process + disposable database.
- Required evidence: method call list and before/after DB snapshot.
- Expected result: read methods only; create/update/upsert/delete/raw-write/audit methods
  are never invoked; snapshots are equivalent.
- Failure condition: any persistent write or mutation helper invocation.

### ACC-RES-010 — Closed implementation scope and no authority expansion

- Contracts: `CTR-RES-008`, `CTR-RES-009`, `CTR-RES-010`.
- Method: implementation PR changed-file audit plus contract/runtime regression suites.
- Environment: clean implementation worktree.
- Required evidence: exact changed-file list, `git diff --check`, governance validation,
  contract tests, OAuth tests, and source scan for forbidden fields/routes.
- Expected result: exactly the three authorized files; existing identity/Grant semantics
  unchanged; production change = none.
- Failure condition: fourth file, schema/migration/Contract Bundle change, Grant behavior,
  deployment action, or inferred cutover authority.

### ACC-RES-011 — Query failures are distinct from ABSENT

- Contracts: `CTR-RES-004`, `CTR-RES-006`.
- Method: inject, independently, a database error, query timeout, generic query rejection,
  and internal resolver error for both route kinds; also execute a successful zero-match
  control case.
- Environment: test process + disposable database.
- Required evidence: exact status/envelope matrix, thrown/rejected operation trace, and
  write/query spy.
- Expected result: successful zero match alone returns HTTP 200 exact `ABSENT`; timeout
  returns HTTP 504 exact `IDENTITY_RESOLUTION_TIMEOUT`; database, query, and internal
  failures return HTTP 500 exact `IDENTITY_RESOLUTION_QUERY_FAILED`; writes = 0.
- Failure condition: any failure becomes HTTP 404, HTTP 200 `ABSENT`, empty/not-found
  state, a swallowed exception, or a mutation.

### ACC-RES-012 — Parent known-Client-ID resolution remains authoritative

- Contracts: `CTR-RES-008`, `CTR-RES-010`.
- Method: authority and route-surface review against `MINIMAL_AUTH_FOUNDATION_V2`
  `CTR-MAFV2-011` plus external Phase B D.7.3 at the pinned revision.
- Environment: clean source and authority trees.
- Required evidence: exact route inventory and Claim/Contract wording audit.
- Expected result: external-ref routes provide identity discovery only;
  `GET /api/v1/clients/:client_id` remains the parent-governed fresh resolution path for
  `stored.clientId`; `PHASE_B_COMPLETE = NO` unless every other accepted prerequisite is
  simultaneously satisfied.
- Failure condition: this Child replaces/aliases the parent route, claims the external-ref
  seam alone closes credential resolution, or declares Phase B complete.

## 11. Alternatives and disposition

### ALT-RES-001 — Reuse POST ensure as read-only query

- Disposition: REJECTED by `DEC-RES-001`.
- Reason: an observation call must never possess create/claim side effects.

### ALT-RES-002 — Let Trusted Fleet tooling query production DB directly

- Disposition: REJECTED by `DEC-RES-001` and `DEC-RES-005`.
- Reason: direct DB inspection is not a reusable formal Auth boundary and couples an
  external tool to persistence internals.

### ALT-RES-003 — Add generic search/list API

- Disposition: REJECTED by `DEC-RES-002`.
- Reason: expands identity enumeration surface beyond exact deterministic Agent Core refs.

### ALT-RES-004 — Add a new `auth.identity.read` scope now

- Disposition: REJECTED by `DEC-RES-005`.
- Reason: unnecessary Contract/Audience expansion for the minimum observation seam.

## 12. Migration, compatibility, and rollback

This is additive API authority only. No schema or data migration is required. Existing
POST ensure behavior remains byte/semantic compatible.

Future implementation rollout MUST remain disabled until that implementation receives
independent exact-head review. Production deployment is separately authorized and is
not part of this Spec PR.

Because the seam performs no persistent mutation, code rollback requires no data
rollback. Removing or disabling the GET routes after deployment does not modify identity
state.

The pinned upstream `sanitizeAgentId` divergence is recorded but its repair is outside
this auth-service Child. No dsh-agent-core code or revision pin changes are authorized.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE

AUTHORITY_SUFFICIENT_FOR_IMPLEMENTATION_NOW = NO
EXTERNAL_REF_IDENTITY_DISCOVERY = PROVIDED_BY_THIS_SPEC
KNOWN_CLIENT_ID_FRESH_RESOLUTION = REMAINS_GOVERNED_BY_PARENT_AUTHORITY
PHASE_B_COMPLETE = NO_UNLESS_ALL_OTHER_ACCEPTED_PREREQUISITES_ARE_SATISFIED
ACCEPTED_SPEC_GRAMMAR_IS_NORMATIVE = YES
SOURCE_DIVERGENCE_RECORDED = YES
IMPLEMENTATION_SOURCE_DIVERGENCE = KNOWN
GOVERNING_GRAMMAR_UNCHANGED = YES
UPSTREAM_VALIDATOR_FIX_REQUIRED_NOW = NO
UPSTREAM_VALIDATOR_REPAIR = OUT_OF_SCOPE
READ_ONLY_RESOLUTION_IMPLEMENTED = NO
PRODUCTION_CHANGE = NONE
```

This proposed Child requires independent semantic review. Acceptance recommendation is
not acceptance; acceptance is not merge; merge is not deployment or Trusted Fleet
Cutover execution.
