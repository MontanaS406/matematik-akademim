// AI exercises are deliberately separate from licensed original exam questions.
// This gate verifies recorded automated checks and structure, not human approval.
import {COURSES} from './curriculum.js';

const COURSES_BY_ID = new Set(COURSES.map(course => course.id));
const EXAMS = new Set(['TYT', 'AYT']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const POOLS = new Set(['imported', 'generated']);
const DERIVATIONS = new Set(['AI_ARCHIVE_IMPORT', 'AI_TO_AI', 'ORIGINAL_TO_AI']);
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 500) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const pageNumber = value => Number.isSafeInteger(value) && value > 0 && value <= 20000;
const normalized = value => String(value).normalize('NFKC').replace(/[−–]/g, '-').replace(/\s+/gu, '').toLocaleLowerCase('tr-TR');

// Legacy records have known AI provenance: the first archive was itself AI,
// and PR #10's authoring parents were accessible archive AI bodies. A source
// page reference in that archive is not evidence of reading an original PDF.
export function aiDerivationKind(question) {
  if (!object(question) || question.origin !== 'AI_URETIMI') return null;
  const provenance = object(question.provenance) ? question.provenance : {};
  const topDeclared = own(question, 'derivationKind');
  const sourceDeclared = own(provenance, 'derivationKind');
  if (topDeclared && !DERIVATIONS.has(question.derivationKind) || sourceDeclared && !DERIVATIONS.has(provenance.derivationKind)) return null;
  if (topDeclared && sourceDeclared && question.derivationKind !== provenance.derivationKind) return null;
  if (topDeclared || sourceDeclared) return topDeclared ? question.derivationKind : provenance.derivationKind;
  return question.pool === 'imported' ? 'AI_ARCHIVE_IMPORT' : question.pool === 'generated' ? 'AI_TO_AI' : null;
}

function inspectSourceEvidence(evidence) {
  const errors = [];
  const bad = (field, message) => errors.push({field, message});
  if (!object(evidence)) return [{field: '', message: 'Kaynak okuma kanıtı nesnesi gerekli.'}];
  for (const field of ['id', 'sourceQuestionId', 'sourceDocumentId']) if (!identifier(evidence[field])) bad(field, 'Geçerli kaynak kanıtı kimliği gerekli.');
  if (typeof evidence.sourceQuestionId !== 'string' || !evidence.sourceQuestionId.startsWith('ORIG-')) bad('sourceQuestionId', 'Gerçekte okunan özgün soru kimliği gerekli.');
  if (typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.sha256)) bad('sha256', 'Kaynak PDF SHA-256 özeti gerekli.');
  if (!pageNumber(evidence.physicalPage)) bad('physicalPage', 'PDF içindeki gerçek sayfa konumu gerekli.');
  if (!own(evidence, 'originalPdfPage') || evidence.originalPdfPage !== null && !pageNumber(evidence.originalPdfPage)) bad('originalPdfPage', 'Kaynak kitapçık sayfası bilinmiyorsa açıkça null olmalı.');
  if (!Number.isSafeInteger(evidence.questionNumber) || evidence.questionNumber < 1 || evidence.questionNumber > 10000) bad('questionNumber', 'Sayfada görülen soru numarası gerekli.');
  if (evidence.origin !== 'ORIJINAL' || evidence.readStatus !== 'read' || evidence.answerStatus !== 'verified') bad('readStatus', 'Özgün soru ve cevap eşlemesi okunup doğrulanmış olmalı.');
  // This evidence path describes private, unlicensed source bodies. It never
  // grants permission to expose the original statement, diagram or booklet.
  if (evidence.publishable !== false) bad('publishable', 'Kaynak gövdesi için yayın hakkı verilmiş gibi gösterilemez.');
  for (const field of ['prompt', 'text', 'options', 'solution', 'solutionSteps', 'image', 'imagePath', 'pdfPath', 'pdfBytes']) {
    if (own(evidence, field)) bad(field, 'Herkese açık okuma kanıtı özgün soru metni veya dosyası içeremez.');
  }
  return errors;
}

