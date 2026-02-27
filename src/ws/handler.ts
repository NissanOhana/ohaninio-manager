import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { listProjects, getTodaySessions, getLiveSessions } from "../data/sessions.js";
import { getMemoryHealth } from "../data/memory.js";
import { getProjectStatuses } from "../data/status.js";
import { getHistoryStats, getHistoryByDate, readHistory } from "../data/history.js";
import { getStats } from "../data/stats.js";
import { RunStore } from "../chat/run-store.js";
import { CLIProvider } from "../agent/cli.js";
import type { AgentEvent } from "../agent/types.js";

// ─── Agent registry ─────────────────────────────────────────────

interface AgentEntry {
  id: string;
  agent: CLIProvider;
  ws: any;
  mode: string;
  startTime: number;
  metricsInterval: ReturnType<typeof setInterval>;
}

const agents = new Map<string, AgentEntry>();

function nextAgentId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Get info about all running agents (for frontend status) */
export function getRunningAgents(): Array<{ id: string; mode: string; elapsedMs: number }> {
  return Array.from(agents.values()).map((e) => ({
    id: e.id,
    mode: e.mode,
    elapsedMs: Date.now() - e.startTime,
  }));
}

/** Check if any agent is running */
export function isAgentRunning(): boolean {
  return agents.size > 0;
}

// ─── WebSocket message handler ──────────────────────────────────

export function handleWsMessage(ws: any, data: any, broadcast: (data: unknown) => void) {
  if (data.action === "refresh") {
    const projects = listProjects();
    const stats = getHistoryStats();
    const todaySessions = getTodaySessions();
    const statuses = getProjectStatuses();

    ws.send(
      JSON.stringify({
        type: "overview",
        data: {
          projects: projects.map((p) => ({
            id: p.id,
            name: p.displayName,
            sessionCount: p.sessionCount,
            todayCount: p.todaySessionCount,
            lastActivity: p.lastActivity,
          })),
          stats,
          todaySessions: todaySessions.slice(0, 20),
          statuses,
        },
      }),
    );
  }

  if (data.action === "chat") {
    runAgent(ws, "chat", data.question || "", broadcast);
  }

  if (data.action === "learning") {
    const timeframe = data.timeframe || "today";
    const prompt = buildLearningPrompt(timeframe);
    runAgent(ws, "learning", prompt, broadcast);
  }

  if (data.action === "chat_stop" || data.action === "stop") {
    // Stop all agents owned by this client
    for (const [id, entry] of agents) {
      if (entry.ws === ws) {
        entry.agent.stop();
      }
    }
  }

  if (data.action === "agent_status") {
    ws.send(JSON.stringify({ type: "agent:status", agents: getRunningAgents() }));
  }
}

// ─── Agent runner (shared by chat + learning) ───────────────────

function wsSend(ws: any, data: Record<string, unknown>): void {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    /* WS may have closed */
  }
}

