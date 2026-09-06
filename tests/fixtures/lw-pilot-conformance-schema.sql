-- Conformance schema: exact production DDL of the seven tables this pilot
-- touches (schema-only dump of agent_dev_center, 2026-09-06; includes the
-- drifted machine_access_grants.revoked_at column to mirror production).
-- Enums recreated with EXACT production label sets; production anti-mutation
-- trigger on auth_security_audits intentionally omitted in isolation.

CREATE TYPE public."AudienceStatus" AS ENUM ('candidate', 'active', 'disabled', 'retired');
CREATE TYPE public."ClientStatus" AS ENUM ('active', 'revoked');
CREATE TYPE public."GrantChangeType" AS ENUM ('create', 'replace', 'revoke');
CREATE TYPE public."InternalRole" AS ENUM ('cto', 'pm', 'backend_developer', 'frontend_developer', 'mobile_developer', 'miniapp_developer', 'game_developer', 'tester', 'security', 'ops', 'qa', 'architect');
CREATE TYPE public."OkrRole" AS ENUM ('okr_admin', 'okr_reviewer', 'okr_member', 'okr_owner', 'okr_viewer');
CREATE TYPE public."PrincipalStatus" AS ENUM ('active', 'disabled');
CREATE TYPE public."PrincipalType" AS ENUM ('agent', 'service');
CREATE TYPE public."UserRole" AS ENUM ('admin', 'requester', 'developer', 'agent', 'cto_agent');

CREATE TABLE public.auth_audiences (
    audience_id text NOT NULL,
    resource_service text NOT NULL,
    scope_namespace text NOT NULL,
    accepted_principal_types text[] NOT NULL,
    registered_scopes text[] NOT NULL,
    human_access_enabled boolean NOT NULL,
    machine_access_enabled boolean NOT NULL,
    delegated_access_enabled boolean NOT NULL,
    status public."AudienceStatus" DEFAULT 'candidate'::public."AudienceStatus" NOT NULL,
    freeze_ready boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT auth_audiences_principal_types_check CHECK ((cardinality(accepted_principal_types) > 0)),
    CONSTRAINT auth_audiences_scope_profile_check CHECK ((((NOT machine_access_enabled) AND (NOT delegated_access_enabled)) OR (cardinality(registered_scopes) > 0)))
);


--
-- Name: auth_security_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_security_audits (
    id uuid NOT NULL,
    event_type text NOT NULL,
    result text NOT NULL,
    user_id uuid,
    human_client_id uuid,
    human_session_id uuid,
    refresh_family_id uuid,
    credential_id uuid,
    request_correlation_id text,
    details jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT auth_security_audits_text_check CHECK ((((length(event_type) >= 1) AND (length(event_type) <= 128)) AND (result = ANY (ARRAY['success'::text, 'rejected'::text])) AND ((request_correlation_id IS NULL) OR ((length(request_correlation_id) >= 1) AND (length(request_correlation_id) <= 256)))))
);


--
-- Name: grant_change_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grant_change_audits (
    change_id uuid NOT NULL,
    migration_id text NOT NULL,
    source_git_commit text NOT NULL,
    operator_id text NOT NULL,
    approval_ref text NOT NULL,
    reason text NOT NULL,
    client_id text NOT NULL,
    change_type public."GrantChangeType" NOT NULL,
    expected_grant_version integer,
    resulting_grant_version integer NOT NULL,
    before_value jsonb,
    after_value jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT grant_change_audits_reason_check CHECK (((length(reason) >= 1) AND (length(reason) <= 512))),
    CONSTRAINT grant_change_audits_required_text_check CHECK (((length(migration_id) > 0) AND (length(operator_id) > 0) AND (length(approval_ref) > 0) AND (length(client_id) > 0))),
    CONSTRAINT grant_change_audits_source_commit_check CHECK ((source_git_commit ~ '^[0-9a-f]{40}$'::text)),
    CONSTRAINT grant_change_audits_value_shape_check CHECK ((((change_type = ANY (ARRAY['create'::public."GrantChangeType", 'replace'::public."GrantChangeType"])) AND (after_value IS NOT NULL)) OR ((change_type = 'revoke'::public."GrantChangeType") AND (after_value IS NULL)))),
    CONSTRAINT grant_change_audits_version_check CHECK (((resulting_grant_version >= 1) AND ((expected_grant_version IS NULL) OR (expected_grant_version >= 1))))
);


--
-- Name: machine_access_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_access_grants (
    machine_client_id uuid NOT NULL,
    audience_id text NOT NULL,
    scopes text[] NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    revoked_at timestamp(3) without time zone,
    CONSTRAINT machine_access_grants_scopes_check CHECK ((cardinality(scopes) > 0))
);


