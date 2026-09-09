/**
 * Secret-Mutation Enforcement Seam tests (MACHINE_CLIENT_CREDENTIALS_V0 §11,
 * Amendment A — external prerequisite (e) SECRET_MUTATION_ENFORCEMENT_SEAM).
 *
 * Requires a running PostgreSQL with ALL migrations applied (including
 * 20260909010000_machine_credential_rotation_seam) and a NON-superuser
 * application role as DATABASE_URL — the boundary being tested is a
 * column-level privilege, which PostgreSQL superusers bypass by definition.
 *
 * Maps to governing spec L4: T5 (direct hash update rejected), T6 (p4-form
 * hash-only ORM update rejected), T7 (hash+rotated_at together rejected),
 * T8 (canonical rotate full contract), T10 (operation replay idempotent).
 * A9-negative: preimage mismatch ⇒ zero mutation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../../src/lib/prisma.js';
import {
  createPrincipal,
  createClient,
  rotateClientSecret,
} from '../../src/lib/oauth/service.js';
import {
  generateRotationOperationId,
  rotateMachineClientSecretViaSeam,
  secretHashFingerprint,
} from '../../src/lib/oauth/rotation-seam.js';
import { verifyClientSecret } from '../../src/lib/oauth/secret.js';

const TEST_PREFIX = 'test-rotseam-' + crypto.randomBytes(4).toString('hex');

let principalId = '';
let clientDbId = '';
let clientPublicId = '';
let clientSecret = '';

async function seamAvailable(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`
    SELECT COUNT(*)::int AS ok FROM pg_proc
    WHERE proname = 'rotate_machine_client_secret'`;
  return (rows[0]?.ok ?? 0) > 0;
}

async function cleanupTestData(): Promise<void> {
  await prisma.machineClient.deleteMany({
    where: { principal: { agentId: { startsWith: TEST_PREFIX } } },
  });
  await prisma.machinePrincipal.deleteMany({
    where: { agentId: { startsWith: TEST_PREFIX } },
  });
  // Prefix-scoped (same rationale as lifecycle.test.ts): node:test runs test
  // files concurrently; a broad endsWith('@test.local') matcher would delete
  // a concurrently-running suite's owner user mid-flight (FK violation).
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
  // Receipt ledger rows are intentionally retained (append-only audit); they
  // carry no FK and do not block client cleanup.
}

async function expectPermissionDenied(promise: Promise<unknown>): Promise<void> {
  let threw: unknown;
  try {
    await promise;
  } catch (error) {
    threw = error;
  }
  assert.ok(threw, 'expected the secret-material write to be REJECTED');
  const message = threw instanceof Error ? threw.message : String(threw);
  assert.match(
    message + ' ' + String((threw as { code?: string })?.code ?? ''),
    /permission denied|P2010|42501|MACHINE_CLIENT_SECRET_MUTATION_OUTSIDE_ROTATION_SEAM/i,
    `unexpected rejection reason: ${message}`,
  );
}

describe('Secret-Mutation Enforcement Seam', () => {
  before(async () => {
    if (!(await seamAvailable())) {
      console.error('SKIP: rotation seam migration not applied to this database');
      return;
    }
    const owner = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}-owner`,
        email: `${TEST_PREFIX}-owner@test.local`,
        password: 'placeholder-hash-' + crypto.randomUUID().slice(0, 8),
        role: 'admin',
      },
    });
    const principal = await createPrincipal({
      agentId: `${TEST_PREFIX}-agent`,
      ownerUserId: owner.id,
    });
    principalId = principal.id;
    const client = await createClient({
      agentId: `${TEST_PREFIX}-agent`,
      resources: ['svc-workflow'],
      scopes: ['workflow.read'],
    });
    clientDbId = client.id;
    clientPublicId = client.clientId;
    clientSecret = client.secret;
  });

  after(async () => {
    if (!(await seamAvailable())) return;
    await cleanupTestData();
  });

  it('T5: direct raw UPDATE of secret_hash alone is REJECTED with zero mutation', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const before = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    await expectPermissionDenied(
      prisma.$executeRaw`UPDATE machine_clients SET secret_hash = 'deadbeef:00' WHERE id = ${clientDbId}::uuid`,
    );
    const after = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    assert.equal(after?.secretHash, before?.secretHash, 'secret_hash must not change');
    assert.equal(after?.rotatedAt, null, 'rotated_at must stay NULL for a never-rotated client');
    // pre-existing secret still valid — nothing silently changed
    assert.equal(verifyClientSecret(clientSecret, after!.secretHash), true);
  });

  it('T6: p4-form ORM update of secretHash only is REJECTED (create-or-overwrite pattern)', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const before = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    await expectPermissionDenied(
      prisma.machineClient.update({
        where: { id: clientDbId },
        data: { secretHash: 'salt:hash-of-something-else' },
      }),
    );
    const after = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    assert.equal(after?.secretHash, before?.secretHash);
  });

  it('T7: raw UPDATE of secret_hash + rotated_at together is REJECTED outside the seam', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const before = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    await expectPermissionDenied(
      prisma.$executeRaw`UPDATE machine_clients SET secret_hash = 'aa:bb', rotated_at = now() WHERE id = ${clientDbId}::uuid`,
    );
    const after = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    assert.equal(after?.secretHash, before?.secretHash);
    assert.equal(after?.rotatedAt, null);
    // no receipt may exist for a rejected write
    const receipts = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM machine_client_rotations WHERE client_id = ${clientPublicId}`;
    assert.equal(receipts[0]?.n, 0);
  });

  it('T8: canonical rotate changes generation exactly once, advances rotated_at/updated_at, writes receipt', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const before = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    assert.equal(before?.rotatedAt, null);

    const result = await rotateClientSecret(clientPublicId);
    assert.equal(result.rotation.replayed, false);

    const after = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    assert.notEqual(after?.rotatedAt, null, 'rotated_at must advance');
    assert.ok(after!.updatedAt >= before!.updatedAt, 'updated_at must advance');
    assert.equal(verifyClientSecret(result.newSecret, after!.secretHash), true);
    assert.equal(verifyClientSecret(clientSecret, after!.secretHash), false, 'old secret dead');

    const receipts = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM machine_client_rotations WHERE client_id = ${clientPublicId}`;
    assert.equal(receipts[0]?.n, 1, 'exactly one receipt row');
    clientSecret = result.newSecret;
  });

  it('A9-negative: preimage fingerprint mismatch is rejected with ZERO mutation', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const before = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    const bogusFingerprint = crypto.createHash('sha256').update('not-the-live-hash').digest('hex');
    await assert.rejects(
      rotateMachineClientSecretViaSeam({
        machineClientUuid: clientDbId,
        newSecretHash: 'aa:bb',
        preimageFingerprint: bogusFingerprint,
        operationId: generateRotationOperationId('test'),
        rotatedBy: 'test',
      }),
      /ROTATION_PREIMAGE_MISMATCH/,
    );
    const after = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    assert.equal(after?.secretHash, before?.secretHash, 'zero mutation on preimage mismatch');
    assert.equal(after?.rotatedAt?.getTime(), before?.rotatedAt?.getTime());
  });

  it('T10: replaying the same operation id is idempotent — no second secret change', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const operationId = generateRotationOperationId('test-replay');
    const first = await rotateClientSecret(clientPublicId, { operationId });
    const afterFirst = await prisma.machineClient.findUnique({ where: { id: clientDbId } });

    const second = await rotateClientSecret(clientPublicId, { operationId });
    assert.equal(second.rotation.replayed, true, 'replay must be flagged');
    assert.equal(second.rotation.receiptId, first.rotation.receiptId, 'same receipt');

    const afterSecond = await prisma.machineClient.findUnique({ where: { id: clientDbId } });
    assert.equal(afterSecond?.secretHash, afterFirst?.secretHash, 'no second secret change');
    assert.equal(
      afterSecond?.rotatedAt?.getTime(),
      afterFirst?.rotatedAt?.getTime(),
      'rotated_at frozen at the original rotation',
    );
    assert.equal(verifyClientSecret(first.newSecret, afterSecond!.secretHash), true);
  });

  it('seam fingerprint helper matches the SQL-side preimage derivation', async () => {
    const hash = 'salt:' + 'a'.repeat(128);
    const fp = secretHashFingerprint(hash);
    const rows = await prisma.$queryRaw<{ fp: string }[]>`
      SELECT encode(sha256(convert_to(${hash}, 'utf8')), 'hex') AS fp`;
    assert.equal(fp, rows[0]?.fp);
  });

  it('sanity: INSERT (CREATE) path still works for the application role', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const client = await createClient({
      agentId: `${TEST_PREFIX}-agent`,
      resources: ['svc-forum'],
      scopes: ['forum.read'],
    });
    assert.match(client.clientId, /^mc_/);
    assert.equal(client.rotatedAt, null);
  });

  // keep referenced import used for principal creation typing consistency
  it('fixture principal is resolvable', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const principal = await prisma.machinePrincipal.findUnique({ where: { id: principalId } });
    assert.ok(principal);
  });

  it('SB2 seal duty: application role holds NO boundary-role membership and cannot SET ROLE', async (t) => {
    if (!(await seamAvailable())) return t.skip('rotation seam migration not applied to this database');
    const rows = await prisma.$queryRaw<{ member: boolean }[]>`
      SELECT pg_has_role(current_user, 'machine_credential_owner', 'member') AS member`;
    assert.equal(rows[0]?.member, false, 'lingering boundary-role membership would make the column grants bypassable via SET ROLE');
    await assert.rejects(
      prisma.$executeRaw`SET ROLE machine_credential_owner`,
      /permission denied|SET ROLE/i,
      'SET ROLE to the boundary role must fail for the application role',
    );
  });
});
