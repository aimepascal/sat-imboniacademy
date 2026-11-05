// Control Center: edit lessons, their 16 questions, and student reports.
// Lessons are saved to the lessons table; questions to the questions table.
// Kinyarwanda: each text can be written in content_rw; empty means "use English".
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { CheatCode, Lesson, LessonBlock, LessonContent, Video } from "@/lib/content";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const input = "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm";
const label = "mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground";

function useLessonList() {
  return useQuery({
    queryKey: ["admin-lessons"],
    queryFn: async () => {
      const { data, error } = await db.from("lessons").select("slug, name, domain_slug, sort, published, updated_at").order("sort");
      if (error) throw new Error(error.message);
      return data as { slug: string; name: string; domain_slug: string; sort: number; published: boolean; updated_at: string }[];
    },
  });
}

export function LessonsAdmin({ userId }: { userId: string }) {
  const list = useLessonList();
  const [slug, setSlug] = useState<string | null>(null);
  const [part, setPart] = useState<"text" | "questions" | "codes" | "videos">("text");
  const [lang, setLang] = useState<"en" | "rw">("en");

  useEffect(() => {
    if (!slug && list.data?.length) setSlug(list.data[0].slug);
  }, [list.data, slug]);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card p-2">
        {list.data?.map((l) => (
          <button key={l.slug} type="button" onClick={() => setSlug(l.slug)}
            className={cn("block w-full rounded-lg px-3 py-2 text-left text-sm", slug === l.slug ? "bg-secondary font-bold text-primary" : "hover:bg-muted", !l.published && "opacity-60")}>
            {l.name}{!l.published && " (hidden)"}
          </button>
        ))}
      </aside>
      {slug && (
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-4 border-b border-border">
              {(["text", "questions", "codes", "videos"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPart(p)} className={cn("border-b-[3px] pb-2 text-sm font-semibold capitalize", part === p ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
                  {p === "text" ? "Lesson text" : p === "codes" ? "Cheat codes" : p}
                </button>
              ))}
            </div>
            <div className="ml-auto flex rounded-lg border border-border p-0.5 text-sm font-semibold">
              {(["en", "rw"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} className={lang === l ? "rounded-md bg-primary px-3 py-1 text-primary-foreground" : "px-3 py-1 text-muted-foreground"}>
                  {l === "en" ? "English" : "Kinyarwanda"}
                </button>
              ))}
            </div>
            <Link to="/learn/$slug" params={{ slug }} target="_blank" className="text-sm font-semibold text-primary underline">Preview</Link>
          </div>
          {part === "questions" ? <QuestionsEditor key={slug + lang} slug={slug} lang={lang} /> : <LessonForm key={slug + lang + part} slug={slug} lang={lang} part={part} userId={userId} />}
        </div>
      )}
    </div>
  );
}

