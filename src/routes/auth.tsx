import { createFileRoute } from "@tanstack/react-router";
import { LEARN_PATH } from "@/lib/learn-redirect";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Eye, EyeOff } from "lucide-react";

const authSearchSchema = z.object({
  mode: z.enum(["login", "signup", "forgot", "reset"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Sign in | Imboni SAT Hub" },
      { name: "description", content: "Join the Imboni SAT Hub community. Free forever for students." },
      { property: "og:title", content: "Join Imboni SAT Hub" },
      { property: "og:description", content: "Sign in or create a free account to unlock SAT cheat codes and peer threads." },
      { property: "og:url", content: "https://sat.imboniacademy.org/auth" },
    ],
    links: [{ rel: "canonical", href: "https://sat.imboniacademy.org/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(search.mode ?? "login");
  const [showPw, setShowPw] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // When someone opens the password-reset link from their email, Supabase
  // signs them in temporarily and fires PASSWORD_RECOVERY. Show the new-password form.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const clean = z.string().email().max(255).parse(email);
        const { error } = await supabase.auth.resetPasswordForEmail(clean, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) throw error;
        setEmailSent(true);
        toast.success("Check your email for the reset link.");
      } else if (mode === "reset") {
        const pw = z.string().min(6).max(72).parse(password);
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
        toast.success("Password updated. You are signed in.");
        // /learn is a static page, so a full page load, not navigate().
        window.location.assign(LEARN_PATH);
      } else if (mode === "signup") {
        const schema = z.object({
          email: z.string().email().max(255),
          password: z.string().min(6).max(72),
          displayName: z.string().trim().min(1).max(80),
        });
        const data = schema.parse({ email, password, displayName });
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}${LEARN_PATH}`,
            data: { display_name: data.displayName },
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome aboard.");
        // /learn is a static page, so a full page load, not navigate().
        window.location.assign(LEARN_PATH);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        // /learn is a static page, so a full page load, not navigate().
        window.location.assign(LEARN_PATH);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    // Calls Supabase's own OAuth flow directly (Google provider must be
    // enabled under Authentication > Providers in the Supabase dashboard).
    // This redirects the whole page to Google, then back to `redirectTo`
    // once Supabase has exchanged the code for a session — so on success
    // this function never returns to its caller; the page navigates away.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${LEARN_PATH}`,
      },
    });
    if (error) {
      toast.error("Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <a href={LEARN_PATH} className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            Imboni SAT Hub
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : mode === "forgot" ? "Forgot your password?" : mode === "reset" ? "Choose a new password" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Free forever. No credit card." : mode === "forgot" ? "Enter your email and we will send you a reset link." : mode === "reset" ? "Pick a password you will remember (at least 6 characters)." : "Sign in to keep studying smart."}
          </p>

          {(mode === "login" || mode === "signup") && (
            <>
              <Button type="button" variant="outline" className="mt-6 w-full" onClick={handleGoogle} disabled={loading}>
                Continue with Google
              </Button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          {emailSent && mode === "forgot" && (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Reset link sent. Open your email, tap the link, and choose a new password. Check spam if you do not see it.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80} />
              </div>
            )}
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
              </div>
            )}
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => { setMode("forgot"); setEmailSent(false); }} className="text-xs font-medium text-primary hover:underline">Forgot password?</button>
                  )}
                </div>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} className="pr-10" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} />
                  <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Save new password" : "Sign in"}
            </Button>
          </form>

          {mode === "forgot" || mode === "reset" ? (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              <button onClick={() => setMode("login")} className="font-medium text-primary hover:underline">Back to sign in</button>
            </p>
          ) : (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="font-medium text-primary hover:underline">
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
