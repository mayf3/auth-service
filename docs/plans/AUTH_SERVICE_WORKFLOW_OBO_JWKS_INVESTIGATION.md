# auth-service Workflow OBO + JWKS Investigation Report

> Status: **AUTH_SERVICE_WORKFLOW_OBO_JWKS_INVESTIGATION_COMPLETE**
> Date: 2026-07-16
> Mode: Read-only investigation — no code modified, no commits

---

## 1. Repository / Branch / HEAD

| Field | Value |
|-------|-------|
| Repository | `auth-service` |
| Current Branch | `feat/openclaw-agent-auth-token-get-v0` |
| HEAD | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` |
| main | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` (fast-forward) |
| Working tree | Modified `package.json`; untracked docs/reports; no staged changes |

HEAD and `main` point to the same commit (merged). The working tree has untracked files (reports, .zcode, `.env.bak`) but no staged changes to source code.

---

## 2. Existing JWT Implementation

### 2.1 Technology Stack

- **Library**: `jsonwebtoken` v9.0.2 (JWT signing & verification)
- **Algorithm**: **HS256 only** (symmetric HMAC-SHA256)
- **Singletons**: `src/config/env.ts` lines 14-48 — single `env.JWT_SECRET` for all token types
- **Refresh secret**: Derived deterministically from `JWT_SECRET` via `sha256(JWT_SECRET + ':refresh')` (line 4-8 of `env.ts`)

### 2.2 Two Distinct JWT Formats

#### Human User Access Token (`src/middleware/auth.ts:51-73`)

```typescript
function signAccessToken(user: Express.AuthUser, audience?: string): string {
  // Signs with env.JWT_SECRET, HS256
  const jti = `${user.id}-${now}-${randomBytes(4).toString('hex')}`;
  return jwt.sign({
    sub: user.id,          // User UUID
    name: user.name,
    role: user.role,
    internalRole: user.internalRole,
    okrRole: user.okrRole,
    iss: 'auth-service',
    aud: audience || 'unified-platform',
    jti,
    type: 'access',
    version: 'v1',
  }, env.JWT_SECRET, { expiresIn: '7d' });
}
```

- TTL: 7 days (`env.JWT_EXPIRES_IN`)
- `sub` = **User.id** (UUID)
- Includes: `name`, `role`, `internalRole`, `okrRole`
- Issued at: `POST /api/auth/login`, `/api/auth/token-login`, `/api/auth/register`

#### Agent/Machine Access Token (`src/lib/oauth/token.ts:59-82`)

```typescript
function signAgentAccessToken(params: SignAgentTokenParams): string {
  const ttl = Math.min(params.ttl ?? 600, 900); // 10 min default, 15 max
  return jwt.sign({
    sub: params.principalId,  // MachinePrincipal UUID (NOT User UUID)
    iss: 'auth-service',
    aud: params.audience,     // Requested resource (e.g., 'svc-workflow')
    iat: now,
    exp: now + ttl,
    jti,
    type: 'access',
    version: 'v1',
    principal_type: 'agent',  // Distinguishes from human tokens
    agent_id: params.agentId, // Canonical OpenClaw alias
    client_id: params.clientId,
    scope: params.scope,
  }, env.JWT_SECRET, { algorithm: 'HS256' });
}
```

- TTL: 600s default, **hard-capped at 900s** (line 19-22 of `token.ts`)
- `sub` = **MachinePrincipal.id** (UUID)
- **No** `name`, `role`, `internalRole`, `okrRole` claims
- Includes: `principal_type: 'agent'`, `agent_id`, `client_id`, `scope`

### 2.3 JWT Verification (`src/middleware/auth.ts:116-172`)

The `authRequired` middleware tries three verification strategies in order:

1. **Strict**: `jwt.verify(token, JWT_SECRET, { issuer: 'auth-service', audience: 'unified-platform' })` — validates human platform tokens
2. **Legacy**: `jwt.verify(token, JWT_SECRET, { issuer: 'agent-dev-center', audience: 'adc-api' })` — backward compat with ADC tokens
3. **Relaxed**: `jwt.verify(token, JWT_SECRET)` — no issuer/audience check (old tokens)

On success, it looks up the user in the `users` table by `payload.sub`. **This means agent tokens cannot be verified by this middleware** — `sub` is `MachinePrincipal.id`, which won't exist in the `users` table, resulting in "用户不存在或已被禁用" (line 168).

### 2.4 Service Registration Verify-Token (`src/routes/service-registrations.ts:204-274`)

`POST /api/services/verify-token` also only verifies with `JWT_SECRET` and looks up a User by `payload.sub`. Same limitation: **agent tokens will fail** because:

- `sub` = MachinePrincipal UUID ≠ User UUID
- No `principal_type` check
- No MachinePrincipal lookup

### 2.5 Key Management Gaps

- **No asymmetric keys** — zero RS256, EdDSA, or JWKS code exists
- **No kid** (key ID) in any JWT header
- **No key rotation** for JWT_SECRET
- **No JWKS endpoint** — `GET /.well-known/jwks.json` does not exist
- All signing uses `{ algorithm: 'HS256' }` implicitly (default) or explicitly (`token.ts:80`)
- `AGENT_TOKEN_SECRET` fallback chain in `env.ts:40`: env var → `JWT_SECRET_SSO` → empty string

