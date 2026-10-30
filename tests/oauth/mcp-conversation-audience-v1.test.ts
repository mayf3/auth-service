import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getV1AudienceDefinitions,
  getV1ContractSettings,
  initializeAuthContract,
  resetAuthContractForTests,
  verifyRuntimeSnapshot,
} from '../../src/lib/oauth/v1/contract.js';

const bundleRoot = resolve(process.cwd(), 'contract-bundles', 'minimal-auth-v1');
const resource = 'agent-core-mcp-conversation-v1';
const scope = 'conversation.access';
const exactAudience = {
  audience_id: resource,
  resource_service: resource,
  scope_namespace: 'conversation',
  accepted_principal_types: ['service'],
  human_access_enabled: false,
  machine_access_enabled: true,
  delegated_access_enabled: false,
  registered_scopes: [scope],
  status: 'active',
  freeze_ready: true,
  notes: 'Registered by AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1 for one dedicated MCP SERVICE caller to the original DSH native conversation facade; no Human, Agent or delegated access.',
};

function readBundle(relative: string): any {
  return JSON.parse(readFileSync(resolve(bundleRoot, relative), 'utf8'));
}

test('MCP SERVICE audience and all thirteen base projections survive website composition', () => {
  const registry = readBundle('audience-registry.json');
  assert.deepEqual(registry.audiences[12], exactAudience);
  assert.equal(registry.audiences.length, 15);
  // SHA256 of JSON.stringify(Base 6cf2663 registry.audiences): complete entries and order.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(registry.audiences.slice(0, 12))).digest('hex'),
    '2c016106e6d5b01475132efc9baa9a4af57ce2f484440f8ef3190827d5d1510a');
  // Preserve the complete 1.14.0 base, including the exact MCP entry.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(registry.audiences.slice(0, 13))).digest('hex'),
    '67a79cd4a65b5148d4305708c1f3820a841b974ccf65219cea63d779cbb90e6a');
  assert.equal(registry.registry_version, '1.14.0');
  assert.equal(readBundle('contract-manifest.json').contract_version, '1.14.0');
  assert.equal(readBundle('contract-manifest.json').audience_registry_version, '1.14.0');
  assert.equal(readBundle('schemas/contract-manifest.schema.json').properties.contract_version.const, '1.14.0');
});

test('MCP signed fixture proves the SERVICE profile and opaque exact scope with fail-closed negatives', () => {
  const positive = readBundle('fixtures/positive-token-fixtures.json');
  const fixture = positive.fixtures.find((entry: any) => entry.name === 'direct-service-mcp-conversation');
  const decoded = jwt.decode(fixture.compact_jwt, { complete: true }) as any;
  const jwk = readBundle('fixtures/jwks.json').keys.find((entry: any) => entry.kid === decoded.header.kid);
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ format: 'pem', type: 'spki' });
  const claims = jwt.verify(fixture.compact_jwt, publicKey, {
    algorithms: ['RS256'], issuer: 'auth-service', audience: resource, clockTimestamp: positive.now,
  }) as any;
  assert.deepEqual(claims, fixture.claims);
  assert.equal(claims.principal_type, 'service');
  assert.equal(claims.scope, scope);
  assert.equal(claims.token_use, 'access');
  for (const field of ['agent_id', 'owner_user_id', 'act', 'azp', 'refresh_token']) assert.equal(field in claims, false);
  assert.deepEqual(fixture.authorization_context, {
    requested_scope: scope, machine_access_grants: { [resource]: [scope] },
  });
  const negatives = readBundle('fixtures/negative-token-fixtures.json').cases;
  for (const suffix of ['wrong-audience', 'missing-grant', 'agent-profile', 'human-profile',
    'delegated-profile', 'forbidden-agent-id', 'partial-scope-output',
    'notification-grant-reuse', 'workflow-grant-reuse', ...Array.from({ length: 10 }, (_, i) => `scope-${i}`)]) {
    assert.ok(negatives.some((entry: any) => entry.name === `mcp-conversation-${suffix}`), suffix);
  }
});

