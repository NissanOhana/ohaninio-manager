import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { OverviewData, LiveSession } from "../lib/api";
import type { AgentMessage } from "../lib/types";

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

type AgentEventListener = (msg: WsMessage) => void;

interface WebSocketContextValue {
  connected: boolean;
  agentRunning: boolean;
  send: (data: unknown) => void;
  subscribeAgent: (listener: AgentEventListener) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  connected: false,
  agentRunning: false,
  send: () => {},
  subscribeAgent: () => () => {},
});

export function useWs() {
  return useContext(WebSocketContext);
}

interface WebSocketProviderProps {
  children: ReactNode;
  onOverviewData?: (data: OverviewData) => void;
  onLiveSessions?: (sessions: LiveSession[]) => void;
  onDataChanged?: () => void;
}

export function WebSocketProvider({ children, onOverviewData, onLiveSessions, onDataChanged }: WebSocketProviderProps) {
  const [connected, setConnected] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<AgentEventListener>>(new Set());
  const callbacksRef = useRef({ onOverviewData, onLiveSessions, onDataChanged });
  callbacksRef.current = { onOverviewData, onLiveSessions, onDataChanged };

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
        reconnectTimer = setTimeout(() => {
          if (wsRef.current === ws) connect();
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          const cbs = callbacksRef.current;

          if (msg.type === "overview" && cbs.onOverviewData) {
            cbs.onOverviewData(msg.data as OverviewData);
          } else if (msg.type === "live_sessions" && cbs.onLiveSessions) {
            cbs.onLiveSessions(msg.sessions as LiveSession[]);
          } else if (msg.type === "data_changed" && cbs.onDataChanged) {
            cbs.onDataChanged();
          } else if (msg.type === "agent:running") {
            const agents = (msg.agents as any[]) || [];
            setAgentRunning(agents.length > 0);
          }

          // Forward all agent:* events to subscribers
          if (msg.type.startsWith("agent:") || msg.type.startsWith("run:")) {
            for (const listener of listenersRef.current) {
              listener(msg);
            }
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

  const subscribeAgent = useCallback((listener: AgentEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, agentRunning, send, subscribeAgent }}>
      {children}
    </WebSocketContext.Provider>
  );
}
