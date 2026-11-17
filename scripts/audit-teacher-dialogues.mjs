// Corpus structure/repetition checks are not mathematical proofs or live-model evaluations.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {TEACHER_PERSONAS} from '../shared/teacher-personas.js';
import {COURSES} from '../shared/curriculum.js';
import {
 TEACHER_DIALOGUE_COUNT,TEACHER_DIALOGUE_ALTERNATE_COUNT,TEACHER_DIALOGUE_RESPONSE_COUNT,
 TEACHER_DIALOGUE_VERSION,DIALOGUE_SCENARIOS,DIALOGUE_CATEGORIES,DIALOGUE_ALTERNATE_SCENARIOS,
 getTeacherDialogues,getTeacherDialogueVariants
} from '../shared/teacher-dialogues.js';
import {
 TEACHER_REACTION_VERSION,TEACHER_REACTION_ADDITION_COUNT,TEACHER_REACTION_COUNT,getTeacherReactions
} from '../shared/teacher-reactions.js';

const flags=new Set(process.argv.slice(2));
if([...flags].some(flag=>!['--write','--check'].includes(flag))||(flags.has('--write')&&flags.has('--check')))throw new Error('Use no flag, --write, or --check.');
const failures=[],courses=new Set(COURSES.map(course=>course.id));
const teacherIds=Object.keys(TEACHER_PERSONAS),scenarioIds=new Set(DIALOGUE_SCENARIOS.map(row=>row.id));
const kinds=['greeting','correct','incorrect','waiting'];
const normalize=text=>text.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const hash=text=>createHash('sha256').update(text).digest('hex');
const architecture=/mimar|şantiye|baret|temel|kolon|kiriş|plan|ölç|kat|cephe|proje|statik|iskân|taşıyıcı|ruhsat|yapı|bina|iş makine|çizim|duvar|çatı|ev gibi/i;
const profanity=/(?<![\p{L}\p{N}])(?:amk|siktir|amına|orospu|lan|ulan)(?![\p{L}\p{N}])/iu;
const legacyLines=(profile,kind)=>kind==='greeting'?[profile.greeting]:kind==='correct'?profile.correctResponses:kind==='incorrect'?profile.incorrectResponses:profile.waitingLines;
const records=[],byTeacher={},byCategory={},sourceFiles=new Set(['shared/teacher-personas.js']);

for(const teacherId of teacherIds){
 const profile=TEACHER_PERSONAS[teacherId],base=getTeacherDialogues(teacherId);
 const stats={baseDialogues:base.length,alternateDialogues:0,newReactions:0,preservedReactions:0,preservedPreviews:profile.sampleDialogue.length};
 if(base.length!==60||new Set(base.map(row=>row.id)).size!==60)failures.push(teacherId+' has incomplete base scenario coverage');
 for(const row of base){
  if(!scenarioIds.has(row.id)||!Object.hasOwn(DIALOGUE_CATEGORIES,row.category)||row.courseIds.some(id=>!courses.has(id)))failures.push(teacherId+'/'+row.id+' has invalid scenario, category or course tags');
  const variants=getTeacherDialogueVariants(teacherId,row.id),expected=DIALOGUE_ALTERNATE_SCENARIOS.includes(row.id)?2:1;
  if(variants.length!==expected)failures.push(teacherId+'/'+row.id+' has incorrect variant coverage');
  for(const [variant,entry]of variants.entries()){
   if(entry.teacherId!==teacherId||entry.id!==row.id||entry.student!==row.student||entry.variant!==variant)failures.push(teacherId+'/'+row.id+' has mismatched variant identity');
   records.push({id:`dialogue:${teacherId}:${row.id}:${variant}`,teacherId,kind:'dialogue',origin:'new',scenarioId:row.id,category:row.category,courseIds:row.courseIds,variant,student:row.student,text:entry.teacher});
   byCategory[row.category]=(byCategory[row.category]||0)+1;
   if(variant)stats.alternateDialogues++;
  }
 }
 for(const kind of kinds){
  const lines=getTeacherReactions(teacherId,kind),old=legacyLines(profile,kind),added=kind==='greeting'||kind==='waiting'?5:8;
  if(lines.length!==old.length+added)failures.push(teacherId+'/'+kind+' has incorrect reaction count');
  if(lines.slice(0,old.length).some((line,index)=>line!==old[index]))failures.push(teacherId+'/'+kind+' changed the legacy reaction prefix');
  lines.forEach((text,index)=>{
   const preserved=index<old.length;
   records.push({id:`reaction:${teacherId}:${kind}:${index}`,teacherId,kind:'reaction',reactionKind:kind,origin:preserved?'preserved':'new',text});
   stats[preserved?'preservedReactions':'newReactions']++;
  });
 }
 profile.sampleDialogue.forEach((entry,index)=>records.push({id:`preview:${teacherId}:${index}`,teacherId,kind:'preview',origin:'preserved',student:entry.student,text:entry.teacher}));
 stats.newTexts=stats.baseDialogues+stats.alternateDialogues+stats.newReactions;
 stats.totalTexts=stats.newTexts+stats.preservedReactions+stats.preservedPreviews;
 byTeacher[teacherId]=stats;
 for(const directory of ['teacher-dialogues','teacher-dialogue-alternates','teacher-reactions'])sourceFiles.add(`shared/${directory}/${teacherId}.js`);
}
records.sort((a,b)=>a.id.localeCompare(b.id,'en'));
const seen=new Map(),duplicates=[];
for(const record of records){
 const {id,text}=record;
 if(typeof text!=='string'||text.trim().length<15||text.length>1600){failures.push(id+' has an empty, too short or oversized response');continue;}
 const normal=normalize(text);
 if(seen.has(normal)){duplicates.push({first:seen.get(normal),second:id});failures.push(id+' duplicates '+seen.get(normal));}else seen.set(normal,id);
 if(/[?？]/u.test(text))failures.push(id+' contains question punctuation outside the authored explanatory corpus format');
 if(profanity.test(text))failures.push(id+' includes ungated profanity in a clean example');
 if(/A\)\s*.+B\)\s*.+C\)\s*.+D\)\s*.+E\)/s.test(text))failures.push(id+' resembles a new five-choice exercise');
 if(record.teacherId==='beyza'){
  for(const sentence of text.split(/[.!?]+(?:\s|$)/u).map(part=>part.trim()).filter(Boolean)){
   if(/\p{L}{3,}/u.test(sentence)&&!architecture.test(sentence))failures.push(id+' lacks architecture in a prose sentence: '+sentence);
  }
 }
}
const count=(kind,origin)=>records.filter(row=>(!kind||row.kind===kind)&&(!origin||row.origin===origin)).length;
const totals={baseDialogues:teacherIds.reduce((n,id)=>n+byTeacher[id].baseDialogues,0),alternateDialogues:teacherIds.reduce((n,id)=>n+byTeacher[id].alternateDialogues,0),dialogueResponses:count('dialogue'),newReactions:count('reaction','new'),preservedReactions:count('reaction','preserved'),allReactions:count('reaction'),preservedPreviews:count('preview','preserved'),newTexts:count(null,'new'),preservedTexts:count(null,'preserved'),allTexts:records.length};
const expected={baseDialogues:600,alternateDialogues:150,dialogueResponses:750,newReactions:260,preservedReactions:90,allReactions:350,preservedPreviews:30,newTexts:1010,preservedTexts:120,allTexts:1130};
for(const [name,value]of Object.entries(expected))if(totals[name]!==value)failures.push(`${name}: expected ${value}, found ${totals[name]}`);
if(TEACHER_DIALOGUE_COUNT!==totals.baseDialogues||TEACHER_DIALOGUE_ALTERNATE_COUNT!==totals.alternateDialogues||TEACHER_DIALOGUE_RESPONSE_COUNT!==totals.dialogueResponses||TEACHER_REACTION_ADDITION_COUNT!==totals.newReactions||TEACHER_REACTION_COUNT!==totals.allReactions)failures.push('Exported corpus counts do not match inspected records');
if(scenarioIds.size!==60||DIALOGUE_ALTERNATE_SCENARIOS.length!==15||new Set(DIALOGUE_ALTERNATE_SCENARIOS).size!==15)failures.push('Canonical scenario identifiers are incomplete or duplicated');

