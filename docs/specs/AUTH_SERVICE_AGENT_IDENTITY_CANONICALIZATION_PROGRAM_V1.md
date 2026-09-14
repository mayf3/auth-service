---
spec_id: AUTH_SERVICE_AGENT_IDENTITY_CANONICALIZATION_PROGRAM_V1
status: proposed
spec_kind: program
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/auth-service canonical AGENT identity lifecycle and successor ownership
  - prerequisite coordination for independently governed identity consumers
governed_by: [MINIMAL_AUTH_FOUNDATION_V2]
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
    revision: 49a5d42c053401036550aac84d2427a61832a457
    relation: constrained_by
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V8
    revision: 6c05e0f9510b4d97d036a83d78c9c333f705ebfb
    relation: constrained_by
  - repository: mayf3/agent-forum
    authority_id: AGENT_FORUM_CORE_INVARIANTS_V1
    revision: 7d54e58b468d99cd75aba6e3f844f6a22a4895fa
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [mayf3]
---

# Agent identity canonicalization and legacy retirement program

## 1. Goal and legal effect

One logical formal Agent has one stable canonical `agt_*` Agent ID and one
canonical AGENT Principal UUID. Authentication clients and credentials authenticate
that Principal; rotation does not create a second business identity. Legacy
identities remain interpretable as history, explicit successor relations, or
retired objects, and cannot receive new business authority.

This proposed Program preserves the full Owner Goal
`AGENT_IDENTITY_CANONICALIZATION_AND_LEGACY_RETIREMENT_V1`: complete identity and
reference census, one Auth-owned successor truth, strict new writes, safe migration,
retirement, compatibility removal, CI/runtime invariants, and actual production
canary/readback. A census, a ledger file, or this document alone is not completion.

This document has **no implementation or production authority**, including after
Program acceptance. Owning implementation Specs must be accepted in their bases;
controlled execution must satisfy those Contracts and the Owner mandate. This
Program does not accept, amend, supersede, deploy, or change another repository's
Contracts. Required changes to accepted meaning require owning whole-authority
successors, not implied precedence from this Program.

## 2. Route and mandate

