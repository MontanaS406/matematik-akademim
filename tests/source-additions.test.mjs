import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {AI_BANK} from '../data/ai-bank.js';
import {createAiRegistry} from '../shared/ai-bank.js';

const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');

test('the previous 1778 complete records and the completed 221-record module remain frozen',()=>{
 const baseline=read('ai/preserved-pr12-1778.json'),registry=createAiRegistry(AI_BANK),raw=new Map(AI_BANK.questions.map(q=>[q.id,q]));
 assert.equal(baseline.count,1778);assert.equal(baseline.questions.length,1778);
 for(const q of baseline.questions){assert.equal(hash(raw.get(q.id)),q.recordHash,q.id);assert.ok(registry.getQuestion(q.id),q.id);}
 const actual=crypto.createHash('sha256').update(fs.readFileSync(new URL('../data/source-derived-expansion.js',import.meta.url))).digest('hex');
 assert.equal(actual,baseline.expansionModuleHash);
});

test('all 25 new uploads were read as 125 actual PDFs rather than catalog question indexes',()=>{
 const p=read('source-pdf-additions.json'),s=p.summary;
 assert.equal(s.actualInputFilesRead,25);assert.equal(s.unavailableInputs,0);assert.equal(s.actualZipArchivesOpened,22);
 assert.equal(s.newUniquePdfDocuments,125);assert.equal(p.documents.length,125);
 assert.equal(s.newPdfPagesRead,1766);assert.equal(s.newPdfRenderedPages,1766);
 assert.equal(s.unreadablePdfDocuments,0);assert.equal(s.reportedIssues,0);
 assert.equal(s.originalQuestionsExtracted,0,'This byte inventory is not an extraction approval');
 for(const d of p.documents){assert.equal(d.pagesRead,d.pageCount);assert.equal(d.renderedPages,d.pageCount);assert.equal(d.allowsPublicInline,false);}
});

test('combined inventory keeps historical bytes, physical containers and current completeness separate',()=>{
 const old=read('source-pdf-inventory.json'),added=read('source-pdf-additions.json'),all=read('source-pdf-inventory-all.json');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../data/source-pdf-inventory.json',import.meta.url))).digest('hex'),'8c8344fea5e0597f159b6d48f234d1a49fb8119170827928889eec16ca64f82e');
 assert.equal(old.documents.length,95);assert.equal(all.documents.length,220);assert.equal(all.summary.pageCount,3022);
 assert.deepEqual(new Set(all.documents.map(d=>d.sha256)),new Set([...old.documents,...added.documents].map(d=>d.sha256)));
 assert.equal(all.summary.zipArchiveCount,35);assert.equal(all.summary.directPdfInputCount,3);
 const containers=new Set(all.archives.map(a=>a.containerId));assert.equal(containers.size,38);
 for(const d of all.documents){assert.ok(containers.has(d.containerId));assert.equal(d.rights.allowsPublicInline,false);}
 assert.equal(all.archives.filter(a=>a.label==='09_TYT').length,2,'Different ZIP bytes may share a normalized label');
 assert.deepEqual(all.missingArchiveParts,[]);assert.deepEqual(all.requestedV2FilesNotSuppliedByExactName,[]);
});

test('all five requested book identities have complete physical page coverage without inventing a canonical SHA',()=>{
 const p=read('source-supply-status.json');assert.equal(p.noMissingNeeded,true);
 assert.equal(p.receivedFiles.length,25);assert.equal(p.verifiedRequestedBookIdentities.length,5);
 assert.deepEqual(p.verifiedRequestedBookIdentities.map(b=>b.actualAvailablePages).sort((a,b)=>a-b),[12,16,54,416,416]);
 for(const b of p.verifiedRequestedBookIdentities){assert.equal(b.physicalPageCoverageComplete,true);assert.equal(b.canonicalWholeFileShaVerified,false);}
 assert.equal(fs.readFileSync(new URL('../docs/MISSING_SOURCE_FILES.txt',import.meta.url),'utf8'),'');
});

test('new public source metadata contains no private source bodies, images, credentials or local paths',()=>{
 const forbidden=new Set(['path','filePath','pdfPath','privatePath','fileId','prompt','options','answer','answers','solution','solutionSteps','rawSourceText','pageText','image','imagePath','cropPath']);
 const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){assert.equal(forbidden.has(k),false,k);visit(x);}else if(typeof v==='string')assert.doesNotMatch(v,/\/workspace\/|\/tmp\/|data:image\/|data:application\/pdf/);};
 for(const p of ['source-pdf-additions.json','source-pdf-inventory-all.json','source-supply-status.json'])visit(read(p));
});

test('archive traversal, reused bytes, page duplicates and private extraction gates are regression tested',()=>{
 for(const file of ['ingest_source_additions.py','build_combined_source_inventory.py','audit_source_page_overlap.py','extract_private_catalog_additions.py','extract_private_v2_books.py','capture_reviewed_source_regions.py']){
  const r=spawnSync('python3',['scripts/'+file,'--self-test'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(r.status,0,file+': '+(r.stderr||r.stdout));
 }
});
