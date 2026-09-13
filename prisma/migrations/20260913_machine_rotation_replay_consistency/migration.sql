-- MACHINE_CLIENT_CREDENTIALS_V0 / AUTH_ROTATION_REPLAY_CONSISTENCY (T36+T43):
-- Replay branch hardening for the canonical explicit ROTATE seam.
--
-- OWNER SECURITY DECISION (OWNER_SEMANTIC_DECISIONS_AND_REPAIR_RELEASE_20260913_V1,
-- recorded verbatim in the queue ticket OWNER_DECISION_COMMIT block):
--   (1) IDEMPOTENCY_IDENTITY = operation type + target resource/client +
--       operationId. Same operationId + different target client -> explicit
--       IDEMPOTENCY_CONFLICT; never replay another target's receipt/secret.
--   (2) Same target + same operationId -> replay immutable receipt metadata.
--   (3) Live-state invariant: if the live credential generation/hash has
--       advanced past the receipt postimage, replay returns
--       STALE_IDEMPOTENCY_RECEIPT instead of a fake success.
-- (4) Secret semantics are enforced in the service layer: a replay NEVER
--     re-emits credential secret material.
--
-- ADMIN HANDSHAKE (same three steps as 20260909010000; the CREATE OR REPLACE
-- below must run as/with the function owner machine_credential_owner):
--   1. AS ADMIN: GRANT machine_credential_owner TO <migration_role>;
--   2. run THIS migration as <migration_role>;
--   3. AS ADMIN: REVOKE machine_credential_owner FROM <migration_role>;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'machine_credential_owner') THEN
    RAISE EXCEPTION 'OWNERSHIP_TRANSFER_PREREQUISITE: role machine_credential_owner missing (see 20260909010000 handshake)';
  END IF;
  IF NOT pg_has_role(current_user, 'machine_credential_owner', 'MEMBER') THEN
    RAISE EXCEPTION 'OWNERSHIP_TRANSFER_PREREQUISITE: % must be a member of machine_credential_owner for this migration (handshake step 1)', current_user;
  END IF;
END
$$;

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
  v_live_fp     text;
BEGIN
  -- Deterministic replay: a known operation id never mutates again — and it
  -- is bound to exactly the target it originally rotated.
  SELECT * INTO v_existing FROM machine_client_rotations
   WHERE operation_id = p_operation_id;
  IF FOUND THEN
    -- (1) Target binding: the operation is bound to the client it rotated.
    IF v_existing.machine_client_id <> p_client_uuid THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: operation_id % is bound to a different rotation target (no mutation performed)', left(p_operation_id, 64);
    END IF;
    -- (3) Live-state invariant: the live secret generation must still equal
    -- the receipt postimage; otherwise this receipt describes a credential
    -- generation that no longer exists.
    SELECT encode(sha256(convert_to(secret_hash, 'utf8')), 'hex')
      INTO v_live_fp
      FROM machine_clients WHERE id = p_client_uuid;
    IF v_live_fp IS DISTINCT FROM lower(v_existing.postimage_fingerprint) THEN
      RAISE EXCEPTION 'STALE_IDEMPOTENCY_RECEIPT: live credential generation has advanced past receipt %', left(p_operation_id, 64);
    END IF;
    -- (2) Immutable receipt metadata replay (never re-emits secret material;
    --     the service layer strips credential material from this response).
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
