import { useState } from "react";
import {
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
import type { AgentMessage, MessageGroup } from "../../lib/types";

// --- Message Grouping ---

export function groupMessages(messages: AgentMessage[]): MessageGroup[] {
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

export function ThinkingBubble({ content }: { content: string }) {
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

export function ToolGroup({ messages }: { messages: AgentMessage[] }) {
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

export function AssistantTextBubble({ content }: { content: string }) {
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

export function UserQuestionBubble({ content }: { content: string }) {
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

export function LoadingDots() {
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

// --- Render helpers ---

export function renderAgentTurn(messages: AgentMessage[]) {
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

export function ResultCard({ message }: { message: Extract<AgentMessage, { type: "agent:complete" }> }) {
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

export function ErrorCard({ message }: { message: Extract<AgentMessage, { type: "agent:error" }> }) {
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
