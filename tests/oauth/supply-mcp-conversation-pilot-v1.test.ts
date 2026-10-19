import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';

// Contract-first: the CLI must never turn caller JSON into approval or read a DB URL.
test('ACC-MCS-003 closed requests reject duplicate keys, secret material and caller coordinates', async () => {
  const { parseRequest } = await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  assert.throws(() => parseRequest('{"phase":"supply","phase":"registry"}'));
  assert.throws(() => parseRequest('{"client_secret":"do-not-accept"}'));
  assert.throws(() => parseRequest('{"database_url":"postgres://production"}'));
  assert.throws(() => parseRequest('{"destination":"/tmp/arbitrary"}'));
});

test('ACC-MCS-001 production CLI has no trusted approval or database adapter', async () => {
  const { cli } = await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const out = await cli(['registry'], JSON.stringify(request('registry')));
  assert.equal(out.result, 'REFUSED');
  assert.equal(out.error_class, 'TRUST_ADAPTER_UNAVAILABLE');
  assert.equal(out.retryable, false);
  assert(!JSON.stringify(out).includes('postgres'));
});

export function request(phase: 'registry' | 'registry-disable' | 'supply') {
  const common = {
    schema_version: 2, parent_delegation_id: randomUUID(), parent_delegation_digest: '8'.repeat(64), phase, operation_id: randomUUID(), environment: 'isolated-conformance',
    source_commit: process.env.MCS_TEST_SOURCE_COMMIT ?? '6cf266386d815f5c822ce3d59905209210efb29b',
    spec_ref: 'AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1@6cf266386d815f5c822ce3d59905209210efb29b',
    spec_digest: 'df5ff4c536da553f16d0a5dce8658cd660082d4f0b8c37a303f71c29a33e2f2e',
    audience_authority_ref: 'AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1@6cf266386d815f5c822ce3d59905209210efb29b',
    audience_authority_digest: 'b6f62aed763d5a25f1b08e5e6a811137bf251c0252ba62fbade45b651ab98d6c',
    bundle_digest: 'a'.repeat(64), runtime_digest: 'b'.repeat(64),
    runtime_preimage_receipt_ref: 'isolated:original-source-receipt', runtime_preimage_receipt_digest: 'c'.repeat(64),
    operator_ref: 'isolated:original-auth-owner', approval_ref: 'isolated:owner-mandate',
    approval_digest: 'd'.repeat(64), approval_nonce: randomBytes(32).toString('base64url'),
    created_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 600000).toISOString(),
  };
  return phase === 'supply' ? { ...common, connector_config_receipt_ref: 'isolated:original-mcp-transport',
    connector_config_receipt_digest: 'e'.repeat(64), connector_subject: randomUUID(),
    registry_receipt_ref: 'isolated:phase-a-receipt', registry_receipt_digest: 'f'.repeat(64) } :
    { ...common, stop_serving_receipt_ref: 'isolated:stopped-original-owner', stop_serving_receipt_digest: 'e'.repeat(64) };
}

