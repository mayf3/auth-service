/**
 * Types for @unified-auth/machine-token-provider
 *
 * SUPPORTED_AUTH_CONTRACT_VERSION=1.0.0
 * AUTH_CONTRACT_HEAD=b39e902bd01f5e17357ae3e59e440bf35ee2ad08
 * AUTH_CONTRACT_TREE=b10cdd443732688894d7b3e229b5b97b3e822b0e
 * AUTH_BUNDLE_DIGEST=c1758ce3481624aa844adfe5933bb3b68dcec05b90b93b6905c33f1857eddafa
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * MachineTokenProvider is a function that returns a Bearer access token.
 *
 * This signature is structurally compatible with the Workflow SDK's
 * `AccessTokenProvider` type, which is `() => string | Promise<string>`.
 * Consumers pass it directly to `WorkflowClientConfig.accessTokenProvider`.
 */
export type MachineTokenProvider = () => Promise<string>;

/**
 * Configuration for creating a MachineTokenProvider.
 */
export interface MachineTokenProviderConfig {
  /**
   * Full URL of the auth-service token endpoint.
   * Example: "http://auth:3000/oauth/token"
   */
  tokenEndpoint: string;

  /**
   * OAuth 2.0 client identifier for this machine.
   * Format: "mc_<base64url>"
   */
  clientId: string;

  /**
   * Async callback that returns the OAuth client secret.
   *
   * Called once per token acquisition cycle (not on cache hit).
   * On retry (network/5xx), the same credential is reused.
   * On the next acquisition cycle, the provider is called again,
   * supporting secret rotation.
   */
  credentialProvider: () => string | Promise<string>;

  /**
   * Resource (audience) identifier for the token request.
   *
   * Sent as the `resource` POST body field to `/oauth/token`
   * (matching the auth-service contract for client_credentials grant).
   * Becomes the `aud` claim in the issued JWT.
   *
   * Example: "svc-workflow"
   */
  resource: string;

  /**
   * List of OAuth scope values to request.
   *
   * Scopes are deduplicated and ASCII-byte sorted before sending.
   * Each scope must match the contract grammar: [a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*
   */
  scopes: readonly string[];

  /**
   * Optional timeout in milliseconds for the HTTP request.
   * An internal AbortController is used — consumer-facing AbortSignal
   * is not supported in V1.
   *
   * @default 10000
   */
  timeoutMs?: number;

  /**
   * Optional safety window subtracted from the server-reported `expires_in`.
   * The token is considered expired at `(issuedAt + expires_in * 1000) - skewMs`.
   *
   * @default min(30_000, expires_in * 1000 * 0.1)
   */
  expirySkewSeconds?: number;

  /**
   * Optional fetch implementation for testing or custom environments.
   * Defaults to the global `fetch`.
   */
  fetch?: typeof fetch;
}

// ---------------------------------------------------------------------------
// Internal types (not exported)
// ---------------------------------------------------------------------------

export interface CachedToken {
  accessToken: string;
  /** Absolute timestamp (ms) after which the token MUST be refreshed. */
  usableUntil: number;
}
