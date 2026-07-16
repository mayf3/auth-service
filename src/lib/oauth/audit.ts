/**
 * Minimal structured audit event logger for machine identity operations.
 *
 * Follows the existing console.warn pattern used in the codebase for
 * security alerts (see auth.ts IP anomaly detection and CORS logging).
 *
 * NEVER includes: client secret, access token, authorization header,
 * full request body, or secret hash.
 *
 * Event types:
 *   principal.created | principal.disabled
 *   client.created    | client.rotated    | client.revoked
 *   token.issued      | token.failed
 */

export type AuditEventType =
  | 'principal.created'
  | 'principal.disabled'
  | 'client.created'
  | 'client.rotated'
  | 'client.revoked'
  | 'token.issued'
  | 'token.failed';

export interface AuditEvent {
  timestamp: string;
  type: AuditEventType;
  /** MachinePrincipal UUID (omitted if not yet created) */
  principalId?: string;
  /** OpenClaw canonical agent ID */
  agentId?: string;
  /** OAuth clientId (not the DB id — the public client_id string) */
  clientId?: string;
  /** Requested resource (token events only) */
  resource?: string;
  /** Requested scopes (token events only, space-delimited) */
  scopes?: string;
  /** Unique token ID (token events only) */
  jti?: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error category (failure events only) */
  error?: string;
  // ─── Workflow RS256 (PR-A) ──────────────────────────────────────────────
  /** Signing algorithm used (workflow tokens only). */
  algorithm?: string;
  /** Key id used for signing (workflow tokens only). */
  kid?: string;
}

/**
 * Log a structured audit event to stderr as JSON.
 * Uses stderr to avoid interfering with JSON stdout from CLI commands.
 */
export function auditLog(event: AuditEvent): void {
  const entry = {
    timestamp: event.timestamp,
    type: event.type,
    ...(event.principalId ? { principalId: event.principalId } : {}),
    ...(event.agentId ? { agentId: event.agentId } : {}),
    ...(event.clientId ? { clientId: maskClientId(event.clientId) } : {}),
    ...(event.resource ? { resource: event.resource } : {}),
    ...(event.scopes ? { scopes: event.scopes } : {}),
    ...(event.jti ? { jti: event.jti } : {}),
    success: event.success,
    ...(event.error ? { error: event.error } : {}),
    ...(event.algorithm ? { algorithm: event.algorithm } : {}),
    ...(event.kid ? { kid: event.kid } : {}),
  };
  console.warn(`[AUDIT] ${JSON.stringify(entry)}`);
}

/**
 * Mask client ID for logging: show only first 8 chars.
 * Full clientId is still available in the database for debugging.
 */
function maskClientId(clientId: string): string {
  if (clientId.length <= 8) return clientId;
  return clientId.slice(0, 8) + '...';
}
