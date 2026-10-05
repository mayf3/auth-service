import assert from 'node:assert/strict';
import test from 'node:test';
import { getV1AudienceDefinitions } from '../../src/lib/oauth/v1/contract.js';
import { runReadinessScriptWithPrincipals } from '../helpers/minimal-auth-v1-readiness-fixture.js';

// Regression for mayf3/auth-service#86 against the actual readiness script:
// AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1 §3 makes owner_user_id optional for
// Agent principals, so a legal ownerless Agent alone must not make the whole
// inventory report MINIMAL_AUTH_V1_DATA_READY=false with exit 1.
test('readiness reports an exact-registry database with a valid ownerless Agent as ready', async () => {
  const result = await runReadinessScriptWithPrincipals([{
    id: '20000000-0000-4000-8000-0000000000a1',
    principalType: 'agent',
    agentId: 'agt_readiness-ownerless',
    ownerUserId: null,
  }]);

  assert.deepEqual(result.report.issues, []);
  assert.equal(result.ready, true);
  assert.equal(result.markerLine, 'MINIMAL_AUTH_V1_DATA_READY=true');
  assert.equal(result.exitCode ?? 0, 0);
  assert.equal(result.report.machine_principal_count, 1);
  assert.equal(result.report.audience_count, getV1AudienceDefinitions().length);
});
