import { useState } from "react";
import Markdown from "react-markdown";
import {
  User,
  Bot,
  Terminal,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  Scissors,
  Clock,
  Workflow,
  Server,
  Hourglass,
  FileJson,
  Wrench,
} from "lucide-react";
import type { SessionEvent, AssistantBlock } from "../../lib/types";

interface EventRendererProps {
  event: SessionEvent;
}

export function EventRenderer({ event }: EventRendererProps) {
  switch (event.kind) {
    case "user_message":
      return <UserMessage content={event.content} timestamp={event.timestamp} />;
    case "assistant_turn":
      return <AssistantTurn blocks={event.blocks} model={event.model} timestamp={event.timestamp} />;
    case "tool_result":
      return <ToolResult content={event.content} isError={event.isError} />;
    case "bash_output":
      return <BashOutput output={event.output} />;
    case "agent_task":
      return <AgentTask description={event.description} operation={event.operation} />;
    case "mcp_call":
      return <McpCall serverName={event.serverName} toolName={event.toolName} status={event.status} />;
    case "waiting_for_task":
      return <WaitingForTask description={event.taskDescription} />;
    case "compact_boundary":
      return <CompactBoundary preTokens={event.preTokens} />;
    case "turn_duration":
      return <TurnDuration durationMs={event.durationMs} />;
    case "pr_link":
      return <PrLink prNumber={event.prNumber} prUrl={event.prUrl} />;
    case "unknown":
      return <UnknownEvent rawType={event.rawType} raw={event.raw} />;
    default:
      return null;
  }
}

// ─── User Message ────────────────────────────────────────────────

