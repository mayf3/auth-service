#!/usr/bin/env bash
# run-life-workbench-pilot-grants-v1-conformance.sh — D2 isolated conformance.
# Exact 2-pilot supply/revoke lifecycle against a throwaway container database:
# create -> rerun NOOP -> drift conflict fail-closed -> revoke -> revoke rerun
# NOOP, plus the legacy-field zero-touch assertion (allowed_resources /
# allowed_scopes byte-unchanged across the whole run) and audit-row checks.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE='postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
DATABASE='auth_lw_pilot_grants_conformance'
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
  --label com.mayf3.auth.lw-pilot-grants-conformance=true \
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

# Seed the CCR-registered audience and two CONFORMANCE-ONLY pilot identities
# (synthetic UUIDs; NOT the production principals; provenance-shaped refs).
/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
INSERT INTO auth_audiences (audience_id, resource_service, scope_namespace, accepted_principal_types, registered_scopes, human_access_enabled, machine_access_enabled, delegated_access_enabled, status, freeze_ready, version, updated_at)
VALUES ('life-workbench','life-workbench','workbench','{agent}','{workbench.propose,workbench.read}',false,true,false,'active',true,1,now());
INSERT INTO users (id, name, email, password, role, status, updated_at) VALUES
  ('11111111-1010-4111-8111-111111111101','LW Pilot A','lw-pilot-a@conformance.local','conformance-not-a-login','admin','active',now()),
  ('11111111-1010-4111-8111-111111111102','LW Pilot B','lw-pilot-b@conformance.local','conformance-not-a-login','admin','active',now());
INSERT INTO machine_principals (id, principal_type, agent_id, owner_user_id, display_name, status, external_ref, request_digest, updated_at) VALUES
  ('11111111-2020-4222-8222-222222222201','agent','agt_lw_conformance_a','11111111-1010-4111-8111-111111111101','LW Conformance A','active','agentcore:v1:principal:agt_lw_conformance_a','conformance',now()),
  ('11111111-2020-4222-8222-222222222202','agent','agt_lw_conformance_b','11111111-1010-4111-8111-111111111102','LW Conformance B','active','agentcore:v1:principal:agt_lw_conformance_b','conformance',now());
INSERT INTO machine_clients (id, client_id, machine_principal_id, secret_hash, status, allowed_resources, allowed_scopes, external_ref, updated_at) VALUES
  ('11111111-3030-4333-8333-333333333301','mc_lw_conformance_a','11111111-2020-4222-8222-222222222201','conformance-hash','active','{}','{}','agentcore:v1:client:agt_lw_conformance_a',now()),
  ('11111111-3030-4333-8333-333333333302','mc_lw_conformance_b','11111111-2020-4222-8222-222222222202','conformance-hash','active','{}','{}','agentcore:v1:client:agt_lw_conformance_b',now());
SQL

# The conformance roster mirrors the production TARGETS with test identities.
export LW_CONFORMANCE_MODE=1

echo "container=$CONTAINER_ID port=$HOST_PORT"

# Phase 1: supply -> create x2, audit rows x2, legacy fields untouched.
node --import tsx "$SCRIPT_DIR/supply-life-workbench-pilot-grants-v1.ts" | tee /tmp/lw-supply-1.json
grep -q '"agentId":"agt_lw_conformance_a","outcome":"create"' /tmp/lw-supply-1.json
grep -q '"agentId":"agt_lw_conformance_b","outcome":"create"' /tmp/lw-supply-1.json

# Phase 2: rerun -> noop x2, no new audit rows.
BEFORE="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM grant_change_audits WHERE reason LIKE '%life-workbench%';")"
node --import tsx "$SCRIPT_DIR/supply-life-workbench-pilot-grants-v1.ts" | tee /tmp/lw-supply-2.json
grep -q '"agentId":"agt_lw_conformance_a","outcome":"noop"' /tmp/lw-supply-2.json
AFTER="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM grant_change_audits WHERE reason LIKE '%life-workbench%';")"
[[ "$BEFORE" == "$AFTER" ]] || { echo 'FATAL: NOOP rerun wrote audit rows' >&2; exit 1; }

# Phase 3 (negative): drift -> fail-closed, row untouched.
/usr/local/bin/docker exec "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -c "UPDATE machine_access_grants SET scopes='{workbench.read}' WHERE machine_client_id='11111111-3030-4333-8333-333333333301';" >/dev/null 2>&1 || true
DRIFT_TABLE_BEFORE="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM machine_access_grants WHERE audience_id='life-workbench';")"
if node --import tsx "$SCRIPT_DIR/supply-life-workbench-pilot-grants-v1.ts" >/dev/null 2>&1; then
  echo 'FATAL: drift supply unexpectedly succeeded' >&2
  exit 1
fi
DRIFT_TABLE_AFTER="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM machine_access_grants WHERE audience_id='life-workbench';")"
[[ "$DRIFT_TABLE_BEFORE" == "$DRIFT_TABLE_AFTER" ]] || { echo 'FATAL: drift attempt mutated rows' >&2; exit 1; }

# Restore exact state, then revoke both, then revoke rerun = NOOP x2.
/usr/local/bin/docker exec "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" \
  -c "UPDATE machine_access_grants SET scopes='{workbench.propose,workbench.read}' WHERE machine_client_id='11111111-3030-4333-8333-333333333301';" >/dev/null
node --import tsx "$SCRIPT_DIR/revoke-life-workbench-pilot-grants-v1.ts" | tee /tmp/lw-revoke-1.json
grep -q '"agentId":"agt_lw_conformance_a","outcome":"revoke"' /tmp/lw-revoke-1.json
grep -q '"agentId":"agt_lw_conformance_b","outcome":"revoke"' /tmp/lw-revoke-1.json
node --import tsx "$SCRIPT_DIR/revoke-life-workbench-pilot-grants-v1.ts" | tee /tmp/lw-revoke-2.json
grep -q '"agentId":"agt_lw_conformance_a","outcome":"noop"' /tmp/lw-revoke-2.json
LEFT="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM machine_access_grants WHERE audience_id='life-workbench';")"
[[ "$LEFT" == '0' ]] || { echo 'FATAL: revoke left grant rows' >&2; exit 1; }

# Legacy zero-touch: allowed_resources/allowed_scopes byte-identical to seed.
LEGACY="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT bool_and(allowed_resources='{}'::text[] AND allowed_scopes='{}'::text[]) FROM machine_clients WHERE external_ref LIKE 'agentcore:v1:client:agt_lw_conformance%';")"
[[ "$LEGACY" == 't' ]] || { echo 'FATAL: legacy fields were touched' >&2; exit 1; }

REVOKE_AUDITS="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -tAc \
  "SELECT count(*) FROM grant_change_audits WHERE change_type='revoke';")"
[[ "$REVOKE_AUDITS" == '2' ]] || { echo "FATAL: expected 2 revoke audit rows, got $REVOKE_AUDITS" >&2; exit 1; }

echo 'LIFE_WORKBENCH_PILOT_GRANTS_CONFORMANCE = PASS'
