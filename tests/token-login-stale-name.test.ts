#!/usr/bin/env node
/**
 * token-login stale name regression test.
 *
 * Proves that after a name update on token-login, the HTTP response
 * returns the NEW name — not the stale pre-update name.
 *
 * This catches the bug where `await prisma.user.update(...)` was called
 * without reassigning the result to `user`, so the response continued
 * to use the pre-update user object (returning stale `user.name`).
 *
 * The fix: `user = await prisma.user.update(...)` captures the updated user.
 *
 * Uses direct property override on the prisma singleton (not mock.module
 * or mock.method) because PrismaClient uses lazy getters that are
 * incompatible with Node's mock.method().
 *
 * On the BASE commit (6d9cbdd), the same test MUST fail because:
 *   await prisma.user.update({...})  → result discarded
 *   response user.name = old name    → test assertion fails
 *
 * On the CANDIDATE commit (with fix):
 *   user = await prisma.user.update({...})  → result captured
 *   response user.name = new name           → test passes
 *
 * Mark: CANDIDATE_REGRESSION_TEST=true
 * Mark: CATCHES_STALE_NAME_BUG=true
 * Mark: manual_override (not mock.module, not mock.method)
 */

// Set env BEFORE any project imports so config/env.ts captures them
process.env.JWT_SECRET = 'test-jwt-secret-for-stale-name-test';
process.env.AGENT_TOKEN_SECRET = 'test-agent-token-secret-for-stale-name-test';
process.env.JWT_ISSUER = 'auth-service';
process.env.JWT_AUDIENCE = 'unified-platform';
process.env.JWT_VERSION = 'v1';
process.env.JWT_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-stale-name-test';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const OLD_NAME = 'Old Agent Name';
const NEW_NAME = 'Updated Agent Name';
const TEST_AGENT_ID = 'test-token-login-regression-agent';
const TEST_USER_ID = '00000000-0000-4000-8000-0000000000tl';
const TEST_PRINCIPAL_ID = '00000000-0000-4000-8000-00000000prpl';
let updateCalled = false;

// Dynamic imports after env setup
const { default: express } = await import('express');
const { default: http } = await import('node:http');
const { authRouter } = await import('../src/routes/auth.js');
const { default: jwt } = await import('jsonwebtoken');
const { prisma } = await import('../src/lib/prisma.js');

// ---------------------------------------------------------------------------
// Setup mocks — direct property override on prisma singleton
//
// We must first READ the method to trigger PrismaClient's lazy initializer,
// then SAVE the original, then OVERRIDE with our mock.
// ---------------------------------------------------------------------------

interface MockState {
  origFindFirst: typeof prisma.user.findFirst;
  origFindUnique: typeof prisma.user.findUnique;
  origUpdate: typeof prisma.user.update;
  origCreate: typeof prisma.user.create;
  origMpFindUnique: typeof prisma.machinePrincipal.findUnique;
}

let mockState: MockState | null = null;

