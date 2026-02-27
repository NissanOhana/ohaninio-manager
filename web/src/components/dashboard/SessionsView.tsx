import { Radio, Clock, MessageSquare, GitBranch, Loader2, GitFork, Timer } from "lucide-react";
import type { LiveSession, SessionEntry } from "../../lib/api";

interface SessionsViewProps {
  liveSessions: LiveSession[];
  todaySessions: (SessionEntry & { projectName: string })[];
  onSelectSession: (session: SessionEntry & { projectName: string }) => void;
}

function formatDuration(startStr: string, endStr: string): string {
  const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
  if (diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h${remMins}m` : `${hours}h`;
}

export function SessionsView({ liveSessions, todaySessions, onSelectSession }: SessionsViewProps) {
  const thinkingCount = liveSessions.filter((s) => s.status === "thinking").length;
  const hasLive = liveSessions.length > 0;

  return (
    <div className="space-y-4">
      {/* Live Sessions - Hero */}
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
            <Radio size={14} className={hasLive ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]"} />
            Active Sessions
            {hasLive && (
              <span className="text-[10px] font-normal text-[var(--accent-green)] bg-[var(--accent-green)]/10 px-1.5 py-0.5 rounded-full">
                {liveSessions.length} running
              </span>
            )}
            {thinkingCount > 0 && (
              <span className="text-[10px] font-normal text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Loader2 size={9} className="animate-spin" />
                {thinkingCount} thinking
              </span>
            )}
          </h2>
        </div>

        {hasLive ? (
          <div className="space-y-1">
            {liveSessions.map((session, i) => {
              const isThinking = session.status === "thinking";
              return (
                <button
                  key={session.sessionId || i}
                  onClick={() => onSelectSession(session)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition-all hover:bg-[var(--bg-tertiary)] ${
                    isThinking ? "bg-[var(--accent-yellow)]/5 border border-[var(--accent-yellow)]/20" : "border border-transparent"
                  }`}
                >
                  <div className="mt-1.5 shrink-0">
                    {isThinking ? (
                      <Loader2 size={14} className="text-[var(--accent-yellow)] animate-spin" />
                    ) : (
                      <span className="block w-3 h-3 rounded-full bg-[var(--accent-green)] shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {session.projectName}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        isThinking
                          ? "text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10"
                          : "text-[var(--accent-green)] bg-[var(--accent-green)]/10"
                      }`}>
                        {isThinking ? "Thinking" : "Idle"}
                      </span>
                      {session.isSidechain && (
                        <span className="text-[10px] font-medium text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <GitFork size={9} />
                          Sidechain
                        </span>
                      )}
                      {session.gitBranch && (
                        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 truncate">
                          <GitBranch size={9} />
                          {session.gitBranch}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{session.summary}</p>
                    <div className="flex items-center gap-3 mt-1">
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
        ) : (
          <div className="text-center py-6">
            <Radio size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
            <p className="text-sm text-[var(--text-muted)]">No running Claude sessions</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">Active processes will appear here automatically</p>
          </div>
        )}
      </section>

      {/* Today's Sessions */}
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock size={14} className="text-[var(--accent-blue)]" />
          Today's Sessions
          {todaySessions.length > 0 && (
            <span className="text-[10px] font-normal text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-1.5 py-0.5 rounded-full">
              {todaySessions.length}
            </span>
          )}
        </h2>

        {todaySessions.length > 0 ? (
          <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
            {todaySessions.map((session, i) => {
              // Check if this is also a live session
              const isLive = liveSessions.some((ls) => ls.sessionId === session.sessionId);
              return (
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
                      {isLive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] shadow-[0_0_4px_rgba(34,197,94,0.4)]" />
                      )}
                      {session.isSidechain && (
                        <span className="text-[10px] font-medium text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <GitFork size={9} />
                          Sidechain
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
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                        <MessageSquare size={9} />
                        {session.messageCount} msgs
                      </span>
                      {session.created && session.modified && (
                        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                          <Timer size={9} />
                          {formatDuration(session.created, session.modified)}
                        </span>
                      )}
                      {session.prNumber && (
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
        ) : (
          <div className="text-center py-6">
            <Clock size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
            <p className="text-sm text-[var(--text-muted)]">No sessions today yet</p>
          </div>
        )}
      </section>
    </div>
  );
}
