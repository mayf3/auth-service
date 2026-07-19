import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { getV1ContractSettings } from './contract.js';
import {
  issueAuthorizationCodeCredential,
  issueRefreshCredential,
  parseAuthorizationCode,
  pkceS256,
  verifyOpaqueSecret,
} from './credentials.js';
import { V1OAuthError } from './errors.js';
import {
  assertHumanAudienceGrant,
  assertHumanClientProfile,
  authenticateHumanClient,
  expiresAt,
  type PresentedClientAuth,
  writeHumanSecurityAudit,
} from './human-support.js';
import { signV1HumanAccessToken } from './signer.js';

const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const DUMMY_PASSWORD_HASH = '$2b$10$VUcoLmgzglBbvFDxxwuUcegewnNJ43adjS3O.oGtnhiY4GmLofp4K';

export interface BeginV1AuthorizationParams {
  clientId: string;
  redirectUri: string;
  audience: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export interface CompleteV1AuthorizationParams {
  authorizationTransactionId: string;
  email: string;
  password: string;
}

export interface ExchangeV1AuthorizationCodeParams {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
  clientAuth: PresentedClientAuth | null;
  requestId: string;
}

export interface V1HumanTokenResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}

function commonClientInclude(audienceId: string) {
  return {
    redirectUris: true,
    audienceGrants: {
      where: { audienceId },
      include: { audience: true },
    },
  };
}

function invalidGrant(category: string): never {
  throw new V1OAuthError('invalid_grant', category);
}

function assertPkce(verifier: string, expectedChallenge: string): void {
  const actual = Buffer.from(pkceS256(verifier), 'ascii');
  const expected = Buffer.from(expectedChallenge, 'ascii');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    invalidGrant('pkce_verification_failed');
  }
}

export async function beginV1Authorization(
  params: BeginV1AuthorizationParams,
): Promise<{ authorization_transaction_id: string; expires_in: number }> {
  if (params.codeChallengeMethod !== 'S256' || !PKCE_CHALLENGE.test(params.codeChallenge)
    || params.state.length < 1 || params.state.length > 512) {
    throw new V1OAuthError('invalid_request', 'authorization_request_invalid');
  }
  let redirect: URL;
  try {
    redirect = new URL(params.redirectUri);
  } catch {
    throw new V1OAuthError('invalid_request', 'redirect_uri_invalid');
  }
  if (redirect.hash) throw new V1OAuthError('invalid_request', 'redirect_uri_fragment_forbidden');
  const client = await prisma.humanClient.findUnique({
    where: { clientId: params.clientId },
    include: commonClientInclude(params.audience),
  });
  if (!client) throw new V1OAuthError('invalid_request', 'human_client_unknown');
  assertHumanClientProfile(client);
  if (!client.redirectUris.some((item) => item.redirectUri === params.redirectUri)) {
    throw new V1OAuthError('invalid_request', 'redirect_uri_not_registered');
  }
  assertHumanAudienceGrant(params.audience, client.audienceGrants[0]);
  const settings = getV1ContractSettings();
  const now = new Date();
  const transaction = await prisma.authorizationTransaction.create({
    data: {
      humanClientId: client.id,
      audienceId: params.audience,
      redirectUri: params.redirectUri,
      state: params.state,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      expiresAt: expiresAt(now, settings.authorizationTransactionTtlSeconds),
    },
  });
  return {
    authorization_transaction_id: transaction.id,
    expires_in: settings.authorizationTransactionTtlSeconds,
  };
}

