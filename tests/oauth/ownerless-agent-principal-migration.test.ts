import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
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
 * contacted and no inherited DATABASE_URL is read by PostgreSQL or Prisma.
 *
 * Baseline note: the committed migration chain does not create the "users"
 * table or the "OkrRole" enum (both predate the migration history), and one
 * historical migration targets rows that also predate the committed chain.
 * The harness creates those minimum baseline objects/rows and incrementally
 * stages byte-for-byte migration copies in a temporary Prisma workspace so
 * every committed migration is applied by `prisma migrate deploy`. The
 * ownerless migration itself is likewise applied only by deploy, so
 * DB-AC8 is proved by the real `_prisma_migrations` ledger rather than by
 * directly executing the ownerless SQL a second time.
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
const FINAL_BASELINE_MIGRATION = '20260722000100_ceo_client_okr_write_grant';
const CEO_PRINCIPAL_ID = 'b6b033c4-90ba-40aa-a338-304da442cab7';
const CEO_CLIENT_ID = 'mc_HLxfspbjzHEdXmiiX3Gk7D27';
const CEO_OWNER_USER_ID = '10000000-0000-4000-8000-00000000cea0';
const TEMP_PREFIX = 'ownerless-migration-test-';

const FAULT_POINTS = [
  'INITDB_FAILURE',
  'PG_CTL_START_FAILURE',
  'CREATE_DATABASE_FAILURE',
] as const;
type FaultPoint = typeof FAULT_POINTS[number];
type CommandRunner = (file: string, args: string[], options: Record<string, unknown>) => unknown;
const REAL_COMMAND_RUNNER = execFileSync as unknown as CommandRunner;

interface ResourceState {
  readonly runIdentifier: string;
  readonly workDir: string;
  readonly dataDir: string;
  readonly socketDir: string;
  workDirCreated: boolean;
  dataDirCreated: boolean;
  socketDirCreated: boolean;
  postgresStarted: boolean;
  databaseCreated: boolean;
}

interface PgHandle {
  readonly runIdentifier: string;
  readonly socketDir: string;
  readonly port: number;
  readonly database: string;
  readonly coordinates: string;
  run(sql: string): string;
  runFile(file: string): void;
  tryRun(sql: string): { ok: boolean; output: string };
  prisma(args: string[]): string;
  stageMigration(migration: string): void;
  stagePrehistoryBaseline(): void;
}

interface CreateOptions {
  execFile?: CommandRunner;
  onState?: (state: Readonly<ResourceState>) => void;
}

function controlledEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C', ...extra };
  delete env.DATABASE_URL;
  if (extra.DATABASE_URL !== undefined) env.DATABASE_URL = extra.DATABASE_URL;
  return env;
}