--
-- Name: machine_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_clients (
    id uuid NOT NULL,
    client_id text NOT NULL,
    machine_principal_id uuid NOT NULL,
    secret_hash text NOT NULL,
    status public."ClientStatus" DEFAULT 'active'::public."ClientStatus" NOT NULL,
    allowed_resources text[],
    allowed_scopes text[],
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    rotated_at timestamp(3) without time zone,
    revoked_at timestamp(3) without time zone,
    external_ref text
);


--
-- Name: machine_principals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_principals (
    id uuid NOT NULL,
    principal_type public."PrincipalType" DEFAULT 'agent'::public."PrincipalType" NOT NULL,
    agent_id text,
    owner_user_id uuid,
    display_name text,
    status public."PrincipalStatus" DEFAULT 'active'::public."PrincipalStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    disabled_at timestamp(3) without time zone,
    external_ref text,
    request_digest text,
    CONSTRAINT ck_principal_external_ref_digest CHECK (((external_ref IS NULL) OR (request_digest IS NOT NULL))),
    CONSTRAINT machine_principal_type_shape_check CHECK (((((principal_type)::text = 'agent'::text) AND (agent_id IS NOT NULL)) OR (((principal_type)::text = 'service'::text) AND (agent_id IS NULL))))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."UserRole" DEFAULT 'requester'::public."UserRole" NOT NULL,
    internal_role public."InternalRole",
    roles text[] DEFAULT ARRAY[]::text[],
    okr_role public."OkrRole" DEFAULT 'okr_member'::public."OkrRole" NOT NULL,
    "agentId" text,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    bio text,
    phone text,
    avatar text,
    department text,
    title text,
    "employeeNo" text,
    "onboardingDate" timestamp(3) without time zone,
    "managerId" uuid,
    must_change_password boolean DEFAULT true NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    password_changed_at timestamp(3) without time zone,
    last_login_at timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."PrincipalStatus" DEFAULT 'active'::public."PrincipalStatus" NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    disabled_at timestamp(3) without time zone
);


--
-- Name: auth_audiences auth_audiences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audiences
    ADD CONSTRAINT auth_audiences_pkey PRIMARY KEY (audience_id);


--
-- Name: auth_security_audits auth_security_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_security_audits
    ADD CONSTRAINT auth_security_audits_pkey PRIMARY KEY (id);


--
-- Name: grant_change_audits grant_change_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grant_change_audits
    ADD CONSTRAINT grant_change_audits_pkey PRIMARY KEY (change_id);


--
-- Name: machine_access_grants machine_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_access_grants
    ADD CONSTRAINT machine_access_grants_pkey PRIMARY KEY (machine_client_id, audience_id);


--
-- Name: machine_clients machine_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_clients
    ADD CONSTRAINT machine_clients_pkey PRIMARY KEY (id);


--
-- Name: machine_principals machine_principals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_principals
    ADD CONSTRAINT machine_principals_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: auth_security_audits_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_security_audits_timestamp_idx ON public.auth_security_audits USING btree ("timestamp");


--
-- Name: grant_change_audits_migration_id_client_id_change_type_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX grant_change_audits_migration_id_client_id_change_type_key ON public.grant_change_audits USING btree (migration_id, client_id, change_type);


--
-- Name: grant_change_audits_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grant_change_audits_timestamp_idx ON public.grant_change_audits USING btree ("timestamp");


--
-- Name: machine_clients_client_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX machine_clients_client_id_key ON public.machine_clients USING btree (client_id);


--
-- Name: machine_clients_external_ref_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX machine_clients_external_ref_key ON public.machine_clients USING btree (external_ref);


--
-- Name: machine_principals_agent_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX machine_principals_agent_id_key ON public.machine_principals USING btree (agent_id);


--
-- Name: machine_principals_external_ref_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX machine_principals_external_ref_key ON public.machine_principals USING btree (external_ref);


--
-- Name: users_agentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_agentId_key" ON public.users USING btree ("agentId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_employeeNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_employeeNo_key" ON public.users USING btree ("employeeNo");


--
-- Name: users_last_login_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_last_login_at_idx ON public.users USING btree (last_login_at);


--
-- Name: auth_security_audits auth_security_audits_immutable; Type: TRIGGER; Schema: public; Owner: -
--



--
-- Name: grant_change_audits grant_change_audits_immutable; Type: TRIGGER; Schema: public; Owner: -
--



--
-- Name: machine_access_grants machine_access_grants_audience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_access_grants
    ADD CONSTRAINT machine_access_grants_audience_id_fkey FOREIGN KEY (audience_id) REFERENCES public.auth_audiences(audience_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: machine_access_grants machine_access_grants_machine_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_access_grants
    ADD CONSTRAINT machine_access_grants_machine_client_id_fkey FOREIGN KEY (machine_client_id) REFERENCES public.machine_clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: machine_clients machine_clients_machine_principal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_clients
    ADD CONSTRAINT machine_clients_machine_principal_id_fkey FOREIGN KEY (machine_principal_id) REFERENCES public.machine_principals(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: machine_principals machine_principals_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_principals
    ADD CONSTRAINT machine_principals_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


