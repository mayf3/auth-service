---
spec_id: AUTH_SERVICE_MCP_CANDIDATE_RELEASE_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - One original Auth MCP pilot release generation and pre-listen runtime verification
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
accepted_by: "Coordinator01a14c3f-4210-76f2-86ce-f7bcf7da1d38, explicitly delegated by latest user for this transaction only"
accepted_date: "2026-10-18"
accepted_at: "2026-10-18T05:00:37.180859+00:00"
accepted_reviewed_spec_commit: "087d2c52f268e049d33492dc30e345cc96010119"
accepted_reviewed_spec_sha256: "10d1c629835921055c9e1fbce31de41a05eecceb1751e6a07f49e40dc6b6b6d0"
acceptance_review_verdict: "ACCEPT"
acceptance_record: "docs/audits/2026-10-18-auth92-qualified-acceptance.json"
---

# AUTH_SERVICE_MCP_CANDIDATE_RELEASE_V1

**ACCEPTED — QUALIFIED DECISION RECORDED; ACTIVE ONLY AFTER MERGE INTO `main`.**
Coordinator `01a14c3f-4210-76f2-86ce-f7bcf7da1d38`, explicitly delegated for
this PR92 transaction by the new user authorization, accepted the exact reviewed
proposal `087d2c52f268e049d33492dc30e345cc96010119` at `2026-10-18T05:00:37.180859+00:00`.
The original proposed body below is preserved byte for byte as the authoring
snapshot; its proposed/readiness statements are historical, not a reversal of
this acceptance. The actual identity binding and named authentication, delegation,
privilege and availability policies are recorded in the acceptance audit.
No LA authentication, phase mandate, implementation or production operation occurs
in this lifecycle commit. Existing effect authorization is separate and retained.
Acceptance provenance and boundaries: `docs/audits/2026-10-18-auth92-qualified-acceptance.json`.

## 1. Goal

Make one complete, independently reviewed Auth MCP candidate capable of entering
service only after its actual serving process has loaded the intended V1 contract
and an independent verifier has established complete registry/DB agreement. The
original Auth release actor remains the only release writer. Existing MCP effect
authorization is retained; this Spec supplies missing release behavior, not a new
business-effect approval or another executor.

## 2. Scope and non-goals

In scope: a complete pinned release artifact; one stopped/drained original issuer;
one candidate process generation; same-process pre-listen verification; exact
read-only alignment; bounded authenticated delegation consumption; one resume;
durable failure fencing; isolated conformance and original-lane receipts.

Out of scope: new Audience/Scope/Grant/token semantics, Human authentication design,
DB mutation or migration implementation, credential delivery, website rollout,
DSH/MCP TLS/ACL/Binding/configuration or business calls, B7/system8788, a second
service instance, new daemon/API, generic approval/signature/release platform,
automatic restart, and rewriting historical evidence. This proposal authorizes no
current implementation, service/configuration change, authentication prompt, DB
read/write, installation, acceptance or merge.

## 3. Authority and dependencies

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
BASE_HEAD = 6cf266386d815f5c822ce3d59905209210efb29b
FIXED_PRIOR_SOURCE_HEAD = f026d812699f0ac58e5678b4c645d84012ed4cfb
FIXED_PRIOR_SOURCE_TREE = 6d829ed47d03865915cbdb8474389a30c92faf05
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

The architecture preserves frozen V1 wire/profile/Grant laws and distinguishes
source conformance from production effectiveness. At the exact base the accepted
`AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1` owns its fifteen source
paths and SERVICE entry. Accepted `AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1`
CTR-MCS-011/012 requires original-owner stop/load/actual alignment but does not
implement this entry point. Its proposed whole successor
`AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V2` owns the finite Human-authenticated
delegation, exact Agent@1 to SERVICE@2 migration, supply and compensation. This
release Spec depends on that successor's acceptance in the implementation base;
proposal coexistence is not acceptance. It neither amends nor partially supersedes
either Supply authority. The Forum build repair is separately owned by
`AUTH_SERVICE_FORUM_MINT_AUDIT_REPAIR_V1`, currently proposed.

All three new authorities must receive independent exact-head review, acceptance
by `mayf3` or an explicitly delegated Auth maintainer, and merge into main before
their dependent implementation. The former delegation accepting only the two
fixed Auth #90 contracts does not appoint an acceptor for this release Spec.
Implementation/source need not themselves be merged into main as an extra release
gate: accepted authority in base, exact reviewed source/tree/artifact and executed
conformance are the requirements. The one controlled operation additionally needs
the attributable original mandate, finite delegation and child load mandate.

This is the implementation-owning release decision; a runbook cannot invent an
exception to its Contracts. Supply V2 remains the sole owner of authentication and
delegation policy. Release consumes its verified parent and child through the
protected interface below, never by copying a message or accepting root identity
as Human proof. No acceptance or right of further delegation is conveyed.

## 4. Current State

### STATE-MCR-001 — Receipt-bound release readiness

At the source and October receipt coordinates in OBS-MCR-001, OBS-MCR-002 and
OBS-MCR-003, the old service and fixed source are different lifecycle states; the
full candidate build, independent pre-listen verifier and actual full DB alignment
are NOT_VERIFIED. Basis: CLM-MCR-001 and EVD-MCR-001. This is the recorded state,
not a fresh production observation.

The historical consumer SHA `67361c3b2c1c2f1da69cdb65f13a2806f47468c080e91fa7b5f1d1738301244a` is preserved at `consumer-authority-provenance-before-freeze/MCP_LEGACY_AUDIENCE_CONSUMER_OBSERVATION_20261018.json` under `/Users/yanfenma/workspace/project/pilot1156-review-20261018/`. The final same-name canonical-path receipt SHA is `7cfcf01a8c20572df69569986216782f3b29d220cff40f39dd821309b01be15d`; `MCP_LEGACY_AUDIENCE_CONSUMER_FREEZE_RECEIPT_20261018.json` SHA `afa967a6ac95d362183cb47072b5b40a26214ef08ddc3b6e96420ae2753ab289` preserves both and proves identical query/DB/reader projections. Only task-origin wording changed: coordinator instruction under existing user authorization and automatic recovery are not new Human authentication. Historical pins are not replaced.

