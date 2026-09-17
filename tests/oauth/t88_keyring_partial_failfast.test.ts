/**
 * T88 regression — keyring partial-configuration startup fail-fast.
 *
 * OWNER_DECISION_COMMIT (OWNER_GATE_MATERIALIZATION_AND_NIGHTLY_RELEASE_20260916_V1,
 * BOUNDED_FIX_AUTHORIZED): all relevant keyring config absent → supported
 * disabled posture; ANY relevant config present → complete validation
 * required; partial/malformed → startup fail-fast. Partial config must NEVER
 * be treated as absent.
 *
 * Baseline RED (pre-fix): isWorkflowKeyringConfigured() was a binary presence
 * check — a partial config (e.g. JWT_KID set with no private key) returned
 * false, the startup gate in server.ts skipped getWorkflowKeyring(), and the
 * process served with a silently disabled workflow keyring.
 *
 * Run: JWT_SECRET=test-jwt-secret npx tsx --test tests/oauth/t88_keyring_partial_failfast.test.ts
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const {
  isWorkflowKeyringConfigured,
  resetWorkflowKeyringForTests,
} = await import('../../src/lib/oauth/workflow-keyring.js');

const KEYRING_VARS = [
  'JWT_PRIVATE_KEY',
  'JWT_PRIVATE_KEY_FILE',
  'JWT_KID',
  'JWT_PREVIOUS_PUBLIC_KEYS',
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};
for (const k of KEYRING_VARS) ORIGINAL_ENV[k] = process.env[k];

function clearKeyringEnv(): void {
  for (const k of KEYRING_VARS) delete process.env[k];
  resetWorkflowKeyringForTests();
}

function generateKeyPairPem(kid: string, bits = 2048): { kid: string; pem: string } {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: bits,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { kid, pem: privateKey };
}

describe('T88: workflow keyring partial configuration fails fast', () => {
  beforeEach(clearKeyringEnv);
  afterEach(() => {
    clearKeyringEnv();
    for (const k of KEYRING_VARS) {
      if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = ORIGINAL_ENV[k];
    }
    resetWorkflowKeyringForTests();
  });

  it('all relevant config absent → supported disabled posture (false, no throw)', () => {
    assert.equal(isWorkflowKeyringConfigured(), false);
  });

  it('complete valid config → configured (true) and the keyring fully validates', () => {
    const active = generateKeyPairPem('key-v1-t88-complete');
    process.env.JWT_KID = active.kid;
    process.env.JWT_PRIVATE_KEY = active.pem;
    assert.equal(isWorkflowKeyringConfigured(), true);
  });

  it('partial: JWT_KID without any key → startup fail-fast throw', () => {
    process.env.JWT_KID = 'key-v1-t88-kidonly';
    assert.throws(() => isWorkflowKeyringConfigured(),
      /JWT_KID is required|not configured/);
  });

  it('partial: private key without JWT_KID → startup fail-fast throw', () => {
    const active = generateKeyPairPem('key-v1-t88-keyonly');
    process.env.JWT_PRIVATE_KEY = active.pem;
    assert.throws(() => isWorkflowKeyringConfigured(),
      /JWT_KID is required/);
  });

  it('partial: JWT_KID + malformed PEM → startup fail-fast throw', () => {
    process.env.JWT_KID = 'key-v1-t88-bad';
    process.env.JWT_PRIVATE_KEY = 'not-a-pem-at-all';
    assert.throws(() => isWorkflowKeyringConfigured(),
      /unparseable/);
  });

  it('partial: JWT_KID + undersized key → startup fail-fast throw', () => {
    const weak = generateKeyPairPem('key-v1-t88-weak', 1024);
    process.env.JWT_KID = weak.kid;
    process.env.JWT_PRIVATE_KEY = weak.pem;
    assert.throws(() => isWorkflowKeyringConfigured(),
      /minimum is 2048-bit/);
  });

  it('partial: previous-keys-only (no active key/kid) → startup fail-fast throw', () => {
    const prev = generateKeyPairPem('key-v1-t88-prev');
    process.env.JWT_PREVIOUS_PUBLIC_KEYS =
      `key-v1-t88-prev-old|${crypto.createPublicKey(prev.pem).export({ type: 'spki', format: 'pem' })}`;
    assert.throws(() => isWorkflowKeyringConfigured(),
      /JWT_KID is required/);
  });
});
