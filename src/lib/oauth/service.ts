/**
 * Machine Principal & Client Credentials service layer.
 *
 * Core business logic for:
 *   - MachinePrincipal lifecycle (create, get, disable)
 *   - MachineClient lifecycle (create, rotate, revoke, get)
 *
 * Token issuance has been moved to ./token-issuance.ts for file size compliance
 * and is re-exported here for backward compatibility.
 */

import { prisma } from '../../lib/prisma.js';
import {
  generateClientSecret,
  hashClientSecret,
  verifyClientSecret,
} from './secret.js';
import { auditLog } from './audit.js';
import { validateRequestedScope } from '../../schemas/oauth.js';
import type { PrincipalType, PrincipalStatus, ClientStatus } from '@prisma/client';

// Re-export token issuance for backward compatibility
export { issueToken } from './token-issuance.js';
export type { IssueTokenParams, TokenResult } from './token-issuance.js';

// ─── Shared Client Authentication ──────────────────────────────────────────

export interface AuthenticateClientParams {
  clientId: string;
  clientSecret: string;
  resource: string;
  requestedScopes: string[];       // e.g. ['forum.read', 'forum.write']
}

export interface AuthenticateClientResult {
  principal: {
    id: string;
    principalType: string;
    agentId: string;
    displayName: string | null;
    status: string;
  };
  client: {
    id: string;
    clientId: string;
    machinePrincipalId: string;
    status: string;
    allowedResources: string[];
    allowedScopes: string[];
  };
}

/**
 * Authenticate a machine client and validate its authorization for a given
 * resource + scope combination.
 *
 * Shared between OAuth2 client_credentials grant and token-login endpoint.
 * All errors carry a `statusCode` property for HTTP response mapping.
 *
 * Error → HTTP mapping:
 *   invalid_client → 401 (client not found, revoked, secret wrong, disabled)
 *   invalid_target → 400 (resource not in allowedResources)
 *   invalid_scope  → 400 (scope not a subset of allowedScopes)
 */
export async function authenticateMachineClient(
  params: AuthenticateClientParams,
): Promise<AuthenticateClientResult> {
  // 1. Find client by clientId
  const client = await prisma.machineClient.findUnique({
    where: { clientId: params.clientId },
    include: { principal: true },
  });

  if (!client) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      clientId: params.clientId,
      resource: params.resource,
      success: false,
      error: 'client_not_found',
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  // 2. Check client status
  if (client.status === 'revoked') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      principalId: client.machinePrincipalId,
      clientId: client.clientId,
      resource: params.resource,
      success: false,
      error: 'client_revoked',
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  // 3. Check principal status
  if (client.principal.status === 'disabled') {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.resource,
      success: false,
      error: 'principal_disabled',
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }
  if (client.principal.principalType !== 'agent' || !client.principal.agentId) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      principalId: client.machinePrincipalId,
      clientId: client.clientId,
      resource: params.resource,
      success: false,
      error: 'legacy_principal_profile_mismatch',
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  // 4. Verify secret (constant-time)
  const secretValid = verifyClientSecret(params.clientSecret, client.secretHash);
  if (!secretValid) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      principalId: client.machinePrincipalId,
      clientId: client.clientId,
      resource: params.resource,
      success: false,
      error: 'invalid_secret',
    });
    throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
  }

  // 5. Validate resource — exact match only
  const resourceMatch = client.allowedResources.some(
    (r) => r === params.resource,
  );
  if (!resourceMatch) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.resource,
      success: false,
      error: 'invalid_resource',
    });
    throw Object.assign(new Error('invalid_target'), { statusCode: 400 });
  }

  // 6. Validate scope — must be subset of allowed scopes
  const scopeString = params.requestedScopes.join(' ');
  try {
    validateRequestedScope(scopeString, client.allowedScopes);
  } catch (err: any) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.resource,
      scopes: scopeString,
      success: false,
      error: 'invalid_scope',
    });
    throw Object.assign(new Error('invalid_scope'), { statusCode: 400 });
  }

  return {
    principal: {
      id: client.principal.id,
      principalType: client.principal.principalType,
      agentId: client.principal.agentId,
      displayName: client.principal.displayName,
      status: client.principal.status,
    },
    client: {
      id: client.id,
      clientId: client.clientId,
      machinePrincipalId: client.machinePrincipalId,
      status: client.status,
      allowedResources: client.allowedResources,
      allowedScopes: client.allowedScopes,
    },
  };
}

type LegacyAgentPrincipal = {
  principalType: PrincipalType;
  agentId: string | null;
  ownerUserId: string | null;
};

function assertLegacyAgentPrincipal(
  principal: LegacyAgentPrincipal,
): asserts principal is LegacyAgentPrincipal & {
  principalType: 'agent';
  agentId: string;
  ownerUserId: string;
} {
  if (principal.principalType !== 'agent' || !principal.agentId || !principal.ownerUserId) {
    throw Object.assign(new Error('Legacy machine endpoint requires an Agent principal'), {
      statusCode: 409,
    });
  }
}

