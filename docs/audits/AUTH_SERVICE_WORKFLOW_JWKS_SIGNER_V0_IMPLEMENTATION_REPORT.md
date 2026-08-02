# auth-service — Workflow RS256 Signer + JWKS V0 (PR-A) Implementation Report

## AGENT_ROLE
Implementer (ZCode, direct implementation). Originally delegated to hy3 via the
`codebuddy-hy3` skill; hy3 produced zero output across two ~8-min runs and was
killed. Implemented directly against the frozen plan.

## ORIGINAL_WORKTREE_STATUS
Main worktree `auth-service` left UNTOUCHED
(branch `feat/openclaw-agent-auth-token-get-v0`, dirty working tree with
pre-existing untracked docs/reports). All work was done in a NEW isolated worktree.

## CLEAN_WORKTREE_PATH
`auth-service-workflow-jwks`

## BRANCH
`feat/workflow-jwks-signer-v0`

## BASE_SHA
`8ca5fcb48a40bbb4d6909d0499372959d26d0440` (== main at task start)

## FINAL_HEAD_SHA
`1bec951946e830e3f4c2c60d9d5175514ab9a393`

## COMMITS
2 implementation commits (max allowed = 2):
1. `ebe9c8c` — `feat: add workflow RS256 signer and JWKS`
2. `1bec951` — `test(workflow-jwks): add RS256/JWKS tests and formal contract`

No push, tag, merge-into-main, or amend performed.

## MODIFIED_FILES
17 files, +1609 / −18.
- New src: `src/lib/oauth/workflow-keyring.ts`, `src/lib/oauth/workflow-signer.ts`, `src/routes/well-known.ts`
- Modified src: `src/config/env.ts`, `src/lib/oauth/audit.ts`, `src/lib/oauth/token-issuance.ts`, `src/routes/service-registrations.ts`, `src/server.ts`
- New tests: `tests/oauth/_workflow-test-keys.ts`, `workflow-keyring.test.ts`, `workflow-signer.test.ts`, `workflow-rotation.test.ts`, `workflow-compatibility.test.ts`, `verify-token-routing.test.ts`, `workflow-jwks-endpoint.test.ts`
- New doc: `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md`
- Modified: `package.json` (added new test files to `test:oauth`)