Fixed `MCP_NATIVE_OWNERSHIP_STATIC_FACTS_20261018.md` SHA `ebef69783830043b87c468692ca98926f85ea6f7ee46168cfe3b1a5eac3e2b88` records candidate DSH `0bc70fb59b15e296fb6467a881fe235a2ae0ae95` accepted-r3 Contracts CTR-NC-001/003: a verified clientId is mapped by DSH-controlled configuration to subject_id, communication_scope_id and surface principal; the result key is `(subject_id, communication_scope_id, request_id)`. Auth Principal UUID need not equal connector_subject; differing namespace values alone are not a defect. This static capability does not establish the old production map or authorize a new SERVICE to inherit it. Actual old map/result ownership remains UNKNOWN pending the original DSH role's bounded evidence. Reuse that existing map/authorization mechanism if independently established; do not demand a new cross-namespace equality, approval platform, whole-repository census or repeated MCP effect approval. Existing consumer-disposition and UNKNOWN guards remain unchanged.

## 5. Observations

These are receipt/source readings, not new production executions. All October
receipts below reside under
`/Users/yanfenma/workspace/project/pilot1156-review-20261018/` and were read during
docs-only authoring on 2026-10-18. Their timestamps describe their own observations.

### OBS-MCR-001 — Incomplete source addendum and failed full build

`auth-source-release-f026d81/RELEASE_PREPARATION_RECEIPT.json`, SHA256
`435ae599035f29fe9fa85794dd19bf8f505a73733bc6734119fb943dc36d8017`, records at
02:46:04Z an exact 22-entry source archive SHA256
`9eed7e2658e9f72db4011321adb10df207a314b66f8bc988bfd7c6533252ea29` for f026d812.
`auth-runtime-build-f026d81/BUILD_RECEIPT.json`, SHA256
`d5ae23e73af7b56bafacd283076351afae4165f7338208f240300e631dd4cac2`, records at
03:45:02Z `tsc --noEmitOnError` exit 1, existing TS2322 in the Forum helper, and
`dist_emitted=false`. The archive is not a runnable whole release. Its union-only
repair suggestion is incomplete; the separate Forum proposal also fixes audit
`scope` to `scopes`. No build was repeated during this authoring.

### OBS-MCR-002 — Old installed bytes and limited loaded identity

`AUTH_RELEASE_PREIMAGE_AUDIT_20261018.json`, SHA256
`e4addf65dcfaf9c9417834ecdca794e773e875b269241259b2881271da8797fb`, recorded at
03:45:08Z, preserves earlier restricted disk/supervisor observations (individual
earlier command times unavailable). It names `system/com.auth-service`, authsvc,
PID 34351, current KeepAlive/RunAtLoad true, a directory named for 862eab3 and
dist/server SHA256
`f540ed511032898728ad8eb26ed9554ab9878009b94e22f9fecae2af8c846828`.
Its generated 1.13.0 contains thirteen Audience entries; the first twelve entire
entries equal the candidate's in order, with only the final MCP entry's principal
types and notes differing. This is a disk comparison, not thirteen DB readbacks.

`AUTH_LOADED_CONTRACT_OBSERVATION_20261018.json`, SHA256
`10ccd90a3e34c8ed5bd128fcdc89ea5db6815dec5718c2f5e0c8599d70980acb`, records the
03:49:33Z original actor health read: cached mode `v1`, version 1.13.0, digest
`14f8d713c1702361199a947faee2c59bda0dff724dceb96c9df9fb53fbc16f0a`; its separate
listener follow-up binds PID 34351 to 127.0.0.1:4001. Source bundle digest was not
directly exposed and DB agreement remained UNKNOWN. A directory name or Git HEAD
does not describe the full installed overlays.

### OBS-MCR-003 — Only the fixed MCP DB target was observed

`AUTH_DB_AUDIENCE_OBSERVATION_20261018.json`, SHA256
`881bf61aa02e9ce016113ec2b95de227fc6d8ec184cb77828d241a7dcdccc0ce`, and
`AUTH_DB_ROUTE_DELTA_20261018.json`, SHA256
`435bfd65e86334bed646f7c85731d845a6d6f22ac5317db566a7b46e9269d476`, record the
03:56:47Z original fixed-target read, transaction ROLLBACK_CONFIRMED. MCP was
active/freezeReady Agent@1, not SERVICE, with the historical registration audit
`deedbadf-3968-427b-871f-2e418777877d` lacking this operation/plan provenance.
At that observation all-registry DB alignment, related Client/Grant consumers and result readers were not established. Later fixed consumer evidence is added in OBS-MCR-005 below; it does not establish full alignment or result ownership. No new query is authorized or performed by citing these receipts.

### OBS-MCR-004 — Current entry point exposes serving too early

At base6cf and fixedf026, `src/server.ts` imports environment/contract modules,
initializes its contract and ultimately calls `app.listen` during module import.
`src/lib/oauth/v1/contract.ts` caches the validated generated payload in module
scope; its path is resolved from cwd. `initializeAuthContract` accepts v0,
v1_shadow and v1; `getV1RuntimeSnapshot` alone does not prove selected serving mode.
`tsconfig.json` includes src only, so the new scripts entry requires an explicit
isolated compilation input rather than an assumed main build output. This is
source inspection, not demonstrated new wrapper behavior.

### OBS-MCR-005 — Existing old consumer and occupied credential path

The original actor's later fixed-target receipt `MCP_LEGACY_AUDIENCE_CONSUMER_OBSERVATION_20261018.json`, SHA256 `67361c3b2c1c2f1da69cdb65f13a2806f47468c080e91fa7b5f1d1738301244a`, observes at 04:22:22.072Z one exact Client/config client_id join, an active Client and Agent Principal, and a target Grant row/version1 (no Grant.status field). Separately read old config/credential shares connector_subject15ea4ad2-02db-408d-a1d9-2b92d74a10dd, which differs from DB Principal042b6ec9-b0a4-49fa-b3c4-d80e80606e6b and is not a verified mapping. Old request/results/owner communication scope, historical token/authorization and external_ref absence remain unknown. This later fact does not close the scoped consumer disposition gate. Supply V2 now selects a distinct fixed new SERVICE credential file; release cannot switch MCP consumption or transfer old result ownership. Measurement provenance is the original coordinator-authorized operational read; the receipt's original direct-user wording is not Human-issuer evidence. No new query was run for this text.

## 6. Claims and assumptions

### CLM-MCR-001 — Release proof gap and bounded design inference

SUPPORTED by EVD-MCR-001: the old service and fixed source are different lifecycle
states; the full candidate build, independent pre-listen verifier and actual full
DB alignment are NOT_VERIFIED. INFERRED by EVD-MCR-002: importing the existing server
before verification would violate the stop-before-resume requirement. A same-module
pre-listen wrapper can implement the boundary, subject to the future conformance
matrix; feasibility is not a production readiness claim.