/**
 * Generate a random ID string (url-safe, no padding).
 */
function generateRandomId(length: number): string {
  const bytes = Math.ceil(length * 6 / 8);
  return Buffer.from(
    Array.from({ length: bytes }, () => Math.floor(Math.random() * 256)),
  ).toString('base64url').slice(0, length);
}

// ─── Machine Principal ─────────────────────────────────────────────────────

export interface CreatePrincipalParams {
  agentId: string;
  ownerUserId: string;
  displayName?: string;
}

export interface MachinePrincipalResult {
  id: string;
  principalType: string;
  agentId: string;
  ownerUserId: string;
  displayName: string | null;
  status: string;
  createdAt: Date;
  disabledAt: Date | null;
}

/**
 * Create a new MachinePrincipal for an agent.
 * Throws if agentId already exists or owner not found.
 *
 * @deprecated Use createOrGetPrincipal from src/lib/oauth/v1/idempotent.js for
 * production paths. This function is retained for admin/migration use only.
 * The idempotent path provides external_ref-based resolution, atomic claims,
 * and concurrent safety via DB UNIQUE constraint.
 */
export async function createPrincipal(
  params: CreatePrincipalParams,
): Promise<MachinePrincipalResult> {
  // Verify owner exists
  const owner = await prisma.user.findUnique({
    where: { id: params.ownerUserId },
  });
  if (!owner) {
    throw Object.assign(new Error('Owner user not found'), { statusCode: 404 });
  }

  // Check for duplicate
  const existing = await prisma.machinePrincipal.findUnique({
    where: { agentId: params.agentId },
  });
  if (existing) {
    throw Object.assign(new Error(`MachinePrincipal already exists for agent "${params.agentId}"`), {
      statusCode: 409,
    });
  }

  const principal = await prisma.machinePrincipal.create({
    data: {
      principalType: 'agent',
      agentId: params.agentId,
      ownerUserId: params.ownerUserId,
      displayName: params.displayName ?? null,
    },
  });
  assertLegacyAgentPrincipal(principal);

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'principal.created',
    principalId: principal.id,
    agentId: principal.agentId,
    success: true,
  });

  return {
    id: principal.id,
    principalType: principal.principalType,
    agentId: principal.agentId,
    ownerUserId: principal.ownerUserId,
    displayName: principal.displayName,
    status: principal.status,
    createdAt: principal.createdAt,
    disabledAt: principal.disabledAt,
  };
}

/**
 * Get a MachinePrincipal by agentId.
 */
export async function getPrincipal(agentId: string): Promise<MachinePrincipalResult | null> {
  const principal = await prisma.machinePrincipal.findUnique({
    where: { agentId },
  });
  if (!principal) return null;
  assertLegacyAgentPrincipal(principal);

  return {
    id: principal.id,
    principalType: principal.principalType,
    agentId: principal.agentId,
    ownerUserId: principal.ownerUserId,
    displayName: principal.displayName,
    status: principal.status,
    createdAt: principal.createdAt,
    disabledAt: principal.disabledAt,
  };
}

/**
 * Disable a MachinePrincipal by agentId.
 * All associated clients immediately become unable to issue tokens.
 */
export async function disablePrincipal(agentId: string): Promise<MachinePrincipalResult> {
  const principal = await prisma.machinePrincipal.findUnique({
    where: { agentId },
  });
  if (!principal) {
    throw Object.assign(new Error(`MachinePrincipal not found for agent "${agentId}"`), {
      statusCode: 404,
    });
  }
  assertLegacyAgentPrincipal(principal);

  if (principal.status === 'disabled') {
    // Idempotent
    return {
      id: principal.id,
      principalType: principal.principalType,
      agentId: principal.agentId,
      ownerUserId: principal.ownerUserId,
      displayName: principal.displayName,
      status: 'disabled',
      createdAt: principal.createdAt,
      disabledAt: principal.disabledAt,
    };
  }

  const updated = await prisma.machinePrincipal.update({
    where: { id: principal.id },
    data: {
      status: 'disabled',
      disabledAt: new Date(),
    },
  });
  assertLegacyAgentPrincipal(updated);

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'principal.disabled',
    principalId: updated.id,
    agentId: updated.agentId,
    success: true,
  });

  return {
    id: updated.id,
    principalType: updated.principalType,
    agentId: updated.agentId,
    ownerUserId: updated.ownerUserId,
    displayName: updated.displayName,
    status: updated.status,
    createdAt: updated.createdAt,
    disabledAt: updated.disabledAt,
  };
}

// ─── Machine Client ────────────────────────────────────────────────────────

export interface CreateClientParams {
  agentId: string;
  resources: string[];
  scopes: string[];
}

