import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-auth-user";
import { lessonIndexQuery, siteContentQuery } from "@/lib/content";
import { useProgress } from "@/lib/content/progress";

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
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Practice</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Practise every part</h1>
      <p className="mt-2 text-muted-foreground">Every skill has 16 questions in two rounds, easy to very hard. Timed like the real test, or with no clock.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/check" className="rounded-2xl bg-primary p-4 text-primary-foreground">
          <b className="block">10-minute check</b>
          <span className="text-sm text-primary-foreground/80">One question from each part. Find your weak spots.</span>
        </Link>
        <Link to="/test" className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <b className="block">Full practice test</b>
          <span className="text-sm text-muted-foreground">Two timed modules, like test day, with a score.</span>
        </Link>
        <Link to={userId ? "/today" : "/auth"} className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <b className="block">Today's plan</b>
          <span className="text-sm text-muted-foreground">{userId ? "Short practice from your weakest skills." : "Sign in to get a daily plan."}</span>
        </Link>
        <Link to={userId ? "/me" : "/auth"} className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <b className="block">Mistake notebook{due.data ? ` · ${due.data} due` : ""}</b>
          <span className="text-sm text-muted-foreground">{userId ? "Questions you missed come back until you get them right." : "Sign in to keep the questions you miss."}</span>
        </Link>
      </div>

      {site.sat_map.map((p) => (
        <section key={p.id}>
          <h2 className="mb-1 mt-9 text-2xl font-bold">{p.name}</h2>
          {p.domains.map((d) => (
            <div key={d.id} className="mt-4">
              <h3 className="mb-2 font-bold">{d.name}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {lessons.filter((l) => l.domain_slug === d.id).map((l) => {
                  const pr = progress[l.slug];
                  return (
                    <Link key={l.slug} to="/learn/$slug" params={{ slug: l.slug }} search={{ tab: "practice" }} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3.5 hover:border-primary">
                      <span><b className="block text-[15px]">{l.name}</b><span className="text-xs text-muted-foreground">16 questions</span></span>
                      {pr?.last_total ? <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">{pr.last_score}/{pr.last_total}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
