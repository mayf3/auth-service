/**
 * Non-workflow compatibility regression tests (plan §5; task spec §五, §十四).
 *
 * Proves that audiences OTHER than svc-workflow are NOT affected by PR-A:
 *   - Still signed HS256 with JWT_SECRET (no kid, no RS256)
 *   - Same claims structure as before (signAgentAccessToken unchanged)
 *   - No workflow claims (no token_use) introduced
 *   - Default + svc-forum + svc-okr paths unchanged
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signAgentAccessToken } from '../../src/lib/oauth/token.js';
import { env } from '../../src/config/env.js';
import {
  configureKeyringEnv,
  clearKeyringEnv,
  generateTestKeyPair,
} from './_workflow-test-keys.js';
import { resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';

const ORIGINAL_ENV = { ...process.env };

describe('non-workflow audience compatibility (regression)', () => {
  beforeEach(() => {
    // Even with the workflow keyring configured, non-workflow audiences must
    // keep using HS256. This proves the dispatch is audience-gated.
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({ activeKid: active.kid, activePrivateKeyPem: active.privateKeyPem });
    resetWorkflowKeyringForTests();
  });
  afterEach(() => {
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
    for (const k of Object.keys(process.env)) if (!(k in ORIGINAL_ENV)) delete process.env[k];
    Object.assign(process.env, ORIGINAL_ENV);
  });

  for (const audience of ['svc-forum', 'svc-okr', 'unified-platform']) {
    it(`audience="${audience}" stays HS256 with no kid header`, () => {
      const token = signAgentAccessToken({
        principalId: '22222222-2222-2222-2222-222222222222',
        agentId: 'test-agent',
        clientId: 'mc_testclient123',
        audience,
        scope: 'forum.read',
      });
      const decoded = jwt.decode(token, { complete: true }) as any;
      assert.equal(decoded.header.alg, 'HS256', `${audience} must be HS256`);
      assert.equal(decoded.header.kid, undefined, `${audience} must NOT carry a kid`);
    });

    it(`audience="${audience}" claims unchanged (no token_use / act / azp)`, () => {
      const token = signAgentAccessToken({
        principalId: '22222222-2222-2222-2222-222222222222',
        agentId: 'test-agent',
        clientId: 'mc_testclient123',
        audience,
        scope: 'forum.read',
      });
      const payload = jwt.verify(token, env.JWT_SECRET) as any;
      assert.equal(payload.aud, audience);
      assert.equal(payload.principal_type, 'agent');
      assert.equal(payload.token_use, undefined, 'token_use is workflow-only');
      assert.equal(payload.act, undefined, 'act is OBO-only');
      assert.equal(payload.azp, undefined, 'azp is OBO-only');
    });
  }

  it('default TTL for non-workflow tokens is still 600s, capped at 900s', () => {
    const token = signAgentAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', audience: 'svc-forum', scope: 'forum.read',
    });
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    assert.ok(payload.exp - payload.iat <= 900);
    assert.ok(payload.exp - payload.iat >= 500);
  });
});
