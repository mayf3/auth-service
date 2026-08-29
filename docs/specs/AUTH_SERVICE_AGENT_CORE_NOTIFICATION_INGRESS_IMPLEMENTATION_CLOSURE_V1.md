---
spec_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
status: superseded
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
  - Minimal Auth Contract Bundle 1.3.0 -> 1.4.0 versioned registration delta closure
governed_by:
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by:
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1

## 1. Purpose and authority boundary

This child Spec is the sole proposed authority for the **exact implementation file
closure** of the already accepted parent authority
`AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1` (accepted,
`implementation_authority: contracts`). The parent froze the Audience/Scope
semantics (`CTR-NI-001`–`CTR-NI-006`) but did not freeze the implementation file
closure. This child freezes that closure and nothing else.

```text
PARENT_SPEC_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
CHILD_AUTHORITY_KIND = NEW_CHILD_SPEC_AUTHORITY
PARALLEL_PRODUCT_AUTHORITY_CREATED = NO
SUPERSEDES_PARENT = NO
PARENT_SEMANTICS_CHANGED = NO
REGISTRATION_SEMANTICS = PARENT-OWNED (CTR-NI-001..CTR-NI-006 unchanged)
CHILD_OWNS = exact implementation file closure + version/linkage delta boundary only
CONTRACT_TS_CHANGE_CLASS = LIMITED_RUNTIME_COMPATIBILITY_CHANGE (per DEC-VL-002 class)
CONTRACT_TS_CHANGE_BOUNDARY = ONLY_ADD_1_4_0_TO_SUPPORTED_VERSION_ALLOWLIST
```

Because this Spec is `proposed` and `implementation_authority: none`, it grants no
implementation or merge authority. It may grant the exact Contracts below only
after independent semantic review, owner acceptance of the exact final head, and
merge to `main` with `status: accepted` and `implementation_authority: contracts`.

## 2. Immutable coordinates

All observations, the closure derivation, and the executed fail-closed evidence in
this Spec are bound to:

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689
DISPATCH_MAIN = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689 (exact match)
PARENT_SPEC_BLOB @BASE = f236b525c2193941c234ddebe8ebc2bb16c5341a
CONTRACT_TS_BLOB @BASE = 22dcdb1261db79b1683fc9ca2e86083579f25f8b
  (identical to the CTR-MAFV2-001 frozen identity)
AUDIENCE_REGISTRY_BLOB @BASE = ef7e139ec545471cbb4e84ce84a5fbcc3c48b1d7
  (identical to the CTR-MAFV2-001 frozen identity)
AUTHORING_OBSERVED_AT = 2026-08-24
EXECUTION_ENVIRONMENT:
  OS = Darwin 26.5.2 arm64
  NODE = v26.7.0
  NPM = 11.19.0
  TSX = 4.22.3 (npm ci from the committed package-lock.json)
  WORKTREE = independent linked worktree at AUTHORING_BASE
```

## 3. Semantic classification

The parent-authorized registration (`agent-core-notification-ingress-v1`,
`notification.deliver`, service-only machine access) is implemented as data inside
the versioned Contract Bundle; no `src/` logic change is needed for the
Audience/Scope/principal semantics themselves. However, the required real versioned
delta (`1.3.0` -> `1.4.0`, mechanically determined in §5) makes four non-bundle
files necessary, exactly reproducing the `DEC-VL-002` change class settled for
Contract `1.3.0`:

```text
BEFORE = ['1.0.0', '1.1.0', '1.2.0', '1.3.0']
AFTER  = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0']
```

This is a `LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, not mechanical and not
semantic-delta-none. The accepted precedent
(`AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1`, `DEC-VL-002`/`DEC-VL-003`) ruled that
this class is outside an Audience CCR's own authority and required a dedicated
child Spec frozen before implementation could fit closure. The parent NI CCR froze
no file closure and names no `src/` or `tests/` file; therefore this child Spec is
required before any implementation PR may proceed.

## 4. Mechanical closure derivation

Every candidate below was classified against the repo's omission standard
(`PROVEN_NECESSARY` = omission causes a deterministic failure in an executed,
explicitly frozen gate because the `1.4.0` registration/linkage is missing;
`NOT_NECESSARY` = comment-only, no enforcing reader, no formal acceptance entry,
or all applicable gates still pass after omission).

### 4.1 Executed fail-closed evidence at `AUTHORING_BASE`

