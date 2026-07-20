# Test-Only Fixture Keys

## WARNING: TEST ONLY — NEVER USE IN PRODUCTION

The keys in this directory are **public test material** for V1 Contract fixture JWT generation.

- `svc-okr-canary-test-private.pem` — RSA 2048-bit private key (PKCS#8)
- `svc-okr-canary-test-public.jwk.json` — Corresponding public key (JWK format)

## Purpose

These keys generate deterministic RS256-signed fixture JWTs for the `direct-agent-svc-okr`
test fixture and its negative test cases.

## Security

- These are **test-only keys** generated specifically for the Contract Bundle fixture suite.
- They are **never used** by production auth-service signing, JWKS endpoints, or any
  runtime configuration.
- The private key is committed as public test material to enable independent audit
  reproducibility.
- In production, the auth-service uses a separate, secure key management process.

## Regeneration

To regenerate fixture JWTs:

```bash
node scripts/generate-fixture-jwt.mjs scripts/fixture-specs/svc-okr-direct-agent.json
```

The private key file is searched in this directory (`tests/fixtures/keys/`) by kid name.
