---
spec_id: AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
  - mayf3/agent-forum consumer compatibility (evidence only; source change forbidden)
  - svc-forum forum.moderate registration and exact moderator Grant supply
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes:
  - AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1
  - AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1
  - AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1

> **PROPOSED — DOCS ONLY.** This proposal authorizes no implementation or
> production apply while proposed. This PR adds exactly this Spec, mutates no
> Principal, Client, Credential, Audience, Grant, audit row, database, runtime,
> deployment, or Forum data. `PRODUCTION_APPLY_AUTHORITY = none`.

## 1. Goal

Freeze the complete, exact-identity, fail-closed authority needed to make one
Agent Core moderator Client eligible for `svc-forum` moderation after a future
independently reviewed implementation and a still-separate production apply:

```text
MODERATOR_AGENT_ID = agt_course-community-agent-2
MODERATOR_PRINCIPAL_ID = agentcore:v1:principal:agt_course-community-agent-2
MODERATOR_CLIENT_EXTERNAL_REF = agentcore:v1:client:agt_course-community-agent-2
MODERATOR_CLIENT_ID = mc_hvEfjkJ5BTKA8HZXRmbzNVw0
CURRENT_SVC_FORUM_SCOPES = [forum.read, forum.write]
ONLY_ALLOWED_SCOPE_INCREMENT = forum.moderate
TARGET_SVC_FORUM_SCOPES = [forum.moderate, forum.read, forum.write]
TARGET_CLIENT_COUNT = 1
NON_TARGET_AGENT_COUNT = 85
```

The target cannot be implemented as a Grant row alone: current accepted Minimal
Auth authority and executable registry reject `forum.moderate`. This Spec
therefore owns one closed semantic transaction with two implementation phases:

1. version the Contract Bundle after the already-authorized `1.4.0` notification
   ingress delta and register `forum.moderate` for `svc-forum` at `1.5.0`;
2. prepare the exact one-Client Grant plan and implementation seam.

Neither phase is a production apply. Acceptance or source merge does not mutate
production.

## 2. Scope and non-goals

### 2.1 In scope

- Add exactly `forum.moderate` to the registered `svc-forum` scope set while
  retaining `forum.read` and `forum.write`.
- Update the versioned Minimal Auth Contract Bundle from the prerequisite
  `1.4.0` state to `1.5.0` through the exact closure in `CTR-FMG-014`.
- Create a dry-run plan/apply/verify implementation for exactly the identity
  tuple in §1.
- Change exactly that Client's complete `svc-forum` Grant snapshot from
  `[forum.read, forum.write]` to
  `[forum.moderate, forum.read, forum.write]` when and only when a later,
  separately authorized production apply is performed.
- Record a same-transaction immutable Grant audit for a real change.
- Support exact rerun NOOP and conflict fail-closed.

### 2.2 Forbidden and out of scope

- Any change to the remaining 85 Agent Core fleet identities or Grants.
- `forum.admin`, `forum.*`, `*`, wildcard, namespace wildcard, or any scope other
  than the single `forum.moderate` increment.
- Any Workflow Grant or any `svc-workflow` row/version/audit mutation.
- Any Principal, Client, Credential, secret, owner, external-ref, status, or
  binding mutation.
- Any Human or Delegated Grant mutation.
- Any legacy `allowedResources` or `allowedScopes` read, write, union, fallback,
  repair, or synchronization.
- Reusing, resolving through, copying from, or granting the legacy OpenClaw
  `mc_oc_*` Client family, including the historical moderator Client
  `mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd`.
- Generic online Grant administration API, blanket IAM, role-name matching, or
  display-name matching.
