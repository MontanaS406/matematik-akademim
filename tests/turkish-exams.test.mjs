import test from 'node:test';import assert from 'node:assert/strict';
import {TURKISH_EXAMS,PRIVATE_EXAM_NOTICES} from '../data/turkish-exams.js';
import {verifiedOfficialKey,confirmedOfficialKeyForBooklet,trustedKeyForBooklet,scorePrivateExam} from '../shared/private-exam.js';
test('Turkish records preserve seventeen actual booklet records and correction provenance without question text',()=>{
 assert.equal(TURKISH_EXAMS.length,17);assert.equal(new Set(TURKISH_EXAMS.map(row=>row.id)).size,17);
 for(const row of TURKISH_EXAMS){assert.equal(row.questionCount,40);if(row.answerKey===null){assert.equal(row.year,2019);assert.equal(row.examType,'TYT');assert.equal(row.keyValues[6],null);assert.equal(row.keyValues.filter(v=>v!==null).length,39)}else{assert.equal(row.answerKey.length,40);assert.equal(row.keyValues.join(''),row.answerKey)}assert.deepEqual(row.questionNumbers,Array.from({length:40},(_,i)=>i+1));assert.ok(row.mathStartPage<=row.mathEndPage&&row.mathEndPage<row.answerKeyPage&&row.answerKeyPage<=row.pageCount);assert.match(row.originalUrl,new RegExp('/'+row.year+'/'));assert.ok(row.answerKeyEvidenceUrl.startsWith(row.originalUrl+'#page='));assert.equal(row.pdfSha256,null);assert.equal(row.prompt,undefined);assert.equal(row.questions,undefined)}
});
test('only fifteen uncancelled Turkish keys can conditionally grade a matching user-confirmed booklet',()=>{
 const accepted=TURKISH_EXAMS.filter(verifiedOfficialKey);assert.equal(accepted.length,15);
 for(const row of accepted){const book={sha256:'a'.repeat(64),metadata:{examType:row.examType,year:row.year,sourceTitle:row.title,sourceUrl:row.originalUrl,questionCount:40,mathStartPage:row.mathStartPage,questionNumbers:row.questionNumbers,bookletId:row.id}};
  assert.equal(trustedKeyForBooklet(TURKISH_EXAMS,book),null);assert.equal(confirmedOfficialKeyForBooklet(TURKISH_EXAMS,book,{examId:row.id,confirmed:false}),null);
  const key=confirmedOfficialKeyForBooklet(TURKISH_EXAMS,book,{examId:row.id,confirmed:true}),score=scorePrivateExam(row.answerKey.split(''),key);assert.equal(score.net,40);assert.equal(score.verified,true);assert.equal(score.fileVerified,false);
  const mismatched={...book,metadata:{...book.metadata,questionNumbers:[...book.metadata.questionNumbers].reverse()}};assert.equal(confirmedOfficialKeyForBooklet(TURKISH_EXAMS,mismatched,{examId:row.id,confirmed:true}),null);
 }
});
test('cancelled 2026 AYT and known 2019 TYT notices never silently use an obsolete letter',()=>{
 const cancelled=TURKISH_EXAMS.find(row=>row.year===2026&&row.examType==='AYT');assert.deepEqual(cancelled.cancelledNumbers,[23]);assert.equal(cancelled.verification.answerKeyVerified,false);assert.equal(verifiedOfficialKey(cancelled),null);assert.match(cancelled.verification.correctionsEvidenceUrl,/21072026/);
 assert.ok(PRIVATE_EXAM_NOTICES.some(row=>row.year===2019&&row.examType==='TYT'&&row.cancelledNumbers.includes(7)));
});
