# Canonical Subject Enrollment Production Bootstrap Runbook

Goal: install the accepted enrollment persistence surface empty, establish the
exact already-approved canonical Agent lifecycle targets, and stop after producing
and independently reviewing the resulting enrollment plan.

## Authority and immutable inputs

```text
RUNBOOK = AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_PRODUCTION_BOOTSTRAP_V1
ENVIRONMENT = production
CURRENT_MAIN = 3cf7f684a3d5c9b0d3d1f1caffcfc8b063142cbc
ENROLLMENT_IMPLEMENTATION_ANCESTOR = 785d7430fd0b6b9dd3aa7c110ed857fed9fea865
PRIMARY_AUTHORITY = AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1
RELATED_AUTHORITY = AUTH_SERVICE_CANONICAL_IDENTITY_FOUNDATION_V1
OWNER_EXECUTION_MANDATE_SHA256 = 03f53f44a11a84c457bc73e985c45aac8ccece2fdf92336cf102a5a0967784a6
OWNER_PACKET_SHA256 = df7f685f6e35681105a24941abf8f57754bae0b45aeb1272758be0a74ffa168c
OWNER_DECISION_SHA256 = 78cfb31f4ad527d2994c29c7a0c6b99244237511d3f8fca7bfad081a41dd6464
BOOTSTRAP_AUTHORITY_MANIFEST_SHA256 = 4f3e72e104fd2037f7c4f2803c66d3da4ec6bb36e868cc599ddade8d2f4d38a5
BOOTSTRAP_PACKET_DIGEST = a70b936e813ef293c229ff4920ec346a574876d3d00fc847d1b415233c06c242
ENROLLMENT_MIGRATION_SHA256 = 7a37e90f73a97a346b2a0516700e09bb9897a0c68471f62a656abca9b9ac9df3
AGENT_CORE_CONFIG_SHA256 = 15f4b63c82f7db4d2775211d3167c8aad958700ff269b808e82dd49e3d10c224
```

The final Owner packet mechanically yields 63 existing-ready subjects: 62 AGENT
and 1 HUMAN. Exact `machine_principal_id` deduplication yields 44 Agent lifecycle
targets; 18 additional AGENT business subjects prospectively converge to those
same exact targets. No principal maps to conflicting Agent IDs. The HUMAN subject
never enters Agent lifecycle bootstrap. This is prospective authority only and
asserts no historical equivalence.

## Permitted effects

This operation permits exactly two production effects:

1. Apply `202609160001_canonical_subject_enrollment` from the immutable bytes above
   when its full surface is absent. The five new business tables must remain empty.
2. Apply one reviewed, unexpired, deterministic plan containing exactly 44
   `TRANSITION_AGENT_LIFECYCLE` mutations from `ABSENT|unresolved` to `canonical`.
   The accepted operation audit written atomically by that command is part of this
   controlled lifecycle operation.

The operation may not apply subject attestations or source bindings; provision or
retire a Principal; install a successor; rewrite an Agent ID or status; mutate a
client or Grant; migrate a source reference; deploy a service; or create a runtime
legacy fallback. Enrollment APPLY is outside this runbook.

## Phase A: privileged fresh preflight and empty install

1. Through macOS native administrator authentication, freeze the production target
   and freshly verify remote main, all immutable digests, the production database,
   auth health, the shared production mutation slot, and protected row digests.
2. Classify the complete enrollment schema surface as `NOT_INSTALLED`,
   `EXACTLY_INSTALLED`, or `PARTIAL_OR_DRIFTED`. Stop on partial/drifted state.
3. Obtain an independent review of the exact runbook, migration bytes, and fresh
   prestate before any write.
4. If absent, acquire `/private/tmp/auth-service-production-mutation-slot-v1`, prove
   that this is the only pending migration, and execute Prisma `migrate deploy`
   once. If exactly installed, perform no DDL write.
5. Freshly verify all accepted tables, enums, functions, triggers, constraints and
   migration ledger evidence. All five new tables must contain zero rows.
6. Verify Principal, machine-client, secret/rotation, Grant, lifecycle and successor
   protected digests. Release the slot and preserve the root-owned receipt.

Any authentication cancellation, target drift, unexpected pending migration,
busy mutation slot, partial schema, protected-state change, or non-empty business
table stops the run without retry.

## Phase B: reviewed lifecycle bootstrap

1. Freshly validate all 44 exact pairs: Principal exists, type is `agent`, status is
   active, stored Agent ID equals the approved Agent ID, exactly one enabled Core
   Definition exists, lifecycle is absent or unresolved, and no outgoing successor
   exists.
2. Use the accepted implementation's IMPORT and read-only PLAN entry points with
   the exact bootstrap packet. Freeze environment, packet digest, manifest digest,
   fresh prestate digest, exact mutation set, expected revision, evidence refs, and
   Core evidence digest in an immutable plan artifact.
3. An independent reviewer must prove that all targets derive from final Owner
   authority, no name/role/grammar inference occurred, no HUMAN/SERVICE target is
   present, convergence writes once per exact Principal, and protected objects are
   outside the mutation set.
4. Only after `PASS` with zero blockers, acquire the shared production mutation
   slot and invoke one accepted APPLY attempt at SERIALIZABLE isolation. The plan
   must contain only the 44 permitted lifecycle transitions. No automatic retry is
   allowed.
5. Use the accepted VERIFY entry point plus fresh direct readback. Require exactly
   44 canonical lifecycle rows for the planned pairs, zero successors, unchanged
   Principal/client/Grant and Agent-ID/status digests, and the one atomic operation
   audit for this exact lifecycle plan.
6. Require an independent fresh poststate review before proceeding.

Any target drift, stale or changed plan, authority failure, lock conflict,
serialization failure, unexpected write set, or unverifiable result stops the run.
An unknown outcome is reconciled only by exact operation ID and durable poststate;
the operation is never blindly replayed.

## Phase C: enrollment plan only

1. Re-import the exact final 73-subject, 89-binding, 147-row packet and verify its
   canonical digest.
2. Generate a fresh production PLAN. The 63 existing-ready subjects may be
   executable only after their typed targets and lifecycle prerequisites pass. The
   5 provisioning-required, 4 retire-pending and 1 unresolved subjects, and their
   10 bindings, remain explicit non-executable records.
3. Independently review packet/prestate/plan digests, the 73/89/147 denominators,
   canonical lifecycle preconditions, the 63/10 subject split, the 79/10 binding
   split, and absence of historical-equivalence or compatibility behavior.
4. Stop. Do not invoke enrollment APPLY.

## Completion evidence

Completion requires empty enrollment persistence, 44 exact canonical lifecycle
rows, zero successors, unchanged protected Principal/client/Grant state, an exact
production enrollment plan with independent review `PASS` and zero blockers, and
explicit proof that enrollment APPLY, source migration and legacy retirement were
not performed.
