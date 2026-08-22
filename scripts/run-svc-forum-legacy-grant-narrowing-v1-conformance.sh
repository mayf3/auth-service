#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE='postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
DATABASE='auth_svc_forum_narrow_conformance'
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
    observed_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.svc-forum-narrow-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$observed_label" == "sha256:$NONCE_HASH" ]]; then
      /usr/local/bin/docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
  fi
  if [[ -n "$CONTAINER_ID" ]] && /usr/local/bin/docker inspect "$CONTAINER_ID" >/dev/null 2>&1; then
    echo "FATAL: cleanup residue remains for owned container $CONTAINER_ID" >&2
    cleanup_failed=1
  elif [[ -z "$CONTAINER_ID" && -n "$CONTAINER_NAME" && -n "$NONCE_HASH" ]]; then
    local remaining_label
    remaining_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.svc-forum-narrow-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$remaining_label" == "sha256:$NONCE_HASH" ]]; then
      echo 'FATAL: cleanup residue remains for owned label/name' >&2
      cleanup_failed=1
    fi
  fi
  if [[ $cleanup_failed -ne 0 ]]; then exit 97; fi
  echo 'SVC_FORUM_NARROW_CONFORMANCE_CONTAINER_ABSENT=true'
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
const expected = { registered_scopes: ["forum.read", "forum.write"], machine_access_enabled: true, status: "active" };
for (const [key, value] of Object.entries(expected)) {
  const actual = JSON.stringify(entry[key]);
  if (actual !== JSON.stringify(value)) { throw new Error(`FATAL: bundle svc-forum ${key} drifted: ${actual}`); }
}
' "$REPO_DIR"
echo 'SVC_FORUM_BUNDLE_TARGET_FROZEN=true'

NONCE="$(openssl rand -hex 32)"
NONCE_HASH="$(printf '%s' "$NONCE" | openssl dgst -sha256 | awk '{print $2}')"
CONTAINER_NAME="auth-svc-forum-narrow-conformance-$(printf '%s' "$NONCE" | cut -c1-16)"

CONTAINER_ID="$(/usr/local/bin/docker run -d --rm \
  --name "$CONTAINER_NAME" \
  --label "com.mayf3.auth.svc-forum-narrow-conformance=sha256:$NONCE_HASH" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e "POSTGRES_DB=$DATABASE" \
  -p 127.0.0.1::5432 \
  "$IMAGE" \
  -c "svc_forum_narrow.conformance_nonce=$NONCE")"

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

# Conformance-only controls (this narrowing adds no Prisma migration):
# 1. machine_access_grants UPDATE tripwire — only scopes and version may change,
#    every other column (created_at and updated_at included) must stay
#    byte-identical, and DELETE is rejected outright;
# 2. machine_clients / machine_principals fully frozen — the client and
#    principal rows are mechanically immutable for the runner;
# 3. grant_change_audits immutability tripwire — the narrowing audit is
#    insert-only;
# 4. the migration's existing grant_change_audits CHECK constraints are
#    installed as test-only DDL (prisma db push omits raw-SQL controls).
/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
BEGIN;
CREATE FUNCTION reject_grant_non_scoping_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.machine_client_id IS DISTINCT FROM OLD.machine_client_id
     OR NEW.audience_id IS DISTINCT FROM OLD.audience_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    RAISE EXCEPTION 'only scopes and version may change on machine_access_grants';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "machine_access_grants_scope_only_update" BEFORE UPDATE ON machine_access_grants
  FOR EACH ROW EXECUTE FUNCTION reject_grant_non_scoping_update();
CREATE FUNCTION reject_grant_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'machine_access_grants rows are protected in conformance';
END;
$$;
CREATE TRIGGER "machine_access_grants_no_delete" BEFORE DELETE ON machine_access_grants
  FOR EACH ROW EXECUTE FUNCTION reject_grant_delete();
CREATE FUNCTION reject_client_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'machine clients are frozen in conformance';
END;
$$;
CREATE TRIGGER "machine_clients_immutable" BEFORE UPDATE OR DELETE ON machine_clients
  FOR EACH ROW EXECUTE FUNCTION reject_client_mutation();
