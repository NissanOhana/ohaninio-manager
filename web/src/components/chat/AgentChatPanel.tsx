import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Square,
  MessageCircle,
  Brain,
  Wrench,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  Bot,
  User,
} from "lucide-react";

// --- Types ---

type AgentMessage =
  | { type: "agent:start" }
  | { type: "agent:text"; content: string }
  | { type: "agent:text_delta"; content: string }
  | { type: "agent:thinking"; content: string }
  | { type: "agent:tool"; tool: string; status: "running" | "done"; summary?: string; input?: string }
  | { type: "agent:complete"; summary: string; costUsd?: number; durationMs?: number; totalTokens?: number }
  | { type: "agent:error"; message: string };

interface ChatMessage {
  role: "user" | "agent";
  messages: AgentMessage[];
  content?: string;
}

interface MessageGroup {
  kind: "text" | "thinking" | "tools" | "complete" | "error" | "streaming";
  content?: string;
  messages: AgentMessage[];
}

// --- Message Grouping ---

function groupMessages(messages: AgentMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentText = "";
  let currentThinking = "";
  const currentTools: AgentMessage[] = [];

  function flushText() {
    if (currentText) {
      groups.push({ kind: "text", content: currentText, messages: [] });
      currentText = "";
    }
  }
  function flushThinking() {
    if (currentThinking) {
      groups.push({ kind: "thinking", content: currentThinking, messages: [] });
      currentThinking = "";
    }
  }
  function flushTools() {
    if (currentTools.length > 0) {
      groups.push({ kind: "tools", messages: [...currentTools] });
      currentTools.length = 0;
    }
  }

  for (const msg of messages) {
    switch (msg.type) {
      case "agent:thinking":
        flushText();
        flushTools();
        currentThinking += (msg as any).content + "\n";
        break;
      case "agent:text":
        flushThinking();
        flushTools();
        currentText += (msg as any).content;
        break;
      case "agent:tool":
        flushText();
        flushThinking();
        currentTools.push(msg);
        break;
      case "agent:complete":
        flushText();
        flushThinking();
        flushTools();
        groups.push({ kind: "complete", messages: [msg] });
        break;
      case "agent:error":
        flushText();
        flushThinking();
        flushTools();
        groups.push({ kind: "error", messages: [msg] });
        break;
    }
  }

  flushThinking();
  flushText();
  flushTools();

  return groups;
}

// --- Sub-Components ---

function ThinkingBubble({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 120);
  const hasMore = content.length > 120;

  return (
    <div className="border border-violet-300/30 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 rounded-lg overflow-hidden animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
      >
        <Brain size={13} className="shrink-0" />
        <span className="font-medium">Thinking</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 text-xs text-violet-700/70 dark:text-violet-300/60 whitespace-pre-wrap font-mono leading-relaxed">
          {content.trim()}
        </div>
      )}
      {!expanded && hasMore && (
        <div className="px-3 pb-2 text-[11px] text-violet-500/50 dark:text-violet-400/40 truncate italic">
          {preview}...
        </div>
      )}
    </div>
  );
}

