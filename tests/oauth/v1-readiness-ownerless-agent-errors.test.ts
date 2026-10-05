import assert from 'node:assert/strict';
import test from 'node:test';
import { runReadinessScriptWithPrincipals } from '../helpers/minimal-auth-v1-readiness-fixture.js';

// Scope guard for mayf3/auth-service#86: aligning the Agent profile condition
// with AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1 §3 must not drop any real
// defect reporting. A valid ownerful Agent and a valid Service principal stay
// silent; missing/empty agentId and Service-carries-agentId stay reported.
test('readiness still reports real Agent/Service profile defects after the ownerless alignment', async () => {
  const agentMissingAgentId = '20000000-0000-4000-8000-0000000000b2';
  const ownerlessEmptyAgentId = '20000000-0000-4000-8000-0000000000b3';
  const serviceWithAgentId = '20000000-0000-4000-8000-0000000000b4';

  const result = await runReadinessScriptWithPrincipals([
    {
      id: '20000000-0000-4000-8000-0000000000b1',
      principalType: 'agent',
      agentId: 'agt_ownerful-ok',
      ownerUserId: '10000000-0000-4000-8000-000000000001',
    },
    {
      id: agentMissingAgentId,
      principalType: 'agent',
      agentId: null,
      ownerUserId: '10000000-0000-4000-8000-000000000001',
    },
    {
      id: ownerlessEmptyAgentId,
      principalType: 'agent',
      agentId: '',
      ownerUserId: null,
    },
    {
      id: serviceWithAgentId,
      principalType: 'service',
      agentId: 'agt_not-allowed-on-service',
      ownerUserId: null,
    },
    {
      id: '20000000-0000-4000-8000-0000000000b5',
      principalType: 'service',
      agentId: null,
      ownerUserId: null,
    },
  ]);

  assert.deepEqual(result.report.issues, [
    `Agent principal ${agentMissingAgentId} has an incomplete Agent profile`,
    `Agent principal ${ownerlessEmptyAgentId} has an incomplete Agent profile`,
    `Service principal ${serviceWithAgentId} carries an Agent ID`,
  ]);
  assert.equal(result.ready, false);
  assert.equal(result.markerLine, 'MINIMAL_AUTH_V1_DATA_READY=false');
  assert.equal(result.exitCode, 1);
});
