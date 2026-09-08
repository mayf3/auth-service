---
spec_id: AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_PRESTATE_REBASELINE_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
  - FMG precondition ownership narrowing + production apply activation closure
governed_by:
  - AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1
  - AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V2
external_authorities: []
supersedes: []
supersedes_note: >
  Amends the precondition/conflict semantics of the parent Spec (CTR-FMG-005
  workflow pin as an APPLY gate; CTR-FMG-008 total-row-count prestate) and
  activates the CTR-FMG-016 production-apply seam. It supersedes no whole Spec.
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_PRESTATE_REBASELINE_V1

> **PROPOSED — DOCS ONLY.** While proposed this Spec authorizes no production
> apply, no database write, no deployment, and no credential access. The only
> effect of this PR's bytes is the reviewed implementation of the narrowed
> precondition model and the descriptor-gated apply activation, exercised
> exclusively against disposable conformance databases.

## 1. Goal

Correct the FMG precondition ownership boundary, which the current accepted
production state has proven over-broad: the moderator Client
`mc_hvEfjkJ5BTKA8HZXRmbzNVw0` now lawfully carries five Grant rows (three
supplied by later accepted authorities: identity-directory baseline supply,
life-workbench pilot supply, and a workflow grant change), so the frozen
"exactly svc-forum + svc-workflow" total-row precondition and the
CTR-FMG-005 `[workflow.read]@v1` exact pin classify today's production state
as CONFLICT and block the authorized FMG transaction entirely.

```text
SEMANTIC_DELTA_CLASS = PRECONDITION_OWNERSHIP_NARROWING
PRODUCT_TARGET_CHANGED = NO
PERMISSION_TARGET_CHANGED = NO
AUTHORIZED_IDENTITY_CHANGED = NO
AUTHORIZED_SCOPE_INCREMENT_CHANGED = NO
WRITE_SET_CHANGED = NO
APPLY_PRECONDITION_CHANGED = YES
```

## 2. Ownership model

FMG owns and strictly constrains exactly:

```text
A. exact moderator identity tuple (principal/client binding, active, unrevoked)
B. the svc-forum Audience row
C. the moderator Client's svc-forum Grant row
D. the FMG governed audit
```

Every other Grant row on the moderator Client is a BYSTANDER:

```text
BYSTANDER_GRANT_COUNT = 0..N (never an APPLY gate)
bystanders are read for evidence, enter the invariant/prestate digest and the
complete before/after audit snapshots, and MUST be byte-preserved by the
transaction;
FMG MUST NOT create/update/delete/version-bump any bystander;
any bystander change between PLAN and APPLY changes the invariant digest and
therefore conflicts with zero writes (scoped optimistic concurrency).
```

The historical total-row-count precondition (`accessGrants.length == 2`) and
the CTR-FMG-005 svc-workflow `[workflow.read]@v1` exact pin are released as
APPLY gates:

```text
WORKFLOW_GRANT_MUTATION = FORBIDDEN (structural: the write path touches only
the svc-forum row)
WORKFLOW_GRANT_EXACT_STATE_REQUIRED = NO
TOTAL_CLIENT_GRANT_COUNT_REQUIRED = NO
```

The FMG business transaction is unchanged:

```text
Audience:  [forum.read, forum.write] -> [forum.moderate, forum.read, forum.write]
Moderator svc-forum Grant: [forum.read, forum.write] @ v1 -> [forum.moderate, forum.read, forum.write] @ v2
Audit: exact governed 13-field envelope
TRANSACTION_ISOLATION = SERIALIZABLE
ATOMICITY = Audience + svc-forum Grant + FMG Audit
BYSTANDER_MUTATIONS = 0 (any in-transaction bystander change rolls back the
entire transaction)
```

## 3. Apply activation closure (CTR-FMG-016)

The frozen build refused every `--apply` unconditionally. This Spec freezes the
production write path's activation semantics:

```text
exact authorization descriptor REQUIRED (14 frozen fields)
pre-connection authorization validation (exact keys, kinds, hex, bounds)
exact implementation commit = clean executable worktree HEAD (dirty tree refuses)
exact Bundle digest = sha256 of the staged runtime-contract.json file
exact PLAN digest = fresh canonical plan reclassification inside the
  Serializable transaction
exact prestate digest = fresh invariant projection reclassification inside the
  Serializable transaction
exact operator, approval provenance, stop/start/rollback/verify metadata
carried by the descriptor and the governed audit
only after every coordinate matches does the build invoke the already
conformance-tested applyChange; ATTEMPTS_MAX = 1
```

No generic admin API, no generic Grant mutation, and no direct SQL path are
authorized or implemented.

## 4. Current production prestate fixture (acceptance only)

The current production census (five Grant rows on the moderator client:
agent-directory@1, identity-directory@1, life-workbench@1,
svc-forum `[forum.read,forum.write]@1`, svc-workflow
`[workflow.read,workflow.execute]@2`) is frozen as an ACCEPTANCE FIXTURE only:

```text
CURRENT_PRODUCTION_PRESTATE_FIXTURE = YES
```

It must classify APPLY and apply atomically with byte-preserved bystanders
(T2). It is explicitly NOT an eternal Product Contract: the EXTRA_UNRELATED_
GRANT_FIXTURE (T3) proves any future additional lawful bystander keeps the
classification APPLY, so no later accepted Grant supply can invalidate the
vehicle again.

## 5. Frozen test matrix

T1 historical 2-row state -> APPLY; T2 current real 5-row state -> APPLY
(byte-preserved bystanders, exact audit snapshots); T3 5-row + arbitrary sixth
bystander -> APPLY; T4 forum Grant source scope drift -> CONFLICT/0 writes;
T5 forum Grant source version drift -> CONFLICT/0 writes; T6 Audience drift ->
CONFLICT/0 writes (existing scenarios); T7 identity drift -> CONFLICT/0 writes
(existing scenarios); T8 bystander change between plan and apply -> prestate
digest mismatch -> CONFLICT/0 writes; T9 successful APPLY changes only
Audience + svc-forum Grant + FMG audit (also exercised end-to-end through the
activated `--apply` descriptor path with a sanitized receipt);
T10 all bystander rows byte-identical before/after; T11 immediate exact rerun
-> NOOP/0 writes; T12 the full existing conformance regression suite PASSes.
The two former "Workflow scope/version drift" conflict scenarios are retired
(released pin); stale-prestate bystander drift remains fail-closed via T8 and
the digest-drift scenarios.

## 6. Non-goals

No audience-registry change; no scope literal change; no moderator identity
change; no write-set expansion; no plan-digest NOOP/conflict semantic change
beyond the precondition narrowing; no rollback semantic change (CTR-FMG-017
stands); no credential access or rotation; no production apply executed by
this PR; no `mayf3/agent-forum` or `mayf3/dsh-agent-core` change.

## 7. Validation gates

1. `npx tsc --noEmit` clean;
2. `npm run contract:v1:validate` unchanged-valid bundle;
3. `git diff --check` clean;
4. `bash scripts/run-forum-moderator-grant-supply-v1-conformance.sh` — the
   full suite including T1-T12 PASSes against the disposable conformance
   PostgreSQL;
5. git status = exactly the in-scope files (vehicle, test, harness-free — this
   Spec, README row); no credential material in the diff.
