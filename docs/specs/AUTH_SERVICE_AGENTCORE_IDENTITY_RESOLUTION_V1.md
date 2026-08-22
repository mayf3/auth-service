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
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1

## 1. Goal

Establish one bounded, authenticated, deterministic, **read-only** Auth identity
resolution seam for Agent Core deterministic `external_ref` values so trusted
operators can observe whether the exact Principal and Client already exist before any
credential provisioning or reconciliation decision.

This Spec authorizes **no implementation while proposed**. After independent review,
Owner acceptance, and merge to `main`, its Contracts may authorize only the exact
three-file implementation closure in `CTR-RES-009`.

Frozen target:

```text
principal external_ref = agentcore:v1:principal:<agent_id>
client external_ref    = agentcore:v1:client:<agent_id>

QUERY_ONLY = YES
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
- changing `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Phase A / Phase B semantics;
- expanding Agent existence authority beyond Agent Definition.

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2 (accepted)
PROCESS_AUTHORITY = AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1 (accepted)
EXTERNAL_INTEROP_AUTHORITY = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
EXTERNAL_REVISION = d83a2ff0e9644611707d7481ef88b4d7d49fb68e
```

`MINIMAL_AUTH_FOUNDATION_V2` preserves the incorporated V1 identity model while
changing migration / hard-cut / sequencing meaning only. It does not itself grant an
implementation round for a new read-only API surface. Repository-local governance
requires a merged accepted governing Spec with `implementation_authority: contracts`
for non-mechanical identity/API work. Therefore this new bounded Child is required.

The external Agent Core authority requires read-only Auth client resolution before
Phase B existing-credential reconciliation; this Spec interoperates with that need but
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
  reconciliation as requiring read-only Auth resolution before S1/S2 or store writes.
  Basis: `OBS-RES-003`, `CLM-RES-002`.

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
- Method: inspect accepted Phase A / Phase B boundary.
- Result: Phase B existing credential reconciliation requires Auth read-only resolution
  before S1/S2 and before store mutation; current absence is explicitly a blocker.
- Provenance: external accepted Spec at exact revision.

## 6. Claims and assumptions

### CLM-RES-001 — Existing POST ensure cannot serve as a safe observation seam

- Support state: SUPPORTED.
- Supported by evidence: `EVD-RES-001`.
- Contradicted by evidence: none known.
- Uncertainty: none for the exact observed source revision.

### CLM-RES-002 — A bounded exact-key GET seam closes the observation blocker without expanding mutation authority

- Support state: SUPPORTED.
- Supported by evidence: `EVD-RES-002`, `EVD-RES-003`.
- Contradicted by evidence: none known.
- Uncertainty: future implementation still requires exact-revision independent review
  and conformance; this Claim does not declare production deployment.

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

### EVD-RES-003 — External Phase B need supports the bounded seam

- Source observations: `OBS-RES-003`.
- Target: `CLM-RES-002`, `STATE-RES-003`.
- Relation: SUPPORTS.
- Bound coordinates: `dsh-agent-core@d83a2ff0e9644611707d7481ef88b4d7d49fb68e`.
- Strength/sufficiency: direct accepted external authority.
- Limitations: does not grant local auth-service implementation authority.
- Provenance: external accepted Spec.

## 8. Decisions

### DEC-RES-001 — Add two exact authenticated GET resolution routes

- Decision owner: `mayf3`.
- Decision:

  ```text
  GET /api/v1/principals/by-external-ref?external_ref=<exact>
  GET /api/v1/clients/by-external-ref?external_ref=<exact>
  ```

  Both routes use `v1ManagementAuth`. They are query-only and accept exactly one
  `external_ref` per request.
- Rejected alternative: use POST `createOrGet*` as a query.
- Reason: observation must never create, claim, update, rotate, or otherwise mutate.

### DEC-RES-002 — Restrict lookup to deterministic Agent Core external refs

- Decision owner: `mayf3`.
- Decision:
  - Principal route accepts only prefix `agentcore:v1:principal:` followed by a
    non-empty Agent ID suffix.
  - Client route accepts only prefix `agentcore:v1:client:` followed by a non-empty
    Agent ID suffix.
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

## 9. Contracts

### CTR-RES-001 — Exact read-only route surface

After this Spec is accepted, merged, and its implementation round is separately
reviewed, auth-service MAY expose exactly:

```text
GET /api/v1/principals/by-external-ref?external_ref=<exact>
GET /api/v1/clients/by-external-ref?external_ref=<exact>
```

Both MUST use `v1ManagementAuth`. No anonymous, list, bulk, prefix, wildcard, fuzzy, or
POST-as-query path is authorized.

### CTR-RES-002 — Deterministic external-ref validation

The Principal route MUST accept only exact strings of the form
`agentcore:v1:principal:<non-empty-agent-id>`. The Client route MUST accept only exact
strings of the form `agentcore:v1:client:<non-empty-agent-id>`. Invalid or cross-kind
refs MUST return `400 {"error":"INVALID_EXTERNAL_REF"}` and MUST perform zero identity
mutation.

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

### CTR-RES-004 — Explicit ABSENT

When zero exact rows exist, the corresponding route MUST return HTTP 200 with exactly:

```json
{"state":"ABSENT"}
```

ABSENT MUST NOT trigger create, claim, repair, rotation, fallback, legacy lookup, or
secondary heuristic search.

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

### CTR-RES-008 — Presence is observation, not authority

`PRESENT` or `ABSENT` MUST NOT be interpreted by this API as Agent existence authority,
credential readiness, Grant readiness, activation, production cutover readiness, or
permission to mutate. The caller owns later classification under its own accepted
authority.

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
- Method: query an unused valid deterministic Principal ref and compare DB before/after.
- Environment: disposable test database.
- Required evidence: request/response plus row-count/snapshot equivalence.
- Expected result: HTTP 200 `{"state":"ABSENT"}` and byte/row-equivalent identity state.
- Failure condition: any created/claimed/updated object or non-ABSENT response.

### ACC-RES-003 — Client PRESENT relationship projection

- Contracts: `CTR-RES-001`, `CTR-RES-003`, `CTR-RES-007`.
- Method: authenticated integration test with one exact deterministic Client ref.
- Environment: disposable test database.
- Required evidence: exact response and ORM select projection.
- Expected result: only public client ID, principal UUID relationship, and exact ref.
- Failure condition: secret/hash/Grant/scope/extra field selected or returned.

### ACC-RES-004 — Client ABSENT has zero mutation

- Contracts: `CTR-RES-004`, `CTR-RES-006`.
- Method: query an unused valid deterministic Client ref and compare DB before/after.
- Environment: disposable test database.
- Required evidence: request/response plus identity snapshot equivalence.
- Expected result: HTTP 200 `{"state":"ABSENT"}` and zero writes.
- Failure condition: any mutation or heuristic fallback.

### ACC-RES-005 — Ambiguous result fails loud

- Contracts: `CTR-RES-005`.
- Method: unit-test resolver with an injected two-row exact-match result.
- Environment: test process.
- Required evidence: exact error envelope and mutation spy.
- Expected result: 409 `IDENTITY_RESOLUTION_AMBIGUOUS`, writes = 0.
- Failure condition: a row is selected or state is mutated.

### ACC-RES-006 — Invalid/cross-kind ref fails before query

- Contracts: `CTR-RES-002`.
- Method: test empty, malformed, wildcard, prefix-only, and cross-kind refs.
- Environment: test process.
- Required evidence: query call count and response matrix.
- Expected result: exact `INVALID_EXTERNAL_REF`, identity query count = 0, writes = 0.
- Failure condition: DB identity lookup or mutation occurs.

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

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE

AUTHORITY_SUFFICIENT_FOR_IMPLEMENTATION_NOW = NO
READ_ONLY_RESOLUTION_IMPLEMENTED = NO
PRODUCTION_CHANGE = NONE
```

This proposed Child requires independent semantic review. Acceptance recommendation is
not acceptance; acceptance is not merge; merge is not deployment or Trusted Fleet
Cutover execution.
