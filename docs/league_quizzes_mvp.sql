-- QuizTime — League Quizzes (MVP) schema

-- UUID helper
create extension if not exists pgcrypto;

-- updated_at trigger helper
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Leagues
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.leagues enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='leagues' and policyname='leagues_read_all'
  ) then
    create policy leagues_read_all on public.leagues for select using (true);
  end if;
end $$;

-- Stages (optional: 1/8, 1/4, SF, F)
create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null
);

alter table public.stages enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stages' and policyname='stages_read_all'
  ) then
    create policy stages_read_all on public.stages for select using (true);
  end if;
end $$;

-- Rounds (tour/phase for a league)
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  label text not null,
  stage_id uuid references public.stages(id) on delete set null,
  starts_at timestamptz not null,    -- publish time
  deadline_at timestamptz not null,  -- answers close (first kickoff)
  ends_at timestamptz,
  timezone text not null default 'Europe/Warsaw',
  status text not null default 'draft', -- draft|published|locked|settled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists t_rounds_updated_at on public.rounds;
create trigger t_rounds_updated_at
before update on public.rounds
for each row execute procedure public.handle_updated_at();

alter table public.rounds enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds_read_published'
  ) then
    create policy rounds_read_published on public.rounds for select using (status <> 'draft');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds_auth_ins_upd'
  ) then
    create policy rounds_auth_ins_upd on public.rounds for insert to authenticated with check (true);
    create policy rounds_auth_upd on public.rounds for update to authenticated using (true);
  end if;
end $$;

-- Matches in a round
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  enabled boolean not null default true,
  result_home int,
  result_away int,
  status text not null default 'scheduled' -- scheduled|postponed|cancelled|finished
);

alter table public.matches enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_read_all'
  ) then
    create policy matches_read_all on public.matches for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_auth_cud'
  ) then
    create policy matches_auth_ins on public.matches for insert to authenticated with check (true);
    create policy matches_auth_upd on public.matches for update to authenticated using (true);
    create policy matches_auth_del on public.matches for delete to authenticated using (true);
  end if;
end $$;

-- Quizzes (container for questions per round)
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
create trigger t_quizzes_updated_at
before update on public.quizzes
for each row execute procedure public.handle_updated_at();

alter table public.quizzes enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_public_read'
  ) then
    create policy quizzes_public_read on public.quizzes for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_auth_cud'
  ) then
    create policy quizzes_auth_ins on public.quizzes for insert to authenticated with check (true);
    create policy quizzes_auth_upd on public.quizzes for update to authenticated using (true);
    create policy quizzes_auth_del on public.quizzes for delete to authenticated using (true);
  end if;
end $$;

-- Question kind enum (safe create without IF NOT EXISTS)
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'question_kind'
  ) then
    create type public.question_kind as enum (
      'history_single', 'history_multi', 'history_bool', 'history_numeric',
      'future_1x2', 'future_score'
    );
  end if;
end
$$;

-- Questions
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  kind public.question_kind not null,
  prompt text not null,
  options jsonb,
  correct jsonb,
  order_index int not null default 0
);

alter table public.quiz_questions enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_public_read'
  ) then
    create policy quiz_questions_public_read on public.quiz_questions for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_auth_cud'
  ) then
    create policy quiz_questions_auth_ins on public.quiz_questions for insert to authenticated with check (true);
    create policy quiz_questions_auth_upd on public.quiz_questions for update to authenticated using (true);
    create policy quiz_questions_auth_del on public.quiz_questions for delete to authenticated using (true);
  end if;
end $$;

-- Submissions (one per user per quiz)
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
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_submissions' and policyname='quiz_submissions_self'
  ) then
    create policy quiz_submissions_self on public.quiz_submissions for select using (user_id = auth.uid());
    create policy quiz_submissions_insert on public.quiz_submissions for insert with check (user_id = auth.uid());
    create policy quiz_submissions_update on public.quiz_submissions for update using (user_id = auth.uid());
  end if;
end $$;

-- Answers
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.quiz_submissions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

alter table public.quiz_answers enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_answers' and policyname='quiz_answers_self'
  ) then
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

-- Results / ranking
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null,
  correct_future int not null default 0,
  submitted_at timestamptz,
  rank int,
  data jsonb,
  unique (quiz_id, user_id)
);

alter table public.quiz_results enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_results' and policyname='quiz_results_public_read'
  ) then
    create policy quiz_results_public_read on public.quiz_results for select using (true);
  end if;
end $$;

-- Helpers

create or replace function public.round_is_open(p_round uuid)
returns boolean
language sql stable
as $$
  select r.status in ('published') and now() < r.deadline_at
  from public.rounds r
  where r.id = p_round
$$;

grant execute on function public.round_is_open(uuid) to anon, authenticated;

-- settle_quiz: compute results (MVP: history_single + future_1x2)
create or replace function public.settle_quiz(p_quiz uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.quiz_results where quiz_id = p_quiz;

  insert into public.quiz_results (quiz_id, user_id, points, correct_future, submitted_at, rank)
  select quiz_id, user_id, points, correct_future, submitted_at, rnk
  from (
    with qz as (
      select * from public.quizzes where id = p_quiz
    ), pts as (
      select s.id as submission_id, s.user_id, s.submitted_at,
        sum(
          case
            when qq.kind = 'history_single'
             and coalesce(a.answer->>'id', a.answer->>'choice') = coalesce(qq.correct->>'id', qq.correct->>'choice')
            then (select points_history from qz) else 0 end
          +
          case
            when qq.kind = 'future_1x2'
             and coalesce(a.answer->>'pick', a.answer->>'choice') = coalesce(qq.correct->>'pick', qq.correct->>'choice')
            then (select points_future_exact from qz) else 0 end
        ) as points,
        sum(
          case
            when qq.kind = 'future_1x2'
             and coalesce(a.answer->>'pick', a.answer->>'choice') = coalesce(qq.correct->>'pick', qq.correct->>'choice')
            then 1 else 0 end
        ) as correct_future
      from public.quiz_submissions s
      join public.quiz_answers a on a.submission_id = s.id
      join public.quiz_questions qq on qq.id = a.question_id
      where s.quiz_id = p_quiz
      group by s.id, s.user_id, s.submitted_at
    ), ranked as (
      select p_quiz as quiz_id, user_id, points, correct_future, submitted_at,
        rank() over (order by points desc, correct_future desc, submitted_at asc) as rnk
      from pts
    )
    select * from ranked
  ) t;
end
$$;

grant execute on function public.settle_quiz(uuid) to authenticated;

-- Indexes
create index if not exists idx_rounds_league on public.rounds(league_id);
create index if not exists idx_matches_round on public.matches(round_id);
create index if not exists idx_quizzes_round on public.quizzes(round_id);
create index if not exists idx_questions_quiz on public.quiz_questions(quiz_id);
create index if not exists idx_submissions_quiz_user on public.quiz_submissions(quiz_id, user_id);
create index if not exists idx_results_quiz_points on public.quiz_results(quiz_id, points desc);

-- Seed the 6 core leagues
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

