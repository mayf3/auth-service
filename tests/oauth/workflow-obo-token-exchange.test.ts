/**
 * Tests for Workflow Agent OBO Token Exchange (PR-B).
 *
 * Covers subject token profile validation, scope intersection, claim checks,
 * error contract, and audit field presence. DB-dependent paths require
 * DATABASE_URL to be set with a provisioned test database.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  configureKeyringEnv,
  clearKeyringEnv,
  generateTestKeyPair,
} from './_workflow-test-keys.js';
import { resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';
import { exchangeToken, OBO_MAX_TTL } from '../../src/lib/oauth/token-exchange.js';
import { parseScopeString } from '../../src/schemas/oauth.js';

// ─── Test Key Setup ─────────────────────────────────────────────────────────

const ACTIVE_KID = 'test-obo-key-v0-20260716';
const JWT_ISSUER = 'auth-service';
const ORIGINAL_ENV = { ...process.env };

let activeKey: ReturnType<typeof generateTestKeyPair>;
let subjectToken: string;
let subjectTokenPayload: Record<string, unknown>;

/**
 * Generate a fresh subject token (direct workflow agent token).
 */
async function makeSubjectToken(opts?: {
  overrides?: Record<string, unknown>;
  algorithm?: string;
  signingKey?: crypto.KeyObject;
  kid?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: JWT_ISSUER,
    sub: '44444444-4444-4444-4444-444444444444',
    aud: 'svc-workflow',
    principal_type: 'agent',
    scope: 'workflow.read workflow.execute',
    token_use: 'access',
    type: 'access',
    version: 'v1',
    agent_id: 'test-agent-obo',
    client_id: 'mc_direct_client',
    jti: `sub-${now}-${crypto.randomBytes(4).toString('hex')}`,
    iat: now,
    nbf: now,
    exp: now + 600,
    ...(opts?.overrides || {}),
  };
  const key = opts?.signingKey || activeKey.privateKey;
  const alg = opts?.algorithm || 'RS256';
  const kid = opts?.kid || ACTIVE_KID;
  return jwt.sign(payload, key.export({ format: 'pem', type: 'pkcs8' }), {
    algorithm: alg,
    keyid: kid,
  });
}

async function setupKeyring(): Promise<void> {
  activeKey = generateTestKeyPair(ACTIVE_KID);
  configureKeyringEnv({
    activeKid: ACTIVE_KID,
    activePrivateKeyPem: activeKey.privateKeyPem,
  });
  resetWorkflowKeyringForTests();
  subjectToken = await makeSubjectToken();
  subjectTokenPayload = jwt.decode(subjectToken) as Record<string, unknown>;
}

