# AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1 — independent review record

Review executed 2026-09-05 by an independent read-only reviewer agent
(agent_1f86eddd) against the exact reviewed head. This record is the durable
transcript of that review; it is not itself acceptance authority.

## Coordinates

```text
REPOSITORY = mayf3/auth-service
REVIEW_KIND = SPEC
REVIEW_TARGET_HEAD = 9b3b4bdb0016ec40bab2419bbf15dc886f40476f
PRIOR_REVIEWED_HEAD = bafc50a13e1463a711b2b4c92ca9a5a7d0d379d5
BASE_HEAD = ae6da9a8b754be16c35553f0dff1d8e36194d88f (== github/main)
REVIEWER_ID = agent_1f86eddd (independent subagent, read-only)
AUTHOR_ID = mayf3
ASSURANCE_LEVEL = CONTROLLED
REVIEWED_AT = 2026-09-05
REVIEW_ROUND = 2 (round 1 found the audit/migration-envelope reason blocker;
closed by author commit 9b3b4bd; this is the single post-union re-audit)
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
BASE_IMPACT = NONE
BLOCKERS = []
SPEC_GAPS = []
FOLLOW_UPS = [
  FOLLOW-UP-1 audit-uniqueness enforcement: CTR-HRG-003 nonce-unique audit has
  no DB-level uniqueness backing (auth_security_audits.request_correlation_id
  unindexed non-unique string, details Json; prisma/schema.prisma:466-481).
  Uniqueness is procedural (read-before-write inside the serializable tx), same
  as accepted precedents; worst case of a duplicate is an extra audit row, not
  a permission change. Vehicle should add an explicit duplicate-nonce probe.
  FOLLOW-UP-2 pre-existing mapping debt: base prisma MachineAccessGrant
  (schema :272-284) has no revokedAt mapping; tombstone is raw-SQL semantics
  per PR #47 amendment, already FOLLOW_UP_DEBT in
  AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1 §3. Candidate §12
  correctly blocks operation until tombstone/version<1 denial is freshly proven
  against the deployed issuer.
  FOLLOW-UP-3 identity-hygiene receipt: fleet HR main identity agt_hr-agent
  (dc702687-…) and canonical hr-agent (bc970ced-…) coexist downstream;
  DEC-HR-001/CTR-HRG-001 already forbid alias substitution; census receipts
  should explicitly record the non-selected identity's absence.
]
TOOLING_DEBT = [
  Reviewer-side only: production snapshot
  production-auth-service-57258ec33700af8057ab2ed63fd8e52b3225e749 is not
  locally replayable; its source citations were verified against the base
  worktree instead. No repo change needed.
]
IMPLEMENTATION_ALLOWED = NO (waits Owner exact-head acceptance + merge)
MERGE_READY = YES
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE (Owner exact-head acceptance gate)
```

## Round-1 fix verification

```text
ROUND1_FIX_VERIFIED = PASS
```

Diff bafc50a..9b3b4bd touches only the candidate file (9+/5-): CTR-HRG-003 adds
`reason` to the audit detail list plus the fixed-SHA envelope requirement with
constant `HR_WORKFLOW_ORCHESTRATION_AGENT_SESSION_SEND_ACTIVATION` (:172-175);
CTR-HRG-005 adds audit+envelope reason
`HR_AGENT_SESSION_SEND_FAILED_ACTIVATION_ROLLBACK` (:202-204); ACC-HRG-003/005
failure conditions extend symmetrically (:236, :238). Constants are bounded
literals, nonsecret; no interaction contradicting CTR-HRG-004's negative-probe
audit clause (:193-194).

## Findings narrative (reviewer's check record)

