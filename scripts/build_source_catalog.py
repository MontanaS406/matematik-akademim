#!/usr/bin/env python3
"""Rebuild the public, metadata-only browser catalog without private PDFs."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN = {'prompt','options','solution','solutionSteps','pdfPath','pdfBytes','image','imagePath','text'}

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def build(inventory, payload):
    docs = {doc['id']:doc for doc in inventory['documents']}
    seen = set()
    for evidence in payload['evidence'] + payload.get('reviewQueue', []):
        if evidence['id'] in seen:
            raise ValueError('Duplicate read-evidence ID')
        seen.add(evidence['id'])
        document = docs[evidence['sourceDocumentId']]
        if document['sha256'] != evidence['sha256'] or not 1 <= evidence['physicalPage'] <= document['pageCount']:
            raise ValueError('Read evidence no longer matches source inventory')
        if FORBIDDEN & evidence.keys() or evidence['publishable'] is not False:
            raise ValueError('Original bodies or publication grants cannot enter metadata-only catalog')
    summary = payload['summary']
    if summary['pdfCount'] != len(docs) or summary['pageCount'] != sum(doc['pageCount'] for doc in docs.values()):
        raise ValueError('Read-evidence totals differ from actual PDF inventory')
    if summary['privateVerifiedQuestions'] != len(payload['evidence']) or summary['privatePendingQuestions'] != len(payload.get('reviewQueue', [])):
        raise ValueError('Curated-source totals differ from evidence coverage')
    if summary['publishableQuestions'] != 0 or any(doc['rights']['allowsPublicInline'] for doc in docs.values()):
        raise ValueError('No original reuse permission has been verified in this source batch')
    safe_docs = [{key:doc[key] for key in ('id','fileName','sha256','pageCount')}
                 | {'permissionStatus':doc['rights']['status']} for doc in inventory['documents']]
    return ('// Metadata only. Original source bodies and page images stay private.\n'
            + 'export const SOURCED_ARCHIVE_SUMMARY = ' + canonical(summary) + ';\n'
            + 'export const SOURCE_DOCUMENTS = ' + canonical(safe_docs) + ';\n'
            + 'export const SOURCE_READ_EVIDENCE = ' + canonical(payload['evidence']) + ';\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', default='data/source-pdf-inventory.json')
    parser.add_argument('--evidence', default='data/source-read-evidence.json')
    parser.add_argument('--output', default='data/source-catalog.js')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build(json.loads((ROOT / args.inventory).read_text()), json.loads((ROOT / args.evidence).read_text()))
    target = ROOT / args.output
    if args.check:
        if target.read_text() != result:
            raise SystemExit('Source catalog differs from its metadata inputs')
    else:
        target.write_text(result)
    print('Source catalog metadata checked; original bodies excluded.')
