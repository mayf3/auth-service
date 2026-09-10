/**
 * CTR-AH-EDGE-002 (AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1) — trusted
 * reverse-proxy hop count for client-IP identity derivation.
 *
 * The public hosting edge is a dedicated Nginx SNI block that terminates TLS on
 * the public host, deletes every client-supplied `Forwarded` /
 * `X-Forwarded-For` / `X-Real-IP` header, and injects EXACTLY ONE hop:
 * `proxy_set_header X-Forwarded-For $remote_addr` toward the loopback-only
 * tunnel endpoint 127.0.0.1:18794 (TRUSTED_UPSTREAM_PROXY_HOPS = 0 beyond the
 * edge itself). This service must therefore trust exactly one loopback proxy
 * hop when deployed behind that edge so every public client gets an
 * independent rate-limit identity derived from the edge-injected client IP —
 * and the loopback tunnel address must never become a public request's
 * rate-limit key.
 *
 * `0` (default) keeps existing direct/local deployments byte-identical: the
 * Express `trust proxy` setting stays untouched (`false`) and req.ip is the
 * socket address. Any value >1 is rejected: trusting more than the single
 * edge hop would let entries beyond our edge influence identity. The loose
 * `trust proxy = true` is never expressible through this seam. Parsing is
 * strict ('0'/'1' only) so a sloppy value fails fast instead of silently
 * widening the trust boundary.
 */
export function parseTrustProxyHops(raw: string | undefined): number {
  const value = (raw ?? '').trim();
  if (value === '') return 0;
  if (value !== '0' && value !== '1') {
    throw new Error('FATAL: AUTH_TRUST_PROXY_HOPS must be 0 (default, no proxy trust) or 1 (hosting edge on loopback)');
  }
  return Number(value);
}
