#!/usr/bin/env python3
"""Read actual PDF bytes into a PRIVATE page/question-candidate staging area.

Nothing from this command is a publishable question bank. Original question
text, page geometry and selected transcriptions remain in a gitignored/private
directory. Question anchors are candidates, never asserted verified questions.
"""
from __future__ import annotations
import argparse
import hashlib
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def private_destination(path):
    path = Path(path).resolve()
    if path == ROOT or ROOT in path.parents:
        private = ROOT / 'private'
        if path != private and private not in path.parents:
            raise ValueError('Original content must be outside this repository or under its ignored private/ directory')
    return path

def question_anchors(words, width, height):
    candidates = []
    for word in words:
        x0, y0, x1, y1, text, *_ = word
        match = re.fullmatch(r'(\d{1,2})[.)]', text)
        # Numbered expressions inside a question can also match. This is only
        # a geometric candidate, not a reliable question-counting algorithm.
        left_column = x0 < width * .18
        right_column = width * .47 < x0 < width * .68
        if match and 0 < int(match[1]) <= 80 and 35 < y0 < height * .93 and (left_column or right_column):
            candidates.append({'number': int(match[1]), 'bbox': [round(v, 3) for v in (x0, y0, x1, y1)],
                               'status': 'candidate_requires_review'})
    return candidates

