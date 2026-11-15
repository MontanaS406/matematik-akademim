// AI practice attempts have their own versioned records. They never rewrite the
// learning profile or the older official/private-booklet history.
const own = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const timestamp = value => Number.isSafeInteger(value) && value >= 0 && value < 4102444800000;
const answer = value => value === null || typeof value === 'string' && /^[ABCDE]$/.test(value);
const clone = value => structuredClone(value);

function manifestFromExam(exam) {
  if (!own(exam) || !identifier(exam.id) || !['TYT', 'AYT'].includes(exam.type) ||
      !Number.isInteger(exam.number) || exam.number < 1 ||
      typeof exam.distributionVersion !== 'string' || !exam.distributionVersion.length || exam.distributionVersion.length > 120 ||
      typeof exam.manifest !== 'string' || !exam.manifest.length || exam.manifest.length > 16000 ||
      !Array.isArray(exam.questionIds) || exam.questionIds.length < 1 || exam.questionIds.length > 100 ||
      Array.from(exam.questionIds).some(id => !identifier(id)) || new Set(exam.questionIds).size !== exam.questionIds.length ||
      exam.actualCount !== exam.questionIds.length) return null;
  return {
    examId: exam.id, type: exam.type, number: exam.number,
    distributionVersion: exam.distributionVersion, manifest: exam.manifest,
    questionIds: exam.questionIds.slice()
  };
}

function normalizedResult(value, total) {
  if (!own(value) || value.total !== total || value.isOfficial !== false ||
      [value.correct, value.wrong, value.blank].some(n => !Number.isInteger(n) || n < 0 || n > total) ||
      value.correct + value.wrong + value.blank !== total ||
      value.net !== value.correct - value.wrong / 4) return null;
  return {correct: value.correct, wrong: value.wrong, blank: value.blank,
    net: value.net, total, isOfficial: false};
}

function normalizedAttempt(input, now) {
  if (!timestamp(now) || !own(input) || input.version !== 1 || !identifier(input.id)) return null;
  const manifest = manifestFromExam({...input, id: input.examId, actualCount: input.questionIds?.length});
  if (!manifest || !Array.isArray(input.answers) || input.answers.length !== manifest.questionIds.length ||
      Array.from(input.answers).some(value => !answer(value)) || !Number.isInteger(input.index) || input.index < 0 || input.index >= input.answers.length ||
      !['running', 'paused', 'completed'].includes(input.status) || !timestamp(input.startedAt) || !timestamp(input.updatedAt) ||
      input.updatedAt < input.startedAt || input.updatedAt > now ||
      !Number.isSafeInteger(input.elapsedMs) || input.elapsedMs < 0 || input.elapsedMs > input.updatedAt - input.startedAt) return null;

  let result = null;
  if (input.status === 'running') {
    if (!timestamp(input.runningSince) || input.runningSince < input.startedAt || input.runningSince > input.updatedAt ||
        input.elapsedMs > input.runningSince - input.startedAt || input.completedAt !== null || input.result !== null) return null;
  } else {
    if (input.runningSince !== null) return null;
    if (input.status === 'completed') {
      result = normalizedResult(input.result, input.answers.length);
      if (!result || result.blank !== input.answers.filter(value => value === null).length || input.completedAt !== input.updatedAt) return null;
    } else if (input.completedAt !== null || input.result !== null) return null;
  }
  return {
    version: 1, id: input.id, ...manifest, answers: input.answers.slice(), index: input.index,
    status: input.status, startedAt: input.startedAt, updatedAt: input.updatedAt,
    elapsedMs: input.elapsedMs, runningSince: input.runningSince,
    completedAt: input.completedAt, result
  };
}

export function createPracticeAttempt(exam, {id, now = Date.now()} = {}) {
  const manifest = manifestFromExam(exam);
  if (!manifest || !identifier(id) || !timestamp(now)) throw new TypeError('Deneme kaydı oluşturulamadı.');
  return {
    version: 1, id, ...manifest, answers: Array(manifest.questionIds.length).fill(null), index: 0,
    status: 'running', startedAt: now, updatedAt: now, elapsedMs: 0,
    runningSince: now, completedAt: null, result: null
  };
}

// A saved answer sheet must match the precise numbered catalog entry. A new
// catalog version cannot silently attach old answers to different questions.
export function normalizePracticeAttempt(input, exam, now = Date.now()) {
  const expected = manifestFromExam(exam), normalized = normalizedAttempt(input, now);
  if (!expected || !normalized || expected.examId !== normalized.examId || expected.type !== normalized.type ||
      expected.number !== normalized.number || expected.distributionVersion !== normalized.distributionVersion ||
      expected.manifest !== normalized.manifest ||
      expected.questionIds.some((id, i) => id !== normalized.questionIds[i]) ||
      expected.questionIds.length !== normalized.questionIds.length) return null;
  return normalized;
}

export function elapsedPracticeSeconds(attempt, now = Date.now()) {
  if (!own(attempt) || !Number.isSafeInteger(attempt.elapsedMs) || attempt.elapsedMs < 0) return 0;
  const running = attempt.status === 'running' && timestamp(attempt.runningSince) && timestamp(now)
    ? Math.max(0, now - attempt.runningSince) : 0;
  return Math.floor((attempt.elapsedMs + running) / 1000);
}

