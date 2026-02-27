import type { RunRecord } from "./types";

const BASE = "";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface ProjectSummary {
  id: string;
  name: string;
  sessionCount: number;
  todayCount: number;
  lastActivity: string | null;
}

export interface SessionEntry {
  sessionId: string;
  firstPrompt: string;
  summary: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  prNumber?: number;
  prUrl?: string;
  projectName?: string;
}

export interface ProjectStatus {
  projectId: string;
  projectName: string;
  priority: "critical" | "in_progress" | "stable" | "dormant";
  summary: string;
  lastActivity: string | null;
  signals: string[];
  recentSessions: SessionEntry[];
  openPRs: Array<{ number: number; url: string; repo?: string }>;
}

export interface MemoryHealthEntry {
  projectName: string;
  status: "ok" | "stale" | "missing";
  fileCount: number;
  lastUpdated: string | null;
  sessionsSinceUpdate: number;
}

export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

export interface HistoryStats {
  total: number;
  today: number;
  thisWeek: number;
}

export interface InsightsReport {
  reportDate: string | null;
  frictionPatterns: Array<{ name: string; severity: string; description: string }>;
  suggestions: Array<{ text: string; target: string; rationale: string }>;
  skillIdeas: Array<{ name: string; description: string }>;
}

export interface LiveSession extends SessionEntry {
  projectName: string;
  isActive: boolean;
}

export interface OverviewData {
  projects: ProjectSummary[];
  stats: HistoryStats;
  todaySessions: (SessionEntry & { projectName: string })[];
  liveSessions: LiveSession[];
  statuses: ProjectStatus[];
  memoryHealth: MemoryHealthEntry[];
}

export interface MemoryFile {
  name: string;
  content: string;
  lastModified: string;
  sizeBytes: number;
}

export const api = {
  overview: () => fetchJson<OverviewData>("/api/overview"),
  projects: () => fetchJson<{ projects: ProjectSummary[] }>("/api/projects"),
  projectSessions: (id: string, limit = 20) =>
    fetchJson<{ sessions: SessionEntry[] }>(`/api/projects/${encodeURIComponent(id)}/sessions?limit=${limit}`),
  projectMemory: (id: string) =>
    fetchJson<{ files: MemoryFile[] }>(`/api/projects/${encodeURIComponent(id)}/memory`),
  status: () => fetchJson<{ statuses: ProjectStatus[] }>("/api/status"),
  memoryHealth: () => fetchJson<{ health: MemoryHealthEntry[] }>("/api/memory-health"),
  insights: () => fetchJson<InsightsReport>("/api/insights"),
  todayHistory: () => fetchJson<{ entries: HistoryEntry[] }>("/api/history/today"),
  todaySessions: () => fetchJson<{ sessions: (SessionEntry & { projectName: string })[] }>("/api/sessions/today"),
  historyStats: () => fetchJson<HistoryStats>("/api/history/stats"),
  runs: () => fetchJson<{ runs: Omit<RunRecord, "messages">[] }>("/api/runs"),
  run: (id: string) => fetchJson<{ run: RunRecord }>(`/api/runs/${encodeURIComponent(id)}`),
};
