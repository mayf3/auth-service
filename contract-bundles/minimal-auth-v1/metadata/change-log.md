# Change Log

## 1.8.0 — 2026-09-05

- CCR: `AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1` (accepted @
  0359575dd1481aa5e6c294a495fbaabce97e40bf, acceptance BATCHED EXACT-HEAD
  ACCEPTANCE = YES on 2026-09-05) — registered `agent-principal-resolution`
  into the Minimal Auth V1 Audience Registry per CTR-EAPR-001 as the
  machine-only OAuth registration for the exact active Agent Principal
  relation read (`GET /api/v1/agent-principals/:principal_id/agent`,
  CTR-EAPR-002..004). Implementation closure = the CTR-EAPR-006 allowed set
  (wake CTR-AW-005 recipe isomorphic; scheduler/session-messaging NI closure
  family).
- Frozen entry (field-by-field, per CTR-EAPR-001):
  `audience_id=agent-principal-resolution`, `resource_service=svc-auth`,
  `scope_namespace=auth`, `accepted_principal_types=["agent"]`,
  `human_access_enabled=false`, `machine_access_enabled=true`,
  `delegated_access_enabled=false`,
  `registered_scopes=["auth.agent.resolve"]`, `status=active`,
  `freeze_ready=true`.
- No wildcard/scope implication (CTR-EAPR-001): `auth.identity.provision`,
  generic admin, scheduler, `agent.session.send` and `agent.wake` do not
  satisfy `auth.agent.resolve`, or conversely; forbidden/unregistered set
  exercised by negative fixtures (`auth.identity.provision`,
  `agent.session.send`, invented `auth.agent.read`, `*`, `auth.*`, wrong
  audience, cross-Audience Grant reuse via svc-auth, emptied Grant, extra
  requested Scope, trailing-space / duplicate noncanonical wire, service /
  human / delegated-OBO profiles).
- Version judgment (CTR-EAPR-001): one additive minor advancement from the
  implementation-time `registry_version` `1.7.0`; no accepted reserved minor
  was pending → implementation value = `1.8.0`. Registry/manifest/fixtures
  promoted in place 1.7.0 → 1.8.0; no in-place disguise.
- Added ONE positive fixture `direct-agent-agent-principal-resolution` — a
  machine-only `principal_type=agent` Direct Machine positive fixture (RS256 +
  tracked fixture kid `fixture-key-v1-svc-okr-canary-20260719`,
  iss=auth-service, aud=agent-principal-resolution,
  agent_id=agent-principal-resolver,
  client_id=agent-client-principal-resolution, scope=`auth.agent.resolve`,
  exact requested-scope equality, grant subset `auth.agent.resolve`);
  compact_jwt machine-verified against
  `tests/fixtures/keys/svc-okr-canary-test-private.pem` with payload
  byte-identical to claims.
