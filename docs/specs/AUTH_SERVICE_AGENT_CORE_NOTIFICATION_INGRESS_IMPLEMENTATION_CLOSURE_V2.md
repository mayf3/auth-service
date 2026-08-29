---
spec_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
status: accepted
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
supersedes:
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2

## 1. Purpose and authority boundary

This whole-Spec successor is the sole proposed authority for the **exact
implementation file closure** of the already accepted parent authority
`AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1` (accepted,
`implementation_authority: contracts`). The parent froze the Audience/Scope
semantics (`CTR-NI-001`–`CTR-NI-006`) but did not freeze the implementation file
closure. Accepted V1 froze that closure at 15 files. This V2 independently
restates the complete effective V1 authority and changes only the bounded
closure correction proven in §4: 15 -> 16 files, with `validate.mjs` changing
classification from `NOT_NECESSARY` to `PROVEN_NECESSARY`.

```text
PARENT_SPEC_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
SUCCESSOR_AUTHORITY_KIND = WHOLE_SPEC_SUCCESSOR
SUPERSEDES = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
PARALLEL_PRODUCT_AUTHORITY_CREATED = NO
SUPERSEDES_PARENT = NO
PARENT_SEMANTICS_CHANGED = NO
REGISTRATION_SEMANTICS = PARENT-OWNED (CTR-NI-001..CTR-NI-006 unchanged)
SUCCESSOR_OWNS = exact implementation file closure + version/linkage delta boundary only
CONTRACT_TS_CHANGE_CLASS = LIMITED_RUNTIME_COMPATIBILITY_CHANGE (per DEC-VL-002 class)
CONTRACT_TS_CHANGE_BOUNDARY = ONLY_ADD_1_4_0_TO_SUPPORTED_VERSION_ALLOWLIST
IMPLEMENTATION_CLOSURE_COUNT = 16
VALIDATE_MJS_INCLUDED = YES
EXTRA_FILE_COUNT = 0
OTHER_SEMANTIC_DRIFT = NONE
```

Because this Spec is `proposed` and `implementation_authority: none`, it grants no
implementation or merge authority. V1 remains the accepted authority, with
unchanged lifecycle metadata, until a future independent semantic review passes
and an owner performs the atomic whole-Spec acceptance transaction. Only that
future transaction may set V2 to `accepted` / `contracts` and V1 to `superseded`
with its backlink to V2.

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

