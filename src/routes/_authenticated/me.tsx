// tr("Me"): estimated score, weakest parts, mistake notebook, and account settings.
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, setLanguage, LANGUAGES } from "@/lib/i18n";
import { tr } from "@/lib/i18n/tr";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/me")({
  validateSearch: (s: Record<string, unknown>): { code?: string } => (typeof s.code === "string" ? { code: s.code } : {}),
  head: () => ({ meta: [{ title: "Me | Imboni SAT Hub" }, { name: "robots", content: "noindex" }] }),
  component: Me,
});

interface Estimate {
  sections: Record<string, { answered: number; score: number | null }>;
  domains: { domain: string; mastery: number; answered: number }[];
}

function Me() {
  const { user } = Route.useRouteContext();
  const { language } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const profile = useQuery({
    queryKey: ["me-profile", user.id],
    queryFn: async () => {
      const [{ data: p }, { data: pp }] = await Promise.all([
        db.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        db.from("profile_private").select("target_score, test_date, daily_minutes, reminder_opt_in, school").eq("id", user.id).maybeSingle(),
      ]);
      return { name: p?.display_name ?? "", ...(pp ?? {}) } as {
        name: string; target_score?: number | null; test_date?: string | null; daily_minutes?: number | null; reminder_opt_in?: boolean; school?: string | null;
      };
    },
  });
  const estimate = useQuery({
    queryKey: ["me-estimate", user.id],
    queryFn: async (): Promise<Estimate> => {
      const { data } = await db.rpc("my_score_estimate");
      return data ?? { sections: {}, domains: [] };
    },
  });
  const review = useQuery({
    queryKey: ["me-review", user.id],
    queryFn: async () => {
      const { data } = await db.rpc("my_review_questions", { _limit: 100 });
      const list = (data ?? []) as { due_at: string }[];
      return { total: list.length, due: list.filter((r) => Date.parse(r.due_at) <= Date.now()).length };
    },
  });
  const weakest = useQuery({
    queryKey: ["me-weakest", user.id],
    queryFn: async () => {
      const { data } = await db.from("skill_mastery").select("mastery, attempts, skills(slug, name_en)").gte("attempts", 3).order("mastery").limit(3);
      return (data ?? []).filter((r: { skills: { slug: string | null } }) => r.skills?.slug) as { mastery: number; attempts: number; skills: { slug: string; name_en: string } }[];
    },
  });

  const [edit, setEdit] = useState(false);
  const { code } = Route.useSearch();
  const [classCode, setClassCode] = useState(code ?? "");
  const assignments = useQuery({
    queryKey: ["me-assignments", user.id],
    queryFn: async () => {
      const { data } = await db.rpc("my_assignments");
      return (data ?? []) as { class_name: string; lesson_slug: string; lesson_name: string; due_date: string | null; done: boolean; score: number | null; total: number | null }[];
    },
  });
  const tests = useQuery({
    queryKey: ["me-tests", user.id],
    queryFn: async () => {
      const { data } = await db.from("practice_tests").select("section, score, created_at").order("created_at", { ascending: false }).limit(6);
      return (data ?? []) as { section: string; score: number; created_at: string }[];
    },
  });

  const est = estimate.data;
  const rw = est?.sections.rw;
  const m = est?.sections.m;
  const total = rw?.score && m?.score ? rw.score + m.score : null;
  const answered = (rw?.answered ?? 0) + (m?.answered ?? 0);
  const days = profile.data?.test_date ? Math.ceil((Date.parse(profile.data.test_date) - Date.now()) / 86_400_000) : null;

  const joinClass = async () => {
    const { error } = await db.rpc("join_cohort", { _code: classCode.trim().toUpperCase() });
    if (error) toast.error("That code did not work. Check it with your teacher.");
    else {
      toast.success("You joined the class.");
      setClassCode("");
      void assignments.refetch();
    }
  };
  const download = async () => {
    const { data, error } = await db.rpc("my_data_export");
    if (error) return toast.error("Could not prepare your data. Try again.");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "my-imboni-data.json" });
    a.click();
    URL.revokeObjectURL(url);
  };
  const remove = async () => {
    if (!window.confirm("Delete your account and all your progress? This cannot be undone.")) return;
    const { error } = await db.rpc("delete_my_account");
    if (error) return toast.error(error.message);
    await supabase.auth.signOut();
    toast.success("Your account was deleted.");
    navigate({ to: "/learn" });
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/learn" });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{tr("My progress")}</p>

      <div className="mt-2 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{tr("Estimated score")}</p>
            <p className="text-4xl font-bold tracking-tight">{total ?? "—"}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Goal · {profile.data?.target_score ?? "not set"}</p>
            <p>{days !== null ? (days >= 0 ? `Test day in ${days} days` : "Test date passed") : "Test date not set"}</p>
          </div>
        </div>
        {[["rw", tr("Reading and Writing"), rw], ["m", tr("Math"), m]].map(([k, label, s]) => {
          const sec = s as { answered: number; score: number | null } | undefined;
          return (
            <div key={k as string} className="mt-4">
              <div className="flex justify-between text-sm"><b>{label as string}</b><span className="text-muted-foreground">{sec?.score ? `${sec.score} / 800` : `${sec?.answered ?? 0} of 16 answers needed`}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${sec?.score ? ((sec.score - 200) / 600) * 100 : 0}%` }} /></div>
            </div>
          );
        })}
        <p className="mt-3 text-xs text-muted-foreground">A rough estimate from {answered} answers on the Hub, weighted by how much of the test each part is. It is not an official score. Bluebook practice tests give the closest one.</p>
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-card p-5">
        <b>{tr("Weakest parts")}</b>
        {!weakest.data?.length && <p className="mt-1 text-sm text-muted-foreground">{tr("Answer a few questions in any lesson and your weakest parts show here.")}</p>}
        {weakest.data?.map((w) => (
          <div key={w.skills.slug} className="flex items-center gap-3 border-t border-border py-3 first-of-type:border-0">
            <span className="flex-1 text-[15px]">{w.skills.name_en}<span className="block text-xs text-muted-foreground">{Math.round(w.mastery * 100)}% mastery after {w.attempts} answers</span></span>
            <Link to="/learn/$slug" params={{ slug: w.skills.slug }} search={{ tab: "practice" }} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold leading-9 text-primary-foreground">{tr("Practise")}</Link>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-rose-50 font-bold text-rose-700">{review.data?.total ?? 0}</span>
        <span className="flex-1"><b className="block">{tr("Mistake notebook")}</b><span className="text-sm text-muted-foreground">{review.data?.total ? `${review.data.due} due today. Each question comes back until you get it right twice.` : "Questions you miss come back here until you get them right."}</span></span>
        {review.data?.due ? <Link to="/review" className="h-10 rounded-lg bg-primary px-4 font-semibold leading-10 text-primary-foreground">{tr("Review")}</Link> : null}
      </div>

      {!!assignments.data?.length && (
        <div className="mt-3 rounded-2xl border border-border bg-card p-5">
          <b>{tr("From my teacher")}</b>
          {assignments.data.map((a) => (
            <Link key={a.class_name + a.lesson_slug} to="/learn/$slug" params={{ slug: a.lesson_slug }} search={{ tab: "practice" }} className="flex items-center gap-3 border-t border-border py-3 first-of-type:border-0">
              <span className="flex-1 text-[15px]">{a.lesson_name}<span className="block text-xs text-muted-foreground">{a.class_name}{a.due_date ? ` · due ${a.due_date}` : ""}</span></span>
              <span className="text-sm font-semibold text-primary">{a.total ? `${a.score}/${a.total}` : tr("Start")}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between"><b>{tr("Full practice tests")}</b><Link to="/test" className="text-sm font-semibold text-primary underline">{tr("Take a test")}</Link></div>
        {!tests.data?.length ? <p className="mt-1 text-sm text-muted-foreground">{tr("Timed like test day, with an estimated score.")}</p> : (
          <div className="mt-2 flex flex-wrap gap-2">
            {tests.data.map((t) => <span key={t.created_at} className="rounded-lg bg-secondary px-3 py-1.5 text-sm"><b>{t.score}</b> {t.section === "rw" ? tr("Reading and Writing") : tr("Math")} · {new Date(t.created_at).toLocaleDateString()}</span>)}
          </div>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-xl font-bold">{tr("Account")}</h2>
      <div className="rounded-2xl border border-border bg-card p-2">
        {edit ? (
          <ProfileForm userId={user.id} initial={profile.data} onDone={() => { setEdit(false); void qc.invalidateQueries({ queryKey: ["me-profile", user.id] }); }} />
        ) : (
          <>
            <Row label="Name" value={profile.data?.name || "—"} />
            <Row label="Email" value={user.email ?? ""} />
            <Row label="Test date and goal" value={`${profile.data?.test_date ?? "Not set"} · ${profile.data?.target_score ?? "no goal"}`} />
            <Row label="Daily time" value={profile.data?.daily_minutes ? `${profile.data.daily_minutes} minutes` : "Not set"} />
            <button type="button" onClick={() => setEdit(true)} className="m-2 h-9 rounded-lg border border-primary px-4 text-sm font-semibold text-primary">{tr("Edit")}</button>
          </>
        )}
        <div className="flex items-center gap-3 border-t border-border p-3">
          <span className="flex-1 text-[15px]">{tr("Language")}</span>
          <div className="flex rounded-lg border border-border p-0.5 text-sm font-semibold">
            {LANGUAGES.map((l) => (
              <button key={l.code} type="button" onClick={() => setLanguage(l.code)} className={language === l.code ? "rounded-md bg-primary px-3 py-1 text-primary-foreground" : "px-3 py-1 text-muted-foreground"}>{l.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-card p-4">
        <b>{tr("My class")}</b>
        <p className="text-sm text-muted-foreground">{tr("Your teacher can give you a code to join their class.")}</p>
        <div className="mt-2 flex gap-2">
          <input value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder="Class code" className="h-10 flex-1 rounded-lg border border-border px-3 uppercase" aria-label="Class code" />
          <button type="button" onClick={joinClass} disabled={classCode.trim().length < 6} className="h-10 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{tr("Join")}</button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-card p-2">
        <Link to="/tutors" className="block rounded-lg p-3 text-[15px] hover:bg-secondary">{tr("Become a tutor")}<span className="block text-xs text-muted-foreground">{tr("Answer questions in the community")}</span></Link>
        <button type="button" onClick={download} className="block w-full rounded-lg p-3 text-left text-[15px] hover:bg-secondary">{tr("Download my data")}<span className="block text-xs text-muted-foreground">{tr("Everything the Hub stores about you, as a file")}</span></button>
      </div>

      <button type="button" onClick={signOut} className="mt-4 h-11 w-full rounded-xl border border-primary font-semibold text-primary">{tr("Sign out")}</button>
      <button type="button" onClick={remove} className="mt-3 w-full py-2 text-center text-sm font-bold text-destructive">{tr("Delete my account")}</button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="flex-1 text-[15px]">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  );
}

export function ProfileForm({ userId, initial, onDone }: {
  userId: string;
  initial?: { name?: string; target_score?: number | null; test_date?: string | null; daily_minutes?: number | null };
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [goal, setGoal] = useState(String(initial?.target_score ?? ""));
  const [date, setDate] = useState(initial?.test_date ?? "");
  const [minutes, setMinutes] = useState(String(initial?.daily_minutes ?? ""));
  const save = async () => {
    const g = goal ? Math.min(1600, Math.max(400, Math.round(+goal / 10) * 10)) : null;
    const [a, b] = await Promise.all([
      db.from("profiles").update({ display_name: name.trim() || "Student" }).eq("id", userId),
      db.from("profile_private").upsert({ id: userId, target_score: g, test_date: date || null, daily_minutes: minutes ? +minutes : null, onboarded_at: new Date().toISOString() }),
    ]);
    if (a.error || b.error) return toast.error("Could not save. Try again.");
    toast.success("Saved.");
    onDone();
  };
  const field = "mt-1 h-10 w-full rounded-lg border border-border bg-white px-3";
  return (
    <div className="space-y-3 p-3">
      <label className="block text-sm font-semibold">{tr("Name")}<input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block text-sm font-semibold">{tr("Goal score")}<input className={field} inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, ""))} placeholder="1400" /></label>
      <label className="block text-sm font-semibold">{tr("Test date")}<input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="block text-sm font-semibold">{tr("Minutes a day")}<input className={field} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="30" /></label>
      <button type="button" onClick={save} className="h-10 rounded-lg bg-primary px-5 font-semibold text-primary-foreground">{tr("Save")}</button>
    </div>
  );
}
