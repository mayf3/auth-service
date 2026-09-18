/**
 * T85 regression — issuer/audience context-bound verification (AUTH-SCOUT-20260914-C03).
 *
 * OWNER_DECISION_COMMIT (OWNER_GATE_MATERIALIZATION_AND_NIGHTLY_RELEASE_20260916_V1,
 * SECURITY_REPAIR_AUTHORIZED): a token rejected for issuer/audience context
 * MUST NOT authenticate merely because its signature matches JWT_SECRET.
 * The generic secret-only fallback (jwt.verify(token, JWT_SECRET) with no
 * options) is removed; exactly two contexts remain valid:
 *   unified auth-service: issuer=JWT_ISSUER  audience=JWT_AUDIENCE
 *   legacy ADC:           issuer=agent-dev-center  audience=adc-api
 * Machine-agent token profiles and the dedicated T52 Forum agent profile are
 * separate verification surfaces and are untouched.
 *
 * Baseline RED (pre-fix): same secret + wrong issuer/audience/missing
 * context tokens passed authRequired via the bare fallback.
 *
 * Note: "disabled User → still rejected" is enforced by auth-service#79
 * (T84) in this same middleware AFTER verification; the two compose. That
 * leg is covered by #79's own regression and skipped here to keep this
 * candidate ticket-specific.
 *
 * Run: JWT_SECRET=... DATABASE_URL=<disposable PG> npx tsx --test tests/t85_context_bound_verify.test.ts
 */
process.env.JWT_SECRET = 't85-test-secret';
process.env.JWT_ISSUER = 'auth-service';
process.env.JWT_AUDIENCE = 'unified-platform';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://t87_migr:testpass@127.0.0.1:55446/t87auth';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Express } from 'express';

const { default: express } = await import('express');
const jwt = (await import('jsonwebtoken')).default;
const { prisma } = await import('../src/lib/prisma.js');
const { authRequired } = await import('../src/middleware/auth.js');

const SECRET = process.env.JWT_SECRET!;
let userId = '';
let baseUrl = '';

function token(overrides: {
  issuer?: string | null;
  audience?: string | null;
}): string {
  const payload: Record<string, unknown> = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  if (overrides.issuer !== null) payload.iss = overrides.issuer ?? 'auth-service';
  if (overrides.audience !== null) payload.aud = overrides.audience ?? 'unified-platform';
  return jwt.sign(payload, SECRET);
}

async function call(bearer: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/t`, {
    headers: { authorization: `Bearer ${bearer}` },
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

describe('T85: issuer/audience context-bound verification', () => {
  before(async () => {
    const user = await prisma.user.create({
      data: {
        name: 't85-context-user',
        email: `t85-${crypto.randomBytes(4).toString('hex')}@test.local`,
        password: 'placeholder-hash-' + crypto.randomUUID().slice(0, 8),
        role: 'requester',
      },
    });
    userId = user.id;
    const app: Express = express();
    app.get('/t', authRequired as unknown as express.RequestHandler, (req, res) => {
      res.json({ sub: (req as unknown as { user: { id: string } }).user.id });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    server.unref();
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 't85-' } } });
    await prisma.$disconnect();
  });

  it('valid unified auth-service context → pass', async () => {
    const res = await call(token({}));
    assert.equal(res.status, 200);
    assert.equal(res.body.sub, userId);
  });

  it('valid explicit legacy ADC context → pass', async () => {
    const res = await call(token({ issuer: 'agent-dev-center', audience: 'adc-api' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.sub, userId);
  });

  it('same secret + wrong issuer → reject (baseline RED: bare fallback authenticated it)', async () => {
    const res = await call(token({ issuer: 'not-the-real-issuer' }));
    assert.equal(res.status, 401);
  });

  it('same secret + wrong audience → reject', async () => {
    const res = await call(token({ audience: 'not-the-real-audience' }));
    assert.equal(res.status, 401);
  });

  it('same secret + missing issuer/audience entirely → reject (legacy no-context tokens)', async () => {
    const res = await call(token({ issuer: null, audience: null }));
    assert.equal(res.status, 401);
  });

  it('mixed context (legacy issuer + unified audience) → reject (contexts match exactly)', async () => {
    const res = await call(token({ issuer: 'agent-dev-center', audience: 'unified-platform' }));
    assert.equal(res.status, 401);
  });

  it('disabled User → still rejected (enforced by auth-service#79 / T84; composition)', { skip: 'enforced by auth-service#79 (T84) in the same middleware after verification — covered by #79 regression' }, async () => {
    assert.ok(true);
  });
});
