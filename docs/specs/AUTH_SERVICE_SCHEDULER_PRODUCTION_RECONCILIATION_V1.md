---
spec_id: AUTH_SERVICE_SCHEDULER_PRODUCTION_RECONCILIATION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-04
accepted_date: 2026-09-04
accepted_by: mayf3
accepted_reviewed_spec_commit: f3a4599e33d86831902cfe6ab57a1429d21abc8e
acceptance_review_verdict: PASS
acceptance_authority_basis: >-
  Owner BATCHED OWNER ACCEPTANCE = ACCEPT of both reconciliation PRs at these
  exact heads (dsh PR #164 @ dfa0f599…, auth PR #52 @ f3a4599…) on 2026-09-04,
  after ONE independent reconciliation review + ONE blocker-union fix + ONE
  exact-head re-audit (RE_AUDIT=PASS, BLOCKER_UNION_RESIDUAL=[]).
scope:
  - current-state adoption record for the already-live auth 1.7.0 scheduler face and the exact scheduler.admin operational Grant
  - honest recording of the early-production-execution authority gap on the auth side
  - continued-operation declaration only (any future maintenance mutation requires a NEW fresh authority)
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_SCHEDULER_PRODUCTION_RECONCILIATION_V1

> **ACCEPTED / RECONCILIATION RECORD** (Owner exact-head acceptance
> f3a4599e33d86831902cfe6ab57a1429d21abc8e on 2026-09-04; reviewed content
> unchanged by lifecycle finalization). 本 Spec 不授权任何新的生产 mutation，
> 不产生任何新的 implementation power（implementation_authority = none）。
> 它只采纳并记录一个已经存在、且被 §2 机械证明为安全的当前 auth 生产状态。
>
> **THIS_AUTHORITY_DOES_NOT_RETROACTIVELY_AUTHORIZE_PAST_EXECUTION.**
> §1 记录的每一次早期生产执行在当时都缺乏 effective Authority——该历史事实
> 如实记录，不被本 Spec 的接受所覆盖、改写或追溯授权。
> 未来任何涉及 mutation 的维护：**NEW_FRESH_AUTHORITY_REQUIRED = YES**。

## 1. Exact production-authority census (auth-side executed reality)

All evidence locators are exact (path + sha256, DB row, or transcript line);
timestamps are UTC.

```text
E1  AUTH 1.7.0 deployment (snapshot 57258ec33700af8057ab2ed63fd8e52b3225e749
    → launchd com.auth-service WorkingDirectory flip)
    EXECUTED_AT                     = 2026-09-04T04:27:08Z (apply start) → 04:27:24Z
                                      (health authContractVersion 1.7.0, digest
                                      577a1879a085e89377b02d94782abd64c67131a54d008cf5213cb42ff701536c,
                                      first post-switch poll; pid 54885→56983)
    EXECUTED_PRODUCTION_IDENTITY    = 8-audience registry face @ 57258ec (svc-forum scopes
                                      WITHOUT forum-moderate delta — zero known DB mismatch)
    DURABLE_EVIDENCE                = /Users/yanfenma/workspace/deployment-artifacts/auth-service-bundle-1-7-0-deploy/DEPLOY_TRANSCRIPT_20260904T042708Z.txt
                                      sha256 7940fbd19f6e643a2b916f734f747a2d5aac3016af2bc01ece972144c654bae3
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC = NO (AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
                                      was proposed inside PR #49)
    EARLY_PRODUCTION_EXECUTION      = YES

E2  scheduler AuthAudience DB activation (exactly 1 row + audience.registered audit)
    EXECUTED_AT                     = 2026-09-04T04:27:24.601Z
                                      (auth_security_audits row: event_type=audience.registered,
                                      request_correlation_id=
                                      auth-bundle-1-7-0-scheduler-20260904T042724Z)
    EXECUTED_PRODUCTION_IDENTITY    = auth_audiences row scheduler v1 freeze_ready=true,
                                      machine-only, field-exact vs CCR registry entry
    DURABLE_EVIDENCE                = same transcript as E1 +
                                      /Users/yanfenma/workspace/deployment-artifacts/auth-service-bundle-1-7-0-deploy/BACKFILL_APPLY.raw
                                      sha256 39e5441e9aacd936c81ee536d1a72a2216a279703c9cdc7016f49fcdf887e8f6
                                      (TARGETED_BACKFILL_ROWS_CREATED=1 /
                                      READBACK_MISMATCH=0 / APPLIED=true)
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC = NO (same proposed PR #49 spec)
    EARLY_PRODUCTION_EXECUTION      = YES

E3  operational grants for agt_efficiency-agent (client mc_cF81DF-XND9Zmzao4F08rOK_ /
    machine_clients.id 695d1eeb-3547-4cbd-a72b-915f4ebf25a4) — two ORDERED
    Serializable transactions
    EXECUTED_AT                     = Phase B 2026-09-04T05:49:13.892Z (auth_security_audits
                                      row grant.reactivated, correlation
                                      lane-c-operational-grants-20260904T054913Z-phaseB:
                                      agent-session-messaging row tombstone → {agent.session.send}
                                      version 2, revoked_at NULL) and Phase C 05:49:13.916Z
                                      (grant.operational_created, correlation …-phaseC:
                                      scheduler row {scheduler.admin} version 1)
    EXECUTED_PRODUCTION_IDENTITY    = Phase B row live v2 (LANE B SCOPE — recorded as executed
                                      fact, NOT adopted or ratified here); Phase C row live v1;
                                      scheduler audience total grants = 1; positive token claims
                                      proofs exact (both audiences); negatives (audit scope /
                                      alias / target client) fail-closed
    DURABLE_EVIDENCE                = /Users/yanfenma/workspace/deployment-artifacts/scheduler-admin-grant-v1/TRANSCRIPT_apply_20260904T054913Z.txt
                                      sha256 51e0e89ff69f74f06abc46b9508416019a1a0c2ff9bd710738fabd11af6f6634
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC = NO (AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
                                      was proposed inside PR #49)
    EARLY_PRODUCTION_EXECUTION      = YES
```

PAST_AUTHORITY_GAP = HONESTLY_RECORDED (E1–E3 all EARLY). No later acceptance
rewrites that history. Phase B's authority gap is tracked under Lane B
resumption — OUT OF SCOPE for this record's adoption scope (§3).

## 2. Current-state safety proof (mechanical, post-hoc)

```text
S1 live auth face        : /api/health 1.7.0 digest 577a1879 (stable since E1); pid 56983
                           from the 57258ec snapshot; plist WorkingDirectory → that
                           snapshot only; plist preimage 85dda5009f492ab2e958f578d7ebab263a656243186027921a22d12269d84d75
                           backed up
S2 registry/DB census    : all 8 audiences field-exact vs runtime registry (zero mismatch —
                           the 57258ec face carries no forum-moderate delta)
S3 grant face            : scheduler audience total grants = 1 (the E3 Phase C row, live,
                           scopes {scheduler.admin} v1, revoked_at NULL); no other agent holds
                           any scheduler grant; scheduler.audit ungranted
S4 wire-proof live       : the production cross-target scheduler create committed only via a
                           real (scheduler, scheduler.admin) token mint (dsh-side canary)
S5 negatives fail-closed : audit scope / alias / target-client requests issue no token
S6 token correctness     : positive proofs decoded claims exact (sub b21ddb23… /
                           aud agent-session-messaging + scheduler / scope exact /
                           client_id mc_cF81DF… / agent_id agt_efficiency-agent), digests
                           0eff7eb8… / a58e2c86… recorded in the transcript
```

CURRENT_AUTH_STATE = MECHANICALLY_PROVEN_SAFE (S1–S6). The equal-face rollback
boundary (plist preimage 85dda500… + 4d383ee snapshot intact) remains the
compensation path if fresh safety evidence ever requires it.

## 3. Adopted current state (scope of THIS record)

- **A. the live Auth 1.7.0 scheduler face**: 1.7.0/digest 577a1879 registry, the
  single `scheduler` auth_audiences row (machine-only, v1, freeze_ready), as
  deployed from snapshot 57258ec;
- **B. the exact scheduler.admin operational Grant**: the single E3 Phase C row;
- **C. continued operation** of that face. The semantics of that state continue
  to be described by the already-accepted parent contracts
  (MINIMAL_AUTH_FOUNDATION_V2 / AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1); THIS
  Spec creates no new implementation power. **Any future maintenance involving a
  production mutation requires a NEW fresh authority:
  NEW_FRESH_AUTHORITY_REQUIRED = YES**;
- **D. provenance and receipts** named in §1.

OUT OF SCOPE: Lane B / agent_session_send (PAUSED_EXTERNAL_DEPENDENCY per Owner
OPTION_C ruling 2026-09-04; the executed Phase B reactivation is recorded as
fact in §1 E3 but NOT adopted or ratified here — its authority gap is tracked
under Lane B resumption); `scheduler.audit` granting; history activation; any
new grant/audience/deployment.

## 4. Root cause of the authority gap

The executed path diverged from the planned authority DAG when Lane B was
paused (OPTION_C) while Lane C proceeded on the independent scheduler closure:
the proposed PR #49 specs froze sequencing preconditions (Lane B permanent
grant → Lane B terminal → Phase C) that no longer matched the actual safe
serial path. Production proceeded under live Owner direction with per-step
mechanical gates (premutation simulation, dual-context smokes, sealed vehicles,
independent reviews, receipts) but without effective accepted authorities for
E1–E3. This gap is closed going forward by THIS spec's acceptance — not
backwards. Engineering lesson recorded: when execution order diverges from a
stacked authority plan, the surviving specs must be reconciled (or re-authored)
BEFORE production execution, not after.

