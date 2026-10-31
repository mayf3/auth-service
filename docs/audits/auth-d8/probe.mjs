import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { issueV1DirectToken } from './src/lib/oauth/v1/direct.ts';
import { getV1AudienceDefinitions } from './src/lib/oauth/v1/contract.ts';
import { verifyV1DirectMachineToken } from './src/lib/oauth/v1/signer.ts';
import { hashClientSecret } from './src/lib/oauth/secret.ts';
import { resetWorkflowKeyringForTests } from './src/lib/oauth/workflow-keyring.ts';
import { configureKeyringEnv, generateTestKeyPair, clearKeyringEnv } from './tests/oauth/_workflow-test-keys.ts';
const audience = 'agent-core-notification-ingress-v1';
const secret = 'auth-d8-synthetic-only';
const principalId = '13430000-0000-4000-8000-000000000001';
const clientId = 'mc_d8_synthetic';
const secretHash = hashClientSecret(secret);
const request = { clientId, clientSecret: secret, resource: audience, scope: 'notification.deliver' };
const results = [];
const logs = [];
const original = { log: console.log, warn: console.warn, error: console.error };
console.log = console.warn = console.error = (...args) => logs.push(args.map(String).join(' '));
const tokens = [];
function database(options = {}) {
  const resource = options.grantAudience ?? audience;
  const a = getV1AudienceDefinitions().find(a => a.audienceId === resource);
  assert.ok(a);
  const grants = options.missingGrant ? [] : [{ audienceId: resource,
    scopes: options.scopes ?? ['notification.deliver'], version: 1,
    audience: { ...a, acceptedPrincipalTypes: [...a.acceptedPrincipalTypes],
      registeredScopes: [...a.registeredScopes], version: 1 } }];
  const client = { id: '13430000-0000-4000-8000-000000000002', clientId,
    machinePrincipalId: principalId, secretHash, status: 'active',
    allowedResources: [audience], allowedScopes: ['notification.deliver'],
    principal: { id: principalId, principalType: 'service', agentId: null, ownerUserId: null, status: 'active' },
    accessGrants: grants };
  if (options.agent) Object.assign(client.principal, { principalType: 'agent', agentId: 'agt_d8_synthetic' });
  return { machineClient: { findUnique: async ({where, include}) => {
    if (where.clientId !== client.clientId) return null;
    return { ...client, accessGrants: grants.filter(g => g.audienceId === include.accessGrants.where.audienceId) };
  } } };
}
async function deny(name, params, db, error, category) {
  for (let i = 0; i < 2; i++) await assert.rejects(issueV1DirectToken(params, db), e =>
    e.message === error && e.category === category);
  results.push({ name, result: 'PASS', error, category, attempts: 2 });
}
try {
  const key = generateTestKeyPair('auth-d8-synthetic-key');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  resetWorkflowKeyringForTests();
  const issued = await issueV1DirectToken(request, database()); tokens.push(issued.access_token);
  const claims = verifyV1DirectMachineToken(issued.access_token, audience);
  assert.equal(claims.principal_type, 'service'); assert.equal(claims.scope, request.scope);
  assert.equal(claims.aud, audience); assert.equal(claims.sub, principalId); assert.equal(claims.client_id, clientId);
  assert.equal(claims.token_use, 'access'); assert.ok(!('agent_id' in claims));
  results.push({ name: 'service + correct audience + durable scope grant mints on unchanged base', result: 'PASS' });
  await deny('legacy allowedResources/allowedScopes alone do not supply a durable grant', request, database({ missingGrant: true }), 'invalid_scope', 'machine_grant_missing');
  await deny('unregistered scope rejects whole issuance', { ...request, scope: 'notification.unknown' }, database(), 'invalid_scope', 'requested_scope_not_granted');
  await deny('mixed scope never downscopes', { ...request, scope: 'notification.deliver notification.unknown' }, database(), 'invalid_scope', 'requested_scope_not_granted');
  await deny('wrong registered audience cannot reuse notification grant', { ...request, resource: 'identity-directory' }, database(), 'invalid_scope', 'machine_grant_missing');
  await deny('unknown audience fails closed', { ...request, resource: 'unknown-audience' }, database(), 'invalid_target', 'audience_not_machine_enabled');
  await deny('unregistered client fails closed', { ...request, clientId: 'mc_d8_not_registered' }, database(), 'invalid_client', 'client_or_principal_inactive');
  await deny('invalid synthetic credential fails closed', { ...request, clientSecret: 'wrong-synthetic' }, database(), 'invalid_client', 'credential_invalid');
  await deny('agent remains excluded from notification service audience', request, database({ agent: true }), 'invalid_target', 'audience_profile_not_accepted');
  const agentIssued = await issueV1DirectToken({ ...request, resource: 'svc-workflow', scope: 'workflow.read' }, database({ agent: true, grantAudience: 'svc-workflow', scopes: ['workflow.read'] }));
  tokens.push(agentIssued.access_token);
  const agent = verifyV1DirectMachineToken(agentIssued.access_token, 'svc-workflow');
  assert.equal(agent.principal_type, 'agent'); assert.equal(agent.agent_id, 'agt_d8_synthetic');
  assert.equal(agent.scope, 'workflow.read');
  results.push({ name: 'agent workflow issuance remains unchanged', result: 'PASS' });
  for (const value of [...tokens, secret, secretHash]) assert.ok(!logs.join('\n').includes(value));
  results.push({ name: 'no synthetic credential/hash/token logged', result: 'PASS' });
} finally {
  Object.assign(console, original); clearKeyringEnv(); resetWorkflowKeyringForTests();
}
const sourceFiles = ['src/routes/oauth.ts', 'src/lib/oauth/v1/direct.ts', 'src/lib/oauth/v1/signer.ts', 'src/lib/oauth/token-issuance.ts', 'contract-bundles/minimal-auth-v1/audience-registry.json'];
const sourceSha256 = Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
console.log(JSON.stringify({ testedHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), persistence: 'synthetic fixture only', sourceSha256, results }, null, 2));
