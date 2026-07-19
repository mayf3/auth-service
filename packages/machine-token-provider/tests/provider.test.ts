/**
 * Core functionality tests for @unified-auth/machine-token-provider
 *
 * Covers: config validation, token acquisition, caching, singleflight.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createMachineTokenProvider } from '../src/provider.js';
import { ConfigurationError } from '../src/errors.js';
import type { MachineTokenProvider, MachineTokenProviderConfig } from '../src/types.js';
import {
  createTestServer,
  defaultHandler,
  successResponse,
  makeConfig,
  randomHex,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Type-level compatibility: compile-time only
// ---------------------------------------------------------------------------

// Verify that MachineTokenProvider is structurally compatible with
// the Workflow SDK's AccessTokenProvider = () => string | Promise<string>
type _WorkflowSDK_AccessTokenProvider = () => string | Promise<string>;
const _typeCheck: _WorkflowSDK_AccessTokenProvider = null as unknown as MachineTokenProvider;
void _typeCheck; // suppress unused

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

test('createMachineTokenProvider validates config eagerly', () => {
  assert.throws(() => createMachineTokenProvider({} as MachineTokenProviderConfig), ConfigurationError);
  assert.throws(
    () => createMachineTokenProvider(makeConfig({ tokenEndpoint: '' })),
    ConfigurationError,
  );
  assert.throws(
    () => createMachineTokenProvider(makeConfig({ clientId: '' })),
    ConfigurationError,
  );
  assert.throws(
    () => createMachineTokenProvider(makeConfig({ credentialProvider: 'not-a-function' as unknown as () => Promise<string> })),
    ConfigurationError,
  );
  assert.throws(
    () => createMachineTokenProvider(makeConfig({ resource: '' })),
    ConfigurationError,
  );
  assert.throws(
    () => createMachineTokenProvider(makeConfig({ scopes: [] })),
    ConfigurationError,
  );
});

test('createMachineTokenProvider validates scope grammar', () => {
  assert.throws(
    () => createMachineTokenProvider(makeConfig({ scopes: ['invalid-scope-format'] })),
    ConfigurationError,
  );
  assert.throws(
    () => createMachineTokenProvider(makeConfig({ scopes: ['UPPERCASE.scope'] })),
    ConfigurationError,
  );
  // Valid scopes should not throw
  const provider = createMachineTokenProvider(makeConfig({
    scopes: ['workflow.read', 'workflow.execute'],
    fetch: async () => new Response(null, { status: 200, statusText: 'OK' }),
  }));
  assert.equal(typeof provider, 'function');
});

// ---------------------------------------------------------------------------
// Token acquisition
// ---------------------------------------------------------------------------

test('successful token acquisition returns the access token', async () => {
  const svr = createTestServer();
  await svr.listen();
  const expectedToken = 'real-test-token-' + randomHex(8);
  svr.setHandler(defaultHandler(expectedToken));

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  const token = await provider();
  assert.equal(token, expectedToken);
  await svr.close();
});

test('resource parameter is sent in POST body', async () => {
  let receivedBody = '';
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      receivedBody = body;
      const tok = successResponse();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tok));
    });
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-okr',
    scopes: ['okr.read'],
  });

  await provider();
  assert.ok(receivedBody.includes('resource=svc-okr'));
  assert.ok(receivedBody.includes('grant_type=client_credentials'));
  await svr.close();
});

test('scopes are deduplicated and ASCII-byte sorted', async () => {
  let receivedBody = '';
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      receivedBody = body;
      const tok = successResponse();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tok));
    });
  });

  const provider = createMachineTokenProvider({
    tokenEndpoint: svr.url,
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.execute', 'workflow.read', 'workflow.read', 'workflow.execute'],
  });

  await provider();
  const scopeVal = new URLSearchParams(receivedBody).get('scope');
  // Sorted: "workflow.execute" < "workflow.read" in ASCII
  assert.equal(scopeVal, 'workflow.execute workflow.read');
  await svr.close();
});

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

test('cache hit returns cached token without HTTP request', async () => {
  let requestCount = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    requestCount += 1;
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
  });

  const token1 = await provider();
  assert.equal(requestCount, 1);
  const token2 = await provider();
  assert.equal(requestCount, 1); // no new request
  assert.equal(token2, token1);
  await svr.close();
});

test('singleflight: 20 concurrent calls only make 1 HTTP request', async () => {
  let requestCount = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    requestCount += 1;
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
  });

  const results = await Promise.all(
    Array.from({ length: 20 }, () => provider()),
  );

  assert.equal(requestCount, 1);
  assert.equal(results.length, 20);
  const first = results[0];
  for (const r of results) {
    assert.equal(r, first);
  }
  await svr.close();
});

test('expired token triggers re-fetch', async () => {
  let requestCount = 0;
  const svr = createTestServer();
  await svr.listen();
  svr.setHandler((_req, res) => {
    requestCount += 1;
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
    expirySkewSeconds: 600, // matches expires_in — usableUntil ≈ now
  });

  const token1 = await provider();
  assert.equal(requestCount, 1);
  await new Promise((r) => setTimeout(r, 5));
  const token2 = await provider();
  assert.equal(requestCount, 2);
  assert.notEqual(token2, token1);
  await svr.close();
});

test('credentialProvider is called once per acquisition cycle', async () => {
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
      return 'test-secret';
    },
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
  });

  await provider();
  assert.equal(credentialCalls, 1);
  await svr.close();
});

test('custom fetch is used', async () => {
  let called = false;
  const customFetch: typeof fetch = async (_url, _opts) => {
    called = true;
    return new Response(
      JSON.stringify(successResponse()),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const provider = createMachineTokenProvider({
    tokenEndpoint: 'http://custom-fetch-test/token',
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    fetch: customFetch,
  });

  const token = await provider();
  assert.ok(called);
  assert.ok(typeof token === 'string' && token.length > 0);
});
