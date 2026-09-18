#!/usr/bin/env python3
"""Complete canonical PostgreSQL schema fingerprint for the canonical subject
enrollment surface.

Gate B of AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_PRODUCTION_BOOTSTRAP_V1.

The expected fingerprint is GENERATED, never hand-written: a disposable
PostgreSQL cluster is built by applying the exact predecessor migration chain
(every migration except the enrollment one, in ledger order) and then the exact
enrollment migration bytes; the enrollment surface is the canonical delta of the
two extracted full-surface states. The classifier then compares a live database
against that generated expectation and can distinguish:

  NOT_INSTALLED       target migration ledger absent AND complete target surface absent
  EXACTLY_INSTALLED   ledger applied AND complete schema fingerprint exact
  PARTIAL_OR_DRIFTED  anything else

Surface coverage per object class (canonical entries):
  enum       name + labels in enum sort order
  table      columns: name, full typed type incl. typmod (format_type), nullability,
             default expression (pg_get_expr), identity/generated metadata
  constraint primary key / unique / check / foreign keys: canonical
             pg_get_constraintdef text plus structured FK target/actions
  index      exact columns/expressions, predicate, uniqueness (pg_get_indexdef)
  function   identity arguments, result type, language, volatility,
             SECURITY DEFINER/INVOKER, owner when SECURITY DEFINER,
             canonical pg_get_functiondef body
  trigger    timing, events, constraint/deferrable properties, canonical
             pg_get_triggerdef body, enabled state

This module is an execution-trusted component: its bytes are sealed in
EXECUTION_COMPONENT_MANIFEST_V1 and verified before any privileged use.
"""
import argparse
import hashlib
import json
import os
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

ENROLLMENT_MIGRATION_NAME = '202609160001_canonical_subject_enrollment'

ENROLLMENT_TABLES = [
    'canonical_subject_attestations',
    'canonical_subject_operation_authorities',
    'canonical_subject_operations',
    'canonical_subject_source_bindings',
    'identity_attestation_delegations',
]
# Cross-table surface created by the enrollment migration on foundation tables.
FOUNDATION_TRIGGER_TABLES = ['agent_identity_lifecycle']

ENROLLMENT_ENUMS = [
    'AttestationActorKind',
    'AttestationAuthorityKind',
    'AttestationAuthorityOperation',
    'CanonicalSubjectType',
    'DelegatedActorType',
    'IdentityAttestationDelegationStatus',
    'SourceBindingSemantics',
    'SourceBindingStatus',
    'SubjectAttestationStatus',
]

ENROLLMENT_FUNCTIONS = [
    'canonical_subject_attestation_guard',
    'canonical_subject_binding_guard',
    'canonical_subject_deferred_invariants',
    'canonical_subject_delegation_guard',
    'canonical_subject_lifecycle_dependency_guard',
    'canonical_subject_mutation_counts_valid',
    'canonical_subject_write_guard',
]

FK_ACTION_SQL = ("CASE {0} WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'"
                 " WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE NULL END")


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_text(text):
    return sha256_bytes(text.encode('utf-8'))


def run(args, env=None, timeout=180, cwd=None, input_text=None):
    return subprocess.run(args, env=env, timeout=timeout, cwd=cwd,
                          input=input_text, text=True, capture_output=True)


