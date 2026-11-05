// Practice for one lesson: two rounds of 8 questions, easy to very hard.
// Timed mode gives each question the real-test time; seconds not used carry to the
// next question. The answer is checked on the server, so the key never ships.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  checkAnswer,
  lessonQuestionsQuery,
  recordAttempt,
  reportProblem,
  secondsPerQuestion,
  pick,
  type AnswerCheck,
  type Section,
  type UniversalCode,
} from "@/lib/content";
import { QuestionBody, LEVEL_STYLE } from "./QuestionBody";

const fmt = (t: number) => {
  t = Math.max(0, Math.round(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const letter = (i: number) => String.fromCharCode(65 + i);

interface Result {
  ok: boolean;
  level: string;
  used: number | null;
}

export function PracticePanel(props: {
  slug: string;
  section: Section;
  lang: string;
  userId: string | null;
  universal: UniversalCode[];
  onScore: (score: number, total: number) => void;
}) {
  const { slug, section, lang, userId } = props;
  const questions = useQuery(lessonQuestionsQuery(slug));
  const [round, setRound] = useState(0);
  const [timed, setTimed] = useState(true);
  const [stage, setStage] = useState<"intro" | "q" | "result">("intro");
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const bank = useRef(0);
  const allow = useRef(0);
  const started = useRef(0);
  const [left, setLeft] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reportText, setReportText] = useState("");

  const all = questions.data ?? [];
  const set = all.slice(round * 8, round * 8 + 8);
  const q = set[i];
  const locked = picked !== null || timeUp;

  // Countdown
  useEffect(() => {
    if (stage !== "q" || !timed || locked) return;
    const end = Date.now() + left * 1000;
    const iv = setInterval(() => {
      const l = Math.max(0, (end - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0) {
        clearInterval(iv);
        bank.current = 0;
        setTimeUp(true);
        setResults((r) => [...r, { ok: false, level: q?.level ?? "", used: allow.current }]);
        // 99 is never an option (a negative index would read from the end of the list).
        if (q) void checkAnswer(q.id, 99).then(setCheck).catch(() => undefined);
      }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timed, locked, i]);

  const startQuestion = (index: number) => {
    allow.current = secondsPerQuestion(section) + bank.current;
    setLeft(allow.current);
    started.current = Date.now();
    setI(index);
    setPicked(null);
    setCheck(null);
    setTimeUp(false);
    setReporting(false);
    setStage("q");
  };

  const start = (r = round) => {
    setRound(r);
    bank.current = 0;
    setResults([]);
    startQuestion(0);
    document.getElementById("practice-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const answer = async (k: number) => {
    if (locked || !q) return;
    setPicked(k);
    setChecking(true);
    const used = (Date.now() - started.current) / 1000;
    try {
      const res = await checkAnswer(q.id, k);
      setCheck(res);
      if (timed) bank.current = Math.round(Math.max(0, allow.current - used));
      setResults((r) => [...r, { ok: res.correct, level: q.level, used: timed ? used : null }]);
      if (userId) void recordAttempt(q.id, k, used * 1000).catch(() => undefined);
    } catch {
      setPicked(null);
      toast.error("Could not check the answer. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    if (i === set.length - 1) {
      const correct = results.filter((r) => r.ok).length;
      props.onScore(correct, results.length);
      setStage("result");
    } else startQuestion(i + 1);
  };

  const sendReport = async () => {
    if (!q || !userId || reportText.trim().length < 3) return;
    try {
      await reportProblem(q.id, userId, reportText);
      toast.success("Thank you. Aime will check this question.");
      setReporting(false);
      setReportText("");
    } catch {
      toast.error("Could not send the report. Try again.");
    }
  };

  if (questions.isLoading)
    return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading questions…</p>;
  if (questions.isError || all.length === 0)
    return <p className="text-muted-foreground">The questions for this lesson are not available right now. Try again in a moment.</p>;

  const modeToggle = (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm font-semibold" role="group" aria-label="Clock">
      {[
        [true, "Timed"],
        [false, "Free"],
      ].map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => setTimed(v as boolean)}
          className={cn("rounded-md px-3 py-1.5", timed === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        >
          {label as string}
        </button>
      ))}
    </div>
  );

  if (stage === "intro") {
    const minutes = section === "rw" ? "64 minutes for 54 questions" : "70 minutes for 44 questions";
    return (
      <div id="practice-top" className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">{all.length} questions in two rounds of 8</p>
          <p className="mt-1 text-sm text-muted-foreground">Each round goes easy, medium, hard, very hard, two of each.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm font-semibold" role="group" aria-label="Round">
              {[0, 1].map((r) => (
                <button key={r} type="button" onClick={() => setRound(r)} className={cn("rounded-md px-3 py-1.5", round === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  Round {r + 1}
                </button>
              ))}
            </div>
            {modeToggle}
          </div>
          <button type="button" onClick={() => start()} className="mt-5 h-11 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground sm:w-auto">
            Start practice
          </button>
        </div>
        <details className="rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed">
          <summary className="cursor-pointer font-semibold">How the clock works</summary>
          <p className="mt-3">On the real SAT you have about <b>{fmt(secondsPerQuestion(section))}</b> for each question ({minutes}). The clock here counts down from that time.</p>
          <p className="mt-2">Seconds you do not use move to the next question. Prefer no clock? Choose <b>Free</b>. Speed comes after you understand.</p>
        </details>
        <OfficialLinks section={section} />
      </div>
    );
  }

  if (stage === "result") {
    const correct = results.filter((r) => r.ok).length;
    const perfect = correct === results.length;
    const byLevel: Record<string, [number, number]> = {};
    for (const r of results) {
      byLevel[r.level] = byLevel[r.level] ?? [0, 0];
      byLevel[r.level][1]++;
      if (r.ok) byLevel[r.level][0]++;
    }
    const total = results.reduce((a, r) => a + (r.used ?? 0), 0);
    return (
      <div id="practice-top" className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-4xl" aria-hidden>{perfect ? "🏆" : correct >= 5 ? "👏" : "💪"}</p>
        <h3 className="mt-2 text-xl font-bold">{perfect ? "Perfect score!" : correct >= 5 ? "Well done!" : "Good work. Keep going."}</h3>
        <p className="mt-1 text-lg">You got <b>{correct} of {results.length}</b> right.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          {["easy", "medium", "hard", "very hard"].map((l) => (
            <span key={l} className={cn("rounded-full px-3 py-1 font-semibold", LEVEL_STYLE[l])}>
              {l}: {byLevel[l] ? `${byLevel[l][0]}/${byLevel[l][1]}` : "0/0"}
            </span>
          ))}
        </div>
        {timed && <p className="mt-3 text-sm text-muted-foreground">Total time {fmt(total)}, about {fmt(total / results.length)} a question.</p>}
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {perfect ? "Mark this lesson as done and open the next one." : "Read the explanations again, look at the cheat codes, and try once more. Correct first, then fast."}
        </p>
        {userId && !perfect && <p className="mt-2 text-sm">The questions you missed are in your <Link to="/me" className="font-semibold text-primary underline">mistake notebook</Link>.</p>}
        {!userId && <p className="mt-2 text-sm"><Link to="/auth" className="font-semibold text-primary underline">Create a free account</Link> to keep your scores and get missed questions back later.</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => start(round)} className="h-10 rounded-lg border border-primary px-4 font-semibold text-primary">Try this round again</button>
          <button type="button" onClick={() => start(round === 0 ? 1 : 0)} className="h-10 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            {round === 0 ? "Start Round 2" : "Back to Round 1"}
          </button>
        </div>
      </div>
    );
  }

  // A question
  const codes = props.universal.filter((u) => u.apply.some((a) => a.skill === slug && a.q === q.position));
  const pct = timed && allow.current ? (100 * left) / allow.current : 0;
  return (
    <div id="practice-top" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
        <span>Round {round + 1} · Question {i + 1} of {set.length}</span>
        <span className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs", LEVEL_STYLE[q.level])}>{q.level}</span>
          {modeToggle}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-primary transition-all" style={{ width: `${(100 * (i + (locked ? 1 : 0))) / set.length}%` }} />
      </div>
      {timed && !locked && (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className={cn("font-mono text-lg font-bold tabular-nums", left <= 15 && "text-destructive")}>{fmt(left)}</span>
            {allow.current > secondsPerQuestion(section) && <span className="text-muted-foreground">includes +{fmt(allow.current - secondsPerQuestion(section))} saved</span>}
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-amber-500" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <QuestionBody q={q} lang={props.lang} />

      <div className="space-y-2" role="group" aria-label="Answer options">
        {q.options.map((o, k) => {
          const isRight = check && check.answer === k;
          const isWrongPick = check && picked === k && !check.correct;
          return (
            <button
              key={k}
              type="button"
              disabled={locked}
              onClick={() => answer(k)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-[1.5px] bg-card px-4 py-3 text-left text-[15px] transition",
                !locked && "hover:border-primary",
                isRight && "border-emerald-600 bg-emerald-50",
                isWrongPick && "border-rose-600 bg-rose-50",
                !check && picked === k && "border-primary bg-secondary",
              )}
            >
              <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-full border-[1.5px] text-sm font-bold text-muted-foreground",
                isRight && "border-emerald-600 bg-emerald-600 text-white",
                isWrongPick && "border-rose-600 bg-rose-600 text-white")}>
                {letter(k)}
              </span>
              <span className="flex-1">{o}</span>
              {isRight && <span className="text-sm font-bold text-emerald-700">Correct</span>}
              {isWrongPick && <span className="text-sm font-bold text-rose-700">Your answer</span>}
              {checking && picked === k && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
          );
        })}
      </div>

      {(check || timeUp) && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 text-[15px] leading-relaxed">
            <b>{timeUp ? "Time is up. " : check?.correct ? "Correct! " : "Not quite. "}</b>
            {check && <>The answer is <b>{letter(check.answer)}</b>. {pick(props.lang, check.why, check.why_rw)}</>}
            {codes.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                A cheat code that helps here:{" "}
                {codes.map((c, n) => (
                  <span key={c.id}>{n > 0 && ", "}<Link to="/codes/$id" params={{ id: c.id }} className="font-semibold text-primary underline">{c.name}</Link></span>
                ))}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={next} className="h-11 flex-1 rounded-xl bg-primary px-5 font-bold text-primary-foreground sm:flex-none">
              {i === set.length - 1 ? "See my result" : "Next question"}
            </button>
            <Link to="/forum" className="h-11 rounded-xl border border-primary px-4 font-semibold leading-[44px] text-primary">Ask the forum</Link>
            <button type="button" onClick={() => setReporting((v) => !v)} className="ml-auto flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <Flag className="h-4 w-4" /> Report a problem
            </button>
          </div>
          {reporting && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              {userId ? (
                <>
                  <label className="text-sm font-semibold" htmlFor="report">What is wrong with this question?</label>
                  <textarea id="report" value={reportText} onChange={(e) => setReportText(e.target.value)} maxLength={600} rows={3}
                    className="mt-2 w-full rounded-lg border border-border bg-white p-2 text-sm" placeholder="For example: I think the answer should be C, because…" />
                  <button type="button" onClick={sendReport} disabled={reportText.trim().length < 3} className="mt-2 h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Send to Aime</button>
                </>
              ) : (
                <p className="text-sm"><Link to="/auth" className="font-semibold text-primary underline">Sign in</Link> to report a problem, so Aime can reply to you.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OfficialLinks({ section }: { section: Section }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed">
      <p className="font-semibold">Want official test questions too?</p>
      <p className="mt-1 text-muted-foreground">These questions are written in the style of the Digital SAT. For questions by College Board, use their free tools:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><a className="font-semibold text-primary underline" href="https://satsuitequestionbank.collegeboard.org" target="_blank" rel="noopener noreferrer">College Board Question Bank</a> (choose {section === "rw" ? "Reading and Writing" : "Math"})</li>
        <li><a className="font-semibold text-primary underline" href="https://bluebook.collegeboard.org" target="_blank" rel="noopener noreferrer">Bluebook full-length practice tests</a></li>
        <li><a className="font-semibold text-primary underline" href="https://www.khanacademy.org/test-prep/sat" target="_blank" rel="noopener noreferrer">Official Digital SAT Prep on Khan Academy</a></li>
      </ul>
    </div>
  );
}
