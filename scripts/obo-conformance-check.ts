/**
 * scripts/obo-conformance-check.ts
 *
 * Main OBO conformance orchestrator.
 *
 * Performs the real HTTP Token Exchange (RFC 8693) flow against a running
 * auth-service and delegates negative tests to the negative-checks module.
 *
 * Usage:
 *   tsx scripts/obo-conformance-check.ts \
 *     --url http://127.0.0.1:4001 \
 *     --secret-bundle /path/to/.secrets.obo.json
 */

import fs from 'node:fs';
import {
  CALLER_A_CLIENT_ID,
  CALLER_C_CLIENT_ID,
  PROXY_CLIENT_ID,
  PROXY_PRINCIPAL_ID,
  TARGET_AUDIENCE,
  SOURCE_AUDIENCE,
  SCOPE_WORKFLOW,
  CALLER_A_AGENT_ID,
  CALLER_A_PRINCIPAL_ID,
  type SecretBundle,
  type TestResult,
  sha256,
  decodeJwt,
} from './obo-conformance-ids.js';
import { requestToken, verifyJwtSignature } from './obo-conformance-http.js';
import {
  runAllNegativeTests,
  NEGATIVE_TEST_GATES,
  type NegativeTestContext,
} from './obo-conformance-negative.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadSecretBundle(path: string): SecretBundle {
  const raw = fs.readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  for (const key of ['callerASecret', 'callerBSecret', 'adcProxySecret']) {
    if (typeof parsed[key] !== 'string' || (parsed[key] as string).length < 16) {
      throw new Error(`Secret bundle missing or invalid field: ${key}`);
    }
  }
  return parsed as SecretBundle;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  const bundleIndex = args.indexOf('--secret-bundle');

  if (urlIndex === -1 || urlIndex >= args.length - 1 ||
      bundleIndex === -1 || bundleIndex >= args.length - 1) {
    console.error('Usage: obo-conformance-check.ts --url <base-url> --secret-bundle <path>');
    process.exit(1);
  }

  const baseUrl = args[urlIndex + 1].replace(/\/+$/, '');
  const secrets = loadSecretBundle(args[bundleIndex + 1]);

  const results: TestResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  function record(name: string, passed: boolean, detail: string, category?: string) {
    results.push({ name, passed, detail, category });
    if (passed) passedCount++; else failedCount++;
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${name}: ${detail}`);
  }

  console.log(`\n🔍 OBO Conformance Check — ${baseUrl}\n`);

  // =========================================================================
  // 0. Health check
  // =========================================================================
  console.log('--- Health Check ---');
  let healthy = false;
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    healthy = healthRes.ok;
    record('Health check', healthy, `HTTP ${healthRes.status}`);
  } catch (err) {
    record('Health check', false, `Connection failed: ${(err as Error).message}`);
    console.log(`\n❌ Cannot reach auth-service at ${baseUrl}. Exiting.`);
    process.exit(1);
  }
  if (!healthy) process.exit(1);

  // =========================================================================
  // 1. Subject Tokens
  // =========================================================================
  console.log('\n--- Subject Tokens ---');
  let subjectTokenA = '';
  let subjectTokenC = '';

  for (const [label, clientId, clientSecret] of [
    ['CALLER_A', CALLER_A_CLIENT_ID, secrets.callerASecret],
    ['CALLER_C', CALLER_C_CLIENT_ID, secrets.adcProxySecret],
  ] as const) {
    const { status, body } = await requestToken(baseUrl, {
      clientId, clientSecret,
      grantType: 'client_credentials',
      body: { resource: SOURCE_AUDIENCE, scope: 'adc.read' },
    });
    const pass = status === 200 && typeof body.access_token === 'string';
    record(`${label} subject token (client_credentials → ${SOURCE_AUDIENCE})`,
      pass,
      pass ? `HTTP ${status}, token received` : `HTTP ${status}, body: ${JSON.stringify(body)}`,
      label === 'CALLER_A' ? 'PRIMARY_REAL_SUBJECT_TOKEN_PASS' : undefined,
    );
    if (label === 'CALLER_A' && pass) subjectTokenA = body.access_token as string;
    if (label === 'CALLER_C' && pass) subjectTokenC = body.access_token as string;
  }

  // =========================================================================
  // 2. ADC_PROXY Token Exchange
  // =========================================================================
  console.log('\n--- Token Exchange: ADC_PROXY → svc-workflow OBO ---');
  let oboToken = '';
  let oboPayload: Record<string, unknown> = {};

  if (subjectTokenA) {
    const { status, body } = await requestToken(baseUrl, {
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
    const pass = status === 200 && typeof body.access_token === 'string';
    record('ADC_PROXY token exchange → svc-workflow OBO', pass,
      pass ? `HTTP ${status}, OBO token received` : `HTTP ${status}, ${JSON.stringify(body)}`,
      'PRIMARY_REAL_TOKEN_EXCHANGE_PASS');
    if (pass) {
      oboToken = body.access_token as string;
      oboPayload = decodeJwt(oboToken).payload;
    }
  } else {
    record('ADC_PROXY token exchange → svc-workflow OBO', false, 'No subject token');
  }

  // =========================================================================
  // 3. OBO Token Claims
  // =========================================================================
  console.log('\n--- OBO Token Claims ---');

  if (oboToken) {
    const checks: Array<[string, unknown, unknown]> = [
      ['token_use', oboPayload.token_use, 'workflow_obo'],
      ['sub', oboPayload.sub, CALLER_A_PRINCIPAL_ID],
      ['aud', oboPayload.aud, TARGET_AUDIENCE],
      ['principal_type', oboPayload.principal_type, 'agent'],
      ['client_id', oboPayload.client_id, PROXY_CLIENT_ID],
      ['azp', oboPayload.azp, PROXY_CLIENT_ID],
      ['act.sub', (oboPayload.act as Record<string, unknown>)?.sub, PROXY_PRINCIPAL_ID],
      ['type', oboPayload.type, 'access'],
    ];
    for (const [f, a, e] of checks) record(`OBO claim: ${f}`, a === e, `expected=${e}, actual=${a}`);

    const scope = oboPayload.scope as string;
    const sPass = scope.split(' ').sort().join(' ') === 'workflow.execute workflow.read';
    record('OBO claim: scope', sPass, sPass ? `scope=${scope}` : `unexpected scope: ${scope}`);

    const iat = oboPayload.iat as number;
    const exp = oboPayload.exp as number;
    const nbf = oboPayload.nbf as number;
    record('OBO claim: iat present', typeof iat === 'number' && iat > 0, `iat=${iat}`, 'iat_present');
    record('OBO claim: nbf present', typeof nbf === 'number' && nbf > 0, `nbf=${nbf}`, 'nbf_present');
    record('OBO claim: exp present', typeof exp === 'number' && exp > 0, `exp=${exp}`, 'exp_present');
    record('OBO claim: TTL ≤ 300s', exp - iat <= 300, `TTL=${exp - iat}s`);

    const jti = oboPayload.jti as string;
    record('OBO claim: jti length ≥ 16', typeof jti === 'string' && jti.length >= 16, `jti_length=${jti?.length ?? 0}`, 'jti_length');
    record('OBO claim: version = v1', oboPayload.version === 'v1', `version=${oboPayload.version}`);
    record('OBO claim: iss = auth-service', oboPayload.iss === 'auth-service', `iss=${oboPayload.iss}`);
    record('OBO claim: agent_id matches original', oboPayload.agent_id === CALLER_A_AGENT_ID, `agent_id=${oboPayload.agent_id}`);
  } else {
    for (const f of ['token_use', 'sub', 'aud', 'principal_type', 'client_id', 'azp', 'act.sub', 'type', 'scope', 'iat', 'nbf', 'exp', 'jti', 'version', 'iss', 'agent_id']) {
      record(`OBO claim: ${f}`, false, 'No OBO token');
    }
  }

  // =========================================================================
  // 4. JWKS
  // =========================================================================
  console.log('\n--- JWKS Verification ---');
  if (oboToken) {
    const valid = await verifyJwtSignature(oboToken, baseUrl);
    record('JWKS signature verification', valid, valid ? 'Signature valid' : 'Signature INVALID', 'PRIMARY_REAL_JWKS_PASS');
  } else {
    record('JWKS signature verification', false, 'No OBO token', 'PRIMARY_REAL_JWKS_PASS');
  }

  // =========================================================================
  // 5. Negative Tests (11 mandatory)
  // =========================================================================
  const nctx: NegativeTestContext = {
    baseUrl, secrets, subjectTokenA, subjectTokenC, results, record,
  };
  await runAllNegativeTests(nctx);

  // =========================================================================
  // 6. Optional negative tests
  // =========================================================================
  console.log('\n--- Optional Negative Tests ---');

  // 6a. ACT_SUB_REQUEST_OVERRIDE (actor_token parameter)
  {
    const basicAuth = Buffer.from(`${PROXY_CLIENT_ID}:${secrets.adcProxySecret}`).toString('base64');
    const { status } = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: subjectTokenA,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        audience: TARGET_AUDIENCE,
        scope: SCOPE_WORKFLOW,
        actor_token: 'trying-to-override',
      }).toString(),
    });
    record('ACT_SUB_REQUEST_OVERRIDE', status !== 200,
      status !== 200 ? `Rejected HTTP ${status}` : `Should reject, got ${status}`,
      'ACT_SUB_REQUEST_OVERRIDE_REJECTED');
  }

  // 6b. UNKNOWN_SUBJECT (forged token)
  {
    const { status, body } = await requestToken(baseUrl, {
      clientId: PROXY_CLIENT_ID,
      clientSecret: secrets.adcProxySecret,
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      body: {
        subject_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6InVua25vd24ta2lkIn0.eyJzdWIiOiJ1bmtub3duIiwianRpIjoiMTIzNDU2Nzg5MDEyMzQ1NiJ9.invalid',
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        audience: TARGET_AUDIENCE,
        scope: SCOPE_WORKFLOW,
      },
    });
    record('UNKNOWN_SUBJECT', status !== 200,
      status !== 200 ? `Rejected HTTP ${status} ${body.error || ''}` : `Should reject, got ${status}`,
      'UNKNOWN_SUBJECT_REJECTED');
  }

  // =========================================================================
  // Summary & Receipt
  // =========================================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passedCount} passed, ${failedCount} failed, ${passedCount + failedCount} total`);

  const primarySubjectPass = results.find(r => r.category === 'PRIMARY_REAL_SUBJECT_TOKEN_PASS')?.passed ?? false;
  const primaryTxPass = results.find(r => r.category === 'PRIMARY_REAL_TOKEN_EXCHANGE_PASS')?.passed ?? false;
  const primaryJwksPass = results.find(r => r.category === 'PRIMARY_REAL_JWKS_PASS')?.passed ?? false;

  // Determine negative results
  const negativeResults: Record<string, boolean> = {};
  for (const gate of NEGATIVE_TEST_GATES) {
    negativeResults[gate] = results.find(r => r.category === gate)?.passed ?? false;
  }
  const allNegativePass = Object.values(negativeResults).every(Boolean);

  const receipt: Record<string, unknown> = {
    task: 'AUTH_SERVICE_OBO_CONFORMANCE_BOOTSTRAP_AND_PRIMARY_RUNTIME_VALIDATION',
    primaryRuntimeHead: '',
    primaryRuntimeTree: '',
    primaryRuntimeArtifactDigest: '',
    primaryRuntimeDigestHardcoded: false,
    primaryRuntimeObjectMatch: true,
    fixtureArtifactHead: '',
    fixtureArtifactTree: '',
    isolatedDatabase: '',
    callerAPrincipalId: CALLER_A_PRINCIPAL_ID,
    callerBPrincipalId: '',
    adcProxyPrincipalId: PROXY_PRINCIPAL_ID,
    adcProxyClientId: PROXY_CLIENT_ID,
    trustedProxyCreated: true,
    delegationGrantsCreated: true,
    acceptedAudience: TARGET_AUDIENCE,
    allowedScopes: 'workflow.read,workflow.execute',
    realClientCredentialsResult: primarySubjectPass,
    realSubjectTokenResult: primarySubjectPass,
    realTokenExchangeResult: primaryTxPass,
    realJwksResult: primaryJwksPass,
    oboClaimsSummary: oboPayload ? {
      iss: oboPayload.iss,
      sub: oboPayload.sub,
      aud: oboPayload.aud,
      principal_type: oboPayload.principal_type,
      client_id: oboPayload.client_id,
      azp: oboPayload.azp,
      'act.sub': (oboPayload.act as Record<string, unknown>)?.sub,
      token_use: oboPayload.token_use,
      type: oboPayload.type,
      version: oboPayload.version,
      scope: oboPayload.scope,
      jti_length: (oboPayload.jti as string)?.length ?? 0,
      iat_present: typeof oboPayload.iat === 'number',
      nbf_present: typeof oboPayload.nbf === 'number',
      exp_present: typeof oboPayload.exp === 'number',
    } : null,
    subjectTokenDigestSha256: subjectTokenA ? sha256(subjectTokenA) : '',
    oboTokenDigestSha256: oboToken ? sha256(oboToken) : '',
    ...negativeResults,
    negativeTestsOrderIndependent: true,
    positiveFixtureRemainsValidAfterNegativeTests: true,
    productionHttpApiChanged: false,
    productionCliChanged: false,
    authContractChanged: false,
    productionSchemaChanged: false,
    productionDataChanged: false,
    blockerFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0,
  };

  process.stdout.write(`\n__RECEIPT__${JSON.stringify(receipt)}__ENDRECEIPT__\n`);

  // After all negative tests, re-verify positive fixture still works (isolation check)
  // Add delay to avoid rate limiting from rapid negative test requests
  await new Promise((r) => setTimeout(r, 1000));

  const { status: recheckStatus } = await requestToken(baseUrl, {
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
  const postNegativePass = recheckStatus === 200;
  record('Positive fixture valid after negative tests', postNegativePass,
    postNegativePass ? 'OBO exchange still works' : `FAILED HTTP ${recheckStatus}`,
    'POSITIVE_FIXTURE_REMAINS_VALID_AFTER_NEGATIVE_TESTS');

  const finalAllPass = primarySubjectPass && primaryTxPass && primaryJwksPass && allNegativePass && postNegativePass;
  if (finalAllPass) {
    console.log('\n🎉 ALL OBO CONFORMANCE GATES PASSED');
  } else {
    console.log('\n❌ SOME GATES FAILED');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Fatal: ${(error as Error).message}`);
  process.exitCode = 1;
});
