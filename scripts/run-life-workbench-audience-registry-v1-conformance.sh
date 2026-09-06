#!/usr/bin/env bash
# run-life-workbench-audience-registry-v1-conformance.sh — D1 isolated conformance.
# LIFE_WORKBENCH_AUDIENCE_CCR_V1 (accepted) §4.3: pinned postgres, throwaway
# container database, positive (INSERT -> exact row) and idempotence (rerun =
# NOOP) and negative (drift fail-closed) phases, cleanup assertion on exit.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE='postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
DATABASE='auth_lw_audience_conformance'
SCHEMA_SQL="$REPO_DIR/tests/fixtures/lw-pilot-conformance-schema.sql"
CONTAINER_ID=''

if [[ ${DATABASE_URL+x} ]]; then
  echo 'FATAL: external DATABASE_URL is forbidden' >&2
  exit 1
fi
if (($# != 0)); then
  echo 'FATAL: this conformance harness accepts no arguments' >&2
  exit 1
fi

cleanup() {
  local original_exit=$?
  trap - EXIT INT TERM
  if [[ -n "$CONTAINER_ID" ]]; then
    /usr/local/bin/docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
  exit "$original_exit"
}
trap cleanup EXIT INT TERM

CONTAINER_ID="$(/usr/local/bin/docker run -d --rm \
  -e POSTGRES_PASSWORD=conformance -e POSTGRES_DB="$DATABASE" -p 127.0.0.1::5432 \
  --label com.mayf3.auth.lw-audience-conformance=true \
  "$IMAGE" 2>/dev/null)"
[[ -n "$CONTAINER_ID" ]] || { echo 'FATAL: container start failed' >&2; exit 1; }

for _ in $(seq 1 30); do
  if /usr/local/bin/docker exec "$CONTAINER_ID" pg_isready -U postgres -d "$DATABASE" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
# Apply the exact production-derived schema of the seven tables this pilot
# touches (schema-only dump of agent_dev_center; includes the drifted
# machine_access_grants.revoked_at column, kept to mirror production).
/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" < "$SCHEMA_SQL" >/dev/null

HOST_PORT="$(/usr/local/bin/docker port "$CONTAINER_ID" 5432 | head -1 | sed 's/.*://')"
export DATABASE_URL="postgresql://postgres:conformance@127.0.0.1:${HOST_PORT}/${DATABASE}?schema=public"
export OPERATOR_ID='conformance-runner'
export APPROVAL_REF='conformance-only'
export SOURCE_GIT_COMMIT="$(git -C "$REPO_DIR" rev-parse HEAD)"

echo "container=$CONTAINER_ID port=$HOST_PORT"

# Phase 1: INSERT — expect outcome=insert and the exact frozen row.
OUT1="$(node --import tsx "$SCRIPT_DIR/reconcile-life-workbench-audience-registry-v1.ts")"
grep -q '"outcome":"insert"' <<<"$OUT1" || { echo "FATAL: phase1 $OUT1" >&2; exit 1; }

ROW="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -c \
  "SELECT audience_id||'|'||resource_service||'|'||scope_namespace||'|'||array_to_string(accepted_principal_types,',')||'|'||human_access_enabled||'|'||machine_access_enabled||'|'||delegated_access_enabled||'|'||array_to_string(registered_scopes,',')||'|'||status||'|'||freeze_ready FROM auth_audiences WHERE audience_id='life-workbench';")"
[[ "$ROW" == 'life-workbench|life-workbench|workbench|agent|false|true|false|workbench.propose,workbench.read|active|true' ]] \
  || { echo "FATAL: exact row mismatch: $ROW" >&2; exit 1; }

# Phase 2: rerun — expect outcome=noop, row unchanged.
OUT2="$(node --import tsx "$SCRIPT_DIR/reconcile-life-workbench-audience-registry-v1.ts")"
grep -q '"outcome":"noop"' <<<"$OUT2" || { echo "FATAL: phase2 $OUT2" >&2; exit 1; }

# Phase 3 (negative): drift must fail closed and keep the row.
/usr/local/bin/docker exec "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -c "UPDATE auth_audiences SET registered_scopes='{workbench.read,workbench.admin}' WHERE audience_id='life-workbench';" >/dev/null
if node --import tsx "$SCRIPT_DIR/reconcile-life-workbench-audience-registry-v1.ts" >/dev/null 2>&1; then
  echo 'FATAL: drift run unexpectedly succeeded' >&2
  exit 1
fi
ROWS="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM auth_audiences WHERE audience_id='life-workbench';")"
[[ "$ROWS" == '1' ]] || { echo 'FATAL: drift changed row cardinality' >&2; exit 1; }

AUDITS="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM auth_security_audits WHERE event_type='audience.life_workbench_registered';")"
echo "audit_rows=$AUDITS"
echo 'LIFE_WORKBENCH_AUDIENCE_REGISTRY_CONFORMANCE = PASS'
