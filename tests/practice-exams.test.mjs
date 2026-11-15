import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AI_BANK} from '../data/ai-bank.js';
import {createAiRegistry} from '../shared/ai-bank.js';
import {PRACTICE_DISTRIBUTIONS, PRACTICE_DISTRIBUTION_VERSION, practiceTopicForQuestion,
  buildPracticeExamCatalog, scorePracticeExam} from '../shared/practice-exams.js';

const registry = createAiRegistry(AI_BANK);
const catalog = buildPracticeExamCatalog(registry.questions);

test('2025 user-supplied blueprints retain exact TYT30 and AYT31+9 quotas', () => {
  const tyt = PRACTICE_DISTRIBUTIONS.TYT, ayt = PRACTICE_DISTRIBUTIONS.AYT;
  assert.equal(tyt.topics.reduce((sum, row) => sum + row.count, 0), 30);
  assert.equal(ayt.topics.filter(row => row.section === 'math').reduce((sum, row) => sum + row.count, 0), 31);
  assert.equal(ayt.topics.filter(row => row.section === 'geometry').reduce((sum, row) => sum + row.count, 0), 9);
  assert.equal(ayt.topics.find(row => row.id === 'logarithms').count, 2);
  assert.equal(tyt.topics.find(row => row.id === 'problems').count, 12);
  assert.equal(catalog.distributionVersion, PRACTICE_DISTRIBUTION_VERSION);
  assert.match(tyt.note, /30 matematik/);
});

test('every numbered exam uses its quota exactly with unique eligible IDs and the correct exam level', () => {
  assert.equal(catalog.exams.length, 221);
  assert.equal(catalog.byType.TYT.examCount, 140);
  assert.equal(catalog.byType.AYT.examCount, 81);
  for (const exam of catalog.exams) {
    assert.equal(new Set(exam.questionIds).size, exam.actualCount);
    assert.equal(exam.questionIds.length, exam.actualCount);
    assert.equal(catalog.getExam(exam.id), exam);
    assert.equal(exam.isOfficial, false);
    assert.equal(exam.origin, 'AI_URETIMI');
    assert.equal(exam.label, `${exam.number}. Deneme`);
    const counts = new Map();
    for (const id of exam.questionIds) {
      const question = registry.getQuestion(id);
      assert.ok(question);
      assert.equal(question.examType, exam.type);
      assert.equal(question.verification.mathPassed, true);
      assert.equal(practiceTopicForQuestion(question), exam.topicByQuestion[id]);
      counts.set(exam.topicByQuestion[id], (counts.get(exam.topicByQuestion[id]) || 0) + 1);
    }
    for (const row of catalog.byType[exam.type].topics) {
      assert.equal(counts.get(row.id) || 0, Math.min(row.count, row.available));
    }
  }
});

test('all 1943 matching questions occur and cross-exam reuse is both balanced and disclosed', () => {
  const globallyUsed = new Set();
  for (const type of ['TYT', 'AYT']) {
    const stats = catalog.byType[type], exams = catalog.exams.filter(exam => exam.type === type);
    const frequencies = new Map();
    for (const exam of exams) for (const id of exam.questionIds) {
      globallyUsed.add(id);
      frequencies.set(id, (frequencies.get(id) || 0) + 1);
    }
    assert.equal(frequencies.size, stats.matchedQuestionCount);
    assert.equal(stats.reusedSlots, exams.reduce((sum, exam) => sum + exam.actualCount, 0) - frequencies.size);
    for (const row of stats.topics.filter(row => row.count && row.available)) {
      const values = registry.questions.filter(q => q.examType === type && practiceTopicForQuestion(q) === row.id)
        .map(q => frequencies.get(q.id));
      assert.ok(values.every(value => value >= 1));
      assert.ok(Math.max(...values) - Math.min(...values) <= 1, `${type} ${row.id} unfair cycling`);
    }
  }
  assert.equal(globallyUsed.size, 1943);
  assert.equal(catalog.usableQuestionCount, 1998);
  assert.equal(catalog.byType.TYT.matchedQuestionCount, 954);
  assert.equal(catalog.byType.AYT.matchedQuestionCount, 989);
  assert.equal(catalog.byType.TYT.excludedQuestionIds.length, 42);
  assert.equal(catalog.byType.AYT.excludedQuestionIds.length, 13);
});

