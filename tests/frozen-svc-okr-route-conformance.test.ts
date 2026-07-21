/**
 * svc-okr Frozen Route Conformance — Real HTTP POST /oauth/token
 *
 * Proves the frozen v1.2.0 Runtime Contract can issue svc-okr Agent tokens
 * through the full real Express route production pipeline:
 *
 *   Express
 *   → POST /oauth/token
 *   → Basic Auth parser
 *   → client_credentials
 *   → Frozen Runtime Contract 1.2.0 (svc-okr agent read/write)
 *   → authorizeV1DirectToken
 *   → RS256 signer
 *
 * The frozen runtime contract (generated/minimal-auth-v1/runtime-contract.json)
 * is loaded by initializeAuthContract('v1') — the same path the production
 * server uses.  The RS256 keyring is initialised with ephemeral test keys.
 * Database access is via a synthetic V1DirectDatabase adapter, recreated per
 * test so that each scenario starts with the exact grant/principal shape.
 *
 * MARK: REAL_EXPRESS_ROUTE_CONFORMANCE=true
 * MARK: REAL_AUTHORIZATION_FUNCTION_USED=true
 * MARK: FROZEN_RUNTIME_CONTRACT_USED=true
 * MARK: LIVE_PRODUCTION_DEPLOYMENT=false
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import express from 'express';

import { generateTestKeyPair, configureKeyringEnv } from './oauth/_workflow-test-keys.js';
import { resetWorkflowKeyringForTests } from '../src/lib/oauth/workflow-keyring.js';
import { createOAuthRouter } from '../src/routes/oauth.js';
import type { OAuthRouterDependencies } from '../src/routes/oauth.js';
import { issueV1DirectToken } from '../src/lib/oauth/v1/direct.js';
import type { V1DirectDatabase, V1DirectTokenParams } from '../src/lib/oauth/v1/direct.js';
import { hashClientSecret } from '../src/lib/oauth/secret.js';
import {
  initializeAuthContract,
  resetAuthContractForTests,
  getV1AudienceDefinitions,
} from '../src/lib/oauth/v1/contract.js';
import { initializeV1TokenIssuer } from '../src/lib/oauth/v1/signer.js';
import { OAuthHttpError } from '../src/utils/http-error.js';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const TEST_KEY = generateTestKeyPair('svc-okr-frozen-kid', 2048);
configureKeyringEnv({ activeKid: TEST_KEY.kid, activePrivateKeyPem: TEST_KEY.privateKeyPem });
process.env.JWT_ISSUER = 'auth-service';
process.env.AUTH_CONTRACT_MODE = 'v1';

// ---------------------------------------------------------------------------
// Stable test data — Principal, Client, secret
// ---------------------------------------------------------------------------

/** Stable test Principal UUID (used in positive token assertions). */
const TEST_PRINCIPAL_ID = '40000000-0000-4000-8000-000000000001';
const TEST_CLIENT_ID = 'svc-okr-frozen-conformance-client';
const TEST_CLIENT_SECRET = 'svc-okr-frozen-conformance-secret-v1';
const TEST_SECRET_HASH = hashClientSecret(TEST_CLIENT_SECRET);
const TEST_RESOURCE = 'svc-okr';
const TEST_AGENT_ID = 'svc-okr-frozen-conformance-agent';
const TEST_OWNER_USER_ID = '10000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------------------
// Synthetic database factory
// ---------------------------------------------------------------------------

interface StoredAudience extends Record<string, unknown> {
  audienceId: string;
  resourceService: string;
  scopeNamespace: string;
  acceptedPrincipalTypes: readonly string[];
  registeredScopes: readonly string[];
  humanAccessEnabled: boolean;
  machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean;
  status: string;
  freezeReady: boolean;
  version: number;
}

let cachedSvcOkrAudience: StoredAudience | null = null;

function getSvcOkrAudience(): StoredAudience {
  if (cachedSvcOkrAudience) return cachedSvcOkrAudience;
  const def = getV1AudienceDefinitions().find((d) => d.audienceId === TEST_RESOURCE);
  if (!def) throw new Error(`Audience ${TEST_RESOURCE} not found in frozen runtime definitions`);
  cachedSvcOkrAudience = { ...def, version: 1 } as unknown as StoredAudience;
  return cachedSvcOkrAudience;
}

