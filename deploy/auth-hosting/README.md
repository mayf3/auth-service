# deploy/auth-hosting — auth.mayf3.com public hosting boundary artifacts

Authority: `docs/specs/AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1.md` (accepted).

> **STATUS: NOT APPLIED.** Everything in this directory is a NON-PRODUCTION
> artifact for the **shadow stage** only. Nothing here has been deployed to any
> public host: no DNS record exists, no certificate was issued, no Nginx config
> was applied to any host, no sshd tunnel principal (`agentcore-auth-tunnel`)
> was created, and no launchd plist was installed. Production activation is
> owner-gated by spec section 7 and is NOT part of this change.

## Artifacts

| File | Purpose | Contracts |
|---|---|---|
| `nginx-auth-mayf3.conf.example` | Dedicated SNI server block: exact 7-pair public allow-list → `127.0.0.1:18794`, header boundary, no-query-string logging, deny-all default | CTR-AH-PATHS-001, CTR-AH-EDGE-001, CTR-AH-EDGE-002, CTR-AH-LOG-001, CTR-AH-TIMEOUT-001, CTR-AH-WELLKNOWN-001 |
| `shadow-compose-probe.sh` | Asserting probe matrix for the local composition test (allow-list arrival, deny zero-byte arrival, header boundary) | CTR-AH-PATHS-001, CTR-AH-EDGE-001/002 |
| `scripts/verify-auth-hosting-logs.mjs` (repo root) | Negative log sweep across all chain surfaces for probe markers + every CTR-AH-LOG-001 prohibited value class; non-zero exit on any hit | CTR-AH-LOG-001 |

App-side seam (H2, separate from this directory): `AUTH_TRUST_PROXY_HOPS` env —
see `src/config/trust-proxy-hops.ts`, wired in `src/server.ts`. Hosting
deployment sets `AUTH_TRUST_PROXY_HOPS=1`; default (unset) keeps existing
local deployments byte-identical.

---

## Shadow execution order

Run these in order on a scratch machine/prefix. Steps 1–4 were rehearsed in
this PR's development (docker `nginx:1.27-alpine` scratch + composition); the
commands below are the recorded, working sequence.

### 0. Scratch layout

```bash
SHADOW=/tmp/auth-hosting-shadow
mkdir -p "$SHADOW"/{conf,logs,ssl,www/well-known}
cp deploy/auth-hosting/nginx-auth-mayf3.conf.example "$SHADOW/conf/auth.conf"

# Shadow-only throwaway self-signed cert. FORBIDDEN beyond local composition —
# the production path must use a publicly trusted certificate (CTR-AH-TLS-001).
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$SHADOW/ssl/auth.mayf3.com.key" \
  -out "$SHADOW/ssl/auth.mayf3.com.fullchain.pem" -days 1 -subj "/CN=auth.mayf3.com"

# assetlinks placeholder (real pinning procedure: step 4)
echo '{"sha256-pinned placeholder": true}' > "$SHADOW/www/well-known/assetlinks.json"
```

Rewrite the example's prefix-relative placeholders to absolute scratch paths
(the example keeps deploy-realistic values; the shadow run adapts them):

```bash
# Paths are written for the docker mount namespace (tree at /shadow inside the
# container). Host-nginx variant: re-sed to $SHADOW host paths instead.
sed -e "s|ssl/auth.mayf3.com.fullchain.pem|/shadow/ssl/auth.mayf3.com.fullchain.pem|" \
    -e "s|ssl/auth.mayf3.com.key|/shadow/ssl/auth.mayf3.com.key|" \
    -e "s|alias www/well-known/assetlinks.json;|alias /shadow/www/well-known/assetlinks.json;|" \
    -e "s|access_log logs/|access_log /shadow/logs/|" \
    -e "s|error_log logs/|error_log /shadow/logs/|" \
    -e "s|pid logs/|pid /shadow/logs/|" \
    "$SHADOW/conf/auth.conf" > "$SHADOW/conf/auth.shadow.conf"
```

