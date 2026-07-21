/**
 * AUTH_V1_GENERIC_IDEMPOTENT_PRINCIPAL_AND_CLIENT_CREATION
 *
 * Conformance tests for generic idempotent creation of MachinePrincipal and
 * MachineClient by opaque external_ref.
 *
 * Validated scenarios:
 *   1. Same external_ref → same Principal
 *   2. Same external_ref → same Client (no secret on reuse)
 *   3. Different Principal competing for same external_ref → 409
 *   4. Concurrent duplicate creation → single record
 *   5. requestDigest mismatch → 409
 *   6. expectedPrincipalId atomic claim → binds to existing
 *   7. expectedClientId atomic claim → binds to existing
 *   8. Direct DB bypass → UNIQUE constraint prevents duplicates
 *
 * RUN: npx tsx --test tests/idempotent-conformance.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  createOrGetPrincipal,
  createOrGetClient,
} from '../src/lib/oauth/v1/idempotent.js';

// ─── Test Database Setup ───────────────────────────────────────────────────

const prisma = new PrismaClient();

function uniqueRef(label: string): string {
  return `test:${label}:${crypto.randomUUID()}`;
}

async function cleanupPrincipal(externalRef: string): Promise<void> {
  try { await prisma.machinePrincipal.delete({ where: { externalRef } }); } catch { /* ok */ }
}

async function cleanupClient(externalRef: string): Promise<void> {
  try { await prisma.machineClient.delete({ where: { externalRef } }); } catch { /* ok */ }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Get a stable test owner user. Creates one if it doesn't exist.
 */
async function getTestOwner(): Promise<string> {
  const email = 'idempotent-test-owner@test.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const user = await prisma.user.create({
    data: {
      name: 'Idempotent Test Owner',
      email,
      password: 'placeholder-hash-' + crypto.randomUUID().slice(0,8),
      role: 'admin',
    },
  });
  return user.id;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test('GENERIC_PRINCIPAL_IDEMPOTENCY_PASS', async (t) => {
  const ref = uniqueRef('principal-idempotency');
  const ownerId = await getTestOwner();

  try {
    // First call: create
    const first = await createOrGetPrincipal({
      externalRef: ref,
      principalType: 'agent',
      agentId: 'test-idempotent-agent',
      ownerUserId: ownerId,
    });
    assert.equal(first.created, true, 'First call should create');
    assert.equal(first.externalRef, ref);
    assert.ok(first.id, 'Should have an ID');

    // Second call: same external_ref → return existing
    const second = await createOrGetPrincipal({
      externalRef: ref,
      principalType: 'agent',
      agentId: 'test-idempotent-agent',
      ownerUserId: ownerId,
    });
    assert.equal(second.created, false, 'Second call should return existing');
    assert.equal(second.id, first.id, 'Same principal ID');
    assert.equal(second.externalRef, ref);

    t.diagnostic(`GENERIC_PRINCIPAL_IDEMPOTENCY_PASS ✓ (principal=${first.id})`);
  } finally {
    await cleanupPrincipal(ref);
  }
});

test('GENERIC_CLIENT_IDEMPOTENCY_PASS', async (t) => {
  const ref = uniqueRef('client-idempotency');
  const ownerId = await getTestOwner();

  const principal = await createOrGetPrincipal({
    externalRef: uniqueRef('client-idempotency-owner'),
    principalType: 'agent',
    agentId: 'test-client-owner',
    ownerUserId: ownerId,
  });

  try {
    // First call: create client
    const first = await createOrGetClient({
      externalRef: ref,
      principalId: principal.id,
    });
    assert.equal(first.created, true, 'First call should create');
    assert.equal(first.externalRef, ref);
    assert.equal(first.machinePrincipalId, principal.id);
    assert.ok(first.secret, 'Should return secret on creation');

    // Second call: same external_ref + same principal → return existing
    const second = await createOrGetClient({
      externalRef: ref,
      principalId: principal.id,
    });
    assert.equal(second.created, false, 'Second call should return existing');
    assert.equal(second.clientId, first.clientId, 'Same client ID');
    assert.equal(second.machinePrincipalId, principal.id);
    assert.equal(second.secret, undefined, 'Should NOT return secret on re-fetch');

    t.diagnostic(`GENERIC_CLIENT_IDEMPOTENCY_PASS ✓ (client=${first.clientId})`);
  } finally {
    await cleanupClient(ref);
    await cleanupPrincipal(principal.externalRef);
  }
});

