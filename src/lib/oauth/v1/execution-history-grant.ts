import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { auditLog } from '../audit.js';
import { getV1AudienceDefinitions } from './contract.js';
import { findV1AudienceMismatch } from './grant-migration.js';

/** EXECUTION_HISTORY_AUTH_CONTRACT_V1. Existing MachineAccessGrant lifecycle;
 * no online Grant API, secondary store, resource ACL or decryption authority. */
export const EXECUTION_HISTORY_AUDIENCE = 'execution-history';
export const EXECUTION_HISTORY_READ = 'execution.history.read';
export const EXECUTION_HISTORY_AUDIT = 'execution.history.audit';
const SCOPES = [EXECUTION_HISTORY_AUDIT, EXECUTION_HISTORY_READ];
type Store = Pick<Prisma.TransactionClient, 'machineClient' | 'authAudience' | 'machineAccessGrant' | 'grantChangeAudit'>;
const clientSelect = {
  id: true, clientId: true, machinePrincipalId: true, externalRef: true, status: true,
  principal: { select: { id: true, principalType: true, agentId: true, externalRef: true, status: true } },
} as const;

function refused(category: string): never { throw new Error(category); }
function assertGrant(grant: { scopes: string[]; version: number } | null): void {
  if (grant && (grant.version < 1 || !grant.scopes.length
    || new Set(grant.scopes).size !== grant.scopes.length
    || grant.scopes.some((scope) => !SCOPES.includes(scope)))) refused('execution_history_grant_state_invalid');
}
function grantKey(machineClientId: string) {
  return { machineClientId, audienceId: EXECUTION_HISTORY_AUDIENCE };
}
async function registeredAudience(tx: Store) {
  const expected = getV1AudienceDefinitions().find((a) => a.audienceId === EXECUTION_HISTORY_AUDIENCE);
  if (!expected) return null;
  const actual = await tx.authAudience.findUnique({ where: { audienceId: EXECUTION_HISTORY_AUDIENCE } });
  if (!actual || actual.status !== 'active') return null;
  if (findV1AudienceMismatch(expected, actual)) refused('execution_history_audience_drift');
  return actual;
}

/** Called only through the existing canonical client provisioning channel.
 * Birth runs inside createOrGetClient's transaction; retry runs in a separate
 * Serializable transaction. Missing/inactive registration grants nothing.
 * Canonical principal AND client bindings are required; arbitrary agents and
 * SERVICE clients are not fleet membership. Independent audit is preserved.
 */
export async function ensureExecutionHistoryReadGrant(
  tx: Store,
  target: { id: string; machinePrincipalId: string },
): Promise<'skipped' | 'created' | 'kept' | 'updated'> {
  const client = await tx.machineClient.findUnique({ where: { id: target.id }, select: clientSelect });
  if (!client || client.status !== 'active' || client.machinePrincipalId !== target.machinePrincipalId) return 'skipped';
  const p = client.principal;
  if (!p || p.status !== 'active' || p.principalType !== 'agent' || !p.agentId
    || !/^agt_[a-z0-9][a-z0-9_-]*$/.test(p.agentId)
    || p.externalRef !== `agentcore:v1:principal:${p.agentId}`
    || client.externalRef !== `agentcore:v1:client:${p.agentId}`) return 'skipped';
  if (!await registeredAudience(tx)) return 'skipped';
  const key = grantKey(client.id);
  const existing = await tx.machineAccessGrant.findUnique({ where: { machineClientId_audienceId: key } });
  assertGrant(existing);
  if (existing?.scopes.includes(EXECUTION_HISTORY_READ)) return 'kept';
  if (!existing) {
    await tx.machineAccessGrant.create({ data: { ...key, scopes: [EXECUTION_HISTORY_READ], version: 1 } });
  } else {
    const changed = await tx.machineAccessGrant.updateMany({
      where: { ...key, version: existing.version, scopes: { equals: existing.scopes } },
      data: { scopes: [...existing.scopes, EXECUTION_HISTORY_READ].sort(), version: { increment: 1 } },
    });
    if (changed.count !== 1) refused('grant_version_conflict');
  }
  auditLog({ timestamp: new Date().toISOString(), type: 'client.fleet_grant_ensured',
    principalId: p.id, clientId: client.clientId, resource: EXECUTION_HISTORY_AUDIENCE,
    scopes: EXECUTION_HISTORY_READ, success: true });
  return existing ? 'updated' : 'created';
}

/** Versioned migration metadata from a separately attributable existing-Owner
 * instruction to this exact registered client. The CLI verifies source HEAD.
 * These fields are provenance, never a substitute for operator authorization.
 */
