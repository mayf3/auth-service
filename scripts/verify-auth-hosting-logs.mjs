#!/usr/bin/env node
/**
 * verify-auth-hosting-logs.mjs — H3 harness for ACC-AH-TLOG / ACC-AH-LOG-001.
 *
 * AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1, contract CTR-AH-LOG-001: NO log
 * surface on the public auth path may contain authorization codes, state /
 * PKCE verifier / challenge, access/refresh tokens or any credential, cookie
 * values, passwords or request bodies, or the query string of /oauth/* and
 * /mobile/callback (code/state arrive there).
 *
 * The harness is designed for the SHADOW stage (non-production): after
 * constructing probe requests that carry synthetic marker code/state/cookie/
 * credential values, it scans every log surface of the chain for
 *   (a) the marker values from the probe spec, and
 *   (b) generic patterns covering ALL CTR-AH-LOG-001 prohibited value classes,
 * and exits non-zero on ANY hit.
 *
 * Surfaces (all optional; unconfigured surfaces are reported as SKIPPED so
 * coverage gaps stay loud, and the run still fails on any real finding):
 *   --nginx-access    PATH   nginx access log          (env AUTH_HOSTING_NGINX_ACCESS_LOG)
 *   --nginx-error     PATH   nginx error log           (env AUTH_HOSTING_NGINX_ERROR_LOG)
 *   --sshd            PATH   Aliyun sshd / auth log    (env AUTH_HOSTING_SSHD_LOG)
 *   --launchd-tunnel  PATH   Mac launchd tunnel log    (env AUTH_HOSTING_LAUNCHD_TUNNEL_LOG)
 *   --auth-stdout     PATH   auth-service stdout log   (env AUTH_HOSTING_AUTH_STDOUT_LOG)
 *   --auth-stderr     PATH   auth-service stderr log   (env AUTH_HOSTING_AUTH_STDERR_LOG)
 *   --probe-spec      PATH   probe spec JSON, shape:
 *                            { "markers": { "authorization_code": "…", "state": "…",
 *                              "pkce_verifier": "…", "pkce_challenge": "…",
 *                              "access_token": "…", "refresh_token": "…",
 *                              "cookie_value": "…", "password": "…",
 *                              "client_secret": "…" } }
 *                            (env AUTH_HOSTING_PROBE_SPEC)
 *   --print-template         print a synthetic probe-spec template and exit 0
 *
 * Exit codes: 0 clean · 1 prohibited value found · 2 config error ·
 *             3 configured file missing/unreadable
 *
 * No secrets are committed or generated here: marker values are operator-
 * supplied synthetic strings. Findings are printed REDACTED — matched regions
 * are masked, so the harness output never re-leaks a secret.
 */

import fs from 'node:fs';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

// ── Scanner core (exported for the unit test in tests/oauth/) ──────────────

/**
 * Generic prohibited-value rules covering the CTR-AH-LOG-001 classes:
 * /oauth|callback query strings, JWT-shaped tokens, credential-bearing query
 * params, cookie values, authorization header values, password fields.
 * Order matters only for report readability.
 */
