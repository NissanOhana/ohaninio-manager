import { useCallback } from "react";
import { useOverview } from "./hooks/useOverview";
import { useHashRouter } from "./hooks/useHashRouter";
import type { Route } from "./hooks/useHashRouter";
import { WebSocketProvider, useWs } from "./context/WebSocketContext";
import { DashboardPage } from "./pages/DashboardPage";
import { AgentPage } from "./pages/AgentPage";
import { RefreshCw, Wifi, WifiOff, LayoutDashboard, MessageCircle, Lightbulb, Loader2 } from "lucide-react";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import type { OverviewData, LiveSession } from "./lib/api";

function AppContent({
  data,
  loading,
  error,
  refresh,
}: {
  data: OverviewData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}) {
  const { connected, agentRunning, send } = useWs();
  const { route, navigate } = useHashRouter();
  const page = route.page;

  const handleRegenerateInsights = useCallback(() => {
    send({ action: "insights" });
  }, [send]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-[var(--text-muted)] text-lg">Loading orchestrator data...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-[var(--accent-red)] text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-14 border-b border-[var(--border-color)] flex items-center justify-between px-6 shrink-0 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔭</span>
          <h1 className="text-lg font-semibold tracking-tight">Ohaninio Manager</h1>
          <span className="text-sm text-[var(--text-muted)] ml-2">
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>

          {/* Page toggle */}
          <div className="flex items-center ml-4 bg-[var(--bg-tertiary)] rounded-lg p-0.5 border border-[var(--border-color)]">
            <button
              onClick={() => navigate({ page: "dashboard" })}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                page === "dashboard"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <LayoutDashboard size={13} />
              Dashboard
            </button>
            <button
              onClick={() => navigate({ page: "agent" })}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                page === "agent"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <MessageCircle size={13} />
              Agent
            </button>
            <button
              onClick={() => navigate({ page: "insights" })}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                page === "insights"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Lightbulb size={13} />
              Insights
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="p-2 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <ThemeToggle />
          {agentRunning && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-purple)] bg-[var(--accent-purple)]/10 px-2 py-1 rounded-md">
              <Loader2 size={12} className="animate-spin" />
              Agent working
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {connected ? (
              <><Wifi size={14} className="text-[var(--accent-green)]" /> Live</>
            ) : (
              <><WifiOff size={14} className="text-[var(--accent-red)]" /> Offline</>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      {page === "dashboard" || page === "insights" ? (
        <DashboardPage
          data={data}
          loading={loading}
          showInsights={page === "insights"}
          onRegenerateInsights={handleRegenerateInsights}
          insightsRegenerating={agentRunning}
          projectId={route.page === "dashboard" ? route.projectId : undefined}
          sessionId={route.page === "dashboard" ? route.sessionId : undefined}
          navigate={navigate}
        />
      ) : (
        <AgentPage />
      )}
    </div>
  );
}

export default function App() {
  const { data, loading, error, refresh, setOverviewData, setLiveSessions } = useOverview();

  return (
    <WebSocketProvider
      onOverviewData={setOverviewData}
      onLiveSessions={setLiveSessions}
      onDataChanged={refresh}
    >
      <AppContent data={data} loading={loading} error={error} refresh={refresh} />
    </WebSocketProvider>
  );
}
