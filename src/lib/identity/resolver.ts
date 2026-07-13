/**
 * Core identity resolution logic.
 *
 * Combines openclaw.json config parsing with .env reading to resolve
 * and verify the current agent identity.
 *
 * All commands:
 *   - resolveCurrent   → identity current
 *   - auditAll         → identity audit
 *   - planBootstrap    → identity bootstrap --dry-run
 *   - executeBootstrap → identity bootstrap --apply
 */

import type {
  IdentityResult,
  AuditEntry,
  AuditSummary,
  BootstrapAction,
  BootstrapPlan,
  BootstrapResult,
  BootstrapModification,
  AgentManifest,
  AgentManifestEntry,
} from './types.js';
import {
  loadOpenClawConfig,
  resolveWorkspacePath,
  validateAgentIdFormat,
  findAgentForWorkspace,
  workspaceExists,
  detectWorkspaceConflicts,
  buildWorkspaceMap,
  findAgentsByWorkspace,
} from './config.js';
import {
  readEnvFile,
  backupEnvFile,
  atomicSetPlatformAgentId,
  checkCurrentValue,
} from './env-file.js';

/** Environment variable name used for bootstrap identity declaration. */
const PLATFORM_AGENT_ID = 'PLATFORM_AGENT_ID';

// ── identity current ───────────────────────────────────────────────────

/**
 * Resolve the current agent identity based on the working directory.
 *
 * Steps:
 *   1. Determine CWD
 *   2. Read openclaw.json
 *   3. Find the agent whose workspace matches CWD
 *   4. Read .env from that workspace (only PLATFORM_AGENT_ID)
 *   5. Verify consistency
 *
 * @param cwd - Current working directory to resolve against
 * @param configPath - Optional path to openclaw.json
 * @returns IdentityResult
 * @throws on any validation failure (fail closed)
 */
export function resolveCurrent(
  cwd: string,
  configPath?: string,
): IdentityResult {
  const issues: string[] = [];

  // 1. Load canonical config
  const config = loadOpenClawConfig(configPath);

  // 2. Find agent for this workspace
  const agent = findAgentForWorkspace(config.agents, cwd);
  if (!agent) {
    throw new Error(
      `No agent configured for workspace: ${cwd}. ` +
      `Verify openclaw.json has an agent with workspace pointing to this directory.`,
    );
  }

  // 3. Validate agent ID format
  const formatIssues = validateAgentIdFormat(agent.id);
  if (formatIssues.length > 0) {
    throw new Error(
      `Agent ID format invalid for "${agent.id}": ${formatIssues.join('; ')}`,
    );
  }

  // 4. Check agent is enabled
  if (!agent.enabled) {
    throw new Error(
      `Agent "${agent.id}" is disabled in openclaw.json. Cannot verify identity.`,
    );
  }

  // 5. Check workspace conflict
  const conflicts = detectWorkspaceConflicts(config.agents);
  const relevantConflicts = conflicts.filter((c) => c.includes(agent.workspace));
  if (relevantConflicts.length > 0) {
    throw new Error(
      `Workspace conflict detected: ${relevantConflicts.join('; ')}`,
    );
  }

  // 6. Read .env
  const envState = readEnvFile(cwd);

  if (!envState.exists) {
    throw new Error(
      `.env not found in workspace: ${cwd}. ` +
      `Run bootstrap to create it with ${PLATFORM_AGENT_ID}=${agent.id}`,
    );
  }

  if (!envState.hasPlatformAgentId) {
    throw new Error(
      `${PLATFORM_AGENT_ID} not found in ${envState.path}. ` +
      `Run bootstrap to add it.`,
    );
  }

  if (envState.platformAgentId !== agent.id) {
    throw new Error(
      `${PLATFORM_AGENT_ID} mismatch: ` +
      `.env has "${envState.platformAgentId}", ` +
      `openclaw.json expects "${agent.id}" for this workspace.`,
    );
  }

  // 7. Verify this workspace belongs exclusively to this agent
  const agentsInWs = findAgentsByWorkspace(config.agents, cwd);
  const enabledInWs = agentsInWs.filter((a) => a.enabled);
  if (enabledInWs.length > 1) {
    throw new Error(
      `Workspace ${cwd} is shared by multiple enabled agents: ` +
      `${enabledInWs.map((a) => a.id).join(', ')}`,
    );
  }

  return {
    agent_id: agent.id,
    workspace: resolveWorkspacePath(agent.workspace),
    source: 'workspace-env-verified-by-openclaw-config',
    verified: true,
    issues: issues.length > 0 ? issues : undefined,
  };
}

// ── identity audit ─────────────────────────────────────────────────────

/**
 * Audit all agents in the OpenClaw configuration.
 *
 * Read-only: never modifies any file.
 * Only reads PLATFORM_AGENT_ID from .env files, never other variables.
 */