async function runAgent(ws: any, mode: string, question: string, broadcast: (data: unknown) => void) {
  const agentId = nextAgentId();
  const startTime = Date.now();

  // Stop any existing agents for this client
  for (const [id, entry] of agents) {
    if (entry.ws === ws) {
      entry.agent.stop();
      clearInterval(entry.metricsInterval);
      agents.delete(id);
    }
  }

  // Build prompt based on mode
  const prompt = mode === "learning" ? question : buildChatPrompt(question);

  // Create run record
  const run = RunStore.start(mode === "learning" ? `Learning analysis` : question);
  broadcast({ type: "run:started", run: { id: run.id, question: run.question, startedAt: run.startedAt } });

  const agent = new CLIProvider();

  // Metrics timer — broadcast agent status every 5 seconds
  const metricsInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    wsSend(ws, { type: "agent:metrics", agentId, elapsedMs: elapsed });
    broadcast({ type: "agent:running", agents: getRunningAgents() });
  }, 5000);

  // Register in registry
  const entry: AgentEntry = { id: agentId, agent, ws, mode, startTime, metricsInterval };
  agents.set(agentId, entry);

  wsSend(ws, { type: "agent:start", agentId, runId: run.id, mode });
  broadcast({ type: "agent:running", agents: getRunningAgents() });

  console.log(`[agent] Starting ${mode} agent ${agentId} (prompt: ${Math.round(prompt.length / 1000)}K chars)`);

  try {
    for await (const event of agent.run(prompt, {})) {
      // Map event to WebSocket message
      const msg: Record<string, unknown> = { ...event, type: `agent:${event.type}`, agentId };
      RunStore.appendMessage(run.id, msg);
      wsSend(ws, msg);

      if (event.type === "complete") {
        RunStore.complete(run.id, {
          durationMs: event.durationMs || Date.now() - startTime,
          costUsd: event.costUsd,
          totalTokens: event.totalTokens,
        });
      }
      if (event.type === "error") {
        RunStore.error(run.id, event.message || "Agent error");
      }
    }
  } catch (err: any) {
    const errorMsg = { type: "agent:error", agentId, message: err?.message || "Agent failed" };
    RunStore.appendMessage(run.id, errorMsg);
    RunStore.error(run.id, err?.message || "Agent failed");
    wsSend(ws, errorMsg);
  } finally {
    clearInterval(metricsInterval);
    agents.delete(agentId);
    broadcast({ type: "run:completed", runId: run.id });
    broadcast({ type: "agent:running", agents: getRunningAgents() });
  }
}

// ─── Prompt builders ────────────────────────────────────────────

function buildChatPrompt(question: string): string {
  const statuses = getProjectStatuses();
  const todaySessions = getTodaySessions();
  const stats = getHistoryStats();
  const memHealth = getMemoryHealth();

  const context = [
    "You are a Claude Code session assistant. Answer questions about the user's Claude Code sessions across all projects on their machine.",
    "Be concise and helpful. Use markdown formatting.",
    "",
    "## Current Data",
    `Total prompts: ${stats.total}, Today: ${stats.today}, This week: ${stats.thisWeek}`,
    "",
    "### Project Statuses:",
    ...statuses.slice(0, 15).map(
      (s) =>
        `- **${s.projectName}** [${s.priority}]: ${s.summary}${s.openPRs.length > 0 ? ` (${s.openPRs.length} open PRs)` : ""}${s.signals.length > 0 ? ` | Signals: ${s.signals.slice(0, 2).join(", ")}` : ""}`,
    ),
    "",
    "### Today's Sessions:",
    ...(todaySessions.length > 0
      ? todaySessions.slice(0, 10).map(
          (s) =>
            `- [${new Date(s.modified).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}] ${s.projectName}: ${s.summary} (${s.messageCount} msgs)`,
        )
      : ["No sessions today yet."]),
    "",
    "### Memory Health:",
    ...memHealth
      .filter((h) => !h.projectName.includes("workspaces-"))
      .map(
        (h) =>
          `- ${h.projectName}: ${h.status}${h.sessionsSinceUpdate > 0 ? ` (+${h.sessionsSinceUpdate} sessions since update)` : ""}`,
      ),
  ].join("\n");

  return `${context}\n\n---\n\nUser question: ${question}`;
}

