import { listProjects } from "./sessions.js";
import type { ProjectStatus, PriorityLevel, SessionEntry } from "./types.js";

const CRITICAL_KEYWORDS = [
  "error",
  "fail",
  "blocked",
  "broken",
  "fix",
  "revert",
  "urgent",
  "ci fail",
];
const PROGRESS_KEYWORDS = [
  "implement",
  "working",
  "progress",
  "review",
  "draft",
  "wip",
];

function analyzePriority(
  sessions: SessionEntry[],
  lastActivityMs: number,
): { priority: PriorityLevel; signals: string[] } {
  const signals: string[] = [];
  const now = Date.now();
  const daysSinceActivity = (now - lastActivityMs) / (1000 * 60 * 60 * 24);

  if (sessions.length === 0) {
    return { priority: "dormant", signals: ["No sessions"] };
  }

  // Check recent sessions for critical signals
  const recentSessions = sessions.slice(0, 5);
  let hasCritical = false;
  let hasProgress = false;
  let hasOpenPR = false;

  for (const session of recentSessions) {
    const text =
      `${session.summary} ${session.firstPrompt}`.toLowerCase();

    for (const kw of CRITICAL_KEYWORDS) {
      if (text.includes(kw)) {
        signals.push(`"${kw}" in: ${session.summary.slice(0, 60)}`);
        hasCritical = true;
      }
    }

    for (const kw of PROGRESS_KEYWORDS) {
      if (text.includes(kw)) {
        hasProgress = true;
      }
    }

    if (session.prUrl) {
      signals.push(`Open PR: ${session.prUrl}`);
      hasOpenPR = true;
    }
  }

  // Priority: PRs and critical issues within 30 days are still relevant
  if ((hasCritical || hasOpenPR) && daysSinceActivity < 30) {
    signals.push(`Last activity ${Math.round(daysSinceActivity)}d ago`);
    return { priority: "critical", signals };
  }

  if (daysSinceActivity < 7) {
    if (hasProgress) {
      signals.push("Active work this week");
      return { priority: "in_progress", signals };
    }
    signals.push("Recent activity");
    return { priority: "stable", signals };
  }

  if (daysSinceActivity < 30) {
    if (hasProgress) {
      signals.push(`Active work ${Math.round(daysSinceActivity)}d ago`);
      return { priority: "in_progress", signals };
    }
    signals.push(`Last activity ${Math.round(daysSinceActivity)}d ago`);
    return { priority: "stable", signals };
  }

  signals.push(
    `No activity for ${Math.round(daysSinceActivity)} days`,
  );
  return { priority: "dormant", signals };
}

export function getProjectStatuses(): ProjectStatus[] {
  const projects = listProjects();

  return projects
    .map((project) => {
      const lastActivityMs = project.lastActivity
        ? new Date(project.lastActivity).getTime()
        : 0;

      const { priority, signals } = analyzePriority(
        project.sessions,
        lastActivityMs,
      );

      const latestSession = project.sessions[0];
      const summary = latestSession
        ? latestSession.summary
        : "No recent activity";

      const openPRs = project.sessions
        .filter((s) => s.prUrl)
        .map((s) => ({
          number: s.prNumber!,
          url: s.prUrl!,
          repo: s.prRepository,
        }))
        .filter(
          (pr, i, arr) =>
            arr.findIndex((p) => p.number === pr.number) === i,
        );

      return {
        projectId: project.id,
        projectName: project.displayName,
        priority,
        summary,
        lastActivity: project.lastActivity,
        signals,
        recentSessions: project.sessions.slice(0, 5),
        openPRs,
      };
    })
    .sort((a, b) => {
      const order: Record<PriorityLevel, number> = {
        critical: 0,
        in_progress: 1,
        stable: 2,
        dormant: 3,
      };
      return order[a.priority] - order[b.priority];
    });
}
