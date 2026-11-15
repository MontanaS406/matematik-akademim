#!/usr/bin/env python3
"""Capture unchanged question regions from the newly supplied 01–09 archives.

All original images/text stay outside the public checkout. The native pass
checkpoints every real page before a sequential, one-TSV-per-page OCR pass.
Question numbers are read from actual source labels; unknown numbers stay null.
Neither OCR, five choices nor a publisher answer verifies the mathematics.
"""
from __future__ import annotations
import argparse
from collections import Counter
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

import extract_meb_questions as meb
import extract_private_geometry as geometry
import extract_private_publisher_questions as publisher

ROOT=Path(__file__).resolve().parents[1]
VERSION='private-catalog-additions-v1'
ARCHIVE=re.compile(r'0[1-9]_(?:AYT|TYT)\.zip$')


def digest(data):return hashlib.sha256(data).hexdigest()


def private_output(value):
    path=Path(value)
    if path.is_symlink():raise ValueError('Private output cannot be a symlink')
    path=path.resolve()
    if path==ROOT or ROOT in path.parents:raise ValueError('Original question output must remain outside the repository')
    path.mkdir(parents=True,exist_ok=True)
    return path


def atomic_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    if path.is_symlink():raise ValueError('Refusing a symlink output')
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temporary.replace(path)


def profile(row):
    name=Path(row['member']).name
    if name.startswith('MEB_'):return 'meb'
    if name.startswith('Orijinal_TYT_AYT_Geometri'):return 'geometry_pink'
    if name.startswith('Orijinal_TYT_Matematik'):return 'original_blue'
    if name.startswith('OFB_'):return 'ofb_red'
    return 'native_or_ocr'


def mc_data(text):
    text=re.split(r'Ç[öÖ]z[üÜ]m\s*[:：]|ÇÖZÜM\s*[:：]',text,maxsplit=1)[0]
    labels=list(re.finditer(r'(?<![\w(])([A-E])\s*[)）]',text))
    ids=[m[1] for m in labels]
    complete=len(ids)>=5 and ids[-5:]==list('ABCDE')
    if not complete:return {'prompt':text.strip(),'options':[],'labels':ids,'complete':False}
    labels=labels[-5:];options=[]
    for index,label in enumerate(labels):
        end=labels[index+1].start() if index<4 else len(text)
        value=re.split(r'Cevap\s*[:：]',text[label.end():end],flags=re.I)[0].strip()
        options.append({'id':label[1],'text':value,'transcriptionStatus':'unverified_source_transcription'})
    return {'prompt':re.sub(r'^\s*\d{1,2}[.)]\s*','',text[:labels[0].start()]).strip(),
            'options':options,'labels':ids,'complete':all(o['text'] for o in options)}


def content_kind(text,has_regions):
    """Describe only positive source evidence; never infer that a page is blank."""
    normalized=' '.join(text.split())
    examples=re.findall(r'(?:Ö|O)?rnek\s*[-–]\s*\d+',normalized,re.I)
    labels=re.findall(r'(?<![\w(])[A-E]\s*[)）]',normalized)
    evidence={'explicitExampleHeadings':len(examples),'explicitOptionLabels':len(labels),'sourceTextCharacters':len(normalized)}
    if has_regions:return 'question_regions',evidence
    if re.fullmatch(r'Notlar[ıi]m\s*\d*',normalized,re.I):return 'notes',evidence
    if examples and not labels:return 'worked_examples_only',evidence
    title=re.search(r'B[ÖO]L[ÜU]M|[ÜU]N[İI]TE',normalized,re.I)
    brand=re.search(r'YAYINLAR|\bPRF\b',normalized,re.I)
    if title and brand and len(normalized)<650 and not labels and not examples:return 'cover',evidence
    return 'no_reliable_anchor',evidence


