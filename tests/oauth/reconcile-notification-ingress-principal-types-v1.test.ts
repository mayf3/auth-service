/** Full CLI conformance; synthetic rows and a self-owned disposable PostgreSQL cluster only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { Prisma, PrismaClient } from '@prisma/client';

const ROOT = resolve('.');
const SCRIPT = 'scripts/reconcile-notification-ingress-principal-types-v1.ts';
const AUDIENCE = 'agent-core-notification-ingress-v1';
const MIGRATION = 'notification-ingress-principal-types-reconciliation-v1';
const EVENT = 'audience.notification_ingress_principal_types_reconciled';
const SENTINEL = 'SYNTHETIC_CREDENTIAL_MUST_NEVER_APPEAR';
const uuid = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => {
  if (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)) {
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
  }
  return item;
});

test('notification principal-types reconciliation: real disposable PostgreSQL CLI conformance', { timeout: 180000 }, async t => {
  assert.ok(!['DATABASE_URL', 'DIRECT_URL', 'AUTH_DATABASE_URL', 'NIR_TEST_DATABASE_URL', 'NDG_TEST_DATABASE_URL'].some(key => key in process.env),
    'external database inputs are forbidden');
  const pg = process.env.NIR_PG_BIN ?? '/opt/homebrew/opt/postgresql@16/bin';
  const root = mkdtempSync(join(tmpdir(), 'nir-'));
  const checkout = join(root, 'checkout');
  mkdirSync(join(checkout, 'scripts'), { recursive: true });
  writeFileSync(join(checkout, SCRIPT), readFileSync(join(ROOT, SCRIPT)));
  writeFileSync(join(checkout, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(checkout, '.gitignore'), 'node_modules\n');
  symlinkSync(resolve('node_modules'), join(checkout, 'node_modules'));
  const git = (args: string[]) => execFileSync('/usr/bin/git', ['-C', checkout, ...args], {
    encoding: 'utf8', stdio: 'pipe', env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  }).trim();
  git(['init', '--quiet']); git(['add', '.']);
  git(['-c', 'user.name=synthetic-conformance', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '--no-verify', '-m', 'synthetic CLI source']);
  const source = git(['rev-parse', 'HEAD']);
  const metadata = {
    migration_id: MIGRATION, source_git_commit: source, operator_id: 'mayf3',
    approval_ref: 'https://github.com/mayf3/agent-control/issues/1343#issuecomment-1',
    reason: 'isolated synthetic principal-types reconciliation conformance',
  };
  const metadataArgs = Object.entries(metadata).flatMap(([key, value]) => [`--${key.replaceAll('_', '-')}`, value]);
  const port = await new Promise<number>(resolvePort => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const selected = (server.address() as net.AddressInfo).port;
      server.close(() => resolvePort(selected));
    });
  });
  const url = `postgresql://isolated@127.0.0.1:${port}/nir_disposable`;
  const runnerUrl = `postgresql://nir_runner@127.0.0.1:${port}/nir_disposable?connection_limit=2`;
  const command = (name: string, args: string[]) => execFileSync(join(pg, name), args, { encoding: 'utf8', stdio: 'pipe' });
  const sql = (statement: string) => command('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', statement]);
  type Result = { code: number | null; stdout: string; stderr: string };
  const invoke = (args: string[] = [], database = runnerUrl): Promise<Result> => new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', SCRIPT, ...args], {
      cwd: checkout, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, LC_ALL: 'C', TSX_DISABLE_CACHE: '1', DATABASE_URL: database },
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolveResult({ code, stdout, stderr }));
  });
  const apply = (args = metadataArgs) => invoke(['--apply', ...args]);
  const filesystem = () => {
    const visit = (directory: string): unknown[] => readdirSync(directory).sort().flatMap(name => {
      const file = join(directory, name), stat = lstatSync(file);
      return [[file.slice(checkout.length), stat.mtimeMs, stat.size, stat.isSymbolicLink() ? readlinkSync(file)
        : stat.isDirectory() ? 'directory' : createHash('sha256').update(readFileSync(file)).digest('hex')],
      ...(stat.isDirectory() && !stat.isSymbolicLink() ? visit(file) : [])];
    });
    return canonical(visit(checkout));
  };
  let started = false;
  let admin: PrismaClient | undefined;
  try {
    command('initdb', ['-D', join(root, 'pg'), '-U', 'isolated', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    command('pg_ctl', ['-D', join(root, 'pg'), '-l', join(root, 'postgres.log'), '-o',
      `-h 127.0.0.1 -p ${port} -k ${root} -c fsync=on -c log_statement=none`, '-w', 'start']);
    started = true;
    command('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'isolated', 'nir_disposable']);
    execFileSync(resolve('node_modules/.bin/prisma'), ['db', 'push', '--skip-generate'], {
      cwd: ROOT, stdio: 'pipe', env: { PATH: process.env.PATH, DATABASE_URL: url },
    });
    // Real database controls guard effects, including column/timestamp immutability.
    // Broad UPDATE/DELETE on these two tables are needed only for LOCK TABLE.
    sql(`CREATE ROLE nir_runner LOGIN;
      GRANT USAGE ON SCHEMA public TO nir_runner;
      GRANT SELECT,UPDATE,DELETE ON auth_audiences TO nir_runner;
      GRANT SELECT,INSERT,UPDATE,DELETE ON auth_security_audits TO nir_runner;
      CREATE FUNCTION nir_audience_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF current_user = 'nir_runner' AND (TG_OP <> 'UPDATE'
          OR OLD.audience_id <> '${AUDIENCE}'
          OR (to_jsonb(NEW)-'accepted_principal_types') IS DISTINCT FROM (to_jsonb(OLD)-'accepted_principal_types')) THEN
          RAISE EXCEPTION 'synthetic audience write boundary';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER nir_audience_guard BEFORE UPDATE OR DELETE ON auth_audiences
        FOR EACH ROW EXECUTE FUNCTION nir_audience_guard();
      CREATE FUNCTION nir_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF current_user = 'nir_runner' AND (TG_OP <> 'INSERT' OR NEW.event_type <> '${EVENT}') THEN
          RAISE EXCEPTION 'synthetic audit write boundary';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER nir_audit_guard BEFORE INSERT OR UPDATE OR DELETE ON auth_security_audits
        FOR EACH ROW EXECUTE FUNCTION nir_audit_guard();`);
    admin = new PrismaClient({ datasources: { db: { url } } });
    const a = admin;
    const snapshot = async (): Promise<Array<{ table_name: string; digest: string }>> => a.$queryRawUnsafe(`SELECT table_name,
      (xpath('/row/digest/text()',query_to_xml($q$SELECT md5(coalesce(json_agg(t ORDER BY to_jsonb(t)::text)::text,'[]')) AS digest FROM $q$
      ||quote_ident(table_name)||' t',false,true,'')))[1]::text AS digest
      FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
    const target = () => a.authAudience.findUniqueOrThrow({ where: { audienceId: AUDIENCE } });
    const audits = () => a.authSecurityAudit.findMany({ where: { eventType: EVENT } });
    const seed = async (patch: Partial<Prisma.AuthAudienceCreateInput> = {}) => {
      sql('DROP TRIGGER IF EXISTS nir_fail_audit ON auth_security_audits; DROP FUNCTION IF EXISTS nir_fail_audit(); TRUNCATE auth_audiences,machine_principals,auth_security_audits,grant_change_audits CASCADE');
      await a.authAudience.createMany({ data: [
        { audienceId: AUDIENCE, resourceService: AUDIENCE, scopeNamespace: 'notification',
          acceptedPrincipalTypes: ['service', 'machine'], registeredScopes: ['notification.deliver'],
          humanAccessEnabled: false, machineAccessEnabled: true, delegatedAccessEnabled: false,
          status: 'active', freezeReady: true, version: 1, ...patch },
        { audienceId: 'synthetic-sentinel', resourceService: 'synthetic-sentinel', scopeNamespace: 'sentinel',
          acceptedPrincipalTypes: ['agent', 'service'], registeredScopes: ['sentinel.write', 'sentinel.read'],
          humanAccessEnabled: true, machineAccessEnabled: true, delegatedAccessEnabled: true,
          status: 'active', freezeReady: true, version: 7 },
      ] });
      await a.machinePrincipal.create({ data: { id: uuid(1), principalType: 'service', externalRef: 'synthetic:principal', status: 'active' } });
      await a.machineClient.create({ data: { id: uuid(2), clientId: 'mc_synthetic_sentinel', machinePrincipalId: uuid(1), secretHash: SENTINEL,
        allowedResources: ['sentinel-resource'], allowedScopes: ['sentinel.scope'], status: 'active' } });
      await a.machineAccessGrant.create({ data: { machineClientId: uuid(2), audienceId: 'synthetic-sentinel', scopes: ['sentinel.read'], version: 7 } });
      await a.authSecurityAudit.createMany({ data: [
        { eventType: 'unrelated.event', result: 'success', details: { preserve: true } },
        { eventType: 'audience.registry_reconciled', result: 'success', details: { before_value: { audience_id: 'svc-forum' }, after_value: { audience_id: 'svc-forum' } } },
      ] });
    };
    const audienceSnapshot = (row: Awaited<ReturnType<typeof target>>, types = row.acceptedPrincipalTypes) => ({
      audience_id: row.audienceId, resource_service: row.resourceService, scope_namespace: row.scopeNamespace,
      accepted_principal_types: types, registered_scopes: row.registeredScopes,
      human_access_enabled: row.humanAccessEnabled, machine_access_enabled: row.machineAccessEnabled,
      delegated_access_enabled: row.delegatedAccessEnabled, status: row.status, freeze_ready: row.freezeReady,
      version: row.version, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
    });
    const expectRefusal = async (operation: () => Promise<Result> = apply) => {
      const before = await snapshot(), result = await operation();
      assert.notEqual(result.code, 0); assert.equal(result.stdout, '', 'refusal cannot emit success');
      assert.ok(result.stderr.trim().length > 0); assert.ok(!result.stderr.includes(SENTINEL));
      assert.deepEqual(await snapshot(), before, 'refusal must leave every table unchanged');
      return result;
    };

    await t.test('default, --dry-run and --plan report proposals with zero actual DB/filesystem writes', async () => {
      await seed(); const before = await snapshot(), files = filesystem();
      for (const args of [[], ['--dry-run'], ['--plan']]) {
        const result = await invoke(args); assert.equal(result.code, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.operation, 'plan'); assert.equal(report.outcome, 'reconcile');
        assert.equal(report.audience_rows_updated, 0); assert.equal(report.audits_created, 0);
        assert.equal(report.proposed_audience_rows_updated, 1); assert.equal(report.proposed_audits_created, 1);
        assert.deepEqual(await snapshot(), before); assert.equal(filesystem(), files);
      }
    });

    await t.test('drift reconciles one column plus one atomic audit; exact rerun is byte-stable NOOP', async () => {
      await seed(); const before = await target(), allBefore = await snapshot();
      const otherAudiences = await a.authAudience.findMany({ where: { audienceId: { not: AUDIENCE } }, orderBy: { audienceId: 'asc' } });
      const unrelated = await a.authSecurityAudit.findMany({ orderBy: { id: 'asc' } });
      const result = await apply(); assert.equal(result.code, 0, result.stderr);
      const report = JSON.parse(result.stdout); assert.equal(report.outcome, 'reconcile');
      assert.equal(report.audience_rows_updated, 1); assert.equal(report.audits_created, 1);
      const after = await target(); assert.deepEqual(after, { ...before, acceptedPrincipalTypes: ['service'] });
      const records = await audits(); assert.equal(records.length, 1); assert.equal(records[0].result, 'success');
      assert.deepEqual(records[0].details, { ...metadata, before_value: audienceSnapshot(before), after_value: audienceSnapshot(after) });
      assert.deepEqual(await a.authSecurityAudit.findMany({ where: { eventType: { not: EVENT } }, orderBy: { id: 'asc' } }), unrelated);
      assert.deepEqual((await snapshot()).filter(v => !['auth_audiences', 'auth_security_audits'].includes(v.table_name)),
        allBefore.filter(v => !['auth_audiences', 'auth_security_audits'].includes(v.table_name)));
      assert.deepEqual(await a.authAudience.findMany({ where: { audienceId: { not: AUDIENCE } }, orderBy: { audienceId: 'asc' } }),
        otherAudiences, 'all non-target Audience rows remain byte-equivalent, including array order');
      const converged = await snapshot();
      for (const args of [['--apply', ...metadataArgs], [], ['--plan']]) {
        const rerun = await invoke(args); assert.equal(rerun.code, 0, rerun.stderr);
        const noop = JSON.parse(rerun.stdout); assert.equal(noop.outcome, 'noop');
        assert.equal(noop.audience_rows_updated, 0); assert.equal(noop.audits_created, 0);
        assert.deepEqual(await snapshot(), converged);
      }
      assert.ok(!canonical(records).includes(SENTINEL));
    });

    await t.test('all other frozen fields and non-exact principal arrays refuse without mutation', async () => {
      const patches: Array<Partial<Prisma.AuthAudienceCreateInput>> = [
        { resourceService: 'wrong-service' }, { scopeNamespace: 'wrong' }, { registeredScopes: ['notification.other'] },
        { registeredScopes: ['notification.deliver', 'notification.extra'] }, { humanAccessEnabled: true },
        { machineAccessEnabled: false }, { delegatedAccessEnabled: true }, { status: 'disabled' },
        { freezeReady: false }, { version: 2 },
        ...[[], ['machine'], ['agent'], ['service', 'agent'], ['service', 'service'], ['machine', 'service'], ['service', 'machine', 'agent']]
          .map(acceptedPrincipalTypes => ({ acceptedPrincipalTypes })),
      ];
      for (const patch of patches) {
        await seed(patch); await expectRefusal(); await expectRefusal(() => invoke());
      }
    });

    await t.test('target without audit, duplicate/conflicting audit and metadata mismatch refuse', async () => {
      await seed({ acceptedPrincipalTypes: ['service'] }); await expectRefusal();
      for (const corruption of ['result', 'missing-field', 'extra-field', 'before', 'after', 'duplicate', 'metadata']) {
        await seed(); assert.equal((await apply()).code, 0);
        const [audit] = await audits(); const details = { ...(audit.details as Record<string, Prisma.InputJsonValue>) };
        if (corruption === 'result') await a.authSecurityAudit.update({ where: { id: audit.id }, data: { result: 'failure' } });
        if (corruption === 'missing-field') { delete details.reason; await a.authSecurityAudit.update({ where: { id: audit.id }, data: { details } }); }
        if (corruption === 'extra-field') { details.extra = true; await a.authSecurityAudit.update({ where: { id: audit.id }, data: { details } }); }
        if (corruption === 'before') { details.before_value = { ...(details.before_value as object), accepted_principal_types: ['machine', 'service'] }; await a.authSecurityAudit.update({ where: { id: audit.id }, data: { details } }); }
        if (corruption === 'after') { details.after_value = { ...(details.after_value as object), version: 2 }; await a.authSecurityAudit.update({ where: { id: audit.id }, data: { details } }); }
        if (corruption === 'duplicate') await a.authSecurityAudit.create({ data: { eventType: EVENT, result: audit.result, details: audit.details as Prisma.InputJsonValue } });
        await expectRefusal(corruption === 'metadata' ? () => apply(metadataArgs.map(v => v === metadata.reason ? 'different-reason' : v)) : apply);
      }
      await seed();
      await a.authSecurityAudit.create({ data: { eventType: EVENT, result: 'success', details: { premature: true } } });
      await expectRefusal();
    });

    await t.test('audit INSERT failure rolls the audience UPDATE back in the real transaction', async () => {
      await seed(); const before = await target();
      sql(`CREATE FUNCTION nir_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure ${SENTINEL}'; END $$;
        CREATE TRIGGER nir_fail_audit BEFORE INSERT ON auth_security_audits FOR EACH ROW WHEN (NEW.event_type='${EVENT}') EXECUTE FUNCTION nir_fail_audit();`);
      const result = await expectRefusal();
      assert.equal(result.stderr, 'Reconciliation refused: DATABASE_OR_COMMIT_OUTCOME_UNKNOWN\n');
      assert.deepEqual(await target(), before); assert.equal((await audits()).length, 0);
    });

    await t.test('concurrent exact applies converge to one audit', async () => {
      await seed(); const results = await Promise.all([apply(), apply()]);
      assert.ok(results.some(result => result.code === 0), canonical(results));
      for (const result of results) if (result.code === 0) assert.ok(['reconcile', 'noop'].includes(JSON.parse(result.stdout).outcome));
      assert.deepEqual((await target()).acceptedPrincipalTypes, ['service']); assert.equal((await audits()).length, 1);
      const before = await snapshot(); assert.equal((await apply()).code, 0); assert.deepEqual(await snapshot(), before);
    });

    await t.test('fresh concurrent conflicting audit is seen after the table-lock wait', async () => {
      await seed(); let pending: Promise<Result> | undefined;
      await a.$transaction(async tx => {
        await tx.authSecurityAudit.create({ data: { eventType: EVENT, result: 'success', details: { concurrent: true } } });
        pending = apply(); await new Promise(resolveWait => setTimeout(resolveWait, 300));
      });
      const result = await pending!; assert.notEqual(result.code, 0);
      assert.deepEqual((await target()).acceptedPrincipalTypes, ['service', 'machine']); assert.equal((await audits()).length, 1);
    });

    await t.test('missing and duplicate-corruption target rows refuse instead of selecting one', async () => {
      await seed(); await a.authAudience.delete({ where: { audienceId: AUDIENCE } }); await expectRefusal();
      await seed(); sql(`ALTER TABLE auth_audiences DROP CONSTRAINT auth_audiences_pkey CASCADE;
        INSERT INTO auth_audiences SELECT * FROM auth_audiences WHERE audience_id='${AUDIENCE}';`);
      await expectRefusal();
      sql(`TRUNCATE auth_audiences CASCADE; ALTER TABLE auth_audiences ADD CONSTRAINT auth_audiences_pkey PRIMARY KEY (audience_id);`);
    });

    await t.test('CLI rejects invalid metadata/modes, dirty checkout and mismatched HEAD before connection', async () => {
      await seed(); const invalidDb = 'postgresql://must_not_connect@127.0.0.1:1/refused';
      const badArgs: Array<[string[], string]> = [
        [['--apply'], 'ARGUMENTS_REFUSED'], [['--apply', ...metadataArgs.slice(2)], 'ARGUMENTS_REFUSED'],
        [['--bogus'], 'ARGUMENTS_REFUSED'], [['--apply', '--dry-run', ...metadataArgs], 'ARGUMENTS_REFUSED'],
        [['--plan', '--reason', 'invalid'], 'ARGUMENTS_REFUSED'], [['--apply', ...metadataArgs, '--reason', 'duplicate'], 'ARGUMENTS_REFUSED'],
        [['--apply', ...metadataArgs.map(value => value === source ? '0'.repeat(40) : value)], 'SOURCE_REFUSED'],
        [['--apply', ...metadataArgs.map(value => value === MIGRATION ? 'wrong-migration' : value)], 'METADATA_REFUSED'],
        [['--apply', ...metadataArgs.map(value => value === metadata.reason ? '' : value)], 'ARGUMENTS_REFUSED'],
      ];
      const before = await snapshot();
      for (const [args, category] of badArgs) {
        const result = await invoke(args, invalidDb); assert.notEqual(result.code, 0);
        assert.equal(result.stdout, ''); assert.equal(result.stderr, `Reconciliation refused: ${category}\n`,
          'must refuse at the named input/source gate, not at a failed connection');
      }
      writeFileSync(join(checkout, 'unexpected.txt'), 'untracked dirty checkout');
      try {
        const result = await invoke(['--apply', ...metadataArgs], invalidDb); assert.notEqual(result.code, 0);
        assert.equal(result.stdout, ''); assert.equal(result.stderr, 'Reconciliation refused: SOURCE_REFUSED\n');
      } finally { rmSync(join(checkout, 'unexpected.txt')); }
      assert.deepEqual(await snapshot(), before);
    });
  } finally {
    await admin?.$disconnect();
    if (started) command('pg_ctl', ['-D', join(root, 'pg'), '-m', 'immediate', '-w', 'stop']);
    rmSync(root, { recursive: true, force: true });
  }
});
