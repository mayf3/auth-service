---
spec_id: AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/auth-service
governed_by:
  - AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1

## 1. Purpose and authority boundary

This child Spec is the sole proposed authority for the Minimal Auth Contract `1.3.0`
runtime/version linkage needed by the already accepted parent authority
`AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`. It is not a parallel product direction,
does not supersede the parent, and does not amend the accepted parent in place.

```text
PARENT_SPEC_ID = AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1
CHILD_AUTHORITY_KIND = NEW_CHILD_SPEC_AUTHORITY
PARALLEL_PRODUCT_AUTHORITY_CREATED = NO
SUPERSEDES_PARENT = NO
ROOT_AUDIENCE_PRODUCT_SEMANTICS_CHANGED = NO
RUNTIME_COMPATIBILITY_SEMANTIC_CHANGE = ACCEPT_MINIMAL_AUTH_CONTRACT_VERSION_1_3_0
CONTRACT_TS_CHANGE_CLASS = LIMITED_RUNTIME_COMPATIBILITY_CHANGE
CONTRACT_TS_CHANGE_BOUNDARY = ONLY_ADD_1_3_0_TO_SUPPORTED_VERSION_ALLOWLIST
```

The parent continues to own the `svc-forum` Audience, Scope, principal, fixture,
consumer, and activation semantics. This child owns only the implementation closure
needed to link the parent's frozen Contract Bundle `1.3.0` to schema, runtime, and
candidate acceptance readers.

Because this Spec is `proposed` and `implementation_authority: none`, it grants no
implementation or merge authority. It may grant the exact Contracts below only after
independent semantic review, owner acceptance of the exact final head, and merge to
`main` with `status: accepted` and `implementation_authority: contracts`.

## 2. Immutable coordinates

All observations and the omission matrix in this Spec are bound to:

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_MAIN = 450a0ecb286cbe5da6e790d3c572fa71218ca9c0
PARENT_SPEC_ID = AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1
PARENT_SPEC_BLOB = 78530b1fbfb13d477e65e002185128cf69843942
IMPLEMENTATION_PR = mayf3/auth-service #11
IMPLEMENTATION_REVIEW_HEAD = e9dddd583df2827581209140ceb834d2a83d7ded
IMPLEMENTATION_MERGE_BASE = 7c806561670bdae6410c7073a9d11ba36fd10803
IMPLEMENTATION_THREE_DOT_DIFF_DIGEST = f48dee53e3af9c6eaa5af9f74ed34ead507a4df882a3058752e1606dd82c99a8
AUTHORING_OBSERVED_AT = 2026-08-21T15:47:20Z
```

The digest is SHA-256 over the exact concatenation produced by:

```sh
{
  git diff --raw --full-index \
    7c806561670bdae6410c7073a9d11ba36fd10803...e9dddd583df2827581209140ceb834d2a83d7ded
  git diff --binary --full-index \
    7c806561670bdae6410c7073a9d11ba36fd10803...e9dddd583df2827581209140ceb834d2a83d7ded
} | shasum -a 256
```

This stream freezes file names, old/new blob identities, modes, and textual/binary
diff content. A changed implementation head requires a new review coordinate and a
new digest; it must not be described as the reviewed tuple above.

Omission execution environment and durable provenance:

```text
OS = Darwin 25.5.0 x86_64
NODE = v25.6.1
NPM = 11.9.0
TSX = 4.22.3
WORKTREE = detached linked worktree at IMPLEMENTATION_REVIEW_HEAD
RAW_RUN_WINDOW = 2026-08-21T15:47Z–2026-08-21T15:50Z
DURABLE_RESULT_PROVENANCE = this Spec §4.1 + mayf3/auth-service PR #12 body
```

`PROVEN_NECESSARY` below is qualified to this exact source/runtime tuple. The durable
record contains the command, exit code, and load-bearing error or pass count; raw
scratch logs were temporary and are not claimed as repository artifacts.

## 3. Semantic classification and non-goals

The only runtime semantic change governed here is that
`src/lib/oauth/v1/contract.ts` accepts generated Minimal Auth runtime snapshots whose
`contractVersion` is `1.3.0`, in addition to the already accepted `1.0.0`, `1.1.0`,
and `1.2.0` values. This is a limited compatibility change, not a mechanical or
no-semantic change.

The exact allowed expression delta is:

```text
BEFORE = ['1.0.0', '1.1.0', '1.2.0']
AFTER  = ['1.0.0', '1.1.0', '1.2.0', '1.3.0']
```

This Spec MUST NOT change or authorize changes to:

- Audience or Scope values;
- signer or verifier behavior other than recognizing Contract version `1.3.0`;
- Token claims or authentication algorithms;
- introspection, fallback, Grant, database, migration, or deployment behavior;
- the accepted parent Spec bytes;
- `mayf3/agent-forum` or any other repository;
- production deployment, production Grant writes, database writes, or merge.

## 4. Omission audit method

A temporary linked worktree was detached at `IMPLEMENTATION_REVIEW_HEAD`. For each
candidate, the file alone was restored from `IMPLEMENTATION_MERGE_BASE`, all other
19 PR #11 changes remained at the reviewed head, the stated command was executed,
and the file was restored to the reviewed head before the next case. The final
worktree was clean and remained at `e9dddd583df2827581209140ceb834d2a83d7ded`.
No commit or push was made to PR #11.

Verdict rule:

```text
PROVEN_NECESSARY = omission causes a deterministic failure in an executed,
                   explicitly frozen child acceptance gate because 1.3.0
                   linkage is missing.
