# Change Log

## 1.4.0 — 2026-08-24

- CCR: `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1` (accepted)
  implemented via `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2`
  (accepted; exact 16-file closure authority; whole-Spec successor to
  `IMPLEMENTATION_CLOSURE_V1`, which is superseded by it) — registered
  `agent-core-notification-ingress-v1` into the Minimal Auth V1 Audience Registry.
- Frozen entry (field-by-field, per CTR-NI-001 / CTR-NIC-002):
  `audience_id=agent-core-notification-ingress-v1`,
  `resource_service=agent-core-notification-ingress-v1`,
  `scope_namespace=notification`, `accepted_principal_types=["service"]`,
  `human_access_enabled=false`, `machine_access_enabled=true`,
  `delegated_access_enabled=false`, `registered_scopes=["notification.deliver"]`,
  `status=active`, `freeze_ready=true`.
- `notification.send`, `notification.*`, wildcard and any other Scope remain
  unregistered (forbidden set, CTR-NI-003).
- Added positive fixture `direct-service-notification-ingress` — the first
  `principal_type=service` Direct Machine positive fixture (RS256 + tracked
  fixture kid, iss=auth-service, aud=agent-core-notification-ingress-v1, no
  `agent_id`, scope=notification.deliver, exact requested-scope equality,
  grant subset notification.deliver).
- Added 11 negative cases: agent principal, human principal, delegated/OBO,
  wrong audience, `auth.identity.provision` foreign scope, unregistered
  `notification.send`, `*` wildcard, `notification.*` namespace wildcard,
  grant-exceeding request, cross-Audience Grant reuse (svc-auth +
  auth.identity.provision), extra requested Scope — every case rejected whole,
  no downscoping. Dedicated `SCOPE_OUTPUT_MISMATCH` cases are structurally
  unnecessary for this Audience: with exactly one registered Scope, exact
  requested/issued equality plus strict registration makes a valid-but-different
  requested set unrepresentable; mismatch-shaped requests fail earlier as
  `INVALID_SCOPE_NAMESPACE` (extra-requested-scope case).
- `validate.mjs` first-wave registry set literal extended with
  `agent-core-notification-ingress-v1` (validator gate
  `registry: first-wave Audience set changed`). NOTE: this file is OUTSIDE the
  accepted Child Spec's frozen 15-file closure and is carried under
  `OWNER_DECISION_REQUIRED` drift reporting — see PR description; omission makes
  the validator fail closed while all other gates pass.
