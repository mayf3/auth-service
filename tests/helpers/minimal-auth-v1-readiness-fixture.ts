import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mock } from 'node:test';
import { getV1AudienceDefinitions } from '../../src/lib/oauth/v1/contract.js';

export interface FixturePrincipal {
  id: string;
  principalType: 'agent' | 'service';
  agentId: string | null;
  ownerUserId: string | null;
}

export interface ReadinessScriptResult {
  stdout: string;
  markerLine: string;
  ready: boolean;
  exitCode: number | null | undefined;
  report: {
    contract_version: string;
    source_bundle_digest: string;
    audience_count: number;
    machine_principal_count: number;
    machine_client_count: number;
    machine_grant_count: number;
    trusted_proxy_count: number;
    human_grant_count: number;
    legacy_out_of_scope_client_count: number;
    issues: string[];
  };
}

function ensureRuntimeContractSnapshot(): void {
  const snapshot = path.resolve(
    process.cwd(),
    'generated',
    'minimal-auth-v1',
    'runtime-contract.json',
  );
  if (!fs.existsSync(snapshot)) {
    execFileSync('node', ['scripts/prepare-minimal-auth-v1.mjs'], { stdio: 'inherit' });
  }
}

// Runs the unmodified scripts/check-minimal-auth-v1-readiness.ts in-process with
// the Prisma singleton replaced by read-only fixture rows: the fake exposes only
// findMany readers and $disconnect, so any write attempt fails loudly and no
// database is ever contacted.
export async function runReadinessScriptWithPrincipals(
  principals: FixturePrincipal[],
): Promise<ReadinessScriptResult> {
  if (typeof (mock as { module?: unknown }).module !== 'function') {
    throw new Error(
      'node:test mock.module unavailable; run via '
      + '"node --experimental-test-module-mocks --import tsx --test <file>" (npm run test:v1-readiness)',
    );
  }
  ensureRuntimeContractSnapshot();
  const storedAudiences = getV1AudienceDefinitions().map((audience) => ({
    ...audience,
    version: 1,
  }));
  let resolveDisconnected: () => void = () => {};
  const disconnected = new Promise<void>((resolve) => { resolveDisconnected = resolve; });
  const findRows = (rows: unknown) => async () => rows;
  const fakePrisma = {
    authAudience: { findMany: findRows(storedAudiences) },
    machineClient: { findMany: findRows([]) },
    machinePrincipal: { findMany: findRows(principals) },
    machineAccessGrant: { findMany: findRows([]) },
    trustedProxy: { findMany: findRows([]) },
    humanAudienceGrant: { findMany: findRows([]) },
    $disconnect: async () => { resolveDisconnected(); },
  };
  mock.module('../../src/lib/prisma.js', { namedExports: { prisma: fakePrisma } });

  const chunks: string[] = [];
  const logs: string[] = [];
  let exitCodeAfterRun: number | string | null | undefined;
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalLog = console.log;
  const originalExitCode = process.exitCode;
  (process.stdout as { write: unknown }).write = (chunk: unknown): boolean => {
    chunks.push(String(chunk));
    return true;
  };
  console.log = (...parts: unknown[]) => { logs.push(parts.join(' ')); };
  try {
    await import('../../scripts/check-minimal-auth-v1-readiness.js');
    await disconnected;
    exitCodeAfterRun = process.exitCode;
  } finally {
    (process.stdout as { write: unknown }).write = originalWrite;
    console.log = originalLog;
    process.exitCode = originalExitCode;
    mock.restoreAll();
  }
  const stdout = chunks.join('') + logs.map((line) => `${line}\n`).join('');
  const markerLine = logs.find((line) => line.startsWith('MINIMAL_AUTH_V1_DATA_READY=')) ?? '';
  return {
    stdout,
    markerLine,
    ready: markerLine === 'MINIMAL_AUTH_V1_DATA_READY=true',
    exitCode: exitCodeAfterRun,
    report: JSON.parse(chunks.join('')),
  };
}
