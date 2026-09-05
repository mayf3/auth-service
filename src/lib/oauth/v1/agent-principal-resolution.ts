/**
 * Bounded exact Agent Principal resolution.
 *
 * Implements CTR-EAPR-003 / CTR-EAPR-004 of accepted
 * AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1:
 * one exact-UUID MachinePrincipal read with a two-row bound, a reverse
 * agentId -> principal consistency read, both inside one shared read-only
 * transaction snapshot, a bounded 5-second deadline, explicit field
 * projections, and strictly zero writes.
 *
 * This is an independent narrow operation. It deliberately does NOT reuse or
 * modify the external_ref resolver in ./resolution.ts and never falls back to
 * externalRef, display names, or User.agentId conversion.
 */

import { prisma } from '../../../lib/prisma.js';

export type AgentPrincipalResolutionErrorCode =
  | 'INVALID_PRINCIPAL_ID'
  | 'INVALID_REQUEST'
  | 'PRINCIPAL_NOT_FOUND'
  | 'IDENTITY_RESOLUTION_AMBIGUOUS'
  | 'PRINCIPAL_NOT_AGENT'
  | 'PRINCIPAL_DISABLED'
  | 'AGENT_MAPPING_MISSING'
  | 'IDENTITY_RESOLUTION_TIMEOUT'
  | 'IDENTITY_RESOLUTION_QUERY_FAILED';

export class AgentPrincipalResolutionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AgentPrincipalResolutionErrorCode,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'AgentPrincipalResolutionError';
  }
}

/**
 * Exact principal_id path grammar (CTR-EAPR-002). Hex case is equivalent on
 * input; output is the lowercase canonical representation.
 */
const PRINCIPAL_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Explicit forward projection — status included, secrets/hashes never selected. */
const PRINCIPAL_SELECT = {
  id: true,
  principalType: true,
  agentId: true,
  status: true,
} as const;

/** Explicit reverse projection — only what the consistency check needs. */
const REVERSE_SELECT = { id: true } as const;

export interface AgentPrincipalFindManyArgs {
  where: { id: string } | { agentId: string };
  select: typeof PRINCIPAL_SELECT | typeof REVERSE_SELECT;
  take: 2;
}

export interface AgentPrincipalResolutionDatabase {
  machinePrincipal: {
    findMany(args: AgentPrincipalFindManyArgs): Promise<Array<Record<string, unknown>>>;
  };
  $transaction<T>(
    fn: (tx: AgentPrincipalResolutionDatabase) => Promise<T>,
    options?: { isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable' },
  ): Promise<T>;
}

const defaultDatabase: AgentPrincipalResolutionDatabase = {
  machinePrincipal: {
    findMany: (args) =>
      prisma.machinePrincipal.findMany(args as never) as Promise<Array<Record<string, unknown>>>,
  },
  $transaction: (fn, options) =>
    prisma.$transaction(
      (tx) =>
        fn({
          machinePrincipal: {
            findMany: (args) =>
              tx.machinePrincipal.findMany(args as never) as Promise<Array<Record<string, unknown>>>,
          },
          // Prisma transactions do not nest; the resolution never re-enters.
          $transaction: () => {
            throw new Error('Nested transactions are not supported.');
          },
        }),
      options as never,
    ),
};

/**
 * Bounded wall-clock budget for the whole resolution (both reads). Mirrors the
 * IDENTITY_RESOLUTION_DEFAULT_TIMEOUT_MS precedent: the deadline only bounds
 * how long application layer waits; late settlement is absorbed and can never
 * rewrite a response that already timed out (CTR-EAPR-004).
 */
export const AGENT_PRINCIPAL_RESOLUTION_DEFAULT_TIMEOUT_MS = 5000;

export interface AgentPrincipalResolutionOptions {
  /** Deadline override; tests inject a short value instead of waiting 5s. */
  timeoutMs?: number;
}

export interface AgentPrincipalResolution {
  principalId: string;
  agentId: string;
}

function fail(status: number, code: AgentPrincipalResolutionErrorCode): never {
  throw new AgentPrincipalResolutionError(status, code);
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error) && (typeof error !== 'object' || error === null)) return false;
  const value = error as { name?: unknown; code?: unknown };
  const code = typeof value.code === 'string' ? value.code.toUpperCase() : '';
  return code === 'ETIMEDOUT'
    || code === 'P1008'
    || code === 'P2024'
    || value.name === 'TimeoutError';
}

