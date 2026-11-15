import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/source-access.sql', import.meta.url), 'utf8');
const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  alice: '10000000-0000-4000-8000-000000000002',
  bob: '10000000-0000-4000-8000-000000000003',
  unconfirmed: '10000000-0000-4000-8000-000000000004',
  lookalike: '10000000-0000-4000-8000-000000000005',
  replacement: '10000000-0000-4000-8000-000000000006'
};
// Deliberately synthetic fixtures. No deployed archive key is used in tests.
const fixtureBundle = 'personal-0000000000000000';
const fixtureKey = 'T'.repeat(43);
const denied = promise => assert.rejects(promise, error => error.code === '42501');
const invalid = promise => assert.rejects(promise, error => error.code === '22023');

async function database({adminConfirmed = true} = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, email_confirmed_at timestamptz,
      raw_user_meta_data jsonb not null default '{}', raw_app_meta_data jsonb not null default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const [id, email, confirmed] of [
    [ids.admin, 'owner@EXAMPLE.TEST', adminConfirmed],
    [ids.alice, 'alice@example.test', true], [ids.bob, 'bob@example.test', true],
    [ids.unconfirmed, 'unconfirmed@example.test', false],
    [ids.lookalike, 'owner@examplİ.test', true]
  ]) await db.query('insert into auth.users (id,email,email_confirmed_at) values ($1,$2,case when $3::boolean then now() else null end)', [id, email, confirmed]);
  await db.exec(migration);
  await db.query('update ma_source_private.config set admin_email=$1 where singleton',['owner@example.test']);
  return db;
}
async function asUser(db, id) {
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
}
async function scalar(db, sql, params = []) { return (await db.query(sql, params)).rows[0].value; }
const status = db => scalar(db, 'select public.ma_source_access_status() as value');
const request = db => scalar(db, 'select public.ma_source_access_request() as value');
const members = db => scalar(db, 'select public.ma_source_access_members() as value');
const access = db => scalar(db, 'select public.ma_source_archive_access() as value');
const setMember = (db, id, allowed) => scalar(db, 'select public.ma_source_access_set_member($1::uuid,$2::boolean) as value', [id, allowed]);
const setEmail = (db, email, allowed) => scalar(db, 'select public.ma_source_access_set_member(target_email => $1, allowed => $2) as value', [email, allowed]);
async function configureFixture(db) {
  await db.exec('reset role');
  await db.query('update ma_source_private.config set bundle_id=$1, archive_key=$2 where singleton', [fixtureBundle, fixtureKey]);
}

test('source access RPCs enforce confirmed server identity, administrator decisions and revocation without leaking keys', async () => {
  const db = await database();
  try {
    // Anonymous role is denied even if a test session supplies an admin sub.
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids.admin]);
    await db.exec('set role anon');
    for (const call of [status, request, members, access]) await denied(call(db));
    await denied(setMember(db, ids.alice, true));
    await asUser(db, null);
    for (const call of [status, request, members, access]) await denied(call(db));

    await asUser(db, ids.alice);
    assert.deepEqual(await status(db), {userId: ids.alice, email: 'alice@example.test', confirmed: true,
      isAdmin: false, status: 'none', bundleReady: false});
    await denied(access(db));
    const applied = await request(db);
    assert.equal(applied.status, 'pending');
    assert.equal((await request(db)).status, 'pending');
    assert.equal('key' in applied, false);
    await denied(members(db));
    await denied(setMember(db, ids.alice, true));
    await denied(setEmail(db, 'alice@example.test', true));
    await denied(access(db));

    await asUser(db, ids.admin);
    const admin = await status(db);
    assert.equal(admin.isAdmin, true); assert.equal(admin.status, 'approved');
    await assert.rejects(access(db), error => error.code === '55000');
    const pending = (await members(db)).filter(row => row.status === 'pending');
    assert.deepEqual(pending.map(row => row.userId), [ids.alice]);
    assert.equal(pending[0].email, 'alice@example.test');
    const approved = await setMember(db, ids.alice, true);
    assert.equal(approved.status, 'approved'); assert.equal(approved.userId, ids.alice);
    assert.equal('key' in approved, false);
    await invalid(setMember(db, ids.admin, false));
    await invalid(setEmail(db, 'owner@example.test', false));
    await configureFixture(db);
    await asUser(db, ids.alice);
    assert.deepEqual(await access(db), {bundleId: fixtureBundle, key: fixtureKey});
    assert.equal((await status(db)).bundleReady, true);

    await asUser(db, ids.bob);
    assert.equal((await status(db)).status, 'none'); await denied(access(db));
    await asUser(db, ids.admin);
    assert.equal((await setEmail(db, 'BOB@EXAMPLE.TEST', true)).userId, ids.bob);
    await asUser(db, ids.bob); assert.deepEqual(await access(db), {bundleId: fixtureBundle, key: fixtureKey});
    await asUser(db, ids.admin);
    const revoked = await setMember(db, ids.alice, false);
    assert.equal(revoked.status, 'revoked');
    await asUser(db, ids.alice);
    assert.equal((await request(db)).status, 'revoked');
    await denied(access(db));
    await asUser(db, ids.admin); assert.equal((await status(db)).isAdmin, true);
  } finally { await db.close(); }
});

