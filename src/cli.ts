#!/usr/bin/env bun

import { join } from "path";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { homedir } from "os";

const args = process.argv.slice(2);
const command = args[0] || "help";

switch (command) {
  case "start": {
    const portArg = args.find((a) => a.startsWith("--port="));
    const port = portArg ? Number(portArg.split("=")[1]) : 4201;
    const open = args.includes("--open");

    const { startServer } = await import("./server.js");
    startServer({ port, distDir: join(import.meta.dir, "web") });

    if (open) {
      const { exec } = await import("child_process");
      exec(`open http://localhost:${port}`);
    }
    break;
  }

  case "status": {
    const { getProjectStatuses } = await import("./data/status.js");
    const { getTodaySessions } = await import("./data/sessions.js");
    const { getHistoryStats } = await import("./data/history.js");
    const { getMemoryHealth } = await import("./data/memory.js");

    const statuses = getProjectStatuses();
    const todaySessions = getTodaySessions();
    const stats = getHistoryStats();
    const memHealth = getMemoryHealth();

    const priorityEmoji: Record<string, string> = {
      critical: "\x1b[31m●\x1b[0m",
      in_progress: "\x1b[33m●\x1b[0m",
      stable: "\x1b[32m●\x1b[0m",
      dormant: "\x1b[90m●\x1b[0m",
    };

    console.log("\n\x1b[1mOhaninio Manager - Status\x1b[0m\n");
    console.log(`  Prompts: ${stats.total} total, ${stats.today} today, ${stats.thisWeek} this week\n`);

    console.log("\x1b[1m  What Needs Attention\x1b[0m");
    for (const s of statuses.filter((s) => s.priority !== "dormant")) {
      console.log(`  ${priorityEmoji[s.priority]} ${s.projectName}: ${s.summary.slice(0, 60)}`);
    }
    if (statuses.every((s) => s.priority === "dormant")) {
      console.log("  All projects are dormant");
    }

    console.log("\n\x1b[1m  Today's Sessions\x1b[0m");
    if (todaySessions.length === 0) {
      console.log("  No sessions today");
    } else {
      for (const s of todaySessions.slice(0, 8)) {
        const time = new Date(s.modified).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
        console.log(`  ${time} ${s.projectName}: ${s.summary.slice(0, 50)} (${s.messageCount} msgs)`);
      }
    }

    console.log("\n\x1b[1m  Memory Health\x1b[0m");
    const statusSymbol: Record<string, string> = { ok: "\x1b[32m✓\x1b[0m", stale: "\x1b[33m⚠\x1b[0m", missing: "\x1b[31m✗\x1b[0m" };
    for (const h of memHealth.filter((h) => !h.projectName.includes("workspaces-"))) {
      const extra = h.sessionsSinceUpdate > 0 ? ` (+${h.sessionsSinceUpdate} sessions)` : "";
      console.log(`  ${statusSymbol[h.status]} ${h.projectName}${extra}`);
    }

    console.log("");
    break;
  }

  case "install-skill": {
    const skillSrc = join(import.meta.dir, "..", "skills", "orchestrate.md");
    const destDir = join(homedir(), ".claude", "commands");
    const destFile = join(destDir, "orchestrate.md");

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    // Check if the source is in dist/ (published package) or next to src/
    const altSrc = join(import.meta.dir, "skills", "orchestrate.md");
    const src = existsSync(skillSrc) ? skillSrc : altSrc;

    if (!existsSync(src)) {
      console.error("Could not find orchestrate.md skill file");
      process.exit(1);
    }

    copyFileSync(src, destFile);
    console.log(`\n  Installed orchestrate skill to ${destFile}\n`);
    break;
  }

  case "help":
  default: {
    console.log(`
  \x1b[1mOhaninio Manager\x1b[0m - Claude Code Session Orchestrator

  \x1b[1mUsage:\x1b[0m
    ohaninio-manager <command> [options]

  \x1b[1mCommands:\x1b[0m
    start [--port=4201] [--open]   Launch web dashboard
    status                          Quick CLI status output
    install-skill                   Copy orchestrate skill to ~/.claude/commands/
    help                            Show this help

  \x1b[1mExamples:\x1b[0m
    ohaninio-manager start          Start dashboard on port 4201
    ohaninio-manager start --open   Start and open browser
    ohaninio-manager status         Show project status in terminal
`);
    break;
  }
}
