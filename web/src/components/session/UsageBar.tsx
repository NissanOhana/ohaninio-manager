import { Cpu, MessageSquare, Wrench, Coins } from "lucide-react";
import type { SessionEvent, UsageData } from "../../lib/types";

interface UsageBarProps {
  events: SessionEvent[];
  usage: UsageData;
  isLive: boolean;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsageBar({ events, usage, isLive }: UsageBarProps) {
  // Count turns and tool calls
  const userMessages = events.filter((e) => e.kind === "user_message").length;
  const assistantTurns = events.filter((e) => e.kind === "assistant_turn").length;
  let toolCalls = 0;
  let model = "";

  for (const evt of events) {
    if (evt.kind === "assistant_turn") {
      if (!model) model = evt.model;
      for (const block of evt.blocks) {
        if (block.type === "tool_use") toolCalls++;
      }
    }
  }

  const cacheHitPct =
    usage.inputTokens + usage.cacheReadTokens > 0
      ? Math.round((usage.cacheReadTokens / (usage.inputTokens + usage.cacheReadTokens)) * 100)
      : 0;

  return (
    <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] flex-wrap">
      {model && (
        <span className="flex items-center gap-1">
          <Cpu size={11} />
          {model.replace("claude-", "").replace(/-\d{8}$/, "")}
        </span>
      )}
      <span className="flex items-center gap-1">
        <MessageSquare size={11} />
        {userMessages} / {assistantTurns}
      </span>
      {toolCalls > 0 && (
        <span className="flex items-center gap-1">
          <Wrench size={11} />
          {toolCalls}
        </span>
      )}
      {(usage.inputTokens > 0 || usage.outputTokens > 0) && (
        <span className="flex items-center gap-1">
          <Coins size={11} />
          {formatTokens(usage.inputTokens + usage.cacheReadTokens)}in / {formatTokens(usage.outputTokens)}out
          {cacheHitPct > 0 && <span className="text-green-400">({cacheHitPct}% cache)</span>}
        </span>
      )}
      {isLive && (
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      )}
    </div>
  );
}
