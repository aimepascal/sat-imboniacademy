import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  cleanSvg,
  lessonIndexQuery,
  lessonQuery,
  pick,
  siteContentQuery,
  universalCodesQuery,
  SECTION_NAME,
  type Lesson,
  type LessonContent,
  type Visual,
} from "@/lib/content";
import { useProgress } from "@/lib/content/progress";
import { PracticePanel } from "@/components/learn/PracticePanel";
import { SatMapNav } from "@/components/learn/SatMapNav";

type Tab = "learn" | "practice" | "codes";
const TABS: Tab[] = ["learn", "practice", "codes"];
const SITE = "https://sat.imboniacademy.org";

export const Route = createFileRoute("/learn/$slug")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(s.tab as Tab) && s.tab !== "learn" ? { tab: s.tab as Tab } : {},
  loader: async ({ context, params }) => {
    const [lesson] = await Promise.all([
      context.queryClient.ensureQueryData(lessonQuery(params.slug)),
      context.queryClient.ensureQueryData(siteContentQuery),
      context.queryClient.ensureQueryData(lessonIndexQuery),
    ]);
    if (!lesson) throw notFound();
    return { name: lesson.name, summary: lesson.summary, section: lesson.section };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData ? `${loaderData.name} | SAT ${SECTION_NAME[loaderData.section]} lesson | Imboni SAT Hub` : "Lesson | Imboni SAT Hub";
    const desc = loaderData ? `${loaderData.summary} Free lesson, 16 practice questions and cheat codes.` : "";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: loaderData?.name ?? "Imboni SAT Hub" },
        { property: "og:description", content: desc },
        { property: "og:url", content: `${SITE}/learn/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/learn/${params.slug}` }],
    };
  },
  component: LessonPage,
});

