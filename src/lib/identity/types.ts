/**
 * Type definitions for OpenClaw Agent Identity Bootstrap.
 *
 * These types describe the OpenClaw configuration model and the output
 * of identity resolution / audit / bootstrap commands.
 *
 * PR-1 only: no Principal UUIDs, no Client Secrets, no Token claims.
 */

/** A single agent entry from openclaw.json agents.list */
export interface AgentConfig {
  id: string;
  name?: string;
  workspace: string;
  enabled: boolean;
  /** Display name from config (may differ from id) */
  displayName?: string;
}

/** Parsed openclaw.json structure */
export interface OpenClawConfig {
  agents: AgentConfig[];
  rawPath: string;
}

/** Result of `identity current` */
export interface IdentityResult {
  agent_id: string;
  workspace: string;
  source: string;              // e.g. "workspace-env-verified-by-openclaw-config"
  verified: boolean;
  issues?: string[];
}

/** Per-agent audit entry */
export interface AuditEntry {
  agent_id: string;
  workspace: string;
  enabled: boolean;
  workspace_exists: boolean;
  env_exists: boolean;
  has_platform_agent_id: boolean;
  platform_agent_id_match: boolean;
  platform_agent_id_value: string | null;
  id_format_valid: boolean;
  id_format_issues: string[];
  issues: string[];
}

/** Summary of a full audit run */
export interface AuditSummary {
  version: number;
  generated_at: string;
  generated_from: string;
  total_agents: number;
  enabled_agents: number;
  with_env: number;
  with_platform_agent_id: number;
  correct_mappings: number;
  missing_env: number;
  missing_platform_agent_id: number;
  id_format_issues: number;
  workspace_conflicts: string[];
  agent_entries: AuditEntry[];
  blocked: boolean;
  critical_issues: string[];
}

/** Action item in a bootstrap plan */
export interface BootstrapAction {
  agent_id: string;
  workspace: string;
  /** Action type for a single agent in the bootstrap plan.
   *  'add' — PLATFORM_AGENT_ID missing, will be created.
   *  'skip' — already correct, no action needed.
   *  'conflict' — existing value differs from config, manual resolution required.
   *  'blocked' — workspace missing or agent ID format invalid.
   *  'update' — RESERVED (removed in HIGH-05 fix). No longer generated.
   */
  action: 'add' | 'update' | 'skip' | 'conflict' | 'blocked';
  current_value: string | null;
  expected_value: string;
  reason: string;
}

/** Output of `bootstrap --dry-run` */
export interface BootstrapPlan {
  version: number;
  generated_at: string;
  generated_from: string;
  total_agents: number;
  summary: {
    add: number;
    /** RESERVED — always 0 (removed in HIGH-05 fix). Kept for interface compatibility. */
    update: number;
    skip: number;
    conflict: number;
    blocked: number;
  };
  actions: BootstrapAction[];
  blockers: string[];
  can_apply: boolean;
}

/** Output of `bootstrap --apply` */
export interface BootstrapResult {
  version: number;
  applied_at: string;
  total_agents: number;
  modified: number;
  skipped: number;
  errors: string[];
  modifications: BootstrapModification[];
  blocked: boolean;
}

/** One modified file */
export interface BootstrapModification {
  agent_id: string;
  workspace: string;
  /** 
   * Result action for a single file.
   * 'added' — file was modified.
   * 'skipped' — no change needed.
   * 'error' — operation failed.
   * 'updated' — RESERVED (no longer generated after HIGH-05 fix).
   */
  action: 'added' | 'updated' | 'skipped' | 'error';
  backup_path: string | null;
  error?: string;
}

/** Machine-readable mapping manifest */
export interface AgentManifest {
  version: number;
  generated_at: string;
  generated_from: string;
  agents: AgentManifestEntry[];
}

export interface AgentManifestEntry {
  agent_id: string;
  workspace: string;
  status: string;
}
