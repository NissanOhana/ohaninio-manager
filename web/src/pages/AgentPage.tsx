import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, ArrowLeft } from "lucide-react";
import { RunHistorySidebar } from "../components/chat/RunHistorySidebar";
import { ChatInput } from "../components/chat/ChatInput";
import {
  AssistantTextBubble,
  UserQuestionBubble,
  LoadingDots,
  renderAgentTurn,
} from "../components/chat/MessageList";
import { useRunHistory } from "../hooks/useRunHistory";
import type { AgentMessage, ChatMessage } from "../lib/types";

export function AgentPage() {
  const { runs, selectedRun, fetchRuns, selectRun } = useRunHistory();
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [running, setRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAgentMsgsRef = useRef<AgentMessage[]>([]);

  const isViewingHistory = !!selectedRun;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, streamingText, selectedRun]);

  // WebSocket connection for chat
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "agent:start") {
          setRunning(true);
          setStreamingText("");
          currentAgentMsgsRef.current = [];
          return;
        }

        if (data.type === "agent:text_delta") {
          setStreamingText((prev) => prev + data.content);
          return;
        }

        if (data.type === "agent:text" || data.type === "agent:thinking" || data.type === "agent:tool") {
          currentAgentMsgsRef.current.push(data);
          setConversation((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "agent") {
              copy[copy.length - 1] = { ...last, messages: [...currentAgentMsgsRef.current] };
            }
            return copy;
          });
          if (data.type === "agent:text") {
            setStreamingText("");
          }
          return;
        }

        if (data.type === "agent:complete" || data.type === "agent:error") {
          currentAgentMsgsRef.current.push(data);
          setConversation((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "agent") {
              copy[copy.length - 1] = { ...last, messages: [...currentAgentMsgsRef.current] };
            }
            return copy;
          });
          setRunning(false);
          setStreamingText("");
          fetchRuns(); // Refresh run list
          return;
        }

        if (data.type === "run:started" || data.type === "run:completed") {
          fetchRuns();
          return;
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [fetchRuns]);

  const handleSend = useCallback(
    (question: string) => {
      if (running || !wsRef.current || isViewingHistory) return;

      setConversation((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "agent", messages: [] },
      ]);
      currentAgentMsgsRef.current = [];

      wsRef.current.send(JSON.stringify({ action: "chat", question }));
    },
    [running, isViewingHistory],
  );

  const handleStop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "chat_stop" }));
    setRunning(false);
  }, []);

  const handleBackToCurrent = useCallback(() => {
    selectRun(null);
  }, [selectRun]);

  // Build display messages - either current conversation or historical run
  const displayMessages: ChatMessage[] = isViewingHistory && selectedRun
    ? [
        { role: "user" as const, content: selectedRun.question },
        { role: "agent" as const, messages: selectedRun.messages || [] },
      ]
    : conversation;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar - run history */}
      <RunHistorySidebar
        runs={runs}
        selectedRunId={selectedRun?.id || null}
        onSelectRun={selectRun}
      />

      {/* Right panel - messages + input */}
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
        {/* History banner */}
        {isViewingHistory && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <button
              onClick={handleBackToCurrent}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
            >
              <ArrowLeft size={12} />
              Back to current session
            </button>
            <span className="text-xs text-[var(--text-muted)]">Viewing past conversation</span>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {displayMessages.length === 0 && !isViewingHistory && (
            <div className="flex flex-col items-center justify-center h-full">
              <Bot size={40} className="text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-lg text-[var(--text-muted)] mb-1">Session Agent</p>
              <p className="text-sm text-[var(--text-muted)] mb-6">Ask about your Claude Code sessions across all projects</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "What did I work on today?",
                  "What's most critical right now?",
                  "How's my memory health?",
                  "Show project activity summary",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map((turn, i) => {
            if (turn.role === "user") {
              return <UserQuestionBubble key={i} content={turn.content || ""} />;
            }
            return (
              <div key={i} className="space-y-2">
                {renderAgentTurn(turn.messages || [])}
              </div>
            );
          })}

          {/* Streaming text */}
          {running && streamingText && <AssistantTextBubble content={streamingText} />}

          {/* Loading indicator */}
          {running && !streamingText && conversation.length > 0 && <LoadingDots />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          running={running}
          disabled={isViewingHistory}
          placeholder={isViewingHistory ? "Viewing past conversation..." : "Ask about your sessions..."}
        />
      </div>
    </div>
  );
}
