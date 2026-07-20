/**
 * Verifies that the contract bundle SOURCE_BUNDLE_DIGEST is reproducible.
 *
 * This runs the repo's official prepare script and confirms the digest output
 * matches the expected value. Two consecutive runs must produce the same result.
 *
 * NOTE: This test only applies to FROZEN contracts. When the contract bundle
 * is in DRAFT status, the official prepare script correctly rejects it and
 * this test is skipped. The draft candidate digest is verified separately via
 * `npm run contract:v1:candidate`.
 */

import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..',
);
const PREPARE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'prepare-minimal-auth-v1.mjs');

const EXPECTED_SOURCE_BUNDLE_DIGEST = '6535dc5983d52eaa6c5077c9331e2b01647ab9d5268f4f5aab2599125c01b371';

/**
 * Skip digest tests when the contract bundle is in DRAFT state.
 * The official prepare script only accepts FROZEN bundles, so digest
 * reproducibility is only verified for frozen contracts.
 */
function isBundleFrozen(): boolean {
  try {
    const manifestPath = path.join(REPO_ROOT, 'contract-bundles', 'minimal-auth-v1', 'contract-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest?.lifecycle?.contract_bundle_freeze?.frozen === true;
  } catch {
    return false;
  }
}

test('SOURCE_BUNDLE_DIGEST is reproducible (run 1)', () => {
  if (!isBundleFrozen()) {
    return; // Skip for draft bundles — digest verified via candidate pipeline
  }
  const output = execSync(
    `${process.execPath} ${JSON.stringify(PREPARE_SCRIPT)}`,
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  const match = output.match(/MINIMAL_AUTH_V1_SOURCE_BUNDLE_DIGEST=([a-f0-9]+)/);
  assert.ok(match, 'Could not parse SOURCE_BUNDLE_DIGEST from script output');
  assert.equal(match[1], EXPECTED_SOURCE_BUNDLE_DIGEST,
    `SOURCE_BUNDLE_DIGEST mismatch: got ${match[1]}, expected ${EXPECTED_SOURCE_BUNDLE_DIGEST}`);
});

test('SOURCE_BUNDLE_DIGEST is reproducible (run 2)', () => {
  if (!isBundleFrozen()) {
    return; // Skip for draft bundles — digest verified via candidate pipeline
  }
  const output = execSync(
    `${process.execPath} ${JSON.stringify(PREPARE_SCRIPT)}`,
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  const match = output.match(/MINIMAL_AUTH_V1_SOURCE_BUNDLE_DIGEST=([a-f0-9]+)/);
  assert.ok(match, 'Could not parse SOURCE_BUNDLE_DIGEST from script output');
  assert.equal(match[1], EXPECTED_SOURCE_BUNDLE_DIGEST,
    `SOURCE_BUNDLE_DIGEST mismatch on run 2: got ${match[1]}, expected ${EXPECTED_SOURCE_BUNDLE_DIGEST}`);
});
