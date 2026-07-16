/**
 * Shared test fixtures for workflow RS256 tests.
 *
 * Generates RSA key pairs ON DEMAND at test time using node:crypto. These keys
 * are TEST-ONLY — randomly generated each run, never committed as PEM, never a
 * production fallback. No real secrets live here.
 */

import crypto from 'node:crypto';

export interface TestKeyPair {
  kid: string;
  /** PKCS#8 PEM private key. */
  privateKeyPem: string;
  /** SPKI PEM public key. */
  publicKeyPem: string;
  /** Private KeyObject. */
  privateKey: crypto.KeyObject;
  /** Public KeyObject. */
  publicKey: crypto.KeyObject;
}

/**
 * Generate an RSA key pair of the requested size (default 2048).
 */
export function generateTestKeyPair(kid: string, bits = 2048): TestKeyPair {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: bits,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    kid,
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    privateKey: crypto.createPrivateKey({ key: privateKey, format: 'pem', type: 'pkcs8' }),
    publicKey: crypto.createPublicKey({ key: publicKey, format: 'pem', type: 'spki' }),
  };
}

/**
 * Configure process.env so the workflow keyring loads the given active key
 * (and optional previous public keys), then reset the cached keyring so the
 * next getWorkflowKeyring() rebuilds from the new env.
 */
export function configureKeyringEnv(opts: {
  activeKid: string;
  activePrivateKeyPem: string;
  previous?: Array<{ kid: string; publicKeyPem: string }>;
}): void {
  process.env.JWT_KID = opts.activeKid;
  process.env.JWT_PRIVATE_KEY = opts.activePrivateKeyPem;
  process.env.JWT_PRIVATE_KEY_FILE = '';
  if (opts.previous && opts.previous.length > 0) {
    process.env.JWT_PREVIOUS_PUBLIC_KEYS = opts.previous
      .map((p) => `${p.kid}|${p.publicKeyPem}`)
      .join('\n');
  } else {
    process.env.JWT_PREVIOUS_PUBLIC_KEYS = '';
  }
}

/**
 * Clear the workflow keyring env + cache. Returns env to "not configured".
 */
export function clearKeyringEnv(): void {
  delete process.env.JWT_KID;
  delete process.env.JWT_PRIVATE_KEY;
  delete process.env.JWT_PRIVATE_KEY_FILE;
  delete process.env.JWT_PREVIOUS_PUBLIC_KEYS;
}
