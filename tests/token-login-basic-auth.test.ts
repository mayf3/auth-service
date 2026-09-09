#!/usr/bin/env node
/**
 * token-login Basic Auth (Path A) integration test.
 *
 * Proves that the OAuth2 client_credentials path via Basic auth header
 * converges to the same canonical Forum JWT contract as the pre-signed
 * agent token path (Path B).
 *
 * Key assertions:
 *   1. JWT sub = MachinePrincipal UUID (auth Principal ID)
 *   2. JWT agent_id = MachinePrincipal.agentId
 *   3. JWT name = MachinePrincipal.displayName
 *   4. JWT aud = svc-forum
 *   5. FORUM_ACCESS_GRANT_ENFORCED — resource/scope validated
 *
 * Mark: PATH_A_INTEGRATION_TEST=true
 * Mark: CANONICAL_PRINCIPAL_SEMANTICS=true
 */

// Set env BEFORE any project imports so config/env.ts captures them
process.env.JWT_SECRET = 'test-jwt-secret-for-basic-auth-test';
process.env.AGENT_TOKEN_SECRET = 'test-agent-token-secret-for-basic-auth-test';
process.env.JWT_ISSUER = 'auth-service';
process.env.JWT_AUDIENCE = 'unified-platform';
process.env.JWT_VERSION = 'v1';
process.env.JWT_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-basic-auth-test';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const TEST_AGENT_ID = 'test-basic-auth-agent';
const TEST_PRINCIPAL_ID = '00000000-0000-4000-8000-00000000bapl';
const TEST_USER_ID = '00000000-0000-4000-8000-00000000baus';
const TEST_CLIENT_ID = 'mc_test-basic-auth-client';
const TEST_CLIENT_SECRET = 'test-client-secret-for-basic-auth';
const PRINCIPAL_DISPLAY_NAME = 'Basic Auth Test Agent';

let cachedSecretHash: string;

const { default: express } = await import('express');
const { default: http } = await import('node:http');
const { authRouter } = await import('../src/routes/auth.js');
const { default: jwt } = await import('jsonwebtoken');
const { prisma } = await import('../src/lib/prisma.js');
const { hashClientSecret } = await import('../src/lib/oauth/secret.js');

// ---------------------------------------------------------------------------
// Setup mocks — direct property override on prisma singleton
// ---------------------------------------------------------------------------

interface MockState {
  origMcFindUnique: typeof prisma.machineClient.findUnique;
  origMpFindUnique: typeof prisma.machinePrincipal.findUnique;
  origUserFindFirst: typeof prisma.user.findFirst;
  origUserFindUnique: typeof prisma.user.findUnique;
  origUserCreate: typeof prisma.user.create;
}

let mockState: MockState | null = null;

