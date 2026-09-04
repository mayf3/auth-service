---
spec_id: AUTH_SERVICE_SCHEDULER_ADMIN_OPERATIONAL_GRANT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-04
scope: [mayf3/auth-service, minimum operational scheduler.admin Grant for the Cross-Agent Scheduler production capability]
governed_by: [MINIMAL_AUTH_FOUNDATION_V2, AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1]
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
    relation: constrained_by (R8 scope semantics + CTR-AUTH-002 wire-proof seam)
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_SCHEDULER_ADMIN_OPERATIONAL_GRANT_V1

> **PROPOSED / NOT ACCEPTED.** 本文件提出 ONE named orchestration source Agent 的
> **OPERATIONAL**（非 temporary）`scheduler.admin` Grant Authority——Lane C
> Cross-Agent Scheduler 生产能力的最小授权。Owner 接受 exact head 前无任何效力。

## 1. Frozen grant tuple (single row, single client)

```text
GRANT_CREATED_FOR        = OPERATIONAL (standing capability grant; NO terminal revoke)
SOURCE_PRINCIPAL         = b21ddb23-42f6-47c4-a27f-bc44950e554c (agent_id agt_efficiency-agent, active)
SOURCE_CLIENT            = mc_cF81DF-XND9Zmzao4F08rOK_ (machine_clients.id uuid 695d1eeb-3547-4cbd-a72b-915f4ebf25a4, active, sole active client of SOURCE_PRINCIPAL)
AUDIENCE                 = scheduler (auth_audiences row deployed by Bundle 1.7.0; CCR PR #42)
GRANT_SCOPES             = {scheduler.admin}
GRANT_VERSION            = 1
FLEET_MIGRATION          = NOT APPLIED (no other agent receives any scheduler grant)
TARGET_AGENTS            = cross-target job definitions remain gated by product-side ownership checks; this grant authorizes the ORCHESTRATION CALLER only
```

Source-selection basis (mechanical, Lane B method): this exact client is the only
agent whose production credential-store presence is durably proven —
`TRANSCRIPT_apply_20260904T005519Z.txt` (Lane B temp-grant apply) printed
`PROOF_VEHICLE store agt_efficiency-agent=mc_cF81DF-XND9Zmzao4F08rOK_`, i.e. the
production runtime store resolves agt_efficiency-agent to exactly this client.
The apply vehicle re-asserts this mapping fail-closed before any INSERT.

## 2. Why this grant (minimal, no fleet)

- Per `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2` R8 + release
  `self-service.js` (CTR-AUTH-002 wire-proof seam): **self-only** scheduler
  operations need NO grant (unchanged behavior); **cross-target** job
  definition/mutation/control requires wire proof of exactly
  `(resource=scheduler, scope=scheduler.admin)`.
- Live production compose (not redeployed) already wires the assertGrant seam
  through the broker credential store + token request — so this single grant is
  the ONLY DB change needed to make the Cross-Agent Scheduler capability
  reachable in production.
- `scheduler.audit` is intentionally NOT granted (global/foreign history read is
  a separately-authorized activation; Lane D traceability readback uses
  coordinator store census, not token-gated history).

## 3. Apply (one production mutation, after accepted authority + auth 1.7.0 deployed)

Vehicle = deployment-artifacts 工具脚本（snapshot prisma client + .env，root 运行），
同一 fail-closed 家族（temp-grant-asm-v1.mjs）：
single serializable transaction:
1. STOP unless the auth health reports authContractVersion 1.7.0（audience 前置）；
2. STOP if a row already exists for
   (mc_cF81DF-XND9Zmzao4F08rOK_, scheduler)（one-shot guard）；
3. PROOF_VEHICLE: credential store `agt_efficiency-agent` → MUST equal the frozen
   SOURCE_CLIENT（fail-closed before INSERT）；
4. INSERT machine_access_grants(machine_client_id=695d1eeb-3547-4cbd-a72b-915f4ebf25a4,
   audience_id='scheduler', scopes='{scheduler.admin}', version=1)；
5. INSERT auth_security_audits(event_type='grant.operational_created', result='success',
   request_correlation_id=<migration_id>, details={grant tuple, operator, approval_ref,
   spec, purpose='Cross-Agent Scheduler orchestration caller (Lane C)'}).
Readback: row live with exact scopes；scheduler audience total rows == 1；no other
agent holds any scheduler grant.

## 4. Verification proofs

- POSITIVE (post-grant): machine token request (grant_type=client_credentials,
  resource=scheduler, scope=scheduler.admin, SOURCE_CLIENT credentials) issues
  access_token with sub=b21ddb23…/aud=scheduler/scope=scheduler.admin/
  client_id=mc_cF81DF…/agent_id=agt_efficiency-agent — claims digest recorded,
  token NOT persisted.
- NEGATIVE (fail-closed family): scheduler.audit scope → no token（未授权）；
  wrong scope scheduler.write → no token；target-agent client
  (agt_blog-agent) → no token。
- The grant is OPERATIONAL: no revoke step; compensation semantics do not apply
  （contrast TEMP_GRANT_V1 §3; if the capability is ever retired, a separate
  accepted authority governs deactivation）.

## 5. Prohibitions

不得 grant 任何其他 client/principal/audience/scope；不得 fleet 迁移；不得修改
allowed_resources/allowed_scopes；不得删除/修改既有 grants；不得碰 credentials/secrets；
不得授予 scheduler.audit（另行授权）。

## 6. Acceptance scheme

proposed → ONE independent audit → Owner exact-head acceptance → lifecycle
（status accepted / implementation_authority=contracts / production_apply_authority
保持 none——apply 仍需 Owner native gate + auth 1.7.0 前置 + 本 Spec 冻结的 apply
脚本 Gate）→ FINAL_HEAD_RECHECK → merge。
