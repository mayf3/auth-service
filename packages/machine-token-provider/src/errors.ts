/**
 * Error types for @unified-auth/machine-token-provider
 *
 * V1 keeps the error taxonomy minimal — 5 concrete subclasses of MachineTokenError.
 * No error object carries client_secret, Basic Auth header, or full access token.
 */

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

export class MachineTokenError extends Error {
  readonly name: string = 'MachineTokenError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// ---------------------------------------------------------------------------
// Concrete error classes
// ---------------------------------------------------------------------------

/**
 * Configuration is invalid (missing fields, bad format, etc.).
 * Not retryable — the caller must fix the configuration before retrying.
 */
export class ConfigurationError extends MachineTokenError {
  readonly name: string = 'ConfigurationError';
}

/**
 * Authentication failed — invalid client credentials, invalid scope, etc.
 * Not retryable (unless credentials have been rotated externally).
 */
export class AuthenticationError extends MachineTokenError {
  readonly name: string = 'AuthenticationError';

  /**
   * OAuth error code returned by the server, if available.
   * Examples: "invalid_client", "invalid_scope"
   */
  readonly code?: string;

  /**
   * HTTP status code returned by the server, if available.
   */
  readonly status?: number;

  constructor(message: string, code?: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.status = status;
  }
}

/**
 * The token endpoint returned HTTP 429 (rate limited).
 * Not automatically retried in V1 — the caller can inspect `retryAfter`
 * and decide whether to back off.
 */
export class RateLimitError extends MachineTokenError {
  readonly name: string = 'RateLimitError';

  /**
   * Retry-After value in seconds, if the server returned one.
   */
  readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, options?: ErrorOptions) {
    super(message, options);
    this.retryAfter = retryAfter;
  }
}

/**
 * A transient service error — network failure, HTTP 5xx, internal timeout.
 * The provider retries once internally.
 * If the retry also fails, this error is thrown.
 */
export class ServiceError extends MachineTokenError {
  readonly name: string = 'ServiceError';

  /**
   * HTTP status code, if the server responded.
   * `undefined` for network/timeout errors.
   */
  readonly status?: number;

  /**
   * Underlying cause, if available.
   */
  readonly cause?: unknown;

  constructor(message: string, status?: number, cause?: unknown, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
    this.cause = cause;
  }
}

/**
 * The token endpoint returned a response that could not be parsed
 * or was missing required fields (access_token, expires_in).
 */
export class InvalidTokenResponseError extends MachineTokenError {
  readonly name: string = 'InvalidTokenResponseError';

  /**
   * HTTP status code from the response, if available.
   */
  readonly status?: number;

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}
