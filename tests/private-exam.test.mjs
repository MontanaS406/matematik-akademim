import test from 'node:test';import assert from 'node:assert/strict';
import {PRIVATE_EXAM_TYPES,SUGGESTED_COUNTS,normalizeBookletMetadata,parseAnswerKey,verifiedOfficialKey,getTrustedExam,trustedKeyForBooklet,confirmedOfficialKeyForBooklet,scorePrivateExam} from '../shared/private-exam.js';
import {TURKISH_EXAMS} from '../data/turkish-exams.js';
// All synthetic official-looking metadata below is test-only. No question text is included.
const hash='a'.repeat(64);
const fixture=({type='TYT',count=40,sha256=hash}={})=>({id:'test-only-exam',title:'Synthetic metadata for tests only',examType:type,year:2024,questionCount:count,questionNumbers:Array.from({length:count},(_,i)=>i+1),originalUrl:'https://dokuman.osym.gov.tr/test-only.pdf',pdfSha256:sha256,answerKey:'A'.repeat(count),answerKeyEvidenceUrl:'https://dokuman.osym.gov.tr/test-only-key.pdf',scoringPolicy:'four-wrong-one-correct',cancelledNumbers:[],verification:{status:'verified',answerKeyVerified:true,coverageVerified:true,checkedAt:'2026-01-01T00:00:00Z',correctionsCheckedAt:'2026-01-01T00:00:00Z',correctionsEvidenceUrl:'https://www.osym.gov.tr/test-only-corrections'}});
const metadata=(extra={})=>({examType:'TYT',year:2024,sourceTitle:'My private source',sourceUrl:'https://www.osym.gov.tr/test-only',questionCount:40,mathStartPage:1,bookletId:'test-only-exam',...extra});
const book=(extra={})=>({id:'private-test-book',sha256:hash,metadata:metadata(),...extra});

