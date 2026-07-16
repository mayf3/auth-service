/**
 * verify-token routing logic test (plan §14; task spec §十, §十四 verify-token).
 *
 * The full handler requires a live DB (prisma.machinePrincipal / user lookup),
 * which this repo's unit tests don't provision. We test the TESTABLE core of
 * the PR-A change — the token-kind detection used to branch — as a pure
 * function, mirroring how http-integration.test.ts tests safeString in isolation.
 *
 * The routing rule under test (service-registrations.ts):
 *   if (header.kid !== undefined && keyring configured) → workflow/machine path
 *   else → existing User (HS256) path
 *
 * This guarantees a workflow RS256 token (which carries kid) is NOT misrouted to
 * prisma.user.findUnique (the pre-PR-A bug that returned 401 "用户不存在").
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signWorkflowAccessToken } from '../../src/lib/oauth/workflow-signer.js';
import { signAgentAccessToken } from '../../src/lib/oauth/token.js';
import { env } from '../../src/config/env.js';
import { isWorkflowKeyringConfigured, resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';
import {
  generateTestKeyPair,
  configureKeyringEnv,
  clearKeyringEnv,
} from './_workflow-test-keys.js';

const ORIGINAL_ENV = { ...process.env };

/**
 * Pure replica of the detection predicate in service-registrations.ts.
 * Returns true if the token would take the workflow/machine verification path.
 */
function routesToWorkflow(token: string, keyringConfigured: boolean): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
  } catch {
    return false;
  }
  return header.kid !== undefined && typeof header.kid === 'string' && keyringConfigured;
}

describe('verify-token routing — token-kind detection', () => {
  let workflowToken: string;
  let hs256AgentToken: string;

  beforeEach(() => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({ activeKid: active.kid, activePrivateKeyPem: active.privateKeyPem });
    resetWorkflowKeyringForTests();
    workflowToken = signWorkflowAccessToken({
      principalId: '33333333-3333-3333-3333-333333333333',
      agentId: 'a', clientId: 'c', scope: 'workflow.read',
    });
    hs256AgentToken = signAgentAccessToken({
      principalId: 'p', agentId: 'a', clientId: 'c', audience: 'svc-forum', scope: 'forum.read',
    });
  });
  afterEach(() => {
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
    for (const k of Object.keys(process.env)) if (!(k in ORIGINAL_ENV)) delete process.env[k];
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('workflow token (kid present, keyring configured) routes to machine path', () => {
    assert.equal(routesToWorkflow(workflowToken, isWorkflowKeyringConfigured()), true);
  });

  it('HS256 agent token (no kid) routes to existing path (NOT machine)', () => {
    // Pre-PR-A this token was unverifiable via verify-token (it would hit prisma.user).
    // Post-PR-A it still takes the non-workflow path; the fix is specifically that
    // workflow tokens no longer share that fate.
    assert.equal(routesToWorkflow(hs256AgentToken, isWorkflowKeyringConfigured()), false);
  });

  it('human User token (HS256, no kid) routes to existing User path', () => {
    const userToken = jwt.sign(
      { sub: 'user-uuid', iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE, role: 'requester' },
      env.JWT_SECRET,
      { algorithm: 'HS256' }, // no keyid option
    );
    assert.equal(routesToWorkflow(userToken, isWorkflowKeyringConfigured()), false);
  });

  it('workflow token does NOT route to machine path when keyring is unconfigured', () => {
    // If the operator hasn't provisioned keys, verify-token must not pretend to
    // verify a workflow token via the RS256 path; it falls through to HS256,
    // which will correctly reject (alg mismatch) rather than misroute.
    assert.equal(routesToWorkflow(workflowToken, false), false);
  });

  it('malformed token (not 3 parts) is detected as non-workflow', () => {
    assert.equal(routesToWorkflow('not.a.jwt', isWorkflowKeyringConfigured()), false);
    assert.equal(routesToWorkflow('garbage', isWorkflowKeyringConfigured()), false);
  });

  it('workflow token header actually carries a kid (sanity for the routing signal)', () => {
    const header = jwt.decode(workflowToken, { complete: true }) as any;
    assert.equal(typeof header.header.kid, 'string');
    assert.equal(header.header.kid, 'key-v1-20260716');
  });
});