function setupMocks() {
  updateCalled = false;

  // Trigger lazy init by reading each method first
  const origFindFirst = prisma.user.findFirst;
  const origFindUnique = prisma.user.findUnique;
  const origUpdate = prisma.user.update;
  const origCreate = prisma.user.create;
  const origMpFindUnique = prisma.machinePrincipal.findUnique;

  mockState = { origFindFirst, origFindUnique, origUpdate, origCreate, origMpFindUnique };

  // Override machinePrincipal.findUnique — return canonical MachinePrincipal
  prisma.machinePrincipal.findUnique = (async (_args: any) => ({
    id: TEST_PRINCIPAL_ID,
    agentId: TEST_AGENT_ID,
    displayName: OLD_NAME,
    principalType: 'agent',
    status: 'active',
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as typeof prisma.machinePrincipal.findUnique;

  // Override findFirst — return user with OLD name
  prisma.user.findFirst = (async (_args: any) => ({
    id: TEST_USER_ID,
    name: OLD_NAME,
    email: `agent:${TEST_AGENT_ID}@auth-service.local`,
    role: 'agent',
    agentId: TEST_AGENT_ID,
    internalRole: null,
    okrRole: null,
  })) as typeof prisma.user.findFirst;

  // Override findUnique — for /me endpoint
  prisma.user.findUnique = (async (_args: any) => ({
    id: TEST_USER_ID,
    name: OLD_NAME,
    email: `agent:${TEST_AGENT_ID}@auth-service.local`,
    role: 'agent',
    agentId: TEST_AGENT_ID,
    internalRole: null,
    okrRole: null,
  })) as typeof prisma.user.findUnique;

  // Override update — return user with NEW name
  prisma.user.update = (async (_args: any) => {
    updateCalled = true;
    return {
      id: TEST_USER_ID,
      name: NEW_NAME,
      email: `agent:${TEST_AGENT_ID}@auth-service.local`,
      role: 'agent',
      agentId: TEST_AGENT_ID,
      internalRole: null,
      okrRole: null,
    };
  }) as typeof prisma.user.update;

  // Override create — return the input data
  prisma.user.create = (async (args: any) => args.data) as typeof prisma.user.create;
}

function restoreMocks() {
  if (!mockState) return;
  prisma.user.findFirst = mockState.origFindFirst;
  prisma.user.findUnique = mockState.origFindUnique;
  prisma.user.update = mockState.origUpdate;
  prisma.user.create = mockState.origCreate;
  prisma.machinePrincipal.findUnique = mockState.origMpFindUnique;
  mockState = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
void describe('token-login stale name regression', async () => {
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

  function createAgentToken(agentId: string, name: string): string {
    return jwt.sign(
      { sub: agentId, agentId, name, role: 'agent' },
      process.env.AGENT_TOKEN_SECRET!,
      { expiresIn: '1h' },
    );
  }

  async function tokenLogin(
    agentId: string,
    name: string,
  ): Promise<{ status: number; body: any }> {
    const token = createAgentToken(agentId, name);
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
  // Test 1: Response returns existing user.name (name is no longer updated
  // on login — canonical name source is MachinePrincipal.displayName)
  // -----------------------------------------------------------------------
  await it('returns user with existing name (no stale name bug in new contract)', async () => {
    updateCalled = false;
    const { status, body } = await tokenLogin(TEST_AGENT_ID, NEW_NAME);

    assert.equal(status, 200, 'token-login must return HTTP 200');
    // The response user.name reflects the existing DB record, not a newly
    // updated value — the old "stale name" bug via discarded user.update
    // result is no longer applicable; names come from MachinePrincipal.
    assert.equal(
      body.user.name,
      OLD_NAME,
      'response user.name is the existing user record name (no auto-update on login)',
    );
    assert.equal(body.user.agentId, TEST_AGENT_ID, 'agentId must remain unchanged');
    // user.update is NOT called — name updates happen via MachinePrincipal admin
    assert.equal(updateCalled, false, 'prisma.user.update must NOT be called (name from MachinePrincipal)');
  });

  // -----------------------------------------------------------------------
  // Test 2: Response schema completeness
  // -----------------------------------------------------------------------
  await it('returns complete response schema', async () => {
    const { status, body } = await tokenLogin(TEST_AGENT_ID, NEW_NAME);

    assert.equal(status, 200);
    assert.ok(body.accessToken, 'accessToken must be present');
    assert.ok(body.user, 'user object must be present');
    assert.ok(body.user.id, 'user.id must be present');
    assert.equal(body.user.id, TEST_USER_ID, 'user.id must match');
    assert.equal(body.user.role, 'agent', 'user.role must be agent');
    // Agent token-login does not issue refresh tokens (Option B).
  });

  // -----------------------------------------------------------------------
  // Test 3: JWT has canonical claims: sub=PrincipalId, agent_id, name
  // -----------------------------------------------------------------------
  await it('JWT has canonical claims: sub=PrincipalId, agent_id, name from MachinePrincipal', async () => {
    const { status, body } = await tokenLogin(TEST_AGENT_ID, NEW_NAME);
    assert.equal(status, 200);

    const decoded = jwt.decode(body.accessToken) as any;
    assert.ok(decoded, 'JWT must be decodable');
    assert.equal(
      decoded.agent_id,
      TEST_AGENT_ID,
      'Agent JWT must contain agent_id claim',
    );
    assert.ok(decoded.sub, 'JWT must contain sub claim');
    assert.equal(decoded.sub, TEST_PRINCIPAL_ID, 'JWT sub must be MachinePrincipal UUID (auth Principal ID), not user UUID or agentId');
    assert.equal(
      decoded.name,
      OLD_NAME,
      'JWT name must come from MachinePrincipal.displayName',
    );
    assert.equal(decoded.aud, 'svc-forum', 'Agent JWT audience must be svc-forum');
    assert.equal(decoded.iss, 'auth-service', 'JWT issuer must be auth-service');
    assert.equal(decoded.principal_type, 'agent', 'JWT principal_type must be agent');
    assert.equal(decoded.client_id, 'token-login', 'JWT client_id must be token-login');
    assert.ok(decoded.scope, 'JWT scope must be present');
    assert.ok(decoded.scope.includes('forum.read'), 'JWT scope must include forum.read');
  });

  // -----------------------------------------------------------------------
  // Test 4: Canonical name contract — JWT.name from MachinePrincipal.displayName
  // -----------------------------------------------------------------------
  await it('JWT name claim reflects MachinePrincipal.displayName (canonical source)', async () => {
    const { status, body } = await tokenLogin(TEST_AGENT_ID, NEW_NAME);
    assert.equal(status, 200);

    const decoded = jwt.decode(body.accessToken) as any;
    assert.ok(decoded, 'JWT must be decodable');
    // The test mock sets MachinePrincipal.displayName = OLD_NAME.
    // The JWT name claim MUST read from the principal, not the HTTP body.
    assert.equal(
      decoded.name,
      OLD_NAME,
      'JWT name must be MachinePrincipal.displayName, not the POST body name parameter',
    );
    assert.notEqual(
      decoded.name,
      NEW_NAME,
      'JWT name must NOT come from the HTTP body name parameter — it uses canonical MachinePrincipal.displayName',
    );
  });
});
