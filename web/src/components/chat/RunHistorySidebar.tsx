import { MessageCircle, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { RunRecord } from "../../lib/types";

interface RunHistorySidebarProps {
  runs: Omit<RunRecord, "messages">[];
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_ICONS = {
  running: Loader2,
  completed: CheckCircle,
  error: AlertCircle,
};

const STATUS_COLORS = {
  running: "text-amber-500",
  completed: "text-emerald-500",
  error: "text-red-500",
};

export function RunHistorySidebar({ runs, selectedRunId, onSelectRun }: RunHistorySidebarProps) {
  return (
    <aside className="w-64 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col shrink-0 overflow-y-auto">
      <div className="p-3 border-b border-[var(--border-color)]">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Chat History</h3>
      </div>

      <div className="flex-1 p-2 space-y-0.5">
        {/* Current Session button */}
        <button
          onClick={() => onSelectRun(null)}
          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
            !selectedRunId
              ? "bg-blue-600/15 text-[var(--accent-blue)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <MessageCircle size={14} />
          Current Session
        </button>

        {/* Past runs */}
        {runs.map((run) => {
          const Icon = STATUS_ICONS[run.status];
          const color = STATUS_COLORS[run.status];
          const isSelected = selectedRunId === run.id;

          return (
            <button
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                isSelected
                  ? "bg-blue-600/15 text-[var(--accent-blue)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Icon size={12} className={`shrink-0 ${color} ${run.status === "running" ? "animate-spin" : ""}`} />
                <span className="text-xs text-[var(--text-muted)]">{timeAgo(run.startedAt)}</span>
              </div>
              <p className="text-xs truncate">{run.question}</p>
            </button>
          );
        })}

        {runs.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-[var(--text-muted)]">No past conversations yet</p>
          </div>
        )}
      </div>
    </aside>
  );
}
