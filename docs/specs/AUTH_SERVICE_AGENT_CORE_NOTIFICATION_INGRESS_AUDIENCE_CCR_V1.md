---
spec_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service
  - Agent Core Notification Ingress OAuth audience and scope authority
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1

## 1. Goal

建立 Notification Ingress 所需的最小 OAuth authority，冻结一个 machine-only service
Audience、一个精确 Scope，以及未来两个独立 service client 的 Grant requirement：

```text
AUDIENCE_ID = agent-core-notification-ingress-v1
RESOURCE_SERVICE = agent-core-notification-ingress-v1
SCOPE_NAMESPACE = notification
REGISTERED_SCOPES = [notification.deliver]
ACCEPTED_PRINCIPAL_TYPES = [service]
HUMAN_ACCESS_ENABLED = false
MACHINE_ACCESS_ENABLED = true
DELEGATED_ACCESS_ENABLED = false
```

`notification.deliver` 允许持有该 Grant 的 service principal 向 Agent Core Notification
Ingress 执行 `POST /v1/deliver`。产品接口语义由资源服务拥有；auth-service 只校验
Audience、Scope 与 Grant，不理解 `deliver` 的产品语义。

本轮是 **DOCS / AUTHORITY ONLY**：只创建 proposed CCR，不修改 Contract Bundle、产品代码、
数据库或生产环境，不创建 credential，不 apply Grant，不部署、不接受、不合并，也不开始
Notification implementation。

## 2. Scope and non-goals

### In scope

- 冻结唯一 Audience entry 的全部安全字段；
- 冻结唯一注册 Scope `notification.deliver`；
- 冻结 Scope 与 `POST /v1/deliver` 的资源服务语义边界；
- 冻结 svc-forum 与 svc-workflow 的未来独立 client / Grant requirement；
- 冻结 versioned migration / Contract Bundle 所需的最小 required delta；
- 冻结 Audience、Scope、Grant 严格配对及 fail-closed 规则。

### Non-goals

本 authority 不授予，也不允许从 `notification.deliver` 推导：

- auth management、identity provisioning 或 token management；
- Agent Router generic authority；
- Scheduler authority；
- Forum、Workflow 或其他业务 authority；
- delegation / OBO authority；
- Human access；
- wildcard、prefix match 或通用 `notification.*` Grant。

本轮不修改 immutable accepted authority normative body，不修改 executable registry，不执行
migration，不写 production database，不创建 principal/client/secret，不写任何 production Grant。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = 7cd4b60c31407648f5288ff5d5a5570e4449fadb
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2 (accepted)
HISTORICAL_EXACTLY_INCORPORATED_GRAMMAR =
  docs/contracts/minimal-auth-v1/grants-and-audiences.md
  docs/contracts/minimal-auth-v1/claims-and-profiles.md
  docs/contracts/minimal-auth-v1/v0-to-v1-migration.md
