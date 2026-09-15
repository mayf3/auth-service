/**
 * AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1 r4 / Auth local spec
 * AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1 — the three
 * PR #75 REVISE blocker regressions, promoted from the 3/3 RED defect
 * reproductions (archived in dsh evidence REVISE_ROUND1.md) to permanent
 * green regressions:
 *
 *   RG1 (P1-B) HR send+inspect row re-entry remains unchanged; version does
 *              not grow — via BOTH the birth-stamp and the reconcile planner.
 *   RG2 (P1-A) grant/stamp failure during first creation leaves no orphan
 *              client (transactional T1); retry creates a usable client with
 *              a returned one-time secret (T3).
 *   RG3 (P2)   two concurrent first stamps converge: exactly one grant row,
 *              no unhandled P2002, no gratuitous version increase (T2).
 *
 * Run: npx tsx --test tests/oauth/fleet-send-regression.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLEET_SEND_AUDIENCE_ID,
  FLEET_SEND_SCOPE,
  ensureFleetSessionSendGrant,
  materializeFleetGrantPlan,
  planFleetSendGrants,
  type FleetSendGrantStore,
} from '../../src/lib/oauth/v1/fleet-send-grant.js';
import { createOrGetClient } from '../../src/lib/oauth/v1/idempotent.js';

const PRINCIPAL_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_DB_ID = '33333333-3333-4333-8333-333333333333';

interface GrantRow {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}
interface ClientRow {
  id: string;
  clientId: string;
  machinePrincipalId: string;
  externalRef: string | null;
  status: string;
  secretHash: string;
}

const P2002_ERROR = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

/**
 * Transactional in-memory store double. $transaction snapshots state and
 * restores it on failure — the mechanical property RG2 proves — and
 * machineAccessGrant.create enforces the composite PK (the mechanical
 * property RG3 proves; the pre-fix mock appended blindly and hid P2002).
 */
function makeTxStore(opts: { failGrantWith?: Error } = {}) {
  const state = { clients: [] as ClientRow[], grants: [] as GrantRow[] };

  const surfaces = {
    machineClient: {
      findUnique: async ({ where }: { where: { externalRef?: string; id?: string } }) =>
        state.clients.find(
          (c) =>
            (where.externalRef !== undefined && c.externalRef === where.externalRef) ||
            (where.id !== undefined && c.id === where.id),
        ) ?? null,
      create: async ({ data }: { data: Omit<ClientRow, 'id' | 'status'> }) => {
        const row: ClientRow = { ...data, id: CLIENT_DB_ID, status: 'active' };
        state.clients.push(row);
        return row;
      },
    },
    machinePrincipal: {
      findUnique: async () => ({ id: PRINCIPAL_ID, principalType: 'agent', status: 'active' }),
    },
    authAudience: {
      findUnique: async () => ({ audienceId: FLEET_SEND_AUDIENCE_ID, status: 'active' }),
    },
    machineAccessGrant: {
      findUnique: async ({ where }: { where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } } }) =>
        state.grants.find(
          (g) =>
            g.machineClientId === where.machineClientId_audienceId.machineClientId &&
            g.audienceId === where.machineClientId_audienceId.audienceId,
        ) ?? null,
      create: async ({ data }: { data: { machineClientId: string; audienceId: string; scopes: string[] } }) => {
        if (opts.failGrantWith) throw opts.failGrantWith;
        if (
          state.grants.some(
            (g) => g.machineClientId === data.machineClientId && g.audienceId === data.audienceId,
          )
        ) {
          throw P2002_ERROR;
        }
        const row: GrantRow = { ...data, version: 1 };
        state.grants.push(row);
        return row;
      },
      update: async ({ where, data }: {
        where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } };
        data: { scopes: string[]; version: { increment: number } };
      }) => {
        const row = state.grants.find(
          (g) =>
            g.machineClientId === where.machineClientId_audienceId.machineClientId &&
            g.audienceId === where.machineClientId_audienceId.audienceId,
        );
        assert.ok(row, 'update target row must exist');
        row.scopes = data.scopes;
        row.version += data.version.increment;
        return row;
      },
    },
  };

  const store = {
    ...surfaces,
    $transaction: async (fn: (tx: typeof surfaces) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try {
        return await fn(surfaces);
      } catch (error) {
        state.clients = snapshot.clients;
        state.grants = snapshot.grants;
        throw error;
      }
    },
  };

  return { store, state };
}

// ─── RG1 (P1-B): HR dual-scope row is invariant under re-entry ─────────────