- Production database write, production apply, deploy, runtime reload, Forum
  data mutation, or Itops cutover in this Spec PR.

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = d529bd3c28ece3967149ad793794f8dac2020276
CLASSIFICATION = NEW
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
FLEET_BASELINE_PARENT = AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1
VERSION_PREDECESSOR_AUTHORITY = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
PROCESS_AUTHORITY = AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
```

`MINIMAL_AUTH_FOUNDATION_V2` exact-incorporates the current
`svc-forum[forum.read,forum.write]` semantics and requires a future semantic
change to use V2 as parent. This Spec is that bounded new child authority; it
does not rewrite the Architecture parent or infer partial supersession.

The narrower accepted authorities `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`,
`AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1`, and
`AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` cannot remain
simultaneously active: they freeze read/write-only, Bundle `1.3.0` linkage, and a
repeatable reconciliation back to read/write. On acceptance, this Spec MUST
whole-supersede all three and absorb their still-valid Audience, consumer,
validation, activation, linkage, exact-row, optimistic-concurrency, audit,
NOOP, and fail-closed reconciliation obligations with the sole semantic increment
defined here. The acceptance transaction MUST atomically set all three old
Specs' `superseded_by` backlinks. While this Spec is proposed, the old authorities
remain active and no semantic or source change is authorized.

`AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1` remains the authority for
the completed one-time 86-Client baseline supply. Its exact read/write Forum
end-state is this Spec's source precondition, not text to be edited. This new
Spec owns a later versioned delta for one exact Client; it neither re-runs nor
redefines the parent migration and does not claim that the old operation's
historical conformance changes when the later delta is applied.

The accepted notification-ingress closure reserves Bundle `1.4.0`. Moderator
implementation MUST be based on the merged, verified `1.4.0` result and produce
`1.5.0`; it MUST NOT race, replace, skip, or reuse `1.4.0`.

### 3.1 Pinned Forum consumer compatibility dependency

```text
SVC_FORUM_REPOSITORY = mayf3/agent-forum
SVC_FORUM_DEPLOYED_SOURCE_REVISION = 502cfca5a180d6c49fe75dfc270fd117f279ccfb
SVC_FORUM_IMAGE_ID = sha256:93a9eda5b4adb1edbb186e511c801f482d2c702e6079c1faa6dc357e56ec6f97
OBSERVED_AT = 2026-08-27T01:34:09Z
```

At that exact source revision the consumer enforces `forum.moderate` for
pin/feature, thread/message soft delete, report queue/handling, and admin unread.
Resolve/archive remain server-`forum.write` routes and are narrowed by the
separate Agent Core Broker Spec. This pinned implementation is evidence of
consumer compatibility, not external authority owned by auth-service.

## 4. Current State

- `STATE-FMG-001` — Auth `main@d529bd3c` has active `svc-forum` registered scopes
  exactly `[forum.read,forum.write]`; `forum.moderate` is a negative fixture and
  is not mintable. Basis: `OBS-FMG-001`, `OBS-FMG-002`, `EVD-FMG-001`.
- `STATE-FMG-002` — the exact Agent Core moderator Principal and Client were
  active in the pinned 86-fleet post-snapshot; its complete current Grants were
  `svc-forum[forum.read,forum.write]@v1` and
  `svc-workflow[workflow.read]@v1`. Basis: `OBS-FMG-003`, `EVD-FMG-002`.
- `STATE-FMG-003` — Bundle `1.4.0` registration/linkage is accepted but not
  present in authoring base product artifacts; the current executable bundle is
  `1.3.0`. Basis: `OBS-FMG-001`, `OBS-FMG-004`.
- `STATE-FMG-004` — deployed Forum revision `502cfca5...` consumes the proposed
  moderation scope on the named moderation routes. Basis: `OBS-FMG-005`,
  `EVD-FMG-003`.
- `STATE-FMG-005` — this authoring round has no fresh authoritative read of the
  production `auth_audiences` row; the pinned fleet snapshot contains Principal,
  Client, and Grant rows but not Audience rows. Therefore no production APPLY
  classification or plan digest is claimed now. Future plan MUST observe exact
  read/write Audience source state; any other state is `CONFLICT` under
  `CTR-FMG-008`. Basis: `OBS-FMG-003`, `CLM-FMG-004`.

## 5. Observations

### OBS-FMG-001 — Current executable Audience registry

- Subject: `contract-bundles/minimal-auth-v1/audience-registry.json`
- Repository/revision: `mayf3/auth-service@d529bd3c28ece3967149ad793794f8dac2020276`
- Blob: `ef7e139ec545471cbb4e84ce84a5fbcc3c48b1d7`
- Method: exact source inspection
- Result: `registry_version=1.3.0`; `svc-forum.registered_scopes` equals exactly
  `forum.read,forum.write`.

### OBS-FMG-002 — Current Architecture rejects moderate

- Subject: `MINIMAL_AUTH_FOUNDATION_V2`
- Repository/revision: `mayf3/auth-service@d529bd3c`
- Blob: `576b7a75e4be278f20fee71ee4ba5e263bd958c7`
- Method: exact authority inspection
- Result: the exact-incorporated svc-forum semantics retain read/write and reject
  `forum.moderate`, while requiring a future semantic change to use V2 as parent.

### OBS-FMG-003 — Exact moderator identity and Grant snapshot

- Subject: Agent Core fleet Auth state snapshot
- Artifact: `/private/tmp/fleet-grant-scan-20260823/post-snapshot-20260823T152159Z.json`
- SHA-256: `767ac6c7d86e74ca88cc3c7e46991f22cc50cdd151fcd0f53f51c31b5719e70f`
- Environment: read-only post-snapshot of production Auth DB, created
  `2026-08-23T15:21:59Z`
- Method: safe leaf-field projection; no secret/credential material read
- Result:

```text
Principal = [agentcore:v1:principal:agt_course-community-agent-2,
             agt_course-community-agent-2, agent, active]
Client    = [agentcore:v1:client:agt_course-community-agent-2,
             mc_hvEfjkJ5BTKA8HZXRmbzNVw0, active]
Forum     = [agentcore:v1:client:agt_course-community-agent-2,
             svc-forum, forum.read,forum.write, 1]
Workflow  = [agentcore:v1:client:agt_course-community-agent-2,
             svc-workflow, workflow.read, 1]
