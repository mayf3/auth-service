# Workflow RS256 Machine Token + JWKS — Formal Contract (V0)

**Status:** `AUTH_SERVICE_WORKFLOW_RS256_V0_FROZEN`
**Scope:** PR-A only. OBO / RFC 8693 Token Exchange / human-direct workflow tokens are **DEFERRED_TO_LATER_PR** (see §16).
**Issuing service:** auth-service (`POST /oauth/token`)
**Verifying parties:** svc-workflow (via `GET /.well-known/jwks.json`)

---

## 1. Token Endpoint

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=client_credentials
&resource=svc-workflow
&scope=workflow.read workflow.execute
```

## 2. Grant Type

`client_credentials` only (RFC 6749 §4.4).

## 3. Client Authentication

HTTP Basic with `client_id:client_secret`. The `client_id` must identify an
**active** `MachineClient` belonging to an **active** `MachinePrincipal`
(`status = active`; `revoked`/`disabled` are rejected).

## 4. Audience

`resource=svc-workflow`. Must **exactly match** an entry in the client's
`allowedResources`. No substring / prefix / wildcard matching. Requesting
`svc-workflow` does **not** auto-grant that audience or any scope.

## 5. Scopes (V0)

| Scope | Use |
|-------|-----|
| `workflow.read` | Read workflow instances, timelines |
| `workflow.execute` | Create / transition workflow instances |

`workflow.admin` is V1 (Provisioning API auth).

### Scope matching

**Exact-set subset**: every requested scope must be present in the client's
`allowedScopes`. Normalized to deduplicated, alphabetically-sorted,
space-delimited string in the issued token. No string-substring, no prefix, no
wildcard. Empty requested scope is allowed (yields no scope claim value).

## 6. Claims Schema (direct MachinePrincipal token, plan §7.5)

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
  "agent_id": "<canonical OpenClaw agent id>",
  "client_id": "<MachineClient.clientId>",
  "jti": "<unique>",
  "iat": 1690000000,
  "nbf": 1690000000,
  "exp": 1690000600
}
```

- **No** `azp`, **no** `act` on direct tokens (those are OBO-only, §16).
- **No** `name` / `role` / `internalRole` / `okrRole` / `permissions`.

## 7. `sub` Semantics

`sub` is the **MachinePrincipal.id** UUID (verified from the DB). It is NEVER
the OpenClaw `agentId`, the `clientId`, a display name, or a requester-supplied
UUID. `principal_type` is derived from `MachinePrincipal.principalType` (an
existing enum; no migration).

## 8. Algorithm & Key id

- **Algorithm:** `RS256` (fixed; no other algorithm accepted for workflow tokens).
- **Header `kid`:** the active key's id, format `key-v1-<YYYYMMDD>`.
- Algorithm-confusion defense: verification uses `algorithms: ['RS256']` only;
  `alg=none`, HS256-forgeries, unknown `kid`, wrong algorithm, and key-type
  mismatches are all rejected. No fallback on unknown kid. Previous keys never sign.

## 9. JWKS Endpoint

```
GET /.well-known/jwks.json        (no authentication)
```

```json
{
  "keys": [
    { "kty": "RSA", "use": "sig", "alg": "RS256", "kid": "key-v1-20260716",
      "n": "<base64url modulus>", "e": "AQAB" }
  ]
}
```

- Publishes the **active** public key plus any **previous** public keys (rotation window).
- **Strictly public**: never includes `d`, `p`, `q`, `dp`, `dq`, `qi`, private PEM, or any secret.
- Order: active first, then previous in configuration order.
- `Cache-Control: public, max-age=3600, must-revalidate`; `ETag: "<sha256[:32]>"`.
- Precomputed at first request; private keys parsed once, never per-request.

## 10. TTL

Default **600s**, hard cap **900s**. `exp = iat + ttl`. `nbf = iat`.

## 11. Refresh Token

**None.** The response never includes `refresh_token`. Workflow machine tokens
are short-lived and re-obtained via `client_credentials`.

## 12. Key Rotation (V0: manual)

Mechanism: configuration change + process restart. Phases:

| Phase | State |
|-------|-------|
| Active | New key signs; old key's **public** part kept in JWKS for verification |
| Retired | Old key removed from config; its tokens stop verifying (unknown kid) |

- Exactly ONE active signing key at any time.
- Previous keys are **public-only**; they can verify but never sign.
- Duplicate kids (active↔previous or among previous) fail at startup.

## 13. Error Contract

| Condition | HTTP | OAuth error |
|-----------|------|-------------|
| Unknown/revoked client | 401 | `invalid_client` |
| Disabled principal | 401 | `invalid_client` |
| Wrong secret | 401 | `invalid_client` |
| Unauthorized audience | 400 | `invalid_grant` |
| Over-scope / substring bypass | 400 | `invalid_scope` |
| Workflow keyring not provisioned | 400 | `invalid_grant` |

Client-not-found and wrong-secret return the same generic `invalid_client`
(no existence oracle).

## 14. Disabled Behavior

- `MachineClient.status = revoked` → issuance rejected (`invalid_client`).
- `MachinePrincipal.status = disabled` → issuance rejected; verification also
  returns 403 (`主体已禁用`).

## 15. Provisioning & Migration

- **Migration:** **None.** No new tables, fields, enums, or constraints.
  `MachinePrincipal.principalType` already exists. (If a future change requires
  one, emit `AUTH_SERVICE_WORKFLOW_JWKS_BLOCKING_MIGRATION_REQUIRED`.)
- **Provisioning:** real `MachineClient`/`MachinePrincipal` rows + RSA key
  material are operator-managed and **out of scope** for this PR. Operators set
  `JWT_PRIVATE_KEY` (or `JWT_PRIVATE_KEY_FILE`), `JWT_KID`, and optionally
  `JWT_PREVIOUS_PUBLIC_KEYS` (newline-separated `<kid>|<PEM>`).

## 16. Compatibility & Deferred Items

- **Unchanged audiences:** `svc-forum`, `svc-okr`, `unified-platform`, Todo,
  ADC, and existing OpenClaw Machine tokens remain HS256 with identical
  claims/TTL/behavior. They do NOT gain a `kid`, RS256, or workflow claims.
- **Human-direct workflow token:** `DEFERRED_TO_LATER_PR`, `SIGNING_REQUIRED=RS256`.
- **OBO / Token Exchange (RFC 8693):** `DEFERRED_TO_LATER_PR` (PR-B). Will add
  `act`, `azp`, `token_use=workflow_obo`, 3-way scope intersection.

## 17. Caller Verification Checklist (svc-workflow)

1. Fetch `GET /.well-known/jwks.json` (respect `Cache-Control` + `ETag`).
2. Decode the token header; require `alg=RS256` and a `kid` present in JWKS.
3. Verify signature with the matched public key; reject unknown `kid`.
4. Verify `iss=auth-service`, `aud=svc-workflow`, `exp`/`nbf` (allow ~30s skew).
5. Read `principal_type` (`agent`) and `sub` (MachinePrincipal.id) from the
   verified payload — never trust unverified claims.
6. Enforce required `scope` subset for the operation.
