import { redirect } from "@tanstack/react-router";

// Old pages that now live somewhere else. Each keeps its route only to send
// visitors on: a server redirect for direct visits and bookmarks, and a router
// redirect for links inside the app.
export const LEARN_PATH = "/learn";

export function redirectTo(to: string, status: 301 | 302) {
  return {
    server: {
      handlers: {
        GET: ({ request }: { request: Request }) => {
          const { search } = new URL(request.url);
          return new Response(null, { status, headers: { location: to + search } });
        },
      },
    },
    beforeLoad: () => {
      throw redirect({ to });
    },
  };
}