```

### OBS-FMG-004 — Bundle 1.4.0 predecessor is already reserved

- Subject: `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1`
- Repository/revision: `mayf3/auth-service@d529bd3c`
- Blob: `e80fcd018b7f2b8a75792a3c3e45dfa121e4458a`
- Method: accepted Spec inspection
- Result: exact 15-file closure authorizes the future `1.3.0 -> 1.4.0` Bundle and
  runtime/candidate linkage delta.

### OBS-FMG-005 — Exact deployed Forum consumer

- Subject: local production `svc-forum`
- Repository/source revision: `mayf3/agent-forum@502cfca5a180d6c49fe75dfc270fd117f279ccfb`
- Image: `sha256:93a9eda5b4adb1edbb186e511c801f482d2c702e6079c1faa6dc357e56ec6f97`
- Method: health/container identity plus exact route/scope-guard source inspection
- Result: moderation endpoints require `forum.moderate`; admin unread does not
  require `forum.admin`.

## 6. Claims and assumptions

### CLM-FMG-001 — Grant-only implementation would fail closed

- Support state: SUPPORTED
- Supported by: `EVD-FMG-001`
- Uncertainty: none on authoring base; registered-scope validation is an explicit
  prerequisite in accepted Grant-supply precedent.

### CLM-FMG-002 — The exact moderator tuple is uniquely identified

- Support state: SUPPORTED
- Supported by: `EVD-FMG-002`
- Uncertainty: the snapshot is time-indexed; every future plan/apply MUST re-read
  live state and fail closed on drift.

### CLM-FMG-003 — `forum.moderate` is sufficient and `forum.admin` is unnecessary

- Support state: SUPPORTED
- Supported by: `EVD-FMG-003`
- Uncertainty: bounded to Forum revision `502cfca5...`; a different deployed
  consumer requires renewed compatibility evidence.

### CLM-FMG-004 — Production Audience source state is not established here

- Support state: OPEN_ASSUMPTION
- Supported by: none; `OBS-FMG-003` proves only that the available snapshot omits
  Audience rows.
- Uncertainty: resolved only by the future official read-only plan. This does not
  weaken Contracts: non-read/write source is conflict with writes zero.

## 7. Evidence relations

### EVD-FMG-001 — Registry and Architecture support the prerequisite Claim

- Source observations: `OBS-FMG-001`, `OBS-FMG-002`
- Target: `CLM-FMG-001`, `STATE-FMG-001`
- Relation: SUPPORTS
- Bound coordinates: Auth `d529bd3c`, exact blobs in §5
- Strength: direct executable and normative source evidence
- Limitation: does not describe a future `1.5.0` implementation.

### EVD-FMG-002 — Fleet snapshot supports exact identity State

- Source observations: `OBS-FMG-003`
- Target: `CLM-FMG-002`, `STATE-FMG-002`
- Relation: SUPPORTS
- Bound coordinates: snapshot SHA-256 and timestamp in §5
- Strength: strong, exact safe-field projection of all relevant rows
- Limitation: production may drift; fresh plan/apply verification is mandatory.

### EVD-FMG-003 — Deployed consumer supports minimum-scope Claim

- Source observations: `OBS-FMG-005`
- Target: `CLM-FMG-003`, `STATE-FMG-004`
- Relation: SUPPORTS
- Bound coordinates: Forum source `502cfca5...`, immutable image ID
- Strength: direct exact-revision source plus runtime identity
- Limitation: does not authorize Auth mutation.

### EVD-FMG-004 — Predecessor closure supports version ordering

- Source observations: `OBS-FMG-004`
- Target: `STATE-FMG-003`
- Relation: SUPPORTS
- Bound coordinates: Auth `d529bd3c`, predecessor Spec blob
- Strength: direct accepted-authority evidence
- Limitation: accepted implementation authority does not prove `1.4.0` is merged.

## 8. Decisions

### DEC-FMG-001 — Register the minimum scope and grant one exact Client

- Decision owner: `mayf3`
- Decision: add only `forum.moderate` to the `svc-forum` registered scope set,
  then permit only the exact §1 Client's Forum Grant to add that scope.
- Rejected alternative: `forum.admin`, wildcard, all-fleet moderate, or a
  display-name-selected moderator.
- Reason: exact deployed consumer behavior and least privilege.

### DEC-FMG-002 — Version after the reserved 1.4.0 delta

- Decision owner: `mayf3`
- Decision: the registry semantic change is Bundle `1.5.0` based on a merged and
  verified `1.4.0`; all 15 version/linkage files move together.
- Rejected alternative: reuse `1.4.0`, patch `1.3.0` in place, or race the
  notification-ingress implementation.
- Reason: immutable version identity and accepted predecessor closure.

### DEC-FMG-003 — Plan, apply, and verify are distinct fail-closed phases

- Decision owner: `mayf3`
- Decision: implementation provides dry-run plan, separately gated apply, and
  post-apply verify. Plan never writes; apply consumes an exact plan digest and
  fresh live preconditions; verify is read-only.
- Rejected alternative: one opaque script that discovers and writes while
  iterating.
- Reason: complete precondition validation and auditable operator control.

### DEC-FMG-004 — Closed eighteen-file implementation

- Decision owner: `mayf3`
- Decision: future source implementation is exactly the 15-file version/linkage
  closure plus three exact Grant-supply files in `CTR-FMG-014`.
- Rejected alternative: generic machine-admin Grant API or “related files.”
- Reason: reuse accepted bundle-linkage and one-off migration precedents without
  expanding the permanent administration surface.

## 9. Contracts

### CTR-FMG-001 — Closed exact identity

Plan and apply MUST resolve exactly one active Client whose external ref is
`agentcore:v1:client:agt_course-community-agent-2`, public ID is
`mc_hvEfjkJ5BTKA8HZXRmbzNVw0`, and bound Principal is exactly active
`agentcore:v1:principal:agt_course-community-agent-2` with
`principal_type=agent` and `agent_id=agt_course-community-agent-2`. Missing,
duplicate, inactive, mismatched, or differently bound state MUST fail loudly
with all writes zero.

### CTR-FMG-002 — Whole successor Audience and consumer Contract

Bundle `1.5.0` MUST carry exactly this complete `svc-forum` Audience entry:

```json
{
  "audience_id": "svc-forum",
  "resource_service": "svc-forum",
  "scope_namespace": "forum",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["forum.moderate", "forum.read", "forum.write"],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1; machine-only agent access via standard OAuth2 client_credentials."
}
```

The successor absorbs and preserves the superseded CCR/linkage obligations:
standard direct `client_credentials`; RS256 only with JWKS offline validation,
known `kid`, exact issuer/audience, and rejection of HS256, unknown `kid`, wrong
issuer/audience, inactive or non-agent Principal; required `agent_id`; no
`owner_user_id` dependency; requested scopes must be non-empty, duplicate-free,
namespace-valid, registered, and a subset of the exact Machine Grant; unknown
scope fails closed; no introspection, Human, Delegated, legacy, wildcard,
role-claim, or auto-downgrade fallback. `forum.admin`, wildcard, and every other
new scope remain negative. Consumer evidence MUST pin deployed-compatible
`mayf3/agent-forum@502cfca5a180d6c49fe75dfc270fd117f279ccfb`, prove fail-closed
enforcement of read/write/moderate route categories, and receive independent
exact-commit consumer review with Author != Reviewer before implementation
acceptance. The sole semantic increment over the superseded authorities is
registration of `forum.moderate`.

### CTR-FMG-003 — Exact canonical APPLY and NOOP plans

Every compatible dry run MUST emit one canonical document with these common
fields and exactly one of the two closed classifications below:

```json
{
  "plan_version": "AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1_PLAN_1",
  "classification": "APPLY_OR_EXACT_RERUN_NOOP",
  "agent_id": "agt_course-community-agent-2",
  "principal_external_ref": "agentcore:v1:principal:agt_course-community-agent-2",
  "client_external_ref": "agentcore:v1:client:agt_course-community-agent-2",
  "client_id": "mc_hvEfjkJ5BTKA8HZXRmbzNVw0",
  "audience": "svc-forum",
  "expected_audience_scopes": ["forum.read", "forum.write"],
  "target_audience_scopes": ["forum.moderate", "forum.read", "forum.write"],
  "expected_grant_version": 1,
  "expected_grant_scopes": ["forum.read", "forum.write"],
  "target_grant_version": 2,
  "target_grant_scopes": ["forum.moderate", "forum.read", "forum.write"],
  "operation": "UPDATE_AUDIENCE_AND_GRANT_OR_NONE"
}
```

For exact source state, `classification=APPLY` and
`operation=UPDATE_AUDIENCE_AND_GRANT`. For exact target state plus the exact audit
in `CTR-FMG-010`, `classification=EXACT_RERUN_NOOP`,
`expected_audience_scopes=target_audience_scopes`,
`expected_grant_version=2`, `expected_grant_scopes=target_grant_scopes`, and
`operation=NONE`. No other classification is apply-eligible. Canonical form is
UTF-8 JSON with recursively sorted object keys, arrays in the specified order,
separators `(",", ":")`, and `ensure_ascii=false`. Output MUST include SHA-256 of
the actual canonical document, so APPLY and NOOP have distinct deterministic
digests, and MUST contain no secret.

### CTR-FMG-004 — Only two coordinated database-field deltas

One real apply transaction MAY change only:

1. the unique active `auth_audiences` row for `svc-forum`, changing only
   `registered_scopes` from `[forum.read,forum.write]` to
   `[forum.moderate,forum.read,forum.write]`; and
2. the exact Client's complete `svc-forum` Grant from version `1` scopes
   `[forum.read,forum.write]` to version `2` scopes
   `[forum.moderate,forum.read,forum.write]`.

Both changes commit together with `CTR-FMG-010` audit or all roll back. Every
other Audience field, row, Grant type, audit history, and database value MUST be
preserved. Apply MUST NOT union an unknown set or infer scopes from legacy fields.

### CTR-FMG-005 — Remaining fleet and Workflow are invariant

All other 85 fleet Agents and every non-target Client MUST have Grant writes zero
and audit writes zero. The target Client's `svc-workflow[workflow.read]@v1` and
all Workflow Grants MUST remain unchanged. Any planned or observed non-target or
Workflow delta MUST abort the complete apply before writes.

### CTR-FMG-006 — Dry-run plan has zero side effects

Plan MUST perform read-only exact identity, Audience, Grant, audit-revision, and
non-target invariant checks before producing the canonical plan/digest. Plan MUST
write zero database rows, files in trusted production configuration, credentials,
or logs containing sensitive material. An incompatible source state MUST produce
`CONFLICT` and no apply artifact represented as executable authorization.

### CTR-FMG-007 — Apply is serializable, digest-bound, and outage-gated

Apply MUST require: exact reviewed implementation commit; clean/staged Bundle
`1.5.0` artifact; exact APPLY-plan digest; fresh live database state equal to plan
preconditions; auth-service stopped and proven not serving; and separate
production-apply authorization. It MUST use one serializable transaction,
optimistic expected Grant version `1 -> 2`, and conditional exact Audience-scope
update. Deterministic transaction errors before commit MUST roll back. A timeout,
connection loss, or process death after commit could have started is
`OUTCOME_UNKNOWN`: stop, keep auth-service stopped, perform read-only
reconciliation of Audience/Grant/audit, and never retry or roll back based on an
assumption.

### CTR-FMG-008 — Conflict semantics are fail-closed

Before the first authorized apply, the only compatible states are: exact source
Audience `[forum.read,forum.write]` plus Grant `[forum.read,forum.write]@v1` and no
FMG audit; or exact target Audience `[forum.moderate,forum.read,forum.write]` plus
Grant `[forum.moderate,forum.read,forum.write]@v2` plus the exact FMG audit.
Every mixed, partial, extra/missing-scope, wrong-version, duplicate-audit, or
otherwise drifted state is conflict. Conflict means Audience/Grant/audit writes
all `0`; no overwrite, union, repair, narrowing, last-write-wins, or alternate
Client selection.

### CTR-FMG-009 — Exact rerun is NOOP

When exact target Audience, target Grant, and exact governed audit already exist,
plan MUST emit the deterministic `EXACT_RERUN_NOOP` document/digest from
`CTR-FMG-003`; apply consuming that NOOP digest MUST perform Audience writes `0`,
Grant writes `0`, audit writes `0`, and return the same safe target projection.
A rerun MUST NOT increment version, create a duplicate audit, or rewrite
semantically equivalent JSON.

### CTR-FMG-010 — Same-transaction exact immutable Grant audit

A real apply MUST append exactly one `grant_change_audits` row in the same
transaction as both allowed database changes, using exactly the closed 13 fields:
`migration_id`, `source_git_commit`, `operator_id`, `approval_ref`, `reason`,
`client_id`, `change_type`, `expected_grant_version`,
`resulting_grant_version`, `before_value`, `after_value`, `timestamp`,
`change_id`.
Values are frozen as follows:

```text
migration_id = forum-moderator-grant-supply-v1
source_git_commit = exact reviewed implementation commit (40 lowercase hex)
operator_id = separately authorized production operator
approval_ref = exact separate production-apply authorization reference
reason = forum_moderator_grant_supply_v1 plan_sha256=<64 lowercase hex>
client_id = mc_hvEfjkJ5BTKA8HZXRmbzNVw0
change_type = replace
expected_grant_version = 1
resulting_grant_version = 2
change_id = fresh UUID
```

`before_value` and `after_value` MUST be complete closed Grant snapshots with
`client_kind=machine`, `principal_type=agent`, `human_audience_grants=[]`,
`delegation_grants={}`, `status=active`, and the complete
`machine_access_grants`: Workflow remains `[workflow.read]`; Forum changes only
from `[forum.read,forum.write]` to
`[forum.moderate,forum.read,forum.write]`; version changes `1 -> 2`. The governed
audit identity is the unique pair `(migration_id, client_id)`, so the older fleet
supply audit cannot satisfy it. Audit failure rolls back Audience and Grant.
External refs, secrets, tokens, raw Authorization, and credential material MUST
NOT enter audit JSON.

### CTR-FMG-011 — Post-apply verification is split

`verify-state` is read-only and MUST re-resolve exact identity and assert:
running Bundle identity is exactly `1.5.0`; executable and database Audience
entries are equal and contain exactly the three Forum scopes; target Forum Grant
is exact target @v2; target Workflow and remaining 85/non-target rows are
unchanged; exactly one governed FMG audit exists.

`verify-mint` is a distinct functional production-verification action, not
read-only. It MUST require an explicit verification authorization reference
separate from apply, then request exactly `resource=svc-forum` and
`scope=forum.read forum.write forum.moderate` through real
`client_credentials`. It may inspect only the safe claim projection
`iss,aud,sub,client_id,principal_type,agent_id,scope,exp`; the token remains only
in memory and is never printed or persisted. Failure of either verification does
not trigger automatic apply retry or rollback.

### CTR-FMG-012 — Secret/token non-disclosure

Plan, apply, verify, errors, audit rows, stdout, stderr, test diagnostics, PR
artifacts, and reports MUST contain no Client secret, credential-store content,
access token, refresh token, Basic material, Bearer material, or raw
Authorization. Tests MUST use unique canaries and scan every captured channel.

### CTR-FMG-013 — Legacy OpenClaw Client is forbidden

No phase may query by, resolve to, copy from, mutate, grant, or verify through any
`mc_oc_*` Client. In particular,
`mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd` MUST remain non-target with writes zero. Any
attempted substitution MUST fail before writes.

### CTR-FMG-014 — Exact implementation closure

After independent review and a separate acceptance transaction, source
implementation MAY modify exactly these 18 files and no others:

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
src/lib/oauth/v1/contract.ts
tests/helpers/load-candidate-snapshot.ts
tests/oauth/candidate-contract.test.ts
tests/oauth/contract-runtime-v1.test.ts
scripts/supply-forum-moderator-grant-v1.ts
scripts/run-forum-moderator-grant-supply-v1-conformance.sh
tests/oauth/supply-forum-moderator-grant-v1.test.ts
```

