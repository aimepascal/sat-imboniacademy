-- Loads the lesson files in this folder into the database (lessons, questions,
-- cheat codes, SAT map, books). Run once in the Supabase SQL Editor after the
-- migration 20261105120000_lessons_in_database.sql. Running it again updates in
-- place; edits made in the Control Center are replaced, so only run it to reset.
--
-- It reads the files from GitHub with the http extension.
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

WITH f AS (
  SELECT name, (extensions.http_get('https://raw.githubusercontent.com/aimepascal/sat-imboniacademy/main/supabase/seed/' || name || '.json')).content::jsonb AS data
  FROM unnest(ARRAY['lessons', 'sat_map', 'domain_notes', 'universal_codes', 'books']) AS name
)
SELECT public.import_content(
  (SELECT data FROM f WHERE name = 'lessons'),
  (SELECT data FROM f WHERE name = 'sat_map'),
  (SELECT data FROM f WHERE name = 'domain_notes'),
  (SELECT data FROM f WHERE name = 'universal_codes'),
  (SELECT data FROM f WHERE name = 'books'));
