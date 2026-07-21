# Change Log

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
