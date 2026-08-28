---
spec_id: AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities:
  # DAG node 2 of WAKE -> 31 -> 14 -> 83 -> 87. Sole normative dependency =
  # the agent-wake Audience registration authority (sibling PR in THIS
  # repository; accepted and merged to main via PR #32 @ eb1a1c1).
  # Downstream Specs (svc-workflow PR #14, dsh-agent-core PR #83 / PR #87)
  # may pin THIS Spec's final head, never the reverse; this Spec pins no
  # downstream head.
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1
    revision: eb1a1c15488b75c4a1828902f5c65a38178a88ce
    relation: prerequisite_audience_registration (accepted, PR #32 merged
      @ eb1a1c1 — the machine-only agent-profile audience 'agent-wake'
      with registered scope 'agent.wake' that grant entry 2 of §3
      requires; its merged implementation + the resulting registered
      audience are preconditions of this Spec's APPLY round, fail-closed
      per §3.2)
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1

> **PROPOSED — DOCS ONLY.** This Spec authorizes nothing while proposed.
> The PR that carries it adds this file and one `docs/specs/README.md` index
> row, and performs no implementation, no identity creation, no database
> write, no deploy, and no production apply. Creation/apply happen only in
> a separately owner-authorized execution round after acceptance.
>
> **Revision note (2026-08-27, round 2 — lifecycle + dependency-DAG sync):**
> (1) Lifecycle correction: `implementation_authority = none` and
> `production_apply_authority = none` while proposed — a proposed Spec
> carries no contracts authority (docs/specs/README.md implementation
> rule; index row synced). The §3.1 PLAN/APPLY/VERIFY rounds describe the
> FUTURE execution contract, authorized only after acceptance.
> (2) Dependency direction, frozen: WAKE → THIS Spec → svc-workflow
> PR #14 → dsh-agent-core PR #83 → dsh-agent-core PR #87. This Spec's
> sole normative upstream is the agent-wake Audience authority
> (`AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1`, PR #32); it pins no
> downstream head, and downstream artifacts appear only as Non-goals
> descriptions.
>
> **Revision note (2026-08-28, round 3 — upstream acceptance pin sync):**
> The sole normative upstream `AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1`
> completed its acceptance transaction and merged to main via PR #32
> (merge commit `eb1a1c15488b75c4a1828902f5c65a38178a88ce`; spec status
> proposed → accepted, implementation_authority → contracts, §15
> Acceptance Record: 唤醒 审计 = PASS, BLOCKERS = NONE). This round
> re-anchors the dependency pin from the proposed branch head (3a1f5cd)
> to that accepted main head — frontmatter revision/relation, §3.2 and
> §9 status annotations only. Every frozen field of this Spec (§2
> identity model, §3 exact grant shape + forbidden scopes, §4 secret
> handoff, §5 NOOP/conflict, §6 rollback, §7 ACs) is byte-preserved;
> this round creates no Principal / Client / Secret / Grant and changes
> no code.

## 1. Goal

Freeze the exact, fail-closed, one-shot authority for the auth-service side
of the **dedicated system Agent** `agt_workflow-dispatcher-hr-agent`
(OWNER_RULING = `DEDICATED_SYSTEM_AGENT_MODEL`): exactly one Principal, one
Client, an exact minimal grant set (`workflow.read` + `agent.wake`), the
raw-secret handoff path, exact-rerun NOOP semantics, and revoke / rollback.
Nothing else — in particular this Spec does NOT govern the svc-workflow
role grants (governed
by `SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1` — final DUAL_GLOBAL_READER_MODEL:
the dispatcher and the HR main identity each get the read-only
GLOBAL_WORKFLOW_READER role; neither gets COORDINATOR), nor the Agent
definition / runtime directory / scheduler execution / wake path / HR
scheduler tools (governed by dsh-agent-core `AGENT_CORE_HR_DISPATCHER_V1`).
Those downstream responsibilities are DESCRIBED here (Non-goals) but never
DEPENDED on: this Spec takes no authority from, and pins no exact head of,
any downstream artifact (dependency DAG, frozen: agent-wake Audience CCR
PR #32 → this Spec → svc-workflow PR #14 → dsh-agent-core PR #83 →
dsh-agent-core PR #87; direction is one-way and may not be inverted). The
sole normative upstream dependency of this Spec is the agent-wake
Audience registration authority (§3.2).

## 2. Identity model (frozen alignment)

`agt_workflow-dispatcher-hr-agent` is a **dedicated system Agent**: it HAS
an Agent definition, THIS independent Auth Principal/Client, and a minimal
runtime directory (dsh-agent-core side); it has NO Feishu binding and NO
OpenClaw runtime; it CAN be executed by the Agent Core Scheduler. It is NOT
one of the 86 business trusted-fleet identities. Forbidden descriptions
(any artifact describing it thusly is WRONG and must be corrected):
"pure service identity without an Agent lifecycle"; "alias of the HR main
session (`agt_hr-agent`)"; "the 87th business fleet Agent".

```text
HR_MAIN_IDENTITY_UNTOUCHED = YES  (agt_hr-agent / dc702687-… : no principal,
                                    client, grant, scope, or secret change)
FLEET_ROSTER_UNTOUCHED     = YES  (86/86 byte-unchanged; dispatcher is not
                                    a fleet identity)
```

## 3. Exact creation plan (the only authorized shape)

Production read-only evidence at proposal time (2026-08-27): no such
identity exists (active-principal lookup and `machine_principals`
external_ref scan both empty). Creation, when separately authorized, must
produce EXACTLY:

```text
PRINCIPAL (machine_principals)
  agent_id / display purpose = agt_workflow-dispatcher-hr-agent
                               (display purpose: workflow-dispatcher-hr-agent)
  external_ref  = agentcore:v1:principal:agt_workflow-dispatcher-hr-agent
  enabled       = true
CLIENT (machine_clients)
  exactly ONE active client bound to that principal
GRANTS (machine_access_grants) — exactly two entries, nothing else:
  1. audience svc-workflow   scopes = {workflow.read}
  2. audience agent-wake    scopes = {agent.wake}
     (EXACT wake grant, frozen HERE — this Spec is the sole authority for
     the grant shape, and downstream consumers ALIGN to it, never the
     reverse: the dsh-agent-core dispatcher Spec's `agent_wake` capability
     is defined with resource 'agent-wake' and requiredScopes
     ['agent.wake'], and the broker gateway's grant check mints a token for
     resource 'agent-wake' scope 'agent.wake' — all consistent with, and
     downstream of, this row. The Auth grant row is therefore audience
     'agent-wake', scopes exactly {agent.wake}; no downstream exact head is
     pinned or required by this freeze)
```

### 3.1 PLAN / APPLY / VERIFY (phase discipline)

- **PLAN** = §3's exact shape, frozen here; the apply round may not widen,
  reinterpret, or "normalize" it (shape deviation = §5 fail-closed).
- **APPLY** = ONE separately owner-authorized one-shot execution round via
  the existing idempotent machine provisioning seams, only after the §3.2
  dependency precheck; every real write covered by the §3.3 audit envelope.
- **VERIFY** = §7 acceptance criteria executed against read-only production
  evidence before the round is declared done (incl. the AC-4 token probes
  and the AC-5 before/after fleet diff).

### 3.2 Wake-audience dependency (fail-closed activation gate)

`MachineAccessGrant.audience` is FK-bound to `AuthAudience`, and the token
mint additionally enforces the audience registry and principal profile.
Grant entry 2 therefore requires a registered, machine-enabled,
agent-profile audience `agent-wake` whose registered scopes cover
`agent.wake`. That registration now has a dedicated authority:
`AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1` (accepted, PR #32 merged @
eb1a1c15488b75c4a1828902f5c65a38178a88ce) — the Minimal-Auth audience
CCR pattern, same class as
`AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1` / the notification-ingress CCR.
It is this Spec's SOLE normative upstream dependency: its acceptance is
complete (PR #32 merged, status accepted); its merged implementation and
the resulting registered audience (bundle entry + AuthAudience row)
remain preconditions of this Spec's APPLY round.
Fail-closed ruling (unchanged): if audience `agent-wake` is not yet
registered at apply time, the precheck aborts the run with ZERO writes
(no partial apply of grant entry 1 alone, no auto-registration, no
in-place audience improvisation). Until the registration exists, the
`agent_wake` capability stays structurally denied for every identity —
the acceptable fail-closed status quo. Grant entry 1 (`svc-workflow`:
registered, agent-profile, machine-enabled) has no such dependency.

### 3.3 Audit envelope

Every real grant write of the apply round is recorded in the same
serializable transaction as an immutable `grant_change_audits` row using
exactly the current closed 13-field envelope (authority frozen by
`AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1`, carried by
`AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1`; no property outside
the closed envelope). Principal / Client / secret provisioning writes are
recorded by the existing machine provisioning audit discipline. Envelope
rows + receipts are the round's evidence; no secret material ever enters
any audit row, receipt, log, or artifact (§4 zero disclosure).

Forbidden on this identity — any of these appearing at creation, or later
by drift, is a BLOCKER (audits verify):

```text
workflow.execute = FORBIDDEN      workflow.admin = FORBIDDEN
workflow transition (any workflow write/mutation scope) = FORBIDDEN
                                   (structural: zero workflow write scopes)
scheduler.manage = FORBIDDEN      scheduler.read = FORBIDDEN
                                   (zero scheduler scopes of any kind)
forum.write = FORBIDDEN           (zero forum scopes/audiences of any kind)
wildcard = FORBIDDEN              ('*' or any wildcard pattern)
management scope = FORBIDDEN      (svc-auth auth.identity.provision and any
                                   auth.* management scope/audience)
any additional audience/scope    = FORBIDDEN
reuse of any HR main-identity credential = FORBIDDEN
```

The read-only outcome is structural: svc-workflow's coordinator write
endpoints require a `workflow.execute`-scoped token, which auth-service
refuses to mint outside the grant (`scope ⊄ grant.scopes → invalid_scope`).

## 4. Secret handoff (frozen)

- The client raw secret is handed off exactly once, directly into the
  505-private trusted credential store zone used by the dsh-agent-core
  broker identity seam (discipline inherited from
  `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Part H: validate-preserve,
  no chat/log/channel carriage, no second copy).
- The secret is NEVER handed to the HR main session, any human channel, or
  any fleet Agent other than via the dispatcher's own runtime.
- Rotation semantics follow existing auth-service reality: a new secret
  invalidates the old immediately (no grace); rotation requires the same
  one-shot execution discipline.

```text
SECRET_ZERO_DISCLOSURE = YES (frozen): raw secret material exists in
exactly two places — auth-service's stored credential and the one-time
handoff target above. It never appears in any log, chat, channel, PR,
issue, report, audit row, receipt, or Spec text — this document included
(it carries, and can only ever carry, no secret material).
```

## 5. Rerun NOOP and conflict fail-closed

- Exact rerun of the creation plan (same agent_id/external_ref/shape) after
  successful creation = **NOOP with receipt**; no second principal, client,
  or grant row is created (idempotent seams; per-client audit).
- Any pre-existing or concurrently-created identity that matches the key
  but NOT the exact shape (different scopes, extra clients, wrong
  external_ref) = **fail-closed conflict**; the run aborts loud and changes
  nothing. No normalization, no partial adoption.

## 6. Rollback / revoke (frozen order, each step idempotent)

```text
1. svc-workflow GLOBAL_WORKFLOW_READER role revoke (governed by the
   svc-workflow Spec)
2. revoke both grant entries (machine_access_grants)
3. revoke the client (secret immediately invalid)
4. disable the principal
```

Each step leaves an audit row; the plan may be re-applied later only via a
new exact-rerun (§5). No data deletion is required or authorized.

## 7. Acceptance criteria

- AC-1: created shape equals §3 exactly (one principal, one client, two
  grant entries, forbidden-scope set empty); audit receipt present.
- AC-2: exact rerun = NOOP (row counts unchanged, receipt issued).
- AC-3: shape-mismatch rerun (e.g. attempting workflow.execute) =
  fail-closed, zero writes.
- AC-4: token mint with scope=workflow.read succeeds; scope=workflow.execute
  is refused (`invalid_scope`) — structural read-only proof.
- AC-5: HR main + legacy HR identities and all 86 fleet identities
  byte-unchanged (before/after diff empty).
- AC-6: rollback order (§6) executes idempotently in a non-production
  rehearsal; each step auditable.
- AC-7: this PR itself changes no auth-service code (docs only).
- AC-8: zero secret disclosure — no artifact, log, receipt, or audit row
  produced by any round under this Spec contains raw secret material.
- AC-9: audit envelope — every real write of the apply round is covered
  same-transaction by a closed 13-field `grant_change_audits` row (grants)
  or a provisioning audit row (principal/client/secret).
- AC-10: §3.2 precheck — with audience `agent-wake` unregistered, the apply
  run aborts with zero writes and never auto-registers an audience.

## 8. Alternatives and disposition

- Grant the global workflow role to the HR main identity — rejected (the
  withdrawn r2-era coordinator draft; HR lineage holds
  workflow.execute-capable credentials; final DUAL_GLOBAL_READER_MODEL
  gives the HR main identity read-only READER only — that role grant is
  governed downstream by the svc-workflow Spec; described, not depended
  on).
- Reuse an existing fleet client for the dispatcher — rejected: violates
  identity separation and the no-fleet-impact ruling.
- No-Client token path / shared service token — rejected: no per-identity
  audit, no revocability, violates the dedicated-identity model.
- Wider grant now, narrow later — rejected: exact-minimal at creation;
  widening requires explicit owner authorization and audit (§3 BLOCKERs).

## 9. What this PR changes

```text
DOCS ONLY — one new spec file + one docs/specs/README.md index row (plus
this revision round's spec-only amendments; still zero code changes).
IDENTITY_SPEC_PR    = #31 (this branch)
SPEC_STATUS         = proposed (no implementation / production authority
                     while proposed)
IMPLEMENTATION_AUTHORITY  = none
PRODUCTION_APPLY_AUTHORITY = none
IDENTITY_CREATED    = NO
CLIENT_CREATED      = NO
GRANT_CHANGE        = NONE
PRODUCTION_CHANGE   = NONE
SECRET_MATERIALIZED = NO
DEPENDENCY_POSITION = node 2 of WAKE -> 31 -> 14 -> 83 -> 87
UPSTREAM_HEAD_PINS  = AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1 only
                     (mayf3/auth-service PR #32 merged @
                     eb1a1c15488b75c4a1828902f5c65a38178a88ce,
                     accepted)
DOWNSTREAM_HEAD_PINS = NONE (zero normative or exact-head dependencies on
                     PR #14 / PR #83 / PR #87; downstream responsibilities
                     appear only as Non-goals descriptions)
CIRCULAR_AUTHORITY_PIN_COUNT (this Spec) = 0
READY_FOR_SEQUENTIAL_REVIEW = YES (WAKE PR #32 merged + accepted)
```

## 10. Acceptance Record

```text
ACCEPTED_BY = mayf3
INDEPENDENT_REVIEW = 调身 审计 = ACCEPT
REVIEWED_BASE = eb1a1c15488b75c4a1828902f5c65a38178a88ce
REVIEWED_SPEC_HEAD = 5981fece02b62e62926b5e15de32a3bed16c1d2f
BLOCKERS = NONE
REQUIRED_FIXES = NONE
SPEC_PR = mayf3/auth-service#31
LIFECYCLE_DELTA = status: proposed -> accepted;
  implementation_authority: none -> contracts;
  production_apply_authority 保持 none（acceptance 不授权 production
  apply；§3.1 APPLY 轮仍需独立 owner 授权）
SEMANTIC_DELTA_AFTER_REVIEW = NONE
MAIN_AT_REVIEW = eb1a1c15488b75c4a1828902f5c65a38178a88ce（audited head
  5981fec 即 base reconciliation merge of this main tip；main 零新
  commit，无 authority conflict）
PR_DIFF_AT_REVIEW = exactly two files（this Spec + docs/specs/README.md
  index row）
```

头部 PROPOSED blockquote 与 §9 冻结块（含 SPEC_STATUS = proposed /
IMPLEMENTATION_AUTHORITY = none 等 authoring-time 字段）按 PR #27 §12 /
WAKE PR #32 §15 先例保持历史记录不变；本 Record 与 frontmatter 为唯一
lifecycle authority。§1–§9 normative 正文（§2 identity model、§3 exact
grant shape + forbidden scopes、§3.1–§3.3、§4 secret handoff、§5
NOOP/conflict、§6 rollback、§7 ACs、§8 alternatives）byte-preserved，
本次 acceptance 零语义变更。

Acceptance 不产生任何生产效果：不创建 Principal / Client / Secret /
Grant，无 production apply，无代码变更（AC-7 语义保持 docs-only）。
identity 创建的 APPLY 轮属后续独立 owner-authorized 执行轮次（§3.1）。
上游依赖 pin（AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1 @ eb1a1c1，
accepted）保持有效。
