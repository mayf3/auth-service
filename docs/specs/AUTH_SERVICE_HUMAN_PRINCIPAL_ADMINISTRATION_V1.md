---
spec_id: AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
  - human-principal-administration
  - human-principal-directory
  - human-principal-status-lifecycle
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V2
    revision: 187ae8a1f6db852751d05c4432ed84f6f78df97e
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1

```text
SPEC_ID = AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1
SPEC_STATUS = proposed
SPEC_KIND = implementation
IMPLEMENTATION_AUTHORITY = contracts
AUTHORING_BASE = 36a11136745bae7a371d21ba62d9617942c41afa
AUTHORITY_ACTION = NEW
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V1
PROPOSED_PARENT_SUCCESSOR = MINIMAL_AUTH_FOUNDATION_V2
PARENT_SUCCESSOR_PR = #7
PARENT_SUCCESSOR_PENDING = YES
PRODUCT_IMPLEMENTATION_AUTHORIZED = NO
CONFORMANCE_PENDING = YES
```

## 1. Goal

Freeze a bounded Human/User Principal management plane in `mayf3/auth-service` that can:

1. create a new User Principal in a safe disabled-first state or claim an existing User Principal without taking over its credentials;
2. return canonical User identity and current status;
3. expose a least-privilege, non-sensitive Human Principal directory;
4. disable and enable a Human Principal under explicit lifecycle rules;
5. enforce separate read, write, emergency-disable, request, approval, and deterministic-finalization boundaries;
6. make approval, durable audit, idempotency, conflict, concurrency, and `outcome_unknown` first-class behavior; and
7. provide trustworthy Principal facts to a future `svc-workflow` Root authority without owning the repository-governance mapping from `mayf3` to a Principal UUID.

```text
CREATE_NEW_USER_PRINCIPAL = SUPPORTED_DISABLED_FIRST
CLAIM_EXISTING_USER_PRINCIPAL = SUPPORTED
AUTH_SERVICE_IS_PRINCIPAL_AUTHORITY = YES
REPOSITORY_OWNER_MAPPING_OWNER = mayf3/svc-workflow
ROOT_MAPPING_WRITE_AUTHORIZED_BY_THIS_SPEC = NO
```

Success means an implementation can be rejected for leaking identity or credential data, trusting a body actor, bypassing approval, reusing machine provisioning authority, ambiguously retrying a commit, resurrecting old Human authority on enable, or writing the repository mapping.

## 2. Scope and non-goals

### 2.1 In scope

- Human/User Principal create-disabled and controlled existing-User claim;
- one-User canonical read and a paginated Human-only directory;
- User `active | disabled` status transitions;
- dedicated management authorization, exact additive `svc-auth` scope registration, and one-time forward bootstrap of least-privilege Scope Grants and machine control-plane assignments;
- approval records and deterministic finalization;
- immutable durable administration audit;
- idempotency, concurrency, conflict, and uncertain-commit reconciliation;
- bounded external identity evidence metadata;
- compatibility constraints for existing Human authentication, Session, Refresh, Access Token, and machine Principal behavior.

### 2.2 Out of scope

This Spec MUST NOT authorize or define:

- password, passkey, MFA, Client Secret, private key, Authorization Code, Session, Refresh Credential, Access Token, ID Token, or any other credential creation as part of Principal administration;
- Token signing, Token claims, RS256/JWKS changes, Human OBO, Agent OBO, or delegation changes;
- runtime administration of Human Client, Machine Client, Grant, Scope, Audience, product role, product assignment, Domain membership, or workflow permission; the only Scope delta is the exact additive `svc-auth` registration in §3.2;
- Agent or Service Principal provisioning or lifecycle changes;
- email, phone, Feishu identity, employee identity, unrestricted external identity documents, or other sensitive identity data as directory fields;
- creation, acceptance, or persistence of `mayf3 -> Principal UUID` in auth-service;
- creation or acceptance of `SVC_WORKFLOW_GLOBAL_PERMISSION_GOVERNANCE_ROOT_V1`;
- production data changes, migration execution, deployment, acceptance, or merge by this proposed document.

## 3. Authority and dependencies

### 3.1 Active parent and pending successor

```text
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V1
ACTIVE_LOCAL_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V1
PROPOSED_PARENT_SUCCESSOR = MINIMAL_AUTH_FOUNDATION_V2
PARENT_SUCCESSOR_PR = #7
PARENT_SUCCESSOR_STATE = OPEN
PARENT_SUCCESSOR_DRAFT = YES
PARENT_SUCCESSOR_STATUS = proposed
PARENT_SUCCESSOR_PENDING = YES
```

PR #7 proposes a whole-authority successor but is unmerged and inactive. Therefore this Spec is governed only by accepted `MINIMAL_AUTH_FOUNDATION_V1`. If PR #7 merges before review or acceptance of this Spec, authoring MUST stop and this exact Spec head MUST be reconciled against V2 before any review can bind or acceptance can occur.

### 3.2 Parent semantics preserved exactly

```text
PRINCIPAL_TYPES = user | agent | service
PRINCIPAL_STATUS = active | disabled
AUTH_SERVICE_IS_PRINCIPAL_AUTHORITY = YES
STATUS_MEANING_CHANGED = NO
MACHINE_PRINCIPAL_PROVISIONING_CHANGED = NO
HUMAN_SESSION_TOKEN_MEANING_CHANGED = NO
OBO_CHANGED = NO
RS256_JWKS_CHANGED = NO
EXISTING_CLIENT_GRANT_SCOPE_AUDIENCE_MEANING_CHANGED = NO
ADDITIVE_HUMAN_ADMIN_SCOPE_REGISTRATION = auth.human-principal.read | auth.human-principal.write | auth.human-principal.disable
```

This Spec refines administration of `principal_type=user`; it does not redefine parent identity or status semantics. The three exact management scopes are an additive, bounded Contract Change Request under the existing service-only `svc-auth` audience; acceptance authorizes their later registration and assignment only for this management plane. It MUST NOT rename, broaden, infer, or alter `auth.identity.provision`, any existing Grant, any existing Client binding, any Audience profile, or any existing Scope meaning. In particular:

- disable stops new Human authentication and refresh immediately;
- already-issued Access Tokens remain governed by offline verification and expire no later than `exp`;
- User disable revokes or makes unusable the affected Human Sessions and Refresh Families as required by `HUMAN_SESSION_AND_REFRESH_CONTRACT_V1`;
- enable restores only eligibility for a future new authentication ceremony;
- enable MUST NOT restore any old Session, Refresh Credential, Refresh Family, Authorization Code, or Token authority;
- Human OBO remains forbidden and machine provisioning remains unchanged.

### 3.3 External interoperability boundary

The external reference is `mayf3/svc-workflow` authority `SVC_WORKFLOW_PRODUCT_BOUNDARY_V2` at exact revision `187ae8a1f6db852751d05c4432ed84f6f78df97e`. It requires a future repository-owned Root authority to bind repository governance owner `mayf3` to a canonical auth-service Principal UUID. This Spec provides canonical Principal facts only; it neither accepts that external authority nor owns its mapping.

```text
REPOSITORY_OWNER_MAPPING_OWNER = mayf3/svc-workflow
ROOT_AUTHORITY = SVC_WORKFLOW_GLOBAL_PERMISSION_GOVERNANCE_ROOT_V1
ROOT_AUTHORITY_CURRENTLY_EXISTS = NO
ROOT_MAPPING_WRITE_AUTHORIZED_BY_THIS_SPEC = NO
```

### 3.4 Authority classification

```text
SPEC_FIRST_GATE = PASS
AUTHORITY_ACTION = NEW
SPEC_DEDUP_CLASSIFICATION = NEW
DUPLICATE_AUTHORITY_RISK = NONE
PARTIAL_SUPERSESSION = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
```

No accepted, proposed, or superseded standalone governing Spec found at the authoring coordinates owns the same Human Principal administration scope. Draft PR #2 is a broader proposed Program with `implementation_authority: none`; it names a not-yet-created Human credential-lifecycle child but is not that child. The old local candidate is product code without governing authority and is not a Spec.

### 3.5 Proposed PR #2 child reconciliation

Draft PR #2 (`AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1`) is inactive and does not govern this Spec. Its `DEC-AUTH-SHUTDOWN-013`, `CTR-AUTH-SHUTDOWN-029`, and `ACC-AUTH-SHUTDOWN-011` reserve a future child label `AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1` covering User creation, password reset, disable, and Session/Refresh revocation. No governing Spec with that ID exists.

This Spec is the sole planned child authority for the non-credential Principal-administration portions of that placeholder: controlled User creation and disable. Password reset and all credential lifecycle operations remain out of scope and require a separate, non-overlapping accepted authority. Before PR #2 can be accepted, PR #2 MUST be amended to:

1. reference `AUTH_SERVICE_HUMAN_PRINCIPAL_ADMINISTRATION_V1` for User Principal creation/disable;
2. assign password reset to a separately named credential-only child;
3. remove or mark `AUTH_SERVICE_V1_HUMAN_CREDENTIAL_LIFECYCLE_V1` as a non-authority historical placeholder; and
4. forbid creation of a second Human Principal management Spec under that placeholder.

This is reconciliation of two proposed documents, not partial supersession. This Spec does not modify PR #2 and does not claim to satisfy its password-reset gate. This Spec MAY be reviewed while PR #2 remains Draft, but MUST NOT be accepted unless the then-current PR #2 head has completed the split above or PR #2 is closed/rejected without acceptance. The final acceptance record for this Spec MUST pin that PR #2 disposition by exact head/status; otherwise acceptance is blocked.

```text
OVERLAPPING_PROPOSED_PROGRAM = AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1 / PR #2
EXISTING_SAME_SCOPE_CHILD_SPEC = NONE
PR_2_IMPLEMENTATION_AUTHORITY = none
PR_2_RECONCILIATION_REQUIRED_BEFORE_ACCEPTANCE = YES
THIS_SPEC_ACCEPTANCE_BLOCKED_UNTIL_PR_2_RECONCILED_OR_CLOSED = YES
SECOND_HUMAN_PRINCIPAL_MANAGEMENT_CHILD_ALLOWED = NO
DUPLICATE_AUTHORITY_RISK = NONE_AFTER_REQUIRED_RECONCILIATION
```

## 4. Current State

### STATE-001 — Parent authority owns canonical Principal type and status

- Subject: auth-service identity architecture.
- As of commit: `mayf3/auth-service@36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: clean source worktree; no runtime or database query.
- Observed at: `2026-08-22T02:55:15Z`.
- Projection: auth-service is the authority for Principal identity/type/status; Principal types are `user | agent | service`; status is `active | disabled`.
- Basis: `OBS-001`, `CLM-001`, `EVD-001`.

### STATE-002 — Human lifecycle exists but no governing Human administration plane exists

- Subject: Human User source and accepted governing surfaces.
- As of commit: `mayf3/auth-service@36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: source inspection only; runtime and persisted data not observed.
- Observed at: `2026-08-22T02:55:15Z`.
- Projection: accepted authority defines User status effects on authentication, Session, Refresh Family, and Access Token expiry, while current governing Specs do not define a dedicated Human Principal create/claim/directory/status management plane.
- Basis: `OBS-002`, `OBS-006`, `CLM-002`, `EVD-002`, `EVD-006`.

### STATE-003 — Existing source surfaces are not an implementation baseline for this Spec

- Subject: current User routes and generic principal provisioning source.
- As of commit: `mayf3/auth-service@36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: source inspection only; behavior not executed.
- Observed at: `2026-08-22T02:55:15Z`.
- Projection: current User list/get projects email and product roles; legacy registration creates credentials and returns Tokens; generic idempotent provisioning supports only Machine `agent | service` and uses `auth.identity.provision`. Those surfaces conflict with this Spec's intended minimal Human administration boundary and MUST NOT be treated as normative implementation evidence.
- Basis: `OBS-003`, `OBS-004`, `CLM-003`, `EVD-003`.

### STATE-004 — Old directory candidate has no authority and incompatible boundaries

- Subject: local commit `8d495bc46383d638fe80ae9f96d0061f498cd25a`.
- As of artifact: that exact unmerged local commit, parent `170736e42eb882277011796a98bb415a65d0e84c`.
- Environment: Git object inspection only; candidate not executed or modified.
- Observed at: `2026-08-22T02:55:15Z`.
- Projection: the candidate queries only Machine `agent | service`, exposes Client/Grant/Scope/external reference inventory, reuses the machine provisioning write scope for reads, writes only console observability, and has no governing Spec or durable audit. It is neither authority nor implementation baseline.
- Basis: `OBS-005`, `CLM-004`, `EVD-004`.

### STATE-005 — Repository-root mapping is externally owned and not yet active

- Subject: svc-workflow repository governance Root requirement.
- As of commit: `mayf3/svc-workflow@187ae8a1f6db852751d05c4432ed84f6f78df97e`.
- Environment: source authority inspection only; no svc-workflow modification or runtime query.
- Observed at: `2026-08-22T02:55:15Z`.
- Projection: `SVC_WORKFLOW_PRODUCT_BOUNDARY_V2` requires, but does not create, `SVC_WORKFLOW_GLOBAL_PERMISSION_GOVERNANCE_ROOT_V1`; the repository mapping belongs to svc-workflow governance, not auth-service runtime administration.
- Basis: `OBS-007`, `CLM-005`, `EVD-007`.

### STATE-006 — PR #2 reserves a broader future child but does not instantiate one

- Subject: proposed shutdown Program's Human lifecycle prerequisite.
- As of artifact: `mayf3/auth-service` Draft PR #2 head `fb8d55e785d6f99c9e57a602543609953e8f5410`.
- Environment: fetched Git object and GitHub metadata; PR not modified.
- Observed at: `2026-08-22T03:02:19Z`.
- Projection: PR #2 is an inactive Program with `implementation_authority: none`; it names a future child that combines Principal creation/disable with password reset, but no such child Spec exists. Its placeholder must be split/reconciled before PR #2 acceptance to avoid a parallel Human Principal authority.
- Basis: `OBS-009`, `CLM-007`, `EVD-009`.

## 5. Observations

### OBS-001 — Minimal Auth freezes Principal identity and status ownership

- Subject: Principal identity architecture.
- Repository/source: `mayf3/auth-service`.
- Commit/artifact: `36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: clean authoring worktree; no service or database used.
- Observed at: `2026-08-22T02:55:15Z`.
- Method: read `docs/contracts/minimal-auth-v1/README.md` §§6, 7, and 11 with the compatibility entry `docs/contracts/MINIMAL_AUTH_FOUNDATION_V1.md`.
- Result: the authority records Principal types `user | agent | service`, status `active | disabled`, auth-service ownership of Principal identity/type/status, and offline expiry behavior after disable.
- Provenance: `docs/contracts/minimal-auth-v1/README.md:148-223,298-310`.
- Limitations: establishes normative source authority, not current production conformance.

### OBS-002 — Human disable and refresh consequences are already frozen

- Subject: User status effect on Human authentication artifacts.
- Repository/source: `mayf3/auth-service`.
- Commit/artifact: `36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: clean source worktree; no runtime execution.
- Observed at: `2026-08-22T02:55:15Z`.
- Method: read `human-session-refresh.md` §§5, 11, and 13 and `human-login.ts` / `human-refresh.ts` status checks.
- Result: authority requires active User for authentication/refresh; User disable makes Session non-refreshable, revokes the Refresh Family, and leaves issued Access Tokens to expire by `exp`; source contains active-status checks on Human authorization and refresh paths.
- Provenance: `docs/contracts/minimal-auth-v1/human-session-refresh.md:99-112,214-226,240-270`; `src/lib/oauth/v1/human-login.ts:124-186,189-300`; `src/lib/oauth/v1/human-refresh.ts:215-266`.
- Limitations: source paths are descriptive and were not executed; only the contract text is normative.

### OBS-003 — Current User surfaces expose or create more than a minimal directory

- Subject: legacy User APIs and data shape.
- Repository/source: `mayf3/auth-service`.
- Commit/artifact: `36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: source inspection only; no User or credential was queried.
- Observed at: `2026-08-22T02:55:15Z`.
- Method: inspect `prisma/schema.prisma`, `src/routes/users.ts`, and `src/routes/auth.ts` symbols `toSafeUser`, `/register`, and `/refresh`.
- Result: `User` contains email/password/product-role and profile fields; list/get projects email and roles; registration hashes or generates a password and returns Access/Refresh Tokens and potentially a generated password.
- Provenance: `prisma/schema.prisma:36-67`; `src/routes/users.ts:12-68`; `src/routes/auth.ts:15-33,163-205,207-254`.
- Limitations: does not assert routes are deployed, production-effective, or conforming.

### OBS-004 — Existing generic management is machine-only and uses the provisioning write scope

