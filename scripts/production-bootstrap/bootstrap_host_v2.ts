/** Privileged bootstrap host for AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_PRODUCTION_BOOTSTRAP_V1.
 *
 * Executes the accepted canonical-subject enrollment implementation entry points
 * (import / plan / apply / verify) against the controlled evidence provider that
 * binds every authority coordinate to the sealed bootstrap artifacts. No HTTP or
 * startup integration. The bytes of this file, of every locally imported module,
 * and of every sealed artifact are verified by the privileged runner
 * (bootstrap_gate_runner_v1.py) before this host is ever invoked.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  applyCanonicalSubjectPlan,
  canonicalJson,
  hashCanonical,
  importCanonicalSubjectPacket,
  planCanonicalSubjectEnrollmentInSnapshot,
  verifyCanonicalSubjectOperationInSnapshot,
  type AuthorityManifestEntry,
  type CanonicalSubjectEvidenceProvider,
  type CanonicalSubjectPlan,
  type TargetReference,
} from '../../src/lib/oauth/v1/canonical-subject-enrollment.js';
import { prisma } from '../../src/lib/prisma.js';

const CORE_PATH = '/usr/local/libexec/agent-core/config/agents.json';
const FINAL_OWNER_PACKET = '/Users/yanfenma/.codex/identity-census/protected-closure-v1/canonical-subject-enrollment-packet-20260916/final-owner-decision-materialization-v1/CANONICAL_SUBJECT_ENROLLMENT_PACKET_V1_FINAL.json';
const FINAL_OWNER_DECISION = '/Users/yanfenma/.codex/identity-census/protected-closure-v1/canonical-subject-enrollment-packet-20260916/final-owner-decision-materialization-v1/FINAL_OWNER_TYPED_ATTESTATION_DECISION_V1.json';
const FROZEN_READY_PACKET = '/Users/yanfenma/.codex/identity-census/protected-closure-v1/canonical-subject-enrollment-packet-20260916/CANONICAL_SUBJECT_ENROLLMENT_READY_IMPORT_CANONICAL.json';
const EXPECTED_FINAL_OWNER_PACKET_SHA = 'df7f685f6e35681105a24941abf8f57754bae0b45aeb1272758be0a74ffa168c';
const EXPECTED_FINAL_OWNER_DECISION_SHA = '78cfb31f4ad527d2994c29c7a0c6b99244237511d3f8fca7bfad081a41dd6464';
const EXPECTED_FROZEN_READY_PACKET_SHA = '00ffd6029a46f7ab11d0e1187a09d8607bca930b1a58c891ca0d29bec785cb88';

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const fileSha = (path: string) => sha(readFileSync(path));
const load = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

function exactEntry(mutation: any): AuthorityManifestEntry {
  return {
    mutationKey: mutation.mutationKey,
    businessSubjectId: mutation.businessSubjectId,
    subjectAttestationId: mutation.subjectAttestationId,
    ...(mutation.predecessorAttestationId ? { predecessorId: mutation.predecessorAttestationId } : {}),
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

function evidenceProvider(imported: ReturnType<typeof importCanonicalSubjectPacket>): CanonicalSubjectEvidenceProvider {
  const packet = imported.packet;
  const mutationByKey = new Map(packet.mutations.map(m => [m.mutationKey, m]));
  const sourcesValid = packet.sourceArtifacts.every(a => {
    try { return fileSha(a.ref) === a.digest; } catch { return false; }
  });
  const finalOwner = load(FINAL_OWNER_PACKET);
  const finalSubjects = new Map(finalOwner.subjects.map((s: any) => [s.subject_attestation_id, s]));
  const frozen = load(FROZEN_READY_PACKET);
  const frozenBySubject = new Map(frozen.mutations.filter((m: any) => m.operation === 'ACTIVATE_ATTESTATION').map((m: any) => [m.subjectAttestationId, m]));
  const fixedArtifactsValid = fileSha(FINAL_OWNER_PACKET) === EXPECTED_FINAL_OWNER_PACKET_SHA
    && fileSha(FINAL_OWNER_DECISION) === EXPECTED_FINAL_OWNER_DECISION_SHA
    && fileSha(FROZEN_READY_PACKET) === EXPECTED_FROZEN_READY_PACKET_SHA;
  return {
    validatePacketAuthority: async input => {
      const exact = input.operationId === packet.operationId
        && input.packetDigest === imported.packetDigest
        && input.authorityRef === packet.authorityRef
        && input.authorityDigest === packet.authorityDigest
        && input.actorRef === packet.actorRef
        && canonicalJson(input.mutationKeys.slice().sort()) === canonicalJson(packet.mutations.map(m => m.mutationKey).sort())
        && sourcesValid && fixedArtifactsValid;
      return exact ? { valid: true, authorityDigest: packet.authorityDigest } : { valid: false };
    },
    validateAttestationAuthority: async entry => {
      const mutation: any = mutationByKey.get(entry.mutationKey);
      if (!mutation || !('authority' in mutation) || canonicalJson(exactEntry(mutation)) !== canonicalJson(entry))
        return { valid: false, code: 'ATTESTATION_AUTHORITY_INVALID' };
      const subject: any = finalSubjects.get(entry.subjectAttestationId);
      // Nullish-symmetric target comparison: FINAL packet records carry SQL-style
      // nulls while packet targets omit non-applicable keys (undefined) — e.g. the
      // HUMAN subject's machine_principal_id.
      if (!subject || (subject.machine_principal_id ?? null) !== (entry.target.machinePrincipalId ?? null) || (subject.user_id ?? null) !== (entry.target.userId ?? null) || (subject.canonical_agent_id ?? null) !== (entry.target.canonicalAgentId ?? null) || subject.owner_attestation_status !== 'FINAL')
        return { valid: false, code: 'ATTESTATION_AUTHORITY_INVALID' };
      if (entry.authorityKind === 'owner_exact') {
        if (entry.authorityRef !== 'FINAL_OWNER_TYPED_ATTESTATION_DECISION_V1' || entry.authorityDigest !== EXPECTED_FINAL_OWNER_DECISION_SHA)
          return { valid: false, code: 'ATTESTATION_AUTHORITY_INVALID' };
      } else if (entry.authorityKind === 'accepted_governing_authority') {
        const prior: any = frozenBySubject.get(entry.subjectAttestationId);
        if (!prior || canonicalJson(exactEntry(prior)) !== canonicalJson(entry))
          return { valid: false, code: 'ATTESTATION_AUTHORITY_INVALID' };
      } else return { valid: false, code: 'ATTESTATION_AUTHORITY_OUT_OF_SCOPE' };
      return { valid: true, authorityDigest: entry.authorityDigest };
    },
    validateCoreAgent: async (target: TargetReference) => {
      if (!target.machinePrincipalId || !target.canonicalAgentId) return { valid: false };
      const bytes = readFileSync(CORE_PATH);
      const config = JSON.parse(bytes.toString('utf8'));
      const matches = config.agents.filter((a: any) => a.id === target.canonicalAgentId);
      if (matches.length !== 1 || matches[0].disabled !== false) return { valid: false };
      return {
        valid: true,
        evidenceDigest: hashCanonical({ configSha256: sha(bytes), agent: matches[0] }),
        principalId: target.machinePrincipalId,
        agentId: target.canonicalAgentId,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      };
    },
    validateSourceExit: async () => ({ valid: false, zeroLive: false, evidenceDigest: sha('not-authorized') }),
    validateLifecyclePredicates: async () => ({ valid: false, evidenceDigest: sha('not-authorized'), liveWritableReferences: -1, activeWorkOwnerReferences: -1, activeGrantsRequired: -1, activeClientRequired: -1, successorMappingVerified: false }),
  };
}

function args() {
  const [command, packetPath, outputPath, planPath] = process.argv.slice(2);
  if (!command || !packetPath || !outputPath) throw new Error('usage');
  return { command, packetPath, outputPath, planPath };
}

async function main() {
  const a = args();
  const imported = importCanonicalSubjectPacket(load(a.packetPath));
  const evidence = evidenceProvider(imported);
  let result: unknown;
  if (a.command === 'import') {
    writeFileSync(a.outputPath, imported.canonicalJson + '\n', { flag: 'wx', mode: 0o600 });
    result = { operationId: imported.packet.operationId, packetDigest: imported.packetDigest, mutationCount: imported.packet.mutations.length };
  } else if (a.command === 'inspect') {
    const lifecycle = imported.packet.mutations.filter(m => m.operation === 'TRANSITION_AGENT_LIFECYCLE');
    result = {
      operationId: imported.packet.operationId,
      packetDigest: imported.packetDigest,
      mutationCount: imported.packet.mutations.length,
      operationCounts: Object.fromEntries(Object.entries(imported.packet.mutations.reduce((acc: Record<string, number>, m) => { acc[m.operation] = (acc[m.operation] ?? 0) + 1; return acc; }, {})).sort()),
      environment: imported.packet.environment,
      actorRef: imported.packet.actorRef,
      authorityRef: imported.packet.authorityRef,
      authorityDigest: imported.packet.authorityDigest,
      createdAt: imported.packet.createdAt,
      expiresAt: imported.packet.expiresAt,
      pairs: lifecycle.map(m => ({ principalId: (m as any).principalId, canonicalAgentId: (m as any).canonicalAgentId, fromState: (m as any).fromState, toState: (m as any).toState, expectedRevision: (m as any).expectedRevision })).sort((x, y) => x.principalId.localeCompare(y.principalId)),
    };
    writeFileSync(a.outputPath, canonicalJson(result) + '\n', { flag: 'wx', mode: 0o600 });
  } else if (a.command === 'plan') {
    result = await planCanonicalSubjectEnrollmentInSnapshot(imported, evidence, prisma as any, { timeoutMs: 30_000 });
  } else {
    if (!a.planPath) throw new Error('usage');
    const plan = load(a.planPath) as CanonicalSubjectPlan;
    if (a.command === 'apply-bootstrap') {
      if (!imported.packet.mutations.every(m => m.operation === 'TRANSITION_AGENT_LIFECYCLE' && m.toState === 'canonical')) throw new Error('apply-scope');
      result = await applyCanonicalSubjectPlan(imported, plan, evidence, prisma as any, { timeoutMs: 30_000 });
    } else if (a.command === 'verify') {
      result = await verifyCanonicalSubjectOperationInSnapshot(plan, evidence, prisma as any, { timeoutMs: 30_000 });
    } else throw new Error('usage');
  }
  if (a.command !== 'inspect' && a.command !== 'import') writeFileSync(a.outputPath, canonicalJson(result) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write(canonicalJson({ result: 'PASS', outputPath: a.outputPath, outputSha256: fileSha(a.outputPath), packetDigest: imported.packetDigest, operationId: imported.packet.operationId, ...(typeof result === 'object' && result && 'planDigest' in result ? { planDigest: (result as any).planDigest } : {}) }) + '\n');
}

main().catch((error: any) => {
  process.stdout.write(canonicalJson({ result: 'FAIL', error: { code: error?.code ?? 'HOST_ERROR', recordKey: error?.recordKey ?? null, field: error?.field ?? null } }) + '\n');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
