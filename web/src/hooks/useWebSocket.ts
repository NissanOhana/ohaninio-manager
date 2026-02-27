import { useState, useEffect, useCallback, useRef } from "react";
import type { OverviewData, LiveSession } from "../lib/api";

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

interface RunningAgent {
  id: string;
  mode: string;
  elapsedMs: number;
}

interface UseWebSocketOptions {
  onDataChanged?: () => void;
  onOverviewData?: (data: OverviewData) => void;
  onLiveSessions?: (sessions: LiveSession[]) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [runningAgents, setRunningAgents] = useState<RunningAgent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 3s
        reconnectTimer = setTimeout(() => {
          if (wsRef.current === ws) {
            connect();
          }
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          const opts = optionsRef.current;

          if (msg.type === "overview" && opts.onOverviewData) {
            opts.onOverviewData(msg.data as OverviewData);
          } else if (msg.type === "live_sessions" && opts.onLiveSessions) {
            opts.onLiveSessions(msg.sessions as LiveSession[]);
          } else if (msg.type === "data_changed" && opts.onDataChanged) {
            opts.onDataChanged();
          } else if (msg.type === "agent:running") {
            const agents = (msg.agents as RunningAgent[]) || [];
            setRunningAgents(agents);
            setAgentRunning(agents.length > 0);
          }
        } catch {}
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, send, agentRunning, runningAgents };
}
