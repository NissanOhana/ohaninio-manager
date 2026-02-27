import { useState, useEffect } from "react";
import { ArrowLeft, GitBranch, MessageSquare, FileText, ExternalLink } from "lucide-react";
import { api, type SessionEntry, type MemoryFile } from "../../lib/api";

interface ProjectDetailProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

export function ProjectDetail({ projectId, projectName, onBack }: ProjectDetailProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.projectSessions(projectId, 30),
      api.projectMemory(projectId),
    ]).then(([sessData, memData]) => {
      setSessions(sessData.sessions);
      setMemoryFiles(memData.files);
      setLoading(false);
    });
  }, [projectId]);

  if (loading) {
    return (
      <div className="text-[var(--text-muted)] text-center py-12">Loading project data...</div>
    );
  }

  const openPRs = sessions
    .filter((s) => s.prUrl)
    .map((s) => ({ number: s.prNumber!, url: s.prUrl!, summary: s.summary }))
    .filter((pr, i, arr) => arr.findIndex((p) => p.number === pr.number) === i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl font-semibold">{projectName}</h2>
        <span className="text-sm text-[var(--text-muted)]">{sessions.length} sessions</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
          <div className="text-2xl font-bold text-blue-400">{sessions.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Total Sessions</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
          <div className="text-2xl font-bold text-purple-400">{memoryFiles.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Memory Files</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
          <div className="text-2xl font-bold text-green-400">{openPRs.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Open PRs</div>
        </div>
      </div>

      {/* Open PRs */}
      {openPRs.length > 0 && (
        <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Open PRs</h3>
          <div className="space-y-2">
            {openPRs.map((pr) => (
              <div key={pr.number} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink size={12} className="text-purple-400 shrink-0" />
                  <span className="text-sm text-purple-400">#{pr.number}</span>
                  <span className="text-xs text-[var(--text-secondary)] truncate">{pr.summary}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Sessions */}
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Recent Sessions</h3>
        <div className="space-y-1.5">
          {sessions.slice(0, 20).map((session, i) => (
            <div key={session.sessionId || i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)]">
              <span className="text-xs text-[var(--text-muted)] shrink-0 w-16 mt-0.5">
                {new Date(session.modified).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--text-primary)] truncate">{session.summary}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {session.gitBranch && (
                    <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                      <GitBranch size={9} /> {session.gitBranch}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                    <MessageSquare size={9} /> {session.messageCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Memory Content */}
      {memoryFiles.length > 0 && (
        <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText size={14} />
            Memory Files
          </h3>
          <div className="space-y-2">
            {memoryFiles.map((file) => (
              <div key={file.name}>
                <button
                  onClick={() => setExpandedMemory(expandedMemory === file.name ? null : file.name)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                >
                  <span className="text-sm text-[var(--text-primary)]">{file.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {new Date(file.lastModified).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {Math.round(file.sizeBytes / 1024)}KB
                  </span>
                </button>
                {expandedMemory === file.name && (
                  <pre className="mt-1 p-3 rounded-lg bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)] overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {file.content}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