## 5. Disposition of the never-effective proposed candidates

The following were NEVER accepted/merged/effective; they are recorded solely as
HISTORICAL_ENGINEERING_INPUT / STALE_PROPOSED_CANDIDATES — **not as authority
predecessors**, and this Spec claims no supersession relationship to them:

- auth PR #49 (head 3ec474379670f3c0a905b24499f4acaaf8e1ead9) carrying
  AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1 and
  AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1: their closure/rollout
  analysis matches the executed artifacts and is incorporated as factual
  engineering input; their frozen sequencing preconditions diverged from the
  executed safe path.

NON_NORMATIVE_COORDINATION_REFERENCE (not a governing dependency, not an
acceptance precondition): the companion current-state record lives at
mayf3/dsh-agent-core PR #164 (dsh-side census E4–E6) — see that PR for the
runtime/canary facts; this Spec stands alone for the auth-side facts.

## 6. Continued-operation declaration

- The 1.7.0/`577a1879` face and the single scheduler.admin grant are the
  production baseline. THIS Spec declares continued operation of exactly that
  state and nothing else.
- Future auth-side mutations respect the global serialization lock and the
  honest-census discipline established by AUTH_BUNDLE_1_6_0_DEPLOY audit.
- The equal-face rollback boundary stays provisioned; exercising it follows
  equal-face compensation semantics.
- **NEW_FRESH_AUTHORITY_REQUIRED = YES** for any future maintenance mutation.

## 7. Acceptance scheme

proposed → ONE independent reconciliation review (census arithmetic, receipts,
current-state safety) → ONE blocker-union fix → ONE re-audit → Owner exact-head
acceptance. Acceptance RATIFIES_CURRENT_SAFE_STATE=YES and
AUTHORIZES_CONTINUED_OPERATION=YES; it does NOT retroactively authorize E1–E3,
grants no implementation authority, and authorizes no future mutation.
PRODUCTION_MUTATION_THIS_RECONCILIATION = NONE (docs-only).
