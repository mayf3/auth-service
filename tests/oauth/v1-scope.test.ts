import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCanonicalV1Scope,
  canonicalV1Scope,
  parseV1ScopeRequest,
} from '../../src/lib/oauth/v1/scope.js';

test('V1 scope request accepts arbitrary order and emits unsigned-ASCII order', () => {
  assert.deepEqual(
    parseV1ScopeRequest('workflow.read workflow.execute', 'workflow'),
    ['workflow.execute', 'workflow.read'],
  );
  assert.equal(
    canonicalV1Scope('workflow.read workflow.execute', 'workflow'),
    'workflow.execute workflow.read',
  );
});

test('V1 scope request rejects empty, duplicate, spacing, case, and namespace errors', () => {
  for (const value of [
    '',
    ' workflow.read',
    'workflow.read ',
    'workflow.read  workflow.execute',
    'workflow.read\tworkflow.execute',
    'workflow.read workflow.read',
    'Workflow.read',
    'okr.read',
    'workflow.*',
  ]) {
    assert.throws(() => parseV1ScopeRequest(value, 'workflow'), /invalid_scope/);
  }
});

test('V1 token scope validator requires already-canonical order', () => {
  assert.deepEqual(
    assertCanonicalV1Scope('workflow.execute workflow.read', 'workflow'),
    ['workflow.execute', 'workflow.read'],
  );
  assert.throws(
    () => assertCanonicalV1Scope('workflow.read workflow.execute', 'workflow'),
    /invalid_scope/,
  );
});
