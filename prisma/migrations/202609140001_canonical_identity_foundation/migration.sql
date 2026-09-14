-- AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1; empty install only, no enrollment.
CREATE TYPE "AgentIdentityState" AS ENUM ('unresolved', 'canonical', 'legacy', 'retired');
CREATE TABLE agent_identity_lifecycle (
 principal_id uuid PRIMARY KEY REFERENCES machine_principals(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 state "AgentIdentityState" NOT NULL,
 revision bigint NOT NULL CHECK (revision > 0),
 evidence_ref text NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
 created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE agent_identity_successors (
 source_principal_id uuid PRIMARY KEY REFERENCES machine_principals(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 target_principal_id uuid NOT NULL REFERENCES machine_principals(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 evidence_ref text NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
 created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(source_principal_id <> target_principal_id)
);
CREATE INDEX agent_identity_successors_target_idx ON agent_identity_successors(target_principal_id);

-- One shared lock namespace. All new-table writes require SERIALIZABLE before
-- reading graph state. Fences are real MVCC writes, not row locks; they preserve
-- every business field, including updated_at, and skip recursive validation.
CREATE FUNCTION agent_identity_mutation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids uuid[]; pid uuid;
BEGIN
 IF current_setting('transaction_isolation') <> 'serializable' THEN
  RAISE EXCEPTION 'identity mutation requires serializable' USING ERRCODE='23514';
 END IF;
 PERFORM pg_advisory_xact_lock(173496021, 1);
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'identity evidence is append preserving' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='agent_identity_lifecycle' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.principal_id IS DISTINCT FROM OLD.principal_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.state='retired' AND NEW.state<>OLD.state)
     OR (NEW.state=OLD.state AND (NEW.revision<>OLD.revision OR NEW.evidence_ref<>OLD.evidence_ref))
     OR (NEW.state<>OLD.state AND NEW.revision<>OLD.revision+1) THEN
    RAISE EXCEPTION 'invalid lifecycle amendment' USING ERRCODE='23514';
   END IF;
  END IF;
  ids := ARRAY[NEW.principal_id];
  ids := ids || ARRAY(SELECT source_principal_id FROM agent_identity_successors WHERE target_principal_id=NEW.principal_id)
             || ARRAY(SELECT target_principal_id FROM agent_identity_successors WHERE source_principal_id=NEW.principal_id);
 ELSE
  IF TG_OP='UPDATE' AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'successor evidence is immutable' USING ERRCODE='23514';
  END IF;
  ids := ARRAY[NEW.source_principal_id,NEW.target_principal_id];
 END IF;
 FOR pid IN SELECT DISTINCT x FROM unnest(ids) x ORDER BY x LOOP
  UPDATE machine_principals SET id=id WHERE id=pid;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER agent_identity_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON agent_identity_lifecycle
 FOR EACH ROW EXECUTE FUNCTION agent_identity_mutation_guard();
CREATE TRIGGER agent_identity_successors_guard BEFORE INSERT OR UPDATE OR DELETE ON agent_identity_successors
 FOR EACH ROW EXECUTE FUNCTION agent_identity_mutation_guard();

-- VOLATILE queries get fresh command snapshots at READ COMMITTED. Stronger
-- isolation uses the Principal fences above to abort stale writers instead.
CREATE FUNCTION agent_identity_validate_graph() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='machine_principals' THEN
  IF NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.principal_type IS NOT DISTINCT FROM OLD.principal_type
   AND NEW.agent_id IS NOT DISTINCT FROM OLD.agent_id AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
   RETURN NEW;
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(173496021, 1);
 IF EXISTS (
  SELECT 1 FROM agent_identity_lifecycle l JOIN machine_principals p ON p.id=l.principal_id
  WHERE p.principal_type::text<>'agent' OR (l.state='canonical' AND
    (p.status::text<>'active' OR p.agent_id IS NULL OR length(p.agent_id) NOT BETWEEN 5 AND 128 OR p.agent_id !~ '^agt_[a-z0-9-]+$'))
 ) OR EXISTS (
  SELECT 1 FROM agent_identity_successors e
  LEFT JOIN agent_identity_lifecycle s ON s.principal_id=e.source_principal_id
  LEFT JOIN agent_identity_lifecycle t ON t.principal_id=e.target_principal_id
  WHERE s.state IS NULL OR s.state NOT IN ('legacy','retired') OR t.state IS NULL OR t.state<>'canonical'
   OR EXISTS(SELECT 1 FROM agent_identity_successors x WHERE x.source_principal_id=e.target_principal_id)
 ) THEN
  RAISE EXCEPTION 'invalid canonical identity graph' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
-- Principal lock is acquired before validation, not only at deferred commit.
CREATE FUNCTION agent_identity_principal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.principal_type IS DISTINCT FROM OLD.principal_type
   OR NEW.agent_id IS DISTINCT FROM OLD.agent_id OR NEW.status IS DISTINCT FROM OLD.status THEN
  PERFORM pg_advisory_xact_lock(173496021, 1);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER agent_identity_principal_guard BEFORE UPDATE ON machine_principals
 FOR EACH ROW EXECUTE FUNCTION agent_identity_principal_guard();
CREATE CONSTRAINT TRIGGER agent_identity_principal_check AFTER UPDATE ON machine_principals
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION agent_identity_validate_graph();
CREATE CONSTRAINT TRIGGER agent_identity_lifecycle_check AFTER INSERT OR UPDATE ON agent_identity_lifecycle
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION agent_identity_validate_graph();
CREATE CONSTRAINT TRIGGER agent_identity_successors_graph_check AFTER INSERT OR UPDATE ON agent_identity_successors
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION agent_identity_validate_graph();
