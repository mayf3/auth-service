# Audit Receipt — 20260724000100_provisioning_broker_bootstrap

**Type**: Manual SQL Bootstrap (NOT Prisma Migration) — CONTAINS SECRET_HASH, MUST NOT BE COMMITTED  
**Date**: 2026-07-26 (reconciliation audit)  
**Auditor**: AUTH_RUNTIME_MAINLINE_RECONCILIATION_V1

---

## Operation Purpose

Create a new provisioning client + grant under an existing principal when all previous provisioning clients were revoked. This was a one-time bootstrap recovery operation.

**Task**: `AUTH_PROVISIONING_OPERATOR_RECOVERY_V1`  
**Mode**: `CONTROLLED_BOOTSTRAP_EXCEPTION`  
**Approved Exception**: `true`

---

## Client Details (Non-Secret)

| Field | Value |
|-------|-------|
| New Client ID | `mc_prov_N9NO0yYvw_3fR1ucqusIqw` |
| Target Principal UUID | `857b20c3-8d84-497d-950a-7b185a116687` |
| Target Audience | `svc-auth` |
| Target Scope | `auth.identity.provision` |

---

## Old Client Status

| Field | Value |
|-------|-------|
| Old Client ID | `mc_qO3Hecl2nAa3NircjiZWYKm5` |
| Old Client Status | `revoked` ✅ (still revoked, not reactivated) |

---

## Execution Details

| Field | Value |
|-------|-------|
| Execution method | Manual SQL (`psql` or equivalent) |
| Execution time | 2026-07-24 07:18:17 UTC (from DB `created_at`) |
| Executor category | Operations / Infrastructure |
| Prisma Migration recorded | No (`_prisma_migrations` has no entry) |

---

## SQL File Digest (Without Contents)

```
SHA256: 98c172bbe253fcaec910c359438de0724432a7680826c3d1c4877e31293143ba
WARNING: Contains fixed production secret_hash — do not commit, do not distribute
```

---

## Security Notes

⛔ **The original SQL contains a fixed `secret_hash` value. Under no circumstances should it be committed to Git.**  
⛔ **This receipt intentionally omits the `secret_hash` value.**  
✅ The SQL file remains in the working tree as a local reference only (`.gitignore` entry recommended).

---

## Verification Results (2026-07-26)

| Check | Result |
|-------|--------|
| New client `mc_prov_N9NO0yYvw_3fR1ucqusIqw` exists | ✅ PASS (active) |
| New client has correct principal | ✅ PASS (`857b20c3-8d84-497d-950a-7b185a116687`) |
| Grant `svc-auth` / `auth.identity.provision` exists | ✅ PASS |
| Old client `mc_qO3Hecl2nAa3NircjiZWYKm5` still revoked | ✅ PASS (not reactivated) |
| No duplicate active provisioning clients | ✅ PASS |

---

## Classification

```
BOOTSTRAP_APPLICATION_MODE=manual_sql
BOOTSTRAP_RECORDED_IN_PRISMA=false
BOOTSTRAP_SQL_CONTAINS_SECRET_HASH=true
BOOTSTRAP_SQL_WILL_BE_COMMITTED=false
BOOTSTRAP_RECEIPT_REQUIRED=true
BOOTSTRAP_RECEIPT_CREATED=true
BOOTSTRAP_MIGRATION_RECORDED_WITH_SECRET_HASH=false
```

---

## Files Exclusion

The following file MUST be excluded from any Git commit due to containing a production `secret_hash`:

```
prisma/migrations/20260724000100_provisioning_broker_bootstrap/migration.sql
```

No replacement/stub file should be created. The execution is already complete and verified.
