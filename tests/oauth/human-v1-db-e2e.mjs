import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { hashClientSecret } from '../../src/lib/oauth/secret.js';

const prisma = new PrismaClient();
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4997';
const prefix = `human-v1-${Date.now().toString(36)}`;
const password = crypto.randomBytes(24).toString('base64url');
const confidentialSecret = crypto.randomBytes(32).toString('base64url');
const machineSecret = crypto.randomBytes(32).toString('base64url');
const redirectUri = `https://client.invalid/${prefix}/callback?registered=1`;
const publicRedirectUri = `http://127.0.0.1/${prefix}/callback`;
const ids = {
  confidential: `${prefix}-confidential`,
  public: `${prefix}-public`,
  noGrant: `${prefix}-no-grant`,
  machine: `${prefix}-machine`,
};
let user;
let confidentialClient;
let publicClient;
let passed = 0;

function decode(token) {
  const [header, payload] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  };
}

function basic(clientId, secret) {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;
}

async function responseData(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function postForm(path, fields, authorization) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers, body: new URLSearchParams(fields), redirect: 'manual',
  });
  return { response, data: await responseData(response) };
}

async function authorize(clientId = ids.confidential, targetRedirect = redirectUri, audience = 'svc-okr') {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
  const query = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: targetRedirect,
    audience, state: crypto.randomBytes(16).toString('base64url'),
    code_challenge: challenge, code_challenge_method: 'S256',
  });
  const start = await fetch(`${base}/oauth/authorize?${query}`);
  const startData = await responseData(start);
  return { start, startData, verifier, clientId, targetRedirect };
}

async function authenticate(flow) {
  const result = await postForm('/oauth/authorize/authenticate', {
    authorization_transaction_id: flow.startData.authorization_transaction_id,
    email: user.email,
    password,
  });
  const location = result.response.headers.get('location');
  return {
    ...result,
    code: location ? new URL(location).searchParams.get('code') : null,
    state: location ? new URL(location).searchParams.get('state') : null,
  };
}

async function exchange(flow, code, overrides = {}) {
  const clientId = overrides.clientId ?? flow.clientId;
  const secret = Object.hasOwn(overrides, 'secret')
    ? overrides.secret
    : clientId === ids.confidential ? confidentialSecret : null;
  return postForm('/oauth/token', {
    grant_type: 'authorization_code', code,
    redirect_uri: overrides.redirectUri ?? flow.targetRedirect,
    client_id: clientId,
    code_verifier: overrides.verifier ?? flow.verifier,
  }, secret ? basic(clientId, secret) : undefined);
}

async function login(clientId = ids.confidential, targetRedirect = redirectUri) {
  const flow = await authorize(clientId, targetRedirect);
  assert.equal(flow.start.status, 200);
  const authenticated = await authenticate(flow);
  assert.equal(authenticated.response.status, 302);
  assert.match(authenticated.code, /^ac1\./);
  const issued = await exchange(flow, authenticated.code);
  assert.equal(issued.response.status, 200, JSON.stringify(issued.data));
  return { flow, authenticated, issued };
}

async function refresh(token, clientId = ids.confidential, secret = confidentialSecret, resource = 'svc-okr') {
  return postForm('/oauth/token', {
    grant_type: 'refresh_token', refresh_token: token, client_id: clientId, resource,
  }, secret ? basic(clientId, secret) : undefined);
}

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')} ${name}`);
}

