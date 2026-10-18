import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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
    schema_version: 1, phase, operation_id: randomUUID(), environment: 'isolated-conformance',
    source_commit: process.env.MCS_TEST_SOURCE_COMMIT ?? '6cf266386d815f5c822ce3d59905209210efb29b',
    spec_ref: 'AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1@6cf266386d815f5c822ce3d59905209210efb29b',
    spec_digest: 'df5ff4c536da553f16d0a5dce8658cd660082d4f0b8c37a303f71c29a33e2f2e',
    audience_authority_ref: 'AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1@6cf266386d815f5c822ce3d59905209210efb29b',
    audience_authority_digest: 'b6f62aed763d5a25f1b08e5e6a811137bf251c0252ba62fbade45b651ab98d6c',
    bundle_digest: 'a'.repeat(64), runtime_digest: 'b'.repeat(64),
    runtime_preimage_receipt_ref: 'isolated:original-source-receipt', runtime_preimage_receipt_digest: 'c'.repeat(64),
    operator_ref: 'isolated:original-auth-owner', approval_ref: 'isolated:owner-mandate',
    approval_digest: 'd'.repeat(64), approval_nonce: randomUUID(),
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
import { spawn } from 'node:child_process';
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
    await reset();
    const root = join(fixtureRoot!, 'case-' + (++index)); mkdirSync(root, { mode: 0o700 }); chownSync(root, 502, 20);
    mkdirSync(join(root, 'escrow'), { mode: 0o700 }); chownSync(join(root, 'escrow'), 0, 0);
    mkdirSync(join(root, 'mcp'), { mode: 0o700 }); chownSync(join(root, 'mcp'), 502, 20);
    let approved = true; let stopped = true; let aligned = true; let pin = true; let generations = 0;
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
    const vehicle = createIsolatedVehicle(opts); vehicles.push(vehicle);
    return { vehicle, root, setApproved: (v: boolean) => { approved = v; }, setStopped: (v: boolean) => { stopped = v; },
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
        const out = await f.vehicle.run(q, 'apply', p); assert.notEqual(out.result, 'COMMITTED');
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
      const input = JSON.parse(fs.readFileSync(0, 'utf8'));
      const known = input.authority_request;
      const v = createIsolatedVehicle({ root: input.root, databaseUrl: input.database_url, uid: 502, gid: 20,
        dependencies: async q => { const runtime=JSON.parse(fs.readFileSync('generated/minimal-auth-v1/runtime-contract.json','utf8')); const p=verifyRuntimeSnapshot(runtime);
          return { ...known, executor_uid:502, executor_gid:20, candidate_validated:p.contractVersion==='1.14.0' && runtime.runtimeDigest===q.runtime_digest && p.sourceBundleDigest===q.bundle_digest,
          original_transport_verified:true,native_product_disabled:true,stopped_original_service:true,loaded_candidate_db_aligned:true }; },
        mandate: async(q,action,pd) => digest(q)===digest(known) ? ({issuer:'isolated-independent-owner',actor:known.operator_ref,environment:'isolated-conformance',operation_id:known.operation_id,
          approval_ref:known.approval_ref,approval_digest:known.approval_digest,approval_nonce:known.approval_nonce,plan_digest:pd,action,expires_at:known.expires_at,attempts_max:1}) : undefined,
        fault: async stage => { if(stage==='SECRET_GENERATED') process.stdout.write(JSON.stringify({event:'secret-generated'})+'\n');
          if(stage===input.kill_stage) { process.stdout.write(JSON.stringify({event:'kill-window',stage})+'\n'); await new Promise(()=>{}); } }
      });
      const plan=await v.run(input.request); const result=await v.run(input.request,'apply',plan);
      process.stdout.write(JSON.stringify({event:'result',result})+'\n'); await v.close();
    `;
    function child(f: Awaited<ReturnType<typeof fixture>>, q: Request, killStage?: string) {
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
      proc.stdin.end(JSON.stringify({ root: f.root, database_url: databaseUrl, request: q, authority_request: q, kill_stage: killStage }));
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
