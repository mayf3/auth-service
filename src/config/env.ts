import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { parseTrustProxyHops } from './trust-proxy-hops.js';
dotenv.config();

function getOrDeriveSecret(primary: string | undefined, fallback: string, label: string): string {
  if (primary && primary !== fallback) return primary;
  // Derive a deterministic but different secret from the fallback
  return crypto.createHash('sha256').update(fallback + ':' + label).digest('hex');
}

const rawJwtSecret = process.env.JWT_SECRET ?? '';
const rawRefreshSecret = process.env.JWT_REFRESH_SECRET ?? '';
const authContractMode = process.env.AUTH_CONTRACT_MODE ?? 'v0';

if (!['v0', 'v1_shadow', 'v1'].includes(authContractMode)) {
  throw new Error('FATAL: AUTH_CONTRACT_MODE must be v0, v1_shadow, or v1');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '4001', 10),
  // HTTP listener bind host. Default loopback preserves every existing
  // deployment's reachability; the public hosting topology
  // (AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1) requires
  // MAC_AUTH_SERVICE_LISTEN = LOOPBACK_ONLY behind the reverse tunnel.
  AUTH_HTTP_BIND_HOST: process.env.AUTH_HTTP_BIND_HOST ?? '127.0.0.1',
  AUTH_CONTRACT_MODE: authContractMode as 'v0' | 'v1_shadow' | 'v1',

  // Database — connects to ADC's PostgreSQL
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/agent_dev_center',

  // JWT — access token secret
  JWT_SECRET: rawJwtSecret,

  // JWT — refresh token secret (MUST differ from access secret)
  // If not explicitly set, derive a different key from JWT_SECRET
  JWT_REFRESH_SECRET: getOrDeriveSecret(rawRefreshSecret, rawJwtSecret, 'refresh'),

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  // JWT Identity
  JWT_ISSUER: process.env.JWT_ISSUER ?? 'auth-service',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? 'unified-platform',
  JWT_VERSION: 'v1',

  // ─── Workflow RS256 signer key ring (PR-A) ───────────────────────────────
  // Optional: only required when serving aud=svc-workflow tokens. When unset,
  // workflow issuance is rejected (see workflow-keyring.ts). All keys are parsed
  // and validated ONCE at startup — any misconfiguration throws (fail-fast).
  // Active key: PEM-encoded RSA private key (PKCS#8), >=2048-bit.
  // JWT_PRIVATE_KEY takes precedence over JWT_PRIVATE_KEY_FILE.
  JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY ?? '',
  JWT_PRIVATE_KEY_FILE: process.env.JWT_PRIVATE_KEY_FILE ?? '',
  // kid of the active signing key (format: key-v1-<YYYYMMDD>).
  JWT_KID: process.env.JWT_KID ?? '',
  // Previous verification-only PUBLIC keys. Newline-separated entries of the
  // form "<kid>|<PEM>". Public only — never used to sign.
  JWT_PREVIOUS_PUBLIC_KEYS: process.env.JWT_PREVIOUS_PUBLIC_KEYS ?? '',

  // Registration
  REGISTER_INVITE_CODE: process.env.REGISTER_INVITE_CODE ?? '',

  // Agent Token Secret (for token-login)
  AGENT_TOKEN_SECRET: process.env.AGENT_TOKEN_SECRET ?? process.env.JWT_SECRET_SSO ?? '',

  // CORS — comma-separated allowed origins
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:4000,http://localhost:3458,http://localhost:4001').split(',').map(s => s.trim()),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),   // 15 min
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '20', 10),  // 20 requests per window
  RATE_LIMIT_LOGIN_MAX_FAILS: parseInt(process.env.RATE_LIMIT_LOGIN_MAX_FAILS ?? '5', 10), // 5 fails per 15 min

  // CTR-AH-EDGE-002 (AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1): number of
  // reverse-proxy hops in front of this process trusted for X-Forwarded-For
  // identity derivation. 0 (default) = no proxy trust, req.ip is the socket
  // address (existing local/Tailscale deployments unchanged). 1 = the hosting
  // edge (Nginx SNI block on the public host, which deletes all client-supplied
  // forwarding headers and injects exactly one entry via
  // `proxy_set_header X-Forwarded-For $remote_addr` toward 127.0.0.1:18794) —
  // req.ip then derives from that single trusted entry, giving every public
  // client an independent rate-limit identity instead of collapsing onto the
  // loopback tunnel address. Values >1 are rejected by parseTrustProxyHops.
  AUTH_TRUST_PROXY_HOPS: parseTrustProxyHops(process.env.AUTH_TRUST_PROXY_HOPS),
} as const;

// Validate required secrets
if (!env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is required');
}