NOT_NECESSARY    = comment-only, no enforcing reader, no formal acceptance
                   entry, or all applicable gates still pass after omission.
```

### 4.1 Seven-file omission matrix

| FILE | CHANGED_LINES_CLASS | ENFORCING_CONSUMER | OMISSION_COMMAND | OMISSION_RESULT | NECESSITY_VERDICT |
|---|---|---|---|---|---|
| `contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json` | executable JSON Schema `contract_version` const `1.2.0` → `1.3.0` | `contract-bundles/minimal-auth-v1/validate.mjs` compiles the schema and validates `contract-manifest.json` | `npm run contract:v1:validate` | exit 1: `/contract_version must be equal to constant`; `MINIMAL_AUTH_V1_BUNDLE_VALID=false` | `PROVEN_NECESSARY` |
| `scripts/bootstrap-obo-conformance-fixture.ts` | test-only OBO fixture manifest literal `1.2.0` → `1.3.0` | NONE: no package script, parent Acceptance mapping, child gate, test, or validator reads this literal | `npm run contract:v1:validate && npm run test:contract-v1` | exit 0; validator true; 45/45 contract tests pass | `NOT_NECESSARY` |
| `src/lib/oauth/v1/contract.ts` | production runtime supported-version allowlist adds `1.3.0` | `initializeAuthContract('v1')` → `verifyRuntimeSnapshot`; `tests/oauth/contract-runtime-v1.test.ts` | `JWT_SECRET=test-jwt-secret npm run contract:v1:prepare && JWT_SECRET=test-jwt-secret ./node_modules/.bin/tsx --test tests/oauth/contract-runtime-v1.test.ts` | exit 1: `Minimal Auth V1 runtime snapshot version is unsupported.` | `PROVEN_NECESSARY` |
| `tests/frozen-svc-okr-route-conformance.test.ts` | comments only (`1.2.0` → `1.3.0` in prose) | NONE: no executable assertion changed; file is not in a frozen package acceptance command | `npm run contract:v1:validate && npm run test:contract-v1` | exit 0; validator true; 45/45 contract tests pass | `NOT_NECESSARY` |
| `tests/helpers/load-candidate-snapshot.ts` | candidate loader supported-version allowlist adds `1.3.0` plus matching comment | child gate `ACC-VL-004`, explicitly executing candidate generation and candidate contract test | `npm run contract:v1:candidate && ./node_modules/.bin/tsx --test tests/oauth/candidate-contract.test.ts` | exit 1: `Candidate runtime snapshot version is unsupported.` | `PROVEN_NECESSARY` |
| `tests/oauth/candidate-contract.test.ts` | executable candidate version expectation `1.2.0` → `1.3.0` | child gate `ACC-VL-004` | `npm run contract:v1:candidate && ./node_modules/.bin/tsx --test tests/oauth/candidate-contract.test.ts` | exit 1: strict equality actual `1.3.0`, expected `1.2.0` | `PROVEN_NECESSARY` |
| `tests/oauth/contract-runtime-v1.test.ts` | executable runtime version expectation `1.2.0` → `1.3.0` | parent `ACC-FR-003`/`ACC-FR-010` through `npm run test:contract-v1`; child `ACC-VL-003` | `JWT_SECRET=test-jwt-secret npm run contract:v1:prepare && JWT_SECRET=test-jwt-secret ./node_modules/.bin/tsx --test tests/oauth/contract-runtime-v1.test.ts` | exit 1: strict equality actual `1.3.0`, expected `1.2.0` | `PROVEN_NECESSARY` |

The candidate loader and candidate test are not retroactively called parent gates.
They are retained only because this child explicitly freezes them as `ACC-VL-004`,
a real command that rejects either omission. Conversely, implementation presence
alone does not create authority for the bootstrap script or comment-only route test.

The fail-closed expected results are:

| FILE | EXPECTED_RC | EXPECTED_PATTERN |
|---|---:|---|
| `contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json` | 1 | `/contract_version must be equal to constant` |
| `scripts/bootstrap-obo-conformance-fixture.ts` | 0 | `ℹ pass 45` |
| `src/lib/oauth/v1/contract.ts` | 1 | `Minimal Auth V1 runtime snapshot version is unsupported.` |
| `tests/frozen-svc-okr-route-conformance.test.ts` | 0 | `ℹ pass 45` |
| `tests/helpers/load-candidate-snapshot.ts` | 1 | `Candidate runtime snapshot version is unsupported.` |
| `tests/oauth/candidate-contract.test.ts` | 1 | `expected: '1.2.0'` |
| `tests/oauth/contract-runtime-v1.test.ts` | 1 | `expected: '1.2.0'` |

The reproduction primitive for every matrix row is:

```sh
set -eu
BASE=7c806561670bdae6410c7073a9d11ba36fd10803
REVIEW_HEAD=e9dddd583df2827581209140ceb834d2a83d7ded
FILE='<one exact FILE value from §4.1>'
COMMAND='<the matching OMISSION_COMMAND from §4.1>'
EXPECTED_RC='<matching integer from the table above>'
EXPECTED_PATTERN='<matching literal pattern from the table above>'
log=$(mktemp)
test "$(git rev-parse HEAD)" = "$REVIEW_HEAD"
cleanup() {
  git restore --source="$REVIEW_HEAD" -- "$FILE"
  rm -f "$log"
}
trap cleanup EXIT
git restore --source="$BASE" -- "$FILE"
set +e
bash -lc "$COMMAND" >"$log" 2>&1
rc=$?
set -e
git restore --source="$REVIEW_HEAD" -- "$FILE"
test -z "$(git status --short)"
test "$rc" -eq "$EXPECTED_RC" || {
  printf 'UNEXPECTED_OMISSION_RC file=%s expected=%s actual=%s\n' \
    "$FILE" "$EXPECTED_RC" "$rc" >&2
  exit 1
}
grep -F -- "$EXPECTED_PATTERN" "$log" >/dev/null || {
  printf 'MISSING_OMISSION_PATTERN file=%s pattern=%s\n' \
    "$FILE" "$EXPECTED_PATTERN" >&2
  exit 1
}
printf 'OMISSION_ASSERTION=PASS file=%s rc=%s pattern=%s\n' \
  "$FILE" "$rc" "$EXPECTED_PATTERN"
