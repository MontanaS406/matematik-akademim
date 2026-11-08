import test from 'node:test';import assert from 'node:assert/strict';
import {TURKISH_EXAMS,PRIVATE_EXAM_NOTICES} from '../data/turkish-exams.js';
import {verifiedOfficialKey,confirmedOfficialKeyForBooklet,trustedKeyForBooklet,scorePrivateExam} from '../shared/private-exam.js';
test('Turkish records preserve eighteen actual booklet records and correction provenance without question text',()=>{
 assert.equal(TURKISH_EXAMS.length,18);assert.equal(new Set(TURKISH_EXAMS.map(row=>row.id)).size,18);
 for(const row of TURKISH_EXAMS){assert.equal(row.questionCount,40);if(row.answerKey===null){assert.equal(row.year,2019);assert.equal(row.examType,'TYT');assert.equal(row.keyValues[6],null);assert.equal(row.keyValues.filter(v=>v!==null).length,39)}else{assert.equal(row.answerKey.length,40);assert.equal(row.keyValues.join(''),row.answerKey)}assert.deepEqual(row.questionNumbers,Array.from({length:40},(_,i)=>i+1));assert.ok(row.mathStartPage<=row.mathEndPage&&row.mathEndPage<row.answerKeyPage&&row.answerKeyPage<=row.pageCount);assert.match(row.originalUrl,new RegExp('/'+row.year+'/'));assert.ok(row.answerKeyEvidenceUrl.startsWith(row.originalUrl+'#page='));if(row.pdfSha256){assert.equal(row.year,2024);assert.match(row.pdfSha256,/^[a-f0-9]{64}$/);assert.equal(row.pdfHashVerification.sourceUrl,row.originalUrl);assert.ok(row.pdfHashVerification.byteLength>100000)}else assert.equal(row.pdfSha256,null);assert.equal(row.prompt,undefined);assert.equal(row.questions,undefined)}
});
test('sixteen uncancelled Turkish keys require either a verified file digest or explicit identity confirmation',()=>{
 const accepted=TURKISH_EXAMS.filter(verifiedOfficialKey);assert.equal(accepted.length,16);
 for(const row of accepted){const book={sha256:row.pdfSha256||'a'.repeat(64),metadata:{examType:row.examType,year:row.year,sourceTitle:row.title,sourceUrl:row.originalUrl,questionCount:40,mathStartPage:row.mathStartPage,questionNumbers:row.questionNumbers,bookletId:row.id}};
  const automatic=trustedKeyForBooklet(TURKISH_EXAMS,book);assert.equal(!!automatic,!!row.pdfSha256);assert.equal(confirmedOfficialKeyForBooklet(TURKISH_EXAMS,book,{examId:row.id,confirmed:false}),null);
  const key=automatic||confirmedOfficialKeyForBooklet(TURKISH_EXAMS,book,{examId:row.id,confirmed:true}),score=scorePrivateExam(row.answerKey.split(''),key);assert.equal(score.net,40);assert.equal(score.verified,true);assert.equal(score.fileVerified,!!row.pdfSha256);
  if(row.pdfSha256){const different={...book,sha256:'a'.repeat(64)};assert.equal(trustedKeyForBooklet(TURKISH_EXAMS,different),null);assert.equal(confirmedOfficialKeyForBooklet(TURKISH_EXAMS,different,{examId:row.id,confirmed:true}),null)}
  const mismatched={...book,metadata:{...book.metadata,questionNumbers:[...book.metadata.questionNumbers].reverse()}};assert.equal(confirmedOfficialKeyForBooklet(TURKISH_EXAMS,mismatched,{examId:row.id,confirmed:true}),null);
 }
});
test('cancelled 2026 AYT and known 2019 TYT notices never silently use an obsolete letter',()=>{
 const cancelled=TURKISH_EXAMS.find(row=>row.year===2026&&row.examType==='AYT');assert.deepEqual(cancelled.cancelledNumbers,[23]);assert.equal(cancelled.verification.answerKeyVerified,false);assert.equal(verifiedOfficialKey(cancelled),null);assert.match(cancelled.verification.correctionsEvidenceUrl,/21072026/);
 assert.ok(PRIVATE_EXAM_NOTICES.some(row=>row.year===2019&&row.examType==='TYT'&&row.cancelledNumbers.includes(7)));
});


test('the missing 2019 AYT key uses all forty official mathematics positions without copying question text',()=>{
 const row=TURKISH_EXAMS.find(row=>row.id==='osym-2019-ayt-math');assert.ok(row);assert.equal(row.answerKey,'AEDEABDEAEBACCDADEBABCACDBDBDCCEDBACBECC');assert.deepEqual([row.pageCount,row.mathStartPage,row.mathEndPage,row.answerKeyPage],[49,26,36,49]);assert.equal(row.questionCount,40);assert.equal(row.pdfSha256,null);assert.deepEqual(row.cancelledNumbers,[]);assert.equal(row.prompt,undefined);assert.equal(row.questions,undefined);assert.equal(row.verification.answerKeyVerified,true);assert.match(row.verification.correctionsEvidenceUrl,/2019yks-sonuclari-aciklandi$/);
 const book={sha256:'b'.repeat(64),metadata:{examType:'AYT',year:2019,sourceTitle:row.title,sourceUrl:row.originalUrl,questionCount:40,mathStartPage:26,questionNumbers:row.questionNumbers,bookletId:row.id}};assert.equal(trustedKeyForBooklet(TURKISH_EXAMS,book),null);assert.equal(confirmedOfficialKeyForBooklet(TURKISH_EXAMS,book,{examId:row.id,confirmed:false}),null);const key=confirmedOfficialKeyForBooklet(TURKISH_EXAMS,book,{examId:row.id,confirmed:true});assert.equal(scorePrivateExam(row.answerKey.split(''),key).net,40);assert.equal(key.fileVerified,false);
});


test('the 2024 KPSS Lisans mathematics cancellation keeps its original question number and official evidence',()=>{
 const notice=PRIVATE_EXAM_NOTICES.find(row=>row.examType==='KPSS_LISANS'&&row.year===2024);assert.ok(notice);assert.deepEqual(notice.cancelledNumbers,[42]);assert.match(notice.scope,/31–60/);assert.match(notice.evidenceUrl,/2024kpss-lisans-genel-yetenekgenel-kultur-egitim-bilimleri-alan-bilgisi-ve-oabt-sonuclari-aciklandi$/);assert.equal(PRIVATE_EXAM_NOTICES.some(row=>row.examType==='KPSS_ONLISANS'&&row.year===2024),false);
});
