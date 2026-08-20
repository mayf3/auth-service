import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

/*
 * AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1 — DB-AC1..DB-AC8.
 *
 * Executes the repository's real migration chain against a throwaway
 * PostgreSQL cluster created by `initdb` in a temp directory: unix-socket
 * only (`listen_addresses=` empty, no TCP listener), `trust` auth (no
 * password exists), random port/socket dir. The cluster is created and
 * destroyed entirely by this file — no production database is ever
 * contacted and no DATABASE_URL is read.
 *
 * Baseline note: the committed migration chain does not create the "users"
 * table or the "OkrRole" enum (both predate the migration history), so the
 * harness creates the minimal baseline objects the chain expects before
 * applying the real migrations in order.
 *
 * Run: tsx --test tests/oauth/ownerless-agent-principal-migration.test.ts
 */

const OWNERLESS_MIGRATION = '20260820000100_allow_ownerless_agent_principal';
const BASELINE_MIGRATIONS = [
  '20260602000200_add_service_registrations',
  '20260701000001_add_okr_owner_reviewer_roles',
  '20260704000001_add_okr_viewer_to_enum',
  '20260714000001_add_machine_principal_client',
  '20260718000100_minimal_auth_v1_additive',
  '20260721000100_add_external_ref_idempotent',
  '20260721000300_add_request_digest',
];
// 20260722000100_ceo_client_okr_write_grant is applied after the CEO seed
// interlude below: it binds the svc-okr grant to a fixed principal/client
// pair that the authoritative production database already had before that
// migration ran, so the harness materializes the same rows first.
const FINAL_BASELINE_MIGRATION = '20260722000100_ceo_client_okr_write_grant';
const CEO_PRINCIPAL_ID = 'b6b033c4-90ba-40aa-a338-304da442cab7';
const CEO_CLIENT_ID = 'mc_HLxfspbjzHEdXmiiX3Gk7D27';
const CEO_OWNER_USER_ID = '10000000-0000-4000-8000-00000000cea0';

interface PgHandle {
  readonly coordinates: string;
  run(sql: string): string;
  runFile(file: string): void;
  tryRun(sql: string): { ok: boolean; output: string };
}