def psql_json(env, sql_text):
    result = run(['psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql_text], env=env)
    if result.returncode != 0:
        detail = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else 'unknown error'
        raise RuntimeError('psql failed: ' + detail)
    return json.loads(result.stdout)


def name_list(values):
    return ','.join("'" + value.replace("'", "''") + "'" for value in values)


def pg_array(values):
    return 'ARRAY[' + name_list(values) + ']::text[]'


def extraction_sql(tables_full, tables_trigger_only, enums, functions):
    return f"""
WITH config AS (
  SELECT {pg_array(tables_full)} AS tables_full,
         {pg_array(tables_trigger_only)} AS tables_trigger_only,
         {pg_array(enums)} AS enums,
         {pg_array(functions)} AS functions
),
table_ids AS (
  SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, config k
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
    AND (c.relname = ANY(k.tables_full) OR c.relname = ANY(k.tables_trigger_only))
),
enum_entries AS (
  SELECT jsonb_build_object(
    'kind', 'enum', 'name', t.typname,
    'labels', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid)
  ) AS entry
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace, config k
  WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname = ANY(k.enums)
),
table_entries AS (
  SELECT jsonb_build_object(
    'kind', 'table', 'name', c.relname,
    'columns', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname,
        'type', format_type(a.atttypid, a.atttypmod),
        'notNull', a.attnotnull,
        'default', CASE WHEN d.oid IS NULL THEN NULL ELSE pg_get_expr(d.adbin, d.adrelid) END,
        'generated', CASE WHEN a.attgenerated = '' THEN NULL ELSE a.attgenerated END,
        'identity', CASE WHEN a.attidentity = '' THEN NULL ELSE a.attidentity END
      ) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    )
  ) AS entry
  FROM pg_class c, config k
  WHERE c.oid IN (SELECT oid FROM table_ids WHERE relname = ANY(k.tables_full))
),
constraint_entries AS (
  SELECT jsonb_build_object(
    'kind', 'constraint', 'table', c.relname, 'name', con.conname,
    'type', con.contype,
    'def', pg_get_constraintdef(con.oid),
    'foreignKey', CASE WHEN con.contype <> 'f' THEN NULL ELSE jsonb_build_object(
      'columns', (SELECT jsonb_agg(a.attname ORDER BY ord) FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = u.attnum),
      'referencedTable', (SELECT relname FROM pg_class WHERE oid = con.confrelid),
      'referencedColumns', (SELECT jsonb_agg(a.attname ORDER BY ord) FROM unnest(con.confkey) WITH ORDINALITY AS u(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = u.attnum),
      'onUpdate', {FK_ACTION_SQL.format('confupdtype')},
      'onDelete', {FK_ACTION_SQL.format('confdeltype')},
      'matchType', CASE confmatchtype WHEN 'f' THEN 'FULL' WHEN 'p' THEN 'PARTIAL' WHEN 's' THEN 'SIMPLE' ELSE NULL END,
      'deferrable', con.condeferrable, 'initiallyDeferred', con.condeferred
    ) END
  ) AS entry
  FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid, config k
  WHERE c.oid IN (SELECT oid FROM table_ids WHERE relname = ANY(k.tables_full))
    AND con.contype IN ('p','u','f','c')
),
index_entries AS (
  SELECT jsonb_build_object(
    'kind', 'index', 'table', c.relname, 'name', i.relname,
    'unique', ix.indisunique,
    'def', pg_get_indexdef(i.oid)
  ) AS entry
  FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_class c ON c.oid = ix.indrelid, config k
  WHERE c.oid IN (SELECT oid FROM table_ids WHERE relname = ANY(k.tables_full))
    AND NOT ix.indisprimary
),
function_entries AS (
  SELECT jsonb_build_object(
    'kind', 'function', 'name', p.proname,
    'identity', pg_get_function_identity_arguments(p.oid),
    'result', pg_get_function_result(p.oid),
    'language', l.lanname,
    'volatility', p.provolatile,
    'security', CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
    'owner', CASE WHEN p.prosecdef THEN (SELECT r.rolname FROM pg_roles r WHERE r.oid = p.proowner) ELSE NULL END,
    'def', pg_get_functiondef(p.oid)
  ) AS entry
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang, config k
  WHERE n.nspname = 'public' AND p.proname = ANY(k.functions)
),
trigger_entries AS (
  SELECT jsonb_build_object(
    'kind', 'trigger', 'table', c.relname, 'name', t.tgname,
    'enabled', t.tgenabled,
    'def', pg_get_triggerdef(t.oid)
  ) AS entry
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid, config k
  WHERE c.oid IN (SELECT oid FROM table_ids)
    AND NOT t.tgisinternal
    AND (c.relname = ANY(k.tables_full)
         OR (c.relname = ANY(k.tables_trigger_only) AND t.tgname LIKE 'canonical_subject_%'))
)
SELECT jsonb_build_object(
  'serverVersion', current_setting('server_version'),
  'serverVersionNum', current_setting('server_version_num'),
  'database', current_database(),
  'entries', COALESCE((SELECT jsonb_agg(entry ORDER BY entry) FROM (
    SELECT DISTINCT entry FROM enum_entries UNION ALL SELECT DISTINCT entry FROM table_entries
    UNION ALL SELECT DISTINCT entry FROM constraint_entries UNION ALL SELECT DISTINCT entry FROM index_entries
    UNION ALL SELECT DISTINCT entry FROM function_entries UNION ALL SELECT DISTINCT entry FROM trigger_entries
  ) all_entries), '[]'::jsonb)
);
"""


def extract_surface(env, tables_full=None, tables_trigger_only=None, enums=None, functions=None):
    document = psql_json(env, extraction_sql(
        tables_full or ENROLLMENT_TABLES,
        tables_trigger_only or FOUNDATION_TRIGGER_TABLES,
        enums or ENROLLMENT_ENUMS,
        functions or ENROLLMENT_FUNCTIONS,
    ))
    entries = json.loads(canonical_json(document['entries']))
    return {'serverVersion': document['serverVersion'], 'serverVersionNum': int(document['serverVersionNum']),
            'database': document['database'], 'entries': entries}


def entry_key(entry):
    if entry['kind'] in ('constraint', 'index', 'trigger'):
        return (entry['kind'], entry['table'], entry['name'])
    return (entry['kind'], entry['name'], '')


def surface_digest(entries):
    ordered = sorted(entries, key=entry_key)
    return sha256_text(canonical_json(ordered))


def delta_surface(before_entries, after_entries):
    before_map = {entry_key(e): e for e in before_entries}
    delta = [e for e in after_entries if before_map.get(entry_key(e)) != e]
    return sorted(delta, key=entry_key)


def expected_object_sets(expected_entries):
    tables_full = sorted({(e.get('table') or e['name']) for e in expected_entries
                          if e['kind'] in ('table', 'constraint', 'index')})
    trigger_tables = sorted({e['table'] for e in expected_entries if e['kind'] == 'trigger'} - set(tables_full))
    enums = sorted({e['name'] for e in expected_entries if e['kind'] == 'enum'})
    functions = sorted({e['name'] for e in expected_entries if e['kind'] == 'function'})
    return {'tablesFull': tables_full, 'tablesTriggerOnly': trigger_tables, 'enums': enums, 'functions': functions}


def ledger_state(env, migration_name=ENROLLMENT_MIGRATION_NAME):
    probe = run(['psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
                 "SELECT CASE WHEN to_regclass('_prisma_migrations') IS NOT NULL THEN 'yes' ELSE 'no' END;"], env=env)
    if probe.returncode != 0:
        raise RuntimeError('ledger probe failed: ' + probe.stderr.strip().splitlines()[-1])
    if probe.stdout.strip() != 'yes':
        return {'ledgerTableExists': False, 'rows': []}
    rows = psql_json(env, f"""
SELECT COALESCE(json_agg(row_to_json(l)),'[]'::json) AS rows FROM (
  SELECT checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back,
         applied_steps_count FROM _prisma_migrations WHERE migration_name = '{migration_name}'
) l;
""")
    return {'ledgerTableExists': True, 'rows': rows}


def classify(env, expected_document, migration_sha256, migration_name=ENROLLMENT_MIGRATION_NAME):
    """Classify a live database against the generated expectation. Returns verdict + evidence."""
    expected_entries = expected_document['expectedEntries']
    object_sets = expected_document['objectSets']
    generation = expected_document.get('generation', {})
    live = extract_surface(env, object_sets['tablesFull'], object_sets['tablesTriggerOnly'],
                           object_sets['enums'], object_sets['functions'])
    live_major = int(live['serverVersionNum']) // 10000
    expected_major = int(generation.get('serverVersionNum', live['serverVersionNum'])) // 10000
    if live_major != expected_major:
        return {'verdict': 'PARTIAL_OR_DRIFTED',
                'reason': 'SERVER_MAJOR_VERSION_MISMATCH',
                'expectedMajor': expected_major, 'liveMajor': live_major}
    expected_map = {entry_key(e): e for e in expected_entries}
    live_map = {entry_key(e): e for e in live['entries']}
    missing = sorted(key for key in expected_map if key not in live_map)
    differing = sorted(key for key in expected_map if key in live_map and live_map[key] != expected_map[key])
    ledger = ledger_state(env, migration_name)
    ledger_rows = ledger['rows']
    ledger_exact = (ledger['ledgerTableExists'] and len(ledger_rows) == 1 and ledger_rows[0]['finished']
                    and not ledger_rows[0]['rolled_back'] and ledger_rows[0]['checksum'] == migration_sha256)
    surface_present_and_exact = not missing and not differing and len(live_map) == len(expected_map)
    # NOT_INSTALLED: the TARGET MIGRATION ledger row is absent (the shared
    # _prisma_migrations table may legitimately exist for other migrations)
    # AND the complete target surface is absent.
    if not ledger_rows and len(live_map) == 0:
        verdict = 'NOT_INSTALLED'
    elif ledger_exact and surface_present_and_exact:
        verdict = 'EXACTLY_INSTALLED'
    else:
        verdict = 'PARTIAL_OR_DRIFTED'
    return {'verdict': verdict, 'missingKeys': [list(key) for key in missing],
            'differingKeys': [list(key) for key in differing],
            'ledgerTableExists': ledger['ledgerTableExists'], 'ledgerRows': ledger_rows,
            'ledgerExact': ledger_exact,
            'surfaceEntryCount': len(live_map), 'expectedEntryCount': len(expected_map),
            'liveSurfaceDigest': surface_digest(live['entries']),
            'expectedSurfaceDigest': surface_digest(expected_entries),
            'liveServerVersion': live['serverVersion']}


# ---------------------------------------------------------------------------
# Disposable cluster machinery (expected fingerprint generation + drift selftest)
# ---------------------------------------------------------------------------

def free_port():
    server = socket.socket()
    server.bind(('127.0.0.1', 0))
    port = server.getsockname()[1]
    server.close()
    return port


def migration_files(repo_root):
    migrations_dir = Path(repo_root) / 'prisma' / 'migrations'
    names = sorted(p.name for p in migrations_dir.iterdir() if p.is_dir())
    return [(name, migrations_dir / name / 'migration.sql') for name in names
            if (migrations_dir / name / 'migration.sql').is_file()]


class DisposableCluster:
    def __init__(self, pg_bin, workdir, username='isolated'):
        self.pg_bin = Path(pg_bin)
        self.workdir = Path(workdir)
        self.username = username
        self.port = free_port()
        self.data_dir = self.workdir / 'data'
        self.env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        self.env.update({
            'PATH': f'{self.pg_bin}:{self.env.get("PATH", "")}',
            'PGHOST': '127.0.0.1', 'PGPORT': str(self.port), 'PGUSER': username,
            'PGDATABASE': 'fingerprint', 'PGCONNECT_TIMEOUT': '5',
        })

    def init(self):
        for tool in ('initdb', 'pg_ctl', 'psql'):
            if not (self.pg_bin / tool).exists():
                raise RuntimeError(f'missing postgres tool: {tool}')
        result = run([str(self.pg_bin / 'initdb'), '-D', str(self.data_dir), '-U', self.username,
                      '-A', 'trust', '--no-locale'])
        if result.returncode != 0:
            raise RuntimeError('initdb failed: ' + result.stderr[-800:])
        result = run([str(self.pg_bin / 'pg_ctl'), '-D', str(self.data_dir), '-w', '-t', '60', 'start',
                      '-l', str(self.workdir / 'postgres.log'),
                      '-o', f'-p {self.port} -h 127.0.0.1 -k {self.workdir}'])
        if result.returncode != 0:
            raise RuntimeError('pg_ctl start failed: ' + result.stdout[-800:] + result.stderr[-800:])
        self.sql_exec('CREATE DATABASE fingerprint;', database='postgres')

    def stop(self):
        run([str(self.pg_bin / 'pg_ctl'), '-D', str(self.data_dir), '-m', 'immediate', '-w', 'stop'])

    def sql_file(self, path, database=None, single_transaction=True):
        env = dict(self.env)
        if database:
            env['PGDATABASE'] = database
        args = ['psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
        if single_transaction:
            args.append('--single-transaction')
        args.extend(['-f', str(path)])
        result = run(args, env=env)
        if result.returncode != 0:
            raise RuntimeError(f'psql -f {path} failed: ' + result.stderr[-800:])

    def sql(self, text, database=None):
        env = dict(self.env)
        if database:
            env['PGDATABASE'] = database
        return psql_json(env, text)

    def sql_exec(self, text, database=None):
        env = dict(self.env)
        if database:
            env['PGDATABASE'] = database
        result = run(['psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', text], env=env)
        if result.returncode != 0:
            raise RuntimeError('psql exec failed: ' + (result.stderr.strip().splitlines()[-1] if result.stderr.strip() else 'unknown'))

    def create_database(self, name, template=None):
        sql = f'CREATE DATABASE {name}' + (f' TEMPLATE {template}' if template else '')
        self.sql_exec(sql, database='postgres')


def resolve_predecessor(repo_root):
    """Resolve the exact pre-enrollment product state.

    The migrations directory has no initial migration (the base schema predates
    the migration era), so the exact predecessor schema is taken from git: the
    parent of the commit that introduced the enrollment migration, whose
    prisma/schema.prisma is the accepted pre-enrollment product state.
    """
    introducing = run(['/usr/bin/git', '-C', str(repo_root), 'log', '--diff-filter=A', '--format=%H',
                       '--', f'prisma/migrations/{ENROLLMENT_MIGRATION_NAME}'])
    if introducing.returncode != 0 or not introducing.stdout.strip():
        raise RuntimeError('could not resolve the commit introducing the enrollment migration')
    introducing_commit = introducing.stdout.strip().splitlines()[-1]
    parent = run(['/usr/bin/git', '-C', str(repo_root), 'rev-parse', f'{introducing_commit}~1'])
    if parent.returncode != 0:
        raise RuntimeError('could not resolve predecessor commit')
    predecessor_commit = parent.stdout.strip()
    schema = run(['/usr/bin/git', '-C', str(repo_root), 'show', f'{predecessor_commit}:prisma/schema.prisma'])
    if schema.returncode != 0:
        raise RuntimeError('could not read predecessor schema.prisma')
    if 'canonical_subject_' in schema.stdout:
        raise RuntimeError('predecessor schema already contains enrollment surface')
    return {'commit': predecessor_commit, 'introducingCommit': introducing_commit,
            'schemaText': schema.stdout}


def generate_predecessor_ddl(repo_root, prisma_bin, schema_text, workdir):
    """Generate predecessor DDL with prisma's own machinery (never hand-written)."""
    schema_path = Path(workdir) / 'predecessor-schema.prisma'
    schema_path.write_text(schema_text, encoding='utf-8')
    env = {k: v for k, v in os.environ.items()}
    env.setdefault('DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/unused')
    result = run([str(prisma_bin), 'migrate', 'diff', '--from-empty',
                  '--to-schema-datamodel', str(schema_path), '--script'],
                 env=env, cwd=str(repo_root), timeout=180)
    if result.returncode != 0:
        raise RuntimeError('prisma migrate diff failed: ' + (result.stderr or result.stdout)[-800:])
    return result.stdout


def apply_chain(cluster, repo_root, exclude_name, prisma_bin, workdir):
    """Build the predecessor database and record its provenance."""
    predecessor = resolve_predecessor(repo_root)
    ddl = generate_predecessor_ddl(repo_root, prisma_bin, predecessor['schemaText'], workdir)
    ddl_path = Path(workdir) / 'predecessor-ddl.sql'
    ddl_path.write_text(ddl, encoding='utf-8')
    cluster.sql_file(ddl_path)
    provenance = {'method': 'prisma-migrate-diff-from-empty',
                  'predecessorCommit': predecessor['commit'],
                  'introducingCommit': predecessor['introducingCommit'],
                  'predecessorDdlSha256': sha256_text(ddl)}
    return provenance


DRIFT_FIXTURES = [
    ('drop-one-check', "ALTER TABLE identity_attestation_delegations DROP CONSTRAINT {check_name};"),
    ('change-fk-action', "ALTER TABLE identity_attestation_delegations DROP CONSTRAINT {fk_name};"
                         "ALTER TABLE identity_attestation_delegations ADD CONSTRAINT {fk_name}"
                         " FOREIGN KEY (delegated_machine_principal_id) REFERENCES machine_principals(id) ON DELETE CASCADE ON UPDATE RESTRICT;"),
    ('change-enum-labels', "ALTER TYPE \"SourceBindingStatus\" ADD VALUE 'drifted';"),
    ('change-partial-index-predicate', "DROP INDEX canonical_subject_attestations_one_active;"
                                       "CREATE UNIQUE INDEX canonical_subject_attestations_one_active ON canonical_subject_attestations(business_subject_id) WHERE status='active' AND revision>0;"),
    ('change-function-body', "CREATE OR REPLACE FUNCTION canonical_subject_write_guard() RETURNS trigger LANGUAGE plpgsql AS $body$BEGIN IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'canonical subject mutation requires serializable' USING ERRCODE='23514'; END IF; PERFORM pg_advisory_xact_lock(173496021,1); IF TG_OP='DELETE' THEN RAISE EXCEPTION 'canonical subject evidence is append preserving' USING ERRCODE='23514'; END IF; IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('canonical_subject_operations','canonical_subject_operation_authorities') THEN RAISE EXCEPTION 'canonical subject audit is immutable' USING ERRCODE='23514'; END IF; RETURN NEW; END $body$;"),
    ('change-trigger-definition', "DROP TRIGGER canonical_subject_attestations_validate ON canonical_subject_attestations;"
                                  "CREATE TRIGGER canonical_subject_attestations_validate AFTER INSERT OR UPDATE ON canonical_subject_attestations FOR EACH ROW EXECUTE FUNCTION canonical_subject_attestation_guard();"),
    ('change-column-nullability', "ALTER TABLE canonical_subject_operations ALTER COLUMN environment DROP NOT NULL;"),
    ('change-column-default', "ALTER TABLE canonical_subject_source_bindings ALTER COLUMN semantics DROP DEFAULT;"),
]


def drift_selftest(cluster, expected_entries, migration_sha256, server_version_num):
    """Apply each drift fixture in a fresh template-copy database and require DRIFT."""
    object_sets = expected_object_sets(expected_entries)
    expected_document = {'expectedEntries': expected_entries, 'objectSets': object_sets,
                         'generation': {'serverVersion': str(server_version_num),
                                        'serverVersionNum': int(server_version_num)}}
    constraints = [e for e in expected_entries if e['kind'] == 'constraint'
                   and e['table'] == 'identity_attestation_delegations' and e['type'] == 'c']
    if not constraints:
        raise RuntimeError('no check constraint found on identity_attestation_delegations for drift fixture')
    check_name = constraints[0]['name']
    fk_entries = [e for e in expected_entries if e['kind'] == 'constraint'
                  and e['table'] == 'identity_attestation_delegations' and e['type'] == 'f'
                  and e.get('foreignKey', {}).get('columns') == ['delegated_machine_principal_id']]
    if not fk_entries:
        raise RuntimeError('delegated_machine_principal_id FK not found for drift fixture')
    fk_name = fk_entries[0]['name']
    cluster.create_database('drift_seed', template='fingerprint')
    results = []
    for index, (name, template_sql) in enumerate(DRIFT_FIXTURES):
        db_name = f'drift_{index}'
        cluster.create_database(db_name, template='drift_seed')
        sql_text = template_sql.format(check_name=check_name, fk_name=fk_name)
        cluster.sql_exec(sql_text, database=db_name)
        verdict = classify(dict(cluster.env, PGDATABASE=db_name), expected_document, migration_sha256)
        ok = verdict['verdict'] == 'PARTIAL_OR_DRIFTED'
        results.append({'fixture': name, 'classifiedAs': verdict['verdict'],
                        'differingKeys': verdict.get('differingKeys', []),
                        'missingKeys': verdict.get('missingKeys', []), 'pass': ok})
        if not ok:
            raise RuntimeError(f'drift fixture {name} classified as {verdict["verdict"]}, expected PARTIAL_OR_DRIFTED')
    # NOT_INSTALLED control: a database with an existing (empty) shared prisma
    # ledger table but no target-migration row and no surface must classify
    # NOT_INSTALLED (regression: table existence is not ledger presence).
    cluster.create_database('ledger_only')
    cluster.sql_exec("""CREATE TABLE _prisma_migrations (id VARCHAR(36) NOT NULL PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL,
        logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_steps_count INTEGER NOT NULL DEFAULT 0)""", database='ledger_only')
    verdict = classify(dict(cluster.env, PGDATABASE='ledger_only'), expected_document, migration_sha256)
    control_ok = verdict['verdict'] == 'NOT_INSTALLED'
    if not control_ok:
        raise RuntimeError(f'empty-ledger control classified as {verdict["verdict"]}, expected NOT_INSTALLED')
    results.append({'fixture': 'empty-ledger-table-not-installed', 'classifiedAs': verdict['verdict'], 'pass': True})
    return {'fixtures': results, 'allPass': all(r['pass'] for r in results)}


def build_expected_document(repo_root, pg_bin, workdir, prisma_bin, with_drift_selftest=True):
    cluster = DisposableCluster(pg_bin, workdir)
    try:
        cluster.init()
        provenance = apply_chain(cluster, repo_root, ENROLLMENT_MIGRATION_NAME, prisma_bin, workdir)
        before = extract_surface(cluster.env)
        enrollment_path = Path(repo_root) / 'prisma' / 'migrations' / ENROLLMENT_MIGRATION_NAME / 'migration.sql'
        enrollment_bytes = enrollment_path.read_bytes()
        migration_sha256 = sha256_bytes(enrollment_bytes)
        cluster.sql_file(enrollment_path)
        after = extract_surface(cluster.env)
        expected_entries = delta_surface(before['entries'], after['entries'])
        if not expected_entries:
            raise RuntimeError('generated delta surface is empty')
        # Positive control: the exact post-migration surface must match the delta
        # entry-for-entry (the ledger check is production-specific and is emulated
        # by comparing surface entries directly here).
        exact_check = classify(cluster.env, {'expectedEntries': expected_entries,
                                             'objectSets': expected_object_sets(expected_entries),
                                             'generation': {'serverVersionNum': after['serverVersionNum']}},
                               migration_sha256)
        surface_exact = (exact_check['missingKeys'] == [] and exact_check['differingKeys'] == []
                         and exact_check['surfaceEntryCount'] == exact_check['expectedEntryCount'])
        drift_report = (drift_selftest(cluster, expected_entries, migration_sha256, after['serverVersionNum'])
                        if with_drift_selftest else None)
        return {
            'manifestType': 'EXPECTED_SCHEMA_FINGERPRINT_V1',
            'migrationName': ENROLLMENT_MIGRATION_NAME,
            'migrationSha256': migration_sha256,
            'expectedEntries': expected_entries,
            'expectedSurfaceDigest': surface_digest(expected_entries),
            'objectSets': expected_object_sets(expected_entries),
            'generation': {
                **provenance,
                'serverVersion': after['serverVersion'],
                'serverVersionNum': after['serverVersionNum'],
                'pgBin': str(pg_bin),
                'surfaceExactnessControl': 'PASS' if surface_exact else 'FAIL',
            },
            'driftSelftest': drift_report,
        }
    finally:
        cluster.stop()


def main(argv=None):
    parser = argparse.ArgumentParser(description='canonical enrollment schema fingerprint (Gate B)')
    parser.add_argument('--build-expected', action='store_true',
                        help='build the expected fingerprint document from a disposable cluster')
    parser.add_argument('--no-drift-selftest', action='store_true')
    parser.add_argument('--repo-root', default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument('--pg-bin', default='/opt/homebrew/opt/postgresql@16/bin')
    parser.add_argument('--prisma-bin', default='/opt/homebrew/bin/node')
    parser.add_argument('--workdir', default=None)
    parser.add_argument('--out', default=None)
    parser.add_argument('--classify', action='store_true', help='classify the database pointed to by PG* env')
    parser.add_argument('--expected-file', default=None)
    args = parser.parse_args(argv)

    if args.build_expected:
        workdir = Path(args.workdir or tempfile.mkdtemp(prefix='schema-fingerprint-'))
        workdir.mkdir(parents=True, exist_ok=True)
        prisma_cli = Path(args.repo_root) / 'node_modules' / '.bin' / 'prisma'
        if not prisma_cli.exists():
            parser.error(f'prisma CLI not found at {prisma_cli}')
        document = build_expected_document(args.repo_root, args.pg_bin, workdir, prisma_cli,
                                           with_drift_selftest=not args.no_drift_selftest)
        text = canonical_json(document) + '\n'
        if args.out:
            Path(args.out).write_text(text, encoding='utf-8')
        else:
            sys.stdout.write(text)
        return 0
    if args.classify:
        if not args.expected_file:
            parser.error('--classify requires --expected-file')
        document = json.loads(Path(args.expected_file).read_text(encoding='utf-8'))
        verdict = classify(dict(os.environ), document, document['migrationSha256'])
        sys.stdout.write(canonical_json(verdict) + '\n')
        return 0 if verdict['verdict'] in ('NOT_INSTALLED', 'EXACTLY_INSTALLED') else 2
    parser.print_usage()
    return 1


if __name__ == '__main__':
    sys.exit(main())
