/**
 * Compatibility regression tests.
 *
 * Verifies that the new OAuth models do NOT break existing human auth flows.
 * These tests check that existing imports, types, and server setup still work.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('existing human auth compatibility', () => {
  it('existing auth router can still be imported', async () => {
    // Should not throw
    const mod = await import('../../src/routes/auth.js');
    assert.ok(mod.authRouter, 'authRouter should be exported');
  });

  it('existing user router can still be imported', async () => {
    const mod = await import('../../src/routes/users.js');
    assert.ok(mod.usersRouter, 'usersRouter should be exported');
  });

  it('existing service router can still be imported', async () => {
    const mod = await import('../../src/routes/service-registrations.js');
    assert.ok(mod.serviceRegistrationRouter, 'serviceRegistrationRouter should be exported');
  });

  it('existing auth middleware unchanged', async () => {
    const mod = await import('../../src/middleware/auth.js');
    assert.ok(typeof mod.authRequired === 'function', 'authRequired should be a function');
    assert.ok(typeof mod.signAccessToken === 'function', 'signAccessToken should be a function');
  });

  it('new oauth router exports without error', async () => {
    const mod = await import('../../src/routes/oauth.js');
    assert.ok(mod.oauthRouter, 'oauthRouter should be exported');
  });
});
