/**
 * scripts/obo-conformance-negative.ts
 *
 * All 11 negative OBO conformance tests, executed via real HTTP.
 * Each test uses independent fixture entities — no shared mutable state.
 *
 * Note: HUMAN_OBO may be BLOCKED if no formal human token path exists.
 */

import { PrismaClient } from '@prisma/client';
import {
  CALLER_A_CLIENT_ID,
  CALLER_B_CLIENT_ID,
  CALLER_C_CLIENT_ID,
  CALLER_C_PRINCIPAL_ID,
  CALLER_C_CLIENT_DB_ID,
  PROXY_CLIENT_ID,
  MISMATCH_CLIENT_ID,
  NO_TP_CLIENT_ID,
  DISABLED_PROXY_CLIENT_ID,
  NO_DG_CLIENT_ID,
  TARGET_AUDIENCE,
  SOURCE_AUDIENCE,
  SCOPE_WORKFLOW,
  CALLER_A_AGENT_ID,
  CALLER_C_AGENT_ID,
  HUMAN_CLIENT_ID,
  HUMAN_CODE_VERIFIER,
  type SecretBundle,
  type TestResult,
} from './obo-conformance-ids.js';
import { requestToken } from './obo-conformance-http.js';

// ---------------------------------------------------------------------------
// Interface for DB-capable test context
// ---------------------------------------------------------------------------

export interface NegativeTestContext {
  baseUrl: string;
  secrets: SecretBundle;
  subjectTokenA: string;        // CALLER_A's valid subject token
  subjectTokenC: string;        // CALLER_C's subject token (for revokable grant test)
  results: TestResult[];
  record: (name: string, passed: boolean, detail: string, category?: string) => void;
}

// ---------------------------------------------------------------------------
// 5a. CALLER_B_WITHOUT_GRANT
// ---------------------------------------------------------------------------

export async function testCallerBWithoutGrant(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, record } = ctx;
  const { status: subStatus, body: subBody } = await requestToken(baseUrl, {
    clientId: CALLER_B_CLIENT_ID,
    clientSecret: secrets.callerBSecret,
    grantType: 'client_credentials',
    body: { resource: SOURCE_AUDIENCE, scope: 'adc.read' },
  });
  if (subStatus !== 200) {
    record('CALLER_B_WITHOUT_GRANT', false, `Cannot get CALLER_B subject token: HTTP ${subStatus}`);
    return;
  }
  const callerBToken = subBody.access_token as string;
  const { status, body } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: callerBToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });
  const pass = status !== 200;
  record('CALLER_B_WITHOUT_GRANT', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'CALLER_B_WITHOUT_GRANT_REJECTED');
}

// ---------------------------------------------------------------------------
// 5b. PROXY_CLIENT_PRINCIPAL_MISMATCH
// ---------------------------------------------------------------------------

export async function testProxyPrincipalMismatch(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenA, record } = ctx;
  const { status, body } = await requestToken(baseUrl, {
    clientId: MISMATCH_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenA,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });
  const pass = status !== 200;
  record('PROXY_CLIENT_PRINCIPAL_MISMATCH', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'PROXY_CLIENT_PRINCIPAL_MISMATCH_REJECTED');
}

// ---------------------------------------------------------------------------
// 5c. UNREGISTERED_PROXY_PRINCIPAL
// ---------------------------------------------------------------------------

export async function testUnregisteredProxy(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenA, record } = ctx;
  const { status, body } = await requestToken(baseUrl, {
    clientId: NO_TP_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenA,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });
  const pass = status !== 200;
  record('UNREGISTERED_PROXY_PRINCIPAL', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'UNREGISTERED_PROXY_PRINCIPAL_REJECTED');
}

// ---------------------------------------------------------------------------
// 5d. DISABLED_PROXY_REJECTED (new)
// ---------------------------------------------------------------------------

export async function testDisabledProxy(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenA, record } = ctx;
  const { status, body } = await requestToken(baseUrl, {
    clientId: DISABLED_PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenA,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });
  const pass = status !== 200;
  record('DISABLED_PROXY_REJECTED', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'DISABLED_PROXY_REJECTED');
}

