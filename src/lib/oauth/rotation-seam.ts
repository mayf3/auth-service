/**
 * Secret-mutation enforcement seam (MACHINE_CLIENT_CREDENTIALS_V0 §11,
 * Amendment A — external prerequisite (e) SECRET_MUTATION_ENFORCEMENT_SEAM).
 *
 * The ONLY supported path that changes machine_clients secret material:
 * the SECURITY DEFINER function rotate_machine_client_secret(), which
 * atomically (1) verifies the frozen preimage fingerprint, (2) advances
 * rotated_at/updated_at together with the new secret_hash, and (3) appends an
 * immutable receipt row keyed by a stable operation_id (replay of a known
 * operation id never mutates a second time).
 *
 * Direct UPDATE of secret_hash / rotated_at is impossible for the application
 * role by column-level privileges (see migration
 * 20260909010000_machine_credential_rotation_seam); this module is the caller
 * side of that seam. Secret bytes never pass through argv/logs — only the
 * salted scrypt HASH travels over the wire to PostgreSQL.
 */

import crypto from 'node:crypto';

import { prisma } from '../../lib/prisma.js';

export interface RotationSeamResult {
  clientId: string;
  rotatedAt: Date;
  receiptId: string;
  replayed: boolean;
}

/**
 * sha256 fingerprint of the stored secret_hash string. Fingerprints (not
 * secret bytes, not the hash itself) are what the seam's preimage check and
 * the receipt ledger persist.
 */
export function secretHashFingerprint(secretHash: string): string {
  return crypto.createHash('sha256').update(secretHash).digest('hex');
}

/** Stable, receipted operation id. Callers retrying a bounded rotation MUST
 *  reuse the SAME operation id across retries (deterministic recovery). */
export function generateRotationOperationId(prefix = 'rot'): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

interface RotationSeamRow {
  client_id: string;
  rotated_at: Date;
  receipt_id: string;
  replayed: boolean;
}

export async function rotateMachineClientSecretViaSeam(params: {
  machineClientUuid: string;
  newSecretHash: string;
  preimageFingerprint: string;
  operationId: string;
  rotatedBy: string;
}): Promise<RotationSeamResult> {
  const rows = await prisma.$queryRaw<RotationSeamRow[]>`
    SELECT * FROM "rotate_machine_client_secret"(
      ${params.machineClientUuid}::uuid,
      ${params.newSecretHash},
      ${params.preimageFingerprint},
      ${params.operationId},
      ${params.rotatedBy}
    )`;
  const row = rows[0];
  if (!row) {
    throw new Error('rotation seam returned no row');
  }
  return {
    clientId: row.client_id,
    rotatedAt: new Date(row.rotated_at),
    receiptId: row.receipt_id,
    replayed: row.replayed,
  };
}
