/**
 * First-party browser OAuth surface tests
 * (AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1 — CTR-MPO-001 browser login security
 * boundary, CTR-MPO-004 App Link callback transport).
 *
 * Mirrors workflow-jwks-endpoint.test.ts: routers mounted on an ephemeral
 * node:http server, no supertest dependency. beginV1Authorization /
 * completeV1Authorization are injected as recording stubs so this suite never
 * touches a database; the real transaction semantics behind those stubs are
 * covered by the V1 contract suites (tests/oauth/v1-*.test.ts) and the DB
 * e2e (tests/oauth/human-v1-db-e2e.mjs).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import {
  browserAuthenticationFormSchema,
} from '../../src/schemas/oauth.js';
import {
  AUTH_PUBLIC_ORIGIN,
  BROWSER_SESSION_COOKIE_NAME,
  BrowserLoginStore,
} from '../../src/lib/oauth/v1/browser-login.js';
import type {
  BeginV1AuthorizationParams,
  CompleteV1AuthorizationParams,
} from '../../src/lib/oauth/v1/human-login.js';
import { V1OAuthError } from '../../src/lib/oauth/v1/errors.js';
import { createOauthBrowserRouters } from '../../src/routes/oauth-browser.js';

const REDIRECT_URI = 'https://auth.mayf3.com/mobile/callback';
const CLIENT_ID = 'agent-core-mobile-android-v1';
const AUDIENCE = 'agent-core-mobile-gateway-v1';
const CODE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const STATE_VALUE = 'st-9f2Ab~c+d eF';
const TXN_ID = '7e6a3b22-9df1-4a0f-9c8a-4b1d2c3a4e5f';
const TXN_ID_B = '8a4c1d02-3b7e-4c8f-b1a0-5e2f6a7b8c9d';
const CODE_VALUE = 'ac1.9f0d2a44-6c31-4f7e-a2b9-3c5d6e7f8a9b.E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const EMAIL = 'user@example.com';
const PASSWORD = 'correct-horse-battery-staple';

const VALID_AUTHORIZE_QUERY = new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  audience: AUDIENCE,
  state: STATE_VALUE,
  code_challenge: CODE_CHALLENGE,
  code_challenge_method: 'S256',
}).toString();

interface TestResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

interface AppHandle {
  beginCalls: BeginV1AuthorizationParams[];
  completeCalls: CompleteV1AuthorizationParams[];
  start(): Promise<number>;
  stop(): Promise<void>;
}

function buildApp(options: {
  contractMode?: 'v0' | 'v1_shadow' | 'v1';
  beginError?: V1OAuthError;
  plainBeginError?: Error;
  beginTransactionIdSequence?: string[];
  completeError?: V1OAuthError;
  completeFailureCount?: number;
} = {}): AppHandle {
  const beginCalls: BeginV1AuthorizationParams[] = [];
  const completeCalls: CompleteV1AuthorizationParams[] = [];
  let beginCount = 0;
  let completeAttempts = 0;
  const routers = createOauthBrowserRouters({
    contractMode: options.contractMode ?? 'v1',
    transactionTtlSeconds: 600,
    beginAuthorization: async (params) => {
      beginCalls.push(params);
      if (options.plainBeginError) throw options.plainBeginError;
      if (options.beginError) throw options.beginError;
      beginCount += 1;
      const transactionId = options.beginTransactionIdSequence?.[beginCount - 1] ?? TXN_ID;
      return { authorization_transaction_id: transactionId, expires_in: 600 };
    },
    completeAuthorization: async (params) => {
      completeAttempts += 1;
      completeCalls.push(params);
      if (options.completeError && completeAttempts <= (options.completeFailureCount ?? 1)) {
        throw options.completeError;
      }
      return { redirect_uri: REDIRECT_URI, state: STATE_VALUE, code: CODE_VALUE };
    },
  });
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use('/oauth', routers.oauthBrowserRouter);
  app.use(routers.mobileCallbackRouter);
  let server: http.Server | undefined;
  return {
    beginCalls,
    completeCalls,
    start(): Promise<number> {
      return new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => resolve((server!.address() as AddressInfo).port));
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => server!.close(() => resolve()));
    },
  };
}

function httpRequest(
  port: number,
  method: 'GET' | 'POST',
  path: string,
  input: { headers?: Record<string, string>; body?: string } = {},
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method, headers: input.headers ?? {} },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
      },
    );
    req.on('error', reject);
    if (input.body !== undefined) req.write(input.body);
    req.end();
  });
}

function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

async function beginLogin(port: number, origin?: string): Promise<{
  res: TestResponse;
  csrfToken: string;
  cookie: string;
}> {
  const headers: Record<string, string> = {};
  if (origin !== undefined) headers.Origin = origin;
  const res = await httpRequest(port, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`, { headers });
  assert.equal(res.status, 200);
  const csrfToken = /name="csrf_token" value="([^"]+)"/.exec(res.body)?.[1];
  assert.ok(csrfToken, 'login page must carry a csrf_token hidden field');
  const cookie = res.headers['set-cookie']?.[0];
  assert.ok(cookie, 'login page must set the __Host- session cookie');
  return { res, csrfToken, cookie: cookie.split(';')[0] };
}

async function postCredential(
  port: number,
  input: {
    cookie?: string | null;
    origin?: string | null;
    transactionId?: string;
    csrfToken?: string | null;
    email?: string;
    password?: string;
    rawBody?: string;
    queryString?: string;
  } = {},
): Promise<TestResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (input.cookie !== null) headers.Cookie = input.cookie ?? '';
  if (input.origin !== null) headers.Origin = input.origin ?? AUTH_PUBLIC_ORIGIN;
  const body = input.rawBody ?? formBody({
    authorization_transaction_id: input.transactionId ?? TXN_ID,
    csrf_token: input.csrfToken ?? '',
    email: input.email ?? EMAIL,
    password: input.password ?? PASSWORD,
  });
  return httpRequest(port, 'POST', `/oauth/authorize/ui${input.queryString ?? ''}`, { headers, body });
}

function assertFramingAndNoStore(res: TestResponse): void {
  assert.equal(res.headers['content-security-policy'], "frame-ancestors 'none'");
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.match(String(res.headers['cache-control']), /no-store/);
}

function setCookieOf(res: TestResponse): string {
  const cookie = res.headers['set-cookie']?.[0];
  assert.ok(cookie, 'expected a Set-Cookie header');
  return cookie;
}

function assertHostCookieAttributes(cookie: string): void {
  assert.ok(cookie.startsWith(`${BROWSER_SESSION_COOKIE_NAME}=`));
  const lower = cookie.toLowerCase();
  assert.ok(lower.includes('secure'), 'cookie must be Secure');
  assert.ok(lower.includes('httponly'), 'cookie must be HttpOnly');
  assert.ok(lower.includes('samesite=lax'), 'cookie must be SameSite=Lax');
  assert.ok(/(^|;)\s*path=\/(?=;|$)/i.test(cookie), 'cookie must be Path=/');
  assert.equal(/domain=/.test(lower), false, 'cookie must have no Domain attribute');
  assert.equal(/max-age|expires=/.test(lower), false, 'login cookie must be a session cookie');
}

describe('GET /oauth/authorize/ui — first-party browser entry (CTR-MPO-001)', () => {
  let app: AppHandle;
  let port: number;
  beforeEach(async () => {
    app = buildApp();
    port = await app.start();
  });
  afterEach(async () => {
    await app.stop();
  });

  it('renders the login form bound to a server-side transaction with the frozen security headers', async () => {
    const { res, csrfToken } = await beginLogin(port);
    assert.equal(res.status, 200);
    assert.match(String(res.headers['content-type']), /text\/html/);
    assertFramingAndNoStore(res);
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    // Existing /oauth/authorize transaction semantics receive the request verbatim.
    assert.equal(app.beginCalls.length, 1);
    assert.deepEqual(app.beginCalls[0], {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      audience: AUDIENCE,
      state: STATE_VALUE,
      codeChallenge: CODE_CHALLENGE,
      codeChallengeMethod: 'S256',
    });
    assert.match(res.body, /<form method="post" action="\/oauth\/authorize\/ui">/);
    assert.match(csrfToken, /^[A-Za-z0-9_-]{43}$/, 'CSRF token must be >=128-bit base64url');
    assert.match(res.body, new RegExp(`name="authorization_transaction_id" value="${TXN_ID}"`));
    assertHostCookieAttributes(setCookieOf(res));
  });

  it('accepts top-level navigation (no Origin header) and the exact frozen origin', async () => {
    const navigation = await httpRequest(port, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
    assert.equal(navigation.status, 200);
    const exact = await beginLogin(port, AUTH_PUBLIC_ORIGIN);
    assert.equal(exact.res.status, 200);
  });

  it('rejects a present but non-exact Origin with 403 before any transaction', async () => {
    const res = await httpRequest(port, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(res.status, 403);
    assertFramingAndNoStore(res);
    assert.equal(res.headers['set-cookie'], undefined);
    assert.equal(app.beginCalls.length, 0);
  });

  it('fails honest and closed on invalid authorization requests (missing state, plain PKCE, short challenge)', async () => {
    for (const mutate of [
      (q: URLSearchParams) => q.delete('state'),
      (q: URLSearchParams) => q.set('code_challenge_method', 'plain'),
      (q: URLSearchParams) => q.set('code_challenge', 'tooshort'),
      (q: URLSearchParams) => q.delete('code_challenge'),
      (q: URLSearchParams) => q.set('response_type', 'token'),
    ]) {
      const query = new URLSearchParams(VALID_AUTHORIZE_QUERY);
      mutate(query);
      const res = await httpRequest(port, 'GET', `/oauth/authorize/ui?${query.toString()}`);
      assert.equal(res.status, 400, `expected 400 for ${query.toString()}`);
      assertFramingAndNoStore(res);
      assert.match(res.body, /authorization_request_invalid/);
      assert.equal(res.headers['set-cookie'], undefined);
    }
    assert.equal(app.beginCalls.length, 0, 'invalid requests must not reach the transaction');
  });

  it('renders an honest error page when the authorize transaction is rejected (redirect not registered, unknown client)', async () => {
    const rejectRedirect = buildApp({
      beginError: new V1OAuthError('invalid_request', 'redirect_uri_not_registered'),
    });
    const portA = await rejectRedirect.start();
    try {
      const res = await httpRequest(portA, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      assert.equal(res.status, 400);
      assertFramingAndNoStore(res);
      assert.match(res.body, /redirect_uri_not_registered/);
      assert.equal(res.headers['set-cookie'], undefined);
    } finally {
      await rejectRedirect.stop();
    }
    const rejectClient = buildApp({
      beginError: new V1OAuthError('invalid_client', 'human_client_unknown'),
    });
    const portB = await rejectClient.start();
    try {
      const res = await httpRequest(portB, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      assert.equal(res.status, 401);
      assert.match(res.body, /human_client_unknown/);
    } finally {
      await rejectClient.stop();
    }
  });

  it('renders honest error pages for OAuth and unexpected failures without leaking internals', async () => {
    const unavailable = buildApp({
      beginError: new V1OAuthError('temporarily_unavailable', 'human_client_profile_invalid'),
    });
    const unavailablePort = await unavailable.start();
    try {
      const res = await httpRequest(unavailablePort, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      assert.equal(res.status, 503);
      assertFramingAndNoStore(res);
      assert.doesNotMatch(res.body, /at .+:\d+/); // no stack traces
      assert.equal(res.headers['set-cookie'], undefined);
    } finally {
      await unavailable.stop();
    }
    const broken = buildApp({ plainBeginError: new Error('database connection refused: secret-host:5432') });
    const brokenPort = await broken.start();
    try {
      const res = await httpRequest(brokenPort, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      assert.equal(res.status, 500);
      assertFramingAndNoStore(res);
      assert.match(res.body, /server_error/);
      assert.doesNotMatch(res.body, /database connection refused/);
      assert.doesNotMatch(res.body, /secret-host/);
      assert.equal(res.headers['set-cookie'], undefined);
    } finally {
      await broken.stop();
    }
  });

  it('is inactive outside v1 contract mode', async () => {
    const legacy = buildApp({ contractMode: 'v0' });
    const legacyPort = await legacy.start();
    try {
      const res = await httpRequest(legacyPort, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      assert.equal(res.status, 404);
      assert.equal(legacy.beginCalls.length, 0);
    } finally {
      await legacy.stop();
    }
  });
});

describe('POST /oauth/authorize/ui — credential POST CSRF gate (CTR-MPO-001)', () => {
  let app: AppHandle;
  let port: number;
  beforeEach(async () => {
    app = buildApp();
    port = await app.start();
  });
  afterEach(async () => {
    await app.stop();
  });

  it('redirects to the exact registered URI with verbatim code+state on the happy path', async () => {
    const { csrfToken, cookie } = await beginLogin(port);
    const res = await postCredential(port, { csrfToken, cookie });
    assert.equal(res.status, 302);
    assertFramingAndNoStore(res);
    const location = String(res.headers.location);
    assert.ok(location.startsWith(`${REDIRECT_URI}?`), `Location must be the exact registered URI, got ${location}`);
    const parsed = new URL(location);
    assert.equal(`${parsed.origin}${parsed.pathname}`, REDIRECT_URI);
    assert.equal(parsed.search, `?code=${encodeURIComponent(CODE_VALUE)}&state=st-9f2Ab%7Ec%2Bd+eF`);
    assert.equal(parsed.searchParams.get('code'), CODE_VALUE);
    assert.equal(parsed.searchParams.get('state'), STATE_VALUE, 'state must be returned verbatim');
    assert.equal(app.completeCalls.length, 1);
    assert.deepEqual(app.completeCalls[0], {
      authorizationTransactionId: TXN_ID,
      email: EMAIL,
      password: PASSWORD,
    });
    const cleared = setCookieOf(res).toLowerCase();
    assert.ok(cleared.includes(`${BROWSER_SESSION_COOKIE_NAME.toLowerCase()}=`));
    assert.ok(/max-age=0|expires=thu, 01 jan 1970/.test(cleared), 'completion must invalidate the cookie');
  });

  it('replays of a consumed token fail 403 even with a correct form and state', async () => {
    const { csrfToken, cookie } = await beginLogin(port);
    const first = await postCredential(port, { csrfToken, cookie });
    assert.equal(first.status, 302);
    const replay = await postCredential(port, { csrfToken, cookie });
    assert.equal(replay.status, 403);
    assertFramingAndNoStore(replay);
    assert.equal(app.completeCalls.length, 1, 'replayed POST must not re-enter credential processing');
  });

  it('returns 403 for missing, wrong, duplicated and URL-placed tokens with zero credential processing', async () => {
    const { csrfToken, cookie } = await beginLogin(port);
    const cases: Array<Partial<Parameters<typeof postCredential>[1]>> = [
      { csrfToken: null }, // missing token field
      { csrfToken: 'A'.repeat(43) }, // wrong token, correct form and state
      { rawBody: formBody({ authorization_transaction_id: TXN_ID, email: EMAIL, password: PASSWORD }) },
      {
        rawBody: `${formBody({ authorization_transaction_id: TXN_ID, csrf_token: csrfToken, email: EMAIL, password: PASSWORD })}&csrf_token=${csrfToken}`,
      }, // duplicated token field in the raw request
      { queryString: `?csrf_token=${csrfToken}` }, // token also placed in the URL
    ];
    for (const input of cases) {
      const res = await postCredential(port, { cookie, ...input });
      assert.equal(res.status, 403, `expected 403 for case ${JSON.stringify(input)}`);
      assertFramingAndNoStore(res);
    }
    assert.equal(app.completeCalls.length, 0, 'no CSRF-failed request may reach password verification');
  });

  it('returns 403 for missing or non-exact Origin on the credential POST', async () => {
    const { csrfToken, cookie } = await beginLogin(port);
    const missing = await postCredential(port, { csrfToken, cookie, origin: null });
    assert.equal(missing.status, 403);
    const wrong = await postCredential(port, { csrfToken, cookie, origin: 'https://evil.example' });
    assert.equal(wrong.status, 403);
    const lookalike = await postCredential(port, { csrfToken, cookie, origin: 'https://auth.mayf3.com.evil.example' });
    assert.equal(lookalike.status, 403);
    assert.equal(app.completeCalls.length, 0);
  });

  it('returns 403 when the browser session cookie is missing or bound to another session', async () => {
    const { csrfToken } = await beginLogin(port);
    const noCookie = await postCredential(port, { csrfToken, cookie: null });
    assert.equal(noCookie.status, 403);
    const forged = await postCredential(port, { csrfToken, cookie: `${BROWSER_SESSION_COOKIE_NAME}=${crypto.randomBytes(32).toString('base64url')}` });
    assert.equal(forged.status, 403);
    assert.equal(app.completeCalls.length, 0);
  });

  it('returns 403 for a token bound to another authorization transaction', async () => {
    const twoTransactions = buildApp({
      beginTransactionIdSequence: [TXN_ID, TXN_ID_B],
    });
    const twoTxnPort = await twoTransactions.start();
    try {
      const first = await httpRequest(twoTxnPort, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      const tokenA = /name="csrf_token" value="([^"]+)"/.exec(first.body)![1];
      const cookieA = first.headers['set-cookie']![0].split(';')[0];
      const second = await httpRequest(twoTxnPort, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      const tokenB = /name="csrf_token" value="([^"]+)"/.exec(second.body)![1];
      const cookieB = second.headers['set-cookie']![0].split(';')[0];
      // Transaction B's form coordinates with transaction A's token.
      const crossTxn = await postCredential(twoTxnPort, {
        csrfToken: tokenA,
        cookie: cookieB,
        transactionId: TXN_ID_B,
      });
      assert.equal(crossTxn.status, 403);
      // A's own token must still work for A's own transaction + session.
      const own = await postCredential(twoTxnPort, {
        csrfToken: tokenA,
        cookie: cookieA,
        transactionId: TXN_ID,
      });
      assert.equal(own.status, 302);
      assert.equal(twoTransactions.completeCalls.length, 1);
    } finally {
      await twoTransactions.stop();
    }
  });

  it('re-renders the form with a fresh token after wrong credentials and refuses the consumed token', async () => {
    const failing = buildApp({
      completeError: new V1OAuthError('invalid_grant', 'user_authentication_failed'),
      completeFailureCount: 1,
    });
    const failingPort = await failing.start();
    try {
      const begin = await httpRequest(failingPort, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      const oldToken = /name="csrf_token" value="([^"]+)"/.exec(begin.body)![1];
      const cookie = begin.headers['set-cookie']![0].split(';')[0];
      const failed = await postCredential(failingPort, { csrfToken: oldToken, cookie });
      assert.equal(failed.status, 200);
      assertFramingAndNoStore(failed);
      assert.match(failed.body, /邮箱或密码不正确/);
      const freshToken = /name="csrf_token" value="([^"]+)"/.exec(failed.body)?.[1];
      assert.ok(freshToken, 're-rendered form must carry a token');
      assert.notEqual(freshToken, oldToken, 're-rendered form must use a brand-new CSRF token');
      assert.equal(failing.completeCalls.length, 1);
      const replayOld = await postCredential(failingPort, { csrfToken: oldToken, cookie });
      assert.equal(replayOld.status, 403);
      const retry = await postCredential(failingPort, { csrfToken: freshToken!, cookie });
      assert.equal(retry.status, 302);
      assert.equal(failing.completeCalls.length, 2);
    } finally {
      await failing.stop();
    }
  });

  it('re-renders with a fresh token for malformed submissions and refuses the consumed token', async () => {
    const { csrfToken, cookie } = await beginLogin(port);
    const malformed = await postCredential(port, { csrfToken, cookie, email: 'not-an-email' });
    assert.equal(malformed.status, 400);
    assertFramingAndNoStore(malformed);
    const freshToken = /name="csrf_token" value="([^"]+)"/.exec(malformed.body)?.[1];
    assert.ok(freshToken);
    assert.notEqual(freshToken, csrfToken);
    const replayOld = await postCredential(port, { csrfToken, cookie });
    assert.equal(replayOld.status, 403);
    const retry = await postCredential(port, { csrfToken: freshToken!, cookie });
    assert.equal(retry.status, 302);
  });

  it('fails closed with an honest error page and cookie invalidation when the transaction is dead', async () => {
    const failing = buildApp({
      completeError: new V1OAuthError('invalid_grant', 'authorization_transaction_invalid'),
    });
    const failingPort = await failing.start();
    try {
      const begin = await httpRequest(failingPort, 'GET', `/oauth/authorize/ui?${VALID_AUTHORIZE_QUERY}`);
      const csrfToken = /name="csrf_token" value="([^"]+)"/.exec(begin.body)![1];
      const cookie = begin.headers['set-cookie']![0].split(';')[0];
      const res = await postCredential(failingPort, { csrfToken, cookie });
      assert.equal(res.status, 400);
      assertFramingAndNoStore(res);
      assert.match(res.body, /authorization_transaction_invalid/);
      const cleared = setCookieOf(res).toLowerCase();
      assert.ok(/max-age=0|expires=thu, 01 jan 1970/.test(cleared), 'dead transaction must invalidate the cookie');
      assert.equal(failing.completeCalls.length, 1);
    } finally {
      await failing.stop();
    }
  });

  it('does not log on any browser code path', async () => {
    const { csrfToken, cookie } = await beginLogin(port);
    await postCredential(port, { csrfToken, cookie });
    await postCredential(port, { csrfToken: null });
    const source = fs.readFileSync('src/routes/oauth-browser.ts', 'utf8');
    const storeSource = fs.readFileSync('src/lib/oauth/v1/browser-login.ts', 'utf8');
    assert.equal(/console\./.test(source), false, 'browser route must not log');
    assert.equal(/console\./.test(storeSource), false, 'browser store must not log');
    assert.ok(storeSource.includes('crypto.timingSafeEqual'), 'CSRF comparison must be timingSafeEqual');
  });
});

describe('GET /mobile/callback — verified HTTPS App Link transport (CTR-MPO-004)', () => {
  it('fails explicitly without echoing code, state or error values', async () => {
    const app = buildApp();
    const port = await app.start();
    try {
      const path = `/mobile/callback?code=${encodeURIComponent(CODE_VALUE)}&state=${encodeURIComponent(STATE_VALUE)}&error=access_denied`;
      const res = await httpRequest(port, 'GET', path);
      assert.equal(res.status, 400);
      assertFramingAndNoStore(res);
      assert.doesNotMatch(res.body, new RegExp(CODE_VALUE.replaceAll('.', '\\.')));
      assert.doesNotMatch(res.body, /st-9f2Ab/);
      assert.doesNotMatch(res.body, /access_denied/);
      assert.match(res.body, /返回应用|重新发起登录/);
    } finally {
      await app.stop();
    }
  });
});

describe('BrowserLoginStore — server-side synchronizer token unit behavior', () => {
  it('issues 256-bit tokens and accepts consumption exactly once', () => {
    const store = new BrowserLoginStore();
    const challenge = store.open(TXN_ID, 600);
    assert.match(challenge.csrfToken, /^[A-Za-z0-9_-]{43}$/);
    assert.match(challenge.browserSessionId, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(store.consume({
      transactionId: TXN_ID,
      browserSessionId: challenge.browserSessionId,
      csrfToken: challenge.csrfToken,
    }).outcome, 'accepted');
    const replay = store.consume({
      transactionId: TXN_ID,
      browserSessionId: challenge.browserSessionId,
      csrfToken: challenge.csrfToken,
    });
    assert.deepEqual(replay, { outcome: 'rejected', reason: 'token_replayed' });
  });

  it('rejects expired, cross-session, unknown and replaced tokens', () => {
    const store = new BrowserLoginStore();
    const expired = store.open(TXN_ID, 0);
    assert.deepEqual(store.consume({
      transactionId: TXN_ID,
      browserSessionId: expired.browserSessionId,
      csrfToken: expired.csrfToken,
    }), { outcome: 'rejected', reason: 'token_expired' });

    const active = store.open(TXN_ID, 600);
    assert.deepEqual(store.consume({
      transactionId: TXN_ID,
      browserSessionId: null,
      csrfToken: active.csrfToken,
    }), { outcome: 'rejected', reason: 'session_mismatch' });
    assert.deepEqual(store.consume({
      transactionId: 'unknown-transaction',
      browserSessionId: active.browserSessionId,
      csrfToken: active.csrfToken,
    }), { outcome: 'rejected', reason: 'token_invalid' });
    assert.deepEqual(store.consume({
      transactionId: TXN_ID,
      browserSessionId: active.browserSessionId,
      csrfToken: 'A'.repeat(43),
    }), { outcome: 'rejected', reason: 'token_invalid' });

    const replacement = store.open(TXN_ID, 600, active.browserSessionId);
    assert.equal(replacement.browserSessionId, active.browserSessionId, 're-render keeps the browser session');
    assert.notEqual(replacement.csrfToken, active.csrfToken);
    assert.deepEqual(store.consume({
      transactionId: TXN_ID,
      browserSessionId: active.browserSessionId,
      csrfToken: active.csrfToken,
    }), { outcome: 'rejected', reason: 'token_invalid' });
  });

  it('drops state on close so a completed transaction cannot continue the flow', () => {
    const store = new BrowserLoginStore();
    const challenge = store.open(TXN_ID, 600);
    store.close(TXN_ID);
    assert.deepEqual(store.consume({
      transactionId: TXN_ID,
      browserSessionId: challenge.browserSessionId,
      csrfToken: challenge.csrfToken,
    }), { outcome: 'rejected', reason: 'token_invalid' });
  });
});

describe('browser authentication form schema', () => {
  const valid = {
    authorization_transaction_id: TXN_ID,
    email: EMAIL,
    password: PASSWORD,
    csrf_token: CODE_CHALLENGE,
  };

  it('accepts the exact four-field form and rejects missing/malformed/extra fields', () => {
    assert.equal(browserAuthenticationFormSchema.safeParse(valid).success, true);
    assert.equal(browserAuthenticationFormSchema.safeParse({ ...valid, csrf_token: undefined }).success, false);
    assert.equal(browserAuthenticationFormSchema.safeParse({ ...valid, csrf_token: 'short' }).success, false);
    assert.equal(browserAuthenticationFormSchema.safeParse({ ...valid, csrf_token: ['a', 'b'] }).success, false);
    assert.equal(browserAuthenticationFormSchema.safeParse({ ...valid, state: 'extra' }).success, false);
    assert.equal(browserAuthenticationFormSchema.safeParse({ ...valid, email: 'not-an-email' }).success, false);
  });
});
