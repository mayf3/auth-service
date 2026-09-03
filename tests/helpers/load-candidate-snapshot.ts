/**
 * load-candidate-snapshot.ts — Test-only Candidate Runtime Snapshot Loader
 *
 * Reads a Draft Contract Bundle runtime snapshot from the candidate output
 * directory, validates its digest and version, and provides access to the
 * audience definitions and contract settings.
 *
 * This is a TEST-ONLY module. It is never imported by production code.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface V1AudienceDefinition {
  audienceId: string;
  resourceService: string;
  scopeNamespace: string;
  acceptedPrincipalTypes: readonly ('user' | 'agent' | 'service')[];
  registeredScopes: readonly string[];
  humanAccessEnabled: boolean;
  machineAccessEnabled: boolean;
  delegatedAccessEnabled: boolean;
  status: 'candidate' | 'active' | 'disabled' | 'retired';
  freezeReady: boolean;
}

export interface CandidateSnapshotPayload {
  formatVersion: number;
  contractVersion: string;
  reviewedSourceGitCommit: string | null;
  sourceBundleDigest: string;
  manifest: Record<string, unknown>;
  audienceRegistry: Record<string, unknown>;
}

export interface CandidateSnapshotResult {
  contractVersion: string;
  sourceBundleDigest: string;
  runtimeDigest: string;
  audienceDefinitions: readonly V1AudienceDefinition[];
  registryStatus: string;
}

const CANDIDATE_SNAPSHOT_PATH = path.resolve(
  process.cwd(),
  'generated',
  'candidate-snapshots',
  'minimal-auth-v1',
  'runtime-contract.json',
);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Candidate snapshot has invalid ${field}.`);
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Candidate snapshot has invalid ${field}.`);
  }
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Candidate snapshot has invalid ${field}.`);
  }
  return [...value];
}

function asSnapshot(value: unknown): { payload: CandidateSnapshotPayload; runtimeDigest: string } {
  if (!value || typeof value !== 'object') {
    throw new Error('Candidate runtime snapshot has an invalid shape.');
  }
  return value as { payload: CandidateSnapshotPayload; runtimeDigest: string };
}

/**
 * Parse candidate audience definitions from the snapshot's audience registry.
 * This is a test-side reimplementation that does NOT require registry.status === 'frozen'.
 */
function parseAudienceDefinitions(registry: Record<string, unknown>): V1AudienceDefinition[] {
  const audiences = registry.audiences;
  if (!Array.isArray(audiences)) {
    throw new Error('Candidate audience registry has no audiences array.');
  }
  return audiences.map((value, index) => {
    if (!value || typeof value !== 'object') {
      throw new Error(`Candidate audience registry entry ${index} is invalid.`);
    }
    const entry = value as Record<string, unknown>;
    const acceptedPrincipalTypes = stringArray(
      entry.accepted_principal_types,
      'accepted_principal_types',
    );
    if (acceptedPrincipalTypes.some(
      (item) => !['user', 'agent', 'service'].includes(item),
    )) {
      throw new Error('Candidate audience registry has an invalid principal type.');
    }
    const status = requiredString(entry.status, 'status');
    if (!['candidate', 'active', 'disabled', 'retired'].includes(status)) {
      throw new Error('Candidate audience registry has an invalid status.');
    }
    return {
      audienceId: requiredString(entry.audience_id, 'audience_id'),
      resourceService: requiredString(entry.resource_service, 'resource_service'),
      scopeNamespace: requiredString(entry.scope_namespace, 'scope_namespace'),
      acceptedPrincipalTypes: acceptedPrincipalTypes as ('user' | 'agent' | 'service')[],
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

/**
 * Load and validate the candidate runtime snapshot.
 * Validates digest and version but does NOT require frozen/implementation_authorized.
 */
export function loadCandidateSnapshot(candidatePath?: string): CandidateSnapshotResult {
  const filePath = candidatePath ?? CANDIDATE_SNAPSHOT_PATH;
  let parsed: { payload: CandidateSnapshotPayload; runtimeDigest: string };
  try {
    parsed = asSnapshot(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (error) {
    throw new Error(
      `Candidate runtime snapshot unavailable at ${filePath}: ${(error as Error).message}`,
    );
  }

  // Validate digest
  const actual = crypto.createHash('sha256')
    .update(JSON.stringify(parsed.payload))
    .digest('hex');
  if (actual !== parsed.runtimeDigest) {
    throw new Error('Candidate runtime snapshot digest mismatch.');
  }

	// Validate version (accept 1.0.0, 1.1.0, 1.2.0, 1.3.0, 1.4.0, and 1.6.0)
	  if (parsed.payload.formatVersion !== 1
	    || !['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.6.0'].includes(parsed.payload.contractVersion)) {
    throw new Error('Candidate runtime snapshot version is unsupported.');
  }

  const registry = parsed.payload.audienceRegistry;
  const audienceDefinitions = parseAudienceDefinitions(registry);

  return {
    contractVersion: parsed.payload.contractVersion,
    sourceBundleDigest: parsed.payload.sourceBundleDigest,
    runtimeDigest: parsed.runtimeDigest,
    audienceDefinitions,
    registryStatus: requiredString(registry.status as string, 'registry.status'),
  };
}
