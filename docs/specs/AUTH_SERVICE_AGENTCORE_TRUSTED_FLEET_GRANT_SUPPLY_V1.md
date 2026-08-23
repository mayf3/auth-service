---
spec_id: AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1

> **PROPOSED — DOCS ONLY.** This child Spec authorizes nothing while proposed.
> `implementation_authority = none` and `production_apply_authority = none`.
> The PR that carries it adds exactly one file (this file) and performs no
> implementation, no database write, no deploy, and no production apply.

## 1. Goal

Freeze an exact-plan-bound, fail-closed, one-time authority for supplying V1
`MachineAccessGrant` rows to the deterministic auth-service clients of the
exact 86 Agent Core trusted-fleet Agents whose Phase A identities and
credentials were restored on 2026-08-23:

```text
FLEET_SIZE                  = 86 (exact; closed set; no substitution)
FLEET_CANARY                = agt_build-in-public-agent (first acceptance object)
TARGET_ROWS                 = 86 × svc-workflow[workflow.read]
                              + 86 × svc-forum[forum.read, forum.write]
                              = 172 grant rows, one audited create per client
FIXED_GIT_SHA_VERSIONED_MIGRATION = REQUIRED (one offline migration)
V1_MACHINE_ACCESS_GRANT_ONLY      = YES
IDENTITY_OR_CREDENTIAL_MUTATION   = FORBIDDEN
LEGACY_FIELD_TOUCH                = FORBIDDEN
```

This Spec extends the two-Audience target tuples already frozen by the accepted
parent `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` from its 2 canary
Clients to the exact 86 fleet Clients. It does not supersede the parent; the
parent remains the authority for its own 2 canary Clients.

## 2. Authority Gate conclusion (why this child exists)

At authoring base `0855dc5161309196ef0cddbf9142e22726961956` (github/main),
no accepted authority covers fleet-scale Grant writes:

| Existing authority | What it actually authorizes | Expansion ruling |
|---|---|---|
| `AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_V1` (accepted) + Stage W Execution V2 (accepted) + merged Stage F implementation | Exactly `agt_stock_agent` and `agt_cto-agent`, 2 Clients, 4 rows (`svc-workflow[workflow.read]` × 2, `svc-forum[forum.read,forum.write]` × 2) | MUST NOT be read to cover any other Client; §2 of the parent lists "any other Scope, Audience, Client, or Principal" as out of scope |
| `AUTH_SERVICE_SVC_FORUM_LEGACY_GRANT_NARROWING_V1` (accepted) | Narrowing one legacy svc-forum grant toward `[forum.read, forum.write]` via its frozen three-file closure | Narrowing-only, single-Client direction; MUST NOT be read as a supply authority |
| `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1` (accepted) | Registration of the `svc-forum` Audience with exactly `forum.read`/`forum.write` | Audience-registry authority; MUST NOT be read as a per-Client Grant authority |

```text
AUTHORITY_SUFFICIENT_FOR_86_FLEET = NO
THEREFORE                          = NEW CHILD SPEC (this document)
IMPLEMENTATION_IN_THIS_PR          = NONE
```

## 3. Scope and non-goals

### In scope

- Resolve, before any write, exactly the 86 `MachineClient.external_ref`
  values in Appendix A for audit client resolution only.
- Validate exact Client-to-Principal identity (active, `principal_type=agent`,
  exact `agent_id`, deterministic Principal external ref) before writes.
- Create or no-op only the 172 target rows of §1 across the 86 Clients.
- Record every real change in immutable `grant_change_audits` in the same
  serializable transaction, using only the current closed 13-field audit
  envelope.
- Canary-first execution order (fleet canary, then the remaining 85), exact
  rerun = NOOP, conflict = fail-closed.

### Out of scope (forbidden)

- `workflow.execute`, `forum.admin`, `forum.moderate`, `*`, any wildcard, any
  unlisted Scope, any additional Audience (including `svc-okr`, `adc-v2`,
  `svc-auth`), any additional Client, any Principal outside Appendix A.
- Creating, claiming, repairing, rotating, or revoking a Principal, Client, or
  credential; any identity or credential mutation.
