import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueries, useSuspenseQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { checkAnswer, lessonIndexQuery, lessonQuestionsQuery, universalCodesQuery, type PracticeQuestion } from "@/lib/content";
import { QuestionBody } from "@/components/learn/QuestionBody";

export const Route = createFileRoute("/codes/$id")({
  loader: async ({ context, params }) => {
    const [codes] = await Promise.all([
      context.queryClient.ensureQueryData(universalCodesQuery),
      context.queryClient.ensureQueryData(lessonIndexQuery),
    ]);
    const u = codes.find((x) => x.id === params.id);
    if (!u) throw notFound();
    return { name: u.name, oneline: u.oneline };
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Cheat code"} | SAT cheat code | Imboni SAT Hub` },
      { name: "description", content: loaderData?.oneline ?? "" },
    ],
    links: [{ rel: "canonical", href: `https://sat.imboniacademy.org/codes/${params.id}` }],
  }),
  component: CodePage,
});

function CodePage() {
  const { id } = Route.useParams();
  const { language } = useI18n();
  const { data: codes } = useSuspenseQuery(universalCodesQuery);
  const { data: lessons } = useSuspenseQuery(lessonIndexQuery);
  const all = codes;
  const n = all.findIndex((x) => x.id === id);
  const u = all[n];
  const skills = [...new Set(u.apply.map((a) => a.skill))];
  const qs = useQueries({ queries: skills.map((s) => lessonQuestionsQuery(s)) });
  const findQ = (skill: string, pos: number): PracticeQuestion | undefined =>
    qs[skills.indexOf(skill)]?.data?.find((q) => q.position === pos);
  const scope = u.applies === "all" ? "Every part" : u.applies === "rw" ? "Reading and Writing" : "Math";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-[15.5px] leading-relaxed sm:px-6">
      <p className="text-[13px] text-muted-foreground"><Link to="/codes" className="hover:underline">Cheat codes</Link> / {scope}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{u.name}</h1>
      <p className="mt-3 rounded-2xl border border-primary/20 bg-secondary p-4 font-semibold">{u.oneline}</p>

      <h2 className="mb-3 mt-8 text-xl font-bold">How I think about it</h2>
      <div className="rounded-2xl border-l-4 border-primary bg-card p-4">{u.story}</div>

      <h2 className="mb-3 mt-8 text-xl font-bold">The code in steps</h2>
      <ol className="space-y-2 rounded-2xl border border-border bg-card p-4">
        {u.steps.map((s, i) => (
          <li key={i} className="flex gap-3"><span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>{s}</li>
        ))}
      </ol>

      <h2 className="mb-3 mt-8 text-xl font-bold">Learn it</h2>
      <div className="space-y-3">
        {u.teach.map((b, i) => (
          <section key={i} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-bold">{i + 1}. {b.h}</h3>
            {(b.p ?? []).map((t) => <p key={t} className="mt-2">{t}</p>)}
          </section>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-xl font-bold">Why it works</h2>
      <p>{u.why}</p>
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><b>Watch out:</b> {u.watch}</p>

      <h2 className="mb-1 mt-8 text-xl font-bold">See it work on real questions</h2>
      <p className="mb-3 text-muted-foreground">Try each question your usual way first. Then open the box to see the code at work.</p>
      <div className="space-y-4">
        {u.apply.map((a, i) => {
          const q = findQ(a.skill, a.q);
          const lesson = lessons.find((l) => l.slug === a.skill);
          return (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-sm text-muted-foreground"><b>{lesson?.name}</b> · question {a.q}{q ? ` · ${q.level}` : ""}</p>
              {q ? (
                <>
                  <QuestionBody q={q} lang={language} />
                  <ol className="mt-2 list-[upper-alpha] space-y-1 pl-6">{q.options.map((o) => <li key={o}>{o}</li>)}</ol>
                  <Worked q={q} a={a} />
                </>
              ) : (
                <p className="text-muted-foreground">Loading the question…</p>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-xl font-bold">Do not just believe me. Test it.</h2>
      <p className="rounded-2xl bg-secondary p-4">{u.experiment}</p>

      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-6">
        {all[n - 1] ? <Link to="/codes/$id" params={{ id: all[n - 1].id }} className="h-10 rounded-lg border border-border px-4 font-semibold leading-10">← {all[n - 1].name}</Link> : <span />}
        {all[n + 1] && <Link to="/codes/$id" params={{ id: all[n + 1].id }} className="h-10 rounded-lg bg-primary px-4 font-semibold leading-10 text-primary-foreground">Next: {all[n + 1].name} →</Link>}
      </div>
    </div>
  );
}

function Worked({ q, a }: { q: PracticeQuestion; a: { skill: string; without: string; with: string; result: string } }) {
  const [answer, setAnswer] = useState<number | null>(null);
  return (
    <details className="mt-3" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && answer === null) void checkAnswer(q.id, 0).then((r) => setAnswer(r.answer)).catch(() => undefined); }}>
      <summary className="cursor-pointer font-bold text-primary">Show how the code solves it</summary>
      <div className="mt-2 space-y-2 rounded-xl bg-secondary p-4 text-[15px]">
        <p><b>Without the code:</b> {a.without}</p>
        <p><b>With the code:</b> {a.with}</p>
        {answer !== null && <p><b>Answer: {String.fromCharCode(65 + answer)}.</b> {q.options[answer]}</p>}
        <p><b>What changed:</b> {a.result}</p>
        <Link to="/learn/$slug" params={{ slug: a.skill }} search={{ tab: "practice" }} className="inline-block font-semibold text-primary underline">Open this lesson and practise</Link>
      </div>
    </details>
  );
}