export function buildStructuralRules() {
  return [
    {
      id: 'OAUTH_OR_CALLBACK_QUERY_STRING',
      description: 'query string on /oauth/* or /mobile/callback (code/state arrive there)',
      // Matches: "GET /oauth/token?x=1", ".../mobile/callback?code=…", JSON keys, etc.
      regex: /\/(?:oauth\/[a-z0-9_.\-/]*|mobile\/callback)[^\s"']*\?[^\s"']+/gi,
    },
    {
      id: 'JWT_LIKE_TOKEN',
      description: 'JWT / JWS compact-serialization-shaped token (access token)',
      regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/g,
    },
    {
      id: 'CREDENTIAL_QUERY_PARAM',
      description: 'credential-bearing query parameter (code/state/token/password/secret/PKCE)',
      regex: /[?&](?:code|state|token|access_token|refresh_token|password|client_secret|code_challenge|code_verifier)=[^\s"'&\]]+/gi,
    },
    {
      id: 'COOKIE_VALUE',
      description: 'cookie header/assignment carrying a value (session + CSRF cookies)',
      regex: /(?:cookie|set-cookie)"?\s*[:=]\s*"?\s*[A-Za-z0-9_-]+=[^;"'\s,}\]\\]+/gi,
    },
    {
      id: 'AUTHORIZATION_VALUE',
      description: 'authorization header value or bearer/basic credential',
      regex: /(?:(?:proxy-)?authorization"?\s*[:=]\s*"?\s*[A-Za-z]+[\s+][A-Za-z0-9+/_=.-]{8,})|(?:\b(?:bearer|basic)\s+[A-Za-z0-9+/_=.-]{16,})/gi,
    },
    {
      id: 'PASSWORD_FIELD',
      description: 'password field with a value',
      regex: /password"?\s*[:=]\s*"?[^\s"',}&\\]{4,}/gi,
    },
  ];
}

/**
 * Builds the full rule set: structural rules plus one literal rule per probe
 * marker. `markers` maps a logical name (e.g. "authorization_code") to the
 * exact synthetic value used in the constructed probe requests.
 */
export function buildScanRules(markers = {}) {
  const rules = buildStructuralRules().map((r) => ({ ...r, kind: 'prohibited-value' }));
  for (const [name, value] of Object.entries(markers)) {
    if (typeof value !== 'string' || value.length < 6) {
      throw new Error(`probe marker "${name}" must be a string of at least 6 characters`);
    }
    rules.push({ id: `MARKER_${name.toUpperCase()}`, description: `probe marker ${name}`, kind: 'marker', literal: value });
  }
  return rules;
}

/** Scan one line; returns [{ ruleId, kind, masked }] — empty when clean. */
export function scanLine(rules, line) {
  const hits = [];
  for (const rule of rules) {
    if (rule.kind === 'marker') {
      let idx = line.indexOf(rule.literal);
      while (idx !== -1) {
        hits.push({ ruleId: rule.id, kind: rule.kind, start: idx, end: idx + rule.literal.length });
        idx = line.indexOf(rule.literal, idx + rule.literal.length);
      }
    } else {
      rule.regex.lastIndex = 0;
      let m = rule.regex.exec(line);
      while (m !== null) {
        hits.push({ ruleId: rule.id, kind: rule.kind, start: m.index, end: m.index + m[0].length });
        if (m.index === rule.regex.lastIndex) rule.regex.lastIndex += 1;
        m = rule.regex.exec(line);
      }
    }
  }
  return hits;
}

/** Mask every matched region so harness output never re-leaks a secret. */
export function redactLine(line, hits) {
  const sorted = [...hits].sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '';
  let pos = 0;
  for (const h of sorted) {
    if (h.start < pos) continue; // already covered by an earlier match
    out += line.slice(pos, h.start) + `‹${h.ruleId}›`;
    pos = h.end;
  }
  out += line.slice(pos);
  return out.length > 240 ? `${out.slice(0, 240)}…` : out;
}

export function printTemplate() {
  console.log(JSON.stringify({
    markers: {
      authorization_code: 'ZZVERIFY-AUTHCODE-0001',
      state: 'ZZVERIFY-STATE-0001',
      pkce_verifier: 'ZZVERIFY-VERIFIER-0001',
      pkce_challenge: 'ZZVERIFY-CHALLENGE-0001',
      access_token: 'ZZVERIFY-ACCESS-0001',
      refresh_token: 'ZZVERIFY-REFRESH-0001',
      cookie_value: 'ZZVERIFY-COOKIE-0001',
      password: 'ZZVERIFY-PASSWORD-0001',
      client_secret: 'ZZVERIFY-SECRET-0001',
    },
  }, null, 2));
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const SURFACES = [
  { flag: '--nginx-access', env: 'AUTH_HOSTING_NGINX_ACCESS_LOG', label: 'nginx access' },
  { flag: '--nginx-error', env: 'AUTH_HOSTING_NGINX_ERROR_LOG', label: 'nginx error' },
  { flag: '--sshd', env: 'AUTH_HOSTING_SSHD_LOG', label: 'sshd/tunnel (Aliyun)' },
  { flag: '--launchd-tunnel', env: 'AUTH_HOSTING_LAUNCHD_TUNNEL_LOG', label: 'launchd tunnel (Mac)' },
  { flag: '--auth-stdout', env: 'AUTH_HOSTING_AUTH_STDOUT_LOG', label: 'auth-service stdout (Mac)' },
  { flag: '--auth-stderr', env: 'AUTH_HOSTING_AUTH_STDERR_LOG', label: 'auth-service stderr (Mac)' },
];

function parseArgs(argv) {
  const args = { flags: new Set(), options: new Map() };
  const valueFlags = new Set(SURFACES.map((s) => s.flag));
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--print-template') args.flags.add(a);
    else if (a === '--probe-spec' || valueFlags.has(a)) {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${a} requires a path argument`);
      args.options.set(a, value);
      i += 1;
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

async function scanFile(rules, filePath, label, report) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  let findings = 0;
  for await (const line of rl) {
    lineNo += 1;
    const hits = scanLine(rules, line);
    if (hits.length > 0) {
      findings += hits.length;
      for (const ruleId of [...new Set(hits.map((h) => h.ruleId))]) {
        report.hit(`${label}:${filePath}:${lineNo} [${ruleId}] ${redactLine(line, hits)}`);
      }
    }
  }
  return { lines: lineNo, findings };
}

export async function runCli(argv, out = console) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    out.error(`CONFIG ERROR: ${err.message}\n(see --print-template and the header of this script for usage)`);
    return 2;
  }

  if (args.flags.has('--print-template')) {
    printTemplate();
    return 0;
  }

  const surfaces = SURFACES.map((s) => ({
    ...s,
    path: args.options.get(s.flag) ?? process.env[s.env] ?? undefined,
  }));
  const probeSpecPath = args.options.get('--probe-spec') ?? process.env.AUTH_HOSTING_PROBE_SPEC;

  if (!probeSpecPath && surfaces.every((s) => !s.path)) {
    out.error('CONFIG ERROR: no log surface and no --probe-spec configured — refusing to run as a silent no-op.');
    out.error('Configure at least one surface via flags or AUTH_HOSTING_* env; see the header of this script.');
    return 2;
  }

  let rules = buildScanRules();
  if (probeSpecPath) {
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(probeSpecPath, 'utf8'));
    } catch (err) {
      out.error(`CONFIG ERROR: cannot read probe spec ${probeSpecPath}: ${err.message}`);
      return 2;
    }
    try {
      rules = buildScanRules(spec.markers ?? {});
    } catch (err) {
      out.error(`CONFIG ERROR: invalid probe spec: ${err.message}`);
      return 2;
    }
    out.log(`probe spec: ${probeSpecPath} (${Object.keys(spec.markers ?? {}).length} markers)`);
  } else {
    out.log('WARNING: no --probe-spec given — scanning structural prohibited-value rules only; marker sweep SKIPPED.');
  }

  const findings = [];
  const report = { hit: (line) => findings.push(line) };
  const summary = [];
  let fileErrors = 0;
  for (const surface of surfaces) {
    if (!surface.path) {
      summary.push(`  SKIPPED  ${surface.label} (no path configured)`);
      continue;
    }
    try {
      const stat = fs.statSync(surface.path);
      if (!stat.isFile()) throw new Error('not a regular file');
    } catch (err) {
      fileErrors += 1;
      summary.push(`  ERROR    ${surface.label}: ${surface.path} (${err.message})`);
      continue;
    }
    const { lines, findings: n } = await scanFile(rules, surface.path, surface.label, report);
    summary.push(`  scanned  ${surface.label}: ${surface.path} (${lines} lines, ${n} findings)`);
  }

  out.log('surface summary:');
  for (const line of summary) out.log(line);
  if (findings.length > 0) {
    out.log(`\nCTR-AH-LOG-001 VIOLATION — ${findings.length} prohibited-value hit(s) (output redacted):`);
    for (const line of findings) out.log(`  ${line}`);
    return 1;
  }
  if (fileErrors > 0) {
    out.error('\nconfigured log file(s) missing/unreadable — coverage incomplete');
    return 3;
  }
  out.log('\nCLEAN: no CTR-AH-LOG-001 prohibited value found on any configured surface.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exit = await runCli(process.argv.slice(2));
  process.exitCode = exit;
}
