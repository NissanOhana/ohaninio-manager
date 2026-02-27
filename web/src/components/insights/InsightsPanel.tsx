import { useState, useEffect } from "react";
import { Flame, Lightbulb, FileCode, Sparkles, RefreshCw } from "lucide-react";
import { api, type InsightsReport } from "../../lib/api";

interface InsightsPanelProps {
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function InsightsPanel({ onRegenerate, regenerating }: InsightsPanelProps = {}) {
  const [data, setData] = useState<InsightsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.insights().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-[var(--text-muted)] text-center py-12">Loading insights...</div>;
  }

  if (!data || !data.reportDate) {
    return (
      <div className="text-center py-12">
        <Sparkles size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-[var(--text-muted)] mb-2">No insights report found</p>
        {onRegenerate ? (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] text-sm font-medium hover:bg-[var(--accent-purple)]/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
            {regenerating ? "Generating..." : "Generate Insights Report"}
          </button>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Run /insights in Claude Code to generate one</p>
        )}
      </div>
    );
  }

  const reportDate = new Date(data.reportDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles size={20} className="text-purple-400" />
          Insights Report
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">Generated {reportDate}</span>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs font-medium hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
          )}
        </div>
      </div>

      {/* Friction Patterns */}
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Flame size={14} className="text-orange-400" />
          Friction Patterns
        </h3>
        {data.frictionPatterns.length > 0 ? (
          <div className="space-y-2">
            {data.frictionPatterns.map((pattern, i) => (
              <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
                      pattern.severity === "high"
                        ? "bg-red-500/20 text-red-400"
                        : pattern.severity === "medium"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-gray-500/20 text-[var(--text-secondary)]"
                    }`}
                  >
                    {pattern.severity}
                  </span>
                  <span className="text-sm text-[var(--text-primary)]">{pattern.name}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{pattern.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">No friction patterns detected</p>
        )}
      </section>

      {/* Suggestions */}
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Lightbulb size={14} className="text-yellow-400" />
          CLAUDE.md Suggestions
        </h3>
        {data.suggestions.length > 0 ? (
          <div className="space-y-2">
            {data.suggestions.map((sug, i) => (
              <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <p className="text-sm text-[var(--text-primary)] mb-1">{sug.text}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-muted)]">Target: {sug.target}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">No suggestions found</p>
        )}
      </section>

      {/* Skill Ideas */}
      <section className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileCode size={14} className="text-blue-400" />
          Suggested Skills
        </h3>
        {data.skillIdeas.length > 0 ? (
          <div className="space-y-2">
            {data.skillIdeas.map((idea, i) => (
              <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{idea.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{idea.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">No skill ideas found</p>
        )}
      </section>
    </div>
  );
}
