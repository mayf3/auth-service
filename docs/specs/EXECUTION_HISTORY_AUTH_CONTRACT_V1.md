# EXECUTION_HISTORY_AUTH_CONTRACT_V1

```text
STATUS = ACCEPTED
ACCEPTED_AT = 2026-11-01
ACCEPTED_BY = Owner (mayf3), in-session delegation, recorded on auth-service#94
SOURCE_CANDIDATE = EXECUTION_HISTORY_AUTH_CONTRACT_CANDIDATE_V1 (auth-service#94 comment, text below verbatim)
SUPERSEDES = none
DOWNSTREAM = dsh-agent-core#545 install + grant + denial/HR-redacted-read canaries
```

## Frozen contract (verbatim from the accepted candidate)

```text
AUDIENCE = execution-history

SCOPE execution.history.read
  DOMAIN = SELF_ONLY
  DEFAULT = eligible fleet clients only through the existing provisioning path
  EFFECT = read the caller's own execution-history projection
  CROSS_AGENT = forbidden

SCOPE execution.history.audit
  DOMAIN = EXPLICIT_CROSS_AGENT_AUDIT
  DEFAULT = DENY
  PROVISION = explicit existing-Owner instruction to a named registered client
  REVOKE = supported and idempotent
  AUDIT = every provision/revoke emits grant_change_audits evidence
  DECRYPTION = forbidden; audit does not confer secret/raw-content access

TOKEN
  resource/audience binding = execution-history
  requested scope must be a subset of the client's durable grant
  missing grant = stable deny; never silently downgrade to read
  unknown audience/scope = fail closed

PROVISIONING
  reuse the repository's existing idempotent grant provisioning/revoke pattern
  no direct/manual allowlist row insertion
  no second authorization lifecycle or database
```

## Acceptance tests (required by the contract)

1. Registered self-read client mints `execution.history.read` and cannot query another agent.
2. Explicitly granted audit client mints `execution.history.audit`; an ungranted client receives stable `machine_grant_missing`-class denial.
3. Resource/audience mismatch and scope escalation both fail closed.
4. Provisioning is idempotent; revoke removes the grant; both paths emit auditable records.
5. No test logs token/secret/raw session content.

## Phase

ACCEPTED — implementation may proceed on the existing lawful source line; production deployment remains separately gated.
