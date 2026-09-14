/** Synthetic fixtures only. Every run owns and destroys a new private PostgreSQL cluster. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import { PrismaClient } from '@prisma/client';
const migration = 'prisma/migrations/202609140001_canonical_identity_foundation/migration.sql';
const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const enroll = (n: number, state = 'canonical') => `INSERT INTO agent_identity_lifecycle(principal_id,state,revision,evidence_ref) VALUES ('${id(n)}','${state}',1,'isolated-fixture')`;
const edge = (s: number, t: number) => `INSERT INTO agent_identity_successors(source_principal_id,target_principal_id,evidence_ref) VALUES ('${id(s)}','${id(t)}','isolated-fixture')`;
const latch = () => {
  let release!: () => void;
  const promise = new Promise<void>(r => release = r);
  return { promise, release };
};
test('real disposable Pg: empty install, graph integrity, rollback and MVCC races', { timeout: 90000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'auth-cif-isolated-'));
  const port = await new Promise<number>(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const p = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(p));
    });
  });
  const url = `postgresql://isolated@127.0.0.1:${port}/postgres?connection_limit=8`;
  let started = false;
  let db: PrismaClient | undefined;
  try {
    execFileSync('initdb', ['-D', join(root, 'data'), '-U', 'isolated', '-A', 'trust', '--no-locale'], { stdio: 'pipe' });
    execFileSync('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1 -k ${root}`, '-w', 'start'], { stdio: 'pipe' });
    started = true;
    const sql = (s: string) => execFileSync('psql', [url.split('?')[0], '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-c', s], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    sql(`CREATE TYPE "PrincipalType" AS ENUM ('agent','service'); CREATE TYPE "PrincipalStatus" AS ENUM ('active','disabled');
CREATE TABLE machine_principals(id uuid PRIMARY KEY, principal_type "PrincipalType" NOT NULL DEFAULT 'agent',agent_id text UNIQUE,status "PrincipalStatus" NOT NULL DEFAULT 'active',updated_at timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE isolated_clients(id int PRIMARY KEY, principal_id uuid REFERENCES machine_principals(id));
INSERT INTO machine_principals(id,agent_id) SELECT ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'agt_isolated-'||n FROM generate_series(1,40) n;
INSERT INTO isolated_clients VALUES(1,'${id(1)}'),(2,'${id(1)}');`);
    const before = sql('SELECT row_to_json(p)::text FROM machine_principals p ORDER BY id; SELECT * FROM isolated_clients ORDER BY id');
    sql(`CREATE SCHEMA isolated_empty; SET search_path TO isolated_empty,public; CREATE TABLE machine_principals (LIKE public.machine_principals INCLUDING ALL); ${readFileSync(migration, 'utf8')} DROP SCHEMA isolated_empty CASCADE;`);
    sql(readFileSync(migration, 'utf8'));
    assert.equal(sql('SELECT row_to_json(p)::text FROM machine_principals p ORDER BY id; SELECT * FROM isolated_clients ORDER BY id'), before);
    db = new PrismaClient({ datasources: { db: { url } } });
    const client = db;
    const query = (s: string) => client.$queryRawUnsafe<any[]>(s);
    const tx = (s: string) => client.$transaction(async (x) => {
      await x.$executeRawUnsafe(s);
    }, { isolationLevel: 'Serializable' });
    const bad = async (s: string, isolation: any = 'Serializable') => {
      await assert.rejects(client.$transaction(async (x) => {
        await x.$executeRawUnsafe(s);
        await x.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      }, { isolationLevel: isolation }), e => {
        const code = (e as any).meta?.code ?? (e as any).code;
        assert.ok(['23514', '40001', 'P2034'].includes(code), `SQLSTATE=${code}`);
        return true;
      });
    };
    await t.test('empty bootstrap and weaker isolation rejected', async () => {
      assert.equal((await query('SELECT count(*)::int n FROM agent_identity_lifecycle'))[0].n, 0);
      await bad(enroll(1), 'ReadCommitted');
      await bad(enroll(1), 'RepeatableRead');
    });
    await t.test('canonical shapes, state/evidence/revision, append preservation and graph', async () => {
      await client.$executeRawUnsafe(`UPDATE machine_principals SET agent_id='bad' WHERE id='${id(2)}'`);
      await bad(enroll(2));
      await client.$executeRawUnsafe(`UPDATE machine_principals SET principal_type='service' WHERE id='${id(3)}'`);
      await bad(enroll(3, 'legacy'));
      await client.$executeRawUnsafe(`UPDATE machine_principals SET status='disabled' WHERE id='${id(4)}'`);
      await bad(enroll(4));
      const principalBefore = await query(`SELECT row_to_json(p)::text snapshot FROM machine_principals p WHERE id='${id(1)}'`);
      await tx(enroll(1));
      assert.deepEqual(await query(`SELECT row_to_json(p)::text snapshot FROM machine_principals p WHERE id='${id(1)}'`), principalBefore);
      await tx(enroll(5, 'legacy'));
      await tx(enroll(6, 'retired'));
      await tx(edge(5, 1));
      await tx(edge(6, 1));
      await bad(edge(1, 1));
      await bad(edge(1, 5));
      await bad(edge(7, 1));
      await tx(enroll(16, 'legacy'));
      await bad(edge(16, 5)); // chain 16 -> 5 -> 1
      await assert.rejects(client.$transaction(async (x) => {
        await x.$executeRawUnsafe(edge(17, 18));
        await x.$executeRawUnsafe(edge(18, 17));
      }, { isolationLevel: 'Serializable' })); // cycle cannot commit
      await tx(enroll(19, 'unresolved'));
      await tx(`UPDATE agent_identity_lifecycle SET state='canonical',revision=2,evidence_ref='isolated-amendment' WHERE principal_id='${id(19)}'`);
      await bad(`UPDATE agent_identity_lifecycle SET state='legacy',revision=2 WHERE principal_id='${id(1)}'`);
      await bad(`UPDATE agent_identity_successors SET evidence_ref='edited' WHERE source_principal_id='${id(5)}'`);
      await bad(`UPDATE agent_identity_successors SET target_principal_id='${id(8)}' WHERE source_principal_id='${id(5)}'`);
      await bad(`UPDATE agent_identity_lifecycle SET state='legacy',revision=2 WHERE principal_id='${id(6)}'`);
      await bad(`UPDATE agent_identity_lifecycle SET evidence_ref='edited' WHERE principal_id='${id(5)}'`);
      await bad(`UPDATE agent_identity_lifecycle SET state='retired' WHERE principal_id='${id(5)}'`);
      await bad('DELETE FROM agent_identity_successors');
      await bad('DELETE FROM agent_identity_lifecycle');
      await bad(`UPDATE machine_principals SET status='disabled' WHERE id='${id(1)}'`, 'ReadCommitted');
      await assert.rejects(client.$executeRawUnsafe(`DELETE FROM machine_principals WHERE id='${id(1)}'`));
      await assert.rejects(client.$transaction(async (x) => {
        await x.$executeRawUnsafe(enroll(9));
        await x.$executeRawUnsafe(edge(9, 1));
      }, { isolationLevel: 'Serializable' }));
      assert.equal((await query(`SELECT count(*)::int n FROM agent_identity_lifecycle WHERE principal_id='${id(9)}'`))[0].n, 0);
    });
    // Explicit application barriers freeze snapshots; lock-wait barrier observes actual PostgreSQL blocking.
    async function race(n: number, first: string, second: string, firstWrites: boolean, isolation: 'RepeatableRead' | 'ReadCommitted' = 'RepeatableRead') {
      const ready = latch(), release = latch();
      const a = client.$transaction(async (x) => {
        await x.$queryRawUnsafe(`SELECT id FROM machine_principals WHERE id='${id(n)}'`);
        if (firstWrites)
          await x.$executeRawUnsafe(first);
        ready.release();
        await release.promise;
        if (!firstWrites)
          await x.$executeRawUnsafe(first);
      }, { isolationLevel: firstWrites ? 'Serializable' : isolation, timeout: 10000 });
      await ready.promise;
      const b = tx(second);
      if (firstWrites) {
        const deadline = Date.now() + 5000;
        let blocked = false;
        while (Date.now() < deadline) {
          const waits = await query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND datname=current_database()");
          if (waits[0].n > 0) {
            blocked = true;
            break;
          }
          await new Promise(r => setImmediate(r));
        }
        assert.ok(blocked, 'real concurrent lock-wait barrier');
        release.release();
      }
      else {
        await b;
        release.release();
      }
      const outcomes = await Promise.allSettled([a, b]);
      const failures = outcomes.filter(o => o.status === 'rejected') as PromiseRejectedResult[];
      assert.ok(failures.length >= 1, 'one conflicting transaction aborts');
      for (const f of failures) {
        const code = f.reason.meta?.code ?? f.reason.code;
        assert.ok(['40001', '40P01', 'P2034'].includes(code), `SQLSTATE=${code}`);
        t.diagnostic(`isolated race ${n}: SQLSTATE=${code}`);
      }
    }
    await t.test('RR frozen before enrollment; enrollment commits first', async () => {
      await race(10, `UPDATE machine_principals SET status='disabled' WHERE id='${id(10)}'`, enroll(10), false);
    });
    await t.test('Principal demotion writes first; enrollment cannot use stale snapshot', async () => {
      await race(11, `UPDATE machine_principals SET status='disabled' WHERE id='${id(11)}'`, enroll(11), true);
    });
    await tx(enroll(12));
    await tx(enroll(13, 'legacy'));
    await t.test('RR target demotion frozen; direct edge commits first', async () => {
      await race(12, `UPDATE machine_principals SET status='disabled' WHERE id='${id(12)}'`, edge(13, 12), false);
    });
    await tx(enroll(14));
    await tx(enroll(15, 'legacy'));
    // Lifecycle demotion has its own SERIALIZABLE fence; it can commit before the competing edge.
    await t.test('lifecycle target demotion first; edge creation aborts', async () => {
      await race(14, `UPDATE agent_identity_lifecycle SET state='legacy',revision=2 WHERE principal_id='${id(14)}'`, edge(15, 14), true);
    });
    await t.test('final graph remains valid and real read boundary succeeds', async () => {
      assert.equal((await query(`SELECT count(*)::int n FROM agent_identity_lifecycle l JOIN machine_principals p ON p.id=l.principal_id WHERE l.state='canonical' AND (p.status<>'active' OR p.principal_type<>'agent' OR p.agent_id !~ '^agt_[a-z0-9-]+$')`))[0].n, 0);
      assert.equal((await query(`SELECT count(*)::int n FROM agent_identity_successors e JOIN agent_identity_lifecycle l ON l.principal_id=e.target_principal_id WHERE l.state<>'canonical'`))[0].n, 0);
      const m = await import('../../src/lib/oauth/v1/canonical-identity.js');
      const result = await m.resolveCanonicalByPrincipal(id(1), client as any);
      assert.equal(result.agentId, 'agt_isolated-1');
      assert.equal((await m.resolveSuccessorForMigration({ sourcePrincipalId: id(5) }, client as any)).resolvedViaLegacy, true);
      const report = await (await import('../../scripts/check-canonical-identity-conformance.js')).checkCanonicalIdentityConformance(client);
      assert.equal(report.scope, 'AUTH_FOUNDATION');
      assert.equal(report.localInvariantResult, 'PASS');
      assert.equal(report.STRICT_WRITE_DEPLOYED, false);
      assert.equal(report.GLOBAL_CENSUS_COMPLETE, false);
      t.diagnostic(JSON.stringify(report));
      const cliReport = JSON.parse(execFileSync('node_modules/.bin/tsx', ['scripts/check-canonical-identity-conformance.ts'], {
        encoding: 'utf8', env: { PATH: process.env.PATH, DATABASE_URL: url }
      }));
      assert.equal(cliReport.localInvariantResult, 'PASS');
      const defaultRead = execFileSync('node_modules/.bin/tsx', ['--input-type=module', '-e', `
        import { resolveCanonicalByPrincipal } from './src/lib/oauth/v1/canonical-identity.ts';
        import { prisma } from './src/lib/prisma.ts';
        try { console.log(JSON.stringify(await resolveCanonicalByPrincipal('${id(1)}'))); }
        finally { await prisma.$disconnect(); }
      `], { encoding: 'utf8', env: { PATH: process.env.PATH, DATABASE_URL: url } });
      assert.equal(JSON.parse(defaultRead).resolvedViaLegacy, false);
    });
  }
  finally {
    await db?.$disconnect();
    if (started)
      execFileSync('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
    rmSync(root, { recursive: true, force: true });
  }
});