export interface MachineClientResult {
  id: string;
  clientId: string;
  machinePrincipalId: string;
  status: string;
  allowedResources: string[];
  allowedScopes: string[];
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreateClientOutput extends MachineClientResult {
  secret: string; // Only shown once on creation
}

/**
 * Create a new MachineClient for an existing MachinePrincipal.
 * Returns the client secret ONLY once.
 */
export async function createClient(
  params: CreateClientParams,
): Promise<CreateClientOutput> {
  const principal = await prisma.machinePrincipal.findUnique({
    where: { agentId: params.agentId },
  });
  if (!principal) {
    throw Object.assign(new Error(`MachinePrincipal not found for agent "${params.agentId}"`), {
      statusCode: 404,
    });
  }
  assertLegacyAgentPrincipal(principal);

  if (principal.status === 'disabled') {
    throw Object.assign(new Error('MachinePrincipal is disabled'), { statusCode: 403 });
  }

  const clientId = 'mc_' + generateRandomId(24);
  const secret = generateClientSecret();
  const secretHash = hashClientSecret(secret);

  const client = await prisma.machineClient.create({
    data: {
      clientId,
      machinePrincipalId: principal.id,
      secretHash,
      allowedResources: params.resources,
      allowedScopes: params.scopes,
    },
  });

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'client.created',
    principalId: principal.id,
    agentId: principal.agentId,
    clientId: client.clientId,
    success: true,
  });

  return {
    id: client.id,
    clientId: client.clientId,
    machinePrincipalId: client.machinePrincipalId,
    status: client.status,
    allowedResources: client.allowedResources,
    allowedScopes: client.allowedScopes,
    createdAt: client.createdAt,
    rotatedAt: client.rotatedAt,
    revokedAt: client.revokedAt,
    secret, // Only shown once
  };
}

/**
 * Rotate a client secret. Returns the new secret once.
 * Old secret is immediately invalidated.
 */
export async function rotateClientSecret(
  clientId: string,
): Promise<{ client: MachineClientResult; newSecret: string }> {
  const client = await prisma.machineClient.findUnique({
    where: { clientId },
  });
  if (!client) {
    throw Object.assign(new Error('Client not found'), { statusCode: 404 });
  }
  if (client.status === 'revoked') {
    throw Object.assign(new Error('Client is revoked'), { statusCode: 403 });
  }

  const newSecret = generateClientSecret();
  const newHash = hashClientSecret(newSecret);

  await prisma.machineClient.update({
    where: { id: client.id },
    data: {
      secretHash: newHash,
      rotatedAt: new Date(),
    },
  });

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'client.rotated',
    principalId: client.machinePrincipalId,
    clientId: client.clientId,
    success: true,
  });

  return {
    client: {
      id: client.id,
      clientId: client.clientId,
      machinePrincipalId: client.machinePrincipalId,
      status: client.status,
      allowedResources: client.allowedResources,
      allowedScopes: client.allowedScopes,
      createdAt: client.createdAt,
      rotatedAt: new Date(),
      revokedAt: client.revokedAt,
    },
    newSecret,
  };
}

/**
 * Revoke a MachineClient by clientId.
 * After revocation, the client cannot issue new tokens.
 */
export async function revokeClient(clientId: string): Promise<MachineClientResult> {
  const client = await prisma.machineClient.findUnique({
    where: { clientId },
  });
  if (!client) {
    throw Object.assign(new Error('Client not found'), { statusCode: 404 });
  }

  if (client.status === 'revoked') {
    // Idempotent
    return {
      id: client.id,
      clientId: client.clientId,
      machinePrincipalId: client.machinePrincipalId,
      status: 'revoked',
      allowedResources: client.allowedResources,
      allowedScopes: client.allowedScopes,
      createdAt: client.createdAt,
      rotatedAt: client.rotatedAt,
      revokedAt: client.revokedAt,
    };
  }

  const updated = await prisma.machineClient.update({
    where: { id: client.id },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  });

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'client.revoked',
    principalId: updated.machinePrincipalId,
    clientId: updated.clientId,
    success: true,
  });

  return {
    id: updated.id,
    clientId: updated.clientId,
    machinePrincipalId: updated.machinePrincipalId,
    status: 'revoked',
    allowedResources: updated.allowedResources,
    allowedScopes: updated.allowedScopes,
    createdAt: updated.createdAt,
    rotatedAt: updated.rotatedAt,
    revokedAt: updated.revokedAt,
  };
}

/**
 * Get a MachineClient by clientId (inspect).
 */
export async function getClient(clientId: string): Promise<MachineClientResult | null> {
  const client = await prisma.machineClient.findUnique({
    where: { clientId },
  });
  if (!client) return null;

  return {
    id: client.id,
    clientId: client.clientId,
    machinePrincipalId: client.machinePrincipalId,
    status: client.status,
    allowedResources: client.allowedResources,
    allowedScopes: client.allowedScopes,
    createdAt: client.createdAt,
    rotatedAt: client.rotatedAt,
    revokedAt: client.revokedAt,
  };
}
