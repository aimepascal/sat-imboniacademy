import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-auth-user";
import { lessonIndexQuery, siteContentQuery } from "@/lib/content";
import { lastLesson, useProgress } from "@/lib/content/progress";
import aime from "@/assets/aime.jpg";

const SITE = "https://sat.imboniacademy.org";

export const Route = createFileRoute("/learn/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(lessonIndexQuery),
      context.queryClient.ensureQueryData(siteContentQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Learn the SAT one part at a time | Imboni SAT Hub" },
      { name: "description", content: "Free Digital SAT lessons, 512 practice questions and cheat codes for every part of Reading and Writing and Math. By Aime Pascal, Kigali." },
    ],
    links: [{ rel: "canonical", href: `${SITE}/learn` }],
  }),
  component: LearnHome,
});

// Old links to the one-page Learn site used #sections. They still work.
const OLD_HASH: Record<string, string> = { library: "/library", codes: "/codes", practice: "/practice", mine: "/me", impact: "/impact", tutors: "/forum", forum: "/forum" };

function LearnHome() {
  const navigate = useNavigate();
  const userId = useAuthUser();
  const { data: lessons } = useSuspenseQuery(lessonIndexQuery);
  const { data: site } = useSuspenseQuery(siteContentQuery);
  const { progress } = useProgress(userId);
  const name = useQuery({
    queryKey: ["display-name", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", userId!).maybeSingle();
      return data?.display_name ?? "";
    },
  });

  // Students who joined with Google skip the setup page; offer it here instead.
  const setup = useQuery({
    queryKey: ["onboarded", userId],
    enabled: !!userId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("profile_private").select("onboarded_at").eq("id", userId).maybeSingle();
      return !!data?.onboarded_at;
    },
  });

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (OLD_HASH[h]) navigate({ to: OLD_HASH[h], replace: true });
  }, [navigate]);

  const last = lastLesson(progress);
  const lastL = lessons.find((l) => l.slug === last);
  const lastP = last ? progress[last] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6">
      {userId ? (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Murakaza neza</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight sm:text-4xl">
            {name.data ? `Good to see you, ${name.data.split(" ")[0]}.` : "Good to see you."}
          </h1>
          {setup.data === false && (
            <Link to="/welcome" className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <span className="flex-1"><b className="block">Set your goal and test date</b><span className="text-sm text-muted-foreground">One minute. Your daily plan fits your time.</span></span>
              <span className="font-semibold text-primary">Start →</span>
            </Link>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">{lastL ? "Continue where you stopped" : "Start here"}</span>
              {lastL ? (
                <>
                  <p className="mt-3 text-lg font-bold">{lastL.name}</p>
                  <p className="text-sm text-muted-foreground">{lastP?.last_total ? `Last practice: ${lastP.last_score} of ${lastP.last_total}` : lastP?.done ? "Marked as done" : "Lesson opened"}</p>
                  <Link to="/learn/$slug" params={{ slug: lastL.slug }} search={lastP?.last_total ? { tab: "practice" } : {}} className="mt-4 block h-11 rounded-xl bg-primary text-center font-bold leading-[44px] text-primary-foreground">Continue</Link>
                </>
              ) : (
                <>
                  <p className="mt-3 text-lg font-bold">Take the 10-minute check</p>
                  <p className="text-sm text-muted-foreground">8 questions, one from each part. It shows where to start.</p>
                  <Link to="/check" className="mt-4 block h-11 rounded-xl bg-primary text-center font-bold leading-[44px] text-primary-foreground">Start the check</Link>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="font-bold">Today's plan</p>
              <p className="mt-1 text-sm text-muted-foreground">Short practice from your weakest skills, plus questions you missed before, coming back at the right time.</p>
              <div className="mt-4 flex gap-2">
                <Link to="/today" className="h-11 flex-1 rounded-xl border border-primary text-center font-bold leading-[44px] text-primary">Open today's plan</Link>
                <Link to="/me" className="h-11 rounded-xl border border-border px-4 text-center font-semibold leading-[44px]">My progress</Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Free SAT prep</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight sm:text-4xl">Learn the SAT one part at a time.</h1>
          <p className="mt-2 text-muted-foreground">{lessons.length} lessons, {lessons.length * 16} practice questions and cheat codes for every part. Free.</p>
          <div className="mt-4 rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-lg font-bold">Not sure where to start?</p>
            <p className="mt-1 text-primary-foreground/80">Take a 10-minute check. It shows the parts that cost you the most points.</p>
            <Link to="/check" className="mt-4 inline-block h-11 rounded-xl bg-white px-5 font-bold leading-[44px] text-primary">Start the 10-minute check</Link>
          </div>
        </>
      )}

      <h2 className="mb-3 mt-7 text-lg font-bold">{userId ? "All parts" : "Or pick a section"}</h2>
      <div className="grid grid-cols-2 gap-3">
        {site.sat_map.map((p) => {
          const n = lessons.filter((l) => l.section === p.id && !l.parent_slug).length;
          const done = lessons.filter((l) => l.section === p.id && progress[l.slug]?.done).length;
          return (
            <a key={p.id} href={`#${p.id}`} className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">{p.name}</span>
              <b className="mt-2 block">{p.domains.length} parts · {n} skills</b>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{userId ? `${done} done` : p.domains.map((d) => d.name).join(", ")}</p>
            </a>
          );
        })}
      </div>

      <details className="mt-3 rounded-2xl border border-border bg-card p-4">
        <summary className="flex cursor-pointer list-none items-center gap-3">
          <img src={aime} alt="" width={46} height={46} className="h-[46px] w-[46px] rounded-full object-cover object-top" />
          <span><b className="block text-sm">A note from Aime Pascal</b><span className="text-[13px] text-muted-foreground">Why I built the Hub, and how to use it. <span className="font-bold text-primary">Read</span></span></span>
        </summary>
        <div className="mt-3 space-y-2 text-[15px] leading-relaxed">
          <p>When I was studying, the SAT became easier the day I started to notice its mind map. It is not one big test. It is a few parts, each part has smaller parts, and each small part has its own rules.</p>
          <p>So do not try to learn everything at once. Go part by part, and finish one before you open the next. If you already know what hurts your score, go straight to that part.</p>
          <p className="text-muted-foreground">— Aime Pascal, Imboni Academy, Kigali</p>
        </div>
      </details>

      {site.sat_map.map((p) => (
        <section key={p.id} id={p.id} className="scroll-mt-20">
          <h2 className="mb-1 mt-10 text-2xl font-bold tracking-tight">{p.name}</h2>
          <p className="text-sm text-muted-foreground">{p.facts}</p>
          {p.domains.map((d) => {
            const note = site.domain_notes[d.id];
            return (
              <div key={d.id} className="mt-5">
                <h3 className="text-lg font-bold">{d.name} <span className="text-sm font-normal text-muted-foreground">· {d.pct}</span></h3>
                <p className="text-sm text-muted-foreground">{d.desc}{note ? ` ${note.at}.` : ""}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lessons.filter((l) => l.domain_slug === d.id).map((l) => {
                    const pr = progress[l.slug];
                    return (
                      <Link key={l.slug} to="/learn/$slug" params={{ slug: l.slug }} className="rounded-xl border border-border bg-card p-3.5 hover:border-primary">
                        <span className="flex items-start justify-between gap-2">
                          <b className="text-[15px] leading-snug">{l.name}</b>
                          {pr?.done ? <span className="text-xs font-bold text-emerald-700">✓ Done</span> : pr?.last_total ? <span className="text-xs font-semibold text-muted-foreground">{pr.last_score}/{pr.last_total}</span> : null}
                        </span>
                        <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{l.parent_slug ? "Part of Ratios, rates and units · " : ""}{l.summary}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
