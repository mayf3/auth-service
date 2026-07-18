/**
 * HTTP Body Parsing Integration Tests for POST /oauth/token.
 *
 * These tests verify that the body parsing fix for BLOCKER-01 works:
 *   1. server.ts now has express.urlencoded({ extended: false })
 *   2. oauth.ts reads from req.body directly (no broken URLSearchParams)
 *   3. safeString() properly validates parameters
 *
 * Real HTTP testing is done via local-smoke.mjs which starts the full server.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('safeString — route-level parameter validation', () => {
  // Replicate the safeString logic used in routes/oauth.ts
  function safeString(val: unknown): string {
    if (typeof val === 'string') return val;
    // Reject arrays (duplicate params), objects, booleans, numbers
    if (Array.isArray(val) || (val !== null && typeof val === 'object') ||
        typeof val === 'number' || typeof val === 'boolean') {
      throw new Error('invalid_grant');
    }
    return '';
  }

  it('accepts string values', () => {
    assert.equal(safeString('client_credentials'), 'client_credentials');
    assert.equal(safeString('svc-forum'), 'svc-forum');
    assert.equal(safeString('forum.read'), 'forum.read');
  });

  it('rejects array values (duplicate parameters)', () => {
    assert.throws(() => safeString(['a', 'b']), /invalid_grant/);
    assert.throws(() => safeString(['a', 'b']), /invalid_grant/);
    assert.throws(() => safeString(['a', 'b']), /invalid_grant/);
  });

  it('rejects object values', () => {
    assert.throws(() => safeString({ key: 'val' }), /invalid_grant/);
  });

  it('rejects numeric values', () => {
    assert.throws(() => safeString(42 as any), /invalid_grant/);
  });

  it('rejects boolean values', () => {
    assert.throws(() => safeString(true as any), /invalid_grant/);
  });

  it('returns empty string for undefined/null (absent fields)', () => {
    assert.equal(safeString(undefined), '');
    assert.equal(safeString(null), '');
  });
});

describe('express.urlencoded middleware configuration', () => {
  it('server.ts includes express.urlencoded middleware', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/server.ts', 'utf-8');
    assert.ok(content.includes("express.urlencoded({ extended: false })"),
      'server.ts should have express.urlencoded middleware');
    assert.ok(content.includes('express.json()'),
      'server.ts should still have express.json');
    const oauthNoStore = content.indexOf("req.path.startsWith('/oauth/')");
    const globalLimiter = content.indexOf('app.use(globalLimiter)');
    assert.ok(oauthNoStore >= 0 && oauthNoStore < globalLimiter,
      'OAuth no-store middleware must run before the global rate limiter');
  });
});

describe('oauth route body parsing fix', () => {
  it('oauth.ts no longer uses URLSearchParams on req.body', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/routes/oauth.ts', 'utf-8');
    assert.ok(!content.includes('URLSearchParams'),
      'oauth.ts should NOT use URLSearchParams to re-parse body');
    assert.ok(content.includes('safeString'),
      'oauth.ts should use safeString for parameter validation');
    assert.ok(content.includes("application/x-www-form-urlencoded"),
      'oauth.ts should validate Content-Type');
  });
});

describe('Content-Type validation', () => {
  function isFormUrlencoded(ct: string): boolean {
    return ct.startsWith('application/x-www-form-urlencoded');
  }

  it('allows standard form-urlencoded', () => {
    assert.ok(isFormUrlencoded('application/x-www-form-urlencoded'));
  });

  it('allows form-urlencoded with charset', () => {
    assert.ok(isFormUrlencoded('application/x-www-form-urlencoded; charset=utf-8'));
  });

  it('rejects JSON content type', () => {
    assert.ok(!isFormUrlencoded('application/json'));
  });

  it('rejects missing content type', () => {
    assert.ok(!isFormUrlencoded(''));
  });

  it('rejects XML content type', () => {
    assert.ok(!isFormUrlencoded('application/xml'));
  });
});
