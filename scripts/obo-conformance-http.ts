/**
 * scripts/obo-conformance-http.ts
 *
 * Shared HTTP helpers for OBO conformance validation tests.
 */

import crypto from 'node:crypto';
import { decodeJwt } from './obo-conformance-ids.js';

/**
 * Perform an OAuth 2.0 token request with Basic authentication.
 */
export async function requestToken(
  baseUrl: string,
  params: {
    clientId: string;
    clientSecret: string;
    grantType: string;
    body: Record<string, string>;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const basicAuth = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');
  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ grant_type: params.grantType, ...params.body }).toString(),
  });
  let body: Record<string, unknown> = {};
  try { body = await res.json() as Record<string, unknown>; } catch { /* empty */ }
  return { status: res.status, body };
}

/**
 * Perform a raw OAuth 2.0 token request (without the Basic auth helper).
 * Returns the full Response for manual inspection.
 */
export async function rawTokenRequest(
  baseUrl: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json() as Record<string, unknown>; } catch { /* empty */ }
  return { status: res.status, body: data };
}

/**
 * Fetch JWKS from the well-known endpoint.
 */
export async function getJwks(baseUrl: string): Promise<{ keys: Array<Record<string, unknown>> }> {
  const res = await fetch(`${baseUrl}/.well-known/jwks.json`);
  return res.json() as Promise<{ keys: Array<Record<string, unknown>> }>;
}

/**
 * Verify a JWT's RS256 signature using the auth-service JWKS endpoint.
 */
export async function verifyJwtSignature(
  token: string,
  baseUrl: string,
): Promise<boolean> {
  const jwks = await getJwks(baseUrl);
  const { header } = decodeJwt(token);

  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) return false;

  const parts = token.split('.');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  const publicKey = crypto.createPublicKey({
    key: { kty: 'RSA', n: jwk.n as string, e: jwk.e as string },
    format: 'jwk',
  });
  return verifier.verify(publicKey, Buffer.from(parts[2], 'base64url'));
}
