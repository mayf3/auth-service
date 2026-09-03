# AUTH BUNDLE 1.6.0 — INDEPENDENT POST-DEPLOYMENT AUDIT

- **AUDIT_ID**: AUTH_BUNDLE_1_6_0_DEPLOY_AUDIT
- **AUDIT_UUID**: 4B04F72B-0C22-448B-AF3E-AE8D74DF7D7B
- **AUDIT_TIME (UTC)**: 2026-09-03T14:16:21Z (local 2026-09-03 22:16 +08)
- **AUDITOR**: independent post-deployment auditor (no role in the deploy execution)
- **SCOPE**: verification only — NO production writes, NO sudo, NO service restarts, NO Grant changes; DB access metadata-only (SELECT) as role `auth_ro`.
- **SUBJECT**: auth-service production deployment 1.3.0 → 1.6.0, serial production transaction #1, Owner-executed, transcript `DEPLOY_TRANSCRIPT.txt` ending `DEPLOYMENT_OK`.
- **EVIDENCE SOURCES (read-only)**: `/Users/yanfenma/workspace/deployment-artifacts/auth-service-bundle-1-6-0-deploy/` (DEPLOY_TRANSCRIPT.txt, ARTIFACT_MANIFEST.json, com.auth-service.plist.preimage, plist.candidate, BACKFILL_PLAN.raw/json, BACKFILL_APPLY.raw/err, AUTHSVC_SMOKE.log, BOOT_SMOKE.log); live system (health endpoint, ps, launchd metadata, plutil); production DB `agent_dev_center` as `auth_ro`; runtime snapshot `/Users/yanfenma/workspace/project/production-auth-service-4d383ee02d298eebeb15470a5328b7345ed140e9/`.
- **AUDIT BRANCH**: `docs/auth-bundle-1-6-0-deploy-audit` off `github/main` = `57258ec` (post-4d383ee with scheduler CCR impl 57258ec merged; deploy snapshot itself is 4d383ee). Evidence written ONLY into `docs/audits/AUTH_BUNDLE_1_6_0_DEPLOY/`.

---

## VERDICT PER CHECK

### CHECK 1 — Live service: **PASS**
- `curl http://127.0.0.1:4001/api/health` → `ok=true`, `authContractVersion=1.6.0`, `authContractDigest=ab2d81a7f276f0a0fa5d3c5b470c999b1f7d580876c46b49f8d32da927d03dae` — exact match to the expected deploy RUNTIME_DIGEST; `authContractMode=v1`.
- `ps`: pid **60318** user `authsvc` running `/usr/local/bin/node /Users/yanfenma/workspace/project/production-auth-service-4d383ee02d298eebeb15470a5328b7345ed140e9/dist/src/server.js` — the NEW snapshot path (4d383ee), NOT the old 3b2ae71c path.
- pid matches transcript line `new pid=60318 (old=45179)`; transcript health poll 1 reported `authContractVersion=1.6.0` (one poll).

### CHECK 2 — DB state: **PASS**
Production DB = `agent_dev_center` (local PostgreSQL 16.14; the `svc_auth` database is empty — the auth tables live in `agent_dev_center`). All queries metadata-only as `auth_ro`.

- `auth_audiences` = **exactly 7 rows**:
  - 5 pre-existing (pre-state confirmed: `created_at < 2026-09-03` count = 5): `adc-v2`, `svc-okr`, `svc-workflow`, `svc-auth`, `svc-forum` — created 2026-07-19…2026-08-01, `updated_at` all ≤ 2026-08-04 (untouched by the deploy).
  - 2 new rows created at deploy: `agent-core-notification-ingress-v1` (`created_at=2026-09-03 14:02:40.614`) and `agent-session-messaging` (`created_at=2026-09-03 14:02:40.637`) — both `version=1, status=active, freeze_ready=true`.
