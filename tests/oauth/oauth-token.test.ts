/**
 * Tests for Agent Access Token signing.
 *
 * Pure function tests — doesn't require a database.
 * Verifies JWT claims structure, TTL, and backward compatibility.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signAgentAccessToken } from '../../src/lib/oauth/token.js';
import { env } from '../../src/config/env.js';

describe('signAgentAccessToken', () => {
  it('produces a valid JWT with correct claims', () => {
    const token = signAgentAccessToken({
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read forum.write',
    });

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;

    assert.equal(decoded.sub, '123e4567-e89b-12d3-a456-426614174000');
    assert.equal(decoded.principal_type, 'agent');
    assert.equal(decoded.agent_id, 'test-agent');
    assert.equal(decoded.client_id, 'mc_testclient123');
    assert.equal(decoded.aud, 'svc-forum');
    assert.equal(decoded.scope, 'forum.read forum.write');
    assert.equal(decoded.type, 'access');
    assert.equal(decoded.version, 'v1');
    assert.equal(decoded.iss, 'auth-service');
  });

  it('has reasonable TTL (default 600s)', () => {
    const token = signAgentAccessToken({
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read',
    });

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    const ttl = decoded.exp - decoded.iat;
    assert.ok(ttl <= 900, `TTL ${ttl}s should be <= 900s`);
    assert.ok(ttl >= 500, `TTL ${ttl}s should be >= 500s`);
  });

  it('caps TTL at MAX_AGENT_TOKEN_TTL (900s)', () => {
    const token = signAgentAccessToken({
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read',
      ttl: 99999, // Way over max
    });

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    const ttl = decoded.exp - decoded.iat;
    assert.ok(ttl <= 900, `TTL ${ttl}s should be capped at 900s`);
  });

  it('generates unique jti each call', () => {
    const params = {
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read',
    };

    const token1 = signAgentAccessToken(params);
    const token2 = signAgentAccessToken(params);
    const decoded1 = jwt.verify(token1, env.JWT_SECRET) as any;
    const decoded2 = jwt.verify(token2, env.JWT_SECRET) as any;

    assert.notEqual(decoded1.jti, decoded2.jti);
  });

  it('does NOT include human user claims', () => {
    const token = signAgentAccessToken({
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read',
    });

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;

    // These claims are in human tokens but must NOT be in agent tokens
    assert.equal(decoded.name, undefined, 'Agent token should not have name');
    assert.equal(decoded.role, undefined, 'Agent token should not have role');
    assert.equal(decoded.internalRole, undefined, 'Agent token should not have internalRole');
    assert.equal(decoded.okrRole, undefined, 'Agent token should not have okrRole');
  });

  it('does not include refresh token', () => {
    const token = signAgentAccessToken({
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read',
    });

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    // No refresh token-related claims
    assert.equal(decoded.type, 'access');
  });

  it('token can be verified with same secret as human tokens', () => {
    const token = signAgentAccessToken({
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read',
    });

    // Should verify with the same env.JWT_SECRET
    assert.doesNotThrow(() => jwt.verify(token, env.JWT_SECRET));
  });

  it('sub is principal UUID, not user UUID or agentId', () => {
    const token = signAgentAccessToken({
      principalId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: 'test-agent',
      clientId: 'mc_testclient123',
      audience: 'svc-forum',
      scope: 'forum.read',
    });

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    // sub should NOT match agentId
    assert.notEqual(decoded.sub, 'test-agent');
    // sub should be a UUID (hex + hyphens)
    assert.ok(/^[0-9a-f-]+$/.test(decoded.sub), `sub "${decoded.sub}" should be hex+hyphens`);
  });
});
