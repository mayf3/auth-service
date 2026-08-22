#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE='postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
DATABASE='auth_svc_forum_reconcile_conformance'
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
    observed_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.svc-forum-reconcile-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$observed_label" == "sha256:$NONCE_HASH" ]]; then
      /usr/local/bin/docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
  fi
  if [[ -n "$CONTAINER_ID" ]] && /usr/local/bin/docker inspect "$CONTAINER_ID" >/dev/null 2>&1; then
    echo "FATAL: cleanup residue remains for owned container $CONTAINER_ID" >&2
    cleanup_failed=1
  elif [[ -z "$CONTAINER_ID" && -n "$CONTAINER_NAME" && -n "$NONCE_HASH" ]]; then
    local remaining_label
    remaining_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.svc-forum-reconcile-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$remaining_label" == "sha256:$NONCE_HASH" ]]; then
      echo "FATAL: cleanup residue remains for owned label/name $CONTAINER_NAME" >&2
      cleanup_failed=1
    fi
  fi
  if [[ $cleanup_failed -ne 0 ]]; then exit 97; fi
  echo 'SVC_FORUM_RECONCILE_CONFORMANCE_CONTAINER_ABSENT=true'
  exit "$ORIGINAL_EXIT"
}
trap cleanup EXIT INT TERM

# The executable bundle is the frozen target authority: its svc-forum entry
# must still register exactly forum.read + forum.write before any conformance.
node -e '
const registry = require(process.argv[1] + "/contract-bundles/minimal-auth-v1/audience-registry.json");
const audiences = registry.audiences ?? registry.entries;
const entry = (Array.isArray(audiences) ? audiences : []).find((item) => item && item.audience_id === "svc-forum");
if (!entry) { throw new Error("FATAL: bundle no longer registers svc-forum"); }
const expected = {
  audience_id: "svc-forum", resource_service: "svc-forum", scope_namespace: "forum",
  accepted_principal_types: ["agent"], registered_scopes: ["forum.read", "forum.write"],
  human_access_enabled: false, machine_access_enabled: true, delegated_access_enabled: false,
  status: "active", freeze_ready: true,
};
for (const [key, value] of Object.entries(expected)) {
  const actual = JSON.stringify(entry[key]);
  if (actual !== JSON.stringify(value)) { throw new Error(`FATAL: bundle svc-forum ${key} drifted: ${actual}`); }
}
' "$REPO_DIR"
echo 'SVC_FORUM_BUNDLE_TARGET_FROZEN=true'

NONCE="$(openssl rand -hex 32)"
NONCE_HASH="$(printf '%s' "$NONCE" | openssl dgst -sha256 | awk '{print $2}')"
CONTAINER_NAME="auth-svc-forum-reconcile-conformance-$(printf '%s' "$NONCE" | cut -c1-16)"

CONTAINER_ID="$(/usr/local/bin/docker run -d --rm \
  --name "$CONTAINER_NAME" \
  --label "com.mayf3.auth.svc-forum-reconcile-conformance=sha256:$NONCE_HASH" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e "POSTGRES_DB=$DATABASE" \
  -p 127.0.0.1::5432 \
  "$IMAGE" \
  -c "svc_forum_reconcile.conformance_nonce=$NONCE")"

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

# Conformance-only controls (this reconciliation adds no Prisma migration):
# 1. auth_audiences UPDATE tripwire — only registered_scopes may change, every
#    other column (version and updated_at included) must stay byte-identical;
# 2. auth_audiences DELETE tripwire;
# 3. auth_security_audits immutability tripwire — the reconciliation audit is
#    insert-only, mechanically proving the durable-audit model.
/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
BEGIN;
CREATE FUNCTION reject_non_scope_audience_update() RETURNS trigger LANGUAGE plpgsql AS $$
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
    RAISE EXCEPTION 'only registered_scopes may change on auth_audiences';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "auth_audiences_scope_only_update" BEFORE UPDATE ON auth_audiences
  FOR EACH ROW EXECUTE FUNCTION reject_non_scope_audience_update();
CREATE FUNCTION reject_audience_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auth_audiences rows are protected in conformance';
END;
$$;
CREATE TRIGGER "auth_audiences_no_delete" BEFORE DELETE ON auth_audiences
  FOR EACH ROW EXECUTE FUNCTION reject_audience_delete();
CREATE FUNCTION reject_auth_security_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auth security audit records are immutable in conformance';
END;
$$;
CREATE TRIGGER "auth_security_audits_immutable" BEFORE UPDATE OR DELETE ON auth_security_audits
  FOR EACH ROW EXECUTE FUNCTION reject_auth_security_audit_mutation();
CREATE FUNCTION reject_grant_table_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'grant rows are frozen in conformance';
END;
$$;
CREATE TRIGGER "machine_access_grants_immutable" BEFORE UPDATE OR DELETE ON machine_access_grants
  FOR EACH ROW EXECUTE FUNCTION reject_grant_table_mutation();
CREATE TRIGGER "human_audience_grants_immutable" BEFORE UPDATE OR DELETE ON human_audience_grants
  FOR EACH ROW EXECUTE FUNCTION reject_grant_table_mutation();
CREATE TRIGGER "delegation_grants_immutable" BEFORE UPDATE OR DELETE ON delegation_grants
  FOR EACH ROW EXECUTE FUNCTION reject_grant_table_mutation();
COMMIT;
SQL

/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
INSERT INTO auth_audiences
  (audience_id, resource_service, scope_namespace, accepted_principal_types, registered_scopes,
   human_access_enabled, machine_access_enabled, delegated_access_enabled, status, freeze_ready, version, created_at, updated_at)