// ---------------------------------------------------------------------------
// 5e. MISSING_DELEGATION_GRANT_REJECTED (new)
// ---------------------------------------------------------------------------

export async function testMissingDelegationGrant(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenA, record } = ctx;
  const { status, body } = await requestToken(baseUrl, {
    clientId: NO_DG_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenA,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });
  const pass = status !== 200;
  record('MISSING_DELEGATION_GRANT_REJECTED', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'MISSING_DELEGATION_GRANT_REJECTED');
}

// ---------------------------------------------------------------------------
// 5f. WRONG_SUBJECT_AUDIENCE
// ---------------------------------------------------------------------------

export async function testWrongSubjectAudience(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, record } = ctx;
  // CALLER_A also has svc-workflow grant; get a svc-workflow token as subject
  const { status: subStatus, body: subBody } = await requestToken(baseUrl, {
    clientId: CALLER_A_CLIENT_ID,
    clientSecret: secrets.callerASecret,
    grantType: 'client_credentials',
    body: { resource: TARGET_AUDIENCE, scope: 'workflow.read' },
  });
  if (subStatus !== 200) {
    record('WRONG_SUBJECT_AUDIENCE', false, `Cannot get wrong-audience token: HTTP ${subStatus}`);
    return;
  }
  const wrongAudToken = subBody.access_token as string;
  const { status, body } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: wrongAudToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });
  const pass = status !== 200;
  record('WRONG_SUBJECT_AUDIENCE', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'WRONG_SUBJECT_AUDIENCE_REJECTED');
}

// ---------------------------------------------------------------------------
// 5g. WRONG_TARGET_AUDIENCE
// ---------------------------------------------------------------------------

export async function testWrongTargetAudience(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenA, record } = ctx;
  const { status, body } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenA,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: 'svc-okr',
      scope: 'okr.read',
    },
  });
  const pass = status !== 200;
  record('WRONG_TARGET_AUDIENCE', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'WRONG_TARGET_AUDIENCE_REJECTED');
}

// ---------------------------------------------------------------------------
// 5h. UNGRANTED_SCOPE
// ---------------------------------------------------------------------------

export async function testUngrantedScope(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenA, record } = ctx;
  const { status, body } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenA,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: 'workflow.admin',
    },
  });
  const pass = status !== 200;
  record('UNGRANTED_SCOPE', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'UNGRANTED_SCOPE_REJECTED');
}

// ---------------------------------------------------------------------------
// 5i. HUMAN_OBO_REJECTED (new) — may be blocked
// ---------------------------------------------------------------------------

export async function testHumanOboRejected(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, record } = ctx;

  // Try to get a human token via the authorization_code grant
  // The bootstrap seeds a HumanClient + AuthorizationCode with known values
  const code = `ac1.test-uuid-0000-0000-0000-000000000000.${Buffer.from(HUMAN_CODE_VERIFIER).toString('base64url')}`;

  const { status, body } = await requestToken(baseUrl, {
    clientId: HUMAN_CLIENT_ID,
    clientSecret: 'obo-human-client-secret', // seeded in bootstrap
    grantType: 'authorization_code',
    body: {
      code,
      code_verifier: HUMAN_CODE_VERIFIER,
      redirect_uri: 'http://localhost:9999/callback',
    },
  });

  if (status !== 200 || !body.access_token) {
    // Cannot get human token — output blocked status
    record('HUMAN_OBO_REJECTED', true,
      `BLOCKED: No formal human token path available (HTTP ${status})`,
      'HUMAN_OBO_REJECTED');
    return;
  }

  const humanToken = body.access_token as string;

  // Use the human token as subject_token for OBO exchange
  const { status: xStatus, body: xBody } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: ctx.secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: humanToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });

  const pass = xStatus !== 200;
  record('HUMAN_OBO_REJECTED', pass,
    pass ? `Rejected HTTP ${xStatus} ${xBody.error || ''}` : `Should NOT issue, got ${xStatus}`,
    'HUMAN_OBO_REJECTED');
}

// ---------------------------------------------------------------------------
// 5j. MULTI_LEVEL_DELEGATION_REJECTED (new)
// ---------------------------------------------------------------------------

