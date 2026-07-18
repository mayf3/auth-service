import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AuthContractMode = 'v0' | 'v1_shadow' | 'v1';

interface RuntimeSnapshotPayload {
  formatVersion: number;
  contractVersion: string;
  reviewedSourceGitCommit: string;
  sourceBundleDigest: string;
  manifest: Record<string, unknown>;
  audienceRegistry: Record<string, unknown>;
}

interface RuntimeSnapshot {
  payload: RuntimeSnapshotPayload;
  runtimeDigest: string;
}

function asRuntimeSnapshot(value: unknown): RuntimeSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Minimal Auth V1 runtime snapshot has an invalid shape.');
  }
  return value as RuntimeSnapshot;
}

export interface AuthContractIdentity {
  mode: AuthContractMode;
  contractVersion: string | null;
  sourceBundleDigest: string | null;
  runtimeDigest: string | null;
}

let cached: RuntimeSnapshot | null = null;

function snapshotPath(): string {
  return path.resolve(process.cwd(), 'generated', 'minimal-auth-v1', 'runtime-contract.json');
}

function loadSnapshot(): RuntimeSnapshot {
  if (cached) return cached;
  const file = snapshotPath();
  let parsed: RuntimeSnapshot;
  try {
    parsed = asRuntimeSnapshot(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    throw new Error(`Minimal Auth V1 runtime snapshot unavailable: ${(error as Error).message}`);
  }
  verifyRuntimeSnapshot(parsed);
  cached = parsed;
  return parsed;
}

export function verifyRuntimeSnapshot(value: unknown): RuntimeSnapshotPayload {
  const parsed = asRuntimeSnapshot(value);
  const actual = crypto.createHash('sha256')
    .update(JSON.stringify(parsed.payload))
    .digest('hex');
  if (actual !== parsed.runtimeDigest) {
    throw new Error('Minimal Auth V1 runtime snapshot digest mismatch.');
  }
  if (parsed.payload.formatVersion !== 1 || parsed.payload.contractVersion !== '1.0.0') {
    throw new Error('Minimal Auth V1 runtime snapshot version is unsupported.');
  }
  const freeze = (parsed.payload.manifest.lifecycle as Record<string, unknown> | undefined)
    ?.contract_bundle_freeze as Record<string, unknown> | undefined;
  if (freeze?.status !== 'frozen' || freeze.frozen !== true
    || freeze.implementation_authorized !== true) {
    throw new Error('Minimal Auth V1 runtime snapshot is not frozen and implementation-authorized.');
  }
  return parsed.payload;
}

export function initializeAuthContract(mode: AuthContractMode): AuthContractIdentity {
  if (mode === 'v0') {
    return {
      mode,
      contractVersion: null,
      sourceBundleDigest: null,
      runtimeDigest: null,
    };
  }
  const snapshot = loadSnapshot();
  return {
    mode,
    contractVersion: snapshot.payload.contractVersion,
    sourceBundleDigest: snapshot.payload.sourceBundleDigest,
    runtimeDigest: snapshot.runtimeDigest,
  };
}

export function getV1RuntimeSnapshot(): Readonly<RuntimeSnapshotPayload> {
  return loadSnapshot().payload;
}

export function resetAuthContractForTests(): void {
  cached = null;
}
