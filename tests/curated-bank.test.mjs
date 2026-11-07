import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';import {QUESTION_BANK} from '../data/question-bank.js';import {auditBank,seedSql} from '../scripts/question-bank-tools.mjs';
const answer=id=>QUESTION_BANK.questions.find(q=>q.id.endsWith(id)).answer.value;
const number=s=>Number(s.replace(/−/g,'-'));
test('published catalog contains only actual licensed sources with intact review hashes',()=>{
 const result=auditBank();assert.equal(result.sources,6);assert.equal(result.questions,12);
 for(const source of QUESTION_BANK.sources){assert.equal(source.publisher,'Tyler Wallace');assert.equal(source.license.name,'CC BY 3.0 Unported')}
 const changed=structuredClone(QUESTION_BANK);changed.questions[0].prompt+=' modified';assert.throws(()=>auditBank(changed),/inceleme özeti/);
});
test('author answer keys independently satisfy linear, absolute, rational, factor and exponential conditions',()=>{
 const a=number(answer('1-3-q1')),n=number(answer('1-3-q2'));assert.equal(2-(-3*a-8),1);assert.equal(2*(-3*n+8),-20);
 for(const x of answer('1-6-q8').split(',').map(s=>number(s.trim())))assert.equal(Math.abs(3-x),6);
 for(const r of answer('1-6-q15').split(',').map(s=>number(s.trim())))assert.equal(-7*Math.abs(-3-3*r),-21);
 for(const n of answer('6-7-q7').split(',').map(s=>number(s.trim())))assert.equal(2*n*n+10*n-28,0);
 for(const m of answer('6-7-q8').split(',').map(s=>number(s.trim())))assert.equal(m*m-m-30,0);
 const x3=number(answer('7-7-q3')),x5=number(answer('7-7-q5'));assert.notEqual(x3,4);assert.equal(x3+20/(x3-4),5*x3/(x3-4)-2);assert.notEqual(x5,3);assert.equal(x5+6/(x5-3),2*x5/(x5-3));
 for(const p of [-3,0,5])assert.equal((p+9)*(p+8),p*p+17*p+72);
 for(const x of [-3,0,5])assert.equal((x-8)*(x+9),x*x+x-72);
 const k=-3/4,m=-3/2;assert.equal(answer('10-4-q5'),'−3/4');assert.equal(answer('10-4-q7'),'−3/2');assert.equal((1/25)**(-k),125**(-2*k-2));assert.equal(6**(2*m+1),1/36);
});
test('reviewed SQL seed is repeatable and inserts 12 approved rows without touching user tables',async()=>{
 const sql=seedSql();assert.equal(sql,await readFile(new URL('../supabase/question-bank-seed.sql',import.meta.url),'utf8'));assert.doesNotMatch(sql,/delete |drop |auth\.users|exam_results|learning_profiles/i);
 const db=new PGlite();try{await db.exec('create role anon;create role authenticated;grant usage on schema public to anon,authenticated');await db.exec(await readFile(new URL('../supabase/question-bank.sql',import.meta.url),'utf8'));await db.exec(sql);await db.exec(sql);await db.exec('set role anon');assert.equal((await db.query('select count(*)::int as count from source_questions')).rows[0].count,12)}finally{await db.close()}
});
