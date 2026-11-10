import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {QUESTION_BANK} from '../data/question-bank.js';
import {auditBank,seedSql} from '../scripts/question-bank-tools.mjs';
import {createQuestionRegistry} from '../shared/question-bank.js';
import worker from '../cloudflare-worker/worker.js';

test('the published catalog stays empty until the user supplies a replacement archive',()=>{
 assert.deepEqual(QUESTION_BANK,{sources:[],questions:[]});
 assert.deepEqual(auditBank(),{sources:0,questions:0,subjects:[]});
 const registry=createQuestionRegistry(QUESTION_BANK);assert.equal(registry.questions.length,0);assert.equal(registry.sources.length,0);
 for(const removed of ['tuba-sm14-p7-brackets','wallace-1-3-q1'])assert.equal(registry.getQuestion(removed),null);
});
test('the empty SQL seed is repeatable and leaves existing user records intact',async()=>{
 const sql=seedSql();assert.equal(sql,await readFile(new URL('../supabase/question-bank-seed.sql',import.meta.url),'utf8'));
 assert.doesNotMatch(sql,/insert into|delete |drop |auth\.users|exam_results|learning_profiles/i);
 const db=new PGlite();try{
  await db.exec("create role anon;create role authenticated;grant usage on schema public to anon,authenticated;create table retained_user_record(id text primary key,value text);insert into retained_user_record values('existing','preserve')");
  await db.exec(await readFile(new URL('../supabase/question-bank.sql',import.meta.url),'utf8'));await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query('select count(*)::int as count from source_questions')).rows[0].count,0);
  assert.equal((await db.query('select count(*)::int as count from question_sources')).rows[0].count,0);
  assert.deepEqual((await db.query('select * from retained_user_record')).rows,[{id:'existing',value:'preserve'}]);
 }finally{await db.close()}
});
test('removed public question identities cannot reach the AI model through a stale request',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('Unexpected upstream call',{status:500})};
 const env={OPENAI_API_KEY:'test-only',APP_ACCESS_TOKEN:'test-access',ALLOWED_ORIGINS:'https://school.example'};
 try{
  for(const questionId of ['tuba-sm14-p7-brackets','wallace-1-3-q1']){
   const request=new Request('https://worker.example/api/tutor',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-access',Origin:'https://school.example'},body:JSON.stringify({questionId,messages:[{role:'user',content:'Seçili kaynağın adımını açıkla.'}]})});
   assert.equal((await worker.fetch(request,env)).status,404);
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=original}
});
