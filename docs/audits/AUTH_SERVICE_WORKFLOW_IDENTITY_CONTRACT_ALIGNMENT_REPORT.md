# auth-service — Workflow Identity Contract Alignment Report

**Date:** 2026-07-16
**Type:** Docs-only PR (no source code, tests, config, or deployment changes)
**Status:** `AUTH_SERVICE_WORKFLOW_IDENTITY_CONTRACT_ALIGNMENT_READY_FOR_AUDIT`

---

## Git Summary

| Field | Value |
|---|---|
| BASE_SHA | `986932a22134a1a6238348be8e16712b4fb8fdc6` |
| BRANCH | `docs/workflow-identity-contract-alignment-v0` |
| FINAL_HEAD_SHA | `c2ba65470d075f2abbc19c5862eaa3e00b660191` |
| FINAL_TREE_SHA | `20e342c95f24a64aace69a9db940d0c795270de1` |

---

## Modified Files

| File | Change Type | Description |
|---|---|---|
| `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` | Modified | Added §17 Compatibility Matrix + §18 Document Precedence; renumbered §19 |
| `ADC_SVC_WORKFLOW_OBO_JWKS_IMPLEMENTATION_CONTRACT.md` | Modified | §4.2: `token_type`→`type` fix; added `token_type` vs `type` clarification; added §20 Document Precedence |
| `AUTH_SERVICE_WORKFLOW_OBO_JWKS_INVESTIGATION.md` | Modified | §5.1: added SUPERSEDED annotation; added historical note clarifying that the `azp` sketch was superseded by frozen contract |
| `AUTH_SERVICE_WORKFLOW_IDENTITY_IMPLEMENTATION_PLAN.md` | Unchanged | Already correct — §7.5 specifies `type: "access"`, no `azp`/`act` on direct tokens |
| `AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_IMPLEMENTATION_REPORT.md` | Unchanged | Already correct |
| `AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_AUDIT_REPORT.md` | Unchanged | Captures findings N-1/N-2/N-3; no change needed |
| `AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_CONTROLLED_CANARY_REPORT.md` | Unchanged | Newly created already aligned |

---

## Verification Results

| Check | Result |
|---|---|
| SOURCE_CODE_CHANGED | `false` ✅ |
| TEST_CODE_CHANGED | `false` ✅ |
| DIRECT_WORKFLOW_AUTHORIZED_PARTY_CLAIM | `CLIENT_ID_ONLY` ✅ |
| DIRECT_TOKEN_AZP_PRESENT | `false` ✅ (all `azp` references are OBO-only or properly superseded) |
| DIRECT_TOKEN_ACT_PRESENT | `false` ✅ |
| JWT_PAYLOAD_TOKEN_TYPE_FIELD | `type` ✅ |
| OAUTH_RESPONSE_TOKEN_TYPE_FIELD | `token_type` ✅ |
| WORKFLOW_SIGNING_ALGORITHM | `RS256` ✅ |
| JWKS_ENDPOINT_DOCUMENTED | `true` ✅ |
| OBO_IMPLEMENTATION_STATUS | `NOT_IMPLEMENTED` ✅ |
| DOCUMENT_PRECEDENCE_DEFINED | `true` ✅ (§18 in PR-A formal contract, §20 in ADC contract) |
| CONFLICTING_EXAMPLES_REMAINING | `false` ✅ |
| SECRET_TOKEN_PEM_SCAN | `pass` ✅ (no real secrets; placeholder references only) |
| GIT_DIFF_CHECK | `pass` ✅ |
| CLEAN_CHECKOUT_VERDICT | `pass` ✅ |

---

## Detailed Changes

### 1. ADC Contract §4.2 — JWT Payload Field Name Correction

**Before:**
```json
{
  ...
  "token_type": "access",
  ...
}
```

**After:**
```json
{
  ...
  "type": "access",
  ...
}
```

