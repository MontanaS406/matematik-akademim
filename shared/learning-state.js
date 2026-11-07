// Only learning preferences and original-exercise outcomes cross the account boundary.
// Access tokens, chat messages and adult/profanity consent deliberately have no schema here.
const TEACHER_IDS = new Set(['cagatay', 'beyza', 'zeynep', 'kemal', 'mert', 'elif']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const EPOCH = '1970-01-01T00:00:00.000Z';
const MAX_BYTES = 85000; // JSONB text adds separator spaces; stay below its 100 kB limit too.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slug = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) && n >= 0 && n < 4102444800000 ? new Date(n).toISOString() : null;
}
function attempt(value) {
  if (!object(value) || !identifier(value.id) || !slug(value.courseId) || !identifier(value.exerciseId) ||
      typeof value.correct !== 'boolean' || !DIFFICULTIES.has(value.difficulty)) return null;
  const at = timestamp(value.at);
  return at ? {id: value.id, courseId: value.courseId, exerciseId: value.exerciseId,
    correct: value.correct, difficulty: value.difficulty, at} : null;
}
function diagnostic(value) {
  if (!object(value) || !timestamp(value.at) || !Array.isArray(value.responses)) return null;
  const responses = value.responses.slice(0, 100).filter(r => object(r) && slug(r.courseId) && typeof r.correct === 'boolean')
    .map(r => ({courseId: r.courseId, correct: r.correct}));
  return {at: timestamp(value.at), level: typeof value.level === 'string' ? value.level.slice(0, 80) : '', responses};
}
const later = (a, b) => a.at === b.at ? (JSON.stringify(a) >= JSON.stringify(b) ? a : b) : (a.at > b.at ? a : b);
function boundedAttempts(values) {
  const byId = new Map();
  for (const raw of values) {
    const item = attempt(raw);
    if (item) byId.set(item.id, byId.has(item.id) ? later(byId.get(item.id), item) : item);
  }
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).slice(-1000);
}
export function normalizeState(input) {
  const source = object(input) ? input : {};
  const state = {
    teacherId: TEACHER_IDS.has(source.teacherId) ? source.teacherId : 'elif',
    courseId: slug(source.courseId) ? source.courseId : null,
    difficulty: DIFFICULTIES.has(source.difficulty) ? source.difficulty : 'easy',
    preferencesAt: timestamp(source.preferencesAt) || EPOCH,
    attempts: boundedAttempts(Array.isArray(source.attempts) ? source.attempts.slice(-10000) : []),
    diagnostic: diagnostic(source.diagnostic)
  };
  // Variable-width course IDs and UTF-8 level text still fit the REST body/database budget.
  while (state.attempts.length && new TextEncoder().encode(JSON.stringify(state)).length >= MAX_BYTES) state.attempts.shift();
  return state;
}
export function mergeLearningStates(a, b) {
  const left = normalizeState(a), right = normalizeState(b);
  let preferences;
  if (left.preferencesAt === right.preferencesAt) {
    const key = s => JSON.stringify([s.teacherId, s.courseId, s.difficulty]);
    preferences = key(left) >= key(right) ? left : right;
  } else preferences = left.preferencesAt > right.preferencesAt ? left : right;
  const latestDiagnostic = !left.diagnostic ? right.diagnostic : !right.diagnostic ? left.diagnostic : later(left.diagnostic, right.diagnostic);
  return normalizeState({...preferences, attempts: [...left.attempts, ...right.attempts], diagnostic: latestDiagnostic});
}
export function progressFromAttempts(input) {
  const progress = Object.create(null);
  for (const item of normalizeState(input).attempts) {
    const row = progress[item.courseId] || (progress[item.courseId] = {correct: 0, total: 0});
    row.total++;
    if (item.correct) row.correct++;
  }
  return progress;
}
