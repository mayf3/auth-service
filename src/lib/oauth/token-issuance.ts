/**
 * Token issuance logic for Client Credentials grant.
 *
 * Handles:
 *   - Client credential verification
 *   - Principal / Client status checks
 *   - Resource / scope authorization
 *   - Agent Access Token signing
 *   - Token issuance audit events
 *
 * Separated from service.ts to keep each file ≤ 500 lines.
 */

import { prisma } from '../../lib/prisma.js';
import { verifyClientSecret } from './secret.js';
import { signAgentAccessToken } from './token.js';
import { auditLog } from './audit.js';
import { validateRequestedScope } from '../../schemas/oauth.js';
import { WORKFLOW_AUDIENCE, isWorkflowKeyringConfigured } from './workflow-keyring.js';
import { signWorkflowAccessToken, getActiveKid } from './workflow-signer.js';

// ─── Token Issuance ────────────────────────────────────────────────────────

export interface IssueTokenParams {
  clientId: string;
  clientSecret: string;
  resource: string;
  scope: string;
}

export interface TokenResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  jti?: string;
}

/**
 * Issue an Agent Access Token via client_credentials grant.
 *
 * @throws Error with `statusCode` property for HTTP error mapping.
 */
export async function issueToken(params: IssueTokenParams): Promise<TokenResult> {
  // 1. Find client by clientId (don't reveal if clientId exists or not)
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
    // Generic error — don't reveal whether clientId or secret was wrong
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
    throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
  }

  // 6. Validate scope — must be subset of allowed scopes
  let validatedScope: string;
  try {
    validatedScope = validateRequestedScope(params.scope, client.allowedScopes);
  } catch (err: any) {
    auditLog({
      timestamp: new Date().toISOString(),
      type: 'token.failed',
      principalId: client.machinePrincipalId,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      resource: params.resource,
      scopes: params.scope,
      success: false,
      error: 'invalid_scope',
    });
    throw Object.assign(new Error('invalid_scope'), { statusCode: 400 });
  }

  // 7. Sign token — dispatch by audience.
  //    aud=svc-workflow  → RS256 workflow signer (PR-A)
  //    any other audience → existing HS256 signer (UNCHANGED)
  const DEFAULT_TTL = 600;
  const isWorkflow = params.resource === WORKFLOW_AUDIENCE;

  let token: string;
  let algorithm: string;
  let kid: string | undefined;
  if (isWorkflow) {
    // Workflow RS256 path — fail closed if the key ring isn't provisioned.
    if (!isWorkflowKeyringConfigured()) {
      auditLog({
        timestamp: new Date().toISOString(),
        type: 'token.failed',
        principalId: client.principal.id,
        agentId: client.principal.agentId,
        clientId: client.clientId,
        resource: params.resource,
        scopes: validatedScope,
        success: false,
        error: 'workflow_keyring_not_configured',
      });
      throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
    }
    token = signWorkflowAccessToken({
      principalId: client.principal.id,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      scope: validatedScope,
      ttl: DEFAULT_TTL,
    });
    algorithm = 'RS256';
    kid = getActiveKid();
  } else {
    token = signAgentAccessToken({
      principalId: client.principal.id,
      agentId: client.principal.agentId,
      clientId: client.clientId,
      audience: params.resource,
      scope: validatedScope,
      ttl: DEFAULT_TTL,
    });
    algorithm = 'HS256';
  }

  // Decode to extract jti for audit
  const decoded = jwtDecode(token);
  const jti = typeof decoded?.jti === 'string' ? decoded.jti : undefined;

  auditLog({
    timestamp: new Date().toISOString(),
    type: 'token.issued',
    principalId: client.principal.id,
    agentId: client.principal.agentId,
    clientId: client.clientId,
    resource: params.resource,
    scopes: validatedScope,
    jti,
    success: true,
    ...(isWorkflow ? { algorithm, kid } : {}),
  });

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: DEFAULT_TTL,
    scope: validatedScope,
    jti,
  };
}

/**
 * Minimal JWT decode (no verification) for extracting claims for audit.
 * Split on dots, base64url-decode the payload section.
 */
function jwtDecode(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}
