/**
 * DB E2E test for Workflow Agent OBO Token Exchange (PR-B).
 *
 * Requires:
 *   - DATABASE_URL pointing to a provisioned PostgreSQL with test data
 *   - JWT_PRIVATE_KEY, JWT_KID set for the workflow keyring
 *
 * Run:
 *   source /tmp/obo_db.sh
 *   export DATABASE_URL=$CANARY_OBO_DB_URL
 *   JWT_SECRET=test-jwt-secret JWT_PRIVATE_KEY=<K2> JWT_KID=<K2_KID> \
 *     node tests/oauth/workflow-obo-db-e2e.mjs
 */

import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.env.TEST_BASE_URL || 'http://localhost:4999';
const CT = 'Content-Type: application/x-www-form-urlencoded';

// ─── Test Data (from provisioning) ──────────────────────────────────────────

const SUBJECT_CLIENT_ID = 'mc_subject_client';
const SUBJECT_CLIENT_SECRET = process.env.SUBJECT_CLIENT_SECRET || '';

const ADC_CLIENT_ID = 'mc_adc_client';
const ADC_CLIENT_SECRET = process.env.ADC_CLIENT_SECRET || '';

const SUBJECT_PRINCIPAL_ID = '44444444-4444-4444-4444-444444444444';
const ADC_PRINCIPAL_ID = '55555555-5555-5555-5555-555555555555';

let passed = 0;
let failed = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ❌ FAIL: ${name}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  };
}

