import { watch, openSync, readSync, closeSync, statSync } from "fs";
import { readdirSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

// ─── Types ───────────────────────────────────────────────────────

export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export type AssistantBlock =
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export type SessionEvent =
  // Conversation
  | { kind: "user_message"; content: string; timestamp: string; uuid: string }
  | { kind: "assistant_turn"; blocks: AssistantBlock[]; model: string; usage: UsageData; timestamp: string; uuid: string }
  | { kind: "tool_result"; toolUseId: string; content: string; isError: boolean; timestamp: string; uuid: string }
  // Progress
  | { kind: "bash_output"; output: string; timestamp: string }
  | { kind: "agent_task"; description: string; operation: string; timestamp: string }
  | { kind: "mcp_call"; serverName: string; toolName: string; status: string; timestamp: string }
  | { kind: "waiting_for_task"; taskDescription: string; timestamp: string }
  // System
  | { kind: "compact_boundary"; preTokens: number; timestamp: string }
  | { kind: "turn_duration"; durationMs: number; timestamp: string }
  | { kind: "pr_link"; prNumber: number; prUrl: string; timestamp: string }
  // Catch-all
  | { kind: "unknown"; rawType: string; raw: Record<string, unknown>; timestamp: string };

// ─── Parser ──────────────────────────────────────────────────────

export function parseJsonlLine(line: string): SessionEvent | null {
  if (!line.trim()) return null;

  let entry: any;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }

  const type = entry.type as string;
  const timestamp = entry.timestamp || new Date().toISOString();
  const uuid = entry.uuid || "";

  switch (type) {
    case "user": {
      // Check if this is a tool_result
      if (entry.toolUseResult) {
        const content = typeof entry.message?.content === "string"
          ? entry.message.content
          : Array.isArray(entry.message?.content)
            ? entry.message.content.map((b: any) => {
                if (b.type === "tool_result") {
                  return typeof b.content === "string" ? b.content
                    : Array.isArray(b.content) ? b.content.map((c: any) => c.text || "").join("\n") : "";
                }
                return b.text || "";
              }).join("\n")
            : "";
        return {
          kind: "tool_result",
          toolUseId: entry.toolUseResult?.id || "",
          content: content.slice(0, 10000),
          isError: entry.toolUseResult?.isError || false,
          timestamp,
          uuid,
        };
      }

      // Regular user message
      let text = "";
      if (typeof entry.message?.content === "string") {
        text = entry.message.content;
      } else if (Array.isArray(entry.message?.content)) {
        const textBlock = entry.message.content.find((b: any) => b.type === "text");
        if (textBlock?.text) text = textBlock.text;
      }

      if (!text) return null;

      return {
        kind: "user_message",
        content: text,
        timestamp,
        uuid,
      };
    }

    case "assistant": {
      const msg = entry.message;
      if (!msg) return null;

      const blocks: AssistantBlock[] = [];
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "thinking" && block.thinking) {
            blocks.push({ type: "thinking", content: block.thinking });
          } else if (block.type === "text" && block.text) {
            blocks.push({ type: "text", content: block.text });
          } else if (block.type === "tool_use") {
            blocks.push({
              type: "tool_use",
              id: block.id || "",
              name: block.name || "unknown",
              input: block.input || {},
            });
          }
        }
      }

      if (blocks.length === 0) return null;

      const usage: UsageData = {
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        cacheReadTokens: msg.usage?.cache_read_input_tokens || 0,
        cacheCreationTokens: msg.usage?.cache_creation_input_tokens || 0,
      };

      return {
        kind: "assistant_turn",
        blocks,
        model: msg.model || "unknown",
        usage,
        timestamp,
        uuid,
      };
    }

    case "progress": {
      const data = entry.data;
      if (!data) return null;

      switch (data.type) {
        case "bash_progress":
          return {
            kind: "bash_output",
            output: data.content || data.output || "",
            timestamp,
          };
        case "agent_progress":
          return {
            kind: "agent_task",
            description: data.description || data.content || "",
            operation: data.operation || "progress",
            timestamp,
          };
        case "mcp_progress":
          return {
            kind: "mcp_call",
            serverName: data.serverName || "",
            toolName: data.toolName || "",
            status: data.status || "running",
            timestamp,
          };
        case "waiting_for_task":
          return {
            kind: "waiting_for_task",
            taskDescription: data.taskDescription || data.description || "",
            timestamp,
          };
        case "hook_progress":
          // Filter out hook progress - too noisy
          return null;
        default:
          return null;
      }
    }

    case "system": {
      switch (entry.subtype) {
        case "compact_boundary":
          return {
            kind: "compact_boundary",
            preTokens: entry.preCompactTokenCount || 0,
            timestamp,
          };
        case "turn_duration":
          return {
            kind: "turn_duration",
            durationMs: entry.durationMs || 0,
            timestamp,
          };
        case "stop_hook_summary":
          return null; // Not useful for display
        default:
          return null;
      }
    }

    case "queue-operation": {
      return {
        kind: "agent_task",
        description: (entry.content || "").slice(0, 200),
        operation: entry.operation || "unknown",
        timestamp,
      };
    }

    case "pr-link": {
      return {
        kind: "pr_link",
        prNumber: entry.prNumber || 0,
        prUrl: entry.prUrl || "",
        timestamp,
      };
    }

    case "file-history-snapshot":
      return null; // Not useful for display

    default:
      return {
        kind: "unknown",
        rawType: type || "missing",
        raw: entry,
        timestamp,
      };
  }
}

