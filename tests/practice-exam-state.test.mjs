import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPracticeAttempt, normalizePracticeAttempt, elapsedPracticeSeconds,
  updatePracticeAnswer, movePracticeQuestion, pausePracticeAttempt,
  resumePracticeAttempt, checkpointPracticeAttempt, finishPracticeAttempt,
  normalizePracticeExamStore
} from '../shared/practice-exam-state.js';

const started = Date.parse('2026-11-15T10:00:00Z');
const exam = (type = 'TYT', count = 30, number = 1) => ({
  id: `practice-2025-${type.toLowerCase()}-${number}`, type, number,
  distributionVersion: 'practice-2025-v1', manifest: `test-manifest-${type}-${number}`,
  questionIds: Array.from({length: count}, (_, i) => `${type}-TEST-${i + 1}`), actualCount: count,
  targetCount: type === 'TYT' ? 30 : 40, completeDistribution: type === 'TYT'
});
const attempt = (spec = exam(), id = 'attempt-1') => createPracticeAttempt(spec, {id, now: started});
const allBlank = count => ({correct: 0, wrong: 0, blank: count, net: 0, total: count, isOfficial: false});

test('practice records bind exact numbered manifests and support an honestly partial AYT sheet', () => {
  for (const spec of [exam(), exam('AYT', 24)]) {
    const record = attempt(spec);
    assert.equal(record.answers.length, spec.actualCount);
    assert.equal(record.status, 'running');
    assert.deepEqual(normalizePracticeAttempt(JSON.parse(JSON.stringify(record)), spec, started), record);
    for (const patch of [
      {id: 'different-exam'}, {type: spec.type === 'TYT' ? 'AYT' : 'TYT'}, {number: 2},
      {distributionVersion: 'changed'}, {manifest: 'changed'},
      {questionIds: spec.questionIds.slice().reverse()}
    ]) assert.equal(normalizePracticeAttempt(record, {...spec, ...patch}, started), null);
  }
});

test('answer and navigation transitions preserve the original snapshot and reject invalid or paused edits', () => {
  const before = attempt(), serialized = JSON.stringify(before);
  const marked = updatePracticeAnswer(before, 4, 'C', started + 1500);
  assert.equal(marked.answers[4], 'C');
  assert.equal(marked.updatedAt, started + 1500);
  assert.equal(JSON.stringify(before), serialized);
  const moved = movePracticeQuestion(marked, 4, started + 2000);
  assert.equal(moved.index, 4);
  assert.equal(marked.index, 0);
  const cleared = updatePracticeAnswer(moved, 4, null, started + 2500);
  assert.equal(cleared.answers[4], null);
  for (const [index, value] of [[-1, 'A'], [30, 'A'], [1.5, 'A'], [2, 'F'], [2, undefined], [2, 'AB']]) {
    assert.throws(() => updatePracticeAnswer(before, index, value, started + 3000), TypeError);
  }
  assert.throws(() => movePracticeQuestion(before, 30, started + 3000), TypeError);
  const paused = pausePracticeAttempt(marked, started + 3000);
  assert.throws(() => updatePracticeAnswer(paused, 0, 'A', started + 4000), TypeError);
});

test('pause, resume and durable checkpoints count active time only across reload and backward clocks', () => {
  let record = attempt();
  record = checkpointPracticeAttempt(record, started + 5250);
  assert.equal(record.elapsedMs, 5250);
  assert.equal(elapsedPracticeSeconds(record, started + 6000), 6);
  // The UI closes a crashed/reloaded active sheet at its last durable timestamp.
  record = normalizePracticeAttempt(JSON.parse(JSON.stringify(record)), exam(), started + 60000);
  record = pausePracticeAttempt(record, record.updatedAt);
  assert.equal(elapsedPracticeSeconds(record, started + 60000), 5);
  record = resumePracticeAttempt(record, started + 60000);
  record = updatePracticeAnswer(record, 0, 'B', started + 62000);
  assert.equal(elapsedPracticeSeconds(record, started + 62500), 7);
  record = pausePracticeAttempt(record, started + 62000);
  assert.equal(record.elapsedMs, 7250);
  assert.equal(elapsedPracticeSeconds(record, started + 90000), 7);
  const unchangedDuration = pausePracticeAttempt(record, started + 91000);
  assert.equal(unchangedDuration.elapsedMs, 7250);
  record = resumePracticeAttempt(record, started + 92000);
  const withBackwardsClock = checkpointPracticeAttempt(record, started + 91000);
  assert.equal(withBackwardsClock.elapsedMs, 7250);
  assert.equal(withBackwardsClock.updatedAt, started + 92000);
});

