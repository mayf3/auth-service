import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  initializeAuthContract,
  resetAuthContractForTests,
} from '../../src/lib/oauth/v1/contract.js';

const bundleRoot = resolve(process.cwd(), 'contract-bundles', 'minimal-auth-v1');

function readBundleJson(relativePath: string): any {
  return JSON.parse(readFileSync(resolve(bundleRoot, relativePath), 'utf8'));
}

const registry = readBundleJson('audience-registry.json');
const manifest = readBundleJson('contract-manifest.json');
const manifestSchema = readBundleJson('schemas/contract-manifest.schema.json');
const positiveFixtures = readBundleJson('fixtures/positive-token-fixtures.json');
const negativeFixtures = readBundleJson('fixtures/negative-token-fixtures.json');

test('Bundle 1.12.0 registers the exact independent session messaging scopes', () => {
  assert.equal(registry.registry_version, '1.12.0');
  assert.equal(manifest.contract_version, '1.12.0');
  assert.equal(manifest.audience_registry_version, '1.12.0');
  assert.equal(manifestSchema.properties.contract_version.const, '1.12.0');

  const audience = registry.audiences.find(
    (entry: any) => entry.audience_id === 'agent-session-messaging',
  );
  assert.deepEqual(audience, {
    audience_id: 'agent-session-messaging',
    resource_service: 'agent-session-messaging',
    scope_namespace: 'agent',
    accepted_principal_types: ['agent'],
    human_access_enabled: false,
    machine_access_enabled: true,
    delegated_access_enabled: false,
    registered_scopes: [
      'agent.session.inspect_own_dispatch',
      'agent.session.send',
    ],
    status: 'active',
    freeze_ready: true,
    notes: 'Registered by AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2 for canonical send and independently granted caller-owned exact-turn inspection consumed by dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_V2.',
  });
});

test('runtime accepts the frozen Bundle 1.12.0 snapshot', () => {
  resetAuthContractForTests();
  assert.equal(initializeAuthContract('v1').contractVersion, '1.12.0');
});

test('positive fixtures prove send-only, inspect-only, and combined grants independently', () => {
  const expected = new Map([
    ['direct-agent-session-messaging', 'agent.session.send'],
    ['direct-agent-session-inspection', 'agent.session.inspect_own_dispatch'],
    [
      'direct-agent-session-messaging-and-inspection',
      'agent.session.inspect_own_dispatch agent.session.send',
    ],
  ]);

  for (const [name, scope] of expected) {
    const fixture = positiveFixtures.fixtures.find((entry: any) => entry.name === name);
    assert.ok(fixture, `${name} fixture not found`);
    assert.equal(fixture.profile, 'direct_machine_access');
    assert.equal(fixture.claims.principal_type, 'agent');
    assert.equal(fixture.claims.aud, 'agent-session-messaging');
    assert.equal(fixture.claims.scope, scope);
    assert.equal(fixture.authorization_context.requested_scope, scope);
    assert.deepEqual(
      fixture.authorization_context.machine_access_grants['agent-session-messaging'],
      scope.split(' '),
    );
  }
});

test('negative fixtures fail closed when either independent scope is absent or malformed', () => {
  const expectedErrors = new Map([
    ['direct-session-inspection-missing-grant-rejected', 'INVALID_SCOPE_GRANT'],
    ['direct-session-send-only-grant-requesting-inspection-rejected', 'INVALID_SCOPE_GRANT'],
    ['direct-session-inspect-only-grant-requesting-send-rejected', 'INVALID_SCOPE_GRANT'],
    ['direct-session-inspection-unknown-scope-rejected', 'INVALID_SCOPE_NAMESPACE'],
    ['direct-session-inspection-alias-scope-rejected', 'INVALID_SCOPE_NAMESPACE'],
    ['direct-session-inspection-wildcard-scope-rejected', 'INVALID_SCOPE_WIRE'],
    ['direct-session-inspection-extra-scope-rejected', 'INVALID_SCOPE_NAMESPACE'],
    ['direct-session-inspection-wrong-namespace-rejected', 'INVALID_SCOPE_NAMESPACE'],
    ['direct-session-inspection-human-access-rejected', 'AUDIENCE_PROFILE_NOT_ACCEPTED'],
    ['direct-session-inspection-service-principal-rejected', 'AUDIENCE_PROFILE_NOT_ACCEPTED'],
    ['direct-session-inspection-obo-delegation-rejected', 'AUDIENCE_PROFILE_NOT_ACCEPTED'],
  ]);

  for (const [name, expectedError] of expectedErrors) {
    const fixture = negativeFixtures.cases.find((entry: any) => entry.name === name);
    assert.ok(fixture, `${name} fixture not found`);
    assert.equal(fixture.expected_error, expectedError);
  }
});