- Reading, writing, deriving from, mirroring to, validating against, or
  falling back to `allowedResources`/`allowedScopes` (legacy fields stay
  outside the data flow; observed read/write counts `0`).
- Copying or unioning OpenClaw or existing grants; blanket IAM; any generic
  online Grant API or `machine-admin` Grant command.
- Human or delegation grant mutation; `HumanAudienceGrant` stays untouched.
- Re-supplying the two parent canary Clients (`agt_stock_agent`,
  `agt_cto-agent`); they are non-target and MUST remain byte-equivalent.
- Modifying the Minimal Auth Contract, the Contract Bundle, the Audience
  registry, or `grants.schema.json`.
- Deployment, acceptance, merge, or rollback execution in this PR.

## 4. Bound inputs (frozen digests)

```text
CLIENT_MAPPING_PATH  = /usr/local/libexec/agent-core/config/.fleet-phase-a-bootstrap/client-mapping.json
CLIENT_MAPPING_SHA256 = 60f3f9090fdb941b36fa10bdfea38e5a185562e5d459ee27f7a98f347e7e67b6
GRANT_PLAN_SHA256    = 7b36807de526b521262e507f26c7fbedb49e3883e04a60d5bed3f2999c634056
PLAN_CANONICAL_FORM  = UTF-8 JSON, object keys sorted, separators ("," ":"),
                       ensure_ascii=false, of the document:
                       {plan_version: "AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1_PLAN_1",
                        client_mapping_sha256: <above>,
                        targets: {svc-workflow: [workflow.read], svc-forum: [forum.read, forum.write]},
                        rows: [{agent_id, client_id,
                                audiences: {svc-workflow: {current_state, operation, target_scopes},
                                            svc-forum:      {current_state, operation, target_scopes}}}]}
                       with rows sorted by agent_id and every current_state/operation
                       exactly as observed in OBS-TFS-002 (all CREATE / ABSENT).
```

Both digests are binding: the implementation and any apply MUST re-derive the
plan against live state and refuse on any divergence from
`GRANT_PLAN_SHA256` semantics (classification counts below), and MUST re-read
the mapping file inside the trusted `authsvc` boundary and refuse unless its
SHA-256 equals `CLIENT_MAPPING_SHA256` exactly.

## 5. State and observations

### STATE-TFS-001 — Phase A identity/credential restoration is complete for the exact 86

Operator evidence (trusted boundary, 2026-08-23T11:14–11:23Z):
`ACCOUNT_READY_COUNT = 86`, `CREDENTIAL_READY_COUNT = 86`,
`VERIFIED_COUNT = 86`, `CLIENT_MAPPING_COUNT = 86`,
`CLIENT_MAPPING_SHA256 = 60f3f909…`, mapping file `0600 authsvc`, and
`GRANT_CHANGE = NONE` — Phase A performed zero grant writes.

### STATE-TFS-002 — Fresh read-only DB verification (2026-08-23, this round)

Via the read-only `auth_ro` seam (SELECT only; no management token; no
mutation), against `agent_dev_center`:

```text
TOTAL = 86            UNIQUE_AGENT_ID = 86     UNIQUE_CLIENT_ID = 86
PRINCIPALS_IN_DB = 86 (all active, principal_type=agent, deterministic external_ref,
                       no split-brain, no duplicates, owner_user_id null)
CLIENTS_IN_DB   = 86 (all active, all mc_ prefix, each bound to exactly its
                      Appendix A Principal, legacy allowedScopes/allowedResources
                      all empty)
AUDIENCES: svc-workflow active [workflow.admin, workflow.execute, workflow.read]
           svc-forum      active [forum.read, forum.write]
```

### OBS-TFS-001 — Mapping file hash provenance for this round

The mapping file is `authsvc`-owned `0600` and is only readable inside the
trusted execution boundary. This round verified the frozen SHA from the
trusted root-run apply snapshot (`v2-snap-post-20260823T111423Z.txt`:
`60f3f909…`, 4935 bytes, mode `-rw-------`, owner `505(authsvc)`) plus the
DB-side re-derivation of every pair in STATE-TFS-002. A fresh in-boundary
re-hash is MANDATORY at apply time (CTR-TFS-007); a mismatch aborts with
writes `0`.

### OBS-TFS-002 — Current grant classification (the redacted plan)

