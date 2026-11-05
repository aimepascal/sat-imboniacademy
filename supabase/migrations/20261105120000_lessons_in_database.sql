-- Lessons, cheat codes and practice questions move from files into the database.
--
-- Before this, the 32 lessons and 512 practice questions lived in public/learn/*.js.
-- The signed-in Practice and Today's plan read the questions table, which had no
-- approved questions, so they showed nothing. Now there is one source for both,
-- and the Control Center can edit lessons without changing code.
--
--   lessons        one row per lesson (32), with its English text and optional Kinyarwanda
--   site_content   the SAT map, domain notes, universal cheat codes and the book list
--   questions      gains the fields the lessons use (context, table, figure, level, position)
--   question_reports  "Report a problem" from students
--
-- Safe to run twice.

-- ---------------------------------------------------------------------------
-- Domains and skills get short, stable names (slugs) used in links
-- ---------------------------------------------------------------------------
ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS section text CHECK (section IN ('rw', 'm'));
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- ---------------------------------------------------------------------------
-- Lessons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lessons (
  slug         text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  parent_slug  text REFERENCES public.lessons(slug) ON DELETE SET NULL,
  section      text NOT NULL CHECK (section IN ('rw', 'm')),
  domain_slug  text NOT NULL,
  sort         integer NOT NULL DEFAULT 0,
  name         text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  -- range, story, hope, lesson[], visual[], subs[], spot, videos[], codes[]
  content      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The same fields in Kinyarwanda. A missing field falls back to English.
  content_rw   jsonb NOT NULL DEFAULT '{}'::jsonb,
  name_rw      text,
  published    boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS lessons_domain_idx ON public.lessons (domain_slug, sort);

CREATE TABLE IF NOT EXISTS public.site_content (
  key         text PRIMARY KEY,
  data        jsonb NOT NULL,
  data_rw     jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.lessons, public.site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lessons, public.site_content TO authenticated;
GRANT ALL ON public.lessons, public.site_content TO service_role;

-- Two read rules: guests cannot run has_role(), so their rule must not call it.
DROP POLICY IF EXISTS "Published lessons are public" ON public.lessons;
CREATE POLICY "Published lessons are public" ON public.lessons
  FOR SELECT TO anon USING (published);
DROP POLICY IF EXISTS "Signed-in users read lessons" ON public.lessons;
CREATE POLICY "Signed-in users read lessons" ON public.lessons
  FOR SELECT TO authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins edit lessons" ON public.lessons;
CREATE POLICY "Admins edit lessons" ON public.lessons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Site content is public" ON public.site_content;
CREATE POLICY "Site content is public" ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins edit site content" ON public.site_content;
CREATE POLICY "Admins edit site content" ON public.site_content
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Questions: the fields the lessons use
-- ---------------------------------------------------------------------------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS lesson_slug text REFERENCES public.lessons(slug) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS level text CHECK (level IN ('easy', 'medium', 'hard', 'very hard'));
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS context text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS table_data jsonb;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS svg text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS context_rw text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS stem_rw text;
CREATE UNIQUE INDEX IF NOT EXISTS questions_lesson_position_idx
  ON public.questions (lesson_slug, position) WHERE lesson_slug IS NOT NULL;

-- Anyone may read the questions of a lesson, without the answer key.
CREATE OR REPLACE FUNCTION public.lesson_questions(_slug text)
RETURNS TABLE (id uuid, "position" integer, level text, context text, table_data jsonb,
               svg text, stem text, options jsonb, context_rw text, stem_rw text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.position, q.level, q.context, q.table_data, q.svg, q.stem,
         (SELECT jsonb_agg(o.value->>'text' ORDER BY o.ord)
          FROM jsonb_array_elements(q.options) WITH ORDINALITY AS o(value, ord)),
         q.context_rw, q.stem_rw
  FROM public.questions q
  WHERE q.lesson_slug = _slug AND q.status = 'approved'
  ORDER BY q.position
$$;
REVOKE ALL ON FUNCTION public.lesson_questions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lesson_questions(text) TO anon, authenticated;

-- After a student picks an option: was it right, which one is right, and why.
CREATE OR REPLACE FUNCTION public.check_answer(_question_id uuid, _choice integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    -- A negative index would read from the end of the list, so it never counts.
    'correct', _choice >= 0 AND coalesce((q.options->_choice->>'is_correct')::boolean, false),
    'answer', (SELECT (o.ord - 1)::integer
               FROM jsonb_array_elements(q.options) WITH ORDINALITY AS o(value, ord)
               WHERE (o.value->>'is_correct')::boolean LIMIT 1),
    'why', q.explanation_en,
    'why_rw', q.explanation_rw)
  FROM public.questions q
  WHERE q.id = _question_id AND q.status = 'approved'
$$;
REVOKE ALL ON FUNCTION public.check_answer(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_answer(uuid, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- "Report a problem" on a question
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_reports (
  id           bigserial PRIMARY KEY,
  question_id  uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message      text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 600),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS question_reports_open_idx ON public.question_reports (status, created_at DESC);
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.question_reports TO authenticated;
GRANT SELECT, UPDATE ON public.question_reports TO authenticated;
GRANT USAGE ON SEQUENCE public.question_reports_id_seq TO authenticated;
GRANT ALL ON public.question_reports TO service_role;

DROP POLICY IF EXISTS "Students report problems" ON public.question_reports;
CREATE POLICY "Students report problems" ON public.question_reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'open');
DROP POLICY IF EXISTS "Admins read reports" ON public.question_reports;
CREATE POLICY "Admins read reports" ON public.question_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
DROP POLICY IF EXISTS "Admins resolve reports" ON public.question_reports;
CREATE POLICY "Admins resolve reports" ON public.question_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Import: takes the lesson files as JSON and writes everything above.
-- Run by an admin (SQL Editor). Running it again updates in place.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_content(
  _lessons jsonb, _sat jsonb, _domain_notes jsonb, _universal jsonb, _books jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _part jsonb; _dom jsonb; _sk jsonb; _l jsonb; _q jsonb;
  _sort integer := 0; _domain_id uuid; _skill_id uuid;
  _slug text; _parent text; _section text; _domslug text; _summary text;
  _n_lessons integer := 0; _n_questions integer := 0; _pos integer;
  _children jsonb := '{"rr": ["prop", "rate", "unit"]}'::jsonb;
  _child text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can import content';
  END IF;

  -- 1. Domains from the SAT map
  FOR _part IN SELECT value FROM jsonb_array_elements(_sat) LOOP
    FOR _dom IN SELECT value FROM jsonb_array_elements(_part->'domains') LOOP
      INSERT INTO domains (name, exam_weight, slug, section)
      VALUES (_dom->>'name',
              coalesce(nullif(regexp_replace(_dom->>'pct', '\D', '', 'g'), '')::numeric / 100, 0.25),
              _dom->>'id', _part->>'id')
      ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, section = EXCLUDED.section;
    END LOOP;
  END LOOP;

  -- 2. Lessons and their skills, in map order (sub-lessons right after their parent)
  FOR _part IN SELECT value FROM jsonb_array_elements(_sat) LOOP
    _section := _part->>'id';
    FOR _dom IN SELECT value FROM jsonb_array_elements(_part->'domains') LOOP
      _domslug := _dom->>'id';
      SELECT id INTO _domain_id FROM domains WHERE slug = _domslug;
      FOR _sk IN SELECT value FROM jsonb_array_elements(_dom->'skills') LOOP
        FOR _slug, _parent IN
          SELECT _sk->>0, NULL::text
          UNION ALL
          SELECT c, _sk->>0 FROM jsonb_array_elements_text(coalesce(_children->(_sk->>0), '[]')) AS c
        LOOP
          SELECT value INTO _l FROM jsonb_array_elements(_lessons) WHERE value->>'id' = _slug;
          CONTINUE WHEN _l IS NULL;
          _sort := _sort + 1;
          _summary := CASE WHEN _parent IS NULL THEN _sk->>2 ELSE _l->'subs'->0->>'def' END;
          INSERT INTO lessons (slug, parent_slug, section, domain_slug, sort, name, summary, content)
          VALUES (_slug, _parent, _section, _domslug, _sort,
                  CASE WHEN _parent IS NULL THEN _sk->>1 ELSE _l->>'name' END,
                  coalesce(_summary, ''),
                  (_l - 'id' - 'practice') || jsonb_build_object('title', _l->>'name'))
          ON CONFLICT (slug) DO UPDATE SET
            parent_slug = EXCLUDED.parent_slug, section = EXCLUDED.section,
            domain_slug = EXCLUDED.domain_slug, sort = EXCLUDED.sort, name = EXCLUDED.name,
            summary = EXCLUDED.summary, content = EXCLUDED.content, updated_at = now();
          _n_lessons := _n_lessons + 1;

          INSERT INTO skills (domain_id, name_en, slug)
          VALUES (_domain_id, CASE WHEN _parent IS NULL THEN _sk->>1 ELSE _l->>'name' END, _slug)
          ON CONFLICT (slug) DO UPDATE SET domain_id = EXCLUDED.domain_id, name_en = EXCLUDED.name_en
          RETURNING id INTO _skill_id;

          -- 3. Its practice questions, approved, numbered 1 to 16
          _pos := 0;
          FOR _q IN SELECT value FROM jsonb_array_elements(_l->'practice') LOOP
            _pos := _pos + 1;
            INSERT INTO questions (skill_id, lesson_slug, position, level, difficulty, context,
                                   table_data, svg, stem, options, explanation_en, status, reviewed_at)
            VALUES (_skill_id, _slug, _pos, _q->>'level',
                    CASE WHEN _q->>'level' = 'very hard' THEN 'hard' ELSE _q->>'level' END,
                    nullif(_q->>'context', ''),
                    CASE WHEN jsonb_typeof(_q->'table') = 'object' THEN _q->'table' END,
                    nullif(_q->>'svg', ''), _q->>'q',
                    (SELECT jsonb_agg(jsonb_build_object('text', o.value, 'is_correct', (o.ord - 1) = (_q->>'ans')::integer) ORDER BY o.ord)
                     FROM jsonb_array_elements_text(_q->'opts') WITH ORDINALITY AS o(value, ord)),
                    _q->>'why', 'approved', now())
            ON CONFLICT (lesson_slug, position) WHERE lesson_slug IS NOT NULL DO UPDATE SET
              skill_id = EXCLUDED.skill_id, level = EXCLUDED.level, difficulty = EXCLUDED.difficulty,
              context = EXCLUDED.context, table_data = EXCLUDED.table_data, svg = EXCLUDED.svg,
              stem = EXCLUDED.stem, options = EXCLUDED.options,
              explanation_en = EXCLUDED.explanation_en, status = 'approved', updated_at = now();
            _n_questions := _n_questions + 1;
          END LOOP;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 4. The rest of the site's text
  INSERT INTO site_content (key, data) VALUES
    ('sat_map', _sat), ('domain_notes', _domain_notes),
    ('universal_codes', _universal), ('books', _books)
  ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now();

  RETURN jsonb_build_object('lessons', _n_lessons, 'questions', _n_questions);
END;
$$;
REVOKE ALL ON FUNCTION public.import_content(jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_content(jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated, service_role;
