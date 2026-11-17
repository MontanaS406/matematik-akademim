// Authored character examples, not generated practice questions or live AI replies.
import {TEACHER_PERSONAS} from './teacher-personas.js';
import {DIALOGUE_SCENARIOS,DIALOGUE_SCENARIO_BY_ID,DIALOGUE_CATEGORIES} from './teacher-dialogue-scenarios.js';
import {getCourse} from './curriculum.js';
import {DIALOGUES as cagatay} from './teacher-dialogues/cagatay.js';
import {DIALOGUES as beyza} from './teacher-dialogues/beyza.js';
import {DIALOGUES as zeynep} from './teacher-dialogues/zeynep.js';
import {DIALOGUES as kemal} from './teacher-dialogues/kemal.js';
import {DIALOGUES as mert} from './teacher-dialogues/mert.js';
import {DIALOGUES as elif} from './teacher-dialogues/elif.js';
import {DIALOGUES as riza} from './teacher-dialogues/riza.js';
import {DIALOGUES as nermin} from './teacher-dialogues/nermin.js';
import {DIALOGUES as bora} from './teacher-dialogues/bora.js';
import {DIALOGUES as derya} from './teacher-dialogues/derya.js';
import {ALTERNATES as cagatayAlternates} from './teacher-dialogue-alternates/cagatay.js';
import {ALTERNATES as beyzaAlternates} from './teacher-dialogue-alternates/beyza.js';
import {ALTERNATES as zeynepAlternates} from './teacher-dialogue-alternates/zeynep.js';
import {ALTERNATES as kemalAlternates} from './teacher-dialogue-alternates/kemal.js';
import {ALTERNATES as mertAlternates} from './teacher-dialogue-alternates/mert.js';
import {ALTERNATES as elifAlternates} from './teacher-dialogue-alternates/elif.js';
import {ALTERNATES as rizaAlternates} from './teacher-dialogue-alternates/riza.js';
import {ALTERNATES as nerminAlternates} from './teacher-dialogue-alternates/nermin.js';
import {ALTERNATES as boraAlternates} from './teacher-dialogue-alternates/bora.js';
import {ALTERNATES as deryaAlternates} from './teacher-dialogue-alternates/derya.js';
export {DIALOGUE_CATEGORIES,DIALOGUE_SCENARIOS};
export const TEACHER_DIALOGUE_VERSION='dialogue-v1';
const authored=Object.freeze({cagatay,beyza,zeynep,kemal,mert,elif,riza,nermin,bora,derya});
const alternates=Object.freeze({cagatay:cagatayAlternates,beyza:beyzaAlternates,zeynep:zeynepAlternates,kemal:kemalAlternates,mert:mertAlternates,elif:elifAlternates,riza:rizaAlternates,nermin:nerminAlternates,bora:boraAlternates,derya:deryaAlternates});
export const DIALOGUE_ALTERNATE_SCENARIOS=Object.freeze(['start','stuck','wrong','repeated_wrong','correct_why','short','slow','anxious','tired','break_return','exam_timer','hint_only','check_result','source_missing','humor_downshift']);
const pools=Object.freeze(Object.fromEntries(Object.entries(authored).map(([teacherId,responses])=>[
 teacherId,Object.freeze(DIALOGUE_SCENARIOS.filter(row=>typeof responses[row.id]==='string').map(row=>Object.freeze({...row,teacherId,teacher:responses[row.id],variant:0})))
])));
export const TEACHER_DIALOGUE_COUNT=Object.values(pools).reduce((sum,rows)=>sum+rows.length,0);
export const TEACHER_DIALOGUE_ALTERNATE_COUNT=Object.values(alternates).reduce((sum,rows)=>sum+Object.keys(rows).length,0);
export const TEACHER_DIALOGUE_RESPONSE_COUNT=TEACHER_DIALOGUE_COUNT+TEACHER_DIALOGUE_ALTERNATE_COUNT;
const variations=Object.freeze(Object.fromEntries(Object.entries(pools).map(([teacherId,rows])=>[teacherId,Object.freeze(Object.fromEntries(rows.map(row=>[row.id,Object.freeze([row,...(alternates[teacherId][row.id]?[Object.freeze({...row,teacher:alternates[teacherId][row.id],variant:1})]:[])])])))])));
const optionsObject=options=>{if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('Diyalog seçenekleri geçersiz.');};
function teacherPool(teacherId){if(typeof teacherId!=='string'||!Object.hasOwn(TEACHER_PERSONAS,teacherId))throw new RangeError('Geçerli bir öğretmen seç.');return pools[teacherId];}
function checkedCourse(courseId){if(courseId!==undefined&&(typeof courseId!=='string'||!getCourse(courseId)))throw new RangeError('Diyalog konusu geçersiz.');}
export function getTeacherDialogues(teacherId,options={}){
 const pool=teacherPool(teacherId);optionsObject(options);const {category,courseId}=options;checkedCourse(courseId);
 if(category!==undefined&&(typeof category!=='string'||!Object.hasOwn(DIALOGUE_CATEGORIES,category)))throw new RangeError('Diyalog kategorisi geçersiz.');
 return Object.freeze(pool.filter(row=>(category===undefined||row.category===category)&&(courseId===undefined||!row.courseIds.length||row.courseIds.includes(courseId))));
}
export function getTeacherDialogueVariants(teacherId,scenarioId){
 teacherPool(teacherId);
 if(typeof scenarioId!=='string'||!Object.hasOwn(DIALOGUE_SCENARIO_BY_ID,scenarioId))throw new RangeError('Diyalog durumu geçersiz.');
 return variations[teacherId][scenarioId];
}
export function getTeacherDialogue(teacherId,scenarioId,variant=0){
 const rows=getTeacherDialogueVariants(teacherId,scenarioId);
 if(!Number.isSafeInteger(variant)||variant<0)throw new RangeError('Diyalog örneği geçersiz.');
 return rows[variant%rows.length];
}
const normalized=text=>text.normalize('NFKC').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
// Match intent to fixed server-owned examples; user text is never a prompt template.
const intentPatterns=Object.freeze({
 humor_downshift:/saka.{0,25}(?:azalt|istem|yapma)|sade ve sakin|daha ciddi/,
 short:/cok kisa|yalniz ana fikir|kisa anlat|ozetle/,
 slow:/yavas|kucuk adim|sifirdan/,
 detailed:/ayrint|neden gecerli|ispat|kanit/,
 anxious:/kaygi|panik|unutacak|korkuyor|sinav yaklas/,
 tired:/yorul|uyku|anlamakta zorlan|odaklanam/,
 break_return:/ara verdim|moladan|kaldigim yer/,
 no_progress:/ilerleyip|ilerlememi|ilerleme.{0,30}(?:anla|olc|gore)|gelisiyor/,
 repeated_wrong:/ayni konuda tekrar|(?:yanlis|hata).{0,25}(?:tekrar|yine)|(?:tekrar|yine).{0,25}(?:yanlis|hata)/,
 wrong:/yanlis yaptim|moralim|hata yaptim|cevabim yanlis/,
 correct_why:/sonucu buldum|neden dogru|gerekcesini/,
 exam_timer:/(?:^|\W)(?:sure(?:yi|mi|si|sini|m|nin|n)?|kronometre)(?:\W|$)|zaman.{0,12}(?:yonet|planla|yet|ayir)|(?:sinav|deneme).{0,30}zaman|ne kadar zaman|kac dakika/,
 blank_question:/bos birak|tahmin|rastgele isaret/,
 reread:/yeniden oku|tekrar oku|verilenleri|soru kosul/,
 option_elimination:/secenek ele|sik ele|eleme/,
 answer_without_work:/sadece cevab|yalniz cevab|islem gormek istem/,
 hint_only:/ipucu|sonucu soyleme|cevabi soyleme/,
 alternative_method:/baska.{0,20}(?:yol|yontem)|alternatif|baska bir cozum/,
 check_result:/sonuc.{0,30}kontrol|yerine koy/,
 sign_control:/eksi isaret|isaret.{0,20}kontrol|isaretlerini takip/,
 stuck:/takildim|ilk adim|anlamadim|anlamiyorum/,
 start:/nereden basla|nasil basla/,
 tyt_ayt_boundary:/tyt.{0,60}ayt|ayt.{0,60}tyt/,
 source_missing:/(?:metin|sekil|soru).{0,35}(?:eksik|gorunmuyor)|eksik.{0,25}(?:metin|sekil|soru)/,
 uncertainty:/emin degil|emin misin|kesin mi|supheli/,
 no_new_questions:/yeni.{0,25}(?:soru|problem)|soru.{0,20}(?:uret|olustur)|benzer.{0,20}soru/,
 grade_boundary:/resmi.{0,25}(?:puan|sonuc)|sinav puan/
});
const priority=Object.freeze({humor_downshift:240,no_new_questions:220,source_missing:200,uncertainty:170,hint_only:150,short:140,slow:130,anxious:125,tired:125,wrong:115,repeated_wrong:135});
export function selectTeacherDialogues(teacherId,options={}){
 teacherPool(teacherId);optionsObject(options);
 const {studentMessage='',courseId,helpMode='hint',limit=2,variant=0}=options;
 checkedCourse(courseId);
 if(typeof studentMessage!=='string'||studentMessage.length>2500||!['hint','solution'].includes(helpMode)||!Number.isInteger(limit)||limit<1||limit>2||!Number.isSafeInteger(variant)||variant<0)throw new RangeError('Diyalog bağlamı geçersiz.');
 const text=normalized(studentMessage);
 const available=getTeacherDialogues(teacherId,{...(courseId?{courseId}:{})});
 const scored=available.map((row,index)=>{
  let score=intentPatterns[row.id]?.test(text)?priority[row.id]||110:0;
  for(const word of row.keywords)if(text.includes(normalized(word)))score+=40;
  // A known current course is a fallback, not permission to borrow another topic.
  if(!score&&courseId&&row.courseIds.includes(courseId))score=2;
  return {row,score,index};
 }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
 const chosen=scored.slice(0,limit).map(item=>item.row);
 for(const id of ['start','stuck'])if(chosen.length<limit&&!chosen.some(row=>row.id===id))chosen.push(getTeacherDialogue(teacherId,id));
 return Object.freeze(chosen.map(row=>getTeacherDialogue(teacherId,row.id,variant)));
}
