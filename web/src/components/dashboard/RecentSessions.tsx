import { Clock, MessageSquare, GitBranch } from "lucide-react";
import type { SessionEntry } from "../../lib/api";

interface RecentSessionsProps {
  sessions: (SessionEntry & { projectName: string })[];
  onSelectSession: (session: SessionEntry & { projectName: string }) => void;
}

export function RecentSessions({ sessions, onSelectSession }: RecentSessionsProps) {
  if (sessions.length === 0) {
    return (
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock size={14} className="text-[var(--accent-blue)]" />
          Today's Sessions
        </h2>
        <div className="text-center py-8">
          <Clock size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">No sessions today</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Clock size={14} className="text-[var(--accent-blue)]" />
        Today's Sessions
        <span className="text-[10px] font-normal text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-1.5 py-0.5 rounded-full">
          {sessions.length}
        </span>
      </h2>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {sessions.map((session, i) => (
          <button
            key={session.sessionId || i}
            onClick={() => onSelectSession(session)}
            className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <span className="text-xs text-[var(--text-muted)] shrink-0 w-12 mt-0.5 font-mono">
              {new Date(session.modified).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-medium text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-1.5 py-0.5 rounded shrink-0">
                  {session.projectName}
                </span>
                {session.gitBranch && (
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 truncate">
                    <GitBranch size={9} />
                    {session.gitBranch}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">{session.summary}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                  <MessageSquare size={9} />
                  {session.messageCount} msgs
                </span>
                {session.prNumber && (
                  <span className="text-[10px] text-[var(--accent-purple)]">
                    PR #{session.prNumber}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
