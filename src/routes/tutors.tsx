import { createFileRoute, Link } from "@tanstack/react-router";
import { tr } from "@/lib/i18n/tr";

export const Route = createFileRoute("/tutors")({
  head: () => ({
    meta: [
      { title: "Tutors and mentors | Imboni SAT Hub" },
      { name: "description", content: "Help students in Rwanda prepare for the SAT: answer questions, review practice questions, or mentor students on applications." },
    ],
  }),
  component: Tutors,
});

function Tutors() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{tr("Tutors and mentors")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Help a student get there.")}</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">If you scored well on the SAT, teach, or work at a university or organization, you can help. Tutors answer questions in the community and review practice questions. Mentors guide students on their next steps.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <b>{tr("Join as a tutor")}</b>
          <p className="mt-1 text-sm text-muted-foreground">Pick the skills you can teach and how much time you can give. Every tutor is checked before working with students.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <b>{tr("Join as a mentor or organization")}</b>
          <p className="mt-1 text-sm text-muted-foreground">Share guidance on applications, scholarships and universities.</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-secondary p-5">
        <b>{tr("How to apply")}</b>
        <p className="mt-1 text-sm">Introduce yourself in the community: say what you can teach and how much time you can give. You can also write to <a className="font-semibold text-primary underline" href="mailto:admin@imboniacademy.org">admin@imboniacademy.org</a>.</p>
        <Link to="/forum" className="mt-3 inline-block h-10 rounded-lg bg-primary px-4 font-semibold leading-10 text-primary-foreground">{tr("Introduce yourself")}</Link>
      </div>
    </div>
  );
}
