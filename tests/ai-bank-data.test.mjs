import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {AI_BANK, ORIGINAL_INDEX_SUMMARY} from '../data/ai-bank.js';
import {QUESTION_BANK} from '../data/question-bank.js';
import {aiDerivationKind,createAiRegistry} from '../shared/ai-bank.js';

const read = file => JSON.parse(fs.readFileSync(new URL('../data/ai/' + file, import.meta.url), 'utf8'));
const registry = createAiRegistry(AI_BANK);
const archive = read('archive-input.json');
const summary = read('bank-summary.json');
const batches = read('batch-manifest.json');
const preserved = read('preserved-1408.json');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

test('all 1408 previously usable AI records keep their exact content and remain playable', () => {
  assert.equal(preserved.schemaVersion,1);
  assert.equal(preserved.count,1408);
  assert.equal(preserved.questions.length,1408);
  assert.equal(new Set(preserved.questions.map(row=>row.id)).size,1408);
  const rawById=new Map(AI_BANK.questions.map(row=>[row.id,row]));
  for (const previous of preserved.questions) {
    assert.ok(rawById.has(previous.id),previous.id + ': previously published AI record removed');
    assert.equal(hash(rawById.get(previous.id)),previous.recordHash,previous.id + ': existing content or provenance changed');
    assert.ok(registry.getQuestion(previous.id),previous.id + ': existing usable exercise lost eligibility');
  }
  for (const [name,expected] of Object.entries(preserved.sourceContentHashes)) {
    assert.ok(['imported','generated'].includes(name));
    const actual=crypto.createHash('sha256').update(fs.readFileSync(new URL('../data/ai/' + name + '.js',import.meta.url))).digest('hex');
    assert.equal(actual,expected,name + ': legacy static catalog was rewritten');
  }
});

test('all archive records survive exactly once, apart from the original reference index', () => {
  assert.equal(archive.length, 1165);
  assert.equal(new Set(archive.map(row => row.id)).size, 1165);
  const imported = registry.allQuestions.filter(row => row.pool === 'imported');
  assert.deepEqual(imported.map(row => row.id).sort(), archive.map(row => row.id).sort());
  assert.equal(imported.filter(row => row.examType === 'TYT').length, 647);
  assert.equal(imported.filter(row => row.examType === 'AYT').length, 518);
  assert.equal(registry.allQuestions.length, new Set(registry.allQuestions.map(row => row.id)).size);
  const inputById = new Map(archive.map(row => [row.id, row]));
  for (const row of imported) {
    assert.equal(row.prompt, inputById.get(row.id).prompt, row.id + ': archive prose must not be silently rewritten');
    assert.deepEqual(row.provenance, inputById.get(row.id).provenance);
  }
});

test('AI bank cannot become a licensed original or a claimed official exam', () => {
  assert.equal(QUESTION_BANK.questions.length, 0);
  assert.deepEqual(ORIGINAL_INDEX_SUMMARY, {sourceCount:8,pageReferenceCount:185,examIndexCount:480,inlineQuestionCount:0});
  assert.equal(Object.keys(read('original-index.json').kaynaklar).length, 8);
  assert.equal(read('original-index.json').kayitlar.length, 185);
  for (const row of registry.allQuestions) {
    assert.equal(row.origin, 'AI_URETIMI');
    assert.equal(row.verification.editorialStatus, 'pending');
    assert.equal(row.answer?.status, undefined, 'No official answer stamp may be invented');
    assert.equal(row.displayMode, undefined);
    assert.equal(row.license, undefined);
  }
});

test('generated lineage resolves to the declared AI archive or verified original source and keeps flagged imports out', () => {
  const importedIds = new Set(archive.map(row => row.id));
  const evidence = new Map((AI_BANK.sourceEvidence || []).map(row=>[row.id,row]));
  const flaggedIds = new Set(archive.filter(row => row.reviewFlags?.length).map(row => row.id));
  for (const row of registry.allQuestions.filter(row => row.pool === 'generated')) {
    if (aiDerivationKind(row)==='ORIGINAL_TO_AI') {
      const proof=evidence.get(row.provenance.sourceReadEvidenceId);
      assert.ok(proof,row.id + ': missing actual original read evidence');
      assert.equal(row.parentQuestionId,proof.sourceQuestionId);
      assert.equal(row.provenance.sourceDocumentId,proof.sourceDocumentId);
      assert.equal(row.provenance.physicalPage,proof.physicalPage);
      assert.equal(row.provenance.originalPdfPage,proof.originalPdfPage);
      assert.equal(row.provenance.sourceQuestionNumber,proof.questionNumber);
    } else {
      assert.equal(aiDerivationKind(row),'AI_TO_AI');
      assert.ok(importedIds.has(row.parentQuestionId), row.id + ': missing accessible AI parent');
    }
    assert.ok(['easy','medium','hard'].includes(row.difficulty));
    assert.ok(row.templateId);
    assert.ok(row.familyId);
  }
  for (const row of registry.questions) assert.equal(flaggedIds.has(row.id), false, row.id + ': archive flags must not be dismissed');
  assert.ok(registry.questions.some(row => row.examType === 'TYT'));
  assert.ok(registry.questions.some(row => row.examType === 'AYT'));
  assert.ok(registry.questions.some(row => row.difficulty === 'easy'));
  assert.ok(registry.questions.some(row => row.difficulty === 'medium'));
  assert.ok(registry.questions.some(row => row.difficulty === 'hard'));
});

