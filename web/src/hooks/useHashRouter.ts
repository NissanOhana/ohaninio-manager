import { useState, useEffect, useCallback } from "react";

export type Route =
  | { page: "dashboard"; projectId?: string; sessionId?: string }
  | { page: "agent" }
  | { page: "insights" };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  if (!h || h === "dashboard") return { page: "dashboard" };
  if (h === "agent") return { page: "agent" };
  if (h === "insights") return { page: "insights" };

  const projectMatch = h.match(/^project\/(.+)/);
  if (projectMatch) return { page: "dashboard", projectId: decodeURIComponent(projectMatch[1]) };

  const sessionMatch = h.match(/^session\/(.+)/);
  if (sessionMatch) return { page: "dashboard", sessionId: decodeURIComponent(sessionMatch[1]) };

  return { page: "dashboard" };
}

function routeToHash(route: Route): string {
  if (route.page === "agent") return "#/agent";
  if (route.page === "insights") return "#/insights";
  if (route.page === "dashboard") {
    if ("sessionId" in route && route.sessionId) return `#/session/${encodeURIComponent(route.sessionId)}`;
    if ("projectId" in route && route.projectId) return `#/project/${encodeURIComponent(route.projectId)}`;
    return "#/dashboard";
  }
  return "#/dashboard";
}

export function useHashRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash(window.location.hash));
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((newRoute: Route) => {
    const hash = routeToHash(newRoute);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    setRoute(newRoute);
  }, []);

  return { route, navigate };
}
