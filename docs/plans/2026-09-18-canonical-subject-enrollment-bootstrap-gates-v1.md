# Canonical Subject Enrollment Production Bootstrap — Three-Gate Fix (v2 takeover)

RUNBOOK = AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_PRODUCTION_BOOTSTRAP_V1
BASE = 3cf7f684a3d5c9b0d3d1f1caffcfc8b063142cbc (fresh github/main, zero drift)
RUNBOOK_HEAD = ff5f37ae692dd76a329c9580408f168a70c5d904 (main + runbook doc; pushed to
`handoff/canonical-subject-enrollment-bootstrap-ff5f37`, DO_NOT_MERGE, not an authority)
PRIOR_REVIEW = INDEPENDENT_PREMUTATION_REVIEW=FAIL, BLOCKERS=3, PRODUCTION_MUTATION=NO

## Scope

Fresh independent takeover. This commit closes exactly the three pre-mutation
review blockers; it changes no product surface (no spec, schema, or
implementation edits). The accepted implementation on main
(`src/lib/oauth/v1/canonical-subject-enrollment.ts`, the enrollment migration,
the foundation migration) is consumed as-is.

## Blocker 1 → Gate A: BOOTSTRAP_EXECUTION_MANIFEST_V1

`scripts/production-bootstrap/bootstrap_gate_runner_v1.py` refuses to proceed
unless, at its own trust boundary:

- the execution manifest file sha256 equals the `--anchor-execution-manifest-sha256`
  carried by the owner-issued single-line command (the trust anchor; recorded in
  every receipt);
- owner packet / owner decision / owner execution mandate / bootstrap authority
  manifest artifact digests re-verify;
- the bootstrap packet raw sha256 and implementation-computed canonical digest
  re-verify;
- the canonical 44-pair set (machine_principal_id, canonical_agent_id) re-encodes
  (`json [[principalId, agentId], ...]` sorted by principalId, separators `,`/`:`,
  sha256) to the sealed digest;
- every packet mutation is TRANSITION_AGENT_LIFECYCLE absent|unresolved→canonical
  matching the manifest pair-for-pair: operation id, per-pair principal, agent id,
  expected prestate and expected revision, no duplicates, none missing, none extra;
- core config digest (agents.json) re-verifies with exactly one enabled
  definition per target agent id;
- the expected schema fingerprint file digest re-verifies.

Any mismatch ⇒ FAIL_BEFORE_MUTATION. Packet/pair/transition data are only ever
read from digest-pinned artifacts, never from caller arguments.

Negative fixtures (runner `--phase selftest`, offline): substitute operation id /
packet digest / pair-set digest, remove, add, change principal, change agent id,
change prestate, duplicate target, authority artifact drift, core config drift,
fingerprint drift — 12 rejects with specific codes + 1 baseline accept.

## Blocker 2 → Gate B: complete schema fingerprint

`scripts/production-bootstrap/schema_fingerprint_v1.py` generates the expected
enrollment-surface fingerprint from a disposable PostgreSQL 16 cluster — never
from hand-written DDL: predecessor = `prisma migrate diff --from-empty` over the
exact pre-enrollment `schema.prisma` (parent of the commit that introduced the
enrollment migration), then the exact enrollment migration bytes; the expected
surface is the canonical entry delta. Entries cover enums (labels + order),
columns (type incl. typmod, nullability, default, identity/generated), PK/unique/
check constraints, FKs (columns, target, ON UPDATE/DELETE, match), indexes
(expression, predicate, uniqueness), functions (identity, language, volatility,
SECURITY DEFINER/INVOKER, owner when definer, full definition body) and triggers
(timing, events, deferrable properties, full definition body) including the
cross-table trigger on agent_identity_lifecycle.

Classifier: NOT_INSTALLED (no ledger + empty surface) / EXACTLY_INSTALLED
(ledger exact incl. checksum == migration sha256 + surface exact) /
PARTIAL_OR_DRIFTED (everything else). Built-in drift selftest proves each of the
8 fixture classes (drop CHECK, FK action, enum labels, partial-index predicate,
function body, trigger definition, column nullability, column default)
classifies PARTIAL_OR_DRIFTED; determinism re-build reproduces the digest; empty
and predecessor-only databases classify NOT_INSTALLED.

## Blocker 3 → Gate C: EXECUTION_COMPONENT_MANIFEST_V1

`scripts/production-bootstrap/build_component_manifest_v1.py` seals every
execution-trusted component: privileged runner and helpers (git blob + clean
worktree + file digest — a modified or uncommitted runner fails
`RUNNING_BYTES_DIFFER_FROM_COMMITTED_BLOB` / `WORKTREE_DIRTY`), the TS host and
its recursively closed local import set, prisma schema, package.json +
lockfile, the exact migration bytes, the runbook bytes, packet v2 (raw +
canonical), authority artifacts, the expected fingerprint, the resolved prisma
CLI / tsx entry (symlink path + resolved target + target digest), directory
Merkle digests for the prisma/@prisma/zod/tsx/esbuild packages (no transitive
executable bytes omitted), and node/python/psql/git binaries (path, version,
digest). The runner re-verifies every entry immediately before any privileged
action; tamper fixtures flip each class and are rejected by the digest checks
(file/symlink/Merkle/git-blob classes are exercised by the same verify path).

Nothing enters the mutation lane through PATH lookup, mutable symlinks, or
dynamic local imports: the host runs from the reviewed tree via sealed absolute
paths; its import closure is proven sealed at build time.

## Mechanical refresh: bootstrap packet v2

The v1 bootstrap packet expired 2026-09-17T23:23:57Z (PLAN hard-fails
PLAN_EXPIRED; the runbook requires an unexpired plan). The v1→v2 refresh is
purely mechanical: same operationId b341ed9f-27eb-5c92-a9b1-4a1524bcd45f, same
44 mutations derived byte-for-byte from the same sealed authority manifest
(proven by the `--verify-against` v1 round-trip re-derivation), only
createdAt/expiresAt re-minted (2026-09-18T04:44:09Z → 2026-09-20T04:44:09Z).
v2 canonical digest is sealed in the execution manifest; no authority content,
Owner attribution, or target changed.

## Execution flow after independent review PASS

1. Owner native-admin command #1: `preflight` + `install` (Phase A) + `plan`
   (Phase B PLAN freeze; single pending migration proven; protected Principal/
   Client/Grant/secret/rotation/user digests snapshotted before/after; slot
   acquired/released; root receipts).
2. Independent PLAN review (exact planDigest, prestateDigest, pairs == sealed
   pair set).
3. Owner native-admin command #2: `apply` (one SERIALIZABLE APPLY attempt, no
   retry; accepted VERIFY + fresh readback: exactly 44 canonical lifecycle rows,
   0 successors, enrollment tables still empty, protected digests unchanged).
4. Independent poststate review.
5. Owner native-admin command #3: `enrollment-plan` (Phase C PLAN ONLY — the
   runner has no enrollment APPLY mode; 73/89/147 and 63/10/79/10 reconciliation
   must match the sealed expectations exactly, else STOP with the exact drift).
STOP. No enrollment apply, no source-binding writes, no provisioning, no
retirement.

Protected artifacts (44-pair manifest, packets, receipts) stay in the local
protected-closure directory; nothing census-class enters this public repository.
