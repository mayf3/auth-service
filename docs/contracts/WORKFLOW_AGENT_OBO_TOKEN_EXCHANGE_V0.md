# Workflow Agent OBO Token Exchange V0 — Formal Contract

**Status:** `AUTH_SERVICE_WORKFLOW_AGENT_OBO_V0_FROZEN`
**Scope:** PR-B only. User OBO, OBO chaining, service-policy scope caps are
**DEFERRED_TO_LATER_PR**.
**Issuing service:** auth-service (`POST /oauth/token`)
**Verifying parties:** svc-workflow (via `GET /.well-known/jwks.json`)

---

## 1. Token Exchange Endpoint

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(<ADC_client_id>:<ADC_client_secret>)
```

Same endpoint as `client_credentials`. **Extended** via `grant_type` dispatch.

## 2. Grant Type

```
grant_type=urn:ietf:params:oauth:grant-type:token-exchange
```

Full RFC 8693 URN. No abbreviated alias in V0.

## 3. Request Parameters

| Parameter | Required | Value |
|---|---|---|
| `grant_type` | ✅ | `urn:ietf:params:oauth:grant-type:token-exchange` |
| `subject_token` | ✅ | JWT string — valid auth-service RS256 access token |
| `subject_token_type` | ✅ | `urn:ietf:params:oauth:token-type:access_token` |
| `requested_token_type` | ❌ | `urn:ietf:params:oauth:token-type:access_token` (default) |
| `audience` | ✅ | `svc-workflow` |
| `scope` | ❌ | Space-delimited scope string |

### 3.1 Prohibited Parameters

| Parameter | Handling |
|---|---|
| `requested_subject` | Rejected with `invalid_request` (400) |
| `subject` | Rejected with `invalid_request` (400) |
| `subject_id` | Rejected with `invalid_request` (400) |
| `requested_sub` | Rejected with `invalid_request` (400) |
| `actor_token` | Rejected with `invalid_request` (400) |

## 4. ADC Client Authentication

HTTP Basic Auth with `client_id:client_secret`, identical to `client_credentials`.

**Validation sequence:**
1. Client exists (DB lookup) → not found → `invalid_client` (401)
2. Client status = `active` → `revoked` → `invalid_client` (401)
3. Principal status = `active` → `disabled` → `invalid_client` (401)
4. Secret verified via `verifyClientSecret()` → wrong → `invalid_client` (401)

All four return the same generic `invalid_client` (no existence oracle).

## 5. Subject Token Profile (V0)

V0 only accepts **auth-service Agent Workflow Direct Tokens**.

### Requirements

| Check | Value | Failure |
|---|---|---|
| Algorithm | `RS256` | `invalid_grant` (400) |
| `kid` | Present, resolvable in current JWKS | `invalid_grant` (400) |
| `iss` | `auth-service` | `invalid_grant` (400) |
| `aud` | `svc-workflow` | `invalid_grant` (400) |
| `principal_type` | `agent` | `invalid_grant` (400) |
| `type` | `access` | `invalid_grant` (400) |
| `token_use` | `access` (NOT `workflow_obo`) | `invalid_grant` (400) — chaining blocked |
| `act` | **Must be absent** | `invalid_grant` (400) — chaining blocked |
| `sub` | Non-empty, valid `MachinePrincipal.id` UUID | `invalid_grant` (400) |
| `exp` | `> now` (30s clock skew tolerance) | `invalid_grant` (400) |
| `nbf` | `≤ now + 30s` | `invalid_grant` (400) |
| Signature | Valid against active or previous key | `invalid_grant` (400) |

### Rejected Token Types

- HS256 non-workflow tokens
- User tokens (HS256)
- Refresh tokens (`type=refresh`)
- ID tokens
- OBO tokens (`token_use=workflow_obo`)
- Tokens with `act` claim
- Tampered signatures
- Unknown `kid`

## 6. Principal Resolution

```
OBO.sub = subject_token.sub (verified MachinePrincipal.id)
```

The `sub` is extracted **only** from the verified subject token payload. ADC
**cannot** specify the `sub` via any request parameter.

After extraction, the database is queried to confirm:
- `MachinePrincipal` exists (by `sub`)
- `MachinePrincipal.status` = `active`
- `MachinePrincipal.principalType` = `agent` (matches token's `principal_type`)

On any mismatch → `invalid_grant` (400).

## 7. Claims Schema

### 7.1 Agent OBO Token

```json
{
  "iss": "auth-service",
  "sub": "<subject MachinePrincipal.id UUID>",
  "aud": "svc-workflow",
  "principal_type": "agent",
  "scope": "workflow.execute workflow.read",
  "token_use": "workflow_obo",
  "type": "access",
  "version": "v1",
  "act": {
    "sub": "<ADC MachinePrincipal.id UUID>"
  },
  "azp": "<ADC MachineClient.clientId>",
  "agent_id": "<subject agent_id>",
  "client_id": "<ADC MachineClient.clientId>",
  "jti": "<unique>",
  "iat": 1784200000,
  "nbf": 1784200000,
  "exp": 1784200300
}
```

### 7.2 Claim Reference

| Claim | Source | Semantics |
|---|---|---|
| `iss` | Fixed config | `auth-service` |
| `sub` | Subject token payload (verified) | The real actor in the workflow domain |
| `aud` | Request parameter (`audience`) | Must be `svc-workflow` in V0 |
| `principal_type` | Subject token payload | `agent` (V0 only) |
| `scope` | 3-way intersection | See §8 |
| `token_use` | Fixed | `workflow_obo` — OBO identifier |
| `type` | Fixed | `access` (backward compatible) |
| `act` | DB-bound ADC `MachinePrincipal.id` | `{ "sub": "<ADC MachinePrincipal.id>" }` — audit only |
| `azp` | ADC `MachineClient.clientId` | Authorized party; same as `client_id` |
| `agent_id` | Subject token payload | Only present for agent subjects |
| `client_id` | ADC `MachineClient.clientId` | Same as `azp` (backward compat) |
| `jti` | Generated | Unique per token |
| `iat` | System time | Issued at |
| `nbf` | Same as `iat` | Not before |
| `exp` | `iat + min(300, subject_token.exp - iat)` | Expiration |

### 7.3 Direct Token vs OBO Token

| Claim | Direct Token | OBO Token |
|---|---|---|
| `sub` | MachinePrincipal.id (caller) | Subject's real MachinePrincipal.id |
| `client_id` | Direct MachineClient.clientId | ADC MachineClient.clientId |
| `azp` | **Absent** | ADC MachineClient.clientId |
| `act` | **Absent** | `{ "sub": "<ADC MachinePrincipal.id>" }` |
| `token_use` | `access` | `workflow_obo` |

Direct token contract is **unchanged** by PR-B.

## 8. Scope Intersection

```
final_scopes = subject_token.scope
               ∩ ADC_client.allowedScopes
               ∩ requested_scope (default: subject_token.scope)
