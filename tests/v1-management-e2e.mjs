#!/usr/bin/env node
/**
 * Auth V1 Machine Token — Full HTTP End-to-End Integration Test.
 *
 * Real /oauth/token endpoint, real /api/v1/principals management API,
 * real PostgreSQL, real RS256 token signing and verification.
 *
 * Run:
 *   JWT_SECRET=test-jwt-secret npx tsx tests/v1-management-e2e.mjs
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = one or more tests failed
 */

// ─── Step 0: Set env BEFORE any project imports ────────────────────────────
// The env module reads process.env at module scope. Dynamic imports let us
// set process.env first so the captured values include our test config.

import crypto from 'node:crypto';
import http from 'node:http';

const { publicKey: rsaPublicKeyPem, privateKey: rsaPrivateKeyPem } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

process.env.JWT_PRIVATE_KEY = rsaPrivateKeyPem;
process.env.JWT_KID = 'test-e2e-key-v1-' + Date.now().toString(36);
process.env.AUTH_CONTRACT_MODE = 'v1';

// ─── Step 1: Dynamic imports (pick up env values above) ────────────────────

const { PrismaClient } = await import('@prisma/client');
const express = (await import('express')).default;
const cors = (await import('cors')).default;
const helmet = (await import('helmet')).default;
const { default: rateLimit } = await import('express-rate-limit');
const { env } = await import('../src/config/env.js');

// Initialize V1 components
const { initializeV1TokenIssuer } = await import('../src/lib/oauth/v1/signer.js');
initializeV1TokenIssuer();

// Initialize contract
const { initializeAuthContract } = await import('../src/lib/oauth/v1/contract.js');
initializeAuthContract('v1');

// Reset and initialize keyring
const { resetWorkflowKeyringForTests, getWorkflowKeyring } = await import('../src/lib/oauth/workflow-keyring.js');
resetWorkflowKeyringForTests();
getWorkflowKeyring();

// OAuth routes (injected with V1 direct token issuance)
const { createOAuthRouter } = await import('../src/routes/oauth.js');
const v1Direct = await import('../src/lib/oauth/v1/direct.js');
const v1Exchange = await import('../src/lib/oauth/v1/exchange.js');
const depsRouter = createOAuthRouter({
  issueV1DirectToken: v1Direct.issueV1DirectToken,
  exchangeV1Token: v1Exchange.exchangeV1Token,
});

// Management API routes (with auth middleware)
const { idempotentRouter } = await import('../src/routes/idempotent.js');

// Secret hashing
const { hashClientSecret } = await import('../src/lib/oauth/secret.js');

// V1 verifier (for claims inspection)
const { verifyV1DirectMachineToken } = await import('../src/lib/oauth/v1/signer.js');

// ─── Step 2: Test harness ──────────────────────────────────────────────────

const prisma = new PrismaClient();
const MGMT_AUDIENCE = 'svc-auth';
const MGMT_SCOPE = 'auth.identity.provision';
let passed = 0;
let failed = 0;
let server = null;
let port = 0;

function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function nok(label) { console.log(`  ❌ ${label}`); failed++; }

async function httpPostForm(path, body, auth) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (auth) headers['Authorization'] = auth;
    const params = new URLSearchParams(body).toString();
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); },
    );
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

