import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  importCanonicalSubjectPacket,
  applyCanonicalSubjectPlan,
  hashCanonical,
  planCanonicalSubjectEnrollment,
  reconcileCanonicalSubjectOutcome,
  verifyCanonicalSubjectOperation,
  type CanonicalSubjectEvidenceProvider,
  type CanonicalSubjectReadStore,
} from '../../src/lib/oauth/v1/canonical-subject-enrollment.js';
import { requireTrustedCanonicalSubjectEvidenceProvider, runCanonicalSubjectEnrollmentCli } from '../../scripts/canonical-subject-enrollment.js';

const id = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const digest = (c: string) => c.repeat(64);
const now = new Date('2026-09-16T12:00:00.000Z');

function activation(n = 1, overrides: Record<string, unknown> = {}) {
  return {
    mutationKey: `attestation-${String(n).padStart(3, '0')}`,
    operation: 'ACTIVATE_ATTESTATION',
    subjectAttestationId: id(1000 + n),
    businessSubjectId: id(2000 + n),
    subjectType: 'agent',
    businessSubjectDescription: `isolated subject ${n}`,
    target: { machinePrincipalId: id(n), canonicalAgentId: `agt_isolated-${n}` },
    authoritySource: 'owner-packet@exact',
    attestedBy: { kind: 'user', id: id(900) },
    authority: {
      kind: 'owner_exact', ref: `owner:decision:${n}`, digest: digest('a'),
      requestedOperation: 'activate', intendedDisposition: 'active',
    },
    effectiveAt: '2026-09-16T11:00:00.000Z',
    evidenceRef: `isolated-evidence-${n}`,
    ...overrides,
  };
}

function packet(mutations: unknown[] = [activation()]) {
  return {
    packetVersion: '1',
    operationId: id(800),
    environment: 'isolated-test',
    actorRef: `user:${id(900)}`,
    authorityRef: 'owner:packet:exact',
    authorityDigest: digest('b'),
    sourceArtifacts: [{ ref: 'ledger:isolated', digest: digest('c') }],
    mutations,
    createdAt: '2026-09-16T11:30:00.000Z',
    expiresAt: '2026-09-16T12:30:00.000Z',
  };
}

function store(change: Partial<CanonicalSubjectReadStore> = {}): CanonicalSubjectReadStore {
  return {
    readFoundationState: async () => ({ installed: true }),
    readTarget: async target => target.machinePrincipalId
      ? { kind: 'machine_principal', id: target.machinePrincipalId, principalType: 'agent', status: 'active', agentId: target.canonicalAgentId, lifecycleState: 'canonical', lifecycleRevision: '1', outgoingSuccessor: false }
      : { kind: 'user', id: target.userId!, status: 'active' },
    readAttestation: async () => null,
    readSourceBinding: async () => null,
    readSourceBindingById: async () => null,
    readCurrentSourceBindingsForAttestation: async () => [],
    readDelegation: async () => null,
    readAgentLifecycle: async () => null,
    readSuccessor: async () => null,
    readIncomingSuccessorCount: async () => 0,
    readActiveAttestationsForMachinePrincipal: async () => [],
    readCommittedOperation: async () => null,
    readOperationAuthorityManifest: async () => [],
    ...change,
  };
}