// Five-word Jaccard similarity flags possible reuse for editorial review. Shared
// mathematical facts are expected; this is neither a plagiarism nor a proof test.
const grams=text=>{const words=normalize(text).split(' ');return new Set(words.slice(0,-4).map((_,i)=>words.slice(i,i+5).join(' ')));};
const prepared=records.map(row=>({id:row.id,grams:grams(row.text)})),near=[];
for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
 const a=prepared[i],b=prepared[j];let intersection=0;
 for(const gram of a.grams)if(b.grams.has(gram))intersection++;
 const score=intersection/(a.grams.size+b.grams.size-intersection||1);
 if(score>=0.45)near.push({first:a.id,second:b.id,similarity:Number(score.toFixed(3))});
}
near.sort((a,b)=>b.similarity-a.similarity||a.first.localeCompare(b.first,'en'));
const bytes=records.map(row=>Buffer.byteLength(row.text));
const contentSha256=hash(JSON.stringify(records));
const summary={schema:'teacher-dialogue-audit/v2',dialogueVersion:TEACHER_DIALOGUE_VERSION,reactionVersion:TEACHER_REACTION_VERSION,teachers:teacherIds.length,scenarios:scenarioIds.size,alternateScenarios:DIALOGUE_ALTERNATE_SCENARIOS.length,totals,byTeacher,dialoguesByCategory:byCategory,exactDuplicates:duplicates.length,duplicateRecords:duplicates,nearDuplicateReview:near,bytes:{allResponses:bytes.reduce((a,b)=>a+b,0),longestResponse:Math.max(...bytes)},contentSha256,failures,validationScope:'Structure, default clean language, Beyza prose style, repetition and independent AI editorial review; not mathematical proof or live model fidelity.'};
const ledger={schema:'teacher-dialogue-ledger/v1',dialogueVersion:TEACHER_DIALOGUE_VERSION,reactionVersion:TEACHER_REACTION_VERSION,contentSha256,totals,sources:[...sourceFiles].sort().map(path=>({path,sha256:hash(readFileSync(new URL('../'+path,import.meta.url)))})),records:records.map(({text,student,...metadata})=>({...metadata,sha256:hash(text),...(student?{studentSha256:hash(student)}:{}),bytes:Buffer.byteLength(text)}))};
const summaryUrl=new URL('../docs/teacher-dialogue-audit.json',import.meta.url),ledgerUrl=new URL('../docs/teacher-dialogue-ledger.json',import.meta.url);
const serialized=value=>JSON.stringify(value,null,2)+'\n';
if(flags.has('--write')&&!failures.length){writeFileSync(summaryUrl,serialized(summary));writeFileSync(ledgerUrl,serialized(ledger));}
if(flags.has('--check')){
 for(const [url,value]of [[summaryUrl,summary],[ledgerUrl,ledger]]){
  try{if(readFileSync(url,'utf8')!==serialized(value))failures.push(url.pathname.split('/').at(-1)+' is stale; rerun audit with --write after reviewing changes');}
  catch{failures.push(url.pathname.split('/').at(-1)+' is missing');}
 }
}
console.log(serialized(summary));
if(failures.length)process.exitCode=1;
