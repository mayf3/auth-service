# D8 / agent-control#1343: notification issuance investigation

2026-11-01. **SOURCE DEFECT NOT REPRODUCED; production root cause UNKNOWN.**
This is an investigation receipt with an executable synthetic diagnostic, not
a token-issuance repair, RED→GREEN regression, deployment or delivery canary.
Issue: https://github.com/mayf3/agent-control/issues/1343

## Coordinates, authority and scope

- Repository: `mayf3/auth-service`; sole writer `/root` in `/tmp/auth-94-impl`.
- Branch: `ac-d8-notification-deliver`.
- Freshly fetched `main`, `origin/main`, starting HEAD and tested source:
  `0227f9d6b16dbc306c5fd0a7c1edc95cf5a77c15`.
- User mandate: diagnose D8, conditionally make the smallest lawful source fix,
  synthetic regression evidence, commit/push/open-only PR and #1343 receipt.
  Abort semantic implementation on contract conflict or unexpected semantic
  failure. No credentials, production data, production writes, merge or deploy.
- `.agents/governance.lock.json`: accepted governance 1.1.0, source
  `0595e7e8a5f5bcd45660ca19fdabe932637af2ec`; inspected with local precedence.

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
AUTHORITY_ACTION = REUSE (conformance of existing behavior only)
PRIMARY_AUTHORITY = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts
ROUTE_STAGE = IMPLEMENTATION (investigation only; no source delta selected)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (bounded investigation/source/tests/GitHub only)
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = NONE (for the executed diagnostic)
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE (source task; production not inspected)
IMPLEMENTATION_ALLOWED = NOT_APPLICABLE (no demonstrated source defect)
MERGE_READY = NO (open-only task)
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP (semantic implementation)
```

`CTR-NI-001..003` already require service-only, exact audience/scope/durable
grant checks and whole-request rejection. V2's incorporated
`claims-and-profiles.md` §5 permits service direct tokens without `agent_id`;
`grants-and-audiences.md` §5 requires a nonempty, audience-paired
`MachineAccessGrant`. Legacy `allowedResources` / `allowedScopes` cannot be
substituted for it. `CTR-NIC2-001/003` bounds the historical registration
implementation closure; `CTR-NSC-004..006` separately bounds service grant
supply. Neither grants blanket permission to change legacy issuance or remove
the durable grant gate. No accepted authority was changed.

`EXECUTION_HISTORY_AUTH_CONTRACT_V1` governs execution-history only. Its
fail-closed rules are consistent with this result but do not authorize a
notification change. Existing notification authority supplies that boundary.

Done when: preserve reviewable source findings, synthetic executed evidence,
existing named-outcome comparison and open-only GitHub handoff. Expansion
trigger: a reproducible source defect or a proposed behavior/authority delta;
re-PREFLIGHT before semantic implementation. No production read or repair is
inferred from this record.

## Exact issuance chain and rejection conditions at tested source

`src/routes/oauth.ts:134–138` chooses `issueV1DirectToken` only when
`env.AUTH_CONTRACT_MODE === 'v1'`; otherwise it calls legacy `issueToken`
(`v1_shadow` also evaluates V1 separately). Production mode was not read.

In `src/lib/oauth/v1/direct.ts`:

- `85–99`: exact runtime audience lookup; machine access required; load the
  registered client with `accessGrants.where.audienceId = params.resource`.
- `101–109`: active client/principal, profile, secret and registered accepted
  principal type checks. `service` with `agentId === null` is already allowed
  for notification; `agent` is rejected for its service-only audience.
- `111–112`, exact source:

  ```ts
  const grant = client.accessGrants[0];
  if (!grant) throw new V1OAuthError('invalid_scope', 'machine_grant_missing');
  ```

- `113–120`: registry mismatch or invalid stored grant returns
  `temporarily_unavailable`, preserving fail-closed registration/state checks.
- `122–125`, exact source:

  ```ts
  const requestedScopes = canonicalV1Scope(params.scope, runtimeAudience.scopeNamespace);
  const granted = new Set(grant.scopes);
  if (requestedScopes.split(' ').some((scope) => !granted.has(scope))) {
    throw new V1OAuthError('invalid_scope', 'requested_scope_not_granted');
  }
  ```

`src/lib/oauth/v1/scope.ts:10–25` also rejects malformed, empty, duplicate or
wrong-namespace scope requests with `invalid_scope`. No branch categorically
rejects a valid service principal requesting the notification scope.

The legacy path in `src/lib/oauth/token-issuance.ts:91–101` has:

```ts
if (client.principal.principalType !== 'agent' || !client.principal.agentId) {
  // audit: legacy_principal_profile_mismatch
  // ...
  throw Object.assign(new Error('invalid_client'), { statusCode: 401 });
}
```

Its later scope-subset failure (`139–155`) is `invalid_scope`, but a service
principal fails the earlier profile check first. Changing that legacy gate
does not explain the reported `400 invalid_scope` and would expand a different
protocol surface without a demonstrated defect.

## Authorized ingress source inspection

Only the explicitly named production source file was read, never imported or
executed: `/usr/local/libexec/agent-core/app/packages/notification-ingress/src/auth.js`.
SHA-256: `f42d3ff45f622850631acefb9cc53f27f7839d18d05bbabb9c435dd521e76f14`.

- `44/47`: exact resource `agent-core-notification-ingress-v1` and scope
  `notification.deliver`.
- `287–305`: accepts Basic credentials and POSTs those fixed parameters to
  Auth `/oauth/token`.
- `316–321`: success requires a nonempty string `access_token`; this file does
  not decode/verify JWT audience, algorithm, issuer or principal claims.
- `342–348`: maps the verified `clientId` through the configured caller
  allowlist. Caller names are `svc-forum` / `svc-workflow` (`50`).
- `323–336`: known invalid credential/scope/target errors become 401; temporary,
  transport, malformed or unknown outcomes fail closed as 503.

The service-only RS256 JWT shape comes from accepted Auth contracts, rather
than a claim-validation check in this ingress file. Loaded configuration,
credentials, actual caller mapping and delivery state remain UNKNOWN.

## Executed evidence and reproduction

Run from the repository root with the existing dependency tree and generated
snapshot (no installation):

```sh
node scripts/prepare-minimal-auth-v1.mjs
python3 docs/audits/auth-d8/run-probe.py
```

The runner refuses a checkout containing `.env` and supplies a fresh environment
with synthetic secrets, contract mode `v1` and an unused loopback database URL
on port 1. Persistence is explicitly injected; no Prisma query or live HTTP
request runs. RSA keys are freshly generated in memory. Actual issuer, scope,
signer, verifier and audit code execute. Tokens, secrets and credential hashes are not
printed. `probe.json` records the actual tested HEAD and source SHA-256 values.

Eleven diagnostic checks pass, rc=0:

1. Registered service + correct audience + durable grant already mints the
   exact scope, service profile and client identity; no `agent_id`.
2. Only legacy allowed-resource/scope fields, without a durable grant, produce
   stable `invalid_scope / machine_grant_missing`.
3. Unknown scope produces `invalid_scope / requested_scope_not_granted`.
4. Mixed valid/unknown scope rejects whole issuance without downscoping.
5. Another registered audience cannot reuse the notification grant.
6. Unknown audience fails closed.
7. Unregistered client fails closed.
8. Wrong synthetic credential fails closed.
9. Agent principal stays rejected for notification.
10. Normal agent workflow token still mints and verifies.
11. Captured success/denial logs contain no synthetic secret, hash or token.

Each denial is executed twice. This is **already-green source conformance**,
not RED→GREEN and not proof that production has the required grant.

`checks.json` records commands, return codes and log hashes. Existing 13-file
suite manifest is `docs/audits/auth94/existing-files.json`. Fresh run:
**73 named cases, 71 pass, 2 fail, rc=1**. Sorted name AND result comparison
with the tracked `docs/audits/auth94/r3-named.tsv` is empty (`named-set.diff`,
0 bytes). Both failures already exist in that baseline:

- `real disposable PostgreSQL, generic SERVICE issuer and loopback HTTP preserve all authorization guards`:
  test-owned `pg_ctl ... start` fails before issuance; temporary cluster cleaned up.
- `V1 Prisma and migration files stay within the repository line limit`:
  existing `prisma/schema.prisma` exceeds 500 lines.

`npm run build`: rc=0. `npm test`: 48/48 pass, rc=0. No source, contract bundle,
schema, migration or existing test changed. Prior #94 untracked evidence was
preserved and excluded from this delivery. Full local synthetic logs are
included with this receipt; `existing.tap.gz` preserves the exact TAP bytes
(including subprocess whitespace), with both raw and compressed hashes recorded.

## Root-cause boundary and next action

Observed: the requested success and denial semantics already hold in the
unchanged source. Adding legacy `machine_clients` allowlists cannot satisfy
the V1 durable grant check; expanding the stored audience beyond its frozen
profile would cause registry mismatch, not lawfully broaden access.

Inference only: missing/incorrect audience-paired durable grant is compatible
with the report, but is not established as the production root cause. Actual
loaded source, contract mode, failure category and grant state were not read.
No claim is made that any earlier production table edit is the confirmed cause.

The authorized production regulator should first obtain its existing
metadata-only denial classification and loaded source/mode binding. If the
failure is `machine_grant_missing` / `requested_scope_not_granted`, reconcile
the exact client/audience grant through the existing reviewed supply authority
and separately authorized operation. If a correct durable grant still fails,
provide a sanitized synthetic reproduction and re-PREFLIGHT that exact source
delta. Do not remove grant checks, reuse legacy arrays, hand-insert rows or
extend principal types to force a pass.

Source fix: NONE. Production writes/deploy/restart: NONE. Real mint and
`POST /v1/deliver` canary: NOT EXECUTED. #1343 remains unresolved; this PR must
not close it or be presented as a deployable D8 fix.
