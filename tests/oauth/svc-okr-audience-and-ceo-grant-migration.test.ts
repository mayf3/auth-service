/**
 * svc-okr Audience + CEO Grant Migration — Idempotency and Failure-Closed Tests
 *
 * Tests the migration logic for:
 *   1. Creating the svc-okr audience in auth_audiences (if absent)
 *   2. Creating the svc-okr grant for the authoritative CEO Client (if absent)
 *
 * The actual migration (prisma/migrations/20260722000200_svc_okr_audience_and_ceo_grant/)
 * uses the same logic via PL/pgSQL DO blocks.
 *
 * Coverage:
 *   AUDIENCE_FIRST_APPLY_PASS           — audience created when absent
 *   AUDIENCE_SECOND_APPLY_NO_OP         — second apply does nothing
 *   AUDIENCE_UNEXPECTED_STATE_FAILS     — scope/resource mismatch → error
 *   GRANT_FIRST_APPLY_PASS              — grant created when absent
 *   GRANT_SECOND_APPLY_NO_OP            — second apply does nothing
 *   GRANT_SECOND_APPLY_VERSION_NO_BUMP  — version not incremented on no-op
 *   GRANT_UNEXPECTED_SCOPE_FAILS        — extra/wrong scopes → error
 *   WRONG_CLIENT_FAILS_CLOSED           — wrong client ID → error
 *   WRONG_PRINCIPAL_FAILS_CLOSED        — client belongs to wrong principal → error
 *   SVC_WORKFLOW_GRANT_PRESERVED        — existing workflow grant untouched
 *   OTHER_CLIENTS_UNCHANGED             — other client grants not touched
 *   OTHER_AUDIENCES_UNCHANGED           — other audience grants for same client not touched
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ---------------------------------------------------------------------------
// Simulated database types
// ---------------------------------------------------------------------------

interface Audience {
  audienceId: string;
  resourceService: string;
  scopeNamespace: string;
  acceptedPrincipalTypes: string[];
  registeredScopes: string[];
  humanAccessEnabled: boolean;
  machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean;
  status: string;
  freezeReady: boolean;
  version: number;
}

interface Grant {
  clientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}

interface Client {
  clientId: string;
  principalId: string;
}

interface Principal {
  id: string;
}

interface DbState {
  audiences: Audience[];
  principals: Principal[];
  clients: Client[];
  grants: Grant[];
}

// ---------------------------------------------------------------------------
// Fixed target values (authoritative database state)
// ---------------------------------------------------------------------------

const FIXED_PRINCIPAL_ID = 'b6b033c4-90ba-40aa-a338-304da442cab7';
const FIXED_CLIENT_ID = 'mc_HLxfspbjzHEdXmiiX3Gk7D27';
const FIXED_AUDIENCE = 'svc-okr';
const SCOPES_OKR_READ_WRITE: string[] = ['okr.read', 'okr.write'];
const SCOPES_WORKFLOW: string[] = ['workflow.read', 'workflow.execute'];

// Frozen registry definition for svc-okr audience
const FROZEN_SVC_OKR_AUDIENCE: Audience = {
  audienceId: 'svc-okr',
  resourceService: 'svc-okr',
  scopeNamespace: 'okr',
  acceptedPrincipalTypes: ['user', 'agent'],
  registeredScopes: [...SCOPES_OKR_READ_WRITE],
  humanAccessEnabled: true,
  machineAccessEnabled: true,
  delegatedAccessEnabled: false,
  status: 'active',
  freezeReady: true,
  version: 1,
};

const FROZEN_SVC_WORKFLOW_AUDIENCE: Audience = {
  audienceId: 'svc-workflow',
  resourceService: 'svc-workflow',
  scopeNamespace: 'workflow',
  acceptedPrincipalTypes: ['agent'],
  registeredScopes: ['workflow.admin', 'workflow.execute', 'workflow.read'],
  humanAccessEnabled: false,
  machineAccessEnabled: true,
  delegatedAccessEnabled: true,
  status: 'active',
  freezeReady: true,
  version: 1,
};

// ---------------------------------------------------------------------------
// Simulated migration result types
// ---------------------------------------------------------------------------

type AudienceResult =
  | { status: 'created'; audience: string }
  | { status: 'noop'; audience: string }
  | { status: 'error'; message: string };

type GrantResult =
  | { status: 'created'; scopes: string[]; version: number }
  | { status: 'noop'; scopes: string[]; version: number }
  | { status: 'error'; message: string };

type MigrationResult =
  | { status: 'ok'; audience: AudienceResult; grant: GrantResult }
  | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// Simulated migration functions (mirror the PL/pgSQL DO block logic)
// ---------------------------------------------------------------------------

function runAudienceMigration(state: DbState): AudienceResult {
  const existing = state.audiences.find(a => a.audienceId === FIXED_AUDIENCE);

  if (!existing) {
    // Create the audience with frozen registry values
    state.audiences.push({ ...FROZEN_SVC_OKR_AUDIENCE });
    return { status: 'created', audience: FIXED_AUDIENCE };
  }

  // Verify critical fields match frozen registry
  const fieldsToCheck: Array<[string, unknown, unknown]> = [
    ['resourceService', existing.resourceService, FROZEN_SVC_OKR_AUDIENCE.resourceService],
    ['scopeNamespace', existing.scopeNamespace, FROZEN_SVC_OKR_AUDIENCE.scopeNamespace],
    ['humanAccessEnabled', existing.humanAccessEnabled, FROZEN_SVC_OKR_AUDIENCE.humanAccessEnabled],
    ['machineAccessEnabled', existing.machineAccessEnabled, FROZEN_SVC_OKR_AUDIENCE.machineAccessEnabled],
    ['delegatedAccessEnabled', existing.delegatedAccessEnabled, FROZEN_SVC_OKR_AUDIENCE.delegatedAccessEnabled],
  ];
  for (const [field, actual, expected] of fieldsToCheck) {
    if (actual !== expected) {
      return { status: 'error', message: `AUDIENCE_MISMATCH: svc-okr audience ${field} mismatch (expected=${expected}, actual=${actual})` };
    }
  }

  // Check arrays (sorted comparison)
  const sort = (arr: string[]) => [...arr].sort();
  if (JSON.stringify(sort(existing.acceptedPrincipalTypes)) !== JSON.stringify(sort(FROZEN_SVC_OKR_AUDIENCE.acceptedPrincipalTypes))) {
    return { status: 'error', message: `AUDIENCE_MISMATCH: svc-okr audience accepted_principal_types mismatch` };
  }
  if (JSON.stringify(sort(existing.registeredScopes)) !== JSON.stringify(sort(FROZEN_SVC_OKR_AUDIENCE.registeredScopes))) {
    return { status: 'error', message: `AUDIENCE_MISMATCH: svc-okr audience registered_scopes mismatch` };
  }

  return { status: 'noop', audience: FIXED_AUDIENCE };
}

function runGrantMigration(state: DbState): GrantResult {
  // 1. Validate fixed principal exists
  const principal = state.principals.find(p => p.id === FIXED_PRINCIPAL_ID);
  if (!principal) {
    return { status: 'error', message: 'FIXED_PRINCIPAL_NOT_FOUND' };
  }

  // 2. Look up client
  const client = state.clients.find(c => c.clientId === FIXED_CLIENT_ID);
  if (!client) {
    return { status: 'error', message: 'CEO_CLIENT_NOT_FOUND' };
  }

  // 3. Verify principal match
  if (client.principalId !== FIXED_PRINCIPAL_ID) {
    return { status: 'error', message: `WRONG_PRINCIPAL: client ${FIXED_CLIENT_ID} belongs to principal ${client.principalId}` };
  }

  // 4. Find the svc-okr grant
  const grant = state.grants.find(
    g => g.clientId === FIXED_CLIENT_ID && g.audienceId === FIXED_AUDIENCE,
  );
  if (!grant) {
    // Grant doesn't exist → create it
    state.grants.push({
      clientId: FIXED_CLIENT_ID,
      audienceId: FIXED_AUDIENCE,
      scopes: [...SCOPES_OKR_READ_WRITE],
      version: 1,
    });
    return { status: 'created', scopes: [...SCOPES_OKR_READ_WRITE], version: 1 };
  }

  // 5. Grant exists — check for exact match
  // CASE A: Already exactly [okr.read, okr.write] → no-op
  if (grant.scopes.length === 2
      && grant.scopes[0] === 'okr.read'
      && grant.scopes[1] === 'okr.write') {
    return { status: 'noop', scopes: grant.scopes, version: grant.version };
  }

  // CASE B: Unexpected state → fail closed
  return { status: 'error', message: `UNEXPECTED_GRANT_STATE: ${JSON.stringify(grant.scopes)}` };
}

function runFullMigration(state: DbState): MigrationResult {
  const audienceResult = runAudienceMigration(state);
  if (audienceResult.status === 'error') {
    return { status: 'error', message: audienceResult.message };
  }

  const grantResult = runGrantMigration(state);
  if (grantResult.status === 'error') {
    return { status: 'error', message: grantResult.message };
  }

  return { status: 'ok', audience: audienceResult, grant: grantResult };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initialState(): DbState {
  return {
    audiences: [{ ...FROZEN_SVC_WORKFLOW_AUDIENCE }],
    principals: [{ id: FIXED_PRINCIPAL_ID }],
    clients: [{ clientId: FIXED_CLIENT_ID, principalId: FIXED_PRINCIPAL_ID }],
    grants: [
      { clientId: FIXED_CLIENT_ID, audienceId: 'svc-workflow', scopes: [...SCOPES_WORKFLOW], version: 1 },
    ],
  };
}

// ===========================================================================
// Tests: Audience
// ===========================================================================

test('AUDIENCE_FIRST_APPLY_PASS: audience created when absent', () => {
  const state = initialState();
  // svc-okr not in state.audiences
  const result = runAudienceMigration(state);

  assert.equal(result.status, 'created');
  if (result.status === 'created') {
    assert.equal(result.audience, 'svc-okr');
  }

  // Verify audience was added to state
  const created = state.audiences.find(a => a.audienceId === 'svc-okr');
  assert.ok(created, 'svc-okr audience should exist in state');
  assert.deepEqual(created!.registeredScopes, SCOPES_OKR_READ_WRITE);
  assert.equal(created!.status, 'active');
});

test('AUDIENCE_SECOND_APPLY_NO_OP: second apply does nothing', () => {
  const state = initialState();
  runAudienceMigration(state); // first apply — creates
  const beforeVersion = state.audiences.find(a => a.audienceId === 'svc-okr')!.version;
  const result = runAudienceMigration(state); // second apply

  assert.equal(result.status, 'noop');
  if (result.status === 'noop') {
    assert.equal(result.audience, 'svc-okr');
  }

  // Version must not change (no-op)
  const afterVersion = state.audiences.find(a => a.audienceId === 'svc-okr')!.version;
  assert.equal(afterVersion, beforeVersion, 'version must not change on audience no-op');
});

test('AUDIENCE_UNEXPECTED_STATE_FAILS_CLOSED: wrong registered_scopes → error', () => {
  const state = initialState();
  // Pre-create svc-okr with wrong scopes
  state.audiences.push({
    ...FROZEN_SVC_OKR_AUDIENCE,
    registeredScopes: ['okr.read', 'okr.admin', 'okr.write'],
  });

  const result = runAudienceMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /AUDIENCE_MISMATCH/);
  }
});

test('AUDIENCE_UNEXPECTED_STATE_FAILS_CLOSED: wrong resource_service → error', () => {
  const state = initialState();
  state.audiences.push({ ...FROZEN_SVC_OKR_AUDIENCE, resourceService: 'wrong-svc' });

  const result = runAudienceMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /AUDIENCE_MISMATCH/);
  }
});

// ===========================================================================
// Tests: Grant
// ===========================================================================

test('GRANT_FIRST_APPLY_PASS: grant created when absent', () => {
  const state = initialState();
  // svc-okr grant doesn't exist yet (only svc-workflow exists)
  // First apply the audience phase
  runAudienceMigration(state);

  const result = runGrantMigration(state);

  assert.equal(result.status, 'created');
  if (result.status === 'created') {
    assert.deepEqual(result.scopes, SCOPES_OKR_READ_WRITE);
    assert.equal(result.version, 1);
  }

  // Verify grant was added
  const grant = state.grants.find(g => g.audienceId === 'svc-okr');
  assert.ok(grant);
  assert.deepEqual(grant!.scopes, SCOPES_OKR_READ_WRITE);
  assert.equal(grant!.version, 1);
});

test('GRANT_SECOND_APPLY_NO_OP: second apply does nothing', () => {
  const state = initialState();
  runAudienceMigration(state);
  runGrantMigration(state); // first apply — creates

  const versionBefore = state.grants.find(g => g.audienceId === 'svc-okr')!.version;
  const result = runGrantMigration(state); // second apply

  assert.equal(result.status, 'noop');
  if (result.status === 'noop') {
    assert.deepEqual(result.scopes, SCOPES_OKR_READ_WRITE);
  }

  // Version must not increment on no-op
  const versionAfter = state.grants.find(g => g.audienceId === 'svc-okr')!.version;
  assert.equal(versionAfter, versionBefore, 'version must not change on grant no-op');
});

test('GRANT_UNEXPECTED_SCOPE_FAILS_CLOSED: extra scope → error', () => {
  const state = initialState();
  runAudienceMigration(state);
  // Pre-populate grant with extra scope
  state.grants.push({
    clientId: FIXED_CLIENT_ID,
    audienceId: 'svc-okr',
    scopes: ['okr.read', 'okr.write', 'okr.admin'],
    version: 1,
  });

  const result = runGrantMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /UNEXPECTED_GRANT_STATE/);
  }
});

test('GRANT_UNEXPECTED_SCOPE_FAILS_CLOSED: reversed order → error', () => {
  const state = initialState();
  runAudienceMigration(state);
  state.grants.push({
    clientId: FIXED_CLIENT_ID,
    audienceId: 'svc-okr',
    scopes: ['okr.write', 'okr.read'],
    version: 1,
  });

  const result = runGrantMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /UNEXPECTED_GRANT_STATE/);
  }
});

test('GRANT_UNEXPECTED_SCOPE_FAILS_CLOSED: duplicate scope → error', () => {
  const state = initialState();
  runAudienceMigration(state);
  state.grants.push({
    clientId: FIXED_CLIENT_ID,
    audienceId: 'svc-okr',
    scopes: ['okr.read', 'okr.read'],
    version: 1,
  });

  const result = runGrantMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /UNEXPECTED_GRANT_STATE/);
  }
});

// ===========================================================================
// Tests: Boundary checks
// ===========================================================================

test('WRONG_CLIENT_FAILS_CLOSED: client not found → error', () => {
  const state = initialState();
  runAudienceMigration(state);
  state.clients = []; // remove all clients

  const result = runGrantMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /CEO_CLIENT_NOT_FOUND/);
  }
});

test('WRONG_PRINCIPAL_FAILS_CLOSED: client belongs to wrong principal → error', () => {
  const state = initialState();
  runAudienceMigration(state);
  state.clients[0].principalId = '00000000-0000-0000-0000-000000000000';

  const result = runGrantMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /WRONG_PRINCIPAL/);
  }
});

test('SVC_WORKFLOW_GRANT_PRESERVED: existing workflow grant remains unchanged', () => {
  const state = initialState();
  runFullMigration(state);

  const workflowGrant = state.grants.find(g => g.audienceId === 'svc-workflow');
  assert.ok(workflowGrant, 'svc-workflow grant should still exist');
  assert.deepEqual(workflowGrant!.scopes, SCOPES_WORKFLOW);
  assert.equal(workflowGrant!.version, 1, 'svc-workflow grant version must not change');
});

test('OTHER_CLIENTS_UNCHANGED: other client grants not modified', () => {
  const state = initialState();
  // Add another client
  state.clients.push({ clientId: 'other-client', principalId: FIXED_PRINCIPAL_ID });
  state.grants.push({
    clientId: 'other-client',
    audienceId: 'svc-workflow',
    scopes: ['workflow.read'],
    version: 1,
  });

  runFullMigration(state);

  const otherGrant = state.grants.find(g => g.clientId === 'other-client');
  assert.ok(otherGrant);
  assert.deepEqual(otherGrant!.scopes, ['workflow.read']);
  assert.equal(otherGrant!.version, 1, 'other client grant must not change');
});

test('OTHER_AUDIENCES_UNCHANGED: other audience grants for same client not modified', () => {
  const state = initialState();
  // Add another audience grant for the CEO client (e.g., adc-v2)
  state.audiences.push({
    audienceId: 'adc-v2',
    resourceService: 'adc-v2',
    scopeNamespace: 'adc',
    acceptedPrincipalTypes: ['agent'],
    registeredScopes: ['adc.execute', 'adc.read'],
    humanAccessEnabled: false,
    machineAccessEnabled: true,
    delegatedAccessEnabled: false,
    status: 'active',
    freezeReady: true,
    version: 1,
  });
  state.grants.push({
    clientId: FIXED_CLIENT_ID,
    audienceId: 'adc-v2',
    scopes: ['adc.execute'],
    version: 1,
  });

  runFullMigration(state);

  const adcGrant = state.grants.find(g => g.audienceId === 'adc-v2');
  assert.ok(adcGrant);
  assert.deepEqual(adcGrant!.scopes, ['adc.execute']);
  assert.equal(adcGrant!.version, 1, 'adc-v2 grant must not change');
});

test('FULL_MIGRATION_END_TO_END: complete migration succeeds', () => {
  const state = initialState();

  const result = runFullMigration(state);
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.audience.status, 'created');
    assert.equal(result.grant.status, 'created');
  }

  // Verify final state
  const svcOkrAudience = state.audiences.find(a => a.audienceId === 'svc-okr');
  assert.ok(svcOkrAudience, 'svc-okr audience should exist');
  assert.deepEqual(svcOkrAudience!.registeredScopes, SCOPES_OKR_READ_WRITE);

  const svcOkrGrant = state.grants.find(g => g.audienceId === 'svc-okr');
  assert.ok(svcOkrGrant, 'svc-okr grant should exist');
  assert.deepEqual(svcOkrGrant!.scopes, SCOPES_OKR_READ_WRITE);
  assert.equal(svcOkrGrant!.version, 1);

  // svc-workflow still intact
  const workflowGrant = state.grants.find(g => g.audienceId === 'svc-workflow');
  assert.ok(workflowGrant);
  assert.deepEqual(workflowGrant!.scopes, SCOPES_WORKFLOW);
  assert.equal(workflowGrant!.version, 1);
});
