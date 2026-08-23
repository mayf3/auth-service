import { prisma } from '../../../lib/prisma.js';

export type IdentityResolutionErrorCode =
  | 'INVALID_QUERY_PARAMETERS'
  | 'INVALID_EXTERNAL_REF'
  | 'IDENTITY_RESOLUTION_AMBIGUOUS'
  | 'IDENTITY_RESOLUTION_TIMEOUT'
  | 'IDENTITY_RESOLUTION_QUERY_FAILED';

export class IdentityResolutionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: IdentityResolutionErrorCode,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'IdentityResolutionError';
  }
}

export type IdentityResolutionKind = 'principal' | 'client';

export interface PrincipalResolutionRow {
  id: string;
  principalType: string;
  agentId: string | null;
  externalRef: string | null;
}

export interface ClientResolutionRow {
  clientId: string;
  machinePrincipalId: string;
  externalRef: string | null;
}

interface PrincipalFindManyArgs {
  where: { externalRef: string };
  select: {
    id: true;
    principalType: true;
    agentId: true;
    externalRef: true;
  };
  take: 2;
}

interface ClientFindManyArgs {
  where: { externalRef: string };
  select: {
    clientId: true;
    machinePrincipalId: true;
    externalRef: true;
  };
  take: 2;
}

export interface IdentityResolutionDatabase {
  machinePrincipal: {
    findMany(args: PrincipalFindManyArgs): Promise<PrincipalResolutionRow[]>;
  };
  machineClient: {
    findMany(args: ClientFindManyArgs): Promise<ClientResolutionRow[]>;
  };
}

export type PrincipalResolution =
  | { state: 'ABSENT' }
  | {
      state: 'PRESENT';
      principal: {
        id: string;
        principal_type: string;
        agent_id: string | null;
        external_ref: string;
      };
    };

export type ClientResolution =
  | { state: 'ABSENT' }
  | {
      state: 'PRESENT';
      client: {
        client_id: string;
        principal_id: string;
        external_ref: string;
      };
    };

const AGENT_ID_RE = /^[A-Za-z0-9_-]{1,200}$/;

const PRINCIPAL_SELECT = {
  id: true,
  principalType: true,
  agentId: true,
  externalRef: true,
} as const;

const CLIENT_SELECT = {
  clientId: true,
  machinePrincipalId: true,
  externalRef: true,
} as const;

const defaultDatabase: IdentityResolutionDatabase = {
  machinePrincipal: {
    findMany: (args) => prisma.machinePrincipal.findMany(args) as Promise<PrincipalResolutionRow[]>,
  },
  machineClient: {
    findMany: (args) => prisma.machineClient.findMany(args) as Promise<ClientResolutionRow[]>,
  },
};

/**
 * Bounded wall-clock budget for a single resolution query in the production
 * resolver. A query that silently never settles must still end HTTP handling
 * with 504 IDENTITY_RESOLUTION_TIMEOUT instead of hanging forever.
 */
export const IDENTITY_RESOLUTION_DEFAULT_TIMEOUT_MS = 5000;

export interface IdentityResolutionOptions {
  /** Query deadline override; tests inject a short value instead of waiting 5s. */
  timeoutMs?: number;
}

/**
 * Race one resolution query against a wall-clock deadline.
 *
 * The deadline only bounds how long this application layer waits before the
 * HTTP handling fails with 504 IDENTITY_RESOLUTION_TIMEOUT. It does NOT cancel
 * the underlying database operation: the query promise may settle after the
 * deadline, so late settlement is absorbed here — it can neither reject
 * unhandled nor rewrite a response that already timed out.
 */
