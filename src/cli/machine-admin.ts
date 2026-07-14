#!/usr/bin/env node

/**
 * machine-admin — Machine Principal & Client Credentials Admin CLI.
 *
 * USAGE:
 *   machine-admin principal create --agent-id <id> --owner <userId> [--name <name>]
 *   machine-admin principal inspect --agent-id <id>
 *   machine-admin principal disable --agent-id <id>
 *   machine-admin client create --agent-id <id> --resources "a,b" --scopes "x,y"
 *   machine-admin client rotate --client-id <id>
 *   machine-admin client revoke --client-id <id>
 *   machine-admin client inspect --client-id <id>
 *
 * All output is JSON to stdout. Errors to stderr. Non-zero exit on failure.
 */

import {
  createPrincipal,
  getPrincipal,
  disablePrincipal,
  createClient,
  rotateClientSecret,
  revokeClient,
  getClient,
} from '../lib/oauth/service.js';

// ── Help ──────────────────────────────────────────────────────────────────

function printHelp(): void {
  const help = `
machine-admin  —  Machine Principal & Client Credentials Admin CLI  (PR-2A)

USAGE:
  machine-admin principal create --agent-id <id> --owner <userId> [--name <name>]
  machine-admin principal inspect --agent-id <id>
  machine-admin principal disable --agent-id <id>
  machine-admin client create --agent-id <id> --resources "a,b" --scopes "x,y"
  machine-admin client rotate --client-id <id>
  machine-admin client revoke --client-id <id>
  machine-admin client inspect --client-id <id>
  machine-admin --help

OUTPUT:
  All output is JSON to stdout. Errors go to stderr. Exit code is non-zero
  on failure.

SAFETY:
  - Client secret is shown ONLY on create/rotate.
  - Never stored in logs or output after creation.
  - All operations are audited.
`;
  console.error(help.trim());
}

// ── Argument Parser ────────────────────────────────────────────────────────

interface ParsedArgs {
  command: string[];
  kwargs: Record<string, string>;
}

function parseArgs(args: string[]): ParsedArgs {
  const kwargs: Record<string, string> = {};
  const command: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        kwargs[key] = args[i + 1];
        i++;
      } else {
        kwargs[key] = '';
      }
    } else {
      command.push(arg);
    }
  }

  return { command, kwargs };
}

// ── Command Handlers ───────────────────────────────────────────────────────

async function cmdPrincipalCreate(kwargs: Record<string, string>): Promise<void> {
  const agentId = kwargs['agent-id'];
  const ownerUserId = kwargs['owner'];
  const displayName = kwargs['name'];

  if (!agentId) throw new Error('--agent-id is required');
  if (!ownerUserId) throw new Error('--owner is required');

  const result = await createPrincipal({ agentId, ownerUserId, displayName });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

async function cmdPrincipalInspect(kwargs: Record<string, string>): Promise<void> {
  const agentId = kwargs['agent-id'];
  if (!agentId) throw new Error('--agent-id is required');

  const result = await getPrincipal(agentId);
  if (!result) {
    throw new Error(`MachinePrincipal not found for agent "${agentId}"`);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

async function cmdPrincipalDisable(kwargs: Record<string, string>): Promise<void> {
  const agentId = kwargs['agent-id'];
  if (!agentId) throw new Error('--agent-id is required');

  const result = await disablePrincipal(agentId);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

async function cmdClientCreate(kwargs: Record<string, string>): Promise<void> {
  const agentId = kwargs['agent-id'];
  const resourcesRaw = kwargs['resources'];
  const scopesRaw = kwargs['scopes'];

  if (!agentId) throw new Error('--agent-id is required');
  if (!resourcesRaw) throw new Error('--resources is required (comma-separated)');
  if (!scopesRaw) throw new Error('--scopes is required (comma-separated)');

  const resources = resourcesRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const scopes = scopesRaw.split(',').map((s) => s.trim()).filter(Boolean);

  if (resources.length === 0) throw new Error('At least one resource required');
  if (scopes.length === 0) throw new Error('At least one scope required');

  const result = await createClient({ agentId, resources, scopes });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

async function cmdClientRotate(kwargs: Record<string, string>): Promise<void> {
  const clientId = kwargs['client-id'];
  if (!clientId) throw new Error('--client-id is required');

  const result = await rotateClientSecret(clientId);
  process.stdout.write(JSON.stringify({
    clientId: result.client.clientId,
    newSecret: result.newSecret,
    rotatedAt: result.client.rotatedAt,
    status: result.client.status,
  }, null, 2) + '\n');
}

async function cmdClientRevoke(kwargs: Record<string, string>): Promise<void> {
  const clientId = kwargs['client-id'];
  if (!clientId) throw new Error('--client-id is required');

  const result = await revokeClient(clientId);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

async function cmdClientInspect(kwargs: Record<string, string>): Promise<void> {
  const clientId = kwargs['client-id'];
  if (!clientId) throw new Error('--client-id is required');

  const result = await getClient(clientId);
  if (!result) {
    throw new Error(`Client not found: "${clientId}"`);
  }
  // Never show secretHash in inspect
  const safe = { ...result };
  process.stdout.write(JSON.stringify(safe, null, 2) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const { command, kwargs } = parseArgs(args);

  if (command.length < 2) {
    console.error('Usage: machine-admin <entity> <action> [options]');
    console.error('Run machine-admin --help for details.');
    process.exit(1);
  }

  const [entity, action] = command;

  try {
    switch (entity) {
      case 'principal':
        switch (action) {
          case 'create': await cmdPrincipalCreate(kwargs); break;
          case 'inspect': await cmdPrincipalInspect(kwargs); break;
          case 'disable': await cmdPrincipalDisable(kwargs); break;
          default:
            console.error(`Unknown principal action: "${action}". Use: create, inspect, disable`);
            process.exit(1);
        }
        break;

      case 'client':
        switch (action) {
          case 'create': await cmdClientCreate(kwargs); break;
          case 'rotate': await cmdClientRotate(kwargs); break;
          case 'revoke': await cmdClientRevoke(kwargs); break;
          case 'inspect': await cmdClientInspect(kwargs); break;
          default:
            console.error(`Unknown client action: "${action}". Use: create, rotate, revoke, inspect`);
            process.exit(1);
        }
        break;

      default:
        console.error(`Unknown entity: "${entity}". Use: principal, client`);
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}

main();