```

**Rules:**
- Exact set membership only — no prefix, substring, or wildcard
- Case-sensitive
- Deduplicated and alphabetically sorted
- Empty intersection → `invalid_scope` (400)
- Empty requested scope defaults to subject token's scope set
- Service-policy scope layer is **DEFERRED TO V1**

## 9. TTL & Refresh Token

```
OBO_ACCESS_TOKEN_TTL_SECONDS=300
OBO_REFRESH_TOKEN_ISSUED=false
```

Formula:
```
OBO.exp = min(iat + 300, subject_token.exp)
```

- Client cannot request longer TTL
- No refresh token
- Subject token expired or with ≤0 remaining → `invalid_grant` (400)

## 10. OBO Chaining

```text
OBO_CHAINING_ALLOWED=false
```

Blocked by two independent checks:
1. `token_use` must be `access` (not `workflow_obo`)
2. `act` must be absent

## 11. Error Contract

| Condition | HTTP | OAuth Error |
|---|---|---|
| ADC client not found | 401 | `invalid_client` |
| ADC client revoked | 401 | `invalid_client` |
| ADC principal disabled | 401 | `invalid_client` |
| Wrong ADC secret | 401 | `invalid_client` |
| Unauthorized audience | 400 | `invalid_grant` |
| Subject token invalid (sig/iss/exp/nbf) | 400 | `invalid_grant` |
| Subject principal disabled | 400 | `invalid_grant` |
| Subject principal not found | 400 | `invalid_grant` |
| Subject token type rejected | 400 | `invalid_grant` |
| OBO chaining rejected | 400 | `invalid_grant` |
| ADC scope violation | 400 | `invalid_scope` |
| Empty scope intersection | 400 | `invalid_scope` |
| `requested_subject` provided | 400 | `invalid_request` |
| Unknown `kid` | 400 | `invalid_grant` |
| Workflow keyring not configured | 400 | `invalid_grant` |

External errors never reveal whether the subject principal exists, is disabled,
or a client-id-versus-secret mismatch.

## 12. Audit Boundary

| Logged | Never Logged |
|---|---|
| `requestId` | Full subject token |
| `output_jti` | Full output token |
| `subjectSub` | Client secret |
| `subjectPrincipalType` | Private key / PEM |
| `subjectJti` | Authorization header |
| ADC `MachinePrincipal.id` | Environment variables |
| ADC `clientId` (masked: first 8 chars) | Sensitive user data |
| `azp` (masked) | |
| `actSub` | |
| Requested / issued scopes | |
| `kid`, `algorithm` | |
| `issued_at`, `expires_at` | |
| Result / rejection category | |

**Durability note:** stderr JSON is V0 best-effort structured security log,
not a persistent audit ledger. Multi-instance scenarios depend on external log
aggregation.

## 13. Disable / Revocation

| Entity disabled/revoked | Effect at exchange | Effect on issued OBO tokens |
|---|---|---|
| ADC MachineClient `revoked` | Blocked at auth (`invalid_client`) | Expire naturally (max 300s) |
| ADC MachinePrincipal `disabled` | Blocked at auth (`invalid_client`) | Expire naturally (max 300s) |
| Subject MachinePrincipal `disabled` | Blocked at subject check (`invalid_grant`) | Expire naturally (max 300s) |
| Key rotated (old key retired) | Subject tokens signed with retired key fail | OBO tokens signed with new key |

## 14. Compatibility

PR-B only activates when:
```
grant_type=urn:ietf:params:oauth:grant-type:token-exchange
audience=svc-workflow
```

**Unchanged:**
- PR-A direct workflow token claims
- `client_credentials` flow (unchanged)
- Non-workflow HS256 tokens (Forum, svc-okr, Todo)
- Existing User tokens
- JWKS endpoint
- Key rotation behavior
- verify-token endpoint (except OBO token recognition)

`client_credentials` never becomes OBO. The grant type is explicit.

## 15. Provisioning & Migration

```text
MIGRATION=none
PROVISIONING_REQUIREMENTS=NONE_FOR_PR_B
```

PR-B reuses existing schema:
- `MachineClient` / `MachinePrincipal` for ADC authentication
- `allowedResources` / `allowedScopes` for authorization
- Workflow keyring for signing

No new tables, fields, enums, or env vars.

## 16. Deferred Items

| Item | Reason |
|---|---|
| User OBO | User tokens are HS256; requires RS256 migration first |
| OBO chaining | V0 blocks; requires delegation model |
| Service-policy scope layer | V1 feature |
| Automated key rotation | V1 feature (manual in V0) |
| Persistent delegation (Mode B) | V1; V0 uses subject-token-only model |

## 17. Caller Verification Checklist (svc-workflow)

1. Check `token_use` — `workflow_obo` = OBO token
2. Verify signature via JWKS (same as direct tokens)
3. Verify `iss=auth-service`, `aud=svc-workflow`, `exp`/`nbf`
4. Read `sub` (real actor) — authorize on this
5. Read `act.sub` (ADC service principal) — audit only
6. Read `azp` / `client_id` (ADC OAuth client) — audit only
7. Domain authorization MUST use `sub`, NOT `act.sub` or `azp`
8. Enforce required scope subset