function inspectLineage(question, evidenceById) {
  const errors = [];
  const bad = (field, message) => errors.push({field, message});
  const kind = aiDerivationKind(question);
  const provenance = object(question.provenance) ? question.provenance : {};
  if (!kind) return [{field: 'derivationKind', message: 'AI türetme kökeni geçersiz veya çelişkili.'}];
  if (kind === 'AI_ARCHIVE_IMPORT' && question.pool !== 'imported' || kind !== 'AI_ARCHIVE_IMPORT' && question.pool !== 'generated') bad('derivationKind', 'Türetme kökeni içe aktarım/üretim havuzuyla eşleşmeli.');
  if (kind !== 'ORIGINAL_TO_AI') {
    if (typeof question.parentQuestionId === 'string' && question.parentQuestionId.startsWith('ORIG-') || ['sourceQuestionId', 'sourceDocumentId', 'sourceReadEvidenceId'].some(field => own(provenance, field))) bad('provenance', 'AI kökenli kayıt doğrudan özgün PDF okunmuş gibi gösterilemez.');
    return errors;
  }
  if (!object(question.provenance)) return [...errors, {field: 'provenance', message: 'Özgün PDF türetmesi için okuma kanıtına bağlı köken kaydı gerekli.'}];
  if (!identifier(provenance.sourceQuestionId) || !provenance.sourceQuestionId.startsWith('ORIG-') || question.parentQuestionId !== provenance.sourceQuestionId) bad('parentQuestionId', 'Ebeveyn, gerçekten okunan özgün soru kimliğiyle eşleşmeli.');
  if (!identifier(provenance.sourceReadEvidenceId)) bad('provenance.sourceReadEvidenceId', 'Kaynak okuma kanıtı kimliği gerekli.');
  const evidence = evidenceById.get(provenance.sourceReadEvidenceId);
  if (!evidence) return [...errors, {field: 'provenance.sourceReadEvidenceId', message: 'Geçerli, tekil özgün soru okuma kanıtı bulunamadı.'}];
  for (const [field, evidenceField] of [['sourceQuestionId','sourceQuestionId'], ['sourceDocumentId','sourceDocumentId'], ['physicalPage','physicalPage'], ['originalPdfPage','originalPdfPage'], ['sourceQuestionNumber','questionNumber']]) {
    if (!own(provenance, field) || provenance[field] !== evidence[evidenceField]) bad('provenance.' + field, 'Kaynak soru, belge ve sayfa konumu okuma kanıtıyla eşleşmeli.');
  }
  if (own(provenance, 'sourceSha256') && provenance.sourceSha256 !== evidence.sha256) bad('provenance.sourceSha256', 'Kaynak PDF özeti okuma kanıtıyla eşleşmeli.');
  return errors;
}

