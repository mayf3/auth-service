# Auth canonical identity foundation implementation evidence

Authority: AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1, accepted in
`1f22310b0ce838da0b20295d7e999b851925d2b3` (original Base).
Issuer: mayf3, UNBLOCK_IDENTITY_CANONICALIZATION_PROGRAM child implementation,
isolated tests and independent review preauthorization; delegated task-1 brief.
Author: `/root/auth_foundation_implementation`. Independent review remains pending.
Environment: macOS; Node v26.7.0, Prisma 6.19.3, local PostgreSQL binaries.
Observed: 2026-09-14 16:03 UTC (2026-09-15 Asia/Shanghai).

DEVELOPMENT_PREFLIGHT: REUSE / EXEC_PLAN / CONTROLLED; IMPLEMENTATION;
AUTHORITY_ACCEPTED_IN_BASE=YES. Goal: only CTR-CIF-001..008 foundation surface.
Gap: lifecycle/successor persistence and internal strict read seam absent.
Scope: exact seven CTR-CIF-007 files plus plan/report. No production DDL, no
secret/.env/credential read, no Core enrollment, no registry/Grant/client writes,
no public route, no push/merge by implementer. Disposable Pg cleanup is in finally.
DONE_WHEN: task source and isolated evidence committed for independent review.
EXPANSION_TRIGGER: load-bearing accepted Contract contradiction; none observed.

## Executed evidence

- EVD-CIF-IMPL-001 / ACC-CIF-001: tests first. Initial module-existence assertion
  failed (1/1); initial migration-existence assertion failed (1/1). Full library
  matrix then failed missing module; real Pg harness reached missing migration
  after creating its own cluster and synthetic Principal fixture. Tool preparation
  errors (un-generated Prisma client and psql-only URL parsing) were corrected
  before that actual Pg RED. Migration is applied both to an empty schema and
  populated fixture. All existing Principal/client fixture rows compare byte-equal;
  Principal enrollment fences also preserve full synthetic row bytes.
- EVD-CIF-IMPL-002 / ACC-CIF-002: `npm run test:canonical-identity`: 15/15 PASS
  (7 unit plus 8 real-Pg parent/subtests). Four application/latch + observed database
  lock barriers: RR frozen before enrollment, Principal demotion writes first,
  RR target demotion frozen before edge, lifecycle target demotion writes first.
  All four observed SQLSTATE=40001; at least one transaction aborted in each race.
  Final graph invalid-canonical=0 and broken-edge=0. Self-edge, chain, cycle,
  invalid canonical shape, SERVICE, inactive, missing lifecycle, dependency
  demotion, edge retarget/evidence edit, retired resurrection, weaker isolation,
  deletion and partial-transaction rollback are rejected. Deferred checks are
  forced immediate inside negative assertions to preserve PostgreSQL SQLSTATE
  through Prisma; a separate invalid transaction verifies commit-time rollback.
- EVD-CIF-IMPL-003 / ACC-CIF-003..004: exact pair/directions, bigint decimal string,
  missing lifecycle and explicit migration matrix, duplicate/reverse, leaf graph,
  terminal timeout and safe unavailable errors pass. Added leaf and provider-timeout
  assertions were observed RED before fixes, then GREEN. Real Pg tests exercise
  injected reads and the actual default Prisma adapter in a subprocess; no write
  API is exposed by library projections. Default adapter sets READ ONLY plus RR.
- EVD-CIF-IMPL-004 / ACC-CIF-005: with synthetic JWT_SECRET only,
  `tsx --test tests/oauth/agent-principal-resolution.test.ts
  tests/oauth/identity-resolution-v1.test.ts
  tests/oauth/supply-baseline-directory-grants-v1.test.ts`: 70/70 PASS;
  `tsx --test tests/oauth/workflow-admission.test.ts`: 4/4 PASS, including real
  signed AGENT/SERVICE caller and disabled-directory semantics.
- EVD-CIF-IMPL-005 / ACC-CIF-006: metadata conformance function and actual CLI
  both execute against the disposable cluster: AUTH_FOUNDATION; local invariants
  PASS; STRICT_WRITE_DEPLOYED=false; GLOBAL_CENSUS_COMPLETE=false; Core/consumer
  UNKNOWN. Output binds Git revision and SHA256 source/schema bytes. Seven source
  files only; no generated client or runtime contract is committed.
- `prisma generate`: PASS. Strict targeted `tsc --noEmit --target ES2022 --module
  NodeNext --moduleResolution NodeNext --strict --skipLibCheck` of library, script
  and both new tests: PASS. `git diff --check`: PASS.

## Build limitation and scope

`npm run build` exits 2 at pre-existing
`src/lib/oauth/forum-direct-agent-token.ts(142,5): TS2322`, because
`forum.direct_agent_token.minted` is not assignable to AuditEventType. This was
reproduced by an actual build in separate detached Base worktree
`/tmp/auth-cif-base-build-20260915` at exact original Base with the same installed
dependencies. That temporary worktree was removed after verification. No
out-of-scope source adjustment was made. This is a baseline build limitation,
not a claim that the whole build passes.

This report covers isolated Auth foundation only. Compatibility resolver remains
live; removal requires all actual consumers migrated and independently proven
LIVE_CONSUMER_COUNT=0. Production apply, actual enrollment, Core checks, consumer
strict-write integration, full census and retirement remain outside this slice.
One global advisory lock is intentionally conservative and may constrain future
management throughput. No performance or production readiness claim is made.

## Final integration coordinates

Original implementation commit: `d93209f`.
Current integration Base: `4e68f83ee4d3648f3e8203b8a7090372335d711a`.
Exact code/schema candidate tested: `17dea97c17e6903ccc2f29fb4f77d6cf6887df34`
(merge of current Base into isolated implementation branch, no conflicts).
At 2026-09-14 16:04:36 UTC, repeated focused tests: 15/15 PASS; existing combined
exact/external-ref/directory compatibility regressions: 74/74 PASS; strict targeted
TypeScript: PASS. Full build still exhibits the identical Base TS2322 limitation.
Diff against current Base contains exactly seven source/test files and the plan
and this report. The final report-only commit changes no tested source/schema.

Schema/migration SHA256:
`e5f58f20772f00ad5f26dc514ca7eeb19a96e96e8b9978524e3758625c8301d0`.
Library SHA256:
`e78b6ac7fa16331ac9a14726403c60d2498d94ee46d3b19107af65b0bd1dd0cb`.
Report script SHA256:
`0cd57b43214a5f322f1500d28376363cfa2f0abe9d39dc1cf8b5dc7d3d72c83e`.
No main/source integration, production effects or independent acceptance is
claimed by this author; root owns exact-head independent review and source merge.
