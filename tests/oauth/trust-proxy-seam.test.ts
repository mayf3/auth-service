/**
 * Trust-proxy seam tests — CTR-AH-EDGE-002
 * (AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1).
 *
 * The hosting edge (dedicated Nginx SNI block, deploy/auth-hosting/) deletes
 * every client-supplied forwarding header and injects EXACTLY ONE hop:
 * `proxy_set_header X-Forwarded-For $remote_addr` toward the loopback tunnel
 * endpoint 127.0.0.1:18794. This suite proves the app-side seam semantics:
 *
 *   - AUTH_TRUST_PROXY_HOPS=1 → req.ip (and therefore every express-rate-limit
 *     identity) derives from the single edge-injected XFF entry; two different
 *     public clients get two different identities and the loopback socket
 *     address is never a per-client key.
 *   - Missing trusted header → degraded single identity (socket address).
 *   - Multi-entry XFF (defensive: our edge can never produce one) → safe
 *     single-hop handling: only the rightmost (last-injected) entry is
 *     eligible; client-supplied entries beyond the trusted hop are never
 *     selected (documented below).
 *   - AUTH_TRUST_PROXY_HOPS unset/0 → setting stays literally `false`,
 *     behavior identical to existing local deployments.
 *
 * Mirrors oauth-browser.test.ts: real express apps on ephemeral node:http
 * servers, no supertest dependency. server.ts itself starts listening at
 * import time, so the wiring is additionally asserted at source level (same
 * idiom as http-integration.test.ts).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { installDegradedIdentityAlarm, parseTrustProxyHops } from '../../src/config/trust-proxy-hops.js';

interface TestResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

interface AppHandle {
  start(): Promise<number>;
  stop(): Promise<void>;
  /** The raw Express `trust proxy` setting, for wiring assertions. */
  trustProxySetting(): unknown;
}

/**
 * Build an app mirroring the server.ts seam exactly: an /echo-ip endpoint
 * reporting req.ip, plus (optionally) a real global express-rate-limit
 * instance with default keyGenerator (req.ip) so identity derivation is
 * observed through the actual limiter, not a mock.
 */
function buildApp(options: {
  trustProxyHops?: number;
  withLimiter?: boolean;
  /** Captures the CTR-AH-EDGE-002 degraded-identity alarm (verbatim wiring). */
  alarmWarn?: (message: string) => void;
  alarmNow?: () => number;
} = {}): AppHandle {
  const app = express();
  // ── seam under test (verbatim server.ts wiring) ──
  const hops = options.trustProxyHops ?? 0;
  if (hops > 0) {
    app.set('trust proxy', hops);
    installDegradedIdentityAlarm(app, { warn: options.alarmWarn, now: options.alarmNow });
  }
  // ─────────────────────────────────────────────────
  if (options.withLimiter) {
    app.use(rateLimit({
      windowMs: 60_000,
      max: 1,
      standardHeaders: false,
      legacyHeaders: false,
      // Default validations kept: under hops=0 a client-supplied XFF makes the
      // limiter log ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (today's
      // local-deployment signal) without altering the socket-based key.
    }));
  }
  app.get('/echo-ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  let server: http.Server | undefined;
  return {
    start(): Promise<number> {
      return new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => resolve((server!.address() as AddressInfo).port));
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => server!.close(() => resolve()));
    },
    trustProxySetting(): unknown {
      return app.get('trust proxy');
    },
  };
}

function httpRequest(port: number, path: string, headers: Record<string, string> = {}): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const SOCKET_IP = '127.0.0.1';
const CLIENT_A = '203.0.113.10'; // TEST-NET-3, synthetic public client
const CLIENT_B = '203.0.113.77';