function createThrowawayCluster(): { pg: PgHandle; destroy: () => void } {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ownerless-migration-test-'));
  const socketDir = path.join(workDir, 'socket');
  const dataDir = path.join(workDir, 'data');
  const logFile = path.join(workDir, 'postgres.log');
  fs.mkdirSync(socketDir);
  const port = 49152 + Math.floor(Math.random() * 10000);
  const database = 'ownerless_migration_test';

  execFileSync('initdb', ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--no-sync'], {
    stdio: 'ignore',
  });
  execFileSync(
    'pg_ctl',
    [
      '-D', dataDir,
      '-o', `-p ${port} -k ${socketDir} -c listen_addresses=`,
      '-l', logFile,
      'start',
    ],
    { stdio: 'ignore' },
  );

  const baseArgs = (db: string) => [
    '-h', socketDir, '-p', String(port), '-U', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-tA', '-d', db,
  ];
  const sql = (statement: string): string =>
    execFileSync('psql', [...baseArgs(database), '-c', statement], { encoding: 'utf8' });
  const file = (script: string): void => {
    execFileSync('psql', [...baseArgs(database), '-f', script], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  };

  execFileSync('psql', [...baseArgs('postgres'), '-c', `CREATE DATABASE "${database}"`], {
    encoding: 'utf8',
  });

  const pg: PgHandle = {
    coordinates: `unix socket ${socketDir} port ${port} database ${database} (throwaway cluster, trust auth on a private socket)`,
    run: sql,
    runFile: file,
    tryRun(statement: string) {
      try {
        return { ok: true, output: sql(statement) };
      } catch (error) {
        const err = error as { stderr?: string; message?: string };
        return { ok: false, output: String(err.stderr ?? err.message ?? error) };
      }
    },
  };
  const destroy = () => {
    try {
      execFileSync('pg_ctl', ['-D', dataDir, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    } catch {
      // cluster already down — nothing to preserve, the whole directory is removed below
    }
    fs.rmSync(workDir, { recursive: true, force: true });
  };
  return { pg, destroy };
}

function insertPrincipal(
  id: string,
  principalType: 'agent' | 'service',
  agentId: string | null,
  ownerUserId: string | null,
): string {
  const literal = (value: string | null) => (value === null ? 'NULL' : `'${value}'`);
  return 'INSERT INTO "machine_principals"'
    + ' ("id","principal_type","agent_id","owner_user_id","display_name","status","updated_at")'
    + ` VALUES ('${id}','${principalType}',${literal(agentId)},${literal(ownerUserId)},`
    + `'ownerless-migration-test','active',now());`;
}

const CONSTRAINT_QUERY = `SELECT c.conname || ' => ' || pg_get_constraintdef(c.oid)
  FROM pg_constraint c WHERE c.conrelid = 'machine_principals'::regclass ORDER BY c.conname;`;
const ROWS_QUERY = `SELECT coalesce(json_agg(row_to_json(m) ORDER BY m.id), '[]'::json)
  FROM "machine_principals" m;`;

test('ownerless principal migration DB-AC1..DB-AC8 on a real temporary PostgreSQL', async (t) => {
  const { pg, destroy } = createThrowawayCluster();
  try {
    // Minimal pre-migration-history baseline the committed chain expects.
    pg.run('CREATE TYPE "OkrRole" AS ENUM (\'okr_admin\', \'okr_reviewer\', \'okr_member\', \'okr_owner\');');
    pg.run('CREATE TABLE "users" ("id" UUID NOT NULL, CONSTRAINT "users_pkey" PRIMARY KEY ("id"));');
    for (const migration of BASELINE_MIGRATIONS) {
      pg.runFile(path.resolve(process.cwd(), 'prisma', 'migrations', migration, 'migration.sql'));
    }
    // CEO seed interlude (authoritative production shape targeted by the
    // final baseline migration): the fixed principal and its client existed
    // in production before 20260722000100 ran.
    pg.run(`INSERT INTO "users" ("id","updated_at") VALUES ('${CEO_OWNER_USER_ID}', now());`);
    pg.run(
      `INSERT INTO "machine_principals" ("id","principal_type","agent_id","owner_user_id","display_name","status","updated_at")`
        + ` VALUES ('${CEO_PRINCIPAL_ID}','agent','ceo_client_okr_agent','${CEO_OWNER_USER_ID}','CEO okr client principal','active',now());`,
    );
    pg.run(
      `INSERT INTO "machine_clients" ("id","client_id","machine_principal_id","secret_hash","status","updated_at")`
        + ` VALUES (gen_random_uuid(),'${CEO_CLIENT_ID}','${CEO_PRINCIPAL_ID}','baseline-only-non-functional-hash','active',now());`,
    );
    // Authoritative production state also carried the svc-workflow audience
    // and the CEO client's svc-workflow grant, which the final baseline
    // migration's post-verification block requires to be preserved.
    pg.run(
      `INSERT INTO "auth_audiences" ("audience_id","resource_service","scope_namespace","accepted_principal_types","registered_scopes","human_access_enabled","machine_access_enabled","delegated_access_enabled","status","freeze_ready","version","updated_at")`
        + ` VALUES ('svc-workflow','svc-workflow','workflow',ARRAY['agent'],ARRAY['workflow.read','workflow.execute'],false,true,true,'active',true,1,now());`,
    );
    pg.run(
      `INSERT INTO "machine_access_grants" ("machine_client_id","audience_id","scopes","version","updated_at")`
        + ` SELECT mc.id,'svc-workflow',ARRAY['workflow.read','workflow.execute'],1,now()`
        + ` FROM "machine_clients" mc WHERE mc."client_id" = '${CEO_CLIENT_ID}';`,
    );
    pg.runFile(path.resolve(process.cwd(), 'prisma', 'migrations', FINAL_BASELINE_MIGRATION, 'migration.sql'));
    const ownerlessMigrationPath = path.resolve(
      process.cwd(), 'prisma', 'migrations', OWNERLESS_MIGRATION, 'migration.sql',
    );

    const seed = {
      userId: '10000000-0000-4000-8000-00000000db00',
      ownerfulAgentId: '20000000-0000-4000-8000-00000000db01',
      servicePrincipalId: '20000000-0000-4000-8000-00000000db02',
    };
    pg.run(`INSERT INTO "users" ("id","updated_at") VALUES ('${seed.userId}', now());`);
    pg.run(insertPrincipal(seed.ownerfulAgentId, 'agent', 'agt_dbac_seed_ownerful', seed.userId));
    pg.run(insertPrincipal(seed.servicePrincipalId, 'service', null, null));

    const constraintsBefore = pg.run(CONSTRAINT_QUERY);
    const rowsBefore = pg.run(ROWS_QUERY);
    const usersBefore = pg.run('SELECT count(*)::text FROM "users";');

    await t.test('DB-AC1: ownerless agent insert is rejected by the old CHECK before the migration', () => {
      const result = pg.tryRun(
        insertPrincipal('21000000-0000-4000-8000-00000000ac01', 'agent', 'agt_dbac1_ownerless', null),
      );
      assert.equal(result.ok, false, 'ownerless agent insert must fail before the migration');
      assert.match(result.output, /machine_principal_type_shape_check/);
    });

    await t.test('apply the ownerless migration on the real database', () => {
      pg.runFile(ownerlessMigrationPath);
    });

    await t.test('DB-AC2: ownerless agent insert succeeds after the migration', () => {
      pg.run(insertPrincipal('21000000-0000-4000-8000-00000000ac02', 'agent', 'agt_dbac2_ownerless', null));
      const persisted = pg.run(
        `SELECT ("owner_user_id" IS NULL AND "agent_id" = 'agt_dbac2_ownerless')::text
           FROM "machine_principals" WHERE "id" = '21000000-0000-4000-8000-00000000ac02';`,
      );
      assert.equal(persisted.trim(), 'true');
    });

    await t.test('DB-AC3: ownerful agent insert still succeeds after the migration', () => {
      pg.run(insertPrincipal('21000000-0000-4000-8000-00000000ac03', 'agent', 'agt_dbac3_ownerful', seed.userId));
      const persisted = pg.run(
        `SELECT ("owner_user_id" = '${seed.userId}' AND "agent_id" = 'agt_dbac3_ownerful')::text
           FROM "machine_principals" WHERE "id" = '21000000-0000-4000-8000-00000000ac03';`,
      );
      assert.equal(persisted.trim(), 'true');
    });

    await t.test('DB-AC4: agent without agent_id is still rejected after the migration', () => {
      for (const ownerUserId of [null, seed.userId]) {
        const result = pg.tryRun(
          insertPrincipal('21000000-0000-4000-8000-00000000ac04', 'agent', null, ownerUserId),
        );
        assert.equal(result.ok, false, `agent missing agent_id (owner=${ownerUserId ?? 'null'}) must fail`);
        assert.match(result.output, /machine_principal_type_shape_check/);
      }
    });

    await t.test('DB-AC5: service carrying agent_id is still rejected after the migration', () => {
      const result = pg.tryRun(
        insertPrincipal('21000000-0000-4000-8000-00000000ac05', 'service', 'agt_dbac5_service', null),
      );
      assert.equal(result.ok, false, 'service carrying agent_id must fail');
      assert.match(result.output, /machine_principal_type_shape_check/);
    });

    await t.test('DB-AC6: existing principal rows are row-equivalent, no backfill, no User creation', () => {
      const rowsAfterSeedAndMigration = pg.run(
        `SELECT coalesce(json_agg(row_to_json(m) ORDER BY m.id), '[]'::json) FROM "machine_principals" m
           WHERE "id" IN ('${seed.ownerfulAgentId}', '${seed.servicePrincipalId}');`,
      );
      const rowsBeforeSameSet = JSON.parse(rowsBefore)
        .filter((row: { id: string }) => row.id === seed.ownerfulAgentId || row.id === seed.servicePrincipalId);
      assert.deepEqual(JSON.parse(rowsAfterSeedAndMigration), rowsBeforeSameSet);
      assert.equal(pg.run('SELECT count(*)::text FROM "users";').trim(), usersBefore.trim());
      assert.doesNotMatch(
        fs.readFileSync(ownerlessMigrationPath, 'utf8'),
        /\b(INSERT|UPDATE|DELETE)\b/i,
        'migration itself contains no data rewrite',
      );
    });

    await t.test('DB-AC7: constraint name stays exactly machine_principal_type_shape_check', () => {
      const checkRows = pg.run(
        `SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'machine_principals'::regclass AND contype = 'c'
             AND conname = 'machine_principal_type_shape_check';`,
      );
      assert.equal(checkRows.trim(), '1', 'exactly one check constraint with the frozen name');
      const definition = pg.run(
        `SELECT pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid = 'machine_principals'::regclass AND conname = 'machine_principal_type_shape_check';`,
      );
      // pg_get_constraintdef prints the normalized form (lowercase identifiers,
      // (principal_type)::text = 'agent'::text), not the migration's literal text.
      assert.match(definition, /\(principal_type\)::text = 'agent'::text\)/);
      assert.match(definition, /AND \(agent_id IS NOT NULL\)/);
      assert.match(definition, /\(principal_type\)::text = 'service'::text\)/);
      assert.match(definition, /AND \(agent_id IS NULL\)/);
      assert.doesNotMatch(definition, /owner_user_id/);
      const constraintsAfter = pg.run(CONSTRAINT_QUERY);
      const names = (snapshot: string) => snapshot.trim().split('\n').map((line) => line.split(' => ')[0]);
      assert.deepEqual(names(constraintsAfter), names(constraintsBefore), 'no constraint added or removed');
    });

    await t.test('DB-AC8: re-applying the migration cannot stack a second constraint', () => {
      const definitionBefore = pg.run(
        `SELECT pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid = 'machine_principals'::regclass AND conname = 'machine_principal_type_shape_check';`,
      );
      pg.runFile(ownerlessMigrationPath);
      const count = pg.run(
        `SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'machine_principals'::regclass AND conname = 'machine_principal_type_shape_check';`,
      );
      assert.equal(count.trim(), '1', 'no silent second constraint with the same name');
      const definitionAfter = pg.run(
        `SELECT pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid = 'machine_principals'::regclass AND conname = 'machine_principal_type_shape_check';`,
      );
      assert.equal(definitionAfter, definitionBefore, 'constraint definition is unchanged by re-application');
      // In production, re-application is additionally rejected by the Prisma
      // migration ledger (_prisma_migrations), which never re-runs an applied
      // migration; this raw re-run proves the SQL itself cannot stack duplicates.
    });
  } finally {
    destroy();
  }
});

test('throwaway cluster coordinates are reported without any password material', () => {
  // The harness uses trust auth on a private unix socket; there is no password
  // to leak. This test exists so the report can cite DB coordinates explicitly.
  const { pg, destroy } = createThrowawayCluster();
  try {
    assert.match(pg.coordinates, /unix socket/);
    assert.doesNotMatch(pg.coordinates, /password|PASS|pwd/i);
    assert.equal(pg.run('SELECT 1;').trim(), '1');
  } finally {
    destroy();
  }
});