def color_boxes(image,kind):
    """Identify real coloured printed markers, never invent their numbers."""
    if kind=='geometry_pink':
        return [{k:v for k,v in item.items() if k!='mask'} for item in geometry.pink_boxes(image)]
    if kind!='original_blue':return []
    import numpy as np
    rgb=np.asarray(image.convert('RGB')).astype('int16');height,width=rgb.shape[:2]
    red,green,blue=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    mask=(blue>red*1.15)&(blue>green*1.08)&(blue>80)&(red<165)
    output=[]
    for column,(left,right) in enumerate(((.075,.115),(.515,.565))):
        x0,x1=round(width*left),round(width*right)
        rows=np.flatnonzero(mask[:,x0:x1].sum(1)>=2);groups=[]
        for y in rows:
            if not groups or y-groups[-1][-1]>4:groups.append([int(y)])
            else:groups[-1].append(int(y))
        for group in groups:
            y0,y1=group[0],group[-1]+1
            if not height*.07<y0<height*.94 or not 5<=y1-y0<=45:continue
            xs=np.flatnonzero(mask[y0:y1,x0:x1].any(0))
            if not len(xs):continue
            bx0,bx1=x0+int(xs[0]),x0+int(xs[-1])+1
            if bx1-bx0>width*.045:continue
            output.append({'column':column,'bboxPixels':[bx0,y0,bx1,y1]})
    return output


def label_in_box(words,box,scale):
    x0,y0,x1,y1=[v/scale for v in box]
    candidates=[]
    for word in words:
        if not (x0-5<=word[0]<=x1+5 and abs(word[1]-y0)<12):continue
        # A high-confidence suffix is not the complete printed number. For
        # example, source "13." can be OCR'd as "3." after dropping its first
        # digit. Require the word to cover the coloured marker's full width.
        if word[0]>x0+2 or word[2]<x1-2:continue
        match=re.fullmatch(r'([1-9]\d?)[.)]?',str(word[4]).strip())
        if match and int(match[1])<=80 and word[5]>=35:candidates.append((int(match[1]),word[5]))
    values={n for n,_ in candidates}
    return (next(iter(values)),min(c for _,c in candidates)) if len(values)==1 else (None,None)


def native_words(page):
    words=[(*word[:5],100.0) for word in page.get_text('words')]
    mode='native_pdf_words'
    if sum(len(w[4]) for w in words)<200:
        try:
            recovered=publisher.xml_words(page)
            if sum(len(w[4]) for w in recovered)>sum(len(w[4]) for w in words)+60:
                words=recovered;mode='native_pdf_xml'
        except Exception:
            # The exact source image remains available if a malformed native
            # font mapping cannot be transcribed. OCR is a separate queue.
            pass
    return words,mode


def full_page_image(page,path,dpi,max_width):
    import fitz
    scale=min(dpi/72,max_width/page.rect.width)
    if not path.exists():page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False).save(path)
    return scale


def read_ocr(path,tsv_path,scale,args):
    if tsv_path.exists():
        raw=tsv_path.read_text()
        if not raw.startswith('level\tpage_num\t'):raise ValueError('Cached OCR is not validated TSV')
    else:
        command=['tesseract',str(path),'stdout','--psm','3','-l',args.lang]
        if args.tessdata_dir:command+=['--tessdata-dir',args.tessdata_dir]
        command+=['-c','tessedit_create_tsv=1']
        result=subprocess.run(command,check=True,capture_output=True,text=True,timeout=100,
                              env={**os.environ,'OMP_THREAD_LIMIT':'1','OMP_NUM_THREADS':'1'})
        raw=result.stdout
        if not raw.startswith('level\tpage_num\t'):raise ValueError('OCR did not return TSV coordinates')
        tsv_path.write_text(raw)
    words=[]
    for row in csv.DictReader(io.StringIO(raw),delimiter='\t'):
        if not row.get('text','').strip():continue
        try:
            x,y,w,h=(float(row[k])/scale for k in ('left','top','width','height'))
            words.append((x,y,x+w,y+h,row['text'],float(row['conf'])))
        except (KeyError,ValueError):continue
    return words