function UserMessage({ content, timestamp }: { content: string; timestamp: string }) {
  const [expanded, setExpanded] = useState(content.length <= 500);
  const display = expanded ? content : content.slice(0, 500) + "...";

  return (
    <div className="flex gap-3 py-3">
      <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <User size={14} className="text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-blue-400">User</span>
          <Timestamp ts={timestamp} />
        </div>
        <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
          {display}
        </div>
        {content.length > 500 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-[var(--accent-blue)] hover:underline mt-1"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Assistant Turn ──────────────────────────────────────────────

function AssistantTurn({ blocks, model, timestamp }: { blocks: AssistantBlock[]; model: string; timestamp: string }) {
  return (
    <div className="flex gap-3 py-3">
      <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={14} className="text-purple-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-purple-400">Claude</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {model.replace("claude-", "").replace(/-\d{8}$/, "")}
          </span>
          <Timestamp ts={timestamp} />
        </div>
        {blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function BlockRenderer({ block }: { block: AssistantBlock }) {
  const [expanded, setExpanded] = useState(false);

  if (block.type === "thinking") {
    return (
      <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Thinking
        </button>
        {expanded && (
          <div className="px-3 py-2 text-xs text-[var(--text-muted)] whitespace-pre-wrap border-t border-[var(--border-color)] max-h-[300px] overflow-y-auto leading-relaxed">
            {block.content}
          </div>
        )}
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <div className="text-sm text-[var(--text-primary)] leading-relaxed prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:text-[var(--accent-blue)] prose-code:bg-[var(--bg-primary)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs max-w-none">
        <Markdown>{block.content}</Markdown>
      </div>
    );
  }

  if (block.type === "tool_use") {
    return (
      <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Wrench size={11} className="text-yellow-400" />
          <span className="text-yellow-400 font-medium">{block.name}</span>
          {!expanded && block.input && (
            <span className="text-[var(--text-muted)] truncate ml-1">
              {summarizeToolInput(block.name, block.input)}
            </span>
          )}
        </button>
        {expanded && (
          <pre className="px-3 py-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-color)] overflow-x-auto max-h-[400px] overflow-y-auto">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return null;
}

function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  // Common tool summaries
  if (input.command) return String(input.command).slice(0, 80);
  if (input.file_path) return String(input.file_path);
  if (input.pattern) return `pattern: ${input.pattern}`;
  if (input.query) return String(input.query).slice(0, 60);
  if (input.content && typeof input.content === "string") return `${input.content.length} chars`;
  return "";
}

// ─── Tool Result ─────────────────────────────────────────────────

function ToolResult({ content, isError }: { content: string; isError: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 120);
  const hasMore = content.length > 120;

  return (
    <div className={`ml-10 border rounded-lg overflow-hidden ${isError ? "border-red-500/30" : "border-[var(--border-color)]"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {isError && <AlertTriangle size={11} className="text-red-400" />}
        <span className={`${isError ? "text-red-400" : "text-[var(--text-muted)]"} truncate`}>
          {hasMore && !expanded ? preview + "..." : preview}
        </span>
      </button>
      {expanded && hasMore && (
        <pre className="px-3 py-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-color)] overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </div>
  );
}

// ─── Bash Output ─────────────────────────────────────────────────

function BashOutput({ output }: { output: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!output) return null;

  return (
    <div className="ml-10 border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Terminal size={11} className="text-green-400" />
        <span className="truncate">{output.split("\n")[0].slice(0, 80)}</span>
      </button>
      {expanded && (
        <pre className="px-3 py-2 text-[11px] text-green-400/80 bg-black/20 border-t border-[var(--border-color)] overflow-x-auto max-h-[300px] overflow-y-auto font-mono">
          {output}
        </pre>
      )}
    </div>
  );
}

// ─── Agent Task ──────────────────────────────────────────────────

function AgentTask({ description, operation }: { description: string; operation: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = description.slice(0, 100);

  return (
    <div className="ml-10 border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Workflow size={11} className="text-cyan-400" />
        <span className="text-cyan-400 font-medium">{operation}</span>
        <span className="truncate">{preview}</span>
      </button>
      {expanded && description.length > 100 && (
        <pre className="px-3 py-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-color)] overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">
          {description}
        </pre>
      )}
    </div>
  );
}

// ─── MCP Call ────────────────────────────────────────────────────

function McpCall({ serverName, toolName, status }: { serverName: string; toolName: string; status: string }) {
  return (
    <div className="ml-10 flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-muted)] border border-[var(--border-color)] rounded-lg">
      <Server size={11} className="text-orange-400" />
      <span className="text-orange-400 font-medium">{serverName}</span>
      <span>{toolName}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">{status}</span>
    </div>
  );
}

// ─── Waiting for Task ────────────────────────────────────────────

function WaitingForTask({ description }: { description: string }) {
  return (
    <div className="ml-10 flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-muted)] border border-dashed border-[var(--border-color)] rounded-lg">
      <Hourglass size={11} className="text-yellow-400 animate-pulse" />
      <span>Waiting: {description || "task"}</span>
    </div>
  );
}

// ─── Compact Boundary ────────────────────────────────────────────

function CompactBoundary({ preTokens }: { preTokens: number }) {
  return (
    <div className="flex items-center gap-3 py-2 my-2">
      <div className="flex-1 h-px bg-[var(--border-color)]" />
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
        <Scissors size={11} />
        Context compacted ({preTokens > 0 ? `${Math.round(preTokens / 1000)}K tokens` : "auto"})
      </div>
      <div className="flex-1 h-px bg-[var(--border-color)]" />
    </div>
  );
}

// ─── Turn Duration ───────────────────────────────────────────────

function TurnDuration({ durationMs }: { durationMs: number }) {
  const secs = (durationMs / 1000).toFixed(1);
  return (
    <div className="flex items-center gap-1 ml-10 text-[10px] text-[var(--text-muted)] py-0.5">
      <Clock size={10} />
      Turn: {secs}s
    </div>
  );
}

// ─── PR Link ─────────────────────────────────────────────────────

function PrLink({ prNumber, prUrl }: { prNumber: number; prUrl: string }) {
  return (
    <a
      href={prUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-10 flex items-center gap-2 px-3 py-2 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-colors"
    >
      <ExternalLink size={12} className="text-purple-400" />
      <span className="text-sm text-purple-400 font-medium">PR #{prNumber}</span>
    </a>
  );
}

// ─── Unknown Event (future-proofing) ─────────────────────────────

function UnknownEvent({ rawType, raw }: { rawType: string; raw: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-10 border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <FileJson size={11} className="text-gray-400" />
        <span className="font-mono">{rawType}</span>
      </button>
      {expanded && (
        <pre className="px-3 py-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-color)] overflow-x-auto max-h-[400px] overflow-y-auto">
          {JSON.stringify(raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function Timestamp({ ts }: { ts: string }) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return <span className="text-[10px] text-[var(--text-muted)]">{time}</span>;
}
