import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, MessageSquare, Wrench, Cpu, Calendar, Coins } from "lucide-react";
import type { UsageStats } from "../../lib/api";

interface StatsPanelProps {
  stats: UsageStats;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function shortModelName(model: string): string {
  if (model.includes("opus-4-6")) return "Opus 4.6";
  if (model.includes("opus-4-5")) return "Opus 4.5";
  if (model.includes("sonnet-4-6")) return "Sonnet 4.6";
  if (model.includes("sonnet-4-5")) return "Sonnet 4.5";
  if (model.includes("sonnet-4-")) return "Sonnet 4";
  if (model.includes("haiku-4-5")) return "Haiku 4.5";
  return model.split("-").slice(-2).join(" ");
}

export function StatsPanel({ stats }: StatsPanelProps) {
  // Daily activity chart data
  const chartData = stats.dailyActivity.map((d) => ({
    date: d.date.slice(5), // MM-DD
    messages: d.messageCount,
    sessions: d.sessionCount,
    tools: d.toolCallCount,
  }));

  // Model usage sorted by total tokens
  const models = [...stats.modelUsage]
    .map((m) => ({
      ...m,
      totalTokens: m.inputTokens + m.outputTokens,
      shortName: shortModelName(m.model),
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 4);

  const totalTokensAllModels = models.reduce((sum, m) => sum + m.totalTokens, 0);

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity size={14} className="text-[var(--accent-blue)]" />
        Usage Stats
      </h2>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare size={12} className="text-[var(--accent-blue)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase">Today</span>
          </div>
          <div className="text-xl font-bold text-[var(--accent-blue)]">{formatNumber(stats.todayMessages)}</div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {stats.todaySessions} sessions · {formatNumber(stats.todayToolCalls)} tools
          </div>
        </div>

        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar size={12} className="text-[var(--accent-purple)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase">This Week</span>
          </div>
          <div className="text-xl font-bold text-[var(--accent-purple)]">{formatNumber(stats.weekMessages)}</div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {stats.weekSessions} sessions · {formatNumber(stats.weekToolCalls)} tools
          </div>
        </div>

        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Wrench size={12} className="text-[var(--accent-green)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase">All Time</span>
          </div>
          <div className="text-xl font-bold text-[var(--accent-green)]">{formatNumber(stats.totalMessages)}</div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {stats.totalSessions} sessions
          </div>
        </div>

        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Cpu size={12} className="text-[var(--accent-yellow)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase">Primary Model</span>
          </div>
          <div className="text-sm font-bold text-[var(--accent-yellow)] truncate">
            {models[0]?.shortName || "—"}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {models[0] ? formatNumber(models[0].totalTokens) + " tokens" : ""}
          </div>
        </div>
      </div>

      {/* Daily activity chart */}
      {chartData.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Daily Activity (14d)</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                  tickFormatter={formatNumber}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "11px",
                  }}
                  formatter={(value: number) => formatNumber(value)}
                />
                <Bar dataKey="messages" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Messages" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Model breakdown */}
      {models.length > 0 && (
        <div>
          <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Model Usage</h3>
          <div className="space-y-2">
            {models.map((m) => {
              const pct = totalTokensAllModels > 0 ? (m.totalTokens / totalTokensAllModels) * 100 : 0;
              return (
                <div key={m.model} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-primary)] w-24 shrink-0 truncate">{m.shortName}</span>
                  <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-blue)] rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] w-16 text-right shrink-0">
                    {formatNumber(m.totalTokens)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Token Budget */}
      {(() => {
        const DAILY_BUDGET = 5_000_000;
        const WEEKLY_BUDGET = 35_000_000;
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayActivity = stats.dailyActivity.find((d) => d.date === todayStr);
        const todayTokensEstimate = todayActivity
          ? (todayActivity.messageCount * (totalTokensAllModels / Math.max(stats.totalMessages, 1)))
          : 0;
        const weekTokensEstimate = stats.weekMessages > 0
          ? (stats.weekMessages * (totalTokensAllModels / Math.max(stats.totalMessages, 1)))
          : 0;
        const dailyPct = Math.min((todayTokensEstimate / DAILY_BUDGET) * 100, 100);
        const weeklyPct = Math.min((weekTokensEstimate / WEEKLY_BUDGET) * 100, 100);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        return (
          <div className="mt-5">
            <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Coins size={12} className="text-[var(--accent-yellow)]" />
              Token Budget (estimated)
            </h3>
            <div className="space-y-3">
              {/* Today */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-primary)]">Today</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatNumber(todayTokensEstimate)} / {formatNumber(DAILY_BUDGET)}
                  </span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dailyPct > 80 ? "bg-red-500" : dailyPct > 50 ? "bg-[var(--accent-yellow)]" : "bg-[var(--accent-green)]"
                    }`}
                    style={{ width: `${Math.max(dailyPct, 0.5)}%` }}
                  />
                </div>
              </div>

              {/* This Week */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-primary)]">This Week</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatNumber(weekTokensEstimate)} / {formatNumber(WEEKLY_BUDGET)}
                  </span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      weeklyPct > 80 ? "bg-red-500" : weeklyPct > 50 ? "bg-[var(--accent-yellow)]" : "bg-[var(--accent-purple)]"
                    }`}
                    style={{ width: `${Math.max(weeklyPct, 0.5)}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-[var(--text-muted)] mt-2">
              Based on model usage data. Resets estimated daily. Timezone: {timezone}
            </p>
          </div>
        );
      })()}
    </section>
  );
}