```

Reviewers MUST execute this primitive separately for all seven rows and persist every
`OMISSION_ASSERTION=PASS` line plus the load-bearing output. The command fails when
either exit class or required result pattern differs. A nonzero exit alone is
insufficient unless its failure is the stated missing `1.3.0` linkage.

## 5. Decisions

### DEC-VL-001 — Use a child Spec, not an accepted-parent amendment

The previous in-place amendment path is rejected. Accepted parent bytes remain
immutable. This child refines only runtime/version linkage beneath the parent and
creates no parallel product authority.

### DEC-VL-002 — Classify `contract.ts` honestly

Adding `1.3.0` to the production runtime snapshot allowlist changes which Contract
versions the service accepts. It is `LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, not
mechanical and not semantic delta none.

### DEC-VL-003 — Authority follows omission evidence

Only files whose omission deterministically fails a frozen, actually executed gate
may extend the parent's 13-file auth-service closure. Already-written implementation
cannot grant itself authority.

### DEC-VL-004 — Exclude non-enforcing changes

The OBO bootstrap literal and the comment-only svc-okr route test are excluded. They
MUST be removed from PR #11 before that PR may fit the closure. A future need to
change either file is `OWNER_DECISION_REQUIRED` under a separate authority.

## 6. Contracts

### CTR-VL-001 — Parent semantics and bytes remain unchanged