## 7. Evidence relations

| ID | Source and target | Sufficiency and limitations |
|---|---|---|
| EVD-MCR-001 | OBS-MCR-001, OBS-MCR-002 and OBS-MCR-003 SUPPORT CLM-MCR-001 and STATE-MCR-001 at the recorded artifacts/times | Establishes build and alignment gaps; cannot establish current liveness, absence of consumers or full DB equality. Original receipts remain readable by the independent reviewer. |
| EVD-MCR-002 | OBS-MCR-004 SUPPORTS the bounded pre-listen design in DEC-MCR-002 | Exact source shows cache/import/mode boundaries; acceptance still needs executed same-process, failure and module-resolution tests. |
| EVD-MCR-004 | OBS-MCR-005 and its preserved/final provenance coordinates SUPPORT the bounded old-consumer disposition and independent destination | Static mapping capability is not actual production binding, result ownership, absence of readers, or Human-issuer authority. No repeated measurement. |
| EVD-MCR-003 | Reviewed decision input `AUTH-OWNING-DELTA-PROPOSAL-20261018.md` SHA256 `3ea266aed67e913431a75f90cbe2946091ad08c88efc2c36307f081b2c427879`, D3, CONSTRAINS this proposal | Existing decision review is input, not Product Authority or acceptance. The later explicit user requirement adds finite delegation and automated per-phase derivation, owned by Supply V2. |

## 8. Decisions

- DEC-MCR-001: preserve the original release writer and frozen f026 source; build
  one new complete composition with independently authorized deltas. Preserve all
  unrelated runtime overlays or stop if their reproducible provenance is unavailable.
- DEC-MCR-002: initialize the existing compiled V1 contract in the future serving
  process; verify actual mode, cache, module URL, registry and DB before importing
  the compiled server. The verifier supplies a five-second, one-use resume message.
- DEC-MCR-003: use Supply V2's single real Human authentication to establish a
  pilot-only parent delegation of at most sixty minutes. Within it the original
  executor derives distinct phase mandates automatically. Release consumes only
  the one `candidate-load` child; it creates no authentication/approval service.
- DEC-MCR-004: one initial load, no retry or automatic rollback. KeepAlive and
  RunAtLoad stay false for the entire controlled serving generation, including
  after success. Crash means stopped. A later start is a new operation needing
  its own valid authority/mandate, not reuse of this consumed delegation capability.
- DEC-MCR-005: complete registry comparison and exact bounded read-only DB alignment
  are release obligations. Non-target drift stops release, never repairs another
  Audience. Retain all historical evidence and reader/result debts.

## 9. Contracts

### CTR-MCR-001 — Source closure and authority boundary

Only these implementation files belong to this Spec:

```text
scripts/start-auth-mcp-release-v1.ts
scripts/run-auth-mcp-release-v1-conformance.sh
tests/oauth/auth-mcp-release-v1.test.ts
```

The TypeScript entry holds this bounded wrapper and read-only verification logic;
the shell file is an isolated conformance/build harness, never the production
writer. Tests exercise the real compiled wrapper. No source server, loader,
package/lockfile/tsconfig, generator, Prisma schema, registry or accepted Spec may
be changed under this closure. No fourth implementation file, daemon or API is
permitted. A required additional semantic path is a re-PREFLIGHT trigger.

Composition may include the accepted Forum repair and accepted Supply V2 changes
under their separate exact closures. The original MCP fifteen-path CCR and its
three-path source baseline remain traceable; Supply V2 may amend its owned paths
only through its whole successor, not by claiming the old eighteen-path authority
grew. The frozen f026 worktree/tree and prior receipts are not edited. This Spec
does not authorize acceptance, current production mutation or unreviewed composition.

### CTR-MCR-002 — Complete reproducible artifact and execution plan

Before the stopped window, the original actor MUST bind a new source commit/tree,
accepted Spec refs/file digests, exact dependency lock, compiler/Node/OS/CPU/SDK
versions, build command/exit, and complete artifact SHA256. Clean full src
compilation MUST use `--noEmitOnError`; wrapper compilation MUST use the same
NodeNext/ES2022/strict settings and rootDir, include the wrapper plus its src import
graph, and produce `dist/scripts/start-auth-mcp-release-v1.js` next to the SAME
`dist/src` output. A temporary build configuration in the isolated build directory
is allowed as a generated build input recorded in the manifest; no tracked
tsconfig/package delta is allowed. Two separate compiled copies of contract/env
are forbidden. Generated runtime is derived by the existing validated generator.

The artifact manifest is a canonical JSON object with `schema_version:1`,
`source_commit`, `source_tree`, `authority_pins`, `toolchain`, `build_inputs`,
`files`, `overlay_dispositions`, `entrypoints`, `generated_identity` and
`artifact_digest`, `private_config`. The digest excludes its own field. `private_config` is the ordered list of opaque private bindings defined below. `files` enumerates every non-secret artifact path, kind, mode, size, SHA256 and, for a symlink, exact target and resolved content identity; external/dangling links or unenumerated executable inputs fail. It covers source, dist, generated payload, dependency tree, Prisma engine/client, native modules, Node executable, launcher and non-secret runtime overlays. Secret-bearing configuration and keys are explicitly excluded from public files hashes and the distributable artifact: each appears only in a closed private_config binding `{custody_ref, dev, ino, uid, gid, mode, purpose}` with purpose exactly service-env or private-key and without content/hash/size disclosure. Their actual protected file identity and authorized read access are checked by the original actor; public artifact completeness does not mean publishing private content or its digest. No secret bytes or reversible credential projection enter a
public manifest. Private configuration is retained in protected custody and bound
by an opaque custody record and invariant file identity; it is not printed.

Every installed overlay has `RETAIN` with exact reproducible source and build
evidence, or an explicitly accepted `RETIRE/MIGRATE` decision and affected-consumer
evidence. Missing provenance stops whole replacement. Copying old dist, renaming a
directory, recording only twenty-two entries or passing a focused test cannot
substitute for the complete artifact. Runtime/generated version labels are not
business acceptance. Existing 17/139 receipts remain evidence only for their bound
unchanged coverage; new composition/build/affected tests receive new evidence.