def page_anchors(page,words,kind,image_path,scale):
    if kind=='meb':
        result=[]
        for anchor in meb.question_spans(page):
            result.append({'number':anchor['number'],'column':anchor['column'],'x':anchor['bbox'][0],
                           'y':anchor['bbox'][1],'bbox':anchor['bbox'],'anchorConfidence':100,'basis':'native_meb_question_gutter'})
        return result
    if kind in ('geometry_pink','original_blue'):
        from PIL import Image
        with Image.open(image_path) as image:boxes=color_boxes(image,kind)
        result=[]
        for box in boxes:
            number,confidence=label_in_box(words,box['bboxPixels'],scale)
            x0,y0,x1,y1=[v/scale for v in box['bboxPixels']]
            result.append({'number':number,'column':box['column'],'x':x0,'y':y0,'bbox':[x0,y0,x1,y1],
                           'anchorConfidence':confidence,'basis':'source_coloured_marker_with_read_number' if number else 'source_coloured_marker_number_unknown'})
        if not result:
            # Some book sections reproduce monochrome exam questions. Their
            # visible OCR/native labels can anchor a region, but must still
            # pass the multiple-choice-body gate; no coloured marker is
            # claimed when the actual source pixels contain none.
            result=publisher.anchors_from_words(words,page.rect.width,page.rect.height)
            for anchor in result:anchor['basis']='native_or_ocr_monochrome_label_requires_review'
        return sorted(result,key=lambda a:(a['column'],a['y']))
    result=publisher.colored_number_anchors(page,'#ed1c24') if kind=='ofb_red' else []
    if not result:result=publisher.anchors_from_words(words,page.rect.width,page.rect.height)
    for anchor in result:anchor['basis']='native_or_ocr_explicit_question_label'
    return result


