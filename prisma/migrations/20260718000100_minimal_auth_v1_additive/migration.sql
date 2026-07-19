-- Minimal Auth Foundation V1 additive schema.
-- This migration creates V1 authority tables without deleting Legacy columns,
-- routes, grants, tokens, or credentials.

ALTER TYPE "PrincipalType" ADD VALUE IF NOT EXISTS 'service';

ALTER TABLE "users"
  ADD COLUMN "status" "PrincipalStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "disabled_at" TIMESTAMP(3);

ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "machine_principals"
  ALTER COLUMN "agent_id" DROP NOT NULL,
  ALTER COLUMN "owner_user_id" DROP NOT NULL,
  ADD CONSTRAINT "machine_principal_type_shape_check" CHECK (
    ("principal_type"::text = 'agent' AND "agent_id" IS NOT NULL AND "owner_user_id" IS NOT NULL)
    OR ("principal_type"::text = 'service' AND "agent_id" IS NULL)
  );

CREATE TYPE "AudienceStatus" AS ENUM ('candidate', 'active', 'disabled', 'retired');
CREATE TYPE "HumanClientType" AS ENUM ('confidential_web', 'public_browser', 'native');
CREATE TYPE "HumanClientAuthenticationMethod" AS ENUM ('none', 'client_secret_basic');
CREATE TYPE "HumanClientStatus" AS ENUM ('active', 'revoked');
CREATE TYPE "AuthorizationTransactionStatus" AS ENUM ('pending', 'authenticated', 'consumed', 'expired');
CREATE TYPE "AuthorizationCodeStatus" AS ENUM ('active', 'consumed', 'expired');
CREATE TYPE "HumanSessionStatus" AS ENUM ('active', 'revoked', 'expired');
CREATE TYPE "RefreshFamilyStatus" AS ENUM ('active', 'revoked', 'expired');
CREATE TYPE "RefreshCredentialStatus" AS ENUM ('active', 'rotated', 'revoked', 'expired');
CREATE TYPE "ExchangeAuditResult" AS ENUM ('success', 'rejected');
CREATE TYPE "GrantChangeType" AS ENUM ('create', 'replace', 'revoke');

CREATE TABLE "auth_audiences" (
  "audience_id" TEXT NOT NULL,
  "resource_service" TEXT NOT NULL,
  "scope_namespace" TEXT NOT NULL,
  "accepted_principal_types" TEXT[] NOT NULL,
  "registered_scopes" TEXT[] NOT NULL,
  "human_access_enabled" BOOLEAN NOT NULL,
  "machine_access_enabled" BOOLEAN NOT NULL,
  "delegated_access_enabled" BOOLEAN NOT NULL,
  "status" "AudienceStatus" NOT NULL DEFAULT 'candidate',
  "freeze_ready" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_audiences_pkey" PRIMARY KEY ("audience_id"),
  CONSTRAINT "auth_audiences_principal_types_check" CHECK (cardinality("accepted_principal_types") > 0),
  CONSTRAINT "auth_audiences_scope_profile_check" CHECK (
    (NOT "machine_access_enabled" AND NOT "delegated_access_enabled")
    OR cardinality("registered_scopes") > 0
  )
);

CREATE TABLE "human_clients" (
  "id" UUID NOT NULL,
  "client_id" TEXT NOT NULL,
  "client_type" "HumanClientType" NOT NULL,
  "client_authentication_method" "HumanClientAuthenticationMethod" NOT NULL,
  "credential_verifier" TEXT,
  "status" "HumanClientStatus" NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "human_clients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "human_clients_auth_method_check" CHECK (
    ("client_type" = 'confidential_web' AND "client_authentication_method" = 'client_secret_basic' AND "credential_verifier" IS NOT NULL)
    OR ("client_type" IN ('public_browser', 'native') AND "client_authentication_method" = 'none' AND "credential_verifier" IS NULL)
  )
);

CREATE UNIQUE INDEX "human_clients_client_id_key" ON "human_clients"("client_id");

CREATE TABLE "human_client_redirect_uris" (
  "human_client_id" UUID NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "human_client_redirect_uris_pkey" PRIMARY KEY ("human_client_id", "redirect_uri")
);

CREATE TABLE "human_audience_grants" (
  "human_client_id" UUID NOT NULL,
  "audience_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "human_audience_grants_pkey" PRIMARY KEY ("human_client_id", "audience_id")
);