async function seed() {
  if (process.env.ALLOW_DESTRUCTIVE_TEST_DB !== '1') {
    throw new Error('Human DB E2E requires ALLOW_DESTRUCTIVE_TEST_DB=1 on a disposable database.');
  }
  const audiences = [
    ['svc-workflow', 'workflow', ['agent'], ['workflow.admin', 'workflow.execute', 'workflow.read'], false, true, true],
    ['svc-okr', 'okr', ['user'], [], true, false, false],
    ['adc-v2', 'adc', ['agent'], ['adc.execute', 'adc.read'], false, true, false],
  ];
  for (const [audienceId, scopeNamespace, accepted, scopes, human, machine, delegated] of audiences) {
    await prisma.authAudience.upsert({
      where: { audienceId },
      create: {
        audienceId, resourceService: audienceId, scopeNamespace,
        acceptedPrincipalTypes: accepted, registeredScopes: scopes,
        humanAccessEnabled: human, machineAccessEnabled: machine,
        delegatedAccessEnabled: delegated, status: 'active', freezeReady: true, version: 1,
      },
      update: {},
    });
  }
  user = await prisma.user.create({
    data: {
      name: prefix, email: `${prefix}@example.invalid`,
      password: await bcrypt.hash(password, 10), role: 'requester', status: 'active',
    },
  });
  confidentialClient = await prisma.humanClient.create({
    data: {
      clientId: ids.confidential, clientType: 'confidential_web',
      clientAuthenticationMethod: 'client_secret_basic',
      credentialVerifier: hashClientSecret(confidentialSecret),
      redirectUris: { create: { redirectUri } },
      audienceGrants: { create: { audienceId: 'svc-okr' } },
    },
  });
  publicClient = await prisma.humanClient.create({
    data: {
      clientId: ids.public, clientType: 'public_browser', clientAuthenticationMethod: 'none',
      redirectUris: { create: { redirectUri: publicRedirectUri } },
      audienceGrants: { create: { audienceId: 'svc-okr' } },
    },
  });
  await prisma.humanClient.create({
    data: {
      clientId: ids.noGrant, clientType: 'public_browser', clientAuthenticationMethod: 'none',
      redirectUris: { create: { redirectUri: publicRedirectUri } },
    },
  });
  const machinePrincipal = await prisma.machinePrincipal.create({
    data: { principalType: 'agent', agentId: `${prefix}-agent`, ownerUserId: user.id },
  });
  const machineClient = await prisma.machineClient.create({
    data: {
      clientId: ids.machine, machinePrincipalId: machinePrincipal.id,
      secretHash: hashClientSecret(machineSecret), status: 'active',
      allowedResources: ['svc-workflow'], allowedScopes: ['workflow.read'],
    },
  });
  await prisma.machineAccessGrant.create({
    data: { machineClientId: machineClient.id, audienceId: 'svc-workflow', scopes: ['workflow.read'] },
  });
}

