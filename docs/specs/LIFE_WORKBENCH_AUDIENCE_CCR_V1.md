---
spec_id: LIFE_WORKBENCH_AUDIENCE_CCR_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-06
scope:
  - mayf3/auth-service
  - Life Workbench OAuth audience and scope registration authority
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities: []  # DAG ROOT: this Spec pins NO external head. Consumer
                          # context: Life Workbench pilot (personal-cognition-audit
                          # workbench candidate head lineage 6f3ca06..7756c08) is
                          # cited as pending consumer context ONLY, never a pin.
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# LIFE_WORKBENCH_AUDIENCE_CCR_V1

> **PROPOSED — DOCS ONLY.** Acceptance authorizes ONLY the frozen registry
> entry, the version linkage, and the bounded implementation closure below
> (audience registration, machine-only, agent-profile). It creates NO
> Principal, NO Client, NO credential, NO Grant, and has ZERO production
> effect. Grant supply, Broker targets, pilot rollout, and deployment are
> separately authorized rounds (CENTRAL_CHANGE_PLAN_V1 D2/D3).

## 1. Goal

Freeze the minimal OAuth authority for the local Life Workbench pilot:

```text
AUDIENCE_ID              = life-workbench
RESOURCE_SERVICE         = life-workbench
SCOPE_NAMESPACE          = workbench
REGISTERED_SCOPES        = [workbench.propose, workbench.read]
ACCEPTED_PRINCIPAL_TYPES = [agent]
HUMAN_ACCESS_ENABLED     = false
MACHINE_ACCESS_ENABLED   = true
DELEGATED_ACCESS_ENABLED = false
REGISTRY_VERSION         = 1.8.0 -> 1.9.0 (append-only; all nine existing
                           entries byte-unchanged; top-level status stays
                           "frozen")
```

Scope semantics: `workbench.read` covers the four read endpoints
(entries/proposals/search/explain); `workbench.propose` covers pending-source
capture and candidate proposal creation. The registry scope order is
`["workbench.propose", "workbench.read"]` (canonical ASCII order). Owner-side
operations (accept source, review, approve, commit, export, admin) are
registered NOWHERE and can never be expressed in this audience.

## 2. Scope and non-goals

In scope: the exact entry above; version linkage 1.8.0→1.9.0; the bounded
three-file implementation closure (§4); positive/negative conformance
requirements; the rollback end-state (§5).

Out of scope (forbidden): any other audience; any wildcard or unlisted scope;
human/delegated access; any Principal/Client/credential mutation; any Grant
write; any DB write outside the single reconciled `auth_audiences` row;
`production_apply_authority` (deployment is a separate owner gate).

## 3. Decisions

### DEC-LWACCR-001 — Machine-only agent profile, exactly two scopes
Mirrors the accepted scheduler/agent-session-messaging CCR shape. No human
login, no delegation, no third scope; adding scopes later requires a fresh
child authority.

### DEC-LWACCR-002 — Append-only registry delta with digest pin
The 1.9.0 candidate file is frozen at
`docs/auth-pilot/candidates/audience-registry-1.9.0-candidate.json`
(personal-cognition-audit workbench, head `7756c08…` lineage). Its
nine-entry prefix MUST be byte-identical to deployed 1.8.0
(`registry_version` and the appended entry are the only diffs). The exact
`sha256` of the candidate file is bound at implementation-PR time into the
reconcile script's fail-closed digest check.

### DEC-LWACCR-003 — Fail-closed issuance follows from existing machinery
Before registration, `POST /oauth/token` for resource=life-workbench fails
closed (`audience_not_machine_enabled` / unregistered). After registration
and before any Grant, it fails with `machine_grant_missing`; registry drift
fails `audience_registry_mismatch`. No verifier or consumer change is
authorized by this Spec.

## 4. Implementation closure (CTR-LW-001, exactly three files)

1. `contract-bundles/minimal-auth-v1/audience-registry.json` — the 1.9.0
   delta per §1 (candidate bytes pinned per DEC-LWACCR-002); plus the
   regenerated `generated/minimal-auth-v1/runtime-contract.json` snapshot
   (digest-verified loader, existing tooling).
2. `scripts/reconcile-life-workbench-audience-registry-v1.ts` — offline,
   single-row `INSERT OR NOOP` reconcile in one Serializable transaction
   with an `auth_security_audits` record; Metadata requires
   migrationId/sourceGitCommit/operatorId/approvalRef/reason; conflict =
   fail-closed; exact rerun = NOOP. Shape-aligned to the accepted
   `reconcile-svc-forum-audience-registry-v1.ts`.
3. `scripts/run-life-workbench-audience-registry-v1-conformance.sh` —
   isolated-container harness (pinned postgres digest, nonce label, cleanup
   assertions) running positive (row present, exact fields) and negative
   (pre-registration issuance denied; drift denied) checks before any
   production apply.

## 5. Rollback end-state (frozen, pre-agreed)

The ONLY rollback end-state of the audience registration is:

```text
audience row  : status = 'disabled'   (row retained; never DELETE)
registry bytes: reverted to the deployed 1.8.0 file
issuance      : life-workbench requests fail closed again
```

The revert is executed by a governed reconcile variant of file §4.2 with the
same transaction/audit/metadata rules; "keep or delete" is NOT an
implementation-time choice.

## 6. Current state

- `STATE-LWACCR-001` — Registry/DB facts verified 2026-09-06: deployed
  bundle is 1.8.0 with nine audiences; `auth_audiences` has no
  `life-workbench` row; production auth-service runs v1 contract 1.8.0
  (`TOKEN_PATH_COMPATIBILITY = PASS`, closed unless new mechanical
  counterevidence).

## 7. Acceptance binding (filled at acceptance)

```text
ACCEPTANCE_ACTOR   = <owner>
ACCEPTED_AT        = <timestamp>
REVIEWED_HEAD      = <exact commit of this file>
SEMANTIC_DELTA_AFTER_REVIEW = <NONE | exact list>
```
