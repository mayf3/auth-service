# Canonical Subject Enrollment Implementation V1 Report

```text
GOAL = AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_IMPLEMENTATION_V1
BASE_MAIN_SHA = af285a78582c050100ed0d234a98c8bd77910f2c
IMPLEMENTATION_SOURCE_HEAD = d0f5faeb0bc9212b59a7feaa2be7cd64bf6c74cb
PRIMARY_AUTHORITY = AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1
AUTHORITY_STATUS = accepted
ASSURANCE_LEVEL = CONTROLLED
PRODUCTION_APPLY_ALLOWED = NO
```

## Closure

The implementation adds an empty forward-only persistence migration, Prisma models,
a controlled source-only `IMPORT / PLAN / APPLY / VERIFY` vehicle, and isolated unit
and PostgreSQL conformance tests. It reuses `agent_identity_lifecycle`,
`agent_identity_successors`, and the foundation advisory-lock domain. It adds no
public route, ordinary authentication/admission dependency, Principal creation,
legacy fallback, production data, enrollment, source migration, retirement, or
deployment action.

The packet and plan paths use exact typed IDs and injected exact authority evidence.
Business labels, names, roles, Agent-ID grammar, UUID shape, Client IDs, external
aliases, and consumer-owned identity maps never enter target resolution. Actor
attribution is checked separately from typed attestation authority.

## Contract and Acceptance conformance

| Authority | Implemented evidence |
|---|---|
| CTR-CSESB-001, ACC-CSESB-001 | Typed attestation table, immutable target/provenance, append-preserving lifecycle, chain/fork and active uniqueness constraints |
| CTR-CSESB-002, ACC-CSESB-002 | Exact AGENT/HUMAN/SERVICE matrix in PLAN/APPLY plus database target guards and negative fixtures |
| CTR-CSESB-003, ACC-CSESB-003 | Prospective-only bindings; planned/active/superseded/exited matrix; atomic append-preserving supersession; EXIT evidence gate |
| CTR-CSESB-004, ACC-CSESB-007 | Existing foundation lifecycle/successor reuse; frozen lifecycle matrix; incoming/outgoing graph checks; all five retirement gates |
| CTR-CSESB-005, ACC-CSESB-004 | Strict offline IMPORT, canonical set ordering, stable SHA-256, duplicate/unknown rejection, repeatable-read PLAN |
| CTR-CSESB-006, ACC-CSESB-005 | One-attempt SERIALIZABLE APPLY, shared advisory lock, exact prestate replan, atomic audit, exact replay NOOP, changed-digest conflict |
| CTR-CSESB-007, ACC-CSESB-006 | Consistent read-only VERIFY, exact manifest/poststate checks, commit and verification timestamps, sanitized receipt, exact unknown-outcome reconciliation |
| CTR-CSESB-008, ACC-CSESB-007 | Closed ten-operation command union with no generic arbitrary lifecycle mutation or physical deletion |
| CTR-CSESB-009, ACC-CSESB-008 | Synthetic packet proves 73 subjects (72 AGENT, 1 HUMAN), 89 bindings, and 147 covered rows without hardcoded business labels |
| CTR-CSESB-010, ACC-CSESB-006 | Closed safe error taxonomy; command failure output contains code only |
| CTR-CSESB-011, ACC-CSESB-003/009 | EXIT requires separately injected exact zero-live evidence; runtime source-binding readers were not added |
| CTR-CSESB-012, ACC-CSESB-010 | Diff stays inside the frozen ExecPlan; foundation migration bytes unchanged; production authority remains none |
| CTR-CSESB-013, ACC-CSESB-011 | Exact Owner/delegated/governing authority manifest; exact actor/scope/operation/disposition; delegation fencing and revocation race |

## Fresh validation evidence

```text
npm run test:canonical-subject-enrollment
PASS: 24/24

npm test
PASS: 48/48

npm run test:canonical-identity
PASS: 15/15

npm run test:oauth
PASS: 156/156

DATABASE_URL=postgresql://isolated:isolated@127.0.0.1:1/isolated npx prisma validate
PASS

DATABASE_URL=postgresql://isolated:isolated@127.0.0.1:1/isolated npx prisma generate
PASS

python3 .agents/tools/verify_governance.py --target . --require-accepted
PASS

npm run contract:v1:validate
PASS

git diff --check
PASS
```

`npm run build` and `npx tsc -p tsconfig.json --noEmit` report exactly the inherited
base diagnostic at `src/lib/oauth/forum-direct-agent-token.ts:142` (`TS2322`). A
fresh detached base worktree at the exact base SHA reports the identical diagnostic;
the candidate adds zero TypeScript diagnostics. This Goal does not alter that file
or expand into the inherited baseline failure.

The foundation migration SHA-256 is
`e5f58f20772f00ad5f26dc514ca7eeb19a96e96e8b9978524e3758625c8301d0` in both
base and candidate.

```text
PRODUCTION_DDL_APPLIED = NO
PRODUCTION_ENROLLMENT_APPLIED = NO
PRODUCTION_MUTATION_PERFORMED = NO
```
