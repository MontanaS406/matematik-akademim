import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQuestionBank,createQuestionRegistry,getEligibleQuestions,getPublishedQuestionById,verifiedExam} from '../shared/question-bank.js';
// Synthetic content appears only inside tests and is never imported by the app.
const fixture=()=>({sources:[{id:'test-book',publisher:'Test publisher',name:'Test source',title:'Test title',year:2024,examType:null,originalUrl:'https://source.example/book',license:{status:'verified',name:'Test reuse permission',url:'https://source.example/license',allowsInline:true,allowsEmbed:false,attribution:'Test-only attribution'},verification:{status:'verified',checkedAt:'2026-11-07T00:00:00Z',evidenceUrl:'https://source.example/book'}}],questions:[{id:'test-question',sourceId:'test-book',examType:null,year:2024,section:'1.1',page:null,number:'1',courseId:'equations',topic:'Denklemler',difficulty:null,prompt:'Synthetic test prompt',options:[],answer:{value:'test answer',status:'verified',evidenceUrl:'https://source.example/answers'},displayMode:'inline',status:'published'}]});
const official=()=>{
 const bank=fixture(),source=bank.sources[0];source.publisher='ÖSYM';source.cancelledNumbers=[];source.coverage={complete:true,mathQuestionCount:40};source.verification.correctionsCheckedAt='2026-11-07T00:00:00Z';source.verification.correctionsEvidenceUrl='https://www.osym.gov.tr/corrections';source.examType='TYT';source.originalUrl='https://dokuman.osym.gov.tr/test.pdf';source.verification.evidenceUrl='https://www.osym.gov.tr/test';
 bank.questions=Array.from({length:40},(_,i)=>({...structuredClone(bank.questions[0]),id:'test-q-'+(i+1),number:String(i+1),examType:'TYT',options:'ABCDE'.split('').map(id=>({id,text:'Test '+id})),answer:{value:'A',status:'verified',evidenceUrl:'https://dokuman.osym.gov.tr/test.pdf'}}));return bank;
};
test('empty bank never fills missing subjects with generated content',()=>{
 const bank={sources:[],questions:[]};assert.deepEqual(validateQuestionBank(bank),[]);assert.deepEqual(getEligibleQuestions(bank,{courseId:'equations'}),[]);assert.equal(getPublishedQuestionById(bank,'unknown'),null);assert.equal(verifiedExam(bank,'TYT',2024),null);
});
test('approved records retain original content, source and answer evidence with immutable snapshots',()=>{
 const data=fixture(),registry=createQuestionRegistry(data);assert.equal(registry.questions.length,1);assert.equal(registry.getQuestion('test-question').source.publisher,'Test publisher');assert.equal(registry.getQuestion('test-question').prompt,'Synthetic test prompt');
 assert.equal(registry.getQuestions({difficulty:'hard'}).length,0);assert.equal(registry.getQuestions({difficulty:null}).length,1);assert.equal(registry.getQuestions({courseId:'powers'}).length,0);assert.equal(registry.getQuestions({year:2023}).length,0);assert.equal(registry.getQuestions({examType:'TYT'}).length,0);
 data.questions[0].prompt='changed';assert.equal(registry.questions[0].prompt,'Synthetic test prompt');assert.throws(()=>{registry.questions[0].source.license.allowsInline=false},TypeError);
});
test('publication fails closed without independently verified source, reuse rights or answer',()=>{
 for(const mutate of [b=>b.sources[0].verification.status='pending',b=>b.sources[0].license.status='pending',b=>b.sources[0].license.allowsInline=false,b=>b.sources[0].license.attribution='',b=>b.questions[0].answer.status='pending',b=>delete b.questions[0].answer.evidenceUrl,b=>b.questions[0].status='draft',b=>b.questions[0].displayMode='embed']){
  const b=fixture();mutate(b);assert.ok(validateQuestionBank(b).length);assert.throws(()=>createQuestionRegistry(b));assert.deepEqual(getEligibleQuestions(b),[]);assert.equal(getPublishedQuestionById(b,'test-question'),null);
 }
});
test('question identity includes canonical original locator and correct source year/type',()=>{
 for(const mutate of [b=>b.questions[0].year=2023,b=>b.questions[0].examType='AYT',b=>b.questions[0].sourceId='missing',b=>{b.questions[0].section=null;b.questions[0].page=null},b=>b.questions.push({...structuredClone(b.questions[0]),id:'duplicate',number:'01',section:' 1.1 '})]){
  const b=fixture();mutate(b);assert.ok(validateQuestionBank(b).length);
 }
 const ids=fixture();ids.sources.push(structuredClone(ids.sources[0]));assert.ok(validateQuestionBank(ids).some(x=>x.path.endsWith('.id')));
});
test('untrusted URLs and fabricated answer options are rejected by the gate',()=>{
 for(const bad of ['javascript:alert(1)','http://source.example','https://user:secret@source.example']){const b=fixture();b.sources[0].originalUrl=bad;assert.ok(validateQuestionBank(b).length)}
 const b=fixture();b.questions[0].options=[{id:'A',text:'one'},{id:'A',text:'two'}];b.questions[0].answer.value='A';assert.ok(validateQuestionBank(b).length);
 b.questions[0].options=[{id:'A',text:'one'},{id:'B',text:'two'}];b.questions[0].answer.value='C';assert.ok(validateQuestionBank(b).length);
});
test('official exam requires one original complete 40-question set and official authority',()=>{
 const b=official(),exam=verifiedExam(b,'TYT',2024);assert.equal(exam.count,40);assert.equal(exam.answerKey,'A'.repeat(40));assert.deepEqual(exam.questions.map(q=>q.number),Array.from({length:40},(_,i)=>String(i+1)));
 for(const mutate of [x=>x.questions.pop(),x=>x.questions[39].number='41',x=>x.sources[0].publisher='Commercial trial',x=>x.questions[0].answer.evidenceUrl='https://unofficial.example/key',x=>x.sources[0].license.allowsInline=false,x=>delete x.sources[0].coverage,x=>x.sources[0].coverage.complete=false,x=>delete x.sources[0].verification.correctionsCheckedAt,x=>x.sources[0].verification.correctionsEvidenceUrl='https://unofficial.example/corrections',x=>x.sources[0].cancelledNumbers=[3],x=>delete x.sources[0].cancelledNumbers,x=>x.sources[0].cancelledNumbers=null,x=>x.sources[0].cancelledNumbers={}]){const changed=structuredClone(b);mutate(changed);assert.equal(verifiedExam(changed,'TYT',2024),null)}
 assert.equal(verifiedExam(b,'AYT',2024),null);assert.equal(verifiedExam(b,'TYT',2025),null);
});