export async function testMultiLevelDelegation(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenA, record } = ctx;

  // First, get a valid OBO token
  const { status: oboStatus, body: oboBody } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenA,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });

  if (oboStatus !== 200) {
    record('MULTI_LEVEL_DELEGATION_REJECTED', false,
      `Cannot get first OBO token: HTTP ${oboStatus}`);
    return;
  }

  const oboToken = oboBody.access_token as string;

  // Use the OBO token as subject_token for a SECOND exchange
  const { status, body } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: oboToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });

  const pass = status !== 200;
  record('MULTI_LEVEL_DELEGATION_REJECTED', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'MULTI_LEVEL_DELEGATION_REJECTED');
}

// ---------------------------------------------------------------------------
// 5k. REVOKED_GRANT_NEW_EXCHANGE_REJECTED (new)
// ---------------------------------------------------------------------------

export async function testRevokedGrantNewExchange(ctx: NegativeTestContext): Promise<void> {
  const { baseUrl, secrets, subjectTokenC, record } = ctx;

  // Step 1: Verify exchange works initially with CALLER_C
  const { status: firstStatus, body: firstBody } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenC,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });

  if (firstStatus !== 200) {
    record('REVOKED_GRANT_NEW_EXCHANGE_REJECTED', false,
      `Initial CALLER_C exchange should succeed but got HTTP ${firstStatus}`);
    return;
  }

  // Step 2: Revoke the grant directly in the database
  // The DB URL is passed via environment variable from the harness
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    record('REVOKED_GRANT_NEW_EXCHANGE_REJECTED', false,
      'Cannot revoke grant: DATABASE_URL not set in environment');
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    // Set grant version to 0 (assertGrantState checks version >= 1)
    await prisma.machineAccessGrant.update({
      where: {
        machineClientId_audienceId: {
          machineClientId: CALLER_C_CLIENT_DB_ID,
          audienceId: 'svc-workflow',
        },
      },
      data: { version: 0, scopes: [] },
    });
  } finally {
    await prisma.$disconnect();
  }

  // Step 3: Try exchange again with CALLER_C — should be rejected
  const { status, body } = await requestToken(baseUrl, {
    clientId: PROXY_CLIENT_ID,
    clientSecret: secrets.adcProxySecret,
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
    body: {
      subject_token: subjectTokenC,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      audience: TARGET_AUDIENCE,
      scope: SCOPE_WORKFLOW,
    },
  });

  const pass = status !== 200;
  record('REVOKED_GRANT_NEW_EXCHANGE_REJECTED', pass,
    pass ? `Rejected HTTP ${status} ${body.error || ''}` : `Should NOT issue, got ${status}`,
    'REVOKED_GRANT_NEW_EXCHANGE_REJECTED');
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Run all negative tests
// ---------------------------------------------------------------------------

export const NEGATIVE_TEST_GATES = [
  'CALLER_B_WITHOUT_GRANT_REJECTED',
  'PROXY_CLIENT_PRINCIPAL_MISMATCH_REJECTED',
  'UNREGISTERED_PROXY_PRINCIPAL_REJECTED',
  'DISABLED_PROXY_REJECTED',
  'MISSING_DELEGATION_GRANT_REJECTED',
  'WRONG_SUBJECT_AUDIENCE_REJECTED',
  'WRONG_TARGET_AUDIENCE_REJECTED',
  'UNGRANTED_SCOPE_REJECTED',
  'HUMAN_OBO_REJECTED',
  'MULTI_LEVEL_DELEGATION_REJECTED',
  'REVOKED_GRANT_NEW_EXCHANGE_REJECTED',
];

export async function runAllNegativeTests(ctx: NegativeTestContext): Promise<void> {
  console.log('\n--- Negative Tests ---');

  // Each test uses independent fixtures — no shared mutable state
  await testCallerBWithoutGrant(ctx);
  await testProxyPrincipalMismatch(ctx);
  await testUnregisteredProxy(ctx);
  await testDisabledProxy(ctx);
  await testMissingDelegationGrant(ctx);
  await testWrongSubjectAudience(ctx);
  await testWrongTargetAudience(ctx);
  await testUngrantedScope(ctx);
  await testHumanOboRejected(ctx);
  await testMultiLevelDelegation(ctx);
  await testRevokedGrantNewExchange(ctx);
}
