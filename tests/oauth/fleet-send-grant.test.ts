/**
 * AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 — fleet send grant
 * birth-stamp unit tests (DB-free; the store delegate is injected).
 *
 * Governing Spec: AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1
 * (dsh-agent-core, accepted r4 AMENDMENT_1 @ 5dd41e2; r3 accepted @ 6bce155)
 * §3/§4/§5.
 *
 * RUN: npx tsx --test tests/oauth/fleet-send-grant.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLEET_SEND_AUDIENCE_ID,
  FLEET_SEND_SCOPE,
  ensureFleetSessionSendGrant,
  planFleetSendGrants,
  type FleetSendGrantStore,
} from '../../src/lib/oauth/v1/fleet-send-grant.js';

// ─── In-memory store fixture ───────────────────────────────────────────────

interface GrantRow {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}

function makeStore(opts: {
  principalType: 'agent' | 'service';
  principalId?: string;
  principalFound?: boolean;
  audienceStatus?: 'active' | 'candidate' | null;
  existingGrant?: GrantRow | null;
}): { store: FleetSendGrantStore; grantRows: GrantRow[]; client: { id: string; machinePrincipalId: string } } {
  const principalId = opts.principalId ?? '11111111-1111-1111-1111-111111111111';
  const clientId = 'mc_testclient0000000000000';
  const client = { id: clientId, machinePrincipalId: principalId };
  const grantRows: GrantRow[] = opts.existingGrant ? [{ ...opts.existingGrant }] : [];

  const store = {
    machinePrincipal: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        opts.principalFound === false
          ? null
          : { id: where.id, principalType: opts.principalType, status: 'active' },
    },
    authAudience: {
      findUnique: async () =>
        opts.audienceStatus == null
          ? null
          : { audienceId: FLEET_SEND_AUDIENCE_ID, status: opts.audienceStatus },
    },
    machineAccessGrant: {
      findUnique: async ({ where }: { where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } } }) =>
        grantRows.find(
          (g) => g.machineClientId === where.machineClientId_audienceId.machineClientId &&
                 g.audienceId === where.machineClientId_audienceId.audienceId,
        ) ?? null,
      create: async ({ data }: { data: { machineClientId: string; audienceId: string; scopes: string[] } }) => {
        const row: GrantRow = { ...data, version: 1 };
        grantRows.push(row);
        return row;
      },
      update: async ({ where, data }: {
        where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } };
        data: { scopes: string[]; version: { increment: number } };
      }) => {
        const row = grantRows.find(
          (g) => g.machineClientId === where.machineClientId_audienceId.machineClientId &&
                 g.audienceId === where.machineClientId_audienceId.audienceId,
        );
        assert.ok(row, 'update target row must exist');
        row.scopes = data.scopes;
        row.version += data.version.increment;
        return row;
      },
    },
  } as unknown as FleetSendGrantStore;

  return { store, grantRows, client };
}

// ─── Birth-stamp behavior (Spec §4) ───────────────────────────────────────

test('FLEET_STAMP_AGENT_CREATES_EXACT_ROW', async () => {
  const { store, grantRows, client } = makeStore({ principalType: 'agent', audienceStatus: 'active' });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'created');
  assert.equal(grantRows.length, 1);
  assert.deepEqual(grantRows[0].scopes, [FLEET_SEND_SCOPE]);
  assert.equal(grantRows[0].audienceId, FLEET_SEND_AUDIENCE_ID);
  assert.equal(grantRows[0].version, 1);
});

test('FLEET_STAMP_IDEMPOTENT_REENTRY_IS_KEEP_WITH_NO_WRITE', async () => {
  const existing = {
    machineClientId: 'mc_testclient0000000000000',
    audienceId: FLEET_SEND_AUDIENCE_ID,
    scopes: [FLEET_SEND_SCOPE],
    version: 2,
  };
  const { store, grantRows, client } = makeStore({ principalType: 'agent', audienceStatus: 'active', existingGrant: existing });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'kept');
  assert.equal(grantRows.length, 1);
  assert.equal(grantRows[0].version, 2, 'exact row must be untouched (version stable)');
});

test('FLEET_STAMP_PRESERVES_ENUMERATED_INSPECTION_SCOPE', async () => {
  // HR-shaped dual-scope row (AMENDMENT_1): lawful as-is → kept, no write, version stable.
  const existing = {
    machineClientId: 'mc_testclient0000000000000',
    audienceId: FLEET_SEND_AUDIENCE_ID,
    scopes: [FLEET_SEND_SCOPE, 'agent.session.inspect_own_dispatch'],
    version: 3,
  };
  const { store, grantRows, client } = makeStore({ principalType: 'agent', audienceStatus: 'active', existingGrant: existing });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'kept');
  assert.deepEqual([...grantRows[0].scopes].sort(), ['agent.session.inspect_own_dispatch', FLEET_SEND_SCOPE].sort());
  assert.equal(grantRows[0].version, 3, 'lawful row: no set change, version stable');
});

test('FLEET_STAMP_NORMALIZES_STRIPS_ONLY_NON_ENUMERATED_EXTRAS', async () => {
  const existing = {
    machineClientId: 'mc_testclient0000000000000',
    audienceId: FLEET_SEND_AUDIENCE_ID,
    scopes: [FLEET_SEND_SCOPE, 'agent.session.bogus'],
    version: 2,
  };
  const { store, grantRows, client } = makeStore({ principalType: 'agent', audienceStatus: 'active', existingGrant: existing });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'normalized');
  assert.deepEqual(grantRows[0].scopes, [FLEET_SEND_SCOPE], 'non-enumerated extra is stripped');
  assert.equal(grantRows[0].version, 3, 'actual set change increments version');
});

test('FLEET_STAMP_NORMALIZE_ADDS_SEND_PRESERVING_INSPECTION', async () => {
  const existing = {
    machineClientId: 'mc_testclient0000000000000',
    audienceId: FLEET_SEND_AUDIENCE_ID,
    scopes: ['agent.session.inspect_own_dispatch'],
    version: 1,
  };
  const { store, grantRows, client } = makeStore({ principalType: 'agent', audienceStatus: 'active', existingGrant: existing });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'normalized');
  assert.deepEqual([...grantRows[0].scopes].sort(), ['agent.session.inspect_own_dispatch', FLEET_SEND_SCOPE].sort(),
    'send is added while the enumerated independent scope survives');
  assert.equal(grantRows[0].version, 2);
});

test('FLEET_STAMP_SERVICE_PRINCIPAL_NEVER_STAMPED', async () => {
  const { store, grantRows, client } = makeStore({ principalType: 'service' });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'skipped_not_agent_principal');
  assert.equal(grantRows.length, 0, 'no grant row may be written for a service principal');
});

test('FLEET_STAMP_AUDIENCE_ABSENT_SKIPS_WITHOUT_WRITE_OR_THROW', async () => {
  const { store, grantRows, client } = makeStore({ principalType: 'agent', audienceStatus: null });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'skipped_audience_absent_or_inactive');
  assert.equal(grantRows.length, 0);
});

test('FLEET_STAMP_AUDIENCE_INACTIVE_SKIPS', async () => {
  const { store, grantRows, client } = makeStore({ principalType: 'agent', audienceStatus: 'candidate' });
  const result = await ensureFleetSessionSendGrant(store, client);
  assert.equal(result, 'skipped_audience_absent_or_inactive');
  assert.equal(grantRows.length, 0);
});

test('FLEET_STAMP_MISSING_PRINCIPAL_FAILS_CLOSED', async () => {
  const { store, client } = makeStore({ principalType: 'agent', principalFound: false });
  await assert.rejects(() => ensureFleetSessionSendGrant(store, client), /not found/);
});

// ─── Planner sanity (pure; full fixtures live in the script --selftest) ────

test('FLEET_PLAN_CLIENT_KEYED_PAIRS_AND_CENSUS', () => {
  const plan = planFleetSendGrants({
    audiencePresent: true,
    members: [
      { agentId: 'agt_a', principalId: 'p1', clientId: 'c1' },
      { agentId: 'agt_a', principalId: 'p1', clientId: 'c2' },
      { agentId: 'agt_b', principalId: 'p2', clientId: 'c3' },
    ],
    grantsByClientId: new Map([
      ['c1', { scopes: [FLEET_SEND_SCOPE], version: 1 }],
      ['c3', { scopes: [FLEET_SEND_SCOPE, 'extra.scope'], version: 5 }],
    ]),
    nonFleetGrantCount: 4,
  });
  assert.deepEqual(
    plan.entries.map((e) => `${e.clientId}:${e.action}`),
    ['c1:KEEP', 'c2:ADD', 'c3:NORMALIZE'],
  );
  const dual = planFleetSendGrants({
    audiencePresent: true,
    members: [{ agentId: 'agt_hr', principalId: 'p', clientId: 'c-hr' }],
    grantsByClientId: new Map([
      ['c-hr', { scopes: [FLEET_SEND_SCOPE, 'agent.session.inspect_own_dispatch'], version: 2 } ],
    ]),
    nonFleetGrantCount: 0,
  });
  assert.equal(dual.entries[0].action, 'KEEP', 'HR dual-scope row is lawful (make-lawful no-op)');
  assert.equal(dual.census.sendEntitlementMissingCount, 0, 'dual-scope row does not count as missing');
  assert.equal(plan.census.productionCanonicalAgentCount, 2, 'agents counted once, clients keyed per pair');
  assert.equal(plan.census.sendEntitlementMissingCount, 2, 'ADD + NORMALIZE both lack the exact row');
  assert.equal(plan.census.nonFleetGrantCount, 4, 'non-fleet rows counted, never mutated');
});
