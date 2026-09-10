#!/usr/bin/env bash
# deploy/auth-hosting/shadow-compose-probe.sh — NON-PRODUCTION shadow tool.
#
# Executes the local composition probe matrix described in README.md step 2
# against the scratch nginx edge built from nginx-auth-mayf3.conf.example, and
# ASSERTS the edge contract (CTR-AH-PATHS-001 / CTR-AH-EDGE-001 /
# CTR-AH-EDGE-002) using a recording upstream inspector:
#
#   phase 1  the six proxied allow-list pairs arrive at the upstream inspector;
#            /.well-known/assetlinks.json is served STATICALLY (never proxied)
#   phase 2  the deny matrix (non-allowed paths, methods, encodings) arrives as
#            ZERO upstream entries
#   phase 3  forged Forwarded / X-Forwarded-For / X-Real-IP / X-AgentCore-* are
#            deleted; Host pinned; X-Forwarded-Proto https; exactly one XFF hop
#            equal to the edge-seen remote address
#
# Synthetic ZZ* values only — no real credentials. Exit 0 = contract holds.
#
# Usage: see README.md step 2. env: PORT (edge https port, default 18443),
# UPSTREAM_SEEN (jsonl file written by the inspector, default <scratch>/upstream-seen.jsonl).
set -euo pipefail

PORT=${PORT:-18443}
BASE="https://auth.mayf3.com:${PORT}"
UPSTREAM_SEEN=${UPSTREAM_SEEN:-/tmp/auth-hosting-shadow/upstream-seen.jsonl}
export no_proxy='*' NO_PROXY='*'   # the scratch edge is loopback-only; never via a proxy
CURL="curl -ks --resolve auth.mayf3.com:${PORT}:127.0.0.1"

fail() { echo "COMPOSE-PROBE FAIL: $*" >&2; exit 1; }

seen_count() { [ -f "$UPSTREAM_SEEN" ] && wc -l < "$UPSTREAM_SEEN" | tr -d ' ' || echo 0; }

req() { # method path [extra curl args...] -> http status
  local method=$1 path=$2; shift 2
  if [ "$method" = HEAD ]; then
    $CURL -I -o /dev/null -w '%{http_code}' "$BASE$path" "$@"
  else
    $CURL -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" "$@"
  fi
}

echo "== phase 1: allow-list pairs reach the upstream inspector =="
: > "$UPSTREAM_SEEN"
s1=$(req GET  '/oauth/authorize/ui?response_type=code&client_id=ZZCLIENT&state=ZZSTATE&code_challenge=ZZCHALLENGE')
s2=$(req POST /oauth/authorize/ui -H 'Content-Type: application/x-www-form-urlencoded' -H 'Origin: https://auth.mayf3.com' -H 'Cookie: __Host-zzsession=ZZVERIFY-COOKIE-0001' --data 'authorization_transaction_id=ZZTXN&csrf_token=ZZCSRF&email=ZZEMAIL&password=ZZVERIFY-PASSWORD-0001')
s3=$(req GET  '/mobile/callback?code=ZZVERIFY-AUTHCODE-0001&state=ZZVERIFY-STATE-0001')
s4=$(req POST /oauth/token -H 'Content-Type: application/x-www-form-urlencoded' -H 'Authorization: Basic WlpDTElFTlQ6WlpTRUNSRVQ=' --data 'grant_type=authorization_code&code=ZZVERIFY-AUTHCODE-0001&code_verifier=ZZVERIFY-VERIFIER-0001')
s5=$(req POST /oauth/logout -H 'Authorization: Bearer ZZVERIFY-ACCESS-0001')
s6=$(req GET  /.well-known/jwks.json)
s7=$(req GET  /.well-known/assetlinks.json)
echo "  ui GET=$s1 POST=$s2 callback=$s3 token=$s4 logout=$s5 jwks=$s6 assetlinks=$s7"
[ "$(seen_count)" -eq 6 ] || fail "expected exactly 6 upstream arrivals from the 7 pairs (assetlinks must be static), got $(seen_count)"
grep -q 'sha256-pinned' <($CURL "$BASE/.well-known/assetlinks.json") || fail "assetlinks.json is not served from the static root"

