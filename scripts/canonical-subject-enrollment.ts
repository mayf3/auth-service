/** Offline/controlled vehicle. Source merge does not authorize production use. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { prisma } from '../src/lib/prisma.js';
import {
  applyCanonicalSubjectPlan,
  canonicalJson,
  canonicalSubjectErrorCodes,
  importCanonicalSubjectPacket,
  planCanonicalSubjectEnrollmentInSnapshot,
  verifyCanonicalSubjectOperationInSnapshot,
  type AuthorityManifestEntry,
  type CanonicalSubjectEvidenceProvider,
  type CanonicalSubjectPlan,
  type TargetReference,
} from '../src/lib/oauth/v1/canonical-subject-enrollment.js';

const digest = z.string().regex(/^[0-9a-f]{64}$/);
const registrySchema = z.object({
  registryVersion: z.literal('1'),
  packetAuthorities: z.array(z.object({ operationId: z.string().uuid(), packetDigest: digest, authorityRef: z.string().min(1), authorityDigest: digest, actorRef: z.string().min(1), mutationKeys: z.array(z.string().min(1)).min(1), accepted: z.literal(true) }).strict()),
  attestationAuthorities: z.array(z.object({
    actorRef: z.string().min(1), mutationKey: z.string().min(1), businessSubjectId: z.string().uuid(), subjectAttestationId: z.string().uuid(),
    predecessorId: z.string().uuid().optional(),
    subjectType: z.enum(['agent', 'human', 'service']), target: z.record(z.string(), z.string()), authorityKind: z.enum(['owner_exact', 'delegated', 'accepted_governing_authority']),
    authorityRef: z.string().min(1), authorityDigest: digest, requestedOperation: z.enum(['activate', 'supersede', 'revoke']), intendedDisposition: z.enum(['active', 'superseded', 'revoked']), accepted: z.literal(true),
    delegationId: z.string().uuid().optional(), delegationRevision: z.string().regex(/^[1-9][0-9]*$/).optional(),
  }).strict()),
  coreAgents: z.array(z.object({ machinePrincipalId: z.string().uuid(), canonicalAgentId: z.string().min(1), evidenceDigest: digest, expiresAt: z.string().datetime({ offset: true }) }).strict()),
  sourceExits: z.array(z.object({ sourceNamespace: z.string().min(1), sourceLocalValue: z.string().min(1), zeroLive: z.literal(true), evidenceDigest: digest }).strict()),
  lifecyclePredicates: z.array(z.object({ principalId: z.string().uuid(), targetState: z.enum(['legacy', 'retired']), evidenceDigest: digest, liveWritableReferences: z.literal(0), activeWorkOwnerReferences: z.literal(0), activeGrantsRequired: z.literal(0), activeClientRequired: z.literal(0), successorMappingVerified: z.boolean() }).strict()),
}).strict();

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function evidenceProvider(path: string): CanonicalSubjectEvidenceProvider {
  const parsed = registrySchema.safeParse(loadJson(path));
  if (!parsed.success)
    throw { code: 'AUTHORITY_NOT_ACCEPTED', status: 409, recordKey: null, field: 'authorityRegistry' };
  const registry = parsed.data;
  return {
    validatePacketAuthority: async input => {
      const matches = registry.packetAuthorities.filter(item => item.operationId.toLowerCase() === input.operationId && item.packetDigest === input.packetDigest && item.authorityRef === input.authorityRef && item.authorityDigest === input.authorityDigest && item.actorRef === input.actorRef && canonicalJson([...item.mutationKeys].sort()) === canonicalJson(input.mutationKeys));
      return matches.length === 1 ? { valid: true, authorityDigest: matches[0].authorityDigest } : { valid: false };
    },
    validateAttestationAuthority: async (entry: AuthorityManifestEntry, actorRef: string) => {
      const matches = registry.attestationAuthorities.filter(item => item.actorRef === actorRef && item.mutationKey === entry.mutationKey && item.businessSubjectId.toLowerCase() === entry.businessSubjectId && item.subjectAttestationId.toLowerCase() === entry.subjectAttestationId && (item.predecessorId?.toLowerCase() ?? undefined) === entry.predecessorId && item.subjectType === entry.subjectType && canonicalJson(item.target) === canonicalJson(entry.target) && item.authorityKind === entry.authorityKind && item.authorityRef === entry.authorityRef && item.authorityDigest === entry.authorityDigest && item.requestedOperation === entry.requestedOperation && item.intendedDisposition === entry.intendedDisposition && (item.delegationId?.toLowerCase() ?? undefined) === entry.delegationId && item.delegationRevision === entry.delegationRevision);
      return matches.length === 1 ? { valid: true, authorityDigest: matches[0].authorityDigest } : { valid: false, code: 'ATTESTATION_AUTHORITY_INVALID' };
    },
    validateCoreAgent: async (target: TargetReference) => {
      const matches = registry.coreAgents.filter(item => item.machinePrincipalId.toLowerCase() === target.machinePrincipalId && item.canonicalAgentId === target.canonicalAgentId);
      return matches.length === 1 ? { valid: true, evidenceDigest: matches[0].evidenceDigest, principalId: matches[0].machinePrincipalId.toLowerCase(), agentId: matches[0].canonicalAgentId, expiresAt: matches[0].expiresAt } : { valid: false };
    },
    validateSourceExit: async input => {
      const matches = registry.sourceExits.filter(item => item.sourceNamespace === input.sourceNamespace && item.sourceLocalValue === input.sourceLocalValue);
      return matches.length === 1 ? { valid: true, zeroLive: true, evidenceDigest: matches[0].evidenceDigest } : { valid: false, zeroLive: false, evidenceDigest: '0'.repeat(64) };
    },
    validateLifecyclePredicates: async input => {
      const matches = registry.lifecyclePredicates.filter(item => item.principalId.toLowerCase() === input.principalId && item.targetState === input.targetState);
      return matches.length === 1 ? { valid: true, ...matches[0] } : { valid: false, evidenceDigest: '0'.repeat(64), liveWritableReferences: -1, activeWorkOwnerReferences: -1, activeGrantsRequired: -1, activeClientRequired: -1, successorMappingVerified: false };
    },
  };
}
function args(argv: string[]) {
  const command = argv[2];
  const values = new Map<string, string>();
  for (let index = 3; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || !argv[index + 1]) throw new Error('usage');
    values.set(argv[index].slice(2), argv[index + 1]);
  }
  const required = (key: string) => { const value = values.get(key); if (!value) throw new Error('usage'); return value; };
  return { command, values, required };
}
function emit(value: unknown, output?: string) {
  const bytes = canonicalJson(value) + '\n';
  if (output) writeFileSync(output, bytes, { flag: 'wx', mode: 0o600 });
  else process.stdout.write(bytes);
}

export async function runCanonicalSubjectEnrollmentCli(argv = process.argv): Promise<void> {
  const cli = args(argv);
  if (cli.command === 'import') {
    const imported = importCanonicalSubjectPacket(loadJson(cli.required('packet')));
    if (cli.values.has('out')) writeFileSync(cli.required('out'), imported.canonicalJson + '\n', { flag: 'wx', mode: 0o600 });
    emit({ operationId: imported.packet.operationId, packetDigest: imported.packetDigest, mutationCount: imported.packet.mutations.length, result: 'PASS' });
    return;
  }
  const imported = importCanonicalSubjectPacket(loadJson(cli.required('packet')));
  const evidence = evidenceProvider(cli.required('evidence'));
  if (cli.command === 'plan') {
    const plan = await planCanonicalSubjectEnrollmentInSnapshot(imported, evidence);
    emit(plan, cli.values.get('out'));
    return;
  }
  const plan = loadJson(cli.required('plan')) as CanonicalSubjectPlan;
  if (cli.command === 'apply') {
    emit(await applyCanonicalSubjectPlan(imported, plan, evidence));
    return;
  }
  if (cli.command === 'verify') {
    emit(await verifyCanonicalSubjectOperationInSnapshot(plan, evidence));
    return;
  }
  throw new Error('usage');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCanonicalSubjectEnrollmentCli().catch(error => {
    const code = error && typeof error === 'object' && canonicalSubjectErrorCodes.includes((error as any).code) ? (error as any).code : 'INVALID_PACKET';
    process.stdout.write(canonicalJson({ result: 'FAIL', error: { code } }) + '\n');
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}
