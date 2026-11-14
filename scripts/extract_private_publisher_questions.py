#!/usr/bin/env python3
"""Preserve individual questions from supplied publisher PDFs in PRIVATE staging.

Native text/XML or provisional OCR supplies geometric anchors. The original
page and exact source crop remain authoritative. OCR, five option labels, or a
publisher answer never constitutes independent mathematical verification.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import multiprocessing
import os
import re
import subprocess
import xml.etree.ElementTree as ET
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

VERSION = 'publisher-private-v1'
ROOT = Path(__file__).resolve().parents[1]
LETTERS = list('ABCDE')

def digest(value):
    return hashlib.sha256(value).hexdigest()

def private_path(path):
    target = Path(path).resolve()
    if target == ROOT or ROOT in target.parents:
        allowed = ROOT / 'private'
        if target != allowed and allowed not in target.parents:
            raise ValueError('Publisher content output must be outside the repository or under ignored private/')
    return target

def selected_documents(rows):
    result = []
    for row in rows:
        if row.get('type') != '.pdf' or row['member'].startswith(('TYT_DENEMESI/', 'CEVAP/')):
            continue
        if Path(row['member']).name.startswith(('MEB_Dort_Dortluk', 'Orijinal_TYT_AYT_Geometri')):
            continue
        result.append(row)
    return result

def source_xml(page):
    # MuPDF may expose a font's control-code mapping as an invalid XML numeric
    # entity. Discard only XML-forbidden control characters, never visible text.
    def valid_entity(match):
        value=int(match[1],16) if match[1] else int(match[2])
        return match[0] if value in (9,10,13) or 32<=value<=0xd7ff or 0xe000<=value<=0xfffd or 0x10000<=value<=0x10ffff else ''
    return ET.fromstring(re.sub(r'&#(?:x([0-9A-Fa-f]+)|(\d+));',valid_entity,page.get_text('xml')))

def xml_words(page):
    """Recover Unicode positions where native plain text omits zero-width glyphs."""
    root = source_xml(page)
    result = []
    for line in root.iter('line'):
        chars = list(line.iter('char'))
        current = []
        def finish():
            if not current:
                return
            text = ''.join(c.get('c', '') for c in current)
            coords = [list(map(float, c.get('quad', '').split())) for c in current if c.get('quad')]
            if coords:
                xs = [v for q in coords for v in q[0::2]]
                ys = [v for q in coords for v in q[1::2]]
                result.append((min(xs), min(ys), max(xs), max(ys), text, 100.0))
            current.clear()
        for char in chars:
            if char.get('c', '').isspace():
                finish()
            else:
                current.append(char)
        finish()
    return result

def anchors_from_words(words, width, height):
    anchors = []
    for word in words:
        x0,y0,x1,y1,text,*rest = word
        match = re.fullmatch(r'([1-9]\d?)[.)]', str(text).strip())
        # Exact punctuation avoids interpreting arbitrary equation numbers as
        # starts. A missed OCR numeral is retained in the page-review queue.
        if not match:
            continue
        confidence = rest[0] if rest else 100
        if isinstance(confidence, (int,float)) and confidence < 35:
            continue
        fraction = x0 / width
        column = 0 if .035 <= fraction <= .155 else 1 if .495 <= fraction <= .625 else None
        if column is None or not height*.095 < y0 < height*.925 or int(match[1]) > 80:
            continue
        if any(abs(old['y']-y0)<6 and old['column']==column for old in anchors):
            continue
        anchors.append({'number':int(match[1]),'column':column,'x':round(x0,3),'y':round(y0,3),
                        'bbox':[round(v,3) for v in (x0,y0,x1,y1)],'anchorConfidence':confidence})
    return sorted(anchors,key=lambda row:(row['column'],row['y']))

def colored_number_anchors(page, color):
    """A publisher's red question numerals avoid black numbered figure labels.

    This profile is applied only to an inspected source series, and a page with
    no matching colored marker retains its generic candidates for review.
    """
    words=[]
    for line in source_xml(page).iter('line'):
        chars=[c for c in line.iter('char') if c.get('color')==color]
        text=''.join(c.get('c','') for c in chars).strip()
        if not re.fullmatch(r'[1-9]\d?[.)]',text):
            continue
        coords=[list(map(float,c.get('quad').split())) for c in chars if c.get('quad')]
        xs=[v for q in coords for v in q[0::2]];ys=[v for q in coords for v in q[1::2]]
        if xs and ys:words.append((min(xs),min(ys),max(xs),max(ys),text,100.0))
    return anchors_from_words(words,page.rect.width,page.rect.height)

def ocr_words(image, scale, tessdata, lang):
    command = ['tesseract',str(image),'stdout','--psm','3','-l',lang]
    if tessdata:
        command.extend(['--tessdata-dir',str(tessdata)])
    command.extend(['-c','tessedit_create_tsv=1'])
    environment=os.environ.copy();environment['OMP_THREAD_LIMIT']='1'
    result = subprocess.run(command,check=True,capture_output=True,text=True,timeout=80,env=environment)
    if not result.stdout.startswith('level\tpage_num\t'):
        raise ValueError('OCR did not return TSV; no provisional anchors may be inferred')
    words = []
    for row in csv.DictReader(io.StringIO(result.stdout),delimiter='\t'):
        text = row.get('text','').strip()
        if not text:
            continue
        try:
            left,top,width,height = (float(row[k])/scale for k in ('left','top','width','height'))
            confidence=float(row['conf'])
        except (KeyError,ValueError):
            continue
        words.append((left,top,left+width,top+height,text,confidence))
    return words

def word_text(words, rectangle):
    x0,y0,x1,y1 = rectangle
    inside = [w for w in words if w[0]>=x0-2 and w[2]<=x1+2 and w[1]>=y0-2 and w[3]<=y1+2]
    lines = []
    for word in sorted(inside,key=lambda w:(round(w[1]/4),w[0])):
        if not lines or abs(lines[-1]['y']-word[1])>5:
            lines.append({'y':word[1],'words':[word]})
        else:
            lines[-1]['words'].append(word)
    return '\n'.join(' '.join(w[4] for w in sorted(line['words'],key=lambda w:w[0])) for line in lines)

def option_data(text):
    matches = list(re.finditer(r'(?<!\w)([A-E])\s*[)）]',text))
    found = []
    options = []
    for index,match in enumerate(matches):
        letter=match[1]
        if letter in found:
            continue
        end=matches[index+1].start() if index+1<len(matches) else len(text)
        value=text[match.end():end].strip()
        # Strip explicit answer evidence out of the last distractor text.
        value=re.split(r'Cevap\s*[:：]',value,flags=re.I)[0].strip()
        found.append(letter)
        options.append({'id':letter,'text':value,'transcriptionStatus':'unverified_native_or_ocr'})
    return found,options

SECTION_PATTERN=r'([^\n]+?)\s*\|\s*Test\s*[-–]\s*(\d+)'

def section_key(topic,number):
    return re.sub(r'\s+',' ',topic.strip()).casefold(),int(number)

def parse_publisher_key_text(text,physical_page):
    """Return only complete, unique explicit heading/number/letter blocks."""
    headings=list(re.finditer(SECTION_PATTERN,text))
    records={}
    for index,heading in enumerate(headings):
        end=headings[index+1].start() if index+1<len(headings) else len(text)
        pairs=re.findall(r'(?<!\d)(\d{1,2})\s*[-–]\s*([A-E])\b',text[heading.end():end])
        answers={int(n):letter for n,letter in pairs}
        if not answers or len(answers)!=len(pairs) or sorted(answers)!=list(range(1,len(answers)+1)):
            continue
        key=section_key(heading[1],heading[2])
        records[key]={'topic':heading[1].strip(),'testNumber':int(heading[2]),'answers':answers,
                      'physicalPage':physical_page,'heading':heading[0].strip()}
    return records

def attach_explicit_publisher_keys(document,source_row,manifest):
    """Attach actual OFB key evidence; it remains mathematically unverified."""
    import fitz
    if not Path(source_row['member']).name.startswith('OFB_'):return
    key_rows=[r for r in manifest if r.get('type')=='.pdf' and r['member'].startswith('CEVAP/') and Path(r['member']).name.startswith('OFB_')]
    lookup={};ambiguous=set()
    for row in key_rows:
        if digest(Path(row['path']).read_bytes())!=row['sha256']:raise ValueError('Answer PDF changed')
        with fitz.open(row['path']) as pdf:
            for page_number,page in enumerate(pdf,1):
                for key,value in parse_publisher_key_text(page.get_text(),page_number).items():
                    if key in lookup:ambiguous.add(key)
                    value.update({'sha256':row['sha256'],'relativePath':row['archive']+'/'+row['member']})
                    lookup[key]=value
    sections={};section=None;section_start=None
    with fitz.open(source_row['path']) as pdf:
        for page_number,page in enumerate(pdf,1):
            headings=re.findall(SECTION_PATTERN,page.get_text())
            if len(headings)==1:
                section=section_key(*headings[0]);section_start=page_number
            elif headings:section=None
            # The inspected series prints the heading only on each test's
            # first page. Never infer a heading before one was actually read.
            if section is not None:sections[page_number]=(section,section_start)
    counts={}
    for q in document['questions']:
        page=q['source']['physicalPage']
        if page in sections:
            key=sections[page][0]+(q['source']['questionNumber'],)
            counts[key]=counts.get(key,0)+1
    for q in document['questions']:
        q['sourceAssets'].setdefault('cropPath',q['sourceAssets']['questionCrop'])
        page=q['source']['physicalPage'];number=q['source']['questionNumber']
        if page not in sections:continue
        section,section_start=sections[page];evidence=lookup.get(section)
        q['source']['publisherSection']={'topic':section[0],'testNumber':section[1],'headingPhysicalPage':section_start}
        if section in ambiguous or not evidence or counts.get(section+(number,))!=1 or number not in evidence['answers']:
            q['answer']['keyMatchStatus']='missing_or_ambiguous_explicit_section_question_match';continue
        q['answer']={'value':evidence['answers'][number],'status':'publisher_key_matched_not_independently_verified',
                     'mathematicallyVerified':False,'evidence':{k:v for k,v in evidence.items() if k!='answers'},
                     'questionNumber':number,'matchingMethod':'actual_native_test_heading_and_unique_original_question_number'}
    document['summary']['publisherKeyMatched']=sum(q['answer']['status']=='publisher_key_matched_not_independently_verified' for q in document['questions'])

def process_document(task):
    import fitz
    row, config = task
    out = Path(config['output'])
    doc_id = 'pdf-' + row['sha256'][:16]
    folder = out / doc_id
    folder.mkdir(parents=True,exist_ok=True)
    if digest(Path(row['path']).read_bytes()) != row['sha256']:
        raise ValueError('Supplied PDF byte hash changed: '+row['member'])
    identity = digest(json.dumps({'version':VERSION,'sha':row['sha256'],'dpi':config['dpi'],
                                 'lang':config['lang'],'tessdata':config['tessdata']},sort_keys=True).encode())
    questions,pages = [],[]
    with fitz.open(row['path']) as pdf:
        if pdf.needs_pass:
            raise ValueError('PDF encrypted: '+row['member'])
        for page_number,page in enumerate(pdf,1):
            cache = folder / f'page-{page_number:03}.json'
            if cache.exists() and not config['force']:
                saved=json.loads(cache.read_text())
                color_profile_ok=(not Path(row['member']).name.startswith('OFB_') or saved['page'].get('coloredNumberProfileVersion')==1)
                if saved.get('inputIdentity')==identity and color_profile_ok and (saved['page'].get('textMode') != 'ocr_provisional' or saved['page'].get('ocrTsvValidated') is True):
                    pages.append(saved['page']);questions.extend(saved['questions']);continue
            native_words=[(*w[:5],100.0) for w in page.get_text('words')]
            words=native_words
            mode='native_pdf_words'
            native_text=page.get_text()
            xml_recovered=False
            if len(''.join(native_text.split()))<200:
                recovered=xml_words(page)
                if sum(len(w[4]) for w in recovered)>sum(len(w[4]) for w in native_words)+100:
                    words=recovered;mode='native_pdf_xml';xml_recovered=True
            width,height=page.rect.width,page.rect.height
            anchors=anchors_from_words(words,width,height)
            if Path(row['member']).name.startswith('OFB_'):
                colored=colored_number_anchors(page,'#ed1c24')
                if colored:anchors=colored
            image=folder/f'page-{page_number:03}.png'
            scale=config['dpi']/72
            if not image.exists() or config['force']:
                page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False).save(image)
            ocr_error=None
            if not anchors and sum(len(w[4]) for w in words)<350:
                # Chapter covers and low-text figure pages remain reviewable;
                # OCR is a provisional transcription, never a source rewrite.
                try:
                    words=ocr_words(image,scale,config['tessdata'],config['lang'])
                    anchors=anchors_from_words(words,width,height)
                    mode='ocr_provisional'
                except (subprocess.SubprocessError,OSError,ValueError) as error:
                    ocr_error=type(error).__name__+':'+str(error)
            page_questions=[]
            used_numbers={}
            for anchor in anchors:
                column=anchor['column']
                following=[candidate for candidate in anchors if candidate['column']==column and candidate['y']>anchor['y']+5]
                bottom=min([candidate['y']-4 for candidate in following]+[height*.94])
                left=max(0,anchor['x']-7)
                right=width*.494 if column==0 else width*.973
                clip=[left,max(height*.06,anchor['y']-3),right,bottom]
                if clip[3]-clip[1]<20:
                    continue
                text=word_text(words,clip) if mode=='ocr_provisional' or xml_recovered else page.get_text(clip=fitz.Rect(clip),sort=True)
                labels,options=option_data(text)
                used_numbers[anchor['number']]=used_numbers.get(anchor['number'],0)+1
                suffix='' if used_numbers[anchor['number']]==1 else '-S'+str(used_numbers[anchor['number']])
                qid=f"ORIG-{row['sha256'][:12]}-P{page_number:03}-Q{anchor['number']:02}"+suffix
                crop=folder/(qid+'.png')
                page.get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(clip),alpha=False).save(crop)
                complete=labels==LETTERS and all(option['text'] for option in options)
                inline=re.search(r'Cevap\s*[:：]\s*([A-E])\b',text,re.I)
                parts=Path(row['member']).parts
                question={'id':qid,'origin':'ORIJINAL','pool':'original_private',
                    'source':{'sha256':row['sha256'],'documentId':doc_id,'relativePath':row['archive']+'/'+row['member'],
                              'physicalPage':page_number,'questionNumber':anchor['number'],'questionNumberBasis':mode,
                              'bbox':clip,'column':column,'anchorConfidence':anchor['anchorConfidence']},
                    'sourceAssets':{'cropPath':str(crop),'questionCrop':str(crop),'questionCropSha256':digest(crop.read_bytes()),'fullPageImage':str(image),
                                    'sourcePdfPath':row['path'],'sourcePreservedWithoutRedrawing':True},
                    'prompt':text[:next((m.start() for m in re.finditer(r'(?<!\w)A\s*[)）]',text)),len(text))].strip(),
                    'rawText':text,'options':options,'extraction':{'status':'five_option_label_candidate' if complete else 'incomplete_option_transcription_review',
                        'textMode':mode,'optionLabels':labels,'allFiveOptionLabelsCaptured':complete,
                        'figureAndOptionsPreservedInSourceImage':True,'crossPageContinuationNotAutomaticallyResolved':not complete,
                        'notHumanEditorialApproval':True},
                    'answer':{'value':inline[1].upper() if inline else None,
                              'status':'publisher_inline_not_independently_verified' if inline else 'unknown',
                              'mathematicallyVerified':False},
                    'examType':parts[0] if parts[0] in ('TYT','AYT') else 'ORTAK',
                    'topic':parts[1] if len(parts)>1 else None,'subtopic':parts[-2],
                    'classificationStatus':'directory_label_provisional_question_level_review_pending',
                    'permission':{'status':'unverified','publishable':False},
                    'verification':{'status':'pending_review','mathPassed':False,'methods':[],
                                    'reasons':['independent_math_check_required']+([] if complete else ['five_option_transcription_requires_review'])}}
                page_questions.append(question)
            page_record={'physicalPage':page_number,'status':'processed_with_question_candidates' if page_questions else 'processed_no_reliable_question_anchor_review',
                         'textMode':mode,'rawPageText':native_text,'fullPageImage':str(image),'questionIds':[q['id'] for q in page_questions],
                         'questionCandidateCount':len(page_questions),'ocrError':ocr_error,'inputIdentity':identity,
                         'ocrTsvValidated':mode=='ocr_provisional' and ocr_error is None,
                         'coloredNumberProfileVersion':1 if Path(row['member']).name.startswith('OFB_') else None}
            saved={'inputIdentity':identity,'page':page_record,'questions':page_questions}
            cache.write_text(json.dumps(saved,ensure_ascii=False,indent=2)+'\n')
            pages.append(page_record);questions.extend(page_questions)
    result={'schemaVersion':1,'document':{'id':doc_id,'sha256':row['sha256'],'relativePath':row['archive']+'/'+row['member'],'pageCount':len(pages)},
            'questions':questions,'pages':pages,
            'summary':{'questionCandidates':len(questions),'fiveOptionLabelCandidates':sum(q['extraction']['allFiveOptionLabelsCaptured'] for q in questions),
                       'independentlyVerified':0,'pagesProcessed':len(pages),'pagesWithoutReliableAnchor':sum(not p['questionIds'] for p in pages)}}
    target=folder/'document.json';target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return {'path':str(target),'document':result['document'],'summary':result['summary']}

def self_test():
    assert not anchors_from_words([(110,90,120,100,'1.',99)],600,800)
    anchors=anchors_from_words([(50,100,60,110,'1.',99),(330,120,340,130,'4.',95),(50,20,60,30,'2.',99)],600,800)
    assert [a['number'] for a in anchors]==[1,4]
    assert option_data('A) 1 B) 2 C) 3 D) 4 E) 5')[0]==LETTERS
    assert option_data('A) 1 B) 2 D) 4 E) 5')[0]!=LETTERS
    key=parse_publisher_key_text('Konu | Test - 2\n1 - C\n2 - B\n',3)
    assert key[('konu',2)]['answers']=={1:'C',2:'B'}
    assert not parse_publisher_key_text('Konu | Test - 2\n1 - C\n1 - B\n',3)
    assert not parse_publisher_key_text('Konu | Test - 2\n1 - C\n3 - B\n',3)
    try:private_path(ROOT/'data/publisher-bodies')
    except ValueError:pass
    else:raise AssertionError('Public source output accepted')
    print('Publisher extraction self-test: geometric anchors, missing options, private output gate passed.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',default='/workspace/pdf-access-check-20261113/files.json')
    parser.add_argument('--output',default='/workspace/pdf-access-check-20261113/bulk/other')
    parser.add_argument('--tessdata-dir',default='/workspace/pdf-access-check-20261113/ocr/tessdata')
    parser.add_argument('--lang',default='tur+eng')
    parser.add_argument('--dpi',type=int,default=180)
    parser.add_argument('--workers',type=int,default=2)
    parser.add_argument('--limit-documents',type=int)
    parser.add_argument('--force',action='store_true')
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:self_test();return
    out=private_path(args.output);out.mkdir(parents=True,exist_ok=True)
    manifest=json.loads(Path(args.manifest).read_text());rows=selected_documents(manifest)
    if args.limit_documents:rows=rows[:args.limit_documents]
    config={'output':str(out),'dpi':args.dpi,'tessdata':args.tessdata_dir,'lang':args.lang,'force':args.force}
    completed=[]
    with ProcessPoolExecutor(max_workers=max(1,min(args.workers,2)),mp_context=multiprocessing.get_context('spawn')) as executor:
        futures={executor.submit(process_document,(row,config)):row for row in rows}
        for future in as_completed(futures):
            row=futures[future]
            try:record=future.result()
            except Exception as error:record={'error':type(error).__name__+':'+str(error),'member':row['member']}
            completed.append(record)
            (out/'progress.json').write_text(json.dumps({'version':VERSION,'documentsExpected':len(rows),'documentsFinished':completed},ensure_ascii=False,indent=2)+'\n')
            print(json.dumps(record,ensure_ascii=False),flush=True)
    questions=[];pages=[]
    for record in completed:
        if 'path' not in record:continue
        payload=json.loads(Path(record['path']).read_text())
        source_row=next(r for r in rows if r['sha256']==payload['document']['sha256'])
        attach_explicit_publisher_keys(payload,source_row,manifest)
        for question in payload['questions']:
            question['sourceAssets'].setdefault('cropPath',question['sourceAssets']['questionCrop'])
        Path(record['path']).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
        record['summary']=payload['summary'];questions.extend(payload['questions']);pages.extend(payload['pages'])
    questions.sort(key=lambda q:(q['source']['relativePath'],q['source']['physicalPage'],q['source']['column'],q['source']['bbox'][1]))
    result={'schemaVersion':1,'version':VERSION,'questions':questions,'documents':completed,
            'summary':{'documentsExpected':len(rows),'documentsCompleted':sum('path'in r for r in completed),'pagesProcessed':len(pages),
                       'questionCandidates':len(questions),'fiveOptionLabelCandidates':sum(q['extraction']['allFiveOptionLabelsCaptured'] for q in questions),
                       'independentlyVerified':0,'pendingReview':len(questions),'pagesWithoutReliableQuestionAnchor':sum(not p['questionIds'] for p in pages),
                       'publisherAnswerUnknown':sum(q['answer']['value'] is None for q in questions),
                       'publisherKeyMatchedNotMathVerified':sum(q['answer']['status']=='publisher_key_matched_not_independently_verified' for q in questions),
                       'publicOriginalQuestionBodies':0,'scope':'Source images preserved; candidate segmentation and OCR are NOT independently verified questions.'}}
    (out/'questions.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['summary'],ensure_ascii=False),flush=True)

if __name__=='__main__':main()
