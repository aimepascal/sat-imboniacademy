import { createFileRoute } from "@tanstack/react-router";
import { redirectTo } from "@/lib/learn-redirect";

// The old dashboard: a student's progress is now in Me.
export const Route = createFileRoute("/dashboard")(redirectTo("/me", 301));
