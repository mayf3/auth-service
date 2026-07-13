/**
 * Tests for identity resolver (resolveCurrent, auditAll, planBootstrap, executeBootstrap, generateManifest).
 *
 * Each describe block gets a fresh fixture setup via before() and cleanup via after().
 * Individual tests within a describe block assume the before() state is intact,
 * so they should not mutate shared state unexpectedly.
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveCurrent,
  auditAll,
  planBootstrap,
  executeBootstrap,
  generateManifest,
} from '../../src/lib/identity/resolver.js';
import { resolveWorkspacePath } from '../../src/lib/identity/config.js';

// ── Fixture paths ─────────────────────────────────────────────────────────

const FIXTURES = join(import.meta.dirname, 'fixtures');
const TMP_ROOT = '/tmp/agent-identity-test';
const SIMPLE_CONFIG = join(FIXTURES, 'simple-config.json');
const ISSUES_CONFIG = join(FIXTURES, 'config-with-issues.json');
const TILDE_CONFIG = join(FIXTURES, 'config-tilde.json');

// Create a modified config with a custom workspace mapping for a test
const OVERRIDE_CONFIG_PATH = '/tmp/agent-identity-test-override-config.json';

// ── Test workspace setup helpers ──────────────────────────────────────────

function setupWorkspace(id: string, envContent?: string): string {
  const ws = join(TMP_ROOT, id);
  if (!existsSync(ws)) {
    mkdirSync(ws, { recursive: true });
  }
  if (envContent !== undefined) {
    writeFileSync(join(ws, '.env'), envContent, 'utf-8');
  }
  return ws;
}

function writeOverrideConfig(agents: any[]): void {
  const cfg = JSON.stringify({ agents: { list: agents } }, null, 2);
  writeFileSync(OVERRIDE_CONFIG_PATH, cfg, 'utf-8');
}

function teardownAll(): void {
  for (const p of [TMP_ROOT, OVERRIDE_CONFIG_PATH]) {
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('resolveCurrent', () => {
  before(() => {
    teardownAll();
    // blog-agent: correctly configured
    setupWorkspace('blog-agent', 'PLATFORM_AGENT_ID=blog-agent\nOTHER_VAR=secret\n');
    // research-agent: correct
    setupWorkspace('research-agent', 'PLATFORM_AGENT_ID=research-agent\n');
    // itops-agent: correct
    setupWorkspace('itops-agent', 'PLATFORM_AGENT_ID=itops-agent\n');
  });

  after(() => {
    teardownAll();
  });

  it('resolves identity when .env contains correct PLATFORM_AGENT_ID', () => {
    const result = resolveCurrent(join(TMP_ROOT, 'blog-agent'), SIMPLE_CONFIG);
    assert.equal(result.agent_id, 'blog-agent');
    assert.equal(result.workspace, join(TMP_ROOT, 'blog-agent'));
    assert.equal(result.source, 'workspace-env-verified-by-openclaw-config');
    assert.equal(result.verified, true);
    assert.equal(result.issues, undefined);
  });

  it('fails when .env does not exist (workspace IS in config)', () => {
    // The blog-agent workspace IS in config but we'll simulate missing .env
    // by creating a new workspace that IS mapped via override config
    const ws = join(TMP_ROOT, 'no-env-mapped-agent');
    setupWorkspace('no-env-mapped-agent');
    writeOverrideConfig([{
      id: 'no-env-agent',
      name: 'No Env Agent',
      workspace: ws,
      enabled: true,
    }]);

    assert.throws(
      () => resolveCurrent(ws, OVERRIDE_CONFIG_PATH),
      /\.env not found/,
    );
  });

  it('fails when PLATFORM_AGENT_ID is missing from .env', () => {
    const ws = join(TMP_ROOT, 'missing-plaid-agent');
    setupWorkspace('missing-plaid-agent', 'OTHER_VAR=hello\n');
    writeOverrideConfig([{
      id: 'missing-plaid-agent',
      name: 'Missing Plaid',
      workspace: ws,
      enabled: true,
    }]);

    assert.throws(
      () => resolveCurrent(ws, OVERRIDE_CONFIG_PATH),
      /PLATFORM_AGENT_ID not found/,
    );
  });

  it('fails when agent ID does not exist in config', () => {
    const ws = join(TMP_ROOT, 'unknown-agent');
    setupWorkspace('unknown-agent', 'PLATFORM_AGENT_ID=unknown-agent\n');
    assert.throws(
      () => resolveCurrent(ws, SIMPLE_CONFIG),
      /No agent configured/,
    );
  });

  it('fails when PLATFORM_AGENT_ID does not match config', () => {
    const ws = join(TMP_ROOT, 'mismatch-agent');
    setupWorkspace('mismatch-agent', 'PLATFORM_AGENT_ID=mismatch-value\n');
    writeOverrideConfig([{
      id: 'mismatch-agent',
      name: 'Mismatch Test',
      workspace: ws,
      enabled: true,
    }]);

    assert.throws(
      () => resolveCurrent(ws, OVERRIDE_CONFIG_PATH),
      /mismatch/,
    );
  });

  it('fails on workspace conflict (multiple enabled agents sharing same workspace)', () => {
    assert.throws(
      () => resolveCurrent(join(TMP_ROOT, 'blog-agent'), ISSUES_CONFIG),
      /shared by multiple|conflict/,
    );
  });

  it('fails on invalid agent ID format (starts with hyphen)', () => {
    const ws = join(TMP_ROOT, 'invalid-agent');
    setupWorkspace('invalid-agent', 'PLATFORM_AGENT_ID=-invalid-agent-id\n');
    assert.throws(
      () => resolveCurrent(ws, ISSUES_CONFIG),
      /format invalid|must start with a lowercase letter or digit/,
    );
  });

  it('does not output secret values in error messages', () => {
    const ws = join(TMP_ROOT, 'secret-leak-test');
    setupWorkspace('secret-leak-test',
      'PLATFORM_AGENT_ID=blog-agent\nSECRET_TOKEN=s3cr3t\n',
    );
    try {
      resolveCurrent(ws, SIMPLE_CONFIG);
    } catch (err: any) {
      assert.ok(!err.message.includes('s3cr3t'),
        'Error message leaked secret: ' + err.message);
    }
  });
});

describe('auditAll', () => {
  before(() => {
    teardownAll();
    setupWorkspace('blog-agent', 'PLATFORM_AGENT_ID=blog-agent\n');
    setupWorkspace('research-agent', 'PLATFORM_AGENT_ID=research-agent\n');
    setupWorkspace('itops-agent', '');  // .env exists but no PLATFORM_AGENT_ID
  });

  after(() => {
    teardownAll();
  });

  it('produces audit summary with correct counts', () => {
    const result = auditAll(SIMPLE_CONFIG);
    assert.equal(result.version, 1);
    assert.equal(result.total_agents, 3);
    assert.equal(result.enabled_agents, 3);
    assert.equal(result.agent_entries.length, 3);
  });

  it('identifies missing PLATFORM_AGENT_ID', () => {
    const result = auditAll(SIMPLE_CONFIG);
    const itops = result.agent_entries.find((e) => e.agent_id === 'itops-agent');
    assert.ok(itops);
    assert.equal(itops.has_platform_agent_id, false);
    assert.ok(itops.issues.some((i) => i.includes('PLATFORM_AGENT_ID missing')));
  });

  it('detects valid agent ID format', () => {
    const result = auditAll(SIMPLE_CONFIG);
    for (const entry of result.agent_entries) {
      assert.equal(entry.id_format_valid, true);
    }
  });

  it('detects invalid agent ID format with issues config', () => {
    const result = auditAll(ISSUES_CONFIG);
    const badId = result.agent_entries.find((e) => e.agent_id === '-invalid-agent-id');
    assert.ok(badId);
    assert.equal(badId.id_format_valid, false);
    assert.ok(badId.id_format_issues.length > 0);
  });

  it('reports workspace conflicts', () => {
    const result = auditAll(ISSUES_CONFIG);
    assert.ok(result.workspace_conflicts.length > 0);
    assert.equal(result.blocked, true);
  });
});

describe('planBootstrap', () => {
  before(() => {
    teardownAll();
    setupWorkspace('blog-agent', 'PLATFORM_AGENT_ID=blog-agent\n');
    setupWorkspace('research-agent', 'OTHER_VAR=hello\n');
    setupWorkspace('itops-agent');
  });

  after(() => {
    teardownAll();
  });

  it('categorizes actions correctly', () => {
    const plan = planBootstrap(SIMPLE_CONFIG);
    assert.equal(plan.total_agents, 3);
    assert.equal(plan.version, 1);

    const blog = plan.actions.find((a) => a.agent_id === 'blog-agent');
    assert.equal(blog?.action, 'skip');

    const research = plan.actions.find((a) => a.agent_id === 'research-agent');
    assert.equal(research?.action, 'add');

    const itops = plan.actions.find((a) => a.agent_id === 'itops-agent');
    assert.equal(itops?.action, 'add');
  });

  it('can_apply is true when no blockers', () => {
    const plan = planBootstrap(SIMPLE_CONFIG);
    assert.equal(plan.can_apply, true);
  });

  it('can_apply is false when conflicts exist', () => {
    const plan = planBootstrap(ISSUES_CONFIG);
    assert.equal(plan.can_apply, false);
    assert.ok(plan.blockers.length > 0);
  });

  it('dry-run does not modify any files', () => {
    const beforeContent = readFileSync(
      join(TMP_ROOT, 'blog-agent', '.env'), 'utf-8',
    );
    planBootstrap(SIMPLE_CONFIG);
    const afterContent = readFileSync(
      join(TMP_ROOT, 'blog-agent', '.env'), 'utf-8',
    );
    assert.equal(beforeContent, afterContent);
  });
});

describe('executeBootstrap', () => {
  beforeEach(() => {
    teardownAll();
    // Fresh setup for each test to avoid cross-contamination
    setupWorkspace('blog-agent', 'PLATFORM_AGENT_ID=blog-agent\nOTHER_VAR=keep_me\n');
    setupWorkspace('research-agent', 'API_KEY=abc123\nDB_URL=postgres://localhost\n');
    setupWorkspace('itops-agent');
  });

  afterEach(() => {
    teardownAll();
  });

  it('skips already-correct agents', () => {
    const result = executeBootstrap(SIMPLE_CONFIG);
    const blog = result.modifications.find((m) => m.agent_id === 'blog-agent');
    assert.equal(blog?.action, 'skipped');
  });

  it('adds PLATFORM_AGENT_ID to existing .env preserving other content', () => {
    const result = executeBootstrap(SIMPLE_CONFIG);
    const research = result.modifications.find(
      (m) => m.agent_id === 'research-agent',
    );
    assert.equal(research?.action, 'added');

    const envContent = readFileSync(
      join(TMP_ROOT, 'research-agent', '.env'), 'utf-8',
    );
    assert.ok(envContent.includes('API_KEY=abc123'));
    assert.ok(envContent.includes('DB_URL=postgres://localhost'));
    assert.ok(envContent.includes('PLATFORM_AGENT_ID=research-agent'));
  });

  it('creates .env for agents without one', () => {
    const result = executeBootstrap(SIMPLE_CONFIG);
    const itops = result.modifications.find((m) => m.agent_id === 'itops-agent');
    assert.equal(itops?.action, 'added');

    const envContent = readFileSync(
      join(TMP_ROOT, 'itops-agent', '.env'), 'utf-8',
    );
    assert.equal(envContent.trim(), 'PLATFORM_AGENT_ID=itops-agent');
  });

  it('creates .env.bak backup before modification', () => {
    // Create a custom config with a single agent for clean isolation
    const ws = join(TMP_ROOT, 'backup-test');
    setupWorkspace('backup-test', 'EXISTING_VAR=hello\n');
    writeOverrideConfig([{
      id: 'backup-test',
      name: 'Backup Test',
      workspace: ws,
      enabled: true,
    }]);

    const result = executeBootstrap(OVERRIDE_CONFIG_PATH);
    const mod = result.modifications.find((m) => m.agent_id === 'backup-test');
    assert.ok(mod?.backup_path, 'Backup path should be set');
    assert.ok(existsSync(mod.backup_path!), 'Backup file should exist on disk');
  });

  it('is idempotent — second run skips all', () => {
    executeBootstrap(SIMPLE_CONFIG);
    const result = executeBootstrap(SIMPLE_CONFIG);
    assert.equal(result.modified, 0);
    assert.ok(result.modifications.every((m) => m.action === 'skipped'));
  });

  it('is blocked when conflicts exist', () => {
    const result = executeBootstrap(ISSUES_CONFIG);
    assert.equal(result.blocked, true);
    assert.ok(result.errors.length > 0);
  });
});

// ── HIGH-05 reproduction: plan says "update" but atomicSetPlatformAgentId rejects it ──

describe('HIGH-05 plan/apply inconsistency', () => {
  beforeEach(() => {
    teardownAll();
  });

  afterEach(() => {
    teardownAll();
  });

  it('HIGH-05 FIXED: conflict value shows as conflict/blocked, plan+apply consistent', () => {
    // Setup: agent exists in config, .env has a DIFFERENT PLATFORM_AGENT_ID
    const ws = join(TMP_ROOT, 'conflict-workspace');
    setupWorkspace(
      'conflict-workspace',
      'PLATFORM_AGENT_ID=wrong-value\nOTHER_VAR=preserve-me\n',
    );
    writeOverrideConfig([{
      id: 'correct-agent',
      name: 'Correct Agent',
      workspace: ws,
      enabled: true,
    }]);

    // ── PLAN side: must be conflict, NOT update ──
    const plan = planBootstrap(OVERRIDE_CONFIG_PATH);

    assert.equal(plan.actions[0]?.action, 'conflict',
      'Plan should classify value mismatch as conflict');
    assert.equal(plan.can_apply, false,
      'can_apply must be false when conflicts exist');
    assert.equal(plan.summary.conflict, 1,
      'Summary should report 1 conflict');
    assert.equal(plan.summary.update, 0,
      'update count must be 0 (reserved — never generated)');

    // ── APPLY side: must be blocked, not modify files ──
    const result = executeBootstrap(OVERRIDE_CONFIG_PATH);

    assert.equal(result.blocked, true,
      'Apply must be blocked when conflicts exist');
    assert.ok(result.errors.length > 0,
      'Should report errors');
    assert.ok(result.errors.some((e) => e.includes('mismatch')),
      'Error should mention mismatch');

    // ── FILE INTEGRITY: content must NOT be changed ──
    const content = readFileSync(join(ws, '.env'), 'utf-8');
    assert.ok(content.includes('PLATFORM_AGENT_ID=wrong-value'),
      'File should still have the original wrong value');
    assert.ok(content.includes('OTHER_VAR=preserve-me'),
      'Other .env content should be preserved');
  });
});

describe('generateManifest', () => {
  it('produces consistent manifest from config', () => {
    const manifest = generateManifest(SIMPLE_CONFIG);
    assert.equal(manifest.version, 1);
    assert.equal(manifest.agents.length, 3);
    assert.equal(manifest.agents[0].agent_id, 'blog-agent');
    assert.equal(manifest.agents[0].status, 'enabled');
  });

  it('is stable (same config produces same result)', () => {
    const m1 = generateManifest(SIMPLE_CONFIG);
    const m2 = generateManifest(SIMPLE_CONFIG);
    assert.equal(m1.agents.length, m2.agents.length);
    m1.agents.forEach((a, i) => {
      assert.equal(a.agent_id, m2.agents[i].agent_id);
      assert.equal(a.workspace, m2.agents[i].workspace);
    });
  });
});

describe('config module', () => {
  it('resolves tilde workspace paths', () => {
    const config = JSON.parse(readFileSync(TILDE_CONFIG, 'utf-8'));
    const agent = config.agents.list[0];
    const resolved = resolveWorkspacePath(agent.workspace);
    assert.ok(!resolved.startsWith('~'), 'Tilde should be resolved');
    assert.ok(resolved.startsWith('/'), 'Resolved path should be absolute');
    assert.ok(resolved.includes('.openclaw'));
  });

  it('handles paths with spaces and special characters', () => {
    const resolveWithSpace = resolveWorkspacePath('/tmp/my workspace');
    assert.equal(resolveWithSpace, '/tmp/my workspace');

    const resolveWithUnicode = resolveWorkspacePath('/tmp/测试目录');
    assert.equal(resolveWithUnicode, '/tmp/测试目录');
  });
});
