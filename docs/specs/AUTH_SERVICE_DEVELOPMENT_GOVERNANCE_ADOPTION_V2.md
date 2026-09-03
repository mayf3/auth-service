---
spec_id: AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
status: accepted
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service development governance adoption
  - shared vendored governance integrity and local activation lifecycle
governed_by: []
external_authorities:
  - repository: mayf3/agent-development-governance
    authority_id: AGENT_DEVELOPMENT_GOVERNANCE_V1
    revision: 902842735a69797b54016eeaa88d2f949f5879a9
    relation: constrained_by
supersedes:
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
superseded_by: null
owners:
  - mayf3
---

# Agent Development Governance v1.0.0 Adoption V2

## 1. Goal

Adopt the exact upstream `development-governance-v0` distribution released as
annotated tag `v1.0.0` at source commit
`902842735a69797b54016eeaa88d2f949f5879a9`, through this repository's own
independent Review and Owner acceptance. After activation, future applicable
work independently classifies Authority, Plan, and Assurance, and stops when
`DONE_WHEN` is met unless an `EXPANSION_TRIGGER` fires.

## 2. Scope and non-goals

In scope: exact manifest-managed shared governance bytes, the governance lock,
local adoption/supersession lifecycle, route validation, and forward-only use.

Out of scope: changes to `AGENTS.md`, `.agents/local/**`, local Product Direction,
Architecture, product Specs, acceptance actors, product code, runtime, production,
permissions, Grants, credentials, Secrets, historical records, or
`AGENT_OPERATIONAL_LAYER_V1`; this preparation does not accept or merge itself.

## 3. Authority and dependencies

### DEC-ADOPT2-001 — Whole-authority successor

The accepted/current `AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` owns
local adoption today. Governance v1.0.0 changes long-lived routing obligations
by separating Authority, Plan, and Assurance and adding Execution Mandates,
isolated-write requirements, route stages, load-bearing gap handling, route
validation, and explicit stop controls. V1 MUST NOT be rewritten in place.
This proposed V2 is its complete successor.

### DEC-ADOPT2-002 — Local acceptance remains authoritative

Upstream release status does not activate local authority. This repository owns
independent Review, Owner acceptance, atomic lifecycle transition, and merge.
`.agents/local/**` remains the repository-local extension and is not vendored.

## 4. Current State

- `STATE-ADOPT2-001` — At Base
  `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`, V1 is accepted/current and the
  lock pins `0.1.0-draft.1@46f78c3f00d768d99a4c8c2da975b124bce042f9`.
- `STATE-ADOPT2-002` — On this Draft PR, exact v1.0.0 bytes and proposed
  metadata are prepared, but V2 is not active local authority.

## 5. Observations

### OBS-ADOPT2-001 — Consumer Base

- Source revision: `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`.
- Environment: GitHub default branch `main` and isolated adoption branch.
- Observed at: `2026-09-02T13:00:12Z`.
- Method: read the Base tree, existing V1 adoption authority, lock, local
  governance, and Spec index.
- Result: V1/lock are accepted; local extensions and product authorities are
  repository-owned and separate from vendored bytes.
- Provenance: exact Base commit and this preparation workflow run.

### OBS-ADOPT2-002 — Upstream release identity

- Source: annotated tag object `bb98937d176890088da736fa4a45f48279f19d50`.
- Result: tag `v1.0.0` resolves exactly to
  `902842735a69797b54016eeaa88d2f949f5879a9`.
- Provenance: upstream tag ref, annotated tag object, and exact source checkout.

### OBS-ADOPT2-003 — Distribution manifest

- Source revision: `902842735a69797b54016eeaa88d2f949f5879a9`.
- Result: distribution=`development-governance-v0`, version=`1.0.0`,
  files=25, manifest Git blob=`d4e37f492653260aa24878af1a9208f53122db5d`,
  SHA-256=`c1fa620da4a16e4073d617e49eb5080487f2a117e3bab6502fd223afee0f06e0`.
- Provenance: upstream manifest and exact vendor source checkout.

### OBS-ADOPT2-004 — Vendor dry-run and apply

- Source revision: `902842735a69797b54016eeaa88d2f949f5879a9`.
- Environment: isolated GitHub Actions checkout of the adoption branch.
- Observed at: `2026-09-02T13:00:12Z`.
- Method: run exact upstream `tools/vendor.py` first without `--apply`,
  inspect the plan, then rerun with `--apply`.
- Result: only manifest-managed shared governance bytes and
  `.agents/governance.lock.json` were written; existing `AGENTS.md`,
  `.agents/local/**`, and `docs/specs/README.md` were not vendor targets.
- Provenance: persistent GitHub Actions logs and candidate diff.

## 6. Claims and assumptions

- `CLM-ADOPT2-001` (`SUPPORTED`) — The long-lived obligation change requires
  `SUPERSEDE`, supported by `EVD-ADOPT2-001`.
- `CLM-ADOPT2-002` (`SUPPORTED`) — Exact manifest vendoring preserves local
  authority boundaries, supported by `EVD-ADOPT2-002`.
- Open assumptions affecting normative meaning: none.

## 7. Evidence relations

- `EVD-ADOPT2-001` — `OBS-ADOPT2-001..003` SUPPORT
  `CLM-ADOPT2-001` at the exact consumer/upstream coordinates; sufficient for
  PREFLIGHT and candidate preparation, not local acceptance.