### 1. `nginx -t` against the scratch prefix

```bash
# with docker (no host nginx needed) — used for this PR's rehearsal:
docker run --rm -v "$SHADOW:/shadow" nginx:1.27-alpine \
  nginx -t -p /shadow -c /shadow/conf/auth.shadow.conf
# or, with a host nginx:
nginx -t -p "$SHADOW" -c "$SHADOW/conf/auth.shadow.conf"
```

Expected: `syntax is ok` / `test is successful`.

### 2. Local composition test (edge + recording upstream, real 443→18794 wiring)

Start the edge on a scratch https port (18443) and a recording inspector that
binds the loopback **18794** the config proxies to — inside the same network
namespace, so the committed config is exercised verbatim:

```bash
docker run -d --name auth-shadow-nginx -p 18443:443 -v "$SHADOW:/shadow" \
  nginx:1.27-alpine nginx -g 'daemon off;' -p /shadow -c /shadow/conf/auth.shadow.conf

docker run --rm --network container:auth-shadow-nginx -v "$SHADOW:/shadow" \
  node:22-alpine node -e 'require("http").createServer((req,res)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>{require("fs").appendFileSync("/shadow/upstream-seen.jsonl", JSON.stringify({method:req.method,url:req.url,headers:req.headers,bytes:Buffer.byteLength(b)})+"\n");res.end("up-ok")})}).listen(18794,"127.0.0.1",()=>console.log("inspector up"))' \
  > "$SHADOW/upstream.out" 2>&1 &
```

Run the asserting probe matrix (allow-list arrival, deny zero-byte arrival,
header boundary; synthetic ZZ* markers only):

```bash
PORT=18443 UPSTREAM_SEEN="$SHADOW/upstream-seen.jsonl" \
  bash deploy/auth-hosting/shadow-compose-probe.sh

**Tunnel-down + query-string probe (ACC-AH-LOG-001 negative sweep):** with the
composition still up, stop the recording upstream, fire a code/state-bearing
callback through the edge (honest 502 mode), bring it back, then re-run the
harness — it MUST still exit 0 (no query string in ANY log, including nginx
core error logs; the sensitive locations run `error_log … crit` so the
request-line-bearing upstream failure messages never reach disk):

```bash
docker stop auth-shadow-upstream
curl -sk --noproxy '*' "https://localhost:18443/mobile/callback?code=ZZVERIFY-AUTHCODE-0002&state=ZZVERIFY-STATE-0002" -o /dev/null -w '%{http_code}\n'   # expect 502
docker start auth-shadow-upstream
npm run verify:hosting-logs -- --probe-spec <spec.json> --nginx-access "$SHADOW/logs/auth-access.log" --nginx-error "$SHADOW/logs/error.log"   # expect exit 0
```

**Trade-off + reliance notes:**
- `error_log … crit` in the six sensitive locations trades upstream-failure
  verbosity for the no-query-string-on-disk MUST. Tunnel/upstream health is
  observed via the client-visible honest 502/504, launchd/ssh supervision of
  the tunnel, and the gateway/health probes — not via these error lines.
- `error_log` cannot be formatted; if a future requirement needs upstream
  failure detail with the query string scrubbed, that needs an authority
  revision (nginx cannot rewrite its core error-log fields).
- Identity relies on the edge REPLACING X-Forwarded-For
  (`proxy_set_header X-Forwarded-For $remote_addr`, never
  `$proxy_add_x_forwarded_for`) combined with `AUTH_TRUST_PROXY_HOPS=1`
  (rightmost-entry selection). Any future edge change that appends instead of
  replacing breaks identity provenance — CTR-AH-EDGE-002 guards this.
```

Expected: `COMPOSE-PROBE PASS`. This proves: only the six proxied pairs arrive
upstream (assetlinks is static); every denied method/path produces **zero**
upstream arrivals; forged `Forwarded`/`X-Forwarded-For`/`X-Real-IP`/
`X-AgentCore-*` are deleted, Host is pinned, `X-Forwarded-Proto` is https, and
exactly one XFF hop (the edge-seen remote address) is injected.

