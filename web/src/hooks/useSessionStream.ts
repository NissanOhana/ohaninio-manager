import { useState, useEffect, useRef } from "react";
import { useWs } from "../context/WebSocketContext";
import type { SessionEvent, UsageData } from "../lib/types";

interface SessionStreamState {
  events: SessionEvent[];
  isLive: boolean;
  loading: boolean;
  error: string | null;
  usage: UsageData;
}

export function useSessionStream(sessionId: string | null) {
  const { send, subscribeAgent, connected } = useWs();
  const [state, setState] = useState<SessionStreamState>({
    events: [],
    isLive: false,
    loading: true,
    error: null,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  });
  const sentRef = useRef(false);

  // Subscribe to session:* WS messages
  useEffect(() => {
    if (!sessionId) return;

    // Reset state when sessionId changes
    sentRef.current = false;
    setState({
      events: [],
      isLive: false,
      loading: true,
      error: null,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    });

    const unsub = subscribeAgent((msg) => {
      if (msg.type === "session:meta") {
        // Meta received — backend acknowledged. Don't clear loading yet;
        // wait for session:events or session:ready.
        setState((prev) => ({
          ...prev,
          isLive: msg.isLive as boolean,
        }));
      }

      if (msg.type === "session:ready") {
        // Backend finished reading the initial file. If no events were sent,
        // the session is genuinely empty — clear loading.
        setState((prev) => ({
          ...prev,
          loading: false,
        }));
      }

      if (msg.type === "session:events") {
        const newEvents = msg.events as SessionEvent[];
        setState((prev) => {
          const allEvents = [...prev.events, ...newEvents];

          const usage = { ...prev.usage };
          for (const evt of newEvents) {
            if (evt.kind === "assistant_turn") {
              usage.inputTokens += evt.usage.inputTokens;
              usage.outputTokens += evt.usage.outputTokens;
              usage.cacheReadTokens += evt.usage.cacheReadTokens;
              usage.cacheCreationTokens += evt.usage.cacheCreationTokens;
            }
          }

          return {
            ...prev,
            events: allEvents,
            loading: false,
            usage,
          };
        });
      }

      if (msg.type === "session:error") {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: msg.error as string,
        }));
      }
    });

    return () => {
      unsub();
      send({ action: "session_stream_stop" });
    };
  }, [sessionId, subscribeAgent, send]);

  // Send stream request when WS is connected (retry on reconnect)
  useEffect(() => {
    if (!sessionId || !connected) {
      sentRef.current = false;
      return;
    }

    if (!sentRef.current) {
      sentRef.current = true;
      send({ action: "session_stream", sessionId });
    }
  }, [sessionId, connected, send]);

  return state;
}