The closed `release-plan.json` schema is `schema_version:1`, `parent_digest`,
`load_operation_id`, `old_identity`, `artifact_digest`, `source_commit`,
`source_tree`, `authority_pins`, `generated_identity`, `env_custody_digest`,
`original_lane_ref`, `service_descriptor`, `read_set`, `registry_delta`,
`phase_a_operation_id`, `phase_a_plan_digest`, `phase_a_receipt_digest`,
`reader_disposition_digest`, `build_receipt_digest`, `conformance_digest`,
`window_plan_digest`, `deadline` and `plan_digest` (digest excludes itself).
`env_custody_digest` hashes only the canonical opaque private bindings, never secret bytes or their content hashes.
All pins are measured actual values supplied before child derivation, not defaults
or invented hashes. Closed schemas reject unknown keys, null required fields,
duplicate JSON keys and ambiguous encodings. Canonicalization follows Supply V2
CTR-MCS-015: recursively lexicographically sorted keys, preserved array order,
compact UTF-8 JSON; no undefined/NaN/floats/noncanonical numbers, only safe
nonnegative integers. Digests are lowercase SHA256 hex, Git refs full forty-hex,
UUIDs canonical lowercase, timestamps UTC ISO8601 with milliseconds. Release-only
schemas explicitly use version 1; imported Supply parent/child retain version 2
and their original exact bytes/digests without translation.

### CTR-MCR-003 — Finite delegation and one load capability

The wrapper MUST consume Supply V2 CTR-MCS-013/015's verified sealed parent, not
authenticate Human identity again. Parent schema_version=2 binds delegation UUID,
issuer/account, original executor/directive, environment, authority/source/artifact/
helper pins, fixed pilot target, bounded capability list, nonce and authentication
receipt; its total lifetime is at most 60 minutes. The child closed envelope is:

```text
schema_version: 2
parent_delegation_id, parent_delegation_digest
phase: candidate-load
operation_id, plan_digest, approval_nonce, actor_ref, environment
source_commit, artifact_digest, created_at, expires_at, attempts_max: 1
```

Child lifetime MUST be at most ten minutes and end no later than parent expiry;
`approval_nonce` is 256-bit base64url. `actor_ref` is the original Auth execution
lane, `environment` is production, and all plan/source/artifact pins exactly match
the authenticated parent and fixed release plan. Before any launch or resumed
service, the original executor exclusively claims `candidate-load` once across
the entire parent delegation, fsyncs the claim, and validates parent validity,
revocation/failure state and phase prerequisites. It may derive this child without
another Owner interaction. Other phases have independent nonces/plans/claims.

Expiry, malformed evidence, changed plan, changed actor, second claim, unknown
prior result or a failure fence rejects. A new nonce does not clear a consumed or
UNKNOWN claim. No automatic renewal or derivation of a second load is allowed.
Parent authentication does not prove old message identity, create Spec acceptance
qualification or expand original effect authority. Supply V2 determines how the
parent was authenticated and sealed; this Spec cannot replace it with local JSON,
root privilege, an OS account name, a saved success or a second approval store.

### CTR-MCR-004 — Fixed custody, artifacts and producer roles

Protected state root is
`/private/var/db/auth-service/mcp-pilot-v2/<delegation_id>/`; release operation
directory is its fixed `<operation_id>/` child, identical to Supply V2 custody.
UUIDs come only from
the authenticated delegation and claimed child, never arbitrary caller paths.
Root and operation directories are root:wheel 0700; non-secret receipts 0600.
Fixed release basenames are `release-plan.json`, `artifact-manifest.json`,
`installed-preimage.json`, `stop.json`, `phase-a.json`, `loaded.json`,
`registry-diff.json`, `db-alignment.json`, `resume-claim.json`, `serving.json`,
`failure.json`, `window-end.json` and `journal.jsonl`. They are records of actual producers, not inputs
that an untrusted caller may author. The parent delegation/claim locations and
meaning remain Supply V2's, with no duplicate release approval ledger.

The original privileged release actor alone installs an immutable candidate under
`/Library/Application Support/auth-service/mcp-pilot-v2/releases/<artifact_digest>/`
and preserves
the original private preimage under the operation's `preimage/` directory. A
manifest pins the original current service descriptor and private-config custody.
Release executable directories and their ancestors are root:wheel 0755, files
non-writable by authsvc; the readable artifact is separate from root-only custody.
Private configuration uses ONE route: the original privileged actor retains the exact existing dotenv-format configuration as `preimage/service.env` in root-only operation custody (0600 root:wheel, never in the distributable/public artifact). Before the supervisor drops privilege it reads that validated file internally using the pinned existing dotenv parser and builds the serving/verify children's environment from its exact approved key/value set plus the fixed non-secret service parameters. No caller environment overrides, NODE_OPTIONS/DYLD injection or alternate dotenv path are admitted. Artifact cwd MUST contain no .env or .env.*; existing dotenv/config imports therefore see only the prevalidated inherited process environment. Existing DB/key-path settings are retained, and referenced private key files remain at their measured protected existing paths with their original service read access; no new ACL or permission is created. If those paths cannot be retained/read by authsvc, refuse. These secret values live only in protected memory and the original service processes, never in a public manifest/plist/control frame/log. This is a necessary existing runtime configuration input, not an authentication/credential handoff channel or new supply secret. There is no arbitrary config-file request option.
The exact original service label remains `system/com.auth-service`, listener
127.0.0.1:4001, serving user/group authsvc. The controlled descriptor is separately
recorded as `com.auth-service.controlled.plist` in the operation directory and
installed at `/Library/LaunchDaemons/com.auth-service.plist` only by the original
release actor under the accepted controlled operation. No second label is created.

The descriptor has exactly the existing Label `com.auth-service`, UserName `root`,
GroupName `wheel`, WorkingDirectory at the immutable artifact, ProgramArguments
`[<manifest-pinned-node>, <artifact>/dist/scripts/start-auth-mcp-release-v1.js,
"supervise", <delegation_id>, <operation_id>]`, KeepAlive false and RunAtLoad false.
The UUID arguments identify custody only; they carry no credential or authority.
Standard output/error retain the original protected service log destinations;
EnvironmentVariables carry only the fixed non-secret launch environment. Original
private environment/config inputs are preserved through their pinned custody,
not copied into argv or public plist fields. No MachServices/Sockets/inetd entry,
extra launchd job or alternate service command is permitted. The manifest-bound
descriptor closes the original observed duplicate server arguments.