```text
BASE_HEAD = 65ee9f30d505f4ea5e68501082596ab467532f5d
AUTHORITY_ACTION = NEW
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
DOCS_FIRST_REQUIRED = YES
AUTHORITY_ACCEPTED_IN_BASE = NO
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

Mandate: Owner attachment, 2026-09-14, sections A–U, explicitly permits autonomous
read-only census, docs/spec authoring and independent review. It prohibits guessing
successors, blind UUID replacement, rewriting history, unrelated credential
rotation, unauthorized HUMAN changes, concurrent root transactions, and silently
changing accepted semantics. Identity ambiguity and material Grant/product identity
decisions return in one Owner decision packet. Mandate permits preparing this
candidate; it does not make its proposed Contracts accepted.

## 3. Evidence and limitations

`docs/investigations/AGENT_IDENTITY_CANONICALIZATION_CENSUS_V1.md` records
coordinate-bound observations and EVD links. Historical mapping and current endpoint
checks are separate from current business-reference predicates.

OBS-AICP-001: 2026-09-14 local Auth read-only database snapshot contains 209 AGENT
Principals, 199 active, including 110 active legacy-spelling Principals and 207
active clients bound to those legacy rows. This is DB evidence; independent live
Auth service-to-DB binding is still incomplete.

OBS-AICP-002: system runtime configured Agent Definition file contains 93 enabled
entries; 4 lack matching Auth rows in that snapshot. Two independent stock IDs
exist; `agt_stock_agent` fails the currently accepted exact-routing grammar. A
configured file is not proof of successful live admission.

OBS-AICP-003: current Workflow service/version/config and a repeatable-read database
snapshot show 5 legacy fixed references in 1 Draft, 348 in 61 Published versions,
4 legacy active assignees, and 69 enabled legacy Domain bindings. Creation provenance
is counted separately from current work ownership. Counts are snapshots, not apply
preconditions or evidence that every Published version needs vNext.

OBS-AICP-004: current accepted Workflow V8 binds the exact historical fleet plan,
540472 bytes, SHA256
`0a05ed2d6099601a567d0ebf652e9adc737e8dd7c4c9dfc1260a6037c49f3606`.
Its 86 exact pairs plus the separately accepted CTO pair yield 87 independently
verified identity relations. None of those historical operations is replayed.

CLM-AICP-001 = SUPPORTED: existing identities and immutable pair evidence are
reusable, but live legacy business references prevent immediate retirement.
EVD-AICP-001 = OBS-001/003 support this claim at their bounded snapshot coordinates.
CLM-AICP-002 = SUPPORTED: a finite prior fleet is not the whole identity universe.
EVD-AICP-002 = OBS-002/004 plus the unresolved census records support this claim.
STATE-AICP-001 = census incomplete; canonical lifecycle/write/retirement conformance
unproved; production mutation HOLD. No UNKNOWN count is represented as zero.

## 4. Retained contracts and alternatives

Retain Auth's exact `Principal ↔ agent_id` ownership and Agent Core's authoritative
Agent Definition existence/enabled ownership. Keep existing `external_ref` opaque
idempotency/discovery semantics. It is not a business identity or implicit parser
for Principal UUIDs. Preserve legitimate multiple-client-to-one-Principal
cardinality, direct-machine caller binding, issuance audiences/scopes, and HUMAN
contracts. Keep general UI name navigation when it does not derive an Auth identity.

Auth exact/history directory reads currently may return a stored legacy ID or a
disabled target with explicit status. This is compatible with strict new business
writes. Do not turn those successful reads into canonical readiness or silently
change their errors. Forum's local immutable actor projection and alias-conflict
rules are preserved; a needed alias transfer requires its own owning authority.

Selected proposed direction: canonical lifecycle and successor truth live in Auth's
existing persistence boundary, extending existing Principal relations and only the
minimum alias representation required by census. Exact schema/API/locking closure
belongs to the Auth implementation child; no second registry or service is selected.

Rejected: copy mappings into Broker, Workflow, skills and SQL; infer successor by
prefix/display name/client ID; normalize stock punctuation; weaken admission to
accept legacy; hard-delete old identities to clean counts; preserve every fallback
indefinitely; rewrite unrelated systems solely to reduce line count.

## 5. Program Contracts

### CTR-AICP-001 — Census universe and classification

Discover repositories/services by both code search and deployed schema/configuration;
the five named repositories are a minimum, not a closed roster. Deduplicate checkouts
without dropping separately deployed generations. Every identity observation records
source, timestamp, type/status, exact Agent/Principal/client links, external refs,
aliases, permissions, consumer references, last observed use, and coverage limitations.
Every Agent must have one of the Owner census dispositions; missing evidence is an
explicit unresolved record. Permission-filtered empty results cannot establish absence.
Unresolved identities and reference paths must be zero before whole-Goal completion.

### CTR-AICP-002 — Canonical identity and unique truth

Exactly one canonical AGENT Principal belongs to each active canonical Agent ID;
an active canonical Principal cannot lack that ID or an enabled authoritative Agent
Definition. Canonical status is explicit and cannot be inferred solely from name,
prefix, regex, client availability, Auth active, or HTTP 200. The accepted canonical
grammar is preserved unless its owning authority is superseded. Duplicate/mismatched
relations fail closed and block canonical readiness. No credential rotation changes
business identity. New code consumes one Auth-owned relation, not local hardcoded maps.

### CTR-AICP-003 — Successor and historical identity semantics

A successor relation requires exact historical binding evidence, exact active AGENT
target/type/ID, unique enabled Agent Definition, and independent mapping review.
Historical accepted exact pairs may supply equivalence evidence; they do not supply
current grants, references, actor authorization, or migration preimages. No guessed
successor is recorded. Final relations point directly to a canonical leaf; cycles,
conflicting successors and chains are rejected or explicitly folded by controlled
migration before acceptance. Legacy names, UUIDs and external aliases remain typed;
identical strings in different namespaces are not silently interchangeable.

### CTR-AICP-004 — Resolution and strict new writes

The owning Auth child must freeze one canonical boundary expressing exact Agent→
Principal, Principal→Agent, explicit successor lookup, and exact pair validation.
Each new Agent business write, Definition creation/publish/assignment, owner binding,
business Grant, long-term client/credential registration, and Agent admission must
validate canonical identity. Legacy inputs fail closed with explicit field/action
errors; they are never silently upgraded. Client ID never becomes owner identity.
Explicit history/migration resolution reports `resolvedViaLegacy=true` and its
attributable source. Ordinary runtime writes cannot use that success as admission.
Authorizing a caller and validating a target remain separate decisions.

### CTR-AICP-005 — Authentication cardinality and permission conservation

Multiple clients may authenticate as the same exact canonical Principal under
existing Auth Contracts. Each client remains server-bound to that Principal; caller
input cannot choose another subject. No unrelated rotation, client cloning, target
impersonation, Grant broadening or HUMAN identity change is included. Retiring a
client is independent of deleting or changing the Principal's historical identity.
If necessary repair changes security/Grant semantics, the Owner decision must precede
the owning authority and operation. SERVICE/AGENT projection mismatches are not cast.

### CTR-AICP-006 — Reference classification and migration

Classify each legacy reference as ACTIVE_REFERENCE_MIGRATE,
IMMUTABLE_HISTORY_PRESERVE, ACTIVE_RUNTIME_RETIRE or DEAD_CODE_COMPATIBILITY.
Use schema-defined identity fields and exact paths; do not replace matching prose.
Mutable Draft repair may alter only proven identity values through canonical APIs.
Published immutable versions are preserved; each is explicitly historical-only or
requires a successor version under owning authority. Preserve graph/context choices,
return/revise behavior and human business semantics. Active work owned by another
execution lane is not mutated. A change of logical Agent requires Owner disposition.

### CTR-AICP-007 — Retirement predicates and retained attribution

Before any legacy Principal retirement, independently prove all five predicates:
LIVE_WRITABLE_REFERENCES=0, ACTIVE_WORK_OWNER_REFERENCES=0,
ACTIVE_GRANTS_REQUIRED=0, ACTIVE_CLIENT_REQUIRED=0, SUCCESSOR_MAPPING_VERIFIED=YES.
Check current writable generators as well as existing instances. Disable/retire/revoke
through accepted lifecycle machinery; do not physical DELETE without an accepted
retention policy and explicit Owner decision. Historical audit/receipt identity stays
unchanged and interpretable through the retained direct successor relation.
Legacy without successor cannot pass this gate by being named test/canary.

### CTR-AICP-008 — Dependency and production order

Order is: read-only full census; reviewed canonical mapping/ledger; independently
reviewed owning write-support Contracts/code; deploy resolver/validator; migrate
writable references; fresh census and zero-live-reference proof; retire unneeded
Grants/clients/Principals; deploy proven compatibility removal; production canary;
final census. Never retire first. Every controlled mutation requires a fresh FREE
root production transaction slot, exact reviewed artifact and preimage, actor binding,
durable receipt/readback, rollback and unknown-outcome handling. Unknown commit/apply
outcomes are observed under the same attempt, not blindly retried.

### CTR-AICP-009 — Compatibility reduction and measurable debt

After migrated consumers and replacement proof, remove obsolete name/UUID maps,
legacy-write acceptance, duplicate resolvers/validators, token-login branches,
config keys and special cases. Measure identity-resolution implementations, fallback
branches, hardcoded Principal UUIDs, runtime legacy names and duplicate validators
before/after with a stable classification and exact code coordinates. Raw grep counts
are not semantic implementation counts. Every remaining compatibility branch records
reason, owner, actual consumer and removal condition; unknown-purpose leftovers fail
the final audit. Do not remove UI navigation or historical decoding as incidental debt.

### CTR-AICP-010 — Conformance and regression prevention

DB/service/test invariants cover uniqueness, direct leaf mappings/no cycles, strict
legacy-write rejection, canonical Auth/Agent Core agreement, field-level Definition
publish rejection, retired identities receiving no new work, credential rotation
preserving Principal, and readable retired history. CI rejects newly hardcoded retired
IDs/legacy runtime names except explicitly reviewed history/migration fixtures, and
emits an IDENTITY_CONFORMANCE_REPORT. Positive canonical cases and real negative
cases must both execute; fixture setup cannot make legacy canonical by assumption.

### CTR-AICP-011 — Owner packet and blocked evidence

Consolidate unavoidable identity ambiguity, missing successors, possible duplicate
logical Agents, Grant semantics, physical deletion, immutable business changes,
product-visible rename and different-Agent reassignment in one evidence packet.
Do not ask Owner to re-decide already accepted exact pairs. Inaccessible required
runtime/reference evidence blocks its dependent gate; do not bypass access controls
or substitute another runtime's files. Continue independent authorized work while
waiting. This Program does not invent authorization from elapsed waiting time.

### CTR-AICP-012 — Full closure and truthful reporting

All Owner DONE_WHEN conditions must be supported at their full scope: known canonical
counts, zero ambiguous/orphan-active/duplicate canonical identities, zero new writable
legacy refs, zero active work to retired Agents, zero unneeded legacy authority and
credentials, complete ledger/no unknown successor/no cycles, Auth-Core and Workflow
conformance PASS, reduced obsolete logic, CI PASS, real production canary/readback,
and no blockers. Report all Owner U metrics and the final canonical identity ledger.
Subset proofs remain subsets. Missing before/after evidence is not zero. Stop only
when this full end state is proven or a genuine Owner/external blocker requires hold.

## 6. Owning child boundaries

| Owner | Required contract closure before its implementation |
|---|---|
| Auth | canonical lifecycle/typed aliases/direct successor persistence; concurrency/uniqueness; exact resolver/error/read authorization; management write/mint/client/Grant lifecycle compatibility; controlled migration and audit |
| Agent Core | authoritative registry/admission conformance; trusted caller adapters; removal of legacy business fallbacks without changing UI navigation; registry/credential/scheduler/session reference census |
| Workflow | strict Draft/create/publish/transition/revise/admin write validation; explicit migration-only successor path; immutable versions/history; plan-bound safe live-reference migration |
| Forum | strict new Auth-sub/Agent binding; immutable local actor attribution; any necessary alias migration has explicit owning authority and audit preservation |
| Dev Center and discovered consumers | exact schema identity ownership; canonical write gates; declared historical read compatibility and removal evidence |

No child may claim this table is its implementation authority. API shapes, schema
constraints, transaction/rollback mechanisms and exact file closure must be decided
in the relevant accepted child. If that decision changes an accepted parent's
meaning, re-PREFLIGHT to a whole-authority successor before implementation.

## 7. Acceptance matrix

Each row requires exact authority/code/plan coordinates, environment, timestamp,
executed evidence and independent review appropriate to the affected Contract.

| Acceptance | Contracts | Method / environment | Required evidence and expected result | Failure condition |
|---|---|---|---|---|
| ACC-AICP-001 | 001 | deployed schema/config + repository discovery, read-only | every discovered surface reconciled, classified identity/reference census, UNKNOWN=0 | inaccessible/unscanned surface treated as empty |
| ACC-AICP-002 | 002,003 | Auth DB constraints + Core authoritative reads, isolated and production census | one-to-one canonical relation, explicit reviewed direct successor, no cycle/duplicate | regex/name/client inference, duplicate, chain ambiguity |
| ACC-AICP-003 | 004 | cross-repo positive/negative contract matrix | canonical accepted; known legacy migration-read explicit; all new legacy writes field-level rejected with zero persistence | silent upgrade or one consumer still accepts |
| ACC-AICP-004 | 005 | multiple-client/rotation/profile tests + exact grant comparison | stable Principal and unchanged unrelated permissions/HUMAN model | client used as actor or privilege/type drift |
| ACC-AICP-005 | 006 | exact Draft/Published/active/history plans and readback | same business semantics, historical bytes preserved, all writable legacy sources closed | blanket replace, Published mutation, cross-lane work reassignment |
| ACC-AICP-006 | 007,008 | exact guarded production runbook, preimage and independent readback | five retirement predicates, FREE slot, receipts, safe rollback/same-attempt unknown handling | retire before refs zero, unsafe replay, physical delete |
| ACC-AICP-007 | 009,010 | reviewed code inventory + CI + real consumer regression | measured logic reduction, remaining compatibility accounted for, conformance report | raw grep declared semantic proof or history/UI regression |
| ACC-AICP-008 | 011,012 | whole-universe final audit and real canary | closed Owner decisions and all Owner U/T fields evidenced; final ledger/readback/canary PASS | subset called complete or absent evidence reported zero |

## 8. Authoring and execution status

```text
SPEC_GOVERNANCE_MODE = AUTHOR
STATUS = proposed
CONTRACT_COUNT = 12
CONTRACTS_WITH_ACCEPTANCE = 12
PARTIAL_SUPERSESSION = NONE
OPEN_OWNER_DECISIONS = stock identity disposition; unresolved census packet
NORMATIVE_TBD = NONE_AT_PROGRAM_LEVEL
IMPLEMENTATION_CONTRACT_CLOSURE = REQUIRED_IN_OWNING_CHILDREN
AUTHORING_READY_FOR_REVIEW = YES_AS_NON_EXECUTABLE_PROGRAM
IMPLEMENTATION_READY = NO
PRODUCTION_READY = NO
GLOBAL_CENSUS_COMPLETE = NO
NEXT_ACTION = INDEPENDENT_PROGRAM_REVIEW_AND_CONTINUE_READ_ONLY_EVIDENCE
```
