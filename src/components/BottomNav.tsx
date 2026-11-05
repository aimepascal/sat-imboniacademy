import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, Home, Library, MessagesSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { tr } from "@/lib/i18n/tr";

/** Phone-only bar at the bottom of the screen with the five main places. */
export function BottomNav() {
  const userId = useAuthUser();
  const { pathname } = useLocation();
  // Full-screen tasks (a test, the first-visit setup) hide the bar.
  if (/^\/(test|welcome|auth|admin)/.test(pathname)) return null;
  const items = [
    { to: "/learn", label: tr("Learn"), icon: Home, match: /^\/learn/ },
    { to: "/practice", label: tr("Practice"), icon: BookOpen, match: /^\/(practice|check|today|review)/ },
    { to: "/library", label: tr("Library"), icon: Library, match: /^\/(library|codes)/ },
    { to: "/forum", label: tr("Community"), icon: MessagesSquare, match: /^\/(forum|tutors)/ },
    { to: userId ? "/me" : "/auth", label: tr("Me"), icon: User, match: /^\/me/ },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map(({ to, label, icon: Icon, match }) => {
        const on = match.test(pathname);
        return (
          <Link key={label} to={to} className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", on ? "text-primary" : "text-muted-foreground")} aria-current={on ? "page" : undefined}>
            <Icon className="h-5 w-5" strokeWidth={on ? 2.4 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
