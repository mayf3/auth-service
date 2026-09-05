/**
 * Exact Agent Principal resolution route.
 *
 * GET /api/v1/agent-principals/:principal_id/agent
 *
 * Implements CTR-EAPR-002 / CTR-EAPR-003 / CTR-EAPR-004 of accepted
 * AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1: one bounded, read-only,
 * machine-only lookup that turns one exact Principal UUID into the canonical
 * active AGENT relation. No query parameters, no body, no list/prefix/fuzzy
 * forms, no writes, no credential issuance.
 *
 * Authentication: V1 RS256 access token with audience
 * `agent-principal-resolution` and scope `auth.agent.resolve`
 * (see ../middleware/v1-agent-principal-auth.ts).
 *
 * Route-local catch emits the machine-readable envelope `{ error: CODE }`,
 * mirroring src/routes/idempotent.ts.
 */

import { Router, type Request, type RequestHandler, type Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { v1AgentPrincipalAuth } from '../middleware/v1-agent-principal-auth.js';
import {
  assertNoQueryOrBody,
  parsePrincipalIdParam,
  resolveAgentPrincipalById,
  toAgentPrincipalResolutionError,
} from '../lib/oauth/v1/agent-principal-resolution.js';

interface AgentPrincipalRouteDependencies {
  auth: RequestHandler;
  resolve: typeof resolveAgentPrincipalById;
}

const defaultDependencies: AgentPrincipalRouteDependencies = {
  auth: v1AgentPrincipalAuth,
  resolve: resolveAgentPrincipalById,
};

/** Factory keeps production wiring exact while allowing executable route tests. */
export function createAgentPrincipalRouter(
  dependencies: AgentPrincipalRouteDependencies = defaultDependencies,
): Router {
  const router = Router();

  router.get(
    '/v1/agent-principals/:principal_id/agent',
    dependencies.auth,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        // Input shape first — both rejections happen before any target query.
        assertNoQueryOrBody(req.query as Record<string, unknown>, req.body, req.headers);
        const principalId = parsePrincipalIdParam(req.params.principal_id);
        const result = await dependencies.resolve(principalId);
        res.status(200).json(result);
      } catch (error) {
        const mapped = toAgentPrincipalResolutionError(error);
        res.status(mapped.status).json({ error: mapped.code });
      }
    }),
  );

  return router;
}

export const agentPrincipalRouter = createAgentPrincipalRouter();
