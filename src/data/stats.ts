import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const STATS_PATH = join(homedir(), ".claude", "stats-cache.json");

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface StatsData {
  totalSessions: number;
  totalMessages: number;
  todayMessages: number;
  todaySessions: number;
  todayToolCalls: number;
  weekMessages: number;
  weekSessions: number;
  weekToolCalls: number;
  dailyActivity: DailyActivity[];
  modelUsage: ModelUsage[];
  hourCounts: Record<string, number>;
  firstSessionDate: string | null;
}

export function getStats(): StatsData {
  const empty: StatsData = {
    totalSessions: 0,
    totalMessages: 0,
    todayMessages: 0,
    todaySessions: 0,
    todayToolCalls: 0,
    weekMessages: 0,
    weekSessions: 0,
    weekToolCalls: 0,
    dailyActivity: [],
    modelUsage: [],
    hourCounts: {},
    firstSessionDate: null,
  };

  if (!existsSync(STATS_PATH)) return empty;

  try {
    const raw = JSON.parse(readFileSync(STATS_PATH, "utf-8"));
    const daily: DailyActivity[] = (raw.dailyActivity || []).map((d: any) => ({
      date: d.date,
      messageCount: d.messageCount || 0,
      sessionCount: d.sessionCount || 0,
      toolCallCount: d.toolCallCount || 0,
    }));

    // Today and this week aggregation
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const todayEntry = daily.find((d) => d.date === today);
    let weekMessages = 0;
    let weekSessions = 0;
    let weekToolCalls = 0;
    for (const d of daily) {
      if (d.date >= weekAgo) {
        weekMessages += d.messageCount;
        weekSessions += d.sessionCount;
        weekToolCalls += d.toolCallCount;
      }
    }

    // Model usage
    const modelUsage: ModelUsage[] = [];
    if (raw.modelUsage) {
      for (const [model, data] of Object.entries(raw.modelUsage)) {
        const m = data as any;
        modelUsage.push({
          model,
          inputTokens: m.inputTokens || 0,
          outputTokens: m.outputTokens || 0,
          cacheReadInputTokens: m.cacheReadInputTokens || 0,
          cacheCreationInputTokens: m.cacheCreationInputTokens || 0,
        });
      }
    }

    return {
      totalSessions: raw.totalSessions || 0,
      totalMessages: raw.totalMessages || 0,
      todayMessages: todayEntry?.messageCount || 0,
      todaySessions: todayEntry?.sessionCount || 0,
      todayToolCalls: todayEntry?.toolCallCount || 0,
      weekMessages,
      weekSessions,
      weekToolCalls,
      dailyActivity: daily.slice(-14), // Last 14 days
      modelUsage,
      hourCounts: raw.hourCounts || {},
      firstSessionDate: raw.firstSessionDate || null,
    };
  } catch {
    return empty;
  }
}
