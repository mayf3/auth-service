/**
 * Machine Token Provider implementation.
 *
 * Implements the OAuth 2.0 client_credentials grant for auth-service,
 * with in-memory caching, singleflight deduplication, and a single
 * internal retry for transient failures.
 */

import type { MachineTokenProvider, MachineTokenProviderConfig, CachedToken } from './types.js';
import {
  ConfigurationError,
  AuthenticationError,
  RateLimitError,
  ServiceError,
  InvalidTokenResponseError,
} from './errors.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_EXPIRY_SKEW_MS = 30_000;
const RETRY_DELAY_MS = 250;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createMachineTokenProvider(
  config: MachineTokenProviderConfig,
): MachineTokenProvider {
  // ── Validate config eagerly ──────────────────────────────────────────
  if (!config.tokenEndpoint || typeof config.tokenEndpoint !== 'string') {
    throw new ConfigurationError('tokenEndpoint is required');
  }
  if (!config.clientId || typeof config.clientId !== 'string') {
    throw new ConfigurationError('clientId is required');
  }
  if (typeof config.credentialProvider !== 'function') {
    throw new ConfigurationError('credentialProvider must be a function');
  }
  if (!config.resource || typeof config.resource !== 'string') {
    throw new ConfigurationError('resource is required');
  }
  if (!Array.isArray(config.scopes) || config.scopes.length === 0) {
    throw new ConfigurationError('scopes must be a non-empty array');
  }

  // Validate scopes match contract grammar: [a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*
  const scopePattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$/;
  for (const scope of config.scopes) {
    if (typeof scope !== 'string' || !scopePattern.test(scope)) {
      throw new ConfigurationError(
        `Invalid scope "${String(scope)}": must match [a-z][a-z0-9-]*\\.[a-z][a-z0-9._-]*`,
      );
    }
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = config.fetch ?? globalThis.fetch;

  // Normalized scopes: deduplicated + ASCII-byte sorted
  const canonicalScopes: string[] = [...new Set(config.scopes)].sort();
  const scopeParam: string = canonicalScopes.join(' ');

  // ── Token cache (instance-scoped, never persisted) ───────────────────
  let cached: CachedToken | null = null;

  // Inflight promise for singleflight deduplication
  let inflight: Promise<string> | null = null;

  // ── Provider function (returned to caller) ───────────────────────────
  const provider: MachineTokenProvider = async (): Promise<string> => {
    // Cache hit: token is still usable
    if (cached !== null && Date.now() < cached.usableUntil) {
      return cached.accessToken;
    }

    // Singleflight: coalesce concurrent callers into one HTTP request
    if (inflight !== null) {
      return inflight;
    }

    inflight = acquireToken();
    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  };

  return provider;

  // ── Internal: Acquire a new token ────────────────────────────────────
  async function acquireToken(): Promise<string> {
    let clientSecret: string;
    try {
      clientSecret = await config.credentialProvider();
    } catch {
      // Sandbox: credentialProvider errors must never leak secret-adjacent content
      throw new ConfigurationError('Machine credential could not be loaded');
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      resource: config.resource,
      scope: scopeParam,
    });

    // First attempt
    try {
      return await doRequest(clientSecret, body);
    } catch (error) {
      // Only retry transient failures (ServiceError) once
      if (error instanceof ServiceError) {
        await sleep(RETRY_DELAY_MS);
        return doRequest(clientSecret, body);
      }
      throw error;
    }
  }

  // ── HTTP request + response parsing ──────────────────────────────────
  async function doRequest(
    clientSecret: string,
    body: URLSearchParams,
  ): Promise<string> {
    const basicAuth = basicAuthHeader(config.clientId, clientSecret);

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await doFetch(config.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: basicAuth,
            Accept: 'application/json',
          },
          body: body.toString(),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Sandbox: fetch/network errors must never leak message, cause, stack,
      // headers, Authorization, client_secret, or access_token.
      throw new ServiceError('Auth service request failed');
    }

    // ── Non-2xx handling ──────────────────────────────────────────────
    if (!response.ok) {
      const bodyText = await safeResponseText(response);
      const errorBody: Record<string, unknown> | undefined = tryParseJson(bodyText) as Record<string, unknown> | undefined;
      const oauthError =
        (errorBody && typeof errorBody.error === 'string')
          ? errorBody.error
          : undefined;

      if (response.status === 401 && oauthError === 'invalid_client') {
        throw new AuthenticationError(
          'Token request failed: invalid_client',
          'invalid_client',
          response.status,
        );
      }

      if (response.status === 400 && oauthError === 'invalid_scope') {
        throw new AuthenticationError(
          'Token request failed: invalid_scope',
          'invalid_scope',
          response.status,
        );
      }

      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response.headers);
        throw new RateLimitError(
          `Token request rate limited (429)${retryAfter !== undefined ? `, retry after ${retryAfter}s` : ''}`,
          retryAfter,
        );
      }

      // 4xx other than the above: treat as authentication error
      if (response.status >= 400 && response.status < 500) {
        throw new AuthenticationError(
          `Token request failed with HTTP ${response.status}${oauthError ? `: ${oauthError}` : ''}`,
          oauthError,
          response.status,
        );
      }

      // 5xx
      throw new ServiceError(
        `Token request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    // ── Parse success response ─────────────────────────────────────────
    const bodyText = await safeResponseText(response);
    const data = tryParseJson(bodyText);

    if (!data || typeof data !== 'object') {
      throw new InvalidTokenResponseError(
        'Token response is not valid JSON',
        response.status,
      );
    }

    const accessToken: unknown = (data as Record<string, unknown>).access_token;
    const expiresIn: unknown = (data as Record<string, unknown>).expires_in;

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new InvalidTokenResponseError(
        'Token response missing access_token',
        response.status,
      );
    }

    if (typeof expiresIn !== 'number' || expiresIn <= 0 || !Number.isFinite(expiresIn)) {
      throw new InvalidTokenResponseError(
        'Token response missing or invalid expires_in',
        response.status,
      );
    }

    // Compute usableUntil with safety window
    const skewMs =
      (config.expirySkewSeconds !== undefined
        ? config.expirySkewSeconds * 1000
        : Math.min(MIN_EXPIRY_SKEW_MS, expiresIn * 1000 * 0.1));

    cached = {
      accessToken,
      usableUntil: Date.now() + expiresIn * 1000 - skewMs,
    };

    return accessToken;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`, 'utf-8').toString('base64');
  return `Basic ${encoded}`;
}

function parseRetryAfter(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }
  // Delta-seconds format only — date-based Retry-After is not supported in V1
  return undefined;
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
