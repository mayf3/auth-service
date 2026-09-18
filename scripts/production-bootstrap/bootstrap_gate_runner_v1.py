#!/usr/bin/env python3
"""Privileged bootstrap gate runner for
AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_PRODUCTION_BOOTSTRAP_V1.

Closes the three independent pre-mutation review blockers at the privileged
trust boundary:

  Gate A  BOOTSTRAP_EXECUTION_MANIFEST_V1 — the exact bootstrap packet boundary.
          The runner loads the execution manifest, verifies it against the
          owner-supplied anchor digest (--anchor-execution-manifest-sha256),
          re-derives every sealed coordinate itself (owner packet/decision/
          mandate digests, authority manifest digest, packet raw + canonical
          digests, the canonical 44-pair set digest, per-target transitions and
          expected prestates, migration digest, core config digest, expected
          schema fingerprint digest) and only then proceeds. Packet, pair and
          transition data are never taken from caller arguments.

  Gate B  complete schema fingerprint — NOT_INSTALLED / EXACTLY_INSTALLED /
          PARTIAL_OR_DRIFTED classification against the disposable-cluster-
          generated expectation (schema_fingerprint_v1.py).

  Gate C  EXECUTION_COMPONENT_MANIFEST_V1 — every execution-trusted component
          (runner anchored by reviewed git blob + clean worktree, TS host and
          its import closure, prisma package closure, lockfile, migration,
          packets, helpers, node/python/psql/git binaries) digest-verified
          immediately before any privileged action.

Privileged phases: preflight / install (Phase A) / plan (Phase B PLAN) /
apply (Phase B single SERIALIZABLE attempt + verify + readback) /
enrollment-plan (Phase C PLAN ONLY — there is deliberately no enrollment apply
mode in this runner).

The trust anchor of the execution manifest is the owner-issued single-line
command that carries --anchor-execution-manifest-sha256; receipts record it.
Every privileged phase requires root (euid 0) and writes root-owned receipts.
"""
import argparse
import hashlib
import ipaddress
import json
import os
import signal
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

REPO_ROOT = Path('/Users/yanfenma/workspace/project/.worktrees/auth-bootstrap-gates-v1')
PROTECTED_DIR = Path('/Users/yanfenma/.codex/identity-census/protected-closure-v1/canonical-subject-enrollment-production-bootstrap-20260918')
EXECUTION_MANIFEST_PATH = PROTECTED_DIR / 'BOOTSTRAP_EXECUTION_MANIFEST_V1.json'
COMPONENT_MANIFEST_PATH = PROTECTED_DIR / 'EXECUTION_COMPONENT_MANIFEST_V1.json'
RECEIPTS_DIR = PROTECTED_DIR / 'receipts'
ENV_FILE = Path('/Users/yanfenma/workspace/project/auth-service/.env')
SLOT = Path('/private/tmp/auth-service-production-mutation-slot-v1')
RUNNER_REPO_PATH = 'scripts/production-bootstrap/bootstrap_gate_runner_v1.py'

RUNNER_PATH = Path(__file__).resolve()


class Stop(Exception):
    pass


def emit(result, **kw):
    print(json.dumps({'result': result, **kw}, sort_keys=True, separators=(',', ':')))


def stop(code, **kw):
    emit('FAIL_BEFORE_MUTATION' if kw.pop('before_mutation', False) else 'STOP', code=code, **kw)
    raise SystemExit(2)


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha_file(path):
    return sha_bytes(Path(path).read_bytes())


def sha_text(text):
    return sha_bytes(text.encode('utf-8'))


def run(args, env=None, cwd=None, timeout=60, input_text=None):
    return subprocess.run([str(a) for a in args], env=env, cwd=cwd, timeout=timeout,
                          input=input_text, text=True, capture_output=True)


def git_repo(args):
    """git against the reviewed worktree; safe.directory for root execution."""
    return run(['/usr/bin/git', '-c', f'safe.directory={REPO_ROOT}', '-C', str(REPO_ROOT)] + args)

def install_signal_cleanup():
    class OperationalSignal(BaseException):
        pass
    def handler(signum, _frame):
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(sig, signal.SIG_IGN)
        raise OperationalSignal(f'OPERATION_INTERRUPTED_BY_SIGNAL_{signum}')
    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, handler)


# ---------------------------------------------------------------------------
# Gate C — component manifest verification
# ---------------------------------------------------------------------------

def dir_merkle(root):
    entries = []
    for base, dirs, files in os.walk(root):
        dirs.sort()
        for name in sorted(files):
            full = Path(base) / name
            rel = str(full.relative_to(root))
            if full.is_symlink():
                entries.append({'path': rel, 'symlinkTarget': os.readlink(full)})
            else:
                entries.append({'path': rel, 'sha256': sha_file(full), 'bytes': full.stat().st_size})
    entries.sort(key=lambda e: e['path'])
    return sha_bytes(canonical_json(entries).encode('utf-8'))


def check_no_world_writable_parents(path):
    current = Path(path).resolve()
    while True:
        mode = current.stat().st_mode
        if mode & stat.S_IWOTH:
            return False
        parent = current.parent
        if parent == current:
            return True
        current = parent


def verify_component_manifest(execution_manifest):
    failures = []
    manifest_path = COMPONENT_MANIFEST_PATH
    if sha_file(manifest_path) != execution_manifest['executionComponentManifestSha256']:
        return [f'COMPONENT_MANIFEST_DIGEST_MISMATCH expected={execution_manifest["executionComponentManifestSha256"]}']
    document = json.loads(manifest_path.read_text(encoding='utf-8'))
    for component in document['components']:
        role = component['role']
        kind = component['type']
        path = Path(component.get('linkPath') or component['path'])
        if kind == 'repoFile':
            repo_rel = component['repoRelative']
            blob = git_repo(['rev-parse', f'HEAD:{repo_rel}'])
            dirty = git_repo(['status', '--porcelain', '--', repo_rel])
            if blob.returncode != 0 or blob.stdout.strip() != component['blobSha']:
                failures.append(f'{role}: GIT_BLOB_MISMATCH')
            if dirty.returncode != 0 or dirty.stdout.strip():
                failures.append(f'{role}: WORKTREE_DIRTY_OR_UNCOMMITTED')
            if path.is_symlink() or not path.is_file() or sha_file(path) != component['sha256']:
                failures.append(f'{role}: FILE_DIGEST_MISMATCH')
            continue
        if kind == 'symlink':
            if not path.is_symlink():
                failures.append(f'{role}: EXPECTED_SYMLINK')
                continue
            resolved = Path(os.path.realpath(path))
            if str(resolved) != component['resolvedTarget']:
                failures.append(f'{role}: SYMLINK_TARGET_CHANGED')
                continue
            if sha_file(resolved) != component['targetSha256']:
                failures.append(f'{role}: TARGET_DIGEST_MISMATCH')
            continue
        if kind == 'dirMerkle':
            if not path.is_dir() or path.is_symlink():
                failures.append(f'{role}: DIR_MISSING_OR_SYMLINK')
                continue
            if dir_merkle(path) != component['digest']:
                failures.append(f'{role}: DIR_MERKLE_MISMATCH')
            continue
        if kind == 'file':
            if path.is_symlink():
                failures.append(f'{role}: UNEXPECTED_SYMLINK')
                continue
            if not path.is_file() or sha_file(path) != component['sha256']:
                failures.append(f'{role}: FILE_DIGEST_MISMATCH')
                continue
            if not check_no_world_writable_parents(path):
                failures.append(f'{role}: WORLD_WRITABLE_PARENT')
            continue
        failures.append(f'{role}: UNKNOWN_COMPONENT_TYPE_{kind}')
    # The running runner file itself must be exactly the committed reviewed bytes.
    runner_component = next((c for c in document['components'] if c['role'] == 'bootstrap_runner'), None)
    if runner_component:
        working = sha_file(RUNNER_PATH)
        blob_bytes = git_repo(['show', f'HEAD:{RUNNER_REPO_PATH}'])
        if blob_bytes.returncode != 0 or sha_bytes(blob_bytes.stdout.encode()) != working:
            failures.append('bootstrap_runner: RUNNING_BYTES_DIFFER_FROM_COMMITTED_BLOB')
    else:
        failures.append('bootstrap_runner: COMPONENT_ENTRY_MISSING')
    return failures


# ---------------------------------------------------------------------------
# Gate A — execution manifest + packet boundary
# ---------------------------------------------------------------------------

REQUIRED_EXECUTION_MANIFEST_KEYS = [
    'manifestType', 'environment', 'operationId', 'remoteMain',
    'authority', 'bootstrapPacket', 'pairSet', 'transition',
    'prestate', 'coreEvidence', 'schemaFingerprint', 'database',
    'enrollmentExpectations', 'executionComponentManifestSha256',
]


