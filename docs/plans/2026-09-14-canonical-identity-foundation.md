# Canonical Identity Foundation Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development task review and whole-branch review.

Goal: implement the accepted Auth foundation slice without production activation.
Architecture: empty Auth lifecycle/successor tables enforce committed graph validity;
a single read-only library separates strict admission from explicit migration.
Tech stack: existing TypeScript/Prisma/PostgreSQL/node:test. No new dependencies.
Spec: `docs/specs/AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1.md` accepted at
`1f22310b0ce838da0b20295d7e999b851925d2b3`.

## Global Constraints

- Exact seven runtime/test files in CTR-CIF-007 only, plus this plan/review reports.
- Source only; no production DDL, registry/store/credential mutation or secret reads.
- Existing read/auth/profile behavior unchanged; no automatic enrollment or seed.
- No canonical inference from syntax/active; missing lifecycle is unresolved.
- Successor targets direct canonical leaves; lifecycle writes SERIALIZABLE with
  Principal MVCC fences and the precise CTR-CIF-002 concurrency protocol.
- Real PostgreSQL tests must use a new temporary cluster/database only, with
  explicit cleanup. No shared/local service DB used for tests.
- Independent review before source merge; no Author accepting their own review.

### Task 1: Complete the isolated Auth foundation slice

Files: the seven files enumerated in CTR-CIF-007. Existing Prisma relations gain
only lifecycle and source/target associations. No edits to business write routes.

Interfaces: exact CTR-CIF-003/004 functions and closed result/error types. Internal
optional dependency injection may supply a read-only database and test deadline;
production defaults use existing Prisma. No public HTTP seam. Report consumes
only identity/status/lifecycle/edge metadata, never full client/Principal rows.

- [ ] Write contract tests first in `tests/oauth/canonical-identity.test.ts`.
  Use synthetic UUID fixtures labelled isolated, with canonical, missing lifecycle,
  disabled, SERVICE, legacy, retired, reverse mismatch, duplicate, missing edge,
  and direct-edge cases. Start by asserting the module/API exists and run with
  `node_modules/.bin/tsx --test tests/oauth/canonical-identity.test.ts`; record RED.
  Representative obligations:
  ```ts
  assert.equal(result.resolvedViaLegacy, false);
  await assert.rejects(validateCanonicalPair(wrongPair), {code:'IDENTITY_PAIR_MISMATCH'});
  assert.equal(migrationResult.resolvedViaLegacy, true);
  assert.equal(migrationResult.evidenceRef, 'isolated-fixture');
  ```
  Use a delayed injected query to assert one terminal timeout with no write/retry.
- [ ] Add real Pg test setup using `initdb`/`pg_ctl` against a private temporary
  directory and free loopback/socket port. Minimal pre-existing table fixture
  must include the actual Principal identity/status column types and unique agent_id.
  Before migration assert existing rows byte-equal after applying empty DDL.
  Write tests proving rejection of self/chain/cycle, invalid canonical, target
  demotion, retarget/evidence edit, retired resurrection and weaker isolation.
  Execute RED before creating migration. Use explicit concurrent transactions
  and barriers, not sleep-only race claims. Freeze a Principal RR snapshot before
  enrollment, and freeze target demotion before edge creation; exercise both
  interleavings. At least one conflicting transaction must abort and the final
  graph must remain valid. Capture SQLSTATE and final-state assertions.
- [ ] Implement migration/model support to make invariant tests GREEN. Require
  transaction-scoped advisory lock, SERIALIZABLE new-table writes, fixed-order
  Principal no-business-change MVCC fences, fresh RC trigger reads, nonrecursive
  fence handling and whole-transaction failure. No trigger silently repairs data.
- [ ] Implement `canonical-identity.ts` using bounded read-only RepeatableRead
  projections, exact pair/leaf validation, closed safe errors and 5000ms deadline.
  Execute library matrix and real Pg reads. Preserve bigint revision as string.
- [ ] Implement metadata-only conformance script. It emits scope AUTH_FOUNDATION,
  timestamp/code/schema coordinates and local invariant counts; explicitly reports
  STRICT_WRITE_DEPLOYED=false and GLOBAL_CENSUS_COMPLETE=false. No secret selection,
  exception dump or query retry. Integrate focused package commands only.
- [ ] Generate Prisma client in this isolated worktree, run the focused tests and
  TypeScript/build checks plus existing exact/directory regression tests. Record
  commands and results with code coordinates in `docs/reports/`.
- [ ] Self-review exact file closure and no production effects. Commit only this
  task's source/test/plan/report files; return commit plus test evidence to root.
  Do not push or merge; root arranges independent review and final source merge.

## Review and completion

Task review covers all ACC-CIF-001..006, especially real concurrency evidence and
scope exclusions. Any unresolved load-bearing failure blocks merge. Whole-branch
review binds final exact head. This slice never closes the whole identity Program.
