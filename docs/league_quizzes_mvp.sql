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
    select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds_auth_ins'
  ) then
    create policy rounds_auth_ins on public.rounds for insert to authenticated with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds_auth_upd'
  ) then
    create policy rounds_auth_upd on public.rounds for update to authenticated using (true);
  end if;
end $$;

-- Matches in a round
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  home_team text not null,
  home_team_external_id text,
  away_team text not null,
  away_team_external_id text,
  kickoff_at timestamptz not null,
  enabled boolean not null default true,
  result_home int,
  result_away int,
  status text not null default 'scheduled', -- scheduled|postponed|cancelled|finished
  round_label text
);

alter table public.matches
  add column if not exists home_team_external_id text,
  add column if not exists away_team_external_id text,
  add column if not exists round_label text;

alter table public.matches enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_read_all'
  ) then
    create policy matches_read_all on public.matches for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_auth_ins'
  ) then
    create policy matches_auth_ins on public.matches for insert to authenticated with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_auth_upd'
  ) then
    create policy matches_auth_upd on public.matches for update to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches_auth_del'
  ) then
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
    select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_auth_ins'
  ) then
    create policy quizzes_auth_ins on public.quizzes for insert to authenticated with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_auth_upd'
  ) then
    create policy quizzes_auth_upd on public.quizzes for update to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_auth_del'
  ) then
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
    select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_auth_ins'
  ) then
    create policy quiz_questions_auth_ins on public.quiz_questions for insert to authenticated with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_auth_upd'
  ) then
    create policy quiz_questions_auth_upd on public.quiz_questions for update to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_auth_del'
  ) then
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
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_submissions' and policyname='quiz_submissions_insert'
  ) then
    create policy quiz_submissions_insert on public.quiz_submissions for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and табlename='quiz_submissions' and policyname='quiz_submissions_update'
  ) then
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
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_answers' and policyname='quiz_answers_insert'
  ) then
    create policy quiz_answers_insert on public.quiz_answers for insert with check (
      exists (select 1 from public.quiz_submissions s where s.id = submission_id and s.user_id = auth.uid())
    );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_answers' and policyname='quiz_answers_update'
  ) then
    create policy quiz_answers_update on public.quiz_answers for update using (
      exists (select 1 from public.quiz_submissions s where s.id = submission_id and s.user_id = auth.uid())
    );
  end if;
end $$;

-- Results / ranking
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  submission_id uuid references public.quiz_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null,
  correct_future int not null default 0,
  total_correct int not null default 0,
  total_questions int not null default 0,
  prize_awarded numeric(14,2) not null default 0,
  status text not null default 'pending',
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

alter table public.quiz_results
  add column if not exists submission_id uuid references public.quiz_submissions(id) on delete cascade,
  add column if not exists total_correct int not null default 0,
  add column if not exists total_questions int not null default 0,
  add column if not exists prize_awarded numeric(14,2) not null default 0,
  add column if not exists status text not null default 'pending';

alter table public.quiz_results
  add constraint if not exists quiz_results_submission_unique unique (submission_id);

create table if not exists public.quiz_prize_brackets (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  correct_answers int not null check (correct_answers >= 0),
  pool numeric(14,2) not null check (pool >= 0),
  unique (quiz_id, correct_answers)
);

alter table public.quiz_prize_brackets enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_prize_brackets' and policyname='quiz_prize_brackets_public_read'
  ) then
    create policy quiz_prize_brackets_public_read on public.quiz_prize_brackets for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='quiz_prize_brackets' and policyname='quiz_prize_brackets_admin_cud'
  ) then
    create policy quiz_prize_brackets_admin_cud on public.quiz_prize_brackets for all using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    ) with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
  end if;
end $$;

create table if not exists public.history_question_bank (
  id uuid primary key default gen_random_uuid(),
  match_identifier text not null,
  template text not null,
  match_id uuid references public.matches(id) on delete set null,
  source_question_id uuid unique references public.quiz_questions(id) on delete set null,
  home_team text not null,
  away_team text not null,
  home_score int not null,
  away_score int not null,
  played_at timestamptz,
  league_code text,
  source_kind text not null default 'manual',
  status text not null default 'ready',
  payload jsonb,
  used_in_quiz_id uuid references public.quizzes(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_identifier, template)
);