import { mkdirSync, chownSync, chmodSync, readFileSync, readdirSync, lstatSync, unlinkSync, symlinkSync, linkSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { createIsolatedVehicle, parseRequest, digest, FIXED, AUDIENCE, type Request, type IsolatedOptions, type Dependencies, createProductionVehicle, validatePublicOutput } from '../../scripts/supply-mcp-conversation-pilot-v1.js';
import { verifyRuntimeSnapshot } from '../../src/lib/oauth/v1/contract.js';

const fixtureRoot = process.env.MCS_TEST_ROOT;
const databaseUrl = process.env.MCS_TEST_DATABASE_URL;
const integration = fixtureRoot && databaseUrl;
const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
function fsFingerprint(path: string): string {
  const entries: unknown[] = [];
  const walk = (p: string) => { const s = lstatSync(p); entries.push([p, s.uid, s.gid, s.mode, s.ino, s.nlink, s.size]);
    if (s.isDirectory()) readdirSync(p).sort().forEach(v => walk(join(p, v))); else if (s.isFile()) entries.push(hash(readFileSync(p))); };
  walk(path); return digest(entries);
}

// Removing locking/fencing, adopting a partial row, trusting self-assertion or reminting
// after a persistence fault makes these real PostgreSQL/OS assertions fail.
test('ACC-MCS-002..010 isolated PostgreSQL and actual root/UID502 filesystem matrix', { skip: !integration ? 'NOT_RUN: invoke isolated conformance runner' : false }, async t => {
  assert.equal(process.getuid?.(), 0);
  assert(!fixtureRoot!.startsWith('/Users/'));
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } }, log: [] });
  const snapshot = JSON.parse(readFileSync('generated/minimal-auth-v1/runtime-contract.json', 'utf8'));
  const payload = verifyRuntimeSnapshot(snapshot);
  assert.equal(payload.contractVersion, '1.14.0');
  const source = JSON.parse(readFileSync('contract-bundles/minimal-auth-v1/audience-registry.json', 'utf8'));
  assert(source.audiences.some((v: any) => v.audience_id === FIXED.resource));
  let index = 0;
  const vehicles: ReturnType<typeof createIsolatedVehicle>[] = [];
  async function reset() { await db.$executeRawUnsafe('TRUNCATE auth_audiences, auth_security_audits, grant_change_audits, machine_access_grants, machine_clients, machine_principals CASCADE'); }
  function req(phase: 'registry' | 'registry-disable' | 'supply'): Request {
    return parseRequest(JSON.stringify({ ...request(phase), runtime_digest: snapshot.runtimeDigest, bundle_digest: payload.sourceBundleDigest }));
  }
  async function fixture(extra: Partial<IsolatedOptions> = {}) {
    await Promise.all(vehicles.map(v => v.close())); vehicles.length = 0;
    await reset();
    const root = join(fixtureRoot!, 'case-' + (++index)); mkdirSync(root, { mode: 0o700 }); chownSync(root, 502, 20);
    mkdirSync(join(root, 'escrow'), { mode: 0o700 }); chownSync(join(root, 'escrow'), 0, 0);
    mkdirSync(join(root, 'mcp'), { mode: 0o700 }); chownSync(join(root, 'mcp'), 502, 20);
    let approved = true; let stopped = true; let aligned = true; let pin = true; let generations = 0; let osFaultArmed = false;
    const opts: IsolatedOptions = { root, databaseUrl: databaseUrl!, uid: 502, gid: 20,
      dependencies: async q => {
        // Independently loaded fixture artifact, not a health endpoint or caller JSON.
        const current = JSON.parse(readFileSync('generated/minimal-auth-v1/runtime-contract.json', 'utf8'));
        const validated = verifyRuntimeSnapshot(current);
        const authority = request(q.phase);
        const d: any = { ...q, source_commit: authority.source_commit, spec_ref: authority.spec_ref, spec_digest: authority.spec_digest,
          audience_authority_ref: authority.audience_authority_ref, audience_authority_digest: authority.audience_authority_digest,
          runtime_preimage_receipt_ref: authority.runtime_preimage_receipt_ref, runtime_preimage_receipt_digest: authority.runtime_preimage_receipt_digest,
          operator_ref: 'isolated:original-auth-owner', environment: 'isolated-conformance', executor_uid: 502, executor_gid: 20,
          candidate_validated: validated.contractVersion === '1.14.0' && current.runtimeDigest === q.runtime_digest && validated.sourceBundleDigest === q.bundle_digest,
          original_transport_verified: true, native_product_disabled: true, stopped_original_service: stopped,
          loaded_candidate_db_aligned: aligned };
        if (!pin) d.runtime_digest = '0'.repeat(64);
        if (q.phase === 'supply') {
          const row = await db.authAudience.findUnique({ where: { audienceId: FIXED.resource } });
          d.loaded_candidate_db_aligned = aligned && row?.status === 'active' && row.version === 1 &&
            row.freezeReady && digest(Object.fromEntries(Object.entries(row).filter(([k]) => !['createdAt', 'updatedAt'].includes(k)))) === digest(AUDIENCE);
        }
        return d as Dependencies;
      },
      mandate: async (q, action, pd) => approved ? ({ issuer: 'isolated-independent-owner', actor: q.operator_ref,
        environment: 'isolated-conformance', operation_id: q.operation_id, approval_ref: q.approval_ref,
        approval_digest: q.approval_digest, approval_nonce: q.approval_nonce, plan_digest: pd, action,
        expires_at: q.expires_at, attempts_max: 1, ...(action === 'recover-delivery' ? { recovery_nonce: randomUUID() } : {}) }) : undefined,
      fault: async stage => { if (stage === 'SECRET_GENERATED') generations++; await extra.fault?.(stage); },
      ...extra };
    // Preserve instrumentation even when injecting a fault.
    opts.fault = async stage => { if (stage === 'SECRET_GENERATED') generations++; await extra.fault?.(stage); };
    opts.osFault = () => osFaultArmed ? (typeof extra.osFault === 'function' ? extra.osFault() : extra.osFault) : undefined;
    const vehicle = createIsolatedVehicle(opts); vehicles.push(vehicle);
    return { vehicle, root, armOsFault: (v = true) => { osFaultArmed = v; }, setApproved: (v: boolean) => { approved = v; }, setStopped: (v: boolean) => { stopped = v; },
      setAligned: (v: boolean) => { aligned = v; }, setPin: (v: boolean) => { pin = v; }, generations: () => generations };
  }
  async function registryReady(f: Awaited<ReturnType<typeof fixture>>) {
    const q = req('registry'); const plan = await f.vehicle.run(q);
    assert.equal(plan.classification, 'ABSENT_APPLY', plan.error_class);
    const result = await f.vehicle.run(q, 'apply', plan);
    assert.equal(result.result, 'COMMITTED', result.error_class);
    assert.equal(result.runtime_alignment, 'stopped_pending_load');
    const supply = req('supply'); if (supply.phase !== 'supply') throw Error('test discriminator');
    supply.registry_receipt_ref = 'isolated:phase-a:' + result.audit_id;
    supply.registry_receipt_digest = digest(result);
    return supply;
  }
  function outputSafe(outputs: any[], client?: any, privateData?: any) {
    const text = JSON.stringify(outputs);
    assert(!text.includes('secretHash') && !text.includes('client_secret') && !text.includes('credentialVerifier'));
    if (client) assert(!text.includes(client.secretHash));
    if (privateData) for (const form of [privateData.client_secret, Buffer.from(privateData.client_secret).toString('base64'), Buffer.from(privateData.client_secret).toString('hex')]) assert(!text.includes(form));
  }
  try {
    await t.test('registry plan is default and read-only; absent INSERT+same-transaction audit, exact NOOP', async () => {
      const f = await fixture(), q = req('registry'), before = fsFingerprint(f.root);
      const plan = await f.vehicle.run(q); assert.equal(plan.classification, 'ABSENT_APPLY', plan.error_class);
      assert.equal(fsFingerprint(f.root), before); assert.equal(await db.authAudience.count(), 0);
      const applied = await f.vehicle.run(q, 'apply', plan); assert.equal(applied.result, 'COMMITTED', applied.error_class);
      assert.deepEqual(applied.effect_counts, { audience: 1, audit: 1, principal: 0, client: 0, grant: 0, credential: 0 });
      assert.equal(await db.authSecurityAudit.count(), 1); assert.equal(await db.machineClient.count(), 0);
      const stable = fsFingerprint(f.root), noop = await f.vehicle.run(q, 'apply', plan);
      assert.equal(noop.result, 'EXACT_RERUN_NOOP'); assert.equal(fsFingerprint(f.root), stable);
      assert.equal(await db.authSecurityAudit.count(), 1); assert.equal(f.generations(), 0); outputSafe([plan, applied, noop]);
    });
    await t.test('partial registry and mismatched audit are refused, never repaired or adopted', async () => {
      const f = await fixture(), q = req('registry'); await db.authAudience.create({ data: { ...AUDIENCE } });
      const p = await f.vehicle.run(q); assert.equal(p.classification, 'REFUSED', p.error_class);
      const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.result, 'REFUSED');
      assert.equal(await db.authSecurityAudit.count(), 0); assert.equal(await db.authAudience.count(), 1);
    });
    await t.test('untrusted issuer, stopped-window absence, changed pins, stale prestate reject before writes/mint', async () => {
      const f = await fixture(), q = req('registry'), p = await f.vehicle.run(q), before = fsFingerprint(f.root);
      f.setApproved(false); const no = await f.vehicle.run(q, 'apply', p); assert.equal(no.error_class, 'MANDATE_REFUSED');
      assert.equal(fsFingerprint(f.root), before); assert.equal(await db.authAudience.count(), 0);
      f.setApproved(true); f.setStopped(false); assert.equal((await f.vehicle.run(q, 'apply', p)).error_class, 'STOP_SERVING_RECEIPT_REQUIRED');
      f.setStopped(true); f.setPin(false); assert.equal((await f.vehicle.run(q, 'apply', p)).error_class, 'DEPENDENCY_PIN_MISMATCH');
      f.setPin(true); await db.machinePrincipal.create({ data: { principalType: 'service', externalRef: 'bystander', status: 'active' } });
      assert.equal((await f.vehicle.run(q, 'apply', p)).error_class, 'STALE_PLAN'); assert.equal(f.generations(), 0);
      assert.equal(await db.authAudience.count(), 0);
    });
    await t.test('supply creates one SERVICE/client/grant/audit with original 256-bit custody; read paths/NOOP zero writes', async () => {
      const f = await fixture(), q = await registryReady(f), before = fsFingerprint(f.root);
      const p = await f.vehicle.run(q); assert.equal(p.classification, 'ABSENT_APPLY'); assert.equal(fsFingerprint(f.root), before);
      const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.result, 'COMMITTED', out.error_class);
      assert.deepEqual(out.effect_counts, { principal: 1, client: 1, grant: 1, audit: 1 }); assert.equal(f.generations(), 1);
      const [client] = await db.machineClient.findMany(), [principal] = await db.machinePrincipal.findMany(), [grant] = await db.machineAccessGrant.findMany();
      assert.equal(principal.principalType, 'service'); assert.equal(principal.agentId, null); assert.equal(principal.ownerUserId, null);
      assert.deepEqual(client.allowedResources, []); assert.deepEqual(client.allowedScopes, []); assert.deepEqual(grant.scopes, [FIXED.scope]);
      assert.equal(grant.version, 1); assert.equal(await db.grantChangeAudit.count(), 1);
      const final = readFileSync(f.vehicle.coordinates.destination, 'utf8'), data = JSON.parse(final);
      assert.equal(Buffer.from(data.client_secret, 'base64url').length, 32);
      assert.deepEqual(Object.keys(data).sort(), ['client_id', 'client_secret', 'connector_subject']);
      const st = lstatSync(f.vehicle.coordinates.destination); assert.equal(st.uid, 502); assert.equal(st.gid, 20); assert.equal(st.mode & 0o777, 0o600); assert.equal(st.nlink, 1);
      const stable = fsFingerprint(f.root); const verify = await f.vehicle.run(q, 'verify'), reconcile = await f.vehicle.run(q, 'reconcile'), noop = await f.vehicle.run(q, 'apply', p);
      for (const r of [verify, reconcile, noop]) assert.equal(r.result, 'EXACT_RERUN_NOOP', r.error_class);
      assert.equal(fsFingerprint(f.root), stable); assert.equal(f.generations(), 1); outputSafe([p, out, verify, reconcile, noop], client, data);
      assert.equal(out.non_target_digest_before, out.non_target_digest_after);
    });
    await t.test('Phase B requires actual loaded-candidate/registry agreement; registry ahead remains pending', async () => {
      const f = await fixture(), q = await registryReady(f); f.setAligned(false);
      const out = await f.vehicle.run(q); assert.equal(out.error_class, 'PHASE_B_ALIGNMENT_REQUIRED');
      assert.equal(await db.machineClient.count(), 0); assert.equal(f.generations(), 0);
    });
    await t.test('foreign destination, symlink, hardlink and unsafe ancestor ownership/modes reject before mint', async () => {
      for (const kind of ['foreign', 'symlink', 'hardlink', 'broad-parent', 'wrong-uid'] as const) {
        const f = await fixture(), q = await registryReady(f);
        if (kind === 'broad-parent') chmodSync(join(f.root, 'mcp'), 0o777);
        else if (kind === 'wrong-uid') chownSync(join(f.root, 'mcp'), 0, 0);
        else if (kind === 'symlink') symlinkSync(join(f.root, 'missing'), f.vehicle.coordinates.destination);
        else { writeFileSync(f.vehicle.coordinates.destination, '{}', { mode: 0o600 }); chownSync(f.vehicle.coordinates.destination, 502, 20);
          if (kind === 'hardlink') linkSync(f.vehicle.coordinates.destination, join(f.root, 'second-link')); }
        const p = await f.vehicle.run(q); const out = await f.vehicle.run(q, 'apply', p);
        assert.equal(out.result, 'REFUSED'); assert.equal(f.generations(), 0); assert.equal(await db.machineClient.count(), 0);
      }
    });
    for (const stage of ['ATTEMPT_STARTED', 'ESCROW_DURABLE', 'principal', 'client', 'grant', 'audit', 'DESTINATION_DURABLE', 'COMMIT_REQUESTED', 'COMMIT_RESULT']) {
      await t.test(`fault ${stage}: four DB rows commit together or absent; durable fence forbids mint/replay`, async () => {
        let armed = false;
        const f = await fixture({ fault: s => { if (armed && s === stage) throw Error('injected-private-error-not-serialized'); } });
        const q = await registryReady(f); const p = await f.vehicle.run(q); armed = true;
        const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.result, 'OUTCOME_UNKNOWN', out.error_class); assert.equal(out.fence_preserved, true);
        const counts = [await db.machinePrincipal.count(), await db.machineClient.count(), await db.machineAccessGrant.count(), await db.grantChangeAudit.count()];
        assert(counts.every(v => v === (stage === 'COMMIT_RESULT' ? 1 : 0)));
        const minted = f.generations(), stable = fsFingerprint(f.root), reconciliation = await f.vehicle.run(q, 'reconcile');
        assert.equal(fsFingerprint(f.root), stable); assert.equal(f.generations(), minted);
        if (stage === 'COMMIT_RESULT') assert.equal(reconciliation.result, 'EXACT_RERUN_NOOP');
        else assert.equal(reconciliation.residual_coordinates.state, 'proven_not_committed');
        const other = { ...q, operation_id: randomUUID(), approval_nonce: randomUUID() }; const p2 = await f.vehicle.run(other);
        const retry = await f.vehicle.run(other, 'apply', p2); assert.notEqual(retry.result, 'COMMITTED'); assert.equal(f.generations(), minted);
        assert(!JSON.stringify([out, reconciliation, retry]).includes('injected-private-error'));
      });
    }
    for (const osFault of ['before_file_fsync', 'after_file_fsync', 'before_install', 'after_install_link', 'after_directory_fsync', 'before_integrity_fsync', 'after_integrity_fsync', 'before_ready_directory_fsync', 'after_ready_directory_fsync']) {
      await t.test(`real filesystem ${osFault} failure remains fenced and never remints`, async () => {
        const f = await fixture({ osFault });
        // Registry uses same durable ledger but does not install or read credentials.
        const q = await registryReady(f), p = await f.vehicle.run(q);
        f.armOsFault(); const out = await f.vehicle.run(q, 'apply', p); assert.notEqual(out.result, 'COMMITTED');
        assert.equal(await db.machineClient.count(), 0); const count = f.generations();
        const retry = await f.vehicle.run(q, 'apply', p); assert.notEqual(retry.result, 'COMMITTED'); assert.equal(f.generations(), count);
        const reconciled = await f.vehicle.run(q, 'reconcile'); assert.equal(reconciled.residual_coordinates.state, 'proven_not_committed');
      });
    }
    await t.test('committed missing delivery recovers only original escrow under separate fresh mandate, no DB/mint', async () => {
      const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q), out = await f.vehicle.run(q, 'apply', p);
      assert.equal(out.result, 'COMMITTED', out.error_class); const raw = readFileSync(f.vehicle.coordinates.destination);
      unlinkSync(f.vehicle.coordinates.destination); const reconcile = await f.vehicle.run(q, 'reconcile');
      assert.equal(reconcile.residual_coordinates.state, 'committed_delivery_incomplete');
      const before = JSON.stringify(await db.grantChangeAudit.findMany()); f.setApproved(false);
      assert.equal((await f.vehicle.run(q, 'recover-delivery', p)).error_class, 'MANDATE_REFUSED');
      f.setApproved(true); const recovered = await f.vehicle.run(q, 'recover-delivery', p);
      assert.equal(recovered.result, 'EXACT_RERUN_NOOP', recovered.error_class);
      assert(readFileSync(f.vehicle.coordinates.destination).equals(raw)); assert.equal(f.generations(), 1);
      assert.equal(JSON.stringify(await db.grantChangeAudit.findMany()), before); outputSafe([out, reconcile, recovered], (await db.machineClient.findMany())[0], JSON.parse(raw.toString()));
    });
    await t.test('lost/corrupt escrow plus missing final is SECRET_LOST, never rotation/replacement', async () => {
      const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q); assert.equal((await f.vehicle.run(q, 'apply', p)).result, 'COMMITTED');
      unlinkSync(f.vehicle.coordinates.destination); writeFileSync(join(f.root, 'escrow', 'secret-' + q.operation_id, 'credential.json'), '{}');
      const out = await f.vehicle.run(q, 'reconcile'); assert.equal(out.result, 'SECRET_LOST');
      assert.notEqual((await f.vehicle.run(q, 'recover-delivery', p)).result, 'EXACT_RERUN_NOOP'); assert.equal(f.generations(), 1);
      assert.equal(await db.machineClient.count(), 1); assert.equal(await db.grantChangeAudit.count(), 1);
    });
    await t.test('same bytes at replaced inode are refused for delivery and escrow recovery', async () => {
      const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q); assert.equal((await f.vehicle.run(q, 'apply', p)).result, 'COMMITTED');
      const dest = f.vehicle.coordinates.destination, raw = readFileSync(dest); renameSync(dest, dest + '.old'); writeFileSync(dest, raw, { mode: 0o600 }); chownSync(dest, 502, 20);
      const out = await f.vehicle.run(q, 'verify'); assert.notEqual(out.result, 'EXACT_RERUN_NOOP');
      unlinkSync(dest); const escrow = join(f.root, 'escrow', 'secret-' + q.operation_id, 'credential.json'); renameSync(escrow, escrow + '.old'); writeFileSync(escrow, raw, { mode: 0o600 });
      const recovery = await f.vehicle.run(q, 'recover-delivery', p); assert.notEqual(recovery.result, 'EXACT_RERUN_NOOP'); assert.equal(f.generations(), 1);
    });
    for (const point of ['read-escrow:EIO','read-escrow:EMFILE','read-destination:EIO','read-destination:EMFILE','helper-unavailable']) {
      await t.test('unavailable private-copy observation '+point+' retains UNKNOWN instead of false SECRET_LOST', async () => {
        const f=await fixture({osFault:point}),q=await registryReady(f),p=await f.vehicle.run(q);assert.equal((await f.vehicle.run(q,'apply',p)).result,'COMMITTED');
        if(point.startsWith('read-escrow')||point==='helper-unavailable') unlinkSync(f.vehicle.coordinates.destination);
        const before=fsFingerprint(f.root),dbBefore=digest(await db.grantChangeAudit.findMany());f.armOsFault();
        const outputs=[await f.vehicle.run(q,'verify'),await f.vehicle.run(q,'reconcile')];
        for(const output of outputs){assert.equal(output.result,'OUTCOME_UNKNOWN');assert.equal(output.error_class,'PRIVATE_COPY_UNAVAILABLE');assert.equal(output.fence_preserved,true);}
        assert.equal(fsFingerprint(f.root),before);assert.equal(digest(await db.grantChangeAudit.findMany()),dbBefore);assert.equal(f.generations(),1);
        f.armOsFault(false);const fresh=await f.vehicle.run(q,'reconcile');
        if(existsSync(f.vehicle.coordinates.destination))assert.equal(fresh.result,'EXACT_RERUN_NOOP');else assert.equal(fresh.residual_coordinates.state,'committed_delivery_incomplete');
      });
    }
    await t.test('same-inode same-size escrow JSON alteration fails its private original-byte digest', async () => {
      const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q); assert.equal((await f.vehicle.run(q, 'apply', p)).result, 'COMMITTED');
      unlinkSync(f.vehicle.coordinates.destination);
      const escrow = join(f.root, 'escrow', 'secret-' + q.operation_id, 'credential.json'); const original = readFileSync(escrow), value = JSON.parse(original.toString());
      const changed = JSON.stringify({ client_secret: value.client_secret, client_id: value.client_id, connector_subject: value.connector_subject });
      assert.equal(Buffer.byteLength(changed), original.length); writeFileSync(escrow, changed);
      const reconcile = await f.vehicle.run(q, 'reconcile'); assert.equal(reconcile.result, 'SECRET_LOST');
      assert.notEqual((await f.vehicle.run(q, 'recover-delivery', p)).result, 'EXACT_RERUN_NOOP'); assert.equal(f.generations(), 1);
    });
    await t.test('registry disable is forward active@1 to disabled@2; exact NOOP; no deletion or silent reactivation', async () => {
      const f = await fixture(); await registryReady(f); const q = req('registry-disable'), p = await f.vehicle.run(q);
      assert.equal(p.classification, 'DISABLE_APPLY'); const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.result, 'COMMITTED', out.error_class);
      const row = await db.authAudience.findUniqueOrThrow({ where: { audienceId: FIXED.resource } }); assert.equal(row.status, 'disabled'); assert.equal(row.version, 2); assert.equal(row.freezeReady, false);
      assert.equal(await db.authSecurityAudit.count(), 2); assert.equal(await db.machineClient.count(), 0);
      assert.equal((await f.vehicle.run(q, 'apply', p)).result, 'EXACT_RERUN_NOOP');
      const other = req('registry'); const plan = await f.vehicle.run(other); assert.equal(plan.classification, 'REFUSED'); assert.equal((await f.vehicle.run(other, 'apply', plan)).result, 'REFUSED');
    });
    await t.test('audit fault rolls registry row and audit back together', async () => {
      const f = await fixture({ fault: stage => { if (stage === 'audit') throw Error('audit-fault'); } }), q = req('registry'), p = await f.vehicle.run(q);
      const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.result, 'OUTCOME_UNKNOWN');
      assert.equal(await db.authAudience.count(), 0); assert.equal(await db.authSecurityAudit.count(), 0);
      assert.equal((await f.vehicle.run(q, 'reconcile')).residual_coordinates.state, 'proven_not_committed');
    });
    await t.test('uncooperative row writer blocks table locks before any data snapshot; timeout aborts once', async () => {
      const f = await fixture({ lockTimeoutMs: 100 }); const q = req('registry'), p = await f.vehicle.run(q);
      let release!: () => void, held!: () => void;
      const ready = new Promise<void>(r => { held = r; }), wait = new Promise<void>(r => { release = r; });
      const writer = db.$transaction(async tx => { await tx.$executeRawUnsafe('LOCK TABLE machine_clients IN ROW EXCLUSIVE MODE'); held(); await wait; }, { timeout: 5000 });
      await ready; const out = await f.vehicle.run(q, 'apply', p); release(); await writer;
      assert.equal(out.result, 'REFUSED'); assert.equal(await db.authAudience.count(), 0); assert.equal(f.generations(), 0);
    });


    const ownerMandate = (q: Request, action: 'apply' | 'recover-delivery', pd: string) => ({ issuer: 'isolated-independent-owner', actor: q.operator_ref,
      environment: 'isolated-conformance', operation_id: q.operation_id, approval_ref: q.approval_ref, approval_digest: q.approval_digest,
      approval_nonce: q.approval_nonce, plan_digest: pd, action, expires_at: q.expires_at, attempts_max: 1 as const,
      ...(action === 'recover-delivery' ? { recovery_nonce: randomUUID() } : {}) });
    for (const kind of ['wrong-issuer', 'wrong-mandate-actor', 'wrong-mandate-environment', 'expired-mandate', 'wrong-operation', 'wrong-mandate-nonce', 'wrong-plan-digest', 'wrong-action', 'attempts-two'] as const) {
      await t.test('explicit authority negative ' + kind + ' rejects before mint/target writes', async () => {
        const f = await fixture({ mandate: async(q, action, pd) => {
          const m: any = ownerMandate(q, action, pd);
          if (kind === 'wrong-issuer') m.issuer = 'isolated-self-asserted-admin';
          if (kind === 'wrong-mandate-actor') m.actor = 'isolated:other-actor';
          if (kind === 'wrong-mandate-environment') m.environment = 'production';
          if (kind === 'expired-mandate') m.expires_at = new Date(Date.now() - 1000).toISOString();
          if (kind === 'wrong-operation') m.operation_id = randomUUID();
          if (kind === 'wrong-mandate-nonce') m.approval_nonce = randomUUID();
          if (kind === 'wrong-plan-digest') m.plan_digest = '0'.repeat(64);
          if (kind === 'wrong-action') m.action = 'recover-delivery';
          if (kind === 'attempts-two') m.attempts_max = 2;
          return m;
        } });
        const q = req('registry'), p = await f.vehicle.run(q), stable = fsFingerprint(f.root);
        const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.error_class, 'MANDATE_REFUSED');
        assert.equal(fsFingerprint(f.root), stable); assert.equal(await db.authAudience.count(), 0); assert.equal(await db.authSecurityAudit.count(), 0); assert.equal(f.generations(), 0);
      });
    }
    for (const kind of ['wrong-request-actor', 'wrong-request-environment', 'expired-request', 'expired-plan'] as const) {
      await t.test('explicit admission negative ' + kind + ' is read-only and cannot mint', async () => {
        const f = await fixture(), q: any = req('registry');
        if (kind === 'wrong-request-actor') q.operator_ref = 'isolated:other-actor';
        if (kind === 'wrong-request-environment') q.environment = 'production';
        if (kind === 'expired-request') { q.created_at = new Date(Date.now() - 120000).toISOString(); q.expires_at = new Date(Date.now() - 1000).toISOString(); }
        const p = await f.vehicle.run(q); if (kind === 'expired-plan') p.expires_at = new Date(Date.now() - 1000).toISOString();
        const out = await f.vehicle.run(q, 'apply', p); assert.notEqual(out.result, 'COMMITTED');
        if (kind === 'expired-plan') assert.equal(out.error_class, 'PLAN_EXPIRED');
        assert.equal(await db.authAudience.count(), 0); assert.equal(await db.authSecurityAudit.count(), 0); assert.equal(f.generations(), 0);
      });
    }
    await t.test('approval nonce reuse across phases and same operation with changed plan are refused without mint', async () => {
      const f = await fixture(), first = req('registry'), p = await f.vehicle.run(first); assert.equal((await f.vehicle.run(first, 'apply', p)).result, 'COMMITTED');
      const altered = { ...first, approval_digest: '0'.repeat(64) }; const p2 = await f.vehicle.run(altered);
      assert.notEqual((await f.vehicle.run(altered, 'apply', p2)).result, 'COMMITTED');
      const q = req('supply'); q.approval_nonce = first.approval_nonce; const sp = await f.vehicle.run(q);
      const out = await f.vehicle.run(q, 'apply', sp); assert.notEqual(out.result, 'COMMITTED');
      assert.equal(f.generations(), 0); assert.equal(await db.machineClient.count(), 0); assert.equal(await db.grantChangeAudit.count(), 0);
    });
    const fsyncEdges = ['before_file_fsync', 'after_file_fsync', 'before_directory_fsync', 'after_directory_fsync'];
    for (const scope of ['attempt', 'nonce', 'ledger:ESCROW_DURABLE', 'ledger:DESTINATION_DURABLE', 'ledger:COMMIT_REQUESTED', 'ledger:COMMITTED']) {
      for (const edge of fsyncEdges) await t.test('durable fsync fault ' + scope + ':' + edge + ' preserves fence and no replay', async () => {
        const point = scope + ':' + edge, f = await fixture({ osFault: point }), q = await registryReady(f), p = await f.vehicle.run(q); f.armOsFault();
        const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.result, 'OUTCOME_UNKNOWN'); assert.equal(out.error_class, 'OS_BOUNDARY_INJECTED'); assert.equal(out.fence_preserved, true);
        const committed = scope === 'ledger:COMMITTED', expected = committed ? 1 : 0;
        for (const count of [await db.machinePrincipal.count(), await db.machineClient.count(), await db.machineAccessGrant.count(), await db.grantChangeAudit.count()]) assert.equal(count, expected);
        const before = fsFingerprint(f.root), reconciled = await f.vehicle.run(q, 'reconcile'); assert.equal(fsFingerprint(f.root), before);
        assert.equal(reconciled.result, committed ? 'EXACT_RERUN_NOOP' : 'OUTCOME_UNKNOWN');
        if (!committed) assert.equal(reconciled.residual_coordinates.state, 'proven_not_committed');
        const generated = f.generations(); const retry = await f.vehicle.run(q, 'apply', p); assert.notEqual(retry.result, 'COMMITTED'); assert.equal(f.generations(), generated);
      });
    }
    for (const scope of ['recovery_nonce', 'ledger:RECOVERY_STARTED', 'ledger:RECOVERED']) {
      for (const edge of fsyncEdges) await t.test('recovery durable fsync fault ' + scope + ':' + edge + ' cannot remint or mutate DB', async () => {
        const f = await fixture({ osFault: scope + ':' + edge }), q = await registryReady(f), p = await f.vehicle.run(q);
        assert.equal((await f.vehicle.run(q, 'apply', p)).result, 'COMMITTED'); const raw = readFileSync(f.vehicle.coordinates.destination); unlinkSync(f.vehicle.coordinates.destination); f.armOsFault();
        const before = digest(await db.grantChangeAudit.findMany()), out = await f.vehicle.run(q, 'recover-delivery', p);
        assert.equal(out.result, 'OUTCOME_UNKNOWN'); assert.equal(out.error_class, 'OS_BOUNDARY_INJECTED'); assert.equal(f.generations(), 1);
        assert.equal(digest(await db.grantChangeAudit.findMany()), before); assert.equal(await db.machineClient.count(), 1);
        const recon = await f.vehicle.run(q, 'reconcile'); assert.equal(recon.result, scope === 'ledger:RECOVERED' ? 'EXACT_RERUN_NOOP' : 'OUTCOME_UNKNOWN');
        if (scope !== 'ledger:RECOVERED') { f.armOsFault(false); assert.equal((await f.vehicle.run(q, 'recover-delivery', p)).result, 'EXACT_RERUN_NOOP'); }
        assert(readFileSync(f.vehicle.coordinates.destination).equals(raw)); assert.equal(f.generations(), 1);
      });
    }
    for (const drift of ['principal-type', 'principal-status', 'principal-ref', 'principal-display', 'principal-agent-id', 'principal-owner', 'client-status', 'client-ref', 'client-binding', 'client-legacy-resource', 'client-legacy-scope', 'client-rotated', 'client-revoked-at', 'grant-scope', 'grant-extra-scope', 'grant-duplicate-scope', 'grant-version', 'grant-missing', 'grant-extra', 'audit-missing', 'audit-extra', 'audit-details', 'audit-source', 'audit-version', 'audience-disabled'] as const) {
      await t.test('exact rerun drift corpus ' + drift + ' refuses adoption, repair and mint', async () => {
        const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q); assert.equal((await f.vehicle.run(q, 'apply', p)).result, 'COMMITTED');
        const [pr] = await db.machinePrincipal.findMany(), [cl] = await db.machineClient.findMany(), [au] = await db.grantChangeAudit.findMany();
        if (drift === 'principal-type') await db.machinePrincipal.update({ where: { id: pr.id }, data: { principalType: 'agent' } });
        if (drift === 'principal-status') await db.machinePrincipal.update({ where: { id: pr.id }, data: { status: 'disabled' } });
        if (drift === 'principal-ref') await db.machinePrincipal.update({ where: { id: pr.id }, data: { externalRef: 'isolated-wrong-ref' } });
        if (drift === 'principal-display') await db.machinePrincipal.update({ where: { id: pr.id }, data: { displayName: 'isolated-drift' } });
        if (drift === 'principal-agent-id') await db.machinePrincipal.update({ where: { id: pr.id }, data: { agentId: 'agt_isolated-drift' } });
        if (drift === 'principal-owner') { const owner = await db.user.create({ data: { name: 'isolated-owner', email: randomUUID()+'@isolated.invalid', password: 'isolated-unused' } }); await db.machinePrincipal.update({ where: { id: pr.id }, data: { ownerUserId: owner.id } }); }
        if (drift === 'client-status') await db.machineClient.update({ where: { id: cl.id }, data: { status: 'revoked' } });
        if (drift === 'client-ref') await db.machineClient.update({ where: { id: cl.id }, data: { externalRef: 'isolated-wrong-ref' } });
        if (drift === 'client-binding') { const other = await db.machinePrincipal.create({ data: { principalType: 'service' } }); await db.machineClient.update({ where: { id: cl.id }, data: { machinePrincipalId: other.id } }); }
        if (drift === 'client-legacy-resource') await db.machineClient.update({ where: { id: cl.id }, data: { allowedResources: [FIXED.resource] } });
        if (drift === 'client-legacy-scope') await db.machineClient.update({ where: { id: cl.id }, data: { allowedScopes: [FIXED.scope] } });
        if (drift === 'client-rotated') await db.machineClient.update({ where: { id: cl.id }, data: { rotatedAt: new Date() } });
        if (drift === 'client-revoked-at') await db.machineClient.update({ where: { id: cl.id }, data: { revokedAt: new Date() } });
        const grantWhere = { machineClientId_audienceId: { machineClientId: cl.id, audienceId: FIXED.resource } };
        if (drift === 'grant-scope') await db.machineAccessGrant.update({ where: grantWhere, data: { scopes: ['conversation.wrong'] } });
        if (drift === 'grant-extra-scope') await db.machineAccessGrant.update({ where: grantWhere, data: { scopes: [FIXED.scope, 'conversation.extra'] } });
        if (drift === 'grant-duplicate-scope') await db.machineAccessGrant.update({ where: grantWhere, data: { scopes: [FIXED.scope, FIXED.scope] } });
        if (drift === 'grant-version') await db.machineAccessGrant.update({ where: grantWhere, data: { version: 2 } });
        if (drift === 'grant-missing') await db.machineAccessGrant.delete({ where: grantWhere });
        if (drift === 'grant-extra') { const other = await db.authAudience.create({ data: { ...AUDIENCE, audienceId: 'isolated-extra-audience' } }); await db.machineAccessGrant.create({ data: { machineClientId: cl.id, audienceId: other.audienceId, scopes: ['isolated.extra'] } }); }
        if (drift === 'audit-missing') await db.grantChangeAudit.delete({ where: { id: au.id } });
        if (drift === 'audit-extra') { const { id, timestamp, ...data } = au; await db.grantChangeAudit.create({ data: { ...data, migrationId: au.migrationId + ':extra', beforeValue: au.beforeValue as any, afterValue: au.afterValue as any } }); }
        if (drift === 'audit-details') await db.grantChangeAudit.update({ where: { id: au.id }, data: { afterValue: { ...(au.afterValue as any), secretHash: cl.secretHash } } });
        if (drift === 'audit-source') await db.grantChangeAudit.update({ where: { id: au.id }, data: { sourceGitCommit: '0'.repeat(40) } });
        if (drift === 'audit-version') await db.grantChangeAudit.update({ where: { id: au.id }, data: { resultingGrantVersion: 2 } });
        if (drift === 'audience-disabled') await db.authAudience.update({ where: { audienceId: FIXED.resource }, data: { status: 'disabled' } });
        const stateBefore = digest([await db.machinePrincipal.findMany(), await db.machineClient.findMany(), await db.machineAccessGrant.findMany(), await db.grantChangeAudit.findMany()]);
        const outputs = [await f.vehicle.run(q), await f.vehicle.run(q, 'verify'), await f.vehicle.run(q, 'reconcile'), await f.vehicle.run(q, 'apply', p)];
        for (const out of outputs) assert(!['COMMITTED', 'EXACT_RERUN_NOOP'].includes(out.result));
        assert.equal(digest([await db.machinePrincipal.findMany(), await db.machineClient.findMany(), await db.machineAccessGrant.findMany(), await db.grantChangeAudit.findMany()]), stateBefore);
        assert.equal(f.generations(), 1); outputSafe(outputs, cl, JSON.parse(readFileSync(f.vehicle.coordinates.destination,'utf8')));
      });
    }
    for (const drift of ['version', 'status', 'freeze', 'principal-types', 'scopes', 'flags', 'missing-audit', 'extra-audit', 'audit-details']) {
      await t.test('registry exact-row/audit drift corpus ' + drift + ' is never repaired', async () => {
        const f = await fixture(), q = req('registry'), p = await f.vehicle.run(q); assert.equal((await f.vehicle.run(q, 'apply', p)).result, 'COMMITTED');
        const where = { audienceId: FIXED.resource };
        if (drift === 'version') await db.authAudience.update({ where, data: { version: 2 } });
        if (drift === 'status') await db.authAudience.update({ where, data: { status: 'disabled' } });
        if (drift === 'freeze') await db.authAudience.update({ where, data: { freezeReady: false } });
        if (drift === 'principal-types') await db.authAudience.update({ where, data: { acceptedPrincipalTypes: ['service', 'agent'] } });
        if (drift === 'scopes') await db.authAudience.update({ where, data: { registeredScopes: [FIXED.scope, 'conversation.extra'] } });
        if (drift === 'flags') await db.authAudience.update({ where, data: { delegatedAccessEnabled: true } });
        if (drift === 'missing-audit') await db.authSecurityAudit.deleteMany();
        const [a] = await db.authSecurityAudit.findMany();
        if (drift === 'extra-audit') { const { id, timestamp, ...data } = a; await db.authSecurityAudit.create({ data: { ...data, details: a.details as any } }); }
        if (drift === 'audit-details') await db.authSecurityAudit.update({ where: { id: a.id }, data: { details: { ...(a.details as any), unapproved: true } } });
        const before = digest([await db.authAudience.findMany(), await db.authSecurityAudit.findMany()]);
        assert.notEqual((await f.vehicle.run(q, 'apply', p)).result, 'COMMITTED'); assert.notEqual((await f.vehicle.run(q, 'verify')).result, 'EXACT_RERUN_NOOP');
        assert.equal(digest([await db.authAudience.findMany(), await db.authSecurityAudit.findMany()]), before); assert.equal(f.generations(), 0);
      });
    }
    await t.test('closed outputs reject additional top-level and nested fields; production trust wrapper cannot be configured by JSON/env', async () => {
      const f = await fixture(), q = req('registry'), p = await f.vehicle.run(q);
      assert.throws(() => validatePublicOutput({ ...p, client_secret: 'forbidden' }));
      assert.throws(() => validatePublicOutput({ ...p, prestate: { ...p.prestate, credential: 'forbidden' } }));
      assert.throws(() => createProductionVehicle());
      assert.throws(() => createProductionVehicle(JSON.parse('{"environment":"production","authorityIssuer":"mayf3","database":{}}')));
      const old = process.env.DATABASE_URL; process.env.DATABASE_URL = 'postgresql://forbidden.invalid/production';
      try { const result = await (await import('../../scripts/supply-mcp-conversation-pilot-v1.js')).cli(['registry', 'apply'], JSON.stringify(q));
        assert.equal(result.error_class, 'TRUST_ADAPTER_UNAVAILABLE'); } finally { if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old; }
      assert.equal(await db.authAudience.count(), 0);
    });
    await t.test('ancestor inode change between admission and generation is detected before secret generation', async () => {
      let root = ''; let armed = false;
      const f = await fixture({ fault: stage => { if (armed && stage === 'before-secret-generation') {
        renameSync(join(root, 'mcp'), join(root, 'mcp-original')); mkdirSync(join(root, 'mcp'), { mode: 0o700 }); chownSync(join(root, 'mcp'), 502, 20);
      } } }); root = f.root;
      const q = await registryReady(f), p = await f.vehicle.run(q); armed = true;
      const out = await f.vehicle.run(q, 'apply', p); assert.equal(out.error_class, 'FILESYSTEM_PREIMAGE_CHANGED');
      assert.equal(f.generations(), 0); assert.equal(await db.machineClient.count(), 0);
      assert.equal((await f.vehicle.run(q, 'reconcile')).residual_coordinates.state, 'proven_not_committed');
    });
    await t.test('complete bystander corpus is byte-preserved and equal in before/precommit/after digests', async () => {
      const f = await fixture();
      const otherAudience = await db.authAudience.create({ data: { ...AUDIENCE, audienceId: 'isolated-bystander', resourceService: 'isolated-bystander' } });
      const p0 = await db.machinePrincipal.create({ data: { principalType: 'service', externalRef: 'isolated-existing-service' } });
      const c0 = await db.machineClient.create({ data: { clientId: 'isolated-existing-client', machinePrincipalId: p0.id, externalRef: 'isolated-existing-client', secretHash: 'isolated-verifier-untouched', allowedResources: ['legacy-resource'], allowedScopes: ['legacy.scope'] } });
      const g0 = await db.machineAccessGrant.create({ data: { machineClientId: c0.id, audienceId: otherAudience.audienceId, scopes: ['isolated.scope'] } });
      const a0 = await db.authSecurityAudit.create({ data: { eventType: 'isolated.bystander', result: 'retained', details: { fixture: true } } });
      const before = digest([p0, c0, g0, a0, otherAudience]);
      const q = await registryReady(f), p = await f.vehicle.run(q), out = await f.vehicle.run(q, 'apply', p);
      assert.equal(out.result, 'COMMITTED', out.error_class);
      const after = digest([await db.machinePrincipal.findUnique({ where: { id: p0.id } }), await db.machineClient.findUnique({ where: { id: c0.id } }),
        await db.machineAccessGrant.findUnique({ where: { machineClientId_audienceId: { machineClientId: c0.id, audienceId: otherAudience.audienceId } } }),
        await db.authSecurityAudit.findUnique({ where: { id: a0.id } }), await db.authAudience.findUnique({ where: { audienceId: otherAudience.audienceId } })]);
      assert.equal(after, before); assert.equal(out.non_target_digest_before, out.non_target_digest_after);
    });
    await t.test('advisory contention observes all six lexical table locks already held', async () => {
      const f = await fixture(), q = req('registry'); let release!: () => void, held!: () => void;
      const ready = new Promise<void>(r => { held = r; }), wait = new Promise<void>(r => { release = r; });
      const holder = db.$transaction(async tx => { await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(813947203)'); held(); await wait; }, { timeout: 5000 });
      await ready; const pending = f.vehicle.run(q);
      let locks: { relname: string }[] = [];
      try {
        for (let n = 0; n < 30; n++) {
          locks = await db.$queryRawUnsafe(`SELECT c.relname FROM pg_locks l JOIN pg_class c ON l.relation=c.oid JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database() AND a.wait_event='advisory' AND l.granted AND l.mode='ShareLock' AND c.relname IN ('auth_audiences','auth_security_audits','grant_change_audits','machine_access_grants','machine_clients','machine_principals') ORDER BY c.relname`);
          if (locks.length === 6) break; await new Promise(r => setTimeout(r, 20));
        }
      } finally { release(); await holder; }
      assert.deepEqual(locks.map(v => v.relname), ['auth_audiences', 'auth_security_audits', 'grant_change_audits', 'machine_access_grants', 'machine_clients', 'machine_principals']);
      assert.equal((await pending).classification, 'ABSENT_APPLY');
    });
    const childProgram = String.raw`
      import fs from 'node:fs';
      import { createIsolatedVehicle, digest } from './scripts/supply-mcp-conversation-pilot-v1.ts';
      import { verifyRuntimeSnapshot } from './src/lib/oauth/v1/contract.ts';
      const { createInterface } = await import('node:readline');
      const control = createInterface({ input: process.stdin, crlfDelay: Infinity }); const iterator = control[Symbol.asyncIterator]();
      const input = JSON.parse((await iterator.next()).value);
      const known = input.authority_request;
      const v = createIsolatedVehicle({ root: input.root, databaseUrl: input.database_url, uid: 502, gid: 20,
        dependencies: async q => { const runtime=JSON.parse(fs.readFileSync('generated/minimal-auth-v1/runtime-contract.json','utf8')); const p=verifyRuntimeSnapshot(runtime);
          return { ...known, executor_uid:502, executor_gid:20, candidate_validated:p.contractVersion==='1.14.0' && runtime.runtimeDigest===q.runtime_digest && p.sourceBundleDigest===q.bundle_digest,
          original_transport_verified:true,native_product_disabled:true,stopped_original_service:true,loaded_candidate_db_aligned:true }; },
        mandate: async(q,action,pd) => digest(q)===digest(known) ? ({issuer:'isolated-independent-owner',actor:known.operator_ref,environment:'isolated-conformance',operation_id:known.operation_id,
          approval_ref:known.approval_ref,approval_digest:known.approval_digest,approval_nonce:known.approval_nonce,plan_digest:pd,action,expires_at:known.expires_at,attempts_max:1,...(action==='recover-delivery'?{recovery_nonce:input.recovery_nonce}:{})}) : undefined,
        fault: async stage => { if(stage==='SECRET_GENERATED') process.stdout.write(JSON.stringify({event:'secret-generated'})+'\n');
          if(stage===input.kill_stage) { process.stdout.write(JSON.stringify({event:'kill-window',stage})+'\n'); if(input.continueable) await iterator.next(); else await new Promise(()=>{}); } }
      });
      const plan=await v.run(input.request); const result=await v.run(input.request,input.action ?? 'apply',plan);
      process.stdout.write(JSON.stringify({event:'result',result})+'\n'); await v.close(); control.close();
    `;
    function child(f: Awaited<ReturnType<typeof fixture>>, q: Request, killStage?: string, action: 'apply' | 'recover-delivery' = 'apply', continueable = false) {
      const proc = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', childProgram], {
        cwd: process.cwd(), env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', reached = false;
      let readyResolve!: () => void, readyReject!: (e: Error) => void;
      const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
      const timer = setTimeout(() => { if (!reached) { proc.kill('SIGKILL'); readyReject(new Error('child did not reach requested persistence stage')); } }, 8000);
      proc.stdout.on('data', b => { stdout += b.toString(); for (const line of stdout.split('\n')) {
        try { const row = JSON.parse(line); if (row.event === 'kill-window') { reached = true; clearTimeout(timer); readyResolve(); } } catch {} } });
      proc.stderr.on('data', b => { stderr += b.toString(); });
      const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }>(resolve => {
        proc.on('close', (code, signal) => { clearTimeout(timer); if (killStage && !reached) readyReject(new Error('child exited before requested stage'));
          resolve({ code, signal, stdout, stderr }); }); });
      const input = JSON.stringify({ root: f.root, database_url: databaseUrl, request: q, authority_request: q, kill_stage: killStage, action, continueable, recovery_nonce: randomUUID() }) + '\n';
      if (continueable) proc.stdin.write(input); else proc.stdin.end(input);
      return { proc, ready, closed };
    }
    function assertChildStreamsSafe(f: Awaited<ReturnType<typeof fixture>>, q: Request, streams: string) {
      assert(!streams.includes('client_secret') && !streams.includes('secretHash'));
      const escrow = join(f.root, 'escrow', 'secret-' + q.operation_id, 'credential.json');
      if (existsSync(escrow)) { const data = JSON.parse(readFileSync(escrow, 'utf8')); for (const value of [data.client_secret, Buffer.from(data.client_secret).toString('base64'), Buffer.from(data.client_secret).toString('hex')]) assert(!streams.includes(value)); }
    }
    for (const stage of ['ATTEMPT_STARTED', 'ESCROW_DURABLE', 'principal', 'client', 'grant', 'audit', 'DESTINATION_DURABLE', 'COMMIT_REQUESTED', 'COMMIT_RESULT']) {
      await t.test('actual SIGKILL/restart at ' + stage + ': read-only authoritative reconcile, original fence and zero remint', async () => {
        const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q), worker = child(f, q, stage);
        await worker.ready; worker.proc.kill('SIGKILL'); const exited = await worker.closed;
        assert.equal(exited.signal, 'SIGKILL'); assertChildStreamsSafe(f, q, exited.stdout + exited.stderr);
        const before = fsFingerprint(f.root), reconcile = await f.vehicle.run(q, 'reconcile'); assert.equal(fsFingerprint(f.root), before);
        const committed = stage === 'COMMIT_RESULT';
        assert.equal(reconcile.result, committed ? 'EXACT_RERUN_NOOP' : 'OUTCOME_UNKNOWN', reconcile.error_class);
        if (!committed) assert.equal(reconcile.residual_coordinates.state, 'proven_not_committed');
        for (const count of [await db.machinePrincipal.count(), await db.machineClient.count(), await db.machineAccessGrant.count(), await db.grantChangeAudit.count()]) assert.equal(count, committed ? 1 : 0);
        const rerun = await f.vehicle.run(q, 'apply', p); assert.equal(rerun.result, committed ? 'EXACT_RERUN_NOOP' : 'REFUSED');
        assert.equal(f.generations(), 0); assertChildStreamsSafe(f, q, JSON.stringify([reconcile, rerun]));
      });
    }
    await t.test('post-SIGKILL committed missing delivery uses fresh mandate to reacquire only dead original lock and original bytes', async () => {
      const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q), worker = child(f, q, 'COMMIT_RESULT');
      await worker.ready; worker.proc.kill('SIGKILL'); const exited = await worker.closed; assert.equal(exited.signal, 'SIGKILL');
      const original = readFileSync(f.vehicle.coordinates.destination); unlinkSync(f.vehicle.coordinates.destination);
      const reconciled = await f.vehicle.run(q, 'reconcile'); assert.equal(reconciled.residual_coordinates.state, 'committed_delivery_incomplete');
      const recovered = await f.vehicle.run(q, 'recover-delivery', p); assert.equal(recovered.result, 'EXACT_RERUN_NOOP', recovered.error_class);
      assert(readFileSync(f.vehicle.coordinates.destination).equals(original)); assert.equal(f.generations(), 0);
      assert.equal(await db.machineClient.count(), 1); assert.equal(await db.grantChangeAudit.count(), 1); assertChildStreamsSafe(f, q, JSON.stringify([reconciled, recovered]));
    });
    await t.test('two real fresh recovery processes interleave under one permanent kernel flock without inode theft', async () => {
      const f = await fixture(), q = await registryReady(f), p = await f.vehicle.run(q); assert.equal((await f.vehicle.run(q,'apply',p)).result,'COMMITTED');
      const original = readFileSync(f.vehicle.coordinates.destination); unlinkSync(f.vehicle.coordinates.destination);
      const lock = join(f.root,'escrow','operation.lock'), beforeInode = lstatSync(lock).ino;
      const fence = join(f.root,'escrow','attempt-'+q.operation_id+'.jsonl'), originalFirst = readFileSync(fence,'utf8').split('\n')[0];
      const a = child(f,q,'RECOVERY_LOCK_ACQUIRED','recover-delivery',true); await a.ready;
      // A real independent OS contender proves the mutex is kernel-held, not a PID check.
      const probe = spawnSync('/usr/bin/python3',['-c',"import os,fcntl,sys;f=os.open(sys.argv[1],os.O_RDWR|os.O_NOFOLLOW)\ntry:\n fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);print('acquired')\nexcept BlockingIOError:print('blocked')",lock]);
      assert.equal(probe.status,0); assert.equal(probe.stdout.toString().trim(),'blocked');
      const b = child(f,q,undefined,'recover-delivery'); const second = await b.closed;
      assert.equal(second.code,0); const secondResult = second.stdout.trim().split('\n').map(line=>JSON.parse(line)).find(row=>row.event==='result').result;
      assert(!['COMMITTED','EXACT_RERUN_NOOP'].includes(secondResult.result)); assert(!existsSync(f.vehicle.coordinates.destination));
      assert.equal(lstatSync(lock).ino,beforeInode); a.proc.stdin.end('continue\n'); const first = await a.closed;
      assert.equal(first.code,0); const firstResult = first.stdout.trim().split('\n').map(line=>JSON.parse(line)).find(row=>row.event==='result').result;
      assert.equal(firstResult.result,'EXACT_RERUN_NOOP',firstResult.error_class); assert(readFileSync(f.vehicle.coordinates.destination).equals(original));
      assert.equal(lstatSync(lock).ino,beforeInode); assert.equal(readFileSync(fence,'utf8').split('\n')[0],originalFirst);
      assert.equal(f.generations(),1); assert.equal(await db.machineClient.count(),1); assert.equal(await db.grantChangeAudit.count(),1);
      assertChildStreamsSafe(f,q,first.stdout+first.stderr+second.stdout+second.stderr);
    });
    await t.test('two actual competing processes produce at most one credential and one four-row effect', async () => {
      const f = await fixture(), q = await registryReady(f), a = child(f, q), b = child(f, q);
      const results = await Promise.all([a.closed, b.closed]);
      for (const r of results) { assert.equal(r.code, 0); assert.equal(r.stderr, ''); assertChildStreamsSafe(f, q, r.stdout); }
      const events = results.flatMap(v => v.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
      assert.equal(events.filter(v => v.event === 'secret-generated').length, 1);
      assert.equal(events.filter(v => v.event === 'result' && v.result.result === 'COMMITTED').length, 1);
      for (const count of [await db.machinePrincipal.count(), await db.machineClient.count(), await db.machineAccessGrant.count(), await db.grantChangeAudit.count()]) assert.equal(count, 1);
      assert.equal((await f.vehicle.run(q, 'reconcile')).result, 'EXACT_RERUN_NOOP');
    });

  } finally { await Promise.all(vehicles.map(v => v.close())); await db.$disconnect(); }
});

