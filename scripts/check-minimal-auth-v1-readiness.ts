import { prisma } from '../src/lib/prisma.js';
import {
  getV1AudienceDefinitions,
  initializeAuthContract,
} from '../src/lib/oauth/v1/contract.js';
import { planV1GrantMigration } from '../src/lib/oauth/v1/grant-migration.js';

async function main() {
  const identity = initializeAuthContract('v1');
  const registry = getV1AudienceDefinitions();
  const registryById = new Map(registry.map((audience) => [audience.audienceId, audience]));
  const [storedAudiences, clients, principals, grants, proxies, humanGrants] = await Promise.all([
    prisma.authAudience.findMany({ orderBy: { audienceId: 'asc' } }),
    prisma.machineClient.findMany({
      orderBy: { clientId: 'asc' },
      include: {
        accessGrants: {
          orderBy: { audienceId: 'asc' },
          select: { audienceId: true, scopes: true, version: true },
        },
      },
    }),
    prisma.machinePrincipal.findMany({ orderBy: { id: 'asc' } }),
    prisma.machineAccessGrant.findMany({
      orderBy: [{ machineClientId: 'asc' }, { audienceId: 'asc' }],
      include: { machineClient: { include: { principal: true } } },
    }),
    prisma.trustedProxy.findMany({
      orderBy: { id: 'asc' },
      include: {
        proxyPrincipal: true,
        proxyClient: true,
        acceptedAudiences: true,
        delegationGrants: true,
      },
    }),
    prisma.humanAudienceGrant.findMany({
      orderBy: [{ humanClientId: 'asc' }, { audienceId: 'asc' }],
      include: { humanClient: true },
    }),
  ]);

  const migrationPlan = planV1GrantMigration(
    registry,
    storedAudiences,
    clients.map((client) => ({
      id: client.id,
      clientId: client.clientId,
      allowedResources: client.allowedResources,
      allowedScopes: client.allowedScopes,
      existingGrants: client.accessGrants,
    })),
  );
  const issues = [...migrationPlan.issues];
  for (const item of migrationPlan.audienceCreates) {
    issues.push(`frozen audience ${item.audience.audienceId} is not registered in the database`);
  }
  for (const item of migrationPlan.grantCreates) {
    issues.push(`client ${item.clientId} has no V1 grant for ${item.audienceId}`);
  }

  for (const principal of principals) {
    if (principal.principalType === 'agent' && (!principal.agentId || !principal.ownerUserId)) {
      issues.push(`Agent principal ${principal.id} has an incomplete Agent profile`);
    }
    if (principal.principalType === 'service' && principal.agentId !== null) {
      issues.push(`Service principal ${principal.id} carries an Agent ID`);
    }
  }

  for (const grant of grants) {
    const audience = registryById.get(grant.audienceId);
    const principal = grant.machineClient.principal;
    if (!audience || !audience.machineAccessEnabled) {
      issues.push(`machine grant ${grant.machineClientId}:${grant.audienceId} targets an invalid audience`);
      continue;
    }
    if (grant.scopes.length === 0
      || new Set(grant.scopes).size !== grant.scopes.length
      || grant.scopes.some((scope) => !audience.registeredScopes.includes(scope))) {
      issues.push(`machine grant ${grant.machineClientId}:${grant.audienceId} has invalid scopes`);
    }
    if (!audience.acceptedPrincipalTypes.includes(principal.principalType)) {
      issues.push(
        `machine grant ${grant.machineClientId}:${grant.audienceId} rejects principal type ${principal.principalType}`,
      );
    }
  }

  for (const proxy of proxies) {
    if (proxy.proxyPrincipal.principalType !== 'service' || proxy.proxyPrincipal.agentId !== null) {
      issues.push(`trusted proxy ${proxy.id} does not use a Service principal`);
    }
    if (proxy.proxyClient.machinePrincipalId !== proxy.proxyPrincipalId) {
      issues.push(`trusted proxy ${proxy.id} client does not belong to its Service principal`);
    }
    if (proxy.status === 'active'
      && (proxy.proxyClient.status !== 'active' || proxy.proxyPrincipal.status !== 'active')) {
      issues.push(`trusted proxy ${proxy.id} is active while its principal or client is inactive`);
    }
    for (const accepted of proxy.acceptedAudiences) {
      const audience = registryById.get(accepted.audienceId);
      if (!audience || !audience.machineAccessEnabled) {
        issues.push(`trusted proxy ${proxy.id} accepts invalid source audience ${accepted.audienceId}`);
      }
    }
    for (const delegation of proxy.delegationGrants) {
      const audience = registryById.get(delegation.audienceId);
      if (!audience || !audience.delegatedAccessEnabled) {
        issues.push(`trusted proxy ${proxy.id} delegates to invalid audience ${delegation.audienceId}`);
        continue;
      }
      if (delegation.scopes.length === 0
        || new Set(delegation.scopes).size !== delegation.scopes.length
        || delegation.scopes.some((scope) => !audience.registeredScopes.includes(scope))) {
        issues.push(`trusted proxy ${proxy.id} has invalid delegation scopes for ${delegation.audienceId}`);
      }
    }
  }

  for (const grant of humanGrants) {
    const audience = registryById.get(grant.audienceId);
    if (!audience || !audience.humanAccessEnabled) {
      issues.push(`human client ${grant.humanClient.clientId} has invalid audience ${grant.audienceId}`);
    }
  }

  const uniqueIssues = [...new Set(issues)].sort();
  process.stdout.write(`${JSON.stringify({
    contract_version: identity.contractVersion,
    source_bundle_digest: identity.sourceBundleDigest,
    audience_count: storedAudiences.length,
    machine_principal_count: principals.length,
    machine_client_count: clients.length,
    machine_grant_count: grants.length,
    trusted_proxy_count: proxies.length,
    human_grant_count: humanGrants.length,
    legacy_out_of_scope_client_count: migrationPlan.skippedLegacyClientIds.length,
    issues: uniqueIssues,
  }, null, 2)}\n`);
  if (uniqueIssues.length > 0) {
    console.log('MINIMAL_AUTH_V1_DATA_READY=false');
    process.exitCode = 1;
  } else {
    console.log('MINIMAL_AUTH_V1_DATA_READY=true');
  }
}

main()
  .catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
