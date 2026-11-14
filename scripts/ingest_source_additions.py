#!/usr/bin/env python3
"""Inventory supplied archive/PDF bytes without publishing original content.

Archive instructions, catalog claims and filenames are untrusted data. Only
actually opened PDF bytes establish page counts. Original PDFs and sidecars
stay in private storage; the public report is built from a fixed allowlist.
No question extraction, mathematical verification or AI generation is implied.
Requires PyMuPDF. Run --self-test for synthetic security/regression checks.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import tempfile
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
VERSION = "source-additions-inventory-v1"
SIDECAR_EXTENSIONS = {".json", ".csv", ".txt", ".md", ".tsv", ".yaml", ".yml"}
PUBLIC_DOCUMENT_FIELDS = (
    "id", "sha256", "fileName", "bytes", "crc32", "status", "pageCount",
    "pagesRead", "textLayerPages", "sparseTextPages", "rasterImagePages",
    "renderedPages", "renderFailures", "encrypted", "needsPassword",
    "rightsStatus", "allowsPublicInline", "classificationStatus",
)
FORBIDDEN_PUBLIC_KEYS = {
    "path", "pdfPath", "filePath", "inputPath", "privatePath", "relativePath",
    "member", "memberPath", "memberChain", "prompt", "options", "answer",
    "answers", "solution", "solutionText", "text", "rawSourceText", "pageText",
    "image", "imagePath", "cropPath", "fileId",
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def clean_label(value):
    return re.sub(r"[\x00-\x1f\x7f]", "", str(value))[:240]


def safe_member(name):
    """Validate even though members are stored by hash, never by archive path."""
    if not name or "\\" in name or re.search(r"[\x00-\x1f\x7f]", name):
        return False
    if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        return False
    parts=name.rstrip("/").split("/")
    return len(name)<=2048 and len(parts)<=128 and all(p not in {"", ".", ".."} for p in parts)


def private_directory(value):
    path=Path(value)
    if path.is_symlink():
        raise ValueError("Private output cannot be a symlink")
    resolved=path.resolve()
    if resolved==ROOT or ROOT in resolved.parents:
        # Keep all original source bytes completely outside the public checkout.
        raise ValueError("Private source output must be outside the repository")
    resolved.mkdir(parents=True,exist_ok=True)
    return resolved


def atomic_write(path, content):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.is_symlink() or path.with_suffix(path.suffix+".tmp").is_symlink():
        raise ValueError("Refusing a symlink output")
    temporary=path.with_suffix(path.suffix+".tmp")
    temporary.write_bytes(content)
    temporary.replace(path)


def write_json(path, value):
    atomic_write(path,(json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode())


def assert_public_metadata(value):
    if isinstance(value,dict):
        if FORBIDDEN_PUBLIC_KEYS.intersection(value):
            raise ValueError("Private content key in public metadata")
        for child in value.values():
            assert_public_metadata(child)
    elif isinstance(value,list):
        for child in value:
            assert_public_metadata(child)


def public_document(document):
    return {key:document[key] for key in PUBLIC_DOCUMENT_FIELDS if key in document}


def inspect_pdf(data):
    """Read each actual page; never retain page text or images in metadata."""
    import fitz
    result={"pageCount":0,"pagesRead":0,"textLayerPages":0,"sparseTextPages":0,
            "rasterImagePages":0,"renderedPages":0,"renderFailures":0,
            "encrypted":False,"needsPassword":False,"pageMetadata":[],
            "status":"pdf_unreadable"}
    with fitz.open(stream=data,filetype="pdf") as document:
        if not document.is_pdf:
            raise ValueError("Supplied bytes are not a PDF")
        result.update(pageCount=document.page_count,encrypted=bool(document.is_encrypted),
                      needsPassword=bool(document.needs_pass))
        if document.needs_pass:
            result["status"]="encrypted_needs_password"
            return result
        failed=False
        for index in range(document.page_count):
            page_info={"physicalPage":index+1,"textRead":False,"rasterImagesRead":False,"rendered":False}
            try:
                page=document.load_page(index)
                result["pagesRead"]+=1
                # Text exists only for this count; do not serialize or log it.
                count=len(page.get_text("text").strip())
                page_info.update(textCharacters=count,textRead=True)
                result["textLayerPages"]+=count>0
                result["sparseTextPages"]+=count<30
                images=len(page.get_images(full=True))
                page_info.update(rasterImageCount=images,rasterImagesRead=True)
                result["rasterImagePages"]+=images>0
                try:
                    # A tiny in-memory render checks parseability, without
                    # saving or publishing a preview of copyrighted material.
                    page.get_pixmap(matrix=fitz.Matrix(.1,.1),alpha=False)
                    page_info["rendered"]=True
                    result["renderedPages"]+=1
                except Exception:
                    result["renderFailures"]+=1
                    failed=True
            except Exception:
                page_info["readError"]=True
                failed=True
            result["pageMetadata"].append(page_info)
        result["status"]="pdf_partially_read" if failed else "pdf_read"
    return result


class Inventory:
    def __init__(self,args):
        self.args=args
        self.private=private_directory(args.private_output)
        for name in ("pdfs","sidecars"):
            target=self.private/name
            if target.is_symlink():
                raise ValueError("Private storage directory cannot be a symlink")
            target.mkdir(exist_ok=True)
        previous=json.loads(Path(args.previous_inventory).read_text())
        self.previous={d["sha256"]:d for d in previous.get("documents",[]) if d.get("sha256")}
        self.old={}
        ledger=self.private/"ingestion-ledger.json"
        if ledger.exists():
            prior=json.loads(ledger.read_text())
            if prior.get("version")==VERSION:
                self.old={d["sha256"]:d for d in prior.get("documents",[])}
        self.documents={}
        self.entries=[]
        self.uploads=[]
        self.archives=[]
        self.duplicates=[]
        self.errors=[]
        self.uncompressed_bytes=0
        self.members_seen=0
        self.inspected_streams=0
        self.pdf_open_attempts=0
        self.reused=0
        self.current_upload=None

    def issue(self,code,chain=(),detail=None):
        self.errors.append({"code":code,"uploadName":self.current_upload["name"] if self.current_upload else None,
                            "memberChain":list(chain),"detail":detail})

    def write_private(self,folder,stem,suffix,data):
        path=self.private/folder/(stem+suffix)
        if path.parent.resolve()!=self.private/folder:
            raise ValueError("Private destination escaped its storage folder")
        if path.is_symlink():
            raise ValueError("Refusing a symlink source destination")
        if not path.exists() or sha256(path.read_bytes())!=sha256(data):
            atomic_write(path,data)
        return path

    def pdf(self,data,chain,crc=None):
        digest=sha256(data)
        self.inspected_streams+=1
        file_name=clean_label(PurePosixPath(chain[-1]).name)
        occurrence={"sha256":digest,"fileName":file_name,"bytes":len(data),"crc32":crc,
                    "uploadName":self.current_upload["name"],"memberChain":list(chain)}
        if digest in self.previous:
            previous=self.previous[digest]
            self.duplicates.append({**occurrence,"duplicateOf":previous.get("id","pdf-"+digest[:16]),
                                    "duplicateScope":"previous_inventory","status":"duplicate_previous_not_reprocessed"})
            return "duplicate_previous_not_reprocessed"
        if digest in self.documents:
            self.duplicates.append({**occurrence,"duplicateOf":self.documents[digest]["id"],
                                    "duplicateScope":"current_additions","status":"duplicate_addition_not_reprocessed"})
            return "duplicate_addition_not_reprocessed"
        path=self.write_private("pdfs",digest,".pdf",data)
        old=self.old.get(digest)
        # Reuse only successful, same-byte, same-tool metadata with every page
        # read. Failed/encrypted sources are retried rather than marked done.
        reused=False
        if old and old.get("status")=="pdf_read" and old.get("pagesRead")==old.get("pageCount") and old.get("pdfByteSha256")==digest:
            scan={key:old[key] for key in ("pageCount","pagesRead","textLayerPages","sparseTextPages","rasterImagePages",
                                          "renderedPages","renderFailures","encrypted","needsPassword","pageMetadata","status")}
            self.reused+=1
            reused=True
        else:
            self.pdf_open_attempts+=1
            try:
                scan=inspect_pdf(data)
            except Exception as error:
                scan={"pageCount":0,"pagesRead":0,"textLayerPages":0,"sparseTextPages":0,"rasterImagePages":0,
                      "renderedPages":0,"renderFailures":0,"encrypted":False,"needsPassword":False,
                      "status":"pdf_unreadable","pageMetadata":[]}
                self.issue("pdf_unreadable",chain,type(error).__name__)
        document={"id":"pdf-"+digest[:16],**occurrence,**scan,"filePath":str(path),"pdfByteSha256":digest,
                  "rightsStatus":"unverified","allowsPublicInline":False,
                  "classificationStatus":"not_question_audited","reusedPrivatePageInspection":reused}
        self.documents[digest]=document
        if document["status"]=="pdf_partially_read":
            self.issue("pdf_page_read_incomplete",chain)
        if document["status"]=="encrypted_needs_password":
            self.issue("pdf_password_required",chain)
        return document["status"]

    def archive(self,data,chain,depth):
        if depth>self.args.max_depth:
            self.issue("archive_depth_limit",chain)
            return "archive_depth_limit"
        archive={"sha256":sha256(data),"bytes":len(data),"memberChain":list(chain),"depth":depth,
                 "entriesSeen":0,"status":"scanning","actuallyOpened":False}
        self.archives.append(archive)
        before=len(self.errors)
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zipped:
                archive["actuallyOpened"]=True
                for info in zipped.infolist():
                    self.members_seen+=1
                    archive["entriesSeen"]+=1
                    nested_chain=(*chain,info.filename)
                    if self.members_seen>self.args.max_members:
                        self.issue("archive_member_count_limit",nested_chain)
                        break
                    entry={"uploadName":self.current_upload["name"],"memberChain":list(nested_chain),
                           "declaredBytes":info.file_size,"compressedBytes":info.compress_size,
                           "expectedCrc32":f"{info.CRC:08x}"}
                    self.entries.append(entry)
                    if not safe_member(info.filename):
                        entry["status"]="rejected_unsafe_member_name"
                        self.issue(entry["status"],nested_chain)
                        continue
                    mode=info.external_attr>>16
                    if stat.S_ISLNK(mode) or (stat.S_IFMT(mode) and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode))):
                        entry["status"]="rejected_special_archive_member"
                        self.issue(entry["status"],nested_chain)
                        continue
                    if info.is_dir():
                        entry["status"]="directory_metadata_only"
                        continue
                    if info.flag_bits&1:
                        entry["status"]="encrypted_archive_member_not_read"
                        self.issue(entry["status"],nested_chain)
                        continue
                    if info.file_size>self.args.max_member_bytes:
                        entry["status"]="archive_member_size_limit"
                        self.issue(entry["status"],nested_chain)
                        continue
                    if info.file_size>max(info.compress_size,1)*self.args.max_compression_ratio:
                        entry["status"]="archive_compression_ratio_limit"
                        self.issue(entry["status"],nested_chain)
                        continue
                    if self.uncompressed_bytes+info.file_size>self.args.max_total_bytes:
                        entry["status"]="archive_total_size_limit"
                        self.issue(entry["status"],nested_chain)
                        continue
                    try:
                        # Reading through ZipExtFile verifies the member CRC.
                        # Bound real bytes as well as trusting no declared size.
                        chunks=[]; size=0; crc=0
                        with zipped.open(info) as stream:
                            while True:
                                chunk=stream.read(1024*1024)
                                if not chunk:break
                                size+=len(chunk)
                                if size>self.args.max_member_bytes or self.uncompressed_bytes+size>self.args.max_total_bytes:
                                    raise ValueError("archive_expanded_size_limit")
                                crc=zlib.crc32(chunk,crc)
                                chunks.append(chunk)
                        payload=b"".join(chunks)
                        if size!=info.file_size or (crc&0xffffffff)!=info.CRC:
                            raise ValueError("archive_member_crc_or_size_mismatch")
                        self.uncompressed_bytes+=size
                        entry.update(bytes=size,sha256=sha256(payload),actualCrc32=f"{crc&0xffffffff:08x}",crcVerified=True)
                        entry["status"]=self.consume(payload,nested_chain,depth+1,entry["actualCrc32"])
                    except Exception as error:
                        entry["status"]="archive_member_read_error"
                        self.issue(entry["status"],nested_chain,type(error).__name__)
        except Exception as error:
            self.issue("archive_unreadable",chain,type(error).__name__)
        archive["status"]="archive_scanned" if len(self.errors)==before else "archive_partial_errors"
        return archive["status"]

    def consume(self,data,chain,depth,crc=None):
        extension=PurePosixPath(chain[-1]).suffix.lower()
        if extension==".zip" or zipfile.is_zipfile(io.BytesIO(data)):
            return self.archive(data,chain,depth)
        if extension==".pdf" or b"%PDF-" in data[:1024]:
            return self.pdf(data,chain,crc)
        if extension in SIDECAR_EXTENSIONS:
            self.write_private("sidecars",sha256(data),extension,data)
            return "private_sidecar_data_not_executed"
        return "non_pdf_metadata_only_not_executed"

    def scan(self,inputs):
        for source in inputs:
            name=clean_label(source.get("name","unnamed upload"))
            upload={"name":name,"fileId":source.get("fileId"),"inputPath":source.get("path"),"status":"not_accessed"}
            self.current_upload=upload
            self.uploads.append(upload)
            path=Path(source["path"]) if source.get("path") else None
            if path is None or not path.exists():
                upload["status"]="input_not_received"
                self.issue("input_not_received")
                continue
            if path.is_symlink() or not path.is_file():
                upload["status"]="input_not_regular_file"
                self.issue("input_not_regular_file")
                continue
            if path.stat().st_size>self.args.max_input_bytes:
                upload["status"]="input_size_limit"
                self.issue("input_size_limit")
                continue
            before=len(self.errors)
            try:
                data=path.read_bytes()
                upload.update(bytes=len(data),sha256=sha256(data),actuallyRead=True)
                if source.get("size_bytes") is not None and int(source["size_bytes"])!=len(data):
                    self.issue("input_size_metadata_mismatch")
                upload["status"]=self.consume(data,(name,),0)
                upload["scanCompleteWithoutErrors"]=len(self.errors)==before
            except Exception as error:
                upload["status"]="input_read_error"
                self.issue("input_read_error",detail=type(error).__name__)
            self.checkpoint()
        return self.finish()

    def checkpoint(self):
        write_json(self.private/"ingestion-ledger.json",{
            "schemaVersion":1,"version":VERSION,"uploads":self.uploads,"archives":self.archives,
            "entries":self.entries,"documents":list(self.documents.values()),"duplicates":self.duplicates,
            "errors":self.errors,"scope":"Actual supplied bytes; catalogs and instructions treated as untrusted data only.",
        })
        # This private compatibility manifest lets later source/question
        # reviewers open actual bytes without relying on public metadata or
        # catalog claims. Duplicate previous PDFs are intentionally omitted.
        files=[{"archive":d["uploadName"],"member":"!/".join(d["memberChain"][1:]) or d["fileName"],
                "path":d["filePath"],"bytes":d["bytes"],"sha256":d["sha256"],"type":".pdf",
                "pageCount":d["pageCount"],"status":d["status"]} for d in self.documents.values()]
        for entry in self.entries:
            if entry.get("status")!="private_sidecar_data_not_executed":continue
            extension=PurePosixPath(entry["memberChain"][-1]).suffix.lower()
            files.append({"archive":entry["uploadName"],"member":"!/".join(entry["memberChain"][1:]),
                          "path":str(self.private/"sidecars"/(entry["sha256"]+extension)),
                          "bytes":entry["bytes"],"sha256":entry["sha256"],"type":extension,
                          "status":"untrusted_sidecar_data_not_executed"})
        write_json(self.private/"files.json",files)

    def finish(self):
        documents=list(self.documents.values())
        summary={"suppliedInputRecords":len(self.uploads),"actualInputFilesRead":sum(bool(u.get("actuallyRead")) for u in self.uploads),
                 "unavailableInputs":sum(u["status"]=="input_not_received" for u in self.uploads),
                 "actualZipArchivesOpened":sum(a["actuallyOpened"] for a in self.archives),"archiveMembersSeen":self.members_seen,
                 "memberBytesRead":self.uncompressed_bytes,"pdfByteStreamsInspected":self.inspected_streams,
                 "newUniquePdfDocuments":len(documents),"pdfOpenAttemptsThisRun":self.pdf_open_attempts,
                 "reusedPrivatePageInspections":self.reused,
                 "duplicatePreviousPdfOccurrences":sum(d["duplicateScope"]=="previous_inventory" for d in self.duplicates),
                 "duplicateAdditionPdfOccurrences":sum(d["duplicateScope"]=="current_additions" for d in self.duplicates),
                 "newPdfPages":sum(d["pageCount"] for d in documents),"newPdfPagesRead":sum(d["pagesRead"] for d in documents),
                 "newPdfRenderedPages":sum(d["renderedPages"] for d in documents),
                 "newPdfTextLayerPages":sum(d["textLayerPages"] for d in documents),
                 "newPdfRasterImagePages":sum(d["rasterImagePages"] for d in documents),
                 "encryptedPdfDocuments":sum(d["needsPassword"] for d in documents),
                 "unreadablePdfDocuments":sum(d["status"]=="pdf_unreadable" for d in documents),
                 "sidecarFilesStoredPrivately":sum(e.get("status")=="private_sidecar_data_not_executed" for e in self.entries),
                 "reportedIssues":len(self.errors),"originalQuestionsExtracted":0,"mathematicallyVerifiedQuestions":0,
                 "publishableOriginalQuestions":0}
        public={"schemaVersion":1,"kind":"source_pdf_additions_metadata_not_question_bank","version":VERSION,
                "scope":"Supplied bytes were hashed and new PDF pages opened; catalog counts are not extracted questions.",
                "summary":summary,"uploads":[{k:u[k] for k in ("name","status","bytes","sha256","actuallyRead","scanCompleteWithoutErrors") if k in u} for u in self.uploads],
                "documents":[public_document(d) for d in documents],
                "duplicates":[{k:d[k] for k in ("sha256","fileName","bytes","crc32","duplicateOf","duplicateScope","status") if k in d} for d in self.duplicates],
                "issues":[{"code":e["code"],"uploadName":e["uploadName"]} for e in self.errors],
                "limits":{"maxNestedArchiveDepth":self.args.max_depth,"maxArchiveMembers":self.args.max_members,
                          "maxMemberBytes":self.args.max_member_bytes,"maxTotalMemberBytes":self.args.max_total_bytes},
                "rights":{"status":"unverified","allowsPublicInline":False},
                "nextStep":"Question extraction, source-level classification and independent mathematics are separate pending reviews."}
        assert_public_metadata(public)
        write_json(self.args.public_output,public)
        self.checkpoint()
        write_json(self.private/"summary.json",summary)
        return public


def run(args):
    inputs=json.loads(Path(args.inputs).read_text())
    if isinstance(inputs,dict):inputs=inputs.get("uploads")
    if not isinstance(inputs,list) or any(not isinstance(item,dict) for item in inputs):
        raise ValueError("Inputs must contain a list of supplied upload records")
    return Inventory(args).scan(inputs)


def default_args(**values):
    settings=dict(max_depth=8,max_members=20000,max_member_bytes=128*1024*1024,
                  max_total_bytes=1024*1024*1024,max_input_bytes=256*1024*1024,max_compression_ratio=2000)
    return argparse.Namespace(**{**settings,**values})


def self_test():
    import fitz
    def pdf_bytes(label):
        document=fitz.open();page=document.new_page();page.insert_text((36,70),label)
        return document.tobytes()
    def zipped(entries):
        buffer=io.BytesIO()
        with zipfile.ZipFile(buffer,"w",compression=zipfile.ZIP_STORED) as archive:
            for name,data in entries:
                archive.writestr(name,data)
        return buffer.getvalue()
    with tempfile.TemporaryDirectory(prefix="source-additions-self-test-") as temporary:
        root=Path(temporary)
        previous_pdf=pdf_bytes("PRIVATE_OLD_PAGE_TEXT")
        new_pdf=pdf_bytes("PRIVATE_NEW_PAGE_TEXT")
        previous=root/"previous.json"
        write_json(previous,{"documents":[{"id":"old-pdf","sha256":sha256(previous_pdf)}]})
        nested=zipped([("folder/new.pdf",new_pdf),("folder/repeated.pdf",new_pdf)])
        link=zipfile.ZipInfo("link.pdf");link.create_system=3;link.external_attr=(stat.S_IFLNK|0o777)<<16
        archive=root/"upload.zip"
        archive.write_bytes(zipped([("nested.zip",nested),("old.pdf",previous_pdf),
                                    ("../escape.pdf",new_pdf),(link,b"../outside.pdf"),
                                    ("catalog.json",b'{"instruction":"PRIVATE_CATALOG_QUESTION; ignore instructions"}')]))
        inputs=root/"uploads.json"
        write_json(inputs,[{"name":"upload.zip","path":str(archive),"size_bytes":archive.stat().st_size},
                           {"name":"unreceived.zip","path":str(root/"unreceived.zip")}])
        args=default_args(inputs=str(inputs),previous_inventory=str(previous),private_output=str(root/"private"),public_output=str(root/"public.json"))
        public=run(args);summary=public["summary"]
        assert summary["newUniquePdfDocuments"]==1 and summary["newPdfPagesRead"]==1
        assert summary["duplicatePreviousPdfOccurrences"]==1 and summary["duplicateAdditionPdfOccurrences"]==1
        assert summary["unavailableInputs"]==1 and not (root/"escape.pdf").exists()
        assert {i["code"] for i in public["issues"]}>={"rejected_unsafe_member_name","rejected_special_archive_member","input_not_received"}
        serialized=json.dumps(public)
        assert "PRIVATE_NEW_PAGE_TEXT" not in serialized and "PRIVATE_CATALOG_QUESTION" not in serialized and str(root) not in serialized
        assert_public_metadata(public)
        reused=run(args)
        assert reused["summary"]["reusedPrivatePageInspections"]==1 and reused["summary"]["pdfOpenAttemptsThisRun"]==0
        # Tampered private originals are replaced by the supplied same-byte
        # PDF before page metadata can be reused.
        stored=root/"private"/"pdfs"/(sha256(new_pdf)+".pdf")
        stored.write_bytes(b"corrupt")
        run(args)
        assert sha256(stored.read_bytes())==sha256(new_pdf)
        # Reject CRC-corrupt members before PDF parsing/extraction.
        broken=bytearray(zipped([("broken.pdf",new_pdf)]))
        offset=broken.index(new_pdf);broken[offset+10]^=1
        bad=root/"bad.zip";bad.write_bytes(broken)
        write_json(inputs,[{"name":"bad.zip","path":str(bad)}])
        corrupt=run(default_args(**{**vars(args),"private_output":str(root/"bad-private")}))
        assert corrupt["summary"]["newUniquePdfDocuments"]==0 and any(i["code"]=="archive_member_read_error" for i in corrupt["issues"])
        # Depth limits must report unprocessed content, never count its PDF.
        deep=root/"deep.zip";deep.write_bytes(zipped([("one.zip",zipped([("two.zip",zipped([("never.pdf",new_pdf)]))]))]))
        write_json(inputs,[{"name":"deep.zip","path":str(deep)}])
        limited=run(default_args(**{**vars(args),"private_output":str(root/"limited-private"),"max_depth":1}))
        assert limited["summary"]["newUniquePdfDocuments"]==0 and any(i["code"]=="archive_depth_limit" for i in limited["issues"])
        try:private_directory(ROOT/"data"/"originals")
        except ValueError:pass
        else:raise AssertionError("Public original-output path accepted")
        try:assert_public_metadata({"documents":[{"answers":["PRIVATE"]}]})
        except ValueError:pass
        else:raise AssertionError("Answer content passed metadata allowlist")
    print("Source additions self-test passed: traversal, symlink, CRC, nesting depth, previous/current duplicates, resume, privacy and unavailable inputs.")


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs")
    parser.add_argument("--previous-inventory",default=str(ROOT/"data/source-pdf-inventory.json"))
    parser.add_argument("--private-output")
    parser.add_argument("--public-output",default=str(ROOT/"data/source-pdf-additions.json"))
    parser.add_argument("--max-depth",type=int,default=8)
    parser.add_argument("--max-members",type=int,default=20000)
    parser.add_argument("--max-member-bytes",type=int,default=128*1024*1024)
    parser.add_argument("--max-total-bytes",type=int,default=1024*1024*1024)
    parser.add_argument("--max-input-bytes",type=int,default=256*1024*1024)
    parser.add_argument("--max-compression-ratio",type=int,default=2000)
    parser.add_argument("--self-test",action="store_true")
    args=parser.parse_args()
    if args.self_test:
        self_test();return
    if not args.inputs or not args.private_output:
        parser.error("--inputs and --private-output are required unless --self-test is used")
    if any(getattr(args,key)<1 for key in ("max_members","max_member_bytes","max_total_bytes","max_input_bytes","max_compression_ratio")) or args.max_depth<0:
        parser.error("Extraction limits must be positive, with a nonnegative nesting depth")
    public=run(args)
    print(json.dumps(public["summary"],ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