function evidence(change: Partial<CanonicalSubjectEvidenceProvider> = {}): CanonicalSubjectEvidenceProvider {
  return {
    validatePacketAuthority: async input => ({ valid: true, authorityDigest: input.authorityDigest }),
    validateAttestationAuthority: async entry => ({ valid: true, authorityDigest: entry.authorityDigest }),
    validateCoreAgent: async target => ({ valid: true, evidenceDigest: digest('d'), principalId: target.machinePrincipalId!, agentId: target.canonicalAgentId!, expiresAt: '2026-09-16T12:10:00.000Z' }),
    validateSourceExit: async () => ({ valid: true, zeroLive: true, evidenceDigest: digest('e') }),
    validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: digest('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true }),
    ...change,
  };
}

function committed(plan: Awaited<ReturnType<typeof planCanonicalSubjectEnrollment>>, change: Record<string, unknown> = {}) {
  return {
    operationId: plan.operationId, environment: plan.environment, actorRef: plan.actorRef,
    packetDigest: plan.packetDigest, authorityDigest: plan.authorityDigest,
    prestateDigest: plan.prestateDigest, planDigest: plan.planDigest,
    authorityManifestDigest: plan.authorityManifestDigest,
    poststateDigest: plan.expectedPoststateDigest, mutationCounts: plan.mutationCounts,
    committedAt: '2026-09-16T12:00:30.000Z', ...change,
  };
}

async function rejects(code: string, fn: Promise<unknown>) {
  await assert.rejects(fn, error => {
    assert.equal((error as { code?: string }).code, code);
    assert.deepEqual(Object.keys(error as object).sort(), ['code', 'field', 'recordKey', 'status']);
    return true;
  });
}

test('controlled CLI cannot convert caller-authored files into authority', async () => {
  assert.throws(() => requireTrustedCanonicalSubjectEvidenceProvider(), error => {
    assert.deepEqual(error, { code: 'AUTHORITY_NOT_ACCEPTED', status: 409, recordKey: null, field: 'trustedEvidenceProvider' });
    return true;
  });
  const trusted = evidence();
  assert.equal(requireTrustedCanonicalSubjectEvidenceProvider(trusted), trusted);
  const root = mkdtempSync(join(tmpdir(), 'canonical-subject-cli-'));
  try {
    const packetPath = join(root, 'packet.json');
    writeFileSync(packetPath, JSON.stringify(packet()));
    await rejects('AUTHORITY_NOT_ACCEPTED', runCanonicalSubjectEnrollmentCli(['node', 'canonical-subject-enrollment', 'plan', '--packet', packetPath]));
  }
  finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('IMPORT is deterministic, strict and supports the 73/89/147 packet shape', () => {
  const first = importCanonicalSubjectPacket(packet([activation(2), activation(1)]));
  const second = importCanonicalSubjectPacket(JSON.parse(first.canonicalJson));
  assert.equal(first.packetDigest, second.packetDigest);
  assert.equal(first.canonicalJson, second.canonicalJson);
  assert.deepEqual(first.packet.mutations.map(m => m.mutationKey), ['attestation-001', 'attestation-002']);

  const subjects = Array.from({ length: 73 }, (_, i) => activation(i + 1, {
    subjectType: i === 72 ? 'human' : 'agent',
    target: i === 72 ? { userId: id(7000) } : { machinePrincipalId: id(i + 1), canonicalAgentId: `agt_isolated-${i + 1}` },
  }));
  const bindings = Array.from({ length: 89 }, (_, i) => ({
    mutationKey: `binding-${String(i + 1).padStart(3, '0')}`,
    operation: 'ACTIVATE_SOURCE_BINDING',
    sourceBindingId: id(5000 + i), sourceNamespace: 'isolated', sourceLocalValue: `opaque-${i}`,
    subjectAttestationId: subjects[i % subjects.length].subjectAttestationId,
    effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: `row-count:${i === 0 ? 59 : 1}`,
    expectedRevision: null,
  }));
  const large = importCanonicalSubjectPacket(packet([...subjects, ...bindings]));
  assert.equal(large.packet.mutations.length, 162);
  assert.equal(large.packet.mutations.filter(mutation => mutation.operation === 'ACTIVATE_ATTESTATION' && mutation.subjectType === 'agent').length, 72);
  assert.equal(large.packet.mutations.filter(mutation => mutation.operation === 'ACTIVATE_ATTESTATION' && mutation.subjectType === 'human').length, 1);
  assert.equal(large.packet.mutations.filter(mutation => mutation.operation === 'ACTIVATE_SOURCE_BINDING').length, 89);
  assert.equal(large.packet.mutations.filter(mutation => mutation.operation === 'ACTIVATE_SOURCE_BINDING').reduce((total, mutation) => total + Number(mutation.evidenceRef.split(':').at(-1)), 0), 147);

  assert.throws(() => importCanonicalSubjectPacket({ ...packet(), unexpected: true }), (e: any) => e.code === 'INVALID_PACKET');
  assert.throws(() => importCanonicalSubjectPacket(packet([activation(), activation()])), (e: any) => e.code === 'INVALID_PACKET');
  assert.throws(() => importCanonicalSubjectPacket(packet([activation(1, { target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1', displayName: 'forbidden' } })])), (e: any) => e.code === 'INVALID_PACKET');
});

test('IMPORT rejects duplicate mutation targets and logical source keys', () => {
  const duplicateCases: unknown[][] = [
    [
      { mutationKey: 'revoke-a', operation: 'REVOKE_ATTESTATION', subjectAttestationId: id(1001), businessSubjectId: id(2001), subjectType: 'agent', target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1' }, authority: { kind: 'owner_exact', ref: 'owner:revoke', digest: digest('a'), requestedOperation: 'revoke', intendedDisposition: 'revoked' }, expectedRevision: '1', evidenceRef: 'revoke' },
      { mutationKey: 'revoke-b', operation: 'REVOKE_ATTESTATION', subjectAttestationId: id(1001), businessSubjectId: id(2001), subjectType: 'agent', target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1' }, authority: { kind: 'owner_exact', ref: 'owner:revoke', digest: digest('a'), requestedOperation: 'revoke', intendedDisposition: 'revoked' }, expectedRevision: '1', evidenceRef: 'revoke' },
    ],
    [
      { mutationKey: 'delegation-a', operation: 'REVOKE_ATTESTATION_DELEGATION', delegationId: id(3001), expectedRevision: '1', revocationAuthorityRef: 'owner:revoke', revocationAuthorityDigest: digest('a') },
      { mutationKey: 'delegation-b', operation: 'REVOKE_ATTESTATION_DELEGATION', delegationId: id(3001), expectedRevision: '1', revocationAuthorityRef: 'owner:revoke', revocationAuthorityDigest: digest('a') },
    ],
    [
      { mutationKey: 'lifecycle-a', operation: 'TRANSITION_AGENT_LIFECYCLE', principalId: id(3), fromState: 'legacy', toState: 'retired', expectedRevision: '1', authorityRef: 'owner:retire', authorityDigest: digest('a'), evidenceRef: 'retire' },
      { mutationKey: 'lifecycle-b', operation: 'TRANSITION_AGENT_LIFECYCLE', principalId: id(3), fromState: 'legacy', toState: 'retired', expectedRevision: '1', authorityRef: 'owner:retire', authorityDigest: digest('a'), evidenceRef: 'retire' },
    ],
    [
      { mutationKey: 'exit-a', operation: 'EXIT_SOURCE_BINDING', sourceBindingId: id(4001), sourceNamespace: 'isolated', sourceLocalValue: 'same', expectedRevision: '1', exitEvidenceRef: 'owner:zero' },
      { mutationKey: 'exit-b', operation: 'EXIT_SOURCE_BINDING', sourceBindingId: id(4001), sourceNamespace: 'isolated', sourceLocalValue: 'same', expectedRevision: '1', exitEvidenceRef: 'owner:zero' },
    ],
    [
      { mutationKey: 'binding-a', operation: 'ACTIVATE_SOURCE_BINDING', sourceBindingId: id(4101), sourceNamespace: 'isolated', sourceLocalValue: 'same-logical-key', subjectAttestationId: id(1001), effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'row-a', expectedRevision: null },
      { mutationKey: 'binding-b', operation: 'ACTIVATE_SOURCE_BINDING', sourceBindingId: id(4102), sourceNamespace: 'isolated', sourceLocalValue: 'same-logical-key', subjectAttestationId: id(1002), effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'row-b', expectedRevision: null },
    ],
  ];
  for (const mutations of duplicateCases)
    assert.throws(() => importCanonicalSubjectPacket(packet(mutations)), (error: any) => error.code === 'INVALID_PACKET');
});

test('PLAN validates exact typed targets without labels or Agent projection', async () => {
  const imported = importCanonicalSubjectPacket(packet());
  const plan = await planCanonicalSubjectEnrollment(imported, store(), evidence(), { now });
  assert.equal(plan.disposition, 'APPLY');
  assert.equal(plan.authorityManifest.length, 1);
  assert.equal(plan.authorityManifest[0].requestedOperation, 'activate');
  assert.equal(plan.mutationCounts.ACTIVATE_ATTESTATION, 1);

  await rejects('TARGET_TYPE_MISMATCH', planCanonicalSubjectEnrollment(imported, store({ readTarget: async target => ({ kind: 'machine_principal', id: target.machinePrincipalId!, principalType: 'service', status: 'active', agentId: null, lifecycleState: null, lifecycleRevision: null, outgoingSuccessor: false }) }), evidence(), { now }));
  await rejects('TARGET_INACTIVE', planCanonicalSubjectEnrollment(imported, store({ readTarget: async target => ({ kind: 'machine_principal', id: target.machinePrincipalId!, principalType: 'agent', status: 'disabled', agentId: target.canonicalAgentId!, lifecycleState: 'canonical', lifecycleRevision: '1', outgoingSuccessor: false }) }), evidence(), { now }));
  await rejects('TARGET_NOT_FOUND', planCanonicalSubjectEnrollment(imported, store({ readTarget: async () => null }), evidence(), { now }));
  await rejects('TARGET_PAIR_MISMATCH', planCanonicalSubjectEnrollment(imported, store({ readTarget: async target => ({ kind: 'machine_principal', id: target.machinePrincipalId!, principalType: 'agent', status: 'active', agentId: 'different-exact-id', lifecycleState: 'canonical', lifecycleRevision: '1', outgoingSuccessor: false }) }), evidence(), { now }));
  await rejects('NON_CANONICAL_AGENT_TARGET', planCanonicalSubjectEnrollment(imported, store({ readTarget: async target => ({ kind: 'machine_principal', id: target.machinePrincipalId!, principalType: 'agent', status: 'active', agentId: target.canonicalAgentId!, lifecycleState: 'legacy', lifecycleRevision: '1', outgoingSuccessor: false }) }), evidence(), { now }));
  await rejects('TARGET_AUTHORITY_INCONSISTENT', planCanonicalSubjectEnrollment(imported, store(), evidence({ validateCoreAgent: async () => ({ valid: false }) }), { now }));

  const human = importCanonicalSubjectPacket(packet([activation(1, { subjectType: 'human', target: { userId: id(7000) } })]));
  const humanPlan = await planCanonicalSubjectEnrollment(human, store(), evidence({ validateCoreAgent: async () => { throw new Error('HUMAN must not query Core'); } }), { now });
  assert.equal(humanPlan.authorityManifest[0].subjectType, 'human');
  assert.equal(humanPlan.authorityManifest[0].target.userId, id(7000));

  const service = importCanonicalSubjectPacket(packet([activation(1, { subjectType: 'service', target: { machinePrincipalId: id(4) } })]));
  const servicePlan = await planCanonicalSubjectEnrollment(service, store({ readTarget: async target => ({ kind: 'machine_principal', id: target.machinePrincipalId!, principalType: 'service', status: 'active', agentId: null, lifecycleState: null, lifecycleRevision: null, outgoingSuccessor: false }) }), evidence({ validateCoreAgent: async () => { throw new Error('SERVICE must not query Core'); } }), { now });
  assert.equal(servicePlan.authorityManifest[0].target.canonicalAgentId, undefined);
});

test('actor attribution is not authority and operation/scope/time failures are closed', async () => {
  const imported = importCanonicalSubjectPacket(packet());
  for (const code of ['ATTESTATION_AUTHORITY_MISSING', 'ATTESTATION_AUTHORITY_INVALID', 'ATTESTATION_AUTHORITY_OUT_OF_SCOPE', 'ATTESTATION_AUTHORITY_REVOKED', 'ATTESTATION_AUTHORITY_EXPIRED', 'ATTESTATION_AUTHORITY_OPERATION_MISMATCH'] as const) {
    await rejects(code, planCanonicalSubjectEnrollment(imported, store(), evidence({ validateAttestationAuthority: async () => ({ valid: false, code }) }), { now }));
  }
  const mismatch = importCanonicalSubjectPacket(packet([activation(1, { authority: { kind: 'owner_exact', ref: 'owner:x', digest: digest('a'), requestedOperation: 'revoke', intendedDisposition: 'revoked' } })]));
  await rejects('ATTESTATION_AUTHORITY_OPERATION_MISMATCH', planCanonicalSubjectEnrollment(mismatch, store(), evidence(), { now }));
  const actorMismatch = importCanonicalSubjectPacket(packet([activation(1, { attestedBy: { kind: 'user', id: id(901) } })]));
  await rejects('ATTESTATION_AUTHORITY_INVALID', planCanonicalSubjectEnrollment(actorMismatch, store(), evidence(), { now }));

  const delegated = importCanonicalSubjectPacket(packet([activation(1, { authority: { kind: 'delegated', ref: 'owner:delegation', digest: digest('a'), requestedOperation: 'activate', intendedDisposition: 'active', delegationId: id(3001), delegationRevision: '1' } })]));
  const validDelegation = { delegationId: id(3001), status: 'active' as const, revision: '1', delegatedActorRef: `user:${id(900)}`, authorizedSubjectType: 'agent' as const, authorizedBusinessSubjectIds: [id(2001)], authorizedOperations: ['activate' as const], effectiveAt: '2026-09-16T11:00:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z' };
  assert.equal((await planCanonicalSubjectEnrollment(delegated, store({ readDelegation: async () => validDelegation }), evidence(), { now })).disposition, 'APPLY');
  await rejects('ATTESTATION_AUTHORITY_OUT_OF_SCOPE', planCanonicalSubjectEnrollment(delegated, store({ readDelegation: async () => ({ ...validDelegation, authorizedBusinessSubjectIds: [id(2999)] }) }), evidence(), { now }));
  await rejects('ATTESTATION_AUTHORITY_REVOKED', planCanonicalSubjectEnrollment(delegated, store({ readDelegation: async () => ({ ...validDelegation, status: 'revoked' }) }), evidence(), { now }));
});

test('PLAN rejects expired packet, stale state and malformed heterogeneous authority manifest', async () => {
  await rejects('PLAN_EXPIRED', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket({ ...packet(), expiresAt: '2026-09-16T11:59:59.000Z' }), store(), evidence(), { now }));
  await rejects('ATTESTATION_CONFLICT', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet()), store({ readAttestation: async () => ({ subjectAttestationId: id(1001), businessSubjectId: id(2001), subjectType: 'agent', target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1' }, status: 'active', revision: '1' }) }), evidence(), { now }));
  const heterogeneous = importCanonicalSubjectPacket(packet([
    activation(1),
    activation(2, { authority: { kind: 'accepted_governing_authority', ref: 'spec:exact', digest: digest('9'), requestedOperation: 'activate', intendedDisposition: 'active' } }),
  ]));
  const plan = await planCanonicalSubjectEnrollment(heterogeneous, store(), evidence(), { now });
  assert.deepEqual(plan.authorityManifest.map(e => e.authorityKind), ['owner_exact', 'accepted_governing_authority']);
  assert.equal(plan.authorityManifestDigest.length, 64);
  const reversedManifest = [...plan.authorityManifest].reverse();
  const changed = { ...plan, authorityManifest: reversedManifest, authorityManifestDigest: hashCanonical(reversedManifest) };
  const { planDigest: _discard, authorityManifest: _discardManifest, ...basis } = changed;
  const tampered = { ...changed, planDigest: hashCanonical(basis) };
  let attempts = 0;
  await rejects('ATTESTATION_AUTHORITY_MANIFEST_MISMATCH', applyCanonicalSubjectPlan(heterogeneous, tampered, evidence(), { $transaction: async () => { attempts++; throw new Error('must not start'); } } as any, { now }));
  assert.equal(attempts, 0);
});

test('OUTCOME_UNKNOWN reconciliation never retries and requires operation plus exact poststate', async () => {
  const imported = importCanonicalSubjectPacket(packet());
  const plan = await planCanonicalSubjectEnrollment(imported, store(), evidence(), { now });
  let calls = 0;
  const exact = store({ readCommittedOperation: async () => {
    calls++;
    return committed(plan);
  }, readAttestation: async () => ({ subjectAttestationId: id(1001), businessSubjectId: id(2001), subjectType: 'agent', target: { machinePrincipalId: id(1), canonicalAgentId: 'agt_isolated-1' }, status: 'active', revision: '1' }) });
  assert.deepEqual(await reconcileCanonicalSubjectOutcome(plan, exact), { result: 'PASS', operationId: plan.operationId, committed: true });
  assert.equal(calls, 1);
  assert.deepEqual(await reconcileCanonicalSubjectOutcome(plan, store()), { result: 'OUTCOME_UNKNOWN', operationId: plan.operationId, committed: false });
  await rejects('VERIFY_MISMATCH', reconcileCanonicalSubjectOutcome(plan, store({ readCommittedOperation: async () => committed(plan, { poststateDigest: digest('0') }) })));
});

test('source binding supersession remains live and EXIT requires exact zero-live evidence', async () => {
  const predecessor = { sourceBindingId: id(4001), sourceNamespace: 'isolated', sourceLocalValue: 'old-live', subjectAttestationId: id(1001), status: 'active' as const, revision: '1' };
  const attestation = { subjectAttestationId: id(1004), businessSubjectId: id(2004), subjectType: 'service' as const, target: { machinePrincipalId: id(4) }, status: 'active' as const, revision: '1' };
  const supersede = {
    mutationKey: 'binding-supersede', operation: 'SUPERSEDE_SOURCE_BINDING',
    predecessorSourceBindingId: id(4001), replacementSourceBindingId: id(4002),
    sourceNamespace: 'isolated', sourceLocalValue: 'old-live', subjectAttestationId: id(1004),
    effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'replacement', supersessionEvidenceRef: 'owner:replacement', expectedPredecessorRevision: '1',
  };
  const plan = await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([supersede])), store({ readSourceBindingById: async () => predecessor, readAttestation: async () => attestation }), evidence(), { now });
  assert.equal(plan.mutationCounts.SUPERSEDE_SOURCE_BINDING, 1);
  assert.equal(JSON.stringify(plan).includes('exited'), false);

  const exit = { mutationKey: 'binding-exit', operation: 'EXIT_SOURCE_BINDING', sourceBindingId: id(4001), sourceNamespace: 'isolated', sourceLocalValue: 'old-live', expectedRevision: '1', exitEvidenceRef: 'owner:zero-live' };
  let observedEvidenceRef: string | undefined;
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([exit])), store({ readSourceBindingById: async () => predecessor }), evidence({ validateSourceExit: async input => {
    observedEvidenceRef = input.evidenceRef;
    return { valid: input.evidenceRef === 'owner:zero-live', zeroLive: true, evidenceDigest: digest('e') };
  } }), { now })).disposition, 'APPLY');
  assert.equal(observedEvidenceRef, 'owner:zero-live');
  await rejects('SOURCE_BINDING_CONFLICT', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([{ ...exit, exitEvidenceRef: 'owner:wrong' }])), store({ readSourceBindingById: async () => predecessor }), evidence({ validateSourceExit: async input => ({ valid: input.evidenceRef === 'owner:zero-live', zeroLive: true, evidenceDigest: digest('e') }) }), { now }));
  await rejects('SOURCE_BINDING_CONFLICT', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([exit])), store({ readSourceBindingById: async () => predecessor }), evidence({ validateSourceExit: async () => ({ valid: true, zeroLive: false, evidenceDigest: digest('e') }) }), { now }));
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([exit])), store({ readSourceBindingById: async () => predecessor }), evidence(), { now })).disposition, 'APPLY');

  const activatePlanned = { mutationKey: 'binding-activate', operation: 'ACTIVATE_SOURCE_BINDING', sourceBindingId: id(4003), sourceNamespace: 'isolated', sourceLocalValue: 'planned', subjectAttestationId: id(1004), effectiveAt: '2026-09-16T11:00:00.000Z', evidenceRef: 'planned-binding', expectedRevision: '1' };
  const planned = { sourceBindingId: id(4003), status: 'planned' as const, revision: '1' };
  const activationPlan = await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([activatePlanned])), store({ readSourceBinding: async () => planned, readAttestation: async () => attestation }), evidence(), { now });
  assert.equal(activationPlan.expectedPoststateDigest.length, 64);
  await rejects('REVISION_CONFLICT', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([{ ...activatePlanned, expectedRevision: '2' }])), store({ readSourceBinding: async () => planned, readAttestation: async () => attestation }), evidence(), { now }));

  const exitPlan = await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([exit])), store({ readSourceBindingById: async () => predecessor }), evidence(), { now });
  const exitedStore = store({
    readSourceBindingById: async () => ({ ...predecessor, status: 'exited', revision: '2' }),
    readCommittedOperation: async () => committed(exitPlan),
  });
  assert.equal((await verifyCanonicalSubjectOperation(exitPlan, exitedStore, evidence({ validateSourceExit: async () => ({ valid: true, zeroLive: false, evidenceDigest: digest('e') }) }), { observedAt: now })).result, 'FAIL');
});

