import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { lessonIndexQuery, siteContentQuery } from "@/lib/content";

export interface Resource {
  id: string;
  title: string;
  category: string;
  section: string;
  summary: string;
  content: string;
  file_url: string | null;
}

export const resourcesQuery = queryOptions({
  queryKey: ["library", "resources"],
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<Resource[]> => {
    const { data, error } = await supabase
      .from("resources")
      .select("id, title, category, section, summary, content, file_url")
      .order("category")
      .order("title");
    if (error) throw new Error(error.message);
    return (data ?? []) as Resource[];
  },
});

export const Route = createFileRoute("/library")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(lessonIndexQuery),
      context.queryClient.ensureQueryData(siteContentQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Library: SAT guides, books and lessons | Imboni SAT Hub" },
      { name: "description", content: "Free SAT guides by topic, official College Board tools, free books for reading practice, and every lesson on the Hub." },
    ],
    links: [{ rel: "canonical", href: "https://sat.imboniacademy.org/library" }],
  }),
  component: Library,
});

type Filter = "all" | "m" | "rw" | "books";
const MATH = ["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry", "Math"];
const isMath = (r: Resource) => MATH.includes(r.category) || /math/i.test(r.section);

function Library() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const { data: lessons } = useSuspenseQuery(lessonIndexQuery);
  const { data: site } = useSuspenseQuery(siteContentQuery);
  const resources = useQuery(resourcesQuery);
  const needle = q.trim().toLowerCase();
  const has = (...s: string[]) => !needle || s.join(" ").toLowerCase().includes(needle);

  const guides = useMemo(
    () => (resources.data ?? []).filter((r) => (f === "all" || (f === "m" ? isMath(r) : f === "rw" ? !isMath(r) : false)) && has(r.title, r.category, r.summary)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resources.data, f, needle],
  );
  const matchLessons = lessons.filter((l) => (f === "all" || f === l.section) && has(l.name, l.summary));
  const books = site.books.filter((b) => (f === "all" || f === "books") && has(b.title, b.note));

  const chips: [Filter, string][] = [["all", "All"], ["m", "Math"], ["rw", "Reading and Writing"], ["books", "Books and tools"]];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Library</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Books, guides and lessons</h1>
      <p className="mt-2 text-muted-foreground">Guides by SAT topic, free official tools, and every lesson on the Hub.</p>

      <label className="mt-5 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" className="h-full flex-1 bg-transparent outline-none" aria-label="Search the library" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {chips.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setF(k)} className={cn("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold", f === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {f !== "books" && (
        <section>
          <h2 className="mb-3 mt-7 text-xl font-bold">Guides by topic</h2>
          {resources.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!resources.isLoading && !guides.length && <p className="text-muted-foreground">No guides match.</p>}
          <div className="space-y-2">
            {guides.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card">
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open === r.id}>
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-secondary text-primary"><FileText className="h-5 w-5" /></span>
                  <span className="flex-1"><b className="block text-[15px]">{r.title}</b><span className="text-xs text-muted-foreground">{r.category}</span></span>
                </button>
                {open === r.id && (
                  <div className="border-t border-border px-4 pb-4 pt-3 text-[15px] leading-relaxed">
                    {r.summary && <p className="font-semibold">{r.summary}</p>}
                    <div className="mt-2 whitespace-pre-line text-foreground/90">{r.content}</div>
                    {r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
                        <Download className="h-4 w-4" /> Open the file
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {books.length > 0 && (
        <section>
          <h2 className="mb-3 mt-8 text-xl font-bold">Free books and official tools</h2>
          <div className="space-y-2">
            {books.map((b) => (
              <a key={b.url} href={b.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary">
                <span className="flex-1"><b className="block text-[15px]">{b.title}</b><span className="text-[13px] text-muted-foreground">{b.note} · {b.price}</span></span>
                <ExternalLink className="h-4 w-4 flex-none text-primary" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Only free and legal sources are listed. Good SAT books are copyrighted, so they cannot be copied here.</p>
        </section>
      )}

      {f !== "books" && matchLessons.length > 0 && (
        <section>
          <h2 className="mb-3 mt-8 text-xl font-bold">Lessons</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {matchLessons.map((l) => (
              <Link key={l.slug} to="/learn/$slug" params={{ slug: l.slug }} className="rounded-xl border border-border bg-card p-3.5 hover:border-primary">
                <b className="text-[15px]">{l.name}</b>
                <p className="mt-1 text-[13px] text-muted-foreground">{l.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
