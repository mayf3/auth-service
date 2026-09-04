---
spec_id: AUTH_SERVICE_SCHEDULER_PRODUCTION_RECONCILIATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-04
scope:
  - adopt-and-ratify the already-live auth 1.7.0 scheduler face and the exact scheduler.admin operational Grant
  - honest recording of the early-production-execution authority gap on the auth side
  - continued-operation and future-maintenance authority for that state
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_SCHEDULER_PRODUCTION_RECONCILIATION_V1
    revision: proposed (companion reconciliation Spec, same date)
    relation: interoperates_with
supersedes:
  - AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1 (stale proposed candidate, auth PR #49 — sequencing preconditions diverged from the executed path and were never effective; superseded as authority, retained as historical engineering input)
  - AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1 (stale proposed candidate, auth PR #49 — same disposition for its Phase C scheduler.admin grant; its Phase B Lane B grant governance gap is tracked under Lane B resumption, OUT OF SCOPE here)
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_SCHEDULER_PRODUCTION_RECONCILIATION_V1

> **PROPOSED / RECONCILIATION AUTHORITY.** 本 Spec 不授权任何新的生产 mutation。
> 它只采纳并治理一个已经存在、且被机械证据证明为安全的当前 auth 生产状态。
>
> **THIS_AUTHORITY_DOES_NOT_RETROACTIVELY_AUTHORIZE_PAST_EXECUTION.**
> §1 记录的早期执行在当时缺乏 effective Authority——该历史事实如实记录，
> 不被本 Spec 的接受覆盖。

## 1. Exact production-authority census (auth-side executed reality)

```text
E1  AUTH 1.7.0 deployment (snapshot 57258ec33700af8057ab2ed63fd8e52b3225e749
    → launchd com.auth-service WorkingDirectory flip)
    EXECUTED_AT                     = 2026-09-04T04:27:08Z–04:27:24Z; health reached
                                      authContractVersion 1.7.0 digest
                                      577a1879a085e89377b02d94782abd64c67131a54d008cf5213cb42ff701536c
                                      on the first post-switch poll; pid 54885→56983
    EXECUTED_PRODUCTION_IDENTITY    = 8-audience registry face @ 57258ec (svc-forum scopes
                                      WITHOUT forum-moderate delta — zero known DB mismatch);
                                      transcript DEPLOY_TRANSCRIPT_20260904T042708Z.txt
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC = NO (AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
                                      was proposed inside PR #49)
    EARLY_PRODUCTION_EXECUTION      = YES

E2  scheduler AuthAudience DB activation (exactly 1 row + audience.registered audit row,
    correlation auth-bundle-1-7-0-scheduler-*)
    EXECUTED_AT                     = 2026-09-04T04:27:24Z (same serialized run as E1)
    EXECUTED_PRODUCTION_IDENTITY    = auth_audiences row scheduler v1 freeze_ready=true,
                                      field-exact vs CCR registry entry (readback in transcript)
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC = NO (same proposed PR #49 spec)
    EARLY_PRODUCTION_EXECUTION      = YES

E3  operational grants for agt_efficiency-agent (client mc_cF81DF-XND9Zmzao4F08rOK_ /
    uuid 695d1eeb-3547-4cbd-a72b-915f4ebf25a4) — two ORDERED Serializable transactions
    EXECUTED_AT                     = 2026-09-04T05:49:13Z (TRANSCRIPT_apply_20260904T054913Z.txt)
    EXECUTED_PRODUCTION_IDENTITY    = Phase B: agent-session-messaging row reactivated
                                      (tombstone → scopes {agent.session.send} version 2,
                                      revoked_at NULL; audit grant.reactivated) — LANE B SCOPE,
                                      recorded as fact, NOT ratified here;
                                      Phase C: scheduler row created (scopes {scheduler.admin}
                                      version 1; audit grant.operational_created);
                                      positive token claims proofs exact (both audiences);
                                      negatives (audit scope / alias / target client) fail-closed;
                                      scheduler audience total grants = 1
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC = NO (AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
                                      was proposed inside PR #49)
    EARLY_PRODUCTION_EXECUTION      = YES
```

PAST_AUTHORITY_GAP = HONESTLY_RECORDED (E1–E3 all EARLY). No later acceptance
rewrites that history.

## 2. Current-state safety proof (mechanical, post-hoc)

```text
S1 live auth face        : /api/health 1.7.0 digest 577a1879 (stable since E1); pid 56983
                           from the 57258ec snapshot; plist points to that snapshot only
S2 registry/DB census    : all 8 audiences field-exact vs runtime registry (zero mismatch —
                           the 57258ec face carries no forum-moderate delta)
S3 grant face            : scheduler audience total grants = 1 (the E3 Phase C row, live,
                           scopes {scheduler.admin} v1); no other agent holds any scheduler
                           grant; scheduler.audit ungranted
S4 wire-proof live       : the production cross-target scheduler create committed only via a
                           real (scheduler, scheduler.admin) token mint (dsh-side canary E5)
S5 negatives fail-closed : audit scope / alias / target-client requests issue no token
S6 token correctness     : positive proofs decoded claims exact (sub/aud/scope/client_id/
                           agent_id), digests recorded in transcript
```

CURRENT_AUTH_STATE = MECHANICALLY_PROVEN_SAFE (S1–S6). The equal-face rollback
boundary (plist preimage 85dda500… + 4d383ee snapshot intact) remains the
compensation path if fresh safety evidence ever requires it.

## 3. Ratified current state (scope of THIS authority)

- **A. the live Auth 1.7.0 scheduler face**: 1.7.0/digest 577a1879 registry, the
  single `scheduler` auth_audiences row (machine-only, v1, freeze_ready), as
  deployed from snapshot 57258ec;
- **B. the exact scheduler.admin operational Grant**: the single E3 Phase C row;
- **C. adoption + continued operation + future maintenance** of that face under
  the frozen MINIMAL_AUTH_FOUNDATION_V2 / Scheduler CCR contracts (V1 issuance
  against machine_access_grants; audience registry consistency; one-shot
  semantics);
- **D. provenance and receipts** named in §1.

OUT OF SCOPE: Lane B / agent_session_send (PAUSED_EXTERNAL_DEPENDENCY per Owner
OPTION_C ruling 2026-09-04; the executed Phase B reactivation is recorded as
fact in §1 E3 but NOT ratified here — its authority gap is tracked under Lane B
resumption); `scheduler.audit` granting; history activation; any new
grant/audience/deployment.

## 4. Root cause of the authority gap

The executed path diverged from the planned authority DAG when Lane B was
paused (OPTION_C) while Lane C proceeded on the independent scheduler closure:
the proposed PR #49 specs froze sequencing preconditions (Lane B permanent
grant → Lane B terminal → Phase C; and a deployment authority authored for a
combined overnight plan) that no longer matched the actual safe serial path.
Production proceeded under live Owner direction with per-step mechanical gates
(simulation, dual-context smokes, sealed vehicles, independent reviews,
receipts) but without effective accepted authorities for E1–E3. This gap is
closed going forward by THIS spec's acceptance — not backwards. Engineering
lesson recorded: when execution order diverges from a stacked authority plan,
the surviving specs must be reconciled (or re-authored) BEFORE production
execution, not after.

## 5. Continued-operation and maintenance contracts

- The 1.7.0/`577a1879` face and the single scheduler.admin grant are the
  production baseline; changes replay through fresh exact-head authorities with
  the converged vehicle discipline (premutation simulation, dual-context smoke,
  typed-phrase/sudo terminal vehicles, independent review, one Owner execution).
- Future auth-side mutations respect the global serialization lock and the
  honest-census discipline established by AUTH_BUNDLE_1_6_0_DEPLOY audit.

## 6. Acceptance scheme

proposed → ONE independent reconciliation review (census arithmetic, receipts,
current-state safety) → ONE blocker-union fix → ONE re-audit → Owner exact-head
acceptance → lifecycle-only finalization → merge. Acceptance
RATIFIES_CURRENT_SAFE_STATE=YES and AUTHORIZES_CONTINUED_OPERATION=YES; it does
NOT retroactively authorize E1–E3. PRODUCTION_MUTATION_THIS_RECONCILIATION =
NONE (docs-only).
