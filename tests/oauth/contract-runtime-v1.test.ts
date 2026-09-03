import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  initializeAuthContract,
  resetAuthContractForTests,
  verifyRuntimeSnapshot,
} from '../../src/lib/oauth/v1/contract.js';

const snapshotFile = path.resolve(
  process.cwd(),
  'generated',
  'minimal-auth-v1',
  'runtime-contract.json',
);

test('v0 mode does not claim a V1 runtime contract', () => {
  assert.deepEqual(initializeAuthContract('v0'), {
    mode: 'v0',
    contractVersion: null,
    sourceBundleDigest: null,
    runtimeDigest: null,
  });
});

test('v1 mode loads the frozen implementation-authorized snapshot', () => {
  resetAuthContractForTests();
  const identity = initializeAuthContract('v1');
  assert.equal(identity.mode, 'v1');
  assert.equal(identity.contractVersion, '1.6.0');
  assert.match(identity.sourceBundleDigest ?? '', /^[0-9a-f]{64}$/);
  assert.match(identity.runtimeDigest ?? '', /^[0-9a-f]{64}$/);
});

test('runtime snapshot rejects content changed without a new digest', () => {
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  snapshot.payload.contractVersion = 'tampered';
  assert.throws(
    () => verifyRuntimeSnapshot(snapshot),
    /digest mismatch/,
  );
});

test('runtime snapshot rejects an internally consistent unsupported version', () => {
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  snapshot.payload.contractVersion = '2.0.0';
  snapshot.runtimeDigest = crypto.createHash('sha256')
    .update(JSON.stringify(snapshot.payload))
    .digest('hex');
  assert.throws(
    () => verifyRuntimeSnapshot(snapshot),
    /version is unsupported/,
  );
});
