#!/usr/bin/env python3
"""Deterministic derivation of the executable 63-subject enrollment packet for
Phase C (PLAN ONLY — this packet is never applied by this runbook).

Source of authority: CANONICAL_SUBJECT_ENROLLMENT_PACKET_V1_FINAL.json (the
final Owner packet, 73 subjects / 89 bindings / 147 covered rows, all
owner_attestation_status=FINAL) plus FINAL_OWNER_TYPED_ATTESTATION_DECISION_V1.

Derivation:
  subjects with execution_eligibility=AUTHORITY_READY (63) become exactly one
  ACTIVATE_ATTESTATION mutation each:
    - 57 OWNER_EXACT_TYPED_ATTESTATION -> authority kind=owner_exact with the
      final owner decision digest;
    - 6 FROZEN_REVIEWED_EXPLICIT_SUCCESSOR subjects -> authority byte-identical
      to the corresponding accepted_governing_authority mutation frozen in
      CANONICAL_SUBJECT_ENROLLMENT_READY_IMPORT_CANONICAL.json.
  the remaining 10 subjects (5 provisioning-required, 4 retire-pending,
  1 unresolved) are non-executable and yield no mutation.
  source bindings inherit executability from their owning subject
  (79 executable / 10 non-executable).

The operationId is minted deterministically (uuid5 of the final packet digest)
so independent reviewers can re-derive it. Only the validity window is minted
at derivation time. Canonical digest authority stays with the accepted
TypeScript implementation.
"""
import argparse
import hashlib
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ACTOR_REF = 'external_authority:mayf3'
ENVIRONMENT = 'production'
OWNER_EXACT_REF = 'FINAL_OWNER_TYPED_ATTESTATION_DECISION_V1'
PACKET_AUTHORITY_REF = 'CANONICAL_SUBJECT_ENROLLMENT_PACKET_V1_FINAL_OWNER_MATERIALIZED'

FINAL_PACKET_SHA = 'df7f685f6e35681105a24941abf8f57754bae0b45aeb1272758be0a74ffa168c'
OWNER_DECISION_SHA = '78cfb31f4ad527d2994c29c7a0c6b99244237511d3f8fca7bfad081a41dd6464'
READY_IMPORT_CANONICAL_SHA = '00ffd6029a46f7ab11d0e1187a09d8607bca930b1a58c891ca0d29bec785cb88'

EXPECTED_DENOMINATORS = {
    'subjectsTotal': 73,
    'sourceBindingsTotal': 89,
    'coveredRows': 147,
    'executableSubjects': 63,
    'nonExecutableSubjects': 10,
    'executableSourceBindings': 79,
    'nonExecutableSourceBindings': 10,
}


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