This child and its PR MUST NOT modify
`docs/specs/AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1.md`. Its blob on the authoring
`main` is `78530b1fbfb13d477e65e002185128cf69843942`.

When PR #11 is pruned, the following 13 parent-scope output blobs at the reviewed head
MUST remain byte-identical; this freezes the already reviewed `svc-forum`
Audience/Scope implementation semantics while only removing excluded linkage files:

```text
2f05c06a3fb1b61480356be30ef7e0789e09107e docs/contracts/minimal-auth-v1/grants-and-audiences.md
cc33f20cb0068f3346fc5f84669c6deaa5493731 docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
ef7e139ec545471cbb4e84ce84a5fbcc3c48b1d7 contract-bundles/minimal-auth-v1/audience-registry.json
60ed66c696fa465c6a850f3a1749df55a19eb65b contract-bundles/minimal-auth-v1/contract-manifest.json
e099f5b9e1c7c9cb7cb49da0a90a436ecd7bc324 contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
f10917f7059ec2a087c8b1fd59ea08f72fee5b02 contract-bundles/minimal-auth-v1/metadata/change-log.md
0b874aaee9efe52c7cc9d9a4f941c2f0bd7995ac contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
41dc589bd675a8cb1211a39c3a7160124468178d contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
cc9780a20e841ef9ca77192bf344b7affa98d92c contract-bundles/minimal-auth-v1/validate.mjs
9974c20a22272d7a0146e28e6db0b86ba7e521c6 contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
4462a3f2099407ca99780119707592bac5e1b602 contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
142ce51d032089968c601e258e0b227902726a10 contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
886fcac9681e57585451d0851d9e1b90e9e131d1 contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
```

### CTR-VL-002 — Exact minimal implementation closure

```text
ORIGINAL_ROOT_SCOPE_FILES = 13
PROVEN_LINKAGE_FILES = 5
FINAL_IMPLEMENTATION_SCOPE_FILES = 18
```

After acceptance and merge only, this child MAY authorize exactly these 18 files:

```text
docs/contracts/minimal-auth-v1/grants-and-audiences.md
docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
contract-bundles/minimal-auth-v1/audience-registry.json
contract-bundles/minimal-auth-v1/contract-manifest.json
contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
contract-bundles/minimal-auth-v1/metadata/change-log.md
contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
contract-bundles/minimal-auth-v1/validate.mjs
contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json
src/lib/oauth/v1/contract.ts
tests/helpers/load-candidate-snapshot.ts
tests/oauth/candidate-contract.test.ts
tests/oauth/contract-runtime-v1.test.ts
```

No wildcard, directory, generated output, or “related file” is authorized. The first
file outside this set is rejected, and every outside-file need is:

```text
OWNER_DECISION_REQUIRED
```

### CTR-VL-003 — Explicit exclusions

The following reviewed-head changes are `NOT_NECESSARY`, are outside the closure, and
MUST be removed from PR #11 before conformance can pass:

```text
scripts/bootstrap-obo-conformance-fixture.ts
tests/frozen-svc-okr-route-conformance.test.ts
```

### CTR-VL-004 — Exact runtime compatibility boundary

