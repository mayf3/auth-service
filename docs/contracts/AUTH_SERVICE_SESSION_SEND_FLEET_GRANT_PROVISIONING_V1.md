# AUTH_SERVICE_SESSION_SEND_FLEET_GRANT_PROVISIONING_V1

> **NORMATIVE STATUS: NONE.** This document is a NON-NORMATIVE
> implementation/conformance record. It creates no authority, adds no
> product semantics, and imposes no independent acceptance obligations.
> The sole normative authority for the fleet send entitlement is
> `AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1`
> (dsh-agent-core `docs/specs/`, accepted by Owner exact-head acceptance at
> **6bce155**, 2026-09-15); every requirement cited below — including all
> lifecycle and provisioning rules — is inherited from that Spec verbatim
> and is restated here only to record how the implementation conforms to
> it. On any divergence, the governing Spec prevails and this record must
> be corrected.

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

## B. Birth provisioning — implementation coordinates

- Route: `POST /api/v1/clients` (`src/routes/idempotent.ts`) — after
  `createOrGetClient` succeeds, inside the same channel flow, for create /
  claim / resolve / concurrent-winner outcomes alike (the stamp is
  convergent on every path).
- Module: `src/lib/oauth/v1/fleet-send-grant.ts`
  (`ensureFleetSessionSendGrant`).
- Guard (as the governing Spec §3/§4 requires): only
  `principal_type='agent'` principals (Prisma lowercase literal; the enum
  is `agent | service`; humans are `User` rows and never
  MachinePrincipals, so they are structurally unreachable).
- Target row (governing Spec §3): `{ machineClientId, audienceId =
  'agent-session-messaging', scopes = ['agent.session.send'], version >= 1 }`
  — grant physical PK is `(machine_client_id, audience_id)`; the model has
  **no revoked_at column**.
- Failure semantics (as the governing Spec's fail-closed posture requires):
  storage errors propagate (provisioning call fails closed; the idempotent
  external_ref retry heals). A missing or inactive audience row is skipped
  with audit `client.fleet_grant_skipped`
  (`audience_absent_or_inactive`) — without the audience there is no lawful
  entitlement to materialize; the reconcile script refuses in that state.
- Audit events added to the closed `AuditEventType` union:
  `client.fleet_grant_ensured`, `client.fleet_grant_skipped`,
  `fleet_send_grant.materialized` (additive only).
- Deployment note: the birth-stamp takes effect only after auth-service is
  redeployed from a build containing it; the reconcile script converges the
  existing fleet independently of any deploy.

## C. Reconciliation — implementation coordinates

- Script: `scripts/reconcile-fleet-send-grants.ts`.
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

## F. Issuance invariance (I4) — verification record

Untouched across the rebase, verified by `git diff <base>..<head> --stat`:
`src/lib/oauth/v1/direct.ts` (issuance + the
`client_or_principal_inactive` active check — anchor now at L102),
`src/lib/oauth/v1/idempotent.ts` (`createOrGetPrincipal` /
`createOrGetClient` bodies), `grant-migration.ts`,
`token-issuance.ts`: zero diff lines. The grant row stays the sole
issuance predicate for this audience; row inertness comes exclusively from
issuance-time `client.status`/`principal.status` checks — there is
deliberately no row-level revocation flag on `MachineAccessGrant`.

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

## H. Verification inventory (rebased candidate, base af617ae)

```text
tests/oauth/fleet-send-grant.test.ts       8/8 (DB-free; injected store)
scripts/reconcile-fleet-send-grants --selftest   SELFTEST_ALL_OK (3 fixtures)
npm run contract:v1:validate               MINIMAL_AUTH_V1_BUNDLE_VALID=true
npx tsc --noEmit -p tsconfig.json          1 error — PRE-EXISTING AT BASE:
  src/lib/oauth/forum-direct-agent-token.ts uses audit type
  'forum.direct_agent_token.minted', which upstream main (af617ae) never
  added to the AuditEventType union. Present at base and head identically
  (NEW_FAILURES=0); upstream-domain breakage, untouched here.
npm run test:contract-v1                   see PR base/head double-run
  evidence; the only expected failure is the PRE-EXISTING static hygiene
  test 'prisma/schema.prisma exceeds 500 lines' (551 lines at base and head).
tests/idempotent-conformance.test.ts       unchanged; exercises the
  createOrGetClient LIBRARY (not the route), so it is unaffected by the
  route-level stamp; requires a live DB (Owner environment)
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