```text
CREATE_WORKFLOW = 86   NOOP_WORKFLOW = 0
CREATE_FORUM    = 86   NOOP_FORUM    = 0
CONFLICT        = 0    (no existing MachineAccessGrant row and no governed
                        grant audit for any of the 86 Clients)
```

Non-target current state (out-of-roster, parent-owned): `agt_stock_agent` and
`agt_cto-agent` each hold `svc-workflow[workflow.read]` v1 +
`svc-forum[forum.read, forum.write]` v2 — exactly the parent end-state.

## 6. Decisions

### DEC-TFS-001 — One complete end-state create per client

The migration performs one audited `create` per fleet Client whose
`after_value` is the complete two-Audience `clientGrants` snapshot at
`version = 1`. Audience-staged sequencing (W-then-F per client) is unnecessary
because the forum CCR prerequisites that blocked the parent's Stage F are
satisfied and remain accepted; the single-stage design halves write and audit
surface and keeps one rollback shape.

### DEC-TFS-002 — Fleet canary is an Agent, not an Audience

Execution order is gated by Client: `agt_build-in-public-agent` first
(`--scope canary`), the remaining 85 only after canary PASS (`--scope fleet`,
serial roster order). Canary PASS requires the migration's own read-only
end-state verification plus independent real `client_credentials` mint
evidence showing exactly `workflow.read` and `forum.read forum.write`.

### DEC-TFS-003 — Exact executable and exclusive file set

Implementation (a separately reviewed PR after acceptance; not this PR) is
exactly three new files, mirroring the merged Stage W/F precedent:

```text
scripts/supply-agentcore-trusted-fleet-grants-v1.ts
scripts/run-agentcore-trusted-fleet-grants-v1-conformance.sh
tests/oauth/supply-agentcore-trusted-fleet-grants-v1.test.ts
```

Any fourth file requires a new OWNER decision. The migration runs offline
against the database with `source_git_commit` pinned to the reviewed SHA; a
dirty or mismatched artifact refuses before writes.

### DEC-TFS-004 — Plan-before-mutation with complete before/after snapshots

A complete plan validates all 86 identities, both Audiences, the target
grant sets, current audit-derived revisions, and complete current grant
snapshots before first mutation. Apply captures complete `before_value` /
`after_value` snapshots (never fragments). Any plan/apply failure leaves the
database unchanged.

## 7. Contracts

### CTR-TFS-001 — Closed target identities

The migration MUST contain exactly the 86 Client refs of Appendix A. Each
MUST resolve exactly one active Client bound to exactly one active Principal
with `principal_type=agent`, the exact Appendix A `agent_id`, and the exact
deterministic external refs. Resolution uses the deterministic external ref;
audit records use the resolved public `mc_*` client ID only; the external ref
MUST NOT appear in audit JSON. Missing, duplicate, inactive, wrongly bound, or
mismatched state MUST fail loudly with complete migration writes `0`.

### CTR-TFS-002 — Exact staged grant rows; conflict = fail-closed

Per Client, exactly one of:

- exact rerun: current complete snapshot (including `version`) equals the
  §6 end-state → no-op, grant writes `0`, audit writes `0`;
- precondition match: no `MachineAccessGrant` row and no governed grant audit
  exists for the Client → perform the audited create path;
- anything else (any existing row, any audit, any unplanned scope/audience,
  `workflow.execute`/`forum.admin`/`forum.moderate`/wildcard present) →
  conflict, fail loudly, writes `0`.

No overwrite, union, silent repair, narrowing, or last-write-wins. Scope
comparison uses unsigned-ASCII byte order.

### CTR-TFS-003 — Audience and scope validation fails closed

Before writes, `svc-workflow` and `svc-forum` MUST each exist exactly once,
be active, machine-enabled, accept `agent`, and register every requested
scope (`workflow.read`; `forum.read`, `forum.write`). The migration MUST NOT
create or repair an Audience. Any mismatch fails loudly with writes `0`.

### CTR-TFS-004 — Serializable optimistic apply against the grant-set revision

Apply MUST use one serializable transaction per Client (serial Clients across
the fleet) and conditionally check the audit-derived per-Client grant-set
revision, encoding `expected_grant_version = null` →
`resulting_grant_version = 1`. A concurrent writer that changes the grant set
or revision first MUST turn the apply into conflict/rollback.

