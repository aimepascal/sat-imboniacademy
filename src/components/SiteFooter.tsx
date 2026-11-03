import { Link } from "@tanstack/react-router";
import { InstallAppButton } from "@/components/InstallAppButton";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-elevated">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Imboni SAT Hub by Aime Pascal · Kigali</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Footer">
          <InstallAppButton />
          <Link to="/impact" className="hover:text-foreground">Impact</Link>
          <a href="https://imboniacademy.org" className="hover:text-foreground">imboniacademy.org</a>
          <a href="https://imboniacademy.org/donate" className="hover:text-foreground">Donate</a>
          <a href="mailto:admin@imboniacademy.org" className="hover:text-foreground">admin@imboniacademy.org</a>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
