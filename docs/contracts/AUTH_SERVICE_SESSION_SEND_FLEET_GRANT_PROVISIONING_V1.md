# AUTH_SERVICE_SESSION_SEND_FLEET_GRANT_PROVISIONING_V1

> **NORMATIVE STATUS: NONE.** This document is a NON-NORMATIVE
> implementation/conformance record. It creates no authority, adds no
> product semantics, and imposes no independent acceptance obligations.
> The sole normative authorities are: (a) the fleet-send product semantics
> `AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1` **r4** (dsh-agent-core
> `docs/specs/`, r3 accepted @6bce155 2026-09-15; r4 AMENDMENT_1
> INSPECTION_PRESERVATION accepted @5dd41e2 2026-09-16, joint acceptance);
> and (b) the Auth-local materialization implementation authority
> `AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1`
> (accepted @a7ca28e 2026-09-16, same joint decision). Everything below is
> restated only to record how the implementation conforms to them. On any
> divergence, those Specs prevail and this record must be corrected.

## A. Scope

```text
IN : recording the birth-provisioning implementation coordinates (§B)
     recording the reconciliation implementation coordinates (§C)
     recording the frozen agent-session-messaging audience row (§D)
     recording the registry-source state and its history (§E)
     recording the issuance-invariance verification (§F)
OUT: token issuance / deny code paths (I4: unchanged)
     any other audience, scope, principal, or registry row (hygiene boundary)
```

## B. Birth provisioning — implementation coordinates (post-REVISE)

- Transactional create (T1, closes P1-A): the CREATE outcome of
  `createOrGetClient` (`src/lib/oauth/v1/idempotent.ts`) runs client
  creation and the fleet grant stamp inside ONE `prisma.$transaction`; any
  grant/storage failure rolls the client row and secret hash back with it,
  so the first one-time secret is never orphaned in a dead call frame. The
  idempotent external_ref retry then re-creates fresh and returns a new
  secret (T3). Claim/resolve paths return no secret by channel design.
- Route convergence (`src/routes/idempotent.ts`, `POST /api/v1/clients`):
  the route-level stamp now runs only for non-create outcomes
  (fast-resolve / claim / concurrent-winner) — all idempotent make-lawful
  no-ops when already lawful; the create outcome is already stamped in-tx.
- Module: `src/lib/oauth/v1/fleet-send-grant.ts`
  (`ensureFleetSessionSendGrant`, injectable store; also `makeLawfulScopes`
  and the `ENUMERATED_INDEPENDENT_SCOPES` closed set).
- Guard (governing Spec §3/§4): only `principal_type='agent'` principals
  (Prisma lowercase literal; humans are `User` rows, structurally
  unreachable).
- Make-lawful (dsh r4 §3, closes P1-B): ADD always writes exactly
  `['agent.session.send']`; an existing row is normalized to
  `makeLawfulScopes(current)` = send ∪ (current ∩ ENUMERATED) — send added
  when absent, enumerated independent scopes preserved verbatim
  (`agent.session.inspect_own_dispatch` ← its own accepted Auth authority;
  never granted/removed/created by FLEET), only non-enumerated extras
  stripped, version incremented only on actual set change.
- Concurrency (T2, closes P2): a unique violation (P2002) on the grant
  create is caught, the winner's row re-read, and the make-lawful decision
  converged against it — P2002 is never rethrown from the stamp.
- Failure semantics: storage errors outside the convergence path propagate
  (fail closed). A missing/inactive audience row skips with audit
  `client.fleet_grant_skipped` (`audience_absent_or_inactive`); the
  reconcile script refuses in that state.
- Audit events in the closed `AuditEventType` union (additive only):
  `client.fleet_grant_ensured`, `client.fleet_grant_skipped`,
  `fleet_send_grant.materialized`.
- Deployment note: effective only after auth-service is redeployed; the
  reconcile script converges the existing fleet independently of deploy.

## C. Reconciliation — implementation coordinates

- Script: `scripts/reconcile-fleet-send-grants.ts`.
- Reconcile NORMALIZE uses the same make-lawful semantics (§B); census
  `sendEntitlementMissingCount` counts ADD + NORMALIZE pairs (send absent
  or set unlawful), so an HR dual-scope row counts as entitled.
- Governing Spec §5 requirements R1–R6, and how the implementation conforms:
  - R1 fresh membership recompute at execution time: G1 agents.json
    (`--agents-json`, default the runtime config path) ∩ G2
    MachinePrincipal(`principal_type='agent'`, `status='active'`, bound to
    the exact agent_id) ∩ G3 every active MachineClient (client-keyed
    pairs). No cached roster; no CLI agent-id list.
  - R2 DRY_RUN default; prints census
    (`productionCanonicalAgentCount`, `sendEntitlementMissingCount`,
    ADD/KEEP/NORMALIZE counts, non-fleet count) + per-pair plan.
  - R3 `--apply` performs idempotent ADD (create) / NORMALIZE (exact-scope
    set + version increment) only; **zero DELETE** — non-fleet rows are
    counted and never mutated; their inertness is enforced by issuance-time
    active checks.
  - R4 `--selftest` is offline (pure planner fixtures, no DB, no
    agents.json) and must be ALL_OK before any Owner handoff.
  - R5 every mutation emits one `[AUDIT]` JSON line; a post-apply
    verification pass recomputes membership fresh and requires
    `SEND_ENTITLEMENT_MISSING_COUNT=0` (exit 3 otherwise).
  - R6 execution is an Owner act on the authsvc host (DB/`.env` wall).