- `EVD-ADOPT2-002` — `OBS-ADOPT2-003..004` SUPPORT
  `CLM-ADOPT2-002`; sufficient for candidate-byte preparation because the exact
  release tool, manifest, lock, and resulting diff are independently inspectable.

## 8. Decisions

### DEC-ADOPT2-003 — Exact immutable pin

The local lock MUST pin source repository
`mayf3/agent-development-governance`, source commit
`902842735a69797b54016eeaa88d2f949f5879a9`, version `1.0.0`, and
compatibility distribution ID `development-governance-v0`. Mutable upstream
branches, a merge commit, or a renamed distribution MUST NOT substitute.

### DEC-ADOPT2-004 — Proposed preparation only

Preparation MUST retain V1 as current, retain all local/product authority, and
leave both the new Spec and lock proposed. A later Owner-authorized transaction
may accept V2, supersede V1 with reciprocal backlinks, populate lock acceptance
metadata, update navigation, pass final-Head recheck, and merge into `main`.

## 9. Contracts

### CTR-ADOPT2-001 — Exact release and bytes

The tag type, tag object, source commit, manifest identity, 25 managed paths,
hashes, sizes, version, and distribution ID MUST match upstream v1.0.0 exactly.

### CTR-ADOPT2-002 — Truthful proposed lifecycle

On this preparation Head, `adoption.status=proposed`, `accepted_by=null`, and
`accepted_at=null`; V1 MUST remain accepted/current and unchanged. The
preparation Agent MUST NOT mark the PR ready, accept, or merge it.

### CTR-ADOPT2-003 — Local preservation

`AGENTS.md`, `.agents/local/**`, local Product Direction, Architecture,
invariants, product Specs, acceptance actors, product code, runtime, and
production state MUST remain unchanged.

### CTR-ADOPT2-004 — Three-axis forward route

After activation, every applicable non-trivial task MUST classify Authority,
Plan, and Assurance independently, bind `DONE_WHEN`, and stop unless an
`EXPANSION_TRIGGER` fires. Every mutation requires attributable authorization
and an isolated write surface. Historical artifacts MUST NOT be bulk rewritten.

### CTR-ADOPT2-005 — Independent local activation

The preparation Head MUST receive independent exact-Head Review. Only a later
Owner-authorized atomic transaction may accept V2, supersede V1, accept the
lock, update navigation, pass final-Head recheck, and merge.

## 10. Acceptance

### ACC-ADOPT2-001 — Release identity

- Contracts: `CTR-ADOPT2-001`.
- Method: inspect tag ref/object and recompute manifest and managed-file identity.
- Environment: exact source checkout and exact candidate checkout.
- Required evidence: exact tag object, source commit, manifest SHA-256, and
  25-path hash/size matrix.
- Expected result: every identity matches the immutable v1.0.0 release.
- Failure condition: any lightweight/different/missing tag, path, hash, size,
  pin, version, or distribution ID mismatch.

### ACC-ADOPT2-002 — Lifecycle and preservation

- Contracts: `CTR-ADOPT2-002`, `CTR-ADOPT2-003`, `CTR-ADOPT2-005`.
- Method: compare Base/candidate paths and blobs; inspect lock, Specs, and PR state.
- Environment: exact Draft PR Base/Head and live PR metadata.
- Required evidence: changed-file list; Base/candidate identities for
  `AGENTS.md`, `.agents/local/**`, V1, product/runtime paths; proposed lock;
  exact Draft PR Head.
- Expected result: no premature acceptance/supersession/merge and no unauthorized
  local, product, runtime, or production change.
- Failure condition: any prohibited path changes or lifecycle claim.

### ACC-ADOPT2-003 — Governance and repository validation

- Contracts: `CTR-ADOPT2-001`, `CTR-ADOPT2-004`.
- Method: verify lock/schema/managed bytes; compile and exercise validators; run
  the upstream distribution suite and applicable auth-service tests.
- Environment: exact proposed candidate.
- Required evidence: executed commands and GitHub Actions results bound to Head.
- Expected result: governance verification, route validator, transition validator,
  Contract validation/tests, OAuth tests, general tests, and build all pass.
- Failure condition: any mismatch, unavailable validator, failed test, or false
  claim that deterministic validation replaces semantic Review.

### Contract coverage

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-ADOPT2-001` | `ACC-ADOPT2-001`, `ACC-ADOPT2-003` | YES |
| `CTR-ADOPT2-002` | `ACC-ADOPT2-002` | YES |
| `CTR-ADOPT2-003` | `ACC-ADOPT2-002` | YES |
| `CTR-ADOPT2-004` | `ACC-ADOPT2-003` | YES |
| `CTR-ADOPT2-005` | `ACC-ADOPT2-002` | YES |

## 11. Alternatives and disposition

Rejected: rewriting accepted V1 in place; pinning upstream `main` or a merge
commit; renaming `development-governance-v0`; auto-accepting during vendoring;
mixing product or Operational Layer implementation into this adoption; bulk
historical rewrite.

## 12. Migration, compatibility, and rollback

`PRODUCT_CODE_MIGRATION=NONE`, `DATA_MIGRATION=NONE`,
`RUNTIME_MIGRATION=NONE`, `PRODUCTION_MIGRATION=NONE`.
Existing product authorities and local extensions retain meaning. Before
acceptance, rollback is closing the Draft PR. After acceptance, rollback requires
a new accepted successor; accepted V2 meaning is not rewritten.

## 13. Open questions



## Final proposed output


