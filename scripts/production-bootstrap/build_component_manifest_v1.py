#!/usr/bin/env python3
"""Seal-time builder for EXECUTION_COMPONENT_MANIFEST_V1 (Gate C).

Enumerates every execution-trusted component of the privileged bootstrap
toolchain with its resolved path, role and sha256:

  - the production runbook bytes (copy + provenance commit),
  - the privileged runner, schema-fingerprint helper, packet derivation helpers
    and this builder,
  - the bootstrap TypeScript host and its complete recursive local import
    closure plus the generated Prisma schema,
  - package.json / package-lock.json and the exact migration bytes,
  - the bootstrap packet (raw + canonical), the authority manifest, the owner
    packet / decision / mandate artifacts and the expected schema fingerprint,
  - the node_modules package directories that enter the mutation lane
    (deterministic directory Merkle digests, not transitive-byte omissions),
  - resolved launcher binaries (node, python3, psql, git, prisma, tsx) with
    version and binary digest.

The privileged runner re-verifies every entry immediately before any
privileged action; the runner's own bytes are anchored by the reviewed git
head (THREE_GATE_FIX_HEAD) plus a working-tree cleanliness check at run time,
not by this manifest (documented in trustAnchors).
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

MANIFEST_TYPE = 'EXECUTION_COMPONENT_MANIFEST_V1'
REPO_DIR_COMPONENT_ROLES = {
    'bootstrap_runner': 'scripts/production-bootstrap/bootstrap_gate_runner_v1.py',
    'schema_fingerprint_helper': 'scripts/production-bootstrap/schema_fingerprint_v1.py',
    'derive_bootstrap_packet': 'scripts/production-bootstrap/derive_bootstrap_packet_v2.py',
    'derive_enrollment_packet': 'scripts/production-bootstrap/derive_enrollment_packet_v1.py',
    'component_manifest_builder': 'scripts/production-bootstrap/build_component_manifest_v1.py',
    'bootstrap_host': 'scripts/production-bootstrap/bootstrap_host_v2.ts',
    'enrollment_implementation_lib': 'src/lib/oauth/v1/canonical-subject-enrollment.ts',
    'prisma_client_lib': 'src/lib/prisma.ts',
    'prisma_schema': 'prisma/schema.prisma',
    'package_json': 'package.json',
    'package_lock_json': 'package-lock.json',
    'enrollment_migration': 'prisma/migrations/202609160001_canonical_subject_enrollment/migration.sql',
}
DIR_MERKLE_PACKAGES = [
    ('tsx_package', 'node_modules/tsx'),
    ('esbuild_package', 'node_modules/esbuild'),
    ('esbuild_platform_package', 'node_modules/@esbuild/darwin-arm64'),
    ('zod_package', 'node_modules/zod'),
    ('prisma_package', 'node_modules/prisma'),
    ('prisma_client_package', 'node_modules/@prisma/client'),
    ('prisma_client_generated', 'node_modules/.prisma/client'),
    ('prisma_engines_package', 'node_modules/@prisma/engines'),
]


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def run(args, cwd=None, timeout=60):
    return subprocess.run(args, cwd=cwd, timeout=timeout, text=True, capture_output=True)


def sha_file(path):
    return sha256_bytes(Path(path).read_bytes())


def resolve_symlink(path):
    return os.path.realpath(path)


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
    return {'digest': sha256_bytes(canonical_json(entries).encode('utf-8')),
            'fileCount': len(entries),
            'totalBytes': sum(e.get('bytes', 0) for e in entries)}


def binary_fingerprint(path):
    resolved = resolve_symlink(path)
    version = run([resolved, '--version'])
    return {'path': str(Path(path).resolve()), 'version': version.stdout.strip().splitlines()[-1] if version.returncode == 0 else None,
            'sha256': sha_file(resolved)}


def local_import_closure(repo_root, entry_paths):
    """Recursively resolve relative local imports of the sealed TS entry files."""
    closure = set()
    queue = [Path(repo_root, p) for p in entry_paths]
    while queue:
        current = queue.pop()
        if current in closure:
            continue
        closure.add(current)
        text = current.read_text(encoding='utf-8')
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped.startswith('import') and 'from' not in stripped:
                continue
            if "from '" not in stripped and 'from "' not in stripped:
                continue
            module = stripped.split("from '")[1].split("'")[0] if "from '" in stripped else stripped.split('from "')[1].split('"')[0]
            if not module.startswith('.'):
                continue
            target = (current.parent / module).resolve()
            candidates = [target, target.with_suffix('.ts'), target.with_name(target.name + '.ts'),
                          target / 'index.ts']
            for candidate in candidates:
                if candidate.is_file() and candidate.suffix in ('.ts', '.tsx', '.mjs', '.js'):
                    queue.append(candidate)
                    break
    return sorted(closure)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root', default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument('--protected-dir', required=True, help='bootstrap protected artifact directory (this round)')
    parser.add_argument('--prior-protected-dir', required=True, help='20260917 protected dir (authority manifest + packet v1)')
    parser.add_argument('--fingerprint-file', required=True)
    parser.add_argument('--packet-raw', required=True)
    parser.add_argument('--packet-canonical', required=True)
    parser.add_argument('--runbook-copy', required=True, help='runbook bytes copy in protected dir')
    parser.add_argument('--out', required=True)
    args = parser.parse_args(argv)

    repo_root = Path(args.repo_root)
    components = []

    def add_file(role, path, extra=None):
        entry = {'role': role, 'path': str(Path(path).resolve()), 'type': 'file',
                 'sha256': sha_file(path), 'bytes': Path(path).stat().st_size}
        if extra:
            entry.update(extra)
        components.append(entry)

    head = run(['/usr/bin/git', '-C', str(repo_root), 'rev-parse', 'HEAD'])
    if head.returncode != 0:
        raise SystemExit('not a git repository')
    repo_head = head.stdout.strip()
    dirty = run(['/usr/bin/git', '-C', str(repo_root), 'status', '--porcelain'])
    if dirty.stdout.strip():
        raise SystemExit('repository has uncommitted changes; commit the gate toolchain first')

    def add_repo_file(role, rel):
        blob = run(['/usr/bin/git', '-C', str(repo_root), 'rev-parse', f'HEAD:{rel}'])
        if blob.returncode != 0:
            raise SystemExit(f'{rel} is not committed; commit the gate toolchain first')
        path = repo_root / rel
        components.append({'role': role, 'path': str(path.resolve()), 'type': 'repoFile',
                           'repoRelative': rel, 'sha256': sha_file(path), 'bytes': path.stat().st_size,
                           'blobSha': blob.stdout.strip()})

    for role, rel in sorted(REPO_DIR_COMPONENT_ROLES.items()):
        add_repo_file(role, rel)

    # Launchers and resolved entries.
    node_bin = run(['/bin/sh', '-c', 'which node']).stdout.strip()
    python_bin = sys.executable
    psql_bin = run(['/bin/sh', '-c', 'which psql']).stdout.strip()
    for role, rel in (('tsx_cli_entry', 'node_modules/tsx/dist/cli.mjs'),):
        add_file(role, repo_root / rel, {'repoRelative': rel})
    for role, rel in (('prisma_bin_link', 'node_modules/.bin/prisma'), ('tsx_bin_link', 'node_modules/.bin/tsx')):
        link = repo_root / rel
        target = Path(resolve_symlink(link))
        components.append({'role': role, 'path': str(link.resolve()), 'type': 'symlink',
                           'linkPath': str(link), 'resolvedTarget': str(target),
                           'targetSha256': sha_file(target)})
    for role, rel in DIR_MERKLE_PACKAGES:
        package_dir = repo_root / rel
        if not package_dir.is_dir():
            if rel.startswith('node_modules/.prisma'):
                continue
            raise SystemExit(f'missing sealed package directory: {rel}')
        merkle = dir_merkle(package_dir)
        components.append({'role': role, 'path': str(package_dir.resolve()), 'type': 'dirMerkle', **merkle})

    # Protected-dir authority + expectation artifacts.
    prior = Path(args.prior_protected_dir)
    add_file('bootstrap_authority_manifest', prior / 'CANONICAL_AGENT_LIFECYCLE_BOOTSTRAP_AUTHORITY_MANIFEST_V1.json')
    add_file('owner_packet', prior.parent / 'canonical-subject-enrollment-packet-20260916/final-owner-decision-materialization-v1/CANONICAL_SUBJECT_ENROLLMENT_PACKET_V1_FINAL.json')
    add_file('owner_decision', prior.parent / 'canonical-subject-enrollment-packet-20260916/final-owner-decision-materialization-v1/FINAL_OWNER_TYPED_ATTESTATION_DECISION_V1.json')
    add_file('owner_execution_mandate', '/Users/yanfenma/.codex/attachments/81595ee7-29d6-4d8e-848d-247e1cf0c3e6/pasted-text.txt')
    add_file('frozen_ready_import_canonical', prior.parent / 'canonical-subject-enrollment-packet-20260916/CANONICAL_SUBJECT_ENROLLMENT_READY_IMPORT_CANONICAL.json')
    add_file('expected_schema_fingerprint', args.fingerprint_file)
    add_file('bootstrap_packet_v2_raw', args.packet_raw)
    add_file('bootstrap_packet_v2_canonical', args.packet_canonical)
    add_file('runbook_doc', args.runbook_copy)

    # Local import closure proof: host + enrollment lib + prisma lib must cover
    # every relative import transitively within the sealed file set.
    sealed_repo_files = {str((repo_root / rel).resolve()) for rel in REPO_DIR_COMPONENT_ROLES.values()
                         if rel.endswith(('.ts', '.tsx'))}
    closure = local_import_closure(repo_root, ['scripts/production-bootstrap/bootstrap_host_v2.ts'])
    uncovered = [path for path in closure if str(path) not in sealed_repo_files]
    if uncovered:
        raise SystemExit('local import closure not fully sealed: ' + ', '.join(map(str, uncovered)))

    document = {
        'manifestType': MANIFEST_TYPE,
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'repoHead': repo_head,
        'trustAnchors': {
            'runnerBytes': 'anchored by reviewed git head THREE_GATE_FIX_HEAD + run-time working-tree cleanliness check, not by this manifest',
            'executionManifest': 'BOOTSTRAP_EXECUTION_MANIFEST_SHA256 is hardcoded in the reviewed runner; the runner verifies this manifest against it',
        },
        'components': sorted(components, key=lambda c: (c['role'], c.get('path', ''))),
        'runtimes': {
            'node': binary_fingerprint(node_bin),
            'python': binary_fingerprint(python_bin),
            'psql': binary_fingerprint(psql_bin),
            'git': binary_fingerprint('/usr/bin/git'),
        },
    }
    text = canonical_json(document) + '\n'
    Path(args.out).write_text(text, encoding='utf-8')
    print(json.dumps({'components': len(components), 'out': args.out,
                      'sha256': sha256_bytes(text.encode('utf-8'))}, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
