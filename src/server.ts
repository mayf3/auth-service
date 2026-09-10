import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { serviceRegistrationRouter } from './routes/service-registrations.js';
import { usersRouter } from './routes/users.js';
import { rolesRouter } from './routes/roles.js';
import { oauthRouter } from './routes/oauth.js';
import { oauthHumanRouter } from './routes/oauth-human.js';
import { mobileCallbackRouter, oauthBrowserRouter } from './routes/oauth-browser.js';
import { AUTH_PUBLIC_ORIGIN } from './lib/oauth/v1/browser-login.js';
import { wellKnownRouter } from './routes/well-known.js';
import { idempotentRouter } from './routes/idempotent.js';
import { agentPrincipalRouter } from './routes/agent-principals.js';
import { workflowAdmissionRouter } from './routes/workflow-admission.js';
import { HttpError, OAuthHttpError } from './utils/http-error.js';
import { prisma } from './lib/prisma.js';
import { startCleanup } from './middleware/token-rotation.js';
import { initializeAuthContract } from './lib/oauth/v1/contract.js';
import { initializeV1TokenIssuer } from './lib/oauth/v1/signer.js';

const app = express();

// CTR-AH-EDGE-002 (AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1): trust EXACTLY one
// loopback reverse-proxy hop when running behind the public hosting edge
// (AUTH_TRUST_PROXY_HOPS=1). req.ip — and therefore every express-rate-limit
// identity — then derives from the single edge-injected X-Forwarded-For entry
// ($remote_addr; the edge deletes all client-supplied forwarding headers), so
// public clients keep independent rate-limit identities and the loopback
// tunnel address is never a public request's rate-limit key. With the default
// 0 the setting stays untouched (`false`): behavior is byte-identical to
// existing local deployments, and a client-supplied X-Forwarded-For can never
// influence identity. `trust proxy = true` is deliberately not expressible.
if (env.AUTH_TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', env.AUTH_TRUST_PROXY_HOPS);
}

const authContract = initializeAuthContract(env.AUTH_CONTRACT_MODE);
if (env.AUTH_CONTRACT_MODE !== 'v0') initializeV1TokenIssuer();

// ─── Security Middleware ────────────────────────────────────────────────

// P1-6: Helmet — security response headers
app.use(helmet({
  contentSecurityPolicy: false, // API service, no CSP needed
  crossOriginEmbedderPolicy: false,
}));

// P0-3: CORS — whitelist only, no wildcard with credentials
// CTR-MPO-001 (AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1): the first-party browser
// UI and its credential POST use only the frozen auth public origin, so that
// origin must be accepted for same-origin form POSTs on the browser surface.
const allowedOrigins = env.CORS_ORIGINS.includes(AUTH_PUBLIC_ORIGIN)
  ? env.CORS_ORIGINS
  : [...env.CORS_ORIGINS, AUTH_PUBLIC_ORIGIN];
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Log rejected origins for debugging
    console.warn(`[CORS] Rejected origin: ${origin}`);
    callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// OAuth success, error and rate-limit responses must never be cached. This is
// intentionally before the global limiter so its 429 response has the same rule.
app.use((req, res, next) => {
  if (req.path === '/oauth' || req.path.startsWith('/oauth/')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// ─── Rate Limiting ──────────────────────────────────────────────────────

// P0-4: Global rate limiter
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '请求过于频繁，请稍后再试' },
  skip: (req) => req.path === '/api/health', // Don't rate-limit health checks
});

// P0-4: Stricter limiter for auth endpoints (login/register/token-login)
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX_FAILS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '登录尝试过多，请 15 分钟后再试' },
  // Only count failed attempts (would need custom store for true fail-only counting;
  // this limits total requests to auth endpoints which is safe)
});

app.use(globalLimiter);

// ─── Health Check ───────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'auth-service',
    version: '1.0.0',
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    authContractMode: authContract.mode,
    authContractVersion: authContract.contractVersion,
    authContractDigest: authContract.runtimeDigest,
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ─────────────────────────────────────────────────────────────

// Apply auth rate limiter to login/register/refresh endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/token-login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

app.use('/api/auth', authRouter);

// ─── OAuth 2.0 Token Endpoint ──────────────────────────────────────────────

app.use('/oauth', oauthHumanRouter);
app.use('/oauth', oauthBrowserRouter);
app.use('/oauth', oauthRouter);

// ─── First-party browser OAuth surface (mobile public OAuth V1) ────────────
// Verified HTTPS App Link callback transport (CTR-MPO-004).
app.use(mobileCallbackRouter);

// ─── JWKS — public workflow verification keys (PR-A) ───────────────────────
// Eagerly build the key ring at startup so misconfig fails fast and the JWKS
// snapshot is precomputed (no per-request private-key parsing).
import { getWorkflowKeyring, isWorkflowKeyringConfigured } from './lib/oauth/workflow-keyring.js';
if (isWorkflowKeyringConfigured()) {
  getWorkflowKeyring(); // throws on misconfig
}
app.use('/.well-known', wellKnownRouter);

// ─── Service Registration (SSO Gateway) ──────────────────────────────────

app.use('/api/services', serviceRegistrationRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api', idempotentRouter);
app.use('/api', agentPrincipalRouter);
app.use('/api', workflowAdmissionRouter);

// ─── Error Handler ──────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Don't leak CORS errors as 500s
  if (err.message === 'CORS origin not allowed') {
    res.status(403).json({ message: 'Origin not allowed' });
    return;
  }

  if (err instanceof OAuthHttpError) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error(`[ERROR] ${err.message}`, err.stack);
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : '服务器内部错误';
  res.status(status).json({ message });
});

// ─── Start ──────────────────────────────────────────────────────────────

app.listen(env.PORT, () => {
  console.log(`\n  🔐 auth-service v1.0.0`);
  console.log(`  📡 http://localhost:${env.PORT}`);
  console.log(`  🏷️  issuer: ${env.JWT_ISSUER} | audience: ${env.JWT_AUDIENCE}`);
  console.log(`  📜 auth contract: ${authContract.mode} | ${authContract.contractVersion ?? 'legacy'} | ${authContract.runtimeDigest ?? 'not-loaded'}`);
  console.log(`  🛡️  CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`  ⏱️  Rate limit: ${env.RATE_LIMIT_MAX_REQUESTS}/${env.RATE_LIMIT_WINDOW_MS / 1000}s global, ${env.RATE_LIMIT_LOGIN_MAX_FAILS}/${env.RATE_LIMIT_WINDOW_MS / 1000}s auth\n`);

  // Start token rotation cleanup
  startCleanup();
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('[SIGTERM] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