test('delegation install/revoke is exact and cannot wildcard or resurrect', async () => {
  const install = {
    mutationKey: 'delegation-install', operation: 'INSTALL_ATTESTATION_DELEGATION', delegationId: id(3001),
    delegatedActor: { kind: 'user', id: id(901) }, authorizedSubjectType: 'agent',
    authorizedBusinessSubjectIds: [id(2001)], authorizedOperations: ['activate'],
    ownerAuthorityRef: 'owner:delegation', ownerAuthorityDigest: digest('d'),
    effectiveAt: '2026-09-16T11:00:00.000Z', expiresAt: '2026-09-16T13:00:00.000Z',
  };
  const normalized = importCanonicalSubjectPacket(packet([{ ...install, authorizedBusinessSubjectIds: [id(2002), id(2001)], authorizedOperations: ['supersede', 'activate'] }]));
  const reordered = importCanonicalSubjectPacket(packet([{ ...install, authorizedBusinessSubjectIds: [id(2001), id(2002)], authorizedOperations: ['activate', 'supersede'] }]));
  assert.equal(normalized.packetDigest, reordered.packetDigest);
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([install])), store(), evidence(), { now })).disposition, 'APPLY');
  assert.throws(() => importCanonicalSubjectPacket(packet([{ ...install, unexpectedScope: '*' }])), (error: any) => error.code === 'INVALID_PACKET');
  assert.throws(() => importCanonicalSubjectPacket(packet([{ ...install, authorizedBusinessSubjectIds: [id(2001), id(2001)] }])), (error: any) => error.code === 'INVALID_PACKET');
  await rejects('ATTESTATION_AUTHORITY_INVALID', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([{ ...install, delegatedActor: { kind: 'user', id: id(900) } }])), store(), evidence(), { now }));
  const current = { delegationId: id(3001), status: 'active' as const, revision: '1', delegatedActorRef: `user:${id(901)}`, authorizedSubjectType: 'agent' as const, authorizedBusinessSubjectIds: [id(2001)], authorizedOperations: ['activate' as const], effectiveAt: install.effectiveAt, expiresAt: install.expiresAt };
  const revoke = { mutationKey: 'delegation-revoke', operation: 'REVOKE_ATTESTATION_DELEGATION', delegationId: id(3001), expectedRevision: '1', revocationAuthorityRef: 'owner:revoke', revocationAuthorityDigest: digest('e') };
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([revoke])), store({ readDelegation: async () => current }), evidence(), { now })).disposition, 'APPLY');
  await rejects('ATTESTATION_AUTHORITY_REVOKED', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([revoke])), store({ readDelegation: async () => ({ ...current, status: 'revoked' }) }), evidence(), { now }));
});

