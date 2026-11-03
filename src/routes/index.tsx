import { createFileRoute } from "@tanstack/react-router";
import { redirectToLearn } from "@/lib/learn-redirect";

// The home page is /learn. 302, not 301, so browsers do not cache it forever.
export const Route = createFileRoute("/")(redirectToLearn(302));
