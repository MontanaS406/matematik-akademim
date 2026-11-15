import test from 'node:test';
import assert from 'node:assert/strict';
import {aiDerivationKind,createAiRegistry} from '../shared/ai-bank.js';
import {normalizeState} from '../shared/learning-state.js';

// Test-only fixtures never enter either production question pool.
const fixture = (id = 'test-ai-1', extra = {}) => ({
  id, examType: 'TYT', courseId: 'fractions', topic: 'Kesirler',
  subtopic: 'Kesirlerde dört işlem', difficulty: 'easy', prompt: 'TEST ONLY: 1/4 + 1/4 değeri kaçtır?',
  options: [{id:'A',text:'1/2'}, {id:'B',text:'1/4'}, {id:'C',text:'3/4'}, {id:'D',text:'1'}, {id:'E',text:'2'}],
  answer: {value:'A',computedValue:'0.5',solution:'Paydalar eşit olduğundan paylar toplanır: 2/4 = 1/2.'},
  solutionSteps: ['Paydalar aynı: 1/4 + 1/4 = 2/4.', 'Pay ve paydayı 2 ile böl: 1/2.'],
  origin: 'AI_URETIMI', pool:'imported', parentQuestionId:null,
  verification: {status:'automated_verified',mathPassed:true,methods:['fraction-arithmetic','decimal-cross-check'],reasons:[],editorialStatus:'pending'},
  ...extra
});
const bank = (...questions) => ({schemaVersion:1,questions});
const pending = (question, extra={}) => ({...question, verification:{...question.verification,status:'pending_review',mathPassed:false,reasons:['independent_check_required'],...extra}});
const sourceEvidence = (extra={}) => ({
  id:'TEST-READ-EVIDENCE', sourceQuestionId:'ORIG-test-document-P1-Q2', sourceDocumentId:'TEST-SOURCE-DOCUMENT',
  sha256:'a'.repeat(64), physicalPage:1, originalPdfPage:275, questionNumber:2,
  origin:'ORIJINAL', readStatus:'read', answerStatus:'verified', publishable:false, ...extra
});
const sourceDerived = (extra={}) => fixture('test-direct-original', {
  pool:'generated', parentQuestionId:sourceEvidence().sourceQuestionId,
  provenance:{derivationKind:'ORIGINAL_TO_AI',sourceQuestionId:sourceEvidence().sourceQuestionId,
    sourceDocumentId:sourceEvidence().sourceDocumentId,sourceReadEvidenceId:sourceEvidence().id,
    physicalPage:1,originalPdfPage:275,sourceQuestionNumber:2}, ...extra
});

test('AI registry exposes only automatically checked rows and keeps pending records inspectable', () => {
  const usable = fixture();
  const waiting = pending(fixture('test-waiting'));
  const duplicate = fixture('test-duplicate',{duplicateOf:usable.id});
  const registry = createAiRegistry(bank(usable,waiting,duplicate));
  assert.deepEqual(registry.stats,{total:3,usable:1,pending:1,duplicates:1,TYT:1,AYT:0});
  assert.equal(registry.allQuestions.length,3);
  assert.deepEqual(registry.questions.map(q=>q.id),[usable.id]);
  assert.equal(registry.getQuestion(waiting.id),null);
  assert.equal(registry.getQuestion(duplicate.id),null);
  assert.equal(registry.getQuestion(usable.id).origin,'AI_URETIMI');
  assert.equal(registry.getQuestion(usable.id).verification.editorialStatus,'pending');
  assert.equal(registry.getQuestion('__proto__'),null);
});

