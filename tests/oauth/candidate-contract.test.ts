import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCandidateSnapshot } from '../helpers/load-candidate-snapshot.js';

const snapshot = loadCandidateSnapshot();

test('Candidate contract version is 1.7.0', () => {
  assert.equal(snapshot.contractVersion, '1.7.0');
});

test('Candidate registry status reflects frozen bundle', () => {
  assert.equal(snapshot.registryStatus, 'frozen');
});

test('Candidate snapshot has valid source bundle digest', () => {
  assert.match(snapshot.sourceBundleDigest, /^[0-9a-f]{64}$/);
});

test('Candidate snapshot has valid runtime digest', () => {
  assert.match(snapshot.runtimeDigest, /^[0-9a-f]{64}$/);
});

// ── svc-okr Audience Structure ──

const svcOkrAudience = snapshot.audienceDefinitions.find(
  (a) => a.audienceId === 'svc-okr',
);

test('svc-okr audience is present in candidate', () => {
  assert.ok(svcOkrAudience, 'svc-okr audience not found in candidate snapshot');
});

test('svc-okr has machine_access_enabled=true', () => {
  assert.equal(svcOkrAudience!.machineAccessEnabled, true);
});

test('svc-okr has human_access_enabled=true', () => {
  assert.equal(svcOkrAudience!.humanAccessEnabled, true);
});

test('svc-okr accepted_principal_types includes user and agent', () => {
  assert.ok(svcOkrAudience!.acceptedPrincipalTypes.includes('user'));
  assert.ok(svcOkrAudience!.acceptedPrincipalTypes.includes('agent'));
});

test('svc-okr accepted_principal_types does NOT include service', () => {
  assert.ok(!svcOkrAudience!.acceptedPrincipalTypes.includes('service'));
});

test('svc-okr registered_scopes contains okr.read', () => {
  assert.ok(svcOkrAudience!.registeredScopes.includes('okr.read'));
});

test('svc-okr registered_scopes contains okr.write', () => {
  assert.ok(svcOkrAudience!.registeredScopes.includes('okr.write'));
});

test('svc-okr registered_scopes does NOT contain okr.admin', () => {
  assert.ok(!svcOkrAudience!.registeredScopes.includes('okr.admin'));
});

test('svc-okr registered_scopes does NOT contain adc.read', () => {
  assert.ok(!svcOkrAudience!.registeredScopes.includes('adc.read'));
});

// ── svc-workflow unchanged ──

const workflowAudience = snapshot.audienceDefinitions.find(
  (a) => a.audienceId === 'svc-workflow',
);

test('svc-workflow audience is present in candidate', () => {
  assert.ok(workflowAudience);
});

test('svc-workflow machine_access_enabled remains true', () => {
  assert.equal(workflowAudience!.machineAccessEnabled, true);
});

test('svc-workflow accepted_principal_types remains agent-only', () => {
  assert.deepEqual([...workflowAudience!.acceptedPrincipalTypes], ['agent']);
});

// ── adc-v2 unchanged ──

const adcAudience = snapshot.audienceDefinitions.find(
  (a) => a.audienceId === 'adc-v2',
);

test('adc-v2 audience is present in candidate', () => {
  assert.ok(adcAudience);
});

test('adc-v2 machine_access_enabled remains true', () => {
  assert.equal(adcAudience!.machineAccessEnabled, true);
});

// ── Fixture claims verify no product role ──

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const positiveFixtures = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'contract-bundles', 'minimal-auth-v1', 'fixtures', 'positive-token-fixtures.json'),
    'utf8',
  ),
);

test('direct-agent-svc-okr fixture exists', () => {
  const fixture = positiveFixtures.fixtures.find(
    (f: any) => f.name === 'direct-agent-svc-okr',
  );
  assert.ok(fixture, 'direct-agent-svc-okr fixture not found');
  assert.equal(fixture.claims.principal_type, 'agent');
  assert.equal(fixture.claims.scope, 'okr.read');
  assert.equal(fixture.claims.aud, 'svc-okr');
});

test('direct-agent-svc-okr fixture has no product_role claim', () => {
  const fixture = positiveFixtures.fixtures.find(
    (f: any) => f.name === 'direct-agent-svc-okr',
  );
  assert.ok(fixture);
  assert.equal(fixture.claims.product_role, undefined,
    'direct-agent-svc-okr fixture must not contain product_role');
});

test('direct-agent-svc-okr fixture has no okr.write in authorization_context', () => {
  const fixture = positiveFixtures.fixtures.find(
    (f: any) => f.name === 'direct-agent-svc-okr',
  );
  assert.ok(fixture);
  const grants = fixture.authorization_context?.machine_access_grants?.['svc-okr'];
  assert.ok(Array.isArray(grants));
  assert.ok(!grants.includes('okr.write'));
  assert.ok(!grants.includes('okr.admin'));
});

// ── Negative fixtures reference valid base ──

const negativeFixtures = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'contract-bundles', 'minimal-auth-v1', 'fixtures', 'negative-token-fixtures.json'),
    'utf8',
  ),
);

test('svc-okr negative fixtures reference valid base fixture', () => {
  const svcOkrCases = negativeFixtures.cases.filter(
    (c: any) => c.base_fixture === 'direct-agent-svc-okr',
  );
  assert.equal(svcOkrCases.length, 4, 'expected 4 svc-okr negative cases');
  for (const c of svcOkrCases) {
    const base = positiveFixtures.fixtures.find(
      (f: any) => f.name === c.base_fixture,
    );
    assert.ok(base, `negative case "${c.name}" references unknown base fixture`);
  }
});
