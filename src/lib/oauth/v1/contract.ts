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

export type V1PrincipalType = 'user' | 'agent' | 'service';

export interface V1AudienceDefinition {
  audienceId: string;
  resourceService: string;
  scopeNamespace: string;
  acceptedPrincipalTypes: readonly V1PrincipalType[];
  registeredScopes: readonly string[];
  humanAccessEnabled: boolean;
  machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean;
  status: 'candidate' | 'active' | 'disabled' | 'retired';
  freezeReady: boolean;
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

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Minimal Auth V1 audience registry has invalid ${field}.`);
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Minimal Auth V1 audience registry has invalid ${field}.`);
  }
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Minimal Auth V1 audience registry has invalid ${field}.`);
  }
  return [...value];
}

export function getV1AudienceDefinitions(): readonly V1AudienceDefinition[] {
  const registry = getV1RuntimeSnapshot().audienceRegistry;
  if (registry.status !== 'frozen' || !Array.isArray(registry.audiences)) {
    throw new Error('Minimal Auth V1 audience registry is not frozen or has no audiences.');
  }
  return registry.audiences.map((value, index) => {
    if (!value || typeof value !== 'object') {
      throw new Error(`Minimal Auth V1 audience registry entry ${index} is invalid.`);
    }
    const entry = value as Record<string, unknown>;
    const acceptedPrincipalTypes = stringArray(
      entry.accepted_principal_types,
      'accepted_principal_types',
    );
    if (acceptedPrincipalTypes.some(
      (item) => !['user', 'agent', 'service'].includes(item),
    )) {
      throw new Error('Minimal Auth V1 audience registry has an invalid principal type.');
    }
    const status = requiredString(entry.status, 'status');
    if (!['candidate', 'active', 'disabled', 'retired'].includes(status)) {
      throw new Error('Minimal Auth V1 audience registry has an invalid status.');
    }
    return {
      audienceId: requiredString(entry.audience_id, 'audience_id'),
      resourceService: requiredString(entry.resource_service, 'resource_service'),
      scopeNamespace: requiredString(entry.scope_namespace, 'scope_namespace'),
      acceptedPrincipalTypes: acceptedPrincipalTypes as V1PrincipalType[],
      registeredScopes: stringArray(entry.registered_scopes, 'registered_scopes'),
      humanAccessEnabled: requiredBoolean(entry.human_access_enabled, 'human_access_enabled'),
      machineAccessEnabled: requiredBoolean(entry.machine_access_enabled, 'machine_access_enabled'),
      delegatedAccessEnabled: requiredBoolean(
        entry.delegated_access_enabled,
        'delegated_access_enabled',
      ),
      status: status as V1AudienceDefinition['status'],
      freezeReady: requiredBoolean(entry.freeze_ready, 'freeze_ready'),
    };
  });
}

export function resetAuthContractForTests(): void {
  cached = null;
}