`src/lib/oauth/v1/contract.ts` MAY change only by adding string literal `1.3.0` to
the supported Contract-version allowlist. No format-version, digest, lifecycle,
Audience, Scope, signer, verifier, claim, algorithm, introspection, fallback, or
error behavior may change under this Contract.

### CTR-VL-005 — PR #11 remains frozen until authority and pruning complete

PR #11 at the reviewed head remains unmodified by this authoring round and has no
merge authority while this Spec is proposed. Before PR #11 can be independently
reviewed for merge, an authorized later implementation round MUST remove both
`NOT_NECESSARY` files, preserve the 13 parent-scope output blobs, contain exactly the
18-file closure, rerun every Acceptance command, and bind review to its new final
head and digest.

### CTR-VL-006 — No operational authority

This Spec does not authorize deployment, merge, Grant creation or modification,
database/schema/migration writes, production state changes, or any change to PR #11
while this Spec remains proposed.

## 7. Acceptance

### ACC-VL-001 — Root Spec and product semantics byte-unchanged

- Contracts: `CTR-VL-001`.
- Method: PR #12 must have exactly one added file and no parent Spec diff; later PR
  #11 pruning must preserve all 13 pinned output blob IDs.
- Commands:

```sh
set -eu
test "$(git diff --name-status github/main...HEAD)" = \
  "$(printf 'A\tdocs/specs/AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1.md')"
test "$(git rev-parse github/main:docs/specs/AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1.md)" = \
  78530b1fbfb13d477e65e002185128cf69843942

FINAL_PR11_HEAD='<later pruned PR #11 head>'
while read -r expected path; do
  actual=$(git rev-parse "$FINAL_PR11_HEAD:$path")
  test "$actual" = "$expected" || {
    printf 'ROOT_BLOB_MISMATCH=%s expected=%s actual=%s\n' "$path" "$expected" "$actual" >&2
    exit 1
  }
done <<'ROOT_BLOBS'
2f05c06a3fb1b61480356be30ef7e0789e09107e docs/contracts/minimal-auth-v1/grants-and-audiences.md
cc33f20cb0068f3346fc5f84669c6deaa5493731 docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
ef7e139ec545471cbb4e84ce84a5fbcc3c48b1d7 contract-bundles/minimal-auth-v1/audience-registry.json
60ed66c696fa465c6a850f3a1749df55a19eb65b contract-bundles/minimal-auth-v1/contract-manifest.json
e099f5b9e1c7c9cb7cb49da0a90a436ecd7bc324 contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
f10917f7059ec2a087c8b1fd59ea08f72fee5b02 contract-bundles/minimal-auth-v1/metadata/change-log.md
0b874aaee9efe52c7cc9d9a4f941c2f0bd7995ac contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
41dc589bd675a8cb1211a39c3a7160124468178d contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
cc9780a20e841ef9ca77192bf344b7affa98d92c contract-bundles/minimal-auth-v1/validate.mjs
9974c20a22272d7a0146e28e6db0b86ba7e521c6 contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
4462a3f2099407ca99780119707592bac5e1b602 contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
142ce51d032089968c601e258e0b227902726a10 contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
886fcac9681e57585451d0851d9e1b90e9e131d1 contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
ROOT_BLOBS
```

- Failure: parent file changed, PR #12 contains another file, or any pinned parent
  implementation blob changes during pruning.

### ACC-VL-002 — Validator enforces Contract `1.3.0`

- Contracts: `CTR-VL-002`.
- Command: `npm run contract:v1:validate`.
- Expected: exit 0 and `MINIMAL_AUTH_V1_BUNDLE_VALID=true`.
- Negative evidence: omitting the manifest schema linkage exits 1 with
  `/contract_version must be equal to constant`.

### ACC-VL-003 — Runtime and full Contract tests enforce `1.3.0`

- Contracts: `CTR-VL-004`.
- Commands:

```sh
JWT_SECRET=test-jwt-secret npm run contract:v1:prepare
JWT_SECRET=test-jwt-secret ./node_modules/.bin/tsx --test tests/oauth/contract-runtime-v1.test.ts
npm run test:contract-v1
```

- Expected: runtime identity reports exactly `1.3.0`; all Contract tests pass.
- Negative evidence: omitting either `contract.ts` or the runtime test produces the
  deterministic failures recorded in §4.1.