function LessonPage() {
  const { slug } = Route.useParams();
  const { tab = "learn" } = Route.useSearch();
  const { language } = useI18n();
  const userId = useAuthUser();
  const { data: lesson } = useSuspenseQuery(lessonQuery(slug));
  const { data: site } = useSuspenseQuery(siteContentQuery);
  const { data: lessons } = useSuspenseQuery(lessonIndexQuery);
  const { progress, update, isLoading: progressLoading } = useProgress(userId);
  const codesQ = useQuery({ ...universalCodesQuery, enabled: tab !== "learn" });
  // Opening a lesson counts as starting it, so "Continue where you stopped" finds it.
  useEffect(() => {
    // Wait for saved progress first, or this would overwrite it.
    if (lesson && !progressLoading && !progress[slug]) void update(slug, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, progressLoading, !!progress[slug]]);
  if (!lesson) return null;

  const c = merge(lesson, language);
  const part = site.sat_map.find((p) => p.id === lesson.section);
  const domain = part?.domains.find((d) => d.id === lesson.domain_slug);
  const note = site.domain_notes[lesson.domain_slug];
  const parent = lessons.find((l) => l.slug === lesson.parent_slug);
  const children = lessons.filter((l) => l.parent_slug === lesson.slug);
  const top = lessons.filter((l) => !l.parent_slug);
  const idx = top.findIndex((l) => l.slug === (lesson.parent_slug ?? lesson.slug));
  const prev = top[idx - 1];
  const next = top[idx + 1];
  const p = progress[slug];
  const universal = (codesQ.data ?? []).filter((u) => u.applies === "all" || u.applies === lesson.section);

  const tabLink = (t: Tab, label: string) => (
    <Link
      to="/learn/$slug"
      params={{ slug }}
      search={t === "learn" ? {} : { tab: t }}
      replace
      className={cn("border-b-[3px] px-0.5 pb-2.5 pt-3 text-[15px] font-semibold", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-7xl">
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 flex-none overflow-y-auto border-r border-border bg-card px-5 py-6 lg:block">
        <SatMapNav map={site.sat_map} lessons={lessons} progress={progress} current={slug} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="px-4 pb-2 pt-5 sm:px-8">
          <p className="text-[13px] text-muted-foreground">
            <Link to="/learn" className="hover:underline">Learn</Link> / {part?.name} / {domain?.name}
            {parent && <> / <Link to="/learn/$slug" params={{ slug: parent.slug }} className="hover:underline">{parent.name}</Link></>}
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">{c.title || lesson.name}</h1>
        </div>

        <div className="sticky top-14 z-10 flex gap-6 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-8">
          {tabLink("learn", "Learn")}
          {tabLink("practice", "Practice · 16")}
          {tabLink("codes", `Cheat codes · ${c.codes.length}`)}
        </div>

        <div className="max-w-3xl px-4 py-6 sm:px-8">
          {tab === "learn" && (
            <LearnTab c={c} lesson={lesson} note={note} subLessons={children} done={!!p?.done}
              onDone={() => update(slug, { done: !p?.done })} />
          )}
          {tab === "practice" && (
            <PracticePanel slug={slug} section={lesson.section} lang={language} userId={userId} universal={universal}
              onScore={(score, total) => update(slug, { last_score: score, last_total: total, done: p?.done || score === total })} />
          )}
          {tab === "codes" && <CodesTab c={c} slug={slug} universal={universal} />}

          <div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-border pt-6">
            {prev ? <Link to="/learn/$slug" params={{ slug: prev.slug }} className="h-10 rounded-lg border border-border px-4 font-semibold leading-10">← {prev.name}</Link> : <span />}
            {next && <Link to="/learn/$slug" params={{ slug: next.slug }} className="h-10 rounded-lg bg-primary px-4 font-semibold leading-10 text-primary-foreground">Next: {next.name} →</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** English content with any Kinyarwanda fields laid over it. */
function merge(lesson: Lesson, lang: string): LessonContent {
  if (lang !== "rw") return lesson.content;
  const rw = lesson.content_rw ?? {};
  const out = { ...lesson.content } as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(rw)) if (v !== null && v !== "" && !(Array.isArray(v) && !v.length)) out[k] = v;
  return out as unknown as LessonContent;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-9 text-xl font-bold tracking-tight">{children}</h2>;
}

function LearnTab({ c, lesson, note, subLessons, done, onDone }: {
  c: LessonContent;
  lesson: Lesson;
  note?: { qs: string; at: string };
  subLessons: { slug: string; name: string; summary: string }[];
  done: boolean;
  onDone: () => void;
}) {
  return (
    <article className="text-[15.5px] leading-relaxed">
      <div className="rounded-2xl border border-primary/20 bg-secondary p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">On the test</p>
        <p className="mt-1">{c.range}</p>
        {note && <p className="mt-2 text-sm text-muted-foreground">{note.qs}. {note.at}.</p>}
      </div>

      {subLessons.length > 0 && (
        <>
          <H2>Parts of this skill</H2>
          <div className="grid gap-3 sm:grid-cols-3">
            {subLessons.map((k) => (
              <Link key={k.slug} to="/learn/$slug" params={{ slug: k.slug }} className="rounded-xl border border-border bg-card p-4 hover:border-primary">
                <b>{k.name}</b>
                <p className="mt-1 text-sm text-muted-foreground">{k.summary}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      <H2>How I approached it</H2>
      <div className="rounded-2xl border-l-4 border-primary bg-card p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">A small story from Aime</p>
        <p>{c.story}</p>
      </div>
      <p className="mt-3 italic text-muted-foreground">{c.hope}</p>

      <H2>What is inside this part</H2>
      <div className="grid gap-3 sm:grid-cols-2">
        {c.subs.map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-card p-4">
            <b>{s.name}</b>
            <p className="mt-1 text-sm">{s.def}</p>
            {s.covers?.length ? <p className="mt-2 text-xs text-muted-foreground">{s.covers.join(" · ")}</p> : null}
          </div>
        ))}
      </div>

      <H2>How to know a question is from this part</H2>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p>{c.spot.t}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">{c.spot.s.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>

      <H2>The lesson</H2>
      <div className="space-y-4">
        {c.lesson.map((b, n) => (
          <section key={b.h} className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-lg font-bold">{n + 1}. {b.h}</h3>
            {(b.p ?? []).map((t) => <p key={t} className="mt-2">{t}</p>)}
            {b.ex && (
              <div className="mt-3 rounded-xl bg-secondary p-4">
                <p className="font-semibold">{b.ex.q}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-primary">Show the steps</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">{(b.ex.steps ?? []).map((s) => <li key={s}>{s}</li>)}</ol>
                  <p className="mt-2 font-bold">{b.ex.ans}</p>
                </details>
              </div>
            )}
          </section>
        ))}
      </div>

      {c.visual.length > 0 && (
        <>
          <H2>See it</H2>
          <div className="space-y-4">{c.visual.map((v, i) => <VisualBlock key={i} v={v} />)}</div>
        </>
      )}

      <H2>Videos that can help</H2>
      {c.videos.length ? <div className="grid gap-4 sm:grid-cols-2">{c.videos.map((v) => <VideoCard key={v.id} {...v} />)}</div> : <p>Videos are coming.</p>}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/learn/$slug" params={{ slug: lesson.slug }} search={{ tab: "practice" }} className="h-11 rounded-xl bg-primary px-5 font-bold leading-[44px] text-primary-foreground">Practise this part →</Link>
        <button type="button" onClick={onDone} className={cn("h-11 rounded-xl border px-5 font-semibold", done ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-primary text-primary")}>
          {done ? "✓ Marked as done" : "Mark as done"}
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <b>Need help with this part?</b>
        <p className="mt-1 text-sm text-muted-foreground">Ask in the community. Tutors and other students answer.</p>
        <Link to="/forum" className="mt-3 inline-block h-10 rounded-lg border border-primary px-4 font-semibold leading-10 text-primary">Ask a question</Link>
      </div>
    </article>
  );
}

function VisualBlock({ v }: { v: Visual }) {
  return (
    <figure className="rounded-2xl border border-border bg-card p-4">
      {v.title && <figcaption className="mb-3 font-bold">{v.title}</figcaption>}
      {v.type === "flow" && (
        <ol className="space-y-2">
          {v.steps.map((s, i) => (
            <li key={i} className="flex gap-3"><span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span><span>{s}</span></li>
          ))}
        </ol>
      )}
      {v.type === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr>{v.head.map((h) => <th key={h} className="border border-border bg-muted px-2 py-1.5 text-left">{h}</th>)}</tr></thead>
            <tbody>{v.rows.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} className="border border-border px-2 py-1.5">{x}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {v.type === "compare" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[v.left, v.right].map((s) => (
            <div key={s.h} className="rounded-xl bg-secondary p-3"><b>{s.h}</b><ul className="mt-1 list-disc pl-5 text-sm">{s.items.map((x) => <li key={x}>{x}</li>)}</ul></div>
          ))}
        </div>
      )}
      {v.type === "svg" && (
        <>
          <div className="mx-auto max-w-lg [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: cleanSvg(v.svg) }} />
          {v.caption && <p className="mt-2 text-sm text-muted-foreground">{v.caption}</p>}
        </>
      )}
    </figure>
  );
}

function VideoCard({ id, title, channel }: { id: string; title: string; channel: string }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-video bg-black">
        {play ? (
          <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} title={title}
            allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button type="button" onClick={() => setPlay(true)} className="absolute inset-0 grid place-items-center" aria-label={`Play ${title}`}>
            <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white/90 text-2xl text-primary">▶</span>
          </button>
        )}
      </div>
      <div className="p-3 text-sm">
        <b className="block">{title}</b>
        <span className="text-muted-foreground">{channel} · <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="underline">Open on YouTube</a></span>
      </div>
    </div>
  );
}

function CodesTab({ c, slug, universal }: { c: LessonContent; slug: string; universal: { id: string; name: string; oneline: string; apply: { skill: string; q: number }[] }[] }) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">I worked these out from the practice questions. Each code says where to start reading, where to stop, what you can skip, and why it is safe.</p>
      {c.codes.map((k, n) => (
        <div key={k.t} className="rounded-2xl border border-border bg-card p-5 text-[15px] leading-relaxed">
          <h3 className="text-lg font-bold">{n + 1}. {k.t}</h3>
          <dl className="mt-2 space-y-1.5">
            <div><dt className="inline font-bold text-primary">Start: </dt><dd className="inline">{k.start}</dd></div>
            <div><dt className="inline font-bold text-primary">Stop: </dt><dd className="inline">{k.stop}</dd></div>
            <div><dt className="inline font-bold text-primary">Skip: </dt><dd className="inline">{k.skip}</dd></div>
            <div><dt className="inline font-bold text-primary">Why: </dt><dd className="inline">{k.why}</dd></div>
          </dl>
          {k.from?.length ? <p className="mt-2 text-sm text-muted-foreground">Used in question{k.from.length > 1 ? "s" : ""} {k.from.join(", ")}</p> : null}
        </div>
      ))}
      <Link to="/learn/$slug" params={{ slug }} search={{ tab: "practice" }} className="block h-11 rounded-xl border border-primary text-center font-bold leading-[44px] text-primary">Try these codes on the questions</Link>

      {universal.length > 0 && (
        <>
          <h2 className="pt-6 text-xl font-bold">Cheat codes that work in every part</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {universal.map((u) => {
              const here = u.apply.filter((a) => a.skill === slug).map((a) => a.q);
              return (
                <Link key={u.id} to="/codes/$id" params={{ id: u.id }} className="rounded-xl border border-border bg-card p-4 hover:border-primary">
                  <b>{u.name}</b>
                  <p className="mt-1 text-sm text-muted-foreground">{u.oneline}</p>
                  {here.length > 0 && <p className="mt-2 text-sm font-semibold text-emerald-700">Shown on question {here.join(", ")} of this lesson</p>}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
