# auth-service Workflow Principal + JWKS + OBO Implementation Plan

**Status:** `AUTH_SERVICE_WORKFLOW_IDENTITY_PLAN_READY`
**Date:** 2026-07-16
**Mode:** Plan only — no code modified, no commits

---

## Table of Contents

1. [BASE_SHA](#1-base_sha)
2. [CURRENT_IDENTITY_MODEL](#2-current_identity_model)
3. [CURRENT_TOKEN_CONTRACTS](#3-current_token_contracts)
4. [CURRENT_SIGNING_PATHS](#4-current_signing_paths)
5. [COMPATIBILITY_MATRIX](#5-compatibility_matrix)
6. [CANONICAL_SUBJECT_DECISION](#6-canonical_subject_decision)
7. [DIRECT_AGENT_TOKEN_CONTRACT](#7-direct_agent_token_contract)
8. [DIRECT_USER_TOKEN_CONTRACT](#8-direct_user_token_contract)
9. [OBO_TOKEN_CONTRACT](#9-obo_token_contract)
10. [ACTOR_AND_CLIENT_CLAIMS_DECISION](#10-actor_and_client_claims_decision)
11. [SCOPE_INTERSECTION_MODEL](#11-scope_intersection_model)
12. [SIGNING_AND_JWKS_MODEL](#12-signing_and_jwks_model)
13. [KEY_ROTATION_MODEL](#13-key_rotation_model)
14. [VERIFY_TOKEN_MODEL](#14-verify_token_model)
15. [PROVISIONING_REQUIREMENTS](#15-provisioning_requirements)
16. [MIGRATION_REQUIREMENTS](#16-migration_requirements)
17. [AUDIT_MODEL](#17-audit_model)
18. [ERROR_CONTRACT](#18-error_contract)
19. [RECOMMENDED_PR_SEQUENCE](#19-recommended_pr_sequence)
20. [RISKS_AND_OPEN_DECISIONS](#20-risks_and_open_decisions)
21. [IMPLEMENTATION_READY](#21-implementation_ready)

---

## 1. BASE_SHA

| Field | Value |
|-------|-------|
| **Repository** | `auth-service` — `auth-service` |
| **Current HEAD** | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` |
| **Branch** | `feat/openclaw-agent-auth-token-get-v0` (merged to `main`) |
| **Working tree** | Modified `package.json`; untracked report/contract files only; no staged source changes |

> **Note:** `HEAD` and `main` both point to `8ca5fcb`. The working tree has no staged source modifications — only documentation and report files. The plan base is clean.

### Referenced External Repositories

| Repository | Path | SHA |
|------------|------|-----|
| svc-workflow | (external) | `f3306a5d387aa4159a995b7477e4c9da1a7193b7` |
| ADC / agent-dev-center | (external) | `939a93edfa88d06ba234709284c78070212f7137` |

### Frozen Precedent Contracts

| Contract | Status | Location |
|----------|--------|----------|
| Machine Client Credentials v0 | Published | `docs/contracts/` |
| OpenClaw Agent Auth Token Get v0 | Published | `docs/contracts/OPENCLAW_AGENT_AUTH_TOKEN_GET_V0.md` |
| ADC ↔ auth-service ↔ svc-workflow OBO/JWKS Contract | **Frozen** | `ADC_SVC_WORKFLOW_OBO_JWKS_IMPLEMENTATION_CONTRACT.md` |
| auth-service Workflow OBO + JWKS Investigation | Complete | `AUTH_SERVICE_WORKFLOW_OBO_JWKS_INVESTIGATION.md` |

---

## 2. CURRENT_IDENTITY_MODEL

### 2.1 Database Schema (`prisma/schema.prisma`)

The current data model at `8ca5fcb` consists of:

#### User

```prisma
model User {
  id             String        @id @default(uuid()) @db.Uuid
  name           String
  email          String        @unique
  password       String
  role           UserRole      @default(requester)
  internalRole   InternalRole? @map("internal_role")
  okrRole        OkrRole       @default(okr_member) @map("okr_role")
  agentId        String?       @unique
  permissions    Json          @default("[]")
  // ... bio, phone, avatar, department, title, employeeNo, ...
  createdAt DateTime @default(now())
  machinePrincipals MachinePrincipal[]

  @@map("users")
}
```

#### MachinePrincipal

```prisma
enum PrincipalType { agent }
enum PrincipalStatus { active, disabled }

model MachinePrincipal {
  id            String          @id @default(uuid()) @db.Uuid
  principalType PrincipalType   @default(agent) @map("principal_type")
  agentId       String          @unique @map("agent_id")
  ownerUserId   String          @map("owner_user_id") @db.Uuid
  displayName   String?         @map("display_name")
  status        PrincipalStatus @default(active)
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")
  disabledAt    DateTime?       @map("disabled_at")

  owner     User             @relation(fields: [ownerUserId], references: [id])
  clients   MachineClient[]

  @@map("machine_principals")
}
```

#### MachineClient

```prisma
enum ClientStatus { active, revoked }

model MachineClient {
  id                  String       @id @default(uuid()) @db.Uuid
  clientId            String       @unique @map("client_id")
  machinePrincipalId  String       @map("machine_principal_id") @db.Uuid
  secretHash          String       @map("secret_hash")
  status              ClientStatus @default(active)
  allowedResources    String[]     @map("allowed_resources")
  allowedScopes       String[]     @map("allowed_scopes")
  createdAt           DateTime     @default(now()) @map("created_at")
  updatedAt           DateTime     @updatedAt @map("updated_at")
  rotatedAt           DateTime?    @map("rotated_at")
  revokedAt           DateTime?    @map("revoked_at")

  principal MachinePrincipal @relation(fields: [machinePrincipalId], references: [id])

  @@map("machine_clients")
}
```

#### ServiceRegistration

```prisma
model ServiceRegistration {
  id           String       @id @default(uuid()) @db.Uuid
  serviceName  String       @unique @map("service_name")
  displayName  String       @map("display_name")
  jwtAudience  String       @unique @map("jwt_audience")
  allowedRoles String       @default("admin,developer,agent,requester")
  serviceUrl   String?      @map("service_url")
  apiPublicKey String?      @map("api_public_key")
  status       ServiceRegistrationStatus @default(active)
  description  String?
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  @@map("service_registrations")
}
```

### 2.2 Relational Mapping

```
User (1) ──── (N) MachinePrincipal (1) ──── (N) MachineClient
```

- A `User` owns zero or more `MachinePrincipal`s.
- A `MachinePrincipal` has a unique `agentId` (OpenClaw canonical alias).
- A `MachinePrincipal` has one or more `MachineClient`s.
- A `MachineClient` belongs to exactly one `MachinePrincipal`.
- Each `MachineClient` has `allowedResources` (audiences) and `allowedScopes` as string arrays.
- `clientId` format: `mc_` + 24 random base64url characters.

### 2.3 Identity Resolution (PR-1)

The `agent-identity` CLI (PR-1) provides workspace identity resolution:
- Reads `openclaw.json` config → finds agent by workspace directory
- Validates agent ID format (OpenClaw 2026.3.13 rules)
- Verifies `PLATFORM_AGENT_ID` in workspace `.env` matches config
- Result: canonical `agentId` (string) ↔ workspace path mapping

### 2.4 Limitations of Current Model for Workflow Identity

| Capability | Status | Impact |
|------------|--------|--------|
| Agent ↔ MachinePrincipal binding | ✅ Exists | Unique `agentId` → `MachinePrincipal.id` UUID |
| Client ↔ Principal binding | ✅ Exists | `MachineClient.machinePrincipalId` FK |
| PrincipalType enum | ⚠️ Only `agent` | Cannot express `human` or `service` types yet |
| Human canonical ID | ✅ Exists | `User.id` UUID — available but not used in token claims |
| Client-allowed resources | ✅ Exists | `allowedResources[]` for audience gating |
| Client-allowed scopes | ✅ Exists | `allowedScopes[]` for scope gating |
| Revocation/disable model | ✅ Exists | `PrincipalStatus.disabled`, `ClientStatus.revoked` |
| Audit trail | ✅ Exists | `auditLog()` to stderr JSON |
| JWK keys table | ❌ Missing | V0 uses env-var only |

**Assessment:** No new data model changes are required for V0 core. The existing `MachinePrincipal` and `MachineClient` tables fully support the workflow identity model. Only the `PrincipalType` enum may need extension for `human` (in V1).

---

## 3. CURRENT_TOKEN_CONTRACTS

### 3.1 Human User Access Token

**Source:** `src/middleware/auth.ts:51-73` — `signAccessToken()`
**Signing:** HS256 with `env.JWT_SECRET`
**TTL:** 7 days (`env.JWT_EXPIRES_IN`)
**Issued at:** `POST /api/auth/login`, `/api/auth/token-login`, `/api/auth/register`

```json
{
  "sub": "<User.id UUID>",
  "name": "<user name>",
  "role": "<UserRole>",
  "internalRole": "<InternalRole | undefined>",
  "okrRole": "<OkrRole>",
  "iss": "auth-service",
  "aud": "unified-platform",
  "jti": "<user.id-timestamp-random>",
  "type": "access",
  "version": "v1",
  "iat": <epoch>,
  "exp": <epoch + 7d>
}
```

### 3.2 Refresh Token

**Source:** `src/middleware/auth.ts:78-96` — `signRefreshToken()`
**Signing:** HS256 with `env.JWT_REFRESH_SECRET` (derived from `JWT_SECRET`)
**TTL:** 30 days
**Revocation:** In-memory JTI blacklist with rotation

```json
{
  "sub": "<User.id UUID>",
  "iss": "auth-service",
  "aud": "unified-platform",
  "jti": "<user.id-timestamp-refresh-random>",
  "type": "refresh",
  "version": "v1",
  "iat": <epoch>,
  "exp": <epoch + 30d>
}
```

### 3.3 Agent Access Token (Client Credentials)

**Source:** `src/lib/oauth/token.ts:59-82` — `signAgentAccessToken()`
**Signing:** HS256 with `env.JWT_SECRET`
**TTL:** 600s default, hard-capped at 900s
**Issued at:** `POST /oauth/token` with `grant_type=client_credentials`

```json
{
  "sub": "<MachinePrincipal.id UUID>",
  "iss": "auth-service",
  "aud": "<requested resource, e.g. 'svc-forum'>",
  "principal_type": "agent",
  "agent_id": "<canonical OpenClaw agent ID>",
  "client_id": "<OAuth client identifier, mc_xxx>",
  "scope": "<space-delimited scopes>",
  "type": "access",
  "version": "v1",
  "jti": "<principalId-timestamp-random>",
  "iat": <epoch>,
  "exp": <epoch + 600s>
}
```

**Key differences from human token:**
- `sub` = MachinePrincipal.id (not User.id)
- `principal_type: "agent"` claim (not in human tokens)
- `agent_id` and `client_id` claims (not in human tokens)
- `scope` claim (not in human tokens)
- No `name`, `role`, `internalRole`, `okrRole` claims
- Short TTL (10 min vs 7 days)

### 3.4 Token Verification (`authRequired` Middleware)

**Source:** `src/middleware/auth.ts:116-172`

The middleware tries three verification strategies in order:
1. `jwt.verify(token, JWT_SECRET, { issuer: 'auth-service', audience: 'unified-platform' })` — strict
2. `jwt.verify(token, JWT_SECRET, { issuer: 'agent-dev-center', audience: 'adc-api' })` — legacy ADC
3. `jwt.verify(token, JWT_SECRET)` — relaxed (no issuer/audience check)

After verification, looks up `User` by `payload.sub`:
- If user found → sets `req.user`
- If not found → throws 401 "用户不存在或已被禁用"

**Key limitation:** Agent tokens (`sub` = MachinePrincipal UUID) will never find a User, so they always fail at this middleware. This is intentional — agent tokens should not authenticate at human endpoints.

### 3.5 Service Registration Verify-Token Endpoint

**Source:** `src/routes/service-registrations.ts:204-274` — `POST /api/services/verify-token`

- Accepts `{ token, audience? }` in request body
- Verifies JWT with `env.JWT_SECRET` (no algorithm restriction)
- Looks up `User` by `payload.sub`
- If `audience` provided: checks service exists and user's role is in `allowedRoles`
- Returns `{ valid, user }`

**Key limitation:** Same as `authRequired` — cannot handle agent tokens. No `principal_type` detection.

---

## 4. CURRENT_SIGNING_PATHS

### 4.1 Algorithm

**100% HS256 (HMAC-SHA256)** across all token types:
- Human access: `jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' })` — implicit HS256
- Agent access: `jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256' })` — explicit
- Refresh: `jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '30d' })` — implicit

### 4.2 Key Material

| Secret | Source | Lines | Purpose |
|--------|--------|-------|---------|
| `JWT_SECRET` | Env var (required) | `env.ts:22` | All access token signing |
| `JWT_REFRESH_SECRET` | Env var or derived | `env.ts:26` | Refresh token signing |
| `AGENT_TOKEN_SECRET` | Env var or fallback | `env.ts:40` | Agent token-login (legacy) |

**Derivation** (`env.ts:5-8`):
```typescript
function getOrDeriveSecret(primary, fallback, label): string {
  if (primary && primary !== fallback) return primary;
  return crypto.createHash('sha256').update(fallback + ':' + label).digest('hex');
}
```

### 4.3 Key Management Gaps

| Gap | Detail |
|-----|--------|
| No asymmetric keys | Zero RS256, EdDSA, or JWKS code exists |
| No `kid` | No key ID in any JWT header |
| No JWKS endpoint | `GET /.well-known/jwks.json` does not exist |
| No key rotation | `JWT_SECRET` is static; rotation requires coordinated restart of all services |
| Shared secret | All downstream services must hold the same HS256 secret |
| No algorithm whitelist | `jsonwebtoken` default allows algorithm confusion if not explicitly restricted |

### 4.4 Verification Paths

```
Token arrives
  │
  ├─ authRequired middleware (auth.ts:116-172)
  │    ├─ Try: HS256 + JWT_SECRET + issuer+audience strict
  │    ├─ Try: HS256 + JWT_SECRET + legacy issuer+audience
  │    └─ Try: HS256 + JWT_SECRET (no issuer/audience)
  │    └─ User lookup by sub
  │
  └─ verify-token endpoint (service-registrations.ts:204-274)
       └─ HS256 + JWT_SECRET (no issuer/audience check)
       └─ User lookup by sub
```

No path currently handles `principal_type: 'agent'` — all paths assume `sub` is a User UUID.

---

## 5. COMPATIBILITY_MATRIX

### 5.1 Audience-Based Algorithm Strategy

| Audience | Current Algorithm | V0 Algorithm | Change? |
|----------|------------------|--------------|---------|
| `unified-platform` (human default) | HS256 | HS256 (unchanged) | ❌ No |
| `adc-api` (legacy) | HS256 | HS256 (unchanged) | ❌ No |
| `svc-forum`, `svc-okr`, `llm-todo` (existing) | HS256 | HS256 (unchanged) | ❌ No |
| `svc-workflow` (new) | N/A | **RS256** | ✅ New |
| All OBO tokens | N/A | **RS256** | ✅ New |

### 5.2 What Breaks

**Nothing breaks immediately** — existing HS256 tokens continue to work:

| Consumer | Token Type | Algorithm | Broken? |
|----------|-----------|-----------|---------|
| `authRequired` middleware | Human access | HS256 | ❌ No |
| `authRequired` middleware | Agent access (any aud) | HS256 | ❌ No (already can't auth here) |
| `POST /api/services/verify-token` | Human access | HS256 | ❌ No |
| `POST /api/services/verify-token` | Agent access | HS256 | ❌ No (already fails lookup) |
| Forum | Human token-login | HS256 | ❌ No |
| ADC | Legacy tokens | HS256 | ❌ No |
| `agent-auth` CLI | Agent tokens (HS256) | HS256 | ❌ No |
| `svc-workflow` | Direct Agent (RS256) | RS256 | ✅ New audience |
| `svc-workflow` | OBO (RS256) | RS256 | ✅ New audience |

### 5.3 What Needs Awareness

| Component | Impact | Priority |
|-----------|--------|----------|
| `authRequired` middleware | Agent tokens still fail (correct behavior) | Low — by design |
| `POST /api/services/verify-token` | Must handle `principal_type: 'agent'` | **High** — blocker for svc-workflow |
| `svc-workflow` verifier | Must add RS256 verification + JWKS fetching | **High** — PR-C |
| ADC OAuth client | Must support OBO token exchange | **High** — PR-E |
| `agent-auth` CLI | No change for HS256; RS256 token verifier needs `kid` awareness | Low — backward compatible |

### 5.4 Transition Strategy

```
Phase 1 (V0)     svc-workflow ─── RS256 ─── auth-service
                  Other services ─── HS256 ─── auth-service

Phase 2 (V1)     All services ─── RS256 ─── auth-service (HS256 deprecated)
```

During Phase 1, the auth-service supports **dual signing**:
- `aud=svc-workflow` → RS256 (new `signWorkflowToken()`)
- All other audiences → HS256 (existing `signAgentAccessToken()` / `signAccessToken()`)

### 5.5 Existing Consumer Compatibility Guarantees

| Guarantee | Enforcement |
|-----------|-------------|
| Existing HS256 token formats unchanged | No changes to `signAccessToken()`, `signAgentAccessToken()`, `signRefreshToken()` |
| Existing endpoints unchanged | No changes to `/api/auth/*`, `/api/users/*`, `/api/roles/*` |
| Existing `authRequired` behavior unchanged | No changes to the middleware's verification flow |
| Existing `POST /api/services/verify-token` for human tokens | Only extend, never change existing behavior |
| `agent-auth` CLI unchanged | Existing `client_id` claim preserved for backward compatibility |

---

## 6. CANONICAL_SUBJECT_DECISION

### 6.1 Decision

**The canonical subject (`sub`) in all JWT tokens MUST be the persistent UUID from auth-service's data model.**

| Subject Type | auth-service Model | Canonical `sub` Value | svc-workflow PrincipalType |
|-------------|-------------------|----------------------|---------------------------|
| **Agent** | `MachinePrincipal.id` | UUID | `AGENT` |
| **Human** | `User.id` | UUID | `HUMAN` |
| **Service** (V1) | `MachinePrincipal` (service type) | UUID | `SERVICE` |

### 6.2 Rationale

1. **Immutability**: UUIDs never change — `agentId` (OpenClaw alias) could theoretically be reassigned.
2. **Universality**: Both `MachinePrincipal.id` and `User.id` are UUIDs with the same format — consistent for downstream consumers.
3. **Existing practice**: Current `signAgentAccessToken()` already uses `principalId` (MachinePrincipal.id) as `sub`.
4. **Foreign key compatibility**: svc-workflow's `principals.principal_id` is UUID typed.
5. **Not**: OpenClaw `agentId`, client ID, display name, directory name, or requester-supplied UUID.

### 6.3 Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| `agentId` as `sub` | Mutable; could conflict across systems; not a UUID |
| `clientId` as `sub` | A client is not a principal; multiple clients can share one principal |
| Request-supplied UUID | No security guarantee; must come from verified token |
| User email as `sub` | Mutable; PII concern; not UUID |

---

## 7. DIRECT_AGENT_TOKEN_CONTRACT

### 7.1 Token Endpoint

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=client_credentials
&resource=svc-workflow
&scope=workflow.read workflow.execute
```

### 7.2 Client Authentication

HTTP Basic Authentication with `client_id:client_secret`. The `client_id` must identify an active `MachineClient` belonging to an active `MachinePrincipal`.

### 7.3 Audience

`resource` parameter (maps to `aud` claim). Must exactly match an entry in the client's `allowedResources`.

### 7.4 Supported Scopes (V0)

| Scope | Description |
|-------|-------------|
| `workflow.read` | Read workflow instances, timelines |
| `workflow.execute` | Create and transition workflow instances |

`workflow.admin` is reserved for V1 (Provisioning API authentication).

### 7.5 Frozen Claims

```json
{
  "iss": "auth-service",
  "sub": "<MachinePrincipal.id UUID>",
  "aud": "svc-workflow",
  "principal_type": "agent",
  "scope": "workflow.read workflow.execute",
  "token_use": "access",
  "type": "access",
  "version": "v1",
  "agent_id": "<canonical OpenClaw agent ID>",
  "client_id": "<OAuth client identifier>",
  "jti": "<unique token ID>",
  "iat": <epoch>,
  "nbf": <epoch>,
  "exp": <epoch>
}
```

### 7.6 Claim Reference

| Claim | Required | Value | Source |
|-------|----------|-------|--------|
| `iss` | ✅ Fixed | `auth-service` | Config |
| `sub` | ✅ | MachinePrincipal UUID | DB |
| `aud` | ✅ | Requested resource (single string) | Request |
| `principal_type` | ✅ | `agent` | MachinePrincipal.principalType |
| `scope` | ✅ | Space-delimited, sorted | After intersection |
| `token_use` | ✅ | `access` | Fixed for direct tokens |
| `type` | ✅ | `access` | Fixed (for backward compatibility) |
| `version` | ✅ | `v1` | Config |
| `agent_id` | ✅ | Canonical OpenClaw alias | MachinePrincipal.agentId |
| `client_id` | ✅ | OAuth client identifier | MachineClient.clientId |
| `jti` | ✅ | Unique per token | Generated |
| `iat` | ✅ | Current epoch | System |
| `nbf` | ✅ | Same as `iat` | System |
| `exp` | ✅ | `iat + TTL` (capped at 900s) | System |

### 7.7 Prohibited Claims

- `name` ❌
- `role` ❌
- `internalRole` ❌
- `okrRole` ❌
- `permissions` ❌

### 7.8 TTL

- **Default:** 600 seconds (10 minutes)
- **Hard cap:** 900 seconds (15 minutes)
- **No refresh token**

### 7.9 Signing Algorithm

**RS256** with the active private key. Header includes `kid` matching the JWKS entry.

---

## 8. DIRECT_USER_TOKEN_CONTRACT

### 8.1 Token Endpoint

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "<user email>",
  "password": "<user password>"
}
```

### 8.2 Current Contract (Unchanged for V0)

The existing human access token format remains **unchanged** in V0. Human tokens continue to be signed with HS256 and have the same claims structure.

### 8.3 V1 Consideration

When human workflow tokens are needed (for direct human → svc-workflow calls), a new signing function `signHumanWorkflowToken()` will be added that:
- Signs with RS256 (not HS256)
- Uses `sub` = `User.id` UUID
- Sets `principal_type: 'human'` (new enum value needed)
- Sets `aud` = `svc-workflow`
- Sets `token_use: 'access'`
- Excludes `name`, `role`, `internalRole`, `okrRole` (these are not needed by svc-workflow)
- Sets short TTL (≤ 900s, not 7 days)

**This is explicitly deferred to a follow-up PR (not in V0 scope).**

---

## 9. OBO_TOKEN_CONTRACT

### 9.1 Token Endpoint

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic <ADC-client_id:ADC-client_secret>

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
subject_token=<subject token>
subject_token_type=urn:ietf:params:oauth:token-type:access_token
requested_token_type=urn:ietf:params:oauth:token-type:access_token
audience=svc-workflow
scope=workflow.read workflow.execute
```

### 9.2 Flow

1. **Authenticate ADC** via Basic Auth (client_id + client_secret) — same as `client_credentials`
2. **Verify ADC client**: status = `active`, principal ≠ `disabled`
3. **Verify subject_token**: RS256-signed, `iss === 'auth-service'`, not expired, `nbf` valid
4. **Extract subject claims**: `sub`, `principal_type`, `scope`, `agent_id` (if agent)
5. **Scope intersection**: `min(subject_token.scope, ADC_client.allowedScopes, requested_scope)`
6. **Audience check**: `audience` must be in `ADC_client.allowedResources`
7. **Issue OBO token** with `act` and `azp` claims

### 9.3 Subject Token Verification Rules

| Check | Condition | Failure Response |
|-------|-----------|-----------------|
| Signature | RS256 valid against active or previous key | 400 `invalid_grant` |
| Issuer | `iss === 'auth-service'` | 400 `invalid_grant` |
| Expiration | `exp > now` | 400 `invalid_grant` |
| Not Before | `nbf <= now` | 400 `invalid_grant` |
| Token type | `type === 'access'` | 400 `invalid_grant` |
| Audience | Not restricted (any aud allowed as subject) | — |
| Principal status | Principal must exist and be enabled | 400 `invalid_grant` |

**Critical:** `sub` is extracted ONLY from the verified subject_token. The `requested_subject` parameter is NOT supported — if provided, it is silently ignored or rejected with `invalid_request`.

### 9.4 Scope Intersection (Frozen)

```text
OBO.scope = intersection(
  subject_token.scope,        // What the subject can do
  ADC_client.allowedScopes,   // What ADC client is allowed to proxy
  requested_scope             // What was asked for in this request
)
```

3-way intersection. If the result is empty → 400 `invalid_scope`.

### 9.5 Frozen Claims

```json
{
  "iss": "auth-service",
  "sub": "<subject_token's real sub UUID>",
  "aud": "svc-workflow",
  "principal_type": "<subject's real principal_type>",
  "scope": "<3-way intersected scopes>",
  "token_use": "workflow_obo",
  "type": "access",
  "version": "v1",
  "act": {
    "sub": "<ADC MachinePrincipal.id UUID>"
  },
  "azp": "<ADC client_id>",
  "agent_id": "<subject's agent_id if subject is agent>",
  "client_id": "<ADC client_id>",
  "jti": "<unique>",
  "iat": <epoch>,
  "nbf": <epoch>,
  "exp": <epoch>
}
```

### 9.6 Claim Reference

| OBO Claim | Source | Notes |
|-----------|--------|-------|
| `iss` | Fixed | `auth-service` |
| `sub` | Subject token's `sub` | **Cannot be overridden by request** |
| `aud` | Request `audience` | Must be in ADC's allowedResources |
| `principal_type` | Subject token's `principal_type` | `agent` or (future) `human` |
| `scope` | 3-way intersection | See Section 11 |
| `token_use` | Fixed | `workflow_obo` — identifies OBO token |
| `type` | Fixed | `access` (backward compat) |
| `version` | Fixed | `v1` |
| `act` | Nested object | `{ "sub": "<ADC MachinePrincipal.id UUID>" }` — proxy actor |
| `azp` | ADC client_id | Authorized party (RFC 8693) |
| `agent_id` | Subject token's `agent_id` | Only present if subject is agent |
| `client_id` | ADC client_id | Same as `azp` (backward compat) |
| `jti` | Newly generated | Always unique |
| `iat` | Current time | |
| `nbf` | Same as `iat` | |
| `exp` | `iat + OBO_TTL` | See Section 9.7 |

### 9.7 OBO TTL

| Parameter | Value |
|-----------|-------|
| Max TTL | **300 seconds** (5 minutes) |
| Refresh token | **None** |
| Expiry boundary | `min(iat + 300, subject_token.exp)` |

**Formula:**
```
OBO.exp = min(
  iat + OBO_MAX_TTL,    // 5 min
  subject_token.exp      // Cannot outlive subject token
)
```

### 9.8 Security Rules

| Rule | Enforcement |
|------|-------------|
| Audience fixed to `svc-workflow` | V0 only accepts `audience=svc-workflow` |
| No arbitrary subject replacement | `requested_subject` not supported |
| Subject must exist and be enabled | Principal lookup after verification |
| ADC client must exist and be enabled | Same check as `client_credentials` |
| Input token must be fully verified | RS256 signature + claims validation |
| No scope expansion | Scope can only shrink (intersection) |
| No refresh token | Response never includes `refresh_token` |
| Unique `jti` | Generated per call |
| `act` does not grant domain permissions | Domain authorization always based on `sub` |

---

## 10. ACTOR_AND_CLIENT_CLAIMS_DECISION

### 10.1 `act` Claim Format

**Decision:** Nested object per RFC 8693.

```json
{
  "act": {
    "sub": "<ADC MachinePrincipal.id UUID>"
  }
}
```

**Rationale:**
- RFC 8693 standard format for "acting party" claims
- Allows future extension with additional `act` sub-claims (e.g., `act.name`)
- Rust serde can handle nested deserialization trivially

### 10.2 `azp` Claim

**Decision:** Include `azp` in OBO tokens per RFC 8693.

```json
{
  "azp": "<ADC OAuth client_id>"
}
```

Value: The ADC's `MachineClient.clientId` (e.g., `mc_abc123...`).

### 10.3 `client_id` Claim (Backward Compatibility)

**Decision:** Keep existing `client_id` claim in OBO tokens alongside `azp`.

```json
{
  "azp": "<ADC client_id>",
  "client_id": "<ADC client_id>"
}
```

**Rationale:**
- The `agent-auth` CLI (`PR-2B`) checks `client_id` in its local consistency validation
- Removing `client_id` would break the CLI's `checkAgentConsistency()` for OBO tokens
- V1 can deprecate `client_id` after all consumers have migrated to `azp`

### 10.4 Direct Token Actor Claims

Direct tokens (non-OBO) do NOT include `act` or `azp` claims. The token represents the principal itself, not an actor acting on behalf of another.

### 10.5 `token_use` Claim

| Token Type | `token_use` Value | Description |
|-----------|-------------------|-------------|
| Direct Agent | `access` | Token used by the principal directly |
| Direct User | (not yet implemented) | TBD in V1 |
| OBO | `workflow_obo` | Token used by ADC on behalf of a subject |

The `token_use` claim allows svc-workflow to distinguish direct tokens from OBO tokens without relying on the presence/absence of `act`.

### 10.6 Principal Type Enum Considerations

The current `PrincipalType` enum only has `agent`. For V0, we add `human` to support human workflow tokens in the future. This requires a database migration.

**Decision for V0:** Do NOT add `human` to the enum now. If the subject token is a User token (human), treat `principal_type` as the new value `human` in the JWT claim without requiring the DB enum to be updated. The `principal_type` claim value is a JWT string, not directly derived from the enum. This is a **code-level** decision, not a schema change.

**However**, if we want strong typing, we need to add `human` to the `PrincipalType` enum. Assessment:

| Option | Pros | Cons |
|--------|------|------|
| Code-only: emit `"human"` as JWT string | No migration | Less type safety |
| Migration: add `human` to enum | Type-safe | Migration needed |

**Recommendation:** Add `human` to the `PrincipalType` Prisma enum in V0. This is a simple enum alteration (no data migration), and it future-proofs the model. See Section 16.

---

## 11. SCOPE_INTERSECTION_MODEL

### 11.1 Overview

Scope authorization uses a multi-way intersection model:

| Token Type | Scope Check |
|-----------|-------------|
| Direct Agent | `requested_scope ∩ client.allowedScopes` (2-way) |
| User Token | Not applicable (no scope claim) |
| OBO | `subject_token.scope ∩ ADC_client.allowedScopes ∩ requested_scope` (3-way) |
| OBO (future) | Above + `service_policy` (4-way) |

### 11.2 Direct Token Scope Check (Existing, Unchanged)

```typescript
function validateRequestedScope(requested: string, allowed: string[]): string {
  const parsed = parseScopeString(requested); // dedup, sort
  const allowedSet = new Set(allowed);
  for (const s of parsed) {
    if (!allowedSet.has(s)) {
      throw new Error(`Scope "${s}" is not authorized`);
    }
  }
  return parsed.join(' ');
}
```

**Existing behavior:** All requested scopes must be in the allowed set. No partial grant — either all pass or throw.

### 11.3 OBO Scope Intersection (New)

```typescript
function computeOBOScope(
  subjectTokenScope: string,
  adcClientAllowedScopes: string[],
  requestedScope: string,
): string {
  const subjectScopes = new Set(parseScopeString(subjectTokenScope));
  const allowedSet = new Set(adcClientAllowedScopes);
  const requested = parseScopeString(requestedScope);
  
  const intersected = requested.filter(
    s => subjectScopes.has(s) && allowedSet.has(s),
  ).sort();
  
  if (intersected.length === 0) {
    throw new Error('No scopes in common');
  }
  
  return intersected.join(' ');
}
```

**Behavior:** Only scopes present in ALL three sets are granted. The result is a subset (or empty, which throws).

### 11.4 Scope Format Rules

| Rule | Specification |
|------|---------------|
| Format | `<domain>.<action>` |
| Delimiter | Space (single space between scopes) |
| Case | Case-sensitive |
| Normalization | Deduplicated, then sorted alphabetically |
| Empty scope | Allowed (means "no scopes requested") |
| Wildcard | None in V0 |

### 11.5 V0 Supported Workflow Scopes

| Scope | Intended Use |
|-------|--------------|
| `workflow.read` | Read workflow instances, timelines |
| `workflow.execute` | Create and transition workflow instances |

`workflow.admin` is V1 (for Provisioning API authentication).

---

## 12. SIGNING_AND_JWKS_MODEL

### 12.1 Algorithm Decision: RS256

| Criterion | RS256 | EdDSA (Ed25519) |
|-----------|-------|-----------------|
| `jsonwebtoken` support | ✅ Native (built-in) | ❌ Not supported |
| JWKS standard | ✅ RFC 7517 | ✅ Supported |
| Key generation | ✅ `openssl genrsa -out private.pem 2048` | ✅ `openssl genpkey -algorithm ed25519` |
| Ecosystem maturity | ✅ Industry standard | ⚠️ Newer, fewer implementations |
| Downstream library support | ✅ Node.js, Rust, Python, Java all native | ⚠️ Requires library addition |
| Library migration | **Zero change** | Requires `jose` library |

**Decision:** **RS256**. Zero library migration required across all three repositories. EdDSA deferred to V1.

### 12.2 Algorithm Whitelist

```typescript
const ALLOWED_ALGORITHMS = ['RS256'];
```

- **JWKS mode (production):** Only `RS256`. `HS256` is strictly rejected.
- **test_hs256 mode (development):** Only `HS256`, loopback-bound (127.0.0.1).
- Enforcement: `WORKFLOW_AUTH_MODE` gating in svc-workflow (no default — fail to start if unset).

### 12.3 Private Key Storage

**Decision:** Environment variable only (V0).

```bash
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# OR
JWT_PRIVATE_KEY_FILE=/run/secrets/jwt-private-key.pem
```

**Format:** PEM-encoded RSA private key (PKCS#8), 2048-bit minimum.

**Loading:** Read at startup, store in memory. Never logged or exposed via API.

**V1 enhancement:** Database-backed `jwk_keys` table for hot rotation without restart.

### 12.4 JWKS Endpoint

```
GET /.well-known/jwks.json
```

**Authentication:** None (public key distribution endpoint).

**Response format (RFC 7517):**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-v1-20260701",
      "use": "sig",
      "alg": "RS256",
      "n": "base64url-encoded-modulus",
      "e": "AQAB"
    }
  ]
}
```

**Prohibited in response:** `d` (private exponent), `p`, `q`, `dp`, `dq`, `qi`, or any private key parameters.

### 12.5 `kid` Format

```
key-v1-<YYYYMMDD>
```

- `v1` = key version scheme (fixed)
- `YYYYMMDD` = key creation date
- Example: `key-v1-20260701`, `key-v1-20260715`
- Allows chronological ordering and human-readable identification
- Always present in RS256-signed token headers

### 12.6 Active Key and Previous Verification Keys

```typescript
interface KeyPair {
  kid: string;
  privateKey: string;     // PEM
  publicKey: JsonWebKey;  // JWK format
  createdAt: string;      // ISO date
  isActive: boolean;      // Current signing key
}
```

- **activeKey:** One key that signs NEW tokens
- **verificationKeys:** Array of activeKey + 1-2 previous public keys for verification (during rotation grace period)

### 12.7 Key Rotation Window

| Phase | Action | Duration |
|-------|--------|----------|
| Announce | New key added to JWKS but NOT signing yet | 24h |
| Active | New key starts signing; old key still in JWKS for verification | Until old key expires |
| Grace | Old key removed from JWKS; verification still allowed | max(agent TTL, 15 min) |
| Expired | Old key completely discarded | After grace period |

**V0 simplification:** Manual rotation (config change + restart). Automated rotation is V1.

### 12.8 Cache Headers

```
Cache-Control: public, max-age=3600, must-revalidate
ETag: "<sha256-of-jwks-body>"
```

- 1-hour public cache
- ETag for conditional re-fetch
- Key change → ETag change → clients re-fetch

### 12.9 Clock Skew Tolerance

```typescript
const CLOCK_TOLERANCE_SECS = 30;
```

Applied via `jsonwebtoken`'s `clockTolerance` option for verification.

---

## 13. KEY_ROTATION_MODEL

### 13.1 V0: Manual Rotation

**Mechanism:** Config change + restart.

1. Generate new RSA key pair
2. Add new private key to env var config (alongside old if using DB-backed)
3. Restart auth-service
4. New key becomes active (JWKS includes both keys during grace period)
5. Old key retired after grace period

**Mitigation for restart downtime:** Short TTL means tokens issued just before restart expire quickly. Low impact.

### 13.2 V1: Automated Rotation (Future)

Database-backed `jwk_keys` table with:
- Scheduled key generation (e.g., monthly)
- Automatic phase transitions (announce → active → grace → expired)
- No restart required
- Audit trail of key lifecycle

### 13.3 Old Key Decommissioning

- Old key remains in `verificationKeys` for at least `MAX_AGENT_TOKEN_TTL` (900s) + 60s buffer after deactivation
- After buffer, removed from `verificationKeys` and JWKS
- Any token signed with old key will fail verification (by design — short TTL makes this acceptable)

### 13.4 Emergency Key Rotation

If a private key is compromised:
1. Generate new key pair immediately
2. Update auth-service config
3. Restart auth-service
4. Old key removed from verificationKeys immediately (existing short-lived tokens expire within 15 min max)

---

## 14. VERIFY_TOKEN_MODEL

### 14.1 Current Limitation

`POST /api/services/verify-token` (`service-registrations.ts:204-274`) only looks up `User` by `sub`. Agent tokens (with `sub` = MachinePrincipal UUID) will fail with "用户不存在".

### 14.2 Enhanced Verify-Token (PR-A)

The endpoint must be extended to handle two token types:

```typescript
// After JWT verification
if (payload.principal_type === 'agent') {
  const principal = await prisma.machinePrincipal.findUnique({
    where: { id: payload.sub },
  });
  if (!principal || principal.status === 'disabled') {
    throw new HttpError(401, 'Principal not found or disabled');
  }
  res.json({ valid: true, principal: { id, agentId, displayName, status } });
} else {
  // Existing human token logic (unchanged)
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  // ... existing code ...
}
```

### 14.3 Verification Response for Agent Tokens

```json
{
  "valid": true,
  "principal": {
    "id": "<MachinePrincipal UUID>",
    "agent_id": "<canonical agent ID>",
    "display_name": "<human-readable name or null>",
    "status": "active",
    "principal_type": "agent"
  }
}
```

### 14.4 Verification Response for OBO Tokens

```json
{
  "valid": true,
  "obo": true,
  "principal": {
    "id": "<subject's MachinePrincipal or User UUID>",
    "principal_type": "agent",
    "status": "active"
  },
  "act": {
    "sub": "<ADC MachinePrincipal UUID>"
  },
  "azp": "<ADC client_id>"
}
```

### 14.5 Verification Rules Summary

| Token Type | Algorithm | `sub` Lookup | Audience Check | Role Check |
|-----------|-----------|-------------|----------------|------------|
| Human access (existing) | HS256 | `User` by `sub` | ✅ If provided | ✅ If provided |
| Agent access (existing) | HS256 | `MachinePrincipal` by `sub` | ✅ If provided | N/A (no role) |
| Agent workflow (new) | RS256 | `MachinePrincipal` by `sub` | ✅ If provided | N/A (no role) |
| OBO (new) | RS256 | Subject's principal by `sub` | ✅ Must match | N/A (scopes only) |

### 14.6 Token Type Detection

Detection order (fail-safe with type inference):

| Has `act`? | Has `principal_type`? | `token_use` | Inference |
|-----------|----------------------|-------------|-----------|
| ✅ Yes | — | `workflow_obo` | OBO token |
| ❌ No | `agent` | `access` | Agent token |
| ❌ No | ❌ No (or undefined) | — | Human token (legacy) |

### 14.7 No Changes to `authRequired` Middleware

The `authRequired` middleware (`middleware/auth.ts`) is intentionally NOT modified to support agent tokens. Agent tokens should not authenticate to human API endpoints. Downstream services that need to accept both token types should use the `verify-token` endpoint or implement their own verifier (as svc-workflow does).

---

## 15. PROVISIONING_REQUIREMENTS

### 15.1 Scope

Provisioning refers to creating Principals, Domains, and Domain Role Bindings in svc-workflow so that workflow authorization can function. This is the responsibility of svc-workflow (not auth-service).

### 15.2 Recommended: svc-workflow Internal Admin API

New endpoints under `/internal/v1/admin/` with `workflow.admin` scope:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/internal/v1/admin/principals` | Create or update Principal (upsert by principal_id) |
| `POST` | `/internal/v1/admin/principals/{id}/disable` | Disable Principal (set enabled=false) |
| `POST` | `/internal/v1/admin/domains` | Create or update Domain |
| `POST` | `/internal/v1/admin/domain-role-bindings` | Create or update role binding |
| `POST` | `/internal/v1/admin/domain-role-bindings/{id}/disable` | Revoke role binding |

### 15.3 Constraints

1. **Idempotency**: `principal_id` as idempotency key. Same ID repeated must succeed (200, not 409).
2. **Type conflict**: If principal exists with different `principal_type` → 409 `type_conflict`.
3. **No deletion**: Principals cannot be deleted (FK references). Use `enabled=false`.
4. **auth-service does not write svc-workflow DB directly.** All provisioning through API.

### 15.4 Principal Type Mapping

| auth-service Type | svc-workflow PrincipalType |
|------------------|---------------------------|
| `MachinePrincipal.id` | `AGENT` |
| `User.id` | `HUMAN` |
| (future: service principal) | `SERVICE` |

### 15.5 V0 Provisioning Flow (Canary)

For the initial canary deployment, provisioning can be done via seed SQL scripts or manual API calls. The full Internal Admin API (PR-D) is required before production rollout.

### 15.6 Out of Scope for auth-service PRs

- Principal provisioning in svc-workflow → PR-D
- ADC Mapping Ledger → PR-E
- Domain/role management in svc-workflow → PR-D

---

## 16. MIGRATION_REQUIREMENTS

### 16.1 V0 Core: No Database Migration Required

| Component | Requires Migration? | Rationale |
|-----------|-------------------|-----------|
| RS256 private key | ❌ No | Environment variable (`JWT_PRIVATE_KEY`/`JWT_PRIVATE_KEY_FILE`) |
| JWKS endpoint | ❌ No | Pure code — no new table |
| OBO Token Exchange | ❌ No | Pure code — new route branch |
| Scope intersection | ❌ No | Pure function |
| Audit extension | ❌ No | Type extension only |
| Verify-token enhancement | ❌ No | Logic extension only |
| Agent workflow token signing | ❌ No | New function + existing tables |

### 16.2 V0 Optional: PrincipalType Enum Migration

**Decision:** Add `human` to the `PrincipalType` enum for future-proofing.

```prisma
enum PrincipalType {
  agent
  human     // NEW
}
```

**Risk assessment:**
- **Type:** Enum alteration (add member) — no data migration
- **Backward compatible:** Existing `agent` records unchanged
- **Rollback:** Remove enum value (but ensure no `human` records exist first)
- **Production risk:** Low — Prisma handles enum additions safely
- **Migration command:** `npx prisma migrate dev --name add_principal_type_human`

**Recommendation:** Include this migration in PR-A. It's a 1-line schema change with zero data migration risk.

### 16.3 V0 Optional: Add `token_type` Column to Audit (Future)

If structured audit storage is needed (V1+), a new `audit_logs` table would be required. Not needed for V0.

### 16.4 V1 Migrations (Deferred)

| Migration | Reason | Scope |
|-----------|--------|-------|
| `jwk_keys` table | DB-backed key storage for hot rotation | V1 |
| `token_blacklist` table | JTI blacklist / online revocation | V1 |
| `delegations` table | Long-running delegation (beyond OBO) | V1 |

### 16.5 Required Configuration Changes

| Config | Type | Required For |
|--------|------|-------------|
| `JWT_PRIVATE_KEY` | New env var | auth-service RS256 signing |
| `JWT_PRIVATE_KEY_FILE` | New env var (alt) | auth-service RS256 signing via file |
| `WORKFLOW_AUTH_MODE` | New env var | svc-workflow auth mode gating |
| `WORKFLOW_JWKS_URL` | New env var | svc-workflow JWKS endpoint |
| `WORKFLOW_JWT_ISSUER` | New env var | svc-workflow expected issuer |
| `WORKFLOW_JWT_AUDIENCE` | New env var | svc-workflow expected audience |

---

## 17. AUDIT_MODEL

### 17.1 Existing Audit

**Source:** `src/lib/oauth/audit.ts`

Current events:
- `principal.created`, `principal.disabled`
- `client.created`, `client.rotated`, `client.revoked`
- `token.issued`, `token.failed`

Output: Structured JSON to stderr via `console.warn`.
Never includes: client secret, access token, authorization header, full request body, or secret hash.

### 17.2 Extended Audit for OBO (PR-B)

**New event types:**
```
obo.token.issued
obo.token.failed
```

**New optional fields in AuditEvent:**

```typescript
interface AuditEvent {
  // ... existing fields ...
  subjectSub?: string;           // OBO: subject token sub
  subjectPrincipalType?: string; // OBO: subject token principal_type
  subjectJti?: string;           // OBO: subject token jti
  requestId?: string;            // OBO: request correlation ID
}
```

### 17.3 OBO Audit Event Fields

| Field | Source | Sensitive? |
|-------|--------|------------|
| `jti` | Generated OBO token jti | No |
| `subjectSub` | Subject token payload | UUID (not PII) |
| `subjectPrincipalType` | Subject token payload | No |
| `actSub` | ADC MachinePrincipal.id | No |
| `azp` (masked) | ADC client_id | No (masked: first 8 chars) |
| `audience` | Request audience | No |
| `scope` | Computed intersection | No |
| `subjectJti` | Subject token payload | No |
| `success` | Outcome | No |
| `error` | On failure | No |
| `requestId` | Correlation ID | No |

### 17.4 Prohibited Audit Content

- Full access token ❌
- Full subject token ❌
- Client secret ❌
- Private key ❌
- Authorization header ❌

### 17.5 Audit Implementation (V0)

**Decision:** Extend existing `console.warn` JSON to stderr. No database table. This is consistent with the existing pattern and sufficient for V0.

### 17.6 svc-workflow Request Audit (External)

svc-workflow will independently log request authentication events:

```rust
tracing::info!(
    token_use = %claims.token_use,
    principal_id = %claims.sub,
    act_sub = %claims.act_sub,
    azp = %claims.azp,
    jti = %claims.jti,
    request_id = %request_id,
    "authenticated request"
);
```

---

## 18. ERROR_CONTRACT

### 18.1 Standard OAuth 2.0 Error Responses

All errors from `/oauth/token` follow OAuth 2.0 RFC 6749 error format:

```json
{
  "error": "<error-code>"
}
```

### 18.2 Client Credentials Errors (Existing, Extended)

| HTTP Status | `error` | When |
|-------------|---------|------|
| 400 | `invalid_grant` | Invalid resource, invalid audience |
| 400 | `invalid_scope` | Requested scope not authorized |
| 400 | `invalid_request` | Malformed request body |
| 400 | `unsupported_grant_type` | Invalid `grant_type` |
| 401 | `invalid_client` | Client not found, revoked, wrong secret, principal disabled |

### 18.3 OBO Token Exchange Errors (New)

| HTTP Status | `error` | When |
|-------------|---------|------|
| 400 | `invalid_grant` | Subject token invalid, expired, wrong issuer, wrong audience, subject disabled |
| 400 | `invalid_scope` | Scope intersection empty |
| 400 | `invalid_request` | `requested_subject` provided (if we choose to reject) |
| 401 | `invalid_client` | ADC client not found, revoked, wrong secret, ADC principal disabled |
| 400 | `unsupported_grant_type` | Wrong `grant_type` value |

### 18.4 Error Response Details

For security reasons, error messages are intentionally generic:

- **`invalid_client`** (401): Does NOT reveal whether clientId doesn't exist, secret is wrong, or principal is disabled. All three paths produce the same error.
- **`invalid_grant`** (400): Does NOT reveal whether subject token is expired, wrong issuer, or forged. Same error for all.

### 18.5 Token Response (Success)

```json
{
  "access_token": "<JWT string>",
  "token_type": "Bearer",
  "expires_in": 600,
  "scope": "workflow.read workflow.execute"
}
```

Headers:
- `Cache-Control: no-store`
- `Pragma: no-cache`

**Prohibited in response:**
- `refresh_token` ❌ (for both client_credentials and OBO)

### 18.6 Token Response for OBO

Same format as client credentials. No additional claims in the response body — the token claims are in the JWT payload.

```json
{
  "access_token": "<JWT string>",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "workflow.read"
}
```

---

## 19. RECOMMENDED_PR_SEQUENCE

### 19.1 Overview

```
PR-A (auth-service JWKS Signer)         ← START HERE
  │
  ├── PR-B (auth-service OBO Token Exchange)
  │
  └── PR-C (svc-workflow JWKS/OBO Verifier)
        │
        └── PR-D (svc-workflow Provisioning API)
              │
              └── PR-E (ADC OBO Client + Smoke)
```

PR-A and PR-C can be developed in parallel. PR-B and PR-D can start after PR-A merges but can also be somewhat parallel.

### 19.2 PR-A: auth-service JWKS Infrastructure + RS256 Signing

| Field | Value |
|-------|-------|
| **Repository** | auth-service |
| **Base SHA** | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` |
| **Pattern** | `feat/workflow-jwks-rs256-v0` |
| **Scope** | JWKS infrastructure + RS256 signing + verify-token enhancement |
| **Target** | `main` |

#### New Files

| File | Purpose |
|------|---------|
| `src/lib/oauth/jwks.ts` | JWKS key management: load RSA key, generate JWK, serve JWKS data, kid management, verification keys |
| `src/config/crypto.ts` | RSA key loading, PEM parsing, JWK conversion utilities |

#### Modified Files

| File | Changes |
|------|---------|
| `src/config/env.ts` | Add `JWT_PRIVATE_KEY`, `JWT_PRIVATE_KEY_FILE`, `JWT_PREVIOUS_KEY` |
| `src/server.ts` | Mount `GET /.well-known/jwks.json` route |
| `src/routes/service-registrations.ts` | `principal_type='agent'` detection + MachinePrincipal lookup branch |
| `src/lib/oauth/token.ts` | Add `signWorkflowToken()` — RS256-based signing for `aud=svc-workflow` |

#### Schema Changes

- Add `human` to `PrincipalType` enum (optional forward-compat migration)
- Migration name: `add_principal_type_human`

#### Tests

| Test File | Test Cases |
|-----------|------------|
| `tests/oauth/jwks.test.ts` | Key loading, kid format, JWK conversion (no private key leak), cache headers, active + previous key rotation |
| Extend `tests/oauth/oauth-token.test.ts` | `signWorkflowToken` RS256: valid RS256 signature, wrong signature fails, unknown kid fails, HS256 in RS256 context fails, correct `kid` in header |
| Extend `tests/oauth/compatibility.test.ts` | Agent token can still be verified with HS256; human token unchanged |

#### Behaviors (External)

1. `GET /.well-known/jwks.json` returns RSA public key in JWK format
2. `signWorkflowToken()` produces RS256-signed JWT with `kid` header
3. Existing `signAgentAccessToken()` and `signAccessToken()` unchanged (still HS256)
4. `POST /api/services/verify-token` can verify agent tokens (looks up MachinePrincipal by `sub`)
5. Human tokens continue to work at verify-token endpoint unchanged

#### Excluded

- OBO Token Exchange (PR-B)
- Scope intersection logic (PR-B)
- svc-workflow changes (PR-C)

#### Verification

- RS256 token can be verified with any JWKS-compatible verifier
- Existing test suite passes (no regressions)
- `npm test` and `npm run test:oauth` pass

---

### 19.3 PR-B: auth-service OBO Token Exchange

| Field | Value |
|-------|-------|
| **Repository** | auth-service |
| **Base SHA** | PR-A merge commit |
| **Pattern** | `feat/workflow-obo-v0` |
| **Scope** | OBO Token Exchange (`grant_type=token-exchange`) |
| **Target** | `main` |

#### New Files

| File | Purpose |
|------|---------|
| `src/lib/oauth/token-exchange.ts` | OBO business logic: subject token verification, scope intersection, OBO token signing, audit |

#### Modified Files

| File | Changes |
|------|---------|
| `src/routes/oauth.ts` | Add `grant_type=urn:ietf:params:oauth:grant-type:token-exchange` branch |
| `src/schemas/oauth.ts` | Add `tokenExchangeRequestSchema` Zod schema |
| `src/lib/oauth/audit.ts` | Add `obo.token.issued`, `obo.token.failed` event types; OBO-specific fields |
| `src/lib/oauth/token.ts` | (Already has `signWorkflowToken()` from PR-A) |

#### Tests

| Test File | Test Cases |
|-----------|------------|
| `tests/oauth/token-exchange.test.ts` | Valid subject → OBO issued; subject invalid/expired/wrong issuer → rejected; scope intersection; audience check; act/azp correct; TTL ≤ 300s; TTL ≤ subject remaining; ADC unauthenticated → 401; ADC revoked/disabled → 401; subject disabled → rejected; unique jti; no refresh token in response; `requested_subject` ignored/rejected |

#### Behaviors (External)

1. `POST /oauth/token` with `grant_type=token-exchange` returns OBO token
2. OBO token has `token_use: 'workflow_obo'`, `act`, `azp`, `client_id`
3. Scope intersection enforced (3-way: subject ∩ ADC client ∩ request)
4. All error conditions return OAuth 2.0 standard error codes
5. Audit events emitted for OBO success and failure

#### Excluded

- svc-workflow verifier changes (PR-C)
- ADC caller code (PR-E)

#### Verification

- OBO token can be decoded and verified by svc-workflow (tested manually with JWKS verifier)
- Existing client_credentials flow unchanged (regression tests pass)

---

### 19.4 PR-C: svc-workflow JWKS/OBO Verifier

| Field | Value |
|-------|-------|
| **Repository** | svc-workflow |
| **Base SHA** | `f3306a5d387aa4159a995b7477e4c9da1a7193b7` |
| **Pattern** | `feat/workflow-jwks-obo-auth-v0` |
| **Scope** | Dual auth mode (test_hs256 / jwks) + JWKS verifier + OBO token parsing + proxy audit logging |
| **Target** | `main` |

#### Key Changes

- Dual auth mode (mutually exclusive `WORKFLOW_AUTH_MODE`)
- JWKS verifier with caching, automatic refresh, unknown kid handling
- OBO token parsing (`token_use`, `act`, `azp`)
- Proxy audit structured logging

#### Tests

13 JWT verification scenarios, key rotation tests, JWKS cache + refresh concurrency tests.

#### Dependencies

- PR-A (needs JWKS endpoint for integration testing)

---

### 19.5 PR-D: svc-workflow Provisioning API

| Field | Value |
|-------|-------|
| **Repository** | svc-workflow |
| **Base SHA** | PR-C merge commit |
| **Pattern** | `feat/workflow-provisioning-api-v0` |
| **Scope** | `/internal/v1/admin/*` (principals, domains, domain-role-bindings) |
| **Target** | `main` |

#### Dependencies

- PR-C (requires auth infrastructure for admin API authentication)

---

### 19.6 PR-E: ADC OBO Client + Auth Smoke

| Field | Value |
|-------|-------|
| **Repository** | ADC (agent-dev-center) |
| **Base SHA** | `939a93edfa88d06ba234709284c78070212f7137` |
| **Pattern** | `feat/workflow-obo-client-smoke-v0` |
| **Scope** | OAuth client_credentials auto-acquisition + OBO token call + Mapping Ledger + end-to-end canary smoke |
| **Target** | `develop` |

#### Dependencies

- PR-B (needs auth-service OBO endpoint)
- PR-C (needs svc-workflow JWKS verifier)
- PR-D (needs Provisioning API)

---

### 19.7 Total Estimate

| PR | Focus | Estimated Effort |
|----|-------|-----------------|
| PR-A | JWKS + RS256 + verify-token | 2-3 days |
| PR-B | OBO Token Exchange | 2-3 days |
| PR-C | svc-workflow verifier | 2-3 days |
| PR-D | svc-workflow Provisioning | 2-3 days |
| PR-E | ADC OBO + Smoke | 1-2 days |
| **Total** | | **9-14 days** |

---

## 20. RISKS_AND_OPEN_DECISIONS

### 20.1 Resolved Decisions

All technical decisions have been resolved through the investigation and contract process:

| Decision | Resolution | Authority |
|----------|-----------|-----------|
| Algorithm | RS256 (not EdDSA) | Both investigation and contract |
| Signing model | Unified auth-service signer, audience-based algorithm | Contract |
| OBO vs Delegation | Real-time Token Exchange | Contract |
| Audit model | Structured logs (both sides) | Contract |
| Key storage | Env var only (V0) | Both |
| `kid` format | `key-v1-<YYYYMMDD>` | Both |
| `act` format | Nested `{ sub: "..." }` (RFC 8693) | Contract |
| `client_id` vs `azp` | Both kept for V0 (backward compat) | Contract |
| Scope model | 3-way intersection | Both |
| TTL formula | `OBO.exp = min(iat + 300, subject_token.exp)` | Contract |
| Provisioning | svc-workflow Internal Admin API | Contract |
| `principal_type` enum | Add `human` (forward-looking) | This plan |

### 20.2 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Downstream services may not yet support RS256 | Low | Medium | Dual-algorithm transition (HS256 for existing, RS256 for svc-workflow) |
| R2 | Key rotation requires auth-service restart | Medium | Low | Short TTL tokens mean fast rotatation; planned maintenance window |
| R3 | In-memory audit events lost on crash | Medium | Low | V0 trade-off; V1 adds DB audit table |
| R4 | No online revocation for short tokens | Low | Low | 5-min OBO TTL adequately bounds exposure |
| R5 | svc-workflow JWKS endpoint unreachable at startup | Low | Medium | Startup JWKS fetch with timeout; fail closed if unreachable |
| R6 | `clockTolerance(30s)` may be insufficient for distributed envs | Low | Low | Configurable; can be increased per deployment |

### 20.3 Open Decisions (Low Priority)

| # | Decision | Status |
|---|----------|--------|
| D1 | Should `requested_subject` be silently ignored or explicitly rejected? | Any approach works; recommend silent ignore for forward compat |
| D2 | What is the exact error response format for `invalid_scope` (empty intersection)? | OAuth standard: `{ "error": "invalid_scope" }` |
| D3 | Should OBO token include both `agent_id` (subject) and `client_id` (ADC)? | Yes — both included per frozen contract |
| D4 | What happens when `audience` is `svc-workflow` but `resource` check fails? | Same as invalid resource: 400 `invalid_grant` |

### 20.4 V1 Enhancements (Deferred)

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| DB-backed key rotation (`jwk_keys`) | Medium | Enables hot rotation without restart |
| JTI blacklist / online revocation | Medium | Required for long-lived tokens |
| EdDSA support | Low | After platform-wide library audit |
| Delegation table (persistent OBO) | Low | For long-running delegations beyond OBO |
| Human workflow tokens | Medium | When direct human → svc-workflow is needed |
| `workflow.admin` scope | Medium | For Provisioning API authentication |
| Performance metrics (JWKS cache hit/miss) | Low | Operational visibility |

---

## 21. IMPLEMENTATION_READY

### 21.1 Status

```
AUTH_SERVICE_WORKFLOW_IDENTITY_PLAN_READY
```

### 21.2 Readiness Checklist

| Gate | Status | Notes |
|------|--------|-------|
| BASE_SHA determined | ✅ | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` |
| Current identity model documented | ✅ | Section 2 |
| Current token contracts documented | ✅ | Section 3 |
| Current signing paths documented | ✅ | Section 4 |
| Compatibility matrix complete | ✅ | Section 5 — audience-based strategy |
| Canonical subject decision made | ✅ | Section 6 — `MachinePrincipal.id` / `User.id` |
| Direct Agent token contract frozen | ✅ | Section 7 — RS256, `token_use: 'access'` |
| Direct User token contract documented | ✅ | Section 8 — unchanged for V0 |
| OBO token contract frozen | ✅ | Section 9 — RS256, `act`/`azp`, 300s TTL |
| Actor/client claims decision made | ✅ | Section 10 — nested `act`, both `azp` + `client_id` |
| Scope intersection model defined | ✅ | Section 11 — 3-way intersection |
| Signing and JWKS model defined | ✅ | Section 12 — RS256, env-var keys, JWKS endpoint |
| Key rotation model defined | ✅ | Section 13 — manual (V0), automated (V1) |
| Verify-token model enhanced | ✅ | Section 14 — `principal_type` detection + MachinePrincipal lookup |
| Provisioning requirements specified | ✅ | Section 15 — svc-workflow Internal Admin API |
| Migration requirements assessed | ✅ | Section 16 — no DB migration needed for core; optional enum addition |
| Audit model extended | ✅ | Section 17 — OBO event types + fields |
| Error contract frozen | ✅ | Section 18 — OAuth 2.0 standard errors |
| PR sequence recommended | ✅ | Section 19 — PR-A through PR-E |
| Risks and open decisions documented | ✅ | Section 20 |

### 21.3 No Blockers

| Potential Blocker | Status |
|-------------------|--------|
| Data model cannot express delegation | ✅ False — OBO is real-time, no delegation table needed |
| Frozen contract conflicts with code | ✅ None detected — contract aligns with current models |
| Missing dependency in current main | ✅ All dependencies present (MachinePrincipal, MachineClient tables exist) |
| Cannot maintain backward compatibility | ✅ False — audience-based algorithm isolation |
| Migration not possible | ✅ No migration needed for V0 core |
| Principal type cannot be expressed | ✅ `agent` exists; `human` can be added or emitted as JWT string |

### 21.4 Recommended Next Step

**Implement PR-A: auth-service JWKS Infrastructure + RS256 Signing**

This is the first and foundational PR. It provides:
1. JWKS endpoint for key distribution
2. RS256 signing capability for workflow tokens
3. Enhanced verify-token endpoint for agent tokens
4. No new endpoints that need API documentation updates

---

*Plan generated 2026-07-16. Status: `AUTH_SERVICE_WORKFLOW_IDENTITY_PLAN_READY`*
*Mode: Plan only — no code modified, no commits*
