#!/usr/bin/env python3
"""Publish metadata-only read evidence from PRIVATE, checked transcriptions.

Question prose, options, worked solutions, original diagrams and absolute paths
never enter either public output. Actual PDF bytes and the selected physical
page are opened again; filename-derived full-book positions remain qualified.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def sha(value):
    return hashlib.sha256(value).hexdigest()

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def build(args):
    import fitz
    inventory = json.loads(Path(args.inventory).read_text())
    documents = {row['sha256']: row for row in inventory['documents']}
    skills = json.loads(Path(args.skills).read_text())
    originals = []
    for file in args.bank:
        originals.extend(json.loads(Path(file).read_text())['questions'])
    if len({q['id'] for q in originals}) != len(originals):
        raise ValueError('Original source IDs must be unique')
    evidence, pending = [], []
    for q in originals:
        source = q['source']
        doc = documents[source['sha256']]
        path = Path(source.get('pdfPath') or Path(args.extracted) / source['relativePath'])
        if sha(path.read_bytes()) != doc['sha256']:
            raise ValueError('Actual source PDF changed: ' + q['id'])
        if q['origin'] != 'ORIJINAL' or q['permission']['publishable'] is not False:
            raise ValueError('This metadata exporter cannot grant original publication permission')
        with fitz.open(path) as pdf:
            page = pdf[source['physicalPage'] - 1]
            page_text_hash = sha(page.get_text().encode())
            # This is a reproducible pixel anchor, not a published page image.
            page_raster_hash = sha(page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False).samples)
        record_hash = sha(canonical({'prompt':q['prompt'], 'options':q['options'], 'answer':q['answer'].get('value')}).encode())
        verified = (q['verification']['status'] == 'automated_verified'
                    and q['verification']['mathPassed'] is True and not q['verification'].get('reasons'))
        metadata = {'id':'read-' + q['id'], 'sourceQuestionId':q['id'], 'sourceDocumentId':doc['id'],
                    'sha256':doc['sha256'], 'physicalPage':source['physicalPage'],
                    'originalPdfPage':source.get('originalPdfPage'), 'printedPage':source.get('printedPage'),
                    'originalPdfPageBasis':'provided_filename_range_not_full_book_verified',
                    'questionNumber':source['questionNumber'], 'examType':q['examType'], 'courseId':q['courseId'],
                    'origin':'ORIJINAL', 'publishable':False, 'readStatus':'read',
                    'answerStatus':'verified' if verified else 'pending_review',
                    'questionContentSha256':record_hash, 'pageTextSha256':page_text_hash,
                    'pageRasterSha256':page_raster_hash,
                    'classificationBasis':'AYT preparation level in a shared-source book; not an actual AYT exam' if q['examType']=='AYT' else 'TYT preparation source question',
                    'isActualExamQuestion':False}
        if verified:
            metadata['generationSkills'] = skills.get(q['id'], [])
            evidence.append(metadata)
        else:
            metadata['reviewReasons'] = q['verification'].get('reasons', [])
            pending.append(metadata)
    all_ids = {q['id'] for q in originals}
    eligible_ids = {row['sourceQuestionId'] for row in evidence}
    if any(key not in eligible_ids for key in skills):
        raise ValueError('A generation skill references an unavailable or pending original')
    summary = {'pdfCount':inventory['summary']['pdfCount'], 'pageCount':inventory['summary']['pageCount'],
               'sourceCount':inventory['summary']['sourceCount'], 'privateQuestionCount':len(originals),
               'privateVerifiedQuestions':len(evidence), 'privatePendingQuestions':len(pending),
               'privateMathematicsPassed':sum(q['verification'].get('mathPassed') is True for q in originals),
               'publishableQuestions':0, 'permissionStatus':'unverified', 'hasAytExamBooklets':False,
               'verifiedByExam':dict(Counter(row['examType'] for row in evidence)),
               'classificationNote':'AYT tags describe preparation-level skills in ORTAK source pages, not an official AYT paper.'}
    public = {'schemaVersion':1, 'scope':'read_evidence_metadata_only_no_original_bodies',
              'summary':summary, 'evidence':evidence, 'reviewQueue':pending}
    Path(args.output).write_text(json.dumps(public, ensure_ascii=False, indent=2) + '\n')
    safe_docs = [{key:doc[key] for key in ('id','fileName','sha256','pageCount')}
                 | {'permissionStatus':doc['rights']['status']} for doc in inventory['documents']]
    module = ('// Metadata only. Original source bodies and page images stay private.\n'
              + 'export const SOURCED_ARCHIVE_SUMMARY = ' + canonical(summary) + ';\n'
              + 'export const SOURCE_DOCUMENTS = ' + canonical(safe_docs) + ';\n'
              + 'export const SOURCE_READ_EVIDENCE = ' + canonical(evidence) + ';\n')
    Path(args.catalog).write_text(module)
    print(json.dumps(summary, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', default='data/source-pdf-inventory.json')
    parser.add_argument('--bank', action='append', required=True)
    parser.add_argument('--extracted', required=True)
    parser.add_argument('--skills', default='data/source-generation-skills.json')
    parser.add_argument('--output', default='data/source-read-evidence.json')
    parser.add_argument('--catalog', default='data/source-catalog.js')
    build(parser.parse_args())
