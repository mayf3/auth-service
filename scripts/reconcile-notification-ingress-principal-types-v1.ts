import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

// Restore CCR V1 CTR-NI-001's existing service-only entry. Reuses the
// svc-forum reconciliation's metadata / full snapshot / audited NOOP form.
// Source delivery is not production permission: Owner acts on the authsvc
// host under a separately bound controlled mandate. No HTTP/token calls,
// credential reads, automatic retry, or writes outside the one column and
// its same-transaction append-only security audit.
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const TASK = 'notification-ingress-principal-types-reconciliation-v1';
const AUDIENCE_ID = 'agent-core-notification-ingress-v1';
const DRIFT_TYPES = Object.freeze(['service', 'machine']);
const TARGET_TYPES = Object.freeze(['service']);
// Task-specific event: historical svc-forum registry audits are unrelated.
const AUDIT_EVENT_TYPE = 'audience.notification_ingress_principal_types_reconciled';
const AUDIT_RESULT = 'success';
const ADVISORY_LOCK_KEY = 813_947_209;
const AUDIT_DETAIL_KEYS = Object.freeze([
  'migration_id', 'source_git_commit', 'operator_id', 'approval_ref',
  'reason', 'before_value', 'after_value',
]);
const METADATA_FLAGS = [
  '--migration-id', '--source-git-commit', '--operator-id', '--approval-ref', '--reason',
] as const;
const AUDIENCE_SELECT = {
  audienceId: true, resourceService: true, scopeNamespace: true,
  acceptedPrincipalTypes: true, registeredScopes: true, humanAccessEnabled: true,
  machineAccessEnabled: true, delegatedAccessEnabled: true, status: true,
  freezeReady: true, version: true, createdAt: true, updatedAt: true,
} as const;
type AudienceRow = Prisma.AuthAudienceGetPayload<{ select: typeof AUDIENCE_SELECT }>;
type Metadata = {
  migrationId: string; sourceGitCommit: string; operatorId: string;
  approvalRef: string; reason: string;
};
type Plan = {
  outcome: 'reconcile' | 'noop';
  beforeValue: Prisma.InputJsonObject;
  afterValue: Prisma.InputJsonObject;
};
class Refusal extends Error {}
function fail(category: string): never { throw new Refusal(category); }
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b));
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (!sameJson(Object.keys(value).sort(), [...keys].sort())) fail('AUDIT_REFUSED');
}
function text(value: unknown, maxBytes: number): string {
  if (typeof value !== 'string' || value.trim().length === 0
      || Buffer.byteLength(value, 'utf8') > maxBytes || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail('METADATA_REFUSED');
  }
  return value;
}
function validateMetadata(metadata: Metadata): void {
  if (metadata.migrationId !== TASK || !/^[0-9a-f]{40}$/u.test(metadata.sourceGitCommit)) {
    fail('METADATA_REFUSED');
  }
  text(metadata.operatorId, 256);
  text(metadata.approvalRef, 2048);
  text(metadata.reason, 512);
}
// Preserve real array order and every column, including timestamps. The SQL
// bypasses Prisma's @updatedAt so that the sole changed field stays sole.
function audienceSnapshot(row: AudienceRow): Prisma.InputJsonObject {
  return {
    audience_id: row.audienceId, resource_service: row.resourceService,
    scope_namespace: row.scopeNamespace,
    accepted_principal_types: [...row.acceptedPrincipalTypes],
    registered_scopes: [...row.registeredScopes],
    human_access_enabled: row.humanAccessEnabled,
    machine_access_enabled: row.machineAccessEnabled,
    delegated_access_enabled: row.delegatedAccessEnabled,
    status: row.status, freeze_ready: row.freezeReady, version: row.version,
    created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
  };
}
async function loadPlan(db: Prisma.TransactionClient, metadata: Metadata | null): Promise<Plan> {
  const rows = await db.authAudience.findMany({ where: { audienceId: AUDIENCE_ID }, select: AUDIENCE_SELECT });
  if (rows.length !== 1) fail('AUDIENCE_REFUSED');
  const row = rows[0];
  if (row.resourceService !== AUDIENCE_ID || row.scopeNamespace !== 'notification'
      || !sameJson(row.registeredScopes, ['notification.deliver'])
      || row.humanAccessEnabled !== false || row.machineAccessEnabled !== true
      || row.delegatedAccessEnabled !== false || row.status !== 'active'
      || row.freezeReady !== true || row.version !== 1) fail('AUDIENCE_REFUSED');
  const drift = sameJson(row.acceptedPrincipalTypes, DRIFT_TYPES);
  const target = sameJson(row.acceptedPrincipalTypes, TARGET_TYPES);
  if (!drift && !target) fail('AUDIENCE_REFUSED');
  const current = audienceSnapshot(row);
  const audits = await db.authSecurityAudit.findMany({
    where: { eventType: AUDIT_EVENT_TYPE }, select: { result: true, details: true },
  });
  if (drift) {
    if (audits.length !== 0) fail('AUDIT_REFUSED');
    return { outcome: 'reconcile', beforeValue: current,
      afterValue: { ...current, accepted_principal_types: [...TARGET_TYPES] } };
  }
  // Target alone proves no lineage. Only the exact original transaction's
  // unique receipt permits a byte-stable NOOP; never add a NOOP audit.
  if (audits.length !== 1 || audits[0].result !== AUDIT_RESULT) fail('AUDIT_REFUSED');
  const details = audits[0].details;
  if (!isObject(details)) fail('AUDIT_REFUSED');
  exactKeys(details, AUDIT_DETAIL_KEYS);
  const recordedMetadata: Metadata = {
    migrationId: text(details.migration_id, 128), sourceGitCommit: text(details.source_git_commit, 40),
    operatorId: text(details.operator_id, 256), approvalRef: text(details.approval_ref, 2048),
    reason: text(details.reason, 512),
  };
  validateMetadata(recordedMetadata);
  if (metadata !== null && !sameJson(recordedMetadata, metadata)) fail('AUDIT_REFUSED');
  const expectedBefore = { ...current, accepted_principal_types: [...DRIFT_TYPES] };
  if (!sameJson(details.after_value, current) || !sameJson(details.before_value, expectedBefore)) {
    fail('AUDIT_REFUSED');
  }
  return { outcome: 'noop', beforeValue: expectedBefore, afterValue: current };
}
async function applyReconcile(prisma: PrismaClient, metadata: Metadata): Promise<Plan> {
  return prisma.$transaction(async (tx) => {
    // Lock before any SELECT/snapshot, like svc-forum. An uncooperative row
    // writer is blocked too. No automatic serialization/unknown-result retry.
    await tx.$executeRawUnsafe('LOCK TABLE auth_audiences IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE auth_security_audits IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;
    const plan = await loadPlan(tx, metadata);
    if (plan.outcome === 'noop') return plan;
    const updated = await tx.$executeRawUnsafe(
      'UPDATE auth_audiences SET accepted_principal_types = ARRAY[$1]::text[] WHERE audience_id = $2 AND version = 1 AND accepted_principal_types = ARRAY[$3, $4]::text[]',
      TARGET_TYPES[0], AUDIENCE_ID, DRIFT_TYPES[0], DRIFT_TYPES[1],
    );
    if (updated !== 1) fail('UPDATE_REFUSED');
    const rows = await tx.authAudience.findMany({ where: { audienceId: AUDIENCE_ID }, select: AUDIENCE_SELECT });
    if (rows.length !== 1 || !sameJson(audienceSnapshot(rows[0]), plan.afterValue)) fail('POST_STATE_REFUSED');
    const details = {
      migration_id: metadata.migrationId, source_git_commit: metadata.sourceGitCommit,
      operator_id: metadata.operatorId, approval_ref: metadata.approvalRef, reason: metadata.reason,
      before_value: plan.beforeValue, after_value: plan.afterValue,
    };
    exactKeys(details, AUDIT_DETAIL_KEYS);
    await tx.authSecurityAudit.create({ data: {
      id: randomUUID(), eventType: AUDIT_EVENT_TYPE, result: AUDIT_RESULT,
      details, timestamp: new Date(),
    } });
    return plan;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
function report(plan: Plan, operation: 'plan' | 'apply'): void {
  const proposed = plan.outcome === 'reconcile' ? 1 : 0;
  const actual = operation === 'apply' ? proposed : 0;
  process.stdout.write(`${JSON.stringify({
    task: TASK, operation, mode: operation === 'plan' ? 'DRY_RUN' : 'APPLY',
    outcome: plan.outcome, audience: AUDIENCE_ID,
    audience_rows_updated: actual, audits_created: actual,
    proposed_audience_rows_updated: proposed, proposed_audits_created: proposed,
    accepted_principal_types_before: plan.beforeValue.accepted_principal_types,
    accepted_principal_types_after: plan.afterValue.accepted_principal_types,
    before_value: plan.beforeValue, after_value: plan.afterValue,
  })}\n`);
}
function cleanHead(): string {
  const git = (args: string[]) => execFileSync('/usr/bin/git', ['--no-optional-locks', '-C', REPO_ROOT, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git(['status', '--porcelain', '--untracked-files=all']) !== '') fail('SOURCE_REFUSED');
  if (`${git(['rev-parse', '--show-toplevel'])}/` !== REPO_ROOT) fail('SOURCE_REFUSED');
  return git(['rev-parse', 'HEAD']);
}
function parseArgs(argv: string[]): Record<string, string | true> {
  const args: Record<string, string | true> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (Object.hasOwn(args, key)) fail('ARGUMENTS_REFUSED');
    if ((METADATA_FLAGS as readonly string[]).includes(key)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) fail('ARGUMENTS_REFUSED');
      args[key] = value;
    } else if (['--apply', '--dry-run', '--plan'].includes(key)) args[key] = true;
    else fail('ARGUMENTS_REFUSED');
  }
  return args;
}
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--apply', '--dry-run', '--plan'].filter((key) => args[key] === true);
  if (modes.length > 1) fail('ARGUMENTS_REFUSED');
  let metadata: Metadata | null = null;
  if (args['--apply']) {
    if (Object.keys(args).length !== 6 || METADATA_FLAGS.some((key) => typeof args[key] !== 'string')) {
      fail('ARGUMENTS_REFUSED');
    }
    metadata = {
      migrationId: args['--migration-id'] as string, sourceGitCommit: args['--source-git-commit'] as string,
      operatorId: args['--operator-id'] as string, approvalRef: args['--approval-ref'] as string,
      reason: args['--reason'] as string,
    };
    validateMetadata(metadata);
    if (cleanHead() !== metadata.sourceGitCommit) fail('SOURCE_REFUSED');
  } else if (Object.keys(args).some((key) => !['--dry-run', '--plan'].includes(key))) fail('ARGUMENTS_REFUSED');
  if (!process.env.DATABASE_URL) fail('DATABASE_CONFIGURATION_REFUSED');
  const prisma = new PrismaClient();
  try {
    if (metadata !== null) report(await applyReconcile(prisma, metadata), 'apply');
    else {
      const plan = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        return loadPlan(tx, null);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      report(plan, 'plan');
    }
  } finally { await prisma.$disconnect(); }
}
main().catch((error: unknown) => {
  // DB diagnostics can contain connection strings or data. A lost commit
  // acknowledgement is not replay permission: stop and independently read
  // current row plus receipt under a fresh authorized read-only operation.
  const category = error instanceof Refusal ? error.message : 'DATABASE_OR_COMMIT_OUTCOME_UNKNOWN';
  process.stderr.write(`Reconciliation refused: ${category}\n`);
  process.exitCode = 1;
});