CREATE TABLE "machine_access_grants" (
  "machine_client_id" UUID NOT NULL,
  "audience_id" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "machine_access_grants_pkey" PRIMARY KEY ("machine_client_id", "audience_id"),
  CONSTRAINT "machine_access_grants_scopes_check" CHECK (cardinality("scopes") > 0)
);

CREATE TABLE "trusted_proxies" (
  "id" UUID NOT NULL,
  "proxy_principal_id" UUID NOT NULL,
  "proxy_client_id" UUID NOT NULL,
  "status" "ClientStatus" NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "trusted_proxies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trusted_proxies_proxy_principal_id_key" ON "trusted_proxies"("proxy_principal_id");
CREATE UNIQUE INDEX "trusted_proxies_proxy_client_id_key" ON "trusted_proxies"("proxy_client_id");

CREATE TABLE "proxy_accepted_subject_audiences" (
  "trusted_proxy_id" UUID NOT NULL,
  "audience_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proxy_accepted_subject_audiences_pkey" PRIMARY KEY ("trusted_proxy_id", "audience_id")
);

CREATE TABLE "delegation_grants" (
  "trusted_proxy_id" UUID NOT NULL,
  "audience_id" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delegation_grants_pkey" PRIMARY KEY ("trusted_proxy_id", "audience_id"),
  CONSTRAINT "delegation_grants_scopes_check" CHECK (cardinality("scopes") > 0)
);

CREATE TABLE "authorization_transactions" (
  "id" UUID NOT NULL,
  "human_client_id" UUID NOT NULL,
  "audience_id" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "code_challenge" TEXT NOT NULL,
  "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
  "authenticated_user_id" UUID,
  "status" "AuthorizationTransactionStatus" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "authorization_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authorization_transactions_pkce_check" CHECK (
    "code_challenge_method" = 'S256'
    AND "code_challenge" ~ '^[A-Za-z0-9_-]{43}$'
  ),
  CONSTRAINT "authorization_transactions_timing_check" CHECK (
    "expires_at" > "created_at"
    AND "expires_at" <= "created_at" + INTERVAL '5 minutes'
  ),
  CONSTRAINT "authorization_transactions_shape_check" CHECK (
    length("state") BETWEEN 1 AND 512 AND length("redirect_uri") > 0 AND "version" >= 1
    AND (
      ("status" = 'pending' AND "authenticated_user_id" IS NULL AND "consumed_at" IS NULL)
      OR ("status" = 'authenticated' AND "authenticated_user_id" IS NOT NULL AND "consumed_at" IS NULL)
      OR ("status" = 'consumed' AND "authenticated_user_id" IS NOT NULL AND "consumed_at" IS NOT NULL)
      OR ("status" = 'expired' AND "consumed_at" IS NULL)
    )
  )
);

CREATE INDEX "authorization_transactions_human_client_id_status_expires_a_idx"
  ON "authorization_transactions"("human_client_id", "status", "expires_at");

CREATE TABLE "authorization_codes" (
  "id" UUID NOT NULL,
  "credential_verifier" TEXT NOT NULL,
  "verifier_parameters_version" TEXT NOT NULL,
  "authorization_transaction_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "human_client_id" UUID NOT NULL,
  "audience_id" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "status" "AuthorizationCodeStatus" NOT NULL DEFAULT 'active',
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "authorization_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authorization_codes_verifier_check" CHECK (
    "verifier_parameters_version" = 'scrypt-v1'
    AND "credential_verifier" ~ '^[0-9a-f]{32}:[0-9a-f]{64}$'
  ),
  CONSTRAINT "authorization_codes_timing_check" CHECK (
    "expires_at" > "issued_at"
    AND "expires_at" <= "issued_at" + INTERVAL '60 seconds'
  ),
  CONSTRAINT "authorization_codes_shape_check" CHECK (
    length("redirect_uri") > 0 AND "version" >= 1
    AND (
      ("status" = 'active' AND "consumed_at" IS NULL)
      OR ("status" = 'consumed' AND "consumed_at" IS NOT NULL)
      OR ("status" = 'expired' AND "consumed_at" IS NULL)
    )
  )
);

CREATE UNIQUE INDEX "authorization_codes_authorization_transaction_id_key" ON "authorization_codes"("authorization_transaction_id");
CREATE INDEX "authorization_codes_status_expires_at_idx" ON "authorization_codes"("status", "expires_at");

CREATE TABLE "human_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "human_client_id" UUID NOT NULL,
  "token_family_id" UUID,
  "status" "HumanSessionStatus" NOT NULL DEFAULT 'active',
  "authenticated_at" TIMESTAMP(3) NOT NULL,
  "last_refreshed_at" TIMESTAMP(3) NOT NULL,
  "absolute_expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revocation_reason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "human_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "human_sessions_timing_check" CHECK (
    "last_refreshed_at" >= "authenticated_at"
    AND "last_refreshed_at" < "absolute_expires_at"
    AND "absolute_expires_at" > "authenticated_at"
    AND "absolute_expires_at" <= "authenticated_at" + INTERVAL '30 days'
  ),
  CONSTRAINT "human_sessions_shape_check" CHECK (
    "version" >= 1 AND ("revocation_reason" IS NULL OR length("revocation_reason") BETWEEN 1 AND 128)
    AND (
      ("status" = 'active' AND "revoked_at" IS NULL AND "revocation_reason" IS NULL)
      OR ("status" IN ('revoked', 'expired') AND "revoked_at" IS NOT NULL AND "revocation_reason" IS NOT NULL)
    )
  )
);

