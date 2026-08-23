#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE='postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
DATABASE='auth_tfs_conformance'
MIGRATION_SQL="$REPO_DIR/prisma/migrations/20260718000100_minimal_auth_v1_additive/migration.sql"
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
    observed_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.tfs-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$observed_label" == "sha256:$NONCE_HASH" ]]; then
      /usr/local/bin/docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
  fi
  if [[ -n "$CONTAINER_ID" ]] && /usr/local/bin/docker inspect "$CONTAINER_ID" >/dev/null 2>&1; then
    echo "FATAL: cleanup residue remains for owned container $CONTAINER_ID" >&2
    cleanup_failed=1
  elif [[ -z "$CONTAINER_ID" && -n "$CONTAINER_NAME" && -n "$NONCE_HASH" ]]; then
    local remaining_label
    remaining_label="$(/usr/local/bin/docker inspect --format '{{index .Config.Labels "com.mayf3.auth.tfs-conformance"}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    if [[ "$remaining_label" == "sha256:$NONCE_HASH" ]]; then
      echo "FATAL: cleanup residue remains for owned label/name $CONTAINER_NAME" >&2
      cleanup_failed=1
    fi
  fi
  if [[ $cleanup_failed -ne 0 ]]; then exit 97; fi
  echo 'TFS_CONFORMANCE_CONTAINER_ABSENT=true'
  exit "$ORIGINAL_EXIT"
}
trap cleanup EXIT INT TERM

for control in \
  grant_change_audits_source_commit_check \
  grant_change_audits_required_text_check \
  grant_change_audits_reason_check \
  grant_change_audits_version_check \
  grant_change_audits_value_shape_check \
  reject_auth_audit_mutation \
  grant_change_audits_immutable; do
  grep -Fq "$control" "$MIGRATION_SQL" || {
    echo "FATAL: canonical migration no longer contains $control" >&2
    exit 1
  }
done

NONCE="$(openssl rand -hex 32)"
NONCE_HASH="$(printf '%s' "$NONCE" | openssl dgst -sha256 | awk '{print $2}')"
CONTAINER_NAME="auth-tfs-conformance-$(printf '%s' "$NONCE" | cut -c1-16)"

CONTAINER_ID="$(/usr/local/bin/docker run -d --rm \
  --name "$CONTAINER_NAME" \
  --label "com.mayf3.auth.tfs-conformance=sha256:$NONCE_HASH" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e "POSTGRES_DB=$DATABASE" \
  -p 127.0.0.1::5432 \
  "$IMAGE" \
  -c "tfs.conformance_nonce=$NONCE")"

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

/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
BEGIN;
ALTER TABLE "grant_change_audits"
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
CREATE FUNCTION reject_auth_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auth audit records are immutable';
END;
$$;
CREATE TRIGGER "grant_change_audits_immutable" BEFORE UPDATE OR DELETE ON "grant_change_audits"
  FOR EACH ROW EXECUTE FUNCTION reject_auth_audit_mutation();
CREATE ROLE tfs_runner LOGIN;
GRANT USAGE ON SCHEMA public TO tfs_runner;
GRANT SELECT (id, client_id, machine_principal_id, external_ref, status) ON machine_clients TO tfs_runner;
GRANT SELECT ON machine_principals, auth_audiences, trusted_proxies, delegation_grants TO tfs_runner;
GRANT SELECT, INSERT, UPDATE, DELETE ON machine_access_grants, grant_change_audits TO tfs_runner;
COMMIT;
SQL

LEGACY_PRIVILEGES="$(/usr/local/bin/docker exec "$CONTAINER_ID" psql -At -U postgres -d "$DATABASE" -c \
  "SELECT has_column_privilege('tfs_runner','machine_clients','allowed_resources','SELECT')::text || ',' || has_column_privilege('tfs_runner','machine_clients','allowed_scopes','SELECT')::text")"
