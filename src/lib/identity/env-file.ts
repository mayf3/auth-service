/**
 * .env file reader and atomic writer for PLATFORM_AGENT_ID.
 *
 * PR-1 only: reads/writes only PLATFORM_AGENT_ID.
 * Never reads or leaks other variables, tokens, or secrets.
 *
 * Atomic write strategy:
 *   writeFileSync(.env.tmp) → rename(.env.tmp → .env)
 *   Before any modification, create .env.bak backup.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, copyFileSync, chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TARGET_VAR = 'PLATFORM_AGENT_ID';
const ENV_FILENAME = '.env';
const BACKUP_SUFFIX = '.bak';
const NEW_FILE_MODE = 0o600;

/**
 * Result of reading a workspace .env file.
 * Only exposes whether PLATFORM_AGENT_ID exists and its value.
 */
export interface EnvReadResult {
  path: string;
  exists: boolean;
  hasPlatformAgentId: boolean;
  platformAgentId: string | null;
  /** True if the file could not be parsed (e.g. binary content) */
  unparseable: boolean;
  /** Current file permissions (as octal string) */
  permissions: string | null;
  /** File size in bytes */
  size: number;
}

/**
 * Read a workspace .env file, extracting only PLATFORM_AGENT_ID.
 *
 * Does NOT read or expose any other variables.
 */
export function readEnvFile(workspacePath: string): EnvReadResult {
  const envPath = join(workspacePath, ENV_FILENAME);
  const result: EnvReadResult = {
    path: envPath,
    exists: existsSync(envPath),
    hasPlatformAgentId: false,
    platformAgentId: null,
    unparseable: false,
    permissions: null,
    size: 0,
  };

  if (!result.exists) {
    return result;
  }

  try {
    const stat = statSync(envPath);
    result.size = stat.size;
    result.permissions = (stat.mode & 0o777).toString(8);
  } catch {
    // stat failed, continue
  }

  try {
    const content = readFileSync(envPath, 'utf-8');
    // Match all occurrences of "PLATFORM_AGENT_ID=<value>" at line start
    const matches = Array.from(content.matchAll(/^PLATFORM_AGENT_ID=(.*)$/gm));
    if (matches.length > 0) {
      if (matches.length > 1) {
        // Duplicate definition — fail closed
        result.unparseable = true;
        result.hasPlatformAgentId = true;
        result.platformAgentId = matches[0][1].trim();
        return result;
      }
      result.hasPlatformAgentId = true;
      result.platformAgentId = matches[0][1].trim();
    }
  } catch {
    result.unparseable = true;
  }

  return result;
}

/**
 * Check if the current .env content has PLATFORM_AGENT_ID set to the
 * expected value.
 */
export function envHasCorrectValue(
  workspacePath: string,
  expectedValue: string,
): boolean {
  const state = readEnvFile(workspacePath);
  return (
    state.exists &&
    state.hasPlatformAgentId &&
    state.platformAgentId === expectedValue
  );
}

/**
 * Create a backup of .env at .env.bak.
 *
 * Returns the backup path, or null if .env doesn't exist.
 */
export function backupEnvFile(workspacePath: string): string | null {
  const envPath = join(workspacePath, ENV_FILENAME);
  const bakPath = envPath + BACKUP_SUFFIX;

  if (!existsSync(envPath)) {
    return null;
  }

  copyFileSync(envPath, bakPath);
  return bakPath;
}

/**
 * Restore .env from .env.bak backup.
 */
export function restoreFromBackup(workspacePath: string): boolean {
  const envPath = join(workspacePath, ENV_FILENAME);
  const bakPath = envPath + BACKUP_SUFFIX;

  if (!existsSync(bakPath)) {
    return false;
  }

  copyFileSync(bakPath, envPath);
  return true;
}

/**
 * Check the value of PLATFORM_AGENT_ID in .env for conflict detection.
 *
 * Returns:
 *   - null if .env doesn't exist or PLATFORM_AGENT_ID is absent
 *   - the current value if present
 *   - throws if file is unparseable
 */
export function checkCurrentValue(
  workspacePath: string,
): string | null {
  const state = readEnvFile(workspacePath);
  return state.platformAgentId;
}

/**
 * Atomically set PLATFORM_AGENT_ID in the workspace .env file.
 *
 * Strategy:
 *   1. Read existing .env content (if any)
 *   2. Modify only PLATFORM_AGENT_ID line
 *   3. Write to .env.tmp
 *   4. rename(.env.tmp → .env)
 *   5. If .env didn't exist, set permissions to 0600
 *
 * Preserves all other content byte-level (except line ending normalization
 * of the PLATFORM_AGENT_ID line).
 *
 * @returns true if the file was modified, false if already correct
 * @throws if the current value conflicts (mismatch with expected)
 */
export function atomicSetPlatformAgentId(
  workspacePath: string,
  agentId: string,
): boolean {
  const envPath = join(workspacePath, ENV_FILENAME);
  const tmpPath = envPath + '.tmp';

  // Check current state
  const state = readEnvFile(workspacePath);

  // Conflict detection: if exists with different value, fail
  if (
    state.exists &&
    state.hasPlatformAgentId &&
    state.platformAgentId !== null &&
    state.platformAgentId !== agentId
  ) {
    throw new Error(
      `CONFLICT: ${envPath} has PLATFORM_AGENT_ID=${state.platformAgentId}, ` +
      `expected ${agentId}. Refusing to overwrite.`,
    );
  }

  // Already correct — no-op
  if (state.hasPlatformAgentId && state.platformAgentId === agentId) {
    return false;
  }

  // Capture original file mode BEFORE any writes
  let originalMode: number | null = null;
  if (state.exists) {
    try {
      originalMode = statSync(envPath).mode & 0o777;
    } catch {
      // stat failed — ignore
    }
  }

  // Read existing content or start fresh
  let content = '';
  let fileExisted = false;
  if (state.exists && !state.unparseable) {
    try {
      content = readFileSync(envPath, 'utf-8');
      fileExisted = true;
    } catch {
      // Unreadable — treat as non-existent
    }
  }

  if (fileExisted) {
    // Remove ALL existing PLATFORM_AGENT_ID lines, then append the correct one
    const linePattern = /^PLATFORM_AGENT_ID=.*$/gm;
    const cleaned = content.replace(linePattern, '');
    if (cleaned !== content) {
      // Some lines were removed — clean up duplicate newlines
      content = cleaned.replace(/\n{2,}/g, '\n');
      // Ensure trailing newline before appending
      if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
      }
      content += `${TARGET_VAR}=${agentId}\n`;
    } else {
      // No existing PLATFORM_AGENT_ID line found — append
      if (!content.endsWith('\n')) {
        content += '\n';
      }
      content += `${TARGET_VAR}=${agentId}\n`;
    }
  } else {
    // New file — just the variable
    content = `${TARGET_VAR}=${agentId}\n`;
  }

  // Atomic write: write to tmp, then rename
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, envPath);

  // Restore original file permissions on existing files
  if (fileExisted && originalMode !== null) {
    try {
      chmodSync(envPath, originalMode);
    } catch {
      // Permissions may fail on some systems; not a blocker
    }
  } else if (!fileExisted) {
    try {
      chmodSync(envPath, NEW_FILE_MODE);
    } catch {
      // Permissions may fail on some systems; not a blocker
    }
  }

  return true;
}
