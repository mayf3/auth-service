-- AUTH_SVC_OKR_PRODUCTION_ACTIVATION_REPAIR_V1
--
-- Phase 1: Materialize svc-okr Audience in auth_audiences
-- Phase 2: Create svc-okr Grant for the authoritative CEO Client
--
-- Target (authoritative database state):
--   PRINCIPAL_ID = b6b033c4-90ba-40aa-a338-304da442cab7
--   CLIENT_ID    = mc_HLxfspbjzHEdXmiiX3Gk7D27
--   AUDIENCE     = svc-okr
--   SCOPES       = okr.read, okr.write
--
-- Behaviour:
--   - Audience not found  → create with frozen registry values
--   - Audience exact match → no-op
--   - Audience mismatch    → fail closed (RAISE EXCEPTION)
--   - Grant not found      → create (okr.read, okr.write, version=1)
--   - Grant exact match    → no-op, version unchanged
--   - Grant scopes mismatch → fail closed
--   - Wrong client/principal → fail closed
--   - Other clients/audiences/grants untouched
--
-- Idempotent: safe to run multiple times.

DO $$
DECLARE
  v_client_db_id       UUID;
  v_principal_id       UUID;
  v_current_scopes     TEXT[];
  v_current_version    INTEGER;
  v_expected_scopes    TEXT[] := ARRAY['okr.read', 'okr.write'];
