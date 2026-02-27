import { listProjects, getProjectSessions, getTodaySessions, getLiveSessions } from "../data/sessions.js";
import { getMemoryHealth, getProjectMemory } from "../data/memory.js";
import { getProjectStatuses } from "../data/status.js";
import { getInsightsReport, getInsightsReportHtml } from "../data/insights.js";
import { getTodayHistory, getHistoryStats } from "../data/history.js";
import { RunStore } from "../chat/run-store.js";

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export function handleApi(url: URL): Response | null {
  const path = url.pathname;

  // GET /api/projects
  if (path === "/api/projects") {
    const projects = listProjects();
    return jsonResponse({ projects });
  }

  // GET /api/projects/:id/sessions
  const sessionsMatch = path.match(/^\/api\/projects\/([^/]+)\/sessions$/);
  if (sessionsMatch) {
    const projectId = decodeURIComponent(sessionsMatch[1]);
    const limit = Number(url.searchParams.get("limit")) || 20;
    const sessions = getProjectSessions(projectId, limit);
    return jsonResponse({ sessions });
  }

  // GET /api/projects/:id/memory
  const memoryMatch = path.match(/^\/api\/projects\/([^/]+)\/memory$/);
  if (memoryMatch) {
    const projectId = decodeURIComponent(memoryMatch[1]);
    const files = getProjectMemory(projectId);
    return jsonResponse({
      files: files.map((f) => ({
        name: f.name,
        content: f.content,
        lastModified: f.lastModified.toISOString(),
        sizeBytes: f.sizeBytes,
      })),
    });
  }

  // GET /api/history/today
  if (path === "/api/history/today") {
    const entries = getTodayHistory();
    return jsonResponse({ entries });
  }

  // GET /api/history/stats
  if (path === "/api/history/stats") {
    return jsonResponse(getHistoryStats());
  }

  // GET /api/status
  if (path === "/api/status") {
    const statuses = getProjectStatuses();
    return jsonResponse({ statuses });
  }

  // GET /api/memory-health
  if (path === "/api/memory-health") {
    const health = getMemoryHealth();
    return jsonResponse({
      health: health.map((h) => ({
        ...h,
        lastUpdated: h.lastUpdated?.toISOString() || null,
        files: h.files.map((f) => ({
          name: f.name,
          lastModified: f.lastModified.toISOString(),
          sizeBytes: f.sizeBytes,
        })),
      })),
    });
  }

  // GET /api/insights
  if (path === "/api/insights") {
    return jsonResponse(getInsightsReport());
  }

  // GET /api/insights/html
  if (path === "/api/insights/html") {
    const html = getInsightsReportHtml();
    if (!html) return jsonResponse({ error: "No insights report found" }, 404);
    return new Response(html, {
      headers: { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" },
    });
  }

  // GET /api/sessions/today
  if (path === "/api/sessions/today") {
    return jsonResponse({ sessions: getTodaySessions() });
  }

  // GET /api/sessions/live
  if (path === "/api/sessions/live") {
    const threshold = Number(url.searchParams.get("threshold")) || 15;
    return jsonResponse({ sessions: getLiveSessions(threshold) });
  }

  // GET /api/overview
  if (path === "/api/overview") {
    const projects = listProjects();
    const stats = getHistoryStats();
    const todaySessions = getTodaySessions();
    const statuses = getProjectStatuses();
    const memHealth = getMemoryHealth();
    const liveSessions = getLiveSessions();

    return jsonResponse({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.displayName,
        sessionCount: p.sessionCount,
        todayCount: p.todaySessionCount,
        lastActivity: p.lastActivity,
      })),
      stats,
      todaySessions: todaySessions.slice(0, 20),
      liveSessions,
      statuses,
      memoryHealth: memHealth.map((h) => ({
        projectName: h.projectName,
        status: h.status,
        fileCount: h.files.length,
        lastUpdated: h.lastUpdated?.toISOString() || null,
        sessionsSinceUpdate: h.sessionsSinceUpdate,
      })),
    });
  }

  // GET /api/runs
  if (path === "/api/runs") {
    return jsonResponse({ runs: RunStore.list() });
  }

  // GET /api/runs/:id
  const runMatch = path.match(/^\/api\/runs\/([^/]+)$/);
  if (runMatch) {
    const run = RunStore.get(runMatch[1]);
    if (!run) return jsonResponse({ error: "Run not found" }, 404);
    return jsonResponse({ run });
  }

  return null;
}
