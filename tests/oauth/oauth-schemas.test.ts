/**
 * Tests for OAuth schemas and scope validation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenRequestSchema,
  createPrincipalSchema,
  createClientSchema,
  parseScopeString,
  validateRequestedScope,
} from '../../src/schemas/oauth.js';

describe('tokenRequestSchema', () => {
  it('accepts valid token request', () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: 'client_credentials',
      scope: 'forum.read forum.write',
      resource: 'svc-forum',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.grant_type, 'client_credentials');
      assert.equal(result.data.resource, 'svc-forum');
    }
  });

  it('accepts token request without scope', () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: 'client_credentials',
      resource: 'svc-forum',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.scope, '');
    }
  });

  it('rejects wrong grant_type', () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: 'authorization_code',
      resource: 'svc-forum',
    });
    assert.equal(result.success, false);
  });

  it('rejects empty resource', () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: 'client_credentials',
      resource: '',
    });
    assert.equal(result.success, false);
  });

  it('rejects missing resource', () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: 'client_credentials',
    });
    assert.equal(result.success, false);
  });
});

describe('createPrincipalSchema', () => {
  it('accepts valid principal creation', () => {
    const result = createPrincipalSchema.safeParse({
      agentId: 'test-agent',
      ownerUserId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(result.success, true);
  });

  it('rejects invalid agentId', () => {
    const result = createPrincipalSchema.safeParse({
      agentId: '-invalid',
      ownerUserId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(result.success, false);
  });

  it('rejects non-uuid owner', () => {
    const result = createPrincipalSchema.safeParse({
      agentId: 'test-agent',
      ownerUserId: 'not-a-uuid',
    });
    assert.equal(result.success, false);
  });

  it('accepts agentId with digits/underscores (OpenClaw compatible)', () => {
    const result = createPrincipalSchema.safeParse({
      agentId: '3d-print-agent',
      ownerUserId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(result.success, true);
  });
});

describe('createClientSchema', () => {
  it('accepts valid client creation', () => {
    const result = createClientSchema.safeParse({
      agentId: 'test-agent',
      resources: ['svc-forum', 'svc-okr'],
      scopes: ['forum.read', 'forum.write'],
    });
    assert.equal(result.success, true);
  });

  it('rejects empty resources', () => {
    const result = createClientSchema.safeParse({
      agentId: 'test-agent',
      resources: [],
      scopes: ['forum.read'],
    });
    assert.equal(result.success, false);
  });

  it('rejects empty scopes', () => {
    const result = createClientSchema.safeParse({
      agentId: 'test-agent',
      resources: ['svc-forum'],
      scopes: [],
    });
    assert.equal(result.success, false);
  });
});

describe('parseScopeString', () => {
  it('parses space-delimited string', () => {
    assert.deepEqual(parseScopeString('forum.read forum.write'), [
      'forum.read',
      'forum.write',
    ]);
  });

  it('returns sorted unique values', () => {
    assert.deepEqual(parseScopeString('b a c a'), ['a', 'b', 'c']);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parseScopeString(''), []);
    assert.deepEqual(parseScopeString('  '), []);
  });
});

describe('validateRequestedScope', () => {
  it('accepts subset of allowed scopes', () => {
    assert.equal(
      validateRequestedScope('forum.read', ['forum.read', 'forum.write']),
      'forum.read',
    );
  });

  it('rejects scope not in allowlist', () => {
    assert.throws(
      () => validateRequestedScope('admin.write', ['forum.read']),
      /not authorized/,
    );
  });

  it('rejects when any requested scope is not allowed', () => {
    assert.throws(
      () => validateRequestedScope('forum.read admin.write', ['forum.read']),
      /not authorized/,
    );
  });

  it('returns sorted scope string', () => {
    assert.equal(
      validateRequestedScope('b.forum a.forum', ['a.forum', 'b.forum']),
      'a.forum b.forum',
    );
  });
});