// Exact rational comparison catches equivalent numeric distractors (1/2, 0.5).
// This intentionally parses a small numeric grammar; it never evaluates code.
function canonicalOption(value) {
  const raw = normalized(value).replace(',', '.');
  const number = /^([+-]?\d{1,100})(?:\/(\d{1,100}))?$/.exec(raw);
  const decimal = /^([+-]?)(\d{1,100})\.(\d{1,30})$/.exec(raw);
  let numerator, denominator;
  if (number) {
    numerator = BigInt(number[1]); denominator = BigInt(number[2] || '1');
  } else if (decimal) {
    denominator = 10n ** BigInt(decimal[3].length);
    numerator = BigInt(decimal[2] + decimal[3]) * (decimal[1] === '-' ? -1n : 1n);
  } else return 'text:' + raw;
  if (!denominator) return 'text:' + raw;
  const gcd = (a, b) => { while (b) { const remainder = a % b; a = b; b = remainder; } return a; };
  const divisor = gcd(numerator < 0n ? -numerator : numerator, denominator);
  return 'number:' + numerator / divisor + '/' + denominator / divisor;
}
function deepFreeze(value) {
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item && typeof item === 'object' && !Object.isFrozen(item)) {
      Object.freeze(item);
      for (const nested of Object.values(item)) pending.push(nested);
    }
  }
  return value;
}
function inspectQuestion(question, evidenceById) {
  const errors = [];
  const bad = (field, message) => errors.push({field, message});
  if (!object(question)) return [{field: '', message: 'Soru nesnesi gerekli.'}];
  errors.push(...inspectLineage(question, evidenceById));
  if (!identifier(question.id)) bad('id', 'Geçerli soru kimliği gerekli.');
  if (!EXAMS.has(question.examType)) bad('examType', 'Sınav TYT veya AYT olmalı.');
  if (!COURSES_BY_ID.has(question.courseId)) bad('courseId', 'Kayıtlı müfredat konusu gerekli.');
  for (const field of ['topic', 'subtopic']) if (!text(question[field], 500)) bad(field, 'Konu etiketi gerekli.');
  if (question.difficulty !== null && !DIFFICULTIES.has(question.difficulty)) bad('difficulty', 'Zorluk geçersiz; bilinmiyorsa null kullanılır.');
  if (!text(question.prompt, 12000)) bad('prompt', 'Soru metni eksik veya fazla uzun.');
  if (question.origin !== 'AI_URETIMI') bad('origin', 'Bu havuz yalnızca açıkça etiketli AI alıştırmalarını kabul eder.');
  if (!POOLS.has(question.pool)) bad('pool', 'İçe aktarılan ve yeni üretilen havuz belirtilmeli.');
  if (question.parentQuestionId !== null && question.parentQuestionId !== undefined && !identifier(question.parentQuestionId)) bad('parentQuestionId', 'Kaynak soru kimliği geçersiz.');
  if (question.pool === 'generated' && !identifier(question.parentQuestionId)) bad('parentQuestionId', 'Yeni üretim için türetilen kaynak kimliği gerekli.');
  if (question.duplicateOf !== undefined && question.duplicateOf !== null && !identifier(question.duplicateOf)) bad('duplicateOf', 'Tekrar kaydının kimliği geçersiz.');
  const options = question.options;
  if (!Array.isArray(options) || options.length !== 5) bad('options', 'Tam beş seçenek gerekli.');
  else {
    const ids = new Set(), values = new Set();
    options.forEach((option, index) => {
      if (!object(option) || !LETTERS.includes(option.id) || ids.has(option.id) || !text(option.text, 3000)) {
        bad('options[' + index + ']', 'A–E kimlikleri ve seçenek metinleri tekil olmalı.');
        return;
      }
      ids.add(option.id);
      const key = canonicalOption(option.text);
      if (values.has(key)) bad('options[' + index + ']', 'Aynı değeri veren birden fazla seçenek kullanılamaz.');
      values.add(key);
    });
    if (LETTERS.some(letter => !ids.has(letter))) bad('options', 'A, B, C, D, E seçenekleri gerekli.');
  }
  const answer = question.answer;
  if (!object(answer) || !LETTERS.includes(answer.value)) bad('answer.value', 'Doğru cevap A–E arasında olmalı.');
  if (!object(answer) || !(text(answer.computedValue, 3000) || typeof answer.computedValue === 'number' && Number.isFinite(answer.computedValue))) bad('answer.computedValue', 'Bağımsız hesap sonucu gerekli.');
  else {
    const selected = Array.isArray(options) && options.find(option => option?.id === answer.value);
    if (!selected || !text(selected.text, 3000) || canonicalOption(answer.computedValue) !== canonicalOption(selected.text)) bad('answer.computedValue', 'Hesap sonucu doğru seçeneğe eşit olmalı.');
  }
  if (!object(answer) || !text(answer.solution, 24000)) bad('answer.solution', 'Açıklamalı çözüm gerekli.');
  if (!Array.isArray(question.solutionSteps) || !question.solutionSteps.length || question.solutionSteps.length > 40 || question.solutionSteps.some(step => !text(step, 6000))) bad('solutionSteps', 'Sınırlı sayıda, açıklamalı çözüm adımı gerekli.');
  const verification = question.verification;
  if (!object(verification)) bad('verification', 'Doğrulama kaydı gerekli.');
  else {
    if (!['automated_verified', 'pending_review'].includes(verification.status)) bad('verification.status', 'Otomatik doğrulama veya inceleme durumu gerekli.');
    if (typeof verification.mathPassed !== 'boolean') bad('verification.mathPassed', 'Matematik kontrol sonucu boolean olmalı.');
    if (!Array.isArray(verification.methods) || verification.methods.length > 20 || verification.methods.some(method => !text(method, 300)) || new Set(verification.methods.filter(method => typeof method === 'string').map(normalized)).size !== verification.methods.length) bad('verification.methods', 'Tekil kontrol yöntemleri gerekli.');
    if (!Array.isArray(verification.reasons) || verification.reasons.length > 40 || verification.reasons.some(reason => !text(reason, 1000))) bad('verification.reasons', 'İnceleme nedenleri metin dizisi olmalı.');
    if (verification.editorialStatus !== 'pending') bad('verification.editorialStatus', 'Otomatik kontrol insan editör onayı anlamına gelmez.');
  }
  return errors;
}