Launchd does not inherit arbitrary FDs from the earlier executor. Consequently
the same entry has three closed process roles: `supervise`, `serve`, and `verify`.
The original actor's explicit one-shot launch runs `supervise` as root solely to
validate the already authenticated, sealed Supply V2 parent/claimed child origin,
open this operation's protected append journal and establish private child FDs.
Reading a root-owned file cannot establish that origin: the complete actual
authenticated issuance/custody chain and original actor's sealed launch claim
must verify under Supply V2. Unknown/unverified issuance refuses before spawn.
The supervisor derives no parent or phase mandate and cannot accept caller JSON.

Its hard spawn budget is `serve=1, verify=1`, with no retry of either role. It
spawns exactly one `serve` child as the existing measured authsvc uid/gid and
one short-lived independent `verify` child, also authsvc, using the same immutable
compiled wrapper; the latter performs only CTR-MCR-008 read-only work, zero product
calls or listeners, and exits. It is not another release or database writer.
Both receive only their own inherited FD 3 and immutable role inputs; authsvc IDs
are exact measured service descriptor values, not name-to-identity guesses. The
verifier cannot send on the serving child's channel and cannot authorize itself
to resume. This is one existing launchd job, one actual server and one bounded
read-only verification process, not a second service or long-running daemon.

After actual LOADED and independent ALIGNED pass, but BEFORE sending RESUME, the
supervisor fsyncs the resume claim and irrevocably drops supplementary groups,
gid and uid to the same authsvc identity. It closes every privileged/directory/
configuration descriptor except the pre-opened O_APPEND descriptor for this
operation's safe `journal.jsonl` and the fixed read-only descriptor for its
`window-end.json`; it retains only child/control handles needed to
finish this fixed attempt. Actual effective/real/saved uid/gid and group state
must confirm privilege cannot be regained. A failed or unverifiable drop kills
the still-nonserving child and stops; it must not send RESUME. The immutable load
claim already fences a supervisor crash at this boundary. The five-second resume
deadline includes the drop interval; expiry fails, never refreshes the same token.
After successful admission it only appends safe observations, waits for this one
child and propagates its exit, never spawns a replacement. The original outer privileged release actor MUST stay present through the whole release/Phase B window. It alone materializes root-only serving.json, failure.json and window-end.json from actual received/journal observations; the permanently dropped supervisor never creates/renames files inside root0700 custody. It can only append safe closed observations to its pre-opened per-operation journal FD and report child status. The outer actor validates the measured journal inode, sequence, source/generation and actual process/listener state before sealing a terminal file; a caller-written line is insufficient. The supervisor retains the outer actor's pinned OS process/start identity and monitors its liveness until the outer actor records the window's terminal handoff. If that actor disappears before handoff, the supervisor terminates the serve child and exits without replacement; absence of a root terminal file remains UNKNOWN/fenced for the same original lane's read-only reconciliation. A retained valid window-end record ends only this outer-actor liveness duty, not the supervisor↔serve FD monitoring. A fixed read-only FD to that one pre-created window-end record may be retained across drop solely to observe its complete sealed terminal content; no directory/privilege-widening handle is retained. The outer actor writes it exclusively through its already-open original descriptor, fsyncs, and then closes it. The descriptor is opened before privilege drop against the measured root-owned inode and initially contains zero bytes. The supervisor reads only that inode with a bounded size of65536 bytes. Empty, partial or temporarily unparsable content while the original actor remains alive means handoff pending, never permission or automatic failure. Only one complete canonical closed record with the exact window/parent/actor/generation and terminal receipt pins ends the liveness duty. If the actor disappears before a valid complete record is observed, the supervisor stops/fences; a later completed file cannot authorize restart. The outer actor waits for the supervisor's safe journal acknowledgement of the exact window-end digest before relinquishing its process duty; a missing acknowledgement is UNKNOWN. Partial writes therefore cannot be mistaken for a successful handoff. No polling path may reopen arbitrary custody files or retain a root directory descriptor.

Root startup privilege
and the changed initial job identity are explicit proposed release policy, not
Human authority; steady-state serving and supervising identities are authsvc.

Creation uses exclusive files, fsync and parent-directory fsync, rejects existing
conflicting stage records, validates real parent/inode/owner/mode and forbids
symlink/hardlink substitution. A valid prior byte-identical observation is history,
not permission to replay an effect. The original actor writes custody; the serving
child reports loaded facts; a separately launched verifier process reports its
own read-only DB/comparison results; the original actor seals those received
results. The verifier does not write DB, install, start or resume. Serving child
cannot manufacture verifier evidence. No direct requester `receipt_ref` or
boolean claim is trusted; all paths are derived from the fixed operation.

The threat boundary excludes a compromised privileged host/executor; root is an
execution privilege, never Human authority. Missing trustworthy process/FD/custody
provenance causes refusal, not a claim that filesystem ownership proves consent.

### CTR-MCR-005 — Original stopped/drained exclusive window

The original release actor MUST retain its original exclusive mutation lane and
prevent competing release/registry writers through actual owner-bound window
custody until resume completion or a recorded stopped terminal state. Its window
record identifies actor, holder process/start generation, service, old artifact,
registered writers excluded, beginning and operation ID. A new lock belonging only
to this wrapper does not prove exclusion of other original writers.

Before Supply V2 migration, obtain a restorable full preimage, preserve reader/
result disposition, disable automatic restart, boot out the original job and
confirm process exit, no listener and drain. This includes all actual child PIDs
and active connections; absence in an unprivileged process listing is insufficient.
`stop.json` records service/old process generation, old installed and loaded tuple,
preimage manifest, no-listener/exit/drain observations and window ownership.
Unresolved drain or writer exclusion stops the release before DB mutation.

Phase A is executed only by its separate Supply V2 machinery/mandate and writes
its own transaction/audit receipt. Release never performs that migration. Migration
success plus an old/stopped runtime is `stopped_pending_load`. MCP requires the
specific migration's SERVICE@2 and audit; a copied SERVICE row is insufficient.
Prior observations do not replace execution-time CAS or receipt checks.

Stop/window and alignment witnesses must be revalidated no more than five seconds
before their consumption. A fresh witness may prove unchanged fixed pins, never
change a plan or replace authenticated receipt identities. The exclusive window
continues through the actual import/listen transition; detected drift invalidates
resume. If ongoing exclusion cannot be established, there is no resume capability.

### CTR-MCR-006 — Private FD protocol and exact producer binding

Each actual child receives one separately created private socketpair on FD 3;
there is no named socket, TCP listener or stdio/argv/env channel for Human proof, phase mandates or newly supplied credentials. CTR-MCR-004 alone permits the existing service private configuration in its child process environment; that exception never carries authentication replies or supply secrets.
Framing is a four-byte big-endian length followed by canonical closed UTF-8 JSON,
maximum 65,536 bytes. Oversize, truncation, trailing bytes, duplicate keys,
unexpected order/type, EOF and wrong challenge reject and fence. No chunking or
fallback transport is authorized. Full registry and DB projections must fit the
bound frame; a larger registry requires re-PREFLIGHT, not silent truncation.

