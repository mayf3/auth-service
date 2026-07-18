/**
 * Zod validation schemas for OAuth endpoints and machine identity management.
 */

import { z } from 'zod';

// ─── Token Request ─────────────────────────────────────────────────────────

/**
 * Schema for POST /oauth/token request body (x-www-form-urlencoded).
 */
export const tokenRequestSchema = z.object({
  grant_type: z.literal('client_credentials', {
    errorMap: () => ({ message: 'Only client_credentials grant type is supported' }),
  }),
  scope: z.string().optional().default(''),
  resource: z.string().min(1, 'resource is required'),
});

/**
 * Schema for POST /oauth/token with grant_type=token-exchange (RFC 8693).
 */
export const tokenExchangeRequestSchema = z.object({
  grant_type: z.literal(
    'urn:ietf:params:oauth:grant-type:token-exchange',
    { errorMap: () => ({ message: 'Unsupported grant type' }) },
  ),
  subject_token: z.string().min(1, 'subject_token is required'),
  subject_token_type: z
    .string()
    .default('urn:ietf:params:oauth:token-type:access_token'),
  requested_token_type: z
    .string()
    .default('urn:ietf:params:oauth:token-type:access_token'),
  audience: z.string().min(1, 'audience is required'),
  scope: z.string().optional().default(''),
});

// ─── Machine Principal ─────────────────────────────────────────────────────

/**
 * Agent ID format validation matching OpenClaw 2026.3.13 rules.
 */
const agentIdSchema = z.string()
  .min(1, 'agentId is required')
  .max(64, 'agentId must be at most 64 characters')
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, 'Invalid agent ID format');

export const createPrincipalSchema = z.object({
  agentId: agentIdSchema,
  ownerUserId: z.string().uuid('ownerUserId must be a valid UUID'),
  displayName: z.string().optional(),
});

export const getPrincipalSchema = z.object({
  agentId: agentIdSchema,
});

export const disablePrincipalSchema = z.object({
  agentId: agentIdSchema,
});

// ─── Machine Client ────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  agentId: agentIdSchema,
  resources: z.array(z.string().min(1)).min(1, 'At least one resource is required'),
  scopes: z.array(z.string().min(1)).min(1, 'At least one scope is required'),
});

export const getClientSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
});

export const rotateClientSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
});

export const revokeClientSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parse and normalize a space-delimited scope string into a sorted,
 * deduplicated array.
 */
export function parseScopeString(scope: string): string[] {
  if (!scope || !scope.trim()) return [];
  const items = scope.trim().split(/\s+/);
  const unique = [...new Set(items)];
  return unique.sort();
}

/**
 * Validate that requested scopes are a subset of allowed scopes.
 * Returns the validated scope string or throws.
 */
export function validateRequestedScope(
  requested: string,
  allowed: string[],
): string {
  const parsed = parseScopeString(requested);
  const allowedSet = new Set(allowed);
  for (const s of parsed) {
    if (!allowedSet.has(s)) {
      throw new Error(`Scope "${s}" is not authorized`);
    }
  }
  return parsed.join(' ');
}
