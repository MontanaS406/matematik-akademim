import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {AI_BANK} from '../data/ai-bank.js';
import {createAiRegistry} from '../shared/ai-bank.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const canonical = v => Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash = v => crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');

test('all 1557 completed PR12 questions survive byte-equivalent records and eligibility',()=>{
  const baseline=read('ai/preserved-pr12-1557.json');
  const registry=createAiRegistry(AI_BANK),raw=new Map(AI_BANK.questions.map(q=>[q.id,q]));
  assert.equal(baseline.count,1557);assert.equal(baseline.questions.length,1557);
  for(const q of baseline.questions){assert.equal(hash(raw.get(q.id)),q.recordHash,q.id);assert.ok(registry.getQuestion(q.id),q.id);}
  const moduleHash=crypto.createHash('sha256').update(fs.readFileSync(new URL('../data/source-derived-ai.js',import.meta.url))).digest('hex');
  assert.equal(moduleHash,baseline.sourceDerivedModuleHash);
});

test('source extraction reports distinguish crop candidates, keys and independent curation',()=>{
  const report=read('source-extraction-progress.json'),inventory=read('source-pdf-inventory.json');
  const s=report.summary;
  assert.equal(report.scope,'metadata_only_no_original_bodies');
  assert.equal(report.documents.length,inventory.documents.length);
  assert.equal(s.actualPdfDocuments,95);assert.equal(s.actualPdfPages,1256);
  assert.equal(s.suppliedZipParts,13);assert.equal(s.publishableOriginalQuestions,0);
  assert.equal(s.sourceQuestionRegionCandidates,report.documents.reduce((n,d)=>n+d.questionCandidates,0));
  assert.equal(s.independentlyVerifiedOriginals,report.documents.reduce((n,d)=>n+d.independentlyVerified,0));
  assert.equal(s.privateRecordsAfterCuration,s.independentlyVerifiedOriginals+s.allReviewCandidates);
  assert.ok(s.publisherAnswersCaptured>s.independentlyVerifiedOriginals);
  assert.ok(s.curatedOriginalQuestions>s.independentlyVerifiedOriginals);
  assert.equal(s.uncheckpointedQuestionPages,0);
  assert.equal(s.missingArchiveBasenamesKnown,false);
  assert.deepEqual(s.missingExactPdfNames,inventory.requestedV2FilesNotSuppliedByExactName);
  const forbidden=new Set(['prompt','options','answer','solution','solutionSteps','rawSourceText','image','cropPath','pdfPath','text']);
  const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){assert.equal(forbidden.has(k),false,k);visit(x);}else if(typeof v==='string')assert.doesNotMatch(v,/\/workspace\/|\/tmp\/|data:image/);};
  visit(report);
});

test('generation checkpoints expose the exact remaining ten-per-source work without counting drafts',()=>{
  const progress=read('source-generation-progress.json'),registry=createAiRegistry(AI_BANK);
  const evidence=new Set(AI_BANK.sourceEvidence.map(p=>p.sourceQuestionId));
  assert.equal(progress.eligibleSourceParents,evidence.size);
  assert.equal(progress.parents.length,evidence.size);
  let remaining=0,met=0;
  for(const p of progress.parents){
    assert.ok(evidence.has(p.sourceQuestionId));assert.equal(p.target,10);
    const children=registry.questions.filter(q=>q.derivationKind==='ORIGINAL_TO_AI'&&q.parentQuestionId===p.sourceQuestionId);
    assert.deepEqual(p.usableIds.slice().sort(),children.map(q=>q.id).sort());
    assert.equal(p.remaining,Math.max(0,10-children.length));remaining+=p.remaining;met+=p.remaining===0;
  }
  assert.equal(progress.parentsAtTarget,met);assert.equal(progress.remainingToTarget,remaining);
  assert.ok(progress.parentsAtTarget>=29);
});

test('private extraction and assembly reject unsafe output and false verification',()=>{
  for(const script of ['extract_meb_questions.py','extract_private_mock_exams.py','extract_private_geometry.py','extract_private_publisher_questions.py','assemble_private_source_bank.py']){
    const p=spawnSync('python3',['scripts/'+script,'--self-test'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
    assert.equal(p.status,0,script+': '+(p.stderr||p.stdout));
  }
});
