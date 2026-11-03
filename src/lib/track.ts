// Counts page visits for the Control Center (table: page_views).
//
// What is stored: the page, the website the visitor came from, phone/tablet/computer,
// the site language, a random visit id kept in this browser, and the user id when
// signed in. No names, no emails, no IP addresses.
//
// The same logic runs on the static /learn page (public/learn/app.js).
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "imboni_visit_id";

function visitId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function deviceType(): "phone" | "tablet" | "computer" {
  const w = window.innerWidth;
  if (w < 700) return "phone";
  if (w < 1100 && navigator.maxTouchPoints > 0) return "tablet";
  return "computer";
}

// Only the website name, and only when it is another site (e.g. "google.com").
function referrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    return host === window.location.hostname ? null : host.slice(0, 200);
  } catch {
    return null;
  }
}

let lastPath = "";

export async function trackPageView(path: string) {
  if (typeof window === "undefined" || !import.meta.env.PROD) return;
  if (path === lastPath) return;
  lastPath = path;
  try {
    const { data } = await supabase.auth.getSession();
    await (supabase as unknown as { from: (t: string) => { insert: (r: object) => Promise<unknown> } })
      .from("page_views")
      .insert({
        path: path.slice(0, 200),
        referrer: referrerHost(),
        device: deviceType(),
        language: (document.documentElement.lang || "en").slice(0, 10),
        session_id: visitId(),
        user_id: data.session?.user.id ?? null,
      });
  } catch {
    // Counting must never break the page.
  }
}