export function auditAll(configPath?: string): AuditSummary {
  const config = loadOpenClawConfig(configPath);
  const wsMap = buildWorkspaceMap(config.agents);
  const workspaceConflicts = detectWorkspaceConflicts(config.agents);

  const entries: AuditEntry[] = [];
  let withEnv = 0;
  let withPlaid = 0;
  let correctMappings = 0;
  let missingEnv = 0;
  let missingPlaid = 0;
  let idFormatIssues = 0;

  for (const agent of config.agents) {
    const ws = resolveWorkspacePath(agent.workspace);
    const wsExists = workspaceExists(ws);
    const envState = readEnvFile(ws);

    if (envState.exists) withEnv++;
    else missingEnv++;

    const hasPlaid = envState.hasPlatformAgentId;
    const plaidValue = envState.platformAgentId;
    const match = hasPlaid && plaidValue === agent.id;
    const fmtIssues = validateAgentIdFormat(agent.id);

    if (hasPlaid && plaidValue) withPlaid++;
    else if (envState.exists) missingPlaid++;

    if (match) correctMappings++;
    if (fmtIssues.length > 0) idFormatIssues++;

    const entryIssues: string[] = [];
    if (!wsExists) entryIssues.push('Workspace directory does not exist');
    if (!envState.exists) entryIssues.push('.env file missing');
    if (!hasPlaid) entryIssues.push(`${PLATFORM_AGENT_ID} missing`);
    else if (!match) {
      entryIssues.push(
        `${PLATFORM_AGENT_ID} mismatch: .env has "${plaidValue}", expected "${agent.id}"`,
      );
    }
    if (fmtIssues.length > 0) {
      entryIssues.push(...fmtIssues.map((i) => `ID format: ${i}`));
    }
    if (envState.permissions && parseInt(envState.permissions, 8) > 0o600) {
      entryIssues.push(`File permissions ${envState.permissions} (too permissive, expected 600)`);
    }

    entries.push({
      agent_id: agent.id,
      workspace: ws,
      enabled: agent.enabled,
      workspace_exists: wsExists,
      env_exists: envState.exists,
      has_platform_agent_id: hasPlaid,
      platform_agent_id_match: match,
      platform_agent_id_value: plaidValue,
      id_format_valid: fmtIssues.length === 0,
      id_format_issues: fmtIssues,
      issues: entryIssues,
    });
  }

  const criticalIssues: string[] = [];
  if (workspaceConflicts.length > 0) {
    criticalIssues.push(
      `Workspace conflicts detected: ${workspaceConflicts.join('; ')}`,
    );
  }

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    generated_from: config.rawPath,
    total_agents: config.agents.length,
    enabled_agents: config.agents.filter((a) => a.enabled).length,
    with_env: withEnv,
    with_platform_agent_id: withPlaid,
    correct_mappings: correctMappings,
    missing_env: missingEnv,
    missing_platform_agent_id: missingPlaid,
    id_format_issues: idFormatIssues,
    workspace_conflicts: workspaceConflicts,
    agent_entries: entries,
    blocked: workspaceConflicts.length > 0,
    critical_issues: criticalIssues,
  };
}

// ── identity bootstrap --dry-run ──────────────────────────────────────

/**
 * Generate a bootstrap plan without modifying any files.
 */
