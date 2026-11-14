#!/usr/bin/env python3
"""Extract individual original MEB questions into PRIVATE review storage.

The crop preserves original figures, formula layout, five choices and worked
solutions. Text-layer transcription is kept alongside the crop. A publisher
answer is evidence of what the source says, never independent math approval.
No original body or image from this command belongs in the public repository.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'meb-spatial-extraction-v3'
TOPICS = {
    11: ('Önermeler ve Bileşik Önermeler','sets','Önermeler ve mantık'),
    27: ('Kümelerde Temel Kavramlar','sets','Kümelerde temel kavramlar'),
    39: ('Kümelerde İşlemler','sets','Küme işlemleri'),
    55: ('Sayı Kümeleri','numbers','Sayı kümeleri'),
    183: ('Üçgenlerde Eşlik ve Benzerlik','geometry','Üçgenlerde eşlik ve benzerlik'),
    213: ('Üçgenlerin Yardımcı Elemanları','geometry','Üçgenlerin yardımcı elemanları'),
    235: ('Dik Üçgen ve Trigonometri','trigonometry','Dik üçgen ve trigonometri'),
    255: ('Üçgenin Alanı','geometry','Üçgenin alanı'),
    275: ('Merkezi Eğilim ve Yayılım Ölçüleri','statistics','Merkezi eğilim ve yayılım ölçüleri'),
    289: ('Verilerin Grafik ile Gösterilmesi','statistics','Grafik ve veri yorumlama'),
    305: ('Sıralama ve Seçme','probability','Sıralama ve seçme'),
    331: ('Basit Olayların Olasılığı','probability','Basit olayların olasılığı'),
    345: ('Fonksiyon Kavramı ve Gösterimi','functions','Fonksiyon kavramı'),
    365: ('İki Fonksiyonun Bileşkesi ve Ters Fonksiyon','functions','Bileşke ve ters fonksiyon'),
    405: ('Polinomların Çarpanlara Ayrılması','polynomials','Polinomların çarpanlara ayrılması'),
    459: ('Çokgenler - Dörtgenler ve Özellikleri','geometry','Çokgen ve dörtgenler'),
    479: ('Özel Dörtgenler','geometry','Özel dörtgenler'),
    527: ('Katı Cisimler','geometry','Katı cisimler'),
}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def key_text(text):
    text = text.upper().replace('İ','I').replace('ı','I')
    text = ''.join(c for c in unicodedata.normalize('NFKD',text) if not unicodedata.combining(c))
    return re.sub(r'[^A-Z0-9]', '', text)

def private_output(path):
    target = Path(path).resolve()
    if target == ROOT or ROOT in target.parents:
        allowed = ROOT / 'private'
        if target != allowed and allowed not in target.parents:
            raise ValueError('Original source output must stay outside the repo or under ignored private/')
    return target

def header_test(text):
    text = re.sub(r'\s+', ' ', text)
    if 'ÇÖZÜMLÜ' in text.upper():
        return 'worked', None
    match = re.search(r'(\d+)\.?\s*TEST(?:\s*[-–]\s*([ABC]))?', text, re.I)
    if not match:
        match = re.search(r'TEST\s*(\d+)(?:\s*[-–]\s*([ABC]))?', text, re.I)
    if match:
        return 'test', match[1] + (match[2] or '')
    return 'unknown', None

def extract_answer_rows(text):
    topic = None
    rows = []
    for line in text.splitlines():
        stripped = line.strip()
        row = re.match(r'^(\d+)\.\s*TEST(?:\s*[-–]\s*([ABC]))?\s+(.+)$', stripped, re.I)
        if row:
            answers = re.findall(r'\b([A-E])\b', row[3])
            if topic and answers:
                rows.append({'topic':topic, 'test':row[1] + (row[2] or ''), 'answers':answers})
            continue
        if stripped and len(stripped)>10 and stripped==stripped.upper() and 'CEVAP ANAHTARI' not in stripped and re.search(r'[A-ZÇĞİÖŞÜ]', stripped) and not re.search(r'\d', stripped):
            topic = key_text(stripped)
    return rows

def question_spans(page):
    anchors = []
    width, height = page.rect.width, page.rect.height
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                match = re.fullmatch(r'(\d{1,2})\.\s*',span['text'])
                inline = None if match else re.match(r'^(\d{1,2})\.\s+\S',span['text'])
                if inline:
                    # A few real question numbers share a bold span with
                    # their stem. Solution steps such as "1. Durum" and chart
                    # labels are indented away from the question-number gutter.
                    relative = span['bbox'][0]/width
                    if 'Bold' in span['font'] and (.052<relative<.07 or .514<relative<.54):
                        match = inline
                if not match:
                    continue
                x0,y0,x1,y1 = span['bbox']
                relative = x0/width
                # Actual MEB source columns, not arbitrary numbered text inside
                # a diagram/solution. A later option gate rejects weak spans.
                column = 0 if .035<relative<.105 else 1 if .49<relative<.575 else None
                if column is not None and 46<y0<height*.94 and 1<=int(match[1])<=80:
                    anchors.append({'number':int(match[1]),'column':column,'bbox':list(span['bbox']), 'font':span['font']})
    unique = {}
    for anchor in anchors:
        signature=(anchor['number'],anchor['column'],round(anchor['bbox'][1]))
        unique.setdefault(signature,anchor)
    return sorted(unique.values(),key=lambda a:(a['column'],a['bbox'][1]))

def split_mc(text):
    before_solution = re.split(r'Ç[öÖ]z[üÜ]m\s*[:：]|ÇÖZÜM\s*[:：]',text,maxsplit=1)[0]
    labels = list(re.finditer(r'(?<![\w(])([ABCDE])\)',before_solution))
    ids = [m[1] for m in labels]
    # Point/function names in a diagram or stem can look like C). A complete
    # terminal A–E run identifies choices while keeping that earlier material
    # in the stem. Extra labels after the run remain deliberately ambiguous.
    choice_start = len(ids)-5
    if choice_start < 0 or ids[choice_start:] != list('ABCDE'):
        return {'prompt':before_solution.strip(),'options':[], 'fiveLabels':False, 'detectedLabels':ids}
    labels = labels[choice_start:]
    options = []
    for index,match in enumerate(labels):
        stop = labels[index+1].start() if index+1<len(labels) else len(before_solution)
        options.append({'id':match[1],'text':before_solution[match.end():stop].strip()})
    prompt = re.sub(r'^\s*\d{1,2}\.\s*','',before_solution[:labels[0].start()]).strip()
    return {'prompt':prompt,'options':options, 'fiveLabels':True, 'detectedLabels':ids}

def source_parts(page, rectangle, single_left):
    """Keep source reading order when a worked solution occupies the right.

    The crop itself remains the whole question plus worked solution. Only the
    text extraction region changes; the original bytes and figures stay intact.
    """
    import fitz
    raw = page.get_text(clip=rectangle,sort=True)
    if not single_left:
        return raw, raw, None
    solution_spans=[]
    for block in page.get_text('dict',clip=rectangle)['blocks']:
        for line in block.get('lines',[]):
            for span in line['spans']:
                if re.search(r'Ç[öÖ]z[üÜ]m\s*[:：]',span['text']):
                    solution_spans.append(span)
    if not solution_spans:
        return raw, raw, None
    solution=min(solution_spans,key=lambda s:s['bbox'][1])
    x,y,_,_=solution['bbox']
    if x>=page.rect.width*.498 and y<rectangle.y0+25:
        stem=page.get_text(clip=fitz.Rect(rectangle.x0,rectangle.y0,page.rect.width*.499,rectangle.y1),sort=True)
        worked=page.get_text(clip=fitz.Rect(page.rect.width*.498,rectangle.y0,rectangle.x1,rectangle.y1),sort=True)
        return raw, stem, worked
    return raw, raw, None

def following_column_prefix(pdf, page_index, column):
    """Find a real source continuation before the next numbered question."""
    import fitz
    next_page=page_index if column==0 else page_index+1
    next_column=1 if column==0 else 0
    if next_page>=len(pdf):
        return None
    page=pdf[next_page]
    anchors=[a for a in question_spans(page) if a['column']==next_column]
    width,height=page.rect.width,page.rect.height
    bottom=anchors[0]['bbox'][1]-5 if anchors else height*.951
    if bottom<90:
        return None
    rectangle=fitz.Rect(width*.041 if next_column==0 else width*.498,60,
                        width*.499 if next_column==0 else width*.96,bottom)
    text=page.get_text(clip=rectangle,sort=True)
    if len(split_mc(text)['detectedLabels'])<2:
        return None
    return next_page,rectangle,text

def render_source_crop(pdf, segments, path, scale):
    """Render one or more unchanged source clips, in their reading order."""
    import fitz
    if len(segments)==1:
        page_index,rectangle=segments[0]
        pdf[page_index].get_pixmap(matrix=fitz.Matrix(scale,scale),clip=rectangle,alpha=False).save(path)
        return
    # A flowing-column question can begin at a column's foot and continue at
    # the next column/page's top. A private composite keeps both original
    # vector clips visible; it does not rewrite formulae, choices or figures.
    combined=fitz.open()
    width=max(rect.width for _,rect in segments)
    height=sum(rect.height for _,rect in segments)+8*(len(segments)-1)
    sheet=combined.new_page(width=width,height=height)
    y=0
    for page_index,rectangle in segments:
        sheet.show_pdf_page(fitz.Rect(0,y,rectangle.width,y+rectangle.height),pdf,page_index,clip=rectangle)
        y+=rectangle.height+8
    sheet.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False).save(path)

def printed_page(page):
    import fitz
    values=re.findall(r'\b(\d{1,3})\b',page.get_text(clip=fitz.Rect(page.rect.width*.35,page.rect.height*.95,page.rect.width*.65,page.rect.height)))
    return int(values[0]) if len(set(values))==1 else None

def self_test():
    for path in [ROOT/'data/originals',ROOT/'docs/originals']:
        try: private_output(path)
        except ValueError: pass
        else: raise AssertionError('Public original-output path accepted')
    assert private_output(ROOT/'private/meb') == ROOT/'private/meb'
    assert header_test('MATEMATİK ÖRNEK TEST 2 - A') == ('test','2A')
    assert header_test('2. TEST - B') == ('test','2B')
    assert header_test('ÇÖZÜMLÜ SORULAR') == ('worked',None)
    rows=extract_answer_rows('KÜMELERDE TEMEL KAVRAMLAR\n1 2 3\n1. TEST D C A\n2. TEST - B E A D')
    assert rows[0]['answers']==['D','C','A'] and rows[1]['test']=='2B'
    mc=split_mc('1. TEST-ONLY stem\nA) one B) two C) three D) four E) five\nÇözüm: explanation\nCevap: C')
    assert len(mc['options'])==5 and mc['options'][-1]['text']=='five'
    assert not split_mc('1. stem A) only B) partial')['fiveLabels']
    mc=split_mc('1. The point C) lies on f(A). Which? A) one B) two C) three D) four E) five')
    assert mc['fiveLabels'] and 'C) lies' in mc['prompt'] and mc['options'][0]['text']=='one'
    assert not split_mc('1. ambiguous A) 1 B) 2 C) 3 D) 4 E) 5 A) extra')['fiveLabels']
    import fitz
    pdf=fitz.open(); page=pdf.new_page()
    page.insert_text((36,80),'25. A synthetic question',fontname='hebo')
    page.insert_text((55,220),'1. solution step',fontname='hebo')
    assert [a['number'] for a in question_spans(page)]==[25]
    # Questions continuing between columns must retain the same source text,
    # not fabricate a second stem from its continuation.
    page.insert_text((313,110),'A) one B) two C) three D) four E) five')
    page.insert_text((313,330),'26. Next question',fontname='hebo')
    continuation=following_column_prefix(pdf,0,0)
    assert continuation and split_mc(continuation[2])['fiveLabels']
    print('MEB extraction self-test passed: private output, test-key rows and five-option gates.')

def main(args):
    import fitz
    output=private_output(args.output)
    output.mkdir(parents=True,exist_ok=True)
    (output/'crops').mkdir(exist_ok=True)
    manifest=json.loads(Path(args.manifest).read_text())
    sources=[row for row in manifest if row.get('type')=='.pdf' and 'MEB_Dort_Dortluk' in row['member']]
    key_source=next(row for row in sources if 'PDF_555-560' in row['member'])
    key_index={}
    with fitz.open(key_source['path']) as key_pdf:
        for index,page in enumerate(key_pdf):
            for row in extract_answer_rows(page.get_text(sort=True)):
                signature=(row['topic'],row['test'])
                if signature in key_index:raise ValueError('Ambiguous answer-key topic/test row')
                key_index[signature]={**row,'physicalPage':index+1,'sha256':key_source['sha256']}
    existing={}
    curated=json.loads(Path(args.existing_bank).read_text())['questions']
    for q in curated:
        s=q['source'];existing[(s['sha256'],s['physicalPage'],s['questionNumber'])]=q['id']
    review_path=output/'layout-reviews.json'
    visual_reviews={}
    if review_path.exists():
        for review in json.loads(review_path.read_text()).get('reviews',[]):
            visual_reviews[(review['sha256'],review['physicalPage'],review['questionNumber'])]=review
    inventory_sha=digest(json.dumps([(s['sha256'],s['member']) for s in sources],ensure_ascii=False).encode())
    records,documents,pages=[],[],[]
    resumed_ids=set()
    checkpoint_path=output/'questions.partial.json'
    if not args.restart and checkpoint_path.exists():
        prior=json.loads(checkpoint_path.read_text())
        if prior.get('version')==VERSION and prior.get('sourceInventorySha256')==inventory_sha and prior.get('scale')==args.scale:
            for document in prior['documents']:
                candidates=[q for q in prior['questions'] if q['source']['sourceDocumentId']==document['id']]
                if all(Path(q['sourceAssets']['cropPath']).exists() and digest(Path(q['sourceAssets']['cropPath']).read_bytes())==q['sourceAssets']['cropSha256'] for q in candidates):
                    resumed_ids.add(document['id'])
                    documents.append(document);records.extend(candidates)
                    pages.extend(p for p in prior['pages'] if p['sourceDocumentId']==document['id'])
    rejected_total=sum(len(p['rejectedAnchors']) for p in pages)
    for source in sources:
        content=Path(source['path']).read_bytes()
        if digest(content)!=source['sha256']:raise ValueError('Source PDF hash changed')
        document_id='pdf-'+source['sha256'][:16]
        if document_id in resumed_ids:
            continue
        if source==key_source:
            documents.append({'id':document_id,'sha256':source['sha256'],'pageCount':6,'role':'answer_key','state':'read_key_rows'})
            continue
        start=int(re.search(r'PDF_(\d+)-',source['member'])[1])
        topic,course,subtopic=TOPICS[start]
        category=source['member'].split('/')[0]
        with fitz.open(source['path']) as pdf:
            doc_ids=[]
            for page_index,page in enumerate(pdf):
                physical=page_index+1
                width,height=page.rect.width,page.rect.height
                header=page.get_text(clip=fitz.Rect(0,0,width,65),sort=True)
                section,test=header_test(header)
                anchors=question_spans(page)
                by_column={c:[a for a in anchors if a['column']==c] for c in (0,1)}
                accepted,weak,rejected=[],[],[]
                for anchor in anchors:
                    column=anchor['column']
                    next_anchor=next((a for a in by_column[column] if a['bbox'][1]>anchor['bbox'][1]+3),None)
                    x0=width*.041 if column==0 else width*.498
                    x1=width*.499 if column==0 else width*.96
                    if len(anchors)==1 and column==0:
                        x1=width*.96
                    y0=max(47,anchor['bbox'][1]-4)
                    y1=(next_anchor['bbox'][1]-5) if next_anchor else height*.951
                    rectangle=fitz.Rect(x0,y0,x1,y1)
                    text,question_text,separate_solution=source_parts(page,rectangle,len(anchors)==1 and column==0)
                    mc=split_mc(question_text)
                    segments=[(page_index,rectangle)]
                    if len(mc['detectedLabels'])<2 and next_anchor is None:
                        continuation=following_column_prefix(pdf,page_index,column)
                        if continuation:
                            next_page,next_rect,next_text=continuation
                            segments.append((next_page,next_rect))
                            text+='\n'+next_text
                            question_text+='\n'+next_text
                            mc=split_mc(question_text)
                    visual_review=visual_reviews.get((source['sha256'],physical,anchor['number']))
                    visually_observed=bool(visual_review and visual_review.get('fiveChoicesObserved') is True)
                    # Two or more choice labels and a numbered stem provide a
                    # plausible source record. Missing labels remain review.
                    if (len(mc['detectedLabels'])<2 and not visually_observed) or len(mc['prompt'])<12:
                        rejected.append({'questionNumber':anchor['number'],'bbox':anchor['bbox'],'reason':'no_clear_multiple_choice_body'})
                        continue
                    identifier=f"ORIG-{source['sha256'][:12]}-P{physical:03}-Q{anchor['number']:02}"
                    if any(q['id']==identifier for q in records):
                        # Never silently overwrite conflicting labels on the
                        # same source page; preserve a bbox-specific candidate.
                        identifier += '-Y'+str(round(anchor['bbox'][1]))
                    original_existing=existing.get((source['sha256'],physical,anchor['number']))
                    crop=output/'crops'/(identifier+'.png')
                    render_source_crop(pdf,segments,crop,args.scale)
                    inline=list(dict.fromkeys(re.findall(r'Cevap\s*[:：]\s*([A-E])',text,re.I)))
                    answer=None;evidence=None
                    if section=='worked' and len(inline)==1:
                        answer=inline[0].upper()
                        evidence={'type':'inline_worked_answer','sourceSha256':source['sha256'],'physicalPage':physical}
                    elif section=='test' and test:
                        key=key_index.get((key_text(topic),test))
                        if key and anchor['number']<=len(key['answers']):
                            answer=key['answers'][anchor['number']-1]
                            evidence={'type':'publisher_answer_key_table','sourceSha256':key['sha256'],'physicalPage':key['physicalPage'],'topic':topic,'test':test,'questionNumber':anchor['number']}
                    reasons=['independent_mathematical_check_required']
                    if not mc['fiveLabels']:reasons.append('five_option_text_transcription_requires_review')
                    if answer is None:reasons.append('publisher_answer_not_matched')
                    record={'id':identifier,'origin':'ORIJINAL','pool':'original_private','examType':'TYT' if category=='TYT' else None,
                            'sourceExamLabel':category,'classificationStatus':'directory_topic_provisional_needs_question_review',
                            'courseId':course,'topic':topic,'subtopic':subtopic,'prompt':mc['prompt'],'options':mc['options'],
                            'source':{'sha256':source['sha256'],'sourceDocumentId':document_id,'relativePath':source['archive']+'/'+source['member'],
                                      'physicalPage':physical,'printedPage':printed_page(page),'originalPdfPage':start+page_index,
                                      'originalPdfPageBasis':'provided_filename_range_not_full_book_crosschecked','questionNumber':anchor['number'],
                                      'section':section,'test':test,'clipRect':list(rectangle)},
                            'answer':{'value':answer,'status':'publisher_provided_not_independently_verified' if answer else 'unknown','evidence':evidence},
                            'solutionText':re.split(r'Ç[öÖ]z[üÜ]m\s*[:：]',separate_solution or text,maxsplit=1)[1].strip() if re.search(r'Ç[öÖ]z[üÜ]m\s*[:：]',separate_solution or text) else None,
                            'rawSourceText':text,'sourceAssets':{'cropPath':str(crop),'cropSha256':digest(crop.read_bytes()),'scale':args.scale,
                                                              'originalPdfPreserved':True,'figureAndChoiceLayoutPreservedInCrop':True,
                                                              'parts':[{'physicalPage':n+1,'clipRect':list(r)} for n,r in segments]},
                            'extraction':{'status':'five_choice_source_capture_requires_visual_review' if mc['fiveLabels'] else 'partial_transcription_requires_review',
                                          'fiveChoiceLabels':mc['fiveLabels'],'detectedChoiceLabels':mc['detectedLabels'],
                                          'fiveChoicesVisuallyObserved':visually_observed,'layoutReview':visual_review,
                                          'method':'actual_pdf_spatial_two_column_text_and_crop'},
                            'permission':{'status':'unverified','publishable':False},
                            'verification':{'status':'pending_review','mathPassed':False,'reasons':reasons,'editorialStatus':'pending'},
                            'existingCuratedId':original_existing}
                    records.append(record);doc_ids.append(identifier);accepted.append(identifier)
                    if not mc['fiveLabels']:weak.append(identifier)
                notes_only=bool(re.fullmatch(r'\s*Notlarım\s*\d*\s*',page.get_text(sort=True),re.I))
                pages.append({'sourceDocumentId':document_id,'physicalPage':physical,'printedPage':printed_page(page),'section':section,'test':test,
                              'questionIds':accepted,'partialQuestionIds':weak,'rejectedAnchors':rejected,
                              'state':'question_captures_need_math_and_visual_review' if accepted else 'notes_page_no_question' if notes_only else 'no_question_extracted_needs_layout_review',
                              'rawPageTextPath':None,'actualPdfPageRead':True})
                rejected_total+=len(rejected)
            documents.append({'id':document_id,'sha256':source['sha256'],'member':source['member'],'pageCount':len(pdf),'questionIds':doc_ids,'state':'page_scan_complete_math_pending'})
        # An atomic checkpoint for each completed document prevents repeating
        # PDF scanning and crop creation after an interrupted work session.
        checkpoint={'schemaVersion':1,'version':VERSION,'sourceInventorySha256':inventory_sha,'scale':args.scale,'questions':records,'documents':documents,'pages':pages}
        temporary=output/'questions.partial.tmp'
        temporary.write_text(json.dumps(checkpoint,ensure_ascii=False,indent=2)+'\n');temporary.replace(output/'questions.partial.json')
    summary={'actualPdfDocumentsRead':len(sources),'questionPdfDocuments':len(sources)-1,'answerKeyDocuments':1,
             'actualPagesRead':sum(d['pageCount'] for d in documents),'questionPagesRead':len(pages),
             'originalQuestionCaptures':len(records),'fiveChoiceTextCaptures':sum(q['extraction']['fiveChoiceLabels'] for q in records),
             'partialTextCaptures':sum(not q['extraction']['fiveChoiceLabels'] for q in records),
             'publisherAnswerMatched':sum(q['answer']['value'] is not None for q in records),
             'existingCuratedSourceMatches':sum(q['existingCuratedId'] is not None for q in records),
             'newIndependentMathVerified':0,'publishableOriginalQuestions':0,'rejectedWeakAnchors':rejected_total,
             'pagesWithoutAcceptedCapture':sum(not p['questionIds'] for p in pages),
             'notesOnlyPages':sum(p['state']=='notes_page_no_question' for p in pages),
             'pagesNeedingLayoutReview':sum(p['state']=='no_question_extracted_needs_layout_review' for p in pages),
             'resumedDocuments':len(resumed_ids),
             'limits':['Source crop/layout and provided answer are preserved, not independently verified mathematics.',
                       'Unreviewed labels/formula text may be incomplete; original crop is authoritative.',
                       'ORTAK source level and all new classifications need individual review.']}
    result={'schemaVersion':1,'version':VERSION,'summary':summary,'questions':records,'documents':documents,'pages':pages}
    temp=output/'questions.tmp';temp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');temp.replace(output/'questions.json')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',default='/workspace/pdf-access-check-20261113/files.json')
    parser.add_argument('--existing-bank',default='/workspace/pdf-access-check-20261113/private-ingestion/original-questions.json')
    parser.add_argument('--output',default='/workspace/pdf-access-check-20261113/bulk/meb')
    parser.add_argument('--scale',type=float,default=2)
    parser.add_argument('--restart',action='store_true',help='Ignore completed-document checkpoints and scan all source pages again')
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:self_test()
    else:main(args)
