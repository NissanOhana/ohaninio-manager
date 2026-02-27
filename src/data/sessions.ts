import { readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join, basename } from "path";
import type { ProjectInfo, SessionEntry, SessionIndex } from "./types.js";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

function dirNameToDisplayName(dirName: string): string {
  // Directory name format: "-Users-nissano-premium-billing"
  // The encoding replaces "/" with "-", so we need the prefix "-Users-nissano-"
  const prefix = "-Users-nissano-";
  if (dirName.startsWith(prefix)) {
    const rest = dirName.slice(prefix.length);
    // Handle worktree paths like "--claude-worktrees-name"
    if (rest.startsWith("-")) return rest;
    return rest;
  }
  // Handle edge cases
  if (dirName === "-" || dirName === "-Users-nissano") return "home";
  if (dirName === "-private-tmp") return "tmp";
  return dirName;
}

function dirNameToProjectPath(dirName: string): string {
  // Best effort: read actual path from first session entry
  try {
    const indexPath = join(PROJECTS_DIR, dirName, "sessions-index.json");
    const content = readFileSync(indexPath, "utf-8");
    const data = JSON.parse(content) as SessionIndex;
    if (data.entries?.length > 0) {
      return data.entries[0].projectPath;
    }
  } catch {}
  // Fallback
  return dirName.replace(/^-/, "/").replace(/-(?!-)/g, "/");
}

export function listProjects(): ProjectInfo[] {
  try {
    const dirs = readdirSync(PROJECTS_DIR);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return dirs
      .filter((d) => {
        try {
          return statSync(join(PROJECTS_DIR, d)).isDirectory();
        } catch {
          return false;
        }
      })
      .map((dirName) => {
        const sessions = readSessionIndex(dirName);
        const todaySessions = sessions.filter(
          (s) => new Date(s.modified).getTime() >= todayMs,
        );
        const lastSession = sessions.length > 0 ? sessions[0] : null;

        return {
          id: dirName,
          dirName,
          displayName: dirNameToDisplayName(dirName),
          projectPath: dirNameToProjectPath(dirName),
          sessionCount: sessions.length,
          todaySessionCount: todaySessions.length,
          lastActivity: lastSession?.modified || null,
          sessions,
        };
      })
      .filter((p) => p.sessionCount > 0)
      .sort((a, b) => {
        const aTime = a.lastActivity
          ? new Date(a.lastActivity).getTime()
          : 0;
        const bTime = b.lastActivity
          ? new Date(b.lastActivity).getTime()
          : 0;
        return bTime - aTime;
      });
  } catch {
    return [];
  }
}

export function readSessionIndex(projectDirName: string): SessionEntry[] {
  try {
    const indexPath = join(
      PROJECTS_DIR,
      projectDirName,
      "sessions-index.json",
    );
    const content = readFileSync(indexPath, "utf-8");
    const data = JSON.parse(content) as SessionIndex;
    return (data.entries || []).sort(
      (a, b) =>
        new Date(b.modified).getTime() - new Date(a.modified).getTime(),
    );
  } catch {
    return [];
  }
}

export function getProjectSessions(
  projectDirName: string,
  limit = 20,
): SessionEntry[] {
  return readSessionIndex(projectDirName).slice(0, limit);
}

export function getTodaySessions(): Array<
  SessionEntry & { projectName: string }
> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const projects = listProjects();
  const results: Array<SessionEntry & { projectName: string }> = [];

  for (const project of projects) {
    for (const session of project.sessions) {
      if (new Date(session.modified).getTime() >= todayMs) {
        results.push({ ...session, projectName: project.displayName });
      }
    }
  }

  return results.sort(
    (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime(),
  );
}

export function getLiveSessions(thresholdMinutes = 15): Array<
  SessionEntry & { projectName: string; isActive: boolean }
> {
  const now = Date.now();
  const threshold = thresholdMinutes * 60 * 1000;
  const projects = listProjects();
  const results: Array<SessionEntry & { projectName: string; isActive: boolean }> = [];

  for (const project of projects) {
    for (const session of project.sessions) {
      const modifiedMs = new Date(session.modified).getTime();
      const age = now - modifiedMs;
      if (age <= threshold) {
        results.push({
          ...session,
          projectName: project.displayName,
          isActive: age <= 2 * 60 * 1000, // Active if modified in last 2 mins
        });
      }
    }
  }

  return results.sort(
    (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime(),
  );
}
