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
