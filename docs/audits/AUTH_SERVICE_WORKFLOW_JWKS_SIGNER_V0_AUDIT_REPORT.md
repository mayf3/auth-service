# auth-service — Workflow RS256 Machine Token + JWKS V0 (PR-A)
# Independent Audit Report

**Audit date:** 2026-07-16
**Auditor role:** Independent auditor (ZCode). The auditor did NOT implement
PR-A, did not modify committed code, did not amend/merge/push/deploy, and did
not begin PR-B (OBO).

**Audit mode:** Read-only code/contract review + dynamic verification in an
ephemeral throwaway PostgreSQL database (created and destroyed during the
audit; no production data touched). Audit-created temp test scripts were
removed after the run; the PR-A working tree is byte-for-byte the committed HEAD.

---

## 0. Executive Summary

**Final status:**

```text
AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_AUDIT_PASS_WITH_NOTES
```

PR-A is a clean, narrowly-scoped, well-tested implementation of the workflow
RS256 signer + JWKS endpoint + verify-token machine dispatch. Every security
gate that the task named as "highest risk / weakest evidence" — wrong secret,
disabled client, disabled principal, unauthorized audience, scope
subset/substring bypass, algorithm confusion, key rotation, JWKS public-only,
verify-token dispatch, non-workflow compatibility — was **dynamically proven
against a real PostgreSQL database** through the real `issueToken` /
`verifyWorkflowToken` / Express JWKS route paths (68 dynamic checks, 0 fail).

There are **no Blocker findings** and **no High findings**. The notes below
are documentation-level (a cross-document `type` vs `token_type` wording
mismatch, and `token_type=Bearer` in the token *response body* vs `type=access`
in the *JWT payload* — both intentional and consistent with the existing code).
The frozen contract is **uniquely interpretable** for the direct-token claims;
the §八↔§7.5 `azp` "conflict" the implementer flagged is **resolved correctly**
in favor of the frozen plan (direct token carries `client_id`, **no `azp`**).

```text
MERGE_ALLOWED=yes
PRODUCTION_CANARY_ALLOWED=yes
OBO_IMPLEMENTATION_ALLOWED=no
PRODUCTION_DEPLOYMENT_ALLOWED=no
REAL_MACHINE_CLIENT_PROVISIONING_ALLOWED=no
SVC_WORKFLOW_CONSUMER_SWITCH_ALLOWED=no
```

---

## Verdict Flags (required output)

```text
AUDITED_BASE_SHA        = 8ca5fcb48a40bbb4d6909d0499372959d26d0440
AUDITED_HEAD_SHA        = 672367426f927681b31c4afb6ac3e79174e65689
AUDITED_TREE_SHA        = c29c20e9649cbe92064acdd22401ab31ca0e1f85
COMMIT_BOUNDARY_VERIFIED                       = true
DIRECT_WORKFLOW_AUTHORIZED_PARTY_CLAIM         = CLIENT_ID_ONLY
CURRENT_IMPLEMENTATION_MATCHES_FROZEN_CONTRACT = true
RSA_KEYRING_FAIL_CLOSED                        = true
JWKS_PUBLIC_ONLY                               = true
WORKFLOW_RS256_TOKEN_CONTRACT_VALID            = true
CLIENT_CREDENTIALS_DB_E2E_VERDICT              = PASS
WORKFLOW_SCOPE_EXACT_SET_MATCH                 = true
ALGORITHM_CONFUSION_BLOCKED                    = true
KEY_ROTATION_MODEL_VALID                       = true
VERIFY_TOKEN_USER_MACHINE_DISPATCH_VALID       = true
NON_WORKFLOW_TOKEN_COMPATIBILITY_PRESERVED     = true
TOKEN_SIGNING_AUDIT_LEAK_FREE                  = true
MIGRATION_NOT_REQUIRED_CONFIRMED               = true
BASELINE_FAILURES_CONFIRMED                    = true
HEAD_NEW_FAILURE_COUNT                         = 0
SKIPPED_TEST_COUNT                             = 0
DB_E2E_RESULTS                                 = PASS (68/68 dynamic DB checks)
FULL_TEST_RESULTS                              = oauth 100/0/0, identity 44/0/0, build clean
CLEAN_CHECKOUT_VERDICT                         = PASS
BLOCKER_FINDINGS                               = 0
HIGH_FINDINGS                                  = 0
NON_BLOCKING_FINDINGS                          = 3 (all doc/wording)
REQUIRED_FIXES                                 = none blocking; 2 doc-align suggestions
MERGE_ALLOWED                                  = yes
PRODUCTION_CANARY_ALLOWED                      = yes
OBO_IMPLEMENTATION_ALLOWED                     = no
PRODUCTION_DEPLOYMENT_ALLOWED                  = no
```

Fixed boundaries (per task §十八):

