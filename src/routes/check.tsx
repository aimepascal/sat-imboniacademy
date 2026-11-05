// The 10-minute check: one medium question from each of the 8 SAT domains.
// The result lists the domains to start with.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useAuthUser } from "@/hooks/use-auth-user";
import { checkAnswer, lessonIndexQuery, pick, recordAttempt, siteContentQuery, type AnswerCheck, type PracticeQuestion } from "@/lib/content";
import { supabase } from "@/integrations/supabase/client";
import { QuestionBody } from "@/components/learn/QuestionBody";
import { tr } from "@/lib/i18n/tr";

export const Route = createFileRoute("/check")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(lessonIndexQuery), context.queryClient.ensureQueryData(siteContentQuery)]),
  head: () => ({ meta: [{ title: "10-minute SAT check | Imboni SAT Hub" }, { name: "description", content: "Eight questions, one from each part of the Digital SAT. Find out where to start." }] }),
  component: Check,
});

const letter = (i: number) => String.fromCharCode(65 + i);

function Check() {
  const { language } = useI18n();
  const userId = useAuthUser();
  const { data: lessons } = useSuspenseQuery(lessonIndexQuery);
  const { data: site } = useSuspenseQuery(siteContentQuery);
  const domains = site.sat_map.flatMap((p) => p.domains.map((d) => ({ ...d, part: p.name })));

  const items = useQuery({
    queryKey: ["check-questions"],
    staleTime: Infinity,
    queryFn: async () => {
      const out: { domain: string; lesson: string; q: PracticeQuestion }[] = [];
      await Promise.all(
        domains.map(async (d, n) => {
          const lesson = lessons.find((l) => l.domain_slug === d.id && !l.parent_slug);
          if (!lesson) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any).rpc("lesson_questions", { _slug: lesson.slug });
          const qs = (data ?? []) as PracticeQuestion[];
          const q = qs.find((x) => x.position === 3 + (n % 2)) ?? qs[0];
          if (q) out[n] = { domain: d.id, lesson: lesson.slug, q };
        }),
      );
      return out.filter(Boolean);
    },
  });

  const [i, setI] = useState(-1);
  const [picked, setPicked] = useState<number | null>(null);
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [score, setScore] = useState<Record<string, boolean>>({});

  if (i === -1)
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">10-minute check</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Where should you start?")}</h1>
        <p className="mt-2 text-muted-foreground">8 questions, one from each part of the SAT, at medium level. No clock. At the end you see which parts to study first.</p>
        <button type="button" disabled={!items.data} onClick={() => setI(0)} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-60">
          {!items.data && <Loader2 className="h-4 w-4 animate-spin" />} Start
        </button>
      </div>
    );

  const list = items.data ?? [];
  if (i >= list.length) {
    const weak = list.filter((x) => !score[x.domain]);
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">You got {list.length - weak.length} of {list.length}</h1>
        <p className="mt-2 text-muted-foreground">{weak.length ? "Start with these parts. Each one has a lesson, 16 questions and cheat codes." : "Strong start. Go to the harder questions in Round 2 of each lesson."}</p>
        <div className="mt-5 space-y-2">
          {list.map((x) => {
            const d = domains.find((dd) => dd.id === x.domain)!;
            const ok = score[x.domain];
            return (
              <Link key={x.domain} to="/learn/$slug" params={{ slug: x.lesson }} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3.5", ok ? "border-border" : "border-amber-300 bg-amber-50")}>
                <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm font-bold text-white", ok ? "bg-emerald-600" : "bg-amber-500")}>{ok ? "✓" : "!"}</span>
                <span className="flex-1"><b className="block text-[15px]">{tr(d.name)}</b><span className="text-xs text-muted-foreground">{d.part} · {d.pct} of the section</span></span>
                <span className="text-sm font-semibold text-primary">{ok ? tr("Review") : tr("Start here")} →</span>
              </Link>
            );
          })}
        </div>
        {!userId && <p className="mt-6 rounded-xl bg-secondary p-4 text-sm"><Link to="/auth" className="font-bold text-primary underline">{tr("Create a free account")}</Link> to save this result and get a daily plan from it.</p>}
      </div>
    );
  }

  const cur = list[i];
  const answer = async (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const res = await checkAnswer(cur.q.id, k).catch(() => null);
    if (!res) return setPicked(null);
    setCheck(res);
    setScore((s) => ({ ...s, [cur.domain]: res.correct }));
    if (userId) void recordAttempt(cur.q.id, k, null, "diagnostic").catch(() => undefined);
  };
  const nextQ = () => {
    setPicked(null);
    setCheck(null);
    setI(i + 1);
    window.scrollTo(0, 0);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex justify-between text-sm font-semibold text-muted-foreground">
        <span>{domains.find((d) => d.id === cur.domain)?.name}</span>
        <span>Question {i + 1} of {list.length}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${(100 * (i + (check ? 1 : 0))) / list.length}%` }} /></div>
      <QuestionBody q={cur.q} lang={language} />
      <div className="space-y-2">
        {cur.q.options.map((o, k) => (
          <button key={k} type="button" disabled={picked !== null} onClick={() => answer(k)}
            className={cn("flex w-full items-center gap-3 rounded-xl border-[1.5px] bg-card px-4 py-3 text-left",
              check?.answer === k && "border-emerald-600 bg-emerald-50",
              check && picked === k && !check.correct && "border-rose-600 bg-rose-50")}>
            <span className="grid h-7 w-7 place-items-center rounded-full border text-sm font-bold">{letter(k)}</span>{o}
          </button>
        ))}
      </div>
      {check && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 text-[15px]"><b>{check.correct ? "Correct. " : tr("Not quite. ")}</b>The answer is {letter(check.answer)}. {pick(language, check.why, check.why_rw)}</div>
          <button type="button" onClick={nextQ} className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground">{i === list.length - 1 ? tr("See my result") : tr("Next question")}</button>
        </>
      )}
    </div>
  );
}
