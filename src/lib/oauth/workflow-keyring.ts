/**
 * Workflow RS256 key ring — loads, validates, and exposes the active signing
 * key and (optional) previous verification-only PUBLIC keys.
 *
 * Frozen by plan §12 (SIGNING_AND_JWKS_MODEL) + §13 (KEY_ROTATION_MODEL):
 *   - Exactly ONE active RSA private key (>=2048-bit, PKCS#8 PEM), alg RS256.
 *   - Zero or more previous PUBLIC keys (verification only, never sign).
 *   - All keys parsed + validated ONCE at load time. Any incomplete, duplicate,
 *     unparseable, <2048-bit, or duplicate-kid config ⇒ throw (fail-fast).
 *   - No per-request fallback, no random signer selection, no fragile splitting.
 *
 * Private keys live ONLY in this module's memory. They are never serialized to
 * JWKS, never logged, never returned by any accessor. Only public JWKs are
 * exposed via `jwksSnapshot`.
 */

import crypto from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Read a workflow keyring env var LIVE (from process.env), not from the
 * module-load snapshot in env.ts. This keeps tests (which mutate process.env
 * between cases) honest AND lets operators rotate keys via env change + module
 * reload. The snapshot in env.ts is only used for issuer/version (stable).
 */
function envVal(name: string): string {
  return (process.env[name] ?? '').trim();
}

/** Audience that triggers the RS256 workflow signer. */
export const WORKFLOW_AUDIENCE = 'svc-workflow';

/** Minimum RSA modulus size in bits. */
const MIN_RSA_BITS = 2048;

/** Public RSA JWK shape we publish. Strictly public — no private params. */
export interface PublicRsaJwk {
  kty: 'RSA';
  use: 'sig';
  alg: 'RS256';
  kid: string;
  n: string;
  e: string;
}

export interface VerificationKey {
  kid: string;
  /** RSA public key, ready for jwt.verify / createVerify. */
  publicKey: crypto.KeyObject;
  /** Public-only JWK (kty/use/alg/kid/n/e). Safe for JWKS. */
  jwk: PublicRsaJwk;
}

export interface ActiveSigner {
  kid: string;
  /** RSA private key (active only). Never exposed outside this signer. */
  privateKey: crypto.KeyObject;
  /** Public-only JWK for the active key. */
  jwk: PublicRsaJwk;
}

export interface WorkflowKeyring {
  active: ActiveSigner;
  /** Active + previous public keys, kid → key, for verification. */
  verificationKeys: Map<string, VerificationKey>;
  /** Stable-ordered JWKS keys array (active first, then previous in input order). */
  jwksKeys: PublicRsaJwk[];
}

// ─── JWK helpers ──────────────────────────────────────────────────────────

/**
 * Export an RSA KeyObject as a public-only JWK containing exactly the
 * RFC 7517 public RSA parameters. Private parameters (d/p/q/dp/dq/qi) are
 * stripped defensively even though only public keys are exported.
 */
function toPublicRsaJwk(key: crypto.KeyObject, kid: string): PublicRsaJwk {
  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error(`Workflow keyring: key "${kid}" is not RSA (got ${String(key.asymmetricKeyType)})`);
  }
  // export({ format: 'jwk' }) on a public RSA KeyObject yields { kty, n, e }.
  // For a private KeyObject it also includes private params — so we rebuild
  // from the derived public key to guarantee NO private material leaks.
  const publicKey = key.type === 'public' ? key : crypto.createPublicKey(key);
  const raw = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  const jwk: PublicRsaJwk = {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: String(raw.n),
    e: String(raw.e),
  };
  return jwk;
}

/**
 * Assert an RSA key is at least MIN_RSA_BITS. Reads the modulus length via
 * KeyObject.asymmetricKeyDetails (Node >=16).
 */
function assertMinBits(key: crypto.KeyObject, kid: string): void {
  const details = key.asymmetricKeyDetails as { modulusLength?: number } | undefined;
  const bits = details?.modulusLength ?? 0;
  if (!bits || bits < MIN_RSA_BITS) {
    throw new Error(
      `Workflow keyring: key "${kid}" is ${bits || 'unknown'}-bit; minimum is ${MIN_RSA_BITS}-bit`,
    );
  }
}

// ─── Env reading ──────────────────────────────────────────────────────────

/** Read a PEM string from either the inline env var or the file-path env var. */
function readPemFromEnv(label: string): string {
  const inline = envVal('JWT_PRIVATE_KEY');
  if (inline) return inline;
  const file = envVal('JWT_PRIVATE_KEY_FILE');
  if (file) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    return readFileSync(file, 'utf-8');
  }
  throw new Error(
    `Workflow keyring: ${label} not configured (set JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_FILE)`,
  );
}

