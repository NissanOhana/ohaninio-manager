import { readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from "fs";
import { homedir } from "os";
import { join, basename } from "path";
import type { ProjectInfo, SessionEntry, SessionIndex } from "./types.js";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

/** Read minimal metadata from the first line of a session JSONL file */
function readJsonlMeta(filePath: string): Partial<SessionEntry> | null {
  try {
    const fd = openSync(filePath, "r");
    const buf = Buffer.alloc(4_000); // First line metadata is always small
    const bytesRead = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    const chunk = buf.toString("utf-8", 0, bytesRead);
    const firstNewline = chunk.indexOf("\n");
    const firstLine = firstNewline > 0 ? chunk.slice(0, firstNewline) : chunk;
    const parsed = JSON.parse(firstLine);
    return {
      sessionId: parsed.sessionId || basename(filePath, ".jsonl"),
      gitBranch: parsed.gitBranch || "",
      projectPath: parsed.cwd || "",
      isSidechain: parsed.isSidechain || false,
    };
  } catch {
    return null;
  }
}

/** Scan a JSONL file for the first real user prompt (reads first ~100KB only) */
function readFirstPrompt(filePath: string): string {
  try {
    const fd = openSync(filePath, "r");
    const buf = Buffer.alloc(100_000);
    const bytesRead = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    const chunk = buf.toString("utf-8", 0, bytesRead);
    for (const line of chunk.split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        // Skip tool results - we want the actual user prompt
        if (entry.type === "user" && !entry.toolUseResult) {
          let text = "";
          if (typeof entry.message?.content === "string") {
            text = entry.message.content;
          } else if (Array.isArray(entry.message?.content)) {
            const textBlock = entry.message.content.find((b: { type: string }) => b.type === "text");
            if (textBlock?.text) text = textBlock.text;
          }
          // Skip system/interrupted messages
          if (text && !text.startsWith("[Request interrupted")) {
            return text.slice(0, 500);
          }
        }
      } catch { /* skip malformed lines */ }
    }
  } catch { /* file read error */ }
  return "";
}

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
  const projectDir = join(PROJECTS_DIR, projectDirName);

  // 1. Read the index file (may be stale or missing)
  const indexed = new Map<string, SessionEntry>();
  try {
    const indexPath = join(projectDir, "sessions-index.json");
    const content = readFileSync(indexPath, "utf-8");
    const data = JSON.parse(content) as SessionIndex;
    for (const entry of data.entries || []) {
      indexed.set(entry.sessionId, entry);
    }
  } catch { /* index missing or corrupt - continue with disk scan */ }

  // 2. Scan directory for actual JSONL session files
  try {
    const files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const sessionId = basename(file, ".jsonl");
      const filePath = join(projectDir, file);
      let fileMtimeMs: number;
      try {
        fileMtimeMs = statSync(filePath).mtimeMs;
      } catch {
        continue;
      }

      const existing = indexed.get(sessionId);
      if (existing) {
        // Update modified time if the file is newer than what the index says
        const indexModifiedMs = new Date(existing.modified).getTime();
        if (fileMtimeMs > indexModifiedMs) {
          existing.modified = new Date(fileMtimeMs).toISOString();
          existing.fileMtime = fileMtimeMs;
        }
      } else {
        // Session not in index - create entry from file metadata
        const meta = readJsonlMeta(filePath);
        const firstPrompt = readFirstPrompt(filePath);
        let created: string;
        try {
          created = new Date(statSync(filePath).birthtimeMs).toISOString();
        } catch {
          created = new Date(fileMtimeMs).toISOString();
        }
        // Use first line of prompt as summary, cleaned up
        const summary = firstPrompt
          ? firstPrompt.split("\n")[0].slice(0, 120)
          : "Active session";
        indexed.set(sessionId, {
          sessionId,
          fullPath: filePath,
          fileMtime: fileMtimeMs,
          firstPrompt,
          summary,
          messageCount: 0,
          created,
          modified: new Date(fileMtimeMs).toISOString(),
          gitBranch: meta?.gitBranch || "",
          projectPath: meta?.projectPath || "",
          isSidechain: meta?.isSidechain || false,
        });
      }
    }
  } catch { /* directory read error */ }

  return Array.from(indexed.values()).sort(
    (a, b) =>
      new Date(b.modified).getTime() - new Date(a.modified).getTime(),
  );
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

interface ClaudeProcess {
  pid: number;
  cpu: number;
  cwd: string;
}

/** Detect running Claude Code processes via `ps` + `lsof` */
function detectClaudeProcesses(): ClaudeProcess[] {
  try {
    const { execSync } = require("child_process");
    // Get Claude processes with CPU and PID
    const psOut = execSync(
      `ps -eo pid,pcpu,comm | grep -E "claude$" | grep -v grep`,
      { encoding: "utf-8", timeout: 3000 },
    ).trim();
    if (!psOut) return [];

    const processes: ClaudeProcess[] = [];
    for (const line of psOut.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+([\d.]+)\s+/);
      if (!match) continue;
      const pid = parseInt(match[1]);
      const cpu = parseFloat(match[2]);
      // Get cwd via lsof
      try {
        const lsofOut = execSync(
          `lsof -a -p ${pid} -d cwd -Fn 2>/dev/null | grep "^n/" | sed 's/^n//'`,
          { encoding: "utf-8", timeout: 2000 },
        ).trim();
        if (lsofOut) {
          processes.push({ pid, cpu, cwd: lsofOut });
        }
      } catch { /* lsof failed for this pid */ }
    }
    return processes;
  } catch {
    return [];
  }
}

export type SessionStatus = "thinking" | "idle" | "recent";

export function getLiveSessions(_thresholdMinutes = 15): Array<
  SessionEntry & { projectName: string; isActive: boolean; status: SessionStatus }
> {
  const projects = listProjects();
  const processes = detectClaudeProcesses();

  // Map each process to a project by encoding CWD the same way Claude encodes project dirs
  // Claude encodes "/Users/nissano/premium-billing" → "-Users-nissano-premium-billing"
  function cwdToDirPrefix(cwd: string): string {
    return cwd.replace(/\//g, "-");
  }
  // Sort projects by dirName length (longest first) so more specific paths match first
  const sortedProjects = [...projects].sort(
    (a, b) => b.dirName.length - a.dirName.length,
  );
  const projectProcesses = new Map<string, ClaudeProcess[]>();
  for (const proc of processes) {
    const encodedCwd = cwdToDirPrefix(proc.cwd);
    for (const project of sortedProjects) {
      if (encodedCwd === project.dirName || encodedCwd.startsWith(project.dirName + "-")) {
        const existing = projectProcesses.get(project.id) || [];
        existing.push(proc);
        projectProcesses.set(project.id, existing);
        break;
      }
    }
  }

  const results: Array<SessionEntry & { projectName: string; isActive: boolean; status: SessionStatus }> = [];

  for (const project of projects) {
    const procs = projectProcesses.get(project.id);
    if (!procs || procs.length === 0) continue;

    // Sort processes by CPU descending
    const sortedProcs = [...procs].sort((a, b) => b.cpu - a.cpu);
    // Match each process to the next most recent session
    const recentSessions = project.sessions.slice(0, sortedProcs.length);
    if (recentSessions.length === 0) continue;

    for (let i = 0; i < recentSessions.length; i++) {
      const proc = sortedProcs[i];
      const status: SessionStatus = proc.cpu > 5 ? "thinking" : "idle";
      results.push({
        ...recentSessions[i],
        projectName: project.displayName,
        isActive: true,
        status,
      });
    }
  }

  return results.sort(
    (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime(),
  );
}