The first 15 files are limited to the `1.4.0 -> 1.5.0` synchronized version,
linkage, exact registered-scope, fixtures, and consumer-evidence delta.
`src/lib/oauth/v1/contract.ts` may only add `1.5.0` to the supported-version
allowlist. The final three files own only the one-off exact plan/apply/verify
implementation and tests. A nineteenth file or any generic Auth API/schema
change requires a new Owner decision and independently reviewed authority.

### CTR-FMG-015 — Bundle predecessor and no-live-mismatch activation

Implementation MUST start from a base containing merged, conformant Bundle
`1.4.0`. Bundle `1.5.0` validation, candidate/runtime tests, positive moderator
fixture, retained negative `forum.admin`/wildcard fixtures, and exact consumer
matrix MUST pass before planning. Source merge creates no database change.

Production activation MUST be one separately authorized maintenance transaction:
(1) stage exact `1.5.0` artifact without activating it; (2) stop auth-service and
prove no token endpoint is serving; (3) revalidate APPLY plan and execute the
single database transaction; (4) install/activate exact staged `1.5.0`; (5)
restart; (6) require health plus `verify-state`; (7) only then optionally run
separately authorized `verify-mint`. The service MUST never serve while executable
and database Audience registered scopes differ. If artifact activation/restart
fails after database commit, keep service stopped and enter reconciliation;
never restart against a mismatched Bundle.