test('V2 canonical admission excludes only approval digest and rejects noncanonical values', async () => {
  const v = await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const q: any = { ...request('registry'), schema_version: 2, parent_delegation_id: randomUUID(), parent_delegation_digest: 'a'.repeat(64), phase: 'registry-migrate-agent-v1' };
  delete q.approval_digest;
  assert.equal(v.parseRequest(JSON.stringify(q)).phase, 'registry-migrate-agent-v1');
  assert.throws(() => v.canonical({ n: NaN }));
  assert.throws(() => v.canonical({ n: 1.5 }));
  assert.throws(() => v.canonical({ n: undefined }));
  assert.equal(v.digest({ b: 2, a: 1 }), hash('{"a":1,"b":2}'));
});

test('V2 native frames refuse duplicate/trailing/noncanonical proof and disk-only origin', async () => {
  const v = await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const frame = (s: string) => { const n = Buffer.alloc(4); n.writeUInt32BE(Buffer.byteLength(s)); return Buffer.concat([n, Buffer.from(s)]); };
  assert.throws(() => v.decodeNativeFrame(frame('{"kind":"authentication-result","kind":"authentication-result"}')));
  assert.throws(() => v.decodeNativeFrame(Buffer.concat([frame('{}'), Buffer.from('x')])));
  assert.throws(() => v.decodeNativeFrame(frame('{ "result": "authenticated" }')));
  if (process.getuid?.() !== 0) await assert.rejects(v.openPilotCustody(randomUUID()), /OS_ACTOR_REQUIRED/);
  assert.equal(FIXED.destination, '/Users/yanfenma/.config/read-mcp/native-conversation.service-v1.client.json');
});

