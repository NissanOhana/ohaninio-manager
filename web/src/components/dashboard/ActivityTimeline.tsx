import { MessageSquare, GitBranch } from "lucide-react";
import type { SessionEntry } from "../../lib/api";

interface ActivityTimelineProps {
  sessions: (SessionEntry & { projectName: string })[];
}

export function ActivityTimeline({ sessions }: ActivityTimelineProps) {
  if (sessions.length === 0) {
    return (
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Today's Activity
        </h2>
        <p className="text-sm text-[var(--text-muted)] text-center py-8">No sessions today yet</p>
      </section>
    );
  }

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Today's Activity
      </h2>
      <div className="space-y-2">
        {sessions.slice(0, 15).map((session, i) => {
          const time = new Date(session.modified).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          return (
            <div
              key={session.sessionId || i}
              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <span className="text-xs font-mono text-[var(--text-muted)] shrink-0 mt-0.5 w-12">{time}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-blue-400 shrink-0">{session.projectName}</span>
                  {session.gitBranch && (
                    <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 truncate">
                      <GitBranch size={9} />
                      {session.gitBranch}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] truncate">{session.summary}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                    <MessageSquare size={9} />
                    {session.messageCount} msgs
                  </span>
                  {session.prUrl && (
                    <span className="text-[10px] text-purple-400">
                      PR #{session.prNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
