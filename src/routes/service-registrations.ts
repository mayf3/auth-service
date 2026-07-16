import { Router } from 'express';
import { Prisma, ServiceRegistrationStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { authRequired } from '../middleware/auth.js';
import {
  isWorkflowKeyringConfigured,
  WORKFLOW_AUDIENCE,
} from '../lib/oauth/workflow-keyring.js';
import { verifyWorkflowToken } from '../lib/oauth/workflow-signer.js';

export const serviceRegistrationRouter = Router();

// All routes require authentication
serviceRegistrationRouter.use(authRequired);

// Admin guard: only role=admin or internalRole=cto
function assertAdmin(req: Express.Request): void {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  if (req.user.role !== 'admin' && req.user.internalRole !== 'cto') {
    throw new HttpError(403, 'Admin or CTO role required');
  }
}

// ─── GET / — List all service registrations ────────────────────────────
serviceRegistrationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // Any authenticated user can list services (for service discovery)
    const services = await prisma.serviceRegistration.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        serviceName: true,
        displayName: true,
        jwtAudience: true,
        allowedRoles: true,
        serviceUrl: true,
        status: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(services);
  }),
);

// ─── GET /:id — Get single service registration ────────────────────────
serviceRegistrationRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const service = await prisma.serviceRegistration.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!service) throw new HttpError(404, '服务不存在');
    res.json(service);
  }),
);

// ─── POST / — Register a new service ───────────────────────────────────
serviceRegistrationRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    assertAdmin(req);

    const {
      serviceName,
      displayName,
      jwtAudience,
      allowedRoles,
      serviceUrl,
      description,
    } = req.body as {
      serviceName: string;
      displayName: string;
      jwtAudience: string;
      allowedRoles?: string;
      serviceUrl?: string;
      description?: string;
    };

    if (!serviceName || !displayName || !jwtAudience) {
      throw new HttpError(400, 'serviceName, displayName, jwtAudience 必填');
    }

    // Check for duplicates
    const existing = await prisma.serviceRegistration.findFirst({
      where: {
        OR: [{ serviceName }, { jwtAudience }],
      },
    });
    if (existing) {
      throw new HttpError(409, `服务已存在: ${existing.serviceName} (audience: ${existing.jwtAudience})`);
    }

    const service = await prisma.serviceRegistration.create({
      data: {
        serviceName,
        displayName,
        jwtAudience,
        allowedRoles: allowedRoles || 'admin,developer,agent,requester',
        serviceUrl,
        description,
      },
    });

    res.status(201).json(service);
  }),
);

// ─── PUT /:id — Update a service registration ──────────────────────────
serviceRegistrationRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    assertAdmin(req);

    const existing = await prisma.serviceRegistration.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!existing) throw new HttpError(404, '服务不存在');

    const {
      displayName,
      jwtAudience,
      allowedRoles,
      serviceUrl,
      status,
      description,
    } = req.body as {
      displayName?: string;
      jwtAudience?: string;
      allowedRoles?: string;
      serviceUrl?: string;
      status?: ServiceRegistrationStatus;
      description?: string;
    };

    // If changing jwtAudience, check for conflicts
    if (jwtAudience && jwtAudience !== existing.jwtAudience) {
      const conflict = await prisma.serviceRegistration.findUnique({
        where: { jwtAudience },
      });
      if (conflict) throw new HttpError(409, `jwtAudience "${jwtAudience}" 已被占用`);
    }

    const data: Prisma.ServiceRegistrationUpdateInput = {};
    if (displayName !== undefined) data.displayName = displayName;
    if (jwtAudience !== undefined) data.jwtAudience = jwtAudience;
    if (allowedRoles !== undefined) data.allowedRoles = allowedRoles;
    if (serviceUrl !== undefined) data.serviceUrl = serviceUrl;
    if (status !== undefined) data.status = status;
    if (description !== undefined) data.description = description;

    const service = await prisma.serviceRegistration.update({
      where: { id: String(req.params.id) },
      data,
    });

    res.json(service);
  }),
);

// ─── DELETE /:id — Deactivate a service (soft delete) ──────────────────
serviceRegistrationRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    assertAdmin(req);

    const existing = await prisma.serviceRegistration.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!existing) throw new HttpError(404, '服务不存在');

    // Soft delete: set status to inactive
    await prisma.serviceRegistration.update({
      where: { id: String(req.params.id) },
      data: { status: 'inactive' },
    });

    res.json({ message: '服务已停用', id: String(req.params.id) });
  }),
);