In a scratch state (fully reset afterward; worktree restored byte-clean and
re-verified `MINIMAL_AUTH_V1_BUNDLE_VALID=true` at `1.3.0`), the bundle version
pins alone were bumped consistently `1.3.0` -> `1.4.0` across the ten version-pinned
bundle files, with **no** `src/`/`tests/` change:

| GATE | COMMAND | RESULT |
|---|---|---|
| Bundle validator | `npm run contract:v1:validate` | exit 0, `MINIMAL_AUTH_V1_BUNDLE_VALID=true` (bundle-consistent bump is internally valid) |
| Runtime contract test | `JWT_SECRET=test-jwt-secret npm run contract:v1:prepare && JWT_SECRET=test-jwt-secret ./node_modules/.bin/tsx --test tests/oauth/contract-runtime-v1.test.ts` | exit 1, `pass 3 / fail 1`; failing test `v1 mode loads the frozen implementation-authorized snapshot`; load-bearing error `Minimal Auth V1 runtime snapshot version is unsupported.` |
| Candidate gate | `npm run contract:v1:candidate && ./node_modules/.bin/tsx --test tests/oauth/candidate-contract.test.ts` | exit 1, `pass 0 / fail 1`; load-bearing error `Candidate runtime snapshot version is unsupported.` |

This proves: a real `1.4.0` delta cannot pass its own frozen validation suite
without the four linkage files below; omitting any of them reproduces a
deterministic fail-closed result.

### 4.2 Candidate classification matrix

