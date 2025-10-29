-- =========================================================
-- QuizTime Schema Ledger (idempotent)
-- Мета: єдиний файл, де фіксуємо ВСІ DDL/політики/RPC,
-- які ми додаємо для проєкту. Запускай у Supabase Dashboard → SQL.
-- Скрипт безпечний до повторного виконання (IF NOT EXISTS).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Таблиця public.profiles + колонки + тригер updated_at
--    та RPC для короткого ID і перевірки email.
-- ---------------------------------------------------------

-- UUID helper
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text,
  birth_date date,
  avatar_url text,
  short_id text unique
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists t_profiles_updated_at on public.profiles;
create trigger t_profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

-- Додаємо колонки на випадок, якщо таблиця вже існувала
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists birth_date date,
  add column if not exists avatar_url text,
  add column if not exists short_id text unique,
  add column if not exists is_admin boolean not null default false;

-- RLS політики
alter table public.profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_select') then
    create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_insert') then
    create policy profiles_self_insert on public.profiles for insert to authenticated with check (id = auth.uid() and is_admin = false);
  end if;
  -- Пользователь может редактировать СВОЙ профиль, но только если оставляет is_admin=false
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_update_user_fields') then
    create policy profiles_self_update_user_fields on public.profiles for update to authenticated
      using (id = auth.uid())
      with check (id = auth.uid() and is_admin = false);
  end if;
  -- Администратор может обновлять любые поля (включая is_admin)
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_update') then
    create policy profiles_admin_update on public.profiles for update to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
      with check (true);
  end if;
end $$;

-- RPC: короткий ID (6 цифр)
create or replace function public.get_or_create_short_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_short text;
begin
  select auth.uid() into v_uid;
  if v_uid is null then
    return null;
  end if;

  select short_id into v_short from public.profiles where id = v_uid;
  if v_short is not null then
    return v_short;
  end if;

  for i in 1..5 loop
    v_short := lpad((floor(random()*1000000))::int::text, 6, '0');
    begin
      insert into public.profiles(id, short_id) values (v_uid, v_short)
      on conflict (id) do update set short_id = excluded.short_id where public.profiles.short_id is null;
      return v_short;
    exception when unique_violation then
      continue;
    end;
  end loop;
  return v_short;
end
$$;

grant execute on function public.get_or_create_short_id() to authenticated;

-- RPC: перевірка наявності email у auth.users (використовуємо в реєстрації)
create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(p_email)
       or lower(coalesce(u.raw_user_meta_data->>'contact_email','')) = lower(p_email)
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;


-- ---------------------------------------------------------
-- 2) Storage bucket "avatars" + політики доступу
--    (варіант без storage.create_bucket; працює на всіх версіях)
-- ---------------------------------------------------------

-- Створюємо bucket avatars, якщо нема
do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'avatars'
  ) then
    insert into storage.buckets (id, name, public)
    values ('avatars','avatars', true);
  end if;
end$$;

-- Політики для storage.objects (RLS увімкнений у Supabase за замовчуванням)
do $$
begin
  -- Публічне читання тільки з бакета avatars
  if not exists (
    select 1 from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname='avatars_public_read'
  ) then
    create policy avatars_public_read
      on storage.objects
      for select
      to public
      using (bucket_id = 'avatars');
  end if;

  -- Власник може читати свої файли (доповнення до public_read)
  if not exists (
    select 1 from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname='avatars_owner_read'
  ) then
    create policy avatars_owner_read
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'avatars'
        and split_part(name,'/',1) = auth.uid()::text
      );
  end if;

  -- Дозволяємо insert лише в avatars і лише у власну папку {user_id}/...
  if not exists (
    select 1 from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname='avatars_owner_insert'
  ) then
    create policy avatars_owner_insert
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and split_part(name,'/',1) = auth.uid()::text
      );
  end if;

  -- Update тільки своїх файлів у avatars
  if not exists (
    select 1 from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname='avatars_owner_update'
  ) then
    create policy avatars_owner_update
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'avatars'
        and split_part(name,'/',1) = auth.uid()::text
      );
  end if;

  -- Delete тільки своїх файлів у avatars
  if not exists (
    select 1 from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname='avatars_owner_delete'
  ) then
    create policy avatars_owner_delete
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'avatars'
        and split_part(name,'/',1) = auth.uid()::text
      );
  end if;
end$$;

-- Кінець Ledger. Нові таблиці/колонки/політики додаємо нижче
-- наступними секціями з IF NOT EXISTS.