CREATE UNIQUE INDEX "human_sessions_token_family_id_key" ON "human_sessions"("token_family_id");
CREATE INDEX "human_sessions_user_id_human_client_id_status_idx" ON "human_sessions"("user_id", "human_client_id", "status");

CREATE TABLE "refresh_families" (
  "id" UUID NOT NULL,
  "human_session_id" UUID NOT NULL,
  "status" "RefreshFamilyStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "absolute_expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revoke_reason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "refresh_families_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_families_timing_check" CHECK (
    "absolute_expires_at" > "created_at"
    AND "absolute_expires_at" <= "created_at" + INTERVAL '30 days'
  ),
  CONSTRAINT "refresh_families_shape_check" CHECK (
    "version" >= 1 AND ("revoke_reason" IS NULL OR length("revoke_reason") BETWEEN 1 AND 128)
    AND (
      ("status" = 'active' AND "revoked_at" IS NULL AND "revoke_reason" IS NULL)
      OR ("status" IN ('revoked', 'expired') AND "revoked_at" IS NOT NULL AND "revoke_reason" IS NOT NULL)
    )
  )
);

CREATE INDEX "refresh_families_human_session_id_status_idx" ON "refresh_families"("human_session_id", "status");

CREATE TABLE "refresh_credentials" (
  "id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "human_client_id" UUID NOT NULL,
  "secret_verifier" TEXT NOT NULL,
  "verifier_parameters_version" TEXT NOT NULL,
  "status" "RefreshCredentialStatus" NOT NULL DEFAULT 'active',
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "rotated_at" TIMESTAMP(3),
  "replaced_by_id" UUID,
  "revoked_at" TIMESTAMP(3),
  "reuse_detected_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "refresh_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_credentials_verifier_check" CHECK (
    "verifier_parameters_version" = 'scrypt-v1'
    AND "secret_verifier" ~ '^[0-9a-f]{32}:[0-9a-f]{64}$'
  ),
  CONSTRAINT "refresh_credentials_timing_check" CHECK (
    "expires_at" > "issued_at"
    AND "expires_at" <= "issued_at" + INTERVAL '7 days'
  ),
  CONSTRAINT "refresh_credentials_shape_check" CHECK (
    "version" >= 1 AND (
      ("status" = 'active' AND "rotated_at" IS NULL AND "replaced_by_id" IS NULL
        AND "revoked_at" IS NULL AND "reuse_detected_at" IS NULL)
      OR ("status" = 'rotated' AND "rotated_at" IS NOT NULL AND "revoked_at" IS NULL)
      OR ("status" IN ('revoked', 'expired') AND "revoked_at" IS NOT NULL)
    )
  )
);

CREATE UNIQUE INDEX "refresh_credentials_replaced_by_id_key" ON "refresh_credentials"("replaced_by_id");
CREATE UNIQUE INDEX "refresh_credentials_one_active_per_family" ON "refresh_credentials"("family_id") WHERE "status" = 'active';
CREATE INDEX "refresh_credentials_family_id_status_idx" ON "refresh_credentials"("family_id", "status");
CREATE INDEX "refresh_credentials_session_id_status_idx" ON "refresh_credentials"("session_id", "status");

