-- New/staging content tables only. No changes to auth users, learning profiles or history.
-- Curator approval happens outside the client. Public/authenticated roles can never write.
begin;
create function public.canonical_question_source_url(value text) returns text language sql immutable strict as $$
  with parts as (select split_part(value,'#',1) as raw),
  base as (select split_part(raw,'?',1) as base_url, case when strpos(raw,'?') > 0 then substring(raw from strpos(raw,'?')+1) else '' end as query from parts),
  filtered as (select base_url, (select string_agg(param,'&' order by param) from unnest(string_to_array(query,'&')) param where param <> '' and param !~* '^(utm_[^=]*|fbclid|gclid)=') as query from base)
  select 'https://' || regexp_replace(lower(substring(base_url from '^https://([^/]+)')), ':443$', '') || coalesce(nullif(substring(base_url from '^https://[^/]+(.*)$'),''),'/') || case when query is null then '' else '?' || query end from filtered;
$$;
create table public.question_sources (
  id text primary key check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'),
  publisher text not null check (length(btrim(publisher)) between 1 and 500),
  name text not null check (length(btrim(name)) between 1 and 500),
  title text not null check (length(btrim(title)) between 1 and 500),
  year smallint not null check (year between 1900 and 2100),
  exam_type text check (exam_type in ('TYT','AYT','KPSS_ONLISANS','KPSS_ORTAOGRETIM','ALES','DGS','MEB')),
  original_url text not null check (original_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  license_name text not null,
  license_url text not null check (license_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  license_status text not null default 'pending' check (license_status in ('pending','verified','rejected')),
  allows_inline boolean not null default false,
  allows_embed boolean not null default false,
  attribution text not null check (length(btrim(attribution)) between 1 and 2000),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  checked_at timestamptz,
  evidence_url text check (evidence_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  pdf_sha256 text check (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  complete_math boolean not null default false,
  math_question_count smallint check (math_question_count between 0 and 40),
  corrections_checked_at timestamptz,
  corrections_evidence_url text check (corrections_evidence_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  cancelled_numbers integer[] not null default '{}'::integer[] check (cancelled_numbers <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40]),
  audit_notes text not null default '',
  created_at timestamptz not null default now(),
  check (not complete_math or (math_question_count is not null and math_question_count = 40 and corrections_checked_at is not null and corrections_evidence_url is not null)),
  check (verification_status <> 'verified' or (checked_at is not null and evidence_url is not null))
);
create unique index question_sources_canonical_original on public.question_sources (public.canonical_question_source_url(original_url));
create table public.source_questions (
  id text primary key check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'),
  source_id text not null references public.question_sources(id),
  exam_type text check (exam_type in ('TYT','AYT','KPSS_ONLISANS','KPSS_ORTAOGRETIM','ALES','DGS','MEB')),
  year smallint not null check (year between 1900 and 2100),
  section text check (length(btrim(section)) between 1 and 120),
  page integer check (page between 1 and 10000),
  question_number text not null check (length(btrim(question_number)) between 1 and 40),
  course_id text not null check (course_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'),
  topic text not null check (length(btrim(topic)) between 1 and 500),
  difficulty text check (difficulty in ('easy','medium','hard')),
  original_url text check (original_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  prompt text not null default '' check (length(prompt) <= 12000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 5),
  answer_value text,
  answer_status text not null default 'pending' check (answer_status in ('pending','verified','rejected')),
  answer_evidence_url text check (answer_evidence_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  display_mode text not null check (display_mode in ('inline','embed')),
  status text not null default 'draft' check (status in ('draft','published','rejected')),
  content_hash text check (content_hash ~ '^[a-f0-9]{64}$'),
  audit_notes text not null default '',
  created_at timestamptz not null default now(),
  check (section is not null or page is not null)
);
create unique index source_questions_original_locator on public.source_questions
  (source_id,coalesce(lower(btrim(section)),''),coalesce(page,-1),
   (case when btrim(question_number) ~ '^[0-9]+$' then (btrim(question_number)::numeric)::text else lower(btrim(question_number)) end));

create function public.validate_source_question() returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare s public.question_sources; option_count integer; unique_count integer;
begin
  select * into s from public.question_sources where id = new.source_id;
  if not found then raise exception 'Kaynak bulunamadı'; end if;
  if new.year <> s.year or new.exam_type is distinct from s.exam_type then raise exception 'Kaynak yıl veya sınav türü uyuşmuyor'; end if;
  if new.status = 'published' then
    if s.verification_status <> 'verified' or s.license_status <> 'verified' then raise exception 'Kaynak ve kullanım izni doğrulanmadan yayımlanamaz'; end if;
    if new.verification_status <> 'verified' or new.answer_status <> 'verified' or new.answer_evidence_url is null or length(btrim(coalesce(new.answer_value,''))) = 0 then raise exception 'Soru ve cevap doğrulanmadan yayımlanamaz'; end if;
    if new.display_mode = 'inline' and (not s.allows_inline or length(btrim(new.prompt)) = 0) then raise exception 'Metin gösterim izni yok'; end if;
    if new.display_mode = 'embed' and not s.allows_embed then raise exception 'Gömülü gösterim izni yok'; end if;
    if new.display_mode = 'embed' and not s.allows_inline and (length(btrim(new.prompt)) > 0 or jsonb_array_length(new.options) > 0) then raise exception 'Gömme izni metin kopyalama izni değildir'; end if;
    select count(*),count(distinct value->>'id') into option_count,unique_count from jsonb_array_elements(new.options);
    if option_count = 1 or option_count <> unique_count then raise exception 'Özgün seçenekler geçersiz'; end if;
    if exists(select 1 from jsonb_array_elements(new.options) o where jsonb_typeof(o) <> 'object' or not coalesce(o->>'id','') ~ '^[ABCDE]$' or length(btrim(coalesce(o->>'text',''))) = 0) then raise exception 'Seçenek biçimi geçersiz'; end if;
    if option_count > 0 and not exists(select 1 from jsonb_array_elements(new.options) o where o->>'id' = new.answer_value) then raise exception 'Cevap seçenekler içinde değil'; end if;
    if new.exam_type in ('TYT','AYT') and (option_count <> 5 or new.question_number !~ '^([1-9]|[1-3][0-9]|40)$') then raise exception 'TYT/AYT soru numarası veya seçenek sayısı geçersiz'; end if;
  end if;
  return new;
end;
$$;
create trigger source_questions_gate before insert or update on public.source_questions
  for each row execute function public.validate_source_question();

alter table public.question_sources enable row level security;
alter table public.question_sources force row level security;
alter table public.source_questions enable row level security;
alter table public.source_questions force row level security;
revoke all on public.question_sources,public.source_questions from public,anon,authenticated;
grant select on public.question_sources,public.source_questions to anon,authenticated;
create policy question_sources_verified_read on public.question_sources for select to anon,authenticated
 using (verification_status = 'verified' and license_status = 'verified' and (allows_inline or allows_embed));
create policy source_questions_verified_read on public.source_questions for select to anon,authenticated
 using (status = 'published' and verification_status = 'verified' and answer_status = 'verified' and exists (
   select 1 from public.question_sources s where s.id = source_id and s.verification_status = 'verified'
   and s.license_status = 'verified' and ((display_mode = 'inline' and s.allows_inline) or (display_mode = 'embed' and s.allows_embed))
 ));
commit;
