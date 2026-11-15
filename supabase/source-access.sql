-- Additive first installation, run by the Supabase database administrator.
-- Existing objects cause a transaction failure rather than replacing data or
-- policies. This does not modify learning_profiles, exam_results or auth users.
-- Do not expose ma_source_private through PostgREST, and do not grant clients
-- access to its tables. Public functions below are the only client entry points.
begin;

create schema ma_source_private;
revoke all on schema ma_source_private from public, anon, authenticated;

create table ma_source_private.config (
  singleton boolean primary key default true check (singleton),
  -- Supplied only through the private installation file, never public source.
  admin_email text check (admin_email is null or
    (length(admin_email) between 3 and 320 and admin_email collate "C" ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+$')),
  -- Deliberately not ON DELETE SET NULL: deleting and re-registering the same
  -- address must not transfer administrator authority to a different UUID.
  -- A deleted administrator requires an explicit, reviewed database repair.
  admin_user_id uuid unique,
  bundle_id text check (bundle_id is null or (length(bundle_id) = 25 and bundle_id ~ '^personal-[a-f0-9]{16}$')),
  archive_key text check (archive_key is null or (length(archive_key) = 43 and archive_key ~ '^[A-Za-z0-9_-]{43}$')),
  check ((bundle_id is null) = (archive_key is null))
);
insert into ma_source_private.config (singleton) values (true);

create table ma_source_private.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_snapshot text not null,
  status text not null check (status in ('pending', 'approved', 'revoked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  check ((status = 'pending' and decided_at is null and decided_by is null)
    or (status in ('approved', 'revoked') and decided_at is not null and decided_by is not null))
);
create index source_access_members_status_date_idx
  on ma_source_private.members (status, requested_at desc);

alter table ma_source_private.config enable row level security;
alter table ma_source_private.config force row level security;
alter table ma_source_private.members enable row level security;
alter table ma_source_private.members force row level security;
revoke all on all tables in schema ma_source_private from public, anon, authenticated;

-- ASCII folding intentionally does not turn Turkish dotted/dotless I or other
-- Unicode lookalikes into the administrator's ASCII mailbox.
create function ma_source_private.ascii_email(value text)
returns text language sql immutable strict
set search_path = pg_catalog
as $$ select pg_catalog.translate(value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') collate "C" $$;

-- auth.uid() comes from the verified Supabase request. Neither JWT email claims
-- nor raw_user_meta_data / raw_app_meta_data grant any privileges here.
create function ma_source_private.actor(require_confirmed boolean default true)
returns table (user_id uuid, email text, confirmed boolean)
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  is_confirmed boolean;
begin
  if actor_id is null then
    raise exception 'Giriş gerekli.' using errcode = '42501';
  end if;
  select u.email, u.email_confirmed_at is not null and coalesce(u.email, '') <> '' into actor_email, is_confirmed
    from auth.users as u where u.id = actor_id;
  if not found then
    raise exception 'Kullanıcı hesabı bulunamadı.' using errcode = '42501';
  end if;
  if require_confirmed and (not is_confirmed or actor_email is null or actor_email = '') then
    raise exception 'Doğrulanmış e-posta gerekli.' using errcode = '42501';
  end if;
  return query select actor_id, actor_email, is_confirmed;
end;
$$;

create function ma_source_private.is_admin()
returns boolean language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  actor_row record;
  settings ma_source_private.config%rowtype;
  matching_users bigint;
begin
  select * into actor_row from ma_source_private.actor(false);
  select * into settings from ma_source_private.config where singleton;
  if not found or settings.admin_email is null or not actor_row.confirmed or actor_row.email is null
    or ma_source_private.ascii_email(actor_row.email) collate "C" <> settings.admin_email collate "C" then
    return false;
  end if;
  if settings.admin_user_id is null then
    -- Bind once, and fail closed if an imported auth database has ambiguous
    -- confirmed users. Normal Supabase email uniqueness also enforces this.
    select count(*) into matching_users from auth.users as u
      where u.email_confirmed_at is not null
        and ma_source_private.ascii_email(u.email) collate "C" = settings.admin_email collate "C";
    if matching_users <> 1 then return false; end if;
    update ma_source_private.config set admin_user_id = actor_row.user_id
      where singleton and admin_user_id is null;
    select * into settings from ma_source_private.config where singleton;
  end if;
  if settings.admin_user_id is distinct from actor_row.user_id then return false; end if;
  insert into ma_source_private.members (user_id, email_snapshot, status, decided_at, decided_by)
    values (actor_row.user_id, actor_row.email, 'approved', now(), actor_row.user_id)
    on conflict (user_id) do nothing;
  return true;
end;
$$;

create function ma_source_private.member_summary(member_id uuid)
returns jsonb language sql stable security definer
set search_path = pg_catalog
as $$
  select pg_catalog.jsonb_build_object(
    'userId', m.user_id, 'email', u.email, 'requestedEmail', m.email_snapshot,
    'confirmed', u.email_confirmed_at is not null,
    'status', m.status, 'requestedAt', m.requested_at, 'decidedAt', m.decided_at,
    'isAdmin', m.user_id = c.admin_user_id)
  from ma_source_private.members as m join auth.users as u on u.id = m.user_id
    cross join ma_source_private.config as c
  where m.user_id = member_id and c.singleton
$$;

create function public.ma_source_access_status()
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  actor_row record;
  administrator boolean;
  member_status text;
  bundle_ready boolean;
begin
  select * into actor_row from ma_source_private.actor(false);
  administrator := ma_source_private.is_admin();
  select m.status into member_status from ma_source_private.members as m where m.user_id = actor_row.user_id;
  select c.bundle_id is not null and c.archive_key is not null into bundle_ready
    from ma_source_private.config as c where c.singleton;
  return pg_catalog.jsonb_build_object('userId', actor_row.user_id, 'email', actor_row.email,
    'confirmed', actor_row.confirmed, 'isAdmin', administrator,
    'status', case when not actor_row.confirmed then 'email_unconfirmed'
      when administrator then 'approved' else coalesce(member_status, 'none') end,
    'bundleReady', coalesce(bundle_ready, false));
end;
$$;

create function public.ma_source_access_request()
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare actor_row record;
begin
  select * into actor_row from ma_source_private.actor(true);
  if not ma_source_private.is_admin() then
    -- A user cannot approve themself or undo an administrator's revocation by
    -- submitting another request. Repeated pending requests are idempotent.
    insert into ma_source_private.members (user_id, email_snapshot, status)
      values (actor_row.user_id, actor_row.email, 'pending')
      on conflict (user_id) do nothing;
  end if;
  return public.ma_source_access_status();
end;
$$;

create function public.ma_source_access_members()
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare result jsonb;
begin
  if not ma_source_private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode = '42501';
  end if;
  select coalesce(pg_catalog.jsonb_agg(ma_source_private.member_summary(m.user_id)
    order by case when m.status = 'pending' then 0 else 1 end, m.requested_at desc, m.user_id), '[]'::jsonb)
    into result from ma_source_private.members as m;
  return result;
end;
$$;

-- Named RPC arguments support {target_user_id, allowed} or
-- {target_email, allowed}. Email lookup is administrator-only; approvals are
-- always stored against the resolved UUID, never a transferable email rule.
create function public.ma_source_access_set_member(
  target_user_id uuid default null, allowed boolean default null, target_email text default null
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  actor_row record;
  target_id uuid := target_user_id;
  target_row record;
  matched_ids uuid[];
  administrator_id uuid;
begin
  select * into actor_row from ma_source_private.actor(true);
  if not ma_source_private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode = '42501';
  end if;
  if allowed is null or target_id is null and target_email is null then
    raise exception 'Hesap ve izin seçimi gerekli.' using errcode = '22023';
  end if;
  if target_email is not null then
    if pg_catalog.length(target_email) not between 3 and 320 then
      raise exception 'E-posta adresi geçersiz.' using errcode = '22023';
    end if;
    select pg_catalog.array_agg(u.id) into matched_ids from auth.users as u
      where ma_source_private.ascii_email(u.email) collate "C" = ma_source_private.ascii_email(target_email) collate "C";
    if coalesce(pg_catalog.cardinality(matched_ids), 0) <> 1
      or target_id is not null and target_id <> matched_ids[1] then
      raise exception 'Tek bir kayıtlı hesap seçilmeli.' using errcode = '22023';
    end if;
    target_id := matched_ids[1];
  end if;
  select u.id, u.email, u.email_confirmed_at is not null as confirmed into target_row
    from auth.users as u where u.id = target_id;
  if not found or target_row.email is null or target_row.email = '' then
    raise exception 'Kayıtlı hesap bulunamadı.' using errcode = '22023';
  end if;
  if allowed and not target_row.confirmed then
    raise exception 'Hesabın e-postası doğrulanmalı.' using errcode = '22023';
  end if;
  select c.admin_user_id into administrator_id from ma_source_private.config as c where c.singleton;
  if target_id = administrator_id and not allowed then
    raise exception 'Yönetici kendi erişimini kaldıramaz.' using errcode = '22023';
  end if;
  insert into ma_source_private.members (user_id, email_snapshot, status, decided_at, decided_by)
    values (target_id, target_row.email, case when allowed then 'approved' else 'revoked' end, now(), actor_row.user_id)
    on conflict (user_id) do update set email_snapshot = excluded.email_snapshot,
      status = excluded.status, decided_at = excluded.decided_at, decided_by = excluded.decided_by;
  return ma_source_private.member_summary(target_id);
end;
$$;

create function public.ma_source_archive_access()
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  actor_row record;
  administrator boolean;
  bundle text;
  decryption_key text;
begin
  select * into actor_row from ma_source_private.actor(true);
  administrator := ma_source_private.is_admin();
  if not administrator and not exists (
    select 1 from ma_source_private.members as m where m.user_id = actor_row.user_id and m.status = 'approved'
  ) then
    raise exception 'Kaynak arşivi için yönetici onayı gerekli.' using errcode = '42501';
  end if;
  select c.bundle_id, c.archive_key into bundle, decryption_key
    from ma_source_private.config as c where c.singleton;
  if bundle is null or decryption_key is null then
    raise exception 'Kaynak arşivi henüz yapılandırılmadı.' using errcode = '55000';
  end if;
  return pg_catalog.jsonb_build_object('bundleId', bundle, 'key', decryption_key);
end;
$$;

revoke all on all functions in schema ma_source_private from public, anon, authenticated;
revoke all on function public.ma_source_access_status() from public, anon, authenticated;
revoke all on function public.ma_source_access_request() from public, anon, authenticated;
revoke all on function public.ma_source_access_members() from public, anon, authenticated;
revoke all on function public.ma_source_access_set_member(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.ma_source_archive_access() from public, anon, authenticated;
grant execute on function public.ma_source_access_status() to authenticated;
grant execute on function public.ma_source_access_request() to authenticated;
grant execute on function public.ma_source_access_members() to authenticated;
grant execute on function public.ma_source_access_set_member(uuid, boolean, text) to authenticated;
grant execute on function public.ma_source_archive_access() to authenticated;

-- The secret is deliberately absent. After reviewing this migration, configure
-- bundle_id and archive_key with a separate ignored/private SQL setup file.
-- Never paste the real key into this migration, source control or test output.
commit;