CREATE TABLE "token_exchange_audits" (
  "exchange_id" UUID NOT NULL,
  "result" "ExchangeAuditResult" NOT NULL,
  "original_principal_id" UUID,
  "original_client_id" TEXT,
  "proxy_principal_id" UUID,
  "proxy_client_id" TEXT,
  "source_token_jti" TEXT,
  "delegated_token_jti" TEXT,
  "source_audience" TEXT,
  "target_audience" TEXT,
  "requested_scopes" JSONB,
  "granted_scopes" JSONB,
  "rejection_category" TEXT,
  "request_correlation_id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "token_exchange_audits_pkey" PRIMARY KEY ("exchange_id"),
  CONSTRAINT "token_exchange_audits_text_check" CHECK (
    length("request_correlation_id") > 0 AND
    ("rejection_category" IS NULL OR length("rejection_category") BETWEEN 1 AND 128)
  ),
  CONSTRAINT "token_exchange_audits_result_shape_check" CHECK (
    ("result" = 'success' AND "original_principal_id" IS NOT NULL AND "original_client_id" IS NOT NULL
      AND "proxy_principal_id" IS NOT NULL AND "proxy_client_id" IS NOT NULL
      AND "source_token_jti" IS NOT NULL AND "delegated_token_jti" IS NOT NULL
      AND "source_audience" IS NOT NULL AND "target_audience" IS NOT NULL
      AND "requested_scopes" IS NOT NULL AND "granted_scopes" IS NOT NULL
      AND "rejection_category" IS NULL)
    OR ("result" = 'rejected' AND "delegated_token_jti" IS NULL AND "granted_scopes" IS NULL
      AND "original_principal_id" IS NULL AND "original_client_id" IS NULL
      AND "rejection_category" IS NOT NULL)
  )
);

CREATE INDEX "token_exchange_audits_timestamp_idx" ON "token_exchange_audits"("timestamp");
CREATE INDEX "token_exchange_audits_source_token_jti_idx" ON "token_exchange_audits"("source_token_jti");
CREATE INDEX "token_exchange_audits_delegated_token_jti_idx" ON "token_exchange_audits"("delegated_token_jti");

CREATE TABLE "auth_security_audits" (
  "id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "user_id" UUID,
  "human_client_id" UUID,
  "human_session_id" UUID,
  "refresh_family_id" UUID,
  "credential_id" UUID,
  "request_correlation_id" TEXT,
  "details" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_security_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_security_audits_text_check" CHECK (
    length("event_type") BETWEEN 1 AND 128
    AND "result" IN ('success', 'rejected')
    AND ("request_correlation_id" IS NULL OR length("request_correlation_id") BETWEEN 1 AND 256)
  )
);

CREATE INDEX "auth_security_audits_timestamp_idx" ON "auth_security_audits"("timestamp");