Every message has exactly the common fields `schema_version:1`, `type`,
`parent_digest`, `child_digest`, `operation_id`, `attempt_id`,
`process_generation:{pid,start_nonce,start_time,uid,gid,executable_digest}`,
`challenge_nonce`, `sent_at` and `payload`. The parent creates the 256-bit start
and challenge nonces and binds them to the actual child handle, OS start time and
executable; the PID alone is never identity. Every response echoes the exact
challenge. Bootstrap proof of parent/child digests is through this actual process
launch chain, not proof from the message fields alone. Allowed types/payloads:

| Type / producer | Closed payload |
|---|---|
| `LOAD_CHALLENGE` / original executor | `release_plan_digest`, `artifact_digest`, `expected_mode`, `cwd`, `env_custody_digest`, `contract_module_url`, `env_module_url`, `server_module_url`, `deadline` |
| `LOADED` / actual serving child | `release_plan_digest`, `artifact_digest`, `mode`, `cwd`, `env_custody_digest`, `contract_module_url`, `env_module_url`, `server_module_url`, `contract_identity`, `runtime_payload`, `no_listen_yet` |
| `VERIFY_CHALLENGE` / original executor to independent verifier | `release_plan_digest`, `loaded_digest`, `old_loaded_projection`, `candidate_loaded_projection`, `read_set`, `phase_a_receipt_digest`, `window_digest`, `deadline` |
| `ALIGNED` / independent verifier | `release_plan_digest`, `loaded_digest`, `registry_diff`, `db_projection`, `db_snapshot_identity`, `migration_audit_projection`, `phase_a_receipt_digest`, `window_digest`, `observed_at`, `result` |
| `RESUME` / original executor only after valid independent ALIGNED | `release_plan_digest`, `loaded_digest`, `alignment_digest`, `window_digest`, `mode`, `contract_module_url`, `server_module_url`, `runtime_digest`, `db_projection_digest`, `phase_a_receipt_digest`, `resume_nonce`, `issued_at`, `expires_at` |
| `FAILED` / serving child or verifier | `stage`, `error_code`, `last_valid_message_digest` |

Each role accepts only its designated message types in the stated sequence. The
parent's verifier FD is different from its serving-child FD; cross-channel replay
rejects. `no_listen_yet` is checked against actual process/socket observation and
executed import-graph conformance, never accepted as a self-attested flag.
`RESUME` is consumed once within five seconds, never later than child/parent
expiry. `resume-claim.json` is durably recorded before its transmission. Failure
after transmission is UNKNOWN until independent observation; no resend is allowed.
Receipt JSON is a durable account of this exchange, not a reusable capability.

### CTR-MCR-007 — Actual serving mode, module identity and one cache

The serving process MUST run as the same authsvc user/group, with fixed Node
executable, scrubbed injection variables/Node options and fixed immutable cwd at
the installed artifact. Dotenv loading uses that exact private-config binding;
the parent/verifier do not print environment secrets. The wrapper dynamically
imports exactly `dist/src/config/env.js` and `dist/src/lib/oauth/v1/contract.js`
from that artifact before importing any server module. It MUST observe
`env.AUTH_CONTRACT_MODE === 'v1'`, call `initializeAuthContract('v1')`, then obtain
the actual cached `getV1RuntimeSnapshot()` payload. v0/v1_shadow both reject.

`LOADED` binds this mode, actual payload, contract identity/digests, canonical
compiled module URLs and actual process start generation. URLs MUST have no query,
fragment, symlink alias, alternate loader or src/dist mixture. A source inspection
and executed compiled-graph test must prove the future server import resolves the
identical env/contract module instances in the same process. It is forbidden to
switch mode/cwd/environment, reset/reload cache, re-exec, spawn a replacement server
or alter installed inputs between LOADED and serving. A mutable returned payload
is not permission to mutate cache; before import the wrapper rechecks its same
object reference and digest against LOADED, as well as actual mode/module identity.

Only after valid RESUME may the wrapper dynamic-import the fixed
`dist/src/server.js` URL. It must never import server first and pause afterward.
The existing server's repeated initialization uses that same cached module.
Before RESUME, importing env/contract/wrapper must open no listener, perform no DB
mutation, start no cleanup/timer with external effects and issue no token. All
extra imports that would trigger such effects are deferred. Existing server
effects after resume remain their existing authority; this Spec creates none.

### CTR-MCR-008 — Complete loaded registry preservation and exact DB read set

The verifier compares the complete old actual-loaded payload projection and actual
candidate LOADED payload, not just the MCP entry or source registry. Old projection
may be recovered only from a validated generated payload whose cryptographic
runtimeDigest equals the old actual startup-cache identity, with old PID/listener/
handler provenance; an unmatched disk file or health response alone fails. It
records every registry entry and order, all fields including notes, and lifecycle/
manifest differences. For this pilot the only authorized audience behavior delta
is the fixed MCP entry Agent to SERVICE under accepted CCR/Supply V2. Authorized
version/provenance/notes deltas must be explicitly mapped to their authority IDs.
Every other whole entry is RETAIN with byte-equivalent canonical projection.
Missing/additional/changed unrelated entries reject. Known thirteen-entry disk
equality is useful prior evidence, not substituted execution-time loaded proof.

`read_set` is an exact sorted list of the candidate's complete Audience IDs,
derived from the authenticated artifact and bounded by that list; no wildcard or
all-table census. The original actor must have explicit lawful read authority for
this set before execution. Read-only verifier connects through the original
authorized DB entry under the same operation and starts one consistent read-only
transaction; it queries only `auth_audiences` for those IDs and the exact target
migration audit in `auth_security_audits`. Query failure is UNKNOWN, never absence.
No credentials/Grants/Client or other audit rows are read through this interface.
No DB role/grant change is authorized to obtain missing access.

For each candidate entry, compare exact `audience_id`, `resource_service`,
`scope_namespace`, ordered `accepted_principal_types`, ordered `registered_scopes`,
`human_access_enabled`, `machine_access_enabled`, `delegated_access_enabled`,
`status`, `freeze_ready`. Require exactly one DB row for each ID. Record its version,
created_at and updated_at as DB-only concurrency pins; do not invent these values
from the registry. The fixed MCP row MUST be SERVICE active/freezeReady@2 with
exact operation/nonce/plan/source/authority and before/after/audit linkage from the
committed Supply V2 migration. Record full compared safe row projections and
snapshot transaction identity, not just PASS booleans or a count. Parent rechecks
the exact bounded projection and unchanged window within five seconds before
RESUME; drift invalidates capability. No non-target difference is repaired here.

