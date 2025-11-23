-- Create settle_quiz RPC that scores submissions, distributes prizes, and locks the round.
create or replace function public.settle_quiz(p_quiz uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
  v_processed integer := 0;
  v_winners integer := 0;
begin
  if p_quiz is null then
    raise exception 'quiz_id_required';
  end if;

  if v_actor is not null then
    select is_admin
      into v_is_admin
    from public.profiles
    where id = v_actor;
    if not coalesce(v_is_admin, false) then
      raise exception 'not_authorized';
    end if;
  end if;

  if not exists (select 1 from public.quizzes where id = p_quiz) then
    raise exception 'quiz_not_found';
  end if;

  if exists (
    select 1
    from public.quiz_questions
    where quiz_id = p_quiz
      and (kind::text like 'future%')
      and correct is null
  ) then
    raise exception 'pending_future_questions';
  end if;

  delete from public.quiz_results where quiz_id = p_quiz;

  with quiz_meta as (
    select
      q.id,
      coalesce(q.points_history, 1) as points_history,
      coalesce(q.points_future_exact, 1) as points_future_exact,
      coalesce(q.points_score_exact, 3) as points_score_exact,
      coalesce(q.points_score_tendency, 1) as points_score_tendency
    from public.quizzes q
    where q.id = p_quiz
  ),
  question_rows as (
    select
      qq.id,
      qq.quiz_id,
      qq.correct,
      qq.kind::text as kind
    from public.quiz_questions qq
    where qq.quiz_id = p_quiz
  ),
  question_totals as (
    select count(*)::int as total_questions from question_rows
  ),
  submission_rows as (
    select qs.id, qs.user_id, qs.submitted_at
    from public.quiz_submissions qs
    where qs.quiz_id = p_quiz
      and qs.submitted_at is not null
  ),
  answer_matrix as (
    select
      sr.id as submission_id,
      sr.user_id,
      sr.submitted_at,
      qr.id as question_id,
      qr.kind,
      qr.correct,
      qa.answer
    from submission_rows sr
    cross join question_rows qr
    left join public.quiz_answers qa
      on qa.submission_id = sr.id
     and qa.question_id = qr.id
  ),
  evaluated as (
    select
      am.*,
      (am.answer is not null and am.correct is not null and am.answer = am.correct) as is_exact,
      (am.kind like 'future%') as is_future,
      case
        when am.kind = 'future_score' and jsonb_typeof(am.answer) = 'object' and (am.answer->>'home') ~ '^-?[0-9]+$'
          then (am.answer->>'home')::int
        when am.kind = 'future_score' and jsonb_typeof(am.answer) = 'array' and jsonb_array_length(am.answer) >= 1 and (am.answer->>0) ~ '^-?[0-9]+$'
          then (am.answer->>0)::int
        else null
      end as answer_home,
      case
        when am.kind = 'future_score' and jsonb_typeof(am.answer) = 'object' and (am.answer->>'away') ~ '^-?[0-9]+$'
          then (am.answer->>'away')::int
        when am.kind = 'future_score' and jsonb_typeof(am.answer) = 'array' and jsonb_array_length(am.answer) >= 2 and (am.answer->>1) ~ '^-?[0-9]+$'
          then (am.answer->>1)::int
        else null
      end as answer_away,
      case
        when am.kind = 'future_score' and jsonb_typeof(am.correct) = 'object' and (am.correct->>'home') ~ '^-?[0-9]+$'
          then (am.correct->>'home')::int
        when am.kind = 'future_score' and jsonb_typeof(am.correct) = 'array' and jsonb_array_length(am.correct) >= 1 and (am.correct->>0) ~ '^-?[0-9]+$'
          then (am.correct->>0)::int
        else null
      end as correct_home,
      case
        when am.kind = 'future_score' and jsonb_typeof(am.correct) = 'object' and (am.correct->>'away') ~ '^-?[0-9]+$'
          then (am.correct->>'away')::int
        when am.kind = 'future_score' and jsonb_typeof(am.correct) = 'array' and jsonb_array_length(am.correct) >= 2 and (am.correct->>1) ~ '^-?[0-9]+$'
          then (am.correct->>1)::int
        else null
      end as correct_away
    from answer_matrix am
  ),
  enriched as (
    select
      ev.*,
      (
        ev.kind = 'future_score'
        and ev.answer_home is not null
        and ev.answer_away is not null
        and ev.correct_home is not null
        and ev.correct_away is not null
        and (
          (ev.answer_home = ev.answer_away and ev.correct_home = ev.correct_away)
          or (ev.answer_home > ev.answer_away and ev.correct_home > ev.correct_away)
          or (ev.answer_home < ev.answer_away and ev.correct_home < ev.correct_away)
        )
      ) as has_tendency
    from evaluated ev
  ),
  graded as (
    select
      en.*,
      case
        when en.kind like 'history%' and en.is_exact then qm.points_history
        when en.kind in ('future_1x2','future_yellow_cards','future_corners') and en.is_exact then qm.points_future_exact
        when en.kind = 'future_score' and en.is_exact then qm.points_score_exact
        when en.kind = 'future_score' and not en.is_exact and en.has_tendency then qm.points_score_tendency
        else 0
      end as awarded_points
    from enriched en
    cross join quiz_meta qm
  ),
  graded_totals as (
    select
      submission_id,
      sum(awarded_points)::int as points,
      (count(*) filter (where is_exact))::int as total_correct,
      (count(*) filter (where is_future and is_exact))::int as correct_future
    from graded
    group by submission_id
  ),
  scored as (
    select
      sr.id as submission_id,
      sr.user_id,
      sr.submitted_at,
      coalesce(gt.points, 0) as points,
      coalesce(gt.total_correct, 0) as total_correct,
      coalesce(gt.correct_future, 0) as correct_future,
      coalesce(qt.total_questions, 0) as total_questions
    from submission_rows sr
    cross join question_totals qt
    left join graded_totals gt on gt.submission_id = sr.id
  ),
  ranked as (
    select
      sc.*,
      rank() over (order by sc.points desc, sc.total_correct desc, sc.submitted_at asc nulls last, sc.submission_id) as rank_position
    from scored sc
  ),
  brackets as (
    select
      correct_answers,
      sum(pool) as pool
    from public.quiz_prize_brackets
    where quiz_id = p_quiz
    group by correct_answers
  ),
  winners as (
    select
      rk.*,
      (
        select b.correct_answers
        from brackets b
        where rk.total_correct >= b.correct_answers
        order by b.correct_answers desc
        limit 1
      ) as bracket_threshold
    from ranked rk
  ),
  bracket_counts as (
    select bracket_threshold, count(*) as winners
    from winners
    where bracket_threshold is not null
    group by bracket_threshold
  ),
  distribution as (
    select
      w.*,
      coalesce(b.pool, 0)::numeric as bracket_pool,
      coalesce(bc.winners, 0) as bracket_winners,
      case
        when w.bracket_threshold is null or coalesce(bc.winners, 0) = 0 then 0::numeric
        else round(coalesce(b.pool, 0)::numeric / bc.winners, 2)
      end as prize_value
    from winners w
    left join brackets b on b.correct_answers = w.bracket_threshold
    left join bracket_counts bc on bc.bracket_threshold = w.bracket_threshold
  ),
  inserted as (
    insert into public.quiz_results (
      quiz_id,
      submission_id,
      user_id,
      points,
      total_correct,
      total_questions,
      correct_future,
      submitted_at,
      rank,
      prize_awarded,
      status,
      data
    )
    select
      p_quiz,
      d.submission_id,
      d.user_id,
      d.points,
      d.total_correct,
      d.total_questions,
      d.correct_future,
      d.submitted_at,
      d.rank_position,
      coalesce(d.prize_value, 0),
      case when coalesce(d.prize_value, 0) > 0 then 'won' else 'lost' end,
      jsonb_build_object(
        'rank', d.rank_position,
        'bracket', d.bracket_threshold,
        'awarded_points', d.points
      )
    from distribution d
    returning prize_awarded
  )
  select
    count(*)::int,
    count(*) filter (where prize_awarded > 0)::int
  into v_processed, v_winners
  from inserted;

  update public.rounds
  set status = 'settled'
  where id = (
    select round_id from public.quizzes where id = p_quiz
  );

  return jsonb_build_object(
    'quiz_id', p_quiz,
    'processed', v_processed,
    'winners', v_winners
  );
end;
$$;

grant execute on function public.settle_quiz(uuid) to authenticated, service_role;

-- Enable row level security + policies for quiz_submissions.
do $$
begin
  if to_regclass('public.quiz_submissions') is not null then
    execute 'alter table public.quiz_submissions enable row level security';

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'quiz_submissions' and policyname = 'quiz_submissions_user_select'
    ) then
      execute '
        create policy quiz_submissions_user_select
        on public.quiz_submissions
        for select
        using (auth.uid() = user_id)
      ';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'quiz_submissions' and policyname = 'quiz_submissions_user_insert'
    ) then
      execute '
        create policy quiz_submissions_user_insert
        on public.quiz_submissions
        for insert
        with check (auth.uid() = user_id)
      ';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'quiz_submissions' and policyname = 'quiz_submissions_user_update'
    ) then
      execute '
        create policy quiz_submissions_user_update
        on public.quiz_submissions
        for update
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
      ';
    end if;
  end if;
end
$$;

-- Enable row level security + policies for quiz_answers.
do $$
begin
  if to_regclass('public.quiz_answers') is not null then
    execute 'alter table public.quiz_answers enable row level security';

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'quiz_answers' and policyname = 'quiz_answers_user_manage'
    ) then
      execute '
        create policy quiz_answers_user_manage
        on public.quiz_answers
        for all
        using (
          submission_id in (
            select id from public.quiz_submissions where user_id = auth.uid()
          )
        )
        with check (
          submission_id in (
            select id from public.quiz_submissions where user_id = auth.uid()
          )
        )
      ';
    end if;
  end if;
end
$$;

-- Enable row level security + policies for quiz_results (read-only for players).
do $$
begin
  if to_regclass('public.quiz_results') is not null then
    execute 'alter table public.quiz_results enable row level security';

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'quiz_results' and policyname = 'quiz_results_user_select'
    ) then
      execute '
        create policy quiz_results_user_select
        on public.quiz_results
        for select
        using (auth.uid() = user_id)
      ';
    end if;
  end if;
end
$$;
