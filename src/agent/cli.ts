/**
 * CLIProvider — spawns Claude CLI as a subprocess and streams events.
 *
 * Modeled after premium-alpaka's agent/cli.ts with adaptations for Bun runtime.
 * Key behaviors:
 * - Deletes CLAUDECODE env var so Claude CLI can spawn inside a Claude session
 * - Uses --dangerously-skip-permissions for autonomous operation
 * - Parses both 'assistant' (turn-level) and 'content_block_delta' (streaming) events
 * - Logs stderr for debugging
 * - Proper process group cleanup via stop()
 */

import { spawn, type ChildProcess } from "child_process";
import type { AgentProvider, AgentEvent, AgentRunOpts } from "./types.js";

/** System subtypes that are noisy and should be filtered out */
const FILTERED_SYSTEM_SUBTYPES = new Set([
  "hook_started",
  "hook_response",
  "hook_error",
  "init",
  "api_key",
  "mcp_connection_status",
]);

function summarizeToolInput(tool: string, input: Record<string, unknown>): string {
  if (input.file_path || input.path) return String(input.file_path || input.path);
  if (input.command) return String(input.command).slice(0, 80);
  if (input.query) return String(input.query).slice(0, 80);
  if (input.pattern) return String(input.pattern).slice(0, 80);
  if (input.url) return String(input.url).slice(0, 80);
  return "";
}

