import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {AI_BANK, ORIGINAL_INDEX_SUMMARY} from '../data/ai-bank.js';
import {QUESTION_BANK} from '../data/question-bank.js';
import {createAiRegistry} from '../shared/ai-bank.js';

const read = file => JSON.parse(fs.readFileSync(new URL('../data/ai/' + file, import.meta.url), 'utf8'));
const registry = createAiRegistry(AI_BANK);
const archive = read('archive-input.json');
const summary = read('bank-summary.json');
const batches = read('batch-manifest.json');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;

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

test('generated lineage resolves to an accessible AI body and imports with flags stay out', () => {
  const importedIds = new Set(archive.map(row => row.id));
  const flaggedIds = new Set(archive.filter(row => row.reviewFlags?.length).map(row => row.id));
  for (const row of registry.allQuestions.filter(row => row.pool === 'generated')) {
    assert.ok(importedIds.has(row.parentQuestionId), row.id + ': missing accessible parent');
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