function errorSummary(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function attachCleanupDiagnostics(error: unknown, diagnostics: string[]): void {
  if (diagnostics.length === 0 || (typeof error !== 'object' && typeof error !== 'function') || error === null) return;
  try {
    Object.defineProperty(error, 'cleanupDiagnostics', {
      configurable: true,
      enumerable: false,
      value: diagnostics.map((item) => item.replace(/postgresql:\/\/[^\s]+/gi, '[redacted-database-coordinate]')),
    });
  } catch {
    // Cleanup diagnostics are best-effort and must never replace the setup error.
  }
}

function createThrowawayCluster(options: CreateOptions = {}): { pg: PgHandle; destroy: () => void; state: Readonly<ResourceState> } {
  const runIdentifier = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const state: ResourceState = {
    runIdentifier,
    // Keep the Unix-socket pathname below PostgreSQL's platform limit. macOS
    // TMPDIR paths are too long once the socket filename is appended.
    workDir: path.join('/tmp', `${TEMP_PREFIX}${runIdentifier}`),
    dataDir: '',
    socketDir: '',
    workDirCreated: false,
    dataDirCreated: false,
    socketDirCreated: false,
    postgresStarted: false,
    databaseCreated: false,
  };
  Object.assign(state, {
    dataDir: path.join(state.workDir, 'data'),
    socketDir: path.join(state.workDir, 'socket'),
  });
  const logFile = path.join(state.workDir, 'postgres.log');
  const prismaWorkspace = path.join(state.workDir, 'prisma');
  const stagedMigrations = path.join(prismaWorkspace, 'migrations');
  const stagedSchema = path.join(prismaWorkspace, 'schema.prisma');
  const repositoryPrisma = path.resolve(process.cwd(), 'prisma');
  const port = 49152 + Math.floor(Math.random() * 10000);
  const database = `ownerless_migration_${process.pid}_${Date.now()}`;
  const env = controlledEnv();
  const runCommand = options.execFile ?? REAL_COMMAND_RUNNER;
  let cleanupComplete = false;

  const publishState = () => options.onState?.({ ...state });
  const cleanup = (): string[] => {
    if (cleanupComplete) return [];
    const diagnostics: string[] = [];
    if (state.postgresStarted && state.dataDirCreated) {
      try {
        runCommand('pg_ctl', ['-D', state.dataDir, '-m', 'immediate', '-w', '-t', '10', 'stop'], {
          env,
          stdio: 'ignore',
        });
      } catch (stopError) {
        try {
          runCommand('pg_ctl', ['-D', state.dataDir, 'status'], { env, stdio: 'ignore' });
          diagnostics.push(`postgres stop failed while server still reports running: ${errorSummary(stopError)}`);
        } catch {
          // A failed status command means the server is no longer running.
        }
      }
      state.postgresStarted = false;
    }
    if (state.socketDirCreated) {
      try {
        fs.rmSync(state.socketDir, { recursive: true, force: true });
        state.socketDirCreated = false;
      } catch (socketError) {
        diagnostics.push(`socket cleanup failed: ${errorSummary(socketError)}`);
      }
    }
    if (state.workDirCreated) {
      try {
        fs.rmSync(state.workDir, { recursive: true, force: true });
        state.workDirCreated = false;
        state.dataDirCreated = false;
        state.databaseCreated = false;
      } catch (workDirError) {
        diagnostics.push(`work directory cleanup failed: ${errorSummary(workDirError)}`);
      }
    }
    cleanupComplete = !fs.existsSync(state.workDir);
    publishState();
    return diagnostics;
  };
  const destroy = () => {
    const diagnostics = cleanup();
    if (diagnostics.length > 0) throw new Error(`throwaway PostgreSQL cleanup failed: ${diagnostics.join('; ')}`);
  };

  try {
    fs.mkdirSync(state.workDir, { mode: 0o700 });
    state.workDirCreated = true;
    fs.mkdirSync(state.dataDir, { mode: 0o700 });
    state.dataDirCreated = true;
    fs.mkdirSync(state.socketDir, { mode: 0o700 });
    state.socketDirCreated = true;
    fs.mkdirSync(stagedMigrations, { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(repositoryPrisma, 'schema.prisma'), stagedSchema);
    fs.copyFileSync(
      path.join(repositoryPrisma, 'migrations', 'migration_lock.toml'),
      path.join(stagedMigrations, 'migration_lock.toml'),
    );
    publishState();

    runCommand(
      'initdb',
      ['-D', state.dataDir, '-U', 'postgres', '-A', 'trust', '--no-sync', '--no-locale', '--encoding=UTF8'],
      { env, stdio: 'ignore' },
    );

    // Mark the start as owned before invoking pg_ctl. If pg_ctl throws after
    // launching the postmaster, construction cleanup must still attempt stop.
    state.postgresStarted = true;
    runCommand(
      'pg_ctl',
      [
        '-D', state.dataDir,
        '-o', `-p ${port} -k ${state.socketDir} -c listen_addresses=`,
        '-l', logFile,
        '-w', '-t', '10', 'start',
      ],
      { env, stdio: 'ignore' },
    );
    publishState();

    const baseArgs = (db: string) => [
      '-h', state.socketDir, '-p', String(port), '-U', 'postgres',
      '-v', 'ON_ERROR_STOP=1', '-tA', '-d', db,
    ];
    const sql = (statement: string): string => String(
      runCommand('psql', [...baseArgs(database), '-c', statement], { env, encoding: 'utf8' }),
    );
    const file = (script: string): void => {
      runCommand('psql', [...baseArgs(database), '-f', script], {
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    };

    runCommand('psql', [...baseArgs('postgres'), '-c', `CREATE DATABASE "${database}"`], {
      env,
      encoding: 'utf8',
    });
    state.databaseCreated = true;
    publishState();

    const databaseUrl = `postgresql://postgres@localhost:${port}/${database}?host=${encodeURIComponent(state.socketDir)}`;
    const prisma = (args: string[]): string => execFileSync(
      path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma'),
      [...args, '--schema', stagedSchema],
      {
        cwd: process.cwd(),
        env: controlledEnv({ DATABASE_URL: databaseUrl }),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const stageMigration = (migration: string): void => {
      fs.cpSync(
        path.join(repositoryPrisma, 'migrations', migration),
        path.join(stagedMigrations, migration),
        { recursive: true, errorOnExist: true },
      );
    };
    const stagePrehistoryBaseline = (): void => {
      const baselineDir = path.join(stagedMigrations, '00000000000000_test_pre_history_baseline');
      fs.mkdirSync(baselineDir);
      fs.writeFileSync(
        path.join(baselineDir, 'migration.sql'),
        'CREATE TYPE "OkrRole" AS ENUM (\'okr_admin\', \'okr_reviewer\', \'okr_member\', \'okr_owner\');\n'
          + 'CREATE TABLE "users" ("id" UUID NOT NULL, CONSTRAINT "users_pkey" PRIMARY KEY ("id"));\n',
        'utf8',
      );
    };
    const pg: PgHandle = {
      runIdentifier,
      socketDir: state.socketDir,
      port,
      database,
      coordinates: `socket=${state.socketDir} port=${port} database=${database} run=${runIdentifier}`,
      run: sql,
      runFile: file,
      tryRun(statement: string) {
        try {
          return { ok: true, output: sql(statement) };
        } catch (error) {
          const err = error as { stderr?: string | Buffer; message?: string };
          return { ok: false, output: String(err.stderr ?? err.message ?? error) };
        }
      },
      prisma,
      stageMigration,
      stagePrehistoryBaseline,
    };
    return { pg, destroy, state };
  } catch (error) {
    let diagnostics: string[];
    try {
      diagnostics = cleanup();
    } catch (cleanupError) {
      diagnostics = [`unexpected cleanup failure: ${errorSummary(cleanupError)}`];
    }
    attachCleanupDiagnostics(error, diagnostics);
    throw error;
  }
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
const OWNERLESS_LEDGER_QUERY = `SELECT coalesce(json_agg(row_to_json(receipt) ORDER BY receipt.started_at), '[]'::json)
  FROM (
    SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, logs, applied_steps_count
    FROM "_prisma_migrations" WHERE migration_name = '${OWNERLESS_MIGRATION}'
  ) receipt;`;

function processesContaining(fragment: string): string[] {
  const output = execFileSync('ps', ['-ax', '-o', 'command='], { env: controlledEnv(), encoding: 'utf8' });
  return output.split('\n').filter((line) => line.includes(fragment));
}

function socketsBelow(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isSocket()).map((entry) => entry.name);
}

test('ownerless principal migration DB-AC1..DB-AC8 on a real temporary PostgreSQL', async (t) => {
  const { pg, destroy, state } = createThrowawayCluster();
  t.diagnostic(`PG_COORDINATES ${pg.coordinates}`);
  try {
    pg.stagePrehistoryBaseline();
    for (const migration of BASELINE_MIGRATIONS) pg.stageMigration(migration);
    const historicalDeployOutput = pg.prisma(['migrate', 'deploy']);
    t.diagnostic(`PRISMA_HISTORICAL_CHAIN_DEPLOY=${historicalDeployOutput.trim()}`);

    pg.run(`INSERT INTO "users" ("id","updated_at") VALUES ('${CEO_OWNER_USER_ID}', now());`);
    pg.run(
      `INSERT INTO "machine_principals" ("id","principal_type","agent_id","owner_user_id","display_name","status","updated_at")`
        + ` VALUES ('${CEO_PRINCIPAL_ID}','agent','ceo_client_okr_agent','${CEO_OWNER_USER_ID}','CEO okr client principal','active',now());`,
    );
    pg.run(
      `INSERT INTO "machine_clients" ("id","client_id","machine_principal_id","secret_hash","status","updated_at")`
        + ` VALUES (gen_random_uuid(),'${CEO_CLIENT_ID}','${CEO_PRINCIPAL_ID}','baseline-only-non-functional-hash','active',now());`,
    );
    pg.run(
      `INSERT INTO "auth_audiences" ("audience_id","resource_service","scope_namespace","accepted_principal_types","registered_scopes","human_access_enabled","machine_access_enabled","delegated_access_enabled","status","freeze_ready","version","updated_at")`
        + ` VALUES ('svc-workflow','svc-workflow','workflow',ARRAY['agent'],ARRAY['workflow.read','workflow.execute'],false,true,true,'active',true,1,now());`,
    );
    pg.run(
      `INSERT INTO "machine_access_grants" ("machine_client_id","audience_id","scopes","version","updated_at")`
        + ` SELECT mc.id,'svc-workflow',ARRAY['workflow.read','workflow.execute'],1,now()`
        + ` FROM "machine_clients" mc WHERE mc."client_id" = '${CEO_CLIENT_ID}';`,
    );
    pg.stageMigration(FINAL_BASELINE_MIGRATION);
    const finalHistoricalDeployOutput = pg.prisma(['migrate', 'deploy']);
    t.diagnostic(`PRISMA_FINAL_HISTORICAL_DEPLOY=${finalHistoricalDeployOutput.trim()}`);

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
    const existingRowsBefore = JSON.parse(pg.run(ROWS_QUERY)) as Array<Record<string, unknown> & { id: string }>;
    const existingPrincipalIds = existingRowsBefore.map((row) => row.id);
    const usersBefore = pg.run('SELECT count(*)::text FROM "users";');
    assert.ok(existingPrincipalIds.includes(CEO_PRINCIPAL_ID), 'historical CEO principal is part of DB-AC6');

    await t.test('DB-AC1: ownerless agent insert is rejected by the old CHECK before the migration', () => {
      const result = pg.tryRun(
        insertPrincipal('21000000-0000-4000-8000-00000000ac01', 'agent', 'agt_dbac1_ownerless', null),
      );
      assert.equal(result.ok, false, 'ownerless agent insert must fail before the migration');
      assert.match(result.output, /machine_principal_type_shape_check/);
    });

    let firstDeployOutput = '';
    await t.test('first Prisma migrate deploy applies the ownerless migration exactly once', (st) => {
      pg.stageMigration(OWNERLESS_MIGRATION);
      firstDeployOutput = pg.prisma(['migrate', 'deploy']);
      st.diagnostic(`DB_AC8_FIRST_DEPLOY=APPLIED_ONCE\n${firstDeployOutput.trim()}`);
      assert.match(firstDeployOutput, new RegExp(`Applying migration .${OWNERLESS_MIGRATION}.`));
      const receipts = JSON.parse(pg.run(OWNERLESS_LEDGER_QUERY)) as Array<{
        migration_name: string;
        checksum: string;
        finished_at: string | null;
        rolled_back_at: string | null;
        logs: string | null;
        applied_steps_count: number;
      }>;
      st.diagnostic(`PRISMA_LEDGER_AFTER_FIRST_DEPLOY=${JSON.stringify(receipts)}`);
      assert.equal(receipts.length, 1);
      assert.equal(receipts[0].migration_name, OWNERLESS_MIGRATION);
      assert.ok(receipts[0].finished_at);
      assert.equal(receipts[0].rolled_back_at, null);
      assert.ok(receipts[0].logs === null || !/fail|error/i.test(receipts[0].logs));
      assert.equal(receipts[0].applied_steps_count, 1);
      assert.match(receipts[0].checksum, /^[a-f0-9]{64}$/);
    });

    await t.test('DB-AC6: every existing principal row is unchanged with no backfill or User creation', (st) => {
      const idList = existingPrincipalIds.map((id) => `'${id}'`).join(',');
      const existingRowsAfter = JSON.parse(pg.run(
        `SELECT coalesce(json_agg(row_to_json(m) ORDER BY m.id), '[]'::json)
           FROM "machine_principals" m WHERE m.id IN (${idList});`,
      )) as Array<Record<string, unknown> & { id: string }>;
      const totalAfter = Number(pg.run('SELECT count(*)::text FROM "machine_principals";').trim());

      assert.equal(existingRowsAfter.length, existingRowsBefore.length, 'same existing-row batch is re-read');
      assert.equal(totalAfter, existingRowsBefore.length, 'migration adds or removes no principal rows');
      assert.deepEqual(existingRowsAfter, existingRowsBefore, 'all persisted fields remain row-equivalent');
      assert.ok(existingRowsAfter.some((row) => row.id === CEO_PRINCIPAL_ID), 'CEO principal remains in comparison');
      assert.equal(pg.run('SELECT count(*)::text FROM "users";').trim(), usersBefore.trim());
      assert.doesNotMatch(
        fs.readFileSync(ownerlessMigrationPath, 'utf8'),
        /\b(INSERT|UPDATE|DELETE)\b/i,
        'migration itself contains no data rewrite',
      );
      st.diagnostic(`DB_AC6_EXISTING_ROWS=${existingRowsAfter.length} CEO_PRINCIPAL_INCLUDED=YES ALL_FIELDS_DEEP_EQUAL=YES`);
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
      assert.match(definition, /\(principal_type\)::text = 'agent'::text\)/);
      assert.match(definition, /AND \(agent_id IS NOT NULL\)/);
      assert.match(definition, /\(principal_type\)::text = 'service'::text\)/);
      assert.match(definition, /AND \(agent_id IS NULL\)/);
      assert.doesNotMatch(definition, /owner_user_id/);
      const constraintsAfter = pg.run(CONSTRAINT_QUERY);
      const names = (snapshot: string) => snapshot.trim().split('\n').map((line) => line.split(' => ')[0]);
      assert.deepEqual(names(constraintsAfter), names(constraintsBefore), 'no constraint added or removed');
    });

    await t.test('DB-AC8: second Prisma deploy recognizes the ledger receipt and performs no mutation', (st) => {
      const ledgerBefore = JSON.parse(pg.run(OWNERLESS_LEDGER_QUERY));
      const definitionBefore = pg.run(
        `SELECT oid::text || ' => ' || pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid = 'machine_principals'::regclass AND conname = 'machine_principal_type_shape_check';`,
      );
      const rowsBeforeSecondDeploy = pg.run(ROWS_QUERY);
      const secondDeployOutput = pg.prisma(['migrate', 'deploy']);
      st.diagnostic(`DB_AC8_SECOND_DEPLOY=RECOGNIZED_ALREADY_APPLIED\n${secondDeployOutput.trim()}`);
      assert.match(secondDeployOutput, /No pending migrations to apply\./);

      const ledgerAfter = JSON.parse(pg.run(OWNERLESS_LEDGER_QUERY));
      const definitionAfter = pg.run(
        `SELECT oid::text || ' => ' || pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid = 'machine_principals'::regclass AND conname = 'machine_principal_type_shape_check';`,
      );
      assert.deepEqual(ledgerAfter, ledgerBefore, 'checksum and the sole migration receipt stay unchanged');
      assert.equal(ledgerAfter.length, 1, 'PRISMA_LEDGER_ROWS_FOR_OWNERLESS_MIGRATION=1');
      assert.equal(definitionAfter, definitionBefore, 'constraint OID and definition prove no second schema mutation');
      assert.equal(pg.run(ROWS_QUERY), rowsBeforeSecondDeploy, 'second deploy does not rewrite existing rows');
      assert.equal(
        pg.run(`SELECT count(*)::text FROM "_prisma_migrations" WHERE migration_name = '${OWNERLESS_MIGRATION}';`).trim(),
        '1',
      );
      st.diagnostic(`PRISMA_LEDGER_AFTER_SECOND_DEPLOY=${JSON.stringify(ledgerAfter)}`);
      st.diagnostic('PRISMA_LEDGER_ROWS_FOR_OWNERLESS_MIGRATION=1');
      st.diagnostic('SECOND_SCHEMA_MUTATION=0');
      st.diagnostic('DIRECT_SECOND_SQL_EXECUTION_AS_DB_AC8=FORBIDDEN');
    });
  } finally {
    // Prove destroy is also safe when PostgreSQL exited before the caller's
    // cleanup path, then prove a second destroy is a no-op.
    try {
      execFileSync('pg_ctl', ['-D', state.dataDir, '-m', 'immediate', '-w', '-t', '10', 'stop'], {
        env: controlledEnv(),
        stdio: 'ignore',
      });
    } catch {
      // If a preceding assertion coincided with server exit, destroy handles it.
    }
    destroy();
    destroy();
    assert.equal(fs.existsSync(state.workDir), false);
    t.diagnostic('POSTGRES_DESTROY_SAFE_AFTER_POSTGRES_EXITED=YES');
    t.diagnostic('POSTGRES_DESTROY_IDEMPOTENT=YES');
  }
});

function faultInjectingRunner(faultAt: FaultPoint): CommandRunner {
  let injected = false;
  return (file, args, options) => {
    if (file === 'initdb' || file === 'pg_ctl' || file === 'psql') {
      const childEnv = options.env as NodeJS.ProcessEnv;
      assert.equal(childEnv.LC_ALL, 'C', `${file} LC_ALL`);
      assert.equal(childEnv.LANG, 'C', `${file} LANG`);
    }
    const isTarget = faultAt === 'INITDB_FAILURE'
      ? file === 'initdb'
      : faultAt === 'PG_CTL_START_FAILURE'
        ? file === 'pg_ctl' && args.at(-1) === 'start'
        : file === 'psql' && args.some((arg) => arg.startsWith('CREATE DATABASE '));
    if (!injected && isTarget) {
      injected = true;
      if (faultAt === 'PG_CTL_START_FAILURE') {
        // Model pg_ctl reporting failure after the postmaster partially starts.
        // Constructor cleanup must still own and stop that process.
        REAL_COMMAND_RUNNER(file, args, options);
      }
      throw new Error(`controlled command failure: ${faultAt}`);
    }
    return REAL_COMMAND_RUNNER(file, args, options);
  };
}

test('throwaway PostgreSQL construction failure cleanup is fault-injection safe', async (t) => {
  for (const faultAt of FAULT_POINTS) {
    await t.test(faultAt, (st) => {
      let observedState: Readonly<ResourceState> | undefined;
      assert.throws(
        () => createThrowawayCluster({
          execFile: faultInjectingRunner(faultAt),
          onState: (state) => { observedState = state; },
        }),
        new RegExp(faultAt),
        'the original setup command error must escape cleanup unchanged',
      );
      assert.ok(observedState, 'resource state must be observable before the injected failure');
      const snapshot = observedState as Readonly<ResourceState>;
      assert.equal(snapshot.workDirCreated, false, 'cleanup removes the work directory before rethrow');
      assert.equal(snapshot.dataDirCreated, false, 'cleanup removes the data directory before rethrow');
      assert.equal(snapshot.socketDirCreated, false, 'cleanup removes the socket directory before rethrow');
      assert.equal(snapshot.postgresStarted, false, 'cleanup stops PostgreSQL before rethrow');
      assert.equal(fs.existsSync(snapshot.workDir), false);
      assert.deepEqual(socketsBelow(snapshot.workDir), []);
      assert.deepEqual(processesContaining(snapshot.workDir), []);
      st.diagnostic(`${faultAt} LEFTOVER_POSTGRES_PROCESSES=0 LEFTOVER_TEMP_DIRECTORIES=0 LEFTOVER_SOCKET_FILES=0`);
    });
  }
  t.diagnostic('SETUP_FAILURE_CLEANUP=PASS');
  t.diagnostic('POSTGRES_CHILD_LOCALE=LC_ALL=C LANG=C');
});
