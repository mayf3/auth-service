#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE='postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
DATABASE='auth_nsc_conformance'
CONTAINER_ID=''
CONTAINER_NAME=''
NONCE_HASH=''
TEMP_DEST=''
ORIGINAL_EXIT=0

[[ $# -eq 0 ]] || { echo 'FATAL: conformance accepts no arguments' >&2; exit 2; }
[[ ! ${DATABASE_URL+x} ]] || { echo 'FATAL: external DATABASE_URL is forbidden' >&2; exit 2; }
command -v /usr/local/bin/docker >/dev/null || { echo 'FATAL: /usr/local/bin/docker is required' >&2; exit 2; }

cleanup() {
  ORIGINAL_EXIT=$?
  trap - EXIT INT TERM
  if [[ -n "$CONTAINER_ID" ]]; then
    /usr/local/bin/docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
  elif [[ -n "$CONTAINER_NAME" && -n "$NONCE_HASH" ]]; then
    observed_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.nsc-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    [[ "$observed_label" != "sha256:$NONCE_HASH" ]] || /usr/local/bin/docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
  [[ -z "$TEMP_DEST" ]] || rm -rf -- "$TEMP_DEST"
  if [[ -n "$CONTAINER_ID" ]] && /usr/local/bin/docker inspect "$CONTAINER_ID" >/dev/null 2>&1; then
    echo 'FATAL: disposable PostgreSQL cleanup incomplete' >&2
    exit 97
  elif [[ -z "$CONTAINER_ID" && -n "$CONTAINER_NAME" && -n "$NONCE_HASH" ]]; then
    remaining_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.nsc-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$remaining_label" == "sha256:$NONCE_HASH" ]]; then echo 'FATAL: owned conformance container cleanup incomplete' >&2; exit 97; fi
  fi
  echo 'NSC_CONFORMANCE_CONTAINER_ABSENT=true'
  echo 'NSC_CONFORMANCE_DESTINATIONS_ABSENT=true'
  exit "$ORIGINAL_EXIT"
}
trap cleanup EXIT INT TERM

NONCE="$(openssl rand -hex 32)"
NONCE_HASH="$(printf '%s' "$NONCE" | openssl dgst -sha256 | awk '{print $2}')"
CONTAINER_NAME="auth-nsc-conformance-${NONCE:0:16}"
TEMP_DEST="$(mktemp -d /tmp/auth-nsc-conformance.XXXXXX)"
chmod 700 "$TEMP_DEST"

CONTAINER_ID="$(/usr/local/bin/docker run -d --rm \
  --name "$CONTAINER_NAME" \
  --label "com.mayf3.auth.nsc-conformance=sha256:$NONCE_HASH" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e "POSTGRES_DB=$DATABASE" \
  -p 127.0.0.1::5432 \
  "$IMAGE" \
  -c "nsc.conformance_nonce=$NONCE")"
[[ "$CONTAINER_ID" =~ ^[0-9a-f]{64}$ ]] || { echo 'FATAL: invalid Docker container identity' >&2; exit 2; }
HOST_PORT="$(/usr/local/bin/docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$CONTAINER_ID")"
[[ "$HOST_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && ((HOST_PORT <= 65535)) || { echo 'FATAL: invalid loopback port' >&2; exit 2; }
for _ in $(seq 1 60); do
  /usr/local/bin/docker exec "$CONTAINER_ID" pg_isready -U postgres -d "$DATABASE" >/dev/null 2>&1 && break
  sleep 1
done
/usr/local/bin/docker exec "$CONTAINER_ID" pg_isready -U postgres -d "$DATABASE" >/dev/null
DATABASE_URL_INTERNAL="postgresql://postgres@127.0.0.1:${HOST_PORT}/${DATABASE}?schema=public"
(
  cd "$REPO_DIR"
  DATABASE_URL="$DATABASE_URL_INTERNAL" npx prisma db push --skip-generate >/dev/null
)

# Conformance-only failure injection may create/drop triggers. The canonical schema remains unmodified.
DESCRIPTOR="$(node -e '
const [containerId,nonce,url,root,uid]=process.argv.slice(1);
process.stdout.write(JSON.stringify({schema_version:1,container_id:containerId,nonce,database_url:url,environment:"disposable-conformance",destination_root:root,expected_uid:Number(uid),marker_path:root+"/.recovery-marker-v1.json",fault_injection:"none"}));
' "$CONTAINER_ID" "$NONCE" "$DATABASE_URL_INTERNAL" "$TEMP_DEST" "$(id -u)")"

(
  cd "$REPO_DIR"
  env -u DATABASE_URL node --import tsx tests/oauth/supply-notification-ingress-service-credentials-v1.test.ts \
    3< <(printf '%s' "$DESCRIPTOR")
)

echo 'NSC_DISPOSABLE_POSTGRES_CONFORMANCE=PASS'