def process_page(pdf,row,index,folder,args,ocr=False):
    import fitz
    page=pdf[index];physical=index+1;kind=profile(row)
    identity=digest(json.dumps({'version':VERSION,'sha256':row['sha256'],'page':physical,'dpi':args.dpi,
                               'maxWidth':args.max_width,'lang':args.lang,'profile':kind},sort_keys=True).encode())
    cache=folder/f'page-{physical:03}.json'
    prior=None
    if cache.exists():
        prior=json.loads(cache.read_text())
        if prior.get('inputIdentity')==identity and (not ocr or not prior['page'].get('ocrPending')):
            if all(Path(q['sourceAssets']['cropPath']).exists() and digest(Path(q['sourceAssets']['cropPath']).read_bytes())==q['sourceAssets']['cropSha256'] for q in prior['questions']):
                return prior
    words,mode=native_words(page)
    native_characters=sum(len(w[4]) for w in words)
    image=folder/f'page-{physical:03}.png'
    if prior is None or prior.get('inputIdentity')!=identity:
        # A changed source/render/language recipe cannot reuse an earlier
        # image or its coordinate TSV under the same page filename.
        image.unlink(missing_ok=True)
        (folder/f'page-{physical:03}.tsv').unlink(missing_ok=True)
    scale=full_page_image(page,image,args.dpi,args.max_width)
    ocr_error=None;tsv=folder/f'page-{physical:03}.tsv'
    if ocr:
        try:words=read_ocr(image,tsv,scale,args);mode='ocr_provisional'
        except (OSError,ValueError,subprocess.SubprocessError) as error:ocr_error=type(error).__name__
    anchors=page_anchors(page,words,kind,image,scale)
    ocr_pending=bool(ocr_error) or (not ocr and (native_characters<200 or (not anchors and native_characters<400)))
    questions=[];rejected=[];used=set()
    width,height=page.rect.width,page.rect.height
    for anchor in anchors:
        column=anchor['column']
        following=next((a for a in anchors if a['column']==column and a['y']>anchor['y']+6),None)
        box=[width*(.025 if column==0 else .495),max(height*.055,anchor['y']-6),
             width*(.497 if column==0 else .98),following['y']-5 if following else height*.955]
        if box[3]-box[1]<18:
            rejected.append({'number':anchor['number'],'reason':'region_too_small','bbox':box});continue
        rectangle=fitz.Rect(box);segments=[(index,rectangle)]
        text=publisher.word_text(words,box) if mode in ('ocr_provisional','native_pdf_xml') else page.get_text(clip=rectangle,sort=True)
        source_text=text
        if kind=='meb':
            if len(anchors)==1 and column==0:
                rectangle.x1=width*.98;box=list(rectangle);segments=[(index,rectangle)]
            source_text,text,_=meb.source_parts(page,rectangle,len(anchors)==1 and column==0)
        mc=mc_data(text)
        if kind=='meb' and len(mc['labels'])<2 and following is None:
            continuation=meb.following_column_prefix(pdf,index,column)
            if continuation:
                n,rect,continuation_text=continuation
                source_text+='\n'+continuation_text;text+='\n'+continuation_text
                segments.append((n,rect));mc=mc_data(text)
        strong_coloured=anchor['basis'].startswith('source_coloured_marker')
        actual_question_cue=kind=='meb' and bool(re.search(r'kaçtır|hangisi|hangileri|bulunuz|ne olur',text,re.I))
        if len(mc['labels'])<2 and not strong_coloured and not actual_question_cue:
            rejected.append({'number':anchor['number'],'reason':'no_clear_multiple_choice_body','bbox':box});continue
        number=anchor['number']
        label=f'Q{number:02}' if number is not None else f'U-C{column+1}-Y{round(anchor["y"]):04}'
        qid=f'ORIG-{row["sha256"][:12]}-P{physical:03}-{label}'
        if qid in used:qid+=f'-C{column+1}-Y{round(anchor["y"]):04}'
        if qid in used:raise ValueError('Ambiguous repeated source anchor')
        used.add(qid)
        crop=folder/(qid+'.png');meb.render_source_crop(pdf,segments,crop,scale)
        inline=list(dict.fromkeys(re.findall(r'Cevap\s*[:：]\s*([A-E])\b',source_text,re.I)))
        answer=inline[0].upper() if len(inline)==1 else None
        parts=Path(row['member']).parts
        reasons=['independent_mathematical_check_required','original_layout_review_required']
        if not mc['complete']:reasons.append('five_option_transcription_requires_review')
        if number is None:reasons.append('original_question_number_not_reliably_read')
        if mode=='ocr_provisional':reasons.append('ocr_text_and_math_glyph_review_required')
        question={'id':qid,'origin':'ORIJINAL','pool':'original_private','examType':parts[0] if parts[0]in('TYT','AYT')else None,
                  'topic':parts[1] if len(parts)>1 else None,'subtopic':parts[-2],
                  'classificationStatus':'directory_labels_provisional_question_review_pending','officialExamVerified':False,
                  'source':{'sha256':row['sha256'],'documentId':'pdf-'+row['sha256'][:16],
                            'relativePath':row['archive']+'/'+row['member'],'physicalPage':physical,'questionNumber':number,
                            'questionNumberBasis':anchor['basis'],'bbox':box,'column':column,'profile':kind,
                            'anchorConfidence':anchor['anchorConfidence']},
                  'sourceAssets':{'cropPath':str(crop),'questionCrop':str(crop),'cropSha256':digest(crop.read_bytes()),
                                  'sourcePdfPath':row['path'],'fullPageImage':str(image),'sourcePreservedWithoutRedrawing':True,
                                  'parts':[{'physicalPage':n+1,'clipRect':list(r)} for n,r in segments]},
                  'prompt':mc['prompt'],'options':mc['options'],'rawSourceText':source_text,
                  'answer':{'value':answer,'status':'publisher_inline_not_independently_verified' if answer else 'unknown',
                            'mathematicallyVerified':False},
                  'extraction':{'status':'five_choice_transcription_candidate' if mc['complete'] else 'partial_transcription_review',
                                'textMode':mode,'optionLabels':mc['labels'],'allFiveOptionLabelsCaptured':mc['complete'],
                                'cropBoundaryStatus':'provisional_requires_visual_review',
                                'originalPageAndFiguresPreserved':True,'sourceQuestionNumberKnown':number is not None},
                  'permission':{'status':'unverified','publishable':False},
                  'verification':{'status':'pending_review','mathPassed':False,'reasons':reasons,'methods':[]}}
        questions.append(question)
    record={'sourceDocumentId':'pdf-'+row['sha256'][:16],'sourceSha256':row['sha256'],'physicalPage':physical,
            'actualPdfPageRead':True,'textMode':mode,'nativeTextCharacters':native_characters,'fullPageImage':str(image),
            'fullPageSha256':digest(image.read_bytes()),'normalizedPixelWidth':round(width*scale),'effectiveDpi':round(scale*72,2),
            'ocrPending':ocr_pending,'ocrAttempted':ocr,'ocrTsvPath':str(tsv) if tsv.exists() else None,
            'ocrError':ocr_error,'questionIds':[q['id'] for q in questions],'rejectedAnchors':rejected,
            'status':'source_regions_pending_review' if questions else 'no_reliable_question_region_layout_review_pending'}
    result={'inputIdentity':identity,'page':record,'questions':questions}
    atomic_json(cache,result)
    return result