test('legacy retirement requires all five CTR-AICP-007 predicates and no state is inferred', async () => {
  const transition = {
    mutationKey: 'lifecycle-retire', operation: 'TRANSITION_AGENT_LIFECYCLE', principalId: id(3),
    fromState: 'legacy', toState: 'retired', expectedRevision: '1', authorityRef: 'owner:retirement', authorityDigest: digest('f'), evidenceRef: 'isolated-retirement',
    predicates: { liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true },
  };
  const lifecycleStore = store({
    readAgentLifecycle: async principalId => ({ principalId, state: principalId === id(1) ? 'canonical' : 'legacy', revision: '1' }),
    readSuccessor: async principalId => principalId === id(3) ? { sourcePrincipalId: id(3), targetPrincipalId: id(1) } : null,
    readTarget: async target => ({ kind: 'machine_principal', id: target.machinePrincipalId!, principalType: 'agent', status: 'active', agentId: 'agt_isolated-1', lifecycleState: 'canonical', lifecycleRevision: '1', outgoingSuccessor: false }),
  });
  const failures = [
    { liveWritableReferences: 1 }, { activeWorkOwnerReferences: 1 }, { activeGrantsRequired: 1 },
    { activeClientRequired: 1 }, { successorMappingVerified: false },
  ];
  for (const failure of failures) {
    await rejects('AUTHORITY_NOT_ACCEPTED', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([transition])), lifecycleStore, evidence({ validateLifecyclePredicates: async () => ({ valid: true, evidenceDigest: digest('f'), liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true, ...failure }) }), { now }));
  }
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([transition])), lifecycleStore, evidence(), { now })).disposition, 'APPLY');
  const resurrection = { ...transition, fromState: 'retired', toState: 'canonical', expectedRevision: '2', canonicalAgentId: 'agt_isolated-3' };
  await rejects('AUTHORITY_NOT_ACCEPTED', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([resurrection])), store({ readAgentLifecycle: async principalId => ({ principalId, state: 'retired', revision: '2' }) }), evidence(), { now }));
});

