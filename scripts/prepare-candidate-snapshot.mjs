#!/usr/bin/env node

/**
 * prepare-candidate-snapshot.mjs — Draft Contract Candidate Runtime Snapshot Generator
 *
 * Generates a runtime-contract.json snapshot from a DRAFT (unfrozen)
 * Minimal Auth V1 Bundle for Candidate testing.
 *
 * Unlike the official prepare-minimal-auth-v1.mjs, this script does NOT
 * require the Bundle to be frozen/implementation-authorized.
 *
 * The output is written to a SEPARATE candidate directory so it never
 * overwrites the official runtime snapshot.
 *
 * USAGE:
 *   node scripts/prepare-candidate-snapshot.mjs
 *
 * OUTPUT:
 *   generated/candidate-snapshots/minimal-auth-v1/runtime-contract.json
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const bundleDir = path.join(repoRoot, 'contract-bundles', 'minimal-auth-v1');
const outputDir = path.join(repoRoot, 'generated', 'candidate-snapshots', 'minimal-auth-v1');
const outputFile = path.join(outputDir, 'runtime-contract.json');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(bundleDir, relativePath), 'utf8'));
}

function listFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolute, relative) : [relative];
    })
    .sort();
}

function hashBundle() {
  const hash = crypto.createHash('sha256');
  for (const relativePath of listFiles(bundleDir)) {
    hash.update(relativePath, 'utf8');
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(bundleDir, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

// ── Run bundle validation (validate.mjs already handles draft bundles) ──
const validation = spawnSync(
  process.execPath,
  [path.join(bundleDir, 'validate.mjs')],
  { cwd: repoRoot, encoding: 'utf8' },
);
if (validation.stdout) process.stdout.write(validation.stdout);
if (validation.stderr) process.stderr.write(validation.stderr);
if (validation.status !== 0) process.exit(validation.status ?? 1);

// ── Read manifest and registry ──
const manifest = readJson('contract-manifest.json');
const audienceRegistry = readJson('audience-registry.json');
const freeze = manifest.lifecycle?.contract_bundle_freeze;

// ── Build runtime snapshot payload ──
const payload = {
  formatVersion: 1,
  contractVersion: manifest.contract_version,
  reviewedSourceGitCommit: freeze?.reviewed_source_git_commit ?? null,
  sourceBundleDigest: hashBundle(),
  manifest,
  audienceRegistry,
};
const serializedPayload = JSON.stringify(payload);
const runtimeDigest = crypto.createHash('sha256').update(serializedPayload).digest('hex');

// ── Write candidate snapshot ──
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify({ payload, runtimeDigest }, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o444,
});
console.log(`MINIMAL_AUTH_V1_CANDIDATE_SNAPSHOT=${outputFile}`);
console.log(`MINIMAL_AUTH_V1_SOURCE_BUNDLE_DIGEST=${payload.sourceBundleDigest}`);
console.log(`MINIMAL_AUTH_V1_RUNTIME_DIGEST=${runtimeDigest}`);
