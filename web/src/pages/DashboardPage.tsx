import { useState } from "react";
import type { OverviewData } from "../lib/api";
import { Sidebar } from "../components/sidebar/Sidebar";
import { StatusCards } from "../components/dashboard/StatusCards";
import { LiveSessions } from "../components/dashboard/LiveSessions";
import { MemoryHealth } from "../components/dashboard/MemoryHealth";
import { SessionChart } from "../components/dashboard/SessionChart";
import { InsightsPanel } from "../components/insights/InsightsPanel";
import { ProjectDetail } from "../components/dashboard/ProjectDetail";
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

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          projects={data.projects}
          stats={data.stats}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {showInsights ? (
            <InsightsPanel />
          ) : selectedProject ? (
            <ProjectDetail
              projectId={selectedProject}
              projectName={data.projects.find((p) => p.id === selectedProject)?.name || selectedProject}
              onBack={() => setSelectedProject(null)}
            />
          ) : (
            <>
              <StatusCards statuses={data.statuses} onSelectProject={setSelectedProject} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LiveSessions sessions={data.liveSessions || []} />
                <MemoryHealth health={data.memoryHealth} />
              </div>
              <SessionChart projects={data.projects} />
            </>
          )}
        </main>
      </div>

      {/* Chat Panel */}
      {chatOpen && <AgentChatPanel onClose={onToggleChat} />}
    </>
  );
}