PATTERN_AUTHORITY = AUTH_SERVICE_SVC_FORUM_AUDIENCE_CCR_V1 (accepted)
```

本 Spec 是新的 bounded child CCR，不 amend 或 supersede `MINIMAL_AUTH_FOUNDATION_V2`，也不
改写任何 accepted stable ID。V2 已 exact-incorporate V1 的 Audience Registry、
MachineAccessGrant、service principal profile、严格 Scope rejection、versioned migration 与
same-transaction audit grammar；本 Child 只为新的资源服务命名最小 entry 和未来 delta。

## 4. Current State

### STATE-NI-001 — 当前 accepted registry 未包含 Notification Ingress Audience

- Subject: Minimal Auth Contract `1.3.0` Audience Registry authority
- As-of commit: `7cd4b60c31407648f5288ff5d5a5570e4449fadb`
- Environment: `mayf3/auth-service` source repository, `github/main`
- Observed at: `2026-08-22T09:17:16Z`
- Basis: `OBS-NI-001`, `OBS-NI-002`, `EVD-NI-001`

### STATE-NI-002 — Audience/Scope/Grant 生效需要 versioned delta

- Subject: accepted Minimal Auth Grant management and migration grammar
- As-of commit: `7cd4b60c31407648f5288ff5d5a5570e4449fadb`
- Environment: repository authority source; production database not accessed
- Observed at: `2026-08-22T09:17:16Z`
- Basis: `OBS-NI-003`, `EVD-NI-002`

## 5. Observations

### OBS-NI-001 — Accepted Audience list

- Subject: `docs/contracts/minimal-auth-v1/grants-and-audiences.md` and Contract Bundle `1.3.0`
- Source revision: `7cd4b60c31407648f5288ff5d5a5570e4449fadb`
- Environment: clean fresh worktree
- Observed at: `2026-08-22T09:17:16Z`
- Method: direct source inspection
- Result: accepted list includes `svc-workflow`, `svc-okr`, `adc-v2`, and `svc-forum`; it does not include `agent-core-notification-ingress-v1`.
- Provenance: named source files at the authoring base.

### OBS-NI-002 — Audience and Scope grammar

- Subject: Audience registration, namespace, strict-scope, and three-Grant structures
- Source revision: `7cd4b60c31407648f5288ff5d5a5570e4449fadb`
- Environment: clean fresh worktree
- Observed at: `2026-08-22T09:17:16Z`
- Method: direct inspection of `grants-and-audiences.md` and `claims-and-profiles.md`
- Result: Audience entries bind resource service, namespace and principal types; direct machine Grants are paired by Audience; service is an allowed direct-machine principal type; wildcard and cross-Audience Scope reuse are rejected.
- Provenance: accepted Minimal Auth V2 exact-incorporated modules.

### OBS-NI-003 — Grant changes require versioned migration

- Subject: Grant management and migration grammar
- Source revision: `7cd4b60c31407648f5288ff5d5a5570e4449fadb`
- Environment: clean fresh worktree; no production access
- Observed at: `2026-08-22T09:17:16Z`
- Method: direct inspection of `grants-and-audiences.md` §9 and migration authority
- Result: the current bundle has no online Grant management API; Audience/Scope/Grant facts require versioned artifacts/migrations with fixed SHA, approval metadata, optimistic concurrency, and same-transaction audit.
- Provenance: accepted Minimal Auth V2 exact-incorporated modules.

## 6. Claims and assumptions

### CLM-NI-001 — A bounded child CCR is required

- Support state: SUPPORTED
- Supported by evidence: `EVD-NI-001`, `EVD-NI-002`
- Contradicted by evidence: none known
- Uncertainty: none; the Audience is absent and accepted grammar requires explicit registration.

### CLM-NI-002 — One Scope is the narrowest sufficient registration

- Support state: SUPPORTED
- Supported by evidence: `EVD-NI-003`
- Contradicted by evidence: none known
- Uncertainty: none within the owner-frozen `POST /v1/deliver` boundary.

## 7. Evidence relations

### EVD-NI-001 — Registry observation supports the new CCR

- Source observations: `OBS-NI-001`, `OBS-NI-002`
- Target: `STATE-NI-001`, `CLM-NI-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@7cd4b60c31407648f5288ff5d5a5570e4449fadb`, observed `2026-08-22T09:17:16Z`
- Strength/sufficiency: exact for source authority at the authoring base
- Limitations: does not register or activate the Audience.
- Provenance: accepted authority source.

### EVD-NI-002 — Migration grammar supports required-delta-only treatment

- Source observations: `OBS-NI-003`
- Target: `STATE-NI-002`, `CLM-NI-001`
- Relation: SUPPORTS
- Bound coordinates: same repository/base/time as `EVD-NI-001`
- Strength/sufficiency: exact for the accepted Grant management grammar
- Limitations: no migration or production state was executed or inspected.
- Provenance: accepted authority source.

### EVD-NI-003 — Owner ruling supports the one-Scope boundary

- Source observations: owner-frozen task ruling recorded in this Spec §1–§2
- Target: `CLM-NI-002`
- Relation: SUPPORTS
- Bound coordinates: this proposed authority at the authoring base
- Strength/sufficiency: authoritative input for the proposed decision
- Limitations: becomes active only after independent review, owner acceptance, and merge.
- Provenance: owner task dispatch.

## 8. Decisions

### DEC-NI-001 — Register one dedicated service Audience

- Decision owner: mayf3
- Decision: use exact Audience and resource literal `agent-core-notification-ingress-v1`.
- Rejected alternative: operator-selected literal or reuse of another Audience.
- Reason: cross-Audience Scope reuse is forbidden and the resource boundary must be deterministic.

### DEC-NI-002 — Register only `notification.deliver`

- Decision owner: mayf3
- Decision: namespace is `notification`; only `notification.deliver` is registered.
- Rejected alternative: wildcard, `notification.*`, or additional speculative scopes.
- Reason: least authority for one ingress operation.

### DEC-NI-003 — Service-only direct machine access

- Decision owner: mayf3
- Decision: accepted principal types are exactly `[service]`; machine access is enabled; Human and Delegated access are disabled.
- Rejected alternative: agent/user profiles or OBO/delegation.
- Reason: allowed callers are independent business services, not users, agents, or proxies.

### DEC-NI-004 — Audience registration and Grant application remain separate

- Decision owner: mayf3
- Decision: this Spec freezes future Grant requirements but applies none.
- Rejected alternative: create clients, credentials, or Grants in the authority PR.
- Reason: credential and Grant lifecycle require separate audited operational authority.

## 9. Contracts

### CTR-NI-001 — Exact Audience entry

Any future Contract Bundle / registry implementation under this authority MUST produce exactly:

```json
{
  "audience_id": "agent-core-notification-ingress-v1",
  "resource_service": "agent-core-notification-ingress-v1",
  "scope_namespace": "notification",
  "accepted_principal_types": ["service"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["notification.deliver"],
  "status": "active"
}
```

Bundle-specific lifecycle metadata MAY be added only when required by the accepted schema and MUST NOT change these frozen fields.

### CTR-NI-002 — Scope semantics and auth-service boundary

`notification.deliver` corresponds only to Agent Core Notification Ingress `POST /v1/deliver`.
auth-service MUST treat the Scope as an opaque registered string and MUST only enforce exact
Audience/Scope/Grant checks. It MUST NOT interpret deliver product semantics or infer Router,
Scheduler, Forum, Workflow, management, provisioning, token-management, Human, or delegation
authority from it.

### CTR-NI-003 — Strict non-reuse

`auth.identity.provision` and every Scope belonging to another Audience MUST NOT satisfy
`notification.deliver`. `notification.deliver` MUST NOT satisfy another Audience. Wildcards,
prefix matching, `notification.*`, and any generic notification Grant are forbidden. A request
containing any unregistered or ungranted Scope MUST fail as a whole; silent downscoping is forbidden.

### CTR-NI-004 — Future independent service clients and Grants

A future reviewed credential/Grant operation for the two allowed callers MUST satisfy:

```text
svc-forum independent client:
  audience = agent-core-notification-ingress-v1
  scopes = [notification.deliver]
  principal_type = service

svc-workflow independent client:
  audience = agent-core-notification-ingress-v1
  scopes = [notification.deliver]
  principal_type = service
```

The two clients MUST have distinct `clientId` values and distinct secrets. Neither client may receive
another notification Scope, Human access, delegation/OBO authority, or authority for another
Audience by implication. Client creation, secret creation/delivery, and Grant apply require separate
reviewed operational authority and are not authorized by this Spec.

### CTR-NI-005 — Versioned migration required delta

Because current accepted authority requires versioned artifacts/migration for Audience, Scope and
Grant facts, future implementation MUST be a separately reviewed versioned delta that:

1. adds exactly the `CTR-NI-001` Audience entry and `notification.deliver` registration;
2. updates the Contract Bundle/version linkage and positive/negative conformance required by the accepted grammar;
3. does not create credentials or apply production Grants unless a separate authority explicitly permits that operation;
4. uses fixed Git SHA, approval/audit metadata, optimistic concurrency and same-transaction audit for any later Grant write;
5. fails closed on registry, principal profile, Scope or expected-version mismatch.

This Spec freezes the migration contract only. It does not execute or authorize a production migration.

### CTR-NI-006 — No production effect from lifecycle actions

Proposal, review, acceptance, or merge of this Spec MUST NOT be interpreted as registry activation,
credential creation, Grant application, database change, deployment, or production effectiveness.

```text
PRODUCTION_GRANT_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
```

## 10. Acceptance

### ACC-NI-001 — Exact entry comparison

- Contracts: `CTR-NI-001`
- Method: machine-compare all frozen fields against a future registry delta.
- Required evidence: exact JSON projection and versioned bundle diff.
- Expected result: exact equality.
- Failure condition: any field, type, value, array member, or ordering differs.

### ACC-NI-002 — Scope isolation negatives

- Contracts: `CTR-NI-002`, `CTR-NI-003`
- Method: conformance cases for wrong Audience, `auth.identity.provision`, wildcard, `notification.*`, extra Scope, and cross-Audience reuse.
- Expected result: every case is rejected without downscoping.
- Failure condition: any cross-use, wildcard, inferred authority, or partial issuance succeeds.

### ACC-NI-003 — Principal profile

- Contracts: `CTR-NI-001`, `CTR-NI-004`
- Method: machine-compare registry profile and future client/Grant plan.
- Expected result: `[service]`, machine-only, two distinct clients and secrets, no delegation.
- Failure condition: user/agent acceptance, Human/delegated access, shared clientId/secret, or extra Grant.

### ACC-NI-004 — Migration and no-production boundary

- Contracts: `CTR-NI-005`, `CTR-NI-006`
- Method: diff and operational-record audit.
- Expected result: authority/contract delta only; no product code, DB write, credential, Grant, deploy, or production change.
- Failure condition: any prohibited action occurs or lifecycle is claimed as production effectiveness.

## 11. Alternatives and disposition

### ALT-NI-001 — Reuse `auth.identity.provision`

- Disposition: rejected
- Reason: identity provisioning is an unrelated management authority and may not cross Audience boundaries.

### ALT-NI-002 — Generic `notification.*` Grant

- Disposition: rejected
- Reason: wildcard/prefix authority violates strict Scope grammar and least privilege.

### ALT-NI-003 — Shared client for svc-forum and svc-workflow

- Disposition: rejected
- Reason: destroys caller identity separation, independent rotation, and independent revocation.

### ALT-NI-004 — Apply Grant in this CCR

- Disposition: rejected
- Reason: authority authoring is not an audited production operation.

## 12. Migration, compatibility, and rollback

```text
MIGRATION_THIS_ROUND = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
ROLLBACK_THIS_ROUND = delete/revise proposed branch before acceptance; no runtime state exists
```

A future implementation follows `CTR-NI-005`. A future production Grant operation is separate and
must use forward migration/reconciliation; it may not be simulated by editing this accepted authority.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 14. Frozen summary

```text
AUTHORITY_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
STATUS = proposed
AUDIENCE_ID = agent-core-notification-ingress-v1
RESOURCE_SERVICE = agent-core-notification-ingress-v1
SCOPE_NAMESPACE = notification
REGISTERED_SCOPES = [notification.deliver]
ACCEPTED_PRINCIPAL_TYPES = [service]
HUMAN_ACCESS_ENABLED = false
MACHINE_ACCESS_ENABLED = true
DELEGATED_ACCESS_ENABLED = false
PRODUCTION_GRANT_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
PRODUCT_CODE_CHANGE = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
MERGE_PERFORMED = NO
```
