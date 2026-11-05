# Imboni SAT Hub

Free SAT lessons, practice and a student community, at **[sat.imboniacademy.org](https://sat.imboniacademy.org)**.

Built and run by **Aime Pascal Komezusenge** for Imboni Academy, Kigali, Rwanda.

## What is where

| Folder or file | What it does |
| --- | --- |
| `src/routes/learn.index.tsx` | The Learn home page. |
| `src/routes/learn.$slug.tsx` | One lesson, with the Learn, Practice and Cheat codes tabs (`/learn/proportions`…). |
| `src/routes/practice.tsx`, `check.tsx`, `test.tsx` | Practice list, the 10-minute check, the full practice test. |
| `src/routes/library.tsx`, `codes.*.tsx` | Library (guides, books, lessons) and the universal cheat codes. |
| `src/routes/forum.tsx`, `forum_.$postId.tsx` | The community. |
| `src/routes/_authenticated/` | Pages that need an account: `me.tsx` (progress and account), `review.tsx` (mistake notebook), `today.tsx`, `welcome.tsx`, `classes.tsx` (teachers), `admin.tsx` (Control Center). |
| `src/components/learn/` | The practice panel, how a question is drawn, the SAT map. |
| `src/components/admin/` | Control Center: lesson editor, reports, site health. |
| `src/lib/content/` | Reads lessons and questions from the database; saves lesson progress. |
| `src/lib/track.ts`, `report-error.ts` | Counts visits and reports page errors for the Control Center (no names or emails). |
| `supabase/migrations/` | Database changes, in date order. |
| `supabase/seed/` | The lessons, questions and cheat codes as files, and `import.sql` to load them. |

## Where the lessons live

Lessons, questions and cheat codes are in the database, so they can be edited in
**Control Center → Lessons** without changing code. `supabase/seed/` keeps the
original files; `import.sql` loads them again (it replaces Control Center edits).

## Running it on your computer

```bash
npm install
cp .env.example .env   # then fill in the Supabase values
npm run dev
```

## Publishing

Vercel publishes the site automatically when changes reach the `main` branch on GitHub.
Settings and secrets (Supabase keys, `GEMINI_API_KEY`) are in Vercel → Project → Settings → Environment Variables.

## Database updates

New files in `supabase/migrations/` must be run once in Supabase (SQL Editor, or `supabase db push`).
Run them in date order. After `20261105120000_lessons_in_database.sql`, run `supabase/seed/import.sql` once.