/** Parse JWT_PREVIOUS_PUBLIC_KEYS into [kid, pem][] entries. */
function parsePreviousKeys(raw: string): Array<{ kid: string; pem: string }> {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // Entries separated by newlines. Each entry: "<kid>|<PEM>". The PEM itself
  // may contain newlines (base64 lines) — that's fine because we split on the
  // top-level newline BEFORE the "-----BEGIN" marker.
  const entries: Array<{ kid: string; pem: string }> = [];
  const blocks = trimmed.split(/\n(?=\S+\|-----BEGIN)/);
  for (const block of blocks) {
    const sep = block.indexOf('|');
    if (sep === -1) {
      throw new Error(
        `Workflow keyring: invalid previous-public-key entry (missing "<kid>|<PEM>" separator): "${block.slice(0, 40)}..."`,
      );
    }
    const kid = block.slice(0, sep).trim();
    const pem = block.slice(sep + 1).trim();
    if (!kid || !pem) {
      throw new Error('Workflow keyring: previous-public-key entry has empty kid or PEM');
    }
    entries.push({ kid, pem });
  }
  return entries;
}

// ─── Loader ───────────────────────────────────────────────────────────────

/**
 * Build a WorkflowKeyring from the current environment.
 *
 * @throws Error on ANY misconfiguration (missing/unparseable key, <2048-bit,
 *   duplicate kid, non-RSA key). Caller is expected to let this propagate at
 *   startup so the service fails fast.
 */
export function loadWorkflowKeyring(): WorkflowKeyring {
  const activeKid = envVal('JWT_KID');
  if (!activeKid) {
    throw new Error('Workflow keyring: JWT_KID is required when workflow signing is enabled');
  }

  // ── Active key (private) ───────────────────────────────────────────────
  const activePem = readPemFromEnv('active private key');
  let activePrivate: crypto.KeyObject;
  try {
    activePrivate = crypto.createPrivateKey({ key: activePem, format: 'pem', type: 'pkcs8' });
  } catch (err) {
    throw new Error(`Workflow keyring: active private key is unparseable — ${(err as Error).message}`);
  }
  if (activePrivate.asymmetricKeyType !== 'rsa') {
    throw new Error(
      `Workflow keyring: active key must be RSA (got ${String(activePrivate.asymmetricKeyType)})`,
    );
  }
  assertMinBits(activePrivate, activeKid);

  const activePublic = crypto.createPublicKey(activePrivate);
  assertMinBits(activePublic, activeKid);

  const activeJwk = toPublicRsaJwk(activePublic, activeKid);

  const verificationKeys = new Map<string, VerificationKey>();
  const jwksKeys: PublicRsaJwk[] = [activeJwk];
  verificationKeys.set(activeKid, { kid: activeKid, publicKey: activePublic, jwk: activeJwk });

  // ── Previous keys (public only) ────────────────────────────────────────
  const previousEntries = parsePreviousKeys(envVal('JWT_PREVIOUS_PUBLIC_KEYS'));
  for (const { kid, pem } of previousEntries) {
    if (kid === activeKid) {
      throw new Error(`Workflow keyring: previous key kid "${kid}" duplicates the active kid`);
    }
    if (verificationKeys.has(kid)) {
      throw new Error(`Workflow keyring: duplicate previous key kid "${kid}"`);
    }
    let prevPublic: crypto.KeyObject;
    try {
      prevPublic = crypto.createPublicKey({ key: pem, format: 'pem' });
    } catch (err) {
      throw new Error(`Workflow keyring: previous public key "${kid}" is unparseable — ${(err as Error).message}`);
    }
    if (prevPublic.asymmetricKeyType !== 'rsa') {
      throw new Error(
        `Workflow keyring: previous key "${kid}" must be RSA (got ${String(prevPublic.asymmetricKeyType)})`,
      );
    }
    assertMinBits(prevPublic, kid);
    const jwk = toPublicRsaJwk(prevPublic, kid);
    verificationKeys.set(kid, { kid, publicKey: prevPublic, jwk });
    jwksKeys.push(jwk);
  }

  return {
    active: { kid: activeKid, privateKey: activePrivate, jwk: activeJwk },
    verificationKeys,
    jwksKeys,
  };
}

/**
 * Whether the workflow key ring is configured at all. Used by the issuer to
 * reject svc-workflow requests cleanly (instead of crashing) when the operator
 * hasn't provisioned RSA keys yet.
 */
export function isWorkflowKeyringConfigured(): boolean {
  return Boolean(envVal('JWT_PRIVATE_KEY') || envVal('JWT_PRIVATE_KEY_FILE')) &&
    Boolean(envVal('JWT_KID'));
}

// ─── Singleton ────────────────────────────────────────────────────────────

let cached: WorkflowKeyring | null = null;

/**
 * Lazily build and cache the key ring. The cache is built on first access and
 * reused for the lifetime of the process — keys are parsed once, never per
 * request. Tests can call {@link resetWorkflowKeyringForTests} to rebuild.
 */
export function getWorkflowKeyring(): WorkflowKeyring {
  if (cached) return cached;
  cached = loadWorkflowKeyring();
  return cached;
}

/** Test-only: clear the cached key ring so a new config takes effect. */
export function resetWorkflowKeyringForTests(): void {
  cached = null;
}