async function run() {
  await seed();

  await check('Authorization Code binds User, Client, redirect, PKCE and Human audience', async () => {
    const flow = await authorize();
    assert.equal(flow.start.status, 200);
    assert.equal(flow.start.headers.get('cache-control'), 'no-store');
    const authenticated = await authenticate(flow);
    assert.equal(authenticated.response.status, 302);
    assert.match(authenticated.code, /^ac1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    assert.equal(new URL(authenticated.response.headers.get('location')).origin, 'https://client.invalid');

    assert.equal((await exchange(flow, authenticated.code, { clientId: ids.public, secret: null })).response.status, 400);
    assert.equal((await exchange(flow, authenticated.code, { redirectUri: `${redirectUri}x` })).response.status, 400);
    assert.equal((await exchange(flow, authenticated.code, { verifier: 'B'.repeat(43) })).response.status, 400);
    assert.equal((await exchange(flow, authenticated.code, { secret: null })).response.status, 401);

    const issued = await exchange(flow, authenticated.code);
    assert.equal(issued.response.status, 200);
    assert.equal(issued.response.headers.get('cache-control'), 'no-store');
    assert.equal((await exchange(flow, authenticated.code)).response.status, 400);
    const claims = decode(issued.data.access_token);
    assert.equal(claims.header.alg, 'RS256');
    assert.equal(claims.payload.sub, user.id);
    assert.equal(claims.payload.client_id, ids.confidential);
    assert.equal(claims.payload.aud, 'svc-okr');
    assert.equal(claims.payload.principal_type, 'user');
    assert.ok(claims.payload.exp - claims.payload.iat <= 900);
    for (const name of ['scope', 'act', 'azp', 'role', 'internalRole', 'okrRole']) {
      assert.equal(name in claims.payload, false);
    }
    const jwks = await responseData(await fetch(`${base}/.well-known/jwks.json`));
    const jwk = jwks.keys.find((candidate) => candidate.kid === claims.header.kid);
    assert.ok(jwk);
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const parts = issued.data.access_token.split('.');
    assert.equal(crypto.verify(
      'RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'),
    ), true);
  });

  await check('Authorize rejects unregistered redirect, missing grant and duplicate parameters', async () => {
    assert.equal((await authorize(ids.confidential, `${redirectUri}x`)).start.status, 400);
    assert.equal((await authorize(ids.noGrant, publicRedirectUri)).start.status, 400);
    const query = new URLSearchParams({
      response_type: 'code', client_id: ids.public, redirect_uri: publicRedirectUri,
      audience: 'svc-okr', state: 'one', code_challenge: 'A'.repeat(43),
      code_challenge_method: 'S256',
    });
    query.append('state', 'two');
    assert.equal((await fetch(`${base}/oauth/authorize?${query}`)).status, 400);
  });

  await check('Public Client uses PKCE with no Basic and rejects Basic authentication', async () => {
    const flow = await authorize(ids.public, publicRedirectUri);
    const authenticated = await authenticate(flow);
    const forbidden = await exchange(flow, authenticated.code, { secret: 'forbidden' });
    assert.equal(forbidden.response.status, 401);
    const issued = await exchange(flow, authenticated.code, { secret: null });
    assert.equal(issued.response.status, 200);
    assert.equal(decode(issued.data.access_token).payload.client_id, ids.public);
  });

  await check('Database stores only opaque verifiers and exact Session bindings', async () => {
    const latest = await prisma.refreshCredential.findFirst({
      where: { humanClientId: publicClient.id }, orderBy: { issuedAt: 'desc' },
      include: { session: true },
    });
    const code = await prisma.authorizationCode.findFirst({
      where: { humanClientId: publicClient.id }, orderBy: { issuedAt: 'desc' },
    });
    assert.match(latest.secretVerifier, /^[0-9a-f]{32}:[0-9a-f]{64}$/);
    assert.match(code.credentialVerifier, /^[0-9a-f]{32}:[0-9a-f]{64}$/);
    assert.equal(latest.verifierParametersVersion, 'scrypt-v1');
    assert.equal(latest.userId, user.id);
    assert.equal(latest.humanClientId, publicClient.id);
    assert.equal(latest.session.userId, user.id);
    assert.equal(latest.session.humanClientId, publicClient.id);
  });

  await check('Refresh rotates atomically, grants only Human targets and keeps one active credential', async () => {
    const session = await login();
    assert.equal((await refresh(session.issued.data.refresh_token, ids.confidential, confidentialSecret, 'svc-workflow')).response.status, 400);
    const rotated = await refresh(session.issued.data.refresh_token);
    assert.equal(rotated.response.status, 200);
    assert.notEqual(rotated.data.refresh_token, session.issued.data.refresh_token);
    const originalId = session.issued.data.refresh_token.split('.')[1];
    const old = await prisma.refreshCredential.findUnique({ where: { id: originalId } });
    assert.equal(old.status, 'rotated');
    assert.equal(await prisma.refreshCredential.count({
      where: { familyId: old.familyId, status: 'active' },
    }), 1);
    assert.equal((await refresh(session.issued.data.refresh_token)).response.status, 400);
    const family = await prisma.refreshFamily.findUnique({ where: { id: old.familyId } });
    const humanSession = await prisma.humanSession.findUnique({ where: { id: old.sessionId } });
    assert.equal(family.status, 'revoked');
    assert.equal(humanSession.status, 'revoked');
    const events = await prisma.authSecurityAudit.findMany({ where: { refreshFamilyId: old.familyId } });
    for (const event of ['refresh.reuse_detected', 'refresh.family_revoked', 'session.revoked']) {
      assert.ok(events.some((row) => row.eventType === event));
    }
    const serialized = JSON.stringify(events);
    assert.equal(serialized.includes(session.issued.data.refresh_token), false);
    assert.equal(serialized.includes(rotated.data.refresh_token), false);
  });

  await check('Concurrent Refresh allows at most one success and revokes the reused family', async () => {
    const session = await login();
    const results = await Promise.all([
      refresh(session.issued.data.refresh_token), refresh(session.issued.data.refresh_token),
    ]);
    assert.deepEqual(results.map((item) => item.response.status).sort(), [200, 400]);
    const credential = await prisma.refreshCredential.findUnique({
      where: { id: session.issued.data.refresh_token.split('.')[1] },
    });
    assert.equal((await prisma.refreshFamily.findUnique({ where: { id: credential.familyId } })).status, 'revoked');
  });

  await check('Logout revokes the Session and blocks further Refresh', async () => {
    const session = await login();
    const logout = await postForm('/oauth/logout', {
      refresh_token: session.issued.data.refresh_token, client_id: ids.confidential,
    }, basic(ids.confidential, confidentialSecret));
    assert.equal(logout.response.status, 204);
    assert.equal((await refresh(session.issued.data.refresh_token)).response.status, 400);
  });

  await check('User disable, Client revoke and absolute Session expiry return generic Refresh failure', async () => {
    const disabledUserSession = await login();
    await prisma.user.update({ where: { id: user.id }, data: { status: 'disabled', disabledAt: new Date() } });
    assert.equal((await refresh(disabledUserSession.issued.data.refresh_token)).response.status, 400);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'active', disabledAt: null } });

    const revokedClientSession = await login(ids.public, publicRedirectUri);
    const revokedCredential = await prisma.refreshCredential.findUnique({
      where: { id: revokedClientSession.issued.data.refresh_token.split('.')[1] },
    });
    await prisma.humanClient.update({ where: { id: publicClient.id }, data: { status: 'revoked', revokedAt: new Date() } });
    assert.equal((await refresh(revokedClientSession.issued.data.refresh_token, ids.public, null)).response.status, 400);
    assert.equal((await prisma.refreshFamily.findUnique({
      where: { id: revokedCredential.familyId },
    })).status, 'revoked');
    await prisma.humanClient.update({ where: { id: publicClient.id }, data: { status: 'active', revokedAt: null } });

    const expired = await login();
    const credential = await prisma.refreshCredential.findUnique({
      where: { id: expired.issued.data.refresh_token.split('.')[1] },
    });
    const now = Date.now();
    await prisma.humanSession.update({
      where: { id: credential.sessionId },
      data: {
        authenticatedAt: new Date(now - 29 * 86400_000),
        lastRefreshedAt: new Date(now - 1000),
        absoluteExpiresAt: new Date(now - 500),
      },
    });
    assert.equal((await refresh(expired.issued.data.refresh_token)).response.status, 400);
    assert.equal((await prisma.humanSession.findUnique({
      where: { id: credential.sessionId },
    })).status, 'expired');
    assert.equal((await prisma.refreshFamily.findUnique({
      where: { id: credential.familyId },
    })).status, 'expired');
  });

  await check('Audit persistence failure rolls back Code consumption and returns no token', async () => {
    const flow = await authorize();
    const authenticated = await authenticate(flow);
    const sessionsBefore = await prisma.humanSession.count();
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION reject_human_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated human audit outage'; END; $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER human_audit_insert_outage BEFORE INSERT ON auth_security_audits
      FOR EACH ROW EXECUTE FUNCTION reject_human_audit_insert()
    `);
    try {
      const result = await exchange(flow, authenticated.code);
      assert.equal(result.response.status, 500);
      assert.deepEqual(result.data, { error: 'server_error' });
      assert.equal(await prisma.humanSession.count(), sessionsBefore);
      assert.equal((await prisma.authorizationCode.findUnique({
        where: { id: authenticated.code.split('.')[1] },
      })).status, 'active');
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS human_audit_insert_outage ON auth_security_audits',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_human_audit_insert()');
    }
  });

  await check('Machine access never returns a Refresh Credential', async () => {
    const direct = await postForm('/oauth/token', {
      grant_type: 'client_credentials', resource: 'svc-workflow', scope: 'workflow.read',
    }, basic(ids.machine, machineSecret));
    assert.equal(direct.response.status, 200, JSON.stringify(direct.data));
    assert.equal('refresh_token' in direct.data, false);
  });

  console.log(`HUMAN_V1_REAL_PROCESS_CONFORMANCE_PASS=${passed}`);
}

run().finally(async () => prisma.$disconnect()).catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
