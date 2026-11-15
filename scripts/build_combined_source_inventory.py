#!/usr/bin/env python3
"""Combine actual PDF metadata without publishing private source material.

The 95-document inventory is a frozen historical snapshot. New document bytes
must match both their private manifest and the independently built additions
inventory. Source collections are bookkeeping groups, not distinct publishers,
books or question counts. All original-content reuse rights remain unverified.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tempfile

from source_pdf_inventory import SOURCE_TITLES, source_reference

ROOT = Path(__file__).resolve().parents[1]
VERSION = "combined-source-inventory-v1"
FORBIDDEN_KEYS = {
    "path", "filePath", "pdfPath", "privatePath", "fileId", "body", "text",
    "prompt", "options", "answer", "answers", "solution", "solutionSteps",
    "allPageText", "firstPageText", "pdfMetadata", "rightsTextEvidence",
    "image", "imageData", "imagePath", "cropPath", "pageText",
}
DOCUMENT_FIELDS = (
    "id", "archive", "containerId", "member", "fileName", "sha256", "bytes", "pageCount",
    "textLayerPages", "sparseTextPages", "sourceId", "title",
    "categoryDirectoryLabel", "topicDirectoryLabel", "subtopicDirectoryLabel",
    "classificationStatus", "sourcePageRange", "declaredQuestionCount",
    "questionCountStatus", "verifiedOriginalQuestionCount",
    "archiveMemberHashMatched", "rights",
)
V2_COLLECTIONS = {
    "UcgenAkademi_TYT_Matematik_416sayfa.pdf": "UcgenAkademi_TYT_Matematik_416sayfa",
    "UcDortBes_TYT_Matematik_416sayfa.pdf": "UcDortBes_TYT_Matematik_416sayfa",
    "ULTI_TYT_Matematik_54sayfa.pdf": "ULTI_TYT_Matematik_54sayfa",
    "Tudem_TYT_Matematik_Ornek_16sayfa.pdf": "Tudem_TYT_Matematik_Ornek_16sayfa",
    "Ozdebir_GIS_TYT_Ornek_12sayfa.pdf": "Ozdebir_GIS_TYT_Ornek_12sayfa",
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def load(value):
    return json.loads(Path(value).read_text(encoding="utf-8"))


def relative_label(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Invalid relative source label")
    if re.search(r"[\x00-\x1f\x7f]", value) or value.startswith("/"):
        raise ValueError("Unsafe relative source label")
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts) or ":" in parts[0]:
        raise ValueError("Unsafe relative source label")
    return value


def archive_label(value):
    value = relative_label(value)
    if "/" in value:
        raise ValueError("Archive label must be a basename")
    return value[:-4] if value.lower().endswith(".zip") else value


def container_id(sha):
    if not re.fullmatch(r"[0-9a-f]{64}", sha):
        raise ValueError("Invalid physical input digest")
    return "input-" + sha[:16]


def assert_public_metadata(value):
    if isinstance(value, dict):
        if FORBIDDEN_KEYS.intersection(value):
            raise ValueError("Private content field in public metadata")
        for item in value.values():
            assert_public_metadata(item)
    elif isinstance(value, list):
        for item in value:
            assert_public_metadata(item)
    elif isinstance(value, str) and re.search(
        r"/workspace/|/tmp/|sediment://|data:image/|data:application/pdf|PRIVATE_BODY_SENTINEL", value
    ):
        raise ValueError("Private location or source content in public metadata")


def validate_document(row):
    sha = row.get("sha256", "")
    if not re.fullmatch(r"[0-9a-f]{64}", sha) or row.get("id") != "pdf-" + sha[:16]:
        raise ValueError("Document digest or identity mismatch")
    relative_label(row["member"])
    if archive_label(row["archive"]) != row["archive"]:
        raise ValueError("ZIP extension must be removed from archive label")
    if PurePosixPath(row["member"]).name != row["fileName"]:
        raise ValueError("Member basename disagrees with file name")
    if row["pageCount"] < 1 or row["bytes"] < 1:
        raise ValueError("Invalid actual page or byte count")
    if row["rights"]["status"] != "unverified" or row["rights"]["allowsPublicInline"]:
        raise ValueError("Original source rights must fail closed")
    if row.get("verifiedOriginalQuestionCount") != 0:
        raise ValueError("File availability is not question verification")
    reference = row.get("sourcePageRange")
    if reference and (reference["from"] < 1 or reference["to"] - reference["from"] + 1 != row["pageCount"]):
        raise ValueError("Physical source page range disagrees with opened pages")
    assert_public_metadata(row)


def inspect_private_match(public, private):
    raw = Path(private["path"]).read_bytes()
    if digest(raw) != public["sha256"] or len(raw) != public["bytes"]:
        raise ValueError("Actual private PDF bytes disagree with public inventory")
    for key in ("sha256", "bytes", "pageCount"):
        if private.get(key) != public.get(key):
            raise ValueError("Private/public PDF metadata mismatch: " + key)
    if public.get("status") != "pdf_read" or public.get("pagesRead") != public["pageCount"]:
        raise ValueError("New PDF was not completely read")
    if public.get("renderedPages") != public["pageCount"] or public.get("renderFailures") != 0:
        raise ValueError("New PDF was not completely rendered")
    if public.get("encrypted") or public.get("needsPassword"):
        raise ValueError("Encrypted source must remain pending")


def check_private_locations(files, private_directory):
    expected = (Path(private_directory) / "pdfs").resolve()
    for row in files:
        if row.get("type") != ".pdf":
            continue
        location = Path(row["path"])
        if location.is_symlink() or location.resolve().parent != expected:
            raise ValueError("PDF source is outside private hash-addressed storage")
        if location.name != row["sha256"] + ".pdf":
            raise ValueError("Private filename does not match the actual PDF digest")


def assert_unique_documents(documents):
    digests = [row["sha256"] for row in documents]
    ids = [row["id"] for row in documents]
    references = [(row["archive"], row["member"]) for row in documents]
    if len(set(digests)) != len(digests) or len(set(ids)) != len(ids) or len(set(references)) != len(references):
        raise ValueError("Repeated SHA, document ID or source location")


def coverage_index(audit):
    by_sha = {}
    titles = {}
    for book in audit["books"]:
        collection = V2_COLLECTIONS[book["requestedFileName"]]
        titles[collection] = book["bookTitle"]
        if not book["allExpectedPageRangesAvailable"] or book["actualOpenedPages"] != book["expectedPages"]:
            raise ValueError("Requested book has incomplete physical page coverage")
        segments = book.get("segments")
        if segments:
            coverage = Counter()
            for segment in segments:
                if not all(segment["checks"].values()):
                    raise ValueError("Segment metadata checks did not all pass")
                page_range = segment["physicalSourcePages"]
                if page_range["to"] - page_range["from"] + 1 != segment["actualOpenedPages"]:
                    raise ValueError("Segment coverage length mismatch")
                coverage.update(range(page_range["from"], page_range["to"] + 1))
                if segment["sha256"] in by_sha:
                    raise ValueError("Repeated supplied segment digest in book coverage")
                by_sha[segment["sha256"]] = (collection, book, segment["upload"], segment["member"], page_range)
            if coverage != Counter(range(1, book["expectedPages"] + 1)):
                raise ValueError("Missing or overlapping physical source pages")
        else:
            if len(book["uploads"]) != 1:
                raise ValueError("Direct requested source must have one actual input")
            name = book["uploads"][0]
            if book["sha256"] in by_sha:
                raise ValueError("Repeated direct-source digest in book coverage")
            by_sha[book["sha256"]] = (collection, book, name, name, {"from": 1, "to": book["actualOpenedPages"]})
    if set(titles) != set(V2_COLLECTIONS.values()):
        raise ValueError("Not all five requested book identities were audited")
    return by_sha, titles


def new_document(public, private, v2, physical_container):
    member = relative_label(private["member"])
    archive = archive_label(private["archive"])
    if PurePosixPath(member).name != public["fileName"]:
        raise ValueError("Supplied filename does not match private member")
    page_count = public["pageCount"]
    if public["sha256"] in v2:
        source, book, supplied, expected_member, reference = v2[public["sha256"]]
        if private["archive"] != supplied or member != expected_member:
            raise ValueError("Actual source identity differs from coverage audit")
        reference = {"from": reference["from"], "to": reference["to"],
                     "basis": "actual_pdf_count_and_segment_metadata_checked",
                     "fullOriginalBookCrosschecked": False,
                     "wholeProvidedBookPageCoverageChecked": True,
                     "canonicalWholeFileShaVerified": False}
        category, topic, subtopic, declared = "TYT", None, None, None
        title = book["bookTitle"]
    else:
        source, reference, declared = source_reference(member, {}, page_count)
        title = SOURCE_TITLES[source]
        parts = PurePosixPath(member).parts
        category = parts[0]
        topic = parts[1] if len(parts) > 2 else None
        subtopic = parts[2] if len(parts) > 3 else None
    row = {
        "id": public["id"], "archive": archive, "containerId": physical_container, "member": member,
        "fileName": public["fileName"], "sha256": public["sha256"], "bytes": public["bytes"],
        "pageCount": page_count, "textLayerPages": public["textLayerPages"],
        "sparseTextPages": public["sparseTextPages"], "sourceId": source, "title": title,
        "categoryDirectoryLabel": category, "topicDirectoryLabel": topic,
        "subtopicDirectoryLabel": subtopic,
        "classificationStatus": "directory_labels_only_not_question_audit",
        "sourcePageRange": reference, "declaredQuestionCount": declared,
        "questionCountStatus": "not_individually_counted", "verifiedOriginalQuestionCount": 0,
        "archiveMemberHashMatched": True,
        "rights": {"status": "unverified", "allowsPublicInline": False,
                   "basis": "Supplied files and metadata do not establish a rights-holder reuse grant."},
    }
    validate_document(row)
    return row


def build(previous, additions, private_files, audit):
    v2, v2_titles = coverage_index(audit)
    private_pdfs = [r for r in private_files if r.get("type") == ".pdf"]
    private_by_sha = {r["sha256"]: r for r in private_pdfs}
    if len(private_by_sha) != len(private_pdfs):
        raise ValueError("Duplicate PDF digest in private additions manifest")
    if previous["summary"]["pdfCount"] != len(previous["documents"]) or previous["summary"]["pageCount"] != sum(r["pageCount"] for r in previous["documents"]):
        raise ValueError("Historical summary differs from actual document metadata")
    if additions["summary"]["newUniquePdfDocuments"] != len(additions["documents"]) or additions["summary"]["newPdfPages"] != sum(r["pageCount"] for r in additions["documents"]):
        raise ValueError("Additions summary differs from actual document metadata")
    historical_containers = {r["id"]: container_id(r["sha256"]) for r in previous["archives"]}
    supplied_containers = {r["name"]: container_id(r["sha256"]) for r in additions["uploads"]}
    documents = [dict({k: row[k] for k in DOCUMENT_FIELDS if k in row},
                      containerId=historical_containers[row["archive"]]) for row in previous["documents"]]
    previous_docs = json.loads(json.dumps(documents))
    for row in documents:
        validate_document(row)
    for public in additions["documents"]:
        private = private_by_sha.get(public["sha256"])
        if not private:
            raise ValueError("New public PDF lacks actual private source bytes")
        inspect_private_match(public, private)
        documents.append(new_document(public, private, v2, supplied_containers[private["archive"]]))
    if set(private_by_sha) != {r["sha256"] for r in additions["documents"]}:
        raise ValueError("Private/public additions do not have identical actual PDF coverage")
    if not set(v2).issubset(private_by_sha):
        raise ValueError("Requested book coverage includes unavailable PDF segments")
    assert_unique_documents(documents)
    if documents[:len(previous_docs)] != previous_docs:
        raise ValueError("Historical document metadata changed")
    uploads = []
    archives = [dict(row, id=container_id(row["sha256"]), containerId=container_id(row["sha256"]),
                     label=row["id"], containerType="zip") for row in previous["archives"]]
    original_parts = {r["uploadFileName"]: r for r in audit["previousOriginalArchiveCompletion"]["actualArchiveRecords"]}
    part_numbers = {row["partNumber"] for row in previous["archives"]}
    for upload in additions["uploads"]:
        if not upload.get("actuallyRead") or not upload.get("scanCompleteWithoutErrors"):
            raise ValueError("Input not completely read")
        label = archive_label(upload["name"])
        physical_id = container_id(upload["sha256"])
        selected = [row for row in documents[len(previous_docs):] if row["containerId"] == physical_id]
        item = {"id": physical_id, "containerId": physical_id, "label": label,
                "fileName": upload["name"], "sha256": upload["sha256"],
                "bytes": upload["bytes"], "pdfCount": len(selected),
                "pageCount": sum(row["pageCount"] for row in selected),
                "containerType": "zip" if upload["name"].lower().endswith(".zip") else "direct_pdf"}
        if upload["name"] in original_parts:
            original = original_parts[upload["name"]]
            item.update(partNumber=original["internalOriginalPartNumber"], declaredTotalParts=23,
                        partIndexEntriesMatched=original["declaredCountMatched"])
            if (item["pdfCount"], item["pageCount"]) != (original["actualPdfCount"], original["actualPages"]):
                raise ValueError("Actual part metadata disagrees with selected PDF documents")
            part_numbers.add(item["partNumber"])
        elif upload["name"] == "10_KATALOG.zip":
            item.update(partNumber=23, declaredTotalParts=23, partIndexEntriesMatched=True)
            part_numbers.add(23)
        archives.append(item)
        uploads.append({"fileName": upload["name"], "containerId": physical_id,
                        "sha256": upload["sha256"], "bytes": upload["bytes"],
                        "actuallyRead": True, "scanCompleteWithoutErrors": True,
                        "documentIds": [row["id"] for row in selected]})
    if len({r["id"] for r in archives}) != len(archives):
        raise ValueError("Archive/input container labels collide")
    containers_by_id = {row["id"]: row for row in archives}
    for row in documents:
        if containers_by_id[row["containerId"]]["label"] != row["archive"]:
            raise ValueError("Physical input identity and canonical archive label disagree")
    titles = {row["id"]: row["title"] for row in previous["sources"]}
    titles.update(v2_titles)
    sources = [{"id": source, "title": titles[source],
                "pdfCount": sum(r["sourceId"] == source for r in documents),
                "pageCount": sum(r["pageCount"] for r in documents if r["sourceId"] == source),
                "rightsStatus": "unverified", "allowsPublicInline": False}
               for source in sorted({r["sourceId"] for r in documents})]
    missing_parts = sorted(set(range(1, 24)) - part_numbers)
    overlap = {
        "kind": "partial_question_overlap_not_complete_book_identity",
        "historicalSourceId": "Ozdebir_GIS_2024_Ornek",
        "newSourceId": "Ozdebir_GIS_TYT_Ornek_12sayfa",
        "historicalDocumentIds": [r["id"] for r in previous_docs if r["sourceId"] == "Ozdebir_GIS_2024_Ornek"],
        "newDocumentIds": [r["id"] for r in documents if r["sourceId"] == "Ozdebir_GIS_TYT_Ornek_12sayfa"],
        "status": "partial_question_overlap_reported_in_private_review",
        "reason": "The previous two-page excerpt and supplied twelve-page sample have partial question overlap. They remain separate supplied collections; complete book identity and unique question totals are not inferred.",
        "automaticallyMergeCollections": False,
    }
    combined = {
        "schemaVersion": 1, "kind": "original_pdf_metadata_inventory_not_question_bank", "version": VERSION,
        "scope": "Combined actual PDF availability metadata; not extracted, verified or publicly reusable original questions.",
        "historicalSnapshot": {"fileName": "source-pdf-inventory.json", "pdfCount": len(previous_docs),
                               "pageCount": sum(r["pageCount"] for r in previous_docs), "preservedUnchanged": True},
        "summary": {"archiveCount": len(archives), "zipArchiveCount": sum(r["containerType"] == "zip" for r in archives),
                    "directPdfInputCount": sum(r["containerType"] == "direct_pdf" for r in archives),
                    "pdfCount": len(documents), "sourceCount": len(sources),
                    "pageCount": sum(r["pageCount"] for r in documents),
                    "textLayerPages": sum(r["textLayerPages"] for r in documents),
                    "sparseTextPages": sum(r["sparseTextPages"] for r in documents),
                    "categoryDirectoryCounts": dict(sorted(Counter(r["categoryDirectoryLabel"] for r in documents).items())),
                    "rightsVerifiedDocuments": 0, "publicOriginalQuestionCount": 0,
                    "exactDuplicatePdfGroups": 0, "overlappingProvidedSourcePageReferences": 0},
        "sourceGroupPolicy": {"basis": "historical_eight_collections_plus_five_separately_supplied_v2_collections",
                              "countIsNotPublisherCount": True, "countIsNotDistinctBookCount": True,
                              "partialQuestionOverlapDoesNotMergeCollections": True},
        "physicalInputIdentityPolicy": {
            "containerId": "input prefix plus the first sixteen hexadecimal characters of the actual input SHA256",
            "archive": "canonical supplied label without ZIP extension; labels can repeat for different physical ZIPs",
            "distinctSameLabelInputsKeptSeparate": True,
        },
        "pageTextCountPolicy": {
            "historicalSnapshot": "Text-layer and sparse-page counts are complementary historical metrics.",
            "newAdditions": "Text-layer counts measure nonempty page text; sparse counts measure fewer than thirty characters. These metrics can overlap.",
            "actualPageTotalUses": "pageCount only; overlapping text diagnostics never increase page totals",
        },
        "missingArchiveParts": missing_parts, "requestedV2FilesNotSuppliedByExactName": [],
        "missingFileCaveat": "Requested book content is available as audited complete segments or aliased direct files; original exact basenames are not required again.",
        "rightsReview": {"status": "unverified", "publicOriginalContentAllowed": False,
                         "reason": "No verified rights-holder reuse grant; supplied hashes and page coverage do not grant redistribution permission.",
                         "pdfPermissionFlagsAreNotCopyrightLicenses": True, "notALegalDetermination": True},
        "archives": archives, "sources": sources, "documents": documents,
        "duplicatePdfGroups": [], "overlappingProvidedSourcePageReferences": [],
        "partialCollectionOverlapNotices": [overlap],
    }
    requested = []
    for book in audit["books"]:
        collection = V2_COLLECTIONS[book["requestedFileName"]]
        selected = [r for r in documents if r["sourceId"] == collection]
        if sum(r["pageCount"] for r in selected) != book["expectedPages"] or len(selected) != book["actualOpenedPdfSegments"]:
            raise ValueError("Requested book metadata does not match actual combined coverage")
        requested.append({"requestedFileName": book["requestedFileName"], "sourceId": collection,
                          "suppliedAs": book["uploads"], "bookTitle": book["bookTitle"],
                          "expectedPages": book["expectedPages"], "actualAvailablePages": sum(r["pageCount"] for r in selected),
                          "pdfSegments": len(selected), "physicalPageCoverageComplete": True,
                          "identityStatus": "book_identity_and_page_coverage_checked",
                          "identityEvidencePhysicalPages": [r["physicalPage"] for r in book["contentIdentityEvidence"]],
                          "canonicalWholeFileShaVerified": False,
                          "rasterizedSourcePhysicalPages": book.get("rasterizedSourcePhysicalPages", []),
                          "documentIds": [r["id"] for r in selected]})
    supply = {
        "schemaVersion": 1, "kind": "source_supply_status_metadata_not_question_bank", "version": VERSION,
        "summary": {"receivedNewInputFiles": len(uploads), "newActualPdfCount": len(documents) - len(previous_docs),
                    "newActualPages": additions["summary"]["newPdfPages"],
                    "combinedActualPdfCount": len(documents), "combinedActualPages": combined["summary"]["pageCount"],
                    "requestedBookIdentitiesAvailable": len(requested), "publicOriginalQuestionCount": 0,
                    "rightsVerifiedDocuments": 0},
        "receivedFiles": uploads,
        "receivedPdfDocuments": [{key: row[key] for key in ("id", "sha256", "fileName", "archive", "containerId", "member", "pageCount", "sourceId")}
                                 for row in documents[len(previous_docs):]],
        "verifiedRequestedBookIdentities": requested,
        "missingArchiveParts": missing_parts, "requestedV2FilesNotSuppliedByExactName": [],
        "noMissingNeeded": not missing_parts,
        "noMissingNeededMessage": "Önceden istenen kitaplar ve arşiv parçaları erişilebilir. Bu dosyaları yeniden yüklemen gerekmiyor.",
        "partialCollectionOverlapNotices": [overlap],
        "rights": {"status": "unverified", "allowsPublicInline": False},
        "limits": ["File and page counts are not extracted or validated question totals.",
                   "Canonical original whole-file digest identity was not independently established.",
                   "Original publisher content remains private; no publication permission is inferred."],
    }
    for output in (combined, supply):
        assert_public_metadata(output)
    return combined, supply


def write_json(name, data):
    target = Path(name)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".tmp")
    if target.is_symlink() or temporary.is_symlink():
        raise ValueError("Refusing a symlink output")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)


def expect_rejected(callback):
    try:
        callback()
    except (ValueError, KeyError):
        return
    raise AssertionError("Invalid input did not fail closed")


def self_test():
    for bad in ("../a.pdf", "/etc/a.pdf", "a/../b", "C:/a.pdf", "a\\b", "a\x00b"):
        expect_rejected(lambda: relative_label(bad))
    assert archive_label("09_TYT.zip") == "09_TYT"
    assert archive_label("23_ULTI.pdf") == "23_ULTI.pdf"
    for bad in ({"fileId": "secret"}, {"body": "PRIVATE_BODY_SENTINEL"}, {"value": "/workspace/private.pdf"}):
        expect_rejected(lambda: assert_public_metadata(bad))
    with tempfile.TemporaryDirectory() as folder:
        private = Path(folder) / "private.pdf"
        raw = b"%PDF-test-bytes"
        private.write_bytes(raw)
        sha = digest(raw)
        public = {"id": "pdf-" + sha[:16], "sha256": sha, "bytes": len(raw),
                  "pageCount": 1, "pagesRead": 1, "renderedPages": 1, "renderFailures": 0,
                  "status": "pdf_read", "encrypted": False, "needsPassword": False}
        manifest = {"path": str(private), "sha256": sha, "bytes": len(raw), "pageCount": 1}
        inspect_private_match(public, manifest)
        filename = "Orijinal_TYT_Matematik_PDF_004-004.pdf"
        projected = new_document(dict(public, fileName=filename, textLayerPages=1,
                                     sparseTextPages=0, body="PRIVATE_BODY_SENTINEL", fileId="secret"),
                                 {"archive": "01_TYT.zip", "member": "TYT/" + filename,
                                  "path": str(private), "options": ["PRIVATE_BODY_SENTINEL"]},
                                 {}, container_id(sha))
        assert_public_metadata(projected)
        assert "body" not in projected and "fileId" not in projected and "options" not in projected
        private.write_bytes(raw + b"changed")
        expect_rejected(lambda: inspect_private_match(public, manifest))
        private.write_bytes(raw)
        expect_rejected(lambda: inspect_private_match(dict(public, sha256="0" * 64), manifest))
        expect_rejected(lambda: inspect_private_match(dict(public, renderedPages=0), manifest))
        expect_rejected(lambda: inspect_private_match(dict(public, encrypted=True), manifest))
        private_folder = Path(folder) / "pdfs"
        private_folder.mkdir()
        safe = private_folder / (sha + ".pdf")
        safe.write_bytes(raw)
        safe_row = {"type": ".pdf", "path": str(safe), "sha256": sha}
        check_private_locations([safe_row], folder)
        expect_rejected(lambda: check_private_locations([dict(safe_row, path=str(private))], folder))
        expect_rejected(lambda: check_private_locations([dict(safe_row, sha256="0" * 64)], folder))
        frozen = Path(folder) / "frozen.json"
        frozen.write_bytes(b'{"historical":true}\n')
        frozen_sha = digest(frozen.read_bytes())
        write_json(Path(folder) / "combined.json", {"metadata": "only"})
        assert digest(frozen.read_bytes()) == frozen_sha
    # Repeated identities must fail rather than increase totals.
    sample = {"id": "pdf-" + "1" * 16, "sha256": "1" * 64, "archive": "01_TYT", "member": "TYT/a.pdf",
              "fileName": "a.pdf", "pageCount": 2, "bytes": 20, "verifiedOriginalQuestionCount": 0,
              "rights": {"status": "unverified", "allowsPublicInline": False},
              "sourcePageRange": {"from": 4, "to": 5}}
    validate_document(sample)
    assert_unique_documents([sample])
    expect_rejected(lambda: assert_unique_documents([sample, sample]))
    expect_rejected(lambda: assert_unique_documents([sample, dict(sample, id="pdf-" + "2" * 16, sha256="2" * 64)]))
    expect_rejected(lambda: validate_document(dict(sample, id="wrong")))
    expect_rejected(lambda: validate_document(dict(sample, sourcePageRange={"from": 4, "to": 6})))
    expect_rejected(lambda: validate_document(dict(sample, rights={"status": "verified", "allowsPublicInline": True})))
    print("combined source inventory self-test: privacy, digest duplicates, source ranges and byte invariants fail closed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--previous", default=ROOT / "data/source-pdf-inventory.json", type=Path)
    parser.add_argument("--additions", default=ROOT / "data/source-pdf-additions.json", type=Path)
    parser.add_argument("--private-manifest", type=Path)
    parser.add_argument("--coverage-audit", type=Path)
    parser.add_argument("--combined-output", default=ROOT / "data/source-pdf-inventory-all.json", type=Path)
    parser.add_argument("--supply-output", default=ROOT / "data/source-supply-status.json", type=Path)
    parser.add_argument("--missing-output", default=ROOT / "docs/MISSING_SOURCE_FILES.txt", type=Path)
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.private_manifest or not args.coverage_audit:
        parser.error("--private-manifest and --coverage-audit are required for an actual-byte build")
    outputs = {args.combined_output.resolve(), args.supply_output.resolve(), args.missing_output.resolve()}
    inputs = {args.previous.resolve(), args.additions.resolve(), args.private_manifest.resolve(), args.coverage_audit.resolve()}
    if len(outputs) != 3 or outputs.intersection(inputs):
        raise ValueError("Outputs must be distinct and cannot overwrite any source input")
    frozen = args.previous.read_bytes()
    private_files = load(args.private_manifest)
    check_private_locations(private_files, args.private_manifest.parent)
    combined, supply = build(json.loads(frozen), load(args.additions), private_files, load(args.coverage_audit))
    if combined["missingArchiveParts"] or not supply["noMissingNeeded"]:
        raise ValueError("Cannot clear missing file list before required inputs are available")
    write_json(args.combined_output, combined)
    write_json(args.supply_output, supply)
    if args.missing_output.is_symlink():
        raise ValueError("Refusing a symlink missing-file list")
    args.missing_output.write_bytes(b"")
    if args.previous.read_bytes() != frozen:
        raise ValueError("Historical inventory bytes changed during build")
    print(json.dumps({"pdfCount": combined["summary"]["pdfCount"], "pageCount": combined["summary"]["pageCount"],
                      "sourceCollectionCount": combined["summary"]["sourceCount"],
                      "historicalInventorySha256": digest(frozen), "missingFiles": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
