import type { V1AudienceDefinition } from './contract.js';

export interface StoredAudienceDefinition {
  audienceId: string;
  resourceService: string;
  scopeNamespace: string;
  acceptedPrincipalTypes: readonly string[];
  registeredScopes: readonly string[];
  humanAccessEnabled: boolean;
  machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean;
  status: string;
  freezeReady: boolean;
  version: number;
}

export interface StoredMachineGrant {
  audienceId: string;
  scopes: readonly string[];
  version: number;
}

export interface LegacyMachineClientGrantSource {
  id: string;
  clientId: string;
  allowedResources: readonly string[];
  allowedScopes: readonly string[];
  existingGrants: readonly StoredMachineGrant[];
}

export interface AudienceCreatePlan {
  kind: 'audience';
  audience: V1AudienceDefinition;
}

export interface MachineGrantCreatePlan {
  kind: 'machine_grant';
  machineClientId: string;
  clientId: string;
  audienceId: string;
  scopes: readonly string[];
}

export interface GrantMigrationPlan {
  audienceCreates: readonly AudienceCreatePlan[];
  grantCreates: readonly MachineGrantCreatePlan[];
  skippedLegacyClientIds: readonly string[];
  issues: readonly string[];
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (new Set(left).size !== left.length || new Set(right).size !== right.length) return false;
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

export function findV1AudienceMismatch(
  expected: V1AudienceDefinition,
  actual: StoredAudienceDefinition,
): string | null {
  const scalars: Array<[string, unknown, unknown]> = [
    ['resource_service', expected.resourceService, actual.resourceService],
    ['scope_namespace', expected.scopeNamespace, actual.scopeNamespace],
    ['human_access_enabled', expected.humanAccessEnabled, actual.humanAccessEnabled],
    ['machine_access_enabled', expected.machineAccessEnabled, actual.machineAccessEnabled],
    ['delegated_access_enabled', expected.delegatedAccessEnabled, actual.delegatedAccessEnabled],
    ['status', expected.status, actual.status],
    ['freeze_ready', expected.freezeReady, actual.freezeReady],
    ['version', 1, actual.version],
  ];
  const scalar = scalars.find(([, expectedValue, actualValue]) => expectedValue !== actualValue);
  if (scalar) return scalar[0];
  if (!sameSet(expected.acceptedPrincipalTypes, actual.acceptedPrincipalTypes)) {
    return 'accepted_principal_types';
  }
  if (!sameSet(expected.registeredScopes, actual.registeredScopes)) {
    return 'registered_scopes';
  }
  return null;
}

export function planV1GrantMigration(
  registry: readonly V1AudienceDefinition[],
  storedAudiences: readonly StoredAudienceDefinition[],
  clients: readonly LegacyMachineClientGrantSource[],
): GrantMigrationPlan {
  const issues: string[] = [];
  const registryById = new Map(registry.map((audience) => [audience.audienceId, audience]));
  const storedById = new Map(storedAudiences.map((audience) => [audience.audienceId, audience]));
  const audienceCreates: AudienceCreatePlan[] = [];
  const grantCreates: MachineGrantCreatePlan[] = [];
  const skippedLegacyClientIds: string[] = [];

  for (const audience of registry) {
    const stored = storedById.get(audience.audienceId);
    if (!stored) {
      audienceCreates.push({ kind: 'audience', audience });
      continue;
    }
    const mismatch = findV1AudienceMismatch(audience, stored);
    if (mismatch) {
      issues.push(`audience ${audience.audienceId} differs from frozen registry at ${mismatch}`);
    }
  }
  for (const stored of storedAudiences) {
    if (!registryById.has(stored.audienceId) && (stored.status === 'active' || stored.freezeReady)) {
      issues.push(`active/frozen audience ${stored.audienceId} is absent from frozen registry`);
    }
  }

  for (const client of clients) {
    const inScopeResources = sortedUnique(
      client.allowedResources.filter((resource) => registryById.has(resource)),
    );
    const inScopeExisting = client.existingGrants.filter(
      (grant) => registryById.has(grant.audienceId),
    );
    if (inScopeResources.length === 0) {
      if (inScopeExisting.length > 0) {
        issues.push(`client ${client.clientId} has V1 grants without a matching Legacy resource`);
      } else {
        skippedLegacyClientIds.push(client.clientId);
      }
      continue;
    }
    if (inScopeResources.length !== 1) {
      issues.push(`client ${client.clientId} has ambiguous first-wave resources: ${inScopeResources.join(',')}`);
      continue;
    }
    const audience = registryById.get(inScopeResources[0])!;
    if (!audience.machineAccessEnabled) {
      issues.push(`client ${client.clientId} targets non-machine audience ${audience.audienceId}`);
      continue;
    }
    if (client.allowedScopes.length === 0) {
      issues.push(`client ${client.clientId} has no scopes for ${audience.audienceId}`);
      continue;
    }
    if (new Set(client.allowedScopes).size !== client.allowedScopes.length) {
      issues.push(`client ${client.clientId} has duplicate Legacy scopes`);
      continue;
    }
    const scopes = sortedUnique(client.allowedScopes);
    const invalidScopes = scopes.filter((scope) => !audience.registeredScopes.includes(scope));
    if (invalidScopes.length > 0) {
      issues.push(
        `client ${client.clientId} has scopes outside ${audience.audienceId}: ${invalidScopes.join(',')}`,
      );
      continue;
    }
    const unrelatedGrant = inScopeExisting.find((grant) => grant.audienceId !== audience.audienceId);
    if (unrelatedGrant) {
      issues.push(`client ${client.clientId} has unrelated V1 grant ${unrelatedGrant.audienceId}`);
      continue;
    }
    const existing = inScopeExisting.find((grant) => grant.audienceId === audience.audienceId);
    if (existing) {
      if (existing.version !== 1 || !sameSet(existing.scopes, scopes)) {
        issues.push(`client ${client.clientId} has a conflicting V1 grant for ${audience.audienceId}`);
      }
      continue;
    }
    grantCreates.push({
      kind: 'machine_grant',
      machineClientId: client.id,
      clientId: client.clientId,
      audienceId: audience.audienceId,
      scopes,
    });
  }

  return {
    audienceCreates,
    grantCreates,
    skippedLegacyClientIds: skippedLegacyClientIds.sort(),
    issues: issues.sort(),
  };
}
