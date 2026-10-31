/** Governed, explicit named-client migration vehicle. Source only in #94.
 * Provision AND revoke need a separately attributable existing-Owner instruction.
 * No dotenv, guessed identity, direct SQL allowlist or online management API.
 * Never automatically retry an unknown commit outcome: reconcile migrationId.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { initializeAuthContract } from '../src/lib/oauth/v1/contract.js';
import { applyExecutionHistoryAuditInstruction, executionHistoryAuditInstructionSchema } from '../src/lib/oauth/v1/execution-history-grant.js';

export async function main(args = process.argv.slice(2)): Promise<void> {
  // Guard before reading instruction or opening any database connection.
  if (process.env.EXECUTION_HISTORY_GRANT_APPLY !== 'YES' || args.length !== 2 || args[0] !== '--instruction') {
    throw new Error('explicit_owner_instruction_and_apply_gate_required');
  }
  const input = executionHistoryAuditInstructionSchema.parse(JSON.parse(readFileSync(args[1], 'utf8')));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== input.sourceGitCommit
    || execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
    throw new Error('clean_exact_source_head_required');
  }
  initializeAuthContract('v1');
  const db = new PrismaClient();
  try {
    const result = await applyExecutionHistoryAuditInstruction(db, input);
    process.stdout.write(`${JSON.stringify({ migrationId: input.migrationId, ...result })}\n`);
  } finally { await db.$disconnect(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Do not print parser values, arbitrary DB diagnostics or instruction text.
    process.stderr.write('execution_history_grant_failed; reconcile by migrationId before retry\n');
    process.exitCode = 1;
  });
}
