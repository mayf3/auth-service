/**
 * Shared test helpers for @unified-auth/machine-token-provider
 */

import http from 'node:http';
import type { MachineTokenProviderConfig } from '../src/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export type TestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function successResponse(
  overrides: Partial<TokenResponse> = {},
): TokenResponse {
  return {
    access_token: 'test-access-token-v1-' + randomHex(8),
    token_type: 'Bearer',
    expires_in: 600,
    scope: 'workflow.read',
    ...overrides,
  };
}

export function randomHex(bytes: number): string {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('');
}

/**
 * Create a minimal HTTP server that handles one token endpoint.
 * Must await `listen()` before using.
 */
export function createTestServer(): {
  server: http.Server;
  url: string;
  listen: () => Promise<void>;
  setHandler: (fn: TestHandler) => void;
  close: () => Promise<void>;
  requestCount: () => number;
} {
  let handler: TestHandler = () => {};
  let count = 0;
  const server = http.createServer((req, res) => {
    count += 1;
    handler(req, res);
  });

  const urlRef = { current: '' };

  return {
    server,
    get url() { return urlRef.current; },
    listen: () =>
      new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as import('net').AddressInfo;
          urlRef.current = `http://127.0.0.1:${addr.port}/oauth/token`;
          resolve();
        });
      }),
    setHandler: (fn: TestHandler) => {
      handler = fn;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
    requestCount: () => count,
  };
}

export function defaultHandler(tok?: string) {
  const token = tok ?? 'default-test-token';
  return (_req: http.IncomingMessage, res: http.ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 600,
        scope: 'workflow.read',
      }),
    );
  };
}

export function makeConfig(
  overrides: Partial<MachineTokenProviderConfig> & { url?: string } = {},
): MachineTokenProviderConfig {
  return {
    tokenEndpoint: overrides.url ?? 'http://localhost:1/oauth/token',
    clientId: 'mc_testclient',
    credentialProvider: async () => 'test-client-secret',
    resource: 'svc-workflow',
    scopes: ['workflow.read'],
    fetch: overrides.fetch ?? (() => Promise.reject(new Error('no fetch mock'))),
    ...overrides,
  };
}