### CTR-FMG-016 — Production apply is separately authorized

This Spec has `PRODUCTION_APPLY_AUTHORITY = none`. Spec acceptance, source
implementation, test pass, implementation merge, or Auth deployment MUST NOT be
interpreted as authority to apply the Grant. A later exact production-apply
authorization MUST bind the implementation commit, staged Bundle `1.5.0`
identity/digest, APPLY-plan digest, pre-state snapshot/digest, operator,
maintenance window/outage approval, stop/start commands, rollback plan, and
state-verification commands. Functional mint verification requires its own
explicit authorization reference. Without the apply authorization, `--apply`
MUST refuse before database connection or writes.

### CTR-FMG-017 — Rollback is a forward migration, never automatic

Rollback requires its own reviewed implementation/artifact and exact production
authorization; it is not part of the 18-file implementation closure. Its
canonical plan MUST bind exact target pre-state, prior Bundle `1.4.0` artifact,
operator/window, and produce a new forward Grant revision `2 -> 3` whose Forum
scopes are `[forum.read,forum.write]` while Workflow stays unchanged. In one
serializable stopped-service transaction it MUST restore only the
`svc-forum` database Audience registered scopes to read/write, update the exact
Grant to @v3, and append a separate closed-envelope audit with
`migration_id=forum-moderator-grant-supply-v1-rollback`, `change_type=replace`,
expected/resulting versions `2/3`, fresh `change_id`, and complete @v2/@v3
snapshots. Then exact
Bundle `1.4.0` is activated before restart. Version `1` is never reused or
rewritten. Unknown outcome stops for read-only reconciliation; automatic blind
reverse, Client revocation, credential rotation, and non-target rollback are
forbidden.