def verify_execution_manifest(execution_manifest):
    failures = []
    if execution_manifest.get('manifestType') != 'BOOTSTRAP_EXECUTION_MANIFEST_V1':
        failures.append('EXECUTION_MANIFEST_TYPE_MISMATCH')
    if execution_manifest.get('environment') != 'production':
        failures.append('ENVIRONMENT_NOT_PRODUCTION')
    for key in REQUIRED_EXECUTION_MANIFEST_KEYS:
        if key not in execution_manifest:
            failures.append(f'EXECUTION_MANIFEST_KEY_MISSING_{key}')
    authority = execution_manifest.get('authority', {})
    for key in ('ownerPacketSha256', 'ownerDecisionSha256', 'ownerExecutionMandateSha256',
                'bootstrapAuthorityManifestSha256'):
        if len(authority.get(key, '')) != 64:
            failures.append(f'AUTHORITY_COORDINATE_INCOMPLETE_{key}')
    for role in ('ownerPacket', 'ownerDecision', 'ownerExecutionMandate', 'bootstrapAuthorityManifest'):
        coordinate = authority.get(role, {})
        if not coordinate.get('path') or not Path(coordinate['path']).is_file():
            failures.append(f'AUTHORITY_ARTIFACT_MISSING_{role}')
            continue
        if sha_file(coordinate['path']) != coordinate['digest']:
            failures.append(f'AUTHORITY_ARTIFACT_DIGEST_DRIFT_{role}')
    packet = execution_manifest.get('bootstrapPacket', {})
    packet_raw = Path(packet.get('rawPath', ''))
    if not packet_raw.is_file():
        failures.append('BOOTSTRAP_PACKET_MISSING')
    else:
        if sha_file(packet_raw) != packet.get('rawSha256'):
            failures.append('BOOTSTRAP_PACKET_RAW_DIGEST_DRIFT')
        if packet.get('mutationCount') != len(execution_manifest.get('pairSet', {}).get('pairs', [])):
            failures.append('BOOTSTRAP_PACKET_MUTATION_COUNT_MISMATCH')
    fingerprint = execution_manifest.get('schemaFingerprint', {})
    if not fingerprint.get('expectedFile') or sha_file(fingerprint['expectedFile']['path']) != fingerprint['expectedFile'].get('sha256'):
        failures.append('EXPECTED_SCHEMA_FINGERPRINT_DIGEST_DRIFT')
    core = execution_manifest.get('coreEvidence', {})
    core_path = Path(core.get('configPath', ''))
    if not core_path.is_file():
        failures.append('CORE_CONFIG_MISSING')
    elif sha_file(core_path) != core.get('configSha256'):
        failures.append('CORE_CONFIG_DIGEST_DRIFT')
    else:
        try:
            config = json.loads(core_path.read_text(encoding='utf-8'))
            by_id = {}
            for agent in config.get('agents', []):
                by_id.setdefault(agent.get('id'), []).append(agent)
            duplicates = [agent_id for agent_id, defs in by_id.items() if len(defs) > 1]
            if duplicates:
                failures.append('CORE_CONFIG_DUPLICATE_AGENT_IDS')
            for pair in execution_manifest.get('pairSet', {}).get('pairs', []):
                defs = by_id.get(pair['canonicalAgentId'], [])
                enabled = [d for d in defs if d.get('disabled') is False]
                if len(enabled) != 1:
                    failures.append(f"CORE_DEFINITION_NOT_UNIQUE_ENABLED:{pair['canonicalAgentId']}")
        except (json.JSONDecodeError, KeyError):
            failures.append('CORE_CONFIG_UNPARSEABLE')
    pair_failure = verify_pair_set(execution_manifest)
    failures.extend(pair_failure)
    packet_failure = verify_packet_against_manifest(execution_manifest) if packet_raw.is_file() else ['BOOTSTRAP_PACKET_MISSING']
    failures.extend(packet_failure)
    return failures


def pairs_encoding(pairs):
    return canonical_json([[pair['machinePrincipalId'], pair['canonicalAgentId']] for pair in pairs])


def verify_pair_set(execution_manifest, expected_count=44):
    failures = []
    pair_set = execution_manifest.get('pairSet', {})
    pairs = pair_set.get('pairs', [])
    if pair_set.get('count') != expected_count or len(pairs) != expected_count:
        failures.append(f'PAIR_SET_COUNT_NOT_{expected_count}')
        return failures
    if pairs_encoding(pairs) != pair_set.get('canonicalEncoding'):
        failures.append('PAIR_SET_CANONICAL_ENCODING_MISMATCH')
    if sha_text(pairs_encoding(pairs)) != pair_set.get('digest'):
        failures.append('PAIR_SET_DIGEST_MISMATCH')
    principal_ids = [pair['machinePrincipalId'] for pair in pairs]
    if len(set(principal_ids)) != len(principal_ids):
        failures.append('PAIR_SET_DUPLICATE_PRINCIPAL')
    agent_ids = [pair['canonicalAgentId'] for pair in pairs]
    if len(set(agent_ids)) != len(agent_ids):
        failures.append('PAIR_SET_DUPLICATE_AGENT_ID')
    return failures


def verify_packet_against_manifest(execution_manifest):
    """Packet boundary: pair set, transitions, prestates, ids — from packet bytes."""
    failures = []
    packet = json.loads(Path(execution_manifest['bootstrapPacket']['rawPath']).read_text(encoding='utf-8'))
    manifest_pairs = execution_manifest['pairSet']['pairs']
    if packet.get('operationId') != execution_manifest['operationId']:
        failures.append('PACKET_OPERATION_ID_MISMATCH')
    if packet.get('environment') != 'production':
        failures.append('PACKET_ENVIRONMENT_NOT_PRODUCTION')
    mutations = packet.get('mutations', [])
    if len(mutations) != len(manifest_pairs):
        failures.append('PACKET_MUTATION_COUNT_MISMATCH')
        return failures
    manifest_by_principal = {pair['machinePrincipalId']: pair for pair in manifest_pairs}
    seen_principals = set()
    expected_prestate = execution_manifest['prestate']
    transition = execution_manifest['transition']
    for mutation in mutations:
        if mutation.get('operation') != 'TRANSITION_AGENT_LIFECYCLE':
            failures.append('PACKET_NON_LIFECYCLE_MUTATION')
            continue
        if mutation.get('toState') != transition.get('toState'):
            failures.append('PACKET_TRANSITION_TOSTATE_MISMATCH')
        principal_id = mutation.get('principalId')
        if principal_id in seen_principals:
            failures.append('PACKET_DUPLICATE_TARGET')
        seen_principals.add(principal_id)
        pair = manifest_by_principal.get(principal_id)
        if not pair:
            failures.append(f'PACKET_TARGET_NOT_IN_MANIFEST:{principal_id}')
            continue
        if mutation.get('canonicalAgentId') != pair['canonicalAgentId']:
            failures.append(f'PACKET_AGENT_ID_MISMATCH:{principal_id}')
        if mutation.get('fromState') != pair.get('expectedPrestate'):
            failures.append(f'PACKET_PRESTATE_MISMATCH:{principal_id}')
        expected_revision = expected_prestate['expectedRevisionByState'].get(pair.get('expectedPrestate'))
        if mutation.get('expectedRevision') != expected_revision:
            failures.append(f'PACKET_EXPECTED_REVISION_MISMATCH:{principal_id}')
    for pair in manifest_pairs:
        if pair['machinePrincipalId'] not in seen_principals:
            failures.append(f"PACKET_TARGET_MISSING:{pair['machinePrincipalId']}")
    return failures


# ---------------------------------------------------------------------------
# Database access
# ---------------------------------------------------------------------------

def database_url():
    for raw in ENV_FILE.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            if key.strip() == 'DATABASE_URL':
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                    value = value[1:-1]
                return value
    stop('DATABASE_URL_MISSING')


FROZEN_DATABASE_URL = None


def pg_env(url):
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env.update({
        'PATH': '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        'PGHOST': parsed.hostname or '', 'PGPORT': str(parsed.port or 5432),
        'PGDATABASE': unquote(parsed.path.lstrip('/')),
        'PGUSER': unquote(parsed.username or ''), 'PGPASSWORD': unquote(parsed.password or ''),
        'PGCONNECT_TIMEOUT': '5',
    })
    if 'sslmode' in query:
        env['PGSSLMODE'] = query['sslmode'][0]
    return env


def normalize_exact_loopback(raw):
    try:
        if '/' in raw:
            interface = ipaddress.ip_interface(raw)
            if interface.network.prefixlen != interface.max_prefixlen:
                return None
            address = interface.ip
        else:
            address = ipaddress.ip_address(raw)
        return str(address) if address.is_loopback else None
    except ValueError:
        return None


