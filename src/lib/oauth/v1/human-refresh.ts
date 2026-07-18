import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { getV1ContractSettings } from './contract.js';
import {
  issueRefreshCredential,
  parseRefreshCredential,
  verifyOpaqueSecret,
} from './credentials.js';
import { V1OAuthError } from './errors.js';
import type { V1HumanTokenResult } from './human-login.js';
import {
  assertHumanAudienceGrant,
  authenticateHumanClientProof,
  expiresAt,
  type PresentedClientAuth,
  writeHumanSecurityAudit,
} from './human-support.js';
import { signV1HumanAccessToken } from './signer.js';

export interface RefreshV1HumanSessionParams {
  refreshToken: string;
  clientId: string;
  resource: string;
  clientAuth: PresentedClientAuth | null;
  requestId: string;
}

export interface LogoutV1HumanSessionParams {
  refreshToken: string;
  clientId: string;
  clientAuth: PresentedClientAuth | null;
  requestId: string;
}

type LoadedCredential = NonNullable<Awaited<ReturnType<typeof loadCredential>>>;

function credentialInclude() {
  return {
    family: true,
    session: true,
    user: true,
    humanClient: {
      include: {
        audienceGrants: {
          include: { audience: true },
        },
      },
    },
  };
}

async function loadCredential(id: string) {
  return prisma.refreshCredential.findUnique({
    where: { id },
    include: credentialInclude(),
  });
}

function invalidGrant(category: string): V1OAuthError {
  return new V1OAuthError('invalid_grant', category);
}

async function auditFailure(
  requestId: string,
  category: string,
  context: {
    id?: string;
    userId?: string;
    sessionId?: string;
    familyId?: string;
    humanClient?: { id: string; clientId: string } | null;
  },
): Promise<never> {
  await writeHumanSecurityAudit(prisma, {
    eventType: 'refresh.failed',
    result: 'rejected',
    requestId,
    userId: context.userId ?? null,
    humanClientId: context.humanClient?.id ?? null,
    clientId: context.humanClient?.clientId ?? null,
    sessionId: context.sessionId ?? null,
    familyId: context.familyId ?? null,
    credentialId: context.id ?? null,
    rejectionCategory: category,
  });
  throw invalidGrant(category);
}

async function authenticateRequestClient(
  clientId: string,
  clientAuth: PresentedClientAuth | null,
  requestId: string,
) {
  const client = await prisma.humanClient.findUnique({ where: { clientId } });
  if (!client) throw new V1OAuthError('invalid_client', 'human_client_authentication_failed');
  try {
    authenticateHumanClientProof(client, clientId, clientAuth);
  } catch (error) {
    const category = error instanceof V1OAuthError
      ? error.category
      : 'human_client_authentication_failed';
    await writeHumanSecurityAudit(prisma, {
      eventType: 'refresh.failed', result: 'rejected', requestId,
      humanClientId: client.id, clientId: client.clientId,
      rejectionCategory: category,
    });
    throw error;
  }
  return client;
}

function credentialMatches(
  credential: LoadedCredential,
  secret: string,
  humanClientId: string,
): boolean {
  return credential.humanClientId === humanClientId
    && credential.sessionId === credential.session.id
    && credential.familyId === credential.family.id
    && credential.userId === credential.user.id
    && verifyOpaqueSecret(
      secret,
      credential.secretVerifier,
      credential.verifierParametersVersion,
    );
}

