# AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1 — independent review record

Review executed 2026-09-05 by an independent read-only reviewer agent
(agent_42a38e94) against the exact reviewed head. This record is the durable
transcript of that review; it is not itself acceptance authority.

## Coordinates

```text
REPOSITORY = mayf3/auth-service
REVIEW_KIND = SPEC
REVIEW_TARGET_HEAD = 0359575dd1481aa5e6c294a495fbaabce97e40bf
BASE_HEAD = ae6da9a8b754be16c35553f0dff1d8e36194d88f (== github/main)
REVIEWER_ID = agent_42a38e94 (independent subagent, read-only)
AUTHOR_ID = mayf3
ASSURANCE_LEVEL = CONTROLLED
REVIEWED_AT = 2026-09-05
REVIEW_ROUND = 1 (first independent review; no prior audit round)
```

## Result

```text
SPEC_REVIEW = ACCEPT
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = NOT_APPLICABLE
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
DOWNSTREAM_PIN_CONSISTENCY = PASS (dsh child AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1
  can pin these contracts unchanged: YES, no divergences)
BASE_IMPACT = BOUNDED
BLOCKERS = []
SPEC_GAPS = [
  SPEC_GAP-1 / CTR-EAPR-002..004 error responses / candidate pins HTTP status +
  code names but not the JSON envelope key convention / a strict implementer
  could emit {message:...} (HttpError default, src/server.ts:151-153) instead
  of the code-bearing {error:code} shape the by-external-ref precedent uses
  (src/routes/idempotent.ts:84,99); dsh pins codes, so envelope shape is
  load-bearing for the consumer / closure: implementation preflight states
  "route-local catch emits res.status(n).json({ error: CODE }) mirroring
  idempotent.ts:82-85".
  SPEC_GAP-2 / CTR-EAPR-005 + ACC-EAPR-005 "exact one tuple" / production apply
  must also materialize an auth_audiences row (machine_access_grants.audience_id
  FK -> auth_audiences, prisma/schema.prisma:202ff; precedent migration
  20260722000100_ceo_client_okr_write_grant inserts audience row then grant row)
  and a grant_change_audits row (manifest audit_in_same_transaction=true);
  "one tuple delta" is accurate only if explicitly scoped to grant tuples /
  closure: implementation preflight enumerates the exact row set (audience row
  if absent + grant row + audit row) and ACC-EAPR-005 measurement is stated as
  grant-tuple-scoped.
  SPEC_GAP-3 / front matter / production_apply_authority:
  conditional_controlled_operation is novel vocabulary — all 15 existing specs
  use "none" and no governance doc defines the enum
  (.agents/schemas/spec-frontmatter.schema.json has no such property; permitted
  via additionalProperties:true) / value is self-defined by CTR-EAPR-007 and
  PRODUCTION_APPLY_ALLOWED_NOW=NO, so not a blocker; Owner acceptance
  implicitly ratifies the term.
]
FOLLOW_UPS = [
  Implementation preflight must record chosen registry minor (next unreserved
  above 1.7.0) and exact changed-file closure per CTR-EAPR-001, including
  contract.ts supported-version allowlist and version-expectation tests
  (precedent: AUTH_SERVICE_AGENT_WAKE_AUDIENCE_CCR_V1 :531-546).
  Runbook rehearsal (ACC-EAPR-007) should verify rollback removes the audience
  row only when no other consumer uses the entry, per "do not remove an entry
  in use by another accepted consumer".
]
TOOLING_DEBT = []
IMPLEMENTATION_ALLOWED = NO (waits Owner exact-head acceptance + merge)
MERGE_READY = YES
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE (Owner exact-head acceptance gate)
```

## Findings narrative (reviewer's check record)

1. Storage claims — PASS. BASE prisma/schema.prisma:105-123: MachinePrincipal
   UUID PK (:107), nullable unique agentId (`agentId String? @unique`, :109),
   principalType (:108), status active/disabled (:95-99, :114). Forward query
   by PK and reverse agentId @unique make both IDENTITY_RESOLUTION_AMBIGUOUS
   branches unreachable in a consistent DB, but the candidate's "uniqueness
   MUST NOT replace fail-closed duplicate handling" (:161) is exactly the
   stance the already-accepted AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1
   takes and the existing code implements (take: 2 + 409
   IDENTITY_RESOLUTION_AMBIGUOUS, src/lib/oauth/v1/resolution.ts:216,222, where
   externalRef is also @unique). Defense-in-depth, internally consistent,
   harmless.
2. Existing-resolution non-interference — PASS. `git diff ae6da9a..HEAD` shows
   exactly one added file (the spec); resolution.ts, idempotent.ts, the accepted
   spec and its three-file closure are untouched; supersedes: []. Existing
   operation remains service-only svc-auth/auth.identity.provision (accepted
   spec :125-126, :394); candidate adds a separate audience instead of widening
   (DEC-EAPR-002); CTR-EAPR-001 :118-119 explicitly denies cross-satisfaction
   between auth.identity.provision and auth.agent.resolve.
