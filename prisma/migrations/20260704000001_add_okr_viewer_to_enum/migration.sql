-- Add okr_viewer to OkrRole enum
-- Production enum currently has: okr_admin, okr_reviewer, okr_member, okr_owner
-- Missing: okr_viewer
-- Uses IF NOT EXISTS for idempotent deployment

ALTER TYPE "OkrRole" ADD VALUE IF NOT EXISTS 'okr_viewer';
