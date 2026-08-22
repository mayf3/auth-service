/**
 * Generic V1 Principal & Client management routes.
 *
 * POST /api/v1/principals  — Idempotent principal creation by external_ref
 * POST /api/v1/clients     — Idempotent client creation by external_ref + principal_id
 * GET  /api/v1/principals/by-external-ref — Read-only Agent Core principal discovery
 * GET  /api/v1/clients/by-external-ref    — Read-only Agent Core client discovery
 *
 * Authentication: V1 RS256 access token with scope auth.identity.provision.
 * Machine callers must have a MachineAccessGrant for the svc-auth audience.
 */

import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { v1ManagementAuth } from '../middleware/v1-management-auth.js';
import {
  createOrGetPrincipal,
  createOrGetClient,
} from '../lib/oauth/v1/idempotent.js';
import {
  identityResolutionHttpError,
  requireSingleExternalRefQuery,
  resolveClientByExternalRef,
  resolvePrincipalByExternalRef,
} from '../lib/oauth/v1/resolution.js';

export const idempotentRouter = Router();

// ─── Schemas ───────────────────────────────────────────────────────────────

const createPrincipalSchema = z.object({
  body: z.object({
    external_ref: z.string().min(1, 'external_ref is required'),
    expected_principal_id: z.string().uuid().optional(),
    display_name: z.string().max(256).optional(),
    principal_type: z.enum(['agent', 'service']).optional().default('service'),
    agent_id: z.string().optional(),
    owner_user_id: z.string().uuid().optional(),
  }),
});

const createClientSchema = z.object({
  body: z.object({
    external_ref: z.string().min(1, 'external_ref is required'),
    principal_id: z.string().uuid('principal_id must be a valid UUID'),
    expected_client_id: z.string().uuid().optional(),
  }),
});

function sendResolutionError(error: unknown, res: Response): void {
  const mapped = identityResolutionHttpError(error);
  res.status(mapped.status).json(mapped.body);
}

// ─── GET /api/v1/principals/by-external-ref ───────────────────────────────

idempotentRouter.get(
  '/v1/principals/by-external-ref',
  v1ManagementAuth,
  asyncHandler(async (req, res) => {
    let externalRef: string;
    try {
      externalRef = requireSingleExternalRefQuery(req.query as Record<string, unknown>);
    } catch (error) {
      sendResolutionError(error, res);
      return;
    }

    try {
      const result = await resolvePrincipalByExternalRef(externalRef);
      res.status(200).json(result);
    } catch (error) {
      sendResolutionError(error, res);
    }
  }),
);

// ─── GET /api/v1/clients/by-external-ref ──────────────────────────────────

idempotentRouter.get(
  '/v1/clients/by-external-ref',
  v1ManagementAuth,
  asyncHandler(async (req, res) => {
    let externalRef: string;
    try {
      externalRef = requireSingleExternalRefQuery(req.query as Record<string, unknown>);
    } catch (error) {
      sendResolutionError(error, res);
      return;
    }

    try {
      const result = await resolveClientByExternalRef(externalRef);
      res.status(200).json(result);
    } catch (error) {
      sendResolutionError(error, res);
    }
  }),
);

// ─── POST /api/v1/principals ──────────────────────────────────────────────

idempotentRouter.post(
  '/v1/principals',
  v1ManagementAuth,
  asyncHandler(async (req, res) => {
    const { body } = createPrincipalSchema.parse({ body: req.body });

    const result = await createOrGetPrincipal({
      externalRef: body.external_ref,
      expectedPrincipalId: body.expected_principal_id,
      displayName: body.display_name,
      principalType: body.principal_type,
      agentId: body.agent_id,
      ownerUserId: body.owner_user_id,
    });

    res.status(result.created ? 201 : 200).json({
      id: result.id,
      principal_type: result.principalType,
      display_name: result.displayName,
      status: result.status,
      external_ref: result.externalRef,
      created_at: result.createdAt.toISOString(),
      created: result.created,
    });
  }),
);

// ─── POST /api/v1/clients ─────────────────────────────────────────────────

idempotentRouter.post(
  '/v1/clients',
  v1ManagementAuth,
  asyncHandler(async (req, res) => {
    const { body } = createClientSchema.parse({ body: req.body });

    const result = await createOrGetClient({
      externalRef: body.external_ref,
      principalId: body.principal_id,
      expectedClientId: body.expected_client_id,
    });

    const responseBody: Record<string, unknown> = {
      id: result.id,
      client_id: result.clientId,
      principal_id: result.machinePrincipalId,
      status: result.status,
      external_ref: result.externalRef,
      created_at: result.createdAt.toISOString(),
      created: result.created,
    };

    // Only return secret on creation (never on reuse/claim)
    if (result.secret) {
      responseBody.secret = result.secret;
    }

    res.status(result.created ? 201 : 200).json(responseBody);
  }),
);
