#!/usr/bin/env python3
"""Compile reviewed, supplied originals into AYT sets without generating questions.

Input reviews and readable originals stay in ignored private/work directories.
Only the existing encrypted index and public count metadata are updated. Source
page ciphertext, original TYT identities, AI banks and user stores are unchanged.
"""
import argparse
import base64
import collections
import gzip
import hashlib
import json
from pathlib import Path
import secrets
import subprocess

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parents[1]
MAGIC = b'MAARC1\0\0'


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_bytes(encoded(value) + b'\n')
    temporary.replace(path)


def build(args):
    index_path = ROOT / 'private/personal-archive-index.json'
    index = read(index_path)
    original_questions = {q['id']: q for q in index['questions']}
    documents = {doc['id']: doc for doc in index['documents']}
    definition = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {PRACTICE_DISTRIBUTIONS as D} from './shared/practice-exams.js';console.log(JSON.stringify(D.AYT.topics.filter(t=>t.count)))"
    ], cwd=ROOT))
    quotas = {topic['id']: topic['count'] for topic in definition}
    reviewed, buckets, corrections = {}, collections.defaultdict(list), []
    for review_file in args.review:
        report = read(review_file)
        for candidate in report['candidates']:
            qid, topic = candidate['questionId'], candidate['topicId']
            if qid in reviewed:
                if reviewed[qid]['topicId'] != topic:
                    raise ValueError('Conflicting topic review: ' + qid)
                continue
            q = original_questions[qid]
            evidence = candidate['evidence']
            if (topic not in quotas or candidate.get('choicesConfirmed') is not True or
                evidence.get('value') not in 'ABCDE' or len(evidence['value']) != 1 or
                not evidence.get('publisherKeyVisuallyChecked') or
                evidence['docId'] not in documents or
                not 1 <= evidence['page'] <= len(documents[evidence['docId']]['pages']) or
                not isinstance(evidence['questionNumber'], int) or evidence['questionNumber'] < 1 or
                not evidence.get('label') or not candidate.get('compatibilityNote')):
                raise ValueError('Incomplete source/key/level review: ' + qid)
            parts = candidate.get('recommendedParts') or candidate.get('sourceReview', {}).get('recommendedParts')
            if not parts:
                raise ValueError('An answer-free original question crop must be reviewed: ' + qid)
            for part in parts:
                page = documents[q['docId']]['pages'][part['page'] - 1]
                rect = part.get('rect')
                if (not isinstance(rect, list) or len(rect) != 4 or
                    not page['rect'][0] <= rect[0] < rect[2] <= page['rect'][2] or
                    not page['rect'][1] <= rect[1] < rect[3] <= page['rect'][3]):
                    raise ValueError('Invalid source crop: ' + qid)
            if q['answer']['value'] and q['answer']['value'] != evidence['value']:
                if not candidate.get('answerCorrection'):
                    raise ValueError('Existing answer differs from reviewed key: ' + qid)
                corrections.append(qid)
                q['mathPassed'] = False
            q['parts'] = parts
            q['hasChoices'] = True
            q['topicReviewed'] = True
            q['aytCompatibility'] = {'reviewed': True, 'topicId': topic,
                                     'note': candidate['compatibilityNote']}
            q['answer'] = {'value': evidence['value'], 'status': 'publisher_unchecked',
                           'evidence': {key: evidence[key] for key in
                                        ['docId', 'page', 'questionNumber', 'label', 'value']}}
            check = candidate.get('mathCheck') or {}
            if check.get('passed') is True and check.get('method') and check.get('solutionSteps') and check.get('result') is not None:
                q['mathPassed'] = True
                q['answer']['status'] = 'independently_checked'
                q['solutionSteps'] = check['solutionSteps']
            elif q['mathPassed']:
                q['answer']['status'] = 'independently_checked'
            reviewed[qid] = candidate
            buckets[topic].append(qid)
    missing = {topic: count - len(buckets[topic]) for topic, count in quotas.items()
               if len(buckets[topic]) < count}
    if missing:
        raise ValueError('Reviewed candidates missing; no fabricated replacement: ' + json.dumps(missing))
    for bucket in buckets.values():
        bucket.sort()
    compiled, seen = [], set()
    for number in range(1, args.count + 1):
        ids, topics = [], {}
        for topic, count in quotas.items():
            bucket = buckets[topic]
            for offset in range(count):
                qid = bucket[((number - 1) * count + offset) % len(bucket)]
                ids.append(qid)
                topics[qid] = topic
        if len(set(ids)) != 40:
            raise ValueError('Duplicate within one exam')
        if tuple(ids) in seen:
            continue
        seen.add(tuple(ids))
        answer_key = ''.join(original_questions[qid]['answer']['value'] for qid in ids)
        manifest = hashlib.sha256(encoded(['original-ayt-2025-v1', 'AYT', ids, answer_key, topics])).hexdigest()
        compiled.append({'id': 'compiled-source-AYT-' + str(number) + '-' + manifest[:16],
                         'type': 'AYT', 'number': number, 'kind': 'compiled',
                         'distributionVersion': 'original-ayt-2025-v1', 'manifest': manifest,
                         'questionIds': ids, 'topicByQuestion': topics, 'actualCount': 40,
                         'targetCount': 40, 'isOfficial': False, 'origin': 'ORIJINAL',
                         'answerKey': answer_key, 'keyKind': 'source_mapped', 'keyVerified': True})
    index['compiledExams'] = compiled
    counts = index['counts']
    counts['sourceExams'] = len(index['exams'])
    counts['compiledAytExams'] = len(compiled)
    counts['exams'] = len(index['exams']) + len(compiled)
    counts['mathematicallyChecked'] = sum(q['mathPassed'] for q in index['questions'])
    counts['pendingReview'] = len(index['questions']) - counts['mathematicallyChecked']
    counts['publisherAnswers'] = sum(bool(q['answer']['value']) for q in index['questions'])
    summary = {'version': 1, 'compiledAytExams': len(compiled), 'questionsPerExam': 40,
               'mathSlots': 31, 'geometrySlots': 9, 'reviewedCandidates': len(reviewed),
               'candidatesByTopic': {topic: len(buckets[topic]) for topic in quotas},
               'independentlyCheckedCandidates': sum(original_questions[qid]['mathPassed'] for qid in reviewed),
               'answerCorrections': len(corrections), 'newQuestionsGenerated': 0,
               'aiQuestionsChanged': 0, 'sourcePagesChanged': 0}
    if args.check:
        if read(index_path) != index:
            raise ValueError('Compiled index is out of date')
        print(json.dumps(summary, ensure_ascii=False))
        return
    secret = read(ROOT / 'private/personal-archive-access.json')
    if secret['bundleId'] != index['id']:
        raise ValueError('Archive identity mismatch')
    key = base64.urlsafe_b64decode(secret['key'] + '=')
    config_path = ROOT / 'data/personal-archive.json'
    config = read(config_path)
    target = ROOT / config['index']['asset']
    compressed = gzip.compress(encoded(index), mtime=0)
    current = target.read_bytes()
    aad = (index['id'] + ':index').encode()
    if AESGCM(key).decrypt(current[8:20], current[20:], aad) != compressed:
        nonce = secrets.token_bytes(12)
        target.write_bytes(MAGIC + nonce + AESGCM(key).encrypt(nonce, compressed, aad))
    config['index']['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    config['counts'] = counts
    write(index_path, index)
    write(config_path, config)
    write(ROOT / 'data/source-exam-build-summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--review', action='append', required=True)
    parser.add_argument('--count', type=int, default=12)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args())
