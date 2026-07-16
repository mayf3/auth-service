# auth-service — Workflow Agent OBO Token Exchange V0 Implementation Report

**Date:** 2026-07-16
**Status:** `AUTH_SERVICE_WORKFLOW_AGENT_OBO_V0_READY_FOR_AUDIT`

---

## Summary

| Field | Value |
|---|---|
| AGENT_ROLE | `implementer` |
| BASE_SHA | `c935528019c29480ac9a2eb1d7e5dfb81bd8a469` |
| WORKTREE | `/Users/yanfenma/workspace/project/auth-service-workflow-obo` |
| BRANCH | `feat/workflow-agent-obo-token-exchange-v0` |
| FINAL_HEAD_SHA | `d23717f5033ac4db7d6e7c844a21d91b50351773` |
| FINAL_TREE_SHA | `6eeb6dcb867e14d175eda1ffc7ab233df0671093` |
| COMMITS | 1 (squashed implementation commit) |

## Modified Files

| File | Change |
|---|---|
| `src/routes/oauth.ts` | Added `grant_type=token-exchange` branch + `extractBasicAuth` helper |
| `src/schemas/oauth.ts` | Added `tokenExchangeRequestSchema` |
| `src/lib/oauth/audit.ts` | Added `obo.token.issued`/`obo.token.failed` event types + OBO audit fields |
| `src/lib/oauth/token-exchange.ts` | **New**: Core OBO token exchange business logic (subject verification, scope intersection, signing) |
| `tests/oauth/workflow-obo-token-exchange.test.ts` | **New**: 26 unit tests for profile validation, scope, claims, audit |
| `tests/oauth/workflow-obo-db-e2e.mjs` | **New**: 15 DB E2E tests against real PostgreSQL |
| `docs/contracts/WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0.md` | **New**: Formal contract |

## Implementation Decisions

| Decision | Value | Notes |
|---|---|---|
| TOKEN_EXCHANGE_ENDPOINT | `POST /oauth/token` | Extended existing route |
| GRANT_TYPE | `urn:ietf:params:oauth:grant-type:token-exchange` | RFC 8693 |
| ADC_CLIENT_AUTHENTICATION | HTTP Basic (client_id:client_secret) | Same as client_credentials |
| SUBJECT_TOKEN_PROFILE | RS256, `aud=svc-workflow`, `principal_type=agent`, `type=access`, `token_use=access`, no `act` | Agent direct token only |
| USER_OBO_IMPLEMENTED | `false` | Deferred |
| ARBITRARY_SUBJECT_REPLACEMENT_BLOCKED | `true` | `requested_subject` etc. rejected |
| CANONICAL_SUBJECT_SOURCE | `VERIFIED_SUBJECT_TOKEN` | From verified token payload |
| CLIENT_ID_CLAIM_SEMANTICS | ADC MachineClient.clientId | Same as `azp` (backward compat) |
| AZP_CLAIM_SEMANTICS | ADC MachineClient.clientId | Authorized party |
| ACT_CLAIM_SCHEMA | `{ "sub": "<ADC MachinePrincipal.id>" }` | Nested, RFC 8693 |
| OBO_TOKEN_MARKER | `token_use: workflow_obo` | Definitively distinguishes from direct |
| OBO_CHAINING_ALLOWED | `false` | Dual check: `token_use` + `act` absence |
| SCOPE_INTERSECTION_MODEL | 3-way: subject ∩ ADC allowed ∩ requested | Exact set intersection only |
| SERVICE_POLICY_SCOPE_LAYER | `DEFERRED_TO_V1` | Not implemented |
| OBO_TTL_SECONDS | `300` | Hard-capped |
| OUTPUT_CANNOT_OUTLIVE_SUBJECT | `true` | `OBO.exp = min(iat+300, subject_token.exp)` |
| REFRESH_TOKEN_ISSUED | `false` | No refresh token |
| MIGRATION | `none` | No new schema or env vars |
| AUDIT_MODEL | Structured JSON to stderr | Best-effort V0 |
| AUDIT_DURABILITY_LIMITATION | `true` | Not a persistent ledger; requires log aggregation |
| DIRECT_TOKEN_COMPATIBILITY | `true` (preserved) | Direct token contract unchanged |
| NON_WORKFLOW_COMPATIBILITY | `true` (preserved) | Non-workflow paths unchanged |

