/**
 * Client secret generation, hashing, and verification.
 *
 * Uses Node.js built-in crypto.scryptSync for key derivation:
 *   - scrypt is purpose-built for password/key hashing with tunable cost
 *   - Avoids bcrypt dependency for non-password secrets
 *   - Constant-time comparison via crypto.timingSafeEqual
 *
 * Storage format: "salt:hash" (both hex-encoded)
 *   - salt: 16 random bytes
 *   - hash: scrypt(salt + secret, N=16384, r=8, p=1, dklen=64)
 */

import crypto from 'node:crypto';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SECRET_BYTES = 32; // 256 bits

const SEPARATOR = ':';

/**
 * Generate a new client secret (256-bit random, base64url encoded).
 */
export function generateClientSecret(): string {
  return crypto.randomBytes(SECRET_BYTES).toString('base64url');
}

/**
 * Hash a client secret for storage.
 * Returns "salt:hash" format where both are hex-encoded.
 */
export function hashClientSecret(secret: string): string {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(secret, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');
  return salt + SEPARATOR + hash;
}

/**
 * Verify a client secret against a stored "salt:hash" value.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyClientSecret(secret: string, stored: string): boolean {
  const sepIndex = stored.indexOf(SEPARATOR);
  if (sepIndex === -1) return false;

  const salt = stored.slice(0, sepIndex);
  const expectedHash = stored.slice(sepIndex + 1);

  if (!salt || !expectedHash) return false;

  const actualHash = crypto.scryptSync(secret, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');

  // Constant-time comparison
  const actualBuf = Buffer.from(actualHash, 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');

  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}