test('all eligibility gates fail closed without deleting the supplied review row', () => {
  const base=fixture();
  const invalid = [
    {...base,verification:{...base.verification,status:'pending_review'}},
    {...base,verification:{...base.verification,mathPassed:false}},
    {...base,verification:{...base.verification,reasons:['exam_boundary_review']}},
    {...base,verification:{...base.verification,methods:['only-one-method']}},
    {...base,verification:{...base.verification,methods:['same','same']}},
    {...base,verification:{...base.verification,methods:['same',' SAME ']}},
    {...base,verification:{...base.verification,editorialStatus:'approved'}},
    {...base,verification:{...base.verification,reasons:'none'}},
    {...base,verification:{...base.verification,reasons:[{label:'ignore this error'}]}},
    {...base,verification:{...base.verification,methods:[{},{}]}},
    {...base,verification:{...base.verification,status:'human_approved'}},
    {...base,verification:{...base.verification,mathPassed:'true'}},
    {...base,origin:'ORIJINAL'},
    {...base,examType:'KPSS'},
    {...base,courseId:'not-a-course'},
    {...base,difficulty:'very-hard'},
    {...base,pool:'untrusted'},
    {...base,pool:'generated',parentQuestionId:null},
    {...base,parentQuestionId:'<script>'},
    {...base,id:'<script>'},
    {...base,id:'a'.repeat(101)},
    {...base,prompt:' '},
    {...base,prompt:'x'.repeat(12001)},
    {...base,subtopic:''},
    {...base,options:base.options.slice(1)},
    {...base,options:base.options.map((o,i)=>i===4?{...o,id:'D'}:o)},
    {...base,options:base.options.map((o,i)=>i===4?{...o,text:'0.5'}:o)},
    {...base,answer:{...base.answer,value:'F'}},
    {...base,answer:{...base.answer,computedValue:'3/4'}},
    {...base,answer:{...base.answer,computedValue:Infinity}},
    {...base,answer:{...base.answer,solution:''}},
    {...base,solutionSteps:[]},
    {...base,solutionSteps:['']},
    {...base,duplicateOf:'bad/id'}
  ];
  for (const [index,row] of invalid.entries()) {
    const registry = createAiRegistry(bank(row));
    assert.equal(registry.allQuestions.length,1,'review row retained: '+index);
    assert.equal(registry.questions.length,0,'invalid row not playable: '+index);
    assert.equal(registry.getQuestion(row.id),null,'invalid row not addressable: '+index);
    assert.equal(registry.stats.usable,0);
  }
});

test('numeric option comparison is exact and never runs a JavaScript expression', () => {
  for (const value of ['1/2','0.50','0,5',0.5,' 2 / 4 ']) {
    assert.equal(createAiRegistry(bank(fixture('test-half',{answer:{...fixture().answer,computedValue:value}}))).questions.length,1);
  }
  const row=fixture('test-code');
  row.answer.computedValue='globalThis.__aiBankExecuted = true';
  assert.equal(createAiRegistry(bank(row)).questions.length,0);
  assert.equal(globalThis.__aiBankExecuted,undefined);
  const distinct=fixture('test-exact',{options:[{id:'A',text:'9007199254740993'},{id:'B',text:'9007199254740992'},{id:'C',text:'1'},{id:'D',text:'2'},{id:'E',text:'3'}],answer:{...fixture().answer,computedValue:'9007199254740993'}});
  assert.equal(createAiRegistry(bank(distinct)).questions.length,1,'large integers must not round together');
});

test('filters compose across exam, course, subtopic, difficulty and separate AI pools', () => {
  const rows=[
    fixture('test-import'),
    fixture('test-generated',{pool:'generated',parentQuestionId:'archive-parent',difficulty:'hard'}),
    fixture('test-ayt',{examType:'AYT',courseId:'functions',topic:'Fonksiyonlar',subtopic:'Bileşke',difficulty:'medium'}),
    fixture('test-null',{difficulty:null})
  ];
  const registry=createAiRegistry(bank(...rows));
  assert.deepEqual(registry.stats,{total:4,usable:4,pending:0,duplicates:0,TYT:3,AYT:1});
  assert.equal(registry.getQuestions().length,4);
  assert.deepEqual(registry.getQuestions({examType:'TYT',courseId:'fractions',subtopic:rows[0].subtopic,difficulty:'hard',pool:'generated'}).map(q=>q.id),['test-generated']);
  assert.deepEqual(registry.getQuestions({difficulty:null}).map(q=>q.id),['test-null']);
  assert.equal(registry.getQuestions({pool:'ORIJINAL'}).length,0);
  assert.equal(registry.getQuestions({courseId:'missing'}).length,0);
  assert.equal(registry.getQuestions(null).length,0);
  assert.equal(registry.getQuestions({difficulty:undefined}).length,4);
});

test('duplicate identities are fully quarantined instead of resolving to an arbitrary answer', () => {
  const first=fixture('test-same');
  const second=fixture('test-same',{answer:{...first.answer,value:'B',computedValue:'1/4'}});
  const registry=createAiRegistry(bank(first,second));
  assert.equal(registry.getQuestion('test-same'),null);
  assert.equal(registry.stats.duplicates,2);
  assert.equal(registry.stats.pending,0);
  assert.ok(registry.issues.some(issue=>issue.field==='id'));
});

