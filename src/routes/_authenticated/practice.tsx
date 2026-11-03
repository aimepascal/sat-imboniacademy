import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n, localized } from "@/lib/i18n";
import { explainDifferently, type AiExplainResult } from "@/lib/ai-explain.functions";
import { learningDb, type AttemptInput, type Question } from "@/lib/learning/db";
import { loadOrBuildTodayPlan } from "@/lib/learning/plan";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice | Imboni SAT Hub" }] }),
  component: Practice,
});

const letter = (index: number) => String.fromCharCode(65 + index);

function Practice() {
  const { user } = Route.useRouteContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const session = useQuery({
    queryKey: ["practice-session", user.id],
    // The plan is read once per visit; progress is then tracked locally.
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      const plan = await loadOrBuildTodayPlan(user.id);
      const ids = plan.items.map((item) => item.questionId);
      if (ids.length === 0) return { plan, questions: new Map<string, Question>(), lookups: null };

      // Only approved questions come back, whatever the plan says.
      const { data: questions, error } = await learningDb
        .from("questions")
        .select("*")
        .in("id", ids)
        .eq("status", "approved");
      if (error) throw new Error(error.message);

      const [skills, misconceptions] = await Promise.all([
        learningDb.from("skills").select("id, name_en, name_rw"),
        learningDb.from("misconceptions").select("id, label_en, label_rw"),
      ]);
      return {
        plan,
        questions: new Map(questions.map((question) => [question.id, question])),
        lookups: {
          skills: new Map((skills.data ?? []).map((skill) => [skill.id, skill])),
          misconceptions: new Map((misconceptions.data ?? []).map((m) => [m.id, m])),
        },
      };
    },
  });

  // Position in the plan. Starts where the student left off.
  const [position, setPosition] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState({ answered: 0, correct: 0 });

  useEffect(() => {
    if (session.data && position === null) setPosition(session.data.plan.completed_count);
  }, [session.data, position]);

  if (session.isLoading || (session.data && position === null)) {
    return <Shell>{t("common.loading")}</Shell>;
  }
  if (session.isError || !session.data || position === null) {
    return (
      <Shell>
        <p>{t("today.loadFailed")}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => session.refetch()}>
          {t("common.retry")}
        </Button>
      </Shell>
    );
  }

  const { plan, questions, lookups } = session.data;

  // Skip plan items whose question is no longer approved.
  let current = position;
  while (current < plan.items.length && !questions.has(plan.items[current].questionId)) {
    current += 1;
  }
  const item = plan.items[current];
  const question = item ? questions.get(item.questionId) : undefined;

  if (!item || !question || !lookups) {
    return (
      <Shell>
        {sessionStats.answered > 0 ? (
          <>
            <h1 className="font-display text-2xl font-semibold">{t("practice.finishedTitle")}</h1>
            <p className="mt-2 text-muted-foreground">
              {t("practice.finishedBody", {
                correct: sessionStats.correct,
                total: sessionStats.answered,
              })}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            {plan.items.length === 0 ? t("today.empty") : t("today.done")}
          </p>
        )}
        <Button className="mt-5" asChild>
          <Link to="/today">{t("practice.backToToday")}</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <QuestionCard
      // Remounts for each question, which resets the answer and AI state.
      key={question.id}
      question={question}
      skill={lookups.skills.get(question.skill_id)}
      misconceptions={lookups.misconceptions}
      mode={item.kind === "review" ? "review" : "practice"}
      current={current + 1}
      total={plan.items.length}
      onSaved={async (correct) => {
        setSessionStats((stats) => ({
          answered: stats.answered + 1,
          correct: stats.correct + (correct ? 1 : 0),
        }));
        // Best effort: the attempt itself is already saved, this only moves
        // the plan's bookmark.
        await learningDb
          .from("daily_plans")
          .update({ completed_count: current + 1 })
          .eq("user_id", user.id)
          .eq("plan_date", plan.plan_date);
        queryClient.invalidateQueries({ queryKey: ["today-plan", user.id] });
        queryClient.invalidateQueries({ queryKey: ["mastery", user.id] });
        queryClient.invalidateQueries({ queryKey: ["streak", user.id] });
      }}
      onNext={() => setPosition(current + 1)}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-4 py-10 text-sm sm:px-6">{children}</div>;
}

type QuestionCardProps = {
  question: Question;
  skill: { name_en: string; name_rw: string | null } | undefined;
  misconceptions: Map<string, { label_en: string; label_rw: string | null }>;
  mode: AttemptInput["mode"];
  current: number;
  total: number;
  onSaved: (correct: boolean) => Promise<void>;
  onNext: () => void;
};

function QuestionCard(props: QuestionCardProps) {
  const { question } = props;
  const { t, language } = useI18n();
  const askAi = useServerFn(explainDifferently);

  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"answering" | "saving" | "answered">("answering");
  const [ai, setAi] = useState<"loading" | AiExplainResult | null>(null);

  const startedAt = useRef(Date.now());
  // Created once per question, so pressing "Check answer" again after a failed
  // save sends the same attempt and the server counts it once.
  const attempt = useRef<AttemptInput | null>(null);

  const answered = phase === "answered";
  const correctIndex = question.options.findIndex((option) => option.is_correct);
  const wasCorrect = answered && selected === correctIndex;

  const check = async () => {
    if (selected === null || phase !== "answering") return;
    attempt.current ??= {
      id: crypto.randomUUID(),
      question_id: question.id,
      option_index: selected,
      time_ms: Date.now() - startedAt.current,
      mode: props.mode,
      created_at: new Date().toISOString(),
    };
    setPhase("saving");
    const { error } = await learningDb.rpc("submit_attempts", { _batch: [attempt.current] });
    if (error) {
      toast.error(t("practice.saveFailed"));
      setPhase("answering");
      return;
    }
    setPhase("answered");
    await props.onSaved(selected === correctIndex);
  };

  const explain = async () => {
    if (selected === null || ai === "loading") return;
    setAi("loading");
    try {
      setAi(await askAi({ data: { questionId: question.id, optionIndex: selected, language } }));
    } catch {
      setAi({ status: "unavailable" });
    }
  };

  const chosen = selected === null ? null : question.options[selected];
  const slip =
    answered && !wasCorrect && chosen?.misconception_id
      ? props.misconceptions.get(chosen.misconception_id)
      : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1 font-medium text-foreground">
          {props.skill ? localized(language, props.skill.name_en, props.skill.name_rw) : ""}
          {" · "}
          {t(`difficulty.${question.difficulty}`)}
        </span>
        <span>{t("practice.progress", { current: props.current, total: props.total })}</span>
      </div>

      <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed">{question.stem}</p>

      <div className="mt-5 grid gap-2.5" role="radiogroup">
        {question.options.map((option, index) => (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={selected === index}
            // Locked once an attempt exists, so the answer shown is the one that was sent.
            disabled={phase !== "answering" || attempt.current !== null}
            onClick={() => setSelected(index)}
            className={cn(
              "flex min-h-12 items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition",
              !answered && selected === index && "border-primary ring-2 ring-primary/30",
              answered && index === correctIndex && "border-success bg-success/10",
              answered &&
                index === selected &&
                index !== correctIndex &&
                "border-destructive bg-destructive/10",
            )}
          >
            <span className="font-semibold">{letter(index)}</span>
            <span className="whitespace-pre-wrap">{option.text}</span>
          </button>
        ))}
      </div>

      {!answered && (
        <Button
          size="lg"
          className="mt-5 w-full"
          disabled={selected === null || phase === "saving"}
          onClick={check}
        >
          {phase === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("practice.check")}
        </Button>
      )}

      {answered && (
        <>
          <p
            className={cn(
              "mt-5 text-sm font-semibold",
              wasCorrect ? "text-success" : "text-destructive",
            )}
            role="status"
          >
            {wasCorrect ? t("practice.correct") : t("practice.incorrect")}
          </p>

          {/* The reviewed explanation always comes first and never depends on the AI. */}
          <section className="mt-3 rounded-2xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{t("practice.explanation")}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium">
                <BadgeCheck className="h-3.5 w-3.5" /> {t("practice.approved")}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {localized(language, question.explanation_en, question.explanation_rw)}
            </p>
            {slip && chosen && (
              <p className="mt-3 rounded-lg border border-border bg-card p-3 text-sm">
                {t("practice.slip", {
                  choice: chosen.text,
                  label: localized(language, slip.label_en, slip.label_rw),
                })}
              </p>
            )}
          </section>

          {ai !== null && (
            <section className="mt-3 rounded-2xl border border-dashed border-border p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> {t("practice.aiHelp")}
              </h2>
              {ai === "loading" && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("practice.aiLoading")}
                </p>
              )}
              {ai !== "loading" && ai.status === "ok" && (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{ai.text}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{t("practice.aiNote")}</p>
                </>
              )}
              {ai !== "loading" && ai.status === "limited" && (
                <p className="mt-2 text-sm text-muted-foreground">{t("practice.aiLimited")}</p>
              )}
              {ai !== "loading" && ai.status === "unavailable" && (
                <p className="mt-2 text-sm text-muted-foreground">{t("practice.aiUnavailable")}</p>
              )}
            </section>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" className="flex-1" onClick={props.onNext}>
              {t("practice.gotIt")}
            </Button>
            {ai === null && (
              <Button size="lg" variant="outline" className="flex-1" onClick={explain}>
                {t("practice.explainDifferently")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
