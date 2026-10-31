# #94 r3 revoke repair

## Bound route and execution plan

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/auth-service
REVIEW_TARGET_HEAD = 1e596e9772d181fda9090a5bfd2f2f2aadb34ae1 (r2 predecessor)
BASE_HEAD = 8fb8643519fa6f160bba79e78c5170a312018880
CURRENT_BASE_HEAD = 8fb8643519fa6f160bba79e78c5170a312018880 (live ls-remote)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = EXECUTION_HISTORY_AUTH_CONTRACT_V1@8fb8643519fa6f160bba79e78c5170a312018880
RELATED_AUTHORITIES = MINIMAL_AUTH_FOUNDATION_V2; incorporated minimal-auth-v1/grants-and-audiences.md section 9
IMPLEMENTATION_AUTHORITY = contracts (merged accepted phase + explicit Owner task, as in r2)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (Owner's #94 r3 task; source/tests/GitHub only)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (/tmp/auth-94-impl dedicated clone; ac-94-execution-history-auth-impl; sole writer /root)
CONTROLLED_RUNBOOK_REQUIRED = YES (bounded steps below)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS (committed synthetic TAP evidence + r2 baseline)
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
BASE_IMPACT = NONE
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (open-only task)
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE
```

Goal/current gap: revoke must remove an existing audit scope and emit a
transactional `grant_change_audits` record even after its client is revoked.
Observed r2 gate checks active client/principal before either operation, so
revoke aborts before scope removal and audit creation. No contract change.

Owner mandate: only this revoke semantic correction, regression tests and
delivery evidence; push branch, open PR to main and comment on #94. No merge,
production write, real grant materialization, install, restart or deployment.
Preserve the r2 files and pre-existing untracked `final-*` evidence.

Bounded runbook/checklist (executed by /root, local synthetic environment):

- [x] Add `tests/oauth/execution-history-revoke-v1.test.ts`: revoked client
  revoke preserves independent read and audits; repeated last-scope revoke
  is an audited NOOP; never-existing grant remains an audited NOOP. Include
  provision denial controls for revoked client/disabled principal and preserve
  exact migrationId replay semantics.
- [x] Run new tests against unchanged r2 source; retain expected RED verbatim.
- [x] In `src/lib/oauth/v1/execution-history-grant.ts`, restrict only active
  client/principal checks to provision. Retain registered Agent binding,
  audience validation, CAS, Serializable transaction and append-only audits.
- [x] Run the three regressions and r2's five acceptance tests. Reuse the
  approved 73-name r2 baseline; compare affected existing module outcomes
  against it without rerunning unrelated modules. TypeScript build check.
- [ ] Bind exact candidate SHA to evidence and independent affected-contract
  review, then push/open PR/comment and read back remote SHA and receipts.

Every test child receives a fresh synthetic environment (unused loopback
DATABASE_URL on port 1, synthetic JWT_SECRET); no provision CLI is run. Reuse
existing ignored dependencies; no installation. No secret values in receipts.
Expected RED for this reported bug is permitted; unexpected semantic failures,
authority conflicts, scope expansion or production dependency stop execution.
No retry of an unknown external write outcome without fresh reconciliation.

DONE_WHEN: revoke regressions and five acceptances green; reused baseline has
no name/outcome delta; independent review has no affected-contract blocker;
PR and issue receipt identify exact pushed head. EXPANSION_TRIGGER: behavior
outside revoke/its regression or an unexpected semantic failure. Stop at done.

## Executed evidence (2026-11-01 Asia/Shanghai)

One production file changed: the shared registered Agent predicate remains;
only client/principal active checks are conditional on `operation=provision`.
No changes to the audience, scope transformations, expected-version checks,
CAS, transaction, replay logic, audit envelope or management CLI.

| Requirement | Evidence | Result |
|---|---|---|
| Revoked client can revoke; independent read retained; audit appended | R3-1, active/disabled principal cases | PASS |
| Active checks still block provision | R3-1, revoked client and active client/disabled principal | PASS |
| Repeated last-scope revoke | R3-2, delete followed by two audited NOOPs | PASS |
| Exact migrationId replay | R3-2, original auditId and no extra write | PASS |
| Never-existing grant | R3-3, registered active/revoked clients: audited NOOP; unknown client still rejected | PASS |
| All five r2 contract acceptances | ACC94-1 through ACC94-5 | 5/5 PASS |
| Affected existing modules | fleet-send-grant, fleet-send-regression, v1-direct | 24/24 PASS |
| Existing 73-name/result set | 24 fresh results + 49 approved r2 results | diff = empty |
| Production TypeScript check | `node_modules/.bin/tsc -p tsconfig.json --noEmit` | rc=0 |

RED command: `node_modules/.bin/tsx --test --test-reporter=tap
tests/oauth/execution-history-revoke-v1.test.ts`. Source was unchanged r2
`1e596e9772d181fda9090a5bfd2f2f2aadb34ae1`; `r3-red.tap` retains the complete
output: 0 pass / 3 fail, each `registered_agent_client_required`, rc=1.

GREEN command adds `tests/oauth/execution-history-auth-v1.test.ts` to the RED
command. `r3-green.tap` retains the complete output: 8 pass / 0 fail, rc=0.
Every independent revoke appends evidence; exact instruction replay retains
the existing original-audit receipt semantics. Never-existing registered-client
revoke keeps SQL NULL before/after, no grant row and resultingGrantVersion=1.

The 73-name baseline is reused as explicitly authorized, not rerun in full.
All 13 existing test manifest files are byte-identical to r2. `r3-affected.tap`
refreshes the 24 affected existing outcomes; `r3-affected-named.tsv` is their
name/result set. `r3-named.tsv` combines those with 49 unchanged approved r2
outcomes and compares byte-for-byte to `baseline-named.tsv`;
`r3-named-set.diff` is 0 bytes. The approved aggregate remains **71 pass / 2
pre-existing failures**, not an all-green 73-test claim. Neither was rerun or
modified by r3:

1. `real disposable PostgreSQL, generic SERVICE issuer and loopback HTTP preserve all authorization guards`
   — r2 disposable `pg_ctl ... start` failure before issuance.
2. `V1 Prisma and migration files stay within the repository line limit`
   — unchanged existing schema exceeds 500 lines.

`r3-execution.json` binds commands, outcomes and file SHA-256 values. The PR
records exact committed/pushed candidate SHA and independent final review;
this pre-commit record does not embed a circular self-SHA. Existing r2 evidence
and pre-existing untracked `final-*` files remain untouched. All tests use
synthetic persistence fixtures; real resource-service/runtime acceptance and
downstream #545 canaries remain unexecuted. Production writes and real grant
materialization: NONE.
