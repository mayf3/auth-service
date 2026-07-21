-- Add request_digest column to machine_principals for AUTH_V1_GENERIC_IDEMPOTENT_CREATION.
--
-- request_digest is a SHA-256 hex digest of the principal's stable identity fields
-- (principal_type, agent_id, owner_user_id). It is set atomically on first
-- idempotent access and verified on subsequent calls.
--
-- CHECK constraint: any record with external_ref MUST also have request_digest.
-- This ensures no new idempotent records are created without a digest.
--
-- PREREQUISITE: Run scripts/preflight-request-digest.mjs first.
-- If it reports invalid_count > 0, do NOT apply this migration.
-- Instead, fix the invalid records first (backfill via controlled claim flow).

ALTER TABLE "machine_principals"
  ADD COLUMN "request_digest" TEXT;

ALTER TABLE "machine_principals"
  ADD CONSTRAINT "ck_principal_external_ref_digest"
  CHECK (external_ref IS NULL OR request_digest IS NOT NULL);
