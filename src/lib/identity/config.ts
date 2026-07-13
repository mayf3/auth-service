/**
 * OpenClaw configuration reader and agent lookup.
 *
 * Source of truth: `~/.openclaw/openclaw.json` → agents.list[].id
 *
 * PR-1 only: reads configuration, validates IDs, resolves workspaces,
 * detects conflicts. Never reads tokens or secrets.
 */

import { homedir } from 'node:os';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AgentConfig, OpenClawConfig } from './types.js';

/** Default path to the OpenClaw master configuration file. */
const DEFAULT_OPENCLAW_CONFIG = homedir() + '/.openclaw/openclaw.json';

/**
 * Agent ID validation pattern.
 *
 * Aligned with OpenClaw 2026.3.13's own VALID_ID_RE:
 *   /^[a-z0-9][a-z0-9_-]{0,63}$/i
 *
 * Rules:
 *   - May start with a lowercase letter or digit
 *   - May contain lowercase letters, digits, hyphens, and underscores
 *   - Case-insensitive (OpenClaw accepts uppercase)
 *   - Maximum 64 characters
 *   - Minimum length: 1
 */
const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/**
 * Resolve a workspace path that may use a `~` (tilde) prefix.
 *
 * - `~/.openclaw/...` → `/Users/username/.openclaw/...`
 * - `/absolute/path` → `/absolute/path` (unchanged)
 */
export function resolveWorkspacePath(workspace: string): string {
  if (workspace.startsWith('~/') || workspace === '~') {
    return homedir() + workspace.slice(1);
  }
  return workspace;
}

/**
 * Validate an Agent ID string against the canonical format.
 *
 * Returns an array of issue descriptions (empty = valid).
 */
export function validateAgentIdFormat(id: string): string[] {
  const issues: string[] = [];
  if (!id || typeof id !== 'string') {
    issues.push('Agent ID is empty or not a string');
    return issues;
  }
  if (id.length > 64) {
    issues.push('Agent ID must be at most 64 characters');
  }
  if (!AGENT_ID_PATTERN.test(id)) {
    if (!/^[a-z0-9]/.test(id)) {
      issues.push('Agent ID must start with a lowercase letter or digit');
    }
    if (/[^a-z0-9_-]/i.test(id)) {
      issues.push('Agent ID must only contain letters, digits, hyphens, and underscores');
    }
    if (!issues.length) {
      issues.push(`Agent ID "${id}" does not match pattern /^[a-z0-9][a-z0-9_-]{0,63}$/i`);
    }
  }
  return issues;
}

/**
 * Find all agents whose resolved workspace matches the given path.
 */
export function findAgentsByWorkspace(
  agents: AgentConfig[],
  workspacePath: string,
): AgentConfig[] {
  const resolved = resolve(workspacePath);
  return agents.filter((a) => {
    const ws = resolve(resolveWorkspacePath(a.workspace));
    return ws === resolved;
  });
}

/**
 * Load and parse the OpenClaw master configuration.
 *
 * @param configPath - Path to openclaw.json (default: ~/.openclaw/openclaw.json)
 * @returns Parsed config with resolved agent objects
 */
export function loadOpenClawConfig(
  configPath: string = DEFAULT_OPENCLAW_CONFIG,
): OpenClawConfig {
  if (!existsSync(configPath)) {
    throw new Error(`OpenClaw config not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, 'utf-8');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OpenClaw config is not valid JSON: ${configPath}`);
  }

  if (!parsed.agents?.list || !Array.isArray(parsed.agents.list)) {
    throw new Error(
      `OpenClaw config missing agents.list array: ${configPath}`,
    );
  }

  const agents: AgentConfig[] = parsed.agents.list.map((entry: any) => ({
    id: entry.id ?? '',
    name: entry.name ?? '',
    workspace: entry.workspace ?? '',
    enabled: entry.enabled !== false,
    displayName: entry.name ?? '',
  }));

  return { agents, rawPath: configPath };
}

/**
 * Build a map of resolved workspace → enabled agent IDs.
 *
 * Returns a Map where each key is an absolute workspace path.
 * If multiple enabled agents map to the same workspace, the value
 * array will contain more than one entry (a conflict).
 */
export function buildWorkspaceMap(
  agents: AgentConfig[],
): Map<string, AgentConfig[]> {
  const wsMap = new Map<string, AgentConfig[]>();
  for (const agent of agents) {
    const resolved = resolve(resolveWorkspacePath(agent.workspace));
    if (!wsMap.has(resolved)) {
      wsMap.set(resolved, []);
    }
    wsMap.get(resolved)!.push(agent);
  }
  return wsMap;
}

/**
 * Detect workspace conflicts — multiple enabled agents pointing to
 * the same workspace directory.
 *
 * Returns an array of conflict descriptions.
 */
export function detectWorkspaceConflicts(
  agents: AgentConfig[],
): string[] {
  const wsMap = buildWorkspaceMap(agents);
  const conflicts: string[] = [];
  for (const [ws, agentsInWs] of wsMap) {
    const enabled = agentsInWs.filter((a) => a.enabled);
    if (enabled.length > 1) {
      const ids = enabled.map((a) => a.id).join(', ');
      conflicts.push(
        `Workspace ${ws} is mapped by ${enabled.length} enabled agents: ${ids}`,
      );
    }
  }
  return conflicts;
}

/**
 * Discover which agent (if any) owns the current workspace.
 *
 * Returns the matching AgentConfig, or null if no agent is configured
 * for this workspace path.
 */
export function findAgentForWorkspace(
  agents: AgentConfig[],
  cwd: string,
): AgentConfig | null {
  const resolvedCwd = resolve(cwd);
  for (const agent of agents) {
    const ws = resolve(resolveWorkspacePath(agent.workspace));
    if (ws === resolvedCwd) {
      return agent;
    }
  }
  return null;
}

/**
 * Check if a workspace directory exists and is accessible.
 */
export function workspaceExists(workspacePath: string): boolean {
  try {
    return existsSync(workspacePath) && statSync(workspacePath).isDirectory();
  } catch {
    return false;
  }
}
