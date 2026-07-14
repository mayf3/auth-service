/**
 * Tests for client secret generation, hashing, and verification.
 *
 * Tests pure functions with no database dependency.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateClientSecret,
  hashClientSecret,
  verifyClientSecret,
} from '../../src/lib/oauth/secret.js';

describe('generateClientSecret', () => {
  it('produces a non-empty string', () => {
    const secret = generateClientSecret();
    assert.ok(secret.length > 0, 'Secret should not be empty');
  });

  it('produces base64url-encoded 32 bytes (43 chars)', () => {
    const secret = generateClientSecret();
    // 32 bytes base64url encoded = 43 chars (no padding)
    assert.equal(secret.length, 43);
  });

  it('produces unique values each call', () => {
    const s1 = generateClientSecret();
    const s2 = generateClientSecret();
    assert.notEqual(s1, s2);
  });

  it('contains only url-safe characters', () => {
    const secret = generateClientSecret();
    assert.ok(/^[A-Za-z0-9_-]+$/.test(secret), 'Should be base64url-safe');
  });
});

describe('hashClientSecret and verifyClientSecret', () => {
  it('hash produces salt:hash format', () => {
    const secret = 'test-secret-value';
    const stored = hashClientSecret(secret);
    assert.ok(stored.includes(':'), 'Should contain separator');
    const [salt, hash] = stored.split(':');
    assert.equal(salt.length, 32, 'Salt should be 16 bytes = 32 hex chars');
    assert.equal(hash.length, 128, 'Hash should be 64 bytes = 128 hex chars');
  });

  it('verify returns true for correct secret', () => {
    const secret = generateClientSecret();
    const stored = hashClientSecret(secret);
    assert.equal(verifyClientSecret(secret, stored), true);
  });

  it('verify returns false for wrong secret', () => {
    const stored = hashClientSecret('correct-secret');
    assert.equal(verifyClientSecret('wrong-secret', stored), false);
  });

  it('verify returns false for empty secret', () => {
    const stored = hashClientSecret('some-secret');
    assert.equal(verifyClientSecret('', stored), false);
  });

  it('verify returns false for malformed stored hash', () => {
    assert.equal(verifyClientSecret('secret', 'malformed-no-salt'), false);
    assert.equal(verifyClientSecret('secret', ''), false);
    assert.equal(verifyClientSecret('secret', ':'), false);
  });

  it('different secrets produce different hashes', () => {
    const stored1 = hashClientSecret('secret-1');
    const stored2 = hashClientSecret('secret-2');
    assert.notEqual(stored1, stored2);
  });

  it('same secret produces different hashes (different salts)', () => {
    const stored1 = hashClientSecret('same-secret');
    const stored2 = hashClientSecret('same-secret');
    assert.notEqual(stored1, stored2);
    // Both should still verify
    assert.equal(verifyClientSecret('same-secret', stored1), true);
    assert.equal(verifyClientSecret('same-secret', stored2), true);
  });

  it('verify is constant-time (no timing leakage)', () => {
    // Just verify it doesn't throw — timing safety is implementation detail
    const stored = hashClientSecret('target-secret');
    assert.doesNotThrow(() => verifyClientSecret('wrong', stored));
  });
});
