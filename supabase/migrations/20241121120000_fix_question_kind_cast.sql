-- Fix settling by allowing question_kind enum to be compared with LIKE/ILIKE
-- Older SQL functions (e.g. settle_quiz) still perform pattern checks like
--   question_kind ILIKE 'future%'
-- After we switched quiz_questions.kind to the enum type, Postgres stopped
-- performing implicit casts to text which caused errors such as
--   operator does not exist: question_kind ~~ unknown
--
-- This migration reinstates the implicit cast so existing server-side code
-- keeps working without having to rewrite every function.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'question_kind'
  ) THEN
    -- drop previous cast if it exists to avoid duplicates
    IF EXISTS (
      SELECT 1
      FROM pg_cast c
      JOIN pg_type t_source ON c.castsource = t_source.oid
      JOIN pg_type t_target ON c.casttarget = t_target.oid
      WHERE t_source.typname = 'question_kind'
        AND t_target.typname = 'text'
    ) THEN
      DROP CAST (question_kind AS text);
    END IF;

    -- recreate the cast and allow it to be used implicitly (WITH INOUT)
    CREATE CAST (question_kind AS text) WITH INOUT AS IMPLICIT;
  END IF;
END
$$;