### ACC-VL-004 — Candidate gate enforces `1.3.0`

- Contracts: `CTR-VL-002`.
- Command:

```sh
npm run contract:v1:candidate && \
  ./node_modules/.bin/tsx --test tests/oauth/candidate-contract.test.ts
```

- Expected: candidate loader accepts `1.3.0`, test expects `1.3.0`, command exits 0.
- Negative evidence: separately omitting the loader or test produces the deterministic
  failures in §4.1. This is the sole child gate that makes those files necessary.

### ACC-VL-005 — Omission evidence and exclusions are complete

- Contracts: `CTR-VL-002`, `CTR-VL-003`.
- Method/command: independently execute the literal §4 reproduction primitive seven
  times, substituting each matrix row's exact `FILE` and `OMISSION_COMMAND`, at the
  immutable coordinates in §2. Persist every exit code and load-bearing output.
- Expected: exactly five `PROVEN_NECESSARY`, exactly two `NOT_NECESSARY`; the two
  excluded paths are absent from the final PR #11 diff.
- Failure: an alleged necessary file has no deterministic omission failure, an
  excluded file remains, or a new test/package script was added to manufacture need.

### ACC-VL-006 — Exact closure and first outside file rejection

- Contracts: `CTR-VL-002`, `CTR-VL-005`.
- Method: run this literal fail-closed checker, first with `FINAL_PR11_HEAD` equal to
  the reviewed 20-file head as a negative probe and later with the authorized pruned
  head:

```sh
set -eu
BASE=7c806561670bdae6410c7073a9d11ba36fd10803
FINAL_PR11_HEAD='<exact PR #11 head under review>'
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git diff --name-only "$BASE...$FINAL_PR11_HEAD" | LC_ALL=C sort >"$tmp/actual"
LC_ALL=C sort >"$tmp/expected" <<'EXPECTED_PATHS'
contract-bundles/minimal-auth-v1/audience-registry.json
contract-bundles/minimal-auth-v1/contract-manifest.json
contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
contract-bundles/minimal-auth-v1/metadata/change-log.md
contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json
contract-bundles/minimal-auth-v1/validate.mjs
docs/contracts/minimal-auth-v1/grants-and-audiences.md
docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
src/lib/oauth/v1/contract.ts
tests/helpers/load-candidate-snapshot.ts
tests/oauth/candidate-contract.test.ts
tests/oauth/contract-runtime-v1.test.ts
EXPECTED_PATHS
extra=$(comm -23 "$tmp/actual" "$tmp/expected" | sed -n '1p')
missing=$(comm -13 "$tmp/actual" "$tmp/expected" | sed -n '1p')
test -z "$extra" || { printf 'FIRST_OUTSIDE_CLOSURE=%s\n' "$extra" >&2; exit 1; }
test -z "$missing" || { printf 'FIRST_MISSING_CLOSURE=%s\n' "$missing" >&2; exit 1; }
test "$(wc -l <"$tmp/actual" | tr -d ' ')" = 18
```

- Required negative probe: with
  `FINAL_PR11_HEAD=e9dddd583df2827581209140ceb834d2a83d7ded`, the checker MUST
  exit nonzero and report
  `FIRST_OUTSIDE_CLOSURE=scripts/bootstrap-obo-conformance-fixture.ts`. After
  authorized pruning, both `comm` sets MUST be empty and the count MUST equal 18.
- Failure: count mismatch, missing path, extra path, wildcard authorization, or
  outside-file warning without failure.

### ACC-VL-007 — PR #11 merge-authority gate

- Contracts: `CTR-VL-005`, `CTR-VL-006`.
- Expected before child acceptance: `PR_11_MERGE_AUTHORITY = NO`.
- Expected before later merge review: child accepted and merged; PR #11 exact final
  head contains only the 18-file closure; validator, runtime, candidate, and full
  Contract commands pass; independent review is bound to that exact final head.
- Failure: treating this proposed child, the frozen 20-file head, or partial test
  evidence as merge authority.

### ACC-VL-008 — Operational exclusions

