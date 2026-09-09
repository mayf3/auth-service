import { Router, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import { getV1ContractSettings } from '../lib/oauth/v1/contract.js';
import { V1OAuthError } from '../lib/oauth/v1/errors.js';
import {
  AUTH_PUBLIC_ORIGIN,
  BROWSER_CSRF_FIELD_NAME,
  BROWSER_LOGIN_PATH,
  BROWSER_SESSION_COOKIE_NAME,
  BrowserLoginStore,
  MOBILE_CALLBACK_PATH,
  isBrowserCsrfTokenShape,
} from '../lib/oauth/v1/browser-login.js';
import {
  beginV1Authorization,
  completeV1Authorization,
  type BeginV1AuthorizationParams,
  type CompleteV1AuthorizationParams,
} from '../lib/oauth/v1/human-login.js';
import {
  browserAuthenticationFormSchema,
  humanAuthorizeRequestSchema,
} from '../schemas/oauth.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * First-party browser OAuth surface for AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1.
 *
 * CTR-MPO-001: GET /oauth/authorize/ui renders the first-party login page and
 * POST /oauth/authorize/ui is the credential POST. Both bind the EXISTING
 * /oauth/authorize transaction semantics (beginV1Authorization /
 * completeV1Authorization — client/audience/exact-redirect/state/S256 are
 * server-bound and never re-specified by the browser form) to a browser flow
 * with the frozen security boundary:
 *   - __Host- session cookie: Secure + HttpOnly + SameSite=Lax + Path=/, no
 *     Domain attribute, non-persistent;
 *   - server-side single-use synchronizer CSRF token in a hidden form field,
 *     constant-time compared, bound to transaction + browser session, 403 on
 *     missing/wrong/duplicated/expired/replayed/cross-transaction/
 *     cross-session tokens and on any Origin other than the exact frozen
 *     auth public origin;
 *   - every browser HTML response (login, error, redirect intermediate)
 *     carries `Content-Security-Policy: frame-ancestors 'none'`,
 *     `X-Frame-Options: DENY` and `Cache-Control: no-store`.
 *
 * CTR-MPO-004: GET /mobile/callback is only the transport for the verified
 * HTTPS App Link redirect. When a request actually reaches this server, the
 * App Link handoff did not happen, so the flow explicitly fails with an honest
 * page that never echoes the code, state or error values.
 *
 * No secret (password, CSRF token, code, verifier, credential, cookie value)
 * is ever logged by this module.
 */

export interface OauthBrowserRouteDeps {
  contractMode: 'v0' | 'v1_shadow' | 'v1';
  transactionTtlSeconds?: number;
  beginAuthorization: (
    params: BeginV1AuthorizationParams,
  ) => Promise<{ authorization_transaction_id: string; expires_in: number }>;
  completeAuthorization: (
    params: CompleteV1AuthorizationParams,
  ) => Promise<{ redirect_uri: string; state: string; code: string }>;
}

const COOKIE_OPTIONS = { path: '/', secure: true, httpOnly: true, sameSite: 'lax' } as const;

// Mount-relative route paths: the browser routers are mounted at '/oauth'
// (same convention as oauthHumanRouter), the callback router at root.
const BROWSER_LOGIN_ROUTE = '/authorize/ui';

function applyBrowserSecurityHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function setSessionCookie(res: Response, value: string): void {
  res.cookie(BROWSER_SESSION_COOKIE_NAME, value, COOKIE_OPTIONS);
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(BROWSER_SESSION_COOKIE_NAME, COOKIE_OPTIONS);
}

function readBrowserSessionCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() === BROWSER_SESSION_COOKIE_NAME) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function rawQueryContains(req: Request, value: string): boolean {
  const queryIndex = req.originalUrl.indexOf('?');
  if (queryIndex < 0) return false;
  return req.originalUrl.slice(queryIndex + 1).includes(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;'
      : ch === '<' ? '&lt;'
        : ch === '>' ? '&gt;'
          : ch === '"' ? '&quot;'
            : '&#39;'
  ));
}

function pageDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: system-ui, -apple-system, sans-serif; background: #f5f6f8; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
main { background: #fff; border-radius: 12px; padding: 32px; width: min(360px, calc(100vw - 32px)); box-shadow: 0 2px 12px rgba(0,0,0,.08); box-sizing: border-box; }
h1 { font-size: 20px; margin: 0 0 8px; }
p { font-size: 14px; color: #333; line-height: 1.6; }
label { display: block; font-size: 13px; color: #444; margin: 12px 0 4px; }
input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ccd0d6; border-radius: 8px; font-size: 15px; }
button { margin-top: 20px; width: 100%; padding: 11px; border: 0; border-radius: 8px; background: #2456f0; color: #fff; font-size: 15px; cursor: pointer; }
.notice { margin-top: 16px; font-size: 12px; color: #777; }
.error { margin-top: 8px; color: #b3261e; font-size: 13px; }
code { font-size: 12px; word-break: break-all; }
</style>
</head>
<body><main>
${bodyHtml}
</main></body>
</html>`;
}

function renderLoginPage(input: {
  transactionId: string;
  csrfToken: string;
  message?: string;
}): string {
  return pageDocument('登录 Agent Core', `
<h1>登录 Agent Core</h1>
<p>请使用您的账号登录，完成后将返回 Agent Core 应用。</p>
${input.message ? `<p class="error">${escapeHtml(input.message)}</p>` : ''}
<form method="post" action="${BROWSER_LOGIN_PATH}">
<input type="hidden" name="authorization_transaction_id" value="${escapeHtml(input.transactionId)}">
<input type="hidden" name="${BROWSER_CSRF_FIELD_NAME}" value="${escapeHtml(input.csrfToken)}">
<label for="email">邮箱</label>
<input id="email" name="email" type="email" autocomplete="username" required>
<label for="password">密码</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit">登录</button>
</form>
<p class="notice">登录仅在 auth.mayf3.com 第一方页面完成，密码不会提交给应用或其他服务。</p>`);
}

function renderErrorPage(input: { code: string; category?: string }): string {
  return pageDocument('请求无法完成', `
<h1>请求无法完成</h1>
<p>登录请求未能通过校验，请返回 Agent Core 应用重新发起登录。</p>
<p class="notice"><code>${escapeHtml(input.code)}${input.category ? `: ${escapeHtml(input.category)}` : ''}</code></p>`);
}

function renderCallbackFailurePage(): string {
  return pageDocument('登录无法在浏览器中完成', `
<h1>登录无法在浏览器中完成</h1>
<p>此链接应当由 Agent Core 应用直接打开。请返回应用并重新发起登录。</p>`);
}

function renderError(res: Response, status: number, code: string, category?: string): void {
  res.status(status).type('html').send(renderErrorPage({ code, category }));
}

function renderUnknownAwareError(res: Response, error: unknown): void {
  if (error instanceof V1OAuthError) {
    renderError(res, error.statusCode, error.message, error.category);
    return;
  }
  renderError(res, 500, 'server_error', 'internal_error');
}

export function createOauthBrowserRouters(overrides?: Partial<OauthBrowserRouteDeps>) {
  const deps = {
    contractMode: overrides?.contractMode ?? env.AUTH_CONTRACT_MODE,
    transactionTtlSeconds: overrides?.transactionTtlSeconds,
    beginAuthorization: overrides?.beginAuthorization ?? beginV1Authorization,
    completeAuthorization: overrides?.completeAuthorization ?? completeV1Authorization,
  };
  const store = new BrowserLoginStore();

  function transactionTtl(): number {
    return deps.transactionTtlSeconds
      ?? getV1ContractSettings().authorizationTransactionTtlSeconds;
  }

  const oauthBrowserRouter = Router();

  // CTR-MPO-001 — first-party browser entry: bind the existing authorize
  // transaction semantics to a server-rendered login page.
  oauthBrowserRouter.get(BROWSER_LOGIN_ROUTE, asyncHandler(async (req, res, next) => {
    if (deps.contractMode !== 'v1') {
      next();
      return;
    }
    applyBrowserSecurityHeaders(res);
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin !== AUTH_PUBLIC_ORIGIN) {
      renderError(res, 403, 'invalid_request', 'browser_origin_mismatch');
      return;
    }
    const parsed = humanAuthorizeRequestSchema.safeParse(req.query);
    if (!parsed.success) {
      renderError(res, 400, 'invalid_request', 'authorization_request_invalid');
      return;
    }
    let transaction: { authorization_transaction_id: string; expires_in: number };
    try {
      transaction = await deps.beginAuthorization({
        clientId: parsed.data.client_id,
        redirectUri: parsed.data.redirect_uri,
        audience: parsed.data.audience,
        state: parsed.data.state,
        codeChallenge: parsed.data.code_challenge,
        codeChallengeMethod: parsed.data.code_challenge_method,
      });
    } catch (error) {
      renderUnknownAwareError(res, error);
      return;
    }
    const challenge = store.open(transaction.authorization_transaction_id, transactionTtl());
    setSessionCookie(res, challenge.browserSessionId);
    res.status(200).type('html').send(renderLoginPage({
      transactionId: transaction.authorization_transaction_id,
      csrfToken: challenge.csrfToken,
    }));
  }));

  // CTR-MPO-001 — credential POST: CSRF gate runs before any credential
  // processing; failures return 403 without touching sessions, codes or the
  // transaction.
  oauthBrowserRouter.post(BROWSER_LOGIN_ROUTE, asyncHandler(async (req, res, next) => {
    if (deps.contractMode !== 'v1') {
      next();
      return;
    }
    applyBrowserSecurityHeaders(res);
    if (!(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) {
      renderError(res, 400, 'invalid_request', 'browser_form_invalid');
      return;
    }
    if (req.headers.origin !== AUTH_PUBLIC_ORIGIN) {
      renderError(res, 403, 'invalid_request', 'browser_origin_mismatch');
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const csrfToken = body[BROWSER_CSRF_FIELD_NAME];
    if (typeof csrfToken !== 'string' || !isBrowserCsrfTokenShape(csrfToken)
      || rawQueryContains(req, csrfToken)) {
      renderError(res, 403, 'invalid_request', 'browser_csrf_failure');
      return;
    }
    const transactionId = body.authorization_transaction_id;
    const browserSessionId = readBrowserSessionCookie(req);
    if (typeof transactionId !== 'string') {
      renderError(res, 403, 'invalid_request', 'browser_csrf_failure');
      return;
    }
    const consumed = store.consume({ transactionId, browserSessionId, csrfToken });
    if (consumed.outcome === 'rejected') {
      renderError(res, 403, 'invalid_request', 'browser_csrf_failure');
      return;
    }
    const parsed = browserAuthenticationFormSchema.safeParse(body);
    if (!parsed.success) {
      const challenge = store.open(transactionId, transactionTtl(), browserSessionId);
      res.status(400).type('html').send(renderLoginPage({
        transactionId,
        csrfToken: challenge.csrfToken,
        message: '提交内容无效，请重新填写。',
      }));
      return;
    }
    let completed: { redirect_uri: string; state: string; code: string };
    try {
      completed = await deps.completeAuthorization({
        authorizationTransactionId: parsed.data.authorization_transaction_id,
        email: parsed.data.email,
        password: parsed.data.password,
      });
    } catch (error) {
      if (error instanceof V1OAuthError && error.category === 'user_authentication_failed') {
        // Wrong credentials: the transaction stays pending, so re-render the
        // form with a brand-new CSRF token for the same transaction + session
        // and refuse the consumed one (CTR-MPO-001 CSRF re-render rule).
        const challenge = store.open(transactionId, transactionTtl(), browserSessionId);
        res.status(200).type('html').send(renderLoginPage({
          transactionId,
          csrfToken: challenge.csrfToken,
          message: '邮箱或密码不正确。',
        }));
        return;
      }
      store.close(transactionId);
      clearSessionCookie(res);
      renderUnknownAwareError(res, error);
      return;
    }
    // Transaction complete: invalidate the browser login state and cookie.
    store.close(transactionId);
    clearSessionCookie(res);
    const location = new URL(completed.redirect_uri);
    location.searchParams.set('code', completed.code);
    location.searchParams.set('state', completed.state);
    res.status(302).setHeader('Location', location.toString());
    res.end();
  }));

  // CTR-MPO-004 — the callback is only a transport for the verified HTTPS App
  // Link redirect. If the request reaches the server, the App Link handoff did
  // not happen, so the flow fails explicitly without echoing any value.
  const mobileCallbackRouter = Router();
  mobileCallbackRouter.get(MOBILE_CALLBACK_PATH, (req, res, next) => {
    if (deps.contractMode !== 'v1') {
      next();
      return;
    }
    applyBrowserSecurityHeaders(res);
    res.status(400).type('html').send(renderCallbackFailurePage());
  });

  return { oauthBrowserRouter, mobileCallbackRouter };
}

const prodRouters = createOauthBrowserRouters();

export const oauthBrowserRouter = prodRouters.oauthBrowserRouter;
export const mobileCallbackRouter = prodRouters.mobileCallbackRouter;
