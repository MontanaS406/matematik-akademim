#!/usr/bin/env python3
"""Join PRIVATE source captures and checked curation; export only safe counts.

OCR/crop candidates, publisher key matches, and independent mathematics are
different stages. Ambiguous source positions never inherit a curated approval.
No original bodies, choices, keys, images or local paths enter public progress.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'private-source-assembly-v1'

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def position(q):
    s = q['source']
    return s['sha256'], int(s['physicalPage']), str(s['questionNumber'])

def approved(q):
    v = q.get('verification', {})
    return (v.get('status') == 'automated_verified' and v.get('mathPassed') is True
            and not v.get('reasons') and len(set(v.get('methods', []))) >= 2)

def private_target(path):
    p = Path(path).resolve()
    if p == ROOT or ROOT in p.parents:
        if ROOT / 'private' not in p.parents:
            raise ValueError('Originals must remain outside the repo or in ignored private/')
    return p

def five_labels(q):
    e = q.get('extraction', {})
    return bool(e.get('fiveChoiceLabels') or e.get('allFiveOptionLabelsCaptured')
                or q.get('fiveOptionMarkersRecognised')
                or q.get('extractionStatus') == 'image_region_with_five_choice_labels')

def join(captures, curated):
    ids = [q['id'] for q in captures]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate source capture IDs')
    if len({position(q) for q in curated}) != len(curated):
        raise ValueError('Curated originals must have unique source positions')
    rows = copy.deepcopy(captures)
    index = defaultdict(list)
    for i, q in enumerate(rows):
        if q.get('origin') != 'ORIJINAL' or q.get('permission', {}).get('publishable') is not False:
            raise ValueError('An extractor cannot grant original publication permission')
        index[position(q)].append(i)
        # No pre-existing OCR flag can grant independent approval.
        q['verification'] = {'status':'pending_review', 'mathPassed':False,
            'reasons':list(dict.fromkeys(q.get('verification', {}).get('reasons', []) + ['independent_curation_required']))}
    unmatched, ambiguous = [], []
    for q in curated:
        matches = index.get(position(q), [])
        if len(matches) > 1:
            ambiguous.append(q['id'])
        if len(matches) == 1:
            old = rows[matches[0]]
            replacement = copy.deepcopy(q)
            replacement['captureId'] = old['id']
            replacement['captureAssets'] = old.get('sourceAssets', {})
            replacement['captureExtraction'] = old.get('extraction', old.get('extractionStatus'))
            replacement['fiveChoiceLabelsDetected'] = five_labels(old)
            rows[matches[0]] = replacement
        else:
            # Preserve actual checked records separately; do not approve any
            # ambiguous OCR crop by guessing which printed anchor it belongs to.
            replacement = copy.deepcopy(q)
            replacement['captureMatch'] = 'ambiguous' if matches else 'not_captured'
            rows.append(replacement)
            unmatched.append(q['id'])
    if len({q['id'] for q in rows}) != len(rows):
        raise ValueError('Curated/capture ID collision needs explicit resolution')
    return rows, {'curatedWithoutUniqueCapture':unmatched, 'ambiguousCuratedPositions':ambiguous}

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)

def build(args):
    inventory = json.loads(Path(args.inventory).read_text())
    docs = {d['sha256']:d for d in inventory['documents']}
    batches = [json.loads(Path(p).read_text()) for p in args.batch]
    captures = [q for b in batches for q in b['questions']]
    curated = [q for p in args.curated for q in json.loads(Path(p).read_text())['questions']]
    rows, matches = join(captures, curated)
    repeat_evidence=[]
    if args.question_overlaps:
        review=json.loads(Path(args.question_overlaps).read_text())
        indexed=defaultdict(list)
        for q in rows:indexed[position(q)].append(q)
        for pair in review.get('questionMatches',[]):
            if pair.get('status')!='human_confirmed_repeated_question_in_reflowed_edition':
                continue
            old,new=pair['old'],pair['new']
            old_rows=indexed[(old['sha256'],old['physicalPage'],str(old['questionNumber']))]
            new_rows=indexed[(new['sha256'],new['physicalPage'],str(new['questionNumber']))]
            matched=len(old_rows)==1 and len(new_rows)==1
            if matched:
                q=new_rows[0];q['duplicateOf']=old_rows[0]['id']
                q['duplicateEvidence']='visually_confirmed_reflowed_edition_question'
                q['verification']['status']='duplicate_rejected'
                q['verification']['reasons'].append('confirmed_source_question_repeat')
            repeat_evidence.append({'old':{k:old[k] for k in ('sha256','physicalPage','questionNumber')},
                'new':{k:new[k] for k in ('sha256','physicalPage','questionNumber')},
                'captureMatch':'matched' if matched else 'requires_segmentation_review',
                'status':pair['status']})
    # Exact bytes of every supplied document are reopened, including keys.
    base = Path(args.extracted)
    private_paths = {}
    for manifest in args.manifest:
        for record in json.loads(Path(manifest).read_text()):
            if record.get('type')=='.pdf' and record.get('path'):
                private_paths[record['sha256']]=Path(record['path'])
    for d in docs.values():
        file = private_paths.get(d['sha256'],base / d['archive'] / d['member'])
        if sha(file) != d['sha256']:
            raise ValueError('Source bytes changed: ' + d['fileName'])
    for q in rows:
        s = q['source']; d = docs[s['sha256']]
        if not 1 <= s['physicalPage'] <= d['pageCount']:
            raise ValueError('Invalid source page: ' + q['id'])
    for q in captures:
        assets = q['sourceAssets']
        crop = assets.get('cropPath') or assets.get('questionCrop')
        expected = assets.get('cropSha256') or assets.get('questionCropSha256')
        if not crop or not expected or sha(crop) != expected:
            raise ValueError('Missing or changed private source crop: ' + q['id'])
    # Page-level caches must cover every actual question PDF page; a processed
    # page without a usable anchor remains explicitly unresolved, never empty.
    page_index = {}
    for b in batches:
        pages = list(b.get('pages', []))
        if not pages and b.get('version', '').startswith('private-publisher'):
            pass
        for doc in b.get('documents', []):
            if doc.get('path') and Path(doc['path']).suffix=='.json':
                detail = json.loads(Path(doc['path']).read_text())
                pages += [{**p,'sourceDocumentId':detail['document']['id']} for p in detail.get('pages', [])]
        for p in pages:
            sid = p.get('sourceDocumentId') or p.get('documentId')
            if not sid and p.get('sourceSha256') in docs:
                sid=docs[p['sourceSha256']]['id']
            if not sid:
                continue
            page_index[(sid,p['physicalPage'])] = p
    per_doc = []
    by_doc = defaultdict(list)
    for q in rows:
        by_doc[q['source']['sha256']].append(q)
    for d in inventory['documents']:
        qq = by_doc[d['sha256']]
        captured_pages = sorted({p for sid,p in page_index if sid == d['id']})
        is_key = (d['categoryDirectory'] == 'CEVAP' if 'categoryDirectory' in d else
                  '/CEVAP/' in ('/' + d['member']))
        missing_pages = [p for p in range(1,d['pageCount']+1) if p not in captured_pages]
        per_doc.append({'id':d['id'],'fileName':d['fileName'],'sha256':d['sha256'],
            'pageCount':d['pageCount'],'kind':'answer_key' if is_key else 'question_source',
            'capturePagesRecorded':len(captured_pages),'pagesWithoutExtractionCheckpoint':missing_pages if not is_key else [],
            'questionCandidates':len(qq),'independentlyVerified':sum(approved(q) for q in qq),
            'reviewCandidates':sum(not approved(q) for q in qq),'publishableOriginals':0})
    # Original extracted answer keys are not exported. Counts only.
    provided_keys = sum(q.get('answer', {}).get('value') in 'ABCDE'
                        if isinstance(q.get('answer', {}).get('value'),str) else False for q in captures)
    summary = {'suppliedZipParts':inventory['summary'].get('zipArchiveCount',len(inventory['archives'])),'actualPdfDocuments':len(docs),
        'actualPdfPages':sum(d['pageCount'] for d in docs.values()),
        'sourceQuestionRegionCandidates':len(captures),'privateRecordsAfterCuration':len(rows),
        'curatedOriginalQuestions':len(curated),'independentlyVerifiedOriginals':sum(approved(q) for q in rows),
        'curatedNeedsReview':sum(not approved(q) for q in curated),
        'allReviewCandidates':sum(not approved(q) for q in rows),
        'confirmedRepeatedSourceQuestions':len(repeat_evidence),
        'confirmedRepeatedCaptures':sum(q.get('duplicateEvidence') is not None for q in rows),
        'uniqueRegionCandidatesAfterConfirmedRepeats':len(rows)-sum(q.get('duplicateEvidence') is not None for q in rows),
        'publisherAnswersCaptured':provided_keys,'fiveLabelCandidates':sum(five_labels(q) for q in captures),
        'publishableOriginalQuestions':0,'missingExactPdfNames':inventory.get('requestedV2FilesNotSuppliedByExactName',[]),
        'missingArchivePartNumbers':inventory.get('missingArchiveParts',[]),
        'missingArchiveBasenamesKnown':not inventory.get('missingArchiveParts'),
        'uncheckpointedQuestionPages':sum(len(d['pagesWithoutExtractionCheckpoint']) for d in per_doc),
        **{k:len(v) for k,v in matches.items()}}
    bindings = [{'kind':kind,'fileName':Path(p).name,'sha256':sha(p)}
        for kind, paths in [('capture',args.batch),('curation',args.curated)] for p in paths]
    private = {'schemaVersion':1,'version':VERSION,'summary':summary,'inputs':bindings,
        'captureMatches':matches,'questionRepeatEvidence':repeat_evidence,'questions':rows,'documents':per_doc}
    write(private_target(args.output),private)
    public = {'schemaVersion':1,'version':VERSION,'scope':'metadata_only_no_original_bodies',
        'summary':summary,'inputs':bindings,'documents':per_doc,'confirmedQuestionRepeats':repeat_evidence,
        'limits':['Region extraction and five detected option labels are not a guarantee of complete transcription or correct segmentation.',
                  'Source diagrams/choices and continuation segments are preserved privately; OCR and unresolved layout need review.',
                  'A publisher answer is not independent mathematical verification.',
                  'All original bodies remain private because redistribution rights are unverified.']}
    write(Path(args.public_progress),public)
    print(json.dumps(summary, ensure_ascii=False))

def self_test():
    q={'id':'test-capture','origin':'ORIJINAL','source':{'sha256':'a'*64,'physicalPage':1,'questionNumber':2},
       'permission':{'publishable':False},'verification':{'status':'automated_verified','mathPassed':True,'methods':['false1','false2']}}
    rows,_=join([q],[]); assert not approved(rows[0])
    c=copy.deepcopy(q); c['id']='test-curated'; c['verification']={'status':'automated_verified','mathPassed':True,'methods':['method1','method2']}
    rows,_=join([q],[c]); assert len(rows)==1 and approved(rows[0])
    other=copy.deepcopy(q);other['id']='test-capture2'
    rows,report=join([q,other],[c]); assert len(rows)==3 and sum(map(approved,rows))==1
    assert report['ambiguousCuratedPositions']==['test-curated']
    for path in [ROOT,ROOT/'data/leak.json']:
        try:private_target(path)
        except ValueError:pass
        else:raise AssertionError('Private output gate failed')
    print('Private assembly: untrusted approvals removed, unique overlay and ambiguous positions fail closed, public body output blocked.')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--inventory',default='data/source-pdf-inventory.json')
    p.add_argument('--manifest',action='append',default=[])
    p.add_argument('--batch',action='append',default=[])
    p.add_argument('--curated',action='append',default=[])
    p.add_argument('--extracted')
    p.add_argument('--output')
    p.add_argument('--public-progress',default='data/source-extraction-progress.json')
    p.add_argument('--question-overlaps')
    p.add_argument('--self-test',action='store_true')
    args=p.parse_args()
    if args.self_test:self_test()
    else:build(args)