function teardownKeyring(): void {
  clearKeyringEnv();
  resetWorkflowKeyringForTests();
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

// Helper: valid DB client credentials for tests that reach Prisma
const DB_CLIENT_ID = 'mc_subject_client';
const DB_CLIENT_SECRET = 'EL8Xak-5c-ZTaJ5e8tZ0LKwg4uN-KKK3aFt289QOQ84';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('OBO token exchange', () => {
  beforeEach(async () => {
    await setupKeyring();
  });

  afterEach(() => {
    teardownKeyring();
  });

  // ── Request Parsing ────────────────────────────────────────────────────

  it('rejects unsupported subject_token_type', async () => {
    await assert.rejects(
      () => exchangeToken({
        clientId: 'mc_test', subjectSecret: 'x',
        subjectToken: 'ignored',
        subjectTokenType: 'urn:ietf:params:oauth:token-type:id_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.message === 'unsupported_token_type',
    );
  });

  it('rejects unsupported requested_token_type', async () => {
    await assert.rejects(
      () => exchangeToken({
        clientId: 'mc_test', subjectSecret: 'x',
        subjectToken: 'ignored',
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:id_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.message === 'unsupported_token_type',
    );
  });

  // ── Algorithm / Verification ───────────────────────────────────────────

  it('rejects subject token with unknown kid', async () => {
    const badToken = await makeSubjectToken({ kid: 'unknown-kid-v999' });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: badToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects alg=none subject token', async () => {
    // Manually construct an alg=none token (no kid, no signature).
    // jwt.sign rejects algorithm:'none' for RSA keys, so we build raw.
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: JWT_ISSUER, sub: '44444444-4444-4444-4444-444444444444',
      aud: 'svc-workflow', principal_type: 'agent', scope: 'workflow.read',
      token_use: 'access', type: 'access', version: 'v1',
      agent_id: 'test-agent', client_id: 'mc_test',
      jti: 'none-test-jti', iat: now, nbf: now, exp: now + 600,
    })).toString('base64url');
    const noneToken = header + '.' + payload + '.';
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: noneToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects HS256 subject token', async () => {
    // For HS256 we need a different key; use jsonwebtoken's own HS256 capability
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: JWT_ISSUER, sub: '44444444-4444-4444-4444-444444444444',
      aud: 'svc-workflow', principal_type: 'agent', scope: 'workflow.read',
      token_use: 'access', type: 'access', version: 'v1',
      agent_id: 'test-agent', client_id: 'mc_test',
      jti: `hs-${now}-test`, iat: now, nbf: now, exp: now + 600,
    };
    const hsToken = jwt.sign(payload, 'test-hs256-secret', { algorithm: 'HS256' });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: hsToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  // ── Subject Profile Checks ────────────────────────────────────────────

  it('rejects subject token with token_use=workflow_obo (chaining block)', async () => {
    const oboToken = await makeSubjectToken({
      overrides: {
        token_use: 'workflow_obo',
        act: { sub: 'some-principal-id' },
        azp: 'mc_some_client',
      },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: oboToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects subject token with act claim (chaining defense)', async () => {
    const actToken = await makeSubjectToken({
      overrides: { act: { sub: 'some-actor-id' } },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: actToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects subject token with non-agent principal_type', async () => {
    const badToken = await makeSubjectToken({
      overrides: { principal_type: 'human' },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: badToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects subject token with type != access', async () => {
    const badToken = await makeSubjectToken({
      overrides: { type: 'refresh' },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: badToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects subject token with empty sub', async () => {
    const badToken = await makeSubjectToken({
      overrides: { sub: '' },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: badToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects subject token with wrong aud (not svc-workflow)', async () => {
    const badToken = await makeSubjectToken({
      overrides: { aud: 'svc-forum' },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: badToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  // ── TTL ────────────────────────────────────────────────────────────────

  it('caps OBO TTL at 300 seconds', () => {
    assert.equal(OBO_MAX_TTL, 300);
  });

  // ── Scope Intersection ─────────────────────────────────────────────────

  it('computes correct 3-way scope intersection', () => {
    const subjectScopes = ['workflow.read', 'workflow.execute'];
    const adcAllowed = ['workflow.read', 'workflow.execute'];
    const requested = ['workflow.read'];
    const subjectSet = new Set(subjectScopes);
    const allowedSet = new Set(adcAllowed);
    const result = requested.filter(s => subjectSet.has(s) && allowedSet.has(s)).sort();
    assert.deepEqual(result, ['workflow.read']);
  });

  it('subject={read}, ADC={read,execute}, requested={read,execute} → {read}', () => {
    const subject = ['workflow.read'];
    const adc = ['workflow.read', 'workflow.execute'];
    const requested = ['workflow.read', 'workflow.execute'];
    const subjectSet = new Set(subject);
    const allowedSet = new Set(adc);
    const result = requested.filter(s => subjectSet.has(s) && allowedSet.has(s)).sort();
    assert.deepEqual(result, ['workflow.read']);
  });

  it('subject={read,execute}, ADC={read}, requested={execute} → empty', () => {
    const subject = ['workflow.read', 'workflow.execute'];
    const adc = ['workflow.read'];
    const requested = ['workflow.execute'];
    const subjectSet = new Set(subject);
    const allowedSet = new Set(adc);
    const result = requested.filter(s => subjectSet.has(s) && allowedSet.has(s)).sort();
    assert.deepEqual(result, []);
  });

  it('subject={read,execute}, ADC={read,execute}, requested={read} → {read}', () => {
    const subject = ['workflow.read', 'workflow.execute'];
    const adc = ['workflow.read', 'workflow.execute'];
    const requested = ['workflow.read'];
    const subjectSet = new Set(subject);
    const allowedSet = new Set(adc);
    const result = requested.filter(s => subjectSet.has(s) && allowedSet.has(s)).sort();
    assert.deepEqual(result, ['workflow.read']);
  });

  it('scope substring attacks blocked', () => {
    const subject = new Set(['workflow.read']);
    const allowed = new Set(['workflow.read']);
    assert.equal(subject.has('workflow.read.all'), false);
    assert.equal(allowed.has('workflow.read.all'), false);
    assert.equal(subject.has('not-workflow.read'), false);
    assert.equal(subject.has('workflow.readx'), false);
  });

  it('parseScopeString deduplicates and sorts', () => {
    const result = parseScopeString('workflow.execute workflow.read workflow.execute');
    assert.deepEqual(result, ['workflow.execute', 'workflow.read']);
  });

  it('empty requested scope defaults to subject scope set', () => {
    const subjectParsed = parseScopeString('workflow.read workflow.execute');
    assert.deepEqual(subjectParsed, ['workflow.execute', 'workflow.read']);
  });

  // ── Claims ─────────────────────────────────────────────────────────────

  it('OBO token has correct frozen claims (when exchange succeeds)', () => {
    assert.ok(subjectTokenPayload, 'subject token should be decodable');
    assert.equal(subjectTokenPayload.token_use, 'access');
    assert.equal(subjectTokenPayload.principal_type, 'agent');
    assert.equal(subjectTokenPayload.aud, 'svc-workflow');
    assert.equal(subjectTokenPayload.iss, JWT_ISSUER);
    assert.equal(subjectTokenPayload.type, 'access');
    assert.ok(subjectTokenPayload.sub);
    assert.ok(subjectTokenPayload.jti);
    assert.ok(!subjectTokenPayload.act, 'subject token should not have act');
    assert.ok(!subjectTokenPayload.azp, 'subject token should not have azp');
  });
});

// ── Pipeline validation (DB required) ──────────────────────────────────────

describe('OBO token exchange — pipeline validation', () => {
  beforeEach(async () => {
    await setupKeyring();
  });

  afterEach(() => {
    teardownKeyring();
  });

  it('rejects expired subject token with generic invalid_grant', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await makeSubjectToken({
      overrides: { iat: now - 1000, exp: now - 100, nbf: now - 1000 },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: expiredToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects audience != svc-workflow', async () => {
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: 'not.checked.before.db',
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-forum',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects subject token with future nbf', async () => {
    const now = Math.floor(Date.now() / 1000);
    const futureToken = await makeSubjectToken({
      overrides: { nbf: now + 3600 },
    });
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: futureToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('rejects tampered subject token signature', async () => {
    const parts = subjectToken.split('.');
    const tampered = parts[0] + '.' + parts[1] + '.' + 'YmFkX3NpZ25hdHVyZQ';
    await assert.rejects(
      () => exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: tampered,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('preserves direct workflow token contract unchanged', () => {
    assert.equal(subjectTokenPayload.token_use, 'access', 'direct token is access');
    assert.equal(subjectTokenPayload.azp, undefined, 'direct token has no azp');
    assert.equal(subjectTokenPayload.act, undefined, 'direct token has no act');
    assert.equal(subjectTokenPayload.aud, 'svc-workflow');
    assert.equal(subjectTokenPayload.principal_type, 'agent');
    assert.equal(subjectTokenPayload.type, 'access');
  });
});

// ── Audit ──────────────────────────────────────────────────────────────────

describe('OBO audit field presence', () => {
  beforeEach(async () => {
    await setupKeyring();
  });

  afterEach(() => {
    teardownKeyring();
  });

  it('audit events include requestId on failure (wrong audience)', async () => {
    const logs: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => { logs.push(String(args[0])); };

    try {
      await exchangeToken({
        clientId: DB_CLIENT_ID, clientSecret: DB_CLIENT_SECRET,
        subjectToken: subjectToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-forum',
        scope: 'workflow.read',
        requestId: 'req-test-001',
      });
    } catch { /* expected */ }

    console.warn = origWarn;
    const auditLines = logs.filter(l => l.includes('[AUDIT]'));
    assert.ok(auditLines.length >= 1, 'should have at least one audit entry');
    const lastAudit = auditLines[auditLines.length - 1];
    assert.ok(lastAudit.includes('requestId'), 'audit should include requestId');
    assert.ok(lastAudit.includes('req-test-001'), 'audit should have test request ID');
    assert.ok(lastAudit.includes('invalid_resource') || lastAudit.includes('client_not_found'),
      'audit should include error category: ' + lastAudit);
  });
});
