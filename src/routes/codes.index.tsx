import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { universalCodesQuery } from "@/lib/content";
import aime from "@/assets/aime.jpg";
import { tr } from "@/lib/i18n/tr";

export const Route = createFileRoute("/codes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(universalCodesQuery),
  head: () => ({
    meta: [
      { title: "SAT cheat codes that work in every part | Imboni SAT Hub" },
      { name: "description", content: "Habits that help in every part of the Digital SAT, each shown working on real practice questions." },
    ],
    links: [{ rel: "canonical", href: "https://sat.imboniacademy.org/codes" }],
  }),
  component: Codes,
});

const GROUPS: [string, string][] = [["all", "Work in every part"], ["rw", tr("Reading and Writing")], ["m", tr("Math")]];

function Codes() {
  const { data: codes } = useSuspenseQuery(universalCodesQuery);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{tr("Cheat codes")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Cheat codes that work in every part")}</h1>
      <div className="mt-4 flex gap-4 rounded-2xl border border-border bg-card p-4 text-[15px] leading-relaxed">
        <img src={aime} alt="Aime Pascal" width={64} height={64} className="h-16 w-16 flex-none rounded-full object-cover object-top" />
        <div>
          <p>Each lesson has its own cheat codes. These are different: habits that help in <b>every</b> part, because they come from how the test and Bluebook work.</p>
          <p className="mt-2 text-muted-foreground">I will not promise you a score. Each code is shown on real questions, with a small test you can run yourself.</p>
        </div>
      </div>
      {GROUPS.map(([g, label]) => {
        const list = codes.filter((u) => u.applies === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-3 mt-8 text-xl font-bold">{tr(label)}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((u) => (
                <Link key={u.id} to="/codes/$id" params={{ id: u.id }} className="rounded-xl border border-border bg-card p-4 hover:border-primary">
                  <b className="text-[15px]">{u.name}</b>
                  <p className="mt-1 text-sm text-muted-foreground">{u.oneline}</p>
                  <p className="mt-2 text-xs font-semibold text-primary">Shown on {u.apply.length} real questions</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      <p className="mt-8 text-sm text-muted-foreground">Looking for the codes of one part? Each <Link to="/learn" className="font-semibold text-primary underline">lesson</Link> has a Cheat codes tab.</p>
    </div>
  );
}
