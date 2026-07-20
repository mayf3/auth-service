#!/usr/bin/env node

/**
 * generate-fixture-jwt.mjs — Reproducible V1 Contract Fixture JWT Generator
 *
 * Generates an RS256-signed compact JWT for a V1 contract fixture.
 * Used to create deterministic fixture JWTs for the contract bundle.
 *
 * USAGE:
 *   node scripts/generate-fixture-jwt.mjs <fixture-claims.json>
 *
 * The fixture claims JSON file must contain:
 *   { "header": { "alg": "RS256", "kid": "..." },
 *     "claims": { ... },
 *     "output_jwk_file": "path/to/output/public-jwk.json" }
 *
 * Private keys are searched in the following order:
 *   1. tests/fixtures/keys/<kid>.pem
 *   2. scripts/fixture-keys/<kid>.pem
 * If found, the key is reused for deterministic output.
 * If not found, a new 2048-bit RSA key pair is generated and saved
 * to scripts/fixture-keys/<kid>.pem (gitignored).
 *
 * OUTPUT:
 *   - stdout: the compact JWT string
 *   - <output_jwk_file>: the public JWK fragment (append to fixtures/jwks.json)
 *   - scripts/fixture-keys/<kid>.pem: generated private key (if new)
 *
 * The script is deterministic when the same private key file exists.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function base64url(buf) {
  return buf.toString('base64url');
}

function encodeSegment(obj) {
  return base64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/generate-fixture-jwt.mjs <fixture-claims.json>');
    process.exit(1);
  }

  const fixturePath = path.resolve(args[0]);
  const spec = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const { header, claims, outputJwkFile } = spec;

  if (!header || !header.kid || !claims || !outputJwkFile) {
    console.error('Fixture spec requires: header.kid, claims, outputJwkFile');
    process.exit(1);
  }

  // Search for private key in priority order
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const searchPaths = [
    path.join(repoRoot, 'tests', 'fixtures', 'keys', `${header.kid}.pem`),
    path.join(scriptDir, 'fixture-keys', `${header.kid}.pem`),
  ];

  let privateKey;

  for (const keyPath of searchPaths) {
    if (fs.existsSync(keyPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf8');
      console.error(`[INFO] Using existing key: ${keyPath}`);
      break;
    }
  }

  if (!privateKey) {
    const autoDir = path.join(scriptDir, 'fixture-keys');
    fs.mkdirSync(autoDir, { recursive: true });
    const autoPath = path.join(autoDir, `${header.kid}.pem`);
    console.error(`[INFO] Generating new 2048-bit RSA key: ${header.kid}`);
    const { privateKey: pem } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = pem;
    fs.writeFileSync(autoPath, pem, { mode: 0o400 });
    console.error(`[INFO] Private key saved to ${autoPath}`);
  }

  // Build compact JWT
  const protectedSegment = encodeSegment(header);
  const payloadSegment = encodeSegment(claims);

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${protectedSegment}.${payloadSegment}`);
  const signature = sign.sign(privateKey);
  const signatureSegment = base64url(signature);

  const compactJwt = `${protectedSegment}.${payloadSegment}.${signatureSegment}`;

  // Extract public key as JWK
  const publicKey = crypto.createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' });

  // Write public JWK fragment
  const jwkOutput = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    use: 'sig',
    alg: 'RS256',
    kid: header.kid,
  };

  const outputPath = path.resolve(outputJwkFile);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(jwkOutput, null, 2) + '\n');

  // Output compact JWT to stdout
  process.stdout.write(compactJwt);

  console.error(`[INFO] Public JWK written to ${outputPath}`);
  console.error('[INFO] Generation complete.');
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
