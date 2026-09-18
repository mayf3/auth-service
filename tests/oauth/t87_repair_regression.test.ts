// T87 repair regression — rotation seam NULL-preimage precondition boundary.
// OWNER_DECISION_COMMIT (OWNER_GATE_MATERIALIZATION_AND_NIGHTLY_RELEASE_20260916_V1,
// SECURITY_REPAIR_AUTHORIZED):
//   NULL preimage fingerprint -> REJECT (zero credential mutation);
//   wrong preimage -> REJECT (zero mutation);
//   correct preimage -> rotate. IS DISTINCT FROM / explicit NULL guard allowed.
// Baseline RED (pre-fix): SQL three-valued logic makes
//   v_preimage_fp <> lower(NULL) evaluate to NULL, the mismatch branch never
//   fires, and a NULL-fingerprint call rotates the secret with NO preimage
//   proof at all.
import { test } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/lib/prisma.js';
import { rotateClientSecret } from '../../src/lib/oauth/service.js';
import { hashClientSecret, verifyClientSecret } from '../../src/lib/oauth/secret.js';
import {
  rotateMachineClientSecretViaSeam,
  secretHashFingerprint,
} from '../../src/lib/oauth/rotation-seam.js';

const RUN = randomUUID().slice(0, 8);

async function seedClient(clientId: string, plain: string) {
  const principal = await prisma.machinePrincipal.create({
    data: { principalType: 'agent', displayName: `T87 ${clientId}` },
  });
  return prisma.machineClient.create({
    data: {
      clientId,
      machinePrincipalId: principal.id,
      secretHash: hashClientSecret(plain),
      status: 'active',
      allowedResources: [],
      allowedScopes: [],
    },
  });
}

async function receiptCount(clientId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS n FROM machine_client_rotations WHERE client_id = $1`, clientId);
  return rows[0].n;
}

test('N1: NULL preimage fingerprint is REJECTED with zero credential mutation', async () => {
  const plain = `t87-n1-plain-${RUN}`;
  const client = await seedClient(`t87-client-n1-${RUN}`, plain);
  const before = await prisma.machineClient.findUnique({ where: { clientId: client.clientId } });

  let rejected: any = null;
  try {
    await rotateMachineClientSecretViaSeam({
      machineClientUuid: client.id,
      newSecretHash: 't87:attacker-controlled-hash',
      preimageFingerprint: null as unknown as string,
      operationId: `t87-n1-op-${RUN}`,
      rotatedBy: 't87-regression',
    });
  } catch (err: any) {
    rejected = err;
  }
  assert.ok(rejected, 'NULL preimage must NOT be able to rotate (no silent bypass)');
  assert.match(String(rejected.message), /ROTATION_PREIMAGE_MISMATCH/i,
    `expected ROTATION_PREIMAGE_MISMATCH, got: ${rejected.message}`);

  const after = await prisma.machineClient.findUnique({ where: { clientId: client.clientId } });
  assert.equal(verifyClientSecret(plain, after!.secretHash), true, 'secret_hash must be untouched');
  assert.equal(after!.rotatedAt, null, 'rotated_at must stay NULL (zero mutation)');
  assert.equal(await receiptCount(client.clientId), 0, 'no receipt row for a rejected call');
});

test('N2: wrong (non-NULL) preimage stays rejected — guard does not loosen A9', async () => {
  const plain = `t87-n2-plain-${RUN}`;
  const client = await seedClient(`t87-client-n2-${RUN}`, plain);

  let rejected: any = null;
  try {
    await rotateMachineClientSecretViaSeam({
      machineClientUuid: client.id,
      newSecretHash: 't87:other-hash',
      preimageFingerprint: secretHashFingerprint('not-the-live-hash'),
      operationId: `t87-n2-op-${RUN}`,
      rotatedBy: 't87-regression',
    });
  } catch (err: any) {
    rejected = err;
  }
  assert.ok(rejected);
  assert.match(String(rejected.message), /ROTATION_PREIMAGE_MISMATCH/i);
  assert.equal(await receiptCount(client.clientId), 0, 'zero mutation on wrong preimage');
});

test('C1: correct preimage still rotates through the seam', async () => {
  const plain = `t87-c1-plain-${RUN}`;
  const client = await seedClient(`t87-client-c1-${RUN}`, plain);
  const live = (await prisma.machineClient.findUnique({ where: { clientId: client.clientId } }))!;

  const result = await rotateMachineClientSecretViaSeam({
    machineClientUuid: client.id,
    newSecretHash: hashClientSecret(`t87-c1-new-${RUN}`),
    preimageFingerprint: secretHashFingerprint(live.secretHash),
    operationId: `t87-c1-op-${RUN}`,
    rotatedBy: 't87-regression',
  });
  assert.equal(result.replayed, false, 'correct preimage rotates for real');
  const after = await prisma.machineClient.findUnique({ where: { clientId: client.clientId } });
  assert.notEqual(after!.rotatedAt, null);
  assert.equal(await receiptCount(client.clientId), 1, 'exactly one receipt');
});

test('S1: service-layer rotate (its own preimage derivation) still works end to end', async () => {
  const client = await seedClient(`t87-client-s1-${RUN}`, `t87-s1-plain-${RUN}`);
  const result = await rotateClientSecret(client.clientId);
  assert.equal(result.rotation.replayed, false);
  const after = await prisma.machineClient.findUnique({ where: { clientId: client.clientId } });
  assert.equal(verifyClientSecret(result.newSecret, after!.secretHash), true);
});
