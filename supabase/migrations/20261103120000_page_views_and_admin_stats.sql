-- Visitor statistics for the Control Center.
--
-- page_views: one row per page a visitor opens. Anonymous: no names or emails,
-- only the page, the site they came from, the kind of device, and a random
-- session id kept in the browser. Signed-in visitors also store their user id.
--
-- admin_stats(days): one call that returns everything the Overview needs.
-- Only admins can call it.

CREATE TABLE IF NOT EXISTS public.page_views (
  id          bigserial PRIMARY KEY,
  path        text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 200),
  referrer    text CHECK (referrer IS NULL OR char_length(referrer) <= 200),
  device      text NOT NULL DEFAULT 'computer' CHECK (device IN ('phone', 'tablet', 'computer')),
  language    text CHECK (language IS NULL OR char_length(language) <= 10),
  session_id  text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_views_created_idx ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_path_idx ON public.page_views (path);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.page_views_id_seq TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;

-- Anyone may record a visit, but never in someone else's name.
DROP POLICY IF EXISTS "Anyone can record a visit" ON public.page_views;
CREATE POLICY "Anyone can record a visit" ON public.page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Only admins can read visits.
DROP POLICY IF EXISTS "Admins can read visits" ON public.page_views;
CREATE POLICY "Admins can read visits" ON public.page_views
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


CREATE OR REPLACE FUNCTION public.admin_stats(days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(1, least(days, 365)));
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can see statistics';
  END IF;

  SELECT jsonb_build_object(
    'visits',        (SELECT count(*) FROM page_views WHERE created_at >= since),
    'visitors',      (SELECT count(DISTINCT session_id) FROM page_views WHERE created_at >= since),
    'signups',       (SELECT count(*) FROM profiles WHERE created_at >= since),
    'students',      (SELECT count(*) FROM profiles),
    'active',        (SELECT count(DISTINCT user_id) FROM (
                        SELECT user_id FROM learn_progress WHERE updated_at >= since
                        UNION SELECT user_id FROM attempts WHERE created_at >= since) a),
    'answered',      (SELECT count(*) FROM attempts WHERE created_at >= since),
    'per_day',       COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d, 'visits', n) ORDER BY d)
                        FROM (SELECT date_trunc('day', created_at)::date AS d, count(*) AS n
                              FROM page_views WHERE created_at >= since GROUP BY 1) x), '[]'::jsonb),
    'top_pages',     COALESCE((SELECT jsonb_agg(jsonb_build_object('name', path, 'n', n))
                        FROM (SELECT path, count(*) AS n FROM page_views WHERE created_at >= since
                              GROUP BY 1 ORDER BY 2 DESC LIMIT 8) x), '[]'::jsonb),
    'devices',       COALESCE((SELECT jsonb_agg(jsonb_build_object('name', device, 'n', n))
                        FROM (SELECT device, count(DISTINCT session_id) AS n FROM page_views WHERE created_at >= since
                              GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
    'sources',       COALESCE((SELECT jsonb_agg(jsonb_build_object('name', ref, 'n', n))
                        FROM (SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS ref, count(DISTINCT session_id) AS n
                              FROM page_views WHERE created_at >= since GROUP BY 1 ORDER BY 2 DESC LIMIT 8) x), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats(integer) TO authenticated;