test('V2 exact legacy migration, audit rollback, row history and forward disable', { skip: !integration }, async () => {
  const { LEGACY_AUDIENCE } = await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } }, log: [] });
  const root = join(fixtureRoot!, 'case-v2'); mkdirSync(root, { mode: 0o700 }); chownSync(root, 502, 20);
  mkdirSync(join(root, 'escrow'), { mode: 0o700 }); chownSync(join(root, 'escrow'), 0, 0);
  mkdirSync(join(root, 'mcp'), { mode: 0o700 }); chownSync(join(root, 'mcp'), 502, 20);
  let faultAt: string | undefined;
  const dependencies = async (q: Request): Promise<Dependencies> => ({ ...q, executor_uid: 502, executor_gid: 20,
    consumer_disposition_digest: '9'.repeat(64), candidate_validated: true, original_transport_verified: true,
    native_product_disabled: true, stopped_original_service: true, loaded_candidate_db_aligned: true });
  const vehicle = createIsolatedVehicle({ root, databaseUrl: databaseUrl!, uid: 502, gid: 20, dependencies,
    mandate: async (q, action, plan_digest) => ({ issuer: 'isolated-independent-owner', actor: q.operator_ref, environment: q.environment,
      operation_id: q.operation_id, approval_ref: q.approval_ref, approval_digest: q.approval_digest!, approval_nonce: q.approval_nonce,
      plan_digest, action, expires_at: q.expires_at, attempts_max: 1 }), fault: stage => { if (stage === faultAt) throw Error('fixture'); } });
  try {
    await db.$executeRawUnsafe('TRUNCATE auth_audiences, auth_security_audits, grant_change_audits, machine_access_grants, machine_clients, machine_principals CASCADE');
    await db.authAudience.create({ data: { ...LEGACY_AUDIENCE, acceptedPrincipalTypes: ['agent'], registeredScopes: [FIXED.scope] } });
    const oldAudit = await db.authSecurityAudit.create({ data: { eventType: 'legacy.retained', result: 'success', details: { historical: true } } });
    const oldPrincipal=await db.machinePrincipal.create({data:{principalType:'agent',agentId:'agt_isolated-legacy-reader',externalRef:'isolated-legacy-reader',status:'active'}});
    const oldClient=await db.machineClient.create({data:{clientId:'mc_isolated_legacy_fixture',machinePrincipalId:oldPrincipal.id,secretHash:'isolated-not-a-production-verifier',externalRef:'isolated-legacy-reader',status:'active',allowedResources:[],allowedScopes:[]}});
    const oldGrant=await db.machineAccessGrant.create({data:{machineClientId:oldClient.id,audienceId:FIXED.resource,scopes:[FIXED.scope],version:1}});

    const make = (phase: string) => parseRequest(JSON.stringify({ ...request('registry'), schema_version: 2, phase,
      parent_delegation_id: parent, parent_delegation_digest: '8'.repeat(64), approval_nonce: randomBytes(32).toString('base64url') }));
    const parent = randomUUID(); const q = make('registry-migrate-agent-v1');
    const plan = await vehicle.run(q, 'plan'); assert.equal(plan.classification, 'EXACT_AGENT1_MIGRATE');
    assert(!('approval_digest' in plan.request));
    await db.authAudience.update({ where: { audienceId: FIXED.resource }, data: { updatedAt: new Date('2026-10-16T05:40:12.781Z') } });
    assert.equal((await vehicle.run(q, 'apply', plan)).result, 'REFUSED');
    await db.authAudience.update({ where: { audienceId: FIXED.resource }, data: { updatedAt: new Date(LEGACY_AUDIENCE.updatedAt) } });
    const committed = await vehicle.run(q, 'apply', plan); assert.equal(committed.result, 'COMMITTED', JSON.stringify(committed));
    assert.equal(committed.audience_after.version, 2);
    assert.deepEqual(await db.authSecurityAudit.findUnique({ where: { id: oldAudit.id } }), oldAudit);
    assert.equal((await vehicle.run(q, 'verify')).result, 'EXACT_RERUN_NOOP');
    const other = make('registry-migrate-agent-v1'); assert.equal((await vehicle.run(other, 'plan')).classification, 'REFUSED');
    const oldFile=join(root,'mcp','native-conversation.client.json');const oldBytes=Buffer.from('isolated legacy credential fixture retained');writeFileSync(oldFile,oldBytes,{mode:0o600});chownSync(oldFile,502,20);
    const supply=parseRequest(JSON.stringify({...request('supply'),parent_delegation_id:parent,parent_delegation_digest:q.parent_delegation_digest}));
    const sp=await vehicle.run(supply,'plan');assert.equal(sp.classification,'ABSENT_APPLY');
    const created=await vehicle.run(supply,'apply',sp);assert.equal(created.result,'COMMITTED',JSON.stringify(created));assert.equal(created.grant_version,1);assert.deepEqual(readFileSync(oldFile),oldBytes);
    assert.deepEqual(await db.machinePrincipal.findUnique({where:{id:oldPrincipal.id}}),oldPrincipal);
    assert.deepEqual(await db.machineClient.findUnique({where:{id:oldClient.id}}),oldClient);
    assert.deepEqual(await db.machineAccessGrant.findUnique({where:{machineClientId_audienceId:{machineClientId:oldClient.id,audienceId:FIXED.resource}}}),oldGrant);

    const disable = make('registry-disable-migrated'); const dp = await vehicle.run(disable, 'plan'); assert.equal(dp.classification, 'DISABLE_APPLY');
    const disabled = await vehicle.run(disable, 'apply', dp); assert.equal(disabled.result, 'COMMITTED', JSON.stringify(disabled));
    assert.equal(disabled.audience_after.version, 3); assert.deepEqual(disabled.audience_after.acceptedPrincipalTypes, ['service']);
    assert.equal(disabled.audience_after.status, 'disabled'); assert.equal(await db.authSecurityAudit.count(), 3);
    // Audit fault rolls row and audit back together; its spent attempt remains fenced.
    await db.authSecurityAudit.deleteMany({ where: { id: { not: oldAudit.id } } });
    await db.authAudience.update({ where: { audienceId: FIXED.resource }, data: { ...LEGACY_AUDIENCE, acceptedPrincipalTypes: ['agent'], registeredScopes: [FIXED.scope] } });
    const failed = make('registry-migrate-agent-v1'); const fp = await vehicle.run(failed, 'plan'); faultAt = 'audit';
    assert.equal((await vehicle.run(failed, 'apply', fp)).result, 'OUTCOME_UNKNOWN'); faultAt = undefined;
    const retained = await db.authAudience.findUniqueOrThrow({ where: { audienceId: FIXED.resource } });
    assert.equal(retained.version, 1); assert.deepEqual(retained.acceptedPrincipalTypes, ['agent']);
    assert.equal(await db.authSecurityAudit.count(), 1);
    assert.equal((await vehicle.run(failed, 'apply', fp)).result, 'REFUSED');

    assert.deepEqual(await db.authSecurityAudit.findUnique({ where: { id: oldAudit.id } }), oldAudit);
  } finally { await vehicle.close(); await db.$disconnect(); }
});

