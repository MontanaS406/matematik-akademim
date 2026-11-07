import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {QUESTION_BANK} from '../data/question-bank.js';
import {validateQuestionBank} from '../shared/question-bank.js';
import {getCourse} from '../shared/curriculum.js';
export function auditBank(bank=QUESTION_BANK){
 const errors=validateQuestionBank(bank);if(errors.length)throw Error(JSON.stringify(errors));
 for(const question of bank.questions){
  if(!getCourse(question.courseId))throw Error('Kayıtlı konu bulunamadı: '+question.id);
  const hash=crypto.createHash('sha256').update(JSON.stringify({prompt:question.prompt,options:question.options})).digest('hex');
  if(question.contentHash!==hash)throw Error('Soru içeriği inceleme özetiyle eşleşmiyor: '+question.id);
 }
 for(const source of bank.sources){const host=new URL(source.originalUrl).hostname;if(host.endsWith('.example')||/^example\.(com|org|net)$/.test(host))throw Error('Test kaynağı üretime alınamaz')}
 return {sources:bank.sources.length,questions:bank.questions.length,subjects:[...new Set(bank.questions.map(q=>q.courseId))]};
}
const quote=value=>value==null?'null':typeof value==='boolean'?(value?'true':'false'):typeof value==='number'?String(value):"'"+String(value).replace(/'/g,"''")+"'";
export function seedSql(bank=QUESTION_BANK){
 auditBank(bank);const lines=['-- Generated from the curator-reviewed catalog. Staging/review only; no user data is changed.','begin;'];
 for(const s of bank.sources){const columns=['id','publisher','name','title','year','exam_type','original_url','license_name','license_url','license_status','allows_inline','allows_embed','attribution','verification_status','checked_at','evidence_url','audit_notes'];
 const values=[s.id,s.publisher,s.name,s.title,s.year,s.examType,s.originalUrl,s.license.name,s.license.url,s.license.status,s.license.allowsInline,s.license.allowsEmbed,s.license.attribution,s.verification.status,s.verification.checkedAt,s.verification.evidenceUrl,JSON.stringify(s.researchEvidence||{})];
 lines.push(`insert into public.question_sources (${columns.join(',')}) values (${values.map(quote).join(',')}) on conflict (id) do nothing;`);}
 for(const q of bank.questions){const columns=['id','source_id','exam_type','year','section','page','question_number','course_id','topic','difficulty','original_url','prompt','options','answer_value','answer_status','answer_evidence_url','verification_status','display_mode','status','content_hash'];
 const values=[q.id,q.sourceId,q.examType,q.year,q.section,q.page,q.number,q.courseId,q.topic,q.difficulty,q.originalUrl||null,q.prompt,JSON.stringify(q.options),q.answer.value,q.answer.status,q.answer.evidenceUrl,'verified',q.displayMode,q.status,q.contentHash];
 lines.push(`insert into public.source_questions (${columns.join(',')}) values (${values.map(quote).join(',')}) on conflict (id) do nothing;`);}
 return lines.concat('commit;','').join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=auditBank();if(process.argv[2]==='--sql'){if(!process.argv[3])throw Error('Çıktı dosyası gerekli');fs.writeFileSync(process.argv[3],seedSql())}process.stdout.write(JSON.stringify(result)+'\n');
}