test('source aliases cannot republish the same original locator under a different id',()=>{const b=fixture();b.sources.push({...structuredClone(b.sources[0]),id:'alias-source',originalUrl:'https://SOURCE.example:443/book?utm_source=duplicate#anchor'});b.questions.push({...structuredClone(b.questions[0]),id:'alias-question',sourceId:'alias-source'});assert.ok(validateQuestionBank(b).some(issue=>issue.path.endsWith('.locator')));assert.deepEqual(getEligibleQuestions(b),[])});
test('optional verified PDF and full-exam evidence metadata is checked without affecting books',()=>{const b=fixture();b.sources[0].pdfSha256='a'.repeat(64);assert.deepEqual(validateQuestionBank(b),[]);b.sources[0].pdfSha256='unsafe';assert.ok(validateQuestionBank(b).some(issue=>issue.path.endsWith('.pdfSha256')))});

test('embed-only permission does not authorize copied question text or options',()=>{const b=fixture();b.sources[0].license.allowsInline=false;b.sources[0].license.allowsEmbed=true;b.questions[0].displayMode='embed';assert.ok(validateQuestionBank(b).length);b.questions[0].prompt='';assert.deepEqual(validateQuestionBank(b),[])});
test('an unstated publication year is allowed for non-exam notes but cannot become an undated exam',()=>{const b=fixture();b.sources[0].year=null;b.questions[0].year=null;assert.deepEqual(validateQuestionBank(b),[]);b.sources[0].examType='TYT';b.questions[0].examType='TYT';assert.ok(validateQuestionBank(b).some(issue=>issue.path.endsWith('.year')))});
