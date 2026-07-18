# Minimal Auth V1 Contract Bundle

## Status

```text
CONTRACT_VERSION=1.0.0-draft.2
CONTRACT_BUNDLE_FREEZE=DRAFT
CONTRACT_BUNDLE_FROZEN=false
IMPLEMENTATION_AUTHORIZED=false
PRODUCTION_DEPLOYMENT=NOT_READY
PRODUCTION_JWKS_DEPLOYMENT_READY=false
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE=false
CONSUMER_MIGRATION=NOT_STARTED
```

This directory is the machine-executable companion to
`docs/contracts/minimal-auth-v1/`. It makes unresolved freeze decisions visible
instead of filling them with deployment guesses.

The validator is intentionally useful before freeze. It proves that:

- the manifest and registry are internally consistent;
- token fixtures obey the V1 profiles and strict Scope wire format;
- negative fixtures are rejected for the declared reason;
- required schemas and metadata exist;
- Contract Bundle Freeze is impossible while any gate marked
  `blocks_contract_bundle_freeze=true` remains open.

It does **not** prove that an issuer, database migration, resource service or
deployment conforms. Real-process acceptance remains governed by
`docs/contracts/minimal-auth-v1/conformance.md`.

## Contents

| Artifact | Purpose |
|---|---|
| `contract-manifest.json` | Candidate exact protocol and runtime parameters |
| `audience-registry.json` | Candidate resource audiences, namespaces and profiles |
| `schemas/` | Executed JSON Schema 2020-12 contracts for manifest, tokens, grants, proxy, audit, OAuth and sessions |
| `fixtures/` | Public JWKS, signed compact JWT, schema-instance and positive/negative profile fixtures |
| `metadata/` | Three-domain gates, first-wave SHA matrix, deferred migration candidates and change log |
| `validate.mjs` | Bundle, schema, signed-JWT and fixture validator |

## Validate

```bash
npm run contract:v1:validate
```

Expected lifecycle result for this draft:

```text
MINIMAL_AUTH_V1_BUNDLE_VALID=true
CONTRACT_BUNDLE_FREEZE=DRAFT
CONTRACT_BUNDLE_FROZEN=false
PRODUCTION_DEPLOYMENT=NOT_READY
PRODUCTION_JWKS_DEPLOYMENT_READY=false
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE=false
CONSUMER_MIGRATION=NOT_STARTED
CONTRACT_FREEZE_BLOCKER_COUNT>0
```

The command exits non-zero for malformed artifacts, a fixture expectation
mismatch, signature/schema failure, or any attempt to set Bundle Frozen before
all Contract Bundle Freeze gates are closed.

## Freeze rule

Source Contract Bundle Freeze requires one review transition that:

1. closes every `contract_bundle_freeze` gate with evidence;
2. freezes the protocol values, JWKS path, RS256/`kid`, cache, rotation and
   fail-closed semantics without inventing a deployment URL;
3. fixes the first-wave source inventory to remote full SHAs;
4. reruns this validator and the narrow contract review;
5. changes `bundle_status` to `frozen` and `frozen` to `true` in one commit.

Production deployment and consumer migration have independent states. A
frozen source Bundle may therefore still correctly report:

```text
PRODUCTION_JWKS_DEPLOYMENT_READY=false
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE=false
CONSUMER_MIGRATION_IN_SCOPE_READY=false
LEGACY_CONSUMERS_MIGRATED=false
```

Changing a frozen protocol artifact requires a Contract Change Request.
Adding a later deployment attestation or consumer migration report cannot
silently change the frozen protocol.