---

## 3. Recommended Signing Algorithm

### Recommendation: **RS256**

| Criterion | RS256 | EdDSA (Ed25519) |
|-----------|-------|-----------------|
| `jsonwebtoken` support | ✅ Native (built-in) | ❌ Not supported (needs `jose` or `djwt`) |
| JWKS standard | ✅ `JSON Web Key (JWK)` RFC 7517 | ✅ Supported in JWK format |
| Key generation | ✅ OpenSSL `openssl genrsa` | ✅ `openssl genpkey -algorithm ed25519` |
| Ecosystem maturity | ✅ Industry standard (Auth0, Okta, Keycloak) | ⚠️ Newer, fewer implementations |
| Token size | Larger (RSA 2048-bit keys) | Smaller (32-byte keys) |
| Verification speed | Slower (RSA) | Faster (Ed25519) |
| Library migration | Zero library change | Requires `jose` library addition |

**Decision**: **RS256** for V0.

**Rationale**:
1. `jsonwebtoken` already has first-class RS256 support — no library change needed
2. JWKS endpoint and key rotation patterns are well-documented for RSA
3. Downstream services (`svc-workflow`, `svc-okr`, ADC) likely already have `jsonwebtoken` or similar with RSA support
4. EdDSA would require adding `jose` as a dependency and modifying verification code in all downstream services
5. EdDSA can be adopted in V1 after platform-wide library audit

---

## 4. JWKS Contract

### 4.1 Private Key Storage

