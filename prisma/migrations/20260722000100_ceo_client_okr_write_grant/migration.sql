-- AUTH_SVC_OKR_MINIMAL_WRITE_SCOPE_V1
--
-- Add okr.write to the CEO Client's svc-okr grant.
--
-- Target:
--   CLIENT_ID   = mc_xKGDsFSfU-Vdpv8nrofFQMu3
--   PRINCIPAL_ID = b6b033c4-90ba-40aa-a338-304da442cab7
--   AUDIENCE    = svc-okr
--   SOURCE      = [okr.read]  →  TARGET = [okr.read, okr.write]
--
-- Constraints (see requirements):
--   - If current scopes exactly [okr.read]      → update, version+1
--   - If current scopes exactly [okr.read, okr.write] → no-op, version unchanged
--   - If scopes contain other values, wrong order,
--     duplicates, or unknown scopes              → fail closed, no overwrite
--   - If client/principal/audience/grant missing → fail closed
--   - If client's principal does not match       → fail closed
--   - Other clients' grants untouched
--   - Other audience grants for same client untouched
--   - If grant is in any unexpected state       → fail closed
--
-- This is a forward-only, non-destructive migration.
-- It can be run multiple times safely (idempotent).

DO $$
DECLARE
  v_client_db_id       UUID;
  v_principal_id       UUID;
  v_current_scopes     TEXT[];
  v_current_version    INTEGER;
  v_expected_principal ALIAS FOR $1;
  v_target_scopes      TEXT[] := ARRAY['okr.read', 'okr.write'];
  v_source_scopes      TEXT[] := ARRAY['okr.read'];
  v_has_other_grants   BOOLEAN;
  v_other_audiences    TEXT[];
BEGIN
  -- =========================================================================
  -- 1. Validate that the fixed PRINCIPAL_ID exists
  -- =========================================================================
  IF NOT EXISTS (
    SELECT 1 FROM machine_principals
    WHERE id = 'b6b033c4-90ba-40aa-a338-304da442cab7'::uuid
  ) THEN
    RAISE EXCEPTION 'FIXED_PRINCIPAL_NOT_FOUND: principal b6b033c4-90ba-40aa-a338-304da442cab7 does not exist';
  END IF;

  -- =========================================================================
  -- 2. Validate that the target AUDIENCE exists
  -- =========================================================================
  IF NOT EXISTS (
    SELECT 1 FROM auth_audiences WHERE audience_id = 'svc-okr'
  ) THEN
    RAISE EXCEPTION 'TARGET_AUDIENCE_NOT_FOUND: audience svc-okr does not exist';
  END IF;

  -- =========================================================================
  -- 3. Look up the CEO Client by its stable client_id
  -- =========================================================================
  SELECT mc.id, mc.machine_principal_id
    INTO v_client_db_id, v_principal_id
  FROM machine_clients mc
  WHERE mc.client_id = 'mc_xKGDsFSfU-Vdpv8nrofFQMu3';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CEO_CLIENT_NOT_FOUND: client mc_xKGDsFSfU-Vdpv8nrofFQMu3 does not exist';
  END IF;

  -- =========================================================================
  -- 4. Verify the Client belongs to the fixed PRINCIPAL_ID
  -- =========================================================================
  IF v_principal_id IS DISTINCT FROM 'b6b033c4-90ba-40aa-a338-304da442cab7'::uuid THEN
    RAISE EXCEPTION 'WRONG_PRINCIPAL: client mc_xKGDsFSfU-Vdpv8nrofFQMu3 belongs to principal % instead of b6b033c4-90ba-40aa-a338-304da442cab7',
      v_principal_id;
  END IF;

  -- =========================================================================
  -- 5. Check if the svc-okr grant exists
  -- =========================================================================
  SELECT mag.scopes, mag.version
    INTO v_current_scopes, v_current_version
  FROM machine_access_grants mag
  WHERE mag.machine_client_id = v_client_db_id
    AND mag.audience_id = 'svc-okr';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRANT_NOT_FOUND: no svc-okr grant for client mc_xKGDsFSfU-Vdpv8nrofFQMu3';
  END IF;

  -- =========================================================================
  -- 6. Check that the client has no OTHER svc-okr grants (should not happen
  --    since the PK is (machine_client_id, audience_id), but verify anyway)
  -- =========================================================================

  -- =========================================================================
  -- 7. Handle the actual migration logic
  -- =========================================================================

  -- CASE A: Scopes already exactly [okr.read, okr.write] → no-op
  IF v_current_scopes = ARRAY['okr.read', 'okr.write'] THEN
    RAISE NOTICE 'GRANT_ALREADY_UP_TO_DATE: svc-okr grant for mc_xKGDsFSfU-Vdpv8nrofFQMu3 already has scopes [okr.read, okr.write] (version=%)', v_current_version;
    RETURN;
  END IF;

  -- CASE B: Scopes exactly [okr.read] → update
  IF v_current_scopes = ARRAY['okr.read'] THEN
    UPDATE machine_access_grants
    SET
      scopes = ARRAY['okr.read', 'okr.write'],
      version = version + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE machine_client_id = v_client_db_id
      AND audience_id = 'svc-okr';

    RAISE NOTICE 'GRANT_UPDATED: svc-okr grant for mc_xKGDsFSfU-Vdpv8nrofFQMu3 updated from [okr.read] to [okr.read, okr.write] (version=%)',
      v_current_version + 1;
    RETURN;
  END IF;

  -- CASE C: Unexpected state → fail closed
  RAISE EXCEPTION 'UNEXPECTED_GRANT_STATE: svc-okr grant for mc_xKGDsFSfU-Vdpv8nrofFQMu3 has unexpected scopes=% (version=%)',
    v_current_scopes, v_current_version;
END;
$$;

-- ===========================================================================
-- Post-migration verification
-- ===========================================================================

DO $$
DECLARE
  v_scopes  TEXT[];
  v_version INTEGER;
  v_id      UUID;
BEGIN
  SELECT mc.id INTO v_id
  FROM machine_clients mc
  WHERE mc.client_id = 'mc_xKGDsFSfU-Vdpv8nrofFQMu3';

  SELECT mag.scopes, mag.version
    INTO v_scopes, v_version
  FROM machine_access_grants mag
  WHERE mag.machine_client_id = v_id
    AND mag.audience_id = 'svc-okr';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: svc-okr grant not found after migration';
  END IF;

  IF v_scopes IS DISTINCT FROM ARRAY['okr.read', 'okr.write'] THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: scopes mismatch after migration: got %', v_scopes;
  END IF;

  RAISE NOTICE 'VERIFICATION_PASSED: svc-okr grant scopes=%, version=%', v_scopes, v_version;
END;
$$;
