import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, MessageSquare, TrendingUp, BookOpen } from "lucide-react";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact | Imboni SAT Hub" },
      { name: "description", content: "What the Imboni SAT Hub community has built so far: students learning, questions answered and lessons shared." },
      { property: "og:title", content: "Impact | Imboni SAT Hub" },
      { property: "og:description", content: "Real numbers from the Imboni SAT Hub community in Kigali and beyond." },
      { property: "og:url", content: "https://sat.imboniacademy.org/impact" },
    ],
    links: [{ rel: "canonical", href: "https://sat.imboniacademy.org/impact" }],
  }),
  component: ImpactPage,
});

// A number is only shown once it is big enough to mean something.
const MIN_TO_SHOW = 10;

function ImpactPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["impact"],
    queryFn: async () => {
      const [scholars, posts, replies, comments, avgRpc] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("forum_posts").select("*", { count: "exact", head: true }),
        supabase.from("forum_replies").select("*", { count: "exact", head: true }),
        supabase.from("resource_comments").select("*", { count: "exact", head: true }),
        supabase.rpc("get_avg_score_improvement"),
      ]);

      // Only real data: no made-up average when students have not reported scores.
      const avg = typeof avgRpc.data === "number" && avgRpc.data > 0 ? Math.round(avgRpc.data) : null;

      return {
        scholars: scholars.count ?? 0,
        peerSolutions: (posts.count ?? 0) + (replies.count ?? 0) + (comments.count ?? 0),
        avgImprovement: avg,
      };
    },
  });

  const metrics = [
    {
      icon: Users,
      label: "Students learning",
      value: data && data.scholars >= MIN_TO_SHOW ? data.scholars.toLocaleString() : null,
      sub: "Free accounts on the Hub",
      accent: "text-primary",
    },
    {
      icon: MessageSquare,
      label: "Answers shared",
      value: data && data.peerSolutions >= MIN_TO_SHOW ? data.peerSolutions.toLocaleString() : null,
      sub: "Forum questions, replies and comments",
      accent: "text-primary",
    },
    {
      icon: TrendingUp,
      label: "Average score increase",
      value: data?.avgImprovement ? `+${data.avgImprovement}` : null,
      sub: "From scores students reported before and after",
      accent: "text-success",
    },
  ].filter((m) => m.value !== null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Impact</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">What we are building together</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          The Hub is free. These numbers come straight from the site and update on their own.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-12 text-muted-foreground">Loading…</p>
      ) : metrics.length > 0 ? (
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-8 shadow-card">
              <m.icon className={`h-6 w-6 ${m.accent}`} />
              <p className="mt-6 font-display text-5xl font-bold tracking-tight">{m.value}</p>
              <p className="mt-3 text-sm font-medium text-foreground">{m.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.sub}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-2xl border border-dashed border-border-strong bg-card p-8">
          <p className="font-medium text-foreground">We are just getting started.</p>
          <p className="mt-1 text-muted-foreground">Numbers will appear here as more students join and share answers.</p>
        </div>
      )}

      <div className="mt-14 rounded-2xl border border-border bg-surface-elevated p-8 sm:p-12">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">Why the Hub is free</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Many students in Rwanda cannot pay for an SAT course. I started Imboni so that anyone who wants to study has
          lessons, practice and people to ask, at no cost. Aime Pascal, founder of Imboni Academy.
        </p>
      </div>
    </div>
  );
}
