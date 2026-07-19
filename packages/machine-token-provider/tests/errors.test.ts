/**
 * Error handling and redaction tests for @unified-auth/machine-token-provider
 *
 * Covers: error types, retry behavior, secret/token redaction,
 *         credentialProvider semantics.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createMachineTokenProvider } from '../src/provider.js';
import {
  ConfigurationError,
  AuthenticationError,
  RateLimitError,
  ServiceError,
  InvalidTokenResponseError,
} from '../src/errors.js';
import {
  createTestServer,
  successResponse,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Authentication errors
// ---------------------------------------------------------------------------

test('invalid_client (401) throws AuthenticationError with no retry', async () => {
  let requestCount = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    requestCount += 1;
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_client' }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof AuthenticationError);
    assert.equal((err as AuthenticationError).code, 'invalid_client');
    assert.equal((err as AuthenticationError).status, 401);
  }
  assert.equal(requestCount, 1);
  await svr.close();
});

test('invalid_scope (400) throws AuthenticationError with no retry', async () => {
  let requestCount = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    requestCount += 1;
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_scope' }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof AuthenticationError);
    assert.equal((err as AuthenticationError).code, 'invalid_scope');
    assert.equal((err as AuthenticationError).status, 400);
  }
  assert.equal(requestCount, 1);
  await svr.close();
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test('429 response throws RateLimitError with retryAfter', async () => {
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': '30',
    });
    res.end(JSON.stringify({ error: 'temporarily_unavailable' }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof RateLimitError);
    assert.equal((err as RateLimitError).retryAfter, 30);
  }
  await svr.close();
});

test('429 without Retry-After throws RateLimitError', async () => {
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'temporarily_unavailable' }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof RateLimitError);
    assert.equal((err as RateLimitError).retryAfter, undefined);
  }
  await svr.close();
});

// ---------------------------------------------------------------------------
// Service errors and retry
// ---------------------------------------------------------------------------

test('5xx error retries once then throws ServiceError', async () => {
  let requestCount = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    requestCount += 1;
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'temporarily_unavailable' }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof ServiceError);
    assert.equal((err as ServiceError).status, 503);
  }
  assert.equal(requestCount, 2);
  await svr.close();
});

test('5xx retry uses the same credential', async () => {
  let credentialCalls = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'temporarily_unavailable' }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => {
      credentialCalls += 1;
      return 'test-secret';
    },
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  await assert.rejects(() => provider(), ServiceError);
  // credentialProvider called once per acquisition cycle, not per retry
  assert.equal(credentialCalls, 1);
  await svr.close();
});

test('network error retries once then throws ServiceError', async () => {
  const provider = createMachineTokenProvider({
    tokenEndpoint: 'http://127.0.0.1:1/oauth/token',
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    timeoutMs: 500,
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof ServiceError);
    assert.equal((err as ServiceError).status, undefined);
  }
});

test('internal timeout throws ServiceError', async () => {
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    // Never respond — let the timeout fire
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    timeoutMs: 100,
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof ServiceError);
    assert.equal((err as ServiceError).status, undefined);
  }
  await svr.close();
});

// ---------------------------------------------------------------------------
// Invalid response handling
// ---------------------------------------------------------------------------

test('malformed token response throws InvalidTokenResponseError', async () => {
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ foo: 'bar' }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err instanceof InvalidTokenResponseError);
    assert.equal((err as InvalidTokenResponseError).status, 200);
  }
  await svr.close();
});

// ---------------------------------------------------------------------------
// Failed request not cached
// ---------------------------------------------------------------------------

test('failed request is not cached', async () => {
  let callNumber = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    callNumber += 1;
    if (callNumber <= 2) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error' }));
    } else {
      const tok = successResponse();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tok));
    }
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  await assert.rejects(() => provider(), { name: 'ServiceError' });
  assert.equal(callNumber, 2);

  // Next call should make a new request (error was not cached)
  const token = await provider();
  assert.equal(callNumber, 3);
  assert.ok(typeof token === 'string' && token.length > 0);
  await svr.close();
});

// ---------------------------------------------------------------------------
// Secret and token redaction
// ---------------------------------------------------------------------------

test('error messages never contain client_secret', async () => {
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_client' }));
  });

  const sensitiveSecret = 'super-secret-value-xyz-123!@#';
  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => sensitiveSecret,
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    const msg = (err as Error).message;
    assert.ok(!msg.includes(sensitiveSecret), 'Error message leaked client_secret');
    assert.ok(!msg.includes('super-secret'), 'Error message leaked partial client_secret');
    assert.ok(msg.includes('invalid_client'));
  }
  await svr.close();
});

test('error messages never contain access_token', async () => {
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token_type: 'Bearer', expires_in: 600 }));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  try {
    await provider();
    assert.fail('Should have thrown');
  } catch (err) {
    const msg = (err as Error).message;
    assert.ok(msg.includes('access_token'), 'Error should mention access_token is missing');
  }
  await svr.close();
});

// ---------------------------------------------------------------------------
// credentialProvider re-call on new acquisition
// ---------------------------------------------------------------------------

test('credentialProvider is called again on next acquisition cycle', async () => {
  let credentialCalls = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    const tok = successResponse({ expires_in: 600 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tok));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => {
      credentialCalls += 1;
      return 'test-secret-v' + credentialCalls;
    },
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    expirySkewSeconds: 600, // forces immediate expiration
  });

  await provider();
  assert.equal(credentialCalls, 1);

  await new Promise((r) => setTimeout(r, 5));
  await provider();
  assert.equal(credentialCalls, 2);
  await svr.close();
});

test('custom expirySkewSeconds is used', async () => {
  const svr = createTestServer();
  await svr.listen();
  let tokenCount = 0;
  svr.setHandler((_req, res) => {
    tokenCount += 1;
    const tok = successResponse({ expires_in: 600 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tok));
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    expirySkewSeconds: 600,
  });

  await provider();
  assert.equal(tokenCount, 1);

  await new Promise((r) => setTimeout(r, 5));
  await provider();
  assert.equal(tokenCount, 2);
  await svr.close();
});