- Exit codes: 0 green · 1 selftest failure · 2 audience absent/inactive
  (fail-closed refusal) · 3 post-apply verification failed.

## D. The audience row (recorded frozen content)

On the current integration base the row is present in the repository bundle
(`contract-bundles/minimal-auth-v1/audience-registry.json`,
`registry_version 1.12.0`), byte-content-identical to the deployed runtime
snapshot and the live `AuthAudience` DB row. Original registrant authority:
`AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2`. Exact content as
cross-checked:

```json
{
  "audience_id": "agent-session-messaging",
  "resource_service": "agent-session-messaging",
  "scope_namespace": "agent",
  "accepted_principal_types": ["agent"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": [
    "agent.session.inspect_own_dispatch",
    "agent.session.send"
  ],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2 for canonical send and independently granted caller-owned exact-turn inspection consumed by dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_V2."
}
```

The fleet policy consumes ONLY `agent.session.send`. The inspect scope in
`registered_scopes` is a future-surface reservation: it is NOT granted by
anything in this record, and per governing Spec §3 any future grant of it
requires amending that Spec first (grant PK `(machine_client_id,
audience_id)` means both authorities would collide on one row).

## E. Registry-source state and history

- Current state (integration base af617ae): repository bundle ==
  deployed ledger (`registry_version 1.12.0`, twelve audiences including
  `agent-session-messaging`). The repo-side registry source for the row is
  the bundle itself; §D records the cross-check against the deployed
  snapshot.
- History (for the record): at the implementation's original base
  (170736e) the bundle was still frozen at the first-wave state
  (`registry_version 1.2.0`), an in-bundle backport attempt made during
  implementation was correctly refused by `validate.mjs`'s frozen-first-wave
  gate and reverted, and the full 1.12.0 bundle backport then landed
  upstream (PRs #70–#74 window) before this branch was rebased. The
  "bundle backport DEBT" that implementation-time evidence recorded is
  therefore **discharged upstream**; nothing remains owed by this record.

## F. Issuance invariance (I4) — verification record (post-REVISE)

`src/lib/oauth/v1/direct.ts` (issuance + the
`client_or_principal_inactive` active check), `grant-migration.ts`, and
`token-issuance.ts`: still ZERO diff — token issuance and deny semantics
are untouched. `src/lib/oauth/v1/idempotent.ts` IS changed under the
accepted Auth-local spec's T4 authority (provisioning wiring only):
injectable `CreateOrGetClientStore` delegate, and the create path wrapped
in `prisma.$transaction` with the in-transaction fleet stamp (T1). The
grant row remains the sole issuance predicate for this audience; row
inertness comes exclusively from issuance-time
`client.status`/`principal.status` checks — there is deliberately no
row-level revocation flag on `MachineAccessGrant`.

## G. Lifecycle discipline (restatement of governing Spec §6 — no new rule)

The governing Spec §6 requires that disable/retire of a production Agent
land the bound principal/client inactive (existing `machine-admin`
surfaces provide this); the entitlement then fails closed at issuance
(`client_or_principal_inactive`) with zero code change. It likewise
defines that removing an agents.json entry alone does not constitute
retire: a residual grant row in that state is inert only under that
discipline, and `DISABLED_RETIRED_AGENT_SEND=DENY` is structurally
guaranteed only on the deactivation path. This section adds nothing; it
records that the implementation relies on exactly that inherited
discipline.

## H. Verification inventory (post-REVISE candidate)

```text
tests/oauth/fleet-send-regression.test.ts  RG1/RG2/RG3 all PASS (promoted
  from the 3/3 RED reproductions; transactional-rollback + PK-enforcing
  store doubles)
tests/oauth/fleet-send-grant.test.ts       10/10 (DB-free; injected store;
  make-lawful cases: dual-scope kept, non-enumerated stripped, send added
  preserving inspection)
scripts/reconcile-fleet-send-grants --selftest   SELFTEST_ALL_OK (fixtures
  updated to make-lawful expectations)
npm run contract:v1:validate               MINIMAL_AUTH_V1_BUNDLE_VALID=true
npx tsc --noEmit -p tsconfig.json          1 error — PRE-EXISTING AT BASE:
  forum-direct-agent-token.ts audit-type union gap (unchanged by this work)
npm run test:contract-v1                   base/head double-run on the PR:
  identical failing sets, NEW_FAILURES=0 (pre-existing: schema>500-line
  static debt; upstream frozen-snapshot test)
tests/idempotent-conformance.test.ts       cleanup helper now deletes
  machineAccessGrant rows before the client (mechanically required by T1:
  create-path stamping writes grant rows for agent principals; FK would
  block client cleanup); still requires a live DB (Owner environment)
```

## I. Provenance

- Implementation commit (original base 170736e): 7f600e5.
- Bounded impact check before PR: upstream main had moved to af617ae
  (199 files, including `src/lib/oauth/audit.ts` and
  `src/routes/idempotent.ts` and — relevantly — the registry bundle
  backport). Branch rebased onto af617ae: the only conflict was the
  import block of `src/routes/idempotent.ts` (upstream's GET
  identity-discovery routes + this record's stamp imports); the stamp call
  in the POST handler carried over verbatim; all six changed files
  re-verified on the new base.
- Governing spec authority: dsh-agent-core @ 6bce155 (unmodified;
  dsh-side delta after acceptance is evidence-only).