[[ "$LEGACY_PRIVILEGES" == 'false,false' ]] || { echo 'FATAL: conformance runner can read legacy columns' >&2; exit 1; }
echo 'TFS_LEGACY_COLUMN_SELECT_PRIVILEGES=false,false'

/usr/local/bin/docker exec -i "$CONTAINER_ID" psql -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" <<'SQL'
DO $$
DECLARE got text;
BEGIN
  BEGIN
    INSERT INTO grant_change_audits VALUES
      ('00000000-0000-4000-8000-000000000001','probe-source','BAD','op','approval','reason','mc_probe','create',NULL,1,NULL,'{}',now());
    RAISE EXCEPTION 'source constraint accepted invalid row';
  EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS got = CONSTRAINT_NAME;
    IF got <> 'grant_change_audits_source_commit_check' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO grant_change_audits VALUES
      ('00000000-0000-4000-8000-000000000002','','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','op','approval','reason','mc_probe','create',NULL,1,NULL,'{}',now());
    RAISE EXCEPTION 'required-text constraint accepted invalid row';
  EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS got = CONSTRAINT_NAME;
    IF got <> 'grant_change_audits_required_text_check' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO grant_change_audits VALUES
      ('00000000-0000-4000-8000-000000000003','probe-reason','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','op','approval','','mc_probe','create',NULL,1,NULL,'{}',now());
    RAISE EXCEPTION 'reason constraint accepted invalid row';
  EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS got = CONSTRAINT_NAME;
    IF got <> 'grant_change_audits_reason_check' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO grant_change_audits VALUES
      ('00000000-0000-4000-8000-000000000004','probe-version','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','op','approval','reason','mc_probe','create',NULL,0,NULL,'{}',now());
    RAISE EXCEPTION 'version constraint accepted invalid row';
  EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS got = CONSTRAINT_NAME;
    IF got <> 'grant_change_audits_version_check' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO grant_change_audits VALUES
      ('00000000-0000-4000-8000-000000000005','probe-shape','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','op','approval','reason','mc_probe','create',NULL,1,NULL,NULL,now());
    RAISE EXCEPTION 'value-shape constraint accepted invalid row';
  EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS got = CONSTRAINT_NAME;
    IF got <> 'grant_change_audits_value_shape_check' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO grant_change_audits VALUES
  ('00000000-0000-4000-8000-000000000006','probe-trigger','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','op','approval','reason','mc_probe','create',NULL,1,NULL,'{}',now());
DO $$ BEGIN
  BEGIN UPDATE grant_change_audits SET reason='changed' WHERE migration_id='probe-trigger';
    RAISE EXCEPTION 'immutable trigger accepted UPDATE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'auth audit records are immutable' THEN RAISE; END IF;
  END;
  BEGIN DELETE FROM grant_change_audits WHERE migration_id='probe-trigger';
    RAISE EXCEPTION 'immutable trigger accepted DELETE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'auth audit records are immutable' THEN RAISE; END IF;
  END;
END $$;
SQL

echo 'TFS_AUDIT_CONTROLS_VERIFIED=true'
DESCRIPTOR="$(node -e '
const d={schema_version:1,container_id:process.argv[1],nonce:process.argv[2],host_port:Number(process.argv[3]),database:"auth_tfs_conformance",audit_metadata:{migration_id:"agentcore-trusted-fleet-grant-supply-v1",source_git_commit:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",operator_id:"tfs-conformance",approval_ref:"https://github.com/mayf3/auth-service/issues/1#issuecomment-1",reason:"isolated trusted fleet supply conformance"},fixture_mapping:{},mapping_sha256:"0".repeat(64),plan_sha256:"0".repeat(64)}; process.stdout.write(JSON.stringify(d));
' "$CONTAINER_ID" "$NONCE" "$HOST_PORT")"

(
  cd "$REPO_DIR"
  env -u DATABASE_URL node --import tsx tests/oauth/supply-agentcore-trusted-fleet-grants-v1.test.ts \
    3< <(printf '%s' "$DESCRIPTOR")
)

echo 'TFS_TEMP_DB_CONFORMANCE=PASS'
