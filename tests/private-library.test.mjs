import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {validatePrivateMetadata,normalizePrivateAnswerKey,preparePrivatePdf,sanitizePrivateFilename,openPrivateLibrary,MAX_PRIVATE_PDF_BYTES} from '../shared/private-library.js';
const metadata=()=>({examType:'TYT',year:2024,sourceTitle:'Kullanıcıya ait resmî kitapçık',sourceUrl:'https://www.osym.gov.tr/source',mathStartPage:23,questionCount:40,bookletId:'tyt-2024'});
test('private metadata is bounded and never treats caller claims as source verification',()=>{
 const value=validatePrivateMetadata({...metadata(),verified:true,public:true,apiKey:'not-stored'});assert.deepEqual(value,{...metadata(),questionNumbers:Array.from({length:40},(_,i)=>i+1)});assert.equal(value.verified,undefined);
 for(const patch of [{examType:'fake'},{year:2017},{year:2027},{sourceTitle:''},{questionCount:0},{questionCount:101},{mathStartPage:0},{mathStartPage:1001},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://user:password@example.test'}])assert.throws(()=>validatePrivateMetadata({...metadata(),...patch}));
 assert.equal(validatePrivateMetadata({...metadata(),examType:'OTHER',year:null}).year,null);
});
test('typed answer keys have exact counts and cannot promote themselves to official provenance',()=>{
 assert.deepEqual(normalizePrivateAnswerKey({value:' a b c d e ',verified:true,provenance:'official'},5),{value:'ABCDE',provenance:'user-entered',verified:false});
 assert.equal(normalizePrivateAnswerKey(null,40),null);for(const key of ['A'.repeat(39),'A'.repeat(41),'A'.repeat(39)+'Z','A'.repeat(39)+'1'])assert.throws(()=>normalizePrivateAnswerKey(key,40));
});
test('private PDF validates bytes, forces PDF MIME and yields stable deduplication identity',async()=>{
 const bytes='%PDF-1.4\n<script>parent.probe=true</script>\n%%EOF';const one=await preparePrivatePdf(new Blob([bytes],{type:'text/html'}),webcrypto),two=await preparePrivatePdf(new Blob([bytes],{type:'image/svg+xml'}),webcrypto);
 assert.equal(one.blob.type,'application/pdf');assert.equal(one.sha256,two.sha256);assert.match(one.sha256,/^[a-f0-9]{64}$/);assert.equal(await one.blob.text(),bytes);
 await assert.rejects(preparePrivatePdf(new Blob(['<script>bad()</script>'],{type:'application/pdf'}),webcrypto),/Geçerli bir PDF/);
 await assert.rejects(preparePrivatePdf(new Blob([new Uint8Array(MAX_PRIVATE_PDF_BYTES+1)]),webcrypto),/50 MB/);
});
test('owner and filenames cannot be interpreted as paths or arbitrary storage selectors',()=>{
 for(const owner of ['',null,'../bob','alice@example.test'])assert.throws(()=>openPrivateLibrary(owner));
 assert.equal(sanitizePrivateFilename('../evil<script>.html'), '_evil_script_.html.pdf');assert.equal(sanitizePrivateFilename('TYT.pdf'),'TYT.pdf');assert.ok(!/[\\/\u0000-\u001f]/.test(sanitizePrivateFilename('a/b\\c\u0000.pdf')));
});
test('progress whitelist preserves answers/timing and never stores tokens or forged verification',async()=>{
 const {normalizePrivateProgress}=await import('../shared/private-library.js');
 const now=100000,progress={answers:['A',null],index:0,flags:[true,false],topics:['Sayılar','fabricated'],startedAt:10000,pausedAt:null,pausedMs:2000,finishedDuration:88,finishedAt:new Date(now).toISOString(),limitSeconds:3600,score:{correct:1,wrong:0,blank:1,net:1,verified:true},access_token:'not-stored'};
 const result=normalizePrivateProgress(progress,2,now);assert.equal(result.answers[0],'A');assert.deepEqual(result.topics,['Sayılar',null]);assert.equal(result.access_token,undefined);assert.equal(result.score.verified,undefined);
 for(const patch of [{answers:['A']},{index:2},{pausedAt:200000},{pausedMs:-1},{finishedAt:null},{score:{correct:2,wrong:0,blank:0,net:100}}])assert.throws(()=>normalizePrivateProgress({...progress,...patch},2,now));
 assert.equal(normalizePrivateProgress(null,2,now),null);
});
test('private progress retains explicit user page mappings without inventing unmapped positions',async()=>{
 const {normalizePrivateProgress}=await import('../shared/private-library.js');const value={answers:['A',null],index:0,startedAt:1000,pausedAt:null,pausedMs:0,pdfPage:24,questionPages:[24,null]};const saved=normalizePrivateProgress(value,2,10000);assert.equal(saved.pdfPage,24);assert.deepEqual(saved.questionPages,[24,null]);assert.throws(()=>normalizePrivateProgress({...value,questionPages:[0,null]},2,10000));
});

test('KPSS Lisans private storage shares the model type and keeps a thirty-answer key unverified',async()=>{
 const {PRIVATE_EXAM_TYPES}=await import('../shared/private-library.js');const model=await import('../shared/private-exam.js');assert.equal(PRIVATE_EXAM_TYPES,model.PRIVATE_EXAM_TYPES);assert.ok(PRIVATE_EXAM_TYPES.includes('KPSS_LISANS'));const value=validatePrivateMetadata({...metadata(),examType:'KPSS_LISANS',year:2026,questionCount:30,sourceUrl:null,bookletId:null,verified:true});assert.equal(value.examType,'KPSS_LISANS');assert.equal(value.sourceUrl,null);assert.equal(value.verified,undefined);assert.deepEqual(value.questionNumbers,Array.from({length:30},(_,i)=>i+1));const key=normalizePrivateAnswerKey({value:'A'.repeat(30),verified:true},value.questionCount);assert.equal(key.verified,false);assert.equal(key.provenance,'user-entered');
});