VALUES
  ('probe-aud', 'probe', 'probe', '{agent}', '{probe.read}', false, true, false, 'active', true, 1, now(), now());
DO $$
BEGIN
  BEGIN
    UPDATE auth_audiences SET registered_scopes = '{probe.other}' WHERE audience_id = 'probe-aud';
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'scope-only update was rejected: %', SQLERRM;
  END;
  BEGIN
    UPDATE auth_audiences SET version = 2 WHERE audience_id = 'probe-aud';
    RAISE EXCEPTION 'audience tripwire accepted a version change';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'only registered_scopes may change on auth_audiences' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE auth_audiences SET updated_at = '2000-01-01 00:00:00'::timestamp WHERE audience_id = 'probe-aud';
    RAISE EXCEPTION 'audience tripwire accepted an updated_at change';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'only registered_scopes may change on auth_audiences' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM auth_audiences WHERE audience_id = 'probe-aud';
    RAISE EXCEPTION 'audience tripwire accepted DELETE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'auth_audiences rows are protected in conformance' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO auth_security_audits (id, event_type, result, details, timestamp) VALUES
  ('00000000-0000-4000-8000-0000000000aa', 'probe', 'probe', '{}', now());
DO $$ BEGIN
  BEGIN UPDATE auth_security_audits SET result = 'changed' WHERE event_type = 'probe';
    RAISE EXCEPTION 'audit immutability trigger accepted UPDATE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'auth security audit records are immutable in conformance' THEN RAISE; END IF;
  END;
  BEGIN DELETE FROM auth_security_audits WHERE event_type = 'probe';
    RAISE EXCEPTION 'audit immutability trigger accepted DELETE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'auth security audit records are immutable in conformance' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO machine_principals (id, principal_type, status, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'agent', 'active', now(), now());
INSERT INTO machine_clients
  (id, client_id, machine_principal_id, secret_hash, external_ref, status, allowed_resources, allowed_scopes, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000b2', 'mc_probe000000000000000000', '00000000-0000-4000-8000-0000000000b1', 'probe', NULL, 'active', '{}', '{}', now(), now());
INSERT INTO machine_access_grants (machine_client_id, audience_id, scopes, version, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000b2', 'probe-aud', '{probe.read}', 1, now(), now());
DO $$ BEGIN
  BEGIN UPDATE machine_access_grants SET version = 99;
    RAISE EXCEPTION 'grant freeze trigger accepted UPDATE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'grant rows are frozen in conformance' THEN RAISE; END IF;
  END;
  BEGIN DELETE FROM machine_access_grants;
    RAISE EXCEPTION 'grant freeze trigger accepted DELETE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'grant rows are frozen in conformance' THEN RAISE; END IF;
  END;
END $$;
TRUNCATE auth_audiences CASCADE;
TRUNCATE auth_security_audits;
TRUNCATE machine_principals CASCADE;
SQL

echo 'SVC_FORUM_RECONCILE_AUDIT_CONTROLS_VERIFIED=true'

/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
CREATE ROLE svc_forum_reconcile_runner LOGIN;
GRANT USAGE ON SCHEMA public TO svc_forum_reconcile_runner;
GRANT SELECT ON auth_audiences, machine_access_grants, human_audience_grants,
  delegation_grants, auth_security_audits TO svc_forum_reconcile_runner;
-- UPDATE/DELETE privileges exist only to satisfy LOCK TABLE (SHARE and
-- SHARE ROW EXCLUSIVE modes); the tripwires above mechanically restrict the
-- runner to the single registered_scopes column and to audit INSERTs.
GRANT UPDATE, DELETE ON auth_audiences TO svc_forum_reconcile_runner;
GRANT INSERT, UPDATE, DELETE ON auth_security_audits TO svc_forum_reconcile_runner;
GRANT UPDATE, DELETE ON machine_access_grants, human_audience_grants, delegation_grants TO svc_forum_reconcile_runner;
GRANT SELECT (id, client_id, machine_principal_id, external_ref, status) ON machine_clients TO svc_forum_reconcile_runner;
SQL

LEGACY_PRIVILEGES="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -c \
  "SELECT has_column_privilege('svc_forum_reconcile_runner','machine_clients','allowed_resources','SELECT')::text || ',' || has_column_privilege('svc_forum_reconcile_runner','machine_clients','allowed_scopes','SELECT')::text")"
[[ "$LEGACY_PRIVILEGES" == 'false,false' ]] || { echo 'FATAL: conformance runner can read legacy columns' >&2; exit 1; }
echo 'SVC_FORUM_RECONCILE_LEGACY_COLUMN_SELECT_PRIVILEGES=false,false'

DESCRIPTOR="$(node -e '
const d={schema_version:1,container_id:process.argv[1],nonce:process.argv[2],host_port:Number(process.argv[3]),database:"auth_svc_forum_reconcile_conformance",audit_metadata:{migration_id:"svc-forum-reconcile-conformance-v1",source_git_commit:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",operator_id:"svc-forum-reconcile-conformance",approval_ref:"https://github.com/mayf3/auth-service/issues/1#issuecomment-1",reason:"isolated svc-forum audience registry reconciliation conformance"}}; process.stdout.write(JSON.stringify(d));
' "$CONTAINER_ID" "$NONCE" "$HOST_PORT")"

(
  cd "$REPO_DIR"
  env -u DATABASE_URL node --import tsx tests/oauth/reconcile-svc-forum-audience-registry-v1.test.ts \
    3< <(printf '%s' "$DESCRIPTOR")
)

echo 'SVC_FORUM_RECONCILE_TEMP_DB_CONFORMANCE=PASS'