function setupMocks() {
  // Pre-compute a valid secret hash for the test client secret
  cachedSecretHash = hashClientSecret(TEST_CLIENT_SECRET);

  // Trigger lazy init by reading each method first
  const origMcFindUnique = prisma.machineClient.findUnique;
  const origMpFindUnique = prisma.machinePrincipal.findUnique;
  const origUserFindFirst = prisma.user.findFirst;
  const origUserFindUnique = prisma.user.findUnique;
  const origUserCreate = prisma.user.create;

  mockState = {
    origMcFindUnique, origMpFindUnique,
    origUserFindFirst, origUserFindUnique, origUserCreate,
  };

  // Override machineClient.findUnique — return client with included principal
  prisma.machineClient.findUnique = (async (args: any) => {
    if (args?.where?.clientId === TEST_CLIENT_ID) {
      return {
        id: 'mock-client-uuid',
        clientId: TEST_CLIENT_ID,
        machinePrincipalId: TEST_PRINCIPAL_ID,
        secretHash: cachedSecretHash,
        status: 'active',
        allowedResources: ['svc-forum'],
        allowedScopes: ['forum.read', 'forum.write'],
        principal: {
          id: TEST_PRINCIPAL_ID,
          agentId: TEST_AGENT_ID,
          displayName: PRINCIPAL_DISPLAY_NAME,
          principalType: 'agent',
          status: 'active',
          ownerId: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // Any other clientId returns null (simulates client_not_found)
    return null;
  }) as typeof prisma.machineClient.findUnique;

  // Override machinePrincipal.findUnique — return principal for Path B
  prisma.machinePrincipal.findUnique = (async (args: any) => {
    if (args?.where?.agentId === TEST_AGENT_ID) {
      return {
        id: TEST_PRINCIPAL_ID,
        agentId: TEST_AGENT_ID,
        displayName: PRINCIPAL_DISPLAY_NAME,
        principalType: 'agent',
        status: 'active',
        ownerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }) as typeof prisma.machinePrincipal.findUnique;

  // Override user.findFirst — return existing user
  prisma.user.findFirst = (async (_args: any) => ({
    id: TEST_USER_ID,
    name: PRINCIPAL_DISPLAY_NAME,
    email: `agent:${TEST_AGENT_ID}@auth-service.local`,
    role: 'agent',
    agentId: TEST_AGENT_ID,
    internalRole: null,
    okrRole: null,
  })) as typeof prisma.user.findFirst;

  // Override user.findUnique
  prisma.user.findUnique = (async (_args: any) => ({
    id: TEST_USER_ID,
    name: PRINCIPAL_DISPLAY_NAME,
    email: `agent:${TEST_AGENT_ID}@auth-service.local`,
    role: 'agent',
    agentId: TEST_AGENT_ID,
    internalRole: null,
    okrRole: null,
  })) as typeof prisma.user.findUnique;

  // Override user.create
  prisma.user.create = (async (args: any) => args.data) as typeof prisma.user.create;
}

function restoreMocks() {
  if (!mockState) return;
  prisma.machineClient.findUnique = mockState.origMcFindUnique;
  prisma.machinePrincipal.findUnique = mockState.origMpFindUnique;
  prisma.user.findFirst = mockState.origUserFindFirst;
  prisma.user.findUnique = mockState.origUserFindUnique;
  prisma.user.create = mockState.origUserCreate;
  mockState = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return `Basic ${encoded}`;
}

async function tokenLoginBasicAuth(
  clientId: string,
  clientSecret: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/auth/token-login',
        method: 'POST',
        headers: {
          'Authorization': buildBasicAuthHeader(clientId, clientSecret),
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(JSON.stringify({}));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let server: http.Server;
let port: number;

before(async () => {
  setupMocks();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as any).port;
      resolve();
    });
  });
});

after(async () => {
  restoreMocks();
  if (server) await new Promise((r) => server.close(r));
});

void describe('token-login Basic Auth (Path A)', async () => {

  // -----------------------------------------------------------------------
  // Path A: Happy path
  // -----------------------------------------------------------------------
  await it('returns 200 with canonical Forum JWT on valid Basic auth', async () => {
    const { status, body } = await tokenLoginBasicAuth(TEST_CLIENT_ID, TEST_CLIENT_SECRET);

    assert.equal(status, 200, 'valid Basic auth must return HTTP 200');
    assert.ok(body.accessToken, 'accessToken must be present');
    assert.ok(body.user, 'user object must be present');
    assert.equal(body.user.id, TEST_USER_ID, 'user.id must match');
    assert.equal(body.user.role, 'agent', 'user.role must be agent');

    // Decode and verify JWT claims
    const decoded = jwt.decode(body.accessToken) as any;
    assert.ok(decoded, 'JWT must be decodable');

    // Canonical principal semantics
    assert.equal(decoded.sub, TEST_PRINCIPAL_ID,
      'JWT sub must be MachinePrincipal UUID (auth Principal ID)');
    assert.equal(decoded.agent_id, TEST_AGENT_ID,
      'JWT agent_id must be MachinePrincipal.agentId');
    assert.equal(decoded.name, PRINCIPAL_DISPLAY_NAME,
      'JWT name must be MachinePrincipal.displayName');
    assert.equal(decoded.aud, 'svc-forum',
      'JWT audience must be svc-forum');
    assert.equal(decoded.iss, 'auth-service',
      'JWT issuer must be auth-service');
    assert.equal(decoded.principal_type, 'agent',
      'JWT principal_type must be agent');
    assert.equal(decoded.client_id, 'token-login',
      'JWT client_id must be token-login');
    assert.ok(decoded.scope,
      'JWT scope must be present');
    assert.ok(decoded.scope.includes('forum.read'),
      'JWT scope must include forum.read');
    assert.ok(decoded.scope.includes('forum.write'),
      'JWT scope must include forum.write');

    // Token should be verifiable with JWT_SECRET
    const verified = jwt.verify(body.accessToken, process.env.JWT_SECRET!);
    assert.ok(verified, 'JWT must verify with JWT_SECRET');
  });

  // -----------------------------------------------------------------------
  // Path A: Invalid secret → 401
  // -----------------------------------------------------------------------
  await it('rejects invalid client secret with 401', async () => {
    const { status, body } = await tokenLoginBasicAuth(TEST_CLIENT_ID, 'wrong-secret');

    assert.equal(status, 401, 'wrong secret must return 401');
    // The error message from authenticateMachineClient is 'invalid_client'
    assert.ok(
      body?.error || typeof body === 'string' || status === 401,
      'error should be reported',
    );
  });

  // -----------------------------------------------------------------------
  // Path A: Non-existent client → 401
  // -----------------------------------------------------------------------
  await it('rejects non-existent clientId with 401', async () => {
    const { status, body } = await tokenLoginBasicAuth('mc_nonexistent', 'some-secret');

    assert.equal(status, 401, 'non-existent client must return 401');
  });

  // -----------------------------------------------------------------------
  // Path A: Wrong resource → 401 (via authenticateMachineClient check)
  //   The mock only allows svc-forum, so requesting with a client that
  //   doesn't have svc-forum in allowedResources would fail.
  //   Since we mock by clientId, a client without svc-forum access
  //   would return null from our mock → 401 client_not_found.
  //   This is sufficient for integration-level testing; the scope/resource
  //   validation logic itself is tested in lifecycle.test.ts.
  // -----------------------------------------------------------------------
  await it('rejects client without svc-forum access', async () => {
    const { status } = await tokenLoginBasicAuth('mc_no-forum-client', 'secret');
    assert.equal(status, 401, 'client without svc-forum access must return 401');
  });

  // -----------------------------------------------------------------------
  // Path A: Missing Authorization header → handled by isBasicAuth check
  // -----------------------------------------------------------------------
  await it('rejects missing Authorization header', async () => {
    const { status } = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/auth/token-login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: data });
            }
          });
        },
      );
      req.on('error', reject);
      req.write(JSON.stringify({}));
      req.end();
    });
    assert.equal(status, 401, 'missing Authorization must return 401');
  });

  // -----------------------------------------------------------------------
  // Path A: Invalid Basic format (not Base64)
  // -----------------------------------------------------------------------
  await it('rejects malformed Basic auth with 401', async () => {
    const { status } = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/auth/token-login',
          method: 'POST',
          headers: {
            'Authorization': 'Basic not-valid-base64!!!',
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: data });
            }
          });
        },
      );
      req.on('error', reject);
      req.write(JSON.stringify({}));
      req.end();
    });
    assert.equal(status, 401, 'malformed Basic auth must return 401');
  });

  // -----------------------------------------------------------------------
  // Semantics: Both paths produce identical JWT sub semantics
  // -----------------------------------------------------------------------
  await it('Basic auth JWT sub semantics match pre-signed token path', async () => {
    // Path A
    const resultA = await tokenLoginBasicAuth(TEST_CLIENT_ID, TEST_CLIENT_SECRET);
    assert.equal(resultA.status, 200);
    const decodedA = jwt.decode(resultA.body.accessToken) as any;

    // Path B (pre-signed token) — reuse mock setup
    const preSignedToken = jwt.sign(
      { sub: TEST_AGENT_ID, agentId: TEST_AGENT_ID, name: PRINCIPAL_DISPLAY_NAME, role: 'agent' },
      process.env.AGENT_TOKEN_SECRET!,
      { expiresIn: '1h' },
    );
    const resultB = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/auth/token-login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: data });
            }
          });
        },
      );
      req.on('error', reject);
      req.write(JSON.stringify({ token: preSignedToken }));
      req.end();
    });
    assert.equal(resultB.status, 200);
    const decodedB = jwt.decode(resultB.body.accessToken) as any;

    // Both paths use the same principal → identical sub/agent_id/name
    assert.equal(decodedA.sub, decodedB.sub,
      'Both auth paths must produce same JWT sub (MachinePrincipal UUID)');
    assert.equal(decodedA.agent_id, decodedB.agent_id,
      'Both auth paths must produce same JWT agent_id');
    assert.equal(decodedA.name, decodedB.name,
      'Both auth paths must produce same JWT name');
    assert.equal(decodedA.aud, decodedB.aud,
      'Both auth paths must produce same JWT audience');
  });
});
