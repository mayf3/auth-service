/**
 * Generic Idempotent Principal & Client Creation (AUTH_V1_GENERIC_IDEMPOTENT).
 *
 * Provides concurrency-safe, idempotent creation of MachinePrincipal and
 * MachineClient using an opaque external_ref supplied by the caller.
 *
 * Auth does NOT interpret the external_ref — it is stored and compared as an
 * opaque string. No Agent names, roles, domains, or OpenClaw concepts leak
 * into this module.
 *
 * == Concurrency guarantee ==
 * DB-level UNIQUE constraint on external_ref ensures that two concurrent
 * requests cannot create duplicate records. The race is:
 *   1) SELECT (fast path for idempotent re-call)
 *   2) INSERT (fails with P2002 if another tx committed first)
 *   3) SELECT (return the row the winner created)
 *
 * == Atomic claim ==
 * For existing principal/client binding (expectedPrincipalId / expectedClientId),
 * a conditional update (`UPDATE ... WHERE external_ref IS NULL`) prevents
 * double-binding races.
 */

import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import {
  generateClientSecret,
  hashClientSecret,
} from '../secret.js';
import { auditLog } from '../audit.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const UNIQUE_CONSTRAINT_ERROR = 'P2002';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IdempotentPrincipalParams {
  /** Opaque caller-provided unique key. Auth never interprets this. */
  externalRef: string;
  /** Optional: if set and external_ref is unbound, atomically bind to this principal. */
  expectedPrincipalId?: string;
  /** Optional human-readable label (not interpreted by business logic). */
  displayName?: string;
  /** Principal type. 'service' by default. */
  principalType?: 'agent' | 'service';
  /** Agent ID (required for 'agent' type). Used for requestDigest computation. */
  agentId?: string;
  /** Owner user ID (required for 'agent' type). Used for requestDigest computation. */
  ownerUserId?: string;
}

export interface IdempotentPrincipalResult {
  id: string;
  principalType: string;
  displayName: string | null;
  status: string;
  externalRef: string;
  createdAt: Date;
  /** true if created in this call, false if returned existing */
  created: boolean;
}

export interface IdempotentClientParams {
  /** Opaque caller-provided unique key. Auth never interprets this. */
  externalRef: string;
  /** The ID of the MachinePrincipal that should own this client. */
  principalId: string;
  /** Optional: if set and external_ref is unbound, atomically bind to this client. */
  expectedClientId?: string;
}

export interface IdempotentClientResult {
  id: string;
  clientId: string;
  machinePrincipalId: string;
  status: string;
  externalRef: string;
  createdAt: Date;
  secret?: string;
  /** true if created in this call, false if returned existing */
  created: boolean;
}

// ─── Digest Helpers ─────────────────────────────────────────────────────────

/**
 * Compute SHA-256 digest of a MachinePrincipal's stable identity fields.
 * This digest is stored in requestDigest and verified on repeat calls.
 */
