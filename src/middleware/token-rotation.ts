/**
 * Refresh Token Rotation — in-memory revocation store
 *
 * When a refresh token is used, its jti is added to the revoked set.
 * Any refresh attempt with a revoked jti is rejected.
 *
 * Entries auto-expire after the refresh token TTL (default 30d).
 * In production, replace with Redis or a DB table for persistence.
 */

const revokedTokens = new Map<string, number>(); // jti -> expiresAt (unix ms)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // cleanup every hour

// Periodic cleanup of expired entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function cleanup(): void {
  const now = Date.now();
  for (const [jti, expiresAt] of revokedTokens) {
    if (now > expiresAt) {
      revokedTokens.delete(jti);
    }
  }
}

export function startCleanup(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
    cleanupTimer.unref?.(); // Don't block process exit
  }
}

/**
 * Revoke a refresh token by its jti.
 * @param jti — JWT ID of the refresh token
 * @param ttlMs — how long until this token naturally expires (for auto-cleanup)
 */
export function revokeRefreshToken(jti: string, ttlMs: number = 30 * 24 * 60 * 60 * 1000): void {
  revokedTokens.set(jti, Date.now() + ttlMs);
}

/**
 * Check if a refresh token has been revoked.
 */
export function isRefreshTokenRevoked(jti: string): boolean {
  const expiresAt = revokedTokens.get(jti);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    revokedTokens.delete(jti);
    return false;
  }
  return true;
}
