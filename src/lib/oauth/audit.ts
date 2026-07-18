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
  | 'token.failed'
  | 'v1.direct.issued'
  | 'v1.direct.failed'
  | 'v1.shadow.direct'
  // ─── OBO Token Exchange (PR-B) ─────────────────────────────────────────
  | 'obo.token.issued'
  | 'obo.token.failed';

export interface AuditEvent {
  timestamp: string;
  type: AuditEventType;
  /** MachinePrincipal UUID (omitted if not yet created) */
  principalId?: string;
  /** OpenClaw canonical agent ID */
  agentId?: string | null;
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
  // ─── OBO Token Exchange (PR-B) ──────────────────────────────────────────
  /** Correlation/request ID for the token exchange. */
  requestId?: string;
  /** Subject token's sub (the real principal being acted for). */
  subjectSub?: string;
  /** Subject token's principal_type. */
  subjectPrincipalType?: string;
  /** Subject token's jti for audit linkage. */
  subjectJti?: string;
  /** ADC's azp (authorized party, same as client_id). */
  azp?: string;
  /** ADC's act.sub (the service principal performing the exchange). */
  actSub?: string;
  /** Final issued scope set after intersection. */
  issuedScopes?: string;
  /** Output token's issued_at timestamp. */
  issuedAt?: string;
  /** Output token's expires_at timestamp. */
  expiresAt?: string;
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
  // OBO-specific fields
  const oboEntry = {
    ...(event.requestId ? { requestId: event.requestId } : {}),
    ...(event.subjectSub ? { subjectSub: event.subjectSub } : {}),
    ...(event.subjectPrincipalType ? { subjectPrincipalType: event.subjectPrincipalType } : {}),
    ...(event.subjectJti ? { subjectJti: event.subjectJti } : {}),
    ...(event.azp ? { azp: maskClientId(event.azp) } : {}),
    ...(event.actSub ? { actSub: event.actSub } : {}),
    ...(event.issuedScopes ? { issuedScopes: event.issuedScopes } : {}),
    ...(event.issuedAt ? { issuedAt: event.issuedAt } : {}),
    ...(event.expiresAt ? { expiresAt: event.expiresAt } : {}),
  };
  console.warn(`[AUDIT] ${JSON.stringify({ ...entry, ...oboEntry })}`);
}

/**
 * Mask client ID for logging: show only first 8 chars.
 * Full clientId is still available in the database for debugging.
 */
function maskClientId(clientId: string): string {
  if (clientId.length <= 8) return clientId;
  return clientId.slice(0, 8) + '...';
}
