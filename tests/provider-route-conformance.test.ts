/**
 * Machine Token Provider — Real HTTP POST /oauth/token Route Conformance
 *
 * Tests pass through the full production pipeline:
 *   Machine Token Provider → HTTP POST → express.urlencoded
 *   → POST /oauth/token Router → extractBasicAuth
 *   → client_credentials branch → authorizeV1DirectToken
 *   → issueV1DirectToken → signV1DirectMachineToken
 *   → RS256 JWT → Provider receives token
 *
 * The router is created via createOAuthRouter(deps) with a synthetic
 * V1DirectDatabase. The RS256 keyring is initialized with ephemeral
 * test keys. No production database, files, or credentials are touched.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';

import { generateTestKeyPair, configureKeyringEnv } from './oauth/_workflow-test-keys.js';
import { resetWorkflowKeyringForTests } from '../src/lib/oauth/workflow-keyring.js';
import { createOAuthRouter } from '../src/routes/oauth.js';
import type { OAuthRouterDependencies } from '../src/routes/oauth.js';
import { issueV1DirectToken } from '../src/lib/oauth/v1/direct.js';
import type { V1DirectDatabase, V1DirectTokenParams } from '../src/lib/oauth/v1/direct.js';
import { hashClientSecret } from '../src/lib/oauth/secret.js';
import { initializeAuthContract, resetAuthContractForTests, getV1AudienceDefinitions } from '../src/lib/oauth/v1/contract.js';
import { initializeV1TokenIssuer } from '../src/lib/oauth/v1/signer.js';
import { OAuthHttpError } from '../src/utils/http-error.js';

import { createMachineTokenProvider } from '../packages/machine-token-provider/src/provider.js';

// ---- Environment setup (overrides dotenv; keyring reads process.env live) ----

const TEST_KEY = generateTestKeyPair('route-test-kid', 2048);
configureKeyringEnv({ activeKid: TEST_KEY.kid, activePrivateKeyPem: TEST_KEY.privateKeyPem });
process.env.JWT_ISSUER = 'auth-service';
process.env.AUTH_CONTRACT_MODE = 'v1';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_PRINCIPAL_ID = '20000000-0000-4000-8000-000000000001';
const TEST_CLIENT_ID = 'route-conformance-client';
const TEST_CLIENT_SECRET = 'route-conformance-secret';
const TEST_SECRET_HASH = hashClientSecret(TEST_CLIENT_SECRET);
const TEST_RESOURCE = 'svc-workflow';
const TEST_AGENT_ID = 'route-conformance-agent';
const TEST_OWNER_USER_ID = '10000000-0000-4000-8000-000000000001';

let storedAudience: Record<string, unknown>;

function buildStoredAudience() {
  const def = getV1AudienceDefinitions().find((d: any) => d.audienceId === TEST_RESOURCE);
  if (!def) throw new Error(`Audience ${TEST_RESOURCE} not found in runtime definitions`);
  return { ...def, version: 1 };
}

function freshDatabase(): V1DirectDatabase {
  return {
    machineClient: {
      findUnique: async () => ({
        id: '30000000-0000-4000-8000-000000000001',
        clientId: TEST_CLIENT_ID,
        machinePrincipalId: TEST_PRINCIPAL_ID,
        secretHash: TEST_SECRET_HASH,
        status: 'active' as const,
        principal: {
          id: TEST_PRINCIPAL_ID,
          principalType: 'agent' as const,
          agentId: TEST_AGENT_ID,
          ownerUserId: TEST_OWNER_USER_ID,
          status: 'active' as const,
        },
        accessGrants: [{
          audienceId: (storedAudience as any).audienceId,
          scopes: ['workflow.read', 'workflow.execute'],
          version: 1,
          audience: storedAudience,
        }],
      }),
    },
  };
}

function makeIssueV1DirectTokenWithTestDb() {
  const db = freshDatabase();
  return (params: V1DirectTokenParams) => issueV1DirectToken(params, db);
}

// ---------------------------------------------------------------------------
// Express app + server lifecycle
// ---------------------------------------------------------------------------

let server: http.Server | null = null;
let serverUrl = '';

async function startTestServer(): Promise<string> {
  const deps: OAuthRouterDependencies = {
    issueV1DirectToken: makeIssueV1DirectTokenWithTestDb(),
  };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/oauth', createOAuthRouter(deps));

  // Minimal OAuth error handler (same logic as production server.ts)
  app.use((err: Error, _req: any, res: any, _next: any) => {
    if (err instanceof OAuthHttpError) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'server_error' });
  });

  return new Promise((resolve, reject) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as import('net').AddressInfo;
      server = srv;
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve(serverUrl);
    });
    srv.on('error', reject);
  });
}

async function stopTestServer(): Promise<void> {
  if (!server) return;
  return new Promise<void>((resolve) => {
    server!.close(() => {
      server = null;
      serverUrl = '';
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.before(async () => {
  // Clear cached keyring so it picks up the test key from process.env
  resetWorkflowKeyringForTests();

  // Initialize the auth contract (loads runtime snapshot)
  resetAuthContractForTests();
  initializeAuthContract('v1');

  // Initialize the RS256 signer with the test keyring
  initializeV1TokenIssuer();

  // Build the stored audience definition matching the runtime registry
  storedAudience = buildStoredAudience();
});

test.after(async () => {
  await stopTestServer();
});

// ── 1. Valid token request ─────────────────────────────────────────────

test('route conformance: valid client_credentials returns RS256 JWT', async (t) => {
  await startTestServer();

  const provider = createMachineTokenProvider({
    tokenEndpoint: `${serverUrl}/oauth/token`,
    clientId: TEST_CLIENT_ID,
    credentialProvider: async () => TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scopes: ['workflow.read'],
    timeoutMs: 5000,
  });

  const token = await provider();
  assert.ok(typeof token === 'string' && token.length > 0, 'should return a token');

  const parts = token.split('.');
  assert.equal(parts.length, 3, 'should be a 3-part JWT');

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
  assert.equal(header.alg, 'RS256', 'JWT must be signed with RS256');
  assert.ok(header.kid, 'kid should be present');

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  assert.equal(payload.iss, 'auth-service');
  assert.equal(payload.sub, TEST_PRINCIPAL_ID);
  assert.equal(payload.aud, TEST_RESOURCE);
  assert.equal(payload.scope, 'workflow.read');
  assert.equal(payload.client_id, TEST_CLIENT_ID);
  assert.equal(payload.token_use, 'access');
  assert.ok(payload.jti, 'jti should be present');
  assert.ok(payload.iat > 0, 'iat should be present');
  assert.ok(payload.exp > payload.iat, 'exp should be after iat');

  t.diagnostic(`JWT kid=${header.kid} sub=${payload.sub} aud=${payload.aud} scope=${payload.scope}`);
});

// ── 2. Invalid client secret ───────────────────────────────────────────

test('route conformance: invalid client secret returns AuthenticationError invalid_client', async () => {
  const provider = createMachineTokenProvider({
    tokenEndpoint: `${serverUrl}/oauth/token`,
    clientId: TEST_CLIENT_ID,
    credentialProvider: async () => 'wrong-secret-value',
    resource: TEST_RESOURCE,
    scopes: ['workflow.read'],
    timeoutMs: 5000,
  });

  try {
    await provider();
    assert.fail('Should have thrown AuthenticationError');
  } catch (err: any) {
    assert.equal(err.name, 'AuthenticationError');
    assert.equal(err.code, 'invalid_client');
    assert.equal(err.status, 401);
  }
});

// ── 3. Invalid scope ───────────────────────────────────────────────────

test('route conformance: unauthorized scope returns AuthenticationError invalid_scope', async () => {
  const provider = createMachineTokenProvider({
    tokenEndpoint: `${serverUrl}/oauth/token`,
    clientId: TEST_CLIENT_ID,
    credentialProvider: async () => TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scopes: ['nonexistent.scope'],
    timeoutMs: 5000,
  });

  try {
    await provider();
    assert.fail('Should have thrown AuthenticationError');
  } catch (err: any) {
    assert.equal(err.name, 'AuthenticationError');
    assert.equal(err.code, 'invalid_scope');
    assert.equal(err.status, 400);
  }
});

// ── 4. Missing resource (direct HTTP, since provider requires scopes) ──

test('route conformance: missing resource returns HTTP 400 invalid_grant', async () => {
  const basicAuth = Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${serverUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'workflow.read',
    }).toString(),
  });

  assert.equal(res.status, 400);
  const body = await res.json() as Record<string, unknown>;
  assert.equal(body.error, 'invalid_grant');
});

// ── 5. Invalid grant type (direct HTTP) ────────────────────────────────

test('route conformance: wrong grant_type returns HTTP 400 unsupported_grant_type', async () => {
  const basicAuth = Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${serverUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      resource: TEST_RESOURCE,
      scope: 'workflow.read',
    }).toString(),
  });

  assert.equal(res.status, 400);
  const body = await res.json() as Record<string, unknown>;
  assert.equal(body.error, 'unsupported_grant_type');
});

// ── 6. HTTP method and Content-Type verification ───────────────────────

test('route conformance: provider sends POST with x-www-form-urlencoded', async () => {
  let capturedMethod = '';
  let capturedContentType = '';

  const capturingFetch: typeof fetch = async (url, opts) => {
    capturedMethod = opts?.method ?? '';
    const hdrs = opts?.headers as Record<string, string> | undefined;
    capturedContentType = hdrs?.['Content-Type'] ?? hdrs?.['content-type'] ?? '';
    return fetch(url, opts);
  };

  const provider = createMachineTokenProvider({
    tokenEndpoint: `${serverUrl}/oauth/token`,
    clientId: TEST_CLIENT_ID,
    credentialProvider: async () => TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scopes: ['workflow.read'],
    timeoutMs: 5000,
    fetch: capturingFetch,
  });

  await provider();
  assert.equal(capturedMethod, 'POST');
  assert.ok(capturedContentType.includes('application/x-www-form-urlencoded'));
});
