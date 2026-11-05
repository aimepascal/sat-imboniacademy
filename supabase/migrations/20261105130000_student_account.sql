-- Student account: goal, test date, first-visit setup, own data download and
-- account deletion. Kept in profile_private, which only the student can read.
-- Safe to run twice.

ALTER TABLE public.profile_private ADD COLUMN IF NOT EXISTS test_date date;
ALTER TABLE public.profile_private ADD COLUMN IF NOT EXISTS daily_minutes integer CHECK (daily_minutes IS NULL OR daily_minutes BETWEEN 5 AND 300);
ALTER TABLE public.profile_private ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE public.profile_private ADD COLUMN IF NOT EXISTS reminder_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.profile_private ADD COLUMN IF NOT EXISTS birth_year integer CHECK (birth_year IS NULL OR birth_year BETWEEN 1940 AND 2025);

-- Everything the Hub stores about the signed-in student, as one JSON file.
CREATE OR REPLACE FUNCTION public.my_data_export()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'exported_at', now(),
    'account', (SELECT jsonb_build_object('email', email, 'created_at', created_at) FROM auth.users WHERE id = auth.uid()),
    'profile', (SELECT to_jsonb(p) FROM profiles p WHERE p.id = auth.uid()),
    'private_profile', (SELECT to_jsonb(p) FROM profile_private p WHERE p.id = auth.uid()),
    'lesson_progress', coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM learn_progress l WHERE l.user_id = auth.uid()), '[]'),
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('question_id', a.question_id, 'option', a.option_index, 'correct', a.correct, 'mode', a.mode, 'at', a.created_at)) FROM attempts a WHERE a.user_id = auth.uid()), '[]'),
    'skill_mastery', coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM skill_mastery m WHERE m.user_id = auth.uid()), '[]'),
    'forum_posts', coalesce((SELECT jsonb_agg(jsonb_build_object('title', f.title, 'at', f.created_at)) FROM forum_posts f WHERE f.user_id = auth.uid()), '[]'),
    'visits', (SELECT count(*) FROM page_views v WHERE v.user_id = auth.uid())
  )
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.my_data_export() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_data_export() TO authenticated;

-- Deletes the signed-in student's account. Everything that belongs to them goes
-- with it (ON DELETE CASCADE); forum posts are removed with the profile.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Admin accounts cannot be deleted here';
  END IF;
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- The student's own estimate, per section, from skill mastery weighted by how
-- much of the test each domain is. Shown only after enough answers.
CREATE OR REPLACE FUNCTION public.my_score_estimate()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH m AS (
    SELECT d.section, d.slug AS domain, d.exam_weight AS w,
           avg(sm.mastery) AS mastery, sum(sm.attempts) AS answered
    FROM skill_mastery sm
    JOIN skills s ON s.id = sm.skill_id
    JOIN domains d ON d.id = s.domain_id
    WHERE sm.user_id = auth.uid() AND d.section IS NOT NULL
    GROUP BY 1, 2, 3
  ), s AS (
    SELECT section, sum(answered) AS answered,
           -- Domains not practised yet count as 0.4, a typical first-try level.
           (SELECT sum(d.exam_weight * coalesce(m2.mastery, 0.4)) / sum(d.exam_weight)
            FROM domains d LEFT JOIN m m2 ON m2.domain = d.slug
            WHERE d.section = m.section) AS level
    FROM m GROUP BY section
  )
  SELECT jsonb_build_object(
    'sections', coalesce(jsonb_object_agg(section, jsonb_build_object(
       'answered', answered,
       'score', CASE WHEN answered >= 16 THEN (round((200 + 600 * level) / 10) * 10)::int END)), '{}'::jsonb),
    'domains', (SELECT coalesce(jsonb_agg(jsonb_build_object('domain', domain, 'mastery', round(mastery, 2), 'answered', answered)), '[]') FROM m))
  FROM s
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.my_score_estimate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_score_estimate() TO authenticated;

-- Questions the student missed that are due again (the mistake notebook).
CREATE OR REPLACE FUNCTION public.my_review_questions(_limit integer DEFAULT 20)
RETURNS TABLE (id uuid, lesson_slug text, "position" integer, level text, context text,
               table_data jsonb, svg text, stem text, options jsonb, context_rw text,
               stem_rw text, box integer, due_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.lesson_slug, q.position, q.level, q.context, q.table_data, q.svg, q.stem,
         (SELECT jsonb_agg(o.value->>'text' ORDER BY o.ord)
          FROM jsonb_array_elements(q.options) WITH ORDINALITY AS o(value, ord)),
         q.context_rw, q.stem_rw, r.box, r.due_at
  FROM review_queue r JOIN questions q ON q.id = r.question_id
  WHERE r.user_id = auth.uid() AND q.status = 'approved'
  ORDER BY r.due_at
  LIMIT least(greatest(_limit, 1), 100)
$$;
REVOKE ALL ON FUNCTION public.my_review_questions(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_review_questions(integer) TO authenticated;