def aggregate(rows,out,phase):
    questions=[];pages=[];documents=[]
    for row in rows:
        folder=out/('pdf-'+row['sha256'][:16]);target=folder/'document.json'
        if not target.exists():continue
        payload=json.loads(target.read_text());questions.extend(payload['questions']);pages.extend(payload['pages']);documents.append(payload['document'])
    summary={'expectedDocuments':len(rows),'documentsCheckpointed':len(documents),'expectedPages':sum(r['pageCount'] for r in rows),
             'actualPagesRead':len(pages),'questionRegionCandidates':len(questions),
             'fiveChoiceTranscriptionCandidates':sum(q['extraction']['allFiveOptionLabelsCaptured'] for q in questions),
             'unknownOriginalQuestionNumber':sum(q['source']['questionNumber'] is None for q in questions),
             'ocrPendingPages':sum(p['ocrPending'] for p in pages),'ocrAttemptedPages':sum(p['ocrAttempted'] for p in pages),
             'ocrErrors':sum(bool(p['ocrError']) for p in pages),'pagesWithoutReliableRegion':sum(not p['questionIds'] for p in pages),
             'publisherAnswersProvidedNotMathVerified':sum(q['answer']['value'] is not None for q in questions),
             'pageContentStatuses':dict(Counter(p.get('contentStatus','classification_pending') for p in pages)),
             'independentlyMathematicallyVerified':0,'pendingReview':len(questions),'publishableOriginalQuestions':0,
             'scope':'Original source regions and provisional native/OCR transcription; no new mathematics or public original bodies.',
             'phase':phase}
    atomic_json(out/'questions.json',{'schemaVersion':1,'version':VERSION,'summary':summary,'questions':questions,'documents':documents,'pages':pages})
    print(json.dumps(summary,ensure_ascii=False),flush=True)


def classify_existing(rows,out):
    """Add evidence-backed page labels without re-extracting question regions."""
    import fitz
    reviews_path=out/'label-visual-reviews.json'
    visual_reviews=json.loads(reviews_path.read_text()).get('reviews',[]) if reviews_path.exists() else []
    for row in rows:
        folder=out/('pdf-'+row['sha256'][:16]);target=folder/'document.json'
        if not target.exists():continue
        if digest(Path(row['path']).read_bytes())!=row['sha256']:raise ValueError('Source changed before page classification')
        document=json.loads(target.read_text())
        repaired_questions=[]
        with fitz.open(row['path']) as pdf:
            for page in document['pages']:
                cache=folder/f'page-{page["physicalPage"]:03}.json'
                saved=json.loads(cache.read_text())
                actual_page=pdf[page['physicalPage']-1]
                words,mode=native_words(actual_page)
                text=publisher.word_text(words,[0,0,actual_page.rect.width,actual_page.rect.height])
                if page.get('ocrTsvPath') and Path(page['ocrTsvPath']).exists():
                    # Reuse the one existing TSV, never start a second OCR
                    # process simply to label a page's content type.
                    raw=Path(page['ocrTsvPath']).read_text()
                    rows_tsv=list(csv.DictReader(io.StringIO(raw),delimiter='\t'))
                    text=' '.join(r.get('text','') for r in rows_tsv if r.get('text','').strip());mode='ocr_provisional'
                    scale=page['effectiveDpi']/72
                    words=[]
                    for token in rows_tsv:
                        if not token.get('text','').strip():continue
                        try:
                            x,y,w,h=(float(token[k])/scale for k in ('left','top','width','height'))
                            words.append((x,y,x+w,y+h,token['text'],float(token['conf'])))
                        except (KeyError,ValueError):continue
                if profile(row) in ('geometry_pink','original_blue'):
                    anchors=page_anchors(actual_page,words,profile(row),page['fullPageImage'],page['effectiveDpi']/72)
                    used=set()
                    for question in saved['questions']:
                        source=question['source'];column=source['column']
                        nearest=min((a for a in anchors if a['column']==column),key=lambda a:abs(a['y']-6-source['bbox'][1]),default=None)
                        if nearest is None or abs(nearest['y']-6-source['bbox'][1])>4:continue
                        number=nearest['number']
                        review=next((r for r in visual_reviews if r.get('sourceSha256')==row['sha256']
                                     and r.get('physicalPage')==page['physicalPage'] and r.get('column')==column
                                     and abs(r.get('sourceAnchorY',-1000)-nearest['y'])<2),None)
                        if review:
                            if not isinstance(review.get('questionNumber'),int) or not 1<=review['questionNumber']<=80:
                                raise ValueError('Invalid explicit visual-number review')
                            if not Path(review.get('evidenceImagePath','')).is_file():
                                raise ValueError('Visual number review lacks an accessible source image')
                            if digest(Path(review['evidenceImagePath']).read_bytes())!=review.get('evidenceImageSha256'):
                                raise ValueError('Visual number review source image changed')
                            number=review['questionNumber']
                        old_id=question['id']
                        label=f'Q{number:02}' if number is not None else f'U-C{column+1}-Y{round(nearest["y"]):04}'
                        new_id=f'ORIG-{row["sha256"][:12]}-P{page["physicalPage"]:03}-{label}'
                        if new_id in used:new_id+=f'-C{column+1}-Y{round(nearest["y"]):04}'
                        used.add(new_id)
                        if new_id!=old_id:
                            old_crop=Path(question['sourceAssets']['cropPath']);new_crop=folder/(new_id+'.png')
                            if not new_crop.exists() or digest(new_crop.read_bytes())!=question['sourceAssets']['cropSha256']:
                                new_crop.write_bytes(old_crop.read_bytes())
                            question['id']=new_id
                            question['sourceAssets'].update(cropPath=str(new_crop),questionCrop=str(new_crop))
                        source.update(questionNumber=number,questionNumberBasis=nearest['basis'],
                                      questionNumberVerification='ocr_provisional_requires_visual_review' if mode=='ocr_provisional' else 'native_provisional',
                                      anchorConfidence=nearest['anchorConfidence'])
                        if review:
                            source.update(questionNumberBasis='visual_review_of_actual_source_crop',
                                          questionNumberVerification='visually_read_not_math_verified',labelVisualReview=review)
                        question['extraction']['sourceQuestionNumberKnown']=number is not None
                        if number is None and 'original_question_number_not_reliably_read' not in question['verification']['reasons']:
                            question['verification']['reasons'].append('original_question_number_not_reliably_read')
                    page['questionIds']=[q['id'] for q in saved['questions']]
                kind,evidence=content_kind(text,bool(page['questionIds']))
                page.update(contentStatus=kind,contentClassificationEvidence={**evidence,'textMode':mode},
                            nonMultipleChoiceExamplesNotExtracted=kind=='worked_examples_only')
                saved['page'].update(page);atomic_json(cache,saved)
                repaired_questions.extend(saved['questions'])
        if profile(row) in ('geometry_pink','original_blue'):document['questions']=repaired_questions
        atomic_json(target,document)


