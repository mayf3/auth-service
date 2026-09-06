import { performance } from 'node:perf_hooks';
import { Router, type Request } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import {
  authenticateWorkflowAdmission, WorkflowAdmissionAuthError,
} from '../middleware/v1-workflow-admission-auth.js';
import {
  AgentPrincipalResolutionError, assertNoQueryOrBody, parsePrincipalIdParam,
  resolveAgentPrincipalById, toAgentPrincipalResolutionError,
} from '../lib/oauth/v1/agent-principal-resolution.js';

interface Dependencies {
  authenticate: (req: Request) => Promise<void>;
  resolve: typeof resolveAgentPrincipalById;
  timeoutMs: number;
}

export function createWorkflowAdmissionRouter(overrides: Partial<Dependencies> = {}): Router {
  const deps: Dependencies = {
    authenticate: authenticateWorkflowAdmission, resolve: resolveAgentPrincipalById,
    timeoutMs: 5000, ...overrides,
  };
  if (!(deps.timeoutMs > 0 && deps.timeoutMs <= 5000)) throw new Error('Invalid admission deadline');
  const router = Router();
  router.get('/v1/workflow-admission/principals/:principal_id/agent', asyncHandler(async (req, res) => {
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
  return router;
}

export const workflowAdmissionRouter = createWorkflowAdmissionRouter();