function makeDatabase(overrides: {
  /** Principal type: 'agent' (default) or 'service'. */
  principalType?: 'agent' | 'service';
  /** Scopes to grant, or empty array for no grants. */
  scopes?: string[];
}): V1DirectDatabase {
  const pt = overrides.principalType ?? 'agent';
  const grantScopes = overrides.scopes ?? ['okr.read'];
  const storedAudience = getSvcOkrAudience();

  const principal = {
    id: TEST_PRINCIPAL_ID,
    principalType: pt as 'agent' | 'service',
    agentId: pt === 'agent' ? TEST_AGENT_ID : null,
    ownerUserId: pt === 'agent' ? TEST_OWNER_USER_ID : null,
    status: 'active' as const,
  };

  const accessGrants = grantScopes.length > 0
    ? [{
        audienceId: storedAudience.audienceId,
        scopes: grantScopes,
        version: 1,
        audience: storedAudience,
      }]
    : [];

  return {
    machineClient: {
      findUnique: async () => ({
        id: '30000000-0000-4000-8000-000000000001',
        clientId: TEST_CLIENT_ID,
        machinePrincipalId: TEST_PRINCIPAL_ID,
        secretHash: TEST_SECRET_HASH,
        status: 'active' as const,
        principal,
        accessGrants,
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Per-test Express server lifecycle
// ---------------------------------------------------------------------------

async function withServer<T>(
  database: V1DirectDatabase,
  fn: (url: string) => Promise<T>,
): Promise<T> {
  const deps: OAuthRouterDependencies = {
    issueV1DirectToken: (params: V1DirectTokenParams) => issueV1DirectToken(params, database),
  };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/oauth', createOAuthRouter(deps));

  // Minimal OAuth error handler
  app.use((err: Error, _req: any, res: any, _next: any) => {
    if (err instanceof OAuthHttpError) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'server_error' });
  });

  const server: http.Server = await new Promise((resolve, reject) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    srv.on('error', reject);
  });

  try {
    const addr = server.address() as import('net').AddressInfo;
    const url = `http://127.0.0.1:${addr.port}`;
    return await fn(url);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function rawTokenRequest(
  serverUrl: string,
  params: { clientId: string; clientSecret: string; resource: string; scope: string },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const basicAuth = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');
  const res = await fetch(`${serverUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource: params.resource,
      scope: params.scope,
    }).toString(),
  });
  const body = await res.json() as Record<string, unknown>;
  return { status: res.status, body };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  assert.equal(parts.length, 3, 'JWT should have 3 parts');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

test.before(() => {
  resetWorkflowKeyringForTests();
  resetAuthContractForTests();
  initializeAuthContract('v1');
  initializeV1TokenIssuer();
  // Warm the audience cache
  getSvcOkrAudience();
});

// ---------------------------------------------------------------------------
// Positive: svc-okr + okr.read + agent → 200, valid RS256 JWT
// ---------------------------------------------------------------------------

test('svc-okr frozen route: agent + okr.read issues RS256 JWT (HTTP 200)', async (t) => {
  const db = makeDatabase({ principalType: 'agent', scopes: ['okr.read'] });

  await withServer(db, async (serverUrl) => {
    const { status, body } = await rawTokenRequest(serverUrl, {
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      resource: 'svc-okr',
      scope: 'okr.read',
    });

    assert.equal(status, 200, 'HTTP status should be 200');

    // Verify JWT header
    const header = JSON.parse(
      Buffer.from((body.access_token as string).split('.')[0], 'base64url').toString('utf-8'),
    );
    assert.equal(header.alg, 'RS256');

    // Verify JWT payload fields
    const payload = decodeJwtPayload(body.access_token as string);
    assert.equal(payload.aud, 'svc-okr');
    assert.equal(payload.scope, 'okr.read');
    assert.equal(payload.principal_type, 'agent');
    assert.equal(payload.sub, TEST_PRINCIPAL_ID);
    assert.equal(payload.token_use, 'access');

    // PRODUCT_ROLES_IN_TOKEN=false: product_role claim must NOT be present
    assert.equal(
      payload.product_role,
      undefined,
      'product_role claim must not be present for svc-okr agent-read',
    );

    t.diagnostic(
      `svc-okr frozen: HTTP ${status} aud=${payload.aud} scope=${payload.scope} principal_type=${payload.principal_type}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Positive: svc-okr + okr.write + agent → 200, valid RS256 JWT
// ---------------------------------------------------------------------------

test('svc-okr frozen route: agent + okr.write issues RS256 JWT (HTTP 200)', async (t) => {
  const db = makeDatabase({ principalType: 'agent', scopes: ['okr.read', 'okr.write'] });

  await withServer(db, async (serverUrl) => {
    const { status, body } = await rawTokenRequest(serverUrl, {
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      resource: 'svc-okr',
      scope: 'okr.write',
    });

    assert.equal(status, 200, 'HTTP status should be 200');

    const payload = decodeJwtPayload(body.access_token as string);
    assert.equal(payload.aud, 'svc-okr');
    assert.equal(payload.scope, 'okr.write');
    assert.equal(payload.principal_type, 'agent');
    assert.equal(payload.sub, TEST_PRINCIPAL_ID);
    assert.equal(payload.product_role, undefined,
      'product_role claim must not be present for svc-okr agent-write');

    t.diagnostic(
      `svc-okr frozen: HTTP ${status} aud=${payload.aud} scope=${payload.scope} principal_type=${payload.principal_type}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Positive: svc-okr + okr.read okr.write + agent → 200, valid RS256 JWT
// ---------------------------------------------------------------------------

test('svc-okr frozen route: agent + okr.read okr.write issues RS256 JWT (HTTP 200)', async (t) => {
  const db = makeDatabase({ principalType: 'agent', scopes: ['okr.read', 'okr.write'] });

  await withServer(db, async (serverUrl) => {
    const { status, body } = await rawTokenRequest(serverUrl, {
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      resource: 'svc-okr',
      scope: 'okr.read okr.write',
    });

    assert.equal(status, 200, 'HTTP status should be 200');

    const payload = decodeJwtPayload(body.access_token as string);
    assert.equal(payload.aud, 'svc-okr');
    assert.equal(payload.scope, 'okr.read okr.write');
    assert.equal(payload.principal_type, 'agent');
    assert.equal(payload.product_role, undefined,
      'product_role claim must not be present');

    t.diagnostic(
      `svc-okr frozen: HTTP ${status} aud=${payload.aud} scope=${payload.scope} principal_type=${payload.principal_type}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Negative: svc-okr + okr.admin → rejected (unregistered scope)
// ---------------------------------------------------------------------------

test('svc-okr frozen route: okr.admin is rejected', async () => {
  const db = makeDatabase({ principalType: 'agent', scopes: ['okr.read'] });

  await withServer(db, async (serverUrl) => {
    const { status } = await rawTokenRequest(serverUrl, {
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      resource: 'svc-okr',
      scope: 'okr.admin',
    });
    assert.ok(status !== 200, 'okr.admin must not issue a token');
  });
});

// ---------------------------------------------------------------------------
// Negative: svc-okr + adc.read → rejected (wrong namespace)
// ---------------------------------------------------------------------------

test('svc-okr frozen route: adc.read (wrong namespace) is rejected', async () => {
  const db = makeDatabase({ principalType: 'agent', scopes: ['okr.read'] });

  await withServer(db, async (serverUrl) => {
    const { status } = await rawTokenRequest(serverUrl, {
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      resource: 'svc-okr',
      scope: 'adc.read',
    });
    assert.ok(status !== 200, 'adc.read (wrong namespace) must not issue a token for svc-okr');
  });
});

// ---------------------------------------------------------------------------
// Negative: svc-okr + no grant → rejected (invalid_scope)
// ---------------------------------------------------------------------------

test('svc-okr frozen route: no grant is rejected', async () => {
  const db = makeDatabase({ principalType: 'agent', scopes: [] });

  await withServer(db, async (serverUrl) => {
    const { status } = await rawTokenRequest(serverUrl, {
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      resource: 'svc-okr',
      scope: 'okr.read',
    });
    assert.ok(status !== 200, 'request without a grant must not issue a token');
  });
});

// ---------------------------------------------------------------------------
// Negative: service principal + svc-okr → rejected (profile not accepted)
// ---------------------------------------------------------------------------

test('svc-okr frozen route: service principal is rejected', async () => {
  const db = makeDatabase({ principalType: 'service', scopes: ['okr.read'] });

  await withServer(db, async (serverUrl) => {
    const { status } = await rawTokenRequest(serverUrl, {
      clientId: TEST_CLIENT_ID,
      clientSecret: TEST_CLIENT_SECRET,
      resource: 'svc-okr',
      scope: 'okr.read',
    });
    assert.ok(status !== 200, 'service principal must not get a token for svc-okr');
  });
});
