---
spec_id: AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1
status: superseded
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
  - forum moderator Grant supply vehicle Bundle retarget and redeploy-prestate classification
governed_by:
  - AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1
external_authorities: []
supersedes: []
superseded_by:
  - AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V2
owners:
  - mayf3
---

# AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1

> **ACCEPTED** (2026-09-06, exact head b22785c…, independent implementation
> audit verdict ACCEPT with zero blockers — adversarial probes over the new
> classification all negative, conformance harness 33/33 PASS independently
> re-run by the auditor). This amendment authorizes no production apply, no
> database write, no deployment, and no change to the moderator identity
> tuple or scope sets. `PRODUCTION_APPLY_AUTHORITY = none` is inherited
> unchanged from the parent Spec.

## 1. Goal

Mechanically retarget the accepted forum-moderator Grant supply vehicle
(`scripts/supply-forum-moderator-grant-v1.ts` + its conformance harness) from
Bundle `1.7.0` to the currently deployed Bundle `1.8.0`, and extend
`CTR-FMG-008`'s legal pre-state matrix with exactly one additional state that
legitimate Bundle redeploys now produce, without weakening any fail-closed
guarantee of the parent Spec:

```text
PARENT = AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1 (accepted, unmodified)
DELTA  = Bundle pin 1.7.0 -> 1.8.0
       + Audience@target & Grant@source & no FMG audit -> APPLY (Grant-only)
```

## 2. Scope and non-goals

In scope (exactly three files: two implementation files plus the harness
precondition constant):

- `scripts/supply-forum-moderator-grant-v1.ts`
- `tests/oauth/supply-forum-moderator-grant-v1.test.ts`
- `scripts/run-forum-moderator-grant-supply-v1-conformance.sh` (Bundle pin
  constant in its precondition only)

Non-goals: no audience-registry change, no new scope literal, no moderator
identity change, no change to the 13-field audit envelope, `CTR-FMG-016`
production-apply refusal semantics, advisory lock, transaction isolation, or
any other parent Contract; no `mayf3/agent-forum` or `mayf3/dsh-agent-core`
change; no production mutation of any kind.

## 3. Current State (fresh observations, 2026-09-06)

- Production Auth runs `production-auth-service-a805556…/` (launchd
  `com.auth-service`, pid observed 16929); its staged runtime contract reports
  `contractVersion: 1.8.0` and the frozen audience registry carries
  svc-forum `registered_scopes = [forum.moderate, forum.read, forum.write]`
  (registry_version 1.8.0, 9 audiences).
- Bundle `1.8.0` was created by `AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1`
  (commit `10eb345`, CCR-EAPR-001) — an out-of-band, legitimate Bundle bump
  that did not touch this vehicle.
- The parent-Spec vehicle pins `BUNDLE_CONTRACT_VERSION = '1.7.0'`
  (`OBS-FMG` era), so `--plan`/`--verify-state` now refuse the deployed
  Bundle before any classification; the conformance harness precondition
  likewise hard-fails. The vehicle is therefore NOT READY against current
  production truth even though the moderator Grant was never applied.
- Because the redeployed Bundle's frozen registry already carries the target
  Audience entry, the DB-side Audience half of the parent's atomic transition
  may already sit at the exact target set while the Grant half remains at the
  exact source `[forum.read,forum.write]@v1`. `CTR-FMG-008` as written calls
  every mixed state a conflict, which would make the only sanctioned
  completion path permanently unreachable through no drift of the moderator
  state itself.

## 4. Contracts

### CTR-FMR-001 — Bundle identity pin is exactly 1.8.0

`BUNDLE_CONTRACT_VERSION = '1.8.0'` in the vehicle and in the conformance
harness precondition. Any other staged/running Bundle identity refuses before
DB classification, exactly as the parent's pin behaved at 1.7.0. A future
Bundle bump requires a new mechanical amendment; the pin never floats.

### CTR-FMR-002 — Amended legal pre-state matrix (CTR-FMG-008 delta)