alter table public.history_question_bank enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='history_question_bank' and policyname='history_bank_admin_all'
  ) then
    create policy history_bank_admin_all on public.history_question_bank for all using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    ) with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
  end if;
end $$;

drop trigger if exists t_history_question_bank_updated on public.history_question_bank;
create trigger t_history_question_bank_updated
  before update on public.history_question_bank
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_history_bank_status on public.history_question_bank(status);
create index if not exists idx_history_bank_played_at on public.history_question_bank(played_at desc);
create index if not exists idx_history_bank_used_quiz on public.history_question_bank(used_in_quiz_id);

-- RPC: актуальный баланс игрока по сумме выигранных бонусов
create or replace function public.get_user_balance()
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(prize_awarded), 0)::numeric(18,2)
  from public.quiz_results
  where user_id = auth.uid();
$$;

grant execute on function public.get_user_balance() to authenticated;

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

-- settle_quiz: compute ranking + prize brackets
create or replace function public.settle_quiz(p_quiz uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with question_stats as (
    select count(*)::int as total from public.quiz_questions where quiz_id = p_quiz
  ),
  qz as (
    select * from public.quizzes where id = p_quiz
  ),
  answers as (
    select
      s.id as submission_id,
      s.user_id,
      s.submitted_at,
      qq.kind,
      qq.correct,
      a.answer,
      coalesce(
        a.answer->>'pick',
        a.answer->>'choice',
        a.answer->>'id',
        nullif(btrim(a.answer::text, '"'), '')
      ) as answer_scalar,
      coalesce(
        qq.correct->>'pick',
        qq.correct->>'choice',
        qq.correct->>'id',
        nullif(btrim(qq.correct::text, '"'), '')
      ) as correct_scalar
    from public.quiz_submissions s
    join public.quiz_answers a on a.submission_id = s.id
    join public.quiz_questions qq on qq.id = a.question_id
    where s.quiz_id = p_quiz
  ),
  pts as (
    select
      submission_id,
      user_id,
      submitted_at,
      sum(
        case
          when kind = 'history_single' and answer_scalar = correct_scalar then (select points_history from qz)
          when kind = 'history_numeric' and coalesce(answer::text, 'null') = coalesce(correct::text, 'null') then (select points_history from qz)
          when kind = 'future_1x2' and answer_scalar = correct_scalar then (select points_future_exact from qz)
          when kind = 'future_score'
            and coalesce((answer->>'home')::int, -9999) = coalesce((correct->>'home')::int, -9999)
            and coalesce((answer->>'away')::int, -9999) = coalesce((correct->>'away')::int, -9999)
            then (select points_score_exact from qz)
          else 0
        end
      ) as points,
      sum(
        case
          when kind = 'future_1x2' and answer_scalar = correct_scalar then 1
          when kind = 'future_score'
            and coalesce((answer->>'home')::int, -9999) = coalesce((correct->>'home')::int, -9999)
            and coalesce((answer->>'away')::int, -9999) = coalesce((correct->>'away')::int, -9999)
            then 1
          else 0
        end
      ) as correct_future,
      sum(
        case
          when kind = 'history_single' and answer_scalar = correct_scalar then 1
          when kind = 'history_numeric' and coalesce(answer::text, 'null') = coalesce(correct::text, 'null') then 1
          when kind = 'future_1x2' and answer_scalar = correct_scalar then 1
          when kind = 'future_score'
            and coalesce((answer->>'home')::int, -9999) = coalesce((correct->>'home')::int, -9999)
            and coalesce((answer->>'away')::int, -9999) = coalesce((correct->>'away')::int, -9999)
            then 1
          else 0
        end
      ) as total_correct
    from answers
    group by submission_id, user_id, submitted_at
  ),
  ranked as (
    select
      p_quiz as quiz_id,
      submission_id,
      user_id,
      points,
      correct_future,
      total_correct,
      (select total from question_stats) as total_questions,
      submitted_at,
      rank() over (order by points desc, correct_future desc, submitted_at asc) as rnk
    from pts
  ),
  bracket_counts as (
    select
      b.quiz_id,
      b.correct_answers,
      b.pool,
      count(r.*) filter (where r.total_correct = b.correct_answers) as winners
    from public.quiz_prize_brackets b
    left join ranked r on r.quiz_id = b.quiz_id and r.total_correct = b.correct_answers
    where b.quiz_id = p_quiz
    group by b.quiz_id, b.correct_answers, b.pool
  ),
  final as (
    select
      r.quiz_id,
      r.submission_id,
      r.user_id,
      r.points,
      r.correct_future,
      r.total_correct,
      r.total_questions,
      r.submitted_at,
      r.rnk,
      case
        when bc.winners is null or bc.winners = 0 then 0::numeric
        else round((bc.pool / bc.winners)::numeric, 2)
      end as prize_awarded
    from ranked r
    left join bracket_counts bc on bc.quiz_id = r.quiz_id and bc.correct_answers = r.total_correct
  )
  delete from public.quiz_results where quiz_id = p_quiz;

  insert into public.quiz_results (
    quiz_id, submission_id, user_id, points, correct_future, total_correct, total_questions, prize_awarded, submitted_at, rank, status
  )
  select
    quiz_id,
    submission_id,
    user_id,
    points,
    correct_future,
    total_correct,
    total_questions,
    prize_awarded,
    submitted_at,
    rnk,
    case when prize_awarded > 0 then 'won' else 'lost' end
  from final;
  
  insert into public.history_question_bank (
    match_identifier,
    template,
    match_id,
    source_question_id,
    home_team,
    away_team,
    home_score,
    away_score,
    played_at,
    league_code,
    source_kind,
    status,
    payload
  )
  select
    'match:' || m.id::text,
    'winner_1x2',
    m.id,
    qq.id,
    m.home_team,
    m.away_team,
    m.result_home,
    m.result_away,
    coalesce(m.kickoff_at, now()),
    lg.code,
    'future_auto',
    'ready',
    jsonb_build_object('quiz_id', p_quiz, 'question_id', qq.id, 'from_kind', qq.kind)
  from public.quiz_questions qq
  join public.matches m on m.id = qq.match_id
  join public.rounds rd on rd.id = m.round_id
  join public.leagues lg on lg.id = rd.league_id
  where
    qq.quiz_id = p_quiz
    and qq.kind = 'future_1x2'
    and qq.match_id is not null
    and m.result_home is not null
    and m.result_away is not null
  on conflict (match_identifier, template) do update
    set
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      updated_at = now(),
      payload = coalesce(public.history_question_bank.payload, '{}'::jsonb) || excluded.payload;

  insert into public.history_question_bank (
    match_identifier,
    template,
    match_id,
    home_team,
    away_team,
    home_score,
    away_score,
    played_at,
    league_code,
    source_kind,
    status,
    payload
  )
  select
    'match:' || m.id::text,
    'total_goals',
    m.id,
    m.home_team,
    m.away_team,
    m.result_home,
    m.result_away,
    coalesce(m.kickoff_at, now()),
    lg.code,
    'future_auto',
    'ready',
    jsonb_build_object('quiz_id', p_quiz, 'question_id', qq.id, 'from_kind', qq.kind)
  from public.quiz_questions qq
  join public.matches m on m.id = qq.match_id
  join public.rounds rd on rd.id = m.round_id
  join public.leagues lg on lg.id = rd.league_id
  where
    qq.quiz_id = p_quiz
    and qq.kind = 'future_score'
    and qq.match_id is not null
    and m.result_home is not null
    and m.result_away is not null
  on conflict (match_identifier, template) do update
    set
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      updated_at = now(),
      payload = coalesce(public.history_question_bank.payload, '{}'::jsonb) || excluded.payload;
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
create index if not exists idx_prize_brackets_quiz on public.quiz_prize_brackets(quiz_id, correct_answers);

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
