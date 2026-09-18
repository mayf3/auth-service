/**
 * T86 regression — durable refresh-token single-consumption
 * (AUTH-SCOUT-20260914-C04).
 *
 * OWNER SECURITY DECISION (OWNER_GATE_MATERIALIZATION_AND_NIGHTLY_RELEASE_20260916_V1,
 * re-released by T85_T86_FALSE_CLOSURE_CORRECTION_AND_REPAIR_RESUME_20260918_V1 §3):
 * the refresh flow must require a canonical replay identity (jti), be
 * durable across restarts, shared across service instances, and consume
 * ATOMICALLY. Forbidden: process-local Map as authority, check→await→revoke
 * race, missing-jti bypass.
 *
 * Baseline RED (pre-fix, against the process-local revokedTokens Map):
 *   - missing-jti refresh succeeded and was NEVER revocable (infinite replay);
 *   - N concurrent refreshes with one token produced multiple 200s (the
 *     check→await→revoke window);
 *   - a fresh consumption attempt after "restart" would have succeeded
 *     (Map lost on restart) — post-fix the durable row decides.
 *
 * The store-level durability legs exercise the DB authority directly
 * (raw-row existence + a second consume attempt over a fresh connection),
 * which is what makes process-local memory impossible as the authority.
 *
 * Run: JWT_SECRET=... JWT_REFRESH_SECRET=... DATABASE_URL=<disposable PG> \
 *      npx tsx --test tests/t86_durable_refresh_consumption.test.ts
 */
process.env.JWT_SECRET = 't86-test-secret';
process.env.JWT_REFRESH_SECRET = 't86-test-refresh-secret';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://t87_migr:testpass@127.0.0.1:55446/t87auth';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Express } from 'express';

const { default: express } = await import('express');
const jwt = (await import('jsonwebtoken')).default;
const { prisma } = await import('../src/lib/prisma.js');
const { authRouter } = await import('../src/routes/auth.js');
const { consumeRefreshToken, isRefreshTokenConsumed } = await import('../src/lib/oauth/refresh-consumption.js');

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
let userId = '';
let baseUrl = '';

function refreshBody(overrides: { jti?: string | null }): string {
  const payload: Record<string, unknown> = {
    sub: userId,
    iss: 'auth-service',
    aud: 'unified-platform',
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  if (overrides.jti !== null) payload.jti = overrides.jti ?? `t86-${crypto.randomBytes(6).toString('hex')}`;
  return jwt.sign(payload, REFRESH_SECRET);
}

async function postRefresh(token: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

describe('T86: durable refresh-token single consumption', () => {
  before(async () => {
    const user = await prisma.user.create({
      data: {
        name: 't86-refresh-user',
        email: `t86-${crypto.randomBytes(4).toString('hex')}@test.local`,
        password: 'placeholder-hash-' + crypto.randomUUID().slice(0, 8),
        role: 'requester',
      },
    });
    userId = user.id;
    const app: Express = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    server.unref();
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 't86-' } } });
    await prisma.$disconnect();
  });

  it('missing jti → reject with ZERO issuance (no bypass)', async () => {
    const res = await postRefresh(refreshBody({ jti: null }));
    assert.equal(res.status, 401);
    assert.equal(res.body.refreshToken, undefined, 'no replacement credential may be issued');
    assert.equal(res.body.accessToken, undefined, 'no access token may be issued');
  });

  it('baseline rotation: a fresh jti refreshes exactly once (winner path)', async () => {
    const res = await postRefresh(refreshBody({}));
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.refreshToken === 'string', 'replacement credential issued');
  });

  it('replay of the consumed jti → rejected (same process)', async () => {
    const jti = `t86-replay-${crypto.randomBytes(4).toString('hex')}`;
    const first = await postRefresh(refreshBody({ jti }));
    assert.equal(first.status, 200);
    const second = await postRefresh(refreshBody({ jti }));
    assert.equal(second.status, 401);
  });

  it('N concurrent refreshes with one token → EXACTLY one 200 (atomic consume, no check→await→revoke race)', async () => {
    const jti = `t86-race-${crypto.randomBytes(4).toString('hex')}`;
    const token = refreshBody({ jti });
    const results = await Promise.all(Array.from({ length: 5 }, () => postRefresh(token)));
    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status === 401);
    assert.equal(winners.length, 1, `exactly one rotation may succeed, got ${winners.length}`);
    assert.equal(losers.length, 4);
    for (const loser of losers) {
      assert.equal(loser.body.refreshToken, undefined, 'losers get zero issuance');
    }
  });

  it('durable authority: consumption row exists and a fresh-connection consume attempt loses (restart/other-instance semantics)', async () => {
    const jti = `t86-durable-${crypto.randomBytes(4).toString('hex')}`;
    const first = await postRefresh(refreshBody({ jti }));
    assert.equal(first.status, 200);

    // The authority is the DB row, not process memory.
    assert.equal(await isRefreshTokenConsumed(jti), true);

    // Drop the pool and reconnect — a "restarted"/other-instance process
    // sees the same durable state and the replay still loses.
    await prisma.$disconnect();
    assert.equal(await isRefreshTokenConsumed(jti), true, 'consumption survives reconnect (durable)');
    assert.equal(await consumeRefreshToken(jti, 3_600_000), false, 'replay consume attempt loses');
    const replay = await postRefresh(refreshBody({ jti }));
    assert.equal(replay.status, 401, 'route-level replay still rejected');
  });
});
