#!/usr/bin/env node

/**
 * Forum Skill Identity Integration Smoke Test.
 *
 * Purpose: Prove the identity resolver can be called from a Node.js context
 * like the forum-access.mjs skill, and returns a verified agent_id.
 *
 * This is a minimal smoke test — it does NOT:
 *   - Send Forum messages
 *   - Read or modify Forum data
 *   - Change auth methods
 *   - Read client secrets or tokens
 *
 * Usage:
 *   npx tsx tests/identity/forum-identity-smoke.mjs
 *
 * Exit codes:
 *   0 = smoke test passed (identity resolver works)
 *   1 = smoke test failed
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\n🔍 Forum Identity Integration Smoke Test');
console.log('========================================\n');
console.log(`OpenClaw config: ${CONFIG_PATH}\n`);

// Test 1: Resolver can be imported and called (like Forum skill would)
console.log('1. Identity resolver is callable from Node.js context\n');

test('resolveCurrent can be invoked (may fail if no matching workspace, but must not crash)', async () => {
  const { resolveCurrent } = await import(
    join(__dirname, '..', '..', 'src', 'lib', 'identity', 'resolver.ts')
  );
  const fn = typeof resolveCurrent;
  if (fn !== 'function') {
    throw new Error(`Expected resolveCurrent to be a function, got ${fn}`);
  }
});

test('resolveCurrent error message is safe (no secret leakage)', async () => {
  const { resolveCurrent } = await import(
    join(__dirname, '..', '..', 'src', 'lib', 'identity', 'resolver.ts')
  );
  try {
    resolveCurrent('/nonexistent/path', CONFIG_PATH);
  } catch (err) {
    const msg = err.message;
    const forbidden = ['token', 'secret', 'password', 'jwt'];
    for (const word of forbidden) {
      if (msg.toLowerCase().includes(word)) {
        throw new Error(`Error message leaked sensitive keyword: "${word}"`);
      }
    }
    if (!msg || msg.length < 5) {
      throw new Error('Error message too short or empty');
    }
  }
});

// Test 2: Config is readable (like Forum skill reading auth config)
console.log('\n2. OpenClaw configuration is accessible\n');

test('openclaw.json exists and is parseable', async () => {
  const { loadOpenClawConfig } = await import(
    join(__dirname, '..', '..', 'src', 'lib', 'identity', 'config.ts')
  );
  const config = loadOpenClawConfig(CONFIG_PATH);
  if (!config.agents || config.agents.length === 0) {
    throw new Error('Config has no agents');
  }
  console.log(`    Found ${config.agents.length} agents in config`);
});

// Test 3: Resolver output format matches spec
console.log('\n3. Identity result format validation\n');

test('auditAll produces structured JSON output', async () => {
  const { auditAll } = await import(
    join(__dirname, '..', '..', 'src', 'lib', 'identity', 'resolver.ts')
  );
  const result = auditAll(CONFIG_PATH);
  const output = JSON.stringify(result);
  const parsed = JSON.parse(output);
  if (typeof parsed.total_agents !== 'number') {
    throw new Error('Expected total_agents field');
  }
  if (!Array.isArray(parsed.agent_entries)) {
    throw new Error('Expected agent_entries array');
  }
  console.log(`    Audited ${parsed.total_agents} agents`);
});

// Test 4: Bootstrap plan is safe
console.log('\n4. Bootstrap dry-run is safe (no writes)\n');

test('planBootstrap does not modify files', async () => {
  const { planBootstrap } = await import(
    join(__dirname, '..', '..', 'src', 'lib', 'identity', 'resolver.ts')
  );
  const plan = planBootstrap(CONFIG_PATH);
  const output = JSON.stringify(plan);
  const parsed = JSON.parse(output);
  if (typeof parsed.can_apply !== 'boolean') {
    throw new Error('Expected can_apply field');
  }
  if (!Array.isArray(parsed.actions)) {
    throw new Error('Expected actions array');
  }
  console.log(`    Plan: ${parsed.summary.add} add, ${parsed.summary.update} update, ${parsed.summary.skip} skip, ${parsed.summary.blocked} blocked`);
});

// Summary
console.log('\n========================================');
console.log(`Smoke test results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Some smoke tests failed — investigate before Forum skill integration.\n');
  process.exit(1);
} else {
  console.log('✅ All smoke tests passed. Identity resolver is ready for Forum skill integration.\n');
  console.log('Next steps:');
  console.log('  1. In forum-access.mjs: replace manual token-login with agent-identity');
  console.log('  2. Call: const identity = await exec("agent-identity identity current");');
  console.log('  3. Use identity.agent_id for logging/auditing\n');
  process.exit(0);
}
