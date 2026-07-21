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

export interface V1ContractSettings {
  exactIssuer: string;
  tokenVersion: string;
  signingAlgorithm: 'RS256';
  jwksPath: string;
  jwksCacheTtlSeconds: number;
  clockSkewToleranceSeconds: number;
  humanAccessTtlSeconds: number;
  machineAccessTtlSeconds: number;
  oboAccessTtlSeconds: number;
  humanSessionAbsoluteTtlSeconds: number;
  refreshCredentialTtlSeconds: number;
  authorizationTransactionTtlSeconds: number;
  authorizationCodeTtlSeconds: number;
  refreshVerifier: {
    parametersVersion: string;
    N: number;
    r: number;
    p: number;
    keyLengthBytes: number;
    saltLengthBytes: number;
  };
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
  if (parsed.payload.formatVersion !== 1 || !['1.0.0', '1.1.0', '1.2.0'].includes(parsed.payload.contractVersion)) {
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

function requiredInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`Minimal Auth V1 runtime manifest has invalid ${field}.`);
  }
  return value as number;
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

export function getV1ContractSettings(): Readonly<V1ContractSettings> {
  const manifest = getV1RuntimeSnapshot().manifest;
  const signing = manifest.signing as Record<string, unknown> | undefined;
  const timing = manifest.timing as Record<string, unknown> | undefined;
  const humanLogin = manifest.human_login as Record<string, unknown> | undefined;
  const refreshVerifier = manifest.refresh_verifier as Record<string, unknown> | undefined;
  const verifierParameters = refreshVerifier?.parameters as Record<string, unknown> | undefined;
  if (!signing || !timing || !humanLogin || !refreshVerifier || !verifierParameters
    || signing.algorithm !== 'RS256' || refreshVerifier.algorithm !== 'scrypt') {
    throw new Error('Minimal Auth V1 runtime manifest has invalid signing or timing settings.');
  }
  return {
    exactIssuer: requiredString(manifest.exact_issuer, 'exact_issuer'),
    tokenVersion: requiredString(manifest.token_version, 'token_version'),
    signingAlgorithm: 'RS256',
    jwksPath: requiredString(signing.jwks_path, 'jwks_path'),
    jwksCacheTtlSeconds: requiredInteger(
      signing.jwks_cache_ttl_seconds,
      'jwks_cache_ttl_seconds',
    ),
    clockSkewToleranceSeconds: requiredInteger(
      timing.clock_skew_tolerance_seconds,
      'clock_skew_tolerance_seconds',
    ),
    humanAccessTtlSeconds: requiredInteger(
      timing.human_access_ttl_seconds,
      'human_access_ttl_seconds',
    ),
    machineAccessTtlSeconds: requiredInteger(
      timing.machine_access_ttl_seconds,
      'machine_access_ttl_seconds',
    ),
    oboAccessTtlSeconds: requiredInteger(
      timing.obo_access_ttl_seconds,
      'obo_access_ttl_seconds',
    ),
    humanSessionAbsoluteTtlSeconds: requiredInteger(
      timing.human_session_absolute_ttl_seconds,
      'human_session_absolute_ttl_seconds',
    ),
    refreshCredentialTtlSeconds: requiredInteger(
      timing.refresh_credential_ttl_seconds,
      'refresh_credential_ttl_seconds',
    ),
    authorizationTransactionTtlSeconds: requiredInteger(
      humanLogin.authorization_transaction_ttl_seconds,
      'authorization_transaction_ttl_seconds',
    ),
    authorizationCodeTtlSeconds: requiredInteger(
      humanLogin.authorization_code_ttl_seconds,
      'authorization_code_ttl_seconds',
    ),
    refreshVerifier: {
      parametersVersion: requiredString(
        refreshVerifier.parameters_version,
        'refresh_verifier.parameters_version',
      ),
      N: requiredInteger(verifierParameters.N, 'refresh_verifier.parameters.N'),
      r: requiredInteger(verifierParameters.r, 'refresh_verifier.parameters.r'),
      p: requiredInteger(verifierParameters.p, 'refresh_verifier.parameters.p'),
      keyLengthBytes: requiredInteger(
        verifierParameters.key_length_bytes,
        'refresh_verifier.parameters.key_length_bytes',
      ),
      saltLengthBytes: requiredInteger(
        verifierParameters.salt_length_bytes,
        'refresh_verifier.parameters.salt_length_bytes',
      ),
    },
  };
}

export function resetAuthContractForTests(): void {
  cached = null;
}
