import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions, JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      name: string;
      email: string;
      role: string;
      internalRole?: string | null;
      okrRole?: string | null;
      agentId?: string | null;
    }
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload extends JwtPayload {
  sub: string;
  type?: 'access' | 'refresh';
  iss?: string;
  aud?: string;
  jti?: string;
}

const JWT_ISSUER = env.JWT_ISSUER;
const JWT_AUDIENCE = env.JWT_AUDIENCE;
const JWT_VERSION = env.JWT_VERSION;

/**
 * Generate a random 24-char password
 */
export function generatePassword(): string {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * Sign access token — unified format for all platforms
 */
export function signAccessToken(user: Express.AuthUser): string {
  const now = Math.floor(Date.now() / 1000);
  const jti = `${user.id}-${now}-${crypto.randomBytes(4).toString('hex')}`;

  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role,
      internalRole: user.internalRole ?? undefined,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      jti,
      type: 'access',
      version: JWT_VERSION,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    } as SignOptions,
  );
}

/**
 * Sign refresh token
 */
export function signRefreshToken(user: Express.AuthUser): string {
  const now = Math.floor(Date.now() / 1000);
  const jti = `${user.id}-${now}-refresh-${crypto.randomBytes(4).toString('hex')}`;

  return jwt.sign(
    {
      sub: user.id,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      jti,
      type: 'refresh',
      version: JWT_VERSION,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    } as SignOptions,
  );
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  if (payload.type !== 'refresh') {
    throw new HttpError(401, '令牌类型错误');
  }
  return payload;
}

/**
 * Auth middleware — verifies JWT from auth-service (or legacy ADC tokens)
 *
 * Accepts tokens signed by:
 * 1. auth-service (JWT_ISSUER = "auth-service", JWT_AUDIENCE = "unified-platform")
 * 2. Legacy ADC tokens (JWT_ISSUER = "agent-dev-center", JWT_AUDIENCE = "adc-api") — backward compat
 */
export const authRequired = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    throw new HttpError(401, '请先登录');
  }

  let payload: TokenPayload;
  let verificationError: Error | null = null;

  // Try unified auth-service JWT
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as TokenPayload;
  } catch (err) {
    verificationError = err as Error;

    // Try legacy ADC JWT (backward compatibility)
    try {
      payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'agent-dev-center',
        audience: 'adc-api',
      }) as TokenPayload;
    } catch {
      // Last try: verify with secret only (for old tokens without strict issuer)
      try {
        payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      } catch {
        throw new HttpError(401, `登录状态已失效: ${verificationError?.message || '无效令牌'}`);
      }
    }
  }

  // Look up user by sub (user ID)
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

  if (!user) {
    throw new HttpError(401, '用户不存在或已被禁用');
  }

  req.user = user as Express.AuthUser;
  next();
});

export function requireRoles(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new HttpError(401, '请先登录'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, '当前角色无权执行此操作'));
    }
    return next();
  };
}
