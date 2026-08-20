import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const schemaFile = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
const migrationFile = path.resolve(
  process.cwd(),
  'prisma',
  'migrations',
  '20260718000100_minimal_auth_v1_additive',
  'migration.sql',
);
const schema = fs.readFileSync(schemaFile, 'utf8');
const migration = fs.readFileSync(migrationFile, 'utf8');
const ownerlessMigration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260820000100_allow_ownerless_agent_principal',
    'migration.sql',
  ),
  'utf8',
);
const legacyExchange = fs.readFileSync(
  path.resolve(process.cwd(), 'src', 'lib', 'oauth', 'token-exchange.ts'),
  'utf8',
);
const legacyExchangeTest = fs.readFileSync(
  path.resolve(process.cwd(), 'tests', 'oauth', 'workflow-obo-token-exchange.test.ts'),
  'utf8',
);

// Physical line count = newline count, plus one only when the file does not
// end with a newline. `split('\n').length` over-counts by one for any file
// with a trailing newline because the final empty element is not a line.
function physicalLineCount(text: string): number {
  if (text.length === 0) return 0;
  const newlines = text.match(/\n/g)?.length ?? 0;
  return newlines + (text.endsWith('\n') ? 0 : 1);
}

test('V1 Prisma and migration files stay within the repository line limit', () => {
  assert.ok(physicalLineCount(schema) <= 500, 'prisma/schema.prisma exceeds 500 lines');
  assert.ok(physicalLineCount(migration) <= 500, 'V1 migration exceeds 500 lines');
  assert.ok(physicalLineCount(legacyExchange) <= 500, 'Legacy OBO module exceeds 500 lines');
  assert.ok(physicalLineCount(legacyExchangeTest) <= 500, 'Legacy OBO test exceeds 500 lines');
});

test('ownerless principal migration only replaces the profile shape check in one transaction', () => {
  assert.ok(
    physicalLineCount(ownerlessMigration) <= 500,
    'ownerless principal migration exceeds 500 lines',
  );
  assert.match(ownerlessMigration, /^BEGIN;/);
  assert.match(ownerlessMigration, /COMMIT;\s*$/);
  assert.equal(
    (ownerlessMigration.match(/DROP CONSTRAINT "machine_principal_type_shape_check"/g) ?? []).length,
    1,
    'exactly one drop of the named constraint',
  );
  assert.equal(
    (ownerlessMigration.match(/ADD CONSTRAINT "machine_principal_type_shape_check" CHECK \(/g) ?? []).length,
    1,
    'exactly one re-add of the same-named constraint',
  );
  assert.match(ownerlessMigration, /"principal_type"::text = 'agent'[\s\S]*?"agent_id" IS NOT NULL/);
  assert.match(ownerlessMigration, /"principal_type"::text = 'service'[\s\S]*?"agent_id" IS NULL/);
  assert.doesNotMatch(
    ownerlessMigration,
    /owner_user_id/,
    'the new constraint must not constrain owner_user_id',
  );
  assert.doesNotMatch(
    ownerlessMigration,
    /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER\s+COLUMN|ALTER\s+TYPE|CREATE\s+TABLE|CREATE\s+INDEX|DROP\s+TABLE|DROP\s+COLUMN)\b/i,
    'no data rewrite and no schema change beyond the constraint swap',
  );
});

test('V1 migration is additive and preserves Legacy authority carriers', () => {
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN)\b/i);
  assert.doesNotMatch(migration, /\b(TRUNCATE|DELETE\s+FROM)\b/i);
  assert.match(migration, /ALTER TYPE "PrincipalType" ADD VALUE IF NOT EXISTS 'service'/);
  assert.match(migration, /ALTER COLUMN "agent_id" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "owner_user_id" DROP NOT NULL/);
});

test('V1 authority and Human lifecycle tables are all explicit', () => {
  for (const table of [
    'auth_audiences',
    'human_clients',
    'human_audience_grants',
    'machine_access_grants',
    'trusted_proxies',
    'proxy_accepted_subject_audiences',
    'delegation_grants',
    'authorization_transactions',
    'authorization_codes',
    'human_sessions',
    'refresh_families',
    'refresh_credentials',
    'token_exchange_audits',
    'auth_security_audits',
    'grant_change_audits',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`), table);
  }
});

test('database constraints preserve profile, replay, and immutable-audit invariants', () => {
  assert.match(migration, /machine_principal_type_shape_check/);
  assert.match(migration, /human_clients_auth_method_check/);
  assert.match(migration, /refresh_credentials_one_active_per_family/);
  assert.match(migration, /token_exchange_audits_result_shape_check/);
  assert.match(migration, /token_exchange_audits_text_check/);
  assert.match(migration, /"original_principal_id" IS NULL AND "original_client_id" IS NULL/);
  assert.match(migration, /"source_git_commit" TEXT NOT NULL/);
  assert.match(migration, /"approval_ref" TEXT NOT NULL/);
  assert.match(migration, /grant_change_audits_required_text_check/);
  assert.match(migration, /grant_change_audits_value_shape_check/);
  assert.equal((migration.match(/EXECUTE FUNCTION reject_auth_audit_mutation\(\)/g) ?? []).length, 3);
});
