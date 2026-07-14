# Machine Client Credentials v0 — Contract

> Version: 0.1 (PR-2A)
> Last Updated: 2026-07-14
> Status: Draft — Ready for Review

---

## 1. Principal ↔ Agent ID Relationship

- **MachinePrincipal** is the canonical machine identity in auth-service.
- Each MachinePrincipal has a `principalType` (currently only `agent`) and a unique `agentId`.
- `agentId` is the stable OpenClaw Agent ID from `openclaw.json` → `agents.list[].id`.
- MachinePrincipal is NOT the same as a User record — it is a separate model with its own lifecycle.
- Each MachinePrincipal MUST have an `ownerUserId` pointing to an existing human User.
- The owner relationship is for audit and management, not for permission inheritance.

### Constraints

- One `agentId` → one active MachinePrincipal (unique constraint enforced at DB level).
- MachinePrincipal UUID is the future JWT `sub` for agent tokens.
- `agentId` is a stable business alias, NOT the JWT `sub`.

---

## 2. Token Contract

### Endpoint

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic <base64(client_id:client_secret)>
```

### Request Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `grant_type` | Yes | MUST be `client_credentials` |
| `resource` | Yes | Target service audience (e.g. `svc-forum`) |
| `scope` | No | Space-delimited scope string (e.g. `forum.read forum.write`) |

### Success Response (200)

```json
{
  "access_token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 600,
  "scope": "forum.read"
}
```

Headers: `Cache-Control: no-store`, `Pragma: no-cache`

### Agent Access Token Claims

```json
{
  "sub": "<machine-principal-uuid>",
  "iss": "auth-service",
  "aud": "<requested-resource>",
  "iat": <issued-at>,
  "exp": <expires-at>,
  "jti": "<unique-token-id>",
  "type": "access",
  "version": "v1",
  "principal_type": "agent",
  "agent_id": "<canonical-agent-id>",
  "client_id": "<oauth-client-id>",
  "scope": "forum.read"
}
```

| Claim | Always | Description |
|-------|--------|-------------|
| `sub` | Yes | MachinePrincipal UUID (NOT agentId, NOT User UUID) |
| `iss` | Yes | `auth-service` (same issuer as human tokens) |
| `aud` | Yes | The requested resource (single string) |
| `iat` | Yes | Issued-at timestamp (seconds since epoch) |
| `exp` | Yes | Expiration timestamp (default: iat + 600s) |
| `jti` | Yes | Unique per-token ID for audit |
| `type` | Yes | `access` |
| `version` | Yes | `v1` |
| `principal_type` | Yes | `agent` — differentiates from human tokens |
| `agent_id` | Yes | Canonical OpenClaw Agent ID |
| `client_id` | Yes | OAuth client identifier |
| `scope` | Yes | Space-delimited, sorted, deduplicated scopes |

### NOT in Agent Token

The following claims are present in human tokens but MUST NOT appear in agent tokens:
- `name` ❌
- `role` ❌
- `internalRole` ❌
- `okrRole` ❌
- `permissions` ❌

Services MUST check `principal_type === 'agent'` to distinguish agent tokens from human tokens.

### Token Lifetime

- Default TTL: **600 seconds** (10 minutes).
- Hard cap: **900 seconds** (15 minutes) — enforced in code, not configurable beyond this.
- No refresh token is issued for client_credentials grant.

---

## 3. Error Contract

All errors follow OAuth 2.0 RFC 6749 error conventions.

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `unsupported_grant_type` | `grant_type` is not `client_credentials` |
| 400 | `invalid_grant` | Resource not authorized or request malformed |
| 400 | `invalid_scope` | Requested scope is not in allowedScopes |
| 401 | `invalid_client` | Client not found, secret wrong, principal disabled, or client revoked |

Response body format:

```json
{
  "error": "invalid_client",
  "error_description": "..."  // optional, not always present
}
```

### Security Rules for Errors

- `invalid_client` is a generic error — does NOT distinguish between:
  - Non-existent clientId
  - Wrong client secret
  - Disabled MachinePrincipal
  - Revoked MachineClient
- `invalid_grant` is used for unauthorized resource (no distinction between "resource doesn't exist" and "client not authorized for resource")
- Error responses never include: client secret, full clientId, principal status details, or internal error messages.

---

## 4. Client Authentication

### Preferred: HTTP Basic Auth

```
Authorization: Basic base64(client_id:client_secret)
```

### Body-based (Legacy Compat)

Body parameters `client_id` and `client_secret` are NOT supported in v0.1. Only Basic auth is accepted.

### Requirements

- Client ID format: `mc_<24-char-random>` (base64url-encoded random string)
- Client secret: 256-bit random, base64url-encoded (43 characters)
- Secret hashing: `crypto.scryptSync` with random 16-byte salt
- Secret shown ONLY on creation and rotation

---

## 5. Secret Lifecycle

### Creation

1. Admin calls `machine-admin client create --agent-id <id> --resources "..." --scopes "..."`
2. System generates: `clientId` (`mc_` + 24 random chars), `clientSecret` (256-bit random)
3. Secret is hashed with scrypt (salt:hash format) and stored in DB
4. Only plaintext secret returned in CLI output — never stored, never logged
5. Output example:
```json
{
  "clientId": "mc_abc123...",
  "secret": "...shown-once...",
  "allowedResources": ["svc-forum"],
  "allowedScopes": ["forum.read"],
  "status": "active"
}
```

### Rotation

1. Admin calls `machine-admin client rotate --client-id <id>`
2. New secret generated, old secret hash replaced
3. Old secret immediately invalidated
4. New secret shown once in output
5. Existing short-lived access tokens continue to expire naturally (no jti revocation)

### Revocation

1. Admin calls `machine-admin client revoke --client-id <id>`
2. Client status set to `revoked`
3. All token issuance for this client immediately blocked
4. Existing short-lived tokens continue to expire naturally

---

## 6. Principal Disable/Revoke Semantics

### Disable Principal

- `machine-admin principal disable --agent-id <id>`
- Principal status set to `disabled`
- All associated clients immediately cannot issue new tokens
- Existing short-lived tokens continue to expire naturally

### Effect Matrix

| Principal Status | Client Status | Token Issuance |
|-----------------|---------------|----------------|
| active | active | ✅ Allowed |
| active | revoked | ❌ Blocked |
| disabled | active | ❌ Blocked (all clients) |
| disabled | revoked | ❌ Blocked |

---

## 7. Audit Events

All operations emit structured JSON audit events to stderr:

| Event Type | Trigger |
|------------|---------|
| `principal.created` | New MachinePrincipal created |
| `principal.disabled` | Principal disabled |
| `client.created` | New MachineClient created (secret masked) |
| `client.rotated` | Client secret rotated (secret masked) |
| `client.revoked` | Client revoked |
| `token.issued` | Token successfully issued (contains jti, masked clientId, resource, scopes) |
| `token.failed` | Token issuance failed (contains error category) |

Audit events NEVER contain: client secret, access token, authorization header, or secret hash.

---

## 8. Admin CLI (`machine-admin`)

### Commands

```bash
# Principal management
machine-admin principal create --agent-id <id> --owner <userId> [--name <name>]
machine-admin principal inspect --agent-id <id>
machine-admin principal disable --agent-id <id>