test('V2 distinct recovery child preserves original request fence and original secret', { skip: !integration }, async () => {
  const db = new PrismaClient({ datasources:{ db:{ url:databaseUrl! } },log:[] });
  const root = join(fixtureRoot!,'case-recovery-v2'); mkdirSync(root,{mode:0o700}); chownSync(root,502,20);
  mkdirSync(join(root,'escrow'),{mode:0o700}); chownSync(join(root,'escrow'),0,0);
  mkdirSync(join(root,'mcp'),{mode:0o700}); chownSync(join(root,'mcp'),502,20);
  let q = parseRequest(JSON.stringify({...request('supply'),expires_at:new Date(Date.now()+2000).toISOString()})); let reconciliation: any; let minted=0;let failCommit=true;
  const vehicle = createIsolatedVehicle({root,databaseUrl:databaseUrl!,uid:502,gid:20,
    dependencies:async request => ({...request,executor_uid:502,executor_gid:20,original_transport_verified:true,native_product_disabled:true,
      candidate_validated:true,stopped_original_service:true,loaded_candidate_db_aligned:true}),
    mandate:async (request,action,plan_digest)=>({issuer:'isolated-independent-owner',actor:request.operator_ref,environment:request.environment,
      operation_id:request.operation_id,approval_ref:request.approval_ref,approval_digest:request.approval_digest!,approval_nonce:request.approval_nonce,
      action,plan_digest,expires_at:request.expires_at,attempts_max:1}), originalSupply:async()=>({request:q,receipt:reconciliation}),
    fault:stage=>{if(stage==='SECRET_GENERATED')minted++;if(stage==='COMMIT_RESULT' && failCommit)throw new Error('lost initial success');} });
  try {
    await db.$executeRawUnsafe('TRUNCATE auth_audiences, auth_security_audits, grant_change_audits, machine_access_grants, machine_clients, machine_principals CASCADE');
    await db.authAudience.create({data:{...AUDIENCE,acceptedPrincipalTypes:['service'],registeredScopes:[FIXED.scope]}});
    const plan=await vehicle.run(q,'plan'); const supplied=await vehicle.run(q,'apply',plan); assert.equal(supplied.result,'OUTCOME_UNKNOWN',JSON.stringify(supplied));failCommit=false;
    const committedClient=await db.machineClient.findFirstOrThrow({where:{externalRef:FIXED.externalRef}});
    await new Promise(resolve=>setTimeout(resolve,2100)); // Same immutable request is now expired; readonly reconciliation still reports DB truth.
    const oldFence=readFileSync(join(root,'escrow','attempt-'+q.operation_id+'.jsonl'));
    const verifier=(await db.machineClient.findUniqueOrThrow({where:{id:committedClient.id}})).secretHash;
    unlinkSync(vehicle.coordinates.destination); reconciliation=await vehicle.run(q,'reconcile'); assert.equal(reconciliation.error_class,'COMMITTED_DELIVERY_INCOMPLETE');
    const recovery:any={schema_version:2,phase:'recover-delivery',parent_delegation_id:q.parent_delegation_id,parent_delegation_digest:q.parent_delegation_digest,
      operation_id:randomUUID(),original_supply_operation_id:q.operation_id,original_supply_request_digest:digest(q),original_supply_receipt_digest:digest(reconciliation),
      source_commit:q.source_commit,spec_ref:q.spec_ref,spec_digest:q.spec_digest,operator_ref:q.operator_ref,approval_ref:'isolated:recovery-mandate',
      approval_nonce:randomBytes(32).toString('base64url'),created_at:new Date().toISOString(),expires_at:new Date(Date.now()+300000).toISOString()};
    const rp=await vehicle.run(JSON.stringify(recovery),'plan'); assert.equal(rp.classification,'COMMITTED_DELIVERY_INCOMPLETE',JSON.stringify(rp));
    const recovered=await vehicle.run(JSON.stringify({...recovery,approval_digest:'7'.repeat(64)}),'recover-delivery',rp);
    assert.equal(recovered.result,'RECOVERED',JSON.stringify(recovered)); assert.equal(minted,1);
    assert.equal((await db.machineClient.findUniqueOrThrow({where:{id:committedClient.id}})).secretHash,verifier);
    assert.deepEqual(readFileSync(join(root,'escrow','attempt-'+q.operation_id+'.jsonl')),oldFence);
    const current=await vehicle.run(q,'verify');assert.equal(current.result,'EXACT_RERUN_NOOP');
    const {validateRecoveredSupplyCompletion}=await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
    const signedRecovery={...recovery,approval_digest:'7'.repeat(64)};
    const originalFence=oldFence.toString().trim().split('\n').map(line=>JSON.parse(line));
    const completion=validateRecoveredSupplyCompletion(q,plan,reconciliation,signedRecovery,rp,recovered,current,originalFence);
    assert.equal(completion.operation_id,q.operation_id);assert.equal(completion.recovery_operation_id,recovery.operation_id);
    const release=await import('../../scripts/start-auth-mcp-release-v1.js');
    const fsNode=await import('node:fs'),cp=await import('node:child_process');
    const releaseRoot=join(root,'release-window'),opDir=join(releaseRoot,'operation');
    for(const p of [releaseRoot,opDir,join(releaseRoot,'claims')]){mkdirSync(p,{mode:0o700});chownSync(p,0,0);}
    const stop={window_id:randomUUID(),operation_id:randomUUID(),parent_digest:q.parent_delegation_digest,
      actor:{pid:process.pid,start_time:cp.execFileSync('/bin/ps',['-p',String(process.pid),'-o','lstart='],{encoding:'utf8'}).trim(),start_nonce:randomBytes(32).toString('base64url'),actor_ref:q.operator_ref},
      began_at:new Date().toISOString(),observed_at:new Date().toISOString(),excluded_writers:['isolated-recovery-test'],no_listener:true,drained:true,old_processes_exited:true,window_plan_digest:'1'.repeat(64)};
    const sealed=(p:string,v:unknown)=>{writeFileSync(p,typeof v==='string'?v:release.canonical(v),{mode:0o600});chownSync(p,0,0);};
    sealed(join(opDir,'stop.json'),stop);sealed(join(opDir,'journal.jsonl'),'');sealed(join(releaseRoot,'claims','supply.json'),{operation_id:q.operation_id});
    let conflicting=true;
    const end=await release.openIsolatedOuterWindowEndFixture({root:releaseRoot,operationDirectory:opDir,assertHeld:()=>{},completionReader:async()=>
      validateRecoveredSupplyCompletion(q,plan,reconciliation,signedRecovery,rp,conflicting?{...recovered,original_supply_operation_id:randomUUID()}:recovered,await vehicle.run(q,'reconcile'),originalFence)});
    await assert.rejects(()=>end.finish('completed'));assert.equal(fsNode.statSync(join(opDir,'window-end.json')).size,0);conflicting=false;
    const windowFd=fsNode.openSync(join(opDir,'window-end.json'),'r');
    const ack=(async()=>{for(let i=0;i<100;i++){const observed=release.readWindowEnd(windowFd,stop);if(observed.state==='sealed'){
      sealed(join(opDir,'journal.jsonl'),release.canonical({sequence:1,operation_id:stop.operation_id,parent_digest:stop.parent_digest,stage:'WINDOW_END_ACK',evidence:{window_end_digest:observed.digest}})+'\n');return;}
      await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('no sealed recovery handoff');})();
    try{const ended=await end.finish('completed');await ack;assert.equal((ended.phase_b as any).operation_id,q.operation_id);assert.equal(ended.result,'completed');}finally{fsNode.closeSync(windowFd);}
    assert.deepEqual(readFileSync(join(root,'escrow','attempt-'+q.operation_id+'.jsonl')),oldFence);assert.equal(minted,1);

    assert.throws(()=>validateRecoveredSupplyCompletion(q,plan,reconciliation,signedRecovery,rp,{...recovered,original_supply_operation_id:randomUUID()},current,originalFence));
    assert.throws(()=>validateRecoveredSupplyCompletion(q,plan,reconciliation,signedRecovery,rp,recovered,{...current,client_row_id:randomUUID()},originalFence));
    assert.throws(()=>validateRecoveredSupplyCompletion(q,plan,reconciliation,signedRecovery,rp,recovered,current,[{...originalFence[0],approval_nonce:randomBytes(32).toString('base64url')},...originalFence.slice(1)]));
    assert.equal((await vehicle.run(JSON.stringify(signedRecovery),'reconcile')).result,'RECOVERED');
    assert.equal((await vehicle.run(JSON.stringify({...recovery,approval_digest:'7'.repeat(64)}),'recover-delivery',rp)).result,'REFUSED');
  } finally {await vehicle.close();await db.$disconnect();}
});

test('V2 custody storage has one fixed capability claim, immutable revoke and no native proof', { skip: !integration }, async () => {
  const { isolatedCustodyStorage } = await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const root=join(fixtureRoot!,'case-custody');mkdirSync(root,{mode:0o700});chownSync(root,502,20);
  const storage=isolatedCustodyStorage(root);
  storage.call('initialize',{records:{'intent.json':'{}','authentication.json':'{"result":"storage-fixture-not-authentication"}',
    'delegation.json':'{}','producer.json':'{}','artifact-manifest.json':'{}'}});
  const operation=randomUUID();
  const args={capability:'supply',operation,claim:JSON.stringify({operation_id:operation}),records:{'mandate.json':'{}','plan.json':'{}','stages.jsonl':'{"stage":"ISSUED"}\n'}};
  storage.call('allocate',args);
  assert.throws(()=>storage.call('allocate',{...args,operation:randomUUID()}),/CUSTODY_INTEGRITY_FAILURE/);
  assert.equal(storage.call('read-child',{capability:'supply'}).claim.operation_id,operation);
  storage.call('revoke',{record:'{"reason":"EXECUTOR_STOP"}'});
  assert.equal(storage.call('read-parent').revoked,true);
  assert.throws(()=>storage.call('revoke',{record:'{"reason":"INTEGRITY_FAILURE"}'}));
  const claim=join(root,'mcp-pilot-v2',storage.id,'claims','supply.json');
  const saved=readFileSync(claim);unlinkSync(claim);symlinkSync('/dev/null',claim);
  assert.throws(()=>storage.call('read-child',{capability:'supply'}));
  unlinkSync(claim);writeFileSync(claim,saved,{mode:0o600});
  assert.equal(storage.call('read-parent')['authentication.json'],'{"result":"storage-fixture-not-authentication"}');
  const concurrent=(operation:string)=>({...args,capability:'candidate-load',operation,claim:JSON.stringify({operation_id:operation})});
  const contenders=await Promise.allSettled([storage.concurrentAllocate(concurrent(randomUUID())),storage.concurrentAllocate(concurrent(randomUUID()))]);
  assert.equal(contenders.filter(v=>v.status==='fulfilled').length,1);
  assert.equal(contenders.filter(v=>v.status==='rejected').length,1);
  const partialOperation=randomUUID();
  const partial={...args,capability:'recover-delivery',operation:partialOperation,claim:JSON.stringify({operation_id:partialOperation}),records:{'missing/record':'{}'}};
  assert.throws(()=>storage.call('allocate',partial));
  assert.throws(()=>storage.call('allocate',{...args,capability:'recover-delivery',operation:randomUUID()}));
  assert.throws(()=>storage.call('read-child',{capability:'recover-delivery'}));

});

test('V2 revision cross-parent reservation survives both early claim crash boundaries', { skip: !integration }, async () => {
  const { isolatedCapabilityLedger } = await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const root=join(fixtureRoot!,'case-cross-parent');mkdirSync(root,{mode:0o700});chownSync(root,502,20);
  mkdirSync(join(root,'escrow'),{mode:0o700});chownSync(join(root,'escrow'),0,0);
  mkdirSync(join(root,'mcp'),{mode:0o700});chownSync(join(root,'mcp'),502,20);
  const ledger=isolatedCapabilityLedger(root);
  const {isolatedCustodyStorage}=await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const storage=isolatedCustodyStorage(root);storage.call('initialize',{records:{}});
  const operation=randomUUID(),dependencyRecord={plan_digest:'d'.repeat(64),witness:{observed_at:'frozen'},dependencies:{receipt_digest:'a'.repeat(64)}};
  storage.call('prepare',{operation,record:JSON.stringify(dependencyRecord)});
  storage.call('witness-append',{operation,record:JSON.stringify({observed_at:'first'})});
  storage.call('witness-append',{operation,record:JSON.stringify({observed_at:'second'})});
  assert.deepEqual(storage.call('read-dependencies',{operation}),dependencyRecord);
  assert.deepEqual(storage.call('witness-read',{operation}),[{observed_at:'first'},{observed_at:'second'}]);
  for(const capability of ['supply','registry-migrate-agent-v1']) {
    const a={parent_delegation_id:randomUUID(),operation_id:randomUUID(),capability,child_digest:'a'.repeat(64)};
    await ledger.reserve(a); // Crash before parent claim/child; or after admission before original attempt fence.
    const bytes=readFileSync(join(root,'escrow','pilot-capability-'+capability+'.json'));
    await assert.rejects(()=>ledger.reserve({...a,parent_delegation_id:randomUUID(),operation_id:randomUUID()}));
    assert.deepEqual(readFileSync(join(root,'escrow','pilot-capability-'+capability+'.json')),bytes);
    assert.throws(()=>ledger.verify({...a,parent_delegation_id:randomUUID()}));
    ledger.verify(a);
  }
});

test('V2 revision same frozen dependency accepts refreshed witness and rejects expired effect/drift', async () => {
  const {validateWitnessRefresh}=await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const q=parseRequest(JSON.stringify(request('supply')));
  const parent:any={delegation_id:q.parent_delegation_id,executor_ref:q.operator_ref,source_commit:q.source_commit,artifact_digest:'e'.repeat(64),expires_at:q.expires_at};
  const old:any={schema_version:2,parent_delegation_id:q.parent_delegation_id,operation_id:q.operation_id,kind:'alignment',original_receipt_digest:q.runtime_preimage_receipt_digest,
    producer_ref:q.operator_ref,producer_start_nonce:randomBytes(32).toString('base64url'),source_commit:q.source_commit,artifact_digest:parent.artifact_digest,projection_digest:'d'.repeat(64),
    observed_at:new Date(Date.now()-6000).toISOString(),valid_until:new Date(Date.now()-1000).toISOString(),window_id:randomUUID(),verified_unchanged:true};
  assert.throws(()=>validateWitnessRefresh(old,old,parent,q));
  const before=JSON.stringify(q),fresh={...old,observed_at:new Date().toISOString(),valid_until:new Date(Date.now()+4000).toISOString()};
  assert.deepEqual(validateWitnessRefresh(old,fresh,parent,q),fresh);assert.equal(JSON.stringify(q),before);
  assert.throws(()=>validateWitnessRefresh(old,{...fresh,projection_digest:'f'.repeat(64)},parent,q));
  assert.throws(()=>validateWitnessRefresh(old,{...fresh,producer_start_nonce:randomBytes(32).toString('base64url')},parent,q));
  assert.throws(()=>validateWitnessRefresh(old,fresh,{...parent,expires_at:new Date(Date.now()-1).toISOString()},q));
});


test('V2 preparation brand permits only original frozen same-process coordinates', async () => {
  const {preparePilotCoordinates,validatePilotPreparation}=await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  const prepared=preparePilotCoordinates();assert.doesNotThrow(()=>validatePilotPreparation(prepared));
  assert(Object.isFrozen(prepared));assert.throws(()=>validatePilotPreparation({...prepared}));
  assert.throws(()=>validatePilotPreparation(Object.freeze({...prepared,preimageDirectory:'/private/tmp/caller-selected'})));
});

// Only the two final review counterexamples; origin in this disposable fixture is synthetic.
async function finalDeltaFixture(name:string,phase:'supply'|'registry-migrate-agent-v1') {
  const root=join(fixtureRoot!,'case-final-'+name);mkdirSync(root,{mode:0o700});chownSync(root,502,20);
  for(const [name,uid,gid] of [['escrow',0,0],['mcp',502,20]] as const){mkdirSync(join(root,name),{mode:0o700});chownSync(join(root,name),uid,gid);}
  const db=new PrismaClient({datasources:{db:{url:databaseUrl!}},log:[]});
  await db.$executeRawUnsafe('TRUNCATE auth_audiences, auth_security_audits, grant_change_audits, machine_access_grants, machine_clients, machine_principals CASCADE');
  const module=await import('../../scripts/supply-mcp-conversation-pilot-v1.js');
  await db.authAudience.create({data:phase==='supply'?{...AUDIENCE,acceptedPrincipalTypes:['service'],registeredScopes:[FIXED.scope]}:
    {...module.LEGACY_AUDIENCE,acceptedPrincipalTypes:['agent'],registeredScopes:[FIXED.scope]}});
  const q=parseRequest(JSON.stringify({...request(phase==='supply'?'supply':'registry'),phase,expires_at:new Date(Date.now()+1800).toISOString()}));
  const parent:any={delegation_id:q.parent_delegation_id,executor_ref:q.operator_ref,source_commit:q.source_commit,artifact_digest:'a'.repeat(64),expires_at:q.expires_at};
  q.parent_delegation_digest=digest(parent);
  let minted=0;let failCommit=false;let recordedReads=0;
  const d:any={...q,executor_uid:502,executor_gid:20,consumer_disposition_digest:'9'.repeat(64),original_transport_verified:true,native_product_disabled:true,candidate_validated:true,stopped_original_service:true,loaded_candidate_db_aligned:true};
  const options:any={root,databaseUrl:databaseUrl!,uid:502,gid:20,
    dependencies:async (_q:Request,mode?:string)=>{if(mode==='recorded')recordedReads++;return d;},
    mandate:async (r:Request,action:string,plan_digest:string)=>({issuer:'isolated-independent-owner',actor:r.operator_ref,environment:r.environment,operation_id:r.operation_id,approval_ref:r.approval_ref,approval_digest:r.approval_digest,approval_nonce:r.approval_nonce,action,plan_digest,expires_at:r.expires_at,attempts_max:1}),
    fault:(stage:string)=>{if(stage==='SECRET_GENERATED')minted++;if(stage==='COMMIT_RESULT'&&failCommit)throw Error('lost terminal');}};
  return {root,db,q,d,parent,module,options,vehicle:createIsolatedVehicle(options),fail:()=>{failCommit=true;},counts:()=>({minted,recordedReads})};
}
test('V2 final delta fresh expired migration readonly loads immutable consumer provenance', {skip:!integration},async()=>{
  const f=await finalDeltaFixture('migration','registry-migrate-agent-v1');let fresh:any;
  try {
    const plan=await f.vehicle.run(f.q,'plan');assert.equal((await f.vehicle.run(f.q,'apply',plan)).result,'COMMITTED');
    await f.vehicle.close();await new Promise(r=>setTimeout(r,1900));
    const storage=f.module.isolatedCustodyStorage(f.root),producer='6'.repeat(64),producerNonce=randomBytes(32).toString('base64url');
    storage.call('initialize',{records:{'intent.json':'{}','authentication.json':'{}','delegation.json':'{}','producer.json':'{}','artifact-manifest.json':'{}'}});
    const depKeys=['environment','source_commit','spec_ref','spec_digest','audience_authority_ref','audience_authority_digest','bundle_digest','runtime_digest','runtime_preimage_receipt_ref','runtime_preimage_receipt_digest','operator_ref','executor_uid','executor_gid','original_transport_verified','native_product_disabled','candidate_validated','stopped_original_service','loaded_candidate_db_aligned','stop_serving_receipt_ref','stop_serving_receipt_digest','consumer_disposition_digest'];
    const record:any={schema_version:2,parent_delegation_id:f.q.parent_delegation_id,operation_id:f.q.operation_id,producer_digest:producer,dependencies:Object.fromEntries(depKeys.map(k=>[k,f.d[k]])),
      witness:{schema_version:2,parent_delegation_id:f.q.parent_delegation_id,operation_id:f.q.operation_id,kind:'stop',original_receipt_digest:f.q.stop_serving_receipt_digest,producer_ref:f.q.operator_ref,producer_start_nonce:producerNonce,source_commit:f.q.source_commit,artifact_digest:f.parent.artifact_digest,projection_digest:'3'.repeat(64),observed_at:f.q.created_at,valid_until:f.q.expires_at,window_id:randomUUID(),verified_unchanged:true}};
    storage.call('prepare',{operation:f.q.operation_id,record:JSON.stringify(record)});
    const recorded:any={child:{plan_digest:plan.plan_digest},plan,childDigest:f.q.approval_digest};
    const load=(e:any)=>f.module.validateRecordedPilotDependencies(e,f.parent,producer,producerNonce,f.q,recorded);
    assert.throws(()=>load({...record,producer_digest:'0'.repeat(64)}));assert.throws(()=>load({...record,operation_id:randomUUID()}));
    assert.throws(()=>load({...record,witness:{...record.witness,producer_start_nonce:randomBytes(32).toString('base64url')}}));
    fresh=createIsolatedVehicle({...f.options,dependencies:async(q:Request,mode:string)=>{assert.equal(mode,'recorded');await f.options.dependencies(q,mode);return load(storage.call('read-dependencies',{operation:q.operation_id}));},mandate:async()=>{throw Error('readonly must not authorize');}});
    const fence=readFileSync(join(f.root,'escrow','attempt-'+f.q.operation_id+'.jsonl'));
    const priorReads=f.counts().recordedReads;const exact=await fresh.run(f.q,'reconcile');assert.equal(exact.result,'EXACT_RERUN_NOOP',JSON.stringify(exact));
    assert.equal(f.counts().recordedReads,priorReads+1);assert.equal((await fresh.run(f.q,'verify')).result,'EXACT_RERUN_NOOP');
    record.dependencies.consumer_disposition_digest='7'.repeat(64);writeFileSync(join(f.root,'mcp-pilot-v2',storage.id,f.q.operation_id,'dependencies.json'),JSON.stringify(record));assert.notEqual((await fresh.run(f.q,'reconcile')).result,'EXACT_RERUN_NOOP');
    assert.deepEqual(readFileSync(join(f.root,'escrow','attempt-'+f.q.operation_id+'.jsonl')),fence);
    assert.equal(await f.db.authSecurityAudit.count(),1);
  }finally{await fresh?.close();await f.vehicle.close();await f.db.$disconnect();}
});
test('V2 final delta delivered lost terminal reconciles through actual window end ACK', {skip:!integration},async()=>{
  const f=await finalDeltaFixture('delivered','supply');
  try {
    const plan=await f.vehicle.run(f.q,'plan');f.fail();assert.equal((await f.vehicle.run(f.q,'apply',plan)).result,'OUTCOME_UNKNOWN');
    const fencePath=join(f.root,'escrow','attempt-'+f.q.operation_id+'.jsonl'),fenceBytes=readFileSync(fencePath),fence=fenceBytes.toString().trim().split('\n').map(v=>JSON.parse(v));
    const destination=readFileSync(f.vehicle.coordinates.destination),client=await f.db.machineClient.findFirstOrThrow();
    const current=await f.vehicle.run(f.q,'reconcile');assert.equal(current.result,'EXACT_RERUN_NOOP');
    const validate=(f.module as any).validateReconciledSupplyCompletion;assert.equal(typeof validate,'function');
    const child={operation_id:f.q.operation_id,plan_digest:plan.plan_digest,approval_nonce:f.q.approval_nonce,parent_delegation_id:f.q.parent_delegation_id,parent_delegation_digest:f.q.parent_delegation_digest};
    const completion=validate(f.q,plan,current,fence,null,[],child);assert.equal(completion.result,'EXACT_RERUN_NOOP');assert.equal(completion.completion_basis,'authoritative_reconciliation');
    assert.throws(()=>validate(f.q,plan,{...current,audit_id:randomUUID()},fence,{...current,result:'COMMITTED'},[],child));
    assert.throws(()=>validate(f.q,plan,current,fence,null,[],{...child,approval_nonce:randomBytes(32).toString('base64url')}));
    assert.throws(()=>validate(f.q,plan,current,[{...fence[0],request_digest:'0'.repeat(64)}],null,[],child));
    assert.throws(()=>validate(f.q,plan,current,fence,null,[{stage:'COMMITTED',evidence_digest:'0'.repeat(64)}],child));
    const release=await import('../../scripts/start-auth-mcp-release-v1.js'),fsNode=await import('node:fs'),cp=await import('node:child_process');
    const releaseRoot=join(f.root,'release-window'),opDir=join(releaseRoot,'operation');
    for(const p of [releaseRoot,opDir,join(releaseRoot,'claims')]){mkdirSync(p,{mode:0o700});chownSync(p,0,0);}
    const stop={window_id:randomUUID(),operation_id:randomUUID(),parent_digest:f.q.parent_delegation_digest,actor:{pid:process.pid,start_time:cp.execFileSync('/bin/ps',['-p',String(process.pid),'-o','lstart='],{encoding:'utf8'}).trim(),start_nonce:randomBytes(32).toString('base64url'),actor_ref:f.q.operator_ref},began_at:new Date().toISOString(),observed_at:new Date().toISOString(),excluded_writers:['isolated-final-delta'],no_listener:true,drained:true,old_processes_exited:true,window_plan_digest:'1'.repeat(64)};
    const sealed=(p:string,v:unknown)=>{writeFileSync(p,typeof v==='string'?v:release.canonical(v),{mode:0o600});chownSync(p,0,0);};
    sealed(join(opDir,'stop.json'),stop);sealed(join(opDir,'journal.jsonl'),'');sealed(join(releaseRoot,'claims','supply.json'),{operation_id:f.q.operation_id});
    let conflict=true;
    const end=await release.openIsolatedOuterWindowEndFixture({root:releaseRoot,operationDirectory:opDir,assertHeld:()=>{},completionReader:async()=>validate(f.q,plan,await f.vehicle.run(f.q,'reconcile'),fence,null,[],conflict?{...child,operation_id:randomUUID()}:child)});
    await assert.rejects(()=>end.finish('completed'));assert.equal(fsNode.statSync(join(opDir,'window-end.json')).size,0);conflict=false;
    const fd=fsNode.openSync(join(opDir,'window-end.json'),'r');
    const ack=(async()=>{for(let i=0;i<100;i++){const observed=release.readWindowEnd(fd,stop);if(observed.state==='sealed'){sealed(join(opDir,'journal.jsonl'),release.canonical({sequence:1,operation_id:stop.operation_id,parent_digest:stop.parent_digest,stage:'WINDOW_END_ACK',evidence:{window_end_digest:observed.digest}})+'\n');return;}await new Promise(r=>setTimeout(r,20));}throw Error('ACK missing');})();
    try{const ended=await end.finish('completed');await ack;assert.equal((ended.phase_b as any).operation_id,f.q.operation_id);}finally{fsNode.closeSync(fd);}
    assert.equal(f.counts().minted,1);assert.equal(await f.db.machineClient.count(),1);assert.equal(await f.db.grantChangeAudit.count(),1);
    assert.equal((await f.db.machineClient.findFirstOrThrow()).secretHash,client.secretHash);assert.deepEqual(readFileSync(f.vehicle.coordinates.destination),destination);assert.deepEqual(readFileSync(fencePath),fenceBytes);
    const audit=await f.db.grantChangeAudit.findFirstOrThrow();await f.db.grantChangeAudit.update({where:{id:audit.id},data:{reason:'isolated-audit-tamper'}});
    const conflictingAudit=await f.vehicle.run(f.q,'reconcile');assert.notEqual(conflictingAudit.result,'EXACT_RERUN_NOOP');assert.throws(()=>validate(f.q,plan,conflictingAudit,fence,null,[],child));
  }finally{await f.vehicle.close();await f.db.$disconnect();}
});
