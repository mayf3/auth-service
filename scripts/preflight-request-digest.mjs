#!/usr/bin/env node
/**
 * scripts/preflight-request-digest.mjs
 *
 * Read-only preflight check before applying migration
 * 20260721000300_add_request_digest.
 *
 * Reports the count of MachinePrincipal records that have:
 *   external_ref IS NOT NULL AND request_digest IS NULL
 *
 * If count > 0, the operator must resolve these records before
 * the CHECK constraint can be applied.
 *
 * EXIT CODES:
 *   0 — safe to apply migration (invalid_count = 0)
 *   1 — unsafe, resolve invalid records first
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [{ count: principalCount }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM machine_principals
    WHERE external_ref IS NOT NULL AND request_digest IS NULL
  `;

  const [{ count: clientCount }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM machine_clients
    WHERE external_ref IS NOT NULL AND request_digest IS NULL
  `;

  console.log(`PRE_CONSTRAINT_INVALID_ROW_COUNT_PRINCIPALS=${principalCount}`);
  console.log(`PRE_CONSTRAINT_INVALID_ROW_COUNT_CLIENTS=${clientCount}`);

  const total = principalCount + clientCount;
  if (total > 0) {
    console.log(`RESULT=BLOCKED`);
    console.log(`MESSAGE=Found ${total} record(s) with external_ref but no request_digest. Resolve before applying migration.`);
    process.exit(1);
  }

  console.log(`RESULT=PASS`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
