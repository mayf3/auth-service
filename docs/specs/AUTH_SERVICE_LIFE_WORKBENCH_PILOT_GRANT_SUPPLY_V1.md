---
spec_id: AUTH_SERVICE_LIFE_WORKBENCH_PILOT_GRANT_SUPPLY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-06
scope:
  - mayf3/auth-service
  - Life Workbench two-Client pilot MachineAccessGrant supply/revoke authority
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
  - LIFE_WORKBENCH_AGENT_ACCESS_POLICY_V1 (accepted)
  - LIFE_WORKBENCH_AUDIENCE_CCR_V1 (accepted)
external_authorities: []  # downstream child of the two accepted authorities;
                          # pins no further external head.
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_LIFE_WORKBENCH_PILOT_GRANT_SUPPLY_V1

> **PROPOSED — DOCS ONLY.** While proposed this Spec authorizes nothing.
> Acceptance binds the exact reviewed head below and authorizes ONLY the
> contracts closure of §4 (supply/revoke/rollback scripts + conformance
> harnesses). Production apply of D1/D2/D3 remains a separately approved
> owner operation (approvalRef), executed through the authsvc operator path.
> PILOT_ROSTER != FINAL_ELIGIBILITY_RULE.

## 1. Goal

Freeze the exact-plan-bound, fail-closed, idempotent authority for supplying
and revoking the first rollout of Life Workbench machine Grants:

```text
AUDIENCE_ID        = life-workbench (registered by accepted LIFE_WORKBENCH_AUDIENCE_CCR_V1)
TARGET_SCOPES      = [workbench.propose, workbench.read]
TARGET_ROWS        = 2 x life-workbench, one per Client, IF ABSENT CREATE
FLEET_SCOPE        = exactly the two Clients below; no other Client, no other
                     audience, no wildcard, no legacy-field touch
PLAN_SHA256        = ac845e49d8db18d041732682a387536fac9b58cd1bdc30ec5d231998d534049c
                     (canonical form bound in both scripts, re-verified at start)
```

Pilot roster (identity metadata verified active 2026-09-06):

| agentId | Client ID | Client external_ref |
|---|---|---|
| agt_build-in-public-agent | mc_ohDTyGYRpBLI4qN_sVU88aob | agentcore:v1:client:agt_build-in-public-agent |
| agt_daily-thought-agent | mc_PejtHjDXtQ-lS6boaBYAAL12 | agentcore:v1:client:agt_daily-thought-agent |

## 2. Scope and non-goals

In scope: exact 2-row supply, symmetric revoke, audience-row rollback
end-state executor, their isolated conformance harnesses.

Out of scope (forbidden): any third Client; workflow.execute/forum.*/`*`;
allowedResources/allowedScopes read or write (LEGACY_FIELD_TOUCH=FORBIDDEN,
read counts MUST stay 0); Principal/Client/credential creation or mutation;
broader-fleet or all-Agent rollout; production apply.

## 3. Semantics (shared with the accepted supply precedents)

- Exact-plan-bound: both scripts re-derive the canonical plan digest and abort
  on mismatch before touching any database.
- Serializable transaction + per-task advisory lock
  (supply/revoke share 813_947_304; audience rollback uses 813_947_305).
- Identity preconditions per accepted ACCESS POLICY: active agent Principal +
  active bound Client with exact external_ref provenance; failures are
  ELIGIBLE_BUT_IDENTITY_NOT_READY and abort (never auto-provision).
- Create audited in the closed 13-column grant_change_audits envelope
  (changeType='create'); NOOP rerun writes no audit row. Revoke = ROW DELETE
  (machine_access_grants has no effective soft-delete: the production column
  is schema drift invisible to Prisma and to V1 issuance) with the full
  removed row in before_value (changeType='revoke', resulting version 0).
- Conflict (existing grant differs from the frozen plan) = fail-closed abort.
- Operators authenticate via the authsvc operator path (DATABASE_URL from the
  trusted .env); OPERATOR_ID / APPROVAL_REF / SOURCE_GIT_COMMIT are mandatory
  and land in every audit row.

## 4. Contracts closure (CTR-LWP-001)

- `scripts/supply-life-workbench-pilot-grants-v1.ts`
- `scripts/revoke-life-workbench-pilot-grants-v1.ts`
- `scripts/run-life-workbench-pilot-grants-v1-conformance.sh`
- `scripts/reconcile-life-workbench-audience-rollback-v1.ts` (CCR §5 end-state
  executor; precondition asserts pilot grants already revoked)
- `scripts/reconcile-life-workbench-audience-registry-v1.ts` (accepted CCR
  §4.2 registration executor)
- `scripts/run-life-workbench-audience-registry-v1-conformance.sh`

## 5. Acceptance binding (filled at acceptance)

```text
ACCEPTANCE_ACTOR   = <owner>
ACCEPTED_AT        = <timestamp>
REVIEWED_HEAD      = <exact commit of this file>
SEMANTIC_DELTA_AFTER_REVIEW = <NONE | exact list>
```
