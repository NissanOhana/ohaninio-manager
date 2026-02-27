import { Folder, BarChart3, Clock, Database } from "lucide-react";
import type { ProjectSummary, HistoryStats } from "../../lib/api";

interface SidebarProps {
  projects: ProjectSummary[];
  stats: HistoryStats;
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Sidebar({ projects, stats, selectedProject, onSelectProject }: SidebarProps) {
  // Filter out worktree junk projects with long hashed names
  const mainProjects = projects.filter(
    (p) => !p.name.includes("workspaces-") && p.sessionCount > 0,
  );

  return (
    <aside className="w-64 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col shrink-0 overflow-y-auto">
      {/* Quick Stats */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-[var(--accent-blue)]">{stats.today}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Today</div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-[var(--accent-purple)]">{stats.thisWeek}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">This Week</div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-[var(--text-secondary)]">{stats.total}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Total</div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-[var(--accent-green)]">{mainProjects.length}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Projects</div>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 p-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">Projects</h3>
        <button
          onClick={() => onSelectProject(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors flex items-center gap-2 ${
            !selectedProject
              ? "bg-blue-600/15 text-[var(--accent-blue)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <BarChart3 size={14} />
          Dashboard
        </button>
        {mainProjects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
              selectedProject === project.id
                ? "bg-blue-600/15 text-[var(--accent-blue)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Folder size={13} className="shrink-0 opacity-50" />
                <span className="truncate">{project.name}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">{project.sessionCount}</span>
            </div>
            {project.todayCount > 0 && (
              <div className="text-[10px] text-green-500 ml-5 mt-0.5">
                {project.todayCount} today
              </div>
            )}
            <div className="text-[10px] text-[var(--text-muted)] ml-5 mt-0.5 flex items-center gap-1">
              <Clock size={9} />
              {timeAgo(project.lastActivity)}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
