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
import { authenticateMachineClient } from '../lib/oauth/service.js';

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
// Shared: resolve canonical MachinePrincipal from a pre-signed agent token
// ---------------------------------------------------------------------------

/**
 * Verify a pre-signed agent token and resolve the canonical MachinePrincipal.
 *
 * Unlike the Basic auth path which authenticates via machine client credentials,
 * this path verifies a pre-signed JWT signed with AGENT_TOKEN_SECRET and
 * resolves the associated MachinePrincipal by agentId.
 *
 * Throws 401 if the token is invalid, expired, or no MachinePrincipal exists.
 * Does NOT auto-create MachinePrincipals — only finds existing ones.
 */
async function resolvePrincipalFromAgentToken(token: string): Promise<{
  id: string;
  agentId: string;
  displayName: string | null;
  principalType: string;
  status: string;
}> {
  let agentPayload: { sub?: string; name?: string; role?: string; agentId?: string };
  try {
    agentPayload = jwt.verify(token, env.AGENT_TOKEN_SECRET) as typeof agentPayload;
  } catch {
    throw new HttpError(401, 'Agent Token 无效或已过期');
  }

  const agentId = agentPayload.sub || agentPayload.agentId || '';
  if (!agentId) {
    throw new HttpError(400, 'Token 缺少 agentId/sub 字段');
  }

  // Resolve canonical MachinePrincipal — do NOT auto-create
  const principal = await prisma.machinePrincipal.findUnique({
    where: { agentId },
  });
  if (!principal) {
    throw new HttpError(401, '未找到对应的 Machine Principal，请联系管理员');
  }
  if (principal.status === 'disabled') {
    throw new HttpError(401, 'Principal 已禁用');
  }

  return {
    id: principal.id,
    agentId: principal.agentId!,
    displayName: principal.displayName,
    principalType: principal.principalType,
    status: principal.status,
  };
}

// ---------------------------------------------------------------------------
// Shared: issue a canonical Forum JWT from a MachinePrincipal
// ---------------------------------------------------------------------------

/**
 * Issue a standardized Forum-scoped JWT from a verified MachinePrincipal.
 *
 * Both auth paths (Basic client_credentials and pre-signed agent token) converge
 * here, ensuring every Forum JWT has identical sub/agent_id/name semantics.
 *
 * Token claims:
 *   sub       = MachinePrincipal.id  (auth Principal UUID)
 *   agent_id  = MachinePrincipal.agentId  (stable Agent ID)
 *   name      = MachinePrincipal.displayName || agentId
 *   iss       = auth-service
 *   aud       = svc-forum
 */
function issueForumJwt(principal: {
  id: string;
  agentId: string;
  displayName: string | null;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: principal.id,
      agent_id: principal.agentId,
      name: principal.displayName || principal.agentId,
      iss: env.JWT_ISSUER,
      aud: 'svc-forum',
      principal_type: 'agent',
      client_id: 'token-login',
      scope: 'forum.read forum.write',
      iat: now,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

// ---------------------------------------------------------------------------
// POST /api/auth/token-login — Agent Token login
//
// Two authentication paths:
//   Path A (Basic auth):   client_id:client_secret via Authorization header
//   Path B (pre-signed):   pre-signed agent JWT in body.token
//
// Both paths converge to resolveCanonicalMachinePrincipal → issueForumJwt.
// ---------------------------------------------------------------------------
authRouter.post(
  '/token-login',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const isBasicAuth = authHeader.startsWith('Basic ');

    let principal: {
      id: string;
      agentId: string;
      displayName: string | null;
      principalType: string;
      status: string;
    };

    if (isBasicAuth) {
      // ── Path A: OAuth2 client_credentials via Basic auth ──────────────
      const basicMatch = authHeader.match(/^Basic\s+(.+)$/i);
      if (!basicMatch) throw new HttpError(401, '无效的 Authorization header');

      let decoded: string;
      try {
        decoded = Buffer.from(basicMatch[1], 'base64').toString('utf-8');
      } catch {
        throw new HttpError(401, '无效的 Base64 编码');
      }

      const colonIdx = decoded.indexOf(':');
      if (colonIdx === -1) throw new HttpError(401, 'Basic 格式错误，应为 client_id:client_secret');

      const clientId = decoded.slice(0, colonIdx);
      const clientSecret = decoded.slice(colonIdx + 1);

      if (!clientId || !clientSecret) {
        throw new HttpError(401, 'client_id 和 client_secret 不能为空');
      }

      // Use the shared OAuth2 authentication + authorization
      // Map errors from authenticateMachineClient (plain Error with statusCode) to HttpError
      let authResult;
      try {
        authResult = await authenticateMachineClient({
          clientId,
          clientSecret,
          resource: 'svc-forum',
          requestedScopes: ['forum.read', 'forum.write'],
        });
      } catch (clientErr: any) {
        throw new HttpError(
          clientErr.statusCode || 401,
          clientErr.message || 'Authentication failed',
        );
      }

      principal = authResult.principal;

      // Sync user record for forum user lookup
      const agentId = principal.agentId;
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ agentId }, { email: `agent:${agentId}@auth-service.local` }],
        },
      });

      if (!user) {
        const randomPwd = generatePassword();
        const hashedPassword = await bcrypt.hash(randomPwd, 10);
        user = await prisma.user.create({
          data: {
            name: principal.displayName || agentId,
            email: `agent:${agentId}@auth-service.local`,
            password: hashedPassword,
            role: 'agent',
            agentId,
          },
        });
      }

      const accessToken = issueForumJwt(principal);
      res.json({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          agentId: user.agentId,
        },
      });
    } else {
      // ── Path B: Pre-signed agent token ────────────────────────────────
      const { body } = tokenLoginSchema.parse({ body: req.body });

      if (!body.token) {
        throw new HttpError(401, '请提供 Agent Token 或使用 Basic Auth');
      }

      // Resolve canonical MachinePrincipal (no auto-create)
      principal = await resolvePrincipalFromAgentToken(body.token);

      // Find or create user for forum compatibility
      const agentId = principal.agentId;
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ agentId }, { email: `agent:${agentId}@auth-service.local` }],
        },
      });

      if (!user) {
        const randomPwd = generatePassword();
        const hashedPassword = await bcrypt.hash(randomPwd, 10);
        user = await prisma.user.create({
          data: {
            name: principal.displayName || agentId,
            email: `agent:${agentId}@auth-service.local`,
            password: hashedPassword,
            role: 'agent',
            agentId,
          },
        });
      }

      const accessToken = issueForumJwt(principal);
      res.json({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          agentId: user.agentId,
        },
      });
    }
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
