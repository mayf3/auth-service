---
spec_id: AUTH_SERVICE_FORUM_MINT_AUDIT_REPAIR_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - Forum direct-agent mint helper typed audit event and scope preservation
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_FORUM_MINT_AUDIT_REPAIR_V1

## 1. Goal and scope

Restore a clean TypeScript build and preserve the exact scopes in the existing Forum mint helper's success audit event. This is the outstanding T52 audit follow-up, not a new token profile, endpoint or consumer migration.

In scope: the audit event type, the audit object's `scopes` property, focused synthetic-key regression evidence, and a clean build. Out of scope: JWT wire fields, profile JSON, claims validation, signing, keys, issuer/audience, grants, schema, database migrations, HTTP wiring, Forum implementation, deployment and legacy removal.

## 2. Route and authority

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND (same proposed authority and Decision scope)
BASE_HEAD = 6cf266386d815f5c822ce3d59905209210efb29b
AFFECTED_SOURCE_HEAD = f026d812699f0ac58e5678b4c645d84012ed4cfb
AFFECTED_SOURCE_TREE = 6d829ed47d03865915cbdb8474389a30c92faf05
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED_WHILE_PROPOSED = NO
PRODUCTION_APPLY = NONE
```

The parent preserves credential-safe auditing and the distinction between source conformance and production effectiveness. It does not name this helper's event; this Spec owns only that bounded missing decision. The existing `docs/contracts/forum-direct-agent-token-profile.json` is preserved as historical T52 input, not promoted to a broader governing authority by this repair. The accepted V1 JWT `scope` claim is unchanged: the plural `scopes` below is solely the existing local audit field.

Current Owner request authorizes residual repair/governance preparation. The historical T52 record at `MULTI_REPO_REPAIR_QUEUE.md` lines 600–615 records the original paired implementation and the audit follow-up. Neither that queue nor this proposed document self-accepts a new governing Spec. Only Owner acceptance of an independently reviewed exact head, merged into main, permits the subsequent implementation.

## 3. Evidence and state

2026-10-18 refresh: this is an adjacent review candidate, not an installed governing Spec. Preserve the original `DEC/CTR/ACC-FMAR-*` identities and exact three-file scope. Historical input is `a00b3a5b738df7fd6bb3e351860da481b338390a`, Spec blob `b43156415c3d17fd49e3b703677cf06f69c3461e`; transplant this file only, never the unrelated refresh Spec/plan in that commit. The current build receipt at `/Users/yanfenma/workspace/project/pilot1156-review-20261018/auth-runtime-build-f026d81/BUILD_RECEIPT.json` already proves TS2322 and no emitted dist at f026d812. No build or old test was rerun for this refresh. Both affected source blobs are identical at historical862eab3, accepted6cf2663 and fixedf026d812. The following September observations retain their original historical coordinates; they are not October executions. Union-only fixes the first reported type mismatch but leaves the fresh audit object key `scope` outside `AuditEvent`; a subsequent excess-property diagnostic is a source-based inference, not a newly executed compiler result. Restoring serialized `scopes` is a runtime audit change, so the complete repair has no mechanical exemption. No change to MCP frozen18 paths or any source occurs in this proposal.


### OBS-FMAR-001 — Clean build failure

- Source/revision: mayf3/auth-service at historical base `862eab36677d214b2ce340f49bb141173b51efea`, `src/lib/oauth/forum-direct-agent-token.ts:142` and `src/lib/oauth/audit.ts:16`.
- Environment/time: isolated dependency installation and Prisma generation, 2026-09-25; no `.env` or production credentials.
- Method/result: `npm run build` exits 2 with TS2322: `forum.direct_agent_token.minted` is absent from `AuditEventType`.
- Provenance: task baseline log `auth-launch-baseline-20260925-build.log`; historical record `docs/reports/2026-09-14-canonical-identity-foundation.md:62` independently identifies the same pre-existing build failure.

### OBS-FMAR-002 — Scope omission and exposure boundary

- Source/revision: same historical `862eab36677d214b2ce340f49bb141173b51efea` base, mint helper audit object uses `scope` at line 146; serializer includes only `event.scopes`.
- Method/result: independent reviewer used a synthetic in-memory RSA keyring and captured a successful helper mint audit: token produced, audit scopes absent. Source search found no production route/script caller of this helper; only tests call it.
- Environment/time: isolated local process, 2026-09-25; no database I/O or production key access.
- Provenance: independent `/root/code_audit` source review and probe in this task. Full HTTP exposure is not established.

### CLM-FMAR-001 / STATE-FMAR-001

SUPPORTED: at this base the build is broken and helper audit scopes are lost. Runtime token issuance elsewhere, database schema drift or deployed Forum impact cannot be inferred from these observations.

### EVD-FMAR-001

OBS-FMAR-001 and OBS-FMAR-002 SUPPORT CLM-FMAR-001 and STATE-FMAR-001 at the exact base and environments above. Sufficiency: build/type failure and serializer mismatch. Limits: not production delivery evidence and not an accepted repair decision. Before acceptance, independent review must reproduce the build failure or inspect its durable receipt and verify source locations/unchanged scope semantics.

## 4. Decisions

### DEC-FMAR-001 — Preserve event identity and audit exact minted scopes

Decision owner: mayf3 upon acceptance. Preserve the already emitted event string `forum.direct_agent_token.minted`, explicitly type it, and pass the helper's unchanged `params.scope` into the existing `scopes` audit field. Do not disguise minting as principal resolution, silence typing, or change the token's singular `scope` claim.

## 5. Contracts

### CTR-FMAR-001 — Typed success event

`AuditEventType` MUST admit exactly the additional literal `forum.direct_agent_token.minted`. The successful Forum helper MUST continue to emit that event after signing. The repair MUST NOT widen the type to arbitrary strings, use `any`/type assertion suppression, or substitute another event identity. Existing audit event literals and behavior MUST remain unchanged.

### CTR-FMAR-002 — Scope preservation and credential safety

The helper's success audit MUST provide `scopes: params.scope`, preserving its exact existing space-delimited value; the serializer MUST expose this through its existing allowlisted `scopes` field. The emitted JWT MUST continue to use `scope: params.scope`. All other JWT/profile/signature/return fields and failure behavior MUST remain unchanged. The repair MUST NOT log the token, private key, client secret, raw request or credential verifier, nor change existing client-ID masking.

### CTR-FMAR-003 — Exact bounded implementation

The only permitted implementation files are:

1. `src/lib/oauth/audit.ts` — one event literal addition only.
2. `src/lib/oauth/forum-direct-agent-token.ts` — rename the audit object key `scope` to `scopes` only; JWT payload key remains singular.
3. `tests/oauth/forum-direct-agent-profile.test.ts` — add regression assertions for event identity, exact audit scopes, unchanged JWT scope and forbidden-secret absence using disposable synthetic keys.

No accepted authority, bundle, registry, schema, migration, dependency, deployment configuration or other source file may change. A scope expansion requires re-PREFLIGHT. Tests MUST expose the original omission without weakening existing expectations.

### CTR-FMAR-004 — Lifecycle and delivery boundary

Spec acceptance authorizes only the subsequent bounded implementation and isolated conformance. Independent exact-head implementation review and clean build are required before merge. Production delivery needs its own pinned artifact, approved controlled runbook, prestate, rollback and receipts; acceptance and source merge do not authorize production mutation. No database migration or credential access is necessary for this repair.

## 6. Acceptance

### ACC-FMAR-001 — Type and build

- Contracts: CTR-FMAR-001, CTR-FMAR-003.
- Method: clean exact-lockfile dependency install, Prisma generation and `npm run build`; inspect TypeScript event union and exact file diff.
- Environment: isolated worktree with synthetic env only.
- Required evidence: exact base/head, dependency/tool versions, full command exit and source diff; independently reviewed build receipt.
- Expected: exit 0, correct event literal, no suppression or extra file delta.
- Failure: compile error, wrong event, weakened types, dependency workaround or extra source delta.

### ACC-FMAR-002 — Audit and JWT regression

- Contracts: CTR-FMAR-001, CTR-FMAR-002, CTR-FMAR-003.
- Method: mint using a disposable RSA keyring with representative one/multiple allowed Forum scopes; capture the existing logger output; verify the signed token against the synthetic public key. Assert event identity, exact `scopes`, unchanged JWT `scope`, client masking and no synthetic token/private key/credential sentinel in captured logs. Demonstrate the pre-fix omission fails the regression.
- Environment: isolated process, no production DB/key/credential.
- Required evidence: test source and executed red/green results bound to exact revisions; retain no token or key material in receipts.
- Expected: audit scope matches token scope exactly, wire behavior unchanged, secret scan passes.
- Failure: omitted/rewritten scope, plural JWT claim, changed signing/profile behavior, false event or logged secret.

### ACC-FMAR-003 — Governance and operations separation

- Contracts: CTR-FMAR-003, CTR-FMAR-004.
- Method: independently compare the final implementation file/delta closure to this accepted Spec in its base, review build/test receipts, verify zero production/config/schema/credential operations in implementation.
- Environment: exact remote candidate and base before merge.
- Required evidence: independent reviewer identity, exact commits, closure matrix and executed evidence.
- Expected: only three-file bounded implementation; all Contracts covered; delivery separately gated.
- Failure: proposed-only authority, missing exact review, production mutation or enlarged behavior.

| Contract | Acceptance |
|---|---|
| CTR-FMAR-001 | ACC-FMAR-001, ACC-FMAR-002 |
| CTR-FMAR-002 | ACC-FMAR-002 |
| CTR-FMAR-003 | ACC-FMAR-001, ACC-FMAR-002, ACC-FMAR-003 |
| CTR-FMAR-004 | ACC-FMAR-003 |

## 7. Alternatives, rollback and open questions

Rejected: `principal.resolved as any` falsifies event identity; adding a second serializer alias conceals the faulty caller; changing JWT to `scopes` breaks the wire contract; adding a database migration is unrelated. Correct only the typed event and local audit property.

Source rollback reverts the bounded implementation and restores the known build/audit defect; it is not a healthy release candidate. Existing healthy production remains unchanged during this work. Any later production rollback must use its separately reviewed deployment plan.

```text
OPEN_OWNER_DECISIONS = NONE for candidate behavior; exact-head acceptance pending
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 4
CONTRACTS_WITH_ACCEPTANCE = 4
READY_TO_MARK_ACCEPTED = NO until independent review and Owner exact-head acceptance
```
