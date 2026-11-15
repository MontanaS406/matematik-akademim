const MAGIC = new Uint8Array([77,65,65,82,67,49,0,0]);
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const letters = value => value === null || /^[ABCDE]$/.test(value);
export function decodeArchiveKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw Error('Erişim anahtarı geçersiz.');
  const raw = Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='),char=>char.charCodeAt(0));
  if (raw.length !== 32) throw Error('Erişim anahtarı geçersiz.');
  return raw;
}
export function archiveAssetUrl(path, base = new URL('../', import.meta.url)) {
  if (typeof path !== 'string' || !/^assets\/personal-archive\/personal-[a-f0-9]{16}\/(?:index|pdf-[a-f0-9]+-\d{4,5})\.bin$/.test(path)) throw Error('Arşiv adresi geçersiz.');
  return new URL(path,base).href;
}
export async function decryptArchiveAsset(bytes, key, bundleId, resource, expectedHash) {
  const data = new Uint8Array(bytes);
  if (!/^personal-[a-f0-9]{16}$/.test(bundleId) || typeof resource !== 'string' || resource.length > 200 ||
      data.length < 36 || MAGIC.some((n,i)=>data[i]!==n) || !/^[a-f0-9]{64}$/.test(expectedHash)) throw Error('Arşiv verisi geçersiz.');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if (hash !== expectedHash) throw Error('Arşiv dosyası eksik veya değişmiş.');
  const cryptoKey = await crypto.subtle.importKey('raw',decodeArchiveKey(key),'AES-GCM',false,['decrypt']);
  return crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(8,20),additionalData:new TextEncoder().encode(bundleId+':'+resource)},cryptoKey,data.slice(20));
}
export function createPersonalArchive(index) {
  if (!index || index.version !== 1 || !/^personal-[a-f0-9]{16}$/.test(index.id) || !Array.isArray(index.documents) ||
      !Array.isArray(index.questions) || !Array.isArray(index.exams) || index.documents.length > 1000 || index.questions.length > 100000) throw Error('Arşiv kataloğu geçersiz.');
  const documents = new Map(), questions = new Map(), exams = new Map();
  for (const doc of index.documents) {
    if (!identifier(doc.id) || documents.has(doc.id) || !Array.isArray(doc.pages) || !doc.pages.length || doc.pages.length > 10000) throw Error('Kaynak kaydı geçersiz.');
    for (const [i,page] of doc.pages.entries()) {
      if (page.number !== i+1 || !Array.isArray(page.rect) || page.rect.length !== 4 || !page.rect.every(Number.isFinite) ||
          page.rect[2] <= page.rect[0] || page.rect[3] <= page.rect[1] || !Number.isInteger(page.width) || !Number.isInteger(page.height) ||
          page.width < 1 || page.height < 1 || page.width > 10000 || page.height > 10000 ||
          page.resource !== 'page/'+doc.id+'/'+page.number || !/^[a-f0-9]{64}$/.test(page.sha256)) throw Error('Kaynak sayfası geçersiz.');
      archiveAssetUrl(page.asset);
    }
    documents.set(doc.id,doc);
  }
  for (const q of index.questions) {
    if (!identifier(q.id) || questions.has(q.id) || q.origin !== 'ORIJINAL' || !documents.has(q.docId) || !Array.isArray(q.parts) ||
        !Array.isArray(q.options) || q.options.length > 5 || !q.answer || !['independently_checked','publisher_unchecked','missing'].includes(q.answer.status)) throw Error('Soru kaydı geçersiz.');
    for (const part of q.parts) if (!Number.isInteger(part.page) || !documents.get(q.docId).pages[part.page-1] ||
      part.rect !== null && (!Array.isArray(part.rect) || part.rect.length !== 4 || !part.rect.every(Number.isFinite) || part.rect[2]<=part.rect[0] || part.rect[3]<=part.rect[1])) throw Error('Soru konumu geçersiz.');
    if (q.answer.status === 'independently_checked' && q.mathPassed !== true) throw Error('Soru doğrulama durumu eşleşmiyor.');
    questions.set(q.id,q);
  }
  for (const exam of index.exams) {
    if (!identifier(exam.id) || exams.has(exam.id) || exam.origin !== 'ORIJINAL' || exam.isOfficial !== false || exam.type !== 'TYT' ||
        !documents.has(exam.docId) || !documents.has(exam.keyDocId) || !documents.get(exam.keyDocId).pages[exam.keyPage-1] ||
        !Array.isArray(exam.questionIds) || exam.questionIds.length !== 40 || new Set(exam.questionIds).size !== 40 ||
        exam.actualCount !== 40 || exam.targetCount !== 40 || !/^[ABCDE]{40}$/.test(exam.answerKey) ||
        exam.keyKind !== 'publisher' || exam.keyVerified !== true || !/^[a-f0-9]{64}$/.test(exam.manifest)) throw Error('Deneme kaydı geçersiz.');
    for (const [i,id] of exam.questionIds.entries()) {
      const q=questions.get(id);
      if (!q || q.docId !== exam.docId || q.number !== i+1 || q.examType !== 'TYT' || q.answer.value !== exam.answerKey[i]) throw Error('Deneme ve yayınevi anahtarı eşleşmiyor.');
    }
    exams.set(exam.id,exam);
  }
  if (index.counts?.documents !== documents.size || index.counts?.pages !== [...documents.values()].reduce((n,d)=>n+d.pages.length,0) ||
      index.counts?.records !== questions.size || index.counts?.exams !== exams.size) throw Error('Arşiv kapsamı eşleşmiyor.');
  const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
  freeze(index);
  return Object.freeze({id:index.id,counts:index.counts,documents:Object.freeze([...documents.values()]),questions:Object.freeze([...questions.values()]),exams:Object.freeze([...exams.values()]),
    getQuestion:id=>questions.get(id)||null,getDocument:id=>documents.get(id)||null,getExam:id=>exams.get(id)||null});
}
export function scoreOriginalArchiveExam(exam, answers, archive) {
  const canonical=archive?.getExam(exam?.id);
  if (!canonical || canonical !== exam || !Array.isArray(answers) || answers.length !== 40 || Array.from(answers).some(value=>!letters(value)) ||
      exam.keyVerified !== true || exam.keyKind !== 'publisher' || exam.isOfficial !== false) return null;
  let correct=0,wrong=0,blank=0;
  for (let i=0;i<40;i++) {
    const q=archive.getQuestion(exam.questionIds[i]);
    if (!q || q.docId!==exam.docId || q.number!==i+1 || q.answer.value!==exam.answerKey[i]) return null;
    if(answers[i]===null)blank++;else if(answers[i]===exam.answerKey[i])correct++;else wrong++;
  }
  return {correct,wrong,blank,net:correct-wrong/4,total:40,isOfficial:false};
}
