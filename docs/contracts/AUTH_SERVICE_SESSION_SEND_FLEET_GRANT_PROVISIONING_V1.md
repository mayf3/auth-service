# AUTH_SERVICE_SESSION_SEND_FLEET_GRANT_PROVISIONING_V1

> Companion contract for `AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1`
> (dsh-agent-core `docs/specs/`, accepted by Owner exact-head acceptance at
> **6bce155**, 2026-09-15). This document is the execution of that Spec's §9
> I3 and freezes, repository-side, everything the fleet send entitlement
> depends on inside auth-service. Status: **ACTIVE** (authority inherited
> from the accepted governing Spec; GOVERNING_SPEC_UNMODIFIED in force).

## A. Scope

```text
IN : birth provisioning of the fleet-default agent.session.send grant (§B)
     fleet reconciliation script (§C)
     repo-side freeze of the agent-session-messaging audience row (§D/§E)
     issuance-invariance statement (§F)
OUT: token issuance / deny code paths (I4: unchanged)
     any other audience, scope, principal, or registry row (hygiene boundary)
     the six other deployed-only audiences' bundle backport (§E DEBT)
```

## B. Birth provisioning surface

- Route: `POST /api/v1/clients` (`src/routes/idempotent.ts`) — after
  `createOrGetClient` succeeds, inside the same channel flow, for create /
  claim / resolve / concurrent-winner outcomes alike (the stamp is
  convergent on every path).
- Module: `src/lib/oauth/v1/fleet-send-grant.ts`
  (`ensureFleetSessionSendGrant`).
- Guard: only `principal_type='agent'` principals (Prisma lowercase literal;
  the enum is `agent | service`; humans are `User` rows and never
  MachinePrincipals, so they are structurally unreachable).
- Target row (Spec §3): `{ machineClientId, audienceId =
  'agent-session-messaging', scopes = ['agent.session.send'], version >= 1 }`
  — grant physical PK is `(machine_client_id, audience_id)`; the model has
  **no revoked_at column**.
- Failure semantics: storage errors propagate (provisioning call fails
  closed; the idempotent external_ref retry heals). A missing or inactive
  audience row is skipped with audit `client.fleet_grant_skipped`
  (`audience_absent_or_inactive`) — without the audience there is no lawful
  entitlement to materialize; the reconcile script refuses in that state.
- Audit events added to the closed `AuditEventType` union:
  `client.fleet_grant_ensured`, `client.fleet_grant_skipped`,
  `fleet_send_grant.materialized` (additive only).

## C. Reconciliation surface

- Script: `scripts/reconcile-fleet-send-grants.ts`.
- Requirements (governing Spec §5 R1–R6), implemented:
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
- Deployment note: the birth-stamp takes effect only after auth-service is
  redeployed from a build containing it; the reconcile script converges the
  existing fleet independently of any deploy.

## D. The audience row (repo-side freeze)

Authoritative source of record for the `agent-session-messaging` audience:
the **deployed runtime snapshot**
`generated/minimal-auth-v1/runtime-contract.json` (deployed ledger
`registry_version 1.12.0`) and the live `AuthAudience` DB row it mirrors —
originally registered by
`AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2`. Exact frozen
content:

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
anything in this contract, and per governing Spec §3 any future grant of it
requires amending that Spec first (grant PK `(machine_client_id,
audience_id)` means both authorities would collide on one row).

## E. Registry source reconciliation (drift, honestly recorded)

- `contract-bundles/minimal-auth-v1/audience-registry.json` is frozen at
  the first-wave state (`registry_version 1.2.0`, five audiences) and
  `validate.mjs` mechanically enforces first-wave immutability
  (`MINIMAL_AUTH_V1_BUNDLE_VALID=false` on any set change). Post-freeze
  registrations are performed ledger-first (DB + deployed snapshot), each
  under its own AUTH_SERVICE authority — the bundle is intentionally NOT
  the live registry ledger.
- Drift ledger (deployed-only audiences at freeze time of this contract,
  each with its registrant authority):

```text
agent-core-notification-ingress-v1  AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
agent-session-messaging             AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V2 (content frozen in §D above)
scheduler                           AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
agent-principal-resolution          AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1
identity-directory                  AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
agent-directory                     AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
life-workbench                      LIFE_WORKBENCH_AUDIENCE_CCR_V1
```

- **DEBT (explicit, not this goal's hygiene):** back-porting any of the
  above rows into the frozen bundle requires a bundle unfreeze/refresh
  ceremony (registry_version + manifest + freeze-gate refresh) — a separate
  owner-gated contract action. Until then, §D of this document is the
  repo-side source of record for `agent-session-messaging`, and the fleet
  machinery is drift-robust by construction (birth-stamp skips without an
  audience; reconcile refuses fail-closed without an audience; issuance
  never mints on a missing grant row).

## F. Issuance invariance (I4)

Untouched (verified by diff): `src/lib/oauth/v1/direct.ts` (issuance + the
`client_or_principal_inactive` active check at L101-102),
`src/lib/oauth/v1/idempotent.ts` (`createOrGetPrincipal` /
`createOrGetClient` bodies), `grant-migration.ts`, all grant-check and
deny-classification code. The grant row stays the sole issuance predicate
for this audience; row inertness comes exclusively from issuance-time
`client.status`/`principal.status` checks — there is deliberately no
row-level revocation flag on `MachineAccessGrant`.

## G. Lifecycle discipline

Disable/retire of a production Agent MUST deactivate the bound principal /
client (existing `machine-admin` surfaces); the entitlement then fails
closed at issuance (`client_or_principal_inactive`) with zero code change.
Removing an agents.json entry alone is NOT retire: a residual grant row in
that state is inert only under this discipline, and
`DISABLED_RETIRED_AGENT_SEND=DENY` is structurally guaranteed only on the
deactivation path (governing Spec §6).

## H. Verification inventory

```text
tests/oauth/fleet-send-grant.test.ts       8/8 (DB-free; injected store)
scripts/reconcile-fleet-send-grants --selftest   SELFTEST_ALL_OK (3 fixtures)
npm run contract:v1:validate               MINIMAL_AUTH_V1_BUNDLE_VALID=true
npm run test:contract-v1                   green, except the PRE-EXISTING
  'prisma/schema.prisma exceeds 500 lines' static-hygiene failure (schema
  outgrew the frozen limit long before this work; untouched here)
tests/idempotent-conformance.test.ts       unchanged; exercises the
  createOrGetClient LIBRARY (not the route), so it is unaffected by the
  route-level stamp; requires a live DB (Owner environment)
tsc --noEmit -p tsconfig.json              clean
```
