# AGENT_IDENTITY_CANONICALIZATION_CENSUS_V1

Investigation only. This artifact grants no implementation, migration, retirement,
credential access, deployment, or acceptance authority.

## Coordinates and method

Observed 2026-09-14, local artifacts finalized around 15:13 UTC and corrected in the
next continuation. Per-query or per-domain REPEATABLE READ READ ONLY PostgreSQL
transactions were used with statement timeouts. There was no cross-service atomic
snapshot. System registry is a configured JSON file observation, not a live admission
receipt. Source audit used exact Git objects, not the dirty shared checkout.

Owning candidate base: auth-service `65ee9f30d505f4ea5e68501082596ab467532f5d`.
The move from initial Auth `0cec4e9a64f5628ece42449693a7fc708f05098e` changes session
inspection authorities, not the identity/schema references used by this Program.

Owner mandate: attachment `pasted-text.txt`, SHA256 `9ec747ffc66dcca82693d602ef83f541dc57a1a621709734742b5fc7bb0458f5`.
Explicit scope is `AGENT_IDENTITY_CANONICALIZATION_AND_LEGACY_RETIREMENT_V1`,
sections A–U; docs and independent review are authorized, guessing/legacy mutation
before proof are not. Raw attachment remains outside Git.

## Observations

| ID | Source / environment / method | Observed result | Limits |
|---|---|---|---|
| OBS-AICP-001 | local `agent_dev_center`, role `auth_ro`, allowlisted Principal/client/Grant SELECTs | 209 AGENT rows; 199 active; 110 active legacy-spelling identities; 207 active clients beneath legacy identities | live Auth service private config unavailable; service-to-DB linkage still unproved this round |
| OBS-AICP-002 | `system/ai.agent-core.runtime` launchctl/plist + `/Users/authsvc/.agent-core/agents.json` | authsvc system root, 93 enabled rows; 4 unmatched Auth identities; two independent stock rows | user registry (88) is a different runtime; file read is not admission/canary |
| OBS-AICP-003 | Workflow `127.0.0.1:8989/version` and actual service `.env` DB-name-only projection; `svc_workflow_dogfood_clean` repeatable-read SELECT | service `a9d6f5e8d019f401c3b73c76810ad7508c6a831e`; 154 versions, 5 legacy fixed refs in 1 Draft, 348 in 61 Published, 4 legacy current assignees, 69 enabled legacy Domain bindings | active creator/history counts are separate; mutable state can drift after snapshot |
| OBS-AICP-004 | digest-verified historical fleet artifact + V8 exact main authority + fresh Auth/registry joins; independent reviewer | 86 exact historical pairs verified; separately accepted CTO makes 87 | equivalence proof only; no replay, new Grant or retirement authority |
| OBS-AICP-005 | Workspace remote-deduplicated Git grep + remote system/container/database schema discovery | 18 workspace repos plus agent-dev-center bare exact HEAD; 5 remote PostgreSQL schema surfaces; 73 scalar identity-labelled field distributions | extra deployed llm-todo/agent-learn and JSON/array/lifecycle coverage not yet closed; labels do not alone prove semantic identity |
| OBS-AICP-006 | schema property review against exact Workflow source collector | 30 absent context schemas and 3 absent declared properties; no literals at those locations | prior report incorrectly labelled these 33 as unparsed paths; corrected to known absence, not graph-validity PASS |
| OBS-AICP-007 | type/status joins and unmatched ID sets | 33 old-style identities lack inspected successor; 43 Workflow AGENT projections lack Auth rows; one enabled Workflow AGENT is Auth SERVICE (OBO ADC Proxy) | do not infer deletion, type conversion, logical identity or grants from names |

The read-only role initially hid some Workflow tables from information_schema;
pg_catalog discovery and the already authorized svc_wf connection in READ ONLY
mode exposed the missing tables. An empty role-filtered schema was not treated as
absence. No password/token/secret was copied to these artifacts.

## Qualified evidence relations

- EVD-AICP-001: OBS-001/003 SUPPORT CLM-AICP-001 (legacy active business references
  exist, so immediate retirement is unsafe). Sufficient at the sampled DB coordinates;
  insufficient for full-universe retirement eligibility. Provenance: files below.
- EVD-AICP-002: OBS-002/004/005/007 SUPPORT CLM-AICP-002 (the prior frozen fleet is
  not the full discovered universe). The historical plan covers exactly 86 pairs;
  extra registry/projection/deployed surfaces remain. No dynamic roster expansion.
