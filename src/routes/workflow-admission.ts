import { performance } from 'node:perf_hooks';
import { Router, type Request } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import {
  authenticateWorkflowAdmission, WorkflowAdmissionAuthError,
} from '../middleware/v1-workflow-admission-auth.js';
import {
  AgentPrincipalResolutionError, assertNoQueryOrBody, parseAgentIdParam, parsePrincipalIdParam,
  resolveAgentIdPrincipalDirectory, resolveAgentPrincipalDirectory, toAgentPrincipalResolutionError,
} from '../lib/oauth/v1/agent-principal-resolution.js';

interface Dependencies {
  authenticate: (req: Request) => Promise<void>;
  resolve: typeof resolveAgentPrincipalDirectory;
  resolveAgentId: typeof resolveAgentIdPrincipalDirectory;
  timeoutMs: number;
}

export function createWorkflowAdmissionRouter(overrides: Partial<Dependencies> = {}): Router {
  const deps: Dependencies = {
    authenticate: authenticateWorkflowAdmission, resolve: resolveAgentPrincipalDirectory,
    resolveAgentId: resolveAgentIdPrincipalDirectory,
    timeoutMs: 5000, ...overrides,
  };
  if (!(deps.timeoutMs > 0 && deps.timeoutMs <= 5000)) throw new Error('Invalid admission deadline');
  const router = Router();
  router.get('/v1/directory/principals/:principal_id/agent', asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const deadline = performance.now() + deps.timeoutMs;
    const timeout = () => new AgentPrincipalResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT');
    const remaining = () => {
      const ms = deadline - performance.now();
      if (ms <= 0) throw timeout();
      return ms;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The timeout covers caller reads as well as both relation queries.
      const expired = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeout()), deps.timeoutMs);
      });
      const work = (async () => {
        await deps.authenticate(req);
        remaining(); // A late caller read must not start a target query.
        assertNoQueryOrBody(req.query as Record<string, unknown>, req.body, req.headers);
        let id: string;
        try { id = parsePrincipalIdParam(req.params.principal_id); }
        catch { throw new AgentPrincipalResolutionError(400, 'INVALID_REQUEST'); }
        const result = await deps.resolve(id, undefined, { timeoutMs: remaining() });
        remaining();
        return result;
      })();
      const result = await Promise.race([work, expired]);
      remaining();
      res.status(200).json(result);
    } catch (error) {
      const mapped = error instanceof WorkflowAdmissionAuthError
        ? error : toAgentPrincipalResolutionError(error);
      res.status(mapped.status).json({ error: mapped.code });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }));
  // CTR-IDR-003 (AUTH_SERVICE_IDENTITY_DIRECTORY_REVERSE_RESOLUTION_V1): the
  // additive reverse sibling — one exact agent_id in, the exact stored
  // Principal relation out. Same middleware, whole-operation deadline,
  // no-store and fail-closed family as the forward directory route; the input
  // grammar itself rejects malformed ids with 400 INVALID_AGENT_ID, so only
  // the exact-read can follow authentication.
  router.get('/v1/directory/agents/:agent_id/principal', asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const deadline = performance.now() + deps.timeoutMs;
    const timeout = () => new AgentPrincipalResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT');
    const remaining = () => {
      const ms = deadline - performance.now();
      if (ms <= 0) throw timeout();
      return ms;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The timeout covers caller reads as well as the relation query.
      const expired = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeout()), deps.timeoutMs);
      });
      const work = (async () => {
        await deps.authenticate(req);
        remaining(); // A late caller read must not start a target query.
        assertNoQueryOrBody(req.query as Record<string, unknown>, req.body, req.headers);
        const agentId = parseAgentIdParam(req.params.agent_id);
        const result = await deps.resolveAgentId(agentId, undefined, { timeoutMs: remaining() });
        remaining();
        return result;
      })();
      const result = await Promise.race([work, expired]);
      remaining();
      res.status(200).json(result);
    } catch (error) {
      const mapped = error instanceof WorkflowAdmissionAuthError
        ? error : toAgentPrincipalResolutionError(error);
      res.status(mapped.status).json({ error: mapped.code });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }));
  return router;
}

export const workflowAdmissionRouter = createWorkflowAdmissionRouter();