```text
OBO_IMPLEMENTATION_ALLOWED=no
PRODUCTION_DEPLOYMENT_ALLOWED=no
REAL_MACHINE_CLIENT_PROVISIONING_ALLOWED=no
SVC_WORKFLOW_CONSUMER_SWITCH_ALLOWED=no
```

---

## 一、审计对象

| Field | Value |
|-------|-------|
| Repository | `auth-service-workflow-jwks` (a git **worktree** sharing the main repo's object DB at `auth-service/.git`) |
| Branch | `feat/workflow-jwks-signer-v0` |
| Base | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` (= main = HEAD of the primary worktree `feat/openclaw-agent-auth-token-get-v0`) |
| Implementation commits | `ebe9c8c` (feat), `1bec951` (test+contract) |
| Documentation commit | `6723674` (implementation report) |
| HEAD | `672367426f927681b31c4afb6ac3e79174e65689` |
| Tree | `c29c20e9649cbe92064acdd22401ab31ca0e1f85` |
| Pushed / merged / deployed | No / No / No |
| Migration | None |
| New dependencies | None |
| `test:oauth` | 100 passed / 0 failed / 0 skipped (43 new) |
| identity | 44 passed / 0 failed / 0 skipped |
| build (tsc) | clean |
| Private-key scan | no real PEM committed (one placeholder `not-a-real-key` in a negative test) |

> Note on the implementer report: it lists `FINAL_HEAD_SHA=1bec951` because it
> was written before the docs commit `6723674`. The task spec anticipated
> "另有一个文档提交". The true HEAD is `6723674`; the only diff between
> `1bec951` and `6723674` is the addition of this very report file. This is
> consistent and not a discrepancy.

---

## 二、Git Boundary Verification

```text
COMMIT_BOUNDARY_VERIFIED = true
```

Verified:

1. **Primary worktree untouched.** `git worktree list` shows the primary
   worktree `auth-service` still on
   `8ca5fcb` / `feat/openclaw-agent-auth-token-get-v0` with its pre-existing
   dirty untracked docs. PR-A's commits are reachable only through the
   `auth-service-workflow-jwks` worktree; they are NOT checked out in the
   primary worktree.
2. **Base is correct main.** `8ca5fcb` resolves to the merge commit
   `Merge PR-2A: Machine Principal + Client Credentials v0`, identical to the
   primary worktree HEAD and to the base claimed by every frozen contract.
3. **Real git objects, linear chain.** Parent chain verified:
   `ebe9c8c`→parent `8ca5fcb`; `1bec951`→parent `ebe9c8c`;
   `6723674`→parent `1bec951`. No rebase/amend artifacts.
4. **Report ↔ history agree.** The 2 implementation commits + 1 docs commit
   match the report exactly.
5. **No uncommitted files in the test path.** `git status --short` on the PR-A
   worktree shows only 7 untracked **markdown** docs (design/contract reports)
   and zero modified tracked files. None are `.ts`/`.env`/keys/DB/logs.
6. **No secrets in the diff.** `git diff 8ca5fcb..HEAD --name-status` shows 18
   files: 3 new src, 5 modified src, 7 new tests, 1 test helper, 2 docs. No
   `.env`, private key, DB file, or generated token.
7. **Clean checkout builds and tests.** `tsc` clean; `test:oauth` 100/0;
   identity 44/0 (see §十五).

---

## 三、Contract Priority & `azp` Conflict Adjudication

```text
DIRECT_WORKFLOW_AUTHORIZED_PARTY_CLAIM = CLIENT_ID_ONLY
CURRENT_IMPLEMENTATION_MATCHES_FROZEN_CONTRACT = true
```

### Documents reviewed (full read)
1. `AUTH_SERVICE_WORKFLOW_IDENTITY_IMPLEMENTATION_PLAN.md` (the plan, status `..._PLAN_READY`) — §7.5, §9.5, §10.2–10.4
2. `ADC_SVC_WORKFLOW_OBO_JWKS_IMPLEMENTATION_CONTRACT.md` (status `..._CONTRACT_FROZEN`) — §4.2, §5.5, §15.7
3. `AUTH_SERVICE_WORKFLOW_OBO_JWKS_INVESTIGATION.md` (status `..._INVESTIGATION_COMPLETE`) — §5.1, §9.1
4. `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` (PR-A formal contract, status `..._FROZEN`) — §6, §16
5. Actual code (`workflow-signer.ts`, `token-issuance.ts`) and the DB E2E token payload

### Answers to the 8 required questions

1. **Highest-priority frozen contract for PR-A.** The PR-A-scoped formal
   contract `WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` (`..._FROZEN`) is the
   governing artifact for this PR, layered on the plan §7.5/§10.4 and the
   ADC contract §4.2. All three agree on the direct-token shape. The
   **investigation report is explicitly a non-contract** ("Investigation",
   mode "Read-only investigation") — §5.1 of it sketched `azp` on the direct
   token, but that sketch was superseded by the plan §7.5 + §10.4 and the
   ADC contract §4.2, neither of which puts `azp` on the direct token. The
   investigation report is correctly **not** treated as a public API contract.

2. **Authorized client of a direct Machine Token — which claim?** `client_id`
   only. The plan §7.5 frozen claims list `client_id` and **prohibit** `azp`;
   §10.4 states unambiguously *"Direct tokens (non-OBO) do NOT include `act`
   or `azp` claims."* The ADC contract §4.2 lists `client_id` and does **not**
   list `azp` for the direct Machine Token. The PR-A formal contract §6 and
   the code agree.

3. **Is `azp` OBO-only, or also the standard direct-OAuth client?** In this
   contract family `azp` is **reserved for OBO** (it is the ADC/proxy
   `client_id` per RFC 8693, plan §9.5/§10.2, ADC §5.5). It is deliberately
   NOT placed on direct tokens to keep the two token families disjoint and
   avoid implying a proxy actor where there is none. (RFC 8693 §4 still
   *permits* `azp` on direct tokens, so its absence is a valid, stricter
   design choice — not a standards violation.)

4. **Is `client_id` just the existing compatibility field?** Yes. It is the
   existing `MachineClient.clientId` string already present on every HS256
   agent token (`signAgentAccessToken`), kept for `agent-auth` CLI and
   consumer continuity (plan §10.3, ADC §15.7). On the direct workflow token
   it doubles as the authorized-party identifier.

5. **Will svc-workflow / ADC verify or audit on `azp`?** Only for **OBO**
   tokens. The ADC contract §6.13 + §13.4 test matrix show `azp`/`act` are
   parsed and **audit-logged but do not grant domain authorization**
   (authorization is always on `sub`). For direct tokens, consumers key on
   `sub` + `client_id`; no consumer is specified to require `azp` on a direct
   token. So omitting `azp` from direct tokens will not break verification or
   audit.

6. **Does this create a second incompatible contract vs existing Forum Machine tokens?**
   **No.** The existing Forum/OKR/Todo Machine tokens are HS256 and carry
   `client_id` (no `azp`). The direct workflow token also carries `client_id`
   (no `azp`), differing only in algorithm (RS256), `aud`, `token_use`, `nbf`,
   and `kid`. The authorized-party claim name is identical (`client_id`)
   across both families. There is no second incompatible "authorized-party"
   contract.

7. **Fix in PR-A or just docs?** **Neither is required for correctness.** The
   code matches the frozen contract (direct token = `client_id`, no `azp`).
   The implementer's flagged "§八↔§7.5 conflict" is a conflict between the
   **task spec §八** (which asked for `azp`+`client_id`) and the **frozen
   plan §7.5** (no `azp`). Per the task spec's own §一
   ("不得按摘要中的歧义实现") and the existence of a uniquely-interpretable
   frozen contract, the implementer correctly followed the frozen plan. The
   only residual is the investigation-report §5.1 sketch (non-contract);
   recommend editing that line to avoid future confusion (NON-BLOCKING).

8. **If a direct token has no `azp`, how does a caller distinguish the
   authorized client from the real subject?** `sub` = `MachinePrincipal.id`
   (the real principal, verified from DB); `client_id` = the OAuth client that
   authenticated (the authorized party). These are already distinct values
   (principal UUID vs `mc_…` client string) and are independently verifiable:
   `client_id` comes from the authenticated Basic credentials and is checked
   against `MachineClient`; `sub` comes from
   `client.principal.id` (server-derived, never requester-supplied). No `azp`
   is needed to make this distinction.

**Adjudication:** the frozen contract **uniquely** determines the direct-token
authorized-party claim as **CLIENT_ID_ONLY**. Not a contract Blocker.

> Side note (NON-BLOCKING, see §十六 N-1): the ADC contract §4.2 example also
> shows `"token_type": "access"` while the plan §7.5, PR-A formal contract §6,
> and the code all use `"type": "access"`. The code uses `type` to match the
> existing HS256 agent token (`signAgentAccessToken` already emits `type`).
> This is a doc-wording inconsistency in the ADC contract, not a code defect.

---

## 四、RSA Key Ring & Configuration Security

```text
RSA_KEYRING_FAIL_CLOSED = true
```

**Code reviewed:** `src/lib/oauth/workflow-keyring.ts`, `src/server.ts:101-104`.

Static findings (all confirmed by code read):
1. Exactly ONE active private key (singleton `cached`, rebuilt only via test reset). ✓
2. Algorithm fixed RS256 (`jwt.sign(..., { algorithm: 'RS256' })` in signer; `ALLOWED_ALGORITHMS = ['RS256']` on verify). ✓
3. Active private key parsed via `createPrivateKey({format:'pem',type:'pkcs8'})`; failure → throw. ✓
4. `assertMinBits` enforces ≥2048 on both active private and active public + each previous key. ✓
5. `JWT_KID` required; empty → throw. ✓
6. All kids unique: active↔previous and among-previous duplicates both throw. ✓
7. Previous keys loaded via `createPublicKey` (public only); stored only as `publicKey` KeyObject + public JWK. ✓
8. Previous keys never sign — the signer reads only `active.privateKey`. ✓
9. `server.ts:102-104` calls `getWorkflowKeyring()` at startup when configured → misconfig throws before `listen()`. ✓
10. No production default private key; no test fallback in src (test keys are runtime-generated in `_workflow-test-keys.ts`, never imported by src). ✓
11. No silent multi-source selection: `JWT_PRIVATE_KEY` takes precedence, else `JWT_PRIVATE_KEY_FILE`, else throw. ✓
12. No fragile comma/semicolon PEM splitting — previous keys split on top-level newline before `-----BEGIN`; each entry `<kid>|<PEM>`. ✓
13. Request params / JWT header cannot select signer or algorithm — header `kid` only selects a *verification* key; algorithm is hard-coded RS256. ✓
14. Unknown `kid` → throw `not recognized`, no fallback. ✓
15. JWKS order stable: `[activeJwk, ...previous in input order]`. ✓
16. Misconfig errors never print PEM/private detail — messages include kid label and a short preview of malformed input only. ✓

**Dynamic verification (fail-fast, 7/7 PASS):**
- duplicate kid (previous==active) → throws `/duplicat/`
- duplicate kids among previous → throws `/duplicate previous/`
- <2048-bit active → throws `/2048-bit/`
- unparseable active PEM → throws `/unparseable/`
- public key supplied as active private → throws (createPrivateKey rejects SPKI as PKCS#8)
- missing `JWT_KID` → throws `/JWT_KID is required/`
- a **private** PEM supplied in `JWT_PREVIOUS_PUBLIC_KEYS` is tolerated (createPublicKey derives the public part) and the resulting JWKS contains **no `d`/`p`/`q`** (defense-in-depth via `toPublicRsaJwk` rebuild from derived public key). ✓

---

## 五、JWKS Endpoint

```text
JWKS_PUBLIC_ONLY = true
```

**Code reviewed:** `src/routes/well-known.ts`, `workflow-keyring.ts:toPublicRsaJwk`.

Static:
1. Only public JWKs (`PublicRsaJwk` = `{kty,use,alg,kid,n,e}`) ever serialized. ✓
2. Active + previous keys both published. ✓
3. Each JWK: `kty=RSA`, `use=sig`, `alg=RS256`, `kid`, `n`, `e`. ✓
4. Never `d/p/q/dp/dq/qi`, no PEM, no secret — `toPublicRsaJwk` rebuilds from `createPublicKey(key)` and copies only `n`/`e`. ✓
5. No auth required (`wellKnownRouter.get('/jwks.json')` mounted under `/.well-known`, no `authRequired`). ✓
6. Fixed shape `{ "keys": [...] }`. ✓
7. `Cache-Control: public, max-age=3600, must-revalidate`. ✓
8. ETag = `"sha256(body)[:32]"`, recomputed from the body → changes when the key set changes. ✓
9. Body precomputed lazily on first request (`current()` caches) → no per-request private-key parsing. ✓
10. No request-param key-set selection; no config-path/internal-error leakage. ✓

**Dynamic verification over the real Express route (19/19 PASS):** 2-key set
(active+previous); correct field values; **no** `d/p/q/dp/dq/qi`, **no** PEM
markers in body or stringified JWK; HTTP 200; `application/json`;
`Cache-Control` + ETag present; ETag matches `^"[0-9a-f]{32}"$`; identical
ETag across repeated requests (stable); `n` is non-empty base64url.

---

## 六、RS256 Token Issuance (`aud=svc-workflow`)

```text
WORKFLOW_RS256_TOKEN_CONTRACT_VALID = true
```

Verified dynamically through the real `issueToken` path with a provisioned
keyring (full-success token decoded + inspected):

| Requirement | Result |
|---|---|
| header `alg=RS256` | ✓ |
| header `kid` = active (`key-v1-20260716`) | ✓ |
| `sub` = real `MachinePrincipal.id` (server-derived) | ✓ |
| `sub` ≠ agentId / clientId / request UUID | ✓ (sub is the principal UUID) |
| `iss` = `auth-service` (from config) | ✓ |
| `aud` = `svc-workflow` | ✓ |
| `principal_type` = `agent` (from MachinePrincipal.principalType) | ✓ |
| `token_use` = `access` | ✓ |
| scope = sorted, deduped, space-delimited (`workflow.execute workflow.read`) | ✓ |
| `jti` unique per token; distinct across duplicate requests | ✓ |
| `iat`/`nbf`/`exp` present; `nbf=iat`; TTL=600 | ✓ |
| TTL hard-capped at 900 (`Math.min(ttl ?? 600, 900)`) | ✓ (signer test) |
| No refresh_token in response | ✓ |
| Client claim = `client_id` (no `azp`, no `act`) | ✓ |
| Token verifiable by JWKS-matched public key | ✓ |
| Wrong-key verification fails | ✓ (algorithm-confusion suite) |

> Note on TTL: the implementation uses a default of **600s** with a **900s
> cap**, matching the plan §7.8 and the PR-A formal contract §10. The task
> spec §六 item 11 referenced "报告称 900 秒" — 900 is the **cap**, not the
> default. No defect; the report and code are internally consistent.

---

## 七、client_credentials Authorization Gating (DB E2E)

```text
CLIENT_CREDENTIALS_DB_E2E_VERDICT = PASS
```

This was the section the task flagged as "weakest evidence." The implementer
deferred full DB E2E because the repo has no Prisma mock harness. **The auditor
closed this gap**: a throwaway PostgreSQL database (`postgresql@16`, local) was
created, the full Prisma schema was pushed (`prisma db push`), and the **real
`issueToken`** function was exercised end-to-end. The DB was destroyed
afterwards.

**All core gating controls proven against a real DB (25/25 PASS in run 1):**

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | valid creds, keyring unconfigured | reaches keyring gate (`invalid_grant` 400) — proves client/principal/secret/resource/scope all passed | PASS |
| 2 | wrong secret | `invalid_client` 401 | PASS |
| 3 | revoked (disabled) client | `invalid_client` 401 | PASS |
| 4 | disabled principal | `invalid_client` 401 | PASS |
| 5 | unauthorized audience (`svc-forum` when only `svc-workflow` allowed) | `invalid_grant` 400 | PASS |
| 6 | over-scope (`workflow.admin`) | `invalid_scope` 400 | PASS |
| 7 | scope substring (`workflow.read.all` ≠ `workflow.read`) | `invalid_scope` 400 | PASS |
| 8 | non-existent client | `invalid_client` 401 | PASS |
| 9 | requesting `svc-workflow` does NOT auto-grant `workflow.execute` | `invalid_scope` 400 | PASS |
| 10 | empty requested scope allowed (reaches keyring gate) | `invalid_grant` 400 | PASS |
| 11 | full success path → valid RS256 token with all frozen claims | token issued | PASS (+12 sub-checks on header/payload) |
| 12 | duplicate request → distinct `jti` | distinct jti | PASS |

The audit-log lines emitted during these runs confirm failure categories
`invalid_secret`, `client_revoked`, `principal_disabled`, `invalid_resource`,
`invalid_scope`, `client_not_found`, `workflow_keyring_not_configured` and
success lines with `algorithm`/`kid` — and **never** a secret, hash, private
key, PEM, full token, or Authorization header.

**Verdict:** the production security gating IS proven at the DB level. This is
the "acceptable" case (the repo has a reliable DB test method; the implementer
simply had no local PostgreSQL running). `PRODUCTION_CANARY_ALLOWED=yes`.

---

## 八、Scope Exact-Set Semantics

```text
WORKFLOW_SCOPE_EXACT_SET_MATCH = true
```

**Code reviewed:** `src/schemas/oauth.ts:parseScopeString`, `validateRequestedScope`;
`token-issuance.ts:109-143` (resource exact-match + scope subset).

1. Requested scope parsed by `parseScopeString`: `trim()` → `split(/\s+/)` → `Set` dedupe → `sort()`. ✓
2. Allowed scopes stored as `String[]` on `MachineClient.allowedScopes`. ✓
3. Dedup + sort applied. ✓
4. Empty handled: empty/whitespace → `[]` (allowed; yields empty scope claim). ✓
5. Case-sensitive (`Set.has` exact). ✓
6. **Exact-set subset**: every parsed requested scope must be in `allowedSet`
   (`new Set(allowed)`), all-or-throw. ✓
7. **No** `String.includes`, prefix, or substring. ✓
8. Token claim output stable (sorted, deduped, joined by single space). ✓
9. `workflow.read.all`, `not-workflow.read`, `workflow.readx` are **not**
   matched as `workflow.read` — proven dynamically (substring test #7 above). ✓
10. Duplicate scope does not change the result (Set dedupe). ✓
11. Whitespace runs collapsed by `/\s+/`. ✓

Resource (audience) check is also exact: `client.allowedResources.some(r => r === params.resource)` — proven (test #5).

---

## 九、Algorithm Confusion

```text
ALGORITHM_CONFUSION_BLOCKED = true
```

Dynamic attack suite (7/7 PASS) against the real verifier:
1. `alg=none` token → rejected. ✓
2. HS256 forgery using the RSA public key as HMAC secret → rejected. ✓
3. unknown `kid` → rejected (`not recognized`, no fallback). ✓
4. missing `kid` → rejected (`missing kid header`). ✓
5. wrong `iss` → rejected. ✓
6. wrong `aud` (`svc-forum`) → rejected. ✓
7. `alg=HS256` header with a **known** `kid` → rejected (verify hard-pins `algorithms:['RS256']`). ✓

Additional static guarantees: previous keys never sign (signer reads only
active private key); request/header cannot dictate algorithm; a non-workflow
HS256 token cannot impersonate a workflow token (different key material —
verified: a workflow RS256 token does NOT verify as HS256 with `JWT_SECRET`,
and an HS256 token has no `kid` so it never enters the workflow verify path).

---

## 十、Key Rotation

```text
KEY_ROTATION_MODEL_VALID = true
```

Dynamic rotation suite (5/5 PASS, using the correct test-helper field `previous`):
1. K1 active → T1 (K1-signed) verifies. ✓
2. Rotate to K2 active, K1 in `previous` public keys → **T1 still verifies**
   via K1's public key; JWKS order = [K2(active), K1(previous)];
   `verificationKeys` contains K1. ✓
3. New token T2 is signed with K2's `kid`. ✓
4. Retire K1 (remove from `previous`) → T1 no longer verifies (`kid not recognized`). ✓
5. Previous key can never sign — signer always uses active (K2) even when previous present. ✓

Caching: `Cache-Control: max-age=3600, must-revalidate` + ETag derived from
the body. A rotation changes the key set → changes the body → changes the ETag
→ consumers re-fetch. `must-revalidate` prevents serving a stale set past
freshness. The JWKS body is a snapshot of the startup-validated keyring (no
per-request re-parsing). This model supports rotation; no High finding on
caching blocking rotation.

> V0 rotation is manual (config change + restart), consistent with plan §13.1
> and ADC §3.5 ("V0 简化: 手动轮换"). Automated rotation is V1 (out of scope).

---

## 十一、verify-token Dispatch

```text
VERIFY_TOKEN_USER_MACHINE_DISPATCH_VALID = true
```

**Code reviewed:** `service-registrations.ts:214-348` (POST `/api/services/verify-token`).

1. Workflow/machine tokens are detected by **header `kid` presence + keyring configured** — NOT by trusting the unverified payload. ✓
2. Workflow path: `verifyWorkflowToken` (RS256, hard algorithm-confusion defense) → `prisma.machinePrincipal.findUnique({where:{id:payload.sub}})` → exists + not `disabled`. ✓ (MachinePrincipal lookup, not User.)
3. HS256 User path unchanged: `jwt.verify(token, env.JWT_SECRET)` → `prisma.user.findUnique`. ✓
4. User-token behavior has no regression (routing unit test: human/HS256-agent tokens route to the non-workflow path). ✓
5. Non-existent principal → 401 `主体不存在`; disabled principal → 403 `主体已禁用`. ✓
6. No agentId-based identity guessing; no JIT principal creation; no OBO; no workflow domain authorization in this endpoint. ✓
7. Response never returns secret/secretHash/privateKey/full token; only canonical claims (`sub, aud, scope, token_use, client_id, agent_id, exp`). ✓
8. RS256 workflow token uses correct key/algorithm; non-workflow token still uses the legacy HS256 path. ✓

This also fixes the pre-PR-A bug where a machine token (`sub`=MachinePrincipal.id) was misrouted to `prisma.user` and returned 401 "用户不存在" (plan §14.1, investigation B2). Verified dynamically: a real workflow token issued through `issueToken` verifies via `verifyWorkflowToken` and `sub` resolves to the issuing `MachinePrincipal.id`; a disabled principal is detected in-DB.

---

## 十二、Non-Workflow Token Compatibility

```text
NON_WORKFLOW_TOKEN_COMPATIBILITY_PRESERVED = true
```

Audiences in scope: Forum (`svc-forum`), svc-okr, Todo, ADC, default
(`unified-platform`), existing OpenClaw Machine tokens, User tokens.

Dynamic comparison (HS256 `svc-forum` agent token via `signAgentAccessToken`):
- `alg=HS256`, **no** `kid` in header. ✓
- `aud=svc-forum`, **no** `token_use`, **no** `nbf`, **no** `azp`, **no** `act`. ✓
- still carries `client_id`, `principal_type=agent`, `type=access`, `scope`. ✓
- TTL 600 (unchanged). ✓
- verifies with `JWT_SECRET` (existing behavior). ✓

The dispatch is strictly by audience in `issueToken`
(`params.resource === WORKFLOW_AUDIENCE` → RS256; else HS256 `signAgentAccessToken`,
unchanged). A workflow RS256 token is **not** verifiable as HS256 and vice
versa. The shared signer concern (accidentally adding `kid`/RS256/workflow
claims/TTL changes to old tokens) does **not** occur — the HS256 path calls
the untouched `signAgentAccessToken`, and the RS256 path is a separate
function. No un-frozen change to old audiences.

```text
aud=svc-workflow → RS256
other audience  → original HS256 path (unchanged)
```

---

## 十三、Audit Logging

```text
TOKEN_SIGNING_AUDIT_LEAK_FREE = true
```

**Code reviewed:** `src/lib/oauth/audit.ts`, all `auditLog({...})` call sites in `token-issuance.ts`.

Recorded fields: `timestamp, type, principalId, agentId, clientId(masked),
resource, scopes, jti, success, error, algorithm(workflow), kid(workflow)`.

- `clientId` is masked to first 8 chars (`maskClientId`). ✓
- Never recorded: full token, client secret, secret hash, private key, PEM,
  Authorization header, subject token, env values. ✓ (grep of `audit.ts` finds
  no sensitive field names; grep of `token-issuance.ts` audit calls passes
  only category/resource/scope/jti — `clientSecret` is consumed by
  `verifyClientSecret` but never passed to `auditLog`.)
- Failure paths covered: `client_not_found`, `client_revoked`,
  `principal_disabled`, `invalid_secret`, `invalid_resource`,
  `invalid_scope`, `workflow_keyring_not_configured`. ✓ (all observed in the
  DB E2E run.)
- Success path adds `algorithm` + `kid` (workflow only). ✓

> Note (NON-BLOCKING): the audit event does not explicitly record
> `expires_at`/`issued_at` as separate fields (they are derivable from `iat`
> and the fixed TTL) and there is no explicit `requestId` on the
> `token.issued/failed` events — `requestId` is planned for the OBO audit
> extension (plan §17.2, PR-B). The task spec's requested fields are largely
> covered; the missing `requestId` is a V0 trade-off, not a leak.

---

## 十四、Migration & Data Model

```text
MIGRATION_NOT_REQUIRED_CONFIRMED = true
```

- No migration files in the PR-A diff (`git diff 8ca5fcb..HEAD --name-only | grep migration` → empty). ✓
- `MachinePrincipal.principalType` enum (`agent`) already exists; `principal_type` claim derived from it. ✓
- `MachineClient.allowedResources` (String[]) expresses allowed audience; `allowedScopes` (String[]) expresses workflow scopes. ✓
- No agentId/clientId-prefix subject-type guessing; subject type comes from the DB relation (`client.principal`). ✓
- No hidden data-init step; no requirement for a real production client to start the service (workflow is optional — if keyring unset, svc-workflow issuance fails closed, everything else unaffected). ✓
- No OBO/delegation schema in PR-A. ✓

The plan's optional §16.2 "add `human` to PrincipalType enum" was **not** taken in PR-A (correctly — it is optional and not needed for direct agent tokens; `principal_type` is emitted as a JWT string). No code depends on an absent schema field.

---

## 十五、Tests & Baseline Failures

```text
BASELINE_FAILURES_CONFIRMED = true
HEAD_NEW_FAILURE_COUNT      = 0
SKIPPED_TEST_COUNT          = 0
DB_E2E_RESULTS              = PASS
FULL_TEST_RESULTS           = oauth 100 pass/0 fail/0 skip; identity 44 pass/0 fail/0 skip; build (tsc) clean
CLEAN_CHECKOUT_VERDICT       = PASS
```

Re-run on HEAD:
- `tsc -p tsconfig.json --noEmit` → exit 0 (clean).
- `npm run test:oauth` → **100 pass / 0 fail / 0 skip** (includes 6 new workflow files).
- `npm run test` (identity) → **44 pass / 0 fail / 0 skip**.
- New-test exact count via the runner restricted to the 6 new files: **43 pass / 0 fail / 0 skip** — matches the implementer's claim.
- Private-key/secret scan over all new src+test: only one hit, the `not-a-real-key` placeholder in a negative test (not a real key).

Baseline failures (`lifecycle.test.ts`, `local-smoke.mjs`):
- Both fail when `DATABASE_URL` is absent (Prisma `Validation Error`). This is
  a **pre-existing** condition: neither file was modified by PR-A
  (`git diff 8ca5fcb..HEAD` empty for both) and neither references any PR-A
  symbol (`workflow-keyring|workflow-signer|well-known|signWorkflow|jwks` → no
  matches). The failure is purely "PostgreSQL unavailable", not a code
  regression. The auditor provisioned a throwaway PostgreSQL and confirmed the
  DB-backed paths work (§七), so the gating logic is not untested — only the
  pre-existing lifecycle harness was offline.

No tests are skipped or filtered out of the committed `test:oauth` script.

---

## 十六、Structure & Documentation

- Largest new file: `workflow-keyring.ts` = **254** lines; `workflow-signer.ts` = **150**; `well-known.ts` = **45**. All ≤ 500. ✓
- No single file bundles JWKS + keyring + signer + token endpoint + verify-token — they are split across `well-known.ts`, `workflow-keyring.ts`, `workflow-signer.ts`, `token-issuance.ts`, `service-registrations.ts`. ✓
- Depth/children within repo conventions (no new deep nesting introduced).
- Formal PR-A contract (`docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md`) is concise and complete; JWKS endpoint is in the external contract (§9); human workflow token + OBO are explicitly `DEFERRED_TO_LATER_PR` (§16). ✓
- `azp`/`client_id` are consistent between the PR-A formal contract, the plan, and the code (direct = `client_id` only; OBO = `azp`+`client_id`). ✓
- The investigation report is not treated as a public API contract (correct). ✓

**NON-BLOCKING findings (documentation/wording only):**

- **N-1 (Low):** ADC contract §4.2 example lists `"token_type": "access"` for
  the direct token, while the plan §7.5, the PR-A formal contract §6, and the
  code all emit `"type": "access"` (no `token_type`). The code is correct
  (`type` matches the existing HS256 agent token for backward compatibility).
  Recommend correcting the ADC contract §4.2 example to `type` to avoid
  consumer confusion. Not a code change.

- **N-2 (Low):** The investigation report §5.1 sketch shows `azp` on the
  direct token. This was superseded by the frozen plan/contract (direct token
  has no `azp`). Since the investigation is explicitly a non-contract, this is
  cosmetic, but editing that line would prevent future misreads.

- **N-3 (Low, informational):** The token *response body* uses `token_type: "Bearer"` (RFC
  6749 token response field) while the JWT *payload* uses `type: "access"`.
  These are two different fields in two different places and are both correct;
  noted only because the similar names can be confused. No action needed.

---

## 十七、Findings Summary

### Blocker
None.

### High
None.

### Medium / Low (NON-BLOCKING)
- **N-1 (Low, doc):** ADC contract §4.2 `token_type` vs code/plan/PR-A-contract `type`.
- **N-2 (Low, doc):** Investigation §5.1 stale `azp` sketch on direct token.
- **N-3 (Low, informational):** response-body `token_type=Bearer` vs payload `type=access` (both correct).
- (Deferred-by-design, not findings: human-direct workflow token, OBO/PR-B, automated key rotation — all explicitly out of PR-A scope.)

### REQUIRED_FIXES
None blocking. Optional doc-alignment: edit ADC contract §4.2 (`token_type`→`type`) and investigation §5.1 (drop `azp` from the direct-token sketch). No code changes required for merge or canary.

---

## 十八、Authorization Boundary

Even with a PASS, this audit authorizes at most:
- Merge PR-A at the precise HEAD `6723674`.
- A subsequent **local / controlled** RS256 Machine Token canary.
- Planning (not implementing) PR-B.

Fixed prohibitions (per task):

```text
OBO_IMPLEMENTATION_ALLOWED=no
PRODUCTION_DEPLOYMENT_ALLOWED=no
REAL_MACHINE_CLIENT_PROVISIONING_ALLOWED=no
SVC_WORKFLOW_CONSUMER_SWITCH_ALLOWED=no
```

Because the DB E2E core gating controls **are** proven (§七), the
`PRODUCTION_CANARY_ALLOWED=no` override from the task does **not** trigger:

```text
PRODUCTION_CANARY_ALLOWED=yes
```

(Canary here means a local/controlled RS256 machine-token exercise — still
below production deployment and below real client provisioning, both of which
remain prohibited.)

---

## 十九、Final Status

```text
AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_AUDIT_PASS_WITH_NOTES
```

Rationale for `PASS_WITH_NOTES` (not bare `PASS`): the implementation is
correct, secure, and fully proven at the DB level, but three low-severity
documentation/wording inconsistencies exist between the ADC contract / the
investigation report and the code (N-1, N-2, N-3). None affect security,
compatibility, merge, or canary. They are noted for cleanup and do not block.

---

### Appendix A — Dynamic Verification Summary

All dynamic checks were run by the auditor against either an in-process
keyring/signer or a throwaway local PostgreSQL DB (created with
`postgresql@16`, schema applied via `prisma db push`, destroyed after the run).
No production data was touched; no commits were made; all auditor temp scripts
were removed (the PR-A worktree is byte-for-byte the committed HEAD).

| Suite | Checks | Pass | Fail |
|---|---|---|---|
| client_credentials DB E2E (real `issueToken`) | 25 | 25 | 0 |
| Algorithm confusion + rotation + verify-token DB (real `verifyWorkflowToken` + DB) | 14 (+1 corrected harness) | 14 | 0 |
| JWKS HTTP route + non-workflow compatibility | 29 | 29 | 0 |
| Fail-fast startup validation | 7 | 7 | 0 |
| Committed `test:oauth` | 100 | 100 | 0 |
| Committed identity | 44 | 44 | 0 |
| build (tsc) | — | clean | — |

The single "FAIL" observed during the audit (rotation R2) was an
auditor-harness bug (used `previousPublicKeys` instead of the helper's `previous`
field); re-run with the correct API passed, and the committed
`workflow-rotation.test.ts` (which uses the correct API) passes. Not a code defect.

### Appendix B — Audit Artifacts Not Retained
- Ephemeral DB `auth_audit_jwks_*`: **dropped**.
- Auditor temp scripts `_tmp_audit_*.mjs`: **deleted**.
- No files were added to the commit; the only working-tree change vs HEAD is
  this report file (untracked, like the other reports in this tree).
