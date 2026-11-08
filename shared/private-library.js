// Private device-only storage. This module never calls fetch, Supabase or a Worker.
// Owner scoping is a local application boundary, not encryption against scripts on this origin.
export const PRIVATE_LIBRARY_DATABASE = 'MatematikAkademimPrivateLibraryV1';
export const MAX_PRIVATE_PDF_BYTES = 50 * 1024 * 1024;
import {PRIVATE_EXAM_TYPES} from './private-exam.js';
export {PRIVATE_EXAM_TYPES};
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const hashId = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const plainText = (value,max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
function storageError(error) {
  if (error?.name === 'QuotaExceededError') return new Error('Cihaz depolama alanı dolu. Dosya kaydedilemedi; mevcut kayıtlar korunuyor.');
  return new Error('Özel kitapçık deposuna erişilemedi. Tarayıcı depolama izinlerini kontrol et.');
}
function ownerId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) throw new TypeError('Geçerli bir yerel kullanıcı kimliği gerekli.');
  return value;
}
export function sanitizePrivateFilename(value) {
  const raw = typeof value === 'string' ? value.normalize('NFKC') : 'kitapcik.pdf';
  const safe = raw.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').replace(/^\.+/, '').trim().slice(0,170) || 'kitapcik';
  return /\.pdf$/i.test(safe) ? safe : safe + '.pdf';
}
export function validatePrivateMetadata(input) {
  if (!object(input) || !PRIVATE_EXAM_TYPES.includes(input.examType)) throw new TypeError('Sınav türünü seçmelisin.');
  if (!plainText(input.sourceTitle,200)) throw new TypeError('Kitapçığın kaynak adını en fazla 200 karakterle yaz.');
  const year = input.year === null || input.year === undefined || input.year === '' ? null : Number(input.year);
  if (!(Number.isInteger(year) && year >= 2018 && year <= 2026) && !(input.examType === 'OTHER' && year === null)) throw new TypeError('2018–2026 aralığında geçerli bir sınav yılı seç.');
  const mathStartPage = input.mathStartPage === undefined ? 1 : Number(input.mathStartPage);
  if (!Number.isInteger(mathStartPage) || mathStartPage < 1 || mathStartPage > 1000) throw new TypeError('Matematik başlangıç sayfası 1–1000 aralığında olmalı.');
  const questionCount = Number(input.questionCount);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) throw new TypeError('Soruların sayısını 1–100 aralığında belirt.');
  let sourceUrl = null;
  if (input.sourceUrl !== null && input.sourceUrl !== undefined && input.sourceUrl !== '') {
    try { const url = new URL(input.sourceUrl); if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 2000) throw new Error(); sourceUrl = url.href; }
    catch { throw new TypeError('Kaynak bağlantısı kimlik bilgisi içermeyen HTTPS adresi olmalı.'); }
  }
  let bookletId = null;
  if (input.bookletId !== null && input.bookletId !== undefined && input.bookletId !== '') {
    if (!plainText(input.bookletId,120)) throw new TypeError('Kitapçık kimliği geçersiz.');
    bookletId = input.bookletId.trim();
  }
  const questionNumbers=input.questionNumbers??Array.from({length:questionCount},(_,i)=>i+1);
  if(!Array.isArray(questionNumbers)||questionNumbers.length!==questionCount||questionNumbers.some(n=>!Number.isInteger(n)||n<1||n>200)||new Set(questionNumbers).size!==questionCount)throw new TypeError('Özgün soru numaraları sayıyla eşleşmeli; 1–200 arasında benzersiz olmalı.');
  return {examType:input.examType,year,sourceTitle:input.sourceTitle.trim(),sourceUrl,mathStartPage,questionCount,bookletId,questionNumbers:questionNumbers.slice()};
}
export function normalizePrivateAnswerKey(value,questionCount) {
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) throw new TypeError('Cevap sayısı geçersiz.');
  if (value === undefined || value === null || value === '') return null;
  const raw = object(value) ? value.value : value;
  if (typeof raw !== 'string') throw new TypeError('Cevap anahtarını A–E harfleriyle gir.');
  const normalized = raw.toUpperCase().replace(/\s+/g, '');
  if (!new RegExp('^[ABCDE]{'+questionCount+'}$').test(normalized)) throw new TypeError('Cevap anahtarı tam '+questionCount+' adet A–E harfi içermeli.');
  // A caller cannot turn a typed key into an official or independently verified one.
  return {value:normalized,provenance:'user-entered',verified:false};
}
const PRIVATE_TOPICS = new Set(['Sayılar','Denklemler','Fonksiyonlar','Geometri','Olasılık ve istatistik','Trigonometri','Logaritma ve diziler','Limit, türev ve integral']);
export function normalizePrivateProgress(input,questionCount,now=Date.now()) {
  if (input === null) return null;
  if (!object(input) || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) throw new TypeError('Çalışma kaydı geçersiz.');
  if (!Array.isArray(input.answers) || input.answers.length !== questionCount || input.answers.some(a=>a!==null&&!/^[ABCDE]$/.test(a))) throw new TypeError('Cevap kaydı kitapçığın soru sayısıyla eşleşmiyor.');
  if (!Number.isInteger(input.index) || input.index < 0 || input.index >= questionCount) throw new TypeError('Geçerli bir soru konumu gerekli.');
  const startedAt=input.startedAt;
  if (!Number.isFinite(startedAt) || startedAt <= 0 || startedAt > now) throw new TypeError('Çalışma başlangıç zamanı geçersiz.');
  const pausedAt=input.pausedAt ?? null,pausedMs=input.pausedMs ?? 0;
  if (pausedAt!==null && (!Number.isFinite(pausedAt) || pausedAt < startedAt || pausedAt > now)) throw new TypeError('Duraklatma zamanı geçersiz.');
  if (!Number.isFinite(pausedMs) || pausedMs < 0 || pausedMs > now-startedAt || pausedAt!==null&&pausedMs>pausedAt-startedAt) throw new TypeError('Duraklama süresi geçersiz.');
  const finishedDuration=input.finishedDuration ?? null;
  if (finishedDuration!==null && (!Number.isInteger(finishedDuration) || finishedDuration < 0 || finishedDuration > Math.floor((now-startedAt)/1000))) throw new TypeError('Bitiş süresi geçersiz.');
  let finishedAt=input.finishedAt ?? null;
  if (finishedAt!==null) { const at=typeof finishedAt==='string'?Date.parse(finishedAt):NaN;if (!Number.isFinite(at) || at < startedAt || at > now) throw new TypeError('Bitiş tarihi geçersiz.');finishedAt=new Date(at).toISOString(); }
  if ((finishedAt===null)!==(finishedDuration===null)) throw new TypeError('Bitiş tarihi ve süresi birlikte saklanmalı.');
  const limitSeconds=input.limitSeconds ?? 0;
  if (!Number.isInteger(limitSeconds) || limitSeconds < 0 || limitSeconds > 86400) throw new TypeError('Süre sınırı geçersiz.');
  const pdfPage=input.pdfPage==null?null:input.pdfPage;
  if(pdfPage!==null&&(!Number.isInteger(pdfPage)||pdfPage<1||pdfPage>1000))throw new TypeError('PDF sayfa kaydı geçersiz.');
  const questionPages=Array.from({length:questionCount},(_,i)=>input.questionPages?.[i]??null);
  if(questionPages.some(page=>page!==null&&(!Number.isInteger(page)||page<1||page>1000)))throw new TypeError('Soru sayfa eşleştirmesi geçersiz.');
  let score=null;
  if (input.score!==null && input.score!==undefined) {
    const value=input.score,cancelled=value.cancelled ?? 0;
    if (!object(value) || ![value.correct,value.wrong,value.blank,cancelled].every(v=>Number.isInteger(v)&&v>=0&&v<=questionCount) || value.correct+value.wrong+value.blank+cancelled!==questionCount || value.net!==value.correct-value.wrong/4 || finishedAt===null) throw new TypeError('Sonuç kaydı geçersiz.');
    score={correct:value.correct,wrong:value.wrong,blank:value.blank,cancelled,net:value.net};
  }
  let binding=null;
  if(input.binding!==null&&input.binding!==undefined){
    const value=input.binding,confirmed=typeof value?.confirmedAt==='string'?Date.parse(value.confirmedAt):NaN;
    if(!object(value)||typeof value.examId!=='string'||! /^[a-zA-Z0-9_-]{1,120}$/.test(value.examId)||!Number.isFinite(confirmed)||confirmed<=0||confirmed>now)throw new TypeError('Kitapçık eşleştirme onayı geçersiz.');
    binding={examId:value.examId,confirmedAt:new Date(confirmed).toISOString()};
  }
  return {answers:input.answers.slice(),index:input.index,binding,pdfPage,questionPages,
    flags:Array.from({length:questionCount},(_,i)=>input.flags?.[i]===true),
    topics:Array.from({length:questionCount},(_,i)=>PRIVATE_TOPICS.has(input.topics?.[i])?input.topics[i]:null),
    startedAt,pausedAt,pausedMs,finishedDuration,finishedAt,limitSeconds,score};
}
export async function preparePrivatePdf(blob,cryptoProvider=globalThis.crypto) {
  if (!(blob instanceof Blob) || blob.size < 5 || blob.size > MAX_PRIVATE_PDF_BYTES) throw new TypeError('PDF dosyası 50 MB sınırını aşmamalı.');
  if (await blob.slice(0,5).text() !== '%PDF-') throw new TypeError('Geçerli bir PDF dosyası seçmelisin.');
  if (!cryptoProvider?.subtle) throw new Error('Dosya güvenlik özeti oluşturulamadı. HTTPS veya güvenli yerel bağlantı kullan.');
  const digest = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',await blob.arrayBuffer()));
  const sha256 = Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
  // Filename and supplied MIME are untrusted, even when the signature is present.
  return {blob:new Blob([blob],{type:'application/pdf'}),sha256,byteLength:blob.size};
}
function safeRecord(record){
 const metadata=validatePrivateMetadata(record.metadata);
 return {...record,metadata,answerKey:normalizePrivateAnswerKey(record.answerKey,metadata.questionCount),progress:record.progress?normalizePrivateProgress(record.progress,metadata.questionCount):null};
}
function summary(record){if(!record)return null;const {owner,blob,...value}=safeRecord(record);return value;}
function fullRecord(record){if(!record)return null;const {owner,...value}=safeRecord(record);return {...value,blob:new Blob([record.blob],{type:'application/pdf'})};}
function sameExamIdentity(first,second){return ['examType','year','questionCount','bookletId','questionNumbers'].every(key=>JSON.stringify(first[key])===JSON.stringify(second[key]));}
export function openPrivateLibrary(owner,options={}) {
  const scopedOwner=ownerId(owner),factory=options.indexedDB ?? globalThis.indexedDB;
  let databasePromise=null;
  const now=options.now ?? (()=>new Date().toISOString());
  function database() {
    if (databasePromise) return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      if (!factory?.open) { reject(new Error('Bu tarayıcı özel dosya saklamayı desteklemiyor.')); return; }
      let request;try { request=factory.open(PRIVATE_LIBRARY_DATABASE,1); } catch(error) { reject(storageError(error)); return; }
      request.onupgradeneeded=()=>{const db=request.result;if (!db.objectStoreNames.contains('books')) {const store=db.createObjectStore('books',{keyPath:['owner','id']});store.createIndex('owner','owner',{unique:false});store.createIndex('ownerHash',['owner','sha256'],{unique:true});}};
      request.onerror=()=>reject(storageError(request.error));
      request.onblocked=()=>reject(new Error('Özel depo başka bir sekmede güncelleniyor. Diğer uygulama sekmelerini kapatıp yeniden dene.'));
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();databasePromise=null};resolve(db)};
    }).catch(error=>{databasePromise=null;throw error});
    return databasePromise;
  }
  const validId=id=>{if (!hashId(id)) throw new TypeError('Kitapçık kimliği geçersiz.');return id;};
  async function read(id) {
    validId(id);const db=await database();
    return new Promise((resolve,reject)=>{const tx=db.transaction('books','readonly'),request=tx.objectStore('books').get([scopedOwner,id]);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(storageError(request.error));tx.onabort=()=>reject(storageError(tx.error));});
  }
  async function writeRecord(id,build) {
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('books','readwrite'),store=tx.objectStore('books');let record=null,ownError=null;
      tx.oncomplete=()=>{try{resolve(fullRecord(record))}catch(error){reject(error)}};tx.onabort=()=>reject(ownError||storageError(tx.error));tx.onerror=()=>{};
      const request=store.get([scopedOwner,id]);request.onsuccess=()=>{try{record=build(request.result||null);store.put(record)}catch(error){ownError=error;tx.abort()}};
    });
  }
  return Object.freeze({
    owner:scopedOwner,
    async list(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('books','readonly'),request=tx.objectStore('books').index('owner').getAll(scopedOwner);request.onsuccess=()=>{try{resolve(request.result.map(summary).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))}catch(error){reject(error)}};request.onerror=()=>reject(storageError(request.error));tx.onabort=()=>reject(storageError(tx.error));});},
    async get(id){return fullRecord(await read(id));},
    async put(input){
      if (!object(input)) throw new TypeError('Kitapçık kaydı geçersiz.');
      const metadata=validatePrivateMetadata(input.metadata),prepared=await preparePrivatePdf(input.blob,options.crypto ?? globalThis.crypto);
      if (input.id !== undefined && input.id !== prepared.sha256) throw new TypeError('Kitapçık kimliği dosyayla eşleşmiyor.');
      return writeRecord(prepared.sha256,existing=>{
        const keyValue=input.answerKey === undefined ? existing?.answerKey ?? null : input.answerKey;
        if(existing?.progress&&!sameExamIdentity(validatePrivateMetadata(existing.metadata),metadata))throw new Error('Kaydı olan çalışmanın sınav kimliği veya soru sırası değiştirilemez; mevcut cevaplar korunuyor.');
        const answerKey=normalizePrivateAnswerKey(keyValue,metadata.questionCount),time=now();
        return {owner:scopedOwner,id:prepared.sha256,sha256:prepared.sha256,blob:prepared.blob,byteLength:prepared.byteLength,metadata,
          progress:existing?.progress??null,fileName:sanitizePrivateFilename(input.fileName ?? input.blob.name ?? existing?.fileName ?? metadata.sourceTitle),answerKey,createdAt:existing?.createdAt||time,updatedAt:time};
      });
    },
    async update(id,changes){
      validId(id);if (!object(changes)) throw new TypeError('Kitapçık güncellemesi geçersiz.');
      return writeRecord(id,existing=>{
        if (!existing) throw new Error('Bu hesaba ait kitapçık bulunamadı.');
        const rawMetadata=changes.metadata===undefined?existing.metadata:{...existing.metadata,...changes.metadata};
        if(changes.metadata?.questionCount!==undefined&&changes.metadata.questionNumbers===undefined&&(!existing.metadata.questionNumbers||existing.metadata.questionNumbers.every((n,i)=>n===i+1)))delete rawMetadata.questionNumbers;
        const metadata=validatePrivateMetadata(rawMetadata);
        if(existing.progress&&!sameExamIdentity(validatePrivateMetadata(existing.metadata),metadata))throw new Error('Kaydı olan çalışmanın sınav kimliği veya soru sırası değiştirilemez; mevcut cevaplar korunuyor.');
        const answerKey=normalizePrivateAnswerKey(changes.answerKey===undefined?existing.answerKey:changes.answerKey,metadata.questionCount);
        return {...existing,metadata,answerKey,updatedAt:now()};
      });
    },
    async saveProgress(id,progress){
      validId(id);return writeRecord(id,existing=>{
        if(!existing)throw new Error('Bu hesaba ait kitapçık bulunamadı.');
        return {...existing,progress:normalizePrivateProgress(progress,existing.metadata.questionCount),updatedAt:now()};
      });
    },
    async remove(id){
      validId(id);const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('books','readwrite'),store=tx.objectStore('books');let removed=false;const request=store.get([scopedOwner,id]);request.onsuccess=()=>{removed=!!request.result;if(removed)store.delete([scopedOwner,id])};tx.oncomplete=()=>resolve(removed);tx.onabort=()=>reject(storageError(tx.error));tx.onerror=()=>{};});
    },
    async close(){if(databasePromise){const db=await databasePromise;db.close();databasePromise=null;}}
  });
}
