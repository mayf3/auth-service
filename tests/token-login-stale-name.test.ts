#!/usr/bin/env node
/**
 * token-login contract test (revised for the agent-token-contract-v1 rewrite).
 *
 * The original test asserted a now-removed behavior: token-login called
 * `prisma.user.update(...)` to refresh the display name on each login. The
 * rewritten token-login route deliberately does NOT update the user name on
 * login — it resolves a canonical MachinePrincipal and issues a Forum JWT,
 * creating a User record only if one does not already exist.
 *
 * This revised test pins the NEW contract:
 *   - Path B (pre-signed agent token) resolves an existing MachinePrincipal
 *     (no auto-create) and issues a Forum JWT.
 *   - The issued JWT carries the canonical claims:
 *       sub = MachinePrincipal.id, agent_id, name = displayName||agentId,
 *       iss = auth-service, aud = svc-forum, principal_type = agent,
 *       scope = "forum.read forum.write".
 *   - prisma.user.update is NOT called during token-login.
 *   - No refresh token is issued for agent token-login (Option B).
 *
 * Mark: REVISED_FOR_AGENT_TOKEN_CONTRACT_V1=true
 * Mark: PINS_NEW_TOKEN_LOGIN_CONTRACT=true
 */

// Set env BEFORE any project imports so config/env.ts captures them
process.env.JWT_SECRET = 'test-jwt-secret-for-token-login-contract';
process.env.AGENT_TOKEN_SECRET = 'test-agent-token-secret-for-token-login-contract';
process.env.JWT_ISSUER = 'auth-service';
process.env.JWT_AUDIENCE = 'unified-platform';
process.env.JWT_VERSION = 'v1';
process.env.JWT_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-token-login-contract';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const TEST_AGENT_ID = 'test-token-login-contract-agent';
// MachinePrincipal.id is the source of JWT sub. Distinct from the User id.
const TEST_PRINCIPAL_ID = '11111111-0000-4000-8000-0000000000p1';
const PRINCIPAL_DISPLAY_NAME = '契约测试 Agent';
const TEST_USER_ID = '22222222-0000-4000-8000-0000000000u2';

let updateCalled = false;

const { default: express } = await import('express');
const { default: http } = await import('node:http');
const { authRouter } = await import('../src/routes/auth.js');
const { default: jwt } = await import('jsonwebtoken');
const { prisma } = await import('../src/lib/prisma.js');

// ---------------------------------------------------------------------------
// Setup mocks — direct property override on the prisma singleton.
// Path B resolves via prisma.machinePrincipal.findUnique and prisma.user.findFirst.
// ---------------------------------------------------------------------------

interface MockState {
  origUserFindFirst: typeof prisma.user.findFirst;
  origUserUpdate: typeof prisma.user.update;
  origUserCreate: typeof prisma.user.create;
  origPrincipalFindUnique: typeof prisma.machinePrincipal.findUnique;
}

let mockState: MockState | null = null;

function setupMocks() {
  updateCalled = false;

  // Trigger lazy init by reading each method first
  const origUserFindFirst = prisma.user.findFirst;
  const origUserUpdate = prisma.user.update;
  const origUserCreate = prisma.user.create;
  const origPrincipalFindUnique = prisma.machinePrincipal.findUnique;

  mockState = { origUserFindFirst, origUserUpdate, origUserCreate, origPrincipalFindUnique };

  // Path B: resolvePrincipalFromAgentToken → machinePrincipal.findUnique by agentId
  // Return an existing, active MachinePrincipal. No auto-create path is exercised.
  prisma.machinePrincipal.findUnique = (async (args: any) => {
    const whereAgentId = args?.where?.agentId;
    if (whereAgentId === TEST_AGENT_ID) {
      return {
        id: TEST_PRINCIPAL_ID,
        agentId: TEST_AGENT_ID,
        displayName: PRINCIPAL_DISPLAY_NAME,
        principalType: 'agent',
        status: 'active',
      };
    }
    return null;
  }) as typeof prisma.machinePrincipal.findUnique;

  // Existing user record found (no create path)
  prisma.user.findFirst = (async (_args: any) => ({
    id: TEST_USER_ID,
    name: PRINCIPAL_DISPLAY_NAME,
    email: `agent:${TEST_AGENT_ID}@auth-service.local`,
    role: 'agent',
    agentId: TEST_AGENT_ID,
    internalRole: null,
    okrRole: null,
  })) as typeof prisma.user.findFirst;

  // Spy: the rewritten route must NOT call prisma.user.update.
  prisma.user.update = (async (_args: any) => {
    updateCalled = true;
    return {};
  }) as typeof prisma.user.update;

  prisma.user.create = (async (args: any) => args.data) as typeof prisma.user.create;
}

