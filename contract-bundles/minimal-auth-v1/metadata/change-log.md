# Change Log

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
- Corrected resource topology to `svc-forum` and `llm-todo`; retained
  `workflow-todo` as a Client, not an Audience.
- Recorded unresolved deployment, consumer SHA and scope decisions as freeze
  gates rather than guessing frozen values.
