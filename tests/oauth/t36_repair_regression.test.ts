// T36+T43 repair regressions — AUTH_ROTATION_REPLAY_CONSISTENCY workstream.
// OWNER_SECURITY_DECISION (OWNER_SEMANTIC_DECISIONS_AND_REPAIR_RELEASE_20260913_V1):
//   R1 same target + same operationId -> replay immutable receipt metadata,
//      MUST NOT re-emit credential secret material.
//   R2 same operationId + different target -> IDEMPOTENCY_CONFLICT (no mutation).
//   R3 live credential advanced past receipt -> STALE_IDEMPOTENCY_RECEIPT.
// Baseline RED (pre-fix): R1 leaks fresh secret, R2 silently replays foreign
// receipt, R3 replays stale receipt as success.
import { test } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/lib/prisma.js';
import { rotateClientSecret } from '../../src/lib/oauth/service.js';
import { hashClientSecret, verifyClientSecret } from '../../src/lib/oauth/secret.js';

const RUN = randomUUID().slice(0, 8);
const OP = `t36-repair-op-1-${RUN}`;

async function seedClient(clientId: string, plain: string) {
  const principal = await prisma.machinePrincipal.create({
    data: { principalType: 'agent', displayName: `T36 ${clientId}` },
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

test('R2: same operationId + different target -> IDEMPOTENCY_CONFLICT, zero mutation', async () => {
  await seedClient(`t36-client-a-${RUN}`, 't36-plain-A');
  await seedClient(`t36-client-b-${RUN}`, 't36-plain-B');

  const r1 = await rotateClientSecret(`t36-client-a-${RUN}`, { operationId: OP });
  assert.equal(r1.rotation.replayed, false, 'first call is a real rotation');

  let conflict: any = null;
  try {
    await rotateClientSecret(`t36-client-b-${RUN}`, { operationId: OP });
  } catch (err: any) {
    conflict = err;
  }
  assert.ok(conflict, 'cross-target reuse must raise an error (no silent foreign replay)');
  assert.match(String(conflict.message), /IDEMPOTENCY_CONFLICT/i,
    `expected IDEMPOTENCY_CONFLICT, got: ${conflict.message}`);
  assert.equal(conflict.statusCode, 409);

  const receipts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT client_id FROM machine_client_rotations WHERE operation_id = $1`, OP);
  assert.equal(receipts.length, 1, 'no second receipt row');
  assert.equal(receipts[0].client_id, `t36-client-a-${RUN}`);
  const b = await prisma.machineClient.findUnique({ where: { clientId: `t36-client-b-${RUN}` } });
  assert.equal(verifyClientSecret('t36-plain-B', b!.secretHash), true, 'B hash untouched');
});

test('R1: same target replay -> immutable receipt metadata, NO secret material re-emitted', async () => {
  await seedClient(`t36-client-r1-${RUN}`, 't36-plain-R1');
  const r1 = await rotateClientSecret(`t36-client-r1-${RUN}`, { operationId: `t36-r1-op-${RUN}` });
  assert.equal(r1.rotation.replayed, false);
  const hashAfterRotate = (await prisma.machineClient.findUnique({ where: { clientId: `t36-client-r1-${RUN}` } }))!.secretHash;
  assert.equal(verifyClientSecret(r1.newSecret, hashAfterRotate), true);

  const replay = await rotateClientSecret(`t36-client-r1-${RUN}`, { operationId: `t36-r1-op-${RUN}` });
  assert.equal(replay.rotation.replayed, true);
  // OWNER secret semantics: replay MUST NOT re-emit credential secret material.
  assert.equal((replay as any).newSecret, undefined,
    'replay response must not carry credential secret material (original response loss = caller performs a NEW authorized rotation)');
});

test('R3: live credential advanced past receipt -> STALE_IDEMPOTENCY_RECEIPT', async () => {
  await seedClient(`t36-client-r3-${RUN}`, 't36-plain-R3');
  const first = await rotateClientSecret(`t36-client-r3-${RUN}`, { operationId: `t36-r3-op1-${RUN}` });
  assert.equal(first.rotation.replayed, false);
  // advance the live credential with a SECOND (fresh) operation
  const second = await rotateClientSecret(`t36-client-r3-${RUN}`, { operationId: `t36-r3-op2-${RUN}` });
  assert.equal(second.rotation.replayed, false);

  let stale: any = null;
  try {
    await rotateClientSecret(`t36-client-r3-${RUN}`, { operationId: `t36-r3-op1-${RUN}` });
  } catch (err: any) {
    stale = err;
  }
  assert.ok(stale, 'stale receipt replay must raise (no fake success)');
  assert.match(String(stale.message), /STALE_IDEMPOTENCY_RECEIPT/i,
    `expected STALE_IDEMPOTENCY_RECEIPT, got: ${stale.message}`);
  assert.equal(stale.statusCode, 409, 'stale receipt replay surfaces as 409');
});
