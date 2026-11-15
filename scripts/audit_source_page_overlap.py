#!/usr/bin/env python3
"""Privately audit exact rendered-page overlap between supplied PDF manifests.

Only nonblank, byte-identical RGB rasters at the same dimensions establish an
automatic page duplicate. Text similarity, blank text, and shared publisher
artwork never establish a duplicate. Reflowed editions require human review.
The source documents, raster data, and original question text are not exported.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import multiprocessing
import tempfile
from concurrent.futures import ProcessPoolExecutor,as_completed
from pathlib import Path

VERSION='exact-page-overlap-v1'
REPO=Path(__file__).resolve().parents[1]

def sha(data):return hashlib.sha256(data).hexdigest()

def private_output(path):
    path=Path(path).resolve()
    if path==REPO or REPO in path.parents:
        allowed=REPO/'private'
        if path!=allowed and allowed not in path.parents:
            raise ValueError('Source audit output must remain private, outside the repository or under ignored private/')
    return path

def pdf_rows(manifest):
    return [r for r in manifest if r.get('type')=='.pdf']

def fingerprint_document(task):
    import fitz
    from PIL import Image
    row,cache_dir,dpi=task
    file_path=Path(row['path']);actual=sha(file_path.read_bytes())
    if actual!=row['sha256']:raise ValueError('PDF bytes differ from manifest: '+row['member'])
    identity=sha((VERSION+'|'+actual+'|'+str(dpi)).encode())
    target=Path(cache_dir)/(identity+'.json')
    if target.exists():
        cached=json.loads(target.read_text())
        if cached.get('identity')==identity:return cached
    pages=[]
    with fitz.open(file_path) as pdf:
        if pdf.needs_pass:raise ValueError('Encrypted PDF requires review: '+row['member'])
        for physical_page,page in enumerate(pdf,1):
            pix=page.get_pixmap(matrix=fitz.Matrix(dpi/72,dpi/72),alpha=False,colorspace=fitz.csRGB)
            sample=pix.samples
            raster=sha(f'{pix.width},{pix.height},RGB|'.encode()+sample)
            gray=Image.frombytes('RGB',(pix.width,pix.height),sample).convert('L')
            histogram=gray.histogram();ink_pixels=sum(histogram[:245])
            nonblank=ink_pixels>=64 and ink_pixels/(pix.width*pix.height)>=0.0001
            pages.append({'physicalPage':physical_page,'rasterSha256':raster,'pixelWidth':pix.width,
                'pixelHeight':pix.height,'pageWidthPoints':round(page.rect.width,4),'pageHeightPoints':round(page.rect.height,4),
                'nonblank':nonblank,'inkPixelCount':ink_pixels,'nativeTextCharacters':len(page.get_text().strip()),
                'imageOccurrenceCount':len(page.get_image_info()),'matchEligibility':'exact_nonblank_raster' if nonblank else 'blank_or_negligible_ink_excluded'})
    result={'identity':identity,'sha256':actual,'pageCount':len(pages),'pages':pages}
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result

def group_exact_matches(old_records,new_records):
    index={}
    for record in old_records:
        for page in record['pages']:
            if not page['nonblank']:continue
            index.setdefault(page['rasterSha256'],[]).append({'sha256':record['sha256'],
                'relativePath':record['relativePath'],'physicalPage':page['physicalPage']})
    matches=[]
    for record in new_records:
        for page in record['pages']:
            if not page['nonblank']:continue
            if page['rasterSha256'] in index:
                matches.append({'new':{'sha256':record['sha256'],'relativePath':record['relativePath'],
                    'physicalPage':page['physicalPage']},'old':index[page['rasterSha256']],
                    'rasterSha256':page['rasterSha256'],'basis':'byte_identical_nonblank_rendered_RGB_page',
                    'automaticExactPageDuplicate':True})
    return matches

def self_test():
    old=[{'sha256':'old','relativePath':'old.pdf','pages':[
        {'physicalPage':1,'rasterSha256':'blank','nonblank':False},
        {'physicalPage':2,'rasterSha256':'actual','nonblank':True}]}]
    new=[{'sha256':'new','relativePath':'new.pdf','pages':[
        {'physicalPage':1,'rasterSha256':'blank','nonblank':False},
        {'physicalPage':2,'rasterSha256':'actual','nonblank':True},
        {'physicalPage':3,'rasterSha256':'different','nonblank':True}]}]
    result=group_exact_matches(old,new)
    assert len(result)==1 and result[0]['new']['physicalPage']==2
    try:private_output(REPO/'data/unsafe-audit')
    except ValueError:pass
    else:raise AssertionError('Public original-source output accepted')
    import fitz
    with tempfile.TemporaryDirectory(prefix='page-overlap-selftest-') as temp:
        directory=Path(temp);first=directory/'first.pdf';second=directory/'second.pdf'
        with fitz.open() as pdf:
            pdf.new_page(width=200,height=240)
            page=pdf.new_page(width=200,height=240);page.insert_text((30,40),'Raster audit fixture')
            pdf.save(first)
        with fitz.open(first) as source,fitz.open() as pdf:
            pdf.insert_pdf(source)
            pdf.insert_pdf(source,from_page=1,to_page=1)
            pdf[2].insert_text((30,80),'Changed source watermark')
            pdf.save(second)
        rows=[{'path':str(p),'sha256':sha(p.read_bytes()),'member':p.name} for p in (first,second)]
        records=[dict(fingerprint_document((row,str(directory),72)),relativePath=row['member']) for row in rows]
        assert records[0]['pages'][0]['nonblank'] is False
        matches=group_exact_matches(records[:1],records[1:])
        assert len(matches)==1 and matches[0]['new']['physicalPage']==2
        assert matches[0]['old'][0]['physicalPage']==2
    print('Source overlap self-test passed: blanks excluded, exact pixels required, private output guarded.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--old-manifest',default='/workspace/pdf-access-check-20261113/files.json')
    parser.add_argument('--new-manifest',default='/workspace/pdf-access-check-20261114-new/files.json')
    parser.add_argument('--output',default='/workspace/pdf-access-check-20261114-new/page-overlap-audit.json')
    parser.add_argument('--manual-review',default='/workspace/pdf-access-check-20261114-new/manual-question-overlap-review.json')
    parser.add_argument('--dpi',type=int,default=72)
    parser.add_argument('--workers',type=int,default=2)
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:self_test();return
    output=private_output(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    cache_dir=output.parent/'page-overlap-cache';cache_dir.mkdir(exist_ok=True)
    old_bytes=Path(args.old_manifest).read_bytes();new_bytes=Path(args.new_manifest).read_bytes()
    old_rows=pdf_rows(json.loads(old_bytes));new_rows=pdf_rows(json.loads(new_bytes))
    unique={r['sha256']:r for r in old_rows+new_rows};fingerprints={};errors=[]
    with ProcessPoolExecutor(max_workers=max(1,min(args.workers,2)),mp_context=multiprocessing.get_context('spawn')) as pool:
        futures={pool.submit(fingerprint_document,(row,str(cache_dir),args.dpi)):row for row in unique.values()}
        for future in as_completed(futures):
            row=futures[future]
            try:fingerprints[row['sha256']]=future.result()
            except Exception as error:errors.append({'sha256':row['sha256'],'member':row['member'],'error':type(error).__name__+':'+str(error)})
            if len(fingerprints)%20==0:print(json.dumps({'documentsFingerprinted':len(fingerprints),'of':len(unique),'errors':len(errors)}),flush=True)
    def records(rows):
        return [dict(fingerprints[r['sha256']],relativePath=r['archive']+'/'+r['member']) for r in rows if r['sha256'] in fingerprints]
    old_records=records(old_rows);new_records=records(new_rows);matches=group_exact_matches(old_records,new_records)
    manual_path=Path(args.manual_review);manual=json.loads(manual_path.read_text()) if manual_path.exists() else {'status':'not_performed','questionMatches':[]}
    page_reviews={r['rasterSha256']:r for r in manual.get('pageRasterGroupReviews',[])}
    for match in matches:
        review=page_reviews.get(match['rasterSha256'])
        if review:
            match['humanReviewedContentClassification']=review['classification']
            match['isQuestionPageDuplicate']=review.get('containsMathQuestions')
    result={'schemaVersion':1,'version':VERSION,'dpi':args.dpi,
        'manifestSnapshots':{'oldSha256':sha(old_bytes),'newSha256':sha(new_bytes),
            'oldManifest':str(Path(args.old_manifest).resolve()),'newManifest':str(Path(args.new_manifest).resolve())},
        'oldDocuments':old_records,'newDocuments':new_records,'exactPageMatches':matches,'errors':errors,
        'manualQuestionOverlapReview':manual,
        'summary':{'oldPdfDocumentsExpected':len(old_rows),'newPdfDocumentsExpected':len(new_rows),
            'oldPdfDocumentsOpened':len(old_records),'newPdfDocumentsOpened':len(new_records),
            'oldPagesRendered':sum(r['pageCount'] for r in old_records),'newPagesRendered':sum(r['pageCount'] for r in new_records),
            'newPagesExactlyMatchingOld':len(matches),'blankPagesExcluded':sum(not p['nonblank'] for r in old_records+new_records for p in r['pages']),
            'exactMatchingNonQuestionPages':sum(m.get('isQuestionPageDuplicate') is False for m in matches),
            'exactMatchingQuestionPagesConfirmed':sum(m.get('isQuestionPageDuplicate') is True for m in matches),
            'manualConfirmedRepeatedQuestions':len(manual.get('questionMatches',[])),
            'completeness':'all_snapshot_documents_opened' if not errors and len(old_records)==len(old_rows) and len(new_records)==len(new_rows) else 'incomplete_review_required'},
        'limitations':['No fuzzy visual or text similarity is treated as an automatic duplicate.',
            'A different crop, page size, watermark, or reflowed edition can evade exact raster matching.',
            'An exact shared page does not establish that every question in either entire PDF is duplicated.',
            'Only the manifest snapshots above were audited; additions after those snapshots require a resumable rerun.']}
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['summary'],ensure_ascii=False),flush=True)

if __name__=='__main__':main()
