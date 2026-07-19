/**
 * Machine Token Provider — V1 Token Issuance Conformance Test
 *
 * Tests the provider through the real auth-service token issuance code paths:
 *   - Real V1DirectToken authorization (authorizeV1DirectToken)
 *   - Real RS256 signing (signV1DirectMachineToken)
 *   - Real client_secret verification (verifyClientSecret)
 *   - Provider → custom fetch adapter → issueV1DirectToken
 *
 * Uses a synthetic V1DirectDatabase adapter (test data, not production).
 * Does NOT start an HTTP server — the core business logic and signing
 * are validated directly through the real module functions.
 *
 * See provider-route-conformance.test.ts for the full HTTP route test.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Import real auth-service modules
// ---------------------------------------------------------------------------

import { issueV1DirectToken, authorizeV1DirectToken } from '../src/lib/oauth/v1/direct.js';
import type { V1DirectDatabase, V1DirectTokenParams } from '../src/lib/oauth/v1/direct.js';
import { hashClientSecret, verifyClientSecret } from '../src/lib/oauth/secret.js';
import { getV1AudienceDefinitions } from '../src/lib/oauth/v1/contract.js';

// ---------------------------------------------------------------------------
// Synthetic test data
// ---------------------------------------------------------------------------

const TEST_PRINCIPAL_ID = '20000000-0000-4000-8000-000000000001';
const TEST_CLIENT_ID = 'v1-conformance-test-client';
const TEST_CLIENT_SECRET = 'test-conformance-secret-value';
const TEST_SECRET_HASH = hashClientSecret(TEST_CLIENT_SECRET);
const TEST_RESOURCE = 'svc-workflow';
const TEST_AGENT_ID = 'conformance-agent';
const TEST_OWNER_USER_ID = '10000000-0000-4000-8000-000000000001';

/** Runtime audience definition with `version` added for stored grant match. */
interface StoredAudience extends ReturnType<typeof getV1AudienceDefinitions>[number] {
  version: number;
}

function matchRuntimeAudience(audienceId: string): StoredAudience {
  const def = getV1AudienceDefinitions().find((d) => d.audienceId === audienceId);
  if (!def) throw new Error(`Audience ${audienceId} not found in runtime definitions`);
  return { ...def, version: 1 };
}