test('AYT gaps stay explicit at24/40 and are never filled with TYT, while TYT30 is complete', () => {
  for (const exam of catalog.exams.filter(exam => exam.type === 'TYT')) {
    assert.equal(exam.actualCount, 30);
    assert.equal(exam.targetCount, 30);
    assert.equal(exam.completeDistribution, true);
    assert.deepEqual(exam.shortages, []);
  }
  for (const exam of catalog.exams.filter(exam => exam.type === 'AYT')) {
    assert.equal(exam.actualCount, 24);
    assert.equal(exam.targetCount, 40);
    assert.equal(exam.completeDistribution, false);
    assert.equal(exam.shortages.reduce((sum, row) => sum + row.missing, 0), 16);
    assert.equal(exam.shortages.filter(row => row.section === 'geometry').reduce((sum, row) => sum + row.missing, 0), 9);
    assert.equal(exam.shortages.find(row => row.topicId === 'absolute').missing, 1);
  }
  const binomialAbsolute = registry.questions.filter(q => q.examType === 'AYT' && q.courseId === 'equations');
  assert.equal(binomialAbsolute.length, 13);
  assert.ok(binomialAbsolute.every(q => practiceTopicForQuestion(q) === 'counting'));
});

test('catalogue identities survive input reordering and construction does not edit bank rows', () => {
  const before = JSON.stringify(registry.questions);
  const reordered = buildPracticeExamCatalog([...registry.questions].reverse());
  assert.deepEqual(reordered.exams, catalog.exams);
  assert.deepEqual(reordered.byType, catalog.byType);
  assert.equal(JSON.stringify(registry.questions), before);
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.exams[0].questionIds));
  assert.ok(Object.isFrozen(PRACTICE_DISTRIBUTIONS.AYT.topics));
  assert.throws(() => catalog.exams[0].questionIds.pop(), TypeError);
});

test('checkpointed v1 numbered manifests remain pinned until a deliberate append-only catalogue migration', () => {
  // Do not rebaseline this file when the bank grows. Preserve these ordered IDs
  // and numbers; introduce an explicit append-only catalogue migration instead.
  // A withdrawn question disables its old set rather than replacing its meaning.
  const pinned = JSON.parse(readFileSync(new URL('../data/practice-exams-v1.json', import.meta.url), 'utf8'));
  assert.equal(pinned.schemaVersion, 1);
  assert.equal(pinned.distributionVersion, PRACTICE_DISTRIBUTION_VERSION);
  assert.equal(pinned.bankUsable, catalog.usableQuestionCount);
  assert.deepEqual(catalog.exams.map(({id, type, number, manifest, questionIds}) => ({id, type, number, manifest, questionIds})), pinned.exams);
});

test('scoring uses verified practice answers and computes net for the actual manifest size', () => {
  for (const type of ['TYT', 'AYT']) {
    const exam = catalog.exams.find(exam => exam.type === type);
    const answers = exam.questionIds.map(id => registry.getQuestion(id).answer.value);
    assert.deepEqual(scorePracticeExam(exam, answers, registry),
      {correct: exam.actualCount, wrong: 0, blank: 0, net: exam.actualCount, total: exam.actualCount, isOfficial: false});
    answers[0] = null;
    answers[1] = 'ABCDE'.split('').find(letter => letter !== registry.getQuestion(exam.questionIds[1]).answer.value);
    assert.deepEqual(scorePracticeExam(exam, answers, registry),
      {correct: exam.actualCount - 2, wrong: 1, blank: 1, net: exam.actualCount - 2.25, total: exam.actualCount, isOfficial: false});
  }
});

