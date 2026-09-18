#!/usr/bin/env python3
"""Deterministic derivation of the canonical Agent lifecycle bootstrap packet
(CANONICAL_AGENT_LIFECYCLE_BOOTSTRAP_PACKET_V2) from the sealed bootstrap
authority manifest.

Authority chain (all digests verified before any output is written):
  owner execution mandate -> owner packet -> owner decision
  -> CANONICAL_AGENT_LIFECYCLE_BOOTSTRAP_AUTHORITY_MANIFEST_V1 (44 exact pairs)
  -> this packet (exactly one TRANSITION_AGENT_LIFECYCLE mutation per pair)

Only the validity window (createdAt/expiresAt) is minted at derivation time.
The v1 packet's window lapsed before this takeover; this v2 derivation is the
mechanical refresh of the same authority content: same operationId, same 44
mutations byte-for-byte, new window. The --verify-against mode proves this by
re-deriving the v1 packet byte-exactly from the same manifest and window.

Canonical encoding mirrors the accepted TypeScript implementation:
recursively key-sorted JSON; sourceArtifacts sorted by ref; mutations sorted by
mutationKey. The canonical digest itself is always computed by the accepted
implementation (host import), never by this script.
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PACKET_AUTHORITY_REF = 'AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_PRODUCTION_BOOTSTRAP_V1'
ACTOR_REF = 'external_authority:mayf3'
ENVIRONMENT = 'production'


def canonical(value):
    if isinstance(value, list):
        return [canonical(item) for item in value]
    if isinstance(value, dict):
        return {key: canonical(value[key]) for key in sorted(value)}
    return value


def canonical_json(value):
    return json.dumps(canonical(value), separators=(',', ':'), ensure_ascii=False)


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def derive(manifest_path, operation_id, created_at, expires_at):
    manifest = json.loads(Path(manifest_path).read_text(encoding='utf-8'))
    if manifest.get('manifestType') != 'CANONICAL_AGENT_LIFECYCLE_BOOTSTRAP_AUTHORITY_MANIFEST_V1':
        raise SystemExit('authority manifest type mismatch')
    if manifest.get('environment') != ENVIRONMENT:
        raise SystemExit('authority manifest environment mismatch')
    mandate = manifest['ownerExecutionMandate']
    owner_packet = manifest['ownerPacket']
    owner_decision = manifest['ownerDecision']
    for coordinate in (mandate, owner_packet, owner_decision):
        if not Path(coordinate['ref']).is_file():
            raise SystemExit(f"authority artifact missing: {coordinate['ref']}")
        observed = sha256_file(coordinate['ref'])
        if observed != coordinate['digest']:
            raise SystemExit(f"authority artifact digest drift: {coordinate['ref']}")

    targets = manifest['targets']
    if manifest.get('uniqueCanonicalAgentTargets') != len(targets):
        raise SystemExit('authority manifest target count invariant mismatch')
    principal_ids = [target['principalId'] for target in targets]
    if len(set(principal_ids)) != len(principal_ids):
        raise SystemExit('duplicate principal in authority manifest')
    if manifest.get('historicalEquivalenceAsserted') != 'NO':
        raise SystemExit('historical equivalence must not be asserted')

    mutations = []
    for target in targets:
        if target['requestedTransition'] != 'ABSENT|unresolved -> canonical':
            raise SystemExit(f"unexpected requestedTransition for {target['principalId']}")
        prestate = target['expectedPrestate']
        if prestate not in ('absent', 'unresolved'):
            raise SystemExit(f"unexpected expectedPrestate for {target['principalId']}")
        mutations.append({
            'operation': 'TRANSITION_AGENT_LIFECYCLE',
            'mutationKey': f"bootstrap-lifecycle:{target['principalId']}",
            'principalId': target['principalId'],
            'canonicalAgentId': target['canonicalAgentId'],
            'fromState': prestate,
            'toState': 'canonical',
            'expectedRevision': None if prestate == 'absent' else '1',
            'authorityRef': target['authorityRef'],
            'authorityDigest': target['authorityDigest'],
            'evidenceRef': target['evidenceRef'],
        })

    artifacts = [
        {'ref': owner_packet['ref'], 'digest': owner_packet['digest']},
        {'ref': owner_decision['ref'], 'digest': owner_decision['digest']},
        {'ref': mandate['ref'], 'digest': mandate['digest']},
        {'ref': str(manifest_path), 'digest': sha256_file(manifest_path)},
    ]
    return {
        'packetVersion': '1',
        'operationId': operation_id,
        'environment': ENVIRONMENT,
        'actorRef': ACTOR_REF,
        'authorityRef': PACKET_AUTHORITY_REF,
        'authorityDigest': mandate['digest'],
        'sourceArtifacts': sorted(artifacts, key=lambda a: a['ref']),
        'mutations': sorted(mutations, key=lambda m: m['mutationKey']),
        'createdAt': created_at,
        'expiresAt': expires_at,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--operation-id', required=True)
    parser.add_argument('--created-at', default=None, help='ISO-8601 instant with Z offset')
    parser.add_argument('--expires-at', default=None)
    parser.add_argument('--out', default=None, help='raw packet output path (JSON)')
    parser.add_argument('--out-canonical', default=None, help='canonical encoding output path')
    parser.add_argument('--verify-against', default=None,
                        help='re-derive with this packet window and require byte-equality')
    args = parser.parse_args(argv)

    if args.verify_against:
        v1 = json.loads(Path(args.verify_against).read_text(encoding='utf-8'))
        derived = derive(args.manifest, args.operation_id, v1['createdAt'], v1['expiresAt'])
        expected = canonical_json(v1)
        if canonical_json(derived) != expected:
            print('V1_ROUNDTRIP_MISMATCH', file=sys.stderr)
            return 1
        print('V1_ROUNDTRIP_PASS mutations=%d' % len(derived['mutations']))
        return 0
    if not (args.created_at and args.expires_at and args.out):
        parser.error('--created-at, --expires-at and --out are required without --verify-against')

    derived = derive(args.manifest, args.operation_id, args.created_at, args.expires_at)
    raw = json.dumps(derived, indent=1, sort_keys=False, ensure_ascii=False) + '\n'
    Path(args.out).write_text(raw, encoding='utf-8')
    if args.out_canonical:
        Path(args.out_canonical).write_text(canonical_json(derived) + '\n', encoding='utf-8')
    print(json.dumps({'derived': True, 'mutationCount': len(derived['mutations']),
                      'operationId': derived['operationId'],
                      'expiresAt': derived['expiresAt']}, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