-- =========================================================
-- QUIZTIME: Лиговые Викторины (MVP)
-- Сущности: лиги/этапы/туры/матчи, викторины, вопросы, ответы,
-- попытки, расчеты, рейтинги. Все под RLS с политиками для
-- анонимного просмотра опубликованных и участия только
-- для залогиненных пользователей до дедлайна.
-- =========================================================

-- 0) Справочники лиг и этапов
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, -- e.g. EKSTRA, LALIGA, UCL, BUND, EPL, SERIEA
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.leagues enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leagues' and policyname='leagues_read_all') then
    create policy leagues_read_all on public.leagues for select using (true);
  end if;
end $$;

-- Предзадать 6 основных лиг
do $$
begin
  insert into public.leagues(code,name)
  values
    ('EKSTRA','Ekstraklasa'),
    ('LALIGA','La Liga'),
    ('UCL','Liga Mistrzów'),
    ('BUND','Bundesliga'),
    ('EPL','Premier League'),
    ('SERIEA','Serie A')
  on conflict (code) do nothing;
end $$;

-- Этапы турниров (1/8, 1/4 и т.д.) – опционально
create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  code text not null,   -- e.g. R16, QF, SF, F
  name text not null
);
alter table public.stages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stages' and policyname='stages_read_all') then
    create policy stages_read_all on public.stages for select using (true);
  end if;
end $$;

-- 1) Туры (или этапы) и матчи для лиги
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  label text not null,                -- "14. kolejka" / "1/8 finału"
  stage_id uuid references public.stages(id) on delete set null,
  starts_at timestamptz not null,     -- время публикации
  deadline_at timestamptz not null,   -- дедлайн (обычно старт первого матча)
  ends_at timestamptz,                -- окончание последнего матча
  timezone text not null default 'Europe/Warsaw',
  status text not null default 'draft', -- draft|published|locked|settled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists t_rounds_updated_at on public.rounds;
create trigger t_rounds_updated_at before update on public.rounds
for each row execute procedure public.handle_updated_at();

alter table public.rounds enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds_read_published') then
    create policy rounds_read_published on public.rounds for select using (status <> 'draft');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds_auth_ins_upd') then
    create policy rounds_auth_ins_upd on public.rounds for insert to authenticated with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
    create policy rounds_auth_upd on public.rounds for update to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
  end if;
end $$;

-- Матчи тура (минимум для 1x2)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  enabled boolean not null default true,
  result_home int,  -- итог (если есть)
  result_away int,
  status text not null default 'scheduled' -- scheduled|postponed|cancelled|finished
);

alter table public.matches enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_read_all') then
    create policy matches_read_all on public.matches for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_auth_cud') then
    create policy matches_auth_ins on public.matches for insert to authenticated with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
    create policy matches_auth_upd on public.matches for update to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
    create policy matches_auth_del on public.matches for delete to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
  end if;
end $$;

-- 2) Викторина по туру (по сути – контейнер вопросов)
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  title text not null,
  description text,
  points_history int not null default 1,
  points_future_exact int not null default 1,
  points_score_exact int not null default 3,
  points_score_tendency int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists t_quizzes_updated_at on public.quizzes;
create trigger t_quizzes_updated_at before update on public.quizzes
for each row execute procedure public.handle_updated_at();

alter table public.quizzes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_public_read') then
    create policy quizzes_public_read on public.quizzes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_auth_cud') then
    create policy quizzes_auth_ins on public.quizzes for insert to authenticated with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
    create policy quizzes_auth_upd on public.quizzes for update to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
    create policy quizzes_auth_del on public.quizzes for delete to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
  end if;
end $$;

-- Типы вопросов: history_single, history_multi, history_bool, history_numeric, future_1x2, future_score
create type if not exists public.question_kind as enum (
  'history_single', 'history_multi', 'history_bool', 'history_numeric',
  'future_1x2', 'future_score'
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null, -- для будущих
  kind public.question_kind not null,
  prompt text not null,
  -- для вариантов
  options jsonb,   -- [{id:"1", text:"..."}, ...]
  correct jsonb,   -- хранит id правильных вариантов или объект результата
  order_index int not null default 0
);

alter table public.quiz_questions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_public_read') then
    create policy quiz_questions_public_read on public.quiz_questions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_auth_cud') then
    create policy quiz_questions_auth_ins on public.quiz_questions for insert to authenticated with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
    create policy quiz_questions_auth_upd on public.quiz_questions for update to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
    create policy quiz_questions_auth_del on public.quiz_questions for delete to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
  end if;
