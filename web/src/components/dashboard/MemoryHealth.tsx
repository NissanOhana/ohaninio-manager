import { Brain, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { MemoryHealthEntry } from "../../lib/api";

interface MemoryHealthProps {
  health: MemoryHealthEntry[];
}

const STATUS_CONFIG = {
  ok: { icon: CheckCircle, color: "text-green-400", label: "OK" },
  stale: { icon: Clock, color: "text-yellow-400", label: "Stale" },
  missing: { icon: AlertTriangle, color: "text-red-400", label: "Missing" },
};

export function MemoryHealth({ health }: MemoryHealthProps) {
  // Filter out worktree projects
  const filtered = health.filter((h) => !h.projectName.includes("workspaces-"));

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Brain size={14} />
        Memory Health
      </h2>
      <div className="space-y-1.5">
        {filtered.map((entry) => {
          const config = STATUS_CONFIG[entry.status];
          const Icon = config.icon;

          return (
            <div
              key={entry.projectName}
              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon size={14} className={config.color} />
                <span className="text-sm text-[var(--text-primary)] truncate">{entry.projectName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-[var(--text-muted)]">
                  {entry.fileCount > 0 ? `${entry.fileCount} file${entry.fileCount > 1 ? "s" : ""}` : "none"}
                </span>
                {entry.lastUpdated && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {new Date(entry.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
                {entry.sessionsSinceUpdate > 0 && (
                  <span className="text-[10px] text-yellow-500">
                    +{entry.sessionsSinceUpdate} sessions
                  </span>
                )}
                <span className={`text-[10px] font-medium uppercase ${config.color}`}>{config.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
