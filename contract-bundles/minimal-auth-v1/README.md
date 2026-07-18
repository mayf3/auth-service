# Minimal Auth V1 Contract Bundle

## Status

```text
BUNDLE_STATUS=DRAFT
CONTRACT_VERSION=1.0.0-draft.1
FROZEN=false
IMPLEMENTATION_AUTHORIZED=false
```

This directory is the machine-executable companion to
`docs/contracts/minimal-auth-v1/`. It makes unresolved freeze decisions visible
instead of filling them with deployment guesses.

The validator is intentionally useful before freeze. It proves that:

- the manifest and registry are internally consistent;
- token fixtures obey the V1 profiles and strict Scope wire format;
- negative fixtures are rejected for the declared reason;
- required schemas and metadata exist;
- `frozen=true` is impossible while any freeze gate remains open.

It does **not** prove that an issuer, database migration, resource service or
deployment conforms. Real-process acceptance remains governed by
`docs/contracts/minimal-auth-v1/conformance.md`.

## Contents

| Artifact | Purpose |
|---|---|
| `contract-manifest.json` | Candidate exact protocol and runtime parameters |
| `audience-registry.json` | Candidate resource audiences, namespaces and profiles |
| `schemas/` | JSON Schema 2020-12 contracts for tokens, grants, proxy, audit, OAuth and sessions |
| `fixtures/` | Public JWKS plus positive and negative profile fixtures |
| `metadata/` | Freeze gates, consumer SHA matrix and change log |
| `validate.mjs` | Dependency-free bundle and fixture validator |

## Validate

```bash
npm run contract:v1:validate
```

Expected result for this draft:

```text
MINIMAL_AUTH_V1_BUNDLE_VALID=true
CONTRACT_BUNDLE_FROZEN=false
FREEZE_BLOCKER_COUNT>0
```

The command exits non-zero for malformed artifacts, a fixture expectation
mismatch, or any attempt to set `frozen=true` before all gates are closed.

## Freeze rule

Freeze requires one review commit that:

1. closes every gate in `metadata/freeze-gates.json` with evidence;
2. replaces candidate/unresolved runtime values with reviewed exact values;
3. fixes every in-scope implementation and consumer to a remote full SHA;
4. reruns this validator and the narrow contract review;
5. changes `bundle_status` to `frozen` and `frozen` to `true` in one commit.

Changing a frozen artifact requires a Contract Change Request. Editing only a
fixture or consumer implementation cannot silently change the contract.