function createTestDatabase(overrides: Record<string, unknown> = {}): V1DirectDatabase {
  const audience = matchRuntimeAudience(TEST_RESOURCE);
  return {
    machineClient: {
      findUnique: async () => ({
        id: '30000000-0000-4000-8000-000000000001',
        clientId: TEST_CLIENT_ID,
        machinePrincipalId: TEST_PRINCIPAL_ID,
        secretHash: TEST_SECRET_HASH,
        status: 'active' as const,
        principal: {
          id: TEST_PRINCIPAL_ID,
          principalType: 'agent' as const,
          agentId: TEST_AGENT_ID,
          ownerUserId: TEST_OWNER_USER_ID,
          status: 'active' as const,
        },
        accessGrants: [{
          audienceId: audience.audienceId,
          scopes: ['workflow.read', 'workflow.execute'],
          version: 1,
          audience,
        }],
        ...overrides,
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Provider package import (pre-built or source)
// ---------------------------------------------------------------------------

import { createMachineTokenProvider } from '../packages/machine-token-provider/src/provider.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Provider conformance: successful RS256 token via real issueV1DirectToken', async () => {
  const db = createTestDatabase();
  const params: V1DirectTokenParams = {
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scope: 'workflow.read',
  };

  const result = await issueV1DirectToken(params, db);

  // Verify the token is a real JWT
  assert.ok(result.access_token, 'access_token should be present');
  assert.equal(result.token_type, 'Bearer');
  assert.ok(result.expires_in > 0, 'expires_in should be positive');
  assert.equal(result.scope, 'workflow.read');
  assert.ok(result.jti, 'jti should be present');

  // Decode and verify JWT header
  const parts = result.access_token.split('.');
  assert.equal(parts.length, 3, 'JWT should have 3 parts');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
  assert.equal(header.alg, 'RS256');
  assert.ok(header.kid, 'kid should be present');
  assert.equal(header.typ, 'JWT');
});

test('Provider conformance: JWT aud matches resource', async () => {
  const db = createTestDatabase();
  const params: V1DirectTokenParams = {
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scope: 'workflow.read',
  };

  const result = await issueV1DirectToken(params, db);
  const payload = JSON.parse(
    Buffer.from(result.access_token.split('.')[1], 'base64url').toString('utf-8'),
  );
  assert.equal(payload.aud, TEST_RESOURCE);
});

test('Provider conformance: JWT sub matches principal id', async () => {
  const db = createTestDatabase();
  const params: V1DirectTokenParams = {
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scope: 'workflow.read',
  };

  const result = await issueV1DirectToken(params, db);
  const payload = JSON.parse(
    Buffer.from(result.access_token.split('.')[1], 'base64url').toString('utf-8'),
  );
  assert.equal(payload.sub, TEST_PRINCIPAL_ID);
});

test('Provider conformance: JWT scope correct', async () => {
  const db = createTestDatabase();
  const params: V1DirectTokenParams = {
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scope: 'workflow.read workflow.execute',
  };

  const result = await issueV1DirectToken(params, db);
  const payload = JSON.parse(
    Buffer.from(result.access_token.split('.')[1], 'base64url').toString('utf-8'),
  );
  const scopes = (payload.scope as string).split(' ');
  assert.ok(scopes.includes('workflow.read'));
  assert.ok(scopes.includes('workflow.execute'));
});

test('Provider conformance: invalid client secret is rejected by real authorize', async () => {
  const db = createTestDatabase();
  const params: V1DirectTokenParams = {
    clientId: TEST_CLIENT_ID,
    clientSecret: 'wrong-secret',
    resource: TEST_RESOURCE,
    scope: 'workflow.read',
  };

  await assert.rejects(
    () => authorizeV1DirectToken(params, db),
    { name: 'V1OAuthError' },
  );
});

test('Provider conformance: invalid scope is rejected', async () => {
  const db = createTestDatabase();
  const params: V1DirectTokenParams = {
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scope: 'nonexistent.scope',
  };

  await assert.rejects(
    () => authorizeV1DirectToken(params, db),
    { name: 'V1OAuthError' },
  );
});

test('Provider conformance: verifyClientSecret works correctly', () => {
  const hash = hashClientSecret(TEST_CLIENT_SECRET);
  assert.ok(verifyClientSecret(TEST_CLIENT_SECRET, hash));
  assert.ok(!verifyClientSecret('wrong-secret', hash));
});

test('Provider conformance: createMachineTokenProvider compatible with issueV1DirectToken', async () => {
  // This test validates the full chain through a custom fetch that
  // intercepts the HTTP request and routes it to issueV1DirectToken.

  const db = createTestDatabase();

  const provider = createMachineTokenProvider({
    tokenEndpoint: 'http://conformance-test/oauth/token',
    clientId: TEST_CLIENT_ID,
    credentialProvider: async () => TEST_CLIENT_SECRET,
    resource: TEST_RESOURCE,
    scopes: ['workflow.read'],
    timeoutMs: 5000,
    fetch: async (url, opts) => {
      // Verify the provider constructs the right request
      const body = opts.body as string;
      assert.ok(body.includes(`resource=${TEST_RESOURCE}`), `body should include resource, got: ${body}`);
      assert.ok(body.includes('grant_type=client_credentials'), `body should include grant_type, got: ${body}`);
      assert.ok(body.includes('scope=workflow.read'), `body should include scope, got: ${body}`);

      // Verify Basic auth
      const auth = opts.headers?.['Authorization'] as string;
      assert.ok(auth, 'Authorization header should be present');
      assert.ok(auth.startsWith('Basic '), 'Authorization should be Basic');

      // Verify Content-Type
      assert.equal(opts.headers?.['Content-Type'], 'application/x-www-form-urlencoded');

      // Process through the real authorization flow
      const params: V1DirectTokenParams = {
        clientId: TEST_CLIENT_ID,
        clientSecret: TEST_CLIENT_SECRET,
        resource: TEST_RESOURCE,
        scope: 'workflow.read',
      };

      const result = await issueV1DirectToken(params, db);
      return new Response(JSON.stringify({
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        scope: result.scope,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const token = await provider();
  assert.ok(typeof token === 'string' && token.length > 0, 'token should be a non-empty string');

  // Verify it's a real RS256 JWT
  const parts = token.split('.');
  assert.equal(parts.length, 3, 'token should be a JWT');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
  assert.equal(header.alg, 'RS256', 'JWT should be signed with RS256');
});