def derive(final_path, decision_path, ready_path, created_at, expires_at):
    if sha256_file(final_path) != FINAL_PACKET_SHA:
        raise SystemExit('final owner packet digest drift')
    if sha256_file(decision_path) != OWNER_DECISION_SHA:
        raise SystemExit('owner decision digest drift')
    if sha256_file(ready_path) != READY_IMPORT_CANONICAL_SHA:
        raise SystemExit('frozen ready-import packet digest drift')

    final = json.loads(Path(final_path).read_text(encoding='utf-8'))
    ready = json.loads(Path(ready_path).read_text(encoding='utf-8'))
    decision_digest = OWNER_DECISION_SHA

    if final['packet_type'] != 'CANONICAL_SUBJECT_ENROLLMENT_PACKET_V1_FINAL_OWNER_MATERIALIZED':
        raise SystemExit('unexpected final packet type')
    denominators = final.get('denominators', {})
    if (denominators.get('subjects') != 73 or denominators.get('source_bindings') != 89
            or denominators.get('covered_ledger_rows') != 147):
        raise SystemExit('final packet denominators drifted from the sealed census')

    governing_by_subject = {}
    for mutation in ready['mutations']:
        if mutation['operation'] == 'ACTIVATE_ATTESTATION' and mutation['authority']['kind'] == 'accepted_governing_authority':
            governing_by_subject[mutation['subjectAttestationId']] = mutation

    executable = [s for s in final['subjects'] if s['execution_eligibility'] == 'AUTHORITY_READY']
    non_executable = [s for s in final['subjects'] if s['execution_eligibility'] != 'AUTHORITY_READY']
    executable_ids = {s['subject_attestation_id'] for s in executable}

    mutations = []
    for subject in executable:
        subject_type = subject['subject_type'].lower()
        if subject_type == 'agent':
            target = {'machinePrincipalId': subject['machine_principal_id'],
                      'canonicalAgentId': subject['canonical_agent_id']}
        elif subject_type == 'human':
            target = {'userId': subject['user_id']}
        else:
            raise SystemExit('unexpected subject type in final packet')
        if subject['owner_attestation_status'] != 'FINAL':
            raise SystemExit('executable subject is not FINAL')
        if subject['attestation_authority'] == 'ACCEPTED_GOVERNING_AUTHORITY':
            prior = governing_by_subject.get(subject['subject_attestation_id'])
            if not prior:
                raise SystemExit('accepted governing subject has no frozen prior mutation')
            authority = dict(prior['authority'])
        else:
            authority = {'kind': 'owner_exact', 'ref': OWNER_EXACT_REF, 'digest': decision_digest,
                         'requestedOperation': 'activate', 'intendedDisposition': 'active'}
        mutations.append({
            'operation': 'ACTIVATE_ATTESTATION',
            'mutationKey': f"activate-attestation:{subject['subject_attestation_id']}",
            'subjectAttestationId': subject['subject_attestation_id'],
            'businessSubjectId': subject['business_subject_id'],
            'subjectType': subject_type,
            'businessSubjectDescription': subject['business_subject_description'],
            'target': target,
            'authoritySource': subject['authority_source'],
            'attestedBy': {'kind': 'external_authority', 'id': 'mayf3'},
            'authority': authority,
            'effectiveAt': created_at,
            'evidenceRef': subject['evidence_ref'],
        })

    bindings = final['source_bindings']
    executable_bindings = [b for b in bindings if b['subject_attestation_id'] in executable_ids]
    report = {
        'subjectsTotal': len(final['subjects']),
        'sourceBindingsTotal': len(bindings),
        'coveredRows': denominators.get('covered_ledger_rows'),
        'executableSubjects': len(executable),
        'nonExecutableSubjects': len(non_executable),
        'nonExecutableBreakdown': {
            'blockedTargetProvisioning': sum(1 for s in non_executable if s['execution_eligibility'] == 'BLOCKED_TARGET_PROVISIONING'),
            'excludedRetireExitRequired': sum(1 for s in non_executable if s['execution_eligibility'] == 'EXCLUDED_RETIRE_EXIT_REQUIRED'),
            'blockedUnresolved': sum(1 for s in non_executable if s['execution_eligibility'] == 'BLOCKED_UNRESOLVED'),
        },
        'executableSourceBindings': len(executable_bindings),
        'nonExecutableSourceBindings': len(bindings) - len(executable_bindings),
        'ownerExactMutations': sum(1 for m in mutations if m['authority']['kind'] == 'owner_exact'),
        'acceptedGoverningMutations': sum(1 for m in mutations if m['authority']['kind'] == 'accepted_governing_authority'),
    }
    for key, value in EXPECTED_DENOMINATORS.items():
        if report[key] != value:
            raise SystemExit(f'RECONCILIATION_MISMATCH {key}: computed={report[key]} expected={value}')

    operation_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f'canonical-subject-enrollment-plan-only-v1:{FINAL_PACKET_SHA}'))
    return {
        'packetVersion': '1',
        'operationId': operation_id,
        'environment': ENVIRONMENT,
        'actorRef': ACTOR_REF,
        'authorityRef': PACKET_AUTHORITY_REF,
        'authorityDigest': FINAL_PACKET_SHA,
        'sourceArtifacts': sorted([
            {'ref': str(final_path), 'digest': FINAL_PACKET_SHA},
            {'ref': str(decision_path), 'digest': OWNER_DECISION_SHA},
            {'ref': str(ready_path), 'digest': READY_IMPORT_CANONICAL_SHA},
        ], key=lambda a: a['ref']),
        'mutations': sorted(mutations, key=lambda m: m['mutationKey']),
        'createdAt': created_at,
        'expiresAt': expires_at,
    }, report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--final-packet', required=True)
    parser.add_argument('--owner-decision', required=True)
    parser.add_argument('--ready-import-canonical', required=True)
    parser.add_argument('--created-at', required=True)
    parser.add_argument('--expires-at', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--out-canonical', default=None)
    parser.add_argument('--report-out', default=None)
    args = parser.parse_args(argv)

    datetime.strptime(args.created_at, '%Y-%m-%dT%H:%M:%SZ')
    datetime.strptime(args.expires_at, '%Y-%m-%dT%H:%M:%SZ')
    packet, report = derive(args.final_packet, args.owner_decision, args.ready_import_canonical,
                            args.created_at, args.expires_at)
    Path(args.out).write_text(json.dumps(packet, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    if args.out_canonical:
        Path(args.out_canonical).write_text(canonical_json(packet) + '\n', encoding='utf-8')
    if args.report_out:
        Path(args.report_out).write_text(json.dumps(report, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({'derived': True, 'mutationCount': len(packet['mutations']),
                      'operationId': packet['operationId'], 'report': report}, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
