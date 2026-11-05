// Teachers: their classes, a join code for each, assignments and student progress.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import { lessonIndexQuery } from "@/lib/content";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/classes")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s.id === "string" ? { id: s.id } : {}),
  head: () => ({ meta: [{ title: "My classes | Imboni SAT Hub" }, { name: "robots", content: "noindex" }] }),
  component: Classes,
});

interface Cohort { id: string; name: string; join_code: string; created_at: string }
interface Row { student_id: string; name: string; days_active: number; answered: number; accuracy: number | null; weakest: string | null; last_test: number | null; assignment_scores: Record<string, { score: number | null; total: number | null; done: boolean | null }> }

function Classes() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useSearch();
  const roles = useRoles(user.id);
  const canTeach = (roles.data ?? []).some((r: string) => r === "teacher" || r === "admin");
  const list = useQuery({
    queryKey: ["classes", user.id],
    queryFn: async () => {
      const { data, error } = await db.from("cohorts").select("id, name, join_code, created_at").eq("teacher_id", user.id).order("created_at");
      if (error) throw new Error(error.message);
      return data as Cohort[];
    },
  });
  const [name, setName] = useState("");
  const create = async () => {
    const { error } = await db.rpc("create_class", { _name: name });
    if (error) return toast.error(error.message);
    setName("");
    void list.refetch();
  };

  if (roles.isLoading) return <div className="mx-auto max-w-5xl px-4 py-8 text-muted-foreground">Loading…</div>;
  if (!canTeach)
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Classes are for teachers</h1>
        <p className="mt-2 text-muted-foreground">If you teach SAT, write to <a className="font-semibold text-primary underline" href="mailto:admin@imboniacademy.org">admin@imboniacademy.org</a> to get a teacher account. Students join a class with a code in <Link to="/me" className="font-semibold text-primary underline">Me</Link>.</p>
      </div>
    );

  const current = list.data?.find((c) => c.id === id) ?? list.data?.[0];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Teacher</p>
      <div className="mt-1 flex flex-wrap items-end gap-3">
        <h1 className="text-3xl font-bold tracking-tight">My classes</h1>
        <div className="ml-auto flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New class name, e.g. Senior 6 SAT" className="h-10 w-64 rounded-lg border border-border px-3" />
          <button type="button" disabled={name.trim().length < 2} onClick={create} className="h-10 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">Create</button>
        </div>
      </div>
      {list.data && !list.data.length && <p className="mt-6 text-muted-foreground">No classes yet. Create one, then share its join code with your students.</p>}
      {list.data && list.data.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {list.data.map((c) => <Link key={c.id} to="/classes" search={{ id: c.id }} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", c.id === current?.id ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{c.name}</Link>)}
        </div>
      )}
      {current && <ClassView cohort={current} />}
    </div>
  );
}

function ClassView({ cohort }: { cohort: Cohort }) {
  const lessons = useQuery(lessonIndexQuery);
  const rows = useQuery({
    queryKey: ["class-overview", cohort.id],
    queryFn: async () => {
      const { data, error } = await db.rpc("class_overview", { _cohort_id: cohort.id });
      if (error) throw new Error(error.message);
      return data as Row[];
    },
  });
  const assigned = useQuery({
    queryKey: ["class-assignments", cohort.id],
    queryFn: async () => {
      const { data } = await db.from("assignments").select("id, lesson_slug, due_date").eq("cohort_id", cohort.id).order("created_at", { ascending: false });
      return (data ?? []) as { id: string; lesson_slug: string; due_date: string | null }[];
    },
  });
  const [lesson, setLesson] = useState("");
  const [due, setDue] = useState("");
  const assign = async () => {
    const { error } = await db.from("assignments").insert({ cohort_id: cohort.id, lesson_slug: lesson, due_date: due || null });
    if (error) return toast.error(error.message);
    toast.success("Assigned. Students see it in Me.");
    setLesson("");
    void assigned.refetch();
    void rows.refetch();
  };
  const latest = assigned.data?.[0];
  const students = rows.data ?? [];
  const active = students.filter((s) => s.days_active > 0).length;
  const done = latest ? students.filter((s) => s.assignment_scores[latest.lesson_slug]?.total).length : 0;
  const name = (slug: string) => lessons.data?.find((l) => l.slug === slug)?.name ?? slug;
  const weakCount: Record<string, number> = {};
  for (const s of students) if (s.weakest) weakCount[s.weakest] = (weakCount[s.weakest] ?? 0) + 1;
  const classWeak = Object.entries(weakCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const invite = typeof window !== "undefined" ? `${window.location.origin}/me?code=${cohort.join_code}` : "";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">{cohort.name}</h2>
        <span className="rounded-lg bg-secondary px-3 py-1 font-mono text-lg font-bold tracking-widest">{cohort.join_code}</span>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(invite); toast.success("Invite link copied"); }} className="flex items-center gap-1 text-sm font-semibold text-primary"><Copy className="h-4 w-4" /> Copy invite link</button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Students open Me, type this code under “My class”, and join.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Students" value={students.length} />
        <Stat label="Active this week" value={active} />
        <Stat label={latest ? `Did ${name(latest.lesson_slug)}` : "Assignment done"} value={latest ? `${done} / ${students.length}` : "—"} />
        <Stat label="Class weakest part" value={classWeak ?? "—"} small />
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <label className="text-sm font-semibold">Assign a lesson
          <select value={lesson} onChange={(e) => setLesson(e.target.value)} className="mt-1 block h-10 w-64 rounded-lg border border-border bg-white px-2">
            <option value="">Choose…</option>
            {lessons.data?.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Due<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border px-2" /></label>
        <button type="button" disabled={!lesson} onClick={assign} className="h-10 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">Assign</button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr><th className="px-4 py-3">Student</th><th>Days this week</th><th>Answers</th><th>Right</th>{latest && <th>{name(latest.lesson_slug)}</th>}<th>Last test</th><th>Weakest part</th></tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const a = latest ? s.assignment_scores[latest.lesson_slug] : null;
              return (
                <tr key={s.student_id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td>{s.days_active}</td>
                  <td>{s.answered}</td>
                  <td>{s.accuracy !== null ? `${Math.round(s.accuracy * 100)}%` : "—"}</td>
                  {latest && <td>{a?.total ? `${a.score}/${a.total}` : "Not started"}</td>}
                  <td>{s.last_test ?? "—"}</td>
                  <td className="text-muted-foreground">{s.weakest ?? "—"}</td>
                </tr>
              );
            })}
            {!students.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No students yet. Share the code {cohort.join_code}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("font-bold", small ? "text-lg" : "text-3xl")}>{value}</p>
    </div>
  );
}
