import { createFileRoute } from "@tanstack/react-router";
import { redirectToLearn } from "@/lib/learn-redirect";

// Explore/Dashboard was replaced by /learn (home and "My learning").
export const Route = createFileRoute("/dashboard")(redirectToLearn(301));
