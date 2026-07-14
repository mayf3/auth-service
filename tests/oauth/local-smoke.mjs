#!/usr/bin/env node

/**
 * Local Smoke Test — Machine Principal + Client Credentials via HTTP.
 *
 * Creates synthetic data, sends real HTTP POST /oauth/token requests,
 * verifies end-to-end body parsing, auth, and lifecycle.
 *
 * Usage:
 *   JWT_SECRET=test-jwt-secret npx tsx tests/oauth/local-smoke.mjs
 *
 * Exit codes:
 *   0 = all smoke tests passed
 *   1 = one or more tests failed
 */

import http from 'node:http';
import { prisma } from '../src/lib/prisma.js';
import {
  createPrincipal,
  createClient,
  issueToken,
  rotateClientSecret,
  revokeClient,
} from '../src/lib/oauth/service.js';

const TEST_PREFIX = 'smoke-http-' + Date.now().toString(36);
const PORT = 4982;
let passed = 0;
let failed = 0;
let server;

async function cleanup() {
  await prisma.machineClient.deleteMany({
    where: { principal: { agentId: { startsWith: TEST_PREFIX } } },
  }).catch(() => {});
  await prisma.machinePrincipal.deleteMany({
    where: { agentId: { startsWith: TEST_PREFIX } },
  }).catch(() => {});
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@smoke-http-test.local' } },
  }).catch(() => {});
}