end $$;

-- Попытка пользователя (один сабмит на квиз)
create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quiz_id, user_id)
);

alter table public.quiz_submissions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_submissions' and policyname='quiz_submissions_self') then
    create policy quiz_submissions_self on public.quiz_submissions for select using (user_id = auth.uid());
    create policy quiz_submissions_insert on public.quiz_submissions for insert with check (user_id = auth.uid());
    create policy quiz_submissions_update on public.quiz_submissions for update using (user_id = auth.uid());
  end if;
end $$;

-- Ответы по каждому вопросу
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.quiz_submissions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  answer jsonb not null, -- payload (ids, текст, число, счёт)
  created_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

alter table public.quiz_answers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_answers' and policyname='quiz_answers_self') then
    create policy quiz_answers_self on public.quiz_answers for select using (
      exists (select 1 from public.quiz_submissions s where s.id = submission_id and s.user_id = auth.uid())
    );
    create policy quiz_answers_insert on public.quiz_answers for insert with check (
      exists (select 1 from public.quiz_submissions s where s.id = submission_id and s.user_id = auth.uid())
    );
    create policy quiz_answers_update on public.quiz_answers for update using (
      exists (select 1 from public.quiz_submissions s where s.id = submission_id and s.user_id = auth.uid())
    );
  end if;
end $$;

-- Расчёт и рейтинг
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null,
  correct_future int not null default 0,
  submitted_at timestamptz,
  rank int,
  data jsonb, -- расшифровка по вопросам
  unique (quiz_id, user_id)
);

alter table public.quiz_results enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_results' and policyname='quiz_results_public_read') then
    create policy quiz_results_public_read on public.quiz_results for select using (true);
  end if;
end $$;

-- RPC: состояние раунда (лок/анлок) и возможность отвечать
create or replace function public.round_is_open(p_round uuid)
returns boolean language sql stable as $$
  select r.status in ('published') and now() < r.deadline_at
  from public.rounds r where r.id = p_round
$$;
grant execute on function public.round_is_open(uuid) to anon, authenticated;

-- Индексы
create index if not exists idx_rounds_league on public.rounds(league_id);
create index if not exists idx_matches_round on public.matches(round_id);
create index if not exists idx_quizzes_round on public.quizzes(round_id);
create index if not exists idx_questions_quiz on public.quiz_questions(quiz_id);
create index if not exists idx_submissions_quiz_user on public.quiz_submissions(quiz_id, user_id);
create index if not exists idx_results_quiz_points on public.quiz_results(quiz_id, points desc);

-- Расчет результатов для квиза (MVP: history_single, future_1x2)
create or replace function public.settle_quiz(p_quiz uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with qz as (
    select * from public.quizzes where id = p_quiz
  ), pts as (
    select s.id as submission_id, s.user_id, s.submitted_at,
      sum(
        case when qq.kind = 'history_single' and coalesce(a.answer->>'id', a.answer->>'choice') = coalesce(qq.correct->>'id', qq.correct->>'choice')
          then (select points_history from qz) else 0 end
        +
        case when qq.kind = 'future_1x2' and coalesce(a.answer->>'pick', a.answer->>'choice') = coalesce(qq.correct->>'pick', qq.correct->>'choice')
          then (select points_future_exact from qz) else 0 end
      ) as points,
      sum(case when qq.kind = 'future_1x2' and coalesce(a.answer->>'pick', a.answer->>'choice') = coalesce(qq.correct->>'pick', qq.correct->>'choice') then 1 else 0 end) as correct_future
    from public.quiz_submissions s
    join public.quiz_answers a on a.submission_id = s.id
    join public.quiz_questions qq on qq.id = a.question_id
    where s.quiz_id = p_quiz
    group by s.id, s.user_id, s.submitted_at
  )
  , ranked as (
    select p_quiz as quiz_id, user_id, points, correct_future, submitted_at,
      rank() over (order by points desc, correct_future desc, submitted_at asc) as rnk
    from pts
  )
  delete from public.quiz_results where quiz_id = p_quiz;
  insert into public.quiz_results(quiz_id, user_id, points, correct_future, submitted_at, rank)
  select quiz_id, user_id, points, correct_future, submitted_at, rnk from ranked;
$$;

grant execute on function public.settle_quiz(uuid) to authenticated;