- Added 15 negative fail-closed cases (scheduler/NI family isomorphic plus
  the resolution-specific foreign literals): wrong audience
  `cross-agent-principal-resolution`, unregistered `auth.identity.provision`
  (the svc-auth management scope must not carry over), foreign-namespace
  `workflow.read`, cross-namespace `agent.session.send`, invented
  `auth.agent.read`, `*` wildcard, `auth.*` namespace wildcard, emptied
  Grant, extra requested Scope
  (`auth.agent.resolve auth.identity.provision`), cross-Audience Grant reuse
  (svc-workflow + workflow.read against this Audience's Grant-only fixture),
  trailing-space and
  duplicate noncanonical Scope wire, plus service / human / delegated-OBO
  profile rejection — every case rejected whole with its exact expected error
  code, no downscoping, no positive issuance in any negative phase.
- `validate.mjs` first-wave Audience set literal extended with
  `agent-principal-resolution` (8 → 9 entries; validator gate
  `registry: first-wave Audience set changed`) — the single allowed validator
  delta per CTR-EAPR-006 / CTR-AW-005(3) recipe.
- Version linkage: `contract_version` / `registry_version` promoted
  1.7.0 → 1.8.0 across manifest (incl. `audience_registry_version`), registry,
  manifest schema const, freeze gates, consumer matrix, positive/negative
  fixtures, schema instances, ADC scope map and llm-todo candidate; runtime
  allowlist (`src/lib/oauth/v1/contract.ts`) and candidate loader allowlist +
  the two version-expectation tests add/expect `1.8.0`
  (`LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, allowlist-only).
- No Grant created, modified or enlarged by this source change; the future
  HR read Grant `(HR clientId, agent-principal-resolution,
  auth.agent.resolve)` is prepared only by the controlled
  plan/apply/verify vehicle and stays gated by CTR-EAPR-007; no
  Principal/Client/secret created; no production apply, deploy or database
  change (`PRODUCTION_MUTATION = NONE`).

## 1.7.0 — 2026-09-03

- CCR: `AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1` (accepted @
  687c3b1eb3c671b1b4edf343fe96c07e9f00f92a lineage, PR #42) — registered
  `scheduler` into the Minimal Auth V1 Audience Registry as the auth-service
  root authority of the downstream dsh-agent-core scheduler deployment chain
  (scope semantics anchored on accepted
  `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1` §R8 and consumed by proposed
  `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`, cited as context only) —
  implementation closure = the CTR-SCH-004 frozen 16-file set (NI closure V2
  CTR-NIC2-001 / session-messaging CTR-ASM-004 isomorphic,
  `EXTRA_FILE_COUNT = 0`).
- Frozen entry (field-by-field, per CTR-SCH-001):
  `audience_id=scheduler`, `resource_service=scheduler`,
  `scope_namespace=scheduler`, `accepted_principal_types=["agent"]`,
  `human_access_enabled=false`, `machine_access_enabled=true`,
  `delegated_access_enabled=false`,
  `registered_scopes=["scheduler.admin","scheduler.audit"]`,
  `status=active`, `freeze_ready=true`.
- Forbidden set unchanged and unregistered (CTR-SCH-002): every manage-any
  wire form (`scheduler.manage-any`, `scheduler.manage:any`), the local labels
  `scheduler.read:self` / `scheduler.manage:self`, any global
  job-definition-read literal (`scheduler.read`, `scheduler.read:all` or any
  new literal — R8 freezes that no such scope exists), aliases such as
  `scheduler.audit.read`, `*` / `scheduler.*` wildcards, any other namespace
  (`workflow.*` / `forum.*` / `notification.*` / `okr.*` / `adc.*` / `auth.*`
  / `agent.*`), and human / service / delegated access. `scheduler.admin`
  (job-definition mutation/control) and `scheduler.audit` (global/foreign
  execution history read) are mutually non-implying; each carries no
  semantics beyond its literal.
- Version judgment (CTR-SCH-005): single additive minor promotion based on the
  implementation-time `registry_version`. `1.4.0` was OCCUPIED by the landed
  NI closure; `1.5.0` is RESERVED by accepted
  `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` (version not yet occupied);
  `1.6.0` was OCCUPIED by the sibling session-messaging implementation (merged
  ahead of this round) → implementation value = `1.7.0` (skip of
  accepted-reserved and sibling-occupied versions per DEC-SCH-002).
  Registry/manifest/fixtures promoted in place 1.6.0 → 1.7.0; no in-place
  disguise.
- Added TWO positive fixtures (both machine-only `principal_type=agent`
  Direct Machine, RS256 + tracked fixture kid
  `fixture-key-v1-svc-okr-canary-20260719`, iss=auth-service, aud=scheduler,
  exact requested-scope equality, grant subset, per CTR-SCH-006 "one per
  scope"): `direct-agent-scheduler-admin` (agent_id=agent-scheduler-admin,
  scope=`scheduler.admin`, grant subset `scheduler.admin`) and
  `direct-agent-scheduler-audit` (agent_id=agent-scheduler-auditor,
  scope=`scheduler.audit`, grant subset `scheduler.audit`) — distinct least-
  privilege principals, one per scope per DEC-SCH-001. compact_jwt signatures
  machine-verified against `tests/fixtures/keys/svc-okr-canary-test-private.pem`
  with payload byte-identical to claims.
- Added 19 negative fail-closed cases (NI / session-messaging family
  isomorphic plus the scheduler-specific forbidden literals): service
  principal rejected, human access rejected, delegated/OBO rejected, unknown
  audience `cross-agent-scheduler`, foreign-namespace `workflow.read`,
  manage-any wire forms `scheduler.manage-any` (unregistered) and
  `scheduler.manage:any` (non-conforming wire), local labels
  `scheduler.read:self` and `scheduler.manage:self` (non-conforming wire),
  global-read literal `scheduler.read` (unregistered — R8 freezes that no
  global job-definition-read scope exists), alias `scheduler.audit.read`
  (unregistered), `*` wildcard, `scheduler.*` namespace wildcard, emptied
  (missing) Grant, over-scope request (`scheduler.admin scheduler.audit`
  against an admin-only Grant — representable because this Audience has two
  registered Scopes), cross-Audience Grant reuse (svc-workflow + workflow.read
  with no such Grant), extra requested Scope
  (`scheduler.admin scheduler.audit.read`), noncanonical double-space wire,
  duplicate Scope items — every case rejected whole with its exact expected
  error code, no downscoping, no positive issuance in any negative phase.
  Dedicated DB/registry-mismatch cases are structurally unrepresentable in
  the Bundle fixture harness (fail-closed `audience_registry_mismatch` /
  `machine_grant_state_invalid` live in the runtime Grant lookup, not in the
  fixture validator); `SCOPE_OUTPUT_MISMATCH`-shaped requested sets fail
  earlier as `INVALID_SCOPE_NAMESPACE` (extra-requested-scope case).
- `validate.mjs` first-wave Audience set literal extended with `scheduler`
  (7 → 8 entries; validator gate `registry: first-wave Audience set changed`)
  — the single allowed validator delta per CTR-SCH-005(4).
- Version linkage: `contract_version` / `registry_version` promoted
  1.6.0 → 1.7.0 across manifest (incl. `audience_registry_version`), registry,
  manifest schema const, freeze gates, consumer matrix, positive/negative
  fixtures, schema instances, ADC scope map and llm-todo candidate; runtime
  allowlist (`src/lib/oauth/v1/contract.ts`) and candidate loader allowlist +
  the two version-expectation tests add/expect `1.7.0`
  (`LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, allowlist-only).
- No Grant created, modified or enlarged (CTR-SCH-007 descriptive only; the
  future single disposable-source-agent Grant + terminal compensation is a
  downstream, separately authorized round); no Principal/Client/secret
  created; no product-code change beyond the frozen allowlist literals; no
  production apply, deploy or database change (CTR-SCH-009; AuthAudience data
  row creation remains a separate operator backfill round, OBS-SCH-007).

## 1.6.0 — 2026-09-03

- CCR: `AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1` (accepted @
  e5a1b8b5ea7801ac9aa6d7fd1170ffa7c5d654e6, PR #41) — registered
  `agent-session-messaging` into the Minimal Auth V1 Audience Registry as the
  auth-service root authority of the downstream
  `AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1` (dsh-agent-core) chain —
  pinned by its CTR-DEP-002 as the Phase-A accepted prerequisite; implementation
  closure = the CTR-ASM-004 frozen 16-file set (NI closure V2
  CTR-NIC2-001 isomorphic, `EXTRA_FILE_COUNT = 0`).
- Frozen entry (field-by-field, per CTR-ASM-001):
  `audience_id=agent-session-messaging`,
  `resource_service=agent-session-messaging`, `scope_namespace=agent`,
  `accepted_principal_types=["agent"]`, `human_access_enabled=false`,
  `machine_access_enabled=true`, `delegated_access_enabled=false`,
  `registered_scopes=["agent.session.send"]`, `status=active`,
  `freeze_ready=true`.
- Forbidden set unchanged and unregistered (CTR-ASM-002): `agent.session.read`,
  `agent.session.*`/wildcards, `agent.wake`, `agent.definition.write`, any
  `workflow.*` / `forum.*` / `scheduler.*` / `notification.*` / `okr.*` /
  `adc.*` / `auth.*` new literal, human or delegated access. `agent.session.send`
  carries no semantics beyond send.
- Version judgment (CTR-ASM-005): additive minor promotion based on the
  implementation-time `registry_version`. `1.4.0` was already OCCUPIED by the
  landed NI closure; `1.5.0` is RESERVED by accepted
  `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` (its implementation PR #37
  still draft, version not yet occupied) → implementation value = `1.6.0`
  (skip of accepted-reserved versions per DEC-ASM-002). Registry/manifest/
  fixtures promoted in place 1.4.0 → 1.6.0; no in-place disguise.
- Added positive fixture `direct-agent-session-messaging` — a machine-only
  `principal_type=agent` Direct Machine positive fixture (RS256 + tracked
  fixture kid `fixture-key-v1-svc-okr-canary-20260719`, iss=auth-service,
  aud=agent-session-messaging, agent_id=agent-session-messenger,
  client_id=agent-client-session-messaging, scope=`agent.session.send`, exact
  requested-scope equality, grant subset `agent.session.send`).
- Added 11 negative cases (NI family isomorphic): service principal,
  human principal, delegated/OBO, wrong audience (`agent-session-send`),
  wrong-namespace `session.send`, alias `agent.session.read`, `*` wildcard,
  `agent.*` namespace wildcard, emptied (over-scope) Grant, cross-Audience
  Grant reuse (svc-workflow + workflow.read with no such Grant), extra
  requested Scope (`agent.session.read agent.session.send`) — every case
  rejected whole, no downscoping, no positive issuance in any negative phase.
  Dedicated DB/registry-mismatch cases are structurally unrepresentable in the
  Bundle fixture harness (fail-closed `audience_registry_mismatch` /
  `machine_grant_state_invalid` live in the runtime Grant lookup, not in the
  fixture validator); `SCOPE_OUTPUT_MISMATCH` cases are structurally
  unnecessary for this Audience: with exactly one registered Scope, exact
  requested/issued equality plus strict registration makes a valid-but-
  different requested set unrepresentable; mismatch-shaped requests fail
  earlier as `INVALID_SCOPE_NAMESPACE` (extra-requested-scope case).
- `validate.mjs` first-wave Audience set literal extended with
  `agent-session-messaging` (6 → 7 entries; validator gate
  `registry: first-wave Audience set changed`) — the single allowed validator
  delta per CTR-ASM-005(4).
- Version linkage: `contract_version` / `registry_version` promoted
  1.4.0 → 1.6.0 across manifest (incl. `audience_registry_version`), registry,
  manifest schema const, freeze gates, consumer matrix, positive/negative
  fixtures, schema instances, ADC scope map and llm-todo candidate; runtime
  allowlist (`src/lib/oauth/v1/contract.ts`) and candidate loader allowlist +
  the two version-expectation tests add/expect `1.6.0`
  (`LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, allowlist-only).
- No Grant created, modified or enlarged (CTR-ASM-007 descriptive only; future
  single disposable-source Grant + terminal compensation is downstream
  CTR-DEP-006, separately authorized); no Principal/Client/secret created; no
  product-code change beyond the frozen allowlist literals; no production
  apply, deploy or database change (CTR-ASM-009; AuthAudience data row creation
  remains a separate operator backfill round).
## 1.5.0 — 2026-08-29

- Spec: `AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` (accepted; whole-successor
  of `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`,
  `AUTH_SERVICE_SVC_FORUM_VERSION_LINKAGE_V1` and
  `AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1`; PR #34 @
  325e781) — the sole semantic increment is registering `forum.moderate` for
  `svc-forum` (CTR-FMG-002/DEC-FMG-001), based on the merged conformant
  `1.4.0` notification-ingress result (CTR-FMG-015).
- `svc-forum.registered_scopes` = exactly
  `["forum.moderate","forum.read","forum.write"]`; every other Audience entry
  and Scope stays byte-identical. `forum.admin`, `forum.*`, `*` and any other
  Scope remain unregistered (negative fixtures retained, CTR-FMG-002).
- Added positive fixture `direct-agent-svc-forum-moderator` (RS256 + tracked
  fixture kid, iss=auth-service, aud=svc-forum, principal_type=agent,
  agent_id=agent-forum-moderator, scope="forum.moderate forum.read
  forum.write", exact requested-scope equality, grant subset). Removed the
  obsolete negative case `direct-svc-forum-unregistered-scope-moderate` —
  `forum.moderate` is registered at 1.5.0, so that case is semantically
  unrepresentable; the `forum.admin`, `*` and `forum.*` negative cases remain.
- Consumer evidence re-pinned per Spec §3.1:
  `mayf3/agent-forum@502cfca5a180d6c49fe75dfc270fd117f279ccfb` (tree
  `cc7e38363297bf4b7339e0c88d9f2869e9df1cde`, `origin/main`,
  `fixed_remote_sha=true`, migration_status stays `completed`) — the deployed
  consumer that enforces `forum.moderate` on pin/feature, soft-delete, report
  queue/handling and admin-unread routes (OBS-FMG-005); resolve/archive remain
  server-`forum.write`.
- Grant supply implementation (CTR-FMG-014 closed 18-file closure, files
  16–18): `scripts/supply-forum-moderator-grant-v1.ts`,
  `scripts/run-forum-moderator-grant-supply-v1-conformance.sh`,
  `tests/oauth/supply-forum-moderator-grant-v1.test.ts` — canonical
  APPLY/EXACT_RERUN_NOOP plan documents with SHA-256 digests (CTR-FMG-003),
  one Serializable transaction updating only the `svc-forum` audience
  registered_scopes plus the exact Client's Grant 1→2 with the closed 13-field
  `grant_change_audits` envelope (CTR-FMG-004/007/010), exact rerun NOOP and
  fail-closed conflict semantics (CTR-FMG-008/009), reviewed non-target Grant
  digest binding, read-only `OUTCOME_UNKNOWN` reconciliation with no blind
  retry, and the exact frozen identity tuple `agt_course-community-agent-2` /
  `9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56` /
  `mc_hvEfjkJ5BTKA8HZXRmbzNVw0` (CTR-FMG-001). `PRODUCTION_APPLY_AUTHORITY = none` — `--apply` refuses
  before any database connection (CTR-FMG-016); the legacy OpenClaw
  `mc_oc_*` family is never queried, resolved or mutated (CTR-FMG-013).
- Version linkage: `contract_version` / `registry_version` promoted
  1.4.0 → 1.5.0 across manifest, registry, manifest schema const, freeze gates,
  consumer matrix, positive/negative fixtures, schema instances, ADC scope map
  and llm-todo candidate; runtime allowlist (`src/lib/oauth/v1/contract.ts`)
  and candidate loader allowlist + the two version-expectation tests add/expect
  `1.5.0` (`LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, allowlist-only).
- No Grant created, modified or enlarged by this source change
  (CTR-FMG-015: source merge creates no database change); no
  Principal/Client/secret created; no production apply, deploy or database
  change.

## 1.4.0 — 2026-08-24

- CCR: `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1` (accepted)
  implemented via `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2`
  (accepted; exact 16-file closure authority; whole-Spec successor to
  `IMPLEMENTATION_CLOSURE_V1`, which is superseded by it) — registered
  `agent-core-notification-ingress-v1` into the Minimal Auth V1 Audience Registry.
- Frozen entry (field-by-field, per CTR-NI-001 / CTR-NIC-002):
  `audience_id=agent-core-notification-ingress-v1`,
  `resource_service=agent-core-notification-ingress-v1`,
  `scope_namespace=notification`, `accepted_principal_types=["service"]`,
  `human_access_enabled=false`, `machine_access_enabled=true`,
  `delegated_access_enabled=false`, `registered_scopes=["notification.deliver"]`,
  `status=active`, `freeze_ready=true`.
- `notification.send`, `notification.*`, wildcard and any other Scope remain
  unregistered (forbidden set, CTR-NI-003).
- Added positive fixture `direct-service-notification-ingress` — the first
  `principal_type=service` Direct Machine positive fixture (RS256 + tracked
  fixture kid, iss=auth-service, aud=agent-core-notification-ingress-v1, no
  `agent_id`, scope=notification.deliver, exact requested-scope equality,
  grant subset notification.deliver).
- Added 11 negative cases: agent principal, human principal, delegated/OBO,
  wrong audience, `auth.identity.provision` foreign scope, unregistered
  `notification.send`, `*` wildcard, `notification.*` namespace wildcard,
  grant-exceeding request, cross-Audience Grant reuse (svc-auth +
  auth.identity.provision), extra requested Scope — every case rejected whole,
  no downscoping. Dedicated `SCOPE_OUTPUT_MISMATCH` cases are structurally
  unnecessary for this Audience: with exactly one registered Scope, exact
  requested/issued equality plus strict registration makes a valid-but-different
  requested set unrepresentable; mismatch-shaped requests fail earlier as
  `INVALID_SCOPE_NAMESPACE` (extra-requested-scope case).
- `validate.mjs` first-wave registry set literal extended with
  `agent-core-notification-ingress-v1` (validator gate
  `registry: first-wave Audience set changed`). NOTE: this file is OUTSIDE the
  accepted Child Spec's frozen 15-file closure and is carried under
  `OWNER_DECISION_REQUIRED` drift reporting — see PR description; omission makes
  the validator fail closed while all other gates pass.
- Version linkage: `contract_version` / `registry_version` promoted
  1.3.0 → 1.4.0 across manifest, registry, manifest schema const, freeze gates,
  consumer matrix, positive/negative fixtures, schema instances, ADC scope map
  and llm-todo candidate; runtime allowlist (`src/lib/oauth/v1/contract.ts`) and
  candidate loader allowlist + the two version-expectation tests add/expect
  `1.4.0` (`LIMITED_RUNTIME_COMPATIBILITY_CHANGE`, allowlist-only).
- No Grant created, modified or enlarged (CTR-NI-004/CTR-NIC-006); no
  Principal/Client/secret created; no product-code change beyond the frozen
  allowlist literals; no production apply, deploy or database change.

## 1.3.0 — 2026-08-21

- CCR: `AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1`（accepted）— registered `svc-forum`
  into the Minimal Auth V1 Audience Registry; absorbed the pre-CCR authority drift
  in the executable artifacts (`audience-registry.json`, `contract-manifest.json`,
  `consumer-verification-matrix.json`, `validate.mjs`) that lacked a normative
  parent-contract amendment.
- Parent contract AMEND: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` §2
  moves `svc-forum` from the exclusion list into the Bundle Audience list;
  `docs/contracts/minimal-auth-v1/v0-to-v1-migration.md` §6 removes `svc-forum`
  from the Legacy/unmigrated set. `llm-todo` / `workflow-todo` exclusions unchanged.
- Frozen entry (field-by-field, per CTR-FR-002):
  `audience_id=svc-forum`, `resource_service=svc-forum`, `scope_namespace=forum`,
  `accepted_principal_types=["agent"]`, `human_access_enabled=false`,
  `machine_access_enabled=true`, `delegated_access_enabled=false`,
  `registered_scopes=["forum.read","forum.write"]`, `status=active`,
  `freeze_ready=true`, `notes="Registered by AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1;
  machine-only agent access via standard OAuth2 client_credentials."`.
- `forum.admin`, `forum.moderate`, `forum.*`, `*` and any other scope remain
  unregistered (forbidden set, CTR-FR-004).
- Added positive fixture `direct-agent-svc-forum` (RS256 + kid, iss=auth-service,
  aud=svc-forum, principal_type=agent, agent_id present,
  scope="forum.read forum.write"; signed with the existing tracked test-only
  fixture key `fixture-key-v1-svc-okr-canary-20260719`).
- Added negative cases: `forum.admin` / `forum.moderate` / `*` / `forum.*`
  scope rejection, wrong aud (`agent-forum`), wrong issuer, missing `agent_id`,
  plus `compact-jwt-unknown-kid-svc-forum` signature case.
- `validate.mjs`: Direct Machine fixtures with `principal_type=agent` now require
  a non-empty `agent_id` (closes the fixture-validator gap for the consumer-side
  CR-06 requirement; no new fixture semantics introduced).
- Consumer Verification Matrix update: svc-forum entry re-pinned from the drift-era
  `cb7ca300…` (`feat/svc-forum-standard-oauth`) to the reviewed exact commit
  `mayf3/agent-forum@1cccdd54554c0bde13572273401f19f294334e46`
  (tree `7ee57577f3d1cbe5aa83cc2c2ead9ee7ce88f99d`, `origin/main`,
  `fixed_remote_sha=true`); `migration_status` → `completed` records the passed
  exact-commit consumer migration review — not a production cutover claim
  (first-wave aggregate stays not ready; production deployment stays not_ready).
- Version linkage: `contract_version` / `registry_version` promoted 1.2.0 → 1.3.0
  across manifest, registry, freeze gates, consumer matrix, positive/negative
  fixtures, schema instances, ADC scope map and llm-todo candidate; manifest
  dangling `audience_registry_version` aligned to 1.3.0 (OQ-FR-003).
- No Grant created, modified or enlarged (CTR-FR-008); no product-code change.

## 1.2.0 — 2026-07-22

- Registered `svc-okr.registered_scopes=["okr.read", "okr.write"]`.
- Added coarse-grained `okr.write` scope for svc-okr write API access.
- No product_role claims: `PRODUCT_ROLES_IN_TOKEN=false` remains enforced.
- Updated frozen runtime contract with new digest.
- Added conformance: agent + okr.read + okr.write issues RS256 JWT.

## 1.1.0 — 2026-07-20

- CCR: Enabled svc-okr Agent machine access via Draft Contract Candidate.
- Added `agent` to `svc-okr.accepted_principal_types`.
- Set `svc-okr.machine_access_enabled=true`.
- Registered `svc-okr.registered_scopes=["okr.read"]`.
- Added `direct-agent-svc-okr` positive fixture and 5 negative fixture cases.
- Updated Consumer Verification Matrix: svc-okr kind → `human-and-machine-resource-consumer`.
- All scopes, grants, audience definitions remain otherwise unchanged.
- `PRODUCT_ROLES_IN_TOKEN=false` remains enforced.
- `okr.write` and `okr.admin` remain unregistered.

## 1.0.0 — 2026-07-18

- Recorded the independent remote-object review PASS for draft.2 at commit
  `62ad3ec89c52e0fc4936279c23d2346706b948fa` and tree
  `9347e9297fefaad7bcd0347637336df0c39bc03c`.
- Closed the only remaining Contract Bundle Freeze gate and promoted the
  Manifest, Registry, schemas and fixtures to frozen source contract `1.0.0`.
- Authorized implementation against the frozen source Bundle while retaining
  Production Deployment as `NOT_READY` and Consumer Migration as
  `NOT_STARTED`.
- Kept the production exact JWKS URL `null`; no hostname, certificate, route or
  live deployment is asserted by this release.
- Kept all out-of-scope Legacy consumer migration gates deferred and
  non-blocking for source Bundle Freeze.
- Corrected the Bundle README lifecycle field to
  `lifecycle.contract_bundle_freeze.status`.

## 1.0.0-draft.2 — 2026-07-18

- Split lifecycle reporting into independent Contract Bundle Freeze,
  Production Deployment and Consumer Migration states.
- Limited the first-wave Bundle and conformance inventory to `auth-service`,
  `svc-workflow`, `svc-okr` and `adc-v2`; retained `svc-forum`,
  `workflow-todo` and `llm-todo` as non-blocking Legacy migration records.
- Froze the JWKS path, RS256/`kid`, issuer/audience, cache, key-retention and
  fail-closed behavior without inventing a production hostname or URL.
- Restored the V0 Token Exchange request field `audience` and added explicit
  success/rejected Exchange Audit variants with a required `result`.
- Bound no-downscope fixtures to an independent `requested_scope` and added
  concrete partial-grant and output-mismatch rejection cases.
- Added public-only JWKS fixtures and real compact-JWT RS256 verification,
  including invalid-signature, algorithm-confusion and unknown-`kid` cases.
- Added a Contract Manifest schema plus strict Draft 2020-12 meta-schema and
  representative instance validation for all Bundle schemas.
- Moved real-process Human Session/Refresh conformance after implementation;
  it no longer blocks the initial source Contract Bundle Freeze.

## 1.0.0-draft.1 — 2026-07-18

- Created an explicitly non-frozen machine-executable Bundle.
- Preserved V0 machine wire claims: `client_id`, `jti`, `nbf`, Direct
  `token_use=access` and OBO `token_use=workflow_obo`.
- Added Human, Direct Machine and Delegated Access Token schemas.
- Separated Human Audience, Machine Access and Delegation Grants.
- Added strict no-downscope Scope rules and fixtures.
- Added accepted source audiences, trusted proxy and persistent exchange audit
  schemas.
- Added Human Session, opaque Refresh Credential and replay-family revocation
  schemas.
- Defined Authorization Code + PKCE S256 as the only first-bundle Human Client
  binding flow; both public and confidential clients use PKCE.
- Defined first-bundle Grant administration as versioned, audited, optimistic,
  forward-only database migrations with no online Grant management endpoint.
- Froze candidate Authorization Code and Refresh Credential opaque wire formats,
  Human refresh request/response shapes, OAuth error status mapping and cache
  headers for review.
- Closed the runtime-parameter review gate after checking the candidate values
  against V0 compatibility, derived retention bounds and current IETF security
  guidance; the deployment-specific exact JWKS URL remains open.
- Replaced the over-broad candidate `adc.invoke` with `adc.read` and
  `adc.execute`, added a fixed-SHA route/exchange map and closed the ADC ingress
  Scope review gate.
- Added a full llm-todo route-group authorization candidate using
  `todo.read/write/invoke/admin`; kept its freeze gate open for explicit product
  decisions that cannot be recovered from permissive Legacy code.
- Recorded live deployment evidence that the default IP certificate is
  self-signed without SAN and the public/backend JWKS routes are not live; kept
  the exact JWKS URL gate open for a deployment-owner-provided trusted origin.
- Corrected resource topology to `svc-forum` and `llm-todo`; retained
  `workflow-todo` as a Client, not an Audience.
- Recorded unresolved deployment, consumer SHA and scope decisions as freeze
  gates rather than guessing frozen values.