1. Round-1 fix — PASS (see above).
2. Authority conformance — PASS. Candidate purely additive (diff --stat
   ae6da9a..9b3b4bd = 1 file, 270 insertions; supersedes: [] :20). Registered
   pair verified: CCR CTR-ASM-001/002 freezes audience `agent-session-messaging`
   with exactly `[agent.session.send]`, machine-only agent profile. Efficiency
   exclusivity is operation-scoped: operational grant §5 prohibitions govern its
   own single-tuple apply; repo's accepted model of separately authorized grant
   supplies (forum moderator, trusted fleet 86, dispatcher identity;
   docs/specs/README.md index) confirms the bounded reading; candidate §3
   (:45-52) does not supersede it and §1's frozen efficiency tuple
   (b21ddb23 / mc_cF81DF / 695d1eeb) is untouched. Front matter accurate:
   governed_by parents accepted at base; external pin 1912d582888455a049838f376759b62f295b341b
   exists in mayf3/dsh-agent-core and contains accepted
   AGENT_CORE_AGENT_SESSION_MESSAGING_V1.
3. Ground truth — PASS. Base `src/lib/oauth/v1/direct.ts:112` is exactly
   `if (!grant) throw new V1OAuthError('invalid_scope', 'machine_grant_missing')`;
   :125 `throw new V1OAuthError('invalid_scope', 'requested_scope_not_granted')`
   — OBS-HR-002 citations byte-accurate; Broker translation claim honestly
   framed as code-path evidence (:95-96). auth_security_audits exists
   (prisma/schema.prisma:466-481, details Json + request_correlation_id).
   Cross-repo identity corroboration: dsh maps
   bc970ced-710f-4479-9ff0-e295a1c59424=hr-agent as Auth DB authoritative data
   (packages/scheduler/fixtures/openclaw-jobs-enabled.json:4442;
   investigations/VISIT_ACTIVATION_DISPATCH_AUTHORITY_RECONCILIATION_V1.md:49),
   consistent with DEC-HR-001's exclusion of the distinct agt_hr-agent/dc702687
   identity.
4. Fail-closed completeness — PASS. CTR-HRG-001 aborts on
   missing/ambiguous/disabled/mismatched identity, drifted audience, credential
   failure, unregistered audience (:147-150). CTR-HRG-003 in-transaction
   fresh-read/lock + CTR-HRG-001 revalidation (:168-170) covers concurrent
   second active client and audience disable between census and apply;
   precommit failure leaves row and audit unchanged; unknown commit outcome
   stops auto-retry (:176-179). CTR-HRG-005 rollback precondition (exact
   postimage AND nonce receipt, :198-200) routes a missing nonce receipt to
   stop-and-report (:207-208); NOOP rows protected (:208-209). CTR-HRG-006
   forbids resend on unknown delivery (:222-223).
5. Minimal privilege — PASS. Sole delta is the one row tuple with exact
   scopes/version/revoked_at (:154-156); everything else byte-equivalent
   including efficiency's send/scheduler grants and HR workflow grants
   (:161-163); CTR-HRG-004 forbids scheduler.admin/agent-wake/credential
   propagation/target grant (:189-191) and requires permission-delta comparison
   (:191-192); ACC-HRG-004 covers forbidden aliases, wildcard, one verified
   ungranted client (:237).
6. Internal consistency — PASS. Front matter matches docs-only candidate form;
   ACC-HRG-001..006 map 1:1 onto CTR-HRG-001..006 (6/6, :234-239);
   OPEN_OWNER_DECISIONS = NONE beyond DEC-HR-001/002 (:264); no runtime or
   production success claimed (:82, :229-230, :268).
7. Governance form — PASS. All load-bearing sections present; front-matter
   shape matches accepted precedents; absent README index row is correct
   convention since indexed rows at base are accepted/superseded (index sync at
   acceptance per CCR §10 precedent).

## Reviewer verdict statement

No blockers. The candidate is an exact, bounded, fail-closed supply of the one
HR tuple; the round-1 reason blocker is fully closed at 9b3b4bd. This ACCEPT is
the independent review verdict only — Owner exact-head acceptance and the
separately gated production steps remain as the spec itself states.

## Final accepted-Head binding

```text
REVIEWED_SPEC_COMMIT = 9b3b4bdb0016ec40bab2419bbf15dc886f40476f
FINAL_ACCEPTED_HEAD = (pending Owner acceptance)
ACCEPTANCE_ACTOR = (pending)
ACCEPTED_AT = (pending)
SEMANTIC_DELTA_AFTER_REVIEW = NONE (record commit is non-normative)
FINAL_HEAD_RECHECK = (at acceptance)
```