export async function completeV1Authorization(
  params: CompleteV1AuthorizationParams,
): Promise<{ redirect_uri: string; state: string; code: string }> {
  const user = await prisma.user.findUnique({ where: { email: params.email } });
  const passwordMatches = await bcrypt.compare(
    params.password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || user.status !== 'active' || !passwordMatches) {
    invalidGrant('user_authentication_failed');
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "authorization_transactions"
      WHERE "id" = ${params.authorizationTransactionId}::uuid FOR UPDATE
    `);
    const transaction = await tx.authorizationTransaction.findUnique({
      where: { id: params.authorizationTransactionId },
      include: { humanClient: true },
    });
    const now = new Date();
    if (!transaction || transaction.status !== 'pending' || transaction.expiresAt <= now
      || transaction.authenticatedUserId !== null || transaction.consumedAt !== null) {
      invalidGrant('authorization_transaction_invalid');
    }
    assertHumanClientProfile(transaction.humanClient);
    const grant = await tx.humanAudienceGrant.findUnique({
      where: {
        humanClientId_audienceId: {
          humanClientId: transaction.humanClientId,
          audienceId: transaction.audienceId,
        },
      },
      include: { audience: true },
    });
    assertHumanAudienceGrant(transaction.audienceId, grant ?? undefined);
    const currentUser = await tx.user.findUnique({ where: { id: user.id } });
    if (!currentUser || currentUser.status !== 'active') invalidGrant('user_inactive');
    const credential = issueAuthorizationCodeCredential();
    const settings = getV1ContractSettings();
    await tx.authorizationTransaction.update({
      where: { id: transaction.id },
      data: { status: 'authenticated', authenticatedUserId: user.id, version: { increment: 1 } },
    });
    await tx.authorizationCode.create({
      data: {
        id: credential.id,
        credentialVerifier: credential.verifier,
        verifierParametersVersion: credential.verifierParametersVersion,
        authorizationTransactionId: transaction.id,
        userId: user.id,
        humanClientId: transaction.humanClientId,
        audienceId: transaction.audienceId,
        redirectUri: transaction.redirectUri,
        expiresAt: expiresAt(now, settings.authorizationCodeTtlSeconds),
      },
    });
    return {
      redirect_uri: transaction.redirectUri,
      state: transaction.state,
      code: credential.wireValue,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function exchangeV1AuthorizationCode(
  params: ExchangeV1AuthorizationCodeParams,
): Promise<V1HumanTokenResult> {
  const client = await prisma.humanClient.findUnique({ where: { clientId: params.clientId } });
  if (!client) throw new V1OAuthError('invalid_client', 'human_client_authentication_failed');
  authenticateHumanClient(client, params.clientId, params.clientAuth);
  const parsed = parseAuthorizationCode(params.code);
  if (!parsed) invalidGrant('authorization_code_invalid');
  const preliminary = await prisma.authorizationCode.findUnique({
    where: { id: parsed.id },
    include: { authorizationTransaction: true },
  });
  if (!preliminary || preliminary.humanClientId !== client.id
    || preliminary.redirectUri !== params.redirectUri
    || !verifyOpaqueSecret(
      parsed.secret,
      preliminary.credentialVerifier,
      preliminary.verifierParametersVersion,
    )) {
    invalidGrant('authorization_code_invalid');
  }
  assertPkce(params.codeVerifier, preliminary.authorizationTransaction.codeChallenge);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "authorization_codes" WHERE "id" = ${parsed.id}::uuid FOR UPDATE
    `);
    const code = await tx.authorizationCode.findUnique({
      where: { id: parsed.id },
      include: { authorizationTransaction: true, user: true, humanClient: true },
    });
    const now = new Date();
    if (!code || code.status !== 'active' || code.expiresAt <= now || code.consumedAt !== null
      || code.authorizationTransaction.status !== 'authenticated'
      || code.authorizationTransaction.authenticatedUserId !== code.userId
      || code.humanClientId !== client.id || code.redirectUri !== params.redirectUri
      || code.user.status !== 'active') {
      invalidGrant('authorization_code_invalid');
    }
    assertHumanClientProfile(code.humanClient);
    const grant = await tx.humanAudienceGrant.findUnique({
      where: {
        humanClientId_audienceId: {
          humanClientId: code.humanClientId,
          audienceId: code.audienceId,
        },
      },
      include: { audience: true },
    });
    assertHumanAudienceGrant(code.audienceId, grant ?? undefined);
    await tx.authorizationCode.update({
      where: { id: code.id },
      data: { status: 'consumed', consumedAt: now, version: { increment: 1 } },
    });
    await tx.authorizationTransaction.update({
      where: { id: code.authorizationTransactionId },
      data: { status: 'consumed', consumedAt: now, version: { increment: 1 } },
    });
    const settings = getV1ContractSettings();
    const sessionId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const absoluteExpiresAt = expiresAt(now, settings.humanSessionAbsoluteTtlSeconds);
    const refreshExpiresAt = expiresAt(now, settings.refreshCredentialTtlSeconds, absoluteExpiresAt);
    const refresh = issueRefreshCredential();
    await tx.humanSession.create({
      data: {
        id: sessionId,
        userId: code.userId,
        humanClientId: code.humanClientId,
        authenticatedAt: now,
        lastRefreshedAt: now,
        absoluteExpiresAt,
      },
    });
    await tx.refreshFamily.create({
      data: { id: familyId, humanSessionId: sessionId, absoluteExpiresAt },
    });
    await tx.humanSession.update({ where: { id: sessionId }, data: { tokenFamilyId: familyId } });
    await tx.refreshCredential.create({
      data: {
        id: refresh.id,
        familyId,
        sessionId,
        userId: code.userId,
        humanClientId: code.humanClientId,
        secretVerifier: refresh.verifier,
        verifierParametersVersion: refresh.verifierParametersVersion,
        expiresAt: refreshExpiresAt,
      },
    });
    await writeHumanSecurityAudit(tx, {
      eventType: 'session.created', result: 'success', requestId: params.requestId,
      userId: code.userId, humanClientId: code.humanClientId,
      clientId: code.humanClient.clientId, sessionId, familyId, credentialId: refresh.id,
    });
    await writeHumanSecurityAudit(tx, {
      eventType: 'refresh.issued', result: 'success', requestId: params.requestId,
      userId: code.userId, humanClientId: code.humanClientId,
      clientId: code.humanClient.clientId, sessionId, familyId, credentialId: refresh.id,
    });
    const signed = signV1HumanAccessToken({
      userId: code.userId,
      clientId: code.humanClient.clientId,
      audience: code.audienceId,
      maximumExpiresAt: Math.floor(absoluteExpiresAt.getTime() / 1000),
    });
    return {
      access_token: signed.token,
      token_type: 'Bearer',
      expires_in: signed.claims.exp - signed.claims.iat,
      refresh_token: refresh.wireValue,
      refresh_expires_in: Math.floor((refreshExpiresAt.getTime() - now.getTime()) / 1000),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