describe('parseTrustProxyHops — CTR-AH-EDGE-002 config gate', () => {
  it('defaults to 0 and accepts only 0 or 1', () => {
    assert.equal(parseTrustProxyHops(undefined), 0);
    assert.equal(parseTrustProxyHops(''), 0);
    assert.equal(parseTrustProxyHops('0'), 0);
    assert.equal(parseTrustProxyHops('1'), 1);
  });

  it('rejects more than one hop, negatives and non-integers (fail-fast)', () => {
    for (const bad of ['2', '-1', '1.5', 'abc', 'true', '0x1']) {
      assert.throws(() => parseTrustProxyHops(bad), /AUTH_TRUST_PROXY_HOPS/, `expected rejection of ${bad}`);
    }
  });
});

describe('AUTH_TRUST_PROXY_HOPS=1 — single trusted edge hop (CTR-AH-EDGE-002)', () => {
  let app: AppHandle;
  let port: number;
  beforeEach(async () => {
    app = buildApp({ trustProxyHops: 1 });
    port = await app.start();
  });
  afterEach(async () => {
    await app.stop();
  });

  it('derives req.ip from a single-entry edge-injected XFF, never from the loopback socket', async () => {
    const res = await httpRequest(port, '/echo-ip', { 'X-Forwarded-For': CLIENT_A });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).ip, CLIENT_A);
  });

  it('gives two different public clients two different identities (no collapse)', async () => {
    const a = await httpRequest(port, '/echo-ip', { 'X-Forwarded-For': CLIENT_A });
    const b = await httpRequest(port, '/echo-ip', { 'X-Forwarded-For': CLIENT_B });
    const ipA = JSON.parse(a.body).ip;
    const ipB = JSON.parse(b.body).ip;
    assert.equal(ipA, CLIENT_A);
    assert.equal(ipB, CLIENT_B);
    assert.notEqual(ipA, SOCKET_IP);
    assert.notEqual(ipB, SOCKET_IP);
  });

  it('falls back to the socket address as one degraded identity when the trusted header is missing', async () => {
    const res = await httpRequest(port, '/echo-ip');
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).ip, SOCKET_IP);
  });

  it('handles a never-expected multi-entry XFF safely: rightmost (last-injected) entry only', async () => {
    // Defensive case: behind our edge this cannot occur (the edge REPLACES
    // X-Forwarded-For with $remote_addr). If it ever did (misconfig), the
    // single-hop walk selects the rightmost entry — the value injected by the
    // closest (trusted) hop — and never the leftmost client-supplied entries.
    const res = await httpRequest(port, '/echo-ip', { 'X-Forwarded-For': `${CLIENT_A}, ${CLIENT_B}` });
    assert.equal(JSON.parse(res.body).ip, CLIENT_B);
  });

  it('express-rate-limit identities derive from the edge-injected client IP (real limiter, default keyGenerator)', async () => {
    const limited = buildApp({ trustProxyHops: 1, withLimiter: true });
    const limitedPort = await limited.start();
    try {
      const firstA = await httpRequest(limitedPort, '/echo-ip', { 'X-Forwarded-For': CLIENT_A });
      const secondA = await httpRequest(limitedPort, '/echo-ip', { 'X-Forwarded-For': CLIENT_A });
      const firstB = await httpRequest(limitedPort, '/echo-ip', { 'X-Forwarded-For': CLIENT_B });
      assert.equal(firstA.status, 200);
      assert.equal(secondA.status, 429, 'same client IP must share one rate-limit bucket');
      assert.equal(firstB.status, 200, 'a different client IP must get an independent bucket');
    } finally {
      await limited.stop();
    }
  });
});

