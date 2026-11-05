-- Security clean-up from the Supabase Security Advisor.
-- These helper functions only make sense for a signed-in user (every rule that
-- uses them is for signed-in users), so guests no longer run them.
-- get_public_stats is left as it is: the Imboni Academy main site may use it.
-- Safe to run twice; a missing function is skipped.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.is_cohort_member(uuid)', 'public.is_cohort_teacher(uuid)', 'public.teaches_student(uuid)',
    'public.is_question_staff()', 'public.is_approved_member()', 'public.is_site_admin()',
    'public.get_avg_score_improvement()'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skipped %, not found', f;
    END;
  END LOOP;
END $$;

-- ===========================================================================
-- Error alerts: when a page breaks for a student, it is written here and shown
-- in the Control Center. No names; only the page, the message and the device.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.site_errors (
  id          bigserial PRIMARY KEY,
  path        text NOT NULL CHECK (char_length(path) <= 200),
  message     text NOT NULL CHECK (char_length(message) <= 500),
  device      text CHECK (device IS NULL OR char_length(device) <= 20),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_errors_created_idx ON public.site_errors (created_at DESC);
ALTER TABLE public.site_errors ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.site_errors TO anon, authenticated;
GRANT USAGE ON SEQUENCE public.site_errors_id_seq TO anon, authenticated;
GRANT SELECT, DELETE ON public.site_errors TO authenticated;
GRANT ALL ON public.site_errors TO service_role;
DROP POLICY IF EXISTS "Anyone can report a page error" ON public.site_errors;
CREATE POLICY "Anyone can report a page error" ON public.site_errors FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read page errors" ON public.site_errors;
CREATE POLICY "Admins read page errors" ON public.site_errors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins clear page errors" ON public.site_errors;
CREATE POLICY "Admins clear page errors" ON public.site_errors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Weekly backup helper: every table that holds student work or content, as one
-- JSON file, for the admin to download from the Control Center.
CREATE OR REPLACE FUNCTION public.admin_backup()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb := jsonb_build_object('created_at', now()); _t text; _part jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can download a backup'; END IF;
  FOREACH _t IN ARRAY ARRAY['lessons', 'site_content', 'questions', 'resources', 'forum_posts', 'forum_replies',
                           'profiles', 'learn_progress', 'skill_mastery', 'practice_tests', 'cohorts',
                           'cohort_members', 'assignments', 'question_reports', 'user_roles'] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]'') FROM public.%I t', _t) INTO _part;
    _out := _out || jsonb_build_object(_t, _part);
  END LOOP;
  RETURN _out;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_backup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_backup() TO authenticated;
