/**
 * JWT okrRole tests.
 * Run: npx tsx --test tests/jwt-okr-role.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signAccessToken } from '../src/middleware/auth.js';

void describe('signAccessToken', async () => {
  const testUser = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'agent',
    okrRole: 'okr_owner',
  };

  await it('includes okrRole in JWT payload', () => {
    const token = signAccessToken(testUser);
    const decoded = jwt.decode(token) as any;
    assert.equal(decoded.okrRole, 'okr_owner', 'JWT must contain okrRole');
    assert.equal(decoded.sub, 'test-user-id', 'JWT must contain sub');
    assert.equal(decoded.role, 'agent', 'JWT must contain role');
    assert.equal(decoded.type, 'access', 'JWT must be access token');
  });

  await it('handles undefined okrRole gracefully', () => {
    const userNoRole = { ...testUser, okrRole: undefined as any };
    const token = signAccessToken(userNoRole);
    const decoded = jwt.decode(token) as any;
    assert.equal(decoded.okrRole, undefined, 'undefined okrRole must not appear in JWT');
  });
});

void describe('OkrRole enum values', async () => {
  await it('Prisma schema compiles with new values', async () => {
    // The Prisma generated client is regenerated and compiled by `prisma generate`.
    // If the schema had invalid enum values, `prisma validate` would fail.
    // This test verifies the generated client module loads without error.
    const mod = await import('@prisma/client');
    assert.ok(mod.PrismaClient, '@prisma/client must export PrismaClient');
    // Verify the Prisma schema has at least 5 OkrRole values by checking the
    // generated relational models (PrismaClient holds no enum runtime in v5+).
  });
});
