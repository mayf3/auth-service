# Audit Receipt — 20260723000100_canary_all_agent_grants

**Type**: Manual SQL Execution (NOT Prisma Migration)  
**Date**: 2026-07-26 (reconciliation audit)  
**Auditor**: AUTH_RUNTIME_MAINLINE_RECONCILIATION_V1

---

## Operation Purpose

Add `svc-okr` (okr.read) grant to all formal agents' authoritative `mc_oc_*` clients, and add `svc-workflow` grants to `mc_oc_*` clients that only had grants on their `mc_wf_*` clients.

This was a canary rollout for OKR machine read access to align with the `AUTH_SVC_OKR_MINIMAL_WRITE_SCOPE_V1` contract.

---

## Formal Agent Digest

The migration targets all active `mc_oc_*` clients. Verified count from database:

- **Target count**: 72 active `mc_oc_*` clients
- **Total active agents in DB**: 97
- **Filter**: `mc.status = 'active'`, `mp.status = 'active'`, `mp.principal_type = 'agent'`

### Agent List (72)

```
test-engineer, discipline-coach-agent, 3d-print-agent, lobster-agent, image-gen-agent,
explorer, private-chef-agent, feishu-expert-2-agent, travel-planner-agent, search-expert-agent,
reimbursement-expert, soul-questioner-agent, article-publisher-agent, video-producer,
investment-debater, agent-dev-engineer, research-agent, knowledge-curator-agent,
lobster-guide-agent, security-agent, family-doctor-2-agent, miniapp-game-engineer,
product-designer, open-source-agent, learning-expert, finance-agent, paper-reviewer-agent,
backend-engineer-2, course-community-agent, feishu-expert-agent, social-butterfly-agent,
efficiency-manager, course-community-agent-2, healthcheck-agent, itops-agent,
delivery-review-agent, novel-writer, qa-reviewer, finance-housekeeper-agent,
psychology-agent, mobile-app-engineer, qa-reviewer-2, transcript-editor-agent,
game-dev-agent, daily-thought-agent, stock-agent, needs-radar-agent, voice-tech-agent,
build-in-public-agent, home-repair-agent, biz-explorer, training-expert-agent,
smart-home-agent, arch-reviewer, hao-yang-mao-agent, sales-copy-agent, devtools-agent,
product-manager, creative-writer, hr-agent, job-watch-agent, biz-product-designer,
account-manager-agent, writing-style-analyst-agent, shopping-list-agent, ppt-designer,
book-deconstructor-agent, cto-agent, skill-engineer-agent, education-agent,
quant-trading-agent, trend-tracker
```

---

## Execution Details

| Field | Value |
|-------|-------|
| Execution method | Manual SQL (`psql` or equivalent) |
| Execution window | Prior to 2026-07-23 22:17 (file creation time) |
| Executor category | Operations / Infrastructure |
| Prisma Migration recorded | No (`_prisma_migrations` has no entry) |

---

## SQL File Digest

```
SHA256: de7291fbe7455f9f045e9eb0194fd3016a01c25739ffef705db779f005f136a0
```

Note: The SQL file is NOT committed to Git and should NOT be committed as a Prisma migration, because it was executed manually.

---

## Verification Results (2026-07-26)

| Check | Result |
|-------|--------|
| `svc-okr` audience exists | ✅ PASS |
| All 72 mc_oc_* clients have `svc-okr` / `okr.read` grant | ✅ PASS (72/72) |
| All 72 mc_oc_* clients have `svc-workflow` / `workflow.read, workflow.execute` grant | ✅ PASS (72/72) |
| Verification phase (fail-close) would pass | ✅ PASS |
| CEO's existing okr.write grant unaffected | ✅ PASS |

No secrets, tokens, passwords, or `secret_hash` values were present in the SQL.

---

## Classification

```
AGENT_GRANTS_APPLICATION_MODE=manual_sql
AGENT_GRANTS_RECORDED_IN_PRISMA=false
AGENT_GRANTS_SAFE_TO_COMMIT=false
AGENT_GRANTS_RECEIPT_REQUIRED=true
AGENT_GRANTS_RECEIPT_CREATED=true
```