3. CCR/bundle mechanics — PASS. Proposed entry's 11 fields exactly match
   contract-bundles/minimal-auth-v1/schemas/audience-registry.schema.json
   ($defs/audience, additionalProperties:false); all 8 existing entries in
   audience-registry.json use the same shape; agent-session-messaging is direct
   precedent for an agent-only machine audience. "One additive minor, skipping
   accepted reserved versions" matches established convention (SCHEDULER CCR
   :440-446, WAKE CCR :462-546, :780) and validator cross-file version equality
   checks (validate.mjs:274-281) make the linked-surface language concrete.
4. Route/middleware conventions — PASS. Routes mounted via
   app.use('/api', idempotentRouter) (src/server.ts:132) with /v1 sub-paths;
   dedicated middleware reusing verifyV1DirectMachineToken
   (src/middleware/v1-management-auth.ts:59-116 is the exact template) matches
   DEC-EAPR-004's "no second JWT protocol"; audience verifiable at runtime via
   getV1AudienceDefinitions() (src/lib/oauth/v1/contract.ts:164ff);
   assertCanonicalV1Scope accepts auth.agent.resolve under namespace auth
   (src/lib/oauth/v1/scope.ts:33-48). Data-route errors already emitted as
   {error: code} JSON in route-local catch (idempotent.ts:82-85,97-100);
   400/404/409/422/500/504 named codes directly expressible; only the envelope
   key is unnamed (SPEC_GAP-1, resolvable by preflight).
5. HR grant binding realism — PASS. MachineClient.clientId @unique and
   MachineClient.machinePrincipalId FK support CTR-EAPR-005's selection
   exactly; MachineAccessGrant PK (machineClientId, audienceId) makes "one
   tuple" mechanically precise. Working precedent: migration
   20260722000100_ceo_client_okr_write_grant looks up the client by public
   client_id, verifies machine_principal_id equals the fixed principal UUID,
   RAISEs on mismatch/ambiguity, inserts the grant — no credential access.
6. Fail-closed completeness + minimal privilege — PASS. Walked
   CTR-EAPR-001..007: malformed input (400 x2), authn/authz (401/403),
   absent/ambiguous/non-agent/disabled/mapping-missing (404/409/422/409/409),
   reverse-check mismatch, DB/internal 500 never fabricated absence, 504
   timeout, late-completion inert, zero mutation with sanitized logging,
   fail-closed grant selection, production gates with slot hold and
   exact-preimage rollback — no missing failure branch. Sole tuple carries only
   auth.agent.resolve. 5-second deadline coherent with
   IDENTITY_RESOLUTION_DEFAULT_TIMEOUT_MS = 5000 (resolution.ts:118) and
   504/500 classification (:196-202).
7. Downstream pinability — PASS. Verified against actual dsh candidate
   (dsh-agent-core codex/principal-agent-resolution-authority-v1,
   AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 CTR-EPAR-002/003/004): route
   path, audience, scope, success body {principalId, agentId} identical; dsh's
   lowercase codes are a declared consumer-side mapping grouping 500/504 into
   identity_resolution_unavailable — all six names map one-for-one with no
   semantic movement; dsh's ^agt_[a-z0-9-]+$ local grammar check consistent
   with auth's explicit refusal to syntax-reject stored IDs (:163-164);
   5-second deadline matches.
8. Front matter + acceptance — PASS. Satisfies
   .agents/schemas/spec-frontmatter.schema.json (all 11 required fields,
   valid enums; production_apply_authority permitted additional property —
   SPEC_GAP-3). Parent MINIMAL_AUTH_FOUNDATION_V2 accepted at head
   (docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md status:
   accepted; docs/specs/README.md:62). ACC-EAPR-001..007 each cite their
   same-numbered CTR with method/environment/expected/failure — 7/7.
   OPEN_OWNER_DECISIONS = NONE justified (all substantive choices enumerated as
   DEC-EAPR-001..005; VISIT_ACTIVATION slot dependency is a gated production
   condition, not an undecided question).
9. Governance form — PASS. All required sections present and populated;
   observation citations within one line of actual spans (style nits, not
   findings).

## Reviewer verdict statement

This is a clean, additive, fail-closed candidate. No blockers; the three
SPEC_GAPs are naming/enumeration items a normal implementation preflight
resolves, and none affects the dsh child's ability to pin the contracts at this
head unchanged. This ACCEPT is the independent review verdict only — Owner
exact-head acceptance remains required.

## Final accepted-Head binding

```text
REVIEWED_SPEC_COMMIT = 0359575dd1481aa5e6c294a495fbaabce97e40bf
FINAL_ACCEPTED_HEAD = (pending Owner acceptance)
ACCEPTANCE_ACTOR = (pending)
ACCEPTED_AT = (pending)
SEMANTIC_DELTA_AFTER_REVIEW = NONE (record commit is non-normative)
FINAL_HEAD_RECHECK = (at acceptance)
```
