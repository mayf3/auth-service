-- MACHINE_CLIENT_CREDENTIALS_V0 Amendment A — Secret-Mutation Enforcement Seam
-- (external prerequisite (e) SECRET_MUTATION_ENFORCEMENT_SEAM)
--
-- Governing authority: auth-service docs/contracts/MACHINE_CLIENT_CREDENTIALS_V0.md §11.
-- Governing external spec: dsh-agent-core docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md
--   Amendment 7 Part I.2 (DIRECT_APP_ROLE_SECRET_UPDATE = IMPOSSIBLE;
--   SECRET_HASH_CHANGE_WITHOUT_ROTATION_AUDIT = IMPOSSIBLE).
--
-- Frozen properties (scope = ordinary supported production application/operator
-- DB identities; PostgreSQL superuser / host root is out of scope by definition):
--   1. The application/operator role can no longer UPDATE machine_clients'
--      secret_hash / rotated_at columns (real privilege boundary via ownership
--      separation + column-level grants).
--   2. Secret material changes ONLY via rotate_machine_client_secret() — a
--      SECURITY DEFINER function owned by the boundary role which atomically:
--      verifies the frozen preimage fingerprint, advances rotated_at/updated_at,
--      and appends an immutable receipt row (operation_id UNIQUE ⇒ replay of a
--      known operation id never mutates again).
--   3. Defense-in-depth trigger: even the owning role cannot change secret
--      material through ordinary row DML — only the SECURITY DEFINER context
--      (current_user = owner AND session_user <> current_user) passes.
--
-- OPERATIONAL CONSTRAINT (documented in contract §11): future DDL on
-- machine_clients must be applied as machine_credential_owner. This migration
-- must be applied by the table owner (the role that runs migrations).
--
-- ADMIN HANDSHAKE (three steps, because PostgreSQL requires membership in the
-- target role to transfer ownership, and that membership must be revoked
-- afterwards to seal the boundary):
--   1. AS ADMIN:  CREATE ROLE machine_credential_owner NOLOGIN;
--                 GRANT CREATE ON SCHEMA public TO machine_credential_owner;
--                   (the NEW owning role must hold CREATE on the schema —
--                    PostgreSQL requirement for ALTER ... OWNER TO)
--                 GRANT machine_credential_owner TO <migration_role>;
--   2. run THIS migration as <migration_role> (the current table owner);
--   3. AS ADMIN:  REVOKE machine_credential_owner FROM <migration_role>;
--      (seals the boundary: the migration role can no longer SET ROLE to the
--       owner, so the column-level grants below are the whole DML surface)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'machine_credential_owner') THEN
    CREATE ROLE machine_credential_owner NOLOGIN;
  END IF;
  IF NOT pg_has_role(current_user, 'machine_credential_owner', 'MEMBER') THEN
    RAISE EXCEPTION 'OWNERSHIP_TRANSFER_PREREQUISITE: % must be a member of machine_credential_owner for this migration (admin handshake step 1: GRANT machine_credential_owner TO %; step 3 after migration: REVOKE). See contract §11.3', current_user, current_user;
  END IF;
END
$$;

ALTER TABLE machine_clients OWNER TO machine_credential_owner;

-- Application DML surface: everything EXCEPT the secret-material columns.
GRANT SELECT ON machine_clients TO current_user;
GRANT INSERT ON machine_clients TO current_user;
GRANT UPDATE (client_id, machine_principal_id, external_ref, status,
              allowed_resources, allowed_scopes, updated_at, revoked_at)
  ON machine_clients TO current_user;
-- Row deletion is NOT a secret mutation (no secret material is changed) and is
-- required by existing lifecycle/cleanup paths; audit receipts persist because
-- the ledger carries no FK (see below).
GRANT DELETE ON machine_clients TO current_user;

-- Rotation receipt ledger (PLAN→APPLY→VERIFY→RECEIPT). Append-only audit:
-- intentionally NO FK to machine_clients so receipts survive client deletion;
-- no DELETE/UPDATE grant is issued to the application role.
CREATE TABLE IF NOT EXISTS machine_client_rotations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id          text NOT NULL UNIQUE,
  machine_client_id     uuid NOT NULL,
  client_id             text NOT NULL,
  preimage_fingerprint  text NOT NULL,
  postimage_fingerprint text NOT NULL,
  rotated_by            text NOT NULL,
  rotated_at            timestamp(3) NOT NULL,
  created_at            timestamp(3) NOT NULL DEFAULT now()
);
ALTER TABLE machine_client_rotations OWNER TO machine_credential_owner;
GRANT SELECT ON machine_client_rotations TO current_user;

