import { useRef, useEffect, useState, useCallback } from "react";
import { ArrowLeft, GitBranch, Clock, Loader2, ChevronUp, GitFork, Link2, ExternalLink, Sparkles } from "lucide-react";
import { useSessionStream } from "../../hooks/useSessionStream";
import { useWs } from "../../context/WebSocketContext";
import { EventRenderer } from "./EventRenderer";
import { UsageBar } from "./UsageBar";
import { api } from "../../lib/api";
import type { SessionEntry } from "../../lib/api";
import type { SessionEvent } from "../../lib/types";

interface SessionViewerProps {
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
  if (diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function SessionViewer({ session, onBack }: SessionViewerProps) {
  const { events, isLive, loading, error, usage } = useSessionStream(session.sessionId);
  const [analyzing, setAnalyzing] = useState(false);
  const { send } = useWs();

  // Auto-scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevEventCount = useRef(0);

  // Pagination for loading earlier events via REST
  const [earlierEvents, setEarlierEvents] = useState<SessionEvent[]>([]);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [totalEvents, setTotalEvents] = useState(0);

  // Check if there are earlier events to load
  useEffect(() => {
    if (events.length > 0 && totalEvents === 0) {
      // The WS stream sends all events, so check total from REST
      api.sessionEvents(session.sessionId, 0, 1).then((res) => {
        setTotalEvents(res.total);
        setHasEarlier(false); // WS already has all events
      }).catch(() => {});
    }
  }, [events.length, session.sessionId, totalEvents]);

  // Auto-scroll when new events arrive and autoScroll is enabled
  useEffect(() => {
    if (autoScroll && events.length > prevEventCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevEventCount.current = events.length;
  }, [events.length, autoScroll]);

  // Detect when user scrolls up (disable auto-scroll)
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setAutoScroll(atBottom);
  }, []);

  const handleAnalyze = useCallback(() => {
    setAnalyzing(true);
    send({ action: "session_insights", sessionId: session.sessionId });
    setTimeout(() => setAnalyzing(false), 3000);
  }, [send, session.sessionId]);

  const allEvents = [...earlierEvents, ...events];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold truncate">{session.summary || "Untitled Session"}</h2>
              {session.isSidechain && (
                <span className="text-[10px] font-medium text-[var(--accent-yellow)] bg-[var(--accent-yellow)]/10 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <GitFork size={10} />
                  Sidechain
                </span>
              )}
              {isLive && (
                <span className="text-[10px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
              <span>{session.projectName}</span>
              {session.gitBranch && (
                <span className="flex items-center gap-1">
                  <GitBranch size={11} />
                  {session.gitBranch}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {timeAgo(session.modified)}
              </span>
              {formatDuration(session.created, session.modified) && (
                <span>{formatDuration(session.created, session.modified)}</span>
              )}
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              analyzing
                ? "bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] cursor-wait"
                : "bg-[var(--accent-purple)] text-white hover:opacity-90"
            }`}
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {/* PR Link */}
        {session.prUrl && (
          <a
            href={session.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:underline mt-1"
          >
            <Link2 size={11} />
            PR #{session.prNumber}
            {session.prRepository && <span className="text-[var(--text-muted)]">({session.prRepository})</span>}
            <ExternalLink size={10} />
          </a>
        )}

        {/* Usage Bar */}
        {allEvents.length > 0 && (
          <div className="mt-2">
            <UsageBar events={allEvents} usage={usage} isLive={isLive} />
          </div>
        )}
      </div>

      {/* Events Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2"
      >
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading session...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center justify-center py-12 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Load earlier events button */}
        {hasEarlier && (
          <button
            onClick={async () => {
              setLoadingEarlier(true);
              try {
                const res = await api.sessionEvents(session.sessionId, 0, earlierEvents.length + 200);
                setEarlierEvents(res.events);
                setHasEarlier(res.hasMore);
              } catch {}
              setLoadingEarlier(false);
            }}
            disabled={loadingEarlier}
            className="w-full py-2 text-xs text-[var(--accent-blue)] hover:underline disabled:opacity-50"
          >
            {loadingEarlier ? "Loading..." : "Load earlier events"}
          </button>
        )}

        {/* Empty state */}
        {!loading && !error && allEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">No events found in this session</p>
            <p className="text-xs mt-1">The session file may be empty or unreadable</p>
          </div>
        )}

        {/* Event list */}
        {allEvents.map((event, i) => (
          <EventRenderer key={i} event={event} />
        ))}

        {/* Auto-scroll sentinel */}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button when not auto-scrolling */}
      {!autoScroll && isLive && (
        <button
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-blue)] text-white rounded-full text-xs shadow-lg hover:opacity-90 transition-opacity"
        >
          <ChevronUp size={12} className="rotate-180" />
          Follow live
        </button>
      )}
    </div>
  );
}