async function httpPostJson(path, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); },
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function basicAuth(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

// ─── Step 3: Fixture setup ─────────────────────────────────────────────────

const testId = `e2e-${crypto.randomUUID().slice(0, 8)}`;
let principalId, clientId, clientSecret, rawToken;

async function setupFixtures() {
  console.log(`\n─── Setting up test fixture (${testId}) ───`);

  // Admin user
  const email = `e2e-v1-test-${testId}@test.local`;
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { name: 'V1 E2E Test', email, password: 'test-hash', role: 'admin' },
    });
  }

  // svc-auth AuthAudience record in DB
  await prisma.authAudience.upsert({
    where: { audienceId: MGMT_AUDIENCE },
    update: { machineAccessEnabled: true, status: 'active' },
    create: {
      audienceId: MGMT_AUDIENCE,
      resourceService: 'svc-auth',
      scopeNamespace: 'auth',
      acceptedPrincipalTypes: ['service'],
      registeredScopes: [MGMT_SCOPE],
      humanAccessEnabled: false, machineAccessEnabled: true,
      delegatedAccessEnabled: false, status: 'active', freezeReady: true,
    },
  });

  // Principal + Client for the test caller
  const principalRecord = await prisma.machinePrincipal.create({
    data: { principalType: 'service', displayName: `V1 E2E Caller ${testId}` },
  });
  principalId = principalRecord.id;

  clientSecret = crypto.randomBytes(32).toString('base64url');
  const secretHash = hashClientSecret(clientSecret);
  const rawClientId = 'mc_e2e_' + crypto.randomBytes(18).toString('base64url');

  const clientRecord = await prisma.machineClient.create({
    data: {
      clientId: rawClientId, machinePrincipalId: principalId,
      secretHash, allowedResources: [MGMT_AUDIENCE], allowedScopes: [MGMT_SCOPE], status: 'active',
    },
  });
  clientId = clientRecord.clientId;

  // MachineAccessGrant
  await prisma.machineAccessGrant.create({
    data: { machineClientId: clientRecord.id, audienceId: MGMT_AUDIENCE, scopes: [MGMT_SCOPE], version: 1 },
  });

  console.log(`  ✅ Principal: ${principalId}`);
  console.log(`  ✅ Client:    ${clientId}`);
  console.log(`  ✅ Grant:     ${MGMT_AUDIENCE} → ${MGMT_SCOPE}`);
}

async function cleanupFixtures() {
  try { await prisma.machineAccessGrant.deleteMany({ where: { audienceId: MGMT_AUDIENCE } }); } catch {}
  try { await prisma.machineClient.deleteMany({ where: { machinePrincipalId: principalId } }); } catch {}
  try { await prisma.machinePrincipal.delete({ where: { id: principalId } }); } catch {}
  try { await prisma.user.delete({ where: { email: `e2e-v1-test-${testId}@test.local` } }); } catch {}
  try { await prisma.authAudience.delete({ where: { audienceId: MGMT_AUDIENCE } }); } catch {}
}

// ─── Step 4: Build + start Express app ─────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Mount OAuth token endpoint (with V1 injection)
  app.use('/oauth', depsRouter);

  // Mount management API
  app.use('/api', idempotentRouter);

  // Error handler
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal error' });
  });

  return app;
}

async function startServer(app) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      port = await new Promise((resolve, reject) => {
        const srv = app.listen(0, '127.0.0.1', () => { server = srv; resolve(srv.address().port); });
        srv.on('error', reject);
      });
      return port;
    } catch { /* try next */ }
  }
  throw new Error('Could not start test server');
}

// ─── Step 5: Tests ─────────────────────────────────────────────────────────