test('RG1_HR_dual_scope_row_reentry_unchanged_version_stable', async () => {
  const dual = ['agent.session.inspect_own_dispatch', FLEET_SEND_SCOPE];

  // Birth-stamp re-entry.
  const stamp = makeTxStore();
  stamp.state.grants.push({ machineClientId: CLIENT_DB_ID, audienceId: FLEET_SEND_AUDIENCE_ID, scopes: dual, version: 2 });
  const stampResult = await ensureFleetSessionSendGrant(stamp.store as unknown as FleetSendGrantStore, {
    id: CLIENT_DB_ID,
    machinePrincipalId: PRINCIPAL_ID,
  });
  assert.equal(stampResult, 'kept');
  assert.deepEqual([...stamp.state.grants[0].scopes].sort(), dual.sort());
  assert.equal(stamp.state.grants[0].version, 2, 'no version growth on lawful re-entry');

  // Reconcile planner re-entry.
  const plan = planFleetSendGrants({
    audiencePresent: true,
    members: [{ agentId: 'agt_hr-agent', principalId: PRINCIPAL_ID, clientId: CLIENT_DB_ID }],
    grantsByClientId: new Map([[CLIENT_DB_ID, { scopes: dual, version: 2 }]]),
    nonFleetGrantCount: 0,
  });
  assert.equal(plan.entries[0].action, 'KEEP');
  assert.deepEqual([...plan.entries[0].planScopes].sort(), dual.sort());
  assert.equal(plan.census.sendEntitlementMissingCount, 0);

  // Apply path (reconcile --apply materializer): a NON-lawful row carrying
  // the enumerated scope (inspect-only) must be normalized to send+inspect —
  // the write goes to the make-lawful target (planScopes), never send-only.
  // Regression for the consolidated-review blocker (apply branch had written
  // the send-only constant, destroying the independent authorization).
  const applyStore = makeTxStore();
  applyStore.state.grants.push({
    machineClientId: CLIENT_DB_ID,
    audienceId: FLEET_SEND_AUDIENCE_ID,
    scopes: ['agent.session.inspect_own_dispatch'],
    version: 1,
  });
  const applyPlan = planFleetSendGrants({
    audiencePresent: true,
    members: [{ agentId: 'agt_hr-agent', principalId: PRINCIPAL_ID, clientId: CLIENT_DB_ID }],
    grantsByClientId: new Map([[CLIENT_DB_ID, { scopes: ['agent.session.inspect_own_dispatch'], version: 1 }]]),
    nonFleetGrantCount: 0,
  });
  assert.equal(applyPlan.entries[0].action, 'NORMALIZE');
  const auditLines: string[] = [];
  await materializeFleetGrantPlan(applyStore.store as unknown as FleetSendGrantStore, applyPlan.entries, (e) => {
    auditLines.push(`${e.action}:${e.scopes}`);
  });
  assert.deepEqual(
    [...applyStore.state.grants[0].scopes].sort(),
    dual.sort(),
    'apply writes the make-lawful target: send added, inspection preserved',
  );
  assert.equal(applyStore.state.grants[0].version, 2, 'one increment for one actual set change');
  assert.ok(auditLines.some((l) => l === `NORMALIZE:${[...dual].sort().join(' ')}`), 'audit reports the written (make-lawful) scopes');
});

// ─── RG2 (P1-A): stamp failure rolls back the client; retry returns a secret ─

test('RG2_stamp_failure_no_orphan_client_retry_returns_one_time_secret', async () => {
  // First attempt: grant storage outage inside the create transaction.
  const failing = makeTxStore({ failGrantWith: new Error('storage outage') });
  await assert.rejects(() =>
    createOrGetClient({ externalRef: 'test:rg2:fail', principalId: PRINCIPAL_ID }, failing.store),
  );
  assert.equal(failing.state.clients.length, 0, 'T1: client row rolled back with the failed grant');
  assert.equal(failing.state.grants.length, 0);

  // Retry with the SAME external_ref on a healed store: the rollback left
  // the ref unbound, so this re-enters the fresh-create branch and returns
  // a NEW one-time secret (T3, literal same-ref retry).
  const healed = makeTxStore();
  const retried = await createOrGetClient(
    { externalRef: 'test:rg2:fail', principalId: PRINCIPAL_ID },
    healed.store,
  );
  assert.equal(retried.created, true);
  assert.equal(typeof retried.secret, 'string');
  assert.ok((retried.secret ?? '').length >= 20, 'one-time secret returned on fresh create');
  assert.equal(healed.state.clients.length, 1);
  assert.equal(healed.state.grants.length, 1, 'grant row committed with the client');
  assert.deepEqual(healed.state.grants[0].scopes, [FLEET_SEND_SCOPE]);
});

// ─── RG3 (P2): concurrent first stamps converge to the winner ──────────────

test('RG3_concurrent_first_stamp_converges_single_row_no_P2002_leak', async () => {
  const { store, state } = makeTxStore();
  const client = { id: CLIENT_DB_ID, machinePrincipalId: PRINCIPAL_ID };
  const outcomes = await Promise.allSettled([
    ensureFleetSessionSendGrant(store as unknown as FleetSendGrantStore, client),
    ensureFleetSessionSendGrant(store as unknown as FleetSendGrantStore, client),
  ]);
  assert.ok(outcomes.every((o) => o.status === 'fulfilled'), 'loser converges; no unhandled P2002');
  const values = outcomes.map((o) => (o as PromiseFulfilledResult<string>).value).sort();
  assert.deepEqual(values, ['created', 'kept'], 'winner creates, loser converges to kept');
  assert.equal(state.grants.length, 1, 'exactly one grant row');
  assert.equal(state.grants[0].version, 1, 'no gratuitous version growth');
  assert.deepEqual(state.grants[0].scopes, [FLEET_SEND_SCOPE]);
});
