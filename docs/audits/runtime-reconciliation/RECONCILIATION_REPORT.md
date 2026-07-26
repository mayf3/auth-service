# AUTH_RUNTIME_MAINLINE_RECONCILIATION_REPORT

**Task**: AUTH_RUNTIME_MAINLINE_RECONCILIATION_V1  
**Date**: 2026-07-26  
**Mode**: CONTROLLED_RECONCILIATION  
**Audit Stop Level**: BLOCKER_HIGH_ONLY  

---

## Section I — Frozen Objects

```
REMOTE_MAIN_HEAD=6d9cbddcbf132ddcbd69a98ab14e1335d4efaabe
REMOTE_MAIN_TREE=
LOCAL_HEAD=d3ba1fd15f3de23ce38a5e2992fce7f56da2aca9
LOCAL_STATUS=M src/middleware/auth.ts, M src/routes/auth.ts, ?? prisma/migrations/20260723000100_canary_all_agent_grants/, ?? prisma/migrations/20260724000100_provisioning_broker_bootstrap/, ?? BUILD_IN_PUBLIC_AGENT_AUTH_REPORT.md, ?? gen-jwt.cjs
AUTH_RUNTIME_PID=93540
AUTH_RUNTIME_START_TIME=Sun Jul 26 06:59:41 2026
	AUTH_RUNTIME_SOURCE_PATH=<PROJECT_ROOT>/dist/src/server.js
	AUTH_RUNTIME_VERSION=1.0.0
	AUTH_RUNTIME_CONTRACT_VERSION=1.2.0
```

**Analysis**: Local HEAD (`d3ba1fd`) is behind `github/main` (`6d9cbdd`) by 2 commits (both docs-only: README addition and document reorganization). The working tree has uncommitted modifications in `src/middleware/auth.ts`, `src/routes/auth.ts`, and untracked migration directories.

The auth-service process (PID 93540) is running from `dist/src/server.js`, compiled from the dirty working tree (dist files dated Jul 25 16:48, after src modifications at Jul 25 12:33).

---

## Section II — Migration Application Status

**Database Query**:
```sql
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE migration_name IN (
  '20260723000100_canary_all_agent_grants',
  '20260724000100_provisioning_broker_bootstrap'
);
```

**Result**: Empty set (0 rows).

```
AGENT_GRANTS_APPLICATION_MODE=manual_sql
BOOTSTRAP_APPLICATION_MODE=manual_sql

AGENT_GRANTS_RECORDED_IN_PRISMA=false
BOOTSTRAP_RECORDED_IN_PRISMA=false
```

**Verdict**: Neither migration was applied via `prisma migrate`. Both were executed manually. However, the database state confirms that **both migrations have been applied** to the database:

- `20260723000100`: All 72 active `mc_oc_*` clients have `svc-okr` okr.read and `svc-workflow` grants. `svc-okr` audience exists.
- `20260724000100`: `mc_prov_N9NO0yYvw_3fR1ucqusIqw` exists (active) with `svc-auth` / `auth.identity.provision` grant. Old client `mc_qO3Hecl2nAa3NircjiZWYKm5` is revoked.

---

## Section III — 20260723000100 (canary_all_agent_grants)

### Security Inspection

| Check | Status |
|-------|--------|
| Contains secret/token/password/secret_hash | ✅ No |
| Targets exactly frozen formal agents | ⚠️ Targets all `mc_oc_%` (72 active); 97 total active agents exist |
| Includes disabled/revoked/non-formal clients | ✅ Filtered by `status='active'` |
| Preserves CEO's existing okr.write | ✅ Only adds okr.read |
| Idempotent (IF NOT EXISTS) | ✅ Yes |
| Verification phase (fail-close) | ✅ Yes |

### Digest

```
SQL file SHA256: de7291fbe7455f9f045e9eb0194fd3016a01c25739ffef705db779f005f136a0
```

### Verdict

Since the migration was applied via **manual SQL** (not `prisma migrate`), it **must not be submitted as a Prisma Migration**. An audit receipt is required instead.

```
AGENT_GRANTS_SAFE_TO_COMMIT=false
AGENT_GRANTS_RECEIPT_REQUIRED=true
```

---

## Section IV — 20260724000100 (provisioning_broker_bootstrap)

### Security Inspection

| Check | Status |
|-------|--------|
| Contains fixed production `secret_hash` | ⛔ YES — commits forbidden |
| Recorded in `_prisma_migrations` | ✅ No (no blocker) |
| Already applied to database | ✅ Confirmed (client exists, active, grant present) |

### Verdict

```
COMMIT_BOOTSTRAP_SQL=false
BOOTSTRAP_SQL_CONTAINS_SECRET_HASH=true
BOOTSTRAP_SQL_WILL_BE_COMMITTED=false
BOOTSTRAP_RECEIPT_REQUIRED=true
BOOTSTRAP_MIGRATION_RECORDED_WITH_SECRET_HASH=false
```

The SQL contains a fixed `secret_hash` (`9c4839bf...`) and **must never enter Git**. Since it was applied manually and is NOT recorded in `_prisma_migrations`, no blocker exists. A non-secret audit receipt is required.

---

## Section V — Local Source Code Analysis

### src/middleware/auth.ts

**Diff**: Added `agentId: user.agentId ?? undefined` to JWT payload in `signAccessToken()`.

**Purpose**: Include `agentId` claim in the signed JWT access token for agent identity propagation.