test('private booklet metadata preserves variable counts without asserting official completeness',()=>{
 assert.equal(PRIVATE_EXAM_TYPES.length,9);assert.equal(SUGGESTED_COUNTS.ALES,50);
 const m=normalizeBookletMetadata(metadata({examType:'DGS',questionCount:'50',year:'2026',mathStartPage:'12',verified:true,answerKey:'fake'}));
 assert.equal(m.questionCount,50);assert.equal(m.mathStartPage,12);assert.equal(m.year,2026);assert.equal(m.verified,undefined);assert.equal(m.answerKey,undefined);
 assert.equal(normalizeBookletMetadata(metadata({examType:'OTHER',year:null,questionCount:7})).year,null);
 for(const patch of [{examType:'FAKE'},{questionCount:0},{questionCount:101},{questionCount:true},{questionCount:[40]},{year:2027},{year:[2024]},{year:null},{mathStartPage:0},{mathStartPage:1.5},{sourceTitle:''},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://user:pass@source.example'},{bookletId:'<script>'}])assert.throws(()=>normalizeBookletMetadata(metadata(patch)),TypeError);
});
test('imported user keys are exact-count, strict alphabet and never acquire claimed verification',()=>{
 for(const n of [1,30,40,50,100]){const p=parseAnswerKey('a '.repeat(n),n);assert.equal(p.key,'A'.repeat(n));assert.equal(p.verified,false);assert.equal(p.provenance,'user-entered')}
 assert.equal(parseAnswerKey({key:'A'.repeat(40),verified:true,provenance:'official-source'},40).verified,false);
 for(const bad of ['A'.repeat(39),'A'.repeat(41),'A'.repeat(39)+'F','A,'.repeat(20),'1.A '.repeat(40)])assert.throws(()=>parseAnswerKey(bad,40));
 assert.throws(()=>parseAnswerKey(null,40));assert.throws(()=>parseAnswerKey('A',0));
});
test('source-key verification requires complete official evidence, correction audit and supported cancellation policy',()=>{
 const f=fixture();assert.ok(verifiedOfficialKey(f));assert.ok(getTrustedExam([f],f.id));assert.equal(getTrustedExam([f,f],f.id),null);
 for(const mutate of [x=>x.verification.status='pending',x=>x.verification.answerKeyVerified=false,x=>x.verification.coverageVerified=false,x=>delete x.verification.correctionsCheckedAt,x=>x.verification.correctionsEvidenceUrl='https://not-osym.example/key',x=>x.originalUrl='https://osym.gov.tr.evil.example/doc',x=>x.answerKeyEvidenceUrl='http://www.osym.gov.tr/key',x=>x.questionNumbers.pop(),x=>x.questionNumbers[3]=2,x=>x.answerKey='A'.repeat(39),x=>x.cancelledNumbers=[7],x=>delete x.cancelledNumbers,x=>x.scoringPolicy='unknown',x=>x.pdfSha256='not-a-hash']){const bad=structuredClone(f);mutate(bad);assert.equal(verifiedOfficialKey(bad),null)}
 assert.equal(verifiedOfficialKey(fixture({count:30})),null);
 assert.ok(verifiedOfficialKey(fixture({type:'KPSS_LISANS',count:30})));assert.ok(verifiedOfficialKey(fixture({type:'KPSS_ONLISANS',count:30})));
 assert.ok(verifiedOfficialKey(fixture({type:'ALES',count:50})));
 assert.ok(verifiedOfficialKey(fixture({type:'DGS',count:50})));
 assert.ok(verifiedOfficialKey(fixture({sha256:null})),'a key may be reviewed even when file identity lacks a known digest');
});
test('automatic scoring requires a branded key bound to matching actual private booklet metadata and file hash',()=>{
 const f=fixture(),answers=['A','B',...Array(38).fill(null)],key=trustedKeyForBooklet([f],book());assert.ok(key);const result=scorePrivateExam(answers,key);
 assert.equal(result.status,'scored');assert.equal(result.verified,true);assert.equal(result.fileVerified,true);assert.equal(result.fileIdentity,'sha256');assert.equal(result.net,.75);assert.equal(result.blank,38);
 assert.equal(scorePrivateExam(answers,{...key}).status,'unscored','JSON or object copies cannot forge the in-memory trust boundary');
 assert.equal(scorePrivateExam(answers,verifiedOfficialKey(f)).status,'unscored','source facts alone do not certify a local file');
 for(const b of [book({sha256:'b'.repeat(64)}),book({metadata:metadata({year:2025})}),book({metadata:metadata({examType:'AYT'})}),book({metadata:metadata({questionCount:30})}),book({metadata:metadata({bookletId:'unknown'})}),book({sha256:null})])assert.equal(trustedKeyForBooklet([f],b),null);
 assert.equal(trustedKeyForBooklet([fixture({sha256:null})],book()),null);
});
test('explicit source identity confirmation uses a reviewed key but never claims the PDF was independently verified',()=>{
 const f=fixture({sha256:null}),binding={examId:f.id,confirmed:true};
 const key=confirmedOfficialKeyForBooklet([f],book(),binding);assert.ok(key);const result=scorePrivateExam(Array(40).fill('A'),key);assert.equal(result.net,40);assert.equal(result.verified,true);assert.equal(result.fileVerified,false);assert.equal(result.fileIdentity,'user-confirmed');assert.match(result.reason,/kullanıcı beyanı/);
 for(const bad of [{examId:f.id,confirmed:'true'},{examId:f.id,confirmed:false},{examId:'wrong',confirmed:true},{}])assert.equal(confirmedOfficialKeyForBooklet([f],book(),bad),null);
 assert.equal(confirmedOfficialKeyForBooklet([f],book({metadata:metadata({year:2025})}),binding),null);
 assert.equal(confirmedOfficialKeyForBooklet([fixture()],book({sha256:'b'.repeat(64)}),binding),null,'a known hash conflict cannot be overridden by confirmation');
 assert.equal(scorePrivateExam(Array(40).fill('A'),{...key}).status,'unscored');
});
test('manual assessment stays explicit and distinguishes unmatched or cancelled keys from scored results',()=>{
 const answers=Array(30).fill('B'),key=parseAnswerKey('A'.repeat(30),30);
 assert.equal(scorePrivateExam(answers,key).status,'unscored');const manual=scorePrivateExam(answers,key,{manual:true});assert.equal(manual.net,-7.5);assert.equal(manual.verified,false);assert.equal(manual.fileVerified,false);assert.equal(manual.provenance,'user-entered');
 assert.equal(scorePrivateExam(Array(50).fill(null),parseAnswerKey('A'.repeat(50),50),{manual:true}).net,0);
 assert.equal(scorePrivateExam(answers,parseAnswerKey('A'.repeat(40),40),{manual:true}).net,null);
 assert.equal(scorePrivateExam(answers,{...key,cancelledNumbers:[1]},{manual:true}).status,'unscored');
 assert.equal(scorePrivateExam(['INVALID'],parseAnswerKey('A',1),{manual:true}).status,'unscored');
});
test('production Turkish metadata never contains the synthetic test exam or question content',()=>{
 assert.equal(TURKISH_EXAMS.some(row=>row.id==='test-only-exam'),false);
 for(const row of TURKISH_EXAMS){assert.equal('prompt' in row,false);assert.equal('questions' in row,false)}
});

test('KPSS Lisans uses a suggested thirty fields without granting unknown keys official status',()=>{
 assert.equal(SUGGESTED_COUNTS.KPSS_LISANS,30);assert.ok(PRIVATE_EXAM_TYPES.includes('KPSS_LISANS'));const m=normalizeBookletMetadata(metadata({examType:'KPSS_LISANS',questionCount:30,bookletId:null,sourceUrl:null}));assert.equal(m.questionCount,30);assert.deepEqual(m.questionNumbers,Array.from({length:30},(_,i)=>i+1));assert.equal(m.sourceUrl,null);assert.equal(trustedKeyForBooklet(TURKISH_EXAMS,{sha256:hash,metadata:m}),null);const key=parseAnswerKey('A'.repeat(30),30);assert.equal(scorePrivateExam(Array(30).fill('A'),key).status,'unscored');const result=scorePrivateExam(Array(30).fill('A'),key,{manual:true});assert.equal(result.net,30);assert.equal(result.verified,false);
});


test('real 2024 publisher snapshots bind by digest and reject a different private file even with confirmation',()=>{
 const known=TURKISH_EXAMS.filter(row=>row.pdfSha256);assert.deepEqual(known.map(row=>row.id),['osym-2024-tyt-math','osym-2024-ayt-math']);
 for(const row of known){
  assert.equal(row.pdfHashVerification.method,'official-https-download-sha256');assert.equal(row.pdfHashVerification.sourceUrl,row.originalUrl);assert.ok(row.pdfHashVerification.byteLength>100000);assert.match(row.pdfHashVerification.evidenceUrl,/^https:\/\/github\.com\/MontanaS406\/matematik-akademim\/actions\/runs\/42490087023$/);
  const metadata=normalizeBookletMetadata({...row,sourceTitle:row.title,sourceUrl:row.originalUrl,bookletId:row.id});const actual={sha256:row.pdfSha256,metadata};const key=trustedKeyForBooklet(TURKISH_EXAMS,actual);assert.ok(key);const scored=scorePrivateExam([row.answerKey[0],...Array(39).fill(null)],key);assert.equal(scored.net,1);assert.equal(scored.fileVerified,true);assert.equal(scored.fileIdentity,'sha256');
  const different={...actual,sha256:'0'.repeat(64)};assert.equal(trustedKeyForBooklet(TURKISH_EXAMS,different),null);assert.equal(confirmedOfficialKeyForBooklet(TURKISH_EXAMS,different,{examId:row.id,confirmed:true}),null);assert.equal(trustedKeyForBooklet(TURKISH_EXAMS,{...actual,metadata:{...metadata,examType:row.examType==='TYT'?'AYT':'TYT'}}),null);
 }
});
test('publisher digest verification does not promote other source identities or cancelled booklets',()=>{
 const row=TURKISH_EXAMS.find(row=>row.id==='osym-2023-tyt-math'),metadata=normalizeBookletMetadata({...row,sourceTitle:row.title,bookletId:row.id});const booklet={metadata,sha256:'0'.repeat(64)};
 assert.equal(row.pdfSha256,null);assert.equal(trustedKeyForBooklet(TURKISH_EXAMS,booklet),null);const key=confirmedOfficialKeyForBooklet(TURKISH_EXAMS,booklet,{examId:row.id,confirmed:true});assert.ok(key);assert.equal(key.fileVerified,false);
 for(const row of TURKISH_EXAMS.filter(row=>row.cancelledNumbers.length))assert.equal(verifiedOfficialKey(row),null);
});