describe('AUTH_TRUST_PROXY_HOPS unset/0 — byte-identical to existing deployments', () => {
  let app: AppHandle;
  let port: number;
  beforeEach(async () => {
    app = buildApp({ trustProxyHops: 0 });
    port = await app.start();
  });
  afterEach(async () => {
    await app.stop();
  });

  it('leaves the Express trust proxy setting literally false (never a number, never true)', () => {
    assert.equal(app.trustProxySetting(), false);
  });

  it('req.ip is the socket address even when a client supplies X-Forwarded-For', async () => {
    const res = await httpRequest(port, '/echo-ip', { 'X-Forwarded-For': CLIENT_A });
    assert.equal(JSON.parse(res.body).ip, SOCKET_IP);
  });

  it('keeps today\u2019s single-identity collapse for client-supplied XFF (the problem EDGE-002 fixes)', async () => {
    // hops=0, default validations: express-rate-limit logs
    // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (a misconfiguration signal, preserved
    // exactly as before the seam) but keys every client onto the socket
    // address — i.e. all public clients would collapse into one bucket.
    const limited = buildApp({ trustProxyHops: 0, withLimiter: true });
    const limitedPort = await limited.start();
    try {
      const firstA = await httpRequest(limitedPort, '/echo-ip', { 'X-Forwarded-For': CLIENT_A });
      const firstB = await httpRequest(limitedPort, '/echo-ip', { 'X-Forwarded-For': CLIENT_B });
      assert.equal(firstA.status, 200);
      assert.equal(firstB.status, 429, 'without the seam both clients collapse onto the socket identity');
    } finally {
      await limited.stop();
    }
  });
});

describe('trust-proxy seam wiring (source level, server.ts + env.ts)', () => {
  const serverSource = fs.readFileSync('src/server.ts', 'utf8');
  const envSource = fs.readFileSync('src/config/env.ts', 'utf8');

  it('gates the trust proxy setting on AUTH_TRUST_PROXY_HOPS > 0 and never enables the loose true', () => {
    assert.match(serverSource, /if \(env\.AUTH_TRUST_PROXY_HOPS > 0\)/);
    assert.match(serverSource, /app\.set\('trust proxy', env\.AUTH_TRUST_PROXY_HOPS\)/);
    assert.doesNotMatch(serverSource, /trust proxy',\s*true/);
  });

  it('parses the hop count through the CTR-AH-EDGE-002 config gate', () => {
    assert.match(envSource, /AUTH_TRUST_PROXY_HOPS: parseTrustProxyHops\(process\.env\.AUTH_TRUST_PROXY_HOPS\)/);
  });
});

describe('AUTH_TRUST_PROXY_HOPS=1 — degraded-identity alarm (CTR-AH-EDGE-002)', () => {
  it('emits the rate-limited alarm when a request arrives without the edge XFF', async () => {
    const warnings: string[] = [];
    let tick = 0;
    const app = buildApp({
      trustProxyHops: 1,
      alarmWarn: (m) => warnings.push(m),
      alarmNow: () => ++tick * 1000, // distinct times: every request may alarm
    });
    const port = await app.start();
    try {
      const res = await httpRequest(port, '/echo-ip');
      assert.equal(res.status, 200);
      assert.equal(JSON.parse(res.body).ip, SOCKET_IP); // degraded: collapsed to loopback
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /HOSTING-EDGE/);
      assert.doesNotMatch(warnings[0], /203\.0\.113|127\.0\.0\.1|ZZ/); // no client data in the alarm
    } finally {
      await app.stop();
    }
  });

  it('does not alarm when the edge XFF is present (normal per-client identity)', async () => {
    const warnings: string[] = [];
    const app = buildApp({
      trustProxyHops: 1,
      alarmWarn: (m) => warnings.push(m),
      alarmNow: () => 1000,
    });
    const port = await app.start();
    try {
      const res = await httpRequest(port, '/echo-ip', { 'x-forwarded-for': CLIENT_A });
      assert.equal(res.status, 200);
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(warnings.length, 0);
    } finally {
      await app.stop();
    }
  });

  it('never alarms at hops=0 (default local deployments stay silent)', async () => {
    const warnings: string[] = [];
    const app = buildApp({ trustProxyHops: 0, alarmWarn: (m) => warnings.push(m) });
    const port = await app.start();
    try {
      await httpRequest(port, '/echo-ip', { 'x-forwarded-for': CLIENT_A });
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(warnings.length, 0);
      assert.equal(app.trustProxySetting(), false);
    } finally {
      await app.stop();
    }
  });
});