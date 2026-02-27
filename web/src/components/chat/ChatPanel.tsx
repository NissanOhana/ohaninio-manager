import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I can answer questions about your Claude Code sessions. Try asking:\n- \"What did I work on today?\"\n- \"What's my most critical task?\"\n- \"Summarize premium-billing activity\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      // Fetch context data and generate a response locally
      const [overviewRes, todayRes] = await Promise.all([
        fetch("/api/overview").then((r) => r.json()),
        fetch("/api/sessions/today").then((r) => r.json()),
      ]);

      const context = buildContextResponse(userMessage, overviewRes, todayRes);
      setMessages((prev) => [...prev, { role: "assistant", content: context }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't fetch the data. Is the server running?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] h-72 flex flex-col shrink-0">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
          <MessageCircle size={14} className="text-blue-400" />
          Session Chat
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600/20 text-[var(--accent-blue)] border border-blue-600/20"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)]"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-muted)]">
              Thinking...
            </div>
          </div>
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
          className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-blue-500/50"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function buildContextResponse(query: string, overview: any, todaySessions: any): string {
  const q = query.toLowerCase();

  // Today's work
  if (q.includes("today") || q.includes("work on") || q.includes("what did")) {
    const sessions = todaySessions.sessions || [];
    if (sessions.length === 0) return "No sessions recorded today yet.";

    const lines = sessions.map((s: any) => {
      const time = new Date(s.modified).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${time} [${s.projectName}] ${s.summary} (${s.messageCount} messages)`;
    });
    return `Today's sessions (${sessions.length}):\n\n${lines.join("\n")}`;
  }

  // Critical / urgent
  if (q.includes("critical") || q.includes("urgent") || q.includes("important") || q.includes("attention")) {
    const statuses = overview.statuses || [];
    const critical = statuses.filter((s: any) => s.priority === "critical" || s.priority === "in_progress");
    if (critical.length === 0) return "No critical items right now. All projects are stable.";

    const lines = critical.map((s: any, i: number) => {
      const icon = s.priority === "critical" ? "🔴" : "🟡";
      return `${i + 1}. ${icon} ${s.projectName}: ${s.summary}\n   Signals: ${s.signals.slice(0, 3).join(", ")}`;
    });
    return `Projects needing attention:\n\n${lines.join("\n\n")}`;
  }

  // Specific project
  const projects = overview.projects || [];
  const matchedProject = projects.find((p: any) => q.includes(p.name.toLowerCase()));
  if (matchedProject) {
    const status = (overview.statuses || []).find((s: any) => s.projectId === matchedProject.id);
    const sessions = status?.recentSessions || [];
    const sessLines = sessions.slice(0, 5).map((s: any) => {
      const date = new Date(s.modified).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `  ${date} — ${s.summary}`;
    });

    return `${matchedProject.name}:\n• ${matchedProject.sessionCount} total sessions, ${matchedProject.todayCount} today\n• Status: ${status?.priority || "unknown"}\n• Latest: ${status?.summary || "N/A"}\n\nRecent sessions:\n${sessLines.join("\n")}`;
  }

  // Memory
  if (q.includes("memory") || q.includes("memories")) {
    const health = overview.memoryHealth || [];
    const lines = health
      .filter((h: any) => !h.projectName.includes("workspaces-"))
      .map((h: any) => {
        const icon = h.status === "ok" ? "✓" : h.status === "stale" ? "⚠" : "✗";
        return `${icon} ${h.projectName}: ${h.fileCount} files, ${h.status}${h.sessionsSinceUpdate > 0 ? ` (+${h.sessionsSinceUpdate} sessions since update)` : ""}`;
      });
    return `Memory health:\n\n${lines.join("\n")}`;
  }

  // Stats
  if (q.includes("stats") || q.includes("overview") || q.includes("summary")) {
    const stats = overview.stats || {};
    const projectCount = projects.filter((p: any) => !p.name.includes("workspaces-")).length;
    return `Overview:\n• ${stats.total} total prompts\n• ${stats.today} today, ${stats.thisWeek} this week\n• ${projectCount} active projects\n\nTop projects by sessions:\n${projects
      .filter((p: any) => !p.name.includes("workspaces-"))
      .slice(0, 5)
      .map((p: any) => `  ${p.name}: ${p.sessionCount} sessions`)
      .join("\n")}`;
  }

  // Default
  return `I can help with:\n• "What did I work on today?"\n• "What's most critical?"\n• "Tell me about [project name]"\n• "How's my memory health?"\n• "Give me an overview"\n\nTry one of these questions!`;
}