test('original-derived AI read evidence is metadata-only and binds to actual supplied PDF bytes', () => {
  const inventory=JSON.parse(fs.readFileSync(new URL('../data/source-pdf-inventory.json',import.meta.url),'utf8'));
  const documents=new Map(inventory.documents.map(row=>[row.id,row]));
  const evidence=AI_BANK.sourceEvidence || [];
  const referenced=new Set(registry.allQuestions.filter(row=>aiDerivationKind(row)==='ORIGINAL_TO_AI').map(row=>row.provenance.sourceReadEvidenceId));
  for (const id of referenced) assert.ok(evidence.some(row=>row.id===id),'Every original-derived child must resolve to a checked source proof');
  for (const proof of evidence) {
    const document=documents.get(proof.sourceDocumentId);
    assert.ok(document,proof.id + ': original PDF is absent from supplied-byte inventory');
    assert.equal(proof.sha256,document.sha256);
    assert.equal(proof.origin,'ORIJINAL');
    assert.equal(proof.readStatus,'read');
    assert.equal(proof.answerStatus,'verified');
    assert.equal(proof.publishable,false);
    assert.ok(Number.isInteger(proof.physicalPage) && proof.physicalPage>=1 && proof.physicalPage<=document.pageCount);
    for (const field of ['prompt','text','options','solution','solutionSteps','image','imagePath','pdfPath','pdfBytes']) assert.equal(proof[field],undefined,'Private original body must not enter public read metadata');
  }
  assert.equal(registry.lineageStats.AI_ARCHIVE_IMPORT + registry.lineageStats.AI_TO_AI + registry.lineageStats.ORIGINAL_TO_AI,registry.stats.usable);
  for (const row of registry.questions.filter(row=>row.derivationKind==='ORIGINAL_TO_AI')) {
    assert.equal(row.pool,'generated');
    assert.equal(row.origin,'AI_URETIMI');
    assert.ok(registry.sourceEvidence.some(proof=>proof.id===row.provenance.sourceReadEvidenceId));
  }
});

test('public exercise counts match eligibility, quarantine and mathematical checks', () => {
  assert.equal(summary.existing, 1165);
  assert.equal(summary.stagedTotal, registry.stats.total);
  assert.equal(summary.totalUsableUnique, registry.stats.usable);
  assert.equal(summary.pendingReview, registry.stats.pending);
  assert.equal(summary.duplicateExcluded, registry.stats.duplicates);
  assert.equal(summary.stagedTotal, summary.totalUsableUnique + summary.pendingReview + summary.duplicateExcluded);
  assert.equal(summary.newTYT, registry.allQuestions.filter(row => row.pool === 'generated' && row.examType === 'TYT').length);
  assert.equal(summary.newAYT, registry.allQuestions.filter(row => row.pool === 'generated' && row.examType === 'AYT').length);
  assert.equal(summary.mathematicsPassed, registry.allQuestions.filter(row => row.verification.mathPassed).length);
  assert.equal(summary.mathematicsNotPassed, summary.stagedTotal - summary.mathematicsPassed);
  const playableProblems = registry.issues.filter(issue => registry.getQuestion(issue.id));
  assert.deepEqual(playableProblems, []);
  const uniqueShapes = new Set();
  const uniqueTasks = new Set();
  for (const row of registry.questions) {
    const shape = row.prompt.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim().replace(/(?<![a-z])\d+(?:[.,]\d+)?/g, '#');
    assert.equal(uniqueShapes.has(shape), false, row.id + ': constants-only near clone must be quarantined');
    uniqueShapes.add(shape);
    if (row.semanticSimilarityGroup) {
      assert.equal(uniqueTasks.has(row.semanticSimilarityGroup), false, row.id + ': repeated symbolic task must be quarantined');
      uniqueTasks.add(row.semanticSimilarityGroup);
    }
  }
});

test('resumable manifests cover every staged ID exactly once and retain exclusion reasons', () => {
  const manifestIds = batches.batches.flatMap(batch => batch.ids);
  assert.deepEqual(manifestIds.slice().sort(), registry.allQuestions.map(row => row.id).sort());
  assert.equal(new Set(manifestIds).size, manifestIds.length);
  assert.ok(batches.batches.every(batch => batch.status === 'audited' && /^[a-f0-9]{64}$/.test(batch.contentHash)));
  const ledger = read('review-ledger.json');
  assert.equal(ledger.duplicates.length, summary.duplicateExcluded);
  assert.equal(ledger.pending.length, summary.pendingReview);
  const allIds = new Set(registry.allQuestions.map(row => row.id));
  for (const duplicate of ledger.duplicates) {
    assert.ok(allIds.has(duplicate.id));
    assert.ok(allIds.has(duplicate.duplicateOf));
    assert.notEqual(duplicate.id, duplicate.duplicateOf);
  }
  for (const row of registry.allQuestions) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(canonical({options:row.options,prompt:row.prompt}))).digest('hex');
    assert.equal(row.contentHash, hash, row.id + ': content changed after audit');
  }
});
