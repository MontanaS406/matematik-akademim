#!/usr/bin/env python3
"""Package the supplied originals for personal, key-gated browser access.

Public output contains authenticated ciphertext only. Source files, raw OCR,
solutions and the random access key remain private. All source pages are included
so an imperfect question crop never hides the original question/figure/options.
This packaging step does not grant mathematical or editorial approval.
"""
import argparse
import base64
import concurrent.futures
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil

import fitz
from PIL import Image
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b'MAARC1\x00\x00'
ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_bytes(json_bytes(value) + b'\n')
    tmp.replace(path)


def seal(data, key, bundle, resource):
    nonce = secrets.token_bytes(12)
    return MAGIC + nonce + AESGCM(key).encrypt(nonce, data, (bundle + ':' + resource).encode())


def source_path(doc, old_root, new_root):
    choices = [Path(old_root) / 'extracted' / doc['archive'] / doc['member'],
               Path(new_root) / 'pdfs' / (doc['sha256'] + '.pdf')]
    for path in choices:
        if path.is_file() and digest(path.read_bytes()) == doc['sha256']:
            return path
    raise ValueError('Missing or changed supplied source: ' + doc['id'])


def render_document(task):
    doc, path, output, bundle, key, max_pixels = task
    output = Path(output)
    pages = []
    with fitz.open(path) as pdf:
        if pdf.needs_pass or len(pdf) != doc['pageCount']:
            raise ValueError('Source page count/password mismatch: ' + doc['id'])
        for number, page in enumerate(pdf, 1):
            scale = min(2.0, max_pixels / max(page.rect.width, page.rect.height))
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            picture = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            encoded = io.BytesIO()
            picture.save(encoded, format='WEBP', lossless=True, method=1)
            resource = 'page/' + doc['id'] + '/' + str(number)
            name = doc['id'] + '-' + str(number).zfill(4) + '.bin'
            ciphertext = seal(encoded.getvalue(), key, bundle, resource)
            target = output / name
            target.write_bytes(ciphertext)
            pages.append({'number': number, 'rect': list(page.rect), 'width': pix.width,
                          'height': pix.height, 'resource': resource,
                          'asset': 'assets/personal-archive/' + bundle + '/' + name,
                          'sha256': digest(ciphertext), 'bytes': len(ciphertext)})
    return {'id': doc['id'], 'sha256': doc['sha256'], 'fileName': doc['fileName'],
            'title': doc.get('title') or doc['fileName'], 'category': doc.get('categoryDirectoryLabel'),
            'pages': pages}


def normalize_question(q, by_sha):
    source = q.get('source') or {}
    doc = by_sha.get(source.get('sha256'))
    if not doc:
        raise ValueError('Question without supplied source: ' + q['id'])
    assets = q.get('captureAssets') or q.get('sourceAssets') or {}
    assets = assets if isinstance(assets, dict) else {}
    raw_parts = assets.get('parts') or [{'physicalPage': source.get('physicalPage'),
                                       'clipRect': source.get('clipRect') or source.get('bbox')}]
    parts = []
    for part in raw_parts:
        page = part.get('physicalPage')
        if isinstance(page, int) and 1 <= page <= doc['pageCount']:
            rect = part.get('clipRect') or part.get('bbox')
            valid = isinstance(rect, list) and len(rect) == 4 and all(isinstance(x, (int, float)) and math.isfinite(x) for x in rect)
            valid = valid and rect[2] > rect[0] and rect[3] > rect[1]
            parts.append({'page': page, 'rect': rect if valid else None})
    verification = q.get('verification') or {}
    checked = verification.get('mathPassed') is True and verification.get('status') == 'automated_verified'
    answer = q.get('answer') or {}
    value = answer.get('value')
    value = str(value) if value is not None else None
    options = [{'id': row['id'], 'text': str(row.get('text') or '')}
               for row in (q.get('options') or []) if isinstance(row, dict)
               and isinstance(row.get('id'), str) and re.fullmatch('[ABCDE]', row['id'])]
    five_choices = len(options) == 5 and len({row['id'] for row in options}) == 5
    if not five_choices:
        options = []  # The original image remains authoritative; never invent missing options.
    kind = q.get('examType')
    if kind not in ['TYT', 'AYT']:
        kind = doc.get('categoryDirectoryLabel')
        kind = 'TYT' if kind == 'TYT_DENEMESI' else kind if kind in ['TYT', 'AYT'] else None
    steps = q.get('solutionSteps') or (answer.get('solution') or '').split('\n')
    return {'id': q['id'], 'origin': 'ORIJINAL', 'docId': doc['id'], 'examType': kind,
            'courseId': q.get('courseId'), 'topic': q.get('topic') or 'Konu incelemede',
            'subtopic': q.get('subtopic'), 'topicReviewed': checked,
            'number': source.get('questionNumber'), 'parts': parts,
            'printedPage': source.get('printedPage'), 'prompt': str(q.get('prompt') or ''),
            'options': options, 'hasChoices': five_choices or q.get('fiveChoiceLabelsDetected') is True or
                isinstance(q.get('extraction'), dict) and q['extraction'].get('fiveChoiceLabels') is True or q.get('examNumber') is not None,
            'answer': {'value': value,
                'status': 'independently_checked' if checked else 'publisher_unchecked' if value else 'missing'},
            'solutionSteps': [str(step) for step in steps if step],
            'mathPassed': checked, 'locationStatus': 'captured' if parts else 'needs_review'}