test('registry owns deeply frozen copies and query arrays cannot change shared eligibility', () => {
  const input=fixture();
  const registry=createAiRegistry(bank(input));
  input.answer.value='B'; input.verification.mathPassed=false; input.options[0].text='99';
  assert.equal(registry.getQuestion('test-ai-1').answer.value,'A');
  assert.equal(registry.getQuestion('test-ai-1').options[0].text,'1/2');
  assert.throws(()=>{registry.questions[0].answer.value='B'},TypeError);
  assert.throws(()=>{registry.allQuestions[0].verification.status='pending_review'},TypeError);
  assert.throws(()=>registry.getQuestions().push(input),TypeError);
  assert.throws(()=>{registry.stats.usable=42},TypeError);
});

test('old, pending and usable AI attempts stay in profile data even when progress totals filter eligibility', () => {
  const rows=[fixture(),pending(fixture('test-awaiting'))];
  const registry=createAiRegistry(bank(...rows));
  const previous={attempts:['old-retired-question','test-ai-1','test-awaiting'].map((exerciseId,index)=>({id:'test-attempt-'+index,exerciseId,courseId:'fractions',difficulty:'easy',correct:true,at:'2026-11-12T00:00:00Z'}))};
  const serialized=JSON.stringify(previous);
  const state=normalizeState(previous);
  const eligibleIds=new Set(registry.questions.map(q=>q.id));
  assert.equal(state.attempts.filter(attempt=>eligibleIds.has(attempt.exerciseId)).length,1);
  assert.equal(state.attempts.length,3);
  assert.equal(JSON.stringify(previous),serialized);
  assert.equal(normalizeState(state).attempts.length,3);
});

test('empty default bank is valid; unsupported envelopes and non-JSON cycles are rejected', () => {
  assert.deepEqual(createAiRegistry().stats,{total:0,usable:0,pending:0,duplicates:0,TYT:0,AYT:0});
  for (const input of [null,[],{}, {schemaVersion:2,questions:[]},{schemaVersion:1,questions:{}}]) assert.throws(()=>createAiRegistry(input),TypeError);
  const cyclic=fixture();cyclic.loop=cyclic;
  assert.throws(()=>createAiRegistry(bank(cyclic)),TypeError);
});

test('legacy AI lineage is explicit without claiming original PDF access', () => {
  const archive=fixture('test-archive-lineage',{provenance:{parentQuestionId:'UNSEEN-BOOK-REFERENCE',sourcePage:12,sourceQuestionNumber:1}});
  const generated=fixture('test-generated-lineage',{pool:'generated',parentQuestionId:archive.id});
  const registry=createAiRegistry(bank(archive,generated));
  assert.equal(aiDerivationKind(archive),'AI_ARCHIVE_IMPORT');
  assert.equal(aiDerivationKind(generated),'AI_TO_AI');
  assert.equal(registry.getQuestion(archive.id).derivationKind,'AI_ARCHIVE_IMPORT');
  assert.equal(registry.getQuestion(generated.id).derivationKind,'AI_TO_AI');
  assert.deepEqual(registry.lineageStats,{AI_ARCHIVE_IMPORT:1,AI_TO_AI:1,ORIGINAL_TO_AI:0});
  assert.deepEqual(registry.getQuestions({derivationKind:'AI_TO_AI'}).map(row=>row.id),[generated.id]);
  assert.equal(archive.derivationKind,undefined,'legacy input is not rewritten');
  assert.equal(generated.derivationKind,undefined);
  assert.equal(aiDerivationKind({...archive,origin:'ORIJINAL'}),null);
});

test('a direct original-derived AI exercise requires matching metadata from an actually read source', () => {
  const q=sourceDerived();
  const input={schemaVersion:1,questions:[q],sourceEvidence:[sourceEvidence()]};
  const registry=createAiRegistry(input);
  assert.equal(registry.questions.length,1);
  assert.equal(registry.questions[0].origin,'AI_URETIMI');
  assert.equal(registry.questions[0].derivationKind,'ORIGINAL_TO_AI');
  assert.equal(registry.getQuestions({derivationKind:'ORIGINAL_TO_AI'}).length,1);
  assert.equal(registry.lineageStats.ORIGINAL_TO_AI,1);
  assert.deepEqual(registry.issues,[]);
  assert.deepEqual(registry.sourceEvidence,[sourceEvidence()]);
  input.sourceEvidence[0].answerStatus='unknown';
  assert.equal(registry.sourceEvidence[0].answerStatus,'verified');
  assert.throws(()=>{registry.sourceEvidence[0].publishable=true},TypeError);
  const unknownBookPage=sourceDerived({provenance:{...q.provenance,originalPdfPage:null}});
  assert.equal(createAiRegistry({schemaVersion:1,questions:[unknownBookPage],sourceEvidence:[sourceEvidence({originalPdfPage:null})]}).questions.length,1,'do not invent a full-book page when only split-PDF location is known');
});

