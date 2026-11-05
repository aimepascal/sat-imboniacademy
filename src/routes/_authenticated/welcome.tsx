// First visit after sign-up: test date, goal and daily time, then the 10-minute check.
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({ meta: [{ title: "Welcome | Imboni SAT Hub" }, { name: "robots", content: "noindex" }] }),
  component: Welcome,
});

// The next international SAT dates: March, May, June, August, October, November, December.
function nextTestMonths(): { label: string; date: string }[] {
  const months = [2, 4, 5, 7, 9, 10, 11];
  const out: { label: string; date: string }[] = [];
  const now = new Date();
  for (let y = now.getFullYear(); out.length < 3; y++)
    for (const m of months) {
      // First Saturday of the month: a close guess, the student can change it in Me.
      const d = new Date(Date.UTC(y, m, 1));
      d.setUTCDate(1 + ((6 - d.getUTCDay() + 7) % 7));
      if (d > now && out.length < 3) out.push({ label: d.toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" }), date: d.toISOString().slice(0, 10) });
    }
  return out;
}

function Welcome() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const months = nextTestMonths();
  const [date, setDate] = useState<string | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(30);

  const save = async (skip = false) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("profile_private").upsert({
      id: user.id,
      onboarded_at: new Date().toISOString(),
      ...(skip ? {} : { test_date: date, target_score: goal, daily_minutes: minutes }),
    });
    if (error) toast.error("Could not save. You can set this later in Me.");
    navigate({ to: skip ? "/learn" : "/check" });
  };

  const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-[15px] font-semibold", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground");

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="flex justify-between text-sm font-semibold text-muted-foreground"><span>Set up your plan · 1 minute</span><button type="button" onClick={() => save(true)}>Skip</button></div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">When is your SAT?</h1>
      <p className="mt-1 text-muted-foreground">We use this to plan how much to study each day.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {months.map((m) => (
          <button key={m.date} type="button" onClick={() => setDate(m.date)} className={cn("rounded-2xl border bg-card p-4 text-left", date === m.date ? "border-2 border-primary bg-secondary" : "border-border")}>
            <b className="block">{m.label.split(" ")[0]}</b><span className="text-sm text-muted-foreground">{m.label.split(" ")[1]}</span>
          </button>
        ))}
        <button type="button" onClick={() => setDate(null)} className={cn("rounded-2xl border bg-card p-4 text-left", date === null ? "border-2 border-primary bg-secondary" : "border-border")}>
          <b className="block">Not booked yet</b><span className="text-sm text-muted-foreground">We plan 3 months</span>
        </button>
      </div>
      <h2 className="mb-2 mt-6 font-bold">Your goal score</h2>
      <div className="flex flex-wrap gap-2">{[1100, 1200, 1300, 1400, 1500].map((g) => <button key={g} type="button" onClick={() => setGoal(g)} className={chip(goal === g)}>{g === 1500 ? "1500+" : g}</button>)}</div>
      <h2 className="mb-2 mt-6 font-bold">Time you have each day</h2>
      <div className="flex flex-wrap gap-2">{[15, 30, 60, 120].map((m) => <button key={m} type="button" onClick={() => setMinutes(m)} className={chip(minutes === m)}>{m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? "s" : ""}`}</button>)}</div>
      <button type="button" onClick={() => save()} className="mt-8 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground">Next: 10-minute check</button>
    </div>
  );
}
