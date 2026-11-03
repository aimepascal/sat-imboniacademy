import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | Imboni SAT Hub" },
      { name: "description", content: "Simple terms for using Imboni SAT Hub." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Terms of Use</h1>
      <p className="mt-2 text-sm text-muted-foreground">Imboni SAT Hub. Last updated October 2026.</p>
      <div className="mt-8 space-y-6">
          <section>
            <h2 className="font-display text-xl font-bold">Using the site</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Imboni SAT Hub is a free study site for students preparing for the SAT. Use it for learning, and be kind to other students in the forum.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Our content</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Lessons and cheat codes are written by Imboni Academy for study. Please do not copy and resell them. Links to College Board questions point to the official College Board site, which owns those questions.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">No guarantee</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We work hard to be accurate, but we cannot promise any particular SAT score. Always check important details with official College Board sources.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Accounts and conduct</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Keep your login private. We may remove posts or accounts that are abusive, spam, or break these terms.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Changes and contact</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We may update these terms as the site grows. Questions: admin@imboniacademy.org.</p>
          </section>
      </div>
      <p className="mt-10 text-sm"><Link to="/" className="font-medium text-primary hover:underline">Back to home</Link></p>
    </div>
  );
}
