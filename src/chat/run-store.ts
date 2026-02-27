export interface RunRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "error";
  question: string;
  messages: any[];
  costUsd?: number;
  durationMs?: number;
  totalTokens?: number;
  errorMessage?: string;
}

const MAX_RUNS = 20;
const runs: RunRecord[] = [];
let nextId = 1;

export const RunStore = {
  start(question: string): RunRecord {
    const run: RunRecord = {
      id: String(nextId++),
      startedAt: new Date().toISOString(),
      status: "running",
      question,
      messages: [],
    };
    runs.unshift(run);
    if (runs.length > MAX_RUNS) {
      runs.pop();
    }
    return run;
  },

  appendMessage(runId: string, msg: any) {
    const run = runs.find((r) => r.id === runId);
    if (run) {
      run.messages.push(msg);
    }
  },

  complete(runId: string, info: { costUsd?: number; durationMs?: number; totalTokens?: number }) {
    const run = runs.find((r) => r.id === runId);
    if (run) {
      run.status = "completed";
      run.completedAt = new Date().toISOString();
      run.costUsd = info.costUsd;
      run.durationMs = info.durationMs;
      run.totalTokens = info.totalTokens;
    }
  },

  error(runId: string, message: string) {
    const run = runs.find((r) => r.id === runId);
    if (run) {
      run.status = "error";
      run.completedAt = new Date().toISOString();
      run.errorMessage = message;
    }
  },

  list(): Omit<RunRecord, "messages">[] {
    return runs.map(({ messages, ...rest }) => rest);
  },

  get(id: string): RunRecord | undefined {
    return runs.find((r) => r.id === id);
  },
};