function ToolGroup({ messages }: { messages: AgentMessage[] }) {
  const [expanded, setExpanded] = useState(false);
  const tools = messages.filter((m) => m.type === "agent:tool") as Extract<AgentMessage, { type: "agent:tool" }>[];
  const allDone = tools.every((t) => t.status === "done");
  const runningCount = tools.filter((t) => t.status === "running").length;

  return (
    <div
      className={`border rounded-lg overflow-hidden animate-fade-in ${
        allDone
          ? "border-emerald-300/30 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10"
          : "border-amber-300/30 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
          allDone
            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/40 dark:hover:bg-emerald-900/20"
            : "text-amber-600 dark:text-amber-400 hover:bg-amber-100/40 dark:hover:bg-amber-900/20"
        }`}
      >
        <Wrench size={13} className="shrink-0" />
        <span className="font-medium">
          {allDone ? `${tools.length} tool${tools.length > 1 ? "s" : ""} completed` : `${runningCount} tool${runningCount > 1 ? "s" : ""} running...`}
        </span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 space-y-1.5">
          {tools.map((tool, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 shrink-0 ${tool.status === "done" ? "text-emerald-500" : "text-amber-500"}`}>
                {tool.status === "done" ? <CheckCircle size={11} /> : <Clock size={11} className="animate-spin" />}
              </span>
              <div className="min-w-0">
                <span className="font-medium text-[var(--text-primary)]">{tool.tool}</span>
                {tool.summary && (
                  <p className="text-[var(--text-muted)] truncate mt-0.5">{tool.summary}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantTextBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2.5 animate-fade-in">
      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={13} className="text-[var(--accent-blue)]" />
      </div>
      <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </div>
  );
}

function UserQuestionBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2.5 justify-end animate-fade-in">
      <div className="max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
        {content}
      </div>
      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 mt-0.5">
        <User size={13} className="text-[var(--text-muted)]" />
      </div>
    </div>
  );
}

function ResultCard({ message }: { message: Extract<AgentMessage, { type: "agent:complete" }> }) {
  const duration = message.durationMs ? `${(message.durationMs / 1000).toFixed(1)}s` : null;
  const cost = message.costUsd ? `$${message.costUsd.toFixed(4)}` : null;

  return (
    <div className="border border-emerald-300/30 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-lg px-3.5 py-2.5 animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle size={13} />
        <span className="font-medium">Done</span>
        {duration && (
          <span className="flex items-center gap-1 text-[var(--text-muted)]">
            <Clock size={10} /> {duration}
          </span>
        )}
        {cost && (
          <span className="flex items-center gap-1 text-[var(--text-muted)]">
            <Zap size={10} /> {cost}
          </span>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: Extract<AgentMessage, { type: "agent:error" }> }) {
  return (
    <div className="border border-red-300/30 dark:border-red-800/40 bg-red-50/30 dark:bg-red-950/10 rounded-lg px-3.5 py-2.5 animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
        <AlertCircle size={13} />
        <span className="font-medium">Error</span>
      </div>
      <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-1">{message.message}</p>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-2 px-1 py-2 animate-fade-in">
      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
        <Bot size={13} className="text-[var(--accent-blue)]" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-xs text-[var(--text-muted)]">Thinking...</span>
      </div>
    </div>
  );
}

// --- Main Component ---

interface AgentChatPanelProps {
  onClose: () => void;
}

export function AgentChatPanel({ onClose }: AgentChatPanelProps) {
  const [conversation, setConversation] = useState<Array<{ role: "user" | "agent"; content?: string; messages?: AgentMessage[] }>>([]);
  const [streamingText, setStreamingText] = useState("");
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentAgentMsgsRef = useRef<AgentMessage[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, streamingText]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
          // Force re-render with current messages
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
          return;
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || running || !wsRef.current) return;

    const question = input.trim();
    setInput("");
    setConversation((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "agent", messages: [] },
    ]);
    currentAgentMsgsRef.current = [];

    wsRef.current.send(JSON.stringify({ action: "chat", question }));
  }, [input, running]);

  const handleStop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "chat_stop" }));
    setRunning(false);
  }, []);

  // Render message groups for an agent turn
  function renderAgentTurn(messages: AgentMessage[]) {
    const groups = groupMessages(messages);
    return groups.map((group, i) => {
      switch (group.kind) {
        case "thinking":
          return <ThinkingBubble key={i} content={group.content || ""} />;
        case "text":
          return <AssistantTextBubble key={i} content={group.content || ""} />;
        case "tools":
          return <ToolGroup key={i} messages={group.messages} />;
        case "complete":
          return <ResultCard key={i} message={group.messages[0] as any} />;
        case "error":
          return <ErrorCard key={i} message={group.messages[0] as any} />;
        default:
          return null;
      }
    });
  }

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] h-80 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
          <MessageCircle size={14} className="text-[var(--accent-blue)]" />
          Session Agent
          {running && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Running
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.length === 0 && (
          <div className="text-center py-6">
            <Bot size={24} className="text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">Ask about your Claude Code sessions</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {["What did I work on today?", "What's most critical?", "How's my memory health?"].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {conversation.map((turn, i) => {
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
        {running && streamingText && (
          <AssistantTextBubble content={streamingText} />
        )}

        {/* Loading indicator */}
        {running && !streamingText && conversation.length > 0 && (
          <LoadingDots />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border-color)] flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about your sessions..."
          className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-blue)]/50 transition-colors"
          disabled={running}
        />
        {running ? (
          <button
            onClick={handleStop}
            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
