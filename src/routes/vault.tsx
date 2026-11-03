import { createFileRoute } from "@tanstack/react-router";
import { redirectToLearn } from "@/lib/learn-redirect";

// The Cheat Code Vault was replaced by /learn (cheat codes and library).
export const Route = createFileRoute("/vault")(redirectToLearn(301));
