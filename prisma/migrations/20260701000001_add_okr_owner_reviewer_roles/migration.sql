-- Add okr_owner and okr_reviewer to OkrRole enum
-- Uses ALTER TYPE ... ADD VALUE IF NOT EXISTS (PostgreSQL 9.6+)
-- Does NOT remove okr_viewer (exists in production data)

ALTER TYPE "OkrRole" ADD VALUE IF NOT EXISTS 'okr_owner';
ALTER TYPE "OkrRole" ADD VALUE IF NOT EXISTS 'okr_reviewer';