function withQueryDeadline<T>(query: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new IdentityResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT'));
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

function invalid(status: number, code: IdentityResolutionErrorCode): never {
  throw new IdentityResolutionError(status, code);
}

/**
 * Require exactly one scalar external_ref query parameter and validate it before
 * any identity database operation.
 */
export function parseExternalRefQuery(
  query: Record<string, unknown>,
  kind: IdentityResolutionKind,
): string {
  const keys = Object.keys(query);
  if (keys.length !== 1 || keys[0] !== 'external_ref' || typeof query.external_ref !== 'string') {
    return invalid(400, 'INVALID_QUERY_PARAMETERS');
  }
  return validateExternalRef(query.external_ref, kind);
}

/** Enforce the accepted Agent ID grammar independently of the wider upstream helper. */
export function validateExternalRef(
  externalRef: string,
  kind: IdentityResolutionKind,
): string {
  const prefix = `agentcore:v1:${kind}:`;
  if (!externalRef.startsWith(prefix)) return invalid(400, 'INVALID_EXTERNAL_REF');

  const agentId = externalRef.slice(prefix.length);
  if (!AGENT_ID_RE.test(agentId)) return invalid(400, 'INVALID_EXTERNAL_REF');

  return externalRef;
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

export function toIdentityResolutionError(error: unknown): IdentityResolutionError {
  if (error instanceof IdentityResolutionError) return error;
  if (isTimeoutError(error)) {
    return new IdentityResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT', { cause: error });
  }
  return new IdentityResolutionError(500, 'IDENTITY_RESOLUTION_QUERY_FAILED', { cause: error });
}

export async function resolvePrincipalByExternalRef(
  externalRef: string,
  database: IdentityResolutionDatabase = defaultDatabase,
  options: IdentityResolutionOptions = {},
): Promise<PrincipalResolution> {
  validateExternalRef(externalRef, 'principal');
  const timeoutMs = options.timeoutMs ?? IDENTITY_RESOLUTION_DEFAULT_TIMEOUT_MS;
  try {
    const rows = await withQueryDeadline(
      database.machinePrincipal.findMany({
        where: { externalRef },
        select: PRINCIPAL_SELECT,
        take: 2,
      }),
      timeoutMs,
    );
    if (!Array.isArray(rows)) throw new TypeError('Principal resolution query returned a non-array result');
    if (rows.length === 0) return { state: 'ABSENT' };
    if (rows.length > 1) return invalid(409, 'IDENTITY_RESOLUTION_AMBIGUOUS');

    const row = rows[0];
    if (!row || row.externalRef !== externalRef) {
      throw new TypeError('Principal resolution query returned a malformed exact-match row');
    }
    return {
      state: 'PRESENT',
      principal: {
        id: row.id,
        principal_type: row.principalType,
        agent_id: row.agentId,
        external_ref: externalRef,
      },
    };
  } catch (error) {
    throw toIdentityResolutionError(error);
  }
}

export async function resolveClientByExternalRef(
  externalRef: string,
  database: IdentityResolutionDatabase = defaultDatabase,
  options: IdentityResolutionOptions = {},
): Promise<ClientResolution> {
  validateExternalRef(externalRef, 'client');
  const timeoutMs = options.timeoutMs ?? IDENTITY_RESOLUTION_DEFAULT_TIMEOUT_MS;
  try {
    const rows = await withQueryDeadline(
      database.machineClient.findMany({
        where: { externalRef },
        select: CLIENT_SELECT,
        take: 2,
      }),
      timeoutMs,
    );
    if (!Array.isArray(rows)) throw new TypeError('Client resolution query returned a non-array result');
    if (rows.length === 0) return { state: 'ABSENT' };
    if (rows.length > 1) return invalid(409, 'IDENTITY_RESOLUTION_AMBIGUOUS');

    const row = rows[0];
    if (!row || row.externalRef !== externalRef) {
      throw new TypeError('Client resolution query returned a malformed exact-match row');
    }
    return {
      state: 'PRESENT',
      client: {
        client_id: row.clientId,
        principal_id: row.machinePrincipalId,
        external_ref: externalRef,
      },
    };
  } catch (error) {
    throw toIdentityResolutionError(error);
  }
}