The original two-table fixed-target receipt is insufficient to meet this full
read-set gate; presently that gate is NOT_RUN. Likewise unrelated runtime overlays
or historical result readers cannot be declared absent from that receipt. The
Supply migration's bounded reader-disposition evidence is a prerequisite to load;
retaining files is not proof of uninterrupted result-read availability.

### CTR-MCR-009 — One-shot startup, completion and no automatic recovery

The original release actor uses only one attempt UUID and one child load claim.
For the entire resulting controlled generation, the one existing service descriptor
has `KeepAlive=false` and `RunAtLoad=false`; an explicit original-owner start is
required. The wrapper's serving child remains the sole Auth server. No health
poller, watchdog, cleanup job or shell trap may bootstrap, retry, restore old
source, resume or mutate DB after failure. The old
`DEPLOY_AUTH_IDR_REVERSE_V1.sh` is RETAINED as historical evidence and RETIRED from
this operation's executable recovery paths; it is not run or edited.

After RESUME, the original actor independently binds the expected listener to the
same authsvc PID/start generation, process/module/artifact identity and validates
the existing permitted non-mutating interface checks. `serving.json` contains
`schema_version:1`, `operation_id`, `attempt_id`, `parent_digest`, `child_digest`,
`source_commit`, `artifact_digest`, `process_generation`, `mode`, `module_urls`,
`runtime_identity`, `loaded_digest`, `alignment_digest`, `phase_a_receipt_digest`,
`listener_observation`, `interface_check_results`, `resumed_at`, `window_id`,
`window_state` (held_for_phase_b) and `result`. SERVING_VERIFIED completes only the
load child and yields Phase B's alignment input; it MUST NOT release the outer
exclusive window. The same original outer actor keeps that window continuously
through Phase B's fresh admission and observed terminal result. Phase B revalidates
actual same-generation runtime/DB pins within five seconds; the serving receipt
alone is not that fresh witness. On a proven Phase B success or proven failure
with no unresolved transaction, the outer actor records the actual window end;
on UNKNOWN it preserves the logical exclusion/fence until original-lane
reconciliation establishes a terminal state, with no replacement writer. If the
actor cannot maintain exclusion, it uses the existing stop path and records the
interruption, never claims a continuous window. The closed window-end record is
schema_version1, window_id, operation_id, parent_digest, phase_b, ended_at,
result (completed/stopped), actor_ref and holder_start_nonce. `phase_b` is exactly
`{state:"not_started"}` when stopped before its admission, or exactly
`{state:"terminal", operation_id, terminal_receipt_digest}` after a proven terminal
Phase B result; an unresolved transaction has neither terminal form. No fabricated
Phase B id, null receipt or future timestamp is allowed. Completed requires a
proven successful terminal Phase B; stopped requires proven no-listener plus
not-started or reconciled terminal Phase B. It is written only by the original outer actor after those
conditions, never predicted in serving.json. Health is corroboration only.

Failure/timeout/EOF/expiry/process change before import terminates the candidate
without serving. Failure or uncertain outcome after import immediately invokes
the original actor's stop path and records UNKNOWN until actual exit/no-listener
is verified. Durable `failure.json` and the existing claimed child remain; neither
restart nor a new nonce is allowed. A parent/supervisor crash is not silent success:
the serving child continuously monitors its private control FD, including after
RESUME; EOF/error closes the process and its listener without replacement. The
original actor must observe actual exit/no-listener before claiming stopped;
missing terminal receipt plus the durable claim fences the operation and requires
original-lane read-only reconciliation; no second writer is spawned. No promise of
availability is made while stopped. A committed SERVICE@2 DB row cannot be paired
with old Agent 1.13 source for automatic restore. The separately mandated Supply
V2 disabled@3 compensation, if needed, does not itself authorize any service start.

After successful serving, crash/OS reboot leaves this controlled generation
stopped; no later automatic restart is authorized. A later start is a new bounded
load operation with a fresh valid delegation/mandate and pre-listen proof. This
deliberately trades automatic availability for a small verifiable pilot closure;
it does not require another Human interaction for phases still lawfully derivable
inside the original active delegation. Expiry after successful resume does not
retroactively stop ordinary serving, but cannot authorize another effect.

### CTR-MCR-010 — Receipt limits, failure state and stop boundary

Receipts expose only safe pins, account/process identity, exact public registry/DB
projections, enum outcomes and timestamps. Tokens, keys, DB URLs, passwords, raw
credential files and unredacted environment are forbidden. Secret-bearing private
preimage remains with the original release actor, never in review artifacts.
Failure codes distinguish `NOT_STARTED`, `STOPPED_PENDING_LOAD`,
`LOAD_REFUSED`, `LOAD_FAILED_STOPPED`, `RESUME_OUTCOME_UNKNOWN`, `SERVING_VERIFIED`
and `STOPPED_AFTER_CRASH`; UNKNOWN is not PASS or retry authority. Every terminal
receipt binds performed and not-performed effects, including window interruption
and temporary result-read unavailability.

DONE_WHEN for implementation is the exact three-file implementation independently
conformant with the matrix below. DONE_WHEN for a later authorized operation is
one verified serving generation and independent alignment receipt, or an honest
stopped/fenced terminal state requiring its original lane to decide recovery.
There is no further website/consumer/global infrastructure expansion. Additional
source, changed preimage, new permission/reader obligation, missing OS primitive,
or inability to keep same-process/cache/FD/window guarantees triggers re-PREFLIGHT.

## 10. Acceptance

All tests below are future isolated conformance obligations, not executed results.
Each evidence record binds accepted authority revisions, exact source/tree and
artifact/toolchain, evaluator identity, environment/time, command/exit and safe
receipts. The independent reviewer can inspect or reproduce them without production
credentials. A fixture never counts as production execution.