test('source authority ignores spoofed metadata, Unicode lookalikes and unconfirmed or deleted accounts', async () => {
  const db = await database({adminConfirmed: false});
  try {
    await configureFixture(db);
    await asUser(db, ids.admin);
    assert.equal((await status(db)).isAdmin, false);
    assert.equal((await status(db)).status, 'email_unconfirmed');
    await denied(request(db)); await denied(members(db)); await denied(access(db));
    await db.exec('reset role');
    assert.equal(await scalar(db, 'select admin_user_id as value from ma_source_private.config'), null);

    // App/user metadata and a forged email claim cannot change auth.users.
    await db.query(`update auth.users set raw_user_meta_data=$1::jsonb, raw_app_meta_data=$1::jsonb where id=$2`,
      [JSON.stringify({email: 'owner@example.test', role: 'admin', isAdmin: true, email_verified: true}), ids.bob]);
    await asUser(db, ids.bob);
    await db.query("select set_config('request.jwt.claim.email', 'owner@example.test', false)");
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({sub: ids.bob, email: 'owner@example.test', role: 'authenticated', app_metadata: {role: 'admin'}})]);
    assert.equal((await status(db)).isAdmin, false);
    await denied(members(db)); await denied(setMember(db, ids.bob, true)); await denied(access(db));
    await asUser(db, ids.lookalike);
    assert.equal((await status(db)).isAdmin, false); await denied(members(db)); await denied(access(db));

    await db.exec('reset role');
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [ids.admin]);
    await asUser(db, ids.admin);
    assert.equal((await status(db)).isAdmin, true);
    await invalid(setMember(db, ids.unconfirmed, true));
    await invalid(setEmail(db, 'absent@example.test', true));
    await invalid(scalar(db, 'select public.ma_source_access_set_member($1::uuid,true,$2) as value', [ids.alice, 'bob@example.test']));
    await setMember(db, ids.alice, true);
    await db.exec('reset role');
    // A formerly approved UUID loses access immediately when the server no
    // longer considers its email confirmed; JWT metadata cannot override it.
    await db.query('update auth.users set email_confirmed_at=null where id=$1', [ids.alice]);
    await asUser(db, ids.alice); await denied(access(db));
    assert.equal((await status(db)).status, 'email_unconfirmed');
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [ids.alice]);
    await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [ids.replacement, 'alice@example.test']);
    await asUser(db, ids.alice); await denied(status(db)); await denied(access(db));
    await asUser(db, ids.replacement);
    assert.equal((await status(db)).status, 'none'); await denied(access(db));
    assert.equal((await request(db)).status, 'pending');

    // Even the administrator mailbox cannot silently rebind to a new UUID.
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [ids.admin]);
    await db.query('update auth.users set email=$1 where id=$2', ['owner@example.test', ids.bob]);
    await asUser(db, ids.bob);
    assert.equal((await status(db)).isAdmin, false);
    await denied(members(db)); await denied(access(db));
    await db.exec('reset role');
    assert.equal(await scalar(db, 'select admin_user_id as value from ma_source_private.config'), ids.admin);
  } finally { await db.close(); }
});

