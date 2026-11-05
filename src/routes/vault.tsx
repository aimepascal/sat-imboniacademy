import { createFileRoute } from "@tanstack/react-router";
import { redirectTo } from "@/lib/learn-redirect";

// The old Cheat Code Vault: its guides are now in the Library.
export const Route = createFileRoute("/vault")(redirectTo("/library", 301));
