import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {normalizeState} from '../shared/learning-state.js';
test('learning profile RLS protects teacher choices, progress and upserts per account',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(await readFile(new URL('../supabase/learning-profiles.sql',import.meta.url),'utf8'));
    const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users values ($1),($2)',[alice,bob]);
    await db.exec('set role authenticated');
    const asUser=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    const upsert=(id,state)=>db.query('insert into learning_profiles (user_id,state) values ($1,$2::jsonb) on conflict (user_id) do update set state=excluded.state',[id,JSON.stringify(state)]);
    await asUser(alice);await upsert(alice,{teacherId:'elif',attempts:[]});await upsert(alice,{teacherId:'beyza',attempts:[]});
    assert.equal((await db.query('select state from learning_profiles')).rows[0].state.teacherId,'beyza');
    await assert.rejects(upsert(bob,{teacherId:'kemal'}),/row-level security/);
    await asUser(bob);await upsert(bob,{teacherId:'kemal'});
    assert.deepEqual((await db.query('select user_id from learning_profiles')).rows,[{user_id:bob}]);
    await assert.rejects(upsert(alice,{teacherId:'cagatay'}),/row-level security/);
    assert.equal((await db.query('update learning_profiles set state=$1::jsonb where user_id=$2 returning user_id',['{}',alice])).rows.length,0);
    assert.equal((await db.query('delete from learning_profiles where user_id=$1 returning user_id',[alice])).rows.length,0);
    await assert.rejects(db.query('update learning_profiles set user_id=$1 where user_id=$2',[alice,bob]),/row-level security/);
    await assert.rejects(upsert(bob,[]),/check constraint/);
    await assert.rejects(upsert(bob,{large:'ş'.repeat(60000)}),/check constraint/);
    const largeProfile=normalizeState({attempts:Array.from({length:1200},(_,i)=>({id:'attempt-'+i,courseId:'fractions',exerciseId:'fractions-hard',correct:true,difficulty:'hard',at:new Date(1700000000000+i).toISOString()}))});
    await upsert(bob,largeProfile);assert.ok((await db.query('select octet_length(state::text) as bytes from learning_profiles')).rows[0].bytes<100000);
    await asUser(alice);assert.equal((await db.query('select state from learning_profiles')).rows[0].state.teacherId,'beyza');
    await db.exec('reset role; set role anon');await assert.rejects(db.query('select * from learning_profiles'),/permission denied/);
  }finally{await db.close()}
});
