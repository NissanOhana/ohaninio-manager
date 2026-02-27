import { useState, useEffect, useCallback } from "react";
import { api, type OverviewData, type LiveSession } from "../lib/api";

export function useOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.overview();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch only — no polling
  useEffect(() => {
    refresh();
  }, [refresh]);

  // WebSocket pushes full overview data
  const setOverviewData = useCallback((overview: OverviewData) => {
    setData(overview);
  }, []);

  // WebSocket pushes just live sessions (partial update)
  const setLiveSessions = useCallback((sessions: LiveSession[]) => {
    setData((prev) => (prev ? { ...prev, liveSessions: sessions } : prev));
  }, []);

  return { data, loading, error, refresh, setOverviewData, setLiveSessions };
}
