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

  if (data.action === "insights") {
    const prompt = buildInsightsPrompt();
    runAgent(ws, "insights", prompt, broadcast);
  }

  if (data.action === "work_plan") {
    const prompt = buildWorkPlanPrompt();
    runAgent(ws, "work_plan", prompt, broadcast);
  }

  if (data.action === "session_insights") {
    const prompt = buildSessionInsightsPrompt(data.sessionId as string);
    runAgent(ws, "session_insights", prompt, broadcast);
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
  const agentModes = ["learning", "insights", "work_plan", "session_insights"];
  const prompt = agentModes.includes(mode) ? question : buildChatPrompt(question);

  // Create run record
  const modeLabels: Record<string, string> = {
    learning: "Learning analysis",
    insights: "Insights report",
    work_plan: "Work plan",
    session_insights: "Session analysis",
  };
  const runLabel = modeLabels[mode] || question;
  const run = RunStore.start(runLabel);
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

function buildInsightsPrompt(): string {
  const statuses = getProjectStatuses();
  const memHealth = getMemoryHealth();
  const usageStats = getStats();
  const allHistory = readHistory();

  // Last 7 days of history
  const weekAgo = Date.now() - 7 * 86400000;
  const recentHistory = allHistory.filter((e) => e.timestamp >= weekAgo);

  // Group by project
  const projectHistoryMap = new Map<string, { count: number; prompts: string[] }>();
  for (const entry of recentHistory) {
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

  return [
    "You are an insights analyst for a developer's Claude Code usage. Generate a comprehensive insights report.",
    "Output your analysis in markdown with these sections:",
    "",
    "## Friction Patterns",
    "Identify recurring problems, errors, retries, or inefficiencies. For each pattern:",
    "- Name it concisely",
    "- Rate severity: high, medium, or low",
    "- Describe the pattern and impact",
    "",
    "## CLAUDE.md Suggestions",
    "Suggest specific additions to CLAUDE.md files that would improve the workflow:",
    "- What to add and where",
    "- Why it would help",
    "",
    "## Suggested Skills",
    "Propose custom skills (`.claude/skills/`) that could automate repetitive workflows:",
    "- Skill name and purpose",
    "- What it would automate",
    "",
    "Be specific, reference actual project data, and prioritize actionable insights.",
    "",
    "---",
    "",
    `## Activity (last 7 days)`,
    `Total prompts: ${recentHistory.length}`,
    "",
    "### Projects:",
    projectSummaries || "No recent activity.",
    "",
    "### Project Statuses:",
    ...statuses.slice(0, 10).map(
      (s) => `- **${s.projectName}** [${s.priority}]: ${s.summary}`,
    ),
    "",
    "### Usage:",
    `- Today: ${usageStats.todayMessages} messages, ${usageStats.todaySessions} sessions`,
    `- This week: ${usageStats.weekMessages} messages, ${usageStats.weekSessions} sessions`,
    `- All time: ${usageStats.totalMessages} messages, ${usageStats.totalSessions} sessions`,
    "",
    "### Memory Health:",
    ...memHealth
      .filter((h) => !h.projectName.includes("workspaces-"))
      .slice(0, 8)
      .map((h) => `- ${h.projectName}: ${h.status}`),
  ].join("\n");
}

function buildWorkPlanPrompt(): string {
  const statuses = getProjectStatuses();
  const todaySessions = getTodaySessions();
  const liveSessions = getLiveSessions();
  const stats = getHistoryStats();
  const memHealth = getMemoryHealth();
  const usageStats = getStats();

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return [
    "You are a work planning assistant. The user wants to know what they should work on next.",
    "Analyze their current project states, active sessions, and recent activity to suggest prioritized next steps.",
    "",
    "Provide:",
    "1. **Right Now**: The single most important thing to do next (be specific)",
    "2. **Priority Queue**: 3-5 tasks ranked by urgency/impact",
    "3. **Context**: Why these matter based on project status and recent momentum",
    "4. **Blocked Items**: Anything that needs attention but is waiting on something",
    "",
    "Be specific, actionable, and reference actual project data. Use markdown formatting.",
    `It's currently ${timeOfDay} (${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}).`,
    "",
    "---",
    "",
    `## Current State`,
    `Active sessions: ${liveSessions.length}`,
    `Today's sessions: ${todaySessions.length}`,
    `Prompts today: ${stats.today} | This week: ${stats.thisWeek}`,
    "",
    "### Active Sessions:",
    ...(liveSessions.length > 0
      ? liveSessions.map(
          (s) =>
            `- **${s.projectName}** [${s.status}]: ${s.summary} (${s.messageCount} msgs, branch: ${s.gitBranch || "none"})`,
        )
      : ["No active sessions."]),
    "",
    "### Project Statuses:",
    ...statuses.slice(0, 15).map(
      (s) =>
        `- **${s.projectName}** [${s.priority}]: ${s.summary}${s.openPRs.length > 0 ? ` | ${s.openPRs.length} open PRs` : ""}${s.signals.length > 0 ? ` | ${s.signals.slice(0, 2).join(", ")}` : ""}`,
    ),
    "",
    "### Today's Session History:",
    ...(todaySessions.length > 0
      ? todaySessions.slice(0, 10).map(
          (s) =>
            `- [${new Date(s.modified).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}] ${s.projectName}: ${s.summary}`,
        )
      : ["No sessions today yet."]),
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
}

function buildSessionInsightsPrompt(sessionId: string): string {
  // Find the session across all projects
  const projects = listProjects();
  let targetSession: any = null;
  let projectName = "";

  for (const project of projects) {
    const session = project.sessions.find((s) => s.sessionId === sessionId);
    if (session) {
      targetSession = session;
      projectName = project.displayName;
      break;
    }
  }

  if (!targetSession) {
    return "Session not found. Please provide a valid session ID.";
  }

  // Read session content for analysis
  let sessionContent = "";
  if (targetSession.fullPath) {
    try {
      const content = readFileSync(targetSession.fullPath, "utf-8");
      // Take first 50K chars to keep prompt manageable
      sessionContent = content.slice(0, 50_000);
    } catch { /* file read error */ }
  }

  return [
    "You are a session analyst. Analyze this Claude Code session and provide insights.",
    "",
    "Provide:",
    "1. **Summary**: What was accomplished in this session",
    "2. **Key Decisions**: Important choices or turning points",
    "3. **Patterns**: Workflow patterns, tool usage, or approaches used",
    "4. **Friction Points**: Where things got stuck or could be improved",
    "5. **Learnings**: What can be learned from this session for future work",
    "",
    "Be specific and reference actual content from the session. Use markdown formatting.",
    "",
    "---",
    "",
    `## Session Info`,
    `- **Project**: ${projectName}`,
    `- **Summary**: ${targetSession.summary}`,
    `- **Messages**: ${targetSession.messageCount}`,
    `- **Branch**: ${targetSession.gitBranch || "none"}`,
    `- **Created**: ${targetSession.created}`,
    `- **Modified**: ${targetSession.modified}`,
    `- **Sidechain**: ${targetSession.isSidechain ? "Yes" : "No"}`,
    "",
    "## Session Content (JSONL):",
    sessionContent || "(Session content not available)",
  ].join("\n");
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
