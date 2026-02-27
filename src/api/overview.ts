import { listProjects, getTodaySessions, getLiveSessions } from "../data/sessions.js";
import { getMemoryHealth } from "../data/memory.js";
import { getProjectStatuses } from "../data/status.js";
import { getHistoryStats } from "../data/history.js";
import { getStats } from "../data/stats.js";

export function buildOverviewData() {
  const projects = listProjects();
  const stats = getHistoryStats();
  const todaySessions = getTodaySessions();
  const statuses = getProjectStatuses();
  const memHealth = getMemoryHealth();
  const liveSessions = getLiveSessions();
  const usageStats = getStats();

  return {
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
    usageStats,
  };
}
