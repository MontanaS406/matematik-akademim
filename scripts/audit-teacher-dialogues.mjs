// Editorial corpus audit: structure and repetition checks are not a mathematical proof.
import {createHash} from 'node:crypto';
import {TEACHER_PERSONAS} from '../shared/teacher-personas.js';
import {COURSES} from '../shared/curriculum.js';
import {TEACHER_DIALOGUE_COUNT,TEACHER_DIALOGUE_VERSION,DIALOGUE_SCENARIOS,DIALOGUE_CATEGORIES,getTeacherDialogues} from '../shared/teacher-dialogues.js';
const failures=[],courses=new Set(COURSES.map(course=>course.id));
const normalize=text=>text.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const rows=Object.keys(TEACHER_PERSONAS).flatMap(id=>getTeacherDialogues(id));
const seen=new Map(),byTeacher={},byCategory={};
for(const row of rows){
 const locator=row.teacherId+'/'+row.id,normal=normalize(row.teacher);
 if(seen.has(normal))failures.push(locator+' duplicates '+seen.get(normal));else seen.set(normal,locator);
 if(!row.teacher.trim()||row.teacher.length>1600)failures.push(locator+' has an empty or oversized response');
 if(/[?？]/u.test(row.teacher))failures.push(locator+' contains question punctuation rejected by the live explanation guard');
 if(/(?:^|\s)(?:amk|siktir|amına|orospu|lan|ulan)(?:\s|[,.!;:]|$)/iu.test(row.teacher))failures.push(locator+' includes profanity in a clean example');
 if(!Object.hasOwn(DIALOGUE_CATEGORIES,row.category)||row.courseIds.some(id=>!courses.has(id)))failures.push(locator+' has unknown curriculum/category tags');
 byTeacher[row.teacherId]=(byTeacher[row.teacherId]||0)+1;byCategory[row.category]=(byCategory[row.category]||0)+1;
}
for(const id of Object.keys(TEACHER_PERSONAS))if(byTeacher[id]!==DIALOGUE_SCENARIOS.length)failures.push(id+' has incomplete scenario coverage');
if(TEACHER_DIALOGUE_COUNT!==rows.length||rows.length!==600)failures.push('Expected 600 authored dialogues');
// Compare five-word phrases. Common mathematics is expected; a high score is a
// review signal, not an automatic claim that two explanations are plagiarism.
const grams=text=>{const words=normalize(text).split(' ');return new Set(words.slice(0,-4).map((_,i)=>words.slice(i,i+5).join(' ')));};
const prepared=rows.map(row=>({id:row.teacherId+'/'+row.id,grams:grams(row.teacher)})),near=[];
for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
 const a=prepared[i],b=prepared[j];let intersection=0;
 for(const gram of a.grams)if(b.grams.has(gram))intersection++;
 const score=intersection/(a.grams.size+b.grams.size-intersection||1);
 if(score>=0.45)near.push({first:a.id,second:b.id,similarity:Number(score.toFixed(3))});
}
near.sort((a,b)=>b.similarity-a.similarity||a.first.localeCompare(b.first));
const utf8=rows.map(row=>Buffer.byteLength(row.teacher));
const digest=createHash('sha256').update(JSON.stringify(rows.map(({teacherId,id,student,teacher})=>({teacherId,id,student,teacher})))).digest('hex');
const result={version:TEACHER_DIALOGUE_VERSION,dialogues:rows.length,scenarios:DIALOGUE_SCENARIOS.length,teachers:Object.keys(byTeacher).length,byTeacher,byCategory,exactDuplicates:rows.length-seen.size,nearDuplicateReview:near,bytes:{responses:utf8.reduce((a,b)=>a+b,0),longestResponse:Math.max(...utf8)},contentSha256:digest,failures,mathematicalValidation:'Independent editorial review; automated checks alone do not prove mathematics or live model fidelity.'};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;