def process_document(row,old_manifest,out,args,ocr=False):
    import fitz
    if digest(Path(row['path']).read_bytes())!=row['sha256']:raise ValueError('Actual source SHA changed')
    folder=out/('pdf-'+row['sha256'][:16]);folder.mkdir(exist_ok=True)
    questions=[];pages=[]
    with fitz.open(row['path']) as pdf:
        if pdf.needs_pass:raise ValueError('Encrypted original PDF')
        if len(pdf)!=row['pageCount']:raise ValueError('Actual PDF page count changed')
        for index in range(len(pdf)):
            payload=process_page(pdf,row,index,folder,args,ocr)
            questions.extend(payload['questions']);pages.append(payload['page'])
    result={'document':{'id':'pdf-'+row['sha256'][:16],'sha256':row['sha256'],'relativePath':row['archive']+'/'+row['member'],
                        'pageCount':len(pages),'profile':profile(row),'status':'all_pages_read_questions_need_review'},
            'questions':questions,'pages':pages,'summary':{}}
    publisher.attach_explicit_publisher_keys(result,row,old_manifest)
    atomic_json(folder/'document.json',result)


def self_test():
    assert not mc_data('A) 1 B) 2 D) 4 E) 5')['complete']
    assert mc_data('A) 1 B) 2 C) 3 D) 4 E) 5')['complete']
    assert not mc_data('A) 1 B) 2 C) 3 D) 4 E) 5 A) extra')['complete']
    try:private_output(ROOT/'data/original-crops')
    except ValueError:pass
    else:raise AssertionError('Public original output accepted')
    # A coloured label with unreadable/OCR-conflicting numerals remains null.
    box=[60,100,75,115]
    assert label_in_box([],box,1)==(None,None)
    assert label_in_box([(60,100,70,110,'3.',90),(65,100,75,110,'8.',80)],box,1)==(None,None)
    assert label_in_box([(60,100,75,110,'3.',90)],box,1)==(3,90)
    assert label_in_box([(68,100,75,110,'3.',99)],[60,100,75,115],1)==(None,None)
    assert not publisher.anchors_from_words([(250,100,260,110,'1.',100)],600,800)
    assert content_kind('Örnek - 1 Equation and worked solution',False)[0]=='worked_examples_only'
    assert content_kind('Notlarım 120',False)[0]=='notes'
    assert content_kind('2. BÖLÜM ORİJİNAL YAYINLARI',False)[0]=='cover'
    assert content_kind('',False)[0]=='no_reliable_anchor'
    # Exercise actual PDF geometry/crop/checkpoint behaviour using entirely
    # synthetic validator text, never a copyrighted source fixture.
    import fitz
    with tempfile.TemporaryDirectory(prefix='catalog-additions-check-') as temporary:
        folder=Path(temporary);pdf=fitz.open();page=pdf.new_page(width=600,height=800)
        page.insert_text((50,100),'1. Synthetic validator: select one listed letter.')
        page.insert_text((70,140),'A) alpha  B) beta  C) gamma  D) delta  E) epsilon')
        source=folder/'source.pdf';source.write_bytes(pdf.tobytes());pdf.close()
        row={'archive':'01_TYT.zip','member':'TYT/M01/topic/Synthetic.pdf','path':str(source),
             'sha256':digest(source.read_bytes()),'pageCount':1}
        config=argparse.Namespace(dpi=150,max_width=1400,lang='eng',tessdata_dir=None)
        process_document(row,[],folder,config)
        result_path=folder/('pdf-'+row['sha256'][:16])/'document.json'
        first=json.loads(result_path.read_text())
        assert len(first['questions'])==1 and len(first['pages'])==1
        assert first['questions'][0]['extraction']['allFiveOptionLabelsCaptured']
        assert not first['questions'][0]['verification']['mathPassed']
        assert not first['questions'][0]['permission']['publishable']
        first_hash=first['questions'][0]['sourceAssets']['cropSha256']
        process_document(row,[],folder,config)
        assert json.loads(result_path.read_text())['questions'][0]['sourceAssets']['cropSha256']==first_hash
        try:process_document({**row,'sha256':'0'*64},[],folder,config)
        except ValueError:pass
        else:raise AssertionError('Changed source bytes reused a checkpoint')
    print('Catalog additions self-test passed: private output, lost choice, ambiguous geometry number, gutter fail-closed.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',default='/workspace/pdf-access-check-20261114-new/files.json')
    parser.add_argument('--old-manifest',default='/workspace/pdf-access-check-20261113/files.json')
    parser.add_argument('--output',default='/workspace/pdf-access-check-20261114-new/bulk/catalog')
    parser.add_argument('--tessdata-dir',default='/workspace/pdf-access-check-20261113/ocr/tessdata')
    parser.add_argument('--lang',default='tur+eng');parser.add_argument('--dpi',type=int,default=150)
    parser.add_argument('--max-width',type=int,default=1400);parser.add_argument('--native-only',action='store_true')
    parser.add_argument('--classify-existing',action='store_true',help='Label existing page checkpoints without re-extracting questions or running OCR')
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:self_test();return
    if not 140<=args.dpi<=160 or not 500<=args.max_width<=1400:parser.error('Use 140–160 dpi and normalized width at most 1400 pixels')
    rows=[r for r in json.loads(Path(args.manifest).read_text()) if r.get('type')=='.pdf' and ARCHIVE.fullmatch(r['archive'])]
    old=json.loads(Path(args.old_manifest).read_text());old_shas={r['sha256'] for r in old if r.get('type')=='.pdf'}
    if any(r['sha256'] in old_shas for r in rows):raise ValueError('An old PDF was selected; do not re-extract previous sources')
    rows.sort(key=lambda r:(profile(r) not in ('meb','ofb_red','native_or_ocr'),r['archive'],r['member']))
    out=private_output(args.output)
    if args.classify_existing:
        classify_existing(rows,out);aggregate(rows,out,'completed_source_capture_math_pending');return
    for row in rows:
        process_document(row,old,out,args)
        aggregate(rows,out,'native_checkpoint')
    if args.native_only:return
    for row in rows:
        document=json.loads((out/('pdf-'+row['sha256'][:16])/'document.json').read_text())
        if not any(p['ocrPending'] for p in document['pages']):continue
        process_document(row,old,out,args,ocr=True)
        aggregate(rows,out,'single_worker_ocr_checkpoint')
    classify_existing(rows,out)
    aggregate(rows,out,'completed_source_capture_math_pending')


if __name__=='__main__':main()
