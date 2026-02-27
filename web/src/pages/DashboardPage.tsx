import { useState } from "react";
import type { OverviewData, SessionEntry } from "../lib/api";
import { Sidebar } from "../components/sidebar/Sidebar";
import { StatusCards } from "../components/dashboard/StatusCards";
import { LiveSessions } from "../components/dashboard/LiveSessions";
import { RecentSessions } from "../components/dashboard/RecentSessions";
import { MemoryHealth } from "../components/dashboard/MemoryHealth";
import { SessionChart } from "../components/dashboard/SessionChart";
import { InsightsPanel } from "../components/insights/InsightsPanel";
import { ProjectDetail } from "../components/dashboard/ProjectDetail";
import { SessionDetail } from "../components/dashboard/SessionDetail";
import { AgentChatPanel } from "../components/chat/AgentChatPanel";

interface DashboardPageProps {
  data: OverviewData;
  loading: boolean;
  showInsights: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
}

export function DashboardPage({ data, loading, showInsights, chatOpen, onToggleChat }: DashboardPageProps) {
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
              <StatusCards statuses={data.statuses} onSelectProject={handleSelectProject} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LiveSessions sessions={data.liveSessions || []} onSelectSession={handleSelectSession} />
                <RecentSessions sessions={data.todaySessions || []} onSelectSession={handleSelectSession} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SessionChart projects={data.projects} />
                <MemoryHealth health={data.memoryHealth} />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Chat Panel */}
      {chatOpen && <AgentChatPanel onClose={onToggleChat} />}
    </>
  );
}
