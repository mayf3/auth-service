# auth-service #94 source implementation record

## Coordinates and mandate

- Repository/work surface: `/tmp/auth-94-impl`, sole writer `/root`.
- Branch: `ac-94-execution-history-auth-impl`.
- Base / accepted authority: `8fb8643519fa6f160bba79e78c5170a312018880`
  (main, PR #95); original implementation predecessor `91da8b6`.
- Primary authority: `docs/specs/EXECUTION_HISTORY_AUTH_CONTRACT_V1.md`,
  accepted by Owner on 2026-11-01. Owner's #94 implementation task explicitly
  authorizes the frozen contracts and GitHub push / open PR / issue receipt.
- Goal: register execution-history and its two scopes; durable self-read
  through the existing fleet provisioning channel; explicitly instructed,
  named-client audit supply/revoke with transactional audit evidence.
- Gap at base: no execution-history registry entry or supply wiring.

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
AUTHORITY_ACTION = REUSE
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts (accepted Spec phase + explicit Owner task)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (source/tests/GitHub only)
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = NONE
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (independent final review and Owner integration remain separate)
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE
```

## Reuse surfaces

| File | Existing function / surface reused |
|---|---|
| `contract-bundles/minimal-auth-v1/audience-registry.json` | Versioned registry; append entry like website-inquiry PR #89 |
| `src/lib/oauth/v1/contract.ts` | `getV1AudienceDefinitions`, `initializeAuthContract`, `verifyRuntimeSnapshot` |
| `src/lib/oauth/v1/direct.ts` | `authorizeV1DirectToken`, `issueV1DirectToken`: exact resource, durable same-audience grant, strict subset, stable missing-grant denial |
| `src/lib/oauth/v1/scope.ts` | `canonicalV1Scope`: strict namespace, syntax, duplicate and wildcard rejection |
| `src/lib/oauth/v1/signer.ts` | `signV1DirectMachineToken`, `verifyV1DirectMachineToken`: RS256, exact audience, immutable bound principal/agent |
| `src/lib/oauth/v1/idempotent.ts` | `createOrGetClient`: existing transactional birth provisioning |
| `src/routes/idempotent.ts` | Existing authenticated `POST /api/v1/clients`: retry/claim/resolve provisioning |
| `src/lib/oauth/v1/fleet-send-grant.ts` | `ensureFleetSessionSendGrant`: existing fleet channel shape; keep send semantics intact |
| `src/lib/oauth/v1/grant-migration.ts` | `findV1AudienceMismatch`: executable/database registration equality |
| `scripts/supply-hr-session-inspection-grant-v1.ts` | Versioned named-client grant change pattern: Owner instruction, Serializable transaction, expected-version CAS, closed nonsecret audit |
| `scripts/revoke-life-workbench-pilot-grants-v1.ts` | Forward revoke pattern: remove durable row, retain before-image, `Prisma.DbNull` after-image |
| `prisma/schema.prisma` | Existing `MachineAccessGrant` / `GrantChangeAudit`; no schema migration |
| `tests/oauth/website-inquiry-audience-v1.test.ts` | Real issuer/verifier and synthetic persistence boundary; no real endpoint |

PR #89 has no website-specific supply implementation. Its CTR-WIAC-005
requires attributable Owner instruction through existing versioned management
machinery; #94 uses that pattern and does not add an online grant API.

## Execution bounds and checks

1. Reuse existing dependency tree via ignored local symlink; no installation.
   Test processes receive synthetic settings, with no inherited database URL.
2. Capture the existing affected named test set and baseline outcomes before
   implementation. Keep existing failure names; do not fix or skip them.
3. Add the five required acceptance regressions, capture expected RED, then
   implement the smallest registry/version/provisioning changes and capture GREEN.
4. Compare existing named outcomes on the same command; require empty diff.
   Run bundle validation, TypeScript build and independent affected review.
5. Commit, push, open PR to main, post #94 receipt. Never merge/deploy.

Abort semantic writes on authority conflict, contract violation or an unexpected
semantic test failure. Expected preimplementation TDD RED is evidence, not an
abort. No credentials or production data are read; no real grant is supplied,
no provision CLI is invoked, no service is installed or restarted.

Auth owns entry scopes and bound identity. Resource-service self-only row
authorization and redacted cross-agent projections remain downstream #545;
an isolated consumer fixture may demonstrate the boundary but is not a real
resource-service canary or business/runtime acceptance.

## Executed evidence

Evidence date: 2026-11-01, Node/tsx local execution with synthetic fixtures.
No installation: ignored `node_modules` symlink reuses `/tmp/auth-89-rebase`'s
existing dependencies. Every test subprocess receives a fresh environment with
`JWT_SECRET=auth94-synthetic-test-secret`, `AUTH_CONTRACT_MODE=v1`, and an unused
synthetic loopback `DATABASE_URL` on port 1. The existing MCP test attempts only
its own disposable local PostgreSQL cluster; it never reaches production.

| Acceptance | RED evidence | GREEN evidence | What was executed |
|---|---|---|---|
| 1 | `focused-red.tap`, ACC94-1 | `focused-green.tap`, ACC94-1 | Canonical fleet client birth transaction supplies read; real issuer/verifier; other-agent rejection in explicitly synthetic resource guard |
| 2 | ACC94-2 | ACC94-2 | Exact named audit instruction; real mint; ungranted second client has `machine_grant_missing`; audit adds no raw/secret/decryption claims |
| 3 | ACC94-3 | ACC94-3 | Wrong verifier audience, wrong/unknown resource, unknown scope, mixed read+audit escalation, wildcard, duplicate and empty scopes deny whole issuance |
| 4 | ACC94-4 | ACC94-4 | Versioned provision/revoke, NOOP and replay evidence, preserved read, last-scope row deletion, missing instruction fields, version/CAS conflict, audit-failure rollback, first-client/read failure rollback |
| 5 | ACC94-5 | ACC94-5 | Capture actual issuer success/deny and supply/revoke execution; assert no token, secret, verifier or raw-content sentinel in logs or durable audits |

RED: **0/5 passed, 5/5 failed, rc=1** before implementation (missing registry
entry/supply module). GREEN: **5/5 passed, rc=0**. Complete TAP output is retained
verbatim, with no token/secret/raw-content values emitted. Stored signed bundle
fixtures are synthetic, fixed-time test artifacts; their private key was not
retained and their compact JWTs are never printed by tests.

Existing affected suite: `existing-files.json` is the exact 13-file command
manifest; run `node_modules/.bin/tsx --test --test-reporter=tap <all manifest paths>`
under the synthetic environment above. Both runs: **73 named tests, 71 pass,
2 fail, 0 skipped**, rc=1. `baseline-named.tsv` and `candidate-named.tsv` compare
test name **and result**, with `named-set.diff` empty (0 bytes). Old names with
1.14 labels are deliberately preserved; assertions now check the coherent 1.15
snapshot, and every existing registration/negative guard stays intact.

Unchanged existing failures (not fixed or skipped):

1. `real disposable PostgreSQL, generic SERVICE issuer and loopback HTTP preserve all authorization guards`
   — the test-owned disposable `pg_ctl ... start` fails before issuance.
2. `V1 Prisma and migration files stay within the repository line limit`
   — existing `prisma/schema.prisma` exceeds 500 lines; schema is unchanged.

`candidate-prepare.log` and `candidate-prepare-candidate.log`: Bundle validator
and both snapshot generators rc=0. Bundle includes three new independently
granted signed scope subsets and six fail-closed negative fixtures. Runtime
adds 1.15 to its existing allow-list. TypeScript build rc=0 (`build.log` is
empty). No schema/migration, token endpoint, signer, verifier, credential or
online Grant management API change.

## Supply vehicle handoff (not executed)

`scripts/supply-execution-history-audit-v1.ts` accepts `--instruction <json>`
only with `EXECUTION_HISTORY_GRANT_APPLY=YES`, an existing-Owner instruction
reference, exact named registered Agent client, `operation=provision|revoke`,
fresh `migrationId` prefixed `execution-history-`, exact clean source SHA,
operator and expected grant version (null for absent). Neither this task nor
this record authorizes using that gate against a real database. Deployment,
registry reconciliation and real grant materialization require their separate
controlled authorization. The existing registry backfill remains the registry
operation path; the new vehicle never inserts an Audience or identity.

One Serializable transaction takes a bound per-client advisory lock, validates
registered Audience equality and active registered Agent binding, uses exact
version/scopes CAS, and appends `grant_change_audits`. Independent NOOP calls
get evidence without version growth; exact `migrationId` replay returns the
original audit ID and performs no writes. Metadata/action/recipient mismatch
fails closed. Audit revocation preserves independent read; last-scope revoke
deletes the grant and records SQL NULL after-image. Partial revoke uses
`changeType=replace` to honor the existing DB value-shape CHECK. No audit rows
are updated/deleted. Unknown commit outcome is never automatically retried.

This delivery is source + tests only. Real authorization materialization: NONE.
Production writes / install / restart / deployment: NONE. Downstream #545
redacted cross-agent canary and runtime acceptance: NOT EXECUTED.
