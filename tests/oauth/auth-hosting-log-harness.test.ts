/**
 * Unit tests for the CTR-AH-LOG-001 log-verification harness scanner
 * (scripts/verify-auth-hosting-logs.mjs — ACC-AH-LOG-001 negative log scan).
 *
 * Covers: probe-marker detection, detection of EVERY prohibited value class
 * of CTR-AH-LOG-001 (oauth/callback query strings, JWT-shaped tokens,
 * credential query params, cookie values, authorization values, password
 * fields), the clean-log pass case, and redaction (harness output must never
 * re-leak a matched secret). The script is imported dynamically because it is
 * a plain .mjs CLI with exports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  buildScanRules,
  buildStructuralRules,
  scanLine,
  redactLine,
} = await import('../../scripts/verify-auth-hosting-logs.mjs');

const MARKERS = {
  authorization_code: 'ZZVERIFY-AUTHCODE-0001',
  state: 'ZZVERIFY-STATE-0001',
  pkce_verifier: 'ZZVERIFY-VERIFIER-0001',
  cookie_value: 'ZZVERIFY-COOKIE-0001',
  access_token: 'ZZVERIFY-ACCESS-0001',
  password: 'ZZVERIFY-PASSWORD-0001',
};
const rules = buildScanRules(MARKERS);

function ruleIds(line) {
  return scanLine(rules, line).map((h) => h.ruleId);
}

describe('auth-hosting log scanner — clean logs pass (CTR-AH-LOG-001 negative scan)', () => {
  it('finds nothing in realistic clean log lines from every surface', () => {
    const cleanLines = [
      // nginx access ($uri format — no query string, per CTR-AH-LOG-001)
      '192.0.2.10 [10/Sep/2026:01:07:09 +0000] "GET /oauth/authorize/ui HTTP/2.0" 200 5 "curl/8.7.1"',
      '192.0.2.10 [10/Sep/2026:01:07:09 +0000] "POST /oauth/token HTTP/2.0" 401 0 "-"',
      '192.0.2.10 [10/Sep/2026:01:07:09 +0000] "GET /mobile/callback HTTP/2.0" 400 0 "-"',
      '192.0.2.10 [10/Sep/2026:01:07:09 +0000] "GET /.well-known/jwks.json HTTP/2.0" 200 36 "-"',
      // nginx error log (no request body)
      '2026/09/10 01:07:09 [error] 123#456: *9 connect() failed (111: Connection refused) while connecting to upstream, client: 192.0.2.10, server: auth.mayf3.com, request: "GET /oauth/authorize/ui HTTP/2.0", upstream: "http://127.0.0.1:18794/oauth/authorize/ui"',
      // sshd / tunnel
      'Sep 10 01:07:09 aliyun sshd[777]: Accepted publickey for agentcore-auth-tunnel from 198.51.100.1 port 55022 ssh2: ED25519 SHA256:abcdefghij',
      'Sep 10 01:07:10 aliyun sshd[777]: remote forward success for: listen 127.0.0.1 port 18794',
      // Mac launchd tunnel
      'auth-tunnel: debug1: Connection to port 18794 forwarding to 127.0.0.1 port 4001 requested.',
      // auth-service stdout/stderr
      '  🔐 auth-service v1.0.0',
      '  🏷️  issuer: auth-service | audience: unified-platform',
      '[SIGTERM] Shutting down...',
    ];
    for (const line of cleanLines) {
      assert.deepEqual(scanLine(rules, line), [], `clean line must not hit: ${line}`);
    }
  });

  it('an /oauth/* or /mobile/callback path WITHOUT query string stays clean', () => {
    assert.deepEqual(ruleIds('"GET /oauth/authorize/ui HTTP/2.0" 200'), []);
    assert.deepEqual(ruleIds('"GET /mobile/callback HTTP/2.0" 400'), []);
    assert.deepEqual(ruleIds('upstream: "http://127.0.0.1:18794/oauth/token"'), []);
  });
});

describe('auth-hosting log scanner — probe marker detection', () => {
  it('flags every embedded marker value with its named MARKER rule', () => {
    assert.ok(ruleIds('access log fake line with ZZVERIFY-AUTHCODE-0001 inside').includes('MARKER_AUTHORIZATION_CODE'));
    assert.ok(ruleIds('ZZVERIFY-STATE-0001 echoed back').includes('MARKER_STATE'));
    assert.ok(ruleIds('pkce ZZVERIFY-VERIFIER-0001 leaked').includes('MARKER_PKCE_VERIFIER'));
    assert.ok(ruleIds('cookie __Host-x=ZZVERIFY-COOKIE-0001').includes('MARKER_COOKIE_VALUE'));
    assert.ok(ruleIds('Bearer ZZVERIFY-ACCESS-0001').includes('MARKER_ACCESS_TOKEN'));
    assert.ok(ruleIds('password ZZVERIFY-PASSWORD-0001').includes('MARKER_PASSWORD'));
  });

  it('flags a marker appearing multiple times on one line once per occurrence', () => {
    const hits = scanLine(rules, 'ZZVERIFY-AUTHCODE-0001 then ZZVERIFY-AUTHCODE-0001');
    assert.equal(hits.filter((h) => h.ruleId === 'MARKER_AUTHORIZATION_CODE').length, 2);
  });
});

describe('auth-hosting log scanner — prohibited value classes (CTR-AH-LOG-001)', () => {
  it('detects a query string on /oauth/* and /mobile/callback', () => {
    assert.ok(
      ruleIds('"GET /oauth/authorize/ui?client_id=x&state=abc HTTP/1.1" 200').includes('OAUTH_OR_CALLBACK_QUERY_STRING'),
    );
    assert.ok(
      ruleIds('"GET /mobile/callback?code=abc&state=def HTTP/1.1" 400').includes('OAUTH_OR_CALLBACK_QUERY_STRING'),
    );
    assert.ok(
      ruleIds('"GET /oauth/token?x=1 HTTP/1.1" 405').includes('OAUTH_OR_CALLBACK_QUERY_STRING'),
    );
  });

  it('detects JWT-shaped tokens anywhere in a line', () => {
    const jwt = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${'a'.repeat(20)}.${'b'.repeat(20)}`;
    const ids = ruleIds(`auth-service stdout noise ${jwt} end`);
    assert.ok(ids.includes('JWT_LIKE_TOKEN'), `expected JWT_LIKE_TOKEN in ${JSON.stringify(ids)}`);
  });

  it('detects credential-bearing query parameters on any path', () => {
    for (const param of ['code', 'state', 'access_token', 'refresh_token', 'password', 'client_secret', 'code_verifier', 'code_challenge']) {
      const line = `"GET /somewhere?${param}=sensitivevalue123 HTTP/1.1" 404`;
      assert.ok(
        ruleIds(line).includes('CREDENTIAL_QUERY_PARAM'),
        `expected CREDENTIAL_QUERY_PARAM for ${param}`,
      );
    }
  });

  it('detects cookie values (session and CSRF cookies)', () => {
    assert.ok(ruleIds('"Cookie: __Host-auth_session=abc123def; other=v"').includes('COOKIE_VALUE'));
    assert.ok(ruleIds('set-cookie: __Host-zzcsrf=tokenvalue; Path=/').includes('COOKIE_VALUE'));
    assert.ok(ruleIds('"cookie":"session=deadbeef00112233"').includes('COOKIE_VALUE'));
  });

  it('detects authorization header values and bearer/basic credentials', () => {
    assert.ok(ruleIds('"Authorization: Bearer abcdef1234567890abcdef"').includes('AUTHORIZATION_VALUE'));
    assert.ok(ruleIds('"Authorization: Basic dXNlcjpwYXNzd29yZA=="').includes('AUTHORIZATION_VALUE'));
    assert.ok(ruleIds('authorization: Bearer rawtokenvalue12345678').includes('AUTHORIZATION_VALUE'));
  });

  it('detects password fields with values', () => {
    assert.ok(ruleIds('body={"email":"a@b.c","password":"hunter2secret"}').includes('PASSWORD_FIELD'));
    assert.ok(ruleIds('password: opensesame123').includes('PASSWORD_FIELD'));
  });

  it('detects the nginx core error-log tunnel-down leak (request line carries code/state)', () => {
    // This is the exact shape CTR-AH-LOG-001 forbids: nginx `connect() failed`
    // error lines embed the raw request line, so a tunnel-down 502 used to
    // write code/state to the error log. The sensitive locations run
    // `error_log … crit` so such lines must never exist; the scanner must
    // flag them if they ever do.
    const line = '2026/09/10 03:00:00 [error] 123#123: *1 connect() failed (111: Connection refused) while connecting to upstream, client: 203.0.113.10, server: auth.mayf3.com, request: "GET /mobile/callback?code=ZZVERIFY-AUTHCODE-0002&state=ZZVERIFY-STATE-0002 HTTP/1.1", upstream: "http://127.0.0.1:18794/mobile/callback?code=ZZVERIFY-AUTHCODE-0002&state=ZZVERIFY-STATE-0002", host: "auth.mayf3.com"';
    const ids = ruleIds(line);
    assert.ok(ids.includes('CREDENTIAL_QUERY_PARAM'), `expected CREDENTIAL_QUERY_PARAM in ${JSON.stringify(ids)}`);
    assert.ok(ids.includes('OAUTH_OR_CALLBACK_QUERY_STRING'), `expected OAUTH_OR_CALLBACK_QUERY_STRING in ${JSON.stringify(ids)}`);
  });

  it('accepts a crit-suppressed shape: no request line reaches the error log', () => {
    const line = '2026/09/10 03:00:01 [warn] 124#124: upstream response is buffered to a temporary file while reading upstream';
    assert.deepEqual(scanLine(rules, line), [], 'clean crit-level line must not hit');
  });
});

describe('auth-hosting log scanner — redaction', () => {
  it('masks every matched region so output never re-leaks the secret', () => {
    const line = 'leak ZZVERIFY-AUTHCODE-0001 and Bearer ZZVERIFY-ACCESS-0001 done';
    const hits = scanLine(rules, line);
    assert.ok(hits.length >= 2);
    const redacted = redactLine(line, hits);
    assert.equal(redacted.includes('ZZVERIFY-AUTHCODE-0001'), false, 'marker must not survive redaction');
    assert.equal(redacted.includes('ZZVERIFY-ACCESS-0001'), false, 'token must not survive redaction');
    assert.ok(redacted.includes('‹MARKER_AUTHORIZATION_CODE›'));
    // The bearer region is tagged by the rule whose match starts first and
    // spans the whole "Bearer <value>" — the inner marker is fully masked too.
    assert.ok(redacted.includes('‹AUTHORIZATION_VALUE›'));
    assert.ok(redacted.includes('leak ') && redacted.includes(' done'), 'unmatched regions stay readable');
  });

  it('truncates extremely long findings instead of dumping the line', () => {
    const long = 'x'.repeat(500) + ' ZZVERIFY-STATE-0001';
    const redacted = redactLine(long, scanLine(rules, long));
    assert.ok(redacted.length <= 241);
  });
});

describe('auth-hosting log scanner — rule set sanity', () => {
  it('builds marker-free rules and validates marker values', () => {
    const structural = buildStructuralRules();
    const ids = structural.map((r) => r.id);
    assert.deepEqual(ids, [
      'OAUTH_OR_CALLBACK_QUERY_STRING',
      'JWT_LIKE_TOKEN',
      'CREDENTIAL_QUERY_PARAM',
      'COOKIE_VALUE',
      'AUTHORIZATION_VALUE',
      'PASSWORD_FIELD',
    ]);
    assert.throws(() => buildScanRules({ short: 'ab' }), /at least 6 characters/);
  });
});
