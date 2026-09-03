---
spec_id: AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-04
scope: [mayf3/auth-service, permanent operational agent.session.send Grant for the frozen daily A2A orchestrator]
governed_by: [MINIMAL_AUTH_FOUNDATION_V2, AUTH_SERVICE_AGENT_SESSION_MESSAGING_AUDIENCE_CCR_V1, AUTH_SERVICE_AGENT_SESSION_MESSAGING_TEMP_GRANT_V1]
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1

> **PROPOSED / NOT ACCEPTED.** 本文件提出把 A2A 日常运营发送权从 TEMPORARY canary Grant
> 转为 PERMANENT operational Grant 的最小 Authority（docs-only；apply 为 separately
> executed operator step）。Owner 接受 exact head 前无任何效力。

## 0. Authorization basis (whole-successor of the temporary grant, per its own §6/CTR-DEP-006)

Accepted `AUTH_SERVICE_AGENT_SESSION_MESSAGING_TEMP_GRANT_V1`（auth PR #46 @ `d759265f`，
merged `8c7fb01`；§3 经 PR #47 `ff9e1be` amended）明确规定：temporary grant 在 canary 完成
或 D/E 失败时必须 terminal revoke，且 "retention requires a later separate accepted
activation authority naming the principal and purpose"。本 Spec 即该 separate accepted
activation authority：同一 frozen identity tuple 的 PERMANENT 化，purpose = 日常 A2A
orchestration（Cross-Agent Scheduler 触发的 Agent 间任务交接与 `agent_session_send`
日常使用）。Accepted `AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1` CTR-DEP-006 的
"separately accepted Grant-supply authority + Owner gate" 由本 Spec 的 acceptance 满足。

## 1. Frozen grant tuple (single row, single client — identical identity to the canary)

```text
GRANT_KIND               = PERMANENT_OPERATIONAL (no revoke requirement; tombstone machinery
                           remains available but is NOT part of this authority's plan)
SOURCE_PRINCIPAL         = b21ddb23-42f6-47c4-a27f-bc44950e554c (agent_id agt_efficiency-agent)
SOURCE_CLIENT            = mc_cF81DF-XND9Zmzao4F08rOK_ (machine_clients.id uuid
                           695d1eeb-3547-4cbd-a72b-915f4ebf25a4, active, sole client of
                           SOURCE_PRINCIPAL — mechanically unique orchestrator identity per
                           the daily-autonomy goal's frozen A2A source; NO Owner selection
                           was required)
AUDIENCE                 = agent-session-messaging
GRANT_SCOPES             = {agent.session.send}
GRANT_VERSION            = 1
TARGET                   = blog-agent / agt_blog-agent — MUST NOT be granted (verify absent
                           pre+post; targets act with their own identities via their own
                           grants/credentials when they send)
FLEET_MIGRATION          = NOT APPLIED
```

Identity rationale（机械唯一性）：daily-autonomy goal 冻结的 A2A source = `agt_efficiency-agent`；
该 principal 的活跃 machine client 恰一个（生产 DB 已核）；Lane A E2E 与 canary 均经生产
credential store 以 mc_cF81DF 呈现。无第二合法候选，故按 goal 规则不请求 Owner 选择。

## 2. Apply (one production mutation, after accepted authority + Owner native gate)

Vehicle = `agent-session-messaging-temp-grant-v1` 制品同族工具的 `--apply-operational`
模式（snapshot prisma client + .env，root 运行），single serializable transaction：
1. STOP if a live row already exists for (SOURCE_CLIENT uuid, agent-session-messaging)
   —— one-shot guard（含 TEMP_GRANT canary 行未 revoke 的情形：必须先完成 canary 终偿）；
2. INSERT machine_access_grants(machine_client_id=<uuid>, audience_id='agent-session-messaging',
   scopes='{agent.session.send}', version=1)；
3. INSERT auth_security_audits(event_type='grant.operational_created', result='success',
   request_correlation_id=<migration_id>, details={tuple, kind='PERMANENT_OPERATIONAL',
   purpose='daily A2A orchestration', operator, approval_ref})。
Readback: row live with exact scopes/version；target agents hold ZERO
agent-session-messaging rows；audience 总行数 +1。

## 3. Persistence semantics

无 terminal revoke 计划；本 Authority 不授权任何 revoke。若未来需要撤销/轮换，属新的
separately accepted Authority。现有 tombstone 机制（PR #47 amendment：raw-SQL
revoked_at+version=0，部署版 assertGrantState version<1 立即强制）保持可用作为安全网。
durable 代码修复（revokedAt prisma 映射 + 查询过滤）= FOLLOW_UP_DEBT 随下次 auth 快照。

## 4. Verification proofs

- POSITIVE（post-grant）：与 TEMP_GRANT 制品同款 machine token request
  （client_credentials, resource=agent-session-messaging, scope=agent.session.send,
  SOURCE_CLIENT Basic credentials）→ 200 + claims（aud/scope/sub/principal_type/version）
  精确断言 + claims digest 记录；token 不落盘。
- NEGATIVE：wrong scope/alias/wildcard → no token；target-agent client → no token（同族）。
- E2E 关联：permanent grant 生效后，A2A 路径与后续 Cross-Agent Scheduler 触发的
  agent_session_send 无需任何 further Grant 变更即持续可用（A2A_OPERATIONAL_GRANT=ACTIVE）。

## 5. Prohibitions

不得 grant 任何其他 client/principal/audience/scope；不得 fleet 迁移；不得修改
allowed_resources/allowed_scopes；不得删除/修改既有 grants；不得碰 credentials/secrets；
不得借此扩大 agent_session_send 的 capability 语义（部署面由
AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1 冻结）。

## 6. Acceptance scheme

proposed → ONE independent audit → Owner exact-head acceptance → lifecycle（status/
implementation_authority=contracts/production_apply_authority 保持 none——apply 仍需
Owner native gate）→ FINAL_HEAD_RECHECK → merge → apply 轮（Owner native，可与后续
decision packet 合并呈现）。