**Format**: PEM-encoded RSA private key (PKCS#8), 2048-bit minimum.

**Location**: `env.JWT_PRIVATE_KEY` — either as env var value or file path via `JWT_PRIVATE_KEY_FILE`. Read at startup, never logged or exposed via API.

**Implementation**: Add to `src/config/env.ts`:

```typescript
// Load RSA private key
JWT_PRIVATE_KEY: loadPrivateKey(process.env.JWT_PRIVATE_KEY, process.env.JWT_PRIVATE_KEY_FILE),
```

### 4.2 JWKS Endpoint

```
GET /.well-known/jwks.json
```

**No auth required** — this is a public key distribution endpoint.

**Response format** (RFC 7517):

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

### 4.3 kid Generation

Format: `key-v1-<YYYYMMDD>` (e.g., `key-v1-20260701`).

- `v1` = key version scheme
- `YYYYMMDD` = key creation date
- Allows chronological ordering and human-readable identification

### 4.4 Active Key and Previous Verification Keys

Maintain in memory at startup:

```typescript
interface KeyPair {
  kid: string;
  privateKey: string;   // PEM
  publicKey: JsonWebKey; // JWK format
  createdAt: string;     // ISO date
  isActive: boolean;     // Current signing key
}
```

- **activeKey**: One key that signs NEW tokens
- **verificationKeys**: Array of activeKey + 1-2 previous public keys for verification

### 4.5 Key Rotation Window

| Phase | Action | Duration |
|-------|--------|----------|
| Announce | New key added to JWKS but NOT signing yet | 24h |
| Active | New key starts signing; old key still in JWKS for verification | Until old key expires |
| Grace | Old key removed from JWKS; verification still allowed | Until max(agent TTL, 15 min) |
| Expired | Old key discarded | After grace period |

**V0 simplification**: Manual rotation via config change + restart. Automated rotation is V1.

### 4.6 Old Key Decommissioning

- Old key remains in `verificationKeys` for at least `MAX_AGENT_TOKEN_TTL` (900s) + 60s buffer after rotation
- After buffer, old key is removed from `verificationKeys` and JWKS
- Any token signed with old key will fail verification (by design — short TTL makes this acceptable)

### 4.7 Cache Headers

```
Cache-Control: public, max-age=3600, must-revalidate
ETag: "<hash-of-jwks>"
```

- 1-hour public cache
- ETag for efficient conditional re-fetch
- When keys change, ETag changes → clients re-fetch

### 4.8 Signature Algorithm Whitelist

```typescript
const ALLOWED_ALGORITHMS = ['RS256'];
```

- Only RS256 accepted for verification
- HS256 on the `authRequired` middleware remains for human token backward compatibility
- New code paths (OBO, workflow audience) MUST use RS256 only

---

## 5. Machine Token Contract

### 5.1 Initial Design Sketch for svc-workflow

> **⚠️ SUPERSEDED — Historical sketch only.**
> This section is an early investigation draft. The frozen contract for the
> direct Machine Token is defined in **`docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` §6**
> and **Implementation Plan §7.5**, which specify:
> - Direct token uses `client_id` (not `azp`) as the authorized-party claim
> - `azp` and `act` are **reserved for OBO tokens only** (future PR-B)
>
> See also **ADC Contract §4.2** (the cross-repo cross-reference contract).
> In case of conflict between this investigation sketch and the frozen contract,
> the frozen contract takes precedence (§10 Document Precedence).

```json
{
  "iss": "auth-service",
  "sub": "<MachinePrincipal.id>",
  "aud": "svc-workflow",
  "principal_type": "agent",
  "scope": "workflow.read workflow.execute",
  "token_use": "access",
  "azp": "<client_id>",
  "jti": "<uuid>",
  "iat": <epoch>,
  "nbf": <epoch>,
  "exp": <epoch>
}
```

> **Historical note:** The `azp` claim appears in this early sketch because the
> investigation was exploring RFC 8693 conventions. The frozen plan §7.5 and
> PR-A formal contract §6 later decided to keep `client_id` as the sole
> authorized-party claim on direct tokens, reserving `azp` for OBO tokens only.

### 5.2 MachineClient ↔ MachinePrincipal Relationship

From `prisma/schema.prisma` (lines 101-134):

```
MachinePrincipal (1) ──── (N) MachineClient
```

- Each `MachinePrincipal` has a unique `agentId` (canonical OpenClaw alias)
- Each `MachineClient` belongs to exactly one `MachinePrincipal`
- `MachineClient.clientId` format: `mc_` + 24 random base64url chars (generated at `service.ts:228`)
- **No direct M:N** — a principal can have multiple clients for different resource/scope combos
- `src/lib/oauth/service.ts:228-240` — client creation links to principal via `machinePrincipalId`

### 5.3 client_id → Principal Binding

- `MachineClient.machinePrincipalId` FK → `MachinePrincipal.id`
- Binding established at creation time; cannot be changed after creation
- `src/lib/oauth/token-issuance.ts:44-47` — token issuance loads client with `include: { principal: true }`
- Token `sub` = `client.principal.id` (MachinePrincipal UUID)

### 5.4 Audience Restrictions

- `MachineClient.allowedResources` is a `String[]` (PostgreSQL text array)
- `src/lib/oauth/token-issuance.ts:107-108` — exact match only, not prefix or glob
- Requested `resource` must exactly match one entry in `allowedResources`
- Single-audience tokens: one request → one `aud` value

### 5.5 Scope Registration

- `MachineClient.allowedScopes` is a `String[]`
- `src/schemas/oauth.ts:81-93` — `validateRequestedScope()` checks that ALL requested scopes are members of the allowed set
- Scope format: `<domain>.<action>` convention (e.g., `forum.read`, `workflow.execute`)
- Scopes are space-delimited in the token request

### 5.6 disabled/revoked Effects on Token

From `src/lib/oauth/token-issuance.ts`:

| Condition | Check (line) | Error |
|-----------|-------------|-------|
| Client status = `revoked` | 62-73 | `invalid_client` (401) |
| Principal status = `disabled` | 76-88 | `invalid_client` (401) |
| Both active | No error | Token issued |

**Short TTL as revocation delay**: Already-implemented design. No JTI blacklist exists. Existing tokens continue to be valid until expiry.

### 5.7 Client Secret Rotation

- `src/lib/oauth/secret.ts` — 256-bit random base64url, scrypt hashed (N=16384, r=8, p=1)
- `src/lib/oauth/service.ts:269-315` — `rotateClientSecret()` generates new secret, replaces hash, records `rotatedAt`
- Old secret immediately invalidated
- Existing short-lived tokens continue to expire naturally

### 5.8 Token Maximum TTL

- **Default**: 600 seconds (10 min) — `DEFAULT_AGENT_TOKEN_TTL` at `token.ts:22`
- **Hard cap**: 900 seconds (15 min) — `MAX_AGENT_TOKEN_TTL` at `token.ts:19`
- Enforced at `token.ts:62`: `Math.min(params.ttl ?? 600, 900)`
- **No refresh token** for agent tokens

### 5.9 New Table / Migration Required?

**No new table or migration needed for Machine Token itself.** The tables exist (`machine_principals`, `machine_clients`) from migration `20260714000001_add_machine_principal_client`.

**Potential migration needed for JWKS** if we store keys in DB instead of env vars (see Section 10).

---

## 6. OBO / Token Exchange Endpoint

### 6.1 Recommended Endpoint

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

This reuses the existing `POST /oauth/token` route with a new `grant_type`, extending `src/routes/oauth.ts`.

### 6.2 Implementation Location

```
src/routes/oauth.ts           → Add token_exchange branch in the route handler
src/lib/oauth/token-exchange.ts  → New file: token exchange business logic
src/schemas/oauth.ts          → Add tokenExchangeRequestSchema
```

### 6.3 Flow

1. **Authenticate ADC** via Basic Auth (same as client_credentials)
2. **Verify ADC client**: status = active, principal ≠ disabled
3. **Verify subject_token**: RS256 signed, valid signature, correct issuer (`auth-service`), not expired
4. **Extract subject claims**: `sub`, `principal_type`, `scope`
5. **Scope intersection**: min(subject_token.scope, ADC_client.allowedScopes, requested_scope, service policy)
6. **Audience check**: `audience` must be in ADC_client.allowedResources
7. **Issue OBO token** with `act` claim pointing to ADC principal

### 6.4 Subject Token Verification

The subject_token MUST be an RS256-signed auth-service token. Verification:

```typescript
function verifySubjectToken(token: string, jwksEndpoint: string): SubjectClaims {
  // Fetch JWKS from self (or use local key)
  // Verify RS256 signature
  // Check: iss === 'auth-service'
  // Check: not expired (exp > now)
  // Check: not before (nbf <= now)
  // Extract: sub, principal_type, scope, aud
  return claims;
}
```

**Security**: The subject token is verified against the JWKS endpoint — either self-fetched or using the in-memory key. This ensures we don't accept forged tokens.

---

## 7. Subject Validation Proofs

### Proof 1: `sub` comes ONLY from verified subject_token

```
Request body:  { subject_token: "<T>", requested_subject: "<uid>" }
                        │
                        ▼
Verify signature of T ← only if RS256 valid proceed
                        │
                        ▼
sub = T.sub  ← IGNORE requested_subject in request body
```

- `requested_subject` parameter is **NOT supported** in V0
- If provided, it's silently ignored (or rejected with `invalid_request`)
- The only source of `sub` is the decoded and verified `subject_token.sub`

### Proof 2: ADC cannot specify arbitrary `sub`

- ADC is authenticated via Basic Auth (client_id + client_secret)
- `subject_token` must be a valid RS256-signed token
- Even if ADC is authenticated, they cannot forge a subject token without the private key
- The OBO `sub` is deterministically extracted from the verified subject_token

### Proof 3: Scope intersection

```
OBO scope = intersection(
  subject_token.scope,           // What the subject can do
  ADC_client.allowedScopes,      // What the ADC client is allowed
  requested_scope,               // What was asked for
  service_policy                 // Future: per-service scope mapping
)
```

Implemented via existing `validateRequestedScope()` with additional layer:

```typescript
function computeOBOScope(
  subjectScope: string,
  allowedScopes: string[],
  requestedScope: string,
): string {
  // 1. Parse all three into sorted, deduplicated arrays
  // 2. Compute intersection
  // 3. Return joined string
  const subjectScopes = new Set(parseScopeString(subjectScope));
  const allowedSet = new Set(allowedScopes);
	  const requested = parseScopeString(requestedScope);

	  return requested
    .filter(s => subjectScopes.has(s) && allowedSet.has(s))
    .sort()
    .join(' ');
}
```

### Proof 4: Audience restriction

- `audience` must be in `ADC_client.allowedResources` (same check as `resource` for client_credentials)
- Token's `aud` = exactly the requested `audience`
- No wildcard audience in V0

---

## 8. Scope / Audience Intersection Model

### 8.1 Client_credentials (existing)

```typescript
// token-issuance.ts:107-108 (resource check)
resourceMatch = client.allowedResources.some(r => r === params.resource);

// token-issuance.ts:126-127 (scope check)
validatedScope = validateRequestedScope(params.scope, client.allowedScopes);
```

2-way intersection: `requested_scope ∩ client.allowedScopes`

### 8.2 OBO Token Exchange (new)

```typescript
// 3-way intersection
oboScope = intersection(
  subject_token.scope,      // What the subject can do
  ADC_client.allowedScopes, // What ADC is allowed
  requested_scope           // What was asked for
);
```

4-way if service policy scopes exist.

---

## 9. OBO Token Claims

### 9.1 Frozen OBO Token Format

```json
{
  "iss": "auth-service",
  "sub": "<subject_token的真实 sub>",
  "aud": "svc-workflow",
  "principal_type": "<subject的真实类型>",
  "scope": "<intersected scopes>",
  "token_use": "workflow_obo",
  "act": {
    "sub": "<ADC MachinePrincipal.id>"
  },
  "azp": "<ADC client_id>",
  "jti": "<unique>",
  "iat": <epoch>,
  "nbf": <epoch>,
  "exp": <epoch>
}
```

### 9.2 Claim Derivation

| OBO Claim | Source | Notes |
|-----------|--------|-------|
| `iss` | Fixed | `auth-service` |
| `sub` | Subject token's `sub` | **Cannot be overridden by request** |
| `aud` | Request `audience` | Must be in ADC's allowedResources |
| `principal_type` | Subject token's `principal_type` | Either `agent` or (future) `human` |
| `scope` | 3-way intersection | See Section 8 |
| `token_use` | Fixed | `workflow_obo` — identifies this as OBO token |
| `act.act_sub` | ADC's MachinePrincipal UUID | Proves ADC acted on behalf |
| `azp` | ADC client_id | Authorized party |
| `jti` | Generated | `uuid()` or `<principalId>-<timestamp>-<random>` |
| `iat` | Current time | |
| `nbf` | Same as `iat` | |
| `exp` | `iat + OBO_TTL` | OBO TTL ≤ subject token remaining TTL, capped at 300s |

### 9.3 Signed with RS256

The OBO token MUST be signed with RS256 using the active private key, **not** HS256.

---

## 10. TTL

### 10.1 Recommended OBO TTL

| Parameter | Value |
|-----------|-------|
| OBO max TTL | **300 seconds** (5 minutes) |
| Refresh token | **None** |
| jti | Always unique |
| Audience | Exactly one (single string) |
| Scope | Minimized to what's needed |

### 10.2 TTL Boundary Conditions

```
OBO.exp = min(
  iat + OBO_MAX_TTL,        // 5 min
  subject_token.exp          // Cannot outlive subject
)
```

This ensures:
- Short-lived OBO tokens even if subject token is long-lived
- OBO token cannot exceed subject token's validity
- If subject token expires, OBO token is already expired

---

## 11. Revocation

### 11.1 Subject Token Revoked

| State | OBO Token Validity |
|-------|-------------------|
| Subject token still valid | ✅ OBO issued normally |
| Subject token expired | ❌ OBO issuance rejected (exp check) |
| Subject token revoked (if tracked) | ❌ Would need online check |
| Subject principal disabled | ⚠️ See below |

**V0 stance**: Accept **short TTL** as revocation delay. No online revocation check. OBO tokens have 5-min max TTL, so revocation latency is bounded.

### 11.2 MachineClient Disabled

- If ADC's MachineClient is revoked/disabled — authentication at OBO endpoint fails
- Token issuance blocked at same check as `client_credentials` (`token-issuance.ts:62-88`)

### 11.3 MachinePrincipal Disabled

- ADC's MachinePrincipal disabled → all its clients blocked → OBO issuance fails
- Subject's MachinePrincipal disabled → subject token was already signed, no online check

### 11.4 Token Revocation Mechanism

**V0**: No JTI blacklist or online revocation. Short TTL is the revocation mechanism.

For V1, a JWT revocation table could be added:

```sql
CREATE TABLE token_blacklist (
  jti TEXT PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);
```

---

## 12. Audit

### 12.1 Current Audit Capability

`src/lib/oauth/audit.ts` provides structured JSON events to stderr:

| Event Type | Fields |
|------------|--------|
| `token.issued` | principalId, agentId, clientId (masked), resource, scopes, jti, success |
| `token.failed` | principalId, agentId, clientId (masked), resource, scopes, success, error |

**Existing audit never includes**: client secret, access token, authorization header, full request body, or secret hash.

### 12.2 OBO Audit Requirements

Each OBO issuance must record:

| Field | Source | PII/Sensitive? |
|-------|--------|----------------|
| `jti` | Generated | No |
| `subject sub` | Subject token payload | Yes (UUID, not PII) |
| `subject principal_type` | Subject token payload | No |
| `act.sub` | ADC MachinePrincipal.id | No |
| `azp` | ADC client_id | No (masked) |
| `audience` | Request | No |
| `scope` | Computed intersection | No |
| `subject token jti` | Subject token payload | No |
| `issued_at` | System time | No |
| `expires_at` | Computed | No |
| `result` | success / failure | No |
| `failure_reason` | Error code | No |
| `request_id` | Correlation ID | No |

### 12.3 Audit Implementation Assessment

| Option | Recommendation |
|--------|---------------|
| Existing `console.warn` to stderr | ✅ **Sufficient for V0** — extend `AuditEvent` type with OBO-specific fields |
| Database audit table | ❌ Not needed for V0 — adds migration overhead |
| New table/migration | ❌ Only if queryability required for V1 |

**Decision**: Extend existing `AuditEvent` type with OBO events:

```typescript
type AuditEventType =
  | 'principal.created' | 'principal.disabled'
  | 'client.created' | 'client.rotated' | 'client.revoked'
  | 'token.issued' | 'token.failed'
  | 'obo.token.issued' | 'obo.token.failed';  // NEW
```

Add OBO-specific fields to `AuditEvent`:

```typescript
interface AuditEvent {
  // ... existing fields ...
  /** OBO: subject token sub */
  subjectSub?: string;
  /** OBO: subject token principal_type */
  subjectPrincipalType?: string;
  /** OBO: subject token jti */
  subjectJti?: string;
  /** OBO: request ID for correlation */
  requestId?: string;
}
```

**Prohibited in audit**: Full token, client secret, private key, Authorization header.

---

## 13. Migration

### 13.1 Database Migrations Required

| Migration | Purpose | Files |
|-----------|---------|-------|
| ✅ Already done | `machine_principals` + `machine_clients` tables | `20260714000001_add_machine_principal_client` |
| ❌ **NEW** (V0) | `jwk_keys` table (optional, see below) | New migration file |
| ❌ Not needed | User table changes | N/A |

### 13.2 JWK Key Storage Decision

**Option A: Env var only (Recommended for V0)**

```bash
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# or
JWT_PRIVATE_KEY_FILE=/run/secrets/jwt-private-key.pem
```

- Pro: Zero migration, zero schema change
- Pro: Easy operations (config change + restart = key rotation)
- Con: Restart required for rotation
- Con: Key visible in process env (mitigated by file-based loading)

**Option B: Database table**

```prisma
model JwkKey {
  id          String   @id @default(uuid()) @db.Uuid
  kid         String   @unique
  privateKey  String   @map("private_key") // encrypted at rest
  publicKey   Json     @map("public_key")  // JWK format
  isActive    Boolean  @default(false) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  deactivatedAt DateTime? @map("deactivated_at")
  @@map("jwk_keys")
}
```

- Pro: Key rotation without restart
- Pro: History and audit of key lifecycle
- Con: Schema migration needed
- Con: Private key in database (must encrypt at rest)

**Decision**: **Option A for V0** (env var). Option B is a Medium-priority enhancement for V1.

### 13.3 Token Claim Changes

| Token Type | Changes |
|------------|---------|
| Human access token | **No change** — continues with HS256 |
| Agent access token | **RS256 only** for `aud=svc-workflow` (dual signing during transition) |
| OBO token | **New format** — RS256 only |

### 13.4 Impact on Downstream Services

| Service | Impact |
|---------|--------|
| `svc-okr` | Verifies HS256 tokens (human) — **no change** |
| `agent-forum` | Currently uses HS256 token login — needs to accept RS256 agent tokens for channel A |
| `llm-todo` | Verifies HS256 tokens — **no change** unless adopting workflow tokens |
| `ADC` | Verifies HS256 tokens — **no change** for existing flows; needs RS256 for new OBO |
| `svc-workflow` | **New service** — must support RS256 from day one |

### 13.5 Dual Sign / Dual Verify Transition

During V0 rollout, some services may still expect HS256. Transition strategy:

1. **Phase 1** (JWKS V0): New svc-workflow audience tokens signed with RS256; all other tokens remain HS256
2. **Phase 2** (Service migration): Each downstream service adds RS256 verification alongside existing HS256
3. **Phase 3** (HS256 retirement): After all services migrated, HS256 signing disabled

```typescript
// Dual verification helper (for downstream services)
function verifyAny(token: string): Claims {
  try {
    return jwt.verify(token, JWKS_PUBLIC_KEYS, { algorithms: ['RS256'] });
  } catch {
    return jwt.verify(token, HS256_SECRET, { algorithms: ['HS256'] });
  }
}
```

### 13.6 Configuration Migration

- `.env` must gain `JWT_PRIVATE_KEY` or `JWT_PRIVATE_KEY_FILE`
- Existing `JWT_SECRET` stays for backward compat
- Docker environments need secret injection for the private key

---

## 14. Compatibility

### 14.1 What Breaks

- **Nothing breaks immediately** — existing HS256 tokens continue to work
- `authRequired` middleware continues to verify HS256 for human tokens
- `POST /api/services/verify-token` continues to verify HS256

### 14.2 What Needs Awareness

1. **`authRequired` middleware** (`middleware/auth.ts:116-172`) — currently looks up `User` by `sub`. If an agent token arrives at a human-only endpoint, it will fail the DB lookup. This is correct behavior — agent tokens should not authenticate to human endpoints.

2. **`POST /api/services/verify-token`** (`service-registrations.ts:204-274`) — same pattern: looks up user by sub. Needs to handle: (a) No `principal_type` → human token (existing logic), (b) `principal_type === 'agent'` → lookup MachinePrincipal instead. See Section 14.3.

3. **Services using `authRequired` middleware** — any service that mounts this middleware must now handle two token types.

### 14.3 Verify-Token Enhancement Required

The `POST /api/services/verify-token` endpoint in `service-registrations.ts:204-274` must be extended to handle agent tokens:

```typescript
// After JWT verification
if (payload.principal_type === 'agent') {
  // Look up MachinePrincipal
  const principal = await prisma.machinePrincipal.findUnique({
    where: { id: payload.sub }, // sub = MachinePrincipal UUID
  });
  if (!principal || principal.status === 'disabled') {
    throw new HttpError(401, 'Principal not found or disabled');
  }
  res.json({ valid: true, principal: { ... } });
} else {
  // Existing human token logic
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  ...
}
```

---

## 15. Implementation Files (New/Modified)

### 15.1 New Files

| File | Purpose |
|------|---------|
| `src/lib/oauth/jwks.ts` | JWKS key management: load key, generate JWK, serve endpoint handler |
| `src/lib/oauth/token-exchange.ts` | OBO token exchange: verify subject token, compute scope intersection, sign OBO token |
| `src/config/crypto.ts` | Cryptographic utilities: RSA key generation, PEM parsing, JWK conversion |

### 15.2 Modified Files

| File | Changes |
|------|---------|
| `src/config/env.ts` | Add `JWT_PRIVATE_KEY`, `JWT_PRIVATE_KEY_FILE`, `JWKS_CACHE_TTL` |
| `src/routes/oauth.ts` | Add `grant_type=token-exchange` branch |
| `src/schemas/oauth.ts` | Add `tokenExchangeRequestSchema` |
| `src/lib/oauth/token.ts` | Add `signWorkflowToken()` — RS256 version for svc-workflow |
| `src/lib/oauth/audit.ts` | Add OBO event types and fields |
| `src/middleware/auth.ts` | Add RS256 verification path for agent/OBO tokens (optional V0 scope) |
| `src/routes/service-registrations.ts` | Handle `principal_type: 'agent'` in verify-token |
| `src/server.ts` | Mount `GET /.well-known/jwks.json` route |

### 15.3 New Test Files

| File | Purpose |
|------|---------|
| `tests/oauth/jwks.test.ts` | JWKS generation, kid format, key rotation, algorithm whitelist |
| `tests/oauth/token-exchange.test.ts` | OBO flow: valid subject, forged sub, scope intersection, audience check, revocation,
disabled principal |

---

## 16. Test Matrix

### 16.1 JWKS / Signature

| Test Case | Expected |
|-----------|----------|
| Valid RS256-signed token verifies | ✅ Pass |
| Token with wrong signature | ❌ Reject (401) |
| Token with unknown kid | ❌ Reject (401) |
| Token signed with old key during rotation | ❌ Reject (after grace period) |
| Token with HS256 algorithm (forbidden context) | ❌ Reject (401) |
| JWKS endpoint returns valid JSON key set | ✅ 200 with keys |
| JWKS does not leak private key | ✅ No `d` parameter in JWKS response |
| RS256 modulus and exponent are valid base64url | ✅ Parseable |
| JWKS includes correct `kid` and `alg` | ✅ Match signing key |
| JWKS with multiple keys (rotation) | ✅ All public keys listed |
| Cache headers present on JWKS response | ✅ `Cache-Control`, `ETag` |

### 16.2 Machine Token (Channel A)

| Test Case | Expected |
|-----------|----------|
| Valid client_credentials with correct audience/scope | ✅ 200 with token |
| Token has RS256 algorithm (new code path) | ✅ `alg` = `RS256` |
| Request wrong audience | ❌ 400 `invalid_grant` |
| Request unauthorized scope | ❌ 400 `invalid_scope` |
| Request scope superset of allowed | ❌ 400 `invalid_scope` |
| Disabled MachinePrincipal | ❌ 401 `invalid_client` |
| Revoked MachineClient | ❌ 401 `invalid_client` |
| Wrong client secret | ❌ 401 `invalid_client` |
| Non-existent clientId | ❌ 401 `invalid_client` |
| Token TTL ≤ 900s | ✅ Expiration within limit |
| Token has correct `principal_type`, `agent_id`, `client_id` | ✅ |

### 16.3 OBO (Channel B)

| Test Case | Expected |
|-----------|----------|
| Real human token as subject_token | ✅ OBO issued with `principal_type` = (human) |
| Real agent token as subject_token | ✅ OBO issued with `principal_type` = `agent` |
| ADC attempts to specify different `requested_subject` | ❌ Parameter ignored or rejected |
| Subject token has wrong audience | ❌ 400 `invalid_grant` |
| Subject token has wrong issuer | ❌ 400 `invalid_grant` |
| Subject token has wrong signature | ❌ 400 `invalid_grant` |
| Expired subject token | ❌ 400 `invalid_grant` |
| Subject token scope insufficient | ❌ Scope intersection yields empty set |
| ADC client scope insufficient | ❌ Scope intersection yields empty set |
| Wrong audience in OBO request | ❌ 400 `invalid_grant` |
| OBO TTL ≤ 300s | ✅ |
| OBO TTL ≤ subject token remaining TTL | ✅ |
| OBO has correct `act.sub` and `azp` | ✅ |
| OBO has unique `jti` | ✅ No duplicate |
| Same OBO request produces different `jti` | ✅ |
| Refresh token NOT in OBO response | ✅ |
| ADC not authenticated | ❌ 401 `invalid_client` |
| ADC client revoked | ❌ 401 `invalid_client` |
| ADC principal disabled | ❌ 401 `invalid_client` |

---

## 17. Blockers

### B1. No Asymmetric Signing Infrastructure

**Severity**: Blocker
**File**: Entire codebase
**Description**: Zero RS256 / JWKS / kid / key rotation code exists. Every token is HS256-signed with a single shared secret. The entire JWKS infrastructure must be built from scratch.
**Mitigation**: This is expected for V0 — the JWKS module is the primary deliverable.

### B2. verify-token Endpoint Cannot Verify Agent Tokens

**Severity**: Blocker
**File**: `src/routes/service-registrations.ts:204-274`
**Description**: `POST /api/services/verify-token` only looks up `User` by `payload.sub`. Agent tokens have `sub` = `MachinePrincipal.id`, which won't be in the `users` table. The endpoint returns "用户不存在" instead of recognizing an agent token.
**Impact**: Downstream services using this endpoint (like `svc-workflow`) cannot verify agent or OBO tokens.
**Fix**: Add `principal_type` detection and MachinePrincipal lookup branch.

### B3. authRequired Middleware Cannot Verify Agent Tokens

**Severity**: Blocker
**File**: `src/middleware/auth.ts:152-168`
**Description**: After JWT verification, the middleware does `prisma.user.findUnique({ where: { id: payload.sub } })`. Agent token `sub` is MachinePrincipal UUID → user lookup fails → 401.
**Impact**: Any route protected by `authRequired` cannot be called with an agent token.
**Fix**: Add `principal_type` detection in payload; route to MachinePrincipal lookup when present. Or split into separate middleware for agent vs human routes.

---

## 18. High Priority

### H1. RS256 Signing Function for Workflow Tokens

**Severity**: High
**File**: `src/lib/oauth/token.ts` (new function)
**Description**: `signAgentAccessToken()` currently uses `{ algorithm: 'HS256' }`. Need `signWorkflowToken()` that uses RS256 with the active private key, adds `token_use` claim, and uses the JWK `kid`.
**Recommendation**: Create parallel function `signWorkflowToken()` in the same file or a new `src/lib/oauth/workflow-token.ts`.

### H2. Scope Intersection Function for OBO

**Severity**: High
**File**: `src/lib/oauth/token-exchange.ts` (new file)
**Description**: The 3-way scope intersection for OBO must be implemented and tested. Subject scope + ADC allowed scopes + requested scope.
**Recommendation**: Pure function with unit tests.

### H3. Single Audience Enforcement

**Severity**: High
**File**: `src/lib/oauth/token.ts`, `src/schemas/oauth.ts`
**Description**: Current `aud` is a single string. OBO must also enforce single audience. The request validation and token signing must reject multiple audience values.
**Recommendation**: Add Zod validation for single string `audience` in `tokenExchangeRequestSchema`. Already enforced for `client_credentials` via `resource: z.string()`.

### H4. Audit OBO Events

**Severity**: High
**File**: `src/lib/oauth/audit.ts`
**Description**: `AuditEvent` type needs OBO-specific fields: `subjectSub`, `subjectPrincipalType`, `subjectJti`, `requestId`. New event types `obo.token.issued` and `obo.token.failed`.
**Recommendation**: Extend types and add helper function for OBO audit entries.

---

## 19. Medium Priority

### M1. JWKS Cache Headers

**Severity**: Medium
**Description**: `Cache-Control: public, max-age=3600` and `ETag` for the JWKS endpoint. Requires JWK set hashing.

### M2. Dual Signing Period

**Severity**: Medium
**Description**: During transition, some clients may still expect HS256 for the workflow audience. A configurable flag `FULL_RS256_MODE` can gate the migration.

### M3. Key Rotation Automation

**Severity**: Medium
**Description**: V0 uses env var for private key, requiring restart for rotation. A DB-backed key store (`jwk_keys` table) would enable hot rotation. Not needed for initial launch.

### M4. OBO Request ID Correlation

**Severity**: Medium
**Description**: For distributed tracing, each OBO request should receive a `request_id` (either from `X-Request-Id` header or generated). Included in audit events. Not critical for V0.

### M5. Clock Skew Tolerance

**Severity**: Medium
**Description**: `jsonwebtoken` has `clockTolerance` option. Need to decide on acceptable skew (typically 30s). Important for verification across distributed services.

---

## 20. Recommended Implementation Slice (V0)

### Slice: "Workflow OBO + JWKS V0"

#### Scope

1. **JWKS Infrastructure** (2-3 days)
   - `src/config/env.ts`: Add `JWT_PRIVATE_KEY` / `JWT_PRIVATE_KEY_FILE`
   - `src/lib/oauth/jwks.ts`: Load RSA key, generate JWK, `kid` management, `GET /.well-known/jwks.json`
   - Verify-token endpoint enhanced for agent tokens

2. **RS256 Workflow Token** (1 day)
   - `src/lib/oauth/token.ts` or new file: RS256-based `signWorkflowToken()` for `aud=svc-workflow`
   - Add `token_use: 'workflow_obo'` support

3. **OBO Token Exchange** (2-3 days)
   - `src/routes/oauth.ts`: Extend with `grant_type=token-exchange`
   - `src/lib/oauth/token-exchange.ts`: Verify subject token, scope intersection, sign OBO
   - `src/schemas/oauth.ts`: Token exchange request schema

4. **Audit Extension** (0.5 days)
   - `src/lib/oauth/audit.ts`: OBO audit events

5. **Testing** (1-2 days)
   - JWKS unit tests
   - Token exchange unit + integration tests
   - Channel A + Channel B end-to-end

#### Excluded (V1)

- Database-backed key rotation (`jwk_keys` table)
- JTI blacklist / online revocation
- EdDSA support
- Long-running delegation table
- Multiple concurrent active signing keys (V0 uses one active key)

#### Total Estimate: 7-9 days

---

## Appendix: File Reference Index

| File | Lines | Key Functions/Constants | Relevance |
|------|-------|------------------------|-----------|
| `src/config/env.ts` | 1-55 | `env.JWT_SECRET`, `getOrDeriveSecret()` | Current HS256 config |
| `src/middleware/auth.ts` | 1-185 | `signAccessToken()`, `signRefreshToken()`, `authRequired` | Human token signing & verification |
| `src/lib/oauth/token.ts` | 1-94 | `signAgentAccessToken()`, `MAX_AGENT_TOKEN_TTL=900`, `DEFAULT_AGENT_TOKEN_TTL=600` | Agent token signing |
| `src/lib/oauth/token-issuance.ts` | 1-192 | `issueToken()`, client/principal checks | Client_credentials flow |
| `src/lib/oauth/service.ts` | 1-394 | `createPrincipal()`, `createClient()`, `rotateClientSecret()`, `revokeClient()` | Machine Principal/Client lifecycle |
| `src/lib/oauth/secret.ts` | 1-72 | `generateClientSecret()`, `hashClientSecret()`, `verifyClientSecret()` | Client secret crypto |
| `src/lib/oauth/audit.ts` | 1-74 | `auditLog()`, `AuditEvent`, `maskClientId()` | Current audit |
| `src/routes/oauth.ts` | 1-157 | `POST /oauth/token` handler | Current OAuth endpoint |
| `src/schemas/oauth.ts` | 1-94 | `tokenRequestSchema`, `validateRequestedScope()`, `parseScopeString()` | Request validation |
| `src/routes/service-registrations.ts` | 1-275 | `POST /api/services/verify-token` | Token verification for downstream |
| `src/server.ts` | 1-140 | Express setup, route mounting | Where JWKS route would be added |
| `src/lib/agent-auth/credentials.ts` | 1-287 | `readCredentials()`, `resolveCredentials()` | Agent CLI credential loading |
| `src/lib/agent-auth/token-client.ts` | 1-149 | `requestToken()` | HTTP client for CLI |
| `src/lib/agent-auth/validator.ts` | 1-230 | `validateTokenResponse()`, `checkAgentConsistency()` | CLI token validation |
| `prisma/schema.prisma` | 1-135 | `MachinePrincipal`, `MachineClient`, `User` | Data models |
| `docs/contracts/MACHINE_CLIENT_CREDENTIALS_V0.md` | Full | Token contract, error codes | Existing contract |
| `docs/contracts/OPENCLAW_AGENT_AUTH_TOKEN_GET_V0.md` | Full | CLI contract, validation | Existing contract |
