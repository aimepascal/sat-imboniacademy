import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-auth-user";
import { lessonIndexQuery, siteContentQuery } from "@/lib/content";
import { useProgress } from "@/lib/content/progress";
import { tr } from "@/lib/i18n/tr";

export const Route = createFileRoute("/practice")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(lessonIndexQuery), context.queryClient.ensureQueryData(siteContentQuery)]),
  head: () => ({
    meta: [
      { title: "SAT practice questions by skill | Imboni SAT Hub" },
      { name: "description", content: "16 practice questions for every Digital SAT skill, easy to very hard, timed like the real test or with no clock." },
    ],
    links: [{ rel: "canonical", href: "https://sat.imboniacademy.org/practice" }],
  }),
  component: PracticeHome,
});

function PracticeHome() {
  const userId = useAuthUser();
  const { data: lessons } = useSuspenseQuery(lessonIndexQuery);
  const { data: site } = useSuspenseQuery(siteContentQuery);
  const { progress } = useProgress(userId);
  const due = useQuery({
    queryKey: ["review-due", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("review_queue" as never)
        .select("question_id", { count: "exact", head: true })
        .lte("due_at", new Date().toISOString());
      return count ?? 0;
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{tr("Practice")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Practise every part")}</h1>
      <p className="mt-2 text-muted-foreground">{tr("Every skill has 16 questions in two rounds, easy to very hard. Timed like the real test, or with no clock.")}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/check" className="rounded-2xl bg-primary p-4 text-primary-foreground">
          <b className="block">{tr("10-minute check")}</b>
          <span className="text-sm text-primary-foreground/80">{tr("One question from each part. Find your weak spots.")}</span>
        </Link>
        <Link to="/test" className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <b className="block">{tr("Full practice test")}</b>
          <span className="text-sm text-muted-foreground">{tr("Two timed modules, like test day, with a score.")}</span>
        </Link>
        <Link to={userId ? "/today" : "/auth"} className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <b className="block">{tr("Today's plan")}</b>
          <span className="text-sm text-muted-foreground">{userId ? tr("Short practice from your weakest skills.") : tr("Sign in to get a daily plan.")}</span>
        </Link>
        <Link to={userId ? "/me" : "/auth"} className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <b className="block">{tr("Mistake notebook")}{due.data ? ` · ${tr("{n} due", { n: due.data })}` : ""}</b>
          <span className="text-sm text-muted-foreground">{userId ? tr("Questions you missed come back until you get them right.") : tr("Sign in to keep the questions you miss.")}</span>
        </Link>
      </div>

      {site.sat_map.map((p) => (
        <section key={p.id}>
          <h2 className="mb-3 mt-9 text-2xl font-bold">{tr(p.name)}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {p.domains.map((d) => {
              const list = lessons.filter((l) => l.domain_slug === d.id);
              const tried = list.filter((l) => progress[l.slug]?.last_total).length;
              return (
                <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-bold">{tr(d.name)}</h3>
                    <span className="text-xs text-muted-foreground">{d.pct} · {tr("{a}/{b} practised", { a: tried, b: list.length })}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${(100 * tried) / Math.max(1, list.length)}%` }} /></div>
                  <ul className="mt-3 divide-y divide-border">
                    {list.map((l) => {
                      const pr = progress[l.slug];
                      return (
                        <li key={l.slug}>
                          <Link to="/learn/$slug" params={{ slug: l.slug }} search={{ tab: "practice" }} className="flex items-center gap-3 py-2.5 hover:text-primary">
                            <span className="flex-1 text-[15px]">{l.name}</span>
                            {pr?.last_total ? (
                              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">{pr.last_score}/{pr.last_total}</span>
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground">{tr("Start →")}</span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
