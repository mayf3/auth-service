#!/usr/bin/env node

/**
 * agent-identity — OpenClaw Agent Identity CLI.
 *
 * Provides:
 *   identity current              Resolve current agent identity
 *   identity audit                Audit all agents (read-only)
 *   identity bootstrap --dry-run  Generate bootstrap plan (read-only)
 *   identity bootstrap --apply    Execute bootstrap (write)
 *   manifest                      Generate machine-readable mapping
 *
 * PR-1 only: reads openclaw.json and .env files.
 * Never reads or exposes secrets, tokens, or passwords.
 * Never writes to auth-service database.
 */

import { resolve } from 'node:path';
import {
  resolveCurrent,
  auditAll,
  planBootstrap,
  executeBootstrap,
  generateManifest,
} from '../lib/identity/resolver.js';

// ── Config ────────────────────────────────────────────────────────────────

const OPENCLAW_CONFIG_ENV = 'OPENCLAW_CONFIG_PATH';

function getConfigPath(): string | undefined {
  return process.env[OPENCLAW_CONFIG_ENV] || undefined;
}

// ── Help ──────────────────────────────────────────────────────────────────

function printHelp(): void {
  const help = `
agent-identity  —  OpenClaw Agent Identity Bootstrap CLI  (PR-1)

USAGE:
  agent-identity identity current              Resolve current agent identity
  agent-identity identity audit                Audit all agents (read-only)
  agent-identity identity bootstrap --dry-run  Generate bootstrap plan
  agent-identity identity bootstrap --apply    Execute bootstrap (write)
  agent-identity manifest                      Generate mapping manifest
  agent-identity --help                        Show this help

OPTIONS:
  --config <path>   Path to openclaw.json (default: ~/.openclaw/openclaw.json)
                    Also read from OPENCLAW_CONFIG_PATH environment variable.

OUTPUT:
  All output is JSON to stdout. Errors go to stderr. Exit code is non-zero
  on failure (fail closed).

SAFETY:
  - --dry-run never modifies files
  - --apply creates .env.bak backups before modification
  - Never reads or exposes secrets/tokens/passwords
  - Bootstrap is blocked if workspace conflicts exist

ENVIRONMENT:
  OPENCLAW_CONFIG_PATH   Override path to openclaw.json
`;
  console.error(help.trim());
}

// ── Command handlers ──────────────────────────────────────────────────────

function cmdCurrent(): void {
  const cwd = process.cwd();
  const result = resolveCurrent(cwd, getConfigPath());
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function cmdAudit(): void {
  const result = auditAll(getConfigPath());
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function cmdBootstrapDryRun(): void {
  const result = planBootstrap(getConfigPath());
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function cmdBootstrapApply(): void {
  const result = executeBootstrap(getConfigPath());
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function cmdManifest(): void {
  const result = generateManifest(getConfigPath());
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  // Extract --config <path> from anywhere in args
  let configOverride: string | undefined;
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
      configOverride = args[i + 1];
      i++; // skip next arg
    } else {
      filteredArgs.push(args[i]);
    }
  }

  if (configOverride) {
    process.env[OPENCLAW_CONFIG_ENV] = resolve(configOverride);
  }

  const cmd = filteredArgs[0];
  const sub = filteredArgs[1];

  try {
    if (cmd === 'identity') {
      if (sub === 'current') {
        cmdCurrent();
      } else if (sub === 'audit') {
        cmdAudit();
      } else if (sub === 'bootstrap') {
        const isDryRun = filteredArgs.includes('--dry-run');
        const isApply = filteredArgs.includes('--apply');

        if (isDryRun && isApply) {
          console.error(
            'Cannot use both --dry-run and --apply simultaneously.',
          );
          process.exit(1);
        }

        if (isDryRun) {
          cmdBootstrapDryRun();
        } else if (isApply) {
          cmdBootstrapApply();
        } else {
          console.error(
            'identity bootstrap requires --dry-run or --apply.',
          );
          process.exit(1);
        }
      } else {
        console.error(
          `Unknown identity subcommand: "${sub}". Use: current, audit, bootstrap`,
        );
        process.exit(1);
      }
    } else if (cmd === 'manifest') {
      cmdManifest();
    } else {
      console.error(`Unknown command: "${cmd}". Use --help for usage.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}

main();
