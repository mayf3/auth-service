/**
 * GET /.well-known/jwks.json — public workflow verification keys.
 *
 * Publishes the RSA public keys (active + previous) used to verify
 * aud=svc-workflow tokens. No authentication. Private key material is NEVER
 * included — only { kty, use, alg, kid, n, e }.
 *
 * Frozen by plan §12.4 / §12.8: 1-hour public cache + ETag.
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getWorkflowKeyring } from '../lib/oauth/workflow-keyring.js';
import { getV1ContractSettings } from '../lib/oauth/v1/contract.js';

export const wellKnownRouter = Router();

/** Build the JWKS response body from the current key ring. */
function buildJwksBody(): { body: string; etag: string } {
  const { jwksKeys } = getWorkflowKeyring();
  const body = JSON.stringify({ keys: jwksKeys });
  const etag = `"${crypto.createHash('sha256').update(body).digest('hex').slice(0, 32)}"`;
  return { body, etag };
}

// Lazily built on first request (NOT at module load), so the key ring env is
// read at request time. This also lets tests configure env before first hit.
let cached: { body: string; etag: string } | null = null;

function current(): { body: string; etag: string } {
  if (!cached) cached = buildJwksBody();
  return cached;
}

/** Test-only: rebuild the cached body after the key ring changes. */
export function resetJwksCacheForTests(): void {
  cached = null;
}

wellKnownRouter.get('/jwks.json', (_req: Request, res: Response) => {
  const { body, etag } = current();
  const maxAge = env.AUTH_CONTRACT_MODE === 'v0'
    ? 3600
    : getV1ContractSettings().jwksCacheTtlSeconds;
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
  res.setHeader('ETag', etag);
  res.type('application/json');
  res.send(body);
});
