import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { tr } from "@/lib/i18n/tr";

// A short notice that the Hub counts visits. Shown once per browser.
const KEY = "imboni_privacy_ok";

export function PrivacyNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label="Privacy notice"
      className="fixed inset-x-4 bottom-20 z-50 lg:bottom-4 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-secondary-foreground px-4 py-3 text-sm text-white shadow-elevated sm:left-6 sm:right-auto"
    >
      <p className="m-0 leading-snug">
        We count visits to improve the Hub. No ads, and we never sell your data.{" "}
        <Link to="/privacy" className="font-semibold text-white underline">{tr("Privacy")}</Link>
      </p>
      <button
        type="button"
        onClick={accept}
        className="h-9 shrink-0 rounded-lg bg-white px-4 font-bold text-secondary-foreground"
      >
        {tr("OK")}
      </button>
    </div>
  );
}
