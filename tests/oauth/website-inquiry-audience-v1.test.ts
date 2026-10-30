import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { prisma } from '../../src/lib/prisma.js';
import { hashClientSecret } from '../../src/lib/oauth/secret.js';
import { getV1AudienceDefinitions, initializeAuthContract, resetAuthContractForTests } from '../../src/lib/oauth/v1/contract.js';
import { authorizeV1DirectToken, issueV1DirectToken, type V1DirectDatabase } from '../../src/lib/oauth/v1/direct.js';
import { beginV1Authorization, completeV1Authorization, exchangeV1AuthorizationCode } from '../../src/lib/oauth/v1/human-login.js';
import { pkceS256 } from '../../src/lib/oauth/v1/credentials.js';
import { signV1DelegatedToken, verifyV1DirectMachineToken, verifyV1HumanAccessToken } from '../../src/lib/oauth/v1/signer.js';
import { resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';
import { clearKeyringEnv, configureKeyringEnv, generateTestKeyPair } from './_workflow-test-keys.js';

const HUMAN = 'agent-core-website-human-v1';
const TRANSPORT = 'agent-core-website-transport-v1';
const SCOPES = ['conversation.intent.redeem', 'conversation.own_events.read', 'conversation.own_result.read'];
const secret = crypto.randomBytes(32).toString('base64url');
const secretHash = hashClientSecret(secret);
const principalId = '20000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000001';
const humanClientId = '30000000-0000-4000-8000-000000000001';
const key = generateTestKeyPair('website-inquiry-synthetic-key');
const originalEnv = { ...process.env };
beforeEach(() => {
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  resetWorkflowKeyringForTests();
});
afterEach(() => {
  clearKeyringEnv();
  resetWorkflowKeyringForTests();
  for (const name of Object.keys(process.env)) if (!(name in originalEnv)) delete process.env[name];
  Object.assign(process.env, originalEnv);
});

function storedAudience(audienceId: string) {
  const audience = getV1AudienceDefinitions().find((entry) => entry.audienceId === audienceId);
  assert.ok(audience, `missing registered audience ${audienceId}`);
  return { ...audience, acceptedPrincipalTypes: [...audience.acceptedPrincipalTypes], registeredScopes: [...audience.registeredScopes], version: 1 };
}

function serviceClient() {
  return {
    id: humanClientId, clientId: 'synthetic-website-transport', machinePrincipalId: principalId,
    secretHash, status: 'active',
    principal: { id: principalId, principalType: 'service', agentId: null, ownerUserId: null, status: 'active' },
    accessGrants: [{ audienceId: TRANSPORT, scopes: [...SCOPES], version: 1, audience: storedAudience(TRANSPORT) }],
  };
}
function machineDb(client: ReturnType<typeof serviceClient> | null): V1DirectDatabase {
  return { machineClient: { findUnique: async (args: any) => {
    if (!client || args.where.clientId !== client.clientId) return null;
    return { ...client, accessGrants: client.accessGrants.filter((grant) => grant.audienceId === args.include.accessGrants.where.audienceId) } as never;
  } } };
}
const request = { clientId: 'synthetic-website-transport', clientSecret: secret, resource: TRANSPORT, scope: SCOPES[0] };
const denied = (code: string) => (error: any) => error.message === code;

// Missing/widened entries must break the runtime registry consumer, not just a text check.
test('frozen 1.14 source loads exactly a scopeless Human and three-scope Service audience', () => {
  resetAuthContractForTests();
  assert.equal(initializeAuthContract('v1').contractVersion, '1.14.0');
  assert.equal(getV1AudienceDefinitions().length, 15);
  assert.deepEqual(storedAudience(HUMAN), {
    audienceId: HUMAN, resourceService: HUMAN, scopeNamespace: 'agent-core-website-human',
    acceptedPrincipalTypes: ['user'], registeredScopes: [], humanAccessEnabled: true,
    machineAccessEnabled: false, delegatedAccessEnabled: false, status: 'active', freezeReady: true, version: 1,
  });
  assert.deepEqual(storedAudience(TRANSPORT), {
    audienceId: TRANSPORT, resourceService: TRANSPORT, scopeNamespace: 'conversation',
    acceptedPrincipalTypes: ['service'], registeredScopes: SCOPES, humanAccessEnabled: false,
    machineAccessEnabled: true, delegatedAccessEnabled: false, status: 'active', freezeReady: true, version: 1,
  });
});

// Any conflation of the independent grants, downscope or Service/Agent profile breaks this.
test('real Service issuer signs every nonempty scope subset with exact canonical claims', async () => {
  for (let mask = 1; mask < 8; mask += 1) {
    const scopes = SCOPES.filter((_, index) => mask & (1 << index));
    const client = serviceClient();
    client.accessGrants[0].scopes = scopes;
    const issued = await issueV1DirectToken({ ...request, scope: [...scopes].reverse().join(' ') }, machineDb(client));
    const claims = verifyV1DirectMachineToken(issued.access_token, TRANSPORT);
    assert.equal(claims.scope, scopes.join(' '));
    assert.equal(claims.principal_type, 'service');
    assert.equal(claims.sub, principalId);
    assert.equal(claims.aud, TRANSPORT);
    assert.equal(claims.iss, 'auth-service');
    for (const name of ['agent_id', 'role', 'act', 'azp', 'owner_user_id', 'refresh_token']) assert.equal(name in claims, false);
    assert.equal('refresh_token' in issued, false);
    assert.throws(() => verifyV1DirectMachineToken(issued.access_token, HUMAN));
  }
});

test('real Service authorization denies absent or inactive identities, credentials and grants', async () => {
  await assert.rejects(authorizeV1DirectToken(request, machineDb(null)), denied('invalid_client'));
  await assert.rejects(authorizeV1DirectToken({ ...request, clientSecret: 'wrong' }, machineDb(serviceClient())), denied('invalid_client'));
  for (const mutate of [
    (c: any) => { c.status = 'revoked'; },
    (c: any) => { c.principal.status = 'disabled'; },
    (c: any) => { c.principal.principalType = 'agent'; c.principal.agentId = 'synthetic-agent'; },
    (c: any) => { c.principal.agentId = 'forbidden'; },
    (c: any) => { c.accessGrants = []; },
    (c: any) => { c.accessGrants[0].audienceId = HUMAN; },
    (c: any) => { c.accessGrants[0].version = 0; },
    (c: any) => { c.accessGrants[0].audience.scopeNamespace = 'wrong'; },
  ]) {
    const client = serviceClient(); mutate(client);
    await assert.rejects(authorizeV1DirectToken(request, machineDb(client)));
  }
});

test('real Service authorization rejects aliases and every malformed or partially granted request', async () => {
  assert.throws(() => signV1DelegatedToken({ originalPrincipalId: principalId, originalAgentId: 'synthetic-agent', proxyPrincipalId: principalId, proxyClientId: 'synthetic-proxy', audience: TRANSPORT, scope: SCOPES[0], sourceExp: Math.floor(Date.now() / 1000) + 300 }), /invalid target audience/);
  for (const resource of [HUMAN, 'AGENT-CORE-WEBSITE-TRANSPORT-V1', `${TRANSPORT}/`, 'all-services', 'agent_core_website_transport_v1']) {
    await assert.rejects(authorizeV1DirectToken({ ...request, resource }, machineDb(serviceClient())), denied('invalid_target'));
  }
  for (const scope of ['', '*', 'conversation.*', 'conversation.intent.redeem conversation.intent.redeem', 'conversation.unknown', 'conversation.intent_redeem', 'workflow.read', ` ${SCOPES[0]}`, `${SCOPES[0]}  ${SCOPES[1]}`]) {
    await assert.rejects(authorizeV1DirectToken({ ...request, scope }, machineDb(serviceClient())), denied('invalid_scope'));
  }
  for (const granted of SCOPES) {
    const client = serviceClient(); client.accessGrants[0].scopes = [granted];
    await assert.rejects(authorizeV1DirectToken({ ...request, scope: SCOPES.join(' ') }, machineDb(client)), denied('invalid_scope'));
  }
});

// Only the persistence boundary is replaced: PKCE, password/opaque verifiers,
// Client/Grant checks, state transitions and signing execute production code.
async function humanFixture() {
  const password = crypto.randomBytes(24).toString('base64url');
  const user = { id: userId, email: 'synthetic@example.invalid', password: await bcrypt.hash(password, 4), status: 'active' };
  const redirectUri = 'https://synthetic.example.invalid/callback';
  const client: any = { id: humanClientId, clientId: 'synthetic-website-human', clientType: 'public_browser', clientAuthenticationMethod: 'none', credentialVerifier: null, status: 'active', version: 1,
    redirectUris: [{ redirectUri }], audienceGrants: [{ audienceId: HUMAN, version: 1, audience: storedAudience(HUMAN) }] };
  let transaction: any;
  let code: any;
  const effects: string[] = [];
  const restores: Array<() => void> = [];
  function replace(target: any, method: string, value: any) {
    const original = target[method]; target[method] = value;
    restores.push(() => { target[method] = original; });
  }
  const tx: any = {
    $queryRaw: async () => [],
    user: { findUnique: async () => user },
    humanAudienceGrant: { findUnique: async ({ where }: any) => where.humanClientId_audienceId.humanClientId === client.id
      ? client.audienceGrants.find((g: any) => g.audienceId === where.humanClientId_audienceId.audienceId) ?? null : null },
    authorizationTransaction: {
      findUnique: async () => ({ ...transaction, humanClient: client }),
      update: async ({ data }: any) => { Object.assign(transaction, data); return transaction; },
    },
    authorizationCode: {
      create: async ({ data }: any) => { code = { ...data, status: 'active', consumedAt: null }; return code; },
      findUnique: async ({ where }: any) => code?.id === where.id ? { ...code, authorizationTransaction: transaction, user, humanClient: client } : null,
      update: async ({ data }: any) => { Object.assign(code, data); return code; },
    },
  };
  for (const model of ['humanSession', 'refreshFamily', 'refreshCredential', 'authSecurityAudit']) {
    tx[model] = { create: async ({ data }: any) => { effects.push(`${model}.create`); return data; }, update: async ({ data }: any) => data };
  }
  replace(prisma.humanClient, 'findUnique', async ({ where, include }: any) => where.clientId === client.clientId ? { ...client, audienceGrants: include ? client.audienceGrants.filter((g: any) => g.audienceId === include.audienceGrants.where.audienceId) : client.audienceGrants } : null);
  replace(prisma.user, 'findUnique', async () => user);
  replace(prisma.authorizationTransaction, 'create', async ({ data }: any) => { transaction = { ...data, id: crypto.randomUUID(), status: 'pending', authenticatedUserId: null, consumedAt: null }; return transaction; });
  replace(prisma.authorizationCode, 'findUnique', tx.authorizationCode.findUnique);
  replace(prisma, '$transaction', async (run: any) => run(tx));
  const verifier = crypto.randomBytes(32).toString('base64url');
  const params = { clientId: client.clientId, redirectUri, audience: HUMAN, state: 'synthetic-state', codeChallenge: pkceS256(verifier), codeChallengeMethod: 'S256' };
  return { client, user, password, params, verifier, effects, restore: () => restores.reverse().forEach((restore) => restore()) };
}

test('real public-browser PKCE login issues a scopeless Human token bound to its exact grant', async () => {
  const f = await humanFixture();
  try {
    const begun = await beginV1Authorization(f.params);
    const completed = await completeV1Authorization({ authorizationTransactionId: begun.authorization_transaction_id, email: f.user.email, password: f.password });
    const exchange = { code: completed.code, clientId: f.client.clientId, redirectUri: f.params.redirectUri, codeVerifier: f.verifier, clientAuth: null, requestId: crypto.randomUUID() };
    await assert.rejects(exchangeV1AuthorizationCode({ ...exchange, codeVerifier: 'wrong' }), denied('invalid_grant'));
    await assert.rejects(exchangeV1AuthorizationCode({ ...exchange, clientId: 'wrong-client' }), denied('invalid_client'));
    await assert.rejects(exchangeV1AuthorizationCode({ ...exchange, redirectUri: `${f.params.redirectUri}/` }), denied('invalid_grant'));
    const issued = await exchangeV1AuthorizationCode(exchange);
    const claims = verifyV1HumanAccessToken(issued.access_token, HUMAN);
    assert.equal(claims.principal_type, 'user'); assert.equal(claims.sub, userId); assert.equal(claims.client_id, f.client.clientId);
    for (const name of ['scope', 'agent_id', 'role', 'act', 'azp']) assert.equal(name in claims, false);
    assert.throws(() => verifyV1HumanAccessToken(issued.access_token, TRANSPORT));
    assert.match(issued.refresh_token, /^rc1\./);
    assert.deepEqual(f.effects, ['humanSession.create', 'refreshFamily.create', 'refreshCredential.create', 'authSecurityAudit.create', 'authSecurityAudit.create']);
    await assert.rejects(exchangeV1AuthorizationCode(exchange), denied('invalid_grant'));
  } finally { f.restore(); }
});

test('Human issuer rejects missing/cross-audience grants, wrong redirect, PKCE and inactive users', async () => {
  const f = await humanFixture();
  try {
    await assert.rejects(beginV1Authorization({ ...f.params, clientId: 'unknown-client' }), denied('invalid_request'));
    f.client.status = 'revoked';
    await assert.rejects(beginV1Authorization(f.params), denied('invalid_client'));
    f.client.status = 'active';
    await assert.rejects(beginV1Authorization({ ...f.params, codeChallengeMethod: 'plain' }), denied('invalid_request'));
    await assert.rejects(beginV1Authorization({ ...f.params, redirectUri: `${f.params.redirectUri}/` }), denied('invalid_request'));
    await assert.rejects(beginV1Authorization({ ...f.params, audience: TRANSPORT }), denied('invalid_target'));
    f.client.audienceGrants = [];
    await assert.rejects(beginV1Authorization(f.params), denied('invalid_target'));
    f.client.audienceGrants = [{ audienceId: 'svc-okr', version: 1, audience: storedAudience('svc-okr') }];
    await assert.rejects(beginV1Authorization(f.params), denied('invalid_target'));
    f.client.audienceGrants = [{ audienceId: HUMAN, version: 1, audience: storedAudience(HUMAN) }];
    const begun = await beginV1Authorization(f.params);
    f.user.status = 'disabled';
    await assert.rejects(completeV1Authorization({ authorizationTransactionId: begun.authorization_transaction_id, email: f.user.email, password: f.password }), denied('invalid_grant'));
    assert.deepEqual(f.effects, []);
  } finally { f.restore(); }
});

test('bundle declares independently granted signed Human and all Service subsets for executable validation', () => {
  const positive = JSON.parse(readFileSync('contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json', 'utf8'));
  const human = positive.fixtures.find((f: any) => f.name === 'human-website-inquiry');
  assert.ok(human);
  assert.equal(human.claims.aud, HUMAN); assert.equal('scope' in human.claims, false);
  assert.deepEqual(human.authorization_context.human_audience_grants, [HUMAN]);
  const scopes = positive.fixtures.filter((f: any) => f.claims.aud === TRANSPORT).map((f: any) => f.claims.scope).sort();
  assert.deepEqual(scopes, [SCOPES[0], SCOPES[1], SCOPES[2], `${SCOPES[0]} ${SCOPES[1]}`, `${SCOPES[0]} ${SCOPES[2]}`, `${SCOPES[1]} ${SCOPES[2]}`, SCOPES.join(' ')].sort());
});
