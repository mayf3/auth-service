import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import {
  authorizationCodeTokenRequestSchema,
  humanAuthenticationRequestSchema,
  humanAuthorizeRequestSchema,
  humanLogoutRequestSchema,
  refreshTokenRequestSchema,
} from '../schemas/oauth.js';
import {
  beginV1Authorization,
  completeV1Authorization,
  exchangeV1AuthorizationCode,
} from '../lib/oauth/v1/human-login.js';
import {
  logoutV1HumanSession,
  refreshV1HumanSession,
} from '../lib/oauth/v1/human-refresh.js';
import { V1OAuthError } from '../lib/oauth/v1/errors.js';
import type { PresentedClientAuth } from '../lib/oauth/v1/human-support.js';
import { asyncHandler } from '../utils/async-handler.js';
import { OAuthHttpError } from '../utils/http-error.js';

export const oauthHumanRouter = Router();

const humanLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX_FAILS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'invalid_client', error_description: 'Too many requests' },
  skip: (req) => env.AUTH_CONTRACT_MODE !== 'v1' || (
    req.path === '/token'
    && req.body?.grant_type !== 'authorization_code'
    && req.body?.grant_type !== 'refresh_token'
  ),
});

function setNoStore(res: { setHeader(name: string, value: string): void }): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

function requireForm(req: Request): void {
  if (!(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) {
    throw new OAuthHttpError(400, 'invalid_request');
  }
}

function parseClientAuth(req: Request): PresentedClientAuth | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
  if (!match) throw new V1OAuthError('invalid_client', 'human_client_authentication_failed');
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 1 || separator === decoded.length - 1) {
    throw new V1OAuthError('invalid_client', 'human_client_authentication_failed');
  }
  return {
    clientId: decoded.slice(0, separator),
    clientSecret: decoded.slice(separator + 1),
  };
}

function asHttpError(error: unknown): Error {
  if (error instanceof V1OAuthError) {
    return new OAuthHttpError(error.statusCode, error.message);
  }
  return new OAuthHttpError(500, 'server_error');
}

function requestId(): string {
  return `human-${randomUUID()}`;
}

oauthHumanRouter.get('/authorize', humanLimiter, asyncHandler(async (req, res, next) => {
  if (env.AUTH_CONTRACT_MODE !== 'v1') return next();
  setNoStore(res);
  const parsed = humanAuthorizeRequestSchema.safeParse(req.query);
  if (!parsed.success) throw new OAuthHttpError(400, 'invalid_request');
  try {
    const result = await beginV1Authorization({
      clientId: parsed.data.client_id,
      redirectUri: parsed.data.redirect_uri,
      audience: parsed.data.audience,
      state: parsed.data.state,
      codeChallenge: parsed.data.code_challenge,
      codeChallengeMethod: parsed.data.code_challenge_method,
    });
    res.json(result);
  } catch (error) {
    throw asHttpError(error);
  }
}));

oauthHumanRouter.post(
  '/authorize/authenticate',
  humanLimiter,
  asyncHandler(async (req, res, next) => {
    if (env.AUTH_CONTRACT_MODE !== 'v1') return next();
    setNoStore(res);
    requireForm(req);
    const parsed = humanAuthenticationRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new OAuthHttpError(400, 'invalid_request');
    try {
      const result = await completeV1Authorization({
        authorizationTransactionId: parsed.data.authorization_transaction_id,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      const location = new URL(result.redirect_uri);
      location.searchParams.set('code', result.code);
      location.searchParams.set('state', result.state);
      res.status(302).setHeader('Location', location.toString());
      res.end();
    } catch (error) {
      throw asHttpError(error);
    }
  }),
);

oauthHumanRouter.post('/token', humanLimiter, asyncHandler(async (req, res, next) => {
  if (env.AUTH_CONTRACT_MODE !== 'v1') return next();
  const grantType = req.body?.grant_type;
  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') return next();
  setNoStore(res);
  requireForm(req);
  try {
    const clientAuth = parseClientAuth(req);
    if (grantType === 'authorization_code') {
      const parsed = authorizationCodeTokenRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw new V1OAuthError('invalid_request');
      const result = await exchangeV1AuthorizationCode({
        code: parsed.data.code,
        redirectUri: parsed.data.redirect_uri,
        clientId: parsed.data.client_id,
        codeVerifier: parsed.data.code_verifier,
        clientAuth,
        requestId: requestId(),
      });
      res.json(result);
      return;
    }
    const parsed = refreshTokenRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new V1OAuthError('invalid_request');
    const result = await refreshV1HumanSession({
      refreshToken: parsed.data.refresh_token,
      clientId: parsed.data.client_id,
      resource: parsed.data.resource,
      clientAuth,
      requestId: requestId(),
    });
    res.json(result);
  } catch (error) {
    throw asHttpError(error);
  }
}));

oauthHumanRouter.post('/logout', humanLimiter, asyncHandler(async (req, res, next) => {
  if (env.AUTH_CONTRACT_MODE !== 'v1') return next();
  setNoStore(res);
  requireForm(req);
  const parsed = humanLogoutRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new OAuthHttpError(400, 'invalid_request');
  try {
    await logoutV1HumanSession({
      refreshToken: parsed.data.refresh_token,
      clientId: parsed.data.client_id,
      clientAuth: parseClientAuth(req),
      requestId: requestId(),
    });
    res.status(204).end();
  } catch (error) {
    throw asHttpError(error);
  }
}));