| Pre-state (Audience / Grant / FMG audit) | Classification | Writes |
|---|---|---|
| source / source / none | `APPLY` `UPDATE_AUDIENCE_AND_GRANT` | audience 1, grant 1, audit 1 (unchanged) |
| **target / source / none** | **`APPLY` `UPDATE_GRANT_ONLY`** | **audience 0 (row untouched), grant 1, audit 1 (new)** |
| target / target / exact governed audit | `EXACT_RERUN_NOOP` | 0 / 0 / 0 (unchanged) |
| source / target / any | `CONFLICT` | 0 / 0 / 0 (unchanged forbidden direction) |
| any other drift (scope sets, versions, duplicate/missing audit, foreign `forum.moderate`, identity fields) | `CONFLICT` | 0 / 0 / 0 (unchanged) |

The new row is legal only when the Audience row is byte-exactly the target
registered-scopes set under the unchanged frozen non-scope-field checks
(including `version = 1`); it never repairs, narrows, or unions anything.

### CTR-FMR-003 — Plan-document domain and digest distinctness

The canonical APPLY plan document carries the operation discriminator
(`UPDATE_GRANT_ONLY` vs `UPDATE_AUDIENCE_AND_GRANT`) and
`expected_audience_scopes` reflects the observed pre-state (target for the
Grant-only shape). The three canonical digests (both-rows APPLY, Grant-only
APPLY, NOOP) are pairwise distinct; the governed audit binds the digest of
whichever APPLY shape produced the target state, and the target-state audit
validation accepts exactly those two digests. `CTR-FMG-016` authorization
binds the exact plan digest exactly as before.

### CTR-FMR-004 — Conformance matrix extension

The conformance harness proves, in the disposable PostgreSQL container: the
redeploy pre-state plans `UPDATE_GRANT_ONLY` read-only with a distinct digest;
Grant-only apply leaves the Audience row byte-identical, moves the Grant
`1 -> 2`, appends exactly one governed audit binding the Grant-only digest;
the exact rerun is NOOP with all writes zero; `--verify-state` passes; and the
reverse mixed direction (Audience source / Grant target) still conflicts with
zero writes.

## 5. Acceptance

### ACC-FMR-001 — Harness green including new cases

- Command: `scripts/run-forum-moderator-grant-supply-v1-conformance.sh`
- Expected: `FMG_TEMP_DB_CONFORMANCE=PASS`, container absent on exit; new
  tests present and passing alongside the full parent matrix.

### ACC-FMR-002 — Pin and discriminator surface

- Method: plan output inspection for `PLAN_OPERATION=UPDATE_GRANT_ONLY`;
  refusal message uses the constant for Bundle mismatches; no functional
  `1.7.0` pin remains in the vehicle or harness (the version constant, the
  harness precondition, and every test fixture literal are `1.8.0`;
  historical provenance prose in comments is exempt).

### ACC-FMR-003 — Parent invariants byte-unchanged

- Method: diff review — no change to identity constants, scope constants,
  audit envelope keys, `PRODUCTION_APPLY_AUTHORITY = none` refusal path
  ordering, table locks, or isolation level; the parent Spec file is not
  edited by the implementation commits.

## 6. Alternatives and disposition

- **ALT-FMR-001 — Force the DB Audience row back to the source set before
  running the parent vehicle unmodified.** Rejected: it mutates production
  state the Bundle redeploy legitimately established and inverts the
  registry's authority direction.
- **ALT-FMR-002 — Float the Bundle pin to "any registered Bundle".** Rejected:
  the parent's exact-pin philosophy is load-bearing for `CTR-FMG-016`
  authorization binding; a float weakens it.
- **ALT-FMR-003 — Whole successor Spec.** Rejected: the delta is two
  mechanical contracts; a successor would re-litigate the accepted parent
  for no semantic gain.

## 7. Production boundary

This amendment grants no production authority. The apply path remains
`PRODUCTION_APPLY_AUTHORITY = none` (CTR-FMG-016) with its separate exact
authorization; no step of this amendment touches any production database,
runtime, deployment, or Forum data.