test('private source tables have forced RLS, fixed definer paths and no direct client grants or anonymous function execution', async () => {
  const db = await database();
  try {
    await configureFixture(db);
    const tables = (await db.query(`select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class as c
      join pg_namespace as n on n.oid=c.relnamespace where n.nspname='ma_source_private' and c.relkind='r' order by c.relname`)).rows;
    assert.equal(tables.length, 2);
    assert.equal(tables.every(row => row.relrowsecurity && row.relforcerowsecurity), true);
    const functions = (await db.query(`select p.proname,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as user_execute
      from pg_proc as p join pg_namespace as n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'ma_source_%' order by p.proname`)).rows;
    assert.equal(functions.length, 5);
    for (const row of functions) {
      assert.equal(row.prosecdef, true); assert.deepEqual(row.proconfig, ['search_path=pg_catalog']);
      assert.equal(row.anon_execute, false); assert.equal(row.user_execute, true);
    }
    await asUser(db, ids.admin); await status(db);
    for (const sql of [
      'select * from ma_source_private.config', 'select * from ma_source_private.members',
      'select ma_source_private.is_admin()',
      "update ma_source_private.config set admin_user_id=null", "delete from ma_source_private.members"
    ]) await denied(db.query(sql));

    // Defense in depth: accidental table grants still do not bypass RLS.
    await db.exec('reset role; grant usage on schema ma_source_private to authenticated; grant select on all tables in schema ma_source_private to authenticated;');
    await asUser(db, ids.admin);
    assert.deepEqual((await db.query('select * from ma_source_private.config')).rows, []);
    assert.deepEqual((await db.query('select * from ma_source_private.members')).rows, []);
    await denied(db.query('select ma_source_private.is_admin()'));
    assert.deepEqual(await access(db), {bundleId: fixtureBundle, key: fixtureKey});
    // A caller-controlled schema/temp table cannot redirect qualified queries.
    await db.exec("create temporary table config (admin_user_id uuid, archive_key text); create temporary table members (user_id uuid,status text); set search_path=pg_temp,public");
    assert.deepEqual(await access(db), {bundleId: fixtureBundle, key: fixtureKey});
  } finally { await db.close(); }
});

test('source migration rolls back on collision and never replaces existing learning, auth or exam data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;`);
    await db.query('insert into auth.users values ($1,$2,now())', [ids.alice, 'alice@example.test']);
    for (const file of ['schema.sql', 'learning-profiles.sql']) await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'));
    await db.query(`insert into public.exam_results(id,user_id,exam_type,correct,wrong,blank,net,duration_seconds,answers)
      values($1,$2,'TYT',1,1,38,.75,67,'{"retained":true}')`, [ids.bob, ids.alice]);
    await db.query('insert into public.learning_profiles(user_id,state) values($1,$2::jsonb)', [ids.alice, JSON.stringify({teacherId: 'beyza', attempts: [{retained: true}]})]);
    const before = {
      users: (await db.query('select * from auth.users')).rows,
      results: (await db.query('select * from public.exam_results')).rows,
      profiles: (await db.query('select * from public.learning_profiles')).rows,
      policies: (await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows
    };
    await db.exec(migration);
    await assert.rejects(db.exec(migration), /already exists/);
    await db.exec('rollback');
    assert.deepEqual((await db.query('select * from auth.users')).rows, before.users);
    assert.deepEqual((await db.query('select * from public.exam_results')).rows, before.results);
    assert.deepEqual((await db.query('select * from public.learning_profiles')).rows, before.profiles);
    assert.deepEqual((await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows, before.policies);
    assert.equal(await scalar(db, 'select admin_user_id as value from ma_source_private.config'), null);
    await assert.rejects(db.query('update ma_source_private.config set bundle_id=$1,archive_key=$2', ['not-a-bundle', fixtureKey]), /check constraint/);
    await assert.rejects(db.query('update ma_source_private.config set bundle_id=$1,archive_key=$2', [fixtureBundle, 'too-short']), /check constraint/);
  } finally { await db.close(); }
});

test('ambiguous administrator mailboxes do not bootstrap or disclose the archive', async () => {
  const db = await database();
  try {
    await configureFixture(db);
    await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [ids.replacement, 'OWNER@example.test']);
    await asUser(db, ids.admin);
    assert.equal((await status(db)).isAdmin, false); await denied(members(db)); await denied(access(db));
    await asUser(db, ids.replacement);
    assert.equal((await status(db)).isAdmin, false); await denied(members(db)); await denied(access(db));
    await db.exec('reset role');
    assert.equal(await scalar(db, 'select admin_user_id as value from ma_source_private.config'), null);
  } finally { await db.close(); }
});
