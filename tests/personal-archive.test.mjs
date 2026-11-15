import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import {personalArchiveFixture,TEST_ARCHIVE_KEY,addCompiledAytFixture} from './personal-archive-fixture.mjs';
import {decodeArchiveKey,archiveAssetUrl,decryptArchiveAsset,createPersonalArchive,scoreOriginalArchiveExam} from '../shared/personal-archive.js';

test('private source ciphertext authenticates key, resource, integrity and compressed manifest without publishing plaintext',async()=>{
 const {config,index,assets}=personalArchiveFixture(),bytes=assets.get('/'+config.index.asset);
 assert.equal(bytes.includes(Buffer.from('PrivateFixtureBook')),false);assert.equal(bytes.includes(Buffer.from('Private fixture')),false);
 const raw=await decryptArchiveAsset(bytes,TEST_ARCHIVE_KEY,config.id,'index',config.index.sha256);
 assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(raw))),index);
 await assert.rejects(decryptArchiveAsset(bytes,Buffer.alloc(32,43).toString('base64url'),config.id,'index',config.index.sha256));
 await assert.rejects(decryptArchiveAsset(bytes,TEST_ARCHIVE_KEY,config.id,'wrong-resource',config.index.sha256));
 const changed=Buffer.from(bytes);changed[changed.length-1]^=1;await assert.rejects(decryptArchiveAsset(changed,TEST_ARCHIVE_KEY,config.id,'index',config.index.sha256));
 for(const key of ['',TEST_ARCHIVE_KEY+'extra','!'.repeat(43)])assert.throws(()=>decodeArchiveKey(key));
 for(const path of ['https://other.example/x','../private/access.json','assets/personal-archive/../x','assets/personal-archive/personal-1111111111111111/index.bin?key=secret'])assert.throws(()=>archiveAssetUrl(path));
});
test('original source registry validates every page, question and full publisher-key sheet; no official or invented replacements',()=>{
 const {index}=personalArchiveFixture(),archive=createPersonalArchive(structuredClone(index));assert.equal(archive.questions.length,40);assert.equal(archive.documents.length,2);
 const exam=archive.exams[0];assert.deepEqual(scoreOriginalArchiveExam(exam,Array(40).fill('A'),archive),{correct:40,wrong:0,blank:0,net:40,total:40,isOfficial:false});
 const answers=Array(40).fill(null);answers[0]='A';answers[1]='B';assert.equal(scoreOriginalArchiveExam(exam,answers,archive).net,.75);
 assert.equal(scoreOriginalArchiveExam({...exam},answers,archive),null);assert.equal(scoreOriginalArchiveExam(exam,Array(40),archive),null);
 assert.ok(Object.isFrozen(archive.getQuestion(exam.questionIds[0])));assert.throws(()=>archive.getQuestion(exam.questionIds[0]).answer.value='B');
 for(const edit of [d=>d.questions.push(d.questions[0]),d=>d.exams[0].answerKey='B'.repeat(40),d=>d.exams[0].isOfficial=true,d=>d.questions[0].parts[0].page=2,d=>d.documents[0].pages[0].asset='../private/access.json',d=>d.counts.records=41,d=>d.questions[0].answer.status='independently_checked']){const bad=structuredClone(index);edit(bad);assert.throws(()=>createPersonalArchive(bad))}
});
test('every supplied source page is packaged as ciphertext and private scope is explicit instead of claiming all captures verified',()=>{
 const root=new URL('../',import.meta.url),config=JSON.parse(fs.readFileSync(new URL('data/personal-archive.json',root),'utf8'));
 const inventory=JSON.parse(fs.readFileSync(new URL('data/source-pdf-inventory-all.json',root),'utf8'));
 const progress=JSON.parse(fs.readFileSync(new URL('data/source-extraction-progress.json',root),'utf8')).summary;
 assert.equal(config.counts.documents,inventory.documents.length);assert.equal(config.counts.pages,inventory.documents.reduce((n,d)=>n+d.pageCount,0));
 assert.equal(config.counts.records,progress.uniqueRegionCandidatesAfterConfirmedRepeats);assert.ok(config.counts.mathematicallyChecked>=progress.independentlyVerifiedOriginals);assert.equal(config.counts.pendingReview,config.counts.records-config.counts.mathematicallyChecked);assert.equal(config.counts.sourceExams,12);assert.equal(config.counts.compiledAytExams,12);assert.equal(config.counts.exams,24);assert.equal(Object.hasOwn(config,'key'),false);
 const folder=new URL('assets/personal-archive/'+config.id+'/',root);assert.equal(fs.readdirSync(folder).filter(name=>name.endsWith('.bin')).length,config.counts.pages+1);
 const expected=Buffer.from('MAARC1\0\0');
 for(const doc of inventory.documents)for(let page=1;page<=doc.pageCount;page++){
  const target=new URL(doc.id+'-'+String(page).padStart(4,'0')+'.bin',folder),fd=fs.openSync(target,'r'),header=Buffer.alloc(8);try{assert.ok(fs.fstatSync(fd).size>36);fs.readSync(fd,header,0,8,0);assert.deepEqual(header,expected)}finally{fs.closeSync(fd)}
 }
 assert.equal(path.basename(config.index.asset),'index.bin');
});
test('compiled original AYT exams require forty distinct source records, reviewed compatibility, 31+9 quotas and per-question answer evidence',()=>{
 const {index}=personalArchiveFixture(addCompiledAytFixture),archive=createPersonalArchive(structuredClone(index)),exam=archive.exams.find(e=>e.type==='AYT');
 assert.equal(exam.questionIds.length,40);assert.equal(exam.kind,'compiled');assert.equal(archive.exams.length,2);
 assert.deepEqual(scoreOriginalArchiveExam(exam,Array(40).fill('A'),archive),{correct:40,wrong:0,blank:0,net:40,total:40,isOfficial:false});
 const incorrect=Array(40).fill(null);incorrect[0]='B';assert.equal(scoreOriginalArchiveExam(exam,incorrect,archive).net,-.25);
 for(const edit of [d=>d.compiledExams[0].questionIds[1]=d.compiledExams[0].questionIds[0],d=>d.questions[0].aytCompatibility.reviewed=false,d=>d.questions[0].answer.evidence.value='B',d=>d.questions[0].answer.evidence.page=20,d=>d.questions[0].hasChoices=false,d=>d.compiledExams[0].topicByQuestion[d.questions[0].id]='circle',d=>d.compiledExams[0].isOfficial=true]){
  const changed=structuredClone(index);edit(changed);assert.throws(()=>createPersonalArchive(changed));
 }
});
