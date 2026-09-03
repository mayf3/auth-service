---
spec_id: AUTH_SERVICE_AGENT_SESSION_MESSAGING_TEMP_GRANT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-03
scope: [mayf3/auth-service, temporary canary Grant for agent_session_send A2A E2E only]
governed_by: [MINIMAL_AUTH_FOUNDATION_V2, AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1]
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_AGENT_SESSION_MESSAGING_TEMP_GRANT_V1

> **PROPOSED / NOT ACCEPTED.** 本文件只提出 ONE named source Agent 的 TEMPORARY
> canary Grant Authority（docs-only；apply/verify/revoke 为 separately executed
> operator steps）。Owner 接受 exact head 前无任何效力。

## 1. Frozen grant tuple (single row, single client)

```text
GRANT_CREATED_FOR_CANARY = TEMPORARY
TERMINAL_COMPENSATION    = REQUIRED (revoke -> readback absent -> audit trail)
SOURCE_PRINCIPAL         = b21ddb23-42f6-47c4-a27f-bc44950e554c (agent_id agt_efficiency-agent, active)
SOURCE_CLIENT            = mc_cF81DF-XND9Zmzao4F08rOK_ (machine_clients.id uuid 695d1eeb-3547-4cbd-a72b-915f4ebf25a4, active, sole client of SOURCE_PRINCIPAL, machine_access_enabled V1 grants: svc-workflow v2{workflow.read,workflow.execute} + svc-forum v1{forum.read,forum.write}; legacy allowed_resources/allowed_scopes = {} (unused under AUTH_CONTRACT_MODE=v1))
AUDIENCE                 = agent-session-messaging (auth_audiences row, deployed 1.6.0)
GRANT_SCOPES             = {agent.session.send}
GRANT_VERSION            = 1
FLEET_MIGRATION          = NOT APPLIED (206 pre-existing fleet issues stay untouched)
TARGET                   = blog-agent / agt_blog-agent — MUST NOT be granted (verify absent pre+post)
```

> **§1.1 Source-client correction (independent review NEW_EVIDENCE, 2026-09-03).**
> 首版曾冻结 `mc_fJmDtp5KXDbSag1nf9DA-UQd`（与 census 行交叉配对）。生产 DB 只读核查：
> 该 client 属于 legacy principal `95eab282`（efficiency-manager，2026-07-19 建），并非
> SOURCE_PRINCIPAL `b21ddb23`（agt_efficiency-agent）——b21ddb23 的唯一 client 是
> `mc_cF81DF-XND9Zmzao4F08rOK_`。live broker 证明：Lane A workflow_execute E2E instance
> `dbf46d4c-26bd-410a-b8fa-441758ec0658`（2026-09-03 07:43:21+08，
> svc-workflow DB workflow_instances.created_by_principal_id = b21ddb23）在生产 runtime
> session `/Users/authsvc/.agent-core/homes/agt_efficiency-agent/sessions/...` 下经
> 凭据 store 解析成功调用——即生产 credential store 对 agt_efficiency-agent 呈现的正是
> mc_cF81DF。Grant 若落在 mc_fJmDtp，canary 将 fail-closed（machine_grant_missing）。
> 本修正只换 client，principal/audience/scope/version/temporary 语义不变。

## 2. Apply (one production mutation, after accepted authority + Owner native gate)

Vehicle = deployment-artifacts 工具脚本（snapshot prisma client + .env，root 运行）：
single serializable transaction:
1. STOP if a live (revoked_at IS NULL) row already exists for
   (mc_cF81DF-XND9Zmzao4F08rOK_, agent-session-messaging) — one-shot guard；
2. INSERT machine_access_grants(machine_client_id=<SOURCE_CLIENT uuid 695d1eeb-3547-4cbd-a72b-915f4ebf25a4, audience_id='agent-session-messaging',
   scopes='{agent.session.send}', version=1)；
3. INSERT auth_security_audits(event_type='grant.temporary_created', result='success',
   request_correlation_id=<migration_id>, details={grant tuple, terminal_action='REVOKE',
   canary='A2A-CANARY', operator, approval_ref})。
Readback: row live with exact scopes；target agents hold ZERO agent-session-messaging rows。

## 3. Terminal compensation (REQUIRED, after canary)

同一脚本家族 `--revoke`：UPDATE ... SET revoked_at=now() WHERE <tuple> AND revoked_at IS NULL
（单行）+ auth_security_audits('grant.temporary_revoked')；readback：live rows for
(mc_cF81DF-XND9Zmzao4F08rOK_, agent-session-messaging) == 0；blog-agent/agt_blog-agent 仍 0。
不得 DELETE 历史（保留审计）；revoked 行永久留痕。

## 4. Verification proofs

- POSITIVE (Phase C, post-grant): machine token request (grant_type=client_credentials,
  resource=agent-session-messaging, scope=agent.session.send, SOURCE_CLIENT credentials)
  issues access_token with scope/sub/aud exact — ONE positive proof, claims digest recorded, token NOT persisted.
- NEGATIVE (fail-closed family): wrong scope/alias/wildcard → no token; target-agent client → no token.

## 5. Prohibitions

不得 grant 任何其他 client/principal/audience/scope；不得 fleet 迁移；不得修改
allowed_resources/allowed_scopes；不得删除/修改既有 grants；不得碰 credentials/secrets。

## 6. Acceptance scheme

proposed → ONE independent audit → Owner exact-head acceptance → lifecycle（status/
implementation_authority=contracts/production_apply_authority 保持 none——apply 仍需 Owner
native gate + 本 Spec 冻结的 apply 脚本 Gate）→ FINAL_HEAD_RECHECK → merge。