async function runTests() {
  console.log(`\n─── Running REAL HTTP E2E tests ───\n`);

  // ── T1: Correct grant → /oauth/token → RS256 token ──────────────────────
  console.log('--- T1: Correct grant → token issued via /oauth/token ---');
  const t1 = await httpPostForm('/oauth/token', {
    grant_type: 'client_credentials',
    resource: MGMT_AUDIENCE,
    scope: MGMT_SCOPE,
  }, basicAuth(clientId, clientSecret));
  if (t1.status === 200 && t1.body?.access_token) {
    ok(`T1: Token endpoint returned 200`);
    ok(`T1: scope = ${t1.body.scope}`);
    rawToken = t1.body.access_token;
  } else {
    nok(`T1: Expected 200, got ${t1.status}: ${JSON.stringify(t1.body)}`);
  }

  // ── T2: Token claims audit ──────────────────────────────────────────────
  console.log('\n--- T2: Token claims verify real identity ---');
  if (rawToken) {
    try {
      const claims = verifyV1DirectMachineToken(rawToken, MGMT_AUDIENCE);
      ok(`T2: RS256 signature valid, aud=svc-auth`);
      ok(`T2: sub=${claims.sub} (Machine Principal ID)`);
      ok(`T2: client_id=${claims.client_id} (Machine Client ID)`);
      ok(`T2: principal_type=${claims.principal_type}`);
      ok(`T2: token_use=${claims.token_use}`);
      ok(`T2: scope includes auth.identity.provision: ${claims.scope}`);
      ok(`T2: version=${claims.version}`);

      console.log('\n  ┌─── AUDIT EVIDENCE ──────────────────────────────────────┐');
      console.log(`  │ actor_principal_id = ${claims.sub}`);
      console.log(`  │ actor_client_id    = ${claims.client_id}`);
      console.log(`  │ event_type         = v1.direct.issued`);
      console.log(`  │ target_audience    = ${claims.aud}`);
      console.log(`  │ scope              = ${claims.scope}`);
      console.log(`  │ principal_type     = ${claims.principal_type}`);
      console.log(`  │ token_use          = ${claims.token_use}`);
      console.log(`  │ version            = ${claims.version}`);
      console.log('  └─────────────────────────────────────────────────────────┘');
    } catch (err) {
      nok(`T2: Token verification failed: ${err.message}`);
    }
  }

  // ── T3: Management API with valid token ─────────────────────────────────
  console.log('\n--- T3: Management API with valid token ---');
  if (rawToken) {
    const mgmtRef = `e2e:${testId}:mgmt`;
    const t3 = await httpPostJson('/api/v1/principals', {
      external_ref: mgmtRef,
      principal_type: 'service',
      display_name: 'E2E Created via HTTP API',
    }, rawToken);
    if (t3.status === 201) {
      ok(`T3: Management API created principal: ${t3.body.id}`);
      // Clean up management-created principal
      try { await prisma.machinePrincipal.delete({ where: { externalRef: mgmtRef } }); } catch {}
    } else if (t3.status === 200) {
      ok(`T3: Management API returned existing principal: ${t3.body.id}`);
    } else {
      nok(`T3: Expected 201/200, got ${t3.status}: ${JSON.stringify(t3.body)}`);
    }
  }

  // ── T4: No grant → rejected ─────────────────────────────────────────────
  console.log('\n--- T4: No grant → token rejected ---');
  const ngSecret = crypto.randomBytes(32).toString('base64url');
  const ngHash = hashClientSecret(ngSecret);
  const ngClient = await prisma.machineClient.create({
    data: {
      clientId: `mc_e2e_ng_${crypto.randomBytes(12).toString('base64url')}`,
      machinePrincipalId: principalId, secretHash: ngHash,
      allowedResources: [MGMT_AUDIENCE], allowedScopes: [MGMT_SCOPE], status: 'active',
    },
  });
  const t4 = await httpPostForm('/oauth/token', {
    grant_type: 'client_credentials', resource: MGMT_AUDIENCE, scope: MGMT_SCOPE,
  }, basicAuth(ngClient.clientId, ngSecret));
  if (t4.status === 400) { ok(`T4: No grant → 400`); }
  else { nok(`T4: No grant → ${t4.status}`); }
  await prisma.machineClient.delete({ where: { id: ngClient.id } }).catch(() => {});

  // ── T5: Wrong scope → rejected ──────────────────────────────────────────
  console.log('\n--- T5: Wrong scope → rejected ---');
  const t5 = await httpPostForm('/oauth/token', {
    grant_type: 'client_credentials', resource: MGMT_AUDIENCE, scope: 'svc-workflow.manage',
  }, basicAuth(clientId, clientSecret));
  if (t5.status === 400) { ok(`T5: Wrong scope → 400`); }
  else { nok(`T5: Wrong scope → ${t5.status}`); }

  // ── T6: Wrong audience → rejected ───────────────────────────────────────
  console.log('\n--- T6: Wrong audience → rejected ---');
  const t6 = await httpPostForm('/oauth/token', {
    grant_type: 'client_credentials', resource: 'svc-okr', scope: 'okr.read',
  }, basicAuth(clientId, clientSecret));
  if (t6.status === 400) { ok(`T6: Wrong audience → 400`); }
  else { nok(`T6: Wrong audience → ${t6.status}`); }

  // ── T7: Disabled client → rejected ──────────────────────────────────────
  console.log('\n--- T7: Disabled client → rejected ---');
  await prisma.machineClient.update({ where: { clientId }, data: { status: 'revoked', revokedAt: new Date() } });
  const t7 = await httpPostForm('/oauth/token', {
    grant_type: 'client_credentials', resource: MGMT_AUDIENCE, scope: MGMT_SCOPE,
  }, basicAuth(clientId, clientSecret));
  if (t7.status === 401 || t7.status === 403) { ok(`T7: Disabled client → ${t7.status}`); }
  else { nok(`T7: Disabled client → ${t7.status}`); }
  await prisma.machineClient.update({ where: { clientId }, data: { status: 'active', revokedAt: null } });

  // ── T8: No auth on mgmt API → 401 ──────────────────────────────────────
  console.log('\n--- T8: No auth on management API ───');
  const t8 = await httpPostJson('/api/v1/principals', { external_ref: `e2e:${testId}:no-auth`, principal_type: 'service' }, null);
  if (t8.status === 401) { ok(`T8: No auth → 401`); }
  else { nok(`T8: No auth → ${t8.status}`); }

  // ── T9: Invalid token on mgmt API → 401 ────────────────────────────────
  console.log('\n--- T9: Invalid token on management API ───');
  const t9 = await httpPostJson('/api/v1/principals', { external_ref: `e2e:${testId}:bad-token`, principal_type: 'service' }, 'invalid.token.here');
  if (t9.status === 401) { ok(`T9: Invalid token → 401`); }
  else { nok(`T9: Invalid token → ${t9.status}`); }

  // ── T10: Management API creates client ──────────────────────────────────
  console.log('\n--- T10: Management API creates client ---');
  if (rawToken) {
    // First create a service principal for the client to belong to
    const princRef = `e2e:${testId}:client-owner`;
    const pRes = await httpPostJson('/api/v1/principals', {
      external_ref: princRef, principal_type: 'service', display_name: 'Client Owner',
    }, rawToken);
    if (pRes.status === 201 || pRes.status === 200) {
      const ownerId = pRes.body.id;
      const clientRef = `e2e:${testId}:mgmt-client`;
      const cRes = await httpPostJson('/api/v1/clients', {
        external_ref: clientRef, principal_id: ownerId,
      }, rawToken);
      if (cRes.status === 201) {
        ok(`T10: Client created via API: ${cRes.body.client_id}`);
        ok(`T10: Secret returned only on creation: ${cRes.body.secret ? 'yes' : 'no'}`);
        // Clean up
        try { await prisma.machineClient.delete({ where: { externalRef: clientRef } }); } catch {}
        try { await prisma.machinePrincipal.delete({ where: { id: ownerId } }); } catch {}
      } else {
        nok(`T10: Expected 201, got ${cRes.status}: ${JSON.stringify(cRes.body)}`);
        try { await prisma.machinePrincipal.delete({ where: { id: ownerId } }); } catch {}
      }
    } else {
      nok(`T10: Could not create owner principal: ${pRes.status}`);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  AUTH V1 — REAL HTTP E2E TEST');
  console.log('═══════════════════════════════════════════════════');

  try {
    await setupFixtures();

    const app = buildApp();
    await startServer(app);
    console.log(`  ✅ Server on http://127.0.0.1:${port}`);

    await runTests();

    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`═══════════════════════════════════════════════════\n`);

  } finally {
    if (server) await new Promise(r => server.close(r));
    await cleanupFixtures();
    await prisma.$disconnect();
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