Added clarification:
> **`token_type` vs `type` Clarification:** The OAuth HTTP response body uses
> `token_type: "Bearer"` (RFC 6749 field — describes HTTP Authorization scheme).
> The JWT *payload* uses `type: "access"` (describes the token's business purpose).
> These are two different fields at two different layers. Never use `token_type`
> inside the JWT claims.

**Status:** ✅ Fixed (resolves audit finding N-1)

### 2. Investigation Report §5.1 — Superseded `azp` on Direct Token

Added a prominent banner:
> **⚠️ SUPERSEDED — Historical sketch only.**
> This section is an early investigation draft. The frozen contract for the
> direct Machine Token is defined in **`docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` §6**
> and **Implementation Plan §7.5**, which specify:
> - Direct token uses `client_id` (not `azp`) as the authorized-party claim
> - `azp` and `act` are **reserved for OBO tokens only** (future PR-B)
>
> See also **ADC Contract §4.2** (the cross-repo cross-reference contract).
> In case of conflict between this investigation sketch and the frozen contract,
> the frozen contract takes precedence (§10 Document Precedence).

**Historical note preserved** explaining the investigation context and the later decision.

**Status:** ✅ Resolved (addresses audit finding N-2)

### 3. PR-A Formal Contract — Document Precedence (§18)

New section added to `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md`:

| Priority | Document | Scope |
|---|---|---|
| 1 (highest) | `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` (this contract) | PR-A direct token formal contract |
| 2 | `ADC_SVC_WORKFLOW_OBO_JWKS_IMPLEMENTATION_CONTRACT.md` | Cross-repo contract |
| 3 | Audit & Canary reports | Implementation verification |
| 4 | `AUTH_SERVICE_WORKFLOW_IDENTITY_IMPLEMENTATION_PLAN.md` | Design plan |
| 5 | `AUTH_SERVICE_WORKFLOW_OBO_JWKS_INVESTIGATION.md` | Historical investigation (non-contract) |

Rules state that investigation documents are explicitly **non-contract** and higher-priority documents govern in case of conflict.

**Status:** ✅ Added

### 4. PR-A Formal Contract — Compatibility Matrix (§17)

Added token type compatibility matrix covering all 5 token families:
- Existing User Token (non-workflow, HS256)
- Existing Agent Token (non-workflow, HS256)
- Workflow Agent Direct (svc-workflow, RS256) — PR-A ✅
- Workflow User Direct (svc-workflow, RS256) — Not implemented
- Workflow OBO (svc-workflow, RS256) — Not implemented

Rows marked "Not implemented" are explicitly documented as future scope.

**Status:** ✅ Added

### 5. ADC Contract — Document Precedence Cross-Reference (§20)

Added a reference to the PR-A formal contract's document precedence hierarchy,
clarifying that `docs/contracts/` (Priority 1) governs in case of conflict.

**Status:** ✅ Added

---

## Remaining Historical Words

The following historical phrases remain in documents but are now **explicitly marked** as superseded/historical:

| Document | Phrase | Context | Status |
|---|---|---|---|
| `AUTH_SERVICE_WORKFLOW_OBO_JWKS_INVESTIGATION.md` §5.1 | `"azp": "<client_id>"` | Direct token example — superseded by frozen contract | ⚠️ Marked SUPERSEDED |
| `AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_AUDIT_REPORT.md` §十六 | N-1 mentions `token_type` in ADC contract | Audit finding (narrative reference to the fixed issue) | ✅ Narrative only, not contractual |
| `AUTH_SERVICE_WORKFLOW_JWKS_SIGNER_V0_AUDIT_REPORT.md` §十六 | N-2 mentions `azp` in investigation | Audit finding (narrative reference to the fixed issue) | ✅ Narrative only, not contractual |

No unmarked conflicting examples remain.

---

## Final Status

```text
AUTH_SERVICE_WORKFLOW_IDENTITY_CONTRACT_ALIGNMENT_READY_FOR_AUDIT
```

The next step is an independent audit to confirm all formal contracts are
unique and conflict-free, after which PR-B (OBO) can be designed against
this frozen baseline.
