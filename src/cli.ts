#!/usr/bin/env bun

import { join } from "path";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { homedir } from "os";

// ─── ANSI helpers ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
  magenta: "\x1b[35m",
};

const VERSION = "0.1.0";

const BANNER = `
${c.cyan}   ____  _                 _       _
  / __ \\| |__   __ _ _ __ (_)_ __ (_) ___
 | |  | | '_ \\ / _\` | '_ \\| | '_ \\| |/ _ \\
 | |__| | | | | (_| | | | | | | | | | (_) |
  \\____/|_| |_|\\__,_|_| |_|_|_| |_|_|\\___/
${c.reset}${c.dim}                              Manager v${VERSION}${c.reset}
`;

// ─── Port finder ───────────────────────────────────────────────────────────────

async function findAvailablePort(start: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = start + i;
    try {
      const server = Bun.serve({ port, fetch: () => new Response() });
      server.stop();
      return port;
    } catch {
      if (i < maxAttempts - 1) {
        console.log(`${c.yellow}  Port ${port} is busy, trying ${port + 1}...${c.reset}`);
      }
    }
  }
  console.log(`${c.red}  Could not find an available port after ${maxAttempts} attempts.${c.reset}`);
  console.log(`${c.dim}  Falling back to port ${start} (may fail).${c.reset}`);
  return start;
}

// ─── Box-drawing helpers ───────────────────────────────────────────────────────

const BOX_WIDTH = 55;

function boxTop(): string {
  return `${c.dim}┌${"─".repeat(BOX_WIDTH)}┐${c.reset}`;
}

function boxBottom(): string {
  return `${c.dim}└${"─".repeat(BOX_WIDTH)}┘${c.reset}`;
}

function boxSep(): string {
  return `${c.dim}├${"─".repeat(BOX_WIDTH)}┤${c.reset}`;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function boxLine(text: string): string {
  const visible = stripAnsi(text);
  const maxContent = BOX_WIDTH - 2; // space on each side
  if (visible.length > maxContent) {
    // Truncate: walk through the string keeping ANSI codes, cut visible chars
    let visCount = 0;
    let cutIdx = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\x1b") {
        const end = text.indexOf("m", i);
        if (end !== -1) {
          i = end;
          continue;
        }
      }
      visCount++;
      if (visCount >= maxContent - 3) {
        cutIdx = i + 1;
        break;
      }
    }
    // Find all ANSI sequences after cut point to close them
    text = text.slice(0, cutIdx) + `${c.dim}...${c.reset}`;
    const newVisible = stripAnsi(text);
    const pad = maxContent - newVisible.length;
    const padding = pad > 0 ? " ".repeat(pad) : "";
    return `${c.dim}│${c.reset} ${text}${padding}${c.dim}│${c.reset}`;
  }
  const pad = maxContent - visible.length;
  const padding = pad > 0 ? " ".repeat(pad) : "";
  return `${c.dim}│${c.reset} ${text}${padding}${c.dim}│${c.reset}`;
}

function boxEmpty(): string {
  return boxLine("");
}

// ─── Help text ─────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${BANNER}
  ${c.bold}${c.white}Claude Code Session Orchestrator${c.reset}

  ${c.bold}Usage:${c.reset}
    ohaninio-manager <command> [options]

  ${c.bold}Commands:${c.reset}
    ${c.cyan}start${c.reset} [options]              Launch web dashboard
      ${c.dim}--port=PORT${c.reset}               Port number (default: 4201)
      ${c.dim}--open${c.reset}                    Open browser after start
      ${c.dim}--dev${c.reset}                     Run in development mode

    ${c.cyan}status${c.reset}                       Quick CLI status overview
    ${c.cyan}install-skill${c.reset}                Copy orchestrate skill to ~/.claude/commands/
    ${c.cyan}help${c.reset}                         Show this help

  ${c.bold}Flags:${c.reset}
    ${c.dim}--help, -h${c.reset}                Show help
    ${c.dim}--version, -v${c.reset}             Show version

  ${c.bold}Examples:${c.reset}
    ${c.dim}$${c.reset} ohaninio-manager start
    ${c.dim}$${c.reset} ohaninio-manager start --port=8080 --open
    ${c.dim}$${c.reset} ohaninio-manager status
