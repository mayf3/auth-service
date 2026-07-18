import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import jwt from 'jsonwebtoken';
import {
  issueAuthorizationCodeCredential,
  issueRefreshCredential,
  parseAuthorizationCode,
  parseRefreshCredential,
  pkceS256,
  verifyOpaqueSecret,
} from '../../src/lib/oauth/v1/credentials.js';
import {
  signV1HumanAccessToken,
  verifyV1HumanAccessToken,
} from '../../src/lib/oauth/v1/signer.js';
import { getV1ContractSettings } from '../../src/lib/oauth/v1/contract.js';
import {
  clearKeyringEnv,
  configureKeyringEnv,
  generateTestKeyPair,
} from './_workflow-test-keys.js';
import { resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';

const originalEnv = { ...process.env };

beforeEach(() => {
  const key = generateTestKeyPair('v1-human-test-key');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  resetWorkflowKeyringForTests();
});

afterEach(() => {
  clearKeyringEnv();
  resetWorkflowKeyringForTests();
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test('opaque Human credentials use frozen wire formats and verifier-only storage values', () => {
  const code = issueAuthorizationCodeCredential();
  const refresh = issueRefreshCredential();
  assert.match(code.wireValue, /^ac1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
  assert.match(refresh.wireValue, /^rc1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(parseAuthorizationCode(code.wireValue), { id: code.id, secret: code.secret });
  assert.deepEqual(parseRefreshCredential(refresh.wireValue), {
    id: refresh.id,
    secret: refresh.secret,
  });
  assert.doesNotMatch(code.verifier, /ac1\.|rc1\./);
  assert.equal(code.verifier.includes(code.secret), false);
  assert.equal(refresh.verifier.includes(refresh.secret), false);
  assert.equal(verifyOpaqueSecret(code.secret, code.verifier, code.verifierParametersVersion), true);
  assert.equal(verifyOpaqueSecret('wrong-secret', code.verifier, code.verifierParametersVersion), false);
  assert.equal(verifyOpaqueSecret(code.secret, code.verifier, 'unknown'), false);
});

test('opaque parsers fail closed and PKCE S256 is base64url SHA-256', () => {
  assert.equal(parseAuthorizationCode('ac1.not-a-code'), null);
  assert.equal(parseRefreshCredential('rc1.not-a-refresh'), null);
  assert.equal(
    pkceS256('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    'DwBzhbb51LfusnSGBa_hqYSgo7-j8BTQnip4TOnlzRo',
  );
});

test('Human signer emits RS256/kid and the exact no-role, no-scope profile', () => {
  const signed = signV1HumanAccessToken({
    userId: '10000000-0000-4000-8000-000000000001',
    clientId: 'human-web-svc-okr',
    audience: 'svc-okr',
  });
  const complete = jwt.decode(signed.token, { complete: true }) as any;
  assert.equal(complete.header.alg, 'RS256');
  assert.equal(complete.header.kid, 'v1-human-test-key');
  const claims = verifyV1HumanAccessToken(signed.token, 'svc-okr');
  assert.equal(claims.principal_type, 'user');
  assert.equal(claims.client_id, 'human-web-svc-okr');
  assert.equal(claims.exp - claims.iat, getV1ContractSettings().humanAccessTtlSeconds);
  for (const forbidden of ['scope', 'act', 'azp', 'agent_id', 'role', 'internalRole', 'okrRole']) {
    assert.equal(forbidden in claims, false);
  }
});

test('Human token expiry is Session-bounded and wrong audiences fail closed', () => {
  const now = Math.floor(Date.now() / 1000);
  const signed = signV1HumanAccessToken({
    userId: '10000000-0000-4000-8000-000000000001',
    clientId: 'human-web-svc-okr',
    audience: 'svc-okr',
    maximumExpiresAt: now + 120,
  });
  assert.ok(signed.claims.exp <= now + 120);
  assert.throws(() => verifyV1HumanAccessToken(signed.token, 'adc-v2'));
  assert.throws(() => signV1HumanAccessToken({
    userId: '10000000-0000-4000-8000-000000000001',
    clientId: 'human-web-svc-okr',
    audience: 'svc-workflow',
  }), /invalid Human audience/);
});
