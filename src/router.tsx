import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Data a page loads on the server (lessons, the SAT map) is sent with the page,
  // so the browser does not fetch it again.
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