test('unverified, duplicate, original and malformed inputs cannot enter a catalogue', () => {
  const first = registry.questions[0];
  const invalid = [
    {...first, id:'pending', verification:{...first.verification, status:'pending_review'}},
    {...first, id:'failed', verification:{...first.verification, mathPassed:false}},
    {...first, id:'one-method', verification:{...first.verification, methods:['one']}},
    {...first, id:'unresolved', verification:{...first.verification, reasons:['review']}},
    {...first, id:'original', origin:'ORIJINAL'},
    {...first, id:'duplicate', duplicateOf:first.id},
    {...first, id:'bad-key', answer:{...first.answer, value:'F'}},
    {...first, id:'bad-options', options:first.options.slice(1)},
    {...first, id:'bad-exam', examType:'KPSS'}
  ];
  assert.equal(buildPracticeExamCatalog(invalid).exams.length, 0);
  assert.equal(buildPracticeExamCatalog([first, first]).exams.length, 0);
  assert.equal(buildPracticeExamCatalog(null).exams.length, 0);
  assert.equal(buildPracticeExamCatalog([]).byType.AYT.completeDistribution, false);
});

test('unknown, stale, modified or unscorable manifests fail closed without a result', () => {
  const exam = catalog.exams[0], answers = exam.questionIds.map(() => null);
  const changedIds = [...exam.questionIds];
  changedIds.reverse();
  for (const changed of [
    {...exam, id:'unknown'}, {...exam, manifest:'old'}, {...exam, questionIds:changedIds},
    {...exam, actualCount:40}, {...exam, type:'AYT'}, {...exam, number:2}, {...exam, distributionVersion:'old'}
  ]) assert.equal(scorePracticeExam(changed, answers, registry), null);
  assert.equal(scorePracticeExam(exam, answers.slice(1), registry), null);
  assert.equal(scorePracticeExam(exam, answers.map(() => 'F'), registry), null);
  assert.equal(scorePracticeExam(exam, answers.map(() => undefined), registry), null);
  assert.equal(scorePracticeExam(exam, Array(exam.actualCount), registry), null);
  const sparse = answers.slice();
  delete sparse[0];
  assert.equal(scorePracticeExam(exam, sparse, registry), null);
  assert.equal(scorePracticeExam(exam, answers, {...registry, getQuestion:() => null}), null);
  assert.equal(scorePracticeExam(exam, answers, {...registry, getQuestion:id => ({...registry.getQuestion(id)})}), null);
  const fewer = createAiRegistry({...AI_BANK, questions:AI_BANK.questions.filter(q => q.id !== exam.questionIds[0])});
  assert.equal(scorePracticeExam(exam, answers, fewer), null);
});

test('deeply frozen registry catalogues reuse one canonical plan across repeated scoring', () => {
  assert.equal(buildPracticeExamCatalog(registry.questions), catalog);
  assert.equal(buildPracticeExamCatalog(registry), catalog);
  const exam = catalog.exams[0], answers = exam.questionIds.map(() => null);
  for (let index = 0; index < 100; index++) {
    assert.equal(scorePracticeExam(exam, answers, registry).blank, exam.actualCount);
    assert.equal(buildPracticeExamCatalog(registry.questions), catalog);
  }
  const copy = createAiRegistry(AI_BANK);
  assert.notEqual(buildPracticeExamCatalog(copy.questions), catalog);
  assert.deepEqual(buildPracticeExamCatalog(copy.questions).exams, catalog.exams);
});

test('mutable questions, including shallow-frozen arrays, cannot retain a stale cached plan', () => {
  for (const frozenDepth of ['none', 'array', 'row']) {
    const question = JSON.parse(JSON.stringify(registry.questions[0]));
    const questions = [question];
    if (frozenDepth !== 'none') Object.freeze(questions);
    if (frozenDepth === 'row') Object.freeze(question);
    const mutableRegistry = {questions, getQuestion:id => questions.find(row => row.id === id) || null};
    const before = buildPracticeExamCatalog(questions), exam = before.exams[0];
    assert.notEqual(buildPracticeExamCatalog(questions), before);
    assert.equal(scorePracticeExam(exam, [null], mutableRegistry).blank, 1);
    question.verification.mathPassed = false;
    const after = buildPracticeExamCatalog(questions);
    assert.notEqual(after, before);
    assert.equal(after.exams.length, 0);
    assert.equal(scorePracticeExam(exam, [null], mutableRegistry), null);
  }
});