No-docker variant: with a host nginx, additionally sed `listen 443 ssl` →
`listen 18443 ssl`, run the inspector directly on 127.0.0.1:18794, and run the
same probe script.

### 3. Log verification harness (CTR-AH-LOG-001 negative sweep)

Generate a probe spec with **synthetic** marker values, construct requests that
carry them (the compose probe already sends ZZ* markers), then sweep every log
surface of the chain — nginx access+error, Aliyun sshd/tunnel, Mac launchd
tunnel, and Mac auth-service launchd stdout/stderr:

```bash
node scripts/verify-auth-hosting-logs.mjs --print-template > "$SHADOW/probe-spec.json"
# …construct the probe requests using the marker values from the spec…

npm run verify:hosting-logs -- \
  --probe-spec "$SHADOW/probe-spec.json" \
  --nginx-access "$SHADOW/logs/auth-access.log" \
  --nginx-error  "$SHADOW/logs/error.log" \
  --sshd         /path/to/aliyun-sshd.log \
  --launchd-tunnel /path/to/mac-launchd-tunnel.log \
  --auth-stdout  /path/to/auth-service-launchd-stdout.log \
  --auth-stderr  /path/to/auth-service-launchd-stderr.log
```

Every surface may also be set via `AUTH_HOSTING_*` env (see the script header).
Unconfigured surfaces are reported `SKIPPED` (coverage gaps stay loud); a
configured path that does not exist is an error (exit 3).

Exit codes: `0` clean · `1` **CTR-AH-LOG-001 violation** (any marker or
prohibited value class found) · `2` config error · `3` configured file
missing/unreadable. Findings are printed **redacted** — matched regions are
masked so the harness output cannot re-leak a secret. Any exit ≠ 0 stops the
shadow stage.

### 4. assetlinks.json sha256 pinning procedure (CTR-AH-WELLKNOWN-001)

The public edge serves `/.well-known/assetlinks.json` as a STATIC file — it is
never proxied. Its bytes come from `mayf3/agent-core-mobile` (the Android
signing credential owner), not from this repository:

```bash
# 1. obtain the digital_asset_links JSON from the mobile repo (exact bytes)
# 2. pin the digest:
shasum -a 256 assetlinks.json        # → record in the deployment record
# 3. place the pinned bytes at the static root and verify the served digest:
cp assetlinks.json "$SHADOW/www/well-known/assetlinks.json"
curl -ks https://127.0.0.1:18443/.well-known/assetlinks.json -o /tmp/served.json --noproxy '*'
shasum -a 256 /tmp/served.json       # must equal the pinned digest
```

A digest mismatch (or 404) fails the well-known acceptance; the passive public
readiness anchor remains `GET /.well-known/jwks.json` → 200 (CTR-AH-HEALTH-001;
no active probe endpoint exists or may be added).

---

## Production apply status and rollback

**NOT APPLIED.** The spec section 7 production gates (DNS A record, publicly
trusted certificate, Nginx backup, sshd principal + Mac launchd tunnel,
assetlinks pinning, ACC-AH-* acceptance, activation) are all still open and
owner-gated. This PR performs none of them.

Rollback (mirrors spec CTR-AH-DEPLOY-001; each step is independent and leaves
the existing product gateway, Tailscale path, auth-service process, and
database untouched):

```text
1. Remove/disable the auth SNI block on the public host (delete the new
   include; default_server and mobile-api blocks are never modified).
   → public auth surface returns 404/no-host immediately.
2. Stop the auth tunnel: Mac launchd plist unload + sshd principal can remain
   as inert config (PermitListen-only, loopback).
3. auth-service reverts by unsetting AUTH_TRUST_PROXY_HOPS (or setting it to
   0) and restarting the process: trust proxy returns to its default `false`,
   byte-identical to pre-hosting behavior.
```

EMERGENCY_CONTAINMENT = step 1 alone (disable the SNI block). The edge is
stateless; re-apply after rollback re-follows the shadow order above.
