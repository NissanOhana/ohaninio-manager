import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { RunRecord } from "../lib/types";

export function useRunHistory() {
  const [runs, setRuns] = useState<Omit<RunRecord, "messages">[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await api.runs();
      setRuns(data.runs);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const selectRun = useCallback(async (id: string | null) => {
    if (!id) {
      setSelectedRun(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api.run(id);
      setSelectedRun(data.run);
    } catch {
      setSelectedRun(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { runs, selectedRun, loading, fetchRuns, selectRun };
}
