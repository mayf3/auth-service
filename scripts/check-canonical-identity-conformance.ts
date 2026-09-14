/** Metadata-only Auth foundation report. This command never enrolls or repairs. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
export async function checkCanonicalIdentityConformance(db: PrismaClient) {
  const observations = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'");
    const counts = await tx.$queryRaw<Array<{
      state: string;
      count: bigint;
    }>> `SELECT state::text, count(*) FROM agent_identity_lifecycle GROUP BY state ORDER BY state`;
    const [invariants] = await tx.$queryRaw<Array<{
      invalidLifecycle: bigint;
      brokenEdges: bigint;
      unclassified: bigint;
    }>> `
 SELECT
 (SELECT count(*) FROM agent_identity_lifecycle l JOIN machine_principals p ON p.id=l.principal_id
  WHERE p.principal_type::text<>'agent' OR (l.state='canonical' AND
   (p.status::text<>'active' OR p.agent_id IS NULL OR length(p.agent_id) NOT BETWEEN 5 AND 128 OR p.agent_id !~ '^agt_[a-z0-9-]+$'))) AS "invalidLifecycle",
 (SELECT count(*) FROM agent_identity_successors e
  LEFT JOIN agent_identity_lifecycle s ON s.principal_id=e.source_principal_id
  LEFT JOIN agent_identity_lifecycle t ON t.principal_id=e.target_principal_id
  WHERE s.state IS NULL OR s.state NOT IN ('legacy','retired') OR t.state IS NULL OR t.state<>'canonical'
   OR e.source_principal_id=e.target_principal_id
   OR EXISTS(SELECT 1 FROM agent_identity_successors x WHERE x.source_principal_id=e.target_principal_id)) AS "brokenEdges",
 (SELECT count(*) FROM machine_principals p LEFT JOIN agent_identity_lifecycle l ON l.principal_id=p.id
  WHERE p.principal_type::text='agent' AND l.principal_id IS NULL) AS unclassified`;
    return { lifecycleCounts: Object.fromEntries(counts.map(r => [r.state, r.count.toString()])), invalidLifecycle: invariants.invalidLifecycle.toString(), brokenEdges: invariants.brokenEdges.toString(), unclassified: invariants.unclassified.toString() };
  }, { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 5000 });
  const files = ['src/lib/oauth/v1/canonical-identity.ts', 'scripts/check-canonical-identity-conformance.ts', 'prisma/schema.prisma', 'prisma/migrations/202609140001_canonical_identity_foundation/migration.sql'];
  return { scope: 'AUTH_FOUNDATION', observedAt: new Date().toISOString(), codeRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), schemaRevision: createHash('sha256').update(readFileSync(files[3])).digest('hex'), sourceDigests: Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')])), ...observations, localInvariantResult: observations.invalidLifecycle === '0' && observations.brokenEdges === '0' ? 'PASS' : 'FAIL', STRICT_WRITE_DEPLOYED: false, GLOBAL_CENSUS_COMPLETE: false, CoreState: 'UNKNOWN', consumerState: 'UNKNOWN', existingResolverCompatibility: 'LIVE', removalCondition: 'all consumers migrated and independently proven LIVE_CONSUMER_COUNT=0' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = new PrismaClient();
  try {
    const report = await checkCanonicalIdentityConformance(db);
    console.log(JSON.stringify(report));
    if (report.localInvariantResult !== 'PASS')
      process.exitCode = 1;
  }
  catch {
    console.log(JSON.stringify({ scope: 'AUTH_FOUNDATION', observedAt: new Date().toISOString(), error: { code: 'IDENTITY_READ_UNAVAILABLE', status: 503 }, STRICT_WRITE_DEPLOYED: false, GLOBAL_CENSUS_COMPLETE: false }));
    process.exitCode = 1;
  }
  finally {
    await db.$disconnect();
  }
}