async function revokeFamilyForReuse(
  credentialId: string,
  requestId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "refresh_credentials" WHERE "id" = ${credentialId}::uuid FOR UPDATE
    `);
    const credential = await tx.refreshCredential.findUnique({
      where: { id: credentialId },
      include: { humanClient: true },
    });
    if (!credential) return;
    const now = new Date();
    await tx.refreshCredential.updateMany({
      where: { familyId: credential.familyId },
      data: { status: 'revoked', revokedAt: now, version: { increment: 1 } },
    });
    await tx.refreshCredential.update({
      where: { id: credential.id },
      data: { reuseDetectedAt: now },
    });
    await tx.refreshFamily.update({
      where: { id: credential.familyId },
      data: { status: 'revoked', revokedAt: now, revokeReason: 'refresh_reuse_detected', version: { increment: 1 } },
    });
    await tx.humanSession.update({
      where: { id: credential.sessionId },
      data: { status: 'revoked', revokedAt: now, revocationReason: 'refresh_reuse_detected', version: { increment: 1 } },
    });
    for (const eventType of [
      'refresh.reuse_detected', 'refresh.family_revoked', 'session.revoked',
    ]) {
      await writeHumanSecurityAudit(tx, {
        eventType, result: 'rejected', requestId,
        userId: credential.userId, humanClientId: credential.humanClientId,
        clientId: credential.humanClient.clientId, sessionId: credential.sessionId,
        familyId: credential.familyId, credentialId: credential.id,
        rejectionCategory: 'refresh_reuse_detected',
      });
    }
  });
}

async function revokeInvalidFamily(
  credential: LoadedCredential,
  category: string,
  requestId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const expired = category === 'refresh_expired';
    await tx.refreshCredential.updateMany({
      where: { familyId: credential.familyId },
      data: { status: expired ? 'expired' : 'revoked', revokedAt: now, version: { increment: 1 } },
    });
    await tx.refreshFamily.update({
      where: { id: credential.familyId },
      data: {
        status: expired ? 'expired' : 'revoked', revokedAt: now,
        revokeReason: category, version: { increment: 1 },
      },
    });
    await tx.humanSession.update({
      where: { id: credential.sessionId },
      data: {
        status: expired ? 'expired' : 'revoked', revokedAt: now,
        revocationReason: category, version: { increment: 1 },
      },
    });
    await writeHumanSecurityAudit(tx, {
      eventType: 'refresh.family_revoked', result: 'rejected', requestId,
      userId: credential.userId, humanClientId: credential.humanClientId,
      clientId: credential.humanClient.clientId, sessionId: credential.sessionId,
      familyId: credential.familyId, credentialId: credential.id,
      rejectionCategory: category,
    });
    await writeHumanSecurityAudit(tx, {
      eventType: 'session.revoked', result: 'rejected', requestId,
      userId: credential.userId, humanClientId: credential.humanClientId,
      clientId: credential.humanClient.clientId, sessionId: credential.sessionId,
      familyId: credential.familyId, credentialId: credential.id,
      rejectionCategory: category,
    });
  });
}

export async function refreshV1HumanSession(
  params: RefreshV1HumanSessionParams,
): Promise<V1HumanTokenResult> {
  const client = await authenticateRequestClient(
    params.clientId,
    params.clientAuth,
    params.requestId,
  );
  const parsed = parseRefreshCredential(params.refreshToken);
  if (!parsed) return auditFailure(params.requestId, 'refresh_credential_invalid', { humanClient: client });
  const preliminary = await loadCredential(parsed.id);
  if (!preliminary || !credentialMatches(preliminary, parsed.secret, client.id)) {
    return auditFailure(params.requestId, 'refresh_credential_invalid', {
      humanClient: client,
    });
  }
  if (preliminary.status !== 'active') {
    await revokeFamilyForReuse(preliminary.id, params.requestId);
    throw invalidGrant('refresh_credential_invalid');
  }
  const now = new Date();
  if (preliminary.expiresAt <= now || preliminary.session.absoluteExpiresAt <= now
    || preliminary.family.absoluteExpiresAt <= now) {
    await revokeInvalidFamily(preliminary, 'refresh_expired', params.requestId);
    throw invalidGrant('refresh_credential_invalid');
  }
  if (preliminary.user.status !== 'active' || preliminary.humanClient.status !== 'active'
    || preliminary.session.status !== 'active' || preliminary.family.status !== 'active'
    || preliminary.session.tokenFamilyId !== preliminary.familyId) {
    await revokeInvalidFamily(preliminary, 'refresh_binding_inactive', params.requestId);
    throw invalidGrant('refresh_credential_invalid');
  }
  assertHumanAudienceGrant(
    params.resource,
    preliminary.humanClient.audienceGrants.find((grant) => grant.audienceId === params.resource),
  );

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "refresh_credentials" WHERE "id" = ${parsed.id}::uuid FOR UPDATE
    `);
    const current = await tx.refreshCredential.findUnique({
      where: { id: parsed.id },
      include: credentialInclude(),
    });
    if (!current || current.status !== 'active') return { kind: 'reuse' as const };
    const transactionNow = new Date();
    if (current.expiresAt <= transactionNow || current.session.absoluteExpiresAt <= transactionNow
      || current.family.absoluteExpiresAt <= transactionNow || current.user.status !== 'active'
      || current.humanClient.status !== 'active' || current.session.status !== 'active'
      || current.family.status !== 'active' || current.session.tokenFamilyId !== current.familyId) {
      return { kind: 'inactive' as const, credential: current as LoadedCredential };
    }
    try {
      assertHumanAudienceGrant(
        params.resource,
        current.humanClient.audienceGrants.find((grant) => grant.audienceId === params.resource),
      );
    } catch (error) {
      await writeHumanSecurityAudit(tx, {
        eventType: 'refresh.failed', result: 'rejected', requestId: params.requestId,
        userId: current.userId, humanClientId: current.humanClientId,
        clientId: current.humanClient.clientId, sessionId: current.sessionId,
        familyId: current.familyId, credentialId: current.id,
        rejectionCategory: error instanceof V1OAuthError ? error.category : 'human_audience_invalid',
      });
      return { kind: 'target' as const, error };
    }
    const refresh = issueRefreshCredential();
    const refreshExpiresAt = expiresAt(
      transactionNow,
      getV1ContractSettings().refreshCredentialTtlSeconds,
      current.session.absoluteExpiresAt,
    );
    await tx.refreshCredential.update({
      where: { id: current.id },
      data: { status: 'rotated', rotatedAt: transactionNow, version: { increment: 1 } },
    });
    await tx.refreshCredential.create({
      data: {
        id: refresh.id,
        familyId: current.familyId,
        sessionId: current.sessionId,
        userId: current.userId,
        humanClientId: current.humanClientId,
        secretVerifier: refresh.verifier,
        verifierParametersVersion: refresh.verifierParametersVersion,
        expiresAt: refreshExpiresAt,
      },
    });
    await tx.refreshCredential.update({
      where: { id: current.id },
      data: { replacedById: refresh.id },
    });
    await tx.humanSession.update({
      where: { id: current.sessionId },
      data: { lastRefreshedAt: transactionNow, version: { increment: 1 } },
    });
    await writeHumanSecurityAudit(tx, {
      eventType: 'refresh.rotated', result: 'success', requestId: params.requestId,
      userId: current.userId, humanClientId: current.humanClientId,
      clientId: current.humanClient.clientId, sessionId: current.sessionId,
      familyId: current.familyId, credentialId: current.id,
      extraDetails: { replaced_by_id: refresh.id },
    });
    const signed = signV1HumanAccessToken({
      userId: current.userId,
      clientId: current.humanClient.clientId,
      audience: params.resource,
      maximumExpiresAt: Math.floor(current.session.absoluteExpiresAt.getTime() / 1000),
    });
    return {
      kind: 'success' as const,
      result: {
        access_token: signed.token,
        token_type: 'Bearer' as const,
        expires_in: signed.claims.exp - signed.claims.iat,
        refresh_token: refresh.wireValue,
        refresh_expires_in: Math.floor(
          (refreshExpiresAt.getTime() - transactionNow.getTime()) / 1000,
        ),
      },
    };
  });
  if (outcome.kind === 'success') return outcome.result;
  if (outcome.kind === 'reuse') {
    await revokeFamilyForReuse(parsed.id, params.requestId);
    throw invalidGrant('refresh_credential_invalid');
  }
  if (outcome.kind === 'inactive') {
    await revokeInvalidFamily(outcome.credential, 'refresh_binding_inactive', params.requestId);
    throw invalidGrant('refresh_credential_invalid');
  }
  throw outcome.error instanceof V1OAuthError
    ? outcome.error
    : new V1OAuthError('invalid_target', 'human_audience_invalid');
}

export async function logoutV1HumanSession(params: LogoutV1HumanSessionParams): Promise<void> {
  const client = await authenticateRequestClient(
    params.clientId,
    params.clientAuth,
    params.requestId,
  );
  const parsed = parseRefreshCredential(params.refreshToken);
  if (!parsed) return auditFailure(params.requestId, 'refresh_credential_invalid', { humanClient: client });
  const credential = await loadCredential(parsed.id);
  if (!credential || !credentialMatches(credential, parsed.secret, client.id)) {
    return auditFailure(params.requestId, 'refresh_credential_invalid', { humanClient: client });
  }
  await revokeInvalidFamily(credential, 'user_logout', params.requestId);
}