test('completion freezes duration and retries create independent answer sheets without erasing prior results', () => {
  let record = attempt();
  record = updatePracticeAnswer(record, 0, 'A', started + 1000);
  record = updatePracticeAnswer(record, 1, 'B', started + 1500);
  const score = {correct: 1, wrong: 1, blank: 28, net: .75, total: 30, isOfficial: false};
  const finished = finishPracticeAttempt(record, score, started + 5000);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.completedAt, started + 5000);
  assert.equal(elapsedPracticeSeconds(finished, started + 500000), 5);
  assert.deepEqual(finished.result, score);
  assert.deepEqual(finishPracticeAttempt(finished, null, started + 6000), finished);
  assert.equal(resumePracticeAttempt(finished, started + 6000).status, 'completed');
  assert.throws(() => updatePracticeAnswer(finished, 0, 'E', started + 6000), TypeError);
  const retry = createPracticeAttempt(exam(), {id: 'attempt-retry', now: started + 7000});
  assert.notEqual(retry.id, finished.id);
  assert.deepEqual(retry.questionIds, finished.questionIds);
  assert.deepEqual(retry.answers, Array(30).fill(null));
  assert.equal(retry.result, null);
  assert.equal(finished.answers[0], 'A');
  assert.equal(finished.result.net, .75);
  assert.deepEqual(normalizePracticeAttempt(finished, exam(), started + 8000), finished);
});

test('invalid manifests, answer sheets, timestamps and claimed official scores never become usable saved progress', () => {
  const original = attempt();
  for (const patch of [
    {version: 2}, {id: '<script>'}, {examId: 'another'}, {answers: []},
    {answers: Array(30).fill('F')}, {index: 30}, {index: -1}, {status: 'finished'},
    {updatedAt: started - 1}, {updatedAt: started + 1}, {startedAt: -1},
    {runningSince: null}, {runningSince: started - 1}, {elapsedMs: -1},
    {elapsedMs: Infinity}, {elapsedMs: 1}, {completedAt: started}, {result: allBlank(30)}
  ]) assert.equal(normalizePracticeAttempt({...original, ...patch}, exam(), started), null);
  assert.throws(() => createPracticeAttempt({...exam(), questionIds: ['same', 'same'], actualCount: 2}, {id: 'a', now: started}), TypeError);
  assert.throws(() => createPracticeAttempt(exam(), {id: 'a', now: NaN}), TypeError);
  for (const score of [null, {...allBlank(30), isOfficial: true}, {...allBlank(30), total: 40},
    {...allBlank(30), net: 1}, {...allBlank(30), correct: 1},
    {correct: 30, wrong: 0, blank: 0, net: 30, total: 30, isOfficial: false}]) {
    assert.throws(() => finishPracticeAttempt(original, score, started + 5000), TypeError);
  }
});

test('practice store retains unknown, conflicting and future rows and does not truncate previous attempts', () => {
  const spec = exam(), complete = finishPracticeAttempt(attempt(), allBlank(30), started + 1000);
  const missingCatalog = {...complete, id: 'future-attempt', examId: 'future-catalog'};
  const invalid = {id: 'old-unrecognized', payload: ['preserve', {old: true}]};
  const input = {version: 1, attempts: [complete, missingCatalog, invalid], retained: [], note: 'preserve metadata'};
  const normalized = normalizePracticeExamStore(input, [spec], started + 2000);
  assert.deepEqual(normalized.attempts, [complete]);
  assert.deepEqual(normalized.retained, [missingCatalog, invalid]);
  assert.equal(normalized.note, input.note);
  assert.deepEqual(normalizePracticeExamStore(normalized, [spec], started + 3000), normalized);
  assert.deepEqual(input.attempts, [complete, missingCatalog, invalid]);
  assert.deepEqual(normalizePracticeExamStore({version: 1, attempts: [complete, {...complete, answers: Array(30).fill('E')}]}, [spec], started + 2000).attempts, []);
  assert.equal(normalizePracticeExamStore({version: 2, attempts: [complete]}, [spec]), null);
  assert.equal(normalizePracticeExamStore({version: 1, attempts: 'bad'}, [spec]), null);
  const many = Array.from({length: 1500}, (_, i) => ({...complete, id: `previous-${i}`}));
  assert.equal(normalizePracticeExamStore({version: 1, attempts: many}, [spec], started + 2000).attempts.length, 1500);
});
