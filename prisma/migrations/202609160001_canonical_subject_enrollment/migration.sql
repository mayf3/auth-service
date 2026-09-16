-- AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1
-- Empty install only. This migration never enrolls, binds, retires or backfills.

CREATE TYPE "CanonicalSubjectType" AS ENUM ('agent','human','service');
CREATE TYPE "SubjectAttestationStatus" AS ENUM ('active','superseded','revoked');
CREATE TYPE "AttestationActorKind" AS ENUM ('user','machine_principal','external_authority');
CREATE TYPE "AttestationAuthorityKind" AS ENUM ('owner_exact','delegated','accepted_governing_authority');
CREATE TYPE "AttestationAuthorityOperation" AS ENUM ('activate','supersede','revoke');
CREATE TYPE "SourceBindingSemantics" AS ENUM ('prospective_binding');
CREATE TYPE "SourceBindingStatus" AS ENUM ('planned','active','superseded','exited');
CREATE TYPE "DelegatedActorType" AS ENUM ('user','machine_principal');
CREATE TYPE "IdentityAttestationDelegationStatus" AS ENUM ('active','revoked');

CREATE TABLE identity_attestation_delegations (
 delegation_id uuid PRIMARY KEY,
 delegated_actor_type "DelegatedActorType" NOT NULL,
 delegated_user_id uuid REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 delegated_machine_principal_id uuid REFERENCES machine_principals(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 authorized_subject_type "CanonicalSubjectType" NOT NULL,
 authorized_business_subject_ids uuid[] NOT NULL,
 authorized_operations text[] NOT NULL,
 owner_authority_ref text NOT NULL CHECK(length(btrim(owner_authority_ref))>0),
 owner_authority_digest text NOT NULL CHECK(owner_authority_digest ~ '^[0-9a-f]{64}$'),
 effective_at timestamp(3) with time zone NOT NULL,
 expires_at timestamp(3) with time zone NOT NULL,
 status "IdentityAttestationDelegationStatus" NOT NULL DEFAULT 'active',
 revision bigint NOT NULL CHECK(revision>0),
 revoked_at timestamp(3) with time zone,
 revocation_authority_ref text,
 created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ((delegated_actor_type='user' AND delegated_user_id IS NOT NULL AND delegated_machine_principal_id IS NULL)
     OR (delegated_actor_type='machine_principal' AND delegated_user_id IS NULL AND delegated_machine_principal_id IS NOT NULL)),
 CHECK (cardinality(authorized_business_subject_ids)>0 AND array_position(authorized_business_subject_ids,NULL) IS NULL),
 CHECK (cardinality(authorized_operations)>0 AND authorized_operations <@ ARRAY['activate','supersede','revoke']::text[]
        AND array_position(authorized_operations,NULL) IS NULL),
 CHECK (expires_at>effective_at),
 CHECK ((status='active' AND revoked_at IS NULL AND revocation_authority_ref IS NULL)
     OR (status='revoked' AND revoked_at IS NOT NULL AND length(btrim(revocation_authority_ref))>0))
);

CREATE TABLE canonical_subject_attestations (
 subject_attestation_id uuid PRIMARY KEY,
 business_subject_id uuid NOT NULL,
 subject_type "CanonicalSubjectType" NOT NULL,
 business_subject_description text NOT NULL CHECK(length(btrim(business_subject_description))>0),
 machine_principal_id uuid REFERENCES machine_principals(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 user_id uuid REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 canonical_agent_id text,
 authority_source text NOT NULL CHECK(length(btrim(authority_source))>0),
 attested_by_kind "AttestationActorKind" NOT NULL,
 attested_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 attested_by_machine_principal_id uuid REFERENCES machine_principals(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 attested_by_external_ref text,
 attestation_authority_kind "AttestationAuthorityKind" NOT NULL,
 attestation_authority_ref text NOT NULL CHECK(length(btrim(attestation_authority_ref))>0),
 attestation_authority_digest text NOT NULL CHECK(attestation_authority_digest ~ '^[0-9a-f]{64}$'),
 attestation_authority_operation "AttestationAuthorityOperation" NOT NULL CHECK(attestation_authority_operation<>'revoke'),
 delegation_id uuid REFERENCES identity_attestation_delegations(delegation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 effective_at timestamp(3) with time zone NOT NULL,
 evidence_ref text NOT NULL CHECK(length(btrim(evidence_ref))>0),
 supersedes_attestation_id uuid UNIQUE REFERENCES canonical_subject_attestations(subject_attestation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 revision bigint NOT NULL CHECK(revision>0),
 status "SubjectAttestationStatus" NOT NULL,
 created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ((subject_type='agent' AND machine_principal_id IS NOT NULL AND user_id IS NULL AND canonical_agent_id IS NOT NULL AND length(canonical_agent_id)>0)
     OR (subject_type='human' AND machine_principal_id IS NULL AND user_id IS NOT NULL AND canonical_agent_id IS NULL)
     OR (subject_type='service' AND machine_principal_id IS NOT NULL AND user_id IS NULL AND canonical_agent_id IS NULL)),
 CHECK ((attested_by_kind='user' AND attested_by_user_id IS NOT NULL AND attested_by_machine_principal_id IS NULL AND attested_by_external_ref IS NULL)
     OR (attested_by_kind='machine_principal' AND attested_by_user_id IS NULL AND attested_by_machine_principal_id IS NOT NULL AND attested_by_external_ref IS NULL)
     OR (attested_by_kind='external_authority' AND attested_by_user_id IS NULL AND attested_by_machine_principal_id IS NULL AND length(btrim(attested_by_external_ref))>0)),
 CHECK ((attestation_authority_kind='delegated' AND delegation_id IS NOT NULL)
     OR (attestation_authority_kind<>'delegated' AND delegation_id IS NULL)),
 CHECK ((supersedes_attestation_id IS NULL AND attestation_authority_operation='activate')
     OR (supersedes_attestation_id IS NOT NULL AND attestation_authority_operation='supersede')),
 CHECK (subject_attestation_id<>coalesce(supersedes_attestation_id,'00000000-0000-0000-0000-000000000000'::uuid))
);
CREATE UNIQUE INDEX canonical_subject_attestations_one_active
 ON canonical_subject_attestations(business_subject_id) WHERE status='active';

CREATE TABLE canonical_subject_source_bindings (
 source_binding_id uuid PRIMARY KEY,
 source_namespace text NOT NULL CHECK(length(btrim(source_namespace))>0),
 source_local_value text NOT NULL CHECK(length(btrim(source_local_value))>0),
 subject_attestation_id uuid NOT NULL REFERENCES canonical_subject_attestations(subject_attestation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 semantics "SourceBindingSemantics" NOT NULL DEFAULT 'prospective_binding',
 effective_at timestamp(3) with time zone NOT NULL,
 evidence_ref text NOT NULL CHECK(length(btrim(evidence_ref))>0),
 status "SourceBindingStatus" NOT NULL,
 revision bigint NOT NULL CHECK(revision>0),
 created_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
 superseded_at timestamp(3) with time zone,
 supersession_evidence_ref text,
 exited_at timestamp(3) with time zone,
 exit_evidence_ref text,
 supersedes_source_binding_id uuid UNIQUE REFERENCES canonical_subject_source_bindings(source_binding_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CHECK(source_binding_id<>coalesce(supersedes_source_binding_id,'00000000-0000-0000-0000-000000000000'::uuid)),
 CHECK ((status IN ('planned','active') AND superseded_at IS NULL AND supersession_evidence_ref IS NULL AND exited_at IS NULL AND exit_evidence_ref IS NULL)
     OR (status='superseded' AND superseded_at IS NOT NULL AND length(btrim(supersession_evidence_ref))>0 AND exited_at IS NULL AND exit_evidence_ref IS NULL)
     OR (status='exited' AND exited_at IS NOT NULL AND length(btrim(exit_evidence_ref))>0))
);
CREATE UNIQUE INDEX canonical_subject_source_bindings_one_current
 ON canonical_subject_source_bindings(source_namespace,source_local_value) WHERE status IN ('planned','active');

CREATE FUNCTION canonical_subject_mutation_counts_valid(counts jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_typeof(counts)='object'
    AND counts<>'{}'::jsonb
    AND (counts-ARRAY['ACTIVATE_ATTESTATION','SUPERSEDE_ATTESTATION','REVOKE_ATTESTATION','INSTALL_ATTESTATION_DELEGATION','REVOKE_ATTESTATION_DELEGATION','TRANSITION_AGENT_LIFECYCLE','INSTALL_EXPLICIT_SUCCESSOR','ACTIVATE_SOURCE_BINDING','SUPERSEDE_SOURCE_BINDING','EXIT_SOURCE_BINDING'])='{}'::jsonb
    AND NOT EXISTS(SELECT 1 FROM jsonb_each(counts) entry WHERE jsonb_typeof(entry.value)<>'number' OR entry.value::text!~'^[1-9][0-9]*$')
$$;

CREATE TABLE canonical_subject_operations (
 operation_id uuid PRIMARY KEY,
 environment text NOT NULL CHECK(length(btrim(environment))>0),
 actor_ref text NOT NULL CHECK(length(btrim(actor_ref))>0),
 packet_digest text NOT NULL CHECK(packet_digest ~ '^[0-9a-f]{64}$'),
 authority_digest text NOT NULL CHECK(authority_digest ~ '^[0-9a-f]{64}$'),
 prestate_digest text NOT NULL CHECK(prestate_digest ~ '^[0-9a-f]{64}$'),
 plan_digest text NOT NULL UNIQUE CHECK(plan_digest ~ '^[0-9a-f]{64}$'),
 core_evidence_digest text CHECK(core_evidence_digest IS NULL OR core_evidence_digest ~ '^[0-9a-f]{64}$'),
 attestation_authority_manifest_digest text NOT NULL CHECK(attestation_authority_manifest_digest ~ '^[0-9a-f]{64}$'),
 poststate_digest text NOT NULL CHECK(poststate_digest ~ '^[0-9a-f]{64}$'),
 mutation_counts jsonb NOT NULL CHECK(canonical_subject_mutation_counts_valid(mutation_counts)),
 committed_at timestamp(3) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE canonical_subject_operation_authorities (
 operation_id uuid NOT NULL REFERENCES canonical_subject_operations(operation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 mutation_key text NOT NULL CHECK(length(btrim(mutation_key))>0),
 business_subject_id uuid NOT NULL,
 subject_attestation_id uuid NOT NULL,
 predecessor_id uuid,
 subject_type "CanonicalSubjectType" NOT NULL,
 target jsonb NOT NULL CHECK(jsonb_typeof(target)='object'),
 authority_kind "AttestationAuthorityKind" NOT NULL,
 authority_ref text NOT NULL CHECK(length(btrim(authority_ref))>0),
 authority_digest text NOT NULL CHECK(authority_digest ~ '^[0-9a-f]{64}$'),
 requested_operation "AttestationAuthorityOperation" NOT NULL,
 intended_disposition "SubjectAttestationStatus" NOT NULL,
 delegation_id uuid REFERENCES identity_attestation_delegations(delegation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 delegation_revision bigint CHECK(delegation_revision IS NULL OR delegation_revision>0),
 PRIMARY KEY(operation_id,mutation_key),
 CHECK ((authority_kind='delegated' AND delegation_id IS NOT NULL AND delegation_revision IS NOT NULL)
     OR (authority_kind<>'delegated' AND delegation_id IS NULL AND delegation_revision IS NULL)),
 CHECK ((subject_type='agent' AND target?&ARRAY['machinePrincipalId','canonicalAgentId'] AND target-ARRAY['machinePrincipalId','canonicalAgentId']='{}'::jsonb)
     OR (subject_type='human' AND target?&ARRAY['userId'] AND target-ARRAY['userId']='{}'::jsonb)
     OR (subject_type='service' AND target?&ARRAY['machinePrincipalId'] AND target-ARRAY['machinePrincipalId']='{}'::jsonb)),
 CHECK ((requested_operation='activate' AND intended_disposition='active' AND predecessor_id IS NULL)
     OR (requested_operation='supersede' AND intended_disposition='active' AND predecessor_id IS NOT NULL)
     OR (requested_operation='revoke' AND intended_disposition='revoked' AND predecessor_id IS NULL))
);

-- Every child-table write shares the foundation advisory-lock domain and requires
-- SERIALIZABLE. Evidence tables are append-preserving; controlled state transitions
-- receive additional table-specific validation below.
CREATE FUNCTION canonical_subject_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN
  RAISE EXCEPTION 'canonical subject mutation requires serializable' USING ERRCODE='23514';
 END IF;
 PERFORM pg_advisory_xact_lock(173496021,1);
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'canonical subject evidence is append preserving' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('canonical_subject_operations','canonical_subject_operation_authorities') THEN
  RAISE EXCEPTION 'canonical subject audit is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION canonical_subject_attestation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p machine_principals; u users; prior canonical_subject_attestations; d identity_attestation_delegations;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.subject_attestation_id IS DISTINCT FROM OLD.subject_attestation_id OR NEW.business_subject_id IS DISTINCT FROM OLD.business_subject_id
   OR NEW.subject_type IS DISTINCT FROM OLD.subject_type OR NEW.business_subject_description IS DISTINCT FROM OLD.business_subject_description
   OR NEW.machine_principal_id IS DISTINCT FROM OLD.machine_principal_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
   OR NEW.canonical_agent_id IS DISTINCT FROM OLD.canonical_agent_id OR NEW.authority_source IS DISTINCT FROM OLD.authority_source
   OR NEW.attested_by_kind IS DISTINCT FROM OLD.attested_by_kind OR NEW.attested_by_user_id IS DISTINCT FROM OLD.attested_by_user_id
   OR NEW.attested_by_machine_principal_id IS DISTINCT FROM OLD.attested_by_machine_principal_id OR NEW.attested_by_external_ref IS DISTINCT FROM OLD.attested_by_external_ref
   OR NEW.attestation_authority_kind IS DISTINCT FROM OLD.attestation_authority_kind OR NEW.attestation_authority_ref IS DISTINCT FROM OLD.attestation_authority_ref
   OR NEW.attestation_authority_digest IS DISTINCT FROM OLD.attestation_authority_digest OR NEW.attestation_authority_operation IS DISTINCT FROM OLD.attestation_authority_operation
   OR NEW.delegation_id IS DISTINCT FROM OLD.delegation_id OR NEW.effective_at IS DISTINCT FROM OLD.effective_at OR NEW.evidence_ref IS DISTINCT FROM OLD.evidence_ref
   OR NEW.supersedes_attestation_id IS DISTINCT FROM OLD.supersedes_attestation_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.revision<>OLD.revision+1 OR OLD.status<>'active' OR NEW.status NOT IN ('superseded','revoked') THEN
   RAISE EXCEPTION 'invalid attestation amendment' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.revision<>1 OR NEW.status<>'active' THEN RAISE EXCEPTION 'attestation insert must be active revision 1' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.subject_type='human' THEN
  SELECT * INTO u FROM users WHERE id=NEW.user_id;
  IF NOT FOUND OR u.status::text<>'active' THEN RAISE EXCEPTION 'invalid human target' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO p FROM machine_principals WHERE id=NEW.machine_principal_id;
  IF NOT FOUND OR p.status::text<>'active' OR p.principal_type::text<>NEW.subject_type::text THEN RAISE EXCEPTION 'invalid machine target' USING ERRCODE='23514'; END IF;
  IF NEW.subject_type='agent' AND (p.agent_id IS DISTINCT FROM NEW.canonical_agent_id OR NOT EXISTS(SELECT 1 FROM agent_identity_lifecycle l WHERE l.principal_id=p.id AND l.state='canonical') OR EXISTS(SELECT 1 FROM agent_identity_successors e WHERE e.source_principal_id=p.id)) THEN
   RAISE EXCEPTION 'invalid canonical agent target' USING ERRCODE='23514';
  END IF;
  IF NEW.subject_type='service' AND (p.agent_id IS NOT NULL OR EXISTS(SELECT 1 FROM agent_identity_lifecycle l WHERE l.principal_id=p.id)) THEN
   RAISE EXCEPTION 'invalid service target' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.supersedes_attestation_id IS NOT NULL THEN
  SELECT * INTO prior FROM canonical_subject_attestations WHERE subject_attestation_id=NEW.supersedes_attestation_id;
  IF NOT FOUND OR prior.business_subject_id<>NEW.business_subject_id OR prior.status<>'superseded' THEN RAISE EXCEPTION 'invalid attestation predecessor' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.attestation_authority_kind='delegated' THEN
  SELECT * INTO d FROM identity_attestation_delegations WHERE delegation_id=NEW.delegation_id;
  IF NOT FOUND OR d.status<>'active' OR CURRENT_TIMESTAMP<d.effective_at OR CURRENT_TIMESTAMP>=d.expires_at
   OR d.authorized_subject_type<>NEW.subject_type OR NOT (NEW.business_subject_id=ANY(d.authorized_business_subject_ids))
   OR NOT (NEW.attestation_authority_operation::text=ANY(d.authorized_operations))
   OR (d.delegated_actor_type='user' AND (NEW.attested_by_kind<>'user' OR NEW.attested_by_user_id IS DISTINCT FROM d.delegated_user_id))
   OR (d.delegated_actor_type='machine_principal' AND (NEW.attested_by_kind<>'machine_principal' OR NEW.attested_by_machine_principal_id IS DISTINCT FROM d.delegated_machine_principal_id)) THEN
   RAISE EXCEPTION 'invalid delegated authority' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION canonical_subject_delegation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NEW.status<>'active' THEN RAISE EXCEPTION 'delegation insert must be active revision 1' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.authorized_business_subject_ids)<>(SELECT count(DISTINCT value) FROM unnest(NEW.authorized_business_subject_ids) value)
   OR cardinality(NEW.authorized_operations)<>(SELECT count(DISTINCT value) FROM unnest(NEW.authorized_operations) value) THEN
   RAISE EXCEPTION 'delegation scope must be an exact set' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.delegation_id IS DISTINCT FROM OLD.delegation_id OR NEW.delegated_actor_type IS DISTINCT FROM OLD.delegated_actor_type
   OR NEW.delegated_user_id IS DISTINCT FROM OLD.delegated_user_id OR NEW.delegated_machine_principal_id IS DISTINCT FROM OLD.delegated_machine_principal_id
   OR NEW.authorized_subject_type IS DISTINCT FROM OLD.authorized_subject_type OR NEW.authorized_business_subject_ids IS DISTINCT FROM OLD.authorized_business_subject_ids
   OR NEW.authorized_operations IS DISTINCT FROM OLD.authorized_operations OR NEW.owner_authority_ref IS DISTINCT FROM OLD.owner_authority_ref
   OR NEW.owner_authority_digest IS DISTINCT FROM OLD.owner_authority_digest OR NEW.effective_at IS DISTINCT FROM OLD.effective_at
   OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR OLD.status<>'active' OR NEW.status<>'revoked' OR NEW.revision<>OLD.revision+1 THEN
   RAISE EXCEPTION 'invalid delegation amendment' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION canonical_subject_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a canonical_subject_attestations; prior canonical_subject_source_bindings;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO a FROM canonical_subject_attestations WHERE subject_attestation_id=NEW.subject_attestation_id;
  IF NOT FOUND OR a.status<>'active' THEN RAISE EXCEPTION 'source binding requires active attestation' USING ERRCODE='23514'; END IF;
  IF NEW.revision<>1 OR NEW.status NOT IN ('planned','active') THEN RAISE EXCEPTION 'invalid source binding insert' USING ERRCODE='23514'; END IF;
  IF NEW.supersedes_source_binding_id IS NOT NULL THEN
   SELECT * INTO prior FROM canonical_subject_source_bindings WHERE source_binding_id=NEW.supersedes_source_binding_id;
   IF NOT FOUND OR prior.status<>'superseded' OR prior.source_namespace<>NEW.source_namespace OR prior.source_local_value<>NEW.source_local_value THEN RAISE EXCEPTION 'invalid binding predecessor' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  IF NEW.source_binding_id IS DISTINCT FROM OLD.source_binding_id OR NEW.source_namespace IS DISTINCT FROM OLD.source_namespace
   OR NEW.source_local_value IS DISTINCT FROM OLD.source_local_value OR NEW.subject_attestation_id IS DISTINCT FROM OLD.subject_attestation_id
   OR NEW.semantics IS DISTINCT FROM OLD.semantics OR NEW.effective_at IS DISTINCT FROM OLD.effective_at OR NEW.evidence_ref IS DISTINCT FROM OLD.evidence_ref
   OR NEW.supersedes_source_binding_id IS DISTINCT FROM OLD.supersedes_source_binding_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'invalid binding amendment' USING ERRCODE='23514'; END IF;
  IF OLD.status='planned' AND NEW.status='active' THEN NULL;
  ELSIF OLD.status IN ('planned','active') AND NEW.status='superseded' THEN NULL;
  ELSIF OLD.status IN ('planned','active','superseded') AND NEW.status='exited' THEN NULL;
  ELSE RAISE EXCEPTION 'invalid binding lifecycle transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION canonical_subject_deferred_invariants() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected integer; actual integer; opid uuid; sid uuid;
BEGIN
 IF TG_TABLE_NAME IN ('canonical_subject_operations','canonical_subject_operation_authorities') THEN
  opid := NEW.operation_id;
 END IF;
 IF opid IS NOT NULL AND EXISTS(SELECT 1 FROM canonical_subject_operations WHERE operation_id=opid) THEN
  SELECT coalesce((mutation_counts->>'ACTIVATE_ATTESTATION')::int,0)+coalesce((mutation_counts->>'SUPERSEDE_ATTESTATION')::int,0)+coalesce((mutation_counts->>'REVOKE_ATTESTATION')::int,0) INTO expected FROM canonical_subject_operations WHERE operation_id=opid;
  SELECT count(*) INTO actual FROM canonical_subject_operation_authorities WHERE operation_id=opid;
  IF expected<>actual THEN RAISE EXCEPTION 'attestation authority manifest mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_TABLE_NAME='canonical_subject_attestations' THEN
  IF NEW.status='superseded' AND (SELECT count(*) FROM canonical_subject_attestations WHERE supersedes_attestation_id=NEW.subject_attestation_id)<>1 THEN
   RAISE EXCEPTION 'superseded attestation requires one replacement' USING ERRCODE='23514';
  END IF;
  IF NEW.status IN ('superseded','revoked') AND EXISTS(SELECT 1 FROM canonical_subject_source_bindings WHERE subject_attestation_id=NEW.subject_attestation_id AND status IN ('planned','active')) THEN
   RAISE EXCEPTION 'attestation with current source bindings cannot leave active' USING ERRCODE='23514';
  END IF;
 ELSIF TG_TABLE_NAME='canonical_subject_source_bindings' THEN
  sid := NEW.source_binding_id;
  IF NEW.status='superseded' AND (SELECT count(*) FROM canonical_subject_source_bindings WHERE supersedes_source_binding_id=sid)<>1 THEN
   RAISE EXCEPTION 'superseded binding requires one replacement' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER identity_attestation_delegations_write BEFORE INSERT OR UPDATE OR DELETE ON identity_attestation_delegations FOR EACH ROW EXECUTE FUNCTION canonical_subject_write_guard();
CREATE TRIGGER identity_attestation_delegations_validate BEFORE INSERT OR UPDATE ON identity_attestation_delegations FOR EACH ROW EXECUTE FUNCTION canonical_subject_delegation_guard();
CREATE TRIGGER canonical_subject_attestations_write BEFORE INSERT OR UPDATE OR DELETE ON canonical_subject_attestations FOR EACH ROW EXECUTE FUNCTION canonical_subject_write_guard();
CREATE TRIGGER canonical_subject_attestations_validate BEFORE INSERT OR UPDATE ON canonical_subject_attestations FOR EACH ROW EXECUTE FUNCTION canonical_subject_attestation_guard();
CREATE TRIGGER canonical_subject_source_bindings_write BEFORE INSERT OR UPDATE OR DELETE ON canonical_subject_source_bindings FOR EACH ROW EXECUTE FUNCTION canonical_subject_write_guard();
CREATE TRIGGER canonical_subject_source_bindings_validate BEFORE INSERT OR UPDATE ON canonical_subject_source_bindings FOR EACH ROW EXECUTE FUNCTION canonical_subject_binding_guard();
CREATE TRIGGER canonical_subject_operations_write BEFORE INSERT OR UPDATE OR DELETE ON canonical_subject_operations FOR EACH ROW EXECUTE FUNCTION canonical_subject_write_guard();
CREATE TRIGGER canonical_subject_operation_authorities_write BEFORE INSERT OR UPDATE OR DELETE ON canonical_subject_operation_authorities FOR EACH ROW EXECUTE FUNCTION canonical_subject_write_guard();
CREATE CONSTRAINT TRIGGER canonical_subject_operations_manifest AFTER INSERT OR UPDATE ON canonical_subject_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION canonical_subject_deferred_invariants();
CREATE CONSTRAINT TRIGGER canonical_subject_operation_authorities_manifest AFTER INSERT OR UPDATE ON canonical_subject_operation_authorities DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION canonical_subject_deferred_invariants();
CREATE CONSTRAINT TRIGGER canonical_subject_attestations_dependencies AFTER INSERT OR UPDATE ON canonical_subject_attestations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION canonical_subject_deferred_invariants();
CREATE CONSTRAINT TRIGGER canonical_subject_source_bindings_replacement AFTER INSERT OR UPDATE ON canonical_subject_source_bindings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION canonical_subject_deferred_invariants();