### CTR-FMG-018 — Lifecycle separation

While proposed, implementation authority is none. A future acceptance transaction
must bind the independently reviewed exact head and may activate
`implementation_authority: contracts`; it MUST preserve
`PRODUCTION_APPLY_AUTHORITY = none`. Acceptance, implementation, merge,
deployment, apply, verify, and rollback are distinct recorded lifecycle actions.

## 10. Acceptance

Implementation Acceptance uses a clean Auth worktree based on merged conformant
Bundle `1.4.0`, an isolated disposable PostgreSQL database containing exact
source/target/drift fixtures, hermetic token tests, and no production credential.
Every current item requires the named test/log/projection plus exact Git
coordinates. `ACC-FMG-009` is explicitly deferred evidence for the separate
future rollback authority required by `CTR-FMG-017`; it is not satisfiable by and
is not a merge gate for the 18-file forward implementation.

### ACC-FMG-001 — Whole successor authority and Bundle delta

- Contracts: `CTR-FMG-002`, `CTR-FMG-014`, `CTR-FMG-015`
- Environment: shared clean `1.4.0` implementation environment.
- Method: validate exact 18-file diff, Bundle/candidate/runtime suites, complete
  Audience entry, consumer matrix pinned to `502cfca5...`, and fixture polarity.
- Required evidence: validator/test logs, canonical Audience projection, version
  identity, consumer matrix, and file name-status.
- Expected result: synchronized `1.5.0`; exact three Forum scopes; preserved
  RS256/known-kid/exact issuer+audience/agent-id/no-owner dependency; HS256,
  unknown-kid/scope, admin, and wildcards negative; independent exact consumer
  review recorded; no nineteenth file.
- Failure condition: omitted inherited obligation, extra semantic delta, scope,
  file, audience field, or version mismatch.

### ACC-FMG-002 — Exact identity and canonical APPLY/NOOP plans

- Contracts: `CTR-FMG-001`, `CTR-FMG-003`, `CTR-FMG-006`, `CTR-FMG-013`
- Environment: isolated DB fixtures for exact source/target plus identity errors.
- Method: exact, absent, duplicate, inactive, wrong Principal/public Client ID,
  and `mc_oc_*`; independently canonicalize and hash APPLY and NOOP documents.
- Required evidence: both canonical bytes/digests, safe projections, write counters.
- Expected result: exact source emits APPLY; exact target+audit emits distinct
  deterministic NOOP; negatives conflict; every plan writes zero.
- Failure condition: same digest, ambiguous classification, substitution, secret,
  or any plan-time write.

### ACC-FMG-003 — Coordinated Audience/Grant apply and invariants

- Contracts: `CTR-FMG-004`, `CTR-FMG-005`, `CTR-FMG-007`
- Environment: isolated serializable DB with all 86 projections, non-target rows,
  Workflow/Human/Delegation/legacy data, and simulated stopped-service gate.
- Method: APPLY digest success; running-service denial; conditional Audience and
  Grant updates; concurrent conflict; pre-commit deterministic fault.
- Required evidence: before/after full snapshots, transaction/write counters,
  stopped-service proof fixture, and unchanged-row hashes.
- Expected result: one Audience field update + one exact Grant @v2 + one audit in
  one commit; every invariant byte-equivalent; deterministic faults roll back.
- Failure condition: partial commit, service-running apply, non-target/Workflow
  change, stale update, or write outside the two allowed fields/audit.

### ACC-FMG-004 — Conflict, exact rerun, and unknown outcome

- Contracts: `CTR-FMG-008`, `CTR-FMG-009`, `CTR-FMG-007`
- Environment: exact source, exact target+audit, every mixed partial state,
  duplicate/missing audit, and post-commit connection-loss fixtures.
- Method: classify all states; consume NOOP digest; inject outcome-unknown.
- Required evidence: classification/digest matrix, all three write counters, and
  reconciliation projection after unknown outcome.
- Expected result: source APPLY; target NOOP with all writes zero; drift conflict;
  unknown outcome reconciles before any later action and never blind-retries.
- Failure condition: mixed state accepted, duplicate audit/version, or assumed
  rollback/success after connection loss.

### ACC-FMG-005 — Exact closed Grant audit

- Contracts: `CTR-FMG-010`
- Environment: successful and audit-failure transaction fixtures, including older
  fleet audit for the same Client.
- Method: compare all 13 field names/values, complete snapshots, reason digest,
  unique `(migration_id,client_id)`, and atomic fault behavior.
- Required evidence: canonical audit projection and transaction log.
- Expected result: exactly one FMG audit; older audit cannot satisfy rerun;
  Audience/Grant/audit commit or roll back together.
- Failure condition: missing/extra field, ambiguous identity, secret, incomplete
  snapshot, duplicate row, or non-atomic commit.

### ACC-FMG-006 — Activation equality and split verification

- Contracts: `CTR-FMG-011`, `CTR-FMG-015`, `CTR-FMG-016`
- Environment: isolated service lifecycle harness plus separately authorized
  production evidence only when that later authorization exists.
- Method: prove no serving during mismatch; start exact `1.5.0`; run health and
  `verify-state`; test `verify-mint` denial without its own authorization and safe
  success under a hermetic credential fixture.
- Required evidence: process/health timeline, executable/database Audience equality,
  state report, mint authorization reference, and safe claim projection.
- Expected result: service never serves mismatched state; state verify is read-only;
  functional mint is separately gated and token never appears.