test('Agent lifecycle matrix permits only the frozen cross-state transitions', async () => {
  const make = (fromState: 'absent' | 'unresolved' | 'legacy' | 'canonical' | 'retired', toState: 'canonical' | 'legacy' | 'retired') => ({
    mutationKey: `lifecycle-${fromState}-${toState}`, operation: 'TRANSITION_AGENT_LIFECYCLE', principalId: id(3),
    canonicalAgentId: toState === 'canonical' ? 'agt_isolated-3' : undefined,
    fromState, toState, expectedRevision: fromState === 'absent' ? null : '1', authorityRef: 'owner:lifecycle', authorityDigest: digest('f'), evidenceRef: 'isolated-lifecycle',
    predicates: { liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true },
  });
  const matrixStore = (state: 'absent' | 'unresolved' | 'legacy' | 'canonical' | 'retired') => store({
    readAgentLifecycle: async principalId => principalId === id(3) ? (state === 'absent' ? null : { principalId, state, revision: '1' }) : { principalId, state: 'canonical', revision: '1' },
    readTarget: async target => ({ kind: 'machine_principal', id: target.machinePrincipalId!, principalType: 'agent', status: 'active', agentId: target.machinePrincipalId === id(3) ? 'agt_isolated-3' : 'agt_isolated-1', lifecycleState: target.machinePrincipalId === id(3) ? (state === 'absent' ? null : state) : 'canonical', lifecycleRevision: state === 'absent' ? null : '1', outgoingSuccessor: target.machinePrincipalId === id(3) && ['canonical', 'legacy'].includes(state) && false }),
    readSuccessor: async principalId => ['legacy', 'canonical'].includes(state) && principalId === id(3) ? { sourcePrincipalId: id(3), targetPrincipalId: id(1) } : null,
  });
  const allowed = [
    ['absent', 'canonical'], ['unresolved', 'canonical'], ['absent', 'legacy'], ['unresolved', 'legacy'],
    ['legacy', 'canonical'], ['legacy', 'retired'], ['canonical', 'legacy'], ['canonical', 'retired'],
  ] as const;
  for (const [fromState, toState] of allowed)
    assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([make(fromState, toState)])), matrixStore(fromState), evidence(), { now })).disposition, 'APPLY', `${fromState}>${toState}`);
  for (const [fromState, toState] of [['absent', 'retired'], ['unresolved', 'retired'], ['retired', 'canonical'], ['retired', 'legacy']] as const)
    await rejects('AUTHORITY_NOT_ACCEPTED', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([make(fromState, toState)])), matrixStore(fromState), evidence(), { now }));
  const activeAttestation = { subjectAttestationId: id(1003), businessSubjectId: id(2003), subjectType: 'agent' as const, target: { machinePrincipalId: id(3), canonicalAgentId: 'agt_isolated-3' }, status: 'active' as const, revision: '1' };
  await rejects('ATTESTATION_CONFLICT', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([make('canonical', 'legacy')])), store({
    ...matrixStore('canonical'), readActiveAttestationsForMachinePrincipal: async () => [activeAttestation],
  }), evidence(), { now }));
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([make('canonical', 'canonical')])), matrixStore('canonical'), evidence(), { now })).disposition, 'NOOP');
});

