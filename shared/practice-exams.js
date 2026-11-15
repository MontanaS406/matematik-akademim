// These are AI practice sets assembled from the existing reviewed registry.
// The user's 2025 topic tables describe the blueprint, not official exam content.
// No question text, answer, exam-level label or original source is changed here.
export const PRACTICE_DISTRIBUTION_VERSION = 'topic-2025-v2';
const PREVIOUS_DISTRIBUTION_VERSION = 'topic-2025-v1';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const normalized = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i').toLowerCase();
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const topic = (id, label, count, section = 'math') => ({id, label, count, section});
const immutableCatalogs = new WeakMap();
// Registry rows are JSON-owned, deeply frozen copies. Cache only that immutable
// input; a frozen array containing mutable rows must still be revalidated.
function deeplyFrozen(value, seen = new Set()) {
  if (typeof value === 'function') return false;
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return false;
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(descriptors).every(key => {
    const descriptor = descriptors[key];
    return 'value' in descriptor && deeplyFrozen(descriptor.value, seen);
  });
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const BASE_DISTRIBUTIONS = freeze({
  TYT: {
    label: '2025 konu dağılımı · Matematik', targetCount: 30,
    note: 'Paylaşılan TYT tablosunda geometri dağılımı bulunmadığı için bu setler 30 matematik sorusudur.',
    topics: [
      topic('probability', 'Olasılık', 1), topic('counting', 'Permütasyon-Kombinasyon', 1),
      topic('ratio', 'Oran-Orantı', 1), topic('absolute', 'Mutlak Değer', 1),
      topic('modular', 'Modüler Aritmetik', 0), topic('problems', 'Problemler', 12),
      topic('basic', 'Temel Kavramlar', 3), topic('digits', 'Sayı Basamakları', 1),
      topic('operation', 'İşlem', 0), topic('sets', 'Kümeler-Kartezyen Çarpım', 1),
      topic('logic', 'Mantık', 1), topic('functions', 'Fonksiyonlar', 1),
      topic('divisibility', 'Bölünebilme Kuralları', 1), topic('inequalities', 'Basit Eşitsizlikler', 1),
      topic('equations', 'Denklem Çözme', 1), topic('powers', 'Üslü İfadeler', 1),
      topic('factorization', 'Çarpanlara Ayırma', 0), topic('radicals', 'Köklü İfadeler', 1),
      topic('gcd', 'OBEB-OKEK', 0), topic('rational', 'Rasyonel Sayılar', 1),
      topic('polynomials', 'Polinomlar', 0), topic('statistics', 'İstatistik', 1)
    ]
  },
  AYT: {
    label: '2025 konu dağılımı · Matematik ve Geometri', targetCount: 40,
    note: 'Hedef 31 matematik ve 9 geometri sorusudur. Havuzda bulunmayan konular başka sorularla doldurulmaz.',
    topics: [
      topic('basic', 'Temel Kavramlar', 1), topic('digits', 'Sayı Basamakları', 1),
      topic('rational', 'Rasyonel Sayılar', 1), topic('divisibility', 'Bölme ve Bölünebilme', 0),
      topic('functions', 'Fonksiyonlar', 2), topic('quadratics', '2. Dereceden Denklemler', 1),
      topic('logic', 'Mantık', 1), topic('parabola', 'Parabol', 1),
      topic('trigonometry', 'Trigonometri', 5), topic('complex', 'Karmaşık Sayılar', 0),
      topic('polynomials', 'Polinomlar', 1), topic('logarithms', 'Logaritma', 2),
      topic('sequences', 'Diziler', 1), topic('counting', 'Permütasyon-Kombinasyon-Olasılık-Binom', 3),
      topic('limits', 'Limit', 2), topic('derivative', 'Türev', 3), topic('integral', 'İntegral', 3),
      topic('radicals', 'Köklü Sayılar', 0), topic('sets', 'Kümeler ve Kartezyen Çarpım', 1),
      topic('inequalities', 'Basit Eşitsizlikler', 1), topic('absolute', 'Mutlak Değer', 1),
      topic('gcd', 'EBOB-EKOK', 0), topic('factorization', 'Çarpanlara Ayırma', 0),
      topic('triangle-angles', 'Doğruda ve Üçgende Açı', 0, 'geometry'),
      topic('special-triangles', 'Özel Üçgenler', 0, 'geometry'),
      topic('bisectors', 'Açıortay ve Kenarortay', 0, 'geometry'),
      topic('triangle-relations', 'Açı Kenar Bağıntıları', 0, 'geometry'),
      topic('triangle-area', 'Üçgende Alan ve Benzerlik', 1, 'geometry'),
      topic('polygons', 'Çokgenler', 0, 'geometry'),
      topic('analytic-point', 'Noktanın Analitiği', 1, 'geometry'),
      topic('analytic-line', 'Doğrunun Analitiği', 2, 'geometry'),
      topic('transformations', 'Dönüşüm Geometrisi', 0, 'geometry'),
      topic('circle', 'Çember ve Daire', 2, 'geometry'),
      topic('quadrilaterals', 'Özel Dörtgenler', 0, 'geometry'),
      topic('solids', 'Katı Cisimler', 2, 'geometry'),
      topic('analytic-circle', 'Çemberin Analitiği', 1, 'geometry')
    ]
  }
});

export const PRACTICE_DISTRIBUTIONS = freeze({
  TYT: {
    ...BASE_DISTRIBUTIONS.TYT,
    distributionVersion: PRACTICE_DISTRIBUTION_VERSION,
    label: '2025 konu dağılımı · Matematik ve Geometri', targetCount: 40,
    note: 'Hedef 30 matematik ve 10 geometri sorusudur. Havuzda bulunmayan konular başka sorularla doldurulmaz.',
    topics: [...BASE_DISTRIBUTIONS.TYT.topics,
      topic('geo-graph', 'Grafik Okuma', 0, 'geometry'),
      topic('geo-analytic', 'Analitik Geometri', 0, 'geometry'),
      topic('geo-circle', 'Çember ve Daire', 0, 'geometry'),
      topic('geo-solids', 'Katı Cisimler', 2, 'geometry'),
      topic('geo-trapezoid', 'Yamuk', 1, 'geometry'),
      topic('geo-polygons', 'Çokgenler', 1, 'geometry'),
      topic('geo-triangles', 'Açılar ve Üçgenler', 4, 'geometry'),
      topic('geo-rhombus', 'Eşkenar Dörtgen', 0, 'geometry'),
      topic('geo-square', 'Kare', 1, 'geometry'),
      topic('geo-rectangle', 'Dikdörtgen', 1, 'geometry')
    ]
  },
  // AYT's blueprint and identities did not change when TYT geometry arrived.
  AYT: {...BASE_DISTRIBUTIONS.AYT, distributionVersion: PREVIOUS_DISTRIBUTION_VERSION}
});
const LEGACY_TYT_DISTRIBUTION = freeze({...BASE_DISTRIBUTIONS.TYT, distributionVersion: PREVIOUS_DISTRIBUTION_VERSION});

// All 20 accessible geometry bodies were read and classified individually.
// This exact-ID map deliberately has no keyword fallback: a coordinate question
// is not relabelled as a triangle simply because its diagram contains one.
const GEOMETRY_PREFIX = 'AI-GEOMETRY-READ-TYT-GEOMETRY-ADD-';
export const TYT_GEOMETRY_TOPIC_BY_QUESTION = freeze(Object.fromEntries(Object.entries({
  'geo-triangles': [
    'TWO-INTERNAL-RIGHT-TRIANGLES', 'EXTERNAL-ALTITUDE-DIFFERENCE', 'RECOVER-MISSING-OBLIQUE-SIDE',
    'ISOSCELES-HALF-BASE', 'SHARED-ALTITUDE-SEGMENT-RATIO', 'INTEGER-RIGHT-TRIANGLE-PERIMETER',
    'HERON-TO-ANOTHER-ALTITUDE', 'LARGEST-INTEGER-AREA-FIXED-HYPOTENUSE',
    'INTERIOR-CUTOUT-AREA', 'TWO-STAGE-BASE-AND-HEIGHT-RATIO'
  ],
  'geo-polygons': ['DIAGONAL-OPPOSITE-DISTANCES', 'CROSSING-DIAGONAL-FOUR-REGIONS',
    'RIGHT-TRIANGLE-SHARED-DIAGONAL', 'RECOVER-OPPOSITE-HEIGHT'],
  'geo-square': ['SQUARE-CORNER-TRIM'],
  'geo-analytic': ['MIDPOINT-SUBTRIANGLE-COORDINATES', 'VERTEX-PARALLEL-TRANSLATION',
    'CONCAVE-COORDINATE-HEIGHT-RECOVERY', 'COORDINATE-FREE-HORIZONTAL-POSITION', 'COUNT-LATTICE-CONCAVE-VERTICES']
}).flatMap(([topicId, suffixes]) => suffixes.map(suffix => [GEOMETRY_PREFIX + suffix, topicId]))));

// The builder must be given createAiRegistry(...).questions. These additional
// guards keep pending/duplicate/foreign records out if a caller passes raw rows.
function eligible(question) {
  const verification = question?.verification;
  return question?.origin === 'AI_URETIMI' && ['TYT', 'AYT'].includes(question.examType) &&
    typeof question.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(question.id) &&
    !question.duplicateOf && verification?.status === 'automated_verified' && verification.mathPassed === true &&
    Array.isArray(verification.methods) && new Set(verification.methods.map(normalized)).size >= 2 &&
    Array.isArray(verification.reasons) && verification.reasons.length === 0 &&
    Array.isArray(question.options) && question.options.length === 5 &&
    LETTERS.every(letter => question.options.filter(option => option?.id === letter && typeof option.text === 'string' && option.text.trim()).length === 1) &&
    LETTERS.includes(question.answer?.value) && typeof question.prompt === 'string' && question.prompt.trim().length > 0;
}

// Explicit topic decisions were audited against both metadata and accessible
// prompts. In particular, binomial coefficient absolute-sum questions are not
// ordinary absolute-value equations, and TYT rows never fill an AYT shortage.
export function practiceTopicForQuestion(question) {
  const text = normalized(question?.topic + ' ' + question?.subtopic);
  const course = question?.courseId;
  if (question?.examType === 'TYT') {
    if (course === 'geometry') return Object.hasOwn(TYT_GEOMETRY_TOPIC_BY_QUESTION, question.id) ? TYT_GEOMETRY_TOPIC_BY_QUESTION[question.id] : null;
    if (course === 'numbers') return /basamak|rakam/.test(text) ? 'digits' : 'basic';
    if (course === 'divisibility') return /ebob|ekok/.test(text) ? 'gcd' : /basamak|rakam/.test(text) ? 'digits' : 'divisibility';
    if (course === 'equations') return /esitsizlik/.test(text) ? 'inequalities' : 'equations';
    if (course === 'powers') return /koklu/.test(text) ? 'radicals' : 'powers';
    if (course === 'sets') return /mantik|onerme|dogruluk|totoloji/.test(text) ? 'logic' : 'sets';
    if (course === 'probability') return /olasilik/.test(text) && !/garanti/.test(text) ? 'probability' : 'counting';
    if (course === 'fractions') return 'rational';
    return ['absolute', 'functions', 'problems', 'ratio', 'statistics'].includes(course) ? course : null;
  }
  if (question?.examType === 'AYT') {
    if (course === 'probability' || course === 'equations' && /mutlak katsayi|katsayilarin mutlak/.test(text) || course === 'polynomials' && /binom/.test(text)) return 'counting';
    return ['functions', 'quadratics', 'parabola', 'trigonometry', 'complex', 'polynomials', 'logarithms', 'sequences', 'limits', 'derivative', 'integral'].includes(course) ? course : null;
  }
  return null;
}

// Stable across browser locales and input order; interleaving subtopics and
// difficulty groups avoids exhausting one family before the next begins.
function fairOrder(questions) {
  const groups = new Map();
  for (const question of [...questions].sort((a, b) => compare(a.id, b.id))) {
    const group = normalized(question.subtopic) + '|' + (question.difficulty || 'unclassified');
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(question);
  }
  const bins = [...groups].sort(([a], [b]) => compare(a, b)).map(([, rows]) => rows);
  const result = [];
  for (let offset = 0; result.length < questions.length; offset++) {
    for (const bin of bins) if (bin[offset]) result.push(bin[offset]);
  }
  return result;
}
function hash(value) {
  // FNV-1a 64-bit is an identity checksum, never an authentication mechanism.
  let result = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) result = BigInt.asUintN(64, (result ^ BigInt(byte)) * 0x100000001b3n);
  return result.toString(16).padStart(16, '0');
}

