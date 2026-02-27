import { useState } from "react";
import type { OverviewData, SessionEntry } from "../lib/api";
import { Sidebar } from "../components/sidebar/Sidebar";
import { SessionsView } from "../components/dashboard/SessionsView";
import { LearningPanel } from "../components/dashboard/LearningPanel";
import { StatsPanel } from "../components/dashboard/StatsPanel";
import { InsightsPanel } from "../components/insights/InsightsPanel";
import { ProjectDetail } from "../components/dashboard/ProjectDetail";
import { SessionDetail } from "../components/dashboard/SessionDetail";

interface DashboardPageProps {
  data: OverviewData;
  loading: boolean;
  showInsights: boolean;
}

export function DashboardPage({ data, loading, showInsights }: DashboardPageProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<(SessionEntry & { projectName: string }) | null>(null);

  const handleSelectProject = (projectId: string | null) => {
    setSelectedSession(null);
    setSelectedProject(projectId);
  };

  const handleSelectSession = (session: SessionEntry & { projectName: string }) => {
    setSelectedProject(null);
    setSelectedSession(session);
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
            <InsightsPanel />
          ) : selectedSession ? (
            <SessionDetail
              session={selectedSession}
              onBack={() => setSelectedSession(null)}
            />
          ) : selectedProject ? (
            <ProjectDetail
              projectId={selectedProject}
              projectName={data.projects.find((p) => p.id === selectedProject)?.name || selectedProject}
              onBack={() => setSelectedProject(null)}
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
