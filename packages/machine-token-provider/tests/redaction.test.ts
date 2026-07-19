/**
 * Untrusted error sandboxing tests for @unified-auth/machine-token-provider
 *
 * Verifies that errors from external sources (credentialProvider, fetch)
 * never leak message content, cause, stack, Authorization headers,
 * client_secret, or access_token into public MachineTokenProvider errors.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createMachineTokenProvider } from '../src/provider.js';
import {
  ConfigurationError,
  ServiceError,
} from '../src/errors.js';

test('credentialProvider throw containing secret is sandboxed to ConfigurationError', async () => {
  const sensitive = 'my-super-secret-client-secret-xyz789';
  const provider = createMachineTokenProvider({
    tokenEndpoint: 'http://127.0.0.1:1/oauth/token',
    clientId: 'mc_testclient',
    credentialProvider: async () => {
      throw new Error(`Failed to load secret: ${sensitive}`);
    },
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    timeoutMs: 500,
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof ConfigurationError);
    const msg = (err as Error).message;
    assert.ok(
      !msg.includes(sensitive),
      'credentialProvider error leaked secret into ConfigurationError',
    );
    assert.ok(
      msg.includes('Machine credential could not be loaded'),
      `Expected safe message, got: ${msg}`,
    );
  }
});

test('custom fetch throw containing Authorization header is sandboxed to ServiceError', async () => {
  const authHeader = 'Basic ' + Buffer.from('client:secret').toString('base64');
  const provider = createMachineTokenProvider({
    tokenEndpoint: 'http://localhost/oauth/token',
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    fetch: async () => {
      throw new Error(`Fetch failed with Authorization: ${authHeader}`);
    },
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof ServiceError);
    const msg = (err as Error).message;
    assert.ok(!msg.includes(authHeader), 'fetch error leaked Authorization header');
    assert.ok(!msg.includes('Basic '), 'fetch error leaked Basic auth');
    assert.ok(
      msg.includes('Auth service request failed'),
      `Expected safe message, got: ${msg}`,
    );
  }
});

test('custom fetch throw containing access_token is sandboxed to ServiceError', async () => {
  const leakedToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature';
  const provider = createMachineTokenProvider({
    tokenEndpoint: 'http://localhost/oauth/token',
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    fetch: async () => {
      throw new Error(`Network error with token: ${leakedToken}`);
    },
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof ServiceError);
    const msg = (err as Error).message;
    assert.ok(!msg.includes(leakedToken), 'fetch error leaked access_token');
    assert.ok(!msg.includes('eyJ'), 'fetch error leaked JWT-like content');
    assert.ok(
      msg.includes('Auth service request failed'),
      `Expected safe message, got: ${msg}`,
    );
  }
});
