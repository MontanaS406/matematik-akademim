export const EXAM_YEARS = Object.freeze(Array.from({length: 9}, (_, i) => 2018 + i));
export const TOPIC_LABELS = Object.freeze(['Sayılar', 'Denklemler', 'Fonksiyonlar', 'Geometri', 'Olasılık ve istatistik', 'Trigonometri', 'Logaritma ve diziler', 'Limit, türev ve integral']);
export const validAnswers = answers => Array.isArray(answers) && answers.length === 40 && answers.every(a => a === null || /^[ABCDE]$/.test(a));
export const validKey = key => typeof key === 'string' && /^[ABCDE]{40}$/.test(key);
export const normalizeFlags = flags => Array.from({length: 40}, (_, i) => flags?.[i] === true);
export const normalizeTopics = topics => Array.from({length: 40}, (_, i) => TOPIC_LABELS.includes(topics?.[i]) ? topics[i] : null);
// Legacy drafts have started/limit only. Paused milliseconds are deducted once.
export function elapsedSeconds(session, now = Date.now()) {
  if (!session) return 0;
  if (Number.isFinite(session.finishedDuration)) return session.finishedDuration;
  const end = Number.isFinite(session.pausedAt) ? session.pausedAt : now;
  return Math.max(0, Math.floor((end - session.started - (session.pausedMs || 0)) / 1000));
}
export function pauseSession(session, now = Date.now()) {
  if (session.pausedAt == null && session.finishedDuration === undefined) session.pausedAt = now;
}
export function resumeSession(session, now = Date.now()) {
  if (Number.isFinite(session.pausedAt)) {
    session.pausedMs = (session.pausedMs || 0) + Math.max(0, now - session.pausedAt);
    session.pausedAt = null;
  }
}
export function fullSessionSeconds(year, type) {
  if (type === 'AYT') return 180 * 60;
  return ([2018, 2019, 2021].includes(Number(year)) ? 135 : 165) * 60;
}
export function validateDraft(d, now = Date.now()) {
  if (!d || !['TYT', 'AYT'].includes(d.type) || !EXAM_YEARS.includes(Number(d.year)) || !validAnswers(d.answers) || !Number.isInteger(d.index) || d.index < 0 || d.index > 39 || !Number.isFinite(d.started) || d.started <= 0 || d.started > now || ![0,3600,5400,8100,9900,10800].includes(d.limit)) return null;
  if (d.finishedDuration !== undefined && (!Number.isFinite(d.finishedDuration) || d.finishedDuration < 0)) return null;
  if (d.pausedMs !== undefined && (!Number.isFinite(d.pausedMs) || d.pausedMs < 0 || d.pausedMs > now - d.started)) return null;
  if (d.pausedAt != null && (!Number.isFinite(d.pausedAt) || d.pausedAt < d.started || d.pausedAt > now)) return null;
  return {...d, year: Number(d.year), pausedMs: d.pausedMs || 0, pausedAt: d.pausedAt ?? null, flags: normalizeFlags(d.flags), topics: normalizeTopics(d.topics), mode: d.mode === 'full' ? 'full' : 'math'};
}
export function reviewQuestions(record) {
  if (!validAnswers(record.markedAnswers) || !validKey(record.answerKey)) return [];
  const topics = normalizeTopics(record.topics);
  return record.markedAnswers.map((answer, i) => ({number: i + 1, answer, key: record.answerKey[i], topic: topics[i], status: answer === null ? 'blank' : answer === record.answerKey[i] ? 'correct' : 'wrong'}));
}
export function topicStats(record) {
  const groups = new Map();
  for (const q of reviewQuestions(record)) {
    if (!q.topic) continue;
    if (!groups.has(q.topic)) groups.set(q.topic, {topic: q.topic, correct: 0, wrong: 0, blank: 0, total: 0});
    const row = groups.get(q.topic); row[q.status]++; row.total++;
  }
  return Array.from(groups.values());
}
export function compareRecords(first, second) {
  if (!first || !second || first.type !== second.type || (first.mode || 'math') !== (second.mode || 'math')) return null;
  return {netDifference: Number.isFinite(first.net) && Number.isFinite(second.net) ? second.net - first.net : null, durationDifference: second.duration - first.duration, firstYear: first.year, secondYear: second.year};
}
