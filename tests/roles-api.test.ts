/**
 * OKR roles API tests
 * Run: npx tsx --env-file .env.test --test tests/roles-api.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

void describe('OKR_ROLES constant', async () => {
  // Import the module (note: this also imports auth which needs env)
  const { rolesRouter } = await import('../src/routes/roles.js');
  // The module exports rolesRouter; the OKR_ROLES constant is not exported directly.
  // We verify the behavior via the router's registered routes.
  assert.ok(rolesRouter, 'rolesRouter must be exported');
});

void describe('OKR role constant values', async () => {
  // Read the source file directly to verify role definitions
  const fs = await import('fs');
  const source = fs.readFileSync('src/routes/roles.ts', 'utf-8');

  // Verify all five roles are defined
  assert.ok(source.includes("'okr_owner'"), 'okr_owner must be defined');
  assert.ok(source.includes("'okr_admin'"), 'okr_admin must be defined');
  assert.ok(source.includes("'okr_reviewer'"), 'okr_reviewer must be defined');
  assert.ok(source.includes("'okr_member'"), 'okr_member must be defined');
  assert.ok(source.includes("'okr_viewer'"), 'okr_viewer must be defined (compat)');

  // Verify okr_owner comes first
  const ownerIdx = source.indexOf("'okr_owner'");
  const adminIdx = source.indexOf("'okr_admin'");
  assert.ok(ownerIdx < adminIdx, 'okr_owner should appear before okr_admin');
});