- Subject: generic idempotent principal route.
- Repository/source: `mayf3/auth-service`.
- Commit/artifact: `36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: source inspection only.
- Observed at: `2026-08-22T02:55:15Z`.
- Method: inspect `contract-bundles/minimal-auth-v1/audience-registry.json`, `contract-manifest.json` management rules, `src/routes/idempotent.ts`, and `src/lib/oauth/v1/idempotent.ts`.
- Result: frozen bundle registers service-only audience `svc-auth` with only `auth.identity.provision`; Grant management is forward, migration-only, optimistic, and same-transaction audited. The route accepts only `agent | service`, creates or claims `MachinePrincipal`, may create a credential-bearing Machine Client separately, and authenticates with that provisioning scope.
- Provenance: `contract-bundles/minimal-auth-v1/audience-registry.json:46-56`; `contract-bundles/minimal-auth-v1/contract-manifest.json:144-150`; `src/routes/idempotent.ts:1-106`; `src/lib/oauth/v1/idempotent.ts:1-359`.
- Limitations: bundle/source establishes the existing seam and change rules, not authority for Human management; additive scope registration still requires this independently accepted Contract Change Request.

### OBS-005 — The local candidate is machine inventory with broad fields and best-effort logging

- Subject: local candidate `feat/auth-principal-lookup-broker-capability`.
- Repository/source: local Git object in `mayf3/auth-service` checkout.
- Commit/artifact: `8d495bc46383d638fe80ae9f96d0061f498cd25a`.
- Environment: `git show` inspection only; no cherry-pick, execution, rebase, push, or modification.
- Observed at: `2026-08-22T02:55:15Z`.
- Method: `git diff-tree --name-status`, `git show --stat`, and `git show <commit>:src/routes/internal.ts`.
- Result: candidate changes four product/test files, returns Machine Principals plus agent IDs, external references, Clients, Grants, Audiences and Scopes, reuses `auth.identity.provision`, and emits `console.info` access logging.
- Provenance: Git object `8d495bc...`, especially `src/routes/internal.ts` symbols `listPrincipals`, `listRoles`, and `internalRouter.use(v1ManagementAuth)`.
- Limitations: unexecuted local candidate; no claim about runtime state.

### OBS-006 — No same-scope governing Spec was found at the authoring coordinates

- Subject: governing-Spec deduplication.
- Repository/source: local/remote refs and GitHub PR metadata for `mayf3/auth-service`.
- Commit/artifact: base `36a11136745bae7a371d21ba62d9617942c41afa`; remote refs after `git fetch github --prune`; PR list observed at authoring time.
- Environment: repository metadata inspection; no working files changed by the scan.
- Observed at: `2026-08-22T02:55:15Z`.
- Method: enumerate `docs/specs/`, open PRs, remote/local branches, worktrees, and grep documentation refs for Human Principal administration/directory and proposed scope names.
- Result: no accepted/proposed/superseded standalone Human Principal administration governing Spec was found; PR #2 is a broader inactive Program that reserves a mixed-scope future child label, and PR #7 overlaps only as the proposed whole parent successor.
- Provenance: `docs/specs/README.md`; PR #2 stable items `DEC-AUTH-SHUTDOWN-013` / `CTR-AUTH-SHUTDOWN-029` / `ACC-AUTH-SHUTDOWN-011`; `gh pr list`; `git branch -r`; `git worktree list --porcelain`; exact-ref documentation scan.
- Limitations: bounded to refs and PR metadata visible at observation time; must be rerun before review/acceptance if refs change.

### OBS-007 — svc-workflow owns the future repository-root mapping

- Subject: repository governance owner to canonical Principal mapping.
- Repository/source: `mayf3/svc-workflow`.
- Commit/artifact: `187ae8a1f6db852751d05c4432ed84f6f78df97e`.
- Environment: source authority inspection only.
- Observed at: `2026-08-22T02:55:15Z`.
- Method: inspect `docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V2.md` §§7 and Root-authority clauses.
- Result: the accepted product direction says GitHub identity `mayf3` is not a runtime actor, requires a separate `SVC_WORKFLOW_GLOBAL_PERMISSION_GOVERNANCE_ROOT_V1`, and says V2 does not create or accept it.
- Provenance: `docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V2.md:340-357,692-694` at the exact external revision.
- Limitations: this Spec references but cannot govern or activate the external authority.

### OBS-008 — PR #7 remains proposed, Draft, open, and unmerged

- Subject: proposed parent successor.
- Repository/source: GitHub PR #7 and its exact head.
- Commit/artifact: PR head `797326c1751325407201f00300ee61fb8f275061`; evaluated base `36a11136745bae7a371d21ba62d9617942c41afa`.
- Environment: GitHub metadata plus fetched Git object.
- Observed at: `2026-08-22T03:02:19Z`.
- Method: `git fetch github --prune`, `gh pr view 7 --repo mayf3/auth-service`, and inspect `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md` at the fetched PR head.
- Result: PR is `OPEN`, Draft, unmerged; authority frontmatter/status is `proposed`; it proposes whole supersession of V1 while preserving Human Session semantics.
- Provenance: PR #7 metadata and exact fetched head file.
- Limitations: time-sensitive; requires recheck before review or acceptance.

### OBS-009 — PR #2 is a proposed Program with a planned child, not the child itself

- Subject: shutdown Program Human lifecycle prerequisite and dedup boundary.
- Repository/source: GitHub PR #2 and fetched branch `github/agent/auth-service-legacy-surface-shutdown-v1`.
- Commit/artifact: PR head `fb8d55e785d6f99c9e57a602543609953e8f5410`.
- Environment: GitHub metadata and Git object inspection; no PR or worktree modification.
- Observed at: `2026-08-22T03:02:19Z`.
- Method: inspect frontmatter plus `DEC-AUTH-SHUTDOWN-013`, `CTR-AUTH-SHUTDOWN-029`, and `ACC-AUTH-SHUTDOWN-011` in `docs/specs/AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1.md`.
- Result: PR #2 is `OPEN`, Draft, proposed, `spec_kind=program`, `implementation_authority=none`; it requires a future child label covering audited creation, password reset, disable, and revocation, but no child file/authority with that ID exists.
- Provenance: exact PR head and named stable items.
- Limitations: PR #2 is inactive and may change; it must be rescanned before either proposal is accepted.

## 6. Claims and assumptions

### CLM-001 — This Spec can refine User administration without changing parent status meaning

- Support state: SUPPORTED.
- Supported by evidence: `EVD-001`, `EVD-002`.
- Contradicted by evidence: none known.
- Uncertainty: implementation conformance remains unevaluated.

### CLM-002 — A separate governing authority is required for Human management

- Support state: SUPPORTED.
- Supported by evidence: `EVD-003`, `EVD-006`.
- Contradicted by evidence: none known.
- Uncertainty: future refs may add a duplicate and must be rescanned.

### CLM-003 — Existing User and generic management routes are unsafe as a direct design baseline

- Support state: SUPPORTED.
- Supported by evidence: `EVD-003`.
- Contradicted by evidence: none known.
- Uncertainty: source was not executed; the claim concerns boundary mismatch, not deployed behavior.

### CLM-004 — The old candidate must be superseded as a design direction without authority lifecycle supersession

- Support state: SUPPORTED.
- Supported by evidence: `EVD-004`.
- Contradicted by evidence: none known.
- Uncertainty: none material to the disposition.

### CLM-005 — auth-service can provide canonical Principal facts without owning the repository mapping

- Support state: SUPPORTED.
- Supported by evidence: `EVD-001`, `EVD-007`.
- Contradicted by evidence: none known.
- Uncertainty: the future Root authority's exact UUIDs and approver roster are intentionally not selected here.

### CLM-006 — Machine-service bootstrap can avoid a circular dependency on a not-yet-created Human approver

- Support state: INFERRED.
- Supported by evidence: `EVD-001`, `EVD-003`.
- Contradicted by evidence: none known.
- Uncertainty: implementation must prove distinct control-domain assignments and owner-approved deployment records; no real approver is named by this Spec.

### CLM-007 — PR #2 does not trigger the duplicate-Spec stop rule but requires pre-acceptance split reconciliation

- Support state: SUPPORTED.
- Supported by evidence: `EVD-009`.
- Contradicted by evidence: none known.
- Uncertainty: PR #2 may change; both proposals require a new dedup scan before acceptance.

No `OPEN_ASSUMPTION` changes Contract meaning.

## 7. Evidence relations

### EVD-001 — Parent identity observations support preserved Principal semantics

- Source observations: `OBS-001`.
- Target: `CLM-001`, `CLM-005`.
- Relation: SUPPORTS.
- Bound coordinates: auth-service `36a11136745bae7a371d21ba62d9617942c41afa`, source worktree, observed `2026-08-22T02:55:15Z`.
- Strength/sufficiency: strong for parent normative identity ownership and enums.
- Limitations: no production conformance conclusion.
- Provenance: exact parent contract paths recorded in `OBS-001`.

### EVD-002 — Human lifecycle observations support refinement without semantic replacement

- Source observations: `OBS-002`.
- Target: `CLM-001`.
- Relation: SUPPORTS.
- Bound coordinates: auth-service base commit and source environment recorded in `OBS-002`.
- Strength/sufficiency: strong for normative disable/refresh/expiry obligations.
- Limitations: source checks are descriptive; implementation still requires conformance.
- Provenance: exact paths recorded in `OBS-002`.

### EVD-003 — Current source mismatch supports a new least-privilege authority

- Source observations: `OBS-003`, `OBS-004`.
- Target: `CLM-002`, `CLM-003`, `CLM-006`.
- Relation: SUPPORTS.
- Bound coordinates: auth-service `36a111...`, source-only environment, observed `2026-08-22T02:55:15Z`.
- Strength/sufficiency: strong for field, credential, principal-type, and scope mismatch.
- Limitations: does not prove production exposure or select implementation files.
- Provenance: exact source paths and symbols in `OBS-003` and `OBS-004`.

### EVD-004 — Candidate inspection supports non-authority supersession disposition

- Source observations: `OBS-005`.
- Target: `CLM-004`.
- Relation: SUPPORTS.
- Bound coordinates: candidate `8d495bc...`, local Git object, observed `2026-08-22T02:55:15Z`.
- Strength/sufficiency: strong for candidate scope and field behavior.
- Limitations: candidate was not run and has no lifecycle status to supersede.
- Provenance: exact Git object and symbols in `OBS-005`.

### EVD-006 — Ref/PR scan supports NEW classification

- Source observations: `OBS-006`, `OBS-008`.
- Target: `CLM-002`.
- Relation: SUPPORTS.
- Bound coordinates: auth-service base, fetched refs and GitHub PR state at observation time.
- Strength/sufficiency: sufficient for the authoring-time dedup gate.
- Limitations: time-sensitive; repeat if PR/ref state changes.
- Provenance: commands and indexes in `OBS-006`, `OBS-008`.

### EVD-007 — External authority supports mapping ownership separation

- Source observations: `OBS-007`.
- Target: `CLM-005`.
- Relation: SUPPORTS.
- Bound coordinates: svc-workflow `187ae8a1f6db852751d05c4432ed84f6f78df97e`, observed `2026-08-22T02:55:15Z`.
- Strength/sufficiency: strong for external ownership and missing Root authority.
- Limitations: cannot authorize svc-workflow behavior from auth-service.
- Provenance: exact external path and clauses in `OBS-007`.

### EVD-009 — PR #2 stable items support planned-child reconciliation rather than duplicate classification

- Source observations: `OBS-009`.
- Target: `CLM-007`, `STATE-006`.
- Relation: SUPPORTS.
- Bound coordinates: auth-service PR #2 head `fb8d55e785d6f99c9e57a602543609953e8f5410`, observed `2026-08-22T03:02:19Z`.
- Strength/sufficiency: strong for the Program kind, inactive lifecycle, literal placeholder ID, and mixed Principal/credential scope.
- Limitations: does not amend PR #2; the required two-sided reconciliation must occur before PR #2 acceptance.
- Provenance: exact stable items and PR metadata in `OBS-009`.

## 8. Decisions

### DEC-001 — Support both create-disabled and controlled claim

- Decision owner: auth-service repository owner through Spec acceptance.
- Decision: support `CREATE_NEW_USER_PRINCIPAL` and `CLAIM_EXISTING_USER_PRINCIPAL`. Every new User is created `disabled`; claim targets an exact existing User UUID and does not change credentials or status.
- Rejected alternatives: create-active; claim by email/display name/Feishu ID; create-and-login.
- Reason: separates stable Principal establishment from proof of login control and repository governance mapping.
- Owner decision remaining: NONE.

### DEC-002 — Freeze one minimal Human projection

- Decision owner: auth-service repository owner through Spec acceptance.
- Decision: every single-User and directory result uses exactly `principalId`, `principalType`, `principalStatus`, `principalDisplayName`, with `principalType=user`.
- Rejected alternatives: reuse legacy safe-user projection; expose Machine inventory or grants.
- Reason: exact allowlisting prevents sensitive and authorization metadata drift.
- Owner decision remaining: NONE.

### DEC-003 — Use separate machine-service management authorities

- Decision owner: auth-service repository owner through Spec acceptance.
- Decision: define exact scopes `auth.human-principal.read`, `auth.human-principal.write`, and `auth.human-principal.disable`; define closed assignment roles `HUMAN_PRINCIPAL_READER`, `HUMAN_PRINCIPAL_REQUESTER`, `HUMAN_PRINCIPAL_APPROVER`, `HUMAN_PRINCIPAL_EMERGENCY_DISABLER`, and `HUMAN_IDENTITY_VERIFIER`; only active Service Principals using direct, audience-`svc-auth` V1 machine tokens and the matching active server-side assignment may act.
- Rejected alternatives: reuse `auth.identity.provision`; User/Agent callers; delegated tokens; body actor.
- Reason: preserve least privilege and avoid bootstrap dependence on a Human Principal that does not yet exist.
- Owner decision remaining: NONE.

### DEC-004 — Separate request, approval, and deterministic finalization

- Decision owner: auth-service repository owner through Spec acceptance.
- Decision: create, claim, and enable require durable request plus approval by a distinct canonical Service Principal in a distinct recorded control domain. auth-service executes finalization deterministically. Disable may be immediate under the narrower emergency-disable scope but remains fully audited.
- Rejected alternatives: self-approval; two Agents under one OS identity; request-body actor; universal Human approver prerequisite.
- Reason: close bootstrap without fictional dual control.
- Owner decision remaining: NONE.

### DEC-005 — Use two closed evidence profiles and never store repository mapping

- Decision owner: auth-service repository owner through Spec acceptance.
- Decision: the only evidence profiles are `human_identity_attestation_v1` for disabled-first create or disabled-User claim, and `fresh_existing_user_authentication_v1` for active-User claim. Store only type, bounded opaque reference, SHA-256 digest, verified-at, verifier Principal, and result. Never interpret either profile as ownership of `mayf3 -> UUID`.
- Rejected alternatives: open evidence-type registry; store complete external identity documents; infer by email/name/Feishu ID; treat ordinary Session/Token as claim proof; write svc-workflow Root mapping.
- Reason: close identity-proof and replay semantics while preserving credential and repository ownership.
- Owner decision remaining: NONE.

### DEC-006 — Make audit and idempotent outcome part of the transaction contract

- Decision owner: auth-service repository owner through Spec acceptance.
- Decision: protected operations fail closed if durable audit cannot commit; every command has a canonical digest and idempotency key; uncertain commits return `outcome_unknown` and reconcile only under the same key.
- Rejected alternatives: best-effort logs; new-key blind retry; last-write-wins status updates.
- Reason: prevent duplicate identity and untraceable lifecycle outcomes.
- Owner decision remaining: NONE.

## 9. Contracts

### CTR-HPA-001 — Parent identity and token semantics remain unchanged

The implementation MUST preserve `user | agent | service`, `active | disabled`, auth-service Principal authority, Human Session/Refresh semantics, Agent/Service provisioning, Client/Grant/Scope/Audience meaning, Human and Agent OBO boundaries, and RS256/JWKS behavior. It MUST NOT use prose in this Spec to make disabled-user Tokens or Sessions valid again.

### CTR-HPA-002 — Canonical single-User read

An authorized caller with `auth.human-principal.read` MAY query one exact canonical User UUID. A successful response MUST contain exactly:

```text
principalId
principalType
principalStatus
principalDisplayName
```

`principalType` MUST equal `user`; status MUST be the current canonical `active | disabled` value. Missing or non-User UUIDs MUST fail with a bounded not-found response that reveals no credential or machine inventory facts.

### CTR-HPA-003 — Minimal Human directory

The directory MUST contain only User Principals and each item MUST use the exact four-field projection from `CTR-HPA-002`. `principalDisplayName` MUST be the canonical value defined in `CTR-HPA-004`. Pagination MUST use an opaque stable cursor, a maximum page size of 100, and deterministic unsigned UTF-8 byte ordering by `(principalDisplayName, principalId)`. Optional search MAY accept only exact UUID or a case-sensitive prefix that is first canonicalized by the same display-name algorithm. Email, credential state, Feishu ID, Clients, Grants, Scopes, Audiences, Tokens, Refresh Families, Sessions, assignments, unrestricted evidence, and all Machine Principal inventory MUST be absent from every success and error response.

### CTR-HPA-004 — Create-new is disabled-first and credential-free

A create request MUST supply `principalDisplayName` independently of identity evidence. The service MUST canonicalize it with Unicode NFKC, trim leading/trailing Unicode White_Space, collapse each internal Unicode White_Space run to one ASCII space, reject Unicode `Cc`/`Cf` code points, and require 1–128 Unicode scalar values after canonicalization. Display-name collisions are allowed and never merge identity; `principalId` is the tie-breaker. Evidence MUST NOT silently supply or overwrite the display name.

Before activation, every pre-existing User MUST receive a stored canonical `principalDisplayName` through a forward, audited migration that applies the same algorithm to its existing name. The migration MUST NOT use email, Feishu ID, employee identity, credential data, or repository identity as a fallback. A missing/invalid result MUST block activation until an operator supplies a conforming display name through the approved write flow; it MUST NOT be guessed, omitted, or replaced with sensitive data. Claim preserves this canonical value.

A finalized `CREATE_NEW_USER_PRINCIPAL` command MUST atomically create exactly one `principalType=user`, `principalStatus=disabled` Principal with that canonical display name plus its approved evidence metadata and durable audit. It MUST NOT create or return a password, credential, Client, Session, Authorization Code, Access Token, Refresh Credential, Token Family, Grant, Scope, Audience, product role, assignment, email placeholder, or repository mapping. Its Principal projection MUST use the exact four fields in `CTR-HPA-002`.

### CTR-HPA-005 — Existing-User claim is non-takeover

A finalized `CLAIM_EXISTING_USER_PRINCIPAL` command MUST target one exact existing User UUID, preserve its current status and canonical credentials unchanged, and persist only the approved bounded claim/evidence record plus audit. It MUST NOT inspect, rotate, reveal, replace, validate, or create any credential; MUST NOT change email, display name, Session, Client, Grant, Token, or role; and MUST NOT use email, display name, Feishu ID, or request-body assertions as automatic proof.

### CTR-HPA-006 — Identity evidence uses exact bounded profiles

The complete evidence-type set is:

```text
human_identity_attestation_v1
fresh_existing_user_authentication_v1
```

`human_identity_attestation_v1` MAY authorize only disabled-first create or claim of an already-disabled User. It MUST be a single-use attestation issued by an active allowlisted verifier Service Principal, bind a stable verifier namespace plus stable verifier-local pseudonymous subject digest independent of request nonce, operation intent, and nonce, expire within 10 minutes, and contain no repository identity or raw identity document in the auth-service record. Auth-service MUST persist a unique privacy-preserving subject binding keyed by `(verifierPrincipalId, verifierNamespace, subjectPseudonymDigest)`; every fresh attestation for that same tuple MUST resolve to the same User or conflict and MUST NOT create a second User.

`fresh_existing_user_authentication_v1` MAY authorize only claim of an active existing User. It MUST be a single-use proof handle issued after a fresh parent-governed authentication ceremony, bind the exact target User UUID plus operation intent and nonce, expire within 5 minutes, and MUST NOT itself be a Session, Authorization Code, Access Token, Refresh Credential, or reusable login credential.

Create/claim requests MUST identify one compatible profile, a non-secret opaque reference of at most 256 UTF-8 bytes, lowercase SHA-256 proof digest, verification time, verifier canonical Principal, result, nonce digest, and—only for `human_identity_attestation_v1`—the bounded verifier namespace and stable pseudonymous subject digest. Finalization MUST resolve and atomically consume the approved reference through the server-bound verifier, compare the digest/target/intent/nonce, and reject missing, reused, unapproved, stale, invalid, wrong-target, wrong-verifier, or mismatched evidence without Principal mutation. Evidence digest uniqueness MUST prevent one proof from establishing two Principals. Full identity documents, external subject values, unrestricted request bodies, passwords, Tokens, credential material, and repository mappings MUST NOT be stored in the evidence record or audit.

### CTR-HPA-007 — Read authority is separate and least-privilege

Only an active Service Principal using a direct V1 RS256 Access Token with exact audience `svc-auth`, exact scope `auth.human-principal.read`, an active Client, and an active server-side Human-admin read assignment MAY call single-User or directory reads. `auth.identity.provision`, write, disable, Agent, User, OBO/delegated, wrong-audience, disabled-operator, revoked-Client, and body-actor identities MUST NOT independently authorize reads.

### CTR-HPA-008 — Write authority is separate and body actors are ignored

Only an active Service Principal using a direct V1 RS256 Access Token with exact audience `svc-auth`, exact scope `auth.human-principal.write`, an active Client, and an active server-side requester assignment MAY submit create, claim, or enable requests. Canonical operator identity MUST come exclusively from verified token `sub` plus server-side bindings. Any `actor`, `operator`, `approver`, `principal_type`, or equivalent request-body identity MUST be rejected or ignored as non-authoritative and MUST never enter audit as canonical identity.

### CTR-HPA-009 — Bootstrap and approval actors are non-circular and distinct

The assignment registry MUST accept only the closed roles `HUMAN_PRINCIPAL_READER`, `HUMAN_PRINCIPAL_REQUESTER`, `HUMAN_PRINCIPAL_APPROVER`, `HUMAN_PRINCIPAL_EMERGENCY_DISABLER`, and `HUMAN_IDENTITY_VERIFIER`; each assignment binds one canonical Service Principal UUID, one non-secret control-domain identifier, status, effective/expiry time, deployment artifact revision, and approval reference. Initial requester, approver, and verifier assignments and their least-privilege exact `svc-auth` Scope Grants MUST be installed only by a reviewed, versioned, repository-owner-approved forward deployment artifact using already-existing active Service Principals and Clients; the artifact MUST preserve the parent Grant model, optimistic concurrency, and same-transaction Grant audit. At least one requester and one approver assignment MUST reference distinct canonical Principal UUIDs and distinct recorded control-domain identifiers; a single OS user running two Agents MUST NOT satisfy dual control. No initial Human Principal is required. Runtime requests, request bodies, ordinary admins, or the proposed Spec itself MUST NOT create these assignments. No real Principal UUID or real approver is selected by this Spec.

### CTR-HPA-010 — Approval and deterministic finalization

Create, claim, and enable MUST use this complete durable request state grammar:

```text
pending -> approved | denied | expired
approved -> finalizing
finalizing -> succeeded | failed | no_change | conflict | outcome_unknown
outcome_unknown -> outcome_unknown | succeeded | failed | no_change | conflict
```

`denied`, `expired`, `succeeded`, `failed`, `no_change`, and `conflict` are terminal. Only same-key reconciliation may transition `outcome_unknown`; it MUST never return to `pending`, seek another approval, or consume evidence twice. The approver MUST be an active direct-token Service Principal with the write scope and active approver assignment, distinct from the requester and target. For every approval, requester and approver assignment records MUST also have different non-secret control-domain identifiers; this is checked per request, not only at bootstrap. Approval MUST bind operation, target or create intent, canonical request digest, requester assignment identity/domain, approver assignment identity/domain, and expiry. It MUST bind evidence profile/digest for create/claim and explicit `null` evidence for enable. Denied/expired requests MUST never finalize. auth-service, not a client-supplied executor, MUST perform finalization transactionally. Requester, approver, both server-bound assignments/control domains, state transitions, and finalizer revision MUST be audited.

### CTR-HPA-011 — Immediate disable and parent-consistent revocation

An active Service Principal with direct `svc-auth` token, exact `auth.human-principal.disable` scope, and active emergency-disable assignment MAY immediately disable a User without prior approval when it supplies a bounded reason code and incident/reference identifier. Finalization MUST serialize on the User, set status `disabled`, prevent new authentication and refresh immediately across every mounted Human path (including legacy/compatibility paths), and revoke or make unusable all active Human Sessions and Refresh Families as required by the parent authority. No path may auto-create, update, or authenticate a disabled User. Already-issued Access Tokens remain valid only under parent offline semantics and expire by `exp`; no second-scale revocation is implied.

### CTR-HPA-012 — Enable restores only future authentication eligibility

Enable MUST require the approved flow in `CTR-HPA-010`, serialize on the User, and change `disabled -> active` only. It MUST NOT reactivate, recreate, rebind, or make usable any prior Session, Refresh Credential, Refresh Family, Authorization Code, Access Token, Client, or historical login transaction. A newly enabled User can obtain future authority only through a new, independently valid authentication ceremony governed by the parent.

### CTR-HPA-013 — Status concurrency has one auditable order

Every enable/disable command MUST lock or compare a monotonic User status version. Concurrent commands MUST commit in one database serialization order; each successful audit records the observed before-version/status and committed after-version/status. A stale command MUST return conflict and MUST NOT silently overwrite the winner. Repeating an already-achieved same operation under the same canonical request is an idempotent replay, not a second transition. A different-key request targeting the already-achieved state MAY return a new audited deterministic `no_change` outcome only after current-state authorization and approval requirements are satisfied.

### CTR-HPA-014 — Durable immutable audit is mandatory and fail-closed

Create, claim, privileged get/search, enable, disable, approval, denial, expiry, every finalization state, idempotent replay, conflict, and `outcome_unknown` reconciliation MUST create immutable, durably queryable audit records. Every record MUST include fields for canonical operator, operator assignment/control domain, operation, request/idempotency identity, canonical request digest, result, timestamp, implementation revision, and environment. Operation-specific fields MUST use JSON `null`, never fabricated sentinel identities or values, under these exact rules:

- canonical operator is the safely verified token subject when available and null only when authentication cannot establish one; operator assignment/control domain is null only for unauthenticated or unassigned denials; neither may come from the request body;
- approver and approver assignment/control domain are non-null only after an approval/denial actor exists; they are null for reads and immediate disable;
- target User UUID is null only for pre-allocation create attempts and non-null once allocated or for every target operation;
- evidence profile/reference/proof digest are non-null for create/claim and null for read/enable/disable; subject-binding digest is non-null only for `human_identity_attestation_v1` and null for `fresh_existing_user_authentication_v1` and non-evidence operations;
- before status/version are null for create, equal the observed current values for reads, and non-null for target mutations;
- after status/version are the committed values for successful mutations, equal before for reads/no-change, and null when no authoritative post-state is known;
- failure reason code is non-null for rejected/failed/conflict/unknown outcomes and null for success/no-change.

Passwords, passkeys, MFA material/state, Tokens, Refresh Credentials, credential secrets/verifiers, Authorization headers, full external identity documents, raw external subject values, employee identity data, and unrestricted request bodies MUST never be recorded. If the required audit record cannot commit, the protected read or mutation MUST fail closed and no success response may be returned.

### CTR-HPA-015 — Same key and same canonical request replay deterministically

Every protected command MUST require a caller-chosen opaque idempotency key scoped to canonical operator, operation, and endpoint. The service MUST canonicalize all semantic inputs and persist their digest before or atomically with processing. Same key plus same digest MUST return the same terminal result and same Principal/request identifiers without repeating approval, evidence consumption, mutation, or credential work; the replay itself MUST be audited.

### CTR-HPA-016 — Same key and different request is a conflict

Same scoped idempotency key plus a different canonical request digest MUST return a deterministic conflict, MUST preserve the original request/outcome, MUST perform no Principal/evidence/status mutation, and MUST write a conflict audit without storing the unrestricted body.

### CTR-HPA-017 — Concurrent create/claim and duplicate evidence fail safely

Uniqueness and transaction constraints MUST ensure that concurrent or sequential creates cannot create duplicate Principals for the same stable `(verifierPrincipalId, verifierNamespace, subjectPseudonymDigest)` binding even when proof digests/nonces differ, concurrent claims cannot bind one proof or subject binding to different User UUIDs, and create cannot race claim into two identities. The deterministic winner MAY succeed; losers MUST reconcile to the same User/result when semantically identical or conflict when targets/bindings differ. Duplicate evidence or subject binding already bound to another User MUST return conflict without disclosing that User's sensitive data.

### CTR-HPA-018 — Commit uncertainty produces `outcome_unknown` and same-key reconciliation

If the service cannot determine whether a database commit succeeded, it MUST return a typed `outcome_unknown` containing only the idempotency identity, safe correlation ID, and reconciliation instruction. It MUST NOT claim failure, success, or encourage a new key. Reconciliation MUST use the same key and canonical request, read the durable operation/audit record, and return the committed terminal outcome or continue to report `outcome_unknown`. A new-key blind retry MUST be rejected when it would duplicate an unresolved canonical operation.

### CTR-HPA-019 — Deterministic failures replay and audit failures do not mutate

Authorization denial, approval denial/expiry, validation failure, evidence mismatch, not-found, version conflict, idempotency conflict, and other pre-commit deterministic failures MUST be persisted as bounded outcomes when safe and replayed for the same key/request. Audit insertion failure MUST roll back any protected mutation. If even a denial audit cannot be persisted, the service MUST fail closed with a generic unavailable response and MUST NOT expose sensitive detail.

### CTR-HPA-020 — Secret, credential, Token, and sensitive identity exclusion

No Human Principal administration endpoint/response, event payload, audit, error, log, trace/span attribute, metric label, or idempotency/request-state record MAY return or record passwords, password hashes, passkeys, MFA secrets or enrollment/state details, credential/verifier state details, Client secrets, Authorization Codes, Access Tokens, Refresh Tokens/Credentials, ID Tokens, Refresh Families, Sessions, Authorization headers, private keys, email, phone, Feishu ID, employee number or other employee identity data, full external identity evidence, raw external subject values, unrestricted request bodies, product roles, assignments, Clients, Grants, Scopes, Audiences, or Machine Principal inventory. Only the bounded evidence and assignment metadata explicitly allowed by `CTR-HPA-006`, `CTR-HPA-009`, and `CTR-HPA-014` may appear. Implementations MUST use explicit projections and closed serializers rather than serializing live ORM/domain objects.

### CTR-HPA-021 — Repository mapping remains outside auth-service

Auth-service MAY return canonical User Principal facts and store bounded evidence metadata, but MUST NOT create, infer, persist, approve, or expose a record whose semantics are `mayf3 -> Principal UUID` or any equivalent repository-owner mapping. It MUST NOT write svc-workflow storage. Only a future accepted `SVC_WORKFLOW_GLOBAL_PERMISSION_GOVERNANCE_ROOT_V1` in `mayf3/svc-workflow` may own that mapping. Absence of that Root authority MUST NOT be bypassed with email, display name, Feishu ID, body actor, or service identity.

### CTR-HPA-022 — Old candidate and legacy routes are not reused as authority

Implementation MUST NOT cherry-pick or directly reuse the old candidate route/serializers/field set or expose its Machine Client/Grant/Scope inventory. It MUST NOT adapt legacy `/api/users` or `/api/auth/register` responses as the management contract. Reuse of low-level audited utilities is allowed only if conformance proves the exact scopes, User-only projections, durable audit, no credential creation, and all Contracts here; code existence never supplies missing authority.

### CTR-HPA-023 — Rollout is forward-only and inactive by default

Any future implementation MUST be introduced inactive by default, with schema/migration, authority assignments, API activation, and conformance performed under separately reviewed implementation coordinates. No production or local database write is authorized by this proposed Spec authoring task. Rollback MUST disable the management entrypoints while preserving immutable request/audit/evidence records and MUST NOT restore old Sessions, Refresh Families, Tokens, credentials, status, or repository mappings.

## 10. Acceptance

Every Acceptance item requires executed evidence bound to exact implementation commit, migration/schema revision where applicable, environment, configuration, command/request, result, and timestamp. Test definitions or route files alone are not Evidence.

### ACC-HPA-001 — Parent invariants and wire compatibility

- Contracts: `CTR-HPA-001`.
- Method: contract diff plus existing Human, Machine, OBO, RS256/JWKS conformance suites.
- Environment: isolated test deployment and clean database fixture.
- Expected result: no parent enum, token/session, machine provisioning, OBO, Client/Grant/Scope/Audience, or signing semantic changes.
- Failure condition: any changed wire claim, restored disabled authority, machine provisioning change, Human OBO enablement, or RS256/JWKS delta fails.

### ACC-HPA-002 — Exact single-User projection

- Contracts: `CTR-HPA-002`, `CTR-HPA-020`.
- Method: integration response-key equality assertions for active, disabled, missing, and machine UUID targets.
- Environment: isolated API/database fixture with no real identities.
- Expected result: success keys equal the four-field allowlist and type is exactly `user`; failures contain no forbidden fields.
- Failure condition: any extra key, Machine result, stale status, email, role, credential, Client, Grant, Session, or Token data fails.

### ACC-HPA-003 — Exact directory allowlist and pagination

- Contracts: `CTR-HPA-003`, `CTR-HPA-020`.
- Method: multi-page integration test with mixed User/Machine fixtures and display-name collisions.
- Environment: isolated fixture.
- Expected result: only Users, exact four keys per item, deterministic opaque-cursor traversal without duplicates/omissions.
- Failure condition: machine inventory, forbidden field, unstable order, cursor exposure of sensitive data, or page size above 100 fails.

### ACC-HPA-004 — Disabled-first credential-free create

- Contracts: `CTR-HPA-004`.
- Method: approved create flow plus database row-delta and response/log scan across NFKC/whitespace/control/format/empty/overlength display-name cases and two distinct subjects with colliding canonical display names.
- Environment: isolated database and secret-safe test logger.
- Expected result: one disabled User Principal per distinct subject binding, exact canonical request-supplied display name, bounded evidence/audit only, exact minimal projection, display collision ordered by UUID, and zero credential/session/token/client/grant rows created by the command.
- Failure condition: active default, evidence-overwritten display name, wrong normalization, control/format acceptance, collision-based identity merge, Token/secret/password/email placeholder, credential/session/client/grant creation by create, or extra response field fails.

### ACC-HPA-005 — Controlled claim does not take over credentials

- Contracts: `CTR-HPA-005`.
- Method: snapshot all target credential/profile/session fields, finalize approved claim, compare row-equivalence except bounded claim/audit records.
- Environment: isolated active and disabled User fixtures.
- Expected result: target status and credential/profile/session data unchanged; claim binds exact UUID/evidence only.
- Failure condition: credential access/rotation, status change, email/name mutation, Token issuance, or claim by email/display/Feishu input fails.

### ACC-HPA-006 — Evidence digest mismatch fails closed

- Contracts: `CTR-HPA-006`.
- Method: trusted-verifier fixture covering both exact profiles, active/disabled target compatibility, matching, mismatching, stale, reused, wrong-target, wrong-intent, wrong-nonce, unknown-type, wrong-verifier, oversized evidence, and sequential fresh nonce/proof attestations for the same stable verifier namespace/subject digest.
- Environment: isolated verifier and database.
- Expected result: only a compatible exact approved, unexpired, single-use proof succeeds; every fresh proof for the same stable subject binding resolves to the same User or conflicts without a second User; rejected cases produce no Principal mutation and bounded audit.
- Failure condition: incompatible profile, mismatch/reuse/wrong target accepted, second User for the same stable subject binding, ordinary Token/Session accepted as proof, full document/raw external subject stored or logged, unbounded body stored, or repository mapping inferred fails.

### ACC-HPA-007 — Read/write/disable permission separation

- Contracts: `CTR-HPA-007`, `CTR-HPA-008`.
- Method: authorization matrix across each scope alone, `auth.identity.provision`, wrong audience, OBO token, Agent/User/Service type, active/disabled operator, and active/revoked Client.
- Environment: isolated V1 token fixtures and server-side assignments.
- Expected result: only exact active direct Service combinations authorize their own operation class.
- Failure condition: provisioning scope reads/writes, read scope writes, write scope reads without read, disabled operator succeeds, or delegated/Agent/User token succeeds.

### ACC-HPA-008 — Body actor spoof is ineffective

- Contracts: `CTR-HPA-008`, `CTR-HPA-014`.
- Method: submit body/header actor and approver UUIDs differing from verified token subject.
- Environment: isolated API fixture.
- Expected result: spoof fields rejected/ignored; audit operator equals verified canonical token subject only.
- Failure condition: body identity authorizes, appears as canonical operator/approver, or changes target outcome.

### ACC-HPA-009 — Bootstrap and dual control are real

- Contracts: `CTR-HPA-009`, `CTR-HPA-010`.
- Method: forward bootstrap artifact review plus integration attempts with missing/extra Scope Grants, missing assignments, same Principal, per-request same control domain, two Agents under one control owner, distinct eligible services, denied/expired approvals, every durable request-state transition, and `outcome_unknown` reconciliation.
- Environment: isolated bootstrap fixture; no real approver identities.
- Expected result: only the three exact additive scopes and reviewed least-privilege Grants/assignments exist; every approval uses distinct requester/approver UUIDs and control domains; only legal state transitions occur; auth-service finalizes once and audits both assignments/domains.
- Failure condition: Human bootstrap dependency, extra/broadened scope, unaudited or non-forward Grant install, self-approval, same-control dual identity, illegal/omitted state transition, second finalization/evidence consumption after unknown, runtime assignment creation, or body executor succeeds.

### ACC-HPA-010 — Disable is immediate and parent-consistent

- Contracts: `CTR-HPA-011`.
- Method: create active Human Session/Refresh Family in fixture, issue Access Token, invoke disable, then attempt every mounted V1 and legacy/compatibility login, token-login auto-update/create, code exchange, and refresh path plus offline Token verification through expiry.
- Environment: isolated real-process integration environment.
- Expected result: every V1 and legacy/compatibility authentication, code exchange, refresh, token-login create/update, and auto-create path immediately rejects the disabled User without User mutation; Session/Family is unusable/revoked; issued Access Token follows parent expiry semantics only.
- Failure condition: any mounted path authenticates, exchanges a Code, refreshes, auto-creates/updates, changes disabled status/profile, leaves a family usable, or promises/restores unsupported immediate Access Token revocation.

### ACC-HPA-011 — Enable does not resurrect old authority

- Contracts: `CTR-HPA-012`.
- Method: disable User with prior Session/Refresh/Code/Token, approve enable, retry every old artifact, then perform a new valid login ceremony.
- Environment: isolated real-process integration environment.
- Expected result: every old artifact remains unusable; only new ceremony may create new authority.
- Failure condition: any old Session, Refresh Credential, Family, Authorization Code, or Token becomes newly usable after enable.

### ACC-HPA-012 — Concurrent enable/disable is serialized and audited

- Contracts: `CTR-HPA-013`.
- Method: barriers launch opposing and repeated status commands with controlled versions/keys; inspect committed status versions and immutable audit order.
- Environment: actual supported database transaction engine.
- Expected result: one total commit order, stale conflict/no-change semantics as specified, before/after versions form a continuous chain.
- Failure condition: lost update, two transitions from one version, unaudited winner/loser, or nondeterministic replay.

### ACC-HPA-013 — Durable audit completeness and fail-closed behavior

- Contracts: `CTR-HPA-014`.
- Method: exercise every enumerated operation/outcome and assert the exact operation-specific nullability rules; inject audit insert/commit failure for read and mutation paths.
- Environment: isolated durable audit store with fault injection.
- Expected result: common safe fields are always present; operation-specific fields are exact values or JSON `null` as contracted; no fabricated sentinel identity/value exists; audit is immutable/queryable; audit failure returns no success and rolls back mutation.
- Failure condition: best-effort-only logging, missing required common field, non-null inapplicable field, null required applicable field, fake/sentinel approver/target/evidence/status/failure, secret data, successful mutation/read without audit, or mutable audit row.

### ACC-HPA-014 — Same-key replay

- Contracts: `CTR-HPA-015`.
- Method: replay byte-different but canonically identical requests before and after terminal result.
- Environment: isolated API/database fixture.
- Expected result: same IDs and terminal outcome, one mutation/approval consumption, replay audit exists.
- Failure condition: duplicate Principal/transition, second approval, different terminal result, or missing replay audit.

### ACC-HPA-015 — Different-request conflict

- Contracts: `CTR-HPA-016`.
- Method: reuse scoped key with changed operation-semantic field and changed evidence digest.
- Environment: isolated API/database fixture.
- Expected result: deterministic conflict, original outcome preserved, no second mutation, bounded conflict audit.
- Failure condition: overwrite, second Principal/status mutation, unrestricted body storage, or non-conflict success.

### ACC-HPA-016 — Concurrent create/claim and duplicate evidence

- Contracts: `CTR-HPA-017`.
- Method: actual-database concurrency and sequential tests for identical create, create-versus-claim, same proof/different UUID, same UUID/different proof, and fresh nonce/proof attestations sharing one stable verifier namespace/subject digest.
- Environment: supported database with real uniqueness/transaction behavior.
- Expected result: at most one User per stable subject binding and at most one target per proof; identical requests reconcile, compatible fresh proofs resolve to the same User, and incompatible requests conflict without sensitive disclosure.
- Failure condition: duplicate User for one stable subject, proof/subject binding attached to two Users, split outcome, or leaked competing User details.

### ACC-HPA-017 — `outcome_unknown` and same-key reconciliation

- Contracts: `CTR-HPA-018`.
- Method: fault injection after commit submission and before acknowledgement, then reconcile with same and different keys.
- Environment: isolated real database/API process.
- Expected result: initial typed `outcome_unknown`; same key returns committed outcome or remains unknown; new-key blind retry rejected.
- Failure condition: false failure/success, duplicate mutation, advice to use new key, or sensitive uncertainty payload.

### ACC-HPA-018 — Deterministic failure replay and audit failure

- Contracts: `CTR-HPA-019`.
- Method: replay authorization, denial, expiry, validation, evidence, not-found, version, and idempotency failures; inject denial-audit failure.
- Environment: isolated fault-injection environment.
- Expected result: bounded deterministic replay where safe; audit failure yields generic unavailable and zero mutation.
- Failure condition: changed replay meaning, unaudited mutation, sensitive error oracle, or protected success during audit outage.

### ACC-HPA-019 — Exhaustive secret and sensitive-data exclusion

- Contracts: `CTR-HPA-020`.
- Method: closed serializer/schema review plus dynamic scanning of endpoints/responses, event payloads, audits, errors, logs, traces/span attributes, metric labels, and idempotency/request-state storage using one sentinel for every forbidden category in `CTR-HPA-020`.
- Environment: isolated instrumented API process and persistence stores.
- Expected result: zero forbidden sentinel/field occurrence in every contracted channel; only explicitly allowed bounded evidence/assignment metadata appears.
- Failure condition: any password/hash, passkey, MFA state/material, credential/verifier detail, Client secret, Authorization Code, Access/Refresh/ID Token, Refresh Family, Session, Authorization header, private key, email, phone, Feishu ID, employee identity, full evidence/raw external subject, unrestricted body, role, assignment, Client, Grant, Scope, Audience, or Machine inventory appears in any channel.

### ACC-HPA-020 — Repository mapping is not written

- Contracts: `CTR-HPA-021`.
- Method: run create, claim, read, enable, disable and inspect auth-service writes and outbound calls with `mayf3` sentinel evidence.
- Environment: isolated auth-service with network/database tracing and no svc-workflow mutation permission.
- Expected result: only canonical Principal/evidence/audit records; no repository mapping table/field/event/call or svc-workflow write.
- Failure condition: automatic `mayf3 -> UUID`, alias mapping, external write, or fallback identity inference.

### ACC-HPA-021 — Candidate and legacy field sets are not reused

- Contracts: `CTR-HPA-022`.
- Method: implementation diff review plus route/schema response comparison against candidate `8d495bc...`, `/api/users`, and `/api/auth/register`.
- Environment: exact implementation commit and integration fixture.
- Expected result: dedicated scopes/routes/serializers, User-only four-field projection, durable audit, no registration/credential response.
- Failure condition: candidate route/fields, machine inventory, legacy safe-user keys, registration side effect, or `auth.identity.provision` reuse.

### ACC-HPA-022 — Forward-only inactive rollout and safe rollback

- Contracts: `CTR-HPA-023`.
- Method: clean-install/upgrade activation test, pre-existing User display-name migration with valid/invalid/missing/colliding fixtures, configuration-default inspection, rollback/disable exercise, and retained-record verification.
- Environment: isolated staging-equivalent deployment.
- Expected result: feature remains inactive until every pre-existing User has an audited canonical display name with no sensitive fallback; collisions remain distinct; rollback disables entrypoints while preserving audit/evidence and without resurrecting authority.
- Failure condition: activation with missing/invalid canonical display name, sensitive/guessed fallback, collision merge, default activation, production/local DB write during authoring, record deletion, status rollback, credential/session restoration, or mapping creation.

### Contract coverage

| Contract | Acceptance | Evidence class | Covered |
|---|---|---|---|
| `CTR-HPA-001` | `ACC-HPA-001` | executed contract/conformance | YES |
| `CTR-HPA-002` | `ACC-HPA-002` | executed integration | YES |
| `CTR-HPA-003` | `ACC-HPA-003` | executed integration | YES |
| `CTR-HPA-004` | `ACC-HPA-004` | executed integration + row delta | YES |
| `CTR-HPA-005` | `ACC-HPA-005` | executed integration + row equivalence | YES |
| `CTR-HPA-006` | `ACC-HPA-006` | verifier fault matrix | YES |
| `CTR-HPA-007` | `ACC-HPA-007` | authorization matrix | YES |
| `CTR-HPA-008` | `ACC-HPA-007`, `ACC-HPA-008` | authorization/spoof matrix | YES |
| `CTR-HPA-009` | `ACC-HPA-009` | bootstrap review + integration | YES |
| `CTR-HPA-010` | `ACC-HPA-009` | approval integration | YES |
| `CTR-HPA-011` | `ACC-HPA-010` | real-process lifecycle | YES |
| `CTR-HPA-012` | `ACC-HPA-011` | real-process lifecycle | YES |
| `CTR-HPA-013` | `ACC-HPA-012` | database concurrency | YES |
| `CTR-HPA-014` | `ACC-HPA-013` | durable audit fault injection | YES |
| `CTR-HPA-015` | `ACC-HPA-014` | idempotency replay | YES |
| `CTR-HPA-016` | `ACC-HPA-015` | idempotency conflict | YES |
| `CTR-HPA-017` | `ACC-HPA-016` | database concurrency | YES |
| `CTR-HPA-018` | `ACC-HPA-017` | commit uncertainty fault injection | YES |
| `CTR-HPA-019` | `ACC-HPA-018` | deterministic failure replay | YES |
| `CTR-HPA-020` | `ACC-HPA-002`, `ACC-HPA-003`, `ACC-HPA-019` | serializer/dynamic leak scan | YES |
| `CTR-HPA-021` | `ACC-HPA-020` | write/outbound trace | YES |
| `CTR-HPA-022` | `ACC-HPA-021` | diff + integration | YES |
| `CTR-HPA-023` | `ACC-HPA-022` | rollout/rollback exercise | YES |

```text
CONTRACT_COUNT = 23
CONTRACTS_WITH_ACCEPTANCE = 23
ACCEPTANCE_COUNT = 22
DANGLING_CONTRACT_REFERENCES = 0
UNCOVERED_CONTRACTS = 0
ACCEPTANCE_WITHOUT_FAILURE_CONDITION = 0
```

## 11. Alternatives and disposition

### ALT-001 — Reuse the local Machine directory candidate

- Disposition: rejected; superseded by the new design direction, without authority lifecycle supersession.
- Reason: it supports only `agent | service`, not User; exposes overly broad Principal/Client/Grant/Scope/Audience/external-reference fields; reuses a write scope for reads; has no durable audit; and has no governing Spec.
- Evidence/Claims considered: `OBS-005`, `CLM-004`, `EVD-004`.
- What would reopen: nothing for direct reuse; independently proven low-level utility reuse remains subject to `CTR-HPA-022`.

```text
LOCAL_MACHINE_DIRECTORY_CANDIDATE = 8d495bc46383d638fe80ae9f96d0061f498cd25a
AUTHORITY_STATUS = none
DESIGN_DISPOSITION = superseded by the new design direction
AUTHORITY_LIFECYCLE_SUPERSESSION = not applicable
CANDIDATE_CHERRY_PICK_ALLOWED = NO
```

The candidate MUST NOT be used as an implementation baseline or retrospective authorization.

### ALT-002 — Reuse `auth.identity.provision` for all Human reads and writes

- Disposition: rejected.
- Reason: violates read/write least privilege and carries machine provisioning semantics into Human identity administration.
- Evidence/Claims considered: `OBS-004`, `CLM-003`.
- What would reopen: a whole authority change proving equivalent least privilege; not delegated to implementation.

### ALT-003 — Create active Users with generated credentials

- Disposition: rejected.
- Reason: collapses Principal establishment into credential and Token issuance and cannot prove human control.
- Evidence/Claims considered: `OBS-003`.
- What would reopen: a separate accepted credential/bootstrap authority; it would not silently amend this Spec.

### ALT-004 — Require an existing Human approver for bootstrap

- Disposition: rejected.
- Reason: circular when the first Human Principal is not yet safely established.
- Evidence/Claims considered: `CLM-006`.
- What would reopen: a separately accepted bootstrap authority replacing this design.

### ALT-005 — Let auth-service own `mayf3 -> UUID`

- Disposition: rejected.
- Reason: external Product Direction assigns the mapping to a future svc-workflow Root authority.
- Evidence/Claims considered: `OBS-007`, `CLM-005`, `EVD-007`.
- What would reopen: an accepted external whole-authority successor plus local authority reconciliation.

## 12. Migration, compatibility, and rollback

```text
MIGRATION = future forward-only implementation; none performed by this proposed Spec
DATA_BACKFILL = not authorized by this proposed Spec
COMPATIBILITY = preserve all parent Human/Machine/OBO/RS256 behavior
ACTIVATION_DEFAULT = inactive
ROLLBACK = disable new management entrypoints; preserve audit/evidence/outcomes
EMERGENCY_CONTAINMENT = immediate User disable under CTR-HPA-011
PRODUCT_CODE_CHANGED_BY_AUTHORING = NO
PRINCIPAL_WRITE_PERFORMED = NO
ROOT_MAPPING_WRITE_PERFORMED = NO
```

A later implementation may require schema and migration work, but only after this Spec is independently reviewed, accepted, merged to the implementation base, and pinned. The implementation must define exact files and migration mechanics in its PR and prove every Contract. It MUST NOT retrofit required semantics into legacy registration, machine provisioning, or the old candidate without conformance.

If `MINIMAL_AUTH_FOUNDATION_V2` becomes active before this Spec is reviewed or accepted:

```text
AUTHORITY_RECONCILIATION_REQUIRED = YES
CURRENT_SPEC_REVIEW_BINDING_INVALID_UNTIL_RECONCILED = YES
```

Rollback never means restoring pre-disable Session/Refresh/Token authority or deleting durable audit.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
BOOTSTRAP_AUTHORITY_UNRESOLVED = NO
OWNER_DECISION_REQUIRED = NO
AUTHORING_READY_FOR_REVIEW = YES
READY_TO_MARK_ACCEPTED = NO
PRODUCT_IMPLEMENTATION_AUTHORIZED = NO
CONFORMANCE_PENDING = YES
```

Real production requester/approver Principal UUIDs and the svc-workflow Root roster remain intentionally unselected operational/governance inputs; they are not normative gaps in this auth-service Spec. They MUST be supplied only through the reviewed assignment and external Root-authority mechanisms defined above, never guessed by an implementation Agent.