CREATE FUNCTION reject_principal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'machine principals are frozen in conformance';
END;
$$;
CREATE TRIGGER "machine_principals_immutable" BEFORE UPDATE OR DELETE ON machine_principals
  FOR EACH ROW EXECUTE FUNCTION reject_principal_mutation();
CREATE FUNCTION reject_grant_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'grant change audit records are immutable in conformance';
END;
$$;
CREATE TRIGGER "grant_change_audits_immutable" BEFORE UPDATE OR DELETE ON grant_change_audits
  FOR EACH ROW EXECUTE FUNCTION reject_grant_audit_mutation();
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
COMMIT;
SQL

/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
INSERT INTO auth_audiences
  (audience_id, resource_service, scope_namespace, accepted_principal_types, registered_scopes,
   human_access_enabled, machine_access_enabled, delegated_access_enabled, status, freeze_ready, version, created_at, updated_at)
VALUES
  ('probe-aud', 'probe', 'probe', '{agent}', '{probe.read}', false, true, false, 'active', true, 1, now(), now());
INSERT INTO machine_principals (id, principal_type, status, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'agent', 'active', now(), now());
INSERT INTO machine_clients
  (id, client_id, machine_principal_id, secret_hash, external_ref, status, allowed_resources, allowed_scopes, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000b2', 'mc_probe000000000000000000', '00000000-0000-4000-8000-0000000000b1', 'probe', NULL, 'active', '{}', '{}', now(), now());
INSERT INTO machine_access_grants (machine_client_id, audience_id, scopes, version, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000b2', 'probe-aud', '{probe.read}', 1, now(), now());
DO $$
BEGIN
  BEGIN
    UPDATE machine_access_grants SET scopes = '{probe.other}', version = 2
      WHERE machine_client_id = '00000000-0000-4000-8000-0000000000b2' AND audience_id = 'probe-aud';
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'scopes+version update was rejected: %', SQLERRM;
  END;
  BEGIN
    UPDATE machine_access_grants SET updated_at = '2000-01-01 00:00:00'::timestamp WHERE audience_id = 'probe-aud';
    RAISE EXCEPTION 'grant tripwire accepted an updated_at change';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'only scopes and version may change on machine_access_grants' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE machine_access_grants SET audience_id = 'other-aud' WHERE audience_id = 'probe-aud';
    RAISE EXCEPTION 'grant tripwire accepted an audience change';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'only scopes and version may change on machine_access_grants' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM machine_access_grants WHERE audience_id = 'probe-aud';
    RAISE EXCEPTION 'grant tripwire accepted DELETE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'machine_access_grants rows are protected in conformance' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE machine_clients SET status = 'revoked' WHERE id = '00000000-0000-4000-8000-0000000000b2';
    RAISE EXCEPTION 'client freeze trigger accepted UPDATE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'machine clients are frozen in conformance' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM machine_clients WHERE id = '00000000-0000-4000-8000-0000000000b2';
    RAISE EXCEPTION 'client freeze trigger accepted DELETE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'machine clients are frozen in conformance' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE machine_principals SET display_name = 'x' WHERE id = '00000000-0000-4000-8000-0000000000b1';
    RAISE EXCEPTION 'principal freeze trigger accepted UPDATE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'machine principals are frozen in conformance' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO grant_change_audits
  (change_id, migration_id, source_git_commit, operator_id, approval_ref, reason, client_id,
   change_type, expected_grant_version, resulting_grant_version, before_value, after_value, timestamp)
VALUES
  ('00000000-0000-4000-8000-0000000000aa', 'probe', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'probe', 'probe', 'probe',
   'mc_probe000000000000000000', 'replace', 1, 2, NULL, '{}', now());
DO $$ BEGIN
  BEGIN UPDATE grant_change_audits SET reason = 'changed' WHERE change_id = '00000000-0000-4000-8000-0000000000aa';
    RAISE EXCEPTION 'audit immutability trigger accepted UPDATE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'grant change audit records are immutable in conformance' THEN RAISE; END IF;
  END;
  BEGIN DELETE FROM grant_change_audits WHERE change_id = '00000000-0000-4000-8000-0000000000aa';
    RAISE EXCEPTION 'audit immutability trigger accepted DELETE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'grant change audit records are immutable in conformance' THEN RAISE; END IF;
  END;
  BEGIN INSERT INTO grant_change_audits
    (change_id, migration_id, source_git_commit, operator_id, approval_ref, reason, client_id,
     change_type, expected_grant_version, resulting_grant_version, before_value, after_value, timestamp)
  VALUES
    ('00000000-0000-4000-8000-0000000000ab', 'probe', 'not-hex', 'probe', 'probe', 'probe',
     'mc_probe000000000000000000', 'replace', 1, 2, NULL, '{}', now());
    RAISE EXCEPTION 'audit source_commit CHECK accepted a non-hex commit';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'new row for relation "grant_change_audits" violates check constraint "grant_change_audits_source_commit_check"%' THEN RAISE; END IF;
  END;
END $$;
TRUNCATE machine_access_grants CASCADE;
TRUNCATE grant_change_audits;
TRUNCATE machine_clients CASCADE;
TRUNCATE machine_principals CASCADE;
TRUNCATE auth_audiences CASCADE;
SQL

echo 'SVC_FORUM_NARROW_AUDIT_CONTROLS_VERIFIED=true'

/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
CREATE ROLE svc_forum_narrow_runner LOGIN;
GRANT USAGE ON SCHEMA public TO svc_forum_narrow_runner;
GRANT SELECT ON machine_access_grants, grant_change_audits, trusted_proxies, delegation_grants TO svc_forum_narrow_runner;
GRANT SELECT ON machine_principals TO svc_forum_narrow_runner;
-- UPDATE/DELETE privileges exist only to satisfy LOCK TABLE (SHARE and
-- SHARE ROW EXCLUSIVE modes); the tripwires above mechanically restrict the
-- runner to the single target grant row's scopes+version and to audit INSERTs.
GRANT UPDATE, DELETE ON machine_access_grants TO svc_forum_narrow_runner;
GRANT INSERT, UPDATE, DELETE ON grant_change_audits TO svc_forum_narrow_runner;
GRANT UPDATE, DELETE ON machine_clients, machine_principals TO svc_forum_narrow_runner;
-- Column-level reads only: the runner must never observe legacy or secret columns.
GRANT SELECT (id, client_id, machine_principal_id, status, revoked_at) ON machine_clients TO svc_forum_narrow_runner;
SQL

LEGACY_PRIVILEGES="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -c \
  "SELECT has_column_privilege('svc_forum_narrow_runner','machine_clients','allowed_resources','SELECT')::text || ',' || has_column_privilege('svc_forum_narrow_runner','machine_clients','allowed_scopes','SELECT')::text || ',' || has_column_privilege('svc_forum_narrow_runner','machine_clients','secret_hash','SELECT')::text")"
[[ "$LEGACY_PRIVILEGES" == 'false,false,false' ]] || { echo 'FATAL: conformance runner can read legacy or secret columns' >&2; exit 1; }
echo 'SVC_FORUM_NARROW_LEGACY_COLUMN_SELECT_PRIVILEGES=false,false,false'

DESCRIPTOR="$(node -e '
const d={schema_version:1,container_id:process.argv[1],nonce:process.argv[2],host_port:Number(process.argv[3]),database:"auth_svc_forum_narrow_conformance",audit_metadata:{migration_id:"svc-forum-narrow-conformance-v1",source_git_commit:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",operator_id:"svc-forum-narrow-conformance",approval_ref:"https://github.com/mayf3/auth-service/issues/1#issuecomment-1",reason:"isolated svc-forum legacy grant narrowing conformance"}}; process.stdout.write(JSON.stringify(d));
' "$CONTAINER_ID" "$NONCE" "$HOST_PORT")"

(
  cd "$REPO_DIR"
  env -u DATABASE_URL node --import tsx tests/oauth/narrow-svc-forum-legacy-grant-v1.test.ts \
    3< <(printf '%s' "$DESCRIPTOR")
)

echo 'SVC_FORUM_NARROW_TEMP_DB_CONFORMANCE=PASS'