echo "== phase 2: deny matrix — zero byte arrival (CTR-AH-PATHS-001) =="
: > "$UPSTREAM_SEEN"
deny_status=''
deny() { # method path
  local s; s=$(req "$1" "$2")
  deny_status="$deny_status
  $1 $2 -> $s"
  case "$s" in 4*) return;; *) fail "$1 $2 must be rejected with 4xx, got $s";; esac
}
deny GET    /api/health
deny POST   /api/auth/register
deny GET    /api/services
deny GET    '/oauth/authorize?client_id=ZZCLIENT'
deny POST   /oauth/authorize/authenticate
deny GET    /.well-known/security.txt
deny GET    /random
deny DELETE /oauth/token
deny PATCH  /oauth/logout
deny PUT    /mobile/callback
deny POST   /.well-known/jwks.json
deny POST   /.well-known/assetlinks.json
deny HEAD   /oauth/authorize/ui
deny GET    /oauth/token/
deny GET    /OAUTH/token
deny GET    /oauth%2Ftoken
deny OPTIONS /oauth/token
echo "  all rejected (4xx):$deny_status"
[ "$(seen_count)" -eq 0 ] || fail "deny matrix produced $(seen_count) upstream arrivals — must be zero"

echo "== phase 3: header boundary (CTR-AH-EDGE-001/002) =="
: > "$UPSTREAM_SEEN"
req POST /oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Forwarded: for=198.51.100.9;host=evil.example' \
  -H 'X-Forwarded-For: 198.51.100.9' \
  -H 'X-Real-IP: 198.51.100.9' \
  -H 'X-AgentCore-Principal-UUID: forged-principal' \
  -H 'X-AgentCore-Trace-Id: forged-trace' \
  -H 'Authorization: Basic WlpDTElFTlQ6WlpTRUNSRVQ=' \
  -H 'Cookie: __Host-zzsession=ZZVERIFY-COOKIE-0001' \
  --data 'grant_type=authorization_code' >/dev/null
UPSTREAM_SEEN="$UPSTREAM_SEEN" node -e '
const fs = require("fs");
const lines = fs.readFileSync(process.env.UPSTREAM_SEEN, "utf8").trim().split("\n").map(JSON.parse);
if (lines.length !== 1) throw new Error("expected exactly 1 boundary-probe arrival, got " + lines.length);
const h = lines[0].headers;
const forged = "198.51.100.9";
if (h.host !== "auth.mayf3.com") throw new Error("Host not pinned: " + h.host);
if (h["x-forwarded-proto"] !== "https") throw new Error("X-Forwarded-Proto not https");
if (!h["x-forwarded-for"] || h["x-forwarded-for"] === forged) throw new Error("XFF must be the single edge-seen remote address, got " + h["x-forwarded-for"]);
for (const k of ["forwarded", "x-real-ip"]) if (h[k] !== undefined) throw new Error(k + " must be absent");
if (Object.keys(h).some((k) => k.startsWith("x-agentcore"))) throw new Error("X-AgentCore-* forwarded");
const allowed = new Set(["host", "connection", "x-forwarded-for", "x-forwarded-proto", "content-type", "content-length", "authorization", "cookie", "origin"]);
const survivors = Object.keys(h).filter((k) => !allowed.has(k));
if (survivors.length) throw new Error("client-supplied headers outside the whitelist survived: " + survivors.join(","));
console.log("  boundary holds: Host pinned, XFP https, single-hop XFF=" + h["x-forwarded-for"] + ", forged values + X-AgentCore-* absent, whitelist survivors clean");
'

echo "== phase 4: log sweep reminder =="
echo "  access log lines: $(wc -l < "$(dirname "$UPSTREAM_SEEN")/logs/auth-access.log" 2>/dev/null || echo '?')"
echo "  now run: npm run verify:hosting-logs -- --probe-spec <spec.json> --nginx-access … (README step 3)"
echo "COMPOSE-PROBE PASS — edge contract holds on the scratch composition."