-- The ONLY supported secret-mutation path (canonical explicit ROTATE seam).
CREATE OR REPLACE FUNCTION rotate_machine_client_secret(
  p_client_uuid          uuid,
  p_new_secret_hash      text,
  p_preimage_fingerprint text,
  p_operation_id         text,
  p_rotated_by           text
)
RETURNS TABLE (client_id text, rotated_at timestamp(3), receipt_id uuid, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row         machine_clients;
  v_existing    machine_client_rotations;
  v_preimage_fp text;
  v_post_fp     text;
  v_rotated_at  timestamp(3);
  v_receipt_id  uuid;
BEGIN
  -- Deterministic replay: a known operation id never mutates again.
  SELECT * INTO v_existing FROM machine_client_rotations
   WHERE operation_id = p_operation_id;
  IF FOUND THEN
    client_id := v_existing.client_id;
    rotated_at := v_existing.rotated_at;
    receipt_id := v_existing.id;
    replayed := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Exact target + preimage generation check (fail closed, zero mutation).
  SELECT * INTO v_row FROM machine_clients WHERE id = p_client_uuid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROTATION_TARGET_NOT_FOUND';
  END IF;
  IF v_row.status <> 'active' THEN
    RAISE EXCEPTION 'ROTATION_TARGET_NOT_ACTIVE';
  END IF;
  v_preimage_fp := encode(sha256(convert_to(v_row.secret_hash, 'utf8')), 'hex');
  IF v_preimage_fp <> lower(p_preimage_fingerprint) THEN
    RAISE EXCEPTION 'ROTATION_PREIMAGE_MISMATCH: live secret generation does not match frozen preimage (live=%, expected=%)', left(v_preimage_fp, 12), left(lower(p_preimage_fingerprint), 12);
  END IF;

  v_post_fp := encode(sha256(convert_to(p_new_secret_hash, 'utf8')), 'hex');
  v_rotated_at := now();

  UPDATE machine_clients
     SET secret_hash = p_new_secret_hash,
         rotated_at  = v_rotated_at,
         updated_at  = v_rotated_at
   WHERE id = p_client_uuid;

  INSERT INTO machine_client_rotations
    (operation_id, machine_client_id, client_id, preimage_fingerprint,
     postimage_fingerprint, rotated_by, rotated_at)
  VALUES
    (p_operation_id, p_client_uuid, v_row.client_id, v_preimage_fp,
     v_post_fp, p_rotated_by, v_rotated_at)
  RETURNING id INTO v_receipt_id;

  client_id := v_row.client_id;
  rotated_at := v_rotated_at;
  receipt_id := v_receipt_id;
  replayed := false;
  RETURN NEXT;
END;
$$;
ALTER FUNCTION rotate_machine_client_secret(uuid, text, text, text, text)
  OWNER TO machine_credential_owner;
REVOKE ALL ON FUNCTION rotate_machine_client_secret(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rotate_machine_client_secret(uuid, text, text, text, text)
  TO current_user;

-- Defense-in-depth: block secret-material changes through ordinary row DML for
-- EVERY role except the SECURITY DEFINER context of the rotation function.
CREATE OR REPLACE FUNCTION machine_clients_secret_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.secret_hash IS DISTINCT FROM OLD.secret_hash
     OR NEW.rotated_at IS DISTINCT FROM OLD.rotated_at THEN
    IF current_user = 'machine_credential_owner' AND session_user <> current_user THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'MACHINE_CLIENT_SECRET_MUTATION_OUTSIDE_ROTATION_SEAM';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION machine_clients_secret_guard() OWNER TO machine_credential_owner;

DROP TRIGGER IF EXISTS machine_clients_secret_guard ON machine_clients;
CREATE TRIGGER machine_clients_secret_guard
BEFORE UPDATE ON machine_clients
FOR EACH ROW EXECUTE FUNCTION machine_clients_secret_guard();
