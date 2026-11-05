import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import aime from "@/assets/aime.jpg";
import { tr } from "@/lib/i18n/tr";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact | Imboni SAT Hub" },
      { name: "description", content: "Free SAT prep, built in Kigali: what is on the Hub today and why it is free." },
    ],
    links: [{ rel: "canonical", href: "https://sat.imboniacademy.org/impact" }],
  }),
  component: Impact,
});

// Student numbers appear once they are big enough to mean something.
const MIN_TO_SHOW = 10;

interface ImpactData { lessons: number; questions: number; codes: number; guides: number; students: number; answers: number; questions_asked: number; answers_given: number }

function Impact() {
  const { data } = useQuery({
    queryKey: ["public-impact"],
    queryFn: async (): Promise<ImpactData | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("public_impact");
      return data ?? null;
    },
  });
  const content = data
    ? [[data.lessons, "lessons"], [data.questions, "practice questions"], [data.codes, "cheat codes"], [data.guides, "guides in the library"]]
    : [];
  const people = data
    ? ([[data.students, "students with an account"], [data.answers, "practice answers"], [data.questions_asked, "questions asked in the community"]] as [number, string][]).filter(([n]) => n >= MIN_TO_SHOW)
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{tr("Impact")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Free SAT prep, built in Kigali")}</h1>
      <p className="mt-2 text-muted-foreground">What is on the Hub today. Student numbers appear here once there are enough to share. They come straight from the site.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {content.map(([n, l]) => (
          <div key={l as string} className="rounded-2xl border border-border bg-card p-4">
            <b className="block text-3xl tracking-tight">{(n as number).toLocaleString()}</b>
            <span className="text-sm text-muted-foreground">{l}</span>
          </div>
        ))}
        {!data && <p className="col-span-full text-muted-foreground">Loading…</p>}
      </div>
      {people.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {people.map(([n, l]) => (
            <div key={l} className="rounded-2xl bg-secondary p-4"><b className="block text-2xl">{n.toLocaleString()}</b><span className="text-sm text-muted-foreground">{l}</span></div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-4 rounded-2xl border border-border bg-card p-5">
        <img src={aime} alt="Aime Pascal" width={56} height={56} className="h-14 w-14 flex-none rounded-full object-cover object-top" />
        <div className="text-[15px] leading-relaxed">
          <b>{tr("Why it is free")}</b>
          <p className="mt-1">{tr("Many students in Rwanda cannot pay for an SAT course. I started Imboni so that anyone who wants to study has lessons, practice and people to ask, at no cost.")}</p>
          <p className="mt-1 text-muted-foreground">{tr("Aime Pascal, founder of Imboni Academy")}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-primary p-5 text-primary-foreground">
        <b className="text-lg">{tr("Help keep it free")}</b>
        <p className="mt-1 text-primary-foreground/80">{tr("Your gift pays for hosting and new lessons.")}</p>
        <a href="https://imboniacademy.org/donate" className="mt-3 inline-block h-11 rounded-xl bg-white px-5 font-bold leading-[44px] text-primary">{tr("Donate")}</a>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">Did the Hub help you? Tell your story in the <Link to="/forum" className="font-semibold text-primary underline">community</Link>. Aime reads every message.</p>
    </div>
  );
}
