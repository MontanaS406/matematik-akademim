#!/usr/bin/env python3
"""Extract provided commercial TYT mock exams into a PRIVATE source bank.

The PDFs retain zero-width ActualText glyphs. MuPDF's dict view drops those;
its XML output retains their source positions. This tool uses those actual
glyphs, colored question labels and spatial answer-key tables, not an index
or an assumed list of 480 questions. Lossless source crops remain authoritative
for figures, fractions, superscripts and other unnormalised mathematics.

Publisher answer-key transcription is NOT independent mathematical approval.
No extracted source body is written to the public repository.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'actual-xml-mock-extraction-v2'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def private_path(path):
    path = Path(path).resolve()
    if path == ROOT or ROOT in path.parents:
        permitted = ROOT / 'private'
        if path != permitted and permitted not in path.parents:
            raise ValueError('Original source bodies must stay outside the repository or under ignored private/')
    return path

def source_chars(page):
    """Read actual source character positions, including zero-width glyphs."""
    result = []
    for node in ET.fromstring(page.get_text('xml')).iter('char'):
        x, y = float(node.attrib['x']), float(node.attrib['y'])
        if not math.isfinite(x+y) or not -1 <= x <= page.rect.width+1 or not -1 <= y <= page.rect.height+1:
            continue
        result.append({'text':node.attrib['c'], 'x':x, 'y':y, 'color':node.attrib.get('color','')})
    return result

def spatial_rows(chars, tolerance=2.5):
    rows = []
    for char in sorted(chars, key=lambda c:(c['y'],c['x'])):
        if not rows or abs(char['y']-rows[-1]['y']) > tolerance:
            rows.append({'y':char['y'], 'chars':[char]})
        else:
            rows[-1]['chars'].append(char)
    for row in rows:
        row['chars'].sort(key=lambda c:c['x'])
        row['text'] = ''.join(c['text'] for c in row['chars']).strip()
    return rows

def question_labels(chars, width, height):
    labels = []
    for column in (0,1):
        region = [c for c in chars if c['color'].lower() == '#f466ba'
                  and width*(.04 if column==0 else .48) < c['x'] < width*(.23 if column==0 else .70)
                  and height*.07 < c['y'] < height*.95]
        for row in spatial_rows(region):
            match = re.fullmatch(r'(\d{1,2})\.', row['text'].replace(' ',''))
            if match and 1 <= int(match[1]) <= 40:
                labels.append({'number':int(match[1]), 'column':column,
                               'x':min(c['x'] for c in row['chars']), 'y':row['y']})
    return sorted(labels, key=lambda q:(q['column'],q['y']))

def region_text(chars, box):
    x0,y0,x1,y1 = box
    return '\n'.join(row['text'] for row in spatial_rows([c for c in chars if x0<=c['x']<x1 and y0<=c['y']<y1]) if row['text'])

def choice_labels(chars, box):
    x0,y0,x1,y1 = box
    matches=[]
    for row in spatial_rows([c for c in chars if x0<=c['x']<x1 and y0<=c['y']<y1],tolerance=6):
        text=''.join(c['text'] for c in row['chars'])
        # ActualText supplies explicit spaces. Preserve those rather than
        # estimating mathematical glyph widths from zero-width font boxes.
        # ActualText often joins a preceding option value directly to the
        # following marker: e.g. "A)wordB)word". The closing parenthesis is
        # the source marker; a word-boundary condition would hide real options.
        for match in re.finditer(r'([ABCDE])\)',text):
            char=row['chars'][match.start(1)]
            matches.append({'id':match[1],'x':char['x'],'y':row['y']})
    ordered=sorted(matches,key=lambda q:(q['y'],q['x']))
    candidates=[]
    for index in range(len(ordered)-4):
        group=ordered[index:index+5]
        if ''.join(m['id'] for m in group)=='ABCDE':candidates.append(group)
    return candidates[-1] if candidates else []

def printed_footer(chars,width,height):
    """Read the isolated actual outer footer; never substitute PDF index."""
    edge=[c for c in chars if c['y']>height*.94 and
          (c['x']<width*.12 or c['x']>width*.905)]
    candidates=[int(r['text']) for r in spatial_rows(edge)
                if re.fullmatch(r'\d{1,3}',r['text'])]
    return candidates[0] if len(candidates)==1 else None

def option_regions(markers,box):
    """Keep full graphical options, bounded by the next real choice row."""
    regions=[]
    for marker in markers:
        same_row=[m for m in markers if abs(m['y']-marker['y'])<=6]
        next_same=next((m for m in sorted(same_row,key=lambda m:m['x']) if m['x']>marker['x']),None)
        following_rows=[m['y'] for m in markers if m['y']>marker['y']+6]
        bottom=min(following_rows)-30 if following_rows else box[3]
        regions.append([max(box[0],marker['x']-2),max(box[1],marker['y']-45),
                        next_same['x']-3 if next_same else box[2],min(box[3],bottom)])
    return regions

def transcribe_answer_key(page):
    chars = source_chars(page)
    rows = spatial_rows([c for c in chars if page.rect.width*.14<c['x']<page.rect.width*.88])
    numeric_top=''.join(map(str,range(1,21)))
    numeric_bottom=''.join(map(str,range(21,41)))
    rows=[row for row in rows if row['text'].replace(' ','') in (numeric_top,numeric_bottom)
          or re.fullmatch(r'[ABCDE]{20}',row['text'].replace(' ',''))]
    if len(rows)!=48:raise ValueError('Expected twelve four-row answer tables; found '+str(len(rows)))
    tables={}
    for start in range(0,48,4):
        block=rows[start:start+4]
        texts=[row['text'].replace(' ','') for row in block]
        if texts[0]!=numeric_top or texts[2]!=numeric_bottom or not all(re.fullmatch('[ABCDE]{20}',texts[i]) for i in (1,3)):
            raise ValueError('Answer table has ambiguous row structure')
        lo,hi=block[0]['y']-20,block[-1]['y']+25
        label=''.join(c['text'] for c in sorted([c for c in chars if c['x']<page.rect.width*.14 and lo<c['y']<hi],key=lambda c:-c['y'])).strip()
        match=re.fullmatch(r'DENEME\s+(\d{1,2})',label)
        if not match:raise ValueError('Actual rotated answer-table label is missing: '+repr(label))
        number=int(match[1])
        if number in tables:raise ValueError('Duplicate answer-table label')
        tables[number]={'examNumber':number,'answers':dict(zip(map(str,range(1,41)),texts[1]+texts[3])),
                        'sourceRows':[{ 'y':round(row['y'],3),'text':text} for row,text in zip(block,texts)],
                        'tableLabel':label,'physicalPage':1,'status':'publisher_key_transcription_not_independent_math'}
    if set(tables)!=set(range(1,13)):raise ValueError('Incomplete or unexpected exam-key labels')
    return tables

def classify(text):
    t=text.casefold()
    rules=[('geometry','Geometri',['üçgen','çember','dikdörtgen','paralelkenar','küp','silindir','prizma','dörtgen','köşegen']),
           ('probability','Olasılık',['olasılığı','olasılık']),('sets','Kümeler',['kümesi','kümeleri','kümeler']),
           ('functions','Fonksiyonlar',['fonksiyonu','fonksiyonları','fonksiyon']),('polynomials','Polinomlar',['polinom']),
           ('statistics','İstatistik',['medyan','aritmetik ortalama','ortanca','standart sapma']),
           ('divisibility','Bölünebilme',['bölümünden kalan','asal sayı','tam bölen']),
           ('problems','Problemler',['yaşları','yaşında','yüzde','yolcu','işçi','satış','adım','karışım','indirim'])]
    for course,title,words in rules:
        if any(word in t for word in words):return {'courseId':course,'topic':title,'subtopic':None,'status':'source_text_keyword_provisional'}
    return {'courseId':None,'topic':None,'subtopic':None,'status':'classification_pending_visual_review'}

def atomic_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    temporary.replace(path)

def extract(args):
    import fitz
    out=private_path(args.output);out.mkdir(parents=True,exist_ok=True)
    manifest=json.loads(Path(args.manifest).read_text())
    if isinstance(manifest,dict):manifest=manifest['files']
    exam_files=sorted([r for r in manifest if re.search(r'Orijinal_TYT_Deneme_\d{2}_40_Soru\.pdf$',r.get('member',''))],key=lambda r:r['member'])
    key_source=next(r for r in manifest if r.get('member','').endswith('Orijinal_TYT_12_Deneme_PDF_193-193.pdf'))
    if digest(Path(key_source['path']).read_bytes())!=key_source['sha256']:raise ValueError('Answer-key bytes differ from supplied manifest')
    with fitz.open(key_source['path']) as pdf:
        if len(pdf)!=1 or pdf.needs_pass:raise ValueError('Actual answer-key PDF is unsupported')
        tables=transcribe_answer_key(pdf[0])
        pdf[0].get_pixmap(matrix=fitz.Matrix(.8,.8)).save(out/'answer-key-page1.png')
    atomic_json(out/'answer-key.json',{'source':key_source,'tables':tables,'independentlyMathematicallyVerified':False})
    script_hash=digest(Path(__file__).read_bytes())
    state_path=out/'state.json'
    try:state=json.loads(state_path.read_text())
    except (FileNotFoundError,ValueError):state={}
    all_questions=[];documents=[];all_pages=[]
    for file in exam_files:
        number=int(re.search(r'Deneme_(\d{2})_',file['member'])[1])
        if number not in tables:raise ValueError('No read publisher key for the actual exam')
        source_bytes=Path(file['path']).read_bytes()
        if digest(source_bytes)!=file['sha256']:raise ValueError('Source exam bytes differ from supplied manifest')
        doc_id='pdf-'+file['sha256'][:16]
        record_path=out/'documents'/(doc_id+'.json')
        binding={'sourceSha256':file['sha256'],'answerKeySha256':key_source['sha256'],'extractorSha256':script_hash,'scale':args.scale}
        old=state.get(doc_id,{})
        reuse=(not args.force and old.get('binding')==binding and record_path.exists()
               and old.get('outputSha256')==digest(record_path.read_bytes()))
        if reuse:
            batch=json.loads(record_path.read_text())
            reuse=all(Path(q['sourceAssets']['cropPath']).exists() for q in batch['questions'])
        if not reuse:
            questions=[];pages=[]
            with fitz.open(file['path']) as pdf:
                if pdf.needs_pass:raise ValueError('Encrypted source exam')
                for physical,page in enumerate(pdf,1):
                    chars=source_chars(page)
                    labels=question_labels(chars,page.rect.width,page.rect.height)
                    footer=printed_footer(chars,page.rect.width,page.rect.height)
                    pages.append({'documentId':doc_id,'physicalPage':physical,'printedPage':footer,'questionNumbers':[q['number'] for q in labels],
                                  'status':'question_regions_extracted' if labels else 'no_question_labels_cover_or_blank' if physical<=2 else 'visual_review_required_no_question_labels'})
                    for index,label in enumerate(labels):
                        following=next((q for q in labels[index+1:] if q['column']==label['column']),None)
                        x0=0 if label['column']==0 else page.rect.width/2
                        x1=page.rect.width/2 if label['column']==0 else page.rect.width
                        box=[x0,max(0,label['y']-50),x1,min(page.rect.height*.95,following['y']-50) if following else page.rect.height*.95]
                        if box[3]<=box[1]:raise ValueError('Question region has invalid geometry')
                        q_id=f'ORIG-{file["sha256"][:12]}-P{physical:03d}-Q{label["number"]:02d}'
                        if any(q['id']==q_id for q in questions):
                            q_id+=f'-C{label["column"]+1}'
                        if any(q['id']==q_id for q in questions):
                            raise ValueError('Ambiguous repeated question anchor; no source record was overwritten')
                        image=out/'crops'/(q_id+'.png');image.parent.mkdir(exist_ok=True)
                        page.get_pixmap(matrix=fitz.Matrix(args.scale,args.scale),clip=fitz.Rect(box),alpha=False).save(image)
                        text=region_text(chars,box)
                        markers=choice_labels(chars,box)
                        options=[]
                        for marker,cell in zip(markers,option_regions(markers,box)):
                            options.append({'id':marker['id'],'text':region_text(chars,cell),'sourceRegion':cell,'textStatus':'raw_source_xml_math_requires_visual_review'})
                        reasons=['independent_mathematical_solution_required','raw_mathematical_glyphs_require_visual_review']
                        if len(markers)!=5:reasons.append('five_choice_labels_not_confidently_detected')
                        question={'id':q_id,'origin':'ORIJINAL','pool':'original_private','examType':'TYT','isOfficialExamQuestion':False,'examNumber':number,
                            'prompt':text,'promptStatus':'raw_actual_xml_spatial_text_including_math_and_options','options':options,
                            'classification':classify(text),'answer':{'value':tables[number]['answers'][str(label['number'])],
                                'status':'publisher_key_transcribed_not_independent_math','solution':None},
                            'source':{'sha256':file['sha256'],'documentId':doc_id,'relativePath':file['archive']+'/'+file['member'],
                                'pdfPath':file['path'],'physicalPage':physical,'printedPage':footer,
                                'printedPageStatus':'actual_outer_footer_read' if footer is not None else 'not_confidently_read',
                                'questionNumber':label['number'],'column':label['column'],'bbox':box,
                                'publisher':'Orijinal Yayınları','sourceKind':'commercial_TYT_mock_not_OSYM'},
                            'answerEvidence':{'sha256':key_source['sha256'],'sourceDocumentId':'pdf-'+key_source['sha256'][:16],
                                'physicalPage':1,'tableLabel':tables[number]['tableLabel'],'questionNumber':label['number'],
                                'status':'actual_spatial_table_and_exam_label_read'},
                            'sourceAssets':{'cropPath':str(image),'cropSha256':digest(image.read_bytes()),'fullPagePdfPath':file['path'],'fullPagePhysicalPage':physical,'sourcePreserved':True},
                            'extractionStatus':'image_region_with_five_choice_labels' if len(markers)==5 else 'image_region_choice_transcription_pending',
                            'permission':{'status':'unverified','publishable':False},
                            'verification':{'status':'pending_review','mathPassed':False,'methods':['actual_pdf_xml_coordinates','lossless_source_region_render','spatial_publisher_key_transcription'],
                                'reasons':reasons,'editorialStatus':'pending'}}
                        questions.append(question)
            counts=Counter(q['source']['questionNumber'] for q in questions)
            missing=sorted(set(range(1,41))-set(counts))
            duplicates=sorted(n for n,count in counts.items() if count!=1)
            doc_summary={'id':doc_id,'sha256':file['sha256'],'examNumber':number,'relativePath':file['archive']+'/'+file['member'],
                'pageCount':len(pages),'actualQuestionRegions':len(questions),'uniqueQuestionNumbers':len(counts),
                'missingQuestionNumbers':missing,'duplicateQuestionNumbers':duplicates,
                'fiveChoiceLabelCount':sum(len(q['options'])==5 for q in questions),
                'layoutStatus':'all_40_labels_and_regions_extracted' if not missing and not duplicates else 'layout_review_required',
                'mathematicalVerificationStatus':'pending_except_existing_curated_overlay'}
            batch={'questions':questions,'pages':pages,'document':doc_summary}
            atomic_json(record_path,batch)
            state[doc_id]={'binding':binding,'outputSha256':digest(record_path.read_bytes()),'status':doc_summary['layoutStatus']}
            atomic_json(state_path,state)
        all_questions.extend(batch['questions']);documents.append(batch['document']);all_pages.extend(batch['pages'])
        print('Exam',number,':',len(batch['questions']),'actual question regions; reused' if reuse else 'extracted',flush=True)
    summary={'actualExamPdfs':len(documents),'actualExamPages':sum(d['pageCount'] for d in documents),
        'extractedQuestionRegions':len(all_questions),'publisherKeyAnswersRead':sum(len(t['answers']) for t in tables.values()),
        'questionsWithFiveChoiceLabels':sum(len(q['options'])==5 for q in all_questions),
        'mathematicallyVerifiedByThisExtractor':0,'publicOriginalQuestions':0,
        'completeNumberedExamLayouts':sum(d['layoutStatus']=='all_40_labels_and_regions_extracted' for d in documents),
        'limitations':['Source crops preserve original figures and choices; raw XML mathematical text is not normalised or independently verified.',
                      'Publisher key transcription is not a mathematical correctness certificate.',
                      'Existing manually curated records should be overlaid by source SHA/page/question tuple, not counted twice.']}
    final={'schemaVersion':1,'extractor':VERSION,'questions':all_questions,'documents':documents,'pages':all_pages,'summary':summary}
    atomic_json(out/'questions.json',final)
    print(json.dumps(summary,ensure_ascii=False))

def self_test():
    for path in (ROOT,ROOT/'data/source-crops'):
        try:private_path(path)
        except ValueError:pass
        else:raise AssertionError('Public source output was accepted')
    chars=[{'text':c,'x':100+i*12,'y':200,'color':'#f466ba'} for i,c in enumerate('12.')]
    assert question_labels(chars,1200,1800)[0]['number']==12
    assert region_text([{'text':'A','x':10,'y':100},{'text':')','x':20,'y':100},{'text':'2','x':30,'y':100}],[0,80,100,130])=='A)2'
    labels=[]
    for i,letter in enumerate('ABCDE'):
        labels.extend([{'text':letter,'x':i*100+10,'y':200},{'text':')','x':i*100+20,'y':200}])
    assert ''.join(m['id'] for m in choice_labels(labels,[0,100,600,300]))=='ABCDE'
    assert choice_labels(labels[:-2],[0,100,600,300])==[]
    concatenated=[]
    for i,letter in enumerate('ABCDE'):
        concatenated.extend({'text':c,'x':i*100+10+j*10,'y':200} for j,c in enumerate(letter+')word'))
    assert ''.join(m['id'] for m in choice_labels(concatenated,[0,100,600,300]))=='ABCDE'
    assert printed_footer([{'text':'7','x':100,'y':1700}],1200,1800)==7
    assert printed_footer([],1200,1800) is None
    print('Mock extraction self-test: private path gate, actual colored labels and missing-choice rejection passed.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',default='/workspace/pdf-access-check-20261113/files.json')
    parser.add_argument('--output',default='/workspace/pdf-access-check-20261113/bulk/exams')
    parser.add_argument('--scale',type=float,default=1.0)
    parser.add_argument('--force',action='store_true')
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:self_test()
    else:extract(args)
