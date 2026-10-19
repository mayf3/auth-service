// T52 — FORUM_DIRECT_AGENT_V1 mint tests (auth side of the cross-repo contract).
// Profile fixture: docs/contracts/forum-direct-agent-token-profile.json
// (mirrored byte-for-byte in agent-forum). Disposable local keypair only.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import {
  forumDirectAgentProfile,
  mintForumDirectAgentToken,
  FORUM_DIRECT_AGENT_AUDIENCE,
  FORUM_DIRECT_AGENT_TTL_SECONDS,
} from '../../src/lib/oauth/forum-direct-agent-token.js';

const REPO = join(import.meta.dirname ?? '.', '..', '..');

test('profile fixture file exists and the runtime profile matches its static fields', () => {
  const fixture = JSON.parse(
    readFileSync(join(REPO, 'docs', 'contracts', 'forum-direct-agent-token-profile.json'), 'utf8'),
  );
  const runtime = forumDirectAgentProfile();
  assert.equal(runtime.profile, fixture.profile);
  assert.equal(runtime.signing_algorithm, fixture.signing_algorithm);
  assert.equal(runtime.verification, fixture.verification);
  assert.equal(runtime.audience, fixture.audience);
  assert.equal(runtime.refresh_token, fixture.refresh_token);
  assert.deepEqual(runtime.forbidden, fixture.forbidden);
  assert.deepEqual(runtime.required_claims, fixture.required_claims);
});

test('minted token matches the frozen profile claim-for-claim', async () => {
  const { generateTestKeyPair, configureKeyringEnv } = await import('./_workflow-test-keys.js');
  const key = generateTestKeyPair('t52-test-kid');
  configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
  const { getWorkflowKeyring } = await import('../../src/lib/oauth/workflow-keyring.js');
  const now = Math.floor(Date.now() / 1000);
  const minted = mintForumDirectAgentToken({
    machinePrincipalId: '9f1c2b3a-1111-4222-8333-444455556666',
    agentId: 'agt-forum-direct-agent',
    machineClientId: 'mc_forum_direct',
    scope: 'forum.read forum.write',
    now,
  });

  const decoded = jwt.decode(minted.token, { complete: true })!;
  const header = decoded.header as any;
  const payload = decoded.payload as any;

  assert.equal(header.alg, 'RS256');
  assert.equal(header.kid, minted.kid);
  assert.equal(payload.iss, forumDirectAgentProfile().issuer);
  assert.equal(payload.aud, FORUM_DIRECT_AGENT_AUDIENCE);
  assert.equal(payload.type, 'access');
  assert.equal(payload.version, 'v1');
  assert.equal(payload.principal_type, 'agent');
  assert.equal(payload.sub, '9f1c2b3a-1111-4222-8333-444455556666');
  assert.equal(payload.agent_id, 'agt-forum-direct-agent');
  assert.equal(payload.client_id, 'mc_forum_direct');
  assert.equal(payload.scope, 'forum.read forum.write');
  assert.equal(payload.exp - payload.iat, FORUM_DIRECT_AGENT_TTL_SECONDS, 'short-lived');
  assert.equal(minted.refreshTokenIssued, false, 'profile never issues a refresh token');

  // signature verification with the test active public key
  const verified = jwt.verify(minted.token, key.publicKeyPem, { algorithms: ['RS256'] }) as any;
  assert.equal(verified.aud, FORUM_DIRECT_AGENT_AUDIENCE);
  assert.equal(verified.sub, '9f1c2b3a-1111-4222-8333-444455556666');
});

// Regression: the helper formerly supplied singular audit `scope`, which the
// allowlisted serializer omits. This exercises the real mint + logger boundary.
for (const scope of ['forum.read', 'forum.read forum.write']) {
  test(`mint audit preserves exact scopes and singular JWT scope: ${scope}`, async (t) => {
    const { generateTestKeyPair, configureKeyringEnv, clearKeyringEnv } = await import('./_workflow-test-keys.js');
    const key = generateTestKeyPair('forum-audit-regression-kid');
    configureKeyringEnv({ activeKid: key.kid, activePrivateKeyPem: key.privateKeyPem });
    const { resetWorkflowKeyringForTests } = await import('../../src/lib/oauth/workflow-keyring.js');
    resetWorkflowKeyringForTests();
    t.after(() => { clearKeyringEnv(); resetWorkflowKeyringForTests(); });
    const captured: string[] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => { captured.push(args.map(String).join(' ')); });
    const request = {
      machinePrincipalId: '9f1c2b3a-1111-4222-8333-444455556666',
      agentId: 'agt-forum-audit-regression',
      machineClientId: 'mc_forum_audit_regression',
      scope,
    };
    // Extra caller data must never escape via a raw request audit.
    const rawRequest = { ...request, client_secret: 'synthetic-forum-secret-sentinel',
      credential_verifier: 'synthetic-forum-verifier-sentinel' };
    const minted = mintForumDirectAgentToken(rawRequest);
    const payload = jwt.verify(minted.token, key.publicKeyPem, { algorithms: ['RS256'] });
    assert.notEqual(typeof payload, 'string');
    if (typeof payload === 'string') throw new Error('expected JWT object');
    assert.equal(payload.scope, scope);
    assert.equal(Object.hasOwn(payload, 'scopes'), false);
    assert.equal(payload.aud, 'svc-forum');
    assert.equal(payload.principal_type, 'agent');
    assert.equal(minted.refreshTokenIssued, false);
    assert.equal(captured.length, 1);
    assert.ok(captured[0].startsWith('[AUDIT] '));
    const event: Record<string, unknown> = JSON.parse(captured[0].slice('[AUDIT] '.length));
    assert.equal(event.type, 'forum.direct_agent_token.minted');
    assert.equal(event.scopes, scope, 'success audit must retain the exact minted scopes');
    assert.equal(Object.hasOwn(event, 'scope'), false);
    assert.equal(event.clientId, 'mc_forum...');
    assert.equal(event.principalId, request.machinePrincipalId);
    assert.equal(event.agentId, request.agentId);
    assert.equal(event.kid, key.kid);
    assert.equal(event.success, true);
    assert.deepEqual(Object.keys(event).sort(),
      ['agentId', 'clientId', 'kid', 'principalId', 'scopes', 'success', 'timestamp', 'type']);
    const output = captured.join('\n');
    for (const forbidden of [minted.token, key.privateKeyPem, rawRequest.client_secret,
      rawRequest.credential_verifier, JSON.stringify(rawRequest), request.machineClientId]) {
      assert.equal(output.includes(forbidden), false, 'audit must not expose private/raw caller values');
    }
    assert.equal(output.includes('PRIVATE KEY'), false);
  });
}