test('EXTERNAL_REF_CONFLICT_FAIL_CLOSED::principal', async (t) => {
  const ref = uniqueRef('principal-conflict');

  try {
    const first = await createOrGetPrincipal({ externalRef: ref });

    // Try to create another with same ref but different expected ID
    await assert.rejects(
      async () => {
        await createOrGetPrincipal({
          externalRef: ref,
          expectedPrincipalId: crypto.randomUUID(),
        });
      },
      (err: Error & { statusCode?: number }) => {
        assert.equal(err.statusCode, 409, 'Should reject with 409 Conflict');
        return true;
      },
    );

    // Same external_ref with matching expectedPrincipalId → should pass
    const same = await createOrGetPrincipal({
      externalRef: ref,
      expectedPrincipalId: first.id,
    });
    assert.equal(same.id, first.id, 'Matching expectedPrincipalId should succeed');

    t.diagnostic('EXTERNAL_REF_CONFLICT_FAIL_CLOSED ✓');
  } finally {
    await cleanupPrincipal(ref);
  }
});

test('EXTERNAL_REF_CONFLICT_FAIL_CLOSED::client', async (t) => {
  const ref = uniqueRef('client-conflict');

  const principalA = await createOrGetPrincipal({
    externalRef: uniqueRef('client-conflict-a'),
  });
  const principalB = await createOrGetPrincipal({
    externalRef: uniqueRef('client-conflict-b'),
  });

  try {
    const client = await createOrGetClient({
      externalRef: ref,
      principalId: principalA.id,
    });
    assert.equal(client.created, true);

    // Same ref with different principal → 409
    await assert.rejects(
      async () => {
        await createOrGetClient({
          externalRef: ref,
          principalId: principalB.id,
        });
      },
      (err: Error & { statusCode?: number }) => {
        assert.equal(err.statusCode, 409);
        return true;
      },
    );

    t.diagnostic('EXTERNAL_REF_CONFLICT_FAIL_CLOSED::client ✓');
  } finally {
    await cleanupClient(ref);
    await cleanupPrincipal(principalA.externalRef);
    await cleanupPrincipal(principalB.externalRef);
  }
});

test('CONCURRENT_DUPLICATE_CREATION_PREVENTED', async (t) => {
  const ref = uniqueRef('concurrent');

  try {
    const results = await Promise.allSettled([
      createOrGetPrincipal({ externalRef: ref }),
      createOrGetPrincipal({ externalRef: ref }),
      createOrGetPrincipal({ externalRef: ref }),
    ]);

    const created = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrGetPrincipal>>> =>
        r.status === 'fulfilled' && r.value.created === true,
    ).length;
    const returned = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrGetPrincipal>>> =>
        r.status === 'fulfilled' && r.value.created === false,
    ).length;
    const rejected = results.filter((r) => r.status === 'rejected').length;

    assert.equal(created, 1, 'Concurrent requests should produce exactly 1 created principal');
    assert.equal(rejected, 0, 'No concurrent request should be rejected');

    const ids = new Set(
      results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrGetPrincipal>>> => r.status === 'fulfilled')
        .map((r) => r.value.id),
    );
    assert.equal(ids.size, 1, 'All concurrent requests should see the same principal ID');

    const dbRecords = await prisma.machinePrincipal.findMany({
      where: { externalRef: ref },
    });
    assert.equal(dbRecords.length, 1, 'Database should have exactly 1 record');

    t.diagnostic(`CONCURRENT_DUPLICATE_CREATION_PREVENTED ✓ (created=${created}, returned=${returned})`);
  } finally {
    await cleanupPrincipal(ref);
  }
});

test('CONCURRENT_DUPLICATE_CLIENT_CREATION_PREVENTED', async (t) => {
  const ref = uniqueRef('concurrent-client');
  const principal = await createOrGetPrincipal({
    externalRef: uniqueRef('concurrent-client-owner'),
  });

  try {
    const results = await Promise.allSettled([
      createOrGetClient({ externalRef: ref, principalId: principal.id }),
      createOrGetClient({ externalRef: ref, principalId: principal.id }),
      createOrGetClient({ externalRef: ref, principalId: principal.id }),
    ]);

    const created = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrGetClient>>> =>
        r.status === 'fulfilled' && r.value.created === true,
    ).length;
    const returned = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrGetClient>>> =>
        r.status === 'fulfilled' && r.value.created === false,
    ).length;

    assert.equal(created, 1, 'Exactly 1 client should be created');
    assert.equal(returned, 2, 'Other 2 should return existing');

    // Secret non-replay: only the actual creator gets the secret
    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrGetClient>>> => r.status === 'fulfilled')
      .map((r) => r.value);
    const withSecret = fulfilled.filter((r) => r.secret !== undefined);
    const withoutSecret = fulfilled.filter((r) => r.secret === undefined);
    assert.equal(withSecret.length, 1, 'Exactly 1 result should contain the secret');
    assert.equal(withoutSecret.length, 2, 'Exactly 2 results should have no secret');
    assert.equal(withSecret[0].created, true, 'The result with secret is the creator');
    withoutSecret.forEach((r) => assert.equal(r.created, false, 'Results without secret are not creators'));

    const clientIds = new Set(fulfilled.map((r) => r.clientId));
    assert.equal(clientIds.size, 1, 'All return the same client ID');

    const dbRecords = await prisma.machineClient.findMany({
      where: { externalRef: ref },
    });
    assert.equal(dbRecords.length, 1, 'Database should have 1 client');

    t.diagnostic('CONCURRENT_DUPLICATE_CLIENT_CREATION_PREVENTED ✓');
  } finally {
    await cleanupClient(ref);
    await cleanupPrincipal(principal.externalRef);
  }
});