function buildLearningPrompt(timeframe: string): string {
  const now = new Date();
  let startDate: Date;
  let label: string;
  switch (timeframe) {
    case "yesterday": {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      label = "yesterday";
      break;
    }
    case "week": {
      startDate = new Date(now.getTime() - 7 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      label = "this week";
      break;
    }
    case "month": {
      startDate = new Date(now.getTime() - 30 * 86400000);
      startDate.setHours(0, 0, 0, 0);
      label = "this month";
      break;
    }
    default: {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      label = "today";
    }
  }

  // Gather context data
  const statuses = getProjectStatuses();
  const memHealth = getMemoryHealth();
  const usageStats = getStats();

  // Get history for the time range
  const allHistory = readHistory();
  const startMs = startDate.getTime();
  const endMs =
    timeframe === "yesterday" ? new Date(startDate.getTime() + 86400000).getTime() : now.getTime();
  const rangeHistory = allHistory.filter((e) => e.timestamp >= startMs && e.timestamp < endMs);

  // Group history by project
  const projectHistoryMap = new Map<string, { count: number; prompts: string[] }>();
  for (const entry of rangeHistory) {
    const proj = entry.project || "unknown";
    const existing = projectHistoryMap.get(proj) || { count: 0, prompts: [] };
    existing.count++;
    if (existing.prompts.length < 5) {
      existing.prompts.push(entry.display?.slice(0, 100) || "");
    }
    projectHistoryMap.set(proj, existing);
  }

  const projectSummaries = Array.from(projectHistoryMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([proj, data]) => `- **${proj}**: ${data.count} prompts. Sample: ${data.prompts.slice(0, 3).join(" | ")}`)
    .join("\n");

  // Load the learning skill if available
  let skillInstructions = "";
  const skillPath = join(process.cwd(), ".claude/skills/learning/SKILL.md");
  if (existsSync(skillPath)) {
    try {
      const content = readFileSync(skillPath, "utf-8");
      // Strip YAML frontmatter
      const bodyMatch = content.match(/---[\s\S]*?---\s*([\s\S]*)/);
      skillInstructions = bodyMatch ? bodyMatch[1].trim() : content;
    } catch {}
  }

  const context = [
    skillInstructions ||
      `You are a learning and reflection assistant. The user wants to understand what they learned and how they can improve their workflow with Claude Code ${label}.`,
    "",
    "Analyze their session data and provide:",
    "1. **Summary**: What projects were worked on and what was accomplished",
    "2. **Patterns**: Recurring themes, approaches, or workflows observed",
    "3. **Learnings**: Key insights, techniques, or discoveries from the sessions",
    "4. **Friction Points**: Where things went wrong, got stuck, or were inefficient",
    "5. **Recommendations**: Specific, actionable improvements for working with Claude Code",
    "",
    "Be specific and reference actual session data. Be concise but insightful. Use markdown formatting.",
    "",
    `## Session Activity (${label})`,
    `Total prompts in period: ${rangeHistory.length}`,
    "",
    "### Projects worked on:",
    projectSummaries || "No activity in this period.",
    "",
    "### Current Project Statuses:",
    ...statuses.slice(0, 10).map(
      (s) =>
        `- **${s.projectName}** [${s.priority}]: ${s.summary}${s.signals.length > 0 ? ` | Signals: ${s.signals.slice(0, 2).join(", ")}` : ""}`,
    ),
    "",
    "### Usage Stats:",
    `- Today: ${usageStats.todayMessages} messages, ${usageStats.todaySessions} sessions, ${usageStats.todayToolCalls} tool calls`,
    `- This week: ${usageStats.weekMessages} messages, ${usageStats.weekSessions} sessions, ${usageStats.weekToolCalls} tool calls`,
    `- All time: ${usageStats.totalMessages} messages, ${usageStats.totalSessions} sessions`,
    "",
    "### Memory Health:",
    ...memHealth
      .filter((h) => !h.projectName.includes("workspaces-"))
      .slice(0, 8)
      .map(
        (h) =>
          `- ${h.projectName}: ${h.status}${h.sessionsSinceUpdate > 0 ? ` (+${h.sessionsSinceUpdate} sessions since update)` : ""}`,
      ),
  ].join("\n");

  return `${context}\n\n---\n\nAnalyze what the user learned ${label}.`;
}

// ─── Cleanup ────────────────────────────────────────────────────

/** Clean up agents when a WebSocket disconnects */
export function cleanupChat(ws: any) {
  for (const [id, entry] of agents) {
    if (entry.ws === ws) {
      console.log(`WebSocket disconnected — stopping agent ${id}`);
      entry.agent.stop();
      clearInterval(entry.metricsInterval);
      agents.delete(id);
    }
  }
}

/** Force-stop all agents (server shutdown) */
export function cleanupAllAgents(): void {
  for (const [id, entry] of agents) {
    console.log(`Server shutting down — stopping agent ${id}`);
    entry.agent.stop();
    clearInterval(entry.metricsInterval);
  }
  agents.clear();
}
