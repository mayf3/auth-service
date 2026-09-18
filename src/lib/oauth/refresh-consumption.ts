/**
 * Durable refresh-token single-consumption ledger (T86,
 * AUTH-SCOUT-20260914-C04).
 *
 * OWNER SECURITY DECISION (OWNER_GATE_MATERIALIZATION_AND_NIGHTLY_RELEASE_20260916_V1,
 * re-released by T85_T86_FALSE_CLOSURE_CORRECTION_AND_REPAIR_RESUME_20260918_V1 §3):
 * a still-supported refresh flow must (a) require a canonical replay
 * identity (jti) — a missing jti is a rejection, not a bypass; (b) be
 * durable across process restarts; (c) be shared across service instances;
 * (d) consume atomically. The refresh_token_consumptions table (jti PRIMARY
 * KEY) provides all four: INSERT .. ON CONFLICT (jti) DO NOTHING decides
 * the atomic winner inside PostgreSQL — exactly one concurrent caller
 * inserts, every later insert with the same jti loses. This replaces the
 * former process-local revokedTokens Map, which raced (check -> await ->
 * revoke), died on restart, was invisible to other instances, and was
 * skipped entirely for missing jti.
 *
 * Consistency bound (documented): consumption commits BEFORE the new
 * credential is minted. minting is local signing — if it throws after a
 * successful consume, the refresh token is already burned and the client
 * must re-authenticate (fail-closed); two successful rotations for one jti
 * are impossible by the PRIMARY KEY. Existing persistence authority
 * (Prisma/PostgreSQL) is reused; no new infrastructure.
 */

import { prisma } from '../prisma.js';

/**
 * Atomically consume a refresh-token jti.
 * @returns true exactly when THIS call is the single winner; false for any
 *   replay (same process, other instance, or after restart).
 */
export async function consumeRefreshToken(jti: string, ttlMs: number, userId?: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await prisma.$queryRaw<{ jti: string }[]>`
    INSERT INTO refresh_token_consumptions (jti, expires_at, user_id)
    VALUES (${jti}, ${expiresAt}, ${userId ?? null}::uuid)
    ON CONFLICT (jti) DO NOTHING
    RETURNING jti`;
  return rows.length === 1;
}

/** Diagnostics/test helper: whether a jti has a durable consumption row. */
export async function isRefreshTokenConsumed(jti: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ jti: string }[]>`
    SELECT jti FROM refresh_token_consumptions WHERE jti = ${jti}`;
  return rows.length > 0;
}
