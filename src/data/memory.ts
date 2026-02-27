import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { MemoryFile, MemoryHealth } from "./types.js";
import { listProjects, readSessionIndex } from "./sessions.js";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

function readMemoryDir(projectDirName: string): MemoryFile[] {
  const memDir = join(PROJECTS_DIR, projectDirName, "memory");
  if (!existsSync(memDir)) return [];

  try {
    return readdirSync(memDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const fullPath = join(memDir, f);
        const stat = statSync(fullPath);
        return {
          path: fullPath,
          name: f,
          content: readFileSync(fullPath, "utf-8"),
          lastModified: stat.mtime,
          sizeBytes: stat.size,
        };
      });
  } catch {
    return [];
  }
}

export function getMemoryHealth(): MemoryHealth[] {
  const projects = listProjects();

  return projects.map((project) => {
    const files = readMemoryDir(project.id);
    const hasMemory = files.length > 0;
    const lastUpdated = hasMemory
      ? new Date(
          Math.max(...files.map((f) => f.lastModified.getTime())),
        )
      : null;

    // Count sessions since last memory update
    let sessionsSinceUpdate = 0;
    if (lastUpdated) {
      const sessions = readSessionIndex(project.id);
      sessionsSinceUpdate = sessions.filter(
        (s) => new Date(s.modified).getTime() > lastUpdated.getTime(),
      ).length;
    }

    let status: MemoryHealth["status"] = "ok";
    if (!hasMemory) {
      status = "missing";
    } else if (sessionsSinceUpdate > 5) {
      status = "stale";
    }

    return {
      projectId: project.id,
      projectName: project.displayName,
      hasMemory,
      files,
      lastUpdated,
      sessionsSinceUpdate,
      status,
    };
  });
}

export function getProjectMemory(
  projectDirName: string,
): MemoryFile[] {
  return readMemoryDir(projectDirName);
}
