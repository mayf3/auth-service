---
spec_id: AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
  - forum moderator Grant supply vehicle Bundle compatibility rebind (mechanical version pin only)
governed_by:
  - AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1
external_authorities: []
supersedes:
  - AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V2

> **PROPOSED — DOCS ONLY.** This amendment authorizes no implementation of a
> production apply, no database write, no deployment, and no change to the
> moderator identity tuple, scope sets, transaction semantics, or authority
> model. `PRODUCTION_APPLY_AUTHORITY = none` is inherited unchanged from the
> parent Spec. While proposed, the only effect of this PR is the mechanical
> compatibility rebind of the FMG execution vehicle's Bundle pin.

## 1. Goal

Mechanically rebind the accepted forum-moderator Grant supply vehicle
(`scripts/supply-forum-moderator-grant-v1.ts` + its test + conformance harness
precondition) from Bundle `1.8.0` to the currently authoritative Bundle
`1.11.0`, so that the vehicle's pre-connection Bundle identity gate accepts the
exact runtime/staged Bundle that production runs today:

```text
PARENT = AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1 (accepted, unmodified)
PRIOR_PIN_AMENDMENT = AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1
DELTA  = BUNDLE_CONTRACT_VERSION pin 1.8.0 -> 1.11.0 (three files, mechanical)
```

The vehicle currently refuses every invocation (including read-only plan)
against the deployed Bundle:

```text
FMG refused: running/staged Bundle identity must be exactly 1.8.0 (observed 1.11.0)
```

This rebind restores the intended state: the vehicle executes (plan / conformance /
verify) against the current authoritative Bundle, and a future separately
authorized production-apply round (CTR-FMG-016) can bind an exact
authorization against it.

## 2. Scope and non-goals

In scope (exactly three files plus this Spec document and its index row):

- `scripts/supply-forum-moderator-grant-v1.ts` — `BUNDLE_CONTRACT_VERSION`
  constant `1.8.0` -> `1.11.0` + provenance comment;
- `tests/oauth/supply-forum-moderator-grant-v1.test.ts` — the two
  `bundle_version` authorization-descriptor fixture values `1.8.0` -> `1.11.0`;
- `scripts/run-forum-moderator-grant-supply-v1-conformance.sh` — the runtime
  Bundle precondition constant `"1.8.0"` -> `"1.11.0"`;
- `docs/specs/AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V2.md`
  (this document) + its `docs/specs/README.md` index row.

Non-goals: no audience-registry change, no scope literal change, no moderator
identity change, no Grant v1->v2 semantics change, no audience+grant atomicity
change, no Serializable/lock/advisory-key change, no 13-field audit envelope
change, no plan-digest or NOOP semantics change, no conflict-matrix change, no
rollback semantics change, no CTR-FMG-016 production-apply authority change,
no re-design or extension of the Grant-only prestate classification (the
RETARGET_V1 delta stands as accepted), and no `mayf3/agent-forum` or
`mayf3/dsh-agent-core` change. No production mutation of any kind.

## 3. Semantic delta declarations

```text
CAN_THIS_BE_CLASSIFIED_AS_MECHANICAL_VERSION_REBIND = YES
PRODUCT_SEMANTIC_DELTA = NONE
PERMISSION_SEMANTIC_DELTA = NONE
TRANSACTION_SEMANTIC_DELTA = NONE
FMG_TRANSACTION_SEMANTICS_CHANGED = NO
TARGET_SCOPES_CHANGED = NO
SOURCE_SCOPES_CHANGED = NO
IDENTITY_CHANGED = NO
AUDIT_ENVELOPE_CHANGED = NO
CTR_FMG_016_CHANGED = NO
```

Registry-invariance evidence: the svc-forum audience entry is canonical-JSON
byte-identical between the Bundle `1.8.0`-era tree (deployed
`production-auth-service-a8055565…`, canonical sha256 `14763850c3b5b1e8…`) and
the Bundle `1.11.0` tree (BASE `1de2311e…`), i.e. the rebind crosses no
FMG-relevant registry change:

```text
REGISTRY_ENTRY_SVC_FORUM_SHA256_1_8_0 = 14763850c3b5b1e8... (canonical JSON)
REGISTRY_ENTRY_SVC_FORUM_SHA256_1_11_0 = 14763850c3b5b1e8... (canonical JSON, equal)
```

The intermediate Bundle versions (`1.9.0`, `1.10.0`) registered
`agent-principal-resolution`, scheduler-adjacent and identity-directory
audiences without touching the svc-forum entry; the deployed production
lineage (including `2cf27a64…`, an ancestor of BASE) has carried the
`[forum.moderate, forum.read, forum.write]` svc-forum registry entry since
Bundle `1.8.0`.

## 4. Base and provenance

```text
BASE_COMMIT = 1de2311e22df2308ecb7cd400d73a21883223a95 (fresh github/main)
BASE_BUNDLE_CONTRACT_VERSION = 1.11.0
DEPLOYED_PRODUCTION_GENERATION = production-auth-service-2cf27a64… (Bundle 1.11.0, runtime snapshot 2026-09-08T05:26:03Z)
```

## 5. Validation gates

All must PASS on the amendment Head before independent audit:

1. `npm run contract:v1:validate` — bundle still valid, unchanged by this PR;
2. `scripts/run-forum-moderator-grant-supply-v1-conformance.sh` — end-to-end
   conformance against a disposable conformance PostgreSQL (plan -> apply ->
   exact-rerun NOOP -> verify-state, all on the disposable fixture DB); this
   harness is the only supported invocation of
   `tests/oauth/supply-forum-moderator-grant-v1.test.ts` (the suite reads its
   FIFO descriptor arguments at module scope and is not standalone-runnable);
3. `npx tsc --noEmit` — clean;
4. `git diff --check` — clean;
5. git status = EXACTLY the five in-scope files (three code + this Spec +
   README row); no production write; no credential material in the diff.

## 6. Lifecycle

Acceptance of this amendment binds its exact independently reviewed Head and
flips `status: accepted` in the lifecycle-only acceptance transaction, with the
superseded `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1`
frontmatter backlink updated in the same commit. CTR-FMG-016 remains fully in
force: the production apply stays a separately authorized round requiring its
own exact authorization descriptor (implementation commit of the
apply-authorized build, Bundle digest, APPLY-plan digest, pre-state
snapshot/digest, operator, outage approval, stop/start commands, rollback
reference, and state-verification command).
