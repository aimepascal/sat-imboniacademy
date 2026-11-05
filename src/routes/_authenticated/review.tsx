// Mistake notebook review: questions the student missed, due again today.
// A right answer moves the question to a later day; a wrong one brings it back tomorrow.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { checkAnswer, pick, recordAttempt, type AnswerCheck, type PracticeQuestion } from "@/lib/content";
import { QuestionBody } from "@/components/learn/QuestionBody";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Mistake notebook | Imboni SAT Hub" }, { name: "robots", content: "noindex" }] }),
  component: Review,
});

type DueQuestion = PracticeQuestion & { lesson_slug: string; due_at: string };
const letter = (i: number) => String.fromCharCode(65 + i);

function Review() {
  const { user } = Route.useRouteContext();
  const { language } = useI18n();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["review-session", user.id],
    staleTime: Infinity,
    queryFn: async (): Promise<DueQuestion[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("my_review_questions", { _limit: 20 });
      return ((data ?? []) as DueQuestion[]).filter((q) => Date.parse(q.due_at) <= Date.now());
    },
  });
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [right, setRight] = useState(0);

  if (list.isLoading) return <div className="mx-auto max-w-xl px-4 py-8 text-muted-foreground">Loading…</div>;
  const qs = list.data ?? [];
  if (!qs.length || i >= qs.length)
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-4xl" aria-hidden>{qs.length ? "👏" : "✓"}</p>
        <h1 className="mt-2 text-2xl font-bold">{qs.length ? `Done: ${right} of ${qs.length} right` : "Nothing to review today"}</h1>
        <p className="mt-2 text-muted-foreground">{qs.length ? "Questions you got right come back later. The others come back tomorrow." : "Questions you miss in practice come back here on the right day."}</p>
        <Link to="/me" onClick={() => qc.invalidateQueries({ queryKey: ["me-review", user.id] })} className="mt-6 inline-block h-11 rounded-xl bg-primary px-6 font-bold leading-[44px] text-primary-foreground">Back to my progress</Link>
      </div>
    );

  const q = qs[i];
  const answer = async (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const res = await checkAnswer(q.id, k).catch(() => null);
    if (!res) return setPicked(null);
    setCheck(res);
    if (res.correct) setRight((r) => r + 1);
    void recordAttempt(q.id, k, null, "review").catch(() => undefined);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex justify-between text-sm font-semibold text-muted-foreground"><span>Mistake notebook</span><span>{i + 1} of {qs.length}</span></div>
      <QuestionBody q={q} lang={language} />
      <div className="space-y-2">
        {q.options.map((o, k) => (
          <button key={k} type="button" disabled={picked !== null} onClick={() => answer(k)}
            className={cn("flex w-full items-center gap-3 rounded-xl border-[1.5px] bg-card px-4 py-3 text-left",
              check?.answer === k && "border-emerald-600 bg-emerald-50", check && picked === k && !check.correct && "border-rose-600 bg-rose-50")}>
            <span className="grid h-7 w-7 place-items-center rounded-full border text-sm font-bold">{letter(k)}</span>{o}
          </button>
        ))}
      </div>
      {check && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 text-[15px]"><b>{check.correct ? "Correct. " : "Not yet. "}</b>The answer is {letter(check.answer)}. {pick(language, check.why, check.why_rw)}</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setPicked(null); setCheck(null); setI(i + 1); window.scrollTo(0, 0); }} className="h-11 flex-1 rounded-xl bg-primary font-bold text-primary-foreground">Next</button>
            <Link to="/learn/$slug" params={{ slug: q.lesson_slug }} className="h-11 rounded-xl border border-primary px-4 font-semibold leading-[44px] text-primary">Open the lesson</Link>
          </div>
        </>
      )}
    </div>
  );
}
