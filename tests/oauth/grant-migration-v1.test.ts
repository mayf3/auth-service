import assert from 'node:assert/strict';
import test from 'node:test';
import type { V1AudienceDefinition } from '../../src/lib/oauth/v1/contract.js';
import { planV1GrantMigration } from '../../src/lib/oauth/v1/grant-migration.js';

const audiences: V1AudienceDefinition[] = [
  {
    audienceId: 'svc-workflow',
    resourceService: 'svc-workflow',
    scopeNamespace: 'workflow',
    acceptedPrincipalTypes: ['agent'],
    registeredScopes: ['workflow.execute', 'workflow.read'],
    humanAccessEnabled: false,
    machineAccessEnabled: true,
    delegatedAccessEnabled: true,
    status: 'active',
    freezeReady: true,
  },
  {
    audienceId: 'svc-okr',
    resourceService: 'svc-okr',
    scopeNamespace: 'okr',
    acceptedPrincipalTypes: ['user'],
    registeredScopes: [],
    humanAccessEnabled: true,
    machineAccessEnabled: false,
    delegatedAccessEnabled: false,
    status: 'active',
    freezeReady: true,
  },
];

const stored = audiences.map((audience) => ({
  ...audience,
  acceptedPrincipalTypes: [...audience.acceptedPrincipalTypes],
  registeredScopes: [...audience.registeredScopes],
  version: 1,
}));

test('plans one audience-scoped grant and keeps Legacy-only clients out of scope', () => {
  const plan = planV1GrantMigration(audiences, stored, [
    {
      id: 'one',
      clientId: 'client-one',
      allowedResources: ['svc-workflow', 'svc-forum'],
      allowedScopes: ['workflow.read', 'workflow.execute'],
      existingGrants: [],
    },
    {
      id: 'two',
      clientId: 'client-two',
      allowedResources: ['svc-forum'],
      allowedScopes: ['forum.read'],
      existingGrants: [],
    },
  ]);
  assert.deepEqual(plan.issues, []);
  assert.deepEqual(plan.skippedLegacyClientIds, ['client-two']);
  assert.deepEqual(plan.grantCreates, [{
    kind: 'machine_grant',
    machineClientId: 'one',
    clientId: 'client-one',
    audienceId: 'svc-workflow',
    scopes: ['workflow.execute', 'workflow.read'],
  }]);
});

test('refuses ambiguous resources before planning any grant writes', () => {
  const plan = planV1GrantMigration(audiences, stored, [{
    id: 'one',
    clientId: 'client-one',
    allowedResources: ['svc-workflow', 'svc-okr'],
    allowedScopes: ['workflow.read'],
    existingGrants: [],
  }]);
  assert.equal(plan.grantCreates.length, 0);
  assert.match(plan.issues[0], /ambiguous first-wave resources/);
});

test('refuses cross-audience or duplicate Legacy scopes', () => {
  const wrongScope = planV1GrantMigration(audiences, stored, [{
    id: 'one',
    clientId: 'client-one',
    allowedResources: ['svc-workflow'],
    allowedScopes: ['workflow.read', 'okr.read'],
    existingGrants: [],
  }]);
  assert.match(wrongScope.issues[0], /scopes outside svc-workflow/);

  const duplicate = planV1GrantMigration(audiences, stored, [{
    id: 'one',
    clientId: 'client-one',
    allowedResources: ['svc-workflow'],
    allowedScopes: ['workflow.read', 'workflow.read'],
    existingGrants: [],
  }]);
  assert.match(duplicate.issues[0], /duplicate Legacy scopes/);
});

test('is idempotent for an existing exact grant and rejects conflicting state', () => {
  const source = {
    id: 'one',
    clientId: 'client-one',
    allowedResources: ['svc-workflow'],
    allowedScopes: ['workflow.read'],
  };
  const exact = planV1GrantMigration(audiences, stored, [{
    ...source,
    existingGrants: [{ audienceId: 'svc-workflow', scopes: ['workflow.read'], version: 1 }],
  }]);
  assert.deepEqual(exact.issues, []);
  assert.equal(exact.grantCreates.length, 0);

  const conflict = planV1GrantMigration(audiences, stored, [{
    ...source,
    existingGrants: [{ audienceId: 'svc-workflow', scopes: ['workflow.execute'], version: 1 }],
  }]);
  assert.match(conflict.issues[0], /conflicting V1 grant/);
});

test('refuses a stored active audience that is not frozen in the registry', () => {
  const plan = planV1GrantMigration(audiences, [
    ...stored,
    {
      ...stored[0],
      audienceId: 'unexpected',
      resourceService: 'unexpected',
    },
  ], []);
  assert.match(plan.issues[0], /absent from frozen registry/);
});