function restoreMocks() {
  if (!mockState) return;
  prisma.user.findFirst = mockState.origUserFindFirst;
  prisma.user.update = mockState.origUserUpdate;
  prisma.user.create = mockState.origUserCreate;
  prisma.machinePrincipal.findUnique = mockState.origPrincipalFindUnique;
  mockState = null;
}

// ---------------------------------------------------------------------------

void describe('token-login agent-token contract (Path B pre-signed)', async () => {
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
    updateCalled = false;
    if (server) await new Promise((r) => server.close(r));
  });

  function createAgentToken(agentId: string): string {
    return jwt.sign(
      { sub: agentId, agentId, name: PRINCIPAL_DISPLAY_NAME, role: 'agent' },
      process.env.AGENT_TOKEN_SECRET!,
      { expiresIn: '1h' },
    );
  }

  async function tokenLogin(agentId: string): Promise<{ status: number; body: any }> {
    const token = createAgentToken(agentId);
    return new Promise((resolve, reject) => {
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
      req.write(JSON.stringify({ token }));
      req.end();
    });
  }

  // -----------------------------------------------------------------------
  // Test 1: token-login resolves an existing MachinePrincipal and returns 200
  // -----------------------------------------------------------------------
  await it('resolves existing MachinePrincipal via pre-signed token and returns 200', async () => {
    const { status, body } = await tokenLogin(TEST_AGENT_ID);
    assert.equal(status, 200, 'token-login must return HTTP 200 for a valid agent token');
    assert.ok(body.accessToken, 'accessToken must be present');
    assert.ok(body.user, 'user object must be present');
    assert.equal(body.user.agentId, TEST_AGENT_ID, 'agentId must be preserved');
    assert.equal(body.user.role, 'agent', 'role must be agent');
  });

  // -----------------------------------------------------------------------
  // Test 2: issued JWT carries the canonical Forum claims
  // -----------------------------------------------------------------------
  await it('issues a Forum JWT with canonical claims (sub=principalId, aud=svc-forum)', async () => {
    const { status, body } = await tokenLogin(TEST_AGENT_ID);
    assert.equal(status, 200);

    const decoded = jwt.decode(body.accessToken) as any;
    assert.ok(decoded, 'JWT must be decodable');
    assert.equal(decoded.agent_id, TEST_AGENT_ID, 'agent_id claim must match');
    assert.equal(decoded.sub, TEST_PRINCIPAL_ID, 'JWT sub must be MachinePrincipal.id, not agentId/userId');
    assert.equal(decoded.aud, 'svc-forum', 'Agent JWT audience must be svc-forum');
    assert.equal(decoded.iss, 'auth-service', 'JWT issuer must be auth-service');
    assert.equal(decoded.principal_type, 'agent', 'principal_type must be agent');
    assert.ok(decoded.scope, 'scope must be present');
    assert.ok(decoded.scope.includes('forum.read'), 'scope must include forum.read');
    assert.ok(decoded.scope.includes('forum.write'), 'scope must include forum.write');
  });

  // -----------------------------------------------------------------------
  // Test 3: the rewritten route does NOT call prisma.user.update
  // -----------------------------------------------------------------------
  await it('does not call prisma.user.update during token-login', async () => {
    updateCalled = false;
    await tokenLogin(TEST_AGENT_ID);
    assert.equal(updateCalled, false, 'token-login must not call prisma.user.update');
  });

  // -----------------------------------------------------------------------
  // Test 4: agent token-login does not issue a refresh token (Option B)
  // -----------------------------------------------------------------------
  await it('does not issue a refresh token (Option B)', async () => {
    const { body } = await tokenLogin(TEST_AGENT_ID);
    assert.equal(body.refreshToken, undefined, 'agent token-login must not return a refreshToken');
  });

  // -----------------------------------------------------------------------
  // Test 5: pre-signed token with no matching MachinePrincipal is rejected
  // -----------------------------------------------------------------------
  await it('rejects a pre-signed token whose MachinePrincipal does not exist', async () => {
    const token = jwt.sign(
      { sub: 'nonexistent-agent', agentId: 'nonexistent-agent', role: 'agent' },
      process.env.AGENT_TOKEN_SECRET!,
      { expiresIn: '1h' },
    );
    const res = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/auth/token-login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (r) => {
          let data = '';
          r.on('data', (chunk) => (data += chunk));
          r.on('end', () => {
            try {
              resolve({ status: r.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: r.statusCode ?? 0, body: data });
            }
          });
        },
      );
      req.on('error', reject);
      req.write(JSON.stringify({ token }));
      req.end();
    });
    assert.equal(res.status, 401, 'unknown agent must be rejected (no auto-create)');
  });
});
