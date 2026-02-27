import { Radio, MessageSquare, GitBranch, Loader2 } from "lucide-react";
import type { LiveSession } from "../../lib/api";

interface LiveSessionsProps {
  sessions: LiveSession[];
  onSelectSession?: (session: LiveSession) => void;
}

export function LiveSessions({ sessions, onSelectSession }: LiveSessionsProps) {
  if (sessions.length === 0) {
    return (
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Radio size={14} className="text-[var(--accent-green)]" />
          Live Sessions
        </h2>
        <div className="text-center py-8">
          <Radio size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">No running Claude sessions</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">Running Claude Code processes will appear here</p>
        </div>
      </section>
    );
  }

  const thinkingCount = sessions.filter((s) => s.status === "thinking").length;

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Radio size={14} className="text-[var(--accent-green)]" />
        Live Sessions
        <span className="text-[10px] font-normal text-[var(--accent-green)] bg-[var(--accent-green)]/10 px-1.5 py-0.5 rounded-full">
          {sessions.length} running
        </span>
        {thinkingCount > 0 && (
          <span className="text-[10px] font-normal text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Loader2 size={9} className="animate-spin" />
            {thinkingCount} thinking
          </span>
        )}
      </h2>
      <div className="space-y-2">
        {sessions.map((session, i) => {
          const isThinking = session.status === "thinking";
          return (
            <button
              key={session.sessionId || i}
              onClick={() => onSelectSession?.(session)}
              className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <div className="mt-1.5 shrink-0">
                {isThinking ? (
                  <Loader2 size={12} className="text-[var(--accent-yellow)] animate-spin" />
                ) : (
                  <span className="block w-2.5 h-2.5 rounded-full bg-[var(--accent-green)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-[var(--accent-blue)] shrink-0">
                    {session.projectName}
                  </span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    isThinking
                      ? "text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10"
                      : "text-[var(--accent-green)] bg-[var(--accent-green)]/10"
                  }`}>
                    {isThinking ? "Thinking" : "Idle"}
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
                  {session.prUrl && (
                    <span className="text-[10px] text-[var(--accent-purple)]">
                      PR #{session.prNumber}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
