/**
 * Machine Principal & Client lifecycle integration tests.
 *
 * These tests require a running PostgreSQL database with migrations applied.
 * They use a local development database — NEVER production.
 *
 * Prerequisites:
 *   1. PostgreSQL running on localhost:5432
 *   2. Migration 20260714000001_add_machine_principal_client applied
 *
 * Tests create synthetic data and clean up after themselves.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../../src/lib/prisma.js';
import {
  createPrincipal,
  getPrincipal,
  disablePrincipal,
  createClient,
  rotateClientSecret,
  revokeClient,
  getClient,
  issueToken,
} from '../../src/lib/oauth/service.js';

const TEST_PREFIX = 'test-e2e-' + crypto.randomBytes(4).toString('hex');

let ownerUserId: string;
let principalId: string;
let clientDbId: string;
let clientPublicId: string;
let clientSecret: string;

async function cleanupTestData(): Promise<void> {
  await prisma.machineClient.deleteMany({
    where: { principal: { agentId: { startsWith: TEST_PREFIX } } },
  });
  await prisma.machinePrincipal.deleteMany({
    where: { agentId: { startsWith: TEST_PREFIX } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@test.local' } },
  });
}

describe('Machine Principal lifecycle', () => {
  before(async () => {
    // Create a synthetic owner user
    const owner = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}-owner`,
        email: `${TEST_PREFIX}-owner@test.local`,
        password: 'placeholder-hash-' + crypto.randomUUID().slice(0,8),
        role: 'admin',
      },
    });
    ownerUserId = owner.id;
  });

  it('1. creates a MachinePrincipal', async () => {
    const result = await createPrincipal({
      agentId: `${TEST_PREFIX}-agent`,
      ownerUserId,
      displayName: 'Test Agent',
    });

    assert.ok(result.id, 'Should have UUID');
    assert.equal(result.agentId, `${TEST_PREFIX}-agent`);
    assert.equal(result.principalType, 'agent');
    assert.equal(result.status, 'active');
    assert.equal(result.displayName, 'Test Agent');
    principalId = result.id;
  });

  it('2. rejects duplicate agentId', async () => {
    await assert.rejects(
      () => createPrincipal({
        agentId: `${TEST_PREFIX}-agent`,
        ownerUserId,
      }),
      /already exists/,
    );
  });

  it('3. rejects non-existent owner', async () => {
    await assert.rejects(
      () => createPrincipal({
        agentId: `${TEST_PREFIX}-no-owner`,
        ownerUserId: '00000000-0000-0000-0000-000000000000',
      }),
      /Owner user not found/,
    );
  });

  it('4. gets principal by agentId', async () => {
    const result = await getPrincipal(`${TEST_PREFIX}-agent`);
    assert.ok(result);
    assert.equal(result?.agentId, `${TEST_PREFIX}-agent`);
    assert.equal(result?.status, 'active');
  });

  it('5. returns null for non-existent agentId', async () => {
    const result = await getPrincipal('non-existent-agent');
    assert.equal(result, null);
  });

  it('6. disables principal', async () => {
    const result = await disablePrincipal(`${TEST_PREFIX}-agent`);
    assert.equal(result.status, 'disabled');
    assert.ok(result.disabledAt, 'Should have disabledAt timestamp');
  });

  it('7. disable is idempotent', async () => {
    const result = await disablePrincipal(`${TEST_PREFIX}-agent`);
    assert.equal(result.status, 'disabled');
  });

  it('8. re-enables for subsequent client tests', async () => {
    // Re-enable by updating directly for test continuation
    await prisma.machinePrincipal.update({
      where: { id: principalId },
      data: { status: 'active', disabledAt: null },
    });
    const result = await getPrincipal(`${TEST_PREFIX}-agent`);
    assert.equal(result?.status, 'active');
  });
});

describe('Machine Client lifecycle', () => {
  it('9. creates a client', async () => {
    const result = await createClient({
      agentId: `${TEST_PREFIX}-agent`,
      resources: ['svc-forum', 'svc-okr'],
      scopes: ['forum.read', 'forum.write'],
    });

    assert.ok(result.clientId.startsWith('mc_'), 'clientId should start with mc_');
    assert.ok(result.secret, 'Should return secret once');
    assert.equal(result.status, 'active');
    assert.deepEqual(result.allowedResources, ['svc-forum', 'svc-okr']);
    assert.deepEqual(result.allowedScopes, ['forum.read', 'forum.write']);

    clientDbId = result.id;
    clientPublicId = result.clientId;
    clientSecret = result.secret;
  });

  it('10. client can issue token', async () => {
    const result = await issueToken({
      clientId: clientPublicId,
      clientSecret,
      resource: 'svc-forum',
      scope: 'forum.read',
    });

    assert.ok(result.access_token, 'Should return access token');
    assert.equal(result.token_type, 'Bearer');
    assert.equal(result.expires_in, 600);
    assert.equal(result.scope, 'forum.read');
  });

  it('11. invalid secret is rejected with generic error', async () => {
    await assert.rejects(
      () => issueToken({
        clientId: clientPublicId,
        clientSecret: 'wrong-secret',
        resource: 'svc-forum',
        scope: 'forum.read',
      }),
      /invalid_client/,
    );
  });

  it('12. unauthorized resource is rejected', async () => {
    await assert.rejects(
      () => issueToken({
        clientId: clientPublicId,
        clientSecret,
        resource: 'svc-admin',
        scope: 'forum.read',
      }),
      /invalid_target/,
    );
  });

  it('13. unauthorized scope is rejected', async () => {
    await assert.rejects(
      () => issueToken({
        clientId: clientPublicId,
        clientSecret,
        resource: 'svc-forum',
        scope: 'admin.write',
      }),
      /invalid_scope/,
    );
  });

  it('14. inspects client (no secret leak)', async () => {
    const result = await getClient(clientPublicId);
    assert.ok(result);
    assert.equal(result?.clientId, clientPublicId);
    assert.equal(result?.status, 'active');
    // The result type doesn't include secretHash
    assert.equal((result as any).secretHash, undefined);
  });

  it('15. rotates secret', async () => {
    const result = await rotateClientSecret(clientPublicId);

    assert.ok(result.newSecret, 'Should return new secret');
    assert.notEqual(result.newSecret, clientSecret);

    // New secret works
    const tokenResult = await issueToken({
      clientId: clientPublicId,
      clientSecret: result.newSecret,
      resource: 'svc-forum',
      scope: 'forum.read',
    });
    assert.ok(tokenResult.access_token);

    // Old secret fails
    await assert.rejects(
      () => issueToken({
        clientId: clientPublicId,
        clientSecret,
        resource: 'svc-forum',
        scope: 'forum.read',
      }),
    );

    // Update for next tests
    clientSecret = result.newSecret;
  });

  it('16. revokes client', async () => {
    const result = await revokeClient(clientPublicId);
    assert.equal(result.status, 'revoked');
    assert.ok(result.revokedAt);
  });

  it('17. revoked client cannot issue tokens', async () => {
    await assert.rejects(
      () => issueToken({
        clientId: clientPublicId,
        clientSecret,
        resource: 'svc-forum',
        scope: 'forum.read',
      }),
      /invalid_client/,
    );
  });

  it('18. revoke is idempotent', async () => {
    const result = await revokeClient(clientPublicId);
    assert.equal(result.status, 'revoked');
  });

  it('19. disabled principal blocks client creation and token issuance', async () => {
    // Create a client while principal is still active, then disable
    const activeClient = await createClient({
      agentId: `${TEST_PREFIX}-agent`,
      resources: ['svc-forum'],
      scopes: ['forum.read'],
    });

    await prisma.machinePrincipal.update({
      where: { id: principalId },
      data: { status: 'disabled', disabledAt: new Date() },
    });

    // Disabled principal blocks new client creation
    await assert.rejects(
      () => createClient({
        agentId: `${TEST_PREFIX}-agent`,
        resources: ['svc-forum'],
        scopes: ['forum.read'],
      }),
      /disabled/,
    );

    // Existing client cannot issue tokens after principal is disabled
    await assert.rejects(
      () => issueToken({
        clientId: activeClient.clientId,
        clientSecret: activeClient.secret,
        resource: 'svc-forum',
        scope: 'forum.read',
      }),
      /invalid_client/,
    );
  });
});

after(cleanupTestData);