- Contracts: `CTR-VL-006`.
- Method: diff and execution-record review.
- Expected: no deploy, Grant, DB, migration, production write, PR merge, or product
  behavior beyond the limited version allowlist compatibility change.
- Failure: any such action is attributed to this Spec.

Every active Contract maps to at least one Acceptance item, and every wrong
implementation described above fails at least one item.

## 8. Alternatives and disposition

### ALT-VL-001 — Continue amending the accepted Root Spec

`REJECTED`. It would rewrite accepted authority to simulate a proposed lifecycle and
would destroy immutable meaning at the parent coordinate.

### ALT-VL-002 — Whole-authority supersession

`REJECTED`. The parent product semantics remain unchanged; replacing the entire
Audience CCR would create unnecessary authority churn.

### ALT-VL-003 — Authorize all seven files because PR #11 already changed them

`REJECTED`. Implementation cannot self-authorize. Two omissions leave every applicable
formal gate passing or change comments only.

### ALT-VL-004 — Call the runtime allowlist change mechanical

`REJECTED`. Accepting a new Contract version changes runtime compatibility semantics.

## 9. Acceptance-finalize immutable tuple

Proposed authoring MUST NOT fabricate acceptance. Acceptance finalize requires one
immutable tuple persisted in the PR acceptance record. The accepted Spec commit may
embed all values already knowable before commit creation; the persistent PR record
MUST complete `FINAL_ACCEPTED_HEAD` with that resulting commit SHA. This external
completion avoids the impossible requirement for a Git commit to contain its own
SHA while preserving one auditable tuple:

```text
ACCEPTANCE_RECORD_LOCATION = REQUIRED_UNSET
ACCEPTANCE_REVIEW = REQUIRED_UNSET
REVIEWED_BASE = REQUIRED_UNSET
REVIEWED_SPEC_HEAD = REQUIRED_UNSET
REVIEWER_IDENTITY = REQUIRED_UNSET
REVIEW_VERDICT = REQUIRED_UNSET
REQUIRED_FIXES = REQUIRED_UNSET
FINAL_ACCEPTED_HEAD = REQUIRED_UNSET
ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = REQUIRED_UNSET
ACCEPTED_BY = REQUIRED_UNSET
ACCEPTED_AT = REQUIRED_UNSET
```

Rules:

- the required tuple includes every field named by this task; `ACCEPTED_BY` and
  `ACCEPTED_AT` additionally prove the authorized acceptance action;
- `ACCEPTANCE_RECORD_LOCATION` must be a stable PR review/comment URL;
- `REVIEW_VERDICT` must be `PASS` before owner acceptance;
- `REQUIRED_FIXES` must be `NONE` at the reviewed final semantics;
- `FINAL_ACCEPTED_HEAD` must identify the resulting accepted Spec commit and be
  written to the stable PR acceptance record before merge;
- `ACCEPTED_BY` must be `mayf3` or an explicitly delegated auth-service maintainer;
- any semantic change after `REVIEWED_SPEC_HEAD` invalidates the review;
- lifecycle/authority finalize may occur only by an authorized repository actor;
- accepted-looking content on an unmerged branch is not active authority.

## 10. Frozen summary

```text
SPEC_ID = AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
GOVERNED_BY = AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1

ORIGINAL_ROOT_SCOPE_FILES = 13
PROVEN_LINKAGE_FILES = 5
FINAL_IMPLEMENTATION_SCOPE_FILES = 18
EXCLUDED_LINKAGE_FILES = 2

ROOT_AUDIENCE_PRODUCT_SEMANTICS_CHANGED = NO
RUNTIME_COMPATIBILITY_SEMANTIC_CHANGE = ACCEPT_MINIMAL_AUTH_CONTRACT_VERSION_1_3_0
CONTRACT_TS_CHANGE_BOUNDARY = ONLY_ADD_1_3_0_TO_SUPPORTED_VERSION_ALLOWLIST

PR_11_HEAD_UNCHANGED_BY_AUTHORING = YES
PR_11_MERGE_AUTHORITY = NO
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
GRANT_OR_DB_WRITE_AUTHORIZED = NO
MERGE_PERFORMED = NO
```