- Failure condition: live mismatch, mint under apply authorization alone, unsafe
  claim/output, or automatic retry/rollback on verification failure.

### ACC-FMG-007 — Secret non-disclosure

- Contracts: `CTR-FMG-010`, `CTR-FMG-012`
- Environment: all plan/apply/reconcile/verify/audit/error paths with unique
  credential/token/Auth canaries.
- Method: scan canonical plans, results, errors, audit JSON, stdout/stderr, logs,
  and test diagnostics.
- Required evidence: channel-by-channel canary scan report.
- Expected result: zero secret/token/Basic/Bearer/raw Authorization occurrence.
- Failure condition: any canary or credential material appears.

### ACC-FMG-008 — Production apply authority gate

- Contracts: `CTR-FMG-016`, `CTR-FMG-018`
- Environment: isolated CLI with no DB connection spy and authorization variants.
- Method: missing/incomplete authorization, wrong commit/artifact/plan digest,
  no outage approval, stale window, and exact fixture.
- Required evidence: refusal codes, DB connection/write counters, lifecycle fields.
- Expected result: every invalid case refuses before DB connection; proposed and
  implementation PRs both have Grant/production change none.
- Failure condition: DB access without exact authorization or implied apply from
  acceptance/merge/deploy.

### ACC-FMG-009 — Deferred forward-rollback evidence requirement

- Contracts: `CTR-FMG-017`
- Environment: future separately accepted rollback implementation, isolated exact
  target @v2, stale/mixed state, outcome-unknown, and stopped-service Bundle 1.4
  activation harness.
- Method: before any rollback authorization, validate its new exact closure and
  canonical plan, @v2 -> @v3, Audience restore, `replace` audit, stale conflict,
  and unknown reconciliation.
- Required evidence: future rollback Spec/implementation heads, plan/digest, full
  @v2/@v3 snapshots, 13-field audit projection, lifecycle timeline, counters.
- Expected result: only exact target can forward-migrate to @v3 and Bundle 1.4;
  version 1 never reused; stale/unknown never blind-retries.
- Failure condition: attempting rollback under this forward implementation,
  backward version rewrite, automatic rollback, live mismatch, non-target
  mutation, or missing audit.
- Current disposition: `DEFERRED_NOT_A_FORWARD_IMPLEMENTATION_MERGE_GATE` because
  `CTR-FMG-017` forbids implementing rollback inside `CTR-FMG-014`.

### ACC-FMG-010 — Docs-only and acceptance lifecycle boundary

- Contracts: `CTR-FMG-018`
- Environment: this authoring PR and future exact acceptance transaction.
- Method: inspect authoring diff; on acceptance require reviewed-head binding,
  whole-successor metadata, and atomic backlinks in all three superseded Specs.
- Required evidence: exact PR heads, file lists, reviewer/acceptor records, and
  lifecycle metadata.
- Expected result: authoring adds one proposed Spec only; acceptance is docs-only;
  product/Grant/production changes remain none.
- Failure condition: missing backlink, partial supersession, product file, active
  authority while proposed, or production side effect.

## 11. Alternatives and disposition

- `ALT-FMG-001` — grant `forum.moderate` without registering it: **rejected**;
  current Auth authority and executable registry fail closed.
- `ALT-FMG-002` — grant all 86 Agents: **rejected**; target count is exactly one.
- `ALT-FMG-003` — use `forum.admin`: **rejected**; deployed admin unread consumes
  `forum.moderate` and no broader scope is needed.
- `ALT-FMG-004` — wildcard: **rejected** by least privilege and negative fixtures.
- `ALT-FMG-005` — reuse historical OpenClaw moderator Client: **rejected**;
  Agent Core identity and credential authority is the exact `agentcore:v1:*`
  tuple.
- `ALT-FMG-006` — mutate Principal/Client/Credential while granting: **rejected**;
  identity restoration and Grant supply are separate authorities.
- `ALT-FMG-007` — apply in the implementation PR: **rejected**; production apply
  requires a later exact authorization.
- `ALT-FMG-008` — generic online Grant API: **rejected**; one-off closed migration
  is narrower and leaves no permanent broad administration surface.

## 12. Migration, compatibility, and rollback

```text
PHASE 0 = verify merged/conformant Bundle 1.4.0 predecessor
PHASE 1 = implement/test Bundle 1.5.0 + combined Audience/Grant migration code
PHASE 2 = merge source only; build/stage exact 1.5.0 artifact without activation
PHASE 3 = produce fresh read-only APPLY or NOOP plan/digest (writes 0)
PHASE 4 = obtain separate exact production-apply + outage authorization
PHASE 5 = stop auth-service and prove no token endpoint is serving
PHASE 6 = revalidate APPLY plan; one transaction updates Audience + Grant + audit
PHASE 7 = activate exact staged Bundle 1.5.0; restart; health; verify-state
PHASE 8 = optionally obtain separate functional verification authorization and mint
PHASE 9 = exact rerun emits/consumes NOOP digest with all writes 0
```

