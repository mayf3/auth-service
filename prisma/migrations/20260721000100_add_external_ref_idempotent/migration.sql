-- Add external_ref to machine_principals and machine_clients for generic
-- idempotent creation (AUTH_V1_GENERIC_IDEMPOTENT_PRINCIPAL_AND_CLIENT_CREATION).
--
-- external_ref is an opaque caller-provided unique key. Auth never parses it.
-- NULL allowed for existing legacy records; PostgreSQL unique constraints treat
-- multiple NULLs as distinct, so existing data is untouched.

ALTER TABLE "machine_principals"
  ADD COLUMN "external_ref" TEXT;

CREATE UNIQUE INDEX "machine_principals_external_ref_key"
  ON "machine_principals"("external_ref");

ALTER TABLE "machine_clients"
  ADD COLUMN "external_ref" TEXT;

CREATE UNIQUE INDEX "machine_clients_external_ref_key"
  ON "machine_clients"("external_ref");