export const executionHistoryAuditInstructionSchema = z.object({
  operation: z.enum(['provision', 'revoke']),
  clientId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  migrationId: z.string().regex(/^execution-history-[a-zA-Z0-9-]{1,128}$/),
  sourceGitCommit: z.string().regex(/^[0-9a-f]{40}$/),
  operatorId: z.string().trim().min(1).max(128),
  approvalRef: z.string().trim().min(1).max(256),
  expectedGrantVersion: z.number().int().positive().nullable(),
}).strict();
export type ExecutionHistoryAuditInstruction = z.infer<typeof executionHistoryAuditInstructionSchema>;

/** Same Serializable + CAS + closed audit pattern as existing supply/revoke
 * vehicles. No automatic retry: transaction/commit errors propagate; reconcile
 * by migrationId before any new attempt when commit outcome is unknown.
 */
export async function applyExecutionHistoryAuditInstruction(
  database: Pick<PrismaClient, '$transaction'>,
  value: ExecutionHistoryAuditInstruction,
) {
  const input = executionHistoryAuditInstructionSchema.parse(value);
  const reason = `EXECUTION_HISTORY_AUDIT_${input.operation.toUpperCase()}`;
  return database.$transaction(async (tx) => {
    // Serialize this exact client's supply/revoke operations, including absent
    // grants and replay checks. Bound values, no SQL interpolation of input.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`execution-history:${input.clientId}`}, 0))`;
    const prior = await tx.grantChangeAudit.findMany({ where: { migrationId: input.migrationId } });
    if (prior.length) {
      const old = prior[0];
      if (prior.length !== 1 || old.clientId !== input.clientId || old.reason !== reason
        || old.sourceGitCommit !== input.sourceGitCommit || old.operatorId !== input.operatorId
        || old.approvalRef !== input.approvalRef || old.expectedGrantVersion !== input.expectedGrantVersion) {
        refused('instruction_replay_mismatch');
      }
      return { auditId: old.id, resultingGrantVersion: old.resultingGrantVersion, replayed: true };
    }
    const client = await tx.machineClient.findUnique({ where: { clientId: input.clientId }, select: clientSelect });
    // Inactive clients/principals cannot receive audit scope, but revocation
    // must remain available for their existing grants and audited NOOPs.
    if (!client || (input.operation === 'provision'
      && (client.status !== 'active' || client.principal.status !== 'active'))
      || client.principal.principalType !== 'agent' || !client.principal.agentId) refused('registered_agent_client_required');
    if (!await registeredAudience(tx)) refused('execution_history_audience_unavailable');
    const key = grantKey(client.id);
    const before = await tx.machineAccessGrant.findUnique({ where: { machineClientId_audienceId: key } });
    assertGrant(before);
    if ((before?.version ?? null) !== input.expectedGrantVersion) refused('grant_version_conflict');
    const scopes = new Set(before?.scopes ?? []);
    if (input.operation === 'provision') scopes.add(EXECUTION_HISTORY_AUDIT);
    else scopes.delete(EXECUTION_HISTORY_AUDIT);
    const targetScopes = [...scopes].sort();
    const changed = JSON.stringify([...(before?.scopes ?? [])].sort()) !== JSON.stringify(targetScopes);
    const version = before ? before.version + (changed && targetScopes.length ? 1 : 0) : 1;
    const after = targetScopes.length ? { ...key, scopes: targetScopes, version } : null;
    const cas = before ? { ...key, version: before.version, scopes: { equals: before.scopes } } : null;
    if (!before && after) await tx.machineAccessGrant.create({ data: after });
    else if (before && changed) {
      const result = after
        ? await tx.machineAccessGrant.updateMany({ where: cas!, data: { scopes: targetScopes, version } })
        : await tx.machineAccessGrant.deleteMany({ where: cas! });
      if (result.count !== 1) refused('grant_version_conflict');
    }
    const snapshot = (g: typeof before) => g ? { ...key, scopes: [...g.scopes], version: g.version } : Prisma.DbNull;
    // NOOP also writes evidence; it never increments a grant version. Partial
    // revoke is replace, because DB's revoke shape requires SQL NULL after.
    const audit = await tx.grantChangeAudit.create({ data: {
      migrationId: input.migrationId, sourceGitCommit: input.sourceGitCommit,
      operatorId: input.operatorId, approvalRef: input.approvalRef, reason, clientId: client.clientId,
      changeType: after ? (before ? 'replace' : 'create') : 'revoke',
      expectedGrantVersion: before?.version ?? null, resultingGrantVersion: version,
      beforeValue: snapshot(before), afterValue: after ?? Prisma.DbNull,
    } });
    return { auditId: audit.id, resultingGrantVersion: version, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
