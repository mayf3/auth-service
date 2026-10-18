# Auth MCP execution governance — complete proposed candidate

## DEVELOPMENT_PREFLIGHT and authority route

```text
TARGET_REPOSITORY = mayf3/auth-service
BASE_HEAD = 6cf266386d815f5c822ce3d59905209210efb29b
CURRENT_REMOTE_MAIN_OBSERVATION = same base, git ls-remote, 2026-10-18
ISOLATED_REF = docs/mcp-auth-execution-v2-20261018
ISOLATED_WORKTREE = /Users/yanfenma/workspace/project/auth-service-mcp-governance-v2-20261018
SPEC_GOVERNANCE_MODE = AUTHOR
ROUTE_STAGE = AUTHORITY_AUTHORING
SUPPLY_ACTION = SUPERSEDE whole AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1
RELEASE_ACTION = NEW AUTH_SERVICE_MCP_CANDIDATE_RELEASE_V1
FORUM_ACTION = AMEND existing proposed AUTH_SERVICE_FORUM_MINT_AUDIT_REPAIR_V1
PRIMARY_PARENT = MINIMAL_AUTH_FOUNDATION_V2
PLAN_LEVEL = EXEC_PLAN (Supply/release); BRIEF (Forum)
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
SPEC_GAP_DEPENDENCY = LOAD_BEARING
AUTHORITY_ACCEPTED_IN_BASE = NO for these new candidates
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MERGE_READY = NO
MUTATION_AUTHORIZATION = VALID for isolated docs-only preparation and Draft PR only
```

The current direct user instruction authorizes this original Auth actor to prepare complete proposed Specs, a reviewed docs-only Draft PR and exact acceptance decisions. It does not appoint an Auth acceptance actor or authorize source/runtime mutation in this stage. Original thread `01a0d846-431e-7dc0-95e2-a841cd0bff5a`, UserMessage `01a0d846-4d74-7302-879d-2f3038d2d575`, clientId `1e125186-3937-49a9-9276-257d7b82fdfa` remain the technical lineage. The current user instruction explicitly retains original MCP production/newRID authorization; its durable directive SHA256 is `310589742f966dd176fac95d3360d2bdc6bf0109c2ba10ec9795f6bc76bc39c3`. No new execution goal or production writer is created. The original MCP goal is blocked per the current handoff, not changed here.

Preparation stops at a complete independently reviewed Draft; it MUST NOT self-accept or merge. Only `mayf3 | explicitly delegated auth-service maintainer` may accept new authority. The coordinator's prior delegation applies only to two fixed contracts at `c04599b301f3e757475bc20960992cb5d024106a`, not these three proposals or the new account trust policy.

## Exact docs scope and unchanged surfaces

This candidate changes only:

1. `docs/specs/AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V2.md` — full proposed successor.
2. `docs/specs/AUTH_SERVICE_MCP_CANDIDATE_RELEASE_V1.md` — full proposed release contract.
3. `docs/specs/AUTH_SERVICE_FORUM_MINT_AUDIT_REPAIR_V1.md` — original proposed identity and bounded behavior restored.
4. `docs/specs/README.md` — proposed index entries only.
5. This plan — attribution, exact future lifecycle patch and handoff.

No accepted Spec is edited in this Draft. In particular Supply V1 remains accepted, with `superseded_by: null`, and the accepted Audience CCR is byte-identical. Source `f026d812699f0ac58e5678b4c645d84012ed4cfb` / tree `6d829ed47d03865915cbdb8474389a30c92faf05`, frozen18 paths, generated artifacts, production directories, DB, configuration, daemons and original receipts are untouched. No product tests,17/139 reruns, npm install/ci, Prisma generation, full fetch/clone, LA prompt or production probe occurs.

## Evidence, present state and design consequences

The decision baseline is adjacent `AUTH-ORIGINAL-ACTOR-TECHNICAL-DECISION-20261018.json`, SHA256 `5f8000788075622c1ae58c4c0ea66591b41d7bc0704f416cf9f8e55b1be4c15c`. Its two independently reviewed proposals remain unchanged outside this worktree. Complete Specs are a new exact text and receive one independent semantic review; old proposal review does not substitute for that review.

Original MCP receipt `AUTH_DB_AUDIENCE_OBSERVATION_20261018.json`, SHA256 `881bf61aa02e9ce016113ec2b95de227fc6d8ec184cb77828d241a7dcdccc0ce`, proves only the fixed target's Agent@1 preimage at 03:56:47.983Z and historical audit candidate, not a new operation authorization or related consumer absence. `AUTH_DB_ROUTE_DELTA_20261018.json` SHA256 `435bfd65e86334bed646f7c85731d845a6d6f22ac5317db566a7b46e9269d476` is factual handoff. Exact public resource/scope remain `agent-core-mcp-conversation-v1` / `conversation.access`; Audience@2 is only a DB CAS version, and new Grant version remains1.

Original health startup cache1.13 and fixed candidate1.14/source-only archive are separate from a runnable release. The existing build receipt (`d5ae23e73af7b56bafacd283076351afae4165f7338208f240300e631dd4cac2`) records TS2322/no dist. Union-only is incomplete: restoring helper audit `scopes` changes logged behavior. The recovered Forum proposal remains proposed and keeps the JWT singular `scope`.

