import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const inventory = JSON.parse(fs.readFileSync(new URL('../data/source-pdf-inventory.json',import.meta.url),'utf8'));

test('actual PDF inventory remains metadata and cannot advertise inline original questions',()=>{
  assert.equal(inventory.schemaVersion,1);
  assert.equal(inventory.kind,'original_pdf_metadata_inventory_not_question_bank');
  assert.equal(inventory.documents.length,95);
  assert.equal(inventory.archives.length,13);
  assert.equal(inventory.sources.length,8);
  assert.equal(inventory.summary.pageCount,1256);
  assert.equal(inventory.documents.reduce((n,d)=>n+d.pageCount,0),1256);
  assert.deepEqual(inventory.summary.categoryDirectoryCounts,{CEVAP:3,ORTAK:17,TYT:63,TYT_DENEMESI:12});
  assert.equal(inventory.summary.publicOriginalQuestionCount,0);
  assert.equal(inventory.summary.rightsVerifiedDocuments,0);
  assert.equal(inventory.rightsReview.publicOriginalContentAllowed,false);
  for(const doc of inventory.documents){
    assert.match(doc.sha256,/^[a-f0-9]{64}$/);
    assert.equal(doc.id,'pdf-'+doc.sha256.slice(0,16));
    assert.equal(doc.archiveMemberHashMatched,true);
    assert.equal(doc.rights.status,'unverified');
    assert.equal(doc.rights.allowsPublicInline,false);
    assert.equal(doc.verifiedOriginalQuestionCount,0);
    assert.equal(doc.classificationStatus,'directory_labels_only_not_question_audit');
    assert.equal(doc.pageCount,doc.textLayerPages+doc.sparseTextPages);
    if(doc.sourcePageRange){
      assert.equal(doc.sourcePageRange.to-doc.sourcePageRange.from+1,doc.pageCount);
      assert.equal(doc.sourcePageRange.fullOriginalBookCrosschecked,false);
    }
  }
});

test('public projection contains no PDF text, question bodies, images or private file locations',()=>{
  const forbidden=new Set(['prompt','options','solution','solutionSteps','answer','image','imageData','firstPageText','allPageText','pdfMetadata','rightsTextEvidence','path']);
  const visit=value=>{
    if(Array.isArray(value))return value.forEach(visit);
    if(value&&typeof value==='object')for(const [key,nested] of Object.entries(value)){
      assert.equal(forbidden.has(key),false,'Private/content field leaked: '+key);visit(nested);
    }
    if(typeof value==='string')assert.doesNotMatch(value,/\/workspace\/|\/tmp\/|data:image\/|data:application\/pdf|COPYRIGHT_BODY_SENTINEL/);
  };
  visit(inventory);
  const publicRows=inventory.documents.map(d=>d.archive+'/'+d.member);
  assert.equal(new Set(publicRows).size,publicRows.length);
});

test('missing parts and v2 files are disclosed instead of inferring unseen content',()=>{
  assert.deepEqual(inventory.missingArchiveParts,[1,2,3,4,5,6,7,8,12,23]);
  assert.equal(inventory.requestedV2FilesNotSuppliedByExactName.length,5);
  assert.ok(inventory.requestedV2FilesNotSuppliedByExactName.includes('UcgenAkademi_TYT_Matematik_416sayfa.pdf'));
  assert.ok(inventory.archives.every(a=>a.partIndexEntriesMatched&&a.declaredTotalParts===23));
  assert.equal(inventory.archives.reduce((n,a)=>n+a.pdfCount,0),95);
  assert.equal(inventory.archives.reduce((n,a)=>n+a.pageCount,0),1256);
});

test('inventory parser rejects traversal and keeps supplied prose out of public metadata',()=>{
  const run=spawnSync('python3',['scripts/source_pdf_inventory.py','--self-test'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout);
  assert.match(run.stdout,/fail closed/);
});