- `agent-session-messaging` matches the **CTR-ASM-001 frozen entry** field-by-field: `audience_id=resource_service=agent-session-messaging`, `scope_namespace=agent`, `accepted_principal_types=[agent]`, `human_access_enabled=false`, `machine_access_enabled=true`, `delegated_access_enabled=false`, `registered_scopes=[agent.session.send]`, `status=active`, `freeze_ready=true`. (The DB table has no `notes` column by schema; `notes` is registry-only text and is verified in CHECK 3 against the CCR-verbatim registry entry.)
- `auth_security_audits`: **exactly 2 `audience.registered` rows** under the deploy correlation — `request_correlation_id = migration_id = auth-bundle-1-6-0-agent-session-messaging-20260903T140240Z` (one per row: `…-agent-core-notification-ingress-v1` / `…-agent-session-messaging` payload), `result=success`, timestamps `14:02:40.629` / `14:02:40.638`, `operator_id=mayf3`, `source_git_commit=4d383ee02d298eebeb15470a5328b7345ed140e9`, `approval_ref=CORE_RUNTIME_FINAL_INTEGRATION_AND_SHIP_V1/LaneB/auth-deploy-gate-passed`. Whole-table count of `audience.registered` = 2; total audit rows in the deploy window 14:00–14:10Z = 2 (no other audit-trail writes in the window).
- `machine_access_grants`: **573 rows total, `max(created_at)=2026-09-02 18:31:19.152`** — strictly before the deploy (2026-09-03 14:02Z) ⇒ **0 grant rows created by the deploy** (matches transcript `0 grant rows` / manifest `machine_grant_creates=0`; pre-deploy absolute count not separately recorded, the max-created-at bound is the determinable invariant).
- `machine_clients`: 318 rows, `max(created_at)=2026-08-23 11:18:18.675` ⇒ no client changes. `machine_principals`: 214 rows.

### CHECK 3 — Registry ↔ DB consistency (findV1AudienceMismatch-equivalent): **PASS**
- Snapshot `generated/minimal-auth-v1/runtime-contract.json` sha256 = `250dc5535b9c592796292fb63b57e200209427f81d7cc70951f541695e571ba4` = `ARTIFACT_MANIFEST.json.snapshot.runtime_contract_sha256` (bundle identity confirmed).
- `payload.audienceRegistry`: `registry_version=1.6.0`, **7 audiences**. Mechanical field comparison DB vs registry over all 9 structural fields (`resource_service`, `scope_namespace`, `accepted_principal_types`, `human_access_enabled`, `machine_access_enabled`, `delegated_access_enabled`, `registered_scopes`, `status`, `freeze_ready`) × 7 audiences: **MISMATCH_COUNT=0**, audience-id sets equal ⇒ **EXACT** (the runtime requires DB==registry; requirement met).
- Registry `agent-session-messaging` entry is CTR-ASM-001 verbatim incl. `notes` ("Registered by AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1; machine-only agent access for the canonical agent_session_send resource consumed by dsh-agent-core AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1.").

### CHECK 4 — plist: **PASS**
- Live `/Library/LaunchDaemons/com.auth-service.plist` sha256 = `85dda5009f492ab2e958f578d7ebab263a656243186027921a22d12269d84d75` = artifact `plist.candidate` sha256 (byte-identical). `plutil -lint` → OK.
- Both path references in the live plist point to the NEW snapshot: `ProgramArguments[1] = …/production-auth-service-4d383ee02d298eebeb15470a5328b7345ed140e9/dist/src/server.js` and `WorkingDirectory = …/production-auth-service-4d383ee02d298eebeb15470a5328b7345ed140e9`.
- Artifact `com.auth-service.plist.preimage` sha256 = `e2b76a0a63d30ecedb56a0cad2b640e9e424ecc6734d9de3f11499afcafd5dc9` — matches the manifest-claimed preimage hash (`e2b76a0a…`); preimage preserved. `diff preimage vs live` = exactly 2 changed lines (the two 3b2ae71c → 4d383ee path refs); everything else (user authsvc, group authsvc, KeepAlive, RunAtLoad, logs, ThrottleInterval, env) byte-identical.

### CHECK 5 — Phase A negative proofs: **PASS**
- Transcript contains **exactly 5 `NEG-OK` lines**: `invalid_client` ×4 (exact-audience+exact-scope-no-Grant; alias `agent.session.read`; wildcard `agent.session.*`; namespace mismatch `session.send`) and `invalid_target` ×1 (unknown resource `agent-session-send`) — all fail-closed.
- `grep -ci access_token` over the transcript = **0** ⇒ zero tokens issued in the round; zero positive issuance of `agent-session-messaging`.