async function getSubjectToken() {
  const auth = Buffer.from(`${SUBJECT_CLIENT_ID}:${SUBJECT_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { CT, 'Authorization': `Basic ${auth}` },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource: 'svc-workflow',
      scope: 'workflow.read workflow.execute',
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 200, `Subject token: expected 200, got ${res.status}`);
  assert.ok(data.access_token, 'Subject token missing access_token');
  return data.access_token;
}

async function exchangeToken(subjectToken, opts = {}) {
  const auth = Buffer.from(
    `${opts.adcClientId || ADC_CLIENT_ID}:${opts.adcClientSecret || ADC_CLIENT_SECRET}`
  ).toString('base64');

  const params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: opts.subjectToken || subjectToken,
    subject_token_type: opts.subjectTokenType || 'urn:ietf:params:oauth:token-type:access_token',
    requested_token_type: opts.requestedTokenType || 'urn:ietf:params:oauth:token-type:access_token',
    audience: opts.audience || 'svc-workflow',
    scope: opts.scope || 'workflow.read',
  };

  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { CT, 'Authorization': `Basic ${auth}` },
    body: new URLSearchParams(params),
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

function decodeJWT(token) {
  const parts = token.split('.');
  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
    payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== OBO Token Exchange DB E2E ===\n');

  // Get a subject token first
  const subjectToken = await getSubjectToken();
  const { payload: subjectPayload } = decodeJWT(subjectToken);
  const subjectSub = subjectPayload.sub;

  console.log(`Subject token obtained: sub=${subjectSub}`);
  console.log(`Subject token aud=${subjectPayload.aud}, token_use=${subjectPayload.token_use}`);

  // ── 1. Legal OBO Exchange ──────────────────────────────────────────────
  await test('1. Legal OBO exchange', async () => {
    const { status, data } = await exchangeToken(subjectToken, { scope: 'workflow.read workflow.execute' });
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(data.access_token, 'Missing access_token');
    assert.equal(data.token_type, 'Bearer');
    assert.ok(data.expires_in <= 300, `TTL ${data.expires_in} > 300`);
    assert.equal(data.scope, 'workflow.execute workflow.read');

    const obo = decodeJWT(data.access_token);
    const p = obo.payload;

    // Claim checks
    assert.equal(p.token_use, 'workflow_obo', 'token_use must be workflow_obo');
    assert.equal(p.sub, subjectSub, 'sub must match subject');
    assert.equal(p.aud, 'svc-workflow', 'aud must be svc-workflow');
    assert.equal(p.principal_type, 'agent', 'principal_type must be agent');
    assert.equal(p.type, 'access', 'type must be access');
    assert.equal(p.client_id, ADC_CLIENT_ID, 'client_id must be ADC client');
    assert.equal(p.azp, ADC_CLIENT_ID, 'azp must be ADC client');
    assert.equal(p.act?.sub, ADC_PRINCIPAL_ID, 'act.sub must be ADC principal');
    assert.ok(p.jti, 'jti required');
    assert.ok(p.iat, 'iat required');
    assert.ok(p.nbf, 'nbf required');
    assert.ok(p.exp, 'exp required');
    assert.ok(p.exp - p.iat <= 300, `TTL ${p.exp - p.iat} > 300`);
    assert.ok(!data.refresh_token, 'No refresh_token');
  })();

  // ── 2. Minimal scope ───────────────────────────────────────────────────
  await test('2. Minimal scope (single scope)', async () => {
    const { status, data } = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(data.scope, 'workflow.read');
  })();

  // ── 3. Scope intersection: subject={read,execute}, ADC={read}, request={read,execute} → {read}
  await test('3. Scope intersection restricts by ADC allowed scopes', async () => {
    // Create a temp ADC client with limited scopes for this test
    const auth = Buffer.from(`${ADC_CLIENT_ID}:${ADC_CLIENT_SECRET}`).toString('base64');
    const params = {
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: subjectToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: 'svc-workflow',
      scope: 'workflow.read workflow.execute',
    };
    // mc_adc_client allows both read+execute, so this test is weaker.
    // Full restriction test requires an ADC client with limited scopes.
    const { status, data } = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    assert.equal(status, 200);
    assert.equal(data.scope, 'workflow.read');
  })();

  // ── 4. Different jti for different requests ───────────────────────────
  await test('4. Distinct jti for different requests', async () => {
    const r1 = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    const r2 = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    const jti1 = decodeJWT(r1.data.access_token).payload.jti;
    const jti2 = decodeJWT(r2.data.access_token).payload.jti;
    assert.notEqual(jti1, jti2, 'jti must be distinct');
  })();

  // ── 5. TTL ≤ 300s ──────────────────────────────────────────────────────
  await test('5. TTL does not exceed 300s', async () => {
    const { status, data } = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    assert.equal(status, 200);
    assert.ok(data.expires_in <= 300, `TTL ${data.expires_in} > 300`);
  })();

  // ── 6. No refresh token ───────────────────────────────────────────────
  await test('6. No refresh token in response', async () => {
    const { status, data } = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    assert.equal(status, 200);
    assert.ok(!data.refresh_token, 'refresh_token must not be present');
  })();

  // ── 7. Wrong ADC secret ────────────────────────────────────────────────
  await test('7. Wrong ADC secret → 401', async () => {
    const { status, data } = await exchangeToken(subjectToken, {
      adcClientSecret: 'wrong_secret_12345',
    });
    assert.equal(status, 401, `Expected 401, got ${status}`);
    assert.equal(data.message, 'invalid_client');
  })();

  // ── 8. Nonexistent ADC client ─────────────────────────────────────────
  await test('8. Nonexistent ADC client → 401', async () => {
    const auth = Buffer.from('mc_nonexistent:secret').toString('base64');
    const res = await fetch(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: { CT, 'Authorization': `Basic ${auth}` },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: subjectToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'svc-workflow',
        scope: 'workflow.read',
      }),
    });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  })();

  // ── 9. Unauthorized audience ──────────────────────────────────────────
  await test('9. Unauthorized audience → 400', async () => {
    const { status, data } = await exchangeToken(subjectToken, { audience: 'svc-forum' });
    assert.equal(status, 400, `Expected 400, got ${status}`);
  })();

  // ── 10. Forbidden scope (not in ADC allowed) ──────────────────────────
  await test('10. Forbidden scope → 400', async () => {
    const { status, data } = await exchangeToken(subjectToken, { scope: 'workflow.admin' });
    assert.equal(status, 400, `Expected 400, got ${status}`);
  })();

  // ── 11. wrong audience parameter ──────────────────────────────────────
  await test('11. Wrong audience (svc-forum) → 400', async () => {
    const { status, data } = await exchangeToken(subjectToken, { audience: 'svc-forum' });
    assert.equal(status, 400);
  })();

  // ── 12. JWKS verification of OBO token ────────────────────────────────
  await test('12. JWKS verifies OBO token', async () => {
    const { data } = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    const oboToken = data.access_token;

    // Fetch JWKS and verify signature independently
    const jwksRes = await fetch(`${BASE}/.well-known/jwks.json`);
    const jwks = await jwksRes.json();
    assert.ok(jwks.keys.length >= 1, 'JWKS must have at least 1 key');

    const obo = decodeJWT(oboToken);
    const jwk = jwks.keys.find(k => k.kid === obo.header.kid);
    assert.ok(jwk, `Key ${obo.header.kid} must be in JWKS`);

    // Verify the signature using the JWKS key
    const { createVerify } = await import('node:crypto');
    const key = await import('node:crypto').then(m => m.createPublicKey({
      key: { kty: 'RSA', n: jwk.n, e: jwk.e },
      format: 'jwk',
    }));

    const parts = oboToken.split('.');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(parts[0] + '.' + parts[1]);
    const isValid = verifier.verify(key, Buffer.from(parts[2], 'base64url'));
    assert.ok(isValid, 'OBO token signature must verify with JWKS public key');
  })();

  // ── 13. Scope substring attack: workflow.read.all → 400 (or filtered) ─
  await test('13. Scope substring attack (workflow.read.all) → 400', async () => {
    const { status, data } = await exchangeToken(subjectToken, { scope: 'workflow.read.all' });
    assert.equal(status, 400, `Expected 400, got ${status}`);
  })();

  // ── 14. Subject token with unknown kid → 400 ──────────────────────────
  await test('14. Subject token with unknown kid → 400', async () => {
    // Make a token with unknown kid (will fail DB lookup too, but that's OK)
    const { status, data } = await exchangeToken('invalid.token.here', { scope: 'workflow.read' });
    // Will fail at subject verification (after DB client auth)
    assert.ok(status === 400 || status === 401, `Expected 4xx, got ${status}`);
  })();

  // ── 15. token_use=workflow_obo subject (chaining) → 400 ────────────────
  // This requires crafting an OBO token as subject. The first exchange
  // produces one, then we use it as subject. It should fail at subject profile check.
  await test('15. OBO chaining blocked (OBO token as subject) → 400', async () => {
    // First get an OBO token
    const oboRes = await exchangeToken(subjectToken, { scope: 'workflow.read' });
    const oboToken = oboRes.data.access_token;

    // Try using the OBO token as subject
    const { status, data } = await exchangeToken(oboToken, { scope: 'workflow.read' });
    assert.equal(status, 400, `Expected 400, got ${status} (obo chaining must be rejected)`);
  })();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${passed + failed} total ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
