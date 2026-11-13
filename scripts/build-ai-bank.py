#!/usr/bin/env python3
"""Join staged AI records with independent audits. Never publishes or runs SQL.

All inputs are data, not executable archive instructions. Generated source files
are reproduced by the checked-in authoring scripts; unknown audit coverage fails
closed. Runtime modules contain no generators or symbolic-expression evaluator.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'ai-bank-v1'
LABELS = json.loads((ROOT / 'data/ai/subtopic-labels.json').read_text(encoding='utf-8'))

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)

def digest(value):
    return hashlib.sha256(compact(value).encode()).hexdigest()

def bytes_digest(value):
    return hashlib.sha256(value).hexdigest()

def normalized_input_path(path):
    return str((ROOT / path).resolve())

def validate_audit_binding(payload, expected_inputs, verifier_hash, imported=False):
    """Fail closed when exact input bytes or verifier code no longer match.

    expected_inputs is computed from the same byte buffers parsed by the
    builder; report paths never determine which files the builder reads.
    """
    if payload.get('validatorSha256') != verifier_hash:
        raise ValueError('Independent audit verifier hash is missing or stale')
    if imported:
        if len(expected_inputs) != 1 or payload.get('inputSha256') != next(iter(expected_inputs.values())):
            raise ValueError('Imported audit input hash is missing or stale')
        return
    recorded = payload.get('inputs')
    if not isinstance(recorded, list):
        raise ValueError('Generated audit input bindings are missing')
    indexed = {}
    for row in recorded:
        if not isinstance(row, dict) or not isinstance(row.get('path'), str) or not isinstance(row.get('sha256'), str):
            raise ValueError('Generated audit input binding is malformed')
        path = normalized_input_path(row['path'])
        if path in indexed:
            raise ValueError('Generated audit contains duplicate input bindings')
        indexed[path] = row['sha256']
    if indexed != expected_inputs:
        raise ValueError('Generated audit input hashes or coverage are stale')

def binding_self_test():
    question = {'id':'TEST-ONLY','prompt':'3+4 işlemi kaçtır?','answer':{'value':'C'}}
    source = compact([question]).encode()
    original_hash = bytes_digest(source)
    verifier_hash = bytes_digest(b'test-only verifier v1')
    expected = {normalized_input_path('work/test-only-input.json'): original_hash}
    imported = {'validatorSha256':verifier_hash,'inputSha256':original_hash}
    generated = {'validatorSha256':verifier_hash,'inputs':[{'path':'work/test-only-input.json','sha256':original_hash}]}
    for mode, report in [(True, imported), (False, generated)]:
        validate_audit_binding(report, expected, verifier_hash, imported=mode)
        # Keep the ID while editing either the prompt or its key. Neither may
        # inherit an earlier approval just because ID coverage still matches.
        for field in ('prompt', 'answer'):
            edited = copy.deepcopy(question)
            if field == 'prompt':
                edited['prompt'] = '3+5 işlemi kaçtır?'
            else:
                edited['answer']['value'] = 'D'
            stale_expected = {next(iter(expected)): bytes_digest(compact([edited]).encode())}
            try:
                validate_audit_binding(report, stale_expected, verifier_hash, imported=mode)
            except ValueError:
                pass
            else:
                raise AssertionError('A stale audit accepted a changed ' + field)
        for bad_report, expected_verifier in [
                ({key:value for key,value in report.items() if key != 'validatorSha256'}, verifier_hash),
                (report, bytes_digest(b'test-only verifier v2'))]:
            try:
                validate_audit_binding(bad_report, expected, expected_verifier, imported=mode)
            except ValueError:
                pass
            else:
                raise AssertionError('A stale or unbound verifier audit was accepted')
    for bad in [
            {'validatorSha256':verifier_hash},
            {**generated,'inputs':[]},
            {**generated,'inputs':generated['inputs'] * 2},
            {**generated,'inputs':[{'path':'work/other-test-only-input.json','sha256':original_hash}]}]:
        try:
            validate_audit_binding(bad, expected, verifier_hash)
        except ValueError:
            pass
        else:
            raise AssertionError('Missing, duplicate or unrelated audit input was accepted')
    print('AI bank binding self-test: valid bindings pass; stale question, key, verifier and missing/duplicate input bindings fail.')

def canonical_prompt(text, numbers=False):
    text = unicodedata.normalize('NFKC', text).casefold()
    text = re.sub(r'\s+', ' ', text).strip()
    if numbers:
        # A conservative quarantine heuristic: identical prose with changed
        # constants is a near clone. It is not a mathematical equivalence proof.
        text = re.sub(r'(?<![a-z])\d+(?:[.,]\d+)?', '#', text)
    return text

def index_audit(payload, expected):
    records = payload.get('records', payload.get('questions', []))
    indexed = {row['id']: row for row in records}
    if len(indexed) != len(records) or set(indexed) != set(expected):
        missing = set(expected) - set(indexed)
        extra = set(indexed) - set(expected)
        raise ValueError(f'Audit coverage mismatch: missing={len(missing)}, extra={len(extra)}')
    return indexed

def verified(audit):
    return (audit.get('status') in ('verified', 'automated_verified')
            and audit.get('mathPassed') is True
            and not audit.get('reasons')
            and len(set(audit.get('methods', []))) >= 2)

def normalized(raw, audit, pool):
    row = copy.deepcopy(raw)
    answer = row.get('answer', {})
    # Only the independent checker may approve a record. Archive/generator
    # publication flags are preserved as provenance, never trusted as proof.
    reasons = list(audit.get('reasons', []))
    flags = list(raw.get('reviewFlags', []))
    for flag in flags:
        if flag not in reasons:
            reasons.append(flag)
    okay = verified(audit) and not reasons
    answer_value = answer.get('value')
    selected = next((option['text'] for option in row.get('options', [])
                     if option.get('id') == answer_value), None)
    steps = row.get('solutionSteps') or [part.strip() for part in re.split(r'\n+', answer.get('solution', '')) if part.strip()]
    raw_subtopic = row.get('subtopic') or row.get('topic', '')
    subtopic = raw_subtopic
    if pool == 'generated':
        matches = [prefix for prefix in LABELS if raw_subtopic == prefix or raw_subtopic.startswith(prefix + '-')]
        if not matches:
            raise ValueError(f'Generated subtopic needs a Turkish label: {raw_subtopic}')
        subtopic = LABELS[max(matches, key=len)]
    result = {
        'id': row['id'], 'examType': row['examType'], 'courseId': row['courseId'],
        'topic': row.get('topic', ''), 'subtopic': subtopic,
        'authoredSubtopic': raw_subtopic if pool == 'generated' else None,
        'difficulty': row.get('difficulty') or audit.get('difficultySuggestion'),
        'difficultyReason': row.get('difficultyReason') or audit.get('difficultyReason'),
        'prompt': row['prompt'], 'options': row['options'],
        'answer': {'value': answer_value, 'computedValue': selected if okay else answer.get('computedValue', ''),
                   'solution': answer.get('solution', '\n'.join(steps))},
        'solutionSteps': steps,
        'origin': 'AI_URETIMI', 'pool': pool,
        'parentQuestionId': row.get('parentQuestionId'),
        'familyId': row.get('familyId') or row.get('provenance', {}).get('parentQuestionId'),
        'templateId': row.get('templateId'),
        'semanticSimilarityGroup': audit.get('semanticSimilarityGroup'),
        'provenance': row.get('provenance', {}),
        'archiveStatus': row.get('publicationStatus') if pool == 'imported' else None,
        'verification': {
            'status': 'automated_verified' if okay else 'pending_review',
            'mathPassed': audit.get('mathPassed') is True,
            'computedValue': audit.get('computedValue'),
            'methods': audit.get('methods', []), 'reasons': reasons,
            'editorialStatus': 'pending',
        },
        'contentHash': digest({'prompt': row['prompt'], 'options': row['options']}),
    }
    return {key: value for key, value in result.items() if value is not None or key == 'difficulty'}

def write(path, contents, check):
    target = ROOT / path
    if check:
        if not target.exists() or target.read_text(encoding='utf-8') != contents:
            raise ValueError(f'Rebuild differs: {path}')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(target.suffix + '.tmp')
    temp.write_text(contents, encoding='utf-8')
    os.replace(temp, target)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', default='data/ai/archive-input.json')
    parser.add_argument('--import-audit', default='work/import-audit.json')
    parser.add_argument('--tyt', default='work/generated-tyt.json')
    parser.add_argument('--ayt', default='work/generated-ayt.json')
    parser.add_argument('--generated-audit', default='work/generated-qa.json')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--self-test', action='store_true', help='Test stale-audit rejection without reading question inputs or writing output')
    args = parser.parse_args()
    if args.self_test:
        binding_self_test()
        return
    original_bytes = (ROOT / args.input).read_bytes()
    original = json.loads(original_bytes)
    if not isinstance(original, list):
        raise ValueError('The archive master must be an array, not its duplicate subsets')
    tyt_bytes, ayt_bytes = (ROOT / args.tyt).read_bytes(), (ROOT / args.ayt).read_bytes()
    tyt, ayt = json.loads(tyt_bytes), json.loads(ayt_bytes)
    generated = tyt['questions'] + ayt['questions']
    all_ids = [row['id'] for row in original + generated]
    if len(set(all_ids)) != len(all_ids):
        raise ValueError('Duplicate IDs across authoring batches')
    imported_ids = {row['id'] for row in original}
    if any(row.get('parentQuestionId') not in imported_ids for row in generated):
        raise ValueError('A generated parent must be an accessible AI archive record')
    import_report = read(ROOT / args.import_audit)
    validate_audit_binding(import_report,
                           {normalized_input_path(args.input): bytes_digest(original_bytes)},
                           bytes_digest((ROOT / 'scripts/imported-math-audit.py').read_bytes()), imported=True)
    audits = index_audit(import_report, [row['id'] for row in original])
    generation_report = read(ROOT / args.generated_audit)
    expected_generation_inputs = {normalized_input_path(args.tyt): bytes_digest(tyt_bytes),
                                  normalized_input_path(args.ayt): bytes_digest(ayt_bytes)}
    if len(expected_generation_inputs) != 2:
        raise ValueError('TYT and AYT authoring inputs must be separate files')
    validate_audit_binding(generation_report, expected_generation_inputs,
                           bytes_digest((ROOT / 'scripts/verify-generated-bank.py').read_bytes()))
    generation_audits = index_audit(generation_report, [row['id'] for row in generated])
    imported_rows = [normalized(row, audits[row['id']], 'imported') for row in original]
    generated_rows = [normalized(row, generation_audits[row['id']], 'generated') for row in generated]
    rows = imported_rows + generated_rows
    independent_duplicates = {identifier: audit['duplicateOf'] for identifier, audit in generation_audits.items()
                              if audit.get('status') == 'duplicate_rejected' and audit.get('duplicateOf')}
    if any(target not in set(all_ids) for target in independent_duplicates.values()):
        raise ValueError('Independent duplicate audit references an unknown row')
    # Prefer the first independently eligible representative. A bad first row
    # must not suppress a later valid item. Preserve all rejected rows in staging.
    order = sorted(range(len(rows)), key=lambda i: rows[i]['verification']['status'] != 'automated_verified')
    exact, near, semantic, representatives = {}, {}, {}, {}
    duplicates = []
    for i in order:
        row = rows[i]
        prompt = canonical_prompt(row['prompt'])
        shape = canonical_prompt(row['prompt'], numbers=True)
        semantic_group = row.get('semanticSimilarityGroup')
        independent_target = independent_duplicates.get(row['id'])
        if independent_target:
            independent_target = representatives.get(independent_target, independent_target)
        target = exact.get(prompt) or near.get(shape) or semantic.get(semantic_group) or independent_target
        if target:
            row['duplicateOf'] = target
            row['duplicateReason'] = ('exact_prompt' if prompt in exact else 'same_prose_changed_constants'
                                      if shape in near else 'same_symbolic_task_review_candidate'
                                      if semantic.get(semantic_group) else 'independent_duplicate_audit')
            duplicates.append({'id': row['id'], 'duplicateOf': target, 'reason': row['duplicateReason']})
            representatives[row['id']] = target
            if semantic_group:
                semantic.setdefault(semantic_group, target)
        else:
            exact[prompt] = row['id']
            near[shape] = row['id']
            representatives[row['id']] = row['id']
            if semantic_group:
                semantic[semantic_group] = row['id']
    usable = [row for row in rows if row['verification']['status'] == 'automated_verified' and not row.get('duplicateOf')]
    usable_ids = {row['id'] for row in usable}
    pending = [row for row in rows if row['id'] not in usable_ids and not row.get('duplicateOf')]
    summary = {
        'schemaVersion': 1, 'pipelineVersion': VERSION,
        'existing': len(original), 'newTYT': len(tyt['questions']), 'newAYT': len(ayt['questions']),
        'mathematicsPassed': sum(row['verification']['mathPassed'] for row in rows),
        'mathematicsNotPassed': sum(not row['verification']['mathPassed'] for row in rows),
        'needsReviewBeforeDedup': sum(row['verification']['status'] != 'automated_verified' for row in rows),
        'blockingReasonsBeforeDedup': dict(sorted(Counter(reason for row in rows for reason in row['verification']['reasons']).items())),
        'pendingReview': len(pending), 'duplicateExcluded': len(duplicates),
        'duplicateReasons': dict(sorted(Counter(item['reason'] for item in duplicates).items())),
        'totalUsableUnique': len(usable), 'stagedTotal': len(rows),
        'usableImported': sum(row['pool'] == 'imported' for row in usable),
        'usableGeneratedTYT': sum(row['pool'] == 'generated' and row['examType'] == 'TYT' for row in usable),
        'usableGeneratedAYT': sum(row['pool'] == 'generated' and row['examType'] == 'AYT' for row in usable),
        'usableByDifficulty': dict(Counter(row['difficulty'] for row in usable)),
        'usableByCourse': dict(sorted(Counter(row['courseId'] for row in usable).items())),
        'originalInlineQuestions': 0, 'originalSourceReferences': 8, 'originalPageReferences': 185,
        'originalExamIndexPositions': 480,
        'limits': ['Automated mathematical checks do not constitute human editorial approval.',
                   'Near-clone quarantine is conservative text-shape detection, not an exhaustive semantic proof.',
                   'Original publisher PDFs and question bodies are absent; references are not questions.'],
    }
    serial = lambda obj: json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    write('data/ai/imported.js', '// Generated by scripts/build-ai-bank.py; all staged archive rows, including quarantined rows.\nexport const IMPORTED_AI_QUESTIONS = ' + compact(imported_rows) + ';\n', args.check)
    write('data/ai/generated.js', '// Generated offline; no browser-time question generation.\nexport const GENERATED_AI_QUESTIONS = ' + compact(generated_rows) + ';\n', args.check)
    write('data/ai-bank.js', "// Rebuild with npm run build:ai-bank; original sources stay separate.\nimport {IMPORTED_AI_QUESTIONS} from './ai/imported.js?v=ai-bank-20261112';\nimport {GENERATED_AI_QUESTIONS} from './ai/generated.js?v=ai-bank-20261112';\nexport const AI_BANK = {schemaVersion: 1, questions: [...IMPORTED_AI_QUESTIONS, ...GENERATED_AI_QUESTIONS]};\nexport const ORIGINAL_INDEX_SUMMARY = {sourceCount: 8, pageReferenceCount: 185, examIndexCount: 480, inlineQuestionCount: 0};\n", args.check)
    write('data/ai/bank-summary.json', serial(summary), args.check)
    write('data/ai/review-ledger.json', serial({'schemaVersion': 1, 'duplicates': duplicates, 'pending': [
        {'id': row['id'], 'reasons': row['verification']['reasons'], 'mathPassed': row['verification']['mathPassed']}
        for row in pending]}), args.check)
    write('data/ai/similarity-review.json', serial({'schemaVersion': 1, 'action': 'Conservative quarantine: preserve one eligible representative of each repeated symbolic task.',
        'limitations': 'Coefficient-neutral symbolic structure is a near-clone heuristic; different representations may require later editorial reassessment.',
        'groups': generation_report.get('semanticSimilarityGroups', [])}), args.check)
    ledgers = {'TYT': tyt.get('ledger', []), 'AYT': ayt.get('ledger', [])}
    batch_manifest = {
        'schemaVersion': 1, 'pipelineVersion': VERSION, 'archiveHash': digest(original),
        'subtopicLabelsHash': digest(LABELS),
        'generatedHash': digest(generated), 'independentImportAuditHash': digest(audits),
        'independentGenerationAuditHash': digest(generation_audits),
        'independentImportBinding': {'inputSha256':import_report['inputSha256'],
                                     'validatorSha256':import_report['validatorSha256']},
        'independentGenerationBinding': {'inputs':generation_report['inputs'],
                                         'validatorSha256':generation_report['validatorSha256']},
        'batches': [
            {'id': f'{kind}-{start // 100 + 1:03}', 'ids': [row['id'] for row in batch[start:start + 100]],
             'contentHash': digest(batch[start:start + 100]), 'status': 'audited',
             'usableIds': [row['id'] for row in batch[start:start + 100] if row['id'] in usable_ids]}
            for kind, batch in [('imported', imported_rows), ('generated-TYT', generated_rows[:len(tyt['questions'])]), ('generated-AYT', generated_rows[len(tyt['questions']):])]
            for start in range(0, len(batch), 100)
        ],
        'sourceLedger': ledgers,
    }
    write('data/ai/batch-manifest.json', serial(batch_manifest), args.check)
    print(serial(summary), end='')

if __name__ == '__main__':
    main()
