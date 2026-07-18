import type { Prisma } from '@prisma/client';
import { verifyClientSecret } from '../secret.js';
import { getV1AudienceDefinitions } from './contract.js';
import { V1OAuthError } from './errors.js';
import {
  findV1AudienceMismatch,
  type StoredAudienceDefinition,
} from './grant-migration.js';

export interface PresentedClientAuth {
  clientId: string;
  clientSecret: string;
}

export interface HumanClientRecord {
  id: string;
  clientId: string;
  clientType: 'confidential_web' | 'public_browser' | 'native';
  clientAuthenticationMethod: 'none' | 'client_secret_basic';
  credentialVerifier: string | null;
  status: 'active' | 'revoked';
  version: number;
}

export interface HumanAudienceGrantRecord {
  audienceId: string;
  version: number;
  audience: StoredAudienceDefinition;
}

export type HumanAuditDatabase = Pick<Prisma.TransactionClient, 'authSecurityAudit'>;

export interface HumanSecurityEvent {
  eventType: string;
  result: 'success' | 'rejected';
  requestId: string;
  userId?: string | null;
  humanClientId?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
  familyId?: string | null;
  credentialId?: string | null;
  rejectionCategory?: string | null;
  extraDetails?: Record<string, unknown>;
}

export function assertHumanClientProfile(client: HumanClientRecord): void {
  if (client.status !== 'active' || client.version < 1) {
    throw new V1OAuthError('invalid_client', 'human_client_inactive');
  }
  assertHumanClientConfiguration(client);
}

function assertHumanClientConfiguration(client: HumanClientRecord): void {
  if (client.version < 1) {
    throw new V1OAuthError('temporarily_unavailable', 'human_client_profile_invalid');
  }
  const confidential = client.clientType === 'confidential_web';
  if (confidential && (client.clientAuthenticationMethod !== 'client_secret_basic'
    || !client.credentialVerifier)) {
    throw new V1OAuthError('temporarily_unavailable', 'human_client_profile_invalid');
  }
  if (!confidential && (client.clientAuthenticationMethod !== 'none'
    || client.credentialVerifier !== null)) {
    throw new V1OAuthError('temporarily_unavailable', 'human_client_profile_invalid');
  }
}

export function authenticateHumanClient(
  client: HumanClientRecord,
  requestedClientId: string,
  presented: PresentedClientAuth | null,
): void {
  assertHumanClientProfile(client);
  authenticateHumanClientProof(client, requestedClientId, presented);
}

export function authenticateHumanClientProof(
  client: HumanClientRecord,
  requestedClientId: string,
  presented: PresentedClientAuth | null,
): void {
  assertHumanClientConfiguration(client);
  if (requestedClientId !== client.clientId) {
    throw new V1OAuthError('invalid_client', 'human_client_binding_mismatch');
  }
  if (client.clientAuthenticationMethod === 'client_secret_basic') {
    if (!presented || presented.clientId !== client.clientId || !client.credentialVerifier
      || !verifyClientSecret(presented.clientSecret, client.credentialVerifier)) {
      throw new V1OAuthError('invalid_client', 'human_client_authentication_failed');
    }
    return;
  }
  if (presented) {
    throw new V1OAuthError('invalid_client', 'public_client_authentication_not_allowed');
  }
}

export function assertHumanAudienceGrant(
  audienceId: string,
  grant: HumanAudienceGrantRecord | undefined,
): void {
  const runtime = getV1AudienceDefinitions().find((item) => item.audienceId === audienceId);
  if (!runtime?.humanAccessEnabled || !runtime.acceptedPrincipalTypes.includes('user')) {
    throw new V1OAuthError('invalid_target', 'human_audience_invalid');
  }
  if (!grant || grant.version < 1) {
    throw new V1OAuthError('invalid_target', 'human_audience_not_granted');
  }
  const mismatch = findV1AudienceMismatch(runtime, grant.audience);
  if (mismatch) {
    throw new V1OAuthError(
      'temporarily_unavailable',
      `human_audience_registry_mismatch:${mismatch}`,
    );
  }
}

export async function writeHumanSecurityAudit(
  database: HumanAuditDatabase,
  event: HumanSecurityEvent,
): Promise<void> {
  const details: Prisma.InputJsonObject = {
    ...(event.extraDetails ?? {}),
    client_id: event.clientId ?? null,
    rejection_category: event.rejectionCategory ?? null,
  } as Prisma.InputJsonObject;
  await database.authSecurityAudit.create({
    data: {
      eventType: event.eventType,
      result: event.result,
      userId: event.userId ?? null,
      humanClientId: event.humanClientId ?? null,
      humanSessionId: event.sessionId ?? null,
      refreshFamilyId: event.familyId ?? null,
      credentialId: event.credentialId ?? null,
      requestCorrelationId: event.requestId,
      details,
    },
  });
}

export function expiresAt(now: Date, seconds: number, maximum?: Date): Date {
  const candidate = new Date(now.getTime() + seconds * 1000);
  return maximum && maximum < candidate ? maximum : candidate;
}