SUCCESSOR AUTHORING COORDINATES:
  SUCCESSOR_PARENT = 833f17abf29f64539d40387d2af448bbacc106d5
    (= OLD_PR35_HEAD = dispatch CURRENT_HEAD, exact match; this successor
    commit is authored directly on top of it on the same PR #35 branch)
  OLD_PR35_HEAD = 833f17abf29f64539d40387d2af448bbacc106d5
  PR35_MERGE_BASE_WITH_MAIN = 51a11af57ce39eafac5883e0c32474ea06906b8e
    (merge-base of the PR #35 branch with github/main at authoring)
  MAIN_AT_AUTHORING = 325e781982c01a09d438e9d65df8079396e1520e
  ACCEPTED_V1_BLOB = e80fcd018b7f2b8a75792a3c3e45dfa121e4458a
    (byte-identical at OLD_PR35_HEAD, at the PR merge-base, and on
    github/main; the accepted V1 file is untouched by this round — §14)
  WITHDRAWN_PROPOSAL = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_CLOSURE_ELABORATION_V1
    (proposed at OLD_PR35_HEAD, the previous PR #35 head; never accepted;
    deleted from this same PR #35 branch by this successor commit — §14.3)
  IMPLEMENTATION_PR = mayf3/auth-service#29 (OPEN, DRAFT, NOT FOR MERGE;
    evidence only, never an authority pin)
  IMPLEMENTATION_HEAD = 3c5b293a79a96a652f30add9017e4210c488e251
  IMPLEMENTATION_MERGE_BASE = d529bd3c28ece3967149ad793794f8dac2020276
    (= merge-base of 3c5b293 with github/main; the accepted main on which
    the closure Spec V1 was already merged)
  SUCCESSOR_AUTHORED_AT = 2026-08-29
  SUCCESSOR_MODE = docs-only whole-Spec successor amendment
```

The original coordinates above remain authoritative provenance for V1's
derivation. The successor coordinates bind only the newly added omission /
inclusion evidence and this V2 authoring round. PR #29 is not modified, rebased,
merged, or re-executed by this Spec round.

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
closure Spec frozen before implementation could fit closure. The parent NI CCR froze
no file closure and names no `src/` or `tests/` file; therefore this successor is
required before any implementation PR may proceed.

## 4. Mechanical closure derivation

Every candidate below was classified against the repo's omission standard
(`PROVEN_NECESSARY` = omission causes a deterministic failure in an executed,
explicitly frozen gate because the `1.4.0` registration/linkage is missing;
`NOT_NECESSARY` = comment-only, no enforcing reader, no formal acceptance entry,
or all applicable gates still pass after omission).

### 4.1 Original V1 linkage evidence at `AUTHORING_BASE`

In a scratch state (fully reset afterward; worktree restored byte-clean and
re-verified `MINIMAL_AUTH_V1_BUNDLE_VALID=true` at `1.3.0`), the bundle version
pins alone were bumped consistently `1.3.0` -> `1.4.0` across the ten version-pinned
bundle files, with **no** `src/`/`tests/` change:

| GATE | COMMAND | RESULT |
|---|---|---|
| Bundle validator | `npm run contract:v1:validate` | exit 0, `MINIMAL_AUTH_V1_BUNDLE_VALID=true` (bundle-consistent bump is internally valid) |
| Runtime contract test | `JWT_SECRET=test-jwt-secret npm run contract:v1:prepare && JWT_SECRET=test-jwt-secret ./node_modules/.bin/tsx --test tests/oauth/contract-runtime-v1.test.ts` | exit 1, `pass 3 / fail 1`; failing test `v1 mode loads the frozen implementation-authorized snapshot`; load-bearing error `Minimal Auth V1 runtime snapshot version is unsupported.` |
| Candidate gate | `npm run contract:v1:candidate && ./node_modules/.bin/tsx --test tests/oauth/candidate-contract.test.ts` | exit 1, `pass 0 / fail 1`; load-bearing error `Candidate runtime snapshot version is unsupported.` |

This proves: the `1.4.0` version/linkage delta cannot pass its own frozen runtime
and candidate validation suite without the four linkage files below. This V1
experiment changed version pins only; it did **not** add the new Audience entry,
so it could not test the validator's exact first-wave Audience-set gate.

### 4.1A Exact real-delta omission and inclusion evidence

At implementation candidate `3c5b293a79a96a652f30add9017e4210c488e251`,
the real parent-authorized delta adds the sixth Audience
`agent-core-notification-ingress-v1`. The validator compares the complete
registry Audience set against a hard-coded first-wave set.

| CASE | VALIDATE.MJS STATE | EXECUTED RESULT |
|---|---|---|
| Omission | accepted-main bytes; no new Audience in the literal | sole validator failure: `registry: first-wave Audience set changed` |
| Inclusion | exactly one changed line, 1 insertion / 1 deletion; literal gains only `agent-core-notification-ingress-v1`; total file line count unchanged | `MINIMAL_AUTH_V1_BUNDLE_VALID=true`; `FREEZE_BLOCKERS=0`; `PRODUCTION_BLOCKERS=1`; `CONSUMER_BLOCKERS=2` |

The inclusion head's recorded full results are preserved as evidence coordinates:

```text
contract tests = 45/45
candidate tests = 22/22
OAuth tests = 104/104
typecheck = PASS
git diff --check = PASS
```

File-level coordinates, byte-verified against `git rev-parse` / `git diff` in
this successor round:

```text
validate.mjs BLOB @IMPLEMENTATION_MERGE_BASE (accepted-main bytes)
  = cc9780a20e841ef9ca77192bf344b7affa98d92c
validate.mjs BLOB @IMPLEMENTATION_HEAD
  = 18019bc22f66a5b9b2b8fa6b8b190fec6a333454
  (numstat = exactly 1 insertion / 1 deletion; 500 -> 500 total lines)
first-wave Audience set check = validate.mjs:394-395 on accepted main
  (literal BEFORE = ['adc-v2', 'svc-auth', 'svc-forum', 'svc-okr',
   'svc-workflow']
   literal AFTER  = ['adc-v2', 'agent-core-notification-ingress-v1',
   'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow'];
   the enforcing identity is the `check` whose failure message is exactly
   `registry: first-wave Audience set changed`; the comparison stays
   `.sort(asciiCompare)`-decided)
audience-registry.json @main = registry_version 1.3.0, 5 Audiences
audience-registry.json @3c5b293 = registry_version 1.4.0, 6 Audiences
  (+ agent-core-notification-ingress-v1)
```

This evidence corrects exactly one V1 classification. It does not authorize or
imply any other Audience, blocker, profile, Scope, digest/version, error, product,
or file-closure semantic change.

### OBS-NIC2-001 — Omission fails at the exact Audience-set gate

- Subject: real NI `1.4.0` bundle delta without the `validate.mjs` line.
- Repository / revision: `mayf3/auth-service@3c5b293a79a96a652f30add9017e4210c488e251`
  with only that validator line omitted.
- Observed at / environment: recorded 2026-08-24 in the PR #29 implementation
  evidence (PR body); file-level coordinates independently re-verified read-only
  in this successor round (§4.1A).
- Method: execute `npm run contract:v1:validate` against the omission candidate.
- Result: the sole validator failure is
  `registry: first-wave Audience set changed`.
- Provenance: PR #29 recorded verification; the withdrawn elaboration proposal
  (§14.3) preserved the same record before its deletion; cited here without
  re-executing product implementation.

### OBS-NIC2-002 — Exact inclusion passes with blocker parity

- Subject: real NI `1.4.0` bundle delta with exactly the one allowed validator line.
- Repository / revision: `mayf3/auth-service@3c5b293a79a96a652f30add9017e4210c488e251`.
- Observed at / environment: recorded 2026-08-24 in the implementation evidence.
- Method: execute validator, contract, candidate, OAuth, typecheck, and diff gates.
- Result: `MINIMAL_AUTH_V1_BUNDLE_VALID=true`; blocker counts `0 / 1 / 2`;
  contract `45/45`; candidate `22/22`; OAuth `104/104`; typecheck and
  `git diff --check` PASS. `validate.mjs` is one changed line, 1 insertion /
  1 deletion, with total line count unchanged.
- Provenance: PR #29 recorded verification at the exact implementation head.

### CLM-NIC2-001 — Closure 16 is necessary and sufficient

- Support state: SUPPORTED.
- Basis: `OBS-NIC2-001` proves omission failure; `OBS-NIC2-002` proves the
  exact inclusion clears the entire frozen validation surface without a 17th file.

### EVD-NIC2-001 — Two-sided validator evidence supports the closure projection

- Source observations: `OBS-NIC2-001`, `OBS-NIC2-002`.
- Target: `CLM-NIC2-001`, `STATE-NIC2-001`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/auth-service@3c5b293a79a96a652f30add9017e4210c488e251`.
- Strength/sufficiency: exact two-sided mechanical evidence for the one-file
  classification; it does not prove production state or authorize implementation.
- Limitations: evidence is preserved from prior executed records, not re-executed
  in this docs-only successor round.

### STATE-NIC2-001 — Proposed successor closure projection

At the successor authoring coordinates (§2: parent `833f17a…` = previous PR #35
head, and github/main `325e781…`), V1 remains accepted at 15 files and PR #29
remains a frozen draft. If and only if
V2 is later accepted atomically, the governing closure becomes exactly 16 files
under §4.3. Basis: `CLM-NIC2-001`, `EVD-NIC2-001`, and §14.

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
| `contract-bundles/minimal-auth-v1/validate.mjs` | first-wave Audience exact-set literal gains only `agent-core-notification-ingress-v1` | §4.1A omission fails solely with `registry: first-wave Audience set changed`; inclusion passes with blocker parity; all existing service-profile, blocker, Scope, digest/version, and error logic remains byte-identical | `PROVEN_NECESSARY` |
| `contract-bundles/minimal-auth-v1/schemas/audience-registry.schema.json` | none | no version const (`registry_version` is a free string); `service` already an allowed principal enum; §4.1 validator passed without it | `NOT_NECESSARY` |
| `contract-bundles/minimal-auth-v1/README.md` | none | no version pin; no enforcing reader | `NOT_NECESSARY` |
| `contract-bundles/minimal-auth-v1/fixtures/jwks.json` / `fixtures/verify-compact-jwt.mjs` | none | fixture signing/verification infra reused as-is (tracked fixture keys) | `NOT_NECESSARY` |
| `docs/contracts/minimal-auth-v1/grants-and-audiences.md` | §2 closed Bundle Audience list | no executable gate reads it; post-V2 the module bytes are CTR-MAFV2-001-frozen (`2f05c06a…`); see DEC-NIC2-004 and closed OQ-NIC2-001 | `NOT_NECESSARY` |
| `docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` | none | zero mentions of any notification resource; never a Legacy consumer; nothing to remove (unlike svc-forum §6) | `NOT_NECESSARY` |
| `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md` | none | accepted architecture authority; parent NI CCR §3 explicitly does not amend V2; child cannot amend it; stale `CURRENT_MINIMAL_AUTH_CONTRACT_VERSION = 1.3.0` recorded at OQ-NIC2-002 | `NOT_NECESSARY / OUT_OF_CHILD_AUTHORITY` |
| `scripts/bootstrap-obo-conformance-fixture.ts` | none | VL matrix row 2: no enforcing reader | `NOT_NECESSARY` (VL exclusion) |
| `tests/frozen-svc-okr-route-conformance.test.ts` | none | VL matrix row 4: comment-only | `NOT_NECESSARY` (VL exclusion) |
| `docs/specs/README.md` | none | not a per-Spec index; PR #12 precedent added exactly one file | `NOT_NECESSARY` |
| other `tests/` referencing specific audiences (`v1-scope`, `migration-v1-static`, `oauth-schemas`, grant-supply tests, …) | none | do not iterate the registry audience set; only version-expectation files above are affected | `NOT_NECESSARY` |

### 4.3 Frozen closure

```text
FINAL_IMPLEMENTATION_SCOPE_FILES = 16
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
contract-bundles/minimal-auth-v1/validate.mjs
src/lib/oauth/v1/contract.ts
tests/helpers/load-candidate-snapshot.ts
tests/oauth/candidate-contract.test.ts
tests/oauth/contract-runtime-v1.test.ts
```

No wildcard, directory, generated output, or "related file" is authorized. The
first file outside this set is rejected, and every outside-file need is
`OWNER_DECISION_REQUIRED`. `EXTRA_FILE_COUNT = 0`: `validate.mjs` is the sole
addition to V1's 15-file closure, not permission for a 17th file.

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

### DEC-NIC2-001 — Whole-Spec successor required before implementation

- Decision owner: mayf3 (task-dispatch ruling; successor authored under it)
- Decision: STOP direct implementation; replace accepted V1 authority only through
  this complete whole-Spec successor and a later atomic acceptance transaction.
- Rejected alternatives: implement now and let the implementation self-authorize
  its file set; or use a child elaboration to make accepted `DEC-NIC-003` /
  `CTR-NIC-008` inoperative only through prose.
- Reason: accepted precedent `DEC-VL-003` — "Already-written implementation cannot
  grant itself authority" — plus `PARTIAL_SUPERSESSION_V0 = FORBIDDEN`.

### DEC-NIC2-002 — Honest classification of the runtime allowlist delta

- Decision owner: mayf3
- Decision: adding `1.4.0` to `src/lib/oauth/v1/contract.ts` and the candidate
  loader allowlists is `LIMITED_RUNTIME_COMPATIBILITY_CHANGE` requiring this
  child's explicit authority.
- Rejected alternative: classify it as mechanical bundle bookkeeping.
- Reason: `DEC-VL-002` settled this exact class for `1.3.0`; §4.1 shows the gates
  fail closed without it.

### DEC-NIC2-003 — 16-file closure, validate.mjs single-line delta, nothing more

- Decision owner: mayf3
- Decision: the closure is exactly §4.3. `validate.mjs` is
  `PROVEN_NECESSARY` and may change only by adding
  `agent-core-notification-ingress-v1` to the first-wave Audience set literal as
  exactly one changed line (1 insertion / 1 deletion, total line count
  unchanged). Registry schema, bundle README, fixture JWKS infra, and all other
  candidates stay byte-identical.
- Rejected alternative: port the full 18-file svc-forum closure wholesale.
- Reason: closure must be re-derived per delta (task rule: "不得直接照抄 1.3.0
  文件集合"); §4.1A proves the validator file necessary, while
  `grants-and-audiences.md` §2 and `v0-to-v1-migration.md` §6 remain provably
  unnecessary here.

### DEC-NIC2-004 — Historical V1 module list remains unchanged

- Decision owner: mayf3 (closed by the accepted V1 注册 审计 ruling preserved in §14)
- Decision: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2 Bundle
  Audience 清单 is NOT amended in this closure. Post-V2, that module is
  CTR-MAFV2-001-frozen exact-incorporated provenance; the governing registration
  authority for this Audience is the accepted parent NI CCR itself, and the
  change-log entry records the registration provenance.
- Rejected alternative: amend §2 to add `agent-core-notification-ingress-v1`
  (the pre-V2 svc-forum pattern).
- Reason: PR #11's amendment predates V2 acceptance and was grandfathered by it;
  this successor may not modify a CTR-MAFV2-001 immutable object. If a future
  authority rules the historical list must track the registry, that is a V2-level owner
  decision under a separate authority. The accepted V1 audit chose this
  alternative; V2 preserves that ruling without reopening it.

### DEC-NIC2-005 — First service-principal positive fixture

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

### CTR-NIC2-001 — Exact 16-file closure

After acceptance and merge only, an implementation PR under the parent NI CCR MAY
modify exactly the 16 files in §4.3 and no others. The first file outside the set
is `OWNER_DECISION_REQUIRED`; `EXTRA_FILE_COUNT = 0`.

### CTR-NIC2-002 — Exact registry entry

The implementation MUST produce exactly the parent `CTR-NI-001` entry in
`audience-registry.json` (machine-comparable, parent ACC-NI-001), with
bundle-lifecycle metadata (`freeze_ready: true`, `notes`) permitted only as the
accepted schema requires, without changing any frozen field.

### CTR-NIC2-003 — Exact runtime compatibility boundary

`src/lib/oauth/v1/contract.ts` MAY change only by adding string literal `1.4.0`
to the supported Contract-version allowlist. `tests/helpers/load-candidate-snapshot.ts`
MAY change only by adding the same literal (plus its matching comment).
`tests/oauth/candidate-contract.test.ts` and `tests/oauth/contract-runtime-v1.test.ts`
MAY change only their `1.3.0` version expectations to `1.4.0`. No format-version,
digest, lifecycle, Audience, Scope, signer, verifier, claim, algorithm,
introspection, fallback, or error behavior may change under this Contract.

### CTR-NIC2-004 — Positive conformance

The implementation MUST add positive fixture `direct-service-notification-ingress`:
Direct Machine profile, RS256 + tracked fixture `kid`, `iss = auth-service`,
`aud = agent-core-notification-ingress-v1`, `principal_type = service`, no
`agent_id` claim, `token_use = access`, `scope = "notification.deliver"` with
`requested_scope` exactly equal, and `machine_access_grants` containing
`agent-core-notification-ingress-v1 -> ["notification.deliver"]`. It MUST pass the
existing bundle validation path (`validate.mjs`); no second fixture semantics may
be introduced.

### CTR-NIC2-005 — Negative conformance (fail-closed, no downscope)

The implementation MUST add negative cases at least covering: agent principal on
this Audience; human principal; delegated/OBO attempt; wrong audience (including
`svc-auth` with `notification.deliver`); `auth.identity.provision` against this
Audience; unregistered `notification.*` scopes; wildcard (`*`, `notification.*`);
extra scope beyond the Grant (whole-request rejection); requested-vs-issued scope
mismatch (silent downscope); cross-Audience Grant reuse. Every case MUST be
rejected whole without partial issuance.

### CTR-NIC2-006 — No Grant, credential, client, or production effect

The implementation MUST NOT create or enlarge any Principal, Client, secret,
MachineAccessGrant, or credential handoff, and MUST NOT perform any production
apply, deploy, database migration, or Grant write. Audience registration MUST NOT
auto-create a Grant (parent CTR-NI-004/CTR-NI-006 inherited).

### CTR-NIC2-007 — Version pins and change record

All ten version-pinned bundle files MUST move to `1.4.0` together (validator
`validate.mjs:274-281` enforces consistency), and `metadata/change-log.md` MUST
record the `1.4.0` entry naming the parent CCR, the exact frozen entry fields, the
new fixtures, the version/linkage promotion, and `NO GRANT CREATED`.

### CTR-NIC2-008 — Parent, V2 architecture, and non-target validator semantics remain unchanged

This successor and its implementation MUST NOT modify
`docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1.md`,
`docs/contracts/minimal-auth-v2/**`, or any `NOT_NECESSARY` file in §4.2.
Within `contract-bundles/minimal-auth-v1/validate.mjs`, the only allowed delta is
the §4.1A / DEC-NIC2-003 single-line first-wave Audience literal addition. No
other Audience change, validator blocker logic, principal profile, Scope rule,
digest/version validation, or error semantic may change; every other byte in
that file remains identical.

## 8. Acceptance mapping

### ACC-NIC2-001 — Exact entry comparison

- Contracts: `CTR-NIC2-002`. Command: machine-compare the registry entry against
  parent `CTR-NI-001` JSON. Expected: exact equality of every frozen field.

### ACC-NIC2-002 — Validator

- Contracts: `CTR-NIC2-007`, `CTR-NIC2-008`. Command:
  `npm run contract:v1:validate`. Expected: exit 0,
  `MINIMAL_AUTH_V1_BUNDLE_VALID=true`, `FREEZE_BLOCKERS=0`,
  `PRODUCTION_BLOCKERS=1`, `CONSUMER_BLOCKERS=2`. Omission proof: reverting only
  the allowed `validate.mjs` line yields the sole failure
  `registry: first-wave Audience set changed`.

### ACC-NIC2-003 — Runtime and full contract tests

- Contracts: `CTR-NIC2-003`. Commands:
  `JWT_SECRET=test-jwt-secret npm run contract:v1:prepare`,
  `JWT_SECRET=test-jwt-secret ./node_modules/.bin/tsx --test tests/oauth/contract-runtime-v1.test.ts`,
  `npm run test:contract-v1`. Expected: runtime identity reports exactly `1.4.0`;
  all contract tests pass. Negative evidence: §4.1 fail-closed rows.

### ACC-NIC2-004 — Candidate gate

- Contracts: `CTR-NIC2-003`. Command:
  `npm run contract:v1:candidate && ./node_modules/.bin/tsx --test tests/oauth/candidate-contract.test.ts`.
  Expected: exit 0 at `1.4.0`. Negative evidence: §4.1 fail-closed row.

### ACC-NIC2-005 — OAuth suite and typecheck

- Contracts: `CTR-NIC2-003`. Commands: `npm run test:oauth`; `npx tsc -p tsconfig.json --noEmit`.
  Expected: both pass with no closure-external file changed.

### ACC-NIC2-006 — Hygiene

- Commands: `git diff --check`; PR file list equals exactly §4.3; inspect
  `git diff --numstat` and total line count for `validate.mjs`.
  Expected: clean; exactly 16 files; no extra files; `validate.mjs` is exactly
  1 insertion / 1 deletion on one changed line, with total line count unchanged.

### ACC-NIC2-007 — Conformance and no-production boundary

- Contracts: `CTR-NIC2-004`, `CTR-NIC2-005`, `CTR-NIC2-006`, `CTR-NIC2-008`.
  Method: fixture validation through `validate.mjs` plus PR diff audit.
  Expected: all positive/negative parent ACC-NI cases executed and passing; no
  Principal/Client/secret/Grant created; no production change.

### ACC-NIC2-008 — Whole-Spec successor and entity coverage

- Contracts: `CTR-NIC2-001` through `CTR-NIC2-008`.
- Method: compare this V2 against accepted V1 blob
  `e80fcd018b7f2b8a75792a3c3e45dfa121e4458a`; verify the §15 entity ledger,
  frontmatter lifecycle, supersedes/backlink consistency, dangling references,
  and the exact accepted-V1 blob in the proposed PR diff.
- Expected: every V1 Decision, Contract, and Acceptance maps one-to-one to the
  corresponding `NIC2` entity; only lifecycle/ID metadata, closure 15 -> 16,
  `validate.mjs` classification/single-line boundary, and directly corresponding
  evidence/Decision/Contract/Acceptance text differ; V1 is byte-identical and
  remains `accepted` / `superseded_by: null`; `OTHER_SEMANTIC_DRIFT = NONE`.
- Failure: any missing V1 entity; any 17th file; any other product, permission,
  failure, Scope, principal, validator, version/digest, runtime, production,
  rollback, or security semantic change; any premature V1 lifecycle edit.

## 9. Alternatives and disposition

### ALT-NIC2-001 — Implement directly under the parent CCR now

- Disposition: rejected
- Reason: parent froze semantics, not closure; runtime linkage delta exceeds the
  settled audience-CCR authority class (DEC-VL-002/003); implementation cannot
  self-authorize its file set.

### ALT-NIC2-002 — Port the svc-forum 18-file closure wholesale

- Disposition: rejected
- Reason: two files remain provably unnecessary for this delta (§4.2); closure must
  be mechanically re-derived per version.

### ALT-NIC2-003 — Bundle-only delta, defer runtime linkage

- Disposition: rejected
- Reason: §4.1 proves the frozen runtime/candidate gates fail closed; the task's
  own validation suite could not pass; a merged bundle the runtime rejects would
  break `initializeAuthContract` consumers.

### ALT-NIC2-004 — Amend `grants-and-audiences.md` §2 as PR #11 did

- Disposition: rejected (DEC-NIC2-004; accepted V1 audit ruling preserved)
- Reason: post-V2 the module bytes are CTR-MAFV2-001-frozen; only a V2-level
  owner decision may change them.

### ALT-NIC2-005 — Keep the proposed child elaboration as a partial override

- Disposition: rejected and withdrawn before acceptance.
- Reason: making accepted `DEC-NIC-003` / `CTR-NIC-008` inoperative only for
  `validate.mjs` would be prose-only partial supersession. V0 permits only a
  complete successor that independently states the entire effective authority.

## 10. Migration, compatibility, and rollback

```text
MIGRATION_THIS_ROUND = NONE (docs-only whole-Spec successor)
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
PRODUCT_CODE_CHANGE = NONE
FUTURE_IMPLEMENTATION = versioned bundle delta 1.3.0 -> 1.4.0 under exact 16-file §4.3 closure, only after V2 acceptance
ROLLBACK = delete/revise this proposed branch before acceptance; no runtime state
```

Runtime compatibility is additive (`1.0.0`–`1.3.0` remain supported); no existing
token, Grant, audience, or consumer behavior changes.

## 11. Closed owner rulings and open questions

```text
OQ-NIC2-001 (CLOSED by accepted V1 注册 审计):
  Whether the CTR-MAFV2-001-frozen historical V1 module list
  (grants-and-audiences.md §2) must track the executable registry post-V2.
  RULING = KEEP_HISTORICAL_GRANTS_AND_AUDIENCES_LIST_UNCHANGED.
  Future overriding still requires a separate V2-level authority.
OQ-NIC2-002 (CLOSED by accepted V1 注册 审计):
  After a future 1.4.0 merge, V2's recorded CURRENT_MINIMAL_AUTH_CONTRACT_VERSION
  = 1.3.0 and CTR-MAFV2-001 identities remain historical provenance snapshots and
  are not silently rewritten; any V2 refresh is a separate owner decision.
  RULING = V2_1_3_0_COORDINATES_ARE_HISTORICAL_PROVENANCE.
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 12. Frozen summary

```text
AUTHORITY_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
STATUS = proposed
PARENT_AUTHORITY = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
BUNDLE_VERSION_BEFORE = 1.3.0
BUNDLE_VERSION_AFTER (authorized target) = 1.4.0
SUPERSEDES = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
FINAL_IMPLEMENTATION_SCOPE_FILES = 16
IMPLEMENTATION_CLOSURE_COUNT = 16
VALIDATE_MJS_INCLUDED = YES
EXTRA_FILE_COUNT = 0
RUNTIME_SEMANTIC_DELTA = LIMITED_RUNTIME_COMPATIBILITY_CHANGE (add 1.4.0 allowlist)
PROVEN_NECESSARY = 16 files (§4.3)
VALIDATE_MJS_DELTA = exactly one changed line; 1 insertion / 1 deletion;
  first-wave Audience set adds only agent-core-notification-ingress-v1;
  total file line count unchanged
NOT_NECESSARY = audience-registry.schema.json, bundle README,
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
OLD_ACCEPTED_V1_CHANGED = NO
PR_29_CHANGED = NO
OTHER_SEMANTIC_DRIFT = NONE
```

## 13. Authoring provenance

```text
AUTHORED_BY = 注册 修订 round (whole-Spec successor author)
AUTHORING_PARENT = 833f17abf29f64539d40387d2af448bbacc106d5 (= OLD_PR35_HEAD =
  dispatch CURRENT_HEAD, exact match)
PR_MERGE_BASE_WITH_MAIN = 51a11af57ce39eafac5883e0c32474ea06906b8e
AUTHORING_MODE = spec-governance AUTHOR (docs-only whole-Spec successor;
  withdraws the unaccepted elaboration proposal on the same PR #35 branch)
EVIDENCE = V1 §4.1 original linkage evidence + §4.1A exact PR #29 omission /
  inclusion records; no implementation re-test or product-file change this
  round; file-level blob/line coordinates in §4.1A byte-verified vs
  git rev-parse / git diff this round
NEXT_TASK = 注册 审计
```

## 14. Lifecycle and review state

The accepted V1 lifecycle and backlink remain unchanged in this authoring round.
This proposed V2 grants no implementation, merge, acceptance, or production
authority. A later independent exact-head review must PASS before an authorized
acceptance transaction may atomically accept V2 and update V1's lifecycle
metadata.

```text
V1_STATUS_THIS_ROUND = accepted
V1_SUPERSEDED_BY_THIS_ROUND = null
V2_STATUS_THIS_ROUND = proposed
V2_IMPLEMENTATION_AUTHORITY_THIS_ROUND = none
INDEPENDENT_REVIEW = PENDING
ACCEPTED_BY = NONE
ACCEPTANCE_TRANSACTION_PERFORMED = NO
```

### 14.1 Accepted V1 provenance preserved

The following coordinates and owner rulings are the accepted V1 historical
record. They are reproduced here as provenance, not claimed as V2 acceptance:

```text
V1_ACCEPTED_BY = mayf3
V1_INDEPENDENT_REVIEW = 注册 审计 = PASS
V1_REVIEWED_BASE = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689
V1_REVIEWED_SPEC_HEAD = 8ba603f8d4397898c09c5bcd17bac67f0022cbc8
V1_BLOCKERS = NONE
V1_REQUIRED_FIXES = NONE
V1_SPEC_PR = mayf3/auth-service#27
V1_LIFECYCLE_DELTA = status: proposed -> accepted;
  implementation_authority: none -> contracts
V1_SEMANTIC_DELTA_AFTER_REVIEW = NONE
V1_MAIN_AT_REVIEW = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689
V1_PR_DIFF_AT_REVIEW = exactly one Child Spec file

OQ_NIC_001 = CLOSED_KEEP_HISTORICAL_GRANTS_AND_AUDIENCES_LIST_UNCHANGED
OQ_NIC_002 = CLOSED_V2_1_3_0_COORDINATES_ARE_HISTORICAL_PROVENANCE
```

### 14.2 Future atomic acceptance transaction

Only after independent review of the exact V2 head returns PASS may an
authorized owner perform one docs-only acceptance transaction containing all of:

```text
V2.status = accepted
V2.implementation_authority = contracts
V2.supersedes = [AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1]
  (declared in this proposal's frontmatter; verified unchanged at acceptance)
V1.status = superseded
V1.superseded_by = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
README index = lifecycle states updated consistently
```

No subset is valid. This authoring PR intentionally performs none of those
acceptance-only edits.

### 14.3 Withdrawn proposal on this same PR branch

`AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_CLOSURE_ELABORATION_V1`
(authoring commit = `OLD_PR35_HEAD`, the previous PR #35 head) is withdrawn by
this successor commit before any acceptance: its file is deleted from this same
PR #35 branch. Per `SPEC_GOVERNANCE_V0` §8, a proposal that never became
authority is not `superseded` and does not become a governing `rejected` Spec;
withdrawal by deletion on the same PR is its complete disposition. Its sole
normative intent — the 16th file, `PROVEN_NECESSARY`, the single-line
first-wave literal delta, `EXTRA_FILE_COUNT = 0` — is carried forward only
through this V2 whole-Spec successor. The withdrawn proposal's `CTR-NIE-003`
bounded-precedence mechanism (declaring accepted `CTR-NIC-008` / `DEC-NIC-003`
partially inoperative over `validate.mjs`) is rejected as a forbidden
prose-only partial supersession and is replaced by this whole-Spec successor
vehicle.

## 15. V1 -> V2 whole-Spec semantic proof

V2 uses the fresh `NIC2` stable-ID namespace so no accepted V1 ID is reused with
changed meaning. The ledger below covers every V1 normative entity.

| V1 ENTITY | V2 ENTITY | SEMANTIC RESULT |
|---|---|---|
| Goal / authority boundary | §1 | preserved; whole-successor lifecycle metadata added |
| Scope / non-goals implicit in §§1, 3, 7, 10 | same sections | preserved |
| DEC-NIC-001 | DEC-NIC2-001 | directly updated only to require the legally necessary whole-Spec vehicle |
| DEC-NIC-002 | DEC-NIC2-002 | unchanged runtime allowlist classification |
| DEC-NIC-003 | DEC-NIC2-003 | closure 15 -> 16; `validate.mjs` exact single-line boundary added |
| DEC-NIC-004 | DEC-NIC2-004 | unchanged; accepted V1 audit closure made explicit |
| DEC-NIC-005 | DEC-NIC2-005 | unchanged positive-fixture decision |
| CTR-NIC-001 | CTR-NIC2-001 | closure 15 -> 16; no 17th file |
| CTR-NIC-002 | CTR-NIC2-002 | unchanged exact registry entry |
| CTR-NIC-003 | CTR-NIC2-003 | unchanged runtime/candidate compatibility boundary |
| CTR-NIC-004 | CTR-NIC2-004 | unchanged positive conformance |
| CTR-NIC-005 | CTR-NIC2-005 | unchanged negative fail-closed conformance |
| CTR-NIC-006 | CTR-NIC2-006 | unchanged no-Grant/no-credential/no-production boundary |
| CTR-NIC-007 | CTR-NIC2-007 | unchanged version pins and change record |
| CTR-NIC-008 | CTR-NIC2-008 | directly corrected only for the exact `validate.mjs` delta; every other byte/semantic remains frozen |
| ACC-NIC-001 | ACC-NIC2-001 | unchanged exact entry comparison |
| ACC-NIC-002 | ACC-NIC2-002 | directly updated with omission/inclusion validator evidence and blocker parity |
| ACC-NIC-003 | ACC-NIC2-003 | unchanged runtime/full-contract gate |
| ACC-NIC-004 | ACC-NIC2-004 | unchanged candidate gate |
| ACC-NIC-005 | ACC-NIC2-005 | unchanged OAuth/typecheck gate |
| ACC-NIC-006 | ACC-NIC2-006 | directly updated for 16-file count and exact one-line validator diff |
| ACC-NIC-007 | ACC-NIC2-007 | unchanged conformance/no-production boundary plus non-target validator freeze |
| V1 Acceptance Record | §14.1 | preserved as historical provenance; not reused as V2 acceptance |
| Whole-successor validity | ACC-NIC2-008 / §14.2 | lifecycle/entity proof added as necessary successor governance |

The non-normative coverage is also complete: §§2–5 preserve coordinates,
derivation, runtime/version linkage, candidate loader, and the original
fail-closed evidence; §§9–13 preserve alternatives, production separation,
rollback, secret/credential boundary, and authoring provenance, with only the
directly corresponding successor corrections stated above.

```text
ALLOWED_SEMANTIC_DELTA_A = lifecycle / successor metadata
ALLOWED_SEMANTIC_DELTA_B = Spec ID / revision / NIC -> NIC2 stable-ID renaming
ALLOWED_SEMANTIC_DELTA_C = closure 15 -> 16
ALLOWED_SEMANTIC_DELTA_D = validate.mjs NOT_NECESSARY -> PROVEN_NECESSARY
ALLOWED_SEMANTIC_DELTA_E = directly corresponding Observation/Evidence/Decision/Contract/Acceptance updates
IMPLEMENTATION_CLOSURE_COUNT = 16
VALIDATE_MJS_INCLUDED = YES
EXTRA_FILE_COUNT = 0
OTHER_SEMANTIC_DRIFT = NONE
```

## 16. Acceptance Record

```text
ACCEPTED_BY = mayf3
INDEPENDENT_REVIEW = 注册 审计 = PASS
  WHOLE_SPEC_SUCCESSOR = YES
  OLD_ELABORATION_WITHDRAWN = YES
  V1_BYTE_PRESERVED = YES
  IMPLEMENTATION_CLOSURE = PASS
  VALIDATE_MJS_DELTA = PASS
  MECHANICAL_EVIDENCE = PASS
  BLOCKERS = NONE
  READY_FOR_ACCEPTANCE_FINALIZE = YES
REVIEWED_BASE = 325e781982c01a09d438e9d65df8079396e1520e
REVIEWED_SPEC_HEAD = 69e4f8fb5e22aa6d50346ddbca4e195e16263b59
SPEC_PR = mayf3/auth-service#35
SEMANTIC_DELTA_AFTER_REVIEW = NONE
  (reviewed head 69e4f8f has no new commits after review; the acceptance
  transaction below is this docs-only lifecycle commit itself)
PR_DIFF_AT_REVIEW = exactly one new successor Spec + docs/specs/README.md
  index row swap (elaboration row deleted in-branch; nets to nothing vs main)
```

This acceptance transaction atomically performs exactly §14.2 and nothing else:

```text
V2.status: proposed -> accepted
V2.implementation_authority: none -> contracts
V1.status: accepted -> superseded
V1.superseded_by: null -> AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
docs/specs/README.md = lifecycle states updated consistently
```

V1's normative body outside frontmatter is byte-preserved (historical accepted
authority). The authoring-time frozen blocks (header, §12, §14) remain
historical records; this §16 Record plus frontmatter are the only lifecycle
authority. `implementation_authority: contracts` grants only the exact 16-file
closure of §4.3 / CTR-NIC2-001; it creates no Principal, Client, Credential, or
Grant, and authorizes no production apply. Implementation PR #29 remains
DRAFT / NOT FOR MERGE pending the independent implementation audit.
