import { AlertCircle, Clock, CheckCircle, Moon } from "lucide-react";
import type { ProjectStatus } from "../../lib/api";

interface StatusCardsProps {
  statuses: ProjectStatus[];
  onSelectProject: (id: string) => void;
}

const PRIORITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-500",
    label: "Needs Attention",
  },
  in_progress: {
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dot: "bg-yellow-500",
    label: "In Progress",
  },
  stable: {
    icon: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    dot: "bg-green-500",
    label: "Stable",
  },
  dormant: {
    icon: Moon,
    color: "text-gray-500",
    bg: "bg-gray-500/10 border-gray-500/20",
    dot: "bg-gray-600",
    label: "Dormant",
  },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function StatusCards({ statuses, onSelectProject }: StatusCardsProps) {
  // Only show non-dormant + top 2 dormant
  const active = statuses.filter((s) => s.priority !== "dormant");
  const dormant = statuses.filter((s) => s.priority === "dormant").slice(0, 2);
  const visible = [...active, ...dormant];

  if (visible.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        What Needs Attention
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map((status) => {
          const config = PRIORITY_CONFIG[status.priority];
          const Icon = config.icon;

          return (
            <button
              key={status.projectId}
              onClick={() => onSelectProject(status.projectId)}
              className={`text-left p-4 rounded-xl border ${config.bg} transition-all hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
                  <span className="font-medium text-sm text-[var(--text-primary)]">{status.projectName}</span>
                </div>
                <Icon size={16} className={config.color} />
              </div>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">{status.summary}</p>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(status.lastActivity)}</span>
              </div>
              {status.openPRs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
                  {status.openPRs.slice(0, 2).map((pr) => (
                    <div key={pr.number} className="text-[10px] text-blue-400 truncate">
                      PR #{pr.number}
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
