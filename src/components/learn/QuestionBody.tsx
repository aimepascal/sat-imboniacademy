import { cleanSvg, pick, type PracticeQuestion } from "@/lib/content";

/** The statement, table, figure and question sentence of a practice question. */
export function QuestionBody({ q, lang }: { q: PracticeQuestion; lang: string }) {
  const t = q.table_data;
  const context = pick(lang, q.context, q.context_rw);
  return (
    <div className="space-y-3">
      {context && (
        <div className="rounded-lg border-l-4 border-primary bg-card px-4 py-3 text-[15px] leading-relaxed text-foreground/90">
          {context}
        </div>
      )}
      {t && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card p-3">
          {t.title && <p className="mb-2 text-sm font-semibold">{t.title}</p>}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {t.head.map((h, i) => (
                  <th key={i} className="border border-border bg-muted px-2 py-1.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) =>
                    j === 0 && t.head[0] === "" ? (
                      <th key={j} className="border border-border px-2 py-1.5 text-left font-semibold">{c}</th>
                    ) : (
                      <td key={j} className="border border-border px-2 py-1.5">{c}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {t.note && <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>}
        </div>
      )}
      {q.svg && (
        <div
          className="mx-auto max-w-md rounded-lg border border-border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: cleanSvg(q.svg) }}
        />
      )}
      <p className="text-base font-semibold leading-relaxed">{pick(lang, q.stem, q.stem_rw)}</p>
    </div>
  );
}

export const LEVEL_STYLE: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-800",
  medium: "bg-sky-50 text-sky-800",
  hard: "bg-amber-50 text-amber-800",
  "very hard": "bg-rose-50 text-rose-800",
};
