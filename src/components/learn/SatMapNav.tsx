import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { LessonSummary, SatPart } from "@/lib/content";
import type { ProgressMap } from "@/lib/content/progress";

/** The SAT map as a list: parts, domains and lessons, with done / started dots. */
export function SatMapNav({ map, lessons, progress, current }: {
  map: SatPart[];
  lessons: LessonSummary[];
  progress: ProgressMap;
  current?: string;
}) {
  const currentLesson = lessons.find((l) => l.slug === current);
  const openDomain = currentLesson?.domain_slug;
  return (
    <nav aria-label="SAT map" className="text-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-primary">SAT map</p>
      {map.map((part) => (
        <div key={part.id} className="mb-4">
          <p className="mb-1.5 font-bold">{part.name}</p>
          {part.domains.map((d) => {
            const list = lessons.filter((l) => l.domain_slug === d.id);
            const done = list.filter((l) => progress[l.slug]?.done).length;
            const started = list.some((l) => progress[l.slug]);
            return (
              <details key={d.id} open={d.id === openDomain} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-foreground/80 hover:bg-secondary">
                  <span className={cn("h-2 w-2 flex-none rounded-full", done === list.length && list.length ? "bg-emerald-600" : started ? "bg-amber-500" : "bg-border")} />
                  <span className="flex-1">{d.name}</span>
                  <span className="text-xs text-muted-foreground">{done}/{list.length}</span>
                </summary>
                <div className="mb-1 ml-4 border-l border-border pl-2">
                  {list.map((l) => (
                    <Link
                      key={l.slug}
                      to="/learn/$slug"
                      params={{ slug: l.slug }}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-foreground/75 hover:bg-secondary",
                        l.parent_slug && "ml-3 text-[13px]",
                        l.slug === current && "bg-secondary font-bold text-primary",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", progress[l.slug]?.done ? "bg-emerald-600" : progress[l.slug] ? "bg-amber-500" : "bg-transparent")} />
                      {l.name}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      ))}
      <p className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" /> done</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> started</span>
      </p>
    </nav>
  );
}