`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

// Global flags — check before command parsing
if (args.includes("--version") || args.includes("-v")) {
  console.log(`ohaninio-manager v${VERSION}`);
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  showHelp();
  process.exit(0);
}

const command = args[0] || "help";

switch (command) {
  // ── start ──────────────────────────────────────────────────────────────────
  case "start": {
    console.log(BANNER);

    const portArg = args.find((a) => a.startsWith("--port="));
    const requestedPort = portArg ? Number(portArg.split("=")[1]) : 4201;
    const open = args.includes("--open");
    const dev = args.includes("--dev");

    if (isNaN(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
      console.error(`${c.red}  Error: Invalid port number "${portArg?.split("=")[1]}"${c.reset}`);
      console.error(`${c.dim}  Port must be a number between 1 and 65535.${c.reset}\n`);
      process.exit(1);
    }

    try {
      console.log(`${c.dim}  Finding available port starting from ${requestedPort}...${c.reset}`);
      const port = await findAvailablePort(requestedPort);

      if (port !== requestedPort) {
        console.log(`${c.green}  Found available port: ${port}${c.reset}\n`);
      }

      const distDir = dev
        ? join(import.meta.dir, "..", "dist", "web")
        : join(import.meta.dir, "web");

      if (dev) {
        console.log(`${c.magenta}  Running in development mode${c.reset}`);
        console.log(`${c.dim}  Frontend dev server expected at http://localhost:5174${c.reset}`);
        console.log(`${c.dim}  API/WS proxied from Vite to port ${port}${c.reset}\n`);
      }

      const { startServer } = await import("./server.js");
      startServer({ port, devMode: dev, distDir });

      if (open) {
        const { exec } = await import("child_process");
        exec(`open http://localhost:${port}`);
      }
    } catch (err) {
      console.error(`\n${c.red}  Failed to start server.${c.reset}\n`);
      if (err instanceof Error) {
        console.error(`${c.dim}  ${err.message}${c.reset}`);
        if (err.message.includes("EADDRINUSE")) {
          console.error(`${c.yellow}  Hint: Another process is using the port. Try a different port with --port=XXXX${c.reset}`);
        }
      } else {
        console.error(`${c.dim}  ${String(err)}${c.reset}`);
      }
      console.error("");
      process.exit(1);
    }
    break;
  }

  // ── status ─────────────────────────────────────────────────────────────────
  case "status": {
    try {
      const { getProjectStatuses } = await import("./data/status.js");
      const { getTodaySessions } = await import("./data/sessions.js");
      const { getHistoryStats } = await import("./data/history.js");
      const { getMemoryHealth } = await import("./data/memory.js");

      const statuses = getProjectStatuses();
      const todaySessions = getTodaySessions();
      const stats = getHistoryStats();
      const memHealth = getMemoryHealth();

      const priorityDot: Record<string, string> = {
        critical: `${c.red}\u25cf${c.reset}`,
        in_progress: `${c.yellow}\u25cf${c.reset}`,
        stable: `${c.green}\u25cf${c.reset}`,
        dormant: `${c.gray}\u25cf${c.reset}`,
      };

      const statusSymbol: Record<string, string> = {
        ok: `${c.green}\u2713${c.reset}`,
        stale: `${c.yellow}\u26a0${c.reset}`,
        missing: `${c.red}\u2717${c.reset}`,
      };

      console.log("");
      console.log(boxTop());
      console.log(boxLine(`${c.bold}${c.cyan}Ohaninio Manager${c.reset} ${c.dim}\u2014 Status${c.reset}`));
      console.log(boxSep());

      // Prompt stats
      console.log(boxLine(`${c.bold}Prompts:${c.reset} ${stats.total} total ${c.dim}\u00b7${c.reset} ${stats.today} today ${c.dim}\u00b7${c.reset} ${stats.thisWeek} week`));
      console.log(boxSep());

      // What Needs Attention
      console.log(boxLine(`${c.bold}${c.white}What Needs Attention${c.reset}`));
      const attentionItems = statuses.filter((s) => s.priority !== "dormant");
      if (attentionItems.length === 0) {
        console.log(boxLine(`${c.dim}All projects are dormant${c.reset}`));
      } else {
        for (const s of attentionItems) {
          const dot = priorityDot[s.priority] || priorityDot.dormant;
          const summary = s.summary.length > 42 ? s.summary.slice(0, 39) + "..." : s.summary;
          console.log(boxLine(`${dot} ${c.bold}${s.projectName}${c.reset}: ${summary}`));
        }
      }
      console.log(boxSep());

      // Today's Sessions
      console.log(boxLine(`${c.bold}${c.white}Today's Sessions${c.reset}`));
      if (todaySessions.length === 0) {
        console.log(boxLine(`${c.dim}No sessions today${c.reset}`));
      } else {
        for (const s of todaySessions.slice(0, 8)) {
          const time = new Date(s.modified).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const summary = s.summary.length > 32 ? s.summary.slice(0, 29) + "..." : s.summary;
          console.log(boxLine(`${c.cyan}${time}${c.reset} ${s.projectName}: ${summary} ${c.dim}(${s.messageCount} msgs)${c.reset}`));
        }
        if (todaySessions.length > 8) {
          console.log(boxLine(`${c.dim}...and ${todaySessions.length - 8} more${c.reset}`));
        }
      }
      console.log(boxSep());

      // Memory Health
      console.log(boxLine(`${c.bold}${c.white}Memory Health${c.reset}`));
      const relevantHealth = memHealth.filter((h) => !h.projectName.includes("workspaces-"));
      if (relevantHealth.length === 0) {
        console.log(boxLine(`${c.dim}No projects found${c.reset}`));
      } else {
        for (const h of relevantHealth) {
          const sym = statusSymbol[h.status] || statusSymbol.missing;
          const extra = h.sessionsSinceUpdate > 0 ? ` ${c.dim}(+${h.sessionsSinceUpdate} sessions)${c.reset}` : "";
          console.log(boxLine(`${sym} ${h.projectName}${extra}`));
        }
      }
      console.log(boxBottom());
      console.log("");
    } catch (err) {
      console.error(`\n${c.red}  Error reading status data.${c.reset}`);
      if (err instanceof Error) {
        console.error(`${c.dim}  ${err.message}${c.reset}`);
      }
      console.error(`${c.dim}  Make sure ~/.claude/ exists and contains session data.${c.reset}\n`);
      process.exit(1);
    }
    break;
  }

  // ── install-skill ──────────────────────────────────────────────────────────
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
      console.error(`\n${c.red}  Could not find orchestrate.md skill file.${c.reset}`);
      console.error(`${c.dim}  Looked in:\n    ${skillSrc}\n    ${altSrc}${c.reset}\n`);
      process.exit(1);
    }

    copyFileSync(src, destFile);
    console.log(`\n${c.green}  Installed${c.reset} orchestrate skill to ${c.cyan}${destFile}${c.reset}\n`);
    break;
  }

  // ── help / default ─────────────────────────────────────────────────────────
  case "help":
  default: {
    if (command !== "help") {
      console.error(`\n${c.red}  Unknown command: "${command}"${c.reset}\n`);
    }
    showHelp();
    break;
  }
}