| FILE | CLASS | ENFORCING CONSUMER / REASON | VERDICT |
|---|---|---|---|
| `contract-bundles/minimal-auth-v1/audience-registry.json` | registry_version pin + new Audience entry | frozen target CTR-NI-001; `validate.mjs:274`; runtime snapshot embeds the registry | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/contract-manifest.json` | `contract_version` + `audience_registry_version` pins | `validate.mjs:274`; snapshot `contractVersion` source | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json` | `contract_version` const `1.3.0` -> `1.4.0` | `validate.mjs` schema compile; VL matrix row 1 precedent (`/contract_version must be equal to constant`) | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json` | version pin + new positive fixture | `validate.mjs:277`; parent ACC-NI positive conformance | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json` | version pin + new negative cases | `validate.mjs:278`; parent ACC-NI-002 negatives | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/fixtures/schema-instances.json` | version pin | `validate.mjs:279` | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/metadata/freeze-gates.json` | version pin | `validate.mjs:275` | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json` | version pin only (no consumer entry; no consumer exists for this Audience) | `validate.mjs:276` | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json` | version pin | `validate.mjs:280` | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json` | version pin | `validate.mjs:281` | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/metadata/change-log.md` | new `1.4.0` entry | versioned-artifact record required by accepted grammar (OBS-NI-003; 1.1.0/1.2.0/1.3.0 precedent) | `PROVEN_NECESSARY` |
| `src/lib/oauth/v1/contract.ts` | supported-version allowlist + `1.4.0` | `tests/oauth/contract-runtime-v1.test.ts` via `initializeAuthContract('v1')`; §4.1 executed evidence; VL matrix row 3 precedent | `PROVEN_NECESSARY` |
| `tests/helpers/load-candidate-snapshot.ts` | candidate supported-version allowlist + `1.4.0` | candidate gate; §4.1 executed evidence; VL matrix row 5 precedent | `PROVEN_NECESSARY` |
| `tests/oauth/candidate-contract.test.ts` | executable version expectation `1.4.0` | candidate gate; VL matrix row 6 precedent | `PROVEN_NECESSARY` |
| `tests/oauth/contract-runtime-v1.test.ts` | executable version expectation `1.4.0` | runtime gate; VL matrix row 7 precedent | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/validate.mjs` | none for this delta | service-principal machine-profile enforcement already exists (`PROFILE_FORBIDDEN_CLAIM` agent_id rule, machine_access/principal-type/scope checks); §4.1 validator passed with `validate.mjs` untouched | `NOT_NECESSARY` |
| `contract-bundles/minimal-auth-v1/schemas/audience-registry.schema.json` | none | no version const (`registry_version` is a free string); `service` already an allowed principal enum; §4.1 validator passed without it | `NOT_NECESSARY` |
| `contract-bundles/minimal-auth-v1/README.md` | none | no version pin; no enforcing reader | `NOT_NECESSARY` |
| `contract-bundles/minimal-auth-v1/fixtures/jwks.json` / `fixtures/verify-compact-jwt.mjs` | none | fixture signing/verification infra reused as-is (tracked fixture keys) | `NOT_NECESSARY` |
| `docs/contracts/minimal-auth-v1/grants-and-audiences.md` | §2 closed Bundle Audience list | no executable gate reads it; post-V2 the module bytes are CTR-MAFV2-001-frozen (`2f05c06a…`); see DEC-NIC-004 and OQ-NIC-001 | `NOT_NECESSARY (default; owner-reviewable)` |
| `docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` | none | zero mentions of any notification resource; never a Legacy consumer; nothing to remove (unlike svc-forum §6) | `NOT_NECESSARY` |
| `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md` | none | accepted architecture authority; parent NI CCR §3 explicitly does not amend V2; child cannot amend it; stale `CURRENT_MINIMAL_AUTH_CONTRACT_VERSION = 1.3.0` recorded at OQ-NIC-002 | `NOT_NECESSARY / OUT_OF_CHILD_AUTHORITY` |
| `scripts/bootstrap-obo-conformance-fixture.ts` | none | VL matrix row 2: no enforcing reader | `NOT_NECESSARY` (VL exclusion) |
| `tests/frozen-svc-okr-route-conformance.test.ts` | none | VL matrix row 4: comment-only | `NOT_NECESSARY` (VL exclusion) |
| `docs/specs/README.md` | none | not a per-Spec index; PR #12 precedent added exactly one file | `NOT_NECESSARY` |
| other `tests/` referencing specific audiences (`v1-scope`, `migration-v1-static`, `oauth-schemas`, grant-supply tests, …) | none | do not iterate the registry audience set; only version-expectation files above are affected | `NOT_NECESSARY` |

### 4.3 Frozen closure

```text
FINAL_IMPLEMENTATION_SCOPE_FILES = 15
```

```text
contract-bundles/minimal-auth-v1/audience-registry.json
contract-bundles/minimal-auth-v1/contract-manifest.json
contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json
contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
contract-bundles/minimal-auth-v1/metadata/change-log.md
src/lib/oauth/v1/contract.ts
tests/helpers/load-candidate-snapshot.ts
tests/oauth/candidate-contract.test.ts
tests/oauth/contract-runtime-v1.test.ts
```

No wildcard, directory, generated output, or "related file" is authorized. The
first file outside this set is rejected, and every outside-file need is
`OWNER_DECISION_REQUIRED`.

## 5. Version determination

```text
BUNDLE_VERSION_BEFORE = 1.3.0
CHANGE_CLASS = additive Audience/Scope registration (backward-compatible)
DETERMINED_VERSION = 1.4.0
RULE = accepted precedent: additive registrations are minor bumps
  (1.1.0 svc-okr machine access, 1.2.0 okr.write, 1.3.0 svc-forum audience)
