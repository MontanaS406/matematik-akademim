-- New/staging installation only. An existing table causes failure, never replacement.
-- Review existing policies separately: permissive policies combine with OR.
begin;
create table public.exam_results (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_type text not null check (exam_type in ('TYT', 'AYT')),
  correct integer not null check (correct between 0 and 40),
  wrong integer not null check (wrong between 0 and 40),
  blank integer not null check (blank between 0 and 40),
  net numeric(5,2),
  duration_seconds integer not null check (duration_seconds >= 0),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  check (correct + wrong + blank <= 40),
  check (net is null or (correct + wrong + blank = 40 and net = correct - wrong / 4.0))
);
create index exam_results_user_date_idx on public.exam_results (user_id, created_at desc);
alter table public.exam_results enable row level security;
alter table public.exam_results force row level security;
revoke all on public.exam_results from public, anon;
grant select, insert, update, delete on public.exam_results to authenticated;
create policy exam_results_select_own on public.exam_results for select to authenticated
  using ((select auth.uid()) = user_id);
create policy exam_results_insert_own on public.exam_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy exam_results_update_own on public.exam_results for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy exam_results_delete_own on public.exam_results for delete to authenticated
  using ((select auth.uid()) = user_id);
commit;