function computePrincipalDigest(principalType: string, agentId?: string | null, ownerUserId?: string | null): string {
  const parts: string[] = [`principalType=${principalType}`];
  if (agentId != null) parts.push(`agentId=${agentId}`);
  if (ownerUserId != null) parts.push(`ownerUserId=${ownerUserId}`);
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// ─── Principal: Idempotent Create-or-Get ─────────────────────────────────

/**
 * Create, return, or bind an existing MachinePrincipal by external_ref.
 *
 * Idempotency is enforced by the DB-level UNIQUE constraint on
 * machine_principals.external_ref and atomic conditional update for claims.
 */
export async function createOrGetPrincipal(
  params: IdempotentPrincipalParams,
): Promise<IdempotentPrincipalResult> {
  const { externalRef, expectedPrincipalId, displayName, principalType, agentId, ownerUserId } = params;

  // ── Fast path: existing external_ref → return existing ────────────────
  const existingSearch = await prisma.machinePrincipal.findUnique({
    where: { externalRef },
  });
  if (existingSearch) {
    // Handle NULL requestDigest (legacy records): attempt atomic backfill
    if (existingSearch.requestDigest == null) {
      const storedDigest = computePrincipalDigest(
        existingSearch.principalType,
        existingSearch.agentId,
        existingSearch.ownerUserId,
      );
      // Atomic backfill: only update if still NULL
      const backfilled = await prisma.machinePrincipal.updateMany({
        where: { id: existingSearch.id, requestDigest: null },
        data: { requestDigest: storedDigest },
      });
      if (backfilled.count > 0) {
        // Backfill succeeded — digest now matches stored identity
        Object.assign(existingSearch, { requestDigest: storedDigest });
      } else {
        // Another request backfilled first — re-query
        const refreshed = await prisma.machinePrincipal.findUnique({ where: { id: existingSearch.id } });
        if (!refreshed) throw Object.assign(new Error('Principal disappeared during backfill'), { statusCode: 500 });
        Object.assign(existingSearch, refreshed);
      }
    }

    // Verify requestDigest consistency (now non-null after backfill)
    const incomingDigest = computePrincipalDigest(
      principalType ?? existingSearch.principalType,
      agentId ?? existingSearch.agentId,
      ownerUserId ?? existingSearch.ownerUserId,
    );
    if (existingSearch.requestDigest !== incomingDigest) {
      throw Object.assign(
        new Error(
          `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH: external_ref "${externalRef}" is bound to ` +
          `principal "${existingSearch.id}" with a different identity profile. ` +
          `Expected digest "${existingSearch.requestDigest}", got "${incomingDigest}".`,
        ),
        { statusCode: 409 },
      );
    }

    // If caller specified an expected principal id, verify it matches
    if (expectedPrincipalId && existingSearch.id !== expectedPrincipalId) {
      throw Object.assign(
        new Error(
          `external_ref "${externalRef}" is already bound to principal "${existingSearch.id}", ` +
          `cannot bind to expected principal "${expectedPrincipalId}"`,
        ),
        { statusCode: 409 },
      );
    }

    auditLog({
      timestamp: new Date().toISOString(),
      type: 'principal.resolved',
      principalId: existingSearch.id,
      agentId: existingSearch.agentId,
      success: true,
    });

    return {
      id: existingSearch.id,
      principalType: existingSearch.principalType,
      displayName: existingSearch.displayName,
      status: existingSearch.status,
      externalRef: existingSearch.externalRef!,
      createdAt: existingSearch.createdAt,
      created: false,
    };
  }

  // ── Claim path: bind externalRef to an existing principal ─────────────
  if (expectedPrincipalId) {
    // Atomic claim: only bind if the principal exists, is active, and externalRef is null
    const claimed = await prisma.machinePrincipal.updateMany({
      where: {
        id: expectedPrincipalId,
        externalRef: null,
        status: 'active',
      },
      data: {
        externalRef,
        requestDigest: computePrincipalDigest(
          principalType ?? 'service',
          agentId,
          ownerUserId,
        ),
        displayName: displayName ?? null,
      },
    });

    if (claimed.count === 0) {
      // Claim failed — determine the cause
      const principal = await prisma.machinePrincipal.findUnique({
        where: { id: expectedPrincipalId },
      });
      if (!principal) {
        throw Object.assign(
          new Error(`Principal "${expectedPrincipalId}" not found`),
          { statusCode: 404 },
        );
      }
      if (principal.status !== 'active') {
        throw Object.assign(
          new Error(`Principal "${expectedPrincipalId}" is not active`),
          { statusCode: 403 },
        );
      }
      if (principal.externalRef === externalRef) {
        // Concurrent request already bound it — return the record
        return {
          id: principal.id,
          principalType: principal.principalType,
          displayName: principal.displayName,
          status: principal.status,
          externalRef: principal.externalRef!,
          createdAt: principal.createdAt,
          created: false,
        };
      }
      if (principal.externalRef != null) {
        throw Object.assign(
          new Error(
            `Principal "${expectedPrincipalId}" is already bound to external_ref ` +
            `"${principal.externalRef}", cannot bind to "${externalRef}"`,
          ),
          { statusCode: 409 },
        );
      }
      throw Object.assign(
        new Error(`Failed to claim principal "${expectedPrincipalId}" for unknown reason`),
        { statusCode: 500 },
      );
    }

    // Re-query to get the updated record
    const principal = await prisma.machinePrincipal.findUnique({
      where: { id: expectedPrincipalId },
    });
    if (!principal) throw Object.assign(new Error('Principal disappeared after claim'), { statusCode: 500 });

    auditLog({
      timestamp: new Date().toISOString(),
      type: 'principal.bound',
      principalId: principal.id,
      agentId: principal.agentId,
      success: true,
    });

    return {
      id: principal.id,
      principalType: principal.principalType,
      displayName: principal.displayName,
      status: principal.status,
      externalRef: principal.externalRef!,
      createdAt: principal.createdAt,
      created: false,
    };
  }

  // ── Create path: try INSERT, catch unique violation ───────────────────
  const effectiveType = principalType ?? 'service';
  const effectiveAgentId = effectiveType === 'agent' ? (agentId ?? null) : null;
  const effectiveOwnerUserId = effectiveType === 'agent' ? (ownerUserId ?? null) : null;
  const digest = computePrincipalDigest(effectiveType, effectiveAgentId, effectiveOwnerUserId);

  try {
    const created = await prisma.machinePrincipal.create({
      data: {
        principalType: effectiveType,
        agentId: effectiveAgentId,
        ownerUserId: effectiveOwnerUserId,
        externalRef,
        requestDigest: digest,
        displayName: displayName ?? null,
      },
    });

    auditLog({
      timestamp: new Date().toISOString(),
      type: 'principal.created',
      principalId: created.id,
      agentId: created.agentId,
      success: true,
    });

    return {
      id: created.id,
      principalType: created.principalType,
      displayName: created.displayName,
      status: created.status,
      externalRef: created.externalRef!,
      createdAt: created.createdAt,
      created: true,
    };
  } catch (error) {
    // ── Concurrent unique violation → find the winner's record ──────────
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_ERROR
    ) {
      const concurrent = await prisma.machinePrincipal.findUnique({
        where: { externalRef },
      });
      if (concurrent) {
        // Verify digest consistency
        const concurrentDigest = computePrincipalDigest(
          concurrent.principalType,
          concurrent.agentId,
          concurrent.ownerUserId,
        );
        if (concurrent.requestDigest && concurrent.requestDigest !== concurrentDigest) {
          throw Object.assign(
            new Error(
              `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH: external_ref "${externalRef}" concurrent winner ` +
              `has mismatched digest`,
            ),
            { statusCode: 409 },
          );
        }
        // Verify expectedPrincipalId
        if (expectedPrincipalId && concurrent.id !== expectedPrincipalId) {
          throw Object.assign(
            new Error(
              `external_ref "${externalRef}" was concurrently created for principal ` +
              `"${concurrent.id}", not expected "${expectedPrincipalId}"`,
            ),
            { statusCode: 409 },
          );
        }
        return {
          id: concurrent.id,
          principalType: concurrent.principalType,
          displayName: concurrent.displayName,
          status: concurrent.status,
          externalRef: concurrent.externalRef!,
          createdAt: concurrent.createdAt,
          created: false,
        };
      }
    }
    throw error;
  }
}