### CTR-TFS-005 — Same-transaction immutable audit in the closed envelope

For each Client whose grant set changes, apply MUST write one
same-transaction `grant_change_audits` row using exactly the closed 13-field
envelope (`migration_id`, `source_git_commit`, `operator_id`,
`approval_ref`, `reason`, `client_id`, `change_type`,
`expected_grant_version`, `resulting_grant_version`, `before_value`,
`after_value`, `timestamp`, `id`), `change_type = create`,
`before_value = null`, and `after_value` = the complete snapshot:

```text
client_kind           = machine
principal_type        = agent
human_audience_grants = []
machine_access_grants = { "svc-workflow": ["workflow.read"],
                          "svc-forum": ["forum.read","forum.write"] }
delegation_grants     = {}
status                = active
version               = 1
```

Audit failure rolls back all changes. Exact no-op reruns MUST NOT add audit
rows. `migration_id = agentcore-trusted-fleet-grant-supply-v1`.

### CTR-TFS-006 — Canary gate before the remaining 85

`--scope fleet` MUST refuse unless durable evidence shows the fleet canary
reached its complete end-state and passed independent mint verification.
A canary failure stops the fleet with the remaining writes `0` and preserves
the canary's audited state (forward recovery; no rollback-by-deletion).

### CTR-TFS-007 — Mapping and plan re-verification at apply time

Apply MUST, inside the trusted `authsvc` execution boundary: re-read
`CLIENT_MAPPING_PATH`, require SHA-256 `= CLIENT_MAPPING_SHA256`, require 86
unique `mc_*` entries whose agent_id set equals Appendix A, re-derive the
redacted plan against live state, and require classification counts equal to
OBS-TFS-002 semantics for every Client it is about to write (precondition
match or exact no-op). Any drift aborts with writes `0`.

### CTR-TFS-008 — Legacy fields and non-target data are invariant

`allowedResources`/`allowedScopes` read/write counts MUST be `0`. No
non-target Grant, Principal, Client, Audience, human/delegation row, or
OpenClaw row may change: `agt_stock_agent` and `agt_cto-agent` grants,
credentials, identities, and every unrelated row MUST be row/byte equivalent
before and after. IDENTITY_CHANGE = NONE; CREDENTIAL_CHANGE = NONE;
LEGACY_FIELD_CHANGE = NONE.

### CTR-TFS-009 — Operational prerequisites gate apply

Apply MUST refuse before writes without: the migration SHA independently
reviewed; operator `approval_ref`; this Spec accepted and merged; Phase A
receipts for all 86; and the CTR-TFS-007 re-verification. Acceptance of this
Spec alone authorizes no production apply.

## 8. Acceptance criteria

```text
ACC-TFS-001  All 86 Appendix A Clients reach exactly
             svc-workflow=[workflow.read], svc-forum=[forum.read,forum.write], version=1
ACC-TFS-002  Grant writes = 172 rows create; audit rows = 86 (one per changed Client)
ACC-TFS-003  Exact rerun = NOOP (grant writes 0, audit writes 0)
ACC-TFS-004  Any pre-existing/drifted/unplanned state = conflict, writes 0 (fail-closed)
ACC-TFS-005  Canary agt_build-in-public-agent verified first; fleet gate held
ACC-TFS-006  grant_change_audits rows carry complete before/after snapshots,
             closed envelope, same transaction as their grant writes
ACC-TFS-007  No identity/credential/legacy-field/non-target mutation
ACC-TFS-008  Mapping hash re-verified in-boundary at apply time == frozen SHA
ACC-TFS-009  No secret appears in any migration output, audit row, or report
```

## 9. Ordering and lifecycle

```text
THIS ROUND   = SPEC ONLY: status proposed, implementation_authority none,
               production_apply_authority none, one new file, Draft PR, stop.
NEXT         = independent 授权 audit of this Spec (authority scope, plan binding,
               digest correctness, boundary discipline).
AFTER        = acceptance (proposed -> accepted; implementation_authority ->
               contracts) followed by a separately reviewed three-file
               implementation PR at a fixed SHA (DEC-TFS-003), then operator
               execution under CTR-TFS-006..009. Merge of the implementation
               does not itself constitute production apply.
```

