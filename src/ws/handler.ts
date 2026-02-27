import { listProjects, getTodaySessions, getLiveSessions } from "../data/sessions.js";
import { getMemoryHealth } from "../data/memory.js";
import { getProjectStatuses } from "../data/status.js";
import { getHistoryStats } from "../data/history.js";
import { RunStore } from "../chat/run-store.js";

const chatProcesses = new Map<any, any>();

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
    handleChat(ws, data.question || "", broadcast);
  }

  if (data.action === "chat_stop") {
    const proc = chatProcesses.get(ws);
    if (proc) {
      proc.kill();
      chatProcesses.delete(ws);
    }
  }
}

async function handleChat(ws: any, question: string, broadcast: (data: unknown) => void) {
  // Kill any existing chat process for this client
  const existing = chatProcesses.get(ws);
  if (existing) {
    existing.kill();
    chatProcesses.delete(ws);
  }

  // Create a run record
  const run = RunStore.start(question);
  broadcast({ type: "run:started", run: { id: run.id, question: run.question, startedAt: run.startedAt } });

  // Gather context
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

  const prompt = `${context}\n\n---\n\nUser question: ${question}`;

  ws.send(JSON.stringify({ type: "agent:start", runId: run.id }));

  try {
    const proc = Bun.spawn(
      ["claude", "-p", prompt, "--output-format", "stream-json", "--no-input"],
      { stdout: "pipe", stderr: "pipe" },
    );
    chatProcesses.set(ws, proc);

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let thinkingBuffer = "";
    let textBuffer = "";
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          const msgs = mapStreamEvent(event, thinkingBuffer, textBuffer);
          for (const msg of msgs) {
            if (msg._updateThinking !== undefined) {
              thinkingBuffer = msg._updateThinking;
              continue;
            }
            if (msg._updateText !== undefined) {
              textBuffer = msg._updateText;
              continue;
            }
            RunStore.appendMessage(run.id, msg);
            ws.send(JSON.stringify(msg));
          }
        } catch {}
      }
    }

    // Flush remaining text
    if (textBuffer) {
      const msg = { type: "agent:text", content: textBuffer };
      RunStore.appendMessage(run.id, msg);
      ws.send(JSON.stringify(msg));
    }
    if (thinkingBuffer) {
      const msg = { type: "agent:thinking", content: thinkingBuffer };
      RunStore.appendMessage(run.id, msg);
      ws.send(JSON.stringify(msg));
    }

    const exitCode = await proc.exited;
    const durationMs = Date.now() - startTime;

    const completeMsg = {
      type: "agent:complete",
      summary: "Chat response complete",
      durationMs,
    };
    RunStore.appendMessage(run.id, completeMsg);
    RunStore.complete(run.id, { durationMs });
    ws.send(JSON.stringify(completeMsg));
    broadcast({ type: "run:completed", runId: run.id });
  } catch (err: any) {
    const errorMsg = {
      type: "agent:error",
      message: err?.message || "Chat failed",
    };
    RunStore.appendMessage(run.id, errorMsg);
    RunStore.error(run.id, err?.message || "Chat failed");
    ws.send(JSON.stringify(errorMsg));
    broadcast({ type: "run:completed", runId: run.id });
  } finally {
    chatProcesses.delete(ws);
  }
}

function mapStreamEvent(
  event: any,
  thinkingBuffer: string,
  textBuffer: string,
): any[] {
  const results: any[] = [];

  // Content block deltas
  if (event.type === "content_block_delta") {
    if (event.delta?.type === "thinking_delta") {
      results.push({ _updateThinking: thinkingBuffer + (event.delta.thinking || "") });
    } else if (event.delta?.type === "text_delta") {
      results.push({ _updateText: textBuffer + (event.delta.text || "") });
      // Send incremental text updates
      results.push({ type: "agent:text_delta", content: event.delta.text || "" });
    }
    return results;
  }

  // Content block start
  if (event.type === "content_block_start") {
    const block = event.content_block;
    if (block?.type === "thinking") {
      results.push({ _updateThinking: "" });
    } else if (block?.type === "text") {
      results.push({ _updateText: "" });
    } else if (block?.type === "tool_use") {
      results.push({
        type: "agent:tool",
        tool: block.name,
        status: "running",
        input: "",
      });
    }
    return results;
  }

  // Content block stop - flush buffers
  if (event.type === "content_block_stop") {
    if (thinkingBuffer) {
      results.push({ type: "agent:thinking", content: thinkingBuffer });
      results.push({ _updateThinking: "" });
    }
    if (textBuffer) {
      results.push({ type: "agent:text", content: textBuffer });
      results.push({ _updateText: "" });
    }
    return results;
  }

  // Tool result
  if (event.type === "tool_result") {
    results.push({
      type: "agent:tool",
      tool: event.name || "tool",
      status: "done",
      summary: event.content?.slice?.(0, 200) || "",
    });
    return results;
  }

  // Result
  if (event.type === "result") {
    results.push({
      type: "agent:complete",
      summary: event.subtype === "success" ? "Complete" : "Error",
      costUsd: event.cost_usd,
      durationMs: event.duration_ms,
      totalTokens: event.total_tokens,
    });
    return results;
  }

  return results;
}

export function cleanupChat(ws: any) {
  const proc = chatProcesses.get(ws);
  if (proc) {
    proc.kill();
    chatProcesses.delete(ws);
  }
}
