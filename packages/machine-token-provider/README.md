# @unified-auth/machine-token-provider

Official auth-service Machine Token Provider V1.

A minimal OAuth 2.0 `client_credentials` token provider with in-memory caching,
singleflight concurrency deduplication, and Workflow SDK compatibility.

## Usage

```ts
import { createMachineTokenProvider } from '@unified-auth/machine-token-provider';

const accessTokenProvider = createMachineTokenProvider({
  tokenEndpoint: 'http://auth:3000/oauth/token',
  clientId: 'mc_<base64url-client-id>',
  credentialProvider: async () => loadClientSecret(),  // your secret loader
  resource: 'svc-workflow',
  scopes: ['workflow.read'],
});

// Direct usage
const token = await accessTokenProvider();

// Workflow SDK integration (no adapter needed)
const workflowClient = new WorkflowClient({
  baseUrl: 'http://workflow:8080',
  accessTokenProvider,  // structurally compatible
});
```

## API

### `createMachineTokenProvider(config)`

Returns a `MachineTokenProvider` function `() => Promise<string>`.

| Config field | Required | Description |
|---|---|---|
| `tokenEndpoint` | ✓ | Auth-service `/oauth/token` URL |
| `clientId` | ✓ | OAuth client identifier |
| `credentialProvider` | ✓ | Async callback returning the client secret |
| `resource` | ✓ | Resource/audience ID (sent as `resource` in POST body) |
| `scopes` | ✓ | Array of OAuth scope values |
| `timeoutMs` | | HTTP request timeout (default: 10000ms) |
| `expirySkewSeconds` | | Safety window for token expiry (default: min(30, expires_in × 0.1)) |
| `fetch` | | Custom fetch implementation (for testing) |

### Error types

| Error | Cause | Retry |
|---|---|---|
| `ConfigurationError` | Invalid config at construction | Not retryable |
| `AuthenticationError` | `invalid_client` / `invalid_scope` / other 4xx | Not retryable |
| `RateLimitError` | HTTP 429 (includes `retryAfter`) | Caller decides |
| `ServiceError` | Network failure / timeout / 5xx | Provider retries once internally |
| `InvalidTokenResponseError` | Malformed token response | Not retryable |

### Retry-After handling

V1 parses `Retry-After` response headers in **delta-seconds** format only
(e.g. `Retry-After: 30`). HTTP-date format is not supported in V1.
When the server returns a non-numeric Retry-After value, `retryAfter` is
omitted from the `RateLimitError`.

## Design

- **Token caching**: In-memory, per-instance. Never persisted to disk.
- **Singleflight**: Concurrent calls coalesce into one HTTP request.
- **Scope processing**: Deduplicated and ASCII-byte sorted per contract.
- **Secret safety**: Client secret, Basic Auth header, and access tokens never appear in error messages or logs.
- **Error sandboxing**: Exceptions from `credentialProvider`, custom `fetch`, and internal timeouts are caught and replaced with fixed, sanitized error messages. Original error messages, causes, and stack traces are never propagated to callers.
- **No background refresh**: V1 refreshes on-demand only.
- **No Refresh Token**: V1 issues direct machine tokens (no refresh_credential).

## Contract

```
SUPPORTED_AUTH_CONTRACT_VERSION=1.0.0
AUTH_CONTRACT_HEAD=b39e902bd01f5e17357ae3e59e440bf35ee2ad08
AUTH_CONTRACT_TREE=b10cdd443732688894d7b3e229b5b97b3e822b0e
MINIMAL_AUTH_V1_GIT_TREE=ef8c57fb09df5aa5221bca74bfe4f6345d1c2ac1

Reproducible source bundle digest (via `node scripts/prepare-minimal-auth-v1.mjs`):
  SOURCE_BUNDLE_DIGEST=6535dc5983d52eaa6c5077c9331e2b01647ab9d5268f4f5aab2599125c01b371

Note: This package declares the repo-reproducible SOURCE_BUNDLE_DIGEST.
The independent audit's full-tree digest (c1758ce...) is not reproduced
by a repo command and is therefore not declared here.
```

## Build & Test

```bash
npm ci
npm test
npm run build
npm pack
```