export function createAiRegistry(dataset = {schemaVersion: 1, questions: []}) {
  if (!object(dataset) || dataset.schemaVersion !== 1 || !Array.isArray(dataset.questions) || dataset.questions.length > 50000) throw new TypeError('AI bankası sürümü veya soru dizisi geçersiz.');
  if (dataset.sourceEvidence !== undefined && (!Array.isArray(dataset.sourceEvidence) || dataset.sourceEvidence.length > 50000)) throw new TypeError('Kaynak okuma kanıtları sınırlı bir dizi olmalı.');
  // Copy before exposing records: callers cannot change eligibility after startup.
  let copied, copiedEvidence;
  try { copied = JSON.parse(JSON.stringify(dataset.questions)); copiedEvidence = JSON.parse(JSON.stringify(dataset.sourceEvidence || [])); }
  catch { throw new TypeError('AI soru bankası JSON verisi olmalı.'); }
  const issues = [], duplicateRows = new Set(), seenIds = new Map();
  const evidenceById = new Map(), seenEvidence = new Set(), duplicateEvidence = new Set();
  copiedEvidence.forEach((evidence, index) => {
    const errors = inspectSourceEvidence(evidence);
    for (const error of errors) issues.push({index, id:evidence?.id ?? null, field:'sourceEvidence.' + error.field, message:error.message});
    if (identifier(evidence?.id)) {
      if (seenEvidence.has(evidence.id)) { duplicateEvidence.add(evidence.id); issues.push({index,id:evidence.id,field:'sourceEvidence.id',message:'Okuma kanıtı kimliği tekrarlanamaz.'}); }
      seenEvidence.add(evidence.id);
      if (!errors.length) evidenceById.set(evidence.id, evidence);
    }
  });
  for (const id of duplicateEvidence) evidenceById.delete(id);
  const checks = copied.map((question, index) => {
    if (object(question)) question.derivationKind = aiDerivationKind(question);
    const errors = inspectQuestion(question, evidenceById);
    for (const error of errors) issues.push({index, id: question?.id ?? null, ...error});
    if (identifier(question?.id)) {
      if (seenIds.has(question.id)) {
        duplicateRows.add(index); duplicateRows.add(seenIds.get(question.id));
        issues.push({index, id: question.id, field: 'id', message: 'Yinelenen soru kimliği kullanılamaz.'});
      } else seenIds.set(question.id, index);
    }
    if (question?.duplicateOf) duplicateRows.add(index);
    return errors;
  });
  const allQuestions = deepFreeze(copied);
  const questions = Object.freeze(allQuestions.filter((question, index) => checks[index].length === 0 && !duplicateRows.has(index) && question.verification.status === 'automated_verified' && question.verification.mathPassed === true && question.verification.methods.length >= 2 && question.verification.reasons.length === 0));
  const byId = new Map(questions.map(question => [question.id, question]));
  const indexes = new Map();
  for (const field of ['examType', 'courseId', 'subtopic', 'difficulty', 'pool', 'derivationKind']) {
    const values = new Map();
    for (const question of questions) {
      if (!values.has(question[field])) values.set(question[field], []);
      values.get(question[field]).push(question);
    }
    for (const [value, rows] of values) values.set(value, Object.freeze(rows));
    indexes.set(field, values);
  }
  function getQuestions(filters = {}) {
    if (!object(filters)) return Object.freeze([]);
    const selected = Object.entries(filters).filter(([field, value]) => indexes.has(field) && value !== undefined);
    let rows = questions;
    for (const [field, value] of selected) {
      const indexed = indexes.get(field).get(value);
      if (!indexed) return Object.freeze([]);
      if (indexed.length < rows.length) rows = indexed;
    }
    return Object.freeze(rows.filter(question => selected.every(([field, value]) => question[field] === value)));
  }
  const stats = Object.freeze({total: allQuestions.length, usable: questions.length, pending: allQuestions.length - questions.length - duplicateRows.size, duplicates: duplicateRows.size, TYT: indexes.get('examType').get('TYT')?.length || 0, AYT: indexes.get('examType').get('AYT')?.length || 0});
  const lineageStats = Object.freeze(Object.fromEntries([...DERIVATIONS].map(kind => [kind,indexes.get('derivationKind').get(kind)?.length || 0])));
  return Object.freeze({questions, allQuestions, getQuestions, getQuestion: id => byId.get(id) || null, stats, lineageStats, sourceEvidence:deepFreeze([...evidenceById.values()]), issues: deepFreeze(issues)});
}
