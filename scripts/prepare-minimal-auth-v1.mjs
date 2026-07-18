import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const bundleDir = path.join(repoRoot, 'contract-bundles', 'minimal-auth-v1');
const outputDir = path.join(repoRoot, 'generated', 'minimal-auth-v1');
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

const validation = spawnSync(
  process.execPath,
  [path.join(bundleDir, 'validate.mjs')],
  { cwd: repoRoot, encoding: 'utf8' },
);
if (validation.stdout) process.stdout.write(validation.stdout);
if (validation.stderr) process.stderr.write(validation.stderr);
if (validation.status !== 0) process.exit(validation.status ?? 1);

const manifest = readJson('contract-manifest.json');
const audienceRegistry = readJson('audience-registry.json');
const freeze = manifest.lifecycle?.contract_bundle_freeze;
if (freeze?.status !== 'frozen' || freeze.frozen !== true
  || freeze.implementation_authorized !== true) {
  throw new Error('Minimal Auth V1 runtime snapshot requires a frozen, implementation-authorized Bundle.');
}

const payload = {
  formatVersion: 1,
  contractVersion: manifest.contract_version,
  reviewedSourceGitCommit: freeze.reviewed_source_git_commit,
  sourceBundleDigest: hashBundle(),
  manifest,
  audienceRegistry,
};
const serializedPayload = JSON.stringify(payload);
const runtimeDigest = crypto.createHash('sha256').update(serializedPayload).digest('hex');

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify({ payload, runtimeDigest }, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o444,
});
console.log(`MINIMAL_AUTH_V1_RUNTIME_SNAPSHOT=${outputFile}`);
console.log(`MINIMAL_AUTH_V1_SOURCE_BUNDLE_DIGEST=${payload.sourceBundleDigest}`);
console.log(`MINIMAL_AUTH_V1_RUNTIME_DIGEST=${runtimeDigest}`);
