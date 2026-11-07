// Private-device grading never turns a user-entered key into an official key.
// The trusted catalog is reviewed code; imported JSON and local metadata are not.
export const PRIVATE_EXAM_TYPES=Object.freeze(['TYT','AYT','KPSS_ONLISANS','KPSS_ORTAOGRETIM','ALES','DGS','MEB','OTHER']);
// Suggestions only. A user's actual booklet count must be confirmed explicitly.
export const SUGGESTED_COUNTS=Object.freeze({TYT:40,AYT:40,KPSS_ONLISANS:30,KPSS_ORTAOGRETIM:30,ALES:50,DGS:50});
const own=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isInteger(value)&&value>=1&&value<=100;
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}};
const date=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const officialUrl=(value,type)=>{if(!https(value))return false;const host=new URL(value).hostname;const domain=type==='MEB'?'meb.gov.tr':'osym.gov.tr';return host===domain||host.endsWith('.'+domain)};
const boundOfficialKeys=new WeakMap();
const integer=value=>typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):NaN;
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v)}return value};
export function normalizeBookletMetadata(input){
 if(!own(input))throw new TypeError('Kitapçık bilgileri gerekli.');
 const examType=input.examType;if(!PRIVATE_EXAM_TYPES.includes(examType))throw new TypeError('Sınav türü geçersiz.');
 const year=input.year===''||input.year==null?null:integer(input.year);
 if(year!==null&&(!Number.isInteger(year)||year<2018||year>2026)||year===null&&examType!=='OTHER')throw new TypeError('2018–2026 arasında bir sınav yılı seç.');
 if(!text(input.sourceTitle,250))throw new TypeError('Kaynak veya kitapçık adı gerekli.');
 const questionCount=integer(input.questionCount),mathStartPage=integer(input.mathStartPage??1);
 if(!count(questionCount))throw new TypeError('Soru sayısı 1–100 arasında tam sayı olmalı.');
 if(!Number.isInteger(mathStartPage)||mathStartPage<1||mathStartPage>1000)throw new TypeError('Başlangıç sayfası 1–1000 arasında olmalı.');
 const sourceUrl=input.sourceUrl==null||input.sourceUrl===''?null:input.sourceUrl;
 if(sourceUrl!==null&&(!https(sourceUrl)||sourceUrl.length>2000))throw new TypeError('Kaynak adresi geçerli bir HTTPS adresi olmalı.');
 const bookletId=input.bookletId==null||input.bookletId===''?null:input.bookletId;
 if(bookletId!==null&&!identifier(bookletId))throw new TypeError('Kitapçık kimliği geçersiz.');
 const questionNumbers=input.questionNumbers??Array.from({length:questionCount},(_,i)=>i+1);
 if(!Array.isArray(questionNumbers)||questionNumbers.length!==questionCount||questionNumbers.some(n=>!Number.isInteger(n)||n<1||n>200)||new Set(questionNumbers).size!==questionCount)throw new TypeError('Özgün soru numaraları sayıyla eşleşmeli; 1–200 arasında benzersiz olmalı.');
 return {examType,year,sourceTitle:input.sourceTitle.trim(),sourceUrl,mathStartPage,questionCount,bookletId,questionNumbers:questionNumbers.slice()};
}
export function parseAnswerKey(input,questionCount){
 if(!count(questionCount))throw new TypeError('Soru sayısı geçersiz.');
 // Imported flags, URLs and claimed verification never survive this parser.
 const raw=typeof input==='string'?input:own(input)&&typeof input.key==='string'?input.key:null;
 if(raw===null||raw.length>2000)throw new TypeError('Cevap anahtarı metni gerekli.');
 const key=raw.toUpperCase().replace(/\s+/g,'');
 if(key.length!==questionCount||!/^[ABCDE]+$/.test(key))throw new TypeError(`Tam ${questionCount} adet A–E cevabı gir.`);
 return freeze({key,questionCount,provenance:'user-entered',verified:false});
}
// Validates reviewed source facts but does not yet bind them to an imported file.
export function verifiedOfficialKey(candidate){
 if(!own(candidate)||!identifier(candidate.id)||!text(candidate.title,250)||!PRIVATE_EXAM_TYPES.includes(candidate.examType)||candidate.examType==='OTHER')return null;
 if(!Number.isInteger(candidate.year)||candidate.year<2018||candidate.year>2026||!count(candidate.questionCount))return null;
 const type=candidate.examType,n=candidate.questionCount,verification=candidate.verification;
 if(!own(verification)||verification.status!=='verified'||verification.answerKeyVerified!==true||verification.coverageVerified!==true||!date(verification.checkedAt)||!date(verification.correctionsCheckedAt)||!officialUrl(verification.correctionsEvidenceUrl,type))return null;
 if(!officialUrl(candidate.originalUrl,type)||!officialUrl(candidate.answerKeyEvidenceUrl,type)||candidate.pdfSha256!==undefined&&candidate.pdfSha256!==null&&!sha(candidate.pdfSha256))return null;
 if(candidate.scoringPolicy!=='four-wrong-one-correct'||!Array.isArray(candidate.cancelledNumbers)||candidate.cancelledNumbers.length!==0)return null;
 const numbers=candidate.questionNumbers;
 if(!Array.isArray(numbers)||numbers.length!==n||numbers.some((v,i)=>!Number.isInteger(v)||v<1||v>200||i>0&&v!==numbers[i-1]+1))return null;
 if(['TYT','AYT'].includes(type)&&(n!==40||numbers[0]!==1))return null;
 let parsed;try{parsed=parseAnswerKey(candidate.answerKey,n)}catch{return null}
 return freeze({key:parsed.key,questionCount:n,provenance:'official-source',verified:true,examId:candidate.id,examType:type,year:candidate.year,pdfSha256:candidate.pdfSha256||null,questionNumbers:numbers.slice(),evidenceUrl:candidate.answerKeyEvidenceUrl,correctionsEvidenceUrl:verification.correctionsEvidenceUrl,cancelledNumbers:[],scoringPolicy:candidate.scoringPolicy});
}
export function getTrustedExam(exams,examId){
 if(!Array.isArray(exams)||!identifier(examId))return null;
 const matches=exams.filter(row=>row?.id===examId);if(matches.length!==1)return null;
 return verifiedOfficialKey(matches[0])?freeze(JSON.parse(JSON.stringify(matches[0]))):null;
}
export function trustedKeyForBooklet(exams,booklet){
 if(!own(booklet))return null;
 let metadata;try{metadata=normalizeBookletMetadata(booklet.metadata||booklet)}catch{return null}
 const entry=getTrustedExam(exams,metadata.bookletId);if(!entry)return null;
 if(entry.examType!==metadata.examType||entry.year!==metadata.year||entry.questionCount!==metadata.questionCount||entry.questionNumbers.some((n,i)=>n!==metadata.questionNumbers[i])||!sha(booklet.sha256)||entry.pdfSha256!==booklet.sha256)return null;
 const key=freeze({...verifiedOfficialKey(entry),fileIdentity:'sha256',fileVerified:true,boundBookletSha256:booklet.sha256});boundOfficialKeys.set(key,{fileIdentity:'sha256',fileVerified:true});return key;
}
// The user may explicitly confirm the edition/identity when the source PDF hash
// cannot be obtained. This verifies the key, not the uploaded file's identity.
export function confirmedOfficialKeyForBooklet(exams,booklet,binding){
 if(!own(booklet)||!own(binding)||binding.confirmed!==true||!identifier(binding.examId)||!sha(booklet.sha256))return null;
 let metadata;try{metadata=normalizeBookletMetadata(booklet.metadata||booklet)}catch{return null}
 if(metadata.bookletId!==binding.examId)return null;
 const entry=getTrustedExam(exams,binding.examId);if(!entry)return null;
 if(entry.examType!==metadata.examType||entry.year!==metadata.year||entry.questionCount!==metadata.questionCount||entry.questionNumbers.some((n,i)=>n!==metadata.questionNumbers[i]))return null;
 // A known conflicting hash is stronger evidence than a manual identity claim.
 if(entry.pdfSha256&&entry.pdfSha256!==booklet.sha256)return null;
 const key=freeze({...verifiedOfficialKey(entry),fileIdentity:'user-confirmed',fileVerified:false,boundBookletSha256:booklet.sha256});
 boundOfficialKeys.set(key,{fileIdentity:'user-confirmed',fileVerified:false});return key;
}
const unscored=(reason,extra={})=>({status:'unscored',verified:false,correct:null,wrong:null,blank:null,net:null,reason,...extra});
export function scorePrivateExam(answers,keyInfo,{manual=false}={}){
 if(!Array.isArray(answers)||!count(answers.length)||answers.some(a=>a!==null&&a!==undefined&&!/^[ABCDE]$/.test(a)))return unscored('Cevap kâğıdı geçersiz.');
 if(!own(keyInfo))return unscored('Doğrulanmış cevap anahtarı bulunmuyor.');
 const identity=boundOfficialKeys.get(keyInfo),official=!!identity;
 if(!official&&!manual)return unscored('Kullanıcı anahtarı resmî olarak doğrulanmış sayılmaz; otomatik puanlama kapalı.');
 if(Array.isArray(keyInfo.cancelledNumbers)&&keyInfo.cancelledNumbers.length)return unscored('İptal edilen sorular için doğrulanmış puanlama politikası yok.');
 let normalized;try{normalized=parseAnswerKey(keyInfo,answers.length)}catch{return unscored('Cevap anahtarı soru sayısı veya biçimiyle eşleşmiyor.')}
 if(keyInfo.questionCount!==undefined&&keyInfo.questionCount!==answers.length)return unscored('Anahtar ve kitapçık soru sayısı eşleşmiyor.');
 let correct=0,wrong=0,blank=0;
 answers.forEach((value,i)=>{if(value===null||value===undefined)blank++;else if(value===normalized.key[i])correct++;else wrong++});
 return {status:'scored',verified:official,correct,wrong,blank,net:correct-wrong/4,provenance:official?'official-source':'user-entered',fileIdentity:official?identity.fileIdentity:'unverified',fileVerified:official?identity.fileVerified:false,examId:official?keyInfo.examId:null,reason:official?(identity.fileVerified?'Kaynak anahtarı ve dosya özeti eşleşmesi doğrulandı.':'ÖSYM/MEB kaynak anahtarı doğrulandı; PDF kimliği kullanıcı beyanına dayanır.'):'Kullanıcının girdiği anahtara göre manuel çalışma neti; resmî doğrulama değildir.'};
}
