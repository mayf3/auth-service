/**
 * scripts/obo-conformance-ids.ts
 *
 * Shared deterministic identifiers and types for OBO conformance test scripts.
 * Must match scripts/bootstrap-obo-conformance-fixture.ts.
 */

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Principal IDs
// ---------------------------------------------------------------------------

export const CALLER_A_PRINCIPAL_ID  = 'a0000000-0000-4000-8000-000000000001';
export const CALLER_B_PRINCIPAL_ID  = 'a0000000-0000-4000-8000-000000000002';
export const PROXY_PRINCIPAL_ID     = 'a0000000-0000-4000-8000-000000000003';
export const MISMATCH_PRINCIPAL_ID  = 'e0000000-0000-4000-8000-000000000001';
export const NO_TP_PRINCIPAL_ID     = 'f0000000-0000-4000-8000-000000000001';
export const DISABLED_PROXY_PRINCIPAL_ID = 'fa000000-0000-4000-8000-000000000001';
export const NO_DG_PRINCIPAL_ID     = 'fb000000-0000-4000-8000-000000000001';
export const CALLER_C_PRINCIPAL_ID  = 'fc000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------------------
// Client IDs (the string client_id values, not DB UUIDs)
// ---------------------------------------------------------------------------

export const CALLER_A_CLIENT_ID     = 'caller-a';
export const CALLER_B_CLIENT_ID     = 'caller-b';
export const PROXY_CLIENT_ID        = 'adc-proxy';
export const MISMATCH_CLIENT_ID     = 'mismatch-proxy';
export const NO_TP_CLIENT_ID        = 'no-tp-proxy';
export const DISABLED_PROXY_CLIENT_ID = 'disabled-proxy';
export const NO_DG_CLIENT_ID        = 'no-dg-proxy';
export const CALLER_C_CLIENT_ID     = 'caller-c';
export const CALLER_C_CLIENT_DB_ID  = 'fc000000-0000-4000-8000-000000000002';

// ---------------------------------------------------------------------------
// Agent IDs
// ---------------------------------------------------------------------------

export const CALLER_A_AGENT_ID      = 'obo-caller-a-agent';
export const CALLER_B_AGENT_ID      = 'obo-caller-b-agent';
export const CALLER_C_AGENT_ID      = 'obo-caller-c-agent';

// ---------------------------------------------------------------------------
// Audience / scope constants
// ---------------------------------------------------------------------------

export const TARGET_AUDIENCE        = 'svc-workflow';
export const SOURCE_AUDIENCE        = 'adc-v2';
export const SCOPE_WORKFLOW         = 'workflow.execute workflow.read';

// ---------------------------------------------------------------------------
// Human OAuth test constants
// ---------------------------------------------------------------------------

export const HUMAN_CLIENT_ID        = 'obo-human-client';
export const HUMAN_USER_ID          = 'h0000000-0000-4000-8000-000000000001';
export const HUMAN_CODE_VERIFIER    = 'test-code-verifier-32bytes-value!';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecretBundle {
  callerASecret: string;
  callerBSecret: string;
  adcProxySecret: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
  category?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function decodeJwt(
  token: string,
): { header: Record<string, unknown>; payload: Record<string, unknown> } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT must have 3 parts');
  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8')),
    payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')),
  };
}

export function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}