export function toAgentPrincipalResolutionError(error: unknown): AgentPrincipalResolutionError {
  if (error instanceof AgentPrincipalResolutionError) return error;
  if (isTimeoutError(error)) {
    return new AgentPrincipalResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT', { cause: error });
  }
  return new AgentPrincipalResolutionError(500, 'IDENTITY_RESOLUTION_QUERY_FAILED', { cause: error });
}

function withQueryDeadline<T>(query: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AgentPrincipalResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT'));
    }, timeoutMs);
    timer.unref?.(); // Don't block process exit
    query.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Validate the exact principal_id path grammar and canonicalize to lowercase.
 * Runs before any target identity query (CTR-EAPR-002).
 */
export function parsePrincipalIdParam(raw: unknown): string {
  if (typeof raw !== 'string' || !PRINCIPAL_ID_PATTERN.test(raw)) {
    return fail(400, 'INVALID_PRINCIPAL_ID');
  }
  return raw.toLowerCase();
}

/**
 * The route accepts no query parameters and no body (CTR-EAPR-002). Must run
 * before any target identity query. Body presence is checked on the parsed
 * body AND on raw framing headers, because chunked GET bodies are not parsed
 * by the JSON body parser and must still be rejected fail-closed.
 */
export function assertNoQueryOrBody(
  query: Record<string, unknown>,
  body: unknown,
  headers?: Record<string, unknown>,
): void {
  if (Object.keys(query ?? {}).length > 0) fail(400, 'INVALID_REQUEST');
  if (body !== undefined && body !== null && Object.keys(body as Record<string, unknown>).length > 0) {
    fail(400, 'INVALID_REQUEST');
  }
  if (headers) {
    const contentLength = headers['content-length'];
    if (contentLength !== undefined && contentLength !== null && contentLength !== '' && contentLength !== '0') {
      fail(400, 'INVALID_REQUEST');
    }
    if (headers['transfer-encoding'] !== undefined && headers['transfer-encoding'] !== null) {
      fail(400, 'INVALID_REQUEST');
    }
  }
}

function assertRowsArray(rows: unknown): asserts rows is Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) throw new TypeError('Agent principal resolution query returned a non-array result');
}

/**
 * Resolve exactly one active AGENT relation for the exact principal UUID.
 * Both the forward and the reverse read share one read-only transaction
 * snapshot (Serializable). Database uniqueness is never trusted in place of
 * the fail-closed two-row bound.
 */
export async function resolveAgentPrincipalById(
  rawPrincipalId: string,
  database: AgentPrincipalResolutionDatabase = defaultDatabase,
  options: AgentPrincipalResolutionOptions = {},
): Promise<AgentPrincipalResolution> {
  const principalId = parsePrincipalIdParam(rawPrincipalId);
  const timeoutMs = options.timeoutMs ?? AGENT_PRINCIPAL_RESOLUTION_DEFAULT_TIMEOUT_MS;
  try {
    return await withQueryDeadline(
      database.$transaction(async (tx) => {
        const forward = await tx.machinePrincipal.findMany({
          where: { id: principalId },
          select: PRINCIPAL_SELECT,
          take: 2,
        });
        assertRowsArray(forward);
        if (forward.length === 0) fail(404, 'PRINCIPAL_NOT_FOUND');
        if (forward.length > 1) fail(409, 'IDENTITY_RESOLUTION_AMBIGUOUS');

        const row = forward[0] as Record<string, unknown>;
        if (row.id !== principalId
          || typeof row.principalType !== 'string'
          || typeof row.status !== 'string'
          || (row.agentId !== null && typeof row.agentId !== 'string')) {
          throw new TypeError('Agent principal resolution query returned a malformed exact-match row');
        }
        if (row.principalType !== 'agent') fail(422, 'PRINCIPAL_NOT_AGENT');
        if (row.status !== 'active') fail(409, 'PRINCIPAL_DISABLED');
        if (typeof row.agentId !== 'string' || row.agentId.length === 0) {
          fail(409, 'AGENT_MAPPING_MISSING');
        }

        const agentId = row.agentId as string;
        const reverse = await tx.machinePrincipal.findMany({
          where: { agentId },
          select: REVERSE_SELECT,
          take: 2,
        });
        assertRowsArray(reverse);
        if (reverse.length !== 1 || reverse[0]?.id !== principalId) {
          fail(409, 'IDENTITY_RESOLUTION_AMBIGUOUS');
        }

        return { principalId, agentId };
      }, { isolationLevel: 'Serializable' }),
      timeoutMs,
    );
  } catch (error) {
    throw toAgentPrincipalResolutionError(error);
  }
}