export function planBootstrap(configPath?: string): BootstrapPlan {
  const config = loadOpenClawConfig(configPath);
  const conflicts = detectWorkspaceConflicts(config.agents);
  const actions: BootstrapAction[] = [];

  let addCount = 0;
  let skipCount = 0;
  let conflictCount = 0;
  let blockedCount = 0;

  for (const agent of config.agents) {
    // Validate Agent ID format first — prevents writing invalid IDs
    const formatIssues = validateAgentIdFormat(agent.id);
    if (formatIssues.length > 0) {
      const reason = `Agent ID "${agent.id}" has format issues: ${formatIssues.join('; ')}`;
      blockedCount++;
      actions.push({
        agent_id: agent.id,
        workspace: resolveWorkspacePath(agent.workspace),
        action: 'blocked',
        current_value: checkCurrentValue(resolveWorkspacePath(agent.workspace)),
        expected_value: agent.id,
        reason,
      });
      continue;
    }

    const ws = resolveWorkspacePath(agent.workspace);
    const wsExists = workspaceExists(ws);
    const currentValue = checkCurrentValue(ws);

    const action: BootstrapAction = {
      agent_id: agent.id,
      workspace: ws,
      action: 'blocked',
      current_value: currentValue,
      expected_value: agent.id,
      reason: '',
    };

    if (!wsExists) {
      action.action = 'blocked';
      action.reason = 'Workspace directory does not exist';
      blockedCount++;
    } else if (currentValue === agent.id) {
      action.action = 'skip';
      action.reason = 'Already correctly configured';
      skipCount++;
    } else if (currentValue !== null) {
      // Current value exists but doesn't match — this is a conflict.
      // atomicSetPlatformAgentId refuses to overwrite different values for safety.
      // Never generate 'update' here — that would promise something executeBootstrap
      // cannot deliver (see HIGH-05 fix).
      action.action = 'conflict';
      action.reason =
        `PLATFORM_AGENT_ID mismatch: "${currentValue}" ≠ expected "${agent.id}". ` +
        `Manual resolution required.`;
      conflictCount++;
    } else {
      // No current value — needs add
      if (!currentValue && wsExists) {
        action.action = 'add';
        action.reason = `${PLATFORM_AGENT_ID} missing, will add`;
        addCount++;
      } else {
        action.action = 'add';
        action.reason = `${PLATFORM_AGENT_ID} missing, will create .env`;
        addCount++;
      }
    }

    actions.push(action);
  }

  const blockers: string[] = [];
  if (conflicts.length > 0) {
    blockers.push(...conflicts);
  }
  // Collect format-related blockers
  const formatBlocked = actions.filter(
    (a) => a.action === 'blocked' && a.reason.includes('format issues'),
  );
  for (const fb of formatBlocked) {
    blockers.push(fb.reason);
  }
  // Collect conflict blockers (PLATFORM_AGENT_ID value mismatches)
  const conflictBlocked = actions.filter((a) => a.action === 'conflict');
  for (const cb of conflictBlocked) {
    blockers.push(cb.reason);
  }
  const hasBlockers =
    actions.some((a) => a.action === 'blocked' || a.action === 'conflict') ||
    conflicts.length > 0;

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    generated_from: config.rawPath,
    total_agents: config.agents.length,
    summary: {
      add: addCount,
      update: 0, // reserved — no longer generated (see HIGH-05 fix)
      skip: skipCount,
      conflict: conflictCount,
      blocked: blockedCount,
    },
    actions,
    blockers,
    can_apply: !hasBlockers,
  };
}

// ── identity bootstrap --apply ────────────────────────────────────────

/**
 * Execute the bootstrap plan — write PLATFORM_AGENT_ID to each workspace.
 *
 * Before any writes, creates .env.bak backups.
 * Uses atomic writes (tmp file + rename).
 *
 * @throws if any blocker exists (workspace conflicts, etc.)
 */
export function executeBootstrap(configPath?: string): BootstrapResult {
  // First: dry-run to validate
  const plan = planBootstrap(configPath);

  if (!plan.can_apply) {
    return {
      version: 1,
      applied_at: new Date().toISOString(),
      total_agents: plan.total_agents,
      modified: 0,
      skipped: 0,
      errors: [
        'Bootstrap blocked. Run --dry-run to see details.',
        ...plan.blockers,
      ],
      modifications: [],
      blocked: true,
    };
  }

  const modifications: BootstrapModification[] = [];
  let modified = 0;
  let skipped = 0;
  const errors: string[] = [];
  const backedUp: string[] = [];

  for (const action of plan.actions) {
    if (action.action === 'skip') {
      skipped++;
      modifications.push({
        agent_id: action.agent_id,
        workspace: action.workspace,
        action: 'skipped',
        backup_path: null,
      });
      continue;
    }

    if (action.action === 'add') {
      // Backup before modifying
      const backupPath = backupEnvFile(action.workspace);
      if (backupPath) {
        backedUp.push(backupPath);
      }

      try {
        const didModify = atomicSetPlatformAgentId(
          action.workspace,
          action.expected_value,
        );
        if (didModify) {
          modified++;
          modifications.push({
            agent_id: action.agent_id,
            workspace: action.workspace,
            action: 'added',
            backup_path: backupPath,
          });
        } else {
          skipped++;
          modifications.push({
            agent_id: action.agent_id,
            workspace: action.workspace,
            action: 'skipped',
            backup_path: null,
          });
        }
      } catch (err: any) {
        errors.push(`${action.agent_id} (${action.workspace}): ${err.message}`);
        modifications.push({
          agent_id: action.agent_id,
          workspace: action.workspace,
          action: 'error',
          backup_path: null,
          error: err.message,
        });
      }
    }
  }

  return {
    version: 1,
    applied_at: new Date().toISOString(),
    total_agents: plan.total_agents,
    modified,
    skipped,
    errors,
    modifications,
    blocked: false,
  };
}

// ── manifest ──────────────────────────────────────────────────────────

/**
 * Generate the machine-readable agent mapping manifest.
 *
 * Derived entirely from openclaw.json — never reads .env or secrets.
 */
export function generateManifest(configPath?: string): AgentManifest {
  const config = loadOpenClawConfig(configPath);

  const entries: AgentManifestEntry[] = config.agents.map((agent) => ({
    agent_id: agent.id,
    workspace: resolveWorkspacePath(agent.workspace),
    status: agent.enabled ? 'enabled' : 'disabled',
  }));

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    generated_from: config.rawPath,
    agents: entries,
  };
}
