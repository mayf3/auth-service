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

import { authenticateMachineClient } from './service.js';
import { signAgentAccessToken } from './token.js';
import { auditLog } from './audit.js';
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
  // 1-6. Delegate client authentication + authorization to shared function
  const { principal, client } = await authenticateMachineClient({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    resource: params.resource,
    requestedScopes: params.scope.split(' ').filter(Boolean),
  });

  const agentId = principal.agentId;

  // 7. Validate scope string for audit trail (shared fn already validated)
  const validatedScope = params.scope
    .split(' ')
    .filter(Boolean)
    .filter((s) => client.allowedScopes.includes(s))
    .join(' ');

  // 8. Sign token — dispatch by audience.
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
        principalId: principal.id,
        agentId,
        clientId: client.clientId,
        resource: params.resource,
        scopes: validatedScope,
        success: false,
        error: 'workflow_keyring_not_configured',
      });
      throw Object.assign(new Error('invalid_grant'), { statusCode: 400 });
    }
    token = signWorkflowAccessToken({
      principalId: principal.id,
      agentId,
      clientId: client.clientId,
      scope: validatedScope,
      ttl: DEFAULT_TTL,
    });
    algorithm = 'RS256';
    kid = getActiveKid();
  } else {
    token = signAgentAccessToken({
      principalId: principal.id,
      agentId,
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
    principalId: principal.id,
    agentId,
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