// ─── File resolver ───────────────────────────────────────────────

export function resolveSessionFile(sessionId: string, projectId?: string): string | null {
  const filename = `${sessionId}.jsonl`;

  // If projectId given, check there first
  if (projectId) {
    const direct = join(PROJECTS_DIR, projectId, filename);
    try {
      statSync(direct);
      return direct;
    } catch { /* not found */ }
  }

  // Scan all project directories
  try {
    const dirs = readdirSync(PROJECTS_DIR);
    for (const dir of dirs) {
      const filePath = join(PROJECTS_DIR, dir, filename);
      try {
        statSync(filePath);
        return filePath;
      } catch { /* not in this dir */ }
    }
  } catch { /* projects dir doesn't exist */ }

  return null;
}

// ─── Session Tailer ──────────────────────────────────────────────

export class SessionTailer {
  private filePath: string;
  private onEvents: (events: SessionEvent[]) => void;
  private onError: (error: string) => void;
  private watcher: ReturnType<typeof watch> | null = null;
  private lastByteOffset = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private partial = ""; // Buffer for incomplete lines

  constructor(
    filePath: string,
    onEvents: (events: SessionEvent[]) => void,
    onError: (error: string) => void,
  ) {
    this.filePath = filePath;
    this.onEvents = onEvents;
    this.onError = onError;
  }

  start(): void {
    // Read entire file first
    try {
      const stat = statSync(this.filePath);
      const fileSize = stat.size;

      if (fileSize > 0) {
        const fd = openSync(this.filePath, "r");
        const buf = Buffer.alloc(fileSize);
        readSync(fd, buf, 0, fileSize, 0);
        closeSync(fd);

        const content = buf.toString("utf-8");
        this.lastByteOffset = fileSize;

        const events = this.parseContent(content);
        if (events.length > 0) {
          this.onEvents(events);
        }
      }
    } catch (err: any) {
      this.onError(`Failed to read session file: ${err.message}`);
      return;
    }

    // Start watching for changes
    try {
      this.watcher = watch(this.filePath, (eventType) => {
        if (eventType === "change") {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => this.readNewContent(), 50);
        }
      });
    } catch (err: any) {
      // File might not exist anymore — non-fatal
      this.onError(`Watch failed: ${err.message}`);
    }
  }

  private readNewContent(): void {
    try {
      const stat = statSync(this.filePath);
      const newSize = stat.size;

      if (newSize <= this.lastByteOffset) return; // No new data

      const bytesToRead = newSize - this.lastByteOffset;
      const fd = openSync(this.filePath, "r");
      const buf = Buffer.alloc(bytesToRead);
      readSync(fd, buf, 0, bytesToRead, this.lastByteOffset);
      closeSync(fd);

      this.lastByteOffset = newSize;
      const content = buf.toString("utf-8");

      const events = this.parseContent(content);
      if (events.length > 0) {
        this.onEvents(events);
      }
    } catch {
      // File might be temporarily unavailable during write
    }
  }

  private parseContent(content: string): SessionEvent[] {
    const events: SessionEvent[] = [];
    const fullContent = this.partial + content;
    const lines = fullContent.split("\n");

    // Last element might be a partial line
    this.partial = lines.pop() || "";

    for (const line of lines) {
      const event = parseJsonlLine(line);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

// ─── Paginated reader (for REST API) ─────────────────────────────

export function readSessionEvents(
  filePath: string,
  offset = 0,
  limit = 200,
): { events: SessionEvent[]; total: number; hasMore: boolean } {
  try {
    const fd = openSync(filePath, "r");
    const stat = statSync(filePath);
    const buf = Buffer.alloc(stat.size);
    readSync(fd, buf, 0, stat.size, 0);
    closeSync(fd);

    const content = buf.toString("utf-8");
    const allEvents: SessionEvent[] = [];

    for (const line of content.split("\n")) {
      const event = parseJsonlLine(line);
      if (event) allEvents.push(event);
    }

    const total = allEvents.length;
    const sliced = allEvents.slice(offset, offset + limit);

    return {
      events: sliced,
      total,
      hasMore: offset + limit < total,
    };
  } catch {
    return { events: [], total: 0, hasMore: false };
  }
}