test('actual generated loader accepts only the frozen source version, digest and authorization', () => {
  resetAuthContractForTests();
  const identity = initializeAuthContract('v1');
  assert.equal(identity.contractVersion, '1.14.0');
  const snapshot = JSON.parse(readFileSync(resolve('generated/minimal-auth-v1/runtime-contract.json'), 'utf8'));
  assert.equal(verifyRuntimeSnapshot(snapshot).reviewedSourceGitCommit,
    readBundle('contract-manifest.json').lifecycle.contract_bundle_freeze.reviewed_source_git_commit);
  const tampered = structuredClone(snapshot);
  tampered.payload.audienceRegistry.audiences.pop();
  assert.throws(() => verifyRuntimeSnapshot(tampered), /digest mismatch/);
  for (const mutation of [
    (value: any) => { value.payload.contractVersion = '1.13.0'; },
    (value: any) => { value.payload.manifest.lifecycle.contract_bundle_freeze.status = 'draft'; },
    (value: any) => { value.payload.manifest.lifecycle.contract_bundle_freeze.frozen = false; },
    (value: any) => { value.payload.manifest.lifecycle.contract_bundle_freeze.implementation_authorized = false; },
  ]) {
    const value = structuredClone(snapshot);
    mutation(value);
    value.runtimeDigest = crypto.createHash('sha256').update(JSON.stringify(value.payload)).digest('hex');
    assert.throws(() => verifyRuntimeSnapshot(value), /unsupported|not frozen/);
  }
});

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

