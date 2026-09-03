# IDENTITY_READBACK — DAILY AUTONOMY OPERATIONAL GRANTS V1

- repository: `mayf3/auth-service`
- source checkout: `ff9e1bec7d364568a92be91f6ffbd49d1d2101de`
- environment: production DB `127.0.0.1:5432/agent_dev_center`
- actor: read-only PostgreSQL role `auth_ro`
- observed_at: `2026-09-03T16:41:01Z`
- transaction: explicit `BEGIN READ ONLY` / `ROLLBACK`; zero writes

## Exact sanitized query identity

```sql
SELECT p.id::text, p.agent_id, p.principal_type, p.status,
       c.id::text, c.client_id, c.status, c.machine_principal_id::text,
       (SELECT count(*) FROM machine_clients c2
        WHERE c2.machine_principal_id=p.id AND c2.status='active')
FROM machine_principals p
JOIN machine_clients c ON c.machine_principal_id=p.id
WHERE p.id='b21ddb23-42f6-47c4-a27f-bc44950e554c'::uuid
  AND c.id='695d1eeb-3547-4cbd-a72b-915f4ebf25a4'::uuid
  AND c.client_id='mc_cF81DF-XND9Zmzao4F08rOK_';
```

## Sanitized result

Exactly one row:

```text
b21ddb23-42f6-47c4-a27f-bc44950e554c|agt_efficiency-agent|agent|active|695d1eeb-3547-4cbd-a72b-915f4ebf25a4|mc_cF81DF-XND9Zmzao4F08rOK_|active|b21ddb23-42f6-47c4-a27f-bc44950e554c|1
```

Canonical result bytes (the row above without trailing newline) SHA-256:
`adc898813dfc1db804aedf6985db624756a351dd7a0622b7c5e177da2c960886`.
No secret/hash/token or environment value was selected or retained.