test('REQUEST_DIGEST_MISMATCH', async (t) => {
  const ref = uniqueRef('digest-mismatch');
  const ownerId = await getTestOwner();

  try {
    // Create with specific identity
    const first = await createOrGetPrincipal({
      externalRef: ref,
      principalType: 'agent',
      agentId: 'digest-agent-1',
      ownerUserId: ownerId,
    });
    assert.equal(first.created, true);

    // Attempt to resolve with different identity → must fail
    await assert.rejects(
      async () => {
        await createOrGetPrincipal({
          externalRef: ref,
          principalType: 'agent',
          agentId: 'digest-agent-2',
          ownerUserId: ownerId,
        });
      },
      (err: Error & { statusCode?: number }) => {
        assert.equal(err.statusCode, 409, 'Digest mismatch should be 409');
        assert.ok(err.message.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'),
          `Error should mention PAYLOAD_MISMATCH: ${err.message}`);
        return true;
      },
    );

    t.diagnostic('REQUEST_DIGEST_MISMATCH ✓');
  } finally {
    await cleanupPrincipal(ref);
  }
});

test('EXPECTED_PRINCIPAL_ID_ATOMIC_CLAIM', async (t) => {
  const ref = uniqueRef('atomic-claim');
  const ownerId = await getTestOwner();

  try {
    // Create a principal via the legacy style (no externalRef)
    const preexisting = await prisma.machinePrincipal.create({
      data: {
        principalType: 'agent',
        agentId: `legacy-agent-${crypto.randomUUID().slice(0, 8)}`,
        ownerUserId: ownerId,
        displayName: 'Legacy Agent for Claim Test',
      },
    });

    // Claim: bind externalRef to this existing principal
    const claimed = await createOrGetPrincipal({
      externalRef: ref,
      expectedPrincipalId: preexisting.id,
      principalType: 'agent',
      agentId: preexisting.agentId!,
      ownerUserId: preexisting.ownerUserId!,
    });
    assert.equal(claimed.created, false, 'Claim should not create new principal');
    assert.equal(claimed.id, preexisting.id, 'Claim should return the existing principal');
    assert.equal(claimed.externalRef, ref, 'Claim should bind externalRef');

    // Subsequent call with same ref should return the same principal
    const again = await createOrGetPrincipal({
      externalRef: ref,
      principalType: 'agent',
      agentId: preexisting.agentId!,
      ownerUserId: preexisting.ownerUserId!,
    });
    assert.equal(again.id, preexisting.id, 'Repeat call returns same principal');
    assert.equal(again.created, false, 'Repeat call is not a creation');

    t.diagnostic('EXPECTED_PRINCIPAL_ID_ATOMIC_CLAIM ✓');
  } finally {
    await cleanupPrincipal(ref);
  }
});

