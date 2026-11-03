import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Menu, X } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { canReviewQuestions, useRoles } from "@/hooks/use-roles";
import { LANGUAGES, setLanguage, useI18n, type Language } from "@/lib/i18n";
import { learningDb } from "@/lib/learning/db";
import { LEARN_PATH } from "@/lib/learn-redirect";
import logoUrl from "@/assets/logo.png";

// One compact bar (56px) on every page.
// Main links: Learn, Practice, Library, Cheat codes, Community.
// Signed in: an account menu with Today's plan, Review desk, Control Center and Sign out.
export function SiteHeader() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [open, setOpen] = useState(false);
  const { data: isAdmin } = useIsAdmin(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user.id ?? null);
      setEmail(s?.user.email ?? "");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close the phone menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign(LEARN_PATH);
  };

  const { t, language } = useI18n();
  const { data: roles } = useRoles(userId);

  const chooseLanguage = (next: Language) => {
    setLanguage(next);
    // Remembered on the account too, when there is one. Ignored if it fails:
    // the choice is already saved on this device.
    if (userId) void learningDb.from("profiles").update({ language: next }).eq("id", userId);
  };

  const languageSwitch = (
    <div className="flex items-center rounded-md border border-border p-0.5" role="group" aria-label={t("language.label")}>
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => chooseLanguage(option.code)}
          aria-pressed={language === option.code}
          title={option.label}
          className={`rounded px-2 py-1 text-xs font-semibold uppercase ${language === option.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {option.code}
        </button>
      ))}
    </div>
  );

  // /learn is a static page in public/learn, so these are plain links.
  const mainLinks: { href: string; label: string }[] = [
    { href: LEARN_PATH, label: "Learn" },
    { href: userId ? "/practice" : `${LEARN_PATH}#practice`, label: t("nav.practice") },
    { href: `${LEARN_PATH}#library`, label: "Library" },
    { href: `${LEARN_PATH}#codes`, label: "Cheat codes" },
    { href: "/forum", label: "Community" },
  ];

  const accountLinks: { to: string; label: string }[] = [
    { to: "/today", label: "Today's plan" },
    ...(canReviewQuestions(roles) ? [{ to: "/review-desk", label: t("nav.reviewDesk") }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Control Center" }] : []),
  ];

  const initials = (email.split("@")[0] || "?").slice(0, 2).toUpperCase();
  const linkClass =
    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <a href={LEARN_PATH} className="flex items-center gap-2 font-display text-base font-bold tracking-tight" aria-label="Imboni SAT Hub home">
          <img src={logoUrl} alt="" width={30} height={30} className="h-[30px] w-[30px]" />
          <span>Imboni SAT Hub</span>
        </a>

        <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {mainLinks.map((l) => (
            <a key={l.label} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {languageSwitch}
          {userId ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card pl-1 pr-2"
                  aria-label="Account menu"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accountLinks.map((l) => (
                  <DropdownMenuItem key={l.to} asChild>
                    <Link to={l.to}>{l.label}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild>
                  <a href={`${LEARN_PATH}#mine`}>My learning</a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut} className="text-destructive">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth" className="px-2 text-sm font-medium hover:text-primary">Log in</Link>
              <Button size="sm" asChild><Link to="/auth" search={{ mode: "signup" }}>Start free</Link></Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="ml-auto grid h-10 w-10 place-items-center rounded-md border border-border lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close the menu" : "Open the menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto bg-background lg:hidden">
          <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Main">
            {mainLinks.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-display text-lg font-bold">
                {l.label}
              </a>
            ))}
            {userId &&
              accountLinks.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-display text-lg font-bold text-primary">
                  {l.label}
                </Link>
              ))}
            <div className="mt-3 self-start">{languageSwitch}</div>
            {userId ? (
              <Button variant="outline" className="mt-4 h-12" onClick={handleSignOut}>Sign out</Button>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild className="h-12"><Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)}>Start free</Link></Button>
                <Button variant="outline" asChild className="h-12"><Link to="/auth" onClick={() => setOpen(false)}>Log in</Link></Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
