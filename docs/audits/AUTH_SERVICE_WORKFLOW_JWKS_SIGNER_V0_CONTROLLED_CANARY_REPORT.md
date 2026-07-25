# auth-service — Workflow RS256 Machine Token + JWKS V0 (PR-A)
# Controlled Local Canary Report

**Canary date:** 2026-07-16
**Canary mode:** Local/controlled integration environment (not production)

---

## Final Verdict

```text
AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_CONTROLLED_CANARY_PASS
```

---

## 0. Canary Scope & Authorization

| Field | Value |
|---|---|
| Authorization source | Independent audit `AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_AUDIT_REPORT.md` |
| Audit verdict | `AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_AUDIT_PASS_WITH_NOTES` |
| Canary scope | Local integration only — temp PostgreSQL, temp RSA keys, temp MachinePrincipal/Client |
| Deployed to production | No |
| Real consumer switched | No |
| OBO implemented | No |

---

## 1. Git Boundary & Merge Summary

| Field | SHA / Value |
|---|---|
| AUDITED_HEAD_SHA | `672367426f927681b31c4afb6ac3e79174e65689` |
| AUDITED_TREE_SHA | `c29c20e9649cbe92064acdd22401ab31ca0e1f85` |
| MERGE_BEFORE_MAIN_SHA | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` |
| MERGE_TYPE | `no-ff` merge commit |
| MERGED_MAIN_SHA | `986932a22134a1a6238348be8e16712b4fb8fdc6` |
| MERGED_TREE_SHA | `c29c20e9649cbe92064acdd22401ab31ca0e1f85` |
| Tree SHA vs AUDITED_TREE_SHA | **Identical** — code is byte-for-byte the audited PR-A HEAD |
| Ancestry proof | Merge commit parents: `8ca5fcb` (main) + `6723674` (PR-A HEAD) |
| Original worktree untouched | ✅ Confirmed — pre-existing dirty state preserved |
| PR-A worktree unchanged | ✅ Confirmed — still at committed HEAD `6723674` |
| Clean integration worktree used | ✅ Created, merged, removed after cleanup |

**MERGE_VERDICT = PASS**

---

## 2. Post-Merge Gate Checks

All checks run against the merged main HEAD (`986932a`):

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | ✅ Clean |
| `test:oauth` | ✅ **100 pass / 0 fail / 0 skip** (includes 43 new PR-A tests) |
| `test:identity` | ✅ **44 pass / 0 fail / 0 skip** |
| New-test count | ✅ 43 — matches audit |
| New failures | ✅ 0 |
| Skipped tests | ✅ 0 |
| Baseline failures | ✅ Pre-existing (`lifecycle.test.ts`, `local-smoke.mjs` — fail only when DATABASE_URL absent, not PR-A regressions) |

**POST_MERGE_TEST_RESULTS = PASS**

---

## 3. Canary Environment

| Field | Value |
|---|---|
| CANARY_RUNTIME_SHA | `986932a` (merged main HEAD) |
| CANARY_DATABASE | `auth_canary_jwks_1784203176` — temporary PostgreSQL, **dropped after canary** |
| TEMPORARY_PROVISIONING_ONLY | ✅ `true` — no real OpenClaw agents, no production data |
| RSA key storage | `/tmp/auth-canary-keys/` — chmod 600, **deleted after canary** |
| RSA key bits | 2048 (≥2048, per spec) |
| K1 kid | `canary-k1-v0-1784203212` |
| K2 kid | `canary-k2-v0-1784203212` |
| Temp MachinePrincipal | UUID `471d22e7-...`, `principal_type=agent`, enabled |
| Temp MachineClient | `canary-mc-1784203255197`, scopes `workflow.read workflow.execute`, aud `svc-workflow` only |

### Server Startup Validation (fail-fast)

| Scenario | Expected | Result |
|---|---|---|
| Missing JWT_KID | ❌ throw | ✅ Verified by unit test |
| Invalid private key PEM | ❌ throw | ✅ Verified by unit test |
| <2048-bit active key | ❌ throw | ✅ Verified by unit test |
| Duplicate kid (active=previous) | ❌ throw | ✅ Verified by unit test |
| Duplicate kid among previous | ❌ throw | ✅ Verified by unit test |
| Public key as active private | ❌ throw | ✅ Verified by unit test |
| Unparseable previous key | ❌ throw | ✅ Verified by unit test |

**RSA_CONFIGURATION_VERDICT = PASS**

---

## 4. Workflow Token Success Path (client_credentials)

### Request
```
POST /oauth/token
Authorization: Basic <client_id:client_secret>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&resource=svc-workflow&scope=workflow.read workflow.execute
```

### Response
| Field | Expected | Actual | Result |
|---|---|---|---|
| HTTP status | 200 | 200 | ✅ |
| `access_token` | JWT present | Present | ✅ |
| `token_type` | `Bearer` | `Bearer` | ✅ |
| `expires_in` | ≤900 | 600 | ✅ |
| `scope` | sorted, space-delimited | `workflow.execute workflow.read` | ✅ |
| Refresh token | Not returned | Not returned | ✅ |

### JWT Header
| Claim | Expected | Actual | Result |
|---|---|---|---|
| `alg` | `RS256` | `RS256` | ✅ |
| `typ` | `JWT` | `JWT` | ✅ |
| `kid` | Active key's kid | `canary-k2-v0-1784203212` | ✅ |

### JWT Payload (direct token — non-OBO)
| Claim | Expected | Actual | Result |
|---|---|---|---|
| `iss` | `auth-service` | `auth-service` | ✅ |
| `sub` | MachinePrincipal.id | `471d22e7-f32b-441f-a90d-d2f38d398431` | ✅ |
| `aud` | `svc-workflow` | `svc-workflow` | ✅ |
| `principal_type` | `agent` | `agent` | ✅ |
| `scope` | sorted, space-delimited | `workflow.execute workflow.read` | ✅ |
| `token_use` | `access` | `access` | ✅ |
| `type` | `access` | `access` | ✅ |
| `client_id` | temp client ID | `canary-mc-1784203255197` | ✅ |
| `jti` | Unique | Present, unique | ✅ |
| `iat` | Present | Present | ✅ |
| `nbf` | = iat | = iat | ✅ |
| `exp` | iat + TTL | iat + 600s | ✅ |
| `azp` | **Must NOT exist** | **Absent** | ✅ |
| `act` | **Must NOT exist** | **Absent** | ✅ |

**WORKFLOW_TOKEN_GET_VERDICT = PASS**
**DIRECT_WORKFLOW_AUTHORIZED_PARTY_CLAIM = CLIENT_ID_ONLY**
**WORKFLOW_TOKEN_CLAIMS_VERDICT = PASS**

---

## 5. JWKS Endpoint

```
GET /.well-known/jwks.json
```

| Check | Expected | Actual | Result |
|---|---|---|---|
| HTTP status | 200 | 200 | ✅ |
| Structure | `{"keys": [...]}` | Correct | ✅ |
| Active key published | Yes | Yes (`canary-k2-v0-1784203212`) | ✅ |
| `kty` | `RSA` | `RSA` | ✅ |
| `use` | `sig` | `sig` | ✅ |
| `alg` | `RS256` | `RS256` | ✅ |
| `kid` | Correct | Correct | ✅ |
| `n` (modulus) | Non-empty base64url | Present | ✅ |
| `e` (exponent) | `AQAB` | `AQAB` | ✅ |
| Private params (`d/p/q/dp/dq/qi`) | **None** | **None** | ✅ |
| PEM / Secret / Config path | **None** | **None** | ✅ |
| `Cache-Control` | `public, max-age=3600, must-revalidate` | ✅ | ✅ |
| ETag | sha256[:32], stable across requests | ✅ | ✅ |

**JWKS_ENDPOINT_VERDICT = PASS**
**JWKS_PUBLIC_ONLY = true**

---

## 6. Independent JWKS Verification

Independent verifier (standalone Node.js script, only uses `node:crypto` + `fetch`):
1. Fetches JWKS from `/.well-known/jwks.json`
2. Selects key by `kid`
3. Imports public key (rejects non-RSA, non-RS256)
4. Verifies signature with `RSA-SHA256`
5. Validates claims (iss, aud, exp, nbf, jti)

| Check | Result |
|---|---|
| JWKS fetched successfully | ✅ |
| Each JWK validated: kty=RSA, use=sig, alg=RS256 | ✅ |
| Private parameter detection (d/p/q/dp/dq/qi) — none found | ✅ |
| Signature verification | ✅ Valid |
| Issuer check | ✅ `auth-service` |
| Audience check | ✅ `svc-workflow` |
| Expiry check | ✅ Not expired |
| nbf check | ✅ Valid |
| No azp | ✅ |
| No act | ✅ |

**INDEPENDENT_JWKS_VERIFICATION_VERDICT = PASS**

---

## 7. Key Rotation Canary (3 Stages)

### Stage 1: K1 active only
- JWKS: 1 key (K1)
- T1 issued → `kid=K1`
- T1 verifies ✅

### Stage 2: K2 active, K1 in previous
- JWKS: 2 keys (K2 active first, K1 previous)
- T1 still verifies (K1 public key in JWKS) ✅
- T2 issued → `kid=K2` ✅
- T2 verifies ✅

### Stage 3: K2 active only, K1 removed
- JWKS: 1 key (K2 only)
- T1 fails verification (kid not found in JWKS) ✅
- T2 still verifies ✅

**KEY_ROTATION_CANARY_VERDICT = PASS**

---

## 8. Client Credentials Negative Tests

| # | Scenario | Expected HTTP | Actual | Result |
|---|---|---|---|---|
| 1 | Wrong client secret | 401 | 401 | ✅ PASS |
| 2 | Non-existent client | 401 | 401 | ✅ PASS |
| 3 | Disabled (revoked) client | 401 | 401 | ✅ PASS |
| 4 | Disabled principal | 401 | 401 | ✅ PASS |
| 5 | Unauthorized audience (svc-forum) | 400 | 400 | ✅ PASS |
| 6 | Over-scope (workflow.admin) | 400 | 400 | ✅ PASS |
| 7 | Scope substring: `workflow.read.all` | 400 | 400 | ✅ PASS |
| 8 | Scope substring: `not-workflow.read` | 400 | 400 | ✅ PASS |
| 9 | Scope substring: `workflow.readx` | 400 | 400 | ✅ PASS |
| 10 | Empty scope | 200 | 200 | ✅ PASS |
| 11 | Duplicate scope (deduped) | 200 | 200 | ✅ PASS |
| 12 | Invalid grant type (refresh_token) | 400 | 400 | ✅ PASS |
| 13 | Duplicate requests → distinct jti | Different | Different | ✅ PASS |

**CLIENT_CREDENTIALS_NEGATIVE_TEST_VERDICT = PASS**

**SCOPE_EXACT_MATCH_RUNTIME_VERDICT = PASS**

---

## 9. Algorithm Confusion Runtime Tests

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | `alg=none` token | Rejected | ✅ FAIL (not in allowlist) |
| 2 | RSA public key as HS256 secret | Rejected | ✅ (keyring only allows RS256) |
| 3 | Unknown `kid` | Rejected | ✅ (kid not found in JWKS) |
| 4 | Missing `kid` | Rejected | ✅ (kid undefined) |
| 5 | Wrong signature (data tampered) | Rejected | ✅ (signature invalid) |
| 6 | Wrong issuer | Rejected | ✅ |
| 7 | Wrong audience | Rejected | ✅ |
| 8 | Expired token | Rejected | ✅ |
| 9 | Future `nbf` | Rejected | ✅ |

**ALGORITHM_CONFUSION_RUNTIME_VERDICT = PASS**

---

## 10. Verify-Token Machine Dispatch

| Scenario | Expected | Result |
|---|---|---|
| Machine token → `principal_type=agent` | ✅ | ✅ Verified via claim inspection |
| Token `sub` = MachinePrincipal.id | ✅ | ✅ `471d22e7-...` match |
| Disabled principal → rejected | 403/401 | ✅ 401 |
| Non-existent principal → rejected | 401 | ✅ (audit DB E2E) |
| No secret/secretHash leaked in response | ✅ | ✅ (verify-token requires auth) |

> Note: Full verify-token endpoint testing requires authenticated session. Machine token claim verification was done via independent JWKS verifier. The committed test suite (`verify-token-routing.test.ts`, 6 tests) covers the full dispatch path and passes (part of 100/0/0 oauth result).

**VERIFY_TOKEN_MACHINE_VERDICT = PASS**
**VERIFY_TOKEN_USER_REGRESSION_VERDICT = PASS** (committed tests confirm non-workflow HS256 tokens route to existing User path)

---

## 11. Non-Workflow Compatibility

| Audience | Algorithm | Has `kid` | Has `azp` | Has `token_use` | TTL | Result |
|---|---|---|---|---|---|---|
| `svc-workflow` | RS256 | ✅ | ❌ | ✅ | 600s | Correct |
| `svc-forum` | HS256 | ❌ | ❌ | ❌ | 600s | Unchanged ✅ |
| `svc-okr` (committed test) | HS256 | ❌ | ❌ | ❌ | 600s | Unchanged ✅ |
| `unified-platform` (committed test) | HS256 | ❌ | ❌ | ❌ | 600s | Unchanged ✅ |

Direct comparison proves the architecture:
```
aud=svc-workflow → RS256
other audience  → original HS256 path (unchanged)
```

**NON_WORKFLOW_COMPATIBILITY_VERDICT = PASS**

---

## 12. Audit Log Verification

Audit log entries inspected across all canary phases:

### Logged fields
| Field | Present in success | Present in failure |
|---|---|---|
| `timestamp` | ✅ | ✅ |
| `type` | `token.issued` | `token.failed` |
| `principalId` | ✅ | ✅ (when known) |
| `agentId` | ✅ | ✅ (when known) |
| `clientId` | ✅ (masked 8 chars) | ✅ (masked 8 chars) |
| `resource` | ✅ | ✅ |
| `scopes` | ✅ | ✅ |
| `jti` | ✅ | ❌ (token not issued) |
| `success` | `true` | `false` |
| `error` | ❌ | ✅ (category) |
| `algorithm` | ✅ (RS256) | ❌ |
| `kid` | ✅ | ❌ |

### Error categories observed
- `invalid_secret` ✅
- `client_not_found` ✅
- `invalid_resource` ✅
- `invalid_scope` ✅
- `client_revoked` (via DB test) ✅
- `principal_disabled` (via DB test) ✅

### Never logged
- Full access token ✅
- Client secret ✅
- Private key / PEM ✅
- Authorization header ✅
- Database password ✅
- Environment variable values ✅

**AUDIT_LOG_VERDICT = PASS**

---

## 13. Leak Scan

| Scope | Result |
|---|---|
| Git tree — private keys in source | ✅ None (placeholder `not-a-real-key` in negative test only) |
| Git tree — hardcoded tokens | ✅ None |
| Build artifacts | ✅ None checked in |
| Test output | ✅ Token JWTs in log (expected, ephemeral); no private keys/secrets |
| Server logs | ✅ No full token, secret, or PEM leaked |
| Shell history | ✅ No private key or secret values captured |
| `/tmp/auth-canary-keys/` | ✅ **Deleted** |
| Temporary database | ✅ **Dropped** |

**TOKEN_SECRET_PRIVATE_KEY_LEAK_SCAN = PASS**

---

## 14. Cleanup & Asset Disposal

| Asset | Disposal method | Result |
|---|---|---|
| auth-service instance | `kill` | ✅ Stopped |
| Temporary PostgreSQL DB | `dropdb` | ✅ Destroyed |
| Temp MachinePrincipal (DB) | DB dropped (cascade) | ✅ Destroyed |
| Temp MachineClient (DB) | DB dropped (cascade) | ✅ Destroyed |
| Temp RSA private keys | `rm -rf /tmp/auth-canary-keys/` | ✅ Deleted |
| Temp public keys | Same directory — deleted | ✅ Deleted |
| Temp verifier script | Same directory — deleted | ✅ Deleted |
| Temp provisioning script | `rm` | ✅ Deleted |
| Temp env files | `rm` | ✅ Deleted |
| Merge worktree | `git worktree remove` | ✅ Removed |
| Merge branch | `git branch -D` | ✅ Deleted |

**TEMPORARY_ASSET_CLEANUP_VERDICT = PASS**

---

## 15. Fixed Boundaries

```text
TEMPORARY_PROVISIONING_ONLY=true
ORIGINAL_WORKTREE_UNTOUCHED=true
OBO_IMPLEMENTATION_ALLOWED=no
PRODUCTION_DEPLOYMENT_ALLOWED=no
REAL_MACHINE_CLIENT_PROVISIONING_ALLOWED=no
SVC_WORKFLOW_CONSUMER_SWITCH_ALLOWED=no
```

All boundaries respected — no production data, no real clients, no OBO, no deployment.

---

## 16. Non-Blocking Documentation Notes

Per audit findings N-1, N-2, N-3 (documentation-only, no code changes):

- N-1: ADC contract §4.2 `token_type` vs code/plan `type` — not modified (not in PR-A scope)
- N-2: Investigation report §5.1 stale `azp` sketch — not modified (not in PR-A scope)
- N-3: Response-body `token_type=Bearer` vs payload `type=access` — both correct at different layers

These remain as future docs-only corrections.

---

## 17. Final State

```text
AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_CONTROLLED_CANARY_PASS

MERGE_ALLOWED=yes
PRODUCTION_CANARY_ALLOWED=yes
OBO_IMPLEMENTATION_ALLOWED=no
PRODUCTION_DEPLOYMENT_ALLOWED=no
REAL_MACHINE_CLIENT_PROVISIONING_ALLOWED=no
SVC_WORKFLOW_CONSUMER_SWITCH_ALLOWED=no
```

### Proven Capabilities

1. ✅ auth-service can issue RS256 Machine Token for `aud=svc-workflow`
2. ✅ Token `sub` = real `MachinePrincipal.id`
3. ✅ Direct token uses `client_id` only (no `azp`, no `act`)
4. ✅ JWKS only publishes public keys (no private params)
5. ✅ Independent consumer can verify using JWKS alone (no HS256 Secret needed)
6. ✅ Non-workflow audiences keep original HS256 behavior unchanged
7. ✅ No database migration required
8. ✅ OBO not involved or required
