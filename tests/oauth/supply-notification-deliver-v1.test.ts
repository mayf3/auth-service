/** Synthetic identities only; owns a fresh local PostgreSQL cluster, never an external URL. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { Prisma, PrismaClient } from '@prisma/client';
import { getV1AudienceDefinitions } from '../../src/lib/oauth/v1/contract.js';
import { AUDIENCE, MIGRATION_ID, SPEC_REVISION, SupplyRefusal, bindingSchema,
  canonical, digest, dryRun, execute, failureCategory, mandateSchema, parseArgs,
  type Binding, type Context, type Mandate, type Plan,
} from '../../scripts/supply-notification-deliver-v1.js';

const source = 'e561d9155ad7196bf8faaf5b9a16ba98d777895b';
const context: Context = { sourceGitCommit: source, host: 'isolated-authsvc', osUser: 'isolated-owner' };
const uuid = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`;
const binding: Binding = { service: 'svc-workflow-backend-v1', machinePrincipalId: uuid(1),
  machineClientId: uuid(2), clientId: 'mc_ndg_synthetic_backend', approvedBy: 'mayf3',
  instructionRef: 'https://github.com/mayf3/agent-control/issues/1343#issuecomment-1' };
const sentinel = 'NDG_SYNTHETIC_SECRET_NEVER_DISCLOSE';
const refusal = (category: string) => (e: unknown) => e instanceof SupplyRefusal && e.category === category;
function mandate(plan: Plan, action: 'apply' | 'readback' = 'apply'): Mandate {
  return mandateSchema.parse({ action, operatorId: 'mayf3',
    approvalRef: `https://github.com/mayf3/agent-control/issues/1343#issuecomment-${action === 'apply' ? 2 : 3}`,
    applyApprovalRef: 'https://github.com/mayf3/agent-control/issues/1343#issuecomment-2',
    specRevision: SPEC_REVISION, sourceGitCommit: source, operationId: plan.operationId,
    planDigest: plan.planDigest, environment: plan.environment, binding,
    validFrom: new Date(Date.now() - 60000).toISOString(), validUntil: new Date(Date.now() + 600000).toISOString(),
    maxMutationAttempts: 1 });
}
// Real transactions with one narrowly injected observation/fault. No mock persistence or fake commits.
function intercepted(db: PrismaClient, wrap: (tx: any) => any, committed?: () => void) {
  return { $transaction: async (fn: (tx: any) => Promise<unknown>, options: any) => {
    const result = await db.$transaction(tx => fn(wrap(tx)), options);
    committed?.();
    return result;
  } } as unknown as Pick<PrismaClient, '$transaction'>;
}
const delegate = (tx: any, name: string, method: string, fn: (...args: any[]) => any) => new Proxy(tx, {
  get(target, key) { return key === name ? new Proxy(target[name], {
    get(value, member) { return member === method ? fn : typeof value[member] === 'function' ? value[member].bind(value) : value[member]; },
  }) : typeof target[key] === 'function' ? target[key].bind(target) : target[key]; },
});

test('notification supply: real disposable PostgreSQL contract conformance', { timeout: 120000 }, async t => {
  assert.ok(!['DATABASE_URL', 'DIRECT_URL', 'AUTH_DATABASE_URL', 'NDG_TEST_DATABASE_URL'].some(k => k in process.env),
    'external database inputs are forbidden');
  const pg = process.env.NDG_PG_BIN ?? '/opt/homebrew/opt/postgresql@16/bin';
  const root = mkdtempSync(join(tmpdir(), 'ndg-'));
  const port = await new Promise<number>(resolvePort => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const p = (server.address() as net.AddressInfo).port; server.close(() => resolvePort(p)); });
  });
  const url = `postgresql://isolated@127.0.0.1:${port}/ndg_disposable`;
  const runnerUrl = `postgresql://ndg_runner@127.0.0.1:${port}/ndg_disposable?connection_limit=8`;
  const command = (name: string, args: string[], input?: string) => execFileSync(join(pg, name), args,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], input });
  const sql = (text: string) => command('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', text]);
  let started = false;
  let admin: PrismaClient | undefined, runner: PrismaClient | undefined;
  try {
    command('initdb', ['-D', join(root, 'pg'), '-U', 'isolated', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    try {
      command('pg_ctl', ['-D', join(root, 'pg'), '-l', join(root, 'postgres.log'), '-o',
        `-h 127.0.0.1 -p ${port} -k ${root} -c fsync=on -c log_statement=none`, '-w', 'start']);
    } catch {
      throw new Error(`owned disposable PostgreSQL startup failed: ${readFileSync(join(root, 'postgres.log'), 'utf8')}`);
    }
    started = true;
    command('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'isolated', 'ndg_disposable']);
    execFileSync(resolve('node_modules/.bin/prisma'), ['db', 'push', '--skip-generate'], {
      stdio: 'pipe', env: { PATH: process.env.PATH, DATABASE_URL: url },
    });
    const migration = readFileSync('prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql', 'utf8');
    const exact = (pattern: RegExp) => { const match = migration.match(pattern); assert.ok(match, 'canonical migration DDL exists'); return match[0]; };
    // Install exact accepted audit DDL; db push alone omits CHECKs and immutable triggers.
    sql(`DROP TABLE grant_change_audits;
      ${exact(/CREATE TABLE "grant_change_audits" \([\s\S]*?\n\);/)}
      ${exact(/CREATE UNIQUE INDEX "grant_change_audits_migration_id_client_id_change_type_key"[\s\S]*?;/)}
      ${exact(/CREATE INDEX "grant_change_audits_timestamp_idx"[^;]*;/)}
      ${exact(/CREATE FUNCTION reject_auth_audit_mutation\(\)[\s\S]*?\$\$;/)}
      ${exact(/CREATE TRIGGER "grant_change_audits_immutable"[^;]*;/)}
      ALTER TABLE machine_access_grants ADD ${exact(/CONSTRAINT "machine_access_grants_scopes_check" CHECK \(cardinality\("scopes"\) > 0\)/)};
      CREATE ROLE ndg_runner LOGIN;
      GRANT USAGE ON SCHEMA public TO ndg_runner;
      GRANT SELECT (id,principal_type,agent_id,external_ref,status,created_at,updated_at,disabled_at) ON machine_principals TO ndg_runner;
      GRANT SELECT (id,client_id,machine_principal_id,external_ref,status,created_at,updated_at,rotated_at,revoked_at) ON machine_clients TO ndg_runner;
      GRANT SELECT ON auth_audiences,human_audience_grants,delegation_grants TO ndg_runner;
      GRANT SELECT,INSERT ON machine_access_grants,grant_change_audits TO ndg_runner;`);
    admin = new PrismaClient({ datasources: { db: { url } } });
    runner = new PrismaClient({ datasources: { db: { url: runnerUrl } } });
    const a = admin, db = runner;
    const snapshot = async () => canonical(await a.$queryRawUnsafe(`SELECT table_name,
      (xpath('/row/digest/text()',query_to_xml($q$SELECT md5(coalesce(json_agg(t ORDER BY to_jsonb(t)::text)::text,'[]')) AS digest FROM $q$
        ||quote_ident(table_name)||' t',false,true,'')))[1]::text AS digest
      FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`));
    const counts = async () => [await a.machineAccessGrant.count({ where: { machineClientId: binding.machineClientId, audienceId: AUDIENCE } }),
      await a.grantChangeAudit.count()];
    const seed = async () => {
      sql('TRUNCATE machine_principals,auth_audiences,grant_change_audits CASCADE');
      await a.machinePrincipal.createMany({ data: [
        { id: uuid(1), principalType: 'service', externalRef: 'synthetic:backend' },
        { id: uuid(3), principalType: 'service', externalRef: 'synthetic:other' },
      ] });
      await a.machineClient.createMany({ data: [
        { id: uuid(2), clientId: binding.clientId, machinePrincipalId: uuid(1), secretHash: sentinel, allowedResources: ['retained'], allowedScopes: ['retained.scope'] },
        { id: uuid(4), clientId: 'mc_ndg_other', machinePrincipalId: uuid(3), secretHash: sentinel, allowedResources: [], allowedScopes: [] },
      ] });
      const audience = getV1AudienceDefinitions().find(v => v.audienceId === AUDIENCE)!;
      await a.authAudience.create({ data: { ...audience, acceptedPrincipalTypes: [...audience.acceptedPrincipalTypes],
        registeredScopes: [...audience.registeredScopes] } });
      await a.machineAccessGrant.create({ data: { machineClientId: uuid(4), audienceId: AUDIENCE, scopes: ['notification.deliver'], version: 7 } });
    };
    const apply = (plan: Plan, writer: Pick<PrismaClient, '$transaction'> = db) => execute(writer, binding, context, plan, mandate(plan), 'apply');
    const readback = (plan: Plan, reader: Pick<PrismaClient, '$transaction'> = db) => execute(reader, binding, context, plan, mandate(plan, 'readback'), 'readback');

    await t.test('ACC-NDG-001 exact service/client and registered Audience gates refuse with zero writes', async () => {
      for (const mutation of [
        () => a.machinePrincipal.update({ where: { id: uuid(1) }, data: { status: 'disabled' } }),
        () => a.machinePrincipal.update({ where: { id: uuid(1) }, data: { principalType: 'agent', agentId: 'agt_synthetic' } }),
        () => a.machineClient.update({ where: { id: uuid(2) }, data: { status: 'revoked' } }),
        () => a.machineClient.update({ where: { id: uuid(2) }, data: { machinePrincipalId: uuid(3) } }),
        () => a.machineClient.create({ data: { id: uuid(5), clientId: 'mc_ndg_ambiguous', machinePrincipalId: uuid(1), secretHash: sentinel, allowedResources: [], allowedScopes: [] } }),
      ]) {
        await seed(); await mutation(); const before = await snapshot();
        await assert.rejects(dryRun(db, binding, context), refusal('BINDING_REFUSED'));
        assert.equal(await snapshot(), before);
      }
      for (const patch of [{ machinePrincipalId: uuid(99) }, { machineClientId: uuid(99) }, { clientId: 'mc_substitute' }]) {
        await seed(); const before = await snapshot();
        await assert.rejects(dryRun(db, { ...binding, ...patch }, context), refusal('BINDING_REFUSED'));
        assert.equal(await snapshot(), before);
      }
      for (const data of [{ status: 'disabled' as const }, { registeredScopes: ['notification.other'] },
        { acceptedPrincipalTypes: ['agent'] }, { delegatedAccessEnabled: true }, { version: 2 }, { freezeReady: false }]) {
        await seed(); await a.authAudience.update({ where: { audienceId: AUDIENCE }, data });
        const before = await snapshot(); await assert.rejects(dryRun(db, binding, context), refusal('AUDIENCE_REFUSED'));
        assert.equal(await snapshot(), before);
      }
      await seed(); sql('TRUNCATE auth_audiences CASCADE');
      await assert.rejects(dryRun(db, binding, context), refusal('AUDIENCE_REFUSED'));
      await seed();
      const duplicate = intercepted(db, tx => delegate(tx, 'machinePrincipal', 'findMany', async (...args) => {
        const rows = await tx.machinePrincipal.findMany(...args); return [...rows, ...rows];
      }));
      await assert.rejects(dryRun(duplicate, binding, context), refusal('BINDING_REFUSED'));
      assert.deepEqual(await counts(), [0, 0]);
    });

    await t.test('ACC-NDG-002 default/explicit DRY_RUN are read-only canonical plans; malformed approval refuses', async () => {
      await seed();
      assert.equal(parseArgs([], '/public/binding.json').mode, 'dry-run');
      assert.equal(parseArgs(['--dry-run', '--binding', '/public/binding.json']).mode, 'dry-run');
      for (const args of [[], ['--apply'], ['--dry-run', '--apply'], ['--bogus']]) assert.throws(() => parseArgs(args, undefined));
      const before = await snapshot(), files = readdirSync(root).sort();
      const plan = await dryRun(db, binding, context, uuid(8));
      assert.equal(await snapshot(), before); assert.deepEqual(readdirSync(root).sort(), files);
      assert.equal(plan.action, 'CREATE'); assert.equal(plan.specRevision, SPEC_REVISION);
      assert.equal(plan.sourceGitCommit, source); assert.equal(plan.operationId, uuid(8));
      assert.equal(plan.environment.database, 'ndg_disposable');
      const { planDigest, ...body } = plan; assert.equal(planDigest, digest(body));
      assert.ok(!canonical(plan).includes(sentinel));
      const writes = intercepted(db, tx => delegate(tx, 'machineAccessGrant', 'findMany', async (...args) => {
        await tx.machineAccessGrant.create({ data: { machineClientId: uuid(2), audienceId: AUDIENCE, scopes: ['notification.deliver'] } });
        return tx.machineAccessGrant.findMany(...args);
      }));
      await assert.rejects(dryRun(writes, binding, context));
      for (const patch of [{ planDigest: '0'.repeat(64) }, { sourceGitCommit: '0'.repeat(40) }, { operationId: uuid(7) }]) {
        await assert.rejects(apply({ ...plan, ...patch }), refusal('MANDATE_REFUSED'));
      }
      await assert.rejects(execute(db, binding, context, plan, { ...mandate(plan), validUntil: new Date(0).toISOString() }, 'apply'), refusal('MANDATE_REFUSED'));
      await assert.rejects(execute(db, binding, context, plan, { ...mandate(plan), operatorId: 'another-actor' } as unknown as Mandate, 'apply'), refusal('INPUT_REFUSED'));
      assert.equal(await snapshot(), before);
      // Full CLI on an exact committed synthetic source, independent of any
      // untracked author evidence in the enclosing development worktree.
      const clone = join(root, 'cli-checkout');
      execFileSync('git', ['clone', '--shared', '--quiet', process.cwd(), clone], { stdio: 'pipe' });
      writeFileSync(join(clone, 'scripts/supply-notification-deliver-v1.ts'), readFileSync('scripts/supply-notification-deliver-v1.ts'));
      execFileSync('git', ['-C', clone, 'add', '-f', 'scripts/supply-notification-deliver-v1.ts'], { stdio: 'pipe' });
      execFileSync('git', ['-C', clone, '-c', 'user.name=ndg-synthetic', '-c', 'user.email=ndg@example.invalid',
        'commit', '--quiet', '--no-verify', '--allow-empty', '-m', 'isolated source fixture'], { stdio: 'pipe' });
      symlinkSync(resolve('node_modules'), join(clone, 'node_modules'));
      symlinkSync(resolve('generated'), join(clone, 'generated'));
      const bindingFile = join(root, 'public-binding.json'); writeFileSync(bindingFile, canonical(binding));
      const cloneHead = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const filesystem = () => {
        const visit = (directory: string): unknown[] => readdirSync(directory).sort().flatMap(name => {
          const path = join(directory, name), stat = lstatSync(path);
          return [[path.slice(clone.length), stat.mtimeMs, stat.size, stat.isSymbolicLink() ? readlinkSync(path)
            : stat.isDirectory() ? 'directory' : createHash('sha256').update(readFileSync(path)).digest('hex')],
          ...(stat.isDirectory() && !stat.isSymbolicLink() ? visit(path) : [])];
        });
        return canonical(visit(clone));
      };
      const cloneBefore = filesystem();
      for (const args of [[], ['--dry-run']]) {
        const child = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/supply-notification-deliver-v1.ts', ...args], {
          cwd: clone, encoding: 'utf8', env: { PATH: process.env.PATH, LC_ALL: 'C', TSX_DISABLE_CACHE: '1',
            NOTIFICATION_DELIVER_BINDING: bindingFile, DATABASE_URL: runnerUrl },
        });
        assert.equal(child.status, 0, 'committed synthetic CLI DRY_RUN succeeds'); assert.equal(child.stderr, '');
        const cliPlan = JSON.parse(child.stdout); assert.equal(cliPlan.sourceGitCommit, cloneHead);
        assert.equal(cliPlan.action, 'CREATE'); assert.equal(cliPlan.binding.clientId, binding.clientId);
        const { planDigest: cliDigest, ...cliBody } = cliPlan; assert.equal(cliDigest, digest(cliBody));
        assert.ok(!child.stdout.includes(sentinel)); assert.equal(await snapshot(), before); assert.equal(filesystem(), cloneBefore);
      }
    });

    await t.test('ACC-NDG-003 CREATE and same-transaction SQL-NULL audit; exact NOOP retains every byte', async () => {
      await seed();
      const clients = canonical(await a.machineClient.findMany()), principals = canonical(await a.machinePrincipal.findMany());
      const audiences = canonical(await a.authAudience.findMany());
      const other = canonical(await a.machineAccessGrant.findMany({ where: { machineClientId: uuid(4) } }));
      const plan = await dryRun(db, binding, context);
      assert.equal((await apply(plan)).result, 'CREATED'); assert.deepEqual(await counts(), [1, 1]);
      const audit = await a.grantChangeAudit.findFirstOrThrow();
      assert.equal(audit.migrationId, MIGRATION_ID); assert.equal(audit.sourceGitCommit, source);
      assert.equal(audit.operatorId, 'mayf3'); assert.equal(audit.expectedGrantVersion, null);
      assert.equal(audit.beforeValue, null); assert.equal(audit.resultingGrantVersion, 1);
      assert.equal(audit.reason, `notification-deliver:v1:${plan.operationId}:${plan.planDigest}`);
      assert.equal(audit.clientId, binding.clientId); assert.equal(audit.changeType, 'create');
      const raw = await a.$queryRawUnsafe<any[]>('SELECT before_value IS NULL AS before_null,expected_grant_version IS NULL AS expected_null FROM grant_change_audits');
      assert.deepEqual(raw, [{ before_null: true, expected_null: true }]);
      assert.equal(Object.keys(audit).length, 13); assert.match(audit.id, /^[0-9a-f-]{36}$/);
      assert.equal(canonical(await a.machineClient.findMany()), clients); assert.equal(canonical(await a.machinePrincipal.findMany()), principals);
      assert.equal(canonical(await a.authAudience.findMany()), audiences);
      assert.equal(canonical(await a.machineAccessGrant.findMany({ where: { machineClientId: uuid(4) } })), other);
      const before = await snapshot(); assert.equal((await apply(plan)).result, 'NOOP');
      const noop = await dryRun(db, binding, context); assert.equal(noop.action, 'NOOP');
      assert.equal((await apply(noop)).result, 'NOOP'); assert.equal(await snapshot(), before);
      await assert.rejects(dryRun(db, binding, { ...context, sourceGitCommit: 'd'.repeat(40) }), refusal('AUDIT_CONFLICT'));
      const replacementApproval = 'https://github.com/mayf3/agent-control/issues/1343#issuecomment-999';
      await assert.rejects(execute(db, binding, context, plan, { ...mandate(plan),
        approvalRef: replacementApproval, applyApprovalRef: replacementApproval }, 'apply'), refusal('AUDIT_CONFLICT'));
      assert.equal(await snapshot(), before);
      const exactGrant = await a.machineAccessGrant.findUniqueOrThrow({ where: { machineClientId_audienceId: {
        machineClientId: uuid(2), audienceId: AUDIENCE } } });
      await seed();
      await a.machineAccessGrant.create({ data: exactGrant });
      await a.grantChangeAudit.create({ data: { ...audit, beforeValue: Prisma.JsonNull,
        afterValue: audit.afterValue as Prisma.InputJsonValue } });
      const jsonNullBefore = await snapshot();
      await assert.rejects(dryRun(db, binding, context), refusal('AUDIT_CONFLICT'));
      assert.equal(await snapshot(), jsonNullBefore, 'JSON null cannot masquerade as governed SQL NULL');
      await assert.rejects(a.machineAccessGrant.update({ where: { machineClientId_audienceId: { machineClientId: uuid(2), audienceId: AUDIENCE } }, data: { scopes: [] } }));
      await a.machineAccessGrant.update({ where: { machineClientId_audienceId: { machineClientId: uuid(2), audienceId: AUDIENCE } }, data: { scopes: ['notification.deliver', 'notification.extra'] } });
      await assert.rejects(dryRun(db, binding, context), refusal('GRANT_CONFLICT'));
      const emptyDrift = intercepted(db, tx => delegate(tx, 'machineAccessGrant', 'findMany', async (...args) =>
        (await tx.machineAccessGrant.findMany(...args)).map((r: any) => ({ ...r, scopes: [] }))));
      await assert.rejects(dryRun(emptyDrift, binding, context), refusal('GRANT_CONFLICT'));
      await assert.rejects(a.$executeRawUnsafe('UPDATE grant_change_audits SET reason=reason'));
    });

    await t.test('ACC-NDG-004 real audit-insert failure and changed plan/CAS preimage roll back all state', async () => {
      await seed(); const plan = await dryRun(db, binding, context), before = await snapshot();
      sql(`CREATE FUNCTION ndg_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '${sentinel}'; END; $$;
        CREATE TRIGGER ndg_fail_audit BEFORE INSERT ON grant_change_audits FOR EACH ROW EXECUTE FUNCTION ndg_fail_audit();`);
      let failure = '';
      try { await apply(plan); assert.fail('must abort'); } catch (e) { failure = String(e); assert.equal(failureCategory(e), 'OUTCOME_UNKNOWN'); }
      assert.ok(!failure.includes(sentinel)); assert.equal(await snapshot(), before);
      sql('DROP TRIGGER ndg_fail_audit ON grant_change_audits; DROP FUNCTION ndg_fail_audit()');
      await a.machineClient.update({ where: { id: uuid(4) }, data: { externalRef: 'synthetic:changed' } });
      const drift = await snapshot(); await assert.rejects(apply(plan), refusal('PLAN_CONFLICT')); assert.equal(await snapshot(), drift);
      await seed(); const absent = await dryRun(db, binding, context);
      await a.machineAccessGrant.create({ data: { machineClientId: uuid(2), audienceId: AUDIENCE, scopes: ['notification.deliver'] } });
      const inserted = await snapshot(); await assert.rejects(apply(absent), refusal('AUDIT_CONFLICT')); assert.equal(await snapshot(), inserted);
      await seed(); const racedPlan = await dryRun(db, binding, context); let injected = false;
      const raced = intercepted(db, tx => delegate(tx, 'machineAccessGrant', 'create', async (...args) => {
        injected = true;
        await a.machineAccessGrant.create({ data: { machineClientId: uuid(2), audienceId: AUDIENCE, scopes: ['notification.deliver'] } });
        return tx.machineAccessGrant.create(...args);
      }));
      await assert.rejects(apply(racedPlan, raced), refusal('OUTCOME_UNKNOWN'));
      assert.equal(injected, true); assert.deepEqual(await counts(), [1, 0]);
    });

    await t.test('ACC-NDG-005 concurrent authorized attempts make one Grant/audit; loser only fresh-read confirms', async () => {
      await seed(); const plan = await dryRun(db, binding, context);
      let release!: () => void, reached!: () => void;
      const paused = new Promise<void>(r => release = r), ready = new Promise<void>(r => reached = r);
      const slow = intercepted(db, tx => delegate(tx, 'machineAccessGrant', 'create', async (...args) => {
        reached(); await paused; return tx.machineAccessGrant.create(...args);
      }));
      const winner = apply(plan, slow); await ready;
      await assert.rejects(apply(plan), refusal('CONCURRENT_READBACK_REQUIRED'));
      release(); assert.equal((await winner).result, 'CREATED');
      assert.equal((await readback(plan)).result, 'VERIFIED'); assert.deepEqual(await counts(), [1, 1]);
      const before = await snapshot(); assert.equal((await apply(plan)).result, 'NOOP'); assert.equal(await snapshot(), before);
    });

    await t.test('ACC-NDG-006 unknown commit stops once; separate matching/missing/mismatched readback', async () => {
      await seed(); const plan = await dryRun(db, binding, context); let calls = 0;
      const lostReply = intercepted(db, tx => tx, () => { calls++; throw new Error(`connection lost ${sentinel}`); });
      await assert.rejects(apply(plan, lostReply), refusal('OUTCOME_UNKNOWN')); assert.equal(calls, 1);
      assert.deepEqual(await counts(), [1, 1]); const before = await snapshot();
      assert.equal((await readback(plan)).result, 'VERIFIED'); assert.equal(await snapshot(), before);
      const altered = { ...plan, operationId: uuid(99) }; const { planDigest: _, ...body } = altered;
      altered.planDigest = digest(body);
      await assert.rejects(readback(altered), refusal('READBACK_UNKNOWN'));
      for (const mutation of [
        () => a.machinePrincipal.update({ where: { id: uuid(1) }, data: { status: 'disabled' } }),
        () => a.machineClient.update({ where: { id: uuid(2) }, data: { status: 'revoked' } }),
        () => a.machineClient.update({ where: { id: uuid(2) }, data: { machinePrincipalId: uuid(3) } }),
      ]) {
        await seed(); const current = await dryRun(db, binding, context); await apply(current); await mutation();
        const changed = await snapshot(); await assert.rejects(readback(current), refusal('BINDING_REFUSED')); assert.equal(await snapshot(), changed);
      }
      await seed(); const missing = await dryRun(db, binding, context);
      await assert.rejects(readback(missing), refusal('READBACK_UNKNOWN')); assert.deepEqual(await counts(), [0, 0]);
    });

    await t.test('ACC-NDG-007 least-privilege writer cannot read secrets/legacy or UPDATE/DELETE; closed errors', async () => {
      await seed();
      for (const column of ['secret_hash', 'allowed_resources', 'allowed_scopes']) {
        await assert.rejects(db.$queryRawUnsafe(`SELECT ${column} FROM machine_clients`));
      }
      for (const statement of ['UPDATE machine_clients SET status=status', 'DELETE FROM machine_access_grants',
        'UPDATE machine_access_grants SET version=version', 'UPDATE grant_change_audits SET reason=reason',
        'DELETE FROM grant_change_audits']) await assert.rejects(db.$executeRawUnsafe(statement));
      const plan = await dryRun(db, binding, context); await apply(plan);
      const evidence = canonical([plan, await a.grantChangeAudit.findMany(), failureCategory(new Error(sentinel))]);
      assert.ok(!evidence.includes(sentinel)); assert.equal(failureCategory(new Error(sentinel)), 'OUTCOME_UNKNOWN');
      assert.equal(bindingSchema.safeParse({ ...binding, secret: sentinel }).success, false);
      const vehicle = readFileSync('scripts/supply-notification-deliver-v1.ts', 'utf8');
      assert.ok(!/\.(?:machineAccessGrant|grantChangeAudit|machinePrincipal|machineClient|authAudience)\s*\.\s*(?:update|updateMany|delete|deleteMany|upsert)\s*\(/.test(vehicle));
      assert.match(vehicle, /--no-optional-locks/);
      assert.ok(!/dotenv|fetch\s*\(|secretHash\s*:|allowedResources\s*:|allowedScopes\s*:/.test(vehicle.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')));
      // A transient ignored copy has changed bytes. Both CLI modes must
      // refuse it before opening a database or reading the binding file.
      const changedVehicle = `scripts/.ndg-drift-${port}.ts`;
      writeFileSync(changedVehicle, `${vehicle}\n// isolated source-byte mismatch\n`);
      const index = execFileSync('git', ['--no-optional-locks', 'rev-parse', '--git-path', 'index'], { encoding: 'utf8' }).trim();
      const before = statSync(index).mtimeMs;
      try {
        for (const args of [[], ['--dry-run']]) {
          const child = spawnSync(process.execPath, ['--import', 'tsx', changedVehicle, ...args], {
            encoding: 'utf8', env: { PATH: process.env.PATH, LC_ALL: 'C', NOTIFICATION_DELIVER_BINDING: '/nonexistent/public-binding.json' },
          });
          assert.equal(child.status, 1); assert.equal(child.stdout, '');
          assert.match(child.stderr, /^SOURCE_REFUSED; STOP;/); assert.ok(!child.stderr.includes(sentinel));
        }
      } finally { rmSync(changedVehicle); }
      assert.equal(statSync(index).mtimeMs, before);
    });
  } finally {
    await runner?.$disconnect(); await admin?.$disconnect();
    if (started) command('pg_ctl', ['-D', join(root, 'pg'), '-m', 'immediate', '-w', 'stop']);
    rmSync(root, { recursive: true, force: true });
  }
});
