/** Synthetic fixtures only. Every run owns and destroys a private PostgreSQL cluster. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import { PrismaClient } from '@prisma/client';

const foundation = 'prisma/migrations/202609140001_canonical_identity_foundation/migration.sql';
const migration = 'prisma/migrations/202609160001_canonical_subject_enrollment/migration.sql';
const id = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const dg = (c: string) => c.repeat(64);

test('real disposable Pg: canonical subject persistence and controlled invariants', { timeout: 120000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'auth-csesb-isolated-'));
  const port = await new Promise<number>(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const value = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(value));
    });
  });
  const url = `postgresql://isolated@127.0.0.1:${port}/postgres?connection_limit=12`;
  let started = false;
  let db: PrismaClient | undefined;
  try {
    execFileSync('initdb', ['-D', join(root, 'data'), '-U', 'isolated', '-A', 'trust', '--no-locale'], { stdio: 'pipe' });
    execFileSync('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1 -k ${root}`, '-w', 'start'], { stdio: 'pipe' });
    started = true;
    const sql = (value: string) => execFileSync('psql', [url.split('?')[0], '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-c', value], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    sql(`CREATE TYPE "PrincipalType" AS ENUM ('agent','service'); CREATE TYPE "PrincipalStatus" AS ENUM ('active','disabled');
CREATE TABLE users(id uuid PRIMARY KEY,name text NOT NULL,email text NOT NULL,password text NOT NULL,role text NOT NULL,status "PrincipalStatus" NOT NULL DEFAULT 'active');
CREATE TABLE machine_principals(id uuid PRIMARY KEY,principal_type "PrincipalType" NOT NULL DEFAULT 'agent',agent_id text UNIQUE,owner_user_id uuid REFERENCES users(id),status "PrincipalStatus" NOT NULL DEFAULT 'active',updated_at timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE machine_clients(id uuid PRIMARY KEY,machine_principal_id uuid NOT NULL REFERENCES machine_principals(id),status text NOT NULL DEFAULT 'active');
CREATE TABLE machine_access_grants(machine_client_id uuid NOT NULL REFERENCES machine_clients(id),audience_id text NOT NULL,PRIMARY KEY(machine_client_id,audience_id));
INSERT INTO users VALUES('${id(900)}','isolated','isolated@example.invalid','x','admin','active'),('${id(901)}','disabled','disabled@example.invalid','x','admin','disabled');
INSERT INTO machine_principals(id,principal_type,agent_id,status) VALUES
 ('${id(1)}','agent','agt_isolated-1','active'),('${id(2)}','agent','agt_isolated-2','active'),
 ('${id(3)}','agent','agt_legacy-3','active'),('${id(4)}','service',NULL,'active'),
 ('${id(5)}','agent','agt_disabled-5','disabled'),('${id(6)}','agent','agt_isolated-6','active');`);
    sql(readFileSync(foundation, 'utf8'));
    sql(`BEGIN ISOLATION LEVEL SERIALIZABLE;
INSERT INTO agent_identity_lifecycle(principal_id,state,revision,evidence_ref) VALUES
 ('${id(1)}','canonical',1,'isolated'),('${id(2)}','canonical',1,'isolated'),('${id(3)}','legacy',1,'isolated'),('${id(5)}','legacy',1,'isolated'); COMMIT;`);
    sql(`BEGIN ISOLATION LEVEL SERIALIZABLE; INSERT INTO agent_identity_lifecycle(principal_id,state,revision,evidence_ref) VALUES('${id(6)}','canonical',1,'isolated'); COMMIT;`);
    const before = sql('SELECT count(*) FROM users; SELECT count(*) FROM machine_principals; SELECT count(*) FROM agent_identity_lifecycle;');
    sql(readFileSync(migration, 'utf8'));
    assert.equal(sql('SELECT count(*) FROM users; SELECT count(*) FROM machine_principals; SELECT count(*) FROM agent_identity_lifecycle;'), before);
    db = new PrismaClient({ datasources: { db: { url } } });
    const client = db;
    const query = (value: string) => client.$queryRawUnsafe<any[]>(value);
    const serial = (...values: string[]) => client.$transaction(async tx => {
      for (const value of values)
        await tx.$executeRawUnsafe(value);
    }, { isolationLevel: 'Serializable' });
    const rejected = async (value: string, codes = ['23514', '23503', '23505', '40001', 'P2002', 'P2003', 'P2034']) => {
      await assert.rejects(client.$transaction(async tx => {
        await tx.$executeRawUnsafe(value);
        await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      }, { isolationLevel: 'Serializable' }), error => {
        const code = (error as any).meta?.code ?? (error as any).code;
        assert.ok(codes.includes(code), `SQLSTATE=${code}`);
        return true;
      });
    };
    const attestation = (n: number, subjectType = 'agent', target = `'${id(n)}',NULL,'agt_isolated-${n}'`, authorityKind = 'owner_exact') => `INSERT INTO canonical_subject_attestations
(subject_attestation_id,business_subject_id,subject_type,business_subject_description,machine_principal_id,user_id,canonical_agent_id,authority_source,attested_by_kind,attested_by_user_id,attestation_authority_kind,attestation_authority_ref,attestation_authority_digest,attestation_authority_operation,effective_at,evidence_ref,status,revision)
VALUES('${id(1000 + n)}','${id(2000 + n)}','${subjectType}','context only',${target},'owner:packet','user','${id(900)}','${authorityKind}','owner:decision','${dg('a')}','activate',now(),'isolated','active',1)`;

    await t.test('empty install and serializable-only append-preserving surface', async () => {
      for (const table of ['canonical_subject_attestations', 'canonical_subject_source_bindings', 'canonical_subject_operations', 'canonical_subject_operation_authorities', 'identity_attestation_delegations'])
        assert.equal((await query(`SELECT count(*)::int n FROM ${table}`))[0].n, 0);
      await assert.rejects(client.$executeRawUnsafe(attestation(1)));
      await serial(attestation(1));
      await rejected(`DELETE FROM canonical_subject_attestations WHERE subject_attestation_id='${id(1001)}'`);
      await rejected(`UPDATE canonical_subject_attestations SET canonical_agent_id='agt_other' WHERE subject_attestation_id='${id(1001)}'`);
      await rejected(`UPDATE agent_identity_lifecycle SET state='legacy',revision=2,evidence_ref='invalid-demotion' WHERE principal_id='${id(1)}'`);
    });

    await t.test('typed AGENT HUMAN SERVICE target constraints fail closed', async () => {
      await rejected(attestation(2, 'human'));
      await serial(attestation(6, 'human', `NULL,'${id(900)}',NULL`));
      await serial(attestation(4, 'service', `'${id(4)}',NULL,NULL`));
      await rejected(attestation(5));
      await rejected(attestation(4, 'agent', `'${id(4)}',NULL,'agt_inferred'`));
      await rejected(attestation(7, 'service', `'${id(1)}',NULL,NULL`));
      assert.equal((await query(`SELECT count(*)::int n FROM machine_principals`))[0].n, 6);
    });

    await t.test('delegation scope is explicit, immutable, expiring and terminal', async () => {
      await serial(`INSERT INTO identity_attestation_delegations
(delegation_id,delegated_actor_type,delegated_user_id,authorized_subject_type,authorized_business_subject_ids,authorized_operations,owner_authority_ref,owner_authority_digest,effective_at,expires_at,status,revision)
VALUES('${id(3001)}','user','${id(900)}','agent',ARRAY['${id(2002)}']::uuid[],ARRAY['activate']::text[],'owner:delegation','${dg('b')}',now()-interval '1 minute',now()+interval '1 hour','active',1)`);
      await rejected(`UPDATE identity_attestation_delegations SET authorized_business_subject_ids=ARRAY['${id(2001)}','${id(2002)}']::uuid[] WHERE delegation_id='${id(3001)}'`);
      await serial(`UPDATE identity_attestation_delegations SET status='revoked',revision=2,revoked_at=now(),revocation_authority_ref='owner:revoke' WHERE delegation_id='${id(3001)}'`);
      await rejected(`UPDATE identity_attestation_delegations SET status='active',revision=3 WHERE delegation_id='${id(3001)}'`);
    });

    await t.test('source supersession is not exit and exit requires zero-live evidence fields', async () => {
      await serial(`INSERT INTO canonical_subject_source_bindings
(source_binding_id,source_namespace,source_local_value,subject_attestation_id,semantics,effective_at,evidence_ref,status,revision)
VALUES('${id(4003)}','isolated','planned-value','${id(1001)}','prospective_binding',now(),'isolated','planned',1)`);
      await serial(`UPDATE canonical_subject_source_bindings SET status='active',revision=2,updated_at=now() WHERE source_binding_id='${id(4003)}'`);
      assert.deepEqual((await query(`SELECT status::text,revision::text FROM canonical_subject_source_bindings WHERE source_binding_id='${id(4003)}'`))[0], { status: 'active', revision: '2' });
      await serial(`INSERT INTO canonical_subject_source_bindings
(source_binding_id,source_namespace,source_local_value,subject_attestation_id,semantics,effective_at,evidence_ref,status,revision)
VALUES('${id(4001)}','isolated','old-live','${id(1001)}','prospective_binding',now(),'isolated','active',1)`);
      await serial(
        `UPDATE canonical_subject_source_bindings SET status='superseded',revision=2,superseded_at=now(),supersession_evidence_ref='replacement-authority' WHERE source_binding_id='${id(4001)}'`,
        `INSERT INTO canonical_subject_source_bindings
(source_binding_id,source_namespace,source_local_value,subject_attestation_id,semantics,effective_at,evidence_ref,status,revision,supersedes_source_binding_id)
VALUES('${id(4002)}','isolated','old-live','${id(1004)}','prospective_binding',now(),'isolated','active',1,'${id(4001)}')`);
      const old = (await query(`SELECT status::text,"exited_at" as exited,"exit_evidence_ref" as evidence FROM canonical_subject_source_bindings WHERE source_binding_id='${id(4001)}'`))[0];
      assert.equal(old.status, 'superseded'); assert.equal(old.exited, null); assert.equal(old.evidence, null);
      await rejected(`UPDATE canonical_subject_source_bindings SET status='exited',revision=2 WHERE source_binding_id='${id(4002)}'`);
      await serial(`UPDATE canonical_subject_source_bindings SET status='exited',revision=2,exited_at=now(),exit_evidence_ref='source-owner:zero-live' WHERE source_binding_id='${id(4002)}'`);
      await rejected(`UPDATE canonical_subject_source_bindings SET status='active',revision=3 WHERE source_binding_id='${id(4002)}'`);
    });

    await t.test('duplicate mutation target is rejected before a real PostgreSQL write', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      const duplicateExit = (mutationKey: string) => ({ mutationKey, operation: 'EXIT_SOURCE_BINDING', sourceBindingId: id(4003), sourceNamespace: 'isolated', sourceLocalValue: 'planned-value', expectedRevision: '2', exitEvidenceRef: 'source-owner:zero-live' });
      const input = { packetVersion: '1', operationId: id(822), environment: 'isolated-test', actorRef: `user:${id(900)}`, authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }], mutations: [duplicateExit('exit-duplicate-a'), duplicateExit('exit-duplicate-b')], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z' };
      assert.throws(() => module.importCanonicalSubjectPacket(input), (error: any) => error.code === 'INVALID_PACKET');
      assert.deepEqual((await query(`SELECT status::text,revision::text FROM canonical_subject_source_bindings WHERE source_binding_id='${id(4003)}'`))[0], { status: 'active', revision: '2' });
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_operations WHERE operation_id='${id(822)}'`))[0].n, 0);
    });

    await t.test('operation audit manifest is exact, heterogeneous and immutable', async () => {
      await serial(`INSERT INTO canonical_subject_operations
(operation_id,environment,actor_ref,packet_digest,authority_digest,prestate_digest,plan_digest,core_evidence_digest,attestation_authority_manifest_digest,poststate_digest,mutation_counts)
VALUES('${id(800)}','isolated','user:${id(900)}','${dg('1')}','${dg('2')}','${dg('3')}','${dg('4')}',NULL,'${dg('5')}','${dg('6')}', '{"ACTIVATE_ATTESTATION":2}'::jsonb)`,
`INSERT INTO canonical_subject_operation_authorities
(operation_id,mutation_key,business_subject_id,subject_attestation_id,subject_type,target,authority_kind,authority_ref,authority_digest,requested_operation,intended_disposition)
VALUES
('${id(800)}','a','${id(2001)}','${id(1001)}','agent','{"machinePrincipalId":"${id(1)}","canonicalAgentId":"agt_isolated-1"}','owner_exact','owner:a','${dg('a')}','activate','active'),
('${id(800)}','b','${id(2004)}','${id(1004)}','service','{"machinePrincipalId":"${id(4)}"}','accepted_governing_authority','spec:b','${dg('b')}','activate','active')`);
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_operation_authorities WHERE operation_id='${id(800)}'`))[0].n, 2);
      await rejected(`UPDATE canonical_subject_operation_authorities SET authority_ref='edited' WHERE operation_id='${id(800)}' AND mutation_key='a'`);
      await rejected(`DELETE FROM canonical_subject_operations WHERE operation_id='${id(800)}'`);
      await rejected(`INSERT INTO canonical_subject_operations
(operation_id,environment,actor_ref,packet_digest,authority_digest,prestate_digest,plan_digest,attestation_authority_manifest_digest,poststate_digest,mutation_counts)
VALUES('${id(801)}','isolated','actor','${dg('1')}','${dg('2')}','${dg('3')}','${dg('7')}','${dg('5')}','${dg('6')}','{"ACTIVATE_ATTESTATION":1}'::jsonb)`);
      await rejected(`INSERT INTO canonical_subject_operations
(operation_id,environment,actor_ref,packet_digest,authority_digest,prestate_digest,plan_digest,attestation_authority_manifest_digest,poststate_digest,mutation_counts)
VALUES('${id(802)}','isolated','actor','${dg('1')}','${dg('2')}','${dg('3')}','${dg('8')}','${dg('5')}','${dg('6')}','{"UNKNOWN_OPERATION":1}'::jsonb)`);
      await rejected(`INSERT INTO canonical_subject_operation_authorities
(operation_id,mutation_key,business_subject_id,subject_attestation_id,subject_type,target,authority_kind,authority_ref,authority_digest,requested_operation,intended_disposition)
VALUES('${id(800)}','c','${id(2001)}','${id(1001)}','agent','{"userId":"${id(900)}"}','owner_exact','owner:c','${dg('a')}','activate','active')`);
    });

    await t.test('real PLAN/APPLY/VERIFY is atomic, idempotent and digest-bound', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      const input = {
        packetVersion: '1', operationId: id(810), environment: 'isolated-test', actorRef: `user:${id(900)}`,
        authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }],
        mutations: [{
          mutationKey: 'attestation-010', operation: 'ACTIVATE_ATTESTATION', subjectAttestationId: id(1010), businessSubjectId: id(2010), subjectType: 'agent', businessSubjectDescription: 'context only',
          target: { machinePrincipalId: id(2), canonicalAgentId: 'agt_isolated-2' }, authoritySource: 'owner:packet', attestedBy: { kind: 'user', id: id(900) },
          authority: { kind: 'owner_exact', ref: 'owner:subject-10', digest: dg('a'), requestedOperation: 'activate', intendedDisposition: 'active' }, effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'isolated-evidence',
        }, {
          mutationKey: 'binding-010', operation: 'ACTIVATE_SOURCE_BINDING', sourceBindingId: id(4010), sourceNamespace: 'isolated', sourceLocalValue: 'opaque-10', subjectAttestationId: id(1010), effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'isolated-row', expectedRevision: null,
        }], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z',
      };
      const evidence = {
        validatePacketAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }),
        validateAttestationAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }),
        validateCoreAgent: async (target: any) => ({ valid: true as const, evidenceDigest: dg('d'), principalId: target.machinePrincipalId, agentId: target.canonicalAgentId, expiresAt: '2026-09-16T12:30:00.000Z' }),
        validateSourceExit: async () => ({ valid: true, zeroLive: true, evidenceDigest: dg('e') }),
        validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true }),
      };
      const imported = module.importCanonicalSubjectPacket(input);
      const alternateImported = module.importCanonicalSubjectPacket({ ...input, sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('4') }] });
      const store = module.createCanonicalSubjectReadStore(client as any);
      const plan = await module.planCanonicalSubjectEnrollment(imported, store, evidence, { now: new Date('2026-09-16T12:00:00.000Z') });
      const alternatePlan = await module.planCanonicalSubjectEnrollment(alternateImported, store, evidence, { now: new Date('2026-09-16T12:00:00.000Z') });
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_attestations WHERE subject_attestation_id='${id(1010)}'`))[0].n, 0, 'PLAN is read-only');
      const applied = await module.applyCanonicalSubjectPlan(imported, plan, evidence, client as any, { now: new Date('2026-09-16T12:00:00.000Z') });
      assert.equal(applied.result, 'APPLIED');
      const receipt = await module.verifyCanonicalSubjectOperation(plan, store, evidence, { observedAt: new Date('2026-09-16T12:01:00.000Z') });
      assert.equal(receipt.result, 'PASS');
      assert.equal(receipt.authorityCoordinates.manifestDigest, plan.authorityManifestDigest);
      assert.equal(receipt.commitObservedAt !== null, true);
      assert.equal((await module.applyCanonicalSubjectPlan(imported, plan, evidence, client as any, { now: new Date('2026-09-16T12:02:00.000Z') })).result, 'NOOP');
      await assert.rejects(module.applyCanonicalSubjectPlan(alternateImported, alternatePlan, evidence, client as any, { now: new Date('2026-09-16T12:02:00.000Z') }), (error: any) => error.code === 'IDEMPOTENCY_CONFLICT');
      await assert.rejects(module.applyCanonicalSubjectPlan(imported, { ...plan, planDigest: dg('9') }, evidence, client as any, { now: new Date('2026-09-16T12:02:00.000Z') }), (error: any) => error.code === 'PACKET_DIGEST_MISMATCH');
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_operations WHERE operation_id='${id(810)}'`))[0].n, 1);
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_operation_authorities WHERE operation_id='${id(810)}'`))[0].n, 1);
    });

    await t.test('five retirement predicate omissions are read-only failures against real state', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      const mutation = { mutationKey: 'retire-3', operation: 'TRANSITION_AGENT_LIFECYCLE', principalId: id(3), fromState: 'legacy', toState: 'retired', expectedRevision: '1', authorityRef: 'owner:retire', authorityDigest: dg('f'), evidenceRef: 'isolated-retire', predicates: { liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true } };
      const basePacket = { packetVersion: '1', operationId: id(820), environment: 'isolated-test', actorRef: `user:${id(900)}`, authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }], mutations: [mutation], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z' };
      const store = module.createCanonicalSubjectReadStore(client as any);
      const failures = [{ liveWritableReferences: 1 }, { activeWorkOwnerReferences: 1 }, { activeGrantsRequired: 1 }, { activeClientRequired: 1 }, { successorMappingVerified: false }];
      for (const failure of failures) {
        const evidence = { validatePacketAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateAttestationAuthority: async () => ({ valid: false as const, code: 'ATTESTATION_AUTHORITY_INVALID' as const }), validateCoreAgent: async () => ({ valid: false as const }), validateSourceExit: async () => ({ valid: false, zeroLive: false, evidenceDigest: dg('e') }), validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true, ...failure }) };
        await assert.rejects(module.planCanonicalSubjectEnrollment(module.importCanonicalSubjectPacket(basePacket), store, evidence, { now: new Date('2026-09-16T12:00:00.000Z') }), (error: any) => error.code === 'AUTHORITY_NOT_ACCEPTED');
        assert.deepEqual((await query(`SELECT state::text,revision::text FROM agent_identity_lifecycle WHERE principal_id='${id(3)}'`))[0], { state: 'legacy', revision: '1' });
      }
    });

    await t.test('atomic revoke plus canonical retirement passes and VERIFY rejects predicate drift', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      await serial(attestation(106, 'agent', `'${id(6)}',NULL,'agt_isolated-6'`));
      const input = {
        packetVersion: '1', operationId: id(821), environment: 'isolated-test', actorRef: `user:${id(900)}`,
        authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }],
        mutations: [{
          mutationKey: 'retire-6', operation: 'TRANSITION_AGENT_LIFECYCLE', principalId: id(6), fromState: 'canonical', toState: 'retired', expectedRevision: '1',
          authorityRef: 'owner:retire-6', authorityDigest: dg('f'), evidenceRef: 'isolated-retire-6',
          predicates: { liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true },
        }, {
          mutationKey: 'revoke-6', operation: 'REVOKE_ATTESTATION', subjectAttestationId: id(1106), businessSubjectId: id(2106), subjectType: 'agent',
          target: { machinePrincipalId: id(6), canonicalAgentId: 'agt_isolated-6' }, expectedRevision: '1', evidenceRef: 'owner:revoke-6',
          authority: { kind: 'owner_exact', ref: 'owner:revoke-6', digest: dg('a'), requestedOperation: 'revoke', intendedDisposition: 'revoked' },
        }, {
          mutationKey: 'successor-6', operation: 'INSTALL_EXPLICIT_SUCCESSOR', sourcePrincipalId: id(6), targetPrincipalId: id(1),
          authorityRef: 'owner:successor-6', authorityDigest: dg('7'), evidenceRef: 'owner:successor-6',
        }], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z',
      };
      const validEvidence = {
        validatePacketAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }),
        validateAttestationAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }),
        validateCoreAgent: async (target: any) => ({ valid: true as const, evidenceDigest: dg('d'), principalId: target.machinePrincipalId, agentId: target.canonicalAgentId, expiresAt: '2026-09-16T12:30:00.000Z' }),
        validateSourceExit: async () => ({ valid: true, zeroLive: true, evidenceDigest: dg('e') }),
        validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true }),
      };
      const imported = module.importCanonicalSubjectPacket(input);
      const store = module.createCanonicalSubjectReadStore(client as any);
      const plan = await module.planCanonicalSubjectEnrollment(imported, store, validEvidence, { now: new Date('2026-09-16T12:00:00.000Z') });
      assert.equal((await module.applyCanonicalSubjectPlan(imported, plan, validEvidence, client as any, { now: new Date('2026-09-16T12:00:00.000Z') })).result, 'APPLIED');
      const staleEvidence = { ...validEvidence, validateCoreAgent: async () => ({ valid: false as const }), validateLifecyclePredicates: async () => ({ valid: false, evidenceDigest: dg('0'), liveWritableReferences: 1, activeWorkOwnerReferences: 1, activeGrantsRequired: 1, activeClientRequired: 1, successorMappingVerified: false }) };
      assert.equal((await module.applyCanonicalSubjectPlan(imported, plan, staleEvidence, client as any, { now: new Date('2026-09-16T12:00:30.000Z') })).result, 'NOOP');
      assert.equal((await module.verifyCanonicalSubjectOperation(plan, store, validEvidence, { observedAt: new Date('2026-09-16T12:01:00.000Z') })).result, 'PASS');
      const driftedEvidence = { ...validEvidence, validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 1, successorMappingVerified: true }) };
      assert.equal((await module.verifyCanonicalSubjectOperation(plan, store, driftedEvidence, { observedAt: new Date('2026-09-16T12:01:00.000Z') })).result, 'FAIL');
      assert.deepEqual((await query(`SELECT state::text,revision::text FROM agent_identity_lifecycle WHERE principal_id='${id(6)}'`))[0], { state: 'retired', revision: '2' });
      assert.equal((await query(`SELECT status::text FROM canonical_subject_attestations WHERE subject_attestation_id='${id(1106)}'`))[0].status, 'revoked');
    });

    await t.test('database audit failure rolls back the entire APPLY', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      const subject = { mutationKey: 'rollback-audit', operation: 'ACTIVATE_ATTESTATION', subjectAttestationId: id(1130), businessSubjectId: id(2130), subjectType: 'agent', businessSubjectDescription: 'context only', target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1' }, authoritySource: 'owner:packet', attestedBy: { kind: 'user', id: id(900) }, authority: { kind: 'owner_exact', ref: 'owner:audit', digest: dg('a'), requestedOperation: 'activate', intendedDisposition: 'active' }, effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'isolated' };
      const input = { packetVersion: '1', operationId: id(830), environment: 'isolated-test', actorRef: `user:${id(900)}`, authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }], mutations: [subject], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z' };
      const evidence = { validatePacketAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateAttestationAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateCoreAgent: async (target: any) => ({ valid: true as const, evidenceDigest: dg('d'), principalId: target.machinePrincipalId, agentId: target.canonicalAgentId, expiresAt: '2026-09-16T12:30:00.000Z' }), validateSourceExit: async () => ({ valid: true, zeroLive: true, evidenceDigest: dg('e') }), validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true }) };
      const imported = module.importCanonicalSubjectPacket(input);
      const plan = await module.planCanonicalSubjectEnrollment(imported, module.createCanonicalSubjectReadStore(client as any), evidence, { now: new Date('2026-09-16T12:00:00.000Z') });
      await query("CREATE FUNCTION isolated_reject_operation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated audit rejection' USING ERRCODE='23514'; END $$");
      await query('CREATE TRIGGER isolated_reject_operation BEFORE INSERT ON canonical_subject_operations FOR EACH ROW EXECUTE FUNCTION isolated_reject_operation()');
      try {
        await assert.rejects(module.applyCanonicalSubjectPlan(imported, plan, evidence, client as any, { now: new Date('2026-09-16T12:00:00.000Z') }), (error: any) => error.code === 'AUDIT_WRITE_FAILED');
      }
      finally {
        await query('DROP TRIGGER isolated_reject_operation ON canonical_subject_operations');
        await query('DROP FUNCTION isolated_reject_operation()');
      }
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_attestations WHERE business_subject_id='${id(2130)}'`))[0].n, 0);
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_operations WHERE operation_id='${id(830)}'`))[0].n, 0);
    });

    await t.test('database serialization failure is closed and rolls back without retry', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      const input = { packetVersion: '1', operationId: id(831), environment: 'isolated-test', actorRef: `user:${id(900)}`, authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }], mutations: [{ mutationKey: 'serialization-1', operation: 'ACTIVATE_ATTESTATION', subjectAttestationId: id(1131), businessSubjectId: id(2131), subjectType: 'agent', businessSubjectDescription: 'context only', target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1' }, authoritySource: 'owner:packet', attestedBy: { kind: 'user', id: id(900) }, authority: { kind: 'owner_exact', ref: 'owner:serialization', digest: dg('a'), requestedOperation: 'activate', intendedDisposition: 'active' }, effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'isolated' }], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z' };
      const evidence = { validatePacketAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateAttestationAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateCoreAgent: async (target: any) => ({ valid: true as const, evidenceDigest: dg('d'), principalId: target.machinePrincipalId, agentId: target.canonicalAgentId, expiresAt: '2026-09-16T12:30:00.000Z' }), validateSourceExit: async () => ({ valid: true, zeroLive: true, evidenceDigest: dg('e') }), validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true }) };
      const imported = module.importCanonicalSubjectPacket(input);
      const plan = await module.planCanonicalSubjectEnrollment(imported, module.createCanonicalSubjectReadStore(client as any), evidence, { now: new Date('2026-09-16T12:00:00.000Z') });
      await query("CREATE FUNCTION isolated_serialization_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated serialization failure' USING ERRCODE='40001'; END $$");
      await query('CREATE TRIGGER isolated_serialization_failure BEFORE INSERT ON canonical_subject_attestations FOR EACH ROW EXECUTE FUNCTION isolated_serialization_failure()');
      try {
        await assert.rejects(module.applyCanonicalSubjectPlan(imported, plan, evidence, client as any, { now: new Date('2026-09-16T12:00:00.000Z') }), (error: any) => error.code === 'SERIALIZATION_FAILURE');
      }
      finally {
        await query('DROP TRIGGER isolated_serialization_failure ON canonical_subject_attestations');
        await query('DROP FUNCTION isolated_serialization_failure()');
      }
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_attestations WHERE subject_attestation_id='${id(1131)}'`))[0].n, 0);
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_operations WHERE operation_id='${id(831)}'`))[0].n, 0);
    });

    await t.test('shared identity lock timeout fails with zero write and no retry', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      const input = { packetVersion: '1', operationId: id(840), environment: 'isolated-test', actorRef: `user:${id(900)}`, authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }], mutations: [{ mutationKey: 'lock-1', operation: 'ACTIVATE_ATTESTATION', subjectAttestationId: id(1140), businessSubjectId: id(2140), subjectType: 'agent', businessSubjectDescription: 'context only', target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1' }, authoritySource: 'owner:packet', attestedBy: { kind: 'user', id: id(900) }, authority: { kind: 'owner_exact', ref: 'owner:lock', digest: dg('a'), requestedOperation: 'activate', intendedDisposition: 'active' }, effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'isolated' }], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z' };
      const evidence = { validatePacketAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateAttestationAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateCoreAgent: async (target: any) => ({ valid: true as const, evidenceDigest: dg('d'), principalId: target.machinePrincipalId, agentId: target.canonicalAgentId, expiresAt: '2026-09-16T12:30:00.000Z' }), validateSourceExit: async () => ({ valid: true, zeroLive: true, evidenceDigest: dg('e') }), validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true }) };
      const imported = module.importCanonicalSubjectPacket(input);
      const plan = await module.planCanonicalSubjectEnrollment(imported, module.createCanonicalSubjectReadStore(client as any), evidence, { now: new Date('2026-09-16T12:00:00.000Z') });
      let release!: () => void; let locked!: () => void;
      const lockedPromise = new Promise<void>(resolve => locked = resolve); const releasePromise = new Promise<void>(resolve => release = resolve);
      const holder = client.$transaction(async tx => { await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(173496021,1)'); locked(); await releasePromise; }, { isolationLevel: 'Serializable', timeout: 5000 });
      await lockedPromise;
      await assert.rejects(module.applyCanonicalSubjectPlan(imported, plan, evidence, client as any, { now: new Date('2026-09-16T12:00:00.000Z'), timeoutMs: 50 }), (error: any) => error.code === 'LOCK_TIMEOUT');
      release(); await holder;
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_attestations WHERE subject_attestation_id='${id(1140)}'`))[0].n, 0);
    });

    await t.test('delegated APPLY and revocation serialize; revoked authority cannot write', async () => {
      const module = await import('../../src/lib/oauth/v1/canonical-subject-enrollment.js');
      await serial(`INSERT INTO identity_attestation_delegations
(delegation_id,delegated_actor_type,delegated_user_id,authorized_subject_type,authorized_business_subject_ids,authorized_operations,owner_authority_ref,owner_authority_digest,effective_at,expires_at,status,revision)
VALUES('${id(3002)}','user','${id(900)}','agent',ARRAY['${id(2020)}','${id(2021)}']::uuid[],ARRAY['activate']::text[],'owner:delegation-2','${dg('b')}','2026-09-16T11:00:00Z','2030-09-16T13:00:00Z','active',1)`);
      const makeInput = (n: number, operationId: number) => ({ packetVersion: '1', operationId: id(operationId), environment: 'isolated-test', actorRef: `user:${id(900)}`, authorityRef: 'owner:packet', authorityDigest: dg('2'), sourceArtifacts: [{ ref: 'isolated:ledger', digest: dg('3') }], mutations: [{ mutationKey: `delegated-${n}`, operation: 'ACTIVATE_ATTESTATION', subjectAttestationId: id(1200 + n), businessSubjectId: id(2000 + n), subjectType: 'agent', businessSubjectDescription: 'context only', target: { machinePrincipalId: id(n === 20 ? 1 : 2), canonicalAgentId: n === 20 ? 'agt_isolated-1' : 'agt_isolated-2' }, authoritySource: 'owner:delegation-2', attestedBy: { kind: 'user', id: id(900) }, authority: { kind: 'delegated', ref: 'owner:delegation-2', digest: dg('b'), requestedOperation: 'activate', intendedDisposition: 'active', delegationId: id(3002), delegationRevision: '1' }, effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'isolated' }], createdAt: '2026-09-16T11:30:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z' });
      const evidence = { validatePacketAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateAttestationAuthority: async (entry: any) => ({ valid: true as const, authorityDigest: entry.authorityDigest }), validateCoreAgent: async (target: any) => ({ valid: true as const, evidenceDigest: dg('d'), principalId: target.machinePrincipalId, agentId: target.canonicalAgentId, expiresAt: '2026-09-16T12:30:00.000Z' }), validateSourceExit: async () => ({ valid: true, zeroLive: true, evidenceDigest: dg('e') }), validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: dg('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true }) };
      const imported = module.importCanonicalSubjectPacket(makeInput(20, 850));
      const plan = await module.planCanonicalSubjectEnrollment(imported, module.createCanonicalSubjectReadStore(client as any), evidence, { now: new Date('2026-09-16T12:00:00.000Z') });
      let reached!: () => void; let resume!: () => void;
      const reachedPromise = new Promise<void>(resolve => reached = resolve); const resumePromise = new Promise<void>(resolve => resume = resolve);
      const pausedDb = { $transaction: (fn: any, options: any) => client.$transaction(async tx => fn({
        $executeRawUnsafe: tx.$executeRawUnsafe.bind(tx),
        $queryRawUnsafe: async (statement: string, ...values: any[]) => {
          const result = await tx.$queryRawUnsafe(statement, ...values);
          if (statement.includes('identity_attestation_delegations') && statement.includes('FOR UPDATE')) { reached(); await resumePromise; }
          return result;
        },
      }), options) };
      const applying = module.applyCanonicalSubjectPlan(imported, plan, evidence, pausedDb as any, { now: new Date('2026-09-16T12:00:00.000Z'), timeoutMs: 5000 });
      await reachedPromise;
      const revoking = serial(`UPDATE identity_attestation_delegations SET status='revoked',revision=2,revoked_at=now(),revocation_authority_ref='owner:revoke-2' WHERE delegation_id='${id(3002)}'`);
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND datname=current_database()"))[0].n > 0) { blocked = true; break; }
        await new Promise(resolve => setImmediate(resolve));
      }
      assert.equal(blocked, true);
      resume();
      assert.equal((await applying).result, 'APPLIED');
      await revoking;
      assert.equal((await query(`SELECT status::text FROM identity_attestation_delegations WHERE delegation_id='${id(3002)}'`))[0].status, 'revoked');
      const afterRevoke = module.importCanonicalSubjectPacket(makeInput(21, 851));
      await assert.rejects(module.planCanonicalSubjectEnrollment(afterRevoke, module.createCanonicalSubjectReadStore(client as any), evidence, { now: new Date('2026-09-16T12:02:00.000Z') }), (error: any) => error.code === 'ATTESTATION_AUTHORITY_REVOKED');
      assert.equal((await query(`SELECT count(*)::int n FROM canonical_subject_attestations WHERE subject_attestation_id='${id(1221)}'`))[0].n, 0);
    });

    await t.test('fixture graph reflects only the controlled isolated retirement', async () => {
      assert.equal((await query(`SELECT count(*)::int n FROM agent_identity_successors`))[0].n, 1);
      assert.equal((await query(`SELECT count(*)::int n FROM agent_identity_lifecycle`))[0].n, 5);
      assert.equal((await query(`SELECT count(*)::int n FROM machine_principals`))[0].n, 6);
    });
  }
  finally {
    await db?.$disconnect();
    if (started)
      execFileSync('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
    rmSync(root, { recursive: true, force: true });
  }
});
