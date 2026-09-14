/** Auth-only canonical binding. No enrollment, Core attestation, HTTP seam or writes. */
import { prisma } from '../../prisma.js';
export type IdentityErrorCode = 'INVALID_IDENTITY_INPUT' | 'IDENTITY_NOT_FOUND' | 'IDENTITY_NOT_AGENT' | 'IDENTITY_INACTIVE' | 'IDENTITY_NOT_CANONICAL' | 'IDENTITY_PAIR_MISMATCH' | 'IDENTITY_INCONSISTENT' | 'IDENTITY_READ_TIMEOUT' | 'IDENTITY_READ_UNAVAILABLE' | 'SUCCESSOR_NOT_FOUND';
export interface IdentityError {
  code: IdentityErrorCode;
  status: 400 | 404 | 409 | 503;
}
export interface CanonicalIdentity {
  principalId: string;
  agentId: string;
  lifecycleRevision: string;
  resolvedViaLegacy: false;
}
export interface MigrationIdentity {
  sourcePrincipalId: string;
  principalId: string;
  agentId: string;
  lifecycleRevision: string;
  resolvedViaLegacy: true;
  evidenceRef: string;
}
type Row = Record<string, unknown>;
interface ReadModel {
  findMany(args: {
    where: Record<string, string>;
    select: Record<string, true>;
    take: 2;
  }): Promise<Row[]>;
}
export interface IdentitySnapshot {
  machinePrincipal: ReadModel;
  agentIdentityLifecycle: ReadModel;
  agentIdentitySuccessor: ReadModel;
}
export interface IdentityDatabase {
  $transaction<T>(fn: (tx: IdentitySnapshot) => Promise<T>, options: {
    isolationLevel: 'RepeatableRead';
    timeout: number;
    maxWait: number;
  }): Promise<T>;
}
export interface IdentityReadOptions {
  timeoutMs?: number;
}
const defaultDatabase: IdentityDatabase = {
  $transaction: (fn, options) => prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return fn(tx as unknown as IdentitySnapshot);
  }, options),
};
const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const agentPattern = /^agt_[a-z0-9-]+$/;
const errors = new Set<IdentityErrorCode>(['INVALID_IDENTITY_INPUT', 'IDENTITY_NOT_FOUND', 'IDENTITY_NOT_AGENT', 'IDENTITY_INACTIVE', 'IDENTITY_NOT_CANONICAL', 'IDENTITY_PAIR_MISMATCH', 'IDENTITY_INCONSISTENT', 'IDENTITY_READ_TIMEOUT', 'IDENTITY_READ_UNAVAILABLE', 'SUCCESSOR_NOT_FOUND']);
const fail = (code: IdentityErrorCode, status: IdentityError['status'] = 409): never => {
  throw { code, status } satisfies IdentityError;
};
function principalInput(v: unknown): string {
  if (typeof v !== 'string' || !uuid.test(v))
    return fail('INVALID_IDENTITY_INPUT', 400);
  return v.toLowerCase();
}
function validAgent(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 5 && v.length <= 128 && agentPattern.test(v);
}
function agentInput(v: unknown): string {
  if (!validAgent(v))
    return fail('INVALID_IDENTITY_INPUT', 400);
  return v;
}
function one(rows: Row[], missing: IdentityErrorCode = 'IDENTITY_NOT_FOUND'): Row {
  if (!Array.isArray(rows) || rows.length > 1)
    return fail('IDENTITY_INCONSISTENT');
  if (!rows.length)
    return fail(missing, missing === 'IDENTITY_NOT_CANONICAL' ? 409 : 404);
  return rows[0];
}
const principalSelect = { id: true, agentId: true, principalType: true, status: true } as const;
const lifecycleSelect = { principalId: true, state: true, revision: true } as const;
async function principal(tx: IdentitySnapshot, where: Record<string, string>): Promise<Row> {
  const row = one(await tx.machinePrincipal.findMany({ where, select: principalSelect, take: 2 }));
  if (Object.entries(where).some(([key, value]) => row[key] !== value) || typeof row.id !== 'string' || !uuid.test(row.id))
    return fail('IDENTITY_INCONSISTENT');
  if (row.principalType !== 'agent')
    return fail('IDENTITY_NOT_AGENT');
  return row;
}
async function canonical(tx: IdentitySnapshot, where: Record<string, string>, pairAgent?: string): Promise<CanonicalIdentity> {
  const row = await principal(tx, where);
  if (row.status !== 'active')
    return fail('IDENTITY_INACTIVE');
  const l = one(await tx.agentIdentityLifecycle.findMany({ where: { principalId: row.id as string }, select: lifecycleSelect, take: 2 }), 'IDENTITY_NOT_CANONICAL');
  if (l.principalId !== row.id)
    return fail('IDENTITY_INCONSISTENT');
  if (l.state !== 'canonical')
    return fail('IDENTITY_NOT_CANONICAL');
  if (!validAgent(row.agentId) || typeof l.revision !== 'bigint' || l.revision <= 0n)
    return fail('IDENTITY_INCONSISTENT');
  const reverse = await tx.machinePrincipal.findMany({ where: { agentId: row.agentId }, select: { id: true }, take: 2 });
  if (!Array.isArray(reverse) || reverse.length !== 1 || reverse[0].id !== row.id)
    return fail('IDENTITY_INCONSISTENT');
  const outgoing = await tx.agentIdentitySuccessor.findMany({ where: { sourcePrincipalId: row.id as string }, select: { sourcePrincipalId: true }, take: 2 });
  if (!Array.isArray(outgoing) || outgoing.length)
    return fail('IDENTITY_INCONSISTENT');
  if (pairAgent !== undefined && row.agentId !== pairAgent)
    return fail('IDENTITY_PAIR_MISMATCH');
  return { principalId: row.id as string, agentId: row.agentId, lifecycleRevision: l.revision.toString(), resolvedViaLegacy: false };
}
async function read<T>(db: IdentityDatabase, options: IdentityReadOptions, fn: (tx: IdentitySnapshot) => Promise<T>): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 5000)
    return fail('INVALID_IDENTITY_INPUT', 400);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject({ code: 'IDENTITY_READ_TIMEOUT', status: 503 }), timeoutMs);
    });
    return await Promise.race([deadline, Promise.resolve().then(() => db.$transaction(fn, { isolationLevel: 'RepeatableRead', timeout: timeoutMs, maxWait: timeoutMs }))]);
  }
  catch (e) {
    // Only our closed, two-field values survive. Never expose provider exceptions.
    if (e && typeof e === 'object' && Object.keys(e).length === 2 && errors.has((e as IdentityError).code) && [400, 404, 409, 503].includes((e as IdentityError).status))
      throw e;
    if (e && typeof e === 'object' && 'code' in e && ['P1008', 'P2024', 'ETIMEDOUT'].includes(String(e.code)))
      return fail('IDENTITY_READ_TIMEOUT', 503);
    return fail('IDENTITY_READ_UNAVAILABLE', 503);
  }
  finally {
    if (timer)
      clearTimeout(timer);
  }
}
export async function resolveCanonicalByPrincipal(principalId: string, db: IdentityDatabase = defaultDatabase, options: IdentityReadOptions = {}): Promise<CanonicalIdentity> {
  const id = principalInput(principalId);
  return read(db, options, tx => canonical(tx, { id }));
}
export async function resolveCanonicalByAgent(agentId: string, db: IdentityDatabase = defaultDatabase, options: IdentityReadOptions = {}): Promise<CanonicalIdentity> {
  const agentIdExact = agentInput(agentId);
  return read(db, options, tx => canonical(tx, { agentId: agentIdExact }));
}
export async function validateCanonicalPair(pair: {
  principalId: string;
  agentId: string;
}, db: IdentityDatabase = defaultDatabase, options: IdentityReadOptions = {}): Promise<CanonicalIdentity> {
  const id = principalInput(pair?.principalId), agentId = agentInput(pair?.agentId);
  return read(db, options, tx => canonical(tx, { id }, agentId));
}
export async function resolveSuccessorForMigration(input: {
  sourcePrincipalId: string;
}, db: IdentityDatabase = defaultDatabase, options: IdentityReadOptions = {}): Promise<MigrationIdentity> {
  const sourcePrincipalId = principalInput(input?.sourcePrincipalId);
  return read(db, options, async (tx) => {
    await principal(tx, { id: sourcePrincipalId });
    const edge = one(await tx.agentIdentitySuccessor.findMany({ where: { sourcePrincipalId }, select: { sourcePrincipalId: true, targetPrincipalId: true, evidenceRef: true }, take: 2 }), 'SUCCESSOR_NOT_FOUND');
    if (edge.sourcePrincipalId !== sourcePrincipalId || typeof edge.targetPrincipalId !== 'string' || !uuid.test(edge.targetPrincipalId) || edge.targetPrincipalId === sourcePrincipalId || typeof edge.evidenceRef !== 'string' || !edge.evidenceRef.trim())
      return fail('IDENTITY_INCONSISTENT');
    const lifecycle = await tx.agentIdentityLifecycle.findMany({ where: { principalId: sourcePrincipalId }, select: lifecycleSelect, take: 2 });
    if (lifecycle.length !== 1 || lifecycle[0].principalId !== sourcePrincipalId || !['legacy', 'retired'].includes(lifecycle[0].state as string))
      return fail('IDENTITY_INCONSISTENT');
    const outgoing = await tx.agentIdentitySuccessor.findMany({ where: { sourcePrincipalId: edge.targetPrincipalId }, select: { sourcePrincipalId: true }, take: 2 });
    const incoming = await tx.agentIdentitySuccessor.findMany({ where: { targetPrincipalId: sourcePrincipalId }, select: { sourcePrincipalId: true }, take: 2 });
    if (outgoing.length || incoming.length)
      return fail('IDENTITY_INCONSISTENT');
    let target: CanonicalIdentity;
    try {
      target = await canonical(tx, { id: edge.targetPrincipalId });
    }
    catch (e) {
      if (e && typeof e === 'object' && 'code' in e && ['IDENTITY_NOT_FOUND', 'IDENTITY_NOT_AGENT', 'IDENTITY_INACTIVE', 'IDENTITY_NOT_CANONICAL'].includes(String(e.code)))
        return fail('IDENTITY_INCONSISTENT');
      throw e;
    }
    return { sourcePrincipalId, principalId: target.principalId, agentId: target.agentId, lifecycleRevision: target.lifecycleRevision, resolvedViaLegacy: true, evidenceRef: edge.evidenceRef };
  });
}
