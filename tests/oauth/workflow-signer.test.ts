/**
 * Workflow RS256 signer tests (plan §7.5, §12; task spec §九, §十四).
 *
 * Covers: RS256 signing, header kid, frozen claims, JWKS-public-key
 * verification, and the full algorithm-confusion defense matrix
 * (alg=none, HS256 forgery, wrong pubkey, unknown kid, wrong alg, key-type).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import {
  signWorkflowAccessToken,
  verifyWorkflowToken,
  getActiveKid,
} from '../../src/lib/oauth/workflow-signer.js';
import {
  resetWorkflowKeyringForTests,
  getWorkflowKeyring,
} from '../../src/lib/oauth/workflow-keyring.js';
import {
  generateTestKeyPair,
  configureKeyringEnv,
  clearKeyringEnv,
} from './_workflow-test-keys.js';

const ORIGINAL_ENV = { ...process.env };

function setupActiveKey() {
  const active = generateTestKeyPair('key-v1-20260716', 2048);
  configureKeyringEnv({ activeKid: active.kid, activePrivateKeyPem: active.privateKeyPem });
  resetWorkflowKeyringForTests();
  return active;
}

describe('workflow signer — signing', () => {
  beforeEach(() => setupActiveKey());
  afterEach(() => {
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
    for (const k of Object.keys(process.env)) if (!(k in ORIGINAL_ENV)) delete process.env[k];
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('produces an RS256 token with the active kid in the header', () => {
    const token = signWorkflowAccessToken({
      principalId: '11111111-1111-1111-1111-111111111111',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      scope: 'workflow.read workflow.execute',
    });
    const decoded = jwt.decode(token, { complete: true }) as any;
    assert.equal(decoded.header.alg, 'RS256');
    assert.equal(decoded.header.kid, 'key-v1-20260716');
  });

  it('carries the frozen claims (plan §7.5)', () => {
    const token = signWorkflowAccessToken({
      principalId: '11111111-1111-1111-1111-111111111111',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      scope: 'workflow.read',
    });
    // Verify via the workflow verifier (uses the RS256 keyring public key).
    const payload = verifyWorkflowToken(token);
    assert.equal(payload.iss, 'auth-service');
    assert.equal(payload.sub, '11111111-1111-1111-1111-111111111111');
    assert.equal(payload.aud, 'svc-workflow');
    assert.equal(payload.principal_type, 'agent');
    assert.equal(payload.scope, 'workflow.read');
    assert.equal(payload.token_use, 'access');
    assert.equal(payload.type, 'access');
    assert.equal(payload.version, 'v1');
    assert.equal(payload.agent_id, 'test-agent');
    assert.equal(payload.client_id, 'mc_testclient123');
    assert.ok(payload.jti);
    assert.ok(payload.nbf <= payload.iat + 1);
    assert.equal(payload.exp - payload.iat, 600);
  });

  it('caps TTL at 900s', () => {
    const token = signWorkflowAccessToken({
      principalId: '11111111-1111-1111-1111-111111111111',
      agentId: 'a',
      clientId: 'c',
      scope: 'workflow.read',
      ttl: 99999,
    });
    const payload = jwt.decode(token) as any;
    assert.ok(payload.exp - payload.iat <= 900);
  });

  it('each token has a distinct jti', () => {
    const a = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    const b = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    assert.notEqual((jwt.decode(a) as any).jti, (jwt.decode(b) as any).jti);
  });

  it('verifies against the JWKS public key', () => {
    const token = signWorkflowAccessToken({
      principalId: 'p1', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    const payload = verifyWorkflowToken(token);
    assert.equal(payload.sub, 'p1');
    assert.equal(payload.aud, 'svc-workflow');
  });

  it('getActiveKid returns the active kid', () => {
    assert.equal(getActiveKid(), 'key-v1-20260716');
  });
});

describe('workflow signer — algorithm-confusion defense', () => {
  let active: ReturnType<typeof generateTestKeyPair>;
  beforeEach(() => { active = setupActiveKey(); });
  afterEach(() => {
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
    for (const k of Object.keys(process.env)) if (!(k in ORIGINAL_ENV)) delete process.env[k];
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('rejects alg=none token', () => {
    // forge an unsigned token with a known kid
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT', kid: active.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'auth-service', sub: 'p', aud: 'svc-workflow', principal_type: 'agent',
      scope: 's', token_use: 'access', type: 'access', version: 'v1',
      agent_id: 'a', client_id: 'c', jti: 'j', iat: 1, nbf: 1, exp: 9999999999,
    })).toString('base64url');
    const forged = `${header}.${payload}.`;
    assert.throws(() => verifyWorkflowToken(forged));
  });

  it('rejects HS256 forgery (public key must NOT be usable as HMAC secret)', () => {
    // Sign with HS256 using the RSA public key PEM as the "secret". A vulnerable
    // verifier would accept this; ours must reject because alg != RS256.
    const payload = {
      iss: 'auth-service', sub: 'p', aud: 'svc-workflow', principal_type: 'agent',
      scope: 's', token_use: 'access', type: 'access', version: 'v1',
      agent_id: 'a', client_id: 'c', jti: 'j', iat: 1, nbf: 1, exp: 9999999999,
    };
    const header = { alg: 'HS256', typ: 'JWT', kid: active.kid };
    const forged = jwt.sign(payload, active.publicKeyPem, { algorithm: 'HS256', header });
    assert.throws(() => verifyWorkflowToken(forged));
  });

  it('rejects unknown kid (no fallback)', () => {
    const token = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    // Tamper header kid to an unknown value, keep signature (will fail).
    const parts = token.split('.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    header.kid = 'unknown-kid';
    parts[0] = Buffer.from(JSON.stringify(header)).toString('base64url');
    assert.throws(() => verifyWorkflowToken(parts.join('.')), /not recognized/i);
  });

  it('rejects signature made with a DIFFERENT key (wrong pubkey)', () => {
    const other = generateTestKeyPair('key-v1-20260716', 2048); // same kid, different key
    const token = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    // Replace verification keyring with `other` and confirm the active-key token fails.
    configureKeyringEnv({ activeKid: other.kid, activePrivateKeyPem: other.privateKeyPem });
    resetWorkflowKeyringForTests();
    assert.throws(() => verifyWorkflowToken(token));
  });

  it('rejects a token whose header alg is not RS256 even if kid is known', () => {
    // Build an RS256-signed token, then rewrite header alg to "RS384".
    const token = signWorkflowAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    const parts = token.split('.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    header.alg = 'RS384';
    parts[0] = Buffer.from(JSON.stringify(header)).toString('base64url');
    assert.throws(() => verifyWorkflowToken(parts.join('.')));
  });

  it('key-type mismatch: an EC key masquerading is rejected at load', () => {
    // Generate an EC key and try to load it as the active key.
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const ecPem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
    configureKeyringEnv({ activeKid: 'key-v1-20260716', activePrivateKeyPem: ecPem });
    resetWorkflowKeyringForTests();
    assert.throws(() => getWorkflowKeyring(), /RSA/i);
  });
});