### CHECK 6 — Old snapshot 3b2ae71c untouched: **PASS**
- Directory `/Users/yanfenma/workspace/project/production-auth-service-3b2ae71c` still present (dir mtime Aug 22 09:46).
- `find … -newermt 2026-09-02` over the whole tree (excluding `.git`) = **0 files** — nothing modified on deploy day.
- Spot checks: `dist/src/server.js` sha256 `fb725c369b93bf73cd6ee08fa360ba0338f33ac8ae40556b4416c4eb6ca1675f` (mtime Aug 22 20:34:32); `generated/minimal-auth-v1/runtime-contract.json` sha256 `10e60e062f6d555abf7b055d44f5ba7089fcf90997c726644df7412542951fd9` (mtime Aug 22 20:34:31) — rollback path intact.

### CHECK 7 — No unrelated mutations: **PASS**
- agent-core live app tree `/usr/local/libexec/agent-core/app`: `packages/broker/src/capabilities/workflow.js` sha256 = `7e4c6fa9b6f455506812f774565abcda2b394857a908c1f8cc1f36bc69c67aee` (expected `7e4c6fa9…` ✓); `packages/broker/src/registry.js` git-blob sha1 = `db7688fe1cc428aa1260e1372920ff744a076013` (expected `db7688fe…` ✓; sha256 `628abde2069028c832eb76699ad2dd8521528288f396680d39dffb353d985382`). Both mtimes 2026-09-03 07:24:21 local — the earlier agent-core activation round, well before this deploy (22:02 local / 14:02Z); content hashes prove the auth deploy round did not touch them.
- launchd labels unchanged: `ai.agent-core.runtime.plist` mtime Sep 1 06:13, `ai.agent-core.scheduler-v2.plist` Aug 26, `com.svc-workflow.plist` Jul 28 22:38, `com.svc-workflow-monitor.plist` Jul 28, `com.openclaw.*` Aug 8. `find` across `/Library/LaunchDaemons`, `/Library/LaunchAgents`, `~/Library/LaunchAgents` for plists modified today = **only `/Library/LaunchDaemons/com.auth-service.plist`** (the deploy itself).
- launchd runtime state: `com.svc-workflow` pid 58020 (up since Wed 18:0x, before the deploy), `ai.agent-core.scheduler-v2` pid 1696 — both running, labels unchanged.
- svc-workflow health: `GET http://127.0.0.1:8989/healthz` → `{"status":"ok"}` — unchanged/healthy.
- Note (out of production scope): the dev checkout `/Users/yanfenma/workspace/project/dsh-agent-core` carries pre-existing broker WIP (workflow.js/registry.js working-tree modifications, mtime Aug 31, explicitly documented as left-as-is in the HEAD commit `025eefc` message). Not production, untouched today.

### CHECK 8 — SOURCE_CANDIDATE_CENSUS (read-only): **RECORDED**
Totals: 318 machine_clients, 214 machine_principals, 573 machine_access_grants, 7 audiences.

**97 distinct active agent_ids** hold an **active** machine client whose `allowed_resources` includes `svc-workflow`. Top 10 (by client creation):

| client_id | client_status | allowed_resources | allowed_scopes | principal_id | agent_id | principal_status |
|---|---|---|---|---|---|---|
| mc_VcpAPPOq5W5_Mt2JDLq5J3aI | active | {svc-workflow} | {workflow.read} | 9f31e0a9-e831-49d5-9541-aaa8a3c0ff1c | workflow-todo-canary | active |
| mc_ONPeJPOXRF_t33rb4_uYbUr1 | active | {svc-workflow} | {workflow.read} | 397ba78e-fd54-4336-bfca-c990bc5239a6 | test-workflow-agent | active |
| mc_dPqkMw6q9yVtHXOFTi5sqmsQ | active | {svc-workflow} | {workflow.admin,workflow.read} | 858b5fe2-7a81-43ba-9049-c33e7dc8349a | svc-dogfood-user | active |
| mc_10nlNsdVSirFpEbLHq-xqoVb | active | {svc-workflow} | {workflow.admin,workflow.read} | 858b5fe2-7a81-43ba-9049-c33e7dc8349a | svc-dogfood-user | active |
| mc_pvv0AsW5MZbN37BZ7J0M-iFH | active | {svc-workflow} | {workflow.admin,workflow.read} | 858b5fe2-7a81-43ba-9049-c33e7dc8349a | svc-dogfood-user | active |
| mc_pyWPMzkM7uxAeY8eKIyF0A7P | active | {svc-workflow} | {workflow.execute,workflow.read} | 01bba696-8474-4337-b598-e13155f3d4a3 | canary-e2e-cf1adf8f-svc-workflow-canary | active |
| mc_tlzGjaL5lWV_csMiXKuZHTPW | active | {svc-workflow} | {workflow.read} | 026302b6-18ac-45cb-b208-f0a2b42836c7 | svc-okr-aud-test | active |
| mc_e2e-agent-a-2ba1d667b5368057 | active | {svc-workflow} | {workflow.read,workflow.execute} | 9a0b17f9-573f-4b0a-8421-a527bb0f87c1 | agent-a-e2e | active |
| mc_e2e-agent-b-a1893cf7a4a0e9ca | active | {svc-workflow} | {workflow.read,workflow.execute} | c30d17db-e0ad-432a-9423-e823feb170eb | agent-b-e2e | active |
| mc_fJmDtp5KXDbSag1nf9DA-UQd | active | {svc-workflow} | {workflow.read,workflow.execute} | 95eab282-22c7-46a2-8580-abfef4942cdc | efficiency-manager | active |

