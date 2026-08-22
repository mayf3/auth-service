import { prisma } from '../../prisma.js';

export type IdentityResolutionKind = 'principal' | 'client';
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
  ) {
    super(code);
    this.name = 'IdentityResolutionError';
  }
}

export function identityResolutionHttpError(error: unknown): {
  status: number;
  body: { error: IdentityResolutionErrorCode };
} {
  if (error instanceof IdentityResolutionError) {
    return { status: error.status, body: { error: error.code } };
  }
  return { status: 500, body: { error: 'IDENTITY_RESOLUTION_QUERY_FAILED' } };
}

export interface PrincipalResolutionRow {
  id: string;
  principalType: 'agent' | 'service';
  agentId: string | null;
  externalRef: string | null;
}

export interface ClientResolutionRow {
  clientId: string;
  machinePrincipalId: string;
  externalRef: string | null;
}

export interface IdentityResolutionReader {
  findPrincipalMatches(externalRef: string): Promise<PrincipalResolutionRow[]>;
  findClientMatches(externalRef: string): Promise<ClientResolutionRow[]>;
}

export const PRINCIPAL_RESOLUTION_SELECT = Object.freeze({
  id: true,
  principalType: true,
  agentId: true,
  externalRef: true,
} as const);

export const CLIENT_RESOLUTION_SELECT = Object.freeze({
  clientId: true,
  machinePrincipalId: true,
  externalRef: true,
} as const);

const DEFAULT_QUERY_TIMEOUT_MS = 5_000;
const AGENT_ID_RE = /^[A-Za-z0-9_-]{1,200}$/;
const PREFIX = Object.freeze({
  principal: 'agentcore:v1:principal:',
  client: 'agentcore:v1:client:',
} as const);

const prismaReader: IdentityResolutionReader = {
  findPrincipalMatches(externalRef) {
    return prisma.machinePrincipal.findMany({
      where: { externalRef },
      select: PRINCIPAL_RESOLUTION_SELECT,
      take: 2,
    });
  },
  findClientMatches(externalRef) {
    return prisma.machineClient.findMany({
      where: { externalRef },
      select: CLIENT_RESOLUTION_SELECT,
      take: 2,
    });
  },
};

export function requireSingleExternalRefQuery(query: Record<string, unknown>): string {
  const keys = Object.keys(query);
  if (keys.length !== 1 || keys[0] !== 'external_ref' || typeof query.external_ref !== 'string') {
    throw new IdentityResolutionError(400, 'INVALID_QUERY_PARAMETERS');
  }
  return query.external_ref;
}

export function validateAgentCoreExternalRef(externalRef: string, kind: IdentityResolutionKind): string {
  const prefix = PREFIX[kind];
  if (typeof externalRef !== 'string' || !externalRef.startsWith(prefix)) {
    throw new IdentityResolutionError(400, 'INVALID_EXTERNAL_REF');
  }

  const agentId = externalRef.slice(prefix.length);
  if (!AGENT_ID_RE.test(agentId) || `${prefix}${agentId}` !== externalRef) {
    throw new IdentityResolutionError(400, 'INVALID_EXTERNAL_REF');
  }

  return agentId;
}

async function readWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new IdentityResolutionError(504, 'IDENTITY_RESOLUTION_TIMEOUT'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeout]);
  } catch (error) {
    if (error instanceof IdentityResolutionError) throw error;
    throw new IdentityResolutionError(500, 'IDENTITY_RESOLUTION_QUERY_FAILED');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function requireSingleMatch<T>(rows: T[]): T | undefined {
  if (rows.length > 1) {
    throw new IdentityResolutionError(409, 'IDENTITY_RESOLUTION_AMBIGUOUS');
  }
  return rows[0];
}

function projectSingleMatch<T, R>(rows: T[], project: (row: T) => R): R | undefined {
  try {
    const row = requireSingleMatch(rows);
    return row === undefined ? undefined : project(row);
  } catch (error) {
    if (error instanceof IdentityResolutionError) throw error;
    throw new IdentityResolutionError(500, 'IDENTITY_RESOLUTION_QUERY_FAILED');
  }
}

export async function resolvePrincipalByExternalRef(
  externalRef: string,
  options: { reader?: IdentityResolutionReader; timeoutMs?: number } = {},
): Promise<
  | { state: 'ABSENT' }
  | {
      state: 'PRESENT';
      principal: {
        id: string;
        principal_type: 'agent' | 'service';
        agent_id: string | null;
        external_ref: string;
      };
    }
> {
  validateAgentCoreExternalRef(externalRef, 'principal');
  const reader = options.reader ?? prismaReader;
  const timeoutMs = options.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  const rows = await readWithTimeout(() => reader.findPrincipalMatches(externalRef), timeoutMs);
  const principal = projectSingleMatch(rows, (row) => {
    if (row.externalRef !== externalRef) {
      throw new IdentityResolutionError(500, 'IDENTITY_RESOLUTION_QUERY_FAILED');
    }
    return {
      id: row.id,
      principal_type: row.principalType,
      agent_id: row.agentId,
      external_ref: externalRef,
    };
  });
  return principal === undefined ? { state: 'ABSENT' } : { state: 'PRESENT', principal };
}

export async function resolveClientByExternalRef(
  externalRef: string,
  options: { reader?: IdentityResolutionReader; timeoutMs?: number } = {},
): Promise<
  | { state: 'ABSENT' }
  | {
      state: 'PRESENT';
      client: {
        client_id: string;
        principal_id: string;
        external_ref: string;
      };
    }
> {
  validateAgentCoreExternalRef(externalRef, 'client');
  const reader = options.reader ?? prismaReader;
  const timeoutMs = options.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  const rows = await readWithTimeout(() => reader.findClientMatches(externalRef), timeoutMs);
  const client = projectSingleMatch(rows, (row) => {
    if (row.externalRef !== externalRef) {
      throw new IdentityResolutionError(500, 'IDENTITY_RESOLUTION_QUERY_FAILED');
    }
    return {
      client_id: row.clientId,
      principal_id: row.machinePrincipalId,
      external_ref: externalRef,
    };
  });
  return client === undefined ? { state: 'ABSENT' } : { state: 'PRESENT', client };
}