## CONFIGURATION_MODEL
Env-driven, read live from `process.env` by the keyring (not the module-load
snapshot, so rotation-via-reload and tests work):
- `JWT_PRIVATE_KEY` — inline PEM (PKCS#8) active private key. Takes precedence over the file var.
- `JWT_PRIVATE_KEY_FILE` — path to the active private key PEM.
- `JWT_KID` — active key id (required when workflow enabled); format `key-v1-<YYYYMMDD>`.
- `JWT_PREVIOUS_PUBLIC_KEYS` — newline-separated `<kid>|<PEM>` previous PUBLIC keys (verification only).
Workflow is OPTIONAL: if unset, svc-workflow issuance fails closed
(`workflow_keyring_not_configured`) and existing HS256 operation is unaffected.

## RSA_KEY_MODEL
- Exactly ONE active RSA private key (≥2048-bit, PKCS#8). Zero+ previous PUBLIC keys.
- Validated once at load: unparseable / non-RSA / <2048-bit / missing kid /
  duplicate active-kid / duplicate previous-kid ⇒ **throw at startup**.
- Private key held only in the signer's memory; never serialized to JWKS/logs/API.
- Public JWKs built by deriving the public key from the private key (defense-in-depth
  against private-param leakage even though export of a public KeyObject yields only n/e).

## JWKS_ENDPOINT
`GET /.well-known/jwks.json` — unauthenticated. Body precomputed lazily on first
request (cached), reused thereafter.

### JWKS_RESPONSE_EXAMPLE
```json
{"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":"key-v1-20260716","n":"<base64url>","e":"AQAB"}]}
```
Headers: `Cache-Control: public, max-age=3600, must-revalidate`, `ETag: "<sha256[:32]>"`.

## KEY_ROTATION_MODEL
V0 manual (config change + restart). Active signs; previous public keys verify.
Active is always first in JWKS. Retiring a previous key (removing it from env)
makes its tokens fail verification (`kid not recognized`). Previous keys can
never sign — the signer holds only the active private key.

## WORKFLOW_TOKEN_CLAIMS (plan §7.5)
`iss, sub(=MachinePrincipal.id), aud=svc-workflow, principal_type=agent, scope,
token_use=access, type=access, version=v1, agent_id, client_id, jti, iat, nbf, exp`.
TTL default 600s / cap 900s. **No `azp`, no `act`** (those are OBO/PR-B only).

> **Conflict resolved:** the pasted task spec §八 required `azp`+`client_id` on
> direct tokens; the frozen plan §7.5/§10.4 says direct tokens have NO `azp`/`act`.
> Per the spec's own §一 ("不得按摘要中的歧义实现"), the **frozen plan governs**.
> Flagged for audit.

## CLIENT_CREDENTIALS_BEHAVIOR
Audience-gated dispatch in `issueToken`: `resource === 'svc-workflow'` → RS256
workflow signer; all other audiences → existing HS256 `signAgentAccessToken`
(unchanged). Existing audience exact-match and scope exact-subset checks
precede signing and are unchanged. Requesting `svc-workflow` does not auto-grant.

## VERIFY_TOKEN_CHANGE
`POST /api/services/verify-token` now branches on token kind: if the header has
a `kid` and the workflow keyring is configured → RS256 workflow path
(`verifyWorkflowToken` + MachinePrincipal lookup, exists + not-disabled); else
the existing HS256 User path is **unchanged**. This fixes the pre-PR-A bug where
machine tokens (sub=MachinePrincipal.id) were misrouted to `prisma.user` and
returned 401 "用户不存在". No OBO / delegation / agentId-guessing added.

## NON_WORKFLOW_COMPATIBILITY
Regression tests prove `svc-forum`, `svc-okr`, `unified-platform` stay HS256
with no kid, no `token_use`/`act`/`azp`, same TTL (600/cap 900). Existing
OpenClaw Machine token contract unchanged.

## AUDIT_LOGGING
`auditLog` extended with optional `algorithm` + `kid` (emitted for workflow
`token.issued` only). New failure category `workflow_keyring_not_configured`.
Never logs: full token, client secret, private key, PEM, Authorization header,
subject token, env values.

## MIGRATION
**None.** No new tables/fields/enums/constraints. `MachinePrincipal.principalType`
already exists; `principal_type` claim derived from it.

## NEW_TEST_COUNT
**43** new tests (all passing): keyring validation (9), signer signing (6),
algorithm-confusion defense (6), rotation (4), JWKS endpoint (4), verify-token
routing (6), non-workflow compatibility (8). Test RSA keys are generated at
runtime via `node:crypto` — **no committed private material**.

## TOTAL_TEST_RESULTS
- `npm run test:oauth` (now includes new files): **100 pass / 0 fail / 0 skip**
- `npm run test` (identity): **44 pass / 0 fail / 0 skip**
- `npm run build` (tsc): **clean**

## KNOWN_BASELINE_FAILURES
- `tests/oauth/lifecycle.test.ts` (run via `test:lifecycle`) and
  `tests/oauth/local-smoke.mjs` (`test:smoke-oauth`) require a live PostgreSQL
  (`DATABASE_URL`). They fail offline **independent of this PR** (pre-existing).
- Full DB-backed client_credentials end-to-end tests (disabled client, wrong
  secret, unauthorized audience) are **deferred** — the repo has no prisma
  mocking infra and all oauth unit tests are pure-function. Issuance-gating
  logic (audience/scope/dispatch) is covered by unit tests; the verify-token
  *kind-detection* is unit-tested, the DB lookup is not.

## SKIPPED_TESTS
0.

## STRUCTURE_METRICS
Largest new files: workflow-keyring.ts (254), workflow-signer.ts (150),
well-known.ts (45). No file exceeds the repo's ≤500-line guideline.

## SECRET_PRIVATE_KEY_SCAN
- `grep -rnE "BEGIN (RSA|EC|OPENSSH|)PRIVATE KEY|BEGIN ENCRYPTED PRIVATE KEY"`
  over all new src + test files → **no matches**.
- No hardcoded secrets or dev key paths. Test keys generated at runtime only.

## CLEAN_CHECKOUT_VERDICT
PASS — branch builds (`tsc` clean), 100 oauth tests green, no private material,
no migration, no new deps, main worktree untouched.

## GIT_STATUS
Clean working tree (all changes committed). 2 commits on branch, not pushed.

## READY_FOR_AUDIT
**Yes** — hand off to independent audit. Suggested focus (plan §17):
private-key leakage into JWKS/logs/git; old-audience compatibility;
algorithm-confusion; rotation; audience/scope authorization; User-vs-Machine
verify-token routing; and the §八↔§7.5 `azp` interpretation noted above.

---

AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_READY_FOR_AUDIT