def sql(env, query, timeout=30, expect=True):
    result = run(['psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], env=env, timeout=timeout)
    if expect and result.returncode:
        stop('SQL_FAILED', stderr=result.stderr.strip().splitlines()[-1:])
    return result


def jsql(env, query, timeout=30):
    return json.loads(sql(env, query, timeout=timeout).stdout)


def verify_connection_identity(env, database):
    proof = jsql(env, "SELECT json_build_object('database',current_database(),'schema',current_schema(),'role',current_user,'server_addr',inet_server_addr()::text,'server_port',inet_server_port())")
    normalized = normalize_exact_loopback(proof['server_addr'] or '')
    if (proof['database'] != database['name'] or proof['schema'] != 'public'
            or proof['role'] != database['role'] or proof['server_port'] != database['port']
            or normalized not in ('127.0.0.1', '::1')):
        stop('FROZEN_CONNECTION_IDENTITY_NOT_EXACT', proof=proof)
    return proof


def verify_remote_main(expected, strict=True):
    """Strict freeze for the DDL phase; bounded-impact record for later phases.

    On non-strict drift the observed head is returned so the caller records it
    and the operator can perform the bounded impact review (unrelated main
    drift does not reopen the program; enrollment-surface drift does).
    """
    live = run(['/usr/bin/git', 'ls-remote', 'https://github.com/mayf3/auth-service.git', 'refs/heads/main'], timeout=30)
    head = live.stdout.split()[0] if live.returncode == 0 and live.stdout.split() else ''
    if head == expected:
        return {'remoteMain': head, 'drift': False}
    if strict:
        stop('REMOTE_MAIN_DRIFT', observed=head, expected=expected)
    return {'remoteMain': head, 'drift': True, 'expected': expected}


# ---------------------------------------------------------------------------
# Protected business-state snapshot
# ---------------------------------------------------------------------------

GRANT_CENSUS_QUERY = """
WITH grant_rows AS (
 SELECT 'human_audience_grants' source, human_client_id::text||E'\\x1f'||audience_id row_key, to_jsonb(x) payload FROM human_audience_grants x
 UNION ALL
 SELECT 'machine_access_grants', machine_client_id::text||E'\\x1f'||audience_id, to_jsonb(x) FROM machine_access_grants x
 UNION ALL
 SELECT 'delegation_grants', trusted_proxy_id::text||E'\\x1f'||audience_id, to_jsonb(x) FROM delegation_grants x
 UNION ALL
 SELECT 'grant_change_audits', change_id::text, to_jsonb(x) FROM grant_change_audits x
)
SELECT json_build_object(
 'row_count',count(*),
 'state_digest',md5(COALESCE(string_agg(source||E'\\x1e'||row_key||E'\\x1e'||payload::text,E'\\n' ORDER BY source,row_key),'')),
 'per_source',json_build_object(
   'human_audience_grants',(SELECT count(*) FROM human_audience_grants),
   'machine_access_grants',(SELECT count(*) FROM machine_access_grants),
   'delegation_grants',(SELECT count(*) FROM delegation_grants),
   'grant_change_audits',(SELECT count(*) FROM grant_change_audits))
) FROM grant_rows;
"""

PROTECTED_QUERIES = {
    'machine_client_count': 'SELECT count(*) FROM machine_clients',
    'machine_client_business_digest': "SELECT md5(COALESCE(string_agg(md5((to_jsonb(x)-'secret_hash')::text),',' ORDER BY id::text),'')) FROM machine_clients x",
    'secret_state_digest': "SELECT md5(COALESCE(string_agg(id::text||':'||md5(secret_hash),',' ORDER BY id::text),'')) FROM machine_clients",
    'rotated_at_state_digest': "SELECT md5(COALESCE(string_agg(id::text||':'||COALESCE(rotated_at::text,'NULL'),',' ORDER BY id::text),'')) FROM machine_clients",
    'principal_count': 'SELECT count(*) FROM machine_principals',
    'principal_digest': "SELECT md5(COALESCE(string_agg(md5(to_jsonb(x)::text),',' ORDER BY id::text),'')) FROM machine_principals x",
    'user_count': 'SELECT count(*) FROM users',
    'user_digest': "SELECT md5(COALESCE(string_agg(md5(to_jsonb(x)::text),',' ORDER BY id::text),'')) FROM users x",
}

ENROLLMENT_TABLES = ['canonical_subject_attestations', 'canonical_subject_operation_authorities',
                     'canonical_subject_operations', 'canonical_subject_source_bindings',
                     'identity_attestation_delegations']


def protected_snapshot(env):
    document = jsql(env, """
SELECT json_build_object(
 'database',current_database(),'current_schema',current_schema(),'server_addr',inet_server_addr()::text,
 'server_port',inet_server_port(),'application_role',current_user,
 'lifecycle_count',(SELECT count(*) FROM agent_identity_lifecycle),
 'successor_count',(SELECT count(*) FROM agent_identity_successors),
 'other_active_mutation_queries',(SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND datname=current_database() AND state='active' AND query~*'\\s*(insert|update|delete|alter|create|drop|truncate|grant|revoke|comment|vacuum|reindex)'),
 'other_active_transactions',(SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND datname=current_database() AND xact_start IS NOT NULL)
);
""")
    for key, query in PROTECTED_QUERIES.items():
        result = sql(env, query, expect=False)
        document[key] = result.stdout.strip() if result.returncode == 0 else None
    grants = jsql(env, GRANT_CENSUS_QUERY)
    document['grant_count'] = str(grants['row_count'])
    document['grant_digest'] = grants['state_digest']
    document['grant_per_source'] = grants['per_source']
    document['enrollment_table_counts'] = {}
    for table in ENROLLMENT_TABLES:
        exists = sql(env, f"SELECT to_regclass('public.{table}') IS NOT NULL", expect=False).stdout.strip()
        document['enrollment_table_counts'][table] = sql(env, f'SELECT count(*) FROM {table}').stdout.strip() if exists == 't' else None
    return normalize_snapshot_counts(document)


def normalize_snapshot_counts(document):
    """Foundation counts arrive as JSON numbers (json_build_object count(*));
    every phase compares them against the string vocabulary ('0', '44').
    Coerce at the source so int-vs-string can never invert a gate (regression
    for the r4 drill preflight false-STOP)."""
    document['lifecycle_count'] = None if document.get('lifecycle_count') is None else str(document['lifecycle_count'])
    document['successor_count'] = None if document.get('successor_count') is None else str(document['successor_count'])
    return document


PROTECTED_EQUAL_KEYS = ['machine_client_count', 'machine_client_business_digest', 'secret_state_digest',
                        'rotated_at_state_digest', 'principal_count', 'principal_digest', 'user_count',
                        'user_digest', 'grant_count', 'grant_digest']


def protected_equal(a, b):
    return {key: a.get(key) == b.get(key) for key in PROTECTED_EQUAL_KEYS}


# ---------------------------------------------------------------------------
# Gate B — schema classification
# ---------------------------------------------------------------------------

def classify_schema(env, execution_manifest):
    import schema_fingerprint_v1  # sealed component, loaded from the reviewed tree
    fingerprint_path = execution_manifest['schemaFingerprint']['expectedFile']['path']
    document = json.loads(Path(fingerprint_path).read_text(encoding='utf-8'))
    verdict = schema_fingerprint_v1.classify(env, document, document['migrationSha256'])
    if verdict['verdict'] not in ('NOT_INSTALLED', 'EXACTLY_INSTALLED', 'PARTIAL_OR_DRIFTED'):
        stop('SCHEMA_CLASSIFIER_INVALID', verdict=verdict)
    return verdict


def evaluate_target_rows(rows, expected_revision_by_state):
    """Pure per-row prestate evaluation (unit-tested by the selftest fixtures).

    Database "no lifecycle row" is SQL NULL; the authority/manifest vocabulary
    (and the accepted implementation: current?.state ?? 'absent') names it
    'absent'. Lifecycle revisions arrive as JSON numbers and are compared as
    strings against the manifest's expected-revision vocabulary.
    """
    issues = []
    for row in rows:
        pid = row['principalId']
        observed_state = row['lifecycleState'] if row['lifecycleState'] is not None else 'absent'
        observed_revision = None if row['lifecycleRevision'] is None else str(row['lifecycleRevision'])
        if not row['exists']:
            issues.append({'principalId': pid, 'code': 'TARGET_NOT_FOUND'})
        elif row['principalType'] != 'agent':
            issues.append({'principalId': pid, 'code': 'TARGET_TYPE_MISMATCH'})
        elif row['status'] != 'active':
            issues.append({'principalId': pid, 'code': 'TARGET_INACTIVE'})
        elif row['storedAgentId'] != row['canonicalAgentId']:
            issues.append({'principalId': pid, 'code': 'TARGET_PAIR_MISMATCH'})
        elif observed_state != row['expectedPrestate']:
            issues.append({'principalId': pid, 'code': 'LIFECYCLE_PRESTATE_CONFLICT', 'observed': observed_state})
        elif observed_state != 'absent' and observed_revision != expected_revision_by_state.get(observed_state):
            issues.append({'principalId': pid, 'code': 'LIFECYCLE_REVISION_CONFLICT', 'observed': observed_revision})
        elif row['outgoingSuccessor']:
            issues.append({'principalId': pid, 'code': 'OUTGOING_SUCCESSOR'})
    return issues


def target_state(env, execution_manifest):
    pairs = execution_manifest['pairSet']['pairs']
    values = json.dumps([{'principal_id': p['machinePrincipalId'], 'canonical_agent_id': p['canonicalAgentId'],
                          'expected_prestate': p['expectedPrestate']} for p in pairs], separators=(',', ':'))
    rows = jsql(env, f"""
WITH wanted AS (SELECT * FROM json_to_recordset($j${values}$j$::json) AS x(principal_id uuid,canonical_agent_id text,expected_prestate text))
SELECT json_agg(json_build_object('principalId',w.principal_id::text,'canonicalAgentId',w.canonical_agent_id,'expectedPrestate',w.expected_prestate,
 'exists',p.id IS NOT NULL,'principalType',p.principal_type::text,'status',p.status::text,'storedAgentId',p.agent_id,
 'lifecycleState',l.state::text,'lifecycleRevision',l.revision::text,
 'outgoingSuccessor',EXISTS(SELECT 1 FROM agent_identity_successors s WHERE s.source_principal_id=w.principal_id)) ORDER BY w.principal_id)
FROM wanted w LEFT JOIN machine_principals p ON p.id=w.principal_id LEFT JOIN agent_identity_lifecycle l ON l.principal_id=w.principal_id
""") or []
    issues = evaluate_target_rows(rows, execution_manifest['prestate']['expectedRevisionByState'])
    return {'targetCount': len(rows), 'issues': issues}


def verify_core_evidence(execution_manifest):
    core_path = Path(execution_manifest['coreEvidence']['configPath'])
    if sha_file(core_path) != execution_manifest['coreEvidence']['configSha256']:
        stop('CORE_CONFIG_DIGEST_DRIFT')


# ---------------------------------------------------------------------------
# Receipts
# ---------------------------------------------------------------------------

def require_root():
    if os.geteuid() != 0:
        stop('PRIVILEGED_PHASE_REQUIRES_ROOT')


def write_receipt(name, payload):
    require_root()
    if not RECEIPTS_DIR.exists():
        RECEIPTS_DIR.mkdir(mode=0o755, parents=False)
    st = RECEIPTS_DIR.lstat()
    if RECEIPTS_DIR.is_symlink() or not RECEIPTS_DIR.is_dir() or st.st_uid != 0 or (st.st_mode & 0o777) != 0o755:
        stop('RECEIPT_TRUST_BOUNDARY_INVALID', uid=st.st_uid, mode=oct(st.st_mode & 0o777))
    core = canonical_json(payload).encode()
    wrapped = {'payload': payload, 'sha256': sha_bytes(core)}
    fd, tmp = tempfile.mkstemp(prefix=f'.{name}.', dir=str(RECEIPTS_DIR))
    os.close(fd)
    data = (canonical_json(wrapped) + '\n').encode()
    with open(tmp, 'wb') as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(tmp, 0o644)
    path = RECEIPTS_DIR / f'{name}.json'
    os.replace(tmp, path)
    return {'path': str(path), 'sha256': wrapped['sha256']}


# ---------------------------------------------------------------------------
# Gate chain + phases
# ---------------------------------------------------------------------------

def verify_all_gates(execution_manifest):
    component_failures = verify_component_manifest(execution_manifest)
    if component_failures:
        stop('EXECUTION_COMPONENT_CLOSURE_FAILED', failures=component_failures[:20], before_mutation=True)
    manifest_failures = verify_execution_manifest(execution_manifest)
    if manifest_failures:
        stop('BOOTSTRAP_PACKET_BOUNDARY_FAILED', failures=manifest_failures[:20], before_mutation=True)


def load_execution_manifest(anchor):
    if not EXECUTION_MANIFEST_PATH.is_file():
        stop('EXECUTION_MANIFEST_MISSING')
    observed = sha_file(EXECUTION_MANIFEST_PATH)
    if observed != anchor:
        stop('EXECUTION_MANIFEST_ANCHOR_MISMATCH', expected=anchor, observed=observed, before_mutation=True)
    return json.loads(EXECUTION_MANIFEST_PATH.read_text(encoding='utf-8'))


def host_environment(execution_manifest):
    env = {k: v for k, v in os.environ.items()}
    env.update({
        'PATH': '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        'DATABASE_URL': FROZEN_DATABASE_URL,
        'HOME': os.environ.get('HOME', '/var/root'),
    })
    return env


def run_host(execution_manifest, command, output_path, packet_path, plan_path=None):
    component_manifest = json.loads(COMPONENT_MANIFEST_PATH.read_text(encoding='utf-8'))
    roles = {c['role']: c for c in component_manifest['components']}
    node_bin = roles['runtimes_node']['path'] if 'runtimes_node' in roles else component_manifest['runtimes']['node']['path']
    host_entry = roles['bootstrap_host']['path']
    tsx_cli = roles['tsx_cli_entry']['path']
    args = [node_bin, tsx_cli, host_entry, command, packet_path, output_path]
    if plan_path:
        args.append(plan_path)
    result = run(args, env=host_environment(execution_manifest), cwd=str(REPO_ROOT), timeout=180)
    return result


def acquire_slot():
    if SLOT.exists():
        stop('PRODUCTION_MUTATION_SLOT_BUSY')
    SLOT.mkdir()
    st = SLOT.lstat()
    if st.st_uid != os.geteuid():
        stop('PRODUCTION_MUTATION_SLOT_NOT_OURS')


def release_slot():
    try:
        SLOT.rmdir()
    except OSError:
        pass


def parse_host_import(summary_line, canonical_file_bytes):
    """Pure parser for the host import result (unit-tested by the selftest).

    The host summary line carries {result, outputPath, outputSha256,
    packetDigest, operationId}; the mutation count comes from the canonical
    packet file the host wrote (summary outputSha256 must equal the file
    digest, binding the two together).
    """
    payload = json.loads(summary_line)
    if payload.get('result') != 'PASS':
        return None
    if payload.get('outputSha256') != sha_bytes(canonical_file_bytes):
        return None
    canonical = json.loads(canonical_file_bytes.decode('utf-8'))
    return {'packetDigest': payload['packetDigest'], 'operationId': payload['operationId'],
            'mutationCount': len(canonical.get('mutations', []))}


def canonical_packet_digest_from_host(execution_manifest, packet_path):
    """Import via the accepted implementation; the canonical digest authority."""
    out = PROTECTED_DIR / f'.host-import-{datetime.now(timezone.utc).strftime("%H%M%S%f")}.json'
    result = run_host(execution_manifest, 'import', str(out), packet_path)
    summary_line = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''
    payload = None
    try:
        payload = parse_host_import(summary_line, out.read_bytes()) if out.exists() else None
    except (json.JSONDecodeError, KeyError, UnicodeDecodeError):
        payload = None
    finally:
        out.unlink(missing_ok=True)
    if result.returncode != 0 or not payload:
        stop('HOST_IMPORT_FAILED', stderr=result.stderr.strip().splitlines()[-1:], stdout=result.stdout[:400])
    return payload


def phase_preflight(args):
    execution_manifest = load_execution_manifest(args.anchor_execution_manifest_sha256)
    verify_all_gates(execution_manifest)
    verify_remote_main(execution_manifest['remoteMain'])
    database = execution_manifest['database']
    env = pg_env(FROZEN_DATABASE_URL)
    verify_connection_identity(env, database)
    schema = classify_schema(env, execution_manifest)
    targets = target_state(env, execution_manifest)
    snapshot = protected_snapshot(env)
    slot_free = not SLOT.exists()
    ok = (not targets['issues'] and targets['targetCount'] == 44
          and snapshot['lifecycle_count'] == '0' and snapshot['successor_count'] == '0' and slot_free)
    receipt = write_receipt('bootstrap-preflight-v2', {
        'anchor': args.anchor_execution_manifest_sha256, 'remoteMain': execution_manifest['remoteMain'],
        'schema': schema, 'targets': targets, 'protected': snapshot, 'slotFree': slot_free,
        'gitHead': git_repo(['rev-parse', 'HEAD']).stdout.strip(),
    })
    if not ok:
        stop('PREFLIGHT_GATE_FAILED', targetIssues=targets['issues'], lifecycle=snapshot['lifecycle_count'],
             successor=snapshot['successor_count'], slotFree=slot_free, receipt=receipt)
    emit('PASS', receipt=receipt, schemaState=schema['verdict'], targetCount=targets['targetCount'],
         targetIssues=0, lifecycleRows=snapshot['lifecycle_count'], successorRows=snapshot['successor_count'])


def phase_install(args):
    execution_manifest = load_execution_manifest(args.anchor_execution_manifest_sha256)
    verify_all_gates(execution_manifest)
    verify_remote_main(execution_manifest['remoteMain'])
    env = pg_env(FROZEN_DATABASE_URL)
    verify_connection_identity(env, execution_manifest['database'])
    before = classify_schema(env, execution_manifest)
    targets = target_state(env, execution_manifest)
    snapshot = protected_snapshot(env)
    if before['verdict'] == 'EXACTLY_INSTALLED':
        counts = snapshot['enrollment_table_counts']
        if any(value != '0' for value in counts.values()):
            stop('ENROLLMENT_TABLES_NOT_EMPTY_ON_EXACT_INSTALL', counts=counts)
        receipt = write_receipt('enrollment-persistence-install-v2', {
            'mode': 'NOOP_EXACTLY_INSTALLED', 'prestate': before, 'protected': snapshot,
            'automaticEnrollmentRows': 0, 'productionEnrollmentApplied': 'NO',
        })
        emit('PASS', mode='NOOP', schemaState=before['verdict'], receipt=receipt)
        return
    if before['verdict'] != 'NOT_INSTALLED':
        stop('ENROLLMENT_PERSISTENCE_PRESTATE_NOT_NOT_INSTALLED', prestate=before['verdict'])
    if targets['issues'] or targets['targetCount'] != 44:
        stop('TARGET_PREFLIGHT_FAILED', issues=targets['issues'])
    if snapshot['lifecycle_count'] != '0' or snapshot['successor_count'] != '0':
        stop('FOUNDATION_PRESTATE_DRIFT')
    if snapshot['other_active_mutation_queries'] != 0 or snapshot['other_active_transactions'] != 0:
        stop('DB_MUTATION_SLOT_BUSY')
    applied = {line for line in sql(env, "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL").stdout.splitlines() if line}
    migrations_dir = REPO_ROOT / 'prisma' / 'migrations'
    dirs = {p.name for p in migrations_dir.iterdir() if p.is_dir()}
    migration_name = execution_manifest['schemaFingerprint']['migrationName']
    if dirs - applied != {migration_name}:
        stop('PENDING_MIGRATION_SET_MISMATCH', pending=sorted(dirs - applied))
    acquire_slot()
    try:
        component_manifest = json.loads(COMPONENT_MANIFEST_PATH.read_text(encoding='utf-8'))
        roles = {c['role']: c for c in component_manifest['components']}
        node_bin = component_manifest['runtimes']['node']['path']
        prisma_link = next(c for c in component_manifest['components'] if c['role'] == 'prisma_bin_link')
        env_deploy = dict(env)
        env_deploy['DATABASE_URL'] = FROZEN_DATABASE_URL
        result = run([node_bin, prisma_link['resolvedTarget'], 'migrate', 'deploy', '--schema',
                      str(REPO_ROOT / 'prisma' / 'schema.prisma')],
                     env=env_deploy, cwd=str(REPO_ROOT), timeout=180)
        after = classify_schema(env, execution_manifest)
        post_snapshot = protected_snapshot(env)
        unchanged = protected_equal(snapshot, post_snapshot)
        zero = all(value == '0' for value in post_snapshot['enrollment_table_counts'].values())
        ok = (result.returncode == 0 and after['verdict'] == 'EXACTLY_INSTALLED' and zero
              and all(unchanged.values()) and post_snapshot['lifecycle_count'] == '0'
              and post_snapshot['successor_count'] == '0')
        receipt = write_receipt('enrollment-persistence-install-v2', {
            'mode': 'EMPTY_INSTALL', 'commandExit': result.returncode,
            'stdoutTail': result.stdout.splitlines()[-10:], 'stderrTail': result.stderr.splitlines()[-10:],
            'prestate': before, 'poststate': after, 'protectedBefore': snapshot,
            'protectedAfter': post_snapshot, 'protectedUnchanged': unchanged,
            'automaticEnrollmentRows': 0 if zero else None,
            'productionEnrollmentApplied': 'NO',
        })
        if not ok:
            stop('ENROLLMENT_PERSISTENCE_POSTSTATE_FAILED', receipt=receipt)
        emit('PASS', mode='EMPTY_INSTALL', schemaState=after['verdict'], receipt=receipt,
             counts=post_snapshot['enrollment_table_counts'], protectedUnchanged=unchanged)
    finally:
        release_slot()


def phase_plan(args):
    execution_manifest = load_execution_manifest(args.anchor_execution_manifest_sha256)
    verify_all_gates(execution_manifest)
    remote = verify_remote_main(execution_manifest['remoteMain'], strict=False)
    env = pg_env(FROZEN_DATABASE_URL)
    verify_connection_identity(env, execution_manifest['database'])
    schema = classify_schema(env, execution_manifest)
    if schema['verdict'] != 'EXACTLY_INSTALLED':
        stop('ENROLLMENT_SCHEMA_NOT_EXACTLY_INSTALLED', schemaState=schema['verdict'])
    targets = target_state(env, execution_manifest)
    if targets['issues'] or targets['targetCount'] != 44:
        stop('TARGET_PREFLIGHT_FAILED', issues=targets['issues'])
    snapshot = protected_snapshot(env)
    if snapshot['lifecycle_count'] != '0' or snapshot['successor_count'] != '0':
        stop('FOUNDATION_PRESTATE_DRIFT')
    packet_path = execution_manifest['bootstrapPacket']['rawPath']
    import_payload = canonical_packet_digest_from_host(execution_manifest, packet_path)
    if import_payload['packetDigest'] != execution_manifest['bootstrapPacket']['canonicalDigest']:
        stop('BOOTSTRAP_PACKET_CANONICAL_DIGEST_DRIFT', observed=import_payload['packetDigest'], before_mutation=True)
    if import_payload['mutationCount'] != 44:
        stop('BOOTSTRAP_PACKET_MUTATION_COUNT_DRIFT', before_mutation=True)
    acquire_slot()
    try:
        plan_out = PROTECTED_DIR / 'BOOTSTRAP_PLAN_V1.json'
        if plan_out.exists():
            stop('PLAN_ARTIFACT_ALREADY_EXISTS', path=str(plan_out))
        result = run_host(execution_manifest, 'plan', str(plan_out), packet_path)
        if result.returncode != 0:
            stop('HOST_PLAN_FAILED', stderr=result.stderr.strip().splitlines()[-1:], stdout=result.stdout[:400])
        plan = json.loads(plan_out.read_text(encoding='utf-8'))
        counts = plan.get('mutationCounts', {})
        if counts != {'TRANSITION_AGENT_LIFECYCLE': 44}:
            stop('PLAN_MUTATION_COUNTS_UNEXPECTED', counts=counts)
        pairs = sorted([[m['principalId'], m['canonicalAgentId']] for m in plan['mutations']])
        if pairs_encoding([{'machinePrincipalId': p, 'canonicalAgentId': a} for p, a in pairs]) != \
                execution_manifest['pairSet']['canonicalEncoding']:
            stop('PLAN_PAIRS_DRIFT', before_mutation=True)
        if plan.get('disposition') != 'APPLY':
            stop('PLAN_DISPOSITION_UNEXPECTED', disposition=plan.get('disposition'))
        os.chmod(plan_out, 0o644)
        receipt = write_receipt('bootstrap-plan-v1', {
            'anchor': args.anchor_execution_manifest_sha256,
            'operationId': plan['operationId'], 'planDigest': plan['planDigest'],
            'prestateDigest': plan['prestateDigest'],
            'expectedPoststateDigest': plan['expectedPoststateDigest'],
            'authorityManifestDigest': plan['authorityManifestDigest'],
            'packetDigest': plan['packetDigest'],
            'coreEvidenceDigests': plan['coreEvidenceDigests'],
            'mutationCounts': counts, 'hostImport': import_payload,
            'planArtifact': {'path': str(plan_out), 'sha256': sha_file(plan_out)},
            'remoteMainObservation': remote,
            'gitHead': git_repo(['rev-parse', 'HEAD']).stdout.strip(),
        })
        emit('PASS', receipt=receipt, planDigest=plan['planDigest'], prestateDigest=plan['prestateDigest'])
    finally:
        release_slot()


def evaluate_apply_poststate(enrollment_table_counts, audit_rows, plan):
    """Pure Phase B poststate evaluation (selftest fixture S/H coverage).

    Phase A requires all five enrollment tables empty; Phase B's accepted APPLY
    additionally writes exactly ONE canonical_subject_operations audit row for
    this exact plan (runbook Phase B.5 / Permitted Effects #2). The four
    business tables must remain zero.
    """
    business_tables = ['canonical_subject_attestations', 'canonical_subject_source_bindings',
                       'canonical_subject_operation_authorities', 'identity_attestation_delegations']
    business_zero = all(enrollment_table_counts.get(t) == '0' for t in business_tables)
    audit_rows = audit_rows or []
    audit_exact = False
    if len(audit_rows) == 1:
        row = audit_rows[0]
        audit_exact = (row.get('operationId') == plan['operationId']
                       and row.get('planDigest') == plan['planDigest']
                       and row.get('poststateDigest') == plan['expectedPoststateDigest']
                       and canonical_json(row.get('mutationCounts')) == canonical_json(plan['mutationCounts']))
    return {'businessTablesZero': business_zero,
            'operationAuditCount': len(audit_rows),
            'operationAuditExact': audit_exact,
            'operationsTableCount': enrollment_table_counts.get('canonical_subject_operations')}


def as_rows(value):
    """psql -A -t prints a json_agg column as the bare JSON array (no wrapper
    object); normalize both shapes (regression for the r7 drill TypeError)."""
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return value.get('rows', [])
    return []


def committed_operation(env, operation_id):
    exists = sql(env, "SELECT to_regclass('public.canonical_subject_operations') IS NOT NULL", expect=False).stdout.strip()
    if exists != 't':
        return []
    return as_rows(jsql(env, f"""
SELECT COALESCE(json_agg(row_to_json(l)),'[]'::json) AS rows FROM (
  SELECT operation_id::text AS "operationId", plan_digest AS "planDigest",
         poststate_digest AS "poststateDigest", mutation_counts AS "mutationCounts"
  FROM canonical_subject_operations WHERE operation_id='{operation_id}'::uuid
) l"""))


def phase_apply(args):
    execution_manifest = load_execution_manifest(args.anchor_execution_manifest_sha256)
    verify_all_gates(execution_manifest)
    remote = verify_remote_main(execution_manifest['remoteMain'], strict=False)
    env = pg_env(FROZEN_DATABASE_URL)
    verify_connection_identity(env, execution_manifest['database'])
    schema = classify_schema(env, execution_manifest)
    if schema['verdict'] != 'EXACTLY_INSTALLED':
        stop('ENROLLMENT_SCHEMA_NOT_EXACTLY_INSTALLED', schemaState=schema['verdict'])
    plan_out = PROTECTED_DIR / 'BOOTSTRAP_PLAN_V1.json'
    plan_receipt_path = RECEIPTS_DIR / 'bootstrap-plan-v1.json'
    if not plan_out.is_file() or not plan_receipt_path.is_file():
        stop('REVIEWED_PLAN_ARTIFACT_MISSING')
    plan = json.loads(plan_out.read_text(encoding='utf-8'))
    plan_receipt = json.loads(plan_receipt_path.read_text(encoding='utf-8'))['payload']
    if sha_file(plan_out) != plan_receipt['planArtifact']['sha256']:
        stop('PLAN_ARTIFACT_DIGEST_DRIFT', before_mutation=True)
    if plan['planDigest'] != plan_receipt['planDigest'] or plan['prestateDigest'] != plan_receipt['prestateDigest']:
        stop('PLAN_RECEIPT_MISMATCH', before_mutation=True)
    # Reconciliation first: if the exact operation is already committed with the
    # reviewed planDigest and expected poststate, the outcome is KNOWN — confirm
    # by exact operation id + durable poststate, never blindly replay.
    prior = committed_operation(env, execution_manifest['operationId'])
    reconcile = bool(prior)
    if reconcile and (len(prior) != 1 or prior[0]['planDigest'] != plan['planDigest']):
        stop('COMMITTED_OPERATION_CONFLICT', prior=prior)
    snapshot = protected_snapshot(env)
    if not reconcile:
        targets = target_state(env, execution_manifest)
        if targets['issues'] or targets['targetCount'] != 44:
            stop('TARGET_PREAPPLY_DRIFT', issues=targets['issues'])
        if snapshot['lifecycle_count'] != '0' or snapshot['successor_count'] != '0':
            stop('FOUNDATION_PRESTATE_DRIFT')
    packet_path = execution_manifest['bootstrapPacket']['rawPath']
    acquire_slot()
    try:
        if reconcile:
            apply_result = {'result': 'NOOP', 'operationId': prior[0]['operationId'],
                            'planDigest': prior[0]['planDigest'],
                            'poststateDigest': prior[0]['poststateDigest'],
                            'reconciliation': 'COMMITTED_OPERATION_FOUND_DURABLE_POSTSTATE_CONFIRMED'}
        else:
            apply_out = PROTECTED_DIR / '.bootstrap-apply-result.json'
            result = run_host(execution_manifest, 'apply-bootstrap', str(apply_out), packet_path, str(plan_out))
            if result.returncode != 0:
                apply_out.unlink(missing_ok=True)
                stop('HOST_APPLY_FAILED', stderr=result.stderr.strip().splitlines()[-1:], stdout=result.stdout[:600])
            apply_result = json.loads(apply_out.read_text(encoding='utf-8'))
            apply_out.unlink(missing_ok=True)
            if apply_result.get('result') not in ('APPLIED', 'NOOP'):
                stop('APPLY_RESULT_UNEXPECTED', applyResult=apply_result)
        verify_out = PROTECTED_DIR / '.bootstrap-verify-result.json'
        verify_result_run = run_host(execution_manifest, 'verify', str(verify_out), packet_path, str(plan_out))
        if verify_result_run.returncode != 0:
            verify_out.unlink(missing_ok=True)
            stop('HOST_VERIFY_FAILED', stderr=verify_result_run.stderr.strip().splitlines()[-1:])
        verify_result = json.loads(verify_out.read_text(encoding='utf-8'))
        verify_out.unlink(missing_ok=True)
        post_snapshot = protected_snapshot(env)
        unchanged = protected_equal(snapshot, post_snapshot)
        lifecycle = jsql(env, """
SELECT json_agg(json_build_object('principalId',l.principal_id::text,'state',l.state::text,'revision',l.revision::text) ORDER BY l.principal_id)
FROM agent_identity_lifecycle l
""")
        canonical_rows = lifecycle or []
        exact_44 = (len(canonical_rows) == 44
                    and all(row['state'] == 'canonical' for row in canonical_rows)
                    and sorted([row['principalId'] for row in canonical_rows])
                    == sorted(pair['machinePrincipalId'] for pair in execution_manifest['pairSet']['pairs']))
        poststate = evaluate_apply_poststate(post_snapshot['enrollment_table_counts'],
                                             committed_operation(env, execution_manifest['operationId']), plan)
        ok = (apply_result['result'] in ('APPLIED', 'NOOP') and verify_result.get('result') == 'PASS'
              and exact_44 and post_snapshot['successor_count'] == '0'
              and post_snapshot['lifecycle_count'] == '44'
              and poststate['businessTablesZero'] and poststate['operationAuditCount'] == 1
              and poststate['operationAuditExact']
              and all(unchanged.values()))
        receipt = write_receipt('lifecycle-bootstrap-apply-v1', {
            'anchor': args.anchor_execution_manifest_sha256,
            'mode': 'IDEMPOTENT_RECONCILE' if reconcile else 'APPLY',
            'applyResult': apply_result, 'verifyResult': verify_result,
            'lifecycleRows': canonical_rows, 'lifecycleRowCount': post_snapshot['lifecycle_count'],
            'successorRowCount': post_snapshot['successor_count'],
            'enrollmentTableCounts': post_snapshot['enrollment_table_counts'],
            'poststateEvaluation': poststate,
            'protectedBefore': snapshot, 'protectedAfter': post_snapshot,
            'protectedUnchanged': unchanged, 'exact44': exact_44,
            'remoteMainObservation': remote,
            'gitHead': git_repo(['rev-parse', 'HEAD']).stdout.strip(),
        })
        if not ok:
            stop('LIFECYCLE_BOOTSTRAP_POSTSTATE_FAILED', receipt=receipt)
        emit('PASS', receipt=receipt, applyResult=apply_result, verifyResult=verify_result.get('result'),
             lifecycleRowCount=post_snapshot['lifecycle_count'], successorRowCount=post_snapshot['successor_count'])
    finally:
        release_slot()


def phase_enrollment_plan(args):
    execution_manifest = load_execution_manifest(args.anchor_execution_manifest_sha256)
    verify_all_gates(execution_manifest)
    env = pg_env(FROZEN_DATABASE_URL)
    verify_connection_identity(env, execution_manifest['database'])
    schema = classify_schema(env, execution_manifest)
    if schema['verdict'] != 'EXACTLY_INSTALLED':
        stop('ENROLLMENT_SCHEMA_NOT_EXACTLY_INSTALLED', schemaState=schema['verdict'])
    component_manifest = json.loads(COMPONENT_MANIFEST_PATH.read_text(encoding='utf-8'))
    roles = {c['role']: c for c in component_manifest['components']}
    derive_entry = Path(roles['derive_enrollment_packet']['path'])
    authority = execution_manifest['authority']
    now = datetime.now(timezone.utc)
    created_at = now.strftime('%Y-%m-%dT%H:%M:%SZ')
    expires_at = datetime.fromtimestamp(now.timestamp() + 48 * 3600, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    packet_raw = PROTECTED_DIR / 'CANONICAL_SUBJECT_ENROLLMENT_PACKET_V2_EXEC.json'
    packet_canonical = PROTECTED_DIR / 'CANONICAL_SUBJECT_ENROLLMENT_PACKET_V2_EXEC_CANONICAL.json'
    report_out = PROTECTED_DIR / 'ENROLLMENT_RECONCILIATION_V1.json'
    for path in (packet_raw, packet_canonical, report_out, PROTECTED_DIR / 'ENROLLMENT_PLAN_V1.json'):
        if path.exists():
            stop('ENROLLMENT_PLAN_ARTIFACT_ALREADY_EXISTS', path=str(path))
    derive = run([sys.executable, str(derive_entry),
                  '--final-packet', authority['ownerPacket']['path'],
                  '--owner-decision', authority['ownerDecision']['path'],
                  '--ready-import-canonical', roles['frozen_ready_import_canonical']['path'],
                  '--created-at', created_at, '--expires-at', expires_at,
                  '--out', str(packet_raw), '--out-canonical', str(packet_canonical),
                  '--report-out', str(report_out)], timeout=120)
    if derive.returncode != 0:
        stop('ENROLLMENT_PACKET_DERIVATION_FAILED', stderr=derive.stderr.strip().splitlines()[-3:])
    derivation = json.loads(derive.stdout.strip().splitlines()[-1])
    expectations = execution_manifest['enrollmentExpectations']
    report = json.loads(report_out.read_text(encoding='utf-8'))
    drift = {key: {'computed': report[key], 'expected': expectations[key]}
             for key in expectations if report.get(key) != expectations[key]}
    if drift:
        stop('ENROLLMENT_RECONCILIATION_MISMATCH', drift=drift)
    import_payload = canonical_packet_digest_from_host(execution_manifest, str(packet_raw))
    acquire_slot()
    try:
        plan_out = PROTECTED_DIR / 'ENROLLMENT_PLAN_V1.json'
        result = run_host(execution_manifest, 'plan', str(plan_out), str(packet_raw))
        if result.returncode != 0:
            stop('HOST_ENROLLMENT_PLAN_FAILED', stderr=result.stderr.strip().splitlines()[-1:], stdout=result.stdout[:400])
        plan = json.loads(plan_out.read_text(encoding='utf-8'))
        os.chmod(plan_out, 0o644)
        receipt = write_receipt('enrollment-plan-only-v1', {
            'anchor': args.anchor_execution_manifest_sha256,
            'operationId': plan['operationId'], 'planDigest': plan['planDigest'],
            'prestateDigest': plan['prestateDigest'], 'packetDigest': plan['packetDigest'],
            'mutationCounts': plan['mutationCounts'], 'reconciliation': report,
            'expectations': expectations, 'derivation': derivation,
            'hostImport': import_payload,
            'planArtifact': {'path': str(plan_out), 'sha256': sha_file(plan_out)},
            'applied': 'NO',
            'gitHead': git_repo(['rev-parse', 'HEAD']).stdout.strip(),
        })
        emit('PASS', receipt=receipt, planDigest=plan['planDigest'], mutationCounts=plan['mutationCounts'],
             reconciliation=report, note='PLAN ONLY — enrollment APPLY is outside this runbook')
    finally:
        release_slot()


# ---------------------------------------------------------------------------
# Offline negative selftests (Gate A + Gate C fixtures, no production access)
# ---------------------------------------------------------------------------

def selftest():
    """Negative fixtures: every substitution must FAIL the boundary checks."""
    report = []

    def expect_reject(name, fn, *args, expect_code=None):
        try:
            failures = fn(*args)
            rejected = bool(failures) and (expect_code is None or any(f.startswith(expect_code) for f in failures))
            report.append({'case': name, 'rejected': rejected, 'failures': failures[:4],
                           'expectCode': expect_code, 'hit': expect_code is None or any(f.startswith(expect_code) for f in failures)})
        except SystemExit:
            report.append({'case': name, 'rejected': True, 'failures': ['STOPRaised'], 'hit': True})
        except Exception as error:  # noqa: BLE001
            report.append({'case': name, 'rejected': True, 'failures': [f'EXC:{error}'], 'hit': True})

    def expect_accept(name, fn, *args):
        try:
            failures = fn(*args)
            report.append({'case': name, 'accepted': not failures, 'failures': failures[:4]})
        except SystemExit:
            report.append({'case': name, 'accepted': False, 'failures': ['STOPRaised']})
        except Exception as error:  # noqa: BLE001
            report.append({'case': name, 'accepted': False, 'failures': [f'EXC:{error}']})

    base_manifest = {
        'manifestType': 'BOOTSTRAP_EXECUTION_MANIFEST_V1', 'environment': 'production',
        'operationId': '00000000-0000-0000-0000-000000000001',
        'remoteMain': '0' * 40,
        'authority': {
            'ownerPacketSha256': 'a' * 64, 'ownerDecisionSha256': 'b' * 64,
            'ownerExecutionMandateSha256': 'c' * 64, 'bootstrapAuthorityManifestSha256': 'd' * 64,
        },
        'bootstrapPacket': {'rawPath': '', 'rawSha256': '', 'canonicalDigest': 'e' * 64, 'mutationCount': 2},
        'pairSet': {'count': 2, 'pairs': [
            {'machinePrincipalId': '10000000-0000-0000-0000-000000000001', 'canonicalAgentId': 'agt_one', 'expectedPrestate': 'absent'},
            {'machinePrincipalId': '10000000-0000-0000-0000-000000000002', 'canonicalAgentId': 'agt_two', 'expectedPrestate': 'absent'},
        ]},
        'transition': {'toState': 'canonical'},
        'prestate': {'expectedRevisionByState': {'absent': None, 'unresolved': '1'}},
        'coreEvidence': {'configPath': '', 'configSha256': ''},
        'schemaFingerprint': {'expectedFile': {'path': '', 'sha256': ''}, 'migrationName': 'm', 'migrationSha256': 'f' * 64},
        'database': {'name': 'db', 'role': 'role', 'port': 5432},
        'enrollmentExpectations': {}, 'executionComponentManifestSha256': '0' * 64,
    }
    base_packet = {
        'packetVersion': '1', 'operationId': '00000000-0000-0000-0000-000000000001',
        'environment': 'production', 'actorRef': 'external_authority:mayf3',
        'authorityRef': 'R', 'authorityDigest': 'c' * 64,
        'sourceArtifacts': [], 'createdAt': '2026-09-18T00:00:00Z', 'expiresAt': '2026-09-20T00:00:00Z',
        'mutations': [
            {'operation': 'TRANSITION_AGENT_LIFECYCLE', 'mutationKey': f'bootstrap-lifecycle:{pair["machinePrincipalId"]}',
             'principalId': pair['machinePrincipalId'], 'canonicalAgentId': pair['canonicalAgentId'],
             'fromState': pair['expectedPrestate'], 'toState': 'canonical', 'expectedRevision': None,
             'authorityRef': 'R', 'authorityDigest': 'c' * 64, 'evidenceRef': 'e'}
            for pair in base_manifest['pairSet']['pairs']
        ],
    }

    import copy
    workdir = Path(tempfile.mkdtemp(prefix='gate-runner-selftest-'))
    scratch = workdir / 'scratch-artifact.bin'
    scratch.write_bytes(b'scratch-artifact-bytes')

    def variant(mutate_manifest=None, mutate_packet=None):
        manifest = copy.deepcopy(base_manifest)
        manifest['authority']['ownerPacket'] = {'path': str(scratch), 'digest': manifest['authority']['ownerPacketSha256']}
        manifest['authority']['ownerDecision'] = {'path': str(scratch), 'digest': manifest['authority']['ownerDecisionSha256']}
        manifest['authority']['ownerExecutionMandate'] = {'path': str(scratch), 'digest': manifest['authority']['ownerExecutionMandateSha256']}
        manifest['authority']['bootstrapAuthorityManifest'] = {'path': str(scratch), 'digest': manifest['authority']['bootstrapAuthorityManifestSha256']}
        manifest['coreEvidence']['configPath'] = str(scratch)
        manifest['schemaFingerprint']['expectedFile']['path'] = str(scratch)
        manifest['pairSet']['canonicalEncoding'] = pairs_encoding(manifest['pairSet']['pairs'])
        manifest['pairSet']['digest'] = sha_text(pairs_encoding(manifest['pairSet']['pairs']))
        packet = copy.deepcopy(base_packet)
        if mutate_manifest:
            mutate_manifest(manifest)
        if mutate_packet:
            mutate_packet(packet)
        packet_path = workdir / f'packet-{len(report)}.json'
        packet_path.write_text(json.dumps(packet), encoding='utf-8')
        manifest['bootstrapPacket']['rawPath'] = str(packet_path)
        return manifest

    expect_accept('A-baseline-sanity-accepts', lambda m: verify_packet_against_manifest(m) + verify_pair_set(m, expected_count=2),
                  variant())

    def packet_mutator(mutate):
        return mutate

    expect_reject('A1-substitute-operation-id', verify_packet_against_manifest,
                  variant(mutate_packet=packet_mutator(lambda p: p.update(operationId='00000000-0000-0000-0000-00000000ffff'))))
    expect_reject('A2-substitute-packet-digest', verify_execution_manifest,
                  variant(mutate_manifest=lambda m: m['bootstrapPacket'].update(rawSha256='9' * 64)),
                  expect_code='BOOTSTRAP_PACKET_RAW_DIGEST_DRIFT')
    expect_reject('A3-remove-one-target', verify_packet_against_manifest,
                  variant(mutate_packet=packet_mutator(lambda p: p['mutations'].pop())))
    expect_reject('A4-add-one-target', verify_packet_against_manifest,
                  variant(mutate_packet=packet_mutator(lambda p: p['mutations'].append(dict(p['mutations'][0], principalId='10000000-0000-0000-0000-000000000099', mutationKey='bootstrap-lifecycle:extra')))))
    expect_reject('A5-change-one-principal', verify_packet_against_manifest,
                  variant(mutate_packet=packet_mutator(lambda p: p['mutations'][0].update(principalId='10000000-0000-0000-0000-000000000098'))))
    expect_reject('A6-change-one-agent-id', verify_packet_against_manifest,
                  variant(mutate_packet=packet_mutator(lambda p: p['mutations'][0].update(canonicalAgentId='agt_evil'))))
    expect_reject('A7-change-transition-prestate', verify_packet_against_manifest,
                  variant(mutate_packet=packet_mutator(lambda p: p['mutations'][0].update(fromState='unresolved', expectedRevision='1'))))
    expect_reject('A8-duplicate-one-target', verify_packet_against_manifest,
                  variant(mutate_packet=packet_mutator(lambda p: p['mutations'].append(copy.deepcopy(p['mutations'][0])))))
    expect_reject('A9-pair-set-digest-mismatch',
                  lambda m: verify_pair_set(m, expected_count=2),
                  variant(mutate_manifest=lambda m: m['pairSet'].update(digest='7' * 64)),
                  expect_code='PAIR_SET_DIGEST_MISMATCH')
    expect_reject('A10-authority-artifact-drift', verify_execution_manifest,
                  variant(mutate_manifest=lambda m: m['authority']['ownerPacket'].update(digest='8' * 64)),
                  expect_code='AUTHORITY_ARTIFACT_DIGEST_DRIFT_ownerPacket')
    expect_reject('A11-core-config-drift', verify_execution_manifest,
                  variant(mutate_manifest=lambda m: m['coreEvidence'].update(configSha256='6' * 64)),
                  expect_code='CORE_CONFIG_DIGEST_DRIFT')
    expect_reject('A12-fingerprint-file-drift', verify_execution_manifest,
                  variant(mutate_manifest=lambda m: m['schemaFingerprint']['expectedFile'].update(sha256='5' * 64)),
                  expect_code='EXPECTED_SCHEMA_FINGERPRINT_DIGEST_DRIFT')

    # Row-level prestate fixtures: SQL NULL lifecycle == 'absent'; revision
    # numbers compare as strings (regression for the r3 preflight false-flag).
    rev = {'absent': None, 'unresolved': '1'}
    base_row = {'principalId': 'p1', 'canonicalAgentId': 'agt_one', 'expectedPrestate': 'absent',
                'exists': True, 'principalType': 'agent', 'status': 'active', 'storedAgentId': 'agt_one',
                'lifecycleState': None, 'lifecycleRevision': None, 'outgoingSuccessor': False}
    row_cases = [
        ('R1-null-lifecycle-is-absent', dict(base_row), []),
        ('R2-unresolved-revision-int-1', dict(base_row, expectedPrestate='unresolved', lifecycleState='unresolved', lifecycleRevision=1), []),
        ('R3-null-vs-expected-unresolved', dict(base_row, expectedPrestate='unresolved'), ['LIFECYCLE_PRESTATE_CONFLICT']),
        ('R4-canonical-vs-absent', dict(base_row, lifecycleState='canonical', lifecycleRevision=1), ['LIFECYCLE_PRESTATE_CONFLICT']),
        ('R5-wrong-revision', dict(base_row, expectedPrestate='unresolved', lifecycleState='unresolved', lifecycleRevision=7), ['LIFECYCLE_REVISION_CONFLICT']),
        ('R6-outgoing-successor', dict(base_row, outgoingSuccessor=True), ['OUTGOING_SUCCESSOR']),
        ('R7-inactive-principal', dict(base_row, status='disabled'), ['TARGET_INACTIVE']),
    ]
    for name, row, expected_codes in row_cases:
        issues = evaluate_target_rows([row], rev)
        codes = [issue['code'] for issue in issues]
        report.append({'case': name, 'pass': codes == expected_codes, 'codes': codes, 'expected': expected_codes})

    # Snapshot-count normalization fixtures: JSON-number counts must compare
    # equal to the string vocabulary used by every phase gate.
    normalized = normalize_snapshot_counts({'lifecycle_count': 0, 'successor_count': 0,
                                            'other_active_mutation_queries': 0})
    report.append({'case': 'S1-int-zero-counts-pass-string-gates', 'pass': normalized['lifecycle_count'] == '0' and normalized['successor_count'] == '0'})
    normalized44 = normalize_snapshot_counts({'lifecycle_count': 44, 'successor_count': 0})
    report.append({'case': 'S2-applied-44-passes-string-gate', 'pass': normalized44['lifecycle_count'] == '44' and normalized44['successor_count'] == '0'})
    report.append({'case': 'S3-null-counts-stay-null', 'pass': normalize_snapshot_counts({'lifecycle_count': None})['lifecycle_count'] is None})

    # Host-import parser fixtures: mutation count comes from the canonical file,
    # bound to the summary via outputSha256 (regression for the r5 drill KeyError).
    fake_canonical = json.dumps({'mutations': [{'operation': 'TRANSITION_AGENT_LIFECYCLE'}, {'operation': 'TRANSITION_AGENT_LIFECYCLE'}]}).encode()
    fake_summary = json.dumps({'result': 'PASS', 'outputPath': '/tmp/x', 'outputSha256': sha_bytes(fake_canonical),
                               'packetDigest': 'd' * 64, 'operationId': '00000000-0000-0000-0000-000000000001'})
    parsed = parse_host_import(fake_summary, fake_canonical)
    report.append({'case': 'H1-parse-host-import', 'pass': bool(parsed) and parsed['mutationCount'] == 2 and parsed['packetDigest'] == 'd' * 64})
    tampered_summary = json.dumps({'result': 'PASS', 'outputSha256': '0' * 64, 'packetDigest': 'd' * 64, 'operationId': 'x'})
    report.append({'case': 'H2-tampered-output-sha-rejected', 'pass': parse_host_import(tampered_summary, fake_canonical) is None})
    failing = json.dumps({'result': 'FAIL'})
    report.append({'case': 'H3-failing-summary-rejected', 'pass': parse_host_import(failing, fake_canonical) is None})

    # Phase B poststate evaluation fixtures: the ONE canonical_subject_operations
    # audit row is part of the accepted APPLY; the four business tables stay zero
    # (regression for the r6 drill poststate false-STOP).
    plan_fixture = {'operationId': 'op-1', 'planDigest': 'p' * 64, 'expectedPoststateDigest': 'e' * 64,
                    'mutationCounts': {'TRANSITION_AGENT_LIFECYCLE': 44}}
    counts_fixture = {'canonical_subject_attestations': '0', 'canonical_subject_source_bindings': '0',
                      'canonical_subject_operation_authorities': '0', 'identity_attestation_delegations': '0',
                      'canonical_subject_operations': '1'}
    audit_fixture = [{'operationId': 'op-1', 'planDigest': 'p' * 64, 'poststateDigest': 'e' * 64,
                      'mutationCounts': {'TRANSITION_AGENT_LIFECYCLE': 44}}]
    good = evaluate_apply_poststate(counts_fixture, audit_fixture, plan_fixture)
    report.append({'case': 'P1-single-exact-audit-accepted', 'pass': good['businessTablesZero'] and good['operationAuditCount'] == 1 and good['operationAuditExact']})
    empty_all = evaluate_apply_poststate({**counts_fixture, 'canonical_subject_operations': '0'}, [], plan_fixture)
    report.append({'case': 'P2-missing-audit-rejected', 'pass': not empty_all['businessTablesZero'] or empty_all['operationAuditCount'] != 1 or not empty_all['operationAuditExact']})
    drifted_audit = evaluate_apply_poststate(counts_fixture, [dict(audit_fixture[0], planDigest='0' * 64)], plan_fixture)
    report.append({'case': 'P3-drifted-audit-rejected', 'pass': not drifted_audit['operationAuditExact']})
    extra_audit = evaluate_apply_poststate(counts_fixture, audit_fixture + [audit_fixture[0]], plan_fixture)
    report.append({'case': 'P4-two-audit-rows-rejected', 'pass': extra_audit['operationAuditCount'] == 2 and not extra_audit['operationAuditExact']})
    dirty_business = evaluate_apply_poststate({**counts_fixture, 'canonical_subject_attestations': '3'}, audit_fixture, plan_fixture)
    report.append({'case': 'P5-nonzero-business-table-rejected', 'pass': not dirty_business['businessTablesZero']})

    # psql json_agg output-shape fixtures (regression for the r7 drill TypeError).
    report.append({'case': 'J1-bare-array-shape', 'pass': as_rows([{'a': 1}]) == [{'a': 1}]})
    report.append({'case': 'J2-wrapped-rows-shape', 'pass': as_rows({'rows': [{'a': 1}]}) == [{'a': 1}]})
    report.append({'case': 'J3-empty-array', 'pass': as_rows([]) == []})
    report.append({'case': 'J4-null', 'pass': as_rows(None) == []})

    passed = (all(item['rejected'] and item['hit'] for item in report if 'rejected' in item)
              and all(item['accepted'] for item in report if 'accepted' in item)
              and all(item['pass'] for item in report if 'pass' in item))
    print(json.dumps({'selftest': 'gate-a-negative-fixtures', 'cases': report, 'allRejected': passed},
                     sort_keys=True))
    return 0 if passed else 2


# ---------------------------------------------------------------------------

PHASES = {
    'preflight': phase_preflight,
    'install': phase_install,
    'plan': phase_plan,
    'apply': phase_apply,
    'enrollment-plan': phase_enrollment_plan,
    'selftest': lambda args: sys.exit(selftest()),
}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=sorted(PHASES), required=True)
    parser.add_argument('--anchor-execution-manifest-sha256', default=None)
    args = parser.parse_args(argv)
    if args.phase != 'selftest':
        require_root()
        if not args.anchor_execution_manifest_sha256:
            stop('EXECUTION_MANIFEST_ANCHOR_REQUIRED')
        global FROZEN_DATABASE_URL
        FROZEN_DATABASE_URL = database_url()
    install_signal_cleanup()
    try:
        PHASES[args.phase](args)
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001 — structured output beats a bare traceback
        emit('EXCEPTION', phase=args.phase, error=f'{type(error).__name__}: {error}')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
