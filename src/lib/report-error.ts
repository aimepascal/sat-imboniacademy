// Sends page errors to the Control Center (table site_errors). No names, no
// emails: only the page, the message and the kind of device. At most five per visit.
import { supabase } from "@/integrations/supabase/client";

let sent = 0;

export function reportError(error: unknown) {
  if (typeof window === "undefined" || !import.meta.env.PROD || sent >= 5) return;
  const message = String(error instanceof Error ? `${error.name}: ${error.message}` : error).slice(0, 500);
  // Network blips and browser extensions are not bugs in the Hub.
  if (/Failed to fetch|NetworkError|Load failed|ResizeObserver|chrome-extension/i.test(message)) return;
  sent++;
  const device = window.innerWidth < 700 ? "phone" : window.innerWidth < 1100 ? "tablet" : "computer";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any).from("site_errors").insert({ path: window.location.pathname.slice(0, 200), message, device }).then(() => undefined, () => undefined);
}

export function listenForErrors() {
  window.addEventListener("error", (e) => reportError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason));
}