# Client management
machine-admin client create --agent-id <id> --resources "svc-a,svc-b" --scopes "scope1,scope2"
machine-admin client rotate --client-id <id>
machine-admin client revoke --client-id <id>
machine-admin client inspect --client-id <id>
```

All output is JSON to stdout. Errors to stderr. Non-zero exit on failure.

---

## 9. Excluded Features (v0.1)

The following are explicitly NOT implemented in this version:

- ❌ No refresh token for agent tokens
- ❌ No JWKS / RSA signing
- ❌ No authorization code flow
- ❌ No PKCE
- ❌ No dynamic client registration
- ❌ No token revocation (jti blacklist)
- ❌ No batch principal creation (76 agents)
- ❌ No `agent-auth token get` CLI
- ❌ No Forum / OKR / Todo integration
- ❌ No JIT Provisioning
- ❌ No Vault / Credential Broker integration
- ❌ No modification of existing `/token-login` endpoint
- ❌ No modification of existing human user auth flow

---

## 10. PR-2B Integration Points

PR-2B will implement:

```bash
agent-auth token get
```

This command will:
1. Read `PLATFORM_AGENT_ID` from workspace `.env` (using existing PR-1 resolver)
2. Map to MachinePrincipal (via `machine-admin principal inspect`)
3. Read `IDP_CLIENT_ID` and `IDP_CLIENT_SECRET` from workspace `.env`
4. Call `POST /oauth/token` with client_credentials grant
5. Return the access token for use by Skills

### Frozen Interfaces for PR-2B

The following are stable and must not change without coordination:
- `POST /oauth/token` — URL, request format, response format
- Basic auth with `client_id:client_secret`
- `resource` and `scope` parameter semantics
- Agent Token claims (`principal_type`, `agent_id`, `client_id`, `sub`)
- `machine-admin principal inspect --agent-id <id>` output format
- `machine-admin client inspect --client-id <id>` output format
- Error codes and HTTP status mapping
