/**
 * Tests for .env file operations (readEnvFile, atomicSetPlatformAgentId, backup, restore).
 *
 * All tests use /tmp/agent-identity-test-env to avoid contaminating real workspaces.
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, statSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  readEnvFile,
  atomicSetPlatformAgentId,
  backupEnvFile,
  restoreFromBackup,
  envHasCorrectValue,
} from '../../src/lib/identity/env-file.js';

const TMP_ROOT = '/tmp/agent-identity-test-env';

function setup(id: string, content?: string): string {
  const ws = join(TMP_ROOT, id);
  if (!existsSync(ws)) {
    mkdirSync(ws, { recursive: true });
  }
  if (content !== undefined) {
    writeFileSync(join(ws, '.env'), content, 'utf-8');
  }
  return ws;
}

function teardownAll(): void {
  if (existsSync(TMP_ROOT)) {
    rmSync(TMP_ROOT, { recursive: true, force: true });
  }
}

describe('readEnvFile', () => {
  before(() => teardownAll());
  after(() => teardownAll());

  it('reports missing .env', () => {
    const ws = setup('no-env');
    const result = readEnvFile(ws);
    assert.equal(result.exists, false);
    assert.equal(result.hasPlatformAgentId, false);
    assert.equal(result.platformAgentId, null);
  });

  it('extracts PLATFORM_AGENT_ID when present', () => {
    const ws = setup('with-plaid', 'PLATFORM_AGENT_ID=blog-agent\nOTHER=secret\n');
    const result = readEnvFile(ws);
    assert.equal(result.exists, true);
    assert.equal(result.hasPlatformAgentId, true);
    assert.equal(result.platformAgentId, 'blog-agent');
  });

  it('reports absence when PLATFORM_AGENT_ID is missing', () => {
    const ws = setup('without-plaid', 'API_KEY=abc123\nDB_URL=postgres://localhost\n');
    const result = readEnvFile(ws);
    assert.equal(result.exists, true);
    assert.equal(result.hasPlatformAgentId, false);
    assert.equal(result.platformAgentId, null);
  });

  it('does not expose other variable values', () => {
    const ws = setup('secret-check',
      'PLATFORM_AGENT_ID=test-agent\nSECRET=s3cr3t-value\nPASSWORD=my-password\n',
    );
    const result = readEnvFile(ws);
    assert.equal(result.platformAgentId, 'test-agent');
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('s3cr3t-value'), 'Should not leak SECRET');
    assert.ok(!serialized.includes('my-password'), 'Should not leak PASSWORD');
  });
});

describe('atomicSetPlatformAgentId', () => {
  before(() => teardownAll());
  after(() => teardownAll());

  it('creates .env when it does not exist', () => {
    const ws = setup('create-env');
    const modified = atomicSetPlatformAgentId(ws, 'new-agent');
    assert.equal(modified, true);

    const content = readFileSync(join(ws, '.env'), 'utf-8');
    assert.equal(content.trim(), 'PLATFORM_AGENT_ID=new-agent');
  });

  it('sets 0600 permissions on new .env file', () => {
    const ws = setup('perm-check');
    atomicSetPlatformAgentId(ws, 'perm-agent');
    const st = statSync(join(ws, '.env'));
    const mode = st.mode & 0o777;
    assert.ok(mode <= 0o600,
      `Expected mode <= 600, got ${mode.toString(8)}`);
  });

  it('adds PLATFORM_AGENT_ID to existing .env preserving other content', () => {
    const ws = setup('preserve-env', 'EXISTING_VAR=hello\nANOTHER=world\n');
    atomicSetPlatformAgentId(ws, 'preserve-agent');

    const content = readFileSync(join(ws, '.env'), 'utf-8');
    assert.ok(content.includes('EXISTING_VAR=hello'), 'Existing var preserved');
    assert.ok(content.includes('ANOTHER=world'), 'Another var preserved');
    assert.ok(content.includes('PLATFORM_AGENT_ID=preserve-agent'),
      'New var added');
  });

  it('updates existing PLATFORM_AGENT_ID when value matches (no-op)', () => {
    const ws = setup('already-correct',
      'PLATFORM_AGENT_ID=correct-agent\nOTHER=val\n',
    );
    const modified = atomicSetPlatformAgentId(ws, 'correct-agent');
    assert.equal(modified, false);
    const content = readFileSync(join(ws, '.env'), 'utf-8');
    assert.equal(content, 'PLATFORM_AGENT_ID=correct-agent\nOTHER=val\n');
  });

  it('throws on conflict (existing value differs)', () => {
    const ws = setup('conflict-env', 'PLATFORM_AGENT_ID=wrong-agent\n');
    assert.throws(
      () => atomicSetPlatformAgentId(ws, 'expected-agent'),
      /CONFLICT/,
    );
    const content = readFileSync(join(ws, '.env'), 'utf-8');
    assert.equal(content.trim(), 'PLATFORM_AGENT_ID=wrong-agent');
  });

  it('is idempotent — second call returns false', () => {
    const ws = setup('idempotent-env');
    atomicSetPlatformAgentId(ws, 'idempotent-agent');
    const modified = atomicSetPlatformAgentId(ws, 'idempotent-agent');
    assert.equal(modified, false);
  });
});

describe('backup and restore', () => {
  let ws: string;

  beforeEach(() => {
    ws = setup('backup-restore',
      'PLATFORM_AGENT_ID=original\nOTHER=keep\n');
  });

  afterEach(() => {
    if (existsSync(join(TMP_ROOT, 'backup-restore'))) {
      rmSync(join(TMP_ROOT, 'backup-restore'), { recursive: true, force: true });
    }
  });

  it('creates .env.bak backup', () => {
    const bakPath = backupEnvFile(ws);
    assert.ok(bakPath);
    assert.ok(existsSync(bakPath!));
    const bakContent = readFileSync(bakPath!, 'utf-8');
    assert.ok(bakContent.includes('PLATFORM_AGENT_ID=original'));
  });

  it('restores from backup after direct modification', () => {
    backupEnvFile(ws);

    // Write a modified .env directly (bypass atomicSet to avoid conflict check)
    writeFileSync(join(ws, '.env'),
      'PLATFORM_AGENT_ID=modified-value\nOTHER=changed\n', 'utf-8');

    const restored = restoreFromBackup(ws);
    assert.equal(restored, true);

    const content = readFileSync(join(ws, '.env'), 'utf-8');
    assert.ok(content.includes('PLATFORM_AGENT_ID=original'));
    assert.ok(content.includes('OTHER=keep'));
  });

  it('returns null for backup when .env does not exist', () => {
    rmSync(join(ws, '.env'));
    const bakPath = backupEnvFile(ws);
    assert.equal(bakPath, null);
  });
});

describe('envHasCorrectValue', () => {
  before(() => teardownAll());
  after(() => teardownAll());

  it('returns true when value matches', () => {
    const ws = setup('match-env', 'PLATFORM_AGENT_ID=test-agent\n');
    assert.equal(envHasCorrectValue(ws, 'test-agent'), true);
  });

  it('returns false when value differs', () => {
    const ws = setup('mismatch-env', 'PLATFORM_AGENT_ID=other\n');
    assert.equal(envHasCorrectValue(ws, 'expected'), false);
  });

  it('returns false when .env does not exist', () => {
    const ws = setup('missing-env');
    assert.equal(envHasCorrectValue(ws, 'anything'), false);
  });
});