## Appendix A — Exact 86 Client binding (frozen)

Principal external refs are `agentcore:v1:principal:<agent_id>`; Client
external refs are `agentcore:v1:client:<agent_id>`. Every client_id below is
the resolved public `mc_*` identifier observed live on 2026-08-23 under
`GRANT_PLAN_SHA256`.
| # | agent_id | client external_ref | client_id (public) | svc-workflow | svc-forum |
|---|---|---|---|---|---|
| 1 | `agt_3d-print-agent` | `agentcore:v1:client:agt_3d-print-agent` | `mc_hQXxK87OSwf_bUdZRILtuu9J` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 2 | `agt_account-manager-agent` | `agentcore:v1:client:agt_account-manager-agent` | `mc_CgbCsZTgbDBtATlGFLvoG9_Y` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 3 | `agt_agent-dev-engineer` | `agentcore:v1:client:agt_agent-dev-engineer` | `mc_wpRm6IF3YO_hDE4Vp538-T3I` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 4 | `agt_arch-reviewer` | `agentcore:v1:client:agt_arch-reviewer` | `mc_0Ms9mJWqATg6BoogK70K2XZG` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 5 | `agt_article-publisher-agent` | `agentcore:v1:client:agt_article-publisher-agent` | `mc_3n9kjyTdh3es3Lsh5vyevgTv` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 6 | `agt_backend-engineer-2` | `agentcore:v1:client:agt_backend-engineer-2` | `mc_ZLKjbSw5ELYVlZmC1ENZz5IK` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 7 | `agt_biz-explorer` | `agentcore:v1:client:agt_biz-explorer` | `mc_x30dyZsxQuIZIfhZ0fWhUjIo` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 8 | `agt_biz-product-designer` | `agentcore:v1:client:agt_biz-product-designer` | `mc_8sVYKRS-BXTgqJk7VOklnzv6` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 9 | `agt_biz-reviewer` | `agentcore:v1:client:agt_biz-reviewer` | `mc_ZTvA64OtHpuzks2-jsil6qC6` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 10 | `agt_blog-agent` | `agentcore:v1:client:agt_blog-agent` | `mc_sWqLVY9rPrVRdXM909b8QKyT` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 11 | `agt_book-deconstructor-agent` | `agentcore:v1:client:agt_book-deconstructor-agent` | `mc_IbXwCGnMH10uc9630c1xojFE` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 12 | `agt_build-in-public-agent` | `agentcore:v1:client:agt_build-in-public-agent` | `mc_ohDTyGYRpBLI4qN_sVU88aob` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 13 | `agt_ceo-agent` | `agentcore:v1:client:agt_ceo-agent` | `mc_-A15co62s5sx3UYKcHVWVx8D` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 14 | `agt_content-ops-agent` | `agentcore:v1:client:agt_content-ops-agent` | `mc_zHCf_oeeXKVKb5qcbynEnQvo` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 15 | `agt_course-community-agent` | `agentcore:v1:client:agt_course-community-agent` | `mc_ju_rOCBK57mP5qtaBYf_8F6X` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 16 | `agt_course-community-agent-2` | `agentcore:v1:client:agt_course-community-agent-2` | `mc_hvEfjkJ5BTKA8HZXRmbzNVw0` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 17 | `agt_creative-writer` | `agentcore:v1:client:agt_creative-writer` | `mc_PbaqEpXs6OLfQ9Ugn5pokkjP` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 18 | `agt_daily-thought-agent` | `agentcore:v1:client:agt_daily-thought-agent` | `mc_PejtHjDXtQ-lS6boaBYAAL12` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 19 | `agt_delivery-review-agent` | `agentcore:v1:client:agt_delivery-review-agent` | `mc_i6GHs0qeHN3Ei2JL38aB0G6q` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 20 | `agt_devtools-agent` | `agentcore:v1:client:agt_devtools-agent` | `mc_c3uoF-gwy2lFb_7mGP_OuFoF` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 21 | `agt_discipline-coach-agent` | `agentcore:v1:client:agt_discipline-coach-agent` | `mc_GLG0wAPPz0BtOrizUaPGU8Oc` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 22 | `agt_education-agent` | `agentcore:v1:client:agt_education-agent` | `mc_YzY5A2RTvArl74aZC5cAClsN` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 23 | `agt_efficiency-agent` | `agentcore:v1:client:agt_efficiency-agent` | `mc_cF81DF-XND9Zmzao4F08rOK_` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 24 | `agt_email-manager-agent` | `agentcore:v1:client:agt_email-manager-agent` | `mc_FdlCtpbObHlqPHQznd6tgnDh` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 25 | `agt_explorer` | `agentcore:v1:client:agt_explorer` | `mc_68HPrwc_tTqqRD7BenbLAQYi` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 26 | `agt_family-doctor-2-agent` | `agentcore:v1:client:agt_family-doctor-2-agent` | `mc_lpt5fL4Ykpdq_ORTQW8ZtmNs` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 27 | `agt_family-steward-agent` | `agentcore:v1:client:agt_family-steward-agent` | `mc_ildyY6drxIxqBRXqj6xOi40V` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 28 | `agt_feishu-expert-2-agent` | `agentcore:v1:client:agt_feishu-expert-2-agent` | `mc_i0qaXT1ARcKFxBX4DQEk1gWC` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 29 | `agt_feishu-expert-agent` | `agentcore:v1:client:agt_feishu-expert-agent` | `mc_9wQS8aflpZ755ENTw_5t95TN` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 30 | `agt_finance-agent` | `agentcore:v1:client:agt_finance-agent` | `mc_tnBtHvhFwYV9d1mrPkgbOHLc` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 31 | `agt_finance-housekeeper-agent` | `agentcore:v1:client:agt_finance-housekeeper-agent` | `mc_OaXNj8J3tB4mT81O6mMIZAph` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 32 | `agt_frontend-react-engineer` | `agentcore:v1:client:agt_frontend-react-engineer` | `mc_Ny7cyVz4Ye5FiaesH0UuVgP9` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 33 | `agt_game-designer-agent` | `agentcore:v1:client:agt_game-designer-agent` | `mc_vRx6dDeCb4R7yLV7V6VMgMYA` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 34 | `agt_game-dev-agent` | `agentcore:v1:client:agt_game-dev-agent` | `mc_KrRvQqqreUJvBwd1Hwh6ozkX` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 35 | `agt_game-producer-agent` | `agentcore:v1:client:agt_game-producer-agent` | `mc_3Ur3l8v9SnBPa4B3l9eCDLGa` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 36 | `agt_hao-yang-mao-agent` | `agentcore:v1:client:agt_hao-yang-mao-agent` | `mc_MhUqjwb79uogINh2fb2wiTb0` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 37 | `agt_healthcheck-agent` | `agentcore:v1:client:agt_healthcheck-agent` | `mc_49xqQ7ywdIIF3Xz8pUJNjQe3` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 38 | `agt_home-repair-agent` | `agentcore:v1:client:agt_home-repair-agent` | `mc_UAyufbe4-eWY-8_IJO9-Bi0o` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 39 | `agt_hr-agent` | `agentcore:v1:client:agt_hr-agent` | `mc_IuBMfCYe9-b522IhSWKBGjyz` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 40 | `agt_image-gen-agent` | `agentcore:v1:client:agt_image-gen-agent` | `mc_JXktke7mapDcNiNl8qjEOYFt` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 41 | `agt_investment-debater` | `agentcore:v1:client:agt_investment-debater` | `mc_gcX3LSiiBtgT4aF1f09mVV7z` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 42 | `agt_itops-agent` | `agentcore:v1:client:agt_itops-agent` | `mc_lYTb7Liaq73rEfYeaHaldFuR` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 43 | `agt_job-watch-agent` | `agentcore:v1:client:agt_job-watch-agent` | `mc_Nuw3y1KSlKhKKD4knczEKYpA` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 44 | `agt_knowledge-curator-agent` | `agentcore:v1:client:agt_knowledge-curator-agent` | `mc_mF72E3xfaT3cuANA38eLln5W` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 45 | `agt_learning-expert` | `agentcore:v1:client:agt_learning-expert` | `mc_rl_DL4_LUmxlHkRZ-zsYB2ND` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 46 | `agt_lobster-agent` | `agentcore:v1:client:agt_lobster-agent` | `mc_Cbbwtf9ONEgVzFVM_zxS5qjB` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 47 | `agt_lobster-guide-agent` | `agentcore:v1:client:agt_lobster-guide-agent` | `mc_1WBOAAmscjZeDtDO6oJtwdiW` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 48 | `agt_miniapp-game-engineer` | `agentcore:v1:client:agt_miniapp-game-engineer` | `mc_EDhTzwzuPss-pPpFOQqyPuLm` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 49 | `agt_mobile-app-engineer` | `agentcore:v1:client:agt_mobile-app-engineer` | `mc_HYg66waIzoyMkbdiVMOIdnZv` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 50 | `agt_needs-radar-agent` | `agentcore:v1:client:agt_needs-radar-agent` | `mc_7djbfRSN5MR1qsY9CPfyAiPa` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 51 | `agt_novel-writer` | `agentcore:v1:client:agt_novel-writer` | `mc_Lw8tWArQ3f2_lt3Mtt_6OhL-` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 52 | `agt_open-source-agent` | `agentcore:v1:client:agt_open-source-agent` | `mc_7TM165tbvXRtL2S3wPlAk3fj` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 53 | `agt_paper-reviewer-agent` | `agentcore:v1:client:agt_paper-reviewer-agent` | `mc_BkeMPRkWPJuO5Tger33Sk7W9` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 54 | `agt_podcast-producer-agent` | `agentcore:v1:client:agt_podcast-producer-agent` | `mc_A3gbLABj8LZxe6ftMg8EC0cU` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 55 | `agt_ppt-designer` | `agentcore:v1:client:agt_ppt-designer` | `mc_tcPvAVHgQ6qBb7vGPS8qmZDt` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 56 | `agt_private-chef-agent` | `agentcore:v1:client:agt_private-chef-agent` | `mc_fVDF0MVvZE6u7nmQqqu6Huab` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 57 | `agt_product-designer` | `agentcore:v1:client:agt_product-designer` | `mc_RA2vyyFWA1X_9Qq0YOJBvwC3` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 58 | `agt_product-manager` | `agentcore:v1:client:agt_product-manager` | `mc_w3t3YKzRFUP9rVvVJX3VnaOU` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 59 | `agt_psychology-agent` | `agentcore:v1:client:agt_psychology-agent` | `mc_ONSMZP2Mm4ur7TS2PwWrYoLd` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 60 | `agt_qa-reviewer` | `agentcore:v1:client:agt_qa-reviewer` | `mc_w3rsgO0aVbLtZyY-yj7fxh_C` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 61 | `agt_qa-reviewer-2` | `agentcore:v1:client:agt_qa-reviewer-2` | `mc_7YGrPt9htTPwVLpoxT8RuhjN` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 62 | `agt_quant-trading-agent` | `agentcore:v1:client:agt_quant-trading-agent` | `mc_Ipcx4-F15z64AJzQXdT1L4xX` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 63 | `agt_reader-simulator-agent` | `agentcore:v1:client:agt_reader-simulator-agent` | `mc_sngEKJTo8unkikNmuZvlkJrU` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 64 | `agt_reimbursement-expert` | `agentcore:v1:client:agt_reimbursement-expert` | `mc_WRMSD3c0iIbPDTURbrCKXCzR` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 65 | `agt_research-agent` | `agentcore:v1:client:agt_research-agent` | `mc_NX9svGuT-c09GEYZYMb1Inyh` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 66 | `agt_sales-copy-agent` | `agentcore:v1:client:agt_sales-copy-agent` | `mc_Xg3gG6SNghJysSsnZIT1hrbL` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 67 | `agt_search-expert-agent` | `agentcore:v1:client:agt_search-expert-agent` | `mc_iduluAuKr582HLqnF9i13nPG` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 68 | `agt_security-agent` | `agentcore:v1:client:agt_security-agent` | `mc_Kat13vPicLKBv0MT5kuxLbGD` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 69 | `agt_shopping-list-agent` | `agentcore:v1:client:agt_shopping-list-agent` | `mc_LN4jwagcuP_3k1yIDj4LBgTX` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 70 | `agt_skill-engineer-agent` | `agentcore:v1:client:agt_skill-engineer-agent` | `mc_ejuvUdbXTB2D5cunKIp2vEjK` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 71 | `agt_smart-home-agent` | `agentcore:v1:client:agt_smart-home-agent` | `mc_hJK2xgiJjpkq97LDf4UfdJB2` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 72 | `agt_social-butterfly-agent` | `agentcore:v1:client:agt_social-butterfly-agent` | `mc_EudZD8iLyyh-ZHESVAkiLYTm` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 73 | `agt_soul-questioner-agent` | `agentcore:v1:client:agt_soul-questioner-agent` | `mc_ESqSHUlTnd3YoWx2DwMIq9BT` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 74 | `agt_stock-agent` | `agentcore:v1:client:agt_stock-agent` | `mc_0YLP8Do9ls3Q8RK43eFqPlHq` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 75 | `agt_test-engineer` | `agentcore:v1:client:agt_test-engineer` | `mc_-k728H8aM5g1NBJGxnuicPZn` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 76 | `agt_thesis-advisor-agent` | `agentcore:v1:client:agt_thesis-advisor-agent` | `mc_XpCg0kera-W99Ez33KaMKOat` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 77 | `agt_training-expert-agent` | `agentcore:v1:client:agt_training-expert-agent` | `mc_L6azE3nKNqYaUS99gthew2hM` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 78 | `agt_transcript-editor-agent` | `agentcore:v1:client:agt_transcript-editor-agent` | `mc_txE_EGtvjgUuVSvdIjrt_s5f` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 79 | `agt_translation-qa-agent` | `agentcore:v1:client:agt_translation-qa-agent` | `mc_ykdgk3h24AOMk16jSYGrnu99` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 80 | `agt_translator-agent` | `agentcore:v1:client:agt_translator-agent` | `mc_H-fmlAMBLa7eWe4NHbLCgesM` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 81 | `agt_travel-planner-agent` | `agentcore:v1:client:agt_travel-planner-agent` | `mc_BiUQEc-PKo1hCyqyvuLc_wAl` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 82 | `agt_trend-tracker` | `agentcore:v1:client:agt_trend-tracker` | `mc_-cfZvb9y05N3cXAthE_3JgEB` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 83 | `agt_video-model-expert` | `agentcore:v1:client:agt_video-model-expert` | `mc_Q34iLYY3FYiEpbjwZN-FG3S9` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 84 | `agt_video-producer` | `agentcore:v1:client:agt_video-producer` | `mc_S8UasR-9Lz1YJRK7BsBjLqoX` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 85 | `agt_voice-tech-agent` | `agentcore:v1:client:agt_voice-tech-agent` | `mc_vDjPrujnwsBkGrkkWKbf1qSC` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |
| 86 | `agt_writing-style-analyst-agent` | `agentcore:v1:client:agt_writing-style-analyst-agent` | `mc_2HMY52aMvRM6EaonUQlmcew8` | CREATE [workflow.read] | CREATE [forum.read, forum.write] |


## Final Output (authoring round)

```text
TASK_NAME             = 授权 执行
TOTAL                 = 86
CLIENT_MAPPING_DIGEST_MATCH = YES (60f3f9090fdb941b36fa10bdfea38e5a185562e5d459ee27f7a98f347e7e67b6)
CURRENT_GRANT_SCAN_COMPLETE  = YES (2026-08-23, read-only auth_ro seam)
GRANT_PLAN_SHA256     = 7b36807de526b521262e507f26c7fbedb49e3883e04a60d5bed3f2999c634056
WORKFLOW_CREATE_COUNT = 86   WORKFLOW_NOOP_COUNT = 0
FORUM_CREATE_COUNT    = 86   FORUM_NOOP_COUNT    = 0
CONFLICT_COUNT        = 0
AUTHORITY_SUFFICIENT  = NO
NEW_SPEC              = AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1 (this file)
SPEC_PR               = Draft PR, docs-only, single file
READY_FOR_INDEPENDENT_REVIEW = YES (授权 审计)
IDENTITY_CHANGE       = NONE
CREDENTIAL_CHANGE     = NONE
LEGACY_FIELD_CHANGE   = NONE
PRODUCTION_CHANGE     = NONE
```
