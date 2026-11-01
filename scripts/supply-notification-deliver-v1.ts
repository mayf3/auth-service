/** MACHINE_GRANT_SUPPLY_NOTIFICATION_DELIVER_V1, CTR-NDG-001..010.
 * Owner on authsvc only; this source is not production apply authorization.
 * DRY_RUN: --binding public-binding.json (or NOTIFICATION_DELIVER_BINDING).
 * APPLY: --apply --binding ... --plan approved-plan.json --mandate apply.json
 * READBACK: --readback --binding ... --plan ... --mandate readback.json
 * Capture stdout outside the clean checkout. No dotenv, secret reads, retries,
 * token requests, UPDATE or DELETE. Unknown outcomes require separate readback.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getV1AudienceDefinitions, initializeAuthContract } from '../src/lib/oauth/v1/contract.js';

export const SPEC_REVISION = 'aa566efa754128f750fe71fd06468d45c9992f17';
export const MIGRATION_ID = 'notification-deliver-grant-supply-v1';
export const AUDIENCE = 'agent-core-notification-ingress-v1';
const SPEC_PATH = 'docs/specs/MACHINE_GRANT_SUPPLY_NOTIFICATION_DELIVER_V1.md';
const sha = z.string().regex(/^[0-9a-f]{40}$/);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const publicRef = z.string().regex(/^https:\/\/github\.com\/mayf3\/(auth-service|agent-control)\/(issues|pull)\/[1-9][0-9]*(#issuecomment-[0-9]+)?$/);
export const bindingSchema = z.object({
  service: z.literal('svc-workflow-backend-v1'),
  machinePrincipalId: z.string().uuid(), machineClientId: z.string().uuid(),
  clientId: z.string().min(1).max(128),
  approvedBy: z.literal('mayf3'), instructionRef: publicRef,
}).strict();
export type Binding = z.infer<typeof bindingSchema>;
const environmentSchema = z.object({
  host: z.string().min(1).max(253), osUser: z.string().min(1).max(128),
  database: z.string().min(1), databaseUser: z.string().min(1),
  serverAddress: z.string().nullable(), serverPort: z.number().int().nullable(),
}).strict();
export const mandateSchema = z.object({
  action: z.enum(['apply', 'readback']), operatorId: z.literal('mayf3'),
  approvalRef: publicRef, applyApprovalRef: publicRef,
  specRevision: z.literal(SPEC_REVISION), sourceGitCommit: sha,
  operationId: z.string().uuid(), planDigest: hash,
  environment: environmentSchema, binding: bindingSchema,
  validFrom: z.string().datetime(), validUntil: z.string().datetime(),
  maxMutationAttempts: z.literal(1),
}).strict();
export type Mandate = z.infer<typeof mandateSchema>;
export type Context = { sourceGitCommit: string; host: string; osUser: string };
type Tx = Prisma.TransactionClient;
const principalSelect = { id: true, principalType: true, agentId: true, externalRef: true,
  status: true, createdAt: true, updatedAt: true, disabledAt: true } as const;
const clientSelect = { id: true, clientId: true, machinePrincipalId: true, externalRef: true,
  status: true, createdAt: true, updatedAt: true, rotatedAt: true, revokedAt: true } as const;
const expectedAudience = {
  audienceId: AUDIENCE, resourceService: AUDIENCE, scopeNamespace: 'notification',
  acceptedPrincipalTypes: ['service'], registeredScopes: ['notification.deliver'],
  humanAccessEnabled: false, machineAccessEnabled: true, delegatedAccessEnabled: false, status: 'active',
};
type Category = 'INPUT_REFUSED' | 'SOURCE_REFUSED' | 'BINDING_REFUSED' | 'AUDIENCE_REFUSED'
  | 'GRANT_CONFLICT' | 'AUDIT_CONFLICT' | 'PLAN_CONFLICT' | 'MANDATE_REFUSED'
  | 'READBACK_UNKNOWN' | 'OUTCOME_UNKNOWN' | 'CONCURRENT_READBACK_REQUIRED';
export class SupplyRefusal extends Error { constructor(readonly category: Category) { super(category); } }
function refuse(category: Category): never { throw new SupplyRefusal(category); }
export function failureCategory(e: unknown): Category {
  return e instanceof SupplyRefusal ? e.category : 'OUTCOME_UNKNOWN';
}
export function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(k => `${JSON.stringify(k)}:${canonical(object[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
function equal(a: unknown, b: unknown) { return canonical(a) === canonical(b); }
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) refuse('INPUT_REFUSED');
  return result.data;
}
function projection(a: { [K in keyof typeof expectedAudience]: unknown }) {
  return Object.fromEntries(Object.keys(expectedAudience).map(k => [k, a[k as keyof typeof a]]));
}
// Safe public metadata only. No credential/verifier/legacy permission columns.
// Source audit + least-privilege conformance proves the writer cannot mutate
// the records represented here (including credential-bearing Client rows).
async function invariants(tx: Tx, binding: Binding) {
  const state = {
    principals: await tx.machinePrincipal.findMany({ select: principalSelect, orderBy: { id: 'asc' } }),
    clients: await tx.machineClient.findMany({ select: clientSelect, orderBy: { id: 'asc' } }),
    audiences: await tx.authAudience.findMany({ orderBy: { audienceId: 'asc' } }),
    machineGrants: await tx.machineAccessGrant.findMany({
      where: { NOT: { machineClientId: binding.machineClientId, audienceId: AUDIENCE } },
      orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }],
    }),
    humanGrants: await tx.humanAudienceGrant.findMany({ orderBy: [{ humanClientId: 'asc' }, { audienceId: 'asc' }] }),
    delegationGrants: await tx.delegationGrant.findMany({ orderBy: [{ trustedProxyId: 'asc' }, { audienceId: 'asc' }] }),
    otherAudits: await tx.grantChangeAudit.findMany({ where: { migrationId: { not: MIGRATION_ID } }, orderBy: { id: 'asc' } }),
  };
  return digest(state);
}
async function fresh(tx: Tx, binding: Binding, context: Context) {
  const p = await tx.machinePrincipal.findMany({ where: { id: binding.machinePrincipalId }, select: principalSelect });
  const clients = await tx.machineClient.findMany({ where: { OR: [
    { id: binding.machineClientId }, { clientId: binding.clientId },
    { machinePrincipalId: binding.machinePrincipalId, status: 'active' },
  ] }, select: clientSelect });
  if (p.length !== 1 || p[0].principalType !== 'service' || p[0].status !== 'active'
    || clients.length !== 1 || clients[0].id !== binding.machineClientId
    || clients[0].clientId !== binding.clientId || clients[0].machinePrincipalId !== p[0].id
    || clients[0].status !== 'active') refuse('BINDING_REFUSED');
  const registered = getV1AudienceDefinitions().filter(a => a.audienceId === AUDIENCE);
  const stored = await tx.authAudience.findMany({ where: { audienceId: AUDIENCE } });
  if (registered.length !== 1 || stored.length !== 1
    || !equal(projection(registered[0]), expectedAudience)
    || !equal(projection(stored[0]), expectedAudience)
    || stored[0].version !== 1 || !stored[0].freezeReady) refuse('AUDIENCE_REFUSED');
  const grants = await tx.machineAccessGrant.findMany({ where: { machineClientId: binding.machineClientId, audienceId: AUDIENCE } });
  if (grants.length > 1) refuse('GRANT_CONFLICT');
  const grant = grants[0] ?? null;
  if (grant && (!equal(grant.scopes, ['notification.deliver']) || !Number.isInteger(grant.version) || grant.version < 1)) refuse('GRANT_CONFLICT');
  // Inspect all vehicle identities plus every audit for this public client:
  // a changed target or an overlapping/revoked history cannot hide a replay.
  const audits = await tx.grantChangeAudit.findMany({ where: { OR: [
    { migrationId: MIGRATION_ID }, { clientId: binding.clientId },
  ] }, orderBy: { id: 'asc' } });
  const own = audits.filter(a => a.migrationId === MIGRATION_ID);
  const overlapping = audits.filter(a => a.migrationId !== MIGRATION_ID &&
    canonical([a.beforeValue, a.afterValue]).includes(AUDIENCE));
  if (own.length > 1 || overlapping.length || (own.length && !grant)) refuse('AUDIT_CONFLICT');
  const audit = own[0] ?? null;
  const afterValue = grant ? { ...JSON.parse(canonical(grant)), machinePrincipalId: binding.machinePrincipalId,
    bindingDigest: digest(binding) } : null;
  if (grant && (!audit || audit.clientId !== binding.clientId || audit.changeType !== 'create'
    || audit.expectedGrantVersion !== null || audit.beforeValue !== null
    || audit.resultingGrantVersion !== grant.version || grant.version !== 1
    || !equal(audit.afterValue, afterValue) || audit.sourceGitCommit !== context.sourceGitCommit
    || audit.operatorId !== 'mayf3' || !publicRef.safeParse(audit.approvalRef).success
    || !/^notification-deliver:v1:[0-9a-f-]{36}:[0-9a-f]{64}$/.test(audit.reason))) refuse('AUDIT_CONFLICT');
  if (audit) {
    // Prisma maps SQL NULL and JSON null to the same JS value. The CREATE
    // lineage must prove SQL NULL, as required by CTR-NDG-006.
    const shape = await tx.$queryRaw<Array<{ sqlNull: boolean }>>`
      SELECT before_value IS NULL AS "sqlNull" FROM grant_change_audits WHERE change_id = ${audit.id}::uuid`;
    if (shape.length !== 1 || !shape[0].sqlNull) refuse('AUDIT_CONFLICT');
  }
  const db = await tx.$queryRaw<Array<{ database: string; databaseUser: string; serverAddress: string | null; serverPort: number | null }>>`
    SELECT current_database() AS database, session_user::text AS "databaseUser",
      inet_server_addr()::text AS "serverAddress", inet_server_port() AS "serverPort"`;
  if (db.length !== 1) refuse('PLAN_CONFLICT');
  return { binding, principal: p[0], client: clients[0], audience: stored[0], grant, audit, afterValue,
    environment: { host: context.host, osUser: context.osUser, ...db[0] }, nonTargetDigest: await invariants(tx, binding) };
}
type Fresh = Awaited<ReturnType<typeof fresh>>;
function planBody(state: Fresh, context: Context, operationId: string) {
  return { formatVersion: 1, migrationId: MIGRATION_ID, specRevision: SPEC_REVISION,
    sourceGitCommit: context.sourceGitCommit, operationId, environment: state.environment,
    binding: state.binding, principal: state.principal, client: state.client, audience: state.audience,
    grant: state.grant, audit: state.audit, nonTargetDigest: state.nonTargetDigest,
    action: state.grant ? 'NOOP' : 'CREATE', scopes: ['notification.deliver'] };
}
export type Plan = ReturnType<typeof planBody> & { planDigest: string };
export async function dryRun(database: Pick<PrismaClient, '$transaction'>, value: Binding, context: Context, operationId = randomUUID()): Promise<Plan> {
  const binding = parse(bindingSchema, value);
  parse(sha, context.sourceGitCommit); parse(z.string().uuid(), operationId);
  return database.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const body = planBody(await fresh(tx, binding, context), context, operationId);
    return JSON.parse(canonical({ ...body, planDigest: digest(body) })) as Plan;
  }, { isolationLevel: 'Serializable' });
}
function approved(value: Plan, mandateValue: Mandate, binding: Binding, context: Context, action: 'apply' | 'readback') {
  const mandate = parse(mandateSchema, mandateValue);
  if (!value || typeof value !== 'object') refuse('INPUT_REFUSED');
  const { planDigest, ...body } = value;
  const now = Date.now();
  if (!hash.safeParse(planDigest).success || digest(body) !== planDigest || value.specRevision !== SPEC_REVISION
    || value.migrationId !== MIGRATION_ID || value.sourceGitCommit !== context.sourceGitCommit
    || !equal(value.binding, binding) || value.operationId !== mandate.operationId
    || !equal(mandate.binding, binding) || mandate.sourceGitCommit !== context.sourceGitCommit
    || mandate.planDigest !== planDigest || !equal(mandate.environment, value.environment)
    || mandate.action !== action || Date.parse(mandate.validFrom) > now || Date.parse(mandate.validUntil) <= now
    || Date.parse(mandate.validFrom) >= Date.parse(mandate.validUntil)
    || (action === 'apply' && mandate.approvalRef !== mandate.applyApprovalRef)) refuse('MANDATE_REFUSED');
  return mandate;
}
function exactReceipt(state: Fresh, plan: Plan, mandate: Mandate) {
  const a = state.audit;
  return a && state.grant && plan.action === 'CREATE' && plan.grant === null && plan.audit === null
    && a.sourceGitCommit === plan.sourceGitCommit && a.operatorId === mandate.operatorId
    && a.approvalRef === mandate.applyApprovalRef
    && a.reason === `notification-deliver:v1:${plan.operationId}:${plan.planDigest}`;
}
function samePreconditions(state: Fresh, plan: Plan) {
  return equal(state.environment, plan.environment) && equal(state.binding, plan.binding)
    && equal(state.principal, plan.principal) && equal(state.client, plan.client)
    && equal(state.audience, plan.audience) && state.nonTargetDigest === plan.nonTargetDigest;
}
/** No error is retried. In particular a failed/ambiguous commit does not call
 * this function again. Owner issues a distinct readback mandate instead. */