function parseStreamEvent(line: string): AgentEvent | AgentEvent[] | null {
  try {
    const msg = JSON.parse(line);

    // Turn-level assistant message — contains content blocks
    if (msg.type === "assistant" && msg.message?.content) {
      const events: AgentEvent[] = [];
      for (const block of msg.message.content) {
        if (block.type === "thinking" && block.thinking) {
          events.push({ type: "thinking", content: block.thinking });
        }
        if (block.type === "text" && block.text) {
          events.push({ type: "text", content: block.text });
        }
        if (block.type === "tool_use" && block.name) {
          const input = block.input ? summarizeToolInput(block.name, block.input) : undefined;
          events.push({ type: "tool", tool: block.name, status: "running", input });
        }
      }
      return events.length === 1 ? events[0] : events.length > 0 ? events : null;
    }

    // Tool result
    if (msg.type === "tool_result" || msg.type === "result_tool_use") {
      return {
        type: "tool",
        tool: msg.tool_name || msg.name || "tool",
        status: "done",
        summary: typeof msg.output === "string" ? msg.output.slice(0, 200) : undefined,
      };
    }

    // Final result
    if (msg.type === "result") {
      const costUsd = msg.total_cost_usd ?? msg.cost_usd;
      const usage = msg.usage;
      const totalTokens =
        msg.total_tokens ??
        (usage
          ? (usage.input_tokens || 0) +
            (usage.output_tokens || 0) +
            (usage.cache_read_input_tokens || 0) +
            (usage.cache_creation_input_tokens || 0)
          : undefined);
      return {
        type: "complete",
        summary: msg.result || `Agent finished: ${msg.subtype || "done"}`,
        costUsd: typeof costUsd === "number" ? costUsd : undefined,
        durationMs: typeof msg.duration_ms === "number" ? msg.duration_ms : undefined,
        totalTokens: typeof totalTokens === "number" ? totalTokens : undefined,
      };
    }

    // System messages — filter noisy ones
    if (msg.type === "system") {
      if (FILTERED_SYSTEM_SUBTYPES.has(msg.subtype)) return null;
      const content = msg.message || msg.text;
      if (typeof content === "string" && content.trim()) {
        return { type: "system", content };
      }
      return null;
    }

    // Streaming content_block_delta — emit as deltas for real-time streaming
    if (msg.type === "content_block_delta") {
      if (msg.delta?.type === "thinking_delta" && msg.delta?.thinking) {
        return { type: "thinking", content: msg.delta.thinking };
      }
      if (msg.delta?.text) {
        return { type: "text_delta", content: msg.delta.text };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export class CLIProvider implements AgentProvider {
  name = "claude";
  private proc: ChildProcess | null = null;

  async *run(prompt: string, opts: AgentRunOpts): AsyncGenerator<AgentEvent> {
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];
    if (opts.model) args.push("--model", opts.model);

    // Pipe prompt via stdin instead of CLI arg to avoid ARG_MAX limits on long prompts
    const useStdin = prompt.length > 100_000;
    if (!useStdin) {
      args.push(prompt);
    }

    // Remove CLAUDECODE env var to allow spawning Claude CLI from within a Claude Code session
    const env = { ...process.env };
    delete env.CLAUDECODE;

    this.proc = spawn("claude", args, {
      cwd: opts.cwd || process.cwd(),
      stdio: [useStdin ? "pipe" : "ignore", "pipe", "pipe"],
      env,
      detached: true,
    });

    // Write prompt to stdin for long prompts
    if (useStdin && this.proc.stdin) {
      this.proc.stdin.write(prompt);
      this.proc.stdin.end();
    }

    // Event queue for async generator
    const eventQueue: AgentEvent[] = [];
    let streamDone = false;
    let resolver: (() => void) | null = null;
    let gotResult = false;

    const notify = () => {
      if (resolver) {
        const r = resolver;
        resolver = null;
        r();
      }
    };

    const waitForEvents = (): Promise<void> => {
      if (eventQueue.length > 0 || streamDone) return Promise.resolve();
      return new Promise<void>((resolve) => {
        resolver = resolve;
      });
    };

    let buffer = "";

    const processChunk = (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;
        const result = parseStreamEvent(line);
        if (result) {
          if (Array.isArray(result)) {
            for (const e of result) {
              if (e.type === "complete") gotResult = true;
              eventQueue.push(e);
            }
          } else {
            if (result.type === "complete") gotResult = true;
            eventQueue.push(result);
          }
        }
      }
      notify();
    };

    this.proc.stdout!.on("data", processChunk);

    // Log stderr for debugging
    this.proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      if (text.trim()) console.error("[agent stderr]", text.slice(0, 500));
    });

    this.proc.stdout!.on("end", () => {
      if (buffer.trim()) {
        const result = parseStreamEvent(buffer);
        if (result) {
          if (Array.isArray(result)) {
            for (const e of result) {
              if (e.type === "complete") gotResult = true;
              eventQueue.push(e);
            }
          } else {
            if (result.type === "complete") gotResult = true;
            eventQueue.push(result);
          }
        }
      }
      streamDone = true;
      notify();
    });

    this.proc.on("error", (err) => {
      eventQueue.push({ type: "error", message: `Process error: ${err.message}` });
      streamDone = true;
      notify();
    });

    // Yield events as they arrive
    while (true) {
      await waitForEvents();
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }
      if (streamDone) break;
    }

    const exitCode = await new Promise<number>((resolve) => {
      if (!this.proc) return resolve(1);
      if (this.proc.exitCode !== null) return resolve(this.proc.exitCode);
      this.proc.on("exit", (code) => resolve(code ?? 1));
    });

    if (!gotResult) {
      if (exitCode === 0) {
        yield { type: "complete", summary: "Agent finished" };
      } else {
        yield { type: "error", message: `Agent exited with code ${exitCode}` };
      }
    } else if (exitCode !== 0) {
      yield { type: "error", message: `Agent process exited with code ${exitCode}` };
    }

    this.proc = null;
  }

  stop(): void {
    if (!this.proc || this.proc.exitCode !== null) return;
    const pid = this.proc.pid;
    if (!pid) {
      this.proc.kill();
      return;
    }

    // Kill the entire process group so child processes are cleaned up
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        this.proc.kill("SIGTERM");
      } catch {
        /* already dead */
      }
    }

    // Force-kill after 3 seconds if still alive
    const proc = this.proc;
    setTimeout(() => {
      if (proc.exitCode === null) {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          try {
            proc.kill("SIGKILL");
          } catch {
            /* already dead */
          }
        }
      }
    }, 3000);
  }
}
