import { useState } from "react";
import { useOverview } from "./hooks/useOverview";
import { useWebSocket } from "./hooks/useWebSocket";
import { DashboardPage } from "./pages/DashboardPage";
import { AgentPage } from "./pages/AgentPage";
import { RefreshCw, Wifi, WifiOff, LayoutDashboard, MessageCircle } from "lucide-react";
import { ThemeToggle } from "./components/ui/ThemeToggle";

type Page = "dashboard" | "agent";

export default function App() {
  const { data, loading, error, refresh } = useOverview();
  const { connected } = useWebSocket(refresh);
  const [page, setPage] = useState<Page>("dashboard");
  const [showInsights, setShowInsights] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

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
              onClick={() => setPage("dashboard")}
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
              onClick={() => setPage("agent")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                page === "agent"
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <MessageCircle size={13} />
              Agent
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {page === "dashboard" && (
            <>
              <button
                onClick={() => setShowInsights(!showInsights)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  showInsights
                    ? "bg-purple-600/20 text-[var(--accent-purple)] border border-purple-600/30"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                }`}
              >
                Insights
              </button>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  chatOpen
                    ? "bg-blue-600/20 text-[var(--accent-blue)] border border-blue-600/30"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                }`}
              >
                Chat
              </button>
            </>
          )}
          <button
            onClick={refresh}
            className="p-2 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <ThemeToggle />
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
      {page === "dashboard" ? (
        <DashboardPage
          data={data}
          loading={loading}
          showInsights={showInsights}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(!chatOpen)}
        />
      ) : (
        <AgentPage />
      )}
    </div>
  );
}
