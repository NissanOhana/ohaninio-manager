export type AgentMessage =
  | { type: "agent:start"; runId?: string }
  | { type: "agent:text"; content: string }
  | { type: "agent:text_delta"; content: string }
  | { type: "agent:thinking"; content: string }
  | { type: "agent:tool"; tool: string; status: "running" | "done"; summary?: string; input?: string }
  | { type: "agent:complete"; summary: string; costUsd?: number; durationMs?: number; totalTokens?: number }
  | { type: "agent:error"; message: string };

export interface ChatMessage {
  role: "user" | "agent";
  content?: string;
  messages?: AgentMessage[];
}

export interface MessageGroup {
  kind: "text" | "thinking" | "tools" | "complete" | "error" | "streaming";
  content?: string;
  messages: AgentMessage[];
}

export interface RunRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "error";
  question: string;
  messages?: AgentMessage[];
  costUsd?: number;
  durationMs?: number;
  totalTokens?: number;
  errorMessage?: string;
}

// ─── Session Events ──────────────────────────────────────────────

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
  | { kind: "user_message"; content: string; timestamp: string; uuid: string }
  | { kind: "assistant_turn"; blocks: AssistantBlock[]; model: string; usage: UsageData; timestamp: string; uuid: string }
  | { kind: "tool_result"; toolUseId: string; content: string; isError: boolean; timestamp: string; uuid: string }
  | { kind: "bash_output"; output: string; timestamp: string }
  | { kind: "agent_task"; description: string; operation: string; timestamp: string }
  | { kind: "mcp_call"; serverName: string; toolName: string; status: string; timestamp: string }
  | { kind: "waiting_for_task"; taskDescription: string; timestamp: string }
  | { kind: "compact_boundary"; preTokens: number; timestamp: string }
  | { kind: "turn_duration"; durationMs: number; timestamp: string }
  | { kind: "pr_link"; prNumber: number; prUrl: string; timestamp: string }
  | { kind: "unknown"; rawType: string; raw: Record<string, unknown>; timestamp: string };