There is no established accepted production Human adapter. The new Supply policy selects one real current native authentication of the proposed mayf3↔yanfenma/uid502/GeneratedUID binding, followed by a finite60minute pilot delegation. Original executor automatically derives separate exact plans/nonce/one-attempt mandates; ordinary migration/load/supply and the bounded original-secret/forward-disable recovery do not each prompt the Owner. The single prompt is at final artifact readiness before stop, lasts at most120seconds, and requires actual Touch ID or local account password interaction that cannot be automated or replaced by root/staticJSON. It is a new trust-policy consequence requiring precise acceptance, not a withdrawal or repeated request for the already authorized MCP effects. A genuinely existing independently verifiable delegation would be preferred if established; current evidence does not establish one, and no verification API is invented. Expired/changed/unverifiable delegation does not permit retry or authentication that clears an UNKNOWN fence.

The release authority proposes one original launchd job, one serving process and a pre-listen check; candidate load failure stays stopped. It does not restore the old automatic IDR rollback/resume script. Its explicitly chosen supervision/privilege/availability tradeoffs must be reviewed and accepted as part of that precise Spec; they are not inferred from the generic launch request.

## Atomic lifecycle patch — planned, NOT applied

The base accepted Supply V1 bytes SHA256 are `df5ff4c536da553f16d0a5dce8658cd660082d4f0b8c37a303f71c29a33e2f2e`. A qualified acceptance actor must first confirm the final independently reviewed exact Spec_HEAD/file digests, unchanged relevant base and attributable acceptance. If content or base moves semantically, review only the actual changed surface before acceptance. No status flip is allowed merely to make a validator pass.

In ONE later docs-only acceptance commit/merge, apply all these lifecycle changes atomically:

```diff
--- docs/specs/AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1.md
+++ docs/specs/AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1.md
@@ frontmatter
-status: accepted
+status: superseded
@@ frontmatter
-superseded_by: null
+superseded_by: AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V2
```

Retain V1's original accepted_by/date/reviewed-head metadata and complete historical body; add immediately before its existing ACCEPTED banner a factual notice that the whole authority is superseded by V2, linked to the actual new acceptance record. The old banner is retained as historical provenance, never represented as current governing status.

```diff
--- docs/specs/AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V2.md
+++ docs/specs/AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V2.md
@@ frontmatter
-status: proposed
+status: accepted
```

V2 already carries `supersedes: [AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1]`; that backlink must remain. Its acceptance record must identify the real qualified actor, actual time, reviewed commit, reviewed file SHA and independent reviewer. Do not fill those with forecast values during authoring. The actor adds a factual acceptance banner identifying the original proposed text as history; Contracts do not change during the lifecycle flip.

The same acceptance commit changes the Release V1 and Forum V1 frontmatter from proposed to accepted and records their exact qualified acceptance, or leaves either wholly proposed if the actor elects not to accept it. Supply's production path cannot become executable until its named accepted release dependency is present in the implementation base. Never mark a rejected dependency accepted to complete this bundle. Update index statuses to exactly match the decided documents and V1's whole-authority retirement. Preserve the Audience CCR unchanged. Acceptance records belong in `docs/audits/`; references bind actual emitted hashes/commit IDs, not fabricated placeholders.

This recipe is an exact future patch procedure, not an unapplied accepted-state patch hidden as current authority. Current files all remain proposed; no accepted_by or acceptance timestamp is invented. A later acceptance actor must record final-head recheck and main merge. No partial supersession or mixed V1/V2 enforcement is allowed. An Agent may prepare that mechanical transition after a precise qualified acceptance but cannot supply the missing decision itself.

## Implementation boundaries after later qualified acceptance

- Supply V2: exactly original3 Supply source paths plus `scripts/mcp-pilot-human-auth.swift`; its finite delegation and migration own the new behavior.
- Release V1: exactly its named3 wrapper/runner/test paths and separately pinned controlled deployment artifacts. No new permanent control plane.
- Forum V1: exact3 old proposed paths and semantics. No type widening, skipped compiler or unrelated patch from the old commit.

These are future implementation closures, not changes in this Draft. Source implementation starts in a new isolated surface whose base includes the accepted authority. The fixed f026 source is retained as provenance; a future combination has a new head/tree/artifact/build receipt. No generic requirement to merge every implementation to main is invented. Native behavior, affected source tests/full build and actual production proof remain NOT_RUN in this docs-only stage.

## Independent review and Done When

Author root owns Supply/Forum/index/plan; `/root/auth_build_scope_review` authors only Release. `/root/auth_trust_decision_review` authors none of these files and performs the single complete semantic review bound to base/Spec_HEAD/five-file diff/hash. Later fixes receive only actual-delta review plus final-head binding. The review must examine finite delegation vs repeated Human interaction, origin/custody/restart/nonces/fences, fixed row CAS/version/audit/history, actual mode/cache/DB pre-listen gate and supervisor privilege/availability consequences. It cannot call proposed policy accepted, GUI feasibility measured, or product tests run.

Done When: complete proposed normative text with total Contract→Acceptance mapping and no normative TBD; independent exact-head verdict with truthful residuals; remote docs-only Draft PR/head readback; and `AUTH-DOCS-CANDIDATE-READY-20261018.json` linking base/ref/head/file/diff/review hashes and the finite qualified acceptance decision. Readiness means ready for the explicit acceptance decision, not implemented or deployed. If a load-bearing semantic issue cannot be resolved, retain the completed Draft and report that exact issue rather than claim READY.

Cleanup is limited to this stage's redundant intermediates; retain worktree/ref, Draft PR, full diff and review/receipt evidence while the acceptance decision is pending. No global worktree prune, unrelated cache cleanup or deletion of protected evidence/source/release/thread/production/daemon is authorized here.
