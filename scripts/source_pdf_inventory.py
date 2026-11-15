#!/usr/bin/env python3
"""Inventory supplied PDF bytes without publishing their copyrighted content.

The extractor's manifest and PDF metadata are evidence, never instructions or a
reuse grant. All page text and PDF metadata remain in an explicitly private
report. The public output is constructed with a fixed metadata-only allowlist.
Real inventory runs need PyMuPDF; the security self-test uses the standard library.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_TITLES = {
    'MEB_Dort_Dortluk': 'MEB Dört Dörtlük Matematik',
    'OFB_Ozel_Fen_Bilimleri': 'Özel Fen Bilimleri Matematik',
    'Orijinal_TYT_12_Deneme': 'Orijinal TYT Matematik 12 Deneme',
    'Orijinal_TYT_AYT_Geometri': 'Orijinal TYT/AYT Geometri',
    'Orijinal_TYT_Matematik': 'Orijinal TYT Matematik',
    'Paraf_Adim_Adim_TYT': 'Paraf Adım Adım TYT Matematik',
    'Ozdebir_GIS_2024_Ornek': 'Özdebir GİS 2024 örnek sayfaları',
    'Hiz_ve_Renk_Ornek': 'Hız ve Renk örnek sayfaları',
}
REQUESTED_V2_NAMES = [
    'UcgenAkademi_TYT_Matematik_416sayfa.pdf',
    'UcDortBes_TYT_Matematik_416sayfa.pdf',
    'ULTI_TYT_Matematik_54sayfa.pdf',
    'Tudem_TYT_Matematik_Ornek_16sayfa.pdf',
    'Ozdebir_GIS_TYT_Ornek_12sayfa.pdf',
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def safe_member(value):
    if not isinstance(value, str) or not value or '\x00' in value:
        raise ValueError('Invalid archive member')
    member = PurePosixPath(value.replace('\\', '/'))
    if member.is_absolute() or '..' in member.parts or ':' in member.parts[0]:
        raise ValueError('Unsafe archive member')
    return member


def supplied_path(row, base):
    if not re.fullmatch(r'\d{2}_[A-Z_]+', row.get('archive', '')):
        raise ValueError('Invalid archive label')
    member = safe_member(row['member'])
    expected = base / row['archive'] / Path(*member.parts)
    actual = Path(row['path'])
    if actual.is_symlink() or not actual.resolve().is_relative_to(base.resolve()):
        raise ValueError('Manifest path escapes the private extraction directory')
    if actual.resolve() != expected.resolve():
        raise ValueError('Manifest path does not match its archive member')
    return actual


def private_output(path):
    resolved = Path(path).resolve()
    if resolved.is_relative_to(ROOT) and resolved.relative_to(ROOT).parts[0] not in ('private', 'work'):
        raise ValueError('Private report must be outside the repository or in ignored private/work')
    return resolved


def public_document(private):
    """Never spread a private dictionary into public JSON."""
    return {
        'id': 'pdf-' + private['sha256'][:16],
        'archive': private['archive'], 'member': private['member'],
        'fileName': private['fileName'], 'sha256': private['sha256'],
        'bytes': private['bytes'], 'pageCount': private['pageCount'],
        'textLayerPages': private['textLayerPages'],
        'sparseTextPages': private['sparseTextPages'],
        'sourceId': private['sourceId'],
        'title': SOURCE_TITLES.get(private['sourceId'], private['sourceId']),
        'categoryDirectoryLabel': private['categoryDirectoryLabel'],
        'topicDirectoryLabel': private['topicDirectoryLabel'],
        'subtopicDirectoryLabel': private['subtopicDirectoryLabel'],
        'classificationStatus': 'directory_labels_only_not_question_audit',
        'sourcePageRange': private['sourcePageRange'],
        'declaredQuestionCount': private['declaredQuestionCount'],
        'questionCountStatus': 'not_individually_counted',
        'verifiedOriginalQuestionCount': 0,
        'archiveMemberHashMatched': True,
        'rights': {
            'status': 'unverified', 'allowsPublicInline': False,
            'basis': 'No verified rights-holder reuse grant is supplied by this inventory.',
            'evidenceScope': 'Supplied part metadata, PDF metadata and available page text; not a legal determination.',
        },
    }


def source_reference(member, metadata, page_count):
    filename = PurePosixPath(member).name
    by_name = re.fullmatch(r'(.+)_PDF_(\d+)-(\d+)\.pdf', filename, re.I)
    by_subject = re.search(r'Kaynak:\s*([A-Za-z0-9_]+),\s*orijinal PDF sayfa (\d+)-(\d+)', metadata.get('subject', ''))
    exam = re.fullmatch(r'Orijinal_TYT_Deneme_(\d+)_40_Soru\.pdf', filename)
    source = by_name[1] if by_name else 'Orijinal_TYT_12_Deneme' if exam else None
    if not source or source not in SOURCE_TITLES:
        raise ValueError('Unknown source prefix: ' + filename)
    if by_subject and by_subject[1] != source:
        raise ValueError('Conflicting filename and embedded source reference')
    reference = by_name or by_subject
    if not reference:
        return source, None, 40 if exam else None
    first, last = int(reference[2]), int(reference[3])
    if by_name and by_subject and (first, last) != (int(by_subject[2]), int(by_subject[3])):
        raise ValueError('Conflicting source page ranges')
    if first < 1 or last < first or last - first + 1 != page_count:
        raise ValueError('Source reference length disagrees with actual PDF pages')
    return source, {'from': first, 'to': last, 'basis': 'provided_reference_length_checked',
                    'fullOriginalBookCrosschecked': False}, 40 if exam else None


def collect(manifest_path):
    import fitz
    manifest_path = Path(manifest_path).resolve()
    base = manifest_path.parent / 'extracted'
    entries = load(manifest_path)
    archives = load(manifest_path.parent / 'archives.json')
    archive_by_label = {row['label']: row for row in archives}
    if len(archive_by_label) != len(archives):
        raise ValueError('Repeated archive labels')
    docs = []
    for row in entries:
        member = safe_member(row['member'])
        if member.suffix.lower() != '.pdf':
            continue
        path = supplied_path(row, base)
        raw = path.read_bytes()
        digest = sha256(raw)
        if digest != row.get('sha256') or len(raw) != row.get('bytes'):
            raise ValueError('PDF bytes changed since extraction: ' + row['member'])
        archive = archive_by_label[row['archive']]
        with zipfile.ZipFile(archive['path']) as zipped:
            info = zipped.getinfo(row['member'])
            if info.flag_bits & 1 or stat.S_ISLNK(info.external_attr >> 16):
                raise ValueError('Encrypted or symlink archive entry')
            if sha256(zipped.read(info)) != digest:
                raise ValueError('Extracted PDF differs from supplied ZIP member')
        with fitz.open(stream=raw, filetype='pdf') as document:
            if document.needs_pass or len(document) == 0:
                raise ValueError('Unreadable/password-protected PDF')
            texts = [page.get_text() for page in document]
            metadata = document.metadata or {}
            source_id, source_range, declared = source_reference(row['member'], metadata, len(document))
            sparse = sum(len(''.join(text.split())) <= 30 for text in texts)
            # Original page content is intentionally private, including copyright
            # notices: finding a notice never creates a licence to redistribute.
            rights_hits = [
                {'physicalPdfPage': i + 1, 'text': text[:12000]}
                for i, text in enumerate(texts)
                if re.search(r'telif|copyright|hakları|haklari|creative commons|CC[- ]BY|lisans|lisanslı|izinsiz|çoğaltılamaz', text, re.I)
            ]
            parts = member.parts
            docs.append({
                'archive': row['archive'], 'member': row['member'],
                'fileName': member.name, 'path': str(path), 'sha256': digest, 'bytes': len(raw),
                'pageCount': len(document), 'textLayerPages': len(document) - sparse,
                'sparseTextPages': sparse, 'sourceId': source_id,
                'categoryDirectoryLabel': parts[0],
                'topicDirectoryLabel': parts[1] if len(parts) > 2 else None,
                'subtopicDirectoryLabel': parts[2] if len(parts) > 3 else None,
                'sourcePageRange': source_range, 'declaredQuestionCount': declared,
                'pdfMetadata': metadata, 'rightsTextEvidence': rights_hits,
                'firstPageText': texts[0], 'allPageText': texts,
                'pdfPermissionsAreNotReuseRights': document.permissions,
            })
    if len({d['archive'] + '/' + d['member'] for d in docs}) != len(docs):
        raise ValueError('Repeated archive/member records')
    public_docs = [public_document(row) for row in docs]
    public_archives = []
    part_numbers = []
    total_parts = set()
    for archive in sorted(archives, key=lambda row: row['label']):
        part_index = load(base / archive['label'] / 'PART_INDEX.json')
        part_numbers.append(part_index['part_number']);total_parts.add(part_index['total_parts'])
        selected = [row for row in docs if row['archive'] == archive['label']]
        declared_entries = {entry['path']: entry for entry in part_index['entries']}
        if set(declared_entries) != {row['member'] for row in selected}:
            raise ValueError('Part index PDF coverage does not match actual supplied PDFs')
        public_archives.append({
            'id': archive['label'], 'fileName': Path(archive['path']).name,
            'sha256': sha256(Path(archive['path']).read_bytes()),
            'bytes': Path(archive['path']).stat().st_size,
            'partNumber': part_index['part_number'], 'declaredTotalParts': part_index['total_parts'],
            'pdfCount': len(selected), 'pageCount': sum(row['pageCount'] for row in selected),
            'partIndexEntriesMatched': True,
        })
    if len(total_parts) != 1 or len(set(part_numbers)) != len(part_numbers):
        raise ValueError('Inconsistent/repeated package part metadata')
    exact_groups = defaultdict(list)
    reference_pages = defaultdict(list)
    for row in public_docs:
        exact_groups[row['sha256']].append(row['id'])
        reference = row['sourcePageRange']
        if reference:
            for page in range(reference['from'], reference['to'] + 1):
                reference_pages[row['sourceId'], page].append(row['id'])
    overlaps = [{'sourceId': source, 'sourcePdfPage': page, 'documentIds': ids}
                for (source, page), ids in sorted(reference_pages.items()) if len(ids) > 1]
    sources = [{'id': source, 'title': SOURCE_TITLES[source],
                'pdfCount': sum(row['sourceId'] == source for row in public_docs),
                'pageCount': sum(row['pageCount'] for row in public_docs if row['sourceId'] == source),
                'rightsStatus': 'unverified', 'allowsPublicInline': False}
               for source in sorted({row['sourceId'] for row in public_docs})]
    public = {
        'schemaVersion': 1, 'kind': 'original_pdf_metadata_inventory_not_question_bank',
        'scope': 'Actual supplied PDF bytes opened; directory labels are not question-level classification.',
        'summary': {
            'archiveCount': len(public_archives), 'pdfCount': len(public_docs),
            'sourceCount': len(sources), 'pageCount': sum(row['pageCount'] for row in public_docs),
            'textLayerPages': sum(row['textLayerPages'] for row in public_docs),
            'sparseTextPages': sum(row['sparseTextPages'] for row in public_docs),
            'categoryDirectoryCounts': dict(sorted(Counter(row['categoryDirectoryLabel'] for row in public_docs).items())),
            'rightsVerifiedDocuments': 0, 'publicOriginalQuestionCount': 0,
            'exactDuplicatePdfGroups': sum(len(ids) > 1 for ids in exact_groups.values()),
            'overlappingProvidedSourcePageReferences': len(overlaps),
        },
        'missingArchiveParts': sorted(set(range(1, next(iter(total_parts)) + 1)) - set(part_numbers)),
        'requestedV2FilesNotSuppliedByExactName': [name for name in REQUESTED_V2_NAMES if name not in {row['fileName'] for row in docs}],
        'missingFileCaveat': 'Other excerpts from the same publisher do not establish access to the separately requested v2 files.',
        'rightsReview': {
            'status': 'unverified', 'publicOriginalContentAllowed': False,
            'reason': 'No rights-holder reuse grant has been verified from the supplied material.',
            'notALegalDetermination': True,
            'pdfPermissionFlagsAreNotCopyrightLicenses': True,
            'imageOnlyCopyrightNoticesNotAllManuallyReviewed': True,
        },
        'archives': public_archives, 'sources': sources, 'documents': public_docs,
        'duplicatePdfGroups': [{'sha256': digest, 'documentIds': ids} for digest, ids in sorted(exact_groups.items()) if len(ids) > 1],
        'overlappingProvidedSourcePageReferences': overlaps,
    }
    private = {'schemaVersion': 1, 'pymupdfVersion': fitz.VersionBind,
               'inputManifestSha256': sha256(manifest_path.read_bytes()),
               'documents': docs, 'publicInventory': public}
    return public, private


def self_test():
    for bad in ['../question.pdf', '/etc/passwd', 'C:\\secret.pdf', 'a/../../b.pdf', '', '\x00.pdf']:
        try:safe_member(bad)
        except ValueError:pass
        else:raise AssertionError('Unsafe member accepted: ' + bad)
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp) / 'extracted';base.mkdir()
        row = {'archive':'09_TYT','member':'TYT/test.pdf','path':str(Path(temp) / 'outside.pdf')}
        try:supplied_path(row, base)
        except ValueError:pass
        else:raise AssertionError('Escaping extracted path accepted')
    private = {'archive':'09_TYT','member':'TYT/test.pdf','fileName':'test.pdf','sha256':'a'*64,
               'bytes':100,'pageCount':1,'textLayerPages':1,'sparseTextPages':0,
               'sourceId':'MEB_Dort_Dortluk','categoryDirectoryLabel':'TYT',
               'topicDirectoryLabel':'numbers','subtopicDirectoryLabel':'arithmetic',
               'sourcePageRange':None,'declaredQuestionCount':None,
               'firstPageText':'COPYRIGHT_BODY_SENTINEL','allPageText':['COPYRIGHT_BODY_SENTINEL'],
               'pdfMetadata':{'title':'COPYRIGHT_BODY_SENTINEL'},'path':'/private/path/COPYRIGHT_BODY_SENTINEL.pdf'}
    public = public_document(private)
    assert 'COPYRIGHT_BODY_SENTINEL' not in json.dumps(public)
    assert not public['rights']['allowsPublicInline'] and public['verifiedOriginalQuestionCount'] == 0
    try:source_reference('MEB_Dort_Dortluk_PDF_275-288.pdf', {}, 13)
    except ValueError:pass
    else:raise AssertionError('Reference length mismatch accepted')
    _, reference, _ = source_reference('MEB_Dort_Dortluk_PDF_275-288.pdf', {}, 14)
    assert reference['from'] == 275 and reference['fullOriginalBookCrosschecked'] is False
    print('Source inventory self-test: unsafe paths, redaction and stale page ranges fail closed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest')
    parser.add_argument('--out', default='data/source-pdf-inventory.json')
    parser.add_argument('--private-out')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        if not args.manifest:return
    if not args.manifest or not args.private_out:
        parser.error('--manifest and --private-out are required for an actual byte inventory')
    target_private = private_output(args.private_out)
    public, private = collect(args.manifest)
    target_public = Path(args.out)
    target_public.parent.mkdir(parents=True, exist_ok=True)
    target_private.parent.mkdir(parents=True, exist_ok=True)
    target_public.write_text(json.dumps(public, ensure_ascii=False, indent=2) + '\n')
    target_private.write_text(json.dumps(private, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(public['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
