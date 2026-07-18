import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import jwt from 'jsonwebtoken';
import {
  initializeV1TokenIssuer,
  signV1DelegatedToken,
  signV1DirectMachineToken,
  verifyV1DelegatedToken,
  verifyV1DirectMachineToken,
} from '../../src/lib/oauth/v1/signer.js';
import { getV1ContractSettings } from '../../src/lib/oauth/v1/contract.js';
import {
  configureKeyringEnv,
  generateTestKeyPair,
  clearKeyringEnv,
} from './_workflow-test-keys.js';
import {
  getWorkflowKeyring,
  resetWorkflowKeyringForTests,
} from '../../src/lib/oauth/workflow-keyring.js';

const originalEnv = { ...process.env };

beforeEach(() => {
  const key = generateTestKeyPair('v1-direct-test-key');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  resetWorkflowKeyringForTests();
});

afterEach(() => {
  clearKeyringEnv();
  resetWorkflowKeyringForTests();
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

const params = {
  principalId: '20000000-0000-4000-8000-000000000001',
  principalType: 'agent' as const,
  agentId: 'v1-direct-agent',
  clientId: 'v1-direct-client',
  audience: 'svc-workflow',
  scope: 'workflow.execute workflow.read',
};

test('V1 Direct signer uses frozen issuer, TTL, RS256, kid, and V0 wire names', () => {
  initializeV1TokenIssuer();
  const signed = signV1DirectMachineToken(params);
  const complete = jwt.decode(signed.token, { complete: true }) as any;
  assert.equal(complete.header.alg, 'RS256');
  assert.equal(complete.header.kid, 'v1-direct-test-key');
  const claims = verifyV1DirectMachineToken(signed.token, 'svc-workflow');
  const settings = getV1ContractSettings();
  assert.equal(claims.iss, settings.exactIssuer);
  assert.equal(claims.exp - claims.iat, settings.machineAccessTtlSeconds);
  assert.equal(claims.client_id, params.clientId);
  assert.equal(claims.token_use, 'access');
  assert.equal(claims.nbf, claims.iat);
  assert.equal('act' in claims, false);
  assert.equal('azp' in claims, false);
});

test('V1 Direct signer generates unique jti and rejects first-wave Service issuance', () => {
  const first = signV1DirectMachineToken(params);
  const second = signV1DirectMachineToken(params);
  assert.notEqual(first.claims.jti, second.claims.jti);
  assert.throws(() => signV1DirectMachineToken({
    ...params,
    principalType: 'service',
    agentId: null,
  }), /not accepted/);
});

test('V1 Direct verifier rejects forbidden claims and audience arrays', () => {
  const signed = signV1DirectMachineToken(params);
  const { active } = getWorkflowKeyring();
  const privateKey = active.privateKey.export({ format: 'pem', type: 'pkcs8' });
  const withRole = jwt.sign({ ...signed.claims, role: 'admin' }, privateKey, {
    algorithm: 'RS256',
    keyid: active.kid,
  });
  assert.throws(() => verifyV1DirectMachineToken(withRole, 'svc-workflow'), /forbidden claim/);
  const arrayAudience = jwt.sign({ ...signed.claims, aud: ['svc-workflow'] }, privateKey, {
    algorithm: 'RS256',
    keyid: active.kid,
  });
  assert.throws(() => verifyV1DirectMachineToken(arrayAudience, 'svc-workflow'));
});

test('V1 Direct verifier rejects HS256 and unknown kid without fallback', () => {
  const signed = signV1DirectMachineToken(params);
  const { active } = getWorkflowKeyring();
  const forged = jwt.sign(signed.claims, active.jwk.n, {
    algorithm: 'HS256',
    header: { alg: 'HS256', kid: active.kid },
  });
  assert.throws(() => verifyV1DirectMachineToken(forged, 'svc-workflow'));
  const parts = signed.token.split('.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  header.kid = 'unknown';
  parts[0] = Buffer.from(JSON.stringify(header)).toString('base64url');
  assert.throws(() => verifyV1DirectMachineToken(parts.join('.'), 'svc-workflow'), /not recognized/);
});

test('V1 Delegated signer preserves OBO wire claims and source-bounded TTL', () => {
  const sourceExp = Math.floor(Date.now() / 1000) + 120;
  const signed = signV1DelegatedToken({
    originalPrincipalId: params.principalId,
    originalAgentId: params.agentId,
    proxyPrincipalId: '40000000-0000-4000-8000-000000000001',
    proxyClientId: 'adc-v2-proxy-client',
    audience: 'svc-workflow',
    scope: 'workflow.read',
    sourceExp,
  });
  const complete = jwt.decode(signed.token, { complete: true }) as any;
  assert.equal(complete.header.alg, 'RS256');
  assert.equal(complete.header.kid, 'v1-direct-test-key');
  const claims = verifyV1DelegatedToken(signed.token, 'svc-workflow');
  assert.equal(claims.sub, params.principalId);
  assert.equal(claims.token_use, 'workflow_obo');
  assert.equal(claims.azp, 'adc-v2-proxy-client');
  assert.equal(claims.client_id, claims.azp);
  assert.deepEqual(claims.act, { sub: '40000000-0000-4000-8000-000000000001' });
  assert.equal(claims.scope, 'workflow.read');
  assert.ok(claims.exp <= sourceExp);
  assert.ok(claims.exp - claims.iat <= 120);
  assert.equal('role' in claims, false);
});

test('V1 Delegated verifier rejects claim expansion, Client mismatch, and chaining confusion', () => {
  const signed = signV1DelegatedToken({
    originalPrincipalId: params.principalId,
    originalAgentId: params.agentId,
    proxyPrincipalId: '40000000-0000-4000-8000-000000000001',
    proxyClientId: 'adc-v2-proxy-client',
    audience: 'svc-workflow',
    scope: 'workflow.read',
    sourceExp: Math.floor(Date.now() / 1000) + 600,
  });
  const { active } = getWorkflowKeyring();
  const privateKey = active.privateKey.export({ format: 'pem', type: 'pkcs8' });
  for (const claims of [
    { ...signed.claims, role: 'admin' },
    { ...signed.claims, client_id: 'different-client' },
    { ...signed.claims, act: { sub: signed.claims.act.sub, nested: true } },
  ]) {
    const forged = jwt.sign(claims, privateKey, { algorithm: 'RS256', keyid: active.kid });
    assert.throws(() => verifyV1DelegatedToken(forged, 'svc-workflow'));
  }
  assert.throws(() => verifyV1DirectMachineToken(signed.token, 'svc-workflow'));
});