function editable(input, now) {
  // Clocks can move backwards; an answer or pause must never reduce the saved
  // duration or create a timestamp earlier than the preceding local change.
  if (!timestamp(now)) throw new TypeError('Deneme zamanı geçersiz.');
  const at = Math.max(now, input?.updatedAt ?? 0);
  const value = normalizedAttempt(input, at);
  if (!value) throw new TypeError('Deneme kaydı geçersiz.');
  return {value, at};
}

export function updatePracticeAnswer(input, index, value, now = Date.now()) {
  const {value: attempt, at} = editable(input, now);
  if (attempt.status !== 'running') throw new TypeError('Cevaplamak için denemeye devam et.');
  if (!Number.isInteger(index) || index < 0 || index >= attempt.answers.length || !answer(value)) throw new TypeError('Cevap geçersiz.');
  attempt.answers[index] = value;
  attempt.updatedAt = at;
  return attempt;
}

export function movePracticeQuestion(input, index, now = Date.now()) {
  const {value: attempt, at} = editable(input, now);
  if (!Number.isInteger(index) || index < 0 || index >= attempt.answers.length) throw new TypeError('Soru numarası geçersiz.');
  attempt.index = index;
  // Completed records are immutable evidence of that submission; review
  // navigation belongs to the UI and must not change the completion timestamp.
  if (attempt.status !== 'completed') attempt.updatedAt = at;
  return attempt;
}

export function pausePracticeAttempt(input, now = Date.now()) {
  const {value: attempt, at} = editable(input, now);
  if (attempt.status !== 'running') return attempt;
  attempt.elapsedMs += Math.max(0, at - attempt.runningSince);
  attempt.runningSince = null;
  attempt.status = 'paused';
  attempt.updatedAt = at;
  return attempt;
}

export function checkpointPracticeAttempt(input, now = Date.now()) {
  const {value: attempt, at} = editable(input, now);
  if (attempt.status !== 'running') return attempt;
  attempt.elapsedMs += Math.max(0, at - attempt.runningSince);
  attempt.runningSince = at;
  attempt.updatedAt = at;
  return attempt;
}

export function resumePracticeAttempt(input, now = Date.now()) {
  const {value: attempt, at} = editable(input, now);
  if (attempt.status !== 'paused') return attempt;
  attempt.status = 'running';
  attempt.runningSince = at;
  attempt.updatedAt = at;
  return attempt;
}

// Scores must be calculated with the current verified registry by the caller.
// Stored scores are presentation snapshots, never an official-key assertion.
export function finishPracticeAttempt(input, score, now = Date.now()) {
  const {value: attempt, at} = editable(input, now);
  if (attempt.status === 'completed') return attempt;
  const result = normalizedResult(score, attempt.answers.length);
  if (!result || result.blank !== attempt.answers.filter(value => value === null).length) throw new TypeError('Deneme sonucu doğrulanamadı.');
  if (attempt.status === 'running') attempt.elapsedMs += Math.max(0, at - attempt.runningSince);
  attempt.status = 'completed';
  attempt.runningSince = null;
  attempt.updatedAt = at;
  attempt.completedAt = at;
  attempt.result = result;
  return attempt;
}

// Unknown or invalid rows are retained outside the usable attempt collection.
// A future catalog may restore them; a save must not erase them just because
// the current application cannot display them. Unsupported envelopes fail closed.
export function normalizePracticeExamStore(input, catalog, now = Date.now()) {
  if (input === null || input === undefined) return {version: 1, attempts: [], retained: []};
  if (!own(input) || input.version !== 1 || !Array.isArray(input.attempts) ||
      input.retained !== undefined && !Array.isArray(input.retained)) return null;
  // The active list may change when a previously missing topic is supplied.
  // Old manifests remain readable through allExams/getExam; answers must never
  // be padded or attached to the newer entry with the same displayed number.
  const exams = Array.isArray(catalog) ? catalog : Array.isArray(catalog?.allExams) ? catalog.allExams :
    Array.isArray(catalog?.exams) ? catalog.exams : null;
  const hasResolver = !Array.isArray(catalog) && typeof catalog?.getExam === 'function';
  if ((!exams && !hasResolver) || !timestamp(now)) return null;
  const byExam = new Map();
  for (const exam of exams || []) {
    if (!identifier(exam?.id)) continue;
    // Conflicting catalog IDs cannot select an arbitrary saved answer sheet.
    byExam.set(exam.id, byExam.has(exam.id) ? null : exam);
  }
  const resolveExam = id => {
    if (!identifier(id)) return null;
    if (byExam.has(id)) return byExam.get(id);
    if (!hasResolver) return null;
    try { const found = catalog.getExam(id); return found?.id === id ? found : null; }
    catch { return null; }
  };
  const rows = [...input.attempts, ...(input.retained || [])];
  const counts = new Map();
  for (const row of rows) if (identifier(row?.id)) counts.set(row.id, (counts.get(row.id) || 0) + 1);
  const attempts = [], retained = [];
  for (const row of rows) {
    const normalized = counts.get(row?.id) === 1 ? normalizePracticeAttempt(row, resolveExam(row?.examId), now) : null;
    if (normalized) attempts.push(normalized);
    else retained.push(clone(row));
  }
  return {...clone(input), version: 1, attempts, retained};
}