Production agents observed among the 97 (non-test, current fleet members with machine clients — candidates for the disposable A2A source agent role): `cto-agent`, `ceo-agent`, `hr-agent`, `efficiency-manager`, `blog-agent`, `gzh-agent`, `daily-thought-agent`, `content-ops-agent`, `article-publisher-agent`, `finance-agent`, `product-manager`, `research-agent`, `translator-agent`, `podcast-producer(-agent)`, `stock-agent`, `qa-reviewer(-2)`, `security-agent`, `itops-agent`, and others (full 97-id list query recorded in audit session; test/e2e/canary/dogfood ids excluded when nominating candidates).

**blog-agent principals**:
- `81c7fc7e-c696-4b47-bfd6-f12a9ecb68a6` = `blog-agent` (博客写作, principal_type=agent, **active**). 6 machine clients: 2 revoked (`mc_Y2f-m0vXdLJQVHa0RVJmhaSO`, `mc_gPr8gxNPU_bhlxcXwewm2Iwu`, svc-forum) + 4 active:
  - `mc_u1CKMiNFscAvKk_Z_tjd96L6` active — resources {svc-workflow, adc-v2}; grants: svc-workflow {workflow.read, workflow.execute} (2026-07-20), adc-v2 {adc.read} (2026-07-20).
  - `mc_QeFhB53qsUQnqC0OFMEeTdGC` active — resources {svc-forum}; grants: svc-forum {forum.read, forum.write} (2026-08-01), svc-workflow {workflow.execute} (2026-09-02 18:31:19 — the newest grant row in the DB).
  - `mc_L6q7P3rgm6C7kgLP-KXJBTmh` active — resources {svc-forum}; grants: svc-okr {okr.read} (2026-07-23), svc-workflow {workflow.read, workflow.execute} (2026-07-23), svc-forum {forum.read, forum.write} (2026-08-02).
- `fd58881a-fdba-4ef2-9a80-b733671f24f1` = `agt_blog-agent` (博客写作, agent, **active**). 1 machine client `mc_sWqLVY9rPrVRdXM909b8QKyT` active with **empty allowed_resources** `{} / {}` but existing grants: svc-forum {forum.read, forum.write} + svc-workflow {workflow.read, workflow.execute} (both 2026-08-23). Census flag: that client cannot pass resource gating as configured (empty allow-list) despite live grants — noted as census observation only, no change made.

---

## FORMAL CONCLUSION

```
AUTH_DEPLOY_AUDIT = PASS
BUNDLE_1_6_0_PRODUCTION_LIVE = YES
PHASE_A_NEGATIVE_PROOFS = PASS
UNRELATED_DB_MUTATION = NONE
READY_FOR_TEMP_GRANT_AUTHORITY_ROUND = YES
```

Basis: live :4001 health is 1.6.0 with the exact deploy digest ab2d81a7… served by pid 60318 from the new 4d383ee snapshot; DB holds exactly the 2 authorized audience rows with matching migration-correlated audit trail and zero grant/client/principal churn in the window; DB↔registry consistency is EXACT (0 mismatches / 7 audiences); plist live==candidate with preimage preserved at the claimed hash; 5 fail-closed negative proofs with zero tokens; old snapshot and all unrelated surfaces (agent-core app tree, launchd labels, svc-workflow) byte/state verified untouched. The temporary Grant Authority round may proceed on a separately authorized basis; no grant was created or modified by this audit.

## EVIDENCE MANIFEST

See `MANIFEST.sha256` in this directory (sha256 over the evidence file(s) herein).