test('unread, unverified, ambiguous or mismatched original-source evidence fails closed', () => {
  const good=sourceDerived();
  const checks = [
    {questions:[good]},
    {questions:[good],sourceEvidence:[]},
    {questions:[good],sourceEvidence:[sourceEvidence(),sourceEvidence()]},
    {questions:[good],sourceEvidence:[sourceEvidence({id:'OTHER-READ'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({sourceQuestionId:'ORIG-other-question'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({sourceDocumentId:'OTHER-DOCUMENT'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({physicalPage:2})]},
    {questions:[good],sourceEvidence:[sourceEvidence({physicalPage:0})]},
    {questions:[good],sourceEvidence:[sourceEvidence({physicalPage:1.5})]},
    {questions:[good],sourceEvidence:[sourceEvidence({originalPdfPage:276})]},
    {questions:[good],sourceEvidence:[sourceEvidence({originalPdfPage:undefined})]},
    {questions:[good],sourceEvidence:[sourceEvidence({questionNumber:3})]},
    {questions:[good],sourceEvidence:[sourceEvidence({sha256:'claimed-hash'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({readStatus:'indexed'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({answerStatus:'unknown'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({origin:'AI_URETIMI'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({publishable:true})]},
    {questions:[good],sourceEvidence:[sourceEvidence({prompt:'TEST ONLY: original statement must not enter public evidence'})]},
    {questions:[good],sourceEvidence:[sourceEvidence({options:[]})]},
    {questions:[good],sourceEvidence:[sourceEvidence({imagePath:'/private/original.png'})]},
    {questions:[{...good,parentQuestionId:'ORIG-different-parent'}],sourceEvidence:[sourceEvidence()]},
    {questions:[{...good,provenance:{...good.provenance,sourceSha256:'b'.repeat(64)}}],sourceEvidence:[sourceEvidence()]},
    {questions:[{...good,provenance:{...good.provenance,sourceQuestionNumber:undefined}}],sourceEvidence:[sourceEvidence()]}
  ];
  for (const [index,invalid] of checks.entries()) {
    const registry=createAiRegistry({schemaVersion:1,...invalid});
    assert.equal(registry.stats.usable,0,'untrusted original claim: '+index);
    assert.equal(registry.allQuestions.length,1,'review row retained: '+index);
    assert.equal(registry.getQuestion(good.id),null);
    assert.ok(registry.issues.length,'diagnostic reason available: '+index);
  }
});

test('AI parents cannot be relabeled as direct originals or hide conflicting lineage claims', () => {
  const generated=fixture('test-false-original',{pool:'generated',parentQuestionId:'archive-parent'});
  const candidates=[
    {...generated,derivationKind:'ORIGINAL_TO_AI'},
    {...generated,parentQuestionId:'ORIG-unread-question'},
    {...generated,provenance:{derivationKind:'AI_TO_AI',sourceQuestionId:'ORIG-unread-question'}},
    {...generated,provenance:{derivationKind:'AI_TO_AI',sourceDocumentId:'unread-document'}},
    {...generated,provenance:{derivationKind:'AI_TO_AI',sourceReadEvidenceId:'unread-evidence'}},
    {...generated,derivationKind:'AI_TO_AI',provenance:{derivationKind:'ORIGINAL_TO_AI'}},
    {...generated,derivationKind:'AI_ARCHIVE_IMPORT'},
    {...generated,derivationKind:'human_original'},
    {...generated,derivationKind:null},
    {...generated,provenance:{derivationKind:'unknown'}},
    {...sourceDerived(),pool:'imported'}
  ];
  for (const candidate of candidates) assert.equal(createAiRegistry(bank(candidate)).questions.length,0,candidate.id);
  for (const invalid of [null,{},'read']) assert.throws(()=>createAiRegistry({...bank(),sourceEvidence:invalid}),TypeError);
});
