import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";
import type { ProjectSummary } from "../../lib/api";

interface SessionChartProps {
  projects: ProjectSummary[];
}

export function SessionChart({ projects }: SessionChartProps) {
  // Build chart data: sessions per project (top 8, excluding worktrees)
  const chartData = projects
    .filter((p) => !p.name.includes("workspaces-") && p.sessionCount > 0)
    .slice(0, 10)
    .map((p) => ({
      name: p.name.length > 16 ? p.name.slice(0, 14) + "..." : p.name,
      sessions: p.sessionCount,
      today: p.todayCount,
    }));

  if (chartData.length === 0) return null;

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity size={14} />
        Sessions by Project
      </h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-color)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Sessions" />
            <Bar dataKey="today" fill="#22c55e" radius={[4, 4, 0, 0]} name="Today" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
