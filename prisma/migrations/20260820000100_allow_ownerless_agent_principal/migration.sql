BEGIN;
ALTER TABLE "machine_principals"
  DROP CONSTRAINT "machine_principal_type_shape_check";
ALTER TABLE "machine_principals"
  ADD CONSTRAINT "machine_principal_type_shape_check" CHECK (
    (
      "principal_type"::text = 'agent'
      AND "agent_id" IS NOT NULL
    )
    OR
    (
      "principal_type"::text = 'service'
      AND "agent_id" IS NULL
    )
  );
COMMIT;