## Test Results

| Suite | Tests | Pass | Fail | Skip |
|---|---|---|---|---|
| Existing OAuth (secret, schemas, compatibility, keyring, signer, rotation, JWKS, verify-token routing) | 79 | 79 | 0 | 0 |
| **New OBO unit tests** (profile validation, scope, claims, audit) | **26** | **26** | **0** | **0** |
| Identity tests (resolver, env-file) | 44 | 44 | 0 | 0 |
| **DB E2E** (real PostgreSQL, real Express, real keyring) | **15** | **15** | **0** | **0** |
| **Total** | **164** | **164** | **0** | **0** |

| NEW_TEST_COUNT | `26` (unit) + `15` (DB E2E) = `41` |
|---|---|
| TOTAL_TEST_RESULTS | `164 passed / 0 failed / 0 skipped` |
| DB_E2E_RESULTS | `15 passed / 0 failed` |
| KNOWN_BASELINE_FAILURES | `0` (all pre-existing failures absent; lifecycle.test.ts requires separate DB and was not run) |
| SKIPPED_TESTS | `0` |

## Security Verification

| Check | Result |
|---|---|
| Algorithm confusion: `alg=none` | ✅ Rejected (400) |
| Algorithm confusion: HS256 | ✅ Rejected (400) |
| Algorithm confusion: unknown `kid` | ✅ Rejected (400) |
| Subject replacement: `requested_subject` | ✅ Rejected (400) |
| Subject replacement: `subject` param | ✅ Rejected (400) |
| Subject replacement: tampered signature | ✅ Rejected (400) |
| Subject replacement: wrong `sub` in payload | ✅ Rejected (400) |
| OBO chaining: `token_use=workflow_obo` | ✅ Rejected (400) |
| OBO chaining: `act` present | ✅ Rejected (400) |
| Scope substring attacks | ✅ Blocked (exact set only) |
| Empty scope intersection | ✅ `invalid_scope` (400) |
| Disabled principal | ✅ `invalid_client` (401) |
| Disabled subject principal | ✅ `invalid_grant` (400) |
| Wrong ADC secret | ✅ `invalid_client` (401) |
| Non-existent ADC client | ✅ `invalid_client` (401) |
| Unauthorized audience | ✅ `invalid_grant` (400) |

## Leak Scan

| Scope | Result |
|---|---|
| Private key in source code | ✅ None (test keys generated at runtime) |
| Token in source code | ✅ None |
| Client secret in source code | ✅ None |
| PEM in source code | ✅ None |
| JWT in test logs | ✅ Expected (ephemeral, no real credentials) |

## Fixed Boundaries

```text
USER_OBO_IMPLEMENTED=false
ARBITRARY_SUBJECT_REPLACEMENT_BLOCKED=true
CANONICAL_SUBJECT_SOURCE=VERIFIED_SUBJECT_TOKEN
OBO_TOKEN_MARKER=token_use:workflow_obo
OBO_CHAINING_ALLOWED=false
SERVICE_POLICY_SCOPE_LAYER=DEFERRED_TO_V1
OBO_TTL_SECONDS=300
OUTPUT_CANNOT_OUTLIVE_SUBJECT=true
REFRESH_TOKEN_ISSUED=false
MIGRATION=none
PRODUCTION_DEPLOYMENT_ALLOWED=no
SVC_WORKFLOW_CONSUMER_SWITCH_ALLOWED=no
ADC_INTEGRATION_ALLOWED=no
REAL_PROVISIONING_ALLOWED=no
```