function LessonForm({ slug, lang, part, userId }: { slug: string; lang: "en" | "rw"; part: "text" | "codes" | "videos"; userId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-lesson", slug],
    queryFn: async () => {
      const { data, error } = await db.from("lessons").select("*").eq("slug", slug).single();
      if (error) throw new Error(error.message);
      return data as Lesson;
    },
  });
  const [draft, setDraft] = useState<Partial<LessonContent> | null>(null);
  const [meta, setMeta] = useState<{ name: string; name_rw: string; summary: string; published: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    // Kinyarwanda starts from what is already translated, English otherwise.
    setDraft(lang === "rw" ? { ...q.data.content_rw } : structuredClone(q.data.content));
    setMeta({ name: q.data.name, name_rw: q.data.name_rw ?? "", summary: q.data.summary, published: q.data.published ?? true });
  }, [q.data, lang]);

  if (!q.data || !draft || !meta) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const en = q.data.content;
  const val = <K extends keyof LessonContent>(k: K): LessonContent[K] => (draft[k] ?? (lang === "rw" ? undefined : en[k])) as LessonContent[K];
  const set = <K extends keyof LessonContent>(k: K, v: LessonContent[K]) => setDraft((d) => ({ ...d, [k]: v }));
  // Kinyarwanda lists start as a copy of the English to translate.
  const list = <K extends "lesson" | "codes" | "videos">(k: K) => (draft[k] ?? (lang === "rw" ? structuredClone(en[k]) : en[k])) as LessonContent[K];

  const save = async () => {
    setSaving(true);
    const patch =
      lang === "en"
        ? { content: draft, name: meta.name, summary: meta.summary, published: meta.published }
        : { content_rw: draft, name_rw: meta.name_rw || null };
    const { error } = await db.from("lessons").update({ ...patch, updated_at: new Date().toISOString(), updated_by: userId }).eq("slug", slug);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved. Students see it now.");
    void qc.invalidateQueries({ queryKey: ["admin-lesson", slug] });
    void qc.invalidateQueries({ queryKey: ["admin-lessons"] });
    void qc.invalidateQueries({ queryKey: ["content"] });
  };

  const hint = lang === "rw" ? <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm">Write the Kinyarwanda text. Anything you leave empty shows in English.</p> : null;

  return (
    <div className="space-y-4">
      {hint}
      {part === "text" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><span className={label}>Lesson name</span>{lang === "en"
              ? <input className={input} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
              : <input className={input} value={meta.name_rw} placeholder={meta.name} onChange={(e) => setMeta({ ...meta, name_rw: e.target.value })} />}</div>
            {lang === "en" && <label className="flex items-end gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={meta.published} onChange={(e) => setMeta({ ...meta, published: e.target.checked })} /> Shown to students</label>}
          </div>
          {lang === "en" && <div><span className={label}>One-line summary</span><input className={input} value={meta.summary} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} /></div>}
          <TextArea l="On the test" v={val("range") ?? ""} ph={en.range} on={(v) => set("range", v)} rows={2} />
          <TextArea l="How I approached it (story)" v={val("story") ?? ""} ph={en.story} on={(v) => set("story", v)} rows={6} />
          <TextArea l="Encouragement" v={val("hope") ?? ""} ph={en.hope} on={(v) => set("hope", v)} rows={2} />
          <div>
            <span className={label}>The lesson, in blocks</span>
            <div className="space-y-3">
              {list("lesson").map((b: LessonBlock, i: number) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex gap-2">
                    <input className={cn(input, "font-semibold")} value={b.h} onChange={(e) => set("lesson", list("lesson").map((x, j) => (j === i ? { ...x, h: e.target.value } : x)))} />
                    <button type="button" aria-label="Remove block" onClick={() => set("lesson", list("lesson").filter((_, j) => j !== i))} className="px-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <textarea className={cn(input, "mt-2")} rows={5} value={(b.p ?? []).join("\n\n")} onChange={(e) => set("lesson", list("lesson").map((x, j) => (j === i ? { ...x, p: e.target.value.split(/\n\s*\n/) } : x)))} />
                  <p className="mt-1 text-xs text-muted-foreground">Leave an empty line between paragraphs.</p>
                </div>
              ))}
              <button type="button" onClick={() => set("lesson", [...list("lesson"), { h: "New block", p: [""] }])} className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Add a block</button>
            </div>
          </div>
        </>
      )}

      {part === "codes" && (
        <div className="space-y-3">
          {list("codes").map((k: CheatCode, i: number) => (
            <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex gap-2">
                <input className={cn(input, "font-semibold")} value={k.t} onChange={(e) => set("codes", list("codes").map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))} />
                <button type="button" aria-label="Remove code" onClick={() => set("codes", list("codes").filter((_, j) => j !== i))} className="px-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              {(["start", "stop", "skip", "why"] as const).map((f) => (
                <label key={f} className="block text-xs font-bold uppercase text-muted-foreground">{f}
                  <textarea className={cn(input, "mt-1 font-normal normal-case text-foreground")} rows={2} value={k[f]} onChange={(e) => set("codes", list("codes").map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)))} />
                </label>
              ))}
            </div>
          ))}
          <button type="button" onClick={() => set("codes", [...list("codes"), { t: "New cheat code", start: "", stop: "", skip: "", why: "", from: [] }])} className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Add a cheat code</button>
        </div>
      )}

      {part === "videos" && <VideosForm videos={list("videos")} onChange={(v) => set("videos", v)} />}

      <div className="sticky bottom-20 flex justify-end lg:bottom-4">
        <button type="button" onClick={save} disabled={saving} className="h-11 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-lg disabled:opacity-60">{saving ? "Saving…" : "Publish changes"}</button>
      </div>
    </div>
  );
}

