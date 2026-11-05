import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Every public page, including one link per lesson and per cheat code, so
// search engines can find them. Built from the database on each request.
const SITE = "https://sat.imboniacademy.org";
const STATIC = ["/learn", "/practice", "/library", "/codes", "/check", "/forum", "/tutors", "/impact", "/privacy", "/terms"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const [{ data: lessons }, { data: codes }] = await Promise.all([
          db.from("lessons").select("slug, updated_at").eq("published", true),
          db.from("site_content").select("data").eq("key", "universal_codes").maybeSingle(),
        ]);
        const urls = [
          ...STATIC.map((p) => `<url><loc>${SITE}${p}</loc></url>`),
          ...(lessons ?? []).map((l: { slug: string; updated_at: string }) => `<url><loc>${SITE}/learn/${l.slug}</loc><lastmod>${l.updated_at.slice(0, 10)}</lastmod></url>`),
          ...((codes?.data ?? []) as { id: string }[]).map((c) => `<url><loc>${SITE}/codes/${c.id}</loc></url>`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
        return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
