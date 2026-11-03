import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inline CTA shown to guests where a logged-in action would normally appear.
 */
export function SignInGate({ action }: { action: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Lock className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display text-base">Create a free account to {action}.</p>
          <p className="text-xs text-muted-foreground">Free. It takes a minute.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to="/auth">Log in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/auth" search={{ mode: "signup" }}>Join free</Link>
        </Button>
      </div>
    </div>
  );
}