// ─── GET /lookup/:audience — Service discovery endpoint ────────────────
// Public-ish: allows downstream services to check if an audience is registered
serviceRegistrationRouter.get(
  '/lookup/:audience',
  asyncHandler(async (req, res) => {
    const service = await prisma.serviceRegistration.findFirst({
      where: { jwtAudience: String(req.params.audience), status: 'active' },
      select: {
        serviceName: true,
        displayName: true,
        jwtAudience: true,
        allowedRoles: true,
        serviceUrl: true,
      },
    });
    if (!service) throw new HttpError(404, `未找到 audience="${String(req.params.audience)}" 的服务`);
    res.json(service);
  }),
);

// ─── POST /verify-token — Token verification for downstream services ────
// Accepts a JWT and optional audience, returns the verified principal.
//
// PR-A fix (plan §14 / task spec §十): route on token kind.
//   - Workflow / Machine (RS256, principal_type=agent, aud=svc-workflow)
//       → verify via RS256 keyring, look up MachinePrincipal (exists + enabled)
//   - Human User token (HS256, no principal_type) → existing behavior unchanged
serviceRegistrationRouter.post(
  '/verify-token',
  asyncHandler(async (req, res) => {
    const { token, audience } = req.body as { token: string; audience?: string };

    if (!token) throw new HttpError(400, 'token 必填');

    const jwt = await import('jsonwebtoken');
    const { env } = await import('../config/env.js');

    // ── Detect workflow machine token by header kid + configured keyring.
    //    Workflow tokens carry a `kid` header and are RS256-signed; HS256 agent
    //    tokens and user tokens carry no kid. This avoids trusting the payload
    //    (unverified) for the branch decision.
    const header = peekTokenHeader(token);
    const looksLikeWorkflow =
      header?.kid !== undefined &&
      typeof header.kid === 'string' &&
      isWorkflowKeyringConfigured();

    let payload: any;

    if (looksLikeWorkflow) {
      // RS256 workflow path — hard algorithm-confusion defense in verifyWorkflowToken.
      try {
        payload = verifyWorkflowToken(token);
      } catch {
        throw new HttpError(401, 'Token 无效或已过期');
      }

      // Machine/Agent token → look up MachinePrincipal, not User.
      const principal = await prisma.machinePrincipal.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          principalType: true,
          agentId: true,
          displayName: true,
          status: true,
        },
      });

      if (!principal) throw new HttpError(401, '主体不存在');
      if (principal.status === 'disabled') {
        throw new HttpError(403, '主体已禁用');
      }

      // Return canonical subject + non-sensitive claims. Never leak secrets,
      // private keys, full token, or DB-internal sensitive fields.
      res.json({
        valid: true,
        principal_type: principal.principalType,
        token: {
          sub: principal.id,
          aud: payload.aud,
          scope: payload.scope,
          token_use: payload.token_use,
          client_id: payload.client_id,
          agent_id: principal.agentId,
          exp: payload.exp,
        },
      });
      return;
    }

    // ── Existing HS256 path (User tokens; also legacy HS256 agent tokens that
    //    predate workflow RS256). Behavior is UNCHANGED from before PR-A.
    // If audience specified, verify the service is registered
    if (audience) {
      const service = await prisma.serviceRegistration.findFirst({
        where: { jwtAudience: audience, status: 'active' },
      });
      if (!service) throw new HttpError(403, `未注册的服务 audience: ${audience}`);
    }

    try {
      payload = jwt.verify(token, env.JWT_SECRET) as any;
    } catch {
      throw new HttpError(401, 'Token 无效或已过期');
    }

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        internalRole: true,
        okrRole: true,
        agentId: true,
      },
    });

    if (!user) throw new HttpError(401, '用户不存在');

    // If audience specified, check role is allowed
    if (audience) {
      const service = await prisma.serviceRegistration.findFirst({
        where: { jwtAudience: audience, status: 'active' },
      });
      if (service) {
        const allowedRoles = service.allowedRoles.split(',').map(r => r.trim());
        if (!allowedRoles.includes(user.role)) {
          throw new HttpError(403, `角色 "${user.role}" 无权访问服务 "${service.displayName}"`);
        }
      }
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        internalRole: user.internalRole,
        okrRole: user.okrRole,
        agentId: user.agentId,
      },
    });
  }),
);

/** Peek at a JWT header (unverified) to detect token kind. Never used for authz. */
function peekTokenHeader(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}
