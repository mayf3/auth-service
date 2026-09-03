#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE='postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
DATABASE='auth_fmg_conformance'
LABEL='com.mayf3.auth.fmg-conformance'
CONTAINER_ID=''
CONTAINER_NAME=''
NONCE_HASH=''
ORIGINAL_EXIT=0

if [[ ${DATABASE_URL+x} ]]; then
  echo 'FATAL: external DATABASE_URL is forbidden' >&2
  exit 1
fi
if (($# != 0)); then
  echo 'FATAL: this conformance harness accepts no arguments' >&2
  exit 1
fi

cleanup() {
  ORIGINAL_EXIT=$?
  trap - EXIT INT TERM
  local cleanup_failed=0
  if [[ -n "$CONTAINER_ID" ]]; then
    /usr/local/bin/docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
  elif [[ -n "$CONTAINER_NAME" && -n "$NONCE_HASH" ]]; then
    local observed_label
    observed_label="$(/usr/local/bin/docker inspect --format "{{index .Config.Labels \"$LABEL\"}}" "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$observed_label" == "sha256:$NONCE_HASH" ]]; then
      /usr/local/bin/docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
  fi
  if [[ -n "$CONTAINER_ID" ]] && /usr/local/bin/docker inspect "$CONTAINER_ID" >/dev/null 2>&1; then
    echo "FATAL: cleanup residue remains for owned container $CONTAINER_ID" >&2
    cleanup_failed=1
  elif [[ -z "$CONTAINER_ID" && -n "$CONTAINER_NAME" && -n "$NONCE_HASH" ]]; then
    local remaining_label
    remaining_label="$(/usr/local/bin/docker inspect --format "{{index .Config.Labels \"$LABEL\"}}" "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$remaining_label" == "sha256:$NONCE_HASH" ]]; then
      echo "FATAL: cleanup residue remains for owned label/name $CONTAINER_NAME" >&2
      cleanup_failed=1
    fi
  fi
  if [[ $cleanup_failed -ne 0 ]]; then exit 97; fi
  echo 'FMG_CONFORMANCE_CONTAINER_ABSENT=true'
  exit "$ORIGINAL_EXIT"
}
trap cleanup EXIT INT TERM

# Build and integrity-check the executable contract as part of the conformance precondition.
(
  cd "$REPO_DIR"
  npm run contract:v1:prepare >/dev/null
)
node -e '
const runtime = require(process.argv[1] + "/generated/minimal-auth-v1/runtime-contract.json");
if (runtime?.payload?.contractVersion !== "1.7.0") throw new Error("FATAL: runtime Bundle is not 1.7.0");
const entries = runtime?.payload?.audienceRegistry?.audiences;
const forum = Array.isArray(entries) ? entries.find((entry) => entry?.audience_id === "svc-forum") : null;
if (!forum || JSON.stringify(forum.registered_scopes) !== JSON.stringify(["forum.moderate","forum.read","forum.write"])) {
  throw new Error("FATAL: runtime svc-forum scope registry is not the FMG target");
}
' "$REPO_DIR"
echo 'FMG_RUNTIME_BUNDLE_TARGET_FROZEN=true'

NONCE="$(openssl rand -hex 32)"
NONCE_HASH="$(printf '%s' "$NONCE" | openssl dgst -sha256 | awk '{print $2}')"
CONTAINER_NAME="auth-fmg-conformance-$(printf '%s' "$NONCE" | cut -c1-16)"
CONTAINER_ID="$(/usr/local/bin/docker run -d --rm \
  --name "$CONTAINER_NAME" \
  --label "$LABEL=sha256:$NONCE_HASH" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e "POSTGRES_DB=$DATABASE" \
  -p 127.0.0.1::5432 \
  "$IMAGE" \
  -c "fmg.conformance_nonce=$NONCE")"

[[ "$CONTAINER_ID" =~ ^[0-9a-f]{64}$ ]] || { echo 'FATAL: Docker returned an invalid container ID' >&2; exit 1; }
HOST_PORT="$(/usr/local/bin/docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$CONTAINER_ID")"
[[ "$HOST_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && ((HOST_PORT <= 65535)) || { echo 'FATAL: invalid Docker host port' >&2; exit 1; }
DATABASE_URL_INTERNAL="postgresql://postgres@127.0.0.1:${HOST_PORT}/${DATABASE}?schema=public"

for _ in $(seq 1 60); do
  if /usr/local/bin/docker exec "$CONTAINER_ID" pg_isready -U postgres -d "$DATABASE" >/dev/null 2>&1; then break; fi
  sleep 1
done
/usr/local/bin/docker exec "$CONTAINER_ID" pg_isready -U postgres -d "$DATABASE" >/dev/null
(
  cd "$REPO_DIR"
  DATABASE_URL="$DATABASE_URL_INTERNAL" npx prisma db push --skip-generate >/dev/null
)

# prisma db push omits the canonical migration's raw SQL controls. Install the
# exact conformance controls plus mutation tripwires for the FMG write boundary.
/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
BEGIN;
ALTER TABLE machine_access_grants
  ADD CONSTRAINT "machine_access_grants_scopes_check" CHECK (cardinality("scopes") > 0);
ALTER TABLE grant_change_audits
  ADD CONSTRAINT "grant_change_audits_source_commit_check" CHECK ("source_git_commit" ~ '^[0-9a-f]{40}$'),
  ADD CONSTRAINT "grant_change_audits_required_text_check" CHECK (
    length("migration_id") > 0 AND length("operator_id") > 0
    AND length("approval_ref") > 0 AND length("client_id") > 0
  ),
  ADD CONSTRAINT "grant_change_audits_reason_check" CHECK (length("reason") BETWEEN 1 AND 512),
  ADD CONSTRAINT "grant_change_audits_version_check" CHECK (
    "resulting_grant_version" >= 1 AND
    ("expected_grant_version" IS NULL OR "expected_grant_version" >= 1)
  ),
  ADD CONSTRAINT "grant_change_audits_value_shape_check" CHECK (
    ("change_type" IN ('create', 'replace') AND "after_value" IS NOT NULL)
    OR ("change_type" = 'revoke' AND "after_value" IS NULL)
  );
CREATE FUNCTION fmg_reject_audience_delta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.audience_id IS DISTINCT FROM OLD.audience_id
     OR NEW.resource_service IS DISTINCT FROM OLD.resource_service
     OR NEW.scope_namespace IS DISTINCT FROM OLD.scope_namespace
     OR NEW.accepted_principal_types IS DISTINCT FROM OLD.accepted_principal_types
     OR NEW.human_access_enabled IS DISTINCT FROM OLD.human_access_enabled
     OR NEW.machine_access_enabled IS DISTINCT FROM OLD.machine_access_enabled
     OR NEW.delegated_access_enabled IS DISTINCT FROM OLD.delegated_access_enabled
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.freeze_ready IS DISTINCT FROM OLD.freeze_ready
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    RAISE EXCEPTION 'FMG may update only auth_audiences.registered_scopes';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER auth_audiences_fmg_scope_only BEFORE UPDATE ON auth_audiences
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_audience_delta();
CREATE FUNCTION fmg_reject_grant_delta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.machine_client_id IS DISTINCT FROM OLD.machine_client_id
     OR NEW.audience_id IS DISTINCT FROM OLD.audience_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    RAISE EXCEPTION 'FMG may update only machine grant scopes and version';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER machine_access_grants_fmg_scope_version_only BEFORE UPDATE ON machine_access_grants
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_grant_delta();
CREATE FUNCTION fmg_reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FMG protected row deletion is forbidden'; END;
$$;
CREATE TRIGGER auth_audiences_fmg_no_delete BEFORE DELETE ON auth_audiences
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_delete();
CREATE TRIGGER machine_access_grants_fmg_no_delete BEFORE DELETE ON machine_access_grants
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_delete();
CREATE FUNCTION fmg_reject_identity_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FMG identity rows are immutable'; END;
$$;
CREATE TRIGGER machine_clients_fmg_immutable BEFORE UPDATE OR DELETE ON machine_clients
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_identity_mutation();
CREATE TRIGGER machine_principals_fmg_immutable BEFORE UPDATE OR DELETE ON machine_principals
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_identity_mutation();
CREATE TRIGGER trusted_proxies_fmg_immutable BEFORE UPDATE OR DELETE ON trusted_proxies
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_identity_mutation();
CREATE TRIGGER delegation_grants_fmg_immutable BEFORE UPDATE OR DELETE ON delegation_grants
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_identity_mutation();
CREATE FUNCTION fmg_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FMG audit rows are immutable'; END;
$$;
CREATE TRIGGER grant_change_audits_fmg_immutable BEFORE UPDATE OR DELETE ON grant_change_audits
  FOR EACH ROW EXECUTE FUNCTION fmg_reject_audit_mutation();
COMMIT;
SQL

/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
CREATE ROLE fmg_runner LOGIN;
GRANT USAGE ON SCHEMA public TO fmg_runner;
GRANT SELECT, UPDATE, DELETE ON auth_audiences TO fmg_runner;
GRANT SELECT, UPDATE, DELETE ON machine_access_grants TO fmg_runner;
GRANT SELECT, INSERT, UPDATE, DELETE ON grant_change_audits TO fmg_runner;
-- UPDATE/DELETE are required by PostgreSQL for the explicit SHARE locks; the
-- immutable triggers above make these privileges mechanically non-mutating.
GRANT SELECT, UPDATE, DELETE ON trusted_proxies, delegation_grants TO fmg_runner;
GRANT UPDATE, DELETE ON machine_principals, machine_clients TO fmg_runner;
GRANT SELECT (id, principal_type, agent_id, external_ref, status, disabled_at) ON machine_principals TO fmg_runner;
GRANT SELECT (id, client_id, machine_principal_id, external_ref, status, created_at, updated_at, rotated_at, revoked_at) ON machine_clients TO fmg_runner;
SQL

SENSITIVE_PRIVILEGES="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -c \
  "SELECT has_column_privilege('fmg_runner','machine_clients','secret_hash','SELECT')::text || ',' || has_column_privilege('fmg_runner','machine_clients','allowed_resources','SELECT')::text || ',' || has_column_privilege('fmg_runner','machine_clients','allowed_scopes','SELECT')::text")"
[[ "$SENSITIVE_PRIVILEGES" == 'false,false,false' ]] || { echo 'FATAL: FMG runner can read secret or legacy client columns' >&2; exit 1; }
echo 'FMG_SENSITIVE_COLUMN_SELECT_PRIVILEGES=false,false,false'

DESCRIPTOR="$(node -e '
const {createHash}=require("node:crypto");
const sort=(v)=>Array.isArray(v)?v.map(sort):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map((k)=>[k,sort(v[k])])):v;
const plan={plan_version:"AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1_PLAN_1",classification:"APPLY",agent_id:"agt_course-community-agent-2",principal_external_ref:"agentcore:v1:principal:agt_course-community-agent-2",client_external_ref:"agentcore:v1:client:agt_course-community-agent-2",client_id:"mc_hvEfjkJ5BTKA8HZXRmbzNVw0",audience:"svc-forum",expected_audience_scopes:["forum.read","forum.write"],target_audience_scopes:["forum.moderate","forum.read","forum.write"],expected_grant_version:1,expected_grant_scopes:["forum.read","forum.write"],target_grant_version:2,target_grant_scopes:["forum.moderate","forum.read","forum.write"],operation:"UPDATE_AUDIENCE_AND_GRANT"};
const plan_sha256=createHash("sha256").update(JSON.stringify(sort(plan))).digest("hex");
const d={schema_version:1,container_id:process.argv[1],nonce:process.argv[2],host_port:Number(process.argv[3]),database:"auth_fmg_conformance",plan_sha256,invariant_sha256:"0".repeat(64),audit_metadata:{migration_id:"forum-moderator-grant-supply-v1",source_git_commit:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",operator_id:"fmg-conformance-operator",approval_ref:"https://github.com/mayf3/auth-service/issues/1#issuecomment-1",reason:"fmg conformance metadata input"}}; process.stdout.write(JSON.stringify(d));
' "$CONTAINER_ID" "$NONCE" "$HOST_PORT")"
(
  cd "$REPO_DIR"
  env -u DATABASE_URL node --import tsx tests/oauth/supply-forum-moderator-grant-v1.test.ts \
    3< <(printf '%s' "$DESCRIPTOR")
)

echo 'FMG_TEMP_DB_CONFORMANCE=PASS'
