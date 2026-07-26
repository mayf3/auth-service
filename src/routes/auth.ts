import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, authRequired, generatePassword } from '../middleware/auth.js';
import { revokeRefreshToken, isRefreshTokenRevoked } from '../middleware/token-rotation.js';
import { loginSchema, tokenLoginSchema, registerSchema, changePasswordSchema, refreshTokenSchema } from '../schemas/auth.js';
import { env } from '../config/env.js';

export const authRouter = Router();

// Helper: safe user object (no password)
function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  internalRole?: string | null;
  okrRole?: string | null;
  agentId?: string | null;
}): Express.AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    internalRole: user.internalRole,
    okrRole: user.okrRole,
    agentId: user.agentId,
  };
}

// ---------------------------------------------------------------------------
// IP-based login anomaly detection (in-memory, 10-min sliding window)
// ---------------------------------------------------------------------------
const ipLoginWindow = new Map<string, { emails: Set<string>; firstAt: number }>();
const IP_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const IP_LOGIN_ALERT_THRESHOLD = 3;

function recordIpLogin(ip: string, email: string): void {
  const now = Date.now();
  let entry = ipLoginWindow.get(ip);
  if (!entry || now - entry.firstAt > IP_LOGIN_WINDOW_MS) {
    entry = { emails: new Set(), firstAt: now };
    ipLoginWindow.set(ip, entry);
  }
  entry.emails.add(email);
  if (entry.emails.size >= IP_LOGIN_ALERT_THRESHOLD) {
    console.warn(
      `[SECURITY-ALERT] IP ${ip} logged in with ${entry.emails.size} different accounts within 10 min: ${[...entry.emails].join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/login — Email/Password login
// ---------------------------------------------------------------------------
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { body } = loginSchema.parse({ body: req.body });

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      throw new HttpError(401, '邮箱或密码不正确');
    }

    const passwordMatches = await bcrypt.compare(body.password, user.password);
    if (!passwordMatches) {
      throw new HttpError(401, '邮箱或密码不正确');
    }

    const safeUser = toSafeUser(user);
    const accessToken = signAccessToken(safeUser);
    const refreshToken = signRefreshToken(safeUser);

    // IP anomaly detection
    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    recordIpLogin(clientIp, body.email);

    res.json({
      accessToken,
      refreshToken,
      user: safeUser,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/auth/token-login — Agent Token login
// ---------------------------------------------------------------------------
authRouter.post(
  '/token-login',
  asyncHandler(async (req, res) => {
    const { body } = tokenLoginSchema.parse({ body: req.body });

    // Verify the agent token using AGENT_TOKEN_SECRET
    let agentPayload: { sub?: string; name?: string; role?: string; agentId?: string };
    try {
      agentPayload = jwt.verify(body.token, env.AGENT_TOKEN_SECRET) as typeof agentPayload;
    } catch {
      throw new HttpError(401, 'Agent Token 无效或已过期');
    }

    const agentId = agentPayload.sub || agentPayload.agentId || '';
    const agentName = body.name || agentPayload.name || agentId;
    // Only allow non-privileged roles for agent auto-creation
    const allowedAgentRoles = ['agent', 'requester', 'developer'] as const;
    const agentRole = allowedAgentRoles.includes((body.role || agentPayload.role) as any)
      ? (body.role || agentPayload.role)
      : 'agent';

    if (!agentId) {
      throw new HttpError(400, 'Token 缺少 agentId/sub 字段');
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ agentId }, { email: `agent:${agentId}@auth-service.local` }],
      },
    });

    if (!user) {
      // Auto-create agent user (non-privileged role only)
      const randomPwd = generatePassword();
      const hashedPassword = await bcrypt.hash(randomPwd, 10);
      user = await prisma.user.create({
        data: {
          name: agentName,
          email: `agent:${agentId}@auth-service.local`,
          password: hashedPassword,
          role: (agentRole as any) || 'agent',
          agentId,
        },
      });
    } else {
      // Update name on login & capture updated user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: agentName },
      });
    }

    const safeUser = toSafeUser(user);
    const accessToken = signAccessToken(safeUser);
    const refreshToken = signRefreshToken(safeUser);

    res.json({
      accessToken,
      refreshToken,
      user: safeUser,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/auth/register — User registration
// SECURITY: role is ALWAYS forced to 'requester' — admin/cto_agent not allowed
// ---------------------------------------------------------------------------
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { body } = registerSchema.parse({ body: req.body });

    if (env.REGISTER_INVITE_CODE && body.inviteCode !== env.REGISTER_INVITE_CODE) {
      throw new HttpError(403, '邀请码无效');
    }

    // Auto-generate password if not provided
    const plainPassword = body.password || generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // SECURITY: Force role to 'requester' — never trust client input for role
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: 'requester',
      },
      select: {
        id: true, name: true, email: true, role: true,
        internalRole: true, okrRole: true, agentId: true,
      },
    });

    const safeUser = toSafeUser(user);
    const accessToken = signAccessToken(safeUser);
    const refreshToken = signRefreshToken(safeUser);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: safeUser,
      generatedPassword: body.password ? undefined : plainPassword,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/auth/refresh — Refresh tokens with rotation
// SECURITY: Old refresh token is revoked after use (rotation)
// ---------------------------------------------------------------------------
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { body } = refreshTokenSchema.parse({ body: req.body });

    let payload: { sub: string; jti?: string };
    try {
      payload = verifyRefreshToken(body.refreshToken) as typeof payload;
    } catch {
      throw new HttpError(401, 'Refresh token 已失效，请重新登录');
    }

    // SECURITY: Check if this refresh token has already been used (rotation)
    if (payload.jti && isRefreshTokenRevoked(payload.jti)) {
      throw new HttpError(401, 'Refresh token 已被使用，请重新登录');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, name: true, email: true, role: true,
        internalRole: true, okrRole: true, agentId: true,
      },
    });

    if (!user) {
      throw new HttpError(401, '用户不存在或已被禁用');
    }

    // SECURITY: Revoke the old refresh token
    if (payload.jti) {
      revokeRefreshToken(payload.jti);
    }

    const safeUser = toSafeUser(user);
    const accessToken = signAccessToken(safeUser);
    const newRefreshToken = signRefreshToken(safeUser);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: safeUser,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/auth/me — Token verification
// ---------------------------------------------------------------------------
authRouter.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, name: true, email: true, role: true,
        internalRole: true, okrRole: true, agentId: true,
      },
    });

    if (!user) {
      throw new HttpError(401, '用户不存在');
    }

    res.json(toSafeUser(user));
  }),
);

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------
authRouter.post(
  '/change-password',
  authRequired,
  asyncHandler(async (req, res) => {
    const { body } = changePasswordSchema.parse({ body: req.body });
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(401, '用户不存在');
    }

    const passwordMatches = await bcrypt.compare(body.oldPassword, user.password);
    if (!passwordMatches) {
      throw new HttpError(401, '当前密码不正确');
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: '密码修改成功' });
  }),
);