- EVD-AICP-003: OBS-004 SUPPORT the 87-pair equivalence subset. V8 at Workflow
  `6c05e0f9510b4d97d036a83d78c9c333f705ebfb`, lines 1332–1373, binds plan
  SHA256 `0a05ed2d6099601a567d0ebf652e9adc737e8dd7c4c9dfc1260a6037c49f3606`,
  540472 bytes. Its 85 normal joins plus explicit efficiency-manager override are
  reviewed facts. CTO comes from accepted exact-pair Spec lines 62–69. Independent
  reviewer `/root/identity_authority_audit` rehashed/rejoined the files; source/target
  uniqueness, target type/active/grammar/enabled all pass within this subset.
- EVD-AICP-004: OBS-001–007 SUPPORT STATE-AICP-001: census incomplete, no executed
  production mutation, no full conformance proof. Protected system scheduler/session
  reads returned Permission denied; noninteractive sudo required a password. No
  permission widening or impersonation occurred. Required missing export is identity
  metadata only, never credential material.

## Relevant accepted constraints

Auth `AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2` preserves stored legacy
syntax and downstream deliverability checks; `AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1`
returns disabled target status as data. These need not be changed by a separate
strict-write boundary. Auth opaque external_ref ensure and multiple clients remain.

Agent Core EPAR V2 requires `^agt_[a-z0-9-]+$`, 5–128 chars; underscore stock does
not satisfy it. General UI navigation is explicitly retained. Two separate accepted
Auth grant rosters mention the two stock IDs; neither proves equivalence between them.

Forum accepted actor invariants forbid transferring aliases between immutable local
Principals. Workflow V8 frozen pair evidence is not arbitrary migration authority;
CIR V2 scope is bounded and cannot be generalized by this investigation.

## Persistent evidence access

Evidence directory: `/Users/yanfenma/.codex/identity-census/20260914-v1/`.
The designated local independent reviewer can read these sanitized files. A remote
reviewer must receive the same digest-bound exports before relying on the live
observations. Inaccessibility is a gate failure, never presumed PASS.

| File | SHA256 |
|---|---|
| `principals.local.json` | `b853894daa8de47c05fc803fe897ac0b92446f0bf8230ec9b6705b53bd2483e8` |
| `clients.local.json` | `b06b8ff3908826deaf59b8d46d1b5754a4b7d9133f0e1019584e6c80d34e2e45` |
| `registry.production.json` | `ae5d8508365a894a2f0bfdc348b4713cc264702232eeaa2686446447ddcac183` |
| `workflow-live-census.json` | `6be830c43975079b0e769233e47f6f740c4fd9da0c5e07d3fb954238d85d19fd` |
| `workflow-live-additional.json` | `9e436d1a65824666a4e7abb224a00589d5d6da4786490a1684d1ea6beb1033c0` |
| `workflow-schema-identity-literals.json` | `9b145a7bc4669e62adc28cf5c386c806da276363377d7667d73b0358e56c82c2` |
| `verified-historical-successor-pairs.json` | `3350366d953eff4a8c8828efb5185ec20cf555e70aabb094adbc6d8126dacb4f` |
| `fleet-mapping-revalidation.json` | `f608fe3862992634f2d1c65c193a5eb473c07ab13aaf903458ff43821070f515` |
| `principal-type-mismatches.json` | `b86e448f68d109103303496dd07dc53e20223dd555a3980651bf443189f0c6b4` |
| `identities-without-frozen-successor.json` | `28cc20e29a09142285dd19726801acd9ef346e595b607c8749cc508054d7fc13` |
| `workflow-orphan-agent-projections.json` | `edf37c90538a93ffd384f51d52b1f058dc8d3d72c65125f8b6c7db9066985b07` |
| `workspace-source-surface.json` | `3db3ccd8238111a97400cdc140e9827f1d71fd45de2b800a57acc1035f42bfd3` |
| `production-schemas.json` | `8582347c677ddfea4bb00fdd933eea34acaf81ea23b6e6dbbaec0ad522df441a` |
| `remote-scalar-identity-census.json` | `5f9c6932279f9c7566f332384c3b1e3e000ff1e6ffc07df5e06420c7c0df7d9a` |


## Remaining work

Complete protected runtime/credential-status/last-use and typed-reference coverage;
resolve stock and genuinely unmapped identities through evidence/Owner disposition;
finish consumer source audit and semantic debt measurements. Author/review owning
implementation Contracts without treating this Program as permission to code. Only
then run strict-write deployment, mechanically proven migration, fresh zero-ref
checks, retirement, compatibility removal, canary and final whole-Goal audit.