BEGIN
  -- ===========================================================================
  -- Phase 1: svc-okr Audience
  -- ===========================================================================

  -- Check if svc-okr already exists in auth_audiences
  IF NOT EXISTS (SELECT 1 FROM auth_audiences WHERE audience_id = 'svc-okr') THEN
    INSERT INTO auth_audiences (
      audience_id, resource_service, scope_namespace,
      accepted_principal_types, registered_scopes,
      human_access_enabled, machine_access_enabled, delegated_access_enabled,
      status, freeze_ready, version,
      created_at, updated_at
    ) VALUES (
      'svc-okr', 'svc-okr', 'okr',
      ARRAY['user', 'agent'], ARRAY['okr.read', 'okr.write'],
      true, true, false,
      'active', true, 1,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    RAISE NOTICE 'AUDIENCE_CREATED: svc-okr audience created in auth_audiences';
  ELSE
    -- Verify the existing audience matches the frozen registry definition
    -- If registered_scopes or critical fields differ, fail closed
    IF EXISTS (
      SELECT 1 FROM auth_audiences
      WHERE audience_id = 'svc-okr'
        AND (
          registered_scopes IS DISTINCT FROM ARRAY['okr.read', 'okr.write']
          OR resource_service IS DISTINCT FROM 'svc-okr'
          OR scope_namespace IS DISTINCT FROM 'okr'
          OR accepted_principal_types IS DISTINCT FROM ARRAY['user', 'agent']
          OR human_access_enabled IS DISTINCT FROM true
          OR machine_access_enabled IS DISTINCT FROM true
          OR delegated_access_enabled IS DISTINCT FROM false
        )
    ) THEN
      RAISE EXCEPTION 'AUDIENCE_MISMATCH: svc-okr audience exists with unexpected values';
    END IF;
    RAISE NOTICE 'AUDIENCE_EXISTS_OK: svc-okr audience already exists with correct values';
  END IF;

  -- ===========================================================================
  -- Phase 2: CEO Client svc-okr Grant
  -- ===========================================================================

  -- 1. Validate that the fixed PRINCIPAL_ID exists
  IF NOT EXISTS (
    SELECT 1 FROM machine_principals
    WHERE id = 'b6b033c4-90ba-40aa-a338-304da442cab7'::uuid
  ) THEN
    RAISE EXCEPTION 'FIXED_PRINCIPAL_NOT_FOUND: principal b6b033c4-90ba-40aa-a338-304da442cab7 does not exist';
  END IF;

  -- 2. Look up the authoritative CEO Client by its stable client_id
  SELECT mc.id, mc.machine_principal_id
    INTO v_client_db_id, v_principal_id
  FROM machine_clients mc
  WHERE mc.client_id = 'mc_HLxfspbjzHEdXmiiX3Gk7D27';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CEO_CLIENT_NOT_FOUND: client mc_HLxfspbjzHEdXmiiX3Gk7D27 does not exist';
  END IF;

  -- 3. Verify the Client belongs to the fixed PRINCIPAL_ID
  IF v_principal_id IS DISTINCT FROM 'b6b033c4-90ba-40aa-a338-304da442cab7'::uuid THEN
    RAISE EXCEPTION 'WRONG_PRINCIPAL: client mc_HLxfspbjzHEdXmiiX3Gk7D27 belongs to principal % instead of b6b033c4-90ba-40aa-a338-304da442cab7',
      v_principal_id;
  END IF;

  -- 4. Check if the svc-okr grant already exists
  SELECT mag.scopes, mag.version
    INTO v_current_scopes, v_current_version
  FROM machine_access_grants mag
  WHERE mag.machine_client_id = v_client_db_id
    AND mag.audience_id = 'svc-okr';

  IF NOT FOUND THEN
    -- Grant does not exist → create it
    INSERT INTO machine_access_grants (machine_client_id, audience_id, scopes, version, created_at, updated_at)
    VALUES (v_client_db_id, 'svc-okr', v_expected_scopes, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    RAISE NOTICE 'GRANT_CREATED: svc-okr grant for mc_HLxfspbjzHEdXmiiX3Gk7D27 created with scopes [okr.read, okr.write] (version=1)';
    RETURN;
  END IF;

  -- 5. Grant exists — check for exact match
  -- CASE A: Scopes already exactly [okr.read, okr.write] → no-op
  IF v_current_scopes = ARRAY['okr.read', 'okr.write'] THEN
    RAISE NOTICE 'GRANT_ALREADY_UP_TO_DATE: svc-okr grant for mc_HLxfspbjzHEdXmiiX3Gk7D27 already has scopes [okr.read, okr.write] (version=%)', v_current_version;
    RETURN;
  END IF;

  -- CASE B: Unexpected state → fail closed
  RAISE EXCEPTION 'UNEXPECTED_GRANT_STATE: svc-okr grant for mc_HLxfspbjzHEdXmiiX3Gk7D27 has unexpected scopes=% (version=%)',
    v_current_scopes, v_current_version;
END;
$$;

-- ===========================================================================
-- Post-migration verification
-- ===========================================================================

DO $$
DECLARE
  v_audience_count INTEGER;
  v_scopes         TEXT[];
  v_version        INTEGER;
  v_grant_count    INTEGER;
  v_workflow_scopes TEXT[];
  v_id             UUID;
BEGIN
  -- Verify svc-okr audience exists
  SELECT COUNT(*) INTO v_audience_count FROM auth_audiences WHERE audience_id = 'svc-okr';
  IF v_audience_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: svc-okr audience not found after migration';
  END IF;

  -- Look up CEO client
  SELECT mc.id INTO v_id
  FROM machine_clients mc
  WHERE mc.client_id = 'mc_HLxfspbjzHEdXmiiX3Gk7D27';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: CEO client not found after migration';
  END IF;

  -- Verify svc-okr grant
  SELECT mag.scopes, mag.version
    INTO v_scopes, v_version
  FROM machine_access_grants mag
  WHERE mag.machine_client_id = v_id
    AND mag.audience_id = 'svc-okr';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: svc-okr grant not found after migration';
  END IF;

  IF v_scopes IS DISTINCT FROM ARRAY['okr.read', 'okr.write'] THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: svc-okr grant scopes mismatch after migration: got %', v_scopes;
  END IF;

  -- Verify svc-workflow grant is preserved
  SELECT mag.scopes INTO v_workflow_scopes
  FROM machine_access_grants mag
  WHERE mag.machine_client_id = v_id
    AND mag.audience_id = 'svc-workflow';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: svc-workflow grant missing after migration';
  END IF;

  IF v_workflow_scopes IS DISTINCT FROM ARRAY['workflow.read', 'workflow.execute'] THEN
    RAISE EXCEPTION 'VERIFICATION_FAILED: svc-workflow grant scopes changed: got %', v_workflow_scopes;
  END IF;

  -- Count total grants for CEO client (should be exactly 2: svc-workflow + svc-okr)
  SELECT COUNT(*) INTO v_grant_count
  FROM machine_access_grants mag
  WHERE mag.machine_client_id = v_id;

  RAISE NOTICE 'VERIFICATION_PASSED: svc-okr audience exists, grant scopes=%, version=%, svc-workflow preserved, total_grants=%', v_scopes, v_version, v_grant_count;
END;
$$;
