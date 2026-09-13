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