Any failure before Phase 6 leaves database state unchanged. Any failure after
Phase 6 keeps auth-service stopped until executable/database state is reconciled.
Unknown outcome during Phase 6 enters read-only reconciliation, never retry by
assumption. Rollback is the separately implemented/authorized forward migration
in `CTR-FMG-017`; it is never implied by this Spec.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
PRODUCTION_APPLY_AUTHORITY = none
```

Non-normative follow-up: independent semantic review of this exact proposed head,
then a separate owner acceptance transaction before source implementation.

## 14. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
EXTERNAL_AUTHORITIES = NONE (pinned consumer implementation dependency in §3.1)
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 18
CONTRACTS_WITH_ACCEPTANCE = 18
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
GRANT_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

---

## 15. Revision record — 2026-08-28 production read-only reconfirmation (授权 执行 R2)

This revision is docs-only and purely additive. §1–§14 are byte-preserved.
This section records the fresh production read-only reconfirmation that
`STATE-FMG-005` / `CLM-FMG-004` explicitly deferred, plus a base update.

### 15.1 Base update

The authoring branch was rebased from `d529bd3c` onto current
`github/main@51a11af57ce39eafac5883e0c32474ea06906b8e` (PR #31 merge). The
branch's only content is this Spec file; the rebase changed no semantics.
At `51a11af` the executable bundle is still `registry_version=1.3.0` with
exactly five audiences and `svc-forum.registered_scopes=[forum.read,
forum.write]`, so `OBS-FMG-001` / `STATE-FMG-001` / `STATE-FMG-003` remain
current (Bundle `1.4.0` accepted but still unmerged; PR #29 draft).

### 15.2 Fresh production read-only observation (2026-08-28)

`OBS-FMG-006` — Production Auth state re-read (read-only `SELECT` via the
read-only database role; no write, no secret or credential material read or
reproduced; observed 2026-08-28):

```text
machine_principals: agent_id='agt_course-community-agent-2'
  -> id = 9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56, display_name='论坛版主',
     principal_type=agent, status=active
machine_clients: client_id='mc_hvEfjkJ5BTKA8HZXRmbzNVw0'
  -> internal id = 7f35380c-f155-4275-b29f-307a3335775a,
     machine_principal_id = 9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56 (exact bind),
     status=active, revoked_at=null,
     external_ref='agentcore:v1:client:agt_course-community-agent-2'
clients_of_target_principal = exactly 1 row (mc_hvEfjkJ5BTKA8HZXRmbzNVw0)
machine_access_grants(client):
  svc-forum  {forum.read, forum.write}   version 1  revoked_at=null
  svc-workflow {workflow.read}           version 1  revoked_at=null
auth_audiences: audience_id='svc-forum'
  -> registered_scopes={forum.read, forum.write}, status=active, version=1
machine_access_grants rows containing 'forum.moderate' (any client) = 0
active machine_clients with external_ref LIKE 'agentcore:v1:client:%' = 88
```

### 15.3 Resolutions recorded

- `STATE-FMG-005` / `CLM-FMG-004` (production Audience source state was an
  OPEN_ASSUMPTION) are **resolved by `OBS-FMG-006`**: the live production
  `auth_audiences` row equals the exact `CTR-FMG-008` source state
  (`[forum.read,forum.write]`, active, version 1). A future plan still MUST
  re-read live state; this reconfirmation does not substitute for the plan-time
  read.
- `CTR-FMG-001` identity closure is reconfirmed with the concrete UUIDs: the
  exact Principal UUID is `9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56` and the exact
  Client internal id is `7f35380c-f155-4275-b29f-307a3335775a`; the Client is
  the **sole** client of that Principal. No identity ambiguity remains on the
  target tuple.
- Identity near-collisions exist and are explicitly non-target (recorded so no
  future resolution step matches them): `course-community-agent-2` **without**
  the `agt_` prefix (`132ab857-35ab-408b-b909-bc0b1deab55b`, display
  `论坛版主` — the Principal of the forbidden legacy client
  `mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd`), `course-community-agent`
  (`1f5b6d46-4abd-4964-9575-1ccad219a1b2`), and `agt_course-community-agent`
  (`aaaf53e6-140b-4af4-9e34-82d0e6c92f2d`). Prefix-less and display-name
  matching remain forbidden by `CTR-FMG-001`'s exact-`external_ref`/`agent_id`
  resolution.
- Fleet count drift: the pinned `OBS-FMG-003` snapshot carried the exact-86
  fleet baseline; live active `agentcore:v1:client:*` count is now 88. This is
  expected fleet growth, not a conflict: `CTR-FMG-005`'s operative invariant is
  that **every non-target Client row has Grant writes zero and audit writes
  zero**; the literal "85" in `CTR-FMG-005` reads as the snapshot-bound count
  and the future plan counts non-targets dynamically from live state.
- `CLM-FMG-001` (grant-only implementation fails closed) gains concrete source
  coordinates in the deployed V1 path: `src/lib/oauth/v1/direct.ts` requires
  bundle/DB audience equality (`findV1AudienceMismatch` →
  `audience_registry_mismatch:<field>`) and requires every granted scope to be
  a member of `runtimeAudience.registeredScopes` (else
  `machine_grant_state_invalid`, whole-grant fail-closed — a Grant row carrying
  `forum.moderate` before registration would break even the existing
  `forum.read`/`forum.write` minting for that Client). This confirms the
  §CTR-FMG-004 both-fields-together transaction ordering.

### 15.4 Sister-spec linkage

The Agent Core Broker consumer surface that first requires `forum.moderate` is
specified in `mayf3/dsh-agent-core` proposed Spec
`AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1` (branch
`docs/forum-moderation-capabilities-v1`, same round). Neither spec authorizes
the other's implementation; both stay `proposed` with
`implementation_authority: none`.

### 15.5 Revision result

```text
REVISION_ROUND = 2 (授权 执行 reconfirmation)
REBASED_BASE = github/main@51a11af (from d529bd3c; spec content unchanged by rebase)
SPEC_SECTIONS_1_14 = BYTE_PRESERVED
STATE_FMG_005 = RESOLVED_BY_OBS_FMG_006 (live audience = CTR-FMG-008 source state)
CLM_FMG_004 = SUPPORTED (was OPEN_ASSUMPTION)
MODERATOR_PRINCIPAL_UUID = 9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56
IDENTITY_AMBIGUITY = NONE_ON_TARGET (near-collisions recorded non-target)
FLEET_LIVE_COUNT = 88 active (snapshot 86; non-target invariant unchanged)
STATUS = proposed (unchanged)
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
GRANT_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```