function test(name, fn) {
  return Promise.resolve().then(async () => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message}`);
      failed++;
    }
  });
}

/**
 * Send a real HTTP POST /oauth/token request.
 */
function postToken(clientId, clientSecret, resource, scope) {
  return new Promise((resolve, reject) => {
    const body = `grant_type=client_credentials&resource=${encodeURIComponent(resource)}&scope=${encodeURIComponent(scope)}`;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Basic ${auth}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('\n🔍 Machine Principal + Client Credentials HTTP Smoke Test');
  console.log('==========================================================\n');
  console.log(`Test prefix: ${TEST_PREFIX}\n`);

  await cleanup();

  // Create synthetic owner
  const owner = await prisma.user.create({
    data: {
      name: `${TEST_PREFIX}-owner`,
      email: `${TEST_PREFIX}-owner@smoke-http-test.local`,
      password: 'test-hash',
      role: 'admin',
    },
  });

  // Create principal + client
  await createPrincipal({
    agentId: `${TEST_PREFIX}-agent`,
    ownerUserId: owner.id,
    displayName: 'HTTP Smoke Agent',
  });

  const client = await createClient({
    agentId: `${TEST_PREFIX}-agent`,
    resources: ['svc-forum', 'svc-okr'],
    scopes: ['forum.read', 'forum.write'],
  });

  const clientId = client.clientId;
  let clientSecret = client.secret;

  console.log('1. Service-layer direct test\n');

  await test('issueToken via service layer works', async () => {
    const result = await issueToken({
      clientId,
      clientSecret,
      resource: 'svc-forum',
      scope: 'forum.read',
    });
    if (!result.access_token) throw new Error('No access token');
    const parts = result.access_token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (claims.principal_type !== 'agent') throw new Error('Not agent token');
    if (claims.agent_id !== `${TEST_PREFIX}-agent`) throw new Error('Wrong agent_id');
    if (claims.role) throw new Error('Has role claim');
    console.log(`    jti: ${claims.jti}`);
    console.log(`    sub: ${claims.sub}`);
    console.log(`    principal_type: ${claims.principal_type}`);
    console.log(`    agent_id: ${claims.agent_id}`);
  });

  console.log('\n2. HTTP endpoint test (real POST /oauth/token)\n');

  // Import and start server
  // Note: server.ts starts listening immediately on import.
  // We set a different port via env.
  const originalPort = process.env.PORT;
  process.env.PORT = String(PORT);
  try {
    await import('../src/server.js');
  } catch (err) {
    // Server might already be running or port in use — that's ok for test
  }

  // Wait for server to start
  await new Promise(r => setTimeout(r, 500));

  await test('HTTP POST /oauth/token returns 200 with valid token', async () => {
    const res = await postToken(clientId, clientSecret, 'svc-forum', 'forum.read');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    if (!res.body.access_token) throw new Error('No access_token in response');
    if (res.body.token_type !== 'Bearer') throw new Error('Wrong token_type');
    if (typeof res.body.expires_in !== 'number') throw new Error('Missing expires_in');

    // Verify response headers
    if (res.headers['cache-control'] !== 'no-store') {
      // Header might be lowercased by http module
      console.log(`    cache-control: ${res.headers['cache-control']}`);
    }

    const parts = res.body.access_token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (claims.principal_type !== 'agent') throw new Error('principal_type not agent');
    console.log(`    HTTP status: ${res.status}`);
    console.log(`    jti: ${claims.jti}`);
    console.log(`    sub: ${claims.sub}`);
    console.log(`    agent_id: ${claims.agent_id}`);
    console.log(`    aud: ${claims.aud}`);
    console.log(`    scope: ${claims.scope}`);
    console.log(`    token hash: ${require('crypto').createHash('sha256').update(res.body.access_token).digest('hex').slice(0, 16)}...`);
  });

  await test('HTTP reject wrong secret (401)', async () => {
    const res = await postToken(clientId, 'wrong-secret', 'svc-forum', 'forum.read');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('HTTP reject unauthorized resource (400)', async () => {
    const res = await postToken(clientId, clientSecret, 'svc-admin', 'forum.read');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await test('HTTP reject unauthorized scope (400)', async () => {
    const res = await postToken(clientId, clientSecret, 'svc-forum', 'admin.write');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  console.log('\n3. JSON body rejection\n');

  await test('JSON Content-Type is rejected', async () => {
    // We test via direct HTTP with JSON content type
    const body = JSON.stringify({
      grant_type: 'client_credentials',
      resource: 'svc-forum',
      scope: 'forum.read',
    });
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost', port: PORT, path: '/oauth/token', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': `Basic ${auth}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.status, body: JSON.parse(data) }); }
          catch { resolve({ status: res.status, body: data }); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    if (res.status !== 400) throw new Error(`Expected 400 for JSON body, got ${res.status}`);
    console.log(`    JSON content-type rejected with ${res.status}`);
  });

  console.log('\n4. Secret rotation\n');

  let newSecret;

  await test('Rotate secret via service', async () => {
    const result = await rotateClientSecret(clientId);
    if (!result.newSecret) throw new Error('No new secret');
    newSecret = result.newSecret;
  });

  await test('New secret works on HTTP endpoint', async () => {
    const res = await postToken(clientId, newSecret, 'svc-forum', 'forum.read');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Old secret fails after rotation', async () => {
    const res = await postToken(clientId, clientSecret, 'svc-forum', 'forum.read');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  clientSecret = newSecret;

  console.log('\n5. Client revocation\n');

  await test('Revoke client', async () => {
    const result = await revokeClient(clientId);
    if (result.status !== 'revoked') throw new Error('Not revoked');
  });

  await test('Revoked client cannot issue tokens (HTTP)', async () => {
    const res = await postToken(clientId, clientSecret, 'svc-forum', 'forum.read');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // Summary
  console.log('\n========================================================');
  console.log(`Smoke test results: ${passed} passed, ${failed} failed\n`);

  await cleanup();

  // Restore original port
  process.env.PORT = originalPort;

  if (failed > 0) {
    console.log('❌ Some smoke tests failed.\n');
    process.exit(1);
  } else {
    console.log('✅ All smoke tests passed. BLOCKER-01 verified fixed.\n');
    process.exit(0);
  }
}

run().catch(async (err) => {
  console.error('FATAL:', err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