// ─── Client: Idempotent Create-or-Get ─────────────────────────────────────

/**
 * Create, return, or claim an existing MachineClient by external_ref.
 *
 * The external_ref is globally unique across all MachineClients. If the
 * same external_ref is used with a different principal_id, the call fails
 * closed (409 Conflict).
 *
 * No resources or scopes are set on creation — client permissions are managed
 * separately via MachineAccessGrant.
 */
export async function createOrGetClient(
  params: IdempotentClientParams,
): Promise<IdempotentClientResult> {
  const { externalRef, principalId, expectedClientId } = params;

  // ── Fast path: existing external_ref → return existing ────────────────
  const existingSearch = await prisma.machineClient.findUnique({
    where: { externalRef },
  });
  if (existingSearch) {
    // Check that the existing client belongs to the claimed principal
    if (existingSearch.machinePrincipalId !== principalId) {
      throw Object.assign(
        new Error(
          `external_ref "${externalRef}" is already bound to principal ` +
          `"${existingSearch.machinePrincipalId}", cannot bind to requested principal "${principalId}"`,
        ),
        { statusCode: 409 },
      );
    }

    auditLog({
      timestamp: new Date().toISOString(),
      type: 'client.resolved',
      principalId,
      clientId: existingSearch.clientId,
      success: true,
    });

    return {
      id: existingSearch.id,
      clientId: existingSearch.clientId,
      machinePrincipalId: existingSearch.machinePrincipalId,
      status: existingSearch.status,
      externalRef: existingSearch.externalRef!,
      createdAt: existingSearch.createdAt,
      created: false,
    };
  }

  // ── Claim path: bind externalRef to an existing client ────────────────
  if (expectedClientId) {
    // Atomic claim: only bind if the client exists, is active, belongs to
    // the expected principal, and externalRef is not already set
    const claimed = await prisma.machineClient.updateMany({
      where: {
        id: expectedClientId,
        machinePrincipalId: principalId,
        externalRef: null,
        status: 'active',
      },
      data: { externalRef },
    });

    if (claimed.count === 0) {
      const client = await prisma.machineClient.findUnique({
        where: { id: expectedClientId },
      });
      if (!client) {
        throw Object.assign(
          new Error(`Client "${expectedClientId}" not found`),
          { statusCode: 404 },
        );
      }
      if (client.machinePrincipalId !== principalId) {
        throw Object.assign(
          new Error(
            `Client "${expectedClientId}" belongs to principal "${client.machinePrincipalId}", ` +
            `cannot claim for principal "${principalId}"`,
          ),
          { statusCode: 409 },
        );
      }
      if (client.status !== 'active') {
        throw Object.assign(
          new Error(`Client "${expectedClientId}" is not active`),
          { statusCode: 403 },
        );
      }
      if (client.externalRef === externalRef) {
        // Concurrent request already bound it
        return {
          id: client.id,
          clientId: client.clientId,
          machinePrincipalId: client.machinePrincipalId,
          status: client.status,
          externalRef: client.externalRef!,
          createdAt: client.createdAt,
          created: false,
        };
      }
      if (client.externalRef != null) {
        throw Object.assign(
          new Error(
            `Client "${expectedClientId}" is already bound to external_ref ` +
            `"${client.externalRef}", cannot bind to "${externalRef}"`,
          ),
          { statusCode: 409 },
        );
      }
      throw Object.assign(
        new Error(`Failed to claim client "${expectedClientId}" for unknown reason`),
        { statusCode: 500 },
      );
    }

    // Re-query to get the updated record
    const client = await prisma.machineClient.findUnique({
      where: { id: expectedClientId },
    });
    if (!client) throw Object.assign(new Error('Client disappeared after claim'), { statusCode: 500 });

    return {
      id: client.id,
      clientId: client.clientId,
      machinePrincipalId: client.machinePrincipalId,
      status: client.status,
      externalRef: client.externalRef!,
      createdAt: client.createdAt,
      created: false,
    };
  }

  // ── Verify the principal exists and is active ─────────────────────────
  const principal = await prisma.machinePrincipal.findUnique({
    where: { id: principalId },
  });
  if (!principal) {
    throw Object.assign(
      new Error(`MachinePrincipal "${principalId}" not found`),
      { statusCode: 404 },
    );
  }
  if (principal.status !== 'active') {
    throw Object.assign(
      new Error(`MachinePrincipal "${principalId}" is disabled`),
      { statusCode: 403 },
    );
  }

  // ── Create path: try INSERT, catch unique violation ───────────────────
  const clientId = 'mc_' + generateRandomId(24);
  const secret = generateClientSecret();
  const secretHash = hashClientSecret(secret);

  try {
    const created = await prisma.machineClient.create({
      data: {
        clientId,
        machinePrincipalId: principalId,
        secretHash,
        externalRef,
        allowedResources: [],
        allowedScopes: [],
      },
    });

    auditLog({
      timestamp: new Date().toISOString(),
      type: 'client.created',
      principalId,
      clientId: created.clientId,
      success: true,
    });

    return {
      id: created.id,
      clientId: created.clientId,
      machinePrincipalId: created.machinePrincipalId,
      status: created.status,
      externalRef: created.externalRef!,
      createdAt: created.createdAt,
      secret,
      created: true,
    };
  } catch (error) {
    // ── Concurrent unique violation → find the winner's record ──────────
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_ERROR
    ) {
      const concurrent = await prisma.machineClient.findUnique({
        where: { externalRef },
      });
      if (concurrent) {
        if (concurrent.machinePrincipalId !== principalId) {
          throw Object.assign(
            new Error(
              `external_ref "${externalRef}" is already bound to principal ` +
              `"${concurrent.machinePrincipalId}", cannot bind to requested principal "${principalId}"`,
            ),
            { statusCode: 409 },
          );
        }
        return {
          id: concurrent.id,
          clientId: concurrent.clientId,
          machinePrincipalId: concurrent.machinePrincipalId,
          status: concurrent.status,
          externalRef: concurrent.externalRef!,
          createdAt: concurrent.createdAt,
          created: false,
        };
      }
    }
    throw error;
  }
}

// ─── Internal Helpers ──────────────────────────────────────────────────────

/** Generate a random ID string (url-safe, no padding). */
function generateRandomId(length: number): string {
  const bytes = Math.ceil(length * 6 / 8);
  return Buffer.from(
    Array.from({ length: bytes }, () => Math.floor(Math.random() * 256)),
  ).toString('base64url').slice(0, length);
}