function TextArea({ l, v, ph, on, rows }: { l: string; v: string; ph: string; on: (v: string) => void; rows: number }) {
  return <label className="block"><span className={label}>{l}</span><textarea className={input} rows={rows} value={v} placeholder={ph} onChange={(e) => on(e.target.value)} /></label>;
}

function VideosForm({ videos, onChange }: { videos: Video[]; onChange: (v: Video[]) => void }) {
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const add = () => {
    const id = link.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1];
    if (!id) return toast.error("That does not look like a YouTube link.");
    onChange([...videos, { id, title: title.trim() || "Video", channel: "YouTube" }]);
    setLink("");
    setTitle("");
  };
  return (
    <div className="space-y-3">
      {videos.map((v, i) => (
        <div key={v.id + i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <img src={`https://i.ytimg.com/vi/${v.id}/default.jpg`} alt="" className="h-12 w-16 rounded object-cover" />
          <input className={input} value={v.title} onChange={(e) => onChange(videos.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <button type="button" aria-label="Remove video" onClick={() => onChange(videos.filter((_, j) => j !== i))} className="px-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
        <input className={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="YouTube link" />
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <button type="button" onClick={add} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Add</button>
      </div>
    </div>
  );
}

interface AdminQuestion {
  id: string;
  position: number;
  level: string;
  context: string | null;
  stem: string;
  options: { text: string; is_correct: boolean }[];
  explanation_en: string;
  explanation_rw: string | null;
  context_rw: string | null;
  stem_rw: string | null;
  status: string;
}

function QuestionsEditor({ slug, lang }: { slug: string; lang: "en" | "rw" }) {
  const q = useQuery({
    queryKey: ["admin-questions", slug],
    queryFn: async () => {
      const { data, error } = await db.from("questions").select("id, position, level, context, stem, options, explanation_en, explanation_rw, context_rw, stem_rw, status").eq("lesson_slug", slug).order("position");
      if (error) throw new Error(error.message);
      return data as AdminQuestion[];
    },
  });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-2">
      {q.data.map((x) => (
        <div key={x.id} id={`q-${x.id}`} className="rounded-xl border border-border bg-card">
          <button type="button" onClick={() => setOpen(open === x.id ? null : x.id)} className="flex w-full items-center gap-3 p-3 text-left text-sm">
            <b className="w-8">{x.position}</b><span className="w-20 text-muted-foreground">{x.level}</span>
            <span className="flex-1 truncate">{x.stem}</span>
            {x.status !== "approved" && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs">{x.status}</span>}
          </button>
          {open === x.id && <QuestionForm q={x} lang={lang} onSaved={() => q.refetch()} />}
        </div>
      ))}
    </div>
  );
}

function QuestionForm({ q, lang, onSaved }: { q: AdminQuestion; lang: "en" | "rw"; onSaved: () => void }) {
  const [d, setD] = useState(structuredClone(q));
  const save = async () => {
    if (d.options.filter((o) => o.is_correct).length !== 1) return toast.error("Mark exactly one correct answer.");
    const patch = lang === "en"
      ? { context: d.context || null, stem: d.stem, options: d.options, explanation_en: d.explanation_en, status: d.status }
      : { context_rw: d.context_rw || null, stem_rw: d.stem_rw || null, explanation_rw: d.explanation_rw || null };
    const { error } = await db.from("questions").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Question saved.");
    onSaved();
  };
  return (
    <div className="space-y-3 border-t border-border p-3">
      {lang === "en" ? (
        <>
          <TextArea l="Statement (optional)" v={d.context ?? ""} ph="" on={(v) => setD({ ...d, context: v })} rows={3} />
          <TextArea l="Question" v={d.stem} ph="" on={(v) => setD({ ...d, stem: v })} rows={2} />
          <div>
            <span className={label}>Options (tick the correct one)</span>
            {d.options.map((o, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <input type="radio" name={`ok-${q.id}`} checked={o.is_correct} onChange={() => setD({ ...d, options: d.options.map((x, j) => ({ ...x, is_correct: j === i })) })} aria-label={`Option ${String.fromCharCode(65 + i)} is correct`} />
                <b className="w-5">{String.fromCharCode(65 + i)}</b>
                <input className={input} value={o.text} onChange={(e) => setD({ ...d, options: d.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
          <TextArea l="Explanation" v={d.explanation_en} ph="" on={(v) => setD({ ...d, explanation_en: v })} rows={3} />
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={d.status === "approved"} onChange={(e) => setD({ ...d, status: e.target.checked ? "approved" : "retired" })} /> Shown to students</label>
        </>
      ) : (
        <>
          <TextArea l="Statement in Kinyarwanda" v={d.context_rw ?? ""} ph={q.context ?? ""} on={(v) => setD({ ...d, context_rw: v })} rows={3} />
          <TextArea l="Question in Kinyarwanda" v={d.stem_rw ?? ""} ph={q.stem} on={(v) => setD({ ...d, stem_rw: v })} rows={2} />
          <TextArea l="Explanation in Kinyarwanda" v={d.explanation_rw ?? ""} ph={q.explanation_en} on={(v) => setD({ ...d, explanation_rw: v })} rows={3} />
        </>
      )}
      <button type="button" onClick={save} className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">Save question</button>
    </div>
  );
}

interface Report {
  id: number;
  message: string;
  status: string;
  created_at: string;
  questions: { id: string; stem: string; position: number; lesson_slug: string } | null;
}

export function ReportsAdmin() {
  const [status, setStatus] = useState<"open" | "fixed" | "dismissed">("open");
  const q = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: async () => {
      const { data, error } = await db.from("question_reports").select("id, message, status, created_at, questions(id, stem, position, lesson_slug)").eq("status", status).order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      return data as Report[];
    },
  });
  const resolve = async (id: number, next: "fixed" | "dismissed") => {
    const { error } = await db.from("question_reports").update({ status: next, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    void q.refetch();
  };
  const rows = useMemo(() => q.data ?? [], [q.data]);
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["open", "fixed", "dismissed"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-full border px-3 py-1 text-sm font-semibold capitalize", status === s ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{s}</button>
        ))}
      </div>
      {!rows.length && <p className="text-sm text-muted-foreground">{status === "open" ? "No problems reported. When a student taps “Report a problem” on a question, it shows here." : "Nothing here."}</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.questions?.lesson_slug} question {r.questions?.position}</p>
            <p className="mt-1 text-sm text-muted-foreground">{r.questions?.stem}</p>
            <p className="mt-2 font-semibold">“{r.message}”</p>
            {status === "open" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.questions && <Link to="/learn/$slug" params={{ slug: r.questions.lesson_slug }} search={{ tab: "practice" }} target="_blank" className="h-9 rounded-lg border border-border px-3 text-sm font-semibold leading-9">See the question</Link>}
                <button type="button" onClick={() => resolve(r.id, "fixed")} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">Fixed</button>
                <button type="button" onClick={() => resolve(r.id, "dismissed")} className="h-9 rounded-lg border border-border px-3 text-sm font-semibold">Not a problem</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">To change a question, open Lessons → the lesson → Questions.</p>
    </div>
  );
}
