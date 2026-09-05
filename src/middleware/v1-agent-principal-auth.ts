/**
 * Route auth middleware for the exact Agent Principal resolution route.
 *
 * Reuses the existing V1 direct-machine verification machinery
 * (verifyV1DirectMachineToken — RS256 signature, issuer, audience, time,
 * token_use, claims shape, canonical scope). No second JWT protocol is
 * implemented here (CTR-EAPR-002 / DEC-EAPR-004).
 *
 * == Verification chain ==
 * 1. verifyV1DirectMachineToken(token, 'agent-principal-resolution')
 *    — RS256 + issuer + exact audience + claim/profile validation; the
 *    registry audience accepts agent principals only, so principal_type=agent
 *    is enforced by the verifier itself.
 * 2. Exact required scope: auth.agent.resolve.
 * 3. Fresh caller Principal + Client read with explicit projections (credential
 *    and secret hashes are never selected): active agent Principal bound to
 *    the signed sub, active Client, signed profile consistent with storage.
 *
 * Every rejection emits the route error envelope `{ error: CODE }` directly:
 * 401 UNAUTHORIZED for invalid tokens/identity binding, 403 ACCESS_DENIED for
 * missing scope and inactive/drifting caller state. Caller authentication
 * failures never disclose target identity.
 */

import type { NextFunction, Request, Response } from 'express';
import { verifyV1DirectMachineToken } from '../lib/oauth/v1/signer.js';
import { prisma } from '../lib/prisma.js';

/** Audience registered by AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1. */
const RESOLUTION_AUDIENCE = 'agent-principal-resolution';

/** The only scope this route accepts. */
const RESOLUTION_SCOPE = 'auth.agent.resolve';

function deny(status: 401 | 403 | 500, code: string, res: Response): void {
  res.status(status).json({ error: code });
}

export async function v1AgentPrincipalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    deny(401, 'UNAUTHORIZED', res);
    return;
  }

  // Step 1: existing V1 formal verification — RS256, issuer, exact audience,
  //         token_use, claims shape, time claims, canonical scope wire, and
  //         (via the audience registry) principal_type=agent.
  let claims;
  try {
    claims = verifyV1DirectMachineToken(token, RESOLUTION_AUDIENCE);
  } catch {
    deny(401, 'UNAUTHORIZED', res);
    return;
  }

  // Step 2: exact required scope.
  const tokenScopes = (claims.scope || '').split(' ');
  if (!tokenScopes.includes(RESOLUTION_SCOPE)) {
    deny(403, 'ACCESS_DENIED', res);
    return;
  }

  // Step 3: fresh caller Principal + Client read (explicit projections —
  //         secretHash / credential hashes are never selected).
  let principal: {
    id: string;
    principalType: string;
    agentId: string | null;
    status: string;
  } | null = null;
  let client: {
    clientId: string;
    machinePrincipalId: string;
    status: string;
  } | null = null;
  try {
    [principal, client] = await Promise.all([
      prisma.machinePrincipal.findUnique({
        where: { id: claims.sub },
        select: { id: true, principalType: true, agentId: true, status: true },
      }),
      prisma.machineClient.findUnique({
        where: { clientId: claims.client_id },
        select: { clientId: true, machinePrincipalId: true, status: true },
      }),
    ]);
  } catch {
    deny(500, 'IDENTITY_RESOLUTION_QUERY_FAILED', res);
    return;
  }

  if (!principal) {
    deny(401, 'UNAUTHORIZED', res);
    return;
  }
  if (principal.status !== 'active' || principal.principalType !== 'agent') {
    deny(403, 'ACCESS_DENIED', res);
    return;
  }
  if (principal.principalType !== claims.principal_type || principal.agentId !== claims.agent_id) {
    deny(403, 'ACCESS_DENIED', res);
    return;
  }
  if (!client) {
    deny(401, 'UNAUTHORIZED', res);
    return;
  }
  if (client.status !== 'active') {
    deny(403, 'ACCESS_DENIED', res);
    return;
  }
  if (client.machinePrincipalId !== claims.sub) {
    deny(401, 'UNAUTHORIZED', res);
    return;
  }

  next();
}