| ID | Contracts | Method and environment | Required evidence | Expected result / failure condition |
|---|---|---|---|---|
| ACC-MCR-001 | 001,002 | Exact Git diff, clean isolated full build and wrapper build with locked dependencies/synthetic env; independent composition/overlay review | Exact three-file delta, all separate authorities, compiler commands/exits, complete manifest and overlay source mapping | Both builds succeed without suppression; same dist graph; reject extra files, omitted overlays, old-dist copying, absent source provenance or old17/139 claimed new-composition proof. |
| ACC-MCR-002 | 003,004,006 | Disposable process/FD/custody harness; Supply V2 authenticated-parent fixtures and real isolated derivation integration | Parent-child lineage, nonce/claim trace, mode/owner/inode controls, frames and negative results without credentials | One derived candidate-load child within 60min parent/10min child; no repeated Human prompt for lawful derivation. Reject spoofed JSON/root authority, expiry, wrong phase/actor, changed plan, second load claim, wrong FD/process, duplicate keys, oversize/truncated frame, symlink/hardlink/path injection or unknown old outcome. |
| ACC-MCR-003 | 005,009,010 | Isolated original-service simulator with actual child/listener/drain observations and fault injection; no production launchctl | Stop/drain/window/preimage records and ordered trace through migration fixture, load, verify, resume | No migration before stopped/drained custody; no resume before full verification. The same outer window remains held through Phase B terminal state; SERVING_VERIFIED alone never releases it; not_started and terminal window-end forms are distinguished. Reject competing writer, stale witness, missing drain, old PID assumption and stale plan. Failure/UNKNOWN stops and fences with no IDR trap/automatic retry. |
| ACC-MCR-004 | 006,007 | Real compiled wrapper and compiled server/import graph in isolated child, synthetic config/keys, disposable DB only when needed | PID/start/module URL/uid/cwd/cache identities, actual listener timeline and import-side-effect trace | LOADED is same future serving process/cache in actual v1 mode; no listen/write/token before RESUME. Reject v0/v1_shadow, src/dist duplicate module, query URL, symlink/module replacement, cache mutation, environment change, re-exec or cached-ready-file replay. |
| ACC-MCR-005 | 005,006,008 | Full old/candidate registry fixture plus consistent disposable PostgreSQL read-only snapshot and migration-audit fixture | Complete per-entry diff, exact query ID set and projections, transaction identity, valid/invalid five-second final witnesses | Preserve all unrelated entries; exact SERVICE@2 and migration audit required. Reject hidden thirteenth-entry drift, dropped/added entry, one-field/ordered-array mismatch, duplicate/missing row, failed query treated absence, old@1/disabled@3, wrong audit/nonce/version, out-of-scope query, DB write attempt, stale/changed rows or window loss. |
| ACC-MCR-006 | 004,006,009,010 | Isolated crash/reboot/supervisor loss/EOF and resume delivery fault cases including kill at every claim/import boundary | Durable claims/fences, original actor reconciliation, same-generation listener/exit observations and one-shot descriptor | At most one initial server generation and one resume; no KeepAlive/RunAtLoad restart even after success. Kill the outer privileged actor before handoff, inject partial window-end writes and deny post-drop directory writes: no false handoff, terminal-file privilege violation or surviving unobserved serving child is permitted. Unknown resume never resends. Reject automatic rollback/bootstrap, old Agent source restored against SERVICE@2, retained listener called stopped, or failure/fence erased by new nonce. |
| ACC-MCR-007 | 002,008,009,010 | Independent final source/artifact/receipt/reader-disposition review; later live evidence only under exact separately authorized original operation | Closure matrix, safe evidence access, complete release plan/runbook, exact stage receipts with environment labels and original writer identity | Verify protected service.env reaches only the measured internal service environment, caller overrides/artifact dotenv are rejected, and private config/key bindings disclose neither secret content nor content hashes. Conformance and later operation claims remain separate; no secret exposure, second writer, new platform, scope expansion or implementation-main-only gate. Health/disk/fixture/count cannot replace loaded/full DB proof. Missing live evidence remains NOT_RUN. |

Reverse coverage:

ACC-MCR-006 also MUST demonstrate the actual three-role process topology and
privilege transition in an authorized disposable OS environment: launchd cannot
silently substitute an inherited outer FD; verify finishes before resume; root
startup never accepts an unproven parent; serve is authsvc throughout; supervisor
cannot regain privilege after drop; only the fixed append journal and read-only
window-end custody FDs survive, with no directory handle;
drop/group/uid/gid failure, killed supervisor at claim/drop/send boundaries and
same-operation explicit kickstart all leave no authorized replacement/resume.
Unavailable OS privilege-transition proof leaves this gate NOT_RUN, not simulated
PASS. Pure fixtures cover classification only and do not close the OS gate.

| Contract | Acceptance |
|---|---|
| CTR-MCR-001 | ACC-MCR-001 |
| CTR-MCR-002 | ACC-MCR-001,007 |
| CTR-MCR-003 | ACC-MCR-002 |
| CTR-MCR-004 | ACC-MCR-002,006 |
| CTR-MCR-005 | ACC-MCR-003,005 |
| CTR-MCR-006 | ACC-MCR-002,004,005,006 |
| CTR-MCR-007 | ACC-MCR-004 |
| CTR-MCR-008 | ACC-MCR-005,007 |
| CTR-MCR-009 | ACC-MCR-003,006,007 |
| CTR-MCR-010 | ACC-MCR-003,006,007 |

## 11. Alternatives

Rejected: health-after-bootstrap as pre-resume verification; root-owned JSON as
Human proof; separate source-mode loader then different serving process; broad DB
census; auto-rollback/restart; new approval daemon; silently widening old MCP source
closure; requiring implementation merge into main without owning authority.

## 12. Migration, compatibility and lifecycle

Historical IDR scripts/receipts and old audit rows remain readable. The executable
IDR rollback route is excluded from this operation; no historical records are
deleted. Other distinct operational services and non-MCP authorities are RETAINED.
This Spec makes no global retirement or full production-effectiveness claim.

Acceptance changes this Spec's lifecycle only through qualified exact-head Owner
acceptance and main merge. The Supply V1/V2 atomic lifecycle transition belongs to
that successor's acceptance transaction. This file remains proposed in the present
docs-only Draft candidate. Runbook/install descriptors carry measured operation
parameters within the frozen schemas, not new Product Authority.

## 13. Open questions and review boundary

```text
OPEN_OWNER_DECISIONS = exact-head acceptance of proposed decisions only
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 10
CONTRACTS_WITH_ACCEPTANCE = 10
AUTHORING_READY_FOR_REVIEW = YES
IMPLEMENTATION_STATE = NOT_STARTED
VERIFICATION_STATE = NOT_RUN
PRODUCTION_READINESS = NOT_ESTABLISHED
NEXT_ACTION = REVIEW
```
