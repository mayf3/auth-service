import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import {
  getV1AudienceDefinitions,
  initializeAuthContract,
} from '../src/lib/oauth/v1/contract.js';
import { planV1GrantMigration } from '../src/lib/oauth/v1/grant-migration.js';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

async function loadPlan(db: DatabaseClient) {
  const [storedAudiences, clients] = await Promise.all([
    db.authAudience.findMany({ orderBy: { audienceId: 'asc' } }),
    db.machineClient.findMany({
      orderBy: { clientId: 'asc' },
      include: {
        accessGrants: {
          orderBy: { audienceId: 'asc' },
          select: { audienceId: true, scopes: true, version: true },
        },
      },
    }),
  ]);
  return planV1GrantMigration(
    getV1AudienceDefinitions(),
    storedAudiences,
    clients.map((client) => ({
      id: client.id,
      clientId: client.clientId,
      allowedResources: client.allowedResources,
      allowedScopes: client.allowedScopes,
      existingGrants: client.accessGrants,
    })),
  );
}

function report(plan: Awaited<ReturnType<typeof loadPlan>>, apply: boolean) {
  return {
    contract_mode: 'v1',
    operation: apply ? 'apply' : 'plan',
    audience_creates: plan.audienceCreates.map(({ audience }) => audience.audienceId),
    machine_grant_creates: plan.grantCreates.map((grant) => ({
      client_id: grant.clientId,
      audience_id: grant.audienceId,
      scopes: grant.scopes,
    })),
    legacy_out_of_scope_clients: plan.skippedLegacyClientIds,
    issues: plan.issues,
  };
}

interface ChangeMetadata {
  migrationId: string;
  sourceGitCommit: string;
  operatorId: string;
  approvalRef: string;
  reason: string;
}

async function applyPlan(metadata: ChangeMetadata) {
  return prisma.$transaction(async (tx) => {
    const plan = await loadPlan(tx);
    if (plan.issues.length > 0) {
      throw new Error(`V1 grant migration refused before writes: ${plan.issues.join('; ')}`);
    }

    for (const { audience } of plan.audienceCreates) {
      const afterState = {
        audience_id: audience.audienceId,
        resource_service: audience.resourceService,
        scope_namespace: audience.scopeNamespace,
        accepted_principal_types: [...audience.acceptedPrincipalTypes],
        registered_scopes: [...audience.registeredScopes],
        human_access_enabled: audience.humanAccessEnabled,
        machine_access_enabled: audience.machineAccessEnabled,
        delegated_access_enabled: audience.delegatedAccessEnabled,
        status: audience.status,
        freeze_ready: audience.freezeReady,
        version: 1,
      };
      await tx.authAudience.create({
        data: {
          audienceId: audience.audienceId,
          resourceService: audience.resourceService,
          scopeNamespace: audience.scopeNamespace,
          acceptedPrincipalTypes: [...audience.acceptedPrincipalTypes],
          registeredScopes: [...audience.registeredScopes],
          humanAccessEnabled: audience.humanAccessEnabled,
          machineAccessEnabled: audience.machineAccessEnabled,
          delegatedAccessEnabled: audience.delegatedAccessEnabled,
          status: audience.status,
          freezeReady: audience.freezeReady,
          version: 1,
        },
      });
      await tx.authSecurityAudit.create({
        data: {
          eventType: 'audience.registered',
          result: 'success',
          requestCorrelationId: metadata.migrationId,
          details: {
            migration_id: metadata.migrationId,
            source_git_commit: metadata.sourceGitCommit,
            operator_id: metadata.operatorId,
            approval_ref: metadata.approvalRef,
            reason: metadata.reason,
            after_value: afterState,
          },
        },
      });
    }

    for (const grant of plan.grantCreates) {
      await tx.machineAccessGrant.create({
        data: {
          machineClientId: grant.machineClientId,
          audienceId: grant.audienceId,
          scopes: [...grant.scopes],
          version: 1,
        },
      });
      const client = await tx.machineClient.findUniqueOrThrow({
        where: { id: grant.machineClientId },
        include: { principal: true, accessGrants: { orderBy: { audienceId: 'asc' } } },
      });
      const machineAccessGrants = Object.fromEntries(
        client.accessGrants.map((item) => [item.audienceId, [...item.scopes].sort()]),
      );
      const afterValue = {
        client_id: client.clientId,
        client_kind: 'machine',
        principal_id: client.machinePrincipalId,
        principal_type: client.principal.principalType,
        human_audience_grants: [],
        machine_access_grants: machineAccessGrants,
        delegation_grants: {},
        status: client.status,
        version: Math.max(...client.accessGrants.map((item) => item.version)),
      };
      await tx.grantChangeAudit.create({
        data: {
          migrationId: metadata.migrationId,
          sourceGitCommit: metadata.sourceGitCommit,
          operatorId: metadata.operatorId,
          approvalRef: metadata.approvalRef,
          reason: metadata.reason,
          clientId: client.clientId,
          changeType: 'create',
          expectedGrantVersion: null,
          resultingGrantVersion: afterValue.version,
          beforeValue: undefined,
          afterValue,
        },
      });
    }
    return plan;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function main() {
  initializeAuthContract('v1');
  const apply = process.argv.slice(2).includes('--apply');
  const initialPlan = await loadPlan(prisma);
  process.stdout.write(`${JSON.stringify(report(initialPlan, apply), null, 2)}\n`);
  if (initialPlan.issues.length > 0) {
    throw new Error('V1 grant migration has unresolved ambiguity; no writes were performed.');
  }
  if (!apply) {
    console.log('MINIMAL_AUTH_V1_BACKFILL_APPLIED=false');
    return;
  }
  const metadata = {
    migrationId: process.env.MINIMAL_AUTH_V1_MIGRATION_ID ?? '',
    sourceGitCommit: process.env.MINIMAL_AUTH_V1_SOURCE_GIT_COMMIT ?? '',
    operatorId: process.env.MINIMAL_AUTH_V1_OPERATOR_ID ?? '',
    approvalRef: process.env.MINIMAL_AUTH_V1_APPROVAL_REF ?? '',
    reason: process.env.MINIMAL_AUTH_V1_CHANGE_REASON ?? '',
  };
  if (!metadata.migrationId || !/^[0-9a-f]{40}$/.test(metadata.sourceGitCommit)
    || !metadata.operatorId || !metadata.approvalRef
    || metadata.reason.length < 1 || metadata.reason.length > 512) {
    throw new Error(
      '--apply requires migration ID, exact source Git commit, operator, approval ref, and reason.',
    );
  }
  const applied = await applyPlan(metadata);
  console.log(`MINIMAL_AUTH_V1_AUDIENCES_CREATED=${applied.audienceCreates.length}`);
  console.log(`MINIMAL_AUTH_V1_MACHINE_GRANTS_CREATED=${applied.grantCreates.length}`);
  console.log('MINIMAL_AUTH_V1_BACKFILL_APPLIED=true');
}

main()
  .catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
