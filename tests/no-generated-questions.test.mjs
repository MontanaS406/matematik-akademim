import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {normalizeState} from '../shared/learning-state.js';import {COURSES} from '../shared/curriculum.js';
test('retired question generators cannot be loaded through a hidden runtime path',()=>{
 assert.equal(existsSync(new URL('../js/legacy.js',import.meta.url)),false);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/legacy\.js|quickPractice|lessonExample/);
 for(const dir of ['js','shared','data'])for(const file of readdirSync(new URL('../'+dir+'/',import.meta.url)).filter(f=>f.endsWith('.js'))){const code=readFileSync(new URL('../'+dir+'/'+file,import.meta.url),'utf8');assert.doesNotMatch(code,/Math\.random|function\s+(?:gen|rand)\s*\(|diagnosticQuestions|newQuiz/,file)}
 for(const course of COURSES){assert.equal(course.exercises,undefined);assert.equal(course.example,undefined)}
});
test('legacy personal attempts and diagnostic remain intact without rehydrating retired question text',()=>{
 const previous={teacherId:'beyza',courseId:'numbers',attempts:[{id:'old',courseId:'numbers',exerciseId:'numbers-easy',difficulty:'easy',correct:true,at:'2026-01-01T00:00:00Z'}],diagnostic:{at:'2026-01-02T00:00:00Z',level:'Eski tarama',responses:[{courseId:'numbers',correct:true}]}};
 const copy=JSON.stringify(previous);const current=normalizeState(previous);assert.equal(current.attempts.length,1);assert.equal(current.diagnostic.level,'Eski tarama');assert.equal(JSON.stringify(previous),copy);assert.equal(current.attempts[0].exerciseId,'numbers-easy');
});
