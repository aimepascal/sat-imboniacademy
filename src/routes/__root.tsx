import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { registerAppServiceWorker } from "@/lib/pwa";
import { trackPageView } from "@/lib/track";
import { listenForErrors, reportError } from "@/lib/report-error";
import { useI18n } from "@/lib/i18n";
import { setActiveLanguage, tr } from "@/lib/i18n/tr";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { BottomNav } from "@/components/BottomNav";
import logoUrl from "@/assets/logo.png";
import { useLocation } from "@tanstack/react-router";

function NotFoundComponent() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <img src={logoUrl} alt="" width={64} height={64} className="mx-auto h-16 w-16" />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{tr("This page is not here")}</h1>
      <p className="mt-2 text-muted-foreground">{tr("The link may be old. These will help you keep studying.")}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Link to="/learn" className="h-11 rounded-xl bg-primary font-bold leading-[44px] text-primary-foreground">{tr("Go to Learn")}</Link>
        <Link to="/library" className="h-11 rounded-xl border border-primary font-semibold leading-[44px] text-primary">{tr("Search the library")}</Link>
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-left">
        <b className="text-sm">{tr("Popular lessons")}</b>
        {[["le1", "Linear equations in one variable"], ["bd", "Boundaries"], ["pc", "Percentages"]].map(([slug, name]) => (
          <Link key={slug} to="/learn/$slug" params={{ slug }} className="flex justify-between border-t border-border py-3 text-[15px] first-of-type:border-0">{name}<span className="text-muted-foreground">›</span></Link>
        ))}
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => reportError(error), [error]);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{tr("This page didn't load")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{tr("Something went wrong. Try again or head home.")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{tr("Try again")}</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">{tr("Go home")}</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Imboni SAT Hub" },
      { name: "description", content: "Free SAT lessons, practice and a student community, by Aime Pascal at Imboni Academy." },
      { property: "og:description", content: "Free SAT lessons, practice and a student community, by Aime Pascal at Imboni Academy." },
      { property: "og:title", content: "Imboni SAT Hub" },
      { name: "twitter:description", content: "Free SAT lessons, practice and a student community, by Aime Pascal at Imboni Academy." },
      { property: "og:image", content: "https://sat.imboniacademy.org/og-image.png" },
      { name: "twitter:image", content: "https://sat.imboniacademy.org/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#10508a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Imboni" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Every page reads the language through tr(); the key re-draws it on change.
  const { language } = useI18n();
  setActiveLanguage(language);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <ServiceWorkerRegistrar />
      <VisitCounter />
      <ErrorListener />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1" key={language} lang={language === "rw" ? "rw" : "en"}>
          <Outlet />
        </main>
        <div className="pb-16 lg:pb-0" key={`f-${language}`}><SiteFooter /></div>
      </div>
      <BottomNav key={`b-${language}`} />
      <PrivacyNotice />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

function ErrorListener() {
  useEffect(() => listenForErrors(), []);
  return null;
}

function VisitCounter() {
  const { pathname } = useLocation();
  useEffect(() => {
    void trackPageView(pathname);
  }, [pathname]);
  return null;
}

function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerAppServiceWorker();
  }, []);
  return null;
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);
  return null;
}
