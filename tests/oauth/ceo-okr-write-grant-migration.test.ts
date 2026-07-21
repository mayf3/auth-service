/**
 * CEO okr.write Grant Migration — Idempotency and Failure-Closed Tests
 *
 * Tests the migration logic for adding okr.write to the CEO Client's svc-okr grant.
 * Since this is a PL/pgSQL migration that requires PostgreSQL, these tests validate
 * the decision logic through a synthetic TypeScript simulation of the same rules.
 *
 * The actual migration (prisma/migrations/20260722000100_ceo_client_okr_write_grant/)
 * uses the same logic via PL/pgSQL DO blocks.
 *
 * Coverage:
 *   FIRST_APPLY_PASS                — okr.read → okr.read+okr.write
 *   SECOND_APPLY_NO_OP              — second apply does nothing
 *   SECOND_APPLY_VERSION_UNCHANGED  — version not incremented on no-op
 *   UNEXPECTED_SCOPE_FAILS_CLOSED   — extra/unknown scopes rejected
 *   MISSING_GRANT_FAILS_CLOSED      — no grant row → error
 *   MISSING_CLIENT_FAILS_CLOSED     — no client → error
 *   WRONG_PRINCIPAL_FAILS_CLOSED    — client belongs to wrong principal → error
 *   MISSING_PRINCIPAL_FAILS_CLOSED  — principal doesn't exist → error
 *   MISSING_AUDIENCE_FAILS_CLOSED   — audience doesn't exist → error
 *   OTHER_AUDIENCE_UNCHANGED        — other audience grants not touched
 *   OTHER_CLIENT_UNCHANGED          — other client grants not touched
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ---------------------------------------------------------------------------
// Simulated database state
// ---------------------------------------------------------------------------

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

interface Audience {
  id: string;
}

const FIXED_CLIENT_ID = 'mc_xKGDsFSfU-Vdpv8nrofFQMu3';
const FIXED_PRINCIPAL_ID = 'b6b033c4-90ba-40aa-a338-304da442cab7';
const FIXED_AUDIENCE = 'svc-okr';
const OKR_READ: string[] = ['okr.read'];
const OKR_READ_WRITE: string[] = ['okr.read', 'okr.write'];

// ---------------------------------------------------------------------------
// Simulated migration function (mirrors the PL/pgSQL DO block logic)
// ---------------------------------------------------------------------------

interface DbState {
  principals: Principal[];
  audiences: Audience[];
  clients: Client[];
  grants: Grant[];
}

type MigrationResult =
  | { status: 'updated'; newScopes: string[]; oldVersion: number; newVersion: number }
  | { status: 'noop'; scopes: string[]; version: number }
  | { status: 'error'; message: string };

function runMigration(state: DbState): MigrationResult {
  // 1. Validate fixed principal exists
  const principal = state.principals.find(p => p.id === FIXED_PRINCIPAL_ID);
  if (!principal) {
    return { status: 'error', message: 'FIXED_PRINCIPAL_NOT_FOUND' };
  }

  // 2. Validate audience exists
  const audience = state.audiences.find(a => a.id === FIXED_AUDIENCE);
  if (!audience) {
    return { status: 'error', message: 'TARGET_AUDIENCE_NOT_FOUND' };
  }

  // 3. Look up client
  const client = state.clients.find(c => c.clientId === FIXED_CLIENT_ID);
  if (!client) {
    return { status: 'error', message: 'CEO_CLIENT_NOT_FOUND' };
  }

  // 4. Verify principal match
  if (client.principalId !== FIXED_PRINCIPAL_ID) {
    return { status: 'error', message: `WRONG_PRINCIPAL: ${client.principalId}` };
  }

  // 5. Find the svc-okr grant
  const grant = state.grants.find(
    g => g.clientId === FIXED_CLIENT_ID && g.audienceId === FIXED_AUDIENCE,
  );
  if (!grant) {
    return { status: 'error', message: 'GRANT_NOT_FOUND' };
  }

  // 6. Check for scope mismatches (EXACT array comparison — order matters)
  //    PostgreSQL array comparison '=' is exact element-wise, so [okr.write, okr.read]
  //    is NOT equal to [okr.read, okr.write].

  // CASE A: Already exactly [okr.read, okr.write] → no-op
  if (grant.scopes.length === 2
      && grant.scopes[0] === 'okr.read'
      && grant.scopes[1] === 'okr.write') {
    return { status: 'noop', scopes: grant.scopes, version: grant.version };
  }

  // CASE B: Exactly [okr.read] → update
  if (grant.scopes.length === 1
      && grant.scopes[0] === 'okr.read') {
    grant.scopes = [...OKR_READ_WRITE];
    grant.version += 1;
    return { status: 'updated', newScopes: [...grant.scopes], oldVersion: grant.version - 1, newVersion: grant.version };
  }

  // CASE C: Unexpected state → fail closed
  return { status: 'error', message: `UNEXPECTED_GRANT_STATE: ${JSON.stringify(grant.scopes)}` };
}

// ---------------------------------------------------------------------------
// Helper: creates a clean initial state
// ---------------------------------------------------------------------------

function emptyState(): DbState {
  return {
    principals: [{ id: FIXED_PRINCIPAL_ID }],
    audiences: [{ id: FIXED_AUDIENCE }],
    clients: [{ clientId: FIXED_CLIENT_ID, principalId: FIXED_PRINCIPAL_ID }],
    grants: [{ clientId: FIXED_CLIENT_ID, audienceId: FIXED_AUDIENCE, scopes: [...OKR_READ], version: 1 }],
  };
}

// ===========================================================================
// Tests
// ===========================================================================

test('FIRST_APPLY_PASS: okr.read → okr.read+okr.write, version+1', () => {
  const state = emptyState();
  const result = runMigration(state);

  assert.equal(result.status, 'updated');
  if (result.status === 'updated') {
    assert.deepEqual(result.newScopes, OKR_READ_WRITE);
    assert.equal(result.oldVersion, 1);
    assert.equal(result.newVersion, 2);
  }
});

test('SECOND_APPLY_NO_OP: second apply does not change scopes', () => {
  const state = emptyState();
  runMigration(state); // first apply
  const result = runMigration(state); // second apply

  assert.equal(result.status, 'noop');
  if (result.status === 'noop') {
    assert.deepEqual(result.scopes, OKR_READ_WRITE);
  }
});

test('SECOND_APPLY_VERSION_UNCHANGED: version not incremented on no-op', () => {
  const state = emptyState();
  runMigration(state);
  const versionBefore = state.grants[0].version;
  const result = runMigration(state);
  const versionAfter = state.grants[0].version;

  assert.equal(result.status, 'noop');
  assert.equal(versionAfter, versionBefore, 'version must not change on no-op');
});

test('UNEXPECTED_EXISTING_SCOPE_FAILS_CLOSED: extra scope → error', () => {
  const state = emptyState();
  state.grants[0].scopes = ['okr.read', 'okr.admin']; // has unexpected scope

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /UNEXPECTED_GRANT_STATE/);
  }
});

test('UNEXPECTED_EXISTING_SCOPE_FAILS_CLOSED: reversed order → error', () => {
  const state = emptyState();
  state.grants[0].scopes = ['okr.write', 'okr.read']; // wrong order

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /UNEXPECTED_GRANT_STATE/);
  }
});

test('UNEXPECTED_EXISTING_SCOPE_FAILS_CLOSED: duplicate scope → error', () => {
  const state = emptyState();
  state.grants[0].scopes = ['okr.read', 'okr.read']; // duplicate

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /UNEXPECTED_GRANT_STATE/);
  }
});

test('MISSING_GRANT_FAILS_CLOSED: no svc-okr grant → error', () => {
  const state = emptyState();
  state.grants = []; // no grants at all

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /GRANT_NOT_FOUND/);
  }
});

test('MISSING_CLIENT_FAILS_CLOSED: client does not exist → error', () => {
  const state = emptyState();
  state.clients = []; // no clients

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /CEO_CLIENT_NOT_FOUND/);
  }
});

test('MISSING_PRINCIPAL_FAILS_CLOSED: principal does not exist → error', () => {
  const state = emptyState();
  state.principals = []; // no principals

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /FIXED_PRINCIPAL_NOT_FOUND/);
  }
});

test('MISSING_AUDIENCE_FAILS_CLOSED: audience does not exist → error', () => {
  const state = emptyState();
  state.audiences = []; // no audiences

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /TARGET_AUDIENCE_NOT_FOUND/);
  }
});

test('WRONG_PRINCIPAL_FAILS_CLOSED: client belongs to wrong principal → error', () => {
  const state = emptyState();
  state.clients[0].principalId = '00000000-0000-0000-0000-000000000000';

  const result = runMigration(state);
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.match(result.message, /WRONG_PRINCIPAL/);
  }
});

test('OTHER_AUDIENCE_UNCHANGED: other audience grants not modified', () => {
  const state = emptyState();
  // Add another grant for a different audience
  state.grants.push({
    clientId: FIXED_CLIENT_ID,
    audienceId: 'other-audience',
    scopes: ['other.read'],
    version: 1,
  });

  runMigration(state);

  const otherGrant = state.grants.find(g => g.audienceId === 'other-audience');
  assert.ok(otherGrant);
  assert.deepEqual(otherGrant!.scopes, ['other.read']);
  assert.equal(otherGrant!.version, 1, 'other audience grant version must not change');
});

test('OTHER_CLIENT_UNCHANGED: other client grants not modified', () => {
  const state = emptyState();
  // Add another client
  state.clients.push({ clientId: 'other-client', principalId: FIXED_PRINCIPAL_ID });
  state.grants.push({
    clientId: 'other-client',
    audienceId: FIXED_AUDIENCE,
    scopes: ['okr.read'],
    version: 1,
  });

  runMigration(state);

  const otherGrant = state.grants.find(g => g.clientId === 'other-client');
  assert.ok(otherGrant);
  assert.deepEqual(otherGrant!.scopes, ['okr.read']);
  assert.equal(otherGrant!.version, 1, 'other client grant must not change');
});