def run(args):
    import fitz
    out = private_destination(args.output)
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(Path(args.manifest).read_text())
    rows = manifest if isinstance(manifest, list) else manifest.get('files', [])
    documents, errors = [], []
    pages_dir = out / 'pages'
    pages_dir.mkdir(exist_ok=True)
    for row in rows:
        if row.get('type') != '.pdf':
            continue
        path = Path(row['path'])
        content = path.read_bytes()
        fingerprint = sha(content)
        if fingerprint != row['sha256']:
            raise ValueError('PDF no longer matches the supplied manifest: ' + row['member'])
        identifier = 'pdf-' + fingerprint[:16]
        with fitz.open(path) as document:
            if document.needs_pass:
                raise ValueError('Encrypted PDF needs its password: ' + row['member'])
            pages = []
            for index, page in enumerate(document):
                text = page.get_text()
                anchors = question_anchors(page.get_text('words'), page.rect.width, page.rect.height)
                pages.append({'physicalPage': index + 1, 'width': page.rect.width, 'height': page.rect.height,
                              'text': text, 'textSha256': sha(text.encode()), 'anchors': anchors,
                              'requiresVisualExtraction': len(''.join(text.split())) < 30,
                              'status': 'private_page_staging_not_verified_question'})
            payload = {'id': identifier, 'sha256': fingerprint, 'member': row['member'],
                       'sourcePath': str(path), 'archive': row['archive'], 'pageCount': len(document), 'pages': pages}
        target = pages_dir / (identifier + '.json')
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
        documents.append({key: payload[key] for key in ('id', 'sha256', 'member', 'archive', 'pageCount')})
    curated = []
    for path in args.bank:
        payload = json.loads(Path(path).read_text())
        curated.extend(payload if isinstance(payload, list) else payload['questions'])
    if len({row['id'] for row in curated}) != len(curated):
        raise ValueError('Duplicate curated original question IDs')
    by_sha = {row['sha256']: row for row in documents}
    paths_by_sha = {row['sha256']: Path(row['path']) for row in rows if row.get('type') == '.pdf'}
    source_images = {}
    for question in curated:
        source = question['source']
        doc = by_sha.get(source['sha256'])
        if not doc or not isinstance(source['physicalPage'], int) or not 1 <= source['physicalPage'] <= doc['pageCount']:
            raise ValueError('Curated source/page is not a supplied actual PDF: ' + question['id'])
        if question.get('origin') != 'ORIJINAL' or question.get('permission', {}).get('publishable') is not False:
            raise ValueError('Private originals must retain an explicit non-publishable permission gate')
        if len(question.get('options', [])) != 5 or {q['id'] for q in question['options']} != set('ABCDE'):
            raise ValueError('Original transcription needs its actual five options: ' + question['id'])
        position = (source['sha256'], source['physicalPage'])
        if position not in source_images:
            folder = out / 'source-pages'
            folder.mkdir(exist_ok=True)
            image = folder / (doc['id'] + '-p' + str(source['physicalPage']) + '.png')
            with fitz.open(paths_by_sha[source['sha256']]) as pdf:
                pdf[source['physicalPage'] - 1].get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False).save(image)
            source_images[position] = image.relative_to(out).as_posix()
    bank = {'schemaVersion': 1, 'scope': 'private_original_questions_no_public_reuse_permission', 'questions': curated}
    (out / 'original-questions.json').write_text(json.dumps(bank, ensure_ascii=False, indent=2) + '\n')
    preview = ['<!doctype html><html lang="tr"><meta charset="utf-8"><title>Özel kaynak incelemesi</title>',
               '<style>body{font:17px system-ui;max-width:950px;margin:35px auto;padding:20px;color:#182133}article{border:1px solid #ccd;padding:20px;margin:20px 0}pre{white-space:pre-wrap}small{color:#556}</style>',
               '<h1>Özel özgün kaynak incelemesi</h1><p>Yerel inceleme dosyası. Yeniden yayım izni kurulmamış özgün içerik içerir.</p>']
    for q in curated:
        source = q['source']; verified = q['verification'].get('status') == 'automated_verified'
        preview += ['<article><h2>' + html.escape(q['id']) + '</h2><small>' + html.escape(str(q['examType']) + ' · ' + q['topic'] + ' · ' + q['subtopic']) + '</small>',
                    '<p>' + html.escape(Path(source['relativePath']).name) + ' · Dosyada sayfa ' + str(source['physicalPage']) + ' · Soru ' + str(source['questionNumber']) + '</p>',
                    '<pre>' + html.escape(q['prompt']) + '</pre><ol type="A">']
        preview += ['<li>' + html.escape(option['text']) + '</li>' for option in q['options']]
        preview += ['</ol><details><summary>' + ('Kontrol ve çözüm' if verified else 'İnceleme bekliyor; kaynak cevabı resmî doğrulama değildir') + '</summary><pre>' + html.escape(q.get('answer', {}).get('solution', '')) + '</pre></details></article>']
        preview[-1] = preview[-1].replace('</article>', '<details><summary>Özgün sayfa ve şekiller</summary><img style="max-width:100%" alt="Özel kaynak sayfası" src="' + source_images[(source['sha256'], source['physicalPage'])] + '"></details></article>')
    preview += ['</html>']
    (out / 'private-review.html').write_text('\n'.join(preview))
    summary = {'schemaVersion': 1, 'actualDocuments': len(documents), 'actualPages': sum(d['pageCount'] for d in documents),
               'curatedOriginals': len(curated), 'mathematicallyCheckedOriginals': sum(q['verification'].get('status') == 'automated_verified' for q in curated),
               'pendingOriginals': sum(q['verification'].get('status') != 'automated_verified' for q in curated),
               'publishableOriginals': 0, 'note': 'Page anchors/text are unverified staging, not a claimed count of extracted questions.'}
    (out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, ensure_ascii=False))

def self_test():
    for public_path in [ROOT, ROOT / 'data', ROOT / 'tests/fixtures']:
        try:
            private_destination(public_path)
        except ValueError:
            pass
        else:
            raise AssertionError('Public output accepted')
    assert private_destination(ROOT / 'private/source-pdfs').is_absolute()
    assert private_destination('/tmp/private-source-test').is_absolute()
    points = [(20,80,30,90,'1.',0,0,0), (330,90,340,100,'7.',0,0,0), (220,90,230,100,'4.',0,0,0), (20,980,30,990,'99.',0,0,0)]
    assert [row['number'] for row in question_anchors(points, 600, 1000)] == [1,7]
    print('Private ingestion self-test: public output blocked; private paths and geometric candidates checked.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest')
    parser.add_argument('--output', default=str(ROOT / 'private/issue11'))
    parser.add_argument('--bank', action='append', default=[])
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
    else:
        if not args.manifest:
            parser.error('--manifest is required for real PDF ingestion')
        run(args)
