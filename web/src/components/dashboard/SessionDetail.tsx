import { useState, useCallback } from "react";
import { ArrowLeft, MessageSquare, GitBranch, Clock, ExternalLink, ChevronDown, ChevronUp, Link2, Sparkles, GitFork, Loader2 } from "lucide-react";
import { useWs } from "../../context/WebSocketContext";
import type { SessionEntry } from "../../lib/api";

interface SessionDetailProps {
  session: SessionEntry & { projectName: string };
  onBack: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(startStr: string, endStr: string): string {
  const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
  if (diff < 0) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function SessionDetail({ session, onBack }: SessionDetailProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { send } = useWs();
  const promptTruncated = session.firstPrompt && session.firstPrompt.length > 200;

  const handleAnalyze = useCallback(() => {
    setAnalyzing(true);
    send({ action: "session_insights", sessionId: session.sessionId });
    // Reset after a timeout (the agent will stream results elsewhere)
    setTimeout(() => setAnalyzing(false), 3000);
  }, [send, session.sessionId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold truncate">{session.summary || "Untitled Session"}</h2>
            {session.isSidechain && (
              <span className="text-[10px] font-medium text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <GitFork size={10} />
                Sidechain
              </span>
            )}
          </div>
          <span className="text-sm text-[var(--text-muted)]">{session.projectName}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={14} className="text-blue-400" />
            <span className="text-xs text-[var(--text-muted)]">Messages</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{session.messageCount}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={14} className="text-green-400" />
            <span className="text-xs text-[var(--text-muted)]">Branch</span>
          </div>
          <div className="text-sm font-medium text-green-400 truncate">{session.gitBranch || "—"}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-yellow-400" />
            <span className="text-xs text-[var(--text-muted)]">Created</span>
          </div>
          <div className="text-sm font-medium text-yellow-400">{timeAgo(session.created)}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-purple-400" />
            <span className="text-xs text-[var(--text-muted)]">Duration</span>
          </div>
          <div className="text-sm font-medium text-purple-400">{formatDuration(session.created, session.modified)}</div>
        </div>
      </div>

      {/* PR Link */}
      {session.prUrl && (
        <a
          href={session.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <Link2 size={14} className="text-purple-400" />
          <span className="text-sm text-purple-400 font-medium">PR #{session.prNumber}</span>
          {session.prRepository && (
            <span className="text-xs text-[var(--text-muted)]">({session.prRepository})</span>
          )}
          <ExternalLink size={12} className="text-[var(--text-muted)] ml-auto" />
        </a>
      )}

      {/* First Prompt */}
      {session.firstPrompt && (
        <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            First Prompt
          </h3>
          <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {promptExpanded || !promptTruncated
              ? session.firstPrompt
              : session.firstPrompt.slice(0, 200) + "…"}
          </div>
          {promptTruncated && (
            <button
              onClick={() => setPromptExpanded(!promptExpanded)}
              className="flex items-center gap-1 mt-2 text-xs text-[var(--accent-blue)] hover:underline"
            >
              {promptExpanded ? (
                <>
                  <ChevronUp size={12} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={12} /> Show more
                </>
              )}
            </button>
          )}
        </section>
      )}

      {/* Metadata */}
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Metadata
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Session ID</span>
            <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5 truncate">{session.sessionId}</p>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Project</span>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{session.projectName}</p>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Path</span>
            <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5 truncate">{session.projectPath}</p>
          </div>
          {session.isSidechain && (
            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Type</span>
              <p className="text-xs text-yellow-400 mt-0.5">Sidechain</p>
            </div>
          )}
          {session.name && (
            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Name</span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{session.name}</p>
            </div>
          )}
        </div>
      </section>

      {/* Analyze CTA */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
          analyzing
            ? "bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] cursor-wait"
            : "bg-[var(--accent-purple)] text-white hover:opacity-90"
        }`}
      >
        {analyzing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Analyze this session
          </>
        )}
      </button>
    </div>
  );
}