export function buildPracticeExamCatalog(input) {
  const raw = Array.isArray(input) ? input : Array.isArray(input?.questions) ? input.questions : [];
  const cached = immutableCatalogs.get(raw);
  if (cached) return cached.catalog;
  const counts = new Map();
  for (const row of raw) if (typeof row?.id === 'string') counts.set(row.id, (counts.get(row.id) || 0) + 1);
  const questions = raw.filter(question => eligible(question) && counts.get(question.id) === 1);
  const exams = [], legacyExams = [], byType = {};
  const versions = [
    ['TYT', PRACTICE_DISTRIBUTIONS.TYT, false],
    ['AYT', PRACTICE_DISTRIBUTIONS.AYT, false],
    ['TYT', LEGACY_TYT_DISTRIBUTION, true]
  ];
  for (const [type, definition, previousVersion] of versions) {
    const buckets = new Map(definition.topics.map(row => [row.id, []]));
    const excludedQuestionIds = [], exclusionReasons = {};
    for (const question of questions.filter(row => row.examType === type)) {
      const topicId = practiceTopicForQuestion(question), blueprint = definition.topics.find(row => row.id === topicId);
      if (!blueprint || !blueprint.count) {
        excludedQuestionIds.push(question.id);
        exclusionReasons[question.id] = blueprint ? 'zero_quota_in_2025' : 'topic_not_in_supplied_distribution';
      } else buckets.get(topicId).push(question);
    }
    for (const [id, bucket] of buckets) buckets.set(id, fairOrder(bucket));
    const topics = definition.topics.map(row => ({...row, available: buckets.get(row.id).length,
      missing: Math.max(0, row.count - buckets.get(row.id).length)}));
    const shortages = topics.filter(row => row.missing).map(row => ({topicId: row.id, label: row.label,
      required: row.count, available: row.available, missing: row.missing, section: row.section}));
    const examCount = Math.max(0, ...topics.filter(row => row.count && row.available).map(row => Math.ceil(row.available / row.count)));
    const actualCount = topics.reduce((sum, row) => sum + Math.min(row.count, row.available), 0);
    const matchedQuestionCount = topics.reduce((sum, row) => sum + row.available, 0);
    if (!previousVersion) byType[type] = {examCount, actualCount, targetCount: definition.targetCount, matchedQuestionCount,
      availableQuestionCount: questions.filter(row => row.examType === type).length,
      excludedQuestionIds: excludedQuestionIds.sort(compare), exclusionReasons, topics, shortages,
      reusedSlots: examCount * actualCount - matchedQuestionCount, completeDistribution: shortages.length === 0};
    for (let number = 1; number <= examCount; number++) {
      const questionIds = [], topicByQuestion = {};
      for (const row of topics) {
        const bucket = buckets.get(row.id), take = Math.min(row.count, bucket.length);
        for (let index = 0; index < take; index++) {
          const question = bucket[((number - 1) * take + index) % bucket.length];
          questionIds.push(question.id);
          topicByQuestion[question.id] = row.id;
        }
      }
      const manifest = hash(JSON.stringify([definition.distributionVersion, type, questionIds]));
      (previousVersion ? legacyExams : exams).push({id: `practice-2025-${type}-${number}-${manifest}`, type, number,
        label: `${number}. Deneme`, origin: 'AI_URETIMI', isOfficial: false,
        distributionVersion: definition.distributionVersion, manifest, questionIds, topicByQuestion,
        actualCount, targetCount: definition.targetCount, completeDistribution: shortages.length === 0, shortages,
        ...(previousVersion ? {retired: true, previousVersion: true} : {})});
    }
  }
  const allExams = [...exams, ...legacyExams], byId = new Map(allExams.map(exam => [exam.id, exam]));
  const catalog = freeze({schemaVersion: 1, distributionVersion: PRACTICE_DISTRIBUTION_VERSION, exams, legacyExams, allExams, byType,
    usableQuestionCount: questions.length, getExam: id => byId.get(id) || null});
  if (deeplyFrozen(raw)) immutableCatalogs.set(raw, {catalog, trusted: new Map(questions.map(question => [question.id, question]))});
  return catalog;
}

