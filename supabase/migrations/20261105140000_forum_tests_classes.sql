-- Forum upgrade, full practice tests, and teacher classes. Safe to run twice.

-- ===========================================================================
-- Forum: helpful votes, best answer, tutor badge, reports, link to a lesson
-- ===========================================================================
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS lesson_slug text REFERENCES public.lessons(slug) ON DELETE SET NULL;
ALTER TABLE public.forum_replies ADD COLUMN IF NOT EXISTS is_best boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.forum_votes (
  reply_id    uuid NOT NULL REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reply_id, user_id)
);
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.forum_votes TO anon, authenticated;
GRANT INSERT, DELETE ON public.forum_votes TO authenticated;
GRANT ALL ON public.forum_votes TO service_role;
DROP POLICY IF EXISTS "Votes are public" ON public.forum_votes;
CREATE POLICY "Votes are public" ON public.forum_votes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Students vote as themselves" ON public.forum_votes;
CREATE POLICY "Students vote as themselves" ON public.forum_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Students remove their vote" ON public.forum_votes;
CREATE POLICY "Students remove their vote" ON public.forum_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.forum_reports (
  id          bigserial PRIMARY KEY,
  post_id     uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reply_id    uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 600),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed', 'kept')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR reply_id IS NOT NULL)
);
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;
GRANT INSERT, SELECT, UPDATE ON public.forum_reports TO authenticated;
GRANT USAGE ON SEQUENCE public.forum_reports_id_seq TO authenticated;
GRANT ALL ON public.forum_reports TO service_role;
DROP POLICY IF EXISTS "Students report posts" ON public.forum_reports;
CREATE POLICY "Students report posts" ON public.forum_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'open');
DROP POLICY IF EXISTS "Admins see reports" ON public.forum_reports;
CREATE POLICY "Admins see reports" ON public.forum_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins handle reports" ON public.forum_reports;
CREATE POLICY "Admins handle reports" ON public.forum_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins may remove any post or reply (moderation).
DROP POLICY IF EXISTS "Admins remove posts" ON public.forum_posts;
CREATE POLICY "Admins remove posts" ON public.forum_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins remove replies" ON public.forum_replies;
CREATE POLICY "Admins remove replies" ON public.forum_replies FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- The author of a question (or an admin) marks one reply as the best answer.
CREATE OR REPLACE FUNCTION public.mark_best_reply(_reply_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _post uuid; _owner uuid;
BEGIN
  SELECT r.post_id, p.user_id INTO _post, _owner
  FROM forum_replies r JOIN forum_posts p ON p.id = r.post_id WHERE r.id = _reply_id;
  IF _post IS NULL THEN RAISE EXCEPTION 'Reply not found'; END IF;
  IF auth.uid() IS DISTINCT FROM _owner AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the person who asked can choose the best answer';
  END IF;
  UPDATE forum_replies SET is_best = (id = _reply_id) WHERE post_id = _post;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_best_reply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_best_reply(uuid) TO authenticated;

-- People who get the "Tutor" badge: admins, teachers and reviewers.
CREATE OR REPLACE FUNCTION public.forum_tutors()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT user_id FROM user_roles WHERE role::text IN ('admin', 'teacher', 'reviewer')
$$;
REVOKE ALL ON FUNCTION public.forum_tutors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forum_tutors() TO anon, authenticated;

-- ===========================================================================
-- Full practice tests
-- ===========================================================================
-- Module 1 is mixed. Module 2 is harder or easier depending on module 1, like
-- the real Digital SAT. Questions come from the lessons, spread by domain weight.
CREATE OR REPLACE FUNCTION public.test_questions(_section text, _module integer, _harder boolean DEFAULT true, _exclude uuid[] DEFAULT '{}')
RETURNS TABLE (id uuid, domain text, level text, context text, table_data jsonb, svg text, stem text, options jsonb)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  WITH n AS (SELECT CASE WHEN _section = 'rw' THEN 27 ELSE 22 END AS total),
  pool AS (
    SELECT q.*, d.slug AS dslug, d.exam_weight,
           row_number() OVER (PARTITION BY d.slug ORDER BY random()) AS rn
    FROM questions q
    JOIN lessons l ON l.slug = q.lesson_slug
    JOIN domains d ON d.slug = l.domain_slug
    WHERE q.status = 'approved' AND l.section = _section AND NOT (q.id = ANY(_exclude))
      AND q.level = ANY(CASE
        WHEN _module = 1 THEN ARRAY['easy', 'medium', 'hard', 'very hard']
        WHEN _harder THEN ARRAY['medium', 'hard', 'very hard']
        ELSE ARRAY['easy', 'medium'] END)
  ),
  quota AS (
    SELECT dslug, greatest(1, round((SELECT total FROM n) * exam_weight / sum(exam_weight) OVER ()))::int AS k
    FROM (SELECT DISTINCT dslug, exam_weight FROM pool) x
  ),
  pick AS (
    SELECT p.* FROM pool p JOIN quota k ON k.dslug = p.dslug WHERE p.rn <= k.k
    ORDER BY CASE p.level WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END, random()
    LIMIT (SELECT total FROM n)
  )
  SELECT p.id, p.dslug, p.level, p.context, p.table_data, p.svg, p.stem,
         (SELECT jsonb_agg(o.value->>'text' ORDER BY o.ord) FROM jsonb_array_elements(p.options) WITH ORDINALITY AS o(value, ord))
  FROM pick p
  ORDER BY CASE p.level WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END
$$;
REVOKE ALL ON FUNCTION public.test_questions(text, integer, boolean, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_questions(text, integer, boolean, uuid[]) TO anon, authenticated;

-- Grades a list of {question_id, choice}. Returns each answer with the key and explanation.
CREATE OR REPLACE FUNCTION public.grade_answers(_answers jsonb)
RETURNS TABLE (question_id uuid, choice integer, correct boolean, answer integer, why text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, (a->>'choice')::int,
         (a->>'choice')::int >= 0 AND coalesce((q.options->((a->>'choice')::int)->>'is_correct')::boolean, false),
         (SELECT (o.ord - 1)::int FROM jsonb_array_elements(q.options) WITH ORDINALITY AS o(value, ord) WHERE (o.value->>'is_correct')::boolean LIMIT 1),
         q.explanation_en
  FROM jsonb_array_elements(_answers) a
  JOIN questions q ON q.id = (a->>'question_id')::uuid AND q.status = 'approved'
  LIMIT 120
$$;
REVOKE ALL ON FUNCTION public.grade_answers(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_answers(jsonb) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.practice_tests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section     text NOT NULL CHECK (section IN ('rw', 'm')),
  score       integer NOT NULL CHECK (score BETWEEN 200 AND 800),
  correct     integer NOT NULL,
  total       integer NOT NULL,
  harder      boolean NOT NULL,
  minutes     integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS practice_tests_user_idx ON public.practice_tests (user_id, created_at DESC);
ALTER TABLE public.practice_tests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.practice_tests TO authenticated;
GRANT ALL ON public.practice_tests TO service_role;
DROP POLICY IF EXISTS "Students see their tests" ON public.practice_tests;
CREATE POLICY "Students see their tests" ON public.practice_tests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.teaches_student(user_id) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Students save their tests" ON public.practice_tests;
CREATE POLICY "Students save their tests" ON public.practice_tests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ===========================================================================
-- Teacher classes: assignments and a class overview
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id    uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  lesson_slug  text NOT NULL REFERENCES public.lessons(slug) ON DELETE CASCADE,
  due_date     date,
  note         text CHECK (note IS NULL OR char_length(note) <= 400),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_cohort_idx ON public.assignments (cohort_id, created_at DESC);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
DROP POLICY IF EXISTS "Class sees its assignments" ON public.assignments;
CREATE POLICY "Class sees its assignments" ON public.assignments FOR SELECT TO authenticated
  USING (public.is_cohort_teacher(cohort_id) OR public.is_cohort_member(cohort_id) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Teacher assigns" ON public.assignments;
CREATE POLICY "Teacher assigns" ON public.assignments FOR INSERT TO authenticated WITH CHECK (public.is_cohort_teacher(cohort_id));
DROP POLICY IF EXISTS "Teacher removes" ON public.assignments;
CREATE POLICY "Teacher removes" ON public.assignments FOR DELETE TO authenticated USING (public.is_cohort_teacher(cohort_id));

-- Creates a class with a fresh 6-character join code.
CREATE OR REPLACE FUNCTION public.create_class(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _code text; _try int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only teachers can create classes';
  END IF;
  LOOP
    -- No 0/O or 1/I, so codes are easy to read aloud.
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') INTO _code FROM generate_series(1, 6);
    BEGIN
      INSERT INTO cohorts (name, teacher_id, join_code) VALUES (left(trim(_name), 80), auth.uid(), _code) RETURNING id INTO _id;
      RETURN _id;
    EXCEPTION WHEN unique_violation THEN
      _try := _try + 1;
      IF _try > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.create_class(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_class(text) TO authenticated;

-- One row per student in the class, for the teacher only.
CREATE OR REPLACE FUNCTION public.class_overview(_cohort_id uuid)
RETURNS TABLE (student_id uuid, name text, days_active integer, answered integer, accuracy numeric,
               weakest text, last_test integer, assignment_scores jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.student_id, p.display_name,
    (SELECT count(DISTINCT a.created_at::date)::int FROM attempts a WHERE a.user_id = m.student_id AND a.created_at > now() - interval '7 days'),
    (SELECT count(*)::int FROM attempts a WHERE a.user_id = m.student_id),
    (SELECT round(avg(a.correct::int), 2) FROM attempts a WHERE a.user_id = m.student_id),
    (SELECT s.name_en FROM skill_mastery sm JOIN skills s ON s.id = sm.skill_id
      WHERE sm.user_id = m.student_id AND sm.attempts >= 3 ORDER BY sm.mastery LIMIT 1),
    (SELECT t.score FROM practice_tests t WHERE t.user_id = m.student_id ORDER BY t.created_at DESC LIMIT 1),
    (SELECT coalesce(jsonb_object_agg(asg.lesson_slug, jsonb_build_object('score', lp.last_score, 'total', lp.last_total, 'done', lp.done)), '{}'::jsonb)
      FROM assignments asg LEFT JOIN learn_progress lp ON lp.user_id = m.student_id AND lp.skill_id = asg.lesson_slug
      WHERE asg.cohort_id = _cohort_id)
  FROM cohort_members m JOIN profiles p ON p.id = m.student_id
  WHERE m.cohort_id = _cohort_id
    AND (public.is_cohort_teacher(_cohort_id) OR public.has_role(auth.uid(), 'admin'))
  ORDER BY p.display_name
$$;
REVOKE ALL ON FUNCTION public.class_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_overview(uuid) TO authenticated;

-- A student's classes and their assignments.
CREATE OR REPLACE FUNCTION public.my_assignments()
RETURNS TABLE (class_name text, lesson_slug text, lesson_name text, due_date date, note text, done boolean, score integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.name, a.lesson_slug, l.name, a.due_date, a.note, coalesce(lp.done, false), lp.last_score, lp.last_total
  FROM cohort_members m
  JOIN cohorts c ON c.id = m.cohort_id
  JOIN assignments a ON a.cohort_id = c.id
  JOIN lessons l ON l.slug = a.lesson_slug
  LEFT JOIN learn_progress lp ON lp.user_id = auth.uid() AND lp.skill_id = a.lesson_slug
  WHERE m.student_id = auth.uid()
  ORDER BY a.due_date NULLS LAST, a.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.my_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_assignments() TO authenticated;

-- ===========================================================================
-- Impact page: public counts (no names), readable by everyone
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.public_impact()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'lessons', (SELECT count(*) FROM lessons WHERE published),
    'questions', (SELECT count(*) FROM questions WHERE status = 'approved' AND lesson_slug IS NOT NULL),
    'codes', (SELECT coalesce(sum(jsonb_array_length(content->'codes')), 0) FROM lessons WHERE published)
             + (SELECT coalesce(jsonb_array_length(data), 0) FROM site_content WHERE key = 'universal_codes'),
    'guides', (SELECT count(*) FROM resources),
    'students', (SELECT count(*) FROM profiles),
    'answers', (SELECT count(*) FROM attempts),
    'questions_asked', (SELECT count(*) FROM forum_posts),
    'answers_given', (SELECT count(*) FROM forum_replies)
  )
$$;
REVOKE ALL ON FUNCTION public.public_impact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_impact() TO anon, authenticated;