- Version linkage: `contract_version` / `registry_version` promoted
  1.3.0 → 1.4.0 across manifest, registry, manifest schema const, freeze gates,
  consumer matrix, positive/negative fixtures, schema instances, ADC scope map
  and llm-todo candidate; runtime allowlist (`src/lib/oauth/v1/contract.ts`) and
  candidate loader allowlist + the two version-expectation tests add/expect
  `1.4.0` (`LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, allowlist-only).
- No Grant created, modified or enlarged (CTR-NI-004/CTR-NIC-006); no
  Principal/Client/secret created; no product-code change beyond the frozen
  allowlist literals; no production apply, deploy or database change.

## 1.3.0 — 2026-08-21

- CCR: `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`（accepted）— registered `svc-forum`
  into the Minimal Auth V1 Audience Registry; absorbed the pre-CCR authority drift
  in the executable artifacts (`audience-registry.json`, `contract-manifest.json`,
  `consumer-verification-matrix.json`, `validate.mjs`) that lacked a normative
  parent-contract amendment.
- Parent contract AMEND: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2
  moves `svc-forum` from the exclusion list into the Bundle Audience list;
  `docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` §6 removes `svc-forum`
  from the Legacy/unmigrated set. `llm-todo` / `workflow-todo` exclusions unchanged.
- Frozen entry (field-by-field, per CTR-FR-002):
  `audience_id=svc-forum`, `resource_service=svc-forum`, `scope_namespace=forum`,
  `accepted_principal_types=["agent"]`, `human_access_enabled=false`,
  `machine_access_enabled=true`, `delegated_access_enabled=false`,
  `registered_scopes=["forum.read","forum.write"]`, `status=active`,
  `freeze_ready=true`, `notes="Registered by AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1;
  machine-only agent access via standard OAuth2 client_credentials."`.
- `forum.admin`, `forum.moderate`, `forum.*`, `*` and any other scope remain
  unregistered (forbidden set, CTR-FR-004).
- Added positive fixture `direct-agent-svc-forum` (RS256 + kid, iss=auth-service,
  aud=svc-forum, principal_type=agent, agent_id present,
  scope="forum.read forum.write"; signed with the existing tracked test-only
  fixture key `fixture-key-v1-svc-okr-canary-20260719`).
- Added negative cases: `forum.admin` / `forum.moderate` / `*` / `forum.*`
  scope rejection, wrong aud (`agent-forum`), wrong issuer, missing `agent_id`,
  plus `compact-jwt-unknown-kid-svc-forum` signature case.
- `validate.mjs`: Direct Machine fixtures with `principal_type=agent` now require
  a non-empty `agent_id` (closes the fixture-validator gap for the consumer-side
  CR-06 requirement; no new fixture semantics introduced).
- Consumer Verification Matrix update: svc-forum entry re-pinned from the drift-era
  `cb7ca300…` (`feat/svc-forum-standard-oauth`) to the reviewed exact commit
  `mayf3/agent-forum@1cccdd54554c0bde13572273401f19f294334e46`
  (tree `7ee57577f3d1cbe5aa83cc2c2ead9ee7ce88f99d`, `origin/main`,
  `fixed_remote_sha=true`); `migration_status` → `completed` records the passed
  exact-commit consumer migration review — not a production cutover claim
  (first-wave aggregate stays not ready; production deployment stays not_ready).
- Version linkage: `contract_version` / `registry_version` promoted 1.2.0 → 1.3.0
  across manifest, registry, freeze gates, consumer matrix, positive/negative
  fixtures, schema instances, ADC scope map and llm-todo candidate; manifest
  dangling `audience_registry_version` aligned to 1.3.0 (OQ-FR-003).
- No Grant created, modified or enlarged (CTR-FR-008); no product-code change.

## 1.2.0 — 2026-07-22

- Registered `svc-okr.registered_scopes=["okr.read", "okr.write"]`.
- Added coarse-grained `okr.write` scope for svc-okr write API access.
- No product_role claims: `PRODUCT_ROLES_IN_TOKEN=false` remains enforced.
- Updated frozen runtime contract with new digest.
- Added conformance: agent + okr.read + okr.write issues RS256 JWT.

## 1.1.0 — 2026-07-20

- CCR: Enabled svc-okr Agent machine access via Draft Contract Candidate.
- Added `agent` to `svc-okr.accepted_principal_types`.
- Set `svc-okr.machine_access_enabled=true`.
- Registered `svc-okr.registered_scopes=["okr.read"]`.
- Added `direct-agent-svc-okr` positive fixture and 5 negative fixture cases.
- Updated Consumer Verification Matrix: svc-okr kind → `human-and-machine-resource-consumer`.
- All scopes, grants, audience definitions remain otherwise unchanged.
- `PRODUCT_ROLES_IN_TOKEN=false` remains enforced.
- `okr.write` and `okr.admin` remain unregistered.

## 1.0.0 — 2026-07-18

- Recorded the independent remote-object review PASS for draft.2 at commit
  `62ad3ec89c52e0fc4936279c23d2346706b948fa` and tree
  `9347e9297fefaad7bcd0347637336df0c39bc03c`.
- Closed the only remaining Contract Bundle Freeze gate and promoted the
  Manifest, Registry, schemas and fixtures to frozen source contract `1.0.0`.
- Authorized implementation against the frozen source Bundle while retaining
  Production Deployment as `NOT_READY` and Consumer Migration as
  `NOT_STARTED`.
- Kept the production exact JWKS URL `null`; no hostname, certificate, route or
  live deployment is asserted by this release.
- Kept all out-of-scope Legacy consumer migration gates deferred and
  non-blocking for source Bundle Freeze.
- Corrected the Bundle README lifecycle field to
  `lifecycle.contract_bundle_freeze.status`.

## 1.0.0-draft.2 — 2026-07-18

- Split lifecycle reporting into independent Contract Bundle Freeze,
  Production Deployment and Consumer Migration states.
- Limited the first-wave Bundle and conformance inventory to `auth-service`,
  `svc-workflow`, `svc-okr` and `adc-v2`; retained `svc-forum`,
  `workflow-todo` and `llm-todo` as non-blocking Legacy migration records.
- Froze the JWKS path, RS256/`kid`, issuer/audience, cache, key-retention and
  fail-closed behavior without inventing a production hostname or URL.
- Restored the V0 Token Exchange request field `audience` and added explicit
  success/rejected Exchange Audit variants with a required `result`.
- Bound no-downscope fixtures to an independent `requested_scope` and added
  concrete partial-grant and output-mismatch rejection cases.
- Added public-only JWKS fixtures and real compact-JWT RS256 verification,
  including invalid-signature, algorithm-confusion and unknown-`kid` cases.
- Added a Contract Manifest schema plus strict Draft 2020-12 meta-schema and
  representative instance validation for all Bundle schemas.
- Moved real-process Human Session/Refresh conformance after implementation;
  it no longer blocks the initial source Contract Bundle Freeze.

## 1.0.0-draft.1 — 2026-07-18

- Created an explicitly non-frozen machine-executable Bundle.
- Preserved V0 machine wire claims: `client_id`, `jti`, `nbf`, Direct
  `token_use=access` and OBO `token_use=workflow_obo`.
- Added Human, Direct Machine and Delegated Access Token schemas.
- Separated Human Audience, Machine Access and Delegation Grants.
- Added strict no-downscope Scope rules and fixtures.
- Added accepted source audiences, trusted proxy and persistent exchange audit
  schemas.
- Added Human Session, opaque Refresh Credential and replay-family revocation
  schemas.
- Defined Authorization Code + PKCE S256 as the only first-bundle Human Client
  binding flow; both public and confidential clients use PKCE.
- Defined first-bundle Grant administration as versioned, audited, optimistic,
  forward-only database migrations with no online Grant management endpoint.
- Froze candidate Authorization Code and Refresh Credential opaque wire formats,
  Human refresh request/response shapes, OAuth error status mapping and cache
  headers for review.
- Closed the runtime-parameter review gate after checking the candidate values
  against V0 compatibility, derived retention bounds and current IETF security
  guidance; the deployment-specific exact JWKS URL remains open.
- Replaced the over-broad candidate `adc.invoke` with `adc.read` and
  `adc.execute`, added a fixed-SHA route/exchange map and closed the ADC ingress
  Scope review gate.
- Added a full llm-todo route-group authorization candidate using
  `todo.read/write/invoke/admin`; kept its freeze gate open for explicit product
  decisions that cannot be recovered from permissive Legacy code.
- Recorded live deployment evidence that the default IP certificate is
  self-signed without SAN and the public/backend JWKS routes are not live; kept
  the exact JWKS URL gate open for a deployment-owner-provided trusted origin.
- Corrected resource topology to `svc-forum` and `llm-todo`; retained
  `workflow-todo` as a Client, not an Audience.
- Recorded unresolved deployment, consumer SHA and scope decisions as freeze
  gates rather than guessing frozen values.
