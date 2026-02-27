export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

export interface SessionEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  firstPrompt: string;
  summary: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
  prNumber?: number;
  prUrl?: string;
  prRepository?: string;
  name?: string;
}

export interface SessionIndex {
  version: number;
  entries: SessionEntry[];
}

export interface ProjectInfo {
  id: string;
  dirName: string;
  displayName: string;
  projectPath: string;
  sessionCount: number;
  todaySessionCount: number;
  lastActivity: string | null;
  sessions: SessionEntry[];
}

export interface MemoryFile {
  path: string;
  name: string;
  content: string;
  lastModified: Date;
  sizeBytes: number;
}

export interface MemoryHealth {
  projectId: string;
  projectName: string;
  hasMemory: boolean;
  files: MemoryFile[];
  lastUpdated: Date | null;
  sessionsSinceUpdate: number;
  status: "ok" | "stale" | "missing";
}

export type PriorityLevel = "critical" | "in_progress" | "stable" | "dormant";

export interface ProjectStatus {
  projectId: string;
  projectName: string;
  priority: PriorityLevel;
  summary: string;
  lastActivity: string | null;
  signals: string[];
  recentSessions: SessionEntry[];
  openPRs: Array<{ number: number; url: string; repo?: string }>;
}

export interface InsightsReport {
  reportDate: string | null;
  frictionPatterns: Array<{
    name: string;
    severity: "high" | "medium" | "low";
    description: string;
  }>;
  suggestions: Array<{
    text: string;
    target: string;
    rationale: string;
  }>;
  skillIdeas: Array<{
    name: string;
    description: string;
  }>;
}
