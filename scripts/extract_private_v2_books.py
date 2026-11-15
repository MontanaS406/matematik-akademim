#!/usr/bin/env python3
"""Checkpoint private question-region candidates from supplied publisher PDFs.

Native coloured labels are layout evidence, not proof of mathematical accuracy.
Raster pages receive one full-page OCR pass. Unchanged crops plus the actual
source PDF preserve figures, fonts and options; uncertain text stays pending.
This script never publishes original publisher content or invents answers.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'v2-native-colour-raster-tsv-1'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def write_text(path, value):
    path = Path(path)
    temp = path.with_suffix(path.suffix+'.tmp')
    temp.write_text(value)
    temp.replace(path)


def private_output(path):
    path = Path(path).resolve()
    if (path == ROOT or ROOT in path.parents) and not (path == ROOT / 'private' or ROOT / 'private' in path.parents):
        raise ValueError('Original publisher crops/text must remain outside the public repository or in ignored private/')
    return path


def profile(document):
    name = document.get('archive', '') + document.get('member', '')
    if 'UCGEN' in name or 'UcgenAkademi' in name:
        return 'ucgen_native_magenta'
    if '_345' in name or 'UcDortBes' in name:
        return '345_raster_cyan'
    if 'ULTI' in name:
        return 'ulti_raster_magenta'
    if 'TUDEM' in name:
        return 'tudem_native'
    if 'OZDEBIR' in name:
        return 'ozdebir_native'
    return 'unknown_review'


def observed_options(text, status):
    matches = list(re.finditer(r'(?<!\w)([ABCDE])\s*[)\]]\s*', text))
    seen = {}
    duplicates = []
    for i, match in enumerate(matches):
        letter = match[1]
        if letter in seen:
            duplicates.append(letter)
            continue
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        seen[letter] = text[match.end():end].strip()
    return ([{'id':letter, 'text':seen[letter], 'status':status} for letter in 'ABCDE' if letter in seen], duplicates)


def native_anchors(page, kind):
    width, height = page.rect.width, page.rect.height
    found = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                text = span['text'].strip()
                match = re.match(r'^(\d{1,2})\.(?:\s|$)', text)
                if not match or not 1 <= int(match[1]) <= 80:
                    continue
                x0,y0,x1,y1 = span['bbox']
                column = native_label_column(x0, width, kind)
                if column is None or not .065*height <= y0 <= .93*height:
                    continue
                red, green, blue = ((span['color'] >> shift) & 255 for shift in (16,8,0))
                if kind == 'ucgen_native_magenta' and not (red > 150 and blue > 60 and green < red*.7):
                    continue
                # A label may share a native span with its sentence. Its left
                # edge/baseline remain usable; the entire sentence is not a box.
                found.append({'column':column, 'questionNumber':int(match[1]),
                              'bboxPdf':[x0,y0,min(x1,x0+25),y1],
                              'anchorMethod':'native_printed_number',
                              'numberText':match[0].strip(), 'confidence':None})
    output = []
    for item in sorted(found, key=lambda a:(a['column'],a['bboxPdf'][1])):
        if output and item['column']==output[-1]['column'] and abs(item['bboxPdf'][1]-output[-1]['bboxPdf'][1])<3:
            continue
        output.append(item)
    return output


def native_label_column(x, width, kind):
    # In this book the real outer labels have fixed column positions. A wider
    # lane wrongly treats the numbered miniature exercises inside a phone
    # illustration as separate questions. Preserve that illustration whole.
    lanes = ((.055,.09),(.49,.535)) if kind == 'ucgen_native_magenta' else ((.035,.145),(.49,.65))
    return next((column for column,(left,right) in enumerate(lanes) if left*width <= x <= right*width),None)


def parse_tsv(text):
    words = []
    for row in csv.DictReader(io.StringIO(text), delimiter='\t'):
        if not row.get('text', '').strip():
            continue
        words.append({'text':row['text'], 'x':int(row['left']), 'y':int(row['top']),
                      'w':int(row['width']), 'h':int(row['height']), 'confidence':float(row['conf']),
                      'line':(row['block_num'],row['par_num'],row['line_num'])})
    return words


def identify_ocr_configuration(args):
    import fitz
    models = {}
    for language in args.languages.split('+'):
        path = args.tessdata / (language+'.traineddata')
        models[language] = sha256(path.read_bytes())
    result = subprocess.run(['tesseract','--version'],capture_output=True,text=True,check=True)
    return {'cacheVersion':1,'dpi':args.dpi,'maxWidth':args.max_width,'languages':args.languages,
            'tessdataDirectory':str(args.tessdata.resolve()),'modelSha256':models,
            'tesseractVersion':result.stdout.splitlines()[0],'rendererVersion':fitz.VersionBind,'psm':3}


def ocr_page_key(document, index, configuration):
    return {'sourceSha256':document['sha256'],'physicalPage':index+1,'configuration':configuration}


def read_cached_tsv(tsv_path, metadata_path, key):
    try:
        raw = tsv_path.read_text()
        metadata = json.loads(metadata_path.read_text())
        if not isinstance(metadata,dict):
            return None
        if metadata.get('key')!=key or metadata.get('tsvSha256')!=sha256(raw.encode()) or not raw.startswith('level\tpage_num\t'):
            return None
        return parse_tsv(raw)
    except (OSError,ValueError,KeyError,TypeError):
        return None


def ocr_once(image_path, directory, args, key):
    tsv_path = directory / 'body-ocr.tsv'
    metadata_path = directory / 'body-ocr.meta.json'
    if not args.force:
        cached = read_cached_tsv(tsv_path,metadata_path,key)
        if cached is not None:
            return cached
    command = ['tesseract',str(image_path),'stdout','--psm','3','-l',args.languages]
    if args.tessdata:
        command += ['--tessdata-dir',str(args.tessdata)]
    command += ['-c','tessedit_create_tsv=1']
    result = subprocess.run(command,text=True,capture_output=True,timeout=args.ocr_timeout,
                            env={**os.environ,'OMP_THREAD_LIMIT':'1'})
    if result.returncode or not result.stdout.startswith('level\tpage_num\t'):
        raise RuntimeError('TSV OCR failed: '+result.stderr[-400:])
    write_text(tsv_path,result.stdout)
    write_json(metadata_path,{'key':key,'tsvSha256':sha256(result.stdout.encode())})
    return parse_tsv(result.stdout)


def cached_assets_valid(cached):
    if not isinstance(cached.get('questions'),list) or not isinstance(cached.get('errors'),list):
        return False
    if cached.get('errors'):
        return False
    try:
        for question in cached.get('questions',[]):
            assets = question['sourceAssets']
            crop = Path(assets['cropPath'])
            if not crop.exists() or sha256(crop.read_bytes())!=assets['cropSha256']:
                return False
            context = assets.get('sharedColumnContext')
            if context:
                context_path=Path(context['cropPath'])
                if not context_path.is_file() or sha256(context_path.read_bytes())!=context.get('cropSha256'):
                    return False
    except (OSError,KeyError,TypeError):
        return False
    return True


def read_checkpoint(path):
    try:
        value=json.loads(path.read_text())
        return value if isinstance(value,dict) else {}
    except (OSError,ValueError):
        return {}


def raster_anchors(image, words, kind, scale_x, scale_y):
    import numpy as np
    px = np.asarray(image.convert('RGB'))
    height, width = px.shape[:2]
    red,green,blue = [px[:,:,i].astype('float32') for i in range(3)]
    if kind == '345_raster_cyan':
        mask = (blue > 120) & (green > 105) & (blue > red*1.3) & (green > red*1.3) & (blue-green < 105)
        # Only the numbered-label lanes, not nearby blue graph/grid labels.
        lanes = ((0,.075,.108),(1,.505,.54))
    else:
        mask = (red > 155) & (blue > 85) & (red > green*1.2) & (blue > green*1.15)
        # This book mirrors its decorated outer margin on alternating pages.
        # Its actual question labels therefore have two possible x positions
        # in each logical column (not four logical question columns).
        lanes = ((0,.055,.12),(1,.49,.57)) if kind=='ucgen_native_magenta' else ((0,.055,.087),(0,.095,.13),(1,.49,.527),(1,.532,.574))
    anchors = []
    for column,left,right in lanes:
        x0,x1 = round(width*left),round(width*right)
        rows = np.flatnonzero(mask[:,x0:x1].sum(1)>=2)
        groups = []
        for y in rows:
            if not groups or y-groups[-1][-1]>3:
                groups.append([int(y)])
            else:
                groups[-1].append(int(y))
        for group in groups:
            y0,y1 = group[0],group[-1]+1
            minimum_y=.09 if kind=='ucgen_native_magenta' else .065
            if not minimum_y*height <= y0 < y1 <= .925*height or not 5 <= y1-y0 <= height*.026:
                continue
            xs = np.flatnonzero(mask[y0:y1,x0:x1].any(0))
            bx0,bx1 = x0+int(xs[0]),x0+int(xs[-1])+1
            if not 2 <= bx1-bx0 <= width*.035 or not .16 <= (bx1-bx0)/(y1-y0) <= 3.8:
                continue
            # Read the existing full-page TSV near the actual coloured label.
            # No second OCR pass, guessed sequential label, or inferred answer.
            candidates = []
            for word in words:
                if abs((word['y']+word['h']/2)-(y0+y1)/2) > max(9,(y1-y0)*1.2):
                    continue
                if not bx0-12 <= word['x'] <= bx1+12:
                    continue
                match = re.match(r'^(\d{1,2})(?:\.|$|\s)',word['text'])
                if match and 1 <= int(match[1]) <= 80:
                    candidates.append((abs(word['x']-bx0),-word['confidence'],int(match[1]),word))
            selected = min(candidates) if candidates else None
            anchors.append({'column':column,'questionNumber':selected[2] if selected else None,
                            'bboxPdf':[bx0/scale_x,y0/scale_y,bx1/scale_x,y1/scale_y],
                            'anchorMethod':'coloured_label_and_full_page_tsv' if selected else 'coloured_label_number_unreadable',
                            'numberText':selected[3]['text'] if selected else None,
                            'confidence':selected[3]['confidence'] if selected else None})
    if not anchors and kind=='345_raster_cyan':
        # A few actual publisher pages print black question numbers. Restrict
        # fallback to observed dotted labels in the same narrow outer lanes,
        # on a page whose existing OCR actually contains choice markers.
        option_ids={option['id'] for option in observed_options(' '.join(w['text'] for w in words),'ocr_unverified')[0]}
        if len(option_ids)>=4:
            for word in words:
                match=re.fullmatch(r'(\d{1,2})\.',word['text'])
                if not match or not 1<=int(match[1])<=80 or word['confidence']<20:
                    continue
                column=0 if .075*width<=word['x']<=.108*width else 1 if .505*width<=word['x']<=.54*width else None
                if column is None or not .065*height<=word['y']<=.925*height:
                    continue
                anchors.append({'column':column,'questionNumber':int(match[1]),
                    'bboxPdf':[word['x']/scale_x,word['y']/scale_y,(word['x']+word['w'])/scale_x,(word['y']+word['h'])/scale_y],
                    'anchorMethod':'full_page_tsv_observed_dotted_black_number_fallback',
                    'numberText':word['text'],'confidence':word['confidence']})
    return sorted(anchors,key=lambda a:(a['column'],a['bboxPdf'][1]))


def words_in_box(words, box):
    x0,y0,x1,y1 = box
    lines = defaultdict(list)
    for word in words:
        if x0 <= word['x']+word['w']/2 <= x1 and y0 <= word['y']+word['h']/2 <= y1:
            lines[word['line']].append(word)
    ordered = sorted(lines.values(),key=lambda row:(min(w['y'] for w in row),min(w['x'] for w in row)))
    return '\n'.join(' '.join(w['text'] for w in sorted(row,key=lambda w:w['x'])) for row in ordered)


def crop_box(width, height, column, top, following=None):
    # Slightly overlap the gutter so native/diagram strokes are never redrawn.
    left,right = (.035,.499) if column == 0 else (.495,.985)
    return [width*left, max(height*.045,top-7), width*right,
            min(height*.945,following-7) if following is not None else height*.945]


def extract_page(document, index, args):
    import fitz
    from PIL import Image
    kind = profile(document)
    directory = args.output / 'pages' / ('pdf-'+document['sha256'][:16]) / f'p{index+1:04}'
    directory.mkdir(parents=True,exist_ok=True)
    checkpoint = directory / 'result.json'
    config = {'version':VERSION,'dpi':args.dpi,'maxWidth':args.max_width,'profile':kind}
    if kind == 'ucgen_native_magenta':
        config['nativeAnchorLaneVersion'] = 3
    if kind == '345_raster_cyan':
        config['rasterAnchorLaneVersion'] = 3
    if kind == 'ulti_raster_magenta':
        config['rasterAnchorLaneVersion'] = 2
    if kind not in ('tudem_native','ozdebir_native'):
        config['ocrConfiguration'] = args.ocr_configuration
    if checkpoint.exists() and not args.force:
        cached = read_checkpoint(checkpoint)
        if not all(key in cached for key in ('sourceSha256','configuration','profile','physicalPage','questionRegionCandidates','questions','errors')):
            cached={}
        if cached.get('sourceSha256')==document['sha256']:
            previous_config = dict(cached.get('configuration',{}))
            if kind=='ucgen_native_magenta' and cached.get('nativeTextChars',0)>=120:
                expected_previous={k:v for k,v in config.items() if k!='ocrConfiguration'}
                expected_previous['nativeAnchorLaneVersion']=2
                if previous_config==expected_previous:
                    cached['configuration']=config
                    cached['checkpointUpgrade']='new_raster_fallback_does_not_apply_to_existing_native_text_pages'
                    write_json(checkpoint,cached)
            if kind=='345_raster_cyan' and previous_config.get('rasterAnchorLaneVersion')==2 and {**previous_config,'rasterAnchorLaneVersion':3}==config and cached.get('questionRegionCandidates',0)>0:
                cached['configuration']=config
                cached['checkpointUpgrade']='black_label_fallback_only_applies_to_previously_unsegmented_pages'
                write_json(checkpoint,cached)
            can_upgrade = kind == 'ucgen_native_magenta' and previous_config == {k:v for k,v in config.items() if k!='nativeAnchorLaneVersion'}
            if can_upgrade:
                # Unaffected SHA/version checkpoints can be safely reused.
                # Only pages containing an old out-of-lane anchor need render.
                with fitz.open(document['path']) as source_pdf:
                    source_width = source_pdf[index].rect.width
                try:
                    can_upgrade = all(native_label_column(q['source']['anchor']['bboxPdf'][0],source_width,kind)==q['source']['column']-1 for q in cached['questions'])
                except (KeyError,TypeError,IndexError):
                    can_upgrade = False
                if can_upgrade:
                    cached['configuration']=config
                    cached['checkpointUpgrade']='narrower_native_label_lane_all_existing_anchors_unchanged'
                    write_json(checkpoint,cached)
                else:
                    write_json(directory/'superseded-broad-lane-result.json',cached)
            if cached.get('configuration')!=config:
                cached=None
        else:
            cached=None
        if cached is not None:
            if cached_assets_valid(cached):
                return cached
    started = time.monotonic()
    with fitz.open(document['path']) as pdf:
        page = pdf[index]
        width,height = page.rect.width,page.rect.height
        native_text = page.get_text()
        anchors = native_anchors(page,kind) if len(native_text)>120 else []
        # Lists/front matter have numbered rows, but no five-choice problems.
        options_in_page,_ = observed_options(native_text,'native_unverified')
        if anchors and len(options_in_page)<5:
            anchors = []
        scale = min(args.dpi/72,args.max_width/width)
        pix = page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
        image = Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        scale_x,scale_y = image.width/width,image.height/height
        words=[]; errors=[]; used_ocr=False
        # Native book front matter without questions is not needlessly OCRed.
        native_profile = kind in ('ucgen_native_magenta','tudem_native','ozdebir_native')
        possible_raster_native=False
        if not anchors and kind=='ucgen_native_magenta' and len(native_text)<120:
            pixel_candidates=raster_anchors(image,[],kind,scale_x,scale_y)
            possible_raster_native=2<=len(pixel_candidates)<=20 and {a['column'] for a in pixel_candidates}=={0,1}
        if not anchors and (not native_profile or possible_raster_native):
            used_ocr=True
            try:
                with tempfile.TemporaryDirectory(prefix='ma-v2-ocr-') as temporary:
                    raster_path=Path(temporary)/'page.png'; image.save(raster_path)
                    words=ocr_once(raster_path,directory,args,ocr_page_key(document,index,args.ocr_configuration))
                anchors=raster_anchors(image,words,kind,scale_x,scale_y)
                if possible_raster_native and len(observed_options(' '.join(w['text'] for w in words),'ocr_unverified')[0])<4:
                    anchors=[]
            except Exception as error:
                errors.append({'reason':'full_page_ocr_failed','message':str(error)})
        questions=[]
        for column in (0,1):
            current=sorted([a for a in anchors if a['column']==column],key=lambda a:a['bboxPdf'][1])
            context=None
            if current and current[0]['bboxPdf'][1] > .085*height:
                context_box=[width*(.035 if column==0 else .495),height*.045,
                             width*(.499 if column==0 else .985),current[0]['bboxPdf'][1]-7]
                if context_box[3]>context_box[1]+height*.025:
                    context_path=directory/f'column-{column+1}-context.png'
                    image.crop(tuple(round(v*s) for v,s in zip(context_box,(scale_x,scale_y,scale_x,scale_y)))).save(context_path)
                    context={'cropPath':str(context_path),'cropSha256':sha256(context_path.read_bytes()),'bboxPdfPoints':context_box,
                             'note':'May contain shared conditions for several questions; association requires review.'}
            for offset,anchor in enumerate(current):
                following=current[offset+1]['bboxPdf'][1] if offset+1<len(current) else None
                box=crop_box(width,height,column,anchor['bboxPdf'][1],following)
                if box[3]<=box[1]:
                    errors.append({'reason':'invalid_crop_box','anchor':anchor}); continue
                number=anchor['questionNumber']; label=f'Q{number:02}' if number is not None else 'QUNKNOWN'
                identifier=f'ORIG-{document["sha256"][:12]}-P{index+1:04}-C{column+1}-{label}-R{offset+1:02}'
                crop=directory/(identifier+'.png')
                pixel_box=tuple(round(v*s) for v,s in zip(box,(scale_x,scale_y,scale_x,scale_y)))
                image.crop(pixel_box).save(crop)
                text=words_in_box(words,pixel_box) if used_ocr else page.get_textbox(fitz.Rect(box))
                opts,duplicates=observed_options(text,'ocr_unverified' if used_ocr else 'native_layout_unverified')
                reasons=['source_layout_and_mathematics_not_independently_verified',
                         'publisher_answer_not_associated_with_test_and_question',
                         'question_level_exam_and_topic_classification_pending']
                if number is None: reasons.append('printed_question_number_unreadable')
                if len(opts)!=5: reasons.append('five_option_markers_not_fully_recognised')
                if duplicates: reasons.append('duplicate_option_markers_or_adjacent_content_require_review')
                if context: reasons.append('possible_shared_column_conditions_need_association')
                questions.append({'id':identifier,'origin':'ORIJINAL','pool':'original_private',
                    'source':{'sha256':document['sha256'],'sourceDocumentId':'pdf-'+document['sha256'][:16],
                              'archive':document['archive'],'relativePath':document['member'],'pdfPath':document['path'],
                              'physicalPage':index+1,'questionNumber':number,'column':column+1,
                              'printedPage':None,'cropBoxPdfPoints':box,'anchor':anchor},
                    'promptText':text,'optionTexts':opts,'fiveOptionMarkersRecognised':len(opts)==5,
                    'sourceAssets':{'cropPath':str(crop),'cropSha256':sha256(crop.read_bytes()),
                                    'sourcePdfPath':document['path'],'sourceImagePreserved':True,
                                    'sourceColoursAndDiagramsUnmodified':True,'renderScale':scale,
                                    'effectiveDpi':scale*72,'sharedColumnContext':context},
                    'extractionStatus':'question_region_candidate_text_and_layout_unverified',
                    'answer':{'value':None,'status':'unknown_not_inferred'},
                    'verification':{'status':'pending_review','mathPassed':False,'reasons':reasons,'editorialStatus':'pending'},
                    'classification':{'examType':None,'sourceBookLabel':'TYT' if kind in ('ucgen_native_magenta','345_raster_cyan','tudem_native','ozdebir_native') else None,
                                      'topic':None,'subtopic':None,'status':'question_level_review_pending'},
                    'permission':{'status':'unverified','publishable':False}})
        if args.keep_page_images:
            image.save(directory/'source-page.png')
        result={'sourceSha256':document['sha256'],'configuration':config,'physicalPage':index+1,
                'profile':kind,'nativeTextChars':len(native_text),'usedFullPageOcr':used_ocr,
                'render':{'requestedDpi':args.dpi,'effectiveDpi':scale*72,'widthPixels':image.width,'heightPixels':image.height},
                'anchorCandidates':len(anchors),'recognisedQuestionNumbers':sum(q['source']['questionNumber'] is not None for q in questions),
                'questionRegionCandidates':len(questions),'fiveOptionMarkersRecognised':sum(q['fiveOptionMarkersRecognised'] for q in questions),
                'pageStatus':'candidates_pending_review' if questions else 'unsegmented_page_review_required',
                'errors':errors,'questions':questions,'elapsedSeconds':round(time.monotonic()-started,2)}
        write_json(checkpoint,result)
        return result


def summarize(documents, pages, questions):
    return {'documents':len(documents),'sourcePages':sum(d['pageCount'] for d in documents),
            'pagesProcessed':len(pages),'questionRegionCandidates':len(questions),
            'recognisedQuestionNumbers':sum(q['source']['questionNumber'] is not None for q in questions),
            'fiveOptionMarkersRecognised':sum(q['fiveOptionMarkersRecognised'] for q in questions),
            'pagesWithoutReliableSegmentation':sum(not p['questionRegionCandidates'] for p in pages),
            'pagesWithErrors':sum(bool(p['errors']) for p in pages),'mathematicallyVerified':0,
            'answersAssociatedAndVerified':0,'publishableOriginals':0,
            'byProfile':dict(Counter(p['profile'] for p in pages))}


def self_test():
    assert crop_box(600,800,0,100,300)==[21.000000000000004,93,299.4,293]
    for column in (0,1):
        x0,y0,x1,y1=crop_box(600,800,column,100,400)
        assert 0<=x0<x1<=600 and 0<=y0<y1<=800 and y0<100<y1
    opts,duplicates=observed_options('A) 1 B) 2 D) 4 E) 5','test')
    assert [o['id'] for o in opts]==list('ABDE') and not duplicates
    opts,duplicates=observed_options('A) 1 B) 2 C) 3 D) 4 E) 5 A) x','test')
    assert len(opts)==5 and duplicates==['A']
    try: private_output(ROOT/'data'/'publisher-originals')
    except ValueError: pass
    else: raise AssertionError('Public original output allowed')
    assert private_output('/tmp/matematik-v2-private-selftest').is_absolute()
    assert profile({'archive':'20_345_01.zip'})=='345_raster_cyan'
    assert profile({'archive':'11_UCGEN_01.zip'})=='ucgen_native_magenta'
    assert native_label_column(42.5,638.5,'ucgen_native_magenta')==0
    assert native_label_column(322.4,638.5,'ucgen_native_magenta')==1
    assert native_label_column(90.65,638.5,'ucgen_native_magenta') is None
    with tempfile.TemporaryDirectory(prefix='ma-v2-cache-selftest-') as temporary:
        directory=Path(temporary)
        tsv=directory/'ocr.tsv';metadata=directory/'ocr.meta.json'
        raw='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t4\t5\t6\t7\t90\tlabel\n'
        tsv.write_text(raw);key={'dpi':160,'languages':'tur+eng'}
        write_json(metadata,{'key':key,'tsvSha256':sha256(raw.encode())})
        assert len(read_cached_tsv(tsv,metadata,key))==1
        assert read_cached_tsv(tsv,metadata,{'dpi':180,'languages':'tur+eng'}) is None
        assert read_cached_tsv(tsv,metadata,{'dpi':160,'languages':'eng'}) is None
        write_json(metadata,[]);assert read_cached_tsv(tsv,metadata,key) is None
        write_json(metadata,{'key':key,'tsvSha256':sha256(raw.encode())})
        tsv.write_text(raw.replace('label','changed'))
        assert read_cached_tsv(tsv,metadata,key) is None
        crop=directory/'crop.png';crop.write_bytes(b'original fixture asset')
        context=directory/'context.png';context.write_bytes(b'shared conditions')
        checkpoint={'errors':[],'questions':[{'sourceAssets':{'cropPath':str(crop),'cropSha256':sha256(crop.read_bytes()),'sharedColumnContext':{'cropPath':str(context),'cropSha256':sha256(context.read_bytes())}}}]}
        assert cached_assets_valid(checkpoint)
        context.unlink();assert not cached_assets_valid(checkpoint)
        context.write_bytes(b'corrupted shared conditions');assert not cached_assets_valid(checkpoint)
        context.write_bytes(b'shared conditions');crop.write_bytes(b'corrupted')
        assert not cached_assets_valid(checkpoint)
        assert not cached_assets_valid({'errors':[{'reason':'full_page_ocr_failed'}],'questions':[]})
        assert not cached_assets_valid({'errors':[]})
        bad_json=directory/'invalid-result.json';bad_json.write_text('{invalid')
        assert read_checkpoint(bad_json)=={}
    print('v2 private extractor self-test passed')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',type=Path,default=Path('/workspace/pdf-access-check-20261114-new/files.json'))
    parser.add_argument('--output',type=Path,default=Path('/workspace/pdf-access-check-20261114-new/bulk/v2'))
    parser.add_argument('--profiles',default='all',help='Comma-separated profiles, or all; UCGEN is always processed first.')
    parser.add_argument('--dpi',type=float,default=160)
    parser.add_argument('--max-width',type=int,default=1500)
    parser.add_argument('--tessdata',type=Path,default=Path('/workspace/pdf-access-check-20261113/ocr/tessdata'))
    parser.add_argument('--languages',default='tur+eng')
    parser.add_argument('--ocr-timeout',type=int,default=120)
    parser.add_argument('--limit-pages',type=int)
    parser.add_argument('--force',action='store_true')
    parser.add_argument('--keep-page-images',action='store_true')
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test: self_test(); return
    args.output=private_output(args.output);args.output.mkdir(parents=True,exist_ok=True)
    files=json.loads(args.manifest.read_text());files=files.get('files',[]) if isinstance(files,dict) else files
    documents=[d for d in files if d.get('type')=='.pdf' and re.match(r'^(1[1-9]|2[0-5])_',d.get('archive',''))]
    allowed=set(args.profiles.split(','))
    if args.profiles!='all':documents=[d for d in documents if profile(d) in allowed]
    priority={'ucgen_native_magenta':0,'tudem_native':1,'ozdebir_native':2,'345_raster_cyan':3,'ulti_raster_magenta':4}
    documents.sort(key=lambda d:(priority.get(profile(d),9),d['member']))
    seen=set();unique=[]
    for document in documents:
        if document['sha256'] in seen:continue
        if sha256(Path(document['path']).read_bytes())!=document['sha256']:raise ValueError('Source SHA mismatch: '+document['member'])
        seen.add(document['sha256']);unique.append(document)
    documents=unique
    if any(profile(d) not in ('tudem_native','ozdebir_native') for d in documents):
        args.ocr_configuration=identify_ocr_configuration(args)
    all_pages=[];all_questions=[]
    total=sum(d['pageCount'] for d in documents)
    for document in documents:
        for index in range(document['pageCount']):
            if args.limit_pages and len(all_pages)>=args.limit_pages:break
            try:
                result=extract_page(document,index,args)
            except Exception as error:
                result={'sourceSha256':document['sha256'],'physicalPage':index+1,'profile':profile(document),
                        'questionRegionCandidates':0,'questions':[],'errors':[{'reason':'page_processing_failed','message':str(error)}],
                        'pageStatus':'failed_review_required'}
            all_pages.append({k:v for k,v in result.items() if k!='questions'})
            all_questions.extend(result['questions'])
            summary=summarize(documents,all_pages,all_questions)
            write_json(args.output/'progress.json',{'state':'running','summary':summary,'currentSourceSha256':document['sha256'],'currentPhysicalPage':index+1})
            if len(all_pages)%10==0 or len(all_pages)==total:
                write_json(args.output/'questions.json',{'schemaVersion':1,'extractorVersion':VERSION,'scope':'Private original region candidates; no mathematical verification or publication permission inferred.','summary':summary,'documents':documents,'pages':all_pages,'questions':all_questions})
                print(f'pages={len(all_pages)}/{total} regions={len(all_questions)} recognisedNumbers={summary["recognisedQuestionNumbers"]} fiveOptions={summary["fiveOptionMarkersRecognised"]}',flush=True)
        if args.limit_pages and len(all_pages)>=args.limit_pages:break
    summary=summarize(documents,all_pages,all_questions)
    write_json(args.output/'questions.json',{'schemaVersion':1,'extractorVersion':VERSION,'scope':'Private original region candidates; no mathematical verification or publication permission inferred.','summary':summary,'documents':documents,'pages':all_pages,'questions':all_questions})
    state='complete_with_errors' if summary['pagesWithErrors'] else 'complete'
    write_json(args.output/'progress.json',{'state':state if len(all_pages)==total else 'partial_limit','summary':summary})
    print(json.dumps(summary,ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
