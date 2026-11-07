// One publication gate for the browser, tutor and import tools. Metadata is curator-
// reviewed evidence, never an automatic claim that a reachable page grants rights.
const EXAMS = new Set(['TYT','AYT','KPSS_ONLISANS','KPSS_ORTAOGRETIM','ALES','DGS','MEB']);
const DIFFICULTIES = new Set(['easy','medium','hard']);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value,max=500) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const year = value => Number.isInteger(value) && value >= 1900 && value <= 2100;
const https = value => {
  if(typeof value!=='string'||value.length>2000)return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}
};
const date = value => typeof value==='string' && value.length<=40 && Number.isFinite(Date.parse(value));
const exam = value => value === null || EXAMS.has(value);
function canonicalUrl(value){try{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key.toLowerCase()))u.searchParams.delete(key);u.searchParams.sort();return u.href}catch{return String(value)}}
function deepFreeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(deepFreeze)}return value}

export function validateQuestionBank(dataset){
  const issues=[];const bad=(path,message)=>issues.push({path,message});
  if(!object(dataset)||!Array.isArray(dataset.sources)||!Array.isArray(dataset.questions))return [{path:'bank',message:'Kaynak ve soru dizileri gerekli.'}];
  if(dataset.sources.length>10000||dataset.questions.length>100000)return [{path:'bank',message:'Soru bankası boyut sınırını aşıyor.'}];
  const sources=new Map(),questions=new Set(),locators=new Set();
  dataset.sources.forEach((s,i)=>{
    const p=`sources[${i}]`;
    if(!object(s)){bad(p,'Geçersiz kaynak.');return}
    if(!id(s.id)||sources.has(s.id))bad(p+'.id','Kaynak kimliği geçersiz veya yineleniyor.');else sources.set(s.id,s);
    for(const field of ['publisher','name','title'])if(!text(s[field]))bad(p+'.'+field,'Kaynak bilgisi eksik.');
    if(!(year(s.year)||s.year===null&&(s.examType??null)===null))bad(p+'.year','Yayın yılı gerekli; sınav dışı tarih belirtilmemiş kaynakta null kullanılabilir.');
    if(!exam(s.examType??null))bad(p+'.examType','Geçersiz sınav türü.');
    if(!https(s.originalUrl))bad(p+'.originalUrl','HTTPS özgün kaynak adresi gerekli.');
    if(!object(s.verification)||s.verification.status!=='verified'||!date(s.verification.checkedAt)||!https(s.verification.evidenceUrl))bad(p+'.verification','Kaynak doğrulama kanıtı eksik.');
    const l=s.license;
    if(!object(l)||l.status!=='verified'||!text(l.name)||!https(l.url)||!text(l.attribution,2000)||typeof l.allowsInline!=='boolean'||typeof l.allowsEmbed!=='boolean')bad(p+'.license','Doğrulanmış lisans, atıf ve açık gösterim izni gerekli.');
    if(s.pdfSha256!==undefined&&!/^[a-f0-9]{64}$/.test(s.pdfSha256))bad(p+'.pdfSha256','PDF SHA-256 biçimi geçersiz.');
    if(s.coverage!==undefined&&(!object(s.coverage)||typeof s.coverage.complete!=='boolean'||!Number.isInteger(s.coverage.mathQuestionCount)||s.coverage.mathQuestionCount<0||s.coverage.mathQuestionCount>40))bad(p+'.coverage','Sınav kapsamı geçersiz.');
    if(s.verification?.correctionsCheckedAt!==undefined&&!date(s.verification.correctionsCheckedAt))bad(p+'.verification.correctionsCheckedAt','Düzeltme denetim tarihi geçersiz.');
    if(s.verification?.correctionsEvidenceUrl!==undefined&&!https(s.verification.correctionsEvidenceUrl))bad(p+'.verification.correctionsEvidenceUrl','Düzeltme kanıtı geçersiz.');
    if(s.cancelledNumbers!==undefined&&(!Array.isArray(s.cancelledNumbers)||s.cancelledNumbers.some(n=>!Number.isInteger(n)||n<1||n>40)||new Set(s.cancelledNumbers).size!==s.cancelledNumbers.length))bad(p+'.cancelledNumbers','İptal soru listesi geçersiz.');
    if(l?.evidenceUrl!==undefined&&!https(l.evidenceUrl))bad(p+'.license.evidenceUrl','Lisans kanıt adresi geçersiz.');
  });
  dataset.questions.forEach((q,i)=>{
    const p=`questions[${i}]`;
    if(!object(q)){bad(p,'Geçersiz soru.');return}
    if(!id(q.id)||questions.has(q.id))bad(p+'.id','Soru kimliği geçersiz veya yineleniyor.');else questions.add(q.id);
    const s=sources.get(q.sourceId);if(!s)bad(p+'.sourceId','Kayıtlı kaynak bulunamadı.');
    if(!(year(q.year)||q.year===null&&(q.examType??null)===null)||s&&q.year!==s.year)bad(p+'.year','Soru ve kaynak yılı eşleşmeli.');
    if(!exam(q.examType??null)||s&&(q.examType??null)!==(s.examType??null))bad(p+'.examType','Soru ve kaynak sınav türü eşleşmeli.');
    if(!id(q.courseId)||!text(q.topic))bad(p+'.topic','Konu kimliği ve etiketi gerekli.');
    if(q.difficulty!==null&&!DIFFICULTIES.has(q.difficulty))bad(p+'.difficulty','Zorluk bilinmiyorsa null olmalı.');
    if(q.page!==null&&(!Number.isInteger(q.page)||q.page<1||q.page>10000))bad(p+'.page','Sayfa geçersiz.');
    if(q.section!==null&&!text(q.section,120))bad(p+'.section','Bölüm geçersiz.');
    if(q.page===null&&q.section===null)bad(p+'.locator','Sayfa veya bölüm gerekli.');
    if(!text(q.number,40))bad(p+'.number','Özgün soru numarası gerekli.');
    const canonical=v=>typeof v==='string'?v.normalize('NFKC').trim().toLocaleLowerCase('en-US'):null;const rawNumber=canonical(q.number);const canonicalNumber=rawNumber&&rawNumber.length<=40&&/^\d+$/.test(rawNumber)?String(BigInt(rawNumber)):rawNumber;const locator=JSON.stringify([canonicalUrl(s?.originalUrl||q.sourceId),canonical(q.section),q.page??null,canonicalNumber]);
    if(locators.has(locator))bad(p+'.locator','Aynı kaynak sorusu tekrar eklenemez.');else locators.add(locator);
    if(q.originalUrl!==undefined&&!https(q.originalUrl))bad(p+'.originalUrl','Soru kaynak adresi geçersiz.');
    if(q.status!=='published')bad(p+'.status','Statik bankaya yalnızca yayıma onaylı soru alınır.');
    if(!['inline','embed'].includes(q.displayMode)||q.displayMode==='inline'&&s?.license?.allowsInline!==true||q.displayMode==='embed'&&s?.license?.allowsEmbed!==true)bad(p+'.displayMode','Bu gösterim için kullanım izni yok.');
    if(q.displayMode==='inline'&&!text(q.prompt,12000)||q.displayMode==='embed'&&typeof q.prompt!=='string')bad(p+'.prompt','Soru metni gerekli.');
    if(q.displayMode==='embed'&&s?.license?.allowsInline!==true&&(q.prompt?.trim()||q.options?.length))bad(p+'.displayMode','Gömme izni, metin ve seçenekleri kopyalama izni vermez.');
    if(q.displayMode==='embed'&&!https(q.originalUrl||s?.originalUrl))bad(p+'.originalUrl','Gömülü kaynak adresi gerekli.');
    if(!Array.isArray(q.options)||q.options.length>5)bad(p+'.options','Seçenekler özgün kaynaktan dizi olmalı.');
    else{
      const optionIds=new Set();
      q.options.forEach((o,j)=>{if(!object(o)||!/^[ABCDE]$/.test(o.id)||!text(o.text,3000)||optionIds.has(o.id))bad(p+`.options[${j}]`,'Seçenek biçimi veya kimliği geçersiz.');else optionIds.add(o.id)});
      if(q.options.length===1)bad(p+'.options','Tek seçenekli soru kullanılamaz.');
      if(q.options.length&&(!q.answer||!optionIds.has(q.answer.value)))bad(p+'.answer','Doğru cevap özgün seçeneklerden biri olmalı.');
      if(['TYT','AYT'].includes(q.examType)&&(q.options.length!==5||'ABCDE'.split('').some(letter=>!optionIds.has(letter))))bad(p+'.options','TYT/AYT için özgün beş seçenek gerekli.');
    }
    if(!object(q.answer)||q.answer.status!=='verified'||!text(q.answer.value,2000)||!https(q.answer.evidenceUrl))bad(p+'.answer','Doğrulanmış cevap ve kanıt adresi gerekli.');
    if(q.contentHash!==undefined&&!/^[a-f0-9]{64}$/.test(q.contentHash))bad(p+'.contentHash','SHA-256 biçimi geçersiz.');
  });
  return issues;
}
export function createQuestionRegistry(dataset){
  const issues=validateQuestionBank(dataset);
  if(issues.length){const error=new Error('Soru bankası yayıma uygun değil.');error.issues=issues;throw error}
  const copied=JSON.parse(JSON.stringify(dataset));
  const sources=new Map(copied.sources.map(s=>[s.id,s]));
  const rows=deepFreeze(copied.questions.map(q=>({...q,source:sources.get(q.sourceId)})));
  const sourceRows=deepFreeze(copied.sources);
  const getQuestions=({courseId,examType,year,difficulty}={})=>rows.filter(q=>(courseId===undefined||q.courseId===courseId)&&(examType===undefined||(q.examType??null)===examType)&&(year===undefined||q.year===year)&&(difficulty===undefined||q.difficulty===difficulty));
  const getQuestion=questionId=>rows.find(q=>q.id===questionId)||null;
  const officialUrl=url=>{try{const host=new URL(url).hostname;return host==='osym.gov.tr'||host.endsWith('.osym.gov.tr')}catch{return false}};
  const getExam=(type,examYear)=>{
    if(!['TYT','AYT'].includes(type)||!Number.isInteger(examYear))return null;
    const questions=getQuestions({examType:type,year:examYear});
    if(questions.length!==40||new Set(questions.map(q=>q.sourceId)).size!==1)return null;
    const source=questions[0].source;if(source.coverage?.complete!==true||source.coverage?.mathQuestionCount!==40||!date(source.verification.correctionsCheckedAt)||!officialUrl(source.verification.correctionsEvidenceUrl)||!Array.isArray(source.cancelledNumbers)||source.cancelledNumbers.length!==0)return null;if(source.publisher!=='ÖSYM'||!officialUrl(source.originalUrl)||!officialUrl(source.verification.evidenceUrl)||questions.some(q=>!officialUrl(q.answer.evidenceUrl)||q.originalUrl&&!officialUrl(q.originalUrl)))return null;
    const ordered=questions.slice().sort((a,b)=>Number(a.number)-Number(b.number));
    if(ordered.some((q,i)=>q.number!==String(i+1)||q.options.length!==5||!/^([ABCDE])$/.test(q.answer.value)))return null;
    return deepFreeze({type,year:examYear,source:ordered[0].source,questions:ordered,answerKey:ordered.map(q=>q.answer.value).join(''),count:40});
  };
  return Object.freeze({sources:sourceRows,questions:rows,getQuestions,getQuestion,getExam});
}
export function getEligibleQuestions(dataset,filters={}){try{return createQuestionRegistry(dataset).getQuestions(filters)}catch{return []}}
export function getPublishedQuestionById(dataset,questionId){try{return createQuestionRegistry(dataset).getQuestion(questionId)}catch{return null}}
export function verifiedExam(dataset,type,year){try{return createQuestionRegistry(dataset).getExam(type,year)}catch{return null}}
