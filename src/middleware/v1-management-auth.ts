/**
 * V1 Management Auth Middleware.
 *
 * Thin wrapper over the existing V1 token verification chain.
 * Does NOT reimplement JWT parsing, JWKS key selection, or claims validation.
 *
 * Accepts RS256 access tokens issued by auth-service's V1 Client Credentials
 * flow for the svc-auth audience with auth.identity.provision scope.
 *
 * On success, sets req.actor (NOT req.user) with the authenticated
 * machine principal/client identity.
 *
 * == Verification chain ==
 * 1. verifyV1DirectMachineToken() — RS256 signature, issuer, audience, claims
 * 2. Scope check — token must include auth.identity.provision
 * 3. One combined DB query — principal active, client active, client belongs
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyV1DirectMachineToken } from '../lib/oauth/v1/signer.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';

/** Audience for auth-service's own management API. */
const MGMT_AUDIENCE = 'svc-auth';

/** Scope required for identity provisioning operations. */
const MGMT_SCOPE = 'auth.identity.provision';

/** Scope namespace expected by the V1 scope validator. */
const MGMT_NAMESPACE = 'auth';

// ─── Actor Context (NOT a fake user) ───────────────────────────────────────

export interface ActorContext {
  type: 'machine';
  principalId: string;
  principalType: 'agent' | 'service';
  clientId: string;
}

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
    }
  }
}

// ─── Middleware ─────────────────────────────────────────────────────────────

/**
 * V1 Management Authentication middleware.
 *
 * Verifies that the request carries a valid V1 RS256 machine token for
 * the svc-auth audience with the auth.identity.provision scope.
 */
export const v1ManagementAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    throw new HttpError(401, 'Authentication required: Bearer token missing');
  }

  // Step 1: V1 formal verification — RS256 signature, issuer, audience,
  //         token_use, claims shape, time claims. This reuses the EXISTING
  //         verification function — no reimplementation of JWT/JWKS logic.
  let claims;
  try {
    claims = verifyV1DirectMachineToken(token, MGMT_AUDIENCE);
  } catch (err) {
    throw new HttpError(401, `V1 token verification failed: ${(err as Error).message}`);
  }

  // Step 2: Verify required scope
  const tokenScopes = (claims.scope || '').split(' ');
  if (!tokenScopes.includes(MGMT_SCOPE)) {
    throw new HttpError(
      403,
      `Token lacks required scope "${MGMT_SCOPE}". Token has scopes: ${claims.scope || '(none)'}`,
    );
  }

  // Step 3: One combined DB query — verify principal & client still active
  const [principal, client] = await Promise.all([
    prisma.machinePrincipal.findUnique({ where: { id: claims.sub } }),
    prisma.machineClient.findUnique({ where: { clientId: claims.client_id } }),
  ]);

  if (!principal) {
    throw new HttpError(401, `MachinePrincipal "${claims.sub}" not found`);
  }
  if (principal.status !== 'active') {
    throw new HttpError(403, `MachinePrincipal "${claims.sub}" is not active`);
  }
  if (!client) {
    throw new HttpError(401, `MachineClient "${claims.client_id}" not found`);
  }
  if (client.status !== 'active') {
    throw new HttpError(403, `MachineClient "${claims.client_id}" is not active`);
  }
  if (client.machinePrincipalId !== principal.id) {
    throw new HttpError(401, 'Client does not belong to the token\'s principal');
  }

  // Set actor context (NOT req.user — this is a machine, not a human user)
  req.actor = {
    type: 'machine',
    principalId: claims.sub,
    principalType: claims.principal_type,
    clientId: claims.client_id,
  };

  next();
});
