---
spec_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_CLOSURE_ELABORATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/auth-service
  - Minimal Auth Contract Bundle 1.4.0 implementation closure elaboration (15 -> 16 files; validate.mjs single-line first-wave Audience set delta only)
governed_by:
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_CLOSURE_ELABORATION_V1

> **PROPOSED.** This Spec is `status: proposed` and `implementation_authority: none`.
> It grants no implementation, merge, acceptance, or production authority until an
> independent semantic review of the exact head, owner acceptance of that exact
> final head, and merge to `main` flip the frontmatter to
> `status: accepted` / `implementation_authority: contracts`.
> It does not edit, renumber, narrow, or reverse any stable ID of the already
> accepted `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1`
> or any other accepted authority. Accepted history stays byte-identical.

## 1. Purpose and authority boundary

This child Spec is the proposed **additive closure elaboration** for the already
accepted
`AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1`
(hereafter **the accepted closure Spec**; accepted via PR #27 at spec head
`8ba603f8d4397898c09c5bcd17bac67f0022cbc8`, 注册 审计 = PASS). Its sole purpose is
to resolve — through a new, separately reviewable authority — the exact closure
blocker that the accepted closure Spec itself froze as `OWNER_DECISION_REQUIRED`:

```text
ELABORATED_SPEC_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
ELABORATED_SPEC_PR = mayf3/auth-service#27
ELABORATION_KIND = NEW_SPEC_ADDITIVE_CLOSURE_ELABORATION
PARENT_AUDIENCE_CCR = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1 (unchanged)
ELABORATED_HISTORY_REWRITTEN = NO (accepted Spec bytes remain untouched)
AUTHORIZATION_SEMANTICS = CTR-NIC-001 owner-decision gate exercised via this Spec
SOLE_AUTHORIZED_ADDITION = contract-bundles/minimal-auth-v1/validate.mjs (1 file)
EXTRA_FILE_COUNT = 0
IMPLEMENTATION_CLOSURE_COUNT_AFTER_ACCEPTANCE = 16
```

The accepted closure Spec froze a 15-file implementation closure (§4.3,
`CTR-NIC-001`) and classified `validate.mjs` as `NOT_NECESSARY` (§4.2). That
classification is mechanically falsified for the real `1.3.0 -> 1.4.0`
registration delta: the delta adds a **sixth Audience entry** to
`audience-registry.json`, and `validate.mjs:395` hardcodes the first-wave
Audience exact set. Adding the Audience without touching that single line
deterministically fails the bundle validator with
`registry: first-wave Audience set changed` (§4, OBS-NIE-001..003; the same gate
was already proven against implementation draft PR #29 and recorded by the
accepted `AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1` as `OBS-AW-009`).

Because this Spec is `proposed` and `implementation_authority: none`, it changes
nothing by itself. Draft implementation PR #29 stays frozen, DRAFT, NOT FOR
MERGE, and untouched. If and only if this Spec is accepted and merged, the
operative implementation closure for the NI `1.4.0` registration becomes exactly
16 files: the accepted 15 (unchanged, from the accepted closure Spec §4.3) plus
`validate.mjs` under the single-change boundary frozen here.

## 2. Immutable coordinates

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = 51a11af57ce39eafac5883e0c32474ea06906b8e (github/main at authoring)
AUTHORING_MODE = independent linked worktree at AUTHORING_BASE, docs-only
AUTHORING_OBSERVED_AT = 2026-08-28

ELABORATED SPEC COORDINATES (accepted; read-only reference):
  ACCEPTANCE_RECORD = §14 of the accepted closure Spec
  REVIEWED_BASE = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689
  REVIEWED_SPEC_HEAD = 8ba603f8d4397898c09c5bcd17bac67f0022cbc8
  SPEC_PR = mayf3/auth-service#27
  MERGE_COMMIT = d529bd3c28ece3967149ad793794f8dac2020276

