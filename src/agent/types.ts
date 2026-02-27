export interface AgentEvent {
  type: "text" | "text_delta" | "thinking" | "tool" | "complete" | "error" | "system";
  content?: string;
  message?: string;
  tool?: string;
  status?: "running" | "done";
  input?: string;
  summary?: string;
  costUsd?: number;
  durationMs?: number;
  totalTokens?: number;
}

export interface AgentProvider {
  name: string;
  run(prompt: string, opts: AgentRunOpts): AsyncGenerator<AgentEvent>;
  stop(): void;
}

export interface AgentRunOpts {
  cwd?: string;
  model?: string;
}
