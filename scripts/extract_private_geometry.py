#!/usr/bin/env python3
"""Extract private, unchanged geometry question images from actual supplied PDFs.

Pink printed question numbers provide layout anchors. OCR is a fallible private
transcription aid; neither it nor a question-number candidate proves that a
question/answer has been independently verified. Original crops never publish.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'geometry-pink-anchors-v2'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)

def private_output(path):
    path = Path(path).resolve()
    if (path == ROOT or ROOT in path.parents) and not (path == ROOT / 'private' or ROOT / 'private' in path.parents):
        raise ValueError('Original geometry must remain outside the public repository or under ignored private/')
    return path

def parse_tsv(text):
    output = []
    for row in csv.DictReader(io.StringIO(text), delimiter='\t'):
        if not row.get('text', '').strip():
            continue
        output.append({'text':row['text'], 'x':int(row['left']), 'y':int(row['top']),
                       'w':int(row['width']), 'h':int(row['height']), 'confidence':float(row['conf']),
                       'line':(row['block_num'], row['par_num'], row['line_num'])})
    return output

def ocr(path, languages, tessdata, psm=3, numeric=False):
    command = ['tesseract', str(path), 'stdout', '--psm', str(psm), '-l', languages]
    if tessdata:
        command += ['--tessdata-dir', str(tessdata)]
    if numeric:
        command += ['-c', 'tessedit_char_whitelist=0123456789.']
    # A custom traineddata directory need not contain Tesseract's configs/tsv
    # file. Request the renderer directly instead of silently getting TXT.
    command += ['-c', 'tessedit_create_tsv=1']
    result = subprocess.run(command, text=True, capture_output=True, timeout=100,
                            env={**os.environ, 'OMP_THREAD_LIMIT':'1'})
    if result.returncode:
        raise RuntimeError('Tesseract failed: ' + result.stderr[-500:])
    if not result.stdout.startswith('level\tpage_num\t'):
        raise RuntimeError('Tesseract did not return a TSV word-coordinate table')
    return parse_tsv(result.stdout), result.stdout

def pink_boxes(image):
    import numpy as np
    pixels = np.asarray(image.convert('RGB'))
    height, width = pixels.shape[:2]
    red, green, blue = [pixels[:,:,i].astype('float32') for i in range(3)]
    mask = (red > 160) & (blue > 100) & (red > green * 1.2) & (blue > green * 1.2)
    boxes = []
    # Keep source-coordinate information; these lanes contain printed labels,
    # not the redrawn diagram. The cropped source page itself is never edited.
    for column, (left, right) in enumerate(((.07,.13),(.515,.575))):
        x0, x1 = round(width * left), round(width * right)
        rows = np.flatnonzero(mask[:,x0:x1].sum(1) >= 2)
        groups = []
        for y in rows:
            if not groups or y - groups[-1][-1] > 4:
                groups.append([int(y)])
            else:
                groups[-1].append(int(y))
        for group in groups:
            y0, y1 = group[0], group[-1] + 1
            if y0 < height * .065 or y1 > height * .93 or not 6 <= y1-y0 <= 70:
                continue
            xs = np.flatnonzero(mask[y0:y1,x0:x1].any(0))
            bx0, bx1 = x0 + int(xs[0]), x0 + int(xs[-1]) + 1
            if bx1-bx0 > width * .048:
                continue
            boxes.append({'column':column, 'bboxPixels':[bx0,y0,bx1,y1], 'mask':mask})
    return boxes

def anchor_numbers(image, directory):
    import numpy as np
    from PIL import Image
    boxes = pink_boxes(image)
    if not boxes:
        return [], []
    canvas = Image.new('L', (300, 190 * len(boxes)), 255)
    for i, box in enumerate(boxes):
        x0,y0,x1,y1 = box['bboxPixels']
        # Numeric-only enhancement is used only to read the printed label.
        # Source diagrams/options are preserved in their original colours.
        mask = box['mask'][max(0,y0-3):y1+3,max(0,x0-3):x1+3]
        tile = Image.fromarray(np.uint8(~mask) * 255)
        scale = min(5, 145 / tile.height)
        tile = tile.resize((round(tile.width*scale),round(tile.height*scale)))
        canvas.paste(tile, (25,190*i+15))
    strip = directory / 'number-strip.png'
    canvas.save(strip)
    words, _ = ocr(strip, 'eng', None, 6, numeric=True)
    by_index = defaultdict(list)
    for word in words:
        by_index[(word['y'] + word['h']//2)//190].append(word)
    recognised, rejected = [], []
    for i, box in enumerate(boxes):
        candidates = by_index.get(i, [])
        raw = ''.join(word['text'] for word in candidates)
        clean = re.fullmatch(r'(\d{1,2})\.?',raw.strip())
        row = {key:value for key,value in box.items() if key != 'mask'}
        row['numberOcr'] = raw
        row['numberConfidence'] = min((word['confidence'] for word in candidates), default=-1)
        if clean and 1 <= int(clean[1]) <= 80 and row['numberConfidence'] >= 35:
            row['number'] = int(clean[1]); recognised.append(row)
        else:
            row['reason'] = 'pink_label_not_reliably_recognised'; rejected.append(row)
    return recognised, rejected

def native_xml_text(page):
    root = ET.fromstring(page.get_text('xml'))
    lines = []
    for line in root.findall('.//line'):
        chars = list(line.findall('.//char'))
        text = ''.join(char.get('c','') for char in chars)
        if text.strip():
            lines.append(text)
    return '\n'.join(lines)

def lines_in_box(words, box):
    x0,y0,x1,y1 = box
    selected = [word for word in words if x0 <= word['x']+word['w']/2 <= x1 and y0 <= word['y']+word['h']/2 <= y1]
    rows = defaultdict(list)
    for word in selected:
        rows[word['line']].append(word)
    ordered = sorted(rows.values(),key=lambda values:(min(w['y'] for w in values),min(w['x'] for w in values)))
    return '\n'.join(' '.join(w['text'] for w in sorted(values,key=lambda w:w['x'])) for values in ordered)

def observed_options(text):
    # Never fabricate a missing E or a mathematical symbol. The unchanged
    # image is the authoritative source, even when OCR cannot parse its options.
    markers = list(re.finditer(r'(?<!\w)([ABCDE])\s*[)\]]\s*',text,re.I))
    seen = {}
    for index, match in enumerate(markers):
        letter = match[1].upper()
        if letter in seen:
            continue
        end = markers[index+1].start() if index+1 < len(markers) else len(text)
        seen[letter] = text[match.end():end].strip()
    return [{'id':letter,'text':seen[letter],'status':'ocr_unverified'} for letter in 'ABCDE' if letter in seen]

def extract_page(task):
    import fitz
    from PIL import Image
    document, index, args = task
    source = Path(document['path'])
    source_id = 'pdf-' + document['sha256'][:16]
    directory = Path(args['output']) / 'pages' / source_id / f'p{index+1:04}'
    directory.mkdir(parents=True, exist_ok=True)
    result_path = directory / 'result.json'
    if result_path.exists() and not args['force']:
        previous = json.loads(result_path.read_text())
        if previous.get('extractorVersion') == VERSION and previous.get('sourceSha256') == document['sha256']:
            return previous
    with fitz.open(source) as pdf:
        page = pdf[index]
        page_width, page_height = page.rect.width, page.rect.height
        page_image = directory / 'source-page.png'
        if not page_image.exists() or args['force']:
            page.get_pixmap(matrix=fitz.Matrix(args['scale'],args['scale']),alpha=False).save(page_image)
        native_text = native_xml_text(page)
    image = Image.open(page_image).convert('RGB')
    scale_x, scale_y = image.width/page_width, image.height/page_height
    anchors, rejected = anchor_numbers(image, directory)
    tsv_path = directory / 'body-ocr.tsv'
    try:
        if not args['force'] and tsv_path.exists() and tsv_path.read_text().startswith('level\tpage_num\t'):
            words = parse_tsv(tsv_path.read_text())
        else:
            words, raw_tsv = ocr(page_image,args['languages'],args['tessdata'])
            tsv_path.write_text(raw_tsv)
    except Exception as error:
        words = []
        rejected.append({'reason':'body_ocr_failed','error':str(error)})
    questions = []
    used_ids = set()
    for column in (0,1):
        current = sorted([a for a in anchors if a['column']==column],key=lambda a:a['bboxPixels'][1])
        for offset, anchor in enumerate(current):
            x0 = round(image.width * (.045 if column==0 else .505))
            x1 = round(image.width * (.495 if column==0 else .985))
            y0 = max(0,anchor['bboxPixels'][1]-round(8*scale_y))
            y1 = (current[offset+1]['bboxPixels'][1]-round(8*scale_y)) if offset+1<len(current) else round(image.height*.94)
            if y1 <= y0:
                rejected.append({**anchor,'reason':'nonpositive_question_crop'});continue
            number = anchor['number']
            identifier = f'ORIG-{document["sha256"][:12]}-P{index+1:03}-Q{number:02}'
            issues = ['original_answer_key_not_supplied','ocr_mathematics_and_layout_need_review']
            if identifier in used_ids:
                identifier += '-C' + str(column+1)
                issues.append('duplicate_printed_question_number_on_page')
            used_ids.add(identifier)
            asset = directory / (identifier + '.png')
            image.crop((x0,y0,x1,y1)).save(asset)
            text = lines_in_box(words,(x0,y0,x1,y1))
            opts = observed_options(text)
            if len(opts)!=5:
                issues.append('five_option_markers_not_fully_recognised')
            source_parts = document['member'].split('/')
            question = {'id':identifier,'origin':'ORIJINAL','pool':'original_private',
                'source':{'sha256':document['sha256'],'sourceDocumentId':source_id,
                    'relativePath':document['archive']+'/'+document['member'],'physicalPage':index+1,
                    'questionNumber':number,'column':column+1,'cropBoxPdfPoints':[round(x0/scale_x,3),round(y0/scale_y,3),round(x1/scale_x,3),round(y1/scale_y,3)],
                    'numberRecognitionConfidence':anchor['numberConfidence'],'printedPage':None},
                'promptText':text,'optionTexts':opts,
                'sourceAssets':{'cropPath':str(asset),'pageImagePath':str(page_image),'cropSha256':digest(asset.read_bytes()),
                                'sourceImagePreserved':True,'sourceColoursAndDiagramsUnmodified':True},
                'extractionStatus':'source_question_image_extracted_ocr_unverified',
                'fiveOptionMarkersRecognised':len(opts)==5,
                'answer':{'value':None,'status':'unknown_not_inferred'},
                'verification':{'status':'pending_review','mathPassed':False,'reasons':issues,'editorialStatus':'pending'},
                'classification':{'examDirectoryLabel':source_parts[0],'examType':None,
                    'topic':source_parts[1] if len(source_parts)>1 else None,'subtopic':source_parts[2] if len(source_parts)>2 else None,
                    'status':'directory_label_candidate_not_question_level_audit'},
                'permission':{'status':'unverified','publishable':False}}
            questions.append(question)
    result = {'extractorVersion':VERSION,'sourceSha256':document['sha256'],'sourceDocumentId':source_id,
        'physicalPage':index+1,'relativePath':document['archive']+'/'+document['member'],
        'pageAssets':{'sourceImage':str(page_image),'nativeXmlText':native_text},
        'status':'question_images_extracted_review_required' if questions else 'no_reliable_question_anchor_visual_review_required',
        'questions':questions,'rejectedAnchorCandidates':rejected,
        'coverage':{'pageOpened':True,'nativeTextCharacters':len(native_text),'printedNumberAnchors':len(anchors),
                    'questionImageCount':len(questions),'fiveOptionMarkerQuestionCount':sum(q['fiveOptionMarkersRecognised'] for q in questions)}}
    write_json(result_path,result)
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',default='/workspace/pdf-access-check-20261113/files.json')
    parser.add_argument('--output',default='/workspace/pdf-access-check-20261113/bulk/geometry')
    parser.add_argument('--tessdata',default='/workspace/pdf-access-check-20261113/ocr/tessdata')
    parser.add_argument('--languages',default='tur+eng')
    parser.add_argument('--workers',type=int,default=2)
    parser.add_argument('--scale',type=float,default=2.2)
    parser.add_argument('--limit-pages',type=int)
    parser.add_argument('--force',action='store_true')
    parser.add_argument('--self-test',action='store_true')
    args = parser.parse_args()
    if args.self_test:
        assert len(observed_options('A) 1 B) 2 C) 3 D) 4 E) 5'))==5
        assert len(observed_options('A) 1 B) 2'))==2
        try:private_output(ROOT/'data')
        except ValueError:pass
        else:raise AssertionError('Public original output accepted')
        print('Private geometry self-test passed: missing options remain missing; public destination blocked.');return
    import fitz
    args.output = str(private_output(args.output))
    supplied = json.loads(Path(args.manifest).read_text())
    documents = [row for row in supplied if row.get('type')=='.pdf' and 'Orijinal_TYT_AYT_Geometri_' in row.get('member','')]
    tasks = []
    docs = []
    for document in documents:
        if digest(Path(document['path']).read_bytes()) != document['sha256']:
            raise ValueError('Original PDF hash changed')
        with fitz.open(document['path']) as pdf:
            count = len(pdf)
        docs.append({'sourceDocumentId':'pdf-'+document['sha256'][:16],'sha256':document['sha256'],
                     'relativePath':document['archive']+'/'+document['member'],'pageCount':count})
        for index in range(count):
            tasks.append((document,index,vars(args)))
    if args.limit_pages:
        tasks=tasks[:args.limit_pages]
    results=[]
    with ProcessPoolExecutor(max_workers=max(1,min(2,args.workers))) as pool:
        futures={pool.submit(extract_page,task):(task[0],task[1]) for task in tasks}
        for number,future in enumerate(as_completed(futures),1):
            try:
                results.append(future.result())
            except Exception as error:
                document,index=futures[future]
                results.append({'sourceSha256':document['sha256'],'physicalPage':index+1,'relativePath':document['archive']+'/'+document['member'],
                    'status':'failed_requires_review','questions':[],'error':str(error)})
            if number%10==0 or number==len(futures):
                print(f'Geometry pages checkpoint {number}/{len(futures)}; question images {sum(len(r["questions"]) for r in results)}',flush=True)
                write_json(Path(args.output)/'progress.json',{'extractorVersion':VERSION,'plannedPages':len(tasks),'completedPages':len(results),
                    'questionImages':sum(len(r['questions']) for r in results),'state':'running' if number<len(futures) else 'complete'})
    results.sort(key=lambda r:(r['relativePath'],r['physicalPage']))
    questions=[q for page in results for q in page['questions']]
    summary={'documents':len(docs),'sourcePages':sum(d['pageCount'] for d in docs),'pagesProcessed':len(results),
        'questionImagesExtracted':len(questions),'fiveOptionMarkersRecognised':sum(q['fiveOptionMarkersRecognised'] for q in questions),
        'pagesWithoutReliableAnchor':sum(r['status']=='no_reliable_question_anchor_visual_review_required' for r in results),
        'pageFailures':sum(r['status']=='failed_requires_review' for r in results),'mathematicallyVerified':0,'answersKnown':0,
        'note':'Extracted question images preserve original source content. OCR text, layout, question number and five-option recognition require review; no answer or mathematical verification was invented.'}
    write_json(Path(args.output)/'geometry-questions.json',{'schemaVersion':1,'summary':summary,'documents':docs,'pages':results,'questions':questions})
    print(json.dumps(summary,ensure_ascii=False),flush=True)

if __name__=='__main__':
    main()