// Only a descriptor reproduced from the trusted eligible registry may be scored.
// An incomplete topic distribution can have a practice net for its actual size;
// it never becomes a 40-question or official ÖSYM result.
export function scorePracticeExam(exam, answers, registry) {
  if (!exam || typeof registry?.getQuestion !== 'function' || !Array.isArray(registry.questions) ||
      !Array.isArray(answers) || answers.length !== exam.actualCount ||
      Array.from(answers).some(answer => answer !== null && !LETTERS.includes(answer))) return null;
  const canonical = buildPracticeExamCatalog(registry.questions).getExam(exam.id);
  if (!canonical || ['type', 'number', 'distributionVersion', 'manifest', 'actualCount', 'targetCount'].some(field => exam[field] !== canonical[field]) ||
      JSON.stringify(exam.questionIds) !== JSON.stringify(canonical.questionIds)) return null;
  const trusted = immutableCatalogs.get(registry.questions)?.trusted || new Map(registry.questions.map(question => [question.id, question]));
  let correct = 0, wrong = 0, blank = 0;
  for (let index = 0; index < canonical.questionIds.length; index++) {
    const question = registry.getQuestion(canonical.questionIds[index]);
    if (!eligible(question) || question !== trusted.get(canonical.questionIds[index]) || question.examType !== canonical.type) return null;
    if (answers[index] === null) blank++;
    else if (answers[index] === question.answer.value) correct++;
    else wrong++;
  }
  return {correct, wrong, blank, net: correct - wrong / 4, total: canonical.actualCount, isOfficial: false};
}
