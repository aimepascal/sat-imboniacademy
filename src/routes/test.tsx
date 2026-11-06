// Full practice test for one section, built like the Digital SAT:
// two timed modules; module 2 is harder or easier depending on module 1.
// Answers are checked only at the end of each module.
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, Flag, Sigma, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-auth-user";
import type { PracticeQuestion, Section } from "@/lib/content";
import { QuestionBody } from "@/components/learn/QuestionBody";
import { tr } from "@/lib/i18n/tr";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/test")({
  head: () => ({
    meta: [
      { title: "Full SAT practice test | Imboni SAT Hub" },
      { name: "description", content: "A timed practice test in two modules, like the Digital SAT, with an estimated score at the end." },
    ],
  }),
  component: TestPage,
});

const SPEC: Record<Section, { name: string; count: number; minutes: number }> = {
  rw: { name: tr("Reading and Writing"), count: 27, minutes: 32 },
  m: { name: tr("Math"), count: 22, minutes: 35 },
};
type Q = PracticeQuestion & { domain: string };
interface Graded { question_id: string; choice: number; correct: boolean; answer: number; why: string }
const letter = (i: number) => String.fromCharCode(65 + i);
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function TestPage() {
  const userId = useAuthUser();
  const { language } = useI18n();
  const [section, setSection] = useState<Section | null>(null);
  const [module, setModule] = useState<1 | 2>(1);
  const [harder, setHarder] = useState(true);
  const [qs, setQs] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<"pick" | "loading" | "run" | "check" | "done">("pick");
  const [left, setLeft] = useState(0);
  const [hideTimer, setHideTimer] = useState(false);
  const [ref, setRef] = useState(false);
  const [graded, setGraded] = useState<{ m1: Graded[]; m2: Graded[]; q1: Q[]; q2: Q[] }>({ m1: [], m2: [], q1: [], q2: [] });
  const [score, setScore] = useState<number | null>(null);
  const started = useRef(0);

  const load = async (s: Section, m: 1 | 2, h: boolean, exclude: string[]) => {
    setStage("loading");
    const { data, error } = await db.rpc("test_questions", { _section: s, _module: m, _harder: h, _exclude: exclude });
    if (error || !data?.length) {
      toast.error("Could not load the test. Check your connection and try again.");
      setStage("pick");
      return;
    }
    setQs(data);
    setAnswers({});
    setMarked({});
    setI(0);
    setLeft(SPEC[s].minutes * 60);
    if (m === 1) started.current = Date.now();
    setStage("run");
  };

  // Module timer: when it ends, the module is submitted.
  useEffect(() => {
    if (stage !== "run" && stage !== "check") return;
    const end = Date.now() + left * 1000;
    const iv = setInterval(() => {
      const l = Math.max(0, (end - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0) {
        clearInterval(iv);
        void submitRef.current();
      }
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage === "run" || stage === "check", module]);

  // The timer calls the latest submit, with the answers given so far.
  const submitRef = useRef<() => Promise<unknown>>(async () => undefined);
  const submit = async () => {
    if (!section) return;
    const payload = qs.map((q) => ({ question_id: q.id, choice: answers[q.id] ?? -1 }));
    const { data, error } = await db.rpc("grade_answers", { _answers: payload });
    if (error) return toast.error("Could not submit. Check your connection and try again.");
    const g = data as Graded[];
    if (userId) {
      const batch = g.filter((x) => x.choice >= 0).map((x) => ({ id: crypto.randomUUID(), question_id: x.question_id, option_index: x.choice, created_at: new Date().toISOString(), mode: "diagnostic" }));
      if (batch.length) void db.rpc("submit_attempts", { _batch: batch });
    }
    if (module === 1) {
      const pct = g.filter((x) => x.correct).length / Math.max(1, qs.length);
      const h = pct >= 0.6;
      setHarder(h);
      setGraded((s) => ({ ...s, m1: g, q1: qs }));
      setModule(2);
      toast("Module 1 done. Module 2 starts now.");
      await load(section, 2, h, qs.map((q) => q.id));
    } else {
      const m1 = graded.m1;
      const p1 = m1.filter((x) => x.correct).length / Math.max(1, graded.q1.length);
      const p2 = g.filter((x) => x.correct).length / Math.max(1, qs.length);
      // An estimate, not an official scale: the harder module 2 opens the top of the range.
      const raw = harder ? 200 + 600 * (0.45 * p1 + 0.55 * p2) : 200 + 420 * (0.5 * p1 + 0.5 * p2);
      const sc = Math.min(800, Math.max(200, Math.round(raw / 10) * 10));
      setScore(sc);
      setGraded((s) => ({ ...s, m2: g, q2: qs }));
      setStage("done");
      if (userId) {
        const correct = m1.filter((x) => x.correct).length + g.filter((x) => x.correct).length;
        await db.from("practice_tests").insert({ user_id: userId, section, score: sc, correct, total: graded.q1.length + qs.length, harder, minutes: Math.round((Date.now() - started.current) / 60000) });
      }
    }
  };

  submitRef.current = submit;

  if (stage === "pick" || stage === "loading")
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{tr("Full practice test")}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Test yourself like test day")}</h1>
        <p className="mt-2 text-muted-foreground">Two timed modules. If module 1 goes well, module 2 is harder and the score can go higher, just like the Digital SAT. Answers are checked at the end of each module.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(Object.keys(SPEC) as Section[]).map((s) => (
            <button key={s} type="button" disabled={stage === "loading"} onClick={() => { setSection(s); setModule(1); setGraded({ m1: [], m2: [], q1: [], q2: [] }); void load(s, 1, true, []); }}
              className="rounded-2xl border border-border bg-card p-5 text-left hover:border-primary disabled:opacity-60">
              <b className="block text-lg">{tr(SPEC[s].name)}</b>
              <span className="text-sm text-muted-foreground">2 modules × {SPEC[s].count} questions, {SPEC[s].minutes} minutes each</span>
            </button>
          ))}
        </div>
        <p className="mt-6 rounded-xl bg-secondary p-4 text-sm">The questions come from the Hub lessons, so you may have seen some. For the official experience, also take the free full tests in <a href="https://bluebook.collegeboard.org" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Bluebook</a>.</p>
        {!userId && <p className="mt-3 text-sm text-muted-foreground"><Link to="/auth" className="font-semibold text-primary underline">{tr("Sign in")}</Link> to save your score.</p>}
      </div>
    );

  if (stage === "done" && section && score !== null) {
    const all = [...graded.q1.map((q, n) => ({ q, g: graded.m1.find((x) => x.question_id === q.id), n: n + 1, m: 1 })), ...graded.q2.map((q, n) => ({ q, g: graded.m2.find((x) => x.question_id === q.id), n: n + 1, m: 2 }))];
    const correct = all.filter((x) => x.g?.correct).length;
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{tr(SPEC[section].name)} · result</p>
        <h1 className="mt-1 text-5xl font-bold tracking-tight">{score}</h1>
        <p className="mt-1 text-muted-foreground">Estimated section score out of 800 · {correct} of {all.length} right · module 2 was {harder ? "the harder one" : "the easier one"}</p>
        <p className="mt-3 text-xs text-muted-foreground">An estimate from Hub questions, not an official College Board score.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setStage("pick"); setScore(null); }} className="h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground">{tr("Take another test")}</button>
          {userId && <Link to="/me" className="h-11 rounded-xl border border-primary px-5 font-semibold leading-[44px] text-primary">{tr("My progress")}</Link>}
        </div>
        <h2 className="mb-3 mt-8 text-xl font-bold">{tr("Check your answers")}</h2>
        <div className="space-y-3">
          {all.map(({ q, g, n, m }) => (
            <details key={q.id} className={cn("rounded-xl border bg-card p-4", g?.correct ? "border-border" : "border-rose-200")}>
              <summary className="cursor-pointer text-sm"><b>Module {m} · {n}</b> {g?.correct ? "✓" : g && g.choice >= 0 ? "✗" : "— not answered"} <span className="text-muted-foreground">{q.stem.slice(0, 80)}</span></summary>
              <div className="mt-3"><QuestionBody q={q} lang={language} />
                <ol className="mt-2 space-y-1">{q.options.map((o, k) => <li key={k} className={cn(k === g?.answer && "font-bold text-emerald-700", k === g?.choice && !g?.correct && "text-rose-700 line-through")}>{letter(k)}. {o}</li>)}</ol>
                {g && <p className="mt-2 rounded-lg bg-secondary p-3 text-sm">{g.why}</p>}
              </div>
            </details>
          ))}
        </div>
      </div>
    );
  }

  if (!section) return null;
  const q = qs[i];
  const answeredCount = qs.filter((x) => answers[x.id] !== undefined).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-14 z-20 flex h-12 items-center gap-3 bg-foreground px-4 text-sm font-bold text-background">
        <span>{tr(SPEC[section].name)} · Module {module}</span>
        <span className="mx-auto font-mono text-base tabular-nums">{hideTimer ? "" : fmt(left)}</span>
        <button type="button" onClick={() => setHideTimer((v) => !v)} className="font-semibold">{hideTimer ? "Show" : "Hide"}</button>
      </div>
      <div className="flex gap-2 border-b border-border bg-card px-4 py-2 text-sm font-semibold text-primary">
        {section === "m" && <a href="https://www.desmos.com/testing/cb-digital-sat/graphing" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1"><Calculator className="h-4 w-4" /> {tr("Calculator")}</a>}
        {section === "m" && <button type="button" onClick={() => setRef(true)} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1"><Sigma className="h-4 w-4" /> {tr("Reference")}</button>}
        {stage === "run" && q && <button type="button" onClick={() => setMarked((m) => ({ ...m, [q.id]: !m[q.id] }))} className={cn("flex items-center gap-1 rounded-full px-3 py-1", marked[q.id] ? "bg-amber-100 text-amber-800" : "bg-secondary")}><Flag className="h-4 w-4" /> {marked[q.id] ? tr("Marked") : tr("Mark for review")}</button>}
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-28 pt-5">
        {stage === "run" && q ? (
          <>
            <p className="mb-3 text-sm font-semibold text-muted-foreground">Question {i + 1} of {qs.length}</p>
            <QuestionBody q={q} lang={language} />
            <div className="mt-4 space-y-2">
              {q.options.map((o, k) => (
                <button key={k} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: k }))}
                  className={cn("flex w-full items-center gap-3 rounded-xl border-[1.5px] bg-card px-4 py-3 text-left", answers[q.id] === k && "border-primary bg-secondary")}>
                  <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-full border text-sm font-bold", answers[q.id] === k && "border-primary bg-primary text-primary-foreground")}>{letter(k)}</span>{o}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-xl font-bold">{tr("Check your work")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{answeredCount} of {qs.length} answered. Tap a number to go back to it. Unanswered questions count as wrong.</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-1.5" aria-label="Question map">
          {qs.map((x, n) => (
            <button key={x.id} type="button" onClick={() => { setI(n); setStage("run"); }}
              className={cn("grid h-8 w-8 place-items-center rounded-md text-xs font-bold",
                answers[x.id] !== undefined ? "bg-primary text-primary-foreground" : "border border-border bg-card",
                marked[x.id] && "ring-2 ring-amber-500", n === i && stage === "run" && "outline outline-2 outline-offset-1 outline-foreground")}>
              {n + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-border bg-card p-3">
        <button type="button" disabled={stage === "run" && i === 0} onClick={() => (stage === "check" ? setStage("run") : setI(i - 1))} className="h-11 flex-1 rounded-xl border border-primary font-semibold text-primary disabled:opacity-40">{tr("Back")}</button>
        {stage === "run" ? (
          <button type="button" onClick={() => (i === qs.length - 1 ? setStage("check") : setI(i + 1))} className="h-11 flex-1 rounded-xl bg-primary font-bold text-primary-foreground">{i === qs.length - 1 ? tr("Check my work") : tr("Next")}</button>
        ) : (
          <button type="button" onClick={() => void submit()} className="h-11 flex-1 rounded-xl bg-primary font-bold text-primary-foreground">{module === 1 ? tr("Submit module 1") : tr("Finish the test")}</button>
        )}
      </div>

      {ref && (
        <div role="dialog" aria-label="Reference sheet" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setRef(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><b className="text-lg">{tr("Reference")}</b><button type="button" onClick={() => setRef(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
            <ul className="mt-3 space-y-1.5">
              <li>Circle: A = πr², C = 2πr</li>
              <li>Rectangle: A = ℓw · Triangle: A = ½bh</li>
              <li>Pythagorean theorem: c² = a² + b²</li>
              <li>Special right triangles: 30°-60°-90° sides x, x√3, 2x · 45°-45°-90° sides s, s, s√2</li>
              <li>Rectangular box: V = ℓwh · Cylinder: V = πr²h</li>
              <li>Sphere: V = 4/3 πr³ · Cone: V = 1/3 πr²h · Pyramid: V = 1/3 ℓwh</li>
              <li>A circle has 360 degrees, or 2π radians.</li>
              <li>The angles of a triangle add up to 180 degrees.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