CREATE TABLE "grant_change_audits" (
  "change_id" UUID NOT NULL,
  "migration_id" TEXT NOT NULL,
  "source_git_commit" TEXT NOT NULL,
  "operator_id" TEXT NOT NULL,
  "approval_ref" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "change_type" "GrantChangeType" NOT NULL,
  "expected_grant_version" INTEGER,
  "resulting_grant_version" INTEGER NOT NULL,
  "before_value" JSONB,
  "after_value" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grant_change_audits_pkey" PRIMARY KEY ("change_id"),
  CONSTRAINT "grant_change_audits_source_commit_check" CHECK ("source_git_commit" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "grant_change_audits_required_text_check" CHECK (
    length("migration_id") > 0 AND length("operator_id") > 0
    AND length("approval_ref") > 0 AND length("client_id") > 0
  ),
  CONSTRAINT "grant_change_audits_reason_check" CHECK (length("reason") BETWEEN 1 AND 512),
  CONSTRAINT "grant_change_audits_version_check" CHECK (
    "resulting_grant_version" >= 1 AND
    ("expected_grant_version" IS NULL OR "expected_grant_version" >= 1)
  ),
  CONSTRAINT "grant_change_audits_value_shape_check" CHECK (
    ("change_type" IN ('create', 'replace') AND "after_value" IS NOT NULL)
    OR ("change_type" = 'revoke' AND "after_value" IS NULL)
  )
);

CREATE UNIQUE INDEX "grant_change_audits_migration_id_client_id_change_type_key"
  ON "grant_change_audits"("migration_id", "client_id", "change_type");
CREATE INDEX "grant_change_audits_timestamp_idx" ON "grant_change_audits"("timestamp");

ALTER TABLE "human_client_redirect_uris" ADD CONSTRAINT "human_client_redirect_uris_human_client_id_fkey" FOREIGN KEY ("human_client_id") REFERENCES "human_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_audience_grants" ADD CONSTRAINT "human_audience_grants_human_client_id_fkey" FOREIGN KEY ("human_client_id") REFERENCES "human_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_audience_grants" ADD CONSTRAINT "human_audience_grants_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "auth_audiences"("audience_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "machine_access_grants" ADD CONSTRAINT "machine_access_grants_machine_client_id_fkey" FOREIGN KEY ("machine_client_id") REFERENCES "machine_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "machine_access_grants" ADD CONSTRAINT "machine_access_grants_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "auth_audiences"("audience_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trusted_proxies" ADD CONSTRAINT "trusted_proxies_proxy_principal_id_fkey" FOREIGN KEY ("proxy_principal_id") REFERENCES "machine_principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trusted_proxies" ADD CONSTRAINT "trusted_proxies_proxy_client_id_fkey" FOREIGN KEY ("proxy_client_id") REFERENCES "machine_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proxy_accepted_subject_audiences" ADD CONSTRAINT "proxy_accepted_subject_audiences_trusted_proxy_id_fkey" FOREIGN KEY ("trusted_proxy_id") REFERENCES "trusted_proxies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proxy_accepted_subject_audiences" ADD CONSTRAINT "proxy_accepted_subject_audiences_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "auth_audiences"("audience_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delegation_grants" ADD CONSTRAINT "delegation_grants_trusted_proxy_id_fkey" FOREIGN KEY ("trusted_proxy_id") REFERENCES "trusted_proxies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delegation_grants" ADD CONSTRAINT "delegation_grants_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "auth_audiences"("audience_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorization_transactions" ADD CONSTRAINT "authorization_transactions_human_client_id_fkey" FOREIGN KEY ("human_client_id") REFERENCES "human_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorization_transactions" ADD CONSTRAINT "authorization_transactions_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "auth_audiences"("audience_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorization_transactions" ADD CONSTRAINT "authorization_transactions_authenticated_user_id_fkey" FOREIGN KEY ("authenticated_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_authorization_transaction_id_fkey" FOREIGN KEY ("authorization_transaction_id") REFERENCES "authorization_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_human_client_id_fkey" FOREIGN KEY ("human_client_id") REFERENCES "human_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_audience_id_fkey" FOREIGN KEY ("audience_id") REFERENCES "auth_audiences"("audience_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_sessions" ADD CONSTRAINT "human_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_sessions" ADD CONSTRAINT "human_sessions_human_client_id_fkey" FOREIGN KEY ("human_client_id") REFERENCES "human_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_families" ADD CONSTRAINT "refresh_families_human_session_id_fkey" FOREIGN KEY ("human_session_id") REFERENCES "human_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_sessions" ADD CONSTRAINT "human_sessions_token_family_id_fkey" FOREIGN KEY ("token_family_id") REFERENCES "refresh_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "refresh_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "human_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_human_client_id_fkey" FOREIGN KEY ("human_client_id") REFERENCES "human_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION reject_auth_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auth audit records are immutable';
END;
$$;

CREATE TRIGGER "token_exchange_audits_immutable" BEFORE UPDATE OR DELETE ON "token_exchange_audits" FOR EACH ROW EXECUTE FUNCTION reject_auth_audit_mutation();
CREATE TRIGGER "auth_security_audits_immutable" BEFORE UPDATE OR DELETE ON "auth_security_audits" FOR EACH ROW EXECUTE FUNCTION reject_auth_audit_mutation();
CREATE TRIGGER "grant_change_audits_immutable" BEFORE UPDATE OR DELETE ON "grant_change_audits" FOR EACH ROW EXECUTE FUNCTION reject_auth_audit_mutation();
