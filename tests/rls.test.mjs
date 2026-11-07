import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('Postgres RLS: two users cannot read, change, delete or claim each other’s results',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users values ($1),($2)',[alice,bob]);
    await db.exec('set role authenticated');
    const asUser=async id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    const add=async(id,owner)=>db.query(`insert into exam_results (id,user_id,exam_type,correct,wrong,blank,net,duration_seconds,answers) values ($1,$2,'TYT',1,1,38,0.75,60,'{"markedAnswers":[]}')`,[id,owner]);
    await asUser(alice);await add(alice,alice);
    await assert.rejects(add(bob,bob),/row-level security/);
    await asUser(bob);await add(bob,bob);
    assert.deepEqual((await db.query('select user_id from exam_results')).rows,[{user_id:bob}]);
    assert.equal((await db.query('update exam_results set duration_seconds=1 where id=$1 returning id',[alice])).rows.length,0);
    assert.equal((await db.query('delete from exam_results where id=$1 returning id',[alice])).rows.length,0);
    await assert.rejects(db.query('update exam_results set user_id=$1 where id=$2',[alice,bob]),/row-level security/);
    await assert.rejects(db.query('update exam_results set net=40 where id=$1',[bob]),/check constraint/);
    await db.query('update exam_results set net=null where id=$1',[bob]);
    assert.equal((await db.query('select net from exam_results')).rows[0].net,null);
    await asUser(alice);assert.equal((await db.query('select duration_seconds from exam_results')).rows[0].duration_seconds,60);
    await db.exec('reset role; set role anon');await assert.rejects(db.query('select * from exam_results'),/permission denied/);
  }finally{await db.close()}
});
