-- REFRESH_TOKEN_DURABLE_CONSUMPTION (T86 / AUTH-SCOUT-20260914-C04):
-- durable single-consumption ledger for refresh-token rotation.
--
-- OWNER SECURITY DECISION (OWNER_GATE_MATERIALIZATION_AND_NIGHTLY_RELEASE_20260916_V1,
-- re-released by T85_T86_FALSE_CLOSURE_CORRECTION_AND_REPAIR_RESUME_20260918_V1 §3):
-- still-supported refresh flows must require a canonical replay identity
-- (jti), be durable across restarts, shared across instances, and consume
-- ATOMICALLY. The jti PRIMARY KEY makes the first INSERT the atomic winner;
-- every later INSERT with the same jti is a rejected replay. The former
-- process-local revokedTokens Map (check -> await -> revoke race, lost on
-- restart, invisible across instances, skipped entirely when jti was
-- missing) is no longer the authority.
CREATE TABLE "refresh_token_consumptions" (
    "jti" TEXT NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID,

    CONSTRAINT "refresh_token_consumptions_pkey" PRIMARY KEY ("jti")
);
