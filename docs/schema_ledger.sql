-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.history_question_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_identifier text NOT NULL,
  template text NOT NULL,
  match_id uuid,
  source_question_id uuid UNIQUE,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  played_at timestamp with time zone,
  league_code text,
  source_kind text NOT NULL DEFAULT 'manual'::text,
  status text NOT NULL DEFAULT 'ready'::text,
  payload jsonb,
  used_in_quiz_id uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT history_question_bank_pkey PRIMARY KEY (id),
  CONSTRAINT history_question_bank_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT history_question_bank_source_question_id_fkey FOREIGN KEY (source_question_id) REFERENCES public.quiz_questions(id),
  CONSTRAINT history_question_bank_used_in_quiz_id_fkey FOREIGN KEY (used_in_quiz_id) REFERENCES public.quizzes(id)
);
CREATE TABLE public.leagues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leagues_pkey PRIMARY KEY (id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  kickoff_at timestamp with time zone NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  result_home integer,
  result_away integer,
  status text NOT NULL DEFAULT 'scheduled'::text,
  external_match_id text,
  home_team_external_id text,
  away_team_external_id text,
  round_label text,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  phone text UNIQUE,
  email USER-DEFINED,
  first_name text,
  last_name text,
  marketing_consent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  display_name text,
  short_id text,
  birth_date date,
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  admin_token text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quiz_answers_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_answers_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.quiz_submissions(id),
  CONSTRAINT quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id)
);
CREATE TABLE public.quiz_prize_brackets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  correct_answers integer NOT NULL CHECK (correct_answers >= 0),
  pool numeric NOT NULL CHECK (pool >= 0::numeric),
  CONSTRAINT quiz_prize_brackets_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_prize_brackets_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);
CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  match_id uuid,
  kind USER-DEFINED NOT NULL,
  prompt text NOT NULL,
  options jsonb,
  correct jsonb,
  order_index integer NOT NULL DEFAULT 0,
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_questions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.quiz_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  points integer NOT NULL,
  correct_future integer NOT NULL DEFAULT 0,
  submitted_at timestamp with time zone,
  rank integer,
  data jsonb,
  submission_id uuid UNIQUE,
  total_correct integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  prize_awarded numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text,
  CONSTRAINT quiz_results_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_results_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT quiz_results_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.quiz_submissions(id)
);
CREATE TABLE public.quiz_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quiz_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_submissions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  points_history integer NOT NULL DEFAULT 1,
  points_future_exact integer NOT NULL DEFAULT 1,
  points_score_exact integer NOT NULL DEFAULT 3,
  points_score_tendency integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  prize numeric CHECK (prize >= 0::numeric),
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id)
);
CREATE TABLE public.rounds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  label text NOT NULL,
  stage_id uuid,
  starts_at timestamp with time zone NOT NULL,
  deadline_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  timezone text NOT NULL DEFAULT 'Europe/Warsaw'::text,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rounds_pkey PRIMARY KEY (id),
  CONSTRAINT rounds_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id),
  CONSTRAINT rounds_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id)
);
CREATE TABLE public.stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  CONSTRAINT stages_pkey PRIMARY KEY (id)
);
