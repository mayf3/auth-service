---
spec_id: LIFE_WORKBENCH_AGENT_ACCESS_POLICY_V1
status: accepted
spec_kind: policy
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-06
accepted_date: 2026-09-06
accepted_by: mayf3
accepted_reviewed_base: f6382b860941cef0b9b97a1bf69b79e58f0350f3
accepted_reviewed_spec_commit: 8c19679e5ba57ea50bc8a9050d06cec149517f8c
acceptance_review_verdict: PASS
acceptance_time_utc: 2026-09-06T15:06:02Z
semantic_delta_after_review: NONE
scope:
  - mayf3/auth-service
  - Life Workbench Agent access policy (entitlement / provisioning preconditions / runtime readiness)
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
    revision: accepted-at-source-repository # exact blob pin is bound at acceptance rebind (ACCEPTED_AUTHORITIES)
    relation: semantics_anchor
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# LIFE_WORKBENCH_AGENT_ACCESS_POLICY_V1

> **PROPOSED — DOCS ONLY.** While proposed, this Spec authorizes nothing:
> no production mutation, no Grant, no deployment, no merge. Acceptance
> binds `ACCEPTANCE_ACTOR`, `ACCEPTED_AT`, and the exact reviewed head;
> implementation and production rounds remain separately authorized
> (CENTRAL_CHANGE_PLAN_V1 D1–D4 in mayf3/personal-cognition-audit
> `docs/auth-pilot/candidates/`).

## 1. Goal

State the standing product rule for Agent access to the local Life Workbench
pilot (`http://127.0.0.1:7781`, data dir `/Users/yanfenma/pca-life-pilot-trial`;
no formal Life data sources), and separate three load-bearing layers that must
never be conflated:

1. **ACCESS_ENTITLEMENT** — the product-level standing qualification;
2. **GRANT_PROVISIONING_PRECONDITIONS** — identity facts required before an
   Auth Grant may be supplied;
3. **RUNTIME_READINESS** — trusted-call-chain availability.

Agent base capabilities under this policy are exactly:

```text
workbench.read    GET /api/entries, /api/proposals, /api/search, /api/explain/:id
workbench.propose POST /api/entries, /api/proposals (pending-source capture, candidate proposals)
```

Agents NEVER gain: source acceptance, review decisions, approval, commit,
export, audit read, administration, owner roles, or direct database writes.
Central scopes never replace Workbench domain authorization.

## 2. Scope and non-goals

In scope: the three-layer rule, its machine-checkable definitions, state
names, and the fixed boundaries below.

Out of scope (forbidden): any audience or scope registration (that is
`LIFE_WORKBENCH_AUDIENCE_CCR_V1`); any Grant supply (per-rollout exact supply
specs); any Principal/Client/credential mutation; blanket IAM or a generic
policy engine; user-level 8787 Runtime; formal Life data; production apply.

## 3. The three layers

### 3.1 ACCESS_ENTITLEMENT (product standing)

A formally managed, currently enabled Agent holds, in principle, the
Life Workbench read/propose entitlement:

| # | Check | Authority | Machine test |
|---|-------|-----------|--------------|
| E1 | agentId exists in the canonical Agent Definition named by the accepted authority | Agent Definition config `agents.json` under accepted `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` (mayf3/dsh-agent-core), loaded via `agent-definition` validators; instance = the trusted Runtime carrying the pilot call (this pilot: system-level authsvc Runtime, `--root /Users/authsvc/.agent-core`) | `A ∈ config.agents` with a validator-valid id |
| E2 | definition currently enabled | same | definition of A has `disabled=false` |

E1 ∧ E2 ⇒ entitled. Entitlement is NOT revoked by provisioning or runtime
gaps (see 3.2/3.3); it is a product standing, not a token, not a credential,
and not a Grant.

### 3.2 GRANT_PROVISIONING_PRECONDITIONS

