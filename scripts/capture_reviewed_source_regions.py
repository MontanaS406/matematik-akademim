#!/usr/bin/env python3
"""Preserve PRIVATE source regions located by an explicit visual review.

Only source geometry and actually read labels are accepted. No question,
choice or answer is invented; uncertain text remains pending. This is separate
from mathematical curation and from automatic page segmentation checkpoints.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import extract_meb_questions as meb

ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def private(p):
    p=Path(p).resolve()
    if p==ROOT or ROOT in p.parents:raise ValueError('Original source regions must remain outside the checkout')
    return p

def example_anchors(page):
    anchors=[]
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            text=''.join(s['text'] for s in line['spans']).strip()
            # The capital Ö is outlined in this source; the real text layer
            # starts with "rnek". Accept only a whole example-label line.
            m=re.fullmatch(r'(?:[Öö])?rnek\s*[-–]\s*(\d{1,2})',text,re.I)
            if m:anchors.append({'number':int(m[1]),'bbox':list(line['bbox'])})
    return anchors

def run(a):
    import fitz
    out=private(a.output);out.mkdir(parents=True,exist_ok=True)
    rows=[r for r in json.loads(Path(a.manifest).read_text()) if r.get('type')=='.pdf']
    sources={r['sha256']:r for r in rows}
    review=json.loads(Path(a.review).read_text())
    questions=[];pages=[];documents={}
    def capture(row,page,physical,number,box,kind,letter=None,printed_page=None):
        if sha(row['path'])!=row['sha256']:raise ValueError('Source PDF bytes changed')
        prefix='EX' if kind=='publisher_worked_multiple_choice_example' else 'VIS'
        ident=f'ORIG-{row["sha256"][:12]}-P{physical:03}-{prefix}{number:02}'
        file=out/f'{ident}.png'
        page.get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(box),alpha=False).save(file)
        raw=page.get_textbox(fitz.Rect(box))
        stem=re.split(r'(?im)^\s*[Çç]?özüm\s*$',raw,maxsplit=1)[0]
        mc=meb.split_mc(stem)
        if printed_page is None:
            footer={int(word[4]) for word in page.get_text('words')
                if word[4].isdigit() and word[1]>page.rect.height*.94
                and page.rect.width*.35<word[0]<page.rect.width*.65}
            if len(footer)==1:printed_page=footer.pop()
        source={'sha256':row['sha256'],'sourceDocumentId':'pdf-'+row['sha256'][:16],
            'relativePath':row['archive']+'/'+row['member'],'physicalPage':physical,
            'questionNumber':None if prefix=='EX' else number,'originalQuestionLabel':('Örnek - ' if prefix=='EX' else '')+str(number),
            'clipRect':list(box),'sourceKind':kind,'printedPage':printed_page}
        label=('AYT' if row['member'].startswith('AYT/') else 'TYT'
            if row['member'].startswith('TYT/') or '_TYT_' in row['member'] else None)
        questions.append({'id':ident,'origin':'ORIJINAL','pool':'original_private',
            'examType':label,'classificationStatus':'source_directory_or_book_label_provisional_question_review_pending',
            'source':source,'prompt':mc['prompt'],'options':mc['options'],'rawSourceText':raw,
            'sourceAssets':{'cropPath':str(file),'cropSha256':sha(file),'sourcePdfPath':row['path'],
                'originalFiguresAndOptionLayoutPreserved':True},
            'extraction':{'status':'visually_located_region_transcription_pending',
                'fiveChoiceLabels':mc['fiveLabels'],'fiveOptionsVisuallyConfirmed':True},
            'answer':{'value':letter,'status':'publisher_letter_visually_read_not_math_verified' if letter else 'unknown'},
            'permission':{'status':'unverified','publishable':False},
            'verification':{'status':'pending_review','mathPassed':False,'methods':[],
                'reasons':['independent_math_check_required','native_or_ocr_formula_transcription_requires_review']}})
        return ident
    for item in review['pages']:
        targets=item.get('fiveOptionQuestionExamples',[])
        if not targets:continue
        row=sources[item['sourceSha256']];physical=item['physicalPage']
        if item.get('sourcePdfOpenedDuringQA') is not True:raise ValueError('Review did not open the actual source page')
        with fitz.open(row['path']) as pdf:
            page=pdf[physical-1];w,h=page.rect.width,page.rect.height
            anchors=example_anchors(page);ids=[]
            for target in targets:
                found=[s for s in anchors if s['number']==target['exampleNumber']]
                if len(found)!=1:raise ValueError('Example label missing or ambiguous: '+str(target['exampleNumber']))
                anchor=found[0];x,y,_,_=anchor['bbox'];right=x>w/2
                next_y=[s['bbox'][1] for s in anchors if (s['bbox'][0]>w/2)==right and s['bbox'][1]>y+5]
                box=[w*.51 if right else w*.04,y-7,w*.97 if right else w*.495,min(next_y)-7 if next_y else h-35]
                ids.append(capture(row,page,physical,target['exampleNumber'],box,
                    'publisher_worked_multiple_choice_example',target.get('publisherAnswerLetterRead')))
            pages.append({'sourceDocumentId':'pdf-'+row['sha256'][:16],'physicalPage':physical,
                'questionIds':ids,'status':'visually_located_worked_multiple_choice_examples_pending_math'})
            documents[row['sha256']]={'id':'pdf-'+row['sha256'][:16],'sha256':row['sha256'],'pageCount':len(pdf)}
    for item in json.loads(Path(a.regions).read_text()).get('regions',[]):
        row=sources[item['sha256']]
        if sha(item['evidenceImagePath'])!=item['evidenceImageSha256']:raise ValueError('Visual review image changed')
        with fitz.open(row['path']) as pdf:
            page=pdf[item['physicalPage']-1];ids=[]
            for region in item['questions']:
                ids.append(capture(row,page,item['physicalPage'],region['number'],region['boxPdf'],
                    'visually_located_raster_multiple_choice',region.get('publisherAnswer'),item.get('printedPage')))
            pages.append({'sourceDocumentId':'pdf-'+row['sha256'][:16],'physicalPage':item['physicalPage'],
                'questionIds':ids,'status':'visually_located_raster_regions_pending_transcription_and_math'})
            documents[row['sha256']]={'id':'pdf-'+row['sha256'][:16],'sha256':row['sha256'],'pageCount':len(pdf)}
    ids=[q['id'] for q in questions]
    if len(set(ids))!=len(ids):raise ValueError('Visual source IDs overlap')
    result={'schemaVersion':1,'scope':'private_visual_region_capture_not_independent_math_approval',
        'questions':questions,'pages':pages,'documents':list(documents.values()),
        'summary':{'questionRegionCandidates':len(questions),'mathVerified':0,'publicOriginals':0}}
    (out/'questions.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['summary']))

def self_test():
    import fitz
    pdf=fitz.open();p=pdf.new_page();p.insert_text((36,80),'rnek - 7');p.insert_text((36,200),'7. solution step')
    assert [x['number'] for x in example_anchors(p)]==[7]
    try:private(ROOT/'data')
    except ValueError:pass
    else:raise AssertionError('Private source output accepted in public tree')
    print('Reviewed regions: outlined-label text and private output gates passed.')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest');p.add_argument('--review');p.add_argument('--regions');p.add_argument('--output');p.add_argument('--self-test',action='store_true')
    a=p.parse_args()
    if a.self_test:self_test()
    else:run(a)
