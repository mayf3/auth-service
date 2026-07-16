/**
 * Key rotation tests (plan §13; task spec §十一, §十四 Rotation).
 *
 * V0 = manual rotation (config change + restart). These tests simulate rotation
 * by reconfiguring the env and resetting the cached keyring.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signWorkflowAccessToken, verifyWorkflowToken } from '../../src/lib/oauth/workflow-signer.js';
import {
  getWorkflowKeyring,
  resetWorkflowKeyringForTests,
} from '../../src/lib/oauth/workflow-keyring.js';
import {
  generateTestKeyPair,
  configureKeyringEnv,
  clearKeyringEnv,
} from './_workflow-test-keys.js';

const ORIGINAL_ENV = { ...process.env };

describe('workflow key rotation', () => {
  afterEach(() => {
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
    for (const k of Object.keys(process.env)) if (!(k in ORIGINAL_ENV)) delete process.env[k];
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('overlap window: token signed by old active key verifies while its public key is in previous', () => {
    // Phase 1: active = oldKey
    const oldKey = generateTestKeyPair('key-v1-20260701', 2048);
    configureKeyringEnv({ activeKid: oldKey.kid, activePrivateKeyPem: oldKey.privateKeyPem });
    resetWorkflowKeyringForTests();
    const oldToken = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });

    // Phase 2: rotate — newKey active, oldKey demoted to previous (public only)
    const newKey = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({
      activeKid: newKey.kid,
      activePrivateKeyPem: newKey.privateKeyPem,
      previous: [{ kid: oldKey.kid, publicKeyPem: oldKey.publicKeyPem }],
    });
    resetWorkflowKeyringForTests();

    // Old token still verifies because oldKey's public key is in the ring.
    const verified = verifyWorkflowToken(oldToken);
    assert.equal(verified.sub, 'p');
  });

  it('new token is signed with the active (new) kid', () => {
    const oldKey = generateTestKeyPair('key-v1-20260701', 2048);
    const newKey = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({
      activeKid: newKey.kid,
      activePrivateKeyPem: newKey.privateKeyPem,
      previous: [{ kid: oldKey.kid, publicKeyPem: oldKey.publicKeyPem }],
    });
    resetWorkflowKeyringForTests();

    const token = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    const header = jwt.decode(token, { complete: true }) as any;
    assert.equal(header.header.kid, newKey.kid);
  });

  it('after retiring the previous key, old token no longer verifies', () => {
    const oldKey = generateTestKeyPair('key-v1-20260701', 2048);
    const newKey = generateTestKeyPair('key-v1-20260716', 2048);

    // sign with old, keep it as previous
    configureKeyringEnv({
      activeKid: newKey.kid,
      activePrivateKeyPem: newKey.privateKeyPem,
      previous: [{ kid: oldKey.kid, publicKeyPem: oldKey.publicKeyPem }],
    });
    resetWorkflowKeyringForTests();
    // To get an old-key-signed token we temporarily make oldKey active:
    configureKeyringEnv({ activeKid: oldKey.kid, activePrivateKeyPem: oldKey.privateKeyPem });
    resetWorkflowKeyringForTests();
    const oldToken = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });

    // Now retire: newKey active, oldKey NOT in previous.
    configureKeyringEnv({ activeKid: newKey.kid, activePrivateKeyPem: newKey.privateKeyPem });
    resetWorkflowKeyringForTests();

    assert.equal(getWorkflowKeyring().verificationKeys.has(oldKey.kid), false);
    assert.throws(() => verifyWorkflowToken(oldToken), /not recognized/i);
  });

  it('previous key can never be used to sign (signer always uses active only)', () => {
    const oldKey = generateTestKeyPair('key-v1-20260701', 2048);
    const newKey = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({
      activeKid: newKey.kid,
      activePrivateKeyPem: newKey.privateKeyPem,
      previous: [{ kid: oldKey.kid, publicKeyPem: oldKey.publicKeyPem }],
    });
    resetWorkflowKeyringForTests();

    // The active signer only holds newKey's private key. A freshly signed token
    // must carry newKey's kid, proving oldKey did not sign it.
    const token = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    const header = jwt.decode(token, { complete: true }) as any;
    assert.equal(header.header.kid, newKey.kid);
    assert.notEqual(header.header.kid, oldKey.kid);
  });
});
