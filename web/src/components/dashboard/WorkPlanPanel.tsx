import { useState, useRef, useEffect, useCallback } from "react";
import { Compass, Loader2 } from "lucide-react";
import { useWs } from "../../context/WebSocketContext";
import { AssistantTextBubble, ThinkingBubble, ToolGroup, ResultCard, ErrorCard, LoadingDots, groupMessages } from "../chat/MessageList";
import type { AgentMessage } from "../../lib/types";

export function WorkPlanPanel() {
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const { send, subscribeAgent } = useWs();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMsgsRef = useRef<AgentMessage[]>([]);
  const isWorkPlanRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    const unsubscribe = subscribeAgent((data) => {
      if (!isWorkPlanRef.current) return;

      if (data.type === "agent:start") {
        setRunning(true);
        setStreamingText("");
        currentMsgsRef.current = [];
        setMessages([]);
        return;
      }

      if (data.type === "agent:text_delta") {
        setStreamingText((prev) => prev + (data.content as string));
        return;
      }

      if (data.type === "agent:text" || data.type === "agent:thinking" || data.type === "agent:tool") {
        currentMsgsRef.current.push(data as unknown as AgentMessage);
        setMessages([...currentMsgsRef.current]);
        if (data.type === "agent:text") {
          setStreamingText("");
        }
        return;
      }

      if (data.type === "agent:complete" || data.type === "agent:error") {
        currentMsgsRef.current.push(data as unknown as AgentMessage);
        setMessages([...currentMsgsRef.current]);
        setRunning(false);
        setStreamingText("");
        setHasResult(true);
        isWorkPlanRef.current = false;
        return;
      }
    });

    return unsubscribe;
  }, [subscribeAgent]);

  const handlePlan = useCallback(() => {
    if (running) return;
    setHasResult(false);
    isWorkPlanRef.current = true;
    send({ action: "work_plan" });
  }, [running, send]);

  const groups = groupMessages(messages);

  return (
    <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
          <Compass size={14} className="text-[var(--accent-green)]" />
          What Should I Do Now?
        </h2>

        <button
          onClick={handlePlan}
          disabled={running}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            running
              ? "bg-[var(--accent-green)]/20 text-[var(--accent-green)] cursor-wait"
              : "bg-[var(--accent-green)] text-white hover:opacity-90"
          }`}
        >
          {running ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Thinking...
            </span>
          ) : (
            "Plan my work"
          )}
        </button>
      </div>

      {/* Results */}
      {(messages.length > 0 || running) && (
        <div className="border-t border-[var(--border-color)] pt-4 space-y-2 max-h-[600px] overflow-y-auto">
          {groups.map((group, i) => {
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
          })}

          {running && streamingText && <AssistantTextBubble content={streamingText} />}
          {running && !streamingText && messages.length === 0 && <LoadingDots />}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Empty state */}
      {!running && messages.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-[var(--text-muted)]">
            Get AI-powered suggestions for what to work on next based on your active sessions and project statuses
          </p>
        </div>
      )}
    </section>
  );
}