**Contract Status**: The frozen Contract 1.2.0 includes `agentId` in `AuthUser` interface and `prisma` queries, but **NOT** in the JWT payload/token claims. This is a new extension beyond the frozen scope.

**Runtime Loading**: ✅ Already loaded in `dist/src/middleware/auth.js`.

**Tests**: No dedicated test exists for `agentId` claim in JWT payload.

**Classification**: **New behavior (outside frozen contract)** — DO NOT COMMIT.

### src/routes/auth.ts

**Diff**: Changed `await prisma.user.update(...)` to `user = await prisma.user.update(...)` to capture the updated user object after name update on token-login.

**Purpose**: Fix a bug where the response after agent token-login returned stale `user.name` instead of the updated name.

**Contract Status**: Not part of frozen Contract 1.2.0.

**Runtime Loading**: ✅ Already loaded in `dist/src/routes/auth.js`.

**API Change Assessment**: 
- `token-login` response shape remains unchanged (`accessToken`, `refreshToken`, `user`)
- The `user.name` value may differ (fresh vs stale)
- This does **not** change the public API

**Tests**: No dedicated test for the returned user freshness.

**Classification**: **Bug fix outside frozen contract scope** — DO NOT COMMIT as reconciliation.

---

## Section VI — Runtime Dependency on Dirty Worktree

**Proof**:

| Artifact | Working Tree Digest (SHA256) | Remote main Digest (SHA256) |
|----------|------|------|
| `src/middleware/auth.ts` | `e01c27d793ec...` | `5e0991013e50...` |
| `src/routes/auth.ts` | `5fcbf80cd2c2...` | `32b693123363...` |
| `dist/src/middleware/auth.js` | `d971c2f2aa9f...` | N/A |
| `dist/src/routes/auth.js` | `a951b4827014...` | N/A |

```
RUNTIME_USES_UNCOMMITTED_SOURCE=true
RUNTIME_SOURCE_DIFF_FILES=src/middleware/auth.ts, src/routes/auth.ts
```

**Level**: **HIGH** — the running auth-service process (PID 93540) loads modules from `dist/` which were compiled from the dirty working tree. Both uncommitted changes are actively in use.

---

## Section VII — Final Decision

```
AUTH_RUNTIME_MAINLINE_RECONCILIATION_REPORT=COMPLETE

REMOTE_MAIN_HEAD=6d9cbdd
	AUTH_RUNTIME_SOURCE_PATH=<PROJECT_ROOT>/dist/src/server.js
RUNTIME_USES_UNCOMMITTED_SOURCE=true
RUNTIME_SOURCE_DIFF_FILES=src/middleware/auth.ts, src/routes/auth.ts

AGENT_GRANTS_APPLICATION_MODE=manual_sql
AGENT_GRANTS_RECORDED_IN_PRISMA=false
AGENT_GRANTS_SAFE_TO_COMMIT=false
AGENT_GRANTS_RECEIPT_REQUIRED=true

BOOTSTRAP_APPLICATION_MODE=manual_sql
BOOTSTRAP_RECORDED_IN_PRISMA=false
BOOTSTRAP_SQL_CONTAINS_SECRET_HASH=true
BOOTSTRAP_SQL_WILL_BE_COMMITTED=false
BOOTSTRAP_RECEIPT_REQUIRED=true

MIDDLEWARE_CHANGE_REQUIRED=false
ROUTES_CHANGE_REQUIRED=false
CONTRACT_CHANGE_DETECTED=true

CANDIDATE_BRANCH=N/A
CANDIDATE_HEAD=N/A
CANDIDATE_TREE=N/A
FILES_TO_COMMIT=N/A
FILES_EXCLUDED_AS_SECRET=prisma/migrations/20260724000100_provisioning_broker_bootstrap/migration.sql

DIRECT_DB_WRITE_COUNT=2
ORIGINAL_DIRTY_WORKTREE_TOUCHED=false

BLOCKER=NONE
HIGH=RUNTIME_USES_UNCOMMITTED_SOURCE — both uncommitted changes are loaded and active in the running auth-service process; agentId claim added to JWT payload is outside frozen Contract 1.2.0
```

### Final Classification

```
MAINLINE_ALREADY_REPRESENTS_RUNTIME=false
SAFE_RECONCILIATION_PR_READY_FOR_AUDIT=false
RECONCILIATION_BLOCKED=true
```

**Reason**: The two uncommitted source changes (`src/middleware/auth.ts` and `src/routes/auth.ts`) represent behavior outside the frozen Contract 1.2.0 scope, and the runtime is actively using these modifications. The migration SQLs were applied manually and require audit receipts rather than Git commits. No safe PR candidate exists from the dirty worktree.

### Recommended Actions

1. ⛔ Do NOT commit migration SQL files (especially `20260724000100` which contains `secret_hash`)
2. ⛔ Do NOT commit the uncommitted `auth.ts` changes (outside frozen contract)
3. ✅ Create audit receipts for both manual SQL operations (see `docs/audits/runtime-reconciliation/`)
4. 🔴 HIGH: Address the runtime dependency on dirty worktree — either revert the uncommitted changes and rebuild, or formally audit and extend the contract to include them
5. 🔴 HIGH: The `agentId` claim extension to JWT payload should be evaluated for inclusion in a future contract version
6. ✅ The `routes/auth.ts` bug fix (user reassignment) is harmless but should await proper contract extension
