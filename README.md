# Imboni SAT Hub

Free SAT lessons, practice and a student community, at **[sat.imboniacademy.org](https://sat.imboniacademy.org)**.

Built and run by **Aime Pascal Komezusenge** for Imboni Academy, Kigali, Rwanda.

## What is where

| Folder or file | What it does |
| --- | --- |
| `public/learn/` | The **Learn** page (home): SAT map, lessons, cheat codes, library, practice for guests. Plain HTML and JavaScript. |
| `public/learn/content.js`, `data.js`, `universal.js` | The lessons, skills, practice questions and cheat codes. |
| `src/routes/` | The other pages. One file per page: `forum.tsx` is `/forum`, `impact.tsx` is `/impact`, and so on. |
| `src/routes/_authenticated/` | Pages that need an account: `today.tsx` (Today's plan), `practice.tsx`, `review-desk.tsx`, `admin.tsx` (Control Center). |
| `src/components/SiteHeader.tsx` | The menu bar at the top of every page. |
| `src/components/SiteFooter.tsx` | The footer. |
| `src/lib/track.ts` | Counts visits for the Control Center (no names or emails). |
| `src/lib/learning/` | The practice engine: picks questions from each student's weak skills. |
| `src/lib/i18n/` | English (`en.ts`) and Kinyarwanda (`rw.ts`) words. |
| `src/styles.css` | Colours and fonts. Imboni navy is `--primary: #10508a`. |
| `supabase/migrations/` | Database changes, in date order. |
| `public/og-image.png` | The picture shown when a link is shared on WhatsApp or social media. |

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
The visitor statistics in the Control Center need `20261103120000_page_views_and_admin_stats.sql`.
