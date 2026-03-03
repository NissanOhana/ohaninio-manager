import { useMemo, useState, useEffect } from "react";
import type { OverviewData, SessionEntry } from "../lib/api";
import { api } from "../lib/api";
import type { Route } from "../hooks/useHashRouter";
import { Sidebar } from "../components/sidebar/Sidebar";
import { SessionsView } from "../components/dashboard/SessionsView";
import { LearningPanel } from "../components/dashboard/LearningPanel";
import { StatsPanel } from "../components/dashboard/StatsPanel";
import { WorkPlanPanel } from "../components/dashboard/WorkPlanPanel";
import { InsightsPanel } from "../components/insights/InsightsPanel";
import { ProjectDetail } from "../components/dashboard/ProjectDetail";
import { SessionViewer } from "../components/session/SessionViewer";

interface DashboardPageProps {
  data: OverviewData;
  loading: boolean;
  showInsights: boolean;
  onRegenerateInsights?: () => void;
  insightsRegenerating?: boolean;
  projectId?: string;
  sessionId?: string;
  navigate: (route: Route) => void;
}

export function DashboardPage({ data, loading, showInsights, onRegenerateInsights, insightsRegenerating, projectId, sessionId, navigate }: DashboardPageProps) {
  const selectedProject = projectId || null;

  // Resolve sessionId to a session object from today's sessions or live sessions
  const localSession = useMemo(() => {
    if (!sessionId) return null;
    const allSessions = [
      ...(data.liveSessions || []),
      ...(data.todaySessions || []),
    ];
    // Also search project sessions
    for (const project of data.projects) {
      const projSessions = data.statuses
        ?.find((s) => s.projectId === project.id)
        ?.recentSessions?.map((s) => ({ ...s, projectName: project.name }));
      if (projSessions) allSessions.push(...projSessions);
    }
    return allSessions.find((s) => s.sessionId === sessionId) as (SessionEntry & { projectName: string }) | undefined || null;
  }, [sessionId, data]);

  // Fallback: fetch session from REST API if not in overview data
  const [fetchedSession, setFetchedSession] = useState<(SessionEntry & { projectName: string }) | null>(null);
  useEffect(() => {
    if (!sessionId || localSession) {
      setFetchedSession(null);
      return;
    }
    api.session(sessionId).then((res) => {
      setFetchedSession(res.session);
    }).catch(() => setFetchedSession(null));
  }, [sessionId, localSession]);

  const selectedSession = localSession || fetchedSession;

  const handleSelectProject = (id: string | null) => {
    if (id) {
      navigate({ page: "dashboard", projectId: id });
    } else {
      navigate({ page: "dashboard" });
    }
  };

  const handleSelectSession = (session: SessionEntry & { projectName: string }) => {
    navigate({ page: "dashboard", sessionId: session.sessionId });
  };

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          projects={data.projects}
          stats={data.stats}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {showInsights ? (
            <InsightsPanel onRegenerate={onRegenerateInsights} regenerating={insightsRegenerating} />
          ) : selectedSession ? (
            <SessionViewer
              session={selectedSession}
              onBack={() => navigate({ page: "dashboard" })}
            />
          ) : selectedProject ? (
            <ProjectDetail
              projectId={selectedProject}
              projectName={data.projects.find((p) => p.id === selectedProject)?.name || selectedProject}
              onBack={() => navigate({ page: "dashboard" })}
              onSelectSession={handleSelectSession}
            />
          ) : (
            <>
              {/* Sessions - Main hero view */}
              <SessionsView
                liveSessions={data.liveSessions || []}
                todaySessions={data.todaySessions || []}
                onSelectSession={handleSelectSession}
              />

              {/* Work Plan */}
              <WorkPlanPanel />

              {/* Learning + Stats side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LearningPanel />
                {data.usageStats && <StatsPanel stats={data.usageStats} />}
              </div>
            </>
          )}
        </main>
      </div>

    </>
  );
}