test('real disposable PostgreSQL, generic SERVICE issuer and loopback HTTP preserve all authorization guards',
  { timeout: 120_000 }, async (t) => {
  // Never use ambient database coordinates, credentials, keys or an existing server.
  initializeAuthContract('v1');
  const root = mkdtempSync('/tmp/auth-mcc-isolated-');
  const port = await availablePort();
  const url = `postgresql://mcc_isolated@127.0.0.1:${port}/mcc_isolated?connection_limit=4`;
  const originalEnv = { ...process.env };
  let started = false;
  let database: PrismaClient | undefined;
  let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
  let resetKeyring: (() => void) | undefined;
  const auditLines: string[] = [];
  const originalWarn = console.warn;
  const clientId = 'mcc-isolated-service-client';
  const principalId = 'a0000000-0000-4000-8000-000000000002';
  const secret = crypto.randomBytes(32).toString('base64url');
  let secretHash = '';
  try {
    execFileSync('initdb', ['-D', join(root, 'data'), '-U', 'mcc_isolated', '-A', 'trust', '--no-locale'], { stdio: 'pipe' });
    execFileSync('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'postgres.log'),
      '-o', `-p ${port} -h 127.0.0.1 -k ${root}`, '-w', 'start'], { stdio: 'pipe' });
    started = true;
    execFileSync('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'mcc_isolated', 'mcc_isolated'], { stdio: 'pipe' });
    execFileSync(resolve('node_modules/.bin/prisma'), ['db', 'push', '--skip-generate', '--schema', 'prisma/schema.prisma'], {
      stdio: 'pipe', env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url },
    });
    process.env.DATABASE_URL = url;
    process.env.AUTH_CONTRACT_MODE = 'v1';
    process.env.JWT_ISSUER = 'auth-service';
    process.env.JWT_SECRET = 'mcc-isolated-test-only-hs256-unusable';
    process.env.RATE_LIMIT_LOGIN_MAX_FAILS = '1000';
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.JWT_KID = 'mcc-isolated-key';
    process.env.JWT_PRIVATE_KEY = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    process.env.JWT_PRIVATE_KEY_FILE = '';
    process.env.JWT_PREVIOUS_PUBLIC_KEYS = '';
    const direct = await import('../../src/lib/oauth/v1/direct.js');
    const signer = await import('../../src/lib/oauth/v1/signer.js');
    const keys = await import('../../src/lib/oauth/workflow-keyring.js');
    resetKeyring = keys.resetWorkflowKeyringForTests;
    resetKeyring();
    signer.initializeV1TokenIssuer();
    const { hashClientSecret } = await import('../../src/lib/oauth/secret.js');
    const { env } = await import('../../src/config/env.js');
    assert.equal(env.AUTH_CONTRACT_MODE, 'v1');
    secretHash = hashClientSecret(secret);
    database = new PrismaClient({ datasources: { db: { url } } });
    const db = database;
    const coordinates = await db.$queryRaw<Array<{ database: string; owner: string; address: string; port: number; version: string }>>`
      SELECT current_database() AS database, current_user AS owner,
        inet_server_addr()::text AS address, inet_server_port() AS port, version() AS version`;
    assert.equal(coordinates[0].database, 'mcc_isolated');
    assert.equal(coordinates[0].owner, 'mcc_isolated');
    assert.equal(coordinates[0].address, '127.0.0.1/32');
    assert.equal(coordinates[0].port, port);
    t.diagnostic(JSON.stringify({ clusterRoot: root, database: coordinates[0], runtime: initializeAuthContract('v1') }));
    const runtimeAudience = getV1AudienceDefinitions().find((entry) => entry.audienceId === resource)!;
    assert.ok(runtimeAudience, 'actual generated runtime must register the resource');
    const audienceData = { ...runtimeAudience, acceptedPrincipalTypes: [...runtimeAudience.acceptedPrincipalTypes],
      registeredScopes: [...runtimeAudience.registeredScopes], version: 1 };
    await db.authAudience.create({ data: audienceData });
    await db.machinePrincipal.create({ data: { id: principalId, principalType: 'service', agentId: null } });
    const client = await db.machineClient.create({ data: {
      clientId, machinePrincipalId: principalId, secretHash, allowedResources: [], allowedScopes: [],
    } });
    const grantKey = { machineClientId_audienceId: { machineClientId: client.id, audienceId: resource } };
    const grantData = { machineClientId: client.id, audienceId: resource, scopes: [scope], version: 1 };
    await db.machineAccessGrant.create({ data: grantData });
    const request = { clientId, clientSecret: secret, resource, scope };
    const dbAdapter = db as unknown as Parameters<typeof direct.authorizeV1DirectToken>[1];
    console.warn = (...args: unknown[]) => { auditLines.push(args.map(String).join(' ')); };

    await t.test('real issuer signs the unchanged exact SERVICE profile with RS256, TTL and distinct jti', async () => {
      assert.deepEqual(await direct.authorizeV1DirectToken(request, dbAdapter), {
        principalId, principalType: 'service', agentId: null, clientId, audience: resource, scope,
      });
      const result = await direct.issueV1DirectToken(request, dbAdapter);
      const second = await direct.issueV1DirectToken(request, dbAdapter);
      const claims = signer.verifyV1DirectMachineToken(result.access_token, resource);
      assert.deepEqual(Object.keys(claims).sort(), ['iss', 'sub', 'aud', 'principal_type', 'client_id',
        'token_use', 'type', 'version', 'scope', 'jti', 'iat', 'nbf', 'exp'].sort());
      assert.equal(claims.sub, principalId);
      assert.equal(claims.principal_type, 'service');
      assert.equal(claims.client_id, clientId);
      assert.equal(claims.scope, scope);
      assert.equal(claims.iss, 'auth-service');
      assert.equal(claims.aud, resource);
      assert.equal(claims.version, 'v1');
      assert.equal(claims.token_use, 'access');
      assert.equal(claims.type, 'access');
      assert.equal(claims.exp - claims.iat, 600);
      assert.equal(claims.nbf, claims.iat);
      assert.equal(result.expires_in, getV1ContractSettings().machineAccessTtlSeconds);
      assert.equal(result.token_type, 'Bearer');
      assert.notEqual(result.jti, second.jti);
      const header = (jwt.decode(result.access_token, { complete: true }) as any).header;
      assert.equal(header.alg, 'RS256');
      assert.equal(header.kid, 'mcc-isolated-key');
      for (const forbidden of ['agent_id', 'owner_user_id', 'act', 'azp', 'refresh_token']) {
        assert.equal(forbidden in claims || forbidden in result, false);
      }
    });

    async function rejects(params: Partial<typeof request>, code: string, status: number, category?: string) {
      await assert.rejects(direct.authorizeV1DirectToken({ ...request, ...params }, dbAdapter), (error: any) => {
        assert.equal(error.message, code);
        assert.equal(error.statusCode, status);
        if (category) assert.equal(error.category, category);
        return true;
      });
    }
    await t.test('missing, revoked or disabled clients and principals plus bad credentials fail closed', async () => {
      await rejects({ clientId: 'mcc-missing' }, 'invalid_client', 401);
      await rejects({ clientSecret: 'mcc-wrong-secret' }, 'invalid_client', 401, 'credential_invalid');
      await db.machineClient.update({ where: { id: client.id }, data: { status: 'revoked' } });
      await rejects({}, 'invalid_client', 401);
      await db.machineClient.update({ where: { id: client.id }, data: { status: 'active' } });
      await db.machinePrincipal.update({ where: { id: principalId }, data: { status: 'disabled' } });
      await rejects({}, 'invalid_client', 401);
      await db.machinePrincipal.update({ where: { id: principalId }, data: { status: 'active' } });
    });
    await t.test('Agent, Human and delegated profiles cannot authenticate for MCP SERVICE access', async () => {
      await db.machinePrincipal.update({ where: { id: principalId }, data: { principalType: 'agent', agentId: 'mcc-isolated-agent' } });
      await rejects({}, 'invalid_target', 400, 'audience_profile_not_accepted');
      await db.machinePrincipal.update({ where: { id: principalId }, data: { principalType: 'service', agentId: 'mcc-isolated-agent' } });
      await rejects({}, 'invalid_client', 401, 'service_profile_invalid');
      await db.machinePrincipal.update({ where: { id: principalId }, data: { agentId: null } });
      await db.humanClient.create({ data: { clientId: 'mcc-human', clientType: 'confidential_web', clientAuthenticationMethod: 'client_secret_basic', credentialVerifier: secretHash } });
      await rejects({ clientId: 'mcc-human' }, 'invalid_client', 401);
      assert.throws(() => signer.signV1HumanAccessToken({ userId: principalId, clientId: 'mcc-human', audience: resource }), /invalid Human audience/);
      assert.throws(() => signer.signV1DelegatedToken({ originalPrincipalId: principalId, originalAgentId: 'mcc-isolated-agent',
        proxyPrincipalId: crypto.randomUUID(), proxyClientId: clientId, audience: resource, scope,
        sourceExp: Math.floor(Date.now() / 1000) + 300 }), /invalid target audience/);
    });
    await t.test('absent, revoked, empty, duplicate and unregistered grants never yield partial success', async () => {
      await db.machineAccessGrant.delete({ where: grantKey });
      await rejects({}, 'invalid_scope', 400, 'machine_grant_missing');
      await db.machineAccessGrant.create({ data: grantData });
      for (const data of [{ version: 0 }, { scopes: [] }, { scopes: [scope, scope] }, { scopes: ['conversation.read'] }]) {
        await db.machineAccessGrant.update({ where: grantKey, data });
        await rejects({}, 'temporarily_unavailable', 503, 'machine_grant_state_invalid');
        await db.machineAccessGrant.update({ where: grantKey, data: { version: 1, scopes: [scope] } });
      }
    });
    await t.test('wildcard, prefix, alias, extra, duplicate, mixed and malformed scope sets are rejected intact', async () => {
      for (const requested of ['conversation.*', '*', 'conversation', 'conversation_access', 'conversation.read',
        'conversation.access.extra', scope + ' ' + scope, scope + ' conversation.read',
        scope + ' workflow.read', scope + ' ', ' ' + scope, scope + '\t', '']) {
        await rejects({ scope: requested }, 'invalid_scope', 400);
      }
      await rejects({ resource: 'cross-mcp-conversation' }, 'invalid_target', 400);
      await rejects({ resource: 'svc-workflow', scope: 'workflow.read' }, 'invalid_target', 400);
    });
    await t.test('real foreign Audience Grants and legacy arrays cannot substitute for an MCP grant', async () => {
      const websiteFixture = {
        audienceId: 'agent-core-website-transport-v1', resourceService: 'agent-core-website-transport-v1',
        scopeNamespace: 'conversation', acceptedPrincipalTypes: ['service'],
        registeredScopes: ['conversation.intent.redeem', 'conversation.own_events.read', 'conversation.own_result.read'],
        humanAccessEnabled: false, machineAccessEnabled: true, delegatedAccessEnabled: false,
        status: 'active' as const, freezeReady: true,
      };
      // Website is an accepted reservation, absent from this source/runtime. This is
      // only a disposable foreign DB fixture, never a source registration or activation.
      for (const [name, audience, grantedScope, type] of [
        ['notification', getV1AudienceDefinitions().find(entry => entry.audienceId === 'agent-core-notification-ingress-v1')!, 'notification.deliver', 'service'],
        ['website', websiteFixture, 'conversation.own_result.read', 'service'],
        ['workflow', getV1AudienceDefinitions().find(entry => entry.audienceId === 'svc-workflow')!, 'workflow.read', 'agent'],
      ] as const) {
        await db.authAudience.create({ data: { ...audience, acceptedPrincipalTypes: [...audience.acceptedPrincipalTypes],
          registeredScopes: [...audience.registeredScopes], version: 1 } });
        const foreignPrincipal = await db.machinePrincipal.create({ data: { principalType: type,
          agentId: type === 'agent' ? 'mcc-isolated-workflow-agent' : null } });
        const foreign = await db.machineClient.create({ data: { clientId: `mcc-foreign-${name}`,
          machinePrincipalId: foreignPrincipal.id, secretHash, allowedResources: [], allowedScopes: [] } });
        await db.machineAccessGrant.create({ data: { machineClientId: foreign.id, audienceId: audience.audienceId,
          scopes: [grantedScope], version: 1 } });
        if (name !== 'website') {
          assert.equal((await direct.authorizeV1DirectToken({ ...request, clientId: foreign.clientId,
            resource: audience.audienceId, scope: grantedScope }, dbAdapter)).scope, grantedScope);
        }
        await rejects({ clientId: foreign.clientId }, type === 'agent' ? 'invalid_target' : 'invalid_scope', 400,
          type === 'agent' ? 'audience_profile_not_accepted' : 'machine_grant_missing');
      }
      await db.machineClient.create({ data: { clientId: 'mcc-legacy-arrays-only', machinePrincipalId: principalId,
        secretHash, allowedResources: [resource], allowedScopes: [scope] } });
      await rejects({ clientId: 'mcc-legacy-arrays-only' }, 'invalid_scope', 400, 'machine_grant_missing');
    });
    await t.test('every affected database registry projection mismatch refuses issuance', async () => {
      for (const [field, value] of Object.entries({ resourceService: 'foreign-service', scopeNamespace: 'foreign',
        acceptedPrincipalTypes: ['agent'], registeredScopes: ['conversation.read'], humanAccessEnabled: true,
        machineAccessEnabled: false, delegatedAccessEnabled: true, status: 'disabled', freezeReady: false, version: 2 })) {
        await db.authAudience.update({ where: { audienceId: resource }, data: { [field]: value } });
        await rejects({}, 'temporarily_unavailable', 503);
        await db.authAudience.update({ where: { audienceId: resource }, data: audienceData });
      }
    });
    await t.test('actual OAuth router uses Basic form POST and returns closed response plus no-store on success and errors', async () => {
      const { createOAuthRouter } = await import('../../src/routes/oauth.js');
      const { OAuthHttpError } = await import('../../src/utils/http-error.js');
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      app.use('/oauth', createOAuthRouter({ issueV1DirectToken: (params) => direct.issueV1DirectToken(params, dbAdapter) }));
      app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error instanceof OAuthHttpError ? error.status : 500).json({ error: error.message });
      });
      server = app.listen(0, '127.0.0.1');
      await new Promise<void>((resolveListen) => server!.once('listening', resolveListen));
      const endpoint = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/oauth/token`;
      const body = new URLSearchParams({ grant_type: 'client_credentials', resource, scope }).toString();
      const post = async (bodyValue = body, suppliedSecret = secret) => fetch(endpoint, { method: 'POST', headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: 'Basic ' + Buffer.from(`${clientId}:${suppliedSecret}`).toString('base64'),
      }, body: bodyValue });
      const response = await post();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('pragma'), 'no-cache');
      const result = await response.json() as any;
      assert.deepEqual(Object.keys(result).sort(), ['access_token', 'token_type', 'expires_in', 'scope'].sort());
      assert.equal(result.scope, scope);
      assert.equal(result.expires_in, 600);
      assert.equal(result.token_type, 'Bearer');
      assert.equal(signer.verifyV1DirectMachineToken(result.access_token, resource).principal_type, 'service');
      for (const [badBody, badSecret, status, code] of [
        [body, 'wrong-http-secret', 401, 'invalid_client'],
        [body + '&scope=conversation.read', secret, 400, 'invalid_grant'],
        [new URLSearchParams({ grant_type: 'client_credentials', resource, scope: scope + ' conversation.read' }).toString(), secret, 400, 'invalid_scope'],
      ] as const) {
        const failed = await post(badBody, badSecret);
        assert.equal(failed.status, status);
        assert.equal(failed.headers.get('cache-control'), 'no-store');
        assert.equal(failed.headers.get('pragma'), 'no-cache');
        assert.deepEqual(await failed.json(), { error: code });
      }
      assert.equal(JSON.stringify(result).includes(secret), false);
      assert.equal(JSON.stringify(result).includes(secretHash), false);
    });
    await t.test('legacy grant arrays remain empty and audit output excludes credentials, hashes and token bodies', async () => {
      const unchanged = await db.machineClient.findUniqueOrThrow({ where: { id: client.id } });
      assert.deepEqual(unchanged.allowedResources, []);
      assert.deepEqual(unchanged.allowedScopes, []);
      assert.ok(auditLines.length > 0);
      const audit = auditLines.join('\n');
      for (const sensitive of [secret, secretHash, process.env.JWT_PRIVATE_KEY!, 'wrong-http-secret', 'access_token', 'Authorization', 'Basic ']) {
        assert.equal(audit.includes(sensitive), false);
      }
      assert.ok(audit.includes('v1.direct.issued'));
      assert.ok(audit.includes('v1.direct.failed'));
    });
    t.diagnostic('MCC_ISOLATED_DATABASE=owned initdb cluster on ephemeral loopback port; actual Prisma schema/issuer/router; synthetic credentials and RSA keys only');
  } finally {
    console.warn = originalWarn;
    if (server) await new Promise<void>((resolveClose, reject) => server!.close(error => error ? reject(error) : resolveClose()));
    if (database) await database.$disconnect();
    resetKeyring?.();
    for (const name of Object.keys(process.env)) if (!(name in originalEnv)) delete process.env[name];
    Object.assign(process.env, originalEnv);
    if (started) execFileSync('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
    rmSync(root, { recursive: true, force: true });
    t.diagnostic('MCC_ISOLATED_CLEANUP=PostgreSQL stopped; owned database, socket, generated test keys and files removed');
  }
});
