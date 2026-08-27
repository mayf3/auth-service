---
spec_id: AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1
    revision: 57f0268d76aa975b7d07a78874a1bf69d2ec3c4d
    relation: interoperates_with
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

## 1. Goal

Freeze the exact, fail-closed, one-shot authority for the auth-service side
of the **dedicated system Agent** `agt_workflow-dispatcher-hr-agent`
(OWNER_RULING = `DEDICATED_SYSTEM_AGENT_MODEL`): exactly one Principal, one
Client, an exact minimal grant set, the raw-secret handoff path, exact-rerun
NOOP semantics, and rollback/revoke. Nothing else — in particular this Spec
does NOT govern the svc-workflow role grants (governed by
`SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1` — final DUAL_GLOBAL_READER_MODEL:
the dispatcher and the HR main identity each get the read-only
GLOBAL_WORKFLOW_READER role; neither gets COORDINATOR), nor the Agent
definition / runtime directory / scheduler execution / wake path / HR
scheduler tools (governed by dsh-agent-core `AGENT_CORE_HR_DISPATCHER_V1`).

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
  2. audience governing the agent_wake broker local capability
     (per dsh-agent-core AGENT_CORE_HR_DISPATCHER_V1 §4.1)
     scopes = {agent.wake}
```

Forbidden on this identity — any of these appearing at creation, or later
by drift, is a BLOCKER (audits verify):

```text
workflow.execute = FORBIDDEN      workflow.admin = FORBIDDEN
scheduler.manage = FORBIDDEN      scheduler.read = FORBIDDEN
                                   (zero scheduler scopes of any kind)
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
1. svc-workflow coordinator role revoke (governed by the svc-workflow Spec)
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

## 8. Alternatives and disposition

- Grant coordinator to HR main identity — rejected (HR lineage holds
  workflow.execute-capable credentials; svc-workflow Spec §3 evidence).
- Reuse an existing fleet client for the dispatcher — rejected: violates
  identity separation and the no-fleet-impact ruling.
- No-Client token path / shared service token — rejected: no per-identity
  audit, no revocability, violates the dedicated-identity model.
- Wider grant now, narrow later — rejected: exact-minimal at creation;
  widening requires explicit owner authorization and audit (§3 BLOCKERs).

## 9. What this PR changes

```text
DOCS ONLY — exactly one new spec file + one docs/specs/README.md index row.
IDENTITY_CHANGE = NONE
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```
