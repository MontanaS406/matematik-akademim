import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('source bank publication trigger and public RLS require source, rights and answer approval',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;grant usage on schema public to anon,authenticated;');
  await db.exec(await readFile(new URL('../supabase/question-bank.sql',import.meta.url),'utf8'));
  const source=(id,status='verified',license='verified',inline=true)=>db.query(`insert into question_sources(id,publisher,name,title,year,original_url,license_name,license_url,license_status,allows_inline,attribution,verification_status,checked_at,evidence_url)values($1,'Test publisher','Test name','Test title',2024,'https://source.example/'||$1,'Test license','https://source.example/license',$2,$3,'Test attribution',$4,now(),'https://source.example/evidence')`,[id,license,inline,status]);
  const add=(id,sourceId,number='1',status='published',answer='verified',year=2024)=>db.query(`insert into source_questions(id,source_id,year,section,question_number,course_id,topic,prompt,answer_value,answer_status,answer_evidence_url,verification_status,display_mode,status)values($1,$2,$3,'1.1',$4,'equations','Test topic','Synthetic test prompt','test answer',$5,'https://source.example/answers','verified','inline',$6)`,[id,sourceId,year,number,answer,status]);
  await source('allowed');await source('pending-source','pending');await source('pending-rights','verified','pending');await source('no-rights','verified','verified',false);
  await add('allowed-q','allowed');await assert.rejects(db.exec("insert into question_sources(id,publisher,name,title,year,exam_type,original_url,license_name,license_url,license_status,allows_inline,allows_embed,attribution,verification_status,checked_at,evidence_url,audit_notes,created_at) select 'alias',publisher,name,title,year,exam_type,'https://SOURCE.example:443/allowed?utm_source=duplicate#anchor',license_name,license_url,license_status,allows_inline,allows_embed,attribution,verification_status,checked_at,evidence_url,audit_notes,created_at from question_sources where id='allowed'"),/unique constraint/);
  for(const [id,s,answer]of[['bad-source','pending-source','verified'],['bad-rights','pending-rights','verified'],['denied-rights','no-rights','verified'],['bad-answer','allowed','pending']])await assert.rejects(add(id,s,'2','published',answer),/doğrulanmadan|izni yok/);
  await assert.rejects(add('wrong-year','allowed','3','published','verified',2023),/yıl veya sınav türü/);
  await assert.rejects(add('duplicate','allowed','01'),/unique constraint/);
  await add('draft-q','pending-source','2','draft','pending');
  await db.exec('set role anon');assert.deepEqual((await db.query('select id from source_questions')).rows,[{id:'allowed-q'}]);assert.equal((await db.query('select id from question_sources order by id')).rows.length,1);
  await assert.rejects(db.query("insert into question_sources(id)values('unauthorized')"),/permission denied/);await assert.rejects(db.query("update source_questions set prompt='edited'"),/permission denied/);await assert.rejects(db.query('delete from source_questions'),/permission denied/);
  await db.exec('reset role;set role authenticated');assert.deepEqual((await db.query('select id from source_questions')).rows,[{id:'allowed-q'}]);await assert.rejects(db.query("insert into source_questions(id)values('unauthorized')"),/permission denied/);
  await db.exec("reset role;update question_sources set license_status='rejected' where id='allowed';set role anon");assert.equal((await db.query('select id from source_questions')).rows.length,0);
 }finally{await db.close()}
});