test('explicit successor requires legacy/retired source and canonical target', async () => {
  const mutation = { mutationKey: 'successor', operation: 'INSTALL_EXPLICIT_SUCCESSOR', sourcePrincipalId: id(3), targetPrincipalId: id(1), authorityRef: 'owner:historical-equivalence', authorityDigest: digest('7'), evidenceRef: 'frozen-successor' };
  const valid = store({ readAgentLifecycle: async principalId => ({ principalId, state: principalId === id(3) ? 'legacy' : 'canonical', revision: '1' }) });
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([mutation])), valid, evidence(), { now })).disposition, 'APPLY');
  const canonical = store({ readAgentLifecycle: async principalId => ({ principalId, state: 'canonical', revision: '1' }) });
  await rejects('AUTHORITY_NOT_ACCEPTED', planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([mutation])), canonical, evidence(), { now }));
  const retire = {
    mutationKey: 'retire', operation: 'TRANSITION_AGENT_LIFECYCLE', principalId: id(3), fromState: 'canonical', toState: 'retired', expectedRevision: '1',
    authorityRef: 'owner:retirement', authorityDigest: digest('f'), evidenceRef: 'isolated-retirement',
    predicates: { liveWritableReferences: 0, activeWorkOwnerReferences: 0, activeGrantsRequired: 0, activeClientRequired: 0, successorMappingVerified: true },
  };
  assert.equal((await planCanonicalSubjectEnrollment(importCanonicalSubjectPacket(packet([retire, mutation])), canonical, evidence(), { now })).disposition, 'APPLY');
});

test('APPLY maps serialization and uncertain transport once without automatic retry', async () => {
  const imported = importCanonicalSubjectPacket(packet());
  const plan = await planCanonicalSubjectEnrollment(imported, store(), evidence(), { now });
  for (const [providerCode, expected] of [['P2034', 'SERIALIZATION_FAILURE'], ['P1001', 'OUTCOME_UNKNOWN']] as const) {
    let attempts = 0;
    const db: any = { $transaction: async () => { attempts++; throw { code: providerCode }; } };
    await rejects(expected, applyCanonicalSubjectPlan(imported, plan, evidence(), db, { now }));
    assert.equal(attempts, 1);
  }
});
