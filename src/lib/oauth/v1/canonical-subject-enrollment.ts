/** Controlled canonical-subject enrollment vehicle. No HTTP or startup integration. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../prisma.js';

export const canonicalSubjectErrorCodes = [
  'INVALID_PACKET', 'PACKET_DIGEST_MISMATCH', 'AUTHORITY_NOT_ACCEPTED',
  'FOUNDATION_NOT_INSTALLED', 'TARGET_NOT_FOUND', 'TARGET_TYPE_MISMATCH',
  'TARGET_PAIR_MISMATCH', 'NON_CANONICAL_AGENT_TARGET', 'TARGET_INACTIVE',
  'TARGET_AUTHORITY_INCONSISTENT', 'ATTESTATION_AUTHORITY_MISSING',
  'ATTESTATION_AUTHORITY_INVALID', 'ATTESTATION_AUTHORITY_OUT_OF_SCOPE',
  'ATTESTATION_AUTHORITY_REVOKED', 'ATTESTATION_AUTHORITY_EXPIRED',
  'ATTESTATION_AUTHORITY_OPERATION_MISMATCH', 'ATTESTATION_AUTHORITY_MANIFEST_MISMATCH',
  'ATTESTATION_CONFLICT', 'SOURCE_BINDING_CONFLICT', 'REVISION_CONFLICT',
  'PRESTATE_CHANGED', 'PLAN_EXPIRED', 'IDEMPOTENCY_CONFLICT',
  'SERIALIZATION_FAILURE', 'LOCK_TIMEOUT', 'AUDIT_WRITE_FAILED',
  'VERIFY_MISMATCH', 'OUTCOME_UNKNOWN',
] as const;
export type CanonicalSubjectErrorCode = typeof canonicalSubjectErrorCodes[number];
export type CanonicalSubjectError = {
  code: CanonicalSubjectErrorCode;
  status: 400 | 404 | 409 | 503;
  recordKey: string | null;
  field: string | null;
};

function fail(code: CanonicalSubjectErrorCode, recordKey: string | null = null, field: string | null = null, status: CanonicalSubjectError['status'] = 409): never {
  throw { code, status, recordKey, field } satisfies CanonicalSubjectError;
}
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const nonempty = z.string().trim().min(1);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const instant = z.string().datetime({ offset: true });
const agentId = z.string().min(1).max(256); // Exact opaque value; grammar is not authority.

const actorSchema = z.object({
  kind: z.enum(['user', 'machine_principal', 'external_authority']),
  id: nonempty,
}).strict();
const targetSchema = z.object({
  machinePrincipalId: uuid.optional(),
  userId: uuid.optional(),
  canonicalAgentId: agentId.optional(),
}).strict();
const authoritySchema = z.object({
  kind: z.enum(['owner_exact', 'delegated', 'accepted_governing_authority']),
  ref: nonempty,
  digest: sha256,
  requestedOperation: z.enum(['activate', 'supersede', 'revoke']),
  intendedDisposition: z.enum(['active', 'superseded', 'revoked']),
  delegationId: uuid.optional(),
  delegationRevision: z.string().regex(/^[1-9][0-9]*$/).optional(),
}).strict();
const baseMutation = z.object({ mutationKey: nonempty });
const activateAttestationSchema = baseMutation.extend({
  operation: z.literal('ACTIVATE_ATTESTATION'),
  subjectAttestationId: uuid,
  businessSubjectId: uuid,
  subjectType: z.enum(['agent', 'human', 'service']),
  businessSubjectDescription: nonempty,
  target: targetSchema,
  authoritySource: nonempty,
  attestedBy: actorSchema,
  authority: authoritySchema,
  effectiveAt: instant,
  evidenceRef: nonempty,
}).strict();
const supersedeAttestationSchema = activateAttestationSchema.extend({
  operation: z.literal('SUPERSEDE_ATTESTATION'),
  predecessorAttestationId: uuid,
  expectedPredecessorRevision: z.string().regex(/^[1-9][0-9]*$/),
}).strict();
const revokeAttestationSchema = baseMutation.extend({
  operation: z.literal('REVOKE_ATTESTATION'),
  subjectAttestationId: uuid,
  businessSubjectId: uuid,
  subjectType: z.enum(['agent', 'human', 'service']),
  target: targetSchema,
  authority: authoritySchema,
  expectedRevision: z.string().regex(/^[1-9][0-9]*$/),
  evidenceRef: nonempty,
}).strict();
const installDelegationSchema = baseMutation.extend({
  operation: z.literal('INSTALL_ATTESTATION_DELEGATION'),
  delegationId: uuid,
  delegatedActor: z.object({ kind: z.enum(['user', 'machine_principal']), id: uuid }).strict(),
  authorizedSubjectType: z.enum(['agent', 'human', 'service']),
  authorizedBusinessSubjectIds: z.array(uuid).min(1),
  authorizedOperations: z.array(z.enum(['activate', 'supersede', 'revoke'])).min(1),
  ownerAuthorityRef: nonempty,
  ownerAuthorityDigest: sha256,
  effectiveAt: instant,
  expiresAt: instant,
}).strict();
const revokeDelegationSchema = baseMutation.extend({
  operation: z.literal('REVOKE_ATTESTATION_DELEGATION'),
  delegationId: uuid,
  expectedRevision: z.string().regex(/^[1-9][0-9]*$/),
  revocationAuthorityRef: nonempty,
  revocationAuthorityDigest: sha256,
}).strict();
const transitionLifecycleSchema = baseMutation.extend({
  operation: z.literal('TRANSITION_AGENT_LIFECYCLE'),
  principalId: uuid,
  canonicalAgentId: agentId.optional(),
  fromState: z.enum(['absent', 'unresolved', 'canonical', 'legacy', 'retired']),
  toState: z.enum(['canonical', 'legacy', 'retired']),
  expectedRevision: z.union([z.string().regex(/^[1-9][0-9]*$/), z.null()]),
  authorityRef: nonempty,
  authorityDigest: sha256,
  evidenceRef: nonempty,
  predicates: z.object({
    liveWritableReferences: z.literal(0),
    activeWorkOwnerReferences: z.literal(0),
    activeGrantsRequired: z.literal(0),
    activeClientRequired: z.literal(0),
    successorMappingVerified: z.boolean(),
  }).strict().optional(),
}).strict();
const installSuccessorSchema = baseMutation.extend({
  operation: z.literal('INSTALL_EXPLICIT_SUCCESSOR'),
  sourcePrincipalId: uuid,
  targetPrincipalId: uuid,
  authorityRef: nonempty,
  authorityDigest: sha256,
  evidenceRef: nonempty,
}).strict();
const activateBindingSchema = baseMutation.extend({
  operation: z.literal('ACTIVATE_SOURCE_BINDING'),
  sourceBindingId: uuid,
  sourceNamespace: nonempty,
  sourceLocalValue: nonempty,
  subjectAttestationId: uuid,
  effectiveAt: instant,
  evidenceRef: nonempty,
  expectedRevision: z.union([z.string().regex(/^[1-9][0-9]*$/), z.null()]),
}).strict();
const supersedeBindingSchema = baseMutation.extend({
  operation: z.literal('SUPERSEDE_SOURCE_BINDING'),
  predecessorSourceBindingId: uuid,
  replacementSourceBindingId: uuid,
  sourceNamespace: nonempty,
  sourceLocalValue: nonempty,
  subjectAttestationId: uuid,
  effectiveAt: instant,
  evidenceRef: nonempty,
  supersessionEvidenceRef: nonempty,
  expectedPredecessorRevision: z.string().regex(/^[1-9][0-9]*$/),
}).strict();
const exitBindingSchema = baseMutation.extend({
  operation: z.literal('EXIT_SOURCE_BINDING'),
  sourceBindingId: uuid,
  sourceNamespace: nonempty,
  sourceLocalValue: nonempty,
  expectedRevision: z.string().regex(/^[1-9][0-9]*$/),
  exitEvidenceRef: nonempty,
}).strict();
const mutationSchema = z.discriminatedUnion('operation', [
  activateAttestationSchema, supersedeAttestationSchema, revokeAttestationSchema,
  installDelegationSchema, revokeDelegationSchema, transitionLifecycleSchema,
  installSuccessorSchema, activateBindingSchema, supersedeBindingSchema,
  exitBindingSchema,
]);
const packetSchema = z.object({
  packetVersion: z.literal('1'),
  operationId: uuid,
  environment: nonempty,
  actorRef: nonempty,
  authorityRef: nonempty,
  authorityDigest: sha256,
  sourceArtifacts: z.array(z.object({ ref: nonempty, digest: sha256 }).strict()).min(1),
  mutations: z.array(mutationSchema).min(1),
  createdAt: instant,
  expiresAt: instant,
}).strict();

export type CanonicalSubjectPacket = z.infer<typeof packetSchema>;
export type CanonicalSubjectMutation = CanonicalSubjectPacket['mutations'][number];
export type AttestationMutation = Extract<CanonicalSubjectMutation, { operation: 'ACTIVATE_ATTESTATION' | 'SUPERSEDE_ATTESTATION' | 'REVOKE_ATTESTATION' }>;
export interface ImportedCanonicalSubjectPacket {
  packet: CanonicalSubjectPacket;
  canonicalJson: string;
  packetDigest: string;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonicalValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalValue(item)]));
  return value;
}
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}
export function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function importCanonicalSubjectPacket(input: unknown): ImportedCanonicalSubjectPacket {
  const parsed = packetSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_PACKET', null, parsed.error.issues[0]?.path.join('.') || null, 400);
  if (Date.parse(parsed.data.expiresAt) <= Date.parse(parsed.data.createdAt))
    return fail('INVALID_PACKET', null, 'expiresAt', 400);
  const keys = new Set<string>();
  const targets = new Set<string>();
  const claimTarget = (mutationKey: string, kind: string, value: string, field: string) => {
    const target = `${kind}:${value}`;
    if (targets.has(target))
      return fail('INVALID_PACKET', mutationKey, field, 400);
    targets.add(target);
  };
  for (const mutation of parsed.data.mutations) {
    if (keys.has(mutation.mutationKey))
      return fail('INVALID_PACKET', mutation.mutationKey, 'mutationKey', 400);
    keys.add(mutation.mutationKey);
    if (mutation.operation === 'ACTIVATE_ATTESTATION') {
      claimTarget(mutation.mutationKey, 'attestation', mutation.subjectAttestationId.toLowerCase(), 'subjectAttestationId');
      claimTarget(mutation.mutationKey, 'businessSubject', mutation.businessSubjectId.toLowerCase(), 'businessSubjectId');
    }
    else if (mutation.operation === 'SUPERSEDE_ATTESTATION') {
      claimTarget(mutation.mutationKey, 'attestation', mutation.subjectAttestationId.toLowerCase(), 'subjectAttestationId');
      claimTarget(mutation.mutationKey, 'attestation', mutation.predecessorAttestationId.toLowerCase(), 'predecessorAttestationId');
      claimTarget(mutation.mutationKey, 'businessSubject', mutation.businessSubjectId.toLowerCase(), 'businessSubjectId');
    }
    else if (mutation.operation === 'REVOKE_ATTESTATION') {
      claimTarget(mutation.mutationKey, 'attestation', mutation.subjectAttestationId.toLowerCase(), 'subjectAttestationId');
      claimTarget(mutation.mutationKey, 'businessSubject', mutation.businessSubjectId.toLowerCase(), 'businessSubjectId');
    }
    else if (mutation.operation === 'INSTALL_ATTESTATION_DELEGATION' || mutation.operation === 'REVOKE_ATTESTATION_DELEGATION')
      claimTarget(mutation.mutationKey, 'delegation', mutation.delegationId.toLowerCase(), 'delegationId');
    else if (mutation.operation === 'TRANSITION_AGENT_LIFECYCLE')
      claimTarget(mutation.mutationKey, 'lifecycle', mutation.principalId.toLowerCase(), 'principalId');
    else if (mutation.operation === 'INSTALL_EXPLICIT_SUCCESSOR')
      claimTarget(mutation.mutationKey, 'successorSource', mutation.sourcePrincipalId.toLowerCase(), 'sourcePrincipalId');
    else if (mutation.operation === 'ACTIVATE_SOURCE_BINDING') {
      claimTarget(mutation.mutationKey, 'sourceBinding', mutation.sourceBindingId.toLowerCase(), 'sourceBindingId');
      claimTarget(mutation.mutationKey, 'sourceKey', canonicalJson([mutation.sourceNamespace, mutation.sourceLocalValue]), 'sourceLocalValue');
    }
    else if (mutation.operation === 'SUPERSEDE_SOURCE_BINDING') {
      claimTarget(mutation.mutationKey, 'sourceBinding', mutation.predecessorSourceBindingId.toLowerCase(), 'predecessorSourceBindingId');
      claimTarget(mutation.mutationKey, 'sourceBinding', mutation.replacementSourceBindingId.toLowerCase(), 'replacementSourceBindingId');
      claimTarget(mutation.mutationKey, 'sourceKey', canonicalJson([mutation.sourceNamespace, mutation.sourceLocalValue]), 'sourceLocalValue');
    }
    else if (mutation.operation === 'EXIT_SOURCE_BINDING') {
      claimTarget(mutation.mutationKey, 'sourceBinding', mutation.sourceBindingId.toLowerCase(), 'sourceBindingId');
      claimTarget(mutation.mutationKey, 'sourceKey', canonicalJson([mutation.sourceNamespace, mutation.sourceLocalValue]), 'sourceLocalValue');
    }
    if (mutation.operation === 'INSTALL_ATTESTATION_DELEGATION' && (new Set(mutation.authorizedBusinessSubjectIds).size !== mutation.authorizedBusinessSubjectIds.length || new Set(mutation.authorizedOperations).size !== mutation.authorizedOperations.length))
      return fail('INVALID_PACKET', mutation.mutationKey, 'delegation.scope', 400);
  }
  const artifactKeys = new Set<string>();
  for (const artifact of parsed.data.sourceArtifacts) {
    if (artifactKeys.has(artifact.ref))
      return fail('INVALID_PACKET', artifact.ref, 'sourceArtifacts.ref', 400);
    artifactKeys.add(artifact.ref);
  }
  const packet: CanonicalSubjectPacket = {
    ...parsed.data,
    sourceArtifacts: [...parsed.data.sourceArtifacts].sort((a, b) => a.ref.localeCompare(b.ref)),
    mutations: parsed.data.mutations.map(mutation => mutation.operation === 'INSTALL_ATTESTATION_DELEGATION' ? { ...mutation, authorizedBusinessSubjectIds: [...mutation.authorizedBusinessSubjectIds].sort(), authorizedOperations: [...mutation.authorizedOperations].sort() } : mutation).sort((a, b) => a.mutationKey.localeCompare(b.mutationKey)),
  };
  const encoded = canonicalJson(packet);
  return { packet, canonicalJson: encoded, packetDigest: createHash('sha256').update(encoded).digest('hex') };
}

export type TargetReference = z.infer<typeof targetSchema>;
export type TargetRecord =
  | { kind: 'user'; id: string; status: 'active' | 'disabled' }
  | { kind: 'machine_principal'; id: string; principalType: 'agent' | 'service'; status: 'active' | 'disabled'; agentId: string | null; lifecycleState: 'unresolved' | 'canonical' | 'legacy' | 'retired' | null; lifecycleRevision: string | null; outgoingSuccessor: boolean };
export interface AttestationRecord { subjectAttestationId: string; businessSubjectId: string; subjectType: 'agent' | 'human' | 'service'; target: TargetReference; status: 'active' | 'superseded' | 'revoked'; revision: string }
export interface SourceBindingRecord { sourceBindingId: string; status: 'planned' | 'active' | 'superseded' | 'exited'; revision: string }
export interface DelegationRecord { delegationId: string; status: 'active' | 'revoked'; revision: string; delegatedActorRef: string; authorizedSubjectType: 'agent' | 'human' | 'service'; authorizedBusinessSubjectIds: string[]; authorizedOperations: ('activate' | 'supersede' | 'revoke')[]; effectiveAt: string; expiresAt: string }
export interface LifecycleRecord { principalId: string; state: 'unresolved' | 'canonical' | 'legacy' | 'retired'; revision: string }
export interface SuccessorRecord { sourcePrincipalId: string; targetPrincipalId: string }
export interface CommittedOperationRecord {
  operationId: string;
  environment: string;
  actorRef: string;
  packetDigest: string;
  authorityDigest: string;
  prestateDigest: string;
  planDigest: string;
  authorityManifestDigest: string;
  poststateDigest: string;
  mutationCounts: Record<string, number>;
  committedAt: string;
}
export interface CanonicalSubjectReadStore {
  readFoundationState(): Promise<{ installed: boolean }>;
  readTarget(target: TargetReference): Promise<TargetRecord | null>;
  readAttestation(id: string): Promise<AttestationRecord | null>;
  readSourceBinding(namespace: string, value: string): Promise<SourceBindingRecord | null>;
  readSourceBindingById(id: string): Promise<(SourceBindingRecord & { sourceNamespace: string; sourceLocalValue: string; subjectAttestationId: string }) | null>;
  readCurrentSourceBindingsForAttestation(id: string): Promise<Array<SourceBindingRecord & { sourceNamespace: string; sourceLocalValue: string; subjectAttestationId: string }>>;
  readDelegation(id: string): Promise<DelegationRecord | null>;
  readAgentLifecycle(principalId: string): Promise<LifecycleRecord | null>;
  readSuccessor(principalId: string): Promise<SuccessorRecord | null>;
  readIncomingSuccessorCount(principalId: string): Promise<number>;
  readActiveAttestationsForMachinePrincipal(principalId: string): Promise<AttestationRecord[]>;
  readCommittedOperation(operationId: string): Promise<CommittedOperationRecord | null>;
  readOperationAuthorityManifest(operationId: string): Promise<AuthorityManifestEntry[]>;
}
export type EvidenceFailureCode = Extract<CanonicalSubjectErrorCode,
  'ATTESTATION_AUTHORITY_MISSING' | 'ATTESTATION_AUTHORITY_INVALID' |
  'ATTESTATION_AUTHORITY_OUT_OF_SCOPE' | 'ATTESTATION_AUTHORITY_REVOKED' |
  'ATTESTATION_AUTHORITY_EXPIRED' | 'ATTESTATION_AUTHORITY_OPERATION_MISMATCH'>;
export interface CanonicalSubjectEvidenceProvider {
  validatePacketAuthority(input: { operationId: string; packetDigest: string; authorityRef: string; authorityDigest: string; actorRef: string; mutationKeys: string[] }, at: Date): Promise<{ valid: true; authorityDigest: string } | { valid: false }>;
  validateAttestationAuthority(entry: AuthorityManifestEntry, actorRef: string, at: Date): Promise<{ valid: true; authorityDigest: string } | { valid: false; code: EvidenceFailureCode }>;
  validateCoreAgent(target: TargetReference, at: Date): Promise<{ valid: true; evidenceDigest: string; principalId: string; agentId: string; expiresAt: string } | { valid: false }>;
  validateSourceExit(input: { sourceNamespace: string; sourceLocalValue: string; evidenceRef: string }, at: Date): Promise<{ valid: boolean; zeroLive: boolean; evidenceDigest: string }>;
  validateLifecyclePredicates(input: { principalId: string; targetState: string }, at: Date): Promise<{ valid: boolean; evidenceDigest: string; liveWritableReferences: number; activeWorkOwnerReferences: number; activeGrantsRequired: number; activeClientRequired: number; successorMappingVerified: boolean }>;
}

export interface AuthorityManifestEntry {
  mutationKey: string;
  businessSubjectId: string;
  subjectAttestationId: string;
  predecessorId?: string;
  subjectType: 'agent' | 'human' | 'service';
  target: TargetReference;
  authorityKind: 'owner_exact' | 'delegated' | 'accepted_governing_authority';
  authorityRef: string;
  authorityDigest: string;
  requestedOperation: 'activate' | 'supersede' | 'revoke';
  intendedDisposition: 'active' | 'superseded' | 'revoked';
  delegationId?: string;
  delegationRevision?: string;
}
function authorityManifestEntryForMutation(mutation: AttestationMutation): AuthorityManifestEntry {
  return {
    mutationKey: mutation.mutationKey,
    businessSubjectId: mutation.businessSubjectId,
    subjectAttestationId: mutation.subjectAttestationId,
    ...('predecessorAttestationId' in mutation ? { predecessorId: mutation.predecessorAttestationId } : {}),
    subjectType: mutation.subjectType,
    target: mutation.target,
    authorityKind: mutation.authority.kind,
    authorityRef: mutation.authority.ref,
    authorityDigest: mutation.authority.digest,
    requestedOperation: mutation.authority.requestedOperation,
    intendedDisposition: mutation.authority.intendedDisposition,
    ...(mutation.authority.delegationId ? { delegationId: mutation.authority.delegationId, delegationRevision: mutation.authority.delegationRevision } : {}),
  };
}
export interface CanonicalSubjectPlan {
  operationId: string;
  environment: string;
  actorRef: string;
  authorityRef: string;
  packetDigest: string;
  authorityDigest: string;
  authorityManifest: AuthorityManifestEntry[];
  authorityManifestDigest: string;
  prestateDigest: string;
  planDigest: string;
  expectedPoststateDigest: string;
  mutationCounts: Record<string, number>;
  mutations: CanonicalSubjectMutation[];
  disposition: 'NOOP' | 'APPLY';
  createdAt: string;
  expiresAt: string;
  coreEvidenceDigests: string[];
}
function exactActorRef(actor: { kind: 'user' | 'machine_principal' | 'external_authority'; id: string }): string {
  return `${actor.kind}:${actor.id}`;
}

function expectedMutationState(mutation: CanonicalSubjectMutation): unknown {
  switch (mutation.operation) {
    case 'ACTIVATE_ATTESTATION': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { id: mutation.subjectAttestationId, status: 'active', revision: '1' } };
    case 'SUPERSEDE_ATTESTATION': return { mutationKey: mutation.mutationKey, operation: mutation.operation, predecessor: { id: mutation.predecessorAttestationId, status: 'superseded', revision: String(BigInt(mutation.expectedPredecessorRevision) + 1n) }, current: { id: mutation.subjectAttestationId, status: 'active', revision: '1' } };
    case 'REVOKE_ATTESTATION': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { id: mutation.subjectAttestationId, status: 'revoked', revision: String(BigInt(mutation.expectedRevision) + 1n) } };
    case 'INSTALL_ATTESTATION_DELEGATION': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { id: mutation.delegationId, status: 'active', revision: '1' } };
    case 'REVOKE_ATTESTATION_DELEGATION': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { id: mutation.delegationId, status: 'revoked', revision: String(BigInt(mutation.expectedRevision) + 1n) } };
    case 'TRANSITION_AGENT_LIFECYCLE': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { id: mutation.principalId, status: mutation.toState, revision: mutation.fromState === mutation.toState ? mutation.expectedRevision : String(BigInt(mutation.expectedRevision ?? '0') + 1n) } };
    case 'INSTALL_EXPLICIT_SUCCESSOR': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { sourcePrincipalId: mutation.sourcePrincipalId, targetPrincipalId: mutation.targetPrincipalId } };
    case 'ACTIVATE_SOURCE_BINDING': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { id: mutation.sourceBindingId, status: 'active', revision: mutation.expectedRevision === null ? '1' : String(BigInt(mutation.expectedRevision) + 1n) } };
    case 'SUPERSEDE_SOURCE_BINDING': return { mutationKey: mutation.mutationKey, operation: mutation.operation, predecessor: { id: mutation.predecessorSourceBindingId, status: 'superseded', revision: String(BigInt(mutation.expectedPredecessorRevision) + 1n) }, current: { id: mutation.replacementSourceBindingId, status: 'active', revision: '1' } };
    case 'EXIT_SOURCE_BINDING': return { mutationKey: mutation.mutationKey, operation: mutation.operation, current: { id: mutation.sourceBindingId, status: 'exited', revision: String(BigInt(mutation.expectedRevision) + 1n) } };
  }
}
function expectedPoststate(mutations: CanonicalSubjectMutation[]): unknown[] {
  return mutations.map(expectedMutationState);
}

type TypedTargetMutation = Pick<AttestationMutation, 'mutationKey' | 'subjectType' | 'target'>;
function exactTargetShape(mutation: TypedTargetMutation): void {
  const keys = Object.keys(mutation.target).filter(key => mutation.target[key as keyof TargetReference] !== undefined).sort();
  const expected = mutation.subjectType === 'agent' ? ['canonicalAgentId', 'machinePrincipalId'] : mutation.subjectType === 'human' ? ['userId'] : ['machinePrincipalId'];
  if (canonicalJson(keys) !== canonicalJson(expected.sort()))
    fail('TARGET_TYPE_MISMATCH', mutation.mutationKey, 'target');
}
function validateAgentPrincipalCandidate(mutationKey: string, canonicalAgentId: string | undefined, record: TargetRecord | null, allowedLifecycleStates: Array<'unresolved' | 'canonical' | 'legacy' | null>): asserts record is Extract<TargetRecord, { kind: 'machine_principal' }> {
  if (!record)
    fail('TARGET_NOT_FOUND', mutationKey, 'principalId', 404);
  if (record.kind !== 'machine_principal' || record.principalType !== 'agent')
    fail('TARGET_TYPE_MISMATCH', mutationKey, 'principalId');
  if (record.status !== 'active')
    fail('TARGET_INACTIVE', mutationKey, 'principalId');
  if (canonicalAgentId !== undefined && record.agentId !== canonicalAgentId)
    fail('TARGET_PAIR_MISMATCH', mutationKey, 'canonicalAgentId');
  if (!allowedLifecycleStates.includes(record.lifecycleState as 'unresolved' | 'canonical' | 'legacy' | null) || record.outgoingSuccessor)
    fail('NON_CANONICAL_AGENT_TARGET', mutationKey, 'principalId');
}
async function validateTarget(mutation: TypedTargetMutation, record: TargetRecord | null): Promise<void> {
  exactTargetShape(mutation);
  if (!record)
    fail('TARGET_NOT_FOUND', mutation.mutationKey, 'target', 404);
  if (record.status !== 'active')
    fail('TARGET_INACTIVE', mutation.mutationKey, 'target.status');
  if (mutation.subjectType === 'human') {
    if (record.kind !== 'user' || record.id !== mutation.target.userId)
      fail('TARGET_TYPE_MISMATCH', mutation.mutationKey, 'target');
    return;
  }
  if (record.kind !== 'machine_principal' || record.id !== mutation.target.machinePrincipalId || record.principalType !== mutation.subjectType)
    fail('TARGET_TYPE_MISMATCH', mutation.mutationKey, 'target');
  if (mutation.subjectType === 'service') {
    if (record.agentId !== null || record.lifecycleState !== null)
      fail('TARGET_AUTHORITY_INCONSISTENT', mutation.mutationKey, 'target');
    return;
  }
  if (record.agentId !== mutation.target.canonicalAgentId)
    fail('TARGET_PAIR_MISMATCH', mutation.mutationKey, 'target.canonicalAgentId');
  if (record.lifecycleState !== 'canonical' || record.outgoingSuccessor)
    fail('NON_CANONICAL_AGENT_TARGET', mutation.mutationKey, 'target');
}

export async function planCanonicalSubjectEnrollment(imported: ImportedCanonicalSubjectPacket, store: CanonicalSubjectReadStore, evidence: CanonicalSubjectEvidenceProvider, options: { now?: Date } = {}): Promise<CanonicalSubjectPlan> {
  const at = options.now ?? new Date();
  if (at.getTime() >= Date.parse(imported.packet.expiresAt))
    fail('PLAN_EXPIRED', imported.packet.operationId, 'expiresAt');
  if (!(await store.readFoundationState()).installed)
    fail('FOUNDATION_NOT_INSTALLED', imported.packet.operationId, null, 503);
  const packetAuthority = await evidence.validatePacketAuthority({ operationId: imported.packet.operationId, packetDigest: imported.packetDigest, authorityRef: imported.packet.authorityRef, authorityDigest: imported.packet.authorityDigest, actorRef: imported.packet.actorRef, mutationKeys: imported.packet.mutations.map(mutation => mutation.mutationKey) }, at);
  if (!packetAuthority.valid || packetAuthority.authorityDigest !== imported.packet.authorityDigest)
    fail('AUTHORITY_NOT_ACCEPTED', imported.packet.operationId, 'authorityRef');
  const manifest: AuthorityManifestEntry[] = [];
  const prestate: unknown[] = [];
  const coreDigests: string[] = [];
  let writes = 0;
  const plannedAttestations = new Set(imported.packet.mutations.filter(mutation => mutation.operation === 'ACTIVATE_ATTESTATION' || mutation.operation === 'SUPERSEDE_ATTESTATION').map(mutation => mutation.subjectAttestationId));
  for (const mutation of imported.packet.mutations) {
    if (mutation.operation === 'ACTIVATE_ATTESTATION' || mutation.operation === 'SUPERSEDE_ATTESTATION' || mutation.operation === 'REVOKE_ATTESTATION') {
      if ('attestedBy' in mutation && exactActorRef(mutation.attestedBy) !== imported.packet.actorRef)
        fail('ATTESTATION_AUTHORITY_INVALID', mutation.mutationKey, 'attestedBy');
      const requestedOperation = mutation.operation === 'ACTIVATE_ATTESTATION' ? 'activate' : mutation.operation === 'SUPERSEDE_ATTESTATION' ? 'supersede' : 'revoke';
      const intendedDisposition = mutation.operation === 'REVOKE_ATTESTATION' ? 'revoked' : 'active';
      if (mutation.authority.requestedOperation !== requestedOperation || mutation.authority.intendedDisposition !== intendedDisposition)
        fail('ATTESTATION_AUTHORITY_OPERATION_MISMATCH', mutation.mutationKey, 'authority.requestedOperation');
      const existing = await store.readAttestation(mutation.subjectAttestationId);
      prestate.push({ mutationKey: mutation.mutationKey, existing });
      if (mutation.operation === 'ACTIVATE_ATTESTATION' && existing)
        fail('ATTESTATION_CONFLICT', mutation.mutationKey, 'subjectAttestationId');
      if (mutation.operation === 'SUPERSEDE_ATTESTATION') {
        if (existing)
          fail('ATTESTATION_CONFLICT', mutation.mutationKey, 'subjectAttestationId');
        const predecessor = await store.readAttestation(mutation.predecessorAttestationId);
        prestate.push({ mutationKey: mutation.mutationKey, predecessor });
        if (!predecessor || predecessor.status !== 'active' || predecessor.revision !== mutation.expectedPredecessorRevision || predecessor.businessSubjectId !== mutation.businessSubjectId || predecessor.subjectType !== mutation.subjectType)
          fail(predecessor?.revision === mutation.expectedPredecessorRevision ? 'ATTESTATION_CONFLICT' : 'REVISION_CONFLICT', mutation.mutationKey, 'predecessorAttestationId');
        const liveBindings = await store.readCurrentSourceBindingsForAttestation(mutation.predecessorAttestationId);
        const covered = new Set(imported.packet.mutations.flatMap(item => item.operation === 'SUPERSEDE_SOURCE_BINDING' ? [item.predecessorSourceBindingId] : item.operation === 'EXIT_SOURCE_BINDING' ? [item.sourceBindingId] : []));
        if (liveBindings.some(binding => !covered.has(binding.sourceBindingId)))
          fail('SOURCE_BINDING_CONFLICT', mutation.mutationKey, 'predecessorAttestationId');
      }
      if (mutation.operation === 'REVOKE_ATTESTATION') {
        if (!existing || existing.status !== 'active' || existing.revision !== mutation.expectedRevision || existing.businessSubjectId !== mutation.businessSubjectId || existing.subjectType !== mutation.subjectType || canonicalJson(existing.target) !== canonicalJson(mutation.target))
          fail(existing?.revision === mutation.expectedRevision ? 'ATTESTATION_CONFLICT' : 'REVISION_CONFLICT', mutation.mutationKey, 'subjectAttestationId');
        const liveBindings = await store.readCurrentSourceBindingsForAttestation(mutation.subjectAttestationId);
        const covered = new Set(imported.packet.mutations.flatMap(item => item.operation === 'SUPERSEDE_SOURCE_BINDING' ? [item.predecessorSourceBindingId] : item.operation === 'EXIT_SOURCE_BINDING' ? [item.sourceBindingId] : []));
        if (liveBindings.some(binding => !covered.has(binding.sourceBindingId)))
          fail('SOURCE_BINDING_CONFLICT', mutation.mutationKey, 'subjectAttestationId');
      }
      await validateTarget(mutation, await store.readTarget(mutation.target));
      if (mutation.subjectType === 'agent') {
        const core = await evidence.validateCoreAgent(mutation.target, at);
        if (!core.valid || core.principalId !== mutation.target.machinePrincipalId || core.agentId !== mutation.target.canonicalAgentId || Date.parse(core.expiresAt) <= at.getTime())
          fail('TARGET_AUTHORITY_INCONSISTENT', mutation.mutationKey, 'target');
        coreDigests.push(core.evidenceDigest);
      }
      const entry = authorityManifestEntryForMutation(mutation);
      if (entry.authorityKind === 'delegated') {
        if (!entry.delegationId || !entry.delegationRevision)
          fail('ATTESTATION_AUTHORITY_MISSING', mutation.mutationKey, 'authority.delegationId');
        const delegation = await store.readDelegation(entry.delegationId);
        if (!delegation)
          fail('ATTESTATION_AUTHORITY_INVALID', mutation.mutationKey, 'authority.delegationId');
        if (delegation.status === 'revoked')
          fail('ATTESTATION_AUTHORITY_REVOKED', mutation.mutationKey, 'authority.delegationId');
        if (delegation.revision !== entry.delegationRevision || delegation.delegatedActorRef !== imported.packet.actorRef || delegation.authorizedSubjectType !== entry.subjectType || !delegation.authorizedBusinessSubjectIds.includes(entry.businessSubjectId) || !delegation.authorizedOperations.includes(entry.requestedOperation))
          fail('ATTESTATION_AUTHORITY_OUT_OF_SCOPE', mutation.mutationKey, 'authority.delegationId');
        if (at.getTime() < Date.parse(delegation.effectiveAt) || at.getTime() >= Date.parse(delegation.expiresAt))
          fail('ATTESTATION_AUTHORITY_EXPIRED', mutation.mutationKey, 'authority.delegationId');
      }
      const authority = await evidence.validateAttestationAuthority(entry, imported.packet.actorRef, at);
      if (!authority.valid)
        fail(authority.code, mutation.mutationKey, 'authority');
      if (authority.authorityDigest !== entry.authorityDigest)
        fail('ATTESTATION_AUTHORITY_INVALID', mutation.mutationKey, 'authority.digest');
      manifest.push(entry);
      writes++;
    }
    else if (mutation.operation === 'ACTIVATE_SOURCE_BINDING') {
      const existing = await store.readSourceBinding(mutation.sourceNamespace, mutation.sourceLocalValue);
      prestate.push({ mutationKey: mutation.mutationKey, existing });
      if (mutation.expectedRevision === null) {
        if (existing)
          fail('SOURCE_BINDING_CONFLICT', mutation.mutationKey, 'sourceLocalValue');
      }
      else if (!existing || existing.sourceBindingId !== mutation.sourceBindingId || existing.status !== 'planned' || existing.revision !== mutation.expectedRevision) {
        fail(existing?.revision === mutation.expectedRevision ? 'SOURCE_BINDING_CONFLICT' : 'REVISION_CONFLICT', mutation.mutationKey, 'expectedRevision');
      }
      const attestation = await store.readAttestation(mutation.subjectAttestationId);
      if ((!attestation || attestation.status !== 'active') && !plannedAttestations.has(mutation.subjectAttestationId))
        fail('ATTESTATION_CONFLICT', mutation.mutationKey, 'subjectAttestationId');
      writes++;
    }
    else if (mutation.operation === 'SUPERSEDE_SOURCE_BINDING') {
      const predecessor = await store.readSourceBindingById(mutation.predecessorSourceBindingId);
      prestate.push({ mutationKey: mutation.mutationKey, predecessor });
      if (!predecessor || !['planned', 'active'].includes(predecessor.status) || predecessor.revision !== mutation.expectedPredecessorRevision || predecessor.sourceNamespace !== mutation.sourceNamespace || predecessor.sourceLocalValue !== mutation.sourceLocalValue)
        fail(predecessor?.revision === mutation.expectedPredecessorRevision ? 'SOURCE_BINDING_CONFLICT' : 'REVISION_CONFLICT', mutation.mutationKey, 'predecessorSourceBindingId');
      const target = await store.readAttestation(mutation.subjectAttestationId);
      if ((!target || target.status !== 'active') && !plannedAttestations.has(mutation.subjectAttestationId))
        fail('ATTESTATION_CONFLICT', mutation.mutationKey, 'subjectAttestationId');
      writes++;
    }
    else if (mutation.operation === 'EXIT_SOURCE_BINDING') {
      const binding = await store.readSourceBindingById(mutation.sourceBindingId);
      prestate.push({ mutationKey: mutation.mutationKey, binding });
      if (!binding || !['planned', 'active', 'superseded'].includes(binding.status) || binding.revision !== mutation.expectedRevision || binding.sourceNamespace !== mutation.sourceNamespace || binding.sourceLocalValue !== mutation.sourceLocalValue)
        fail(binding?.revision === mutation.expectedRevision ? 'SOURCE_BINDING_CONFLICT' : 'REVISION_CONFLICT', mutation.mutationKey, 'sourceBindingId');
      const zero = await evidence.validateSourceExit({ sourceNamespace: mutation.sourceNamespace, sourceLocalValue: mutation.sourceLocalValue, evidenceRef: mutation.exitEvidenceRef }, at);
      if (!zero.valid || !zero.zeroLive)
        fail('SOURCE_BINDING_CONFLICT', mutation.mutationKey, 'exitEvidenceRef');
      coreDigests.push(zero.evidenceDigest);
      writes++;
    }
    else if (mutation.operation === 'INSTALL_ATTESTATION_DELEGATION') {
      const existing = await store.readDelegation(mutation.delegationId);
      prestate.push({ mutationKey: mutation.mutationKey, existing });
      if (existing || `${mutation.delegatedActor.kind}:${mutation.delegatedActor.id}` === imported.packet.actorRef || Date.parse(mutation.expiresAt) <= Date.parse(mutation.effectiveAt) || new Set(mutation.authorizedBusinessSubjectIds).size !== mutation.authorizedBusinessSubjectIds.length || new Set(mutation.authorizedOperations).size !== mutation.authorizedOperations.length)
        fail('ATTESTATION_AUTHORITY_INVALID', mutation.mutationKey, 'delegation');
      writes++;
    }
    else if (mutation.operation === 'REVOKE_ATTESTATION_DELEGATION') {
      const existing = await store.readDelegation(mutation.delegationId);
      prestate.push({ mutationKey: mutation.mutationKey, existing });
      if (!existing || existing.status !== 'active' || existing.revision !== mutation.expectedRevision)
        fail(existing?.revision === mutation.expectedRevision ? 'ATTESTATION_AUTHORITY_REVOKED' : 'REVISION_CONFLICT', mutation.mutationKey, 'delegationId');
      writes++;
    }
    else if (mutation.operation === 'TRANSITION_AGENT_LIFECYCLE') {
      const current = await store.readAgentLifecycle(mutation.principalId);
      prestate.push({ mutationKey: mutation.mutationKey, current });
      const actual = current?.state ?? 'absent';
      if (actual !== mutation.fromState || (current?.revision ?? null) !== mutation.expectedRevision)
        fail('REVISION_CONFLICT', mutation.mutationKey, 'expectedRevision');
      if (actual === mutation.toState) {
        continue;
      }
      const allowed = new Set(['absent>canonical', 'unresolved>canonical', 'absent>legacy', 'unresolved>legacy', 'legacy>canonical', 'legacy>retired', 'canonical>legacy', 'canonical>retired']);
      if (!allowed.has(`${actual}>${mutation.toState}`) || actual === 'retired')
        fail('AUTHORITY_NOT_ACCEPTED', mutation.mutationKey, 'transition');
      if (mutation.toState === 'canonical') {
        if (!mutation.canonicalAgentId)
          fail('TARGET_PAIR_MISMATCH', mutation.mutationKey, 'canonicalAgentId');
        const target: TargetReference = { machinePrincipalId: mutation.principalId, canonicalAgentId: mutation.canonicalAgentId };
        validateAgentPrincipalCandidate(mutation.mutationKey, mutation.canonicalAgentId, await store.readTarget(target), actual === 'legacy' ? ['legacy'] : actual === 'absent' ? [null] : ['unresolved']);
        if ((await store.readActiveAttestationsForMachinePrincipal(mutation.principalId)).length !== 0)
          fail('ATTESTATION_CONFLICT', mutation.mutationKey, 'principalId');
        const core = await evidence.validateCoreAgent(target, at);
        if (!core.valid || core.principalId !== mutation.principalId || core.agentId !== mutation.canonicalAgentId || Date.parse(core.expiresAt) <= at.getTime())
          fail('TARGET_AUTHORITY_INCONSISTENT', mutation.mutationKey, 'canonicalAgentId');
        coreDigests.push(core.evidenceDigest);
      }
      if (mutation.toState === 'legacy' && actual !== 'canonical') {
        validateAgentPrincipalCandidate(mutation.mutationKey, undefined, await store.readTarget({ machinePrincipalId: mutation.principalId }), actual === 'absent' ? [null] : ['unresolved']);
      }
      if (mutation.toState === 'retired' || (actual === 'canonical' && mutation.toState === 'legacy')) {
        const predicates = await evidence.validateLifecyclePredicates({ principalId: mutation.principalId, targetState: mutation.toState }, at);
        const exact = predicates.valid && predicates.liveWritableReferences === 0 && predicates.activeWorkOwnerReferences === 0 && predicates.activeGrantsRequired === 0 && predicates.activeClientRequired === 0 && (mutation.toState !== 'retired' || predicates.successorMappingVerified);
        if (!exact)
          fail('AUTHORITY_NOT_ACCEPTED', mutation.mutationKey, 'predicates');
        coreDigests.push(predicates.evidenceDigest);
      }
      if (mutation.toState === 'retired' || (actual === 'canonical' && mutation.toState === 'legacy')) {
        const activeAttestations = await store.readActiveAttestationsForMachinePrincipal(mutation.principalId);
        prestate.push({ mutationKey: mutation.mutationKey, activeAttestations });
        const covered = activeAttestations.every(attestation => imported.packet.mutations.some(item => (item.operation === 'REVOKE_ATTESTATION' && item.subjectAttestationId === attestation.subjectAttestationId) || (item.operation === 'SUPERSEDE_ATTESTATION' && item.predecessorAttestationId === attestation.subjectAttestationId)));
        if (!covered)
          fail('ATTESTATION_CONFLICT', mutation.mutationKey, 'principalId');
      }
      if (actual === 'canonical' && (mutation.toState === 'legacy' || mutation.toState === 'retired') && await store.readIncomingSuccessorCount(mutation.principalId) !== 0)
        fail('AUTHORITY_NOT_ACCEPTED', mutation.mutationKey, 'incomingSuccessors');
      if (actual === 'canonical' && mutation.toState === 'legacy') {
        const successor = await store.readSuccessor(mutation.principalId);
        const planned = imported.packet.mutations.find((item): item is Extract<CanonicalSubjectMutation, { operation: 'INSTALL_EXPLICIT_SUCCESSOR' }> => item.operation === 'INSTALL_EXPLICIT_SUCCESSOR' && item.sourcePrincipalId === mutation.principalId);
        const targetPrincipalId = successor?.targetPrincipalId ?? planned?.targetPrincipalId;
        if (targetPrincipalId)
          validateAgentPrincipalCandidate(mutation.mutationKey, undefined, await store.readTarget({ machinePrincipalId: targetPrincipalId }), ['canonical']);
      }
      if (mutation.toState === 'retired') {
        const successor = await store.readSuccessor(mutation.principalId);
        const planned = imported.packet.mutations.find((item): item is Extract<CanonicalSubjectMutation, { operation: 'INSTALL_EXPLICIT_SUCCESSOR' }> => item.operation === 'INSTALL_EXPLICIT_SUCCESSOR' && item.sourcePrincipalId === mutation.principalId);
        const targetPrincipalId = successor?.targetPrincipalId ?? planned?.targetPrincipalId;
        if (!targetPrincipalId)
          fail('AUTHORITY_NOT_ACCEPTED', mutation.mutationKey, 'successor');
        const successorTarget = await store.readTarget({ machinePrincipalId: targetPrincipalId });
        validateAgentPrincipalCandidate(mutation.mutationKey, undefined, successorTarget, ['canonical']);
      }
      writes++;
    }
    else if (mutation.operation === 'INSTALL_EXPLICIT_SUCCESSOR') {
      const source = await store.readAgentLifecycle(mutation.sourcePrincipalId);
      const target = await store.readAgentLifecycle(mutation.targetPrincipalId);
      const existing = await store.readSuccessor(mutation.sourcePrincipalId);
      prestate.push({ mutationKey: mutation.mutationKey, source, target, existing });
      const plannedTransition = imported.packet.mutations.find(item => item.operation === 'TRANSITION_AGENT_LIFECYCLE' && item.principalId === mutation.sourcePrincipalId && item.fromState === 'canonical' && (item.toState === 'legacy' || item.toState === 'retired'));
      const sourceEligible = !!source && (['legacy', 'retired'].includes(source.state) || (source.state === 'canonical' && !!plannedTransition));
      if (existing || !sourceEligible || target?.state !== 'canonical' || mutation.sourcePrincipalId === mutation.targetPrincipalId)
        fail('AUTHORITY_NOT_ACCEPTED', mutation.mutationKey, 'successor');
      validateAgentPrincipalCandidate(mutation.mutationKey, undefined, await store.readTarget({ machinePrincipalId: mutation.targetPrincipalId }), ['canonical']);
      writes++;
    }
  }
  const sortedManifest = [...manifest].sort((a, b) => a.mutationKey.localeCompare(b.mutationKey));
  if (canonicalJson(sortedManifest.map(item => item.mutationKey)) !== canonicalJson(manifest.map(item => item.mutationKey)))
    fail('ATTESTATION_AUTHORITY_MANIFEST_MISMATCH', imported.packet.operationId, 'authorityManifest');
  const mutationCounts = Object.fromEntries([...new Set(imported.packet.mutations.map(item => item.operation))].sort().map(operation => [operation, imported.packet.mutations.filter(item => item.operation === operation).length]));
  const authorityManifestDigest = hashCanonical(sortedManifest);
  const prestateDigest = hashCanonical(prestate);
  const expectedPoststateDigest = hashCanonical(expectedPoststate(imported.packet.mutations));
  const basis = {
    operationId: imported.packet.operationId, environment: imported.packet.environment,
    actorRef: imported.packet.actorRef, authorityRef: imported.packet.authorityRef, packetDigest: imported.packetDigest,
    authorityDigest: imported.packet.authorityDigest, authorityManifestDigest,
    prestateDigest, expectedPoststateDigest, mutationCounts,
    mutations: imported.packet.mutations, createdAt: imported.packet.createdAt,
    expiresAt: imported.packet.expiresAt, coreEvidenceDigests: [...new Set(coreDigests)].sort(),
    disposition: writes ? 'APPLY' as const : 'NOOP' as const,
  };
  return { ...basis, authorityManifest: sortedManifest, planDigest: hashCanonical(basis) };
}

interface RawClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}
export interface CanonicalSubjectWriteDatabase {
  $transaction<T>(fn: (tx: RawClient) => Promise<T>, options: { isolationLevel: 'Serializable'; timeout: number; maxWait: number }): Promise<T>;
}
export interface CanonicalSubjectReadDatabase {
  $transaction<T>(fn: (tx: RawClient) => Promise<T>, options: { isolationLevel: 'RepeatableRead'; timeout: number; maxWait: number }): Promise<T>;
}
const defaultWriteDatabase = prisma as unknown as CanonicalSubjectWriteDatabase;
const defaultReadDatabase = prisma as unknown as CanonicalSubjectReadDatabase;
const rows = async <T>(client: RawClient, sql: string, ...values: unknown[]): Promise<T[]> => client.$queryRawUnsafe<T[]>(sql, ...values);
function attestationRecord(row: any): AttestationRecord {
  const target = row.subjectType === 'human' ? { userId: row.userId } : row.subjectType === 'agent' ? { machinePrincipalId: row.machinePrincipalId, canonicalAgentId: row.canonicalAgentId } : { machinePrincipalId: row.machinePrincipalId };
  return { subjectAttestationId: row.subjectAttestationId, businessSubjectId: row.businessSubjectId, subjectType: row.subjectType, target, status: row.status, revision: row.revision };
}

export function createCanonicalSubjectReadStore(client: RawClient): CanonicalSubjectReadStore {
  return {
    readFoundationState: async () => ({ installed: Boolean((await rows<{ installed: boolean }>(client, "SELECT to_regclass('agent_identity_lifecycle') IS NOT NULL AND to_regclass('agent_identity_successors') IS NOT NULL AS installed"))[0]?.installed) }),
    readTarget: async target => {
      if (target.userId) {
        const result = await rows<any>(client, 'SELECT id::text,status::text FROM users WHERE id=$1::uuid', target.userId);
        return result[0] ? { kind: 'user', id: result[0].id, status: result[0].status } : null;
      }
      const result = await rows<any>(client, `SELECT p.id::text,p.principal_type::text AS "principalType",p.status::text,p.agent_id AS "agentId",l.state::text AS "lifecycleState",l.revision::text AS "lifecycleRevision",EXISTS(SELECT 1 FROM agent_identity_successors e WHERE e.source_principal_id=p.id) AS "outgoingSuccessor" FROM machine_principals p LEFT JOIN agent_identity_lifecycle l ON l.principal_id=p.id WHERE p.id=$1::uuid`, target.machinePrincipalId);
      return result[0] ? { kind: 'machine_principal', ...result[0] } : null;
    },
    readAttestation: async id => { const row = (await rows<any>(client, 'SELECT subject_attestation_id::text AS "subjectAttestationId",business_subject_id::text AS "businessSubjectId",subject_type::text AS "subjectType",machine_principal_id::text AS "machinePrincipalId",user_id::text AS "userId",canonical_agent_id AS "canonicalAgentId",status::text,revision::text FROM canonical_subject_attestations WHERE subject_attestation_id=$1::uuid', id))[0]; return row ? attestationRecord(row) : null; },
    readSourceBinding: async (namespace, value) => (await rows<any>(client, `SELECT source_binding_id::text AS "sourceBindingId",status::text,revision::text FROM canonical_subject_source_bindings WHERE source_namespace=$1 AND source_local_value=$2 AND status IN ('planned','active')`, namespace, value))[0] ?? null,
    readSourceBindingById: async id => (await rows<any>(client, 'SELECT source_binding_id::text AS "sourceBindingId",source_namespace AS "sourceNamespace",source_local_value AS "sourceLocalValue",subject_attestation_id::text AS "subjectAttestationId",status::text,revision::text FROM canonical_subject_source_bindings WHERE source_binding_id=$1::uuid', id))[0] ?? null,
    readCurrentSourceBindingsForAttestation: async id => rows<any>(client, `SELECT source_binding_id::text AS "sourceBindingId",source_namespace AS "sourceNamespace",source_local_value AS "sourceLocalValue",subject_attestation_id::text AS "subjectAttestationId",status::text,revision::text FROM canonical_subject_source_bindings WHERE subject_attestation_id=$1::uuid AND status IN ('planned','active') ORDER BY source_binding_id`, id),
    readDelegation: async id => (await rows<any>(client, `SELECT delegation_id::text AS "delegationId",status::text,revision::text,(CASE WHEN delegated_actor_type='user' THEN 'user:'||delegated_user_id::text ELSE 'machine_principal:'||delegated_machine_principal_id::text END) AS "delegatedActorRef",authorized_subject_type::text AS "authorizedSubjectType",authorized_business_subject_ids::text[] AS "authorizedBusinessSubjectIds",authorized_operations AS "authorizedOperations",effective_at::text AS "effectiveAt",expires_at::text AS "expiresAt" FROM identity_attestation_delegations WHERE delegation_id=$1::uuid`, id))[0] ?? null,
    readAgentLifecycle: async principalId => (await rows<any>(client, 'SELECT principal_id::text AS "principalId",state::text,revision::text FROM agent_identity_lifecycle WHERE principal_id=$1::uuid', principalId))[0] ?? null,
    readSuccessor: async principalId => (await rows<any>(client, 'SELECT source_principal_id::text AS "sourcePrincipalId",target_principal_id::text AS "targetPrincipalId" FROM agent_identity_successors WHERE source_principal_id=$1::uuid', principalId))[0] ?? null,
    readIncomingSuccessorCount: async principalId => Number((await rows<{ count: bigint }>(client, 'SELECT count(*)::bigint AS count FROM agent_identity_successors WHERE target_principal_id=$1::uuid', principalId))[0]?.count ?? 0),
    readActiveAttestationsForMachinePrincipal: async principalId => (await rows<any>(client, "SELECT subject_attestation_id::text AS \"subjectAttestationId\",business_subject_id::text AS \"businessSubjectId\",subject_type::text AS \"subjectType\",machine_principal_id::text AS \"machinePrincipalId\",user_id::text AS \"userId\",canonical_agent_id AS \"canonicalAgentId\",status::text,revision::text FROM canonical_subject_attestations WHERE machine_principal_id=$1::uuid AND status='active' ORDER BY subject_attestation_id", principalId)).map(attestationRecord),
    readCommittedOperation: async operationId => (await rows<any>(client, 'SELECT operation_id::text AS "operationId",environment,actor_ref AS "actorRef",packet_digest AS "packetDigest",authority_digest AS "authorityDigest",prestate_digest AS "prestateDigest",plan_digest AS "planDigest",attestation_authority_manifest_digest AS "authorityManifestDigest",poststate_digest AS "poststateDigest",mutation_counts AS "mutationCounts",committed_at::text AS "committedAt" FROM canonical_subject_operations WHERE operation_id=$1::uuid', operationId))[0] ?? null,
    readOperationAuthorityManifest: async operationId => (await rows<any>(client, 'SELECT mutation_key AS "mutationKey",business_subject_id::text AS "businessSubjectId",subject_attestation_id::text AS "subjectAttestationId",predecessor_id::text AS "predecessorId",subject_type::text AS "subjectType",target,authority_kind::text AS "authorityKind",authority_ref AS "authorityRef",authority_digest AS "authorityDigest",requested_operation::text AS "requestedOperation",intended_disposition::text AS "intendedDisposition",delegation_id::text AS "delegationId",delegation_revision::text AS "delegationRevision" FROM canonical_subject_operation_authorities WHERE operation_id=$1::uuid ORDER BY mutation_key', operationId)).map(row => ({ mutationKey: row.mutationKey, businessSubjectId: row.businessSubjectId, subjectAttestationId: row.subjectAttestationId, ...(row.predecessorId ? { predecessorId: row.predecessorId } : {}), subjectType: row.subjectType, target: row.target, authorityKind: row.authorityKind, authorityRef: row.authorityRef, authorityDigest: row.authorityDigest, requestedOperation: row.requestedOperation, intendedDisposition: row.intendedDisposition, ...(row.delegationId ? { delegationId: row.delegationId, delegationRevision: row.delegationRevision } : {}) })),
  };
}

export async function planCanonicalSubjectEnrollmentInSnapshot(imported: ImportedCanonicalSubjectPacket, evidence: CanonicalSubjectEvidenceProvider, db: CanonicalSubjectReadDatabase = defaultReadDatabase, options: { now?: Date; timeoutMs?: number } = {}): Promise<CanonicalSubjectPlan> {
  const timeout = options.timeoutMs ?? 5000;
  try {
    return await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${Math.max(1, Math.floor(timeout))}ms'`);
      return planCanonicalSubjectEnrollment(imported, createCanonicalSubjectReadStore(tx), evidence, { now: options.now });
    }, { isolationLevel: 'RepeatableRead', timeout, maxWait: timeout });
  }
  catch (error) {
    if (error && typeof error === 'object' && canonicalSubjectErrorCodes.includes((error as any).code)) throw error;
    const code = String((error as any)?.meta?.code ?? (error as any)?.code ?? '');
    if (['P1008', 'P2024', '57014'].includes(code)) fail('LOCK_TIMEOUT', imported.packet.operationId, null, 503);
    fail('PRESTATE_CHANGED', imported.packet.operationId, null, 503);
  }
}

function actorColumns(actor: { kind: string; id: string }): [string | null, string | null, string | null] {
  return actor.kind === 'user' ? [actor.id, null, null] : actor.kind === 'machine_principal' ? [null, actor.id, null] : [null, null, actor.id];
}
async function expectOneUpdate(tx: RawClient, mutationKey: string, field: string, query: string, ...values: unknown[]): Promise<void> {
  if (await tx.$executeRawUnsafe(query, ...values) !== 1)
    fail('PRESTATE_CHANGED', mutationKey, field);
}
async function executeMutation(tx: RawClient, mutation: CanonicalSubjectMutation): Promise<void> {
  switch (mutation.operation) {
    case 'ACTIVATE_ATTESTATION':
    case 'SUPERSEDE_ATTESTATION': {
      if (mutation.operation === 'SUPERSEDE_ATTESTATION')
        await expectOneUpdate(tx, mutation.mutationKey, 'predecessorAttestationId', "UPDATE canonical_subject_attestations SET status='superseded',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE subject_attestation_id=$1::uuid AND status='active' AND revision=$2::bigint", mutation.predecessorAttestationId, mutation.expectedPredecessorRevision);
      const [byUser, byMachine, byExternal] = actorColumns(mutation.attestedBy);
      await tx.$executeRawUnsafe(`INSERT INTO canonical_subject_attestations(subject_attestation_id,business_subject_id,subject_type,business_subject_description,machine_principal_id,user_id,canonical_agent_id,authority_source,attested_by_kind,attested_by_user_id,attested_by_machine_principal_id,attested_by_external_ref,attestation_authority_kind,attestation_authority_ref,attestation_authority_digest,attestation_authority_operation,delegation_id,effective_at,evidence_ref,supersedes_attestation_id,revision,status) VALUES($1::uuid,$2::uuid,$3::"CanonicalSubjectType",$4,$5::uuid,$6::uuid,$7,$8,$9::"AttestationActorKind",$10::uuid,$11::uuid,$12,$13::"AttestationAuthorityKind",$14,$15,$16::"AttestationAuthorityOperation",$17::uuid,$18::timestamptz,$19,$20::uuid,1,'active')`, mutation.subjectAttestationId, mutation.businessSubjectId, mutation.subjectType, mutation.businessSubjectDescription, mutation.target.machinePrincipalId ?? null, mutation.target.userId ?? null, mutation.target.canonicalAgentId ?? null, mutation.authoritySource, mutation.attestedBy.kind, byUser, byMachine, byExternal, mutation.authority.kind, mutation.authority.ref, mutation.authority.digest, mutation.authority.requestedOperation, mutation.authority.delegationId ?? null, mutation.effectiveAt, mutation.evidenceRef, mutation.operation === 'SUPERSEDE_ATTESTATION' ? mutation.predecessorAttestationId : null);
      return;
    }
    case 'REVOKE_ATTESTATION':
      await expectOneUpdate(tx, mutation.mutationKey, 'subjectAttestationId', "UPDATE canonical_subject_attestations SET status='revoked',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE subject_attestation_id=$1::uuid AND status='active' AND revision=$2::bigint", mutation.subjectAttestationId, mutation.expectedRevision); return;
    case 'INSTALL_ATTESTATION_DELEGATION':
      await tx.$executeRawUnsafe(`INSERT INTO identity_attestation_delegations(delegation_id,delegated_actor_type,delegated_user_id,delegated_machine_principal_id,authorized_subject_type,authorized_business_subject_ids,authorized_operations,owner_authority_ref,owner_authority_digest,effective_at,expires_at,status,revision) VALUES($1::uuid,$2::"DelegatedActorType",$3::uuid,$4::uuid,$5::"CanonicalSubjectType",$6::uuid[],$7::text[],$8,$9,$10::timestamptz,$11::timestamptz,'active',1)`, mutation.delegationId, mutation.delegatedActor.kind, mutation.delegatedActor.kind === 'user' ? mutation.delegatedActor.id : null, mutation.delegatedActor.kind === 'machine_principal' ? mutation.delegatedActor.id : null, mutation.authorizedSubjectType, mutation.authorizedBusinessSubjectIds, mutation.authorizedOperations, mutation.ownerAuthorityRef, mutation.ownerAuthorityDigest, mutation.effectiveAt, mutation.expiresAt); return;
    case 'REVOKE_ATTESTATION_DELEGATION':
      await expectOneUpdate(tx, mutation.mutationKey, 'delegationId', "UPDATE identity_attestation_delegations SET status='revoked',revision=revision+1,revoked_at=CURRENT_TIMESTAMP,revocation_authority_ref=$3,updated_at=CURRENT_TIMESTAMP WHERE delegation_id=$1::uuid AND status='active' AND revision=$2::bigint", mutation.delegationId, mutation.expectedRevision, mutation.revocationAuthorityRef); return;
    case 'TRANSITION_AGENT_LIFECYCLE':
      if (mutation.fromState === 'absent')
        await tx.$executeRawUnsafe('INSERT INTO agent_identity_lifecycle(principal_id,state,revision,evidence_ref) VALUES($1::uuid,$2::"AgentIdentityState",1,$3)', mutation.principalId, mutation.toState, mutation.evidenceRef);
      else
        await expectOneUpdate(tx, mutation.mutationKey, 'principalId', 'UPDATE agent_identity_lifecycle SET state=$2::"AgentIdentityState",revision=revision+1,evidence_ref=$3,updated_at=CURRENT_TIMESTAMP WHERE principal_id=$1::uuid AND state=$4::"AgentIdentityState" AND revision=$5::bigint', mutation.principalId, mutation.toState, mutation.evidenceRef, mutation.fromState, mutation.expectedRevision);
      return;
    case 'INSTALL_EXPLICIT_SUCCESSOR':
      await tx.$executeRawUnsafe('INSERT INTO agent_identity_successors(source_principal_id,target_principal_id,evidence_ref) VALUES($1::uuid,$2::uuid,$3)', mutation.sourcePrincipalId, mutation.targetPrincipalId, mutation.evidenceRef); return;
    case 'ACTIVATE_SOURCE_BINDING':
      if (mutation.expectedRevision === null)
        await tx.$executeRawUnsafe(`INSERT INTO canonical_subject_source_bindings(source_binding_id,source_namespace,source_local_value,subject_attestation_id,semantics,effective_at,evidence_ref,status,revision) VALUES($1::uuid,$2,$3,$4::uuid,'prospective_binding',$5::timestamptz,$6,'active',1)`, mutation.sourceBindingId, mutation.sourceNamespace, mutation.sourceLocalValue, mutation.subjectAttestationId, mutation.effectiveAt, mutation.evidenceRef);
      else
        await expectOneUpdate(tx, mutation.mutationKey, 'sourceBindingId', "UPDATE canonical_subject_source_bindings SET status='active',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE source_binding_id=$1::uuid AND source_namespace=$2 AND source_local_value=$3 AND subject_attestation_id=$4::uuid AND status='planned' AND revision=$5::bigint", mutation.sourceBindingId, mutation.sourceNamespace, mutation.sourceLocalValue, mutation.subjectAttestationId, mutation.expectedRevision);
      return;
    case 'SUPERSEDE_SOURCE_BINDING':
      await expectOneUpdate(tx, mutation.mutationKey, 'predecessorSourceBindingId', "UPDATE canonical_subject_source_bindings SET status='superseded',revision=revision+1,superseded_at=CURRENT_TIMESTAMP,supersession_evidence_ref=$3,updated_at=CURRENT_TIMESTAMP WHERE source_binding_id=$1::uuid AND status IN ('planned','active') AND revision=$2::bigint", mutation.predecessorSourceBindingId, mutation.expectedPredecessorRevision, mutation.supersessionEvidenceRef);
      await tx.$executeRawUnsafe(`INSERT INTO canonical_subject_source_bindings(source_binding_id,source_namespace,source_local_value,subject_attestation_id,semantics,effective_at,evidence_ref,status,revision,supersedes_source_binding_id) VALUES($1::uuid,$2,$3,$4::uuid,'prospective_binding',$5::timestamptz,$6,'active',1,$7::uuid)`, mutation.replacementSourceBindingId, mutation.sourceNamespace, mutation.sourceLocalValue, mutation.subjectAttestationId, mutation.effectiveAt, mutation.evidenceRef, mutation.predecessorSourceBindingId); return;
    case 'EXIT_SOURCE_BINDING':
      await expectOneUpdate(tx, mutation.mutationKey, 'sourceBindingId', "UPDATE canonical_subject_source_bindings SET status='exited',revision=revision+1,exited_at=CURRENT_TIMESTAMP,exit_evidence_ref=$3,updated_at=CURRENT_TIMESTAMP WHERE source_binding_id=$1::uuid AND status IN ('planned','active','superseded') AND revision=$2::bigint", mutation.sourceBindingId, mutation.expectedRevision, mutation.exitEvidenceRef); return;
  }
}

function executionRank(mutation: CanonicalSubjectMutation): number {
  switch (mutation.operation) {
    case 'INSTALL_ATTESTATION_DELEGATION': return 10;
    case 'TRANSITION_AGENT_LIFECYCLE': return mutation.toState === 'canonical' ? 20 : 70;
    case 'ACTIVATE_ATTESTATION':
    case 'SUPERSEDE_ATTESTATION': return 40;
    case 'ACTIVATE_SOURCE_BINDING':
    case 'SUPERSEDE_SOURCE_BINDING':
    case 'EXIT_SOURCE_BINDING': return 50;
    case 'REVOKE_ATTESTATION': return 60;
    case 'INSTALL_EXPLICIT_SUCCESSOR': return 80;
    case 'REVOKE_ATTESTATION_DELEGATION': return 90;
  }
}

async function actualPoststate(store: CanonicalSubjectReadStore, mutations: CanonicalSubjectMutation[]): Promise<unknown[]> {
  const output: unknown[] = [];
  for (const mutation of mutations) {
    let current: unknown = null, predecessor: unknown = undefined;
    if (mutation.operation === 'ACTIVATE_ATTESTATION' || mutation.operation === 'REVOKE_ATTESTATION') current = await store.readAttestation(mutation.subjectAttestationId);
    else if (mutation.operation === 'SUPERSEDE_ATTESTATION') { current = await store.readAttestation(mutation.subjectAttestationId); predecessor = await store.readAttestation(mutation.predecessorAttestationId); }
    else if (mutation.operation === 'INSTALL_ATTESTATION_DELEGATION' || mutation.operation === 'REVOKE_ATTESTATION_DELEGATION') current = await store.readDelegation(mutation.delegationId);
    else if (mutation.operation === 'TRANSITION_AGENT_LIFECYCLE') current = await store.readAgentLifecycle(mutation.principalId);
    else if (mutation.operation === 'INSTALL_EXPLICIT_SUCCESSOR') current = await store.readSuccessor(mutation.sourcePrincipalId);
    else if (mutation.operation === 'ACTIVATE_SOURCE_BINDING' || mutation.operation === 'EXIT_SOURCE_BINDING') current = await store.readSourceBindingById(mutation.sourceBindingId);
    else { current = await store.readSourceBindingById(mutation.replacementSourceBindingId); predecessor = await store.readSourceBindingById(mutation.predecessorSourceBindingId); }
    const compact = (value: any) => value ? ('sourcePrincipalId' in value ? { sourcePrincipalId: value.sourcePrincipalId, targetPrincipalId: value.targetPrincipalId } : { id: value.sourceBindingId ?? value.subjectAttestationId ?? value.delegationId ?? value.principalId, status: value.status ?? value.state, revision: value.revision }) : null;
    output.push({ mutationKey: mutation.mutationKey, operation: mutation.operation, ...(predecessor !== undefined ? { predecessor: compact(predecessor) } : {}), current: compact(current) });
  }
  return output;
}

export interface ApplyResult { result: 'APPLIED' | 'NOOP'; operationId: string; planDigest: string; poststateDigest: string }
function assertPlanIntegrity(imported: ImportedCanonicalSubjectPacket, plan: CanonicalSubjectPlan): void {
  if (!plan || typeof plan !== 'object' || plan.operationId !== imported.packet.operationId || plan.packetDigest !== imported.packetDigest || canonicalJson(plan.mutations) !== canonicalJson(imported.packet.mutations))
    fail('PACKET_DIGEST_MISMATCH', imported.packet.operationId, 'packetDigest', 400);
  const expectedManifest = plan.mutations.filter((mutation): mutation is AttestationMutation => mutation.operation === 'ACTIVATE_ATTESTATION' || mutation.operation === 'SUPERSEDE_ATTESTATION' || mutation.operation === 'REVOKE_ATTESTATION').map(authorityManifestEntryForMutation);
  if (canonicalJson(plan.authorityManifest) !== canonicalJson(expectedManifest) || hashCanonical(plan.authorityManifest) !== plan.authorityManifestDigest || hashCanonical(expectedPoststate(plan.mutations)) !== plan.expectedPoststateDigest)
    fail('ATTESTATION_AUTHORITY_MANIFEST_MISMATCH', plan.operationId, 'authorityManifest');
  const { planDigest, authorityManifest: _manifest, ...basis } = plan;
  if (hashCanonical(basis) !== planDigest)
    fail('PACKET_DIGEST_MISMATCH', plan.operationId, 'planDigest', 400);
}
async function refreshCoreEvidenceImmediatelyBeforeApply(plan: CanonicalSubjectPlan, evidence: CanonicalSubjectEvidenceProvider, at: Date): Promise<void> {
  for (const mutation of plan.mutations) {
    let target: TargetReference | null = null;
    if ((mutation.operation === 'ACTIVATE_ATTESTATION' || mutation.operation === 'SUPERSEDE_ATTESTATION' || mutation.operation === 'REVOKE_ATTESTATION') && mutation.subjectType === 'agent')
      target = mutation.target;
    else if (mutation.operation === 'TRANSITION_AGENT_LIFECYCLE' && mutation.toState === 'canonical' && mutation.canonicalAgentId)
      target = { machinePrincipalId: mutation.principalId, canonicalAgentId: mutation.canonicalAgentId };
    if (!target) continue;
    const fresh = await evidence.validateCoreAgent(target, at);
    if (!fresh.valid || fresh.principalId !== target.machinePrincipalId || fresh.agentId !== target.canonicalAgentId || Date.parse(fresh.expiresAt) <= at.getTime() || !plan.coreEvidenceDigests.includes(fresh.evidenceDigest))
      fail('TARGET_AUTHORITY_INCONSISTENT', mutation.mutationKey, 'target');
  }
}
export async function applyCanonicalSubjectPlan(imported: ImportedCanonicalSubjectPacket, reviewedPlan: CanonicalSubjectPlan, evidence: CanonicalSubjectEvidenceProvider, db: CanonicalSubjectWriteDatabase = defaultWriteDatabase, options: { now?: Date; timeoutMs?: number } = {}): Promise<ApplyResult> {
  const at = options.now ?? new Date();
  assertPlanIntegrity(imported, reviewedPlan);
  if (at.getTime() >= Date.parse(reviewedPlan.expiresAt)) fail('PLAN_EXPIRED', reviewedPlan.operationId, 'expiresAt');
  const timeout = options.timeoutMs ?? 5000;
  const execution = { phase: 'mutation' as 'mutation' | 'audit' };
  try {
    return await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${Math.max(1, Math.floor(timeout))}ms'`);
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(173496021,1)');
      for (const delegationId of [...new Set(reviewedPlan.authorityManifest.map(entry => entry.delegationId).filter((value): value is string => Boolean(value)))].sort())
        await tx.$queryRawUnsafe('SELECT delegation_id::text FROM identity_attestation_delegations WHERE delegation_id=$1::uuid FOR UPDATE', delegationId);
      const store = createCanonicalSubjectReadStore(tx);
      const prior = await store.readCommittedOperation(reviewedPlan.operationId);
      if (prior) {
        if (prior.planDigest !== reviewedPlan.planDigest || prior.poststateDigest !== reviewedPlan.expectedPoststateDigest)
          fail('IDEMPOTENCY_CONFLICT', reviewedPlan.operationId, 'planDigest');
        return { result: 'NOOP', operationId: reviewedPlan.operationId, planDigest: reviewedPlan.planDigest, poststateDigest: prior.poststateDigest };
      }
      await refreshCoreEvidenceImmediatelyBeforeApply(reviewedPlan, evidence, at);
      const fresh = await planCanonicalSubjectEnrollment(imported, store, evidence, { now: at });
      if (fresh.planDigest !== reviewedPlan.planDigest || fresh.prestateDigest !== reviewedPlan.prestateDigest)
        fail('PRESTATE_CHANGED', reviewedPlan.operationId, 'prestateDigest');
      if (fresh.disposition === 'NOOP')
        return { result: 'NOOP', operationId: reviewedPlan.operationId, planDigest: reviewedPlan.planDigest, poststateDigest: reviewedPlan.expectedPoststateDigest };
      for (const mutation of [...reviewedPlan.mutations].filter(item => item.operation !== 'TRANSITION_AGENT_LIFECYCLE' || item.fromState !== item.toState).sort((a, b) => executionRank(a) - executionRank(b) || a.mutationKey.localeCompare(b.mutationKey)))
        await executeMutation(tx, mutation);
      const poststate = await actualPoststate(store, reviewedPlan.mutations);
      const poststateDigest = hashCanonical(poststate);
      if (poststateDigest !== reviewedPlan.expectedPoststateDigest)
        fail('VERIFY_MISMATCH', reviewedPlan.operationId, 'poststateDigest');
      execution.phase = 'audit';
      await tx.$executeRawUnsafe(`INSERT INTO canonical_subject_operations(operation_id,environment,actor_ref,packet_digest,authority_digest,prestate_digest,plan_digest,core_evidence_digest,attestation_authority_manifest_digest,poststate_digest,mutation_counts) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, reviewedPlan.operationId, reviewedPlan.environment, reviewedPlan.actorRef, reviewedPlan.packetDigest, reviewedPlan.authorityDigest, reviewedPlan.prestateDigest, reviewedPlan.planDigest, reviewedPlan.coreEvidenceDigests.length ? hashCanonical(reviewedPlan.coreEvidenceDigests) : null, reviewedPlan.authorityManifestDigest, poststateDigest, JSON.stringify(reviewedPlan.mutationCounts));
      for (const entry of reviewedPlan.authorityManifest)
        await tx.$executeRawUnsafe(`INSERT INTO canonical_subject_operation_authorities(operation_id,mutation_key,business_subject_id,subject_attestation_id,predecessor_id,subject_type,target,authority_kind,authority_ref,authority_digest,requested_operation,intended_disposition,delegation_id,delegation_revision) VALUES($1::uuid,$2,$3::uuid,$4::uuid,$5::uuid,$6::"CanonicalSubjectType",$7::jsonb,$8::"AttestationAuthorityKind",$9,$10,$11::"AttestationAuthorityOperation",$12::"SubjectAttestationStatus",$13::uuid,$14::bigint)`, reviewedPlan.operationId, entry.mutationKey, entry.businessSubjectId, entry.subjectAttestationId, entry.predecessorId ?? null, entry.subjectType, JSON.stringify(entry.target), entry.authorityKind, entry.authorityRef, entry.authorityDigest, entry.requestedOperation, entry.intendedDisposition, entry.delegationId ?? null, entry.delegationRevision ?? null);
      return { result: 'APPLIED', operationId: reviewedPlan.operationId, planDigest: reviewedPlan.planDigest, poststateDigest };
    }, { isolationLevel: 'Serializable', timeout, maxWait: timeout });
  }
  catch (error) {
    if (error && typeof error === 'object' && canonicalSubjectErrorCodes.includes((error as any).code)) throw error;
    const code = String((error as any)?.meta?.code ?? (error as any)?.code ?? '');
    const providerSummary = `${code} ${String((error as any)?.meta?.message ?? '')} ${String((error as any)?.message ?? '')}`;
    if (['40001', '40P01', 'P2034'].some(value => providerSummary.includes(value))) fail('SERIALIZATION_FAILURE', reviewedPlan.operationId, null, 503);
    if (['55P03', 'P1008', 'P2024', 'P2028', 'lock timeout', 'Transaction already closed'].some(value => providerSummary.includes(value))) fail('LOCK_TIMEOUT', reviewedPlan.operationId, null, 503);
    if (['P1001', 'P1002'].includes(code)) fail('OUTCOME_UNKNOWN', reviewedPlan.operationId, null, 503);
    if (execution.phase === 'audit') fail('AUDIT_WRITE_FAILED', reviewedPlan.operationId, null);
    fail('PRESTATE_CHANGED', reviewedPlan.operationId, null);
  }
}

export async function verifyCanonicalSubjectOperation(plan: CanonicalSubjectPlan, store: CanonicalSubjectReadStore, evidence: CanonicalSubjectEvidenceProvider, options: { observedAt?: Date } = {}) {
  const verifiedAt = options.observedAt ?? new Date();
  const operation = await store.readCommittedOperation(plan.operationId);
  const authorityCoordinates = { packet: { ref: plan.authorityRef, digest: plan.authorityDigest }, manifestDigest: plan.authorityManifestDigest, entries: plan.authorityManifest.map(entry => ({ mutationKey: entry.mutationKey, kind: entry.authorityKind, ref: entry.authorityRef, digest: entry.authorityDigest, operation: entry.requestedOperation, disposition: entry.intendedDisposition })) };
  const baseReceipt = { operationId: plan.operationId, environment: plan.environment, actor: plan.actorRef, authorityCoordinates, packetDigest: plan.packetDigest, prestateDigest: plan.prestateDigest, planDigest: plan.planDigest, mutationCounts: plan.mutationCounts, verifiedAt: verifiedAt.toISOString() };
  if (!operation) return { ...baseReceipt, poststateDigest: plan.expectedPoststateDigest, commitObservedAt: null, result: 'OUTCOME_UNKNOWN' as const };
  const poststate = await actualPoststate(store, plan.mutations);
  const digest = hashCanonical(poststate);
  const actualManifest = await store.readOperationAuthorityManifest(plan.operationId);
  let externalEvidenceValid = true;
  try {
    for (const mutation of plan.mutations) {
      if (mutation.operation === 'ACTIVATE_ATTESTATION' || mutation.operation === 'SUPERSEDE_ATTESTATION') {
        const attestation = mutation as AttestationMutation;
        await validateTarget(attestation, await store.readTarget(attestation.target));
        if (attestation.subjectType === 'agent') {
          const core = await evidence.validateCoreAgent(attestation.target, verifiedAt);
          if (!core.valid || core.principalId !== attestation.target.machinePrincipalId || core.agentId !== attestation.target.canonicalAgentId || Date.parse(core.expiresAt) <= verifiedAt.getTime() || !plan.coreEvidenceDigests.includes(core.evidenceDigest))
            externalEvidenceValid = false;
        }
      }
      else if (mutation.operation === 'EXIT_SOURCE_BINDING') {
        const exit = await evidence.validateSourceExit({ sourceNamespace: mutation.sourceNamespace, sourceLocalValue: mutation.sourceLocalValue, evidenceRef: mutation.exitEvidenceRef }, verifiedAt);
        if (!exit.valid || !exit.zeroLive || !plan.coreEvidenceDigests.includes(exit.evidenceDigest))
          externalEvidenceValid = false;
      }
      else if (mutation.operation === 'TRANSITION_AGENT_LIFECYCLE' && mutation.toState === 'canonical' && mutation.canonicalAgentId) {
        const target = { machinePrincipalId: mutation.principalId, canonicalAgentId: mutation.canonicalAgentId };
        validateAgentPrincipalCandidate(mutation.mutationKey, mutation.canonicalAgentId, await store.readTarget(target), ['canonical']);
        const core = await evidence.validateCoreAgent(target, verifiedAt);
        if (!core.valid || core.principalId !== mutation.principalId || core.agentId !== mutation.canonicalAgentId || Date.parse(core.expiresAt) <= verifiedAt.getTime() || !plan.coreEvidenceDigests.includes(core.evidenceDigest))
          externalEvidenceValid = false;
      }
      else if (mutation.operation === 'TRANSITION_AGENT_LIFECYCLE' && (mutation.toState === 'retired' || (mutation.fromState === 'canonical' && mutation.toState === 'legacy'))) {
        const predicates = await evidence.validateLifecyclePredicates({ principalId: mutation.principalId, targetState: mutation.toState }, verifiedAt);
        const exact = predicates.valid && predicates.liveWritableReferences === 0 && predicates.activeWorkOwnerReferences === 0 && predicates.activeGrantsRequired === 0 && predicates.activeClientRequired === 0 && (mutation.toState !== 'retired' || predicates.successorMappingVerified) && plan.coreEvidenceDigests.includes(predicates.evidenceDigest);
        if (!exact || await store.readIncomingSuccessorCount(mutation.principalId) !== 0)
          externalEvidenceValid = false;
        const successor = await store.readSuccessor(mutation.principalId);
        if (mutation.toState === 'retired' && !successor)
          externalEvidenceValid = false;
        if (successor)
          validateAgentPrincipalCandidate(mutation.mutationKey, undefined, await store.readTarget({ machinePrincipalId: successor.targetPrincipalId }), ['canonical']);
        if ((await store.readActiveAttestationsForMachinePrincipal(mutation.principalId)).length !== 0)
          externalEvidenceValid = false;
      }
    }
  }
  catch {
    externalEvidenceValid = false;
  }
  const operationMatches = operation.environment === plan.environment && operation.actorRef === plan.actorRef && operation.packetDigest === plan.packetDigest && operation.authorityDigest === plan.authorityDigest && operation.prestateDigest === plan.prestateDigest && operation.planDigest === plan.planDigest && operation.authorityManifestDigest === plan.authorityManifestDigest && operation.poststateDigest === plan.expectedPoststateDigest && canonicalJson(operation.mutationCounts) === canonicalJson(plan.mutationCounts);
  const result = operationMatches && hashCanonical(actualManifest) === plan.authorityManifestDigest && digest === plan.expectedPoststateDigest && externalEvidenceValid ? 'PASS' as const : 'FAIL' as const;
  return { ...baseReceipt, poststateDigest: digest, commitObservedAt: operation.committedAt, result };
}

export async function verifyCanonicalSubjectOperationInSnapshot(plan: CanonicalSubjectPlan, evidence: CanonicalSubjectEvidenceProvider, db: CanonicalSubjectReadDatabase = defaultReadDatabase, options: { observedAt?: Date; timeoutMs?: number } = {}) {
  const timeout = options.timeoutMs ?? 5000;
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${Math.max(1, Math.floor(timeout))}ms'`);
    return verifyCanonicalSubjectOperation(plan, createCanonicalSubjectReadStore(tx), evidence, { observedAt: options.observedAt });
  }, { isolationLevel: 'RepeatableRead', timeout, maxWait: timeout });
}

export async function reconcileCanonicalSubjectOutcome(plan: CanonicalSubjectPlan, store: CanonicalSubjectReadStore): Promise<{ result: 'PASS' | 'OUTCOME_UNKNOWN'; operationId: string; committed: boolean }> {
  const committed = await store.readCommittedOperation(plan.operationId);
  if (!committed)
    return { result: 'OUTCOME_UNKNOWN', operationId: plan.operationId, committed: false };
  if (committed.planDigest !== plan.planDigest || committed.poststateDigest !== plan.expectedPoststateDigest)
    fail('VERIFY_MISMATCH', plan.operationId, 'poststateDigest');
  if (hashCanonical(await actualPoststate(store, plan.mutations)) !== plan.expectedPoststateDigest)
    fail('VERIFY_MISMATCH', plan.operationId, 'poststateDigest');
  return { result: 'PASS', operationId: plan.operationId, committed: true };
}
