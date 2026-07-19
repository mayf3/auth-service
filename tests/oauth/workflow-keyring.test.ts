/**
 * Workflow key ring validation tests (plan §6, §12; task spec §六, §十四).
 *
 * Covers every fail-fast rule: one active key, >=2048-bit, unique kids,
 * unparseable/missing/<2048-bit/duplicate-kid all rejected at load. Also
 * asserts JWKS exposes ONLY public params (no d/p/q/dp/dq/qi).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadWorkflowKeyring,
  isWorkflowKeyringConfigured,
} from '../../src/lib/oauth/workflow-keyring.js';
import {
  generateTestKeyPair,
  configureKeyringEnv,
  clearKeyringEnv,
} from './_workflow-test-keys.js';

const ORIGINAL_ENV = { ...process.env };

describe('workflow keyring — startup validation', () => {
  beforeEach(() => clearKeyringEnv());
  afterEach(() => {
    // restore
    for (const k of Object.keys(process.env)) {
      if (!(k in ORIGINAL_ENV)) delete process.env[k];
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('isWorkflowKeyringConfigured is false with no env', () => {
    assert.equal(isWorkflowKeyringConfigured(), false);
  });

  it('loads a valid 2048-bit active key and exposes public-only JWK', () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({ activeKid: active.kid, activePrivateKeyPem: active.privateKeyPem });

    const ring = loadWorkflowKeyring();
    assert.equal(ring.active.kid, 'key-v1-20260716');
    assert.equal(ring.jwksKeys.length, 1);
    assert.equal(ring.jwksKeys[0].kty, 'RSA');
    assert.equal(ring.jwksKeys[0].use, 'sig');
    assert.equal(ring.jwksKeys[0].alg, 'RS256');
    assert.equal(ring.jwksKeys[0].kid, 'key-v1-20260716');
    assert.equal(ring.jwksKeys[0].e, 'AQAB');
    assert.ok(ring.jwksKeys[0].n.length > 0);
  });

  it('loads the active key from JWT_PRIVATE_KEY_FILE in ESM runtime', () => {
    const active = generateTestKeyPair('key-v1-file-20260718', 2048);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-v1-keyring-'));
    const file = path.join(directory, 'active.pem');
    try {
      fs.writeFileSync(file, active.privateKeyPem, { mode: 0o600 });
      process.env.JWT_PRIVATE_KEY = '';
      process.env.JWT_PRIVATE_KEY_FILE = file;
      process.env.JWT_KID = active.kid;
      const ring = loadWorkflowKeyring();
      assert.equal(ring.active.kid, active.kid);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('JWKS keys NEVER contain private parameters (d/p/q/dp/dq/qi)', () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({ activeKid: active.kid, activePrivateKeyPem: active.privateKeyPem });

    const ring = loadWorkflowKeyring();
    for (const jwk of ring.jwksKeys) {
      for (const priv of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
        assert.equal((jwk as Record<string, unknown>)[priv], undefined, `JWK must not expose ${priv}`);
      }
    }
  });

  it('loads active + previous public keys with stable order (active first)', () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    const prev = generateTestKeyPair('key-v1-20260701', 2048);
    configureKeyringEnv({
      activeKid: active.kid,
      activePrivateKeyPem: active.privateKeyPem,
      previous: [{ kid: prev.kid, publicKeyPem: prev.publicKeyPem }],
    });

    const ring = loadWorkflowKeyring();
    assert.equal(ring.jwksKeys.length, 2);
    assert.equal(ring.jwksKeys[0].kid, active.kid, 'active must be first');
    assert.equal(ring.jwksKeys[1].kid, prev.kid);
    assert.equal(ring.verificationKeys.size, 2);
    assert.ok(ring.verificationKeys.has(active.kid));
    assert.ok(ring.verificationKeys.has(prev.kid));
  });

  it('rejects < 2048-bit key at startup', () => {
    const weak = generateTestKeyPair('key-v1-20260716', 1024);
    configureKeyringEnv({ activeKid: weak.kid, activePrivateKeyPem: weak.privateKeyPem });
    assert.throws(() => loadWorkflowKeyring(), /2048-bit/i);
  });

  it('rejects unparseable private key at startup', () => {
    configureKeyringEnv({
      activeKid: 'key-v1-20260716',
      activePrivateKeyPem: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----',
    });
    assert.throws(() => loadWorkflowKeyring(), /unparseable/i);
  });

  it('rejects missing kid at startup', () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    process.env.JWT_PRIVATE_KEY = active.privateKeyPem;
    process.env.JWT_KID = '';
    assert.throws(() => loadWorkflowKeyring(), /JWT_KID is required/i);
  });

  it('rejects duplicate kid (previous duplicates active)', () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({
      activeKid: active.kid,
      activePrivateKeyPem: active.privateKeyPem,
      previous: [{ kid: active.kid, publicKeyPem: active.publicKeyPem }],
    });
    assert.throws(() => loadWorkflowKeyring(), /duplicates the active kid/i);
  });

  it('rejects duplicate kids among previous keys', () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    const prev = generateTestKeyPair('key-v1-20260701', 2048);
    configureKeyringEnv({
      activeKid: active.kid,
      activePrivateKeyPem: active.privateKeyPem,
      previous: [
        { kid: 'key-v1-20260701', publicKeyPem: prev.publicKeyPem },
        { kid: 'key-v1-20260701', publicKeyPem: prev.publicKeyPem },
      ],
    });
    assert.throws(() => loadWorkflowKeyring(), /duplicate previous key kid/i);
  });

  it('rejects unparseable previous public key', () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({
      activeKid: active.kid,
      activePrivateKeyPem: active.privateKeyPem,
      previous: [{ kid: 'key-v1-20260701', publicKeyPem: 'garbage-not-a-key' }],
    });
    assert.throws(() => loadWorkflowKeyring(), /unparseable/i);
  });
});
