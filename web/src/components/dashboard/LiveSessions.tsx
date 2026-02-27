import { Radio, MessageSquare, GitBranch } from "lucide-react";
import type { LiveSession } from "../../lib/api";

interface LiveSessionsProps {
  sessions: LiveSession[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function LiveSessions({ sessions }: LiveSessionsProps) {
  if (sessions.length === 0) {
    return (
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Radio size={14} className="text-[var(--accent-green)]" />
          Live Sessions
        </h2>
        <div className="text-center py-8">
          <Radio size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">No active sessions right now</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">Sessions active in the last 15 minutes will appear here</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Radio size={14} className="text-[var(--accent-green)]" />
        Live Sessions
        <span className="text-[10px] font-normal text-[var(--accent-green)] bg-[var(--accent-green)]/10 px-1.5 py-0.5 rounded-full">
          {sessions.length} active
        </span>
      </h2>
      <div className="space-y-2">
        {sessions.map((session, i) => (
          <div
            key={session.sessionId || i}
            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <div className="mt-1.5 shrink-0">
              <span
                className={`block w-2 h-2 rounded-full ${
                  session.isActive
                    ? "bg-[var(--accent-green)] animate-pulse"
                    : "bg-[var(--accent-yellow)]"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-[var(--accent-blue)] shrink-0">
                  {session.projectName}
                </span>
                {session.isActive && (
                  <span className="text-[9px] font-medium text-[var(--accent-green)] bg-[var(--accent-green)]/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Live
                  </span>
                )}
                {session.gitBranch && (
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 truncate">
                    <GitBranch size={9} />
                    {session.gitBranch}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">{session.summary}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-[var(--text-muted)]">
                  {timeAgo(session.modified)}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                  <MessageSquare size={9} />
                  {session.messageCount} msgs
                </span>
                {session.prUrl && (
                  <span className="text-[10px] text-[var(--accent-purple)]">
                    PR #{session.prNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
