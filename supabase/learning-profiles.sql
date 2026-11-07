-- New/staging table only. Existing profiles cause failure rather than replacement.
-- Never apply to production without inspecting the existing table and policies first.
begin;
create table public.learning_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint learning_profiles_state_object check (jsonb_typeof(state) = 'object'),
  constraint learning_profiles_state_size check (octet_length(state::text) < 100000)
);
alter table public.learning_profiles enable row level security;
alter table public.learning_profiles force row level security;
revoke all on public.learning_profiles from public, anon;
grant select, insert, update, delete on public.learning_profiles to authenticated;
create policy learning_profiles_select_own on public.learning_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy learning_profiles_insert_own on public.learning_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy learning_profiles_update_own on public.learning_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy learning_profiles_delete_own on public.learning_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);
commit;