def build(args):
    inventory = json.loads(Path(args.inventory).read_text())
    bank = json.loads(Path(args.bank).read_text())
    docs = inventory['documents']
    if len({doc['id'] for doc in docs}) != len(docs):
        raise ValueError('Duplicate source document IDs')
    if len({q['id'] for q in bank['questions']}) != len(bank['questions']):
        raise ValueError('Duplicate source record IDs')
    identity = digest(json_bytes([digest(Path(args.bank).read_bytes()),
                                   [(d['id'], d['sha256'], d['pageCount']) for d in docs], args.max_pixels]))
    bundle = 'personal-' + identity[:16]
    key_path = Path(args.key_file)
    try:
        local_key = key_path.resolve().relative_to(ROOT)
    except ValueError:
        local_key = None
    if local_key is not None and local_key.parts[0] not in ['private', 'work']:
        raise ValueError('The access key must stay in ignored private/work or outside the repository')
    if key_path.exists():
        secret = json.loads(key_path.read_text())
        if secret['bundleId'] != bundle:
            raise ValueError('Use a new private key file for a changed source bundle; do not overwrite the old key')
        key = base64.urlsafe_b64decode(secret['key'] + '==')
    else:
        key = secrets.token_bytes(32)
        secret = {'bundleId': bundle, 'key': base64.urlsafe_b64encode(key).decode().rstrip('=')}
        write_json(key_path, secret)
        key_path.chmod(0o600)
    output = ROOT / 'assets/personal-archive' / bundle
    output.mkdir(parents=True, exist_ok=True)
    checkpoint = ROOT / 'work' / (bundle + '-progress.json')
    previous = json.loads(checkpoint.read_text()) if checkpoint.exists() else {'identity': identity, 'documents': {}}
    if previous.get('identity') != identity:
        raise ValueError('Checkpoint input identity changed')
    completed = previous['documents']
    tasks = []
    for doc in docs:
        old = completed.get(doc['id'])
        if old and all((ROOT / page['asset']).is_file() and digest((ROOT / page['asset']).read_bytes()) == page['sha256'] for page in old['pages']):
            continue
        tasks.append((doc, str(source_path(doc, args.old_root, args.new_root)), str(output), bundle, key, args.max_pixels))
    print(json.dumps({'stage': 'rendering_original_pages', 'documents': len(docs), 'remaining': len(tasks)}, ensure_ascii=False), flush=True)
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        for doc in pool.map(render_document, tasks, chunksize=1):
            completed[doc['id']] = doc
            write_json(checkpoint, previous)
            print(json.dumps({'stage': 'document_saved', 'completed': len(completed), 'total': len(docs),
                              'pages': len(doc['pages']), 'freeMiB': shutil.disk_usage(ROOT).free // 1048576}), flush=True)
    by_sha = {doc['sha256']: doc for doc in docs}
    rejected = [q for q in bank['questions'] if q.get('verification', {}).get('status') == 'duplicate_rejected']
    questions = [normalize_question(q, by_sha) for q in bank['questions'] if q not in rejected]
    normalized_docs = [completed[d['id']] for d in docs]
    q_by_doc = {}
    for q in questions:
        q_by_doc.setdefault(q['docId'], []).append(q)
    key_data = json.loads(Path(args.answer_keys).read_text())
    key_doc = by_sha.get(key_data['source']['sha256'])
    if not key_doc:
        raise ValueError('Original answer-key source missing')
    exams = []
    for doc in normalized_docs:
        match = re.fullmatch(r'Orijinal_TYT_Deneme_(\d+)_40_Soru\.pdf', doc['fileName'])
        if not match:
            continue
        number = int(match.group(1))
        rows = q_by_doc.get(doc['id'], [])
        if len(rows) != 40 or sorted(q['number'] for q in rows) != list(range(1, 41)):
            raise ValueError('Original 40-question exam capture incomplete: ' + doc['id'])
        rows = sorted(rows, key=lambda q: q['number'])
        key_string = ''.join(key_data['tables'][str(number)]['answers'][str(i)] for i in range(1, 41))
        if not re.fullmatch('[ABCDE]{40}', key_string) or any(q['answer']['value'] != key_string[i] for i, q in enumerate(rows)):
            raise ValueError('Publisher key/question mismatch: ' + doc['id'])
        ids = [q['id'] for q in rows]
        manifest = digest(json_bytes([doc['sha256'], ids, key_string]))
        exams.append({'id': 'original-exam-' + doc['sha256'][:24], 'type': 'TYT', 'number': number,
                      'docId': doc['id'], 'distributionVersion': 'original-source-v1',
                      'manifest': manifest, 'questionIds': ids, 'actualCount': 40, 'targetCount': 40,
                      'isOfficial': False, 'origin': 'ORIJINAL', 'answerKey': key_string,
                      'keyVerified': True, 'keyKind': 'publisher', 'keyDocId': key_doc['id'], 'keyPage': 1})
    counts = {'documents': len(docs), 'pages': sum(len(d['pages']) for d in normalized_docs),
              'records': len(questions), 'duplicateCaptures': len(rejected),
              'mathematicallyChecked': sum(q['mathPassed'] for q in questions),
              'pendingReview': sum(not q['mathPassed'] for q in questions),
              'publisherAnswers': sum(q['answer']['value'] is not None for q in questions), 'exams': len(exams)}
    index = {'version': 1, 'id': bundle, 'counts': counts, 'documents': normalized_docs,
             'questions': questions, 'exams': sorted(exams, key=lambda e: e['number']),
             'duplicates': [{'id': q['id'], 'source': q.get('source', {})} for q in rejected]}
    write_json(key_path.parent / 'personal-archive-index.json', index)
    compressed = gzip.compress(json_bytes(index), mtime=0)
    index_path = output / 'index.bin'
    ciphertext = None
    if index_path.exists():
        previous_bytes = index_path.read_bytes()
        try:
            if previous_bytes[:8] == MAGIC and AESGCM(key).decrypt(previous_bytes[8:20], previous_bytes[20:], (bundle + ':index').encode()) == compressed:
                ciphertext = previous_bytes
        except Exception:
            pass
    if ciphertext is None:
        ciphertext = seal(compressed, key, bundle, 'index')
        index_path.write_bytes(ciphertext)
    config = {'version': 1, 'id': bundle, 'counts': counts,
              'index': {'asset': 'assets/personal-archive/' + bundle + '/index.bin', 'resource': 'index',
                        'sha256': digest(ciphertext), 'compression': 'gzip'},
              'crypto': {'algorithm': 'AES-GCM', 'bits': 256, 'format': 'MAARC1'}}
    write_json(args.config, config)
    access = key_path.parent / 'Kisisel_Arsiv_Erisim.txt'
    access.write_text('Kişisel Matematik Akademim arşivin\n\n' + args.site_url.rstrip('/') + '/#archive=' + secret['key'] +
                      '\n\nBu bağlantı kişisel arşivini açar. Başkalarıyla paylaşma.\n', encoding='utf-8')
    access.chmod(0o600)
    print(json.dumps({'stage': 'complete', 'counts': counts, 'assetMiB': sum(p.stat().st_size for p in output.glob('*.bin')) // 1048576,
                      'privateAccessFile': str(access)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inventory', default='data/source-pdf-inventory-all.json')
    parser.add_argument('--bank', default='/workspace/pdf-access-check-20261114-new/assembled/original-questions.json')
    parser.add_argument('--old-root', default='/workspace/pdf-access-check-20261113')
    parser.add_argument('--new-root', default='/workspace/pdf-access-check-20261114-new')
    parser.add_argument('--answer-keys', default='/workspace/pdf-access-check-20261113/bulk/exams/answer-key.json')
    parser.add_argument('--key-file', default='private/personal-archive-access.json')
    parser.add_argument('--config', default='data/personal-archive.json')
    parser.add_argument('--site-url', default='https://montanas406.github.io/matematik-akademim')
    parser.add_argument('--max-pixels', type=int, default=2200)
    parser.add_argument('--workers', type=int, default=4)
    build(parser.parse_args())