IMPLEMENTATION DRAFT COORDINATES (evidence only; NOT an authority pin):
  IMPLEMENTATION_PR = mayf3/auth-service#29 (OPEN, DRAFT, NOT FOR MERGE)
  IMPLEMENTATION_HEAD = 3c5b293a79a96a652f30add9017e4210c488e251
  IMPLEMENTATION_BRANCH = implement/notification-ingress-bundle-1.4.0
  IMPLEMENTATION_BASE = d529bd3c28ece3967149ad793794f8dac2020276
    (= merge-base of 3c5b293 and github/main at authoring; the exact accepted
    main on which the closure Spec was already merged)
  EVIDENCE_EXECUTED_AT = 2026-08-24 (implementation round; recorded in PR #29 body)

FILE COORDINATES (github/main at authoring, unless noted):
  validate.mjs BLOB @main = cc9780a20e841ef9ca77192bf344b7affa98d92c
  validate.mjs BLOB @3c5b293 = 18019bc22f66a5b9b2b8fa6b8b190fec6a333454
  first-wave Audience set check = validate.mjs:394-395
    (:394 `check([...audienceIds].sort(asciiCompare).join('\0')`
     :395 `=== ['adc-v2', 'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow']
           .sort(asciiCompare).join('\0'), 'registry: first-wave Audience set changed');`
     — line numbers are convenience coordinates on accepted main; the enforcing
     identity is the `check` whose failure message is exactly
     `registry: first-wave Audience set changed`)
  audience-registry.json @main = registry_version 1.3.0, 5 Audiences
    (adc-v2, svc-auth, svc-forum, svc-okr, svc-workflow)
  audience-registry.json @3c5b293 = registry_version 1.4.0, 6 Audiences
    (+ agent-core-notification-ingress-v1)
```

## 3. Drift statement — root cause of the NOT_NECESSARY misclassification

The accepted closure Spec's §4.1 fail-closed experiment bumped the bundle version
pins `1.3.0 -> 1.4.0` **without adding the new Audience entry**. In that scratch
state the registry Audience set was still the five first-wave Audiences, so the
`validate.mjs` first-wave set gate never fired, the validator passed with
`validate.mjs` untouched, and §4.2 classified it `NOT_NECESSARY` with exactly that
reason ("§4.1 validator passed with `validate.mjs` untouched").

The real parent-authorized registration (parent CCR `CTR-NI-001`) is not a
version-pins-only delta: it adds the sixth Audience
`agent-core-notification-ingress-v1` to `audience-registry.json`. From that
moment the :394-395 comparison of six registry IDs against the hardcoded
five-element literal can never be equal, and the validator fails closed. The
misclassification is therefore bounded and deterministic: the omission evidence
was incomplete, not the enforcement fictional. The svc-forum `1.3.0` round
(PR #11) hit the same gate and had to include `validate.mjs`; the agent-wake
round audited the same gate against this very implementation draft
(`OBS-AW-009`) and corrected its own closure 15 -> 16 before acceptance.

Per the standing grammar ("Report drift; do not edit accepted authority to
excuse the implementation"), the drift is resolved here by **new authority**,
not by rewriting the accepted Spec.

## 4. Observations

### OBS-NIE-001 — first-wave Audience set gate on accepted main

- Subject: `contract-bundles/minimal-auth-v1/validate.mjs:394-395`
- Source: `mayf3/auth-service@51a11af` (github/main at authoring)
- Observed at: 2026-08-28 (注册 执行 elaboration round)
- Method: read-only `git show github/main:contract-bundles/minimal-auth-v1/validate.mjs`
- Result: the validator unconditionally executes
  `check([...audienceIds].sort(asciiCompare).join('\0') === ['adc-v2', 'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow'].sort(asciiCompare).join('\0'), 'registry: first-wave Audience set changed')`
  over `registry.audiences`; `audienceIds` at main is exactly the five-element
  set; adding any sixth Audience ID to the registry without changing this
  literal makes the two `\0`-joined strings unequal and the check fails.
- Provenance: this authoring round (blob `cc9780a…`, §2).

### OBS-NIE-002 — PR #29 composition and exact validate.mjs delta

- Subject: implementation draft PR #29 diff vs `d529bd3`
- Source: `mayf3/auth-service@3c5b293` + PR #29 file list (evidence coordinates)
- Observed at: 2026-08-28 (re-verified this round: `git diff --name-only
  d529bd3 3c5b293`, `gh pr diff 29`, blob ids via `git rev-parse`)
- Result:
  - exactly 16 files changed = the accepted closure Spec §4.3 frozen 15 files
    + `contract-bundles/minimal-auth-v1/validate.mjs`; nothing else;
  - `validate.mjs` delta = exactly **one line** (1 insertion + 1 deletion,
    `cc9780a…` -> `18019bc…`): the :395 set literal becomes
    `['adc-v2', 'agent-core-notification-ingress-v1', 'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow']`;
    every other line of the file is byte-identical;
  - registry at `3c5b293` = `registry_version 1.4.0` with the sixth Audience
    `agent-core-notification-ingress-v1` present.
- Provenance: this authoring round's independent read-only diff audit.

### OBS-NIE-003 — two-sided executed validator evidence at 3c5b293

- Subject: bundle validator behavior with/without the single-line delta
- Source: PR #29 body ("Verification (all executed at head 3c5b293)",
  authored 2026-08-24) and the accepted agent-wake Spec's independent audit
  record `OBS-AW-009` (2026-08-28)
- Observed at: recorded 2026-08-24 / 2026-08-28; cited (not re-executed) in this
  docs-only round
- Result (as executed and recorded at `3c5b293`):
  - **omission side**: candidate bundle carrying all other 1.4.0 deltas but the
    15-file closure (no `validate.mjs` change) fails
    `npm run contract:v1:validate` with the **sole** validator failure
    `registry: first-wave Audience set changed`;
  - **inclusion side**: with the single-line set-literal delta,
    `MINIMAL_AUTH_V1_BUNDLE_VALID=true` with blocker counts identical to the
    pristine 1.3.0 baseline (FREEZE 0 / PRODUCTION 1 / CONSUMER 2 parity);
  - full suite at `3c5b293`: `npm run test:contract-v1` 45/45 pass; candidate
    gate (`contract:v1:candidate` + `candidate-contract.test.ts`) 22/22 pass;
    `npm run test:oauth` 104/104 pass; `npx tsc -p tsconfig.json --noEmit` PASS;
    `git diff --check` PASS.
- Provenance: two independent prior records (implementation round PR body;
  唤醒 修订轮 read-only audit) — this Spec cites them as evidence coordinates;
  the 注册 审计 round re-executes per ACC-NIE-003/004.

### OBS-NIE-004 — accepted §4.2 classification and its stated reason

- Subject: accepted closure Spec §4.2 `validate.mjs` row; §4.1 experiment scope
- Source: `docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1.md`
  at main (blob identical to reviewed head `8ba603f…` §14 merge)
- Observed at: 2026-08-28
- Result: §4.2 classifies `validate.mjs` `NOT_NECESSARY` with the reason
  "service-principal machine-profile enforcement already exists …; §4.1
  validator passed with `validate.mjs` untouched"; §4.1's scratch experiment
  bumped version pins only and added no Audience entry; §4.3 froze
  `FINAL_IMPLEMENTATION_SCOPE_FILES = 15`; `DEC-NIC-003` froze "validate.mjs …
  stay byte-identical"; `CTR-NIC-008` forbids modifying any §4.2 `NOT_NECESSARY`
  file; `CTR-NIC-001` gates the first outside-set file as
  `OWNER_DECISION_REQUIRED`.
- Provenance: accepted authority text, read-only.

### OBS-NIE-005 — agent-wake precedent for the identical gate correction

- Subject: `AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1` closure correction
- Source: accepted Spec at main (`OBS-AW-009`, `EVD-AW-004`, `CTR-AW-007`,
  `ACC-AW-004`; revision commit `b0443bc`, acceptance `926a1a5` / PR #32)
- Observed at: 2026-08-28
- Result: for the agent-wake registration the same first-wave set gate forced
  the same 15 -> 16 closure correction with
  `VALIDATE_MJS_CLASSIFICATION NOT_NECESSARY -> PROVEN_NECESSARY` and the frozen
  single-allowed-semantic-change = the :395 set literal appending exactly one
  element; its wording explicitly records that the NI closure Spec's 15-file
  freeze "作为「NI closure Spec 冻结了什么」的历史事实保持准确，但新 Audience
  注册的 executable truth = 16 文件".
- Provenance: accepted authority text, read-only.

## 5. Claims and Evidence

### CLM-NIE-001 — validate.mjs is PROVEN_NECESSARY for the 1.4.0 registration delta

- Support state: SUPPORTED
- Basis: OBS-NIE-001 (unconditional gate over the registry Audience exact set) +
  OBS-NIE-003 omission side (omission = sole, deterministic validator failure)
  + OBS-NIE-005 (independent prior audit of the same gate against the same
  draft).

### CLM-NIE-002 — the misclassification is bounded to exactly one file; no 17th file is needed

- Support state: SUPPORTED
- Basis: OBS-NIE-003 inclusion side (with exactly 16 files the entire frozen
  validation surface passes at baseline parity: validator, contract 45/45,
  candidate 22/22, OAuth 104/104, typecheck) + OBS-NIE-002 (composition =
  frozen 15 + validate.mjs, nothing else). The first-wave set gate reads only
  `registry.audiences`; no other §4.2 `NOT_NECESSARY` classification depended on
  the presence of the sixth Audience entry.

### CLM-NIE-003 — a new `spec_id` is the only legal vehicle for this correction

- Support state: SUPPORTED
- Basis: `SPEC_FORMAT_V0` §14.1/§14.2/§14.3 + OBS-NIE-004. A same-`spec_id`
  additive `AMEND` requires every accepted Decision to remain unchanged, but
  the correction reverses the operative meaning of accepted `DEC-NIC-003`
  (validate.mjs stays byte-identical) and `CTR-NIC-008` (no §4.2 `NOT_NECESSARY`
  file may change) for this file; a whole-Spec `SUPERSEDE` is disproportionate
  because the 15-file freeze and every other `CTR-NIC-*` remain valid and
  operative. §14.3 therefore requires `NEW` — this Spec.

### EVD-NIE-001 — gate + omission evidence support the PROVEN_NECESSARY classification

- Source observations: `OBS-NIE-001`, `OBS-NIE-003`
- Target: `CLM-NIE-001`, `CTR-NIE-002`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@51a11af` (gate) and `@3c5b293`
  (executed two-sided evidence; draft coordinates, not authority pins)
- Strength/sufficiency: mechanically decisive — the check is unconditional over
  the registry set, and the omission side is a recorded sole-failure result.

### EVD-NIE-002 — inclusion evidence supports closure = 16 and EXTRA_FILE_COUNT = 0

- Source observations: `OBS-NIE-002`, `OBS-NIE-003`
- Target: `CLM-NIE-002`, `CTR-NIE-001`, `CTR-NIE-004`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@3c5b293` (draft coordinates)
- Strength/sufficiency: full frozen validation surface green at exactly 16
  files; any 17th-file need would have surfaced as a failing gate.

### EVD-NIE-003 — protocol reading supports the NEW-spec vehicle

- Source observations: `OBS-NIE-004`, `OBS-NIE-005`
- Target: `CLM-NIE-003`, `DEC-NIE-001`
- Relation: SUPPORTS
- Bound coordinates: `.agents/protocol/SPEC_FORMAT_V0.md` §14 (main); accepted
  agent-wake Spec at main
- Strength/sufficiency: textual necessity argument; no executed component.

## 6. State projection

### STATE-NIE-001 — operative closure after acceptance (projection)

- Projection: IF this elaboration is accepted and merged, THEN the operative
  implementation closure for the NI `1.3.0 -> 1.4.0` registration is exactly
  16 files = accepted closure Spec §4.3 (15 files, unchanged) +
  `contract-bundles/minimal-auth-v1/validate.mjs` under `CTR-NIE-002`; PR #29's
  current diff already satisfies this composition (OBS-NIE-002).
- Coordinates: projection at `AUTHORING_BASE = 51a11af`; sources OBS-NIE-001..005,
  CLM-NIE-001..003.
- Today (this Spec proposed, nothing accepted): operative closure remains 15;
  PR #29 remains blocked; nothing merged, applied, or created.

## 7. Decisions

### DEC-NIE-001 — NEW elaboration Spec; accepted history untouched

- Decision owner: mayf3 (task dispatch: DOCS_ONLY_CLOSURE_ELABORATION; acceptance
  requires a separate independent review + owner acceptance round)
- Decision: resolve the drift by a new `spec_id`
  (`…_CLOSURE_ELABORATION_V1`, stable-ID namespace `NIE-*`) that additively
  authorizes the 16th file; the accepted closure Spec is NOT edited — its §4.2/
  §4.3/§12 remain the accurate historical record of what was frozen at its
  authoring time, exactly as `OBS-AW-008/009` framed the 15-file freeze.
- Rejected alternatives: in-place edit of the accepted Spec (violates accepted
  immutability, §14.1); same-`spec_id` `AMEND` (its §14.2 preconditions fail,
  `CLM-NIE-003`); whole-Spec `SUPERSEDE` (disproportionate — one bounded aspect
  changes).
- Reason: §14.3 requires `NEW` for reversing accepted normative meaning; the
  CTR-NIC-001 `OWNER_DECISION_REQUIRED` gate is exercised openly through this
  separately reviewable authority, never by silent rewrite.

### DEC-NIE-002 — validate.mjs classification: PROVEN_NECESSARY, single-line delta

- Decision owner: mayf3
- Decision: within the NI `1.4.0` closure, `validate.mjs` is re-classified
  `NOT_NECESSARY -> PROVEN_NECESSARY` (bounded to this file; the correction is
  recorded here, in a new ID, and does not edit the accepted §4.2 row). The
  single allowed semantic change = the first-wave Audience set literal
  (`:395` on accepted main) gains exactly the one element
  `agent-core-notification-ingress-v1`, as one changed line; the comparison
  itself stays mechanically decided by `.sort(asciiCompare)`.
- Rejected alternative: any second semantic change to `validate.mjs`.
- Reason: `CLM-NIE-001`/`EVD-NIE-001`; mirrors the accepted `CTR-AW-007` freeze.

### DEC-NIE-003 — everything else in validate.mjs is frozen

- Decision owner: mayf3
- Decision: beyond the single line above, the implementation MUST NOT modify
  `validate.mjs`: other validator rules, blocker counting logic, principal
  profile checks (`PROFILE_FORBIDDEN_CLAIM` agent_id rule,
  machine_access/principal-type/scope checks), scope checks, digest/version
  checks, other Audience literals, other error semantics — all byte-identical.
- Rejected alternative: modernize/reformat the validator while inside the
  closure.
- Reason: minimal-delta discipline; the accepted §4.2 row's *other* reasoning
  (profile enforcement already exists) remains true and untouched.

### DEC-NIE-004 — EXTRA_FILE_COUNT = 0; the elaboration is terminal for this delta

- Decision owner: mayf3
- Decision: this elaboration authorizes exactly one additional file. The NI
  `1.4.0` implementation closure is hereby 16 files and MUST NOT grow to any
  17th file; any further outside-file need remains `OWNER_DECISION_REQUIRED`
  under `CTR-NIC-001` semantics.
- Rejected alternative: use the PR #29 evidence to widen the closure further.
- Reason: `CLM-NIE-002`/`EVD-NIE-002`; the same discipline the accepted
  `CTR-AW-007` imposed on the NI evidence.

### DEC-NIE-005 — PR #29 stays frozen; this round is docs-only

- Decision owner: mayf3
- Decision: this round creates only this Spec (plus its `docs/specs/README.md`
  index row) and a DRAFT spec PR. PR #29's product code, head, and body are not
  modified; no acceptance, no merge, no production apply, no Client/Grant
  change. Merge of PR #29 remains gated on this elaboration's acceptance +
  merge and the 注册 审计 round.
- Rejected alternative: rebase/amend PR #29 now to "pre-conform".
- Reason: implementation must not move ahead of authority; base reconciliation
  happens at merge time under review.

## 8. Contracts

### CTR-NIE-001 — Elaborated exact closure (16 files)

After acceptance and merge of this Spec only, an implementation PR under the
parent NI CCR and the accepted closure Spec MAY modify exactly the 16 files =
the accepted closure Spec §4.3 list (15 files, unchanged, restated by
reference) + `contract-bundles/minimal-auth-v1/validate.mjs`. Every other
obligation of `CTR-NIC-001..CTR-NIC-008` remains in force unchanged, except
solely as provided by CTR-NIE-003. No wildcard, directory, generated output, or
"related file" is authorized; the first file outside the 16-file set remains
`OWNER_DECISION_REQUIRED`; implementation-time path rename/move requires a new
owner decision, never fuzzy matching.

### CTR-NIE-002 — validate.mjs single-change boundary

`contract-bundles/minimal-auth-v1/validate.mjs` MAY change by exactly one line:
the first-wave Audience set literal gains exactly the single element
`agent-core-notification-ingress-v1` (resulting literal:
`['adc-v2', 'agent-core-notification-ingress-v1', 'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow']`).
File line count is unchanged and every other line is byte-identical. The
implementation MUST NOT otherwise modify the file (DEC-NIE-003 enumeration is
normative). At diff level this is exactly 1 insertion + 1 deletion on that
single line.

### CTR-NIE-003 — Precedence resolution against the accepted closure Spec

Upon acceptance and merge of this Spec, for the NI `1.3.0 -> 1.4.0`
implementation delta only: `CTR-NIC-008`'s prohibition ceases to apply to
`validate.mjs` (its §4.2 `NOT_NECESSARY` classification being corrected by
DEC-NIE-002), and `DEC-NIC-003`'s "validate.mjs stays byte-identical" ruling is
superseded in operative effect to exactly the extent of CTR-NIE-002. This is an
explicit, open exercise of the `CTR-NIC-001` `OWNER_DECISION_REQUIRED` gate —
not a silent override and not a partial supersession of the accepted Spec's
remaining content. The accepted Spec's bytes are not modified by this
elaboration or its implementation (`CTR-NIC-008` continues to protect every
other `NOT_NECESSARY` file).

### CTR-NIE-004 — No expansion; evidence may not widen the closure

The implementation evidence (OBS-NIE-002/003) and this elaboration MUST NOT be
used to authorize any file beyond the 16-file set. `EXTRA_FILE_COUNT = 0`. A
`17th`-file need is a new `OWNER_DECISION_REQUIRED` event under a new authority.

### CTR-NIE-005 — Boundary contract for this round and the implementation

This round: docs-only — exactly this Spec file + one `docs/specs/README.md`
index row; PR #29 unchanged; no acceptance, merge, production apply, database
write, deploy, Principal/Client/secret/Grant creation or modification
(inherits `CTR-NIC-006`). The implementation PR remains DRAFT/NOT FOR MERGE
until this elaboration is accepted, merged, and independently reviewed; if PR
#29's head moves after `3c5b293`, the evidence coordinates in §2 are stale and
the 注册 审计 round must rebind them before any acceptance.

## 9. Acceptance mapping

### ACC-NIE-001 — Exact 16-file composition

- Contracts: `CTR-NIE-001`, `CTR-NIE-004`. Command: machine-compare the
  implementation PR file list against the frozen 16-file set (accepted §4.3 15
  + `validate.mjs`). Expected: exact equality; expected count = 16.

### ACC-NIE-002 — validate.mjs single-line boundary

- Contracts: `CTR-NIE-002`, `CTR-NIE-003`. Method: diff-level audit
  (`git diff --numstat` + full patch of `validate.mjs`). Expected: exactly
  1 insertion + 1 deletion; the changed line is the set literal; the resulting
  literal equals the six-element string in CTR-NIE-002; every other line
  byte-identical.

### ACC-NIE-003 — Two-sided validator gate (re-executed at review)

- Contracts: `CTR-NIE-002` (via `CTR-NIC-007`/`ACC-NIC-002` composition).
  Method: (a) omission side — candidate bundle with all other `1.4.0` deltas
  but the 15-file closure MUST fail `npm run contract:v1:validate` with
  `registry: first-wave Audience set changed` as the sole validator failure;
  (b) inclusion side — the 16-file implementation MUST yield
  `MINIMAL_AUTH_V1_BUNDLE_VALID=true` with blocker counts at pristine 1.3.0
  baseline parity (FREEZE 0 / PRODUCTION 1 / CONSUMER 2).
- Evidence note: both sides were executed and recorded at `3c5b293`
  (OBS-NIE-003); the 注册 审计 round re-executes rather than trusting the cite.

### ACC-NIE-004 — Full frozen validation surface (re-executed at review)

- Contracts: `CTR-NIE-001`. Commands: `npm run test:contract-v1` (45/45),
  candidate gate `npm run contract:v1:candidate && tsx --test
  tests/oauth/candidate-contract.test.ts` (22/22), `npm run test:oauth`
  (104/104), `npx tsc -p tsconfig.json --noEmit`, `git diff --check`.
  Expected: all pass with no closure-external file changed (counts are the
  recorded expectations at `3c5b293`; a count change without a file-list change
  must be explained in review, not waved through).

### ACC-NIE-005 — Round boundary and no-production audit

- Contracts: `CTR-NIE-005`. Method: audit this spec PR's diff and PR #29's
  immutability. Expected: spec PR touches exactly 2 files (this Spec + README
  index row); PR #29 head still `3c5b293`, still DRAFT/OPEN; no
  Principal/Client/secret/Grant change; no production apply anywhere.

## 10. Alternatives and disposition

### ALT-NIE-001 — Edit the accepted closure Spec in place

- Disposition: rejected
- Reason: accepted immutability (`SPEC_FORMAT_V0` §14.1); standing order "do not
  edit accepted authority to excuse the implementation"; the task dispatch
  forbids silent rewrite of accepted history.

### ALT-NIE-002 — Same-`spec_id` additive AMEND (§14.2)

- Disposition: rejected
- Reason: §14.2 preconditions require every accepted Decision unchanged;
  correcting the closure reverses operative `DEC-NIC-003`/`CTR-NIC-008`
  meaning, so the seam is legally unavailable (`CLM-NIE-003`).

### ALT-NIE-003 — Whole-Spec SUPERSEDE of the closure Spec

- Disposition: rejected
- Reason: disproportionate; the 15-file freeze, version rule, fixtures, and all
  other `CTR-NIC-*` remain valid and operative; only one bounded aspect
  changes, which a child elaboration expresses without orphaning accepted IDs.

### ALT-NIE-004 — Keep PR #29 blocked / ship 15 files only

- Disposition: rejected
- Reason: mechanically impossible; the first-wave set gate fails closed
  (`CLM-NIE-001`); the registration cannot pass its own frozen validator.

### ALT-NIE-005 — Merge PR #29 on implementation evidence alone

- Disposition: rejected
- Reason: `DEC-VL-003`/`DEC-NIC-001` precedent — already-written implementation
  cannot grant itself authority; the 16th file was frozen as
  `OWNER_DECISION_REQUIRED` and stays so until this elaboration is accepted.

## 11. Authority and lifecycle pass

```text
PARENT_PRECEDENCE = OK (parent NI CCR semantics untouched; accepted closure Spec composed, not amended)
STABLE_IDS = new NIE-* namespace only; zero reuse/renumbering of NI-*/NIC-* IDs
ACCEPTED_ID_REPURPOSING = NONE
PARTIAL_SUPERSESSION = NONE (CTR-NIE-003 declares the bounded precedence openly;
  no existing stable ID is narrowed, expanded, reversed, deleted, or reused)
BACKLINKS = this Spec -> accepted closure Spec / parent CCR / V2 / governance adoption
PROGRAM_TO_CHILD_LEAP = NONE (implementation authority only, and only after acceptance)
AUTHORITY_CONFLICT_AFTER_ACCEPTANCE = NONE (the single bounded conflict with
  DEC-NIC-003/CTR-NIC-008 w.r.t. validate.mjs is resolved openly by CTR-NIE-003)
OPEN_OWNER_DECISIONS = NONE (this Spec IS the owner-decision vehicle for the
  CTR-NIC-001 16th-file gate; accepting or rejecting it is the owner's call)
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (before acceptance: blocked-by-design;
  PR #29 stays DRAFT/NOT FOR MERGE)
```

## 12. Frozen summary

```text
AUTHORITY_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_CLOSURE_ELABORATION_V1
STATUS = proposed
SPEC_KIND = implementation
ELABORATES = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V1
  (accepted @ PR #27 / spec head 8ba603f; bytes untouched)
AUTHORIZATION_SEAM = CTR-NIC-001 OWNER_DECISION_REQUIRED (16th file)
IMPLEMENTATION_CLOSURE_COUNT = 16 (accepted 15 + elaborated 1)
VALIDATE_MJS_INCLUDED = YES
VALIDATE_MJS_CLASSIFICATION = PROVEN_NECESSARY (corrects §4.2 NOT_NECESSARY
  in a new ID; the accepted §4.2 row stays historical)
VALIDATE_MJS_ALLOWED_DELTA = single line (:395 set literal) gains exactly
  'agent-core-notification-ingress-v1'; everything else byte-identical
EXTRA_FILE_COUNT = 0
ACCEPTED_HISTORY_REWRITTEN = NO
PR_29_CHANGED = NO (this round; head stays 3c5b293, DRAFT, NOT FOR MERGE)
PR_29_MERGE_AUTHORIZED_NOW = NO (requires this Spec accepted + merged + 注册 审计)
PRODUCT_CODE_CHANGE = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
CLIENT_CREATED = NO / CLIENT_MODIFIED = NO
GRANT_CREATED = NO / GRANT_MODIFIED = NO
CREDENTIAL_CREATED = NO
MERGE_PERFORMED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 注册 审计
```

## 13. Authoring provenance

```text
AUTHORED_BY = 注册 执行 round (closure-elaboration authoring; ZCode)
AUTHORING_BASE = 51a11af57ce39eafac5883e0c32474ea06906b8e (github/main, docs-only worktree)
AUTHORING_MODE = spec-governance AUTHOR (docs-only; no product file touched)
EVIDENCE = read-only re-verification this round: PR #29 file list (16 = frozen
  15 + validate.mjs), validate.mjs 1-line diff + blob ids, registry 5->6
  Audience sets at main vs 3c5b293, gate text :394-395 on main, accepted §4.2
  row and §14 acceptance record, SPEC_FORMAT_V0 §14, agent-wake OBS-AW-009 /
  CTR-AW-007 precedent. Executed test-suite numbers (45/22/104/typecheck,
  two-sided validator result) are cited from the recorded PR #29 body and
  OBS-AW-009 evidence coordinates @3c5b293, NOT re-executed in this docs-only
  round; the 注册 审计 round re-executes them (ACC-NIE-003/004).
NEXT_TASK = 注册 审计
```