NO_IN_PLACE_DISGUISE = YES (registry/manifest/fixtures MUST NOT stay at 1.3.0)
```

## 6. Decisions

### DEC-NIC-001 — Child Spec required before implementation

- Decision owner: mayf3 (task-dispatch ruling; child authored under it)
- Decision: STOP direct implementation; freeze the exact closure here first.
- Rejected alternative: implement now and let the implementation self-authorize
  its file set.
- Reason: accepted precedent `DEC-VL-003` — "Already-written implementation cannot
  grant itself authority"; the parent froze semantics but no closure.

### DEC-NIC-002 — Honest classification of the runtime allowlist delta

- Decision owner: mayf3
- Decision: adding `1.4.0` to `src/lib/oauth/v1/contract.ts` and the candidate
  loader allowlists is `LIMITED_RUNTIME_COMPATIBILITY_CHANGE` requiring this
  child's explicit authority.
- Rejected alternative: classify it as mechanical bundle bookkeeping.
- Reason: `DEC-VL-002` settled this exact class for `1.3.0`; §4.1 shows the gates
  fail closed without it.

### DEC-NIC-003 — 15-file closure, nothing more

- Decision owner: mayf3
- Decision: the closure is exactly §4.3; `validate.mjs`, registry schema, bundle
  README, fixture JWKS infra, and all other candidates stay byte-identical.
- Rejected alternative: port the full 18-file svc-forum closure wholesale.
- Reason: closure must be re-derived per delta (task rule: "不得直接照抄 1.3.0
  文件集合"); three svc-forum-necessary files are provably unnecessary here
  (`validate.mjs` agent_id rule, `grants-and-audiences.md` §2, `v0-to-v1-migration.md` §6).

### DEC-NIC-004 — Historical V1 module list is not amended by default

- Decision owner: mayf3 (reviewable in 注册 审计)
- Decision: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2 Bundle
  Audience 清单 is NOT amended in this closure. Post-V2, that module is
  CTR-MAFV2-001-frozen exact-incorporated provenance; the governing registration
  authority for this Audience is the accepted parent NI CCR itself, and the
  change-log entry records the registration provenance.
- Rejected alternative: amend §2 to add `agent-core-notification-ingress-v1`
  (the pre-V2 svc-forum pattern).
- Reason: PR #11's amendment predates V2 acceptance and was grandfathered by it;
  a child Spec may not modify a CTR-MAFV2-001 immutable object. If 注册 审计
  rules the historical list must track the registry, that is a V2-level owner
  decision under a separate authority (OQ-NIC-001).

### DEC-NIC-005 — First service-principal positive fixture

- Decision owner: mayf3
- Decision: the positive fixture set gains its first `principal_type=service`
  Direct Machine fixture (`direct-service-notification-ingress`), exercising the
  already-enforced service profile (`agent_id` forbidden, machine access +
  principal-type + strict-scope + exact requested-scope equality + grant subset).
- Rejected alternative: add no positive fixture (rely on svc-auth precedent of
  none).
- Reason: the parent ACC-NI positive conformance requires an executed positive
  case; `notification.deliver` is otherwise never exercised.

## 7. Contracts

### CTR-NIC-001 — Exact closure

After acceptance and merge only, an implementation PR under the parent NI CCR MAY
modify exactly the 15 files in §4.3 and no others. The first file outside the set
is `OWNER_DECISION_REQUIRED`.

### CTR-NIC-002 — Exact registry entry

The implementation MUST produce exactly the parent `CTR-NI-001` entry in
`audience-registry.json` (machine-comparable, parent ACC-NI-001), with
bundle-lifecycle metadata (`freeze_ready: true`, `notes`) permitted only as the
accepted schema requires, without changing any frozen field.

### CTR-NIC-003 — Exact runtime compatibility boundary

`src/lib/oauth/v1/contract.ts` MAY change only by adding string literal `1.4.0`
to the supported Contract-version allowlist. `tests/helpers/load-candidate-snapshot.ts`
MAY change only by adding the same literal (plus its matching comment).
`tests/oauth/candidate-contract.test.ts` and `tests/oauth/contract-runtime-v1.test.ts`
MAY change only their `1.3.0` version expectations to `1.4.0`. No format-version,
digest, lifecycle, Audience, Scope, signer, verifier, claim, algorithm,
introspection, fallback, or error behavior may change under this Contract.

### CTR-NIC-004 — Positive conformance

The implementation MUST add positive fixture `direct-service-notification-ingress`:
Direct Machine profile, RS256 + tracked fixture `kid`, `iss = auth-service`,
`aud = agent-core-notification-ingress-v1`, `principal_type = service`, no
`agent_id` claim, `token_use = access`, `scope = "notification.deliver"` with
`requested_scope` exactly equal, and `machine_access_grants` containing
`agent-core-notification-ingress-v1 -> ["notification.deliver"]`. It MUST pass the
existing bundle validation path (`validate.mjs`); no second fixture semantics may
be introduced.

### CTR-NIC-005 — Negative conformance (fail-closed, no downscope)

The implementation MUST add negative cases at least covering: agent principal on
this Audience; human principal; delegated/OBO attempt; wrong audience (including
`svc-auth` with `notification.deliver`); `auth.identity.provision` against this
Audience; unregistered `notification.*` scopes; wildcard (`*`, `notification.*`);
extra scope beyond the Grant (whole-request rejection); requested-vs-issued scope
mismatch (silent downscope); cross-Audience Grant reuse. Every case MUST be
rejected whole without partial issuance.

### CTR-NIC-006 — No Grant, credential, client, or production effect

The implementation MUST NOT create or enlarge any Principal, Client, secret,
MachineAccessGrant, or credential handoff, and MUST NOT perform any production
apply, deploy, database migration, or Grant write. Audience registration MUST NOT
auto-create a Grant (parent CTR-NI-004/CTR-NI-006 inherited).

### CTR-NIC-007 — Version pins and change record

All ten version-pinned bundle files MUST move to `1.4.0` together (validator
`validate.mjs:274-281` enforces consistency), and `metadata/change-log.md` MUST
record the `1.4.0` entry naming the parent CCR, the exact frozen entry fields, the
new fixtures, the version/linkage promotion, and `NO GRANT CREATED`.

### CTR-NIC-008 — Parent and V2 bytes remain unchanged

This child and its implementation MUST NOT modify
`docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1.md`,
`docs/contracts/minimal-auth-v2/**`, or any `NOT_NECESSARY` file in §4.2.

## 8. Acceptance mapping

### ACC-NIC-001 — Exact entry comparison

- Contracts: `CTR-NIC-002`. Command: machine-compare the registry entry against
  parent `CTR-NI-001` JSON. Expected: exact equality of every frozen field.

### ACC-NIC-002 — Validator

- Contracts: `CTR-NIC-007`. Command: `npm run contract:v1:validate`.
  Expected: exit 0, `MINIMAL_AUTH_V1_BUNDLE_VALID=true`.

### ACC-NIC-003 — Runtime and full contract tests

- Contracts: `CTR-NIC-003`. Commands:
  `JWT_SECRET=test-jwt-secret npm run contract:v1:prepare`,
  `JWT_SECRET=test-jwt-secret ./node_modules/.bin/tsx --test tests/oauth/contract-runtime-v1.test.ts`,
  `npm run test:contract-v1`. Expected: runtime identity reports exactly `1.4.0`;
  all contract tests pass. Negative evidence: §4.1 fail-closed rows.

### ACC-NIC-004 — Candidate gate

- Contracts: `CTR-NIC-003`. Command:
  `npm run contract:v1:candidate && ./node_modules/.bin/tsx --test tests/oauth/candidate-contract.test.ts`.
  Expected: exit 0 at `1.4.0`. Negative evidence: §4.1 fail-closed row.

### ACC-NIC-005 — OAuth suite and typecheck

- Contracts: `CTR-NIC-003`. Commands: `npm run test:oauth`; `npx tsc -p tsconfig.json --noEmit`.
  Expected: both pass with no closure-external file changed.

### ACC-NIC-006 — Hygiene

- Commands: `git diff --check`; PR file list equals exactly §4.3.
  Expected: clean; no whitespace errors; no extra files.

### ACC-NIC-007 — Conformance and no-production boundary

- Contracts: `CTR-NIC-004`, `CTR-NIC-005`, `CTR-NIC-006`.
  Method: fixture validation through `validate.mjs` plus PR diff audit.
  Expected: all positive/negative parent ACC-NI cases executed and passing; no
  Principal/Client/secret/Grant created; no production change.

## 9. Alternatives and disposition

### ALT-NIC-001 — Implement directly under the parent CCR now

- Disposition: rejected
- Reason: parent froze semantics, not closure; runtime linkage delta exceeds the
  settled audience-CCR authority class (DEC-VL-002/003); implementation cannot
  self-authorize its file set.

### ALT-NIC-002 — Port the svc-forum 18-file closure wholesale

- Disposition: rejected
- Reason: three files are provably unnecessary for this delta (§4.2); closure must
  be mechanically re-derived per version.

### ALT-NIC-003 — Bundle-only delta, defer runtime linkage

- Disposition: rejected
- Reason: §4.1 proves the frozen runtime/candidate gates fail closed; the task's
  own validation suite could not pass; a merged bundle the runtime rejects would
  break `initializeAuthContract` consumers.

### ALT-NIC-004 — Amend `grants-and-audiences.md` §2 as PR #11 did

- Disposition: rejected by default (DEC-NIC-004); owner-reviewable via OQ-NIC-001
- Reason: post-V2 the module bytes are CTR-MAFV2-001-frozen; only a V2-level
  owner decision may change them.

## 10. Migration, compatibility, and rollback

```text
MIGRATION_THIS_ROUND = NONE (docs-only child Spec)
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
PRODUCT_CODE_CHANGE = NONE
FUTURE_IMPLEMENTATION = versioned bundle delta 1.3.0 -> 1.4.0 under §4.3 closure
ROLLBACK = delete/revise this proposed branch before acceptance; no runtime state
```

Runtime compatibility is additive (`1.0.0`–`1.3.0` remain supported); no existing
token, Grant, audience, or consumer behavior changes.

## 11. Open questions

```text
OQ-NIC-001 (owner-reviewable in 注册 审计):
  Whether the CTR-MAFV2-001-frozen historical V1 module list
  (grants-and-audiences.md §2) must track the executable registry post-V2.
  Default frozen here: NO (DEC-NIC-004). Overriding requires a separate
  V2-level authority and extends the closure by exactly that one file.
OQ-NIC-002 (owner note):
  After a future 1.4.0 merge, V2's recorded CURRENT_MINIMAL_AUTH_CONTRACT_VERSION
  = 1.3.0 and CTR-MAFV2-001 identities remain historical provenance snapshots and
  are not silently rewritten; any V2 refresh is a separate owner decision.
OPEN_OWNER_DECISIONS = OQ-NIC-001 disposition during 注册 审计
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 12. Frozen summary

```text
AUTHORITY_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
STATUS = proposed
PARENT_AUTHORITY = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
BUNDLE_VERSION_BEFORE = 1.3.0
BUNDLE_VERSION_AFTER (authorized target) = 1.4.0
FINAL_IMPLEMENTATION_SCOPE_FILES = 15
RUNTIME_SEMANTIC_DELTA = LIMITED_RUNTIME_COMPATIBILITY_CHANGE (add 1.4.0 allowlist)
PROVEN_NECESSARY = 15 files (§4.3)
NOT_NECESSARY = validate.mjs, audience-registry.schema.json, bundle README,
  jwks/verify fixtures, grants-and-audiences.md (default), v0-to-v1-migration.md,
  minimal-auth-v2/**, bootstrap-obo-conformance-fixture.ts,
  frozen-svc-okr-route-conformance.test.ts, docs/specs/README.md, package-lock.json,
  all other tests
PRODUCTION_GRANT_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
PRODUCT_CODE_CHANGE = NONE (this round: docs only)
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
MERGE_PERFORMED = NO
```

## 13. Authoring provenance

```text
AUTHORED_BY = 注册 执行 round (ZCode mechanical executor)
AUTHORING_BASE = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689 (github/main, exact dispatch match)
AUTHORING_MODE = spec-governance AUTHOR (docs-only; implementation stopped at gate)
EVIDENCE = §4.1 executed fail-closed runs in an independent worktree, fully reset
  and re-verified pristine (MINIMAL_AUTH_V1_BUNDLE_VALID=true at 1.3.0) before
  authoring; no commit of the experiment state, no push of implementation files
NEXT_TASK = 注册 审计
```

## 14. Acceptance Record

```text
ACCEPTED_BY = mayf3
INDEPENDENT_REVIEW = 注册 审计 = PASS
REVIEWED_BASE = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689
REVIEWED_SPEC_HEAD = 8ba603f8d4397898c09c5bcd17bac67f0022cbc8
BLOCKERS = NONE
REQUIRED_FIXES = NONE
SPEC_PR = mayf3/auth-service#27
LIFECYCLE_DELTA = status: proposed -> accepted;
  implementation_authority: none -> contracts
SEMANTIC_DELTA_AFTER_REVIEW = NONE
MAIN_AT_REVIEW = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689 (no new commits; no
  authority conflict)
PR_DIFF_AT_REVIEW = exactly one Child Spec file
```

### Audit rulings recorded verbatim (注册 审计)

```text
OQ_NIC_001 = CLOSED_KEEP_HISTORICAL_GRANTS_AND_AUDIENCES_LIST_UNCHANGED

含义：
- docs/contracts/minimal-auth-v1/grants-and-audiences.md
  继续作为 V2 exact-incorporated 历史快照；
- 本次 1.4.0 authority 由 accepted parent CCR、
  accepted Child closure Spec、
  executable registry 和 change-log 承载；
- 不把该历史清单加入本轮 closure；
- 未来若要更新，必须另做 V2-level owner decision。

OQ_NIC_002 = CLOSED_V2_1_3_0_COORDINATES_ARE_HISTORICAL_PROVENANCE

含义：
- MINIMAL_AUTH_FOUNDATION_V2 中的 1.3.0 coordinates
  继续保留为当时 exact-incorporation evidence；
- 不静默改写 V2 历史证据；
- accepted bounded Child 允许后续 Contract Bundle 1.4.0；
- V2 refresh 如有需要，属于另一独立任务。
```