| # | Check | Authority | Machine test |
|---|-------|-----------|--------------|
| E3 | Auth Principal active | production auth-service DB `machine_principals` | row with principal_type='agent', agent_id=A, status='active' |
| E4 | MachineClient active and bound to that Principal | same, `machine_clients` | row with status='active', machine_principal_id = E3 row id; provenance consistency of principal/client `external_ref` recorded at provisioning time (provenance is evidence, never the rule) |

If E3/E4 fail: state = **`ELIGIBLE_BUT_IDENTITY_NOT_READY`**. Remedy through
standard identity provisioning only (existing machine-admin / Provisioning
Broker flows). MUST NOT bypass Auth, MUST NOT auto-create ad-hoc identities,
and the failure MUST NOT be read as absence of entitlement.

### 3.3 RUNTIME_READINESS

| # | Check | Authority | Machine test |
|---|-------|-----------|--------------|
| E5 | trusted Broker credential currently resolvable | Agent Core trusted-parent `AGENT_CORE_CREDENTIALS_FILE` store (0600, trusted-parent only; `credential-store.js` fail-closed) | `resolveCredentialMetadata(A) = PRESENT` |

If E5 fails: state = **`AUTHORIZED_BUT_RUNTIME_NOT_READY`**. Remedy by
repairing the credential/runtime chain. MUST NOT delete or reject the
entitlement or an already-supplied Grant because of a transient credential
fault. With no credential, the Gateway fails closed
(`credential_unavailable`) — a runtime state, not an authorization revoke.

## 4. Fixed boundaries (load-bearing, non-negotiable)

```text
PILOT_ROSTER                  != FINAL_ELIGIBILITY_RULE
external_ref provenance       != eligibility policy
Credential existence          != service entitlement
VALID_TOKEN                   != AUTHORIZED_OPERATION
SCOPE                         != DOMAIN_AUTHORIZATION
```

- Test/E2E/canary fixture principals have no entitlement.
- A Runtime default Agent is entitled by nothing.
- Any actual authorization set at any time = exactly the explicit
  `machine_access_grants` rows supplied through governed, exact-plan-bound
  rollout specs (canary-first, rerun=NOOP, conflict fail-closed, closed audit
  envelope).

## 5. Decisions

### DEC-LWAP-001 — Three layers are distinct and separately stated
Entitlement (3.1) is a product standing; preconditions (3.2) gate Grant
supply only; readiness (3.3) gates execution only. No layer may be inferred
from another.

### DEC-LWAP-002 — Eligibility authority is the Agent Definition config, not naming
`external_ref` prefixes, OS users, display names, directories, client counts,
and Runtime defaults are excluded as eligibility tests. E1 is membership in
the accepted canonical Agent Definition config.

### DEC-LWAP-003 — Pilot rollouts are bounded and never self-extend
Each rollout freezes an explicit roster + plan digest under its own child
supply spec; a pilot roster must never be cited as the final rule, and policy
acceptance does not authorize any rollout by itself.

## 6. Current state

- `STATE-LWAP-001` — Drafted candidate exists outside this repository
  (mayf3/personal-cognition-audit workbench `docs/auth-pilot/`, candidate
  head lineage `6f3ca06 → 3fcbe8f → f8d8bd9 → 7756c08`), independently narrow
  reviewed FAIL→FIX→PASS. This proposed Spec is the authoritative restatement;
  on acceptance the candidate docs reference back to this file.
- `STATE-LWAP-002` — Mechanical facts already fixed and closed (not
  re-investigated): TOKEN_PATH_COMPATIBILITY = PASS (production v1 direct
  path issues RS256/kid tokens whose claims match the Life Workbench
  verifier); ELIGIBILITY_AUTHORITY = POLICY_GAP closed by this Spec upon
  acceptance.

## 7. Acceptance binding (filled at acceptance)

```text
ACCEPTANCE_ACTOR   = <owner>
ACCEPTED_AT        = <timestamp>
REVIEWED_HEAD      = <exact commit of this file>
SEMANTIC_DELTA_AFTER_REVIEW = <NONE | exact list>
```
