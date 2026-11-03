import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Flame, RotateCcw, Target, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, localized } from "@/lib/i18n";
import { hasReliableMastery, toPercent } from "@/lib/learning/engine";
import { learningDb } from "@/lib/learning/db";
import { loadOrBuildTodayPlan, streakFromAttempts } from "@/lib/learning/plan";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Today | Imboni SAT Hub" }] }),
  component: Today,
});

const STREAK_LOOKBACK_DAYS = 60;

function Today() {
  const { user } = Route.useRouteContext();
  const { t } = useI18n();

  const { data: profile } = useQuery({
    queryKey: ["learning-profile", user.id],
    queryFn: async () => {
      const { data } = await learningDb
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const plan = useQuery({
    queryKey: ["today-plan", user.id],
    queryFn: () => loadOrBuildTodayPlan(user.id),
  });

  const { data: streak = 0 } = useQuery({
    queryKey: ["streak", user.id],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - STREAK_LOOKBACK_DAYS);
      const { data } = await learningDb
        .from("attempts")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString());
      return streakFromAttempts((data ?? []).map((a) => a.created_at));
    },
  });

  const items = plan.data?.items ?? [];
  const done = Math.min(plan.data?.completed_count ?? 0, items.length);
  const count = (kind: string) => items.filter((item) => item.kind === kind).length;
  const reviews = count("review");
  const weak = count("weak");
  const stretch = count("stretch");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t("today.greeting", { name: profile?.display_name ?? "" }).replace(/, $/, "")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("today.subtitle")}</p>

      <JoinCard userId={user.id} />

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        {plan.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

        {plan.isError && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("today.loadFailed")}</p>
            <Button variant="outline" size="sm" onClick={() => plan.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {plan.data && items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("today.empty")}</p>
        )}

        {plan.data && items.length > 0 && (
          <>
            <div className="flex items-center gap-5">
              <ProgressRing done={done} total={items.length} />
              <div>
                <p className="font-medium">{t("today.progress", { done, total: items.length })}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Flame className="h-4 w-4" /> {t("today.streak", { days: streak })}
                </p>
              </div>
            </div>

            <ul className="mt-5 grid gap-3">
              {reviews > 0 && (
                <PlanRow
                  icon={RotateCcw}
                  title={t("today.reviews", { count: reviews })}
                  hint={t("today.reviewsHint")}
                />
              )}
              {weak > 0 && (
                <PlanRow
                  icon={Target}
                  title={t("today.weak", { count: weak })}
                  hint={t("today.weakHint")}
                />
              )}
              {stretch > 0 && (
                <PlanRow
                  icon={TrendingUp}
                  title={t("today.stretch")}
                  hint={t("today.stretchHint")}
                />
              )}
            </ul>

            {done >= items.length ? (
              <p className="mt-5 text-sm font-medium">{t("today.done")}</p>
            ) : (
              <Button size="lg" className="mt-5 w-full" asChild>
                <Link to="/practice">
                  {done === 0 ? t("today.start") : t("today.continue")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
          </>
        )}
      </section>

      <MasteryList userId={user.id} />
    </div>
  );
}

function PlanRow(props: { icon: typeof Target; title: string; hint: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <props.icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{props.title}</p>
        <p className="text-xs text-muted-foreground">{props.hint}</p>
      </div>
    </li>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const share = total === 0 ? 0 : done / total;
  return (
    <svg viewBox="0 0 76 76" className="h-[76px] w-[76px] shrink-0" aria-hidden="true">
      <circle cx="38" cy="38" r={radius} fill="none" strokeWidth="8" className="stroke-muted" />
      <circle
        cx="38"
        cy="38"
        r={radius}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${share * circumference} ${circumference}`}
        transform="rotate(-90 38 38)"
        className="stroke-primary"
      />
      <text x="38" y="43" textAnchor="middle" className="fill-foreground text-sm font-semibold">
        {done}/{total}
      </text>
    </svg>
  );
}

function JoinCard({ userId }: { userId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const { data: cohorts } = useQuery({
    queryKey: ["my-cohorts", userId],
    queryFn: async () => {
      const { data: memberships, error } = await learningDb
        .from("cohort_members")
        .select("cohort_id")
        .eq("student_id", userId);
      if (error) throw new Error(error.message);
      if (memberships.length === 0) return [];
      const { data } = await learningDb
        .from("cohorts")
        .select("id, name")
        .in(
          "id",
          memberships.map((m) => m.cohort_id),
        );
      return data ?? [];
    },
  });

  // Unknown until the query settles (or if it fails): show nothing rather
  // than asking a student who has already joined to join again.
  if (!cohorts) return null;

  if (cohorts.length > 0) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        {t("join.member", { name: cohorts.map((c) => c.name).join(", ") })}
      </p>
    );
  }

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || joining) return;
    setJoining(true);
    const { data: cohortId, error } = await learningDb.rpc("join_cohort", { _code: trimmed });
    setJoining(false);
    if (error || !cohortId) {
      toast.error(t("join.notFound"));
      return;
    }
    const { data: cohort } = await learningDb
      .from("cohorts")
      .select("name")
      .eq("id", cohortId)
      .maybeSingle();
    toast.success(t("join.success", { name: cohort?.name ?? trimmed.toUpperCase() }));
    setCode("");
    queryClient.invalidateQueries({ queryKey: ["my-cohorts", userId] });
  };

  return (
    <form onSubmit={join} className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold">{t("join.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("join.hint")}</p>
      <div className="mt-3 flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t("join.placeholder")}
          aria-label={t("join.placeholder")}
          autoCapitalize="characters"
          autoComplete="off"
          className="uppercase"
        />
        <Button type="submit" disabled={joining || !code.trim()}>
          {t("join.button")}
        </Button>
      </div>
    </form>
  );
}

function MasteryList({ userId }: { userId: string }) {
  const { t, language } = useI18n();

  const { data: rows = [] } = useQuery({
    queryKey: ["mastery", userId],
    queryFn: async () => {
      const [mastery, skills] = await Promise.all([
        learningDb
          .from("skill_mastery")
          .select("skill_id, mastery, attempts")
          .eq("user_id", userId),
        learningDb.from("skills").select("id, name_en, name_rw"),
      ]);
      const skillById = new Map((skills.data ?? []).map((skill) => [skill.id, skill]));
      return (mastery.data ?? []).flatMap((row) => {
        const skill = skillById.get(row.skill_id);
        return skill ? [{ ...row, mastery: Number(row.mastery), skill }] : [];
      });
    },
  });

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold">{t("mastery.title")}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("mastery.none")}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {rows.map((row) => (
            <li key={row.skill_id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">
                  {localized(language, row.skill.name_en, row.skill.name_rw)}
                </span>
                <span className="text-muted-foreground">
                  {hasReliableMastery(row) ? `${toPercent(row.mastery)}%` : t("mastery.early")}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${toPercent(row.mastery)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