export async function execute(database: Pick<PrismaClient, '$transaction'>, value: Binding, context: Context,
  plan: Plan, mandateValue: Mandate, action: 'apply' | 'readback') {
  const binding = parse(bindingSchema, value);
  const mandate = approved(plan, mandateValue, binding, context, action);
  try {
    return await database.$transaction(async tx => {
      if (action === 'readback') await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      else {
        const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtextextended(${MIGRATION_ID}, 0)) AS locked`;
        if (!lock[0]?.locked) refuse('CONCURRENT_READBACK_REQUIRED');
      }
      const state = await fresh(tx, binding, context);
      if (!samePreconditions(state, plan)) refuse('PLAN_CONFLICT');
      if (state.audit && state.audit.approvalRef !== mandate.applyApprovalRef) refuse('AUDIT_CONFLICT');
      if (exactReceipt(state, plan, mandate)) return { result: action === 'readback' ? 'VERIFIED' : 'NOOP',
        operationId: plan.operationId, planDigest: plan.planDigest, auditId: state.audit!.id };
      if (action === 'readback') refuse('READBACK_UNKNOWN');
      if (!equal(planBody(state, context, plan.operationId), (({ planDigest: _, ...body }) => body)(plan))) refuse('PLAN_CONFLICT');
      if (state.grant) return { result: 'NOOP', operationId: plan.operationId, planDigest: plan.planDigest, auditId: state.audit!.id };
      // Absence CAS: composite PK + Serializable preimage/uniqueness. An
      // intervening creator aborts; there is no overwrite/upsert UPDATE arm.
      const after = await tx.machineAccessGrant.create({ data: {
        machineClientId: binding.machineClientId, audienceId: AUDIENCE, scopes: ['notification.deliver'], version: 1,
      } });
      const audit = await tx.grantChangeAudit.create({ data: {
        id: randomUUID(), migrationId: MIGRATION_ID, sourceGitCommit: context.sourceGitCommit,
        operatorId: mandate.operatorId, approvalRef: mandate.approvalRef,
        reason: `notification-deliver:v1:${plan.operationId}:${plan.planDigest}`, clientId: binding.clientId,
        changeType: 'create', expectedGrantVersion: null, resultingGrantVersion: 1,
        beforeValue: Prisma.DbNull,
        afterValue: { ...JSON.parse(canonical(after)), machinePrincipalId: binding.machinePrincipalId, bindingDigest: digest(binding) },
        timestamp: new Date(),
      } });
      const post = await fresh(tx, binding, context);
      if (!samePreconditions(post, plan) || !exactReceipt(post, plan, mandate) || post.audit!.id !== audit.id) refuse('PLAN_CONFLICT');
      return { result: 'CREATED', operationId: plan.operationId, planDigest: plan.planDigest, auditId: audit.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  } catch (e) {
    // Includes unique/CAS/serialization failures and connection loss. No raw
    // Prisma diagnostic (which may embed a connection string) escapes.
    throw new SupplyRefusal(failureCategory(e));
  }
}
export function parseArgs(args: readonly string[], defaultBinding = process.env.NOTIFICATION_DELIVER_BINDING) {
  let mode: 'dry-run' | 'apply' | 'readback' = 'dry-run';
  const files: Record<string, string> = {};
  let explicitMode = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--dry-run', '--apply', '--readback'].includes(arg)) {
      if (explicitMode) refuse('INPUT_REFUSED');
      explicitMode = true; mode = arg.slice(2) as typeof mode;
    } else if (['--binding', '--plan', '--mandate'].includes(arg) && !files[arg] && args[i + 1] && !args[i + 1].startsWith('--')) {
      files[arg] = args[++i];
    } else refuse('INPUT_REFUSED');
  }
  const bindingPath = files['--binding'] ?? defaultBinding;
  if (!bindingPath || (mode === 'dry-run' ? files['--plan'] || files['--mandate'] : !files['--plan'] || !files['--mandate'])) refuse('INPUT_REFUSED');
  return { mode, bindingPath, planPath: files['--plan'], mandatePath: files['--mandate'] };
}
function cleanContext(): Context {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  // git -C always checks this vehicle checkout. Runtime contract loading uses
  // CWD, so the CLI deliberately enters the same checked checkout.
  process.chdir(root);
  const git = (...args: string[]) => execFileSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const head = git('rev-parse', 'HEAD');
  if (!sha.safeParse(head).success || git('status', '--porcelain')
    || git('log', '-1', '--format=%H', '--', SPEC_PATH) !== SPEC_REVISION
    || readFileSync(resolve(root, SPEC_PATH), 'utf8') !== `${git('show', `${SPEC_REVISION}:${SPEC_PATH}`)}\n`) refuse('SOURCE_REFUSED');
  // scripts/ is ignored in this repository. A copied, untracked vehicle must
  // not claim an older clean HEAD that never contained its implementation.
  try {
    if (readFileSync(fileURLToPath(import.meta.url), 'utf8')
      !== `${git('show', 'HEAD:scripts/supply-notification-deliver-v1.ts')}\n`) refuse('SOURCE_REFUSED');
  } catch { refuse('SOURCE_REFUSED'); }
  return { sourceGitCommit: head, host: hostname(), osUser: userInfo().username };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const context = cleanContext();
  const load = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
  const binding = parse(bindingSchema, load(options.bindingPath));
  const plan = options.planPath ? load(options.planPath) as Plan : undefined;
  const mandate = options.mandatePath ? load(options.mandatePath) as Mandate : undefined;
  // Validate the separately approved inputs before opening a connection.
  if (options.mode !== 'dry-run') approved(plan!, mandate!, binding, context, options.mode);
  initializeAuthContract('v1');
  const db = new PrismaClient();
  try {
    const result = options.mode === 'dry-run' ? await dryRun(db, binding, context)
      : await execute(db, binding, context, plan!, mandate!, options.mode);
    process.stdout.write(`${canonical(result)}\n`); // receipt only after commit
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => {
    process.stderr.write(`${failureCategory(e)}; STOP; separate authorized readback before any retry\n`);
    process.exitCode = 1;
  });
}
