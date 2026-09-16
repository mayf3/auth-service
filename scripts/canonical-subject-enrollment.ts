/** Offline/controlled vehicle. Source merge does not authorize production use. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/prisma.js';
import {
  applyCanonicalSubjectPlan,
  canonicalJson,
  canonicalSubjectErrorCodes,
  importCanonicalSubjectPacket,
  planCanonicalSubjectEnrollmentInSnapshot,
  verifyCanonicalSubjectOperationInSnapshot,
  type CanonicalSubjectEvidenceProvider,
  type CanonicalSubjectPlan,
} from '../src/lib/oauth/v1/canonical-subject-enrollment.js';

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * A direct process invocation has no independent trust root. A host may inject
 * an adapter backed by an accepted Auth authority, but caller-authored JSON is
 * never accepted as authority evidence.
 */
export function requireTrustedCanonicalSubjectEvidenceProvider(provider?: CanonicalSubjectEvidenceProvider): CanonicalSubjectEvidenceProvider {
  if (!provider)
    throw { code: 'AUTHORITY_NOT_ACCEPTED', status: 409, recordKey: null, field: 'trustedEvidenceProvider' };
  return provider;
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

export async function runCanonicalSubjectEnrollmentCli(argv = process.argv, trustedEvidenceProvider?: CanonicalSubjectEvidenceProvider): Promise<void> {
  const cli = args(argv);
  if (cli.command === 'import') {
    const imported = importCanonicalSubjectPacket(loadJson(cli.required('packet')));
    if (cli.values.has('out')) writeFileSync(cli.required('out'), imported.canonicalJson + '\n', { flag: 'wx', mode: 0o600 });
    emit({ operationId: imported.packet.operationId, packetDigest: imported.packetDigest, mutationCount: imported.packet.mutations.length, result: 'PASS' });
    return;
  }
  const imported = importCanonicalSubjectPacket(loadJson(cli.required('packet')));
  const evidence = requireTrustedCanonicalSubjectEvidenceProvider(trustedEvidenceProvider);
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