test('EXPECTED_CLIENT_ID_ATOMIC_CLAIM', async (t) => {
  const ref = uniqueRef('atomic-client-claim');
  const ownerId = await getTestOwner();
  const agentId = `atomic-client-${crypto.randomUUID().slice(0, 8)}`;
  let principalRef = '';

  try {
    const principal = await createOrGetPrincipal({
      externalRef: uniqueRef('atomic-client-owner'),
      principalType: 'agent',
      agentId,
      ownerUserId: ownerId,
    });
    principalRef = principal.externalRef;

    // Create a client without externalRef (legacy)
    const preexisting = await prisma.machineClient.create({
      data: {
        clientId: `mc_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        machinePrincipalId: principal.id,
        secretHash: 'test-salt:test-hash',
        allowedResources: [],
        allowedScopes: [],
      },
    });

    // Claim: bind externalRef to this existing client
    const claimed = await createOrGetClient({
      externalRef: ref,
      principalId: principal.id,
      expectedClientId: preexisting.id,
    });
    assert.equal(claimed.created, false, 'Claim should not create new client');
    assert.equal(claimed.id, preexisting.id, 'Claim should return existing client');
    assert.equal(claimed.externalRef, ref, 'Claim should bind externalRef');
    assert.equal(claimed.secret, undefined, 'Claim should NOT return secret');

    // Subsequent call should return same client
    const again = await createOrGetClient({
      externalRef: ref,
      principalId: principal.id,
    });
    assert.equal(again.id, preexisting.id, 'Repeat returns same client');
    assert.equal(again.secret, undefined, 'Repeat should NOT return secret either');

    t.diagnostic('EXPECTED_CLIENT_ID_ATOMIC_CLAIM ✓');
  } finally {
    await cleanupClient(ref);
    if (principalRef) await cleanupPrincipal(principalRef);
  }
});

test('DUPLICATE_NON_NULL_EXTERNAL_REF_DB_BLOCKED', async (t) => {
  const ref = uniqueRef('direct-db');

  try {
    const first = await createOrGetPrincipal({ externalRef: ref });
    assert.equal(first.created, true);

    // Direct DB insert with same non-null external_ref → must fail (UNIQUE constraint)
    await assert.rejects(
      async () => {
        await prisma.machinePrincipal.create({
          data: { principalType: 'service', externalRef: ref },
        });
      },
      (err: Error) => {
        const code = (err as any)?.code;
        assert.ok(
          code === 'P2002' || err.message?.includes('unique') ||
          err.message?.includes('duplicate') || err.message?.includes('external_ref'),
          `DB UNIQUE constraint must reject duplicate non-null external_ref: ${err.message}`,
        );
        return true;
      },
    );

    // Direct DB insert with NULL external_ref is NOT blocked (separate concern)
    const nullRef = await prisma.machinePrincipal.create({
      data: { principalType: 'service' },
    });
    assert.ok(nullRef.id, 'NULL external_ref creation is still possible via direct DB');
    assert.equal(nullRef.externalRef, null);
    // Clean up the null-ref record
    await prisma.machinePrincipal.delete({ where: { id: nullRef.id } });

    t.diagnostic('DUPLICATE_NON_NULL_EXTERNAL_REF_DB_BLOCKED ✓');
  } finally {
    await cleanupPrincipal(ref);
  }
});

test('DUPLICATE_NON_NULL_EXTERNAL_REF_CLIENT_DB_BLOCKED', async (t) => {
  const ref = uniqueRef('direct-db-client');
  const principal = await createOrGetPrincipal({
    externalRef: uniqueRef('direct-db-client-owner'),
  });

  try {
    const first = await createOrGetClient({
      externalRef: ref,
      principalId: principal.id,
    });
    assert.equal(first.created, true);

    // Direct DB insert with same non-null external_ref → must fail (UNIQUE constraint)
    await assert.rejects(
      async () => {
        await prisma.machineClient.create({
          data: {
            clientId: `mc_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
            machinePrincipalId: principal.id,
            secretHash: 'test-salt:test-hash',
            externalRef: ref,
            allowedResources: [],
            allowedScopes: [],
          },
        });
      },
      (err: Prisma.PrismaClientKnownRequestError) => {
        assert.equal(err.code, 'P2002', 'DB UNIQUE constraint must reject duplicate non-null client external_ref');
        return true;
      },
    );

    t.diagnostic('DUPLICATE_NON_NULL_EXTERNAL_REF_CLIENT_DB_BLOCKED ✓');
  } finally {
    await cleanupClient(ref);
    await cleanupPrincipal(principal.externalRef);
  }
});

test('createOrGetClient: principal not found → 404', async () => {
  const ref = uniqueRef('client-no-principal');

  await assert.rejects(
    async () => {
      await createOrGetClient({
        externalRef: ref,
        principalId: '00000000-0000-0000-0000-000000000000',
      });
    },
    (err: Error & { statusCode?: number }) => {
      assert.equal(err.statusCode, 404);
      return true;
    },
  );
});

test('createOrGetClient: disabled principal → 403', async (t) => {
  const ref = uniqueRef('client-disabled-principal');
  const principal = await createOrGetPrincipal({
    externalRef: uniqueRef('disabled-owner'),
  });

  try {
    await prisma.machinePrincipal.update({
      where: { id: principal.id },
      data: { status: 'disabled', disabledAt: new Date() },
    });

    await assert.rejects(
      async () => {
        await createOrGetClient({
          externalRef: ref,
          principalId: principal.id,
        });
      },
      (err: Error & { statusCode?: number }) => {
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  } finally {
    await cleanupPrincipal(principal.externalRef);
  }
});
