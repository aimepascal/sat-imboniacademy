import { createFileRoute } from "@tanstack/react-router";
import { redirectToLearn } from "@/lib/learn-redirect";

// The Library lives inside /learn. This makes sat.imboniacademy.org/library work too.
export const Route = createFileRoute("/library")(redirectToLearn(301, "library"));
